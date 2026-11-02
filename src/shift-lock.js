export function planeAxes(workplane = 'xz') {
  return workplane === 'xy' ? [0, 1] : workplane === 'yz' ? [1, 2] : [0, 2];
}

export function constrainedAxis(workplane = 'xz') {
  return workplane === 'xy' ? 0 : workplane === 'yz' ? 1 : 2;
}

const screenAxis = (dx, dy) => Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
const screenAxisDelta = (dx, dy) => screenAxis(dx, dy) === 'x' ? [dx,0] : [0,dy];

/** Keep a screen-axis latch for one Shift hold. Accumulating only allowed
 * motion lets release/repress continue from the visible position, without
 * restoring the pointer's discarded perpendicular travel. */
export function moveDragPoint(gesture, pointer, shift) {
  if (gesture.shift !== shift) { gesture.shift = shift; gesture.axis = null; }
  const dx = pointer.x - gesture.pointer.x, dy = pointer.y - gesture.pointer.y;
  if (shift && !gesture.axis && (dx || dy)) gesture.axis = screenAxis(dx, dy);
  gesture.point = { ...pointer,
    x: gesture.point.x + (!shift || gesture.axis === 'x' ? dx : 0),
    y: gesture.point.y + (!shift || gesture.axis === 'y' ? dy : 0),
  };
  gesture.pointer = pointer;
  return gesture.point;
}

/** Single view: pressing or releasing Shift mid-drag keeps the visible offset
 * and continues from the pointer position where the lock changed. `solve`
 * maps (from, to, shift) pointer points to a model-space [x, y, z] offset. */
export function shiftDragOffset(latch, pointer, shift, solve) {
  if (latch.shift !== shift) {
    const kept = solve(latch.from, latch.pointer, latch.shift);
    latch.base = latch.base.map((value, i) => value + kept[i]);
    latch.from = latch.pointer; latch.shift = shift;
  }
  latch.pointer = pointer;
  const offset = solve(latch.from, pointer, shift);
  return latch.base.map((value, i) => value + offset[i]);
}

export function shiftDragLatch(start, shift) {
  return { from: start, pointer: start, shift: !!shift, base: [0, 0, 0] };
}

/** Solve an axis directly BEFORE solving the plane: a near edge-on plane must
 * never amplify its almost-zero determinant into a huge constrained move. */
export function projectedPlaneTranslation(workplane, basis, dx, dy, constrain = false) {
  const axes = planeAxes(workplane), out = [0, 0, 0];
  const projection = i => {
    const [x, y] = basis[i], lengthSq = x * x + y * y;
    return lengthSq > 1e-4 ? (dx * x + dy * y) / lengthSq : 0;
  };
  if (constrain) { const axis = constrainedAxis(workplane); out[axis] = projection(axes.indexOf(axis)); return out; }
  const [[ax, ay], [bx, by]] = basis, determinant = ax * by - ay * bx;
  const product = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (product > 1e-4 && Math.abs(determinant) / product > .04) {
    out[axes[0]] = (dx * by - dy * bx) / determinant;
    out[axes[1]] = (dy * ax - dx * ay) / determinant;
  } else {
    const visible = ax * ax + ay * ay >= bx * bx + by * by ? 0 : 1;
    out[axes[visible]] = projection(visible);
  }
  return out;
}

/** Quad View alone uses a screen-axis constraint instead of the classic
 * workplane-axis constraint. */
export function quadProjectedPlaneTranslation(workplane, basis, dx, dy, constrain = false) {
  if (constrain) [dx, dy] = screenAxisDelta(dx, dy);
  return projectedPlaneTranslation(workplane, basis, dx, dy);
}

/** Screen pixels (y down) covered by one model unit along each axis of a
 * XY/ZX/YZ plane, measured at a point. */
export function planeScreenBasis(camera, point, width, height, workplane = 'xy') {
  const origin = point.clone().project(camera);
  return planeAxes(workplane).map(axis => {
    const end = point.clone().setComponent(axis, point.getComponent(axis) + 1).project(camera);
    return [(end.x - origin.x) * width / 2, (origin.y - end.y) * height / 2];
  });
}

/** Single view with the workplane off (MDLVis): a plain drag follows the
 * screen; Shift locks it to the chosen XY/ZX/YZ plane, whatever the camera angle. */
export function freeDragTranslation(camera, pivot, width, height, dx, dy, { shift = false, workplane = 'xy' } = {}) {
  if (!shift) return screenPlaneTranslation(camera, pivot, width, height, dx, dy);
  return pivot.clone().fromArray(projectedPlaneTranslation(workplane, planeScreenBasis(camera, pivot, width, height, workplane), dx, dy));
}

export function screenPlaneTranslation(camera, pivot, width, height, dx, dy, constrain = false) {
  if (constrain) [dx, dy] = screenAxisDelta(dx, dy);
  const screen = pivot.clone().project(camera);
  return screen.set(screen.x + dx * 2 / width, screen.y - dy * 2 / height, screen.z).unproject(camera).sub(pivot);
}

export const PERPENDICULAR = { X: 'yz', Y: 'xz', Z: 'xy' };
export function dominantPlaneAxis(plane, basis, dx, dy) {
  return plane.toUpperCase().split('').reduce((best, axis) => {
    const score = a => Math.abs(basis[a][0] * dx + basis[a][1] * dy) / (Math.hypot(...basis[a]) || 1);
    return !best || score(axis) > score(best) ? axis : best;
  }, null);
}
export function moveConstraint(handle, shift) {
  if (handle.plane) return { plane: handle.plane, axis: null, dominant: !!shift };
  return shift ? { plane: PERPENDICULAR[handle.axis], axis: null, dominant: false } : { plane: null, axis: handle.axis, dominant: false };
}
export function solveGizmoMove(gesture, dx, dy, shift = false, sensitivity = 1, axisDelta) {
  const { camera, origin: world, handle, width, height } = gesture;
  gesture.handleLatch ||= shiftDragLatch({ x: 0, y: 0 }, shift);
  return shiftDragOffset(gesture.handleLatch, { x: dx * sensitivity, y: dy * sensitivity }, shift, (from, to, held) => {
    if (gesture.handleSegment !== from) { gesture.handleSegment = from; gesture.dominantAxis = null; }
    const constraint = moveConstraint(handle, held), x = to.x - from.x, y = to.y - from.y;
    if (constraint.axis) return axisDelta(constraint.axis, x, y);
    const plane = constraint.plane, basis = planeScreenBasis(camera, world, width, height, plane);
    if (constraint.dominant) {
      if (!x && !y && !gesture.dominantAxis) return [0, 0, 0];
      gesture.dominantAxis ||= dominantPlaneAxis(plane, Object.fromEntries(plane.toUpperCase().split('').map((a, i) => [a, basis[i]])), x, y);
      return axisDelta(gesture.dominantAxis, x, y);
    }
    return projectedPlaneTranslation(plane, basis, x, y);
  });
}

// The enabled workplane, actual drag solve and badge share the same constraint.
export function solveMove(gesture, pointer, shift, {basis, screen, quad = false, collision = false, localAxes} = {}) {
  const plane = gesture.workplane || 'xy';
  let label = null;
  const offset = shiftDragOffset(gesture.latch, pointer, shift, (from, to, held) => {
    let x = to.x - from.x, y = to.y - from.y;
    label = null;
    if (quad || collision) {
      if (gesture.screenSegment !== from) {
        gesture.screenSegment = from;
        gesture.screenMotion = {point: from, pointer: from, shift: held, axis: null};
      }
      const point = moveDragPoint(gesture.screenMotion, to, held);
      x = point.x - from.x; y = point.y - from.y;
      if (!gesture.workplaneEnabled || collision && !held) return screen(x, y, false);
      if (held && gesture.screenMotion.axis) {
        // In an oblique pane a screen direction can span both model axes.
        const horizontal = gesture.screenMotion.axis === 'x';
        const direction = projectedPlaneTranslation(plane, basis, horizontal ? 1 : 0, horizontal ? 0 : 1);
        const axes = ['X','Y','Z'].filter((_, i) => Math.abs(direction[i]) > Math.max(...direction.map(Math.abs)) * 1e-6);
        label = axes.length === 1 ? axes[0] : plane;
      }
      const world = projectedPlaneTranslation(plane, basis, x, y);
      return localAxes ? [0,1,2].map(i => localAxes.reduce((sum, axis, j) => sum + axis[i] * world[j], 0)) : world;
    }
    if (!gesture.workplaneEnabled) return screen(x, y, held);
    if (held) label = 'XYZ'[constrainedAxis(plane)];
    return projectedPlaneTranslation(plane, basis, x, y, held);
  });
  return {offset, lock: label && {kind: label.length === 1 ? 'axis' : 'plane', label: label.toUpperCase().replace('XZ','ZX')}};
}

// The numbered selector and center grab use the same screen latch. When the
// popup inherits a workplane, project the held segment onto that model plane.
export function solveCollisionMove(gesture, pointer, shift) {
  const {dx, dy, basis, localAxes} = gesture.handle.move;
  const screen = (x, y) => dx.map((v, i) => x * v + y * dy[i]);
  return solveMove(gesture, pointer, shift, {screen, basis, localAxes, collision: true});
}

export function solveViewMove(gesture, pointer, shift, camera, pivot, width, height, quad = false) {
  return solveMove(gesture, pointer, shift, {
    basis: gesture.workplaneEnabled && planeScreenBasis(camera, pivot, width, height, gesture.workplane), quad,
    screen: (dx, dy, held) => freeDragTranslation(camera, pivot, width, height, dx, dy, {shift: held, workplane: gesture.workplane}).toArray(),
  });
}

// Bind feedback to the document that owns pointer capture, including portals.
const hosts = new WeakMap();
export function bindLockBadge(win, paint) {
  let down = false, held = false;
  const clear = () => paint(null);
  const stop = () => { down = false; clear(); };
  const press = e => { if (e.button === 0) { down = true; held = e.shiftKey; } };
  const key = e => {
    if (e.key === 'Escape') stop();
    if (e.key === 'Shift') { held = e.type === 'keydown'; if (!held) clear(); }
  };
  const events = {pointerdown: press, pointerup: stop, pointercancel: stop, lostpointercapture: stop, blur: e => { if (e.target === win) stop(); }, keydown: key, keyup: key};
  hosts.set(win, {clear, update: (lock, event) => paint(down && held && lock ? {label: lock.label, x: event.clientX, y: event.clientY} : null)});
  for (const [name, fn] of Object.entries(events)) win.addEventListener(name, fn, true);
  return () => {
    for (const [name, fn] of Object.entries(events)) win.removeEventListener(name, fn, true);
    hosts.delete(win);
  };
}
export function moveOffset(result, win, event) {
  hosts.get(win)?.update(result.lock, event);
  return result.offset;
}
export function clearMoveLock(win) { hosts.get(win)?.clear(); }
