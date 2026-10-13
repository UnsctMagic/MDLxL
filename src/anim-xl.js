import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleTrack } from './animation.js';

// AnimXL: flavour for hand-keyed animations. The authored keys drive a target
// pose; springs on top add easing, overlap, settle and weight. The result is
// written back as ordinary keys for this sequence only.

export const ANIMXL_DEFAULTS = Object.freeze({
  ease: 0, overlap: 0, settle: 0, weight: 0,
  heavy: 60, heavyIds: [], loose: 60, looseIds: [],
  thunk: 60, thunks: [],
});

const SIM_HZ = 240, OUT_HZ = 30, MAX_ERR = 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, u) => a + (b - a) * u;
const isGlobal = (track, model) => Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0 && model.GlobalSequences?.[track.GlobalSeqId] > 0;

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

/** Authored key times inside the sequence; these are the poses ease preserves. */
export function animXLKeyTimes(model, sequenceIndex) {
  const [from, to] = model.Sequences[sequenceIndex].Interval;
  const times = new Set([from, to]);
  for (const node of animXLNodes(model)) for (const p of ['Rotation', 'Translation']) {
    const track = node[p];
    if (track?.Keys && !isGlobal(track, model)) for (const key of track.Keys) if (key.Frame >= from && key.Frame <= to) times.add(key.Frame);
  }
  return [...times].sort((a, b) => a - b);
}

// Ease: within each pair of key poses, speed up from and slow into the poses.
function easeCurve(u, amount) {
  if (amount <= 0) return u;
  const a = 1 + 2.2 * amount, p = u ** a, q = (1 - u) ** a;
  return p / (p + q);
}

/** Output time -> source time. THUNK holds the pose for a beat, then catches
 * up, so the sequence keeps its length. */
export function animXLTimeMap(keys, settings) {
  const wanted = lerp(40, 150, settings.thunk / 100), end = keys[keys.length - 1];
  // Each hold catches up before the next key pose, so no pose is skipped.
  const holds = [...(settings.thunks || [])].sort((a, b) => a - b).filter(at => at >= keys[0] && at < end).map(at => {
    const room = (keys.find(k => k > at) ?? end) - at, hold = Math.min(wanted, room / 3);
    return { at, hold, catchUp: Math.min(hold * 2.5, room - hold) };
  });
  return t => {
    for (const { at, hold, catchUp } of holds) {
      if (t >= at && t < at + hold) { t = at; break; }
      if (t >= at + hold && t < at + hold + catchUp) { t = at + (t - at - hold) * (hold + catchUp) / catchUp; break; }
    }
    t = clamp(t, keys[0], end);
    let i = 0;
    while (i < keys.length - 2 && t >= keys[i + 1]) i++;
    const a = keys[i], b = keys[i + 1], span = b - a;
    return span > 0 ? a + span * easeCurve((t - a) / span, settings.ease / 100) : a;
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
    f = lerp(6, 1, l); z = lerp(0.6, 0.1, l); follow = lerp(0.85, 0.3, l);
  } else {
    f = lerp(12, 2.6, o);
    if (s > 0) f = Math.min(f, lerp(12, 4.5, s));
    f /= 1 + 0.08 * depth;
    z = lerp(1, 0.18, s); follow = lerp(1, 0.5, o);
  }
  f *= lerp(1, 0.6, w);
  const om = 2 * Math.PI * f;
  return { k: om * om, c: 2 * z * om, follow, pull };
}

/** Build the flavoured tracks. Returns only tracks that actually change. */
export function buildAnimXL(model, sequenceIndex, input = {}) {
  const settings = { ...ANIMXL_DEFAULTS, ...input };
  const seq = model.Sequences?.[sequenceIndex];
  if (!seq) throw new Error('Choose an animation first.');
  const [from, to] = Array.from(seq.Interval), duration = to - from;
  if (duration < 30) throw new Error('This animation is too short to shape.');
  const nodes = animXLNodes(model), byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  const keys = animXLKeyTimes(model, sequenceIndex), timeMap = animXLTimeMap(keys, settings);
  const heavy = new Set(settings.heavyIds), loose = new Set(settings.looseIds);
  const general = settings.overlap > 0 || settings.settle > 0 || settings.weight > 0;
  const order = [...nodes].sort((a, b) => depthOf(a) - depthOf(b));
  function depthOf(node) { let d = 0, p = node.Parent; const seen = new Set(); while (byId.has(p) && !seen.has(p)) { seen.add(p); d++; p = byId.get(p).Parent; } return d; }
  const simIds = new Set(order.filter(n => heavy.has(n.ObjectId) || loose.has(n.ObjectId) || (general && byId.has(n.Parent) && !((n.Flags || 0) & 7))).map(n => n.ObjectId));
  const index = new Map(order.map((n, i) => [n.ObjectId, i]));
  const params = order.map(n => springParams(settings, heavy.has(n.ObjectId) ? 'heavy' : loose.has(n.ObjectId) ? 'loose' : 'general', depthOf(n)));
  const interval = seq.Interval, sampleOpts = { interval, globalSequences: model.GlobalSequences || [], quaternion: true };
  const localTarget = (node, t) => {
    const r = node.Rotation;
    const v = r ? sampleTrack(r, t, { ...sampleOpts, fallback: [0, 0, 0, 1] }) : [0, 0, 0, 1];
    return new Quaternion(v[0], v[1], v[2], v[3]).normalize();
  };
  // Parent world orientation for nodes outside the simulated set follows the authored pose.
  const outsideWorld = (id, t, cache) => {
    if (!byId.has(id)) return new Quaternion();
    if (cache.has(id)) return cache.get(id);
    const node = byId.get(id), parent = (node.Flags || 0) & 2 ? new Quaternion() : outsideWorld(node.Parent, t, cache);
    const r = node.Rotation, v = r?.Keys ? sampleTrack(r, t, { ...sampleOpts, fallback: [0, 0, 0, 1] }) : [0, 0, 0, 1];
    const q = parent.clone().multiply(new Quaternion(v[0], v[1], v[2], v[3]).normalize());
    cache.set(id, q); return q;
  };

  const n = order.length, Q = Array.from({ length: n }, () => new Quaternion()), W = Array.from({ length: n }, () => new Vector3());
  const prevT = Array.from({ length: n }, () => new Quaternion()), started = new Uint8Array(n), local = Array.from({ length: n }, () => new Quaternion());
  const err = new Vector3(), wT = new Vector3(), tmp = new Quaternion(), tmp2 = new Quaternion(), step = new Vector3();
  const dt = 1 / SIM_HZ, stepMs = 1000 / SIM_HZ;
  const thunks = [...(settings.thunks || [])].sort((a, b) => a - b), bounce = lerp(0.25, 0.75, settings.thunk / 100);
  const thunkTargets = new Set(heavy.size ? heavy : simIds);
  // Looping animations pre-roll one cycle so the springs loop seamlessly.
  const preroll = seq.NonLooping ? 0 : Math.min(duration, 3000);
  const outFrames = [];
  for (let k = 0; ; k++) { const f = Math.round(from + k * 1000 / OUT_HZ); if (f >= to) break; outFrames.push(f); }
  outFrames.push(to);
  const samples = new Map(order.map(nd => [nd.ObjectId, []]));
  let outIndex = 0, lastSimMs = -Infinity;

  const world = new Array(n);
  const advance = (tOut, record) => {
    const src = timeMap(tOut), cache = new Map();
    for (let i = 0; i < n; i++) {
      const node = order[i], pi = index.get(node.Parent);
      const parentWorld = (node.Flags || 0) & 2 ? new Quaternion() : pi !== undefined ? world[pi] : outsideWorld(node.Parent, src, cache);
      const target = parentWorld.clone().multiply(localTarget(node, src));
      if (!simIds.has(node.ObjectId) || !started[i]) {
        Q[i].copy(target); W[i].set(0, 0, 0); prevT[i].copy(target); started[i] = 1;
      } else {
        const p = params[i];
        tmp.copy(target).multiply(tmp2.copy(prevT[i]).invert()); logQ(tmp, wT).multiplyScalar(1 / dt);
        if (wT.length() > 60) wT.setLength(60);
        prevT[i].copy(target);
        tmp.copy(target).multiply(tmp2.copy(Q[i]).invert()); logQ(tmp, err);
        step.copy(err).multiplyScalar(p.k).addScaledVector(wT, p.c * p.follow).addScaledVector(W[i], -p.c);
        W[i].addScaledVector(step, dt);
        Q[i].premultiply(expQ(err.copy(W[i]).multiplyScalar(dt), tmp)).normalize();
        tmp.copy(target).multiply(tmp2.copy(Q[i]).invert()); logQ(tmp, err);
        if (err.length() > MAX_ERR) { Q[i].premultiply(expQ(err.setLength(err.length() - MAX_ERR), tmp)).normalize(); W[i].copy(wT); }
        // A heavy part drags on whatever holds it.
        if (p.pull && pi !== undefined && simIds.has(order[pi].ObjectId)) { tmp.copy(Q[i]).multiply(tmp2.copy(target).invert()); logQ(tmp, err); W[pi].addScaledVector(err, p.pull * dt); }
      }
      world[i] = Q[i];
      local[i].copy(parentWorld).invert().multiply(Q[i]);
    }
    if (record) for (let i = 0; i < n; i++) samples.get(order[i].ObjectId).push(local[i].clone());
  };
  const thunkCheck = (a, b) => { for (const at of thunks) if (at > a && at <= b) for (let i = 0; i < n; i++) if (thunkTargets.has(order[i].ObjectId) && simIds.has(order[i].ObjectId)) W[i].multiplyScalar(-bounce); };

  for (let ms = 0; ms < preroll; ms += stepMs) advance(from + ((ms + duration - preroll % duration) % duration), false);
  for (let ms = 0; outIndex < outFrames.length; ms += stepMs) {
    const t = from + ms;
    thunkCheck(lastSimMs, t); lastSimMs = t;
    const record = t >= outFrames[outIndex] - stepMs / 2;
    advance(Math.min(t, to), record);
    if (record) outIndex++;
  }

  const tracks = [];
  let keyCount = 0;
  for (const node of order) {
    const qs = samples.get(node.ObjectId);
    for (let i = 1; i < qs.length; i++) if (qs[i].dot(qs[i - 1]) < 0) qs[i].set(-qs[i].x, -qs[i].y, -qs[i].z, -qs[i].w);
    let changed = false;
    for (let i = 0; i < qs.length && !changed; i++) {
      const o = node.Rotation ? sampleTrack(node.Rotation, outFrames[i], { ...sampleOpts, fallback: [0, 0, 0, 1] }) : [0, 0, 0, 1];
      changed = qs[i].angleTo(new Quaternion(o[0], o[1], o[2], o[3]).normalize()) > 0.003;
    }
    if (!changed) continue;
    const kept = reduceRotation(outFrames, qs, 0.0035);
    const original = node.Rotation?.Keys ? node.Rotation : { LineType: 1, Keys: [] };
    const lineType = original.LineType ?? 1;
    const ours = kept.map(i => {
      const v = new Float32Array(qs[i].toArray());
      const key = { Frame: outFrames[i], Vector: v };
      if (lineType >= 2) { key.InTan = new Float32Array(v); key.OutTan = new Float32Array(v); }
      return key;
    });
    const outside = original.Keys.filter(key => key.Frame < from || key.Frame > to).map(key => structuredClone(key));
    tracks.push({ id: node.ObjectId, property: 'Rotation', track: { ...structuredClone({ ...original, Keys: [] }), LineType: lineType, Keys: [...outside, ...ours].sort((a, b) => a.Frame - b.Frame) } });
    keyCount += ours.length;
  }
  return { tracks, keyCount, keyTimes: keys, nodes: simIds.size };
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
  const heavyIds = [], looseIds = [];
  for (const node of animXLNodes(model)) {
    const name = node.Name || '';
    if (/weapon|sword|axe|hammer|blade|mace|staff|spear|club|shield|flail/i.test(name)) heavyIds.push(node.ObjectId);
    else if (/cape|cloak|hair|tail|plume|ribbon|cloth|banner|skirt|robe|chain|beard|tabard/i.test(name)) looseIds.push(node.ObjectId);
  }
  return { heavyIds, looseIds };
}
