# SD Brain: an art director that knows the toolbox, the box of parts and the palettes

Status: active; plan steps 1–4 built (worker session, 25 October 2026), awaiting the organiser's review and the owner's look before step 6
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
  SD-STYLES.md), `out/traitor/` (Traitor Axe analysis), `out/sd-native-check/`,
  `out/sd-kitbash-check/` (steps 1–4 proofs: contact sheets, looked-at palettes, sword and kitbash
  models, pictures, and the scripts that make them; `render.cjs` runs on a hidden desktop).
- Regenerating the box of parts needs the game at `D:/Warcraft III` and `D:/Codex/sd-research`
  (`node scripts/sd-knowledge/build-parts.mjs`).
- Regenerating the knowledge pack needs `D:/Codex/sd-research` and
  `D:/Codex/mdlxl-sd-rulebook-20261024/work/casc-texture-index.json`.

## Relevant owners

- `src/ai-sd-rules.js`: `AI_SD_ART_DIRECTOR` (the kitbash director), `AI_SD_BRAIN` (builder moves,
  palettes by looking), `SD_BRAIN_REVISION` (2026-10-25.7), `SD_BRAIN_AVAILABLE` (still false).
- `electron/ai-service.cjs` `artDirection()`: the director turn and its evidence block, now with the
  live BITZ box listing (`listParts`, wired in `electron/main.cjs` to the app's BitsAndParts folder).
- `src/sd-kitbash.js`: kitbash moves on the editor's own code (`pieces`, `select`, `take`, `fit` by size
  or by a shared joint, `replace`, `add` with attach or bone, `remove`, `reshape`, `repaint`, `setTint`,
  `anchor`, `adopt` + `BASE_SCOPE`, `pivot`, `bones`). Uses bits-and-parts (`collectPart`, `commitPart`
  replacement, `transformPart`, `partRgbSnapshot`, new `bindToSelection`), mesh-tools `detachFaces`,
  paste-format `adaptPasteFormat`.
- Box of parts: `src/sd-parts-data.js`, generated by `scripts/sd-knowledge/build-parts.mjs` from the
  research's `native-reviewed-parts.json` plus `scripts/sd-knowledge/named-parts.json`; every entry is
  found again in the installed game (`D:/Warcraft III`, `electron/casc.cjs`) or dropped. Lookups in
  `src/sd-knowledge.js`: `findParts`, `part`, `partsOf`, `findBases`, `weaponReferences`, `isWeaponRequest`.
- Texture area preview: `textureAreaLayout`/`decodeTextureArea` in `src/texture-thumbnail.js`, used by
  `mdlxl_assets { source: 'textures', action: 'preview', path, uv }` in `app/ai-assets.js`.
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
  regions, director evidence block.
- Steps 1–4 (25 October 2026):
  1. Director: unrestricted kitbash director (native first, mixing by default, owner's approach
     honoured, orc warlord example, craft from SD-STYLES.md, team colour never a weapon default).
     Brief lines: Goal, Approach, Base, Parts (keep/remove/take/reshape/new, from where, paint),
     Craft, Focal motif, Avoid, Checks. Weapons get weapon references instead of the item population.
  2. Box of parts: 79 game models, 739 parts (673 research parts, all 673 found again by loading the
     models with the same piece numbering; 66 more picked from 50 hero and unit models by bone and
     shape and confirmed by pictures of the isolated pieces in `out/sd-kitbash-check/sheets/`).
     Kinds: 98 weapons, 35 heads, 10 helmets, 7 shields, 82 horns and spikes, 50 armour, 19 hair.
     Examples: Frostmourne (undeadarthas g0 p15, arthaswithsword g3 p1), Thrall's head
     (thrallmountless g0 p1), Doomhammer, Gorehowl, the Captain's great helm and Lordaeron shield,
     Muradin's horns, Kel'Thuzad's horned skull headdress, Illidan's warglaive. 9 candidates were
     left out because the picture did not confirm them (listed in named-parts.json). BITZ: listed live.
  3. Palettes by looking: the builder must preview a sheet, pick the area by its pixels, preview the
     area again, and never use an area it has not looked at; findMaterials is only a starting point.
     The preview tool now takes any texture path and a uv area and draws a labelled uv grid.
  4. Builder moves in AI_SD_BRAIN with recipes in the sd-kitbash and sd-kit headers. Kit: smooth
     shading inside each piece (0% flat-shaded on slabs; `smooth: 0` keeps facets), `edged` blades
     (slab body + separate edge piece thinning to 0.25 sharp side by default, owner range 0.05–0.43),
     `pointedBlade` outlines and `serrate` saw points, `corners` check, layered `trim`,
     `builder({ frame })` + `commit({ attach | bone })` to build on a part and follow its bones. Fixed
     on the way: two native parts on one sheet used the first part's area.
- Proof pictures (hidden desktop, dev build): `out/sd-kitbash-check/pictures/sword-*.png` and
  `sword-side-by-side.png` (new brutal sword next to the Footman and Death Knight swords, same scale:
  470 triangles in 7 pieces, palette areas from 6 game sheets, each looked at in `looks/`);
  `kitbash-side-by-side.png`, `kitbash-heads.png`, `kitbash-*.png`, `grunt-*.png` (Grunt base with
  Thrall's head swapped in by the neck joint, the Footman's helmet reshaped and repainted from an
  InfernalCannon iron band, Muradin's horns; MDX 800, 105 KB, 771 triangles vs the Grunt's 688; in
  Attack the head travels 36.5 units while helmet and horns keep their distance to it exactly).
  Scripts: `sword.mjs`, `kitbash.mjs`, `sheet.mjs`, `look.mjs`, `render.cjs` in that folder.
- Tests: new `test/sd-kitbash.test.js`, `test/texture-area.test.js`; extended sd-kit, sd-knowledge,
  ai-workflow; `test/ai-editor.electron.cjs` preview check updated (not run: Electron test).

## Blockers and next action

- Next: the organiser reviews steps 1–4 and shows the owner the pictures; step 5 (checks in the
  review) is partly in AI_SD_BRAIN (side-by-side capture, weapon references); step 6 waits for go.
- Test build for step 6: `D:/Claude/MDLxL-TestBuilds/SD-Brain-Kitbash` (commit 5405ce1b, SD Brain
  available, flip not committed; fresh profile, so the owner signs in to the provider again). The
  owner's BITZ box was copied in from his working install
  `D:/MDLxLVisButton/MDLxL-win32-x64-0.20.0/BitsAndParts` (28 parts: 8 helmets, 12 weapons of
  152–574 triangles, 5 shields, 3 others; all parse as MDX 800). Smoke test: the packaged build
  opened the kitbash model hidden and rendered it with game textures. `SD-Brain-Knowledge` is unchanged.
- Not done or not verified: no real AI prompt run of the new director or builder (step 6); the
  texture preview tool and the BITZ listing have not been called through the AI inside the app (their
  code is tested in node); translations of the AI guide's SD Brain section are English only (SD Brain
  is parked).
- On completion: record the merge, remove the index entry.
