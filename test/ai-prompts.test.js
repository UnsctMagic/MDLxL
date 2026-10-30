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
const EXPECTED = {
  "editing plain": [
    "420a606e958051b0656265cab9f966d21825a7217b9556e4e69aaede96505dc0",
    7476
  ],
  "worker plain": [
    "edb0c23446e842b54bbd74dafa4ee13dda1c74693f0053f4cb99a2cd90c6c81d",
    8632
  ],
  "editing plain+web": [
    "d236dbcd9515205babfd96e751bacc83d63d044e5bb495f693a30ba7b9960222",
    7978
  ],
  "worker plain+web": [
    "978f02fb7f0f4c08bc9581a302c718b2f0d3c2bfaf3d695805e94dfe691b2039",
    9134
  ],
  "editing handbook": [
    "ee3b3ba9a3d11794edd501a2f513665a8eae571ef0cdbdd0081430fb328b58f1",
    10483
  ],
  "worker handbook": [
    "bb4e8d3b44c06d8c82604232d26f21b07dceef1ac67c80cb1b6eba7ec977520f",
    11639
  ],
  "editing handbook+web": [
    "30a3132a1b22ef1ac20a92786426c6d487406e88292da9f7d42f71d20b6fb94b",
    10985
  ],
  "worker handbook+web": [
    "62b4ee8e48219ad830fca8e02a96bd27b9214e295fbc03d336656f97252bce6b",
    12141
  ]
};
const fingerprint = text => [createHash('sha256').update(text, 'utf8').digest('hex'), text.length];

test('router is unchanged; editing and worker prompts change only the example and incremental-context rules', () => {
  assert.deepEqual(fingerprint(contract.AI_ROUTER_PROMPT), BEFORE_RULE.router);
  for (const handbook of [false, true])
    for (const web of [false, true]) {
      const key = (handbook ? 'handbook' : 'plain') + (web ? '+web' : '');
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false })), EXPECTED['editing ' + key], 'editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false }).replace('\n' + EXAMPLE_RULE, '').replace(CONTEXT_AFTER, CONTEXT_BEFORE)), BEFORE_RULE['editing ' + key], 'only the documented rules change editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true })), EXPECTED['worker ' + key], 'worker ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true }).replace('\n' + EXAMPLE_RULE, '').replace(CONTEXT_AFTER, CONTEXT_BEFORE)), BEFORE_RULE['worker ' + key], 'only the documented rules change worker ' + key);
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
