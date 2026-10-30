import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import * as contract from '../src/ai-tools.js';
import turns from './fixtures/ai-chat-loop-turns.json' with { type: 'json' };
const { editingPrompt } = createRequire(import.meta.url)('../electron/ai-service.cjs');

// SHA-256 and length of the prompts as assembled on main before they moved into
// src/ai-tools.js (router) and the editing prompt was split into intro and body.
// A prompt change is a product change: update these only on purpose.
const BEFORE_RULE = {
  router: ['b3177863c65feed0c9d89cee06f29b5f4a1e6305c29a064d75dc3bcefb509c0d', 1868],
  'editing plain': ['8b1bdc6124ce1ac5b5f3480e7970e12232237bff986eb5e871439590b21a6a9c', 6859],
  'worker plain': ['22f9c64e5d3c867f53f6cd90fda0177eda1de4427cac62d564b7468138fcb3f3', 8015],
  'editing plain+web': ['e5202f094c34e636a7665f2e45ef40d30d13bd131188a825bc528f0f8117b3e2', 7361],
  'worker plain+web': ['52237f4b05e73fe3f5c8f31d22cc6f33d90306fe88cd8dce7964602149d6c5a8', 8517],
  'editing handbook': ['1f1fe1abf05b188a2f2d9f64e2e2f126d422fdcabbeb1ce07c146a4450df31b1', 9866],
  'worker handbook': ['557201227519228e0daaabf5d1503b434f57976616fd37f3cbe86f51a967c205', 11022],
  'editing handbook+web': ['7c4c8792b5e8d5e257efd5726a9b91172eb709c1433b14353cb840a7c91e616b', 10368],
  'worker handbook+web': ['42fa98e21e6cb2668a0339171eadfbbf010a6ebf309f215af833dc350ff7221b', 11524],
};
const CONTEXT_BEFORE = "Every user prompt carries a captured context and target token: the first prompt of a conversation has the full context; later prompts have the target, selection, frame and only the fields that changed, so call mdlxl_context when you need the full lists or editor commands.";
const CONTEXT_AFTER = "Every user prompt carries a captured context and target token: the first prompt of a conversation has the full context; later prompts carry the target and only changed fields, including selection, view and sequence. Omitted fields keep their last value. The full snapshot returns after a reset, compaction or model replacement. Call mdlxl_context when you need the full lists or editor commands.";
const EXAMPLE_RULE = "When the user points to an example they made, first read or sample the referenced area with mdlxl_read or mdlxl_sample and inspect its structure before planning edits. Copy that example's pattern and apply it across the full requested scope, including less visible regions; do not substitute your own picks. \"Keep the look\" means preserve the geometry silhouette and texture appearance, including UV mapping and material/texture assignments; reducing polygons does not authorize changing them.";
// Research §6.2: compare complaints/candidates with the accepted version and
// retain accepted results, without changing any existing editing instructions.
const ACCEPTED_RULE = 'When the user reports a problem in a result, first measure the same thing in the version the user last accepted (or the original). If that version already has it, tell the user with the numbers and ask whether the accepted motion should change before editing. Measure every candidate against the accepted version, not only against an earlier candidate. After the user accepts a result, save it with mdlxl_versions.';
const EXPECTED = {
  "editing plain": [
    "6e21fdb9b489d380814ce265616d82918d005514caa2ec1bf4eb56784af62b7f",
    7891
  ],
  "worker plain": [
    "5c6351f7eb1096b1a8ecb63214413aeb413839c860fd76b9db31e5a3957f599f",
    9047
  ],
  "editing plain+web": [
    "b4e8e004f85e59666548ba15d7ea0ebcbcd7a9322d80b8fc77045cf42fa2a02f",
    8393
  ],
  "worker plain+web": [
    "558b899a8a11f0af1de42a472c2a5ad905372468667d841f2bfe7672e5248a09",
    9549
  ],
  "editing handbook": [
    "c5044f776c4b8cb97640eb105d8fa91c72201dee73996ec59424b62e25356d2a",
    10898
  ],
  "worker handbook": [
    "b0db631a0111c389a00aeb31ebfe23ad037e59e98c9cba847e777fb18fa83711",
    12054
  ],
  "editing handbook+web": [
    "312f78bd39758a6bab12ad9d47fdf9c5755c4714e59235b0c1585425a24b608b",
    11400
  ],
  "worker handbook+web": [
    "82ab969f22078dbfa22d3fc8e9516b84d49f14dddcaee5d77e6f523d97b248d3",
    12556
  ]
};
const fingerprint = text => [createHash('sha256').update(text, 'utf8').digest('hex'), text.length];

// Research §6.1: add app-owned motion evidence to the outside check while
// retaining its rule that missing evidence is a note, never a failure.
test('outside check deliberately adds motion measurements alongside still pictures', () => {
  assert.deepEqual(fingerprint(contract.AI_OUTSIDE_CHECK), ['37fa817e1c54bbec4de2d1601f0d92930feb4b3a51c4e99fd9a48aced5b8bf01', 1856]);
  assert.match(contract.AI_OUTSIDE_CHECK, /still pictures cannot show timing, sliding or popping/);
  assert.match(contract.AI_OUTSIDE_CHECK, /Missing baseline.*notes only/);
});

test('router is unchanged; editing and worker prompts change only the documented rules', () => {
  assert.deepEqual(fingerprint(contract.AI_ROUTER_PROMPT), BEFORE_RULE.router);
  for (const handbook of [false, true])
    for (const web of [false, true]) {
      const key = (handbook ? 'handbook' : 'plain') + (web ? '+web' : '');
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false })), EXPECTED['editing ' + key], 'editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false }).replace('\n' + ACCEPTED_RULE, '').replace('\n' + EXAMPLE_RULE, '').replace(CONTEXT_AFTER, CONTEXT_BEFORE)), BEFORE_RULE['editing ' + key], 'only the documented rules change editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true })), EXPECTED['worker ' + key], 'worker ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true }).replace('\n' + ACCEPTED_RULE, '').replace('\n' + EXAMPLE_RULE, '').replace(CONTEXT_AFTER, CONTEXT_BEFORE)), BEFORE_RULE['worker ' + key], 'only the documented rules change worker ' + key);
    }
  assert.equal(contract.AI_SYSTEM_PROMPT, contract.AI_EDITING_INTRO + '\n' + contract.AI_EDITING_BODY);
  assert.ok(!contract.AI_EDITING_INTRO.includes('\n'));
});


test('owner example and keep-look replays receive the structural example rule in direct and worker prompts', () => {
  assert.match(turns.turns['27'].text, /welded the bottom right/);
  assert.match(turns.turns['19'].text, /same look with less polygons/);
  for (const worker of [false, true]) {
    const prompt = editingPrompt(contract, { worker });
    assert.match(prompt, /example they made.*first read or sample.*mdlxl_read.*mdlxl_sample/);
    assert.match(prompt, /example's pattern.*full requested scope/);
    assert.match(prompt, /Keep the look.*geometry silhouette and texture appearance.*UV mapping/);
  }
});

test('the context rule explains omitted values and when a full snapshot returns', () => {
  assert.ok(contract.AI_EDITING_BODY.includes(CONTEXT_AFTER));
});
