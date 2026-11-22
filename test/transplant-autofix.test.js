// XFER transplant Auto fix (src/transplant-autofix.js, option `autoFix` on transplantSkeleton). Contract and pass numbers:
// docs/agent-tasks/xfer-auto-fix.md. Owner, 22 Nov 2026: "at this point you need to offer users an AUTO FIX!!!!! to avoid
// regressions on other models, offer it as an option".
// The models are the owner's graded pairs (D:\Claude\MDLxL-TestModels\xfer-auto-fix, README there): the donor as the user
// opens it and the recipient's native model. Each check measures what the user sees on the recipient's own vertices (same
// indices in the native model and the result), never the markers or attachments a correction sets.
import test from 'node:test';
import { Vector3 } from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset, worldPivot } from '../src/animation.js';
import { geosetMaterialLayers, isAdditiveLayer } from '../src/geoset-extras.js';
import { vertexBones } from '../src/part-bones.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { mirrorModel, transplantSkeleton } from '../src/skeleton-transplant.js';
import { rigFor, transplantOptions } from '../src/transfer-window.js';
import { detachedSurface } from '../src/transplant-props.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { AUTO_FIX_KEYS, autoFixMirror, autoFixOptions, heldSide } from '../src/transplant-autofix.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const ALL = ['08', '10', '12', '15', '16', '17', '18', '33', '34'];
const CONTROLS = ['08', '16']; // pair-08 Earth Lich -> Minion Archivist (10), pair-16 Arch Bishop -> Dwarf Stonemason (10)
const files = id => [fixturePath(`autofix-${id}-own`), fixturePath(`autofix-${id}-donor`)];
const absent = ids => ids.flatMap(files).some(file => !file || !fs.existsSync(file)) ? 'Auto fix test models unavailable (xfer-auto-fix)' : false;
const load = file => openDocument(new Uint8Array(fs.readFileSync(file)), file).model;

// ------------------------------------------------------------ the transplant as the Transfer window runs it
const loaded = new Map();
function models(id) {
  if (!loaded.has(id)) { const [own, donor] = files(id).map(load); loaded.set(id, { own, donor }); }
  return loaded.get(id);
}
const stand = model => Math.max(0, standSequenceIndex(model));
function rigs(id) { const { own, donor } = models(id); return { rigB: rigFor(own, stand(own)), rigA: rigFor(donor, stand(donor)) }; }
// The automatic Mirror by names (Transfer.jsx `mirrorOf` with Auto fix off): the two weapon sides differ.
function namedMirror(id) { const { rigA, rigB } = rigs(id); return !!(rigA.weaponSide && rigB.weaponSide && rigA.weaponSide !== rigB.weaponSide); }
// `extra` is spread over the window's options; `autoFix` is passed only when `extra` holds it.
function transplant(id, extra = {}, mirror = namedMirror(id)) {
  const { own, donor } = models(id);
  return transplantSkeleton(structuredClone(own), structuredClone(donor), { ...transplantOptions({ sounds: true, effects: false, keep: [], mirror }), ...extra });
}
const plainRuns = new Map();
const plain = id => { if (!plainRuns.has(id)) plainRuns.set(id, transplant(id)); return plainRuns.get(id); };
const donorShown = (id, mirror) => mirror ? mirrorModel(structuredClone(models(id).donor)) : models(id).donor;

// The first place two values differ ('' when they are equal). Typed arrays, Maps and Sets compare by content.
function difference(a, b, at = '') {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return `${at || 'value'}: ${String(a)} vs ${String(b)}`;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor || a.length !== b.length) return `${at}: array type or length`;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return `${at}[${i}]: ${a[i]} vs ${b[i]}`;
    return null;
  }
  if (a instanceof Map || b instanceof Map) return difference(a instanceof Map ? [...a] : a, b instanceof Map ? [...b] : b, at);
  if (a instanceof Set || b instanceof Set) return difference(a instanceof Set ? [...a] : a, b instanceof Set ? [...b] : b, at);
  if (Array.isArray(a) !== Array.isArray(b)) return `${at}: array vs object`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!(key in a) || !(key in b)) return `${at}.${key}: present on one side only`;
    const found = difference(a[key], b[key], `${at}.${key}`);
    if (found) return found;
  }
  return null;
}
const withoutAutoFix = report => { const { autoFix, ...rest } = report; return rest; };

// ------------------------------------------------------------ measuring (ported from the diagnosis tools in held\)
function visible(model, gi, frame, si) {
  if (sampleGeosetAnimation(model, gi, frame, si).alpha <= 0.001) return false;
  const options = { interval: model.Sequences[si].Interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: 1 };
  return geosetMaterialLayers(model, model.Geosets[gi]).some(layer => !isAdditiveLayer(layer) && sampleTrack(layer.Alpha, frame, options) > 0.001);
}
const live = model => model.Sequences.map((s, si) => ({ s, si, name: String(s.Name || '').trim() })).filter(x => !/decay|death|dissipate|portrait|birth|morph/i.test(x.name));
const skinAll = (model, frame, si) => { const matrices = sampleNodeMatrices(model, frame, si); return model.Geosets.map(g => skinGeoset(g, matrices)); };
const P = (S, x) => [S[x.gi][3 * x.v], S[x.gi][3 * x.v + 1], S[x.gi][3 * x.v + 2]];
const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(...a);
const angle = (u, w) => Math.acos(Math.max(-1, Math.min(1, dot(u, w) / (len(u) * len(w) || 1)))) * 180 / Math.PI;
const centre = (S, list) => { const s = [0, 0, 0]; for (const x of list) { const p = P(S, x); s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map(v => v / list.length); };
const clip = (model, pattern) => model.Sequences.findIndex(s => pattern.test(String(s.Name || '').trim()));
// Standing height: the visible skin at the start of the model's first Stand.
function standingHeight(model) {
  const st = live(model).find(x => /^stand/i.test(x.name)) || live(model)[0], f = st.s.Interval[0], S = skinAll(model, f, st.si);
  let low = Infinity, high = -Infinity;
  model.Geosets.forEach((g, gi) => { if (visible(model, gi, f, st.si)) for (let i = 2; i < S[gi].length; i += 3) { low = Math.min(low, S[gi][i]); high = Math.max(high, S[gi][i]); } });
  return high - low;
}
// Bones at or below the given roots.
function below(model, roots) {
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  return bone => { const seen = new Set(); for (let n = byId.get(bone); n && !seen.has(n.ObjectId); n = byId.get(n.Parent)) { if (roots.has(n.ObjectId)) return true; seen.add(n.ObjectId); } return false; };
}
const weaponBone = model => (model.Attachments || []).find(a => /weapon/i.test(a.Name || '') && a.Parent >= 0)?.Parent;
const namedRoots = (model, pattern) => new Set(allNodes(model).filter(n => pattern.test(n.Name || '')).map(n => n.ObjectId));
// The item: vertices whose bones are all item bones; the rest: vertices with none of them.
function split(model, isItem) {
  const item = [], rest = [];
  model.Geosets.forEach((g, gi) => { for (let v = 0; v < g.Vertices.length / 3; v++) { const bones = vertexBones(g, v); if (bones.length && bones.every(isItem)) item.push({ gi, v }); else if (!bones.some(isItem)) rest.push({ gi, v }); } });
  return { item, rest };
}
const thin = (list, most) => list.length > most ? list.filter((_, i) => i % Math.ceil(list.length / most) === 0) : list;
// The skin that holds the item: the `count` other vertices on one bone that stay closest to it across the model's own clips.
function holdingSkin(model, item, rest, { perClip = 6, tally = 8, count = 24, most = 120 } = {}) {
  const samples = [];
  for (const x of live(model)) { const [a, b] = x.s.Interval; for (let k = 0; k <= perClip; k++) { const f = Math.round(a + (b - a) * k / perClip); if (item.some(i => visible(model, i.gi, f, x.si))) samples.push({ f, si: x.si }); } }
  const few = thin(item, most), worst = new Float64Array(rest.length);
  for (const { f, si } of samples) {
    const S = skinAll(model, f, si), ip = few.map(i => P(S, i));
    rest.forEach((r, ri) => { const p = P(S, r); let d = Infinity; for (const q of ip) d = Math.min(d, d2(p, q)); if (d > worst[ri]) worst[ri] = d; });
  }
  const ranked = rest.map((_, ri) => ri).sort((a, b) => worst[a] - worst[b]);
  const bonesOf = r => vertexBones(model.Geosets[r.gi], r.v), votes = new Map();
  for (const ri of ranked.slice(0, tally)) for (const bone of bonesOf(rest[ri])) votes.set(bone, (votes.get(bone) || 0) + 1);
  const bone = [...votes].sort((a, b) => b[1] - a[1])[0][0];
  return ranked.filter(ri => bonesOf(rest[ri]).includes(bone)).slice(0, count).map(ri => rest[ri]);
}

// Item to hand skin (held\float.mjs): the smallest item-vertex to holding-skin distance, in shares of the native height.
// The item is the native recipient's skin under its Weapon attachment's bone.
const floatSetups = new Map();
function floatSetup(id) {
  if (!floatSetups.has(id)) {
    const own = models(id).own, bone = weaponBone(own);
    assert.ok(bone != null, `pair-${id}: the recipient has a Weapon attachment on a bone`);
    const { item, rest } = split(own, below(own, new Set([bone])));
    assert.ok(item.length > 10, `pair-${id}: the recipient's item has skin (${item.length} vertices)`);
    floatSetups.set(id, { item, few: thin(item, 120), hand: holdingSkin(own, item, rest), height: standingHeight(own), bone });
  }
  return floatSetups.get(id);
}
function floatGap(id, result, pattern, step = 10) {
  const { item, few, hand, height } = floatSetup(id), si = clip(result, pattern);
  assert.ok(si >= 0, `pair-${id}: the result has ${pattern}`);
  const [a, b] = result.Sequences[si].Interval;
  let sum = 0, n = 0, max = 0;
  for (let f = a; f <= b; f += step) {
    if (!item.some(i => visible(result, i.gi, f, si))) continue;
    const S = skinAll(result, f, si), hp = hand.map(h => P(S, h));
    let d = Infinity;
    for (const i of few) { const p = P(S, i); for (const q of hp) d = Math.min(d, d2(p, q)); }
    const gap = Math.sqrt(d) / height; sum += gap; n++; max = Math.max(max, gap);
  }
  assert.ok(n > 0, `pair-${id}: the item is visible in ${pattern}`);
  return { mean: sum / n, max, samples: n };
}

// Item against the donor's item (held\axis.mjs): butt-to-tip direction of each model's item; butt = the long-axis end
// nearer the skin that holds it at the model's Stand start; the 5% of item vertices at each end are followed.
function itemLine(model, isItem) {
  const { item, rest } = split(model, isItem);
  assert.ok(item.length >= 3, 'the item has skin');
  const hand = holdingSkin(model, item, rest, { perClip: 4, tally: 5, most: 100 });
  const st = live(model).find(x => /^stand/i.test(x.name)) || live(model)[0], S = skinAll(model, st.s.Interval[0], st.si);
  const pts = item.map(i => P(S, i)), mid = [0, 1, 2].map(k => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  let axis = [1, 0.3, 0.2];
  for (let pass = 0; pass < 40; pass++) { const next = [0, 0, 0]; for (const p of pts) { const q = sub(p, mid), t = dot(q, axis); next[0] += q[0] * t; next[1] += q[1] * t; next[2] += q[2] * t; } const l = len(next) || 1; axis = next.map(x => x / l); }
  const along = pts.map(p => dot(sub(p, mid), axis)), order = along.map((_, i) => i).sort((a, b) => along[a] - along[b]), k = Math.max(3, Math.round(item.length * 0.05));
  let butt = order.slice(0, k).map(i => item[i]), tip = order.slice(-k).map(i => item[i]);
  const held = centre(S, hand);
  if (len(sub(centre(S, butt), held)) > len(sub(centre(S, tip), held))) [butt, tip] = [tip, butt];
  return { butt, tip, vertices: item.length };
}
function itemAngle(result, ownLine, donor, donorLine, name, step = 10) {
  const si = clip(result, name), di = clip(donor, name);
  assert.ok(si >= 0 && di >= 0, `both models have ${name}`);
  const [a, b] = result.Sequences[si].Interval, dir = (S, line) => sub(centre(S, line.tip), centre(S, line.butt));
  let max = 0, sum = 0, n = 0;
  for (let f = a; f <= b; f += step) { const g = angle(dir(skinAll(result, f, si), ownLine), dir(skinAll(donor, f, di), donorLine)); max = Math.max(max, g); sum += g; n++; }
  return { max, mean: sum / n };
}

// Item centroid against the donor's item (held\track.mjs): height and forward reach (+X, from the clip start), in each
// model's standing height. -> the worst difference over the clip.
function itemTrack(result, own, ownItem, donor, donorItem, name, step = 10) {
  const si = clip(result, name), di = clip(donor, name);
  assert.ok(si >= 0 && di >= 0, `both models have ${name}`);
  const hr = standingHeight(own), hd = standingHeight(donor), [a, b] = result.Sequences[si].Interval;
  const at = (model, list, f, s) => centre(skinAll(model, f, s), list);
  const r0 = at(result, ownItem, a, si), d0 = at(donor, donorItem, a, di);
  let worst = 0;
  for (let f = a; f <= b; f += step) {
    const r = at(result, ownItem, f, si), d = at(donor, donorItem, f, di);
    worst = Math.max(worst, Math.abs(r[2] / hr - d[2] / hd), Math.abs((r[0] - r0[0]) / hr - (d[0] - d0[0]) / hd));
  }
  return worst;
}

// Body lean (held\lean.mjs): the line from the lowest to the highest quarter of the recipient's visible vertices at its
// native Stand start (followed by index), as an angle from vertical, averaged over the clip.
function lean(own, result, si, step = 20) {
  const s0 = clip(own, /^stand/i) >= 0 ? clip(own, /^stand/i) : 0, f0 = own.Sequences[s0].Interval[0], S0 = skinAll(own, f0, s0), all = [];
  own.Geosets.forEach((g, gi) => { if (visible(own, gi, f0, s0)) for (let v = 0; v < g.Vertices.length / 3; v++) all.push({ gi, v, z: S0[gi][3 * v + 2] }); });
  all.sort((a, b) => a.z - b.z);
  const q = Math.max(3, Math.floor(all.length / 4)), low = all.slice(0, q), high = all.slice(-q), [a, b] = result.Sequences[si].Interval;
  let sum = 0, n = 0;
  for (let f = a; f <= b; f += step) { const S = skinAll(result, f, si), d = sub(centre(S, high), centre(S, low)); sum += Math.acos(Math.max(-1, Math.min(1, d[2] / len(d)))) * 180 / Math.PI; n++; }
  return sum / n;
}

const pct = x => `${(100 * x).toFixed(1)}%`;

// ============================================================ 1. Off is the plain transplant
// Contract: "Off is today's transplant, exactly. autoFix absent or false: no code path changes, the result model is
// byte-identical, and the report has no autoFix key." Every pair, graded and control.
for (const id of ALL) {
  test(`pair-${id}: Auto fix off (absent, false, {}) gives the plain transplant and no autoFix report`, { skip: absent([id]) }, () => {
    const base = plain(id);
    assert.equal('autoFix' in base.report, false, 'the plain report has no autoFix key');
    for (const off of [false, {}, null]) {
      const run = transplant(id, { autoFix: off });
      assert.equal(difference(run.model, base.model), null, `autoFix ${JSON.stringify(off)}: the result model differs from the plain one`);
      assert.equal(difference(run.report, base.report), null, `autoFix ${JSON.stringify(off)}: the report differs from the plain one`);
      assert.equal('autoFix' in run.report, false, `autoFix ${JSON.stringify(off)}: the report has no autoFix key`);
    }
  });
  test(`pair-${id}: Auto fix on never changes the two models it is given`, { skip: absent([id]) }, () => {
    const own = load(files(id)[0]), donor = load(files(id)[1]), ownBefore = structuredClone(own), donorBefore = structuredClone(donor);
    const made = transplantSkeleton(own, donor, { ...transplantOptions({ sounds: true, effects: false, keep: [], mirror: namedMirror(id) }), autoFix: true });
    assert.ok(made.report.autoFix, 'Auto fix on reports');
    assert.equal(difference(own, ownBefore), null, 'the recipient was changed');
    assert.equal(difference(donor, donorBefore), null, 'the donor was changed');
  });
}

// ============================================================ 2. `hand`: the weapon hand from what is held
// Plan: "the weapon hand, and so the automatic Mirror, is read from names (pairs 15 and 12)".
// Pair-15 Bretonnian Archer -> Ungor Bow (graded 0): "The bow is in the hand that reaches for the quiver"; the archer's
// right arm carries an empty helper named Sword, its bow is on the left. Pair-12 Demon Hag -> Lahmian (graded 0): "Spear
// drifts away from the right hand"; the hag's staff is its own top-level bone, held in her left hand.
test('hand: Mirror follows what is held on pair-15 and pair-12, and keeps the named decision on the controls', { skip: absent(['15', '12', ...CONTROLS]) }, () => {
  const held = id => { const { own, donor } = models(id), { rigA, rigB } = rigs(id); return autoFixMirror(own, rigB, donor, rigA); };
  assert.equal(namedMirror('15'), true, 'pair-15: names turn Mirror on');
  assert.equal(held('15'), false, 'pair-15: both hold the bow in the left hand, Mirror off');
  assert.equal(namedMirror('12'), false, 'pair-12: names leave Mirror off');
  assert.equal(held('12'), true, 'pair-12: staff in the left hand, spear in the right, Mirror on');
  for (const id of CONTROLS) { const value = held(id); assert.ok(value === null || value === namedMirror(id), `pair-${id}: held reading ${value} changes the named Mirror ${namedMirror(id)}`); }
  for (const [id, mirror] of [['15', false], ['12', true]]) {
    const run = transplant(id, { autoFix: { hand: true } }, mirror);
    assert.deepEqual(run.report.autoFix.mirror, { held: mirror, named: namedMirror(id) }, `pair-${id}: the report names both decisions`);
  }
});

test('hand, pair-15: with the held Mirror the bow follows the donor bow through Attack - 1', { skip: absent(['15']) }, t => {
  const { own } = models('15');
  const ownBow = split(own, below(own, namedRoots(own, /bone_bow/i))).item;
  const measure = (result, mirror) => { const donor = donorShown('15', mirror), bow = split(donor, below(donor, namedRoots(donor, /Cylinder02/))).item; return itemTrack(result, own, ownBow, donor, bow, /^Attack - 1$/); };
  const before = measure(plain('15').model, namedMirror('15')), after = measure(transplant('15', { autoFix: { hand: true } }, false).model, false);
  t.diagnostic(`pair-15 bow off the donor bow, Attack - 1: plain ${before.toFixed(3)} H, held Mirror ${after.toFixed(3)} H`);
  assert.ok(before > 0.10, `the plain transplant already follows the donor bow (${before.toFixed(3)} H)`);
  assert.ok(after <= 0.10, `the bow leaves the donor bow by ${after.toFixed(3)} H (limit 0.10)`);
});

test('hand, pair-12: with the held Mirror the spear stays in the hand in Walk', { skip: absent(['12']) }, t => {
  const before = floatGap('12', plain('12').model, /^Walk$/i), after = floatGap('12', transplant('12', { autoFix: { hand: true } }, true).model, /^Walk$/i);
  t.diagnostic(`pair-12 spear to hand skin, Walk mean: plain ${pct(before.mean)}, held Mirror ${pct(after.mean)} (max ${pct(before.max)} / ${pct(after.max)})`);
  assert.ok(before.mean > 0.074, `the plain spear is already in the hand (${pct(before.mean)})`);
  assert.ok(after.mean < 0.074, `spear to hand mean ${pct(after.mean)} (limit 7.4%)`);
});

// ============================================================ 3. `markers`: the weapon fit reads the measured grip and tip
// Pair-18 Forest Troll -> Luc (graded 0): "Hammer in the hand but head-down behind him; the troll's sword points
// forward" (the troll's two markers point 133 deg off its sword). Pair-10 Obsidian Reaver -> Murloc (graded 5): "Blade
// hangs in the air behind the shoulder" (the Murloc's Hand Right Ref sits at foot level).
test('markers, pair-18: the hammer points along the troll sword in Walk', { skip: absent(['18']) }, t => {
  const { own, donor } = models('18');
  const ownLine = itemLine(own, below(own, new Set([weaponBone(own)])));
  // The troll's sword is skinned to its hand bone `Rhand` (geosets 2 and 7, 141 long), not to the bone of its Weapon marker.
  const rhand = namedRoots(donor, /^Rhand$/), donorLine = itemLine(donor, bone => rhand.has(bone));
  const run = transplant('18', { autoFix: { markers: true } });
  assert.equal(run.report.autoFix.markers, true, 'the report says the markers were corrected');
  const before = itemAngle(plain('18').model, ownLine, donor, donorLine, /^Walk$/i), after = itemAngle(run.model, ownLine, donor, donorLine, /^Walk$/i);
  t.diagnostic(`pair-18 hammer against the troll sword, Walk max: plain ${before.max.toFixed(1)} deg, markers ${after.max.toFixed(1)} deg`);
  assert.ok(before.max > 30, `the plain hammer already points along the sword (${before.max.toFixed(1)} deg)`);
  assert.ok(after.max <= 30, `the hammer is ${after.max.toFixed(1)} deg off the troll's sword (limit 30)`);
});

test('markers, pair-10: the Murloc blade stays in the hand in Walk', { skip: absent(['10']) }, t => {
  const run = transplant('10', { autoFix: { markers: true } });
  assert.equal(run.report.autoFix.markers, true, 'the report says the markers were corrected');
  const before = floatGap('10', plain('10').model, /^Walk$/i), after = floatGap('10', run.model, /^Walk$/i);
  t.diagnostic(`pair-10 blade to hand skin, Walk max: plain ${pct(before.max)}, markers ${pct(after.max)} (mean ${pct(before.mean)} / ${pct(after.mean)})`);
  assert.ok(before.max > 0.061, `the plain blade is already in the hand (${pct(before.max)})`);
  assert.ok(after.max < 0.061, `blade to hand ${pct(after.max)} (limit 6.1%)`);
});

// ============================================================ 4. `detached`: a weapon on its own bone without the name test
// Pair-34 Knightess -> Paladin (graded 0): "Sword stuck across the back, hands swing without it"; the Paladin's sword bone
// is called `sord`, so the name test missed it and it rode the pelvis.
test('detached, pair-34: the sword named sord goes into the hand', { skip: absent(['34']) }, t => {
  const { own } = models('34'), { rigA } = rigs('34');
  const sord = allNodes(own).find(n => n.Name === 'sord')?.ObjectId;
  assert.ok(sord != null, 'the Paladin has its bone sord');
  const sword = split(own, below(own, new Set([sord]))).item;
  assert.ok(sword.length > 500, `the sword has skin (${sword.length} vertices)`);
  const inHand = result => {
    const hands = new Set(Object.values(rigA.parts).filter(part => part.limbKind === 'arm').map(part => result.report.donorNodes[part.marker]).filter(id => id != null)), held = below(result.model, hands);
    return sword.filter(x => vertexBones(result.model.Geosets[x.gi], x.v).every(held)).length;
  };
  const base = plain('34'), run = transplant('34', { autoFix: { detached: true } });
  assert.deepEqual(run.report.autoFix.detached, ['sord'], 'the report names the bone');
  t.diagnostic(`pair-34 sword vertices on a donor hand: plain ${inHand(base)}, detached ${inHand(run)} of ${sword.length}`);
  assert.ok(inHand(base) < sword.length, 'the plain sword is already all in the hand');
  assert.equal(inHand(run), sword.length, 'every sword vertex rides a donor hand (none stays on the pelvis or root)');
  const before = floatGap('34', base.model, /^Walk$/i), after = floatGap('34', run.model, /^Walk$/i);
  t.diagnostic(`pair-34 sword to hand skin, Walk mean: plain ${pct(before.mean)}, detached ${pct(after.mean)} (max ${pct(before.max)} / ${pct(after.max)})`);
  assert.ok(before.mean > 0.092, `the plain sword is already in the hand (${pct(before.mean)})`);
  assert.ok(after.mean < 0.092, `sword to hand mean ${pct(after.mean)} (limit 9.2%)`);
});

// Controls for markers and detached: their markers are within the tolerance and their weapons pass the name test, so
// nothing may change.
for (const key of ['markers', 'detached']) {
  test(`${key}: the controls pair-08 and pair-16 come out exactly as the plain transplant`, { skip: absent(CONTROLS) }, () => {
    for (const id of CONTROLS) {
      const run = transplant(id, { autoFix: { [key]: true } });
      assert.equal(difference(run.model, plain(id).model), null, `pair-${id}: ${key} changed the result`);
      assert.equal(run.report.autoFix[key], undefined, `pair-${id}: ${key} reports a correction`);
    }
  });
}

// ============================================================ 5. `trunk`: no trunk posture turn without a trunk line
// Pair-17 Snotling -> Dullahan (graded 0, Mirror on by names): the Dullahan has no legs and its hip-to-shoulder line is 4%
// of its height; turned onto the donor's trunk its whole body tipped over.
test('trunk, pair-17: the legless Dullahan stays upright in Walk and Stand', { skip: absent(['17']) }, t => {
  const { own } = models('17');
  assert.equal(namedMirror('17'), true, 'names turn Mirror on for this pair');
  const run = transplant('17', { autoFix: { trunk: true } }), base = plain('17');
  assert.equal(run.report.autoFix.trunk, true, 'the report says the trunk turn was left out');
  assert.ok(run.report.autoFix.trunkLine < 0.08, `trunk line ${run.report.autoFix.trunkLine}`);
  for (const [label, pattern] of [['Walk', /^Walk$/i], ['first Stand', /^Stand/i]]) {
    const si = clip(base.model, pattern);
    assert.ok(si >= 0 && clip(run.model, pattern) === si, `both results have ${label}`);
    const before = lean(own, base.model, si), after = lean(own, run.model, si);
    t.diagnostic(`pair-17 lean, ${label} (${base.model.Sequences[si].Name.trim()}): plain ${before.toFixed(1)} deg, trunk ${after.toFixed(1)} deg`);
    assert.ok(before > 40, `the plain ${label} is already upright (${before.toFixed(1)} deg)`);
    assert.ok(after < 40, `${label} leans ${after.toFixed(1)} deg (limit 40)`);
  }
});

// Controls: pair-08 and pair-16 have a trunk line; pair-33 Archelect -> Clanrat (graded 9, Mirror on by names) has a short
// line (about 5% of a height its raised weapon and tail stretch) but stands on two legs, so its trunk turn stays.
test('trunk: the controls pair-08, pair-16 and the two-legged pair-33 come out exactly as the plain transplant', { skip: absent([...CONTROLS, '33']) }, () => {
  for (const id of [...CONTROLS, '33']) {
    const run = transplant(id, { autoFix: { trunk: true } });
    assert.equal(run.report.autoFix.trunk, undefined, `pair-${id}: the trunk turn was left out`);
    assert.equal(typeof run.report.autoFix.trunkLine, 'number', `pair-${id}: the trunk line is measured`);
    if (id === '33') assert.ok(run.report.autoFix.trunkLine < 0.08, `pair-33: its line ${run.report.autoFix.trunkLine} is short; only its legs keep the turn`);
    else assert.ok(run.report.autoFix.trunkLine >= 0.08, `pair-${id}: trunk line ${run.report.autoFix.trunkLine}`);
    assert.equal(difference(run.model, plain(id).model), null, `pair-${id}: trunk changed the result`);
  }
});

// ============================================================ 6. The option and the held-side refusals
test('autoFixOptions: off for false, null and {}; true turns on every key; an object only its true keys', () => {
  for (const off of [false, null, undefined, {}, { hand: false }]) assert.equal(autoFixOptions(off), null, JSON.stringify(off));
  assert.deepEqual(autoFixOptions(true), Object.fromEntries(AUTO_FIX_KEYS.map(key => [key, true])));
  assert.deepEqual(autoFixOptions({ markers: true, trunk: 'yes' }), Object.fromEntries(AUTO_FIX_KEYS.map(key => [key, key === 'markers'])));
  assert.deepEqual(AUTO_FIX_KEYS, ['hand', 'markers', 'detached', 'trunk', 'arms', 'looseAxis']);
});

// No copied model has two arms holding items without a weapon name. The Dwarf Stonemason (pair-16) holds measured items in
// both hands (58 and 37 long) but names its right: its real rig is read with the names taken off the arms, so the rule
// sees two held items and nothing else.
test('heldSide: two arms holding items, no name, is unknown and leaves Mirror to the names', { skip: absent(['16']) }, () => {
  const { own } = models('16'), { rigB } = rigs('16');
  assert.deepEqual(heldSide(own, rigB), { side: 'R', why: 'named' }, 'with its names the Stonemason holds in the right');
  const arms = Object.entries(rigB.parts).filter(([, part]) => part.limbKind === 'arm');
  assert.equal(arms.filter(([, part]) => part.weapon).length, 2, 'both arms hold a measured item');
  const unnamed = { ...rigB, parts: Object.fromEntries(Object.entries(rigB.parts).map(([key, part]) => [key, part.limbKind === 'arm' ? Object.create(part, { named: { value: false } }) : part])) };
  // (Object.create keeps the part's `limbKind`, a non-enumerable property that a spread would drop.)
  assert.deepEqual(heldSide(own, unnamed), { side: null, why: 'two items' });
  assert.equal(heldSide(own, { ok: false }).side, null, 'an unread rig is unknown');
});

test('main arms drive the recipient skin in Walk and Attack, leaving single-arm rigs alone', { skip: absent(['09', ...ALL]) }, () => {
  const id = '09', donor = models(id).donor, corrected = transplant(id, { autoFix: { arms: true } });
  // Native shoulder seam and wrist seam vertices, identified on Kel'Thuzad before transplant.
  const shoulder = [{ gi: 1, v: 140 }, { gi: 1, v: 367 }, { gi: 1, v: 383 }];
  const wrist = [{ gi: 0, v: 10 }, { gi: 1, v: 381 }, { gi: 0, v: 11 }];
  const node = (model, name) => allNodes(model).find(n => n.Name.trim() === name);
  const upper = node(donor, 'Bone_Arm1_R01'), hand = node(donor, 'Bone_Hand_R01');
  function armError(model, pattern) {
    const si = clip(model, pattern), di = clip(donor, pattern), [start, end] = model.Sequences[si].Interval;
    const dr = node(donor, 'Bone_Chest01'), rr = node(model, 'Bone_Chest01');
    let sum = 0, count = 0;
    for (let t = 0; t <= end - start; t += 20) {
      const d = sampleNodeMatrices(donor, donor.Sequences[di].Interval[0] + t, di);
      const r = sampleNodeMatrices(model, start + t, si);
      const target = worldPivot(donor, hand.ObjectId, d, hand).sub(worldPivot(donor, upper.ObjectId, d, upper))
        .transformDirection(d.get(dr.ObjectId).clone().invert());
      const skin = model.Geosets.map(g => skinGeoset(g, r));
      const direction = new Vector3().fromArray(sub(centre(skin, wrist), centre(skin, shoulder)))
        .transformDirection(r.get(rr.ObjectId).clone().invert());
      sum += direction.angleTo(target) * 180 / Math.PI;
      count++;
    }
    return sum / count;
  }
  for (const pattern of [/^Walk$/, /^Attack - 1$/]) {
    assert.ok(armError(plain(id).model, pattern) > 15);
    assert.ok(armError(corrected.model, pattern) <= 15);
  }
  for (const control of ALL) assert.equal(difference(plain(control).model, transplant(control, { autoFix: { arms: true } }).model), null);
});

test('detached surface includes child and mixed weights and refuses a triangle crossing back to the body', () => {
  const nodes = [0,1,2].map((ObjectId) => ({ ObjectId, Parent: ObjectId === 1 ? 0 : null }));
  const geo = { Vertices: new Float32Array(12), Faces: [0,1,2], Groups: [[0],[0,1],[1,2],[2]], VertexGroup: [0,1,2,3] };
  const model = { Nodes: nodes, Bones: nodes, Geosets: [geo] };
  const tree = nodeIndex(model, nodes);
  assert.deepEqual(detachedSurface(model, tree, 0, new Set()).vertices, [[0,0],[0,1],[0,2]]);
  geo.Faces.push(1,2,3);
  assert.equal(detachedSurface(model, tree, 0, new Set()), null);
});

test('detached pipe stays rigid in the scaling donor’s hand', { skip: absent(['841']) }, () => {
  const id = '841', own = models(id).own, plainModel = plain(id).model;
  const fixed = transplant(id, { autoFix: { detached: true } }).model;
  const edge = (model, si, time, a, b) => {
    const skin = skinGeoset(model.Geosets[3], sampleNodeMatrices(model, model.Sequences[si].Interval[0] + time, si));
    return new Vector3().fromArray(skin, a*3).distanceTo(new Vector3().fromArray(skin, b*3));
  };
  // A native seam shared by the tube and its tip. The native maximum includes the tip's own animation.
  let nativeMax = 0;
  for (const [si,s] of own.Sequences.entries()) for (let t=0; t<=s.Interval[1]-s.Interval[0]; t+=2)
    nativeMax = Math.max(nativeMax, edge(own,si,t,57,37));
  const death = clip(fixed,/^Death$/);
  assert.ok(edge(plainModel,death,650,57,37) > nativeMax+0.001);
  assert.ok(edge(fixed,death,650,57,37) <= nativeMax+0.001);
  const stand = clip(fixed,/^Stand - 1$/);
  const length = edge(fixed,stand,0,7,8);
  assert.ok(Math.abs(edge(fixed,stand,934,7,8)-length) < 0.001);
});


test('looseAxis seats a detached blade along the donor blade and inside the native grip limit', { skip: absent(['34']) }, () => {
  const {own, donor} = models('34');
  const donorHand = allNodes(donor).find(n => n.Name === 'R_Hand').ObjectId;
  const ownLine = itemLine(own, below(own,new Set([weaponBone(own)])));
  const donorLine = itemLine(donor, below(donor,new Set([donorHand])));
  const off = plain('34').model;
  const seated = transplant('34', {autoFix:{detached:true}}).model;
  const fixed = transplant('34', {autoFix:{detached:true,looseAxis:true}}).model;
  for (const move of [/^Walk$/, /^Attack - 1$/]) {
    assert.ok(itemAngle(seated,ownLine,donor,donorLine,move,2).max > 30);
    assert.ok(itemAngle(fixed,ownLine,donor,donorLine,move,2).max < 30);
  }
  assert.ok(floatGap('34',off,/^Walk$/,2).max > 0.092);
  assert.ok(floatGap('34',fixed,/^Walk$/,2).max <= 0.092);
});
