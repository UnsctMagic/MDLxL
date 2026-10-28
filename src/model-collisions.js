import { updateBounds } from './mesh-tools.js';

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
