// Transfer (XFER) engine acceptance on real models: docs/agent-tasks/transfer-xl.md
// "Engine acceptance". The models live in the private test-model collection, so
// each test skips with the reason when its model is not on this machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Quaternion, Vector3 } from 'three';
import { parseCompatibleMdx, generateCompatibleMdx } from '../src/mdx-compatibility.js';
import { allNodes, composeNodeMatrices, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack, visitTracks } from '../src/animation.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { applyTransfer, buildTransfer, defaultTransferPart, transferNodeTracks, transferPreviewModel, transferRig } from '../src/anim-transfer.js';

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
  else frame = interval[0] + Math.min(clock.length, t);
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
  const recipe = { base: { sequence: attack }, length: null, sources: { self: { mirror: true } }, parts: wholeBody(foot, 'self', attack) };
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
