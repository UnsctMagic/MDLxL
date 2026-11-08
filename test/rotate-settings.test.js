import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { beginGizmoRotation, constrainedRotationTangent, movementAxisHandles } from '../app/movement-overlay.js';
import { DEFAULT_ROTATION_BEHAVIOR, MDLVIS_SIGN, ROTATION_EDITORS, ROTATION_PRESETS, beginRotationDrag, chooseLeverAxis, normalizeRotationPreferences, rotationBehavior, rotationDragDegrees, rotationOptions, rotationPresetId, rotationRim, rotationRingTangent, rotationSettingApplies } from '../src/rotation-drag.js';
import { rotationPieces, selectedPieces } from '../app/classic-gestures.js';
import { normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { transformVertices } from '../src/editor-commands.js';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { createForgeShape, forgeShapeMesh } from '../src/forge-shape-editing.js';

const close = (actual, expected, label, within = 1e-8) => assert.ok(Math.abs(actual - expected) <= within, `${label}: ${actual} is not ${expected}`);
const ortho = (position, up = [0, 1, 0]) => { const c = new OrthographicCamera(-200, 200, 150, -150, .1, 10000); c.up.set(...up); c.position.set(...position); c.lookAt(0, 0, 0); c.updateMatrixWorld(true); return c; };
const perspective = () => { const c = new PerspectiveCamera(45, 800 / 600, .1, 10000); c.up.set(0, 0, 1); c.position.set(300, -400, 250); c.lookAt(0, 0, 0); c.updateMatrixWorld(true); return c; };
const TOP = () => ortho([0, 0, 500]);
const drag = (rotation, options = {}, style) => {
  const camera = options.camera || TOP(), preferences = { rotation, ...(style && { viewportAppearance: { controllers: { rotateHandles: style } } }) };
  return beginGizmoRotation({ x: 500, y: 300, world: new Vector3(), width: 800, height: 600, workplaneEnabled: false, editor: 'vertices', ...options, camera, preferences });
};
const handle = axis => ({ axis });
const around = (d, radius, degrees, steps = 90) => {
  let value = 0;
  for (let i = 1; i <= steps; i++) { const a = degrees * i / steps * Math.PI / 180; value = rotationDragDegrees(d, d.pivot.x + radius * Math.cos(a) - d.start.x, d.pivot.y + radius * Math.sin(a) - d.start.y); }
  return value;
};

test('normalizing is sparse: a global default is not written, an editor keeps what overrides the global', () => {
  assert.deepEqual(normalizeRotationPreferences({ workplaneDrag: 'arrow', reverse: false, useDPI: true, centerZone: 8, snap: 0, handleSensitivity: null }), { sensitivity: 1, precision: .1, editors: {} });
  const saved = normalizeRotationPreferences({ workplaneDrag: 'circle', handleDrag: 'ring', linePick: 'axis', leverPick: 12, offHandle: 'none', faceOn: 'arrow', reverse: true, handleSensitivity: .5, useDPI: false, centerZone: 20, bigSelections: true, shift: 'snap', snap: 45, eachPiece: true, editors: { forge: { workplaneDrag: 'arrow', useDPI: true, handleSensitivity: null } } });
  assert.deepEqual(saved, { sensitivity: 1, precision: .1, workplaneDrag: 'circle', handleDrag: 'ring', linePick: 'axis', leverPick: 12, offHandle: 'none', faceOn: 'arrow', reverse: true, handleSensitivity: .5, useDPI: false, centerZone: 20, bigSelections: true, shift: 'snap', snap: 45, eachPiece: true, editors: { forge: { workplaneDrag: 'arrow', useDPI: true, handleSensitivity: null } } });
  assert.deepEqual(normalizeRotationPreferences(saved), saved, 'normalizing twice changes nothing');
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(normalizePreferences({ rotation: saved })))).rotation, saved, 'survives a portable export and import');
});

test('normalizing refuses bad values and clamps numbers', () => {
  assert.deepEqual(normalizeRotationPreferences({ workplaneDrag: 'spin', handleDrag: 1, linePick: true, offHandle: 'never', faceOn: null, shift: 'fine', snap: 7, reverse: 'yes', useDPI: 0, bigSelections: 1, centerZone: 'wide', leverPick: true, handleSensitivity: true, eachPiece: 'yes', editors: { forge: { workplaneDrag: 'spin', snap: 3 }, unknown: { snap: 5 } } }), { sensitivity: 1, precision: .1, editors: {} });
  assert.equal(normalizeRotationPreferences({ leverPick: 1 }).leverPick, 2); assert.equal(normalizeRotationPreferences({ leverPick: 99 }).leverPick, 30);
  assert.equal(normalizeRotationPreferences({ centerZone: 400 }).centerZone, 100); assert.equal(normalizeRotationPreferences({ centerZone: -3 }).centerZone, 0);
  assert.equal(normalizeRotationPreferences({ handleSensitivity: 99 }).handleSensitivity, 4); assert.equal(normalizeRotationPreferences({ handleSensitivity: 0 }).handleSensitivity, .01);
  assert.equal(normalizeRotationPreferences({ snap: '15' }).snap, 15);
  assert.equal('eachPiece' in normalizeRotationPreferences({ eachPiece: false }), false, 'off is the absence of the key');
  assert.equal(normalizeRotationPreferences({ editors: { forge: { eachPiece: true } } }).editors.forge, undefined, 'Each piece is not per editor');
});

test('EMTR and Glow Up are two entries that each hold their own settings', () => {
  assert.deepEqual(Object.keys(ROTATION_EDITORS), ['vertices', 'bones', 'movement', 'forge', 'emtr', 'glow', 'showcase']);
  const preferences = { rotation: { sensitivity: 2, editors: { emtr: { sensitivity: .5, handleDrag: 'ring' }, glow: { sensitivity: .25 } } } };
  assert.deepEqual(rotationOptions(preferences, 'emtr'), { sensitivity: .5, precision: .1 }); assert.deepEqual(rotationOptions(preferences, 'glow'), { sensitivity: .25, precision: .1 });
  assert.equal(rotationBehavior(preferences, 'emtr').handleDrag, 'ring'); assert.equal(rotationBehavior(preferences, 'glow').handleDrag, 'swing');
});

test('rotationBehavior: the editor over the global over the default', () => {
  const none = rotationBehavior({}, 'vertices');
  assert.deepEqual(none, { sensitivity: 1, precision: .1, ...DEFAULT_ROTATION_BEHAVIOR }); assert.equal('editors' in none, false); assert.equal('eachPiece' in none, false);
  const preferences = { rotation: { handleDrag: 'ring', snap: 15, handleSensitivity: 2, editors: { forge: { handleDrag: 'swing', handleSensitivity: null } } } };
  assert.equal(rotationBehavior(preferences, 'vertices').handleDrag, 'ring'); assert.equal(rotationBehavior(preferences, 'vertices').handleSensitivity, 2);
  assert.equal(rotationBehavior(preferences, 'forge').handleDrag, 'swing', 'an editor can go back to the default'); assert.equal(rotationBehavior(preferences, 'forge').snap, 15); assert.equal(rotationBehavior(preferences, 'forge').handleSensitivity, null);
});

test('built-in presets write every key, with the agreed values', () => {
  const table = {
    sensitivity: [1, 1, 1, 1], precision: [.1, 1, .03, .1], workplaneDrag: ['arrow', 'leftRight', 'circle', 'arrow'], handleDrag: ['swing', 'ring', 'swing', 'swing'], linePick: ['lever', 'axis', 'axis', 'axis'], leverPick: [6, 6, 6, 6], offHandle: ['wheel', 'wheel', 'wheel', 'wheel'], faceOn: ['circle', 'arrow', 'circle', 'circle'],
    reverse: [false, false, false, false], handleSensitivity: [null, null, null, null], useDPI: [true, false, false, false], centerZone: [8, 0, 0, 8], bigSelections: [false, false, false, false], shift: ['slow', 'slow', 'slow', 'slow'], snap: [0, 0, 5, 15],
  };
  assert.deepEqual(Object.keys(ROTATION_PRESETS), ['mdlxl', 'mdlvis', 'freeform', 'manipulator']);
  for (const [key, values] of Object.entries(table)) assert.deepEqual(Object.values(ROTATION_PRESETS).map(preset => preset[key]), values, key);
  for (const preset of Object.values(ROTATION_PRESETS)) { assert.deepEqual(Object.keys(preset).sort(), Object.keys(table).sort()); assert.equal('eachPiece' in preset, false); }
});

test('rotationPresetId names the built-in, at any level and whatever was stored before', () => {
  assert.equal(rotationPresetId({}), 'mdlxl'); assert.equal(rotationPresetId(undefined), 'mdlxl');
  for (const [id, preset] of Object.entries(ROTATION_PRESETS)) {
    assert.equal(rotationPresetId(preset), id);
    assert.equal(rotationPresetId(normalizeRotationPreferences(preset)), id, 'after normalizing');
    assert.equal(rotationPresetId({ ...preset, eachPiece: true, editors: { forge: { snap: 90 } } }), id, 'Each piece and overrides are not part of a preset');
    assert.equal(rotationPresetId(rotationBehavior({ rotation: { handleDrag: 'leftRight', snap: 90, handleSensitivity: 3, editors: { forge: preset } } }, 'forge')), id, 'as an editor override');
  }
  assert.equal(rotationPresetId({ precision: .2 }), 'custom'); assert.equal(rotationPresetId({ snap: 45 }), 'custom'); assert.equal(rotationPresetId({ handleSensitivity: 1 }), 'custom');
});

test('rotationSettingApplies follows the matrix: no option shows where it can do nothing', () => {
  const editors = Object.keys(ROTATION_EDITORS), rows = {
    workplaneDrag: ['vertices', 'forge', 'movement'], faceOn: ['vertices', 'forge', 'movement'], offHandle: ['vertices', 'forge', 'movement'],
    handleDrag: ['vertices', 'forge', 'movement', 'emtr', 'glow'], linePick: ['vertices', 'forge', 'movement', 'emtr', 'glow'], leverPick: ['vertices', 'forge', 'movement', 'emtr', 'glow'],
    handleSensitivity: ['vertices', 'forge', 'movement', 'emtr', 'glow', 'showcase'], centerZone: ['vertices', 'forge', 'movement', 'emtr', 'glow', 'showcase'], sensitivity: ['vertices', 'forge', 'movement', 'emtr', 'glow', 'showcase'], snap: ['vertices', 'forge', 'movement', 'emtr', 'glow', 'showcase'],
    reverse: ['vertices', 'forge', 'movement', 'emtr', 'glow'], useDPI: ['vertices', 'forge', 'movement', 'emtr', 'glow'], shift: ['vertices', 'forge', 'movement', 'emtr', 'glow'], precision: ['vertices', 'forge', 'movement', 'emtr', 'glow'],
    bigSelections: ['vertices', 'forge', 'movement', 'showcase'], eachPiece: ['vertices', 'forge'],
  };
  for (const [key, shown] of Object.entries(rows)) {
    for (const editor of editors) assert.equal(rotationSettingApplies(key, editor), shown.includes(editor), `${key} in ${editor}`);
    assert.equal(rotationSettingApplies(key, 'all'), true, `${key} on All editors`); assert.equal(rotationSettingApplies(key), true);
  }
  assert.equal(rotationSettingApplies('nonsense', 'vertices'), false);
  for (const key of Object.keys(rows)) assert.equal(rotationSettingApplies(key, 'bones'), false, `Bones has no Rotate: ${key}`);
});

test('rotationSettingApplies with the current choices hides what they make moot', () => {
  const how = changes => rotationBehavior({ rotation: changes }, 'vertices');
  assert.equal(rotationSettingApplies('faceOn', 'vertices', how({})), true); assert.equal(rotationSettingApplies('faceOn', 'vertices', how({ workplaneDrag: 'circle' })), false);
  assert.equal(rotationSettingApplies('precision', 'vertices', how({ shift: 'snap' })), false); assert.equal(rotationSettingApplies('leverPick', 'vertices', how({ linePick: 'axis' })), false);
  assert.equal(rotationSettingApplies('reverse', 'vertices', how({})), true, 'the arrow is a straight path');
  assert.equal(rotationSettingApplies('reverse', 'vertices', how({ workplaneDrag: 'circle' })), false, 'every path sweeps');
  assert.equal(rotationSettingApplies('reverse', 'emtr', how({})), false, 'EMTR swings by default'); assert.equal(rotationSettingApplies('reverse', 'emtr', how({ handleDrag: 'ring' })), true);
  const noSweep = { workplaneDrag: 'leftRight', faceOn: 'arrow', handleDrag: 'leftRight', offHandle: 'none' };
  assert.equal(rotationSettingApplies('centerZone', 'vertices', how(noSweep)), false); assert.equal(rotationSettingApplies('bigSelections', 'vertices', how(noSweep)), false);
  assert.equal(rotationSettingApplies('centerZone', 'vertices', how({})), true); assert.equal(rotationSettingApplies('centerZone', 'showcase', how(noSweep)), true);
  assert.equal(rotationSettingApplies('eachPiece', 'movement', how({})), false, 'the matrix still comes first');
});

for (const plane of ['xy', 'xz', 'zx', 'yz']) test(`workplane leftRight, ${plane}: one degree per pixel to the right with the MDLVis sign, at any camera and press point`, () => {
  for (const camera of [perspective(), TOP(), ortho([500, 0, 0], [0, 0, 1]), ortho([0, -500, 0], [0, 0, 1])]) for (const [x, y] of [[500, 300], [400, 300], [410, 120]]) {
    const d = drag({ workplaneDrag: 'leftRight', faceOn: 'arrow' }, { camera, x, y, workplaneEnabled: true, workplane: plane });
    assert.deepEqual([d.tangent.x, d.tangent.y], [MDLVIS_SIGN[plane], 0]); assert.equal(d.circle, false);
    close(rotationDragDegrees(d, 40, 0), 40 * MDLVIS_SIGN[plane], 'right'); close(rotationDragDegrees(d, 40, 200), 40 * MDLVIS_SIGN[plane], 'vertical ignored'); close(rotationDragDegrees(d, -25, 0), -25 * MDLVIS_SIGN[plane], 'left');
  }
});

test('MDLVis signs match the source: XY +1, ZX -1, YZ +1', () => assert.deepEqual({ ...MDLVIS_SIGN }, { xy: 1, xz: -1, zx: -1, yz: 1 }));

test('workplane circle: every camera circles, never the arrow', () => {
  const d = drag({ workplaneDrag: 'circle' }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' });
  assert.equal(d.circle, true); assert.equal(d.tangent, undefined); assert.equal(d.ringRadius, undefined);
  close(Math.abs(around(d, 150, 90)), 90, 'a quarter circle');
});

test('workplane ring: a straight push along the ring tangent at the grab point, fixed for the drag', () => {
  const camera = perspective(), at = new Vector3(0, 0, 1).transformDirection(camera.matrixWorldInverse).toArray();
  const d = drag({ workplaneDrag: 'ring' }, { camera, x: 480, y: 250, workplaneEnabled: true, workplane: 'xy' }), expected = rotationRingTangent({ x: 480 - d.pivot.x, y: 250 - d.pivot.y }, at);
  close(d.tangent.x, expected.x, 'x'); close(d.tangent.y, expected.y, 'y'); close(Math.hypot(d.tangent.x, d.tangent.y), 1, 'unit');
  close(rotationDragDegrees(d, expected.x * 30, expected.y * 30), 30, 'along'); close(rotationDragDegrees(d, expected.x * 30 - expected.y * 200, expected.y * 30 + expected.x * 200), 30, 'across does nothing');
});

test('rotationRingTangent is the removed rule, restored', () => {
  close(rotationRingTangent({ x: 100, y: 0 }, [0, 0, 1]).x, 0, 'pull straight up on the right'); close(rotationRingTangent({ x: 100, y: 0 }, [0, 0, 1]).y, -1, 'up'); assert.deepEqual(rotationRingTangent({ x: 0, y: 0 }, [0, 0, 1]), { x: 1, y: 0 }, 'at the pivot of a facing axis');
  const onAxis = rotationRingTangent({ x: 50, y: 0 }, [1, 0, 0]); close(Math.hypot(onAxis.x, onAxis.y), 1, 'a press on the axis uses the near side'); close(onAxis.x, 0, 'perpendicular to it on screen');
});

test('Front/Top/Side arrow: the plane facing the camera gets a press-independent arrow', () => {
  const camera = TOP(), base = { world: new Vector3(), camera, width: 800, height: 600, normal: new Vector3(0, 0, 1) };
  assert.equal(constrainedRotationTangent(base).mode, 'circle');
  const arrow = constrainedRotationTangent({ ...base, faceOn: 'arrow' }); assert.equal(arrow.mode, 'line'); close(arrow.x, 1, 'mouse right turns positively'); close(arrow.y, 0, 'horizontal');
  for (const [x, y] of [[460, 300], [540, 300], [500, 220], [500, 380]]) { const d = drag({ faceOn: 'arrow' }, { camera, x, y, workplaneEnabled: true, workplane: 'xy' }); assert.equal(d.circle, false); close(d.tangent.x, 1, 'same arrow for every press'); close(rotationDragDegrees(d, 40, 0), 40, 'turns'); }
  const steered = drag({ faceOn: 'arrow', workplaneDrag: 'ring' }, { camera, x: 600, y: 300, workplaneEnabled: true, workplane: 'xy' }); close(steered.tangent.y, -1, 'the ring rule supplies the arrow');
  const circled = drag({ faceOn: 'arrow', workplaneDrag: 'circle' }, { camera, workplaneEnabled: true, workplane: 'xy' }); assert.equal(circled.circle, true, 'circle beats the arrow');
  const stays = drag({ workplaneDrag: 'leftRight' }, { camera, workplaneEnabled: true, workplane: 'xy' }); assert.equal(stays.circle, true, 'faceOn circle keeps the facing plane circling');
});

test('handle ring: Rings use the tangent at the grab, Lines the swing direction once picked', () => {
  const ring = drag({ handleDrag: 'ring' }, { x: 600, y: 300, handle: handle('Z') }, 'rings');
  assert.equal(ring.ringRadius, undefined); assert.equal(ring.lever, null); close(ring.tangent.y, -1, 'pull up'); close(rotationDragDegrees(ring, 0, -40), 40, 'one degree per pixel');
  assert.equal(ring.constrained, false, 'the constrained ring and slice drawing keep their meaning');
  const line = drag({ handleDrag: 'ring' }, { x: 668, y: 300, handle: handle('X') }, 'lines');
  assert.equal(line.lever, 'X'); assert.equal(line.axisName, null); assert.equal(rotationDragDegrees(line, 0, -3), 0, 'waits for the lever');
  close(rotationDragDegrees(line, 0, -40), 40, 'swinging up turns positively about Z'); assert.equal(line.axisName, 'Z'); close(line.tangent.y, -1, 'aimed along the swing');
});

test('handle leftRight: right turns one way from the handle facing, for Rings and Lines', () => {
  const ring = drag({ handleDrag: 'leftRight' }, { x: 600, y: 300, handle: handle('Z') }, 'rings'); assert.deepEqual(ring.tangent, { mode: 'line', x: -1, y: 0 });
  close(rotationDragDegrees(ring, 40, 0), -40, 'axis faces the viewer'); close(rotationDragDegrees(ring, 40, 900), -40, 'vertical ignored');
  const line = drag({ handleDrag: 'leftRight' }, { x: 668, y: 300, handle: handle('X') }, 'lines'); close(rotationDragDegrees(line, 20, -40), -20, 'sign known once the lever picks'); assert.equal(line.axisName, 'Z');
});

test('linePick axis: a Lines handle turns around its own axis, with no lever', () => {
  const camera = perspective();
  const swing = drag({ linePick: 'axis' }, { camera, handle: handle('X') }, 'lines'); assert.equal(swing.lever, null); assert.equal(swing.axisName, 'X'); assert.equal(swing.ringRadius, 68);
  const lever = drag({}, { camera, handle: handle('X') }, 'lines'); assert.equal(lever.lever, 'X'); assert.equal(lever.axisName, null);
  const straight = drag({ linePick: 'axis', handleDrag: 'ring' }, { camera, x: 460, y: 330, handle: handle('Y') }, 'lines'); assert.equal(straight.axisName, 'Y'); close(Math.hypot(straight.tangent.x, straight.tangent.y), 1, 'a tangent straight away');
  const rings = drag({ linePick: 'axis' }, { camera, handle: handle('X') }, 'rings'); assert.equal(rings.axisName, 'X', 'Rings were never levers');
  assert.equal(drag({ linePick: 'axis' }, { camera, handle: { axis: 'XYZ', free: true } }, 'lines').lever, null);
});

test('leverPick: how far the mouse moves before a Lines handle picks its axis', () => {
  const tangents = { X: [0, 0], Y: [-3, 1], Z: [0, 2] };
  assert.equal(chooseLeverAxis('X', tangents, 5, 0), null); assert.equal(chooseLeverAxis('X', tangents, 6, 0), 'Y'); assert.equal(chooseLeverAxis('X', tangents, 19, 0, 20), null); assert.equal(chooseLeverAxis('X', tangents, 20, 0, 20), 'Y');
  const d = drag({ leverPick: 30 }, { x: 668, y: 300, handle: handle('X') }, 'lines');
  rotationDragDegrees(d, 0, -29); assert.equal(d.axisName, null); rotationDragDegrees(d, 0, -31); assert.equal(d.axisName, 'Z');
});

test('reverse flips straight paths only', () => {
  const arrow = drag({ reverse: true }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' }); close(rotationDragDegrees(arrow, arrow.tangent.x * 40, arrow.tangent.y * 40), -40, 'workplane arrow');
  const ring = drag({ reverse: true, handleDrag: 'ring' }, { x: 600, y: 300, handle: handle('Z') }, 'rings'); close(rotationDragDegrees(ring, 0, -40), -40, 'handle ring');
  const line = drag({ reverse: true, handleDrag: 'ring' }, { x: 668, y: 300, handle: handle('X') }, 'lines'); close(rotationDragDegrees(line, 0, -40), -40, 'Lines');
  const left = drag({ reverse: true, workplaneDrag: 'leftRight', faceOn: 'arrow' }, { workplaneEnabled: true, workplane: 'xy' }); close(rotationDragDegrees(left, 40, 0), -40, 'left/right');
  for (const d of [drag({ reverse: true }, { x: 600, y: 300, handle: handle('Z') }, 'rings'), drag({ reverse: true }, { x: 600, y: 300, workplaneEnabled: true, workplane: 'xy' })]) {
    const plain = d.circle ? drag({}, { x: 600, y: 300, workplaneEnabled: true, workplane: 'xy' }) : drag({}, { x: 600, y: 300, handle: handle('Z') }, 'rings');
    assert.equal(around(d, 100, 90), around(plain, 100, 90), 'swept paths ignore it');
  }
});

test('handleSensitivity: only real handles, not the workplane or a drag off the handles', () => {
  const on = { handleSensitivity: .5, sensitivity: 2 };
  assert.equal(drag(on, { x: 600, y: 300, handle: handle('Z') }, 'rings').sensitivity, .5);
  assert.equal(drag(on, { x: 600, y: 300 }).sensitivity, 2, 'off the handles');
  assert.equal(drag(on, { x: 600, y: 300, handle: { axis: 'XYZ', free: true } }).sensitivity, 2, 'free handle'); assert.equal(drag(on, { x: 600, y: 300, handle: { axis: 'Z', offHandle: true } }).sensitivity, 2, 'FK off-handle');
  assert.equal(drag(on, { x: 600, y: 300, workplaneEnabled: true, handle: handle('Z') }).sensitivity, 2, 'workplane');
  assert.equal(drag({ sensitivity: 2 }, { x: 600, y: 300, handle: handle('Z') }, 'rings').sensitivity, 2, 'unset follows sensitivity');
  const scaled = drag({ handleSensitivity: .5, handleDrag: 'ring' }, { x: 600, y: 300, handle: handle('Z') }, 'rings'); close(rotationDragDegrees(scaled, 0, -40), 20, 'and it scales the turn');
});

test('useDPI off: Pointer sensitivity no longer multiplies the turn', () => {
  for (const useDPI of [true, false]) {
    const d = drag({ useDPI }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' });
    close(rotationDragDegrees(d, d.tangent.x * 40, d.tangent.y * 40, 2), useDPI ? 80 : 40, `useDPI ${useDPI}`);
  }
});

test('centerZone: the flat-view hold, and the handle rim on its piecewise map', () => {
  for (const [zone, rim] of [[8, 68], [4, 34], [0, 0], [1, 8.5], [9, 69], [20, 80], [100, 160]]) assert.equal(rotationRim(zone), rim, `rim for ${zone}`);
  assert.equal(drag({}, { x: 600, y: 300 }).ringRadius, 68); assert.equal(drag({ centerZone: 20 }, { x: 600, y: 300 }).ringRadius, 80); assert.equal(drag({ centerZone: 4 }, { x: 600, y: 300, handle: handle('Z') }, 'rings').ringRadius, 34);
  assert.equal(drag({ centerZone: 0 }, { x: 600, y: 300 }).ringRadius, 0, 'no rim: a plain sweep');
  const hold = beginRotationDrag({ x: 100, centerZone: 40 }); rotationDragDegrees(hold, -70, 0); assert.equal(hold.swept, 0, 'inside the zone the angle holds');
  const free = beginRotationDrag({ x: 3, centerZone: 0 }); const turned = rotationDragDegrees(free, -3, 3); assert.ok(Math.abs(turned) > 80, 'zone 0 follows right up to the centre');
  const centre = beginRotationDrag({ x: 100, centerZone: 0 }); rotationDragDegrees(centre, -100, 90); const before = centre.swept; rotationDragDegrees(centre, -100, 0); assert.equal(centre.swept, before, 'the exact centre has no direction');
  const swing = drag({ centerZone: 0 }, { x: 600, y: 300 }); close(Math.abs(rotationDragDegrees(swing, -100, 100)), 45, 'no rim still sweeps');
});

test('bigSelections: the zone grows to the on-screen size of what turns, only when on', () => {
  let asked = 0; const reach = () => { asked++; return 300; };
  const off = drag({}, { x: 600, y: 300, reach }); assert.equal(asked, 0, 'the default never measures'); assert.equal(off.ringRadius, 68); assert.equal(off.steady, 0);
  const rim = drag({ bigSelections: true }, { x: 600, y: 300, reach }); assert.equal(asked, 1); assert.equal(rim.ringRadius, 300); close(Math.abs(rotationDragDegrees(rim, -100, 100)), Math.hypot(100, 100) / 300 * 180 / Math.PI, 'inside the piece the rate is steady', 1e-6);
  const small = drag({ bigSelections: true }, { x: 600, y: 300, reach: () => 10 }); assert.equal(small.ringRadius, 68, 'never below the rim');
  const circle = drag({ bigSelections: true }, { x: 600, y: 300, workplaneEnabled: true, workplane: 'xy', reach }); close(Math.abs(around(circle, 100, 90)), 30, 'a sweep inside the piece turns less', 1e-6);
  const outside = drag({ bigSelections: true }, { x: 900, y: 300, workplaneEnabled: true, workplane: 'xy', reach }); close(Math.abs(around(outside, 400, 90)), 90, 'outside the piece nothing changes', 1e-6);
  assert.equal(drag({ bigSelections: true }, { x: 600, y: 300 }).ringRadius, 68, 'no size known');
});

test('Shift snap: one 15 degree step, no precision, nothing lost on release', () => {
  const d = drag({ shift: 'snap', precision: .1 }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' }), at = n => [d.tangent.x * n, d.tangent.y * n];
  close(rotationDragDegrees(d, ...at(23)), 23, 'free'); assert.equal(d.snapped, false);
  assert.equal(rotationDragDegrees(d, ...at(23), 1, true), 30, 'rounds up'); assert.equal(d.snapped, true); assert.equal(rotationDragDegrees(d, ...at(22), 1, true), 15, 'and down');
  close(rotationDragDegrees(d, ...at(22)), 22, 'release restores the real amount: precision did not apply');
  assert.equal(Object.is(rotationDragDegrees(d, ...at(-1), 1, true), 0), true, 'never negative zero');
});

test('Ctrl snap: held after the drag started, the total rounds to the step and the real amount survives', () => {
  for (const snap of [1, 5, 15, 45, 90]) {
    const d = drag({ snap }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' }), at = n => [d.tangent.x * n, d.tangent.y * n];
    close(rotationDragDegrees(d, ...at(52.5)), 52.5, 'without Ctrl');
    assert.equal(rotationDragDegrees(d, ...at(52.5), 1, false, true), Math.round(52.5 / snap) * snap, `step ${snap}`);
    close(rotationDragDegrees(d, ...at(52.5)), 52.5, 'letting go');
  }
  const none = drag({ snap: 0 }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' }); close(rotationDragDegrees(none, none.tangent.x * 7.3, none.tangent.y * 7.3, 1, false, true), 7.3, 'no step: Ctrl does nothing'); assert.equal(none.snapped, false);
});

test('Ctrl snap: Ctrl held from the press keeps its old meaning until let go once', () => {
  const d = drag({ snap: 15 }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy', ctrl: true }), at = n => [d.tangent.x * n, d.tangent.y * n];
  close(rotationDragDegrees(d, ...at(23), 1, false, true), 23, 'held since the press'); close(rotationDragDegrees(d, ...at(23), 1, false, false), 23, 'let go');
  assert.equal(rotationDragDegrees(d, ...at(23), 1, false, true), 30, 'pressed again');
  const plain = beginRotationDrag({ constrained: true, tangent: { x: 1, y: 0 }, snap: 15, ctrl: true }); assert.equal(plain.ctrlAtPress, true);
});

test('Shift and Ctrl together: the Ctrl step wins and Shift slow still applies per sample', () => {
  const d = drag({ shift: 'snap', snap: 5 }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' }); assert.equal(rotationDragDegrees(d, d.tangent.x * 23, d.tangent.y * 23, 1, true, true), 25);
  const slow = drag({ snap: 5, precision: .5 }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' }); assert.equal(rotationDragDegrees(slow, slow.tangent.x * 20, slow.tangent.y * 20, 1, true, true), 10);
});

test('samples each carry their own keys through a coalesced batch', () => {
  const d = drag({ precision: .5, snap: 5 }, { camera: perspective(), workplaneEnabled: true, workplane: 'xy' }), { x, y } = d.tangent;
  rotationDragDegrees(d, x * 10, y * 10); rotationDragDegrees(d, x * 20, y * 20, 1, true); rotationDragDegrees(d, x * 30, y * 30, 1, false, true);
  assert.equal(d.degrees, 25, '10 + 5 + 10, then snapped to 5');
});

const presetDrag = (id, options = {}, style) => drag({ ...ROTATION_PRESETS[id] }, options, style);
test('presets on sample drags: a plane facing the camera', () => {
  const on = { workplaneEnabled: true, workplane: 'xy', x: 600, y: 300 };
  for (const id of ['mdlxl', 'freeform', 'manipulator']) { const d = presetDrag(id, on); assert.equal(d.circle, true, id); close(Math.abs(around(d, 100, 90)), 90, id); }
  const vis = presetDrag('mdlvis', on); assert.equal(vis.circle, false); close(rotationDragDegrees(vis, 40, 0, 3), 40, 'MDLVis: right, no DPI'); close(rotationDragDegrees(vis, 40, 150, 3), 40, 'vertical never read');
});
test('presets on sample drags: a tilted plane', () => {
  const on = { camera: perspective(), workplaneEnabled: true, workplane: 'xy', x: 470, y: 250 };
  const xl = presetDrag('mdlxl', on); close(rotationDragDegrees(xl, xl.tangent.x * 40, xl.tangent.y * 40, 2), 80, 'MDLxL: the arrow, DPI applies');
  const man = presetDrag('manipulator', on); close(rotationDragDegrees(man, man.tangent.x * 40, man.tangent.y * 40, 2), 40, 'Manipulator: the arrow, no DPI');
  assert.deepEqual(man.tangent, xl.tangent);
  const vis = presetDrag('mdlvis', on); close(rotationDragDegrees(vis, 40, 0, 2), 40, 'MDLVis left/right');
  const free = presetDrag('freeform', on); assert.equal(free.circle, true); assert.equal(free.ringRadius, undefined);
});
test('presets on sample drags: a Lines handle', () => {
  const on = { x: 668, y: 300, handle: handle('X') };
  const xl = presetDrag('mdlxl', on, 'lines'); assert.equal(xl.lever, 'X'); assert.equal(xl.ringRadius, 68);
  const vis = presetDrag('mdlvis', on, 'lines'); assert.equal(vis.lever, null); assert.equal(vis.axisName, 'X'); assert.equal(vis.ringRadius, undefined); close(Math.hypot(vis.tangent.x, vis.tangent.y), 1, 'tangent');
  const free = presetDrag('freeform', on, 'lines'); assert.equal(free.lever, null); assert.equal(free.ringRadius, 0, 'no rim');
  const man = presetDrag('manipulator', on, 'lines'); assert.equal(man.lever, null); assert.equal(man.ringRadius, 68, 'keeps the rim');
});
test('presets on sample drags: Shift and Ctrl', () => {
  const on = { camera: perspective(), workplaneEnabled: true, workplane: 'yz', x: 470, y: 250 };
  const shifted = id => { const d = presetDrag(id, id === 'mdlvis' ? on : { ...on, workplane: 'xy' }), [x, y] = d.tangent ? [d.tangent.x, d.tangent.y] : [1, 0]; return rotationDragDegrees(d, x * 50, y * 50, 1, true); };
  close(shifted('mdlxl'), 5, 'MDLxL .1'); close(shifted('mdlvis'), 50, 'MDLVis: Shift does nothing'); close(shifted('manipulator'), 5, 'Manipulator .1');
  const snapped = id => { const d = presetDrag(id, { ...on, workplane: 'xy' }); return rotationDragDegrees(d, d.tangent.x * 22, d.tangent.y * 22, 1, false, true); };
  close(snapped('mdlxl'), 22, 'no step'); close(snapped('manipulator'), 15, 'fifteen degrees');
  const free = presetDrag('freeform', { ...on, workplane: 'xy' }); around(free, 150, 23); assert.equal(rotationDragDegrees(free, free.pivot.x + 150 * Math.cos(23 * Math.PI / 180) - free.start.x, free.pivot.y + 150 * Math.sin(23 * Math.PI / 180) - free.start.y, 1, false, true) % 5 + 0, 0, 'Freeform snaps to five');
});

const triangle = (x, size = 2) => [x, 0, 0, x + size, 0, 0, x, size, 0];
test('Each piece: separate triangles are separate pieces and a seam does not split one', () => {
  const positions = Float32Array.from([...triangle(0), ...triangle(10), ...triangle(0)]);
  assert.equal(new Set(selectedPieces([0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5], positions)).size, 2, 'two triangles');
  const seam = selectedPieces([0, 1, 2, 6, 7, 8], [0, 1, 2, 6, 7, 8], positions); assert.equal(new Set(seam).size, 1, 'a seam stays one piece');
  assert.equal(new Set(selectedPieces([0, 1, 2, 6, 7, 8], [0, 1, 2, 6, 7, 8])).size, 2, 'without positions Ctrl+Resize keeps its old grouping');
  const near = Float32Array.from([0, 0, 0, .00049, 0, 0, .0006, 0, 0]);
  assert.equal(new Set(selectedPieces([], [0, 1, 2], near)).size, 2, 'same spot means the same thousandth');
  const separate = Float32Array.from([...triangle(0, 1), ...triangle(10, 1)]);
  assert.deepEqual(rotationPieces([0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5], separate).map(piece => [piece.indices, piece.center.map(v => Math.round(v * 1e6) / 1e6)]), [[[0, 1, 2], [1 / 3, 1 / 3, 0].map(v => Math.round(v * 1e6) / 1e6)], [[3, 4, 5], [10 + 1 / 3, 1 / 3, 0].map(v => Math.round(v * 1e6) / 1e6)]]);
});

test('Each piece: Forge writes three vertices per triangle, and a whole shape is still one piece', () => {
  const shape = createForgeShape(buildForgePrimitive({ shape: 'Cube', width: 100, height: 100, depth: 100, zUp: true }), { id: 1, name: 'Cube' }), mesh = forgeShapeMesh(shape), geoset = mesh.geosets[0];
  const all = Array.from({ length: geoset.Vertices.length / 3 }, (_, i) => i);
  assert.equal(new Set(selectedPieces(geoset.Faces, all)).size, mesh.triangleCount, 'without positions: one piece per triangle');
  assert.equal(new Set(selectedPieces(geoset.Faces, all, geoset.Vertices)).size, 1, 'with positions: one cube');
  const [one] = rotationPieces(geoset.Faces, all, geoset.Vertices); one.center.forEach((value, axis) => close(value, geoset.Vertices.reduce((sum, v, i) => i % 3 === axis ? sum + v : sum, 0) / all.length, `centre ${axis}`, 1e-3));
  const faceOf = id => all.filter(i => mesh.faceIds[Math.floor(i / 3)] === id), [first] = mesh.faceIds, opposite = mesh.faceIds.find(id => { const f = faceOf(first), o = faceOf(id); return !f.some(i => o.some(j => [0, 1, 2].every(a => Math.abs(geoset.Vertices[i * 3 + a] - geoset.Vertices[j * 3 + a]) < 1e-3))); });
  assert.ok(opposite !== undefined, 'the cube has a face sharing no corner');
  assert.equal(rotationPieces(geoset.Faces, [...faceOf(first), ...faceOf(opposite)], geoset.Vertices).length, 2, 'two faces with no shared corner');
});

test('Each piece: normals and tangents turn with the piece, positions match the live preview', () => {
  const geoset = () => ({ Vertices: Float32Array.from([...triangle(0), ...triangle(20)]), Normals: Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]), Tangents: Float32Array.from([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1]), Faces: Uint16Array.from([0, 1, 2, 3, 4, 5]) });
  const g = geoset(), rotation = [0, 0, 90], pieces = rotationPieces(g.Faces, [0, 1, 2, 3, 4, 5], g.Vertices), original = Float32Array.from(g.Vertices);
  assert.equal(pieces.length, 2);
  for (const piece of pieces) transformVertices(g, piece.indices, [0, 0, 0], [1, 1, 1], rotation, piece.center);
  const euler = new Euler(0, 0, Math.PI / 2), center = new Vector3(), v = new Vector3();
  for (const piece of pieces) { center.fromArray(piece.center); for (const i of piece.indices) { v.fromArray(original, i * 3).sub(center).applyEuler(euler).add(center); [v.x, v.y, v.z].forEach((value, a) => close(g.Vertices[i * 3 + a], value, `position ${i}`, 1e-4)); } }
  for (const piece of pieces) { const mean = [0, 1, 2].map(a => piece.indices.reduce((sum, i) => sum + g.Vertices[i * 3 + a], 0) / piece.indices.length); mean.forEach((value, a) => close(value, piece.center[a], 'each piece stays on its spot', 1e-4)); }
  close(g.Normals[0], -1, 'first normal turned', 1e-6); close(g.Normals[1], 0, 'first normal y', 1e-6); close(g.Normals[9], 0, 'second piece normal x', 1e-6); close(g.Normals[10], 1, 'second piece normal y', 1e-6);
  close(g.Tangents[1], 1, 'first tangent turned', 1e-6); close(g.Tangents[12], -1, 'second tangent turned', 1e-6); close(g.Tangents[13], 0, 'second tangent y', 1e-6); close(g.Tangents[15], -1, 'handedness kept', 1e-6);
  const shared = geoset(); transformVertices(shared, [0, 1, 2, 3, 4, 5], [0, 0, 0], [1, 1, 1], rotation, [10, 0, 0]);
  assert.ok(Math.abs(shared.Vertices[0] - g.Vertices[0]) > 1, 'one shared centre gives a different result');
});

test('preferences carry the new keys and the handles still list every editor they did', () => {
  assert.equal(normalizePreferences({ rotation: { handleDrag: 'ring', eachPiece: true } }).rotation.handleDrag, 'ring'); assert.equal(normalizePreferences({ rotation: { eachPiece: true } }).rotation.eachPiece, true);
  const active = { world: new Vector3(), x: 400, y: 300, visible: true, rotation: new Quaternion() };
  assert.equal(movementAxisHandles(active, perspective(), 800, 600, 100, 'world', 'rotate', { rotateHandles: 'lines' }).length, 3);
});
