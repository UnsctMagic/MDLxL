/** Shared 3D editing input. The UV map deliberately keeps uvTurn. */
export const ROTATION_EDITORS = Object.freeze({ vertices: 'Vertices', bones: 'Bones', movement: 'Movement / POSE', forge: 'Forge', emtr: 'EMTR', glow: 'Glow Up', showcase: 'Showcase' });
export const DEFAULT_ROTATION = Object.freeze({ sensitivity: 1, precision: .1, editors: Object.freeze({}) });
/** How a drag reads the mouse. Preferences hold a key only when it differs from these. */
export const DEFAULT_ROTATION_BEHAVIOR = Object.freeze({ workplaneDrag: 'arrow', handleDrag: 'swing', linePick: 'lever', leverPick: 6, offHandle: 'wheel', faceOn: 'circle', reverse: false, handleSensitivity: null, useDPI: true, centerZone: 8, bigSelections: false, shift: 'slow', snap: 0 });
export const ROTATION_SNAPS = Object.freeze([0, 1, 5, 15, 45, 90]);
export const ROTATION_CHOICES = Object.freeze({
  workplaneDrag: Object.freeze(['arrow', 'leftRight', 'circle', 'ring']), handleDrag: Object.freeze(['swing', 'ring', 'leftRight']), linePick: Object.freeze(['lever', 'axis']),
  offHandle: Object.freeze(['wheel', 'none']), faceOn: Object.freeze(['circle', 'arrow']), shift: Object.freeze(['slow', 'snap']),
});
export const ROTATION_LIMITS = Object.freeze({ leverPick: Object.freeze({ min: 2, max: 30 }), centerZone: Object.freeze({ min: 0, max: 100 }) });
/** Every key a built-in writes, so its result never depends on what was set before. */
const everyKey = changes => Object.freeze({ sensitivity: 1, precision: .1, ...DEFAULT_ROTATION_BEHAVIOR, ...changes });
export const ROTATION_PRESETS = Object.freeze({
  mdlxl: everyKey({}),
  mdlvis: everyKey({ precision: 1, workplaneDrag: 'leftRight', handleDrag: 'ring', linePick: 'axis', faceOn: 'arrow', useDPI: false, centerZone: 0 }),
  freeform: everyKey({ precision: .03, workplaneDrag: 'circle', linePick: 'axis', useDPI: false, centerZone: 0, snap: 5 }),
  manipulator: everyKey({ linePick: 'axis', useDPI: false, snap: 15 }),
});
export const AXES = ['X', 'Y', 'Z'];
export const NORMAL = { xy: 'Z', xz: 'Y', zx: 'Y', yz: 'X' };
/** MDLVis 1.40 FindAngles: degrees for one pixel to the right, per plane. */
export const MDLVIS_SIGN = Object.freeze({ xy: 1, xz: -1, zx: -1, yz: 1 });
/** Shift-snap's one step; Ctrl uses the `snap` setting. */
const SHIFT_SNAP = 15;
/** The mouse this close to the pivot has no usable direction, whatever the deadzone says. */
const CENTRE = 2;
/** rotationRingTangent: a ring this thin cannot tell near from far; an axis this short points at the camera; a grab this close is on the axis. */
const THIN_RING = .3, FACING_AXIS = .26, ON_AXIS = 12;
export { PERPENDICULAR } from './shift-lock.js';
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const speed = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.round(Math.max(.01, Math.min(4, Number(value))) * 100) / 100 : undefined;
const numeric = value => value !== null && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value));
const flag = value => typeof value === 'boolean' ? value : undefined;
const oneOf = key => value => ROTATION_CHOICES[key].includes(value) ? value : undefined;
const whole = key => value => numeric(value) ? Math.round(Math.min(ROTATION_LIMITS[key].max, Math.max(ROTATION_LIMITS[key].min, Number(value)))) : undefined;
const READERS = {
  workplaneDrag: oneOf('workplaneDrag'), handleDrag: oneOf('handleDrag'), linePick: oneOf('linePick'), offHandle: oneOf('offHandle'), faceOn: oneOf('faceOn'), shift: oneOf('shift'),
  leverPick: whole('leverPick'), centerZone: whole('centerZone'), reverse: flag, useDPI: flag, bigSelections: flag,
  handleSensitivity: value => typeof value === 'boolean' ? undefined : speed(value),
  snap: value => numeric(value) && ROTATION_SNAPS.includes(Number(value)) ? Number(value) : undefined,
};
/** The valid behaviour keys of one level: the global level drops defaults, an editor keeps them to override the global value. */
function behaviorKeys(input, keepDefaults) {
  const keys = {};
  for (const [key, read] of Object.entries(READERS)) {
    const value = read(input[key]);
    if (value !== undefined && (keepDefaults || value !== DEFAULT_ROTATION_BEHAVIOR[key])) keys[key] = value;
  }
  return keys;
}
export function normalizeRotationPreferences(value) {
  const input = record(value), editors = {};
  for (const id of Object.keys(ROTATION_EDITORS)) {
    const entry = record(input.editors?.[id]), sensitivity = speed(entry.sensitivity), precision = speed(entry.precision), behavior = behaviorKeys(entry, true);
    // null: a built-in applied to this editor says "no separate handle speed" even when the global level has one.
    if (entry.handleSensitivity === null) behavior.handleSensitivity = null;
    if (sensitivity !== undefined || precision !== undefined || Object.keys(behavior).length) editors[id] = {
      ...(sensitivity !== undefined && { sensitivity }),
      ...(precision !== undefined && { precision: Math.min(1, precision) }),
      ...behavior,
    };
  }
  return { sensitivity: speed(input.sensitivity) ?? 1, precision: Math.min(1, speed(input.precision) ?? .1), editors, ...behaviorKeys(input, false), ...(input.eachPiece === true && { eachPiece: true }) };
}
export function rotationOptions(preferences, editor) {
  const value = normalizeRotationPreferences(preferences?.rotation), { sensitivity, precision } = value.editors[editor] || {};
  return { sensitivity: value.sensitivity, precision: value.precision, ...(sensitivity !== undefined && { sensitivity }), ...(precision !== undefined && { precision }) };
}
/** Speed plus every behaviour key, the editor's own value over the global one over the default. */
export function rotationBehavior(preferences, editor) {
  const value = normalizeRotationPreferences(preferences?.rotation), { editors, eachPiece, ...global } = value;
  return { ...DEFAULT_ROTATION_BEHAVIOR, ...global, ...editors[editor] };
}
/** The built-in the settings match (flat keys of the global or one editor's level), or 'custom'. */
export function rotationPresetId(value) {
  const input = record(value), settings = { ...DEFAULT_ROTATION_BEHAVIOR, ...behaviorKeys(input, true), sensitivity: speed(input.sensitivity) ?? 1, precision: Math.min(1, speed(input.precision) ?? .1) };
  return Object.keys(ROTATION_PRESETS).find(id => Object.entries(ROTATION_PRESETS[id]).every(([key, entry]) => settings[key] === entry)) || 'custom';
}
const ROTATE = ['vertices', 'forge', 'movement'], HANDLES = [...ROTATE, 'emtr', 'glow'], ALL = [...HANDLES, 'showcase'];
const APPLIES = {
  sensitivity: ALL, handleSensitivity: ALL, centerZone: ALL, snap: ALL,
  // Showcase's text handle has never read Shift, and turns only by circling.
  precision: HANDLES, shift: HANDLES, reverse: HANDLES, useDPI: HANDLES,
  handleDrag: HANDLES, linePick: HANDLES, leverPick: HANDLES,
  workplaneDrag: ROTATE, faceOn: ROTATE, offHandle: ROTATE,
  bigSelections: [...ROTATE, 'showcase'], eachPiece: ['vertices', 'forge'],
};
/** Whether a setting does anything in an editor ('all' or nothing for every editor). With `how`
 * (rotationBehavior's result) it also answers no when the other chosen settings make this one moot. */
export function rotationSettingApplies(key, editor, how) {
  const everyEditor = editor === undefined || editor === 'all';
  if (!APPLIES[key] || !everyEditor && !APPLIES[key].includes(editor)) return false;
  if (!how) return true;
  const workplane = everyEditor || ROTATE.includes(editor), handles = everyEditor || HANDLES.includes(editor);
  const straight = workplane && how.workplaneDrag !== 'circle' || handles && how.handleDrag !== 'swing';
  const swept = editor === 'showcase' || handles && how.handleDrag === 'swing' || workplane && (how.offHandle === 'wheel' || how.workplaneDrag === 'circle' || how.faceOn === 'circle');
  if (key === 'faceOn') return how.workplaneDrag !== 'circle';
  if (key === 'precision') return how.shift !== 'snap';
  if (key === 'leverPick') return how.linePick === 'lever';
  if (key === 'reverse') return straight;
  if (key === 'centerZone' || key === 'bigSelections') return swept;
  return true;
}
export function facingAxis(direction) { return AXES.reduce((best, axis, i) => Math.abs(direction[i]) > Math.abs(direction[AXES.indexOf(best)]) ? axis : best, 'X'); }
export function chooseLeverAxis(grabAxis, tangents, dx, dy, threshold = 6) {
  if (Math.hypot(dx, dy) < threshold) return null;
  return AXES.filter(axis => axis !== grabAxis).reduce((best, axis) => {
    const score = a => Math.abs(tangents[a][0] * dx + tangents[a][1] * dy);
    return !best || score(axis) > score(best) ? axis : best;
  }, null);
}
export { dominantPlaneAxis, moveConstraint } from './shift-lock.js';
/** The swing rim for a deadzone: exactly 68 px at the default 8, none at 0. */
export const rotationRim = zone => zone <= 8 ? 68 * zone / 8 : 68 + (zone - 8);
/** Unit screen direction (x right, y down) that turns the grabbed point positively about
 * `axis`, in view space (x right, y up, z toward the viewer). `grab` is relative to the pivot.
 * On the axis line, or on a ring too thin to read, the ring's near side decides. */
export function rotationRingTangent(grab, axis = [0, 0, -1]) {
  const [ax = 0, ay = 0, az = 0] = axis, gx = grab?.x || 0, gy = grab?.y || 0, length = Math.hypot(ax, ay);
  const offAxis = length < FACING_AXIS ? Math.hypot(gx, gy) >= ON_AXIS : Math.abs(gx * ay + gy * ax) / length >= ON_AXIS;
  if (offAxis && Math.abs(az) >= THIN_RING) {
    const depth = -(ax * gx - ay * gy) / az, tx = ay * depth + az * gy, ty = ax * depth - az * gx, size = Math.hypot(tx, ty);
    if (size > 1e-6) return { x: tx / size, y: ty / size };
  }
  if (length >= FACING_AXIS) return { x: ay / length, y: ax / length };
  return { x: 1, y: 0 };
}
export function beginRotationDrag({ x = 0, y = 0, pivot = { x: 0, y: 0 }, sensitivity = 1, precision = .1, axis, constrained = false, straight = constrained, plane = 'xy', axisName, lever, leverDrag, tangents, facings, tangent, circle = false, centerZone = 8, reverse = false, useDPI = true, shift = 'slow', snap = 0, leverPick = 6, bigSelections = false, reach = 0, ctrl = false } = {}) {
  const px = x - pivot.x, py = y - pivot.y, radius = Math.hypot(px, py), hold = Math.max(centerZone, CENTRE);
  return { sensitivity, precision, constrained, straight, plane, axisName, lever, leverDrag, tangents, facings, tangent, circle, px, py, hold, reverse, useDPI, shiftMode: shift, snap, leverPick,
    steady: bigSelections && reach > 0 ? Math.max(centerZone, reach) : 0, ctrlAtPress: ctrl, lastRadius: radius,
    sign: axis?.[2] > 0 ? -1 : 1, previous: radius >= hold ? Math.atan2(py, px) : null, swept: 0, degrees: 0, pointer: { x, y } };
}
// Split a sample at the rim so even a single event across the pivot stays continuous.
function gizmoSweep(drag, x, y) {
  const ax = drag.lastX ?? drag.px, ay = drag.lastY ?? drag.py;
  const dx = x - ax, dy = y - ay, length = Math.hypot(dx, dy);
  if (!length) return 0;
  drag.lastX = x; drag.lastY = y;
  const cross = ax * dy - ay * dx;
  let direction = drag.turnDirection || 1;
  if (Math.abs(cross) > length * 1e-6) direction = Math.sign(cross);
  else if (dx * drag.lastDX + dy * drag.lastDY < -.99 * length * Math.hypot(drag.lastDX, drag.lastDY)) direction = -direction;
  drag.turnDirection = direction; drag.lastDX = dx; drag.lastDY = dy;
  const angle = (sx, sy, ex, ey) => Math.atan2(sx * ey - sy * ex, sx * ex + sy * ey);
  const radius = drag.ringRadius, distance = cross / length;
  if (Math.abs(distance) >= radius) return angle(ax, ay, x, y);
  const closest = -(ax * dx + ay * dy) / length;
  const halfChord = Math.sqrt(radius * radius - distance * distance);
  const enter = Math.max(0, closest - halfChord), leave = Math.min(length, closest + halfChord);
  if (leave <= enter) return angle(ax, ay, x, y);
  const ux = dx / length, uy = dy / length;
  return angle(ax, ay, ax + ux * enter, ay + uy * enter)
    + direction * (leave - enter) / radius
    + angle(ax + ux * leave, ay + uy * leave, x, y);
}
/** Lines handle dragged straight: which way to pull is known only once the lever has picked its axis. */
function aimLever(drag) {
  const [tx, ty] = drag.tangents[drag.axisName], length = Math.hypot(tx, ty);
  drag.tangent = drag.leverDrag === 'leftRight' ? { x: drag.sign, y: 0 } : length > 1e-6 ? { x: tx / length, y: ty / length } : { x: 1, y: 0 };
  drag.straight = true;
}
/** Samples accumulate the wrapped path; geometry and drawing run once per frame. */
export function rotationDragDegrees(drag, dx, dy, pointerSensitivity = 1, shift = false, ctrl = false) {
  const x = drag.px + dx, y = drag.py + dy;
  if (drag.start) drag.pointer = { x: drag.start.x + dx, y: drag.start.y + dy };
  if (drag.lever && !drag.axisName) {
    drag.axisName = chooseLeverAxis(drag.lever, drag.tangents, dx, dy, drag.leverPick);
    if (drag.axisName) {
      drag.sign = drag.facings[drag.axisName] > 0 ? -1 : 1;
      if (drag.leverDrag) aimLever(drag);
    }
  }
  if (drag.ringRadius) drag.swept += gizmoSweep(drag, x, y);
  else if (!drag.straight || drag.circle) {
    const radius = Math.hypot(x, y);
    if (radius >= drag.hold) {
      const angle = Math.atan2(y, x);
      if (drag.previous !== null) {
        const delta = angle - drag.previous, step = Math.atan2(Math.sin(delta), Math.cos(delta));
        drag.swept += drag.steady ? step * Math.min(1, radius / drag.steady, drag.lastRadius / drag.steady) : step;
      }
      drag.previous = angle; drag.lastRadius = radius;
    }
  }
  const line = drag.straight && !drag.circle;
  const raw = line ? dx * drag.tangent.x + dy * drag.tangent.y : drag.lever && !drag.axisName ? 0 : drag.swept * 180 / Math.PI * drag.sign;
  drag.preciseSwept = (drag.preciseSwept || 0) + (raw - (drag.previousRaw || 0)) * (shift && drag.shiftMode === 'slow' ? drag.precision : 1);
  drag.previousRaw = raw;
  const degrees = drag.preciseSwept * drag.sensitivity * (drag.useDPI ? pointerSensitivity : 1) * (line && drag.reverse ? -1 : 1);
  // Ctrl held from the press keeps its old meaning until it is let go once.
  if (!ctrl) drag.ctrlAtPress = false;
  const step = ctrl && !drag.ctrlAtPress && drag.snap ? drag.snap : shift && drag.shiftMode === 'snap' ? SHIFT_SNAP : 0;
  drag.snapped = step > 0;
  drag.degrees = step ? Math.round(degrees / step) * step || 0 : degrees;
  return drag.degrees;
}
