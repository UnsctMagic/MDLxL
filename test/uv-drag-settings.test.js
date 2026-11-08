import test from 'node:test';
import assert from 'node:assert/strict';
import { uvPieceCenters, uvPieces, uvSnapFactor, uvSnapTurn, uvTurn, uvZoom } from '../src/uv-tools.js';
import { DEFAULT_UV_DRAG, UV_DRAG_PRESETS, normalizeUVDrag, uvDragPreset } from '../src/uv-drag-settings.js';
import { connectedVertices } from '../app/classic-gestures.js';
import { normalizePreferences } from '../src/preferences.js';

const degrees = 180 / Math.PI;
const close = (actual, expected, message, within = 1e-9) => assert.ok(Math.abs(actual - expected) <= within, `${message || 'value'}: ${actual} is not ${expected}`);
const custom = changes => normalizeUVDrag({ ...DEFAULT_UV_DRAG, ...changes });

/** Frozen copy of uvTurn from main 9f11182d: the rule the defaults must keep. */
const MAIN_SENSITIVITY = 0.7, MAIN_STEADY = 24, MAIN_FX_STEADY = 48, MAIN_CENTRE = 2;
function mainTurn(drag, x, y) {
  drag.turn ??= 0;
  const px = x - drag.pivotScreen[0], py = y - drag.pivotScreen[1], radius = Math.hypot(px, py);
  if (radius < MAIN_CENTRE) return drag.turn;
  const angle = Math.atan2(py, px);
  if (drag.angle !== undefined) {
    const step = Math.atan2(Math.sin(angle - drag.angle), Math.cos(angle - drag.angle));
    const zone = drag.wrapperControls === false ? MAIN_FX_STEADY : Math.max(MAIN_STEADY, drag.reach || 0);
    const steady = Math.min(1, radius / zone, drag.radius / zone);
    drag.turn += step * steady * (drag.wrapperControls === false ? 1 : MAIN_SENSITIVITY) * (drag.fine ?? 1);
  }
  drag.angle = angle; drag.radius = radius;
  return drag.turn;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6D2B79F5) >>> 0; let mixed = state; mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1); mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61); return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296; };
}
/** A drag that mixes slow wandering, circling, passes over the centre, big jumps and repeated points. */
function recordedDrag(random, pivot, length = 240) {
  let x = pivot[0] + (random() - .5) * 400, y = pivot[1] + (random() - .5) * 400;
  const points = [[x, y]];
  while (points.length < length) {
    const kind = random();
    if (kind < .45) { x += (random() - .5) * 12; y += (random() - .5) * 12; }
    else if (kind < .7) { const angle = Math.atan2(y - pivot[1], x - pivot[0]) + random() * .4, radius = Math.hypot(x - pivot[0], y - pivot[1]); x = pivot[0] + Math.cos(angle) * radius; y = pivot[1] + Math.sin(angle) * radius; }
    else if (kind < .85) { x = pivot[0] + (random() - .5) * 5; y = pivot[1] + (random() - .5) * 5; }
    else if (kind < .95) { x += (random() - .5) * 500; y += (random() - .5) * 500; }
    points.push([x, y]);
  }
  return points;
}
const pivotFor = random => [(random() - .5) * 800, (random() - .5) * 800];

test('UV drag settings: the defaults are numerically identical to main over recorded drags', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const random = seededRandom(seed), pivotScreen = pivotFor(random), reach = [undefined, 0, 10, 24, 60, 300, random() * 500][seed % 7];
    const old = { pivotScreen, reach }, plain = { pivotScreen, reach }, defaults = { pivotScreen, reach, settings: normalizeUVDrag() };
    for (const [x, y] of recordedDrag(random, pivotScreen)) {
      const expected = mainTurn(old, x, y);
      assert.equal(uvTurn(plain, x, y), expected, `no settings, seed ${seed}`);
      assert.equal(uvTurn(defaults, x, y), expected, `default settings, seed ${seed}`);
    }
  }
});

test('UV drag settings: FX texture fitting ignores every setting', () => {
  const settingsList = [custom({ rotateStyle: 'leftRight', rotateSpeed: 200, rotateReverse: true }), custom({ rotateStyle: 'both', rotateZone: 0, rotateBigPieces: false }), custom({ rotateSpeed: 10, rotateZone: 100 })];
  for (let seed = 1; seed <= 300; seed++) {
    const random = seededRandom(seed * 17), pivotScreen = pivotFor(random), reach = seed % 2 ? 300 : undefined;
    const old = { pivotScreen, reach, wrapperControls: false }, fx = { pivotScreen, reach, wrapperControls: false, settings: settingsList[seed % 3] };
    for (const [x, y] of recordedDrag(random, pivotScreen)) assert.equal(uvTurn(fx, x, y), mainTurn(old, x, y), `seed ${seed}`);
  }
});

test('UV drag settings: Shift and Alt fine control stay identical, even changing mid-drag', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const random = seededRandom(seed * 31), pivotScreen = pivotFor(random), reach = random() * 200;
    const old = { pivotScreen, reach, wrapperControls: true }, next = { pivotScreen, reach, wrapperControls: true, settings: normalizeUVDrag() };
    for (const [x, y] of recordedDrag(random, pivotScreen)) {
      old.fine = next.fine = [1, .2, .04, .05][Math.floor(random() * 4)];
      assert.equal(uvTurn(next, x, y), mainTurn(old, x, y), `seed ${seed}`);
    }
  }
});

/** Walk a straight line in small steps, returning the last factor. */
function zoomAlong(drag, points, weight = 1) { let factor; for (const [x, y] of points) factor = uvZoom(drag, x, y, weight); return factor; }
const zoomDrag = (settings, start = [100, 0], pivotScreen = [0, 0]) => { const drag = { pivotScreen, settings: custom(settings) }; assert.equal(uvZoom(drag, start[0], start[1], 0), 1); return drag; };
const line = (from, to, steps = 50) => Array.from({ length: steps }, (_, step) => [from[0] + (to[0] - from[0]) * (step + 1) / steps, from[1] + (to[1] - from[1]) * (step + 1) / steps]);

test('UV Zoom centre: the size is the distance from the centre over the distance at grab', () => {
  const drag = zoomDrag({}); assert.equal(drag.zoomStyle, 'centre');
  close(uvZoom(drag, 75, 0, 1), .75, 'three quarters'); close(uvZoom(drag, 50, 0, 1), .5, 'half');
  close(uvZoom(drag, 0, 200, 1), 2, 'any direction counts, only the distance matters');
  const grow = zoomDrag({}); close(uvZoom(grow, 200, 0, 1), 2, 'twice as far is twice the size');
  const offset = zoomDrag({}, [130, 240], [100, 200]); close(uvZoom(offset, 115, 220, 1), .5, 'centre is the pivot, not the origin');
});

test('UV Zoom centre: within 3 px of the centre is exactly zero, with no floating-point residue', () => {
  for (const point of [[3, 0], [0, 3], [2, 2], [1, 0], [0, 0], [-2, 1]]) {
    const drag = zoomDrag({}); zoomAlong(drag, line([100, 0], [10, 0]));
    assert.equal(uvZoom(drag, point[0], point[1], 1), 0, `at ${point}`);
  }
  for (let seed = 1; seed <= 100; seed++) {
    const random = seededRandom(seed * 7), start = [40 + random() * 300, 40 + random() * 300], drag = zoomDrag({}, start);
    for (const [x, y] of recordedDrag(random, [0, 0], 80)) uvZoom(drag, x, y, 1);
    assert.equal(uvZoom(drag, .5, .5, 1), 0, `seed ${seed}`);
  }
  const outside = zoomDrag({}); close(uvZoom(outside, 3.5, 0, 1), .035, 'just outside is not collapsed');
});

test('UV Zoom centre: carrying on past the centre stays collapsed', () => {
  const drag = zoomDrag({}); zoomAlong(drag, line([100, 0], [0, 0]));
  for (const [x, y] of line([0, 0], [-400, 30], 80)) assert.equal(uvZoom(drag, x, y, 1), 0, `at ${x},${y}`);
  assert.equal(uvZoom(drag, -400, -300, 1), 0, 'wandering on the far side stays collapsed');
  assert.equal(uvZoom(drag, -2, 1, 1), 0); assert.equal(uvZoom(drag, -50, 10, 1), 0, 'out the far side again stays collapsed');
});

test('UV Zoom centre: coming back across the centre grows it again', () => {
  const drag = zoomDrag({}); zoomAlong(drag, line([100, 0], [-80, 0]));
  assert.equal(uvZoom(drag, -80, 0, 1), 0);
  zoomAlong(drag, line([-80, 0], [0, 0]));
  close(zoomAlong(drag, line([0, 0], [50, 0])), .5, 'half way back');
  close(zoomAlong(drag, line([50, 0], [100, 0])), 1, 'back at the grab point');
});

test('UV Zoom centre: a sweep that misses the centre never grows back, and returning restores it', () => {
  for (const miss of [5, 10, 30, -30]) {
    const drag = zoomDrag({}, [200, miss]); let previous = 1;
    for (const [x, y] of line([200, miss], [-200, miss], 400)) { const factor = uvZoom(drag, x, y, 1); assert.ok(factor <= previous + .005, `miss ${miss} grew at ${x}`); previous = factor; }
    assert.equal(previous, 0, `miss ${miss} ends collapsed`);
    close(zoomAlong(drag, line([-200, miss], [200, miss], 400)), 1, `miss ${miss} comes back`);
  }
});

test('UV Zoom centre: leaving on the side it came from grows it again', () => {
  const drag = zoomDrag({}); zoomAlong(drag, line([100, 0], [2, 0]));
  assert.equal(uvZoom(drag, 2, 0, 1), 0);
  close(uvZoom(drag, 50, 5, 1), Math.hypot(50, 5) / 100, 'same side grows');
  const sideways = zoomDrag({}); zoomAlong(sideways, line([100, 0], [1, 0]));
  close(uvZoom(sideways, 0, 60, 1), .6, 'leaving at a right angle is not the far side');
});

test('UV Zoom centre: a fast mouse that jumps across in one sample counts as crossing', () => {
  const drag = zoomDrag({});
  assert.equal(uvZoom(drag, -100, 0, 1), 0, 'jumped straight across');
  assert.equal(uvZoom(drag, -200, 1, 1), 0, 'carrying on stays collapsed');
  close(uvZoom(drag, 60, 0, 1), .6, 'jumped back across grows again');
  const clipped = zoomDrag({}); assert.equal(uvZoom(clipped, -60, 2, 1), 0, 'line passes within 3 px');
  const wide = zoomDrag({}); assert.equal(uvZoom(wide, -100, 30, 1), 0, 'behind the centre stays collapsed even off the line');
  const circling = zoomDrag({}); close(uvZoom(circling, 0, 100, 1), 1, 'out to a right angle only the distance counts', .01); assert.equal(uvZoom(circling, -50, 86.6, 1), 0, 'a third of the way around behind the centre is collapsed');
});

test('UV Zoom centre: changing Shift mid-drag never jumps, and a repeated point adds nothing', () => {
  const drag = zoomDrag({}), before = uvZoom(drag, 80, 0, 1);
  assert.equal(uvZoom(drag, 80, 0, .2), before, 'pressing Shift without moving');
  close(uvZoom(drag, 70, 0, .2), before - .02, 'Shift makes each step small');
  const held = uvZoom(drag, 70, 0, 1); close(held, before - .02, 'releasing Shift without moving');
  close(uvZoom(drag, 60, 0, 1), held - .1, 'released Shift moves at full size');
  const fine = zoomDrag({}); close(zoomAlong(fine, line([100, 0], [0, 0]), .2), .8, 'fine control all the way in stays partly open');
});

test('UV Zoom: a centre-style drag starting within 12 px of the centre uses rightUp', () => {
  const near = zoomDrag({}, [10, 0]); assert.equal(near.zoomStyle, 'rightUp');
  close(uvZoom(near, 20, 0, 1), 1.1, 'right grows by the right/up rule'); close(uvZoom(near, 20, 10, 1), 1, 'down shrinks');
  assert.equal(zoomDrag({}, [0, 12]).zoomStyle, 'rightUp'); assert.equal(zoomDrag({}, [0, 0]).zoomStyle, 'rightUp');
  assert.equal(zoomDrag({}, [12.5, 0]).zoomStyle, 'centre');
  assert.equal(zoomDrag({ zoomStyle: 'leftRight' }, [5, 0]).zoomStyle, 'leftRight', 'only the centre style needs the fallback');
  assert.equal(uvZoom({ pivotScreen: [0, 0] }, 100, 0, 0), 1, 'missing settings read as the defaults');
});

test('UV Zoom: speed scales every style and collapse is still reachable', () => {
  const fast = zoomDrag({ zoomSpeed: 200 }); close(uvZoom(fast, 75, 0, 1), .5, 'twice as fast'); assert.equal(uvZoom(fast, 50, 0, 1), 0, 'collapses half way');
  const slow = zoomDrag({ zoomSpeed: 50 }); close(uvZoom(slow, 50, 0, 1), .75, 'half as fast');
  zoomAlong(slow, line([50, 0], [0, 0])); close(uvZoom(slow, 1, 0, 1), .5, 'centre is half way at half speed');
  assert.equal(zoomAlong(slow, line([0, 0], [-100, 0])), 0, 'carrying on reaches zero');
  const weighted = zoomDrag({}); close(uvZoom(weighted, 90, 0, 2), .8, 'UV transform sensitivity is the sample weight');
  const rightUp = zoomDrag({ zoomStyle: 'rightUp', zoomSpeed: 200 }); close(uvZoom(rightUp, 110, 0, 1), 1.2, 'rightUp with speed');
  const leftRight = zoomDrag({ zoomStyle: 'leftRight', zoomSpeed: 50 }); close(uvZoom(leftRight, 120, 0, 1), 1.1, 'leftRight with speed');
});

test('UV Zoom: rightUp and leftRight keep their formulas and reach zero', () => {
  const rightUp = zoomDrag({ zoomStyle: 'rightUp' });
  close(uvZoom(rightUp, 120, 0, 1), 1.2, 'right'); close(uvZoom(rightUp, 120, -10, 1), 1.3, 'up'); close(uvZoom(rightUp, 110, -10, 1), 1.2, 'left'); close(uvZoom(rightUp, 110, 10, 1), 1, 'down');
  assert.equal(uvZoom(rightUp, -500, 10, 1), 0, 'collapses'); assert.equal(uvZoom(rightUp, -900, 10, 1), 0, 'never rebounds');
  const leftRight = zoomDrag({ zoomStyle: 'leftRight' });
  close(uvZoom(leftRight, 130, 0, 1), 1.3, 'right'); close(uvZoom(leftRight, 130, -400, 1), 1.3, 'up and down do nothing'); close(uvZoom(leftRight, 90, 0, .5), 1.1, 'weighted left');
  assert.equal(uvZoom(leftRight, -500, 0, 1), 0);
});

const quarterCircle = (radius, steps = 90) => Array.from({ length: steps + 1 }, (_, step) => [Math.cos(step / steps * Math.PI / 2) * radius, Math.sin(step / steps * Math.PI / 2) * radius]);
const turnAlong = (drag, points) => { let turn = 0; for (const [x, y] of points) { turn = uvTurn(drag, x, y); assert.ok(Number.isFinite(turn), 'turn is finite'); } return turn; };
const turnDrag = (settings, more) => ({ pivotScreen: [0, 0], wrapperControls: true, settings: custom(settings), ...more });

test('UV Rotate circle: speed, zone 0 and big pieces', () => {
  close(turnAlong(turnDrag({}), quarterCircle(100)) * degrees, 63, 'default strength');
  close(turnAlong(turnDrag({ rotateSpeed: 140 }), quarterCircle(100)) * degrees, 126, 'speed');
  close(turnAlong(turnDrag({ rotateZone: 100 }), quarterCircle(50)) * degrees, 31.5, 'wider zone turns less');
  close(turnAlong(turnDrag({ rotateZone: 0, rotateBigPieces: false, rotateSpeed: 100 }), quarterCircle(5)) * degrees, 90, 'zone 0 follows right up to the centre');
  for (let seed = 1; seed <= 40; seed++) {
    const random = seededRandom(seed * 3);
    for (const reach of [0, 80]) turnAlong(turnDrag({ rotateZone: 0, rotateBigPieces: reach > 0 }, { reach }), [...recordedDrag(random, [0, 0], 120), [0, 0], [0, 0], [1, 0]]);
  }
  const big = turnAlong(turnDrag({}, { reach: 300 }), quarterCircle(100)), off = turnAlong(turnDrag({ rotateBigPieces: false }, { reach: 300 }), quarterCircle(100));
  close(big * degrees, 21, 'big piece steadies by its own size'); close(off * degrees, 63, 'big pieces off ignores the reach');
  close(turnAlong(turnDrag({ rotateZone: 0 }, { reach: 200 }), quarterCircle(100)) * degrees, 31.5, 'big pieces still grows a zone of 0');
  const skip = turnDrag({}); uvTurn(skip, 50, 0); uvTurn(skip, 1, 1); assert.equal(skip.angle, 0, 'the 2 px centre skip stays');
  close(turnAlong(turnDrag({ rotateReverse: true }), quarterCircle(100)) * degrees, 63, 'reverse is only for the other styles');
});

test('UV Rotate leftRight: one degree per pixel, right is clockwise, independent of the centre', () => {
  const drag = turnDrag({ rotateStyle: 'leftRight', rotateSpeed: 100 });
  uvTurn(drag, -40, 5); close(uvTurn(drag, 20, 500) * degrees, 60, 'sixty pixels right'); close(uvTurn(drag, 20, -500) * degrees, 60, 'vertical does nothing');
  close(uvTurn(drag, 20, -500) * degrees, 60, 'repeated point adds nothing'); close(uvTurn(drag, 0, 0) * degrees, 40, 'over the centre, no skip');
  const fast = turnDrag({ rotateStyle: 'leftRight', rotateSpeed: 50 }); uvTurn(fast, 0, 0); close(uvTurn(fast, 30, 0) * degrees, 15, 'speed');
  const reverse = turnDrag({ rotateStyle: 'leftRight', rotateSpeed: 100, rotateReverse: true }); uvTurn(reverse, 0, 0); close(uvTurn(reverse, 30, 0) * degrees, -30, 'reverse');
  const fine = turnDrag({ rotateStyle: 'leftRight', rotateSpeed: 100 }, { fine: .2 }); uvTurn(fine, 0, 0); close(uvTurn(fine, 30, 0) * degrees, 6, 'fine control');
});

test('UV Rotate both: around the centre plus the straight part, sideways over 48', () => {
  close(turnAlong(turnDrag({ rotateStyle: 'both', rotateSpeed: 100 }), quarterCircle(100)) * degrees, 90, 'circling keeps its strength', 1e-6);
  const outward = turnDrag({ rotateStyle: 'both', rotateSpeed: 100 }); uvTurn(outward, 100, 0); close(uvTurn(outward, 148, 0), 1, 'straight right: one radian per 48 px');
  const inward = turnDrag({ rotateStyle: 'both', rotateSpeed: 50 }); uvTurn(inward, 148, 0); close(uvTurn(inward, 100, 0), -.5, 'straight left with speed');
  const vertical = turnDrag({ rotateStyle: 'both' }); uvTurn(vertical, 0, 100); close(uvTurn(vertical, 0, 200), 0, 'straight up or down does not turn');
  const reverse = turnDrag({ rotateStyle: 'both', rotateSpeed: 100, rotateReverse: true }); uvTurn(reverse, 100, 0); close(uvTurn(reverse, 148, 0), -1, 'reverse flips the straight part');
  close(turnAlong(turnDrag({ rotateStyle: 'both', rotateSpeed: 100, rotateReverse: true }), quarterCircle(100)) * degrees, 90, 'reverse leaves circling alone', 1e-6);
  const repeat = turnDrag({ rotateStyle: 'both' }); uvTurn(repeat, 100, 0); const once = uvTurn(repeat, 140, 20); assert.equal(uvTurn(repeat, 140, 20), once, 'repeated point adds nothing');
  for (let seed = 1; seed <= 40; seed++) {
    const random = seededRandom(seed * 13);
    for (const rotateZone of [0, 1, 24]) turnAlong(turnDrag({ rotateStyle: 'both', rotateZone, rotateBigPieces: false }), [...recordedDrag(random, [0, 0], 120), [0, 0], [0, 0], [.5, 0]]);
  }
  const through = turnDrag({ rotateStyle: 'both', rotateSpeed: 100 }); uvTurn(through, -20, 0); close(uvTurn(through, 20, 0), 40 / 48, 'through the exact centre counts as left/right');
});

test('UV drag snapping: the applied value is rounded, the accumulated one is not', () => {
  close(uvSnapTurn(7 / degrees, 15) * degrees, 0, 'rounds down'); close(uvSnapTurn(8 / degrees, 15) * degrees, 15, 'rounds up'); close(uvSnapTurn(-136 / degrees, 45) * degrees, -135, 'negative'); close(uvSnapTurn(452 / degrees, 90) * degrees, 450, 'past a full turn');
  assert.equal(uvSnapTurn(.123, 0), .123, 'off'); assert.equal(uvSnapTurn(.123, undefined), .123, 'FX has no settings');
  assert.equal(uvSnapFactor(1.04, 5), 1.05); assert.equal(uvSnapFactor(1.12, 25), 1); assert.equal(uvSnapFactor(1.13, 25), 1.25); assert.equal(uvSnapFactor(.04, 10), 0); assert.equal(uvSnapFactor(0, 25), 0); assert.equal(uvSnapFactor(1.234, 0), 1.234); assert.equal(uvSnapFactor(1.234, undefined), 1.234);
  const drag = turnDrag({ rotateSnap: 15 }); const real = turnAlong(drag, quarterCircle(100).slice(0, 12));
  uvSnapTurn(real, 15); assert.equal(drag.turn, real, 'snapping leaves the accumulated turn alone');
});

test('normalizeUVDrag clamps numbers and refuses bad input', () => {
  assert.deepEqual(normalizeUVDrag(), { ...DEFAULT_UV_DRAG }); assert.deepEqual(normalizeUVDrag(null), { ...DEFAULT_UV_DRAG }); assert.deepEqual(normalizeUVDrag('x'), { ...DEFAULT_UV_DRAG }); assert.deepEqual(normalizeUVDrag([1]), { ...DEFAULT_UV_DRAG });
  const clamped = normalizeUVDrag({ rotateSpeed: 9000, rotateZone: -4, zoomSpeed: 1 });
  assert.equal(clamped.rotateSpeed, 200); assert.equal(clamped.rotateZone, 0); assert.equal(clamped.zoomSpeed, 10);
  const bad = normalizeUVDrag({ rotateStyle: 'spin', rotateSpeed: 'fast', rotateZone: null, rotateBigPieces: 'no', rotateReverse: 1, rotateSnap: 7, zoomStyle: 'x', zoomSpeed: true, zoomSnap: 3 });
  assert.deepEqual(bad, { ...DEFAULT_UV_DRAG });
  const good = { rotateStyle: 'both', rotateSpeed: 33, rotateZone: 0, rotateBigPieces: false, rotateReverse: true, rotateSnap: 45, zoomStyle: 'leftRight', zoomSpeed: 400, zoomSnap: 25 };
  assert.deepEqual(normalizeUVDrag(good), good); assert.equal(normalizeUVDrag({ rotateSpeed: '50.6' }).rotateSpeed, 51);
});

test('uvDragPreset compares all nine settings and names the built-in or custom', () => {
  assert.equal(uvDragPreset(), 'mdlxl');
  assert.deepEqual({ ...UV_DRAG_PRESETS.mdlxl }, { ...DEFAULT_UV_DRAG }, 'MDLxL is the locked default');
  for (const [name, preset] of Object.entries(UV_DRAG_PRESETS)) {
    assert.deepEqual(Object.keys(preset).sort(), Object.keys(DEFAULT_UV_DRAG).sort(), `${name} writes every key`);
    assert.deepEqual(normalizeUVDrag(preset), { ...preset }, `${name} survives normalizing`);
    assert.equal(uvDragPreset(preset), name);
    assert.equal(uvDragPreset({ rotateStyle: 'both', rotateSpeed: 33, zoomSnap: 25, ...preset }), name, `${name} ignores what was set before`);
  }
  for (const change of [{ rotateSpeed: 71 }, { rotateSnap: 45 }, { rotateReverse: true }, { zoomStyle: 'rightUp' }, { zoomSpeed: 300 }, { zoomSnap: 5 }, { rotateZone: 12 }, { rotateBigPieces: false }, { rotateStyle: 'both' }])
    assert.equal(uvDragPreset({ ...DEFAULT_UV_DRAG, ...change }), 'custom', Object.keys(change)[0]);
  assert.deepEqual(Object.keys(UV_DRAG_PRESETS), ['mdlxl', 'mdlvis', 'freeform', 'manipulator']);
  const table = { rotateStyle: ['circle', 'leftRight', 'circle', 'circle'], rotateSpeed: [70, 100, 100, 100], rotateZone: [24, 0, 0, 24], rotateBigPieces: [true, false, false, false], rotateReverse: [false, false, false, false], rotateSnap: [0, 0, 5, 15], zoomStyle: ['centre', 'upDown', 'centre', 'leftRight'], zoomSpeed: [100, 100, 100, 100], zoomSnap: [0, 0, 10, 10] };
  for (const [key, values] of Object.entries(table)) assert.deepEqual(Object.values(UV_DRAG_PRESETS).map(preset => preset[key]), values, key);
});

test('UV Zoom upDown: only vertical movement counts, up grows, compounding, ignoring UV sensitivity', () => {
  const up = zoomDrag({ zoomStyle: 'upDown' });
  close(uvZoom(up, 100, -100, 1), Math.E, 'one hundred pixels up'); close(uvZoom(up, 500, -100, 1), Math.E, 'left and right do nothing');
  close(uvZoom(up, 500, 0, 1), 1, 'coming back returns exactly'); close(uvZoom(up, 500, 200, 1), Math.exp(-2), 'down shrinks');
  for (let dy = 200; dy < 6000; dy += 800) assert.ok(uvZoom(up, 0, dy, 1) > 0, 'never reaches zero or flips');
  const fast = zoomDrag({ zoomStyle: 'upDown', zoomSpeed: 200 }); close(uvZoom(fast, 100, -50, 1), Math.E, 'speed');
  const steady = (uvSensitivity, shift) => { const drag = zoomDrag({ zoomStyle: 'upDown' }); drag.uvSensitivity = uvSensitivity; return uvZoom(drag, 100, -100, uvSensitivity * shift); };
  close(steady(1.7, 1), steady(1, 1), 'UV transform sensitivity does not change it'); close(steady(.3, 1), Math.E, 'nor does a small one');
  close(steady(1.7, .2), Math.exp(.2), 'Shift fine control stays');
  const drag = zoomDrag({ zoomStyle: 'upDown' }); uvZoom(drag, 100, -40, 1); close(uvZoom(drag, 100, -40, .2), Math.exp(.4), 'pressing Shift without moving'); close(uvZoom(drag, 100, -50, .2), Math.exp(.42), 'Shift makes each step small');
  assert.equal(drag.zoomStyle, 'upDown', 'a drag near the centre keeps its style'); assert.equal(zoomDrag({ zoomStyle: 'upDown' }, [2, 0]).zoomStyle, 'upDown');
});

test('preferences keep uvDrag and uvEachPiece, defaulting to the locked rule', () => {
  const defaults = normalizePreferences({});
  assert.deepEqual(defaults.uvDrag, { ...DEFAULT_UV_DRAG }); assert.equal(defaults.uvEachPiece, false);
  const saved = normalizePreferences({ uvDrag: { rotateStyle: 'both', zoomSpeed: 9999 }, uvEachPiece: true });
  assert.equal(saved.uvDrag.rotateStyle, 'both'); assert.equal(saved.uvDrag.zoomSpeed, 400); assert.equal(saved.uvEachPiece, true);
  assert.equal(normalizePreferences({ uvEachPiece: 'yes' }).uvEachPiece, false);
});

/** Quads: each entry is the four corners; returns a geoset with two triangles per quad. */
function quads(...corners) {
  const uv = corners.flat(2), faces = corners.flatMap((_, quad) => { const a = quad * 4; return [a, a + 1, a + 2, a, a + 2, a + 3]; });
  return { Vertices: new Float32Array(uv.length / 2 * 3), TVertices: [new Float32Array(uv)], Faces: new Uint16Array(faces) };
}
const square = (u, v, size = .25) => [[u, v], [u + size, v], [u + size, v + size], [u, v + size]];
const everyVertex = geoset => Array.from({ length: geoset.Vertices.length / 3 }, (_, index) => index);
const sorted = pieces => pieces.map(piece => [...piece].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);

test('Each piece: separate islands are separate pieces and a seam does not split one', () => {
  const apart = quads(square(0, 0), square(.5, .5)), all = everyVertex(apart);
  assert.deepEqual(sorted(uvPieces(apart, 0, all, all)), [[0, 1, 2, 3], [4, 5, 6, 7]]);
  // Two strips side by side, split at a seam: their shared edge is duplicated.
  const seam = quads(square(0, 0), square(.25, 0), square(.75, .75)), seamAll = everyVertex(seam);
  assert.deepEqual(sorted(uvPieces(seam, 0, seamAll, seamAll)), [[0, 1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11]]);
  assert.deepEqual(sorted(uvPieces(seam, 0, [1, 4], seamAll)), [[1, 4]], 'one point each side of the seam');
  assert.deepEqual(sorted(uvPieces(seam, 0, [0, 5], seamAll)), [[0], [5]], 'an unselected point on a seam does not join the sides');
  assert.deepEqual(sorted(uvPieces(apart, 0, [0, 2], all)), [[0, 2]], 'selected points of one island are one piece, like Select Connected');
  assert.deepEqual(sorted(uvPieces(apart, 0, [], all)), []);
  const lone = { Vertices: new Float32Array(9), TVertices: [new Float32Array([0, 0, .5, .5, .9, .9])], Faces: new Uint16Array() };
  assert.deepEqual(sorted(uvPieces(lone, 0, [0, 1, 2], [0, 1, 2])), [[0], [1], [2]], 'points with no triangle are their own piece');
});

test('Each piece: pieces use the live UV values and respect what is eligible', () => {
  const geoset = quads(square(0, 0), square(.5, .5)), all = everyVertex(geoset), moved = new Float32Array(geoset.TVertices[0]);
  moved.set(moved.subarray(0, 2), 4 * 2);
  assert.deepEqual(sorted(uvPieces(geoset, 0, all, all, moved)), [[0, 1, 2, 3, 4, 5, 6, 7]], 'moved onto the same spot');
  assert.deepEqual(sorted(uvPieces(geoset, 0, [0, 2], [0, 1, 3])), [[0], [2]], 'a hidden triangle does not connect');
});

test('Each piece: every group gets its own centre, parallel to the selection', () => {
  const geoset = quads(square(0, 0), square(.5, .5, .5)), all = everyVertex(geoset), order = [5, 0, 7, 2, 1, 3, 4, 6];
  const centers = uvPieceCenters(geoset, 0, order, all);
  assert.equal(centers.length, order.length * 2);
  order.forEach((index, position) => { const expected = index < 4 ? [.125, .125] : [.75, .75]; close(centers[position * 2], expected[0], 'u', 1e-6); close(centers[position * 2 + 1], expected[1], 'v', 1e-6); });
});

test('Each piece: matches one Select Connected walk per seed on random meshes', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const random = seededRandom(seed * 101), vertices = 12 + Math.floor(random() * 80), triangles = Math.floor(random() * 50), faces = [];
    for (let t = 0; t < triangles * 3; t++) faces.push(Math.floor(random() * vertices));
    const uv = new Float32Array(vertices * 2).map((_, offset) => random() + offset), geoset = { Vertices: new Float32Array(vertices * 3), TVertices: [uv], Faces: new Uint16Array(faces) };
    const all = everyVertex(geoset), selected = all.filter(() => random() < .6), member = new Set(selected), expected = [], placed = new Set();
    const usable = []; for (let offset = 0; offset < faces.length; offset += 3) usable.push(faces[offset], faces[offset + 1], faces[offset + 2]);
    for (const index of selected) { if (placed.has(index)) continue; const piece = connectedVertices(usable, [index]).filter(vertex => member.has(vertex)); piece.forEach(vertex => placed.add(vertex)); expected.push(piece); }
    assert.deepEqual(sorted(uvPieces(geoset, 0, selected, all)), sorted(expected), `seed ${seed}`);
  }
});

test('Each piece: thousands of separate triangles group quickly', () => {
  const count = 3000, uv = new Float32Array(count * 6), faces = new Uint32Array(count * 3);
  for (let triangle = 0; triangle < count; triangle++) { for (let corner = 0; corner < 3; corner++) { faces[triangle * 3 + corner] = triangle * 3 + corner; uv[(triangle * 3 + corner) * 2] = triangle * 2 + corner * .1; uv[(triangle * 3 + corner) * 2 + 1] = corner * corner * .1; } }
  const geoset = { Vertices: new Float32Array(count * 9), TVertices: [uv], Faces: faces }, all = everyVertex(geoset);
  const start = performance.now(), pieces = uvPieces(geoset, 0, all, all), elapsed = performance.now() - start;
  assert.equal(pieces.length, count); assert.ok(elapsed < 1000, `took ${elapsed.toFixed(0)} ms`);
});
