import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from './animation.js';
import { suggestPoseRig } from './pose-ik.js';

// AnimXL: flavour for hand-keyed animations. The authored keys drive a target
// pose; springs on top add easing, overlap, settle and weight. The result is
// written back as ordinary keys for this sequence only.

export const ANIMXL_DEFAULTS = Object.freeze({
  ease: 0, overlap: 0, settle: 0, weight: 0, poses: 50, feet: true, grip: true, anticipation: 0, exaggerate: 0, life: 0,
  heavy: 0, heavyIds: [], loose: 0, looseIds: [],
  steps: 0,
  collapse: 0, collapseAt: 20, collapseDir: 'auto', collapseStyle: 'auto', bounce: 30,
  thunk: 60, thunks: [], thunkSound: '',
  flinch: 60, flinches: [], flinchBehind: false, flinchSound: '',
  retime: {}, bodyId: null, footIds: [], stiffIds: [], range: null, only: null,
});

const rotationOf = (matrices, id) => { const p = new Vector3(), q = new Quaternion(), s = new Vector3(); matrices.get(id)?.decompose(p, q, s); return q; };
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
export function animXLRig(model, sequenceIndex = 0, overrides = {}) {
  const nodes = animXLNodes(model), ids = new Set(nodes.map(n => n.ObjectId)), byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  let body = null, feet = [], legLength = 0, legs = [], arms = [];
  const roles = new Map();
  try {
    const seq = model.Sequences?.[sequenceIndex], rig = suggestPoseRig(model, seq ? seq.Interval[0] : 0, sequenceIndex);
    for (const [id, role] of asMap(rig.roles)) roles.set(Number(id), role);
    body = rig.body ?? null;
    // A limb owns its upper and middle bones. Two "legs" sharing a hip bone
    // cannot be solved apart, so such a limb is rebuilt from its end's own
    // parent and grandparent; toes of one foot that share a whole leg are dropped.
    const limbs = kind => {
      const valid = chain => byId.has(chain.root) && byId.has(chain.middle) && byId.has(chain.end) && new Set([chain.root, chain.middle, chain.end]).size === 3;
      const count = list => { const uses = new Map(); for (const chain of list) for (const id of [chain.root, chain.middle]) uses.set(id, (uses.get(id) || 0) + 1); return uses; };
      const found = (rig.chains || []).filter(chain => chain.kind === kind && valid(chain)).map(chain => ({ root: chain.root, middle: chain.middle, end: chain.end }));
      const shared = count(found);
      const rebuilt = found.map(chain => shared.get(chain.root) === 1 && shared.get(chain.middle) === 1 ? chain : { root: byId.get(byId.get(chain.end).Parent)?.Parent, middle: byId.get(chain.end).Parent, end: chain.end }).filter(valid);
      const uses = count(rebuilt);
      return rebuilt.filter(chain => uses.get(chain.root) === 1 && uses.get(chain.middle) === 1);
    };
    legs = limbs('leg'); arms = limbs('arm');
    const pivot = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
    // A "Hand Ref" can make ground limbs look like arms (a bull's forelegs, a
    // crab's walking legs). On a rig without legs, a limb whose end stands at
    // the bottom of the rig is a leg.
    if (!legs.length && arms.length && seq) {
      const frames = [seq.Interval[0], Math.round((seq.Interval[0] + seq.Interval[1]) / 2), seq.Interval[1]].map(f => sampleNodeMatrices(model, f, sequenceIndex));
      const height = id => Math.min(...frames.map(m => pivot(id).applyMatrix4(m.get(id) || new Matrix4()).z));
      const zs = nodes.map(n => height(n.ObjectId)), bottom = Math.min(...zs), tall = Math.max(...zs) - bottom;
      const grounded = arms.filter(chain => height(chain.end) <= bottom + Math.max(4, tall * 0.15));
      legs = [...legs, ...grounded]; arms = arms.filter(chain => !grounded.includes(chain));
    }
    feet = legs.map(chain => chain.end).filter(id => byId.has(id));
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
  // Without leg chains, only bones named as feet count. Foot attachments alone
  // mislead: wheels, tails and pelvises carry them on legless rigs.
  if (!feet.length) feet = nodes.filter(n => /foot|feet|hoof|paw/i.test(n.Name || '') && !/\bref\b|tail|wheel/i.test(n.Name || '')).map(n => n.ObjectId);
  const torso = [...roles].filter(([id, role]) => ['Chest', 'Spine', 'Neck', 'Head'].includes(role) && ids.has(id)).map(([id]) => id);
  const spine = [...roles].filter(([id, role]) => ['Chest', 'Spine'].includes(role) && ids.has(id)).map(([id]) => id);
  // Your own picks win: a picked foot's leg is the foot and its two parents.
  if (Number.isInteger(overrides.bodyId) && byId.has(overrides.bodyId)) body = overrides.bodyId;
  if (overrides.footIds?.length) {
    const pivotOf = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
    legs = overrides.footIds.filter(id => byId.has(id)).map(end => { const middle = byId.get(end).Parent, root = byId.get(middle)?.Parent; return { root, middle, end }; }).filter(leg => byId.has(leg.root) && byId.has(leg.middle));
    feet = legs.map(leg => leg.end);
    legLength = legs.length ? legs.reduce((sum, c) => sum + pivotOf(c.root).distanceTo(pivotOf(c.middle)) + pivotOf(c.middle).distanceTo(pivotOf(c.end)), 0) / legs.length : legLength;
  }
  return { body, feet, torso, spine, legLength, legs, arms };
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
  const moved = settings.retime || {};
  if (!keys.some((k, i) => i > 0 && i < keys.length - 1 && Number.isFinite(moved[k]) && moved[k] !== k)) return keys.slice();
  const out = keys.map(k => Number.isFinite(moved[k]) ? moved[k] : k), end = keys[keys.length - 1];
  out[0] = keys[0]; out[out.length - 1] = end;
  // Poses stay at least 10 ms apart, or evenly spread when the animation is too short for that.
  const gap = Math.min(10, (end - keys[0]) / (out.length - 1));
  for (let i = 1; i < out.length - 1; i++) {
    const t = clamp(out[i], out[i - 1] + gap, end - gap * (out.length - 1 - i));
    out[i] = gap >= 10 ? Math.round(t) : t;
  }
  return out;
}

/** Output time -> source time. Retiming moves poses, ease shapes the spacing
 * between them, and a THUNK holds the pose for a beat then catches up, so the
 * sequence keeps its length. */
export function animXLTimeMap(keys, settings, outKeys = animXLRetimed(keys, settings)) {
  const wanted = lerp(40, 150, settings.thunk / 100), start = outKeys[0], end = outKeys[outKeys.length - 1];
  // Each hold catches up before the next pose and before the next hold, so no
  // pose is skipped and time never runs backwards.
  const ats = [...new Set(settings.thunks || [])].sort((a, b) => a - b).filter(at => at >= start && at < end);
  const holds = ats.map((at, i) => {
    const room = Math.min(outKeys.find(k => k > at) ?? end, ats[i + 1] ?? end) - at, hold = Math.min(wanted, room / 3);
    return { at, hold, catchUp: Math.min(hold * 2.5, room - hold) };
  }).filter(h => h.hold > 0);
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

/** Settle slider -> spring springiness. Overshoot only shows once the damping is
 * low, so on a straight scale the lower half did almost nothing and the last
 * quarter tripled the effect; the square root spreads it evenly over the slider. */
export const settleSpring = settle => Math.sqrt(clamp(settle / 100, 0, 1));

/** Overlap uses a square-root section to spread the measured motion change.
 * Keep the first quarter unchanged: steps and flinches impose a minimum of 25. */
export const overlapSpring = overlap => {
  const value = clamp(overlap, 0, 100);
  return value <= 25 ? value / 100 : Math.sqrt((value * 5 - 100) / 400);
};

function springParams(settings, kind, depth) {
  const o = overlapSpring(settings.overlap), s = settleSpring(settings.settle), w = settings.weight / 100;
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
  // Picked bones only do something once their slider is up (a THUNK also shakes the heavy bones).
  const heavy = new Set(settings.heavy > 0 || settings.thunks?.length ? settings.heavyIds : []), loose = new Set(settings.loose > 0 ? settings.looseIds : []);
  const from_ = settings.flinchBehind ? -1 : 1;
  const flinches = [...(settings.flinches || [])].map(f => typeof f === 'number' ? { at: f, dir: from_ } : { at: f.at, dir: f.dir ?? from_ }).sort((a, b) => a.at - b.at);
  const wantsBody = settings.weight > 0 || settings.steps > 0 || flinches.length > 0 || settings.collapse > 0;
  const rig = animXLRig(model, sequenceIndex, { bodyId: settings.bodyId, footIds: settings.footIds });
  const footfalls = settings.steps > 0 ? animXLFootfalls(model, sequenceIndex, rig).map(t => Math.round(toOutput(t))) : [];
  const reactive = settings.steps > 0 || flinches.length > 0;
  const general = settings.overlap > 0 || settings.settle > 0 || settings.weight > 0 || reactive;
  function depthOf(node) { let d = 0, p = node.Parent; const seen = new Set(); while (byId.has(p) && !seen.has(p)) { seen.add(p); d++; p = byId.get(p).Parent; } return d; }
  const order = [...nodes].sort((a, b) => depthOf(a) - depthOf(b));
  // Stiff bones (and everything below them) follow exactly: no lag, wobble or drag.
  const stiffRoots = new Set(settings.stiffIds || []), stiff = new Set(order.filter(n => { for (let p = n.ObjectId, guard = 0; byId.has(p) && guard < 64; p = byId.get(p).Parent, guard++) if (stiffRoots.has(p)) return true; return false; }).map(n => n.ObjectId));
  const simIds = new Set(order.filter(n => !stiff.has(n.ObjectId) && (heavy.has(n.ObjectId) || loose.has(n.ObjectId) || (general && byId.has(n.Parent) && !((n.Flags || 0) & 7)))).map(n => n.ObjectId));
  const index = new Map(order.map((n, i) => [n.ObjectId, i]));
  const kinds = order.map(n => heavy.has(n.ObjectId) ? 'heavy' : loose.has(n.ObjectId) ? 'loose' : 'general');
  // Reactions need some give even with Overlap and Settle at zero.
  const springSettings = reactive ? { ...settings, overlap: Math.max(settings.overlap, 25), settle: Math.max(settings.settle, 6.25) } : settings;
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
    if (!node.Rotation?.Keys || stiff.has(node.ObjectId)) continue;
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
    if (!byId.has(node.Parent) || (node.Flags || 0) & 7 || stiff.has(node.ObjectId)) continue;
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
  const bodyNode = wantsBody && rig.body != null && byId.has(rig.body) && index.has(rig.body) && !isGlobal(byId.get(rig.body).Translation, model) && !Array.isArray(byId.get(rig.body).Translation) ? byId.get(rig.body) : null;
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

  // Looping animations pre-roll whole cycles until slow springs settle into the loop's rhythm.
  const preroll = seq.NonLooping ? 0 : duration * Math.max(1, Math.min(Math.ceil(2000 / duration), Math.floor(8000 / duration)));
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

  // Loops must end exactly where they start: ease the last stretch onto the first pose.
  // Only bones AnimXL shaped are touched; an authored seam elsewhere is left as it is.
  // A collapse never loops back to its first pose.
  if (!seq.NonLooping && !(settings.collapse > 0)) closeLoop(samples, bodySamples, id => simIds.has(id) || drift.has(id) || shaping.has(id));

  // Keep feet planted: legs are solved back onto the authored foot path.
  const legNodes = new Set((rig.legs || []).flatMap(leg => [leg.root, leg.middle, leg.end]));
  const plantLegs = settings.feet !== false && rig.legs?.length && ([...legNodes].some(id => simIds.has(id)) || bodyNode);
  // Keep both hands on a two-handed weapon (the first heavy bone is the weapon).
  const weapon = settings.grip !== false && settings.heavyIds?.length && simIds.has(settings.heavyIds[0]) ? settings.heavyIds[0] : null;
  if (plantLegs || weapon != null) solveLimbs({ model, sequenceIndex, byId, legs: plantLegs ? rig.legs : [], arms: weapon != null ? rig.arms : [], weapon, legLength: rig.legLength, samples, bodyNode, bodySamples, srcFrames, rotOpts, posOpts });
  // A rig with no legs or arms (a machine, a serpent) has nothing to buckle: Death fall leaves it alone.
  const machine = !rig.legs.length && !rig.arms.length;
  // A death type first poses the unit (knees buckle, the torso leans), then the physics fall takes over.
  // Only limbs that stand on the ground count as legs here: a bear's forelegs read as arms,
  // and a long coat can read as legs.
  const standing = settings.collapse > 0 ? groundedLimbs(model, byId, [...rig.legs, ...rig.arms], from, sequenceIndex) : rig.legs.length;
  const fallFrom = from + duration * clamp((settings.collapseAt ?? 20) / 100, 0, 0.95);
  let deathStyle = animXLDeathStyle(settings.collapseStyle, rig.legs.length, standing);
  // The fall itself needs about 0.9 s to land; with less time left the posing is skipped.
  if (deathStyle !== 'limp' && to - fallFrom - FALL_MS < DEATH_STYLES[deathStyle].fall * 0.25) deathStyle = 'limp';
  const fall = settings.collapse > 0 && !machine && deathStyle !== 'limp' ? deathPose({ model, byId, rig, style: deathStyle, standing, samples, bodyNode, bodySamples, outFrames, srcFrames, start: fallFrom, end: to, settings, rotOpts, posOpts }) : null;
  // The pose moved the body as a whole; now each foot goes back onto its own authored spot.
  if (fall && settings.feet !== false && rig.legs.length) solveLimbs({ model, sequenceIndex, byId, legs: rig.legs, arms: [], weapon: null, legLength: rig.legLength, samples, bodyNode, bodySamples, srcFrames, rotOpts, posOpts });
  if (settings.collapse > 0 && !machine) collapseBody({ model, byId, samples, bodyNode, bodySamples, outFrames, srcFrames, from, duration, settings: { ...settings, limbIds: [...rig.legs, ...rig.arms].flatMap(c => [c.middle, c.end]), legCount: rig.legs.length, fallStart: fall ? Math.min(fall.fallAt, to - 1) : undefined, fallDir: fall?.dir }, rotOpts, posOpts });

  // Selected bones: only these are shaped; every other bone (and the body, unless it is
  // selected) keeps its animation exactly.
  const only = Array.isArray(settings.only) ? new Set(settings.only) : null;
  if (only) {
    for (const node of order) if (!only.has(node.ObjectId)) { const qs = samples.get(node.ObjectId); for (let i = 0; i < qs.length; i++) authored(node, outFrames[i], qs[i]); }
    if (bodyNode && !only.has(bodyNode.ObjectId)) bodySamples.forEach((p, i) => bodyTarget(outFrames[i], p));
  }
  // Section: only this stretch of the animation is shaped. It fades in and out over
  // its edges, so the result meets the original exactly where the section starts and ends.
  const section = Array.isArray(settings.range) && settings.range.length === 2 ? [clamp(Math.min(...settings.range), from, to), clamp(Math.max(...settings.range), from, to)] : null;
  const fade = section ? Math.max(1, Math.min(150, (section[1] - section[0]) * 0.25)) : 0;
  const weightAt = t => !section ? 1 : t < section[0] || t > section[1] || section[1] <= section[0] ? 0 : (section[0] <= from ? 1 : smooth((t - section[0]) / fade)) * (section[1] >= to ? 1 : smooth((section[1] - t) / fade));
  if (section) {
    for (const node of order) {
      const qs = samples.get(node.ObjectId);
      for (let i = 0; i < qs.length; i++) { const w = weightAt(outFrames[i]); if (w < 1) qs[i] = authored(node, outFrames[i], new Quaternion()).slerp(qs[i], w); }
    }
    if (bodyNode) for (let i = 0; i < bodySamples.length; i++) { const w = weightAt(outFrames[i]); if (w < 1) bodySamples[i] = bodyTarget(outFrames[i], new Vector3()).lerp(bodySamples[i], w); }
  }
  // The keys our keys replace: the whole animation, or for a section the stretch between
  // the original keys on either side of it (those keys, and everything outside, stay as they are).
  const spanOf = track => {
    if (!section) return { lo: from, hi: to, frames: outFrames.map((_, i) => i) };
    const inside = (track?.Keys || []).map(k => k.Frame).filter(f => f >= from && f <= to);
    const a = Math.max(from, ...inside.filter(f => f <= section[0])), b = Math.min(to, ...inside.filter(f => f >= section[1]));
    const keepA = inside.includes(a), keepB = inside.includes(b);
    return { lo: keepA ? a + 0.5 : a, hi: keepB ? b - 0.5 : b, frames: outFrames.map((_, i) => i).filter(i => outFrames[i] >= (keepA ? a + 0.5 : a) && outFrames[i] <= (keepB ? b - 0.5 : b)) };
  };

  const tracks = [];
  let keyCount = 0;
  for (const node of order) {
    const qs = samples.get(node.ObjectId);
    // A degenerate pose (a bone scaled to nothing) falls back to the authored one rather than saving a broken key.
    for (let i = 0; i < qs.length; i++) if (![qs[i].x, qs[i].y, qs[i].z, qs[i].w].every(Number.isFinite)) authored(node, outFrames[i], qs[i]);
    for (let i = 1; i < qs.length; i++) if (qs[i].dot(qs[i - 1]) < 0) qs[i].set(-qs[i].x, -qs[i].y, -qs[i].z, -qs[i].w);
    let changed = false;
    for (let i = 0; i < qs.length && !changed; i++) changed = qs[i].angleTo(authored(node, outFrames[i], tmp)) > 0.01;
    if (!changed) continue;
    // Smooth (squad) keys follow the curve with far fewer keys than straight
    // slerp. A linear track becomes Bezier; its other keys get flat tangents,
    // which interpolate exactly as before.
    const original = node.Rotation?.Keys ? node.Rotation : { LineType: 1, Keys: [] };
    const lineType = Math.max(2, original.LineType ?? 1) === 2 ? 2 : 3;
    const span = spanOf(original);
    if (span.frames.length < 2) continue;
    const ours = reduceRotationSquad(span.frames.map(i => outFrames[i]), span.frames.map(i => qs[i]), settings.tolerance ?? 0.008);
    const outside = outsideKeys(original, span.lo, span.hi, true);
    tracks.push({ id: node.ObjectId, property: 'Rotation', track: { ...structuredClone({ ...original, Keys: [] }), LineType: lineType, Keys: [...outside, ...ours].sort((a, b) => a.Frame - b.Frame) } });
    keyCount += ours.length;
  }
  if (bodyNode && bodySamples.length === outFrames.length) {
    const original = bodyNode.Translation?.Keys ? bodyNode.Translation : { LineType: 1, Keys: [] };
    const authored = outFrames.map(f => bodyTarget(f, new Vector3()));
    const tolerance = Math.max(0.05, scale * 0.004);
    if (bodySamples.some((p, i) => p.distanceTo(authored[i]) > tolerance)) {
      const lineType = original.LineType || 1; // stepped tracks become Linear for our keys
      const span = spanOf(original), frames = span.frames.map(i => outFrames[i]), points = span.frames.map(i => bodySamples[i]);
      const ours = (frames.length > 1 ? reducePoints(frames, points, tolerance) : []).map(i => {
        const v = new Float32Array(points[i].toArray()), key = { Frame: frames[i], Vector: v };
        if (lineType === 3) { key.InTan = new Float32Array(v); key.OutTan = new Float32Array(v); }
        else if (lineType === 2) { key.InTan = new Float32Array(3); key.OutTan = new Float32Array(3); }
        return key;
      });
      tracks.push({ id: bodyNode.ObjectId, property: 'Translation', track: mergeTrack(original, ours, lineType, span.lo, span.hi) });
      keyCount += ours.length;
    }
  }
  // Ease, retiming and THUNK holds move keyed translations in step with the rotations.
  const retimed = settings.ease > 0 || thunks.length > 0 || outKeys.some((t, i) => t !== keys[i]);
  if (retimed) for (const node of nodes) {
    const track = node.Translation;
    if (tracks.some(t => t.id === node.ObjectId && t.property === 'Translation') || (only && !only.has(node.ObjectId))) continue;
    if (!track?.Keys || isGlobal(track, model) || !track.Keys.some(k => k.Frame >= from && k.Frame <= to)) continue;
    const at = f => new Vector3().fromArray(sampleTrack(track, f, posOpts));
    const moved = outFrames.map(f => at(timeMap(f))).map((p, i) => at(outFrames[i]).lerp(p, weightAt(outFrames[i]))), tolerance = Math.max(0.02, scale * 0.002);
    if (!moved.some((p, i) => p.distanceTo(at(outFrames[i])) > tolerance)) continue;
    const lineType = track.LineType || 1;
    const span = spanOf(track), frames = span.frames.map(i => outFrames[i]), points = span.frames.map(i => moved[i]);
    if (frames.length < 2) continue;
    const ours = reducePoints(frames, points, tolerance).map(i => {
      const v = new Float32Array(points[i].toArray()), key = { Frame: frames[i], Vector: v };
      if (lineType === 3) { key.InTan = new Float32Array(v); key.OutTan = new Float32Array(v); }
      else if (lineType === 2) { key.InTan = new Float32Array(3); key.OutTan = new Float32Array(3); }
      return key;
    });
    tracks.push({ id: node.ObjectId, property: 'Translation', track: mergeTrack(track, ours, lineType, span.lo, span.hi) });
    keyCount += ours.length;
  }
  // How much the whole unit moves from frame to frame, original and shaped: the strip draws it as a graph.
  const motion = { frames: outFrames, original: new Array(outFrames.length).fill(0), shaped: new Array(outFrames.length).fill(0) };
  const before = new Quaternion(), after = new Quaternion();
  for (const node of order) {
    const qs = samples.get(node.ObjectId);
    for (let i = 1; i < outFrames.length; i++) {
      motion.shaped[i] += qs[i].angleTo(qs[i - 1]);
      motion.original[i] += authored(node, outFrames[i], after).angleTo(authored(node, outFrames[i - 1], before));
    }
  }
  if (bodyNode && bodySamples.length === outFrames.length) for (let i = 1; i < outFrames.length; i++) {
    motion.shaped[i] += bodySamples[i].distanceTo(bodySamples[i - 1]) / scale * 4;
    motion.original[i] += bodyTarget(outFrames[i], new Vector3()).distanceTo(bodyTarget(outFrames[i - 1], new Vector3())) / scale * 4;
  }
  motion.shaped[0] = motion.shaped[1] ?? 0; motion.original[0] = motion.original[1] ?? 0;
  return { tracks, keyCount, keyTimes: outKeys, sourceKeyTimes: keys, dense: !!keys.dense, footfalls, nodes: simIds.size, rig: { body: rig.body ?? null, feet: rig.feet, machine, legs: rig.legs.length, deathStyle, shortFall: settings.collapse > 0 && to - fallFrom < FALL_MS + 400 }, motion };
}

/** Spread any mismatch between the last and first frame over the final
 * quarter of a looping animation, so it plays without a pop at the loop. */
function closeLoop(samples, bodySamples, shaped) {
  for (const [id, qs] of samples) {
    if (!shaped(id)) continue;
    const n = qs.length;
    if (n < 4) continue;
    const correction = qs[0].clone().multiply(qs[n - 1].clone().invert());
    if (correction.w < 0) correction.set(-correction.x, -correction.y, -correction.z, -correction.w);
    if (2 * Math.acos(Math.min(1, correction.w)) < 1e-4) continue;
    const start = Math.floor(n * 0.75), identity = new Quaternion();
    for (let k = start; k < n; k++) {
      const u = smooth((k - start) / (n - 1 - start));
      qs[k] = new Quaternion().slerpQuaternions(identity, correction, u).multiply(qs[k]).normalize();
    }
  }
  const m = bodySamples.length;
  if (m >= 4) {
    const offset = bodySamples[0].clone().sub(bodySamples[m - 1]), start = Math.floor(m * 0.75);
    for (let k = start; k < m; k++) bodySamples[k] = bodySamples[k].clone().addScaledVector(offset, smooth((k - start) / (m - 1 - start)));
  }
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

/** Death types: the key poses a real death passes through before the body gives way,
 * measured on 469 Warcraft III units (TASK-10 pose library, small humanoids; times on a
 * 2-second death). lean/bend: torso forward (negative = back) and chest hunch; side: sideways
 * lean; knees: knee bend; arms: upper arms raised; all in degrees. `fall` is when the
 * physics fall takes over and which way it pushes. Forward deaths hold still for 0.9 s in
 * the data (the hit plays out first); here that wait is shortened so the death starts at once. */
export const DEATH_STYLES = Object.freeze({
  back: { fall: 420, dir: 'back', keys: [{ at: 220, lean: -11, knees: 20, arms: 10 }, { at: 420, lean: -25, knees: 30, arms: 15 }] },
  knees: { fall: 1150, dir: 'forward', keys: [{ at: 300, knees: 40, arms: 9 }, { at: 550, knees: 57, bend: 15, arms: 14 }, { at: 1000, knees: 55, bend: 5, arms: 15 }, { at: 1150, knees: 55, lean: 8, bend: 6, arms: 20 }] },
  forward: { fall: 800, dir: 'forward', keys: [{ at: 300, knees: 5, arms: 10 }, { at: 600, lean: 17, knees: 8, arms: 20 }, { at: 800, lean: 25, knees: 19, arms: 24 }] },
  side: { fall: 1220, dir: 'side', keys: [{ at: 320, knees: 13, bend: 4, arms: 5 }, { at: 860, knees: 20, bend: 16, arms: 20 }, { at: 1040, knees: 13, bend: 17, arms: 34, side: 3 }, { at: 1220, knees: 7, bend: 2, arms: 30, side: 11 }] },
});

/** Which death type a setting means on this rig: Auto picks knees then fall, the most
 * common death on two legs. On four or more legs Auto goes limp, which already falls onto
 * the side (their most common death) more cleanly than buckling every leg; rigs without
 * legs only go limp. `standing` counts every limb on the ground (forelegs that read as arms too). */
export function animXLDeathStyle(style, legCount, standing = legCount) {
  if (!legCount || style === 'limp') return 'limp';
  if (DEATH_STYLES[style]) return style;
  return standing >= 4 ? 'limp' : 'knees';
}

/** The time a fall needs after the posing to land and come to rest (ms). */
const FALL_MS = 900;

/** How many of these limbs stand on the ground at the start of the animation. The limb that
 * reaches lowest stands; its height (top of the limb above its end) sets the scale, and any
 * limb ending within 30% of that height above it stands too. A tall mount's forehooves do;
 * a coat tail or a hand at the waist does not. */
function groundedLimbs(model, byId, limbs, frame, sequenceIndex) {
  if (!limbs.length) return 0;
  const M = sampleNodeMatrices(model, frame, sequenceIndex);
  const z = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(M.get(id) || new Matrix4()).z;
  const ends = limbs.map(limb => z(limb.end)), lowest = Math.min(...ends), anchor = limbs[ends.indexOf(lowest)];
  const reach = Math.max(4, 0.3 * (z(anchor.root) - lowest));
  return ends.filter(e => e - lowest <= reach).length;
}

/** Poses the unit through its death type's key poses on top of the animation, feet
 * planted, and returns when the physics fall takes over and which way it falls. */
function deathPose({ model, byId, rig, style, standing = rig.legs.length, samples, bodyNode, bodySamples, outFrames, srcFrames, start, end, settings, rotOpts, posOpts }) {
  // Timing follows a 2-second death, stretched to the animation; the posing never takes more
  // than 45% of what is left and always leaves the fall FALL_MS to land.
  const plan = DEATH_STYLES[style], left = end - start, scale = Math.min(clamp(left / 2000, 0.5, 1.5), 0.45 * left / plan.fall, (left - FALL_MS) / plan.fall), soft = standing >= 4 ? 0.5 : 1;
  const keys = [{ at: 0 }, ...plan.keys].map(k => ({ ...k, at: start + k.at * scale }));
  const fallAt = start + plan.fall * scale;
  const side = settings.collapseDir === 'right' ? 'right' : 'left';
  const dir = plan.dir === 'side' ? side : plan.dir;
  const value = (t, name) => {
    let i = 0;
    while (i < keys.length - 2 && t >= keys[i + 1].at) i++;
    const a = keys[i], b = keys[i + 1], u = b.at > a.at ? smooth((t - a.at) / (b.at - a.at)) : 1;
    return lerp(a[name] || 0, b[name] || 0, u) * Math.PI / 180;
  };
  const sampleVec = (track, t, fallback) => new Vector3().fromArray(track ? sampleTrack(track, t, { ...posOpts, fallback }) : fallback);
  const matricesAt = k => worldMatrices(model, byId,
    node => samples.get(node.ObjectId)?.[k] || new Quaternion().fromArray(node.Rotation ? sampleTrack(node.Rotation, srcFrames[k], rotOpts) : [0, 0, 0, 1]).normalize(),
    node => node === bodyNode && bodySamples[k] ? bodySamples[k].clone() : sampleVec(node.Translation, srcFrames[k], [0, 0, 0]),
    node => sampleVec(node.Scaling, srcFrames[k], [1, 1, 1]));
  const pivotAt = (M, id) => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]).applyMatrix4(M.get(id) || new Matrix4());
  const Y = new Vector3(0, 1, 0), X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);
  // Turn a bone about a world axis, measured in its parent's frame (so bends along a chain add up).
  const turn = (M, k, id, axis, angle) => {
    const qs = samples.get(id);
    if (!qs || Math.abs(angle) < 1e-6) return;
    const parent = byId.has(byId.get(id).Parent) ? rotationOf(M, byId.get(id).Parent) : new Quaternion();
    const r = new Quaternion().setFromAxisAngle(axis, angle);
    qs[k] = parent.clone().invert().multiply(r).multiply(parent).multiply(qs[k]).normalize();
  };
  const spine = rig.spine.filter(id => samples.has(id));
  const bodyTurns = !spine.length && bodyNode && samples.has(bodyNode.ObjectId);
  for (let k = 0; k < outFrames.length; k++) {
    const t = Math.min(outFrames[k], fallAt);
    if (outFrames[k] <= start) continue;
    const M = matricesAt(k), feetBefore = rig.feet.map(id => pivotAt(M, id));
    const lean = value(t, 'lean'), bend = value(t, 'bend'), sideLean = value(t, 'side') * (dir === 'right' ? 1 : -1), knees = value(t, 'knees') * soft, arms = value(t, 'arms');
    // Torso: lean and hunch spread over the spine (or the body when the rig has no spine bones).
    const torso = spine.length ? spine : bodyTurns ? [bodyNode.ObjectId] : [];
    for (const id of torso) { turn(M, k, id, Y, (lean + bend) / torso.length); turn(M, k, id, X, sideLean / torso.length); }
    // Knees fold the way they already point (forward on a straight leg); the foot stays level.
    for (const leg of rig.legs) {
      const hip = pivotAt(M, leg.root), knee = pivotAt(M, leg.middle), foot = pivotAt(M, leg.end);
      const line = foot.clone().sub(hip), along = line.lengthSq() > 1e-8 ? line.clone().normalize() : Z.clone().negate();
      const out = knee.clone().sub(hip).projectOnPlane(along).setZ(0);
      const point = out.lengthSq() > 1e-4 * line.lengthSq() ? out.normalize() : X.clone();
      const axis = along.clone().cross(point).normalize();
      if (axis.lengthSq() < 0.5) continue;
      if (bodyTurns && byId.get(leg.root).Parent === bodyNode.ObjectId) turn(M, k, leg.root, Y, -(lean + bend));
      turn(M, k, leg.root, axis, knees / 2); turn(M, k, leg.middle, axis, -knees); turn(M, k, leg.end, axis, knees / 2);
    }
    // Arms come up and out as the unit loses its footing.
    for (const arm of rig.arms) {
      const d = pivotAt(M, arm.middle).sub(pivotAt(M, arm.root)), axis = d.clone().cross(Z);
      if (axis.lengthSq() > 1e-6 * d.lengthSq()) turn(M, k, arm.root, axis.normalize(), arms);
    }
    // Keep the feet where they stand: the body sinks into the bent knees.
    if (bodyNode && bodySamples[k] && feetBefore.length) {
      const after = matricesAt(k), delta = new Vector3();
      rig.feet.forEach((id, i) => delta.add(feetBefore[i].clone().sub(pivotAt(after, id))));
      delta.divideScalar(rig.feet.length);
      const parent = after.get(bodyNode.Parent);
      if (parent && !((bodyNode.Flags || 0) & 1)) delta.applyMatrix3(new Matrix3().setFromMatrix4(parent).invert());
      bodySamples[k] = bodySamples[k].clone().add(delta);
    }
  }
  return { fallAt, dir };
}

/** Collapse: from a moment on, the unit loses its strength and falls onto the
 * ground. Every bone pivot becomes a point held to its parent at the bone's
 * length; muscles pull the points toward the animated pose less and less,
 * gravity and a push in the chosen direction take over, and the ground stops
 * them with a little bounce. The points then go back into rotations and the
 * body's translation. Updates `samples` and `bodySamples` in place. */
const FALL = { back: [-1, 0, 0], forward: [1, 0, 0], left: [0, 1, 0], right: [0, -1, 0] };
function collapseBody({ model, byId, samples, bodyNode, bodySamples, outFrames, srcFrames, from, duration, settings, rotOpts, posOpts }) {
  const amount = clamp(settings.collapse / 100, 0, 1), start = settings.fallStart ?? from + duration * clamp((settings.collapseAt ?? 20) / 100, 0, 0.95);
  const k0 = outFrames.findIndex(f => f >= start);
  if (k0 < 0 || amount <= 0) return;
  const pivotOf = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
  const sampleVec = (track, t, fallback) => new Vector3().fromArray(track ? sampleTrack(track, t, { ...posOpts, fallback }) : fallback);
  const shapedAt = k => worldMatrices(model, byId,
    node => samples.get(node.ObjectId)?.[k] || new Quaternion().fromArray(node.Rotation ? sampleTrack(node.Rotation, srcFrames[k], rotOpts) : [0, 0, 0, 1]).normalize(),
    node => node === bodyNode && bodySamples[k] ? bodySamples[k].clone() : sampleVec(node.Translation, srcFrames[k], [0, 0, 0]),
    node => sampleVec(node.Scaling, srcFrames[k], [1, 1, 1]));
  const frames = outFrames.map((_, k) => k >= Math.max(0, k0 - 1) ? shapedAt(k) : null);

  // The skeleton: the unit's own tree of bones and helpers (the one holding the body; loose
  // effect bones stay as they are), parents first, each with its main child (the biggest branch).
  const all = [...(model.Bones || []), ...(model.Helpers || [])].map(n => n.ObjectId).filter(id => byId.has(id));
  const topOf = id => { let top = id; for (let p = byId.get(id)?.Parent, guard = 0; byId.has(p) && guard < 64; p = byId.get(p).Parent, guard++) top = p; return top; };
  const tops = new Map(); for (const id of all) tops.set(topOf(id), (tops.get(topOf(id)) || 0) + 1);
  const unit = bodyNode ? topOf(bodyNode.ObjectId) : [...tops].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ids = all.filter(id => topOf(id) === unit);
  const inSet = new Set(ids), children = new Map(ids.map(id => [id, []]));
  for (const id of ids) if (inSet.has(byId.get(id).Parent)) children.get(byId.get(id).Parent).push(id);
  const size = new Map(), sizeOf = id => { if (!size.has(id)) size.set(id, 1 + children.get(id).reduce((s, c) => s + sizeOf(c), 0)); return size.get(id); };
  const depth = id => { let d = 0; for (let p = byId.get(id).Parent; inSet.has(p) && d < 64; p = byId.get(p).Parent) d++; return d; };
  const order = [...ids].sort((a, b) => depth(a) - depth(b));
  const mainChild = new Map(ids.map(id => [id, children.get(id).sort((a, b) => sizeOf(b) - sizeOf(a))[0]]));
  const position = (k, id) => pivotOf(id).applyMatrix4(frames[k].get(id));

  // Points start where the animation has them, moving as it moves.
  const n = order.length, at = new Map(order.map((id, i) => [id, i]));
  const stepsPerFrame = k => Math.max(1, Math.round((outFrames[k] - outFrames[k - 1]) / (1000 / SIM_HZ)));
  const cur = order.map(id => position(k0, id)), prev = cur.map(p => p.clone());
  if (k0 > 0) { const s = stepsPerFrame(k0); order.forEach((id, i) => prev[i].addScaledVector(position(k0 - 1, id).sub(cur[i]), 1 / s)); }
  const zs = cur.map(p => p.z), ground = Math.min(...zs), height = Math.max(Math.max(...zs) - ground, 20);
  // Pivots sit inside the mesh: each bone rests on the ground at about the thickness of its own mesh; the feet stay where they stand.
  const radius = boneRadii(model);
  const floor = order.map((id, i) => Math.min(cur[i].z, ground + clamp(radius.get(id) ?? 0, height * 0.03, height * 0.2)));
  const parentOf = order.map(id => at.get(byId.get(id).Parent) ?? -1), grandOf = parentOf.map(p => p >= 0 ? parentOf[p] : -1);
  const rest = order.map((id, i) => parentOf[i] >= 0 ? cur[i].distanceTo(cur[parentOf[i]]) : 0);
  // Knees and elbows fold to about half their open length; the spine, neck and tail hardly fold, so the body falls as one piece.
  const limbs = new Set((settings.limbIds || []));
  // A part hanging down from its grandparent is a leg or an arm even when the rig reading missed it.
  const fold = order.map((id, i) => { if (grandOf[i] < 0) return 0; const span = cur[i].distanceTo(cur[grandOf[i]]), hangs = cur[grandOf[i]].z - cur[i].z > span * 0.5; return span * (limbs.has(id) || hangs ? 0.5 : 0.85); });
  const weight = order.map(id => 1 / sizeOf(id));
  const g = height * 6, bounce = clamp((settings.bounce ?? 30) / 100, 0, 1) * 0.5, dt = 1 / SIM_HZ;
  // Strength left after the drain (a per-step pull). Sag grows about as fast as the
  // pull weakens squared, so it falls off exponentially to spread the slider evenly; Full keeps none.
  const residual = amount >= 1 ? 0 : 0.25 * Math.exp(-(1.2 + 3 * amount));
  // The push tips the top of the unit the chosen way while it falls; the feet barely move.
  // Natural: two legs fall backwards, four or more fall onto their side.
  const direction = FALL[settings.fallDir] ? settings.fallDir : settings.collapseDir === 'auto' || !FALL[settings.collapseDir] ? (settings.legCount >= 4 ? 'left' : 'back') : settings.collapseDir;
  const push = new Vector3().fromArray(FALL[direction]).multiplyScalar(height * 5 * amount * dt * dt);
  // A small, fixed sideways nudge per joint: perfectly straight legs would otherwise
  // never choose a way to buckle. Same result every time.
  prev.forEach((p, i) => p.add(new Vector3(((i * 7919) % 13) / 13 - 0.5, ((i * 104729) % 17) / 17 - 0.5, 0).multiplyScalar(height * 0.6 * amount * dt)));
  const pull = (i, j, length, mode) => {
    const d = cur[j].clone().sub(cur[i]), len = d.length();
    if (len < 1e-6 || (mode === 'min' && len >= length)) return;
    const wi = weight[i], wj = weight[j], move = (len - length) / len / (wi + wj);
    cur[i].addScaledVector(d, wi * move); cur[j].addScaledVector(d, -wj * move);
  };
  const out = new Map([[k0, cur.map(p => p.clone())]]);
  for (let k = k0 + 1; k < outFrames.length; k++) {
    const steps = stepsPerFrame(k);
    for (let s = 1; s <= steps; s++) {
      const u = s / steps, t = outFrames[k - 1] + (outFrames[k] - outFrames[k - 1]) * u;
      // Strength drains over a fifth of a second. Below Full, some strength stays: a
      // damped pull toward the pose that gets weaker as Collapse rises, so the unit
      // sags, buckles or kneels instead of either standing or falling flat.
      const drained = smooth((t - outFrames[k0]) / 200), hold = 1 - drained, keep = residual * drained;
      for (let i = 0; i < n; i++) {
        const v = cur[i].clone().sub(prev[i]).multiplyScalar(0.995);
        prev[i].copy(cur[i]);
        cur[i].add(v); cur[i].z -= g * dt * dt;
        // The push lasts the whole fall but fades near the ground, so nothing stays propped up on end.
        cur[i].addScaledVector(push, Math.max(0, cur[i].z - floor[i]) / height);
        if (hold > 0 || keep > 0) {
          const pose = position(k - 1, order[i]).lerp(position(k, order[i]), u);
          if (hold > 0) cur[i].lerp(pose, hold * 0.25);
          if (keep > 0) { cur[i].lerp(pose, keep); prev[i].lerp(pose, keep); }
        }
      }
      for (let pass = 0; pass < 8; pass++) {
        for (let i = 0; i < n; i++) if (parentOf[i] >= 0) pull(parentOf[i], i, rest[i]);
        for (let i = 0; i < n; i++) if (grandOf[i] >= 0) pull(grandOf[i], i, fold[i], 'min');
      }
      for (let i = 0; i < n; i++) if (cur[i].z < floor[i]) {
        const vz = cur[i].z - prev[i].z;
        cur[i].z = floor[i]; prev[i].z = floor[i] + vz * bounce;
        prev[i].x += (cur[i].x - prev[i].x) * 0.6; prev[i].y += (cur[i].y - prev[i].y) * 0.6;
      }
    }
    out.set(k, cur.map(p => p.clone()));
  }

  // Back to rotations: each bone turns so its main child points where the points ended up.
  for (let k = k0; k < outFrames.length; k++) {
    const X = out.get(k), M = frames[k], world = new Map();
    for (const id of order) {
      const node = byId.get(id), parentId = node.Parent, own = rotationOf(M, id);
      const inherits = inSet.has(parentId) && !((node.Flags || 0) & 2);
      const carried = inherits ? world.get(parentId).clone().multiply(rotationOf(M, parentId).invert()) : new Quaternion();
      let next = carried.clone().multiply(own);
      const child = mainChild.get(id);
      if (samples.has(id) && child != null) {
        const was = position(k, child).sub(position(k, id)).applyQuaternion(carried), now = X[at.get(child)].clone().sub(X[at.get(id)]);
        if (was.lengthSq() > 1e-8 && now.lengthSq() > 1e-8) next = new Quaternion().setFromUnitVectors(was.normalize(), now.normalize()).multiply(next);
      }
      world.set(id, next.normalize());
      if (samples.has(id)) samples.get(id)[k] = (inherits ? world.get(parentId).clone().invert() : new Quaternion()).multiply(next).normalize();
    }
    // The body follows its point down to the ground.
    if (bodyNode && bodySamples[k]) {
      const moved = shapedAt(k), parent = moved.get(bodyNode.Parent);
      const delta = X[at.get(bodyNode.ObjectId)].clone().sub(pivotOf(bodyNode.ObjectId).applyMatrix4(moved.get(bodyNode.ObjectId)));
      if (parent && !((bodyNode.Flags || 0) & 1)) delta.applyMatrix3(new Matrix3().setFromMatrix4(parent).invert());
      bodySamples[k] = bodySamples[k].clone().add(delta);
    }
  }
}

/** Two-bone IK, per recorded frame, for limbs that must stay where the
 * authored animation keeps them:
 *  - legs: the ankle goes back onto the authored foot path and the foot keeps
 *    its authored orientation. Legs that never reach the ground (a rider's)
 *    are left alone.
 *  - a two-handed grip: the off hand keeps its authored hold on the weapon,
 *    wherever the shaped weapon now is.
 * The knee or elbow stays in its current bend plane. Updates `samples` in place. */
function solveLimbs({ model, sequenceIndex, byId, legs, arms, weapon, legLength, samples, bodyNode, bodySamples, srcFrames, rotOpts, posOpts }) {
  const pivotOf = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
  const position = (matrices, id) => pivotOf(id).applyMatrix4(matrices.get(id));
  const descendsFrom = (id, ancestor) => { for (let p = id, guard = 0; byId.has(p) && guard < 64; p = byId.get(p).Parent, guard++) if (p === ancestor) return true; return false; };
  const usable = chain => [chain.root, chain.middle, chain.end].every(id => samples.has(id));
  const authored = srcFrames.map(src => sampleNodeMatrices(model, Math.round(src), sequenceIndex));
  const limbs = [];
  const legChains = (legs || []).filter(usable);
  if (legChains.length) {
    const heights = legChains.map(leg => authored.map(m => position(m, leg.end).z)), ground = Math.min(...heights.flat());
    legChains.forEach((leg, i) => {
      if (Math.min(...heights[i]) <= ground + Math.max(4, legLength * 0.25)) limbs.push({ chain: leg, target: (k, shaped) => ({ position: position(authored[k], leg.end), rotation: rotationOf(authored[k], leg.end) }) });
    });
  }
  // A weapon scaled to nothing (hidden for part of the animation) has no grip to keep.
  const solid = matrix => matrix && Math.abs(matrix.determinant()) > 1e-9;
  if (weapon != null && byId.has(weapon) && authored.every(m => solid(m.get(weapon)))) for (const arm of (arms || []).filter(usable)) {
    if (descendsFrom(weapon, arm.root)) continue; // the arm holding the weapon
    const reach = pivotOf(arm.root).distanceTo(pivotOf(arm.middle)) + pivotOf(arm.middle).distanceTo(pivotOf(arm.end));
    // A two-handed grip keeps the hand at one spot on the weapon all through the animation.
    const held = authored.map(m => position(m, arm.end).applyMatrix4(m.get(weapon).clone().invert()));
    const centre = held.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(held.length);
    if (!(Math.max(...held.map(p => p.distanceTo(centre))) <= reach * 0.15)) continue;
    limbs.push({ chain: arm, target: (k, shaped) => {
      if (!solid(shaped.get(weapon))) return null;
      const hold = shaped.get(weapon).clone().multiply(authored[k].get(weapon).clone().invert()).multiply(authored[k].get(arm.end));
      const p = new Vector3(), q = new Quaternion(), s = new Vector3(); hold.decompose(p, q, s);
      return { position: pivotOf(arm.end).applyMatrix4(hold), rotation: q };
    } });
  }
  if (!limbs.length) return 0;
  const sampleVec = (track, t, fallback) => new Vector3().fromArray(track ? sampleTrack(track, t, { ...posOpts, fallback }) : fallback);
  for (let k = 0; k < srcFrames.length; k++) {
    const src = srcFrames[k];
    const shaped = worldMatrices(model, byId,
      node => samples.get(node.ObjectId)?.[k] || new Quaternion().fromArray(node.Rotation ? sampleTrack(node.Rotation, src, rotOpts) : [0, 0, 0, 1]).normalize(),
      node => node === bodyNode && bodySamples[k] ? bodySamples[k].clone() : sampleVec(node.Translation, src, [0, 0, 0]),
      node => sampleVec(node.Scaling, src, [1, 1, 1]));
    for (const { chain, target } of limbs) {
      const goal = target(k, shaped);
      if (!goal || ![goal.position.x, goal.position.y, goal.position.z, goal.rotation.x, goal.rotation.y, goal.rotation.z, goal.rotation.w].every(Number.isFinite)) continue;
      const R = position(shaped, chain.root), M = position(shaped, chain.middle), E = position(shaped, chain.end), T = goal.position;
      const endNode = byId.get(chain.end);
      // Already in place: only the foot or hand turns back to its authored orientation.
      if (E.distanceTo(T) < 0.01) { samples.get(chain.end)[k] = rotationOf(shaped, endNode.Parent).invert().multiply(goal.rotation).normalize(); continue; }
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
      const rootWorld = q1.clone().multiply(rotationOf(shaped, chain.root)), midWorld = q2.clone().multiply(q1).multiply(rotationOf(shaped, chain.middle));
      const newParentWorld = id => {
        const old = rotationOf(shaped, id);
        if (id === chain.middle || descendsFrom(id, chain.middle)) return q2.clone().multiply(q1).multiply(old);
        if (id === chain.root || descendsFrom(id, chain.root)) return q1.clone().multiply(old);
        return old;
      };
      const rootNode = byId.get(chain.root), midNode = byId.get(chain.middle);
      samples.get(chain.root)[k] = rotationOf(shaped, rootNode.Parent).invert().multiply(rootWorld).normalize();
      samples.get(chain.middle)[k] = newParentWorld(midNode.Parent).invert().multiply(midWorld).normalize();
      samples.get(chain.end)[k] = newParentWorld(endNode.Parent).invert().multiply(goal.rotation).normalize();
    }
  }
  return limbs.length;
}
// Copy typed key values directly instead of a native clone call for each key.
function cloneKey(key) {
  const copy = {};
  for (const property of Object.keys(key)) {
    const value = key[property];
    copy[property] = value instanceof Float32Array || value instanceof Int32Array ? value.slice()
      : value !== null && typeof value === 'object' ? structuredClone(value) : value;
  }
  return copy;
}
/** Keys of every other animation, unchanged in how they play. A stepped
 * (no interpolation) track becomes smooth for our keys, so each of its other
 * keys is held until just before the next one and those animations keep stepping. */
function outsideKeys(original, from, to, flatTangents) {
  const keys = [...original.Keys].sort((a, b) => a.Frame - b.Frame), stepped = (original.LineType ?? 1) === 0, out = [];
  keys.forEach((key, i) => {
    if (key.Frame >= from && key.Frame <= to) return;
    const copy = cloneKey(key);
    if (flatTangents && !copy.InTan) { copy.InTan = new Float32Array(copy.Vector); copy.OutTan = new Float32Array(copy.Vector); }
    out.push(copy);
    const held = keys[i + 1]?.Frame - 1;
    if (stepped && held > key.Frame && (held < from || held > to)) out.push({ ...cloneKey(copy), Frame: held });
  });
  return out;
}
/** About how thick the mesh is around each bone: the median distance of its own vertices from its pivot. */
function boneRadii(model) {
  const pivots = new Map([...(model.Bones || []), ...(model.Helpers || [])].map(n => [n.ObjectId, n.PivotPoint || model.PivotPoints?.[n.ObjectId] || [0, 0, 0]]));
  const distances = new Map(), add = (id, v, x, y, z) => { const p = pivots.get(id); if (!p) return; (distances.get(id) || distances.set(id, []).get(id)).push(Math.hypot(x - p[0], y - p[1], z - p[2])); };
  for (const geo of model.Geosets || []) {
    const vertices = geo.Vertices || [], count = vertices.length / 3, skin = geo.SkinWeights;
    for (let v = 0; v < count; v++) {
      const x = vertices[v * 3], y = vertices[v * 3 + 1], z = vertices[v * 3 + 2];
      if (skin?.length === count * 8) { for (let s = 0; s < 4; s++) if (skin[v * 8 + s + 4] > 127) add(skin[v * 8 + s], v, x, y, z); }
      else for (const id of geo.Groups?.[geo.VertexGroup?.[v]] || []) add(id, v, x, y, z);
    }
  }
  return new Map([...distances].map(([id, list]) => [id, list.sort((a, b) => a - b)[list.length >> 1]]));
}
// Our keys replace this sequence's keys; every other sequence keeps its own.
function mergeTrack(original, ours, lineType, from, to) {
  const outside = outsideKeys(original, from, to, false);
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
  const kept = [0, qs.length - 1], probe = new Quaternion(), spans = new Map(), controls = new Map();
  // End keys keep a flat tangent so the curve starts and ends on its pose.
  // Reuse a tangent while both of its kept neighbours are unchanged.
  const tangents = () => kept.map((i, k) => {
    const prev = kept[k - 1] ?? -1, next = kept[k + 1] ?? -1;
    let control = controls.get(i);
    if (!control || control.prev !== prev || control.next !== next) {
      const q = k === 0 || k === kept.length - 1 ? qs[i].clone() : squadTangent(qs[prev], qs[i], qs[next]);
      controls.set(i, control = { prev, next, q });
    }
    return control.q;
  });
  for (let guard = 0; guard < qs.length; guard++) {
    const tan = tangents();
    let worst = tolerance, at = -1;
    for (let k = 0; k + 1 < kept.length; k++) {
      const a = kept[k], b = kept[k + 1], prev = kept[k - 1] ?? -1, next = kept[k + 2] ?? -1;
      let span = spans.get(a);
      // Both tangents depend on these four kept poses. Recheck only when one changes.
      if (!span || span.b !== b || span.prev !== prev || span.next !== next) {
        span = { b, prev, next, worst: tolerance, at: -1 };
        for (let i = a + 1; i < b; i++) {
          const e = squad(qs[a], tan[k], tan[k + 1], qs[b], (frames[i] - frames[a]) / (frames[b] - frames[a]), probe).angleTo(qs[i]);
          if (e > span.worst) { span.worst = e; span.at = i; }
        }
        spans.set(a, span);
      }
      if (span.worst > worst) { worst = span.worst; at = span.at; }
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
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n])), children = new Map();
  for (const node of byId.values()) { if (!children.has(node.Parent)) children.set(node.Parent, []); children.get(node.Parent).push(node.ObjectId); }
  // Only bones that move something visible are worth shaping: an empty "weapon"
  // leaf does nothing when the real sword is skinned to the hand.
  const skinned = skinnedBoneIds(model);
  const carriesSkin = id => { if (!skinned.size) return true; const stack = [id], seen = new Set(); while (stack.length) { const at = stack.pop(); if (seen.has(at)) continue; seen.add(at); if (skinned.has(at)) return true; stack.push(...(children.get(at) || [])); } return false; };
  // Heads, jaws and natural claws are never "the weapon", even with a Weapon Ref at the mouth.
  const headLike = /head|neck|jaw|mouth|beak|skull|face|tongue|teeth|fang/i;
  // Biped rigs hang the arms under the neck, so a hand on the way up means it is held, not part of the head.
  const underHead = id => { for (let p = id, guard = 0; byId.has(p) && guard < 64; p = byId.get(p).Parent, guard++) { const name = byId.get(p).Name || ''; if (/hand|arm|clavicle/i.test(name)) return false; if (headLike.test(name)) return true; } return false; };
  const subtree = id => { let count = 0; const stack = [id], seen = new Set(); while (stack.length) { const at = stack.pop(); if (seen.has(at)) continue; seen.add(at); count++; stack.push(...(children.get(at) || [])); } return count; };
  // Hands, limbs and mounts are never "the weapon", even when named after it ("Sword Hand").
  let rig = null;
  try { rig = animXLRig(model, 0); } catch { /* names only */ }
  // A machine (no legs, no arms) has no body parts: its arm is the throwing arm.
  const machine = rig && nodes.length >= 6 && !rig.legs.length && !rig.arms.length && !nodes.some(n => /hand|leg|foot|head|neck|spine|pelvis|chest/i.test(n.Name || ''));
  const bodyPart = machine ? /wheel|tail|mesh|death/i : /hand|arm|finger|wrist|toe|foot|leg|paw|claw|pinc|wolf|horse|boar|mount|mesh|death|tail|wheel|pelvis|spine|chest/i;
  const weaponName = machine ? /weapon|sword|axe|hammer|blade|mace|staff|spear|club|flail|glaive|attack|arm|launch|throw|bucket|crusher|barrel|cannon|turret/i : /weapon|sword|axe|hammer|blade|mace|staff|spear|club|flail|choppa|glaive|halberd|scythe/i;
  const soft = /cape|cloak|hair|tail|plume|ribbon|cloth|banner|skirt|robe|chain|beard|tabard|sling|(?<![a-z])rope/i;
  for (const node of nodes) {
    const name = node.Name || '';
    if (weaponName.test(name) && !bodyPart.test(name) && !/cape|cloak|cloth|ribbon|banner|(?<![a-z])rope|sling/i.test(name) && carriesSkin(node.ObjectId)) heavyIds.push(node.ObjectId);
    else if (soft.test(name) && carriesSkin(node.ObjectId)) looseIds.push(node.ObjectId);
  }
  // A "Weapon Ref" attachment names the weapon bone even when the bone itself has a generic name.
  for (const attachment of model.Attachments || []) {
    if (!/weapon/i.test(attachment.Name || '')) continue;
    const parent = nodes.find(n => n.ObjectId === attachment.Parent);
    // A bone that carries most of the rig (a tank's hull) is not a weapon either.
    if (!parent || bodyPart.test(parent.Name || '') || underHead(parent.ObjectId) || !carriesSkin(parent.ObjectId) || subtree(parent.ObjectId) > nodes.length / 2) continue;
    if (!heavyIds.includes(parent.ObjectId) && !looseIds.includes(parent.ObjectId)) heavyIds.push(parent.ObjectId);
  }
  // Tails with plain names (Bone12, Object44): a chain of three or more bones
  // reaching backwards along the middle of a creature that stands on legs,
  // each moving its own skin, apart from the legs and arms.
  if (rig?.legs.length >= 2) {
    const pivot = id => new Vector3().fromArray(byId.get(id)?.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
    const limbIds = new Set([...rig.legs, ...rig.arms].flatMap(c => [c.root, c.middle, c.end]));
    const holdsLimb = id => { const stack = [id], seen = new Set(); while (stack.length) { const at = stack.pop(); if (seen.has(at)) continue; seen.add(at); if (limbIds.has(at)) return true; stack.push(...(children.get(at) || [])); } return false; };
    const xs = nodes.map(n => pivot(n.ObjectId).x), size = Math.max(...xs) - Math.min(...xs);
    const bodyX = rig.body != null ? pivot(rig.body).x : (Math.max(...xs) + Math.min(...xs)) / 2, midY = rig.body != null ? pivot(rig.body).y : 0;
    const ownSkin = id => !skinned.size || skinned.has(id);
    const taken = new Set([...heavyIds, ...looseIds, ...rig.torso, rig.body]);
    const depth = id => { let d = 0; for (let p = byId.get(id)?.Parent; byId.has(p) && d < 64; p = byId.get(p).Parent) d++; return d; };
    for (const node of [...nodes].sort((a, b) => depth(a.ObjectId) - depth(b.ObjectId))) {
      const id = node.ObjectId;
      if (taken.has(id) || holdsLimb(id) || pivot(id).x >= bodyX || Math.abs(pivot(id).y - midY) > size * 0.1 || !ownSkin(id)) continue;
      const chain = [id];
      for (let at = id; ;) {
        const back = (children.get(at) || []).filter(c => ids.has(c) && !taken.has(c) && !holdsLimb(c) && ownSkin(c) && Math.abs(pivot(c).y - midY) <= size * 0.1 && pivot(c).x < pivot(at).x - 0.5).sort((a, b) => pivot(a).x - pivot(b).x)[0];
        if (back == null) break;
        chain.push(back); at = back;
      }
      // A rear body segment that branches (tail plus hind parts) is not part of the tail.
      while (chain.length > 1 && (children.get(chain[0]) || []).filter(child => carriesSkin(child)).length > 1) chain.shift();
      if (chain.length < 3) continue;
      const first = byId.get(chain[0]), reach = pivot(chain[chain.length - 1]).sub(pivot(byId.has(first.Parent) ? first.Parent : chain[0]));
      if (-reach.x < Math.max(size * 0.08, 0.5 * reach.length()) || -reach.x < Math.abs(reach.y)) continue;
      for (const c of chain) { looseIds.push(c); taken.add(c); }
    }
  }
  return { heavyIds, looseIds };
}

/** Bones that move at least one vertex (SD matrix groups in use or positive HD weights). */
function skinnedBoneIds(model) {
  const out = new Set();
  for (const geo of model.Geosets || []) {
    const vertices = (geo.Vertices?.length || 0) / 3, skin = geo.SkinWeights;
    if (skin?.length === vertices * 8) { for (let v = 0; v < vertices; v++) for (let s = 0; s < 4; s++) if (skin[v * 8 + s + 4] > 0) out.add(skin[v * 8 + s]); }
    else for (const index of new Set(geo.VertexGroup || [])) for (const id of geo.Groups?.[index] || []) out.add(id);
  }
  return out;
}
