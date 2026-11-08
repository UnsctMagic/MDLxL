/** UV Wrapper only: how the Rotate and Zoom drags feel. 3D editors never read
 * this (see docs/UV-ROTATE-ZOOM.md). Numbers are percent, pixels or degrees. */
export const DEFAULT_UV_DRAG = Object.freeze({
  rotateStyle: 'circle', rotateSpeed: 70, rotateZone: 24, rotateBigPieces: true, rotateReverse: false, rotateSnap: 0,
  zoomStyle: 'centre', zoomSpeed: 100, zoomSnap: 0
});

export const UV_ROTATE_STYLES = Object.freeze(['circle', 'leftRight', 'both']);
export const UV_ZOOM_STYLES = Object.freeze(['centre', 'rightUp', 'leftRight', 'upDown']);
export const UV_ROTATE_SNAPS = Object.freeze([0, 1, 5, 15, 45, 90]);
export const UV_ZOOM_SNAPS = Object.freeze([0, 5, 10, 25]);
export const UV_DRAG_LIMITS = Object.freeze({
  rotateSpeed: Object.freeze({ min: 10, max: 200 }),
  rotateZone: Object.freeze({ min: 0, max: 100 }),
  zoomSpeed: Object.freeze({ min: 10, max: 400 })
});

/** A built-in writes all nine settings, so its result never depends on what was set before. */
const preset = (rotateStyle, rotateSpeed, rotateZone, rotateBigPieces, rotateSnap, zoomStyle, zoomSnap) => Object.freeze({ rotateStyle, rotateSpeed, rotateZone, rotateBigPieces, rotateReverse: false, rotateSnap, zoomStyle, zoomSpeed: 100, zoomSnap });
export const UV_DRAG_PRESETS = Object.freeze({
  mdlxl: preset('circle', 70, 24, true, 0, 'centre', 0),
  mdlvis: preset('leftRight', 100, 0, false, 0, 'upDown', 0),
  freeform: preset('circle', 100, 0, false, 5, 'centre', 10),
  manipulator: preset('circle', 100, 24, false, 15, 'leftRight', 10)
});

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const flag = (value, fallback) => typeof value === 'boolean' ? value : fallback;
function bounded(value, { min, max }, fallback) {
  if (value === null || value === '' || typeof value === 'boolean') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(max, Math.max(min, number))) : fallback;
}

export function normalizeUVDrag(value) {
  const input = record(value), fallback = DEFAULT_UV_DRAG;
  return {
    rotateStyle: choice(input.rotateStyle, UV_ROTATE_STYLES, fallback.rotateStyle),
    rotateSpeed: bounded(input.rotateSpeed, UV_DRAG_LIMITS.rotateSpeed, fallback.rotateSpeed),
    rotateZone: bounded(input.rotateZone, UV_DRAG_LIMITS.rotateZone, fallback.rotateZone),
    rotateBigPieces: flag(input.rotateBigPieces, fallback.rotateBigPieces),
    rotateReverse: flag(input.rotateReverse, fallback.rotateReverse),
    rotateSnap: choice(Number(input.rotateSnap), UV_ROTATE_SNAPS, fallback.rotateSnap),
    zoomStyle: choice(input.zoomStyle, UV_ZOOM_STYLES, fallback.zoomStyle),
    zoomSpeed: bounded(input.zoomSpeed, UV_DRAG_LIMITS.zoomSpeed, fallback.zoomSpeed),
    zoomSnap: choice(Number(input.zoomSnap), UV_ZOOM_SNAPS, fallback.zoomSnap)
  };
}

/** The built-in all nine current settings match, or 'custom'. */
export function uvDragPreset(value) {
  const settings = normalizeUVDrag(value);
  const match = Object.entries(UV_DRAG_PRESETS).find(([, preset]) => Object.entries(preset).every(([key, entry]) => settings[key] === entry));
  return match ? match[0] : 'custom';
}
