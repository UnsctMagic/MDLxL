import { sampleTrack } from './animation.js';
import { appendGeosetGeometry } from './editor-document.js';
import { unionAnimatedExtents } from './geoset-operations.js';
import { setAnimationSequences } from './animation-tracks.js';
import { createVisibilityGeosetAnimation } from './geoset-animation-defaults.js';
import { visitTextureReferences } from './texture-references.js';
import { tintTexturePath } from './material-presets.js';
import { TEAM_COLORS } from './team-colors.js';
import { displayNumber } from './display-number.js';

// Sort My Mess: list what exists, show what differs, and apply only the
// choices the user made. Geoset ids are the current model's indices (the UI
// shows them 1-based); apply returns the old -> new geoset mapping. Results
// are structured so the dialog can translate every label and value.

const clone = value => structuredClone(value);
const slots = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
export const FILTER_NAMES = ['Opaque', 'Transparent', 'Blend', 'Additive', 'Add Alpha', 'Modulate', 'Modulate 2X'];
const SHADING = [[1, 'unshaded'], [2, 'sphere map'], [16, 'two-sided'], [32, 'unfogged'], [64, 'no depth test'], [128, 'no depth write']];
const TWO_SIDED = 16;
const fixedTints = new Set(TEAM_COLORS.filter(color => color.index !== null).map(color => tintTexturePath(color.index).toLowerCase()));
const n = displayNumber;

function canonical(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
const keyOf = value => JSON.stringify(canonical(value));
const isTrack = value => Array.isArray(value?.Keys);
const isGlobal = track => isTrack(track) && Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0;
const animsFor = (model, id) => (model.GeosetAnims || []).filter(anim => anim.GeosetId === id);
const rgb255 = color => Array.from(color || [1, 1, 1], value => Math.round(Math.max(0, Math.min(1, value)) * 255)).join(',');
const round = value => Math.round(value * 1000) / 1000;
function clusterBy(ids, keyFor) {
  const groups = new Map();
  for (const id of ids) { const key = keyFor(id); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(id); }
  return [...groups.entries()].map(([key, members]) => ({ key, ids: members }));
}

function textureIdentity(texture, id) {
  if (!texture) return { key: `missing:${id}`, name: `Missing texture ${n(id)}`, decoration: false };
  if (texture.ReplaceableId === 1) return { key: 'team', name: 'Team color', decoration: true };
  if (texture.ReplaceableId === 2) return { key: 'glow', name: 'Team glow', decoration: false };
  if (texture.ReplaceableId) return { key: `replaceable:${texture.ReplaceableId}`, name: `Replaceable ${texture.ReplaceableId}`, decoration: false };
  const path = String(texture.Image || '').replaceAll('/', '\\');
  if (!path) return { key: 'none', name: 'No texture path', decoration: false };
  if (fixedTints.has(path.toLowerCase())) return { key: 'tint', name: 'Color tint', decoration: true };
  return { key: 'image:' + path.toLowerCase(), name: path.split('\\').at(-1).replace(/\.[a-z0-9]+$/i, ''), path, decoration: false };
}
function layerTextureIds(layer) {
  const ids = new Set(), value = layer?.TextureID;
  if (typeof value === 'number') ids.add(value);
  else if (isTrack(value)) {
    for (const key of value.Keys) for (const id of key.Vector || []) ids.add(id);
    if (typeof layer._MdxDefaults?.TextureID === 'number') ids.add(layer._MdxDefaults.TextureID);
  }
  return [...ids];
}
/** Textures that name a material; team colour and fixed tints only decorate it. */
function materialTextures(model, materialId) {
  const all = new Map();
  for (const layer of model.Materials?.[materialId]?.Layers || []) for (const id of layerTextureIds(layer)) {
    const identity = textureIdentity(model.Textures?.[id], id);
    if (!all.has(identity.key)) all.set(identity.key, { ...identity, ids: new Set() });
    all.get(identity.key).ids.add(id);
  }
  const main = [...all.values()].filter(texture => !texture.decoration);
  return (main.length ? main : [...all.values()]).sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

function resolvedMaterialKey(model, materialId) {
  const material = model.Materials?.[materialId];
  if (!material) return 'missing';
  const copy = clone(material), texture = id => model.Textures?.[id] ? { texture: canonical(model.Textures[id]) } : { missing: id };
  for (const layer of copy.Layers || []) {
    for (const slot of slots) {
      if (typeof layer[slot] === 'number') layer[slot] = texture(layer[slot]);
      else if (isTrack(layer[slot])) for (const key of layer[slot].Keys) for (const part of ['Vector', 'InTan', 'OutTan']) if (key[part]) key[part] = Array.from(key[part], texture);
      if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = texture(layer._MdxDefaults[slot]);
    }
    if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1) layer.TVertexAnimId = { animation: canonical(model.TextureAnims?.[layer.TVertexAnimId]) };
  }
  return keyOf(copy);
}
function layerFacts(model, layer) {
  const ids = layerTextureIds(layer), textures = ids.map(id => textureIdentity(model.Textures?.[id], id)), shading = layer.Shading || 0;
  return {
    texture: [...new Set(textures.map(texture => texture.name))].join(' / ') || 'No texture', textureIds: ids,
    team: textures.some(texture => texture.key === 'team'), filter: layer.FilterMode ?? 0,
    alpha: isTrack(layer.Alpha) ? 'animated' : round(layer.Alpha ?? 1), flags: SHADING.filter(([bit]) => shading & bit).map(([, name]) => name),
    twoSided: !!(shading & TWO_SIDED), animatedTexture: isTrack(layer.TextureID), textureAnimation: layer.TVertexAnimId != null && layer.TVertexAnimId !== -1,
  };
}
const layerName = layer => layer.team ? 'Team color' : FILTER_NAMES[layer.filter] || `Filter ${layer.filter}`;
/** A material in plain terms; `label` reads like "Team color + Blend, two-sided". */
export function materialFacts(model, materialId) {
  const material = model.Materials?.[materialId];
  if (!material) return { id: materialId, layers: [], names: ['Missing material'], sides: null, alpha: null, label: 'Missing material', key: 'missing', opaque: false, twoSided: false };
  const layers = (material.Layers || []).map(layer => layerFacts(model, layer));
  const twoSidedLayers = layers.filter(layer => layer.twoSided).length;
  const sides = !twoSidedLayers ? null : twoSidedLayers === layers.length ? 'two-sided' : 'partly two-sided';
  const alphaLayer = layers.find(layer => layer.alpha !== 1), alpha = !alphaLayer ? null : alphaLayer.alpha === 'animated' ? 'animated alpha' : `alpha ${Math.round(alphaLayer.alpha * 100)}%`;
  const names = layers.length ? layers.map(layerName) : ['No layers'];
  return { id: materialId, layers, names, sides, alpha, priority: material.PriorityPlane || 0, label: [names.join(' + '), sides, alpha].filter(Boolean).join(', '),
    key: resolvedMaterialKey(model, materialId), opaque: (layers[0]?.filter ?? 0) === 0, twoSided: !!layers.length && twoSidedLayers === layers.length };
}

/** Tint: none, a static RGB (0-255) or an animated track, plus stored defaults. */
export function rgbFacts(anim) {
  const enabled = !!(anim?.Flags & 2), stored = anim?._MdxDefaults?.Color;
  if (!enabled) {
    const dormant = anim?.Color && !isTrack(anim.Color) && rgb255(anim.Color) !== '255,255,255' ? rgb255(anim.Color) : null;
    return { enabled, key: 'white', value: 'none', text: 'none', stored: dormant && { kind: 'unused', value: dormant } };
  }
  if (isTrack(anim.Color)) {
    const values = [...new Set(anim.Color.Keys.map(key => rgb255(key.Vector)))];
    const shown = values.slice(0, 3).join(' → ') + (values.length > 3 ? ' …' : '');
    return { enabled, animated: shown, global: isGlobal(anim.Color), key: keyOf({ Color: anim.Color }), value: shown, text: `animated ${shown}`, stored: stored && { kind: 'default', value: rgb255(stored) } };
  }
  const value = rgb255(anim.Color);
  return { enabled, key: value === '255,255,255' ? 'white' : 'static:' + value, value, text: value, stored: null };
}

function alphaTrack(model, id) { return animsFor(model, id)[0]?.Alpha; }
function alphaAt(model, track, frame, interval) {
  return sampleTrack(track, frame, { interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: 1 });
}
function sequenceFrames(tracks, sequence) {
  const [start, end] = sequence.Interval, frames = new Set([start, end]);
  for (const track of tracks) if (isTrack(track) && !isGlobal(track)) {
    const keys = track.Keys.filter(key => key.Frame >= start && key.Frame <= end);
    keys.forEach((key, i) => { frames.add(key.Frame); if (track.LineType && keys[i + 1]) frames.add((key.Frame + keys[i + 1].Frame) / 2); });
  }
  return [...frames].sort((a, b) => a - b);
}
const stateName = value => value >= .999 ? 'shown' : value <= .001 ? 'hidden' : `${Math.round(value * 100)}%`;
/** Exact visibility in one animation: a first state plus timed changes. */
function describeSequence(model, track, sequence) {
  if (isGlobal(track)) return { state: 'global', first: 'global loop', steps: [] };
  const [start, end] = sequence.Interval, keys = isTrack(track) ? track.Keys.filter(key => key.Frame >= start && key.Frame <= end) : [];
  const first = stateName(round(alphaAt(model, track, start, sequence.Interval))), steps = [];
  let current = first;
  for (const key of keys) {
    const name = stateName(round(key.Vector?.[0] ?? key.Vector));
    if (name === current) continue;
    // Linear tracks fade towards a key; stepped tracks switch on it.
    steps.push({ to: name, frame: key.Frame, fade: !!track.LineType, final: key.Frame === end });
    current = name;
  }
  return { state: steps.length ? 'timed' : first === 'shown' || first === 'hidden' ? first : 'partial', first, steps };
}
/** English rendering of one animation's visibility, e.g. "shown → hidden at 98133 (final frame)". */
export function visibilityText(row) {
  return [row.first, ...row.steps.map(step => `→ ${step.to} ${step.fade ? 'by' : 'at'} ${step.frame}${step.final ? ' (final frame)' : ''}`)].join(' ');
}
/** Visibility of one geoset in every animation. */
export function visibilityFacts(model, id) {
  const track = alphaTrack(model, id);
  return (model.Sequences || []).map((sequence, index) => ({ index, name: sequence.Name || `Animation ${index + 1}`, ...describeSequence(model, track, sequence) }));
}
/** Compare behaviour, not keys: sample every track at the union of their keys. */
function visibilitySignatures(model, ids) {
  const tracks = ids.map(id => alphaTrack(model, id));
  if (!(model.Sequences || []).length) return tracks.map(track => keyOf(track ?? 1));
  const frames = model.Sequences.map(sequence => sequenceFrames(tracks, sequence));
  return tracks.map(track => model.Sequences.map((sequence, index) => sequenceSignature(model, track, sequence, frames[index])).join('|'));
}
function sequenceSignature(model, track, sequence, frames) {
  return isGlobal(track) ? 'global:' + keyOf(track) : frames.map(frame => round(alphaAt(model, track, frame, sequence.Interval))).join(',');
}
/** "all animations", "all except …" or "only …"; animations with timed changes are flagged. */
export function visibilitySummary(rows) {
  if (!rows.length) return { kind: 'none', names: [] };
  if (rows.every(row => row.state === 'global')) return { kind: 'global', names: [] };
  if (rows.every(row => row.state === 'shown')) return { kind: 'all', names: [] };
  if (rows.every(row => row.state === 'hidden')) return { kind: 'hidden', names: [] };
  const shown = rows.filter(row => row.state === 'shown'), other = rows.filter(row => row.state !== 'shown');
  const entry = row => ({ name: row.name, timed: row.state !== 'shown' && row.state !== 'hidden' });
  return shown.length >= other.length ? { kind: 'except', names: other.map(entry) } : { kind: 'only', names: rows.filter(row => row.state !== 'hidden').map(entry) };
}
export function visibilitySummaryText(summary) {
  const names = summary.names.map(item => item.name + (item.timed ? '*' : '')).join(', ');
  return { none: 'no animations', global: 'on a global loop', all: 'all animations', hidden: 'hidden in all animations', except: `all except ${names}`, only: `only ${names}` }[summary.kind];
}

function shapeKey(geoset) {
  const point = index => Array.from(geoset.Vertices.subarray(index * 3, index * 3 + 3), value => value.toFixed(2)).join(',');
  const triangles = [];
  for (let i = 0; i + 2 < geoset.Faces.length; i += 3) triangles.push([point(geoset.Faces[i]), point(geoset.Faces[i + 1]), point(geoset.Faces[i + 2])].sort().join('|'));
  return triangles.sort().join(';');
}
function bindingKey(geoset) {
  if (geoset.SkinWeights?.length) return 'skin:' + keyOf(geoset.SkinWeights);
  return Array.from(geoset.VertexGroup || [], group => keyOf(geoset.Groups?.[group] || [])).join(';');
}
const formatOf = geoset => ({ uv: geoset.TVertices?.length || 0, tangents: !!geoset.Tangents?.length, skin: !!geoset.SkinWeights?.length });
const metadataOf = geoset => ({ SelectionGroup: geoset.SelectionGroup || 0, Unselectable: !!geoset.Unselectable, LevelOfDetail: geoset.LevelOfDetail || 0 });

function memberFacts(model, id) {
  const geoset = model.Geosets[id], anims = animsFor(model, id), visibility = visibilityFacts(model, id);
  return {
    id, material: geoset.MaterialID, triangles: geoset.Faces.length / 3, vertices: geoset.Vertices.length / 3, anims: anims.length,
    rgb: rgbFacts(anims[0]), visibility, summary: visibilitySummary(visibility), materialFacts: materialFacts(model, geoset.MaterialID),
    shape: shapeKey(geoset), binding: bindingKey(geoset), format: formatOf(geoset), metadata: metadataOf(geoset), globalVisibility: isGlobal(anims[0]?.Alpha),
  };
}

function materialDifferences(model, members) {
  const facts = clusterBy(members.map(member => member.id), id => model.Geosets[id].MaterialID).map(({ ids }) => ({ ids, facts: materialFacts(model, model.Geosets[ids[0]].MaterialID) }));
  if (new Set(facts.map(entry => entry.facts.key)).size < 2) return [];
  const lines = [];
  const property = (label, value) => {
    const values = new Map();
    for (const entry of facts) { const text = value(entry.facts); if (!values.has(text)) values.set(text, []); values.get(text).push(entry); }
    if (values.size > 1) lines.push({ property: label, entries: [...values].map(([text, entries]) => ({ value: text, materials: entries.map(entry => entry.facts.id), ids: entries.flatMap(entry => entry.ids).sort((a, b) => a - b) })) });
  };
  property('Opacity', facts => FILTER_NAMES[facts.layers[0]?.filter ?? 0] || 'none');
  property('Two-sided', facts => facts.twoSided ? 'yes' : facts.layers.some(layer => layer.twoSided) ? 'partly' : 'no');
  property('Shading', facts => [...new Set(facts.layers.flatMap(layer => layer.flags).filter(flag => flag !== 'two-sided'))].join(', ') || 'normal');
  property('Team color', facts => facts.layers.some(layer => layer.team) ? 'yes' : 'no');
  property('Layers', facts => facts.layers.map(layer => `${layer.texture} ${layerName(layer)}`).join(' + '));
  if (new Set(facts.map(entry => entry.facts.layers.length)).size === 1) {
    property('Layer alpha', facts => facts.layers.map(layer => layer.alpha === 'animated' ? 'animated' : `${Math.round(layer.alpha * 100)}%`).join(' + '));
    property('Texture records', facts => facts.layers.map(layer => layer.textureIds.map(id => `T${n(id)}`).join('/')).join(' + '));
  }
  property('Draw priority', facts => String(facts.priority));
  property('Texture animation', facts => facts.layers.some(layer => layer.textureAnimation || layer.animatedTexture) ? 'yes' : 'no');
  if (!lines.length) lines.push({ property: 'Stored settings', entries: facts.map(entry => ({ value: 'differ', materials: [entry.facts.id], ids: entry.ids })) });
  return lines;
}

function proposeFor(group) {
  const actions = {}, steps = [], eligible = group.members.filter(member => member.anims <= 1);
  for (const member of group.members) actions[member.id] = 'keep';
  const look = member => keyOf([member.materialFacts.key, member.rgb.key, group.visibilityKeys.get(member.id), member.format, member.metadata]);
  for (const { ids: cluster } of clusterBy(eligible.map(member => member.id), id => look(group.members.find(member => member.id === id)))) {
    if (cluster.length < 2) continue;
    const kept = [], seen = [], merges = new Map();
    for (const id of cluster) {
      const member = group.members.find(item => item.id === id);
      const copy = seen.find(other => other.shape === member.shape && other.binding === member.binding);
      if (copy) { actions[id] = 'delete'; steps.push({ type: 'delete', id, copyOf: copy.id }); continue; }
      seen.push(member);
      const target = kept.find(other => merges.get(other.id).vertices + member.vertices <= 65536);
      if (!target) { kept.push(member); merges.set(id, { vertices: member.vertices, ids: [id] }); continue; }
      actions[id] = target.id; merges.get(target.id).vertices += member.vertices; merges.get(target.id).ids.push(id);
    }
    for (const entry of merges.values()) if (entry.ids.length > 1) steps.push({ type: 'merge', ids: entry.ids, target: entry.ids[0] });
  }
  if (group.duplicateRecords) steps.push({ type: 'share' });
  return steps.length ? { actions, results: {}, opaque: false, twoSided: false, share: group.duplicateRecords, steps } : null;
}

/** Inventory grouped by recognizable texture names, with differences and a proposal per group. */
export function sortMyMessInventory(model) {
  const byKey = new Map();
  (model.Geosets || []).forEach((geoset, id) => {
    const exists = !!model.Materials?.[geoset.MaterialID], textures = exists ? materialTextures(model, geoset.MaterialID) : [];
    const key = exists ? textures.map(texture => texture.key).join('+') || 'none' : 'missing-material';
    if (!byKey.has(key)) byKey.set(key, { key, textures: new Map(), geosets: [] });
    const group = byKey.get(key);
    group.geosets.push(id);
    for (const texture of textures) {
      if (!group.textures.has(texture.key)) group.textures.set(texture.key, { ...texture, ids: new Set() });
      for (const textureId of texture.ids) group.textures.get(texture.key).ids.add(textureId);
    }
  });
  const groups = [...byKey.values()].map(raw => {
    const textures = [...raw.textures.values()].map(texture => ({ ...texture, ids: [...texture.ids].sort((a, b) => a - b) }));
    const ids = raw.geosets, members = ids.map(id => memberFacts(model, id)), facts = id => members[ids.indexOf(id)];
    const name = raw.key === 'missing-material' ? 'Missing material' : textures.map(texture => texture.name).join(' + ') || 'No texture';
    const materials = [...new Set(members.map(member => member.material))].sort((a, b) => a - b);
    const signatures = visibilitySignatures(model, ids), visibilityKeys = new Map(ids.map((id, i) => [id, signatures[i]]));
    const group = { key: raw.key, name, mixed: textures.length > 1, textures, geosets: ids, materials, members, visibilityKeys, differences: [], kinds: [] };
    const add = (kind, lines) => { if (!lines.length) return; group.differences.push({ kind, lines }); group.kinds.push(kind); };
    const records = [];
    for (const texture of textures) if (texture.ids.length > 1) {
      const identical = new Set(texture.ids.map(id => keyOf(model.Textures[id]))).size === 1;
      records.push({ type: 'texture', name: texture.name, textures: texture.ids, identical });
    }
    const identicalMaterials = clusterBy(materials, id => resolvedMaterialKey(model, id)).filter(cluster => cluster.ids.length > 1);
    for (const cluster of identicalMaterials) records.push({ type: 'materials', materials: cluster.ids });
    group.duplicateRecords = identicalMaterials.length > 0 || textures.some(texture => new Set(texture.ids.map(id => keyOf(model.Textures[id]))).size < texture.ids.length);
    if (members.length > 1) {
      if (new Set(members.map(member => member.rgb.key)).size > 1) add('rgb', [{ entries: clusterBy(ids, id => facts(id).rgb.text).map(cluster => ({ value: cluster.key, rgb: facts(cluster.ids[0]).rgb, ids: cluster.ids })) }]);
      if (members.some(member => member.rgb.stored) && new Set(members.map(member => keyOf(member.rgb.stored))).size > 1) {
        add('stored', [{ entries: clusterBy(ids, id => keyOf(facts(id).rgb.stored)).map(cluster => ({ value: facts(cluster.ids[0]).rgb.stored, ids: cluster.ids })) }]);
      }
      if (new Set(signatures).size > 1) {
        // One line per distinct arrangement, naming every animation it covers.
        const lines = new Map();
        (model.Sequences || []).forEach((sequence, index) => {
          const frames = sequenceFrames(ids.map(id => alphaTrack(model, id)), sequence);
          if (new Set(ids.map(id => sequenceSignature(model, alphaTrack(model, id), sequence, frames))).size < 2) return;
          const entries = clusterBy(ids, id => visibilityText(facts(id).visibility[index])).map(cluster => ({ visibility: facts(cluster.ids[0]).visibility[index], ids: cluster.ids }));
          const key = keyOf(entries.map(entry => [entry.ids, visibilityText(entry.visibility)]));
          if (!lines.has(key)) lines.set(key, { sequences: [], entries });
          lines.get(key).sequences.push(sequence.Name || `Animation ${index + 1}`);
        });
        add('visibility', [...lines.values()]);
      }
      add('material', materialDifferences(model, members));
      add('shape', clusterBy(ids, id => facts(id).shape).filter(cluster => cluster.ids.length > 1).map(cluster => ({
        entries: [{ value: new Set(cluster.ids.map(id => facts(id).binding)).size === 1 ? 'exact copies' : 'same triangles, bound to different bones', ids: cluster.ids }],
      })));
      const compat = [];
      for (const [field, label] of [['uv', 'UV sets'], ['tangents', 'Tangents'], ['skin', 'Skin weights']]) {
        if (new Set(members.map(member => member.format[field])).size > 1) compat.push({ property: label, note: 'These parts cannot merge with each other.', entries: clusterBy(ids, id => String(facts(id).format[field])).map(cluster => ({ value: cluster.key, ids: cluster.ids })) });
      }
      for (const [field, label] of [['SelectionGroup', 'Selection group'], ['Unselectable', 'Unselectable'], ['LevelOfDetail', 'Level of detail']]) {
        if (new Set(members.map(member => member.metadata[field])).size > 1) compat.push({ property: label, note: 'A merge keeps the settings of the part it merges into.', entries: clusterBy(ids, id => String(facts(id).metadata[field])).map(cluster => ({ value: cluster.key, ids: cluster.ids })) });
      }
      const several = members.filter(member => member.anims > 1).map(member => member.id);
      if (several.length) compat.push({ property: 'Several geoset animations', note: 'Resolve them in the Geoset Animation manager before merging.', entries: [{ value: 'yes', ids: several }] });
      const global = members.filter(member => member.globalVisibility).map(member => member.id);
      if (global.length) compat.push({ property: 'Global visibility loop', note: 'Per-animation visibility changes are unavailable for these parts.', entries: [{ value: 'yes', ids: global }] });
      add('compat', compat);
    }
    group.records = records;
    if (records.length) group.kinds.push('records');
    group.proposal = proposeFor(group);
    const covered = new Set(Object.entries(group.proposal?.actions || {}).filter(([, action]) => action !== 'keep').flatMap(([id, action]) => [Number(id), action]).filter(Number.isInteger));
    const open = ids.filter(id => !covered.has(id));
    group.open = members.length > 1 && open.length > 1 && group.kinds.some(kind => ['rgb', 'visibility', 'material', 'shape'].includes(kind)) ? open : [];
    return group;
  });
  groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.geosets[0] - b.geosets[0]);
  return {
    groups, counts: { geosets: model.Geosets?.length || 0, materials: model.Materials?.length || 0, textures: model.Textures?.length || 0 },
    sequences: (model.Sequences || []).map((sequence, index) => ({ index, name: sequence.Name || `Animation ${index + 1}`, portrait: /portrait/i.test(sequence.Name || '') })),
  };
}

/** Parts can share one geoset when their UV, tangent and skin formats match. */
export function canMergeMembers(model, a, b) {
  return keyOf(formatOf(model.Geosets[a])) === keyOf(formatOf(model.Geosets[b])) && animsFor(model, a).length <= 1 && animsFor(model, b).length <= 1;
}
/** The visibility of whichever part shows most in each animation (shown > partly > hidden). */
export function unionVisibilityOverrides(model, ids) {
  const rank = row => row.state === 'shown' ? 3 : row.state === 'hidden' ? 0 : row.state === 'global' ? -1 : 2;
  const rows = ids.map(id => visibilityFacts(model, id)), overrides = {};
  (model.Sequences || []).forEach((_, index) => {
    let best = 0;
    rows.forEach((row, i) => { if (rank(row[index]) > rank(rows[best][index])) best = i; });
    overrides[index] = rows[best][index].state === 'shown' ? 1 : rows[best][index].state === 'hidden' ? 0 : { from: ids[best] };
  });
  return overrides;
}

function ensureAnim(model, id) {
  const existing = animsFor(model, id);
  if (existing.length > 1) throw Error(`Geoset ${n(id)} has several geoset animations. Resolve them before changing it here.`);
  if (existing.length) return existing[0];
  const anim = createVisibilityGeosetAnimation(id);
  (model.GeosetAnims ||= []).push(anim);
  return anim;
}
function setDefault(anim, field, value) {
  if (value === undefined) { if (anim._MdxDefaults) { delete anim._MdxDefaults[field]; if (!Object.keys(anim._MdxDefaults).length) delete anim._MdxDefaults; } }
  else (anim._MdxDefaults ||= {})[field] = clone(value);
}
function copyColor(model, target, source) {
  const anim = ensureAnim(model, target);
  anim.Flags = ((anim.Flags || 0) & ~2) | ((source?.Flags || 0) & 2);
  if (!(source?.Flags & 2)) return; // A disabled tint keeps its dormant colour.
  if (source.Color === undefined) delete anim.Color; else anim.Color = clone(source.Color);
  setDefault(anim, 'Color', source._MdxDefaults?.Color);
}
function copyVisibility(model, target, source) {
  const anim = ensureAnim(model, target);
  anim.Alpha = clone(source?.Alpha ?? 1);
  setDefault(anim, 'Alpha', source?._MdxDefaults?.Alpha);
}
/** Overrides per animation: 1 shown, 0 hidden, or {from: id} to copy that part's keys. */
function applyOverrides(model, target, overrides, sourceAnim) {
  const entries = Object.entries(overrides || {}).filter(([index]) => model.Sequences?.[index]);
  if (!entries.length) return;
  const anim = ensureAnim(model, target);
  if (isGlobal(anim.Alpha)) throw Error(`Geoset ${n(target)}'s visibility runs on a global loop, so it cannot change per animation.`);
  const target_ = [{ kind: 'geoset', id: target, property: 'Alpha' }];
  for (const value of [0, 1]) {
    const indices = entries.filter(([, v]) => v === value).map(([index]) => Number(index));
    if (indices.length) setAnimationSequences(model, target_, value, indices);
  }
  for (const [index, value] of entries) {
    if (!Number.isInteger(value?.from)) continue;
    const source = sourceAnim(value.from)?.Alpha, interval = model.Sequences[index].Interval, [start, end] = interval;
    if (isGlobal(source)) throw Error(`Geoset ${n(value.from)}'s visibility runs on a global loop and cannot be copied into one animation.`);
    const keys = isTrack(source) ? source.Keys.filter(key => key.Frame >= start && key.Frame <= end) : [];
    if (!keys.length) { setAnimationSequences(model, target_, round(typeof source === 'number' ? source : 1), [Number(index)]); continue; }
    setAnimationSequences(model, target_, round(alphaAt(model, source, start, interval)), [Number(index)]);
    const track = anim.Alpha, cubic = track.LineType > 1;
    track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > end);
    for (const key of keys) {
      const copy = { Frame: key.Frame, Vector: new Float32Array([key.Vector[0]]) };
      if (cubic) { copy.InTan = new Float32Array(key.InTan || copy.Vector); copy.OutTan = new Float32Array(key.OutTan || copy.Vector); }
      track.Keys.push(copy);
    }
    if (keys[0].Frame > start) track.Keys.push({ Frame: start, Vector: new Float32Array([keys[0].Vector[0]]), ...(cubic && { InTan: new Float32Array([keys[0].Vector[0]]), OutTan: new Float32Array([keys[0].Vector[0]]) }) });
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  }
}
function tweakMaterials(model, kept, removed, { opaque, twoSided }) {
  for (const materialId of [...new Set(kept.map(id => model.Geosets[id].MaterialID))]) {
    const material = model.Materials[materialId];
    if (!material) continue;
    const needsOpaque = opaque && (material.Layers[0]?.FilterMode ?? 0) !== 0;
    const needsSides = twoSided && material.Layers.some(layer => !((layer.Shading || 0) & TWO_SIDED));
    if (!needsOpaque && !needsSides) continue;
    // Copy a material that anything outside this choice also uses.
    const shared = model.Geosets.some((g, i) => g.MaterialID === materialId && !kept.includes(i) && !removed.has(i)) || (model.RibbonEmitters || []).some(ribbon => ribbon.MaterialID === materialId);
    let target = material;
    if (shared) {
      const copyId = model.Materials.push(clone(material)) - 1; target = model.Materials[copyId];
      for (const id of kept) if (model.Geosets[id].MaterialID === materialId) model.Geosets[id].MaterialID = copyId;
    }
    if (needsOpaque) {
      target.Layers[0].FilterMode = 0;
      if (target.Layers[0]._MdxDefaults && 'FilterMode' in target.Layers[0]._MdxDefaults) target.Layers[0]._MdxDefaults.FilterMode = 0;
    }
    if (needsSides) for (const layer of target.Layers) layer.Shading = (layer.Shading || 0) | TWO_SIDED;
  }
}
function interpolatedTextureIds(model) {
  const interpolated = track => isTrack(track) && (track.LineType !== 0 || track.Keys.some(key => key.InTan || key.OutTan));
  return model.Materials.some(material => material.Layers.some(layer => slots.some(slot => interpolated(layer[slot])))) || (model.ParticleEmitters2 || []).some(node => interpolated(node.TextureID));
}
function shareIdentical(model, kept) {
  const materials = [...new Set(kept.map(id => model.Geosets[id].MaterialID))].sort((a, b) => a - b), first = new Map();
  for (const id of materials) { const key = resolvedMaterialKey(model, id); if (!first.has(key)) first.set(key, id); }
  for (const id of kept) model.Geosets[id].MaterialID = first.get(resolvedMaterialKey(model, model.Geosets[id].MaterialID));
  // Interpolated texture-ID tracks depend on the index domain; leave them alone.
  if (interpolatedTextureIds(model)) return;
  const used = [...new Set(kept.map(id => model.Geosets[id].MaterialID))], textures = new Map();
  const canonicalTexture = id => { const key = model.Textures[id] ? keyOf(model.Textures[id]) : `missing:${id}`; if (!textures.has(key)) textures.set(key, id); return textures.get(key); };
  for (const materialId of used) for (const layer of model.Materials[materialId].Layers) for (const slot of slots) {
    if (typeof layer[slot] === 'number') layer[slot] = canonicalTexture(layer[slot]);
    else if (isTrack(layer[slot])) for (const key of layer[slot].Keys) if (key.Vector) key.Vector = new key.Vector.constructor(Array.from(key.Vector, canonicalTexture));
    if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = canonicalTexture(layer._MdxDefaults[slot]);
  }
}
function removeGeosets(model, removed) {
  const count = model.Geosets.length, oldToNew = new Array(count).fill(null);
  for (let i = 0, next = 0; i < count; i++) if (!removed.has(i)) oldToNew[i] = next++;
  for (const [id, target] of removed) oldToNew[id] = target == null ? null : oldToNew[target];
  if (!removed.size) return oldToNew;
  const old = model.GeosetAnims || [], animMap = new Map(), kept = [];
  old.forEach((anim, i) => { if (!removed.has(anim.GeosetId)) { animMap.set(i, kept.length); kept.push(anim); } });
  old.forEach((anim, i) => {
    if (!removed.has(anim.GeosetId)) return;
    const target = removed.get(anim.GeosetId), owner = target == null ? -1 : old.findIndex(other => other.GeosetId === target);
    animMap.set(i, owner >= 0 ? animMap.get(owner) : null);
  });
  for (const anim of kept) anim.GeosetId = oldToNew[anim.GeosetId];
  model.GeosetAnims = kept;
  model.Geosets = model.Geosets.filter((_, i) => !removed.has(i));
  for (const bone of model.Bones || []) {
    if (Number.isInteger(bone.GeosetId) && bone.GeosetId >= 0 && bone.GeosetId < count) bone.GeosetId = oldToNew[bone.GeosetId];
    if (Number.isInteger(bone.GeosetAnimId) && animMap.has(bone.GeosetAnimId)) bone.GeosetAnimId = animMap.get(bone.GeosetAnimId);
  }
  if (model.Gliders) model.Gliders = model.Gliders.filter(glider => oldToNew[glider.GeosetId] != null).map(glider => ({ ...glider, GeosetId: oldToNew[glider.GeosetId] }));
  if (model.Info) { model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims.length; }
  return oldToNew;
}
function referencedTextures(model) {
  const ids = new Set();
  visitTextureReferences(model, id => ids.add(id));
  return ids;
}
/** Remove only records this apply left unused; older unused records stay. */
function removeOrphans(model, materials, texturesBefore) {
  const consumers = () => [...model.Geosets, ...(model.RibbonEmitters || [])];
  const used = new Set(consumers().map(consumer => consumer.MaterialID));
  const dropMaterials = [...materials].filter(id => model.Materials[id] && !used.has(id)).sort((a, b) => a - b);
  if (dropMaterials.length) {
    const map = new Map();
    model.Materials = model.Materials.filter((_, id) => { if (dropMaterials.includes(id)) return false; map.set(id, map.size); return true; });
    for (const consumer of consumers()) if (map.has(consumer.MaterialID)) consumer.MaterialID = map.get(consumer.MaterialID);
  }
  let dropTextures = [];
  if (!interpolatedTextureIds(model)) {
    const after = referencedTextures(model);
    dropTextures = [...texturesBefore].filter(id => model.Textures[id] && !after.has(id)).sort((a, b) => a - b);
    if (dropTextures.length) {
      const map = new Map();
      model.Textures = model.Textures.filter((_, id) => { if (dropTextures.includes(id)) return false; map.set(id, map.size); return true; });
      visitTextureReferences(model, (id, set) => { if (map.has(id)) set(map.get(id)); });
    }
  }
  return { materials: dropMaterials.length, textures: dropTextures.length };
}

/** True when a decision would change the model. */
export function decisionChanges(decision) {
  if (!decision || decision.leave) return false;
  return Object.values(decision.actions || {}).some(action => action !== 'keep') || !!decision.opaque || !!decision.twoSided || !!decision.share
    || Object.entries(decision.results || {}).some(([target, result]) => [result.material, result.color, result.visibility].some(source => source != null && source !== Number(target)) || Object.keys(result.overrides || {}).length > 0);
}

/**
 * Apply the selected decisions to `model` (mutated). Each decision:
 * { geosets, actions: {id: 'keep'|'delete'|targetId}, results: {targetId: {material, color, visibility, overrides}}, opaque, twoSided, share }.
 * A merge target may belong to another group; the merged part then takes that
 * target's settings. Every source is read from the model as it was before any
 * decision changed it.
 */
export function applySortMyMess(model, decisions) {
  const active = decisions.filter(decisionChanges);
  const original = { MaterialIDs: model.Geosets.map(geoset => geoset.MaterialID), GeosetAnims: clone(model.GeosetAnims || []) };
  const sourceAnim = id => original.GeosetAnims.find(anim => anim.GeosetId === id);
  const texturesBefore = referencedTextures(model), touched = new Set(), removed = new Map(), merged = [], actions = new Map();
  for (const decision of active) for (const id of decision.geosets) {
    if (!model.Geosets[id]) throw Error('The model changed. Reopen Sort My Mess.');
    if (actions.has(id)) throw Error(`Geoset ${n(id)} is part of two choices.`);
    actions.set(id, decision.actions?.[id] ?? 'keep'); touched.add(model.Geosets[id].MaterialID);
  }
  const actionOf = id => actions.get(id) ?? 'keep';
  for (const [id, action] of actions) {
    if (action === 'keep' || action === 'delete') continue;
    if (!Number.isInteger(action) || action === id || !model.Geosets[action] || actionOf(action) !== 'keep') throw Error(`Geoset ${n(id)} must merge into a part that is kept.`);
    if (!canMergeMembers(model, id, action)) throw Error(`Geosets ${n(id)} and ${n(action)} use different UV, tangent or skin formats, or several geoset animations, and cannot merge.`);
  }
  if (model.Geosets.every((_, id) => actionOf(id) !== 'keep')) throw Error('Keep at least one geoset.');
  for (const decision of active) for (const [text, result] of Object.entries(decision.results || {})) {
    const target = Number(text), ids = decision.geosets;
    if (!ids.includes(target) || actionOf(target) !== 'keep') continue;
    const inGroup = source => source == null || ids.includes(source);
    const fromIds = Object.values(result.overrides || {}).map(value => value?.from).filter(id => id != null);
    if (![result.material, result.color, result.visibility, ...fromIds].every(inGroup)) throw Error('A setting refers to a part outside its group.');
    if (result.material != null && result.material !== target) model.Geosets[target].MaterialID = original.MaterialIDs[result.material];
    if (result.color != null && result.color !== target) copyColor(model, target, sourceAnim(result.color));
    if (result.visibility != null && result.visibility !== target) copyVisibility(model, target, sourceAnim(result.visibility));
    applyOverrides(model, target, result.overrides, sourceAnim);
  }
  for (const [id, action] of [...actions].sort((a, b) => a[0] - b[0])) {
    if (action === 'delete') { removed.set(id, null); continue; }
    if (action === 'keep') continue;
    const target = model.Geosets[action], source = model.Geosets[id];
    try { appendGeosetGeometry(target, source); }
    catch (cause) { throw Error(`Geoset ${n(id)} cannot merge into ${n(action)}: ${cause.message}`); }
    unionAnimatedExtents(target, source);
    target.PrimitiveTypes = Uint32Array.of(4); target.PrimitiveCounts = Uint32Array.of(target.Faces.length);
    removed.set(id, action); merged.push([id, action]);
  }
  for (const decision of active) {
    const kept = decision.geosets.filter(id => !removed.has(id));
    if (decision.opaque || decision.twoSided) tweakMaterials(model, kept, removed, decision);
    if (decision.share) shareIdentical(model, kept);
  }
  const oldToNew = removeGeosets(model, removed);
  const records = removeOrphans(model, touched, texturesBefore);
  return { oldToNew, merged, deleted: [...removed].filter(([, target]) => target == null).map(([id]) => id), ...records, decisions: active.length };
}

/** What the applied decisions change for these geosets, as structured lines. */
export function describeSortMyMessChanges(before, after, report, ids) {
  const lines = new Map(), affected = new Set(), into = new Map(report.merged);
  const add = (change, id) => { const key = keyOf(change); if (!lines.has(key)) lines.set(key, { ...change, ids: [] }); lines.get(key).ids.push(id); };
  for (const id of ids) {
    const next = report.oldToNew[id];
    if (next == null) { add({ type: 'deleted', triangles: before.Geosets[id].Faces.length / 3 }, id); continue; }
    if (into.has(id)) add({ type: 'merged', target: into.get(id) }, id);
    const rgbA = rgbFacts(animsFor(before, id)[0]), rgbB = rgbFacts(animsFor(after, next)[0]);
    if (rgbA.key !== rgbB.key) add({ type: 'rgb', from: rgbA.text, to: rgbB.text }, id);
    const materialA = materialFacts(before, before.Geosets[id].MaterialID), materialB = materialFacts(after, after.Geosets[next].MaterialID);
    if (materialA.key !== materialB.key) {
      const textures = facts => [...new Set(facts.layers.filter(layer => !layer.team).map(layer => layer.texture))].join(' + ');
      const named = textures(materialA) !== textures(materialB);
      add({ type: 'material', from: named ? `${textures(materialA)} · ${materialA.label}` : materialA.label, to: named ? `${textures(materialB)} · ${materialB.label}` : materialB.label }, id);
    }
    const trackA = alphaTrack(before, id), trackB = alphaTrack(after, next);
    (before.Sequences || []).forEach((sequence, index) => {
      const frames = sequenceFrames([trackA, trackB], sequence);
      if (sequenceSignature(before, trackA, sequence, frames) === sequenceSignature(after, trackB, sequence, frames)) return;
      affected.add(index);
      add({ type: 'visibility', sequence: sequence.Name || `Animation ${index + 1}`, from: describeSequence(before, trackA, sequence), to: describeSequence(after, trackB, sequence) }, id);
    });
  }
  return { lines: [...lines.values()], sequences: [...affected].sort((a, b) => a - b) };
}

/** Post-apply check: every geoset outside the choices is unchanged. */
export function verifySortMyMess(before, after, oldToNew, decidedIds) {
  const decided = new Set(decidedIds), differing = [];
  let unchanged = 0;
  before.Geosets.forEach((geoset, id) => {
    if (decided.has(id)) return;
    const next = oldToNew[id], other = after.Geosets[next];
    const anims = (model, index) => keyOf(animsFor(model, index).map(({ GeosetId, ...anim }) => anim));
    const same = other && keyOf({ ...geoset, MaterialID: undefined }) === keyOf({ ...other, MaterialID: undefined })
      && resolvedMaterialKey(before, geoset.MaterialID) === resolvedMaterialKey(after, other.MaterialID) && anims(before, id) === anims(after, next);
    if (same) unchanged++; else differing.push(id);
  });
  const triangles = model => model.Geosets.reduce((sum, geoset) => sum + geoset.Faces.length / 3, 0);
  return { unchanged, differing, trianglesBefore: triangles(before), trianglesAfter: triangles(after) };
}
