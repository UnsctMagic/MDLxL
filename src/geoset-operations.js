import { appendGeosetGeometry, deleteGeoset } from './editor-document.js';
import { gather, updateBounds } from './mesh-tools.js';

const textureSlots = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
const geometryFields = new Set(['Vertices', 'Normals', 'Faces', 'TVertices', 'VertexGroup', 'Groups', 'TotalGroupsCount', 'Tangents', 'SkinWeights', 'PrimitiveTypes', 'PrimitiveCounts', 'MinimumExtent', 'MaximumExtent', 'BoundsRadius', 'Anims', 'MaterialID', 'Name']);

function signature(value) {
  if (ArrayBuffer.isView(value)) return Array.from(value, signature);
  if (Array.isArray(value)) return value.map(signature);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, signature(value[key])]));
  return value;
}
const keyOf = value => JSON.stringify(signature(value));

function materialKey(model, materialId) {
  const material = model.Materials?.[materialId];
  if (!material) return null;
  const resolved = structuredClone(material);
  const texture = id => id == null || id === -1 ? id : model.Textures?.[id] ? { texture: signature(model.Textures[id]) } : { missingTexture: id };
  const resolveSlot = value => {
    if (typeof value === 'number') return texture(value);
    if (!value?.Keys) return value;
    for (const frame of value.Keys) for (const field of ['Vector', 'InTan', 'OutTan']) if (frame[field]) frame[field] = Array.from(frame[field], texture);
    return value;
  };
  for (const layer of resolved.Layers || []) {
    for (const slot of textureSlots) {
      if (layer[slot] !== undefined) layer[slot] = resolveSlot(layer[slot]);
      if (layer._MdxDefaults?.[slot] !== undefined) layer._MdxDefaults[slot] = texture(layer._MdxDefaults[slot]);
    }
    if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1) layer.TVertexAnimId = { animation: signature(model.TextureAnims?.[layer.TVertexAnimId]) };
  }
  return keyOf(resolved);
}

function appearanceKey(model, index, animations) {
  const g = model.Geosets[index], material = materialKey(model, g.MaterialID);
  if (material == null) return null;
  const metadata = Object.fromEntries(Object.entries(g).filter(([field]) => !geometryFields.has(field)));
  const anims = animations[index].map(animIndex => {
    const anim = model.GeosetAnims[animIndex];
    return { rgb: animationPart(anim, 'rgb'), visibility: animationPart(anim, 'visibility'), settings: animationPart(anim, 'animationSettings') };
  });
  return keyOf({ material, metadata, anims, uvSets: g.TVertices.length, tangents: !!g.Tangents?.length, skin: !!g.SkinWeights?.length, extentCount: g.Anims?.length || 0 });
}

function animationIndices(model) {
  const byGeoset = Array.from({ length: model.Geosets.length }, () => []);
  (model.GeosetAnims || []).forEach((anim, index) => byGeoset[anim.GeosetId]?.push(index));
  return byGeoset;
}

const metadataOf = g => Object.fromEntries(Object.entries(g).filter(([field]) => !geometryFields.has(field)));
const recordsOf = (model, index) => (model.GeosetAnims || []).filter(anim => anim.GeosetId === index);
function animationPart(anim, part) {
  if (part === 'rgb') return { Color: anim.Color, enabled: anim.Flags & 2, base: anim._MdxDefaults?.Color };
  if (part === 'visibility') return { Alpha: anim.Alpha, base: anim._MdxDefaults?.Alpha };
  const { GeosetId, Color, Alpha, Flags, _MdxDefaults, ...rest } = anim;
  const { Color: baseColor, Alpha: baseAlpha, ...defaults } = _MdxDefaults || {};
  return { ...rest, Flags: (Flags || 0) & ~2, defaults };
}

function describeValue(value) {
  if (value?.Keys) return `${value.Keys.length} keys, ${['step', 'linear', 'Hermite', 'Bezier'][value.LineType] || 'unknown'} interpolation${value.GlobalSeqId != null ? `, global sequence ${value.GlobalSeqId + 1}` : ''}`;
  if (ArrayBuffer.isView(value) || Array.isArray(value)) return Array.from(value, v => typeof v === 'number' ? Number(v.toFixed(4)) : v).join(', ');
  return value == null ? 'none' : String(value);
}

/** Read-only merge review. Different materials never become a resolution option. */
export function geosetMergeConflicts(model, selectionByGeoset) {
  const byMaterial = new Map();
  for (const [text, selected] of Object.entries(selectionByGeoset || {})) {
    const index = Number(text), geoset = model.Geosets[index];
    if (!selected?.length || !geoset) continue;
    const key = materialKey(model, geoset.MaterialID);
    if (key == null) continue;
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key).push(index);
  }
  const groups = [...byMaterial.values()].filter(indices => indices.length > 1).map(indices => {
    indices.sort((a, b) => a - b);
    const id = String(indices[0]), conflicts = [];
    const addSources = (kind, label, values, describe = describeValue, field) => {
      if (new Set(values.map(keyOf)).size < 2) return;
      conflicts.push({ id: `${id}:${kind}:${field || ''}`, kind, field, label,
        options: indices.map((index, position) => ({ value: String(index), label: `Use geoset ${index + 1}`, detail: describe(values[position]) })) });
    };
    const records = indices.map(index => recordsOf(model, index));
    if (new Set(records.map(list => list.length)).size > 1) {
      addSources('animations', 'RGB and visibility records', records.map(list => list.map(({ GeosetId, ...anim }) => anim)), list => `${list.length} animation records; replaces RGB and visibility together`);
    } else {
      for (const [kind, label, property] of [['rgb', 'RGB', 'Color'], ['visibility', 'Visibility', 'Alpha'], ['animationSettings', 'Animation flags and stored settings', null]]) {
        const values = records.map(list => list.map(anim => animationPart(anim, kind)));
        addSources(kind, label, values, parts => parts.map((part, position) => {
          if (!property) return keyOf(part);
          const track = part[property];
          const differingKey = track?.Keys?.find((key, keyIndex) => values.some(other => keyOf(other[position]?.[property]?.Keys?.[keyIndex]) !== keyOf(key)));
          return `${describeValue(track)}${differingKey ? `; frame ${differingKey.Frame}: ${describeValue(differingKey.Vector)}` : ''}${kind === 'rgb' ? `; tint ${part.enabled ? 'on' : 'off'}` : ''}${part.base !== undefined ? `; stored base ${describeValue(part.base)}` : ''}`;
        }).join('; '));
      }
    }
    const metadata = indices.map(index => metadataOf(model.Geosets[index]));
    for (const field of new Set(metadata.flatMap(value => Object.keys(value)))) addSources('metadata', field, metadata.map(value => value[field]), describeValue, field);
    const addFormat = (kind, label, values, options) => {
      if (new Set(values).size > 1) conflicts.push({ id: `${id}:${kind}:`, kind, label, options });
    };
    const uvCounts = indices.map(index => model.Geosets[index].TVertices.length);
    addFormat('uv', `UV sets (${indices.map((index, position) => `${index + 1}: ${uvCounts[position]}`).join(', ')})`, uvCounts, [
      { value: 'keep', label: 'Keep all UV sets', detail: 'Fill missing sets from that mesh’s first UV set, or with 0, 0 if it has none.' },
      { value: 'trim', label: 'Keep only shared UV sets', detail: 'Remove extra UV sets from meshes that have more.' },
    ]);
    addFormat('tangents', 'Tangent format', indices.map(index => !!model.Geosets[index].Tangents?.length), [
      { value: 'remove', label: 'Remove tangents', detail: 'Normal mapping may change; vertices and normals stay intact.' },
    ]);
    addFormat('skin', 'Skin-weight format', indices.map(index => !!model.Geosets[index].SkinWeights?.length), [
      { value: 'remove', label: 'Use matrix-group bindings', detail: 'Remove skin weights; weighted deformation may change.' },
    ]);
    addFormat('extents', 'Animation bounds count', indices.map(index => model.Geosets[index].Anims?.length || 0), [
      { value: 'union', label: 'Combine animation bounds', detail: 'Keep every existing bound and fill missing entries with empty bounds.' },
    ]);
    const first = model.Geosets[indices[0]], combined = { Vertices: { length: first.Vertices.length }, Groups: [...first.Groups] };
    let exceedsLimit = false;
    for (const index of indices.slice(1)) {
      const geoset = model.Geosets[index];
      if (!canAppend(combined, geoset)) { exceedsLimit = true; break; }
      combined.Vertices.length += geoset.Vertices.length;
      for (const groupId of new Set(geoset.VertexGroup)) {
        const group = geoset.Groups[groupId];
        if (!combined.Groups.some(other => keyOf(other) === keyOf(group))) combined.Groups.push(group);
      }
    }
    if (exceedsLimit) conflicts.push({ id: `${id}:limits:`, kind: 'limits', label: 'Model format limits', options: [
      { value: 'separate', label: 'Merge what fits; keep the rest separate', detail: 'One geoset can hold at most 65,536 vertices and 256 matrix groups.' },
    ] });
    return { id, indices, materialId: model.Geosets[indices[0]].MaterialID, conflicts };
  });
  return { groups, conflicts: groups.flatMap(group => group.conflicts) };
}

function copyOptional(target, source, field) {
  if (source[field] === undefined) delete target[field];
  else target[field] = structuredClone(source[field]);
}

function mergeParticipants(model, indices) {
  const candidates = [];
  for (const index of indices) {
    const source = model.Geosets[index];
    let target = candidates.find(candidate => canAppend(candidate, source));
    if (!target) {
      candidates.push({ Vertices: { length: source.Vertices.length }, Groups: [...source.Groups], indices: [index] });
      continue;
    }
    target.indices.push(index); target.Vertices.length += source.Vertices.length;
    for (const groupId of new Set(source.VertexGroup)) {
      const group = source.Groups[groupId];
      if (!target.Groups.some(other => keyOf(other) === keyOf(group))) target.Groups.push(group);
    }
  }
  return candidates.filter(candidate => candidate.indices.length > 1).flatMap(candidate => candidate.indices);
}

function resolveMergeConflicts(model, review, resolutions) {
  // Capture every donor before applying any choice; independent RGB and alpha
  // choices must not read records already altered by another resolution.
  const sources = structuredClone(model.GeosetAnims || []);
  for (const originalGroup of review.groups) {
    const group = { ...originalGroup, indices: mergeParticipants(model, originalGroup.indices) };
    for (const conflict of group.conflicts) {
      const choice = resolutions[conflict.id];
      if (!conflict.options.some(option => option.value === choice)) throw Error(`Choose a resolution for ${conflict.label}.`);
      const donor = sources.filter(anim => anim.GeosetId === Number(choice));
      if (conflict.kind === 'animations') {
        const old = model.GeosetAnims || [], replacements = new Map();
        const next = [];
        old.forEach((anim, index) => {
          if (!group.indices.includes(anim.GeosetId)) { replacements.set(index, next.length); next.push(anim); }
        });
        for (const index of group.indices) {
          const start = next.length;
          next.push(...donor.map(anim => ({ ...structuredClone(anim), GeosetId: index })));
          old.forEach((anim, oldIndex) => { if (anim.GeosetId === index) replacements.set(oldIndex, donor.length ? start + Math.min(old.filter(a => a.GeosetId === index).indexOf(anim), donor.length - 1) : null); });
        }
        for (const bone of model.Bones || []) if (replacements.has(bone.GeosetAnimId)) bone.GeosetAnimId = replacements.get(bone.GeosetAnimId);
        model.GeosetAnims = next;
        continue;
      }
      for (const index of group.indices) {
        const g = model.Geosets[index];
        if (conflict.kind === 'metadata') copyOptional(g, model.Geosets[Number(choice)], conflict.field);
        else if (['rgb', 'visibility', 'animationSettings'].includes(conflict.kind)) {
          recordsOf(model, index).forEach((anim, position) => {
            const source = donor[position];
            if (conflict.kind === 'animationSettings') {
              const color = animationPart(anim, 'rgb'), alpha = animationPart(anim, 'visibility'), id = anim.GeosetId;
              for (const field of Object.keys(anim)) delete anim[field];
              Object.assign(anim, structuredClone(source), { GeosetId: id, Color: color.Color, Alpha: alpha.Alpha, Flags: ((source.Flags || 0) & ~2) | color.enabled });
              anim._MdxDefaults ||= {};
              copyOptional(anim._MdxDefaults, { Color: color.base }, 'Color');
              copyOptional(anim._MdxDefaults, { Alpha: alpha.base }, 'Alpha');
            } else {
              const property = conflict.kind === 'rgb' ? 'Color' : 'Alpha';
              copyOptional(anim, source, property);
              if (property === 'Color') anim.Flags = ((anim.Flags || 0) & ~2) | (source.Flags & 2);
              if (source._MdxDefaults?.[property] !== undefined) { anim._MdxDefaults ||= {}; copyOptional(anim._MdxDefaults, source._MdxDefaults, property); }
              else if (anim._MdxDefaults) delete anim._MdxDefaults[property];
            }
          });
        } else if (conflict.kind === 'uv') {
          const counts = group.indices.map(other => model.Geosets[other].TVertices.length);
          const count = choice === 'keep' ? Math.max(...counts) : Math.min(...counts);
          g.TVertices = Array.from({ length: count }, (_, slot) => g.TVertices[slot] || (g.TVertices[0] ? g.TVertices[0].slice() : new Float32Array(g.Vertices.length / 3 * 2)));
        } else if (conflict.kind === 'tangents') delete g.Tangents;
        else if (conflict.kind === 'skin') delete g.SkinWeights;
        else if (conflict.kind === 'extents') {
          const count = Math.max(...group.indices.map(other => model.Geosets[other].Anims?.length || 0));
          g.Anims ||= [];
          while (g.Anims.length < count) g.Anims.push({ BoundsRadius: 0, MinimumExtent: new Float32Array(3).fill(3.40282e38), MaximumExtent: new Float32Array(3).fill(-3.40282e38) });
        }
      }
    }
  }
}

function selectedComponents(g, indices, nuclear) {
  const count = g.Vertices.length / 3;
  if (!Number.isInteger(count) || !count || g.Faces.length % 3) throw new Error('A geoset has invalid vertices or triangles.');
  const selected = new Set(indices);
  if ([...selected].some(index => !Number.isInteger(index) || index < 0 || index >= count)) throw new Error('Vertex selection is out of range.');
  const faces = [], usedByFaces = new Set();
  for (let i = 0; i < g.Faces.length; i += 3) {
    const face = Array.from(g.Faces.subarray(i, i + 3));
    if (face.some(index => index >= count)) throw new Error('A geoset has a triangle with a missing vertex.');
    for (const index of face) usedByFaces.add(index);
    faces.push(face);
  }
  const parent = faces.map((_, index) => index);
  const root = index => { while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; } return index; };
  const join = (a, b) => { a = root(a); b = root(b); if (a !== b) parent[b] = a; };
  const vertexOwner = new Map(), edgeOwner = new Map();
  const point = index => Array.from(g.Vertices.subarray(index * 3, index * 3 + 3), value => Math.round(value * 1000)).join(',');
  for (const [faceIndex, face] of faces.entries()) {
    for (const vertex of face) {
      if (vertexOwner.has(vertex)) join(faceIndex, vertexOwner.get(vertex));
      else vertexOwner.set(vertex, faceIndex);
    }
    if (nuclear) continue;
    for (let side = 0; side < 3; side++) {
      const a = point(face[side]), b = point(face[(side + 1) % 3]);
      const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (edgeOwner.has(edge)) join(faceIndex, edgeOwner.get(edge));
      else edgeOwner.set(edge, faceIndex);
    }
  }
  const parts = new Map();
  for (const [faceIndex, face] of faces.entries()) {
    const id = root(faceIndex);
    if (!parts.has(id)) parts.set(id, { vertices: new Set(), faces: [], faceIndices: [] });
    const part = parts.get(id);
    for (const vertex of face) part.vertices.add(vertex);
    part.faces.push(...face);
    part.faceIndices.push(faceIndex);
  }
  for (let vertex = 0; vertex < count; vertex++) if (!usedByFaces.has(vertex)) parts.set(`loose:${vertex}`, { vertices: new Set([vertex]), faces: [], faceIndices: [] });
  const chosen = [], retained = [];
  for (const part of parts.values()) {
    const vertices = [...part.vertices].sort((a, b) => a - b);
    const entry = { vertices, faces: part.faces, faceIndices: part.faceIndices };
    (vertices.filter(vertex => selected.has(vertex)).length * 2 >= vertices.length ? chosen : retained).push(entry);
  }
  const orderedParts = chosen.sort((a, b) => a.vertices[0] - b.vertices[0]);
  return {
    parts: nuclear ? orderedParts : groupSmallDetails(orderedParts),
    retained: {
      vertices: retained.flatMap(part => part.vertices).sort((a, b) => a - b),
      faces: retained.flatMap(part => part.faceIndices).sort((a, b) => a - b).flatMap(index => faces[index]),
    },
  };
}

function groupSmallDetails(parts) {
  if (parts.length < 3) return parts;
  const largest = Math.max(...parts.map(part => part.faces.length / 3));
  const threshold = Math.max(12, Math.ceil(largest / 10));
  const substantial = [], details = [];
  for (const part of parts) (part.faces.length / 3 < threshold ? details : substantial).push(part);
  if (details.length < 2) return parts;
  const combined = {
    vertices: [...new Set(details.flatMap(part => part.vertices))].sort((a, b) => a - b),
    faces: details.flatMap(part => part.faces),
  };
  return [...substantial, combined].sort((a, b) => a.vertices[0] - b.vertices[0]);
}

function piece(g, component) {
  const remap = new Map(component.vertices.map((old, index) => [old, index]));
  const result = structuredClone(g);
  Object.assign(result, gather(g, component.vertices));
  result.Faces = new g.Faces.constructor(component.faces.map(index => remap.get(index)));
  result.PrimitiveTypes = result.Faces.length ? Uint32Array.of(4) : new Uint32Array();
  result.PrimitiveCounts = result.Faces.length ? Uint32Array.of(result.Faces.length) : new Uint32Array();
  updateBounds(result);
  return result;
}

function separateSelectedGeosets(model, selectionByGeoset, nuclear) {
  const originalCount = model.Geosets.length, additions = [];
  const anims = animationIndices(model), newAnimations = [], newGliders = [], selection = {}, touched = [];
  for (let index = 0; index < originalCount; index++) {
    const selected = selectionByGeoset?.[index];
    if (!selected?.length) continue;
    const g = model.Geosets[index], { parts, retained } = selectedComponents(g, selected, nuclear);
    if (!parts.length || parts.length === 1 && !retained.vertices.length) continue;
    touched.push(index);
    const keepRemainder = retained.vertices.length > 0;
    model.Geosets[index] = piece(g, keepRemainder ? retained : parts[0]);
    if (!keepRemainder) selection[index] = Array.from({ length: parts[0].vertices.length }, (_, vertex) => vertex);
    for (const part of keepRemainder ? parts : parts.slice(1)) {
      const newIndex = originalCount + additions.length;
      additions.push(piece(g, part));
      selection[newIndex] = Array.from({ length: part.vertices.length }, (_, vertex) => vertex);
      for (const animIndex of anims[index]) newAnimations.push({ ...structuredClone(model.GeosetAnims[animIndex]), GeosetId: newIndex });
      for (const glider of model.Gliders || []) if (glider.GeosetId === index) newGliders.push({ ...structuredClone(glider), GeosetId: newIndex });
    }
  }
  if (!additions.length) return false;
  model.Geosets.push(...additions);
  (model.GeosetAnims ||= []).push(...newAnimations);
  if (newGliders.length) (model.Gliders ||= []).push(...newGliders);
  model.Info.NumGeosets = model.Geosets.length;
  model.Info.NumGeosetAnims = model.GeosetAnims.length;
  return { parts: additions.length, geosetIndices: Object.keys(selection).map(Number), selection, touched };
}

/** Join selected triangles across matching geometric edges, including unwelded seams. */
export function separateGeosetsByLoosePart(model, selectionByGeoset) {
  return separateSelectedGeosets(model, selectionByGeoset, false);
}

/** Preserve the former shared-vertex-index split for explicitly selected geometry. */
export function nuclearSeparateGeosets(model, selectionByGeoset) {
  return separateSelectedGeosets(model, selectionByGeoset, true);
}

/** Delete vertices that are not referenced by any triangle in the checked geosets. */
export function deleteFreeVertices(model, geosetIndices) {
  const geosets = model.Geosets || [];
  const selected = [...new Set(geosetIndices || [])].sort((a, b) => a - b);
  if (!selected.length) return false;
  const plans = [];
  for (const index of selected) {
    if (!Number.isInteger(index) || !geosets[index]) throw new Error('Selected geoset is out of range.');
    const geoset = geosets[index], count = geoset.Vertices?.length / 3;
    if (!Number.isInteger(count) || !ArrayBuffer.isView(geoset.Faces) || geoset.Faces.length % 3) throw new Error('A selected geoset has invalid vertices or triangles.');
    const used = new Set();
    for (const vertex of geoset.Faces) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= count) throw new Error('A selected geoset has a triangle with a missing vertex.');
      used.add(vertex);
    }
    const kept = [], removed = [];
    for (let vertex = 0; vertex < count; vertex++) (used.has(vertex) ? kept : removed).push(vertex);
    if (removed.length) plans.push({ index, kept, removed });
  }
  if (!plans.length) return false;

  const removedGeosets = [], vertexMaps = {};
  for (const plan of plans) {
    if (!plan.kept.length) { removedGeosets.push(plan.index); continue; }
    const geoset = geosets[plan.index], remap = new Map(plan.kept.map((old, next) => [old, next]));
    vertexMaps[plan.index] = Object.fromEntries(remap);
    Object.assign(geoset, gather(geoset, plan.kept));
    geoset.Faces = new geoset.Faces.constructor(Array.from(geoset.Faces, vertex => remap.get(vertex)));
    updateBounds(geoset);
  }
  for (const index of [...removedGeosets].sort((a, b) => b - a)) deleteGeoset(model, index);

  const removed = new Set(removedGeosets), oldToNew = {};
  for (let index = 0, next = 0; index < geosets.length + removed.size; index++) if (!removed.has(index)) oldToNew[index] = next++;
  return {
    removedVertices: plans.reduce((sum, plan) => sum + plan.removed.length, 0),
    touched: plans.map(plan => plan.index),
    removedGeosets,
    oldToNew,
    vertexMaps,
  };
}

function unionAnimatedExtents(target, source) {
  for (let index = 0; index < (target.Anims?.length || 0); index++) {
    const a = target.Anims[index], b = source.Anims[index];
    // Native models use inverted FLT_MAX bounds for an empty animation extent
    // (for example Footman's Decay Bone). It contributes no box to the union.
    if (b.MinimumExtent.some((value, axis) => value > b.MaximumExtent[axis])) continue;
    if (a.MinimumExtent.some((value, axis) => value > a.MaximumExtent[axis])) {
      target.Anims[index] = structuredClone(b);
      continue;
    }
    for (let axis = 0; axis < 3; axis++) {
      a.MinimumExtent[axis] = Math.min(a.MinimumExtent[axis], b.MinimumExtent[axis]);
      a.MaximumExtent[axis] = Math.max(a.MaximumExtent[axis], b.MaximumExtent[axis]);
    }
    a.BoundsRadius = Math.max(a.BoundsRadius ?? 0, b.BoundsRadius ?? 0, Math.hypot(...Array.from(a.MaximumExtent, (value, axis) => value - a.MinimumExtent[axis])) / 2);
  }
}

function canAppend(target, source) {
  if (target.Vertices.length / 3 + source.Vertices.length / 3 > 65536) return false;
  const groups = target.Groups.map(group => keyOf(group));
  for (const groupId of new Set(source.VertexGroup)) {
    const group = source.Groups[groupId];
    if (!group) return false;
    const key = keyOf(group);
    if (!groups.includes(key)) groups.push(key);
  }
  return groups.length <= 256;
}

/** Merge compatible geosets, optionally applying the user's reviewed conflict choices. */
export function mergeSimilarGeosets(model, selectionByGeoset, resolutions) {
  if (resolutions) {
    const review = geosetMergeConflicts(model, selectionByGeoset);
    const working = { ...model, Geosets: structuredClone(model.Geosets), GeosetAnims: structuredClone(model.GeosetAnims || []), Bones: structuredClone(model.Bones || []), Gliders: structuredClone(model.Gliders || []), Info: structuredClone(model.Info) };
    resolveMergeConflicts(working, review, resolutions);
    const result = mergeSimilarGeosets(working, selectionByGeoset);
    if (result === false) return false;
    for (const field of ['Geosets', 'GeosetAnims', 'Bones', 'Info']) model[field] = working[field];
    if (model.Gliders) model.Gliders = working.Gliders;
    return result;
  }
  const original = model.Geosets, animations = animationIndices(model);
  const byKey = new Map(), leaders = original.map((_, index) => index), targets = new Set(), vertexOffsets = original.map(() => 0);
  for (let index = 0; index < original.length; index++) {
    if (!selectionByGeoset?.[index]?.length) continue;
    const key = appearanceKey(model, index, animations);
    if (key == null) continue;
    const candidates = byKey.get(key) || [];
    const leader = candidates.find(other => canAppend(original[other], original[index]));
    if (leader === undefined) { candidates.push(index); byKey.set(key, candidates); continue; }
    vertexOffsets[index] = original[leader].Vertices.length / 3;
    appendGeosetGeometry(original[leader], original[index]);
    unionAnimatedExtents(original[leader], original[index]);
    original[leader].PrimitiveTypes = Uint32Array.of(4);
    original[leader].PrimitiveCounts = Uint32Array.of(original[leader].Faces.length);
    leaders[index] = leader;
    targets.add(leader);
  }
  if (!targets.size) return false;
  const oldToNew = new Map(), kept = [];
  for (let index = 0; index < original.length; index++) if (leaders[index] === index) { oldToNew.set(index, kept.length); kept.push(original[index]); }
  for (let index = 0; index < original.length; index++) oldToNew.set(index, oldToNew.get(leaders[index]));
  const oldAnimToNew = new Map(), keptAnimations = [];
  (model.GeosetAnims || []).forEach((anim, index) => {
    if (leaders[anim.GeosetId] !== anim.GeosetId) return;
    oldAnimToNew.set(index, keptAnimations.length);
    anim.GeosetId = oldToNew.get(anim.GeosetId);
    keptAnimations.push(anim);
  });
  for (let index = 0; index < original.length; index++) if (leaders[index] !== index) animations[index].forEach((oldAnim, position) => oldAnimToNew.set(oldAnim, oldAnimToNew.get(animations[leaders[index]][position])));
  model.Geosets = kept;
  model.GeosetAnims = keptAnimations;
  for (const bone of model.Bones || []) {
    if (oldToNew.has(bone.GeosetId)) bone.GeosetId = oldToNew.get(bone.GeosetId);
    if (oldAnimToNew.has(bone.GeosetAnimId)) bone.GeosetAnimId = oldAnimToNew.get(bone.GeosetAnimId);
  }
  for (const glider of model.Gliders || []) if (oldToNew.has(glider.GeosetId)) glider.GeosetId = oldToNew.get(glider.GeosetId);
  model.Info.NumGeosets = kept.length;
  model.Info.NumGeosetAnims = keptAnimations.length;
  return { merged: original.length - kept.length, geosetIndices: [...targets].map(index => oldToNew.get(index)), oldToNew: Object.fromEntries(oldToNew), vertexOffsets };
}
