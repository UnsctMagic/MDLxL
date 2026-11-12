# FX editor: owner's hand test 2 (12 Nov 2026)

Status: active, paused; issue 5 (emitters) and the test build remain
Branch / checkout: `claude/fx-editor` in `D:\Claude\MDLxL\.claude\worktrees\fx-editor`
Tested build: `D:\Claude\MDLxL\TestBuilds\fx-editor-02\MDLxL.exe` with `TestBuilds\test-models\TEST FX EDITOR 02.mdx` (a Footman)
Background: [fx-editor.md](fx-editor.md) (the original FX editor request and what was built)

## The owner's words

> Falling mist does not work on the footman body but it does on a sword? on a body it just flashes. on sword it looks beautiful.
>
> remove ground glow
>
> Glow shell - add thickness...
>
> fly swarm - doesnt look good - check my great unclean one and zombie dragon, make it scaleable.
>
> EMITTERS - Ok, please do a re-run on emitters like you did on all FX - i mean emitters within FX. needs to be better - they are good but some are very bad, im lacking options and names are not descriptive.
>
> Also the whole thing LAGS a lot!!

## The issues

1. **Falling mist on a body.** On the Footman's sword it looks right. On the Footman's body it only flashes.
2. **Ground glow.** Remove it.
3. **Glow shell.** The owner wants a thickness control.
4. **Fly swarm.** It doesn't look good. The owner's own flies are the reference: the Great Unclean One and the Zombie Dragon. It must be scalable.
   - Great Unclean One: `D:\Claude\MDLxL-TestModels\pose-complex-fixtures\WH_DOC_GreatUCO4.mdx`; more versions in `C:\Users\PC\Desktop\WIP\WH_DOC_GreatUCO*.mdx` and `C:\Users\PC\Desktop\WH_DOC_GreatUCO1C.mdx`
   - Zombie Dragon: `D:\Claude\MDLxL-TestModels\glow-up\WH_VC_ZombieDragonVCarstein02.mdx`, `pose-heads\WH_VC_ZombieDragonVCarsteinHero01.mdx`, and `C:\Users\PC\Desktop\WH_VC_ZombieDragon04.mdx`
   - The Desktop files are the owner's; read them, never change them.
5. **Emitters inside FX.** The owner wants the same pass the FX looks got, now for the emitters FX offers. Some are good, some are very bad. Options are missing, and the names don't say what each emitter is.
6. **Lag.** The whole FX editor lags a lot.

7. **Moving skin speed** (owner, later the same day): "Moving skin speed is 1 or 0, theres no nuance - i cant make skin move slow but still move".

## Status (12 November 2026, paused 08:00 Europe/Amsterdam on the owner's instruction)

Orchestrated by Claude session with Opus coders, one at a time in this worktree. Local only.
None of it has been hand-tested by the owner; no test build `fx-editor-03` exists yet.

| # | Issue | State | Commits |
| --- | --- | --- | --- |
| 1 | Falling mist on a body | Fixed in code. Cause: 27 skin regions x 5 emitters = 135 emitters, one puff per 6 s each. A part with more than four regions now gets count x 4 sites spread by region length; parts with four or fewer are unchanged. By-eye check on the body still open. | `67561c20` |
| 2 | Ground glow | Removed from the library; saved models still open (retired list). | `eda5cc66` |
| 3 | Glow shell thickness | Thickness slider under Intensity (`inflate`, 0 to a tenth of the part's length). Updates on release. | `f0814396` |
| 4 | Fly swarm | Rebuilt as geometry in the native Flies.mdx technique: one quad per fly on its own billboarded bone, sets of five on distinct clocks. Amount 5-30, Fly size, Swarm size, Speed, colour, Position & size handles. Old saved fly layers keep their emitter flies. Default picture is the native Abomination fly area; fly size 8.5 % of mesh height (6-22). By eye in the FX preview: small separate flies in proportion; no fair side-by-side with the reference yet; handle drag on a swarm checked only by the packaged Resize/Move test. | `1164ba9e` … `77b77c7a` |
| 5 | Emitters inside FX | **Half done.** Audit of all 38 emitters (7 good, 17 weak, 14 bad): `out\fx-review\emitters\FINDINGS.md` (untracked, with captures). Done for new layers only (old stacks byte-identical): native emitters share their rate over four sites (`sharedSites`), ground/flat ones compile once; flames have their own fire tint; identical-but-for-name emitters listed once (38 → 36); drops use DRIP; Stars steady; Rune sparks additive; small emitters and embers larger; mist and motes steady (`steadyRate`), mist puff capped at 0.35 x unit height; Plague haze additive. **Known open bugs:** Eye sparks, Heavy/Ichor drops and Blood beads are still invisible on the body (cause not found); the four-site share also lowered emitters that were graded good on the sword (Fire column 216 → 96 in flight on the sword and 648 → 96 on the body): review the share rule so parts that looked right keep their density; Inward souls and Rune rings are much weaker as one emitter (brightness came from 27 stacked copies); the mist/motes/haze changes (G) have source tests only, never looked at. **Not done:** renames and merged names (FINDINGS table, five catalogues), options under More (Size for native kinds, area Width/Length, middle Time, Priority plane, Unfogged). **Owner decisions:** Blade crackle (bursts break the no-flashing rule: remove or make steady), Rising embers (rename or ember recipe), drop the rate wobble on all built-in kinds, which emitters to add or re-file. | `a8ba4cea` … `39632a18` |
| 6 | Lag | Cause: every compile resampled the whole skeleton per skin region. The window now reuses the samples per model revision; output byte-identical. Footman body Fire pick 475 → 154 ms, dense model 2154 → 397 ms. Left alone: full preview rebuild per change (~130 ms on the Footman, shared `GamePreview.jsx`). | `e58348b1`, `c3122229` |
| 7 | Moving skin speed | Speed 0-8 in steps of 0.05; a fractional speed runs whole passes on a longer owned clock; reopens as saved. | `eca70805` |

Checks at `39632a18` (coder's report): FX source group 290 pass. Hidden packaged on
`out\pkg-fx-editor`: fx-click-sweep, fx-responsiveness, fx-empty-emitters pass; fx-cards and
global-animations last passed at `77b77c7a`. Full suite not run. The orchestrator has not
reviewed the emitter commits' diffs yet.

Coordination (release chat = session "MDLxL release handoff management"): do not push or
merge FX. Merge order on main: #633, `codex/main-review-20261111-all`, Bone Namer #631,
`claude/handle-hover-names`, then FX. When FX is done and checked, send that session the
branch, revision, changes and exact checks. When merging main into this branch after the
review fixes land, drop the old `_FxStack.createdClockIds` remap line in `compileAnimation`
(`test/fx-stale-references.test.js` catches a double shift). Tests reading private models
must skip when the file is missing.

Waiting for this branch, outside the owner's notes (from the main review, Part B of
`docs/agent-tasks/review-1-fx-references.md` on the fix branch), not started: double-click
outside "Selected geosets (n)" must switch to that part alone; a previewed emitter or
changed group choice must count as unapplied work; Fit selection and Highlight geoset must
cover all members in group mode.

Owner decisions, 12 November 2026 (after the pause):
- Blade crackle: "this one is fine actually the way it is". Leave it unchanged.
- Rising embers: real ember values (LavaLump embers, few, slow, long-lived).
- Rate wobble: steady everywhere for new emitter layers (saved layers unchanged).
- Add emitters: Falling snow, Maple leaves, Falling feathers, Ash flecks, Coal sparks, Hot
  filings, Fire hair. Not Ground dust.
- Flies on Death: "offer both": a switch to rise away on Death like the native flies.
- Shared sites: only many-piece bodies (more than four skin regions) share; parts with four or
  fewer keep their old density.
- Inward souls and Rune rings: raise the single emitter to about the old strength.
- Fly picture: keep the Abomination fly as default.

Open for the owner: fly look by eye (colour, size) on their own models; whether flies should
rise away on Death like the native ones (left out); whether the remaining preview-rebuild
cost is worth a change to shared preview code.

Private study of the reference flies: `D:\Claude\fx-fly-study\` (never name the reference
models or their author in the repository).

## Work order for Codex: emitter round 2

Owner, 12 November 2026: Codex does this round, Claude reviews it.

**Setup**
- Base: the commit of `claude/fx-editor` that adds this work order (the revision in the owner's prompt).
- Work in your own worktree `D:\Codex\fx-emitters` on a new branch `codex/fx-emitters` from that revision.
- Do not check out `claude/fx-editor` itself; Claude's worktree has it.
- Link `node_modules` with a junction. Remove the junction as a link before any cleanup.
- Local commits only: no push, no PR. Report "saved on your PC, not online".

**Read first**
- `AGENTS.md`, `docs/FX-GLOBAL-ANIMATIONS.md`, `docs/TESTING-RULES.md` and this note. The owner decisions above are binding.
- The audit `out\fx-review\emitters\FINDINGS.md` in Claude's worktree, read only. Its capture scripts and results are beside it; copy what you need into your own `out\`.
- Previous round: commits `a8ba4cea`..`39632a18`. Its flags are `sharedSites`, `steadyRate` and `fromWhite`.

**Rules**
- Nothing flashes. Native game textures only. No flavour text. Use EMTR's own controls.
- Every new UI string goes into all five catalogues in `src/locales/`.
- Saved stacks compile byte-identically: `test/fx-legacy-snapshot.test.js` stays green and its fixture untouched. Put changes on new layers, through flags that `makeLayer` sets.
- Tests that read private models skip when the file is missing.
- Each new test must fail on the old code: run it against the old code to show this.
- One item, one commit, with the tests green.

**Items, in order**
1. **Shared-site rule.** The native `sharedSites` share applies only to parts with more than four skin regions, matching `emissionShares` for built-in kinds. Parts with four or fewer keep the old per-region density. Ground and flat specs still compile once.
2. **Invisible on the body.** Eye sparks, Heavy/Ichor drops and Blood beads are invisible on the Footman body (geoset 0) but visible on the sword.
   - Measure the cause first: sites, positions against the surface, size against the body, alpha, blend, and whether particles spawn inside the mesh.
   - Then fix it generally.
   - Prove it in a capture. Blend emitters darken the image, so count changed pixels against the baseline.
3. **Inward souls and Rune rings.** Tune the single emitter up to about the old body light: Rune rings 7.82, Inward souls .49.
4. **Steady rate.** New built-in emitter layers of every kind get a steady rate. Blade crackle is excluded and stays exactly as it is.
5. **Rising embers.** It becomes real embers:
   - LavaLump picture.
   - Few, slow and long-lived, rising gently.
   - Alpha 200>150>80, Unfogged, cooling orange.
   - New layers only, and the name stays.
6. **New emitters.**
   - Re-file Falling snow, Maple leaves, Falling feathers, Ash flecks, Coal sparks and Hot filings from `src/fx-sort-looks.js`. Fix each one's values so it reads as its name, steady and sized to the part.
   - Add **Fire hair**: `Textures\clouds_anim1_bw.blp` 4x4. Follow the flame rules in the contract: 255>255>0, middle at half life, cooling colour, shrinking.
   - Offer all of them in Add emitter and Change emitter. No Ground dust.
7. **Names.**
   - Apply the FINDINGS rename table and merge the duplicates. "Blade crackle" and "Rising embers" keep their names.
   - Saved layers with old labels must still find their ingredient: check every lookup by label.
   - Translate into all five catalogues and update `test/localization-catalogs.test.js`.
8. **Options under More**, with EMTR's own components:
   - Size for native kinds, emitter area Width/Length, middle-point Time, Priority plane and Unfogged.
   - Keep them in `layer.native`, and each must make a visible change.
9. **Flies on Death.** A switch "Rise on Death" on the Fly swarm layer, off by default.
   - On: the swarm helper rises like native Flies.mdx across Death. It reaches 0.6 x unit height at 1.0 s and 2.5 x at 2.17 s, and the flies hide from 1.9 s.
   - Scale those times to the Death length if Death is shorter.

**Checks**
- After each item:
  - Run `pnpm run build` when app code changed.
  - Run `node --test test/fx-*.test.js test/global-animations.test.js test/claude-fx-looks.test.js test/surface-effects.test.js test/localization-catalogs.test.js`. 290 pass at the base.
- At the end:
  - Package the app.
  - Hidden, on a separate desktop, capture every changed or new emitter on the Footman body and sword (`D:\Claude\MDLxL\TestBuilds\test-models\TEST FX EDITOR 02.mdx`, copy it). Look at the images and give a verdict per emitter.
  - Run hidden: `fx-click-sweep`, `fx-empty-emitters`, `fx-responsiveness`, `fx-cards`, `global-animations` and `fx-layer-editing`.
  - Never the full suite.
- Update the contract doc and row 5 of the status table in this note.

**Report:** per item done or not done, before and after numbers, the verdict with capture paths, commits, test counts with the fail-first evidence, anything not verified, and the branch and revision for Claude's review.

## Not in scope

## Codex round 2 evidence

Local branch `codex/fx-emitters`, based on `cbc17f49`, in `D:\Codex\fx-emitters`.

1. Shared sites: already correct at the requested base. `emissionShares` returns
   null for one through four regions; native emitters then retain their full
   per-region rate. Ground/flat specs collapse before sharing. The existing
   real-model regression covers 1, 4 and 17 regions. The audit's Footman "sword"
   (geoset index 1) actually has **9** skin regions, so the owner's more-than-four
   rule deliberately reduces its Fire column from 216 to 96 in flight. The body
   has 27 regions and also yields 96. No code change or invented fail-first claim.
   Base focused group: **290 passed, 0 failed, 0 skipped**; build passed.
   Evidence: `out/item-01-tests.log`, `out/item-01-build.log`,
   `out/fx-review/emitters/inventory-before.json`.

The Raider rider split, POSE and Bone Namer work, and merging. Nothing goes online until the owner says "merge".
