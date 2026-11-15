# FX editor: own looks, better presets, tidy library

Status: waiting (12 November 2026: paused by the owner; a fresh session continues from fx-owner-test-02.md)
Owner / consolidator: Claude session `local_20b92164-62e5-47a5-a1a9-0e6c651008e9` (brain) with subagents (study, coding)
Updated: 11 November 2026

## Goal and completion criteria

Owner request, 11 November 2026 (their words, condensed):

1. Study the owner's reference models (kept outside Git, see local fixtures). Learn how
   their effects are made, add those effects as new looks, and lift the existing looks to
   that quality. Nothing existing is removed; improve and add. The PR, commits and docs
   never name the reference models or their authors.
2. Presets stop deciding everything. They become nice ready-made sets; the user can also
   use FX as an editor: create, modify and save their own looks. Target: every reference
   effect can be built in FX without relying on a preset. Experience like EMTR/CORP and
   today's FX: "I click, I see, if I like I commit or I keep editing."
3. Listed preset fixes:
   - Flaming sword, Frost blade, Fel blade: start with the emitter on. Fel blade: remove Fel edge.
   - Lightning blade: Forked arcs on, Blade arcs off.
   - Arcane blade, Rift seam: boring; improve.
   - Rune blade: layout adjustable inside FX (no trip to the UV editor). Only Pulse and
     Steady are used; replace the other rhythms with better options (colour gradients etc.).
   - Thorn script: fold into Rune blade as a variation that keeps its glow.
   - Tidal blade: add a water-dripping emitter. Water skin becomes a Tidal variation.
   - Ice skin: becomes the default Frost blade skin with the Frost blade emitter, offered
     as another option of the blade.
   - Glowing skin: starts at maximum intensity.
   - Poison skin, Revenant waves, Fissures and similar: the user controls which texture
     and which part of it shows in the final result.
   - Library: blade/skin names are pointless (a blade look works on skin and the reverse).
     Reorganise and rename so it makes sense.

Done when: the owner can hand-test a build in `D:\Claude\MDLxL\TestBuilds\fx-editor`.
Nothing goes online until the owner says "merge".

## Revision and local state

- Branch / checkout: `claude/fx-editor` in `D:\Claude\MDLxL\.claude\worktrees\fx-editor`
- Base: `171b8bb9` (main, 11 November 2026)
- Uncommitted changes: see `git status`
- Local fixtures: reference models unpacked to `D:\Claude\MDLxL-TestModels\fx-reference`
  (19 folders, 49 models). Study output goes beside them, not into Git, when it names them.
- Watchdog: scheduled task `fx-editor-auto-resume` (every 30 min) messages the session to
  continue when it is idle and this note's status is still `active`. Delete the task when
  the status changes to `ready to test`.

## Relevant owners

- [FX contract](../FX-GLOBAL-ANIMATIONS.md) (required), [map row](../agent-map.md), earlier
  [handover](native-surface-effects.md).
- `app/SurfaceEffects.jsx`, `app/GlobalAnimationControls.jsx`, `app/global-animation-library.js`,
  `src/global-animation-looks.js`, `src/fx-sort-looks.js`, `src/claude-fx-looks.js`,
  `src/global-animation-model.js`, `src/global-animation-data.js`.

## Findings and decisions

- Decision: the owner's 11 November request overrides the contract's "five layer types, no
  new types without asking" only where the study shows a reference effect cannot be built
  otherwise; record each such case here.
- Decision: saved stacks from earlier versions keep opening and editing unchanged.
- Avoid repeating: no randomiser/Remix buttons (owner rejected 5 November).

- Decision (owner, 11 November): the orchestrating session plans and reviews; cheaper
  subagents (Sonnet/Opus) do the coding and the study.
- Verified: a stack already stores its own layer list; the preset only supplies the
  starting layers. What blocks editing is that controls are gated by preset-only flags
  (`nativeSurface`, `fixed`, `atlasRect`, `powerArcs`, hidden `filter`/`axis`/`band`,
  Speed limited to 1–4) and that `findLook(stack.look)` must resolve to a built-in look.

## Work packages (run one coder at a time in this worktree)

| # | Package | State |
| --- | --- | --- |
| S | Study of the reference models → `out/fx-study/TECHNIQUES.md` (no model names; untracked, 21 techniques, 15 quality rules, 39 editor knobs, gap list) and a full private report in `D:\Claude\MDLxL-TestModels\fx-reference\_study\STUDY.md` | done |
| A | Listed preset fixes, look variations (`look.variations`, `stack.variation`, `withVariation`), emitters that start on (`starts:true`), library filed by element through one `LIBRARY` table | done, `e81e50c9`; 159 source tests pass, build ok; electron tests edited, not run |
| B1 | Surface layers editable whatever the preset: Blend, Lit by map light, own Loop length per layer, Speed 0–8 / Direction / Tiling on native cards too, texture area view on every surface (area of an atlas editable), rune Repeat/Size/Turn/Slide/Across, new rhythms (Soft pulse, Colour beat, Uneven beat, Colour shift) with a Second colour, Lift. Old layers without the new fields must compile byte-identical | running (Opus) |
| C | Own looks: "Save as…/Load from…" (reuse `PresetNameRow`, `sanitizePresetName`, the preset file dialogs), folder "My looks", stored in a new preferences key, sizes rescaled to the new part, an "Empty" start in Build your own, `findLook` fallback so a model carrying an unknown own look still opens | after B1 (needs B1's field list) |
| B2 | Emitter depth inside FX with EMTR's own components (spread, variation, blend, stay with part, head/tail, atlas frames); new layer types Card (camera-facing or flat sprite with size pulse / spin / jitter / flipbook) and Light; Edge on an orbit | after C |
| D | New looks from the study (aura cards, glow shell, lit crystal, crack/rune colour beat, crossing energy, flame cards, star flare, lightning cage, lingering embers, glow orb, eye glints, dark smoke underlay, orbit ribbons, ground decal, liquid body, vortex); quality pass on existing looks per study 4b (own clocks, shallow pulses, unshaded, embers, flame, ribbons, water two speeds); Arcane and Rift seam redesigned; only native textures | after B2 |
| V | Build, targeted source + hidden packaged FX tests, by-eye captures, test build in `D:\Claude\MDLxL\TestBuilds\fx-editor`, contract doc update, delete the watchdog task | last |

B1 landed as `1ebd4e99`…`2be2c7bf` (12 commits). New layer fields: `filter` (UI), `unshaded`,
`unfogged`, `twoSided`, `loop`, `fixed:false`, `speed` 0–8, `atlasRect`/`uvMatrix` on native
cards, `repeats`, `glyphScale`, `glyphTurn`, `glyphSlide`, `glyphAcross`, rhythms `soft`,
`beat`, `embers`, `shift`, `tint2`, `inflate`. `test/fx-legacy-snapshot.test.js` freezes 322
old stacks and their compiled hashes; it must stay green and its fixture untouched.
`test/fx-layer-controls.electron.cjs` is written, not run. C is running (Sonnet).

C landed as `12eac16a` and `464cb597`: `lookOf(stack)` stand-in for unknown looks, `Empty`
look, preference key `fxLooks` (normaliser in `src/fx-own-looks.js`, sizing shared through
`src/fx-layer-basis.js`), `app/FxLookBar.jsx` (Save as… / Load from… with `PresetNameRow`),
`My looks` folder. `test/fx-own-looks.electron.cjs` written, not run.

V1 done (`03cd4f26`, `a32cf541`, `05b3f3df`): all 18 FX packaged tests pass hidden on the
package from `05b3f3df` (five tests had stale expectations: Fire's started flames, the Empty
look, the retired Ice look, clock renumbering). One app defect fixed: Move area past the
picture's edge did nothing. Captures and their index: `out\fx-review\INDEX.md`. First
hand-test build: `D:\Claude\MDLxL\TestBuilds\fx-editor` (clean profile, never opened).

Hidden packaged run (PowerShell, from the worktree; never run anything else from `out\` at
the same time, the runner's cleanup kills it):
`$env:TEMP="$PWD\out\tmp"; $env:TMP=$env:TEMP; $env:MDLXL_REAL_PLAYWRIGHT='D:\Claude\tools\node_modules\playwright-core'; $env:MDLXL_SUITE_PKG="$PWD\out\pkg-fx-editor\MDLxL-win32-x64"; node scripts/run-packaged-tests.mjs default <test,test>`

By-eye review of V1's captures (orchestrator): looks and controls work; to fix in B2 step 0:
area view picture too small to grab, rune view wires hide the glyphs, Rhythm shows the
card's own name instead of `Built-in`, "saved." status sticks after switching look, emitter
life table cramped. Left as is: Glow intensity to 400% (owner asked for maximum), overlay
default differs per Frost variation (by design). For D: Dripping water barely visible.

B2 done (`e1f94d47`…`a66746ef`, 7 commits):
- Review fixes: area view fits the picture, faint rune wires, `Built-in` rhythm label, look
  status clears on look/part change, life table fits.
- **Card** layer (`src/fx-cards.js`, `cardSpec(label,image,fields)`): one geoset per Card
  layer holding its quads, one owned bone per card (+ optional jitter child), one material,
  flipbook as a texture animation. Fields: `facing` camera/ground/part, `size`, `offset`,
  `count` 1–8, `sizeMin`/`sizeMax` (.83/1.17), `spin`, `spinEased`, `jitter`, `rows`,
  `columns`, `frameMs`, `cell`, `loop`, `pulse`, `filter` 3, unshaded/unfogged/twoSided.
  Card k pulses on base × [1, 1.133, 1.2, 1.3, 1.433, 1.567, 1.7, 1.833]. Contract doc has
  the dated paragraph (sixth layer type, creates a geoset, on the owner's 11 November request).
- Emitter depth under More with EMTR's own controls; keys in `layer.native`: `Latitude`,
  `Variation`, `FilterMode`, `Flags` (524288 carry), `FrameFlags`, `TailLength`, `Rows`,
  `Columns`, `LifeSpanUVAnim`, `DecayUVAnim`, `TailUVAnim`, `TailDecayUVAnim`, `Squirt`.
  `readAnimationStack` picks EMTR edits back up (`emitterDepthDefaults`).
- Edge `orbit`, `orbitRadius`, `orbitTurns`: three owned helpers on non-dividing clocks.
- Removing a stack with a Card or orbit restores the model exactly (bounds too); legacy
  stacks still go through the old path so they stay byte-identical.
- **Light: not added.** The preview renderer reads `Lights` but never draws them (one global
  light in its shaders); showing one means editing the imported library. Owner decides.
- Checks: FX source group 228/228; packaged hidden: fx-cards, fx-own-looks,
  fx-layer-editing, surface-effects, fx-empty-emitters, fx-layer-controls pass.
- Orchestrator's by-eye review of captures 40–51: Card, area view and faint wires fine; the
  emitter More rows scroll the column sideways and the default orbit ribbon is hardly
  visible (both are D step 0).

**Paused by the owner while D was running.** D's coder was stopped mid-way. Committed by it:
`bfe6569d` (step 0: emitter More fits the column, visible default orbit) and `e44695c8`
(quality pass + new looks). Left uncommitted in the worktree, unreviewed: edits to
`docs/FX-GLOBAL-ANIMATIONS.md` and `docs/agent-map.md`. NOT done or not confirmed: D's
source and packaged test runs, its captures and per-look verdicts (it was writing the
capture script), the refreshed test build (TestBuilds\fx-editor is still the V1 build from
`05b3f3df`). On resume: check `git diff`, run the FX source group, then continue D from
step 3 (tests), step 4 (captures and by-eye review), step 5 (docs, test build).

**12 November: owner hand-tested a build of `e44695c8`** (another session built
`TestBuilds\fx-editor-new` from the untested HEAD and opened it). Owner's findings, their
words: editing emitters crashes; "Pressing flame cards crashes the editor"; Lit crystal and
Lightning cage crash; "flaming blade now has a flashing fire instead of a constant fire...
I hate FLASHING FUCKING THINGS"; Falling mist not seen on a Footman but seen on a large
sword; asks whether FX recognises the shape of the selected part; "make sure I can test
without crashing every 2 seconds".
Rules taken from this (also in the contract doc once D lands them):
- No build of this branch reaches the owner before a click sweep of every look, variation,
  layer row, More, offered layer and Add entry has passed on that exact package
  (`test/fx-click-sweep.electron.cjs`).
- No flashing or strobing in any preset. Emitters of looks that existed before `e44695c8`
  return to what they were unless measured at least as steady. Flashing is measured
  (brightness over 24+ loop phases, baseline = the `05b3f3df` build), not judged by feel.
- Next build goes to `TestBuilds\fx-editor-02` with `test-models\TEST FX EDITOR 02.mdx`.
D's coder was resumed with these as the first steps, then its remaining steps 3 to 5.

D's original brief was: step 0 fixes, quality pass on existing looks, Arcane / Rift seam / Water
drip, new looks in priority order, general look tests, captures 60+ with a verdict per look,
contract doc + map row, final package mirrored into `D:\Claude\MDLxL\TestBuilds\fx-editor`
(keeping its profile). After D: orchestrator reviews the captures, commits this note, adds
the README row, sets status `ready to test`, deletes the watchdog task.

### Design decisions for B2 and D (orchestrator, 11 November)

- New layer type **Card**: one quad on an owned bone, placed and sized with the EMTR
  handles like an emitter. Facing: camera (billboarded), flat on the ground, or fixed to the
  part. One Add layer, unshaded. Motion on its own clocks: size pulse (min/max), spin
  (turns per loop, eased), jitter (fast random turns), atlas flipbook (rows, columns, frame
  ms). Count N along the part, each card on a different non-dividing clock
  (1000/1133/1200/1300 ms). B1's Rhythm/Second colour/Blend apply. Covers study 1.1, 1.6,
  1.7, 1.8, 1.16.
- **Light** is not added unless the FX preview can show it (a control must be visible:
  "I click, I see"). B2 checks the renderer; if it cannot, ask the owner.
- Edge gets an **Orbit** option (ribbon on a 2–3 helper chain with non-dividing clocks,
  study 1.14). Particles get the remaining EMTR fields under More through EMTR's own
  components (spread, variation, blend, stay with part, head/tail, atlas frames). Edits made
  in EMTR must come back into `layer.native` when the stack is read, so Save as… keeps them.
- D changes presets only through explicit spec fields, never the per-kind tables in
  `makeLayer`/compile, so old stacks stay byte-identical.
- D look list (native textures only; names say what the effect is): upgrades per study 4b
  (own clocks per layer, `soft`/`beat` instead of deep pulses, embers few/slow/long, flame
  Time .5 and alpha 255>255>0, ribbons Add with static alpha, water highlight on a shorter
  clock, glow overlays lifted ~.3). Redesign Arcane (crossing energy layers on two clocks,
  colour beat violet↔blue, spinning star card, sparse glow orbs) and Rift seam (dark
  underlay, crack with uneven colour beat, jittering zap cards, inward splinters). New:
  Burning cracks, Fire column, Flame cards in Fire/Fel fire, Glow shell, Star flare, Glow
  orb, Eye glow, Lit crystal (+ team-colour core variation), Energy flow, Lightning cage,
  Dark smoke, Hollow shell, Ghost trails, Soul vortex, Liquid body, Ground glow, Rune
  circle, Tint. Weapon swing ribbons stay out (attack-only, not a global loop).

Library filing chosen for package A (id → name): see the table in the package A commit
(`LIBRARY` in `src/global-animation-looks.js`). Retired from the list but still opened
from saved models: `ice-skin`, `water-skin`, `sort-thorn` (now variations of Frost,
Water and Runes).

## Changes and verification

- Changed: nothing merged into the note yet; see `git log` on the branch.
- Checks: none yet.

## Blockers and next action

- Next: read the reports of S and A when they arrive; review A's diff; start C; write
  the B and D work orders from the study's editor-requirements and gap lists.

## Handover, 12 November 2026 (orchestrator paused by the owner)

- The owner said a new agent is working on FX. This session stopped its coder and does
  nothing further. Continue from [fx-owner-test-02.md](fx-owner-test-02.md).
- Committed by the stopped coder after `e44695c8` (local only): `674919b9` click sweep test,
  `40dbfaf3` Card crash on empty sequence bounds, `3efb9344` nothing flashes / old emitters
  back / sizes from the main region, `19536a1a` preview that cannot be built no longer blanks
  the window, `0d81155a` docs, `409ee992` and `e12abb50` test expectations.
- NOT confirmed by the orchestrator: the coder was stopped while waiting on packaged reruns
  and never reported. Its test results, flashing table (`out\fx-review\steadiness.md`) and
  per-look verdicts were not reviewed; the captures 60+ were not looked at by the
  orchestrator. Treat the checks as unverified until rerun.
- `TestBuilds\fx-editor-02` exists and was open with `TEST FX EDITOR 02.mdx` when this was
  written; this session did not open it and did not touch it.
- `out\` holds the coder's scratch scripts, logs, `pkg-baseline`, `pkg-next`, `suite`, `tmp`
  and test profiles. Left in place because the new session may be using the folder; they are
  disposable once it is done (keep `pkg-fx-editor`, `fx-review`, `fx-study`).
- Watchdog `fx-editor-auto-resume` is disabled (found disabled; left so).
- This note is untracked, like `fx-owner-test-02.md`; commit both with the next change.
- Open with the owner: Light layer not added (preview cannot show it); Card accepted in
  practice (owner tested Cards, no objection to the type).
