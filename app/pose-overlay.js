import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { poseAffectedPins, poseNodeRole, samplePoseChain } from '../src/pose-ik.js';
import { samplePreviewMatrices } from './preview-pose.js';

export function projectPoseHandles(model, config, frame, sequence, camera, width, height, globalTime = frame, visibleNodes) {
  if (!config?.enabled) return [];
  const handles = [], target = config.target;
  const project = (world, fields) => {
    const screen = world.clone().project(camera);
    const unit = camera.isPerspectiveCamera ? 2 * world.distanceTo(camera.position) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom / height : (camera.top - camera.bottom) / camera.zoom / height;
    return { ...fields, world, unitsPerPixel: unit, x: (screen.x + 1) * width / 2, y: (1 - screen.y) * height / 2, visible: screen.z >= -1 && screen.z <= 1 };
  };
  for (const chain of config.chains) {
    try {
      const pose = samplePoseChain(model, chain, frame, sequence, globalTime), selected = target?.key === chain.key;
      handles.push(project(pose.end, { kind: 'endpoint', key: chain.key, chain, rotation: pose.rotations[2], selected: selected && target.kind === 'endpoint', joints: selected ? [pose.root, pose.middle, pose.end].map(world => project(world, {})) : [], pinned: config.pins.includes(chain.key), label: chain.kind === 'leg' ? 'Foot' : 'Hand' }));
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
  for (const node of allNodes(model)) {
    if (handles.some(handle => handle.chain?.end === node.ObjectId)) continue;
    const body = node.ObjectId === config.body, selected = body ? target?.kind === 'body' : target?.kind === 'node' && target.id === node.ObjectId;
    const quiet = !body && !selected && !(config.nodes || []).includes(node.ObjectId);
    if (quiet && visibleNodes && !visibleNodes.has(node.ObjectId)) continue;
    const matrix = matrices.get(node.ObjectId), pivot = node.PivotPoint || model.PivotPoints?.[node.ObjectId];
    if (!matrix || !pivot) continue;
    const world = new Vector3().fromArray(pivot).applyMatrix4(matrix), rotation = new Quaternion(); matrix.decompose(new Vector3(), rotation, new Vector3());
    if (!world.toArray().every(Number.isFinite)) continue;
    const paths = [];
    if (selected) for (const chain of poseAffectedPins(model, config, node.ObjectId)) {
      try { const limb = samplePoseChain(model, chain, frame, sequence, globalTime); paths.push([world, limb.root, limb.middle, limb.end].map(point => project(point, {}))); } catch { /* Only this constraint is unavailable. The direct control remains usable. */ }
    }
    handles.push(project(world, { kind: body ? 'body' : 'node', id: node.ObjectId, rotation, selected, paths, quiet, label: body ? 'Body' : poseNodeRole(node) }));
  }
  // Nearby body/chest/pelvis pivots can overlap. Keep their labels separately
  // clickable while retaining the actual joint positions and compact overlay.
  const labels = [];
  for (const handle of handles.filter(handle => handle.visible && !handle.quiet)) {
    handle.labelX = handle.x + 20;
    handle.labelWidth = `${handle.label}${handle.pinned ? ' · PIN' : ''}`.length * 7;
    let offset = 0, attempt = 0;
    while (labels.some(other => Math.abs(other.labelY - (handle.y + offset)) < 16 && handle.labelX < other.labelX + other.labelWidth && other.labelX < handle.labelX + handle.labelWidth)) { attempt++; offset = (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 16; }
    handle.labelY = handle.y + offset; labels.push(handle);
  }
  return handles;
}

export function pickPoseHandle(handles, x, y) {
  const visible = handles.filter(handle => handle.visible);
  const label = visible.find(handle => !handle.quiet && x >= (handle.labelX ?? handle.x + 20) && x <= (handle.labelX ?? handle.x + 20) + (handle.labelWidth ?? handle.label.length * 7) && Math.abs(y - (handle.labelY ?? handle.y)) <= 7);
  if (label) return label;
  const hits = visible.filter(handle => {
    const distance = Math.hypot(x - handle.x, y - handle.y);
    return distance <= (handle.quiet ? 6 : handle.kind === 'bend' ? 10 : 19);
  });
  return hits.sort((a, b) => Number(a.quiet) - Number(b.quiet) || Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y) || Number(b.selected) - Number(a.selected))[0] || null;
}

export function drawPoseOverlay(context, handles, ratio = 1) {
  context.save(); context.scale(ratio, ratio);
  for (const handle of handles) {
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
    if (handle.kind === 'body') { context.moveTo(handle.x, handle.y - 17); context.lineTo(handle.x + 17, handle.y); context.lineTo(handle.x, handle.y + 17); context.lineTo(handle.x - 17, handle.y); context.closePath(); }
    else if (handle.kind === 'bend') context.arc(handle.x, handle.y, 7, 0, Math.PI * 2);
    else if (handle.chain?.kind === 'leg' || handle.kind === 'node') context.rect(handle.x - 13, handle.y - 13, 26, 26);
    else context.arc(handle.x, handle.y, 13, 0, Math.PI * 2);
    context.lineWidth = 5; context.strokeStyle = '#102431'; context.stroke(); context.lineWidth = 2; context.strokeStyle = color; context.stroke();
    context.font = 'bold 11px Tahoma, sans-serif'; context.textAlign = 'left'; context.textBaseline = 'middle'; context.lineWidth = 3; context.strokeStyle = '#102431';
    const label = `${handle.label}${handle.pinned ? ' · PIN' : ''}`;
    const labelX = handle.labelX ?? handle.x + 20, labelY = handle.labelY ?? handle.y;
    if (Math.abs(labelY - handle.y) > 1) { context.beginPath(); context.moveTo(handle.x + 15, handle.y); context.lineTo(labelX - 2, labelY); context.lineWidth = 1; context.strokeStyle = color; context.stroke(); }
    context.lineWidth = 3; context.strokeStyle = '#102431'; context.strokeText(label, labelX, labelY); context.fillStyle = color; context.fillText(label, labelX, labelY);
  }
  context.restore();
}
