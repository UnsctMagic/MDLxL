// Small compatibility patches applied to war3-model 4.0.1 renderer instances.
//
// Who patches what (the pinned library is never edited; each module wraps the
// instance it owns, and the wrappers below are the shared ones):
//
//   app/warcraft-preview-adapter.js  gl.shaderSource/useProgram/bindBuffer/
//       vertexAttribPointer/drawElements; setLayerProps/setLayerPropsHD/render;
//       particlesController.render; ribbonsController.update/render.
//       Restored on dispose. Uses compensateRibbonWallClock below.
//   app/particle-preview-adapter.js  particlesController update/create particle,
//       buffer, tex-coord and setLayerProps hooks (WeakSet guard, not restored).
//   app/node-effect-controls.js      particles/ribbons updateEmitter (persistent).
//   app/showcase-playback.js         the same updateEmitter, wrapped per update call.
//   app/event-preview-runtime.js     renderers for spawned event models: the
//       destroy guard and ribbon clock fix below.
//   app/GamePreview.jsx              release of the main preview: destroy guard below.
//   src/update-popup-effects.js      the update popup helmet: destroy guard below.
//
// Only the two helpers that were copied word for word live here.

/** war3-model 4.0.1 destroys HD environment shader objects even for SD models,
 * where they were never created. Skip missing shaders so the rest of its normal
 * cleanup still runs. Call once before native.destroy(). */
export function guardRendererDestroy(native) {
  const destroyShader = native?.destroyShaderProgramObject;
  if (typeof destroyShader === 'function') native.destroyShaderProgramObject = function (shader) {
    if (shader) return destroyShader.call(this, shader);
  };
}

/** Upstream ribbons use wall-clock birth times. Shift those times so ribbon ages
 * advance only by the simulated delta, including while paused. Wraps
 * controller.update and returns the original so the caller can restore it. */
export function compensateRibbonWallClock(controller) {
  const update = controller.update;
  let previous = Date.now();
  controller.update = function (delta) {
    const now = Date.now(), shift = now - previous - delta; previous = now;
    for (const emitter of this.emitters || []) for (let i = 0; i < emitter.creationTimes.length; i++) emitter.creationTimes[i] += shift;
    return update.call(this, delta);
  };
  return update;
}
