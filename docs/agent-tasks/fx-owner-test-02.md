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

## Not in scope

The Raider rider split, POSE and Bone Namer work, and merging. Nothing goes online until the owner says "merge".
