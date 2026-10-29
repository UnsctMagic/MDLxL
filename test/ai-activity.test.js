import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { prepareAiEdit, applyAiEdit } from '../src/ai-model.js';
import { createAiActivity, activityTarget, changedActivity, ACTIVITY_VERTEX_LIMIT } from '../app/ai-activity.js';
import { createRenderScheduler } from '../app/viewport-performance.js';

function commit(mutator) {
  const doc = createStarterDocument(), before = structuredClone(doc.model);
  const candidate = structuredClone(before); mutator(candidate);
  const prepared = prepareAiEdit(before, candidate, { scope: ['/Geosets'] });
  let changes = [];
  doc.apply('Fixture', prepared.sections, model => applyAiEdit(model, prepared), {
    validate(model, committed) { changes = prepareAiEdit(committed, model, { scope: ['/Geosets'] }).changes; },
  });
  doc.serialize('mdx');
  return { doc, before, areas: changedActivity(before, doc.model, changes) };
}
test('completion uses actual numeric positions, not byte ranges or selected/no-op vertices', () => {
  const { areas } = commit(model => {
    model.Geosets[0].Vertices[0] += 1;
    model.Geosets[0].Vertices[6] += 1; // same merged history byte range includes unchanged vertex 1
    model.Geosets[0].Vertices[9] += 0;
  });
  assert.deepEqual(areas, [{ geoset: 0, vertices: [0, 2] }]);
  assert.deepEqual(commit(() => {}).areas, []);
  assert.deepEqual(commit(m => { m.Geosets[0].TVertices[0][0] += .1; }).areas, []);
  assert.deepEqual(commit(m => { m.Geosets[0].Normals[0] += .1; }).areas, []);
});
test('topology uses coarse areas and large position sets stay bounded', () => {
  assert.deepEqual(commit(m => m.Geosets[0].Faces.reverse()).areas, [{ geoset: 0, vertices: null }]);
  assert.deepEqual(commit(m => { m.Geosets[0].Vertices[0] += 1; m.Geosets[0].Normals[0] += .1; }).areas, [{ geoset: 0, vertices: null }]);
  const before = { Geosets: [{ Vertices: new Float32Array(3000) }] };
  const after = { Geosets: [{ Vertices: new Float32Array(3000).fill(1) }] };
  const changes = [{ path: ['Geosets', '0', 'Vertices'], kind: 'bytes' }];
  assert.deepEqual(changedActivity(before, after, changes), [{ geoset: 0, vertices: null }]);
  assert.ok(ACTIVITY_VERTEX_LIMIT < 1000);
});
test('target scopes remain possible areas; no spatial scope omits the pulse', () => {
  const model = createStarterDocument().model;
  assert.deepEqual(activityTarget(model, ['/Bones'], { 0: [1] }), []);
  assert.deepEqual(activityTarget(model, ['/Geosets'], { 0: [1] }), [{ geoset: 0, vertices: null }]);
  assert.deepEqual(activityTarget(model, ['/Geosets/0/Vertices'], { 0: [1, 3] }), [{ geoset: 0, vertices: [1, 3] }]);
});
function harness() {
  let time = 0, id = 0;
  const timers = new Map(), doc = { revision: 1 };
  const activity = createAiActivity({ now: () => time, schedule: (fn, ms) => { timers.set(++id, { fn, at: time + ms }); return id; }, cancel: id => timers.delete(id) });
  const advance = ms => { time += ms; for (const [key, timer] of [...timers]) if (timer.at <= time) { timers.delete(key); timer.fn(); } };
  return { activity, doc, timers, advance };
}
test('default off, failure/cancel, generations, document identity and revision', () => {
  const { activity, doc, timers } = harness(), areas = [{ geoset: 0, vertices: [0] }];
  assert.equal(activity.begin('A', doc, areas), null);
  activity.setEnabled(true);
  const failed = activity.begin('A', doc, areas); activity.end(failed, false);
  assert.deepEqual(activity.visible('A', 1), []);
  const controller = new AbortController(), cancelled = activity.begin('A', doc, areas, controller.signal);
  controller.abort(); doc.revision++;
  activity.finish(cancelled, areas, doc); activity.end(cancelled, true);
  assert.deepEqual(activity.visible('A', 2), []);
  const token = activity.begin('A', doc, areas);
  activity.setEnabled(false); activity.setEnabled(true); doc.revision++;
  activity.finish(token, areas, doc);
  assert.deepEqual(activity.visible('A', 3), []);
  const stale = activity.begin('A', doc, areas); doc.revision += 2;
  activity.finish(stale, areas, doc);
  assert.deepEqual(activity.visible('A', 5), []);
  const current = activity.begin('A', doc, areas); doc.revision++;
  activity.finish(current, areas, doc);
  assert.equal(activity.visible('A', 6).length, 1);
  doc.revision++; activity.reconcile([{ id: 'A', doc }]);
  assert.deepEqual(activity.visible('A', 7), []);
  assert.deepEqual(activity.visible('B', 6), []);
  activity.reconcile([{ id: 'A', doc: { revision: 6 } }]);
  assert.equal(timers.size, 0);
});
test('completion expires; closure and disable clear immediately; idle scheduling stops', () => {
  const { activity, doc, timers, advance } = harness(), areas = [{ geoset: 0, vertices: [0] }];
  activity.setEnabled(true);
  let renders = 0, frame = 0; const frames = new Map();
  const scheduler = createRenderScheduler({
    render: () => renders++, continuous: () => activity.visible('A', doc.revision).length > 0,
    paused: () => false, maxFps: () => 60,
    request: fn => { frames.set(++frame, fn); return frame; }, cancel: id => frames.delete(id),
  });
  const unsubscribe = activity.subscribe(scheduler.sync);
  const token = activity.begin('A', doc, areas); doc.revision++;
  activity.finish(token, areas, doc); activity.end(token, true);
  advance(850); assert.equal(activity.visible('A', 2).length, 1);
  advance(300); assert.equal(activity.visible('A', 2).length, 0);
  for (const [key, fn] of [...frames]) { frames.delete(key); fn(1200); }
  assert.equal(frames.size, 0); assert.equal(timers.size, 0); assert.ok(renders > 0);
  activity.begin('A', doc, areas); activity.reconcile([]);
  assert.equal(timers.size, 0);
  activity.begin('A', doc, areas); activity.setEnabled(false);
  assert.equal(activity.visible('A', doc.revision).length, 0); assert.equal(timers.size, 0);
  unsubscribe(); scheduler.dispose();
});
