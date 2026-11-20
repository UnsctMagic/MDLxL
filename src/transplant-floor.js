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
import { TRANSFORM_DEFAULTS, allNodes, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack } from './animation.js';
import { geosetAlphaTrack, geosetVisibleIn } from './geoset-extras.js';
import { standSequenceIndex } from './sequence-editor.js';

const STEP = 1000 / 30, DENSE = 1000 / 120, DEG = 180 / Math.PI;
/** Residual allowed under the floor, in own heights. */
const TOLERANCE = 0.02;
/** Animations with no ground to keep: the body lies, rises, swims, sleeps or is a portrait or cinematic. */
const NO_GROUND = /death|decay|dissipate|birth|portrait|morph|sleep|swim|cinematic/i;
const isTrack = t => t && typeof t === 'object' && Array.isArray(t.Keys);
const v3 = value => new Vector3().fromArray(value);

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

/** Rewrite a node's Rotation in ONE sequence, only in windows around the frames `turns` (frame -> turn of the value)
 * changes. A window runs from the track's own key before the sample ahead of the first turned frame to its own key after
 * the sample behind the last one; inside it the track is sampled at `frames` (and its own keys), each sample a straight
 * (slerp) step to the next. Its two end keys keep their value and their tangent on the outer side, so the motion outside
 * every window, and in every other sequence, stays exactly the donor's; the track keeps its interpolation type. */
function rewriteRotation(model, node, si, frames, turns) {
  const old = isTrack(node.Rotation) ? node.Rotation : null;
  const s = model.Sequences[si], [a, z] = s.Interval;
  const sample = f => Array.from(sampleTrack(old, f, { interval: s.Interval, globalSequences: model.GlobalSequences, globalTime: f, fallback: TRANSFORM_DEFAULTS.Rotation, quaternion: true }));
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
  else node.Rotation = { Keys: keys, LineType: 1, GlobalSeqId: null };
  return windows;
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
        const lo = lowest(dInfo, sampleNodeMatrices(D, f, di), dInfo.visibleIn(di), di, f, (x, v) => x.bones[v].some(b => ids.has(b)) && !(loose && x.bones[v].some(b => dWeapon.has(b))));
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
    const solve = f => {
      const mats = sampleNodeMatrices(M, f, si), keep = held(si, f, mats);
      const lo = lowest(info, mats, vis, si, f, keep);
      const row = { f, sinks: floor - lo.minZ - tol > 0, bend: {} };
      if (!row.sinks) return row;
      for (const arm of free) {
        const inArm = (x, v) => x.bones[v].some(b => arm.ids.has(b));
        const a0 = lowest(info, mats, vis, si, f, held(si, f, mats, inArm));
        if (!(a0.minZ < floor - tol)) continue;
        const level = floor - tol - donorDip(si, f, arm.key);
        if (!(a0.minZ < level)) continue;
        const s0 = pivotAt(mats, arm.joint);
        const verts = [];
        for (const x of info.geos) { if (!vis[x.gi] || !x.n || info.alphaAt(x, si, f) <= 0.001) continue; for (let v = 0; v < x.n; v++) if (inArm(x, v)) verts.push({ x, v, w: x.weights[v] }); }
        const p = new Vector3(), acc = new Vector3();
        const armMin = R => {
          let mz = Infinity;
          for (const { x, v, w } of verts) {
            acc.set(0, 0, 0); let tot = 0;
            x.bones[v].forEach((b, i) => { const m = mats.get(b); if (!m) return; const wt = w ? w[i] : 1; p.fromArray(x.g.Vertices, v * 3).applyMatrix4(m); if (R && arm.ids.has(b)) p.applyMatrix4(R); acc.addScaledVector(p, wt); tot += wt; });
            if (tot) mz = Math.min(mz, acc.z / tot);
          }
          return mz;
        };
        const turn = (axis, th) => new Matrix4().makeTranslation(s0.x, s0.y, s0.z).multiply(new Matrix4().makeRotationAxis(axis, th)).multiply(new Matrix4().makeTranslation(-s0.x, -s0.y, -s0.z));
        // smallest turn that clears: the horizontal axes that raise the lowest arm point and the hand, either way round,
        // in 1 deg steps up to 90 (the most raising turn when none clears)
        const hand = pivotAt(mats, arm.hand), axes = [];
        for (const pt of [v3(a0.at.p), hand]) { const ax = pt.clone().sub(s0).cross(new Vector3(0, 0, 1)); if (ax.length() > 1e-6) { ax.normalize(); axes.push(ax, ax.clone().negate()); } }
        if (!axes.length) axes.push(new Vector3(1, 0, 0), new Vector3(-1, 0, 0));
        let best = null, fallbackBest = null;
        for (const axis of axes) for (let deg = 1; deg <= 90; deg++) {
          const mz = armMin(turn(axis, deg / DEG));
          if (!fallbackBest || mz > fallbackBest.mz) fallbackBest = { axis, th: deg / DEG, mz };
          if (mz >= level) { if (!best || deg / DEG < best.th) best = { axis, th: deg / DEG }; break; }
          if (best && deg / DEG >= best.th) break;
        }
        const { axis, th } = best || fallbackBest;
        // the turn in the joint's parent frame (the parent's turn, its scale dropped)
        const parent = info.byId.get(arm.joint).Parent, PM = parent != null && mats.get(parent) ? mats.get(parent) : new Matrix4();
        const axisL = axis.clone().applyMatrix4(new Matrix4().extractRotation(PM).invert()).normalize();
        row.bend[arm.key] = { th, axisL: axisL.toArray() };
      }
      return row;
    };
    const dipping = r => r.sinks || Object.keys(r.bend).length;
    const first = coarse.map(solve);
    if (!first.some(dipping)) return;
    // dense samples (every ~8 ms) between the neighbours of every dipping sample: the swing into a dip is fast
    const dense = new Set(coarse);
    first.forEach((r, i) => { if (!dipping(r)) return; const a0 = coarse[Math.max(0, i - 1)], z0 = coarse[Math.min(coarse.length - 1, i + 1)]; for (let t = a0; t <= z0; t += DENSE) dense.add(Math.round(t)); });
    const frames = [...dense].sort((x, y) => x - y);
    const known = new Map(coarse.map((f, i) => [f, first[i]]));
    let rows = frames.map(f => known.get(f) || solve(f));
    // each turn held one sample either side, so the line between two keys never dips into the floor
    rows = rows.map((r, i) => {
      const nb = [rows[i - 1], r, rows[i + 1]].filter(Boolean), bend = { ...r.bend };
      for (const x of nb) for (const [k, b] of Object.entries(x.bend)) if (!bend[k] || b.th > bend[k].th) bend[k] = x === r ? b : { ...b, axisL: (r.bend[k] || b).axisL };
      return { f: r.f, bend };
    });
    for (const arm of free) {
      const at = new Map(rows.filter(r => r.bend[arm.key]).map(r => [r.f, r.bend[arm.key]]));
      if (at.size) plans.push({ si, arm, frames, at });
    }
  });
  // Every turn is measured on the result as the donor moves it; the keys change only now.
  for (const { si, arm, frames, at } of plans) {
    const node = info.byId.get(arm.joint);
    const turns = new Map([...at].map(([f, b]) => [f, v => new Quaternion().setFromAxisAngle(v3(b.axisL), b.th).multiply(new Quaternion().fromArray(v)).normalize().toArray()]));
    const start = M.Sequences[si].Interval[0], windows = rewriteRotation(M, node, si, frames, turns);
    out.push({ sequence: M.Sequences[si].Name, arm: arm.key, joint: arm.joint, frames: at.size, turn: Math.max(...[...at.values()].map(b => b.th)) * DEG, spans: windows.map(([p, q]) => [p - start, q - start]) });
  }
  return out;
}
