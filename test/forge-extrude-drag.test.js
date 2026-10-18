import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, OrthographicCamera, Vector3 } from 'three';
import { normalDragTranslation } from '../app/viewport-math.js';

for (const perspective of [true, false]) test(`face-normal extrusion starts at zero and follows outward/inward drags (${perspective ? 'perspective' : 'orthographic'})`, () => {
  const camera = perspective ? new PerspectiveCamera(45, 1, .1, 1000) : new OrthographicCamera(-100, 100, 100, -100, .1, 1000);
  camera.up.set(0, 0, 1); camera.position.set(180, -250, 200); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const pivot = new Vector3(0, 0, 20), normal = new Vector3(0, 0, 1);
  const a = pivot.clone().project(camera), b = pivot.clone().add(normal).project(camera);
  const x = (b.x - a.x) * 400, y = (a.y - b.y) * 400;
  assert.equal(normalDragTranslation(camera, pivot, normal, 800, 800, 0, 0).length(), 0);
  for (const distance of [4, 12, -8]) {
    const delta = normalDragTranslation(camera, pivot, normal, 800, 800, x * distance, y * distance);
    assert.ok(delta.distanceTo(normal.clone().multiplyScalar(distance)) < 1e-8);
  }
  assert.ok(normalDragTranslation(camera, pivot, normal, 800, 800, -y * 20, x * 20).length() < 1e-8);
});

test('head-on faces use a finite upward drag for outward extrusion', () => {
  const camera = new OrthographicCamera(-100, 100, 100, -100, .1, 1000);
  camera.position.set(0, 0, 300); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const delta = normalDragTranslation(camera, new Vector3(), new Vector3(0, 0, 1), 800, 800, 0, -40);
  assert.deepEqual(delta.toArray(), [0, 0, 10]);
});
