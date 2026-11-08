/** Motion for the animated scenes. DOM-free. Every number comes from the app's own
 * drag code: a scripted cursor path is fed in sample by sample, exactly as real
 * pointer events are, so a scene can only show what that setting really does. */
import { OrthographicCamera, Vector3 } from 'three';
import { uvSnapFactor, uvSnapTurn, uvTurn, uvZoom } from '../../src/uv-tools.js';
import { NORMAL, rotationBehavior, rotationDragDegrees } from '../../src/rotation-drag.js';
import { beginGizmoRotation } from '../movement-overlay.js';
import { createScrollSensitivity, pointerDragPoint, pointerSensitivityValue, wheelZoomFactor } from '../viewport-performance.js';
import { ease } from './clock.js';

export const STAGE = Object.freeze({ width: 220, height: 165 });
export const PIVOT = Object.freeze([110, 82.5]);
const STEPS = 180, RAD = Math.PI / 180;
export { STEPS as TRACK_STEPS };

const between = (a, b, t) => a + (b - a) * t;
const polar = (radius, degrees, centre = PIVOT) => [centre[0] + radius * Math.cos(degrees * RAD), centre[1] + radius * Math.sin(degrees * RAD)];
const segment = (a, b, t) => [between(a[0], b[0], t), between(a[1], b[1], t)];
/** Runs one eased stage after another; `stages` are [share of the time, function of 0-1]. */
function chain(stages) {
  const total = stages.reduce((sum, [share]) => sum + share, 0);
  return t => {
    let start = 0;
    for (const [share, stage] of stages) {
      const end = start + share / total;
      if (t <= end || stage === stages.at(-1)[1]) return stage(ease(Math.min(1, (t - start) / (end - start))));
      start = end;
    }
    return stages.at(-1)[1](1);
  };
}
const samples = (path, visit) => Array.from({ length: STEPS + 1 }, (_, i) => visit(path(i / STEPS), i / STEPS, i));

/* ---- UV Rotate and Zoom -------------------------------------------------- */

/** A UV island: uneven on purpose so its turn reads at a glance. Coordinates are stage pixels from the centre. */
export const UV_PIECE = Object.freeze([[-30, -20], [-6, -30], [24, -24], [36, 2], [18, 26], [-8, 22], [-32, 10]]);
export const UV_PIECE_REACH = Math.max(...UV_PIECE.map(([x, y]) => Math.hypot(x, y)));

const uvCircle = (radius = 56, from = -160, sweep = 160) => t => polar(radius, from + sweep * ease(t));
const uvLeftRight = (travel = 130, y = 140) => t => [between(PIVOT[0] - travel / 2, PIVOT[0] + travel / 2, ease(t)), y];
const uvBoth = chain([[.6, t => polar(46, -160 + 160 * t)], [.4, t => [PIVOT[0] + 46 + 50 * t, PIVOT[1]]]]);
const uvStylePath = style => style === 'leftRight' ? uvLeftRight() : style === 'both' ? uvBoth : uvCircle();
const uvChord = t => segment([PIVOT[0] - 74, PIVOT[1] - 24], [PIVOT[0] + 74, PIVOT[1] + 40], ease(t));

function runTurn(settings, path, { reach = UV_PIECE_REACH, ctrlFrom = 2 } = {}) {
  const drag = { settings, pivotScreen: [...PIVOT], reach, fine: 1 };
  uvTurn(drag, ...path(0));
  return samples(path, ([x, y], t) => {
    const ctrl = t >= ctrlFrom, turn = uvTurn(drag, x, y);
    return { x, y, ctrl, turn, applied: ctrl ? uvSnapTurn(turn, settings.rotateSnap) : turn };
  });
}

export function uvRotateTrack(settings, focus) {
  if (focus === 'zone') return { path: uvChord, frames: runTurn(settings, uvChord), scale: 1 };
  if (focus === 'bigPieces') {
    const scale = 1.75, reach = UV_PIECE_REACH * scale, path = uvCircle(34);
    return { path, frames: runTurn(settings, path, { reach }), scale, reach };
  }
  const path = focus === 'reverse' && settings.rotateStyle === 'circle' ? uvLeftRight() : uvStylePath(settings.rotateStyle);
  const ctrlFrom = focus === 'snap' && settings.rotateSnap ? .2 : 2, frames = runTurn(settings, path, { ctrlFrom });
  if (focus === 'speed') { const ghost = runTurn({ ...settings, rotateSpeed: 100 }, path); frames.forEach((frame, i) => { frame.ghost = ghost[i].applied; }); }
  return { path, frames, scale: 1 };
}

const ZOOM_GRAB = [40, -21];
function uvZoomPath(style, ending) {
  const P = PIVOT, grab = [P[0] + ZOOM_GRAB[0], P[1] + ZOOM_GRAB[1]];
  if (style === 'upDown') { const x = P[0] + 62, y0 = P[1] + 14; return chain([[.55, t => [x, between(y0, y0 - 44, t)]], [.45, t => [x, between(y0 - 44, y0 + 40, t)]]]); }
  if (style === 'leftRight') { const y = P[1] + 58, x0 = P[0] - 34; return chain([[.6, t => [between(x0, x0 + 88, t), y + Math.sin(t * Math.PI) * -14]], [.4, t => [between(x0 + 88, x0 + 20, t), y]]]); }
  if (style === 'rightUp') { const s = [P[0] + 24, P[1] + 40]; return chain([[.6, t => [s[0] + 44 * t, s[1] - 44 * t]], [.4, t => [s[0] + 44 - 62 * t, s[1] - 44 + 62 * t]]]); }
  const out = [P[0] + ZOOM_GRAB[0] * 1.6, P[1] + ZOOM_GRAB[1] * 1.6];
  if (ending === 'collapse') { const past = [P[0] - ZOOM_GRAB[0] * .6, P[1] - ZOOM_GRAB[1] * .6]; return chain([[.3, t => segment(grab, out, t)], [.7, t => segment(out, past, t)]]); }
  const back = [P[0] + ZOOM_GRAB[0] * .75, P[1] + ZOOM_GRAB[1] * .75];
  return chain([[.5, t => segment(grab, out, t)], [.5, t => segment(out, back, t)]]);
}

function runZoom(settings, path, { uvSensitivity = 1, ctrlFrom = 2 } = {}) {
  const drag = { settings, pivotScreen: [...PIVOT], uvSensitivity };
  uvZoom(drag, ...path(0), 0);
  return samples(path, ([x, y], t) => {
    const ctrl = t >= ctrlFrom, factor = uvZoom(drag, x, y, uvSensitivity);
    return { x, y, ctrl, factor, applied: ctrl ? uvSnapFactor(factor, settings.zoomSnap) : factor };
  });
}

export function uvZoomTrack(settings, focus, uvSensitivity = 1) {
  const path = uvZoomPath(settings.zoomStyle, focus === 'preset' ? 'back' : 'collapse');
  const ctrlFrom = focus === 'snap' && settings.zoomSnap ? .15 : 2, frames = runZoom(settings, path, { uvSensitivity, ctrlFrom });
  if (focus === 'speed') { const ghost = runZoom({ ...settings, zoomSpeed: 100 }, path, { uvSensitivity }); frames.forEach((frame, i) => { frame.ghost = ghost[i].applied; }); }
  return { path, frames, style: settings.zoomStyle };
}

/** One full gesture of a preset: Rotate, then Zoom on the turned piece. */
export function uvPresetTrack(settings, uvSensitivity = 1) {
  const turn = uvRotateTrack(settings, 'style').frames, zoom = uvZoomTrack(settings, 'preset', uvSensitivity).frames, lastTurn = turn.at(-1).applied;
  return { parts: [0, turn.length], frames: [...turn.map(frame => ({ ...frame, turnNow: frame.applied, factorNow: 1, part: 'turn' })), ...zoom.map(frame => ({ ...frame, turnNow: lastTurn, factorNow: frame.applied, part: 'zoom' }))] };
}

/* ---- 3D Rotate ----------------------------------------------------------- */

const VIEWS = { threeQuarter: { position: [288, -411, 212], up: [0, 0, 1] }, top: { position: [0, 0, 500], up: [0, 1, 0] } };
const AXIS = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
export function previewCamera(view = 'threeQuarter') {
  const camera = new OrthographicCamera(-STAGE.width / 2, STAGE.width / 2, STAGE.height / 2, -STAGE.height / 2, .1, 2000), { position, up } = VIEWS[view];
  camera.up.set(...up); camera.position.set(...position); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  return camera;
}
/** Screen basis of a view: world vector to stage pixels (y down) and depth. */
export function viewBasis(view = 'threeQuarter') {
  const camera = previewCamera(view), e = camera.matrixWorld.elements, right = [e[0], e[1], e[2]], up = [e[4], e[5], e[6]], toward = [e[8], e[9], e[10]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return { project: v => [PIVOT[0] + dot(right, v), PIVOT[1] - dot(up, v)], depth: v => dot(toward, v), triad: axis => ({ dx: dot(right, AXIS[axis]), dy: -dot(up, AXIS[axis]), z: dot(toward, AXIS[axis]) }) };
}
/** Rodrigues: `v` turned `degrees` about the unit `axis`. */
export function turnVector(v, axis, degrees) {
  const a = degrees * RAD, c = Math.cos(a), s = Math.sin(a), d = (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - c);
  return [
    v[0] * c + (axis[1] * v[2] - axis[2] * v[1]) * s + axis[0] * d,
    v[1] * c + (axis[2] * v[0] - axis[0] * v[2]) * s + axis[1] * d,
    v[2] * c + (axis[0] * v[1] - axis[1] * v[0]) * s + axis[2] * d];
}
export const ringBasis = name => { const n = AXIS[name], seed = Math.abs(n[2]) < .9 ? [0, 0, 1] : [1, 0, 0], d = seed[0] * n[0] + seed[1] * n[1] + seed[2] * n[2], l = [seed[0] - n[0] * d, seed[1] - n[1] * d, seed[2] - n[2] * d], size = Math.hypot(...l), u = l.map(c => c / size); return [u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]]; };
/** The point of a ring around `axis` at `degrees` from its basis, in world units. */
export const ringPoint = (axis, degrees, radius) => { const [u, v] = ringBasis(axis), a = degrees * RAD; return [0, 1, 2].map(i => u[i] * Math.cos(a) * radius + v[i] * Math.sin(a) * radius); };

export const GIZMO_RADIUS = 68;
export const BLOCK_HALF = Object.freeze([27, 15, 19]);
export const BLOCK_REACH = Math.hypot(...BLOCK_HALF);
/** The furthest a straight drag can go from `start` along `direction`, either way, and stay on the stage. */
function fitTravel(start, direction, travel) {
  const room = sign => { let t = travel; for (const axis of [0, 1]) { const low = 12, high = axis ? STAGE.height - 12 : STAGE.width - 12, d = direction[axis] * sign; if (d > 1e-6) t = Math.min(t, (high - start[axis]) / d); else if (d < -1e-6) t = Math.min(t, (low - start[axis]) / d); } return Math.max(0, t); };
  const forward = room(1), back = room(-1);
  return forward >= Math.min(travel, 70) || forward >= back ? forward : -back;
}
/** Which handle style a scene draws: the user's, unless the setting only exists for one. */
const withHandleStyle = (preferences, style) => style ? { ...preferences, viewportAppearance: { ...preferences.viewportAppearance, controllers: { ...preferences.viewportAppearance?.controllers, rotateHandles: style } } } : preferences;

/**
 * One 3D Rotate gesture through the real entry point (beginGizmoRotation, then
 * rotationDragDegrees per sample). `mode` is workplane, handle or off (off a handle).
 * `changes` lets a focus force the part of the gesture its setting is about.
 */
export function gizmoTrack(preferences, { editor = 'all', mode = 'workplane', view = 'threeQuarter', workplane = view === 'top' ? 'xy' : 'yz', style, ctrlFrom = 2, shiftFrom = 2, changes, path: script, reach = 0, dpi, travel = 104 }) {
  const prefs = withHandleStyle(changes ? { ...preferences, rotation: { ...preferences?.rotation, ...changes } } : preferences, style);
  const camera = previewCamera(view), basis = viewBasis(view), how = rotationBehavior(prefs, editor), drawn = prefs?.viewportAppearance?.controllers?.rotateHandles || 'lines';
  const pointer = dpi ?? pointerSensitivityValue(prefs?.pointerSensitivity);
  const lines = mode === 'handle' && drawn === 'lines', leverWanted = lines && how.linePick === 'lever';
  const grabbed = mode === 'handle' ? (lines ? 'X' : 'Z') : null;
  const pressWorld = grabbed ? (lines ? AXIS[grabbed].map(c => c * GIZMO_RADIUS) : ringPoint(grabbed, -70, GIZMO_RADIUS)) : null;
  const handle = mode === 'workplane' ? null : mode === 'off' ? { axis: 'XYZ', offHandle: true } : { axis: grabbed };
  const begin = (x, y) => beginGizmoRotation({ x, y, world: new Vector3(), camera, width: STAGE.width, height: STAGE.height, handle, rotation: null, space: 'world', workplaneEnabled: mode === 'workplane', workplane, preferences: prefs, editor, reach: reach ? () => reach : undefined });
  // Where the press lands: the tip of a line, on a ring, or below the part, clear of it.
  let start = script ? script(0) : pressWorld ? basis.project(pressWorld) : polar(70, 145), drag = begin(...start);
  const offInert = mode === 'off' && how.offHandle === 'none';
  const straight = drag.leverDrag || (drag.straight && !drag.circle && drag.tangent);
  const direction = drag.tangent ? [drag.tangent.x, drag.tangent.y] : drag.leverDrag && drag.tangents ? (() => { const [tx, ty] = drag.tangents.Z, size = Math.hypot(tx, ty) || 1; return [tx / size, ty / size]; })() : [1, 0];
  if (straight && !pressWorld && !script) {
    // Ride a line under the part. The press decides a Ring rule's direction, so press again there.
    const below = direction[0] >= 0 ? [-direction[1], direction[0]] : [direction[1], -direction[0]];
    start = [PIVOT[0] + below[0] * 46 - direction[0] * travel / 2, PIVOT[1] + below[1] * 46 - direction[1] * travel / 2];
    drag = begin(...start);
    if (drag.tangent) { direction[0] = drag.tangent.x; direction[1] = drag.tangent.y; }
  }
  const ringRule = !straight || script || mode !== 'workplane' || how.workplaneDrag !== 'ring' ? null : ringPoint(NORMAL[workplane], 215, GIZMO_RADIUS - 10);
  if (ringRule) { start = basis.project(ringRule); drag = begin(...start); direction[0] = drag.tangent.x; direction[1] = drag.tangent.y; }
  const reach2 = straight ? fitTravel(start, direction, travel) : 0;
  const turnAxis = leverWanted ? 'Z' : mode === 'handle' ? grabbed : null;
  const orbitPivot = lines && !leverWanted;
  const path = script || (straight
    ? (t => [start[0] + direction[0] * reach2 * ease(t), start[1] + direction[1] * reach2 * ease(t)])
    : pressWorld && !orbitPivot ? (t => basis.project(turnVector(pressWorld, AXIS[turnAxis], 120 * ease(t))))
      : (t => polar(Math.hypot(start[0] - PIVOT[0], start[1] - PIVOT[1]), Math.atan2(start[1] - PIVOT[1], start[0] - PIVOT[0]) / RAD + 150 * ease(t))));
  let picked = null;
  const frames = samples(path, ([x, y], t) => {
    const ctrl = t >= ctrlFrom, shift = t >= shiftFrom;
    const degrees = offInert ? 0 : rotationDragDegrees(drag, x - start[0], y - start[1], pointer, shift, ctrl);
    if (drag.axisName && !picked) picked = { frame: Math.round(t * STEPS), axis: drag.axisName };
    return { x, y, ctrl, shift, degrees, axis: drag.axisName || null, snapped: !!drag.snapped };
  });
  return { frames, view, start, mode, workplane, drawn, how, grabbed, lines, straight: !!straight, direction, travel: reach2, ringRule: !!ringRule, lever: drag.lever || null, leverPick: drag.leverPick, picked,
    ringRadius: drag.ringRadius || 0, hold: drag.hold, steady: drag.steady, inert: offInert, axis: drag.axisName || picked?.axis || null, pointer };
}

/** Fine-tune a gesture for what one setting is about. Returns the options gizmoTrack takes. */
export function gizmoScript(focus, how, preferences) {
  const chord = t => segment([PIVOT[0] - 92, PIVOT[1] - 36], [PIVOT[0] + 92, PIVOT[1] + 22], ease(t));
  const orbit = (radius, from, sweep) => t => polar(radius, from + sweep * ease(t));
  switch (focus) {
    case 'handleDrag': case 'handleStyle': return { mode: 'handle' };
    case 'handleSpeed': return { mode: 'handle', reference: { handleSensitivity: 1 } };
    case 'sensitivity': case 'apply': case 'inherit': return { mode: 'workplane', reference: { sensitivity: 1 } };
    case 'linePick': return { mode: 'handle', style: 'lines' };
    case 'leverPick': return { mode: 'handle', style: 'lines', changes: { linePick: 'lever' } };
    case 'offHandle': return { mode: 'off', path: orbit(76, -160, 140) };
    case 'faceOn': return { mode: 'workplane', view: 'top', changes: { workplaneDrag: 'arrow' } };
    case 'reverse': return { mode: 'workplane', changes: { reverse: how.reverse, workplaneDrag: how.workplaneDrag === 'circle' ? 'arrow' : how.workplaneDrag } };
    case 'dpi': return { mode: 'workplane', reference: { useDPI: !how.useDPI }, dpi: Math.abs(pointerSensitivityValue(preferences?.pointerSensitivity) - 1) < .01 ? .5 : pointerSensitivityValue(preferences?.pointerSensitivity), changes: { workplaneDrag: how.workplaneDrag === 'circle' ? 'arrow' : how.workplaneDrag } };
    case 'zone': return { mode: 'off', path: chord, changes: { offHandle: 'wheel' } };
    case 'bigSelections': return { mode: 'off', path: orbit(34, -150, 150), reach: BLOCK_REACH * 2.2, changes: { offHandle: 'wheel' } };
    case 'precision': return { mode: 'workplane', shiftFrom: .42, changes: { shift: 'slow' } };
    case 'shift': return { mode: 'workplane', shiftFrom: .3 };
    case 'snap': return { mode: 'workplane', ctrlFrom: .15 };
    default: return { mode: 'workplane' };
  }
}

/** Both halves of a preset: a workplane drag, then a handle drag on the turned part. */
export function gizmoPresetTrack(preferences, editor) {
  const first = gizmoTrack(preferences, { editor, mode: 'workplane' }), second = gizmoTrack(preferences, { editor, mode: 'handle' });
  const last = first.frames.at(-1);
  return { ...second, first, second, parts: [0, first.frames.length], frames: [...first.frames.map(frame => ({ ...frame, part: 0 })), ...second.frames.map(frame => ({ ...frame, part: 1, before: { axis: first.axis, degrees: last.degrees } }))] };
}

/** Move gizmo: the pointer pulls the X arrow out along its axis. */
export function moveGizmoTrack() {
  const basis = viewBasis(), tip = basis.project([60, 0, 0]), far = basis.project([104, 0, 0]);
  return { frames: samples(t => segment(tip, far, ease(t)), ([x, y]) => ({ x, y, dx: x - tip[0], dy: y - tip[1] })) };
}

/* ---- Pointer ------------------------------------------------------------- */

/** A point dragged over a ruler at a given gain, through the app's own scaling. */
export function pointerTrack(gain, { travel = 44, fineFrom = 2, fine = 1 } = {}) {
  const origin = { x: 0, y: 0 };
  let last = 0, done = 0;
  return samples(t => [travel * ease(t), 0], ([x], t) => {
    const slow = t >= fineFrom, step = x - last; last = x;
    done += step * (slow ? fine : 1);
    return { x, slow, moved: pointerDragPoint(origin, { x: done, y: 0 }, gain).x };
  });
}

/* ---- Wheel --------------------------------------------------------------- */

const NOTCH = { deltaY: -100, deltaMode: 0 };
/** What two wheel notches zoom by. */
export const wheelNotchFactor = sensitivity => wheelZoomFactor(NOTCH, sensitivity);
/** Values the scroll or DPI readout passes through, one per notch, from the app's own adjuster. */
export function wheelAdjustSteps(preferences, kind, notches = 3, held = false) {
  const prefs = { ...preferences, wheelMode: held ? 'rotate' : kind === 'pointer' ? 'pointer' : 'scroll' };
  const controller = createScrollSensitivity({ getPreferences: () => prefs, onChange() {}, onPointerChange() {} });
  if (held) controller.pointerDown({ button: 2, pointerId: 1 });
  const first = controller.wheel({ deltaY: 0, deltaMode: 0, buttons: held ? 2 : 0, preventDefault() {}, stopImmediatePropagation() {} });
  const read = result => kind === 'pointer' ? result.pointerSensitivity : result.sensitivity, values = [read(first)];
  for (let i = 0; i < notches; i++) values.push(read(controller.wheel({ ...NOTCH, buttons: held ? 2 : 0, preventDefault() {}, stopImmediatePropagation() {} })));
  return values;
}
