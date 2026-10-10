import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { createPoseSample, poseControlPoint, poseAffectedPins, poseNodeRole, poseRole, samplePoseChain } from '../src/pose-ik.js';
import { samplePreviewMatrices } from './preview-pose.js';
import { pickMovementNode } from './movement-overlay.js';

export const poseSymbols = {
  Hand: ['M7 22L4 17L1 13Q0 11 2 10Q3 10 5 12L6 13V4Q6 2 8 2Q10 2 10 4V10V2Q10 0 12 0Q14 0 14 2V10V3Q14 1 16 1Q18 1 18 3V11V6Q18 4 20 4Q22 4 22 6V15Q22 19 18 22Z', 'M9 16H18'],
  Foot: ['M4 2H13V12L17 15H21Q23 15 23 18V21H2V17L4 12Z', 'M4 6H13M2 18H23'],
  Hoof: ['M6 2H18L17 12L22 19V22H2V19L7 12Z', 'M7 13H17M12 14V22'],
  Head: ['M3 20V10Q3 2 12 2Q21 2 21 10V20L15 23H9Z', 'M5 10H19L17 14H7ZM12 14V20'],
  Chest: ['M3 3L8 1L12 5L16 1L21 3L18 9L19 21L12 23L5 21L6 9Z', 'M7 7L12 10L17 7M12 10V19'],
  Body: ['M12 1A3 3 0 1 1 12 7A3 3 0 1 1 12 1ZM7 9H17L22 15L19 17L16 13V17L18 23H14L12 18L10 23H6L8 17V13L5 17L2 15Z', ''],
  Spine: ['M9 1H15V4H18V7H15V10H18V13H15V16H18V19H15V23H9V19H6V16H9V13H6V10H9V7H6V4H9Z', 'M9 7H15M9 13H15M9 19H15'],
  Wing: ['M2 20L3 5L10 9L16 3L22 5L18 11L21 17L14 15L10 21L6 16Z', 'M3 5L10 13L22 5M10 13L10 21'],
  Tail: ['M3 4Q15 2 18 9Q23 18 15 22Q6 24 3 17Q1 12 7 10Q12 9 13 14Q9 12 8 16Q11 20 15 17Q18 12 12 9Q7 6 3 7Z', ''],
  Object: ['M12 2L22 12L12 22L2 12Z', 'M9 9H15V15H9Z'],
};
const symbols = poseSymbols;
const symbolPaths = new Map();
const pelvisSymbols = new Map();
let pelvisFace;

export function loadPoseSymbols(onLoad) {
  pelvisFace ||= new Image();
  if (pelvisFace.complete && pelvisFace.naturalWidth) { onLoad(); return () => {}; }
  pelvisFace.addEventListener('load', onLoad, { once: true });
  if (!pelvisFace.src) pelvisFace.src = new URL('./pose-trollface.png', import.meta.url).href;
  return () => pelvisFace.removeEventListener('load', onLoad);
}

export function poseHandleTarget(handle) {
  return { kind: handle.kind, ...(handle.key ? { key: handle.key } : {}), ...(handle.kind === 'node' ? { id: handle.id } : {}), ...(handle.marker ? { marker: true } : {}) };
}
const identity = handle => `${handle.kind}:${handle.kind === 'body' ? '' : handle.key ?? handle.id ?? ''}:${handle.marker ? 'marker' : 'control'}`;

export function projectPoseHandles(model, config, frame, sequence, camera, width, height, globalTime = frame, visibleNodes) {
  if (!config?.enabled) return [];
  const handles = [], target = config.target, nodes = allNodes(model);
  const project = (world, fields) => {
    const screen = world.clone().project(camera);
    const unit = camera.isPerspectiveCamera ? 2 * world.distanceTo(camera.position) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height : (camera.top - camera.bottom) / camera.zoom / height;
    return { ...fields, world, unitsPerPixel: unit, x: (screen.x + 1) * width / 2, y: (1 - screen.y) * height / 2, visible: screen.z >= -1 && screen.z <= 1 };
  };
  let sample;
  for (const chain of config.chains) {
    try {
      sample ||= createPoseSample(model, frame, sequence, globalTime);
      const pose = samplePoseChain(model, chain, frame, sequence, globalTime, sample), selected = target?.key === chain.key;
      handles.push(project(pose.end, { kind: 'endpoint', key: chain.key, chain, rotation: pose.rotations[2], selected: selected && target.kind === 'endpoint', joints: selected ? pose.points.map(world => project(world, {})) : [], pinned: config.pins.includes(chain.key), label: chain.label || (chain.kind === 'leg' ? 'Foot' : 'Hand') }));
      if (selected) {
        const direction = pose.end.clone().sub(pose.root).normalize(), bend = pose.middle.clone().sub(pose.root);
        bend.addScaledVector(direction, -bend.dot(direction));
        if (bend.lengthSq() < pose.tolerance * pose.tolerance) {
          bend.fromArray(config.bends?.[chain.key] || [0, 0, 1]).applyQuaternion(pose.rotations[0]); bend.addScaledVector(direction, -bend.dot(direction));
          if (bend.lengthSq() < 1e-12) bend.set(0, 1, 0).addScaledVector(direction, -direction.y);
        }
        const pole = pose.middle.clone().addScaledVector(bend.normalize(), Math.max(...pose.lengths) * .45);
        handles.push(project(pole, { kind: 'bend', key: chain.key, chain, rotation: pose.rotations[2], selected: target.kind === 'bend', label: 'Bend', joint: project(pose.middle, {}) }));
      }
    } catch { /* Invalid session mappings have no visible or pickable handle. */ }
  }
  const matrices = samplePreviewMatrices(model, frame, sequence, globalTime, camera);
  for (const node of nodes) {
    if (handles.some(handle => handle.chain?.end === node.ObjectId)) continue;
    const body = node.ObjectId === config.body, selected = body ? target?.kind === 'body' : target?.kind === 'node' && !target.marker && target.id === node.ObjectId;
    const quiet = !body && !selected && !(config.nodes || []).includes(node.ObjectId);
    if (quiet && visibleNodes && !visibleNodes.has(node.ObjectId)) continue;
    const matrix = matrices.get(node.ObjectId), pivot = node.PivotPoint || model.PivotPoints?.[node.ObjectId];
    if (!matrix || !pivot) continue;
    const world = poseControlPoint(model, config, node.ObjectId, matrices, nodes), rotation = new Quaternion(); matrix.decompose(new Vector3(), rotation, new Vector3());
    if (!world.toArray().every(Number.isFinite)) continue;
    const paths = [];
    if (selected) for (const chain of poseAffectedPins(model, config, node.ObjectId)) {
      try { sample ||= createPoseSample(model, frame, sequence, globalTime); const limb = samplePoseChain(model, chain, frame, sequence, globalTime, sample); paths.push([world, limb.root, limb.middle, limb.end].map(point => project(point, {}))); } catch { /* Only this constraint is unavailable. The direct control remains usable. */ }
    }
    handles.push(project(world, { kind: body ? 'body' : 'node', id: node.ObjectId, rotation, selected, paths, quiet, label: body ? 'Body' : poseRole(model, config, node.ObjectId, nodes) }));
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
  for (const handle of handles.filter(handle => handle.visible && !handle.quiet)) {
    handle.labelX = handle.x + 20;
    handle.labelWidth = `${handle.label}${handle.pinned ? ' · PIN' : ''}`.length * 7;
    let offset = 0, attempt = 0;
    while (labels.some(other => Math.abs(other.labelY - (handle.y + offset)) < 16 && handle.labelX < other.labelX + other.labelWidth && other.labelX < handle.labelX + handle.labelWidth) || handles.some(other => other.visible && !other.quiet && Math.abs(other.y - (handle.y + offset)) < 26 && handle.labelX < other.x + 19 && other.x - 19 < handle.labelX + handle.labelWidth)) { attempt++; offset = (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 16; }
    handle.labelY = handle.y + offset; labels.push(handle);
  }
  return handles;
}

export function pickPoseHandle(handles, x, y, target = null, nodes = null, preferSelected = false) {
  const visible = handles.filter(handle => handle.visible && (!nodes || !handle.quiet));
  // The selected symbol is drawn last, over other controls' labels. Its
  // draggable face must therefore win over a label crossing that face.
  const selected = preferSelected && target && visible.find(handle => identity(handle) === identity(target));
  if (selected && Math.hypot(x - selected.x, y - selected.y) <= (selected.kind === 'bend' ? 10 : 19)) return selected;
  const label = visible.find(handle => !handle.quiet && (handle.selected || handle.hovered) && x >= (handle.labelX ?? handle.x + 20) && x <= (handle.labelX ?? handle.x + 20) + (handle.labelWidth ?? handle.label.length * 7) && Math.abs(y - (handle.labelY ?? handle.y)) <= 7);
  const candidates = [...visible, ...(nodes || []).map(point => ({ ...point, kind: 'node', id: point.node.ObjectId, marker: true, quiet: true }))];
  const hits = candidates.filter(handle => handle.visible).filter(handle => {
    const distance = Math.hypot(x - handle.x, y - handle.y);
    return distance <= (handle.quiet ? 13 : handle.kind === 'bend' ? 10 : 19);
  });
  if (!hits.length) return label || null;
  // Share Movement's selection cycle, with each real marker and virtual handle
  // retaining its own identity. Every object covering this click participates.
  const points = hits.map(handle => ({ ...handle, node: { ObjectId: identity(handle) }, handle }));
  return pickMovementNode(points, x, y, target ? [identity(target)] : [], 19, preferSelected, true)?.handle || null;
}

export function drawPoseOverlay(context, handles, ratio = 1, ping = null) {
  context.save(); context.scale(ratio, ratio);
  // Keep the selected symbol above overlapping controllers.
  for (const handle of [...handles.filter(handle => !handle.selected && !handle.hovered), ...handles.filter(handle => !handle.selected && handle.hovered), ...handles.filter(handle => handle.selected)]) {
    if (!handle.visible || handle.quiet) continue;
    const color = handle.pinned ? '#ffbd59' : handle.selected ? '#fff58b' : '#71eee4';
    for (const path of handle.paths || [handle.joints || []]) if (path.length && path.every(joint => joint.visible)) {
      context.beginPath(); path.forEach((joint, i) => { if (i) context.lineTo(joint.x, joint.y); else context.moveTo(joint.x, joint.y); });
      context.strokeStyle = '#71eee4'; context.lineWidth = 3; context.stroke();
    }
    if (handle.joint?.visible) {
      context.beginPath(); context.setLineDash([3, 3]); context.moveTo(handle.joint.x, handle.joint.y); context.lineTo(handle.x, handle.y); context.strokeStyle = color; context.lineWidth = 1; context.stroke(); context.setLineDash([]);
    }
    context.beginPath();
    if (handle.kind === 'body') { context.moveTo(handle.x, handle.y - 18); context.lineTo(handle.x + 18, handle.y); context.lineTo(handle.x, handle.y + 18); context.lineTo(handle.x - 18, handle.y); context.closePath(); }
    else context.arc(handle.x, handle.y, handle.kind === 'bend' ? 7 : 17, 0, Math.PI * 2);
    context.fillStyle = '#102431'; context.fill(); context.lineWidth = 1.5; context.strokeStyle = color; context.stroke();
    if (handle.kind === 'bend') { context.beginPath(); context.moveTo(handle.x - 3, handle.y - 3); context.lineTo(handle.x + 2, handle.y); context.lineTo(handle.x - 3, handle.y + 3); context.lineWidth = 2; context.stroke(); }
    else if (handle.label === 'Pelvis') {
      if (pelvisFace?.complete && pelvisFace.naturalWidth) {
        if (!pelvisSymbols.has(color)) {
          const icon = document.createElement('canvas'); icon.width = pelvisFace.naturalWidth; icon.height = pelvisFace.naturalHeight;
          const tint = icon.getContext('2d'); tint.drawImage(pelvisFace, 0, 0);
          tint.globalCompositeOperation = 'multiply'; tint.fillStyle = color; tint.fillRect(0, 0, icon.width, icon.height);
          tint.globalCompositeOperation = 'destination-in'; tint.drawImage(pelvisFace, 0, 0); tint.globalCompositeOperation = 'source-over';
          pelvisSymbols.set(color, icon);
        }
        context.drawImage(pelvisSymbols.get(color), handle.x - 16, handle.y - 16, 32, 32);
      }
    }
    else {
      const name = symbols[handle.label] ? handle.label : handle.label === 'Neck' ? 'Head' : 'Object';
      if (!symbolPaths.has(name)) symbolPaths.set(name, symbols[name].map(path => new Path2D(path)));
      const [shape, detail] = symbolPaths.get(name);
      context.save(); context.translate(handle.x - 12, handle.y - 12); context.fillStyle = color; context.fill(shape);
      context.strokeStyle = '#102431'; context.lineWidth = 1.8; context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke(detail); context.restore();
    }
    if (!handle.selected && !handle.hovered) continue;
    context.font = 'bold 11px Tahoma, sans-serif'; context.textAlign = 'left'; context.textBaseline = 'middle'; context.lineWidth = 3; context.strokeStyle = '#102431';
    const label = `${handle.label}${handle.pinned ? ' · PIN' : ''}`;
    const labelX = handle.labelX ?? handle.x + 20, labelY = handle.labelY ?? handle.y;
    if (Math.abs(labelY - handle.y) > 1) { context.beginPath(); context.moveTo(handle.x + 15, handle.y); context.lineTo(labelX - 2, labelY); context.lineWidth = 1; context.strokeStyle = color; context.stroke(); }
    context.lineWidth = 3; context.strokeStyle = '#102431'; context.strokeText(label, labelX, labelY); context.fillStyle = color; context.fillText(label, labelX, labelY);
  }
  if (ping) for (const handle of handles.filter(handle => handle.visible && ping.targets.some(target => identity(target) === identity(handle)))) {
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
