// The Transfer window's pure helpers (src/transfer-window.js): chip order, mirrored
// donor parts, and POSE handles to parts and back, on the real story models.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { transferRig } from '../src/anim-transfer.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { chipOrder, donorPartKey, handlePart, partHandle, takenSummary } from '../src/transfer-window.js';

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
