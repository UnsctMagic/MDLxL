# WC3 editing agent: what MDLxL's AI must know to edit Warcraft III SD models

Status: second pass implemented for owner review; integration with PR #317 must retain only the general core
Owner / consolidator: Codex (written by Claude Code from its conversation with the owner)
Updated: 26 October 2026

## Goal and completion criteria

Give MDLxL's AI a condensed, general **editing knowledge base** for Warcraft III SD
models, so it stops spending time working out how things work and starts editing
correctly. It covers everything an edit can touch:

- geometry and shapes: topology, seams, normals, density, silhouette, welding, separate parts
- UVs, textures, materials, layers, filter modes, team colour, replaceable textures
- geosets and geoset animations (visibility, alpha, colour)
- nodes: bones, helpers, attachments, hierarchy, pivots, billboarding, collision shapes
- binding: matrix groups and weighted skinning, joints, layered surfaces
- animation: sequences, intervals, extents, rarity, move speed, keyframes, interpolation,
  loops, global sequences, retargeting a donor's motion onto another mesh
- emitters: particle (2), ribbons, lights, event objects, sounds, splats/ubersplats
- cameras and portraits, hero glow and other game-side conventions
- file versions (800/900/1000+), limits the game enforces, and what breaks in game
- how to verify an edit (what to sample, capture and measure before saying it is done)

**This is not SD Brain.** SD Brain was about producing new SD art from a prompt.
This is the craft of editing models correctly: mechanics, conventions and the
pitfalls experienced modellers know.

Done when:

1. A short **core** (all rules that apply to almost every edit) is part of every
   AI turn, replacing the binding paragraph that PR #317 adds to `AI_SYSTEM_PROMPT`.
2. **Area sections** (geometry, UV/materials, nodes/binding, animation, emitters,
   game integration, verification) are reachable through the AI's existing help
   tool, and the core tells the AI which section to read for which kind of edit.
3. Each actionable rule gives the ordered method, data to read/write, existing
   API/tool and verification. General limits appear once in the verification guide.
4. The owner reviews it and agrees it reads like an experienced modeller's
   handbook, not a report.

## The one rule about wording (the owner insists, and was angry when it was broken)

When the owner reports a problem, it is an **example of a general pattern**. The
knowledge must state the pattern, in **structural terms**, so it applies to every
model and every part. Never write a rule about one object, one body part or one model.

- Wrong: "the skirt follows the thighs", "bind the belly under the armour",
  "do it like the Sorceress".
- Right: "a layered geoset over a deforming region takes the bone influence of the
  surface under it wherever they overlap, so both move together".

Useful structural vocabulary: *layered geoset* (a surface lying on or close to
another), *deforming region* (where bones meet and move against each other),
*continuous surface* (geometry continuing across a seam, material split or
connector), *separate part* (meant to move on its own), *shared position*
(coincident vertices), *chain* (a run of bones such as cloth, hair, tails, tentacles).

Named models may appear only as evidence in the research notes, never as the rule.
"Specific" is fine for mechanics (exact numbers, exact engine behaviour); it is
wrong for scope.

## Inputs: reuse first, do not reopen thousands of models

The measuring has largely been done. Open game files again only to fill a gap a
rule actually needs, and say which gap.

- **Codex SD research** (draft PR #302, branch `codex/sd-research`), with data at
  `D:/Codex/sd-research/` (start at `START-HERE.html`): structural measurements of
  3,448 native, 130 LowPolyWorks (the owner's own) and 646 permitted Hive models,
  connected components, UV and texture evidence, construction families, painting
  and faction studies. Most useful here for geometry, UV and texture rules.
- **SD reference study and rulebook on main**: `docs/AI-SD-REFERENCE-STUDY.md`,
  `docs/AI-SD-STUDY-DATA.json`, `docs/AI-SD-RULEBOOK.md` (sizes, bones, animation
  economy, key counts, sequence conventions, material and texture observations).
- **Binding study** (Claude Code, 26 Oct): `D:/Codex/wc3-editing-agent/inputs/binding-study/`.
  `study.json` covers 415 native unit models; `lpw-study.json` covers a separate
  ten-model LowPolyWorks sample. The `.mjs` scripts reproduce the measurements.
  Reuse the aggregate evidence with the [qualifications below](#evidence-and-limits).
  The binding paragraph in PR #317 is too specific; the general core replaces its
  role once the branches are reconciled.
- **Earlier SD Brain research, rejected for its purpose but full of usable facts**:
  - branch `codex/sd-brain-wc3-knowledge` (PR #299): `docs/AI-SD-PART-SUMMARY.json`,
    `docs/AI-SD-TEXTURE-CATALOGUE.json`, `docs/AI-SD-HANDBOOK/`
  - branch `claude/sd-brain-knowledge`: `docs/SD-STYLES.md`,
    `docs/agent-tasks/sd-brain-knowledge.md`
  - untracked prompt `D:/Claude/MDLxL/docs/agent-tasks/sd-brain-real-research.md`
    (also explains why PR #299 failed; read its "failed attempt" list)
  Take the facts, leave the art-production framing behind.
- **Existing MDLxL knowledge**: `docs/COMMUNITY_RESEARCH.md` (sourced community
  findings), `docs/NORMALS-XL.md`, `docs/GLOW_UP.md`, `docs/POSE_IK.md`,
  `docs/MOTION-INSPECTOR.md`, `docs/OPTIMIZEXL_TEACHING.md`,
  `docs/MDL-MDX-COMPATIBILITY-FIXES.md`, `docs/AI-HOOK.md`.

Research inputs for the methods; keep attribution outside the handbook:

- Hive Workshop tutorials, the modelling and animation forums, and answered threads
  (accepted or well-received answers by experienced modellers).
- XGM (xgm.guru) tutorials and articles on WC3 modelling, animation and MDX/MDL.
- Format references (MDX/MDL specs, war3-model, Retera's Model Studio and Magos notes)
  for engine behaviour: skinning, interpolation, billboarding, emitter fields, limits.
- Hive puts a bot check in front of automated readers. If a page cannot be read,
  ask the owner to open it once in a browser rather than guessing its content.

## What the AI receives

- **Core** (in `AI_SYSTEM_PROMPT`, `src/ai-tools.js`): the general rules every edit
  needs, plus a one-line map "editing X → read help topic Y". Keep it tight: it is
  sent with every turn (prompt-cached since PR #315). Aim for a few thousand
  characters, not a manual.
- **Area sections**: Markdown files the AI reads with `mdlxl_help`. The help index
  is `import.meta.glob(['../docs/*.md', ...])` in `app/ai-editor.js`; either put the
  sections in `docs/` top level or extend that glob. Each section: rules, why, how
  to check, common mistakes, the API or tool in MDLxL that does it
  (`mdlxl_capabilities` module names). No source links (owner decision).
- Where a rule can be checked automatically (for example coincident positions
  keeping identical groups, or an edge joining groups that share no bone), say so;
  building such checks is a possible follow-up, not part of this task.

## Avoid what failed before

- No generic low-poly advice that would fit any game.
- No rules invented without a measurement, an engine fact or experienced practice behind them.
- No walls of statistics in the AI's text: numbers only where they change a decision.
- No plumbing instead of knowledge: the deliverable is the knowledge.
- No object-specific rules (see the wording rule above).
- Spend the owner's credits on reading and condensing, not on re-measuring.


## Handbook delivered for review

The core is in `src/ai-tools.js` inside `AI_SYSTEM_PROMPT` (2,982 characters; first pass: 3,005).
The existing ordinary-editing and worker prompt paths both use this constant.
No tool schema, help dispatch, provider, SD Brain switch or model-editing API changed.

The owner was shown the core and section list before the sections were drafted.
Final editorial acceptance is still pending. The second pass replaces principles
with numbered procedures, exact existing signatures and read/write/check steps.
Rules use structural terms. The seven guides contain no source tags, Sources
sections, author names, research attribution or source links:

1. [Geometry and shading](../WC3-EDITING-GEOMETRY.md)
2. [UVs, materials and visibility](../WC3-EDITING-UV-MATERIALS.md)
3. [Nodes, hierarchy and binding](../WC3-EDITING-NODES-BINDING.md)
4. [Animation and motion transfer](../WC3-EDITING-ANIMATION.md)
5. [Particles, ribbons, lights and events](../WC3-EDITING-EMITTERS.md)
6. [File format and game integration](../WC3-EDITING-GAME-INTEGRATION.md)
7. [Verification](../WC3-EDITING-VERIFICATION.md)

All seven top-level Markdown topics load through the existing `mdlxl_help`
glob and dispatcher while SD Brain is parked. No new checker or automatic repair
was built. General verification limits are collected in the verification guide.

### Core for editorial review

```text
Warcraft III SD editing
Inspect the selected surface's mesh, UVs, material layers, bindings, ancestors and clips. Identify the responsible data, record protected fields, then edit that owner. Preserve the input format, authored conventions and unrelated data.
For a continuous join, pair boundary vertices by connectivity, surface side and adjoining faces. Match their positions and resolved influences while retaining UV and hard-normal splits. Weld only compatible corners. Diagnose shape, triangle facing and shading separately; use the geometry guide's edge-split and normal-rebuild procedures.
Bind by intended motion. Classic groups average their bone members equally; weighted skin takes explicit normalized influences. Give seam copies the same motion and carry joint changes through blend rows. For layers, map to the correct underlying triangles by component, facing and side; copy the underlying transition through contact, then blend toward the independent driver where the layer lifts away. Keep free chains independent beyond their anchor. Sample bends, twists and intermediate poses for gaps, sliding and penetration.
Resolve every rendered layer and its UV set before changing a wrap. Duplicate shared face corners when only one side needs different UVs. Edit visibility at its geoset, material-layer or effect owner and retain the existing local/global clock. Preserve layer order, filter modes, replaceable textures and paths; inspect the textured result at relevant times and contrasting team colours.
Map donor motion through hierarchy, pivots and parent spaces. Copy keys only between compatible spaces; otherwise solve recipient poses from aligned trajectories. Retiming includes every local controller and event, plus shifted later clips. Preserve interpolation, controls, sequence metadata and global clocks. Keep meaningful keys, check between them and match loop endpoints.
Place effects with their parents and resources. Separate emission timing, particle lifetime and visibility; replay from onset through residual particles and trails. Use the pivot-compensation procedure before relocating an animated pivot.
Read the relevant mdlxl_help topic before an unfamiliar operation; reuse sections already read: shape/weld/normals -> WC3-EDITING-GEOMETRY.md; wrap/texture/colour/visibility -> WC3-EDITING-UV-MATERIALS.md; hierarchy/pivots/skin/layers -> WC3-EDITING-NODES-BINDING.md; keys/retiming/donor motion -> WC3-EDITING-ANIMATION.md; particles/ribbons/lights/events -> WC3-EDITING-EMITTERS.md; format/bounds/attachments/collision/portrait/glow/lifecycle -> WC3-EDITING-GAME-INTEGRATION.md; review/limits -> WC3-EDITING-VERIFICATION.md. Follow their ordered procedures and existing API signatures.
Verify the requested result and protected data separately. Compare the same poses and views, inspect actual captures, recalculate affected bounds, validate save/reopen, then finish through mdlxl_review. Report the checks performed and remaining game tests.
```

## Evidence and limits

Existing datasets were reused; no new corpus extraction or model remeasurement
was needed. Current API owners were checked against their actual implementation.
Additional Hive and XGM rigging, transfer and emitter explanations were read
successfully for the second pass; no bot-check interruption or desktop control
was needed. Techniques were checked against current module behavior and condensed
into structural procedures. Attribution remains outside the seven guides.

The original binding-study shorthand needs these qualifications:

- `study.json`: 415 native unit models, 414 classic and one weighted. Classic
  vertex counts by group size 1..7 are 164,778 / 72,825 / 14,129 / 4,588 / 556 /
  102 / 10. Seven members and 120 groups are observed maxima, not game limits.
  No repeated group members were observed; absence in a sample is not proof of a
  format prohibition. Equal-average skinning comes from the transform implementation.
- The 653,607 adjacency observations are **triangle-edge occurrences**, not
  deduplicated mesh edges. 164 have disjoint endpoint groups (about 0.025%).
  This supports inspecting abrupt transitions, not automatically changing every
  disjoint edge.
- Same-geoset coincident pairs: 159,222 identical groups, 17 overlapping groups,
  751 disjoint. Cross-geoset coincidences include many disjoint groups: identical
  position does not establish one continuous moving surface.
- `lpw-study.json` is a **ten-model sample**, not all 130 LowPolyWorks models.
  Its layer proxy pairs nearest vertices in different geosets within 2% of the
  whole-model bounding diagonal, excluding the coincidence epsilon of 0.0001
  diagonal. 11,960 / 16,885 pairs (70.83%) have equal groups; another 817 overlap.
  This is proximity evidence, not a semantic proof of overlapping surfaces or
  permission to rebind by nearest neighbour.
- Statements about keyed helpers and free chains also draw on existing POSE/glow
  structural studies and transform mechanics; the aggregate proximity counts
  do not establish those relationships.

Reproduction inputs remain at
`D:/Codex/wc3-editing-agent/inputs/binding-study/`:
`study.json`, `lpw-study.json`, `study.mjs`, `study-dir.mjs`,
`sd-units.json` and `demoness.mjs`.
The inputs were preserved and are not packaged with the handbook.

The continuing construction/UV research is PR #302
(`codex/sd-research`, local `D:/Codex/sd-research/`); the older parked SD Brain
branches supplied factual context only. Neither their product direction nor
unreviewed generation rules were enabled.

Remaining engine limits are explicit: codec field widths do not establish safe
renderer budgets; finite samples do not prove all spline extrema; CPU sampling
does not validate billboards, effects or composed materials; editor images and
serialization do not certify Warcraft III behavior. Historical community
warnings are qualified when their authors revised them or reported uncertainty.


## Revision and local state

- Branch: `claude/wc3-editing-agent` from main `548c1b89`. Continue this branch and
  its PR; do not create a competing note.
- Related open PR: #317 (`claude/ai-pictures`) carries picture fixes and the
  too-specific binding paragraph this task replaces. Coordinate: replace that
  paragraph on this branch once #317 is merged, or ask the owner.
- Local inputs: `D:/Codex/sd-research/`, `D:/Codex/wc3-editing-agent/inputs/`.
- Implementation is committed on PR #318 with this note. The disposable Codex checkout, build and test files are removed after push; original Claude checkouts and local inputs are preserved.

### PR #317 coordination

PR #317 was rechecked during the second pass and remains open, head
`1d4af59eae24adfa5124c5e7f4c798d21019605f`.
The owner explicitly authorized: "Prepare core on #318 now; document overlap".
This branch therefore adds the general core without importing #317's unrelated
picture, selection or provider changes.

When reconciling the branches, keep this general core and remove #317's
object/model-specific binding paragraph. Do not retain both blocks or overwrite
#317's unrelated fixes. Recheck the final `AI_SYSTEM_PROMPT` and help topics.
Neither PR was merged by this task.

## Verification

Second pass checked on 26 October 2026:

- `pnpm run build`: passed; the revised core is present in the built AI-tool bundles.
- `node --test test/ai-*.test.js`: 98 passed, zero failed, one skipped.
- `pnpm run test:source`: 1,960 passed, zero failed, 22 skipped.
- `pnpm test`: 57 passed, zero failed.
- Temporary procedure checks exercised pivot compensation with varying rotation
  and scale (maximum sampled matrix error below 0.000002), donor ObjectId remapping
  with preserved cubic controls, retiming of events/materials/later clips with
  global clocks preserved, seam splitting with protected streams, and all three
  conforming edge-split cases.
- All documented module exports resolve; actual Vite help dispatch lists and
  loads all seven revised guides with SD Brain parked.
- All 26 guide links/anchors resolve. No source tags, attribution, external
  citations or Sources sections remain in the guides.
- The core is 2,982 characters, down from 3,005. The rest of
  `src/ai-tools.js` matches the pulled revision exactly.
- `git diff --check`: passed.

The full source run used built runtime modules and existing FFmpeg binaries
verified against the repository's pinned hashes. No baseline change was needed.
No permanent test/tool/checker or automatic repair was added.

Not exercised: packaged desktop interaction, paid before/after AI editing trials,
or Warcraft III gameplay. No model assets, installed app, personal profiles or
source inputs were changed. Owner editorial review is still the acceptance gate.
The optional paid AI comparison still requires the owner's approval.


## Second pass (owner requested, 26 October 2026)

Review of the first pass: the wording rule, reuse of research, factual accuracy
and checks are good. It does not yet meet the goal "the AI spends less time
figuring things out and goes straight to work", for three reasons. Fix these on
this branch; keep everything that is already right.

### 1. Turn principles into methods

Each section says what must be true, rarely how to make it true. For every rule an
AI is likely to act on, add the method: the order of steps, the data to read, the
values to write, and the MDLxL API or tool that does it (with its real signature).
Write it as a short numbered procedure where order matters.

Example of the level required (binding a layered surface over a deforming region):
which vertices of the underlying surface correspond to each layer vertex and how
to find them robustly (not nearest vertex alone: surface side, facing, part
membership); which groups the layer takes inside the overlap; how the blend runs
out to the layer's own driver where it lifts away; what to do when the layer
spans two deforming regions; how to check the result in posed frames. Do the same
for every comparable task: joining a continuous surface across a seam or geoset
split, adding a blend ring at a joint, adding a free chain, moving a pivot without
breaking existing clips, retargeting a donor's motion, retiming a clip with its
events, adding or copying an emitter, changing visibility or a material layer,
welding, repairing normals, adjusting UVs over a seam.

### 2. State rules directly; put caution in one place

The sections repeat what the AI must not conclude ("does not prove", "inspection
candidate, not an automatic repair", "does not establish", "cannot certify").
That makes an AI hesitate and re-check, the opposite of the goal.

- Write rules as instructions: "do X", "X takes Y", "check Z".
- Keep a caution only where acting on the rule would damage authored data, and then
  say what to do instead.
- Move the general limits (editor previews versus the game, samples versus every
  frame, measurements versus engine limits) into `WC3-EDITING-VERIFICATION.md`
  once, and remove the repeats from the other sections and the core.
- Keep the core tight (about its current size); it may become more direct, not longer.

### 3. Add experienced modellers' knowledge

Practitioner knowledge is meant to be a main source, and nodes and binding has
almost none yet. Read and condense:

- Hive Workshop modelling, rigging, animation and effects tutorials, and answered
  forum threads where experienced modellers explain a fix that worked.
- XGM (xgm.guru) articles and FAQ threads on the same topics.
- Tool documentation and notes from experienced authors (Retera's Model Studio,
  Magos, Mdlvis, war3-model, 3ds Max/Blender export notes) where they explain how
  the game treats the data.

Prioritise binding and rigging, animation transfer and retiming, geometry at
seams/joints, and emitters. Keep the technique, not the story. Where practitioners
disagree, write the version supported by measurement or engine behaviour.

### 4. No sources in the handbook (owner decision)

The guides state rules as rules. Remove every source tag (B1, H1, X1 and the like),
every "Sources" section, and every mention of where a rule came from (studies,
percentages as justification, tutorial authors, "the native study shows"). Keep a
number only where it changes a decision (a limit, a unit, a typical count). The
owner considers provenance unnecessary there and an invitation for criticism.
Research inputs stay where they are for reference; do not copy them into the guides.

### Unchanged

- The wording rule: structural terms only, no object, part or model names in rules.
- Reuse existing research; open game models only for a gap a method needs.
- No new tools or automatic repairs in this task.
- Keep PR #318 unmerged until the owner accepts it. Reconcile with #317 as
  described above.

## Next action

Second pass is implemented and verified. Owner review of the revised core and
seven method guides is next. Keep PR #318 unmerged until the owner accepts the
handbook and authorizes merging. Reconcile #317 using the instruction above.
