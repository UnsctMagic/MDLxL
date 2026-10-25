import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';
import { openDocument } from '../src/editor-document.js';
import { findWielders, retargetAnimations, attachTwoHanded, rigRoles, weaponOf, pairSequences, measureRetarget, resizeSequence, heldGear } from '../src/sd-retarget.js';

// A small biped: helpers carry the rig (Blizzard's Bone_* names), boxes are skinned to them.
// arms: 'reach' (both hands forward on a haft lying across them), 'down' (arms hang at the sides).
// Attack turns the chest (arms and weapon follow rigidly); Walk swings the legs; Death leans.
const q = (axis, deg) => Float32Array.from(new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), (deg * Math.PI) / 180).toArray());
const key = (Frame, Vector) => ({ Frame, Vector });
function biped({ size = 1, arms = 'reach', shoulder = 10, weapon = 'two', death = false } = {}) {
  const s = v => v.map(x => x * size), nodes = [], pivots = [];
  const helper = (Name, parent, pivot, extra = {}) => { const id = nodes.length; nodes.push({ Name, ObjectId: id, Parent: parent, Flags: 0, PivotPoint: Float32Array.from(s(pivot)), ...extra }); pivots.push(Float32Array.from(s(pivot))); return id; };
  const still = Frames => ({ LineType: 1, GlobalSeqId: null, Keys: Frames.map(f => key(f, q([0, 0, 1], 0))) });
  const seqFrames = [0, 1000, 2000, 3000, 4000, 4800, ...(death ? [6000, 7000] : [])];
  const root = helper('Bone_Root', -1, [0, 0, 62], { Translation: { LineType: 1, GlobalSeqId: null, Keys: [key(4000, Float32Array.of(0, 0, 0)), key(4400, Float32Array.of(0, 0, 3)), key(4800, Float32Array.of(0, 0, 0))] } });
  const pelvis = helper('Bone_Pelvis', root, [0, 0, 58], { Rotation: still(seqFrames) });
  const chest = helper('Bone_Chest', root, [0, 0, 64], { Rotation: { LineType: 1, GlobalSeqId: null, Keys: [key(0, q([0, 0, 1], 0)), key(1000, q([0, 0, 1], 0)), key(2000, q([0, 0, 1], 0)), key(2500, q([0, 0, 1], 60)), key(3000, q([0, 0, 1], 0)), ...(death ? [key(6000, q([0, 1, 0], 0)), key(7000, q([0, 1, 0], 70))] : [])] } });
  const head = helper('Bone_Head', chest, [0, 0, 80], { Rotation: still(seqFrames) });
  const palm = { R: arms === 'reach' ? [16, -5, 44] : [0, -shoulder - 2, 36], L: arms === 'reach' ? [16, 5, 44] : [0, shoulder + 2, 36] };
  const elbow = { R: arms === 'reach' ? [6, -shoulder - 2, 58] : [0, -shoulder - 2, 50], L: arms === 'reach' ? [6, shoulder + 2, 58] : [0, shoulder + 2, 50] };
  const hands = {};
  for (const side of ['R', 'L']) {
    const y = side === 'R' ? -1 : 1;
    const up = helper(`Bone_Arm1_${side}`, chest, [0, y * shoulder, 74], { Rotation: still(seqFrames) });
    const low = helper(`Bone_Arm2_${side}`, up, elbow[side], { Rotation: still(seqFrames) });
    const wrist = palm[side].map((v, i) => v + 0.2 * (elbow[side][i] - v));
    hands[side] = helper(`Bone_Hand_${side}`, low, wrist, { Rotation: still(seqFrames) });
  }
  for (const side of ['R', 'L']) {
    const y = side === 'R' ? -1 : 1;
    const up = helper(`Bone_Leg1_${side}`, pelvis, [0, y * 5, 54], { Rotation: { LineType: 1, GlobalSeqId: null, Keys: [key(0, q([0, 1, 0], 0)), key(1000, q([0, 1, 0], 0)), key(2000, q([0, 1, 0], 0)), key(3000, q([0, 1, 0], 0)), key(4000, q([0, 1, 0], 25 * y)), key(4400, q([0, 1, 0], -25 * y)), key(4800, q([0, 1, 0], 25 * y))] } });
    const low = helper(`Bone_Leg2_${side}`, up, [0, y * 6, 30], { Rotation: still(seqFrames) });
    const foot = helper(`Bone_Foot_${side}`, low, [0, y * 6, 8], { Rotation: still(seqFrames) });
    nodes.push({ Name: `Foot ${side === 'R' ? 'Right' : 'Left'} Ref`, ObjectId: nodes.length, Parent: foot, Flags: 2048, PivotPoint: Float32Array.from(s([3, y * 6, 1])) }); pivots.push(Float32Array.from(s([3, y * 6, 1])));
  }
  let sword = null;
  if (weapon) sword = helper('Bone_Weapon', hands.R, palm.R, { Rotation: still(seqFrames) });
  const helpers = nodes.slice(), bones = [];
  // One mesh bone per rig bone that carries a box (Blizzard SD style: mesh bones under helpers).
  const geosets = [];
  const box = (bone, lo, hi) => {
    const id = nodes.length, b = { Name: `Mesh_${nodes[bone].Name}_${id}`, ObjectId: id, Parent: bone, Flags: 256, GeosetId: null, GeosetAnimId: null, PivotPoint: Float32Array.from(nodes[bone].PivotPoint) };
    nodes.push(b); bones.push(b); pivots.push(b.PivotPoint);
    const V = [], F = [];
    lo = s(lo); hi = s(hi);
    for (let i = 0; i < 8; i++) V.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]);
    for (const f of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) F.push(f[0], f[1], f[2], f[0], f[2], f[3]);
    geosets.push({ Vertices: new Float32Array(V), Normals: new Float32Array(24).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), TVertices: [new Float32Array(16)], Faces: new Uint16Array(F), VertexGroup: new Uint8Array(8), Groups: [[id]], TotalGroupsCount: 1, MaterialID: 0, SelectionGroup: 0, Anims: [] });
  };
  box(chest, [-6, -8, 58], [6, 8, 78]); box(head, [-4, -4, 78], [4, 4, 88]);
  for (const side of ['R', 'L']) {
    const p = palm[side];
    box(hands[side], [p[0] - 2, p[1] - 2, p[2] - 2], [p[0] + 2, p[1] + 2, p[2] + 2]);
  }
  if (sword != null) {
    // Two-handed: a haft along Y through both palms, a wide head at +Y. One-handed: a short sword forward.
    const p = palm.R, two = weapon === 'two', tip = two ? [p[0], p[1] + 34, p[2]] : [p[0] + 30, p[1], p[2]];
    if (two) { box(sword, [p[0] - 1, p[1] - 20, p[2] - 1], [p[0] + 1, p[1] + 34, p[2] + 1]); box(sword, [p[0] - 1, p[1] + 34, p[2] - 9], [p[0] + 1, p[1] + 44, p[2] + 9]); }
    else { box(sword, [p[0] - 4, p[1] - 1, p[2] - 1], [p[0] + 30, p[1] + 1, p[2] + 1]); }
    nodes.push({ Name: 'Weapon Ref', ObjectId: nodes.length, Parent: sword, Flags: 2048, PivotPoint: Float32Array.from(s(tip)) }); pivots.push(nodes.at(-1).PivotPoint);
  }
  const attachments = nodes.filter(n => n.Flags === 2048);
  return {
    Version: 800, Info: { Name: 'Biped' }, GlobalSequences: [],
    Sequences: [{ Name: 'Stand Ready', Interval: Uint32Array.of(0, 1000) }, { Name: 'Attack', Interval: Uint32Array.of(2000, 3000), NonLooping: false }, { Name: 'Walk', Interval: Uint32Array.of(4000, 4800) }, ...(death ? [{ Name: 'Death', Interval: Uint32Array.of(6000, 7000), NonLooping: true }] : [])],
    Textures: [{ Image: 'Textures\\white.blp', ReplaceableId: 0, Flags: 0 }], Materials: [{ Layers: [{ FilterMode: 0, TextureID: 0, Alpha: 1 }] }],
    Geosets: geosets, GeosetAnims: [], Bones: bones, Helpers: helpers.filter(n => n.Flags !== 2048), Attachments: attachments, PivotPoints: pivots,
  };
}
const world = (model, id, frame, seq) => { const n = allNodes(model).find(x => x.ObjectId === id); return new Vector3().fromArray(n.PivotPoint).applyMatrix4(sampleNodeMatrices(model, frame, seq).get(id)); };
const byName = (model, name) => allNodes(model).find(n => n.Name === name).ObjectId;

test('rig roles: root, pelvis, chest, head, arms and legs by side, hands at the fist', () => {
  const m = biped(), r = rigRoles(m);
  assert.equal(allNodes(m).find(n => n.ObjectId === r.root).Name, 'Bone_Root');
  assert.equal(allNodes(m).find(n => n.ObjectId === r.pelvis).Name, 'Bone_Pelvis');
  assert.equal(allNodes(m).find(n => n.ObjectId === r.chest).Name, 'Bone_Chest');
  assert.equal(allNodes(m).find(n => n.ObjectId === r.head).Name, 'Bone_Head');
  assert.deepEqual(Object.keys(r.arms).sort(), ['L', 'R']);
  assert.deepEqual(Object.keys(r.legs).sort(), ['L', 'R']);
  assert.equal(r.arms.R.palm.kind, 'hand mesh');
  assert.ok(r.arms.R.palm.rest.distanceTo(new Vector3(16, -5, 44)) < 0.01, 'palm at the middle of the fist');
  const w = weaponOf(m);
  assert.equal(w.name, 'Bone_Weapon'); assert.equal(w.side, 'R'); assert.equal(w.triangles.length, 24);
});

test('findWielders: a two-handed grip ranks first; a one-handed unit is not two-handed', () => {
  const ranked = findWielders([{ name: 'one hand', model: biped({ arms: 'down', weapon: 'one' }) }, { name: 'two hands', model: biped() }]);
  assert.equal(ranked[0].name, 'two hands');
  assert.equal(ranked[0].twoHanded, true);
  assert.equal(ranked[0].attack.offHeld, 1);
  assert.equal(ranked[0].stance.name, 'Stand Ready');
  assert.equal(ranked[1].twoHanded, false);
  assert.ok(ranked[1].attack.offMedian > 10);
});

test('pairSequences: closest names, plain kinds as fallback, explicit overrides', () => {
  const t = { Sequences: ['Stand - 1', 'Attack - 2', 'Walk Defend', 'Death'].map(Name => ({ Name })) };
  const s = { Sequences: ['Stand', 'Stand Ready', 'Attack', 'Attack 2', 'Walk', 'Attack Slam'].map(Name => ({ Name })) };
  assert.deepEqual(pairSequences(t, s), [[0, 0], [1, 3], [2, 4]]);
  assert.deepEqual(pairSequences(t, s, undefined, { 'Stand - 1': 'Stand Ready' }), [[0, 1], [1, 3], [2, 4]]);
  assert.throws(() => pairSequences(t, s, { 'Stand - 1': 'Nope' }), /Unknown sequence/);
});

test('retarget: limbs point where the source limbs point, other sequences stay, keys are sparse', () => {
  const source = biped(), target = biped({ size: 0.8, arms: 'down', shoulder: 13, weapon: null, death: true });
  const death = structuredClone(allNodes(target).find(n => n.Name === 'Bone_Chest').Rotation.Keys.filter(k => k.Frame >= 6000));
  const report = retargetAnimations(target, source, { mainHand: 'R', timing: { stand: 'target' } });
  assert.equal(report.mirror, false);
  assert.deepEqual(report.sequences.map(s => [s.target, s.source]), [['Stand Ready', 'Stand Ready'], ['Attack', 'Attack'], ['Walk', 'Walk']]);
  // Upper and lower arm directions at the middle of the swing match the source's.
  for (const side of ['R', 'L']) for (const [a, b] of [[`Bone_Arm1_${side}`, `Bone_Arm2_${side}`], [`Bone_Arm2_${side}`, `Bone_Hand_${side}`]]) {
    const dt = world(target, byName(target, b), 2500, 1).sub(world(target, byName(target, a), 2500, 1)).normalize();
    const ds = world(source, byName(source, b), 2500, 1).sub(world(source, byName(source, a), 2500, 1)).normalize();
    assert.ok(dt.angleTo(ds) < (1.5 * Math.PI) / 180, `${a} aims like the source (${((dt.angleTo(ds) * 180) / Math.PI).toFixed(2)} deg)`);
  }
  // The chest turned 60 degrees as the source's did.
  const chest = sampleNodeMatrices(target, 2500, 1).get(byName(target, 'Bone_Chest'));
  assert.ok(Math.abs(new Vector3(1, 0, 0).transformDirection(chest).angleTo(new Vector3(1, 0, 0)) - Math.PI / 3) < 0.02);
  // Death is untouched; the walk's ground speed kept the target's own.
  assert.deepEqual(allNodes(target).find(n => n.Name === 'Bone_Chest').Rotation.Keys.filter(k => k.Frame >= 6000 + (target.Sequences[3].Interval[0] - 6000)).map(k => Array.from(k.Vector)), death.map(k => Array.from(k.Vector)));
  const attack = report.sequences[1];
  assert.ok(attack.keys < attack.samples * 8, `sparse keys: ${attack.keys} for ${attack.samples} samples of ${report.pairs.length} bones`);
});

test('attachTwoHanded: the weapon follows the main hand and the off hand is pulled onto the haft', () => {
  const source = biped(), target = biped({ size: 0.8, arms: 'down', shoulder: 13, weapon: null });
  const report = retargetAnimations(target, source, { mainHand: 'R', timing: { stand: 'target' } });
  const w = weaponOf(source), sel = {};
  for (const [gi, a, b, c] of w.triangles) (sel[gi] ||= new Set()).add(a).add(b).add(c);
  const part = { Version: 800, Textures: structuredClone(source.Textures), Materials: structuredClone(source.Materials), GeosetAnims: [], Bones: [{ Name: 'DummyBone', ObjectId: 0, Parent: -1, Flags: 256, PivotPoint: new Float32Array(3) }], PivotPoints: [new Float32Array(3)], Sequences: [], GlobalSequences: [],
    Geosets: Object.keys(sel).map(gi => ({ ...structuredClone(source.Geosets[gi]), Groups: [[0]] })) };
  const before = measureRetarget(target, source, report);
  const grip = attachTwoHanded(target, part, report);
  const attack = grip.sequences.find(s => s.target === 'Attack');
  assert.ok(attack.mainHand.max < 2, `main hand on the haft: ${attack.mainHand.max}`);
  assert.equal(attack.offHand.framesHeld, attack.offHand.frames);
  assert.ok(attack.offHand.max < 2, `off hand on the haft: ${attack.offHand.max}`);
  assert.ok(allNodes(target).some(n => n.Name === 'Bone_Weapon2H'));
  assert.ok(before.sequences.every(s => s.maxStray.units < 20));
});

test('resizeSequence moves later sequences, their keys and events along', () => {
  const m = biped({ death: true });
  m.EventObjects = [{ Name: 'SNDxTEST', ObjectId: 99, Parent: -1, Flags: 1024, EventTrack: Uint32Array.of(2500, 6500), PivotPoint: new Float32Array(3) }];
  resizeSequence(m, 1, 1500);
  assert.deepEqual(Array.from(m.Sequences[1].Interval), [2000, 3500]);
  assert.deepEqual(Array.from(m.Sequences[3].Interval), [6500, 7500]);
  assert.deepEqual(Array.from(m.EventObjects[0].EventTrack), [2750, 7000]);
  assert.ok(allNodes(m).find(n => n.Name === 'Bone_Chest').Rotation.Keys.some(k => k.Frame === 2750), 'the swing key moved with its slot');
});

// The real thing, from the installed game: the Footman gets Gorehowl and Grom Hellscream's motion.
const game = 'D:/Warcraft III', bridge = new URL('../electron/casc/CascBridge-0.9.0.exe', import.meta.url);
test('Footman with a two-handed axe from Grom Hellscream (installed game)', { skip: !(fs.existsSync(game) && fs.existsSync(bridge)) && 'needs the installed game', timeout: 120000 }, async () => {
  const { CascReader } = createRequire(import.meta.url)('../electron/casc.cjs');
  const bash = await import('../src/sd-kitbash.js'), know = await import('../src/sd-knowledge.js');
  const casc = new CascReader(game, new URL('../electron', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const read = async file => openDocument(await casc.read('war3.w3mod:' + file), file.split('\\').at(-1)).model;
  let footman, grom, paladin, blademaster;
  try { await casc.ready; [footman, grom, paladin, blademaster] = [await read('units\\human\\footman\\footman.mdx'), await read('units\\orc\\hellscream\\hellscream.mdx'), await read('units\\human\\heropaladin\\heropaladin.mdx'), await read('units\\orc\\heroblademaster\\heroblademaster.mdx')]; } finally { casc.close(); }
  const ranked = findWielders([{ name: 'paladin', model: paladin }, { name: 'grom', model: grom }, { name: 'blademaster', model: blademaster }]);
  assert.deepEqual(ranked.map(r => [r.name, r.twoHanded]), [['paladin', true], ['grom', true], ['blademaster', false]]);
  const doc = openDocument(new TextEncoder().encode('Version { FormatVersion 800, }\nModel "Footman2H" { BlendTime 150, }\n'), 'Footman2H.mdl');
  let report, grip, checks;
  doc.apply('Footman with a two-handed axe', [], model => {
    bash.adopt(model, footman);
    const gear = heldGear(model, know.partsOf('footman').filter(p => /sword|shield/i.test(p.label)), { extraBones: ['handle'] });
    assert.equal(Object.values(gear).flat().length, 88, 'sword, shield, glints and the Decay sword');
    bash.remove(model, gear);
    report = retargetAnimations(model, grom, { pairs: { 'Stand Defend': 'Stand Ready' } });
    const axe = bash.take(grom, bash.select(grom, ...know.partsOf('hellscream').filter(p => /gorehowl/i.test(p.label))));
    grip = attachTwoHanded(model, axe, report);
    checks = measureRetarget(model, grom, report, { original: footman });
  });
  assert.equal(report.mirror, true, 'Grom holds Gorehowl in the other hand: mirrored');
  const attack = grip.sequences.find(s => s.target === 'Attack - 1');
  assert.ok(attack.mainHand.max < 2, `main hand ${attack.mainHand.max}`);
  assert.ok(attack.offHand.median < 2 && attack.offHand.max < 7, `off hand ${JSON.stringify(attack.offHand)}`);
  assert.ok(grip.sequences.find(s => s.target === 'Stand Defend').offHand.max < 2);
  const walk = checks.sequences.find(s => s.target === 'Walk');
  assert.ok(Math.abs(walk.feet.groundSpeed - walk.originalFeet.groundSpeed) / walk.originalFeet.groundSpeed < 0.05, 'walk keeps the Footman ground speed');
  assert.ok(walk.feet.feet.every(f => f.lowest > -5), 'feet stay on the ground');
  assert.ok(checks.sequences.every(s => s.maxStray.units < 30), 'no exploded limbs');
  assert.ok(checks.sequences.every(s => s.loopSeam === undefined || s.loopSeam < 0.5), 'loops close');
  const mdx = doc.serialize('mdx'), mdl = doc.serialize('mdl');
  assert.ok(mdx.length < 300 * 1024, `MDX ${mdx.length} bytes`);
  for (const [bytes, name] of [[mdx, 'f.mdx'], [mdl, 'f.mdl']]) {
    const back = openDocument(bytes, name).model;
    assert.equal(back.Version, 800);
    assert.deepEqual(back.Sequences.map(s => s.Name), doc.model.Sequences.map(s => s.Name));
    assert.ok(allNodes(back).some(n => n.Name === 'Bone_Weapon2H'));
  }
});
