import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import { EditorCameraControls, createEditorCameras } from '../app/editor-camera-controls.js';
import { snapshotPreviewCamera, restorePreviewCamera } from '../app/viewport-math.js';

// The UV preview's Front framing of the Footman (0.40.0 rest-pose bounds). OrbitControls'
// spherical round trip flips this camera by one rounding step on every update(), so an idle
// render loop used to move the user's camera without any input.
const FOOTMAN_POSITION = [394.4364904260662, 2.9836502075195073, 52.361590743064895];
const FOOTMAN_TARGET = [1.5339984893798828, 2.9836502075195312, 52.36159074306487];
function footmanFront() {
  const camera = new OrthographicCamera(-100, 100, 100, -100, .2, 1000); camera.up.set(0, 0, 1);
  camera.position.fromArray(FOOTMAN_POSITION);
  const controls = new EditorCameraControls(camera);
  controls.target.fromArray(FOOTMAN_TARGET);
  camera.lookAt(controls.target);
  controls.update();
  return { camera, controls };
}
const state = ({ camera, controls }) => [camera.position.toArray(), camera.quaternion.toArray(), controls.target.toArray(), camera.zoom];

test('idle frames leave the camera exactly where it is', () => {
  const view = footmanFront(), before = state(view);
  for (let frame = 0; frame < 120; frame++) { view.controls.update(); assert.deepEqual(state(view), before, 'frame ' + frame); }
});

test('camera changes after an idle frame still apply', () => {
  const view = footmanFront(), { camera, controls } = view;
  controls.update();
  controls._rotateLeft(.3); controls.update();
  assert.notDeepEqual(camera.position.toArray(), FOOTMAN_POSITION, 'rotation applies');
  const turned = state(view); controls.update(); assert.deepEqual(state(view), turned, 'idle again after rotating');
  controls.target.set(0, 0, 0); controls.update();
  assert.ok(Math.abs(camera.getWorldDirection(camera.position.clone()).dot(controls.target.clone().sub(camera.position).normalize()) - 1) < 1e-9, 'a moved target is looked at');
  controls._scale = .5; controls.update();
  assert.equal(camera.zoom, 2, 'zoom applies');
  camera.position.x += 10; controls.update();
  controls.minPolarAngle = controls.maxPolarAngle = Math.PI / 2; controls.update();
  assert.ok(Math.abs(camera.position.z - controls.target.z) < 1e-6, 'new angle limits apply without other input');
});

// A rebuilt preview (UV edits, undo) restores the saved camera into fresh controls. The
// restored view must be the saved one exactly, on the restore and on every frame after it.
test('a rebuilt preview restores the saved camera exactly', () => {
  const view = footmanFront();
  for (let rebuild = 0; rebuild < 4; rebuild++) {
    const saved = snapshotPreviewCamera(view.camera, new PerspectiveCamera(), view.camera, view.controls);
    const expected = [saved.ortho.position.toArray(), saved.ortho.quaternion.toArray(), saved.target.toArray(), saved.ortho.zoom];
    const { perspective, ortho, controls } = createEditorCameras(null);
    const camera = restorePreviewCamera(saved, perspective, ortho, controls);
    assert.equal(camera, ortho);
    for (let frame = 0; frame < 5; frame++) { controls.update(); assert.deepEqual(state({ camera, controls }), expected, 'rebuild ' + rebuild + ' frame ' + frame); }
    Object.assign(view, { camera, controls });
  }
});
