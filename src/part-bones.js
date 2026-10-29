/** HD skin: four bone ids then four 0-255 weights per vertex. Any other length
 * (missing or truncated) reads the classic vertex groups instead. */
export const isHdSkinned = geoset => geoset?.SkinWeights?.length === (geoset?.Vertices?.length || 0) / 3 * 8;

/** The bones a vertex hangs on: its classic matrix group, or the HD slots
 * weighing at least `minWeight` (1 = any nonzero weight). */
export function vertexBones(geoset, vertex, { minWeight = 1 } = {}) {
  if (isHdSkinned(geoset)) {
    const skin = geoset.SkinWeights, at = vertex * 8, bones = [];
    for (let slot = 0; slot < 4; slot++) if (skin[at + 4 + slot] >= minWeight) bones.push(skin[at + slot]);
    return bones;
  }
  return Array.from(geoset?.Groups?.[geoset.VertexGroup?.[vertex]] || []);
}

/** [bone, share] pairs that sum to 1: HD weight / 255, or an even split of the
 * classic matrix group. Zero HD weights are left out. */
export function vertexBoneWeights(geoset, vertex) {
  if (isHdSkinned(geoset)) {
    const skin = geoset.SkinWeights, at = vertex * 8, bones = [];
    for (let slot = 0; slot < 4; slot++) if (skin[at + 4 + slot] > 0) bones.push([skin[at + slot], skin[at + 4 + slot] / 255]);
    return bones;
  }
  const group = geoset?.Groups?.[geoset.VertexGroup?.[vertex]] || [];
  return Array.from(group, id => [id, 1 / group.length]);
}

/** The bones a vertex hangs on (classic matrix group or HD weights), for
 * double-click selection in the preview. Empty when it has none. */
export function partBones(model, geosetIndex, vertexIndex) {
  const geoset = model?.Geosets?.[geosetIndex];
  if (!geoset || !(vertexIndex >= 0 && vertexIndex * 3 < geoset.Vertices.length)) return [];
  return vertexBones(geoset, vertexIndex);
}
