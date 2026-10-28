/** The bones a vertex hangs on (classic matrix group or HD weights), for
 * double-click selection in the preview. Empty when it has none. */
export function partBones(model, geosetIndex, vertexIndex) {
  const geoset = model?.Geosets?.[geosetIndex];
  if (!geoset || !(vertexIndex >= 0 && vertexIndex * 3 < geoset.Vertices.length)) return [];
  const skin = geoset.SkinWeights;
  if (skin?.length >= (vertexIndex + 1) * 8) return [0, 1, 2, 3].filter(i => skin[vertexIndex * 8 + 4 + i] > 0).map(i => skin[vertexIndex * 8 + i]);
  return [...(geoset.Groups?.[geoset.VertexGroup?.[vertexIndex]] || [])];
}
