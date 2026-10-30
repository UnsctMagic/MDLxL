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
