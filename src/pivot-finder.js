import { Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from './animation.js';

// Show pivot: which bones make one spot of the mesh move in an animation, and
// where each one swings from. Each bone above the spot is frozen in turn; the
// motion that disappears with it is that bone's share.

function vertexBones(geoset, vertex) {
  const skin = geoset.SkinWeights, hd = skin?.length >= (vertex + 1) * 8;
  if (hd) return [0, 1, 2, 3].filter(i => skin[vertex * 8 + 4 + i] > 0).map(i => ({ id: skin[vertex * 8 + i], weight: skin[vertex * 8 + 4 + i] / 255 }));
  return (geoset.Groups?.[geoset.VertexGroup?.[vertex]] || []).map(id => ({ id, weight: 1 }));
}

function skinnedPoint(source, bones, matrices, out = new Vector3()) {
  const point = new Vector3(); let total = 0; out.set(0, 0, 0);
  for (const { id, weight } of bones) {
    const matrix = matrices.get(id); if (!matrix) continue;
    out.addScaledVector(point.copy(source).applyMatrix4(matrix), weight); total += weight;
  }
  return total ? out.multiplyScalar(1 / total) : out.copy(source);
}

function animatedIn(node, interval) {
  return ['Translation', 'Rotation', 'Scaling'].some(key => {
    const track = node[key];
    if (!track?.Keys?.length) return false;
    if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) return track.Keys.length > 1;
    const keys = track.Keys.filter(key => key.Frame >= interval[0] && key.Frame <= interval[1]);
    return keys.some(key => key.Vector.some((value, i) => Math.abs(value - keys[0].Vector[i]) > 1e-6));
  });
}

/**
 * @returns {{ geosetIndex: number, vertexIndex: number, trail: number[][], pivots: { nodeId: number, name: string, share: number }[] } | null}
 * `trail` is the spot's path through the whole sequence; pivots are strongest
 * first and empty when nothing moves it. `pivotsAtFrame` places them.
 */
export function findMotionPivots(model, sequenceIndex, geosetIndex, vertexIndex, { samples = 48, maxPivots = 3 } = {}) {
  const geoset = model?.Geosets?.[geosetIndex], interval = model?.Sequences?.[sequenceIndex]?.Interval;
  if (!geoset || !interval || !(vertexIndex >= 0 && vertexIndex * 3 < geoset.Vertices.length)) return null;
  const bones = vertexBones(geoset, vertexIndex);
  if (!bones.length) return null;
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const chain = [];
  for (const { id } of bones) for (let node = nodes.get(id), guard = 0; node && guard < 256; node = nodes.get(node.Parent), guard++) {
    if (!chain.includes(node.ObjectId)) chain.push(node.ObjectId);
  }
  const candidates = chain.filter(id => animatedIn(nodes.get(id), interval));
  const source = new Vector3().fromArray(geoset.Vertices, vertexIndex * 3);
  const [start, end] = interval, frames = Array.from({ length: samples + 1 }, (_, i) => start + (end - start) * i / samples);
  const live = frames.map(at => skinnedPoint(source, bones, sampleNodeMatrices(model, at, sequenceIndex, at)));
  const trail = live.map(point => point.toArray());
  const contributions = candidates.map(id => {
    const frozen = new Map([[id, start]]), offsets = frames.map((at, i) => live[i].clone().sub(skinnedPoint(source, bones, sampleNodeMatrices(model, at, sequenceIndex, at, frozen))));
    const mean = offsets.reduce((sum, offset) => sum.add(offset), new Vector3()).multiplyScalar(1 / offsets.length);
    return { id, amount: offsets.reduce((sum, offset) => sum + offset.distanceTo(mean), 0) / offsets.length };
  });
  const box = live.reduce((size, point) => Math.max(size, point.distanceTo(live[0])), 0);
  const total = contributions.reduce((sum, item) => sum + item.amount, 0);
  const found = { geosetIndex, vertexIndex, trail, pivots: [] };
  if (box < 1e-3 || total < 1e-3) return found;
  const strongest = Math.max(...contributions.map(item => item.amount));
  found.pivots = contributions.filter(item => item.amount >= strongest * .15).sort((a, b) => b.amount - a.amount).slice(0, maxPivots)
    .map(({ id, amount }) => ({ nodeId: id, name: nodes.get(id).Name || `Object ${id}`, share: amount / total }));
  return found;
}

/** Where the found pivots and the clicked spot are at `frame`, plus the trail index nearest it. */
export function pivotsAtFrame(model, sequenceIndex, found, frame) {
  const interval = model?.Sequences?.[sequenceIndex]?.Interval, geoset = model?.Geosets?.[found?.geosetIndex];
  if (!interval || !geoset) return null;
  const samples = found.trail.length - 1, [start, end] = interval;
  const current = Math.max(0, Math.min(samples, Math.round((frame - start) / Math.max(1, end - start) * samples)));
  const matrices = sampleNodeMatrices(model, frame, sequenceIndex, frame);
  const source = new Vector3().fromArray(geoset.Vertices, found.vertexIndex * 3);
  const spot = skinnedPoint(source, vertexBones(geoset, found.vertexIndex), matrices).toArray();
  const nodes = allNodes(model), pivots = found.pivots.map(pivot => {
    const node = nodes.find(node => node.ObjectId === pivot.nodeId);
    const point = new Vector3().fromArray(node?.PivotPoint || model.PivotPoints?.[pivot.nodeId] || [0, 0, 0]);
    return { ...pivot, world: matrices.has(pivot.nodeId) ? point.applyMatrix4(matrices.get(pivot.nodeId)).toArray() : point.toArray() };
  });
  return { current, spot, pivots };
}
