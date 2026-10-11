import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack } from './animation.js';
import { applyMovementPose, movementRestricted, prepareMovementPose, sampleMovement } from './movement.js';
import { poseChainIds, poseControlPoint, posePreviewModel, samplePoseChain, solvePoseBody, suggestPoseBody } from './pose-ik.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const q = value => new Quaternion().fromArray(value).normalize();
const stamp = (id, property) => `${id}:${property}`;
const defaults = { Rotation: [0, 0, 0, 1], Translation: [0, 0, 0] };
const pivot = (model, node) => new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);

function ancestry(nodes, id) {
  const path = [];
  while (nodes.has(id) && !path.includes(id)) { path.push(id); id = nodes.get(id).Parent; }
  return path;
}
function influences(geo, vertex) {
  const skin = geo.SkinWeights;
  return skin?.length === geo.Vertices.length / 3 * 8
    ? Array.from(skin.slice(vertex * 8, vertex * 8 + 4), (id, i) => [id, skin[vertex * 8 + 4 + i]]).filter(([, weight]) => weight > 0)
    : (geo.Groups?.[geo.VertexGroup?.[vertex]] || []).map(id => [id, 1]);
}

/** Start with the visible skin carried by the handle. Picking vertices is an
 * optional refinement, not a prerequisite for getting a useful preview. */
export function automaticWeightSelection(model, config, target, sequence, range) {
  const nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  const chain = config.chains?.find(c => c.key === target?.key);
  const roots = chain ? poseChainIds(chain).slice().reverse() : [target?.kind === 'body' ? config.body : target?.id];
  for (const root of roots) {
    const selected = {};
    for (const [index, geo] of (model.Geosets || []).entries()) {
      if (![range[0], (range[0] + range[1]) / 2, range[1]].some(frame => sampleGeosetAnimation(model, index, frame, sequence).alpha > .05)) continue;
      const vertices = [];
      for (const vertex of new Set(geo.Faces || Array.from({ length: geo.Vertices.length / 3 }, (_, i) => i))) {
        const weights = influences(geo, vertex);
        if (weights.length && weights.every(([id]) => ancestry(nodes, id).includes(root))) vertices.push(vertex);
      }
      if (vertices.length) selected[index] = vertices;
    }
    if (Object.keys(selected).length) return selected;
  }
  return {};
}

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
  const groups = new Map(); let count = 0, totalMass = 0, secondMoment = 0;
  const grip = pivot(model, nodes.get(driver));
  for (const [index, selected] of Object.entries(selection || {})) {
    const geo = model.Geosets?.[Number(index)];
    if (!geo) continue;
    // Surface area avoids treating a densely tessellated hand as heavier than
    // a broad, sparsely modeled axe head. This is a geometric inertia proxy;
    // the artist's sliders supply the desired strength, not invented kg.
    const area = new Float64Array(geo.Vertices.length / 3);
    for (let i = 0; i < (geo.Faces?.length || 0); i += 3) {
      const ids = Array.from(geo.Faces.slice(i, i + 3));
      if (ids.length < 3) break;
      const points = ids.map(id => new Vector3().fromArray(geo.Vertices, id * 3));
      const share = points[1].sub(points[0]).cross(points[2].sub(points[0])).length() / 6;
      ids.forEach(id => { area[id] += share; });
    }
    const hasArea = area.some(value => value > 0);
    for (const vertex of new Set(selected)) {
      if (!Number.isInteger(vertex) || vertex < 0 || vertex * 3 + 2 >= geo.Vertices.length) continue;
      const skin = geo.SkinWeights, hd = skin?.length === geo.Vertices.length / 3 * 8;
      const ids = hd ? Array.from(skin.slice(vertex * 8, vertex * 8 + 4)) : geo.Groups?.[geo.VertexGroup?.[vertex]] || [];
      const weights = hd ? Array.from(skin.slice(vertex * 8 + 4, vertex * 8 + 8)) : ids.map(() => 1);
      const total = weights.reduce((sum, value) => sum + value, 0);
      if (!total || ids.some((id, i) => weights[i] > 0 && !carried(id))) throw new Error('Select vertices carried by this controller.');
      const point = new Vector3().fromArray(geo.Vertices, vertex * 3);
      const surface = hasArea ? area[vertex] : 1;
      if (!surface) continue;
      ids.forEach((id, i) => {
        if (!weights[i]) return;
        const weight = surface * weights[i] / total, group = groups.get(id) || { center: new Vector3(), weight: 0 };
        group.center.addScaledVector(point, weight); group.weight += weight; groups.set(id, group);
      });
      totalMass += surface; secondMoment += surface * point.distanceToSquared(grip);
      count++;
    }
  }
  if (!count) throw new Error('Choose visible skin carried by this part, or use Pick vertices.');
  for (const group of groups.values()) group.center.divideScalar(group.weight);
  const ancestors = id => { const path = new Set(); while (nodes.has(id) && !path.has(id)) { path.add(id); id = nodes.get(id).Parent; } return path; };
  const paths = [...groups.keys()].map(ancestors);
  const rotor = chain ? [...poseChainIds(chain)].reverse().find(joint => paths.every(path => path.has(joint))) : driver;
  if (rotor == null) throw new Error('The selected skin has no shared limb controller.');
  return { count, rotor, radius: Math.sqrt(secondMoment / totalMass), center(matrices) {
    const center = new Vector3();
    for (const [id, group] of groups) center.addScaledVector(group.center.clone().applyMatrix4(matrices.get(id) || new Matrix4()), group.weight / totalMass);
    return center;
  } };
}

/** Sample the selected native motion once. No saved model data is changed. */
export function preparePoseWeight(model, config, target, sequence, range, selection) {
  const interval = model.Sequences?.[sequence]?.Interval;
  range ||= interval && Array.from(interval);
  if (!interval || !range || range.length !== 2 || range.some(t => !Number.isInteger(t)) || range[0] < interval[0] || range[1] > interval[1] || range[1] - range[0] < 20) throw new Error('Choose an animation, or select a longer portion of its timeline.');
  const chain = config.chains?.find(item => item.key === target?.key);
  const id = chain?.end ?? (target?.kind === 'body' ? config.body : target?.id);
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  if (!nodes.has(id) || target?.kind === 'bend') throw new Error('Choose a hand, foot or body-part controller first.');
  const automatic = !Object.values(selection || {}).some(ids => ids.length);
  if (automatic) selection = automaticWeightSelection(model, config, target, sequence, range);
  const mass = weightMass(model, selection, id, chain);
  const baseline = posePreviewModel(model), duration = range[1] - range[0];
  const steps = Math.min(160, duration), samples = Array.from({ length: steps + 1 }, (_, i) => {
    const frame = range[0] + duration * i / steps;
    const matrices = sampleNodeMatrices(baseline, frame, sequence, frame);
    const pose = chain ? samplePoseChain(baseline, chain, frame, sequence) : null;
    const position = pose?.end.clone() || poseControlPoint(baseline, config, id, matrices);
    const rotation = new Quaternion(), scale = new Vector3();
    matrices.get(mass.rotor).decompose(new Vector3(), rotation, scale);
    return { frame, position, rotation, radius: mass.radius * Math.max(scale.x, scale.y, scale.z), mass: mass.center(matrices), length: pose ? pose.lengths.reduce((sum, x) => sum + x, 0) : 0 };
  });
  const length = Math.max(1e-4, ...samples.map(s => s.length || Math.max(s.mass.distanceTo(s.position), s.radius) * 2));
  // Central differences over a finite window suppress key-spacing artifacts.
  // We identify a stroke, not an acceleration spike at an arbitrary knot.
  let travel = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], left = samples[Math.max(0, i - 3)], right = samples[Math.min(steps, i + 3)];
    s.velocity = right.mass.clone().sub(left.mass).multiplyScalar(duration / (right.frame - left.frame));
    s.spin = rotationVector(right.rotation.clone().multiply(left.rotation.clone().invert())).multiplyScalar(s.radius * duration / (right.frame - left.frame));
    s.speed = Math.sqrt(s.velocity.lengthSq() + s.spin.lengthSq() * .25);
    if (i) travel += s.mass.distanceTo(samples[i - 1].mass) + s.rotation.angleTo(samples[i - 1].rotation) * s.radius * .5;
  }
  let peak = 1, start = 0, stop = steps - 1, best = -1;
  for (let candidate = 2; candidate < steps - 2; candidate++) {
    const speed = samples[candidate].speed;
    if (speed < samples[candidate - 1].speed || speed < samples[candidate + 1].speed) continue;
    let from = candidate - 1, to = candidate + 1;
    while (from > 0 && samples[from].speed > speed * .23) from--;
    while (to < steps - 1 && samples[to].speed > speed * .23 && samples[to].velocity.dot(samples[candidate].velocity) + samples[to].spin.dot(samples[candidate].spin) * .25 > 0) to++;
    // A fast return to the ready pose is not the attack. Prefer a decisive
    // braking event with room for the impact to register and recover. A late
    // intended hit remains available through the explicit hit control.
    const settling = smooth((steps - to) / (steps * .24));
    const braking = clamp(1 - samples[to].speed / Math.max(speed, 1e-9), .1, 1);
    const score = speed * braking * settling;
    if (score > best) { best = score; peak = candidate; start = from; stop = to; }
  }
  const strike = { start: samples[start].frame, peak: samples[peak].frame, hit: samples[stop].frame };
  const heights = samples.map(s => s.position.z), low = Math.min(...heights), high = Math.max(...heights), apex = heights.indexOf(high);
  let lift = apex, land = apex;
  while (lift > 0 && heights[lift] > low + (high - low) * .12) lift--;
  while (land < steps && heights[land] > low + (high - low) * .12) land++;
  const loop = range[0] === interval[0] && range[1] === interval[1] && !model.Sequences[sequence].NonLooping
    && samples[0].position.distanceTo(samples.at(-1).position) < length * .025
    && samples[0].rotation.angleTo(samples.at(-1).rotation) < .1;
  if (loop) {
    while (lift > apex - steps && heights[(lift + steps) % steps] > low + (high - low) * .12) lift--;
    while (land < apex + steps && heights[land % steps] > low + (high - low) * .12) land++;
  }
  const step = { start: range[0] + duration * lift / steps, peak: samples[apex].frame, hit: range[0] + duration * land / steps, height: high - low, loop };
  const joints = chain ? poseChainIds(chain).slice(0, poseChainIds(chain).indexOf(mass.rotor) + 1) : [id];
  // The nearest shared arm ancestor is the torso of this actor (including a
  // rider), rather than an unrelated mount or an arbitrary global root.
  const parents = ancestry(nodes, nodes.get(chain?.root ?? id)?.Parent);
  const peer = config.chains?.find(c => c !== chain && c.kind === chain?.kind && parents.some(p => ancestry(nodes, c.root).includes(p)));
  const body = peer ? parents.find(p => ancestry(nodes, peer.root).includes(p)) : parents[0];
  const mode = chain?.kind === 'leg' ? 'step' : 'strike';
  return { baseline, config, target, sequence, range: [...range], id, rotor: mass.rotor, chain, joints, body, selection, automatic, massCount: mass.count, inertia: clamp(Math.max(...samples.map(s => s.radius)) / length, .15, 2), samples, length, travel, strike, step, mode, impact: { frame: (mode === 'step' ? step : strike).hit } };
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

// Smooth pose beats: the values are offsets along the incoming stroke, not
// an unconstrained spring or a guessed world-down displacement.
function beats(time, keys) {
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (time <= keys[i][0]) {
    const [a, x] = keys[i - 1], [b, y] = keys[i];
    return x + (y - x) * smooth((time - a) / Math.max(1e-6, b - a));
  }
  return keys.at(-1)[1];
}

export function weightSourceTime(frame, start, hit, end, drag) {
  if (frame <= start || frame >= end) return frame;
  if (frame <= hit) {
    const u = (frame - start) / (hit - start);
    // Strictly monotone even at maximum strength. The pose path is retained.
    return start + (hit - start) * (u - .28 * drag * Math.sin(Math.PI * u) ** 2);
  }
  const u = (frame - hit) / (end - hit);
  return hit + (end - hit) * u ** (1 + .9 * drag);
}

export function buildPoseWeight(analysis, mode = analysis.mode, amount = 60, restrictions = {}, settings = {}) {
  if (!['strike', 'step'].includes(mode)) throw new Error('Choose Swing or Step.');
  const strength = clamp(Number(amount) / 100, 0, 1);
  if (!Number.isFinite(strength)) throw new Error('Weight must be a number.');
  if (!strength) return { tracks: [], keyCount: 0, massCount: analysis.massCount };
  if (movementRestricted('rotate', restrictions)) throw new Error('Rotation is restricted.');
  const { baseline, config, chain, sequence, range, length, joints } = analysis;
  if (analysis.travel < length * .003) throw new Error('This part is still. Choose a moving part or a different animation.');
  if (mode === 'step' && (!chain || chain.kind !== 'leg' || analysis.step.height < length * .025)) throw new Error('Step needs a foot with a visible lift and landing.');
  const nodes = new Map(allNodes(baseline).map(n => [n.ObjectId, n]));
  const drag = strength * clamp((settings.drag ?? 100) / 100, 0, 1);
  const recoil = strength * clamp((settings.recoil ?? 75) / 100, 0, 1);
  const bodyAmount = strength * clamp((settings.body ?? 45) / 100, 0, 1);
  const inertia = clamp(.65 + .4 * analysis.inertia, .7, 1.35);
  if (![drag, recoil, bodyAmount].every(Number.isFinite)) throw new Error('Use a number from 0 to 100 for each response.');
  if (!drag && !recoil && !bodyAmount) return { tracks: [], keyCount: 0, massCount: analysis.massCount };
  const duration = range[1] - range[0], full = range[0] === baseline.Sequences[sequence].Interval[0] && range[1] === baseline.Sequences[sequence].Interval[1];
  const phase = analysis[mode];
  // A stroke ending on the clip's last key has no recovery yet. Reserve room
  // for one when generating Swing; the original final pose still closes it.
  const cyclicStep = mode === 'step' && full && phase.loop;
  const stepHit = cyclicStep ? range[0] + (phase.hit - range[0]) % duration : phase.hit;
  const automaticHit = mode === 'strike' ? Math.min(phase.hit, range[1] - duration * .24) : stepHit;
  const requestedHit = Number(settings.hit ?? automaticHit);
  if (!Number.isFinite(requestedHit)) throw new Error('Choose a valid hit time.');
  const hit = clamp(requestedHit, range[0] + 1, range[1] - 1);
  const body = mode === 'step'
    ? ancestry(nodes, analysis.body).find(id => config.roles?.[id] === 'Body' || id === config.body) ?? suggestPoseBody(baseline, config.chains.filter(c => c.kind === 'leg' && ancestry(nodes, c.root).includes(analysis.body)))
    : analysis.body;
  const legs = mode === 'step' ? config.chains.filter(c => c.kind === 'leg' && ancestry(nodes, c.root).includes(body)) : [];
  const scope = new Map();
  const add = (id, property) => { if (nodes.has(id)) scope.set(stamp(id, property), { id, property }); };
  for (const id of joints) {
    add(id, 'Rotation');
    // A limb's authored joint offsets/lengths stay at the current time. A
    // delayed local translation would stretch it rather than add weight.
    if (!chain && nodes.get(id).Translation?.Keys?.some(k => k.Frame >= range[0] && k.Frame <= range[1])) add(id, 'Translation');
  }
  if (bodyAmount && body != null && !joints.includes(body)) {
    add(body, mode === 'step' ? 'Translation' : 'Rotation');
    if (mode === 'step') for (const leg of legs) {
      for (const id of poseChainIds(leg)) add(id, 'Rotation');
      if (leg.grip) add(leg.end, 'Translation');
    }
  }
  let activeStart = range[0], activeEnd = range[1];
  if (!full) for (const { id, property } of scope.values()) {
    const track = nodes.get(id)[property];
    if (track?.LineType >= 2) {
      const keys = track.Keys.filter(k => k.Frame >= range[0] && k.Frame <= range[1]);
      if (keys.length < 2) throw new Error('Include two curved keys, or use the whole animation.');
      activeStart = Math.max(activeStart, keys[0].Frame); activeEnd = Math.min(activeEnd, keys.at(-1).Frame);
    }
  }
  if (activeEnd <= activeStart) throw new Error('Choose a longer portion, or use the whole animation.');
  if (hit <= activeStart || hit >= activeEnd) throw new Error('The hit is outside the editable curved keys. Use the whole animation or move the hit.');
  const times = new Set([range[0], range[1], activeStart, activeEnd, Math.round(hit)]);
  for (let i = 1; i < 160; i++) times.add(Math.round(range[0] + duration * i / 160));
  for (const { id, property } of scope.values()) for (const key of nodes.get(id)[property]?.Keys || []) if (key.Frame >= range[0] && key.Frame <= range[1]) times.add(key.Frame);
  const frames = [...times].sort((a, b) => a - b), desired = new Map([...scope.keys()].map(key => [key, []]));
  const incoming = new Map(joints.map(id => {
    const n = nodes.get(id), a = q(sampleMovement(baseline, n, 'Rotation', Math.max(range[0], phase.hit - duration * .09), sequence));
    const b = q(sampleMovement(baseline, n, 'Rotation', phase.hit, sequence));
    return [id, rotationVector(a.invert().multiply(b)).clampLength(0, .55)];
  }));
  const incomingTranslation = new Map(joints.map(id => {
    const n = nodes.get(id), a = new Vector3().fromArray(sampleMovement(baseline, n, 'Translation', Math.max(range[0], phase.hit - duration * .09), sequence));
    const b = new Vector3().fromArray(sampleMovement(baseline, n, 'Translation', phase.hit, sequence));
    return [id, b.sub(a).clampLength(0, length * .18)];
  }));
  let bodyAxis = new Vector3();
  if (body != null && mode === 'strike') {
    const contact = analysis.samples.reduce((a, b) => Math.abs(a.frame - phase.hit) < Math.abs(b.frame - phase.hit) ? a : b);
    const before = analysis.samples.reduce((a, b) => Math.abs(a.frame - (phase.hit - duration * .08)) < Math.abs(b.frame - (phase.hit - duration * .08)) ? a : b);
    const matrices = sampleNodeMatrices(baseline, phase.hit, sequence);
    const center = pivot(baseline, nodes.get(body)).applyMatrix4(matrices.get(body));
    bodyAxis = before.mass.clone().sub(center).cross(contact.mass.clone().sub(before.mass)).normalize();
  }
  for (const frame of frames) {
    const changed = posePreviewModel(baseline), changedNodes = new Map(allNodes(changed).map(n => [n.ObjectId, n]));
    const envelope = cyclicStep ? 1 : smooth((frame - activeStart) / (duration * .06)) * smooth((activeEnd - frame) / (duration * .09));
    const recovery = cyclicStep ? ((frame - hit) / duration + 1) % 1 : (frame - hit) / duration;
    const bounce = beats(recovery, [[0, 0], [.025, .28], [.09, -1], [.16, .14], [.24, 0]]);
    const changes = [];
    for (let index = 0; index < joints.length; index++) {
      const id = joints[index], node = nodes.get(id), depth = joints.length < 2 ? 1 : .48 + .52 * index / (joints.length - 1);
      let source = frame;
      if (mode === 'strike') source = weightSourceTime(frame, activeStart, hit, activeEnd, Math.min(1, drag * depth * inertia));
      else {
        const cycleFrame = cyclicStep ? phase.start + ((frame - phase.start) % duration + duration) % duration : frame;
        if (cycleFrame >= phase.start && cycleFrame <= phase.hit) {
          source = weightSourceTime(cycleFrame, phase.start, phase.hit, phase.hit + 1, drag);
          if (cyclicStep) source = range[0] + ((source - range[0]) % duration + duration) % duration;
        }
      }
      // Moving the hit marker re-times the existing strike into that time.
      if (hit !== phase.hit && !cyclicStep) source = source <= hit
        ? activeStart + (source - activeStart) * (phase.hit - activeStart) / (hit - activeStart)
        : phase.hit + (source - hit) * (activeEnd - phase.hit) / (activeEnd - hit);
      source = frame + (clamp(source, activeStart, activeEnd) - frame) * envelope;
      const rotation = q(sampleMovement(baseline, node, 'Rotation', source, sequence));
      if (mode === 'strike') rotation.multiply(rotationFromVector(incoming.get(id).clone().multiplyScalar(recoil * inertia * bounce * envelope)));
      changes.push({ id, property: 'Rotation', value: rotation.toArray() });
      if (scope.has(stamp(id, 'Translation'))) {
        const translation = new Vector3().fromArray(sampleMovement(baseline, node, 'Translation', source, sequence));
        if (mode === 'strike') translation.addScaledVector(incomingTranslation.get(id), recoil * bounce * envelope);
        changes.push({ id, property: 'Translation', value: translation.toArray() });
      }
    }
    if (bodyAmount && body != null && !joints.includes(body) && mode === 'strike') {
      const angle = beats(recovery, [[-1, 0], [-.23, -.1], [-.1, -.12], [0, .15], [.065, .04], [.12, -.035], [.28, 0]]) * bodyAmount * envelope;
      const matrices = sampleNodeMatrices(baseline, frame, sequence), parent = nodes.get(body).Parent;
      const parentRotation = new Quaternion(); (matrices.get(parent) || new Matrix4()).decompose(new Vector3(), parentRotation, new Vector3());
      const localAxis = bodyAxis.clone().applyQuaternion(parentRotation.invert());
      const rotation = rotationFromVector(localAxis.multiplyScalar(angle)).multiply(q(sampleMovement(baseline, nodes.get(body), 'Rotation', frame, sequence)));
      changes.push({ id: body, property: 'Rotation', value: rotation.toArray() });
    }
    applyMovementPose(changed, changes, frame, sequence, restrictions);
    if (bodyAmount && mode === 'step' && envelope) {
      const compression = beats(recovery, [[0, 0], [.07, -1], [.17, .12], [.29, 0]]) * length * .15 * bodyAmount * recoil * envelope;
      if (Math.abs(compression) > 1e-8) {
        const planted = legs.map(leg => ({ chain: leg, pinned: true }));
        const result = solvePoseBody(changed, body, planted, frame, sequence, new Vector3(0, 0, compression));
        applyMovementPose(changed, result.changes, frame, sequence, restrictions);
        for (const c of result.changes) if (!scope.has(stamp(c.id, c.property))) throw new Error('The foot response needs a controller outside this body.');
      }
    }
    for (const item of scope.values()) {
      const node = nodes.get(item.id), prior = node[item.property];
      const boundary = !cyclicStep && (frame <= activeStart || frame >= activeEnd);
      let value = sampleMovement(boundary ? baseline : changed, boundary ? node : changedNodes.get(item.id), item.property, frame, sequence);
      const original = prior?.Keys?.find(k => k.Frame === frame);
      if (!boundary && !original && item.property === 'Rotation') value = q(value).toArray();
      desired.get(stamp(item.id, item.property)).push(boundary && original ? structuredClone(original) : nativeKey(frame, value, prior?.LineType ?? 1, original, item.property));
    }
  }
  const tracks = [];
  for (const item of scope.values()) {
    const prior = nodes.get(item.id)[item.property], track = prior?.Keys ? prior : { LineType: 1, Keys: [] };
    let start = range[0], end = range[1];
    if (!full && track.LineType >= 2) {
      const keys = track.Keys.filter(k => k.Frame >= start && k.Frame <= end); start = keys[0].Frame; end = keys.at(-1).Frame;
    }
    const samples = desired.get(stamp(item.id, item.property)).filter(k => k.Frame >= start && k.Frame <= end);
    if (samples.every(key => {
      const original = sampleMovement(baseline, nodes.get(item.id), item.property, key.Frame, sequence);
      return item.property === 'Rotation' ? q(original).angleTo(q(key.Vector)) < 1e-6 : original.every((x, i) => Math.abs(x - key.Vector[i]) < 1e-6);
    })) continue;
    if (track.LineType === 0) throw new Error('Weight needs smooth keys. Choose Linear for the affected bone.');
    const required = new Set([activeStart, activeEnd, ...track.Keys.map(k => k.Frame)]);
    const fitted = fitTrack(track, samples, item.property, item.property === 'Rotation' ? .005 : length * .0007, required);
    const outside = track.Keys.filter(k => k.Frame < start || k.Frame > end).map(k => structuredClone(k));
    const interval = baseline.Sequences[sequence].Interval;
    if (!track.Keys.some(k => k.Frame >= interval[0] && k.Frame <= interval[1])) for (const frame of interval) if (frame < start || frame > end) outside.push(nativeKey(frame, sampleMovement(baseline, nodes.get(item.id), item.property, frame, sequence), track.LineType, null, item.property));
    // Validation uses the same writer as direct Movement posing.
    for (const key of fitted) prepareMovementPose(baseline, [{ ...item, value: key.Vector }], key.Frame, sequence, restrictions);
    tracks.push({ ...item, track: { ...structuredClone(track), Keys: [...outside, ...fitted].sort((a, b) => a.Frame - b.Frame) } });
  }
  return { tracks, keyCount: tracks.reduce((sum, item) => sum + item.track.Keys.filter(k => k.Frame >= range[0] && k.Frame <= range[1]).length, 0), massCount: analysis.massCount, automatic: analysis.automatic, mode, impact: Math.round(hit), phases: { ...phase, hit: Math.round(hit) } };
}

/** Install one complete authored result in EditorDocument.apply(['Nodes']). */
export function applyPoseWeight(model, result) {
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  for (const item of result.tracks) if (!nodes.has(item.id)) throw new Error('The Weight controller no longer exists.');
  for (const item of result.tracks) nodes.get(item.id)[item.property] = structuredClone(item.track);
  return result.tracks.length;
}
