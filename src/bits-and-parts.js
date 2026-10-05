import { ensureDummyBone } from './dummy-bone.js';
import { importGeosets, openDocument, recalculateExtents } from './editor-document.js';
import { captureMeshSelection } from './mesh-clipboard.js';
import { createSequence, setSequenceName } from './sequence-editor.js';

const TEXTURE_SLOTS = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
export const partPathKey = value => String(value || '').replaceAll('/', '\\').toLowerCase();
const canonical = value => Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value, canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => JSON.stringify(canonical(value));
export const partTextureKey = texture => fingerprint({ ...texture, Image: partPathKey(texture.Image), ReplaceableId: texture.ReplaceableId || 0, Flags: texture.Flags || 0 });

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
export function commitPart(target, source, { animations = null } = {}) {
  if (!source?.Geosets?.length) throw Error('This model has no geosets to import.');
  if (source.Version !== target.Version) throw Error('BitsAndParts requires matching model formats. Convert a copy to the destination format first.');
  if (source.BindPoses?.length || target.BindPoses?.length) throw Error('Parts with bind-pose matrices require baking before import.');
  const next = structuredClone(target), staged = selectPartAnimations(source, animations);
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
      const index = next.Textures.findIndex(existing => existing.Image === texture.Image && partTextureKey(existing) === partTextureKey(texture));
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
    remapGlobals(material); maps.materials.set(id, reuse(next.Materials, material)); return maps.materials.get(id);
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
  const bone = ensureDummyBone(next, { weighted: staged.Geosets.some(geoset => geoset.SkinWeights?.length) });
  const start = next.Geosets.length, geosetIndices = [];
  for (const geoset of staged.Geosets) {
    const count = geoset.Vertices.length / 3;
    geoset.Groups = [[bone.ObjectId]]; geoset.TotalGroupsCount = 1; geoset.VertexGroup = new Uint8Array(count);
    if (geoset.SkinWeights?.length) { geoset.SkinWeights = new (next.Version >= 1400 ? Uint16Array : Uint8Array)(count * 8); for (let index = 0; index < count; index++) geoset.SkinWeights.set([bone.ObjectId, 0, 0, 0, 255, 0, 0, 0], index * 8); }
    geosetIndices.push(next.Geosets.push(geoset) - 1);
  }
  for (const animation of staged.GeosetAnims || []) if (Number.isInteger(animation.GeosetId) && staged.Geosets[animation.GeosetId]) { animation.GeosetId += start; remapGlobals(animation); next.GeosetAnims.push(animation); }
  recalculateExtents(next);
  for (const index of geosetIndices) { const geoset = next.Geosets[index]; geoset.Anims = (next.Sequences || []).map(() => ({ MinimumExtent: geoset.MinimumExtent.slice(), MaximumExtent: geoset.MaximumExtent.slice(), BoundsRadius: geoset.BoundsRadius })); }
  if (next.Info) Object.assign(next.Info, { NumGeosets: next.Geosets.length, NumGeosetAnims: next.GeosetAnims.length, NumBones: next.Bones.length });
  Object.assign(target, next);
  return { geosetIndices, sequenceIndices, boneId: bone.ObjectId, materialMap: Object.fromEntries(maps.materials), textureMap: Object.fromEntries(maps.textures) };
}
