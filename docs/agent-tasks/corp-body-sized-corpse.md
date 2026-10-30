# CORP: a body-sized corpse on the POSE body parts

Status: handed to Codex (owner, 30 Oct 2026). Unfinished; owner rejected the current result.
Owner: Codex (from Claude Code session `local_afb1755f-542b-4e0a-aac5-87414a9b03f4`)
Updated: 2026-10-30
Branch: `claude/corp-long-bones` (from `claude/release-0.36.1` at `6049624e`); PR into `claude/release-0.36.1`, not `main`. Release 0.37.0 waits for this.

## Goal (owner's words, condensed)

Press CORP: the corpse is made from the **last Death frame**, using **POSE** to know
the body parts, and is **sized like Blizzard's corpses relative to the body**. The
white chalk outline matches the dead body exactly, so the corpse should fill it the
way a Blizzard corpse fills its body. Current corpses are far too small for the outline
on nearly every model ("tiny corpses"). Skull must sit on the head, bones on the limbs.
Easy to adjust; parts easy to add and delete (existing Corpse Editor, unchanged).

## Already right — keep (merged in claude/release-0.36.1)

- No copied body: the body itself holds the last Death pose and sinks in Decay Flesh (PR #451).
- Decay Bone: corpse lies still and fades out over the last 1667 ms; skull is the native
  evenly scaled mesh (0.72 wide, 0.42 tall, 0.22 above ground) (PR #453).
- Flail on its own skeleton never becomes a skull; Delete / Ctrl+Z / Escape work in the window.

## Uncommitted-then-committed WIP on this branch (`src/corpse-geometry.js`)

- Arms get no long bone, only the hand (Blizzard: 59% of 386 arms on 206 SD units have
  no long bone; 23% have one, the upper arm). Legs keep 2 bones each, reach 1.34× the
  joints (`NATIVE.legReach`, Blizzard median; CORP had 1.6×).
- A new pass `fitToPart` + `keepInside` before `plan`: each piece stays on POSE's joint
  line, takes its width from skin near that line, the skull from all head skin; then any
  piece crossing the outline is **shrunk** until it fits. The chalk outline is now
  computed before the pieces (same code, moved up).
- Branch loop skips nodes off the body skeleton and POSE role `'Object'` (agreed with the
  POSE head-fix session `local_f650339f…`, which changes only `src/pose-ik.js`).
- Bug fixed: skull end was computed from its already-moved start.
- Tests: `test/auto-corpse.test.js` 22/22 pass (new: arms only hands, two bones per leg,
  on SD Footman + owner flail; headless-body test now uses legs).

## Why it fails (diagnosis)

1. Pieces only ever **shrink** (keepInside); nothing grows a piece to fill its part.
2. Widths come from skin right along the bone line, capped at 40% of length → thin strips.
3. The one number the owner asked for was never measured or matched: **Blizzard corpse
   size vs body size** (corpse area / body outline area, and how far it reaches across it).

## Next action

1. On the 206 SD units with Decay Bone (`out/corpus-sd` in the release worktree), measure
   native corpse footprint area ÷ dead-body outline area, and coverage of the outline
   (per part if possible). Same for CORP. Report the per-unit ratio table.
2. Size CORP so its ratio matches Blizzard's distribution (scale pieces up to fill their
   part, not only down), keeping pieces on POSE parts and inside the outline.
3. Owner judges by screenshots: rerun the 20-model capture, send pages, get pass/fail.

## Evidence and tools (outside the repo)

`D:\Claude\MDLxL-TestBuilds\corp-handover\`
- `screenshots/corpse-page-1..5.png` — the 20 models the owner rejected (left: corpse +
  outline, right: with body). Krell: corpse beside body; Jaina/Krell corpse grey (gutz
  texture not loading in that preview — unexplained).
- `maps/*.png` — top views: body, POSE joints, outline, pieces, native corpse (cyan).
- `tools/` — measurement scripts. They import `src/` by absolute path of the Claude
  worktree `D:\Claude\MDLxL\.claude\worktrees\corp-reuse-body-067486\src\`; change `R=`.
  `map-dump.mjs <srcDir> <model> <out.json>` + `map-draw.py <json> <png> <title>`;
  `corpse-window-shot.electron.cjs` (copy into `test/`, run via
  `node scripts/run-packaged-tests.mjs default corpse-window-shot` with
  `MDLXL_SHOT_OUT`, `MDLXL_SHOT_FIXTURES` = `;`-separated **Windows** paths, see
  `shot-list.txt`; it waits 4 s so textures and Show body load).
- Model list: owner's Desktop/Downloads (Fx_v4_clipfix_1, Nurgle Heavy/Flail08/Champion,
  Krell, Lahmian (2), Demonette3, Necromancer, Jaina) + LowPolyWorks local copy
  `D:\Claude\LowPolyWorks-eyes-pages\models` (Empire_Captain, Greenskin_Orc1, Minotaur,
  skink_chief_hero, Bretonnian_Swordsman, Aspiring15, Oldblood_hero, ratling_hero,
  Dark_Elf_Witch_Unit_opt, gor_flail_NOglow, KnightKhorneFlailHero01 — mounted, errored once).

Rules: `docs/TESTING-RULES.md` (real-use tests, fail first on old code). Never
`pnpm run/test/install` through the linked node_modules; use `npx vite build`,
`node scripts/package.mjs --out out/pkg --overwrite`, `node --test test/<file>`.
