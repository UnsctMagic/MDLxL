// The Transfer window's pure helpers (src/transfer-window.js): chip order, mirrored
// donor parts, and POSE handles to parts and back, on the real story models.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { transferRig } from '../src/anim-transfer.js';
import { suggestPoseRig } from '../src/pose-ik.js';
import { poseKey, poseOf, withPose, sequenceIndexAfter } from '../src/transfer-window.js';
import { PART_WIDE, partsLostByReading, seatedMatch, chainedClip, clipOfPart, partClips, restoredClip, trimmedClip, withClip, withPartWide, withoutClip, addAllPlan, bodyAnimationFor, chipOrder, clipBlocks, clipLanes, dropPoint, parseSetup, recipeFromSetup, setupFromRecipe, donorPartKey, handlePart, jointPath, partHandle, pathMarker, rigFor, sourcePartKey, takenPoseConfig, takenSummary, wholeBodyParts } from '../src/transfer-window.js';

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

// ---------------------------------------------------------------- round 7: trim and chained clips
test('a part\'s clips: the part itself and its chain; one clip changes alone, whole-part settings on all', () => {
  const part = { source: 'g', sequence: 2, amount: 1, flip: false, next: [{ source: 'g', sequence: 3, amount: 1, start: 850 }, { source: 's', sequence: 1, amount: 1, start: 1700 }] };
  assert.deepEqual(partClips(part).map(clip => clip.sequence), [2, 3, 1]);
  assert.equal(partClips(part)[0].next, undefined, 'the first clip comes without the chain');
  assert.equal(clipOfPart(part, 2).source, 's');
  const second = withClip(part, 1, { ...clipOfPart(part, 1), amount: 0.4 });
  assert.deepEqual(second.next.map(clip => clip.amount), [0.4, 1]); assert.equal(second.amount, 1, 'only that clip changes');
  const first = withClip(part, 0, { ...part, amount: 0.7, next: [] });
  assert.equal(first.amount, 0.7); assert.equal(first.next, part.next, 'clip 0 keeps the chain');
  assert.deepEqual(withoutClip(part, 1).next.map(clip => clip.sequence), [1]);
  assert.equal(withoutClip(withoutClip(part, 2), 1).next, undefined, 'no chain left: no next');
  const wide = withPartWide(part, { range: 1, flip: true });
  assert.deepEqual([wide, ...wide.next].map(clip => [clip.range, clip.flip]), [[1, true], [1, true], [1, true]]);
  for (const key of ['range', 'follow', 'avoid', 'hang', 'flip', 'plant']) assert.ok(PART_WIDE.includes(key), key);
});

test('Add after: the chained clip starts a hand-over before the end and copies the part\'s whole-part settings', () => {
  const defaults = { source: null, sequence: null, amount: 1, start: 0, speed: 1, blend: 0, fixes: [], range: 0, follow: 0, avoid: 0, hang: 0, clip: null, flip: false };
  const clip = chainedClip({ range: 1, follow: 1, hang: 1, flip: true, fixes: [{ time: 10 }], clip: [0, 300] }, defaults, 'g', 4, 1499.6, 150);
  assert.equal(clip.source, 'g'); assert.equal(clip.sequence, 4); assert.equal(clip.start, 1500); assert.equal(clip.blend, 150);
  assert.deepEqual([clip.range, clip.follow, clip.hang, clip.flip], [1, 1, 1, true]);
  assert.deepEqual(clip.fixes, [], 'moment fixes stay on the first clip'); assert.equal(clip.clip, null, 'the new clip is whole');
  assert.equal(clip.next, undefined);
});

test('trim by an edge: the kept part stays in time; double-click puts that end back; whole is null', () => {
  const lane = { full: 1000, clip: null, speed: 2, start: 100 };
  // Left edge 100 result ms later at speed 2 cuts 200 ms of the donor and starts 100 ms later.
  assert.deepEqual(trimmedClip(lane, 'left', 100), { clip: [200, 1000], start: 200 });
  assert.deepEqual(trimmedClip(lane, 'right', -150), { clip: [0, 700], start: 100 });
  assert.deepEqual(trimmedClip(lane, 'left', -50), { clip: null, start: 100 }, 'nothing left of the start to bring back');
  assert.deepEqual(trimmedClip({ ...lane, clip: [0, 700] }, 'right', 400), { clip: null, start: 100 }, 'dragged past the end: whole again');
  assert.deepEqual(trimmedClip(lane, 'left', 5000), { clip: [950, 1000], start: 575 }, 'at least 50 ms stay');
  const cut = { full: 1000, clip: [200, 700], speed: 2, start: 200 };
  assert.deepEqual(restoredClip(cut, 'left'), { clip: [0, 700], start: 100 });
  assert.deepEqual(restoredClip(cut, 'right'), { clip: [200, 1000], start: 200 });
});

test('clip lanes per chain position: first clips first, a trimmed clip has a lane of its own; fixes on first clips only', () => {
  const parts = {
    armL: { source: 'g', sequence: 2, start: 0, speed: 1, fixes: [{ time: 400 }], next: [{ source: 'g', sequence: 3, start: 850, speed: 1, blend: 150, fixes: [{ time: 900 }] }] },
    armR: { source: 'g', sequence: 2, start: 0, speed: 1, next: [{ source: 'g', sequence: 3, start: 850, speed: 1, blend: 150 }] },
    head: { source: 'g', sequence: 2, start: 0, speed: 1, clip: [100, 600] },
  };
  const lanes = clipLanes(parts, () => ({ length: 1000, looping: false }), ['head', 'armL', 'armR']);
  assert.deepEqual(lanes.map(lane => [lane.index, lane.keys]), [[0, ['head']], [0, ['armL', 'armR']], [1, ['armL', 'armR']]]);
  assert.deepEqual(lanes[0].clip, [100, 600]); assert.equal(lanes[0].span, 500); assert.equal(lanes[0].full, 1000);
  assert.equal(lanes[1].clip, null); assert.equal(lanes[1].span, 1000);
  assert.equal(lanes[2].start, 850); assert.equal(lanes[2].blend, 150);
  assert.deepEqual(lanes[1].fixes, [{ key: 'armL', index: 0, time: 400 }]); assert.deepEqual(lanes[2].fixes, []);
  assert.equal(clipLanes({ a: { source: 'g', sequence: 2, clip: [0, 1000] } }, () => ({ length: 1000 }))[0].clip, null, 'a trim of the whole clip is no trim');
});

test('setups carry range, follow, avoid, hang, trim and chained clips; an old setup loads as before; Add all keeps first clips', { skip: missing('transfer-footman', 'transfer-grunt') }, () => {
  const foot = load('transfer-footman'), grunt = load('transfer-grunt');
  const attack = grunt.Sequences.findIndex(s => s.Name === 'Attack - 1'), attack2 = grunt.Sequences.findIndex(s => s.Name === 'Attack - 2'), stand = foot.Sequences.findIndex(s => s.Name === 'Stand - 1');
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: {
    armL: { source: 'g', sequence: attack, amount: 1, range: 1, follow: 1, avoid: 1, hang: 1, clip: [100, 700], future: 'kept', next: [{ source: 'g', sequence: attack2, amount: 0.5, start: 600, blend: 150, range: 1, clip: [0, 400] }] },
  } };
  const describe = id => id === 'g' ? { kind: 'file', path: 'D:/models/grunt.mdx', name: 'grunt.mdx', model: grunt } : null;
  const setup = parseSetup(JSON.stringify(setupFromRecipe(recipe, foot, describe, 'Chain')));
  assert.equal(setup.parts.armL.next[0].animation, 'Attack - 2');
  const back = recipeFromSetup(setup, foot, transferRig(foot), { g: { id: 'file:x', model: grunt } }, 0);
  assert.deepEqual(back.left, []);
  assert.deepEqual(back.recipe.parts.armL, { ...recipe.parts.armL, source: 'file:x', next: [{ ...recipe.parts.armL.next[0], source: 'file:x' }] });
  // A chained clip whose animation the donor lacks is left out and named; the first clip stays.
  const lacking = JSON.parse(JSON.stringify(setup)); lacking.parts.armL.next[0].animation = 'Nope';
  const partial = recipeFromSetup(lacking, foot, transferRig(foot), { g: { id: 'file:x', model: grunt } }, 0);
  assert.deepEqual(partial.left, ['animation:Nope']); assert.equal(partial.recipe.parts.armL.next, undefined); assert.equal(partial.recipe.parts.armL.range, 1);
  // An old setup (no new fields) gives the same recipe as before.
  const old = { kind: 'mdlxl-transfer-setup', version: 1, name: 'Old', body: 'Stand - 1', length: null, sources: { g: { kind: 'file', path: 'D:/models/grunt.mdx', name: 'grunt.mdx', mirror: null } }, parts: { armL: { amount: 1, offset: [0, 0, 0], start: 0, speed: 1, blend: 150, source: 'g', animation: 'Attack - 1' } } };
  assert.deepEqual(recipeFromSetup(old, foot, transferRig(foot), { g: { id: 'file:x', model: grunt } }, 0).recipe, { base: { sequence: stand }, length: null, sources: {}, parts: { armL: { amount: 1, offset: [0, 0, 0], start: 0, speed: 1, blend: 150, source: 'file:x', sequence: attack } } });
  // Add all: first clips only, the retargeted part loses its trim and keeps the new switches.
  const plan = addAllPlan(foot, grunt, 'g', recipe, stand);
  assert.ok(plan.clips.length > 0);
  for (const clip of plan.clips) { const arm = clip.recipe.parts.armL; assert.equal(arm.next, undefined); assert.equal(arm.clip, null); assert.deepEqual([arm.range, arm.follow, arm.avoid, arm.hang, arm.future], [1, 1, 1, 1, 'kept']); }
});

// ---------------------------------------------------------------- round 7b: two creatures
test('rigFor reads a two-creature model as Both, Rider or Mount; one creature offers Both only', { skip: missing('transfer-knight', 'transfer-nurgle-knight', 'transfer-grunt') }, () => {
  assert.deepEqual(rigFor(load('transfer-grunt')).actors, ['both']);
  for (const name of ['transfer-knight', 'transfer-nurgle-knight']) {
    const model = load(name), both = rigFor(model), rider = rigFor(model, undefined, 'seated'), mount = rigFor(model, undefined, 'walker');
    assert.deepEqual(both.actors, ['both', 'seated', 'walker'], name);
    assert.equal(rider.actor, 'seated'); assert.equal(mount.actor, 'walker'); assert.equal(rigFor(model, undefined, 'both').actor, 'both');
    assert.ok(rider.parts.legL && rider.parts.legR && rider.parts.hips, `${name}: the rider has hips and legs`);
    assert.ok(!mount.parts.armL && !mount.parts.armR, `${name}: the mount has no arms`);
    // Rider -> Both: hips and legs come from the mount now; chest, head and arms stay the rider's.
    const taken = Object.fromEntries(Object.keys(rider.parts).map(key => [key, { source: 'k' }]));
    const lost = partsLostByReading(taken, rider, both);
    assert.ok(lost.includes('hips') && lost.includes('legL') && lost.includes('legR'), `${name}: ${lost}`);
    for (const key of ['chest', 'head', 'armL', 'armR']) assert.ok(!lost.includes(key) || !both.parts[key], `${name}: ${key} stays`);
    assert.deepEqual(partsLostByReading(taken, rider, rider), [], 'the same reading loses nothing');
  }
});

test('Rider seats a unit: hips and legs at Pose Theirs, other parts and other readings as usual', () => {
  for (const key of ['hips', 'legL', 'legR', 'legL2']) assert.equal(seatedMatch('seated', key), 1, key);
  for (const key of ['chest', 'head', 'armL']) assert.equal(seatedMatch('seated', key), null, key);
  for (const actor of ['both', 'walker', undefined]) assert.equal(seatedMatch(actor, 'hips'), null, String(actor));
});

test('setups and Add all carry the readings; an old setup gets none', { skip: missing('transfer-footman', 'transfer-knight') }, () => {
  const foot = load('transfer-footman'), knight = load('transfer-knight');
  const attack = knight.Sequences.findIndex(s => /^attack/i.test(s.Name)), stand = foot.Sequences.findIndex(s => s.Name === 'Stand - 1');
  const recipe = { base: { sequence: stand, actor: 'both' }, length: null, sources: { k: { actor: 'seated' } }, parts: { hips: { source: 'k', sequence: attack, match: 1 } } };
  const describe = id => id === 'k' ? { kind: 'file', path: 'D:/models/knight.mdx', name: 'knight.mdx', model: knight } : null;
  const setup = parseSetup(JSON.stringify(setupFromRecipe(recipe, foot, describe, 'Seat')));
  assert.equal(setup.sources.k.actor, 'seated'); assert.equal(setup.bodyActor, 'both');
  const back = recipeFromSetup(setup, foot, transferRig(foot), { k: { id: 'file:k', model: knight } }, 0).recipe;
  assert.deepEqual(back.base, { sequence: stand, actor: 'both' }); assert.deepEqual(back.sources, { 'file:k': { actor: 'seated' } });
  const old = { ...setup, sources: { k: { kind: 'file', path: 'D:/models/knight.mdx', name: 'knight.mdx', mirror: null } } }; delete old.bodyActor;
  const plain = recipeFromSetup(old, foot, transferRig(foot), { k: { id: 'file:k', model: knight } }, 0).recipe;
  assert.deepEqual(plain.base, { sequence: stand }); assert.deepEqual(plain.sources, {});
  const plan = addAllPlan(foot, knight, 'k', recipe, stand);
  assert.ok(plan.clips.length > 0);
  for (const clip of plan.clips) { assert.equal(clip.recipe.base.actor, 'both'); assert.deepEqual(clip.recipe.sources, { k: { actor: 'seated' } }); }
});

// ---------------------------------------------------------------- round 8: own features
test('setups keep features by their top joint\'s name; a model without one leaves it out and names it; Add all carries them', () => {
  const own = { Sequences: [{ Name: 'Stand', Interval: [0, 1000] }] }, donor = { Sequences: [{ Name: 'Attack', Interval: [0, 800] }] };
  const recipe = { base: { sequence: 0 }, length: null, sources: {}, features: { 12: { keep: 1 }, 13: { keep: 0 }, 99: { keep: 1 } }, parts: { armL: { source: 'g', sequence: 0, amount: 1 } } };
  const describe = id => id === 'g' ? { kind: 'file', path: 'D:/m/g.mdx', name: 'g.mdx', model: donor } : null;
  const setup = parseSetup(JSON.stringify(setupFromRecipe(recipe, own, describe, 'Belly', [{ id: 12, name: 'BellyBone1' }, { id: 13, name: 'Cape 1' }])));
  assert.deepEqual(setup.features, { BellyBone1: { keep: 1 } }, 'kept ones by name; switched-off and unknown ids stay out');
  const rig = { parts: { armL: {} } }, donors = { g: { id: 'file:g', model: donor } };
  const there = recipeFromSetup(setup, own, rig, donors, 0, [{ id: 40, name: 'BellyBone1' }]);
  assert.deepEqual(there.recipe.features, { 40: { keep: 1 } }, 'mapped to this model\'s joint id');
  assert.deepEqual(there.left, []);
  const lacking = recipeFromSetup(setup, own, rig, donors, 0, []);
  assert.deepEqual(lacking.left, ['feature:BellyBone1']); assert.equal(lacking.recipe.features, undefined);
  const old = { ...setup }; delete old.features;
  assert.equal(recipeFromSetup(old, own, rig, donors, 0, [{ id: 40, name: 'BellyBone1' }]).recipe.features, undefined, 'an old setup gets no features');
  const plan = addAllPlan({ Sequences: [] }, { Sequences: [{ Name: 'Walk', Interval: [0, 500] }] }, 'g', recipe, 0);
  assert.equal(plan.clips[0].recipe.features, recipe.features, 'Add all passes features untouched');
});

// ---------------------------------------------------------------- stage 2, second part: Pose carries the stance, Add all replaces
test('Pose: Head, Chest and Hips read and write stance, limbs match; a part without stance reads 0', () => {
  assert.equal(poseKey('trunk'), 'stance');
  assert.equal(poseKey('limb'), 'match');
  const hips = { match: 0.3, stance: 0 }, arm = { match: 0, stance: 0 };
  assert.deepEqual(withPose(hips, 'trunk', 1), { match: 0.3, stance: 1 }, 'a trunk part: stance changes, match stays');
  assert.deepEqual(withPose(arm, 'limb', 1), { match: 1, stance: 0 }, 'a limb: match changes, stance stays');
  assert.equal(poseOf({ match: 1 }, 'trunk'), 0, 'an old trunk part without stance reads 0 (its match is not shown)');
  assert.equal(poseOf({ match: 0.4, stance: 0.7 }, 'limb'), 0.4);
  assert.equal(poseOf({ match: 0.4, stance: 0.7 }, 'trunk'), 0.7);
});

test('setups save and load stance; an old setup without it reads Pose 0 on the trunk', () => {
  const own = { Sequences: [{ Name: 'Stand', Interval: [0, 1000] }] }, donor = { Sequences: [{ Name: 'Walk', Interval: [0, 800] }] };
  const recipe = { base: { sequence: 0 }, length: null, sources: {}, parts: { hips: { source: 'g', sequence: 0, match: 0, stance: 1 }, chest: { source: 'g', sequence: 0, match: 0, stance: 0.5 }, armL: { source: 'g', sequence: 0, match: 1, stance: 0 } } };
  const describe = id => id === 'g' ? { kind: 'file', path: 'D:/m/g.mdx', name: 'g.mdx', model: donor } : null;
  const setup = parseSetup(JSON.stringify(setupFromRecipe(recipe, own, describe, 'Stance')));
  assert.equal(setup.parts.hips.stance, 1); assert.equal(setup.parts.chest.stance, 0.5);
  const rig = { parts: { hips: { kind: 'trunk' }, chest: { kind: 'trunk' }, armL: { kind: 'limb' } } }, donors = { g: { id: 'file:g', model: donor } };
  const back = recipeFromSetup(setup, own, rig, donors, 0).recipe.parts;
  assert.deepEqual(Object.fromEntries(Object.entries(back).map(([key, part]) => [key, poseOf(part, rig.parts[key].kind)])), { hips: 1, chest: 0.5, armL: 1 });
  const old = JSON.parse(JSON.stringify(setup)); for (const part of Object.values(old.parts)) delete part.stance;
  const plain = recipeFromSetup(old, own, rig, donors, 0).recipe.parts;
  assert.equal(poseOf(plain.hips, 'trunk'), 0); assert.equal(poseOf(plain.chest, 'trunk'), 0); assert.equal(poseOf(plain.armL, 'limb'), 1);
});

test('Add all on the Kurgan from the Tauren: replaces the names it has by default, Keep own animations adds only new ones', { skip: missing('transfer-kurgan', 'transfer-tauren') }, () => {
  const kurgan = load('transfer-kurgan'), tauren = load('transfer-tauren'), lower = s => s.Name.trim().toLowerCase();
  const stand = kurgan.Sequences.findIndex(s => s.Name === 'Stand - 1');
  const recipe = { base: { sequence: stand }, length: null, sources: {}, parts: { hips: { source: 't', sequence: 0, match: 0, stance: 1 }, armR: { source: 't', sequence: 0, match: 1, grip: false } } };
  const wanted = tauren.Sequences.filter(s => !/decay|portrait/i.test(s.Name)).map(s => s.Name);
  // Keep own animations: the names the Kurgan lacks, nothing removed.
  const keep = addAllPlan(kurgan, tauren, 't', recipe, stand).clips;
  assert.deepEqual(keep.map(clip => clip.name), wanted.filter(n => !kurgan.Sequences.some(s => lower(s) === n.toLowerCase())));
  assert.ok(keep.every(clip => clip.replaces.length === 0));
  // Replace: every Tauren name; a shared name plays over the Kurgan's own animation of that name and replaces it.
  const all = addAllPlan(kurgan, tauren, 't', recipe, stand, { replace: true }).clips;
  assert.deepEqual(all.map(clip => clip.name), wanted, 'every Tauren animation but Decay ones');
  for (const clip of all) {
    const own = kurgan.Sequences.flatMap((s, i) => lower(s) === clip.name.toLowerCase() ? [i] : []);
    assert.deepEqual(clip.replaces, own, `${clip.name} replaces the Kurgan's own of that name`);
    if (own.length) assert.equal(clip.recipe.base.sequence, own[0], `${clip.name} is built over the Kurgan's ${clip.name}`);
    assert.equal(clip.recipe.parts.hips.stance, 1); assert.equal(clip.recipe.parts.armR.grip, false);
  }
  assert.deepEqual(all.filter(clip => clip.replaces.length).map(clip => clip.name).sort(), ['Attack - 1', 'Attack Slam', 'Death', 'Stand Ready', 'Walk']);
  // The names the model ends with: each Tauren name once, the rest of its own untouched.
  const gone = new Set(all.flatMap(clip => clip.replaces)), names = [...kurgan.Sequences.filter((_, i) => !gone.has(i)).map(s => s.Name), ...all.map(clip => clip.name)];
  for (const n of wanted) assert.equal(names.filter(x => x.toLowerCase() === n.toLowerCase()).length, 1, `${n} once`);
  assert.equal(names.length, kurgan.Sequences.length - gone.size + all.length);
  // The Body animation moves with the removal: Stand - 1 stays Stand - 1, a replaced one becomes its replacement.
  const count = kurgan.Sequences.length;
  assert.equal(names[sequenceIndexAfter(stand, count, all)], 'Stand - 1');
  const walk = kurgan.Sequences.findIndex(s => s.Name === 'Walk');
  assert.equal(names[sequenceIndexAfter(walk, count, all)], 'Walk');
  assert.equal(sequenceIndexAfter(walk, count, all), count - gone.size + all.findIndex(clip => clip.name === 'Walk'));
  const dissipate = kurgan.Sequences.findIndex(s => s.Name === 'Dissipate');
  assert.equal(names[sequenceIndexAfter(dissipate, count, all)], 'Dissipate');
});

// Transplant mode (the window's second mode): the engine options from its settings, the animation
// the result view plays for the donor view's, and the whole-model swap the Transplant button makes.
test('Transplant settings: Sounds on, Effects off, Keep off by default; Keep lists only offered extras', async () => {
  const { transplantOptions } = await import('../src/transfer-window.js');
  assert.deepEqual(transplantOptions(), { events: true, emitters: false, keep: [], mirror: false });
  assert.deepEqual(transplantOptions({ sounds: false, effects: true, keep: [9, 4, 4], mirror: true }), { events: false, emitters: true, keep: [4, 9], mirror: true });
  assert.deepEqual(transplantOptions({ keep: [4, 9] }, [{ id: 9, name: 'Hammer' }]).keep, [9], 'an id the report does not list is dropped');
});

test('Transplant on the Kurgan from the Tauren: the result plays the donor view\'s animation, and one swap makes the model the result', { skip: missing('transfer-kurgan', 'transfer-tauren') }, async () => {
  const { transplantOptions, transplantSequence, replaceModelContents } = await import('../src/transfer-window.js');
  const { transplantSkeleton } = await import('../src/skeleton-transplant.js');
  const kurgan = load('transfer-kurgan'), tauren = load('transfer-tauren');
  const quiet = transplantSkeleton(kurgan, tauren, { ...transplantOptions({ sounds: false }), extents: false });
  const { model, report } = transplantSkeleton(kurgan, tauren, { ...transplantOptions(), extents: false });
  assert.equal(report.fit, 'good');
  assert.ok(report.extras.length > 0, 'the Kurgan lists extras to keep');
  // Sounds: the donor's events come with Sounds on, not with it off.
  const names = m => (m.EventObjects || []).map(node => node.Name).sort();
  assert.deepEqual(names(model), names(tauren));
  assert.notDeepEqual(names(quiet.model), names(tauren));
  // Each donor animation has the result's animation of the same name, wherever it sits.
  tauren.Sequences.forEach((sequence, i) => assert.equal(model.Sequences[transplantSequence(model, tauren, i)].Name, sequence.Name));
  const reordered = { Sequences: [...model.Sequences].reverse() };
  assert.equal(reordered.Sequences[transplantSequence(reordered, tauren, 0)].Name, tauren.Sequences[0].Name);
  assert.equal(transplantSequence({ Sequences: [] }, tauren, 0), -1);
  // The swap: the open model object now holds the result's sections, and sections the result lacks are gone.
  const own = load('transfer-kurgan'), extra = Symbol('kept'); own[extra] = 1; own.OnlyMine = [1];
  replaceModelContents(own, model);
  assert.equal(own.OnlyMine, undefined);
  assert.deepEqual(own.Sequences.map(s => s.Name), tauren.Sequences.map(s => s.Name));
  assert.equal(own.Bones, model.Bones);
  assert.equal(own[extra], 1, 'non-section data on the model object stays');
});