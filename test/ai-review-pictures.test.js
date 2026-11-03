import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDocument } from '../src/editor-document.js';
import { createRequire } from 'node:module';
import { beginAiReview, recordAiChange, reviewAiModel, aiCheckpoint, touchedAnimations, nativeCandidateChecks } from '../app/ai-review.js';
import { AI_TOOLS } from '../src/ai-tools.js';
import { createChanges } from '../src/history-store.js';
import { encodeAiValue } from '../src/ai-model.js';
import { createVersionStore } from '../src/ai-versions.js';
const reviewFixture = new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url);
const { choosePictures } = createRequire(import.meta.url)('../electron/ai-service.cjs');

// One bone and one triangle; Portrait Talk 0–100, Walk 200–400 (the flail swings in Walk).
const key = (Frame, x) => ({ Frame, Vector: new Float32Array([x, 0, 0]) });
function unit(walk = [key(200, 0), key(300, 5), key(400, 0)]) {
  return {
    Sequences: [
      { Name: 'Portrait Talk', Interval: new Uint32Array([0, 100]) },
      { Name: 'Walk', Interval: new Uint32Array([200, 400]) },
    ],
    GlobalSequences: [],
    PivotPoints: [new Float32Array([0, 0, 0])],
    Bones: [{ ObjectId: 0, Name: 'Bone_Flail', Parent: -1, Flags: 256, Translation: { LineType: 1, GlobalSeqId: -1, Keys: [key(0, 0), ...walk] } }],
    Helpers: [],
    Geosets: [{ Vertices: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]), VertexGroup: new Uint8Array([0, 0, 0]), Groups: [[0]], Faces: new Uint16Array([0, 1, 2]) }],
  };
}
// The editor as ai-review sees it: one task tab showing Portrait Talk, an AI-only donor, and an
// off-screen renderer that records what each picture was asked to draw.
function editor({ sequence = 0, frame = 50 } = {}) {
  const sessions = [
    { id: 'target', doc: { name: 'Flail08.mdx', model: unit(), revision: 1, captureRecoveryState: () => ({}), rememberSerializedSnapshot() {} } },
    { id: 'donor', doc: { name: 'Flail07.mdx', model: { ...unit(), Sequences: [{ Name: 'Walk', Interval: new Uint32Array([1000, 1800]) }] } } },
  ];
  const target = { documentId: 'target', sequence, frame, globalSequence: null, selection: {} };
  const drawn = [];
  const bridge = {
    targets: new Map([['t', target]]),
    versionStore: createVersionStore(),
    requireTarget: () => target,
    state: () => ({ sessions: [sessions[0]] }),
    referenceSessions: () => sessions.slice(1),
    env: () => ({ live: true, model: sessions[0].doc.model, doc: sessions[0].doc, session: { assets: [] }, state: { model: sessions[0].doc.model, hiddenGeosets: new Set(), view: 'perspective', sequence: target.sequence, time: target.frame } }),
    context: () => ({}),
    contextFor: () => ({}),
    picture: async (id, sample, source = {}) => {
      drawn.push({ sample, source: source.documentId || (source.model ? 'original' : 'edited'), model: source.model, focus: source.focus });
      return { image: 'data:image/png;base64,YQ==' };
    },
    dispatch: async name => (name === 'mdlxl_document' ? { results: [{ format: 'mdx', diagnostics: [] }] } : { samples: [] }),
  };
  // Checkpoints fingerprint the saved bytes through the save worker.
  globalThis.Worker = class {
    postMessage(input) {
      const snapshot = structuredClone(input);
      if (snapshot.specifications) {
        import('../app/ai-native-measure.js').then(({ measureNativeCandidate }) => measureNativeCandidate(snapshot))
          .then(result => this.onmessage({ data: { result } }), error => this.onmessage({ data: { error: error.message } }));
      } else setTimeout(() => this.onmessage({ data: { bytes: new Uint8Array([1]) } }));
    }
    terminate() {}
  };
  globalThis.window = { desktop: { aiScript: async ({ model, before }) => ({ value: [{ name: 'flail swings', passed: true }], model, before }) } };
  // The worker's edit: Flail07's swing copied into Flail08's Walk only.
  const edit = async () => {
    await beginAiReview(bridge, 't');
    const model = sessions[0].doc.model;
    model.Bones[0].Translation.Keys = [key(0, 0), key(200, 0), key(300, 30), key(400, 0)];
    sessions[0].doc.revision++;
    recordAiChange(target.review, {}, model);
  };
  return { bridge, target, sessions, drawn, edit };
}
const inspect = (bridge, extra = {}) => reviewAiModel(bridge, { target: 't', action: 'inspect', checksCode: 'return []', ...extra }, {});

test('an animation edit is found by the keys it changed, not by the animation on screen', () => {
  const before = unit(), after = unit([key(200, 0), key(300, 30), key(400, 0)]);
  assert.deepEqual(touchedAnimations(createChanges(before, after), before, after), { sequences: [1], globalSequences: [] });
  const global = unit();
  global.GlobalSequences = [500];
  global.Bones[0].Rotation = { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 100, Vector: new Float32Array([0, 0, 0, 1]) }] };
  const turned = structuredClone(global);
  turned.Bones[0].Rotation.Keys[0].Vector = new Float32Array([0, 0, 1, 0]);
  assert.deepEqual(touchedAnimations(createChanges(global, turned), global, turned), { sequences: [], globalSequences: [0] }, 'a global key at 100 is not Portrait Talk');
});

test('with Portrait Talk on screen, a Walk edit is reviewed with matching original and edited Walk poses', async () => {
  const { bridge, drawn, edit } = editor();
  await edit();
  const result = await inspect(bridge, { frames: [200, 300, 400] });
  assert.equal(result.review.compared.animation, '"Walk" (sequence 1)');
  assert.deepEqual(result.images.map(i => i.role), ['original', 'edited', 'original', 'edited', 'original', 'edited']);
  assert.ok(result.images.every(i => /Walk/.test(i.label) && !/Portrait/.test(i.label)), 'no Portrait Talk picture');
  assert.match(result.images[2].label, /^Original target before the task; "Walk" \(sequence 1\); 50% through; frame 300$/);
  for (let i = 0; i < drawn.length; i += 2) {
    const [original, edited] = [drawn[i], drawn[i + 1]];
    assert.equal(original.source, 'original');
    assert.equal(original.model.Bones[0].Translation.Keys[2].Vector[0], 5, 'the original is the kept model, not the edited one');
    assert.deepEqual(original.sample, edited.sample, 'same animation and frame');
    assert.deepEqual(original.focus, edited.focus, 'same framing');
    assert.equal(original.focus.length, 48, 'framed on both posed models (8 corners each)');
  }
  assert.deepEqual(drawn.map(d => d.sample.frame), [200, 200, 300, 300, 400, 400]);
});

test('a donor adds its matching phases, mapped across a different frame range', async () => {
  const { bridge, drawn, edit } = editor();
  await edit();
  const result = await inspect(bridge, { donor: { documentId: 'donor' }, frames: [200, 300, 400] });
  assert.deepEqual(result.images.map(i => i.role), ['original', 'edited', 'donor', 'original', 'edited', 'donor', 'original', 'edited', 'donor']);
  assert.deepEqual(drawn.filter(d => d.source === 'donor').map(d => d.sample.frame), [1000, 1400, 1800]);
  assert.match(result.images[5].label, /^Donor Flail07\.mdx; "Walk" \(sequence 0\); 50% through; frame 1400$/);
  assert.equal(result.review.compared.donor, 'Flail07.mdx: "Walk" (sequence 0)');
  await assert.rejects(inspect(bridge, { donor: { documentId: 'target' } }), /reference attached to this chat/);
  await assert.rejects(inspect(bridge, { donor: { documentId: 'donor', sequence: 4 } }), /Donor: animation index is out of range/);
});

test('switching the view to Attack and resuming keeps comparing Walk against the kept original', async () => {
  const { bridge, target, drawn, edit } = editor();
  await edit();
  const saved = await aiCheckpoint(bridge, 't', { includeBaseline: true });
  // The app restarts: the review is rebuilt from the saved baseline, while the user shows another animation.
  delete target.review;
  Object.assign(target, { sequence: 0, frame: 10 });
  await aiCheckpoint(bridge, 't', { baseline: saved.baseline, restoreReview: saved.review });
  const result = await inspect(bridge, { frames: [200, 300, 400] });
  assert.equal(result.review.compared.animation, '"Walk" (sequence 1)');
  assert.equal(drawn[0].model.Bones[0].Translation.Keys[2].Vector[0], 5, 'the original survives the resume');
  assert.equal(result.images.length, 6);
});

test('a missing original animation is said plainly instead of comparing the wrong pose', async () => {
  const { bridge, target, edit } = editor();
  await edit();
  target.review.before.Sequences[1].Name = 'Walk Old';
  const result = await inspect(bridge, { frames: [200, 300, 400] });
  assert.deepEqual(result.images.map(i => i.role), ['edited', 'edited', 'edited']);
  assert.match(result.review.missingEvidence[0], /original model has no "Walk"/);
});

test('too many pictures for one result is refused, not cut off', async () => {
  const { bridge, edit } = editor();
  await edit();
  await assert.rejects(inspect(bridge, { donor: { documentId: 'donor' }, turnaround: true, frames: [200, 250, 300, 350, 400] }), /more than 16 pictures/);
});

test('the outside check gets whole comparison groups spread over the animation, never a cut-off tail', () => {
  const images = [];
  for (const frame of [0, 10, 20, 30, 40]) for (const role of ['original', 'edited', 'donor']) images.push({ role, group: `frame ${frame}`, label: `${role} ${frame}` });
  for (const side of ['front', 'back']) images.push({ role: 'edited', group: `${side} view`, label: side });
  const { pictures, left } = choosePictures(images, 12);
  const frames = [...new Set(pictures.map(p => p.group))];
  assert.deepEqual(frames, ['frame 0', 'frame 10', 'frame 30', 'frame 40'], 'four whole phases, first and last included');
  assert.ok(frames.every(f => pictures.filter(p => p.group === f).length === 3), 'each phase keeps original, edited and donor');
  assert.deepEqual(left, ['original 20', 'edited 20', 'donor 20', 'front', 'back']);
  // Small sets go through whole.
  assert.equal(choosePictures(images.slice(0, 9)).pictures.length, 9);
});

test('the kept original is encoded with the checkpoint and restored on resume', async () => {
  const { bridge, edit } = editor();
  await edit();
  const saved = await aiCheckpoint(bridge, 't', { includeBaseline: true });
  assert.deepEqual(saved.review.sequences, [1]);
  assert.deepEqual(saved.baseline, encodeAiValue(bridge.targets.get('t').review.before));
});

test('review returns app-owned motion for touched animations only and reuses it at the same revision', async () => {
  const { bridge, target, edit, sessions } = editor(); await edit();
  const first = await inspect(bridge), cached = target.review.motionCache.value;
  assert.deepEqual(first.review.motion.sequences.map(s => s.sequence), [1]);
  assert.match(first.review.motion.source, /MDLxL/);
  assert.equal(first.review.motion.sequences[0].distance.distance, 25);
  assert.ok(!('perFrame' in first.review.motion.sequences[0]), 'tool output is the compact table');
  await inspect(bridge); assert.equal(target.review.motionCache.value, cached);
  sessions[0].doc.model.Bones[0].Translation.Keys[2].Vector[0] = 40;
  sessions[0].doc.revision++; recordAiChange(target.review, {}, sessions[0].doc.model);
  assert.equal((await inspect(bridge)).review.motion.sequences[0].distance.distance, 35);
  assert.notEqual(target.review.motionCache.value, cached);
});

test('an accepted baseline replaces checks before, pictures and motion in a follow-up from a rejected candidate', async () => {
  const { bridge, target, sessions, edit, drawn } = editor();
  bridge.versionStore.save('target', 'accepted', unit(), 'Owner accepted this motion');
  await edit(); // a rejected 30-unit swing becomes the next job's starting state
  delete target.review; await beginAiReview(bridge, 't');
  sessions[0].doc.model.Bones[0].Translation.Keys[2].Vector[0] = 40;
  sessions[0].doc.revision++; recordAiChange(target.review, {}, sessions[0].doc.model);
  let checked;
  window.desktop.aiScript = async payload => {
    checked = payload;
    payload.references['version:accepted'].model.Bones[0].Translation.Keys[2].Vector[0] = -100;
    return { value: [{ name: 'accepted motion', passed: true }], model: payload.model, before: payload.before };
  };
  const result = await inspect(bridge, { baseline: 'accepted' });
  assert.equal(checked.before.Bones[0].Translation.Keys[2].Vector[0], 5);
  assert.equal(drawn[0].model.Bones[0].Translation.Keys[2].Vector[0], 5);
  assert.equal(result.review.motion.sequences[0].distance.distance, 35);
  assert.equal(result.review.baseline, 'accepted'); assert.match(result.images[0].label, /version "accepted"/);
  assert.equal(bridge.versionStore.get('target', 'accepted').Bones[0].Translation.Keys[2].Vector[0], 5, 'checks receive detached references');
  assert.equal(target.review.before.Bones[0].Translation.Keys[2].Vector[0], 30, 'job baseline remains available');
  await assert.rejects(inspect(bridge, { baseline: 'missing' }), /no version/);
});

test('plan sweeps reuse one revision and remeasure edited and named baseline versions', async () => {
  const { bridge, sessions, target, edit } = editor();
  const model = sessions[0].doc.model;
  // Two pivots: only the first follows the edited track.
  model.Helpers.push({ ObjectId: 1 });
  await edit();
  bridge.versionStore.save('target', 'candidate', model);
  const sweepChecks = [{ name: 'relative drift', sweep: { kind: 'attached', a: { nodeId: 0 }, b: { nodeId: 1 } } }];
  const read = async extra => (await inspect(bridge, { sweepChecks, ...extra })).review.sweeps;
  const first = await read();
  assert.equal(first?.[0].edited.worst.value, 30);
  assert.equal(first[0].before.worst.value, 5);
  assert.strictEqual(await read(), first);
  const outside = () => reviewAiModel(bridge, { target: 't', action: 'status', sweepChecks }, {});
  assert.strictEqual((await outside()).sweeps, first, 'outside check shares the inspected revision');

  model.Bones[0].Translation.Keys[2].Vector[0] = 42;
  sessions[0].doc.revision++; recordAiChange(target.review, {}, model);
  const [next] = await read({ baseline: 'candidate' });
  assert.equal(next.edited.worst.value, 42);
  assert.equal(next.before.worst.value, 30);
  const refreshed = (await outside()).sweeps;
  assert.equal(refreshed[0].edited.worst.value, 42);
  assert.equal(refreshed[0].before.worst.value, 5);
  assert.strictEqual(await read(), refreshed);
});

test('implicit pictures add worst-difference and worst-speed frames and label their measured distances', async () => {
  const { bridge, target, sessions } = editor({ sequence: 1 });
  await beginAiReview(bridge, 't');
  sessions[0].doc.model.Bones[0].Translation.Keys = [key(0, 0), key(200, 0), key(245, 35), key(300, 5), key(400, 0)];
  sessions[0].doc.revision++; recordAiChange(target.review, {}, sessions[0].doc.model);
  const result = await inspect(bridge), row = result.review.motion.sequences[0];
  const frames = result.images.filter(i => i.role === 'edited').map(i => Number(/frame ([\d.]+)/.exec(i.label)[1]));
  for (const f of [200, 300, 400, row.distance.frame, row.speedDifference.frame]) assert.ok(frames.includes(f), `frame ${f}`);
  assert.ok(result.images.every(i => /measured distance/.test(i.label))); assert.ok(result.images.length <= 16);
  const chosen = choosePictures(result.images, 6).pictures;
  assert.ok(chosen.some(i => i.group.startsWith(`frame ${row.distance.frame};`)));
  const explicit = await inspect(bridge, { frames: [200, 300, 400] });
  assert.equal(explicit.images.length, 6); assert.ok(explicit.images.every(i => !/measured distance/.test(i.label)));
});

test('implicit pictures cover other touched animations, most different first, within both budgets', async () => {
  const { bridge, target, sessions } = editor();
  await beginAiReview(bridge, 't');
  const model = sessions[0].doc.model;
  model.Bones[0].Translation.Keys = [key(0, 0), key(40, 8), key(100, 0), key(200, 0), key(260, 35), key(400, 0)];
  sessions[0].doc.revision++; recordAiChange(target.review, {}, model);
  const result = await inspect(bridge);
  assert.deepEqual(result.review.motion.sequences.map(s => s.sequence), [0, 1]);
  assert.ok(result.images.some(i => /Walk/.test(i.label)));
  assert.ok(result.images.some(i => /Portrait Talk/.test(i.label)));
  assert.ok(result.images.length <= 16);
  const chosen = choosePictures(result.images).pictures;
  assert.ok(chosen.length <= 12); assert.ok(chosen.some(i => /Walk/.test(i.label))); assert.ok(chosen.some(i => /Portrait Talk/.test(i.label)));
  const groups = [...new Set(chosen.map(i => i.group))];
  assert.ok(groups.every(g => chosen.filter(i => i.group === g).length === 2));
});

test('a changed global controller is measured in every local clip that plays it as well as its isolated clock', async () => {
  const { bridge, target, sessions } = editor();
  const model = sessions[0].doc.model;
  model.GlobalSequences = [100];
  model.Bones[0].Translation = { LineType: 1, GlobalSeqId: 0, Keys: [key(0, 0), key(50, 5), key(100, 0)] };
  await beginAiReview(bridge, 't');
  model.Bones[0].Translation.Keys[1].Vector[0] = 10;
  sessions[0].doc.revision++; recordAiChange(target.review, {}, model);
  const result = await inspect(bridge, { globalSequence: 0, frames: [0, 50, 100] });
  assert.deepEqual(result.review.motion.sequences.map(row => row.globalSequence == null ? row.sequence : 'global:' + row.globalSequence), [0, 1, 'global:0']);
  assert.ok(result.review.motion.sequences.every(row => row.distance.distance === 5));
});


test('explicit owner acceptance uses the same review completion path after a blocked inspection', async () => {
  const { bridge, target, edit } = editor();
  await edit();
  await inspect(bridge);
  await reviewAiModel(bridge, { target: 't', action: 'finish', outcome: 'blocked', summary: 'Missing pictures.' }, {});
  const result = await reviewAiModel(bridge, { target: 't', action: 'finish', outcome: 'passed', acceptedByUser: true, summary: 'Owner accepted the current result; missing pictures remain a note.' }, {});
  assert.equal(result.phase, 'verified');
  assert.match(result.summary, /Owner accepted/);
  assert.equal(target.review.acceptedByUser, true);
});

test('native review catches a stretched rigid plate even if custom code passes, and captures its worst part', async () => {
  const { bridge, sessions, target, drawn } = editor();
  await beginAiReview(bridge, 't');
  sessions[0].doc.model.Geosets[0].Vertices[3] = 20;
  sessions[0].doc.revision++;
  recordAiChange(target.review, {}, sessions[0].doc.model);
  const nativeChecks = [{ name: 'Plate', rig: { rigidParts: [{ geoset: 0, driverBone: 0 }] } }];
  const result = await inspect(bridge, { nativeChecks });
  assert.equal(result.review.passed, false, 'an attached but stretched plate cannot be verified');
  assert.ok(result.review.checks.some(check => /Plate.*rigid shape/.test(check.name) && check.passed === false));
  assert.ok(result.images.some(image => /Native worst.*geoset 1/i.test(image.label)), 'native worst part gets actual evidence');
  assert.ok(drawn.some(draw => draw.sample.geosets?.[0] === 0), 'native capture isolates the affected geoset');
});


test('native checks use the original Knight even when a named visual baseline already contains the damage', async () => {
  const { bridge, sessions, target } = editor({ sequence: 0, frame: 0 });
  sessions[0].doc.model = openDocument(fs.readFileSync(reviewFixture), 'Tzeentch_Knight_Max_Reduced.mdx').model;
  const model = sessions[0].doc.model, snapshot = structuredClone(model);
  const driver = model.Geosets[0].Groups[model.Geosets[0].VertexGroup[0]][0];
  await beginAiReview(bridge, 't');
  model.Geosets[0].Vertices[3] += 100;
  sessions[0].doc.revision++;
  recordAiChange(target.review, {}, model);
  bridge.versionStore.save('target', 'damaged candidate', model);
  const result = await inspect(bridge, { baseline: 'damaged candidate', nativeChecks: [{ name: 'Knight part', rig: { rigidParts: [{ geoset: 0, vertices: [0, 1, 2], driverBone: driver }], sequences: [0], step: 100 } }] });
  assert.equal(result.review.passed, false);
  assert.ok(result.review.checks.some(row => /rigid shape/.test(row.name) && !row.passed), 'native original cannot be replaced by a damaged named candidate');
  assert.equal(result.review.native.baseline, 'original job model');
  assert.deepEqual(target.review.before, snapshot);
  assert.equal(bridge.versionStore.get('target', 'damaged candidate').Geosets[0].Vertices[3], model.Geosets[0].Vertices[3]);
});

test('unmatched native rig topology remains unverified even with passing custom checks', async () => {
  const { bridge, sessions, target } = editor();
  await beginAiReview(bridge, 't');
  sessions[0].doc.model.Geosets[0].Faces = new Uint16Array([0, 2, 1]);
  sessions[0].doc.revision++;
  recordAiChange(target.review, {}, sessions[0].doc.model);
  const result = await inspect(bridge, { nativeChecks: [{ name: 'Plate', rig: { rigidParts: [{ geoset: 0, driverBone: 0 }] } }] });
  assert.equal(result.review.passed, false);
  assert.ok(result.review.checks.some(row => /rigid shape/.test(row.name) && !row.passed && row.actual.unmeasured.length));
});


test('empty native rig specifications cannot certify an unchanged model', async () => {
  const model = unit();
  await assert.rejects(nativeCandidateChecks(model, model, [{ name: 'Empty rig', rig: {} }]), /rig.*part|rig.*role/i);
});

test('a failed native review cannot be bypassed by omitting its mandatory checks on the next inspect', async () => {
  const { bridge, sessions, target } = editor();
  await beginAiReview(bridge, 't');
  sessions[0].doc.model.Geosets[0].Vertices[3] = 20;
  sessions[0].doc.revision++;
  recordAiChange(target.review, {}, sessions[0].doc.model);
  const nativeChecks = [{ name: 'Plate', rig: { rigidParts: [{ geoset: 0, driverBone: 0 }] } }];
  assert.equal((await inspect(bridge, { nativeChecks })).review.passed, false);
  assert.equal((await inspect(bridge)).review.passed, false, 'omitted specifications still run the agreed native checks');
  await assert.rejects(inspect(bridge, { nativeChecks: [] }), /retain.*native|native.*remove/i);
});


test('merged review confines against latest user data while measuring original rig identity', async () => {
  const { bridge, sessions, target } = editor();
  const original = structuredClone(sessions[0].doc.model);
  sessions[0].doc.model.Geosets[0].Vertices[3] = 20;
  sessions[0].doc.model.Textures = [{ Image: 'UserLatest.blp' }];
  await beginAiReview(bridge, 't');
  sessions[0].doc.revision++;
  recordAiChange(target.review, {}, sessions[0].doc.model);
  const result = await inspect(bridge, { nativeBaseline: encodeAiValue(original), nativeChecks: [{ name: 'Plate', editing: { scope: ['/Geosets/0'] }, rig: { rigidParts: [{ geoset: 0, driverBone: 0 }] } }] });
  assert.equal(result.review.passed, false, 'fresh merge baseline cannot erase original rigid damage');
  assert.equal(result.review.checks.find(row => /material preservation/.test(row.name)).passed, true, 'the latest user texture is protected against further edits');
  assert.equal(result.review.checks.find(row => /rigid shape/.test(row.name)).passed, false);
});


test('native candidate inspection snapshots caller inputs before asynchronous work', async () => {
  const before = unit(), candidate = structuredClone(before), nativeChecks = [{ name: 'Plate', rig: { rigidParts: [{ geoset: 0, driverBone: 0 }] } }];
  const pending = nativeCandidateChecks(before, candidate, nativeChecks);
  candidate.Geosets[0].Vertices[3] = 100;
  nativeChecks[0].rig.rigidParts[0].driverBone = 999;
  const result = await pending;
  assert.ok(result.checks.every(row => row.passed), 'concurrent caller mutations cannot mix a later candidate/spec into the captured comparison');
  assert.equal(before.Geosets[0].Vertices[3], 10);
});

test('native worst pose isolates the full declared part with matching close-up framing', async () => {
  const { bridge, sessions, target, drawn } = editor();
  const geo = sessions[0].doc.model.Geosets[0];
  geo.Vertices = new Float32Array([...geo.Vertices, 1000, 0, 0, 1010, 0, 0, 1000, 10, 0]);
  geo.Faces = new Uint16Array([0, 1, 2, 3, 4, 5]); geo.VertexGroup = new Uint8Array(6);
  await beginAiReview(bridge, 't'); geo.Vertices[3] = 20;
  sessions[0].doc.revision++; recordAiChange(target.review, {}, sessions[0].doc.model);
  const result = await inspect(bridge, { nativeChecks: [{ name: 'Near plate', rig: { rigidParts: [{ geoset: 0, driverBone: 0, vertices: [0, 1, 2] }] } }] });
  const pictures = drawn.filter(draw => draw.sample.geosets?.length && draw.model);
  assert.ok(pictures.length >= 2);
  assert.ok(pictures.every(draw => draw.model.Geosets[0].Faces.length === 3), 'the far disconnected piece cannot appear in a declared-part comparison');
  assert.ok(pictures.every(draw => Math.max(...draw.focus) <= 25), 'both roles frame the full declared part rather than the whole geoset');
  assert.ok(result.images.some(image => /Native worst/.test(image.label)));
});

test('merge cannot reuse original selected vertex IDs after the source topology changed', async () => {
  const { bridge, sessions, target } = editor(); const original = structuredClone(sessions[0].doc.model);
  sessions[0].doc.model.Geosets[0].Faces = new Uint16Array([0, 2, 1]);
  await beginAiReview(bridge, 't'); sessions[0].doc.revision++; recordAiChange(target.review, {}, sessions[0].doc.model);
  const result = await inspect(bridge, { nativeBaseline: encodeAiValue(original), nativeChecks: [{ name: 'Original region', editing: { scope: ['/Geosets/0'], selection: { 0: [0, 1, 2] } } }] });
  assert.equal(result.review.passed, false, 'original selection identity must be re-resolved or left unverified');
  assert.ok(result.review.checks.some(row => /original selection correspondence/.test(row.name) && !row.passed));
});


test('native byte goals use trusted document bytes without exposing them or accepting provider bytes', async () => {
  const bytes = new Uint8Array(fs.readFileSync(reviewFixture)), model = openDocument(bytes, 'Tzeentch_Knight_Max_Reduced.mdx').model;
  const nativeChecks = [{ name: 'Actual saved bytes', editing: { operation: 'optimization', scope: ['/Geosets'], optimization: { measureBytes: true, maxBytes: bytes.length, sourceBytes: new Uint8Array([1]) } } }];
  const result = await nativeCandidateChecks(model, model, nativeChecks, undefined, { originalBytes: bytes });
  assert.equal(result.reports[0].editing.optimization.beforeBytes, bytes.length);
  assert.equal(result.reports[0].editing.optimization.afterBytes, bytes.length);
  assert.equal(result.checks.find(row => /serialized size/.test(row.name)).passed, true);
  assert.ok(!JSON.stringify(result).includes('sourceBytes'), 'trusted bytes never reach the provider report');
  assert.deepEqual(nativeChecks[0].editing.optimization.sourceBytes, new Uint8Array([1]), 'provider input is unchanged');
  await assert.rejects(nativeCandidateChecks(model, model, nativeChecks), /trusted source MDX bytes/);
});


test('a clipless model accepts one explicit review frame and returns a matched static pair', async () => {
  assert.equal(AI_TOOLS.find(tool => tool.name === 'mdlxl_review').inputSchema.properties.frames.minItems, 1);
  for (const changesTrack of [false, true]) {
    const { bridge, sessions, target, drawn } = editor({ sequence: -1, frame: 0 });
    sessions[0].doc.model.Sequences = [];
    await beginAiReview(bridge, 't');
    if (changesTrack) sessions[0].doc.model.Bones[0].Translation.Keys[0].Vector[0] += 1;
    else sessions[0].doc.model.Geosets[0].Vertices[0] += 1;
    sessions[0].doc.revision++; recordAiChange(target.review, {}, sessions[0].doc.model);
    const result = await inspect(bridge, { frames: [17] });
    assert.equal(result.review.passed, true);
    assert.deepEqual(result.images.map(image => image.role), ['original', 'edited']);
    assert.ok(drawn.every(picture => picture.sample.sequence === -1 && picture.sample.frame === 17));
  }
});


test('native verdict repairs a frozen original against the named driver without a repaired donor', async () => {
  const original = unit();
  original.Bones.push({ ObjectId: 1, Name: 'Frozen helper', Parent: -1 });
  original.Geosets[0].Groups = [[1]];
  const contract = [{ name: 'Shield follows arm', rig: { rigidParts: [{ geoset: 0, driverBone: 0 }] } }];
  const broken = await nativeCandidateChecks(original, original, contract);
  assert.ok(broken.checks.some(check => /driver attachment/.test(check.name) && !check.passed), 'an unchanged frozen original still violates the named driver contract');
  const repaired = structuredClone(original);
  repaired.Geosets[0].Groups = [[0]];
  const corrected = await nativeCandidateChecks(original, repaired, contract);
  assert.ok(corrected.checks.every(check => check.passed), 'the repaired binding satisfies the same shape and attachment contract without a golden model');
  assert.deepEqual(original.Geosets[0].Groups, [[1]], 'native review preserves the broken input');
});
