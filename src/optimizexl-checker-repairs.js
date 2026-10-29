import { typedJson } from './value-key.js';
// General repairs for the bundled mdx-m3-viewer checker's findings. Each rule mirrors
// one checker condition, so it works on any model rather than on the example
// it was first seen in. A rule fixes every instance in the model at once and
// re-detects at apply time, so rules can run in any order and be repeated.
// `exact` rules do not change how the model looks or plays in the game;
// rules with `choices` need a decision and start on the listed default.
import { createNode } from './editor-document.js';
import { allNodes, sampleTrack } from './animation.js';
import { changeNodeType, remapNodes } from './optimizexl-nodes.js';

const json = typedJson;
const resolve = (m, path) => path.reduce((v, k) => v?.[k], m);
const local = t => t.GlobalSeqId == null || t.GlobalSeqId === -1 || t.GlobalSeqId === 0xffffffff;
const none = id => id == null || id === -1 || id === 0xffffffff;
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
const TRANSFORMS = new Set(['Translation', 'Rotation', 'Scaling']);
const STANDARD_NAMES = ['attack', 'birth', 'cinematic', 'death', 'decay', 'dissipate', 'morph', 'portrait', 'sleep', 'spell', 'stand', 'walk', 'ready'];
const REPLACEABLE_IDS = new Set([1, 2, 11, 21, 31, 32, 33, 34, 35, 36, 37]);
const TEXTURE_EXTENSIONS = /\.(blp|tga|tif|dds)$/i;
const XY_QUAD = 1048576;
// The checker measures Float32 coordinates: 22299 floats is 7433 vertices.
export const GEOSET_VERTEX_LIMIT = 7433;
const SPLIT_SIZE = 7000;

function trackEntries(m) {
  const out = [];
  (function walk(x, path) {
    if (!x || typeof x !== 'object' || ArrayBuffer.isView(x)) return;
    if (Array.isArray(x.Keys)) { out.push({ track: x, path }); return; }
    for (const [k, v] of Object.entries(x)) if (k !== 'Nodes' && k !== '_MdxDefaults') walk(v, [...path, k]);
  })(m, []);
  return out;
}
const keyValue = key => key.Vector.length === 1 ? key.Vector[0] : new Float32Array(key.Vector);
const isIdentity = (prop, value) => json(value) === json(prop === 'Rotation' ? [0, 0, 0, 1] : prop === 'Scaling' ? [1, 1, 1] : prop === 'Translation' ? [0, 0, 0] : 1);
/** Replace an animated property with a constant. False when MDX cannot store
 * that property as a constant other than its built-in default. */
function makeStatic(m, path, value, dryRun = false) {
  const owner = resolve(m, path.slice(0, -1)), prop = path.at(-1), defaults = owner?._MdxDefaults;
  if (defaults && prop in defaults || path[0] === 'GeosetAnims' || path[0] === 'Materials') {
    if (dryRun) return true;
    owner[prop] = value;
    if (defaults) { delete defaults[prop]; if (!Object.keys(defaults).length) delete owner._MdxDefaults; }
    return true;
  }
  if ((TRANSFORMS.has(prop) || prop === 'Visibility') && isIdentity(prop, value)) { if (!dryRun) delete owner[prop]; return true; }
  return false;
}
function emptyValue(m, path) {
  const owner = resolve(m, path.slice(0, -1)), prop = path.at(-1);
  if (owner?._MdxDefaults && prop in owner._MdxDefaults) return owner._MdxDefaults[prop];
  if (TRANSFORMS.has(prop)) return prop === 'Rotation' ? new Float32Array([0, 0, 0, 1]) : new Float32Array(prop === 'Scaling' ? [1, 1, 1] : [0, 0, 0]);
  if (prop === 'Visibility' || prop === 'Alpha') return 1;
  if (prop === 'Color' && path[0] === 'GeosetAnims') return new Float32Array([1, 1, 1]);
  return undefined;
}
function eventTracks(m) { return (m.EventObjects || []).map(node => ({ node, frames: Array.from(node.EventTrack || []) })); }
function setEventFrames(node, frames) { node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor(frames) : frames; }
function removeNodes(m, ids) { if (ids.size) remapNodes(m, ids); }
function nodeName(node) { return node?.Name || `node ${node?.ObjectId}`; }
function ownerName(m, path) { const owner = resolve(m, path.slice(0, -1)); return owner?.Name || path.slice(0, -1).join(' '); }

// Geoset indices are referenced by geoset animations and bones; geoset
// animation indices by bones. Keep both consistent when either list shrinks.
function removeGeosetAnims(m, removed) {
  if (!removed.size) return;
  const map = new Map(); let next = 0;
  m.GeosetAnims.forEach((_, i) => { if (!removed.has(i)) map.set(i, next++); });
  m.GeosetAnims = m.GeosetAnims.filter((_, i) => !removed.has(i));
  for (const bone of m.Bones) if (!none(bone.GeosetAnimId)) bone.GeosetAnimId = map.has(bone.GeosetAnimId) ? map.get(bone.GeosetAnimId) : null;
}
function removeGeosets(m, removed) {
  if (!removed.size) return;
  const map = new Map(); let next = 0;
  m.Geosets.forEach((_, i) => { if (!removed.has(i)) map.set(i, next++); });
  m.Geosets = m.Geosets.filter((_, i) => !removed.has(i));
  removeGeosetAnims(m, new Set(m.GeosetAnims.flatMap((a, i) => removed.has(a.GeosetId) ? [i] : [])));
  for (const a of m.GeosetAnims) if (map.has(a.GeosetId)) a.GeosetId = map.get(a.GeosetId);
  for (const bone of m.Bones) if (!none(bone.GeosetId)) bone.GeosetId = map.has(bone.GeosetId) ? map.get(bone.GeosetId) : null;
}
/** Bone object IDs actually reached through each vertex's matrix group. */
function boneUsage(m) {
  const used = new Map();
  for (const g of m.Geosets) {
    const counts = new Map();
    for (const group of g.VertexGroup || []) counts.set(group, (counts.get(group) || 0) + 1);
    for (const [group, n] of counts) for (const id of g.Groups[group] || []) used.set(id, (used.get(id) || 0) + n);
  }
  return used;
}

// Each rule: detect(m) -> instances, apply(m, choice) fixes them all.
const RULES = [
  // Out-of-order keys have no defined playback, so sorting them can visibly
  // change the motion (the bundled gnome's Walk Fast). Check the preview.
  { id: 'keyOrder', exact: false, label: n => `Put ${plural(n, 'track')} back in time order`,
    detail: 'Some keys are out of order or share a frame. Sort them by time and keep the last key on a shared frame. Where keys were out of order the motion can change; check the preview.',
    detect: m => [...trackEntries(m).filter(({ track }) => track.Keys.some((k, i) => i && k.Frame <= track.Keys[i - 1].Frame)).map(e => e.path.join('.')),
      ...eventTracks(m).filter(({ frames }) => frames.some((f, i) => i && f <= frames[i - 1])).map(e => nodeName(e.node))],
    apply: m => {
      for (const { track } of trackEntries(m)) {
        const sorted = track.Keys.map((k, i) => [k, i]).sort((a, b) => a[0].Frame - b[0].Frame || a[1] - b[1]).map(([k]) => k);
        track.Keys = sorted.filter((k, i) => i === sorted.length - 1 || sorted[i + 1].Frame !== k.Frame);
      }
      for (const { node, frames } of eventTracks(m)) setEventFrames(node, [...new Set(frames)].sort((a, b) => a - b));
    } },
  { id: 'negativeKeys', exact: true, label: n => `Remove keys before frame 0 on ${plural(n, 'track')}`,
    detail: 'Keys at negative times never play in any animation.',
    detect: m => [...trackEntries(m).filter(({ track }) => track.Keys.some(k => k.Frame < 0)).map(e => e.path.join('.')),
      ...eventTracks(m).filter(({ frames }) => frames.some(f => f < 0)).map(e => nodeName(e.node))],
    apply: m => {
      for (const { track } of trackEntries(m)) track.Keys = track.Keys.filter(k => k.Frame >= 0);
      for (const { node, frames } of eventTracks(m)) setEventFrames(node, frames.filter(f => f >= 0));
    } },
  { id: 'emptyTracks', exact: true, label: n => `Remove ${plural(n, 'empty animation track')}`,
    detail: 'These tracks have no keys, so the game already uses the fixed value. Store that value instead of an empty track.',
    detect: m => trackEntries(m).filter(({ track, path }) => !track.Keys.length && emptyValue(m, path) !== undefined && makeStatic(m, path, emptyValue(m, path), true)).map(e => e.path.join('.')),
    apply: m => { for (const { track, path } of trackEntries(m)) if (!track.Keys.length) { const v = emptyValue(m, path); if (v !== undefined) makeStatic(m, path, v); } } },
  { id: 'emptyEvents', exact: true, label: n => `Remove ${plural(n, 'event object')} that never fire`,
    detail: 'An event object without event times never plays its sound or effect.',
    detect: m => (m.EventObjects || []).filter(e => !(e.EventTrack?.length)).map(nodeName),
    apply: m => removeNodes(m, new Set((m.EventObjects || []).filter(e => !(e.EventTrack?.length)).map(e => e.ObjectId))) },
  { id: 'globalReference', exact: true, label: n => `Fix ${plural(n, 'track')} that use a missing global sequence`,
    detail: 'These tracks point at a global sequence that does not exist. Keep each one at its first key value.',
    detect: m => trackEntries(m).filter(({ track }) => !local(track) && !(track.GlobalSeqId < m.GlobalSequences.length)).map(e => e.path.join('.')),
    apply: m => { for (const { track, path } of trackEntries(m)) if (!local(track) && !(track.GlobalSeqId < m.GlobalSequences.length)) { if (!track.Keys.length || !makeStatic(m, path, keyValue(track.Keys[0]))) track.GlobalSeqId = null; } } },
  { id: 'variation', exact: false, label: n => `Make ${plural(n, 'particle variation')} constant`,
    detail: 'mdx-m3-viewer flags animated particle variation. Keep each emitter at its first variation value.',
    detect: m => (m.ParticleEmitters2 || []).filter(e => e.Variation?.Keys).map(nodeName),
    apply: m => { (m.ParticleEmitters2 || []).forEach((e, i) => { if (e.Variation?.Keys) makeStatic(m, ['ParticleEmitters2', i, 'Variation'], e.Variation.Keys.length ? e.Variation.Keys[0].Vector[0] : (e._MdxDefaults?.Variation ?? 0)); }); } },
  { id: 'texturePath', exact: true, label: n => `Clear ${plural(n, 'texture path')} the game ignores`,
    detail: 'A texture with a team-colour or replaceable ID ignores its file path. Clear the unused path.',
    detect: m => m.Textures.filter(t => t.Image && t.ReplaceableId && REPLACEABLE_IDS.has(t.ReplaceableId)).map(t => t.Image),
    apply: m => { for (const t of m.Textures) if (t.Image && t.ReplaceableId && REPLACEABLE_IDS.has(t.ReplaceableId)) t.Image = ''; } },
  { id: 'replaceableId', exact: true, label: n => `Fix ${plural(n, 'unknown replaceable ID')}`,
    detail: 'These textures and particles use a replaceable ID the game does not know. Use their texture file instead.',
    detect: m => [...m.Textures.filter(t => t.ReplaceableId && !REPLACEABLE_IDS.has(t.ReplaceableId) && t.Image).map(t => t.Image),
      ...(m.ParticleEmitters2 || []).filter(e => e.ReplaceableId && !REPLACEABLE_IDS.has(e.ReplaceableId)).map(nodeName)],
    apply: m => {
      for (const t of m.Textures) if (t.ReplaceableId && !REPLACEABLE_IDS.has(t.ReplaceableId) && t.Image) t.ReplaceableId = 0;
      for (const e of m.ParticleEmitters2 || []) if (e.ReplaceableId && !REPLACEABLE_IDS.has(e.ReplaceableId)) e.ReplaceableId = 0;
    } },
  { id: 'textureAnimReference', exact: true, label: n => `Fix ${plural(n, 'layer')} that use a missing texture animation`,
    detail: 'These material layers point at a texture animation that does not exist. Remove the broken link.',
    detect: m => m.Materials.flatMap((mat, i) => mat.Layers.filter(l => !none(l.TVertexAnimId) && !(l.TVertexAnimId < (m.TextureAnims || []).length)).map(() => `Material ${i + 1}`)),
    apply: m => { for (const mat of m.Materials) for (const l of mat.Layers) if (!none(l.TVertexAnimId) && !(l.TVertexAnimId < (m.TextureAnims || []).length)) l.TVertexAnimId = null; } },
  { id: 'geosetAnimReference', exact: true, label: n => `Remove ${plural(n, 'geoset animation')} for missing geosets`,
    detail: 'These geoset animations point at a geoset that does not exist, so they affect nothing.',
    detect: m => m.GeosetAnims.filter(a => !(a.GeosetId >= 0 && a.GeosetId < m.Geosets.length)).map((_, i) => `Geoset animation ${i + 1}`),
    apply: m => removeGeosetAnims(m, new Set(m.GeosetAnims.flatMap((a, i) => a.GeosetId >= 0 && a.GeosetId < m.Geosets.length ? [] : [i]))) },
  { id: 'boneReference', exact: true, label: n => `Fix ${plural(n, 'bone')} that point at a missing geoset`,
    detail: 'These bones point at a geoset or geoset animation that does not exist. Remove the broken link.',
    detect: m => m.Bones.filter(b => !none(b.GeosetId) && !(b.GeosetId < m.Geosets.length) || !none(b.GeosetAnimId) && !(b.GeosetAnimId < m.GeosetAnims.length)).map(nodeName),
    apply: m => { for (const b of m.Bones) { if (!none(b.GeosetId) && !(b.GeosetId < m.Geosets.length)) b.GeosetId = null; if (!none(b.GeosetAnimId) && !(b.GeosetAnimId < m.GeosetAnims.length)) b.GeosetAnimId = null; } } },
  { id: 'parent', exact: true, label: n => `Fix ${plural(n, 'node')} with a missing or looping parent`,
    detail: 'These nodes are their own parent or point at a parent that does not exist. Make them top-level nodes.',
    detect: m => { const ids = new Set(allNodes(m).map(n => n.ObjectId)); return allNodes(m).filter(n => n.Parent != null && n.Parent !== -1 && (n.Parent === n.ObjectId || !ids.has(n.Parent))).map(nodeName); },
    apply: m => { const ids = new Set(allNodes(m).map(n => n.ObjectId)); for (const n of allNodes(m)) if (n.Parent != null && n.Parent !== -1 && (n.Parent === n.ObjectId || !ids.has(n.Parent))) n.Parent = null; } },
  { id: 'helperSkin', exact: true, label: n => `Turn ${plural(n, 'helper')} that move vertices into bones`,
    detail: 'Vertices are attached to helpers. Helpers and bones move vertices the same way, but the game expects bones.',
    detect: m => { const used = boneUsage(m); return m.Helpers.filter(h => used.has(h.ObjectId)).map(nodeName); },
    apply: m => { const used = boneUsage(m); for (const h of [...m.Helpers]) if (used.has(h.ObjectId)) changeNodeType(m, h, 'Bone'); } },
  { id: 'unskinnedBone', exact: true, label: n => `Turn ${plural(n, 'bone')} without vertices into helpers`,
    // A bone's own geoset-animation link only sets that bone's visibility,
    // which nothing draws (see the bundled viewer); its vertices use their geoset's.
    detail: 'No vertices are attached to these bones. As helpers they move their children exactly the same way.',
    detect: m => { if (!m.Bones.length) return []; const used = boneUsage(m); return m.Bones.filter(b => !used.has(b.ObjectId)).map(nodeName); },
    apply: m => { const used = boneUsage(m); for (const b of [...m.Bones]) if (!used.has(b.ObjectId)) changeNodeType(m, b, 'Helper'); } },
  { id: 'zeroFaces', exact: true, label: n => `Remove ${plural(n, 'geoset')} with no faces`,
    detail: 'A geoset without triangles is never drawn in the game.',
    detect: m => m.Geosets.flatMap((g, i) => g.Faces.length ? [] : [`Geoset ${i + 1}`]),
    apply: m => removeGeosets(m, new Set(m.Geosets.flatMap((g, i) => g.Faces.length ? [] : [i]))) },
  { id: 'vertexLimit', exact: true, label: n => `Split ${plural(n, 'oversized geoset')}`,
    detail: `The game limits a geoset to ${GEOSET_VERTEX_LIMIT - 1} vertices. Split it into smaller geosets with the same material and animation; it looks the same.`,
    detect: m => m.Geosets.flatMap((g, i) => g.Vertices.length / 3 >= GEOSET_VERTEX_LIMIT ? [`Geoset ${i + 1}`] : []),
    apply: m => { for (let i = m.Geosets.length - 1; i >= 0; i--) if (m.Geosets[i].Vertices.length / 3 >= GEOSET_VERTEX_LIMIT) splitGeoset(m, i); } },
  { id: 'lightAttenuation', exact: false, label: n => `Bring ${plural(n, 'light')} into the 80–200 range`,
    detail: 'mdx-m3-viewer expects light attenuation to start at 80 or more and end at 200 or less.',
    detect: m => (m.Lights || []).filter(l => { const [s, e] = attenuation(l); return s < 80 || e > 200 || e <= s; }).map(nodeName),
    apply: m => { for (const l of m.Lights || []) { const [s, e] = attenuation(l), start = Math.min(199, Math.max(80, s)), end = Math.min(200, Math.max(start + 1, e)); setAttenuation(l, 'AttenuationStart', start); setAttenuation(l, 'AttenuationEnd', end); } } },
  { id: 'origin', exact: true, label: () => 'Add the missing Origin attachment point',
    detail: 'Units need an "Origin Ref" attachment point for effects placed on them. Add one at the model centre.',
    detect: m => (m.Attachments || []).some(a => (a.Name || '').startsWith('Origin Ref')) ? [] : ['Origin Ref'],
    apply: m => { if (!(m.Attachments || []).some(a => (a.Name || '').startsWith('Origin Ref'))) { const n = createNode(m, 'Attachment'); n.Name = 'Origin Ref'; } } },
  { id: 'timeMiddle', exact: true, label: n => `Fix ${plural(n, 'particle emitter')} with a middle time outside 0–1`,
    detail: 'The middle time of a particle\'s life must be between 0 and 1.',
    detect: m => (m.ParticleEmitters2 || []).filter(e => typeof e.Time === 'number' && !(e.Time >= 0 && e.Time <= 1)).map(nodeName),
    apply: m => { for (const e of m.ParticleEmitters2 || []) if (typeof e.Time === 'number' && !(e.Time >= 0 && e.Time <= 1)) e.Time = Math.min(1, Math.max(0, e.Time || 0)); } },
  { id: 'animationFile', exact: true, label: () => 'Clear the unused animation file name',
    detail: 'Warcraft III models should not name a separate animation file.',
    detect: m => m.Info?.AnimationFile ? [m.Info.AnimationFile] : [],
    apply: m => { m.Info.AnimationFile = ''; } },
  { id: 'sequenceNames', exact: true, label: n => `Fix the spelling of ${plural(n, 'animation name')}`,
    detail: 'Names like "Stand1" or "attack_2" are not recognised by the game. Add the space it expects, for example "Stand 1".',
    detect: m => m.Sequences.filter(s => fixedName(s.Name) !== s.Name).map(s => s.Name),
    apply: m => { for (const s of m.Sequences) s.Name = fixedName(s.Name); } },
  { id: 'zeroLength', exact: true, label: n => `Give ${plural(n, 'zero-length animation')} one frame`,
    detail: 'An animation that starts and ends on the same frame. Extend it by one frame, holding the same pose.',
    detect: m => m.Sequences.filter((s, i) => s.Interval[1] === s.Interval[0] && roomAfter(m, i)).map(s => s.Name),
    apply: m => { m.Sequences.forEach((s, i) => { if (s.Interval[1] === s.Interval[0] && roomAfter(m, i)) s.Interval = new Uint32Array([s.Interval[0], s.Interval[0] + 1]); }); } },
  { id: 'globalOpening', exact: true, label: n => `Add ${plural(n, 'missing opening key')} to global animations`,
    detail: 'A global animation track has no key at its start. Hold its first value from the start, like the game does.',
    detect: m => trackEntries(m).filter(({ track }) => missingGlobalOpening(m, track)).map(e => ownerName(m, e.path)),
    apply: m => {
      for (const { track } of trackEntries(m)) if (missingGlobalOpening(m, track)) {
        const first = track.Keys.find(k => k.Frame >= 0), key = { Frame: 0, Vector: new Float32Array(first.Vector) };
        if (track.LineType >= 2) { key.InTan = new Float32Array(first.Vector); key.OutTan = new Float32Array(first.Vector); first.InTan = new Float32Array(first.Vector); }
        track.Keys.splice(track.Keys.indexOf(first), 0, key);
      }
    } },
  { id: 'timeline', exact: true, label: () => 'Give every animation its own time range',
    detail: 'Some animations start on the same frame or overlap an earlier one. Copy each animation\'s keys to a free time range so none overlap; every animation plays the same.',
    detect: m => timelineConflicts(m).map(i => m.Sequences[i].Name),
    apply: m => separateTimeline(m) },
  // Decisions: the default is applied unless another choice is selected.
  { id: 'standDeath', label: n => `Add the missing ${n === 2 ? 'Stand and Death animations' : 'Stand or Death animation'}`,
    detail: 'The game expects every model with animations to have a Stand and a Death. Attachments and props often only need Stand.',
    choices: [['add', 'Add a still one-second animation after the others'], ['skip', 'Leave it']],
    detect: m => m.Sequences.length ? ['stand', 'death'].filter(word => !m.Sequences.some(s => sequenceWord(s.Name) === word)) : [],
    apply: (m, choice) => {
      if (choice === 'skip' || !m.Sequences.length) return;
      for (const word of ['stand', 'death']) if (!m.Sequences.some(s => sequenceWord(s.Name) === word)) {
        const start = Math.ceil((Math.max(...m.Sequences.map(s => s.Interval[1])) + 100) / 100) * 100, template = m.Sequences[0];
        m.Sequences.push({ ...structuredClone(template), Name: word === 'stand' ? 'Stand' : 'Death', Interval: new Uint32Array([start, start + 1000]), NonLooping: word === 'death', Flags: word === 'death' ? 1 : 0, MoveSpeed: 0, Rarity: 0 });
        for (const g of m.Geosets) if (g.Anims?.length) g.Anims.push(structuredClone(g.Anims[0]));
      }
    } },
  { id: 'vertexAttachment', label: n => `Attach ${plural(n, 'loose vertex', 'loose vertices')} to a bone`,
    detail: 'Some vertices are attached to nothing, or to a bone or group that does not exist. They do not follow the animation.',
    choices: [['neighbour', 'Attach to the bone of the nearest connected vertex'], ['skip', 'Leave them']],
    detect: m => m.Bones.length ? m.Geosets.flatMap((g, i) => looseVertices(m, g).length ? [`Geoset ${i + 1}`] : []) : [],
    apply: (m, choice) => { if (choice !== 'skip') for (const g of m.Geosets) attachLooseVertices(m, g); } },
  { id: 'materialReference', label: n => `Fix ${plural(n, 'geoset or ribbon', 'geosets or ribbons')} that use a missing material`,
    detail: 'These parts point at a material that does not exist.',
    choices: [['first', 'Use the first material'], ['skip', 'Leave them']],
    detect: m => m.Materials.length ? [...m.Geosets.flatMap((g, i) => g.MaterialID >= 0 && g.MaterialID < m.Materials.length ? [] : [`Geoset ${i + 1}`]),
      ...(m.RibbonEmitters || []).filter(r => !(r.MaterialID >= 0 && r.MaterialID < m.Materials.length)).map(nodeName)] : [],
    apply: (m, choice) => { if (choice === 'skip') return; for (const g of m.Geosets) if (!(g.MaterialID >= 0 && g.MaterialID < m.Materials.length)) g.MaterialID = 0; for (const r of m.RibbonEmitters || []) if (!(r.MaterialID >= 0 && r.MaterialID < m.Materials.length)) r.MaterialID = 0; } },
  { id: 'textureReference', label: n => `Fix ${plural(n, 'layer or particle', 'layers or particles')} that use a missing texture`,
    detail: 'These material layers or particle emitters point at a texture that does not exist.',
    choices: [['first', 'Use the first texture'], ['skip', 'Leave them']],
    detect: m => m.Textures.length ? brokenTextureUsers(m).map(x => x.name) : [],
    apply: (m, choice) => { if (choice === 'skip') return; for (const x of brokenTextureUsers(m)) x.fix(); } },
  { id: 'filterMode', label: n => `Fix ${plural(n, 'unknown blend mode')}`,
    detail: 'These layers or particles use a filter (blend) mode the game does not have.',
    choices: [['blend', 'Use Blend'], ['skip', 'Leave them']],
    detect: m => [...m.Materials.flatMap((mat, i) => mat.Layers.filter(l => !(l.FilterMode >= 0 && l.FilterMode <= 6)).map(() => `Material ${i + 1}`)),
      ...(m.ParticleEmitters2 || []).filter(e => !(e.FilterMode >= 0 && e.FilterMode <= 4)).map(nodeName)],
    apply: (m, choice) => { if (choice === 'skip') return; for (const mat of m.Materials) for (const l of mat.Layers) if (!(l.FilterMode >= 0 && l.FilterMode <= 6)) l.FilterMode = 1; for (const e of m.ParticleEmitters2 || []) if (!(e.FilterMode >= 0 && e.FilterMode <= 4)) e.FilterMode = 0; } },
  { id: 'texturePathExtension', label: n => `Fix ${plural(n, 'texture path')} with an unusable file type`,
    detail: 'The game loads .blp, .tga, .tif and .dds textures. Point these at a .blp file with the same name; make sure that file exists.',
    choices: [['blp', 'Change the file type to .blp'], ['skip', 'Leave them']],
    detect: m => m.Textures.filter(t => t.Image && !TEXTURE_EXTENSIONS.test(t.Image)).map(t => t.Image),
    apply: (m, choice) => { if (choice !== 'skip') for (const t of m.Textures) if (t.Image && !TEXTURE_EXTENSIONS.test(t.Image)) t.Image = t.Image.replace(/(\.[^.\\/]*)?$/, '.blp'); } },
  { id: 'modelPath', label: n => `Clear ${plural(n, 'attached model path')} that is not a model`,
    detail: 'Attachment points and model particle emitters must point at .mdl or .mdx files.',
    choices: [['clear', 'Clear the path'], ['skip', 'Leave them']],
    detect: m => [...(m.Attachments || []).filter(a => a.Path && !/\.md[lx]$/i.test(a.Path)), ...(m.ParticleEmitters || []).filter(e => !/\.md[lx]$/i.test(e.Path || ''))].map(nodeName),
    apply: (m, choice) => { if (choice === 'skip') return; for (const a of m.Attachments || []) if (a.Path && !/\.md[lx]$/i.test(a.Path)) a.Path = ''; for (const e of m.ParticleEmitters || []) if (!/\.md[lx]$/i.test(e.Path || '')) e.Path = ''; } },
  { id: 'duplicateGeosetAnims', exact: true, label: n => `Remove unused extra geoset animations on ${plural(n, 'geoset')}`,
    detail: 'A geoset has several geoset animations, and only the last one plays. Remove the others.',
    detect: m => m.Geosets.flatMap((_, i) => m.GeosetAnims.filter(a => a.GeosetId === i).length > 1 ? [`Geoset ${i + 1}`] : []),
    apply: m => {
      const last = new Map(), removed = new Set();
      m.GeosetAnims.forEach((a, i) => last.set(a.GeosetId, i));
      m.GeosetAnims.forEach((a, i) => { if (last.get(a.GeosetId) !== i) removed.add(i); });
      for (const b of m.Bones) if (removed.has(b.GeosetAnimId)) b.GeosetAnimId = last.get(m.GeosetAnims[b.GeosetAnimId].GeosetId);
      removeGeosetAnims(m, removed);
    } },
  { id: 'visibilityFade', exact: true, label: n => `Make ${plural(n, 'fading visibility track')} switch on and off`,
    detail: 'The game shows or hides these parts at a threshold instead of fading them. Switch on the same frame it already switches.',
    detect: m => trackEntries(m).filter(({ track, path }) => fadingVisibility(m, track, path)).map(e => ownerName(m, e.path)),
    apply: m => { for (const { track, path } of trackEntries(m)) if (fadingVisibility(m, track, path)) stepVisibility(m, track, path); } },
  { id: 'invisibleBoneLink', label: n => `Fix ${plural(n, 'bone')} linked to an invisible geoset animation`,
    detail: 'These bones use a geoset animation that is always fully transparent, so their geoset may never show.',
    choices: [['unlink', 'Remove the bone\'s link to that geoset animation'], ['skip', 'Leave them']],
    detect: m => m.Bones.filter(b => invisibleLink(m, b)).map(nodeName),
    apply: (m, choice) => { if (choice !== 'skip') for (const b of m.Bones) if (invisibleLink(m, b)) b.GeosetAnimId = null; } },
  { id: 'squirt', label: n => `Fix ${plural(n, 'burst particle emitter')} with a fixed amount`,
    detail: 'Burst (Squirt) emitters release particles when their amount is animated. With a fixed amount they do nothing.',
    choices: [['off', 'Turn Burst off'], ['skip', 'Leave them']],
    detect: m => (m.ParticleEmitters2 || []).filter(e => e.Squirt && !e.EmissionRate?.Keys).map(nodeName),
    apply: (m, choice) => { if (choice !== 'skip') for (const e of m.ParticleEmitters2 || []) if (e.Squirt && !e.EmissionRate?.Keys) e.Squirt = false; } },
  { id: 'xyQuad', label: n => `Fix ${plural(n, 'flat particle emitter')} with zero speed or spread`,
    detail: 'Flat (XY Quad) particles need a speed and latitude above zero. Use a tiny value so they look the same.',
    choices: [['tiny', 'Use 0.01'], ['skip', 'Leave them']],
    detect: m => (m.ParticleEmitters2 || []).filter(e => (e.Flags & XY_QUAD) && (e.Speed === 0 || e.Latitude === 0)).map(nodeName),
    apply: (m, choice) => { if (choice !== 'skip') for (const e of m.ParticleEmitters2 || []) if (e.Flags & XY_QUAD) { if (e.Speed === 0) e.Speed = 0.01; if (e.Latitude === 0) e.Latitude = 0.01; } } },
];

/** "Stand1" or "attack_2" -> "Stand 1", "Attack 2". The checker and the game
 * read the first word of a name; other names are the author's decision. */
function fixedName(name) {
  const match = /^(\s*)([A-Za-z]+)_?(\d+)(.*)$/s.exec(name || '');
  if (!match || !STANDARD_NAMES.includes(match[2].toLowerCase())) return name;
  return `${match[1]}${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()} ${match[3]}${match[4]}`;
}
function visibilityDomains(m, track) {
  if (!local(track)) { const length = m.GlobalSequences[track.GlobalSeqId]; return length > 0 ? [[0, length]] : []; }
  return m.Sequences.map(s => Array.from(s.Interval));
}
/** Visibility tracks the checker flags whose value changes inside an
 * animation. Constant ones belong to the plain visibility repair. */
function fadingVisibility(m, track, path) {
  if (path.at(-1) !== 'Visibility' || !track.LineType || !track.Keys.length || track.Keys.some((k, i) => i && k.Frame <= track.Keys[i - 1].Frame)) return false;
  return visibilityDomains(m, track).some(([lo, hi]) => { const keys = track.Keys.filter(k => k.Frame >= lo && k.Frame <= hi); return keys.some(k => k.Vector[0] !== keys[0].Vector[0]); });
}
// The viewer shows an attachment above 0.1 visibility and other nodes above 0.
function stepVisibility(m, track, path) {
  const threshold = path[0] === 'Attachments' ? 0.1 : 0, shown = v => v > threshold, added = [];
  for (const interval of visibilityDomains(m, track)) {
    const keys = track.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
    for (let i = 0; i + 1 < keys.length; i++) {
      let state = shown(keys[i].Vector[0]);
      for (let f = keys[i].Frame + 1; f < keys[i + 1].Frame; f++) {
        const now = shown(sampleTrack(track, f, { interval, globalSequences: m.GlobalSequences, globalTime: f, fallback: 1 }));
        if (now !== state) { state = now; added.push({ Frame: f, Vector: new Float32Array([shown(keys[i + 1].Vector[0]) === now ? keys[i + 1].Vector[0] : now ? 1 : 0]) }); }
      }
    }
  }
  track.Keys = [...track.Keys.map(k => ({ Frame: k.Frame, Vector: new Float32Array(k.Vector) })), ...added].sort((a, b) => a.Frame - b.Frame);
  track.LineType = 0;
}
function sequenceWord(name) { const words = (name || '').toLowerCase().trim().split('-')[0].split(/\s+/); return words[0] === 'alternate' ? words[1] : words[0]; }
function roomAfter(m, index) { const f = m.Sequences[index].Interval[0] + 1; return !m.Sequences.some((s, i) => i !== index && f >= s.Interval[0] && f <= s.Interval[1]); }
function attenuation(l) { const read = k => typeof l[k] === 'number' ? l[k] : l._MdxDefaults?.[k] ?? (k === 'AttenuationStart' ? 80 : 200); return [read('AttenuationStart'), read('AttenuationEnd')]; }
function setAttenuation(l, key, value) { if (typeof l[key] === 'number' || !l[key]?.Keys) l[key] = value; else (l._MdxDefaults ||= {})[key] = value; }
function missingGlobalOpening(m, track) {
  if (local(track) || !(track.GlobalSeqId < m.GlobalSequences.length) || !track.LineType) return false;
  const keys = track.Keys.filter(k => k.Frame >= 0 && k.Frame <= m.GlobalSequences[track.GlobalSeqId]);
  return keys.length > 1 && keys[0].Frame !== 0 && json(keys[0].Vector) !== json(keys.at(-1).Vector);
}
function invisibleLink(m, bone) {
  const a = none(bone.GeosetAnimId) ? null : m.GeosetAnims[bone.GeosetAnimId];
  return !!a && !none(bone.GeosetId) && typeof a.Alpha === 'number' && a.Alpha < 0.1;
}
function brokenTextureUsers(m) {
  const n = m.Textures.length, bad = id => !(id >= 0 && id < n), out = [];
  m.Materials.forEach((mat, i) => mat.Layers.forEach(l => {
    if (l.TextureID?.Keys) { if (l.TextureID.Keys.some(k => bad(k.Vector[0]))) out.push({ name: `Material ${i + 1}`, fix: () => { for (const k of l.TextureID.Keys) if (bad(k.Vector[0])) k.Vector[0] = 0; } }); }
    else if (bad(l.TextureID)) out.push({ name: `Material ${i + 1}`, fix: () => { l.TextureID = 0; } });
  }));
  for (const e of m.ParticleEmitters2 || []) if (bad(e.TextureID)) out.push({ name: nodeName(e), fix: () => { e.TextureID = 0; } });
  return out;
}
function looseVertices(m, g) {
  const ids = new Set(allNodes(m).map(n => n.ObjectId)), out = [];
  for (let v = 0; v < g.VertexGroup.length; v++) { const group = g.Groups[g.VertexGroup[v]]; if (!group?.length || group.some(id => !ids.has(id))) out.push(v); }
  return out;
}
function attachLooseVertices(m, g) {
  if (!looseVertices(m, g).length) return;
  reattach(m, g);
  g.TotalGroupsCount = g.Groups.reduce((n, group) => n + group.length, 0);
}
function reattach(m, g) {
  const loose = new Set(looseVertices(m, g));
  const ids = new Set(allNodes(m).map(n => n.ObjectId));
  // A group that names some missing nodes keeps the nodes that do exist.
  g.Groups = g.Groups.map(group => { const kept = group.filter(id => ids.has(id)); return kept.length ? kept : group; });
  const valid = v => { const group = g.Groups[g.VertexGroup[v]]; return group?.length && group.every(id => ids.has(id)); };
  const neighbours = Array.from({ length: g.VertexGroup.length }, () => []);
  for (let i = 0; i < g.Faces.length; i += 3) for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) if (a !== b) neighbours[g.Faces[i + a]].push(g.Faces[i + b]);
  const pending = [...loose].filter(v => !valid(v));
  for (let pass = 0; pass < 64 && pending.length; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) { const v = pending[i], source = neighbours[v].find(valid); if (source != null) { g.VertexGroup[v] = g.VertexGroup[source]; pending.splice(i, 1); } }
  }
  if (!pending.length) return;
  const anchors = [...g.VertexGroup.keys()].filter(valid), at = v => [0, 1, 2].map(k => g.Vertices[v * 3 + k]);
  let fallback = anchors.length ? null : g.Groups.findIndex(group => group.length && group.every(id => ids.has(id)));
  if (!anchors.length && fallback < 0) { g.Groups.push([m.Bones[0].ObjectId]); fallback = g.Groups.length - 1; }
  for (const v of pending) {
    if (fallback != null) { g.VertexGroup[v] = fallback; continue; }
    const p = at(v); let best = anchors[0], distance = Infinity;
    for (const a of anchors) { const q = at(a), d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < distance) { distance = d; best = a; } }
    g.VertexGroup[v] = g.VertexGroup[best];
  }
}
function splitGeoset(m, index) {
  const g = m.Geosets[index], chunks = [];
  let map = new Map(), faces = [];
  const flush = () => { if (faces.length) chunks.push({ map, faces }); map = new Map(); faces = []; };
  for (let i = 0; i < g.Faces.length; i += 3) {
    const tri = [g.Faces[i], g.Faces[i + 1], g.Faces[i + 2]], extra = tri.filter(v => !map.has(v)).length;
    if (map.size + extra > SPLIT_SIZE) flush();
    for (const v of tri) if (!map.has(v)) map.set(v, map.size);
    faces.push(...tri.map(v => map.get(v)));
  }
  flush();
  const parts = chunks.map(({ map, faces }) => {
    const order = [...map.keys()], part = structuredClone(g), pick = (array, width) => { const out = new array.constructor(order.length * width); order.forEach((v, i) => out.set(array.subarray(v * width, v * width + width), i * width)); return out; };
    part.Vertices = pick(g.Vertices, 3); part.Normals = pick(g.Normals, 3); part.VertexGroup = pick(g.VertexGroup, 1);
    part.TVertices = g.TVertices.map(uv => pick(uv, 2)); part.Faces = new (order.length > 65535 ? Uint32Array : Uint16Array)(faces);
    if (part.PrimitiveTypes) { part.PrimitiveTypes = new Uint32Array([4]); part.PrimitiveCounts = new Uint32Array([faces.length]); }
    return part;
  });
  m.Geosets.splice(index, 1, parts[0]);
  const animations = m.GeosetAnims.filter(a => a.GeosetId === index);
  for (const part of parts.slice(1)) {
    m.Geosets.push(part);
    for (const a of animations) m.GeosetAnims.push({ ...structuredClone(a), GeosetId: m.Geosets.length - 1 });
  }
}
/** Sequence indices the checker flags: same start as, or starting before the
 * end of, any earlier sequence. */
function timelineConflicts(m) {
  if (m.Version !== 800) return [];
  return m.Sequences.flatMap((s, i) => m.Sequences.slice(0, i).some(o => s.Interval[0] === o.Interval[0] || s.Interval[0] < o.Interval[1]) ? [i] : []);
}
function separateTimeline(m) {
  const old = m.Sequences.map(s => Array.from(s.Interval)), moved = [];
  let end = -1;
  for (const [lo, hi] of old) { const start = lo > end ? lo : end + 1; moved.push([start, start + hi - lo]); end = Math.max(end, start + hi - lo); }
  if (moved.every((r, i) => r[0] === old[i][0])) return;
  const inAny = f => old.some(([lo, hi]) => f >= lo && f <= hi), inNew = f => moved.some(([lo, hi]) => f >= lo && f <= hi);
  const relocate = (frames, copy) => {
    const out = new Map();
    // Unused keys outside every animation stay only where nothing plays now.
    for (const [f, item] of frames) if (!inAny(f) && !inNew(f)) out.set(f, item);
    old.forEach(([lo, hi], i) => { for (const [f, item] of frames) if (f >= lo && f <= hi) out.set(f + moved[i][0] - lo, copy(item, f + moved[i][0] - lo)); });
    return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([, item]) => item);
  };
  for (const { track } of trackEntries(m)) if (local(track)) track.Keys = relocate(track.Keys.map(k => [k.Frame, k]), (k, f) => ({ ...structuredClone(k), Frame: f }));
  for (const node of m.EventObjects || []) if (local(node)) setEventFrames(node, relocate(Array.from(node.EventTrack || [], f => [f, f]), (_, f) => f));
  m.Sequences.forEach((s, i) => { s.Interval = new Uint32Array(moved[i]); });
}

/** Every rule's user-facing text (labels for one and several), for translation. */
export function checkerRepairTexts() {
  return RULES.map(r => ({ id: r.id, one: r.label(1), many: r.label(2), detail: r.detail, choices: (r.choices || []).map(c => c[1]) }));
}
export function checkerRepairProposals(m) {
  const out = [];
  for (const rule of RULES) {
    let found; try { found = rule.detect(m); } catch { continue; }
    if (!found.length) continue;
    const choice = rule.choices?.[0][0];
    out.push({ id: `checker:${rule.id}`, kind: 'checker', rule: rule.id, exact: !!rule.exact, count: found.length, items: found.slice(0, 50),
      label: rule.label(found.length), detail: rule.detail, choices: rule.choices || null, choice, sequence: 0, frame: m.Sequences[0]?.Interval[0] || 0 });
  }
  return out;
}
export function applyCheckerRepair(m, fix, settings = {}) {
  const rule = RULES.find(r => r.id === fix.rule);
  if (!rule) throw Error('Unknown checker repair.');
  rule.apply(m, settings.choice ?? fix.choice);
}
