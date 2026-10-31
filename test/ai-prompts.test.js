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
// Research §6.5: two sentences each, added deliberately to both editing prompts.
const TOLERANCE_RULE = "When a request combines a size or count target with keeping the look or motion, state 'the same' as measured tolerances for each animation, keep first and last poses exact, try more than one tolerance as saved versions, and report each candidate's size and measured difference. If the target cannot be met within the tolerance, show the numbers and let the user choose.";
const REJECTION_RULE = 'When the user rejects a result that your measurements show is close to the accepted version, show where and how much it differs and ask what they see before changing direction. Do not switch to the opposite extreme.';
// AGENTS.md "Reuse, never create unasked": the model's own data, then native game
// files; new textures, materials or geosets only when the user asks for new.
const REUSE_RULE = "Reuse before creating: for textures, materials and geosets use what the model already has first, then Blizzard's native game files (mdlxl_assets source textures or game). Create a new texture, material or geoset only when the user's request explicitly asks for something new; if nothing existing fits, say what you checked and ask first.";
// Geosets list numbers from 1: replies name geosets by that number, not /Geosets/ paths.
const NUMBER_BEFORE = "All IDs are zero-based; explain visible labels clearly.";
const NUMBER_AFTER = "All IDs and paths are zero-based, but the Geosets list numbers geosets from 1: /Geosets/0 is geoset 1 and /Geosets/32 is geoset 33. A geoset number from the user means that list number. When writing to the user, name geosets by the list number (for example \"geoset 33\"), never by a /Geosets/ path or zero-based index, and name bones by name.";
const stripMotionRules = text => [ACCEPTED_RULE, TOLERANCE_RULE, REJECTION_RULE, REUSE_RULE].reduce((s, rule) => s.replace('\n' + rule, ''), text).replace(NUMBER_AFTER, NUMBER_BEFORE);
const EXPECTED = {
  "editing plain": [
    "bc33dc1cb95094e031782f8a99cb21a8f3dc8de5007c71cc951779d2b6843504",
    9101
  ],
  "worker plain": [
    "8cbf2c3391f8c876707c015e6ae1a169157e65042bd848f33a9da5c12878b258",
    10257
  ],
  "editing plain+web": [
    "c57abee71ff629b8d0eee928aae3e66b7132eaf7021747ca3dd04386620288ad",
    9603
  ],
  "worker plain+web": [
    "834f9f3c5dbe00d806bd38c783273e35b26acdfb043ed227cd7eb57a8b3d8b70",
    10759
  ],
  "editing handbook": [
    "5dad8f8a22853ce8f4d082c8c8efcb03bb50cc8d7961e0d3e5513ab6b662a849",
    12108
  ],
  "worker handbook": [
    "d147f2ce4740d8610a5adba5eae23e23867b7bad1cc2d6a5f1dfe87643f09fd0",
    13264
  ],
  "editing handbook+web": [
    "3bd685db2e29da379ebf32827d4bbcc5f3d221e8e2d75d9666a99a50d7e3dbb7",
    12610
  ],
  "worker handbook+web": [
    "76792acbe4bc7ae11ec3cfecf26818ed4b687e6c7956841c9ce8524047dfa06e",
    13766
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

test('router changes only by the tool-areas rule; editing and worker prompts change only the documented rules', () => {
  assert.ok(contract.AI_ROUTER_PROMPT.endsWith(contract.AI_ROUTER_TOOLS_RULE));
  assert.deepEqual(fingerprint(contract.AI_ROUTER_PROMPT.slice(0, -contract.AI_ROUTER_TOOLS_RULE.length)), BEFORE_RULE.router);
  for (const handbook of [false, true])
    for (const web of [false, true]) {
      const key = (handbook ? 'handbook' : 'plain') + (web ? '+web' : '');
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: false })), EXPECTED['editing ' + key], 'editing ' + key);
      assert.deepEqual(fingerprint(stripMotionRules(editingPrompt(contract, { handbook, web, worker: false })).replace('\n' + EXAMPLE_RULE, '').replace(CONTEXT_AFTER, CONTEXT_BEFORE)), BEFORE_RULE['editing ' + key], 'only the documented rules change editing ' + key);
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web, worker: true })), EXPECTED['worker ' + key], 'worker ' + key);
      assert.deepEqual(fingerprint(stripMotionRules(editingPrompt(contract, { handbook, web, worker: true })).replace('\n' + EXAMPLE_RULE, '').replace(CONTEXT_AFTER, CONTEXT_BEFORE)), BEFORE_RULE['worker ' + key], 'only the documented rules change worker ' + key);
    }
  assert.equal(contract.AI_SYSTEM_PROMPT, contract.AI_EDITING_INTRO + '\n' + contract.AI_EDITING_BODY);
  assert.ok(!contract.AI_EDITING_INTRO.includes('\n'));
});


test('the router names exactly the function areas the bird can be handed; the common list goes last', async () => {
  const { AI_AREAS } = await import('../src/ai-capabilities.js');
  const named = contract.AI_ROUTER_TOOLS_RULE.match(/at most three of ([a-z, ]+) \(/)[1].split(', ');
  assert.deepEqual(named, AI_AREAS.map(area => area.id));
  const plain = editingPrompt(contract, { worker: true });
  assert.equal(editingPrompt(contract, { worker: true, functions: 'LIST' }), plain + '\nLIST');
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

test('direct and worker jobs reuse model and native textures before creating new ones', async () => {
  const { AI_SD_BRAIN } = await import('../src/ai-sd-rules.js');
  for (const worker of [false, true]) assert.ok(editingPrompt(contract, { worker }).includes(REUSE_RULE));
  const description = name => contract.AI_TOOLS.find(t => t.name === 'mdlxl_' + name).description;
  assert.match(description('script'), /model’s own textures first, then a native game texture.*Only when the user explicitly asks for a new texture/);
  assert.match(description('assets'), /native game textures here before making a new texture/);
  assert.match(AI_SD_BRAIN, /reuse the model's own textures first, then Blizzard's native game textures/);
  assert.match(AI_SD_BRAIN, /painted texture is the fallback/);
  assert.doesNotMatch(AI_SD_BRAIN, /do not search for, load or copy .* textures/);
});

test('accepted references, tolerance ladders and rejection questions reach direct and worker jobs', () => {
  for (const worker of [false, true]) for (const rule of [ACCEPTED_RULE, TOLERANCE_RULE, REJECTION_RULE])
    assert.ok(editingPrompt(contract, { worker }).includes(rule));
  assert.equal(TOLERANCE_RULE.split('. ').length, 2); assert.equal(REJECTION_RULE.split('. ').length, 2);
});
