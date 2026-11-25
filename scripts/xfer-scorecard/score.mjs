// XFER scorecard (docs/agent-tasks/xfer-finish-line.md): the owner's six rules, measured on every pair and every
// donated animation, at the pair's default ticks. One JSON line per pair.
//   node out/scorecard/score.mjs <out.jsonl> [--only id,id] [--shard k/n] [--src <folder holding src/>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Triangle, Vector3 } from 'three';

const args = process.argv.slice(2);
const outFile = args[0];
const opt = (name, fallback = null) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const srcRoot = path.resolve(opt('src', path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..')));
const mod = name => import(pathToFileURL(path.join(srcRoot, 'src', name + '.js')).href);
const [{ openDocument }, A, { transplantSkeleton, mirrorModel }, { transplantRepairOptions }, { repairFlags }, { transferRig, sameKindSequence },
  { standSequenceIndex }, { vertexBones }, { nodeIndex }, seat] = await Promise.all(
  ['editor-document', 'animation', 'skeleton-transplant', 'transfer-window', 'transplant-autofix', 'anim-transfer',
    'sequence-editor', 'part-bones', 'node-hierarchy', 'transplant-weapon-seat'].map(mod));

const SHEETS = ['weapons14', 'reasonable50', 'new30', 'random30'];
const ROOT = 'D:/Claude/MDLxL/TestBuilds/transfer-xl-35/';
const pairs = [];
for (const sheet of SHEETS) for (const row of JSON.parse(fs.readFileSync(ROOT + `cases-${sheet}.json`)).cases) {
  const t = row.variants.find(v => v.transplant)?.transplant;
  if (t && !pairs.some(p => p.id === row.id)) pairs.push({ id: row.id, title: row.question, t, keys: (row.suggestion?.suggested || []).filter(k => k !== 'donorPose') });
}
let todo = pairs;
if (opt('only')) { const only = new Set(opt('only').split(',')); todo = todo.filter(p => only.has(p.id) || only.has(p.id.replace(/^reasonable-/, ''))); }
if (opt('shard')) { const [k, n] = opt('shard').split('/').map(Number); todo = todo.filter((_, i) => i % n === k); }

const load = p => openDocument(fs.readFileSync(p), p).model;
const rigOf = m => transferRig(m, Math.max(0, standSequenceIndex(m)));
const median = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const quantile = (xs, q) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] : null; };
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
const SKIP_CLIP = /^(decay|dissipate)/i;
const SAMPLES = 16;

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

async function scorePair(pair) {
  const { t, keys } = pair;
  const own = load(t.recipient), donor0 = load(t.donor);
  const opts = transplantRepairOptions(own, donor0, { ...t.options, autoFix: keys.length ? repairFlags(keys) : false });
  const made = transplantSkeleton(load(t.recipient), load(t.donor), opts);
  const M = made.model, donor = opts.mirror ? mirrorModel(load(t.donor)) : donor0;
  const rigO = rigOf(own), rigD = rigOf(donor);
  const hO = height(own), hD = height(donor);
  const clips = M.Sequences.map((s, si) => ({ si, name: s.Name.trim(), di: donor.Sequences.findIndex(d => d.Name === s.Name && d.Interval[0] === s.Interval[0]), oj: sameKindSequence(own, s.Name) }))
    .filter(c => c.di >= 0 && !SKIP_CLIP.test(c.name) && M.Sequences[c.si].Interval[1] > M.Sequences[c.si].Interval[0]);
  const result = { id: pair.id, title: pair.title, keys, mirror: !!opts.mirror, clips: clips.length, rules: {} };
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
    const dEdges = edgesOf(donor), dr = [];
    for (const c of clips) for (const f of framesOf(donor, c.di, 6)) { const sn = snap(donor, c.di, f); for (let i = 0; i < dEdges.length; i += 7) if (sn.shown(dEdges[i][0])) dr.push(ratioAt(sn, dEdges[i])); }
    const donorCap = Math.max(1, quantile(dr, .99) ?? 1);
    // Result edges use the result's stored lengths (a seated weapon is rigid and left out).
    const rEdges = edges.map(([gi, a, b]) => { const g = M.Geosets[gi]; return [gi, a, b, Math.hypot(...[0, 1, 2].map(k => g.Vertices[3 * a + k] - g.Vertices[3 * b + k]))]; });
    const flagged = new Map(); let worst = { ratio: 1 };
    for (const c of clips) for (const f of framesOf(M, c.si)) {
      const sn = snap(M, c.si, f);
      rEdges.forEach((e, i) => {
        if (e[3] < 1e-3 || !sn.shown(e[0])) return;
        const r = ratioAt(sn, e), allow = 1.25 * Math.max(ownMax[i], donorCap);
        if (r > 1.3 && r > allow) {
          flagged.set(i, Math.max(flagged.get(i) || 0, r / allow));
          if (r / allow > (worst.over || 0)) worst = { over: r / allow, ratio: r, clip: c.name, frame: f, phase: (f - M.Sequences[c.si].Interval[0]) / (M.Sequences[c.si].Interval[1] - M.Sequences[c.si].Interval[0]), where: vertexBones(own.Geosets[e[0]], e[1]).map(id => own.Nodes[id]?.Name).join('/') };
        }
      });
    }
    const share = flagged.size / Math.max(1, edges.length);
    result.rules.shape = { pass: share <= .005 && !(worst.over > 1.6), stretchedEdges: flagged.size, share: r3(share), donorCap: r3(donorCap), worst: worst.over ? { ...worst, over: r3(worst.over), ratio: r3(worst.ratio), phase: r3(worst.phase) } : null };
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
    const travel = (m, si, frames, tips, torso, h) => {
      const ps = frames.map(f => { const sn = snap(m, si, f), a = centroid(sn, tips), b = torso.length ? centroid(sn, torso) : new Vector3(); return a && b ? a.sub(b) : null; }).filter(Boolean);
      if (ps.length < 3) return null;
      const mean = ps.reduce((s, p) => s.add(p), new Vector3()).divideScalar(ps.length);
      return Math.sqrt(ps.reduce((s, p) => s + p.distanceToSquared(mean), 0) / ps.length) / h;
    };
    const rows = [];
    for (const c of clips) for (const k of keysBoth) {
      const fr = framesOf(M, c.si), dT = travel(donor, c.di, fr, SD.tips[k], torsoD, bD);
      if (dT == null || dT < .02) continue;
      const rT = travel(M, c.si, fr, SO.tips[k], torsoO, bM);
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
        const dp = palm(dn, want.hand), rp = palm(rn, ownHand);
        const dc = dp && seat.contacts(donor, dn, want.parts.filter(p => p.faces?.length), dp), rc = rp && seat.contacts(M, rn, item.parts.filter(p => p.faces?.length), rp);
        if (!dc || !rc || dc.gap / reachD > .15) continue;
        held++;
        const gap = rc.gap / reachO;
        if (gap <= .2) gripped++; else if (!worst || gap > worst.gap) worst = { gap: r3(gap), clip: c.name, frame: f, phase: r3((f - M.Sequences[c.si].Interval[0]) / Math.max(1, M.Sequences[c.si].Interval[1] - M.Sequences[c.si].Interval[0])) };
        const ds = shaft(dn, want), rs = shaft(rn, item);
        if (ds && rs) angles.push(local(ds[1].clone().sub(ds[0]).normalize(), fD).angleTo(local(rs[1].clone().sub(rs[0]).normalize(), fO)) * 180 / Math.PI);
        if (want.support && donOther?.patch?.length && ownOther?.patch?.length) {
          const dop = palm(dn, donOther), dsc = seat.contacts(donor, dn, want.parts.filter(p => p.faces?.length), dop);
          if (dsc && dsc.gap / (donOther.arm.length || reachD) <= .15) {
            support++;
            const rop = palm(rn, ownOther), rsc = seat.contacts(M, rn, item.parts.filter(p => p.faces?.length), rop);
            if (rsc && rsc.gap / (ownOther.arm.length || reachO) <= .2) supported++;
          }
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

const out = fs.createWriteStream(outFile, { flags: 'a' });
for (const pair of todo) {
  const t0 = Date.now();
  let line;
  try { line = await scorePair(pair); } catch (e) { line = { id: pair.id, title: pair.title, error: String(e.stack || e).slice(0, 400) }; }
  line.ms = Date.now() - t0;
  out.write(JSON.stringify(line) + '\n');
  process.stderr.write(pair.id + ' ' + line.ms + 'ms\n');
}
out.end();
