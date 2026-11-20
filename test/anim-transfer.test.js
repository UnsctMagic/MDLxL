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
import { poseChainIds, suggestPoseRig } from '../src/pose-ik.js';
import { poseLimbOrCloth, poseLimbStart, poseRecognitionEvidence } from '../src/pose-recognition.js';
import { standSequenceIndex } from '../src/sequence-editor.js';

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
  // The left arm starts inside. The right (weapon) arm was inside only because the weapon lift turned it into the chest
  // (0.12 of a body radius; unlifted -0.01): since P1 the lift no longer does, so it starts out (-0.04).
  assert.ok(off.arms.armL.deficit > 0.1 && off.arms.armR.deficit < 0.05, `the left arm starts inside, the right one out (${off.arms.armL.deficit.toFixed(2)}, ${off.arms.armR.deficit.toFixed(2)})`);
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

test('R8 features: a model\'s own loose joints group into features; a patch of body skin counts as body', { skip: missing('transfer-nurgle-warrior', 'glow-dual-weapon', 'transfer-grunt', 'transfer-footman') }, () => {
  const nurgle = XFER.transferFeatures(load('transfer-nurgle-warrior')), by = name => nurgle.find(feature => feature.name === name);
  assert.ok(by('BellyBone1') && by('BellyBone1').body && by('BellyBone1').part === 'chest' && by('BellyBone1').joints.length === 3, 'the belly chain is one feature of the chest, and body');
  assert.ok(by('Cape 1') && !by('Cape 1').body && by('Cape 1').joints.length === 2, 'the cape is a feature, not body');
  assert.ok(by('Bone_Shoulder_L')?.part === 'armL' && by('Bone_Shoulder_R')?.part === 'armR' && !by('Bone_Shoulder_L').body, 'each shoulder bone is a feature of its arm');
  const slaanesh = XFER.transferFeatures(load('glow-dual-weapon'));
  assert.ok(slaanesh.some(feature => feature.name === 'Pauldron_L') && slaanesh.every(feature => !feature.body), 'pauldrons and a cape that only joins at the shoulders are not body');
  assert.deepEqual(XFER.transferFeatures(load('transfer-grunt')), [], 'a weapon in the hand is not a feature');
  assert.ok(XFER.transferFeatures(load('transfer-footman')).every(feature => !feature.body));
});

test('R8 keep a feature: the Nurgle warrior\'s belly plays its own attack and the arms stay out of it', { skip: missing('transfer-nurgle-warrior', 'transfer-grunt') }, () => {
  const warrior = load('transfer-nurgle-warrior'), grunt = load('transfer-grunt'), sources = new Map([['g', grunt]]), rig = transferRig(warrior), attack = seq(grunt, 'Attack - 1'), base = sequenceLike(warrior, /^stand/i);
  const belly = XFER.transferFeatures(warrior, { sequence: base }).find(feature => feature.name === 'BellyBone1'), cape = XFER.transferFeatures(warrior, { sequence: base }).find(feature => feature.name === 'Cape 1');
  const recipe = features => ({ base: { sequence: base }, sources: {}, features, parts: Object.fromEntries(XFER.transferWholeBody(rig, transferRig(grunt, { sequence: attack })).parts.map(key => [key, { ...defaultTransferPart(rig, key, true), source: 'g', sequence: attack }])) });
  const off = buildTransfer(warrior, sources, recipe(undefined)), kept = buildTransfer(warrior, sources, recipe({ [belly.id]: { keep: 1 } }));
  sameArrays(off, buildTransfer(warrior, sources, recipe({})));
  const bellyIds = belly.joints.map(name => nodeNamed(warrior, name)), capeIds = cape.joints.map(name => nodeNamed(warrior, name));
  assert.ok(bellyIds.every(id => !off.tracks.has(id)) && bellyIds.every(id => kept.tracks.has(id)), 'only a kept feature is driven');
  assert.ok(capeIds.every(id => !kept.tracks.has(id)), 'the cape, not kept, is left alone');
  // The belly's own keys of the warrior's Attack, fitted to the taken clip.
  const kind = sequenceLike(warrior, /^attack/i), interval = warrior.Sequences[kind].Interval, node = allNodes(warrior).find(n => n.ObjectId === bellyIds[0]), k = sampleNear(kept, kept.length / 2), frame = Math.round(interval[0] + kept.times[k] / kept.length * (interval[1] - interval[0]));
  const own = new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { interval, globalSequences: warrior.GlobalSequences, globalTime: frame, fallback: [0, 0, 0, 1], quaternion: true }));
  assert.ok(angle(rotationAt(kept, bellyIds[0], k), own) <= 2);
  // A kept body feature keeps arms out of the trunk there: a shoulder turns, with no other switch on.
  const turned = Math.max(...['armL', 'armR'].map(key => rig.parts[key].joints[0]).map(id => Math.max(...kept.times.map((_, i) => angle(rotationAt(kept, id, i), rotationAt(off, id, i))))));
  assert.ok(turned > 2, `a shoulder turns ${turned.toFixed(1)} degrees to clear the belly`);
});

// ---- Round 9: riders on other mounts (structure only; the names below are only for the messages)
const jointsOf = rig => new Set(Object.values(rig.parts).flatMap(part => part.joints));
const partsLike = (rig, pattern) => Object.keys(rig.parts).filter(key => pattern.test(key));
const below = (model, rig, key, top) => { const tree = nodeIndex(model, allNodes(model)); return rig.parts[key].joints.every(id => tree.isAncestor(id, top)); };

test('R9 a rider that hangs from its mount\'s chest is read apart from the mount\'s wings, neck and head', { skip: missing('transfer-dragon-rider') }, () => {
  const named = load('transfer-dragon-rider'), plain = fresh('transfer-dragon-rider');
  // No rider, dragon, saddle, seat or mount left in any name: only the hierarchy and the pivots say who sits on whom.
  for (const node of allNodes(plain)) node.Name = String(node.Name).replace(/rider|dragon|saddle|seat|mount|lindorm|vc_/ig, 'q');
  assert.ok(!allNodes(plain).some(node => /rider|dragon|saddle|seat|mount/i.test(node.Name)));
  for (const model of [named, plain]) {
    const both = transferRig(model), seated = transferRig(model, { actor: 'seated' }), walker = transferRig(model, { actor: 'walker' });
    assert.deepEqual(both.actors, ['both', 'seated', 'walker']);
    assert.equal(seated.actor, 'seated');
    assert.deepEqual(partsLike(seated, /^(wing|tail)/), [], 'the rider alone has no wings and no tail');
    assert.ok(['hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR'].every(key => seated.parts[key]) && partsLike(seated, /^leg/).length === 2, `the rider whole (${Object.keys(seated.parts)})`);
    assert.equal(seated.parts.chest.joints.length, 1, 'one chest joint: the rider\'s, not the mount\'s as well');
    assert.equal(seated.parts.head.joints.length, 1, 'one head joint: the rider\'s, not the mount\'s neck as well');
    assert.equal(partsLike(walker, /^wing/).length, 2, `the mount alone keeps its wings (${Object.keys(walker.parts)})`);
    assert.ok(walker.parts.chest && walker.parts.head && !walker.parts.armL, 'the mount alone has its own chest and head and no arms');
    const rider = jointsOf(seated);
    assert.ok(![...jointsOf(walker)].some(id => rider.has(id)), 'the two readings share no joint');
    // Read together, the chest and head are the rider's alone and the wings stay with the mount.
    assert.deepEqual(both.parts.chest.joints, seated.parts.chest.joints);
    assert.deepEqual(both.parts.head.joints, seated.parts.head.joints);
    assert.equal(partsLike(both, /^wing/).length, 2);
  }
});

test('R9 a rider on a four-footed mount: forelimbs walk, and cloth on the rider\'s chest is not its legs', { skip: missing('transfer-nightmare-rider') }, () => {
  const model = load('transfer-nightmare-rider'), both = transferRig(model), seated = transferRig(model, { actor: 'seated' }), walker = transferRig(model, { actor: 'walker' });
  assert.deepEqual(both.actors, ['both', 'seated', 'walker']);
  assert.ok(['hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR'].every(key => seated.parts[key]), `the rider whole (${Object.keys(seated.parts)})`);
  assert.equal(partsLike(seated, /^arm/).length, 2, 'the rider has two arms: the mount\'s forelimbs and wings are not its own');
  assert.equal(seated.parts.head.joints.length, 2, 'the rider\'s neck and head, not the mount\'s as well');
  // Its legs hang from the hips, beside the chest, not from the chest the arms hang from.
  const chest = seated.parts.chest.joints[0];
  for (const key of ['legL', 'legR']) assert.ok(!below(model, seated, key, chest), `${key} does not hang from the chest`);
  for (const key of ['armL', 'armR']) assert.ok(below(model, seated, key, chest), `${key} hangs from the chest`);
  assert.ok(walker.parts.head && !walker.parts.chest, 'the mount alone has its own head');
  const rider = jointsOf(seated);
  assert.ok(![...jointsOf(walker)].some(id => rider.has(id)), 'the two readings share no joint');
});

test('R9 a rider on its own root over a mount that has arms of its own', { skip: missing('transfer-cold-one-rider') }, () => {
  const model = load('transfer-cold-one-rider'), both = transferRig(model), seated = transferRig(model, { actor: 'seated' }), walker = transferRig(model, { actor: 'walker' });
  assert.deepEqual(both.actors, ['both', 'seated', 'walker']);
  assert.ok(['hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR'].every(key => seated.parts[key]) && partsLike(seated, /^leg/).length === 2, `the rider whole (${Object.keys(seated.parts)})`);
  assert.ok(walker.parts.armL && walker.parts.armR && walker.parts.chest && walker.parts.head, 'the mount alone keeps its own arms, chest and head');
  const rider = jointsOf(seated);
  assert.ok(![...jointsOf(walker)].some(id => rider.has(id)), 'the two readings share no joint');
  assert.deepEqual(both.parts.chest.joints, seated.parts.chest.joints, 'read together, the chest is the rider\'s');
  // The rider's own tail piece stays put when the two are read together, like its legs.
  assert.ok(partsLike(both, /^tail/).every(key => !both.parts[key].joints.some(id => rider.has(id))), 'no tail part moves a rider joint');
});

test('R9 one creature stays one: a torso on a four-legged body, a second form in the same place', { skip: missing('transfer-magnataur', 'transfer-dryad', 'transfer-demon-hunter', 'transfer-footman') }, () => {
  for (const key of ['transfer-magnataur', 'transfer-dryad', 'transfer-demon-hunter', 'transfer-footman']) {
    const model = load(key);
    assert.deepEqual(transferRig(model).actors, ['both'], `${key} is one creature`);
    assert.equal(transferRig(model, { actor: 'seated' }), transferRig(model), `${key}: asking for the rider gives the plain rig`);
  }
  // The Demon Hunter's plain reading is its night-elf body, never the hidden demon form with the elf "on" it.
  const hunter = load('transfer-demon-hunter'), rig = transferRig(hunter), names = new Map(allNodes(hunter).map(node => [node.ObjectId, node.Name]));
  assert.ok(Object.values(rig.parts).every(part => part.joints.every(id => !/alternate/i.test(names.get(id)))), 'no joint of the other form in the plain reading');
});

test('R9 a unit made into a rider from a dragon\'s rider stays upright and bobs as much as the rider, not three times more', { skip: missing('transfer-grunt', 'transfer-dragon-rider') }, () => {
  // The Grunt's root and pelvis sit on the same spot; the dragon rider's hip height is small because its legs are folded.
  const grunt = load('transfer-grunt'), donor = load('transfer-dragon-rider'), sequence = seq(donor, 'Stand - 1'), base = seq(grunt, 'Stand - 1');
  const rigB = transferRig(grunt, { sequence: base }), rigA = transferRig(donor, { sequence, actor: 'seated' }), keys = XFER.transferWholeBody(rigB, rigA).parts;
  assert.equal(rigA.actor, 'seated');
  const recipe = { base: { sequence: base }, length: donor.Sequences[sequence].Interval[1] - donor.Sequences[sequence].Interval[0], sources: { d: { actor: 'seated' } },
    parts: Object.fromEntries(keys.map(key => [key, { ...defaultTransferPart(rigB, key, true), source: 'd', sequence, match: /^(hips|leg)/.test(key) ? 1 : 0 }])) };
  const byB = new Map(allNodes(grunt).map(node => [node.ObjectId, node])), byA = new Map(allNodes(donor).map(node => [node.ObjectId, node]));
  const at = (model, by, matrix, id) => new Vector3().fromArray(nodePivot(model, by.get(id), id)).applyMatrix4(matrix);
  const head = rigB.parts.head.joints.at(-1), chestB = rigB.parts.chest.joints[0], chestA = rigA.parts.chest.joints[0];
  const ref = sampleNodeMatrices(grunt, grunt.Sequences[base].Interval[0], base), tall = at(grunt, byB, ref.get(head), head).z - at(grunt, byB, ref.get(rigB.body), rigB.body).z;
  const heights = [], chest = [];
  const built = buildTransfer(grunt, new Map([['d', donor]]), recipe, { probe: ({ world }) => { heights.push(at(grunt, byB, world(head), head).z - at(grunt, byB, world(rigB.body), rigB.body).z); chest.push(at(grunt, byB, world(chestB), chestB).z); } });
  assert.deepEqual(built.problems, []);
  assert.ok(Math.min(...heights) > 0.8 * tall, `the head stays above the hips (${Math.min(...heights).toFixed(1)} of ${tall.toFixed(1)}): he sits upright, not on his back`);
  const [first, last] = donor.Sequences[sequence].Interval, theirs = [];
  for (let i = 0; i <= 40; i++) { const m = sampleNodeMatrices(donor, Math.round(first + (last - first) * i / 40), sequence); theirs.push(at(donor, byA, m.get(chestA), chestA).z); }
  const rise = Math.max(...chest) - Math.min(...chest), riseA = Math.max(...theirs) - Math.min(...theirs);
  assert.ok(riseA > 3, `the dragon's rider rises and falls (${riseA.toFixed(1)})`);
  assert.ok(rise > 0.6 * riseA && rise < 1.6 * riseA, `the Grunt rises and falls ${rise.toFixed(1)}, the rider ${riseA.toFixed(1)}`);
});

// A unit made into a rider: the whole body from the donor's rider, hips and legs with Pose at Theirs.
const asRider = (rec, donor, name, arms = {}) => {
  const sequence = seq(donor, name), base = seq(rec, 'Stand - 1'), rigB = transferRig(rec, { sequence: base }), rigA = transferRig(donor, { sequence, actor: 'seated' }), keys = XFER.transferWholeBody(rigB, rigA).parts;
  const recipe = { base: { sequence: base }, length: donor.Sequences[sequence].Interval[1] - donor.Sequences[sequence].Interval[0], sources: { d: { actor: 'seated' } },
    parts: Object.fromEntries(keys.map(key => [key, { ...defaultTransferPart(rigB, key, true), source: 'd', sequence, match: /^(hips|leg)/.test(key) ? 1 : 0, ...(/^arm/.test(key) ? arms : {}) }])) };
  const by = new Map(allNodes(rec).map(node => [node.ObjectId, node])), frames = [];
  const built = buildTransfer(rec, new Map([['d', donor]]), recipe, { probe: ({ world }) => frames.push(id => new Vector3().fromArray(nodePivot(rec, by.get(id), id)).applyMatrix4(world(id))) });
  return { rigA, rigB, built, frames, recipe };
};

test('R9 a donor leg joint whose pivot is off the leg does not fold the shins inward', { skip: missing('transfer-grunt', 'transfer-khorne-knight') }, () => {
  const { rigA, rigB, built, frames } = asRider(load('transfer-grunt'), load('transfer-khorne-knight'), 'Walk');
  assert.equal(rigA.actor, 'seated');
  assert.ok(rigA.parts.legL.joints.length > rigA.parts.legL.line.length, 'the donor leg has a joint that is not on its line');
  assert.deepEqual(built.problems, []);
  for (const key of ['legL', 'legR']) {
    const [, knee, foot] = rigB.parts[key].joints, drop = Math.min(...frames.map(at => at(knee).z - at(foot).z));
    assert.ok(drop > 0.5 * rigB.parts[key].length / 2, `${key}: the foot hangs below the knee all through the walk (least ${drop.toFixed(1)})`);
  }
});

test('R9 frame: a turn carried in the limb\'s own frame keeps a hanging arm hanging; off, nothing changes', { skip: missing('transfer-footman', 'transfer-nightmare-rider') }, () => {
  const footman = load('transfer-footman'), donor = load('transfer-nightmare-rider');
  const plain = asRider(footman, donor, 'Walk'), off = asRider(footman, donor, 'Walk', { frame: 0 }), own = asRider(footman, donor, 'Walk', { frame: 1 });
  for (const [id, track] of plain.built.tracks) assert.deepEqual(off.built.tracks.get(id).Rotation, track.Rotation, 'frame 0 is today\'s result');
  // The rider's right arm rests pointing forward, the Footman's hangs down: the same world turn lifts his elbow over his shoulder.
  const [shoulder, elbow] = plain.rigB.parts.armR.joints, above = run => Math.max(...run.frames.map(at => at(elbow).z - at(shoulder).z));
  assert.ok(above(plain) > 0, `as today the elbow rises over the shoulder (${above(plain).toFixed(1)})`);
  assert.ok(above(own) < -5, `in the limb's own frame it stays below (${above(own).toFixed(1)})`);
  assert.deepEqual(own.built.problems, []);
});

// R11 (docs/agent-tasks/recognition-limb-or-cloth.md): the shared recogniser tells a limb from hanging cloth.
const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const poseRigOf = model => { let stand = standSequenceIndex(model); if (stand < 0 || !model.Sequences[stand]?.Interval) stand = model.Sequences.findIndex(s => s.Interval); return suggestPoseRig(model, model.Sequences[stand].Interval[0], stand); };
// The chains the recogniser is asked about: those read as legs, and those the rig already carries as cloth.
const legChains = rig => rig.chains.filter(chain => chain.kind === 'leg' && chain.label !== 'Wing' || chain.cloth);
const rootNamed = (model, pattern) => { const names = new Map(allNodes(model).map(node => [node.ObjectId, node.Name])); return chain => pattern.test(names.get(chain.root)); };
const STRIPS = [['transfer-bray-shaman', /scroll/i], ['transfer-bray-shaman-hero', /scroll/i], ['transfer-nightmare-rider', /fur_panel/i]];

test('R11 one creature: the Bray Shaman\'s chest scrolls are not a rider\'s legs', { skip: missing('transfer-bray-shaman', 'transfer-bray-shaman-hero') }, () => {
  for (const key of ['transfer-bray-shaman', 'transfer-bray-shaman-hero']) {
    const model = load(key);
    assert.deepEqual(transferRig(model).actors, ['both'], `${key} is one creature`);
    assert.equal(transferRig(model, { actor: 'seated' }), transferRig(model), `${key}: asking for the rider gives the plain rig`);
  }
});

test('R11 poseLimbOrCloth: the scrolls and the fur strips are cloth; every native unit\'s named legs are limbs', { skip: missing('transfer-bray-shaman', 'transfer-bray-shaman-hero', 'transfer-nightmare-rider') || (!fs.existsSync(testModel('corpus-sd')) && 'private test models not on this machine: corpus-sd') }, () => {
  for (const [key, pattern] of STRIPS) {
    const model = load(key), rig = poseRigOf(model), strips = legChains(rig).filter(rootNamed(model, pattern));
    assert.equal(strips.length, 2, `${key}: two strips to ask about`);
    for (const chain of strips) { const answer = poseLimbOrCloth(model, rig, chain); assert.equal(answer.kind, 'cloth', `${key}: ${JSON.stringify(answer)}`); }
    for (const chain of legChains(rig).filter(chain => !strips.includes(chain))) assert.equal(poseLimbOrCloth(model, rig, chain).kind, 'limb', `${key}: its own legs are limbs`);
  }
  let named = 0;
  for (const file of fs.readdirSync(testModel('corpus-sd')).filter(name => /\.mdx$/i.test(name))) {
    const b = fs.readFileSync(testModel('corpus-sd', file)), model = parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    if (!model.Sequences?.some(sequence => sequence.Interval)) continue;
    const rig = poseRigOf(model), evidence = poseRecognitionEvidence(model);
    for (const chain of legChains(rig)) {
      const answer = poseLimbOrCloth(model, rig, chain, { evidence });
      if (answer.clues.name !== 'limb') continue;
      named++;
      assert.equal(answer.kind, 'limb', `${file}: ${JSON.stringify(answer)}`);
    }
  }
  assert.ok(named > 500, `named native legs read: ${named}`);
});

test('R11 a name alone does not make cloth, and cloth without its name is still cloth', { skip: missing('transfer-footman', 'transfer-bray-shaman', 'transfer-bray-shaman-hero', 'transfer-nightmare-rider') }, () => {
  const rename = (model, rig, chains, name) => {
    const copy = fresh(model), byId = new Map(allNodes(copy).map(node => [node.ObjectId, node]));
    let i = 0;
    for (const chain of chains) for (const id of poseChainIds(chain)) byId.get(id).Name = `${name}_${++i}`;
    // The rig as it was read; the renamed joints carry no role of their own any more.
    const roles = Object.fromEntries(Object.entries(rig.roles || {}).filter(([id]) => !chains.some(chain => poseChainIds(chain).includes(Number(id)))));
    return { copy, rig: { ...rig, roles } };
  };
  // The Footman's legs under cloth names: still limbs.
  const footman = load('transfer-footman'), footmanRig = poseRigOf(footman), legs = legChains(footmanRig);
  assert.equal(legs.length, 2);
  const asCloth = rename('transfer-footman', footmanRig, legs, 'Cloth_Strip');
  for (const chain of legs) {
    const answer = poseLimbOrCloth(asCloth.copy, asCloth.rig, chain);
    assert.equal(answer.clues.name, 'cloth', 'the cloth name is read');
    assert.equal(answer.kind, 'limb', `a cloth name alone does not make cloth: ${JSON.stringify(answer)}`);
  }
  // The strips under plain names: still cloth, from where they hang, how they reach and move.
  for (const [key, pattern] of STRIPS) {
    const model = load(key), rig = poseRigOf(model), strips = legChains(rig).filter(rootNamed(model, pattern)), plain = rename(key, rig, strips, 'Bone');
    for (const chain of strips) {
      const answer = poseLimbOrCloth(plain.copy, plain.rig, chain);
      assert.equal(answer.clues.name, null);
      assert.equal(answer.kind, 'cloth', `${key} without its cloth names: ${JSON.stringify(answer)}`);
    }
  }
});

test('R11 hanging cloth is a plain bone chain in the rig and no limb in Transfer', { skip: missing('transfer-bray-shaman', 'transfer-bray-shaman-hero', 'transfer-nightmare-rider') }, () => {
  const readings = model => ['both', 'seated', 'walker'].map(actor => transferRig(model, { actor }));
  for (const [key, pattern] of STRIPS) {
    const model = load(key), rig = poseRigOf(model), strips = rig.chains.filter(rootNamed(model, pattern)), stripJoints = new Set(strips.flatMap(poseChainIds));
    // The rig: the two strips are bone chains marked cloth, and nothing else is.
    assert.equal(strips.length, 2, `${key}: both strips keep their handle`);
    for (const chain of strips) assert.deepEqual([chain.kind, chain.label, chain.cloth], ['arm', 'Chain', true], `${key}: a strip is a bone chain marked cloth`);
    assert.deepEqual(rig.chains.filter(chain => chain.cloth), strips, `${key}: only the strips are cloth`);
    // Without the clues (ANIM, Attachemator, Auto Corpse) nothing is marked.
    let stand = standSequenceIndex(model); if (stand < 0) stand = model.Sequences.findIndex(s => s.Interval);
    assert.ok(!suggestPoseRig(model, model.Sequences[stand].Interval[0], stand, { clues: false }).chains.some(chain => chain.cloth || chain.label === 'Chain' && stripJoints.has(chain.end)), `${key}: unchanged without clues`);
    // Transfer: no reading makes a part of a strip.
    for (const reading of readings(model)) assert.ok(![...jointsOf(reading)].some(id => stripJoints.has(id)), `${key} (${reading.actor}): no part holds a strip joint (${Object.keys(reading.parts)})`);
  }
  // The rider is still found through its strips, whole, with the legs that hang from its hips.
  const rider = load('transfer-nightmare-rider'), seated = transferRig(rider, { actor: 'seated' });
  assert.deepEqual(transferRig(rider).actors, ['both', 'seated', 'walker'], 'the nightmare rider stays two creatures');
  assert.equal(seated.actor, 'seated');
  assert.ok(['hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR'].every(part => seated.parts[part]) && partsLike(seated, /^arm/).length === 2 && partsLike(seated, /^leg/).length === 2, `the rider whole (${Object.keys(seated.parts)})`);
  // The shaman is one creature with its own two arms and two legs, and its chest is a chest again.
  for (const key of ['transfer-bray-shaman', 'transfer-bray-shaman-hero']) {
    const model = load(key), rig = transferRig(model), names = new Map(allNodes(model).map(node => [node.ObjectId, node.Name]));
    assert.deepEqual(rig.actors, ['both'], `${key} is one creature`);
    assert.deepEqual([partsLike(rig, /^arm/).sort(), partsLike(rig, /^leg/).sort()], [['armL', 'armR'], ['legL', 'legR']], `${key}: two arms and two legs (${Object.keys(rig.parts)})`);
    for (const part of ['armL', 'armR']) assert.match(names.get(rig.parts[part].joints.at(-1)), /hand/i, `${key}: ${part} is the real arm, down to its hand`);
    assert.ok(rig.parts.chest && below(model, rig, 'armL', rig.parts.chest.joints[0]) && below(model, rig, 'armR', rig.parts.chest.joints[0]), `${key}: the arms hang from the chest part`);
    assert.ok(!rig.parts.hips.joints.some(id => rig.parts.chest.joints.includes(id)), `${key}: the chest does not ride with the hips`);
  }
});

// R12 (docs/agent-tasks/xfer-both-ways.md): arms and legs pair by role, read in the rest pose.
const limbRead = (model, part) => {
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), top = part.joints.indexOf(part.line[0]);
  return [top, poseLimbStart(part.joints.map(id => new Vector3(...nodePivot(model, byId.get(id), id))), part.joints.map(id => byId.get(id).Name), top, part.joints.length - 1, part.limbKind)];
};

test('R12 where a limb starts: a collar stays above the arm; a thigh above a hoofed leg\'s handles is the leg\'s first joint', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const kurgan = load('transfer-kurgan'), tauren = load('transfer-tauren'), rigK = transferRig(kurgan), rigT = transferRig(tauren);
  for (const key of ['armL', 'armR']) {
    assert.deepEqual(limbRead(kurgan, rigK.parts[key]), [2, 2], `the Kurgan's ${key}: collar and shoulder piece are no part of the arm`);
    assert.deepEqual(limbRead(tauren, rigT.parts[key]), [1, 1], `the Tauren's ${key}: its collar is no part of the arm`);
  }
  for (const key of ['legL', 'legR']) {
    assert.deepEqual(limbRead(tauren, rigT.parts[key]), [1, 0], `the Tauren's ${key}: the thigh above its hock handles belongs to the leg`);
    assert.deepEqual(limbRead(kurgan, rigK.parts[key]), [0, 0], `the Kurgan's ${key} starts at its thigh`);
  }
  // No single clue decides, a name least of all (three joints hanging down, one joint above them).
  const P = (...xyz) => new Vector3(...xyz), limb = [P(0, 0, 10), P(0, 0, 5), P(0, 0, 0)], names = top => [top, 'a', 'b', 'c'];
  assert.equal(poseLimbStart([P(0, -3, 10), ...limb], names('UpperArm'), 1, 3, 'arm'), 1, 'a short sideways piece is no part of the limb, whatever its name');
  assert.equal(poseLimbStart([P(0, -8, 10), ...limb], names('x'), 1, 3, 'arm'), 1, 'length alone does not make it part of the limb');
  assert.equal(poseLimbStart([P(0, 0, 16), ...limb], names('Clavicle'), 1, 3, 'arm'), 0, 'long and in line with the limb: part of it, against its name');
});

test('R12 bones pair by role: at Pose = Theirs the Kurgan\'s arms and legs point as the Tauren\'s do', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const kurgan = load('transfer-kurgan'), tauren = load('transfer-tauren'), stand = seqMatch(kurgan, /^stand - 1/i), theirs = seqMatch(tauren, /^stand\s*-\s*1$/i);
  const rig = transferRig(kurgan, { sequence: stand }), rigT = transferRig(tauren, { sequence: theirs }), { parts } = wholeBodyParts(rig, rigT);
  // The switches that place a limb afterwards are off: only the transfer itself is measured.
  const built = buildTransfer(kurgan, new Map([['tauren', tauren]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'tauren', theirs, { match: 1, plant: false, grip: false, clear: false }) });
  assert.deepEqual(built.problems, []);
  const point = (model, matrices) => { const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])); return id => new Vector3(...nodePivot(model, byId.get(id), id)).applyMatrix4(matrices.get(id)); };
  const mine = point(kurgan, builtMatrices(kurgan, built, stand, 0)), their = point(tauren, sampleNodeMatrices(tauren, tauren.Sequences[theirs].Interval[0], theirs));
  const apart = (a, b, c, d) => mine(b).sub(mine(a)).angleTo(their(d).sub(their(c))) * 180 / Math.PI;
  for (const key of ['armL', 'armR']) {
    const own = rig.parts[key].line, donor = rigT.parts[key].line;
    assert.ok(apart(own[0], own[1], donor[0], donor[1]) < 10, `${key}: the upper arm is ${apart(own[0], own[1], donor[0], donor[1]).toFixed(0)} degrees from the Tauren's upper arm`);
    assert.ok(apart(own[1], own[2], donor[1], donor[2]) < 10, `${key}: the forearm is ${apart(own[1], own[2], donor[1], donor[2]).toFixed(0)} degrees from the Tauren's forearm`);
  }
  for (const key of ['legL', 'legR']) {
    // The Tauren's leg has a joint more: the Kurgan's thigh follows its thigh, the shin its line from knee to hoof.
    const own = rig.parts[key].joints, donor = rigT.parts[key].joints;
    assert.deepEqual([own.length, donor.length], [3, 4]);
    assert.ok(apart(own[0], own[1], donor[0], donor[1]) < 10, `${key}: the thigh is ${apart(own[0], own[1], donor[0], donor[1]).toFixed(0)} degrees from the Tauren's thigh`);
    assert.ok(apart(own[1], own[2], donor[1], donor[3]) < 10, `${key}: the lower leg is ${apart(own[1], own[2], donor[1], donor[3]).toFixed(0)} degrees from the Tauren's knee-to-hoof line`);
  }
});

test('R12 hips keep their stance at Pose = Theirs: a root and a pelvis stacked on each other give no direction to line up', { skip: missing('transfer-orc-warlock', 'transfer-tauren') }, () => {
  const warlock = load('transfer-orc-warlock'), tauren = load('transfer-tauren'), stand = seqMatch(warlock, /^stand/i), theirs = seqMatch(tauren, /^stand\s*-\s*1$/i);
  const rig = transferRig(warlock, { sequence: stand }), rigT = transferRig(tauren, { sequence: theirs }), { parts } = wholeBodyParts(rig, rigT);
  assert.ok(rig.parts.hips.joints.length > 1, 'the warlock\'s hips are more than one joint');
  const built = buildTransfer(warlock, new Map([['tauren', tauren]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'tauren', theirs, { match: 1, plant: false, grip: false, clear: false }) });
  assert.deepEqual(built.problems, []);
  // The Tauren's Stand starts in its reference pose: at the first sample the trunk has no reason to turn.
  const own = sampleNodeMatrices(warlock, rig.reference.frame, rig.reference.sequence), now = builtMatrices(warlock, built, stand, 0);
  for (const key of ['hips', 'chest']) for (const id of rig.parts[key].joints) {
    const turned = angle(rotOf(own.get(id)), rotOf(now.get(id)));
    assert.ok(turned < 10, `${key}: ${allNodes(warlock).find(n => n.ObjectId === id).Name} is turned ${turned.toFixed(0)} degrees from the warlock's own stance`);
  }
});

// R13 (docs/agent-tasks/xfer-both-ways.md, stage 2): the donor's stance, carried over from the rest pose.
test('R13 stance: the trunk takes the donor\'s turn from its rest pose; off, nothing changes', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const kurgan = load('transfer-kurgan'), tauren = load('transfer-tauren'), stand = seqMatch(kurgan, /^stand - 1/i), theirs = seqMatch(tauren, /^stand\s*-\s*1$/i);
  const rig = transferRig(kurgan, { sequence: stand }), rigT = transferRig(tauren, { sequence: theirs }), { parts } = wholeBodyParts(rig, rigT);
  assert.equal(defaultTransferPart(rig, 'chest', true).stance, 0, 'stance is off unless the recipe asks');
  const build = extra => buildTransfer(kurgan, new Map([['tauren', tauren]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'tauren', theirs, { match: 1, plant: false, grip: false, clear: false, ...extra }) });
  const plain = build({}), zero = build({ stance: 0 }), stanced = build({ stance: 1 });
  assert.deepEqual(stanced.problems, []);
  for (const [id, track] of plain.tracks) assert.deepEqual(Array.from(zero.tracks.get(id).Rotation || []), Array.from(track.Rotation || []), 'stance 0 writes the same keys as no stance');
  // How far a trunk joint's turn from the rest pose is from the Tauren's, through the animation.
  const off = (built, key, k) => angle(rotOf(builtMatrices(kurgan, built, stand, k).get(rig.parts[key].joints.at(-1))), rotOf(sampleNodeMatrices(tauren, Math.round(tauren.Sequences[theirs].Interval[0] + built.times[k]), theirs).get(rigT.parts[key].joints.at(-1))));
  const samples = [0, Math.floor(stanced.times.length / 3), Math.floor(2 * stanced.times.length / 3)];
  for (const key of ['hips', 'chest', 'head']) {
    for (const k of samples) assert.ok(off(stanced, key, k) < 3, `${key}: with stance, ${off(stanced, key, k).toFixed(1)} degrees from the Tauren's turn at sample ${k}`);
    assert.ok(off(plain, key, 0) > 8, `${key}: without stance it keeps the Kurgan's own (${off(plain, key, 0).toFixed(1)} degrees from the Tauren's)`);
  }
  // The limbs still point as the Tauren's do.
  const point = (model, matrices) => { const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])); return id => new Vector3(...nodePivot(model, byId.get(id), id)).applyMatrix4(matrices.get(id)); };
  const mine = point(kurgan, builtMatrices(kurgan, stanced, stand, 0)), their = point(tauren, sampleNodeMatrices(tauren, tauren.Sequences[theirs].Interval[0], theirs));
  for (const key of ['armL', 'armR']) { const own = rig.parts[key].line, donor = rigT.parts[key].line, apart = mine(own[1]).sub(mine(own[0])).angleTo(their(donor[1]).sub(their(donor[0]))) * 180 / Math.PI; assert.ok(apart < 10, `${key}: with stance the upper arm is ${apart.toFixed(0)} degrees from the Tauren's`); }
});

test('R13 feet stay down: a stride and a hip lift the legs cannot follow are brought within their reach', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const kurgan = load('transfer-kurgan'), tauren = load('transfer-tauren'), walk = seqMatch(kurgan, /^walk$/i), theirs = seqMatch(tauren, /^walk$/i);
  const rig = transferRig(kurgan, { sequence: walk }), rigT = transferRig(tauren, { sequence: theirs }), { parts } = wholeBodyParts(rig, rigT);
  // As the window starts: "Keep foot on the ground" on.
  const built = buildTransfer(kurgan, new Map([['tauren', tauren]]), { base: { sequence: walk }, length: null, sources: {}, parts: take(rig, parts, 'tauren', theirs, {}) });
  assert.deepEqual(built.problems, []);
  const height = (model, matrices, id) => new Vector3(...nodePivot(model, allNodes(model).find(node => node.ObjectId === id), id)).applyMatrix4(matrices.get(id)).z;
  const feet = ['legL', 'legR'].map(key => rig.parts[key].marker), theirFeet = ['legL', 'legR'].map(key => rigT.parts[key].marker);
  let worst = 0, donorWorst = 0;
  built.times.forEach((time, k) => {
    const mine = builtMatrices(kurgan, built, walk, k), their = sampleNodeMatrices(tauren, Math.round(tauren.Sequences[theirs].Interval[0] + time), theirs);
    worst = Math.max(worst, Math.min(...feet.map(id => height(kurgan, mine, id))) - rig.ground);
    donorWorst = Math.max(donorWorst, Math.min(...theirFeet.map(id => height(tauren, their, id))) - rigT.ground);
  });
  assert.ok(donorWorst < 0.1 * rigT.hipHeight, `the Tauren always has a foot down in its Walk (${donorWorst.toFixed(1)})`);
  assert.ok(worst < 0.1 * rig.hipHeight, `the Kurgan's lower foot gets ${worst.toFixed(1)} above its standing height (hip height ${rig.hipHeight.toFixed(0)})`);
});

// Size for a body that does not stand on legs: docs/agent-tasks/xfer-transplant-fixes.md, package A.
const nodeName = (model, id) => String(allNodes(model).find(node => node.ObjectId === id)?.Name ?? '').trim();
test('S1 a body without legs has a real size: the Naga is sized by its extent and stands on its mesh floor', { skip: missing('transfer-naga') }, () => {
  const rig = transferRig(load('transfer-naga'));
  assert.equal(rig.hipMeasured, false);
  assert.ok(Math.abs(rig.extent - 233) < 2, `extent ${rig.extent}`);
  assert.ok(Math.abs(rig.hipHeight - 60.7) < 1, `stand-in hip height ${rig.hipHeight} (was 0.001)`);
  assert.ok(Math.abs(rig.ground - 3.2) < 1, `ground ${rig.ground}`);
});
test('S2 legs that do not stand are not a hip height: the Spider gets the stand-in, the Footman keeps its own', { skip: missing('transfer-spider', 'transfer-footman') }, () => {
  const spider = transferRig(load('transfer-spider')), footman = transferRig(load('transfer-footman'));
  assert.equal(spider.hipMeasured, false);
  assert.ok(Math.abs(spider.hipHeight - 56.2) < 1, `Spider hip height ${spider.hipHeight} (was 1.42)`);
  assert.equal(footman.hipMeasured, true);
  assert.ok(Math.abs(footman.hipHeight - 41.382) < 1e-3, `Footman hip height ${footman.hipHeight}`);
});
test('S3 the Felhound\'s body is the joint its legs hang from', { skip: missing('transfer-felhound') }, () => {
  const model = load('transfer-felhound'), rig = transferRig(model);
  assert.equal(nodeName(model, rig.body), 'Bone Center');
  assert.equal(Object.values(rig.parts).filter(part => part.limbKind === 'leg').length, 4, Object.keys(rig.parts).join(', ')); // 3 before R1 (front right leg unread)
  assert.equal(rig.hipMeasured, true);
  assert.ok(Math.abs(rig.hipHeight - 36.9) < 1, `hip height ${rig.hipHeight} (was 0.001)`);
});
test('S4 size ratio: extents when one body has no legs, hip heights when both stand', { skip: missing('transfer-footman', 'transfer-naga', 'transfer-grunt') }, () => {
  const footman = transferRig(load('transfer-footman')), naga = transferRig(load('transfer-naga')), grunt = transferRig(load('transfer-grunt'));
  assert.ok(Math.abs(XFER.rigSizeRatio(footman, naga) - 0.52) < 0.02, `Footman / Naga ${XFER.rigSizeRatio(footman, naga)}`);
  assert.equal(XFER.rigSizeRatio(footman, grunt), footman.hipHeight / grunt.hipHeight);
});
test('S5 a rider read alone keeps its numbers', { skip: missing('transfer-cold-one-rider', 'transfer-knight') }, () => {
  // Values from the parent commit 595082ae.
  for (const [key, hip, ground] of [['transfer-cold-one-rider', 27.71578394163012, 91.0053597893212], ['transfer-knight', 39.35223606391638, 50.75666256869438]]) {
    const rig = transferRig(load(key), { actor: 'seated' });
    assert.equal(rig.hipMeasured, true, key);
    assert.ok(Math.abs(rig.hipHeight - hip) < 1e-9 && Math.abs(rig.ground - ground) < 1e-9, `${key}: ${rig.hipHeight}, ${rig.ground}`);
  }
});
test('S6 one mesh, no legs: the Wisp and the robed Necromancer get a size from their mesh', { skip: missing('transfer-wisp', 'transfer-necromancer') }, () => {
  const wisp = transferRig(load('transfer-wisp')), necro = transferRig(load('transfer-necromancer'));
  assert.ok(Math.abs(wisp.hipHeight - 83.4) < 2, `Wisp ${wisp.hipHeight} (was 0.001)`);
  assert.equal(necro.hipMeasured, false);
  assert.ok(necro.hipHeight > 10, `Necromancer ${necro.hipHeight} (was 3.4)`);
});

// ---------------------------------------------------------------- overnight retarget sweep, 20 Nov 2026 (out/transfer-probe/overnight/retarget/classes.md)
test('W1 weapon above the ground: where no turn clears the floor, the arm is not flung a quarter turn for nothing (the Khorne knight\'s own Death)', { skip: missing('transfer-khorne-knight') }, () => {
  // The knight's axe lies on the ground in its own Death. Before, every sample whose weapon a quarter turn could not
  // bring above the floor got exactly that quarter turn, also where it brought the axe no higher.
  const knight = fresh('transfer-khorne-knight'), donor = fresh('transfer-khorne-knight'), death = seq(knight, 'Death');
  const rig = transferRig(knight, { sequence: death }), { parts } = wholeBodyParts(rig, transferRig(donor, { sequence: death }));
  const arm = Object.values(rig.parts).find(part => part.weapon && part.key === 'armR') || Object.values(rig.parts).find(part => part.weapon);
  const build = clear => buildTransfer(knight, new Map([['d', donor]]), { base: { sequence: death }, length: null, sources: {}, parts: take(rig, parts, 'd', death, { clear }) });
  const on = build(null), off = build(false);
  const lowest = (built, k) => Math.min(...arm.weapon.outline.map(p => new Vector3(...p).applyMatrix4(builtMatrices(knight, built, death, k).get(arm.marker)).z));
  let worst = null;
  for (let k = 0; k < on.times.length; k++) {
    const turn = angle(rotOf(builtMatrices(knight, on, death, k).get(arm.joints[0])), rotOf(builtMatrices(knight, off, death, k).get(arm.joints[0])));
    if (turn > 85 && (!worst || turn > worst.turn)) worst = { turn, t: on.times[k], gain: lowest(on, k) - lowest(off, k) };
  }
  assert.ok(!worst, worst && `the weapon arm turns ${worst.turn.toFixed(1)} degrees at ${worst.t} ms (the axe comes ${worst.gain.toFixed(1)} higher; floor ${rig.floor.toFixed(1)})`);
});
test('C1 a keyed camera roll is copied into the new animation as a roll, not as a quaternion', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  // A camera's Rotation is one number (its roll). Copying the body animation read every track named Rotation as a
  // quaternion: the new animation's camera keys got four values and tangents that are not numbers (other__orccar).
  const foot = fresh('transfer-footman'), grunt = load('transfer-grunt'), stand = seqMatch(foot, /^stand/i), [a, b] = foot.Sequences[stand].Interval;
  const key = (Frame, v) => ({ Frame, Vector: new Float32Array([v]), InTan: new Float32Array([v - 0.01]), OutTan: new Float32Array([v + 0.01]) });
  foot.Cameras = [{ Name: 'Portrait', Position: new Float32Array([200, 0, 80]), FieldOfView: 0.7, FarClip: 1000, NearClip: 8, TargetPosition: new Float32Array([0, 0, 60]), Rotation: { LineType: 3, GlobalSeqId: null, Keys: [key(a, 0), key(Math.round((a + b) / 2), 0.2), key(b, 0)] } }];
  const rig = transferRig(foot, { sequence: stand }), attack = seq(grunt, 'Attack - 1'), { parts } = wholeBodyParts(rig, transferRig(grunt, { sequence: attack }));
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'g', attack) };
  const { sequenceIndex } = applyTransfer(foot, buildTransfer(foot, new Map([['g', grunt]]), recipe), recipe, {});
  const [s, e] = foot.Sequences[sequenceIndex].Interval, keys = foot.Cameras[0].Rotation.Keys.filter(k => k.Frame >= s && k.Frame <= e);
  assert.ok(keys.length >= 2, `the new animation has ${keys.length} camera roll keys`);
  for (const k of keys) for (const field of ['Vector', 'InTan', 'OutTan']) {
    assert.equal(k[field].length, 1, `camera roll key at ${k.Frame} has ${k[field].length} values in ${field}`);
    assert.ok(Number.isFinite(k[field][0]), `camera roll key at ${k.Frame}: ${field} ${k[field][0]}`);
  }
});
test('L1 joints outside every part that the donor has too take its turn: the Footman given its own attack swings its sword and shield', { skip: missing('transfer-footman') }, () => {
  // The Footman's shield (handle, Box04) and sword (Box03, Cone11) are joints of their own under the hands, keyed in
  // Attack - 1. Taken whole from itself over its Stand, they kept the Stand's turn: 39 and 22 degrees off its own attack.
  const foot = fresh('transfer-footman'), donor = fresh('transfer-footman'), stand = seqMatch(foot, /^stand/i), attack = seq(donor, 'Attack - 1');
  const rig = transferRig(foot, { sequence: stand }), { parts } = wholeBodyParts(rig, transferRig(donor, { sequence: attack }));
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'd', attack) };
  const { sequenceIndex } = applyTransfer(foot, buildTransfer(foot, new Map([['d', donor]]), recipe), recipe, {});
  const [a] = foot.Sequences[sequenceIndex].Interval, [b, e] = donor.Sequences[attack].Interval, nodes = allNodes(foot);
  const local = (model, si, frame, id) => { const m = sampleNodeMatrices(model, frame, si), node = nodes.find(n => n.ObjectId === id); return rotOf(m.get(node.Parent).clone().invert().multiply(m.get(id))); };
  const joints = ['handle', 'Box04', 'Box03', 'Cone11'].map(name => nodes.find(n => n.Name === name)).filter(Boolean);
  assert.equal(joints.length, 4, 'the Footman has its sword and shield joints');
  for (const node of joints) {
    let worst = 0;
    for (let f = b; f <= e; f += 100) worst = Math.max(worst, angle(local(foot, sequenceIndex, a + f - b, node.ObjectId), local(donor, attack, f, node.ObjectId)));
    assert.ok(worst < 1, `${node.Name} turns ${worst.toFixed(1)} degrees away from the Footman's own Attack - 1`);
  }
});
test('L1 a clip added after, from another donor, reads that donor\'s own joints (the Footman\'s sword after its own attack, then the Grunt\'s)', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  // The sword joint follows the Footman's own Attack - 1 in the first clip. In the Grunt's clip after it, the Grunt has
  // no such joint: the sword keeps the body animation, and never takes a Grunt joint that has the same number.
  const foot = fresh('transfer-footman'), self = fresh('transfer-footman'), grunt = load('transfer-grunt'), base = seqMatch(foot, /^stand/i), rig = transferRig(foot, { sequence: base });
  const own = seq(self, 'Attack - 1'), theirs = seq(grunt, 'Attack - 1'), sources = new Map([['f', self], ['g', grunt]]);
  const sword = allNodes(foot).find(n => n.Name === 'Cone11'), length = self.Sequences[own].Interval[1] - self.Sequences[own].Interval[0], start = length - 150;
  const arm = extra => ({ ...defaultTransferPart(rig, 'armL'), source: 'f', sequence: own, blend: 0, ...extra });
  const built = buildTransfer(foot, sources, { base: { sequence: base }, length: null, sources: {}, parts: { armL: arm({ next: [arm({ source: 'g', sequence: theirs, start, blend: 150 })] }) } });
  const dense = built.tracks.get(sword.ObjectId)?.Rotation;
  assert.ok(dense, 'the sword joint is driven in the first clip');
  const [b0] = foot.Sequences[base].Interval, baseLength = foot.Sequences[base].Interval[1] - b0;
  built.times.forEach((t, k) => {
    if (t < start + 200) return;
    const mine = new Quaternion().fromArray(dense, k * 4), body = new Quaternion().fromArray(sampleTrack(sword.Rotation, b0 + (t * built.baseClock.rate) % baseLength, { interval: foot.Sequences[base].Interval, fallback: [0, 0, 0, 1], quaternion: true }));
    assert.ok(angle(mine, body) < 1, `at ${t} ms, in the Grunt's clip, the sword is ${angle(mine, body).toFixed(1)} degrees from the body animation`);
  });
});
test('D1 hips held down for a planted foot stay down when no donor foot is on the ground (the Footman taking the Shadow Hunter\'s Walk)', { skip: missing('transfer-footman', 'transfer-shadow-hunter') }, () => {
  // The Shadow Hunter's hips stand far higher in its Walk than in its Stand; the Footman's hips come down for its
  // planted feet. At the moments neither of the Shadow Hunter's feet is down they went back up: 50 -> 140 for one frame.
  const foot = fresh('transfer-footman'), hunter = load('transfer-shadow-hunter'), stand = seqMatch(foot, /^stand/i), walk = seqMatch(hunter, /^walk$/i);
  const rig = transferRig(foot, { sequence: stand }), { parts } = wholeBodyParts(rig, transferRig(hunter, { sequence: walk }));
  assert.ok(parts.includes('hips') && parts.includes('legL'), 'hips and legs are taken');
  const built = buildTransfer(foot, new Map([['h', hunter]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'h', walk) });
  const heights = built.times.map((_, k) => pivotAt(foot, builtMatrices(foot, built, stand, k), rig.body).z);
  const steps = heights.slice(1).map((z, k) => Math.abs(z - heights[k])), worst = Math.max(...steps), at = built.times[steps.indexOf(worst) + 1];
  assert.ok(worst < 0.25 * rig.hipHeight, `the Footman's body jumps ${worst.toFixed(1)} in one 33 ms step at ${at} ms (hip height ${rig.hipHeight.toFixed(1)})`);
  // A looping walk: the end meets the start.
  assert.ok(Math.abs(heights.at(-1) - heights[0]) < 0.1 * rig.hipHeight, `the walk's seam opens by ${Math.abs(heights.at(-1) - heights[0]).toFixed(1)}`);
});
test('P1 weapon above the ground: the lift does not swing the arm the other way for a frame (Hellscream taking the Archnathid\'s attack)', { skip: missing('transfer-hellscream', 'transfer-archnathid') }, () => {
  // The axis a lift turns about followed each sample's lowest weapon point; when that is the other end of the axe a
  // sample later, the weapon arm swung one way and back: 127 degrees in one 33 ms step. Both hands off, so the lift alone moves it.
  const orc = fresh('transfer-hellscream'), bug = load('transfer-archnathid'), stand = seqMatch(orc, /^stand/i), attack = seq(bug, 'Attack -2');
  const rig = transferRig(orc, { sequence: stand }), { parts } = wholeBodyParts(rig, transferRig(bug, { sequence: attack }));
  const arm = rig.parts.armR;
  assert.ok(arm?.weapon && parts.includes('armR'), 'the weapon arm is taken');
  const built = buildTransfer(orc, new Map([['b', bug]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'b', attack, { grip: false }) });
  let worst = 0, at = 0, prev = null;
  built.times.forEach((t, k) => { const q = rotOf(builtMatrices(orc, built, stand, k).get(arm.joints[0])); if (prev) { const d = angle(q, prev); if (d > worst) { worst = d; at = t; } } prev = q; });
  assert.ok(worst < 60, `the weapon arm turns ${worst.toFixed(1)} degrees in one 33 ms step at ${at} ms`);
  // and the axe still stays above the floor wherever the lift reaches it
  const lowest = k => Math.min(...arm.weapon.outline.map(p => new Vector3(...p).applyMatrix4(builtMatrices(orc, built, stand, k).get(arm.marker)).z));
  const under = Math.max(...built.times.map((_, k) => rig.floor - lowest(k)));
  assert.ok(under < 0.05 * rig.hipHeight, `the axe goes ${under.toFixed(1)} under the floor`);
});
test('G1 both hands on the weapon: the gripping arm does not turn over from one moment to the next (the Kurgan taking the Grunt\'s attack)', { skip: missing('transfer-kurgan', 'transfer-grunt') }, () => {
  // The gripping arm's solve started from the transferred pose, which can point far from the grip and turn fast; with
  // the handle passing through the shoulder it folded every joint to the limit. The Kurgan's left arm turned 135
  // degrees in one 33 ms step and its elbow's bend plane 128.
  const kurgan = load('transfer-kurgan'), grunt = load('transfer-grunt'), stand = seqMatch(kurgan, /^stand/i), attack = seq(grunt, 'Attack - 1');
  const rig = transferRig(kurgan, { sequence: stand }), { parts } = wholeBodyParts(rig, transferRig(grunt, { sequence: attack }));
  const weapon = Object.values(rig.parts).find(part => part.weapon?.grip), arm = weapon && rig.parts[weapon.weapon.grip.arm];
  assert.ok(arm, 'the Kurgan holds its hammer with both hands');
  const built = buildTransfer(kurgan, new Map([['g', grunt]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'g', attack) });
  let turn = 0, plane = 0, at = 0, prev = null;
  built.times.forEach((t, k) => {
    const m = builtMatrices(kurgan, built, stand, k), p = arm.joints.slice(-3).map(id => pivotAt(kurgan, m, id)), q = rotOf(m.get(arm.joints[0]));
    const normal = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[1]));
    if (prev) { const d = angle(q, prev.q); if (d > turn) { turn = d; at = t; } if (normal.length() > 1e-6 && prev.normal.length() > 1e-6) plane = Math.max(plane, normal.angleTo(prev.normal) * 180 / Math.PI); }
    prev = { q, normal };
  });
  assert.ok(turn < 90, `the gripping arm turns ${turn.toFixed(1)} degrees in one 33 ms step at ${at} ms`);
  assert.ok(plane < 90, `its elbow's bend plane turns ${plane.toFixed(1)} degrees in one 33 ms step`);
});
test('K1 a looping clip with the hips taken plays at its own speed: the result is whole loops of it (the Footman taking the Shadow Hunter\'s Walk over its Stand)', { skip: missing('transfer-footman', 'transfer-shadow-hunter') }, () => {
  // The result took the longer of the body animation and the clip and fitted the clip into it in whole loops: the
  // Shadow Hunter's 800 ms walk over the Footman's 1,500 ms Stand played at 1.07 of its speed (over 1,167 ms at 0.69).
  const foot = load('transfer-footman'), hunter = load('transfer-shadow-hunter'), stand = seqMatch(foot, /^stand/i), walk = seqMatch(hunter, /^walk$/i);
  const rig = transferRig(foot, { sequence: stand }), { parts } = wholeBodyParts(rig, transferRig(hunter, { sequence: walk }));
  const built = buildTransfer(foot, new Map([['h', hunter]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, parts, 'h', walk) });
  const clip = hunter.Sequences[walk].Interval[1] - hunter.Sequences[walk].Interval[0], loops = built.length / clip;
  assert.ok(Math.abs(loops - Math.round(loops)) < 0.01, `the result is ${built.length} ms: ${loops.toFixed(3)} loops of the ${clip} ms walk`);
  assert.equal(built.nonLooping, false);
  // Arms only (the body animation carries the body): unchanged, the clip is fitted to the body animation as before.
  const arms = buildTransfer(foot, new Map([['h', hunter]]), { base: { sequence: stand }, length: null, sources: {}, parts: take(rig, ['armL', 'armR'], 'h', walk) });
  assert.equal(arms.length, foot.Sequences[stand].Interval[1] - foot.Sequences[stand].Interval[0]);
});

// R1 (docs/agent-tasks/xfer-overnight.md): legs the shared recogniser missed or called arms.
const legsBySide = rig => { const legs = Object.values(rig.parts).filter(part => part.limbKind === 'leg'); return { L: legs.filter(p => p.side === 'L').length, R: legs.filter(p => p.side === 'R').length, keys: Object.keys(rig.parts).join(', ') }; };
test('L1 four-footed rigs read four legs, two each side: a paw holding a Hand ref, an unnamed twin of a named leg', { skip: missing('transfer-direwolf', 'transfer-zergling', 'transfer-felhound', 'transfer-grizzly', 'transfer-rabbit') }, () => {
  for (const key of ['transfer-direwolf', 'transfer-zergling', 'transfer-felhound', 'transfer-grizzly', 'transfer-rabbit']) {
    const model = load(key), rig = transferRig(model), legs = legsBySide(rig);
    assert.deepEqual([legs.L, legs.R], [2, 2], `${key}: ${legs.keys}`);
    const walkingArms = Object.values(rig.parts).filter(part => part.limbKind === 'arm' && part.joints.some(id => /leg|paw|foot/i.test(nodeName(model, id))));
    assert.equal(walkingArms.length, 0, `${key}: a leg read as an arm: ${walkingArms.map(p => p.key)}`);
    const stand = Math.max(0, standSequenceIndex(model)), pose = suggestPoseRig(model, model.Sequences[stand].Interval[0], stand);
    assert.equal(pose.chains.filter(chain => chain.kind === 'leg' && chain.label !== 'Wing').length, 4, `${key}: POSE legs`);
  }
});
test('L2 legs of one or two joints: the pig, the sheep, the seal and the rat read four legs', { skip: missing('transfer-pig', 'transfer-sheep', 'transfer-seal', 'transfer-rat') }, () => {
  for (const key of ['transfer-pig', 'transfer-sheep', 'transfer-seal', 'transfer-rat']) {
    const model = load(key), rig = transferRig(model), legs = legsBySide(rig);
    assert.deepEqual([legs.L, legs.R], [2, 2], `${key}: ${legs.keys}`);
    // A leg is its own joints, never the body or a joint another leg hangs from.
    for (const part of Object.values(rig.parts).filter(p => p.limbKind === 'leg')) assert.ok(!part.joints.includes(rig.body), `${key} ${part.key} holds the body`);
    const shared = Object.values(rig.parts).filter(p => p.limbKind === 'leg').flatMap(p => p.joints);
    assert.equal(new Set(shared).size, shared.length, `${key}: a joint in two legs`);
    assert.equal(rig.hipMeasured, true, key);
  }
});
test('L3 the HD Footman: arms end at its hands, legs at its feet, one body', { skip: missing('forge-hd-footman') }, () => {
  const model = load('forge-hd-footman'), rig = transferRig(model), names = key => rig.parts[key]?.joints.map(id => nodeName(model, id)) || [];
  assert.ok(names('legL').includes('L_leg_02_bind_jnt') && names('legR').includes('R_leg_02_bind_jnt'), `legs ${names('legL')} | ${names('legR')}`);
  assert.ok(names('armL').includes('bone_hand_left') && names('armR').includes('bone_hand_right'), `arms ${names('armL')} | ${names('armR')}`);
  assert.equal(Object.values(rig.parts).filter(part => part.limbKind === 'leg').length, 2, Object.keys(rig.parts).join(', '));
  assert.ok(rig.parts.chest && rig.parts.head, Object.keys(rig.parts).join(', '));
  assert.deepEqual(rig.actors, ['both'], 'one creature');
});
test('L4 a limb starts below the joint its twin hangs from too: the Wyvern Rider\'s legs leave the hip, its right arm the chest', { skip: missing('transfer-wyvern-rider') }, () => {
  const model = load('transfer-wyvern-rider'), rig = transferRig(model), names = key => rig.parts[key]?.joints.map(id => nodeName(model, id)).join('>');
  assert.equal(names('legL'), 'Bone25>Bone26>Bone27');
  assert.equal(names('legR'), 'Bone28>Bone29>Bone30');
  assert.equal(names('armR'), 'Bone07>Bone08');
  assert.equal(names('armL'), 'Bone09>Bone10');
  assert.equal(names('chest'), 'Bone_chest');
});

test('R10 legs pair as a left/right pair, the bend with the donor\'s knee: the Footman taking the Lord of Change\'s stand bends both knees at its knees', { skip: missing('transfer-footman', 'transfer-lord-of-change') }, () => {
  // The Lord of Change's legs have a hock (hip, knee, hock, foot); the Footman's have three joints. Scored leg by
  // leg, a near tie paired the Footman's left knee with the hock and its right knee with the knee (XFER row 10).
  const foot = load('transfer-footman'), loc = load('transfer-lord-of-change'), stand = seqMatch(foot, /^stand/i), theirs = seqMatch(loc, /^stand/i);
  const rig = transferRig(foot, { sequence: stand }), rigT = transferRig(loc, { sequence: theirs }), { parts } = wholeBodyParts(rig, rigT);
  const built = buildTransfer(foot, new Map([['loc', loc]]), { base: { sequence: stand }, length: null, sources: { loc: { mirror: false } }, parts: take(rig, parts, 'loc', theirs, { match: 1, plant: false, grip: false, clear: false }) });
  const point = (model, matrices) => { const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])); return id => new Vector3(...nodePivot(model, byId.get(id), id)).applyMatrix4(matrices.get(id)); };
  const mine = point(foot, builtMatrices(foot, built, stand, 0)), their = point(loc, sampleNodeMatrices(loc, loc.Sequences[theirs].Interval[0], theirs));
  const apart = (a, b, c, d) => mine(b).sub(mine(a)).angleTo(their(d).sub(their(c))) * 180 / Math.PI;
  for (const key of ['legL', 'legR']) {
    const own = rig.parts[key].joints, donor = rigT.parts[key].joints;
    assert.deepEqual([own.length, donor.length], [3, 4]);
    assert.ok(apart(own[0], own[1], donor[0], donor[1]) < 10, `${key}: the thigh is ${apart(own[0], own[1], donor[0], donor[1]).toFixed(0)} degrees from the Lord of Change's hip-to-knee`);
  }
});

test('H3 the Far Seer\'s tail is its tail: the wolf\'s waist, which carries the rider, stays out of it (a tail climbing to the trunk swallowed Bone Wolf Waist, so every other tail took the wolf\'s back)', { skip: missing('transfer-far-seer') }, () => {
  const model = load('transfer-far-seer');
  const rig = transferRig(model);
  const name = new Map(allNodes(model).map(node => [node.ObjectId, node.Name]));
  const tail = Object.values(rig.parts).find(part => part.limbKind === 'tail');
  assert.ok(tail, 'a tail is read');
  assert.equal(name.get(tail.joints[0]), 'Bone Tail 1');
  assert.ok(!tail.joints.some(id => name.get(id) === 'Bone Wolf Waist'), `the tail holds ${tail.joints.map(id => name.get(id)).join(' > ')}`);
});

// Cross-kind r2 WG1 (docs/agent-tasks/xfer-overnight.md): wings the shared recogniser read as arms.
test('WG1 dragons\' wings are wings: the Green Dragon, the Bronze Whelp and the Frost Wyrm read two wings and no arms (a skin sheet on the joint the legs hang from, or one with wing-named skin); the Gargoyle\'s and the harpy\'s arms, which end in named hands, stay arms', { skip: missing('transfer-green-dragon', 'transfer-bronze-whelp', 'transfer-frost-wyrm', 'transfer-gargoyle', 'transfer-harpy', 'transfer-footman') }, () => {
  const count = (rig, kind) => Object.values(rig.parts).filter(part => part.limbKind === kind).length;
  for (const key of ['transfer-green-dragon', 'transfer-bronze-whelp', 'transfer-frost-wyrm']) {
    const rig = transferRig(load(key));
    assert.deepEqual([count(rig, 'wing'), count(rig, 'arm')], [2, 0], `${key}: ${Object.keys(rig.parts).join(', ')}`);
    assert.ok(rig.parts.wingL && rig.parts.wingR, `${key}: ${Object.keys(rig.parts).join(', ')}`);
  }
  for (const key of ['transfer-gargoyle', 'transfer-harpy', 'transfer-footman']) {
    const rig = transferRig(load(key));
    assert.deepEqual([count(rig, 'arm'), count(rig, 'wing')], [2, 0], `${key}: ${Object.keys(rig.parts).join(', ')}`);
  }
});

test('RG1 the Ghoul\'s and the murloc\'s arms end at their moving hands, not at the still forearm skin bones parked in the chest', { skip: missing('transfer-ghoul', 'transfer-murloc') }, () => {
  // Wrist1/Wrist2 carry the forearm skin, have no keys and sit in the chest at bind; Bone_Hand_R/L beside them move. Read as
  // the arm's end, the forearm pointed from the elbow into the chest in Retarget (the transplant had its own reading for it).
  for (const key of ['transfer-ghoul', 'transfer-murloc']) {
    const model = load(key), rig = transferRig(model), names = part => rig.parts[part].joints.map(id => nodeName(model, id)).join('>');
    assert.equal(names('armR'), 'Bone_Arm1_R>Bone_Arm2_R>Bone_Hand_R', key);
    assert.equal(names('armL'), 'Bone_Arm1_L>Bone_Arm2_L>Bone_Hand_L', key);
    assert.equal(nodeName(model, rig.parts.armR.marker), 'Bone_Hand_R', key);
    assert.equal(nodeName(model, rig.parts.armR.line.at(-1)), 'Bone_Hand_R', `${key}: the arm's line ends at the hand`);
  }
});
test('RG1 the Footman taking the Ghoul\'s Stand with Pose at Theirs lays its forearm along the Ghoul\'s elbow-to-hand line', { skip: missing('transfer-ghoul', 'transfer-footman') }, () => {
  const foot = load('transfer-footman'), ghoul = load('transfer-ghoul'), stand = seqMatch(foot, /^stand/i), theirs = seqMatch(ghoul, /^stand/i);
  const rig = transferRig(foot, { sequence: stand }), rigT = transferRig(ghoul, { sequence: theirs });
  const built = buildTransfer(foot, new Map([['g', ghoul]]), { base: { sequence: stand }, length: null, sources: { g: { mirror: false } }, parts: take(rig, ['hips', 'chest', 'armL', 'armR'], 'g', theirs, { match: 1, plant: false, grip: false }) });
  const point = (model, matrices) => { const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])); return id => new Vector3(...nodePivot(model, byId.get(id), id)).applyMatrix4(matrices.get(id)); };
  const mine = point(foot, builtMatrices(foot, built, stand, 0)), their = point(ghoul, sampleNodeMatrices(ghoul, ghoul.Sequences[theirs].Interval[0], theirs));
  const named = (model, name) => allNodes(model).find(node => node.Name === name).ObjectId;
  for (const key of ['armL', 'armR']) {
    const line = rig.parts[key].line, side = key.at(-1);
    const forearm = mine(line.at(-1)).sub(mine(line.at(-2))), ghoulForearm = their(named(ghoul, `Bone_Hand_${side}`)).sub(their(named(ghoul, `Bone_Arm2_${side}`)));
    const off = forearm.angleTo(ghoulForearm) * 180 / Math.PI;
    assert.ok(off < 20, `${key}: the forearm is ${off.toFixed(0)} degrees from the Ghoul's elbow-to-hand line`);
  }
});
test('RG2 the Steam Tank stands on no legs: its commander\'s arms hang down over the wheels and are arms', { skip: missing('transfer-steamtank') }, () => {
  const model = load('transfer-steamtank'), rig = transferRig(model), names = part => rig.parts[part]?.joints.map(id => nodeName(model, id)).join('>');
  assert.equal(Object.values(rig.parts).filter(part => part.limbKind === 'leg').length, 0, Object.keys(rig.parts).join(', '));
  assert.equal(names('armL'), 'Commander_L_Shoulder>Commander_L_Elbow>Baton');
  assert.equal(names('armR'), 'Commander_R_Shoulder>Commander_R_Elbow>Pistol');
  assert.equal(names('chest'), 'Commander_Chest');
  const stand = Math.max(0, standSequenceIndex(model)), pose = suggestPoseRig(model, model.Sequences[stand].Interval[0], stand);
  assert.equal(pose.chains.filter(chain => chain.kind === 'leg').length, 0, 'POSE legs');
});
test('RG3 the Hydralisk rests on its tail: the Foot refs Blizzard put on the tail make no leg', { skip: missing('transfer-hydralisk') }, () => {
  const model = load('transfer-hydralisk'), rig = transferRig(model);
  assert.equal(Object.values(rig.parts).filter(part => part.limbKind === 'leg').length, 0, Object.keys(rig.parts).join(', '));
  assert.ok(rig.parts.armL && rig.parts.armR && rig.parts.chest && rig.parts.head, Object.keys(rig.parts).join(', '));
  const stand = Math.max(0, standSequenceIndex(model)), pose = suggestPoseRig(model, model.Sequences[stand].Interval[0], stand);
  assert.equal(pose.chains.filter(chain => chain.kind === 'leg').length, 0, 'POSE legs');
});
test('RG4 the Snapdragon reads four legs: of the back left shin and its copy at the same place, the copy that carries the toe', { skip: missing('transfer-snapdragon') }, () => {
  const model = load('transfer-snapdragon'), rig = transferRig(model), legs = legsBySide(rig);
  assert.deepEqual([legs.L, legs.R], [2, 2], legs.keys);
  const back = Object.values(rig.parts).find(part => part.limbKind === 'leg' && part.joints.some(id => nodeName(model, id) === 'Bone Back L Leg'));
  assert.equal(back.joints.map(id => nodeName(model, id)).join('>'), 'Bone Back L Leg>Bone Back L ShinX>Bone Object67');
});
test('H7 the Witch Hunter\'s left arm is its two joints: ShoulderL > LowArmL to the hand ref, and the chest stays the chest (the arm was read Bone_Chest > ShoulderL > LowArmL, so the rig had no chest)', { skip: missing('transfer-witch-hunter') }, () => {
  const model = load('transfer-witch-hunter'), rig = transferRig(model), names = part => rig.parts[part]?.joints.map(id => nodeName(model, id)).join('>');
  assert.equal(names('armL'), 'ShoulderL>LowArmL');
  assert.equal(rig.parts.armL.line.map(id => String(nodeName(model, id)).trim()).join('>'), 'ShoulderL>LowArmL>Hand Left Ref', 'read as the Footman\'s right arm is: two joints, the line on to the hand ref');
  assert.equal(names('armR'), 'ShoulderR>LowArmR>HandR');
  assert.equal(names('chest'), 'Bone_Chest');
  const stand = Math.max(0, standSequenceIndex(model)), pose = suggestPoseRig(model, model.Sequences[stand].Interval[0], stand);
  assert.ok(!pose.chains.some(chain => nodeName(model, chain.root) === 'Bone_Chest'), 'no POSE limb starts at the chest');
});

test('HR1 the HD Forsaken Paladin\'s limbs are read through the joints that bend them: each leg hip > knee > foot (leg_*0_0 > leg_*0_2 > foot), each arm upper arm > elbow > wrist, both sides at the same joints, and no second limb from the foot and hand refs on its ankles and wrists (its last three joints have a stretch of nearly no length, 0.4 on a 37 leg: a leg was read from the ankle down, the hip and knee above it as a girdle, and the two legs paired at different joints)', { skip: missing('transfer-forsaken-paladin') }, () => {
  const model = load('transfer-forsaken-paladin'), stand = Math.max(0, standSequenceIndex(model));
  const pose = suggestPoseRig(model, model.Sequences[stand].Interval[0], stand), name = id => String(nodeName(model, id)).trim();
  const lines = pose.chains.map(chain => [chain.root, chain.middle, chain.end].map(name).join('>')).sort();
  assert.deepEqual(lines, ['arm_L0_0_jnt>arm_L0_2_jnt>arm_L0_end_jnt', 'arm_R0_0_jnt>arm_R0_2_jnt>arm_R0_end_jnt', 'leg_L0_0_jnt>leg_L0_2_jnt>foot_L0_0_jnt', 'leg_R0_0_jnt>leg_R0_2_jnt>foot_R0_0_jnt']);
  const rig = transferRig(model), legs = Object.values(rig.parts).filter(part => part.limbKind === 'leg');
  assert.equal(legs.length, 2, 'two legs');
  for (const leg of legs) assert.equal(name(leg.line[0]), name(leg.joints[0]), `the ${leg.key} line starts at its hip`);
});
