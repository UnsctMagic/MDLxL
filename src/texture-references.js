import { TEXTURE_SLOTS } from './mdx-compatibility.js';
const textureSlots = TEXTURE_SLOTS;

/** The selected texture IDs, rather than spline tangents or saved defaults. */
export function layerTextureIds(model, layer) {
  const value = layer?.TextureID;
  return [...new Set(typeof value === 'number' ? [value] : (value?.Keys || []).flatMap(key => Array.from(key.Vector || [])))];
}

export function isTeamColorLayer(model, layer) {
  return layerTextureIds(model, layer).some(id => model.Textures?.[id]?.ReplaceableId === 1);
}

export function isTeamGlowLayer(model, layer) {
  return layerTextureIds(model, layer).some(id => model.Textures?.[id]?.ReplaceableId === 2);
}

// Callers that rebuild key arrays choose their original representation. Otherwise
// remap in place. Visit the active value before its default to preserve import order.
export function visitTextureReferences(model, visit, { arrayType, defaultsAfterSlots = false } = {}) {
  const defaultField = (owner, key) => {
    if (typeof owner._MdxDefaults?.[key] === 'number') visit(owner._MdxDefaults[key], next => { owner._MdxDefaults[key] = next; }, owner);
  };
  const field = (owner, key) => {
    const value = owner[key];
    if (typeof value === 'number') visit(value, next => { owner[key] = next; }, owner);
    else if (value?.Keys) for (const keyframe of value.Keys) for (const property of ['Vector', 'InTan', 'OutTan']) {
      const original = keyframe[property];
      const values = original && arrayType ? Array.from(original) : original;
      if (values) for (let i = 0; i < values.length; i++) visit(values[i], next => { values[i] = next; }, owner);
      if (original && arrayType) keyframe[property] = arrayType.from(values);
    }
    if (!defaultsAfterSlots) defaultField(owner, key);
  };
  for (const material of model.Materials || []) for (const layer of material.Layers || []) {
    for (const key of textureSlots) field(layer, key);
    if (defaultsAfterSlots) for (const key of textureSlots) defaultField(layer, key);
  }
  for (const node of model.ParticleEmitters2 || []) {
    field(node, 'TextureID');
    if (defaultsAfterSlots) defaultField(node, 'TextureID');
  }
}
