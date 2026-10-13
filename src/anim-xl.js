import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from './animation.js';
import { suggestPoseRig } from './pose-ik.js';

// AnimXL: flavour for hand-keyed animations. The authored keys drive a target
// pose; springs on top add easing, overlap, settle and weight. The result is
// written back as ordinary keys for this sequence only.

export const ANIMXL_DEFAULTS = Object.freeze({
  ease: 0, overlap: 0, settle: 0, weight: 0, poses: 50, feet: true, anticipation: 0, exaggerate: 0, life: 0,
  heavy: 60, heavyIds: [], loose: 60, looseIds: [],
  steps: 0,
  thunk: 60, thunks: [],
  flinch: 60, flinches: [], flinchBehind: false,
  retime: {},
});

const SIM_HZ = 240, OUT_HZ = 30, MAX_ERR = 2, POSE_WINDOW = 140;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const isGlobal = (track, model) => Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0 && model.GlobalSequences?.[track.GlobalSeqId] > 0;
const asMap = value => value instanceof Map ? value : new Map(Object.entries(value || {}).map(([k, v]) => [Number(k), v]));

function logQ(q, out = new Vector3()) {
  let { x, y, z, w } = q;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.hypot(x, y, z);
  if (s < 1e-9) return out.set(0, 0, 0);
  const k = 2 * Math.atan2(s, w) / s;
  return out.set(x * k, y * k, z * k);
}
function expQ(v, out = new Quaternion()) {
  const a = v.length();
  if (a < 1e-9) return out.set(0, 0, 0, 1);
  const s = Math.sin(a / 2) / a;
  return out.set(v.x * s, v.y * s, v.z * s, Math.cos(a / 2));
}

/** Bones and helpers AnimXL may rewrite: rotation must be absent or a local
 * (non-global) keyed track, and the node must not be billboarded. */
export function animXLNodes(model) {
  const ids = new Set([...(model.Bones || []), ...(model.Helpers || [])].map(n => n.ObjectId));
  return allNodes(model).filter(node => {
    if (!ids.has(node.ObjectId) || (node.Flags || 0) & 120) return false;
    const r = node.Rotation;
    return r === undefined || r === null || (r.Keys && !isGlobal(r, model));
  });
}

/** The poses ease preserves. Hand-keyed animations use their key times.
 * Densely keyed (imported) animations use the moments where the whole body
 * slows to a stop, so ease does not stutter between frame-by-frame keys. */
export function animXLKeyTimes(model, sequenceIndex) {
  const seq = model.Sequences[sequenceIndex], [from, to] = Array.from(seq.Interval), nodes = animXLNodes(model);
  const times = new Set([from, to]);
  for (const node of nodes) for (const p of ['Rotation', 'Translation']) {
    const track = node[p];
    if (track?.Keys && !isGlobal(track, model)) for (const key of track.Keys) if (key.Frame >= from && key.Frame <= to) times.add(key.Frame);
  }
  const keys = [...times].sort((a, b) => a - b);
  const gaps = keys.slice(1).map((t, i) => t - keys[i]).sort((a, b) => a - b);
  if (keys.length < 6 || gaps[gaps.length >> 1] >= 90) return keys;
  const opts = { interval: seq.Interval, globalSequences: model.GlobalSequences || [], quaternion: true, fallback: [0, 0, 0, 1] };
  const frames = [];
  for (let t = from; t <= to; t += 1000 / 30) frames.push(Math.round(t));
  const poses = frames.map(t => nodes.map(node => node.Rotation?.Keys ? sampleTrack(node.Rotation, t, opts) : null));
  const speed = poses.slice(1).map((pose, i) => pose.reduce((sum, q, j) => {
    const p = poses[i][j];
    return q && p ? sum + 2 * Math.acos(Math.min(1, Math.abs(q[0] * p[0] + q[1] * p[1] + q[2] * p[2] + q[3] * p[3]))) : sum;
  }, 0));
  const peak = Math.max(...speed, 1e-9), found = [from];
  for (let i = 1; i < speed.length - 1; i++) {
    if (speed[i] <= speed[i - 1] && speed[i] <= speed[i + 1] && speed[i] < peak * 0.35 && frames[i] - found[found.length - 1] >= 120 && to - frames[i] >= 120) found.push(frames[i]);
  }
  const moments = [...found, to];
  moments.dense = true;
  return moments;
}

/** What AnimXL knows about the rig: the body that carries the weight, the
 * feet that land, and the spine/neck/head that react. Uses POSE's rig reading
 * and falls back to bone names. */
export function animXLRig(model, sequenceIndex = 0) {
  const nodes = animXLNodes(model), ids = new Set(nodes.map(n => n.ObjectId)), byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  let body = null, feet = [], legLength = 0, legs = [];
  const roles = new Map();
  try {
    const seq = model.Sequences?.[sequenceIndex], rig = suggestPoseRig(model, seq ? seq.Interval[0] : 0, sequenceIndex);
    for (const [id, role] of asMap(rig.roles)) roles.set(Number(id), role);
    body = rig.body ?? null;
    legs = (rig.chains || []).filter(chain => chain.kind === 'leg' && byId.has(chain.root) && byId.has(chain.middle) && byId.has(chain.end)).map(chain => ({ root: chain.root, middle: chain.middle, end: chain.end }));
    feet = legs.map(chain => chain.end).filter(id => byId.has(id));
    const pivot = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
    legLength = legs.length ? legs.reduce((sum, c) => sum + pivot(c.root).distanceTo(pivot(c.middle)) + pivot(c.middle).distanceTo(pivot(c.end)), 0) / legs.length : 0;
  } catch { /* unusual rigs fall back to names */ }
  for (const node of nodes) if (!roles.has(node.ObjectId)) {
    const name = node.Name || '';
    if (/chest|torso/i.test(name)) roles.set(node.ObjectId, 'Chest');
    else if (/spine|back|abdomen/i.test(name)) roles.set(node.ObjectId, 'Spine');
    else if (/neck/i.test(name)) roles.set(node.ObjectId, 'Neck');
    else if (/head/i.test(name)) roles.set(node.ObjectId, 'Head');
    else if (/pelvis|hip|body/i.test(name)) roles.set(node.ObjectId, 'Pelvis');
    else if (/foot|feet|toe|hoof/i.test(name)) roles.set(node.ObjectId, 'Foot');
  }
  if (body == null || !ids.has(body)) body = [...roles].find(([id, role]) => ['Pelvis', 'Body'].includes(role) && ids.has(id))?.[0] ?? null;
  if (body == null) {
    // The highest bone with a moving translation usually carries the body.
    const depth = node => { let d = 0, p = node.Parent; while (byId.has(p) && d < 64) { d++; p = byId.get(p).Parent; } return d; };
    body = nodes.filter(n => n.Translation?.Keys?.length > 1).sort((a, b) => depth(a) - depth(b))[0]?.ObjectId ?? null;
  }
  if (!feet.length) feet = [...roles].filter(([id, role]) => ['Foot', 'Hoof'].includes(role) && byId.has(id)).map(([id]) => id);
  const torso = [...roles].filter(([id, role]) => ['Chest', 'Spine', 'Neck', 'Head'].includes(role) && ids.has(id)).map(([id]) => id);
  return { body, feet, torso, legLength, legs };
}

/** Moments a foot touches down in this animation (source time, ms). */
export function animXLFootfalls(model, sequenceIndex, rig = animXLRig(model, sequenceIndex)) {
  const seq = model.Sequences?.[sequenceIndex];
  if (!seq || !rig.feet.length) return [];
  const [from, to] = Array.from(seq.Interval), byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  const frames = [];
  for (let t = from; t <= to; t += 1000 / 30) frames.push(Math.round(t));
  const heights = rig.feet.map(() => []), point = new Vector3();
  for (const frame of frames) {
    const matrices = sampleNodeMatrices(model, frame, sequenceIndex);
    rig.feet.forEach((id, k) => { point.fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(matrices.get(id)); heights[k].push(point.z); });
  }
  const falls = [], ground = Math.min(...heights.flat());
  for (const h of heights) {
    const lo = Math.min(...h), hi = Math.max(...h), range = hi - lo;
    // Only feet that reach the ground land: a rider's feet in stirrups do not.
    if (range < Math.max(1, rig.legLength * 0.04) || lo > ground + Math.max(4, rig.legLength * 0.25)) continue;
    let lifted = h[0] > lo + range * 0.4;
    for (let i = 1; i < h.length; i++) {
      if (lifted && h[i] < lo + range * 0.12) { falls.push(frames[i]); lifted = false; }
      else if (!lifted && h[i] > lo + range * 0.4) lifted = true;
    }
  }
  // Feet landing together (or a four-legged gait) make one thump, not several.
  const merged = [];
  for (const t of [...new Set(falls)].sort((a, b) => a - b)) if (!merged.length || t - merged[merged.length - 1] > 90) merged.push(t);
  return merged;
}

// Ease: within each pair of key poses, speed up from and slow into the poses.
function easeCurve(u, amount) {
  if (amount <= 0) return u;
  const a = 1 + 2.2 * amount, p = u ** a, q = (1 - u) ** a;
  return p / (p + q);
}

/** Where each pose happens after retiming. `settings.retime` maps an original
 * pose time to a new one; the first and last pose stay at the sequence ends
 * and poses keep their order. */
export function animXLRetimed(keys, settings) {
  const moved = settings.retime || {}, out = keys.map(k => Number.isFinite(moved[k]) ? moved[k] : k);
  out[0] = keys[0]; out[out.length - 1] = keys[keys.length - 1];
  for (let i = 1; i < out.length - 1; i++) out[i] = Math.round(clamp(out[i], out[i - 1] + 10, keys[keys.length - 1] - 10 * (out.length - 1 - i)));
  return out;
}

/** Output time -> source time. Retiming moves poses, ease shapes the spacing
 * between them, and a THUNK holds the pose for a beat then catches up, so the
 * sequence keeps its length. */
export function animXLTimeMap(keys, settings, outKeys = animXLRetimed(keys, settings)) {
  const wanted = lerp(40, 150, settings.thunk / 100), start = outKeys[0], end = outKeys[outKeys.length - 1];
  // Each hold catches up before the next pose, so no pose is skipped.
  const holds = [...(settings.thunks || [])].sort((a, b) => a - b).filter(at => at >= start && at < end).map(at => {
    const room = (outKeys.find(k => k > at) ?? end) - at, hold = Math.min(wanted, room / 3);
    return { at, hold, catchUp: Math.min(hold * 2.5, room - hold) };
  });
  return t => {
    for (const { at, hold, catchUp } of holds) {
      if (t >= at && t < at + hold) { t = at; break; }
      if (t >= at + hold && t < at + hold + catchUp) { t = at + (t - at - hold) * (hold + catchUp) / catchUp; break; }
    }
    t = clamp(t, start, end);
    let i = 0;
    while (i < outKeys.length - 2 && t >= outKeys[i + 1]) i++;
    const a = outKeys[i], b = outKeys[i + 1], span = b - a;
    return span > 0 ? keys[i] + (keys[i + 1] - keys[i]) * easeCurve((t - a) / span, settings.ease / 100) : keys[i];
  };
}

function springParams(settings, kind, depth) {
  const o = settings.overlap / 100, s = settings.settle / 100, w = settings.weight / 100;
  let f, z, follow = 1, pull = 0;
  if (kind === 'heavy') {
    const h = settings.heavy / 100;
    f = lerp(8, 1.3, h); z = lerp(0.8, 0.25, h); follow = lerp(0.9, 0.25, h); pull = lerp(0, 45, h);
  } else if (kind === 'loose') {
    const l = settings.loose / 100;
    // Chains of loose bones compound their swing, so each link stays fairly damped.
    f = lerp(7, 2, l) / (1 + 0.15 * depth); z = lerp(0.75, 0.3, l); follow = lerp(0.9, 0.5, l);
  } else {
    f = lerp(12, 2.6, o);
    if (s > 0) f = Math.min(f, lerp(12, 4.5, s));
    f /= 1 + 0.08 * depth;
    z = lerp(1, 0.18, s); follow = lerp(1, 0.5, o);
  }
  f *= lerp(1, 0.6, w);
  const om = 2 * Math.PI * f;
  return { k: om * om, c: 2 * z * om, follow, pull, limit: kind === 'loose' ? 1.1 : MAX_ERR };
}

/** Build the flavoured tracks. Returns only tracks that actually change. */
export function buildAnimXL(model, sequenceIndex, input = {}) {
  const settings = { ...ANIMXL_DEFAULTS, ...input };
  const seq = model.Sequences?.[sequenceIndex];
  if (!seq) throw new Error('Choose an animation first.');
  const [from, to] = Array.from(seq.Interval), duration = to - from;
  if (duration < 30) throw new Error('This animation is too short to shape.');
  const nodes = animXLNodes(model), byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  const keys = animXLKeyTimes(model, sequenceIndex), outKeys = animXLRetimed(keys, settings), timeMap = animXLTimeMap(keys, settings, outKeys);
  // Source time -> output time (ignoring ease), for events found in the authored animation.
  const toOutput = t => { let i = 0; while (i < keys.length - 2 && t >= keys[i + 1]) i++; const span = keys[i + 1] - keys[i]; return span > 0 ? outKeys[i] + (t - keys[i]) / span * (outKeys[i + 1] - outKeys[i]) : outKeys[i]; };
  const heavy = new Set(settings.heavyIds), loose = new Set(settings.looseIds);
  const from_ = settings.flinchBehind ? -1 : 1;
  const flinches = [...(settings.flinches || [])].map(f => typeof f === 'number' ? { at: f, dir: from_ } : { at: f.at, dir: f.dir ?? from_ }).sort((a, b) => a.at - b.at);
  const wantsBody = settings.weight > 0 || settings.steps > 0 || flinches.length > 0;
  const rig = wantsBody || settings.steps > 0 ? animXLRig(model, sequenceIndex) : { body: null, feet: [], torso: [], legLength: 0 };
  const footfalls = settings.steps > 0 ? animXLFootfalls(model, sequenceIndex, rig).map(t => Math.round(toOutput(t))) : [];
  const reactive = settings.steps > 0 || flinches.length > 0;
  const general = settings.overlap > 0 || settings.settle > 0 || settings.weight > 0 || reactive;
  function depthOf(node) { let d = 0, p = node.Parent; const seen = new Set(); while (byId.has(p) && !seen.has(p)) { seen.add(p); d++; p = byId.get(p).Parent; } return d; }
  const order = [...nodes].sort((a, b) => depthOf(a) - depthOf(b));
  const simIds = new Set(order.filter(n => heavy.has(n.ObjectId) || loose.has(n.ObjectId) || (general && byId.has(n.Parent) && !((n.Flags || 0) & 7))).map(n => n.ObjectId));
  const index = new Map(order.map((n, i) => [n.ObjectId, i]));
  const kinds = order.map(n => heavy.has(n.ObjectId) ? 'heavy' : loose.has(n.ObjectId) ? 'loose' : 'general');
  // Reactions need some give even with Overlap and Settle at zero.
  const springSettings = reactive ? { ...settings, overlap: Math.max(settings.overlap, 25), settle: Math.max(settings.settle, 25) } : settings;
  const params = order.map((n, i) => springParams(springSettings, kinds[i], depthOf(n)));
  const interval = seq.Interval, sampleOpts = { interval, globalSequences: model.GlobalSequences || [] };
  const rotOpts = { ...sampleOpts, quaternion: true, fallback: [0, 0, 0, 1] }, posOpts = { ...sampleOpts, fallback: [0, 0, 0] };
  const authored = (node, t, out = new Quaternion()) => {
    const v = node.Rotation ? sampleTrack(node.Rotation, t, rotOpts) : [0, 0, 0, 1];
    return out.set(v[0], v[1], v[2], v[3]).normalize();
  };
  // Exaggerate pushes every pose further from the bone's average pose.
  // Anticipation winds each bone up against its coming move at the start of a move.
  const exaggerate = settings.exaggerate / 100, anticipate = settings.anticipation / 100;
  const shaping = new Map();
  if (exaggerate > 0 || anticipate > 0) for (const node of nodes) {
    if (!node.Rotation?.Keys) continue;
    const poses = keys.map(k => authored(node, k));
    for (let i = 1; i < poses.length; i++) if (poses[i].dot(poses[i - 1]) < 0) poses[i].set(-poses[i].x, -poses[i].y, -poses[i].z, -poses[i].w);
    const sum = poses.reduce((acc, q) => acc.set(acc.x + q.x, acc.y + q.y, acc.z + q.z, acc.w + q.w), new Quaternion(0, 0, 0, 0));
    const mean = sum.lengthSq() > 1e-12 ? sum.normalize() : new Quaternion();
    const push = q => exaggerate > 0 ? mean.clone().multiply(expQ(logQ(mean.clone().invert().multiply(q)).multiplyScalar(1 + 0.6 * exaggerate))) : q;
    const pushed = poses.map(push);
    const moves = pushed.slice(1).map((q, i) => { const d = logQ(pushed[i].clone().invert().multiply(q)); return d.length() > 0.7 ? d.setLength(0.7) : d; });
    shaping.set(node.ObjectId, { mean, push, moves });
  }
  // Life: slow, small drifts so held poses breathe. Whole cycles fit the
  // animation, so looping animations stay seamless. Same result every time.
  const life = settings.life / 100, drift = new Map();
  if (life > 0) for (const node of nodes) {
    if (!byId.has(node.Parent) || (node.Flags || 0) & 7) continue;
    let seed = (node.ObjectId + 1) * 2654435761 % 4294967296;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const axis = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    const cycles = Math.max(1, Math.round(duration / 1000 * lerp(0.35, 0.8, rand())));
    drift.set(node.ObjectId, { axis, cycles, phase: rand() * 2 * Math.PI, amp: lerp(0.012, 0.045, life) * lerp(0.6, 1.2, rand()) });
  }
  const localTarget = (node, t, out = new Quaternion()) => {
    authored(node, t, out);
    const wobble = drift.get(node.ObjectId);
    if (wobble) out.multiply(expQ(wobble.axis.clone().multiplyScalar(wobble.amp * Math.sin(wobble.phase + 2 * Math.PI * wobble.cycles * (t - from) / duration))));
    const shape = shaping.get(node.ObjectId);
    if (!shape) return out;
    if (exaggerate > 0) out.copy(shape.push(out));
    if (anticipate > 0) {
      let i = 0;
      while (i < keys.length - 2 && t >= keys[i + 1]) i++;
      const span = keys[i + 1] - keys[i], u = span > 0 ? (t - keys[i]) / span : 1;
      if (u < 0.35 && span >= 120) out.multiply(expQ(shape.moves[i].clone().multiplyScalar(-0.3 * anticipate * Math.sin(Math.PI * u / 0.35) ** 2)));
    }
    return out;
  };
  // Parent world orientation for nodes outside the simulated set follows the authored pose.
  const outsideWorld = (id, t, cache) => {
    if (!byId.has(id)) return new Quaternion();
    if (cache.has(id)) return cache.get(id);
    const node = byId.get(id), parent = (node.Flags || 0) & 2 ? new Quaternion() : outsideWorld(node.Parent, t, cache);
    const v = node.Rotation?.Keys ? sampleTrack(node.Rotation, t, rotOpts) : [0, 0, 0, 1];
    const q = parent.clone().multiply(new Quaternion(v[0], v[1], v[2], v[3]).normalize());
    cache.set(id, q); return q;
  };

  const n = order.length, Q = Array.from({ length: n }, () => new Quaternion()), W = Array.from({ length: n }, () => new Vector3());
  const prevT = Array.from({ length: n }, () => new Quaternion()), started = new Uint8Array(n), local = Array.from({ length: n }, () => new Quaternion());
  const target = Array.from({ length: n }, () => new Quaternion()), authoredLocal = Array.from({ length: n }, () => new Quaternion());
  const err = new Vector3(), wT = new Vector3(), tmp = new Quaternion(), tmp2 = new Quaternion(), step = new Vector3();
  const dt = 1 / SIM_HZ, stepMs = 1000 / SIM_HZ;
  const thunks = [...(settings.thunks || [])].sort((a, b) => a - b), bounce = lerp(0.25, 0.75, settings.thunk / 100);
  const thunkTargets = new Set(heavy.size ? heavy : simIds);
  const poseAmount = settings.poses / 100;

  // Body translation: a spring that lags the authored path (Weight) and takes
  // the knocks of footfalls and flinches. Its parent's orientation turns world
  // pushes into the body's local space.
  const bodyNode = rig.body != null && byId.has(rig.body) && index.has(rig.body) && !isGlobal(byId.get(rig.body).Translation, model) && !Array.isArray(byId.get(rig.body).Translation) ? byId.get(rig.body) : null;
  const scale = Math.max(rig.legLength || 0, 20);
  const wB = settings.weight / 100, give = Math.max(wB, settings.steps > 0 ? 0.4 : 0, flinches.length ? 0.7 : 0);
  const fB = lerp(8, 2.4, give), zB = lerp(0.9, 0.35, Math.max(wB, settings.steps / 200, flinches.length ? 0.55 : 0)), followB = lerp(1, 0.25, wB);
  const kB = (2 * Math.PI * fB) ** 2, cB = 2 * zB * 2 * Math.PI * fB;
  const bodyP = new Vector3(), bodyV = new Vector3(), bodyPrev = new Vector3(), bodyT = new Vector3(), bodyTV = new Vector3();
  let bodyStarted = false;
  const bodyTarget = (t, out) => out.fromArray(bodyNode.Translation ? sampleTrack(bodyNode.Translation, t, posOpts) : [0, 0, 0]);
  const torsoIndices = rig.torso.map(id => index.get(id)).filter(i => i !== undefined && simIds.has(order[i].ObjectId));
  const kick = (worldAngular, linear) => {
    if (bodyNode) {
      const pi = index.get(bodyNode.Parent), parentWorld = pi !== undefined ? Q[pi] : new Quaternion();
      bodyV.add(linear.clone().applyQuaternion(parentWorld.clone().invert()));
    }
    torsoIndices.forEach((i, k) => W[i].addScaledVector(worldAngular, 1 + 0.35 * k));
  };

  const preroll = seq.NonLooping ? 0 : Math.min(duration, 3000);
  const outFrames = [];
  for (let k = 0; ; k++) { const f = Math.round(from + k * 1000 / OUT_HZ); if (f >= to) break; outFrames.push(f); }
  outFrames.push(to);
  const samples = new Map(order.map(nd => [nd.ObjectId, []])), bodySamples = [], srcFrames = [];
  let outIndex = 0, lastSimMs = -Infinity;
  const world = new Array(n);

  const advance = (tOut, record) => {
    const src = timeMap(tOut), cache = new Map();
    if (bodyNode) {
      bodyTarget(src, bodyT);
      if (!bodyStarted) { bodyP.copy(bodyT); bodyV.set(0, 0, 0); bodyPrev.copy(bodyT); bodyStarted = true; }
      bodyTV.copy(bodyT).sub(bodyPrev).multiplyScalar(1 / dt); bodyPrev.copy(bodyT);
      const acc = bodyT.clone().sub(bodyP).multiplyScalar(kB).addScaledVector(bodyTV, cB * followB).addScaledVector(bodyV, -cB);
      bodyV.addScaledVector(acc, dt); bodyP.addScaledVector(bodyV, dt);
    }
    // Hit poses: near each key pose, pull the result onto the authored pose.
    let poseBlend = 0;
    if (poseAmount > 0) for (const k of outKeys) poseBlend = Math.max(poseBlend, poseAmount * (1 - smooth(Math.abs(tOut - k) / POSE_WINDOW)));
    for (let i = 0; i < n; i++) {
      const node = order[i], pi = index.get(node.Parent);
      const parentWorld = (node.Flags || 0) & 2 ? new Quaternion() : pi !== undefined ? world[pi] : outsideWorld(node.Parent, src, cache);
      localTarget(node, src, authoredLocal[i]);
      target[i].copy(parentWorld).multiply(authoredLocal[i]);
      if (!simIds.has(node.ObjectId) || !started[i]) {
        Q[i].copy(target[i]); W[i].set(0, 0, 0); prevT[i].copy(target[i]); started[i] = 1;
      } else {
        const p = params[i];
        tmp.copy(target[i]).multiply(tmp2.copy(prevT[i]).invert()); logQ(tmp, wT).multiplyScalar(1 / dt);
        if (wT.length() > 60) wT.setLength(60);
        prevT[i].copy(target[i]);
        tmp.copy(target[i]).multiply(tmp2.copy(Q[i]).invert()); logQ(tmp, err);
        step.copy(err).multiplyScalar(p.k).addScaledVector(wT, p.c * p.follow).addScaledVector(W[i], -p.c);
        W[i].addScaledVector(step, dt);
        Q[i].premultiply(expQ(err.copy(W[i]).multiplyScalar(dt), tmp)).normalize();
        tmp.copy(target[i]).multiply(tmp2.copy(Q[i]).invert()); logQ(tmp, err);
        if (err.length() > p.limit) { Q[i].premultiply(expQ(err.setLength(err.length() - p.limit), tmp)).normalize(); W[i].copy(wT); }
        // A heavy part drags on whatever holds it.
        if (p.pull && pi !== undefined && simIds.has(order[pi].ObjectId)) { tmp.copy(Q[i]).multiply(tmp2.copy(target[i]).invert()); logQ(tmp, err); W[pi].addScaledVector(err, p.pull * dt); }
      }
      world[i] = Q[i];
      local[i].copy(parentWorld).invert().multiply(Q[i]);
      if (record && poseBlend > 0 && simIds.has(node.ObjectId)) local[i].slerp(authoredLocal[i], kinds[i] === 'general' ? poseBlend : poseBlend * 0.5);
    }
    if (record) {
      for (let i = 0; i < n; i++) samples.get(order[i].ObjectId).push(local[i].clone());
      if (bodyNode) bodySamples.push(poseBlend > 0 ? bodyP.clone().lerp(bodyT, poseBlend) : bodyP.clone());
      srcFrames.push(src);
    }
  };
  const events = (a, b) => {
    for (const at of thunks) if (at > a && at <= b) for (let i = 0; i < n; i++) if (thunkTargets.has(order[i].ObjectId) && simIds.has(order[i].ObjectId)) W[i].multiplyScalar(-bounce);
    // Footfalls: the body drops into the step and the chest and head nod forward.
    const s = settings.steps / 100;
    for (const at of footfalls) if (at > a && at <= b) kick(new Vector3(0, lerp(0.4, 3.2, s), 0), new Vector3(0, 0, -scale * lerp(0.5, 5, s)));
    // Flinch: knocked back from the front, torso snapping back.
    const f = settings.flinch / 100;
    for (const { at, dir } of flinches) if (at > a && at <= b) kick(new Vector3(0, -dir * lerp(2, 9, f), 0), new Vector3(-dir * scale * lerp(2, 10, f), 0, scale * lerp(0, 1.5, f)));
  };

  for (let ms = 0; ms < preroll; ms += stepMs) advance(from + ((ms + duration - preroll % duration) % duration), false);
  for (let ms = 0; outIndex < outFrames.length; ms += stepMs) {
    const t = from + ms;
    events(lastSimMs, t); lastSimMs = t;
    const record = t >= outFrames[outIndex] - stepMs / 2;
    advance(Math.min(t, to), record);
    if (record) outIndex++;
  }

  // Keep feet planted: legs are solved back onto the authored foot path.
  const legNodes = new Set((rig.legs || []).flatMap(leg => [leg.root, leg.middle, leg.end]));
  if (settings.feet !== false && rig.legs?.length && ([...legNodes].some(id => simIds.has(id)) || bodyNode)) plantFeet({ model, sequenceIndex, byId, legs: rig.legs, legLength: rig.legLength, samples, bodyNode, bodySamples, srcFrames, rotOpts, posOpts });

  const tracks = [];
  let keyCount = 0;
  for (const node of order) {
    const qs = samples.get(node.ObjectId);
    for (let i = 1; i < qs.length; i++) if (qs[i].dot(qs[i - 1]) < 0) qs[i].set(-qs[i].x, -qs[i].y, -qs[i].z, -qs[i].w);
    let changed = false;
    for (let i = 0; i < qs.length && !changed; i++) changed = qs[i].angleTo(authored(node, outFrames[i], tmp)) > 0.01;
    if (!changed) continue;
    // Smooth (squad) keys follow the curve with far fewer keys than straight
    // slerp. A linear track becomes Bezier; its other keys get flat tangents,
    // which interpolate exactly as before.
    const original = node.Rotation?.Keys ? node.Rotation : { LineType: 1, Keys: [] };
    const lineType = Math.max(2, original.LineType ?? 1) === 2 ? 2 : 3;
    const ours = reduceRotationSquad(outFrames, qs, settings.tolerance ?? 0.008);
    const outside = original.Keys.filter(key => key.Frame < from || key.Frame > to).map(key => {
      const copy = structuredClone(key);
      if (!copy.InTan) { copy.InTan = new Float32Array(copy.Vector); copy.OutTan = new Float32Array(copy.Vector); }
      return copy;
    });
    tracks.push({ id: node.ObjectId, property: 'Rotation', track: { ...structuredClone({ ...original, Keys: [] }), LineType: lineType, Keys: [...outside, ...ours].sort((a, b) => a.Frame - b.Frame) } });
    keyCount += ours.length;
  }
  if (bodyNode && bodySamples.length === outFrames.length) {
    const original = bodyNode.Translation?.Keys ? bodyNode.Translation : { LineType: 1, Keys: [] };
    const authored = outFrames.map(f => bodyTarget(f, new Vector3()));
    const tolerance = Math.max(0.05, scale * 0.004);
    if (bodySamples.some((p, i) => p.distanceTo(authored[i]) > tolerance)) {
      const lineType = original.LineType ?? 1;
      const kept = reducePoints(outFrames, bodySamples, tolerance);
      const ours = kept.map(i => {
        const v = new Float32Array(bodySamples[i].toArray()), key = { Frame: outFrames[i], Vector: v };
        if (lineType === 3) { key.InTan = new Float32Array(v); key.OutTan = new Float32Array(v); }
        else if (lineType === 2) { key.InTan = new Float32Array(3); key.OutTan = new Float32Array(3); }
        return key;
      });
      tracks.push({ id: bodyNode.ObjectId, property: 'Translation', track: mergeTrack(original, ours, lineType, from, to) });
      keyCount += ours.length;
    }
  }
  // Ease, retiming and THUNK holds move keyed translations in step with the rotations.
  const retimed = settings.ease > 0 || thunks.length > 0 || outKeys.some((t, i) => t !== keys[i]);
  if (retimed) for (const node of nodes) {
    const track = node.Translation;
    if (tracks.some(t => t.id === node.ObjectId && t.property === 'Translation')) continue;
    if (!track?.Keys || isGlobal(track, model) || !track.Keys.some(k => k.Frame >= from && k.Frame <= to)) continue;
    const at = f => new Vector3().fromArray(sampleTrack(track, f, posOpts));
    const moved = outFrames.map(f => at(timeMap(f))), tolerance = Math.max(0.02, scale * 0.002);
    if (!moved.some((p, i) => p.distanceTo(at(outFrames[i])) > tolerance)) continue;
    const lineType = track.LineType ?? 1;
    const ours = reducePoints(outFrames, moved, tolerance).map(i => {
      const v = new Float32Array(moved[i].toArray()), key = { Frame: outFrames[i], Vector: v };
      if (lineType === 3) { key.InTan = new Float32Array(v); key.OutTan = new Float32Array(v); }
      else if (lineType === 2) { key.InTan = new Float32Array(3); key.OutTan = new Float32Array(3); }
      return key;
    });
    tracks.push({ id: node.ObjectId, property: 'Translation', track: mergeTrack(track, ours, lineType, from, to) });
    keyCount += ours.length;
  }
  return { tracks, keyCount, keyTimes: outKeys, sourceKeyTimes: keys, dense: !!keys.dense, footfalls, nodes: simIds.size, rig: { body: bodyNode?.ObjectId ?? null, feet: rig.feet } };
}

// World matrices from local rotations, translations and scaling, with pivots,
// matching the editor's own node sampling.
function worldMatrices(model, byId, rotation, translation, scaling) {
  const out = new Map(), visiting = new Set();
  const resolve = id => {
    if (out.has(id)) return out.get(id);
    const node = byId.get(id);
    if (!node || visiting.has(id)) return new Matrix4();
    visiting.add(id);
    const t = translation(node), r = rotation(node), sc = scaling(node);
    const pivot = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
    const m = new Matrix4().compose(t, r, sc), rotated = pivot.clone().applyMatrix4(m).sub(t);
    m.setPosition(t.clone().add(pivot).sub(rotated));
    if (node.Parent != null && byId.has(node.Parent)) {
      let parent = resolve(node.Parent);
      if (node.Flags & 7) {
        const p = new Vector3(), q = new Quaternion(), s = new Vector3();
        parent.decompose(p, q, s);
        if (node.Flags & 1) p.set(0, 0, 0);
        if (node.Flags & 2) q.identity();
        if (node.Flags & 4) s.set(1, 1, 1);
        parent = new Matrix4().compose(p, q, s);
      }
      m.premultiply(parent);
    }
    visiting.delete(id); out.set(id, m); return m;
  };
  for (const id of byId.keys()) resolve(id);
  return out;
}

/** Two-bone IK per leg, per recorded frame: the ankle goes back to where the
 * authored animation puts it (knee stays in its current bend plane) and the foot
 * keeps its authored orientation. Legs that never reach the ground (a rider's)
 * are left alone. Updates `samples` in place. */
function plantFeet({ model, sequenceIndex, byId, legs, legLength, samples, bodyNode, bodySamples, srcFrames, rotOpts, posOpts }) {
  const pivotOf = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
  const position = (matrices, id) => pivotOf(id).applyMatrix4(matrices.get(id));
  const rotationOf = (matrices, id) => { const p = new Vector3(), q = new Quaternion(), s = new Vector3(); matrices.get(id)?.decompose(p, q, s); return q; };
  const authored = srcFrames.map(src => sampleNodeMatrices(model, Math.round(src), sequenceIndex));
  const usable = legs.filter(leg => [leg.root, leg.middle, leg.end].every(id => samples.has(id)));
  if (!usable.length) return;
  const heights = usable.map(leg => authored.map(m => position(m, leg.end).z)), ground = Math.min(...heights.flat());
  const planted = usable.filter((leg, i) => Math.min(...heights[i]) <= ground + Math.max(4, legLength * 0.25));
  const sampleVec = (track, t, fallback) => new Vector3().fromArray(track ? sampleTrack(track, t, { ...posOpts, fallback }) : fallback);
  const descendsFrom = (id, ancestor) => { for (let p = id, guard = 0; byId.has(p) && guard < 64; p = byId.get(p).Parent, guard++) if (p === ancestor) return true; return false; };
  for (let k = 0; k < srcFrames.length; k++) {
    const src = srcFrames[k];
    const shaped = worldMatrices(model, byId,
      node => samples.get(node.ObjectId)?.[k] || new Quaternion().fromArray(node.Rotation ? sampleTrack(node.Rotation, src, rotOpts) : [0, 0, 0, 1]).normalize(),
      node => node === bodyNode && bodySamples[k] ? bodySamples[k].clone() : sampleVec(node.Translation, src, [0, 0, 0]),
      node => sampleVec(node.Scaling, src, [1, 1, 1]));
    for (const leg of planted) {
      const R = position(shaped, leg.root), M = position(shaped, leg.middle), E = position(shaped, leg.end), T = position(authored[k], leg.end);
      if (E.distanceTo(T) < 0.01) continue;
      const a = R.distanceTo(M), b = M.distanceTo(E);
      if (a < 1e-4 || b < 1e-4) continue;
      const toT = T.clone().sub(R), d = clamp(toT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3), dir = toT.normalize();
      const pole = M.clone().sub(R); pole.addScaledVector(dir, -pole.dot(dir));
      if (pole.lengthSq() < 1e-8) continue;
      pole.normalize();
      const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
      const newM = R.clone().addScaledVector(dir, x).addScaledVector(pole, h), newE = R.clone().addScaledVector(dir, d);
      const q1 = new Quaternion().setFromUnitVectors(M.clone().sub(R).normalize(), newM.clone().sub(R).normalize());
      const q2 = new Quaternion().setFromUnitVectors(E.clone().sub(M).applyQuaternion(q1).normalize(), newE.clone().sub(newM).normalize());
      const rootWorld = q1.clone().multiply(rotationOf(shaped, leg.root)), midWorld = q2.clone().multiply(q1).multiply(rotationOf(shaped, leg.middle));
      const newParentWorld = id => {
        const old = rotationOf(shaped, id);
        if (id === leg.middle || descendsFrom(id, leg.middle)) return q2.clone().multiply(q1).multiply(old);
        if (id === leg.root || descendsFrom(id, leg.root)) return q1.clone().multiply(old);
        return old;
      };
      const rootNode = byId.get(leg.root), midNode = byId.get(leg.middle), endNode = byId.get(leg.end);
      samples.get(leg.root)[k] = rotationOf(shaped, rootNode.Parent).invert().multiply(rootWorld).normalize();
      samples.get(leg.middle)[k] = newParentWorld(midNode.Parent).invert().multiply(midWorld).normalize();
      samples.get(leg.end)[k] = newParentWorld(endNode.Parent).invert().multiply(rotationOf(authored[k], leg.end)).normalize();
    }
  }
}
// Our keys replace this sequence's keys; every other sequence keeps its own.
function mergeTrack(original, ours, lineType, from, to) {
  const outside = original.Keys.filter(key => key.Frame < from || key.Frame > to).map(key => structuredClone(key));
  return { ...structuredClone({ ...original, Keys: [] }), LineType: lineType, Keys: [...outside, ...ours].sort((a, b) => a.Frame - b.Frame) };
}

// war3 squad: slerp(slerp(a, d, t), slerp(b, c, t), 2t(1 - t)).
function squad(a, outTan, inTan, b, t, out = new Quaternion()) {
  const p = new Quaternion().slerpQuaternions(a, b, t), q = new Quaternion().slerpQuaternions(outTan, inTan, t);
  return out.slerpQuaternions(p, q, 2 * t * (1 - t));
}
// Classic squad control point for key i between its kept neighbours.
function squadTangent(prev, q, next) {
  const inv = q.clone().invert(), a = logQ(inv.clone().multiply(next)), b = logQ(inv.clone().multiply(prev));
  return q.clone().multiply(expQ(a.add(b).multiplyScalar(-0.25))).normalize();
}
/** Fewest smooth keys whose squad curve stays within tolerance (radians). */
function reduceRotationSquad(frames, qs, tolerance) {
  const kept = [0, qs.length - 1], probe = new Quaternion();
  // End keys keep a flat tangent so the curve starts and ends on its pose.
  const tangents = () => kept.map((i, k) => k === 0 || k === kept.length - 1 ? qs[i].clone() : squadTangent(qs[kept[k - 1]], qs[i], qs[kept[k + 1]]));
  for (let guard = 0; guard < qs.length; guard++) {
    const tan = tangents();
    let worst = tolerance, at = -1;
    for (let k = 0; k + 1 < kept.length; k++) {
      const a = kept[k], b = kept[k + 1];
      for (let i = a + 1; i < b; i++) {
        const e = squad(qs[a], tan[k], tan[k + 1], qs[b], (frames[i] - frames[a]) / (frames[b] - frames[a]), probe).angleTo(qs[i]);
        if (e > worst) { worst = e; at = i; }
      }
    }
    if (at < 0) break;
    kept.push(at); kept.sort((x, y) => x - y);
  }
  const tan = tangents();
  return kept.map((i, k) => {
    const v = new Float32Array(qs[i].toArray()), t = new Float32Array(tan[k].toArray());
    return { Frame: frames[i], Vector: v, InTan: t, OutTan: new Float32Array(t) };
  });
}

// Keep the fewest keys whose straight slerp stays within tolerance (radians).
function reduceRotation(frames, qs, tolerance) {
  const keep = new Set([0, qs.length - 1]), stack = [[0, qs.length - 1]], probe = new Quaternion();
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = tolerance, at = -1;
    for (let i = a + 1; i < b; i++) {
      probe.slerpQuaternions(qs[a], qs[b], (frames[i] - frames[a]) / (frames[b] - frames[a]));
      const e = probe.angleTo(qs[i]);
      if (e > worst) { worst = e; at = i; }
    }
    if (at >= 0) { keep.add(at); stack.push([a, at], [at, b]); }
  }
  return [...keep].sort((x, y) => x - y);
}
function reducePoints(frames, ps, tolerance) {
  const keep = new Set([0, ps.length - 1]), stack = [[0, ps.length - 1]], probe = new Vector3();
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = tolerance, at = -1;
    for (let i = a + 1; i < b; i++) {
      const e = probe.lerpVectors(ps[a], ps[b], (frames[i] - frames[a]) / (frames[b] - frames[a])).distanceTo(ps[i]);
      if (e > worst) { worst = e; at = i; }
    }
    if (at >= 0) { keep.add(at); stack.push([a, at], [at, b]); }
  }
  return [...keep].sort((x, y) => x - y);
}

/** Commit: one EditorDocument transaction over ['Nodes']. */
export function applyAnimXL(model, result) {
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  for (const item of result.tracks) {
    const node = byId.get(item.id);
    if (!node) throw new Error('A bone changed while AnimXL was open. Close it and try again.');
    node[item.property] = structuredClone(item.track);
  }
  return result.tracks.length;
}

/** Name-based first guess for heavy (weapon) and loose (cloth, hair) bones. */
export function suggestAnimXLBones(model) {
  const heavyIds = [], looseIds = [], nodes = animXLNodes(model), ids = new Set(nodes.map(n => n.ObjectId));
  // Hands, limbs and mounts are never "the weapon", even when named after it ("Sword Hand").
  const bodyPart = /hand|arm|finger|wrist|toe|foot|leg|wolf|horse|boar|mount|mesh|death/i;
  for (const node of nodes) {
    const name = node.Name || '';
    if (/weapon|sword|axe|hammer|blade|mace|staff|spear|club|flail|choppa|glaive|halberd|scythe/i.test(name) && !bodyPart.test(name)) heavyIds.push(node.ObjectId);
    else if (/cape|cloak|hair|tail|plume|ribbon|cloth|banner|skirt|robe|chain|beard|tabard/i.test(name)) looseIds.push(node.ObjectId);
  }
  // A "Weapon Ref" attachment names the weapon bone even when the bone itself has a generic name.
  for (const attachment of model.Attachments || []) {
    if (!/weapon/i.test(attachment.Name || '')) continue;
    const parent = nodes.find(n => n.ObjectId === attachment.Parent);
    if (parent && ids.has(parent.ObjectId) && !bodyPart.test(parent.Name || '') && !heavyIds.includes(parent.ObjectId) && !looseIds.includes(parent.ObjectId)) heavyIds.push(parent.ObjectId);
  }
  return { heavyIds, looseIds };
}
