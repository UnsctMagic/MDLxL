import { ensureDummyBone } from './dummy-bone.js';
import { deleteGeoset, importGeosets, openDocument, recalculateExtents } from './editor-document.js';
import { deleteVertices, setVertexPositions, transformVertices } from './editor-commands.js';
import { selectedVertexCenter } from './bone-tools.js';
import { captureMeshSelection } from './mesh-clipboard.js';
import { createSequence, setSequenceName } from './sequence-editor.js';
import { sampleGeosetAnimation, sampleTrack } from './animation.js';

const TEXTURE_SLOTS = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
export const partPathKey = value => String(value || '').replaceAll('/', '\\').toLowerCase();
const canonical = value => Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value, canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => JSON.stringify(canonical(value));
export const partTextureKey = texture => fingerprint({ ...texture, Image: partPathKey(texture.Image), ReplaceableId: texture.ReplaceableId || 0, Flags: texture.Flags || 0 });

function partMaterialKey(model, source) {
  const material = structuredClone(source);
  const texture = id => id == null || id === -1 ? id : partTextureKey(model.Textures[id]);
  for (const layer of material.Layers || []) {
    for (const slot of TEXTURE_SLOTS) {
      if (typeof layer[slot] === 'number') layer[slot] = texture(layer[slot]);
      else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) key[field] = Array.from(key[field], texture);
      if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = texture(layer._MdxDefaults[slot]);
    }
    if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1) layer.TVertexAnimId = structuredClone(model.TextureAnims[layer.TVertexAnimId]);
  }
  const globals = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (Number.isInteger(value.GlobalSeqId) && value.GlobalSeqId >= 0) value.GlobalSeqId = model.GlobalSequences[value.GlobalSeqId];
    for (const child of Object.values(value)) globals(child);
  };
  globals(material);
  return fingerprint(material);
}

/** Capture only selected vertices, including loose points, across every donor
 * geoset. Reuse the clipboard's attribute slicing and rigid dependency import. */
export function collectPart(source, selection) {
  if (!Object.values(selection || {}).some(ids => ids?.length)) throw Error('Select vertices in the vertex editor before collecting a Bit.');
  const captured = captureMeshSelection(source, selection);
  if (!captured.vertexCount) throw Error('Select vertices in the vertex editor before collecting a Bit.');
  const model = openDocument(`Version { FormatVersion ${source.Version}, }\nModel "Collected Bit" { BlendTime 150, }`, 'Collected Bit.mdl').model;
  model.Sequences = structuredClone(source.Sequences || []);
  const bone = ensureDummyBone(model, { weighted: captured.indices.some(index => captured.model.Geosets[index].SkinWeights?.length) });
  importGeosets(model, captured.model, captured.indices, null, { rigidNode: bone.ObjectId });
  for (const geoset of model.Geosets) geoset.Anims = model.Sequences.map(() => ({ MinimumExtent: geoset.MinimumExtent.slice(), MaximumExtent: geoset.MaximumExtent.slice(), BoundsRadius: geoset.BoundsRadius }));
  return model;
}

// Only appearance dependencies are imported; source rig movement is not.
function visitPartTracks(model, visitor) {
  const seen = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value.Keys)) { visitor(value); return; }
    for (const child of Object.values(value)) visit(child);
  };
  for (const owner of ['GeosetAnims', 'Materials', 'TextureAnims']) visit(model[owner]);
}

/** null keeps the source as is; a selection keeps complete appearance tracks
 * for those sequences. Geoset IDs, static colors, defaults and globals survive. */
export function selectPartAnimations(source, animations = null) {
  const model = structuredClone(source);
  if (animations === null) return model;
  if (!Array.isArray(animations) || !animations.length) throw Error('Select one or more animations, or import as is.');
  const indices = new Set(), names = new Set();
  model.Sequences = animations.map(({ sequenceIndex }) => {
    if (!Number.isInteger(sequenceIndex) || !source.Sequences?.[sequenceIndex]) throw Error('Choose an available source animation.');
    if (indices.has(sequenceIndex)) throw Error('Select each source animation once.');
    indices.add(sequenceIndex);
    return structuredClone(source.Sequences[sequenceIndex]);
  });
  animations.forEach(({ name }, index) => {
    setSequenceName(model, index, name);
    const key = model.Sequences[index].Name.toLowerCase();
    if (names.has(key)) throw Error('Selected animation names must be unique.');
    names.add(key);
  });
  visitPartTracks(model, track => {
    if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) return;
    track.Keys = track.Keys.filter(key => model.Sequences.some(sequence => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]));
  });
  for (const geoset of model.Geosets) geoset.Anims = animations.map(({ sequenceIndex }) => structuredClone(geoset.Anims?.[sequenceIndex] || { MinimumExtent: geoset.MinimumExtent, MaximumExtent: geoset.MaximumExtent, BoundsRadius: geoset.BoundsRadius }));
  return model;
}

export function collectedPartModel(source, { name, animations = null }) {
  if (!String(name || '').trim()) throw Error('Name the Bit before saving.');
  const model = selectPartAnimations(source, animations);
  model.Info.Name = name.trim();
  return model;
}

export function serializeCollectedPart(model) {
  const document = openDocument(`Version { FormatVersion ${model.Version}, }\nModel "Collected Bit" { BlendTime 150, }`, 'Collected Bit.mdl');
  document.apply('Collect Bit', [], target => Object.assign(target, structuredClone(model)));
  return document.serialize('mdx');
}

export function partTextureIndices(model) {
  const indices = new Set();
  for (const geoset of model.Geosets || []) {
    const material = model.Materials?.[geoset.MaterialID];
    if (!material) throw Error('The part references a missing material.');
    for (const layer of material.Layers || []) for (const slot of TEXTURE_SLOTS) {
      const value = layer[slot];
      if (typeof value === 'number' && value >= 0) indices.add(value);
      else for (const key of value?.Keys || []) for (const field of ['Vector', 'InTan', 'OutTan']) for (const id of key[field] || []) if (id >= 0) indices.add(id);
      if (typeof layer._MdxDefaults?.[slot] === 'number' && layer._MdxDefaults[slot] >= 0) indices.add(layer._MdxDefaults[slot]);
    }
  }
  for (const index of indices) if (!model.Textures?.[index]) throw Error(`The part references missing texture ${index}.`);
  return [...indices];
}

/** Isolated bind-pose geometry preview. No destination role is created. */
export function previewPart(source) {
  const model = structuredClone(source);
  // The imported part keeps file-space coordinates and is rebound as one rigid
  // part. Source rig movement must not imply it will be copied into the target.
  model.Nodes = []; model.Bones = []; model.Helpers = []; model.PivotPoints = [];
  for (const key of ['Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'CollisionShapes']) model[key] = [];
  for (const geoset of model.Geosets) { geoset.Groups = [[]]; geoset.VertexGroup = new Uint8Array(geoset.Vertices.length / 3); delete geoset.SkinWeights; }
  return model;
}

/** Whole-part import. Prepare on a clone so even callers outside EditorDocument
 * get all-or-nothing data changes; the UI wraps this in one undoable edit. */
export function commitPart(target, source, { animations = null, rgbSequence = null, replacement = null } = {}) {
  if (!source?.Geosets?.length) throw Error('This model has no geosets to import.');
  if (source.Version !== target.Version) throw Error('BitsAndParts requires matching model formats. Convert a copy to the destination format first.');
  if (source.BindPoses?.length || target.BindPoses?.length) throw Error('Parts with bind-pose matrices require baking before import.');
  const next = structuredClone(target), staged = rgbSequence === null ? selectPartAnimations(source, animations) : partRgbSnapshot(source, rgbSequence);
  const donors = replacement ? replacementVertices(target, replacement) : null;
  const replacedMaterials = new Set(donors?.map(vertex => vertex.materialId));
  if (replacement) removePartSelection(next, replacement);
  for (const key of ['Textures', 'Materials', 'TextureAnims', 'GlobalSequences', 'Geosets', 'GeosetAnims']) next[key] ||= [];
  const maps = { textures: new Map(), materials: new Map(), textureAnims: new Map(), globals: new Map() };
  const reuse = (collection, item) => { const key = fingerprint(item), index = collection.findIndex(existing => fingerprint(existing) === key); return index < 0 ? collection.push(item) - 1 : index; };
  const remapGlobals = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (Number.isInteger(value.GlobalSeqId) && value.GlobalSeqId >= 0) {
      const id = value.GlobalSeqId, duration = staged.GlobalSequences?.[id];
      if (!Number.isFinite(duration) || duration <= 0) throw Error('The part references a missing global sequence.');
      if (!maps.globals.has(id)) maps.globals.set(id, reuse(next.GlobalSequences, duration));
      value.GlobalSeqId = maps.globals.get(id);
    }
    for (const child of Object.values(value)) remapGlobals(child);
  };
  const textureRef = id => {
    if (id == null || id === -1) return id;
    if (!staged.Textures?.[id]) throw Error(`The part references missing texture ${id}.`);
    if (!maps.textures.has(id)) {
      const texture = { ...staged.Textures[id] };
      const index = next.Textures.findIndex(existing => partTextureKey(existing) === partTextureKey(texture));
      maps.textures.set(id, index < 0 ? next.Textures.push(texture) - 1 : index);
    }
    return maps.textures.get(id);
  };
  const materialRef = id => {
    if (!staged.Materials?.[id]) throw Error(`The part references missing material ${id}.`);
    if (maps.materials.has(id)) return maps.materials.get(id);
    const material = structuredClone(staged.Materials[id]);
    for (const layer of material.Layers || []) {
      for (const slot of TEXTURE_SLOTS) {
        if (typeof layer[slot] === 'number') layer[slot] = textureRef(layer[slot]);
        else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) key[field] = new Int32Array(Array.from(key[field], textureRef));
        if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = textureRef(layer._MdxDefaults[slot]);
      }
      const animationId = layer.TVertexAnimId;
      if (animationId != null && animationId !== -1) {
        if (!staged.TextureAnims?.[animationId]) throw Error('The part references a missing texture animation.');
        if (!maps.textureAnims.has(animationId)) { const animation = structuredClone(staged.TextureAnims[animationId]); remapGlobals(animation); maps.textureAnims.set(animationId, reuse(next.TextureAnims, animation)); }
        layer.TVertexAnimId = maps.textureAnims.get(animationId);
      }
    }
    remapGlobals(material);
    const key = partMaterialKey(next, material), index = next.Materials.findIndex(existing => partMaterialKey(next, existing) === key);
    maps.materials.set(id, index < 0 ? next.Materials.push(material) - 1 : index); return maps.materials.get(id);
  };
  // Keep relative source timing, including keys outside sequence intervals.
  // Allocate through the sequence editor and shift only local appearance keys.
  const sequenceIndices = [];
  let sourceStart = Math.min(...staged.Sequences.map(sequence => sequence.Interval[0])), offset = 0;
  visitPartTracks(staged, track => {
    if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) return;
    for (const key of track.Keys) sourceStart = Math.min(sourceStart, key.Frame);
  });
  for (const sequence of staged.Sequences) {
    const index = createSequence(next, sequence.Interval[1] - sequence.Interval[0]);
    if (!sequenceIndices.length) offset = next.Sequences[index].Interval[0] - sourceStart;
    const interval = new Uint32Array(Array.from(sequence.Interval, frame => frame + offset));
    if (sequence.Interval[1] + offset > 0x7fffffff) throw Error('There is not enough frame space to import these animations.');
    next.Sequences[index] = { ...structuredClone(sequence), Interval: interval };
    sequenceIndices.push(index);
  }
  if (sequenceIndices.length) visitPartTracks(staged, track => {
    if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) return;
    for (const key of track.Keys) {
      if (key.Frame + offset > 0x7fffffff) throw Error('There is not enough frame space to import these animation keys.');
      key.Frame += offset;
    }
  });
  for (const geoset of staged.Geosets) {
    if (!geoset.Vertices?.length || geoset.Vertices.length % 3 || !geoset.Faces || geoset.Faces.length % 3 || Array.from(geoset.Faces).some(index => index < 0 || index >= geoset.Vertices.length / 3)) throw Error('The part contains invalid geometry.');
    geoset.MaterialID = materialRef(geoset.MaterialID);
  }
  const bone = replacement ? null : ensureDummyBone(next, { weighted: staged.Geosets.some(geoset => geoset.SkinWeights?.length) });
  const start = next.Geosets.length, geosetIndices = [];
  for (const geoset of staged.Geosets) {
    const count = geoset.Vertices.length / 3;
    if (replacement) inheritPartBindings(geoset, donors, next.Version);
    else {
      geoset.Groups = [[bone.ObjectId]]; geoset.TotalGroupsCount = 1; geoset.VertexGroup = new Uint8Array(count);
      if (geoset.SkinWeights?.length) { geoset.SkinWeights = new (next.Version >= 1400 ? Uint16Array : Uint8Array)(count * 8); for (let index = 0; index < count; index++) geoset.SkinWeights.set([bone.ObjectId, 0, 0, 0, 255, 0, 0, 0], index * 8); }
    }
    geosetIndices.push(next.Geosets.push(geoset) - 1);
  }
  for (const animation of staged.GeosetAnims || []) if (Number.isInteger(animation.GeosetId) && staged.Geosets[animation.GeosetId]) { animation.GeosetId += start; remapGlobals(animation); next.GeosetAnims.push(animation); }
  // Remove only materials made unused by this replacement. Keep shared and
  // imported matches, including ribbon dependencies, and remap surviving IDs.
  for (const id of [...replacedMaterials].sort((a, b) => b - a)) {
    const owners = [...next.Geosets, ...(next.RibbonEmitters || [])];
    if (owners.some(owner => owner.MaterialID === id)) continue;
    next.Materials.splice(id, 1);
    for (const owner of owners) if (owner.MaterialID > id) owner.MaterialID--;
    for (const [sourceId, targetId] of maps.materials) if (targetId > id) maps.materials.set(sourceId, targetId - 1);
  }
  recalculateExtents(next);
  for (const index of geosetIndices) { const geoset = next.Geosets[index]; geoset.Anims = (next.Sequences || []).map(() => ({ MinimumExtent: geoset.MinimumExtent.slice(), MaximumExtent: geoset.MaximumExtent.slice(), BoundsRadius: geoset.BoundsRadius })); }
  if (next.Info) Object.assign(next.Info, { NumGeosets: next.Geosets.length, NumGeosetAnims: next.GeosetAnims.length, NumBones: next.Bones.length });
  Object.assign(target, next);
  const boneIds = replacement ? [...new Set(donors.flatMap(vertex => vertex.group))] : [bone.ObjectId];
  return { geosetIndices, sequenceIndices, boneId: boneIds[0], boneIds, materialMap: Object.fromEntries(maps.materials), textureMap: Object.fromEntries(maps.textures) };
}

function replacementVertices(model, selection) {
  const vertices = [];
  for (const [key, ids] of Object.entries(selection || {})) {
    if (!ids?.length) continue;
    const geoset = model.Geosets?.[Number(key)];
    if (!geoset || ids.some(id => !Number.isInteger(id) || id < 0 || id >= geoset.Vertices.length / 3)) throw Error('Select valid vertices to replace.');
    for (const id of new Set(ids)) {
      const skin = geoset.SkinWeights?.length ? Array.from(geoset.SkinWeights.subarray(id * 8, id * 8 + 8)) : null;
      const group = skin ? skin.slice(0, 4).filter((_, slot) => skin[slot + 4] > 0) : geoset.Groups[geoset.VertexGroup[id]];
      if (!group || group.some(boneId => !model.Nodes?.[boneId])) throw Error('The selected part references a missing bone.');
      vertices.push({ position: Array.from(geoset.Vertices.subarray(id * 3, id * 3 + 3)), group: [...group], skin, materialId: geoset.MaterialID });
    }
  }
  if (!vertices.length) throw Error('Select vertices in the vertex editor before replacing a part.');
  return vertices;
}

function removePartSelection(model, selection) {
  for (const [key, ids] of Object.entries(selection).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    if (!ids?.length) continue;
    const index = Number(key), geoset = model.Geosets[index];
    deleteVertices(geoset, ids);
    if (!geoset.Vertices.length) deleteGeoset(model, index);
    else {
      geoset.PrimitiveTypes = geoset.Faces.length ? Uint32Array.of(4) : new Uint32Array();
      geoset.PrimitiveCounts = geoset.Faces.length ? Uint32Array.of(geoset.Faces.length) : new Uint32Array();
    }
  }
}

function inheritPartBindings(geoset, donors, version) {
  const count = geoset.Vertices.length / 3, weighted = donors.some(vertex => vertex.skin);
  geoset.Groups = []; geoset.VertexGroup = new Uint8Array(count);
  if (weighted) geoset.SkinWeights = new (version >= 1400 ? Uint16Array : Uint8Array)(count * 8);
  else delete geoset.SkinWeights;
  for (let id = 0; id < count; id++) {
    let nearest = donors[0], distance = Infinity;
    for (const donor of donors) {
      const squared = donor.position.reduce((sum, value, axis) => sum + (value - geoset.Vertices[id * 3 + axis]) ** 2, 0);
      if (squared < distance) { distance = squared; nearest = donor; }
    }
    let group = geoset.Groups.findIndex(existing => fingerprint(existing) === fingerprint(nearest.group));
    if (group < 0) {
      if (geoset.Groups.length >= 256) throw Error('The replacement exceeds the 256 vertex group limit.');
      group = geoset.Groups.push([...nearest.group]) - 1;
    }
    geoset.VertexGroup[id] = group;
    if (weighted) {
      if (nearest.skin) geoset.SkinWeights.set(nearest.skin, id * 8);
      else {
        if (!nearest.group.length || nearest.group.length > 4 || nearest.group.some(boneId => boneId > (version >= 1400 ? 65535 : 255))) throw Error('The selected binding cannot fit the replacement skin format.');
        nearest.group.forEach((boneId, slot) => { geoset.SkinWeights[id * 8 + slot] = boneId; geoset.SkinWeights[id * 8 + 4 + slot] = Math.floor(255 / nearest.group.length) + (slot < 255 % nearest.group.length ? 1 : 0); });
      }
    }
  }
  geoset.TotalGroupsCount = geoset.Groups.reduce((sum, group) => sum + group.length, 0);
}

export function transformPart(source, payload) {
  const model = structuredClone(source);
  const selection = Object.fromEntries(model.Geosets.map((geoset, index) => [index, Array.from({ length: geoset.Vertices.length / 3 }, (_, id) => id)]));
  const pivot = payload.pivot || selectedVertexCenter(model, selection);
  for (const [index, ids] of Object.entries(selection)) {
    if (payload.modelPositions?.[index]) setVertexPositions(model.Geosets[index], ids, payload.modelPositions[index]);
    else transformVertices(model.Geosets[index], ids, payload.translation || [0, 0, 0], payload.scale || [1, 1, 1], payload.rotation || [0, 0, 0], pivot);
  }
  recalculateExtents(model);
  return model;
}

export function positionPart(source, target, selection) {
  replacementVertices(target, selection);
  const sourceSelection = Object.fromEntries(source.Geosets.map((geoset, index) => [index, Array.from({ length: geoset.Vertices.length / 3 }, (_, id) => id)]));
  const origin = selectedVertexCenter(source, sourceSelection), center = selectedVertexCenter(target, selection);
  return transformPart(source, { translation: center.map((value, axis) => value - origin[axis]) });
}

/** Palette animations stay in the saved Bit. An import takes the displayed
 * appearance at the selected animation's start, in normalized editor RGB. */
export function partRgbSnapshot(source, sequenceIndex = -1) {
  const sequence = source.Sequences?.[sequenceIndex];
  if (sequenceIndex !== -1 && (!Number.isInteger(sequenceIndex) || !sequence)) throw Error('Choose an available RGB animation.');
  const model = structuredClone(source), frame = sequence?.Interval[0] || 0;
  for (const animation of model.GeosetAnims || []) {
    const sampled = sampleGeosetAnimation(source, animation.GeosetId, frame, sequenceIndex);
    animation.Color = new Float32Array(sampled.color); animation.Alpha = sampled.alpha;
    if (animation._MdxDefaults) {
      delete animation._MdxDefaults.Color; delete animation._MdxDefaults.Alpha;
      if (!Object.keys(animation._MdxDefaults).length) delete animation._MdxDefaults;
    }
  }
  const freeze = owner => {
    if (!owner || typeof owner !== 'object' || ArrayBuffer.isView(owner)) return;
    for (const [field, value] of Object.entries(owner)) {
      if (value?.Keys) {
        const width = value.Keys[0]?.Vector?.length || 1;
        const fallback = owner._MdxDefaults?.[field] ?? (width === 1 ? field === 'Alpha' ? 1 : 0 : Array.from({ length: width }, (_, axis) => field === 'Scaling' || field === 'Color' || field === 'Rotation' && axis === 3 ? 1 : 0));
        owner[field] = sampleTrack(value, frame, { interval: sequence?.Interval, globalSequences: source.GlobalSequences, fallback, quaternion: field === 'Rotation' });
        if (TEXTURE_SLOTS.includes(field)) owner[field] = Math.round(owner[field]);
        if (owner._MdxDefaults) {
          delete owner._MdxDefaults[field];
          if (!Object.keys(owner._MdxDefaults).length) delete owner._MdxDefaults;
        }
      } else freeze(value);
    }
  };
  freeze(model.Materials); freeze(model.TextureAnims);
  model.Sequences = [];
  for (const geoset of model.Geosets) geoset.Anims = [];
  return model;
}

export function previewPartReplacement(target, source, selection, rgbSequence = null) {
  const model = structuredClone(target);
  if (!source) {
    replacementVertices(target, selection); removePartSelection(model, selection); recalculateExtents(model);
    return { model, geosetIndices: [] };
  }
  const result = commitPart(model, source, { replacement: selection, rgbSequence });
  return { model, geosetIndices: result.geosetIndices };
}
