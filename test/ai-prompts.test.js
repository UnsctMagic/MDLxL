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
const EXAMPLE_RULE = "When the user points to an example they made, first read or sample the referenced area with mdlxl_read or mdlxl_sample and inspect its structure before planning edits. Copy that example's pattern and apply it across the full requested scope, including less visible regions; do not substitute your own picks. \"Keep the look\" means preserve the geometry silhouette and texture appearance, including UV mapping and material/texture assignments; reducing polygons does not authorize changing them.";
const EXPECTED = {
  "editing plain": [
    "5c1a89a696270614258692e95d305b8044976ac07e662650aa78a1ec6031ab80",
    7353
  ],
  "worker plain": [
    "10fbd40b4e2ec933667e66c643caa6f88f9ea451b00457003f77a2e028198c96",
    8509
  ],
  "editing plain+web": [
    "924e032c1f99ef9695df33db1bc5d15a0891cf526ccd4ea37c5ffc381c28e0b5",
    7855
  ],
  "worker plain+web": [
    "68c35e013fe9184de0f2308eb5a1120458ec68f74da644dc35bed3bf629d98e7",
    9011
  ],
  "editing handbook": [
    "4371106d5dc7ee8924e7f568a8cdaada2b01f09d8f5194a2f7a1bfc672124a88",
    10360
  ],
  "worker handbook": [
    "fa6947fe0f39324229d40c8ddeac3a8dcbae8bab7fe6051078b9ce09f8737c57",
    11516
  ],
  "editing handbook+web": [
    "bfb3b02cf95c8446fe3b7059a47c3a893fd28004fcc00fce1c6b56172badaeda",
    10862
  ],
  "worker handbook+web": [
    "c356f38b404bed4da5bccca1e4afa116590d0752d57f4161fd8c77cd9749d59e",
    12018
  ]
};
const fingerprint = text => [createHash('sha256').update(text, 'utf8').digest('hex'), text.length];

test('router is unchanged; editing and worker prompts add only the structural example rule', () => {
  assert.deepEqual(fingerprint(contract.AI_ROUTER_PROMPT), BEFORE_RULE.router);
  for (const handbook of [false, true])
    for (const web of [false, true]) {
      const key = (handbook ? 'handbook' : 'plain') + (web ? '+web' : '');
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false })), EXPECTED['editing ' + key], 'editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false }).replace('\n' + EXAMPLE_RULE, '')), BEFORE_RULE['editing ' + key], 'only the added rule changes editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true })), EXPECTED['worker ' + key], 'worker ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true }).replace('\n' + EXAMPLE_RULE, '')), BEFORE_RULE['worker ' + key], 'only the added rule changes worker ' + key);
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
