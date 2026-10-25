# SD Brain: an art director that knows the toolbox, the box of parts and the palettes

Status: active; plan steps 1–4 being built by a worker session
Owner / consolidator: Claude Code (organiser session local_1220aaee-c4c9-49b5-8f18-913dac16f85b)
Updated: 25 October 2026

## Goal and completion criteria

- SD Brain turns a casual request into an SD Warcraft III model the owner would accept,
  using every technique an SD modeller uses. The owner's direction is recorded in
  [SD styles](../SD-STYLES.md): SD is one standard (MDX 800, model file roughly 200–700 KB by
  type, 256 or 512 textures) with four ways of making it (Blizzard: reshape, don't rebuild;
  HerrDave: simplest; Gluma: painted skin, heavy rig and animation; HQSD: the owner's upgrade
  layer on any base). These are styles, not rules.
- The art director is unrestricted: it may kitbash native parts, reshape a native base, use
  textures as kitbash palettes (chosen by look, whatever the sheet was made for) or as a model's
  own skin, and build new shapes, as long as new shapes respect the craft in SD-STYLES.md. Native
  textures and parts come first. Mixing is the default: start from a Blizzard reference part or
  base, then add shapes and build further. The owner may ask for one approach ("kitbash", or "a
  standard model with its own texture").
- Example of a valid direction for "orc warlord": Grunt base, Thrall's head, new hair, a helmet
  with horns, reshaped and recoloured from a palette, Frostmourne with a new hilt.
- Team colour is a design choice, never a default on weapons.
- SD Brain stays parked in shipped source (`SD_BRAIN_AVAILABLE = false`); the test build has it on.
  No merge without owner approval.

## Plan (approved by the owner, 25 October 2026)

1. Art director as a kitbash director. Its brief lists the base or reference to start from;
   what to keep, remove, take from other models, reshape or build new; and the paint for each
   part (native skin, a palette area of another sheet, tint, or the kit's own paint).
2. Box-of-parts guide: which game models carry recognisable parts (Frostmourne on Arthas,
   Thrall's head, horns, helmets, shields, weapons first) plus the owner's BITZ box. Built from
   the research labels and model names, checked by loading the models.
3. Palettes by looking: the AI previews a sheet before using an area of it. The region list in
   `src/sd-knowledge.js` only says where to start looking.
4. Builder moves: load a base, remove a part, bring in a part from another model and fit it to
   the right bone, reshape without breaking its texture, recolour with a palette area or tint,
   build new HQSD gear. Kit: real edge cutouts (thin contrasting edge piece on the blade body),
   pointed outlines instead of square steps, layered trims, smooth shading inside a piece, new
   shapes that attach to a reference part.
5. Checks: format 800, model file size for the type, 256/512 textures, detail in gear rather
   than body, and a side-by-side picture with the base or reference model.
6. Real prompt tests in the test build ("orc warlord", "brutal sword", "chaos knight of nurgle",
   "give him a skull helmet") only after the owner sees steps 1–4 and says go (AI credits).

## Revision and local state

- Branch `claude/sd-brain-knowledge`, worktree `D:/Claude/MDLxL/.claude/worktrees/sd-brain-knowledge`,
  draft PR https://github.com/UnsctMagic/MDLxL/pull/303. Research PR #302 and the rejected #299
  are untouched.
- Test build (SD Brain on, flips not committed): `D:/Claude/MDLxL-TestBuilds/SD-Brain-Knowledge`.
  Its saved chats are in `resources/app/profile/ai/`.
- Local evidence, not committed: `out/rules/` (measuring scripts and pictures behind
  SD-STYLES.md), `out/traitor/` (Traitor Axe analysis), `out/sd-native-check/`.
- Regenerating the knowledge pack needs `D:/Codex/sd-research` and
  `D:/Codex/mdlxl-sd-rulebook-20261024/work/casc-texture-index.json`.

## Relevant owners

- `src/ai-sd-rules.js`: `AI_SD_ART_DIRECTOR`, `AI_SD_BRAIN`, `SD_BRAIN_REVISION`, `SD_BRAIN_AVAILABLE`.
- `electron/ai-service.cjs` `artDirection()`: the director turn and its evidence block.
- `src/sd-knowledge.js` over the generated `src/sd-knowledge-data.js`
  (`scripts/sd-knowledge/build-pack.mjs`): texture regions by look, families, norms, factions,
  chapters, `briefEvidence`, `checkAgainstNorms`.
- `src/sd-kit.js`: kit parts, painter, `native` regions (`commitNative`).
- Existing toolbox the AI already has: `mdlxl_assets` in `src/ai-tools.js` (search model
  textures, texture library, BITZ parts, game files; preview a texture; load a game model or part
  as a reference); `src/bits-and-parts.js` (`collectPart`, `commitPart` with replacement,
  `positionPart`, `previewPartReplacement`); uv-tools, mesh and bone modules via `api.module`.

## Findings and decisions

- The test-build "brutal sword" failed: one flat-shaded slab (sharp side 1.00), no edge, a banded
  strip of AxeBladeBlueSteel picked from a text list without looking, square steps, box hilt,
  "item" triangle targets (33–132) instead of weapon references. Saved chat:
  `chat-30bcd798-dfe7-4098-bfb7-850ac53f770d-jackdaw.json` in the test build profile.
- Verified evidence for the styles, with counts, is in SD-STYLES.md (14 of 20 owner bladed
  weapons use contrasting cutouts; 12 of 14 edge pieces thin out; gear 3 times the body's density;
  all 26 owner models credit a base model).
- Avoid repeating: grouping LowPolyWorks models by every credited author (use the first author);
  claiming shading or texture density without measuring; feeding the AI label lists instead of
  letting it look at sheets.

## Changes and verification

- Done earlier on this branch: knowledge pack, `sd-knowledge` lookups, sd-kit `native`
  regions, director evidence block. Tests: sd-kit, sd-knowledge, ai-workflow, ai-mcp, ai-model
  and the full source suite passed; compatibility 57/57.
- Remaining: plan steps 1–6.

## Blockers and next action

- Next: worker builds plan steps 1–4, then the organiser reviews and shows the owner before
  step 6.
- On completion: record the merge, remove the index entry.
