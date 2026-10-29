import { visitTextureReferences } from './texture-references.js';
import { stableKey } from './value-key.js';
import { gamePathKey } from './game-path.js';

const clone = value => structuredClone(value);
export const partTextureKey = texture => stableKey({ ...texture, Image: gamePathKey(texture.Image), ReplaceableId: texture.ReplaceableId || 0, Flags: texture.Flags || 0 });
const errors = {
  cycle: () => 'Source hierarchy contains a cycle.',
  node: id => `Source rig references missing node ${id}.`,
  global: () => 'Source track references a missing global sequence.',
  texture: id => `Source material references missing texture ${id}.`,
  material: id => `Source geoset references missing material ${id}.`,
  textureAnim: () => 'Source material references a missing texture animation.',
};

/** Resource closure and ID remapping only. Callers retain node creation, timing
 * and appearance policy. These options deliberately preserve the existing
 * differences between import, particles, node paste and BitsAndParts. */
export function createResourceImporter(source, target, {
  reuseTextures = 'fingerprint', reuseGlobals = false,
  validGlobalId = (id, model) => model.GlobalSequences[id] !== undefined,
  keyArrayType = 'keep', fingerprint = stableKey,
  reuseMaterials = false, reuseTextureAnims = false,
  materialKey = fingerprint, existingMaterial = () => -1,
  isGlobalRef = value => value.GlobalSeqId != null && value.GlobalSeqId !== -1,
  validateMappedGlobals = false, localTrack,
  isTextureAnimRef = id => id != null && id !== -1,
  materialSentinels = false, requireLayers = false, defaultsAfterSlots = false,
  cloneTexture = clone, nodeForId = id => source.Nodes?.[id],
  parentForNode = node => node.Parent,
  error = (kind, id) => errors[kind](id),
} = {}) {
  const maps = { textures: new Map(), materials: new Map(), textureAnims: new Map(), globals: new Map(), nodes: new Map() };
  const requiredNodes = new Set(), visiting = new Set();
  const fail = (kind, id) => { throw new Error(error(kind, id)); };
  function requireNode(id) {
    if (requiredNodes.has(id)) return;
    if (visiting.has(id)) fail('cycle', id);
    const node = nodeForId(id); if (!node) fail('node', id);
    visiting.add(id);
    const parent = parentForNode(node);
    if (parent != null && parent !== -1) requireNode(parent);
    visiting.delete(id); requiredNodes.add(id);
  }
  const reuse = (collection, value, key = fingerprint) => {
    const identity = key(value), index = collection.findIndex(item => key(item) === identity);
    return index < 0 ? collection.push(value) - 1 : index;
  };
  function globalRef(value) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (isGlobalRef(value)) {
      const old = value.GlobalSeqId;
      if ((validateMappedGlobals || !maps.globals.has(old)) && !validGlobalId(old, source)) fail('global', old);
      if (!maps.globals.has(old)) {
        const duration = source.GlobalSequences[old];
        maps.globals.set(old, reuseGlobals ? reuse(target.GlobalSequences, duration) : target.GlobalSequences.push(duration) - 1);
      }
      value.GlobalSeqId = maps.globals.get(old);
    } else localTrack?.(value);
    for (const child of Object.values(value)) globalRef(child);
  }
  function textureRef(old) {
    if (old == null || old === -1) return old;
    if (!source.Textures?.[old]) fail('texture', old);
    if (!maps.textures.has(old)) {
      const sourceTexture = source.Textures[old], key = reuseTextures === 'partKey' ? partTextureKey : fingerprint;
      const existing = reuseTextures === 'never' ? -1 : target.Textures.findIndex(texture => key(texture) === key(sourceTexture));
      maps.textures.set(old, existing >= 0 ? existing : target.Textures.push(cloneTexture(sourceTexture)) - 1);
    }
    return maps.textures.get(old);
  }
  function textureAnimRef(old) {
    if (!source.TextureAnims?.[old]) fail('textureAnim', old);
    if (!maps.textureAnims.has(old)) {
      const animation = clone(source.TextureAnims[old]); globalRef(animation);
      maps.textureAnims.set(old, reuseTextureAnims ? reuse(target.TextureAnims, animation) : target.TextureAnims.push(animation) - 1);
    }
    return maps.textureAnims.get(old);
  }
  function materialRef(old) {
    if (materialSentinels && (old == null || old === -1)) return old;
    if (!source.Materials?.[old]) fail('material', old);
    if (!maps.materials.has(old)) {
      const existing = existingMaterial(old);
      if (existing >= 0) { maps.materials.set(old, existing); return existing; }
      const material = clone(source.Materials[old]);
      for (const layer of requireLayers ? material.Layers : material.Layers || []) {
        visitTextureReferences({ Materials: [{ Layers: [layer] }] }, (id, set) => set(textureRef(id)), { arrayType: keyArrayType === 'int32' ? Int32Array : undefined, defaultsAfterSlots });
        if (isTextureAnimRef(layer.TVertexAnimId)) layer.TVertexAnimId = textureAnimRef(layer.TVertexAnimId);
      }
      globalRef(material);
      maps.materials.set(old, reuseMaterials ? reuse(target.Materials, material, materialKey) : target.Materials.push(material) - 1);
    }
    return maps.materials.get(old);
  }
  return { requireNode, requiredNodes, globalRef, textureRef, materialRef, textureAnimRef, maps };
}