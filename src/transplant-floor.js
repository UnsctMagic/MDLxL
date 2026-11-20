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
function rewriteTrack(model, node, si, frames, turns, property = 'Rotation') {
  const old = isTrack(node[property]) ? node[property] : null;
  const s = model.Sequences[si], [a, z] = s.Interval;
  const sample = f => Array.from(sampleTrack(old, f, { interval: s.Interval, globalSequences: model.GlobalSequences, globalTime: f, fallback: TRANSFORM_DEFAULTS[property], quaternion: property === 'Rotation' }));
  const own = new Map(); if (old) for (const key of old.Keys) if (key.Frame >= a && key.Frame <= z) own.set(key.Frame, key);
  const ownFrames = [...own.keys()].sort((x, y) => x - y);
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
  const others = old ? old.Keys.filter(k => !windows.some(([p, q]) => k.Frame >= p && k.Frame <= q)) : [];
  const keys = [...others, ...mine].sort((x, y) => x.Frame - y.Frame);
  if (old) old.Keys = keys;
  else node[property] = { Keys: keys, LineType: 1, GlobalSeqId: null };
  return windows;
}

// An independent weapon has no shoulder in its parent chain. Apply the same
// world-space shoulder turn to the held weapon, including its grip, only in
// the corrected windows. Its existing keys elsewhere still carry the donor.
function carryHeldWeapon(M, original, boneId, arms, handAt, plans) {
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
      rewriteTrack(M,bone,si,[...frames],angles,'Rotation');
      rewriteTrack(M,bone,si,[...frames],offsets,'Translation');
    }
  }
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
export function bendArmsAboveFloor(M, { ownHeight, arms: armParts, legs: legParts, weapon = {}, donor = null }) {
  const out = [];
  const stand = standSequenceIndex(M);
  if (stand < 0 || !armParts.length || !legParts.length || !(ownHeight > 0)) return out;
  const info = skinInfo(M), H = ownHeight, tol = TOLERANCE * H;
  const arms = armParts.filter(p => p.joints.length && p.joints.every(id => info.byId.has(id)))
    .map(p => ({ key: p.key, joint: p.joints[0], hand: p.joints[p.joints.length - 1], ids: info.subtree(p.joints[0]) }));
  if (!arms.length) return out;
  // The floor: the median lowest point of the skin the legs carry, over the result's Stand (its soles).
  const legIds = new Set(legParts.flatMap(p => p.joints.filter(id => info.byId.has(id)).flatMap(id => [...info.subtree(id)])));
  const floor = floorOf(M, info, legIds, stand);
  if (floor == null) return out;
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
    if (NO_GROUND.test(s.Name || '') || !s.Interval) return;
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
        const level = floor - clearance - donorDip(si, f, arm.key);
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
    const start = M.Sequences[si].Interval[0], windows = rewriteTrack(M, node, si, frames, turns);
    out.push({ sequence: M.Sequences[si].Name, arm: arm.key, joint: arm.joint, frames: at.size, turn: Math.max(...[...at.values()].map(b => b.th)) * DEG, spans: windows.map(([p, q]) => [p - start, q - start]) });
  }
  if (beforeBend) carryHeldWeapon(M,beforeBend,weapon.bone,arms,handAt,plans);
  return out;
}
