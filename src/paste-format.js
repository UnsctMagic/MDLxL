import { normalizeVersionFields } from './model-version.js';

const extraSlots = ['NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];

/** Adapt only the clipboard copy. Neither open document changes format. */
export function adaptPasteFormat(model, version) {
  if (model.Version === version) return model;
  const copy = structuredClone(model), originalVersion = copy.Version;
  for (const material of copy.Materials || []) {
    const oldHD = originalVersion < 1100 && material.Shader === 'Shader_HD_DefaultUnit';
    if (version >= 1100 && oldHD) {
      const layers = material.Layers, base = { ...layers[0], ShaderTypeId: 1 };
      if (base._MdxDefaults) base._MdxDefaults = { ...base._MdxDefaults };
      extraSlots.forEach((slot, index) => {
        if (!layers[index + 1]) return;
        base[slot] = layers[index + 1].TextureID;
        if (layers[index + 1]._MdxDefaults?.TextureID != null) (base._MdxDefaults ||= {})[slot] = layers[index + 1]._MdxDefaults.TextureID;
      });
      material.Layers = [base]; delete material.Shader;
    } else if (version >= 900 && version < 1100 && originalVersion >= 1100 && material.Layers.some(layer => layer.ShaderTypeId === 1)) {
      material.Shader = 'Shader_HD_DefaultUnit';
      material.Layers = material.Layers.flatMap(layer => {
        const base = { ...layer }; delete base.ShaderTypeId;
        if (base._MdxDefaults) base._MdxDefaults = { ...base._MdxDefaults };
        for (const slot of extraSlots) { delete base[slot]; if (base._MdxDefaults) delete base._MdxDefaults[slot]; }
        const lastSlot = extraSlots.findLastIndex(slot => layer[slot] != null || layer._MdxDefaults?.[slot] != null);
        return [base, ...extraSlots.slice(0, lastSlot + 1).map(slot => {
          const auxiliary = { ...base, TextureID: layer[slot] ?? -1 };
          if (layer._MdxDefaults) auxiliary._MdxDefaults = { ...base._MdxDefaults, TextureID: layer._MdxDefaults[slot] ?? (typeof auxiliary.TextureID === 'number' ? auxiliary.TextureID : -1) };
          return auxiliary;
        })];
      });
    } else if (version === 800) {
      if (oldHD) material.Layers = material.Layers.slice(0, 1);
      for (const layer of material.Layers) for (const slot of extraSlots) { delete layer[slot]; if (layer._MdxDefaults) delete layer._MdxDefaults[slot]; }
    }
  }
  normalizeVersionFields(copy, version);
  if (version === 800) {
    for (const geoset of copy.Geosets || []) { delete geoset.SkinWeights; delete geoset.Tangents; }
    copy.BindPoses = [];
  } else for (const geoset of copy.Geosets || []) geoset.LevelOfDetail ??= 0;
  return copy;
}
