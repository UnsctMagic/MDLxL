# FX editor: owner's hand test 2 (12 Nov 2026)

Status: Codex emitter round 2 implemented and checked locally; awaiting Claude review and owner hand test
Claude branch / checkout: `claude/fx-editor` in `D:\Claude\MDLxL\.claude\worktrees\fx-editor`
Codex branch / checkout: `codex/fx-emitters`, from `cbc17f49`, in `D:\Codex\fx-emitters`
Original owner-tested build: `D:\Claude\MDLxL\TestBuilds\fx-editor-02\MDLxL.exe` with `TestBuilds\test-models\TEST FX EDITOR 02.mdx` (a Footman)
Round 2 tested build: `D:\Codex\fx-emitters\out\pkg\MDLxL-win32-x64\MDLxL.exe`; opened for the owner with a separate test profile on request.
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

## Status (12 November 2026)

The original round was orchestrated by Claude with Opus coders, then paused at 08:00
Europe/Amsterdam. Codex completed the later emitter work order in its separate worktree.
Local only; owner acceptance of round 2 has not been reported.

| # | Issue | State | Commits |
| --- | --- | --- | --- |
| 1 | Falling mist on a body | Fixed in code. Cause: 27 skin regions x 5 emitters = 135 emitters, one puff per 6 s each. A part with more than four regions now gets count x 4 sites spread by region length; parts with four or fewer are unchanged. By-eye check on the body still open. | `67561c20` |
| 2 | Ground glow | Removed from the library; saved models still open (retired list). | `eda5cc66` |
| 3 | Glow shell thickness | Thickness slider under Intensity (`inflate`, 0 to a tenth of the part's length). Updates on release. | `f0814396` |
| 4 | Fly swarm | Rebuilt as geometry in the native Flies.mdx technique: one quad per fly on its own billboarded bone, sets of five on distinct clocks. Amount 5-30, Fly size, Swarm size, Speed, colour, Position & size handles. Old saved fly layers keep their emitter flies. Default picture is the native Abomination fly area; fly size 8.5 % of mesh height (6-22). By eye in the FX preview: small separate flies in proportion; no fair side-by-side with the reference yet; handle drag on a swarm checked only by the packaged Resize/Move test. | `1164ba9e` … `77b77c7a` |
| 5 | Emitters inside FX | Round 2 implemented locally for new layers; 322 frozen saved stacks byte-identical and fixture unchanged. Shared-site boundary verified; surface placement corrected; ground emitters strengthened; steady rates except unchanged Blade crackle; real Rising embers; seven approved additions; descriptive names with duplicate choices merged and old labels preserved. More uses EMTR Size, Spawn width/length and Halfway controls, saved in `layer.native` and visibly verified. **Unfogged and Priority plane: left out, preview cannot show them.** Shared preview unchanged. Focused group: 302 pass, zero failures/skips. All six required hidden packaged checks pass (1,771 click-sweep actions, zero failures), plus options and Fly Death harnesses. All 39 menu choices captured on body and actual sword; per-emitter verdicts and limits in report. | Codex round 2, local branch below |
| 6 | Lag | Cause: every compile resampled the whole skeleton per skin region. The window now reuses the samples per model revision; output byte-identical. Footman body Fire pick 475 → 154 ms, dense model 2154 → 397 ms. Left alone: full preview rebuild per change (~130 ms on the Footman, shared `GamePreview.jsx`). | `e58348b1`, `c3122229` |
| 7 | Moving skin speed | Speed 0-8 in steps of 0.05; a fractional speed runs whole passes on a longer owned clock; reopens as saved. | `eca70805` |

Historical checks at `39632a18` (coder's report): FX source group 290 pass. Hidden packaged on
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

Open for the owner: fly look by eye (colour, size) on their own models; whether the remaining
preview-rebuild cost is worth a future change to shared preview code. The requested optional
Rise on Death switch is now implemented and verified in round 2; it remains off by default.

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
   - Later owner clarification: leave out Unfogged and Priority plane ("left out, preview cannot show them"). Do not change the shared preview.
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

## Codex round 2 evidence

Local branch `codex/fx-emitters`, based on `cbc17f49`, in `D:\Codex\fx-emitters`.

1. Shared sites were already correct at the requested base: one through four regions
   retain full per-region density; ground/flat specs compile once. The audit called
   geoset index 1 the sword, but that is the nine-region team-colour geometry.
   The actual sword is index 2 (four regions), and Fire column stays at 96 in flight.
   The body is index 0 (27 regions). Final captures use body 0 and sword 2. The separate
   sword is authored hidden in Stand: its captures use Solo and Decay Flesh without editing
   model visibility. Normal mouse orbit was verified on both.
2. Surface-placement measurements found particles on or inside the body, including
   regions without complete triangles and overlapping limbs. New layers use outward
   surface sites checked against the whole part. Blend evidence counts darkened pixels.
3. Ground emitters remain single; Inward swirl rate 4.5 and alpha 100/160/186;
   Ground rune rings rate 2.5 and an 8% size increase. Final 36-frame body light means
   are .53 and 7.34 respectively (requested historical targets .49 and 7.82).
4. All new built-ins have steady rates, except unchanged Blade crackle. New drops start
   with at least two nominal particles per site so lifetime gaps do not synchronize into
   blank frames. Body Drops minimum changed pixels rose from 0 to 3.42 per thousand;
   Dripping water from 0 to 4.4. Existing saved rates remain unchanged.
5. Rising embers uses LavaLump, rate 12 total, life 2.5 s, slow rise, shrinking particles,
   cooling orange, alpha 200>150>80 and Unfogged. Its name and site spread remain.
6. All seven approved additions are offered. The three pictures absent from the old
   catalogue were read and hashed from installed Warcraft III CASC data.
7. Menus have descriptive unique names; all 28 old ingredient labels still resolve.
   All new names are translated into the five catalogues.
8. EMTR's Size, Spawn width/length and Halfway controls visibly affect the preview,
   preserve the camera and survive actual MDX/MDL close-and-reopen. Unfogged and
   Priority plane: **left out, preview cannot show them**. Shared preview unchanged.
9. Rise on Death is off by default. On, its helper follows the part centre in model
   space and adds the requested rise, so a falling parent cannot turn it downward.
   The owned material hides at 1.9 s; shorter Death timing scales proportionally.
   Source normal/short Death and hidden live-rise/hide checks pass.

Every app item passed its build and the required focused group (base 290; final 302,
zero failures/skips). All six required packaged harnesses and the two new control/Death
harnesses pass. Small sparks remain faint; Ghost flames show brightness breathing despite
a constant rate. These are disclosed visual review notes, not owner aesthetic acceptance.
Fail-first evidence, per-item commits and final hidden results:
`D:\Codex\fx-emitters\out\fx-review\emitters\REPORT.md`.
No owner hand test or Warcraft III gameplay acceptance is claimed. Saved on your PC,
not online; no push, PR or installed-profile changes.

## Not in scope

The Raider rider split, POSE and Bone Namer work, and merging. Nothing goes online until the owner says "merge".
