import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { guidesForRequest } from '../src/ai-tools.js';

test('size and optimisation requests carry the size procedure', () => {
  for (const text of ['Reduce file size', 'Optimise this model', 'Optimize animations', 'Make the model smaller', 'This model is over-keyed', 'Reduce key count, preserve motion'])
    assert.ok(guidesForRequest(text).includes('WC3-EDITING-OPTIMIZATION.md'), text);
  const guide = fs.readFileSync(new URL('../docs/WC3-EDITING-OPTIMIZATION.md', import.meta.url), 'utf8');
  assert.match(guide, /Make a model smaller without changing how it moves/);
  assert.match(fs.readFileSync(new URL('../app/ai-editor.js', import.meta.url), 'utf8'), /docs\/\*\.md/);
  for (const [, link] of guide.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) assert.ok(fs.existsSync(new URL('../docs/' + link, import.meta.url)), link);
});

test('existing binding, animation, geometry, texture, effect and game routes retain their guides', () => {
  const examples = [
    ['the legs clip into the skirt during the walk; fix the binding', ['NODES-BINDING', 'ANIMATION']],
    ['retime the attack animation', ['ANIMATION']],
    ['weld these vertices and recalculate normals', ['GEOMETRY']],
    ['fix the UV texture and material', ['UV-MATERIALS']],
    ['add a particle emitter ribbon trail', ['EMITTERS']],
    ['export collision bounds for the game', ['GAME-INTEGRATION', 'NODES-BINDING']],
  ];
  for (const [text, guides] of examples) assert.deepEqual(guidesForRequest(text), guides.map(g => `WC3-EDITING-${g}.md`), text);
});

test('routes marked and local-language editing requests using the captured tab as a fallback', () => {
  assert.ok(guidesForRequest('почини привязку наплечника').includes('WC3-EDITING-NODES-BINDING.md'));
  assert.ok(guidesForRequest('修复这个动作的关键帧').includes('WC3-EDITING-ANIMATION.md'));
  assert.ok(guidesForRequest('corrige la textura seleccionada').includes('WC3-EDITING-UV-MATERIALS.md'));
  assert.deepEqual(guidesForRequest('fix this', { mode: 'bones', selectedNodeIds: [12] }), ['WC3-EDITING-NODES-BINDING.md']);
  assert.deepEqual(guidesForRequest('fix this', { mode: 'vertices', selection: { 0: [3] } }), ['WC3-EDITING-GEOMETRY.md']);
  assert.deepEqual(guidesForRequest('hello', { mode: 'vertices', selection: {} }), []);
});
test('carries the rig introduction and rigid plate section while leaving unrelated procedures available on demand', async () => {
  const { initialGuideText, readGuideSection } = await import('../src/ai-guide-sections.js');
  const text = '# Rig\n\n## Read the rig\nFind its driver.\n## Keep rigid plates seated\nTest shape and attachment.\n## Relocate a pivot\nCompensate its tracks.';
  const sent = initialGuideText(text, 'fix this shoulder armor');
  assert.match(sent, /Test shape and attachment/);
  assert.doesNotMatch(sent, /Compensate its tracks/);
  assert.match(readGuideSection(text, 'Relocate a pivot'), /Compensate its tracks/);
  assert.throws(() => readGuideSection(text,'missing section'), /Choose a guide section/);
});

test('UV focus captured alongside vertex mode selects the UV guide before geometry selection fallback', () => {
  assert.deepEqual(guidesForRequest('исправь это', { mode: 'vertices', uvEditing: true, selection: { 0: [0, 1] } }), ['WC3-EDITING-UV-MATERIALS.md']);
  assert.deepEqual(guidesForRequest('исправь это', { mode: 'vertices', uvEditing: true, selectedNodeIds: [12], selection: { 0: [0, 1] } }), ['WC3-EDITING-UV-MATERIALS.md']);
});
