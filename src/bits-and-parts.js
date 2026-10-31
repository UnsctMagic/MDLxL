import { visitTextureReferences } from './texture-references.js';
import { createResourceImporter, partTextureKey } from './model-import.js';
export { partTextureKey } from './model-import.js';
import { TEXTURE_SLOTS } from './mdx-compatibility.js';
import { canonicalValue, stableKey } from './value-key.js';
import { ensureDummyBone } from './dummy-bone.js';
import { deleteGeoset, importGeosets, openDocument, recalculateExtents } from './editor-document.js';
import { deleteVertices, setVertexPositions, transformVertices } from './editor-commands.js';
import { selectedVertexCenter } from './bone-tools.js';
import { updateBounds } from './mesh-tools.js';
import { captureMeshSelection } from './mesh-clipboard.js';
import { adaptPasteFormat } from './paste-format.js';
import { createSequence, fillSequenceExtents, setSequenceName } from './sequence-editor.js';
import { isGlobalTrack, sampleGeosetAnimation, sampleTrack } from './animation.js';
import { createVisibilityGeosetAnimation } from './geoset-animation-defaults.js';
import { standardVisibility } from './auto-corpse.js';

import { gamePathKey } from './game-path.js';
export const partPathKey = gamePathKey;
const canonical = canonicalValue;
const fingerprint = stableKey;

export function partMaterialKey(model, source) {
  const material = structuredClone(source);
  const texture = id => id == null || id === -1 ? id : partTextureKey(model.Textures[id]);
  visitTextureReferences({ Materials: [material] }, (id, set) => set(texture(id)), { arrayType: Array });
  for (const layer of material.Layers || []) {
    if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1) layer.TVertexAnimId = structuredClone(model.TextureAnims[layer.TVertexAnimId]);
  }
  const globals = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (isGlobalTrack(value)) value.GlobalSeqId = model.GlobalSequences[value.GlobalSeqId];
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
  for (const geoset of model.Geosets) fillSequenceExtents(model, geoset);
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
    if (isGlobalTrack(track)) return;
    track.Keys = track.Keys.filter(key => model.Sequences.some(sequence => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]));
  });
  for (const geoset of model.Geosets) geoset.Anims = animations.map(({ sequenceIndex }) => structuredClone(geoset.Anims?.[sequenceIndex] || { MinimumExtent: geoset.MinimumExtent, MaximumExtent: geoset.MaximumExtent, BoundsRadius: geoset.BoundsRadius }));
  return model;
}

/** keepGlobals false freezes global loops at their first frame and drops them. */
export function collectedPartModel(source, { name, animations = null, keepGlobals = true }) {
  if (!String(name || '').trim()) throw Error('Name the Bit before saving.');
  const model = selectPartAnimations(source, animations);
  if (!keepGlobals) {
    for (const owner of ['GeosetAnims', 'Materials', 'TextureAnims']) freezeTracks(model[owner], track => isGlobalTrack(track), 0, undefined, source.GlobalSequences);
    model.GlobalSequences = [];
  }
  model.Info.Name = name.trim();
  return model;
}

/** True when the Bit's appearance loops on a global animation. */
export function partHasGlobalAnimations(model) {
  let found = false;
  visitPartTracks(model, track => { found ||= isGlobalTrack(track, model); });
  return found;
}

const byte = value => Math.round(Math.max(0, Math.min(1, value)) * 255);
const rgbText = rgb => rgb.map(byte).join('/');
function geosetTints(model, sequenceIndex) {
  const frame = model.Sequences?.[sequenceIndex]?.Interval[0] ?? 0;
  return model.Geosets.map((_, id) => {
    if (!(model.GeosetAnims?.find(item => item.GeosetId === id)?.Flags & 2)) return null;
    const rgb = sampleGeosetAnimation(model, id, frame, sequenceIndex).color;
    return rgb.every(value => byte(value) === 255) ? null : rgb;
  });
}

/** Bitz uses a Bit's animations only for RGB. Each distinct look (one RGB or
 * null per geoset, compared as the 0-255 values shown) is one choice;
 * animations that look the same are one. A single look is the whole answer;
 * several start with No RGB. */
export function partRgbOptions(model) {
  const looks = new Map();
  for (const index of model.Sequences?.length ? model.Sequences.keys() : [-1]) {
    const colors = geosetTints(model, index), key = colors.map(rgb => rgb ? rgbText(rgb) : '').join('|');
    if (!looks.has(key)) looks.set(key, { colors, sequenceIndex: index });
  }
  const found = [...looks.values()];
  if (found.length < 2) return found;
  const plain = found.find(look => !look.colors.some(Boolean)) || found[0];
  return [{ label: 'No RGB', colors: null, sequenceIndex: plain.sequenceIndex },
    ...found.filter(look => look.colors.some(Boolean)).map(look => ({ ...look, label: [...new Set(look.colors.filter(Boolean).map(rgbText))].join(' · ') }))];
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

/** Texture files a Bit import carries beside the saved model. Only the Bit's
 * own custom files travel: a path the target already uses is reused, and a
 * path Warcraft III provides (asset.native) stays a path-only texture entry. */
export function partTextureFiles(target, source, assets) {
  const owned = new Set((target.Textures || []).filter(texture => !texture.ReplaceableId && texture.Image).map(texture => partPathKey(texture.Image)));
  const files = [];
  for (const index of partTextureIndices(source)) {
    const texture = source.Textures[index];
    if (texture.ReplaceableId || !texture.Image || /\.w3mod:/i.test(texture.Image)) continue;
    const key = partPathKey(texture.Image);
    if (owned.has(key)) continue;
    const asset = assets.get(key);
    if (!asset) throw Error(`Missing texture: ${texture.Image}. Place it beside the source part or configure its Warcraft data folder.`);
    owned.add(key);
    if (!asset.native) files.push({ name: texture.Image, asset });
  }
  return files;
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
export function commitPart(target, source, { animations = null, look = null, replacement = null } = {}) {
  if (!source?.Geosets?.length) throw Error('This model has no geosets to import.');
  // A part in another model format is converted like a paste (MDX 800 gets
  // Classic geometry and diffuse materials); the target keeps its format.
  source = adaptPasteFormat(source, target.Version);
  if (source.BindPoses?.length || target.BindPoses?.length) throw Error('Parts with bind-pose matrices require baking before import.');
  const next = structuredClone(target), staged = look ? partLook(source, look) : selectPartAnimations(source, animations);
  const donors = replacement ? replacementVertices(target, replacement) : null;
  const replacedMaterials = new Set(donors?.map(vertex => vertex.materialId));
  if (replacement) removePartSelection(next, replacement);
  for (const key of ['Textures', 'Materials', 'TextureAnims', 'GlobalSequences', 'Geosets', 'GeosetAnims']) next[key] ||= [];
  const { globalRef: remapGlobals, materialRef, maps } = createResourceImporter(staged, next, {
    reuseTextures: 'partPath', reuseGlobals: true,
    validGlobalId: (id, model) => Number.isFinite(model.GlobalSequences?.[id]) && model.GlobalSequences[id] > 0,
    keyArrayType: 'int32', fingerprint, reuseMaterials: true, reuseTextureAnims: true,
    materialKey: material => partMaterialKey(next, material),
    isGlobalRef: isGlobalTrack, validateMappedGlobals: true,
    cloneTexture: texture => ({ ...texture }),
    error: (kind, id) => ({
      global: 'The part references a missing global sequence.',
      texture: `The part references missing texture ${id}.`,
      material: `The part references missing material ${id}.`,
      textureAnim: 'The part references a missing texture animation.',
    })[kind],
  });
  // Keep relative source timing, including keys outside sequence intervals.
  // Allocate through the sequence editor and shift only local appearance keys.
  const sequenceIndices = [];
  let sourceStart = Math.min(...staged.Sequences.map(sequence => sequence.Interval[0])), offset = 0;
  visitPartTracks(staged, track => {
    if (isGlobalTrack(track)) return;
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
    if (isGlobalTrack(track)) return;
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
  const start = next.Geosets.length, geosetIndices = [], replacedGeosets = [];
  for (const geoset of staged.Geosets) {
    const count = geoset.Vertices.length / 3;
    if (replacement) replacedGeosets.push(inheritPartBindings(geoset, donors, next.Version));
    else {
      geoset.Groups = [[bone.ObjectId]]; geoset.TotalGroupsCount = 1; geoset.VertexGroup = new Uint8Array(count);
      if (geoset.SkinWeights?.length) { geoset.SkinWeights = new (next.Version >= 1400 ? Uint16Array : Uint8Array)(count * 8); for (let index = 0; index < count; index++) geoset.SkinWeights.set([bone.ObjectId, 0, 0, 0, 255, 0, 0, 0], index * 8); }
    }
    geosetIndices.push(next.Geosets.push(geoset) - 1);
  }
  if (look) staged.GeosetAnims = staged.Geosets.map((_, id) => staged.GeosetAnims?.find(animation => animation.GeosetId === id) || createVisibilityGeosetAnimation(id));
  for (const animation of staged.GeosetAnims || []) if (Number.isInteger(animation.GeosetId) && staged.Geosets[animation.GeosetId]) { animation.GeosetId += start; remapGlobals(animation); next.GeosetAnims.push(animation); }
  // A Bit's own visibility never travels. A replacement shows where the part
  // it replaces showed; a new part gets CORP's standard visibility. A global
  // loop the user chose to apply keeps playing.
  if (look) geosetIndices.forEach((index, offset) => {
    const animation = next.GeosetAnims.find(item => item.GeosetId === index);
    if (isGlobalTrack(animation.Alpha, next)) return;
    const replaced = replacement && target.GeosetAnims?.find(item => item.GeosetId === replacedGeosets[offset]);
    animation.Alpha = replacement ? structuredClone(replaced?.Alpha ?? 1) : standardVisibility(next, index);
    if (replaced?._MdxDefaults?.Alpha !== undefined) animation._MdxDefaults = { ...animation._MdxDefaults, Alpha: replaced._MdxDefaults.Alpha };
  });
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
  for (const index of geosetIndices) fillSequenceExtents(next, next.Geosets[index]);
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
      vertices.push({ position: Array.from(geoset.Vertices.subarray(id * 3, id * 3 + 3)), group: [...group], skin, materialId: geoset.MaterialID, geoset: Number(key) });
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

/** Returns the replaced geoset most of this geoset's vertices took their binding from. */
function inheritPartBindings(geoset, donors, version) {
  const count = geoset.Vertices.length / 3, weighted = donors.some(vertex => vertex.skin), sources = new Map();
  geoset.Groups = []; geoset.VertexGroup = new Uint8Array(count);
  if (weighted) geoset.SkinWeights = new (version >= 1400 ? Uint16Array : Uint8Array)(count * 8);
  else delete geoset.SkinWeights;
  for (let id = 0; id < count; id++) {
    let nearest = donors[0], distance = Infinity;
    for (const donor of donors) {
      const squared = donor.position.reduce((sum, value, axis) => sum + (value - geoset.Vertices[id * 3 + axis]) ** 2, 0);
      if (squared < distance) { distance = squared; nearest = donor; }
    }
    sources.set(nearest.geoset, (sources.get(nearest.geoset) || 0) + 1);
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
  return [...sources].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
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
  const donors = replacementVertices(target, selection);
  // Measure the actual selected geometry, not saved extents or vertex averages:
  // uneven tessellation must not pull the replacement away from its envelope.
  const incoming = { Vertices: source.Geosets.flatMap(geoset => Array.from(geoset.Vertices)) };
  const outgoing = { Vertices: donors.flatMap(vertex => vertex.position) };
  if (!incoming.Vertices.length) throw Error('This part has no vertices.');
  updateBounds(incoming); updateBounds(outgoing);
  const pivot = Array.from(incoming.MinimumExtent, (value, axis) => (value + incoming.MaximumExtent[axis]) / 2);
  const center = Array.from(outgoing.MinimumExtent, (value, axis) => (value + outgoing.MaximumExtent[axis]) / 2);
  // The Bit keeps its own size (owner rule); Scale in the vertex editor resizes it.
  return transformPart(source, { translation: center.map((value, axis) => value - pivot[axis]) });
}

// Replace each keyed track `pick` accepts with its value at `frame`; global
// loops freeze at their first frame.
function freezeTracks(owner, pick, frame, interval, globalSequences) {
  if (!owner || typeof owner !== 'object' || ArrayBuffer.isView(owner)) return;
  for (const [field, value] of Object.entries(owner)) {
    if (!value?.Keys) { freezeTracks(value, pick, frame, interval, globalSequences); continue; }
    if (!pick(value)) continue;
    const width = value.Keys[0]?.Vector?.length || 1;
    const fallback = owner._MdxDefaults?.[field] ?? (width === 1 ? field === 'Alpha' ? 1 : 0 : Array.from({ length: width }, (_, axis) => field === 'Scaling' || field === 'Color' || field === 'Rotation' && axis === 3 ? 1 : 0));
    owner[field] = sampleTrack(value, frame, { interval, globalSequences, globalTime: 0, fallback, quaternion: field === 'Rotation' });
    if (TEXTURE_SLOTS.includes(field)) owner[field] = Math.round(owner[field]);
    if (owner._MdxDefaults) {
      delete owner._MdxDefaults[field];
      if (!Object.keys(owner._MdxDefaults).length) delete owner._MdxDefaults;
    }
  }
}

/** What a Bit import brings: one RGB look from partRgbOptions (null is No RGB),
 * appearance frozen at that look's animation, and its global loops only when
 * the user applies them. Visibility is left to commitPart. */
export function partLook(source, { colors = null, sequenceIndex = -1, globals = false } = {}) {
  const sequence = source.Sequences?.[sequenceIndex];
  if (sequenceIndex !== -1 && !sequence) throw Error('Choose an available RGB animation.');
  const model = structuredClone(source), frame = sequence?.Interval[0] || 0;
  const kept = value => globals && isGlobalTrack(value, source);
  for (const animation of model.GeosetAnims || []) {
    const rgb = colors?.[animation.GeosetId];
    if (!kept(animation.Color)) {
      animation.Color = new Float32Array(rgb || [1, 1, 1]);
      animation.Flags = rgb ? animation.Flags | 2 : animation.Flags & ~2;
      if (animation._MdxDefaults) delete animation._MdxDefaults.Color;
    }
    if (!kept(animation.Alpha)) { animation.Alpha = 1; if (animation._MdxDefaults) delete animation._MdxDefaults.Alpha; }
    if (animation._MdxDefaults && !Object.keys(animation._MdxDefaults).length) delete animation._MdxDefaults;
  }
  for (const owner of [model.Materials, model.TextureAnims]) freezeTracks(owner, value => !kept(value), frame, sequence?.Interval, source.GlobalSequences);
  model.Sequences = [];
  for (const geoset of model.Geosets) geoset.Anims = [];
  return model;
}

export function previewPartReplacement(target, source, selection, look = null) {
  const model = structuredClone(target);
  if (!source) {
    replacementVertices(target, selection); removePartSelection(model, selection); recalculateExtents(model);
    return { model, geosetIndices: [] };
  }
  const result = commitPart(model, source, { replacement: selection, look });
  return { model, geosetIndices: result.geosetIndices };
}
