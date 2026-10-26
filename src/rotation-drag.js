/** Shared editing rotation. Camera navigation and authored transforms stay separate. */
export const ROTATION_EDITORS = Object.freeze({ vertices: 'Vertices', bones: 'Bones', movement: 'Movement / POSE', forge: 'Forge', uv: 'UV Wrapper', showcase: 'Showcase' });
export const DEFAULT_ROTATION = Object.freeze({ behavior: 'linear', sensitivity: 1, editors: Object.freeze({}) });
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const behavior = value => ['linear', 'pivot'].includes(value) ? value : undefined;
const sensitivity = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.round(Math.max(.01, Math.min(4, Number(value))) * 100) / 100 : undefined;
export function normalizeRotationPreferences(value) {
  const input = record(value), editors = {};
  for (const id of Object.keys(ROTATION_EDITORS)) {
    const entry = record(input.editors?.[id]), override = {};
    if (behavior(entry.behavior)) override.behavior = entry.behavior;
    if (sensitivity(entry.sensitivity) !== undefined) override.sensitivity = sensitivity(entry.sensitivity);
    if (Object.keys(override).length) editors[id] = override;
  }
  return { behavior: behavior(input.behavior) || 'linear', sensitivity: sensitivity(input.sensitivity) ?? 1, editors };
}
export function rotationOptions(preferences, editor) {
  const value = normalizeRotationPreferences(preferences?.rotation);
  return { behavior: value.behavior, sensitivity: value.sensitivity, ...value.editors[editor] };
}
/** Capture the choice, speed and pivot once. Positive linear rotation is right/up. */
export function beginRotationDrag({ x = 0, y = 0, pivot = { x: 0, y: 0 }, behavior = 'linear', sensitivity = 1, pivotSign = 1 } = {}) {
  const px = x - pivot.x, py = y - pivot.y;
  return { behavior, sensitivity, pivotSign, px, py, previous: Math.atan2(py, px), swept: 0, atPivot: Math.hypot(px, py) < 12 };
}
export function rotationDragDegrees(drag, dx, dy, pointerSensitivity = 1) {
  const speed = drag.sensitivity * pointerSensitivity;
  if (drag.behavior !== 'pivot' || drag.atPivot) return (dx - dy) * speed;
  const x = drag.px + dx, y = drag.py + dy;
  // The angle is undefined at the pivot. Keep the last valid angle until it exits.
  if (Math.hypot(x, y) >= 12) {
    const angle = Math.atan2(y, x), delta = angle - drag.previous;
    drag.swept += Math.atan2(Math.sin(delta), Math.cos(delta)); drag.previous = angle;
  }
  return drag.swept * 180 / Math.PI * drag.pivotSign * speed;
}
