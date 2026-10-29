// Frozen from origin/main a953a6949db1bf1e47303e517766b15062a19c60 for WP-3.3 identity tests.
// Function bodies are unchanged; imports point to the shared source dependencies.
import { TEXTURE_SLOTS } from '../../../src/mdx-compatibility.js';
import { MODEL_COMMENTS_KEY, readModelComments, writeModelComments } from '../../../src/model-comments.js';
import { versionConversionIssues, normalizeVersionFields, hdContentIssues, hdContentKind, clearHDMaterialSettings, HD_VIEW_ONLY_MESSAGE } from '../../../src/model-version.js';
import { adaptPasteFormat } from '../../../src/paste-format.js';
import { Buffer } from 'buffer';
import { parseMDL, generateMDL } from 'war3-model';
import { parseCompatibleMdx as parseMDX, generateCompatibleMdx as generateMDX, omitEmptyMdxNodeTracks } from '../../../src/mdx-compatibility.js';
import { prepareCompatibleMdl, finishCompatibleMdl, formatGeneratedMdl, readMdlPivotPoints } from '../../../src/mdl-compatibility.js';
import { canonicalizeSerializedNodeOrder, serializedNodes, SERIALIZED_NODE_COLLECTIONS } from '../../../src/node-id-order.js';
import { assertModelEquivalent, formatSaveIssues } from '../../../src/save-equivalence.js';
import { preserveMdxRecords, preserveMdlRecords } from '../../../src/record-preservation.js';
import { parseMdx, SUPPORTED_FORMAT_VERSIONS } from '../../../src/mdx-container.js';
import { parseMdl, mdlStringEnd } from '../../../src/mdl-lossless.js';
import { HistoryStore, createChanges, applyChanges } from '../../../src/history-store.js';
import { prepareMdlEventObject, restoreMdxEventGlobalSequences, writeMdlEventGlobalSequences, writeMdxEventGlobalSequences } from '../../../src/event-object-codec.js';
import { prepareMdlPopcornColors, restoreMdlPopcornRotations } from '../../../src/popcorn-rotation-codec.js';
import { writeMdlUVSets } from '../../../src/uv-coordinate-codec.js';
import { convertMdxGeosetColorTracks } from '../../../src/geoset-color-codec.js';
import { geosetColorExportIssues, prepareGeosetAnimationColors, mdlDroppedGeosetColors } from '../../../src/geoset-animation-defaults.js';
// Editor-only MDX chunks the game ignores (MDVI: MDLVis editor data). A format
// conversion may leave them out instead of refusing to save.
export const EDITOR_ONLY_CHUNKS = new Set(['MDVI']);
import { GEOSET_TABS_KEY, GEOSET_TAB_KEY, geosetTabsData, normalizeGeosetTabs, readGeosetTabs, writeGeosetTabs, isGeosetTabsChunk } from '../../../src/geoset-tabs.js';
import { ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS, stripAnimationSpeed, isAnimationSpeedChunk } from '../../../src/animation-speed.js';

import { createNode, appendGeosetGeometry, recalculateExtents, MODEL_COUNT_FIELDS } from '../../../src/editor-document.js';
const V3 = (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]);
const clone = (value) => structuredClone(value);
export const NODE_TYPES = Object.freeze({
  Bone: ['Bones', 'BONE', 256], Helper: ['Helpers', 'HELP', 0],
  Attachment: ['Attachments', 'ATCH', 2048], Light: ['Lights', 'LITE', 512],
  EventObject: ['EventObjects', 'EVTS', 1024], CollisionShape: ['CollisionShapes', 'CLID', 8192],
  ParticleEmitter: ['ParticleEmitters', 'PREM', 4096],
  ParticleEmitter2: ['ParticleEmitters2', 'PRE2', 4096],
  RibbonEmitter: ['RibbonEmitters', 'RIBB', 16384],
  ParticleEmitterPopcorn: ['ParticleEmitterPopcorns', 'CORN', 4096],
});
const SECTION_TYPES = {
  Version: ['Version', 'VERS'], Info: ['Model', 'MODL'],
  Sequences: ['Sequences', 'SEQS'], GlobalSequences: ['GlobalSequences', 'GLBS'],
  Materials: ['Materials', 'MTLS'], Textures: ['Textures', 'TEXS'],
  TextureAnims: ['TextureAnims', 'TXAN'], Geosets: ['Geoset', 'GEOS'],
  GeosetAnims: ['GeosetAnim', 'GEOA'], PivotPoints: ['PivotPoints', 'PIVT'],
  Cameras: ['Camera', 'CAMS'], FaceFX: ['FaceFX', 'FAFX'], BindPoses: ['BindPose', 'BPOS'],
  Gliders: ['Glider', 'DILG'],
  ...Object.fromEntries(Object.entries(NODE_TYPES).map(([name, [key, tag]]) => [key, [name, tag]])),
};
const MDL_TO_KEY = Object.fromEntries(Object.entries(SECTION_TYPES).map(([k, v]) => [v[0], k]));
const nodeCollections = (model) => Object.values(NODE_TYPES).flatMap(([key]) => model[key] || []);
const fingerprint = (value) => JSON.stringify(value, (key, val) => {
  if ([GEOSET_TAB_KEY, ANIMATION_SPEED_KEY, ANIMATION_SPEED_FRAME, ANIMATION_SPEED_EVENTS].includes(key)) return undefined;
  if (ArrayBuffer.isView(val)) return { $type: val.constructor.name, $data: Array.from(val) };
  if (typeof val === 'number' && !Number.isFinite(val)) return { $number: String(val) };
  return val;
});
function normalizeModel(model, previous) {
  for (const key of Object.keys(SECTION_TYPES)) {
    if (key !== 'Version' && key !== 'Info' && model[key] == null) model[key] = [];
  }
  model.Nodes = [];
  for (const node of nodeCollections(model)) {
    const id = node.ObjectId;
    if (!Number.isInteger(id) || id < 0 || id > 1000000) continue;
    if (node.Parent === undefined) node.Parent = null;
    const previousNode = previous?.Nodes?.[id];
    const oldPivot = previous?.PivotPoints?.[id];
    const nodePivotChanged = previousNode && fingerprint(previousNode.PivotPoint) !== fingerprint(node.PivotPoint);
    const arrayPivotChanged = oldPivot && fingerprint(oldPivot) !== fingerprint(model.PivotPoints[id]);
    if (nodePivotChanged && !arrayPivotChanged) model.PivotPoints[id] = node.PivotPoint;
    if (!model.PivotPoints[id]) model.PivotPoints[id] = node.PivotPoint || V3();
    node.PivotPoint = model.PivotPoints[id];
    model.Nodes[id] = node;
  }
  // Pivot arrays require entries for unused IDs too; these are reserved zero pivots.
  for (let i = 0; i < model.PivotPoints.length; i++) model.PivotPoints[i] ||= V3();
  const visited = new Set();
  function normalizeTracks(value) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value.Keys)) {
      if (value.GlobalSeqId === undefined) value.GlobalSeqId = null;
      // Keyframe values and tangents do not contain nested animation tracks.
      // Normalize track metadata once without visiting every baked sample.
      return;
    }
    for (const child of Object.values(value)) normalizeTracks(child);
  }
  normalizeTracks(model);
  for (const material of model.Materials) for (const layer of material.Layers || []) {
    if (layer.TVertexAnimId === undefined) layer.TVertexAnimId = null;
    layer.CoordId ??= 0; layer.FilterMode ??= 0; layer.Shading ??= 0;
  }
  for (const node of model.Bones) { node.GeosetId ??= null; node.GeosetAnimId ??= null; }
  for (const node of model.Lights) { node.QuadraticFalloff ??= 0.0005; node.LinearFalloff ??= 0; node.Damping ??= 0.00001; }
  for (const [i, geoset] of model.Geosets.entries()) {
    if (previous && fingerprint(previous.Geosets[i]?.Faces) !== fingerprint(geoset.Faces) && geoset.PrimitiveCounts && Array.from(geoset.PrimitiveCounts).reduce((sum,n)=>sum+n,0) !== geoset.Faces.length) {
      geoset.PrimitiveTypes = Uint32Array.of(4); geoset.PrimitiveCounts = Uint32Array.of(geoset.Faces.length);
    }
  }
  // The MDL writer omits these zero-valued emitter fields. Its parser leaves
  // them absent, but the MDX writer requires numbers (undefined becomes NaN).
  for (const node of model.ParticleEmitters2) for (const field of ['TailLength', 'Time', 'LifeSpan', 'PriorityPlane', 'ReplaceableId', 'Rows', 'Columns']) node[field] ??= 0;
  for (const node of model.ParticleEmitters) for (const field of ['EmissionRate','Gravity','Longitude','Latitude','LifeSpan','InitVelocity']) node[field] ??= 0;
  for (const node of model.ParticleEmitterPopcorns) {
    for (const field of ['LifeSpan','EmissionRate','Speed','Alpha']) node[field] ??= 1;
    node.ReplaceableId ??= 0; node.Path ??= ''; node.AnimVisibilityGuide ??= ''; node.Color ??= V3(1,1,1);
  }
  for (const node of model.RibbonEmitters) {
    node.HeightAbove ??= 0; node.HeightBelow ??= 0; node.Alpha ??= 1; node.TextureSlot ??= 0;
  }
  for (const item of [model.Info, ...model.Sequences, ...model.Geosets, ...model.Geosets.flatMap(g=>g.Anims || [])]) if (item) {
    item.MinimumExtent ||= V3(); item.MaximumExtent ||= V3(); item.BoundsRadius ??= 0;
  }
  if (model.Info) model.Info.BlendTime ??= 0;
  for (const texture of model.Textures) { texture.Image ??= ''; texture.ReplaceableId ??= 0; texture.Flags ??= 0; }
  for (const node of model.ParticleEmitters2) node.Squirt = !!node.Squirt;
  updateCounts(model);
  normalizeGeosetTabs(model);
}

function updateCounts(model) {
  for (const [field, key] of Object.entries(MODEL_COUNT_FIELDS)) model.Info[field] = model[key]?.length || 0;
}
// The key value used most often (earliest wins a tie).
function mostCommonKeyValue(track) {
  const counts = new Map();
  for (const key of track.Keys) {
    const id = Array.from(key.Vector, v => Math.round(v * 1e4)).join(',');
    const entry = counts.get(id) || counts.set(id, { value: key.Vector, count: 0 }).get(id);
    entry.count++;
  }
  let best = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return best?.value;
}
/** Parts pasted from another model take one RGB, the geoset's most common, and
 * never bring a global sequence along on their geoset animation. */
function flattenPastedGeosetAnimation(anim) {
  const flatten = (property, keep) => {
    const track = anim[property];
    if (!track?.Keys || keep(track)) return;
    const value = mostCommonKeyValue(track) ?? anim._MdxDefaults?.[property];
    if (value == null) delete anim[property];
    else anim[property] = property === 'Color' ? new Float32Array(value) : (value.length ? value[0] : value);
    if (anim._MdxDefaults) { delete anim._MdxDefaults[property]; if (!Object.keys(anim._MdxDefaults).length) delete anim._MdxDefaults; }
  };
  flatten('Color', () => false);
  flatten('Alpha', track => track.GlobalSeqId == null || track.GlobalSeqId === -1);
}

/** Append selected geometry with its required rig, textures and animation dependencies. */
export function importGeosets(target, source, selectedIndices = source.Geosets.map((_, i) => i), anchor = null, { sameModel = false, targetGeoset = null, rigidNode = null, existingNodeMap = null, flattenGeosetAnimations = false, newGeosets = false } = {}) {
  source = adaptPasteFormat(source, target.Version);
  if (anchor && typeof anchor === 'object') anchor = anchor.ObjectId;
  if (anchor != null && !target.Nodes?.[anchor]) throw new Error('The destination anchor node does not exist.');
  if (rigidNode && typeof rigidNode === 'object') rigidNode = rigidNode.ObjectId;
  if (rigidNode != null && !target.Nodes?.[rigidNode]) throw new Error('The rigid paste anchor node does not exist.');
  const rigid = rigidNode != null, reuseExisting = sameModel && anchor == null && !rigid;
  const indices = [...new Set(selectedIndices)];
  if (!indices.length) return { geosetIndices: [], selection: {}, nodeMap: {}, materialMap: {}, textureMap: {}, warnings: [] };
  for (const index of indices) if (!source.Geosets?.[index]) throw new Error(`Source geoset ${index} does not exist.`);
  const neededNodes = new Set(); const visiting = new Set();
  function requireNode(id) {
    if (neededNodes.has(id)) return;
    if (visiting.has(id)) throw new Error('Source hierarchy contains a cycle.');
    const node = source.Nodes?.[id]; if (!node) throw new Error(`Source rig references missing node ${id}.`);
    visiting.add(id);
    if (node.Parent != null && node.Parent !== -1) requireNode(node.Parent);
    visiting.delete(id); neededNodes.add(id);
  }
  for (const index of indices) {
    const g = source.Geosets[index];
    if (!rigid) {
      for (const id of (g.Groups || []).flat()) requireNode(id);
      for (let i = 0; i < (g.SkinWeights?.length || 0); i += 8) for (let k = 0; k < 4; k++) if (g.SkinWeights[i + 4 + k]) requireNode(g.SkinWeights[i + k]);
    }
  }
  const maps = { textures: new Map(), materials: new Map(), textureAnims: new Map(), globals: new Map(), nodes: new Map(), geosets: new Map(), geosetAnims: new Map() };
  const createdNodes = new Set(), createdGeosets = new Set(), selections = new Map();
  const globalRef = (value) => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (value.GlobalSeqId != null && value.GlobalSeqId !== -1) {
      const old = value.GlobalSeqId;
      if (!maps.globals.has(old)) { if (source.GlobalSequences[old] === undefined) throw new Error('Source track references a missing global sequence.'); maps.globals.set(old, target.GlobalSequences.push(source.GlobalSequences[old]) - 1); }
      value.GlobalSeqId = maps.globals.get(old);
    }
    for (const child of Object.values(value)) globalRef(child);
  };
  const textureRef = (old) => {
    if (old == null || old === -1) return old;
    if (!source.Textures[old]) throw new Error(`Source material references missing texture ${old}.`);
    if (!maps.textures.has(old)) {
      const sourceTexture = source.Textures[old]; const existing = target.Textures.findIndex((t) => fingerprint(t) === fingerprint(sourceTexture));
      maps.textures.set(old, existing >= 0 ? existing : target.Textures.push(clone(sourceTexture)) - 1);
    }
    return maps.textures.get(old);
  };
  const materialRef = (old) => {
    if (!source.Materials[old]) throw new Error(`Source geoset references missing material ${old}.`);
    if (!maps.materials.has(old)) {
      if (reuseExisting) {
        const original = fingerprint(target.Materials[old]) === fingerprint(source.Materials[old]) ? old : -1;
        const existing = original >= 0 ? original : target.Materials.findIndex((material) => fingerprint(material) === fingerprint(source.Materials[old]));
        if (existing >= 0) { maps.materials.set(old, existing); return existing; }
      }
      const material = clone(source.Materials[old]);
      for (const layer of material.Layers) {
        for (const slot of TEXTURE_SLOTS) if (typeof layer[slot] === 'number') layer[slot] = textureRef(layer[slot]);
        else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) { key.Vector = new Int32Array([...key.Vector].map(textureRef)); if (key.InTan) key.InTan = new Int32Array([...key.InTan].map(textureRef)); if (key.OutTan) key.OutTan = new Int32Array([...key.OutTan].map(textureRef)); }
        for (const slot of TEXTURE_SLOTS) if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = textureRef(layer._MdxDefaults[slot]);
        const texAnim = layer.TVertexAnimId;
        if (texAnim != null && texAnim !== -1) {
          if (!source.TextureAnims[texAnim]) throw new Error('Source material references a missing texture animation.');
          if (!maps.textureAnims.has(texAnim)) { const animation = clone(source.TextureAnims[texAnim]); globalRef(animation); maps.textureAnims.set(texAnim, target.TextureAnims.push(animation) - 1); }
          layer.TVertexAnimId = maps.textureAnims.get(texAnim);
        }
      }
      globalRef(material);
      // A rigid import has a separate dependency table. Compare only after
      // texture, texture-animation and global-sequence IDs are remapped.
      const existing = rigid ? target.Materials.findIndex(candidate => fingerprint(candidate) === fingerprint(material)) : -1;
      maps.materials.set(old, existing >= 0 ? existing : target.Materials.push(material) - 1);
    }
    return maps.materials.get(old);
  };
  for (const id of neededNodes) {
    if (reuseExisting) {
      const destinationId = existingNodeMap?.get(id) ?? id;
      if (!target.Nodes?.[destinationId]) throw new Error(`The original pasted bone or node ${id} no longer exists in this model.`);
      maps.nodes.set(id, destinationId);
      continue;
    }
    const original = source.Nodes[id];
    const type = Object.keys(NODE_TYPES).find((name) => source[NODE_TYPES[name][0]]?.some((n) => n.ObjectId === id));
    const created = createNode(target, type);
    maps.nodes.set(id, created.ObjectId);
    createdNodes.add(id);
    const newID = created.ObjectId;
    Object.assign(created, clone(original), { ObjectId: newID, Parent: original.Parent == null || original.Parent === -1 ? anchor : maps.nodes.get(original.Parent), Name: `${original.Name}_import` });
    created.PivotPoint = clone(source.PivotPoints[id] || original.PivotPoint || V3()); target.PivotPoints[newID] = created.PivotPoint;
    for (const [index, pose] of (target.BindPoses || []).entries()) if (source.BindPoses?.[index]?.Matrices?.[id]) pose.Matrices[newID] = clone(source.BindPoses[index].Matrices[id]);
    if (type === 'Bone') { created.GeosetId = null; created.GeosetAnimId = null; }
    if (type === 'ParticleEmitter2') created.TextureID = textureRef(created.TextureID);
    if (type === 'RibbonEmitter') created.MaterialID = materialRef(created.MaterialID);
    globalRef(created);
  }
  for (const index of indices) {
    const g = clone(source.Geosets[index]);
    g.MaterialID = materialRef(g.MaterialID);
    if (!g.Faces.length) { g.PrimitiveTypes = new Uint32Array(); g.PrimitiveCounts = new Uint32Array(); }
    if (rigid) {
      const count = g.Vertices.length / 3;
      g.Groups = [[rigidNode]]; g.TotalGroupsCount = 1; g.VertexGroup = new Uint8Array(count);
      if (g.SkinWeights?.length) {
        const maximum = target.Version >= 1400 ? 65535 : 255;
        if (rigidNode > maximum) throw new Error(`DummyBone must have an object ID from 0 to ${maximum} for weighted geometry.`);
        g.SkinWeights = new (target.Version >= 1400 ? Uint16Array : Uint8Array)(count * 8);
        for (let vertex = 0; vertex < count; vertex++) g.SkinWeights.set([rigidNode, 0, 0, 0, 255, 0, 0, 0], vertex * 8);
      }
    } else {
      g.Groups = g.Groups.map((group) => group.map((id) => maps.nodes.get(id)));
      // Widen before assigning destination IDs, which can exceed a donor's
      // eight-bit range. Keep the donor width until remapping when narrowing.
      if (g.SkinWeights?.length && target.Version >= 1400) g.SkinWeights = Uint16Array.from(g.SkinWeights);
      for (let i = 0; i < (g.SkinWeights?.length || 0); i += 8) for (let k = 0; k < 4; k++) {
        if (g.SkinWeights[i + 4 + k]) {
          const mapped = maps.nodes.get(g.SkinWeights[i + k]);
          if (mapped > (target.Version >= 1400 ? 65535 : 255)) throw new Error('Imported weighted skin would exceed the format bone-index capacity.');
          g.SkinWeights[i + k] = mapped;
        } else g.SkinWeights[i + k] = 0;
      }
      if (g.SkinWeights?.length) g.SkinWeights = (target.Version >= 1400 ? Uint16Array : Uint8Array).from(g.SkinWeights);
    }
    const requestedTarget = indices.length === 1 && Number.isInteger(targetGeoset) && targetGeoset >= 0 ? targetGeoset : index;
    const destination = reuseExisting && !newGeosets && target.Geosets[requestedTarget]?.MaterialID === g.MaterialID ? requestedTarget : null;
    if (destination != null) {
      const added = appendGeosetGeometry(target.Geosets[destination], g);
      maps.geosets.set(index, destination);
      selections.set(destination, [...(selections.get(destination) || []), ...added]);
    } else {
      const added = target.Geosets.push(g) - 1;
      maps.geosets.set(index, added); createdGeosets.add(index);
      selections.set(added, Array.from({ length: g.Vertices.length / 3 }, (_, vertex) => vertex));
    }
  }
  for (const [index, anim] of source.GeosetAnims.entries()) if (createdGeosets.has(anim.GeosetId)) {
    const copy = clone(anim); copy.GeosetId = maps.geosets.get(anim.GeosetId);
    if (flattenGeosetAnimations) flattenPastedGeosetAnimation(copy);
    globalRef(copy);
    maps.geosetAnims.set(index, target.GeosetAnims.push(copy) - 1);
  }
  for (const old of createdNodes) {
    const id = maps.nodes.get(old);
    const original = source.Nodes[old], node = target.Nodes[id];
    if ('GeosetId' in original) node.GeosetId = maps.geosets.get(original.GeosetId) ?? null;
    if ('GeosetAnimId' in original) node.GeosetAnimId = maps.geosetAnims.get(original.GeosetAnimId) ?? null;
  }
  normalizeModel(target); updateCounts(target); recalculateExtents(target);
  const warnings = reuseExisting && !maps.textureAnims.size ? [] : ['Imported animation keys retain their source frame times. Destination sequence definitions are unchanged; align intervals when needed.'];
  if (rigid) warnings.push('Pasted geometry is rigidly attached to DummyBone.');
  else if (anchor != null) warnings.push('Imported roots are parented to the anchor; its transforms now affect the imported rig.');
  return { geosetIndices: [...new Set(maps.geosets.values())], geosetMap: Object.fromEntries(maps.geosets), selection: Object.fromEntries(selections), nodeMap: Object.fromEntries(maps.nodes), materialMap: Object.fromEntries(maps.materials), textureMap: Object.fromEntries(maps.textures), warnings };
}
