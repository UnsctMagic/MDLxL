import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import * as contract from '../src/ai-tools.js';
const { editingPrompt } = createRequire(import.meta.url)('../electron/ai-service.cjs');

// SHA-256 and length of the prompts as assembled on main before they moved into
// src/ai-tools.js (router) and the editing prompt was split into intro and body.
// A prompt change is a product change: update these only on purpose.
const EXPECTED = {
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
const fingerprint = text => [createHash('sha256').update(text, 'utf8').digest('hex'), text.length];

test('router, editing and worker prompts are byte-identical to the texts they replaced', () => {
  assert.deepEqual(fingerprint(contract.AI_ROUTER_PROMPT), EXPECTED.router);
  for (const handbook of [false, true])
    for (const web of [false, true]) {
      const key = (handbook ? 'handbook' : 'plain') + (web ? '+web' : '');
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false })), EXPECTED['editing ' + key], 'editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true })), EXPECTED['worker ' + key], 'worker ' + key);
    }
  assert.equal(contract.AI_SYSTEM_PROMPT, contract.AI_EDITING_INTRO + '\n' + contract.AI_EDITING_BODY);
  assert.ok(!contract.AI_EDITING_INTRO.includes('\n'));
});
