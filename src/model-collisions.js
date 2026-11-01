import { updateBounds } from './mesh-tools.js';
import { sampleGeosetAnimation, sampleNodeMatrices, skinGeoset } from './animation.js';

export function collisionCenter(shape) {
  return shape.Shape === 2 ? Array.from(shape.Vertices.slice(0, 3)) : [0, 1, 2].map(i => (shape.Vertices[i] + shape.Vertices[i + 3]) / 2);
}

export function moveCollision(shape, delta) {
  shape.Vertices = new Float32Array(Array.from(shape.Vertices, (v, i) => v + delta[i % 3]));
}

export function resizeCollision(shape, axis, size) {
  if (!Number.isFinite(size)) return;
  size = Math.max(.01, size);
  if (shape.Shape === 2) shape.BoundsRadius = size;
  else {
    const center = collisionCenter(shape)[axis];
    shape.Vertices[axis] = center - size / 2;
    shape.Vertices[axis + 3] = center + size / 2;
  }
}

// The model as it stands in game: the Stand pose, with only the geosets shown
// there. Birth, death and effect pieces would otherwise stretch the shapes.
export function standingVertices(model) {
  const sequences = model.Sequences || [];
  let index = sequences.findIndex(s => /^stand/i.test(s.Name || ''));
  if (index < 0) index = sequences.length ? 0 : -1;
  const points = [], interval = sequences[index]?.Interval;
  for (const frame of interval ? [interval[0], (interval[0] + interval[1]) / 2] : [0]) {
    const matrices = sampleNodeMatrices(model, frame, index);
    (model.Geosets || []).forEach((g, i) => {
      if (index >= 0 && sampleGeosetAnimation(model, i, frame, index).alpha <= .01) return;
      const posed = skinGeoset(g, matrices);
      for (let v = 0; v + 2 < posed.length; v += 3) if (Number.isFinite(posed[v] + posed[v + 1] + posed[v + 2])) points.push([posed[v], posed[v + 1], posed[v + 2]]);
    });
  }
  return points;
}
const percentile = (values, p) => { const sorted = Float64Array.from(values).sort(); return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]; };
const fround = values => values.map(v => Math.fround(v));

// Blizzard stacks equal spheres along a unit's long side (Footman: two
// radius-38 spheres over legs and torso, not out to its sword tip).
export function fitSpheres(points, { reach = .95, overlap = .7, flat = 1.3 } = {}) {
  const range = [0, 1, 2].map(axis => [percentile(points.map(p => p[axis]), .02), percentile(points.map(p => p[axis]), .98)]), size = range.map(([lo, hi]) => hi - lo);
  const long = Math.max(size[0], size[1]) > size[2] * flat ? (size[0] >= size[1] ? 0 : 1) : 2;
  const across = [0, 1, 2].filter(axis => axis !== long), length = range[long][1] - range[long][0];
  const middle = across.map(axis => percentile(points.map(p => p[axis]), .5));
  const radius = Math.max(.01, percentile(points.map(p => Math.hypot(p[across[0]] - middle[0], p[across[1]] - middle[1])), reach));
  const count = Math.max(1, Math.min(4, Math.round(length / (2 * radius * overlap))));
  return Array.from({ length: count }, (_, i) => {
    const lo = range[long][0] + length * i / count, hi = lo + length / count;
    const slab = points.filter(p => p[long] >= lo && p[long] <= hi), center = [];
    center[long] = (lo + hi) / 2;
    across.forEach((axis, k) => { center[axis] = slab.length ? percentile(slab.map(p => p[axis]), .5) : middle[k]; });
    return fround([...center, Math.max(radius, length / count / 2)]);
  });
}

/** One box or a few spheres around the standing model, as Sphereomancer shape rows. */
export function fitCollisionShapes(model, kind) {
  const points = standingVertices(model);
  if (!points.length) return kind === 'box' ? [[-16, -16, 0, 16, 16, 32]] : [[0, 0, 16, 16]];
  if (kind !== 'box') return fitSpheres(points);
  // Blizzard's boxes stand on the ground (Farm, Barracks, Knight, Gryphon Rider).
  const lo = [0, 1, 2].map(axis => percentile(points.map(p => p[axis]), .02)), hi = [0, 1, 2].map(axis => percentile(points.map(p => p[axis]), .98));
  if (lo[2] < (hi[2] - lo[2]) * .15) lo[2] = 0;
  return [fround([...lo, ...hi.map((v, axis) => Math.max(v, lo[axis] + .01))])];
}

/** Fit new, unparented collision nodes to the model's bind-pose geometry. */
export function fittedCollision(model, type) {
  const vertices = new Float32Array((model.Geosets || []).reduce((n, g) => n + g.Vertices.length, 0));
  let offset = 0;
  for (const g of model.Geosets || []) { vertices.set(g.Vertices, offset); offset += g.Vertices.length; }
  const bounds = { Vertices: vertices };
  if (vertices.length) updateBounds(bounds);
  else Object.assign(bounds, { MinimumExtent: [-16, -16, -16], MaximumExtent: [16, 16, 16], BoundsRadius: 16 });
  const center = Array.from(bounds.MinimumExtent, (v, i) => (v + bounds.MaximumExtent[i]) / 2);
  return type === 2
    ? { Shape: 2, Vertices: new Float32Array(center), BoundsRadius: Math.max(.01, bounds.BoundsRadius) }
    : { Shape: 0, Vertices: new Float32Array([...center.map((v,i) => Math.min(bounds.MinimumExtent[i], v - .005)), ...center.map((v,i) => Math.max(bounds.MaximumExtent[i], v + .005))]), BoundsRadius: 0 };
}
