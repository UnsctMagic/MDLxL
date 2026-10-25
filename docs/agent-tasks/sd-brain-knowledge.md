# SD Brain uses the SD research volume

Status: ready for review; awaiting merge approval
Owner / consolidator: Claude Code
Updated: 25 October 2026

## Goal and completion criteria

- Build the useful, directly reviewed findings of the SD research volume (PR #302,
  branch `codex/sd-research`, study at `D:/Codex/sd-research/study`) into the
  existing SD Brain: the art director, the builder and its review. Owner authorization
  came through Codex on 25 October 2026 after the study-only phase.
- Scope: SD artwork (including SD in MDX 1800). No HD/Reforged work, no beginner
  guidance layer yet (the owner shapes the system after this), no promotion of
  pending labels, candidates or approximate matches to rules.
- SD Brain stays parked in shipped source (`SD_BRAIN_AVAILABLE = false`); a separate
  test build has it on.

## Revision and local state

- Branch: `claude/sd-brain-knowledge` from `main` 2d6ca1e8, draft PR https://github.com/UnsctMagic/MDLxL/pull/303.
  Test build (SD Brain on, not committed): `D:/Claude/MDLxL-TestBuilds/SD-Brain-Knowledge`. Research PR #302 and the
  rejected #299 are untouched.
- Regenerating the pack needs the research folder `D:/Codex/sd-research` (study data
  and `data/uv-library.sqlite`) and Codex's texture index
  `D:/Codex/mdlxl-sd-rulebook-20261024/work/casc-texture-index.json`.

## Relevant owners

- `src/sd-knowledge-data.js`: generated pack, never edited by hand. Rebuild with
  `node scripts/sd-knowledge/build-pack.mjs [--research <dir>] [--textures <index>]`.
- `src/sd-knowledge.js`: lookups (`findMaterials`, `sheetInfo`, `findFamilies`,
  `categoryNorms`, `checkAgainstNorms`, `findFactions`, `findPainting`,
  `findChapters`/`chapter`, `guessCategory`) and `briefEvidence`, the art director's
  evidence block. Word lists `SYNONYMS`, `FAMILY_ALIASES`, `CATEGORY_WORDS` and
  `FACTION_WORDS` decide what a casual request retrieves.
- `src/sd-kit.js`: `native` part option and `commitNative`, which fits each UV island
  into a game texture region (turned to the region's long side, aspect kept) with
  optional geoset tint and the existing Team Color material preset.
- `src/ai-sd-rules.js`: `AI_SD_ART_DIRECTOR` craft notes and brief format (new Paint
  line), `AI_SD_BRAIN` builder/review instructions, revision `2026-10-25.6`.
- `electron/ai-service.cjs` `artDirection()`: appends `briefEvidence` to the director's prompt.
- `src/ai-capabilities.js`: lists `sd-knowledge` beside `sd-kit` only when SD Brain is available.

## Findings and decisions

- Verified: the pack holds 2,130 texture regions with reviewed labels (1,685 from the
  owner's 26 models, 433 Blizzard, 12 other LowPolyWorks), 205 owner sheets with
  observed contents, 217 construction families (directly annotated members only),
  27 category populations, 20 faction profiles, 42 custom-paint observations and 67
  study chapters without pictures or local links (about 1.5 MB, a lazy chunk).
- Decision: a region's `uv` is the largest rectangle fully inside the real UV triangle
  union (128-cell grid, tiled UVs folded by texture flags), so a new part never samples
  outside the painted island. 266 reviewed regions too thin for that grid and 206 on
  custom (non-game) paint are left out.
- Decision: region tags describe the rendered part; `tint` (geoset RGB) and `team`
  (team-colour layer under alpha paint) travel with the region because the research
  showed colour often comes from them (Nurgle skulls, Khorne crossguard).
- Decision: geometry is still built fresh; only native paint is reused, as the owner
  does. Corpse, decay and portrait-backdrop regions rank low unless asked for.
- Uncertain: retrieval is word based; `FAMILY_ALIASES` and the synonym lists will need
  more entries as real prompts show gaps (for example "chalice" has no family).

## Changes and verification

- Checks: `node --test test/sd-kit.test.js test/sd-knowledge.test.js test/ai-workflow.test.js
  test/ai-mcp.test.js test/ai-model.test.js` passed; full `test/*.test.js` passed apart
  from particle-library/optimizexl-validation runs that overlapped a `dist/` rebuild and
  passed on rerun (17/17). `pnpm run build` passed.
- Render check: an axe built through `findMaterials` + `native` parts opened in the
  dev build on a hidden desktop shows Infernal Cannon iron and campaign wood from the
  installed game (`out/sd-native-check`, local only).
- Remaining: no real-provider prompt trials were run (they spend the owner's AI
  credits); the owner tests by hand in the test build. Warcraft III gameplay not tested.

## Blockers and next action

- None. Next: owner tries casual prompts in the test build; extend the word lists and
  the pack (new research volumes) from what fails.
- On completion: record the merge, remove the index entry.
