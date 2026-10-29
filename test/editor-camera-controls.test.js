import { editorCameraSnapshot } from '../app/portrait-view.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, MOUSE, Vector3 } from 'three';
import { EditorCameraControls, createEditorCameras, applyCameraButtons, orbitMouseAction } from '../app/editor-camera-controls.js';

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


test('portrait orbit changes height and wheel distance is independent of lens zoom', () => {
  const { document,surface,camera,controls } = scene(); controls.portraitDolly = () => true;
  try {
    const z = camera.position.z;
    surface.dispatchEvent(pointer('pointerdown'));
    document.dispatchEvent(pointer('pointermove',{clientY:145}));
    document.dispatchEvent(pointer('pointerup',{buttons:0}));
    assert.ok(Math.abs(camera.position.z - z) > 1, 'vertical mouse drag changes camera height');
    const before = camera.position.distanceTo(controls.target), fov = camera.fov, zoom = camera.zoom;
    surface.dispatchEvent(Object.assign(new Event('wheel'),{deltaY:-100,deltaMode:0,clientX:100,clientY:100,shiftKey:false}));
    assert.ok(camera.position.distanceTo(controls.target) < before); assert.equal(camera.zoom,zoom); assert.equal(camera.fov,fov);
    const distance = camera.position.distanceTo(controls.target);
    surface.dispatchEvent(Object.assign(new Event('wheel'),{deltaY:-100,deltaMode:0,clientX:100,clientY:100,shiftKey:true}));
    assert.ok(camera.zoom > zoom); assert.ok(Math.abs(camera.position.distanceTo(controls.target) - distance) < 1e-6);
    controls.portraitDolly = () => false;
    const normalDistance = camera.position.distanceTo(controls.target);
    surface.dispatchEvent(Object.assign(new Event('wheel'),{deltaY:100,deltaMode:0,clientX:100,clientY:100,shiftKey:false}));
    assert.ok(Math.abs(camera.position.distanceTo(controls.target) - normalDistance) < 1e-6, 'other viewports retain their lens zoom');
  } finally { controls.dispose(); }
});


test('extreme portrait lens zoom stays inside the model camera FOV range', () => {
  const {surface,camera,controls}=scene();controls.portraitDolly=()=>true;
  try {
    for(let i=0;i<100;i++)surface.dispatchEvent(Object.assign(new Event('wheel'),{deltaY:100,deltaMode:0,clientX:100,clientY:100,shiftKey:true}));
    const view=editorCameraSnapshot(camera,controls.target);
    assert.ok(view.fieldOfView>0 && view.fieldOfView<Math.PI);
  } finally { controls.dispose(); }
});

test('Shift+wheel reported as horizontal scroll (deltaX only) still zooms, in portrait and other viewports', () => {
  for (const portrait of [true, false]) {
    const {surface,camera,controls}=scene();controls.portraitDolly=()=>portrait;
    try {
      const zoom=camera.zoom, distance=camera.position.distanceTo(controls.target);
      surface.dispatchEvent(Object.assign(new Event('wheel'),{deltaX:-100,deltaY:0,deltaMode:0,clientX:100,clientY:100,shiftKey:true}));
      assert.ok(camera.zoom>zoom,'zoomed in');
      if (portrait) assert.ok(Math.abs(camera.position.distanceTo(controls.target)-distance)<1e-6,'portrait Shift zooms the lens, not the distance');
      const zoomed=camera.zoom;
      surface.dispatchEvent(Object.assign(new Event('wheel'),{deltaX:100,deltaY:0,deltaMode:1,clientX:100,clientY:100,shiftKey:true}));
      assert.ok(camera.zoom<zoomed,'zoomed out in line mode');
      const unshifted=camera.zoom;
      surface.dispatchEvent(Object.assign(new Event('wheel'),{deltaX:-100,deltaY:0,deltaMode:0,clientX:100,clientY:100,shiftKey:false}));
      assert.equal(camera.zoom,unshifted,'plain horizontal scroll stays ignored');
    } finally { controls.dispose(); }
  }
});


test('shared cameras retain per-preview targets, projections and default buttons', () => {
  const { document } = scene(), surface = new Surface(document);
  const target = new Vector3(4, 8, 45);
  const { perspective, ortho, controls } = createEditorCameras(surface, { target, leftButton: MOUSE.ROTATE });
  try {
    assert.deepEqual(perspective.up.toArray(), [0, 0, 1]); assert.deepEqual(ortho.up.toArray(), [0, 0, 1]);
    assert.equal(perspective.fov, 42); assert.equal(controls.object, perspective);
    assert.deepEqual(controls.target, target); assert.notEqual(controls.target, target);
    assert.deepEqual(controls.mouseButtons, { LEFT: MOUSE.ROTATE, MIDDLE: null, RIGHT: MOUSE.PAN });
    assert.equal(controls.enableDamping, false);
  } finally { controls.dispose(); }
});

test('shared button setup preserves single-view, Quad and Showcase Shift decisions', () => {
  const controls = { mouseButtons: {} }, preferences = { cameraBindings: { right: 'pan', middle: 'zoom' }, pointerSensitivity: 2, fineSensitivity: .1 };
  applyCameraButtons(controls, { shiftKey: true }, preferences, { left: 'rotate' });
  assert.deepEqual(controls.mouseButtons, { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE });
  assert.equal(controls.rotateSpeed, .2); assert.equal(controls.panSpeed, .2);
  applyCameraButtons(controls, { shiftKey: true }, preferences, { left: 'rotate', rotateAsPan: true, preserveShift: false });
  assert.equal(controls.mouseButtons.LEFT, MOUSE.PAN); assert.equal(controls.mouseButtons.RIGHT, MOUSE.PAN);
  applyCameraButtons(controls, { shiftKey: true }, preferences, { left: 'rotate', preserveShift: false });
  assert.equal(controls.mouseButtons.LEFT, MOUSE.ROTATE, 'Quad perspective retains the native Shift swap');
  applyCameraButtons(controls, { shiftKey: true, ctrlKey: true }, preferences, { left: 'rotate', fine: false });
  assert.equal(controls.mouseButtons.LEFT, MOUSE.ROTATE); assert.equal(controls.rotateSpeed, 2, 'Showcase does not apply Shift fine sensitivity');
  applyCameraButtons(controls, {}, preferences, { left: 'work' }); assert.equal(controls.mouseButtons.LEFT, null);
  assert.equal(orbitMouseAction('toggle'), null);
});
