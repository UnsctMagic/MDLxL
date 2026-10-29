/** Shared editing rotation. Camera navigation and authored transforms stay separate. */
export const ROTATION_EDITORS = Object.freeze({ vertices: 'Vertices', bones: 'Bones', movement: 'Movement / POSE', forge: 'Forge', uv: 'UV Wrapper', showcase: 'Showcase' });
export const ROTATION_BEHAVIORS = Object.freeze(['ring', 'linear', 'pivot']);
export const DEFAULT_ROTATION = Object.freeze({ behavior: 'ring', sensitivity: 1, editors: Object.freeze({}) });
/** Circle the pivot: below this, the turn circle is too thin on screen to follow (about 73° off the view). */
const EDGE_ON = .3;
/** Along the ring: a ring this thin cannot tell its near side from its far side under the pointer. */
const THIN_RING = .3;
/** Along the ring: an axis this short on screen points at the camera (the gizmo's own 18 of 68 pixel limit). */
const FACING_AXIS = .26;
/** Along the ring: a grab this close to the axis line, or to the pivot of a camera-facing axis, is on the axis. */
const ON_AXIS = 12;
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const behavior = value => ROTATION_BEHAVIORS.includes(value) ? value : undefined;
const sensitivity = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.round(Math.max(.01, Math.min(4, Number(value))) * 100) / 100 : undefined;
export function normalizeRotationPreferences(value) {
  const input = record(value), editors = {};
  for (const id of Object.keys(ROTATION_EDITORS)) {
    const entry = record(input.editors?.[id]), override = {};
    if (behavior(entry.behavior)) override.behavior = entry.behavior;
    if (sensitivity(entry.sensitivity) !== undefined) override.sensitivity = sensitivity(entry.sensitivity);
    if (Object.keys(override).length) editors[id] = override;
  }
  return { behavior: behavior(input.behavior) || DEFAULT_ROTATION.behavior, sensitivity: sensitivity(input.sensitivity) ?? 1, editors };
}
export function rotationOptions(preferences, editor) {
  const value = normalizeRotationPreferences(preferences?.rotation);
  return { behavior: value.behavior, sensitivity: value.sensitivity, ...value.editors[editor] };
}
/** Along the ring: the unit screen direction (x right, y down) that turns the
 * grabbed point positively (right-hand rule) about `axis`. `axis` is the turn
 * axis in view space: x right, y up, z toward the viewer; `grab` is the grab
 * point relative to the pivot in screen pixels.
 * - Off the axis, the ring through the grab point gives the tangent a × (G − P).
 * - On the axis (the gizmo's axis handles), or on a ring too thin to tell its
 *   near and far sides apart, the ring's near side does: perpendicular to the
 *   axis on screen.
 * - At the pivot of an axis pointing at the camera, screen right. */
export function rotationRingTangent(grab, axis = [0, 0, -1]) {
  const [ax = 0, ay = 0, az = 0] = axis, gx = grab?.x || 0, gy = grab?.y || 0, length = Math.hypot(ax, ay);
  const offAxis = length < FACING_AXIS ? Math.hypot(gx, gy) >= ON_AXIS : Math.abs(gx * ay + gy * ax) / length >= ON_AXIS;
  if (offAxis && Math.abs(az) >= THIN_RING) {
    // The grab point on the ring's plane, in view space: (gx, −gy, depth).
    const depth = -(ax * gx - ay * gy) / az, tx = ay * depth + az * gy, ty = ax * depth - az * gx, size = Math.hypot(tx, ty);
    if (size > 1e-6) return { x: tx / size, y: ty / size };
  }
  if (length >= FACING_AXIS) return { x: ay / length, y: ax / length };
  return { x: 1, y: 0 };
}
/** Capture the choice, speed, pivot and ring direction once per drag.
 * `axis` is the turn axis in view space (see rotationRingTangent); without it,
 * positive is clockwise on screen. Straight drag (linear) turns right/up
 * positive. Circle the pivot (pivot) needs the axis facing: a circle seen
 * edge-on is a line on screen, so circling its center cannot follow the turn;
 * it then uses the straight-drag rule, as it does when the drag starts on the center. */
export function beginRotationDrag({ x = 0, y = 0, pivot = { x: 0, y: 0 }, behavior = 'linear', sensitivity = 1, axis, pivotSign = axis ? axis[2] > 0 ? -1 : 1 : 1, facing = axis ? axis[2] : 1 } = {}) {
  const px = x - pivot.x, py = y - pivot.y;
  const tangent = behavior === 'ring' ? rotationRingTangent({ x: px, y: py }, axis) : null;
  return { behavior, sensitivity, pivotSign, tangent, px, py, previous: Math.atan2(py, px), swept: 0, atPivot: Math.hypot(px, py) < 12 || Math.abs(facing) < EDGE_ON };
}
/** Degrees for the whole drag so far; `dx`/`dy` are measured from the drag start. */
export function rotationDragDegrees(drag, dx, dy, pointerSensitivity = 1) {
  const speed = drag.sensitivity * pointerSensitivity;
  // One degree per pixel pulled along the ring, the same for every axis.
  if (drag.behavior === 'ring') return (dx * drag.tangent.x + dy * drag.tangent.y) * speed;
  if (drag.behavior !== 'pivot' || drag.atPivot) return (dx - dy) * speed;
  const x = drag.px + dx, y = drag.py + dy;
  // The angle is undefined at the pivot. Keep the last valid angle until it exits.
  if (Math.hypot(x, y) >= 12) {
    const angle = Math.atan2(y, x), delta = angle - drag.previous;
    drag.swept += Math.atan2(Math.sin(delta), Math.cos(delta)); drag.previous = angle;
  }
  return drag.swept * 180 / Math.PI * drag.pivotSign * speed;
}
