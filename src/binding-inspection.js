import { vertexBones } from './part-bones.js';

/** Actual, nonzero direct influences only; ancestry does not add a binding. */
export function directlyBoundBoneIds(model, selectionByGeoset = {}) {
  const bones = new Set((model?.Bones || []).map(node => node.ObjectId)), result = new Set();
  for (const [index, vertices] of Object.entries(selectionByGeoset || {})) {
    const geoset = model?.Geosets?.[Number(index)];
    if (!geoset) continue;
    const count = (geoset.Vertices?.length || 0) / 3;
    for (const vertex of vertices || []) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex >= count) continue;
      for (const id of vertexBones(geoset, vertex)) if (bones.has(id)) result.add(id);
    }
  }
  return [...result].sort((a, b) => a - b);
}
