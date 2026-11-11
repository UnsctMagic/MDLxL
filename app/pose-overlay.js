import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';
import { createPoseSample, poseChainIds, poseDuplicatesBody, poseNodeControl, poseControlPoint, poseAffectedPins, poseNodeRole, poseRole, samplePoseChain } from '../src/pose-ik.js';
import { pickMovementNode } from './movement-overlay.js';
import { boneHighlightColors } from './rig-markers-gl.js';
import { DEFAULT_CONTROLLER_APPEARANCE, controllerShapePoints } from '../src/controller-appearance.js';
import { POSE_SYMBOL_NAMES, drawPoseSymbol, isPoseMaskSet } from '../src/pose-symbol-sets.js';
import { drawPoseMask } from './pose-masks.js';

export const posePinPath = 'M5 2H11L10 6L13 9V10H3V9L6 6ZM8 10V15';
let pinPath;

export function poseHandleTarget(handle) {
  return { kind: handle.kind, ...(handle.key ? { key: handle.key } : {}), ...(handle.kind === 'node' ? { id: handle.id } : {}), ...(handle.marker ? { marker: true } : {}) };
}
/** Hidden-handle identity: an endpoint's chain key, 'body', or 'node:<id>' for a mapped part. Bend handles and unmapped bone markers have none. */
export const poseHandleKey = handle => handle.quiet || handle.marker || handle.kind === 'bend' ? null : handle.kind === 'endpoint' ? handle.key : handle.kind === 'body' ? 'body' : handle.kind === 'node' ? `node:${handle.id}` : null;
/** The same identity for a selection target (an elbow/knee target belongs to its limb). */
export const poseTargetKey = target => !target || target.marker ? null : target.kind === 'endpoint' || target.kind === 'bend' ? target.key : target.kind === 'body' ? 'body' : target.kind === 'node' ? `node:${target.id}` : null;
export const poseSymbolName = label => POSE_SYMBOL_NAMES.includes(label) ? label : 'Object';
const identity = handle => `${handle.kind}:${handle.kind === 'body' ? '' : handle.key ?? handle.id ?? ''}:${handle.marker ? 'marker' : 'control'}`;

export function projectPoseHandles(model, config, frame, sequence, camera, width, height, globalTime = frame, visibleNodes, appearance = DEFAULT_CONTROLLER_APPEARANCE, mode = 'select') {
  if (!config?.enabled) return [];
  const handles = [], target = config.target, nodes = allNodes(model), hiddenKeys = new Set(config.hidden || []);
  const project = (world, fields) => {
    const screen = world.clone().project(camera);
    const unit = camera.isPerspectiveCamera ? 2 * world.distanceTo(camera.position) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height : (camera.top - camera.bottom) / camera.zoom / height;
    return { ...fields, size: fields.kind === 'bend' ? appearance.size * .6 : appearance.size, shape: appearance[fields.kind === 'bend' ? 'bendShape' : fields.kind === 'body' ? 'bodyShape' : 'shape'], world, unitsPerPixel: unit, x: (screen.x + 1) * width / 2, y: (1 - screen.y) * height / 2, visible: screen.z >= -1 && screen.z <= 1 };
  };
  let sample;
  for (const chain of config.chains) {
    try {
      sample ||= createPoseSample(model, frame, sequence, globalTime);
      const pose = samplePoseChain(model, chain, frame, sequence, globalTime, sample), selected = target?.key === chain.key, hidden = hiddenKeys.has(chain.key);
      handles.push(project(pose.end, { kind: 'endpoint', key: chain.key, chain, rotation: pose.rotations[2], hidden, selected: selected && !hidden && target.kind === 'endpoint', joints: pose.points.map(world => project(world, {})), pinned: config.pins.includes(chain.key), label: chain.label || (chain.kind === 'leg' ? 'Foot' : 'Hand') }));
      if (selected && !hidden) {
        const direction = pose.end.clone().sub(pose.root).normalize(), bend = pose.middle.clone().sub(pose.root);
        bend.addScaledVector(direction, -bend.dot(direction));
        if (bend.lengthSq() < pose.tolerance * pose.tolerance) {
          bend.fromArray(config.bends?.[chain.key] || [0, 0, 1]).applyQuaternion(pose.rotations[0]); bend.addScaledVector(direction, -bend.dot(direction));
          if (bend.lengthSq() < 1e-12) bend.set(0, 1, 0).addScaledVector(direction, -direction.y);
        }
        const pole = pose.middle.clone().addScaledVector(bend.normalize(), Math.max(...pose.lengths) * .45);
        handles.push(project(pole, { kind: 'bend', key: chain.key, chain, rotation: pose.rotations[1], selected: target.kind === 'bend', label: chain.label ? 'Bend' : chain.kind === 'leg' ? 'Knee' : 'Elbow', joint: project(pose.middle, {}) }));
      }
    } catch { /* Invalid session mappings have no visible or pickable handle. */ }
  }
  const matrices = sampleNodeMatrices(model, frame, sequence, globalTime);
  for (const node of nodes) {
    if (handles.some(handle => handle.chain?.end === node.ObjectId)) continue;
    const body = node.ObjectId === config.body, hidden = hiddenKeys.has(body ? 'body' : `node:${node.ObjectId}`) && (body || (config.nodes || []).includes(node.ObjectId));
    const selected = !hidden && (body ? target?.kind === 'body' : target?.kind === 'node' && !target.marker && target.id === node.ObjectId);
    const quiet = !body && !selected && !(config.nodes || []).includes(node.ObjectId);
    // A Pelvis that would only repeat Body (same Move and Rotate) is left out; Scale differs, so it stays there.
    if (!body && !selected && mode !== 'scale' && poseDuplicatesBody(model, config, node.ObjectId)) continue;
    if (quiet && visibleNodes && !visibleNodes.has(node.ObjectId)) continue;
    const matrix = matrices.get(node.ObjectId), pivot = node.PivotPoint || model.PivotPoints?.[node.ObjectId];
    if (!matrix || !pivot) continue;
    const world = poseControlPoint(model, config, node.ObjectId, matrices, nodes), rotation = new Quaternion(); matrix.decompose(new Vector3(), rotation, new Vector3());
    if (!world.toArray().every(Number.isFinite)) continue;
    const paths = [];
    if (selected) for (const chain of poseAffectedPins(model, config, node.ObjectId)) {
      try { sample ||= createPoseSample(model, frame, sequence, globalTime); const limb = samplePoseChain(model, chain, frame, sequence, globalTime, sample); paths.push([world, limb.root, limb.middle, limb.end].map(point => project(point, {}))); } catch { /* Only this constraint is unavailable. The direct control remains usable. */ }
    }
    handles.push(project(world, { kind: body ? 'body' : 'node', id: node.ObjectId, rotation, selected, hidden, paths, quiet, label: body ? 'Body' : poseRole(model, config, node.ObjectId, nodes) }));
  }
  if (target?.kind === 'node' && target.marker) {
    const node = nodes.find(node => node.ObjectId === target.id), matrix = matrices.get(target.id), pivot = node?.PivotPoint || model.PivotPoints?.[target.id];
    if (matrix && pivot) {
      const world = new Vector3().fromArray(pivot).applyMatrix4(matrix), rotation = new Quaternion(); matrix.decompose(new Vector3(), rotation, new Vector3());
      handles.push(project(world, { kind: 'node', id: target.id, marker: true, quiet: true, selected: true, rotation, label: node.Name || 'Object' }));
    }
  }
  // Nearby body/chest/pelvis pivots can overlap. Keep their labels separately
  // clickable while retaining the actual joint positions and compact overlay.
  const labels = [];
  for (const handle of handles.filter(handle => handle.visible && !handle.quiet && !handle.hidden)) {
    handle.labelX = handle.x + handle.size + 4;
    handle.labelWidth = handle.label.length * 7;
    let offset = 0, attempt = 0;
    while (labels.some(other => Math.abs(other.labelY - (handle.y + offset)) < 16 && handle.labelX < other.labelX + other.labelWidth && other.labelX < handle.labelX + handle.labelWidth) || handles.some(other => other.visible && !other.quiet && !other.hidden && Math.abs(other.y - (handle.y + offset)) < (other.size || 17) + 9 && handle.labelX < other.x + (other.size || 17) + 2 && other.x - (other.size || 17) - 2 < handle.labelX + handle.labelWidth)) { attempt++; offset = (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 16; }
    handle.labelY = handle.y + offset; labels.push(handle);
  }
  return handles;
}

export function pickPoseHandle(handles, x, y, target = null, nodes = null, preferSelected = false) {
  const visible = handles.filter(handle => handle.visible && !handle.hidden && (!nodes || !handle.quiet));
  // The selected symbol is drawn last, over other controls' labels. Its
  // draggable face must therefore win over a label crossing that face.
  const selected = preferSelected && target && visible.find(handle => identity(handle) === identity(target));
  const hit = handle => {
    const radius = (handle.size ?? (handle.kind === 'bend' ? 10 : 17)) + (handle.pinned ? 7 : 3);
    const dx = Math.abs(x - handle.x), dy = Math.abs(y - handle.y);
    return handle.shape === 'square' || handle.shape === 'triangle' ? Math.max(dx, dy) <= radius : Math.hypot(dx, dy) <= radius;
  };
  if (selected && hit(selected)) return selected;
  const label = visible.find(handle => !handle.quiet && (handle.selected || handle.hovered || handle.kind === 'bend') && x >= (handle.labelX ?? handle.x + 20) && x <= (handle.labelX ?? handle.x + 20) + (handle.labelWidth ?? handle.label.length * 7) && Math.abs(y - (handle.labelY ?? handle.y)) <= 7);
  const candidates = [...visible, ...(nodes || []).map(point => ({ ...point, kind: 'node', id: point.node.ObjectId, marker: true, quiet: true }))];
  const hits = candidates.filter(handle => handle.visible).filter(handle => {
    const distance = Math.hypot(x - handle.x, y - handle.y);
    return handle.quiet ? distance <= 13 : hit(handle);
  });
  if (!hits.length) return label || null;
  // Share Movement's selection cycle, with each real marker and virtual handle
  // retaining its own identity. Every object covering this click participates.
  const points = hits.map(handle => ({ ...handle, node: { ObjectId: identity(handle) }, handle }));
  return pickMovementNode(points, x, y, target ? [identity(target)] : [], Infinity, preferSelected, true)?.handle || null;
}

export function drawPoseOverlay(context, handles, ratio = 1, ping = null, appearance = DEFAULT_CONTROLLER_APPEARANCE, skeleton = null) {
  context.save(); context.scale(ratio, ratio);
  if (skeleton) for (const segment of skeleton) {
    context.beginPath(); context.moveTo(segment.from.x, segment.from.y); context.lineTo(segment.to.x, segment.to.y);
    context.strokeStyle = appearance.background; context.lineWidth = 4; context.stroke();
    context.strokeStyle = segment.selected ? appearance.selected : appearance.skeleton; context.lineWidth = segment.selected ? 2.5 : 1.5; context.stroke();
    for (const joint of [segment.from, segment.to]) { context.beginPath(); context.arc(joint.x, joint.y, 3, 0, Math.PI * 2); context.fillStyle = appearance.background; context.fill(); context.lineWidth = 1.5; context.stroke(); }
  }
  // Keep the selected symbol above overlapping controllers.
  for (const handle of [...handles.filter(handle => !handle.selected && !handle.hovered), ...handles.filter(handle => !handle.selected && handle.hovered), ...handles.filter(handle => handle.selected)]) {
    if (!handle.visible || handle.quiet || handle.hidden) continue;
    const color = handle.pinned ? appearance.pinned : handle.selected ? appearance.selected : appearance.color;
    for (const path of skeleton ? [] : handle.paths || [handle.selected ? handle.joints || [] : []]) if (path.length && path.every(joint => joint.visible)) {
      context.beginPath(); path.forEach((joint, i) => { if (i) context.lineTo(joint.x, joint.y); else context.moveTo(joint.x, joint.y); });
      context.strokeStyle = appearance.skeleton; context.lineWidth = 2; context.stroke();
    }
    if (handle.joint?.visible) {
      context.beginPath(); context.setLineDash([3, 3]); context.moveTo(handle.joint.x, handle.joint.y); context.lineTo(handle.x, handle.y); context.strokeStyle = color; context.lineWidth = 1; context.stroke(); context.setLineDash([]);
    }
    context.beginPath();
    const size = handle.size ?? (handle.kind === 'bend' ? 10 : appearance.size), polygon = controllerShapePoints(handle.shape || appearance.shape, size);
    if (polygon) { polygon.forEach(([x, y], index) => context[index ? 'lineTo' : 'moveTo'](handle.x + x, handle.y + y)); context.closePath(); }
    else context.arc(handle.x, handle.y, size, 0, Math.PI * 2);
    if (appearance.filled !== false) { context.fillStyle = appearance.background; context.fill(); } context.lineWidth = handle.selected ? 4 : 3; context.strokeStyle = appearance.outline; context.stroke(); context.lineWidth = handle.selected ? 2.5 : 1.5; context.strokeStyle = color; context.stroke();
    context.save(); const iconScale = Math.min(1, size / 17) * (handle.shape === 'triangle' ? .65 : handle.shape === 'diamond' ? .8 : 1); context.translate(handle.x, handle.y + (handle.shape === 'triangle' ? size * .2 : 0)); context.scale(iconScale, iconScale); context.translate(-handle.x, -handle.y);
    if (handle.kind === 'bend') { context.beginPath(); context.moveTo(handle.x - 3, handle.y - 3); context.lineTo(handle.x + 2, handle.y); context.lineTo(handle.x - 3, handle.y + 3); context.lineWidth = 2; context.stroke(); }
    else if (!appearance.symbols) { /* Outline-only rig controls. */ }
    else if (isPoseMaskSet(appearance.symbolSet)) drawPoseMask(context, poseSymbolName(handle.label), handle.x, handle.y, appearance.symbolColor ?? color);
    else drawPoseSymbol(context, appearance.symbolSet, poseSymbolName(handle.label), handle.x, handle.y, appearance.symbolColor ?? color, appearance.background, appearance.filled === false);
    context.restore();
    if (handle.pinned) {
      // A pin remains legible after selection moves to the body or another limb.
      pinPath ||= new Path2D(posePinPath);
      context.save(); context.translate(handle.x + 11, handle.y - 11);
      context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.fillStyle = appearance.pinned; context.fill();
      context.translate(-6, -6); context.scale(.75, .75); context.lineWidth = 1.8; context.lineJoin = 'round'; context.lineCap = 'round'; context.strokeStyle = appearance.background; context.stroke(pinPath); context.restore();
    }
    if (!handle.selected && !handle.hovered && handle.kind !== 'bend') continue;
    context.font = 'bold 11px Tahoma, sans-serif'; context.textAlign = 'left'; context.textBaseline = 'middle'; context.lineWidth = 3; context.strokeStyle = '#102431';
    const label = handle.label;
    const labelX = handle.labelX ?? handle.x + 20, labelY = handle.labelY ?? handle.y;
    if (Math.abs(labelY - handle.y) > 1) { context.beginPath(); context.moveTo(handle.x + 15, handle.y); context.lineTo(labelX - 2, labelY); context.lineWidth = 1; context.strokeStyle = color; context.stroke(); }
    context.lineWidth = 3; context.strokeStyle = appearance.background; context.strokeText(label, labelX, labelY); context.fillStyle = color; context.fillText(label, labelX, labelY);
  }
  if (ping) for (const handle of handles.filter(handle => handle.visible && !handle.hidden && ping.targets.some(target => identity(target) === identity(handle)))) {
    const radius = 27 + 5 * Math.sin(ping.age / 75), x = handle.x, y = handle.y;
    context.globalAlpha = Math.min(1, (1200 - ping.age) / 200);
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      context.moveTo(x + dx * (radius - 7), y + dy * (radius - 7));
      context.lineTo(x + dx * (radius + 11), y + dy * (radius + 11));
    }
    context.strokeStyle = '#180000'; context.lineWidth = 6; context.stroke();
    context.strokeStyle = '#ff3030'; context.lineWidth = 3; context.stroke();
  }
  context.restore();
}

/** Draw only mapped pose controls and their limb joints. Mesh helpers, weapon
 * bones and attachment branches are not part of this display skeleton. */
export function projectPoseSkeleton(points, handles, config) {
  const byId = new Map(points.map(point => [point.node.ObjectId, point]));
  const controls = new Map(handles.filter(handle => !handle.quiet && !handle.marker && ['body', 'node'].includes(handle.kind)).map(handle => [handle.id, handle]));
  const segments = [], seen = new Set();
  const ancestor = id => {
    const visited = new Set([id]); let parent = config.carriers?.[id] ?? byId.get(id)?.node.Parent;
    while (parent != null && !visited.has(parent)) {
      if (controls.has(parent)) return controls.get(parent);
      visited.add(parent); parent = config.carriers?.[parent] ?? byId.get(parent)?.node.Parent;
    }
    return null;
  };
  const add = (from, to, selected) => {
    if (!from?.visible || !to?.visible || Math.hypot(from.x - to.x, from.y - to.y) < .5) return;
    const key = [from.x, from.y, to.x, to.y].map(value => value.toFixed(2)).join(':');
    if (!seen.has(key)) { seen.add(key); segments.push({ from, to, selected }); }
  };
  for (const control of controls.values()) { const parent = ancestor(control.id); add(parent, control, control.selected || parent?.selected); }
  for (const handle of handles.filter(item => item.kind === 'endpoint')) {
    const parent = ancestor(handle.chain.root), selected = config.target?.key === handle.key || parent?.selected;
    add(parent, handle.joints[0], selected);
    for (let index = 1; index < handle.joints.length; index++) add(handle.joints[index - 1], handle.joints[index], selected);
  }
  return segments;
}

// Keep limb focus on its actual joints, without lighting unrelated branches.
export function poseSkeletonHighlights(points, model, config) {
  const target = config.target;
  if (!target) return new Map();
  const chain = config.chains.find(chain => chain.key === target.key);
  const id = target.kind === 'body' ? config.body : target.id;
  const joints = chain ? poseChainIds(chain) : poseNodeControl(model, config, target).joints;
  if (!joints.length) return boneHighlightColors(points, [id]);
  const colors = new Map(joints.map((id, i) => [id, i ? '#ffff00' : '#ff0000']));
  const parent = points.find(point => point.node.ObjectId === joints[0])?.node.Parent;
  if (parent != null && !colors.has(parent)) colors.set(parent, '#000000');
  return colors;
}
