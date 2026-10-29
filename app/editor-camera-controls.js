import { cameraBindings } from '../src/preferences.js';
import { pointerSensitivityValue } from './viewport-performance.js';
import { MODEL_CAMERA_FOV_FACTOR } from './portrait-view.js';
import { moveDragPoint } from './classic-gestures.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Euler, MOUSE, Vector3, PerspectiveCamera, OrthographicCamera } from 'three';
import { degreesToQuaternion } from '../src/rotation-math.js';

/** OrbitControls swaps pan and rotate when Shift is held. Preselect the
 * opposite action so Shift only changes fine sensitivity in single views. */
export function preserveShiftCameraAction(action, event) {
  if (!event.shiftKey || event.ctrlKey || event.metaKey) return action;
  return action === MOUSE.PAN ? MOUSE.ROTATE : action === MOUSE.ROTATE ? MOUSE.PAN : action;
}

/** XYZ Euler angles in world space, in degrees. Editing orbits around the
 * existing target, preserving distance and zoom; roll remains editable. */
export function editorCameraAngles(camera) {
  const euler = new Euler().setFromQuaternion(camera.quaternion, 'XYZ');
  return Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, euler[axis] * 180 / Math.PI]));
}
export function setEditorCameraAngles(camera, target, values) {
  if (!['x', 'y', 'z'].every(axis => Number.isFinite(Number(values?.[axis])))) return false;
  const distance = Math.max(.001, camera.position.distanceTo(target));
  const q = degreesToQuaternion(['x', 'y', 'z'].map(axis => Number(values[axis])));
  camera.quaternion.copy(q);
  camera.position.copy(target).add(new Vector3(0, 0, distance).applyQuaternion(q));
  camera.up.copy(new Vector3(0, 1, 0).applyQuaternion(q));
  camera.updateMatrixWorld(); return true;
}

export function zoomEditorCamera(camera, zoom) {
  camera.zoom = Math.max(.02, Math.min(100, zoom));
  camera.updateProjectionMatrix();
}

/** How far a perspective camera may back away while zooming out, as a multiple
 * of where it started. Matches the old .02 lens limit (1/50). */
export const MAX_BACK_AWAY = 50;

/** Keep the viewing position fixed while zooming in. OrbitControls r183 otherwise
 * dollies perspective cameras into the mesh, distorting close work and losing
 * depth precision. Override its two zoom hooks so mouse/touch/key zoom agree.
 * Zooming a perspective view out never widens the lens past its normal angle:
 * a 170-degree lens stretches every nearby part toward the screen edges. The
 * camera backs away instead, as a real camera would, and zooming in returns it
 * to where it started before narrowing the lens again. */
export class EditorCameraControls extends OrbitControls {
  connect(element) {
    super.connect(element);
    this._cancelPointerGesture ||= event => {
      if (event.type === 'blur' || this._pointers.includes(event.pointerId) &&
          !this.domElement.hasPointerCapture(event.pointerId)) this.cancelPointerGesture();
    };
    this._recoverMouseGesture ||= event => {
      if (event.pointerType === 'mouse' && this._pointers.includes(event.pointerId) &&
          (event.type === 'pointerdown' || event.buttons === 0)) this.cancelPointerGesture();
    };
    element.addEventListener('lostpointercapture', this._cancelPointerGesture);
    element.addEventListener('pointerdown', this._recoverMouseGesture, true);
    element.ownerDocument.addEventListener('pointermove', this._recoverMouseGesture, true);
    element.ownerDocument.defaultView.addEventListener('blur', this._cancelPointerGesture);
  }
  disconnect() {
    const element = this.domElement;
    if (element) {
      this.cancelPointerGesture();
      element.removeEventListener('lostpointercapture', this._cancelPointerGesture);
      element.removeEventListener('pointerdown', this._recoverMouseGesture, true);
      element.ownerDocument.removeEventListener('pointermove', this._recoverMouseGesture, true);
      element.ownerDocument.defaultView.removeEventListener('blur', this._cancelPointerGesture);
    }
    super.disconnect();
  }
  cancelPointerGesture() {
    // OrbitControls only finishes on pointerup/cancel. An interrupted mouse
    // release can leave the pointer tracked and every later press ignored.
    const pointers = [...this._pointers];
    this._pointers.length = 0; this._pointerPositions = {}; this.state = -1;
    this.screenDrag = null;
    const element = this.domElement;
    element.ownerDocument.removeEventListener('pointermove', this._onPointerMove);
    element.ownerDocument.removeEventListener('pointerup', this._onPointerUp);
    for (const id of pointers) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    if (pointers.length) this.dispatchEvent({ type: 'end' });
  }
  update(deltaTime) {
    if (this.keepWorldUp?.()) {
      this.object.up.set(0,0,1);
      this.minPolarAngle=.0001;this.maxPolarAngle=Math.PI-.0001;
    }
    // OrbitControls caches its up-vector transform at construction. View presets
    // and editable roll change up later, so keep that cached basis synchronized.
    if (this._quat) { this._quat.setFromUnitVectors(this.object.up.clone().normalize(), new Vector3(0, 1, 0)); this._quatInverse.copy(this._quat).invert(); }
    return super.update(deltaTime);
  }
  _startScreenDrag(event) {
    const point={x:event.clientX,y:event.clientY};
    this.screenDrag=this.lockScreenAxis?{pointer:point,point,shift:event.shiftKey,axis:null}:null;
  }
  shiftScreenDrag(shift) {
    if(this.screenDrag)moveDragPoint(this.screenDrag,this.screenDrag.pointer,shift);
  }
  _screenDragEvent(event) {
    if(!this.screenDrag)return event;
    const point=moveDragPoint(this.screenDrag,{x:event.clientX,y:event.clientY},event.shiftKey);
    return {clientX:point.x,clientY:point.y};
  }
  _handleMouseDownPan(event) { this._startScreenDrag(event);super._handleMouseDownPan(event); }
  _handleMouseDownRotate(event) { this._startScreenDrag(event);super._handleMouseDownRotate(event); }
  _handleMouseMovePan(event) { super._handleMouseMovePan(this._screenDragEvent(event)); }
  _handleMouseMoveRotate(event) { super._handleMouseMoveRotate(this._screenDragEvent(event)); }
  _customWheelEvent(event) {
    // Windows Chromium reports Shift+wheel as horizontal scroll (deltaX, deltaY 0).
    const shifted = event.shiftKey && !event.deltaY && event.deltaX ? { clientX: event.clientX, clientY: event.clientY, deltaMode: event.deltaMode, ctrlKey: event.ctrlKey, deltaY: event.deltaX } : event;
    return { ...super._customWheelEvent(shifted), shiftKey: event.shiftKey };
  }
  _handleMouseWheel(event) {
    this.lensZoom = !!event.shiftKey;
    try { super._handleMouseWheel(event); } finally { this.lensZoom = false; }
  }
  _dollyIn(scale) { this._projectionZoom(1 / scale); }
  _dollyOut(scale) { this._projectionZoom(scale); }
  /** Zoom by a factor (above 1 zooms in), the same way as the mouse wheel. */
  zoomView(scale) { if (scale > 0 && scale !== 1) this._projectionZoom(scale); }
  _projectionZoom(scale) {
    const perspective = this.object.isPerspectiveCamera, portrait = this.portraitDolly?.();
    if (portrait && !this.lensZoom && perspective) {
      const offset = this.object.position.clone().sub(this.target);
      offset.multiplyScalar(1 / scale);
      this.object.position.copy(this.target).add(offset);
      this.object.updateMatrixWorld();
    } else if (perspective && !portrait && !this.wideLensZoom?.()) {
      this._backAwayZoom(scale);
    } else {
      let zoom = this.object.zoom * scale;
      if (this.portraitDolly?.() && this.object.isPerspectiveCamera) {
        const minimum = Math.tan(this.object.fov * Math.PI / 360) / Math.tan((Math.PI - .0001) * MODEL_CAMERA_FOV_FACTOR / 2);
        zoom = Math.max(minimum,zoom);
      }
      zoomEditorCamera(this.object,zoom);
    }
    this.dispatchEvent({ type: 'change' });
  }
  _backAwayZoom(scale) {
    const camera = this.object, offset = camera.position.clone().sub(this.target), distance = offset.length();
    // Fit, a model camera or a view change moved the camera since it backed
    // away: forget the old starting point rather than pull the camera to it.
    let away = this._backedAway;
    if (away && Math.abs(away.distance - distance) > distance * 1e-6) away = null;
    let lens = camera.zoom, next = distance;
    if (scale < 1) {
      // A narrowed lens first widens back to normal, then the camera backs away.
      const wanted = lens * scale;
      lens = lens > 1 ? Math.max(1, wanted) : lens;
      const rest = wanted / lens;
      if (rest < 1 && distance > 0) { away ||= { start: distance }; next = Math.min(distance / rest, away.start * MAX_BACK_AWAY); }
    } else {
      let rest = scale;
      if (away && distance > away.start) { next = Math.max(away.start, distance / scale); rest = scale * next / distance; }
      if (away && next <= away.start) away = null;
      lens *= rest;
    }
    if (lens !== camera.zoom) zoomEditorCamera(camera, lens);
    if (next !== distance) { camera.position.copy(this.target).addScaledVector(offset, next / distance); camera.updateMatrixWorld(); }
    this._backedAway = away && { start: away.start, distance: next };
  }
  _pan(x, y) {
    const factor = this.object.isPerspectiveCamera ? this.object.zoom : 1;
    super._pan(x / factor, y / factor);
  }
}

/** Cameras and input defaults shared by editor previews; framing stays with each caller. */
export function createEditorCameras(element, { target = [0, 0, 0], leftButton = null } = {}) {
  const perspective = new PerspectiveCamera(42, 1, .2, 1000); perspective.up.set(0, 0, 1);
  const ortho = new OrthographicCamera(-100, 100, 100, -100, .2, 1000); ortho.up.set(0, 0, 1);
  const controls = new EditorCameraControls(perspective, element);
  controls.enableDamping = false;
  controls.mouseButtons = { LEFT: leftButton, MIDDLE: null, RIGHT: MOUSE.PAN };
  if (target.isVector3) controls.target.copy(target); else controls.target.fromArray(target);
  return { perspective, ortho, controls };
}

export const orbitMouseAction = value => value === 'pan' ? MOUSE.PAN : value === 'rotate' ? MOUSE.ROTATE : value === 'zoom' ? MOUSE.DOLLY : null;

/** Callers retain their left-button/tool and Quad/Showcase decisions. Quad View
 * keeps OrbitControls' Shift action swap; single views preserve the chosen action. */
export function applyCameraButtons(controls, event, preferences, { left, rotateAsPan = false, fine = true, preserveShift = true } = {}) {
  const binding = cameraBindings(preferences);
  const action = value => {
    const mouse = orbitMouseAction(rotateAsPan && value === 'rotate' ? 'pan' : value);
    return preserveShift ? preserveShiftCameraAction(mouse, event) : mouse;
  };
  controls.mouseButtons.RIGHT = action(binding.right); controls.mouseButtons.MIDDLE = action(binding.middle);
  controls.mouseButtons.LEFT = action(left);
  controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(preferences?.pointerSensitivity) * (event.shiftKey && fine ? preferences?.fineSensitivity ?? .2 : 1);
}
