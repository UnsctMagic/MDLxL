import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { visitTracks } from '../src/animation.js';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { isolateGlobalSequence } from '../src/global-sequence-preview.js';

// The four walkers visitTracks replaced, copied as they were, so the shared walk
// can be checked against each caller's own policy.
function oldSequenceEditorWalk(model) {
  const calls = [], seen = new Set();
  const isTrack = value => value && Array.isArray(value.Keys);
  function visit(value, owner, property) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    if (isTrack(value)) calls.push(['track', value, owner, property]);
    if (value.EventTrack && (ArrayBuffer.isView(value.EventTrack) || Array.isArray(value.EventTrack))) calls.push(['event', value]);
    for (const [key, child] of Object.entries(value)) {
      if (key === 'Keys' || key === 'EventTrack' || key === 'Interval' || key === 'Anims') continue;
      if (Array.isArray(child)) for (const item of child) visit(item, child, null);
      else visit(child, value, key);
    }
  }
  visit(model, null, null);
  return calls;
}
function oldTimingRecords(model, privateKeys) {
  const tracks = [], events = [], seen = new Set();
  function visit(value, path) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value.Keys)) { tracks.push({ value, path }); return; }
    if (value.EventTrack) events.push({ value, path });
    for (const [key, child] of Object.entries(value)) {
      if (privateKeys.has(key) || key === 'Nodes' || key === 'EventTrack') continue;
      visit(child, [...path, Array.isArray(value) ? Number(key) : key]);
    }
  }
  visit(model, []);
  return { tracks, events };
}
function oldClassicWalk(model) {
  const found = [], visited = new WeakSet();
  function visit(value) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value.Keys)) { found.push(value); return; }
    for (const child of Object.values(value)) visit(child);
  }
  visit(model);
  return found;
}
function oldGlobalPreviewWalk(model) {
  const found = [], seen = new Set();
  function visit(owner) {
    if (!owner || typeof owner !== 'object' || ArrayBuffer.isView(owner) || seen.has(owner)) return;
    seen.add(owner);
    for (const [property, value] of Object.entries(owner)) {
      if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) continue;
      if (Array.isArray(value.Keys)) found.push([value, owner, property]);
      visit(value);
    }
  }
  visit(model);
  return found;
}

const track = (GlobalSeqId, ...frames) => ({ LineType: 1, GlobalSeqId, Keys: frames.map(Frame => ({ Frame, Vector: new Float32Array([Frame]) })) });

function models() {
  const demo = createDemoDocument().model;
  const busy = createDemoDocument().model;
  busy.GlobalSequences = [400, 900];
  const event = createNode(busy, 'EventObject');
  event.EventTrack = new Uint32Array([10, 120]);
  const globalEvent = createNode(busy, 'EventObject');
  globalEvent.EventTrack = [30]; globalEvent.GlobalSeqId = 1;
  const bone = busy.Bones[0];
  bone.Scaling = track(0, 0, 200);
  bone.Rotation = track(null, 0, 50);
  busy.TextureAnims = [{ Translation: track(1, 0, 900) }];
  busy.Materials[0].Layers[0].Alpha = track(null, 0, 100);
  const list = [['demo', demo], ['busy', busy]];
  for (const file of ['test/fixtures/demo.mdx', 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx'])
    if (fs.existsSync(file)) list.push([file, openDocument(new Uint8Array(fs.readFileSync(file)), file).model]);
  return list;
}

test('visitTracks visits what each replaced walker visited, in the same order', () => {
  for (const [name, model] of models()) {
    const tracks = oldClassicWalk(model);
    assert.ok(tracks.length > 0, name);

    // classic-keyframes: everything, Nodes aliases walked once.
    const classic = [];
    visitTracks(model, value => classic.push(value));
    assert.deepEqual(classic, tracks, name);

    // sequence-editor visitModel: (track, owner, property) and event records.
    const calls = [];
    visitTracks(model, (value, { owner, property }) => calls.push(['track', value, owner, Array.isArray(owner) ? null : property]), {
      skip: ['Keys', 'EventTrack', 'Interval', 'Anims'], event: value => calls.push(['event', value]),
    });
    assert.deepEqual(calls, oldSequenceEditorWalk(model), name);
    assert.ok(name !== 'busy' || calls.some(([kind]) => kind === 'event'));

    // animation-speed timingRecords: paths with numeric array positions.
    const privateKeys = new Set(['_a', '_b']);
    const records = { tracks: [], events: [] };
    visitTracks(model, (value, { path }) => records.tracks.push({ value, path }), {
      skip: [...privateKeys, 'Nodes', 'EventTrack'], event: (value, { path }) => records.events.push({ value, path }),
    });
    assert.deepEqual(records, oldTimingRecords(model, privateKeys), name);

    // global-sequence-preview: each track reached from exactly one owner.
    const owners = [];
    visitTracks(model, (value, { owner, property }) => owners.push([value, owner, property]));
    const old = oldGlobalPreviewWalk(model).map(([value, owner, property]) => [value, owner, Array.isArray(owner) ? Number(property) : property]);
    assert.deepEqual(owners, old, name);
  }
});

test('global preview still freezes every other track from its own owner', () => {
  const model = models()[1][1];
  const preview = isolateGlobalSequence(structuredClone(model), 1);
  assert.equal(preview.TextureAnims[0].Translation.GlobalSeqId, 1);
  assert.equal(preview.TextureAnims[0].Translation.Keys.length, 2);
  for (const [value, owner, property] of oldGlobalPreviewWalk(preview)) {
    if (value.GlobalSeqId === 1) continue;
    assert.ok(value.LineType === 0 && value.Keys.length <= 1 && value.Keys[0]?.Frame === 0, `${property} frozen`);
    assert.equal(owner[property], value);
  }
});
