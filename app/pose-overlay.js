import { Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { samplePoseChain, validatePoseBody } from '../src/pose-ik.js';

export function projectPoseHandles(model, config, frame, sequence, camera, width, height, globalTime = frame) {
  if (!config?.enabled || sequence < 0) return [];
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
  if (config.body != null) {
    try {
      const legs = config.chains.filter(chain => chain.kind === 'leg'), node = validatePoseBody(model, config.body, legs);
      const any = config.chains.find(chain => chain.kind === 'leg'), pose = samplePoseChain(model, any, frame, sequence, globalTime);
      const matrix = pose.matrices.get(node.ObjectId), world = new Vector3().fromArray(node.PivotPoint || model.PivotPoints[node.ObjectId]).applyMatrix4(matrix), rotation = new Quaternion();
      matrix.decompose(new Vector3(), rotation, new Vector3());
      const selected = target?.kind === 'body', paths = selected ? legs.map(chain => { const limb = samplePoseChain(model, chain, frame, sequence, globalTime); return [world, limb.root, limb.middle, limb.end].map(point => project(point, {})); }) : [];
      handles.push(project(world, { kind: 'body', rotation, selected, paths, label: 'Body' }));
    } catch { /* Hierarchy edits suspend body controls until mappings are valid. */ }
  }
  return handles;
}

export function pickPoseHandle(handles, x, y) {
  return handles.filter(handle => handle.visible).slice().sort((a, b) => Number(b.selected) - Number(a.selected)).find(handle => {
    const distance = Math.hypot(x - handle.x, y - handle.y);
    return handle.kind === 'bend' ? distance <= 10 : distance >= 7 && distance <= 19;
  }) || null;
}

export function drawPoseOverlay(context, handles, ratio = 1) {
  context.save(); context.scale(ratio, ratio);
  for (const handle of handles) {
    if (!handle.visible) continue;
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
    else if (handle.chain.kind === 'leg') context.rect(handle.x - 13, handle.y - 13, 26, 26);
    else context.arc(handle.x, handle.y, 13, 0, Math.PI * 2);
    context.lineWidth = 5; context.strokeStyle = '#102431'; context.stroke(); context.lineWidth = 2; context.strokeStyle = color; context.stroke();
    context.font = 'bold 11px Tahoma, sans-serif'; context.textAlign = 'left'; context.textBaseline = 'middle'; context.lineWidth = 3; context.strokeStyle = '#102431';
    const label = `${handle.label}${handle.pinned ? ' · PIN' : ''}`;
    context.strokeText(label, handle.x + 20, handle.y); context.fillStyle = color; context.fillText(label, handle.x + 20, handle.y);
  }
  context.restore();
}
