export const textureName = texture => texture?.ReplaceableId === 1 ? 'Team color' : texture?.ReplaceableId === 2 ? 'Team glow' : texture?.Image?.split(/[\\/]/).at(-1) || (texture?.ReplaceableId ? `Replaceable ${texture.ReplaceableId}` : 'No texture path');
export const materialName = (model, id) => `Material ${id + 1} · ${textureName(model.Textures?.[typeof model.Materials?.[id]?.Layers?.[0]?.TextureID === 'number' ? model.Materials[id].Layers[0].TextureID : model.Materials?.[id]?.Layers?.[0]?.TextureID?.Keys?.[0]?.Vector?.[0]])}`;

/** Follow actual classic vertex groups or nonzero HD weights, not Bone.GeosetId
 * metadata. Helpers affect geometry through descendant bones. */
export function geosetBoneIds(geoset, vertices = null) {
  const ids = new Set(), count = (geoset?.Vertices?.length || 0) / 3;
  for (const v of vertices || Array.from({ length: count }, (_, i) => i)) {
    if (!Number.isInteger(v) || v < 0 || v >= count) continue;
    if (geoset.SkinWeights?.length >= (v + 1) * 8) {
      for (let k = 0; k < 4; k++) if (geoset.SkinWeights[v * 8 + 4 + k]) ids.add(geoset.SkinWeights[v * 8 + k]);
    } else for (const id of geoset.Groups?.[geoset.VertexGroup?.[v]] || []) ids.add(id);
  }
  return [...ids];
}
