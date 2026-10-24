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
