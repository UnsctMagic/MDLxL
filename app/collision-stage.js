import { Matrix4, Vector3 } from 'three';
import { collisionCenter } from '../src/model-collisions.js';
import { screenPlaneTranslation } from './viewport-math.js';
import { particleAxisMapping } from '../src/particle-handles.js';

/** Uses the renderer's evaluated node transforms, including animated parents. */
export function collisionStageSnapshot(native, camera, width, height, shapes, selectedId) {
  const project = world => { const p = world.clone().project(camera); return [(p.x + 1) * width / 2, (1 - p.y) * height / 2, p.z]; };
  const rows = [];
  for (const shape of shapes || []) {
    if (![0, 2].includes(shape.Shape)) continue;
    const matrix = new Matrix4().fromArray(native.rendererData.nodes[shape.ObjectId]?.matrix || new Matrix4().elements);
    const point = local => project(new Vector3().fromArray(local).applyMatrix4(matrix));
    const center = collisionCenter(shape), outlines = [], guides = [];
    if (shape.Shape === 2) {
      // One outline facing the camera reads as a ball; a faint ground ring
      // shows its height. Three crossing rings per sphere were hard to read.
      const world = new Vector3().fromArray(center).applyMatrix4(matrix), radius = shape.BoundsRadius * matrix.getMaxScaleOnAxis();
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize(), up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      outlines.push(Array.from({ length: 65 }, (_, i) => project(world.clone().addScaledVector(right, Math.cos(i * Math.PI / 32) * radius).addScaledVector(up, Math.sin(i * Math.PI / 32) * radius))));
      guides.push(Array.from({ length: 65 }, (_, i) => {
        const local = [...center], angle = i * Math.PI / 32;
        local[0] += Math.cos(angle) * shape.BoundsRadius; local[1] += Math.sin(angle) * shape.BoundsRadius;
        return point(local);
      }));
    } else {
      const corners = Array.from({ length: 8 }, (_, i) => [0, 1, 2].map(axis => shape.Vertices[axis + ((i >> axis) & 1) * 3]));
      for (let i = 0; i < 8; i++) for (let axis = 0; axis < 3; axis++) if (!(i & (1 << axis))) outlines.push([point(corners[i]), point(corners[i | (1 << axis)])]);
    }
    const row = { id: shape.ObjectId, center: point(center), outlines, guides, handles: [] };
    if (shape.ObjectId === selectedId && Math.abs(matrix.determinant()) > 1e-10) {
      const world = new Vector3().fromArray(center).applyMatrix4(matrix), inverse = matrix.clone().invert();
      row.move = Object.fromEntries([['dx', 1, 0], ['dy', 0, 1]].map(([key, x, y]) => [key, world.clone().add(screenPlaneTranslation(camera, world, width, height, x, y)).applyMatrix4(inverse).sub(new Vector3().fromArray(center)).toArray()]));
      for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
        const local = [...center], unit = [...center];
        const distance = shape.Shape === 2 ? shape.BoundsRadius : (shape.Vertices[axis + 3] - shape.Vertices[axis]) / 2;
        local[axis] += sign * distance; unit[axis] += sign * (distance + 1);
        const at = point(local), basis = particleAxisMapping(at, point(unit));
        if (basis) row.handles.push({ axis, sign, point: at, basis });
      }
    }
    rows.push(row);
  }
  return { width, height, rows };
}
