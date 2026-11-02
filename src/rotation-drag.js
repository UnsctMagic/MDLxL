/** Shared 3D editing input. The UV map deliberately keeps uvTurn. */
export const ROTATION_EDITORS = Object.freeze({ vertices: 'Vertices', bones: 'Bones', movement: 'Movement / POSE', forge: 'Forge', showcase: 'Showcase' });
export const DEFAULT_ROTATION = Object.freeze({ sensitivity: 1, precision: .1, editors: Object.freeze({}) });
export const AXES = ['X', 'Y', 'Z'];
export const NORMAL = { xy: 'Z', xz: 'Y', zx: 'Y', yz: 'X' };
export { PERPENDICULAR } from './shift-lock.js';
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const speed = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.round(Math.max(.01, Math.min(4, Number(value))) * 100) / 100 : undefined;
export function normalizeRotationPreferences(value) {
  const input = record(value), editors = {};
  for (const id of Object.keys(ROTATION_EDITORS)) {
    const sensitivity = speed(input.editors?.[id]?.sensitivity);
    const precision = speed(input.editors?.[id]?.precision);
    if (sensitivity !== undefined || precision !== undefined) editors[id] = {
      ...(sensitivity !== undefined && { sensitivity }),
      ...(precision !== undefined && { precision: Math.min(1, precision) }),
    };
  }
  return { sensitivity: speed(input.sensitivity) ?? 1, precision: Math.min(1, speed(input.precision) ?? .1), editors };
}
export function rotationOptions(preferences, editor) {
  const value = normalizeRotationPreferences(preferences?.rotation);
  return { sensitivity: value.sensitivity, precision: value.precision, ...value.editors[editor] };
}
export function facingAxis(direction) { return AXES.reduce((best, axis, i) => Math.abs(direction[i]) > Math.abs(direction[AXES.indexOf(best)]) ? axis : best, 'X'); }
export function chooseLeverAxis(grabAxis, tangents, dx, dy) {
  if (Math.hypot(dx, dy) < 6) return null;
  return AXES.filter(axis => axis !== grabAxis).reduce((best, axis) => {
    const score = a => Math.abs(tangents[a][0] * dx + tangents[a][1] * dy);
    return !best || score(axis) > score(best) ? axis : best;
  }, null);
}
export { dominantPlaneAxis, moveConstraint } from './shift-lock.js';
export function beginRotationDrag({ x = 0, y = 0, pivot = { x: 0, y: 0 }, sensitivity = 1, precision = .1, axis, constrained = false, plane = 'xy', axisName, lever, tangents, facings, tangent, circle = false } = {}) {
  const px = x - pivot.x, py = y - pivot.y;
  return { sensitivity, precision, constrained, plane, axisName, lever, tangents, facings, tangent, circle, px, py,
    sign: axis?.[2] > 0 ? -1 : 1, previous: Math.hypot(px, py) >= 8 ? Math.atan2(py, px) : null, swept: 0, degrees: 0, pointer: { x, y } };
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
/** Samples accumulate the wrapped path; geometry and drawing run once per frame. */
export function rotationDragDegrees(drag, dx, dy, pointerSensitivity = 1, shift = false) {
  const x = drag.px + dx, y = drag.py + dy;
  if (drag.start) drag.pointer = { x: drag.start.x + dx, y: drag.start.y + dy };
  if (drag.lever && !drag.axisName) {
    drag.axisName = chooseLeverAxis(drag.lever, drag.tangents, dx, dy);
    if (drag.axisName) drag.sign = drag.facings[drag.axisName] > 0 ? -1 : 1;
  }
  if (drag.ringRadius) drag.swept += gizmoSweep(drag, x, y);
  else if ((!drag.constrained || drag.circle) && Math.hypot(x, y) >= 8) {
    const angle = Math.atan2(y, x);
    if (drag.previous !== null) { const delta = angle - drag.previous; drag.swept += Math.atan2(Math.sin(delta), Math.cos(delta)); }
    drag.previous = angle;
  }
  const raw = drag.constrained && !drag.circle ? dx * drag.tangent.x + dy * drag.tangent.y : drag.lever && !drag.axisName ? 0 : drag.swept * 180 / Math.PI * drag.sign;
  drag.preciseSwept = (drag.preciseSwept || 0) + (raw - (drag.previousRaw || 0)) * (shift ? drag.precision : 1);
  drag.previousRaw = raw;
  drag.degrees = drag.preciseSwept * drag.sensitivity * pointerSensitivity;
  return drag.degrees;
}
