// Motion path: the curve a joint draws through one animation (Movement's Motion path tick).
import { allNodes, sampleNodeMatrices, worldPivot } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';

/** Where each joint's pivot travels through animation `sequenceIndex`: { frames, paths: [{ id, points }] }
 * with model-space [x, y, z] points, sampled about every `step` ms and at most `limit` times. */
export function motionPaths(model, sequenceIndex, ids, { step = 1000 / 30, limit = 240 } = {}) {
  const interval = model?.Sequences?.[sequenceIndex]?.Interval, nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const wanted = [...new Set(ids || [])].filter(id => nodes.has(id));
  if (!interval || !(interval[1] > interval[0]) || !wanted.length) return { frames: [], paths: [] };
  const every = Math.max(step, (interval[1] - interval[0]) / limit), frames = [];
  for (let frame = interval[0]; frame < interval[1]; frame += every) frames.push(Math.round(frame));
  frames.push(interval[1]);
  const paths = wanted.map(id => ({ id, points: [] }));
  for (const frame of frames) {
    const matrices = sampleNodeMatrices(model, frame, sequenceIndex);
    paths.forEach(path => path.points.push(worldPivot(model, path.id, matrices, nodes.get(path.id)).toArray()));
  }
  return { frames, paths };
}

/** Index of the sampled frame nearest `time`, for the path's moving dot. */
export function motionPathMarker(frames, time) {
  let best = 0;
  for (let i = 1; i < (frames?.length || 0); i++) if (Math.abs(frames[i] - time) < Math.abs(frames[best] - time)) best = i;
  return best;
}

/** Everything a joint's path depends on (its own and its parents' tracks and pivots), so a
 * cached path is sampled again only after one of them changed (a drag or an edit). */
export function motionPathInputs(model, ids) {
  const index = nodeIndex(model), inputs = [], seen = new Set();
  for (const id of ids || []) for (const at of index.ancestors(id, true)) {
    if (seen.has(at)) continue;
    seen.add(at);
    const node = index.byId.get(at);
    inputs.push(node, node.Translation, node.Rotation, node.Scaling, node.PivotPoint, model.PivotPoints?.[at]);
  }
  return inputs;
}

export const sameInputs = (a, b) => !!a && !!b && a.length === b.length && a.every((value, i) => value === b[i]);
