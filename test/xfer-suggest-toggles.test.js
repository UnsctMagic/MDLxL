// The owner-rejected list (src/transplant-autofix.js OWNER_REJECTED_KEYS) outranks every stage of suggestToggles.
// Plan: docs/agent-tasks/xfer-fable-plan.md, step 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { OWNER_REJECTED_KEYS } from '../src/transplant-autofix.js';
import { suggestToggles } from '../src/xfer-suggest-toggles.js';

const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const load = file => openDocument(fs.readFileSync(file), file).model;
const stock = name => testModel('reasonable-50', name);
const OPTIONS = { events: true, emitters: false, keep: [], mirror: false };

// Stock models only. reasonable-46 had Seam fix suggested on the final sheet (holes in the wyvern).
const PAIRS = {
  'reasonable-46': [stock('orc__riderlesswyvern-a9e3ab42/riderlesswyvern.mdx'), stock('creeps__reddragon-8fbd9325/reddragon.mdx')],
  'reasonable-29': [stock('creeps__wendigoshaman-2445ff6f/wendigoshaman.mdx'), stock('creeps__furbolgshaman-1aa9291f/furbolgshaman.mdx')],
  'reasonable-44': [stock('demon__felhound-09aca38c/felhound.mdx'), stock('creeps__direwolf-bbc7dc3d/direwolf.mdx')],
};
const missing = files => files.some(file => !fs.existsSync(file)) ? 'stock reasonable-50 models unavailable' : false;
const results = new Map();
const suggest = id => {
  if (!results.has(id)) { const [own, donor] = PAIRS[id]; results.set(id, suggestToggles(load(own), load(donor), { ...OPTIONS })); }
  return results.get(id);
};

test('Seam fix is on the owner-rejected list, which is frozen', () => {
  assert.ok(OWNER_REJECTED_KEYS.includes('seamFix'));
  assert.ok(Object.isFrozen(OWNER_REJECTED_KEYS));
});

test('Red Dragon onto the riderless Wind Rider: Seam fix shown, not suggested', { skip: missing(PAIRS['reasonable-46']) }, () => {
  const { visible, suggested } = suggest('reasonable-46');
  assert.ok(visible.includes('seamFix'), 'the checkbox is still shown');
  assert.ok(!suggested.includes('seamFix'), `suggested ${suggested.join(', ')}`);
});

for (const id of Object.keys(PAIRS)) {
  test(`${id}: no owner-rejected key is suggested`, { skip: missing(PAIRS[id]) }, () => {
    const { suggested } = suggest(id);
    assert.ok(suggested.every(key => !OWNER_REJECTED_KEYS.includes(key)), `suggested ${suggested.join(', ')}`);
  });
}
