import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from './animation.js';
import { applyMovementTransform, movementParentMatrix, movementProperties, prepareMovementPose, sampleMovement } from './movement.js';

// POSE controls are editor-session identities. Only the resulting native keys
// pass through Movement's transactional writer; no controller enters the rig.
const v3 = value => value?.isVector3 ? value.clone() : new Vector3().fromArray(value);
const finite = value => value && Array.from(value).every(Number.isFinite);
const transformNodes = model => [...(model.Bones || []), ...(model.Helpers || [])];
const options = (model, frame, sequence, globalTime) => ({ interval: model.Sequences?.[sequence]?.Interval, globalSequences: model.GlobalSequences, globalTime });

function hierarchy(model, ids) {
  const nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  if (new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) throw new Error('Choose distinct nodes from this model.');
  for (const id of ids) {
    const seen = new Set(); let node = byId.get(id);
    while (node) {
      if (seen.has(node.ObjectId)) throw new Error('POSE cannot use a cyclic hierarchy.');
      seen.add(node.ObjectId);
      if (node.Flags & 120) throw new Error('POSE cannot use billboarding joints or ancestors.');
      if (node.Flags & 7) throw new Error('POSE cannot use non-default inherited transforms: this preview renderer does not reproduce those flags.');
      if (!finite(node.PivotPoint || model.PivotPoints?.[node.ObjectId])) throw new Error('A POSE joint has a missing or invalid pivot.');
      if (node.Parent == null || node.Parent < 0) break;
      node = byId.get(node.Parent);
      if (!node) throw new Error('A POSE joint has a missing parent.');
    }
  }
  return byId;
}

export function validatePoseChain(model, chain) {
  const ids = [chain?.root, chain?.middle, chain?.end], byId = hierarchy(model, ids);
  const joints = new Set(transformNodes(model).map(node => node.ObjectId));
  if (!joints.has(chain.root) || !joints.has(chain.middle)) throw new Error('The upper joint and elbow / knee must be Bone or Helper nodes.');
  if (byId.get(chain.middle).Parent !== chain.root || byId.get(chain.end).Parent !== chain.middle) throw new Error('POSE requires two adjacent parent links. Include intervening helpers; joints are never skipped.');
  return ids.map(id => byId.get(id));
}

export function suggestPoseChain(model, endpoint) {
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), end = byId.get(endpoint), middle = byId.get(end?.Parent), root = byId.get(middle?.Parent);
  const chain = { root: root?.ObjectId, middle: middle?.ObjectId, end: end?.ObjectId };
  validatePoseChain(model, chain); return chain;
}

export function poseNodeRole(node) {
  const name = String(node?.Name || '').toLowerCase();
  if (/(?:hand|wrist)(?=$|[\s_0-9.\-])/.test(name)) return 'Hand';
  if (/(?:foot|ankle)(?=$|[\s_0-9.\-])/.test(name)) return 'Foot';
  if (/pelvis|hips?/.test(name)) return 'Pelvis';
  if (/chest|thorax/.test(name)) return 'Chest';
  if (/neck/.test(name)) return 'Neck';
  if (/head/.test(name)) return 'Head';
  if (/spine/.test(name)) return 'Spine';
  if (/(?:root|body)(?=$|[\s_0-9.\-])/.test(name)) return 'Body';
  return node?.Name || 'Object';
}

/** Names identify candidates; the actual hierarchy and sampled pose prove them.
 * A native hand reference can supply the missing wrist pivot on Warcraft rigs. */
export function suggestPoseRig(model, frame, sequence) {
  const nodes = allNodes(model), joints = new Set(transformNodes(model).map(node => node.ObjectId)), chains = [], unavailable = [];
  const candidates = nodes.filter(node => ['Hand', 'Foot'].includes(poseNodeRole(node)))
    .sort((a, b) => Number(joints.has(b.ObjectId)) - Number(joints.has(a.ObjectId)));
  for (const node of candidates) {
    try {
      const chain = { ...suggestPoseChain(model, node.ObjectId), kind: poseNodeRole(node) === 'Foot' ? 'leg' : 'arm', key: `limb:${node.ObjectId}` };
      if (chains.some(existing => [chain.root, chain.middle, chain.end].some(id => [existing.root, existing.middle, existing.end].includes(id)))) continue;
      if (model.Sequences?.[sequence]) samplePoseChain(model, chain, frame, sequence);
      chains.push(chain);
    } catch (cause) { unavailable.push({ id: node.ObjectId, reason: cause.message }); }
  }
  let body = null;
  if (chains.length) { try { body = suggestPoseBody(model, chains); } catch (cause) { unavailable.push({ reason: cause.message }); } }
  if (body == null) body = transformNodes(model).find(node => ['Pelvis', 'Body'].includes(poseNodeRole(node)))?.ObjectId ?? null;
  const controls = transformNodes(model).filter(node => ['Head', 'Neck', 'Chest', 'Spine', 'Pelvis', 'Body'].includes(poseNodeRole(node))).map(node => node.ObjectId).filter(id => id !== body);
  return { chains, body, nodes: controls, unavailable };
}

function rigidRotation(matrix) {
  if (!matrix || !finite(matrix.elements) || matrix.determinant() <= 1e-18) throw new Error('POSE requires a finite, nonsingular, positive transform.');
  const e = matrix.elements, axes = [0, 4, 8].map(offset => new Vector3(e[offset], e[offset + 1], e[offset + 2])), lengths = axes.map(axis => axis.length());
  const largest = Math.max(...lengths);
  // Authored SD quaternions are often rounded decimal values. The evaluator
  // preserves them; allow their small matrix roundoff, never authored scale.
  if (Math.min(...lengths) <= 1e-10 || lengths.some(length => Math.abs(length - largest) > largest * 2e-4) || axes.some((axis, i) => axes.some((other, j) => i !== j && Math.abs(axis.dot(other)) > largest * largest * 2e-4))) throw new Error('POSE supports positive uniform scale; nonuniform scale, reflection and shear are unsupported.');
  const rotation = new Quaternion(); matrix.decompose(new Vector3(), rotation, new Vector3()); return rotation.normalize();
}

function sampled(model, frame, sequence, globalTime) {
  if (!model.Sequences?.[sequence]?.Interval || !Number.isFinite(frame) || !Number.isFinite(globalTime)) throw new Error('Choose a local animation pose before using POSE.');
  return sampleNodeMatrices(model, frame, sequence, globalTime);
}
function point(model, node, matrices) { return v3(node.PivotPoint || model.PivotPoints[node.ObjectId]).applyMatrix4(matrices.get(node.ObjectId)); }

export function samplePoseChain(model, chain, frame, sequence, globalTime = frame) {
  const nodes = validatePoseChain(model, chain), matrices = sampled(model, frame, sequence, globalTime), byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  // Validate ancestry even when a descendant's effective matrix happens to
  // cancel an unsupported scale. No stripped flags or hidden rig repairs.
  for (const node of nodes) {
    let ancestor = node;
    while (ancestor) {
      for (const [property, fallback, quaternion] of [['Translation', [0, 0, 0], false], ['Rotation', [0, 0, 0, 1], true], ['Scaling', [1, 1, 1], false]]) {
        const track = ancestor[property];
        if (track?.Keys?.some(key => !finite(key.Vector) || key.Vector.length !== fallback.length || quaternion && Math.hypot(...key.Vector) < 1e-12)) throw new Error('A POSE ancestor has an invalid transform key.');
        const value = sampleTrack(track, frame, { ...options(model, frame, sequence, globalTime), fallback, quaternion });
        if (!finite(value) || value.length !== fallback.length || quaternion && Math.hypot(...value) < 1e-12) throw new Error('A sampled POSE transform is invalid.');
        if (property === 'Scaling' && (value.some(component => component <= 1e-10) || value.some(component => Math.abs(component - value[0]) > Math.abs(value[0]) * 1e-5))) throw new Error('POSE supports positive uniform scale only.');
      }
      rigidRotation(matrices.get(ancestor.ObjectId)); ancestor = byId.get(ancestor.Parent);
    }
  }
  const [root, middle, end] = nodes.map(node => point(model, node, matrices)), lengths = [root.distanceTo(middle), middle.distanceTo(end)];
  const tolerance = Math.max(1e-7, (lengths[0] + lengths[1]) * 2e-5);
  if (!finite([...root, ...middle, ...end]) || Math.min(...lengths) <= tolerance) throw new Error('POSE needs two nonzero limb segments.');
  return { root, middle, end, lengths, tolerance, rotations: nodes.map(node => rigidRotation(matrices.get(node.ObjectId))), matrices };
}

function perpendicular(direction, candidate, fallback) {
  const project = vector => vector.clone().addScaledVector(direction, -vector.dot(direction));
  let result = candidate && project(candidate);
  if (!result || result.lengthSq() < 1e-12) result = fallback && project(fallback);
  if (!result || result.lengthSq() < 1e-12) {
    const axis = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].sort((a, b) => Math.abs(a.dot(direction)) - Math.abs(b.dot(direction)))[0];
    result = project(axis);
  }
  return result.normalize();
}

/** Analytical geometry only. The adapter below verifies the result through
 * Warcraft's pivot/hierarchy evaluator after each changed joint. */
export function solveTwoBone(pose, target, pole, bendMemory) {
  target = v3(target);
  if (!finite(target.toArray()) || pole && !finite(v3(pole).toArray())) throw new Error('POSE target must be finite.');
  const { root, middle, end, lengths: [a, b], tolerance } = pose;
  const offset = target.clone().sub(root), distance = offset.length();
  let direction = distance > tolerance ? offset.divideScalar(distance) : end.clone().sub(root).normalize();
  if (direction.lengthSq() < .5) direction = middle.clone().sub(root).normalize();
  // The current elbow/knee is the authority. Memory only resolves a genuinely
  // straight/folded chain; ordinary FK edits cannot pull toward an old bend.
  const sampledDirection = end.clone().sub(root).normalize();
  if (sampledDirection.lengthSq() < .5) sampledDirection.copy(middle).sub(root).normalize();
  const sampledBend = middle.clone().sub(root), projectedBend = sampledBend.clone().addScaledVector(sampledDirection, -sampledBend.dot(sampledDirection));
  const transport = new Quaternion().setFromUnitVectors(sampledDirection, direction);
  const fallback = bendMemory ? v3(bendMemory) : new Vector3(0, 0, 1).applyQuaternion(pose.rotations?.[0] || new Quaternion());
  const bend = perpendicular(direction, pole ? v3(pole).sub(root) : projectedBend.lengthSq() > tolerance * tolerance ? projectedBend.applyQuaternion(transport) : null, fallback.applyQuaternion(transport));
  const inner = Math.abs(a - b), outer = a + b;
  const reach = Math.max(Math.max(inner, tolerance * .1), Math.min(outer, distance));
  const along = (a * a - b * b + reach * reach) / (2 * reach), height = Math.sqrt(Math.max(0, a * a - along * along));
  return { middle: root.clone().addScaledVector(direction, along).addScaledVector(bend, height), end: root.clone().addScaledVector(direction, reach), bend, clamped: distance < inner - tolerance || distance > outer + tolerance };
}

function setWorldRotation(model, node, desired, matrices, frame, sequence, globalTime) {
  const parentRotation = rigidRotation(movementParentMatrix(node, matrices));
  const local = parentRotation.invert().multiply(desired).normalize();
  const reference = new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { ...options(model, frame, sequence, globalTime), fallback: [0, 0, 0, 1], quaternion: true })).normalize();
  if (local.dot(reference) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
  const change = { id: node.ObjectId, property: 'Rotation', value: local.toArray() };
  const prepared = prepareMovementPose(model, [change], frame, sequence);
  for (const item of prepared) node[item.property] = item.track;
  return change;
}

function solveChainOnClone(model, chain, frame, sequence, target, { pole, orientation, bendMemory, strict = false, globalTime = frame } = {}) {
  if (orientation && (!finite(orientation) || orientation.length !== 4 || Math.hypot(...orientation) < 1e-12)) throw new Error('POSE endpoint orientation must be a finite quaternion.');
  const pose = samplePoseChain(model, chain, frame, sequence, globalTime), geometry = solveTwoBone(pose, target, pole, bendMemory);
  if (!pole && v3(target).distanceToSquared(pose.end) < 1e-20 && (!orientation || 1 - Math.abs(new Quaternion().fromArray(orientation).normalize().dot(pose.rotations[2])) < 1e-12)) return { changes: [], bend: geometry.bend.toArray(), clamped: false, pose };
  if (strict && geometry.clamped) throw new Error('Pinned foot is out of reach. Move the body closer; this preview is rejected.');
  const nodes = validatePoseChain(model, chain), changes = [];
  const swing = (from, to) => new Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
  const rootRotation = swing(pose.middle.clone().sub(pose.root), geometry.middle.clone().sub(pose.root)).multiply(pose.rotations[0]);
  changes.push(setWorldRotation(model, nodes[0], rootRotation, pose.matrices, frame, sequence, globalTime));
  let matrices = sampled(model, frame, sequence, globalTime), currentMiddle = point(model, nodes[1], matrices), currentEnd = point(model, nodes[2], matrices);
  if (currentMiddle.distanceTo(geometry.middle) > pose.tolerance * 4) throw new Error('This hierarchy does not preserve rigid limb motion. No pose was applied.');
  const middleRotation = swing(currentEnd.sub(currentMiddle), geometry.end.clone().sub(currentMiddle)).multiply(rigidRotation(matrices.get(chain.middle)));
  changes.push(setWorldRotation(model, nodes[1], middleRotation, matrices, frame, sequence, globalTime));
  matrices = sampled(model, frame, sequence, globalTime);
  const endpointRotation = orientation ? new Quaternion().fromArray(orientation).normalize() : pose.rotations[2];
  changes.push(setWorldRotation(model, nodes[2], endpointRotation, matrices, frame, sequence, globalTime));
  const result = samplePoseChain(model, chain, frame, sequence, globalTime);
  if (result.root.distanceTo(pose.root) > pose.tolerance || result.end.distanceTo(geometry.end) > pose.tolerance * 4 || result.lengths.some((length, i) => Math.abs(length - pose.lengths[i]) > pose.tolerance * 4) || 1 - Math.abs(result.rotations[2].dot(endpointRotation)) > 1e-7) throw new Error('POSE verification failed. The limb remains unchanged.');
  return { changes, bend: geometry.bend.toArray(), clamped: geometry.clamped, pose: result };
}

// A shallow model with detached node/track records is sufficient: solvers never
// mutate geometry, pivots, resources, intervals or the model's editor metadata.
export function posePreviewModel(model) {
  const copy = { ...model }, copies = new Map();
  for (const key of ['Nodes', 'Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'Lights', 'RibbonEmitters']) if (model[key]) copy[key] = model[key].map(node => {
    if (!node) return node;
    if (!copies.has(node)) copies.set(node, { ...node });
    return copies.get(node);
  });
  return copy;
}

export function solvePoseLimb(model, chain, frame, sequence, target, settings = {}) {
  return solveChainOnClone(posePreviewModel(model), chain, frame, sequence, target, settings);
}

export function turnPoseEndpoint(model, chain, frame, sequence, rotation, globalTime = frame) {
  const copy = posePreviewModel(model), pose = samplePoseChain(copy, chain, frame, sequence, globalTime), nodes = validatePoseChain(copy, chain);
  const delta = new Quaternion().fromArray(rotation);
  if (!finite(delta.toArray()) || delta.lengthSq() < 1e-12) throw new Error('Turn needs a finite rotation.');
  return { changes: [setWorldRotation(copy, nodes[2], delta.normalize().multiply(pose.rotations[2]), pose.matrices, frame, sequence, globalTime)] };
}

export function validatePoseBody(model, bodyId, legs) {
  const byId = hierarchy(model, [bodyId]);
  const used = new Set();
  for (const chain of legs) {
    const nodes = validatePoseChain(model, chain);
    for (const node of nodes) { if (used.has(node.ObjectId)) throw new Error('Pinned legs must have separate joint chains.'); used.add(node.ObjectId); }
    let child = nodes[0], parent = byId.get(child.Parent);
    while (parent) {
      if (child.Flags & 1) throw new Error('This leg disables inherited translation from the body. Choose a body that drives the leg roots.');
      if (parent.ObjectId === bodyId) break;
      child = parent; parent = byId.get(parent.Parent);
    }
    if (!parent) throw new Error('Choose a body node whose hierarchy drives every configured leg root.');
  }
  return byId.get(bodyId);
}

export function suggestPoseBody(model, legs) {
  if (!legs.length) throw new Error('No limb roots are mapped yet. Choose a body node directly.');
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), seen = new Set();
  let parent = byId.get(byId.get(legs[0].root)?.Parent);
  while (parent && !seen.has(parent.ObjectId)) {
    seen.add(parent.ObjectId);
    try { validatePoseBody(model, parent.ObjectId, legs); return parent.ObjectId; } catch { parent = byId.get(parent.Parent); }
  }
  throw new Error('No shared Bone or Helper ancestor drives these legs.');
}

export function solvePoseBody(model, bodyId, pinnedLegs, frame, sequence, displacement, globalTime = frame) {
  return solvePoseNode(model, bodyId, pinnedLegs, frame, sequence, { mode: 'move', space: 'world', values: v3(displacement).toArray() }, globalTime);
}

function descendantOf(model, id, ancestor) {
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), visited = new Set();
  let node = byId.get(id);
  while (node && !visited.has(node.ObjectId)) {
    if (node.ObjectId === ancestor) return true;
    visited.add(node.ObjectId); node = byId.get(node.Parent);
  }
  return false;
}

export function poseAffectedPins(model, config, id) {
  return config.chains.filter(chain => config.pins.includes(chain.key) && chain.end !== id && descendantOf(model, chain.end, id));
}

// Automatic targets belong to ancestors of a complete limb. Selecting a limb's
// own joints still permits ordinary FK; explicit pins retain their constraint.
export function poseNodeConstraints(model, config, id, mode = 'move') {
  const pinned = new Set(poseAffectedPins(model, config, id).map(chain => chain.key));
  return config.chains.filter(chain => pinned.has(chain.key) ||
    ['move', 'rotate'].includes(mode) && chain.root !== id && descendantOf(model, chain.root, id))
    .map(chain => ({ chain, pinned: pinned.has(chain.key), bendLocal: config.bends?.[chain.key], target: config.targets?.[chain.key] }));
}

// Reuse an unreachable automatic goal only while its sampled pose still matches.
// FK edits, Undo, scrubbing and changed mappings therefore rebase from native data.
function matchesPoseTarget(target, chain, pose, frame, sequence) {
  return target?.frame === frame && target.sequence === sequence &&
    [chain.root, chain.middle, chain.end].every((id, i) => id === target.joints[i]) &&
    [pose.root, pose.middle, pose.end].every((point, i) => point.distanceTo(v3(target.points[i])) <= pose.tolerance * .1) &&
    pose.rotations.every((rotation, i) => 1 - Math.abs(rotation.dot(new Quaternion().fromArray(target.rotations[i]))) < 1e-9);
}

export function withPoseResult(config, result) {
  return { ...config,
    bends: { ...config.bends, ...Object.fromEntries((result.bends || []).map(bend => [bend.key, bend.local])) },
    targets: { ...config.targets, ...Object.fromEntries((result.targets || []).map(target => [target.key, target])) },
  };
}

// First intersection along a body translation, including an inner reach limit.
// Keeping the valid prefix makes continued dragging stay at the boundary.
function reachFraction(relative, delta, inner, outer) {
  const a = delta.lengthSq(); if (a < 1e-20) return 1;
  const b = 2 * relative.dot(delta), distance = relative.length();
  const roots = radius => { const c = relative.lengthSq() - radius * radius, d = b * b - 4 * a * c; return d < 0 ? null : [(-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)]; };
  const far = roots(Math.max(outer, distance)), near = inner > 1e-8 ? roots(Math.min(inner, distance)) : null;
  let fraction = far ? Math.max(0, far[1]) : 1;
  if (near && near[0] >= 0 && near[1] > near[0]) fraction = Math.min(fraction, near[0]);
  return Math.min(1, fraction);
}

/** Ancestor moves solve affected limbs toward their current endpoint poses.
 * Automatic targets yield at reach; only explicit pins limit the body move. */
export function solvePoseNode(model, id, constraints, frame, sequence, change, globalTime = frame) {
  const node = allNodes(model).find(node => node.ObjectId === id), property = movementProperties[change.mode];
  if (!node || !property) throw new Error('Select an object and a Movement tool.');
  const values = change.values || ['X', 'Y', 'Z'].map(axis => axis === change.axis ? change.amount : change.mode === 'scale' ? 1 : 0);
  if (values.length !== 3 || !finite(values)) throw new Error('Enter finite X, Y, and Z values.');
  const used = new Set(), captured = constraints.filter(pin => pin.chain.end !== id && descendantOf(model, pin.chain.end, id)).map(pin => {
    for (const joint of [pin.chain.root, pin.chain.middle, pin.chain.end]) { if (used.has(joint)) throw new Error('Limb controls must have separate joint chains.'); used.add(joint); }
    const pose = samplePoseChain(model, pin.chain, frame, sequence, globalTime);
    const target = pin.pinned === false && matchesPoseTarget(pin.target, pin.chain, pose, frame, sequence) ? pin.target : null;
    return { ...pin, pinned: pin.pinned !== false, pose, position: v3(pin.position || target?.position || pose.end), orientation: pin.orientation || target?.orientation || pose.rotations[2].toArray() };
  });
  const fixed = captured.filter(pin => pin.pinned);
  const transformed = fraction => {
    const copy = posePreviewModel(model), target = allNodes(copy).find(item => item.ObjectId === id);
    // Ordinary Movement owns these tracks in-place; detach just its channels.
    for (const channel of Object.values(movementProperties)) if (target[channel]) target[channel] = structuredClone(target[channel]);
    const scaled = values.map(value => change.mode === 'scale' ? 1 + (value - 1) * fraction : value * fraction);
    applyMovementTransform(copy, [id], frame, sequence, { ...change, values: scaled }); return copy;
  };
  const reachable = copy => fixed.every(pin => {
    const pose = samplePoseChain(copy, pin.chain, frame, sequence, globalTime), distance = pose.root.distanceTo(pin.position);
    return distance <= pose.lengths[0] + pose.lengths[1] + pose.tolerance * .1 && distance >= Math.abs(pose.lengths[0] - pose.lengths[1]) - pose.tolerance * .1;
  });
  let fraction = 1, copy = transformed(1);
  if (fixed.length) {
    let linear = change.mode === 'move';
    const poses = fixed.map(pin => samplePoseChain(copy, pin.chain, frame, sequence, globalTime));
    linear &&= poses.every((pose, i) => pose.lengths.every((length, j) => Math.abs(length - fixed[i].pose.lengths[j]) < pose.tolerance));
    if (linear) for (let i = 0; i < fixed.length; i++) {
      const pin = fixed[i], delta = poses[i].root.clone().sub(pin.pose.root);
      fraction = Math.min(fraction, reachFraction(pin.pose.root.clone().sub(pin.position), delta, Math.abs(pin.pose.lengths[0] - pin.pose.lengths[1]), pin.pose.lengths[0] + pin.pose.lengths[1]));
    }
    else {
      // Rotated/scaled ancestry follows the existing transform, not a linear
      // substitute. Locate its first reach boundary without running IK loops.
      let previous = 0;
      for (let step = 1; step <= 8; step++) {
        const next = step / 8;
        if (!reachable(next === 1 ? copy : transformed(next))) {
          let low = previous, high = next;
          for (let iteration = 0; iteration < 20; iteration++) { const middle = (low + high) / 2; if (reachable(transformed(middle))) low = middle; else high = middle; }
          fraction = low; break;
        }
        previous = next;
      }
    }
    if (fraction < 1) copy = transformed(Math.max(0, fraction * (1 - 1e-7)));
  }
  const target = allNodes(copy).find(item => item.ObjectId === id), changes = [{ id, property, value: sampleMovement(copy, target, property, frame, sequence) }], bends = [];
  if (change.rotateOnOwnAxis && change.mode === 'rotate') changes.push({ id, property: 'Translation', value: sampleMovement(copy, target, 'Translation', frame, sequence) });
  for (const pin of captured) {
    const result = solveChainOnClone(copy, pin.chain, frame, sequence, pin.position, { orientation: pin.orientation, bendMemory: pin.bendLocal && v3(pin.bendLocal).applyQuaternion(pin.pose.rotations[0]), strict: pin.pinned, globalTime });
    changes.push(...result.changes); bends.push({ key: pin.chain.key, local: v3(result.bend).applyQuaternion(result.pose.rotations[0].clone().invert()).toArray() });
  }
  for (const pin of fixed) {
    const after = samplePoseChain(copy, pin.chain, frame, sequence, globalTime);
    if (after.end.distanceTo(pin.position) > pin.pose.tolerance * 4 || 1 - Math.abs(after.rotations[2].dot(new Quaternion().fromArray(pin.orientation))) > 1e-7) throw new Error('This transform cannot retain the pins.');
  }
  const targets = captured.filter(pin => !pin.pinned).map(pin => {
    const pose = samplePoseChain(copy, pin.chain, frame, sequence, globalTime);
    return { key: pin.chain.key, frame, sequence, joints: [pin.chain.root, pin.chain.middle, pin.chain.end],
      position: pin.position.toArray(), orientation: pin.orientation,
      points: [pose.root, pose.middle, pose.end].map(point => point.toArray()), rotations: pose.rotations.map(rotation => rotation.toArray()) };
  });
  const unique = [...new Map(changes.map(item => [`${item.id}:${item.property}`, item])).values()];
  // Validate ownership against the original tracks, after all compensations.
  const prepared = prepareMovementPose(model, unique, frame, sequence, change.restrictions);
  return { changes: unique.filter(item => prepared.some(track => track.id === item.id && track.property === item.property)), bends, targets, limited: fraction < 1, fraction };
}

export function poseTrackScope(config, target, mode, model) {
  if (!target) return [];
  if (target.kind === 'body' || target.kind === 'node') {
    const id = target.kind === 'body' ? config.body : target.id;
    const pins = model ? poseNodeConstraints(model, config, id, mode).map(item => item.chain) : config.chains.filter(chain => config.pins.includes(chain.key));
    return [...new Map([{ id, property: movementProperties[mode] || 'Translation' }, ...pins.flatMap(chain => [chain.root, chain.middle, chain.end].map(id => ({ id, property: 'Rotation' })))].map(item => [`${item.id}:${item.property}`, item])).values()];
  }
  const chain = config.chains.find(item => item.key === target.key);
  if (chain && mode === 'scale') return [{ id: chain.end, property: 'Scaling' }];
  return chain ? (mode === 'rotate' && target.kind !== 'bend' ? [chain.end] : [chain.root, chain.middle, chain.end]).map(id => ({ id, property: 'Rotation' })) : [];
}
