import { Quaternion, Vector3 } from 'three';
import { ModelRenderer } from 'war3-model';
import { allNodes, sampleGeosetAnimation } from './animation.js';
import { applyMovementPose, prepareMovementPose, sampleMovement } from './movement.js';
import { posePreviewModel, poseChainIds, createPoseSample, samplePoseChain, solvePoseLimb, solvePoseNode, poseNodeControl, poseRole, suggestPoseBody } from './pose-ik.js';
import { preparePoseMotionStep, samplePoseMotionStep } from './pose-motion-step.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const Q = value => new Quaternion().fromArray(value).normalize();
const V = value => new Vector3().fromArray(value);
const stamp = (id, property) => `${id}:${property}`;
const defaults = { Rotation: [0, 0, 0, 1], Translation: [0, 0, 0] };
const radiansToDegrees = 180 / Math.PI;

// Use the same raw quaternion interpolation as native playback. Classic MDX
// quaternions are often rounded and are deliberately not normalized here.
// This renderer owns no drawable nodes, emitters, textures or GPU resources.
function nativeMotionSampler(model, sequence) {
  const renderer = new ModelRenderer({ Nodes: [], Geosets: [], GeosetAnims: [], Materials: [], ParticleEmitters2: [], RibbonEmitters: [], GlobalSequences: [], Sequences: [model.Sequences[sequence]] });
  const rotation = new Float32Array(4), translation = new Float32Array(3);
  const track = (controller, property, frame) => {
    renderer.setFrame(frame);
    if (!controller?.Keys) return controller == null ? defaults[property] : Array.from(controller);
    const local = { ...controller, GlobalSeqId: null };
    const value = property === 'Rotation' ? renderer.interp.quat(rotation, local) : renderer.interp.vec3(translation, local);
    return value ? Array.from(value) : defaults[property];
  };
  return { track, sample: (node, property, frame) => track(node[property], property, frame), destroy: () => renderer.destroy() };
}

function log(rotation) {
  const q = rotation.clone().normalize();
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const s = Math.hypot(q.x, q.y, q.z);
  return s < 1e-10 ? new Vector3() : new Vector3(q.x, q.y, q.z).multiplyScalar(2 * Math.atan2(s, q.w) / s);
}
function exp(vector) {
  const angle = vector.length();
  return angle < 1e-10 ? new Quaternion() : new Quaternion().setFromAxisAngle(vector.clone().divideScalar(angle), angle);
}
const difference = (a, b, property) => property === 'Rotation' ? Q(a).angleTo(Q(b)) : V(a).distanceTo(V(b));

// Native squad does not normalize rounded MDX quaternions. Its control
// magnitudes therefore shape the curve as well as the control orientations.
function fitNativeMagnitudes(track, keys, desired, left, right, native) {
  const directions = [Array.from(keys[0].OutTan), Array.from(keys[1].InTan)];
  const targets = [];
  let cursor = left;
  for (let i = 1; i < 8; i++) {
    const frame = keys[0].Frame + (keys[1].Frame - keys[0].Frame) * i / 8;
    while (cursor < right - 1 && desired[cursor + 1].Frame < frame) cursor++;
    const a = desired[cursor], b = desired[cursor + 1], u = (frame - a.Frame) / (b.Frame - a.Frame);
    targets.push({ frame, magnitude: Math.hypot(...a.Vector) * (1 - u) + Math.hypot(...b.Vector) * u });
  }
  if (targets.every(point => Math.abs(point.magnitude - 1) < 1e-6)) return;
  const candidate = { ...track, Keys: keys };
  const residual = scales => {
    keys[0].OutTan = new Float32Array(directions[0].map(value => value * scales[0]));
    keys[1].InTan = new Float32Array(directions[1].map(value => value * scales[1]));
    return targets.map(point => Math.hypot(...native.track(candidate, 'Rotation', point.frame)) - point.magnitude);
  };
  let scales = keys.map(key => Math.hypot(...key.Vector)), errors = residual(scales);
  const cost = values => values.reduce((sum, value) => sum + value * value, 0);
  for (let iteration = 0; iteration < 8 && cost(errors) > 1e-12; iteration++) {
    const h = .001;
    const columns = scales.map((_, axis) => {
      const changed = [...scales]; changed[axis] += h;
      return residual(changed).map((value, i) => (value - errors[i]) / h);
    });
    const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    const aa = dot(columns[0], columns[0]) + 1e-10, bb = dot(columns[1], columns[1]) + 1e-10, ab = dot(columns[0], columns[1]);
    const ax = dot(columns[0], errors), bx = dot(columns[1], errors), determinant = aa * bb - ab * ab;
    if (determinant < 1e-16) break;
    const delta = [(bb * ax - ab * bx) / determinant, (aa * bx - ab * ax) / determinant].map(value => clamp(value, -.1, .1));
    let improved = false;
    for (const amount of [1, .5, .25, .125]) {
      const next = scales.map((value, i) => clamp(value - delta[i] * amount, .1, 2)), trial = residual(next);
      if (cost(trial) < cost(errors)) { scales = next; errors = trial; improved = true; break; }
    }
    if (!improved) break;
  }
  residual(scales);
}

function ancestry(nodes, id) {
  const path = [];
  while (nodes.has(id) && !path.includes(id)) { path.push(id); id = nodes.get(id).Parent; }
  return path;
}

function visibleSkeleton(model, nodes, sequence, range) {
  if (!model.Geosets?.length) return new Set(nodes.keys());
  const visible = new Set(), times = Array.from({ length: 9 }, (_, i) => range[0] + (range[1] - range[0]) * i / 8);
  for (const [index, geo] of model.Geosets.entries()) {
    if (!times.some(frame => sampleGeosetAnimation(model, index, frame, sequence).alpha > .05)) continue;
    const ids = new Set();
    if (geo.SkinWeights?.length === geo.Vertices.length / 3 * 8) {
      for (let i = 0; i < geo.SkinWeights.length; i += 8) for (let j = 0; j < 4; j++) if (geo.SkinWeights[i + 4 + j]) ids.add(geo.SkinWeights[i + j]);
    } else for (const vertex of new Set(geo.Faces || Array.from({ length: geo.Vertices.length / 3 }, (_, i) => i))) for (const id of geo.Groups?.[geo.VertexGroup?.[vertex]] || []) ids.add(id);
    for (const id of ids) for (const ancestor of ancestry(nodes, id)) visible.add(ancestor);
  }
  return visible;
}

function sampleAnchors(baseline, config, sequence, anchors, channels) {
  const nodes = new Map(allNodes(baseline).map(node => [node.ObjectId, node]));
  const validated = new WeakMap(), samples = anchors.map(frame => createPoseSample(baseline, frame, sequence, frame, validated));
  return {
    values: anchors.map(frame => new Map(channels.map(item => [stamp(item.id, item.property), sampleMovement(baseline, nodes.get(item.id), item.property, frame, sequence)]))),
    chains: (config.chains || []).map(chain => ({ chain, poses: anchors.map((frame, index) => samplePoseChain(baseline, chain, frame, sequence, frame, samples[index])) })),
  };
}

// Keep broad geometric events; decorative key density does not define poses.
// This is a bounded trajectory simplification, not action recognition.
function suggestAnchors(baseline, config, sequence, range, candidates, length) {
  const nodes = new Map(allNodes(baseline).map(node => [node.ObjectId, node])), duration = range[1] - range[0];
  const times = [...new Set([...candidates, ...Array.from({ length: 81 }, (_, i) => Math.round(range[0] + duration * i / 80))])].sort((a, b) => a - b);
  const validated = new WeakMap();
  const samples = times.map(frame => {
    const sample = createPoseSample(baseline, frame, sequence, frame, validated), matrices = sample.matrices, rootNode = nodes.get(config.body);
    const root = rootNode ? V(rootNode.PivotPoint || baseline.PivotPoints[config.body]).applyMatrix4(matrices.get(config.body)) : new Vector3();
    const feature = root.clone().divideScalar(length).toArray();
    for (const chain of config.chains || []) {
      const pose = samplePoseChain(baseline, chain, frame, sequence, frame, sample);
      feature.push(...pose.end.clone().sub(root).divideScalar(length).toArray());
      if (chain.kind === 'arm') for (const axis of [[1, 0, 0], [0, 0, 1]]) feature.push(...V(axis).applyQuaternion(pose.rotations[2]).multiplyScalar(.18).toArray());
    }
    for (const id of config.nodes || []) if (['Chest', 'Spine', 'Pelvis', 'Body'].includes(poseRole(baseline, config, id))) feature.push(...log(Q(sampleMovement(baseline, nodes.get(id), 'Rotation', frame, sequence))).multiplyScalar(.2).toArray());
    return { frame, feature };
  });
  const kept = [0, samples.length - 1], minimumGap = duration * .08;
  while (kept.length < 8) {
    kept.sort((a, b) => a - b); let best = -1, error = .025;
    for (let k = 1; k < kept.length; k++) {
      const left = samples[kept[k - 1]], right = samples[kept[k]];
      for (let i = kept[k - 1] + 1; i < kept[k]; i++) {
        const sample = samples[i];
        if (sample.frame - left.frame < minimumGap || right.frame - sample.frame < minimumGap) continue;
        const u = (sample.frame - left.frame) / (right.frame - left.frame);
        const delta = Math.sqrt(sample.feature.reduce((sum, value, j) => sum + (value - left.feature[j] - (right.feature[j] - left.feature[j]) * u) ** 2, 0) / Math.max(1, (config.chains || []).length));
        if (delta > error) { error = delta; best = i; }
      }
    }
    if (best < 0) break;
    kept.push(best);
  }
  return kept.map(index => samples[index].frame).sort((a, b) => a - b);
}

function suggestedImpact(anchors, chains, driverKey, values, channels, length) {
  const driver = chains.find(item => item.chain.key === driverKey);
  let impact = anchors.at(-1), largest = -1;
  for (let i = 1; i < anchors.length - 1; i++) {
    let score;
    if (driver) {
      const a = driver.poses[i - 1], b = driver.poses[i];
      const path = b.end.clone().sub(b.root).sub(a.end.clone().sub(a.root));
      score = path.length() + b.rotations[2].angleTo(a.rotations[2]) * length * .28;
      score *= 1 + .4 * clamp(-path.z / length);
    } else score = channels.reduce((sum, item) => sum + difference(values[i - 1].get(stamp(item.id, item.property)), values[i].get(stamp(item.id, item.property)), item.property) / (item.property === 'Rotation' ? 1 : length), 0);
    if (score > largest) { largest = score; impact = anchors[i]; }
  }
  return impact;
}

function nativeKey(frame, value, type) {
  const key = { Frame: frame, Vector: new Float32Array(value) };
  if (type >= 2) {
    key.InTan = new Float32Array(value.length === 4 || type === 3 ? value : [0, 0, 0]);
    key.OutTan = new Float32Array(key.InTan);
  }
  return key;
}

/** Detach native controllers once. Generated motion never reads another clip
 * as a reference and never alters geometry, pivots, bindings or model scale. */
export function preparePoseMotion(model, config, sequence, range) {
  const interval = model.Sequences?.[sequence]?.Interval;
  range ||= interval && Array.from(interval);
  if (!interval || !range || range.length !== 2 || range.some(t => !Number.isInteger(t)) || range[0] < interval[0] || range[1] > interval[1] || range[1] - range[0] < 20) throw new Error('Choose an animation, or a longer part of its timeline.');
  const baseline = posePreviewModel(model);
  const nodes = new Map(allNodes(baseline).map(node => [node.ObjectId, node]));
  for (const node of nodes.values()) for (const property of ['Rotation', 'Translation', 'Scaling']) if (node[property] !== undefined) node[property] = structuredClone(node[property]);
  const visible = visibleSkeleton(baseline, nodes, sequence, range);
  config = { ...structuredClone(config), chains: (config.chains || []).filter(chain => poseChainIds(chain).some(id => visible.has(id))), nodes: (config.nodes || []).filter(id => visible.has(id)) };
  const ids = new Set([...(model.Bones || []), ...(model.Helpers || [])].map(node => node.ObjectId).filter(id => visible.has(id)));
  for (const id of [config.body, ...(config.nodes || []), ...(config.chains || []).flatMap(poseChainIds)]) if (nodes.has(id)) ids.add(id);
  const times = new Set(range), channels = [];
  for (const id of ids) for (const property of ['Rotation', 'Translation']) {
    const track = nodes.get(id)?.[property];
    if (!track?.Keys || Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) continue;
    const keys = track.Keys.filter(key => key.Frame >= range[0] && key.Frame <= range[1]);
    if (!keys.length) continue;
    for (const key of keys) times.add(key.Frame);
    channels.push({ id, property });
  }
  const allKeyFrames = [...times].sort((a, b) => a - b);
  let anchors = allKeyFrames, { values, chains } = sampleAnchors(baseline, config, sequence, anchors, channels);
  let length = Math.max(1, ...chains.map(item => item.poses[0].lengths.reduce((a, b) => a + b, 0)));
  const motion = channels.reduce((sum, item) => sum + values.slice(1).reduce((total, pose, index) => total + difference(values[index].get(stamp(item.id, item.property)), pose.get(stamp(item.id, item.property)), item.property) / (item.property === 'Rotation' ? 1 : length), 0), 0);
  if (anchors.length < 2 || motion < 1e-6) throw new Error('Create two different poses in this animation first.');
  // Sparse input keeps every supplied pose. Dense input selects a few broad
  // poses and retains the detailed source motion through shared retiming.
  const movingChannels = channels.map(item => {
    const key = stamp(item.id, item.property), extent = Math.max(...values.map(pose => difference(values[0].get(key), pose.get(key), item.property)));
    const threshold = item.property === 'Rotation' ? .015 : length * .003;
    return { ...item, weight: extent <= threshold ? 0 : Math.min(1, extent / (item.property === 'Rotation' ? .5 : length * .1)) };
  }).filter(item => item.weight);
  const totalWeight = movingChannels.reduce((sum, item) => sum + item.weight, 0);
  const movingTimes = anchors.filter(frame => movingChannels.some(item => nodes.get(item.id)[item.property].Keys.some(key => key.Frame === frame)));
  const coherentColumns = movingTimes.filter(frame => movingChannels.reduce((sum, item) => sum + (nodes.get(item.id)[item.property].Keys.some(key => key.Frame === frame) ? item.weight : 0), 0) >= totalWeight * .5).length;
  const sparse = anchors.length <= 5 || anchors.length <= 14 && coherentColumns >= movingTimes.length * .7;
  const armCandidates = chains.filter(item => item.chain.kind === 'arm');
  const candidates = armCandidates.length ? armCandidates : chains;
  const energy = item => item.poses.slice(1).reduce((sum, pose, i) => sum + pose.end.clone().sub(pose.root).distanceTo(item.poses[i].end.clone().sub(item.poses[i].root)) + pose.rotations[2].angleTo(item.poses[i].rotations[2]) * length * .2, 0);
  const driver = candidates.slice().sort((a, b) => energy(b) - energy(a))[0] || null;
  let body = config.body;
  if (driver) {
    const parents = ancestry(nodes, nodes.get(driver.chain.root)?.Parent);
    const carryingLegs = parents.filter(id => chains.some(item => item.chain.kind === 'leg' && ancestry(nodes, item.chain.root).includes(id)));
    body = carryingLegs.find(id => ['Body', 'Pelvis'].includes(poseRole(baseline, config, id))) ?? parents.find(id => ['Body', 'Pelvis'].includes(poseRole(baseline, config, id))) ?? body;
  }
  config.body = body;
  const branchChains = chains.filter(item => ancestry(nodes, item.chain.root).includes(body));
  if (branchChains.length) length = Math.max(1, ...branchChains.map(item => item.poses[0].lengths.reduce((a, b) => a + b, 0)));
  if (!sparse) { anchors = suggestAnchors(baseline, config, sequence, range, allKeyFrames, length); ({ values, chains } = sampleAnchors(baseline, config, sequence, anchors, channels)); }
  const impact = suggestedImpact(anchors, chains, driver?.chain.key, values, channels, length);
  let torso = body;
  if (driver) {
    let node = nodes.get(nodes.get(driver.chain.root)?.Parent);
    while (node) {
      if (['Chest', 'Spine'].includes(poseRole(baseline, config, node.ObjectId))) { torso = node.ObjectId; break; }
      node = nodes.get(node.Parent);
    }
  }
  const loop = !baseline.Sequences[sequence].NonLooping && channels.every(item => difference(values[0].get(stamp(item.id, item.property)), values.at(-1).get(stamp(item.id, item.property)), item.property) < (item.property === 'Rotation' ? .0001 : length * .0001));
  return { baseline, config, sequence, range: [...range], anchors, allKeyFrames, channels, values, chains, length, sparse, driver: driver?.chain.key ?? null, body, torso, impact, loop };
}

/** One phase for the complete pose. No ancestor/child time offsets. */
export function poseMotionProgress(u, style, timing, beforeHit) {
  if (u <= 0 || u >= 1) return clamp(u);
  if (style === 'swing') return beforeHit ? u ** (1 + 2.6 * timing) : u + (smooth(u) ** (1 + .65 * timing) - u) * timing;
  return u + (smooth(u) - u) * timing;
}

function segmentFor(anchors, frame) {
  let index = 0;
  while (index < anchors.length - 2 && frame >= anchors[index + 1]) index++;
  return index;
}

// Native interpolation, including Warcraft quaternion squad, remains the
// authority for key reduction. Required poses cannot be removed by fitting.
function fitTrack(track, desired, property, tolerance, required, native) {
  const chosen = new Set([0, desired.length - 1]);
  desired.forEach((key, i) => { if (required.has(key.Frame)) chosen.add(i); });
  const velocity = index => {
    const left = Math.max(0, index - 1), right = Math.min(desired.length - 1, index + 1), dt = desired[right].Frame - desired[left].Frame;
    if (!dt) return new Vector3();
    if (property !== 'Rotation') return V(desired[right].Vector).sub(V(desired[left].Vector)).divideScalar(dt);
    const reference = Q(desired[index].Vector).invert();
    return log(reference.clone().multiply(Q(desired[right].Vector))).sub(log(reference.multiply(Q(desired[left].Vector)))).divideScalar(dt);
  };
  const segment = (left, right) => {
    const a = structuredClone(desired[left]), b = structuredClone(desired[right]), dt = b.Frame - a.Frame;
    if (track.LineType >= 2) {
      if (property === 'Rotation') {
        const delta = log(Q(a.Vector).invert().multiply(Q(b.Vector)));
        a.OutTan = new Float32Array(Q(a.Vector).multiply(exp(velocity(left).multiplyScalar(dt).sub(delta).multiplyScalar(.5))).toArray());
        b.InTan = new Float32Array(Q(b.Vector).multiply(exp(delta.sub(velocity(right).multiplyScalar(dt)).multiplyScalar(.5))).toArray());
        fitNativeMagnitudes(track, [a, b], desired, left, right, native);
      } else {
        const out = velocity(left).multiplyScalar(dt), incoming = velocity(right).multiplyScalar(dt);
        a.OutTan = new Float32Array(track.LineType === 2 ? out.toArray() : out.divideScalar(3).add(V(a.Vector)).toArray());
        b.InTan = new Float32Array(track.LineType === 2 ? incoming.toArray() : incoming.multiplyScalar(-1 / 3).add(V(b.Vector)).toArray());
      }
    }
    return [a, b];
  };
  const sorted = [...chosen].sort((a, b) => a - b), pending = sorted.slice(1).map((right, i) => [sorted[i], right]);
  const magnitudeError = (candidate, left, right) => {
    let worst = 0;
    for (let i = left; i < right; i++) for (const u of [.25, .5, .75, 1]) {
      const a = desired[i], b = desired[i + 1], frame = a.Frame + (b.Frame - a.Frame) * u;
      const expected = Math.hypot(...a.Vector) * (1 - u) + Math.hypot(...b.Vector) * u;
      worst = Math.max(worst, Math.abs(Math.hypot(...native.track(candidate, property, frame)) - expected));
    }
    return worst;
  };
  while (pending.length) {
    const [left, right] = pending.pop();
    if (right - left < 2) continue;
    const candidate = { ...track, Keys: segment(left, right) };
    let worst = tolerance, split = -1, magnitude = tolerance / 16, magnitudeSplit = -1;
    for (let i = left + 1; i < right; i++) {
      const value = native.track(candidate, property, desired[i].Frame);
      const error = difference(value, desired[i].Vector, property);
      if (error > worst) { worst = error; split = i; }
      if (property === 'Rotation' && track.LineType >= 2) {
        const error = Math.abs(Math.hypot(...value) - Math.hypot(...desired[i].Vector));
        if (error > magnitude) { magnitude = error; magnitudeSplit = i; }
      }
    }
    if (split < 0 && magnitudeSplit >= 0) {
      const first = { ...track, Keys: segment(left, magnitudeSplit) }, second = { ...track, Keys: segment(magnitudeSplit, right) };
      // Raw nonunit slerp is not subdivision-invariant. A new key can lower
      // error at sampled timestamps while increasing it between them. Only
      // accept a magnitude-only split when native fractional samples improve.
      if (Math.max(magnitudeError(first, left, magnitudeSplit), magnitudeError(second, magnitudeSplit, right)) < magnitudeError(candidate, left, right) * .9) split = magnitudeSplit;
    }
    if (split >= 0) { chosen.add(split); pending.push([left, split], [split, right]); }
  }
  const kept = [...chosen].sort((a, b) => a - b), keys = kept.map(i => structuredClone(desired[i]));
  if (track.LineType >= 2) for (let i = 1; i < kept.length; i++) {
    const [a, b] = segment(kept[i - 1], kept[i]); keys[i - 1].OutTan = a.OutTan; keys[i].InTan = b.InTan;
  }
  return keys;
}

export function buildPoseMotion(analysis, settings = {}, restrictions = {}) {
  const { baseline, sequence, range, channels, sparse } = analysis;
  let { config, length } = analysis;
  let { anchors, values, chains } = analysis;
  const style = settings.style ?? 'swing';
  if (!['flow', 'swing', 'step'].includes(style)) throw new Error('Choose Flow, Swing or Step.');
  const nodes = new Map(allNodes(baseline).map(node => [node.ObjectId, node]));
  let bodyId = analysis.body, torsoId = analysis.torso, driverKey = analysis.driver;
  if (style === 'flow') {
    const energy = item => item.poses.slice(1).reduce((sum, pose, i) => sum + pose.end.clone().sub(pose.root).distanceTo(item.poses[i].end.clone().sub(item.poses[i].root)) + pose.rotations[2].angleTo(item.poses[i].rotations[2]) * length * .2, 0);
    const active = chains.slice().sort((a, b) => energy(b) - energy(a))[0];
    if (active) {
      driverKey = active.chain.key;
      const parents = ancestry(nodes, nodes.get(active.chain.root)?.Parent);
      const carryingLegs = parents.filter(id => chains.some(item => item.chain.kind === 'leg' && ancestry(nodes, item.chain.root).includes(id)));
      bodyId = carryingLegs.find(id => ['Body', 'Pelvis'].includes(poseRole(baseline, config, id))) ?? parents.find(id => ['Body', 'Pelvis'].includes(poseRole(baseline, config, id))) ?? bodyId;
      torsoId = parents.find(id => ['Chest', 'Spine'].includes(poseRole(baseline, config, id))) ?? bodyId;
      config = { ...config, body: bodyId };
    }
  }
  if (style === 'step') {
    const legs = chains.filter(item => item.chain.kind === 'leg');
    if (legs.length) {
      const low = Math.min(...legs.flatMap(item => item.poses.map(pose => pose.end.z)));
      const groundLegs = legs.filter(item => Math.min(...item.poses.map(pose => pose.end.z)) < low + item.poses[0].lengths.reduce((a, b) => a + b, 0) * .4);
      bodyId = suggestPoseBody(baseline, groundLegs.map(item => item.chain));
      torsoId = bodyId;
      chains = groundLegs;
      config = { ...config, body: bodyId, chains: chains.map(item => item.chain) };
      length = Math.max(1, ...chains.map(item => item.poses[0].lengths.reduce((a, b) => a + b, 0)));
      if (!sparse && settings.anchors == null) anchors = suggestAnchors(baseline, config, sequence, range, analysis.allKeyFrames, length);
    }
  } else {
    const actor = chains.filter(item => ancestry(nodes, item.chain.root).includes(bodyId));
    if (actor.length) { chains = actor; config = { ...config, chains: actor.map(item => item.chain) }; }
  }
  const numeric = [settings.timing ?? 65, settings.follow ?? 35, settings.body ?? 35].map(Number);
  if (numeric.some(value => !Number.isFinite(value) || value < 0 || value > 100)) throw new Error('Use settings from 0 to 100.');
  const [timing, requestedFollow, bodyAmount] = numeric.map(value => value / 100), follow = style === 'flow' ? 0 : requestedFollow;
  const contacts = settings.contacts !== false;
  if (settings.anchors != null) {
    if (!Array.isArray(settings.anchors) || settings.anchors.some(frame => !Number.isInteger(frame) || frame < range[0] || frame > range[1])) throw new Error('Key poses must be whole milliseconds inside the animation.');
    anchors = [...new Set([...range, ...settings.anchors])].sort((a, b) => a - b);
  }
  const requestedHit = style !== 'swing' ? null : settings.hit == null ? analysis.impact : Number(settings.hit);
  if (requestedHit != null && (!Number.isInteger(requestedHit) || requestedHit < range[0] || requestedHit > range[1])) throw new Error('Choose a hit inside this animation.');
  // An explicit hit is itself a preserved source pose, even between old keys.
  const impact = requestedHit;
  if (impact != null && !anchors.includes(impact)) anchors = [...anchors, impact].sort((a, b) => a - b);
  if (anchors !== analysis.anchors) ({ values, chains } = sampleAnchors(baseline, config, sequence, anchors, channels));
  if (!timing && !follow && !bodyAmount) return { tracks: [], keyCount: 0, anchors: [...anchors], allKeyFrames: analysis.allKeyFrames, impact, sparse };
  const step = style === 'step' ? preparePoseMotionStep({ model: baseline, chains, anchors, sequence, groundHeight: Number(settings.ground ?? 0), preservePath: !sparse }) : null;
  if (step && !step.available) throw new Error(step.reason);
  const native = nativeMotionSampler(baseline, sequence);
  // Scratch poses only evaluate this local animation. Keep its controllers
  // detached and small; the full baseline still owns sampling, final native
  // validation, and exact retention of every other animation's keys.
  const scratch = posePreviewModel(baseline), interval = baseline.Sequences[sequence].Interval;
  for (const node of allNodes(scratch)) for (const property of ['Rotation', 'Translation', 'Scaling']) {
    const track = node[property];
    if (track?.Keys && !(Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0)) node[property] = { ...track, Keys: track.Keys.filter(key => key.Frame >= interval[0] && key.Frame <= interval[1]) };
  }
  const duration = range[1] - range[0], required = new Set(anchors), full = range[0] === baseline.Sequences[sequence].Interval[0] && range[1] === baseline.Sequences[sequence].Interval[1];
  const frames = new Set(anchors);
  for (const frame of analysis.allKeyFrames) frames.add(frame);
  for (let i = 0; i <= Math.min(180, duration); i++) frames.add(Math.round(range[0] + duration * i / Math.min(180, duration)));
  // Narrow intervals still get enough samples to represent their smooth path.
  for (let i = 1; i < anchors.length; i++) for (let j = 1; j < 12; j++) frames.add(Math.round(anchors[i - 1] + (anchors[i] - anchors[i - 1]) * j / 12));
  const ordered = [...frames].sort((a, b) => a - b), scope = new Map(channels.map(item => [stamp(item.id, item.property), item]));
  const desired = new Map(), driver = chains.find(item => item.chain.key === driverKey);
  for (const frame of ordered) {
    const index = segmentFor(anchors, frame), from = anchors[index], to = anchors[index + 1], span = to - from;
    const u = (frame - from) / span, anchor = required.has(frame), significant = span >= duration * .075;
    const amount = significant ? timing : 0;
    const transitionStyle = style === 'swing' && to < impact ? 'flow' : style;
    const progress = poseMotionProgress(u, transitionStyle, amount, to === impact), source = from + progress * span;
    const changed = posePreviewModel(scratch), changedNodes = new Map(allNodes(changed).map(node => [node.ObjectId, node]));
    const changes = [];
    const pulse = significant && !anchor ? Math.sin(Math.PI * u) ** 2 : 0;
    const afterHit = from === impact && index > 0;
    const continuation = style === 'swing' && afterHit && significant && u < .44 ? Math.sin(Math.PI * u / .44) ** 2 * follow * .16 : 0;
    for (const item of channels) {
      const node = nodes.get(item.id), key = stamp(item.id, item.property);
      let value = native.sample(node, item.property, source);
      if (!anchor && item.property === 'Rotation') {
        let rotation = Q(value);
        // Wind-up is a coordinated extrapolation of the incoming pose change,
        // not different delays for shoulder, elbow and hand.
        if (style === 'swing' && to === impact && significant) {
          const delta = log(Q(values[index].get(key)).invert().multiply(Q(values[index + 1].get(key))));
          rotation.multiply(exp(delta.multiplyScalar(-timing * .14 * pulse * (1 - u) ** 2)));
        }
        if (continuation) {
          const previous = log(Q(values[index - 1].get(key)).invert().multiply(Q(values[index].get(key)))).clampLength(0, 1.4);
          rotation.multiply(exp(previous.multiplyScalar(continuation)));
        }
        value = rotation.toArray();
      }
      if (!anchor) changes.push({ ...item, value });
    }
    if (changes.length) applyMovementPose(changed, changes, frame, sequence, restrictions);
    // Task-space contacts correct sparse FK interpolation as well as generated
    // body movement. A walk-in-place stance is not guessed from absolute speed.
    const stepPoses = step && !anchor && significant ? createPoseSample(changed, frame, sequence) : null;
    const stepFrame = stepPoses ? samplePoseMotionStep(step, { index, u, progress, timing, follow, body: bodyAmount, contacts, poses: new Map(chains.map(item => [item.chain.key, samplePoseChain(changed, item.chain, frame, sequence, frame, stepPoses)])) }) : null;
    const pins = !step && contacts && significant ? chains.filter(item => {
      if (item.chain.kind !== 'leg') return false;
      const a = item.poses[index], b = item.poses[index + 1], limbLength = a.lengths.reduce((x, y) => x + y, 0);
      return a.end.distanceTo(b.end) < limbLength * .035 && a.rotations[2].angleTo(b.rotations[2]) < .12;
    }).map(item => ({ chain: item.chain, pinned: true, position: item.poses[index].end.clone().lerp(item.poses[index + 1].end, progress), orientation: item.poses[index].rotations[2].clone().slerp(item.poses[index + 1].rotations[2], progress).toArray() })) : [];
    const bodyStrength = step ? 0 : style === 'flow' || sparse || to === impact || from === impact ? bodyAmount : 0;
    const preserveHands = !anchor && bodyStrength && significant ? chains.filter(item => item.chain.kind === 'arm').map(item => ({ chain: item.chain, pose: samplePoseChain(changed, item.chain, frame, sequence) })) : [];
    const bodyPins = [...pins, ...(stepFrame?.feet || []).map(foot => ({ ...foot, pinned: true })), ...preserveHands.map(hand => ({ chain: hand.chain, pinned: true, position: hand.pose.end, orientation: hand.pose.rotations[2].toArray() }))];
    const collect = result => {
      applyMovementPose(changed, result.changes, frame, sequence, restrictions);
      for (const item of result.changes) scope.set(stamp(item.id, item.property), { id: item.id, property: item.property });
    };
    if (stepFrame) {
      // Reach the foot paths first using the normal limb solver. Its reachable
      // endpoints then constrain body settling, so an ambitious lift/plant
      // does not create an impossible pin before the body has moved.
      for (const foot of stepFrame.feet) collect(solvePoseLimb(changed, foot.chain, frame, sequence, foot.position, { orientation: foot.orientation, restrictions }));
      const sample = createPoseSample(changed, frame, sequence);
      bodyPins.length = 0;
      for (const foot of stepFrame.feet) {
        const pose = samplePoseChain(changed, foot.chain, frame, sequence, frame, sample);
        bodyPins.push({ chain: foot.chain, pinned: true, position: pose.end, orientation: pose.rotations.at(-1).toArray() });
      }
    }
    if (!anchor && significant && bodyId != null && nodes.has(bodyId) && (bodyStrength || pins.length || stepFrame?.displacement.lengthSq())) {
      let displacement = stepFrame?.displacement.clone() || new Vector3();
      if (bodyStrength && driver) {
        const a = driver.poses[index], b = driver.poses[index + 1];
        const travel = b.end.clone().sub(b.root).sub(a.end.clone().sub(a.root));
        const action = Math.min(1, travel.length() / Math.max(length * .35, 1e-5));
        const direction = travel.clone(); direction.z = 0;
        if (direction.lengthSq() > 1e-8) direction.normalize();
        const lead = style === 'swing' && to <= impact ? -1 + 2 * smooth(u) : 1;
        displacement.copy(direction).multiplyScalar(length * .035 * bodyStrength * pulse * action * lead);
        displacement.z -= length * .023 * bodyStrength * pulse * action;
      }
      collect(solvePoseNode(changed, bodyId, bodyPins, frame, sequence, { mode: 'move', space: 'world', values: displacement.toArray(), restrictions, control: poseNodeControl(changed, config, { kind: 'body' }, 'move') }));
      if (bodyStrength && driver && torsoId != null && torsoId !== bodyId) {
        const a = driver.poses[index], b = driver.poses[index + 1];
        const axis = a.end.clone().sub(a.root).cross(b.end.clone().sub(b.root));
        if (axis.lengthSq() > 1e-8) {
          axis.normalize().multiplyScalar(.13 * bodyStrength * pulse * radiansToDegrees * (to <= impact ? 1 - 2 * u : -.35));
          collect(solvePoseNode(changed, torsoId, bodyPins, frame, sequence, { mode: 'rotate', space: 'world', values: axis.toArray(), restrictions, control: poseNodeControl(changed, config, { kind: 'node', id: torsoId }, 'rotate') }));
        }
      }
      // The body contributes without moving the intended weapon path or guard.
      for (const hand of preserveHands) collect(solvePoseLimb(changed, hand.chain, frame, sequence, hand.pose.end, { orientation: hand.pose.rotations[2].toArray() }));
    }
    for (const [key, item] of scope) {
      if (!desired.has(key)) desired.set(key, new Map());
      const node = anchor ? nodes.get(item.id) : changedNodes.get(item.id);
      let value = anchor ? native.sample(node, item.property, frame) : sampleMovement(changed, node, item.property, frame, sequence);
      if (!anchor && item.property === 'Rotation') {
        // IK changes orientation using unit quaternions. Retain the source
        // controller's smoothly sampled magnitude so a rounded native pose
        // does not acquire a one-frame normalization seam at a kept anchor.
        const magnitude = Math.hypot(...native.sample(nodes.get(item.id), item.property, source));
        value = Q(value).toArray().map(component => component * magnitude);
      }
      desired.get(key).set(frame, value);
    }
  }
  const tracks = [];
  for (const [key, item] of scope) {
    const node = nodes.get(item.id), prior = node[item.property], track = prior?.Keys ? prior : { LineType: 1, Keys: [] };
    const samples = ordered.map(frame => nativeKey(frame, desired.get(key)?.get(frame) || native.sample(node, item.property, frame), track.LineType));
    if (samples.every(sample => difference(sample.Vector, native.sample(node, item.property, sample.Frame), item.property) < 1e-6)) continue;
    if (track.LineType === 0) throw new Error('Motion needs smooth keys. Choose Linear for the affected bone.');
    if (!full && track.LineType >= 2 && range.some(frame => !track.Keys.some(key => key.Frame === frame))) throw new Error('Include curved keys at both ends, or use the whole animation.');
    const fitted = fitTrack(track, samples, item.property, item.property === 'Rotation' ? .004 : length * .0004, required, native);
    const outside = track.Keys.filter(key => key.Frame < range[0] || key.Frame > range[1]).map(key => structuredClone(key));
    // Native search approaches the first duplicate from the left, but selects
    // the last at the exact timestamp and to its right. Keep that authored
    // boundary distinction for clips adjoining the edited range.
    const boundaryDuplicates = range.flatMap(frame => track.Keys.filter(key => key.Frame === frame).slice(0, -1).map(key => structuredClone(key)));
    // Kept poses already contain the unchanged native sample. Validate their
    // existing editor value so duplicate boundary keys do not look like an
    // attempted edit to a shared timestamp in the generic POSE writer.
    for (const keyframe of fitted) prepareMovementPose(baseline, [{ ...item, value: required.has(keyframe.Frame) ? sampleMovement(baseline, node, item.property, keyframe.Frame, sequence) : keyframe.Vector }], keyframe.Frame, sequence, restrictions);
    // Keep exact authored values, including rounded classic quaternions.
    for (const keyframe of fitted) if (required.has(keyframe.Frame)) {
      const authored = track.Keys.findLast(key => key.Frame === keyframe.Frame);
      if (authored) keyframe.Vector = new Float32Array(authored.Vector);
      if ([range[0], range[1]].includes(keyframe.Frame) && authored) {
        if (keyframe.Frame === range[0] && authored.InTan) keyframe.InTan = new Float32Array(authored.InTan);
        if (keyframe.Frame === range[1] && authored.OutTan) keyframe.OutTan = new Float32Array(authored.OutTan);
      }
    }
    const interval = baseline.Sequences[sequence].Interval;
    if (!track.Keys.some(key => key.Frame >= interval[0] && key.Frame <= interval[1])) for (const frame of interval) if (frame < range[0] || frame > range[1]) outside.push(nativeKey(frame, sampleMovement(baseline, node, item.property, frame, sequence), track.LineType));
    tracks.push({ ...item, track: { ...structuredClone(track), Keys: [...outside, ...boundaryDuplicates, ...fitted].sort((a, b) => a.Frame - b.Frame) } });
  }
  native.destroy();
  return { tracks, keyCount: tracks.reduce((sum, item) => sum + item.track.Keys.filter(key => key.Frame >= range[0] && key.Frame <= range[1]).length, 0), anchors: [...anchors], allKeyFrames: analysis.allKeyFrames, impact, sparse, loop: analysis.loop, style, body: bodyId };
}

/** Commit in one EditorDocument.apply(['Nodes']) transaction. */
export function applyPoseMotion(model, result) {
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  for (const item of result.tracks) if (!nodes.has(item.id)) throw new Error('A Motion controller no longer exists.');
  for (const item of result.tracks) nodes.get(item.id)[item.property] = structuredClone(item.track);
  return result.tracks.length;
}
