// AI work replay: the plan of one edit (what glides, grows, shrinks, sweeps, plays) and the
// clock every view draws from. The app side is test/ai-replay.electron.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REPLAY_MAX_MS, REPLAY_MIN_MS, glideInto, growInto, matchGeosets, planReplay, replayPhase } from '../src/ai-replay.js';
import { createAiReplay, REPLAY_HOLD_MS } from '../app/ai-replay.js';
import { fixturePath } from './helpers/fixtures.cjs';
import { readFileSync, existsSync } from 'node:fs';
import { openDocument } from '../src/editor-document.js';

const quad = (x = 0, material = 0) => ({
  Vertices: new Float32Array([x, 0, 0, x + 10, 0, 0, x + 10, 10, 0, x, 10, 0]),
  Normals: new Float32Array(12),
  TVertices: [new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])],
  Faces: new Uint16Array([0, 1, 2, 0, 2, 3]),
  VertexGroup: new Uint8Array(4),
  Groups: [[0]],
  MaterialID: material,
});
const tri = x => ({ ...quad(x), Vertices: new Float32Array([x, 0, 0, x + 4, 0, 0, x, 4, 0]), TVertices: [new Float32Array(6)], Faces: new Uint16Array([0, 1, 2]), VertexGroup: new Uint8Array(3) });
const bone = (id, keys = []) => ({ ObjectId: id, Name: 'Bone' + id, Parent: null, PivotPoint: new Float32Array([id, 0, 5]), Translation: { LineType: 1, GlobalSeqId: null, Keys: keys.map(([Frame, z]) => ({ Frame, Vector: new Float32Array([0, 0, z]) })) } });
const model = () => ({
  Geosets: [quad(0), quad(40, 1), tri(90)],
  Materials: [{ Layers: [{ TextureID: 0, Alpha: 1, FilterMode: 0 }] }, { Layers: [{ TextureID: 1, Alpha: 1, FilterMode: 0 }] }],
  Textures: [{ Image: 'Textures\\A.blp' }, { Image: 'Textures\\B.blp' }],
  GeosetAnims: [],
  TextureAnims: [],
  Sequences: [{ Name: 'Stand', Interval: [0, 1000] }, { Name: 'Walk', Interval: [2000, 3000] }],
  Bones: [bone(0, [[0, 0], [500, 2], [1000, 0]]), bone(1, [[2000, 0], [3000, 0]])],
  ParticleEmitters2: [{ ObjectId: 2, Name: 'Dust', PivotPoint: new Float32Array([3, 3, 3]) }],
});
const edit = change => {
  const before = model(), after = structuredClone(before);
  change(after);
  return [before, after];
};

test('an edit that changes nothing a view can show plans no replay', () => {
  const [before, after] = edit(() => {});
  assert.equal(planReplay(before, after), null);
  const [a, b] = edit(m => { m.Sequences[0].Name = 'Stand 2'; });
  assert.equal(planReplay(a, b), null);
});

test('moved vertices glide from the old place to the new one', () => {
  const [before, after] = edit(m => { m.Geosets[1].Vertices[2] += 6; m.Geosets[1].Vertices[5] += 6; });
  const plan = planReplay(before, after);
  assert.equal(plan.glides.length, 1);
  const glide = plan.glides[0];
  assert.equal(glide.geoset, 1);
  assert.deepEqual([...glide.trails], [0, 1], 'only the moved points leave a trail');
  assert.equal(glide.from[2], 0);
  assert.equal(glide.to[2], 6);
  assert.deepEqual(plan.focus, [45, 0, 6], 'the marker hovers over the moved points');
  assert.deepEqual([...plan.glow[0].faces], [0, 1, 2, 0, 2, 3], 'the triangles of the moved points glow');
  assert.equal(plan.fade, null, 'the old picture is not shown over a glide');
  // Halfway through the glide the points are between both places; at the end exactly on the new one.
  const half = glideInto(new Float32Array(12), glide.from, glide.to, replayPhase(plan, .5).glide);
  assert.ok(half[2] > .5 && half[2] < 5.5, String(half[2]));
  assert.deepEqual([...glideInto(new Float32Array(12), glide.from, glide.to, replayPhase(plan, 1).glide)], [...after.Geosets[1].Vertices]);
  assert.deepEqual([...glideInto(new Float32Array(12), glide.from, glide.to, replayPhase(plan, 0).glide)], [...before.Geosets[1].Vertices]);
});

test('a new part grows into place and a removed part shrinks away, without shifting its neighbours', () => {
  const [before, after] = edit(m => { m.Geosets.splice(1, 0, tri(200)); });
  const added = planReplay(before, after);
  assert.deepEqual(added.grows.map(item => item.geoset), [1], 'the inserted geoset grows');
  assert.equal(added.glides.length, 0, 'the geosets behind it did not move');
  assert.equal(added.ghosts.length, 0);
  const grow = added.grows[0], small = growInto(new Float32Array(9), grow.to, grow.center, replayPhase(added, .3).grow), full = growInto(new Float32Array(9), grow.to, grow.center, replayPhase(added, 1).grow);
  assert.ok(Math.hypot(small[3] - small[0], small[4] - small[1]) < Math.hypot(full[3] - full[0], full[4] - full[1]) * .9, 'still smaller early in the replay');
  assert.deepEqual([...full], [...after.Geosets[1].Vertices]);

  const [b2, a2] = edit(m => { m.Geosets.splice(0, 1); });
  const removed = planReplay(b2, a2);
  assert.equal(removed.ghosts.length, 1);
  assert.deepEqual([...removed.ghosts[0].vertices], [...b2.Geosets[0].Vertices], 'the ghost is the removed part as it was');
  assert.equal(removed.grows.length + removed.glides.length, 0);
  const early = replayPhase(removed, .1), late = replayPhase(removed, .9);
  assert.ok(early.ghostAlpha > .9 && late.ghostAlpha < .05 && late.ghostScale < early.ghostScale, 'it shrinks and fades');
});

test('a part replaced by a different shape shrinks out while the new one grows in', () => {
  const [before, after] = edit(m => { m.Geosets[2] = quad(300); });
  const plan = planReplay(before, after);
  assert.equal(plan.ghosts.length, 1);
  assert.deepEqual(plan.grows.map(item => item.geoset), [2]);
  assert.deepEqual(matchGeosets(before.Geosets, after.Geosets).pairs.map(pair => pair.slice(0, 2)), [[0, 0], [1, 1], [2, 2]]);
});

test('UVs slide, materials crossfade, new texture pixels sweep in', () => {
  const [b1, a1] = edit(m => { m.Geosets[0].TVertices[0][0] = .5; });
  const uv = planReplay(b1, a1);
  assert.deepEqual(uv.uvs.map(item => item.geoset), [0]);
  assert.equal(uv.uvs[0].from[0][0], 0);
  assert.equal(uv.uvs[0].to[0][0], .5);

  const [b2, a2] = edit(m => { m.Materials[1].Layers[0].Alpha = .4; });
  const material = planReplay(b2, a2);
  assert.equal(material.fade, 'cross');
  assert.deepEqual(material.glow.map(item => item.geoset), [1], 'only the part that uses the material is lit');

  const [b3, a3] = edit(m => { m.Textures[0].Image = 'Textures\\C.blp'; });
  const painted = planReplay(b3, a3);
  assert.equal(painted.fade, 'sweep');
  assert.deepEqual(painted.glow.map(item => item.geoset).sort(), [0, 2]);
  // Same path, new pixels: the edit names the texture it replaced.
  const [b4, a4] = edit(m => { m.Geosets[1].Vertices[0] += 1; });
  assert.equal(planReplay(b4, a4, { assets: ['textures/b.blp'] }).fade, 'sweep');
});

test('new keys pop on the timeline and the changed span plays once inside the animation on screen', () => {
  const [before, after] = edit(m => { m.Bones[0].Translation.Keys[1].Vector[2] = 9; m.Bones[0].Translation.Keys.splice(2, 0, { Frame: 700, Vector: new Float32Array([0, 0, 4]) }); });
  const plan = planReplay(before, after, { sequence: 0 });
  assert.deepEqual(plan.keyFrames, [500, 700]);
  assert.deepEqual(plan.bones.map(item => item.id), [0], 'the bone that moves is lit');
  assert.deepEqual(plan.span, { sequence: 0, from: 400, to: 800 }, 'a short change still plays a visible stretch');
  const frames = [0, .25, .5, .75, 1].map(p => replayPhase(plan, p).frame);
  assert.equal(frames[0], 400);
  assert.equal(frames.at(-1), 800);
  assert.ok(frames.every((frame, index) => !index || frame >= frames[index - 1]), 'forward only');
  // Another animation is on screen: the keys still pop, nothing plays.
  assert.equal(planReplay(before, after, { sequence: 1 }).span, null);
  assert.equal(planReplay(before, after).span, null);
});

test('emitters start up or fade out, pivots glide', () => {
  const [b1, a1] = edit(m => { m.ParticleEmitters2.push({ ObjectId: 3, Name: 'Sparks', PivotPoint: new Float32Array([1, 2, 3]) }); });
  assert.deepEqual(planReplay(b1, a1).emitters, [{ id: 3, at: [1, 2, 3], on: true }]);
  const [b2, a2] = edit(m => { m.ParticleEmitters2 = []; });
  assert.deepEqual(planReplay(b2, a2).emitters, [{ id: 2, at: [3, 3, 3], on: false }]);
  const [b3, a3] = edit(m => { m.Bones[1].PivotPoint[2] = 9; });
  assert.deepEqual(planReplay(b3, a3).pivots, [{ id: 1, from: [1, 0, 5], to: [1, 0, 9] }]);
});

test('every replay lasts half a second to a second and every curve is smooth', () => {
  const plans = [
    edit(m => { m.Geosets[1].Vertices[2] += .01; }),
    edit(m => { for (let i = 0; i < 12; i += 3) m.Geosets[1].Vertices[i + 2] += 500; m.Geosets.push(tri(5)); m.Textures[0].Image = 'x.blp'; m.Bones[0].Translation.Keys[1].Vector[2] = 9; }),
  ].map(([before, after]) => planReplay(before, after, { sequence: 0 }));
  for (const plan of plans) assert.ok(plan.ms >= REPLAY_MIN_MS && plan.ms <= REPLAY_MAX_MS, String(plan.ms));
  assert.ok(plans[1].ms > plans[0].ms, 'a bigger change gets a little longer');
  // No value jumps between two display frames (60 Hz over the shortest replay): nothing can flash.
  const steps = 30;
  let previous = replayPhase(plans[1], 0);
  for (let i = 1; i <= steps; i++) {
    const now = replayPhase(plans[1], i / steps);
    for (const key of ['glide', 'grow', 'ghostScale', 'ghostAlpha', 'glow', 'marker', 'fade'])
      assert.ok(Math.abs(now[key] - previous[key]) < .26, `${key} jumps at ${i}: ${previous[key]} -> ${now[key]}`);
    previous = now;
  }
  const end = replayPhase(plans[1], 1);
  assert.ok(end.glow < .01 && end.marker < .01 && end.ghostAlpha < .01 && end.glide === 1 && end.grow === 1 && end.fade === 1, 'everything has left the screen at the end');
});

test('the AI never waits: a newer step replaces the replay in flight, and replays end on their own', () => {
  let now = 0;
  const timers = [];
  const replay = createAiReplay({ now: () => now, setTimer: (fn, ms) => timers.push({ fn, at: now + ms }) && timers.length, clearTimer: id => { if (timers[id - 1]) timers[id - 1].fn = null; } });
  const seen = [];
  replay.subscribe(reason => seen.push(reason));
  const [before, after] = edit(m => { m.Geosets[1].Vertices[2] += 6; });
  const armed = replay.arm('doc', 4);
  assert.equal(replay.armed, armed);
  const first = replay.play(armed, before, after, { documentId: 'doc', revision: 5 });
  assert.ok(first > 0 && replay.armed === null);
  assert.deepEqual(seen, ['arm', 'start']);
  now = 200;
  assert.ok(replay.sample().p > 0 && replay.sample().p < 1);
  // The next step lands while the first still plays.
  const [b2, a2] = edit(m => { m.Geosets[0].Vertices[2] += 3; });
  const second = replay.play(replay.arm('doc', 5), b2, a2, { documentId: 'doc', revision: 6 });
  assert.ok(second > first);
  assert.equal(replay.sample().id, second, 'the older replay is dropped at once');
  assert.equal(replay.sample().p, 0);
  assert.equal(replay.sample().revision, 6);
  // A look never interrupts a replay; it only shows the marker when nothing plays.
  assert.equal(replay.look('doc', 6, [1, 2, 3]), 0);
  now += replay.sample().plan.ms + 50;
  for (const timer of timers.splice(0)) if (timer.fn && timer.at <= now) timer.fn();
  assert.equal(replay.sample(), null, 'it ends by itself');
  assert.equal(seen.at(-1), 'end');
  assert.ok(replay.look('doc', 6, [1, 2, 3]) > 0);
  assert.equal(replay.sample().plan.look, true);
  // An edit that changed nothing lets go of the armed picture.
  replay.stop();
  const idle = replay.arm('doc', 6);
  assert.equal(replay.play(idle, before, structuredClone(before), { documentId: 'doc', revision: 6 }), 0);
  assert.equal(replay.armed, null);
  assert.equal(seen.at(-1), 'disarm');
  assert.ok(REPLAY_HOLD_MS < REPLAY_MIN_MS);
  // The marker colour follows Thumper's eyes; anything that is not a colour is ignored.
  replay.setColor('#10A37F');
  replay.setColor('green');
  assert.equal(replay.color, '#10A37F');
});

test('a real Footman: lifting its biggest part plans one glide that ends on the model itself', { skip: !existsSync(fixturePath('footman') || '') }, () => {
  const file = fixturePath('footman'), before = openDocument(new Uint8Array(readFileSync(file)), 'Footman.mdx').model, after = structuredClone(before);
  const part = before.Geosets.map((geoset, index) => [geoset.Vertices.length, index]).sort((a, b) => b[0] - a[0])[0][1];
  for (let i = 2; i < after.Geosets[part].Vertices.length; i += 3) after.Geosets[part].Vertices[i] += 18;
  const plan = planReplay(before, after, { sequence: 0 });
  assert.deepEqual(plan.glides.map(item => item.geoset), [part]);
  assert.equal(plan.grows.length + plan.ghosts.length + plan.uvs.length + plan.bones.length, 0);
  assert.ok(plan.glides[0].trails.length <= 96 && plan.glides[0].trails.length > 8);
  assert.deepEqual([...glideInto(new Float32Array(plan.glides[0].to.length), plan.glides[0].from, plan.glides[0].to, 1)], [...after.Geosets[part].Vertices]);
  // The plan keeps its own copies: the model can change again while the replay still runs.
  after.Geosets[part].Vertices[2] += 100;
  assert.notEqual(plan.glides[0].to[2], after.Geosets[part].Vertices[2]);
});
