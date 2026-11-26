// The owner-rejected list (src/transplant-autofix.js OWNER_REJECTED_KEYS) outranks every stage of suggestToggles.
// Plan: docs/agent-tasks/xfer-fable-plan.md, steps 1, 2b and 3.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { OWNER_REJECTED_KEYS } from '../src/transplant-autofix.js';
import { suggestToggles } from '../src/xfer-suggest-toggles.js';
import { scoreResult, weldedPairs } from '../src/xfer-scorecard.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { vertexBones } from '../src/part-bones.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const load = file => openDocument(fs.readFileSync(file), file).model;
const pair = id => [fixturePath(`xfer-${id}-own`), fixturePath(`xfer-${id}-donor`)];
const OPTIONS = { events: true, emitters: false, keep: [], mirror: false };

// Stock models (named fixtures). Keep this cheap: at most three suggester runs.
const PAIRS = { 'reasonable-46': pair('r46'), 'reasonable-29': pair('r29') };
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

// The hole rule (plan step 3). No checkbox makes holes after step 2b, so the test tears the plain result itself: one side
// of 20 welded pairs is rebound to the skeleton's root. Scored directly, no suggester run.
test('Red Dragon onto the riderless Wind Rider: the hole rule passes plain and fails with 20 seams torn', { skip: missing(PAIRS['reasonable-46']) }, () => {
  const [own, donor] = models('reasonable-46');
  const plain = transplantSkeleton(own, donor, { ...OPTIONS, autoFix: false }).model;
  const before = scoreResult(own, donor, plain, false).rules.holes;
  assert.equal(before.pass, true, JSON.stringify(before));
  const torn = structuredClone(plain);
  const root = [...torn.Bones, ...torn.Helpers].find(node => node.Parent == null || node.Parent < 0 || node.Parent === node.ObjectId);
  // The welded pairs farthest from the model's middle, one side of each moved onto the root.
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const g of own.Geosets) for (let i = 0; i < g.Vertices.length; i++) { lo[i % 3] = Math.min(lo[i % 3], g.Vertices[i]); hi[i % 3] = Math.max(hi[i % 3], g.Vertices[i]); }
  const mid = lo.map((x, c) => (x + hi[c]) / 2);
  const far = ([gi, v]) => Math.hypot(...[0, 1, 2].map(c => own.Geosets[gi].Vertices[3 * v + c] - mid[c]));
  const moved = new Set(), chosen = [];
  for (const [a, b] of weldedPairs(own).sort((p, q) => far(q[1]) - far(p[1]))) {
    const key = b.join(':');
    if (moved.has(key) || moved.has(a.join(':')) || vertexBones(torn.Geosets[b[0]], b[1]).includes(root.ObjectId)) continue;
    moved.add(key); chosen.push(b);
    if (chosen.length === 20) break;
  }
  assert.equal(chosen.length, 20);
  for (const [gi, v] of chosen) {
    const geo = torn.Geosets[gi];
    let group = geo.Groups.findIndex(list => list.length === 1 && list[0] === root.ObjectId);
    if (group < 0) { group = geo.Groups.length; geo.Groups.push([root.ObjectId]); geo.TotalGroupsCount += 1; }
    geo.VertexGroup[v] = group;
  }
  const after = scoreResult(own, donor, torn, false).rules.holes;
  assert.equal(after.pass, false, JSON.stringify(after));
  assert.ok(after.torn >= 20, JSON.stringify(after));
});
