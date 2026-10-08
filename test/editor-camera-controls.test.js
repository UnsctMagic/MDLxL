import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { EditorCameraControls } from '../app/editor-camera-controls.js';

const pointer = (type, values = {}) => Object.assign(new Event(type), {
  pointerType: 'mouse', pointerId: 1, button: 0, buttons: 1, clientX: 100, clientY: 100, ...values,
});
// Node's EventTarget uses registration order, whereas DOM capture listeners
// run before OrbitControls' bubble listener on the same canvas.
class DOMEvents {
  listeners = new Map();
  addEventListener(type, callback, options) {
    const capture = options === true || !!options?.capture, list = this.listeners.get(type) || [];
    if (!list.some(item => item.callback === callback && item.capture === capture)) list.push({ callback, capture });
    this.listeners.set(type, list);
  }
  removeEventListener(type, callback, options) {
    const capture = options === true || !!options?.capture;
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.callback !== callback || item.capture !== capture));
  }
  dispatchEvent(event) {
    for (const item of [...(this.listeners.get(event.type) || [])].sort((a, b) => b.capture - a.capture)) item.callback.call(this, event);
  }
}
class Surface extends DOMEvents {
  constructor(document) { super(); this.ownerDocument = document; this.style = {}; this.clientWidth = 600; this.clientHeight = 400; this.capture = new Set(); }
  getRootNode() { return this.ownerDocument; }
  setPointerCapture(id) { this.capture.add(id); }
  hasPointerCapture(id) { return this.capture.has(id); }
  releasePointerCapture(id) { if (this.capture.delete(id)) this.dispatchEvent(pointer('lostpointercapture', { pointerId: id })); }
}
function scene() {
  const document = new DOMEvents(); document.defaultView = new DOMEvents();
  const surface = new Surface(document), camera = new PerspectiveCamera(42);
  camera.position.set(150, -250, 100); camera.up.set(0, 0, 1);
  const controls = new EditorCameraControls(camera, surface); controls.enableDamping = false;
  return { document, surface, camera, controls };
}

for (const interruption of ['capture lost', 'window blurred', 'released without pointerup', 'new press without pointerup']) {
  test(`interrupted pan recovers rotation: ${interruption}`, () => {
    const { document, surface, camera, controls } = scene();
    try {
      surface.dispatchEvent(pointer('pointerdown', { button: 2, buttons: 2 }));
      document.dispatchEvent(pointer('pointermove', { button: 2, buttons: 2, clientX: 140 }));
      const position = camera.position.clone(), target = controls.target.clone();
      if (interruption === 'capture lost') surface.releasePointerCapture(1);
      if (interruption === 'window blurred') document.defaultView.dispatchEvent(new Event('blur'));
      if (interruption === 'released without pointerup') document.dispatchEvent(pointer('pointermove', { buttons: 0 }));
      assert.deepEqual(camera.position.toArray(), position.toArray(), 'recovery retains the placed view');
      assert.deepEqual(controls.target.toArray(), target.toArray(), 'recovery retains the pan target');
      surface.dispatchEvent(pointer('pointerdown'));
      document.dispatchEvent(pointer('pointermove', { clientX: 180, clientY: 125 }));
      assert.ok(camera.position.distanceTo(position) > 1, 'left drag moves around the target');
      assert.ok(controls.target.distanceTo(target) < 1e-9, 'left drag does not continue the old pan');
      document.dispatchEvent(pointer('pointerup', { buttons: 0 }));
      assert.equal(surface.hasPointerCapture(1), false);
    } finally { controls.dispose(); }
  });
}

test('normal end of one touch pointer retains the other touch gesture', () => {
  const { document, surface, controls } = scene();
  try {
    const touch = (type, id) => pointer(type, { pointerType: 'touch', pointerId: id, pageX: id * 30, pageY: 100 });
    surface.dispatchEvent(touch('pointerdown', 1)); surface.dispatchEvent(touch('pointerdown', 2));
    document.dispatchEvent(touch('pointerup', 1)); surface.releasePointerCapture(1);
    assert.deepEqual(controls._pointers, [2]);
  } finally { controls.dispose(); }
});

test('delayed lost capture from an interrupted drag cannot cancel its replacement', () => {
  const { document, surface, camera, controls } = scene();
  try {
    surface.dispatchEvent(pointer('pointerdown', { button: 2, buttons: 2 }));
    surface.dispatchEvent(pointer('pointerdown'));
    surface.dispatchEvent(pointer('lostpointercapture'));
    const before = camera.position.clone(), target = controls.target.clone();
    document.dispatchEvent(pointer('pointermove', { clientX: 180 }));
    assert.ok(camera.position.distanceTo(before) > 1);
    assert.ok(controls.target.distanceTo(target) < 1e-9);
  } finally { controls.dispose(); }
});

test('reconnecting a camera detaches input recovery from its old canvas', () => {
  const { document, surface, camera, controls } = scene(), replacement = new Surface(document);
  try {
    surface.dispatchEvent(pointer('pointerdown'));
    controls.connect(replacement);
    const before = camera.position.clone();
    surface.dispatchEvent(pointer('pointerdown'));
    document.dispatchEvent(pointer('pointermove', { clientX: 180 }));
    assert.deepEqual(camera.position.toArray(), before.toArray(), 'old canvas no longer controls the camera');
    replacement.dispatchEvent(pointer('pointerdown'));
    surface.dispatchEvent(pointer('lostpointercapture'));
    document.dispatchEvent(pointer('pointermove', { clientX: 180 }));
    assert.ok(camera.position.distanceTo(before) > 1, 'old lost capture cannot cancel the new canvas');
  } finally { controls.dispose(); }
});
