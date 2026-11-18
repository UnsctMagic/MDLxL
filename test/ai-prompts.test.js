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
  'editing plain': ['8b1bdc6124ce1ac5b5f3480e7970e12232237bff986eb5e871439590b21a6a9c', 6859],
  'editing plain+web': ['e5202f094c34e636a7665f2e45ef40d30d13bd131188a825bc528f0f8117b3e2', 7361],
  'editing handbook': ['1f1fe1abf05b188a2f2d9f64e2e2f126d422fdcabbeb1ce07c146a4450df31b1', 9866],
  'editing handbook+web': ['7c4c8792b5e8d5e257efd5726a9b91172eb709c1433b14353cb840a7c91e616b', 10368],
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
const SWEEP_RULE = "When a requirement must hold in all animations, everywhere or always, use a mdlxl_sample sweep and inspect its worst clip and frame. Include the same sweep in the plan check so review measures it again after edits.";
// Owner, 18 Nov 2026 ("I wanted AI to just have full power in MDLxL"): edits run
// straight away with Undo as the safety net, a plan and a formal review only when the
// user asks, one check after an edit, fewer pictures, and stop/question handling.
// Each pair is [before, after]; undoing them must give back the earlier prompt.
const FULL_POWER_RULES = [
  [
    "Include the same sweep in the plan check so review measures it again after edits",
    "Run the same sweep again after the edit"
  ],
  [
    "Work as an active modeling assistant: inspect, perform the requested work, verify and correct it before reporting completion. Discover relevant installed APIs with capabilities rather than guessing signatures or asking the user to do steps you can perform. Prefer direct scripts for geometry, UV, rig, materials and animation, combining related changes in one Undo step; use UI controls for a tool's live draft/brush workflow. Use local asset libraries and open references when relevant. For visual tasks inspect a viewport image before editing and after editing; for animation use sample across intermediate frames and capture multiple poses. Iterate on a failed result within the requested scope",
    "Work as an active modeling assistant: make the requested change directly and early; Undo is the safety net. Look only at what the change needs (usually one picture or one read), then edit. Discover relevant installed APIs with capabilities rather than guessing signatures or asking the user to do steps you can perform. Prefer direct scripts for geometry, UV, rig, materials and animation, combining related changes in one Undo step; use UI controls for a tool's live draft/brush workflow. Use local asset libraries and open references when relevant. After an edit, check the result once (a picture of the changed part; for animation a sample of a few frames) and report what you see; fix a visible failure within the requested scope. Take only the pictures a question needs: one capture call can show several views, a close-up of chosen vertices, a zoom, only some geosets, wireframe or the UV layout, so do not re-shoot just to change the framing"
  ],
  [
    "Inspect actual captures, sample intermediate animation poses, and use document validate for MDX/MDL serialization when relevant",
    "Use document validate when the save format is in question"
  ],
  [
    "Look first, then change once. Before the first edit of a job, inspect everything the request touches, measure what is actually wrong, and call mdlxl_plan: the cause, how far it reaches (the marked area is where the user saw a symptom; the cause can be larger or smaller), what must stay the same, at least two genuinely different fixes with what each costs, and which one you choose and why. Prefer the fix that removes the cause and keeps the most of what must stay the same over one that compensates for it. Patterns from reference models or rules passed on in the chat (\"Blizzard usually binds X to Y\") are evidence about what is common and why, not orders: check that this model's rig, shapes and motion match the cases the pattern comes from before applying it, and say so when it does not fit. Reason from how the game actually moves and draws the data. Treat earlier AI edits in this model as choices that may be undone, not as fixed data. If a result shows the plan was wrong, go back to the last good version with mdlxl_versions and record a new plan before editing again, rather than patching on top. When several fixes are plausible, save a version, try them side by side, compare, and keep the best. To judge a part, capture it with samples that show only the geosets in question (geosets, plain) before and after, with the same view and frames, so the pair compares like with like",
    "Fix the cause, not the symptom: the marked area is where the user saw a problem; the cause can be larger or smaller. Prefer the change that removes the cause and keeps the most of what must stay the same over one that compensates for it. Patterns from reference models or rules passed on in the chat (\"Blizzard usually binds X to Y\") are evidence about what is common and why, not orders: check that this model's rig, shapes and motion match the cases the pattern comes from before applying it, and say so when it does not fit. Reason from how the game actually moves and draws the data. Treat earlier AI edits in this model as choices that may be undone, not as fixed data. If a result is wrong, go back to the last good version with mdlxl_versions rather than patching on top. Use mdlxl_plan only when the user asks for a plan or options; then wait for their choice before editing. To compare a part before and after, capture the same view and frames showing only the geosets in question"
  ],
  [
    "Before completing an edit, use mdlxl_review inspect. Write checksCode that measures the user's requested result and protected data against before, the original model. Inspect the returned original/edited images (and donor images when copying motion) and animation samples. Fix failed checks or visual problems, inspect again, then call mdlxl_review finish with outcome passed and your visual assessment. Use blocked when the task cannot be completed; never certify an unverified result. A task cannot complete with outstanding verification",
    "Run mdlxl_review (inspect, then finish) only when the user asks you to check, verify or compare a result; otherwise your own short report ends the job. Never call a result verified unless such a review passed"
  ],
  [
    "The user may send new messages while you work: treat the newest one as steering for the current task, acknowledge it briefly and adjust; it does not undo applied edits unless asked.",
    "The user may send new messages while you work: treat the newest one as steering for the current task, acknowledge it briefly and adjust; it does not undo applied edits unless asked. A message asking you to stop means stop: end your turn at once with one short sentence. When the user asks a question or complains (for example \"why did you…\", \"did you change anything?\"), answer it in words first, using read-only tools only for facts you need; do not start or resume edits until they ask for a change. A request phrased as a question (\"can you make the eyes red?\") is a request."
  ]
];
const undoFullPower = text => FULL_POWER_RULES.reduce((s, [before, after]) => s.replace(after, before), text);
const stripMotionRules = text => [SWEEP_RULE, ACCEPTED_RULE, TOLERANCE_RULE, REJECTION_RULE, REUSE_RULE].reduce((s, rule) => s.replace('\n' + rule, ''), text).replace(NUMBER_AFTER, NUMBER_BEFORE);
const EXPECTED = {
  "editing plain": [
    "c82ee8a3d07503482ade2c184dd2fe992511475c1842e6a89cd59bc63deaa918",
    9118
  ],
  "editing plain+web": [
    "ab5333157f421e4f6e584ff0d8f957308d0bd2687efecc7d9701c6aa7114501b",
    9620
  ],
  "editing handbook": [
    "0baa0a6174928512b54333fbbdf3f970a5d6878ae154acea5dfe66eee8d715e0",
    12125
  ],
  "editing handbook+web": [
    "05e9b3df249a2da66a48f1687eacc882a583f1f876b510538fa5ce8c8ab75317",
    12627
  ],
};
const fingerprint = text => [createHash('sha256').update(text, 'utf8').digest('hex'), text.length];

// Research §6.1: add app-owned motion evidence to the outside check while
// retaining its rule that missing evidence is a note, never a failure.
test('outside check deliberately adds motion measurements alongside still pictures', () => {
  assert.deepEqual(fingerprint(contract.AI_OUTSIDE_CHECK.replaceAll("the editing AI", "the worker")), ['37fa817e1c54bbec4de2d1601f0d92930feb4b3a51c4e99fd9a48aced5b8bf01', 1856]);
  assert.match(contract.AI_OUTSIDE_CHECK, /still pictures cannot show timing, sliding or popping/);
  assert.match(contract.AI_OUTSIDE_CHECK, /Missing baseline.*notes only/);
});

test('direct editing prompt hashes retain every existing instruction', () => {
  for (const handbook of [false, true])
    for (const web of [false, true]) {
      const key = (handbook ? 'handbook' : 'plain') + (web ? '+web' : '');
      assert.deepEqual(fingerprint(editingPrompt(contract, { handbook, web })), EXPECTED['editing ' + key], 'editing ' + key);
      assert.deepEqual(fingerprint(stripMotionRules(undoFullPower(editingPrompt(contract, { handbook, web }))).replace('\n' + EXAMPLE_RULE, '').replace(CONTEXT_AFTER, CONTEXT_BEFORE)), BEFORE_RULE['editing ' + key], 'only the documented rules change editing ' + key);
    }
  assert.equal(contract.AI_SYSTEM_PROMPT, contract.AI_EDITING_INTRO + '\n' + contract.AI_EDITING_BODY);
  assert.ok(!contract.AI_EDITING_INTRO.includes('\n'));
});


test('owner example and keep-look replays receive the structural example rule in direct prompts', () => {
  assert.match(turns.turns['27'].text, /welded the bottom right/);
  assert.match(turns.turns['19'].text, /same look with less polygons/);
  {
    const prompt = editingPrompt(contract, {});
    assert.match(prompt, /example they made.*first read or sample.*mdlxl_read.*mdlxl_sample/);
    assert.match(prompt, /example's pattern.*full requested scope/);
    assert.match(prompt, /Keep the look.*geometry silhouette and texture appearance.*UV mapping/);
  }
});

test('the context rule explains omitted values and when a full snapshot returns', () => {
  assert.ok(contract.AI_EDITING_BODY.includes(CONTEXT_AFTER));
});

test('direct jobs reuse model and native textures before creating new ones', async () => {
  const { AI_SD_BRAIN } = await import('../src/ai-sd-rules.js');
  assert.ok(editingPrompt(contract, {}).includes(REUSE_RULE));
  const description = name => contract.AI_TOOLS.find(t => t.name === 'mdlxl_' + name).description;
  assert.match(description('script'), /model’s own textures first, then a native game texture.*Only when the user explicitly asks for a new texture/);
  assert.match(description('assets'), /native game textures here before making a new texture/);
  assert.match(AI_SD_BRAIN, /reuse the model's own textures first, then Blizzard's native game textures/);
  assert.match(AI_SD_BRAIN, /painted texture is the fallback/);
  assert.doesNotMatch(AI_SD_BRAIN, /do not search for, load or copy .* textures/);
});

test('accepted references, tolerance ladders and rejection questions reach direct jobs', () => {
  for (const rule of [ACCEPTED_RULE, TOLERANCE_RULE, REJECTION_RULE])
    assert.ok(editingPrompt(contract, {}).includes(rule));
  assert.equal(TOLERANCE_RULE.split('. ').length, 2); assert.equal(REJECTION_RULE.split('. ').length, 2);
});
