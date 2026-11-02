import { solveGizmoMove } from '../src/shift-lock.js';
import { beginRotationDrag, rotationDragDegrees, rotationOptions, facingAxis, chooseLeverAxis, NORMAL } from '../src/rotation-drag.js';
import { Quaternion, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices, sampleTrack } from '../src/animation.js';
import { movementNodeCategories } from './preview-overlays.js';
import { samplePreviewMatrices } from './preview-pose.js';
import { visualOptions, viewportAppearanceOptions } from '../src/preferences.js';
import { boneHighlightColors, markerStyle, rigMarkerSize, rigMarkerVisible } from './rig-markers-gl.js';
import { boneDisplayColor, boneDisplayOptions, drawBoneLink } from './bone-display.js';
import { createPixelLineBatch } from './pixel-lines.js';

const COLORS = { X: '#fa4343', Y: '#34cf59', Z: '#3588ff' };
const CLASSIC_COLORS = { X: '#ff0000', Y: '#00ff00', Z: '#0000ff' };
const DEFAULT_AXIS_COLORS = { X: ['#ce3434', '#fa6975'], Y: ['#248142', '#77cf80'], Z: ['#236ac2', '#77aaff'] };
const gizmoColor = (axis, appearance, move) => move && (appearance?.moveGizmo || 'classic') === 'classic' && (!appearance?.['axis' + axis] || DEFAULT_AXIS_COLORS[axis].includes(appearance['axis' + axis])) ? CLASSIC_COLORS[axis] : appearance?.['axis' + axis] || COLORS[axis];
const PLANE_COLORS = { xy: 'Y', xz: 'X', yz: 'Z' };
const AXES = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const WORKPLANE_NORMALS = { xy: 'Z', xz: 'Y', zx: 'Y', yz: 'X' };
export const MOVEMENT_GIZMO_SCALE = 1;
export const MOVEMENT_MOVE_MAX_PIXELS = 104;
export function projectMovementNodes(model, frame, sequenceIndex, camera, width, height, globalTime = frame, suppliedMatrices, vanilla = false) {
  const matrices = suppliedMatrices || samplePreviewMatrices(model, frame, sequenceIndex, globalTime, camera);
  const lightIds = new Set((model.Lights || []).map(node => node.ObjectId));
  const categories = movementNodeCategories(model,vanilla);
  return allNodes(model).map(node => {
    const world = new Vector3().fromArray(nodePivot(model, node));
    const matrix = matrices.get(node.ObjectId); if (matrix) world.applyMatrix4(matrix);
    const screen = world.clone().project(camera);
    const rotation = new Quaternion(); matrix?.decompose(new Vector3(), rotation, new Vector3());
    const rgb = lightIds.has(node.ObjectId) ? sampleTrack(node.Color, frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime, fallback: [1, 1, 1] }) : null;
    const displayColor = rgb ? `rgb(${Array.from(rgb, value => Math.round(Math.max(0, Math.min(1, value)) * 255)).join(',')})` : null;
    const refNode = (model.Attachments || []).some(item => item.ObjectId === node.ObjectId);
    const helperNode = (model.Helpers || []).some(item => item.ObjectId === node.ObjectId);
    const eventNode = (model.EventObjects || []).some(item => item.ObjectId === node.ObjectId);
    const unit = camera.isPerspectiveCamera ? 2 * world.distanceTo(camera.position) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height : (camera.top - camera.bottom) / camera.zoom / height;
    const tetrahedron = refNode ? [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(vertex => { const p = new Vector3(...vertex).multiplyScalar(unit * 5).add(world).project(camera); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }; }) : null;
    return { node, world, rotation, billboardRotation:camera.quaternion.clone(), displayColor, tetrahedron, refNode, helperNode, eventNode, unitsPerPixel: unit, overlayKind: categories.get(node.ObjectId) || 'nodes', x: (screen.x + 1) * width / 2, y: (1 - screen.y) * height / 2, visible: screen.z >= -1 && screen.z <= 1 };
  });
}

export function movementAxisHandles(active, camera, width, height, radius, space = 'world', mode = 'rotate', appearance = null) {
  if (!active?.visible) return [];
  // Move shrinks with the model at a distance, capped at the reference size.
  const distance = camera.isPerspectiveCamera ? active.world.distanceTo(camera.position) : radius * 2.6;
  const unit = camera.isPerspectiveCamera ? 2 * distance * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height : (camera.top - camera.bottom) / camera.zoom / height;
  const handles = Object.entries(AXES).map(([axis, values]) => {
    const direction = new Vector3().fromArray(values);
    if (space === 'local' && mode !== 'scale') direction.applyQuaternion(active.rotation);
    const length = mode === 'move' ? Math.min(unit * 112, radius * .2) : unit * 68;
    const end = active.world.clone().addScaledVector(direction, length * MOVEMENT_GIZMO_SCALE).project(camera);
    let dx = (end.x + 1) * width / 2 - active.x, dy = (1 - end.y) * height / 2 - active.y;
    const projectedDx = dx, projectedDy = dy;
    // An axis facing the camera still gets a usable short handle.
    if (Math.hypot(dx, dy) < 18 * MOVEMENT_GIZMO_SCALE) { dx = axis === 'Z' ? 0 : axis === 'X' ? 25 * MOVEMENT_GIZMO_SCALE : -25 * MOVEMENT_GIZMO_SCALE; dy = axis === 'Z' ? -25 * MOVEMENT_GIZMO_SCALE : 25 * MOVEMENT_GIZMO_SCALE; }
    if (mode === 'move') { const pixels = Math.hypot(dx, dy), scale = Math.max(52, Math.min(MOVEMENT_MOVE_MAX_PIXELS, pixels)) / pixels; dx *= scale; dy *= scale; }
    return { axis, mode, radius, direction, world: active.world, camera, width, height, color: COLORS[axis], x: active.x + dx, y: active.y + dy, startX: active.x, startY: active.y, dx, dy, projectedDx, projectedDy, unitsPerPixel: unit };
  });
  if (mode === 'rotate' && appearance?.rotateHandles && appearance.rotateHandles !== 'lines') {
    return handles.map(handle => ({ ...handle, ring: true, points: rotationRingPoints(active.world, handle.direction, unit * 68, camera, width, height, 0, appearance.rotateHandles === 'arcs' ? Math.PI / 2 : Math.PI * 2) }));
  }
  if (mode === 'move') for (const plane of ['xy', 'xz', 'yz']) {
    const [a, b] = plane.toUpperCase().split('').map(axis => handles.find(handle => handle.axis === axis));
    if (Math.hypot(a.projectedDx, a.projectedDy) < 1e-5 || Math.hypot(b.projectedDx, b.projectedDy) < 1e-5) continue;
    if (Math.abs(a.projectedDx * b.projectedDy - a.projectedDy * b.projectedDx) / (Math.hypot(a.projectedDx, a.projectedDy) * Math.hypot(b.projectedDx, b.projectedDy) || 1) < .01) continue;
    // Fixed between its two displayed arrows, with sides half their lengths.
    const polygon = [[.25,.25],[.75,.25],[.75,.75],[.25,.75]].map(([u, v]) => ({
      x: active.x + a.dx * u + b.dx * v, y: active.y + a.dy * u + b.dy * v,
    }));
    const area = Math.abs(polygon.reduce((sum, point, i) => { const next = polygon[(i + 1) % 4]; return sum + point.x * next.y - next.x * point.y; }, 0)) / 2;
    // Edge-on planes have no usable square.
    if (area < 35) continue;
    handles.push({ axis: plane.toUpperCase(), mode, radius, plane, polygon, color: COLORS[PLANE_COLORS[plane]],
      x: active.x + (a.dx + b.dx) / 2, y: active.y + (a.dy + b.dy) / 2,
      startX: active.x, startY: active.y, unitsPerPixel: unit });
  }
  return handles;
}

export function drawMovementOverlay(context, nodes, selectedIds, handles, width, height, ratio = 1, options = { bones: true, nodes: true, attachments: true, particles: true, boneLines: true }) {
  context.clearRect(0, 0, width * ratio, height * ratio);
  context.save(); context.scale(ratio, ratio);
  const selected = new Set(selectedIds), byId = new Map(nodes.map(point => [point.node.ObjectId, point])), highlights = options.boneHighlights || boneHighlightColors(nodes, selectedIds);
  const visual = visualOptions(options.preferences), boxSize = visual.helperSize * 3, bones = boneDisplayOptions(options.preferences);
  for (const point of nodes) {
    const parent = byId.get(point.node.Parent);
    if (!options.boneLines) continue;
    if (!point.visible || !parent?.visible) continue;
    const line = boneConnectionEndpoints(parent, point, visual.helperSize);
    if (!line) continue;
    const appearance = boneConnectionAppearance(parent, point, highlights);
    if (!boneConnectionVisible(parent, point, highlights, options.focusedBoneLines)) continue;
    drawBoneLink(context, line.from, line.to, { bones, highlight: appearance, ratio });
  }
  for (const point of nodes) if (point.visible && rigMarkerVisible(point, options, highlights)) {
    const isSelected = selected.has(point.node.ObjectId), emitter = (point.node.Flags & 4096) !== 0;
    const bone = point.overlayKind === 'bones';
    context.fillStyle = markerStyle(point, byId, options.preferences, highlights, options.vanilla, visual).color;
    context.strokeStyle = isSelected ? '#fff14e' : '#17263d'; context.lineWidth = isSelected ? 2.5 : 1.5;
    context.beginPath();
    if (options.glMarkers) { /* Shape rendering shares the mesh's actual GL depth. */ }
    else if ((bone || point.helperNode) && bones.style === 'diamond') { context.moveTo(point.x, point.y - boxSize / 2); context.lineTo(point.x + boxSize / 2, point.y); context.lineTo(point.x, point.y + boxSize / 2); context.lineTo(point.x - boxSize / 2, point.y); context.closePath(); }
    else if (bone || point.helperNode) context.rect(point.x - boxSize / 2, point.y - boxSize / 2, boxSize, boxSize);
    else if (point.tetrahedron) { for (const face of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) { const [a, b, c] = face.map(index => point.tetrahedron[index]); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.lineTo(a.x, a.y); } }
    else if (emitter) context.rect(point.x - 4.5, point.y - 4.5, 9, 9);
    else context.arc(point.x, point.y, isSelected ? 5 : 4, 0, Math.PI * 2);
    context.fill(); context.stroke();
    // Tool previews that place a few named points (Attachemator) label those points.
    if (isSelected || options.nodeLabels?.has?.(point.node.ObjectId)) {
      const label = point.node.Name || `Node ${point.node.ObjectId}`;
      context.font = isSelected ? '11px Tahoma, sans-serif' : '10px Tahoma, sans-serif'; context.lineWidth = 3; context.strokeStyle = '#17263d';
      context.strokeText(label, point.x + 8, point.y - 8);
      context.fillStyle = isSelected ? '#fff14e' : '#fff'; context.fillText(label, point.x + 8, point.y - 8);
    }
  }
  drawMovementGizmo(context, handles, 1, options.activeAxis, viewportAppearanceOptions(options.preferences).controllers);
  context.restore();
}

export function drawMovementGizmo(context, handles, ratio = 1, activeAxis = null, appearance = null) {
  context.save(); context.scale(ratio, ratio);
  for (const handle of handles.filter(handle => handle.plane)) {
    const classic = (appearance?.moveGizmo || 'classic') === 'classic', active = handle.axis === activeAxis, color = active ? '#fff14e' : gizmoColor(PLANE_COLORS[handle.plane], appearance, true);
    context.save(); context.shadowColor = color; context.shadowBlur = active ? 8 : 0;
    context.beginPath(); handle.polygon.forEach((point, index) => context[index ? 'lineTo' : 'moveTo'](point.x, point.y)); context.closePath();
    context.fillStyle = color; context.globalAlpha = active ? .5 : classic ? .08 : .16; context.fill(); context.globalAlpha = 1;
    context.shadowBlur = 0; context.strokeStyle = appearance?.outline || '#162137'; context.lineWidth = classic ? 0 : 3; if (!classic) context.stroke();
    context.shadowBlur = active ? 8 : 0; context.strokeStyle = color; context.lineWidth = active ? 2.5 : classic ? 1 : 1.5; context.stroke(); context.restore();
  }
  for (const handle of handles.filter(handle => !handle.plane)) {
    const active = handle.axis === activeAxis, color = active ? '#fff14e' : gizmoColor(handle.axis, appearance, handle.mode === 'move');
    if (handle.ring) { drawRotationRing(context, handle.points, color, active); continue; }
    const style = appearance?.moveGizmo || 'classic', classic = handle.mode === 'move' && style === 'classic', bold = handle.mode === 'move' && style === 'bold';
    context.save();
    const length = Math.hypot(handle.dx, handle.dy), ux = handle.dx / length, uy = handle.dy / length;
    context.beginPath(); context.moveTo(handle.startX + (handle.mode === 'move' ? ux * 24 : 0), handle.startY + (handle.mode === 'move' ? uy * 24 : 0)); context.lineTo(handle.x, handle.y);
    context.strokeStyle = appearance?.outline || '#162137'; context.lineWidth = handle.mode === 'move' ? bold ? 6 : 3.5 : 5; if (!classic) context.stroke();
    context.shadowColor = color; context.shadowBlur = active ? 8 : 0;
    context.strokeStyle = color; context.lineWidth = handle.mode === 'move' ? classic ? 1 : bold ? 4 : 2 : 3; context.stroke();
    if (handle.mode === 'move') {
      const head = classic ? 6 : bold ? 14 : 10, half = classic ? 3 : bold ? 7 : 4.5;
      context.beginPath(); context.moveTo(handle.x, handle.y);
      context.lineTo(handle.x - ux * head - uy * half, handle.y - uy * head + ux * half);
      context.lineTo(handle.x - ux * head + uy * half, handle.y - uy * head - ux * half); context.closePath();
      context.fillStyle = color; context.fill(); context.shadowBlur = 0; context.lineWidth = 1; context.strokeStyle = appearance?.outline || '#162137'; if (!classic) context.stroke(); context.restore(); continue;
    }
    context.beginPath(); context.arc(handle.x, handle.y, 10, 0, Math.PI * 2); context.fillStyle = color; context.fill();
    context.lineWidth = 1; context.strokeStyle = appearance?.outline || '#162137'; context.stroke();
    context.font = 'bold 11px Tahoma, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#fff'; context.fillText(handle.axis, handle.x, handle.y); context.restore();
  }
  context.restore();
}

function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = list => { const out = []; for (const point of list) { while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop(); out.push(point); } return out; };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}

const symbolHulls = new WeakMap();
function connectorMaskVertices(shape) {
  if (!shape.billboard) return shape.vertices;
  let vertices = symbolHulls.get(shape);
  if (!vertices) {
    vertices = convexHull(shape.vertices.map((point,index) => ({ x:point[0],y:point[1],index }))).map(point => shape.vertices[point.index]);
    symbolHulls.set(shape,vertices);
  }
  return vertices;
}

/** Focused Skeleton: an axis cross on each highlighted bone's pivot. The arms
 * are the bone's own X (red), Y (green) and Z (blue) axes, so they turn as the
 * bone turns and show its rotation far better than the small cube. */
export function drawPivotCrosses(context, nodes, highlights, camera, width, height, ratio = 1) {
  const at = new Vector3(), screen = value => { at.copy(value).project(camera); return [(at.x + 1) * width / 2, (1 - at.y) * height / 2]; };
  context.save(); context.scale(ratio, ratio); context.lineCap = 'round';
  for (const point of nodes) {
    if (!point.visible || point.overlayKind !== 'bones' || !highlights?.get(point.node.ObjectId)) continue;
    for (const [axis, color, pixels] of [[[1, 0, 0], '#ff4040', 28], [[0, 1, 0], '#40d040', 20], [[0, 0, 1], '#4a8cff', 20]]) {
      const arm = new Vector3(...axis).applyQuaternion(point.rotation).multiplyScalar(point.unitsPerPixel * pixels);
      const from = screen(point.world.clone().add(arm)), to = screen(point.world.clone().sub(arm));
      for (const [stroke, lineWidth] of [['#000', 6], [color, 3]]) { context.strokeStyle = stroke; context.lineWidth = lineWidth; context.beginPath(); context.moveTo(...from); context.lineTo(...to); context.stroke(); }
    }
  }
  context.restore();
}

/** Connectors occupy their own pixel layer below mesh wires and point overlays.
 * Remove only the projected polyhedron footprints so GL markers remain in front. */
export function drawBoneConnectors(context, nodes, selectedIds, camera, width, height, ratio = 1, options = {}) {
  context.clearRect(0, 0, width * ratio, height * ratio);
  if (!options.boneLines) return;
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point]));
  const highlights = options.boneHighlights || boneHighlightColors(nodes, selectedIds), bones = boneDisplayOptions(options.preferences), visual = visualOptions(options.preferences);
  const pixelBatch = ['shaded', 'stick'].includes(bones.connector) && context.canvas?.width && context.createImageData && context.putImageData ? createPixelLineBatch(context) : null;
  for (const point of nodes) {
    const parent = byId.get(point.node.Parent);
    if (!point.visible || !parent?.visible) continue;
    const line = boneConnectionEndpoints(parent, point);
    if (!line) continue;
    const appearance = boneConnectionAppearance(parent, point, highlights);
    if (!boneConnectionVisible(parent, point, highlights, options.focusedBoneLines)) continue;
    drawBoneLink(context, line.from, line.to, { bones, highlight: appearance, ratio, pixelBatch });
  }
  pixelBatch?.flush();
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalCompositeOperation = 'destination-out';
  for (const point of nodes) {
    if (!point.visible || !rigMarkerVisible(point, options, highlights)) continue;
    const shape = markerStyle(point, byId, options.preferences, highlights, options.vanilla, visual).shape;
    const size = rigMarkerSize(point, shape, options, visual);
    const hull = convexHull(connectorMaskVertices(shape).map(vertex => {
      const p = new Vector3(...vertex).multiplyScalar(size).applyQuaternion(shape.billboard?(point.billboardRotation||point.rotation):point.rotation).add(point.world).project(camera);
      return { x: (p.x + 1) * width * ratio / 2, y: (1 - p.y) * height * ratio / 2 };
    }));
    if (hull.length < 3) continue;
    const minY = Math.max(0, Math.floor(Math.min(...hull.map(p => p.y))));
    const maxY = Math.min(Math.ceil(height * ratio), Math.ceil(Math.max(...hull.map(p => p.y))));
    for (let y = minY; y <= maxY; y++) {
      const crossings = [];
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length], sample = y + .5;
        if (sample >= Math.min(a.y, b.y) && sample < Math.max(a.y, b.y)) crossings.push(a.x + (sample - a.y) * (b.x - a.x) / (b.y - a.y));
      }
      if (crossings.length >= 2) {
        const left = Math.ceil(Math.min(...crossings)), right = Math.floor(Math.max(...crossings));
        if (right >= left) context.fillRect(left, y, right - left + 1, 1);
      }
    }
  }
  context.restore();
}

export function drawAttachGuide(context, nodes, sourceIds, pointer, ratio = 1, time = 0, helperSize = 6) {
  const ids = new Set(Array.isArray(sourceIds) ? sourceIds : [sourceIds]);
  const sources = nodes.filter(point => point.visible && ids.has(point.node.ObjectId));
  if (!sources.length) return;
  context.save(); context.scale(ratio, ratio);
  for (const point of nodes) {
    if (!point.visible || point.overlayKind !== 'bones' || ids.has(point.node.ObjectId)) continue;
    const radius = movementMarkerRadius(point, helperSize);
    context.strokeStyle = '#ffe600'; context.lineWidth = 3;
    context.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  }
  if (pointer) {
    context.strokeStyle = '#ed2626'; context.lineWidth = 3; context.lineCap = 'round';
    context.setLineDash([.1, 8]); context.lineDashOffset = -(time * .035 % 8);
    for (const source of sources) { context.beginPath(); context.moveTo(source.x, source.y); context.lineTo(pointer.x, pointer.y); context.stroke(); }
  }
  context.restore();
}

/** Connect pivots directly, even when their visible markers overlap. */
export function boneConnectionEndpoints(parent, child) {
  if (parent.x === child.x && parent.y === child.y) return null;
  return { from: { x: parent.x, y: parent.y }, to: { x: child.x, y: child.y } };
}

export function movementMarkerRadius(point, helperSize = 6) {
  if (point?.tetrahedron?.length) return Math.max(helperSize * 1.5, ...point.tetrahedron.map(vertex => Math.hypot(vertex.x - point.x, vertex.y - point.y))) + 1;
  // GL cubes and tetrahedrons share corners at (+/-1,+/-1,+/-1).
  if (point?.overlayKind === 'bones' || point?.helperNode || point?.overlayKind === 'attachments' || point?.overlayKind === 'particles' || point?.overlayKind === 'ribbons' || point?.eventNode) return helperSize * 1.5 * Math.sqrt(3) + 2;
  return Math.max(5, helperSize) + 1;
}

export function pickMovementNode(nodes, x, y, selectedIds = [], threshold = 13, preferSelected = false, cycleOverlaps = false) {
  const candidates = nodes.filter(point => point.visible && Math.hypot(point.x - x, point.y - y) <= threshold);
  candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  // Repeated clicks cycle through coincident nodes, so child and emitter pivots
  // remain selectable even when they occupy the same screen position.
  const close = cycleOverlaps ? candidates : candidates.filter(point => Math.hypot(point.x - x, point.y - y) <= (candidates[0] ? Math.hypot(candidates[0].x - x, candidates[0].y - y) + 2 : 0));
  const current = close.findIndex(point => selectedIds.includes(point.node.ObjectId));
  if(preferSelected&&current>=0)return close[current];
  return close.length ? close[(current + 1) % close.length] : null;
}

export function movementDragAmount(handle, dx, dy, mode, sensitivity = 1) {
  const pixels = (dx * handle.dx + dy * handle.dy) / Math.max(1, Math.hypot(handle.dx, handle.dy)) * sensitivity;
  return mode === 'rotate' ? pixels : mode === 'scale' ? Math.max(.01, Math.exp(pixels / 100)) : pixels * handle.unitsPerPixel;
}

export function movementRotationSpace(gesture) {
  return gesture.workplaneEnabled && !(gesture.pose && ['body', 'node'].includes(gesture.target?.kind)) ? 'world' : gesture.space;
}

export function movementRotationAmount(gesture, dx, dy, sensitivity = 1, shift = false) {
  return rotationDragDegrees(gesture, dx, dy, sensitivity, shift);
}

/** A bare bone drag turns around the nearest model axis to the view normal. */
export function movementViewRotationHandle(view, unitsPerPixel = 1) {
  const axis = Object.keys(AXES).reduce((best, next) => Math.abs(view[next.toLowerCase()]) > Math.abs(view[best.toLowerCase()]) ? next : best, 'X');
  return { axis, dx: 1, dy: -1, unitsPerPixel };
}

/** Free-space Resize follows the screen gesture: right/up grows and left/down
 * shrinks. Workplane bubbles constrain the two named axes only while Shift is
 * held; otherwise the same gesture is uniform XYZ scaling. */
export function movementFreeScaleValues(dx, dy, { sensitivity = 1, workplaneEnabled = false, workplane = 'xy', shiftKey = false } = {}) {
  const factor = Math.max(.01, Math.exp((Number(dx) - Number(dy)) * Number(sensitivity || 1) / 100));
  const values = [factor, factor, factor];
  if (workplaneEnabled && shiftKey) values[{ xy: 2, xz: 1, zx: 1, yz: 0 }[String(workplane).toLowerCase()] ?? 2] = 1;
  return values;
}

/** Selected-to-descendant links are yellow; the immediate parent-to-selected
 * link is red. Other hierarchy links keep the classic black-to-white fade. */
export function boneConnectionAppearance(parent, child, highlights) {
  const from = highlights?.get(parent?.node?.ObjectId), to = highlights?.get(child?.node?.ObjectId);
  if (to === '#ff0000' && from === '#000000') return '#ff0000';
  if (to === '#ffff00' && (from === '#ff0000' || from === '#ffff00')) return '#ffff00';
  return null;
}

export function boneConnectionVisible(parent, child, highlights, focused = false) {
  return !focused || !!boneConnectionAppearance(parent, child, highlights);
}

export function movementWorkplaneHandle(workplane = 'xy', unitsPerPixel = 1) {
  const plane = String(workplane).toLowerCase(), vertical = plane === 'xz' || plane === 'zx';
  return { axis: WORKPLANE_NORMALS[plane] || 'Z', dx: vertical ? 0 : 1, dy: vertical ? 1 : 0, unitsPerPixel };
}

/** The projected world-plane basis decides which screen components matter. */
export function movementWorkplanePointer(workplane, dx, dy) {
  return [dx, dy];
}

function pointSegmentDistance(x, y, handle) {
  const dx = handle.x - handle.startX, dy = handle.y - handle.startY, length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((x - handle.startX) * dx + (y - handle.startY) * dy) / length2)) : 0;
  return Math.hypot(x - (handle.startX + dx * t), y - (handle.startY + dy * t));
}

export function pickMovementHandle(handles, x, y, mode, threshold = 10) {
  if (mode === 'tip') handles = handles.filter(handle => !handle.ring);
  if (mode === 'rotate' && handles.some(handle => handle.ring)) return handles.map(handle => ({ handle, distance: Math.min(...handle.points.slice(1).map((point, i) => pointSegmentDistance(x, y, { startX: handle.points[i].x, startY: handle.points[i].y, x: point.x, y: point.y }))) })).filter(hit => hit.distance <= threshold).sort((a, b) => a.distance - b.distance)[0]?.handle || null;
  if (mode === 'rotate') {
    // A short camera-facing axis can sit on another axis's shaft. Its visible
    // XYZ endpoint owns that press, just as it does for the other gizmo tools.
    const tip = handles.filter(handle => !handle.plane).map(handle => ({ handle, distance: Math.hypot(handle.x - x, handle.y - y) }))
      .filter(hit => hit.distance <= threshold).sort((a, b) => a.distance - b.distance)[0];
    if (tip) return tip.handle;
    // Keep the bone marker available for rotate-in-this-view dragging.
    handles = handles.filter(handle => Math.hypot(x - handle.startX, y - handle.startY) >= 13);
  }
  if (mode === 'move') {
    // The central symbol remains available for direct dragging and overlap cycling.
    handles = handles.filter(handle => Math.hypot(x - handle.startX, y - handle.startY) >= 20);
    const shaft = handles.filter(handle => !handle.plane).map(handle => ({ handle, distance: pointSegmentDistance(x, y, handle) })).filter(hit => hit.distance <= 4).sort((a, b) => a.distance - b.distance)[0];
    if (shaft) return shaft.handle;
    const pads = handles.filter(handle => handle.plane && (handle.polygon.every((point, i, polygon) => {
      const next = polygon[(i + 1) % polygon.length]; return (next.x - point.x) * (y - point.y) - (next.y - point.y) * (x - point.x) >= 0;
    }) || handle.polygon.every((point, i, polygon) => {
      const next = polygon[(i + 1) % polygon.length]; return (next.x - point.x) * (y - point.y) - (next.y - point.y) * (x - point.x) <= 0;
    })));
    if (pads.length) return pads.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  }
  const distance = handle => mode === 'rotate' || mode === 'move' ? pointSegmentDistance(x, y, handle) : Math.hypot(handle.x - x, handle.y - y);
  return handles.filter(handle => !handle.plane).map(handle => ({ handle, distance: distance(handle) })).filter(hit => hit.distance <= threshold).sort((a, b) => a.distance - b.distance)[0]?.handle || null;
}

/** Keep the adjacent Pin button out of the selected control's drag areas. */
export function movementPinPosition(active, handles, width, height, buttonWidth = 76, buttonHeight = 28, nearby = [], preferred = null) {
  const overlaps = (box, points, padding = 6) => {
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    return Math.min(...xs) - padding < box.x + buttonWidth && Math.max(...xs) + padding > box.x && Math.min(...ys) - padding < box.y + buttonHeight && Math.max(...ys) + padding > box.y;
  };
  const collisions = box => handles.filter(handle => {
    if (handle.plane) return overlaps(box, handle.polygon);
    const length = Math.hypot(handle.dx, handle.dy);
    for (let pixel = 24; pixel <= length + 6; pixel += 6) {
      if (overlaps(box, [{ x: handle.startX + handle.dx * pixel / length, y: handle.startY + handle.dy * pixel / length }], 8)) return true;
    }
    return false;
  }).length + nearby.filter(handle => handle.visible && !handle.quiet && (
    overlaps(box, [{ x: handle.x, y: handle.y }], handle.pinned ? 27 : 23) ||
    (handle.selected || handle.hovered || handle.kind === 'bend') && overlaps(box, [{ x: handle.labelX ?? handle.x + 20, y: (handle.labelY ?? handle.y) - 7 }, { x: (handle.labelX ?? handle.x + 20) + (handle.labelWidth ?? (handle.label?.length || 0) * 7), y: (handle.labelY ?? handle.y) + 7 }])
  )).length;
  const clamp = (x, y) => ({ x: Math.max(4, Math.min(width - buttonWidth - 4, x)), y: Math.max(4, Math.min(height - buttonHeight - 4, y)) });
  const body = nearby.find(handle => handle.visible && !handle.quiet && handle.label === (active.chain?.kind === 'leg' ? 'Pelvis' : 'Chest')) || nearby.find(handle => handle.kind === 'body' && handle.visible);
  if (body) {
    // Prefer the character's outside flank. Only use a vertical direction when
    // the endpoint projects directly above/below the body's centre.
    const dx = active.x - body.x, dy = active.y - body.y;
    const angle = Math.abs(dx) > 8 ? dx > 0 ? 0 : Math.PI : dy < 0 ? -Math.PI / 2 : Math.PI / 2;
    const outward = { x: Math.cos(angle), y: Math.sin(angle) };
    const edges = handles.flatMap(handle => handle.plane ? handle.polygon : [{ x: handle.x, y: handle.y }]);
    const extent = Math.max(active.size || 24, ...edges.map(point => (point.x - active.x) * outward.x + (point.y - active.y) * outward.y)) + 14;
    const half = Math.abs(outward.x) * buttonWidth / 2 + Math.abs(outward.y) * buttonHeight / 2;
    const outside = box => (box.x + buttonWidth / 2 - active.x) * outward.x + (box.y + buttonHeight / 2 - active.y) * outward.y - half >= extent - .1;
    if (preferred) { const box = clamp(active.x + preferred.x, active.y + preferred.y); if (outside(box) && !collisions(box)) return box; }
    const slots = [];
    for (const distance of [0, 24, 48, 80]) for (const slide of [0, -40, 40, -80, 80, -120, 120]) {
      const box = clamp(active.x + outward.x * (extent + half + distance) - outward.y * slide - buttonWidth / 2, active.y + outward.y * (extent + half + distance) + outward.x * slide - buttonHeight / 2);
      const score = collisions(box) * 1000 + (outside(box) ? 0 : 100000) + distance + Math.abs(slide) * .1;
      slots.push({ box, score }); if (!score) return box;
    }
    return slots.sort((a, b) => a.score - b.score)[0].box;
  }
  // Reuse the same side of the limb while it remains clear. Toggling Pin or
  // moving a nearby control must not make a usable button jump between slots.
  if (preferred) {
    const box = clamp(active.x + preferred.x, active.y + preferred.y);
    if (!collisions(box)) return box;
  }
  const candidates = [];
  for (const gap of [30, 54, 78]) for (const [dx, dy] of [[0,1],[0,-1],[-1,0],[1,0],[-1,1],[1,1],[-1,-1],[1,-1]]) {
    const box = clamp(active.x + dx * (gap + buttonWidth / 2) - buttonWidth / 2, active.y + dy * (gap + buttonHeight / 2) - buttonHeight / 2);
    const score = collisions(box); candidates.push({ box, score }); if (!score) return box;
  }
  return candidates.sort((a, b) => a.score - b.score)[0].box;
}

export function movementNodeSelection(selectedIds, id, { multiple = false, shift = false, ctrl = false } = {}) {
  const selected = [...new Set(selectedIds || [])];
  if (!multiple) return [id];
  if (ctrl) return selected.filter(value => value !== id);
  if (shift) return selected.includes(id) ? selected : [...selected, id];
  return [id];
}

const projectGizmo = (world, camera, width, height) => {
  const point = world.clone().project(camera);
  return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
};
function rotationBasis(normal) {
  const seed = Math.abs(normal.z) < .9 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  const u = seed.addScaledVector(normal, -seed.dot(normal)).normalize();
  return [u, new Vector3().crossVectors(normal, u).normalize()];
}
function rotationRingPoints(world, normal, radius, camera, width, height, start = 0, end = Math.PI * 2) {
  const [u, v] = rotationBasis(normal), points = [], eye = camera.position.clone().sub(world);
  for (let i = 0; i <= 96; i++) {
    const angle = start + (end - start) * i / 96, offset = u.clone().multiplyScalar(Math.cos(angle) * radius).addScaledVector(v, Math.sin(angle) * radius);
    points.push({ ...projectGizmo(world.clone().add(offset), camera, width, height), near: offset.dot(eye) >= 0 });
  }
  return points;
}
function drawRotationRing(context, points, color, active) {
  for (let i = 1; i < points.length; i++) {
    context.beginPath(); context.moveTo(points[i - 1].x, points[i - 1].y); context.lineTo(points[i].x, points[i].y);
    context.strokeStyle = '#162137'; context.lineWidth = active ? 5 : points[i].near ? 3 : 2; context.stroke();
    context.strokeStyle = active ? '#fff64a' : color; context.lineWidth = active ? 3.2 : points[i].near ? 2 : .8; context.stroke();
  }
}
/** Screen direction of a positive turn about the locked plane, fixed at press time. */
export function constrainedRotationTangent({ world, camera, width, height, normal }) {
  const pivot = projectGizmo(world, camera, width, height);
  const toward = camera.isOrthographicCamera ? camera.getWorldDirection(new Vector3()).negate() : camera.position.clone().sub(world);
  const radial = toward.clone().addScaledVector(normal, -toward.dot(normal));
  if (radial.lengthSq() < .26 * .26 * toward.lengthSq()) {
    return { mode: 'circle' };
  }
  radial.normalize();
  const tangentWorld = new Vector3().crossVectors(normal, radial);
  const tip = projectGizmo(world.clone().add(tangentWorld), camera, width, height);
  const tx = tip.x - pivot.x, ty = tip.y - pivot.y, length = Math.hypot(tx, ty);
  return { mode: 'line', x: tx / length, y: ty / length };
}
/** Capture the actual world/local axes, camera and speed once for every editor. */
export function beginGizmoRotation({ x, y, world, camera, width, height, handle, rotation, space = 'world', workplaneEnabled = false, workplane = 'xy', preferences, editor = 'vertices' }) {
  const pivot = projectGizmo(world, camera, width, height), directions = {}, facings = {}, tangents = {};
  const unit = camera.isOrthographicCamera ? (camera.top - camera.bottom) / camera.zoom / height : 2 * world.distanceTo(camera.position) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height;
  for (const axis of Object.keys(AXES)) {
    directions[axis] = new Vector3().fromArray(AXES[axis]);
    if (space === 'local' && rotation) directions[axis].applyQuaternion(rotation);
    facings[axis] = directions[axis].clone().transformDirection(camera.matrixWorldInverse).z;
  }
  const style = viewportAppearanceOptions(preferences).controllers.rotateHandles;
  const lever = !workplaneEnabled && handle && !handle.free && !handle.offHandle && style === 'lines' ? handle.axis : null;
  const defaultAxis = facingAxis(Object.keys(AXES).map(axis => facings[axis]));
  const axisName = workplaneEnabled ? NORMAL[workplane] : lever ? null : handle && !handle.free && !handle.offHandle ? handle.axis : defaultAxis;
  if (lever) {
    const arm = directions[lever].clone().multiplyScalar(unit * 68), tip = world.clone().add(arm), at = projectGizmo(tip, camera, width, height);
    for (const axis of Object.keys(AXES)) {
      const end = projectGizmo(tip.clone().add(new Vector3().crossVectors(directions[axis], arm)), camera, width, height);
      tangents[axis] = [end.x - at.x, end.y - at.y];
    }
  }
  const tangent = workplaneEnabled ? constrainedRotationTangent({ world, camera, width, height, normal: directions[axisName] }) : undefined;
  const drag = beginRotationDrag({ ...rotationOptions(preferences, editor), x, y, pivot, constrained: workplaneEnabled, plane: workplane, axisName, lever, tangents, facings, tangent: tangent?.mode === 'line' ? tangent : undefined, circle: tangent?.mode === 'circle', axis: axisName ? [0, 0, facings[axisName]] : undefined });
  const normal = axisName ? directions[axisName] : directions[defaultAxis];
  const [u, v] = rotationBasis(normal), su = projectGizmo(world.clone().addScaledVector(u, unit * 68), camera, width, height), sv = projectGizmo(world.clone().addScaledVector(v, unit * 68), camera, width, height);
  const ax = su.x - pivot.x, ay = su.y - pivot.y, bx = sv.x - pivot.x, by = sv.y - pivot.y, gx = x - pivot.x, gy = y - pivot.y;
  const phase = Math.atan2(ax * gy - ay * gx, gx * by - gy * bx);
  if (!workplaneEnabled) drag.ringRadius = 68;
  return Object.assign(drag, { phase, world: world.clone(), camera: camera.clone(), width, height, directions, unit, pivot, start: { x, y }, handle, style });
}
/** The same Shift latch as free Move, with the lab's arrow/plane constraints. */
export function gizmoMoveTranslation(gesture, dx, dy, shift = false, sensitivity = 1) {
  const { camera, origin: world, handle, width, height } = gesture;
  const axisDelta = (axis, x, y) => {
    const index = 'XYZ'.indexOf(axis), at = projectGizmo(world, camera, width, height), tip = projectGizmo(world.clone().setComponent(index, world.getComponent(index) + 1), camera, width, height);
    const ax = tip.x - at.x, ay = tip.y - at.y, length = ax * ax + ay * ay;
    const handles = gesture.moveHandles ||= movementAxisHandles({ world, ...at, visible: true }, camera, width, height, handle.radius || 1, 'world', 'move');
    const arrow = handle.axis === axis && !handle.plane && Number.isFinite(handle.projectedDx) ? handle : handles.find(h => h.axis === axis && !h.plane);
    // Preserve the existing short stand-in arrow: a nearly camera-facing axis
    // must not divide a tiny screen projection into a huge world displacement.
    return new Vector3().setComponent(index, Math.hypot(arrow.projectedDx, arrow.projectedDy) < 18 ? movementDragAmount(arrow, x, y, 'move') : (x * ax + y * ay) / length).toArray();
  };
  return solveGizmoMove(gesture, dx, dy, shift, sensitivity, axisDelta);
}
/** Brighter lab feedback; no ghost geometry. All consumers call this in their draw. */
export function drawGizmoRotationFeedback(context, drag, ratio = 1) {
  if (!drag) return;
  context.save(); context.scale(ratio, ratio);
  if (drag.circle) {
    const { x, y } = drag.pivot, radius = 40, start = -Math.PI * .75, end = -Math.PI * .25;
    const stroke = (color, width) => {
      context.beginPath(); context.arc(x, y, radius, start, end);
      for (const angle of [start, end]) {
        const px = x + radius * Math.cos(angle), py = y + radius * Math.sin(angle);
        const tx = -Math.sin(angle), ty = Math.cos(angle), sign = angle === start ? 1 : -1;
        context.moveTo(px + sign * tx * 9 - ty * 6, py + sign * ty * 9 + tx * 6);
        context.lineTo(px, py);
        context.lineTo(px + sign * tx * 9 + ty * 6, py + sign * ty * 9 - tx * 6);
      }
      context.strokeStyle = color; context.lineWidth = width; context.lineJoin = 'round'; context.stroke();
    };
    stroke('#162137', 5); stroke('#fff64a', 2.5);
  } else if (drag.constrained) {
    const { x, y } = drag.start, { x: tx, y: ty } = drag.tangent;
    const a = { x: x - tx * 24, y: y - ty * 24 }, b = { x: x + tx * 24, y: y + ty * 24 };
    const stroke = (color, width) => {
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
      for (const [tip, sign] of [[a, 1], [b, -1]]) {
        context.moveTo(tip.x + sign * tx * 9 - ty * 6, tip.y + sign * ty * 9 + tx * 6);
        context.lineTo(tip.x, tip.y);
        context.lineTo(tip.x + sign * tx * 9 + ty * 6, tip.y + sign * ty * 9 - tx * 6);
      }
      context.strokeStyle = color; context.lineWidth = width; context.lineJoin = 'round'; context.stroke();
    };
    stroke('#162137', 5); stroke('#fff64a', 2.5);
  }
  if (!drag.constrained && drag.axisName) {
    const normal = drag.directions[drag.axisName], radius = drag.unit * 68;
    drawRotationRing(context, rotationRingPoints(drag.world, normal, radius, drag.camera, drag.width, drag.height), '#fff64a', true);
    const [u, v] = rotationBasis(normal), arm = drag.lever ? drag.directions[drag.lever] : u;
    const phase = drag.lever ? Math.atan2(arm.dot(v), arm.dot(u)) : drag.phase, points = rotationRingPoints(drag.world, normal, radius, drag.camera, drag.width, drag.height, phase, phase + drag.degrees * Math.PI / 180);
    context.beginPath(); context.moveTo(drag.pivot.x, drag.pivot.y); points.forEach(point => context.lineTo(point.x, point.y)); context.closePath();
    context.fillStyle = '#fff64a'; context.globalAlpha = .32; context.fill(); context.globalAlpha = 1;
  }
  const text = `${drag.axisName || '–'} ${Math.round(drag.degrees * 10) / 10}°`;
  const x = Math.max(6, Math.min(drag.width - 140, drag.pointer.x + 16)), y = Math.max(22, Math.min(drag.height - 8, drag.pointer.y + 28));
  context.font = 'bold 15px Tahoma, sans-serif'; context.textAlign = 'left'; context.lineWidth = 4; context.strokeStyle = '#162137'; context.strokeText(text, x, y); context.fillStyle = '#fff64a'; context.fillText(text, x, y);
  context.restore();
}

/** Lines swing with the captured turn; the selected turn axis stays fixed. */
export function rotationDisplayHandles(handles, drag) {
  if (!drag?.lever || !drag.axisName) return handles;
  const q = new Quaternion().setFromAxisAngle(drag.directions[drag.axisName], drag.degrees * Math.PI / 180);
  return handles.map(handle => {
    if (handle.axis === drag.axisName || handle.plane || handle.ring) return handle;
    const at = projectGizmo(drag.world.clone().addScaledVector(drag.directions[handle.axis].clone().applyQuaternion(q), drag.unit * 68), drag.camera, drag.width, drag.height);
    return { ...handle, ...at, dx: at.x - drag.pivot.x || 1e-9, dy: at.y - drag.pivot.y, startX: drag.pivot.x, startY: drag.pivot.y };
  });
}
