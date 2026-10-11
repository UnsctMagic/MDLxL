import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from './animation.js';
import { applyMovementPose, movementRestricted, sampleMovement } from './movement.js';
import { poseChainIds, poseControlPoint, poseNodeControl, poseNodeConstraints, posePreviewModel, poseTrackScope, samplePoseChain, solvePoseLimb, solvePoseNode, turnPoseEndpoint } from './pose-ik.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const q = value => new Quaternion().fromArray(value).normalize();
const stamp = (id, property) => `${id}:${property}`;
const defaults = { Rotation: [0, 0, 0, 1], Translation: [0, 0, 0] };

function rotationVector(rotation) {
  const r = rotation.clone().normalize();
  if (r.w < 0) r.set(-r.x, -r.y, -r.z, -r.w);
  const length = Math.hypot(r.x, r.y, r.z);
  return length < 1e-9 ? new Vector3() : new Vector3(r.x, r.y, r.z).multiplyScalar(2 * Math.atan2(length, r.w) / length);
}
function rotationFromVector(vector) {
  const angle = vector.length();
  return angle < 1e-9 ? new Quaternion() : new Quaternion().setFromAxisAngle(vector.clone().divideScalar(angle), angle);
}

/** Selection describes carried mass. Its skin bindings are read, never written. */
export function weightMass(model, selection, driver, chain) {
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const branch = new Set(chain ? [chain.root, ...(chain.joints || []), chain.middle, chain.end] : [driver]);
  const carried = id => {
    const seen = new Set();
    while (nodes.has(id) && !seen.has(id)) {
      if (branch.has(id)) return true;
      seen.add(id); id = nodes.get(id).Parent;
    }
    return false;
  };
  const groups = new Map(); let count = 0;
  for (const [index, selected] of Object.entries(selection || {})) {
    const geo = model.Geosets?.[Number(index)];
    if (!geo) continue;
    for (const vertex of new Set(selected)) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex * 3 + 2 >= geo.Vertices.length) continue;
      const skin = geo.SkinWeights, hd = skin?.length === geo.Vertices.length / 3 * 8;
      const ids = hd ? Array.from(skin.slice(vertex * 8, vertex * 8 + 4)) : geo.Groups?.[geo.VertexGroup?.[vertex]] || [];
      const weights = hd ? Array.from(skin.slice(vertex * 8 + 4, vertex * 8 + 8)) : ids.map(() => 1);
      const total = weights.reduce((sum, value) => sum + value, 0);
      if (!total || ids.some((id, i) => weights[i] > 0 && !carried(id))) throw new Error('Select vertices carried by this controller.');
      const point = new Vector3().fromArray(geo.Vertices, vertex * 3);
      ids.forEach((id, i) => {
        if (!weights[i]) return;
        const weight = weights[i] / total, group = groups.get(id) || { center: new Vector3(), weight: 0 };
        group.center.addScaledVector(point, weight); group.weight += weight; groups.set(id, group);
      });
      count++;
    }
  }
  if (!count) throw new Error('Select VERTICES in Movement to choose what carries the weight.');
  for (const group of groups.values()) group.center.divideScalar(group.weight);
  const ancestors = id => { const path = new Set(); while (nodes.has(id) && !path.has(id)) { path.add(id); id = nodes.get(id).Parent; } return path; };
  const paths = [...groups.keys()].map(ancestors);
  const rotor = chain ? [...poseChainIds(chain)].reverse().find(joint => paths.every(path => path.has(joint))) : driver;
  return { count, rotor, center(matrices) {
    const center = new Vector3();
    for (const [id, group] of groups) center.addScaledVector(group.center.clone().applyMatrix4(matrices.get(id) || new Matrix4()), group.weight / count);
    return center;
  } };
}

/** Sample the selected native motion once. No saved model data is changed. */
export function preparePoseWeight(model, config, target, sequence, range, selection) {
  const interval = model.Sequences?.[sequence]?.Interval;
  if (!interval || !range || range.length !== 2 || range.some(t => !Number.isInteger(t)) || range[0] < interval[0] || range[1] > interval[1] || range[1] - range[0] < 2) throw new Error('Shift-drag a portion of the controller track inside one animation.');
  const chain = config.chains?.find(item => item.key === target?.key);
  const id = chain?.end ?? (target?.kind === 'body' ? config.body : target?.id);
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  if (!nodes.has(id) || target?.kind === 'bend') throw new Error('Choose a hand, foot or body-part controller first.');
  const mass = weightMass(model, selection, id, chain);
  const baseline = posePreviewModel(model), times = new Set(range);
  // Internal integration samples are discarded after curve fitting. They are
  // not a per-frame bake and have no relationship to playback speed.
  const steps = Math.max(24, Math.min(120, Math.ceil((range[1] - range[0]) / 12)));
  for (let i = 1; i < steps; i++) times.add(Math.round(range[0] + (range[1] - range[0]) * i / steps));
  for (const node of nodes.values()) for (const property of ['Rotation', 'Translation']) for (const key of node[property]?.Keys || []) if (key.Frame > range[0] && key.Frame < range[1]) times.add(key.Frame);
  const samples = [...times].sort((a, b) => a - b).map(frame => {
    const matrices = sampleNodeMatrices(baseline, frame, sequence, frame);
    const pose = chain ? samplePoseChain(baseline, chain, frame, sequence) : null;
    const position = pose?.end.clone() || poseControlPoint(baseline, config, id, matrices);
    const rotation = new Quaternion(); matrices.get(mass.rotor).decompose(new Vector3(), rotation, new Vector3());
    const rotorNode = nodes.get(mass.rotor);
    const pivot = new Vector3().fromArray(rotorNode.PivotPoint || model.PivotPoints[mass.rotor]).applyMatrix4(matrices.get(mass.rotor));
    return { frame, position, pivot, rotation, mass: mass.center(matrices), length: pose ? pose.lengths.reduce((sum, x) => sum + x, 0) : 0 };
  });
  const length = Math.max(1e-4, ...samples.map(s => s.length || s.mass.distanceTo(s.position) * 2));
  let travel = 0, peakSpeed = 0, impact = null, bestStop = 0;
  const duration = range[1] - range[0];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], prev = samples[Math.max(0, i - 1)], dt = (s.frame - prev.frame) / duration;
    s.velocity = dt ? s.mass.clone().sub(prev.mass).divideScalar(dt) : new Vector3();
    s.handVelocity = dt ? s.position.clone().sub(prev.position).divideScalar(dt) : new Vector3();
    s.angularVelocity = dt ? rotationVector(s.rotation.clone().multiply(prev.rotation.clone().invert())).divideScalar(dt) : new Vector3();
    if (dt) travel += s.mass.distanceTo(prev.mass);
    peakSpeed = Math.max(peakSpeed, s.velocity.length());
    const stop = i > 1 ? Math.max(0, prev.velocity.dot(prev.velocity.clone().sub(s.velocity))) : 0;
    if ((s.frame - range[0]) / duration > .25 && stop > bestStop) { bestStop = stop; impact = { frame: s.frame, direction: prev.velocity.clone().normalize(), speed: prev.velocity.length() }; }
  }
  if (!impact || bestStop < peakSpeed * peakSpeed * .035) impact = null;
  return { baseline, config, target, sequence, range: [...range], id, rotor: mass.rotor, chain, massCount: mass.count, samples, length, travel, impact };
}

function nativeKey(frame, value, lineType, original, property) {
  const key = { Frame: frame, Vector: new Float32Array(value) };
  if (lineType >= 2) {
    const delta = original && property === 'Rotation' ? q(value).multiply(q(original.Vector).invert()) : null;
    for (const tangent of ['InTan', 'OutTan']) key[tangent] = new Float32Array(delta && original[tangent]
      ? delta.clone().multiply(q(original[tangent])).toArray()
      : original?.[tangent] && property === 'Translation' ? Array.from(original[tangent], (x, i) => lineType === 3 ? x + value[i] - original.Vector[i] : x)
      : property === 'Rotation' || lineType === 3 ? value : [0, 0, 0]);
  }
  return key;
}

/** Fit using the actual Warcraft interpolation, retaining every authored key. */
function fitTrack(track, desired, property, tolerance, required) {
  const chosen = new Set([0, desired.length - 1]);
  desired.forEach((key, i) => { if (required.has(key.Frame)) chosen.add(i); });
  const error = (a, b) => property === 'Rotation' ? q(a).angleTo(q(b)) : new Vector3().fromArray(a).distanceTo(new Vector3().fromArray(b));
  const velocity = index => {
    const left = Math.max(0, index - 1), right = Math.min(desired.length - 1, index + 1), dt = desired[right].Frame - desired[left].Frame;
    if (!dt) return new Vector3();
    if (property !== 'Rotation') return new Vector3().fromArray(desired[right].Vector).sub(new Vector3().fromArray(desired[left].Vector)).divideScalar(dt);
    const reference = q(desired[index].Vector).invert();
    return rotationVector(reference.clone().multiply(q(desired[right].Vector))).sub(rotationVector(reference.multiply(q(desired[left].Vector)))).divideScalar(dt);
  };
  const segmentKeys = (left, right) => {
    const a = structuredClone(desired[left]), b = structuredClone(desired[right]), dt = b.Frame - a.Frame;
    if (track.LineType >= 2) {
      if (property === 'Rotation') {
        const delta = rotationVector(q(a.Vector).invert().multiply(q(b.Vector)));
        a.OutTan = new Float32Array(q(a.Vector).multiply(rotationFromVector(velocity(left).multiplyScalar(dt).sub(delta).multiplyScalar(.5))).toArray());
        b.InTan = new Float32Array(q(b.Vector).multiply(rotationFromVector(delta.sub(velocity(right).multiplyScalar(dt)).multiplyScalar(.5))).toArray());
      } else {
        const out = velocity(left).multiplyScalar(dt), incoming = velocity(right).multiplyScalar(dt);
        a.OutTan = new Float32Array(track.LineType === 2 ? out.toArray() : out.divideScalar(3).add(new Vector3().fromArray(a.Vector)).toArray());
        b.InTan = new Float32Array(track.LineType === 2 ? incoming.toArray() : incoming.multiplyScalar(-1 / 3).add(new Vector3().fromArray(b.Vector)).toArray());
      }
    }
    return [a, b];
  };
  const sorted = [...chosen].sort((a, b) => a - b);
  const intervals = sorted.slice(1).map((right, i) => [sorted[i], right]);
  while (intervals.length) {
    const [left, right] = intervals.pop(); if (right - left < 2) continue;
    const segment = { ...track, Keys: segmentKeys(left, right) };
    let worst = tolerance, split = -1;
    for (let i = left + 1; i < right; i++) {
      const value = sampleTrack(segment, desired[i].Frame, { fallback: defaults[property], quaternion: property === 'Rotation' });
      const difference = error(value, desired[i].Vector);
      if (difference > worst) { worst = difference; split = i; }
    }
    if (split >= 0) { chosen.add(split); intervals.push([left, split], [split, right]); }
  }
  const kept = [...chosen].sort((a, b) => a - b), keys = kept.map(i => structuredClone(desired[i]));
  if (track.LineType >= 2) for (let i = 1; i < kept.length; i++) {
    const [a, b] = segmentKeys(kept[i - 1], kept[i]); keys[i - 1].OutTan = a.OutTan; keys[i].InTan = b.InTan;
  }
  return keys;
}

export function buildPoseWeight(analysis, mode, amount, restrictions = {}) {
  if (!['heavy', 'swing'].includes(mode)) throw new Error('Choose Heavy or Swing.');
  const strength = clamp(Number(amount) / 100, 0, 1);
  if (!Number.isFinite(strength)) throw new Error('Weight must be a number.');
  if (!strength) return { tracks: [], keyCount: 0, massCount: analysis.massCount };
  if (movementRestricted('rotate', restrictions)) throw new Error('Rotation is restricted.');
  const { baseline, config, target, chain, id, rotor, sequence, range, samples, length, impact } = analysis;
  if (mode === 'swing' && analysis.travel < length * .001) throw new Error('This portion is still. Select a moving swing.');
  const duration = range[1] - range[0], poses = [], scope = new Map();
  let activeStart = range[0], activeEnd = range[1];
  const baseNodes = new Map(allNodes(baseline).map(node => [node.ObjectId, node]));
  const scopeConfig = chain ? { ...config, restrict: true } : config;
  const affected = [...new Map(['move', 'rotate'].flatMap(mode => poseTrackScope(scopeConfig, target, mode, baseline, restrictions)).map(item => [stamp(item.id, item.property), item])).values()];
  for (const item of affected) {
    const track = baseNodes.get(item.id)?.[item.property];
    if (track?.LineType >= 2) {
      const enclosed = track.Keys.filter(key => key.Frame >= range[0] && key.Frame <= range[1]);
      if (enclosed.length < 2) throw new Error('Include at least two keys of the curved controller in the selected portion.');
      activeStart = Math.max(activeStart, enclosed[0].Frame); activeEnd = Math.min(activeEnd, enclosed.at(-1).Frame);
    }
  }
  if (activeEnd <= activeStart) throw new Error('Select a wider portion containing the limb’s curved keys.');
  const angular = new Vector3(), angularSpeed = new Vector3(), drag = new Vector3(), dragSpeed = new Vector3();
  const omega = 12 - strength * 5, damping = .58;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], prev = samples[Math.max(0, i - 1)], dt = (s.frame - prev.frame) / duration;
    const u = (s.frame - activeStart) / (activeEnd - activeStart), envelope = smooth(u / .12) * smooth((1 - u) / .16);
    const lever = s.mass.clone().sub(s.pivot), leverLength = Math.max(length * .15, lever.length());
    let offset = new Vector3(), turn = new Vector3();
    if (mode === 'heavy') {
      offset.z = -length * .18 * strength;
      turn = lever.clone().cross(new Vector3(0, 0, -1)).multiplyScalar(.55 * strength / Math.max(length * .35, leverLength));
    } else if (dt) {
      const acceleration = s.handVelocity.clone().sub(prev.handVelocity).divideScalar(dt);
      const angularAcceleration = s.angularVelocity.clone().sub(prev.angularVelocity).divideScalar(dt);
      const torque = lever.clone().cross(acceleration.clone().negate()).divideScalar(leverLength * leverLength).addScaledVector(angularAcceleration, -1).multiplyScalar(strength * .7);
      // A damped spring follows measured motion. Acceleration causes drag;
      // deceleration lets stored momentum overtake the original orientation.
      const substeps = Math.max(1, Math.ceil(dt / .008)), h = dt / substeps;
      for (let j = 0; j < substeps; j++) {
        angularSpeed.addScaledVector(torque.clone().addScaledVector(angular, -omega * omega).addScaledVector(angularSpeed, -2 * damping * omega), h);
        angular.addScaledVector(angularSpeed, h).clampLength(0, .85 * strength);
        dragSpeed.addScaledVector(acceleration.clone().multiplyScalar(-.24 * strength).addScaledVector(drag, -omega * omega).addScaledVector(dragSpeed, -2 * damping * omega), h);
        drag.addScaledVector(dragSpeed, h).clampLength(0, length * .13 * strength);
      }
      turn.copy(angular); offset.copy(drag);
      if (impact) {
        const phase = (s.frame - impact.frame) / duration;
        if (phase > 0 && phase < .16) offset.addScaledVector(impact.direction, -(Math.sin(Math.PI * phase / .16) ** 2) * Math.min(length * .045, impact.speed * .012) * strength);
      }
    }
    offset.multiplyScalar(envelope); turn.multiplyScalar(envelope);
    const changed = posePreviewModel(baseline);
    if (envelope > 0) {
      const moved = chain ? solvePoseLimb(baseline, chain, s.frame, sequence, s.position.clone().add(offset), { restrictions })
        : solvePoseNode(baseline, id, poseNodeConstraints(baseline, config, id, 'move', target), s.frame, sequence, { mode: 'move', space: 'world', values: offset.toArray(), control: poseNodeControl(baseline, config, target, 'move'), restrictions });
      applyMovementPose(changed, moved.changes, s.frame, sequence, restrictions);
      const rotation = rotationFromVector(turn);
      const turned = chain && rotor === chain.end ? turnPoseEndpoint(changed, chain, s.frame, sequence, rotation.toArray())
        : solvePoseNode(changed, rotor, chain ? [] : poseNodeConstraints(changed, config, rotor, 'rotate', target), s.frame, sequence, { mode: 'rotate', space: 'world', values: new Euler().setFromQuaternion(rotation, 'XYZ').toArray().slice(0, 3).map(x => x * 180 / Math.PI), control: chain ? { joints: [], heads: [] } : poseNodeControl(changed, config, target, 'rotate'), restrictions });
      // Direct controls receive their world rotation through the native solver;
      // endpoint orientation never changes the grip or mesh attachment.
      applyMovementPose(changed, turned.changes, s.frame, sequence, restrictions);
      for (const change of [...moved.changes, ...turned.changes]) scope.set(stamp(change.id, change.property), { id: change.id, property: change.property });
    }
    poses.push(changed);
  }
  const nodes = new Map(allNodes(baseline).map(node => [node.ObjectId, node]));
  const sampledNodes = poses.map(model => new Map(allNodes(model).map(node => [node.ObjectId, node])));
  const tracks = [];
  for (const item of scope.values()) {
    const node = nodes.get(item.id), prior = node[item.property], track = prior?.Keys ? prior : { LineType: 1, Keys: [] };
    if (track.LineType === 0) throw new Error('Weight needs a smooth controller. Choose Linear for the affected bone.');
    let start = range[0], end = range[1];
    // Cubic quaternion curves cannot be split exactly using an invented knot.
    // Keep their first/last enclosed authored knots (and outward tangents)
    // untouched, so all interpolation outside the chosen portion is exact.
    if (track.LineType >= 2) {
      const interior = track.Keys.filter(k => k.Frame >= start && k.Frame <= end);
      if (interior.length < 2) throw new Error('Include at least two keys of the curved controller in the selected portion.');
      start = interior[0].Frame; end = interior.at(-1).Frame;
    }
    const original = new Map(track.Keys.map(key => [key.Frame, key]));
    const desired = samples.flatMap((sample, i) => {
      if (sample.frame < start || sample.frame > end) return [];
      const boundary = sample.frame === start || sample.frame === end;
      const value = sampleMovement(boundary ? baseline : poses[i], boundary ? node : sampledNodes[i].get(item.id), item.property, sample.frame, sequence);
      return [boundary && original.has(sample.frame) ? structuredClone(original.get(sample.frame)) : nativeKey(sample.frame, value, track.LineType, original.get(sample.frame), item.property)];
    });
    const fitted = fitTrack(track, desired, item.property, item.property === 'Rotation' ? .007 : length * .001, new Set([...original.keys(), activeStart, activeEnd]));
    // Existing animation boundaries are seeded by the native writer above;
    // retain them when this bone previously had no local track at all.
    const interval = baseline.Sequences[sequence].Interval;
    const outside = track.Keys.filter(key => key.Frame < start || key.Frame > end).map(key => structuredClone(key));
    if (!track.Keys.some(key => key.Frame >= interval[0] && key.Frame <= interval[1])) for (const frame of interval) if (frame < start || frame > end) outside.push(nativeKey(frame, sampleMovement(baseline, node, item.property, frame, sequence), track.LineType, null, item.property));
    tracks.push({ ...item, track: { ...structuredClone(track), Keys: [...outside, ...fitted].sort((a, b) => a.Frame - b.Frame) } });
  }
  return { tracks, keyCount: tracks.reduce((sum, item) => sum + item.track.Keys.filter(key => key.Frame >= range[0] && key.Frame <= range[1]).length, 0), massCount: analysis.massCount, impact: impact?.frame ?? null };
}

/** Install one complete authored result in EditorDocument.apply(['Nodes']). */
export function applyPoseWeight(model, result) {
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  for (const item of result.tracks) if (!nodes.has(item.id)) throw new Error('The Weight controller no longer exists.');
  for (const item of result.tracks) nodes.get(item.id)[item.property] = structuredClone(item.track);
  return result.tracks.length;
}
