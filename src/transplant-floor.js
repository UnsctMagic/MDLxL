// Transplant (XFER stage 3), arms above the floor (owner's pick, 20 Nov 2026, floor-choice sheet "Bend arm" on all four
// cases). A transplant is 100% the donor's motion on this model's proportions, so a longer weapon, arm or shield dips
// under the floor where the donor's shorter one does not. In the moments that dip, and only there, the arm that dips
// turns up at its first joint, about that joint's pivot, by the smallest angle that keeps its mesh (hand, weapon,
// shield) above the floor. Feet stay planted and every other joint is exactly the donor's. Where the donor's own arm goes
// under its floor (an axe chopped into the ground, a ghoul's claws), this model's may go as deep for its size: only the
// depth its longer parts add is turned away (a model on its own skeleton is unchanged). A weapon the donor has thrown or
// dropped (`donorWeaponSwap`, the model's weapon left the hand with it) is not held, so it is no dip to answer.
// The floor-choice prototype (out/transfer-probe/overnight/floor-choice/lib.mjs, build.mjs) measured the same way with no
// donor depth and resampled the whole dipping animation; here only the windows around the turned moments get new keys.
// Pure module: changes the result model it is given (rotation keys of an arm's first joint in the dipping animations).
import { Matrix4, Quaternion, Vector3 } from 'three';
import { TRANSFORM_DEFAULTS, allNodes, inheritedParentMatrix, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack } from './animation.js';
import { geosetAlphaTrack, geosetVisibleIn } from './geoset-extras.js';
import { solveTwoBone } from './pose-ik.js';
import { standSequenceIndex } from './sequence-editor.js';

const STEP = 1000 / 30, DENSE = 1000 / 120, DEG = 180 / Math.PI;
/** Residual allowed under the floor, in own heights. */
const TOLERANCE = 0.02;
/** Animations with no ground to keep: the body lies, rises, swims, sleeps or is a portrait or cinematic. */
const NO_GROUND = /death|decay|dissipate|birth|portrait|morph|sleep|swim|cinematic/i;
const isTrack = t => t && typeof t === 'object' && Array.isArray(t.Keys);
const v3 = value => new Vector3().fromArray(value);

// For a horizontal rotation through theta, each skinned point imposes an arc
// of allowed shoulder axes. Intersect the arcs, then refine the first angle
// that clears every point. Switching between hand and weapon-tip axes at an
// integer-degree tie used to swing the hand abruptly during an idle animation.
function floorTurn(points, level, preferred, previous = null, maxChange = Math.PI) {
  const tau = 2 * Math.PI;
  const wrap = a => (a % tau + tau) % tau;
  const aim = wrap(preferred);
  function axisAt(theta, height) {
    const sin = Math.sin(theta), change = Math.cos(theta) - 1;
    let allowed = [[0,tau]];
    if (previous != null && maxChange < Math.PI) {
      const start = wrap(previous-maxChange), end = wrap(previous+maxChange);
      allowed = start <= end ? [[start,end]] : [[0,end],[start,tau]];
    }
    for (const p of points) {
      const need = height - p.z - p.dz * change, reach = p.radius * sin;
      if (need > reach + 1e-8) return null;
      if (need <= -reach || reach < 1e-10) continue;
      const half = Math.acos(Math.min(1,need/reach));
      const a = wrap(p.axis-half), b = wrap(p.axis+half);
      const arcs = a <= b ? [[a,b]] : [[0,b],[a,tau]];
      const next = [];
      for (const [lo,hi] of allowed) for (const [x,y] of arcs) {
        if (Math.max(lo,x) <= Math.min(hi,y)) next.push([Math.max(lo,x),Math.min(hi,y)]);
      }
      if (!next.length) return null;
      allowed = next;
    }
    let best = null, distance = Infinity;
    for (const [lo,hi] of allowed) for (const target of [aim-tau,aim,aim+tau]) {
      const a = Math.max(lo,Math.min(hi,target)), d = Math.abs(target-a);
      if (d < distance) { best = a; distance = d; }
    }
    return best;
  }
  let bestHeight = -Infinity, angle = 0, axisAngle = aim;
  for (let deg=1; deg<=90; deg++) {
    let hi = deg / DEG, lo = (deg-1) / DEG;
    let a = axisAt(hi,level);
    if (a !== null) {
      for (let i=0; i<6; i++) {
        const mid = (lo+hi)/2, at = axisAt(mid,level);
        if (at === null) lo = mid;
        else { hi = mid; a = at; }
      }
      return {axis:new Vector3(Math.cos(a),Math.sin(a),0), th:hi};
    }
  }
  if (previous != null) return floorTurn(points,level,preferred);
  for (let deg=1; deg<=90; deg++) {
    const hi = deg / DEG;
    // When no turn clears, retain the best attainable height. The rotation
    // with the hand's raising axis supplies a lower bound at this angle.
    const sin = Math.sin(hi), change = Math.cos(hi)-1;
    let low = Infinity, high = Infinity;
    for (const p of points) {
      const base = p.z+p.dz*change, r = p.radius*sin;
      low = Math.min(low,base+r*Math.cos(aim-p.axis));
      high = Math.min(high,base+r);
    }
    if (high <= bestHeight) continue;
    let direction = aim;
    for (let i=0; i<8; i++) {
      const mid=(low+high)/2, at=axisAt(hi,mid);
      if (at === null) high=mid;
      else {low=mid; direction=at;}
    }
    if (low > bestHeight) {bestHeight=low; angle=hi; axisAngle=direction;}
  }
  return {axis:new Vector3(Math.cos(axisAngle),Math.sin(axisAngle),0),th:angle};
}

/** Frames of a sequence every STEP ms, the last frame included. */
function framesOf(sequence) { const [a, z] = sequence.Interval, out = []; for (let t = a; t < z; t += STEP) out.push(Math.round(t)); out.push(z); return [...new Set(out)]; }

/** Skin bookkeeping of the result: per geoset its bones and weights per vertex, its alpha track. */
function skinInfo(model) {
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n]));
  const children = new Map();
  for (const n of nodes) if (n.Parent != null && byId.has(n.Parent)) { if (!children.has(n.Parent)) children.set(n.Parent, []); children.get(n.Parent).push(n.ObjectId); }
  const subtree = id => { const out = new Set([id]), stack = [id]; while (stack.length) for (const c of children.get(stack.pop()) || []) if (!out.has(c)) { out.add(c); stack.push(c); } return out; };
  const geos = (model.Geosets || []).map((g, gi) => {
    const n = g.Vertices.length / 3, hd = g.SkinWeights?.length >= n * 8, bones = [], weights = [];
    for (let v = 0; v < n; v++) {
      if (hd) { const slots = [0, 1, 2, 3].filter(i => g.SkinWeights[v * 8 + 4 + i]); bones.push(slots.map(i => g.SkinWeights[v * 8 + i])); weights.push(slots.map(i => g.SkinWeights[v * 8 + 4 + i])); }
      else { bones.push(g.Groups?.[g.VertexGroup?.[v]] || []); weights.push(null); }
    }
    return { g, gi, n, hd, bones, weights, alpha: geosetAlphaTrack(model, gi) };
  });
  const visibleIn = si => {
    const s = model.Sequences[si];
    return geos.map(x => { if (x.alpha == null || isGlobalTrack(x.alpha)) return true; try { return geosetVisibleIn(model, x.alpha, s, s.Interval); } catch { return true; } });
  };
  const alphaAt = (x, si, f) => {
    if (x.alpha == null || typeof x.alpha === 'number') return x.alpha ?? 1;
    const s = model.Sequences[si];
    return sampleTrack(x.alpha, f, { interval: s.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 });
  };
  return { nodes, byId, children, subtree, geos, visibleIn, alphaAt };
}

/** One skinned vertex as `skinGeoset` gives it (single precision), or null when it has no bone. */
function skinnedZ(x, v, matrices) {
  const vs = x.g.Vertices, sw = x.g.SkinWeights, s = v * 3, px = vs[s], py = vs[s + 1], pz = vs[s + 2];
  const group = x.hd ? [sw[v * 8], sw[v * 8 + 1], sw[v * 8 + 2], sw[v * 8 + 3]] : x.g.Groups?.[x.g.VertexGroup?.[v]] || [];
  let ox = 0, oy = 0, oz = 0, total = 0;
  for (let i = 0; i < group.length; i++) {
    const weight = x.hd ? sw[v * 8 + 4 + i] / 255 : 1;
    if (!weight) continue;
    const m = matrices.get(group[i])?.elements;
    ox += (m ? m[0] * px + m[4] * py + m[8] * pz + m[12] : px) * weight;
    oy += (m ? m[1] * px + m[5] * py + m[9] * pz + m[13] : py) * weight;
    oz += (m ? m[2] * px + m[6] * py + m[10] * pz + m[14] : pz) * weight;
    total += weight;
  }
  return total ? [Math.fround(ox / total), Math.fround(oy / total), Math.fround(oz / total)] : [Math.fround(px), Math.fround(py), Math.fround(pz)];
}

/** Lowest skinned point of the shown mesh at a frame (`filter(x, v)` limits the vertices). */
function lowest(info, matrices, vis, si, f, filter = null) {
  let minZ = Infinity, at = null;
  for (const x of info.geos) {
    if (!vis[x.gi] || !x.n || info.alphaAt(x, si, f) <= 0.001) continue;
    for (let v = 0; v < x.n; v++) {
      if (filter && !filter(x, v)) continue;
      const p = skinnedZ(x, v, matrices);
      if (p[2] < minZ) { minZ = p[2]; at = { gi: x.gi, v, p }; }
    }
  }
  return { minZ, at };
}

/** A model's floor: the median lowest point of the skin its legs carry (`legIds`), over its Stand (its soles). */
function floorOf(model, info, legIds, stand) {
  const vis = info.visibleIn(stand), zs = [];
  for (const f of framesOf(model.Sequences[stand])) {
    const { minZ } = lowest(info, sampleNodeMatrices(model, f, stand), vis, stand, f, (x, v) => x.bones[v].some(id => legIds.has(id)));
    if (Number.isFinite(minZ)) zs.push(minZ);
  }
  zs.sort((a, b) => a - b);
  return zs.length ? zs[zs.length >> 1] : null;
}

/** Rewrite a transform track in ONE sequence, only in windows around the frames `turns` (frame -> turn of the value)
 * changes. A window runs from the track's own key before the sample ahead of the first turned frame to its own key after
 * the sample behind the last one; inside it the track is sampled at `frames` (and its own keys), each sample a straight
 * (slerp) step to the next. Its two end keys keep their value and their tangent on the outer side, so the motion outside
 * every window, and in every other sequence, stays exactly the donor's; the track keeps its interpolation type. */
export function rewriteTrack(model, node, si, frames, turns, property = 'Rotation', trackMode = null) {
  const old = isTrack(node[property]) ? node[property] : null;
  const s = model.Sequences[si], [a, z] = s.Interval;
  const sample = f => Array.from(sampleTrack(old, f, { interval: s.Interval, globalSequences: model.GlobalSequences, globalTime: f, fallback: TRANSFORM_DEFAULTS[property], quaternion: property === 'Rotation' }));
  const own = new Map(); if (old) for (const key of old.Keys) if (key.Frame >= a && key.Frame <= z) own.set(key.Frame, key);
  const ownFrames = [...own.keys()].sort((x, y) => x - y);
  if (trackMode === 'trackWindow') return rewriteWindow(node, property, old, own, ownFrames, sample, a, z, frames, turns);
  if (trackMode === 'authoredMotion') return rewriteAuthored(node, property, old, own, ownFrames, sample, a, z, frames, turns);
  const fr = [...new Set([...frames.map(Math.round), ...ownFrames, a, z])].filter(f => f >= a && f <= z).sort((x, y) => x - y);
  const windows = [];
  fr.forEach((f, i) => {
    if (!turns.has(f)) return;
    const lo = fr[i - 1] ?? a, hi = fr[i + 1] ?? z;
    const from = ownFrames.filter(k => k <= lo).pop() ?? a, to = ownFrames.find(k => k >= hi) ?? z;
    const last = windows[windows.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to); else windows.push([from, to]);
  });
  const type = old ? old.LineType : 1, curved = type === 2 || type === 3;
  const mine = [];
  for (const [from, to] of windows) for (const f of fr) {
    if (f < from || f > to) continue;
    const kept = own.get(f);
    if (kept && !turns.has(f) && (f === from || f === to)) {
      // an end key: its value and its outer tangent stay; its inner tangent goes straight into the window
      const key = { ...kept, Vector: new Float32Array(kept.Vector) };
      if (curved && kept.InTan && kept.OutTan) { key.InTan = new Float32Array(f === to ? kept.Vector : kept.InTan); key.OutTan = new Float32Array(f === from ? kept.Vector : kept.OutTan); }
      mine.push(key); continue;
    }
    const value = turns.has(f) ? turns.get(f)(sample(f)) : sample(f), key = { Frame: f, Vector: new Float32Array(value) };
    if (curved) { key.InTan = new Float32Array(value); key.OutTan = new Float32Array(value); }
    mine.push(key);
  }
  return writeCorrectionWindows(node, property, old, windows, mine, type);
}

function rewriteWindow(node, property, old, own, ownFrames, sample, a, z, frames, turns) {
  const solverFrames = [...new Set([...frames.map(Math.round), ...turns.keys(), a, z])].filter(f => f >= a && f <= z).sort((x, y) => x - y);
  const windows = [];
  solverFrames.forEach((f, i) => {
    if (!turns.has(f)) return;
    const lo = solverFrames[i - 1] ?? a, hi = solverFrames[i + 1] ?? z;
    const from = ownFrames.filter(k => k <= lo).pop() ?? a, to = ownFrames.find(k => k >= hi) ?? z;
    const last = windows[windows.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to); else windows.push([from, to]);
  });
  const type = old ? old.LineType : 1, curved = type === 2 || type === 3;
  const mine = [];
  for (const [from, to] of windows) {
    const interior = solverFrames.filter(f => f > from && f < to && (turns.has(f) || !own.has(f)));
    for (const f of [from, ...interior, ...(to > from ? [to] : [])]) {
      const kept = own.get(f);
      if (kept && !turns.has(f) && (f === from || f === to)) {
        // an end key: its value and its outer tangent stay; its inner tangent goes straight into the window
        const key = { ...kept, Vector: new Float32Array(kept.Vector) };
        if (curved && kept.InTan && kept.OutTan) { key.InTan = new Float32Array(f === to ? kept.Vector : kept.InTan); key.OutTan = new Float32Array(f === from ? kept.Vector : kept.OutTan); }
        mine.push(key); continue;
      }
      const value = turns.has(f) ? turns.get(f)(sample(f)) : sample(f), key = { Frame: f, Vector: new Float32Array(value) };
      if (curved) { key.InTan = new Float32Array(value); key.OutTan = new Float32Array(value); }
      mine.push(key);
    }
  }
  return writeCorrectionWindows(node, property, old, windows, mine, type);
}

function rewriteAuthored(node, property, old, own, ownFrames, sample, a, z, frames, turns) {
  const controls = [...new Set([a, z, ...frames.map(Math.round), ...turns.keys()])].filter(f => f >= a && f <= z).sort((x,y) => x-y);
  const corrected = new Map(), corrections = new Map();
  for (const f of controls) {
    if (!turns.has(f)) continue;
    const original = sample(f), target = turns.get(f)([...original]);
    corrected.set(f, target);
    corrections.set(f, property === 'Rotation'
      ? new Quaternion().fromArray(target).normalize().multiply(new Quaternion().fromArray(original).normalize().invert())
      : new Vector3().fromArray(target).sub(new Vector3().fromArray(original)));
  }
  const identity = property === 'Rotation' ? new Quaternion() : new Vector3();
  const fr = [...new Set([...controls, ...ownFrames])].sort((x,y) => x-y);
  const windows = [];
  controls.forEach((f, i) => {
    if (!turns.has(f)) return;
    const lo = controls[i - 1] ?? a, hi = controls[i + 1] ?? z;
    const from = ownFrames.filter(k => k <= lo).pop() ?? a, to = ownFrames.find(k => k >= hi) ?? z;
    const last = windows[windows.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to); else windows.push([from, to]);
  });

  // A span with no fitted motion through it can use its original interpolation
  // and tangents exactly. A solver sample inside that span needs no new key.
  const nativeFrom = new Set(), nativeTo = new Set(), skipped = new Set();
  const influenced = new Set();
  let ci = 0;
  const fittedValue = new Map();
  for (const f of fr) {
    while (ci + 1 < controls.length && controls[ci + 1] <= f) ci++;
    const left = controls[ci], right = controls[ci+1] ?? left;
    if (corrected.has(f)) {
      influenced.add(f);
      fittedValue.set(f,corrected.get(f));
    } else if (f !== left && (corrections.has(left) || corrections.has(right))) {
      influenced.add(f);
      const delta = (corrections.get(left) ?? identity).clone(), end = corrections.get(right) ?? identity;
      const t = (f-left)/(right-left), native = sample(f);
      fittedValue.set(f, property === 'Rotation'
        ? delta.slerp(end,t).multiply(new Quaternion().fromArray(native)).normalize().toArray()
        : delta.lerp(end,t).add(new Vector3().fromArray(native)).toArray());
    }
  }
  let interior = [];
  for (const f of fr) {
    if (interior.length && own.has(f)) {
      const left = interior[0];
      if (!influenced.has(f) && !interior.some(k => influenced.has(k))) {
        nativeFrom.add(left); nativeTo.add(f);
        for (const k of interior.slice(1)) skipped.add(k);
      }
      interior = [];
    }
    if (own.has(f) || interior.length) interior.push(f);
  }
  const type = old ? old.LineType : 1, curved = type === 2 || type === 3;
  const mine = [];
  for (const [from, to] of windows) for (const f of fr) {
    if (f < from || f > to || skipped.has(f)) continue;
    const kept = own.get(f), value = fittedValue.get(f) ?? sample(f);
    const key = {Frame:f, Vector:new Float32Array(value)};
    if (curved) {
      key.InTan = new Float32Array(kept?.InTan && (nativeTo.has(f) || f === from && !influenced.has(f)) ? kept.InTan : value);
      key.OutTan = new Float32Array(kept?.OutTan && (nativeFrom.has(f) || f === to && !influenced.has(f)) ? kept.OutTan : value);
    }
    mine.push(key);
  }
  return writeCorrectionWindows(node, property, old, windows, mine, type);
}

function writeCorrectionWindows(node, property, old, windows, mine, type) {
  const others = old ? old.Keys.filter(k => !windows.some(([p, q]) => k.Frame >= p && k.Frame <= q)) : [];
  const keys = [...others, ...mine].sort((x, y) => x.Frame - y.Frame);
  if (old) old.Keys = keys;
  else node[property] = { Keys: keys, LineType: 1, GlobalSeqId: null };
  return windows;
}

// An independent weapon has no shoulder in its parent chain. Apply the same
// world-space shoulder turn to the held weapon, including its grip, only in
// the corrected windows. Its existing keys elsewhere still carry the donor.
function carryHeldWeapon(M, original, boneId, arms, handAt, plans, trackMode) {
  const bone = M.Nodes[boneId], pivot = v3(nodePivot(M,bone));
  for (const si of new Set(plans.map(p=>p.si))) {
    const seq = M.Sequences[si], [a,b] = seq.Interval;
    const affected = plans.filter(p=>p.si===si), frames = new Set([a,b]);
    for (const plan of affected) {
      for (const f of plan.frames) frames.add(f);
      for (const k of M.Nodes[plan.arm.joint].Rotation.Keys)
        if (k.Frame>=a && k.Frame<=b) frames.add(k.Frame);
    }
    for (const track of [bone.Translation,bone.Rotation])
      for (const k of track?.Keys || []) if (k.Frame>=a && k.Frame<=b) frames.add(k.Frame);
    const angles = new Map(), offsets = new Map();
    for (const frame of frames) {
      const hand = handAt(si,frame), arm = arms.find(x=>x.hand===hand);
      if (!arm || !affected.some(plan=>plan.arm.joint===arm.joint)) continue;
      const before = sampleNodeMatrices(original,frame,si), after = sampleNodeMatrices(M,frame,si);
      const from = before.get(arm.joint), to = after.get(arm.joint);
      if (Math.abs(from.determinant())<1e-8 || from.elements.every((v,i)=>Math.abs(v-to.elements[i])<1e-8)) continue;
      const desired = to.clone().multiply(from.clone().invert()).multiply(before.get(boneId));
      const parent = after.get(bone.Parent);
      if (parent) {
        const basis = inheritedParentMatrix(parent,bone.Flags);
        if (Math.abs(basis.determinant())<1e-8) continue;
        desired.premultiply(basis.clone().invert());
      }
      if (Math.abs(desired.determinant())<1e-8) continue;
      const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
      desired.decompose(position,rotation,scale);
      const offset = position.sub(pivot).add(pivot.clone().multiply(scale).applyQuaternion(rotation));
      angles.set(frame,()=>rotation.toArray());
      offsets.set(frame,()=>offset.toArray());
    }
    if (angles.size) {
      rewriteTrack(M,bone,si,[...frames],angles,'Rotation',trackMode);
      rewriteTrack(M,bone,si,[...frames],offsets,'Translation',trackMode);
    }
  }
}

// Keep an unarmed quadruped's planted hand fixed while a held rigid tool
// rotates around it. Only the tool moves, and only while it would sink.
function fitSupportTool(model,info,id,floor,trackMode) {
  const node = info.byId.get(id), pivot = v3(node.PivotPoint), vertices = [];
  for (const geo of info.geos) for (let v=0; v<geo.n; v++) {
    if (geo.bones[v].length === 1 && geo.bones[v][0] === id) vertices.push(v3(geo.g.Vertices.subarray(3*v,3*v+3)));
  }
  if (!vertices.length) return;
  for (const [si,sequence] of model.Sequences.entries()) {
    if (!sequence.Interval || NO_GROUND.test(sequence.Name)) continue;
    const times = new Set(framesOf(sequence));
    for (let at = node.Parent; info.byId.has(at); at = info.byId.get(at).Parent) {
      for (const k of info.byId.get(at).Rotation?.Keys || []) if (k.Frame >= sequence.Interval[0] && k.Frame <= sequence.Interval[1]) times.add(k.Frame);
    }
    const frames = [...times].sort((a,b)=>a-b), turns=new Map();
    let previous = null;
    for (const frame of frames) {
      const world=sampleNodeMatrices(model,frame,si).get(node.Parent), grip=pivot.clone().applyMatrix4(world);
      const points=vertices.map(v=>{ const p=v.clone().applyMatrix4(world), delta=p.clone().sub(grip); return {z:p.z,dz:delta.z,radius:Math.hypot(delta.x,delta.y),axis:Math.atan2(-delta.x,delta.y)}; });
      if (points.every(p=>p.z >= floor-0.15)) { previous=null; continue; }
      const low=points.reduce((a,b)=>a.z<b.z?a:b);
      const {axis,th}=floorTurn(points,floor,previous ?? low.axis,previous);
      previous=Math.atan2(axis.y,axis.x);
      const local=axis.transformDirection(new Matrix4().extractRotation(world).invert());
      const rotation=new Quaternion().setFromAxisAngle(local,th);
      turns.set(frame,()=>rotation.toArray());
    }
    if (turns.size) rewriteTrack(model,node,si,frames,turns,'Rotation',trackMode);
  }
}

// With two support pairs, the lowest contact alternates between the fore and
// hind legs. Preserve the body path and absorb their changing reach at the knees.
export function fitWalkContacts(model, si, parts, frames, heights, tolerance, fixedBias = null, individual = false, trackMode = null) {
  const chains = parts.map(p => [p.joints[0],p.joints[1],p.marker]);
  if (chains.length < (individual ? 1 : fixedBias == null ? 4 : 2) || chains.some(ids => new Set(ids).size !== 3 ||
      ids.some(id => !model.Nodes[id] || isGlobalTrack(model.Nodes[id].Rotation,model)))) return null;
  const sorted = [...heights].sort((a,b) => a-b);
  if (individual ? sorted.every(v=>Math.abs(v)<=tolerance) : sorted.at(-1)-sorted[0] <= tolerance) return null;
  const bias = fixedBias ?? sorted[Math.floor(sorted.length/2)];
  const turns = chains.map(() => [new Map(),new Map(),new Map()]);
  const turn = (a,b) => new Quaternion().setFromUnitVectors(a.normalize(),b.normalize());
  for (const [j,frame] of frames.entries()) {
    const mats = sampleNodeMatrices(model,frame,si);
    for (const [i,ids] of chains.entries()) {
      const nodes = ids.map(id => model.Nodes[id]);
      const [root,middle,end] = nodes.map(n => v3(nodePivot(model,n)).applyMatrix4(mats.get(n.ObjectId)));
      const lengths = [root.distanceTo(middle),middle.distanceTo(end)];
      if (Math.min(...lengths)<1e-5) continue;
      const target = end.clone(); target.z += heights[j]-bias;
      const solved = solveTwoBone({root,middle,end,lengths,tolerance:1e-5},target);
      const swing = [turn(middle.clone().sub(root),solved.middle.clone().sub(root)),
        turn(end.clone().sub(middle),solved.end.clone().sub(solved.middle)),new Quaternion()];
      let previous = new Quaternion();
      for (const [k,n] of nodes.entries()) {
        const parentMatrix = inheritedParentMatrix(mats.get(n.Parent) || new Matrix4(),n.Flags);
        const parent = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(parentMatrix)).normalize();
        const local = parent.clone().invert().multiply(previous.clone().invert()).multiply(swing[k]).multiply(parent);
        turns[i][k].set(frame, v => local.clone().multiply(new Quaternion().fromArray(v)).normalize().toArray());
        previous = swing[k];
      }
    }
  }
  for (const [i,ids] of chains.entries()) for (const [k,id] of ids.entries())
    if (turns[i][k].size) rewriteTrack(model,model.Nodes[id],si,frames,turns[i][k],'Rotation',trackMode);
  return bias;
}

// A hand carrying the donor's weight is a foot. Lift its contact surface
// vertically with the POSE elbow solve, keeping its stride and paw orientation.
function plantSupportPalms(model, info, parts, floor, equipment, trackMode) {
  const report = [];
  for (const part of parts) {
    const chain = part.joints;
    const joints = [chain[0], chain[1], chain.at(-1)];
    const nodes = joints.map(id => info.byId.get(id));
    const palm = info.subtree(joints[2]);
    for (const id of equipment) palm.delete(id);
    const handSkin = (geo, v) => geo.bones[v].some(id => palm.has(id));
    for (const [si, seq] of model.Sequences.entries()) {
      if (!seq.Interval || NO_GROUND.test(seq.Name || '')) continue;
      const [a, b] = seq.Interval, samples = new Set([a, b]);
      for (let t = a; t < b; t += DENSE) samples.add(Math.round(t));
      for (const id of chain) for (const key of info.byId.get(id)?.Rotation?.Keys || []) {
        if (key.Frame >= a && key.Frame <= b) samples.add(key.Frame);
      }
      const frames = [...samples].sort((x, y) => x - y), visible = info.visibleIn(si);
      const values = joints.map(() => new Map());
      let maxTurn = 0;
      for (const frame of frames) {
        const mats = sampleNodeMatrices(model, frame, si);
        const lift = floor - lowest(info, mats, visible, si, frame, handSkin).minZ;
        if (!(lift > 0)) continue;
        const [root, middle, end] = nodes.map(n => v3(nodePivot(model, n)).applyMatrix4(mats.get(n.ObjectId)));
        const lengths = [root.distanceTo(middle), middle.distanceTo(end)];
        if (Math.min(...lengths) < 1e-5) continue;
        const target = end.clone();
        target.z += lift;
        const solved = solveTwoBone({root, middle, end, lengths, tolerance: 1e-5}, target);
        const turn = (from, to) => new Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
        const upper = turn(middle.clone().sub(root), solved.middle.clone().sub(root));
        const lower = turn(end.clone().sub(middle), solved.end.clone().sub(solved.middle));
        const deltas = [upper, lower, new Quaternion()];
        let parentDelta = new Quaternion();
        for (const [i, n] of nodes.entries()) {
          const basis = new Matrix4().extractRotation(mats.get(n.Parent) || new Matrix4());
          const parent = new Quaternion().setFromRotationMatrix(basis).normalize();
          const local = parent.clone().invert().multiply(parentDelta.clone().invert()).multiply(deltas[i]).multiply(parent);
          values[i].set(frame, v => local.clone().multiply(new Quaternion().fromArray(v)).normalize().toArray());
          parentDelta = deltas[i];
        }
        maxTurn = Math.max(maxTurn, upper.angleTo(new Quaternion()));
      }
      if (!values[0].size) continue;
      const windows = rewriteTrack(model, nodes[0], si, frames, values[0], 'Rotation', trackMode);
      for (let i = 1; i < nodes.length; i++) rewriteTrack(model, nodes[i], si, frames, values[i], 'Rotation', trackMode);
      report.push({sequence: seq.Name, arm: part.key, joint: joints[0], frames: values[0].size,
        turn: maxTurn * DEG, spans: windows.map(([p,q]) => [p-a,q-a])});
    }
  }
  return report;
}

/**
 * Turn the arms of a transplant result up at their first joint where their mesh would go under the floor.
 * `M`: the result (changed in place). `ownHeight`: the open model's bind height. `arms`: [{ key, joints }] and `legs`:
 * [{ joints }] in result ids (the donor's limbs). `weapon`: { bone, swap } — the result's weapon bone and the donor's
 * thrown/dropped spans (`donorWeaponSwap`). `donor`: { model, arms, legs (donor ids, same keys), size (this model's size over
 * the donor's) }: an arm may go as deep under the floor as the donor's own arm goes under the donor's floor at that moment,
 * times the size ratio (a ghoul's claws that scrape the ground; a model on its own skeleton is unchanged), so only the depth
 * the model's longer arm or weapon adds is turned away. Returns per animation and arm: { sequence, arm, joint (result id), frames
 * (how many samples turned), turn (largest, degrees), spans ([from, to] from the animation's start: outside them every key
 * is the donor's) }.
 */
export function bendArmsAboveFloor(M, { ownHeight, arms: armParts, legs: legParts, weapon = {}, donor = null, tailFloor = false, fallingSurface = false, trackMode = null }) {
  const out = [];
  const stand = standSequenceIndex(M);
  if (stand < 0 || !armParts.length || !legParts.length || !(ownHeight > 0)) return out;
  const info = skinInfo(M), H = ownHeight, tol = (tailFloor ? .001 : TOLERANCE) * H;
  const valid = armParts.filter(p => p.joints.length && p.joints.every(id => info.byId.has(id)));
  const supports = valid.filter(p => p.support && new Set([p.joints[0], p.joints[1], p.joints.at(-1)]).size === 3
    && p.joints.length >= 3 && p.joints.every(id => !isGlobalTrack(info.byId.get(id).Rotation, M)));
  const arms = valid.filter(p => !supports.includes(p))
    .map(p => ({ key: p.key, joint: p.joints[0], hand: p.joints[p.joints.length - 1], ids: info.subtree(p.joints[0]) }));
  // The floor: the median lowest point of the skin the legs carry, over the result's Stand (its soles).
  const legIds = new Set(legParts.flatMap(p => p.joints.filter(id => info.byId.has(id)).flatMap(id => [...info.subtree(id)])));
  const floor = tailFloor ? 0 : floorOf(M, info, legIds, stand);
  if (floor == null) return out;
  const equipment = weapon.supportGear || [];
  out.push(...plantSupportPalms(M, info, supports, floor, equipment, trackMode));
  for (const id of equipment) fitSupportTool(M,info,id,floor,trackMode);
  if (!arms.length) return out;
  const swap = weapon.swap || [];
  const handAt = (si,f) => weapon.hands ? sampleTrack(weapon.hands,f,{interval:M.Sequences[si].Interval,fallback:-1}) : -1;
  // The donor's own arms under the donor's floor at the same moment (by arm key), in this model's size.
  let donorDip = () => 0;
  const D = donor?.model, dStand = D ? standSequenceIndex(D) : -1;
  if (D && dStand >= 0 && donor.size > 0) {
    const dInfo = skinInfo(D), dLegs = new Set(donor.legs.flatMap(p => p.joints.filter(id => dInfo.byId.has(id)).flatMap(id => [...dInfo.subtree(id)])));
    // the donor's weapon where the engine moved it onto its thrown or dropped copy (`donorWeaponSwap`) is not in its hand
    const dWeapon = donor.weapon != null && dInfo.byId.has(donor.weapon) ? dInfo.subtree(donor.weapon) : new Set();
    const dLoose = (s, f) => dWeapon.size && swap.some(item => item.sequence === s.Name && item.spans.some(([a, b]) => f >= s.Interval[0] + a && f <= s.Interval[0] + b));
    const dFloor = floorOf(D, dInfo, dLegs, dStand), dArms = new Map(donor.arms.filter(p => p.joints.length && dInfo.byId.has(p.joints[0])).map(p => [p.key, dInfo.subtree(p.joints[0])]));
    const dSeq = new Map((D.Sequences || []).map((q, i) => [`${q.Name}|${q.Interval?.[0]}|${q.Interval?.[1]}`, i]));
    const cache = new Map();
    if (dFloor != null) donorDip = (si, f, key) => {
      const s = M.Sequences[si], di = dSeq.get(`${s.Name}|${s.Interval[0]}|${s.Interval[1]}`), ids = dArms.get(key);
      if (di == null || !ids) return 0;
      const id = `${di}|${f}|${key}`;
      if (!cache.has(id)) {
        const loose = dLoose(s, f);
        const fitsBow = weapon.hands && arms.some(arm=>arm.key===key && arm.hand===handAt(si,f));
        const lo = lowest(dInfo, sampleNodeMatrices(D, f, di), dInfo.visibleIn(di), di, f, (x, v) => x.bones[v].some(b => ids.has(b) || fitsBow && b===donor.weapon) && !(loose && x.bones[v].some(b => dWeapon.has(b))));
        cache.set(id, Number.isFinite(lo.minZ) ? Math.max(0, dFloor - lo.minZ) * donor.size : 0);
      }
      return cache.get(id);
    };
  }
  // Roots that carry the shown body: parentless ancestors of skinned bones with something animated under them.
  const skinned = new Set(info.geos.flatMap(x => x.bones.flat()));
  const animated = id => { const n = info.byId.get(id); return ['Translation', 'Rotation', 'Scaling'].some(p => n?.[p]?.Keys?.length); };
  const roots = info.nodes.filter(n => (n.Parent == null || !info.byId.has(n.Parent)) && [...info.subtree(n.ObjectId)].some(id => skinned.has(id)) && [...info.subtree(n.ObjectId)].some(animated)).map(n => n.ObjectId);
  // A weapon the donor has thrown or dropped is not held: in a stretch the engine took from the loose copy AND a quarter
  // height farther from its hand than at rest (Arthas holds the hammer most of Stand Fifth before he lets it fall).
  const weaponName = weapon.bone != null ? info.byId.get(weapon.bone)?.Name : null;
  const weaponIds = new Set(info.nodes.filter(n => weaponName != null && n.Name === weaponName).flatMap(n => [...info.subtree(n.ObjectId)]));
  const weaponId = info.nodes.find(n => weaponName != null && n.Name === weaponName)?.ObjectId;
  const weaponHand = arms.find(arm => weaponId != null && arm.ids.has(weaponId))?.hand;
  const pivotAt = (mats, id) => v3(nodePivot(M, info.byId.get(id))).applyMatrix4(mats.get(id));
  const rest = weaponId != null && weaponHand != null ? v3(nodePivot(M, info.byId.get(weaponId))).distanceTo(v3(nodePivot(M, info.byId.get(weaponHand)))) : 0;
  const loose = (si, f, mats) => {
    if (weaponHand == null) return false;
    const s = M.Sequences[si];
    if (!swap.some(item => item.sequence === s.Name && item.spans.some(([a, b]) => f >= s.Interval[0] + a && f <= s.Interval[0] + b))) return false;
    return pivotAt(mats, weaponId).distanceTo(pivotAt(mats, weaponHand)) > rest + 0.25 * H;
  };
  const held = (si, f, mats, filter = null) => !weaponIds.size || !loose(si, f, mats) ? filter : (x, v) => !x.bones[v].some(b => weaponIds.has(b)) && (!filter || filter(x, v));

  const plans = [];
  M.Sequences.forEach((s, si) => {
    const falling = fallingSurface && /^(death|decay)\b/i.test(s.Name || '');
    if ((!falling && NO_GROUND.test(s.Name || '')) || !s.Interval) return;
    // an arm whose first joint turns on a global sequence cannot take keys in one animation
    const free = arms.filter(arm => !isGlobalTrack(info.byId.get(arm.joint).Rotation, M));
    if (!free.length) return;
    const vis = info.visibleIn(si), [a, z] = s.Interval;
    const coarseSet = new Set(framesOf(s));
    for (const id of [...roots, ...free.map(arm => arm.joint)]) for (const p of ['Translation', 'Rotation']) for (const k of info.byId.get(id)?.[p]?.Keys || []) if (k.Frame >= a && k.Frame <= z) coarseSet.add(k.Frame);
    const coarse = [...coarseSet].sort((x, y) => x - y);
    const solve = (f, previous = null) => {
      const mats = sampleNodeMatrices(M, f, si), keep = held(si, f, mats);
      const lo = lowest(info, mats, vis, si, f, keep);
      const grippingHand = handAt(si,f);
      const row = { f, sinks: floor - lo.minZ > (grippingHand>=0 ? 0 : tol), bend: {} };
      if (!row.sinks) return row;
      for (const arm of free) {
        const holdsBow = arm.hand===grippingHand;
        // Aim the interpolated independent-weapon track at the actual floor.
        // The ordinary clearance tolerance includes error between sample times.
        const clearance = holdsBow ? 0 : tol;
        const carried = id => arm.ids.has(id) || holdsBow && id===weapon.bone;
        const inArm = (x, v) => x.bones[v].some(carried);
        const a0 = lowest(info, mats, vis, si, f, held(si, f, mats, inArm));
        if (!(a0.minZ < floor - clearance)) continue;
        const level = floor - clearance - (fallingSurface && !falling ? 0 : donorDip(si, f, arm.key));
        if (!(a0.minZ < level)) continue;
        const s0 = pivotAt(mats, arm.joint);
        const hand = pivotAt(mats, arm.hand).sub(s0);
        const preferred = Math.atan2(-hand.x, hand.y);
        const points = [];
        const included = held(si, f, mats, inArm);
        for (const geo of info.geos) {
          if (!vis[geo.gi] || !geo.n || info.alphaAt(geo, si, f) <= 0.001) continue;
          for (let v = 0; v < geo.n; v++) {
            if (!included(geo, v)) continue;
            const local = new Vector3().fromArray(geo.g.Vertices, v * 3);
            const relative = new Vector3();
            let z = 0, total = 0;
            geo.bones[v].forEach((id,i) => {
              const matrix = mats.get(id);
              if (!matrix) return;
              const w = geo.weights[v]?.[i] ?? 1;
              const world = local.clone().applyMatrix4(matrix);
              z += w * world.z;
              total += w;
              if (carried(id)) relative.addScaledVector(world.sub(s0), w);
            });
            if (!total) continue;
            relative.divideScalar(total);
            points.push({z:z/total, dz:relative.z, radius:Math.hypot(relative.x,relative.y),
              axis:Math.atan2(-relative.x,relative.y)});
          }
        }
        const parent = info.byId.get(arm.joint).Parent, PM = parent != null && mats.get(parent) ? mats.get(parent) : new Matrix4();
        const parentTurn = new Matrix4().extractRotation(PM);
        const prev = previous?.bend?.[arm.key];
        const axisBefore = prev ? v3(prev.axisL).transformDirection(parentTurn) : null;
        // Opposite sides of a nearly vertical weapon can clear at the same
        // angle. Continue the preceding correction through these poses. The
        // cap applies only to the additional axis in the moving parent frame.
        const prior = axisBefore ? Math.atan2(axisBefore.y,axisBefore.x) : null;
        const maxChange = previous ? Math.min(Math.PI,(f-previous.f)*0.25/DEG) : Math.PI;
        const {axis, th} = floorTurn(points,level,preferred,prior,maxChange);
        // the turn in the joint's parent frame (the parent's turn, its scale dropped)
        const axisL = axis.clone().applyMatrix4(new Matrix4().extractRotation(PM).invert()).normalize();
        row.bend[arm.key] = { th, axisL: axisL.toArray() };
      }
      return row;
    };
    const dipping = r => r.sinks || Object.keys(r.bend).length;
    const first = coarse.map(f => solve(f));
    if (!first.some(dipping)) return;
    // dense samples (every ~8 ms) between the neighbours of every dipping sample: the swing into a dip is fast
    const dense = new Set(coarse);
    first.forEach((r, i) => { if (!dipping(r)) return; const a0 = coarse[Math.max(0, i - 1)], z0 = coarse[Math.min(coarse.length - 1, i + 1)]; for (let t = a0; t <= z0; t += DENSE) dense.add(Math.round(t)); });
    const frames = [...dense].sort((x, y) => x - y);
    const known = new Map(coarse.map((f, i) => [f, first[i]]));
    let rows = [];
    for (const f of frames) {
      const previous = rows.at(-1);
      rows.push(previous && Object.keys(previous.bend).length ? solve(f,previous) : known.get(f) || solve(f));
    }
    // Hold clearance for a fixed duration. A donor key can be only one
    // millisecond from a regular sample: borrowing the next sample's turn
    // directly squeezed an eight-ms correction into that one millisecond.
    rows = rows.map((r,i) => {
      const bend = { ...r.bend };
      const consider = (key, th, source) => {
        if (th > (bend[key]?.th ?? 0)) bend[key] = {th,axisL:r.bend[key]?.axisL ?? source.axisL};
      };
      for (const step of [-1,1]) {
        const end = r.f + step*DENSE;
        let inside = r;
        for (let j=i+step; j>=0 && j<rows.length; j+=step) {
          const edge = rows[j];
          const fraction = Math.min(1,(end-inside.f)/(edge.f-inside.f));
          for (const key of new Set([...Object.keys(inside.bend),...Object.keys(edge.bend)])) {
            const a = inside.bend[key], b = edge.bend[key];
            consider(key,(a?.th ?? 0)*(1-fraction)+(b?.th ?? 0)*fraction,b ?? a);
          }
          if ((edge.f-end)*step >= 0) break;
          inside = edge;
        }
      }
      return {f:r.f,bend};
    });
    for (const arm of free) {
      const at = new Map(rows.filter(r => r.bend[arm.key]).map(r => [r.f, r.bend[arm.key]]));
      if (at.size) plans.push({ si, arm, frames, at });
    }
  });
  // Every turn is measured on the result as the donor moves it; the keys change only now.
  const beforeBend = weapon.hands && plans.length ? structuredClone(M) : null;
  for (const { si, arm, frames, at } of plans) {
    const node = info.byId.get(arm.joint);
    const turns = new Map([...at].map(([f, b]) => [f, v => new Quaternion().setFromAxisAngle(v3(b.axisL), b.th).multiply(new Quaternion().fromArray(v)).normalize().toArray()]));
    const start = M.Sequences[si].Interval[0], windows = rewriteTrack(M, node, si, frames, turns, 'Rotation', trackMode);
    out.push({ sequence: M.Sequences[si].Name, arm: arm.key, joint: arm.joint, frames: at.size, turn: Math.max(...[...at.values()].map(b => b.th)) * DEG, spans: windows.map(([p, q]) => [p - start, q - start]) });
  }
  if (beforeBend) carryHeldWeapon(M,beforeBend,weapon.bone,arms,handAt,plans,trackMode);
  return out;
}

// Copy the contact height of each donor paw with all the articulated links.
// Damped increments keep the original elbow plane continuous at full reach.
export function followSupportFeet(model, donor, chains, floor, gear, fitLimbs, height, trackMode = null) {
  const curves=new Map();
  const info=skinInfo(model), source=skinInfo(donor);
  const skin=(info,ids,omit=[])=>{
    const limb=info.subtree(ids.at(-1));
    for (const j of omit) limb.delete(j);
    return (g,v)=>g.bones[v].some(id=>limb.has(id));
  };
  const rests=chains.map(c=>({own:skin(info,c.own,gear),donor:skin(source,c.donor)}));
  for (const [si,seq] of model.Sequences.entries()) {
    if (!/^walk\b/i.test(seq.Name) || /swim|morph/i.test(seq.Name) || !seq.Interval) continue;
    const di=donor.Sequences.findIndex(s=>s.Interval?.[0]===seq.Interval[0] && s.Interval[1]===seq.Interval[1]);
    if (di<0) continue;
    const [a,b]=seq.Interval, samples=new Set([a,b]);
    for (let t=a;t<b;t+=1000/60) samples.add(Math.round(t));
    for (const c of chains) for (const id of c.own) for (const k of model.Nodes[id].Rotation?.Keys || [])
      if (k.Frame>a && k.Frame<b) samples.add(k.Frame);
    const frames=[...samples].sort((x,y)=>x-y), visible=info.visibleIn(si), donorVisible=source.visibleIn(di);
    const poses=frames.map(t=>sampleNodeMatrices(model,t,si));
    const sources=frames.map(t=>sampleNodeMatrices(donor,t,di));
    const pawHeights=rests.map(sole=>frames.map((t,j)=>lowest(source,sources[j],donorVisible,di,t,sole.donor).minZ));
    const ground=frames.map((_,j)=>Math.min(...pawHeights.map(p=>p[j])));
    if (fitLimbs) for (const [ci,chain] of chains.entries()) {
      const ids=chain.own, nodes=ids.map(j=>model.Nodes[j]);
      if (ids.length<3 || ids.some((j,k)=>k && model.Nodes[j].Parent!==ids[k-1]) ||
          nodes.some(n=>isGlobalTrack(n.Rotation,model))) continue;
      const low=frames.map((t,j)=>lowest(info,poses[j],visible,si,t,rests[ci].own).minZ);
      const paw=pawHeights[ci];
      if (![...low,...paw].every(Number.isFinite)) continue;
      const turns=ids.map(()=>new Map()), angles=[];
      for (const [j,frame] of frames.entries()) {
        const matrices=poses[j],points=nodes.map(n=>v3(nodePivot(model,n)).applyMatrix4(matrices.get(n.ObjectId)));
        const travel=floor+(paw[j]-ground[j])*chain.ratio-low[j];
        const lengths=points.slice(1).map((p,k)=>p.distanceTo(points[k]));
        const end=points.at(-1),targetX=end.x,targetZ=end.z+travel,length=lengths.reduce((u,v)=>u+v,0);
        const total=Array(ids.length-1).fill(0),up=new Vector3(0,1,0);
        for (let step=0;step<5;step++) {
          const lever=points.slice(0,-1).map(p=>[end.z-p.z,p.x-end.x]);
          const damp=(.11*length)**2;
          let xx=damp,xz=0,zz=damp;
          for (const [x,z] of lever) { xx+=x*x; xz+=x*z; zz+=z*z; }
          const det=xx*zz-xz*xz;
          if (det<1e-8) break;
          const dx=targetX-end.x,dz=targetZ-end.z;
          const u=(zz*dx-xz*dz)/det,v=(xx*dz-xz*dx)/det;
          for (const [k,[x,z]] of lever.entries()) {
            const next=Math.max(-.40,Math.min(.40,total[k]+Math.max(-.10,Math.min(.10,x*u+z*v))));
            const angle=next-total[k];total[k]=next;
            for (let m=k+1;m<points.length;m++) points[m].sub(points[k]).applyAxisAngle(up,angle).add(points[k]);
          }
        }
        angles.push(total);
      }
      for (const [j,frame] of frames.entries()) {
        const total = Array(ids.length-1).fill(0), span=b-a, window=span/9;
        let weight=0;
        for (let m=0;m<frames.length-1;m++) {
          const distance=Math.abs(frame-frames[m]), phase=Math.min(distance,span-distance);
          if (phase>=window) continue;
          const w=(frames[m+1]-frames[m])*(1+Math.cos(Math.PI*phase/window));
          weight+=w;
          angles[m].forEach((angle,k)=>total[k]+=w*angle);
        }
        total.forEach((value,k)=>total[k]=value/weight);
        total.push(-total.reduce((u,v)=>u+v,0));
        const matrices=poses[j], up=new Vector3(0,1,0);
        for (const [k,n] of nodes.entries()) {
          const pm=inheritedParentMatrix(matrices.get(n.Parent)||new Matrix4(),n.Flags);
          const axis=up.clone().transformDirection(new Matrix4().extractRotation(pm).invert());
          const q=new Quaternion().setFromAxisAngle(axis,total[k]);
          turns[k].set(frame,value=>q.clone().multiply(new Quaternion().fromArray(value)).normalize().toArray());
        }
      }
      for (const [k,n] of nodes.entries()) rewriteTrack(model,n,si,frames,turns[k],'Rotation',trackMode);
    }
    // Settle the remaining reach error on the common support plane. Only its
    // slow component belongs on the body; keep rapid handoffs in the limbs.
    const supports=(g,v)=>rests.some(r=>r.own(g,v));
    const donorPlane=[...ground].sort((u,v)=>u-v)[ground.length>>1];
    const size=chains.reduce((sum,c)=>sum+c.ratio,0)/chains.length;
    const error=frames.map((t,j)=>{
      const actual=lowest(info,fitLimbs?sampleNodeMatrices(model,t,si):poses[j],visible,si,t,supports).minZ;
      return floor-actual+(fitLimbs?0:(ground[j]-donorPlane)*size);
    });
    if (!error.every(Number.isFinite)) continue;
    const values=frames.map(t=>{
      const span=b-a,window=span/7;let sum=0,weight=0;
      for (let j=0;j<frames.length-1;j++) {
        const dt=Math.abs(t-frames[j]),dist=Math.min(dt,span-dt);
        if (dist>=window) continue;
        const w=(frames[j+1]-frames[j])*(1+Math.cos(Math.PI*dist/window));
        sum+=w*error[j];weight+=w;
      }
      const band=(fitLimbs ? .06 : .025)*height;
      return band*Math.tanh(sum/(weight*band));
    });
    curves.set(si,{frames,values});
  }
  return curves;
}
