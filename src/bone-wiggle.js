import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, nodePivot } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';

// Bones tab "Wiggle": swings the selected bones back and forth in the rest-pose
// preview so badly bound vertices show up as stretching or left-behind parts.
// Preview only; the model and its animations are never changed.
const SWING = 30 * Math.PI / 180, NOD = 20 * Math.PI / 180, PERIOD = 1.2;

/** World matrices (by ObjectId) for the rest pose with `ids` swinging around
 * their pivots. `viewAxis` and `sideAxis` are model-space unit vectors: the
 * swing turns around the view axis (visible in any view) and the nod around
 * the screen's horizontal axis. Nodes not under a wiggling bone stay at rest. */
export function wiggleMatrices(model, ids, seconds, viewAxis, sideAxis) {
  const nodes = allNodes(model), { byId, parentOf } = nodeIndex(model, nodes);
  const wiggling = new Set((ids || []).filter(id => byId.has(id)));
  const out = new Map();
  if (!wiggling.size) return out;
  const phase = 2 * Math.PI * seconds / PERIOD;
  const turn = new Quaternion().setFromAxisAngle(viewAxis, SWING * Math.sin(phase))
    .multiply(new Quaternion().setFromAxisAngle(sideAxis, NOD * Math.sin(phase / 2)));
  const resolving = new Set();
  const world = id => {
    if (out.has(id)) return out.get(id);
    const node = byId.get(id);
    if (!node || resolving.has(id)) return new Matrix4();
    resolving.add(id);
    const parent = parentOf(id);
    const matrix = Number.isInteger(parent) && parent >= 0 ? world(parent).clone() : new Matrix4();
    if (wiggling.has(id)) {
      const pivot = new Vector3().fromArray(nodePivot(model, node, id));
      matrix.multiply(new Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z))
        .multiply(new Matrix4().makeRotationFromQuaternion(turn))
        .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    }
    resolving.delete(id);
    out.set(id, matrix);
    return matrix;
  };
  for (const node of nodes) world(node.ObjectId);
  return out;
}

/** Writes the wiggle into the native renderer's node matrices (already at the
 * rest pose). Returns true when anything moved. */
export function applyWiggleMatrices(rendererData, model, ids, seconds, camera) {
  if (!ids?.length || !rendererData?.nodes || !camera) return false;
  const viewAxis = new Vector3(), sideAxis = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  camera.getWorldDirection(viewAxis);
  const matrices = wiggleMatrices(model, ids, seconds, viewAxis.normalize(), sideAxis.normalize());
  let moved = false;
  for (const [id, matrix] of matrices) {
    const entry = rendererData.nodes[id];
    if (entry?.matrix?.length >= 16) { entry.matrix.set(matrix.elements); moved = true; }
  }
  return moved;
}
