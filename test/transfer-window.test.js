// The Transfer window's pure helpers (src/transfer-window.js): chip order, mirrored
// donor parts, and POSE handles to parts and back, on the real story models.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { transferRig } from '../src/anim-transfer.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { addAllPlan, bodyAnimationFor, chipOrder, donorPartKey, handlePart, jointPath, partHandle, pathMarker, rigFor, sourcePartKey, takenPoseConfig, takenSummary, wholeBodyParts } from '../src/transfer-window.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = (...keys) => { const absent = keys.filter(key => { const file = fixturePath(key); return !file || !fs.existsSync(file); }); return absent.length ? `private test model not on this machine: ${absent.join(', ')}` : false; };
const load = key => { const b = fs.readFileSync(fixturePath(key)); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const rigAndPose = model => { const rig = transferRig(model); return { rig, pose: suggestPoseRig(model, rig.reference.frame, Math.max(0, rig.reference.sequence)) }; };

test('chips read Head, Chest, Hips, arms, legs, wings, tail; extra limbs follow their kind', () => {
  assert.deepEqual(chipOrder(['legR', 'wingL', 'hips', 'armR', 'tail', 'head', 'armL2', 'armL', 'chest', 'legL', 'wingR']),
    ['head', 'chest', 'hips', 'armL', 'armL2', 'armR', 'legL', 'legR', 'wingL', 'wingR', 'tail']);
});

test('a mirrored donor feeds each side from the other; trunk parts stay', () => {
  assert.equal(donorPartKey('armL', true), 'armR');
  assert.equal(donorPartKey('legR2', true), 'legL2');
  assert.equal(donorPartKey('wingL', true), 'wingR');
  assert.equal(donorPartKey('hips', true), 'hips');
  assert.equal(donorPartKey('armL', false), 'armL');
});

test('every part has a handle, and that handle leads back to the part', { skip: missing('transfer-footman', 'transfer-grunt', 'transfer-lord-of-change') }, () => {
  for (const key of ['transfer-footman', 'transfer-grunt', 'transfer-lord-of-change']) {
    const { rig, pose } = rigAndPose(load(key));
    for (const part of Object.keys(rig.parts)) {
      const handle = partHandle(rig, pose, part);
      assert.ok(handle, `${key} ${part} has a handle`);
      assert.equal(handlePart(rig, pose, handle), part, `${key} ${part}: ${JSON.stringify(handle)}`);
    }
  }
});

test('story B: the Grunt weapon-hand handle is its Left arm; the Footman body handle is Hips', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const grunt = rigAndPose(load('transfer-grunt')), foot = rigAndPose(load('transfer-footman'));
  const hand = grunt.pose.chains.find(chain => chain.end === 36);
  assert.equal(handlePart(grunt.rig, grunt.pose, { kind: 'endpoint', key: hand.key }), 'armL');
  assert.equal(handlePart(grunt.rig, grunt.pose, { kind: 'bend', key: hand.key }), 'armL', 'the elbow handle belongs to the same arm');
  assert.equal(handlePart(foot.rig, foot.pose, { kind: 'body' }), 'hips');
  assert.equal(handlePart(foot.rig, foot.pose, null), null);
});

test('takenSummary changes with a part\'s source or animation, not with its sliders', () => {
  const recipe = { sources: {}, parts: { armL: { source: 'a', sequence: 1, amount: 1 } } };
  assert.equal(takenSummary(recipe), takenSummary({ ...recipe, parts: { armL: { ...recipe.parts.armL, amount: 0.5 } } }));
  assert.notEqual(takenSummary(recipe), takenSummary({ ...recipe, parts: { armL: { ...recipe.parts.armL, sequence: 2 } } }));
});

test('Other side and the donor Mirror combine: each flips the side once', () => {
  assert.equal(sourcePartKey('armL', false, false), 'armL');
  assert.equal(sourcePartKey('armL', false, true), 'armR');
  assert.equal(sourcePartKey('armL', true, false), 'armR');
  assert.equal(sourcePartKey('armL', true, true), 'armL');
  assert.equal(sourcePartKey('head', true, true), 'head');
});

test('Take whole body on the Knight from the Grunt leaves hips and legs out, with the sentence', { skip: missing('transfer-knight', 'transfer-grunt') }, () => {
  const knight = load('transfer-knight'), grunt = load('transfer-grunt'), attack = grunt.Sequences.findIndex(s => s.Name === 'Attack - 1');
  const { parts, reason } = wholeBodyParts(rigFor(knight, 0), rigFor(grunt, attack));
  assert.ok(parts.length > 0 && !parts.includes('hips') && !parts.some(key => /^leg/.test(key)), parts.join(','));
  assert.match(reason, /different number of legs/);
  const foot = load('transfer-footman'), same = wholeBodyParts(rigFor(foot, 0), rigFor(grunt, attack));
  assert.equal(same.reason, '');
  assert.ok(same.parts.includes('hips'));
});

test('the drawn hand path follows the animation and its dot follows the time', { skip: missing('transfer-grunt') }, () => {
  const grunt = load('transfer-grunt'), attack = grunt.Sequences.findIndex(s => s.Name === 'Attack - 1'), rig = rigFor(grunt, attack);
  const path = jointPath(grunt, attack, rig.parts.armL.marker);
  assert.equal(path.frames.length, path.points.length);
  assert.ok(path.points.length > 10);
  const span = Math.max(...[0, 1, 2].map(a => Math.max(...path.points.map(p => p[a])) - Math.min(...path.points.map(p => p[a]))));
  assert.ok(span > 20, `the swinging hand travels ${span.toFixed(1)} units`);
  assert.equal(pathMarker(path.frames, path.frames[5] + 1), 5);
});

test('the result view gets handles for taken parts only, and none when nothing is taken', { skip: missing('transfer-footman') }, () => {
  const { rig, pose } = rigAndPose(load('transfer-footman'));
  assert.equal(takenPoseConfig(pose, rig, []), null);
  const arm = takenPoseConfig(pose, rig, ['armL']);
  assert.equal(arm.chains.length, 1);
  assert.equal(handlePart(rig, pose, { kind: 'endpoint', key: arm.chains[0].key }), 'armL');
  assert.equal(arm.body, -1);
  assert.deepEqual(arm.nodes, []);
  const body = takenPoseConfig(pose, rig, ['hips', 'head']);
  assert.equal(body.body, pose.body);
  assert.equal(body.chains.length, 0);
  assert.ok(body.nodes.every(id => rig.parts.head.joints.includes(id) || rig.parts.hips.joints.includes(id)));
});

test('Add all: every new donor animation, Decay and Portrait and names the model has left out, each over its kind of body animation', { skip: missing('transfer-footman', 'transfer-lord-of-change') }, () => {
  const lord = load('transfer-lord-of-change'), foot = load('transfer-footman'), name = (m, i) => m.Sequences[i].Name;
  const stand = lord.Sequences.findIndex(s => s.Name === 'Stand'), defend = foot.Sequences.findIndex(s => s.Name === 'Stand Defend');
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: { armL: { source: 'foot', sequence: defend, amount: 0.8 }, head: { source: 'other', sequence: 3 } } };
  const { clips } = addAllPlan(lord, foot, 'foot', recipe, stand);
  const names = clips.map(clip => clip.name), have = new Set(lord.Sequences.map(s => s.Name.toLowerCase()));
  assert.ok(names.length > 5, names.join(', '));
  assert.ok(names.every(n => !/decay|portrait/i.test(n) && !have.has(n.toLowerCase())), names.join(', '));
  assert.ok(!names.includes('Death'), 'the Lord of Change already has Death');
  for (const clip of clips) {
    assert.equal(name(foot, clip.sequence), clip.name);
    assert.equal(clip.recipe.parts.armL.sequence, clip.sequence, 'the part from this source points at the clip');
    assert.equal(clip.recipe.parts.armL.amount, 0.8, 'with the same slider values');
    assert.deepEqual(clip.recipe.parts.head, recipe.parts.head, 'parts from other sources stay as they are');
  }
  const body = n => name(lord, clips.find(clip => clip.name === n).recipe.base.sequence);
  assert.equal(body('Walk Defend'), 'Walk', 'Walk Defend plays over the Walk');
  assert.equal(body('Attack - 1'), 'Attack', 'Attack - 1 plays over the plain Attack');
  assert.equal(body('Stand Victory'), 'Stand');
  assert.equal(addAllPlan(lord, foot, 'nobody', recipe, stand).clips.length, 0, 'nothing taken from that source, nothing to add');
});

test('bodyAnimationFor: exact name, else the plain animation of the same kind, else the chosen one', () => {
  const model = { Sequences: ['Stand', 'Walk Defend', 'Walk', 'Attack Slam', 'Attack - 2', 'Spell'].map(Name => ({ Name, Interval: [0, 1] })) };
  assert.equal(bodyAnimationFor(model, 'Walk Defend', 0), 1);
  assert.equal(bodyAnimationFor(model, 'Walk Fast', 0), 2);
  assert.equal(bodyAnimationFor(model, 'Attack Slam', 0), 3);
  assert.equal(bodyAnimationFor(model, 'Attack - 1', 0), 4);
  assert.equal(bodyAnimationFor(model, 'Death', 5), 5);
});
