import { allNodes } from './animation.js';

/** The bones a vertex is skinned to (classic matrix group or HD weights). */
function vertexBones(geoset, vertex) {
  const skin = geoset.SkinWeights;
  if (skin?.length >= (vertex + 1) * 8) return [0, 1, 2, 3].filter(i => skin[vertex * 8 + 4 + i] > 0).map(i => skin[vertex * 8 + i]);
  return [...(geoset.Groups?.[geoset.VertexGroup?.[vertex]] || [])];
}

/**
 * Every bone that moves one spot: the bones a vertex is skinned to (or one
 * picked bone) and all their parents, root first. Empty when nothing is found.
 */
export function motionChain(model, { nodeId, geosetIndex, vertexIndex }) {
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const geoset = model?.Geosets?.[geosetIndex];
  const start = nodeId != null ? [nodeId] : geoset && vertexIndex >= 0 && vertexIndex * 3 < geoset.Vertices.length ? vertexBones(geoset, vertexIndex) : [];
  const depth = new Map();
  for (const id of start) {
    const path = [];
    for (let node = nodes.get(id); node && !path.includes(node.ObjectId) && path.length < 256; node = nodes.get(node.Parent)) path.push(node.ObjectId);
    path.reverse().forEach((chainId, level) => depth.set(chainId, Math.max(depth.get(chainId) ?? 0, level)));
  }
  return [...depth.keys()].sort((a, b) => depth.get(a) - depth.get(b) || a - b);
}
