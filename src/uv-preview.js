import { TEXTURE_SLOTS } from './mdx-compatibility.js';
import { sampleTrack } from './animation.js';
import { materialPreset } from './material-presets.js';
import { partMaterialKey } from './bits-and-parts.js';
import { gamePathKey } from './game-path.js';


export function getUVPreviewSelection(model, selection) {
  const indices = typeof selection === 'number' ? [selection] : Array.from(selection || []);
  const geosetIndices = [...new Set(indices)];
  const result = { enabled: false, reason: '', geosetIndices, materialID: null };
  if (!geosetIndices.length) return { ...result, reason: 'Check one geoset, or geosets using the same material, to preview a texture.' };
  if (geosetIndices.some(index => !Number.isSafeInteger(index) || index < 0 || !model.Geosets[index])) return { ...result, reason: 'The geoset selection changed. Select the geosets again.' };
  const materialID = model.Geosets[geosetIndices[0]].MaterialID;
  if (geosetIndices.some(index => model.Geosets[index].MaterialID !== materialID)) return { ...result, reason: 'Selected geosets use different materials. Select geosets using the same material.' };
  if (!Number.isSafeInteger(materialID) || materialID < 0 || !model.Materials[materialID]) return { ...result, reason: 'The selected geosets need a valid material before previewing a texture.' };
  return { ...result, materialID, enabled: true };
}

// UVs should show an actual image, never a procedural replaceable/team-colour
// layer. Sampling the texture track keeps the UV image in step with playback.
export function imageTextureLayers(model, geosetIndex, time = 0, sequenceIndex = -1) {
  const geoset = model.Geosets[geosetIndex], material = model.Materials[geoset?.MaterialID];
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  return (material?.Layers || []).flatMap((layer, layerIndex) => {
    const sampled = sampleTrack(layer.TextureID, time, { interval, globalSequences: model.GlobalSequences, fallback: -1 });
    const textureID = Math.round(Number(sampled)), texture = model.Textures[textureID];
    if (!texture || texture.ReplaceableId || !String(texture.Image || '').trim()) return [];
    const coordId = Number.isSafeInteger(layer.CoordId) && layer.CoordId >= 0 ? layer.CoordId : 0;
    const path = texture.Image, leaf = path.split(/[\\/]/).at(-1);
    return [{ layerIndex, textureID, path, coordId, label: `Layer ${layerIndex + 1} · ${leaf}` }];
  });
}

export function chooseUVImageLayer(model, geosetIndex, selectedLayer, time = 0, sequenceIndex = -1) {
  const layers = imageTextureLayers(model, geosetIndex, time, sequenceIndex);
  return layers.find(layer => layer.layerIndex === selectedLayer) || layers[0] || null;
}

function layerTextureIDs(layer) {
  const value = layer?.TextureID;
  return typeof value === 'number' ? [value] : Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : (value?.Keys || []).flatMap(key => Array.from(key.Vector || []));
}

function layerHasImage(model, layer) {
  return layerTextureIDs(layer).some(id => { const texture = model.Textures[Math.round(id)]; return texture && !texture.ReplaceableId && String(texture.Image || '').trim(); });
}

function replaceableLayer(model, layer) {
  const ids = layerTextureIDs(layer);
  return ids.length > 0 && ids.every(id => model.Textures[Math.round(id)]?.ReplaceableId);
}

// Replace every ordinary image reference, including animated texture IDs, while
// retaining authored filters, shading, alpha and texture animation. A fixed
// Color Tint pass and procedural layers keep their own texture assignments.
function replaceTextureChain(model, materialID, material, textureID) {
  const fixedTint = materialPreset(model, materialID).preset === 'Color Tint';
  let replaced = false;
  for (const [index, layer] of (material.Layers || []).entries()) {
    if (!layerHasImage(model, layer) || fixedTint && index === 1) continue;
    layer.TextureID = textureID;
    replaced = true;
  }
  if (!replaced) {
    material.Layers ||= [];
    const replaceable = material.Layers.some(layer => replaceableLayer(model, layer));
    material.Layers.push({ FilterMode: replaceable ? 1 : 0, Alpha: 1, Shading: 0, CoordId: 0, TextureID: textureID, TVertexAnimId: null });
  }
}

// Only the texture assignment is provisional. UV and geometry edits belong
// to the document undo history and are preserved when the texture is reverted.
// material: an existing material index to assign as-is, 'new' for a separate
// copy, or omitted for the ordinary in-place replacement.
export function beginUVPreview(model, drafts, selection, asset, { material } = {}) {
  const checked = getUVPreviewSelection(model, selection);
  if (!checked.enabled) throw Error(checked.reason);
  if (!asset?.name || !asset.bytes?.byteLength) throw Error('Choose a readable texture.');
  if (material != null && !validMaterialChoice(model, material)) throw Error('The chosen material is no longer in the model.');
  const pending = checked.geosetIndices.map(geosetIndex => {
    const previous = drafts[geosetIndex];
    if (previous) validateUVPreview(model, previous);
    return { geosetIndex };
  });
  const next = { ...drafts };
  for (const {geosetIndex} of pending) next[geosetIndex] = {
    geosetIndex,
    asset: { name: asset.name, bytes: new Uint8Array(asset.bytes), source: asset.source || 'library' },
    ...(material != null ? { material } : {}),
  };
  return next;
}

export function validateUVPreview(model, draft) {
  const geoset = model.Geosets[draft.geosetIndex];
  if (!geoset) throw Error(`Geoset ${draft.geosetIndex + 1} no longer exists during texture preview.`);
  return geoset;
}

// An index must still address the same preview target. Geometry and UV
// streams may change freely; only the texture assignment is provisional.
export function captureUVPreviewGuard(model, drafts) {
  return Object.keys(drafts || {}).length ? Object.values(drafts).map(draft => ({
    index: draft.geosetIndex, geoset: model.Geosets[draft.geosetIndex],
  })) : null;
}

export function validateUVPreviewGuard(model, drafts, beforeGeosets = null) {
  if (!Object.keys(drafts || {}).length) return;
  if (beforeGeosets?.some(({ index, geoset }) => model.Geosets[index] !== geoset))
    throw Error('Save or Revert the temporary UV textures before deleting, replacing, or reindexing their geosets.');
  for (const draft of Object.values(drafts)) validateUVPreview(model, draft);
}

/** Index of an ordinary image texture already in the model, or -1. */
export function existingTextureIndex(model, imagePath) {
  return (model?.Textures || []).findIndex(texture => !texture.ReplaceableId && gamePathKey(texture.Image) === gamePathKey(imagePath));
}

/** Materials with any layer showing this texture, including animated texture IDs. */
export function materialsUsingTexture(model, textureID) {
  if (!(textureID >= 0)) return [];
  return (model?.Materials || []).flatMap((material, id) => (material?.Layers || []).some(layer => layerTextureIDs(layer).some(value => Math.round(value) === textureID)) ? [id] : []);
}

/** A new single-layer material for a texture that is already in the model. */
export function addTextureMaterial(model, textureID) {
  if (!model.Textures[textureID]) throw Error('The texture is no longer in the model.');
  return model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 0, TextureID: textureID, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] }) - 1;
}

const validMaterialChoice = (model, material) => material === 'new' || Number.isSafeInteger(material) && material >= 0 && !!model.Materials[material];

export function addLibraryTexture(model, asset) {
  if (!asset?.name) throw Error('The texture has no model path.');
  const found = model.Textures.findIndex(texture => !texture.ReplaceableId && gamePathKey(texture.Image) === gamePathKey(asset.name));
  if (found >= 0) return found;
  model.Textures.push({ Image: asset.name.replaceAll('/', '\\'), ReplaceableId: 0, Flags: 3 });
  return model.Textures.length - 1;
}

const materialOwners = model => [...model.Geosets, ...(model.RibbonEmitters || [])];

function remapTextureRefs(model, remap) {
  for (const material of model.Materials) for (const layer of material?.Layers || []) for (const owner of [layer, layer._MdxDefaults]) if (owner) for (const slot of TEXTURE_SLOTS) {
    const value = owner[slot];
    if (typeof value === 'number') owner[slot] = remap(value);
    else for (const key of value?.Keys || []) for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) for (let i = 0; i < key[field].length; i++) key[field][i] = remap(key[field][i]);
  }
  for (const emitter of model.ParticleEmitters2 || []) if (typeof emitter.TextureID === 'number') emitter.TextureID = remap(emitter.TextureID);
}

function usedTextures(model) {
  const used = new Set();
  remapTextureRefs(model, id => { if (id >= 0) used.add(Math.round(id)); return id; });
  return used;
}

const usedMaterials = model => new Set(materialOwners(model).map(owner => owner.MaterialID).filter(id => Number.isSafeInteger(id) && id >= 0));

// Drop only the materials and textures this replacement stopped using, so
// repeated replacements never accumulate entries. A new image takes over the
// slot its predecessor freed; entries that were already unused stay as authored.
function releaseReplaced(model, materialsBefore, texturesBefore, firstNewTexture) {
  const liveMaterials = usedMaterials(model);
  const droppedMaterials = new Set([...materialsBefore].filter(id => !liveMaterials.has(id)));
  if (droppedMaterials.size) {
    const index = new Map();
    model.Materials = model.Materials.filter((material, id) => { if (droppedMaterials.has(id)) return false; index.set(id, index.size); return true; });
    for (const owner of materialOwners(model)) if (index.has(owner.MaterialID)) owner.MaterialID = index.get(owner.MaterialID);
  }
  const liveTextures = usedTextures(model);
  const freed = [...texturesBefore].filter(id => id < firstNewTexture && !liveTextures.has(id)).sort((a, b) => a - b);
  const added = model.Textures.map((_, id) => id).filter(id => id >= firstNewTexture && liveTextures.has(id));
  const moved = new Map(), removed = new Set(freed);
  for (const [n, id] of added.slice(0, freed.length).entries()) {
    model.Textures[freed[n]] = model.Textures[id]; moved.set(id, freed[n]);
    removed.delete(freed[n]); removed.add(id);
  }
  for (let id = firstNewTexture; id < model.Textures.length; id++) if (!liveTextures.has(id)) removed.add(id);
  if (!removed.size) return;
  const index = new Map();
  model.Textures = model.Textures.filter((texture, id) => { if (removed.has(id)) return false; index.set(id, index.size); return true; });
  remapTextureRefs(model, id => { const target = moved.get(id) ?? id; return index.has(target) ? index.get(target) : id; });
}

// Checked geosets with the same replacement stay together on one material.
// Their material is edited in place when nothing else uses it, an identical
// existing material is reused, and only a shared material is copied so other
// users keep their texture and any animated texture track.
export function applyUVPreviews(model, drafts, { release = true } = {}) {
  const pending = Object.values(drafts);
  for (const draft of pending) validateUVPreview(model, draft);
  const materialsBefore = release && usedMaterials(model), texturesBefore = release && usedTextures(model), firstNewTexture = model.Textures.length;
  const groups = new Map();
  for (const draft of pending) {
    const geoset = model.Geosets[draft.geosetIndex], textureID = addLibraryTexture(model, draft.asset);
    // The user chose a material that already shows this texture.
    if (Number.isSafeInteger(draft.material) && model.Materials[draft.material]) { geoset.MaterialID = draft.material; continue; }
    const separate = draft.material === 'new', key = `${geoset.MaterialID}|${textureID}|${separate}`;
    if (!groups.has(key)) groups.set(key, { materialID: geoset.MaterialID, textureID, separate, geosets: [] });
    groups.get(key).geosets.push(geoset);
  }
  for (const { materialID, textureID, separate, geosets } of groups.values()) {
    if (separate) {
      const material = structuredClone(model.Materials[materialID] || { PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Alpha: 1, Shading: 0, CoordId: 0 }] });
      replaceTextureChain(model, materialID, material, textureID);
      const target = model.Materials.push(material) - 1;
      for (const geoset of geosets) geoset.MaterialID = target;
      continue;
    }
    const original = model.Materials[materialID];
    const material = structuredClone(original || {
      PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Alpha: 1, Shading: 0, CoordId: 0 }],
    });
    replaceTextureChain(model, materialID, material, textureID);
    const materialKey = value => { try { return partMaterialKey(model, value); } catch { return null; } };
    const key = materialKey(material);
    let target = key == null ? -1 : model.Materials.findIndex(existing => existing && materialKey(existing) === key);
    if (target < 0 && original && materialOwners(model).every(owner => owner.MaterialID !== materialID || geosets.includes(owner))) {
      model.Materials[materialID] = material; target = materialID;
    }
    if (target < 0) target = model.Materials.push(material) - 1;
    for (const geoset of geosets) geoset.MaterialID = target;
  }
  if (release) releaseReplaced(model, materialsBefore, texturesBefore, firstNewTexture);
  return pending.length;
}

export function revertUVPreviews(model, drafts) {
  const count = Object.keys(drafts).length;
  for (const index of Object.keys(drafts)) delete drafts[index];
  return count;
}

export function uvPreviewModel(model, drafts, liveUV = null) {
  const liveChanges = Array.isArray(liveUV) ? liveUV : liveUV ? [liveUV] : [];
  if (!Object.keys(drafts).length && !liveChanges.length) return model;
  const preview = { ...model, Geosets: model.Geosets.slice() };
  if (Object.keys(drafts).length) { preview.Textures = model.Textures.slice(); preview.Materials = model.Materials.slice(); }
  const validDrafts = {};
  for (const draft of Object.values(drafts)) {
    // The temporary material follows the live geometry, including topology edits.
    try { validateUVPreview(model, draft); } catch { continue; }
    preview.Geosets[draft.geosetIndex] = { ...model.Geosets[draft.geosetIndex] };
    validDrafts[draft.geosetIndex] = draft;
  }
  if (Object.keys(validDrafts).length) applyUVPreviews(preview, validDrafts, { release: false });
  for (const live of liveChanges) if (preview.Geosets[live?.geosetIndex]?.TVertices?.[live.uvSet] && live.values?.length === preview.Geosets[live.geosetIndex].TVertices[live.uvSet].length) {
    const geoset = { ...preview.Geosets[live.geosetIndex] };
    geoset.TVertices = geoset.TVertices.slice(); geoset.TVertices[live.uvSet] = live.values;
    preview.Geosets[live.geosetIndex] = geoset;
  }
  return preview;
}

export function restoreUVPreviews(model, drafts) {
  const restored = {};
  for (const [index, draft] of Object.entries(drafts || {})) {
    if (!draft || !Number.isSafeInteger(draft.geosetIndex) || draft.geosetIndex < 0 ||
        draft.layerIndex != null && (!Number.isSafeInteger(draft.layerIndex) || draft.layerIndex < 0) ||
        Number(index) !== draft.geosetIndex || !draft.asset?.name || !(draft.asset.bytes instanceof Uint8Array) || !draft.asset.bytes.byteLength)
      throw Error('Invalid cached UV preview.');
    // Older recovery records may contain UV snapshots; they are no longer
    // restored by Revert texture. The document retains their actual UV edits.
    restored[index] = { geosetIndex: draft.geosetIndex, asset: structuredClone(draft.asset), ...(validMaterialChoice(model, draft.material) ? { material: draft.material } : {}) };
  }
  return restored;
}
