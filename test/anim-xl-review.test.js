import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as animXL from '../src/anim-xl.js';
import { openDocument } from '../src/editor-document.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { ANIMXL_DEFAULTS, animXLDeathStyle, animXLRetimed, animXLTimeMap, applyAnimXL, buildAnimXL, settleSpring, suggestAnimXLBones } from '../src/anim-xl.js';
import { sampleNodeMatrices, sampleTrack } from '../src/animation.js';

// Regression tests for the engine review findings: AnimXL changes nothing it
// was not asked to change, and time never runs backwards.

const q = deg => new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), deg * Math.PI / 180).toArray());
const rot = (rows, type = 1) => ({ LineType: type, GlobalSeqId: -1, Keys: rows.map(([Frame, deg]) => ({ Frame, Vector: q(deg) })) });
const angleAt = (track, frame, interval) => new Quaternion().fromArray(sampleTrack(track, frame, { interval, quaternion: true, fallback: [0, 0, 0, 1] })).angleTo(new Quaternion()) * 180 / Math.PI;
const twoBones = rotation => ({
  Sequences: [{ Name: 'Loop', Interval: [0, 1000], NonLooping: false }, { Name: 'Other', Interval: [2000, 3000], NonLooping: true }],
  Bones: [{ Name: 'Bone_Pelvis', ObjectId: 0, Parent: -1, Flags: 256, PivotPoint: [0, 0, 0] }, { Name: 'Bone_Arm', ObjectId: 1, Parent: 0, Flags: 256, PivotPoint: [0, 0, 20], Rotation: rotation }],
  Helpers: [], Geosets: [], PivotPoints: [[0, 0, 0], [0, 0, 20]], GlobalSequences: [],
});

test('AnimXL with nothing turned up leaves an authored loop seam alone', () => {
  const model = twoBones(rot([[0, 0], [500, 90], [1000, 45]]));
  assert.equal(buildAnimXL(model, 0, {}).tracks.length, 0);
});

test('AnimXL keeps another animation that steps between keys stepping', () => {
  const model = twoBones(rot([[0, 0], [500, 90], [1000, 45], [2000, 0], [3000, 90]], 0));
  model.Sequences[0].NonLooping = true;
  const before = [2000, 2500, 2998, 3000].map(t => angleAt(model.Bones[1].Rotation, t, [2000, 3000]));
  applyAnimXL(model, buildAnimXL(model, 0, { overlap: 80 }));
  const after = [2000, 2500, 2998, 3000].map(t => angleAt(model.Bones[1].Rotation, t, [2000, 3000]));
  after.forEach((a, i) => assert.ok(Math.abs(a - before[i]) < 0.01, `frame ${[2000, 2500, 2998, 3000][i]}: ${before[i]} -> ${a}`));
});

test('suggested heavy and loose bones do nothing until their sliders are up', () => {
  const pivots = [[0, 0, 0], [0, 0, 20], [10, 0, 20], [0, 10, 20]], names = ['Bone_Pelvis', 'Bone_Arm', 'Bone_Sword', 'Bone_Tail'];
  const model = { Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], PivotPoints: pivots, Geosets: [], Helpers: [],
    Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: names[ObjectId], Parent: ObjectId === 0 ? -1 : ObjectId === 1 ? 0 : 1, PivotPoint, Flags: 256, ...(ObjectId === 1 ? { Rotation: rot([[0, 0], [500, 90], [1000, 0]]) } : {}) })) };
  const picks = suggestAnimXLBones(model);
  assert.deepEqual([picks.heavyIds, picks.looseIds], [[2], [3]]);
  assert.equal(buildAnimXL(model, 0, picks).tracks.length, 0);
  assert.ok(buildAnimXL(model, 0, { ...picks, heavy: 50, loose: 50 }).tracks.some(t => t.id === 2), 'the sword drags once Heavy is up');
});

test('overlapping THUNK holds never run source time backwards', () => {
  const map = animXLTimeMap([0, 500, 1000], { ...ANIMXL_DEFAULTS, thunks: [100, 250, 250] });
  for (let t = 1; t <= 1000; t++) assert.ok(map(t) >= map(t - 1) - 1e-9, `time ran backwards at ${t}`);
  assert.equal(map(1000), 1000);
});

test('a very short animation keeps its last pose at its end', () => {
  const keys = [0, 1, 2, 3, 30];
  assert.deepEqual(animXLRetimed(keys, ANIMXL_DEFAULTS), keys);
  assert.equal(animXLTimeMap(keys, ANIMXL_DEFAULTS)(30), 30);
  const squeezed = animXLRetimed(keys, { retime: { 2: 29 } });
  assert.equal(squeezed[4], 30);
  for (let i = 1; i < squeezed.length; i++) assert.ok(squeezed[i] > squeezed[i - 1]);
});

test('stiff bones get no Life wobble', () => {
  const model = { ...twoBones(rot([[0, 0], [500, 0], [1000, 0]])), Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }] };
  const result = buildAnimXL(model, 0, { life: 100, stiffIds: [1] });
  assert.equal(result.tracks.length, 0);
});

test('a planted foot keeps its authored orientation even when it is already in place', () => {
  const pivots = [[0, 0, 40], [0, 0, 40], [8, 0, 20], [0, 0, 0]], names = ['Bone_Pelvis', 'Bone_Thigh_L', 'Bone_Shin_L', 'Bone_Foot_L'], parents = [-1, 0, 1, 2];
  const model = { Sequences: [{ Name: 'Stand', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], Helpers: [], Geosets: [], PivotPoints: pivots,
    Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: names[ObjectId], Parent: parents[ObjectId], PivotPoint, Flags: 256, ...(ObjectId === 3 ? { Rotation: rot([[0, 0], [500, 90], [1000, 0]]) } : {}) })) };
  const planted = structuredClone(model);
  applyAnimXL(planted, buildAnimXL(model, 0, { overlap: 70, poses: 0, feet: true }));
  const orientation = matrix => { const r = new Quaternion(); matrix.decompose(new Vector3(), r, new Vector3()); return r; };
  for (let t = 0; t <= 1000; t += 33) {
    const a = sampleNodeMatrices(model, t, 0).get(3), b = sampleNodeMatrices(planted, t, 0).get(3);
    assert.ok(orientation(a).angleTo(orientation(b)) * 180 / Math.PI < 1.5, `foot turned at ${t}`);
  }
});

test('a Weapon Ref at the mouth or on an empty bone is not a weapon; a skinned held part is', () => {
  const bone = (ObjectId, Name, Parent) => ({ ObjectId, Name, Parent, Flags: 256, PivotPoint: [0, 0, ObjectId * 5] });
  const model = {
    Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], Helpers: [], PivotPoints: [],
    Bones: [bone(0, 'Bone_Pelvis', -1), bone(1, 'Bone_Head', 0), bone(2, 'Bone_Jaw', 1), bone(3, 'Bone_Hand_R', 0), bone(4, 'Object01', 3), bone(5, 'Bone_Weapon', 3)],
    Attachments: [{ Name: 'Weapon Ref', ObjectId: 6, Parent: 2 }, { Name: 'Weapon Ref Right', ObjectId: 7, Parent: 4 }],
    Geosets: [{ Vertices: new Float32Array(6), VertexGroup: new Uint8Array([0, 1]), Groups: [[2], [4]] }],
  };
  assert.deepEqual(suggestAnimXLBones(model).heavyIds, [4]);
});

// A stick figure: root > pelvis > spine > head, and two legs, standing 100 units tall.
function stickFigure(length = 1000) {
  const bones = [['Bone_Root', -1, [0, 0, 0]], ['Bone_Pelvis', 0, [0, 0, 50]], ['Bone_Spine', 1, [0, 0, 75]], ['Bone_Head', 2, [0, 0, 100]],
    ['Bone_Thigh_L', 1, [0, 8, 50]], ['Bone_Shin_L', 4, [2, 8, 25]], ['Bone_Foot_L', 5, [0, 8, 2]],
    ['Bone_Thigh_R', 1, [0, -8, 50]], ['Bone_Shin_R', 7, [2, -8, 25]], ['Bone_Foot_R', 8, [0, -8, 2]]];
  const still = { LineType: 1, GlobalSeqId: -1, Keys: [0, length, length + 1000, length + 2000].map(Frame => ({ Frame, Vector: q(0) })) };
  return { Sequences: [{ Name: 'Stand', Interval: [0, length], NonLooping: false }, { Name: 'Walk', Interval: [length + 1000, length + 2000], NonLooping: false }], GlobalSequences: [], Helpers: [], Geosets: [],
    PivotPoints: bones.map(b => b[2]), Bones: bones.map(([Name, Parent, PivotPoint], ObjectId) => ({ Name, ObjectId, Parent, PivotPoint, Flags: 0, Rotation: structuredClone(still) })) };
}

test('collapse drops a standing figure to the ground and leaves other animations alone', () => {
  const model = stickFigure();
  const result = buildAnimXL(model, 0, { collapse: 100, collapseAt: 10, collapseStyle: 'limp' });
  assert.ok(result.tracks.length > 0);
  for (const t of result.tracks) for (const k of t.track.Keys) assert.ok(Array.from(k.Vector).every(Number.isFinite));
  const fallen = structuredClone(model);
  applyAnimXL(fallen, result);
  const head = (m, t, seq) => new Vector3(0, 0, 100).applyMatrix4(sampleNodeMatrices(m, t, seq).get(3));
  assert.ok(head(fallen, 1000, 0).z < 30, `the head ends near the ground (z=${head(fallen, 1000, 0).z.toFixed(1)})`);
  assert.ok(head(fallen, 1000, 0).x < -20, 'it falls backwards by default');
  assert.ok(head(fallen, 0, 0).distanceTo(head(model, 0, 0)) < 0.5, 'before it goes limp the animation is unchanged');
  assert.ok(head(fallen, 2500, 1).distanceTo(head(model, 2500, 1)) < 0.01, 'the Walk is untouched');
});

test('collapse below Full sags partway, more as the slider rises', () => {
  // Before, everything under 100 held the pose and only Full fell (the animation study's 25/50 rows were identical).
  const model = stickFigure();
  const headAt = collapse => { const m = structuredClone(model); applyAnimXL(m, buildAnimXL(model, 0, { collapse, collapseAt: 10, collapseStyle: 'limp' })); return new Vector3(0, 0, 100).applyMatrix4(sampleNodeMatrices(m, 1000, 0).get(3)).z; };
  const heights = [25, 50, 75, 100].map(headAt);
  for (let i = 1; i < heights.length; i++) assert.ok(heights[i] < heights[i - 1] - 3, `each step sinks further: ${heights.map(h => h.toFixed(1)).join(', ')}`);
  assert.ok(heights[0] > 90, `a little Collapse barely sags (z=${heights[0].toFixed(1)})`);
  assert.ok(heights[1] < 95 && heights[1] > 40, `half Collapse sags partway (z=${heights[1].toFixed(1)})`);
});

test('the Settle slider spreads its springiness evenly', () => {
  // Overshoot only shows at low damping, so a straight scale did little until the last quarter.
  assert.equal(settleSpring(0), 0);
  assert.equal(settleSpring(25), 0.5);
  assert.equal(settleSpring(100), 1);
  // The presets were rescaled to keep their look: 9 now is what 30 was.
  assert.ok(Math.abs(settleSpring(9) - 0.3) < 1e-9);
});

test('a section is shaped on its own: outside it and its edge keys stay exactly as they were', () => {
  const model = { ...twoBones(rot([[0, 0], [250, 60], [500, 90], [750, 30], [1000, 0]])), Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }] };
  const before = structuredClone(model.Bones[1].Rotation);
  const result = buildAnimXL(model, 0, { overlap: 90, settle: 60, poses: 0, range: [250, 750] });
  const shaped = structuredClone(model);
  applyAnimXL(shaped, result);
  const track = shaped.Bones[1].Rotation;
  for (const t of [0, 100, 240, 760, 900, 1000]) assert.ok(Math.abs(angleAt(track, t, [0, 1000]) - angleAt(before, t, [0, 1000])) < 0.05, `unchanged at ${t}`);
  for (const frame of [0, 250, 750, 1000]) assert.deepEqual(Array.from(track.Keys.find(k => k.Frame === frame).Vector), Array.from(before.Keys.find(k => k.Frame === frame).Vector), `original key kept at ${frame}`);
  const inside = [350, 450, 550, 650].map(t => Math.abs(angleAt(track, t, [0, 1000]) - angleAt(before, t, [0, 1000])));
  assert.ok(Math.max(...inside) > 1, `the section itself changes (${inside.map(v => v.toFixed(1)).join(', ')} degrees)`);
  assert.equal(buildAnimXL(model, 0, { overlap: 90, range: [400, 400] }).tracks.length, 0, 'an empty section shapes nothing');
});

test('selected bones: only they are shaped, every other bone keeps its animation exactly', () => {
  const pivots = [[0, 0, 0], [0, 0, 20], [10, 0, 20], [0, 10, 20]], names = ['Bone_Pelvis', 'Bone_Arm', 'Bone_Sword', 'Bone_Tail'];
  const model = { Sequences: [{ Name: 'Attack', Interval: [0, 1000], NonLooping: true }], GlobalSequences: [], PivotPoints: pivots, Geosets: [], Helpers: [],
    Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: names[ObjectId], Parent: ObjectId === 0 ? -1 : ObjectId === 1 ? 0 : 1, PivotPoint, Flags: 256, Rotation: rot(ObjectId === 1 ? [[0, 0], [500, 90], [1000, 0]] : [[0, 0], [1000, 0]]) })) };
  const all = buildAnimXL(model, 0, { overlap: 90, heavy: 80, heavyIds: [2], loose: 80, looseIds: [3], poses: 0 });
  const picked = buildAnimXL(model, 0, { overlap: 90, heavy: 80, heavyIds: [2], loose: 80, looseIds: [3], poses: 0, only: [2] });
  assert.ok(all.tracks.some(t => t.id === 3), 'without a selection the tail is shaped too');
  assert.deepEqual(picked.tracks.map(t => t.id), [2], 'with the sword selected, only the sword is shaped');
});

test('Auto picks a death type the rig can do', () => {
  assert.equal(animXLDeathStyle('auto', 2), 'knees');
  assert.equal(animXLDeathStyle('auto', 4), 'limp', 'four legs fall onto the side limp');
  assert.equal(animXLDeathStyle('back', 0), 'limp', 'no legs: nothing to buckle');
  assert.equal(animXLDeathStyle('back', 2), 'back');
});

test('death types pose the unit with its feet planted, then fall the way they name', () => {
  const model = stickFigure(3000), at = (m, t, id, p) => new Vector3(...p).applyMatrix4(sampleNodeMatrices(m, t, 0).get(id));
  // Each with a moment just before its fall begins (the poses span 1.5x their 2-second timing here).
  const ways = { back: [500, h => h.x < -20], knees: [1500, h => h.x > 20], forward: [1100, h => h.x > 20], side: [1700, h => Math.abs(h.y) > 40] };
  for (const [style, [posing, way]] of Object.entries(ways)) {
    const result = buildAnimXL(model, 0, { collapse: 100, collapseAt: 0, collapseStyle: style }), m = structuredClone(model);
    assert.equal(result.rig.deathStyle, style);
    applyAnimXL(m, result);
    // Before the fall: knees bent, body lower, feet where they stood.
    const foot = at(m, posing, 6, [0, 8, 2]), head = at(m, posing, 3, [0, 0, 100]);
    assert.ok(foot.distanceTo(new Vector3(0, 8, 2)) < 1, `${style}: the foot stays planted while posing (${foot.toArray().map(v => v.toFixed(1))})`);
    assert.ok(head.z < 99, `${style}: the body sinks into the pose (head z=${head.z.toFixed(1)})`);
    const end = at(m, 3000, 3, [0, 0, 100]);
    assert.ok(end.z < 30, `${style}: the head ends near the ground (z=${end.z.toFixed(1)})`);
    assert.ok(way(end), `${style}: falls its way (head ${end.toArray().map(v => v.toFixed(0))})`);
  }
});

test('each foot stays on its own spot while a death type poses, even in an uneven stance', () => {
  // The left foot stands forward: moving the body by the average foot shift alone let both feet slide.
  const model = stickFigure(3000), at = (m, t, id, p) => new Vector3(...p).applyMatrix4(sampleNodeMatrices(m, t, 0).get(id));
  model.Bones[5].PivotPoint = model.PivotPoints[5] = [8, 8, 26]; model.Bones[6].PivotPoint = model.PivotPoints[6] = [14, 8, 2];
  const m = structuredClone(model);
  applyAnimXL(m, buildAnimXL(model, 0, { collapse: 100, collapseAt: 0, collapseStyle: 'knees' }));
  for (const t of [600, 1000, 1500]) for (const [id, p] of [[6, [14, 8, 2]], [9, [0, -8, 2]]]) {
    const foot = at(m, t, id, p);
    assert.ok(foot.distanceTo(new Vector3(...p)) < 1, `foot ${id} at ${t} ms stays put (${foot.toArray().map(v => v.toFixed(1))})`);
  }
});

test('a fall with too little time left skips the posing so it can still land', () => {
  // 900 ms after Start time is about what a fall needs; the posing would leave it hanging mid-air.
  const short = buildAnimXL(stickFigure(1000), 0, { collapse: 100, collapseAt: 10, collapseStyle: 'knees' });
  assert.equal(short.rig.deathStyle, 'limp');
  assert.equal(short.rig.shortFall, true);
  const long = buildAnimXL(stickFigure(3000), 0, { collapse: 100, collapseAt: 10, collapseStyle: 'knees' });
  assert.equal(long.rig.deathStyle, 'knees');
  assert.equal(long.rig.shortFall, false);
});

// Frozen from 8751ef63 on the mounted knight fixture: Attack - 1 and Walk.
const overlapBaseline = [
  {
    "name": "Default",
    "seq": 3,
    "sequence": "Attack - 1",
    "hash": "e6b0e6796e0a91e53c5bd083e509fdb90bd0eb843780ddec7840cd59cfcc82a7"
  },
  {
    "name": "Default",
    "seq": 0,
    "sequence": "Walk",
    "hash": "aee86584de6e826421fe89aecf60191c198f81a236e349e27f459810868e2954"
  },
  {
    "name": "Heavy",
    "seq": 3,
    "sequence": "Attack - 1",
    "hash": "e5be5edfcb0bb28ca1106e5676af4ed9ddad411e707ef83d8a9e5920abfcaf17"
  },
  {
    "name": "Heavy",
    "seq": 0,
    "sequence": "Walk",
    "hash": "262761f34d97ed3238ba371a57d38b8bc1382a0f40d3764450ca6c18095768c9"
  },
  {
    "name": "Agile",
    "seq": 3,
    "sequence": "Attack - 1",
    "hash": "b4716eec7290feb21fcdef4e0099d8a8447ff7e6e9daa53dbbe238085f4bb9a7"
  },
  {
    "name": "Agile",
    "seq": 0,
    "sequence": "Walk",
    "hash": "4c48960c83539922661ae276d14855c0c4eb9d46a22c77db9c739b9efe178c3e"
  },
  {
    "name": "Relaxed",
    "seq": 3,
    "sequence": "Attack - 1",
    "hash": "9b603d7ebfc5a3a10ad9184d35d3efa60e186ac73a577c9c8252cb327c3e5dc3"
  },
  {
    "name": "Relaxed",
    "seq": 0,
    "sequence": "Walk",
    "hash": "10266c4f1fbf134b5cf8426dcd09cd63473042ee7338b90cd03032430c6a1789"
  },
  {
    "name": "Fall",
    "seq": 3,
    "sequence": "Attack - 1",
    "hash": "7f4f828f68da50ee6b28dd51f6828d2ca09766b058b46880980e84b8f579b320"
  },
  {
    "name": "Fall",
    "seq": 0,
    "sequence": "Walk",
    "hash": "55dc6c41c5b77a03c428918a78e88fc9bab2460faf68db4b5eea15750cab756b"
  },
  {
    "settings": {
      "overlap": 100
    },
    "seq": 3,
    "hash": "6a77898bc150aa24dd41ebdf5eff76d9323bce4cb7e3ae1c27a23be4828d3440"
  },
  {
    "settings": {
      "collapse": 100
    },
    "seq": 3,
    "hash": "a9578834a1e5a1e8c2af7ca2e55006839ec580bb65ca819de41037402a181088"
  },
  {
    "settings": {
      "collapse": 100,
      "overlap": 100
    },
    "seq": 3,
    "hash": "9e6ab66f398bb426edc6be2f49319884a221041a2ca3ccd0c9dee7f856ae09d5"
  }
];
const overlapPresets = () => {
  const source = readFileSync(new URL('../app/AnimXL.jsx', import.meta.url), 'utf8');
  return Function('return ' + source.match(/const PRESETS = (\[[\s\S]*?\n\]);/)[1])();
};
const overlapFixture = () => openDocument(readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url)), 'Tzeentch_Knight_Max_Reduced.mdx').model;
const overlapDigest = result => createHash('sha256').update(JSON.stringify(result)).digest('hex');

test('the Overlap scale preserves endpoints and spreads the middle without crossing the reaction floor', () => {
  assert.equal(typeof animXL.overlapSpring, 'function');
  const f = animXL.overlapSpring;
  assert.equal(f(0), 0);
  assert.equal(f(100), 1);
  assert.equal(f(25), 0.25, 'the implicit reaction minimum is unchanged');
  for (const value of [1, 10, 20, 25]) assert.equal(f(value), value / 100);
  assert.equal(f(50), Math.sqrt(3 / 8));
  assert.equal(f(-10), 0);
  assert.equal(f(110), 1);
  for (let value = 1; value <= 100; value++) assert.ok(f(value) > f(value - 1));
  assert.ok(Math.abs(f(25 - 1e-6) - f(25 + 1e-6)) < 1e-7, 'continuous at the join');
  const model = overlapFixture();
  assert.equal(buildAnimXL(model, 3, { overlap: 0 }).tracks.length, 0, 'zero remains off');
});

test('every rescaled Overlap preset retains its exact internal value and baseline tracks', () => {
  assert.equal(typeof animXL.overlapSpring, 'function');
  const old = { Default: 0.5, Heavy: 0.6, Agile: 0.35, Relaxed: 0.8, Fall: 0.4 };
  const model = overlapFixture(), presets = overlapPresets();
  assert.equal(presets.length, Object.keys(old).length);
  for (const [name,,values] of presets) {
    assert.equal(animXL.overlapSpring(values.overlap), old[name], name);
    const effective = values.steps > 0 ? Math.max(values.overlap, 25) : values.overlap;
    assert.equal(animXL.overlapSpring(effective), old[name], name + ' with reaction floor');
    for (const c of overlapBaseline.filter(c => c.name === name)) {
      assert.equal(overlapDigest(buildAnimXL(model, c.seq, { ...suggestAnimXLBones(model), ...values })), c.hash, name + ' ' + c.sequence);
    }
  }
});

test('Overlap 100 and Collapse Full retain the exact baseline output', () => {
  const model = overlapFixture();
  for (const c of overlapBaseline.filter(c => c.settings)) {
    assert.equal(overlapDigest(buildAnimXL(model, c.seq, { ...suggestAnimXLBones(model), ...c.settings })), c.hash, JSON.stringify(c.settings));
  }
});

// Steps and flinches impose an internal minimum of 25 even with Overlap off.
test('Overlap preserves reaction-only output at the existing minimum', () => {
  const model = overlapFixture();
  const cases = [
  {
    "settings": {
      "steps": 70,
      "overlap": 0
    },
    "hash": "223785d8c5105617374bb6b380bdf5947005277586df502c1fc874d80eacd931"
  },
  {
    "settings": {
      "steps": 70,
      "overlap": 25
    },
    "hash": "223785d8c5105617374bb6b380bdf5947005277586df502c1fc874d80eacd931"
  },
  {
    "settings": {
      "flinches": [
        22117
      ],
      "overlap": 0
    },
    "hash": "459a8d144187340ef481aa0d97285c1c8b002dfa503fa05a9469effee9ae6562"
  }
];
  for (const c of cases) assert.equal(overlapDigest(buildAnimXL(model, 3, { ...suggestAnimXLBones(model), ...c.settings })), c.hash, JSON.stringify(c.settings));
});
