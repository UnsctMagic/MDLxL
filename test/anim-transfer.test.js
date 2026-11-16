// Transfer (XFER) engine acceptance on real models: docs/agent-tasks/transfer-xl.md
// "Engine acceptance". The models live in the private test-model collection, so
// each test skips with the reason when its model is not on this machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Quaternion, Vector3 } from 'three';
import { parseCompatibleMdx, generateCompatibleMdx } from '../src/mdx-compatibility.js';
import { allNodes, composeNodeMatrices, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack, skinGeoset, visitTracks } from '../src/animation.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { applyTransfer, buildTransfer, defaultTransferPart, transferNodeTracks, transferPreviewModel, transferRestoreTracks, transferRig } from '../src/anim-transfer.js';
import * as XFER from '../src/anim-transfer.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = (...keys) => { const absent = keys.filter(key => { const file = fixturePath(key); return !file || !fs.existsSync(file); }); return absent.length ? `private test model not on this machine: ${absent.join(', ')}` : false; };
const loaded = new Map();
const load = key => {
  if (!loaded.has(key)) { const b = fs.readFileSync(fixturePath(key)); loaded.set(key, parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); }
  return loaded.get(key);
};
const fresh = key => { const b = fs.readFileSync(fixturePath(key)); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const seq = (model, name) => { const index = model.Sequences.findIndex(s => s.Name === name); assert.ok(index >= 0, `no animation ${name}`); return index; };
const wholeBody = (recipient, source, sequence, extra = {}) => {
  const rig = transferRig(recipient), parts = {};
  for (const key of Object.keys(rig.parts)) parts[key] = { ...defaultTransferPart(rig, key, true), source, sequence, ...extra };
  return parts;
};
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.clone().normalize().dot(b.clone().normalize())))) * 180 / Math.PI;
const rotOf = matrix => { const q = new Quaternion(); matrix.decompose(new Vector3(), q, new Vector3()); return q.normalize(); };
const pivotAt = (model, matrices, id) => new Vector3().fromArray(nodePivot(model, allNodes(model).find(n => n.ObjectId === id), id)).applyMatrix4(matrices.get(id));

/** World matrices of the built motion at sample k: the body animation's locals
 * with the built values on the driven joints. */
function builtMatrices(model, built, baseIndex, k) {
  const interval = model.Sequences[baseIndex].Interval, clock = built.baseClock, t = built.times[k];
  let frame;
  if (clock.looping) { const x = t * clock.rate; let p = x - clock.length * Math.floor(x / clock.length + 1e-9); frame = interval[0] + Math.max(0, p); }
  else frame = interval[0] + Math.min(clock.length, t * clock.rate);
  frame = Math.round(frame);
  const options = { interval, globalSequences: model.GlobalSequences, globalTime: frame };
  return composeNodeMatrices(model, allNodes(model).map(n => n.ObjectId), node => {
    const dense = built.tracks.get(node.ObjectId);
    const t3 = dense?.Translation ? new Vector3().fromArray(dense.Translation, k * 3) : new Vector3().fromArray(sampleTrack(node.Translation, frame, { ...options, fallback: [0, 0, 0] }));
    const r = dense?.Rotation ? new Quaternion().fromArray(dense.Rotation, k * 4) : new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { ...options, fallback: [0, 0, 0, 1], quaternion: true }));
    return { t: t3, r, s: new Vector3().fromArray(sampleTrack(node.Scaling, frame, { ...options, fallback: [1, 1, 1] })) };
  });
}

const storyA = () => {
  const loc = load('transfer-lord-of-change'), foot = load('transfer-footman');
  const recipe = { base: { sequence: seq(loc, 'Stand') }, length: null, sources: { foot: { mirror: null } }, parts: wholeBody(loc, 'foot', seq(foot, 'Stand Defend')) };
  return { loc, foot, recipe, sources: new Map([['foot', foot]]) };
};
const storyB = () => {
  const foot = load('transfer-footman'), grunt = load('transfer-grunt');
  const recipe = { base: { sequence: seq(foot, 'Stand Defend') }, length: null, sources: { grunt: { mirror: null } }, parts: { armL: { ...defaultTransferPart(transferRig(foot), 'armL', false), source: 'grunt', sequence: seq(grunt, 'Attack - 1') } } };
  return { foot, grunt, recipe, sources: new Map([['grunt', grunt]]) };
};
const identity = () => {
  const foot = load('transfer-footman'), attack = seq(foot, 'Attack - 1');
  return { foot, attack, recipe: { base: { sequence: attack }, length: null, sources: {}, parts: wholeBody(foot, 'self', attack) } };
};

test('rigs: parts, geometric sides and the weapon arm on the three models', { skip: missing('transfer-footman', 'transfer-grunt', 'transfer-lord-of-change') }, () => {
  const names = model => { const byId = new Map(allNodes(model).map(n => [n.ObjectId, n.Name])); return part => part.joints.map(id => byId.get(id)); };
  const foot = transferRig(load('transfer-footman')), loc = transferRig(load('transfer-lord-of-change')), grunt = transferRig(load('transfer-grunt'));
  const f = names(load('transfer-footman')), l = names(load('transfer-lord-of-change'));
  assert.deepEqual(f(foot.parts.armL), ['Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_R']);
  assert.deepEqual(f(foot.parts.armR), ['Bone_Arm1_R', 'Bone_Arm2_R']);
  assert.equal(foot.weaponSide, 'L'); assert.equal(grunt.weaponSide, 'L'); assert.equal(loc.weaponSide, 'R');
  assert.deepEqual(l(loc.parts.legL), ['B_Leg_1_L', 'B_Leg_2_L', 'B_Leg_3_L', 'B_Foot_L']);
  assert.deepEqual(l(loc.parts.chest), ['B_Chest_1', 'B_Chest_4']);
  assert.deepEqual(l(loc.parts.head), ['B_Neck', 'B_Head']);
  assert.deepEqual(l(loc.parts.wingR), ['B_W_1', 'B_W_2', 'B_W_3']);
  assert.ok(!Object.values(loc.parts).some(part => l(part).some(name => /B_Sh_/.test(name))), 'the shared shoulder helper belongs to no part');
});

test('E1 identity: every part from its own Attack - 1 keeps every driven joint within 0.5 units', { skip: missing('transfer-footman') }, () => {
  const { foot, attack, recipe } = identity();
  const built = buildTransfer(foot, new Map(), recipe);
  const start = foot.Sequences[attack].Interval[0];
  let worst = 0;
  built.times.forEach((t, k) => {
    const ours = builtMatrices(foot, built, attack, k), theirs = sampleNodeMatrices(foot, start + t, attack);
    for (const id of built.driven) worst = Math.max(worst, pivotAt(foot, ours, id).distanceTo(pivotAt(foot, theirs, id)));
  });
  assert.ok(worst <= 0.5, `worst joint distance ${worst.toFixed(3)}`);
});

test('E2 story A: Lord of Change takes everything from Footman Stand Defend', { skip: missing('transfer-footman', 'transfer-lord-of-change') }, ctx => {
  const { loc, foot, recipe, sources } = storyA();
  const built = buildTransfer(loc, sources, recipe), stand = seq(loc, 'Stand'), rig = transferRig(loc), donorRig = transferRig(foot);
  for (const dense of built.tracks.values()) for (const values of Object.values(dense)) assert.ok(values.every(Number.isFinite), 'no NaN');
  // Wings and every undriven node keep the Lord of Change's own Stand.
  for (const id of [...rig.parts.wingL.joints, ...rig.parts.wingR.joints]) assert.ok(!built.driven.includes(id), 'wing joints are not driven');
  const { model, sequenceIndex } = transferPreviewModel(loc, built, recipe);
  const ours = model.Sequences[sequenceIndex].Interval, theirs = loc.Sequences[stand].Interval;
  const undriven = allNodes(loc).filter(n => !built.driven.includes(n.ObjectId));
  const copy = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  let worst = 0;
  const standLength = theirs[1] - theirs[0];
  for (const t of built.times) for (const node of undriven) for (const property of ['Rotation', 'Translation', 'Scaling']) {
    if (!node[property]?.Keys || isGlobalTrack(node[property], loc)) continue;
    const rotation = property === 'Rotation', fallback = rotation ? [0, 0, 0, 1] : property === 'Scaling' ? [1, 1, 1] : [0, 0, 0];
    const looped = t > 0 && t % standLength === 0 ? standLength : t % standLength; // the end of a loop is the Stand's last frame
    const a = sampleTrack(copy.get(node.ObjectId)[property], ours[0] + t, { interval: ours, fallback, quaternion: rotation });
    const b = sampleTrack(node[property], theirs[0] + looped, { interval: theirs, fallback, quaternion: rotation });
    worst = Math.max(worst, rotation ? angle(new Quaternion().fromArray(a), new Quaternion().fromArray(b)) : Math.hypot(...a.map((v, i) => v - b[i])));
  }
  assert.ok(worst < 1e-3, `undriven node difference ${worst}`);
  // Feet stay down: each foot follows its (mirrored: the weapon hands are on
  // opposite sides) donor foot's path scaled to this leg length. The Footman's
  // Stand Defend feet shuffle up to 0.85 units, so the planted foot moves at most
  // that times the scale, plus 0.5.
  const defend = seq(foot, 'Stand Defend'), dStart = foot.Sequences[defend].Interval[0], dLength = foot.Sequences[defend].Interval[1] - dStart;
  const donorAt = t => sampleNodeMatrices(foot, dStart + (t % dLength), defend);
  const travel = (points) => Math.max(...points.map(p => p.distanceTo(points[0])));
  const scale = rig.hipHeight / donorRig.hipHeight;
  for (const [key, donorKey] of [['legL', 'legR'], ['legR', 'legL']]) {
    const donorFoot = travel(built.times.map(t => pivotAt(foot, donorAt(t), donorRig.parts[donorKey].marker)));
    const ownFoot = travel(built.times.map((_, k) => pivotAt(loc, builtMatrices(loc, built, stand, k), rig.parts[key].marker)));
    ctx.diagnostic(`${key}: ${ownFoot.toFixed(3)} (donor ${donorKey} ${donorFoot.toFixed(3)}, scale ${scale.toFixed(2)})`);
    assert.ok(donorFoot <= 1, `donor ${donorKey} foot moves ${donorFoot.toFixed(3)}`);
    assert.ok(ownFoot <= donorFoot * scale + 0.5, `${key} foot moves ${ownFoot.toFixed(3)} while the donor foot moves ${donorFoot.toFixed(3)} (scale ${scale.toFixed(2)})`);
  }
  // The body drops when the donor's does.
  const centre = (model, rigOf, matrices) => pivotAt(model, matrices, rigOf.parts.legL.joints[0]).add(pivotAt(model, matrices, rigOf.parts.legR.joints[0])).multiplyScalar(0.5);
  const donorRef = centre(foot, donorRig, sampleNodeMatrices(foot, donorRig.reference.frame, donorRig.reference.sequence));
  const ownRef = centre(loc, rig, sampleNodeMatrices(loc, rig.reference.frame, rig.reference.sequence));
  built.times.forEach((t, k) => {
    const donorDrop = centre(foot, donorRig, donorAt(t)).z - donorRef.z, ownDrop = centre(loc, rig, builtMatrices(loc, built, stand, k)).z - ownRef.z;
    if (donorDrop < -0.5) assert.ok(ownDrop < 0, `at ${t} ms the donor drops ${donorDrop.toFixed(2)} but the body moves ${ownDrop.toFixed(2)}`);
  });
});

test('E3 story B: Footman keeps Stand Defend and swings the Grunt weapon arm', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const { foot, grunt, recipe, sources } = storyB();
  recipe.parts.armL.match = 1; // the contract checks the arm direction at Pose "Theirs"
  const built = buildTransfer(foot, sources, recipe), rig = transferRig(foot), gruntRig = transferRig(grunt);
  assert.deepEqual([...built.driven].sort(), [...rig.parts.armL.joints].sort(), 'only the weapon arm is driven');
  const defend = seq(foot, 'Stand Defend'), [ds, de] = foot.Sequences[defend].Interval;
  const { model, sequenceIndex } = transferPreviewModel(foot, built, recipe);
  const start = model.Sequences[sequenceIndex].Interval[0], tree = nodeIndex(foot);
  const others = allNodes(foot).filter(n => !built.driven.some(id => tree.isAncestor(n.ObjectId, id)));
  let worst = 0;
  for (const t of built.times) {
    const ours = sampleNodeMatrices(model, start + t, sequenceIndex), theirs = sampleNodeMatrices(foot, ds + (t % (de - ds)), defend);
    for (const node of others) worst = Math.max(worst, ...ours.get(node.ObjectId).elements.map((v, i) => Math.abs(v - theirs.get(node.ObjectId).elements[i])));
  }
  assert.ok(worst < 1e-3, `other nodes differ from Stand Defend by ${worst}`);
  // The upper arm relative to the chest follows the Grunt's weapon arm (match 1).
  const attack = seq(grunt, 'Attack - 1'), as = grunt.Sequences[attack].Interval[0];
  const upper = (model, rigOf, matrices) => {
    const [a, b] = rigOf.parts.armL.joints, chest = rotOf(matrices.get(rigOf.parts.chest.marker));
    return pivotAt(model, matrices, b).sub(pivotAt(model, matrices, a)).normalize().applyQuaternion(chest.invert());
  };
  let worstAngle = 0;
  built.times.forEach((t, k) => {
    if (t < 150 || t > built.length - 150) return; // blend ramps
    const ours = upper(foot, rig, builtMatrices(foot, built, defend, k)), theirs = upper(grunt, gruntRig, sampleNodeMatrices(grunt, as + t, attack));
    worstAngle = Math.max(worstAngle, ours.angleTo(theirs) * 180 / Math.PI);
  });
  assert.ok(worstAngle <= 10, `upper arm differs from the Grunt's by ${worstAngle.toFixed(2)} degrees`);
});

test('length and loops: story A loops seamlessly over 2000 ms; story B is as long as the Grunt attack', { skip: missing('transfer-footman', 'transfer-grunt', 'transfer-lord-of-change') }, () => {
  const a = storyA(), builtA = buildTransfer(a.loc, a.sources, a.recipe);
  assert.equal(builtA.length, 2000); assert.equal(builtA.nonLooping, false);
  const { model, sequenceIndex } = transferPreviewModel(a.loc, builtA, a.recipe), [s, e] = model.Sequences[sequenceIndex].Interval;
  const first = sampleNodeMatrices(model, s, sequenceIndex), last = sampleNodeMatrices(model, e, sequenceIndex);
  let worst = 0, worstName = '';
  for (const node of allNodes(model)) {
    if (!node.Rotation?.Keys || isGlobalTrack(node.Rotation, model)) continue;
    const options = { interval: [s, e], fallback: [0, 0, 0, 1], quaternion: true };
    const d = angle(new Quaternion().fromArray(sampleTrack(node.Rotation, s, options)), new Quaternion().fromArray(sampleTrack(node.Rotation, e, options)));
    if (d > worst) { worst = d; worstName = node.Name; }
  }
  assert.ok(worst <= 0.5, `${worstName} differs by ${worst.toFixed(3)} degrees between first and last frame`);
  assert.ok(first.size === last.size);
  const b = storyB(), builtB = buildTransfer(b.foot, b.sources, b.recipe), attack = b.grunt.Sequences[seq(b.grunt, 'Attack - 1')].Interval;
  assert.equal(builtB.nonLooping, true);
  assert.equal(builtB.length, attack[1] - attack[0]);
});

test('E4 untouched model: earlier animations, geometry, rig and global tracks stay identical; MDX round trip keeps the motion', { skip: missing('transfer-footman', 'transfer-lord-of-change') }, () => {
  const { foot, recipe, sources } = storyA(), model = fresh('transfer-lord-of-change'), original = fresh('transfer-lord-of-change');
  const built = buildTransfer(model, sources, recipe);
  const { sequenceIndex } = applyTransfer(model, built, recipe, {});
  assert.equal(sequenceIndex, original.Sequences.length);
  original.Sequences.forEach((sequence, index) => {
    const [s, e] = sequence.Interval;
    for (let i = 0; i < 10; i++) {
      const frame = Math.round(s + (e - s) * i / 9), a = sampleNodeMatrices(model, frame, index), b = sampleNodeMatrices(original, frame, index);
      for (const [id, matrix] of b) assert.deepEqual(Array.from(a.get(id).elements), Array.from(matrix.elements), `${sequence.Name} frame ${frame} node ${id}`);
    }
  });
  model.Geosets.forEach((geoset, i) => { for (const key of ['Vertices', 'Normals', 'Faces', 'VertexGroup', 'Groups', 'TVertices', 'SkinWeights']) assert.deepEqual(geoset[key], original.Geosets[i][key], `geoset ${i} ${key}`); });
  assert.deepEqual(model.PivotPoints, original.PivotPoints);
  const nodes = allNodes(model), before = allNodes(original);
  assert.equal(nodes.length, before.length);
  nodes.forEach((node, i) => {
    assert.equal(node.Parent, before[i].Parent);
    for (const property of ['Translation', 'Rotation', 'Scaling']) assert.equal(node[property]?.LineType, before[i][property]?.LineType, `${node.Name} ${property} line type`);
  });
  const globals = m => { const list = []; visitTracks(m, track => { if (isGlobalTrack(track, m)) list.push(track); }, { skip: ['Keys', 'EventTrack', 'Interval', 'Anims'] }); return list; };
  assert.deepEqual(globals(model), globals(original));
  assert.ok(globals(model).length > 0, 'the Lord of Change has global-sequence tracks to protect');
  // Save and reopen; the new animation re-samples within 1 degree / 0.5 units.
  const bytes = generateCompatibleMdx(model), reopened = parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const interval = reopened.Sequences[sequenceIndex].Interval, byId = new Map(allNodes(reopened).map(n => [n.ObjectId, n]));
  let rotation = 0, translation = 0;
  built.times.forEach((t, k) => {
    for (const [id, dense] of built.tracks) {
      const node = byId.get(id), options = { interval, globalSequences: reopened.GlobalSequences };
      if (dense.Rotation) rotation = Math.max(rotation, angle(new Quaternion().fromArray(sampleTrack(node.Rotation, interval[0] + t, { ...options, fallback: [0, 0, 0, 1], quaternion: true })), new Quaternion().fromArray(dense.Rotation, k * 4)));
      if (dense.Translation) translation = Math.max(translation, new Vector3().fromArray(sampleTrack(node.Translation, interval[0] + t, { ...options, fallback: [0, 0, 0] })).distanceTo(new Vector3().fromArray(dense.Translation, k * 3)));
    }
  });
  assert.ok(rotation <= 1, `rotation off by ${rotation.toFixed(3)} degrees`);
  assert.ok(translation <= 0.5, `translation off by ${translation.toFixed(3)}`);
  assert.equal(foot.Sequences.length, load('transfer-footman').Sequences.length, 'the donor is not changed');
});

test('E5 preview equals commit: the same keys', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const { recipe, sources } = storyB(), model = fresh('transfer-footman');
  const built = buildTransfer(model, sources, recipe);
  const preview = transferPreviewModel(model, built, recipe);
  const { sequenceIndex } = applyTransfer(model, built, recipe, {});
  assert.equal(preview.sequenceIndex, sequenceIndex);
  const interval = model.Sequences[sequenceIndex].Interval, keys = (m, id, p) => allNodes(m).find(n => n.ObjectId === id)[p]?.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
  for (const node of allNodes(model)) for (const property of ['Translation', 'Rotation', 'Scaling']) assert.deepEqual(keys(preview.model, node.ObjectId, property), keys(model, node.ObjectId, property), `${node.Name} ${property}`);
  const tracks = transferNodeTracks(preview.model, sequenceIndex, built);
  assert.deepEqual(tracks.map(t => t.id).sort(), [...built.driven].sort());
});

test('E6 no accumulation: a slider moved and moved back gives the identical result', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const { foot, recipe, sources } = storyB();
  const first = buildTransfer(foot, sources, recipe);
  const moved = structuredClone(recipe); moved.parts.armL.amount = 0.4; moved.parts.armL.offset = [20, -10, 5];
  const changed = buildTransfer(foot, sources, moved);
  assert.notDeepEqual(changed.tracks, first.tracks);
  assert.deepEqual(buildTransfer(foot, sources, recipe).tracks, first.tracks);
});

const keyBudget = (sources, recipe) => {
  const model = fresh('transfer-footman'), built = buildTransfer(model, sources, recipe);
  const { sequenceIndex } = applyTransfer(model, built, recipe, { extents: false }), interval = model.Sequences[sequenceIndex].Interval;
  let stored = 0, dense = 0;
  for (const [id, tracks] of built.tracks) for (const property of Object.keys(tracks)) {
    dense += built.times.length;
    stored += allNodes(model).find(n => n.ObjectId === id)[property].Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]).length;
  }
  return { stored, dense };
};
test('E7 key budget: a transferred whole-body attack stores at most 60% of its dense samples', { skip: missing('transfer-footman') }, t => {
  const { stored, dense } = keyBudget(new Map(), identity().recipe);
  t.diagnostic(`Footman Attack - 1, every part: ${stored} keys of ${dense} samples`);
  assert.ok(stored <= dense * 0.6, `${stored} stored keys of ${dense} dense samples`);
});
// The Grunt's weapon arm alone is the fastest motion in the stories; its count is
// reported (not asserted) until the director settles its budget.
test('E7 key count of story B (reported)', { skip: missing('transfer-footman', 'transfer-grunt') }, t => {
  const { recipe, sources } = storyB(), { stored, dense } = keyBudget(sources, recipe);
  t.diagnostic(`story B weapon arm: ${stored} keys of ${dense} samples (${Math.round(stored / dense * 100)}%)`);
  assert.ok(stored < dense, 'the reduction removes keys');
});

test('E8 mirror: Footman to Footman with Mirror gives the mirror image', { skip: missing('transfer-footman') }, () => {
  const foot = load('transfer-footman'), attack = seq(foot, 'Attack - 1'), rig = transferRig(foot);
  // Pose "Theirs" on every part: the arms then point where the mirrored donor's do.
  const recipe = { base: { sequence: attack }, length: null, sources: { self: { mirror: true } }, parts: wholeBody(foot, 'self', attack, { match: 1 }) };
  const built = buildTransfer(foot, new Map(), recipe), start = foot.Sequences[attack].Interval[0];
  // The SD Footman stands staggered (left foot back, right foot forward) and keeps
  // its own stance (Match pose 0), so the movement is mirrored, not the stance:
  // hip centre and planted feet travel as the mirror image of the partner's travel,
  // and each arm's upper bone (Match pose 1) points as the mirror of its partner's.
  const ref = sampleNodeMatrices(foot, rig.reference.frame, rig.reference.sequence), flip = v => new Vector3(v.x, -v.y, v.z);
  const centre = m => pivotAt(foot, m, rig.parts.legL.joints[0]).add(pivotAt(foot, m, rig.parts.legR.joints[0])).multiplyScalar(0.5);
  const travel = (m, id) => pivotAt(foot, m, id).sub(pivotAt(foot, ref, id));
  // The upper bone as the joint's rotation carries it: the transfer writes
  // rotations, while the elbow's own Translation keys (Bone_Arm2_L moves 1.7
  // units in Attack - 1) stay on the body animation, unmirrored.
  const upper = (m, part) => {
    const [a, b] = part.joints, bone = pivotAt(foot, ref, b).sub(pivotAt(foot, ref, a));
    return bone.applyQuaternion(rotOf(ref.get(a)).invert()).applyQuaternion(rotOf(m.get(a))).normalize();
  };
  let distance = 0, turn = 0, moved = 0;
  built.times.forEach((t, k) => {
    const ours = builtMatrices(foot, built, attack, k), theirs = sampleNodeMatrices(foot, start + t, attack);
    distance = Math.max(distance, centre(ours).sub(centre(ref)).distanceTo(flip(centre(theirs).sub(centre(ref)))));
    for (const [key, other] of [['legL', 'legR'], ['legR', 'legL']]) {
      distance = Math.max(distance, travel(ours, rig.parts[key].marker).distanceTo(flip(travel(theirs, rig.parts[other].marker))));
      moved = Math.max(moved, travel(theirs, rig.parts[other].marker).length());
    }
    for (const [key, other] of [['armL', 'armR'], ['armR', 'armL']]) turn = Math.max(turn, upper(ours, rig.parts[key]).angleTo(flip(upper(theirs, rig.parts[other]))) * 180 / Math.PI);
  });
  assert.ok(moved > 1, 'the attack moves the feet, so the check has something to mirror');
  assert.ok(distance <= 0.5, `hip centre or foot travel off its mirror by ${distance.toFixed(3)}`);
  assert.ok(turn <= 2, `upper arm off its mirror by ${turn.toFixed(2)} degrees`);
});

// The window's preview gives a part back without rebuilding its model: the
// given-back joints must get exactly what applyTransfer gives an undriven node.
test('transferRestoreTracks: a given-back part gets the same tracks as a transfer that never took it', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const { foot, recipe, sources } = storyB(), before = JSON.stringify(foot.Bones.map(b => b.Rotation));
  const built = buildTransfer(foot, sources, recipe), preview = transferPreviewModel(foot, built, recipe);
  const untaken = transferPreviewModel(foot, { ...built, driven: [], tracks: new Map() }, recipe);
  const start = preview.model.Sequences[preview.sequenceIndex].Interval[0];
  const restored = transferRestoreTracks(foot, start, built, built.driven);
  assert.deepEqual(restored.map(item => item.id).sort(), [...built.driven, ...built.driven].sort());
  const node = (m, id) => allNodes(m).find(n => n.ObjectId === id);
  for (const { id, property, track } of restored) assert.deepEqual(track, node(untaken.model, id)[property], `${node(foot, id).Name} ${property}`);
  assert.equal(JSON.stringify(foot.Bones.map(b => b.Rotation)), before, 'the recipient is not changed');
});

// ---------------------------------------------------------------- round 2 (R1-R5)
const seqMatch = (model, pattern) => { const index = model.Sequences.findIndex(s => pattern.test(s.Name)); assert.ok(index >= 0, `no animation ${pattern}`); return index; };
// transferWholeBody is read from the module object so these tests fail (not the
// whole file) on code without it.
const wholeBodyParts = (recipientRig, donorRig) => { assert.equal(typeof XFER.transferWholeBody, 'function', 'transferWholeBody is exported'); return XFER.transferWholeBody(recipientRig, donorRig); };
const take = (rig, keys, source, sequence, extra = {}) => Object.fromEntries(keys.map(key => [key, { ...defaultTransferPart(rig, key, true), source, sequence, ...extra }]));

test('R1 every part starts in the open model\'s own stance (Pose 0)', { skip: missing('transfer-footman') }, () => {
  const rig = transferRig(load('transfer-footman'));
  for (const key of Object.keys(rig.parts)) assert.equal(defaultTransferPart(rig, key, true).match, 0, key);
  assert.equal(defaultTransferPart(rig, 'armL', false).match, 0);
});

test('R2 Demon Hunter Attack moves the Abomination\'s arms through the skeleton the attack moves', { skip: missing('transfer-demon-hunter', 'transfer-abomination') }, () => {
  const hunter = load('transfer-demon-hunter'), abom = load('transfer-abomination'), attack = seqMatch(hunter, /^attack/i), stand = seqMatch(abom, /^stand/i);
  const donorRig = transferRig(hunter, { sequence: attack }), names = new Map(allNodes(hunter).map(n => [n.ObjectId, n.Name]));
  assert.doesNotMatch(names.get(donorRig.body), /alternate/i, `the attack moves the plain skeleton, not ${names.get(donorRig.body)}`);
  const rig = transferRig(abom, { sequence: stand }), { parts } = wholeBodyParts(rig, donorRig);
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'hunter', attack) };
  const built = buildTransfer(abom, new Map([['hunter', hunter]]), recipe);
  for (const key of ['armL', 'armR']) {
    const [a, b] = rig.parts[key].joints, upper = k => { const m = builtMatrices(abom, built, stand, k); return pivotAt(abom, m, b).sub(pivotAt(abom, m, a)); };
    const first = upper(0), turn = Math.max(...built.times.map((_, k) => upper(k).angleTo(first) * 180 / Math.PI));
    assert.ok(turn > 30, `${key} upper arm turns only ${turn.toFixed(1)} degrees`);
  }
});

test('R3 Dryad: chest, head and arms from the Sorceress leave every hoof on the body animation', { skip: missing('transfer-dryad', 'transfer-sorceress') }, () => {
  const dryad = load('transfer-dryad'), sorc = load('transfer-sorceress'), stand = seqMatch(dryad, /^stand/i), spell = seqMatch(sorc, /^spell/i);
  const rig = transferRig(dryad, { sequence: stand });
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, ['chest', 'head', 'armL', 'armR'], 'sorc', spell) };
  const built = buildTransfer(dryad, new Map([['sorc', sorc]]), recipe);
  const { model, sequenceIndex } = transferPreviewModel(dryad, built, recipe);
  const [s] = model.Sequences[sequenceIndex].Interval, [ds, de] = dryad.Sequences[stand].Interval;
  const hooves = Object.values(rig.parts).filter(part => /^leg/.test(part.key));
  assert.equal(hooves.length, 4);
  let worst = 0;
  for (const t of built.times) {
    const ours = sampleNodeMatrices(model, s + t, sequenceIndex), theirs = sampleNodeMatrices(dryad, ds + (t % (de - ds)), stand);
    for (const part of hooves) worst = Math.max(worst, pivotAt(dryad, ours, part.marker).distanceTo(pivotAt(dryad, theirs, part.marker)));
  }
  assert.ok(worst <= 0.5, `a hoof moves ${worst.toFixed(2)} units off the body animation`);
});

test('R3 Knight: whole body from the Grunt leaves out hips and legs and says why', { skip: missing('transfer-knight', 'transfer-grunt', 'transfer-footman') }, () => {
  const knight = load('transfer-knight'), grunt = load('transfer-grunt');
  const result = wholeBodyParts(transferRig(knight, { sequence: seqMatch(knight, /^stand/i) }), transferRig(grunt, { sequence: seqMatch(grunt, /^Attack - 1/) }));
  assert.ok(!result.parts.some(key => key === 'hips' || /^leg/.test(key)), `parts: ${result.parts.join(', ')}`);
  assert.ok(['chest', 'armL', 'armR'].every(key => result.parts.includes(key)), `parts: ${result.parts.join(', ')}`);
  assert.equal(typeof result.reason, 'string');
  const same = wholeBodyParts(transferRig(load('transfer-footman')), transferRig(grunt));
  assert.ok(same.parts.includes('hips') && same.reason === null, 'two bipeds keep hips and legs');
});

test('R4 Ghoul: walking on the Footman\'s legs keeps every sole on or above its ground', { skip: missing('transfer-ghoul', 'transfer-footman') }, () => {
  const ghoul = load('transfer-ghoul'), foot = load('transfer-footman'), stand = seqMatch(ghoul, /^stand/i), walk = seqMatch(foot, /^walk$/i);
  const rig = transferRig(ghoul, { sequence: stand }), { parts } = wholeBodyParts(rig, transferRig(foot, { sequence: walk }));
  assert.ok(parts.includes('legL') && parts.includes('hips'));
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'foot', walk) };
  const built = buildTransfer(ghoul, new Map([['foot', foot]]), recipe), { model, sequenceIndex } = transferPreviewModel(ghoul, built, recipe);
  const tree = nodeIndex(ghoul), ref = sampleNodeMatrices(ghoul, rig.reference.frame, rig.reference.sequence), s = model.Sequences[sequenceIndex].Interval[0];
  for (const key of ['legL', 'legR']) {
    // The foot's own vertices: skinned only to the foot joint and the meshes it carries.
    const footJoint = rig.parts[key].marker, owned = id => tree.isAncestor(id, footJoint), picks = [];
    model.Geosets.forEach((geoset, g) => { for (let v = 0; v < geoset.Vertices.length / 3; v++) { const bones = Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []); if (bones.length && bones.every(owned)) picks.push([g, v]); } });
    assert.ok(picks.length > 3, `${key} has foot vertices`);
    const lowest = matrices => { const skinned = new Map(); return Math.min(...picks.map(([g, v]) => { if (!skinned.has(g)) skinned.set(g, skinGeoset(model.Geosets[g], matrices)); return skinned.get(g)[v * 3 + 2]; })); };
    const ground = lowest(ref);
    let worst = Infinity, at = 0;
    for (const t of built.times) { const z = lowest(sampleNodeMatrices(model, s + t, sequenceIndex)); if (z < worst) { worst = z; at = t; } }
    assert.ok(worst >= ground - 0.5, `${key} sole at ${worst.toFixed(2)} (${at} ms), its ground is ${ground.toFixed(2)}`);
  }
});

test('R5 Other side: a flipped left arm does what the mirrored donor\'s right arm does', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const foot = load('transfer-footman'), grunt = load('transfer-grunt'), defend = seq(foot, 'Stand Defend'), attack = seq(grunt, 'Attack - 1'), rig = transferRig(foot);
  const sources = new Map([['grunt', grunt]]);
  const recipe = (mirror, extra) => ({ base: { sequence: defend }, length: null, sources: { grunt: { mirror } }, parts: take(rig, ['armL'], 'grunt', attack, extra) });
  const flipped = buildTransfer(foot, sources, recipe(false, { flip: true })), mirrored = buildTransfer(foot, sources, recipe(true)), plain = buildTransfer(foot, sources, recipe(false));
  assert.deepEqual(flipped.tracks, mirrored.tracks);
  assert.notDeepEqual(flipped.tracks, plain.tracks);
});

test('R6 a body animation that plays once is fitted to the taken attack: no snap at the end', { skip: missing('transfer-lord-of-change', 'transfer-footman') }, () => {
  const loc = load('transfer-lord-of-change'), foot = load('transfer-footman'), attack = seqMatch(loc, /^attack$/i), donorAttack = seq(foot, 'Attack - 1');
  const rig = transferRig(loc, { sequence: attack }), { parts } = wholeBodyParts(rig, transferRig(foot, { sequence: donorAttack }));
  const recipe = { base: { sequence: attack }, length: null, sources: {}, parts: take(rig, parts, 'foot', donorAttack) };
  const built = buildTransfer(loc, new Map([['foot', foot]]), recipe);
  assert.equal(built.length, 1000, 'as long as the taken attack, not the body animation (1302 ms)');
  assert.equal(built.nonLooping, true);
  // No snap: over the last 400 ms no driven joint turns 25 degrees between samples.
  let worst = 0, where = '';
  built.times.forEach((t, k) => {
    if (!k || t < built.length - 400) return;
    for (const [id, dense] of built.tracks) {
      if (!dense.Rotation) continue;
      const d = angle(new Quaternion().fromArray(dense.Rotation, k * 4), new Quaternion().fromArray(dense.Rotation, (k - 1) * 4));
      if (d > worst) { worst = d; where = `${allNodes(loc).find(n => n.ObjectId === id).Name} at ${t} ms`; }
    }
  });
  assert.ok(worst < 25, `${where} turns ${worst.toFixed(1)} degrees in one sample`);
  // The untaken wing finishes its own attack with the result.
  const { model, sequenceIndex } = transferPreviewModel(loc, built, recipe), wing = rig.parts.wingR.joints[0];
  assert.ok(!built.driven.includes(wing));
  const end = model.Sequences[sequenceIndex].Interval[1], own = loc.Sequences[attack].Interval;
  const node = m => allNodes(m).find(n => n.ObjectId === wing).Rotation;
  const a = sampleTrack(node(model), end, { interval: model.Sequences[sequenceIndex].Interval, fallback: [0, 0, 0, 1], quaternion: true });
  const b = sampleTrack(node(loc), own[1], { interval: own, fallback: [0, 0, 0, 1], quaternion: true });
  assert.ok(angle(new Quaternion().fromArray(a), new Quaternion().fromArray(b)) < 0.01, 'the wing ends on the body animation\'s last frame');
});

// ---------------------------------------------------------------- round 4 (N1-N5, N5b)
// New exports are read from the module object so each test fails on its own on
// code without them.
const call = (name, ...args) => { assert.equal(typeof XFER[name], 'function', `${name} is exported`); return XFER[name](...args); };
const storyBRecipe = extra => { const { foot, grunt, sources } = storyB(); return { foot, grunt, sources, recipe: { base: { sequence: seq(foot, 'Stand Defend') }, length: null, sources: {}, parts: { armL: { ...defaultTransferPart(transferRig(foot), 'armL', false), source: 'grunt', sequence: seq(grunt, 'Attack - 1'), ...extra } } } }; };
const handAt = (model, built, baseIndex, k, id) => pivotAt(model, builtMatrices(model, built, baseIndex, k), id);

test('N5 a moment fix moves the hand at its time, nowhere beyond its width, and nothing when empty', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const plain = storyBRecipe(), fixed = storyBRecipe({ fixes: [{ time: 450, raise: 30, turn: 0, roll: 0, width: 250 }] }), empty = storyBRecipe({ fixes: [] });
  const { foot, sources } = plain, defend = seq(foot, 'Stand Defend'), hand = transferRig(foot).parts.armL.marker;
  const a = buildTransfer(foot, sources, plain.recipe), b = buildTransfer(foot, sources, fixed.recipe);
  assert.deepEqual(buildTransfer(foot, sources, empty.recipe).tracks, a.tracks, 'no fixes is the plain result');
  const at = a.times.indexOf(a.times.reduce((x, y) => Math.abs(y - 450) < Math.abs(x - 450) ? y : x));
  const moved = handAt(foot, a, defend, at, hand).distanceTo(handAt(foot, b, defend, at, hand));
  assert.ok(moved > 5, `the hand moves only ${moved.toFixed(2)} at the fix`);
  a.times.forEach((t, k) => {
    if (Math.abs(t - 450) < 250) return;
    const d = handAt(foot, a, defend, k, hand).distanceTo(handAt(foot, b, defend, k, hand));
    assert.ok(d < 1e-4, `the hand moves ${d} at ${t} ms, beyond the fix's width`);
  });
});

test('N5b aim: the returned offset points the hand at the dropped point; moment scope stays local; no change for the current direction', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const { foot, sources, recipe } = storyBRecipe();
  const direction = (end, point) => new Vector3(...end.end).sub(new Vector3(...end.root)).angleTo(point.clone().sub(new Vector3(...end.root))) * 180 / Math.PI;
  for (const time of [200, 450, 700]) for (const shift of [[10, -10, 0], [-8, 12, -10], [6, 6, 8]]) {
    const now = call('transferEndPoint', foot, sources, recipe, 'armL', time), point = new Vector3(...now.end).add(new Vector3(...shift));
    const { offset, clamped } = call('transferAim', foot, sources, recipe, 'armL', time, point.toArray());
    assert.equal(clamped, false, `${time} ms ${shift}`);
    const after = call('transferEndPoint', foot, sources, { ...recipe, parts: { armL: { ...recipe.parts.armL, offset } } }, 'armL', time);
    assert.ok(direction(after, point) <= 1.5, `${time} ms ${shift}: ${direction(after, point).toFixed(2)} degrees off`);
  }
  // Moment scope: the fix aims at its time and leaves the hand alone beyond its width.
  const now = call('transferEndPoint', foot, sources, recipe, 'armL', 450), point = new Vector3(...now.end).add(new Vector3(10, -10, 0));
  const { fix, index } = call('transferAim', foot, sources, recipe, 'armL', 450, point.toArray(), { scope: 'moment' });
  assert.equal(index, -1);
  const fixed = { ...recipe, parts: { armL: { ...recipe.parts.armL, fixes: [fix] } } };
  assert.ok(direction(call('transferEndPoint', foot, sources, fixed, 'armL', 450), point) <= 1.5);
  for (const time of [450 - fix.width - 20, 450 + fix.width + 20]) {
    const a = call('transferEndPoint', foot, sources, recipe, 'armL', time).end, b = call('transferEndPoint', foot, sources, fixed, 'armL', time).end;
    assert.ok(new Vector3(...a).distanceTo(new Vector3(...b)) < 1e-4, `the hand moved at ${time} ms`);
  }
  // A point along the limb's current direction keeps the offset.
  const along = new Vector3(...now.end).sub(new Vector3(...now.root)).multiplyScalar(1.3).add(new Vector3(...now.root));
  assert.deepEqual(call('transferAim', foot, sources, recipe, 'armL', 450, along.toArray()).offset, [0, 0, 0]);
});

test('N1 weapon shape: the sword is a weapon, the shield is not; the Kurgan readies its hammer with both hands', { skip: missing('transfer-footman', 'transfer-kurgan', 'transfer-grunt', 'transfer-nurgle') }, () => {
  const foot = transferRig(load('transfer-footman'));
  const sword = foot.parts.armL.weapon;
  assert.ok(sword && sword.length > 0.6 * foot.parts.armL.length, 'the Footman\'s sword arm has a weapon');
  assert.equal(sword.butt.length, 3); assert.equal(sword.tip.length, 3);
  assert.ok(sword.outline.length >= 6 && sword.outline.length <= 12);
  assert.equal(foot.parts.armR.weapon, null, 'the shield is not a weapon');
  assert.equal(foot.weaponSide, 'L');
  assert.equal(sword.grip, null);
  const kurgan = transferRig(load('transfer-kurgan')), hammer = Object.values(kurgan.parts).find(part => part.weapon);
  assert.ok(hammer, 'the Kurgan has a weapon arm');
  assert.ok(hammer.weapon.grip && kurgan.parts[hammer.weapon.grip.arm], 'the Kurgan holds its hammer with both hands');
  for (const key of ['transfer-grunt', 'transfer-nurgle']) {
    const rig = transferRig(load(key)), weapon = Object.values(rig.parts).find(part => part.weapon);
    assert.ok(weapon && weapon.weapon.grip === null, `${key}: one-handed weapon`);
  }
});

const kurganArm = (grip) => {
  const kurgan = load('transfer-kurgan'), foot = load('transfer-footman'), stand = seqMatch(kurgan, /^stand - 1/i), attack = seq(foot, 'Attack - 1');
  const rig = transferRig(kurgan, { sequence: stand }), key = Object.keys(rig.parts).find(k => rig.parts[k].weapon);
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: { [key]: { ...defaultTransferPart(rig, key, false), source: 'foot', sequence: attack, blend: 0, grip } } };
  return { kurgan, rig, key, stand, recipe, built: buildTransfer(kurgan, new Map([['foot', foot]]), recipe) };
};
test('N2 both hands: the Kurgan taking the Footman\'s attack on its hammer arm keeps the other hand on the handle', { skip: missing('transfer-kurgan', 'transfer-footman') }, () => {
  const rigOf = () => { const { rig, key } = kurganArm(null); return rig.parts[key]; };
  const gap = grip => {
    const { kurgan, rig, key, stand, built } = kurganArm(grip), weapon = rig.parts[key], other = rig.parts[weapon.weapon.grip.arm];
    // Off the shaft (through the grip point) and along it: out of the arm's reach
    // the hand slides along the handle instead of letting go.
    const per = built.times.map((_, k) => {
      const m = builtMatrices(kurgan, built, stand, k), grip = new Vector3(...weapon.weapon.grip.point).applyMatrix4(m.get(weapon.marker));
      const shaft = new Vector3(...weapon.weapon.tip).applyMatrix4(m.get(weapon.marker)).sub(new Vector3(...weapon.weapon.butt).applyMatrix4(m.get(weapon.marker))).normalize();
      const offset = pivotAt(kurgan, m, other.marker).sub(grip), along = offset.dot(shaft);
      return { off: offset.addScaledVector(shaft, -along).length(), along: Math.abs(along), total: Math.hypot(offset.length()) };
    });
    return { off: Math.max(...per.map(p => p.off)), along: Math.max(...per.map(p => p.along)), total: Math.max(...per.map(p => p.total)) };
  };
  const held = gap(null), loose = gap(false);
  assert.ok(held.off <= 1.5, `the other hand is ${held.off.toFixed(2)} off the shaft`);
  // Measured: up to 8.4 units at 367 ms, where the Footman's arm is fully stretched; a tenth of the hammer.
  assert.ok(held.along <= 0.1 * rigOf().weapon.length, `the other hand slides ${held.along.toFixed(2)} along the shaft from its grip`);
  const loose_ = loose.total;
  assert.ok(loose_ > 10, `without the grip the hand is only ${loose_.toFixed(2)} away, so the check proves nothing`);
});

test('N3 weapon above the ground: the Kurgan\'s hammer stays above the floor through the Grunt\'s attack, eased in', { skip: missing('transfer-kurgan', 'transfer-grunt') }, () => {
  const kurgan = load('transfer-kurgan'), grunt = load('transfer-grunt'), stand = seqMatch(kurgan, /^stand - 1/i), attack = seq(grunt, 'Attack - 1');
  const rig = transferRig(kurgan, { sequence: stand }), key = Object.keys(rig.parts).find(k => rig.parts[k].weapon), weapon = rig.parts[key];
  const { parts } = wholeBodyParts(rig, transferRig(grunt, { sequence: attack }));
  // Aim 0: the hammer keeps the Kurgan's own grip, so the lift alone is measured.
  const build = clear => buildTransfer(kurgan, new Map([['grunt', grunt]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'grunt', attack, { clear, aim: 0 }) });
  const lowest = built => built.times.map((_, k) => { const m = builtMatrices(kurgan, built, stand, k); return Math.min(...weapon.weapon.outline.map(p => new Vector3(...p).applyMatrix4(m.get(weapon.marker)).z)); });
  const on = build(null), off = build(false), floor = rig.floor;
  assert.ok(Math.min(...lowest(off)) < floor - 5, `without the lift the hammer only reaches ${Math.min(...lowest(off)).toFixed(1)} (floor ${floor.toFixed(1)})`);
  // Where the need rises faster than 400 degrees a second (right after the start)
  // the lift may lag for a moment: at most two samples under, and not by much.
  const heights = lowest(on), under = heights.map((z, k) => [z, on.times[k]]).filter(([z]) => z < floor - 0.5);
  assert.ok(under.length <= 2 && Math.min(...heights) >= floor - 5, `under the floor: ${under.map(([z, t]) => `${z.toFixed(1)} at ${t} ms`).join(', ')} (floor ${floor.toFixed(2)})`);
  // The lift: how far the weapon arm's root turns away from the unlifted result.
  const lift = on.times.map((_, k) => angle(rotOf(builtMatrices(kurgan, on, stand, k).get(weapon.joints[0])), rotOf(builtMatrices(kurgan, off, stand, k).get(weapon.joints[0]))));
  // At most 400 degrees a second: 13.3 degrees per 33 ms sample (plus 0.5 for the joint read-back).
  const step = Math.max(...on.times.slice(1).map((t, k) => t - on.times[k])), jump = Math.max(...lift.slice(1).map((v, k) => Math.abs(v - lift[k])));
  assert.ok(jump <= 0.4 * step + 0.5, `the lift changes ${jump.toFixed(2)} degrees between neighbouring samples`);
  // The attack starts and ends in the stance: no lift at the first and last sample.
  for (const k of [0, on.times.length - 1]) for (const id of weapon.joints) {
    const d = angle(rotOf(builtMatrices(kurgan, on, stand, k).get(id)), rotOf(builtMatrices(kurgan, off, stand, k).get(id)));
    assert.ok(d <= 0.5, `${allNodes(kurgan).find(n => n.ObjectId === id).Name} differs by ${d.toFixed(2)} degrees at sample ${k}`);
  }
});

test('N4 aim 1 points the Lord of Change\'s staff like the Footman\'s sword, relative to the chests', { skip: missing('transfer-lord-of-change', 'transfer-footman') }, () => {
  const loc = load('transfer-lord-of-change'), foot = load('transfer-footman'), stand = seq(loc, 'Stand'), attack = seq(foot, 'Attack - 1');
  const rig = transferRig(loc, { sequence: stand }), donorRig = transferRig(foot, { sequence: attack }), own = rig.parts.armR, theirs = donorRig.parts.armL;
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: { armR: { ...defaultTransferPart(rig, 'armR', false), source: 'foot', sequence: attack, aim: 1, clear: false } } };
  const built = buildTransfer(loc, new Map([['foot', foot]]), recipe);
  const refB = sampleNodeMatrices(loc, rig.reference.frame, rig.reference.sequence), refA = sampleNodeMatrices(foot, donorRig.reference.frame, donorRig.reference.sequence), as = foot.Sequences[attack].Interval[0];
  const axisOf = (weapon, matrix) => new Vector3(...weapon.tip).sub(new Vector3(...weapon.butt)).applyQuaternion(rotOf(matrix));
  let worst = 0;
  built.times.forEach((t, k) => {
    if (t < 150 || t > built.length - 150) return; // blend ramps
    const m = builtMatrices(loc, built, stand, k), d = sampleNodeMatrices(foot, as + t, attack);
    const dB = rotOf(m.get(own.anchor)).multiply(rotOf(refB.get(own.anchor)).invert()), dA = rotOf(d.get(theirs.anchor)).multiply(rotOf(refA.get(theirs.anchor)).invert());
    const donorAxis = axisOf(theirs.weapon, d.get(theirs.marker)).applyQuaternion(dA.clone().invert());
    const want = new Vector3(donorAxis.x, -donorAxis.y, donorAxis.z).applyQuaternion(dB); // the weapon hands are on opposite sides: mirrored
    worst = Math.max(worst, axisOf(own.weapon, m.get(own.marker)).angleTo(want) * 180 / Math.PI);
  });
  assert.ok(worst <= 5, `the staff points ${worst.toFixed(2)} degrees away from the sword`);
});

test('N4 automatic aim: off for a looping stand, on (eased at the ends) for an attack that plays once', { skip: missing('transfer-lord-of-change', 'transfer-footman') }, () => {
  // Story A loops: automatic aim is exactly aim 0.
  const a = storyA(), auto = buildTransfer(a.loc, a.sources, a.recipe);
  const zero = structuredClone(a.recipe); for (const part of Object.values(zero.parts)) part.aim = 0;
  assert.deepEqual(auto.tracks, buildTransfer(a.loc, a.sources, zero).tracks);
  // The Lord of Change's staff arm from the Footman's attack.
  const loc = load('transfer-lord-of-change'), foot = load('transfer-footman'), stand = seq(loc, 'Stand'), attack = seq(foot, 'Attack - 1');
  const rig = transferRig(loc, { sequence: stand }), donorRig = transferRig(foot, { sequence: attack }), own = rig.parts.armR, theirs = donorRig.parts.armL;
  const build = aim => buildTransfer(loc, new Map([['foot', foot]]), { base: { sequence: stand }, length: null, sources: {}, parts: { armR: { ...defaultTransferPart(rig, 'armR', false), source: 'foot', sequence: attack, aim, clear: false, blend: 0 } } }); // no Ease: the aim's own easing is measured
  const automatic = build(null), plain = build(0);
  const axisOf = (weapon, matrix) => new Vector3(...weapon.tip).sub(new Vector3(...weapon.butt)).applyQuaternion(rotOf(matrix));
  const ownAxis = (built, k) => axisOf(own.weapon, builtMatrices(loc, built, stand, k).get(own.marker));
  for (const k of [0, automatic.times.length - 1]) {
    const d = ownAxis(automatic, k).angleTo(ownAxis(plain, k)) * 180 / Math.PI;
    assert.ok(d <= 2, `sample ${k}: ${d.toFixed(2)} degrees from the model's own grip`);
  }
  const refB = sampleNodeMatrices(loc, rig.reference.frame, rig.reference.sequence), refA = sampleNodeMatrices(foot, donorRig.reference.frame, donorRig.reference.sequence);
  const k = automatic.times.indexOf(automatic.times.reduce((x, y) => Math.abs(y - 500) < Math.abs(x - 500) ? y : x)), t = automatic.times[k];
  const m = builtMatrices(loc, automatic, stand, k), d = sampleNodeMatrices(foot, foot.Sequences[attack].Interval[0] + t, attack);
  const dB = rotOf(m.get(own.anchor)).multiply(rotOf(refB.get(own.anchor)).invert()), dA = rotOf(d.get(theirs.anchor)).multiply(rotOf(refA.get(theirs.anchor)).invert());
  const donorAxis = axisOf(theirs.weapon, d.get(theirs.marker)).applyQuaternion(dA.clone().invert()), want = new Vector3(donorAxis.x, -donorAxis.y, donorAxis.z).applyQuaternion(dB);
  const off = axisOf(own.weapon, m.get(own.marker)).angleTo(want) * 180 / Math.PI;
  assert.ok(off <= 5, `at ${t} ms the staff is ${off.toFixed(2)} degrees from the sword`);
});

// ---------------------------------------------------------------- round 7: range, follow, avoid, trim, chain
const sequenceLike = (model, pattern) => { const index = model.Sequences.findIndex(s => pattern.test(s.Name)); assert.ok(index >= 0, `no animation like ${pattern}`); return index; };
const nodeNamed = (model, name) => { const node = allNodes(model).find(n => n.Name === name); assert.ok(node, `no node ${name}`); return node.ObjectId; };
const sameArrays = (a, b) => { assert.deepEqual([...a.tracks.keys()].sort(), [...b.tracks.keys()].sort()); for (const [id, track] of a.tracks) for (const key of ['Rotation', 'Translation']) if (track[key]) assert.deepEqual(Array.from(track[key]), Array.from(b.tracks.get(id)[key]), `joint ${id} ${key}`); };
const rotationAt = (built, id, k) => new Quaternion().fromArray(built.tracks.get(id).Rotation, k * 4);
const sampleNear = (built, time) => built.times.reduce((best, t, k) => Math.abs(t - time) < Math.abs(built.times[best] - time) ? k : best, 0);

test('R7 the new recipe fields change nothing while they are off or absent', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const footman = load('transfer-footman'), grunt = load('transfer-grunt'), sources = new Map([['grunt', grunt]]);
  const recipe = extra => ({ base: { sequence: seq(footman, 'Stand - 1') }, sources: {}, parts: wholeBody(footman, 'grunt', seq(grunt, 'Attack - 1'), extra) });
  const plain = recipe({}); for (const part of Object.values(plain.parts)) for (const key of ['range', 'follow', 'avoid', 'clip']) delete part[key];
  const before = buildTransfer(footman, sources, plain);
  sameArrays(before, buildTransfer(footman, sources, recipe({ range: 0, follow: 0, avoid: 0, clip: null, next: [] })));
  assert.equal(before.length, buildTransfer(footman, sources, recipe({})).length);
});

test('R7 range: the Abomination taking the Demon Hunter\'s attack keeps its arms and chest in its own range', { skip: missing('transfer-abomination', 'transfer-demon-hunter') }, () => {
  const abom = load('transfer-abomination'), hunter = load('transfer-demon-hunter'), sources = new Map([['d', hunter]]);
  const recipe = extra => ({ base: { sequence: sequenceLike(abom, /^stand/i) }, sources: {}, parts: Object.fromEntries(XFER.transferWholeBody(transferRig(abom), transferRig(hunter, { sequence: sequenceLike(hunter, /^attack/i) })).parts.map(key => [key, { ...defaultTransferPart(transferRig(abom), key, true), source: 'd', sequence: sequenceLike(hunter, /^attack/i), ...extra }])) });
  const off = XFER.transferDiagnostics(abom, sources, recipe({})), on = XFER.transferDiagnostics(abom, sources, recipe({ range: 1 }));
  assert.ok(off.outside.armL > 50, `without the limit the arm leaves its own range by ${off.outside.armL.toFixed(1)} degrees`);
  // (armR is placed by the weapon's aim and grip afterwards, so the limit leaves it alone.)
  for (const key of ['armL', 'chest', 'head']) assert.ok(on.outside[key] <= 10.5, `${key} stays within the soft stop (${on.outside[key].toFixed(1)} degrees past its own range)`);
  assert.ok(on.outside.chest <= off.outside.chest + 1e-6);
});

test('R7 avoid: the Abomination\'s arms come out of its chest', { skip: missing('transfer-abomination', 'transfer-demon-hunter') }, () => {
  const abom = load('transfer-abomination'), hunter = load('transfer-demon-hunter'), sources = new Map([['d', hunter]]), rig = transferRig(abom), attack = sequenceLike(hunter, /^attack/i);
  const recipe = extra => ({ base: { sequence: sequenceLike(abom, /^stand/i) }, sources: {}, parts: Object.fromEntries(XFER.transferWholeBody(rig, transferRig(hunter, { sequence: attack })).parts.map(key => [key, { ...defaultTransferPart(rig, key, true), source: 'd', sequence: attack, ...extra }])) });
  const off = XFER.transferDiagnostics(abom, sources, recipe({})), on = XFER.transferDiagnostics(abom, sources, recipe({ avoid: 1 }));
  assert.ok(off.arms.armL.deficit > 0.1 && off.arms.armR.deficit > 0.05, `the arms start inside (${off.arms.armL.deficit.toFixed(2)}, ${off.arms.armR.deficit.toFixed(2)})`);
  for (const key of ['armL', 'armR']) assert.ok(on.arms[key].deficit <= 0.04, `${key} is out (${on.arms[key].deficit.toFixed(2)} of a body radius still inside)`);
});

test('R7 follow: the Slaanesh warrior\'s shoulder pads keep their learned share of the arm, its cape plays its own attack', { skip: missing('glow-dual-weapon', 'transfer-grunt') }, () => {
  const warrior = load('glow-dual-weapon'), grunt = load('transfer-grunt'), sources = new Map([['g', grunt]]), rig = transferRig(warrior), attack = seq(grunt, 'Attack - 1');
  const base = sequenceLike(warrior, /^stand/i), recipe = extra => ({ base: { sequence: base }, sources: {}, parts: Object.fromEntries(XFER.transferWholeBody(rig, transferRig(grunt, { sequence: attack })).parts.map(key => [key, { ...defaultTransferPart(rig, key, true), source: 'g', sequence: attack, ...extra }])) });
  const learned = XFER.transferDiagnostics(warrior, sources, recipe({}));
  for (const name of ['Pauldron_L', 'Pauldron_R']) { const item = learned.followers.find(f => f.joint === name); assert.ok(item && item.fit >= 0.95 && Math.abs(item.share - 0.5) < 0.1, `${name}: learned ${item && item.share.toFixed(2)} of ${item && item.driver} (fit ${item && item.fit.toFixed(2)})`); }
  assert.ok(learned.chains.some(c => c.joint === 'Cape 1') && learned.chains.some(c => c.joint === 'Cape 2'));
  const off = buildTransfer(warrior, sources, recipe({})), on = buildTransfer(warrior, sources, recipe({ follow: 1 }));
  for (const name of ['Pauldron_L', 'Pauldron_R', 'Cape 1', 'Cape 2']) { const id = nodeNamed(warrior, name); assert.ok(!off.tracks.has(id), `${name} is left alone without follow`); assert.ok(on.tracks.has(id), `${name} is driven with follow`); }
  // The pad's turn (against the chest) is the learned share of the arm joint's turn, at every moment.
  const ref = sampleNodeMatrices(warrior, warrior.Sequences[rig.reference.sequence].Interval[0], rig.reference.sequence);
  const turn = (matrices, id, anchor) => { const d = rotOf(matrices.get(id)).multiply(rotOf(ref.get(id)).invert()), a = rotOf(matrices.get(anchor)).multiply(rotOf(ref.get(anchor)).invert()); return a.invert().multiply(d); };
  const power = (q, w) => new Quaternion().slerpQuaternions(new Quaternion(), q.w < 0 ? new Quaternion(-q.x, -q.y, -q.z, -q.w) : q, w);
  const pad = learned.followers.find(f => f.joint === 'Pauldron_L'), padId = nodeNamed(warrior, 'Pauldron_L'), driverId = nodeNamed(warrior, pad.driver), anchor = rig.parts[pad.part].anchor;
  let worst = 0;
  for (let k = 0; k < on.times.length; k++) { const m = builtMatrices(warrior, on, base, k); worst = Math.max(worst, angle(turn(m, padId, anchor), power(turn(m, driverId, anchor), pad.share))); }
  assert.ok(worst <= 2, `the pad is within ${worst.toFixed(2)} degrees of its share of the arm`);
  // The cape's own keys of the warrior's Attack, fitted to the taken clip's time.
  const kind = sequenceLike(warrior, /^attack/i), interval = warrior.Sequences[kind].Interval, cape = nodeNamed(warrior, 'Cape 1'), node = allNodes(warrior).find(n => n.ObjectId === cape);
  for (const share of [0.25, 0.5, 0.75]) {
    const k = sampleNear(on, on.length * share), frame = Math.round(interval[0] + on.times[k] / on.length * (interval[1] - interval[0]));
    const own = new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { interval, globalSequences: warrior.GlobalSequences, globalTime: frame, fallback: [0, 0, 0, 1], quaternion: true }));
    assert.ok(angle(rotationAt(on, cape, k), own) <= 2, `at ${on.times[k]} ms the cape is ${angle(rotationAt(on, cape, k), own).toFixed(2)} degrees from its own attack`);
  }
});

test('R7 trim and chain: part of a clip, then another clip of the same part without falling back to the body animation', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const footman = load('transfer-footman'), grunt = load('transfer-grunt'), sources = new Map([['g', grunt]]), rig = transferRig(footman), base = seq(footman, 'Stand - 1');
  const first = seq(grunt, 'Attack - 1'), second = seq(grunt, 'Attack - 2'), arm = extra => ({ ...defaultTransferPart(rig, 'armL'), source: 'g', sequence: first, blend: 0, ...extra });
  const build = part => buildTransfer(footman, sources, { base: { sequence: base }, sources: {}, parts: { armL: part } }), joint = rig.parts.armL.joints[0]; // the arm's first joint: its parent is not blended
  // Trim: 200..600 ms of the clip is a 400 ms result that starts where the whole clip is at 200 ms.
  const whole = build(arm({})), cut = build(arm({ clip: [200, 600] }));
  assert.equal(cut.length, 400);
  for (const t of [0, 200, 400]) assert.ok(angle(rotationAt(cut, joint, sampleNear(cut, t)), rotationAt(whole, joint, sampleNear(whole, t + 200))) <= 1.5, `the trimmed clip at ${t} ms is the whole clip at ${t + 200} ms`);
  // Chain: the second clip starts 150 ms before the first ends and fades in over those 150 ms.
  const length = whole.length, start = length - 150, secondLength = grunt.Sequences[second].Interval[1] - grunt.Sequences[second].Interval[0];
  const chain = build(arm({ next: [arm({ sequence: second, start, blend: 150 })] })), alone = build(arm({ sequence: second, start, blend: 0 }));
  assert.equal(chain.length, Math.round(start + secondLength));
  const mid = sampleNear(chain, start + 75), last = rotationAt(whole, joint, sampleNear(whole, start + 75)), next = rotationAt(alone, joint, sampleNear(alone, start + 75));
  const between = last.clone().slerp(next, 0.5), bodyPose = rotationAt(build(arm({ amount: 0 })), joint, 0);
  // (The weapon lift is smoothed over the whole result, so the two builds differ by a few degrees.)
  assert.ok(angle(rotationAt(chain, joint, mid), between) <= 10, `half way through the hand-over the arm is between the two clips (${angle(rotationAt(chain, joint, mid), between).toFixed(1)} degrees off)`);
  assert.ok(angle(rotationAt(chain, joint, mid), bodyPose) > 6 || angle(between, bodyPose) <= 6, 'it does not drop back to the body animation in between');
  const later = sampleNear(chain, start + 300);
  assert.ok(angle(rotationAt(chain, joint, later), rotationAt(alone, joint, sampleNear(alone, start + 300))) <= 1.5, 'after the hand-over the second clip plays as it does alone');
});

test('R7 hang: the Slaanesh warrior\'s cape keeps the world angle it has in its own attack', { skip: missing('glow-dual-weapon', 'transfer-grunt') }, () => {
  const warrior = load('glow-dual-weapon'), grunt = load('transfer-grunt'), sources = new Map([['g', grunt]]), rig = transferRig(warrior), attack = seq(grunt, 'Attack - 1');
  const base = sequenceLike(warrior, /^stand/i), kind = sequenceLike(warrior, /^attack/i), interval = warrior.Sequences[kind].Interval, cape = nodeNamed(warrior, 'Cape 1');
  const recipe = extra => ({ base: { sequence: base }, sources: {}, parts: Object.fromEntries(XFER.transferWholeBody(rig, transferRig(grunt, { sequence: attack })).parts.map(key => [key, { ...defaultTransferPart(rig, key, true), source: 'g', sequence: attack, ...extra }])) });
  const hung = buildTransfer(warrior, sources, recipe({ follow: 1, hang: 1 })), plain = buildTransfer(warrior, sources, recipe({ follow: 1 }));
  let apart = 0;
  for (const share of [0.25, 0.5, 0.75]) {
    const k = sampleNear(hung, hung.length * share), frame = Math.round(interval[0] + hung.times[k] / hung.length * (interval[1] - interval[0]));
    const own = rotOf(sampleNodeMatrices(warrior, frame, kind).get(cape)), now = rotOf(builtMatrices(warrior, hung, base, k).get(cape));
    assert.ok(angle(now, own) <= 2, `at ${hung.times[k]} ms the cape is ${angle(now, own).toFixed(2)} degrees from its own attack's world angle`);
    apart = Math.max(apart, angle(now, rotOf(builtMatrices(warrior, plain, base, k).get(cape))));
  }
  assert.ok(apart > 3, `hang changes the cape (${apart.toFixed(1)} degrees at most)`);
});

test('R7 rider: a knight whose rider hangs from a second mount root gives its chest, head and arms', { skip: missing('transfer-nurgle-knight', 'transfer-footman') }, () => {
  const knight = load('transfer-nurgle-knight'), footman = load('transfer-footman'), attack = seq(knight, 'Attack - 1'), rig = transferRig(knight, { sequence: attack });
  const names = key => rig.parts[key].joints.map(id => allNodes(knight).find(n => n.ObjectId === id).Name);
  for (const key of ['hips', 'chest', 'head', 'armL', 'armR']) assert.ok(rig.parts[key], `the knight has ${key}`);
  assert.equal(Object.keys(rig.parts).filter(key => /^leg/.test(key)).length, 4, 'four legs: the mount walks, the rider\'s legs are left alone');
  assert.ok(names('head').every(name => !/horse/i.test(name)), `head is the rider's (${names('head')})`);
  assert.ok(names('chest').every(name => !/horse/i.test(name)), `chest is the rider's (${names('chest')})`);
  assert.ok(names('hips').some(name => /horse/i.test(name)), `hips are the mount's (${names('hips')})`);
  const whole = XFER.transferWholeBody(transferRig(footman), rig);
  assert.deepEqual([...whole.parts].sort(), ['armL', 'armR', 'chest', 'head']);
  assert.match(whole.reason, /different number of legs/);
  const parts = Object.fromEntries(whole.parts.map(key => [key, { ...defaultTransferPart(transferRig(footman), key, true), source: 'k', sequence: attack }]));
  const built = buildTransfer(footman, new Map([['k', knight]]), { base: { sequence: seq(footman, 'Attack - 1') }, sources: {}, parts });
  assert.deepEqual(built.problems, []);
  // The Footman's weapon arm really swings: its first joint turns well over 30 degrees during the result.
  const arm = transferRig(footman).parts[transferRig(footman).weaponSide === 'L' ? 'armL' : 'armR'].joints[0], first = rotationAt(built, arm, 0);
  assert.ok(Math.max(...built.times.map((_, k) => angle(first, rotationAt(built, arm, k)))) > 30);
});

test('R7 assemblies: the seated upper body is found by structure and place, not by bone names', { skip: missing('transfer-nurgle-knight') }, () => {
  const named = load('transfer-nurgle-knight'), plain = fresh('transfer-nurgle-knight');
  // No horse, mount, saddle, seat or death left in any name: only the hierarchy and the pivots say who sits on whom.
  for (const node of allNodes(plain)) node.Name = String(node.Name).replace(/horse|mount|saddle|seat|death/ig, 'q');
  assert.ok(!allNodes(plain).some(node => /horse|mount|saddle|seat|death/i.test(node.Name)));
  const attack = seq(named, 'Attack - 1'), a = transferRig(named, { sequence: attack }), b = transferRig(plain, { sequence: attack });
  assert.deepEqual(Object.keys(b.parts).sort(), Object.keys(a.parts).sort());
  for (const key of ['chest', 'head', 'armL', 'armR', 'hips']) assert.deepEqual(b.parts[key].joints, a.parts[key].joints, `${key} has the same joints without the names`);
  // The rider really is a separate assembly: its chest does not hang from the body joint.
  const tree = nodeIndex(named, allNodes(named));
  assert.ok(!tree.isAncestor(a.parts.chest.joints[0], a.body), 'the chest is outside the body joint\'s own subtree');
});

test('R7 two creatures: a mounted model reads as both, as the rider alone, or as the mount alone', { skip: missing('transfer-nurgle-knight', 'transfer-knight', 'transfer-footman') }, () => {
  const footman = load('transfer-footman');
  assert.deepEqual(transferRig(footman).actors, ['both'], 'one creature offers one reading');
  assert.equal(transferRig(footman, { actor: 'seated' }), transferRig(footman), 'and asking for another gives the same rig');
  for (const key of ['transfer-nurgle-knight', 'transfer-knight']) {
    const model = load(key), both = transferRig(model), seated = transferRig(model, { actor: 'seated' }), walker = transferRig(model, { actor: 'walker' });
    const legs = rig => Object.keys(rig.parts).filter(part => /^leg/.test(part)).length, has = (rig, ...keys) => keys.every(part => rig.parts[part]);
    assert.deepEqual(both.actors, ['both', 'seated', 'walker'], `${key} is two creatures`);
    assert.ok(has(both, 'hips', 'chest', 'head', 'armL', 'armR') && legs(both) === 4, `${key} both: the rider's upper body on the mount's four legs (${Object.keys(both.parts)})`);
    assert.ok(has(seated, 'hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR') && legs(seated) === 2, `${key} seated: the rider whole, its own two legs (${Object.keys(seated.parts)})`);
    assert.ok(has(walker, 'hips') && legs(walker) === 4 && !walker.parts.armL && !walker.parts.chest, `${key} walker: the mount alone (${Object.keys(walker.parts)})`);
    // No joint is both the rider's and the mount's.
    const riderJoints = new Set(Object.values(seated.parts).flatMap(part => part.joints));
    assert.ok(!Object.values(walker.parts).flatMap(part => part.joints).some(id => riderJoints.has(id)), `${key}: the two readings share no joint`);
    assert.notEqual(seated.body, walker.body);
  }
});

test('R7 turn a unit into a rider: the Footman takes the knight\'s rider whole, legs included', { skip: missing('transfer-nurgle-knight', 'transfer-footman') }, () => {
  const knight = load('transfer-nurgle-knight'), footman = load('transfer-footman'), rigB = transferRig(footman), stand = seq(knight, 'Stand - 1'), base = seq(footman, 'Stand - 1');
  const recipe = actor => { const rigA = transferRig(knight, { sequence: stand, actor }), whole = XFER.transferWholeBody(rigB, rigA); return { whole, recipe: { base: { sequence: base }, sources: { k: { actor } }, parts: Object.fromEntries(whole.parts.map(key => [key, { ...defaultTransferPart(rigB, key, true), source: 'k', sequence: stand, match: actor === 'seated' ? 1 : 0 }])) } }; };
  // Pose "Theirs" (match 1): the seat is the rider's stance itself, not a movement away from it.
  const both = recipe('both'), rider = recipe('seated');
  assert.ok(!both.whole.parts.includes('legL') && /different number of legs/.test(both.whole.reason), 'as both, the legs stay with the body animation');
  assert.ok(['hips', 'legL', 'legR', 'chest', 'armL', 'armR'].every(key => rider.whole.parts.includes(key)) && !rider.whole.reason, `as the rider alone the whole body is taken (${rider.whole.parts})`);
  const sources = new Map([['k', knight]]), seated = buildTransfer(footman, sources, rider.recipe), standing = buildTransfer(footman, sources, both.recipe);
  assert.deepEqual(seated.problems, []);
  // Astride: the Footman's thighs turn well away from where they are when only the upper body is taken.
  const thighs = ['legL', 'legR'].map(key => rigB.parts[key].joints[0]);
  for (const id of thighs) assert.ok(seated.tracks.has(id) && !standing.tracks.has(id));
  const stood = sampleNodeMatrices(footman, footman.Sequences[base].Interval[0], base), m = builtMatrices(footman, seated, base, 0);
  for (const id of thighs) assert.ok(angle(rotOf(m.get(id)), rotOf(stood.get(id))) > 15, 'a thigh is turned to sit');
});
