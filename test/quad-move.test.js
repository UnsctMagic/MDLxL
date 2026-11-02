import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { shiftDragLatch, solveViewMove } from '../src/shift-lock.js';

function solver({ enabled = false, plane = 'xy', perspective = false } = {}) {
  const camera = perspective ? new PerspectiveCamera(45, 4 / 3, 1, 1000) : new OrthographicCamera(-40, 40, 30, -30, 1, 1000);
  camera.position.set(0, 0, 100); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const gesture = { workplane: plane, workplaneEnabled: enabled, latch: shiftDragLatch({ x: 0, y: 0 }, false) };
  return (x, y, shift = false) => solveViewMove(gesture, { x, y }, shift, camera, new Vector3(), 800, 600, true);
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('quad threshold measures the final effective movement across Shift segments', () => {
  for (const perspective of [false, true]) for (const enabled of [false, true]) {
    const solve = solver({ perspective, enabled });
    near(solve(1, 0).movementPixels, 1);
    assert.ok(solve(1.01, 0).movementPixels > 1.001, 'clearly above one pixel');
    near(solve(.6, 0).movementPixels, .6);
    near(solve(.6, 0, true).movementPixels, .6);
    near(solve(1.2, .2, true).movementPixels, 1.2);
    near(solve(1.2, 20, true).movementPixels, 1.2); // Discard locked-away travel.
    near(solve(1.2, 20).movementPixels, 1.2);
    near(solve(0, 20).movementPixels, 0); // Opposite segment cancels earlier motion.
    near(solve(.8, 20).movementPixels, .8);
    near(solve(.8, 20, true).movementPixels, .8);
    near(solve(1.1, 20, true).movementPixels, 1.1);
  }
});

test('quad threshold excludes pointer motion rejected by an edge-on workplane', () => {
  const solve = solver({ enabled: true, plane: 'xz' });
  near(solve(0, 30).movementPixels, 0);
  near(solve(.8, 30).movementPixels, .8);
  near(solve(.8, 30, true).movementPixels, .8);
  near(solve(.8, 50, true).movementPixels, .8);
});
