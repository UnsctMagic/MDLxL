# WC3 editing agent: what MDLxL's AI must know to edit Warcraft III SD models

Status: implemented for owner review; integration with PR #317 must retain only the general core
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
3. Every rule says *why* (engine behaviour, measured practice or a cited
   experienced source) and how to check it was followed.
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

New research, condensed into rules with links:

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
  (`mdlxl_capabilities` module names), and source links at the end.
- Where a rule can be checked automatically (for example coincident positions
  keeping identical groups, or an edge joining groups that share no bone), say so;
  building such checks is a possible follow-up, not part of this task.

## Avoid what failed before

- No generic low-poly advice that would fit any game.
- No rules invented without a measurement, an engine fact or a cited experienced source.
- No walls of statistics in the AI's text: numbers only where they change a decision.
- No plumbing instead of knowledge: the deliverable is the knowledge.
- No object-specific rules (see the wording rule above).
- Spend the owner's credits on reading and condensing, not on re-measuring.


## Handbook delivered for review

The core is in `src/ai-tools.js` inside `AI_SYSTEM_PROMPT` (3,005 characters).
The existing ordinary-editing and worker prompt paths both use this constant.
No tool schema, help dispatch, provider, SD Brain switch or model-editing API changed.

The owner was shown the core and section list before the sections were drafted.
Final editorial acceptance is still pending. Each section includes structural
rules, reasons, concrete checks, current tool owners and source links:

1. [Geometry and shading](../WC3-EDITING-GEOMETRY.md)
2. [UVs, materials and visibility](../WC3-EDITING-UV-MATERIALS.md)
3. [Nodes, hierarchy and binding](../WC3-EDITING-NODES-BINDING.md)
4. [Animation and motion transfer](../WC3-EDITING-ANIMATION.md)
5. [Particles, ribbons, lights and events](../WC3-EDITING-EMITTERS.md)
6. [File format and game integration](../WC3-EDITING-GAME-INTEGRATION.md)
7. [Verification](../WC3-EDITING-VERIFICATION.md)

All seven top-level Markdown topics load through the existing `mdlxl_help`
glob and dispatcher while SD Brain is parked. No new checker or automatic repair
was built. Existing source/renderer behavior is distinguished from game acceptance.

### Core for editorial review

```text
Warcraft III SD editing
Inspect the requested surface and its dependencies before changing it: mesh, UV set, material layers, skinning, hierarchy and relevant sequences. A visible defect can come from another mechanism. Identify the cause, preserve unrelated data, and compare the same views and poses before and after.
Preserve the input's format and authored conventions. SD appearance does not imply MDX 800 or classic skinning. Check actual fields and the target game version; reference-model counts are examples, not engine limits.
Coincident positions are not necessarily redundant vertices: UV seams, hard normals, material boundaries and independently moving parts need splits. Weld only compatible corners unless the user explicitly requests collapsing their attributes. Distinguish wrong triangle facing, shading and shape; check each with the appropriate view.
Bind by intended motion. Classic matrix groups average their bones equally; weighted skin stores explicit influences. Across a continuous surface, transition through blended regions and keep seam copies moving together. A layered surface that must follow an underlying deforming surface needs corresponding influences where they overlap. Separate parts and freely moving chains retain their own motion. Proximity alone does not establish correspondence. Check joint extremes and intermediate poses for opening seams, sliding and intersections.
Trace visibility through geoset alpha, every material layer, texture alpha and active local/global tracks. Editor hiding is separate. Preserve layer order, filter modes, replaceable textures and paths; inspect the textured result at relevant times and contrasting team colours.
Animation includes more than bone keys. Preserve sequence names, intervals, loop flags, rarity, movement metadata, events and effect timing. Retarget through actual hierarchy, pivots and rest orientation; matching names alone is insufficient. Keep sparse keys where they reproduce the motion, preserve interpolation and tangents, and test between keys and across loop boundaries.
Verify the requested change and protected data separately. Inspect posed geometry and actual captures, check affected bounds, then save/reopen through the existing serializer. A viewer, sampler or clean checker cannot certify Warcraft III behavior. Report which checks ran and which game behaviors remain untested.
Read the affected mdlxl_help topics before unfamiliar edits; reuse sections already read in this conversation: shape/weld/normals -> WC3-EDITING-GEOMETRY.md; wrap/texture/colour/visibility -> WC3-EDITING-UV-MATERIALS.md; hierarchy/pivots/skin/layered surfaces -> WC3-EDITING-NODES-BINDING.md; keys/retiming/donor motion -> WC3-EDITING-ANIMATION.md; particles/ribbons/lights/events -> WC3-EDITING-EMITTERS.md; format/attachments/collision/portrait/glow/lifecycle -> WC3-EDITING-GAME-INTEGRATION.md; completion checks -> WC3-EDITING-VERIFICATION.md. Each section explains why, how to check, existing tools and sources.
```

## Evidence and limits

Existing datasets were reused; no new corpus extraction or model remeasurement
was needed. Current API owners were checked against their actual implementation.
Hive and XGM pages cited by the sections were read successfully in this session;
no browser takeover was needed. The handbook uses format facts, qualified measured
practice and attributed practitioner explanations, not object-specific recipes.

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

PR #317 was still open at implementation time, head
`1d4af59eae24adfa5124c5e7f4c798d21019605f`.
The owner explicitly authorized: "Prepare core on #318 now; document overlap".
This branch therefore adds the general core without importing #317's unrelated
picture, selection or provider changes.

When reconciling the branches, keep this general core and remove #317's
object/model-specific binding paragraph. Do not retain both blocks or overwrite
#317's unrelated fixes. Recheck the final `AI_SYSTEM_PROMPT` and help topics.
Neither PR was merged by this task.

## Verification

Checked on 26 October 2026 after inserting the core:

- `pnpm run build`: passed. Both generated AI-tool bundles contain the core.
- `node --test test/ai-*.test.js`: 98 passed, zero failed, one skipped.
- `pnpm run test:source`: 1,960 passed, zero failed, 22 skipped.
- `pnpm test`: 57 passed, zero failed.
- Imported `AI_SYSTEM_PROMPT`: the core is 3,005 characters and references exactly
  the seven delivered topics. Removing that block reproduces the original
  `src/ai-tools.js`, confirming no other prompt/tool-contract change.
- Actual Vite glob + `AiEditorBridge.dispatch('mdlxl_help', ...)`: all seven
  guides listed and returned their real text while SD Brain was parked.
- 86 relative links/anchors and 139 in-text source references resolved across
  the seven guides. Named tool/module owners were checked in current source.
- `git diff --check`: passed.

The first full-source run lacked the built particle/validation modules and
FFmpeg. Building and supplying the existing binaries after verifying their
pinned hashes resolved all 14 failures; no product fix or baseline change was
needed. The final full run above includes all prerequisites and the final core.

Not exercised: packaged desktop interaction, paid before/after AI editing trials,
or Warcraft III gameplay. No model assets, installed app, personal profiles or
source inputs were changed. Owner editorial review is still the acceptance gate.
The optional paid AI comparison still requires the owner's approval.


## Next action

Owner review of the core and seven linked sections. Keep PR #318 unmerged until
the owner accepts the handbook and authorizes merging. Reconcile #317's overlapping
binding paragraph as described above; preserve its unrelated fixes.
