// XFER scorecard (docs/agent-tasks/xfer-finish-line.md): the owner's six rules measured on one transplant result,
// every donated animation. Used by scripts/xfer-scorecard (all test pairs) and by the toggle suggester.
import { Matrix4, Quaternion, Vector3 } from 'three';
import * as A from './animation.js';
import { mirrorModel } from './skeleton-transplant.js';
import { similarity } from './transplant-native-cloth.js';
import { transferRig, sameKindSequence } from './anim-transfer.js';
import { standSequenceIndex } from './sequence-editor.js';
import { vertexBones } from './part-bones.js';
import { nodeIndex } from './node-hierarchy.js';
import * as seat from './transplant-weapon-seat.js';

/** Fixed limits: the level of the pairs the owner accepted (scripts/xfer-scorecard/limits.json). */
export const SCORE_LIMITS = Object.freeze({"shapeShare":0.009,"shapeOver":1.391,"motionOff":0.11538461538461539,"weaponHand":0.938,"weaponAngle":20.63,"weaponSecond":0.8,"twinsWorse":0,"jitterShare":0.09090909090909091});
export const SCORE_RULES = Object.freeze(['shape', 'motion', 'weapon', 'twins', 'jitter']);

const rigOf = m => transferRig(m, Math.max(0, standSequenceIndex(m)));
const median = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const quantile = (xs, q) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] : null; };
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
const SKIP_CLIP = /^(decay|dissipate)/i;
const SAMPLES = 16;
// A palm counts as on the weapon within this share of its arm's length (or as close as the donor's own palm).
const GRIP = .2, SPOT = Infinity; // place along the shaft is not compared: base/head ends are not read the same way round on every weapon

// One pose of a model: world matrices, skinned positions per geoset (cached), visibility per geoset.
function snap(m, si, f) {
  const world = A.sampleNodeMatrices(m, f, si), skin = new Map(), vis = new Map();
  return {
    world, f, si,
    point(gi, v) { if (!skin.has(gi)) skin.set(gi, A.skinGeoset(m.Geosets[gi], world)); return new Vector3().fromArray(skin.get(gi), 3 * v); },
    arr(gi) { if (!skin.has(gi)) skin.set(gi, A.skinGeoset(m.Geosets[gi], world)); return skin.get(gi); },
    shown(gi) { if (!vis.has(gi)) vis.set(gi, A.sampleGeosetAnimation(m, gi, f, si).alpha > .25); return vis.get(gi); },
    frame: f, sequence: si,
  };
}
const framesOf = (m, si, n = SAMPLES) => { const [a, z] = m.Sequences[si].Interval; return Array.from({ length: n }, (_, k) => Math.round(a + (z - a) * k / (n - 1))); };
const height = m => { let lo = Infinity, hi = -Infinity; for (const g of m.Geosets) for (let i = 2; i < g.Vertices.length; i += 3) { lo = Math.min(lo, g.Vertices[i]); hi = Math.max(hi, g.Vertices[i]); } return Math.max(1e-3, hi - lo); };

// Skin of each body part: vertices whose bones hang under that part's joints (nearest body joint).
function partSkin(m, rig) {
  const tree = nodeIndex(m), owner = new Map();
  for (const [key, part] of Object.entries(rig.parts)) for (const j of part.joints) owner.set(j, key);
  const hostKey = id => { for (const j of tree.ancestors(id, true)) if (owner.has(j)) return owner.get(j); return null; };
  const tipOf = new Map();
  for (const [key, part] of Object.entries(rig.parts)) for (const j of part.joints.slice(-2)) tipOf.set(j, key);
  const hostTip = id => { for (const j of tree.ancestors(id, true)) { if (tipOf.has(j)) return tipOf.get(j); if (owner.has(j)) return null; } return null; };
  const parts = {}, tips = {};
  m.Geosets.forEach((g, gi) => {
    for (let v = 0; v < g.Vertices.length / 3; v++) {
      const b = vertexBones(g, v); if (!b.length) continue;
      const k = hostKey(b[0]); if (k && b.every(x => hostKey(x) === k)) (parts[k] ??= []).push([gi, v]);
      const t = hostTip(b[0]); if (t && b.every(x => hostTip(x) === t)) (tips[t] ??= []).push([gi, v]);
    }
  });
  return { parts, tips };
}
const centroid = (s, refs) => { const c = new Vector3(); let n = 0; for (const [gi, v] of refs) { if (!s.shown(gi)) continue; c.add(s.point(gi, v)); n++; } return n ? c.divideScalar(n) : null; };

function edgesOf(m) {
  const out = [];
  m.Geosets.forEach((g, gi) => {
    const seen = new Set(), F = g.Faces;
    for (let i = 0; i < F.length; i += 3) for (let j = 0; j < 3; j++) {
      const a = F[i + j], b = F[i + (j + 1) % 3], key = a < b ? a * 65536 + b : b * 65536 + a;
      if (seen.has(key)) continue; seen.add(key);
      const L = Math.hypot(...[0, 1, 2].map(k => g.Vertices[3 * a + k] - g.Vertices[3 * b + k]));
      if (L > 1e-3) out.push([gi, a, b, L]);
    }
  });
  return out;
}
const ratioAt = (s, [gi, a, b, L]) => { const p = s.arr(gi); return Math.hypot(p[3 * a] - p[3 * b], p[3 * a + 1] - p[3 * b + 1], p[3 * a + 2] - p[3 * b + 2]) / L; };

export function scoreResult(own, donor0, M, mirror) {
  const donor = mirror ? mirrorModel(donor0) : donor0;
  const rigO = rigOf(own), rigD = rigOf(donor);
  const hO = height(own), hD = height(donor);
  const clips = M.Sequences.map((s, si) => ({ si, name: s.Name.trim(), di: donor.Sequences.findIndex(d => d.Name === s.Name && d.Interval[0] === s.Interval[0]), oj: sameKindSequence(own, s.Name) }))
    .filter(c => c.di >= 0 && !SKIP_CLIP.test(c.name) && M.Sequences[c.si].Interval[1] > M.Sequences[c.si].Interval[0]);
  const result = { mirror: !!mirror, clips: clips.length, rules: {} };
  const weaponIds = new Set();
  const wo = rigO.ok ? seat.readWeapon(own, rigO) : null, wd = rigD.ok ? seat.readWeapon(donor, rigD) : null;
  for (const it of wo?.items || []) for (const p of it.parts) for (const v of p.vertices) weaponIds.add(p.gi + ':' + v);

  // Rule 1: body never changes shape. Edge length against the stored length; allowed up to 1.25x the larger of the
  // model's own largest stretch of that edge (its own animations) and the donor's 99th-percentile stretch.
  {
    const edges = edgesOf(own).filter(([gi, a, b]) => !(weaponIds.has(gi + ':' + a) && weaponIds.has(gi + ':' + b)));
    const ownMax = new Float32Array(edges.length).fill(1);
    for (const [si, s] of own.Sequences.entries()) {
      if (SKIP_CLIP.test(s.Name.trim()) || !(s.Interval[1] > s.Interval[0])) continue;
      for (const f of framesOf(own, si, 10)) { const sn = snap(own, si, f); edges.forEach((e, i) => { if (sn.shown(e[0])) ownMax[i] = Math.max(ownMax[i], ratioAt(sn, e)); }); }
    }
    // The donor's own stretch in each animation (99.9th percentile of its edges, so one degenerate sliver does not count):
    // what the donor does to itself in that animation is allowed.
    const dEdges = edgesOf(donor), capOf = new Map();
    for (const c of clips) {
      const dr = [];
      for (const f of framesOf(donor, c.di, 8)) { const sn = snap(donor, c.di, f); for (const e of dEdges) if (sn.shown(e[0])) dr.push(ratioAt(sn, e)); }
      capOf.set(c.si, Math.max(1, quantile(dr, .999) ?? 1));
    }
    const donorCap = Math.max(...capOf.values(), 1);
    // Result edges use the result's stored lengths (a seated weapon is rigid and left out).
    const rEdges = edges.map(([gi, a, b]) => { const g = M.Geosets[gi]; return [gi, a, b, Math.hypot(...[0, 1, 2].map(k => g.Vertices[3 * a + k] - g.Vertices[3 * b + k]))]; });
    const flagged = new Map(); let worst = { ratio: 1 };
    for (const c of clips) for (const f of framesOf(M, c.si)) {
      const sn = snap(M, c.si, f);
      rEdges.forEach((e, i) => {
        if (e[3] < 1e-3 || !sn.shown(e[0])) return;
        const r = ratioAt(sn, e), allow = 1.25 * Math.max(ownMax[i], capOf.get(c.si));
        if (r > 1.3 && r > allow) {
          flagged.set(i, Math.max(flagged.get(i) || 0, r / allow));
          if (r / allow > (worst.over || 0)) worst = { over: r / allow, ratio: r, clip: c.name, frame: f, phase: (f - M.Sequences[c.si].Interval[0]) / (M.Sequences[c.si].Interval[1] - M.Sequences[c.si].Interval[0]), where: vertexBones(own.Geosets[e[0]], e[1]).map(id => own.Nodes[id]?.Name).join('/') };
        }
      });
    }
    const share = flagged.size / Math.max(1, edges.length);
    // Where the stretch sits: the body parts at the two ends of each stretched edge.
    const SOx = partSkin(own, rigO), keyOf = new Map();
    for (const [k, refs] of Object.entries(SOx.parts)) for (const [gi, v] of refs) keyOf.set(gi + ':' + v, k);
    const seams = {};
    for (const i of flagged.keys()) { const [gi, a, b] = edges[i]; const ka = keyOf.get(gi + ':' + a) || 'loose', kb = keyOf.get(gi + ':' + b) || 'loose'; const k = [ka, kb].sort().join('-'); seams[k] = (seams[k] || 0) + 1; }
    result.rules.shape = { pass: share <= .005 && !(worst.over > 1.6), stretchedEdges: flagged.size, share: r3(share), seams, donorCap: r3(donorCap), worst: worst.over ? { ...worst, over: r3(worst.over), ratio: r3(worst.ratio), phase: r3(worst.phase) } : null };
  }

  // Rules 2 and 4 share the part skins. Body size: height of the body-part skin in the first Stand pose.
  const SO = partSkin(own, rigO), SD = partSkin(donor, rigD);
  const bodySize = (m, S) => {
    const si = Math.max(0, standSequenceIndex(m)), sn = snap(m, si, m.Sequences[si]?.Interval[0] ?? 0);
    let lo = Infinity, hi = -Infinity;
    for (const refs of Object.values(S.parts)) for (const [gi, v] of refs) { const z = sn.point(gi, v).z; lo = Math.min(lo, z); hi = Math.max(hi, z); }
    return hi > lo ? hi - lo : null;
  };
  const bO = bodySize(own, SO) ?? hO, bD = bodySize(donor, SD) ?? hD, bM = bodySize(M, SO) ?? bO;
  result.size = { own: r3(bO), donor: r3(bD), result: r3(bM) };
  const torsoO = [...(SO.parts.chest || []), ...(SO.parts.hips || [])], torsoD = [...(SD.parts.chest || []), ...(SD.parts.hips || [])];
  const keysBoth = Object.keys(rigO.parts).filter(k => rigD.parts[k] && k !== 'chest' && k !== 'hips' && SO.tips[k]?.length && SD.tips[k]?.length);

  // Rule 2: every part moves like the donor's matching part. RMS travel of the part's tip skin around its clip mean,
  // against the torso, divided by body height; ratio result / donor within 0.7-1.4.
  {
    // How far the part turns against the body joint it hangs from (its anchor): the RMS angle, in radians, of the
    // part's tip skin against its pose at the clip's start, fitted as a rigid turn. Angles do not depend on the size or
    // shape of the two bodies; a torso with swaying cloth does not count as the part moving.
    const rigid = mat => { const t = new Vector3(), q = new Quaternion(), sc = new Vector3(); mat.decompose(t, q, sc); return new Matrix4().compose(t, q, new Vector3(1, 1, 1)).invert(); };
    const travel = (m, si, frames, tips, torso, h, anchor) => {
      const shapes = frames.map(f => {
        const sn = snap(m, si, f);
        const ref = anchor != null && sn.world.get(anchor) ? rigid(sn.world.get(anchor)) : null;
        const base = ref ? null : torso.length ? centroid(sn, torso) : null;
        const pts = tips.filter(([gi]) => sn.shown(gi)).map(([gi, v]) => { const p = sn.point(gi, v); return ref ? p.applyMatrix4(ref) : base ? p.sub(base) : p; });
        return pts.length === tips.length ? pts : null;
      }).filter(Boolean);
      if (shapes.length < 3 || shapes[0].length < 3) return null;
      const angles = shapes.slice(1).map(pts => { const fit = similarity(shapes[0], pts); if (!fit) return null; const q = new Quaternion(); fit.decompose(new Vector3(), q, new Vector3()); return 2 * Math.acos(Math.min(1, Math.abs(q.w))); }).filter(x => x != null);
      return angles.length ? Math.sqrt(angles.reduce((s2, a) => s2 + a * a, 0) / angles.length) : null;
    };
    // The donor's part as its joint turns against the anchor joint (its own skin can carry extra moving pieces).
    const jointTurn = (m, si, frames, joint, anchor) => {
      if (joint == null || anchor == null) return null;
      const rel = frames.map(f => { const w = A.sampleNodeMatrices(m, f, si), a = w.get(anchor), j = w.get(joint); if (!a || !j) return null; const qa = new Quaternion(), qj = new Quaternion(); a.decompose(new Vector3(), qa, new Vector3()); j.decompose(new Vector3(), qj, new Vector3()); return qa.invert().multiply(qj); }).filter(Boolean);
      if (rel.length < 3) return null;
      const angles = rel.slice(1).map(q => rel[0].angleTo(q));
      return Math.sqrt(angles.reduce((s2, a) => s2 + a * a, 0) / angles.length);
    };
    const rows = [];
    for (const c of clips) for (const k of keysBoth) {
      const anchorD = rigD.parts[k]?.anchor ?? null, anchorO = rigO.parts[k]?.anchor ?? null;
      const anchorM = anchorD == null ? null : A.allNodes(M).find(n => n.Name === donor.Nodes[anchorD]?.Name)?.ObjectId ?? null;
      const fr = framesOf(M, c.si), dT = jointTurn(donor, c.di, fr, rigD.parts[k]?.marker ?? null, anchorD) ?? travel(donor, c.di, fr, SD.tips[k], torsoD, bD, anchorM == null ? null : anchorD);
      if (dT == null || dT < .05) continue;
      const rT = travel(M, c.si, fr, SO.tips[k], torsoO, bM, anchorM);
      if (rT == null) continue;
      rows.push({ clip: c.name, part: k, ratio: r3(rT / dT), donor: r3(dT) });
    }
    const bad = rows.filter(r => r.ratio < .7 || r.ratio > 1.4);
    const still = rows.filter(r => r.ratio < .25);
    const worst = bad.sort((a, b) => Math.abs(Math.log(b.ratio + 1e-3)) - Math.abs(Math.log(a.ratio + 1e-3)))[0] || null;
    result.rules.motion = { pass: rows.length > 0 && bad.length <= .1 * rows.length && !still.length, checked: rows.length, off: bad.length, still: still.length, worst };
  }

  // Rule 3: the weapon is held like the donor's.
  {
    if (!wo?.items?.length || !wd?.items?.length) result.rules.weapon = { pass: null, note: !wo?.items?.length && !wd?.items?.length ? 'no weapon on either' : !wo?.items?.length ? 'no weapon on the model' : 'no weapon on the donor' };
    else {
      const item = wo.items[0], want = wd.items.find(x => x.hand.arm.key === item.hand.arm.key) ?? wd.items[0];
      const ownHand = wo.hands.find(h => h.arm.key === want.hand.arm.key) ?? item.hand;
      const ownOther = wo.hands.find(h => h !== ownHand), donOther = wd.hands.find(h => h !== want.hand);
      const reachO = ownHand.arm.length || hO * .3, reachD = want.hand.arm.length || hD * .3;
      const palm = (sn, hand) => hand?.patch?.length ? hand.patch.reduce((s, { gi, v }) => s.add(sn.point(gi, v)), new Vector3()).divideScalar(hand.patch.length) : null;
      const shaft = (sn, it) => it.ends ? it.ends.map(end => end.reduce((s, { gi, v }) => s.add(sn.point(gi, v)), new Vector3()).divideScalar(end.length)) : null;
      const face = (rig) => new Vector3(...rig.facing).setZ(0).normalize();
      const local = (d, fr) => new Vector3(d.dot(fr), d.x * -fr.y + d.y * fr.x, d.z);
      const fO = face(rigO), fD = face(rigD);
      let held = 0, gripped = 0, support = 0, supported = 0; const angles = [];
      let worst = null;
      for (const c of clips) for (const f of framesOf(M, c.si)) {
        const dn = snap(donor, c.di, f), rn = snap(M, c.si, f);
        if (!want.parts.some(p => dn.shown(p.gi)) || !item.parts.some(p => rn.shown(p.gi))) continue;
        // Which hand holds the weapon is read from where it is: the nearer palm grips, the other is the second hand.
        // Each palm: its gap to the weapon surface and where along the shaft (0 base, 1 head) that touch is.
        const gaps = (m, sn, hands, parts, it) => {
          const s2 = shaft(sn, it);
          return hands.filter(h => h?.patch?.length).map(h => {
            const c = seat.contacts(m, sn, parts, palm(sn, h)); if (!c) return { gap: Infinity, at: null };
            const at = s2 ? c.world.clone().sub(s2[0]).dot(s2[1].clone().sub(s2[0])) / Math.max(1e-8, s2[1].distanceToSquared(s2[0])) : null;
            return { gap: c.gap / (h.arm.length || 1), at };
          }).sort((x, y) => x.gap - y.gap);
        };
        const dg = gaps(donor, dn, wd.hands, want.parts.filter(p => p.faces?.length), want), rg = gaps(M, rn, wo.hands, item.parts.filter(p => p.faces?.length), item);
        if (!dg.length || !rg.length || dg[0].gap > .15) continue;
        held++;
        // A donor palm on the weapon is matched by a result palm touching at the same place along the shaft.
        const used = new Set();
        const match = d => { const k = rg.findIndex((r, i) => !used.has(i) && r.gap <= Math.max(GRIP, d.gap) && (d.at == null || r.at == null || Math.abs(d.at - r.at) <= SPOT)); if (k >= 0) used.add(k); return k >= 0; };
        if (match(dg[0])) gripped++; else if (!worst || rg[0].gap > worst.gap) worst = { gap: r3(rg[0].gap), clip: c.name, frame: f, phase: r3((f - M.Sequences[c.si].Interval[0]) / Math.max(1, M.Sequences[c.si].Interval[1] - M.Sequences[c.si].Interval[0])) };
        const ds = shaft(dn, want), rs = shaft(rn, item);
        if (ds && rs) angles.push(local(ds[1].clone().sub(ds[0]).normalize(), fD).angleTo(local(rs[1].clone().sub(rs[0]).normalize(), fO)) * 180 / Math.PI);
        if (want.support && dg.length > 1 && dg[1].gap <= .15) {
          support++;
          if (match(dg[1])) supported++;
        }
      }
      const angle = median(angles);
      result.rules.weapon = held ? {
        pass: gripped >= .9 * held && angle != null && angle < 30 && (!support || supported >= .8 * support),
        heldMoments: held, inHand: r3(gripped / held), angle: r3(angle), secondHand: support ? r3(supported / support) : null, worst,
      } : { pass: null, note: 'the donor never holds its weapon in the sampled moments' };
    }
  }

  // Rule 4: near-twins come out like themselves. For each matched part, the direction from the part's skin centre to its
  // tip skin centre (head: from the torso), in the body's facing frame; the pose distance is the mean angle in degrees.
  {
    const dirs = (m, si, f, S, torso, rig) => {
      const sn = snap(m, si, f), fr = new Vector3(...rig.facing).setZ(0).normalize(), out = {};
      const base = torso.length ? centroid(sn, torso) : null;
      for (const k of keysBoth) {
        const from = k === 'head' ? base : (S.parts[k]?.length ? centroid(sn, S.parts[k]) : null), to = S.tips[k]?.length ? centroid(sn, S.tips[k]) : null;
        if (!from || !to) continue;
        const d = to.sub(from); if (d.lengthSq() < 1e-8) continue; d.normalize();
        out[k] = new Vector3(d.dot(fr), d.x * -fr.y + d.y * fr.x, d.z);
      }
      return out;
    };
    const angle = (a, b) => { const ks = Object.keys(a || {}).filter(k => b?.[k]); return ks.length ? ks.reduce((s, k) => s + a[k].angleTo(b[k]), 0) / ks.length * 180 / Math.PI : null; };
    const twins = [];
    for (const c of clips) {
      if (c.oj == null) continue;
      const own2 = [], res2 = [];
      const [oa, oz] = own.Sequences[c.oj].Interval;
      const ownPoses = Array.from({ length: 12 }, (_, k) => dirs(own, c.oj, Math.round(oa + (oz - oa) * k / 11), SO, torsoO, rigO));
      for (const ph of [0, .2, .4, .6, .8, 1]) {
        const [a, z] = M.Sequences[c.si].Interval, f = Math.round(a + ph * (z - a));
        const d = dirs(donor, c.di, f, SD, torsoD, rigD), r = dirs(M, c.si, f, SO, torsoO, rigO);
        own2.push(Math.min(...ownPoses.map(o => angle(o, d) ?? Infinity))); res2.push(angle(r, d));
      }
      const mo = median(own2), mr = median(res2);
      if (mo != null && mr != null && mo < 25) twins.push({ clip: c.name, own: r3(mo), result: r3(mr) });
    }
    const worse = twins.filter(x => x.result > x.own + 5);
    result.rules.twins = twins.length ? { pass: !worse.length, twinClips: twins.length, worse: worse.length, worst: worse.sort((a, b) => (b.result - b.own) - (a.result - a.own))[0] || null } : { pass: null, note: "no animation of the model resembles the donor's" };
  }

  // Rule 5: no jitter. Largest change of skin speed between 33 ms steps, by height, against the donor's and own's.
  {
    const jerk = (m, si, h) => {
      const [a, z] = m.Sequences[si].Interval, n = Math.min(90, Math.floor((z - a) / 33) + 1);
      if (n < 3) return { value: 0 };
      let prev2 = null, prev1 = null, worst = { value: 0 };
      for (let k = 0; k < n; k++) {
        const f = a + k * 33, sn = snap(m, si, f), cur = m.Geosets.map((g, gi) => sn.shown(gi) ? sn.arr(gi).slice() : null);
        if (prev2) cur.forEach((p, gi) => { if (!p || !prev1[gi] || !prev2[gi]) return; for (let i = 0; i < p.length; i += 3) { const d = Math.hypot(p[i] - 2 * prev1[gi][i] + prev2[gi][i], p[i + 1] - 2 * prev1[gi][i + 1] + prev2[gi][i + 1], p[i + 2] - 2 * prev1[gi][i + 2] + prev2[gi][i + 2]) / h; if (d > worst.value) worst = { value: d, frame: f - 33 }; } });
        prev2 = prev1; prev1 = cur;
      }
      return worst;
    };
    const rows = [];
    for (const c of clips) {
      const r = jerk(M, c.si, bM), d = jerk(donor, c.di, bD), o = c.oj != null ? jerk(own, c.oj, bO) : { value: 0 };
      const allow = 1.5 * Math.max(d.value, o.value) + .01;
      if (r.value > allow) rows.push({ clip: c.name, result: r3(r.value), allow: r3(allow), frame: r.frame, phase: r3((r.frame - M.Sequences[c.si].Interval[0]) / Math.max(1, M.Sequences[c.si].Interval[1] - M.Sequences[c.si].Interval[0])) });
    }
    result.rules.jitter = { pass: !rows.length, clipsOver: rows.length, worst: rows.sort((a, b) => b.result / b.allow - a.result / a.allow)[0] || null };
  }
  return result;
}


/** Pass or fail per rule against the limits (null: the rule does not apply). Mutates and returns `result`. */
export function judgeResult(result, limits = SCORE_LIMITS) {
  const R = result.rules;
  const within = (v, k) => v == null || limits[k] == null ? true : /Hand|Second/.test(k) ? v >= limits[k] - 1e-9 : v <= limits[k] + 1e-9;
  R.shape.pass = within(R.shape.share, 'shapeShare') && within(R.shape.worst?.over ?? 1, 'shapeOver');
  R.motion.pass = within(R.motion.off / Math.max(1, R.motion.checked), 'motionOff') && !R.motion.still;
  if (R.weapon.pass != null) R.weapon.pass = within(R.weapon.inHand ?? null, 'weaponHand') && within(R.weapon.angle ?? null, 'weaponAngle') && within(R.weapon.secondHand ?? null, 'weaponSecond');
  if (R.twins.pass != null) R.twins.pass = within(R.twins.twinClips ? R.twins.worse / R.twins.twinClips : null, 'twinsWorse');
  R.jitter.pass = within(R.jitter.clipsOver / Math.max(1, result.clips), 'jitterShare');
  return result;
}
