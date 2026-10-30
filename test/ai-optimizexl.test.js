import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDocument } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { runOptimizeStage, simpleSettings } from '../src/optimizexl.js';

test('documented sandbox recipe returns the exact existing stage bytes without an adapter or input mutation', async () => {
  const guide = fs.readFileSync(new URL('../docs/WC3-EDITING-OPTIMIZATION.md', import.meta.url), 'utf8');
  const code = /```js\n([^]*?)\n```/.exec(guide)[1];
  const model = createStarterDocument().model;
  model.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 100]), MoveSpeed: 0, NonLooping: false, Rarity: 0 }];
  model.Bones[0].Translation = { LineType: 1, Keys: [0, 50, 100].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, 0]) })) };
  const before = structuredClone(model);
  let input;
  const api = { module: async name => {
    if (name === 'editor-document') return { openDocument };
    assert.equal(name, 'optimizexl');
    return { simpleSettings, runOptimizeStage: (bytes, ...args) => { input = bytes; return runOptimizeStage(bytes, ...args); } };
  } };
  const result = await new (Object.getPrototypeOf(async function() {}).constructor)('model', 'api', code)(model, api);
  const direct = runOptimizeStage(input, 'animation', simpleSettings('animation', 0, openDocument(input, 'working.mdx').model));
  assert.deepEqual(result.report.bytes, direct.bytes);
  assert.deepEqual(result.candidate, openDocument(direct.bytes, 'candidate.mdx').model);
  assert.deepEqual(model, before);
});
