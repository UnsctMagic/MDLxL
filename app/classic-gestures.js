/** MDLVis 1.40 frmmain.pas: DoSelect, CheckXYZ, vZoom. */
export function applySelection(previous, found, { shift = false, ctrl = false } = {}) {
  const selected = new Set(shift || ctrl ? previous : []);
  for (const index of found) {
    if (ctrl) selected.delete(index);
    else selected.add(index);
  }
  return [...selected];
}

import { constrainedAxis } from '../src/shift-lock.js';
export { planeAxes, constrainedAxis, moveDragPoint, shiftDragOffset, shiftDragLatch } from '../src/shift-lock.js';

export function dragScale(horizontalPixels, workplane = 'xz', constrain = false) {
  const factor = Math.max(0, 1 + horizontalPixels / 100);
  if (!constrain) return [factor, factor, factor];
  const scale = [1, 1, 1]; scale[constrainedAxis(workplane)] = factor;
  return scale;
}

/**
 * Zoom with an align vertex pulls a point across the screen until it hides
 * behind the target, keeping its distance from the eye (or its depth in an
 * orthographic view). Amount 0 leaves it, 1 lines it up exactly.
 */
export function alignTowardView(point, target, view, amount) {
  const t = Math.min(1, Math.max(0, amount));
  if (view.direction) {
    const length = Math.hypot(...view.direction) || 1, d = view.direction.map(value => value / length);
    const offset = point.map((value, axis) => value - target[axis]), along = offset[0] * d[0] + offset[1] * d[1] + offset[2] * d[2];
    return point.map((value, axis) => value - (offset[axis] - d[axis] * along) * t);
  }
  const from = point.map((value, axis) => value - view.eye[axis]), to = target.map((value, axis) => value - view.eye[axis]);
  const distance = Math.hypot(...from), toLength = Math.hypot(...to);
  if (!distance || !toLength) return point.slice();
  const mixed = from.map((value, axis) => value / distance * (1 - t) + to[axis] / toLength * t), mixedLength = Math.hypot(...mixed);
  if (!mixedLength) return point.slice();
  return mixed.map((value, axis) => view.eye[axis] + value / mixedLength * distance);
}

/**
 * Groups selected vertices into pieces: vertices that share a face belong to
 * the same piece. Returns one piece number per entry of `indices`.
 */
export function selectedPieces(faces, indices) {
  const slot = new Map(indices.map((vertex, i) => [vertex, i])), parent = indices.map((_, i) => i);
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let i = 0; i + 2 < faces.length; i += 3) {
    let first = -1;
    for (const vertex of [faces[i], faces[i + 1], faces[i + 2]]) {
      const at = slot.get(vertex); if (at === undefined) continue;
      if (first < 0) first = find(at); else parent[find(at)] = first;
    }
  }
  return indices.map((_, i) => find(i));
}

/**
 * Resize with Ctrl: every piece keeps its size and shape, only its center
 * (bounding-box middle) moves toward or away from the pivot by `scale`.
 * At 0 every piece's center sits on the pivot, so matching pieces overlap.
 * `pieces` is a list of {points: Float32Array-like xyz triples}.
 */
export function spreadPieceOffsets(pieces, pivot, scale) {
  return pieces.map(points => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i + 2 < points.length; i += 3) for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], points[i + axis]); max[axis] = Math.max(max[axis], points[i + axis]);
    }
    return [0, 1, 2].map(axis => ((min[axis] + max[axis]) / 2 - pivot[axis]) * (scale[axis] - 1));
  });
}

/** A marquee can catch any visible part of a vertex marker, not just its center. */
export function marqueeContainsPoint(point, start, end, radius = 0) {
  return point[0] >= Math.min(start.x, end.x) - radius && point[0] <= Math.max(start.x, end.x) + radius && point[1] >= Math.min(start.y, end.y) - radius && point[1] <= Math.max(start.y, end.y) + radius;
}

export function connectedVertices(faces, seeds) {
  const neighbors = new Map();
  for (let i = 0; i + 2 < faces.length; i += 3) {
    const face = [faces[i], faces[i + 1], faces[i + 2]];
    for (const vertex of face) {
      if (!neighbors.has(vertex)) neighbors.set(vertex, new Set());
      for (const neighbor of face) neighbors.get(vertex).add(neighbor);
    }
  }
  const selected = new Set(seeds), queue = [...selected];
  for (let i = 0; i < queue.length; i++) for (const next of neighbors.get(queue[i]) || []) {
    if (!selected.has(next)) { selected.add(next); queue.push(next); }
  }
  return [...selected];
}

export function insideTriangle(point, a, b, c) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-8) return false;
  const u = ((b[0] - point[0]) * (c[1] - point[1]) - (b[1] - point[1]) * (c[0] - point[0])) / area;
  const v = ((c[0] - point[0]) * (a[1] - point[1]) - (c[1] - point[1]) * (a[0] - point[0])) / area;
  const w = 1 - u - v;
  return u >= -1e-7 && v >= -1e-7 && w >= -1e-7;
}
