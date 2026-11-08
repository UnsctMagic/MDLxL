import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import * as frozenOverlay from './fixtures/rotate-frozen/movement-overlay.js';
import * as frozenDrag from './fixtures/rotate-frozen/rotation-drag.js';
import * as overlay from '../app/movement-overlay.js';
import { DEFAULT_ROTATION, DEFAULT_ROTATION_BEHAVIOR, ROTATION_PRESETS, beginRotationDrag, chooseLeverAxis, normalizeRotationPreferences, rotationBehavior, rotationDragDegrees, rotationOptions } from '../src/rotation-drag.js';
import { normalizePreferences } from '../src/preferences.js';

// The owner tests nothing by hand: "the defaults ARE my tests". An untouched
// profile must drag exactly as the frozen copies in test/fixtures/rotate-frozen do.

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6D2B79F5) >>> 0; let mixed = state; mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1); mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61); return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296; };
}
const pick = (random, list) => list[Math.floor(random() * list.length)];
const WIDTH = 800, HEIGHT = 600;
const ORBITS = [[500, 0, 0], [0, 0, 500], [0, -500, 0], [300, -400, 250], [-250, 350, 100], [400, 400, -300], [10, -5, 500], [120, -480, 40]];
const PLANES = [null, 'xy', 'xz', 'zx', 'yz'];
const HANDLES = [null, { axis: 'XYZ', free: true, dx: 1, dy: -1, unitsPerPixel: 1 }, { axis: 'Y', dx: 1, dy: -1, unitsPerPixel: 1, offHandle: true }, { axis: 'X' }, { axis: 'Y' }, { axis: 'Z' }];
const STYLES = ['lines', 'rings', 'arcs'];
const EDITORS = ['vertices', 'bones', 'movement', 'forge', 'showcase', 'emtr', 'glow'];
const DPI = [1, .67, 1.22, 2, .35], SPEED = [1, .3, 2, .01, 4, .75], PRECISION = [.1, .2, 1, .03, .5];
const camera = (perspective, position) => {
  const made = perspective ? new PerspectiveCamera(45, WIDTH / HEIGHT, .1, 10000) : new OrthographicCamera(-200, 200, 150, -150, .1, 10000);
  made.up.set(0, 0, 1); made.position.set(...position); made.lookAt(0, 0, 0); made.updateMatrixWorld(true);
  return made;
};
/** Wandering, circling, sweeping over the pivot, big jumps and repeated points, in event batches with Shift flipping inside them. */
function trace(random, pivot, press, length = 36) {
  let x = press.x, y = press.y, shift = random() < .2;
  const events = [];
  for (let e = 0; e < length; e++) {
    const samples = [], batch = 1 + Math.floor(random() * 3);
    for (let s = 0; s < batch; s++) {
      const kind = random();
      if (kind < .4) { x += (random() - .5) * 14; y += (random() - .5) * 14; }
      else if (kind < .68) { const angle = Math.atan2(y - pivot.y, x - pivot.x) + (random() - .3) * .5, radius = Math.hypot(x - pivot.x, y - pivot.y); x = pivot.x + Math.cos(angle) * radius; y = pivot.y + Math.sin(angle) * radius; }
      else if (kind < .8) { x = pivot.x + (random() - .5) * 18; y = pivot.y + (random() - .5) * 18; }
      else if (kind < .9) { x += (random() - .5) * 500; y += (random() - .5) * 500; }
      if (random() < .15) shift = !shift;
      samples.push({ dx: x - press.x, dy: y - press.y, shift });
    }
    events.push(samples);
  }
  return events;
}
const SAME = ['degrees', 'axisName', 'circle', 'sign', 'swept', 'preciseSwept', 'previousRaw', 'previous'];
const atBegin = ['constrained', 'lever', 'ringRadius', 'phase', 'unit', 'style', 'sensitivity', 'precision', 'plane', 'px', 'py'];
function agree(actual, expected, label) {
  for (const key of SAME) assert.strictEqual(actual[key], expected[key], `${label}: ${key}`);
  assert.deepStrictEqual(actual.tangent, expected.tangent, `${label}: tangent`);
  assert.deepStrictEqual(actual.pointer, expected.pointer, `${label}: pointer`);
}
function recorder() {
  const calls = [], target = {};
  return { calls, context: new Proxy(target, {
    get: (_, name) => (...args) => { calls.push([name, ...args]); },
    set: (_, name, value) => { calls.push(['set', name, value]); return true; },
  }) };
}
const drawn = (module, drag) => { const { calls, context } = recorder(); module.drawGizmoRotationFeedback(context, drag, 1.5); return calls; };
const handlesFor = (module, drag, press) => module.movementAxisHandles({ world: drag.world, x: drag.pivot.x, y: drag.pivot.y, visible: true, rotation: new Quaternion() }, drag.camera, WIDTH, HEIGHT, 100, 'world', 'rotate', { rotateHandles: drag.style }).map(handle => ({ ...handle, press }));
const flatHandles = handles => handles.map(({ axis, x, y, startX, startY, dx, dy, ring }) => ({ axis, x, y, startX, startY, dx, dy, ring }));

/** Replays one real pointer path: every coalesced sample, the event, then the once-per-frame apply of its last point. */
function replay(old, next, events, dpi, label) {
  let last;
  for (const samples of events) {
    for (const { dx, dy, shift } of samples) {
      const b = old(dx, dy, dpi, shift), a = next(dx, dy, dpi, shift);
      assert.strictEqual(a, b, `${label}: returned degrees`);
      last = { dx, dy, shift };
    }
    const frame = old(last.dx, last.dy, dpi, last.shift);
    assert.strictEqual(next(last.dx, last.dy, dpi, last.shift), frame, `${label}: per-frame apply`);
  }
}

function runProfile(profile, build) {
  let drags = 0;
  ORBITS.forEach((position, orbit) => [true, false].forEach(perspective => PLANES.forEach(plane => HANDLES.forEach((handle, handleIndex) => STYLES.forEach(style => ['world', 'local'].forEach(space => {
    const random = seededRandom(1 + orbit * 3 + (perspective ? 7 : 0) + PLANES.indexOf(plane) * 11 + handleIndex * 13 + STYLES.indexOf(style) * 17 + (space === 'world' ? 0 : 19));
    const sensitivity = pick(random, SPEED), precision = pick(random, PRECISION), dpi = pick(random, DPI), editor = pick(random, EDITORS);
    const world = new Vector3((random() - .5) * 40, (random() - .5) * 40, (random() - .5) * 40), view = camera(perspective, position);
    const screen = world.clone().project(view), pivot = { x: (screen.x + 1) * WIDTH / 2, y: (1 - screen.y) * HEIGHT / 2 };
    const press = { x: pivot.x + (random() - .5) * 180, y: pivot.y + (random() - .5) * 180 };
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(random() - .5, random() - .5, random() - .5).normalize(), random() * Math.PI);
    const viewportAppearance = { controllers: { rotateHandles: style } };
    const input = { ...press, world, camera: view, width: WIDTH, height: HEIGHT, handle, rotation, space, workplaneEnabled: !!plane, workplane: plane || 'xy', editor };
    const old = frozenOverlay.beginGizmoRotation({ ...input, preferences: { viewportAppearance, rotation: { sensitivity, precision, editors: {} } } });
    const next = overlay.beginGizmoRotation({ ...input, preferences: { viewportAppearance, rotation: build(sensitivity, precision, editor) } });
    const label = `${profile} orbit ${orbit} ${perspective ? 'perspective' : 'ortho'} ${plane} ${handle?.axis ?? 'none'} ${style} ${space} ${editor}`;
    for (const key of atBegin) assert.strictEqual(next[key], old[key], `${label}: ${key}`);
    assert.strictEqual(next.style, style, `${label}: the handle style reached the drag`);
    agree(next, old, `${label} at press`);
    assert.deepStrictEqual(drawn(overlay, next), drawn(frozenOverlay, old), `${label}: feedback at press`);
    replay((dx, dy, d, s) => { const value = frozenDrag.rotationDragDegrees(old, dx, dy, d, s); return value; },
      (dx, dy, d, s) => { const value = rotationDragDegrees(next, dx, dy, d, s); agree(next, old, label); return value; },
      trace(random, pivot, press), dpi, label);
    agree(next, old, `${label} at release`);
    assert.deepStrictEqual(drawn(overlay, next), drawn(frozenOverlay, old), `${label}: feedback at release`);
    assert.deepStrictEqual(flatHandles(overlay.rotationDisplayHandles(handlesFor(overlay, next, press), next)), flatHandles(frozenOverlay.rotationDisplayHandles(handlesFor(frozenOverlay, old, press), old)), `${label}: displayed handles`);
    drags++;
  }))))));
  return drags;
}

test('an untouched profile drags exactly as the frozen rule, on every camera, plane, handle, style and space', () => {
  const drags = runProfile('empty', (sensitivity, precision) => ({ sensitivity, precision, editors: {} }));
  assert.ok(drags >= 2000, `only ${drags} drags`);
});

test('explicit default values, global and per editor, drag exactly as the frozen rule too', () => {
  const global = runProfile('explicit global', (sensitivity, precision) => ({ ...ROTATION_PRESETS.mdlxl, sensitivity, precision, editors: {} }));
  const perEditor = runProfile('explicit per editor', (sensitivity, precision, editor) => ({ sensitivity, precision, editors: { [editor]: { ...DEFAULT_ROTATION_BEHAVIOR } } }));
  assert.ok(global >= 2000 && perEditor >= 2000);
});

test('the plain drag path every Showcase text handle uses is frozen as well', () => {
  for (let seed = 1; seed <= 600; seed++) {
    const random = seededRandom(seed * 31), sensitivity = pick(random, SPEED), precision = pick(random, PRECISION), pivot = { x: (random() - .5) * 800, y: (random() - .5) * 800 }, press = { x: pivot.x + (random() - .5) * 200, y: pivot.y + (random() - .5) * 200 };
    const preferences = { rotation: { sensitivity, precision, editors: {} } }, how = rotationBehavior(preferences, 'showcase');
    const old = frozenDrag.beginRotationDrag({ ...frozenDrag.rotationOptions(preferences, 'showcase'), ...press, pivot, axis: [0, 0, -1] });
    const next = beginRotationDrag({ ...how, sensitivity: how.handleSensitivity ?? how.sensitivity, ...press, pivot, axis: [0, 0, -1], ctrl: seed % 3 === 0, reach: 99 });
    for (const samples of trace(random, pivot, press)) for (const { dx, dy } of samples) {
      assert.strictEqual(rotationDragDegrees(next, dx, dy, 1, false, seed % 5 === 0), frozenDrag.rotationDragDegrees(old, dx, dy), `seed ${seed}`);
      agree(next, old, `seed ${seed}`);
    }
  }
});

test('direct drags, including a tangent with no constraint, keep the frozen meaning', () => {
  for (let seed = 1; seed <= 600; seed++) {
    const random = seededRandom(seed * 37), constrained = random() < .5, circle = constrained && random() < .4, press = { x: (random() - .5) * 200, y: (random() - .5) * 200 };
    const options = { ...press, constrained, circle, axis: [0, 0, pick(random, [-1, 0, .3, 1])], tangent: circle ? undefined : { x: random() - .5, y: random() - .5 }, sensitivity: pick(random, SPEED), precision: pick(random, PRECISION) };
    const old = frozenDrag.beginRotationDrag(options), next = beginRotationDrag(options), dpi = pick(random, DPI);
    for (const samples of trace(random, { x: 0, y: 0 }, press)) for (const { dx, dy, shift } of samples) {
      assert.strictEqual(rotationDragDegrees(next, dx, dy, dpi, shift), frozenDrag.rotationDragDegrees(old, dx, dy, dpi, shift), `seed ${seed}`);
      agree(next, old, `seed ${seed}`);
    }
  }
});

test('the plane direction helper and lever pick are unchanged by default', () => {
  for (const position of ORBITS) for (const perspective of [true, false]) for (const normal of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const input = { world: new Vector3(3, -4, 5), camera: camera(perspective, position), width: WIDTH, height: HEIGHT, normal: new Vector3(...normal) };
    assert.deepStrictEqual(overlay.constrainedRotationTangent(input), frozenOverlay.constrainedRotationTangent(input));
  }
  const tangents = { X: [0, 0], Y: [-3, 1], Z: [0, 2] }, random = seededRandom(5);
  for (let i = 0; i < 400; i++) { const dx = (random() - .5) * 20, dy = (random() - .5) * 20; assert.strictEqual(chooseLeverAxis('X', tangents, dx, dy), frozenDrag.chooseLeverAxis('X', tangents, dx, dy)); }
});

test('default preferences gain no new keys anywhere', () => {
  assert.deepStrictEqual(normalizeRotationPreferences({}), { sensitivity: 1, precision: .1, editors: {} });
  assert.deepStrictEqual(normalizeRotationPreferences(undefined), { ...DEFAULT_ROTATION, editors: {} });
  assert.deepStrictEqual(normalizePreferences({}).rotation, { sensitivity: 1, precision: .1, editors: {} });
  assert.deepStrictEqual(normalizeRotationPreferences({ ...ROTATION_PRESETS.mdlxl, editors: {} }), { sensitivity: 1, precision: .1, editors: {} }, 'an explicit default is not written');
  assert.deepStrictEqual(rotationOptions({}, 'vertices'), { sensitivity: 1, precision: .1 });
  assert.deepStrictEqual(rotationOptions({ rotation: { handleDrag: 'ring', snap: 15, editors: { forge: { faceOn: 'arrow', sensitivity: .5 } } } }, 'forge'), { sensitivity: .5, precision: .1 }, 'rotationOptions stays speed only');
});
