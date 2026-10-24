import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSketchStore, sketchContext, smoothStroke, strokeVertices } from '../src/ai-sketch.js';
const { AiSteering } = createRequire(import.meta.url)('../electron/ai-service.cjs');
const { anthropicThinking } = createRequire(import.meta.url)('../electron/ai-providers.cjs');

// A flat 3x3 grid in the XZ plane facing -Y, plus a copy behind it facing +Y.
const grid = (y, normal) => {
  const vertices = [],
    normals = [];
  for (let z = 0; z < 3; z++)
    for (let x = 0; x < 3; x++) {
      vertices.push(x * 10, y, z * 10);
      normals.push(0, normal, 0);
    }
  return { Vertices: new Float32Array(vertices), Normals: new Float32Array(normals) };
};
const model = { Geosets: [grid(0, -1), grid(2, 1)] };
const marker = {
  tool: 'marker',
  documentId: 'a',
  color: 'yellow',
  points: [0, -0.1, 0, 10, -0.1, 0],
  normals: [0, -1, 0, 0, -1, 0],
  onSurface: [true, true],
  width: 8,
  reach: 2,
};

test('a marker covers vertices on the drawn side only', () => {
  // The bottom row of the front grid; the back grid is just as close but faces away.
  assert.deepEqual(strokeVertices(marker, model), { 0: [0, 1] });
});
test('pen points off the model point at a shape, not existing vertices', () => {
  const pen = { ...marker, tool: 'pen', onSurface: [false, false] };
  assert.deepEqual(strokeVertices(pen, model), {});
  assert.deepEqual(strokeVertices({ ...pen, onSurface: [true, false] }, model), { 0: [0] });
});
test('the AI context numbers strokes and names their colors in model space', () => {
  const context = sketchContext([marker], model);
  assert.equal(context.strokes[0].number, 1);
  assert.equal(context.strokes[0].color, 'yellow');
  assert.deepEqual(context.strokes[0].points, [
    [0, -0.1, 0],
    [10, -0.1, 0],
  ]);
  assert.deepEqual(context.strokes[0].markedVertices, { 0: [0, 1] });
  assert.equal(sketchContext([], model), null);
});
test('smoothing keeps the ends where the user put them', () => {
  const smoothed = smoothStroke([0, 0, 0, 5, 9, 0, 10, 0, 0]);
  assert.deepEqual(smoothed.slice(0, 3), [0, 0, 0]);
  assert.deepEqual(smoothed.slice(6), [10, 0, 0]);
  assert.ok(smoothed[4] < 9);
});
test('drawings are per model, erasable, and hidden tools reset when the console closes', () => {
  const store = createSketchStore();
  store.setVisible(true);
  store.setTool('pen');
  const one = store.add({ ...marker }),
    two = store.add({ ...marker, documentId: 'b' });
  store.add({ ...marker });
  assert.equal(store.strokes('a').length, 2);
  store.undo('a');
  assert.deepEqual(store.strokes('a').map(s => s.id), [one]);
  store.remove([one]);
  assert.equal(store.strokes('a').length, 0);
  store.clear('b');
  assert.equal(store.get().strokes.length, 0, two && 'cleared');
  store.setTool('pen');
  assert.equal(store.get().tool, null, 'choosing the active tool again turns it off');
  store.setTool('marker');
  store.setVisible(false);
  assert.equal(store.get().tool, null);
});
test('steering queues until a provider takes it, and closes with the task', () => {
  const accepted = [];
  const steering = new AiSteering(text => accepted.push(text));
  let notified = 0;
  steering.subscribe(() => notified++);
  steering.push('wider', 'message 1');
  steering.push('taller', 'message 2');
  assert.deepEqual(accepted, ['wider', 'taller']);
  assert.equal(notified, 2);
  assert.equal(steering.take(), 'message 1\n\nmessage 2');
  assert.equal(steering.take(), null);
  steering.restore('again');
  assert.equal(steering.take(), 'again');
  steering.close();
  steering.push('ignored', 'ignored');
  assert.equal(steering.take(), null);
});
test('Claude API thinking is shown only for models that think adaptively', () => {
  assert.deepEqual(anthropicThinking('claude-opus-5-5'), { type: 'adaptive', display: 'summarized' });
  assert.deepEqual(anthropicThinking('claude-sonnet-4-6'), { type: 'adaptive', display: 'summarized' });
  assert.equal(anthropicThinking('claude-haiku-4-5'), null);
  assert.equal(anthropicThinking('claude-sonnet-4-20250514'), null);
  assert.equal(anthropicThinking('local-model'), null);
});
test('Codex and Claude compaction show as one compacting step', () => {
  const { CodexProcess, claudeCompaction } = createRequire(import.meta.url)('../electron/ai-providers.cjs');
  const events = [];
  const codex = new CodexProcess({}, { event: value => events.push(value) });
  codex.receive({ method: 'item/started', params: { item: { type: 'contextCompaction', id: 'c' } } });
  codex.receive({ method: 'item/completed', params: { item: { type: 'contextCompaction', id: 'c' } } });
  codex.receive({ method: 'item/started', params: { item: { type: 'agentMessage', id: 'm' } } });
  assert.deepEqual(events, [
    { type: 'compaction', active: true },
    { type: 'compaction', active: false },
  ]);
  assert.equal(claudeCompaction({ type: 'system', subtype: 'status', status: 'compacting' }), true);
  assert.equal(claudeCompaction({ type: 'system', subtype: 'compact_boundary' }), false);
  assert.equal(claudeCompaction({ type: 'system', subtype: 'init' }), null);
  assert.equal(claudeCompaction({ type: 'assistant' }), null);
});

test('Ctrl+Z follows one timeline of drawings and model edits per model', () => {
  const store = createSketchStore(),
    ids = () => store.strokes('a').map(s => s.id);
  const one = store.add({ ...marker });
  store.noteModelEdit('a');
  const two = store.add({ ...marker });
  // Last thing first: the drawing, then the model edit (handed back), then the older drawing.
  assert.equal(store.step('a'), 'sketch');
  assert.deepEqual(ids(), [one]);
  assert.equal(store.step('a'), 'model');
  assert.equal(store.step('a'), 'sketch');
  assert.deepEqual(ids(), []);
  assert.equal(store.step('a'), 'model', 'nothing left: the model has its own Undo');
  // Redo walks forward again in the same order.
  assert.equal(store.step('a', true), 'sketch');
  assert.equal(store.step('a', true), 'model');
  assert.equal(store.step('a', true), 'sketch');
  assert.deepEqual(ids(), [one, two]);
  // With a drawing tool active only drawings are undone, skipping model edits.
  store.noteModelEdit('a');
  assert.equal(store.step('a', false, { drawingsOnly: true }), 'sketch');
  assert.deepEqual(ids(), [one]);
  assert.equal(store.canStep('a', false), false, 'next plain Undo is the model edit');
  assert.equal(store.canStep('a', false, { drawingsOnly: true }), true);
  // Hidden drawings: Undo goes to the model and its step moves along.
  assert.equal(store.step('a', false, { modelOnly: true }), 'model');
  assert.equal(store.step('a', false, { modelOnly: true }), 'model');
  assert.equal(store.canStep('a', false), true, 'both model edits undone: the first drawing is next');
});

test('one eraser drag and Clear are single Undo steps; a new drawing ends Redo', () => {
  const store = createSketchStore();
  const a = store.add({ ...marker }),
    b = store.add({ ...marker }),
    c = store.add({ ...marker }),
    drag = {};
  store.remove([a], drag);
  store.remove([b], drag);
  assert.deepEqual(store.strokes('a').map(s => s.id), [c]);
  assert.equal(store.step('a'), 'sketch');
  assert.deepEqual(store.strokes('a').map(s => s.id), [a, b, c], 'the whole drag comes back in order');
  store.clear('a');
  assert.equal(store.strokes('a').length, 0);
  assert.equal(store.undo('a'), 'sketch');
  assert.equal(store.strokes('a').length, 3);
  assert.equal(store.step('a', true), 'sketch');
  assert.equal(store.strokes('a').length, 0);
  assert.equal(store.step('a'), 'sketch');
  store.add({ ...marker });
  assert.equal(store.canStep('a', true), false, 'a new drawing ends Redo');
  // Other models keep their own drawings and timeline.
  store.add({ ...marker, documentId: 'b' });
  store.step('a');
  assert.equal(store.strokes('b').length, 1);
});
