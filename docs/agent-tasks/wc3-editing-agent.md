# WC3 editing agent: what MDLxL's AI must know to edit Warcraft III SD models

Status: active, ready for Codex to start
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
  `study.json` covers all 415 SD unit models; `lpw-study.json` covers the owner's
  LowPolyWorks models; the `.mjs` scripts reproduce them. Findings to turn into
  general rules:
  - a classic vertex follows the equal-weight average of its group's bones; no
    weights, no repeated bones; up to 256 groups per geoset
  - 64% of vertices have 1 bone, 28% have 2, 5.5% have 3, 1.8% have 4, under 0.3% more
  - neighbouring vertices of a connected surface share at least one bone (only
    0.03% of 653,607 edges do not): binding changes through rings of blended vertices
  - coincident vertices inside a geoset have identical groups (99.5%); across
    geosets they match when the surface continues, and differ only for separate parts
  - layered geosets resting on a body share its bones where they overlap (owner's
    models: 71%); blends appear at joints and in regions where neighbouring limbs
    or a layer would otherwise separate or intersect
  - chains (cloth, hair, capes) have their own keyed bones blended into the root
  - the skeleton is a keyed helper hierarchy with skinned bones under it
  The binding paragraph now in PR #317 (`src/ai-tools.js`) is too specific. Replace it.
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

## Revision and local state

- Branch: `claude/wc3-editing-agent` from main `548c1b89`. Continue this branch and
  its PR; do not create a competing note.
- Related open PR: #317 (`claude/ai-pictures`) carries picture fixes and the
  too-specific binding paragraph this task replaces. Coordinate: replace that
  paragraph on this branch once #317 is merged, or ask the owner.
- Local inputs: `D:/Codex/sd-research/`, `D:/Codex/wc3-editing-agent/inputs/`.
- Uncommitted changes: none.

## Verification

- `node --test test/ai-*.test.js` and `pnpm run test:source` stay green; the help
  index lists the new sections; the core loads in `AI_SYSTEM_PROMPT`.
- Owner review of the core and sections is the acceptance gate.
- Optional, only with the owner's approval because it spends API credits: give the
  AI two or three varied editing tasks before and after, on different models, and
  compare how much it had to work out by itself.

## Next action

Read the inputs above, draft the core and the section list for the owner to look
at first, then write the sections.
