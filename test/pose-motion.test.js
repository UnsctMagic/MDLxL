import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { ModelRenderer } from 'war3-model';
import { allNodes, sampleNodeMatrices } from '../src/animation.js';
import { sampleMovement, applyMovementPose } from '../src/movement.js';
import { samplePoseChain, solvePoseNode } from '../src/pose-ik.js';
import { preparePoseMotion, buildPoseMotion, applyPoseMotion, poseMotionProgress } from '../src/pose-motion.js';
import { stepFixture } from './fixtures/pose-motion-step.js';

const chain = { root: 1, middle: 2, end: 3, kind: 'arm', key: 'arm' };
const config = { body: 0, chains: [chain], nodes: [0], roles: { 0: 'Body' }, pins: [] };
const rotation = angle => new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle).toArray();
const keys = values => ({ LineType: 1, GlobalSeqId: null, Keys: values.map(([Frame, angle]) => ({ Frame, Vector: new Float32Array(rotation(angle)) })) });
function fixture() {
  const pivots = [[0, 0, 0], [0, 0, 10], [5, 0, 10], [9, 0, 10]];
  return { Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: `Bone ${ObjectId}`, Parent: ObjectId ? ObjectId - 1 : null, PivotPoint, Flags: 256,
    ...(ObjectId === 1 ? { Rotation: keys([[0, 0], [500, 1.4], [1000, 0], [2000, .2], [3000, .5]]) } : {}) })), Helpers: [], PivotPoints: pivots,
    Sequences: [{ Name: 'Action', Interval: [0, 1000] }, { Name: 'Other', Interval: [2000, 3000] }], GlobalSequences: [], Geosets: [] };
}
const changed = (model, settings) => { const analysis = preparePoseMotion(model, config, 0), result = buildPoseMotion(analysis, settings); const output = structuredClone(model); applyPoseMotion(output, result); return { analysis, result, output }; };
const matricesEqual = (a, b, frame, sequence = 0) => {
  const first = sampleNodeMatrices(a, frame, sequence), second = sampleNodeMatrices(b, frame, sequence);
  for (const [id, matrix] of first) matrix.elements.forEach((value, i) => assert.ok(Math.abs(value - second.get(id).elements[i]) < 1e-5, `${frame} ${id} ${i}`));
};

test('shared timing remains monotone, anchored and coordinated', () => {
  for (const style of ['flow', 'swing', 'step']) for (const timing of [0, .5, 1]) for (const beforeHit of [false, true]) {
    let prior = -1;
    for (let i = 0; i <= 100; i++) { const next = poseMotionProgress(i / 100, style, timing, beforeHit); assert.ok(next >= prior); prior = next; }
    assert.equal(poseMotionProgress(0, style, timing, beforeHit), 0); assert.equal(poseMotionProgress(1, style, timing, beforeHit), 1);
  }
});

test('three sparse poses gain preparation and recovery while exact poses and other clips survive', () => {
  const model = fixture(), original = structuredClone(model), { result, output } = changed(model, { timing: 75, follow: 50, body: 0, contacts: false });
  assert.deepEqual(result.anchors, [0, 500, 1000]); assert.equal(result.impact, 500); assert.ok(result.tracks.length);
  for (const frame of [0, 500, 1000]) matricesEqual(model, output, frame);
  for (const frame of [2000, 2457, 3000]) matricesEqual(model, output, frame, 1);
  const angle = (m, frame) => Q(sampleMovement(m, m.Bones[1], 'Rotation', frame, 0)).angleTo(new Quaternion());
  assert.ok(angle(output, 250) < angle(model, 250) * .5, 'readable preparation replaces uniform speed');
  assert.deepEqual(model, original);
  assert.deepEqual(output.Geosets, model.Geosets); assert.deepEqual(output.PivotPoints, model.PivotPoints);
});
const Q = value => new Quaternion().fromArray(value).normalize();

test('follow-through comes from the incoming pose interval and occurs only after the selected hit', () => {
  const model = fixture(), { output } = changed(model, { timing: 0, follow: 100, body: 0, contacts: false });
  matricesEqual(model, output, 250);
  const source = Q(sampleMovement(model, model.Bones[1], 'Rotation', 575, 0)), actual = Q(sampleMovement(output, output.Bones[1], 'Rotation', 575, 0));
  assert.ok(actual.angleTo(new Quaternion()) > source.angleTo(new Quaternion()) + .08);
  assert.ok(Q(sampleMovement(model, model.Bones[1], 'Rotation', 850, 0)).angleTo(Q(sampleMovement(output, output.Bones[1], 'Rotation', 850, 0))) < .005);
});

test('body contribution uses native transforms and returns to all supplied poses', () => {
  const model = fixture(), { result, output } = changed(model, { timing: 60, follow: 20, body: 60, contacts: true });
  assert.ok(result.tracks.some(item => item.id === 0 && item.property === 'Translation'));
  for (const frame of [0, 500, 1000]) matricesEqual(model, output, frame);
  for (const frame of [125, 375, 625, 875]) {
    const a = sampleNodeMatrices(model, frame, 0), b = sampleNodeMatrices(output, frame, 0);
    for (const node of output.Bones.filter(node => node.Parent != null)) {
      const point = (n, matrices) => new Vector3(...n.PivotPoint).applyMatrix4(matrices.get(n.ObjectId));
      const parent = output.Bones.find(n => n.ObjectId === node.Parent);
      assert.ok(Math.abs(point(node, a).distanceTo(point(parent, a)) - point(node, b).distanceTo(point(parent, b))) < .002);
    }
  }
});

test('two endpoint poses still get useful timing without a hidden reference animation', () => {
  const model = fixture(); model.Bones[1].Rotation = keys([[0, 0], [1000, 1.4]]);
  const { result, output } = changed(model, { timing: 80, follow: 35, body: 0, contacts: false });
  assert.deepEqual(result.anchors, [0, 1000]); assert.ok(result.keyCount > 2);
  matricesEqual(model, output, 0); matricesEqual(model, output, 1000);
  assert.ok(Q(sampleMovement(model, model.Bones[1], 'Rotation', 500, 0)).angleTo(Q(sampleMovement(output, output.Bones[1], 'Rotation', 500, 0))) > .3);
});

test('zero settings are exact bypass and dense keys use a few broad preserved poses', () => {
  const model = fixture(); assert.deepEqual(changed(model, { timing: 0, follow: 0, body: 0 }).result.tracks, []);
  model.Bones[1].Rotation = keys(Array.from({ length: 41 }, (_, i) => [i * 25, Math.sin(i / 40 * Math.PI)]));
  const { result, output } = changed(model, { timing: 80, follow: 80, body: 80 });
  assert.equal(result.sparse, false); assert.equal(result.allKeyFrames.length, 41); assert.ok(result.tracks.length);
  assert.ok(result.anchors.length >= 3 && result.anchors.length <= 8);
  assert.ok(result.anchors.slice(1).every((frame, i) => frame - result.anchors[i] >= 80));
  for (const frame of result.anchors) matricesEqual(model, output, frame);
});

test('explicit anchors and a new hit preserve the chosen source poses', () => {
  const model = fixture(), { result, output } = changed(model, { anchors: [0, 500, 1000], hit: 350, timing: 65, follow: 30, body: 0 });
  assert.equal(result.impact, 350); assert.deepEqual(result.anchors, [0, 350, 500, 1000]);
  for (const frame of result.anchors) matricesEqual(model, output, frame);
});

test('preparation eases at its pose and acceleration is reserved for the hit segment', () => {
  const model = fixture(); model.Bones[1].Rotation = keys([[0, 0], [300, -.8], [600, 1.4], [1000, 0]]);
  const { output } = changed(model, { timing: 100, follow: 0, body: 0, contacts: false, hit: 600 });
  const q = frame => Q(sampleMovement(output, output.Bones[1], 'Rotation', frame, 0));
  assert.ok(q(280).angleTo(q(299)) < .025, 'windup arrives gently');
  assert.ok(q(580).angleTo(q(599)) > .2, 'strike arrives decisively');
});

test('prepared controller samples are detached from subsequent source edits', () => {
  const model = fixture(), analysis = preparePoseMotion(model, config, 0), original = structuredClone(analysis.baseline.Bones[1].Rotation);
  model.Bones[1].Rotation.Keys[1].Vector[2] = 0;
  assert.deepEqual(analysis.baseline.Bones[1].Rotation, original);
});

test('hidden duplicate rig with zero scale is excluded before limb sampling', () => {
  const model = fixture();
  for (let id = 4; id <= 6; id++) {
    const pivot = [id * 2, 5, 10]; model.PivotPoints.push(pivot);
    model.Bones.push({ ObjectId: id, Name: `Hidden ${id}`, Parent: id === 4 ? 0 : id - 1, PivotPoint: pivot, Flags: 256, ...(id === 4 ? { Scaling: [0, 0, 0] } : {}) });
  }
  model.Geosets = [3, 6].map(id => ({ Vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), Faces: [0, 1, 2], VertexGroup: [0, 0, 0], Groups: [[id]] }));
  model.GeosetAnims = [{ GeosetId: 1, Alpha: 0 }];
  const rig = { ...config, chains: [chain, { root: 4, middle: 5, end: 6, kind: 'arm', key: 'hidden' }] };
  const analysis = preparePoseMotion(model, rig, 0);
  assert.deepEqual(analysis.config.chains.map(chain => chain.key), ['arm']);
  const result = buildPoseMotion(analysis, { timing: 65, body: 20 });
  assert.ok(result.tracks.length); assert.ok(result.tracks.every(item => item.id < 4));
});

test('global tracks and scaling are retained without becoming generated channels', () => {
  const model = fixture(); model.GlobalSequences = [1000];
  model.Bones[0].Scaling = { LineType: 1, GlobalSeqId: null, Keys: [0, 1000].map(Frame => ({ Frame, Vector: new Float32Array([1, 1, 1]) })) };
  model.Helpers = [{ ObjectId: 4, Name: 'Adornment', Parent: 3, PivotPoint: [9, 0, 11], Flags: 0, Rotation: { ...keys([[0, 0], [1000, 1]]), GlobalSeqId: 0 } }];
  model.PivotPoints.push([9, 0, 11]);
  const { result, output } = changed(model, { timing: 65, body: 0 });
  assert.ok(result.tracks.every(item => item.property !== 'Scaling' && item.id !== 4));
  assert.deepEqual(output.Helpers, model.Helpers); assert.deepEqual(output.Bones[0].Scaling, model.Bones[0].Scaling);
});

test('Flow never receives Swing recoil and Step requires an actual leg rig', () => {
  const model = fixture();
  assert.deepEqual(changed(model, { style: 'flow', timing: 0, follow: 100, body: 0, contacts: false }).result.tracks, []);
  assert.throws(() => changed(model, { style: 'step', timing: 0, follow: 100, body: 0, contacts: false }), /at least two mapped legs/);
});

test('Flow uses the moving leg when mapped arms are held and has no forced hit pose', () => {
  const { model, config } = stepFixture();
  const ids = [model.Bones.length, model.Bones.length + 1, model.Bones.length + 2], pivots = [[0, 0, 12], [4, 1, 12], [8, 0, 12]];
  ids.forEach((id, i) => { model.Bones.push({ ObjectId: id, Parent: i ? ids[i - 1] : 0, PivotPoint: pivots[i], Flags: 256 }); model.PivotPoints.push(pivots[i]); });
  model.Geosets.push({ Vertices: new Float32Array([8, 0, 12, 9, 0, 12, 8, 1, 12]), Faces: [0, 1, 2], VertexGroup: [0, 0, 0], Groups: [[ids[2]]] });
  config.chains.push({ root: ids[0], middle: ids[1], end: ids[2], kind: 'arm', key: 'held-arm' });
  const analysis = preparePoseMotion(model, config, 0);
  assert.equal(analysis.driver, 'held-arm', 'Swing retains its arm preference');
  assert.deepEqual(buildPoseMotion(analysis, { style: 'flow', timing: 0, follow: 35, body: 0 }).tracks, []);
  const result = buildPoseMotion(analysis, { style: 'flow', timing: 0, follow: 35, body: 65, anchors: [0, 1000], contacts: false });
  assert.equal(result.impact, null); assert.deepEqual(result.anchors, [0, 1000]);
  const withPoses = buildPoseMotion(analysis, { style: 'flow', timing: 0, follow: 35, body: 65, contacts: false });
  assert.ok(withPoses.tracks.some(item => item.id === 0 && item.property === 'Translation'), 'a moving leg drives coordinated body weight');
});

test('native controller restrictions reject before changing the source', () => {
  const model = fixture(), before = structuredClone(model), analysis = preparePoseMotion(model, config, 0);
  assert.throws(() => buildPoseMotion(analysis, { timing: 80, body: 0 }, { rotation: true }), /restricted/i);
  assert.deepEqual(model, before);
  model.Sequences[1].Interval = [400, 700];
  assert.throws(() => buildPoseMotion(preparePoseMotion(model, config, 0), { body: 0 }), /shared/i);
});

test('a full-clip edit retains the outside-facing tangent at a shared curved endpoint', () => {
  const model = fixture(); model.Sequences[1].Interval = [1000, 2000];
  model.Bones[1].Rotation = { LineType: 3, Keys: [[0, 0], [500, 1.4], [1000, 0], [1500, -.3], [2000, .4]].map(([Frame, angle]) => ({ Frame, Vector: new Float32Array(rotation(angle)), InTan: new Float32Array(rotation(angle - .15)), OutTan: new Float32Array(rotation(angle + .2)) })) };
  const { output } = changed(model, { style: 'swing', timing: 70, follow: 35, body: 0, contacts: false });
  assert.deepEqual(output.Bones[1].Rotation.Keys.find(key => key.Frame === 1000).OutTan, model.Bones[1].Rotation.Keys.find(key => key.Frame === 1000).OutTan);
  for (const frame of [1000, 1073, 1250, 1489, 1734, 2000]) matricesEqual(model, output, frame, 1);
});

test('rounded native quaternion anchor bytes remain exact', () => {
  const model = fixture(); model.Bones[1].Rotation.Keys[1].Vector = new Float32Array([0, 0, .640625, .76171875]);
  const { output } = changed(model, { timing: 65, follow: 35, body: 0, contacts: false });
  for (const frame of [0, 500, 1000]) {
    assert.deepEqual(output.Bones[1].Rotation.Keys.find(k => k.Frame === frame).Vector, model.Bones[1].Rotation.Keys.find(k => k.Frame === frame).Vector);
    matricesEqual(model, output, frame);
  }
});

test('a held rounded quaternion remains the same native pose when an exact anchor key is inserted', () => {
  const model = fixture(), held = new Float32Array([.04736328125, .1552734076976776, .0383300818502903, .984375]);
  model.Bones[2].Rotation = { LineType: 1, Keys: [{ Frame: 100, Vector: held }] };
  const { result, output } = changed(model, { timing: 65, follow: 35, body: 60, contacts: true });
  assert.ok(result.tracks.some(item => item.id === 2 && item.property === 'Rotation'));
  assert.deepEqual(output.Bones[2].Rotation.Keys.find(key => key.Frame === 500).Vector, held);
  assert.deepEqual(sampleMovement(output, output.Bones[2], 'Rotation', 500, 0), Array.from(held));
  matricesEqual(model, output, 500);
  const nativeMatrices = item => {
    const rendererModel = { ...item, Nodes: allNodes(item), GeosetAnims: [], Materials: [], ParticleEmitters2: [], RibbonEmitters: [] };
    const renderer = new ModelRenderer(rendererModel);
    renderer.setFrame(500); renderer.update(0);
    const matrices = renderer.rendererData.nodes.map(node => Array.from(node.matrix));
    renderer.destroy();
    return matrices;
  };
  const before = nativeMatrices(model), after = nativeMatrices(output), evaluated = sampleNodeMatrices(output, 500, 0);
  assert.deepEqual(after, before, 'native playback keeps the same held pose at the new key');
  after.forEach((matrix, id) => matrix.forEach((value, i) => assert.ok(Math.abs(value - evaluated.get(id).elements[i]) < 1e-5)));
});

test('native rounded anchors stay exact while between-key fitting retains their sampled magnitude', () => {
  const rendererFor = model => new ModelRenderer({ ...model, Nodes: allNodes(model), GeosetAnims: [], Materials: [], ParticleEmitters2: [], RibbonEmitters: [] });
  const axis = new Vector3(.2, .3, .4).normalize();
  const rounded = (angle, magnitude) => new Float32Array(new Quaternion().setFromAxisAngle(axis, angle).toArray().map(value => value * magnitude));
  for (const LineType of [1, 2, 3]) {
    const model = fixture();
    model.Bones[1].Rotation = { LineType, Keys: [0, 500, 1000].map((Frame, i) => ({ Frame, Vector: rounded([0, 1.3, 0][i], .987), ...(LineType >= 2 ? { InTan: rounded([0, 1.1, 0][i], .992), OutTan: rounded([.1, 1.4, -.1][i], .989) } : {}) })) };
    const { output, result } = changed(model, { style: 'flow', timing: 70, body: 0, contacts: false, anchors: [0, 337, 721, 1000] });
    const before = rendererFor(model), after = rendererFor(output);
    for (const frame of result.anchors) {
      before.setFrame(frame); before.update(0); after.setFrame(frame); after.update(0);
      for (const node of before.rendererData.nodes) Array.from(node.matrix).forEach((value, i) => assert.ok(Math.abs(value - after.rendererData.nodes[node.node.ObjectId].matrix[i]) < 2e-5));
    }
    for (const frame of [336, 338, 720, 722]) {
      const right = result.anchors.findIndex(time => time > frame), from = result.anchors[right - 1], to = result.anchors[right];
      const source = from + poseMotionProgress((frame - from) / (to - from), 'flow', .7, false) * (to - from);
      before.setFrame(source); after.setFrame(frame);
      const expected = before.interp.quat(new Float32Array(4), model.Bones[1].Rotation), actual = after.interp.quat(new Float32Array(4), output.Bones[1].Rotation);
      assert.ok(Math.abs(Math.hypot(...actual) - Math.hypot(...expected)) < .001, 'adjacent milliseconds retain native magnitude instead of jumping to unit length');
    }
    if (LineType >= 2) {
      let largestMagnitudeError = 0;
      for (let frame = .25; frame < 1000; frame += .25) {
        const right = result.anchors.findIndex(time => time > frame), from = result.anchors[right - 1], to = result.anchors[right];
        const source = from + poseMotionProgress((frame - from) / (to - from), 'flow', .7, false) * (to - from);
        before.setFrame(source); after.setFrame(frame);
        const expected = before.interp.quat(new Float32Array(4), model.Bones[1].Rotation), actual = after.interp.quat(new Float32Array(4), output.Bones[1].Rotation);
        largestMagnitudeError = Math.max(largestMagnitudeError, Math.abs(Math.hypot(...actual) - Math.hypot(...expected)));
      }
      assert.ok(largestMagnitudeError < .004, 'native fractional-time magnitude fitting bounds rounded quaternion error without forcing unit handles');
    }
    before.destroy(); after.destroy();
  }
});

test('duplicate authored pose times retain the last key used by native playback', () => {
  const model = fixture(), duplicate = { Frame: 0, Vector: new Float32Array(rotation(.18)) };
  model.Bones[1].Rotation.Keys.splice(1, 0, duplicate);
  const { output } = changed(model, { timing: 70, body: 0 });
  assert.deepEqual(output.Bones[1].Rotation.Keys.findLast(key => key.Frame === 0).Vector, duplicate.Vector);
  const rendererFor = item => new ModelRenderer({ ...item, Nodes: allNodes(item), GeosetAnims: [], Materials: [], ParticleEmitters2: [], RibbonEmitters: [] });
  const before = rendererFor(model), after = rendererFor(output); before.setFrame(0); before.update(0); after.setFrame(0); after.update(0);
  assert.deepEqual(after.rendererData.nodes.map(node => Array.from(node.matrix)), before.rendererData.nodes.map(node => Array.from(node.matrix)));
  before.destroy(); after.destroy();
});

test('duplicate boundary keys preserve native interpolation in both adjoining clips', () => {
  const model = fixture();
  model.Sequences = [{ Name: 'Action', Interval: [0, 1000] }, { Name: 'Before', Interval: [-1000, 0] }, { Name: 'After', Interval: [1000, 2000] }];
  model.Bones[1].Rotation = { LineType: 3, Keys: [[-1000, -.3], [0, .15], [0, -.2], [500, 1.4], [1000, .4], [1000, -.1], [2000, .3]].map(([Frame, angle]) => ({ Frame, Vector: new Float32Array(rotation(angle)), InTan: new Float32Array(rotation(angle - .15)), OutTan: new Float32Array(rotation(angle + .2)) })) };
  const { output } = changed(model, { style: 'flow', timing: 70, body: 0, contacts: false });
  const rendererFor = item => new ModelRenderer({ ...item, Nodes: allNodes(item), GeosetAnims: [], Materials: [], ParticleEmitters2: [], RibbonEmitters: [] });
  const before = rendererFor(model), after = rendererFor(output);
  for (const frame of [-1000, -731.25, -51, -.25, 0, 1000, 1000.25, 1337.5, 2000]) {
    before.setFrame(frame); before.update(0); after.setFrame(frame); after.update(0);
    assert.deepEqual(after.rendererData.nodes.map(node => Array.from(node.matrix)), before.rendererData.nodes.map(node => Array.from(node.matrix)), `native pose at ${frame}`);
  }
  before.destroy(); after.destroy();
});

test('Step turns three authored stride poses into a lifted return and planted support using native keys', () => {
  for (const legCount of [2, 4]) {
    const { model, config, anchors } = stepFixture({ legCount }), original = structuredClone(model);
    const analysis = preparePoseMotion(model, config, 0), result = buildPoseMotion(analysis, { style: 'step', timing: 70, follow: 65, body: 35, contacts: true });
    const output = structuredClone(model); applyPoseMotion(output, result);
    assert.equal(result.impact, null); assert.deepEqual(result.anchors, anchors);
    for (const frame of anchors) matricesEqual(model, output, frame);
    const feet = config.chains.map(chain => samplePoseChain(output, chain, 250, 0));
    assert.ok(feet[0].end.z > 3, 'the return foot clears the floor');
    assert.ok(Math.abs(feet[1].end.z - 1) < .02, 'the supporting sole stays on the floor');
    assert.ok(result.tracks.every(item => ['Rotation', 'Translation'].includes(item.property)));
    assert.deepEqual(model, original); assert.deepEqual(output.Geosets, model.Geosets);
  }
});

test('dense Step retains the detailed source path when only timing is requested', () => {
  const { model, config } = stepFixture({ dense: true }), analysis = preparePoseMotion(model, config, 0);
  const result = buildPoseMotion(analysis, { style: 'step', timing: 70, follow: 0, body: 0, contacts: false });
  const output = structuredClone(model); applyPoseMotion(output, result);
  assert.equal(result.sparse, false); assert.equal(result.impact, null);
  for (const frame of result.anchors) matricesEqual(model, output, frame);
  for (const frame of [95, 221, 417, 703, 951]) {
    const right = result.anchors.findIndex(time => time > frame), from = result.anchors[right - 1], to = result.anchors[right];
    const source = from + poseMotionProgress((frame - from) / (to - from), 'step', .7, false) * (to - from);
    for (const chain of config.chains) assert.ok(samplePoseChain(output, chain, frame, 0).end.distanceTo(samplePoseChain(model, chain, source, 0).end) < .035);
  }
});

test('nearly straight extended legs converge inside the existing strict pin tolerance during small body settling', () => {
  const pivots = [[0, 0, 70], [0, 0, 64], [12, 0, 40], [18, 0, 28], [30, 0, 4]];
  const chain = { root: 1, middle: 2, end: 4, joints: [1, 2, 3, 4], kind: 'leg', key: 'extended' };
  for (const offset of [-.006, -.05, -.26]) {
    const model = { Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Parent: ObjectId ? ObjectId - 1 : null, PivotPoint, Flags: 256 })), Helpers: [], PivotPoints: pivots, Sequences: [{ Interval: [0, 1000] }], GlobalSequences: [] };
    const pose = samplePoseChain(model, chain, 500, 0);
    const result = solvePoseNode(model, 0, [{ chain, pinned: true, position: pose.end, orientation: pose.rotations[2].toArray() }], 500, 0, { mode: 'move', space: 'world', values: [0, 0, offset] });
    applyMovementPose(model, result.changes, 500, 0);
    const actual = samplePoseChain(model, chain, 500, 0);
    assert.ok(actual.end.distanceTo(pose.end) <= pose.tolerance * 4, `body offset ${offset}`);
    assert.ok(Math.abs(sampleMovement(model, model.Bones[0], 'Translation', 500, 0)[2] - offset) < 1e-6);
  }
});
