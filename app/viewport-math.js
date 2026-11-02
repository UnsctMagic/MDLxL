import { Vector3 } from 'three';
import { screenPlaneTranslation } from '../src/shift-lock.js';
export { freeDragTranslation, planeScreenBasis, projectedPlaneTranslation, quadProjectedPlaneTranslation, screenPlaneTranslation } from '../src/shift-lock.js';
import { applyEvaluatedModelCamera, evaluateModelCamera } from './portrait-view.js';

// Warcraft models face +X and use +Z as up. Top view faces down the screen.
export const VIEW_PRESETS = Object.freeze({
  front: { direction: [1, 0, 0], up: [0, 0, 1] },
  back: { direction: [-1, 0, 0], up: [0, 0, 1] },
  right: { direction: [0, -1, 0], up: [0, 0, 1] },
  left: { direction: [0, 1, 0], up: [0, 0, 1] },
  top: { direction: [0, 0, 1], up: [-1, 0, 0] },
  bottom: { direction: [0, 0, -1], up: [1, 0, 0] },
  'top-front-right': { direction: [1, -1, 1], up: [0, 0, 1] },
  'top-front-left': { direction: [1, 1, 1], up: [0, 0, 1] },
  'top-back-right': { direction: [-1, -1, 1], up: [0, 0, 1] },
  'top-back-left': { direction: [-1, 1, 1], up: [0, 0, 1] },
  'bottom-front-right': { direction: [1, -1, -1], up: [0, 0, 1] },
  'bottom-front-left': { direction: [1, 1, -1], up: [0, 0, 1] },
  'bottom-back-right': { direction: [-1, -1, -1], up: [0, 0, 1] },
  'bottom-back-left': { direction: [-1, 1, -1], up: [0, 0, 1] },
});

export function applyViewPreset(camera, name, target, distance) {
  const preset = VIEW_PRESETS[name] || VIEW_PRESETS.front;
  camera.up.fromArray(preset.up);
  camera.position.copy(target).addScaledVector(new Vector3().fromArray(preset.direction).normalize(), distance);
  camera.lookAt(target); camera.updateMatrixWorld();
}

/** Tighten the depth range as the camera moves, including game-distance zoom. */
export function depthClipRange(distance, radius, extent = radius) {
  const r = Math.max(.001, radius), d = Math.max(0, distance);
  const reach = Math.max(r * 1.75, extent * Math.SQRT2);
  return { near: Math.max(r * .002, d - reach), far: Math.max(d + Math.max(r * 3, reach), r * 4) };
}

/** Grid geometry is centered at world origin while model clipping is centered
 * on the model bounds. Expand only the depth calculation for that offset; the
 * rendered grid retains its configured, finite MDLVis size. */
export function gridDepthExtent(center, extent) {
  const configured = Math.max(1, Number(extent) || 1);
  const offset = typeof center?.length === 'function' ? center.length() : 0;
  const safety = Math.max(1, configured * .02);
  return configured + (offset + safety) / Math.SQRT2;
}

/** Radius around the model focus that contains every corner of every finite
 * grid plane without changing its configured MDLVis size. */
export function gridFrameRadius(center, extent) {
  const configured = Math.max(1, Number(extent) || 1);
  const offset = typeof center?.length === 'function' ? center.length() : 0;
  return configured * Math.SQRT2 + offset;
}

export function orthographicHalfHeight(radius, aspect) {
  return Math.max(1, radius) * 1.3 / Math.min(1, Math.max(.001, Number(aspect) || 1));
}

/** Fit a bounding sphere through the smaller perspective FOV. */
export function perspectiveFitDistance(radius, verticalFovDegrees, aspect) {
  const vertical = Math.max(.001, Number(verticalFovDegrees) || 42) * Math.PI / 180;
  const safeAspect = Math.max(.001, Number(aspect) || 1);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * safeAspect);
  return Math.max(1, radius) * 1.15 / Math.sin(Math.min(vertical, horizontal) / 2);
}

export function updateDepthClipping(camera, center, radius, extent = radius, liveBounds = []) {
  const direction = camera.getWorldDirection(new Vector3());
  const distance = center.clone().sub(camera.position).dot(direction);
  let { near, far } = depthClipRange(distance, radius, extent);
  if (camera.isOrthographicCamera) {
    // Orthographic edits can cross the eye plane without leaving the screen.
    // Keep the existing model/grid coverage and the already updated live spheres.
    const padding = Math.max(.001, radius * .002);
    for (const sphere of liveBounds) {
      const depth = (sphere.center.x - camera.position.x) * direction.x + (sphere.center.y - camera.position.y) * direction.y + (sphere.center.z - camera.position.z) * direction.z;
      near = Math.min(near, depth - sphere.radius - padding);
      far = Math.max(far, depth + sphere.radius + padding);
    }
  }
  if (camera.near !== near || camera.far !== far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
}

export function modelClipRadius(model, center, radius) {
  let result = radius;
  const extents = [model?.Info, ...(model?.Sequences || []), ...(model?.Geosets || []).flatMap(geo => [geo, ...(geo.Anims || [])])];
  for (const extent of extents) {
    const min = extent?.MinimumExtent, max = extent?.MaximumExtent;
    // Empty animation bounds can use reversed float extrema. They are not geometry.
    if (min?.length >= 3 && max?.length >= 3 && [0, 1, 2].some(axis => min[axis] > max[axis])) continue;
    for (const point of [min, max]) {
      if (point?.length >= 3 && Array.from(point).every(Number.isFinite)) result = Math.max(result, new Vector3().fromArray(point).distanceTo(center));
    }
  }
  return result;
}

export function applyModelCamera(camera, controls, source, options = {}) {
  const evaluated = source?.position && source?.target ? source : evaluateModelCamera(options.model || {}, source, options.frame, options.sequenceIndex, options.globalTime);
  return applyEvaluatedModelCamera(camera, controls, evaluated, options.aspect);
}

/** A face follows its normal; when viewed head-on, dragging up pulls it outward. */
export function normalDragTranslation(camera, pivot, normal, width, height, dx, dy) {
  const origin = pivot.clone().project(camera), tip = pivot.clone().add(normal).project(camera);
  const x = (tip.x - origin.x) * width / 2, y = (origin.y - tip.y) * height / 2;
  const unit = screenPlaneTranslation(camera, pivot, width, height, 1, 0).length();
  const lengthSq = x * x + y * y;
  const amount = lengthSq * unit * unit > .0225 ? (dx * x + dy * y) / lengthSq : -dy * unit;
  return normal.clone().multiplyScalar(amount);
}

/** Free mesh dragging uses the view plane through the selection pivot. */
export function snapshotPreviewCamera(camera, perspective, ortho, controls) {
  return { camera: camera === ortho ? 'ortho' : 'perspective', perspective: perspective.clone(), ortho: ortho.clone(), target: controls.target.clone() };
}

/** Renderer replacement is not a user camera gesture. Restore both projections
 * and the active camera before drawing the rebuilt UV preview. */
export function restorePreviewCamera(saved, perspective, ortho, controls) {
  perspective.copy(saved.perspective); ortho.copy(saved.ortho);
  const camera = saved.camera === 'ortho' ? ortho : perspective;
  controls.object = camera; controls.target.copy(saved.target); controls.update();
  return camera;
}
