import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AI_AREAS,
  AI_COMMON_FUNCTIONS,
  aiCommonFunctionsText,
  aiExportNames,
  aiFunctionCards,
  aiToolPages,
  areasForRequest,
  searchAiCapabilities,
} from '../src/ai-capabilities.js';
import { sampleAiModel } from '../src/ai-sampling.js';
import { createStarterDocument } from '../src/starter-model.js';

const root = new URL('../src/', import.meta.url),
  sources = Object.fromEntries(
    fs
      .readdirSync(root)
      .filter(name => name.endsWith('.js') && name !== 'cli.js')
      .map(name => [name.slice(0, -3), fs.readFileSync(new URL(name, root), 'utf8')]),
  );
test('capability areas point to existing public editor APIs; search and pagination expose the complete catalog', () => {
  for (const area of AI_AREAS)
    for (const name of area.modules)
      assert.ok(sources[name] && aiExportNames(sources[name]).length, area.id + ': ' + name);
  const all = searchAiCapabilities(sources, { limit: 100 });
  assert.ok(all.total > 150);
  assert.equal(all.modules.length, 100);
  assert.equal(all.truncated, true);
  const modules = [...all.modules];
  for (let offset = 100; offset < all.total; offset += 100) {
    const page = searchAiCapabilities(sources, { offset, limit: 100 });
    assert.equal(page.total, all.total);
    assert.equal(page.modules.length, Math.min(100, all.total - offset));
    assert.equal(page.truncated, offset + 100 < all.total);
    modules.push(...page.modules);
  }
  assert.equal(modules.length, all.total);
  assert.equal(new Set(modules.map(m => m.module)).size, all.total);
  const extrude = searchAiCapabilities(sources, { query: 'extrude' });
  assert.ok(extrude.modules.some(m => m.module === 'mesh-tools' && m.exports.includes('extrudeFaces')));
  assert.ok(searchAiCapabilities(sources, { area: 'rig' }).modules.some(m => m.module === 'pose-ik'));
  assert.deepEqual(
    aiExportNames('export const a=1; export {original as renamed, other}; export async function run() {}'),
    ['a', 'other', 'renamed', 'run'],
  );
});
test('a function lookup answers with arguments and description in one step', () => {
  const detach = searchAiCapabilities(sources, { query: 'detach' }).functions[0];
  assert.deepEqual(detach, {
    module: 'mesh-tools',
    name: 'detachFaces',
    arguments: 'model, geosetIndex, indices',
    about: 'Detach triangles whose three vertices are selected; keep source loose vertices.',
  });
  assert.equal(searchAiCapabilities(sources, { area: 'rig' }).functions, undefined, 'an area listing stays a module list');
  assert.ok(searchAiCapabilities(sources, { query: 'detach', area: 'rig' }).functions.every(f => AI_AREAS.find(a => a.id === 'rig').modules.includes(f.module)));
  // Only the comment directly above a function describes it.
  assert.deepEqual(
    aiFunctionCards('// Section heading\n\n/** Moves a thing.\n * Second line. */\nexport async function move(a, { b = 1 } = {}) {}\n// One.\n// Two.\nexport function two(x) {}\n'),
    [
      { name: 'move', arguments: 'a, { b = 1 } = {}', about: 'Moves a thing. Second line.' },
      { name: 'two', arguments: 'x', about: 'One. Two.' },
    ],
  );
});

test('the common list names only real functions and stays the same small text', () => {
  const text = aiCommonFunctionsText(sources);
  const expected = Object.entries(AI_COMMON_FUNCTIONS).flatMap(([module, names]) => names.map(name => module + '.' + name + '('));
  for (const line of expected) assert.ok(text.includes('\n' + line), line);
  assert.equal(text.split('\n').length, expected.length + 1);
  assert.ok(text.length < 5000, String(text.length));
  assert.equal(aiCommonFunctionsText(sources), text);
});

test('request words pick at most two areas; pages skip the common list and repeat no module', () => {
  assert.deepEqual(areasForRequest('Please reskin the hilt of this blade that I have selected now using the texture I have selected now'), ['materials', 'uv']);
  assert.deepEqual(areasForRequest('the walk loops badly at frame 400'), ['animation']);
  assert.deepEqual(areasForRequest('hello'), []);
  assert.equal(aiToolPages(sources, []), '');
  assert.equal(aiToolPages(sources, ['made-up']), '');
  const page = aiToolPages(sources, ['animation', 'inspection']);
  assert.ok(!page.includes('animation.sampleNodeMatrices('), 'common functions are already in the instructions');
  assert.equal(page.split('\nanimation also has:').length, 2, 'a module shared by two areas appears once');
  for (const area of AI_AREAS) assert.ok(aiToolPages(sources, [area.id]).length < 5800, area.id);
});

test('pose sampling measures interpolated world-space deformation without mutating model data', () => {
  const model = createStarterDocument().model;
  model.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 1000]) }];
  model.Bones[0].Translation = {
    LineType: 1,
    GlobalSeqId: null,
    Keys: [
      { Frame: 0, Vector: new Float32Array([0, 0, 0]) },
      { Frame: 1000, Vector: new Float32Array([20, 0, 0]) },
    ],
  };
  const before = structuredClone(model),
    context = {
      sequence: 0,
      frame: 500,
      selectedNodeIds: [0],
      selection: { 0: [0, 1, 2] },
      checkedGeosets: [0],
    };
  const result = sampleAiModel(model, context, { frames: [0, 500, 1000], limit: 2 });
  assert.equal(result.samples[1].nodes[0].position[0] - result.samples[0].nodes[0].position[0], 10);
  assert.equal(result.samples[2].geosets[0].bounds.min[0] - result.samples[0].geosets[0].bounds.min[0], 20);
  assert.equal(
    result.samples[1].geosets[0].selected.positions[0].position[0] -
      result.samples[0].geosets[0].selected.positions[0].position[0],
    10,
  );
  assert.equal(result.samples[0].geosets[0].selected.total, 3);
  assert.equal(result.samples[0].geosets[0].selected.truncated, true);
  assert.deepEqual(model, before);
  assert.throws(() => sampleAiModel(model, context, { frames: Array(33).fill(0) }), /1–32/);
  assert.throws(() => sampleAiModel(model, context, { vertices: { 0: [9999] } }), /Invalid sample/);
  assert.throws(() => sampleAiModel(model, context, { nodeIds: [999] }), /Invalid sample/);
});

test('global pose sampling uses the existing isolated global preview and preserves authored tracks', () => {
  const model = createStarterDocument().model;
  model.GlobalSequences = [1000];
  model.Bones[0].Translation = {
    LineType: 1,
    GlobalSeqId: 0,
    Keys: [
      { Frame: 0, Vector: new Float32Array([0, 0, 0]) },
      { Frame: 1000, Vector: new Float32Array([20, 0, 0]) },
    ],
  };
  const before = structuredClone(model),
    result = sampleAiModel(
      model,
      { sequence: -1, globalSequence: 0, selectedNodeIds: [0], selection: { 0: [0] } },
      { frames: [0, 500, 1500] },
    );
  assert.equal(result.samples[1].nodes[0].position[0] - result.samples[0].nodes[0].position[0], 10);
  assert.deepEqual(result.samples[1].nodes, result.samples[2].nodes);
  assert.deepEqual(model, before);
});
