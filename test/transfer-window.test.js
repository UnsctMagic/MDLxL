// The Transfer window's pure helpers (src/transfer-window.js): chip order, mirrored
// donor parts, and POSE handles to parts and back, on the real story models.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { transferRig } from '../src/anim-transfer.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { addAllPlan, bodyAnimationFor, chipOrder, clipBlocks, clipLanes, dropPoint, parseSetup, recipeFromSetup, setupFromRecipe, donorPartKey, handlePart, jointPath, partHandle, pathMarker, rigFor, sourcePartKey, takenPoseConfig, takenSummary, wholeBodyParts } from '../src/transfer-window.js';

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

test('clip lanes: parts sharing source, animation, Delay and Speed share a lane; fixes and Ease ride along', () => {
  const parts = {
    armL: { source: 'grunt', sequence: 2, start: 0, speed: 1, blend: 150, fixes: [{ time: 400 }, { time: 'x' }] },
    armR: { source: 'grunt', sequence: 2, start: 0, speed: 1, blend: 0 },
    head: { source: 'self', sequence: 5, start: 200, speed: 0.5, loop: true },
    chest: { source: 'grunt', sequence: 2, start: 100, speed: 1 },
  };
  const lanes = clipLanes(parts, part => ({ length: part.source === 'grunt' ? 1000 : 800, looping: part.source !== 'grunt' }), ['head', 'chest', 'armL', 'armR']);
  assert.deepEqual(lanes.map(lane => lane.keys), [['head'], ['chest'], ['armL', 'armR']]);
  const arms = lanes[2];
  assert.equal(arms.span, 1000); assert.equal(arms.blend, 150); assert.equal(arms.looping, false);
  assert.deepEqual(arms.fixes, [{ key: 'armL', index: 0, time: 400 }]);
  assert.equal(lanes[0].span, 1600, 'half speed doubles the clip');
  assert.equal(lanes[0].looping, true);
});

test('clip blocks: a play-once clip is one block, a looping one repeats from its Delay, both cut at the end', () => {
  assert.deepEqual(clipBlocks(300, 1000, false, 1000), [{ from: 300, to: 1000 }]);
  assert.deepEqual(clipBlocks(1200, 1000, false, 1000), []);
  assert.deepEqual(clipBlocks(200, 500, true, 1300), [{ from: 200, to: 700 }, { from: 700, to: 1200 }, { from: 1200, to: 1300 }]);
});

test('dropPoint: the nearer hit on the sphere around the root, else the plane through the end facing the camera', () => {
  const root = [0, 0, 0], end = [10, 0, 0];
  const hit = dropPoint({ origin: [0, -50, 6], direction: [0, 1, 0] }, root, end);
  assert.ok(Math.abs(Math.hypot(...hit) - 10) < 1e-9, 'on the sphere');
  assert.ok(hit[1] < 0, 'the nearer side');
  const miss = dropPoint({ origin: [0, -50, 30], direction: [0, 1, 0] }, root, end);
  assert.deepEqual(miss.map(v => Math.round(v * 1e6) / 1e6), [0, 0, 30], 'missing the sphere lands on the plane through the end');
});

test('a setup keeps sources by path and animations by name, and maps back onto another model', { skip: missing('transfer-footman', 'transfer-grunt', 'transfer-lord-of-change') }, () => {
  const foot = load('transfer-footman'), grunt = load('transfer-grunt'), lord = load('transfer-lord-of-change');
  const attack = grunt.Sequences.findIndex(s => s.Name === 'Attack - 1'), defend = foot.Sequences.findIndex(s => s.Name === 'Stand Defend');
  const recipe = { base: { sequence: defend }, length: null, sources: { g: { mirror: true } }, parts: {
    armL: { source: 'g', sequence: attack, amount: 1.2, offset: [10, 0, 0], fixes: [{ time: 300, raise: 5, turn: 0, roll: 0, width: 250 }] },
    head: { source: 'self', sequence: foot.Sequences.findIndex(s => s.Name === 'Stand Victory'), amount: 1 },
  } };
  const describe = id => id === 'g' ? { kind: 'file', path: 'D:/models/grunt.mdx', name: 'grunt.mdx', model: grunt } : id === 'self' ? { kind: 'self', name: 'This model', model: foot } : null;
  const setup = parseSetup(JSON.stringify(setupFromRecipe(recipe, foot, describe, 'Grunt swing')));
  assert.equal(setup.body, 'Stand Defend');
  assert.deepEqual(setup.sources.g, { kind: 'file', path: 'D:/models/grunt.mdx', name: 'grunt.mdx', mirror: true });
  assert.equal(setup.parts.armL.animation, 'Attack - 1');
  const back = recipeFromSetup(setup, foot, transferRig(foot), { g: { id: 'file:x', model: grunt }, self: { id: 'self', model: foot } }, 0);
  assert.deepEqual(back.left, []);
  assert.equal(back.recipe.base.sequence, defend);
  assert.deepEqual(back.recipe.parts.armL, { ...recipe.parts.armL, source: 'file:x' });
  assert.deepEqual(back.recipe.sources, { 'file:x': { mirror: true } });
  // On the Lord of Change: his own Stand Victory does not exist, so the head is left out; the arm maps by key.
  const onLord = recipeFromSetup(setup, lord, transferRig(lord), { g: { id: 'file:x', model: grunt }, self: { id: 'self', model: lord } }, 3);
  assert.ok(onLord.recipe.parts.armL);
  assert.ok(!onLord.recipe.parts.head);
  assert.deepEqual(onLord.left, ['animation:Stand Victory']);
  assert.equal(onLord.recipe.base.sequence, 3, 'no Stand Defend on the Lord of Change: the chosen body animation');
  assert.equal(recipeFromSetup(setup, foot, transferRig(foot), { self: { id: 'self', model: foot } }, 0).left[0], 'source:g');
  assert.throws(() => parseSetup('{"kind":"x"}'), /not a Transfer setup/);
});
