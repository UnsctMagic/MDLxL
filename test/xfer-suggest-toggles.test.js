// The owner-rejected list (src/transplant-autofix.js OWNER_REJECTED_KEYS) outranks every stage of suggestToggles.
// Plan: docs/agent-tasks/xfer-fable-plan.md, steps 1 and 2b.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { OWNER_REJECTED_KEYS } from '../src/transplant-autofix.js';
import { suggestToggles } from '../src/xfer-suggest-toggles.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const load = file => openDocument(fs.readFileSync(file), file).model;
const pair = id => [fixturePath(`xfer-${id}-own`), fixturePath(`xfer-${id}-donor`)];
const OPTIONS = { events: true, emitters: false, keep: [], mirror: false };

// Stock models (named fixtures). Keep this cheap: three whole-suggester pairs, no more.
const PAIRS = { 'reasonable-46': pair('r46'), 'reasonable-29': pair('r29'), 'reasonable-44': pair('r44') };
const missing = files => files.some(file => !fs.existsSync(file)) ? 'XFER reasonable models unavailable' : false;
const models = id => PAIRS[id].map(load);

test('the owner-rejected list is frozen', () => {
  assert.ok(Object.isFrozen(OWNER_REJECTED_KEYS));
});

// Seam fix was removed on the owner's word (26 Nov 2026, "Remove it"); on the final sheet it was suggested here.
test('Red Dragon onto the riderless Wind Rider: no Seam fix shown or suggested', { skip: missing(PAIRS['reasonable-46']) }, () => {
  const { visible, suggested } = suggestToggles(...models('reasonable-46'), { ...OPTIONS });
  assert.ok(!visible.includes('seamFix'), `shown ${visible.join(', ')}`);
  assert.ok(!suggested.includes('seamFix'), `suggested ${suggested.join(', ')}`);
});

// A rejected key stays shown and is never suggested, though the measurements suggest it.
test('Furbolg Elder Shaman onto Wendigo Shaman: a rejected key is shown, not suggested', { skip: missing(PAIRS['reasonable-29']) }, () => {
  const plain = suggestToggles(...models('reasonable-29'), { ...OPTIONS });
  assert.ok(plain.suggested.includes('skinLandmarks'), `without the option: ${plain.suggested.join(', ')}`);
  const { visible, suggested } = suggestToggles(...models('reasonable-29'), { ...OPTIONS }, { rejected: ['skinLandmarks'] });
  assert.ok(visible.includes('skinLandmarks'));
  assert.ok(!suggested.includes('skinLandmarks'), `suggested ${suggested.join(', ')}`);
});

test('reasonable-44: no owner-rejected key is suggested', { skip: missing(PAIRS['reasonable-44']) }, () => {
  const { suggested } = suggestToggles(...models('reasonable-44'), { ...OPTIONS });
  assert.ok(suggested.every(key => !OWNER_REJECTED_KEYS.includes(key)), `suggested ${suggested.join(', ')}`);
});
