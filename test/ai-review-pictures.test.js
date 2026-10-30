import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beginAiReview, recordAiChange, reviewAiModel, aiCheckpoint, touchedAnimations } from '../app/ai-review.js';
import { createChanges } from '../src/history-store.js';
import { encodeAiValue } from '../src/ai-model.js';
import { createVersionStore } from '../src/ai-versions.js';
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
    postMessage() { setTimeout(() => this.onmessage({ data: { bytes: new Uint8Array([1]) } })); }
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
