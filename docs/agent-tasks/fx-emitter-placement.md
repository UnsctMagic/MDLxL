# FX: place and edit each emitter of a layer

## Current source checkpoint: element techniques and shared controls

Owner authorization: implement all nine elements, preserve saved values, and use
one control layout. No tests, lint, builds, packages, app launches or captures are
authorized in this round. The local checkpoint is on `codex/fx-emitters`, after
`112cb8d3a098e1cb70a7a8986b362c2e6d6cf938`; root source review approved
a local commit, explicitly untested. Nothing was pushed.

- Fire, Frost, Lightning, Arcane, Fel, Poison, Lava, Water and Crystal declare
  element data and use compact, enveloping, moving-surface and airy techniques.
  Lightning and Crystal omit enveloping. Existing Fire/Arcane variation IDs stay;
  technique identities prevent duplicate choices. Native catalogue paths are used;
  catalogue presence is not runtime availability or visual acceptance.
- Compact roles share a tight anchor. Enveloping and moving particle layers use
  independent native local-X/local-Y half extents. Long rectangles are limited to
  rigid connected straight pieces; different skin bindings, disconnected pieces
  and curved regions retain separate surface sites. Count additions and own-look
  refits regenerate geometry hints; explicit native fields take precedence.
- Fresh Fire/Fel use generic airy fit; saved `fireFit` keeps its prior behavior.
  Frost keeps fixed structure with reduced vapour, Lightning uses softer broken
  arcs, Arcane retains crossing energy and its corrected shimmer, Poison separates
  rising bubbles from haze, Lava has slow flow/heavy particles, Water retains
  running surfaces/drips and Liquid body gains spray, and Crystal facets stay fixed.
- New starting layers have explicit recipe owners and stable role IDs. A deliberate
  variation switch replaces explicit owners and unique structural legacy matches.
  Duplicate or changed-identity legacy layers stay as extras. No ownership inference
  runs on plain open/save. Legacy aliases cover the earlier Fireball/enveloping labels.
- Particle primary rows stay Colour; Intensity; Emitters; Formation; Born/Halfway/End;
  Amount; Lasts; Size; Speed; Rise/Fall. More has the same existing fields/order.
  Native Size is primary. Fly swarm remains quads on bones: Amount=count,
  Size=sprite width, Speed=path multiplier, Formation=extent; PRE2 fields are disabled
  N/A. Loading/error is unavailable, not zero; actual zero sites remains recoverable.
- Whole-layer Amount shows the sum of actual sites; selected Amount is that site's
  value. Native gestures latch each site's own binding/curve. The existing conflict
  dialog receives ephemeral operation metadata; Keep preserves only relevant
  individual fields, while group-produced bindings do not manufacture new conflicts.
- The only GamePreview change is a read-only accessor for its actual local/global
  clocks. No renderer/simulation/camera behavior changed. Explicit gesture copies
  carry global duration metadata; current valid global IDs stay linked, including
  same-duration distinct authored clocks. Own-look import resolves portable durations
  with the existing clock owner; local tracks remain local.
- Shared EMTR components gained opt-in disabled/N/A rendering; normal EMTR callers
  keep their previous defaults. New labels/menu labels/tooltips are in five locales.

Final source review corrections: Born/Halfway/End now uses each site's own native
binding and selected life stage; other stages survive, with per-site opacity baseline
updates and the existing conflict policy. Swarm uses the actual ParticleSlider for
Amount/Size/Speed. Local draft values update once per frame, including Changeover.
Shared edits clear only affected group-produced bindings, so subsequent colour or
intensity edits are not masked. Unaffected layers acquire no empty individual map.
Count edits rescale every parked/live group rate through the existing track-scaling
helper, including tangents; zero count retains the last nonzero normalization.
Portable gesture duration metadata refreshes from valid authored clock IDs at read,
without retiming keys or replacing valid same-duration/duration-edited clocks.

Zero-unit-rate limit: if a native recipe's actual rate conversion is zero (for example,
its recipe speed multiplier is zero), a deliberate Amount gesture edits existing native
rates but leaves the shared recipe amount unchanged rather than dividing by zero.
New sites retain the zero-speed recipe until its motion is edited. A zero Amount with
a positive recipe unit rate uses the requested total divided by that unit rate.

| Item | Tests | Builds/packages | App runs | Captures |
| --- | ---: | ---: | ---: | ---: |
| Nine-element recipes and native paths | 0 | 0 | 0 | 0 |
| Native birth geometry and count/refit lifecycle | 0 | 0 | 0 | 0 |
| Shared controls, conflict ownership and clocks | 0 | 0 | 0 | 0 |
| Saved values, own looks and five locales | 0 | 0 | 0 | 0 |

Remaining acceptance, after a separately approved testing proposal: source syntax
and focused FX checks; save/reopen MDX/MDL with authored local/global tracks and
same-duration clocks; old `fireFit` equivalence; all nine variation menus including
added duplicates; native zero-site recovery/loading; every primary/More control;
whole/individual Keep/Apply scalar/RGB/Bezier edits and repeated group edits;
aggregate Amount then count down/up, count-to-zero/restore and parked-rate curves; own-look refit
with explicit count/width/length/aim; native rectangular births on rigid/mixed/curved
parts; GreatUnclean G9 compared with protected G17/G27/G31; normal mouse rotation;
reference playback and texture availability. The reported Enveloping zero-emitter
runtime cause remains unproven. No claim of visual parity or Warcraft acceptance.
Open owner Trial 03/04/05 apps, models and unsaved work were not touched.

Status: Fire/Arcane variations, fresh Fire defaults and closed-menu wheel preview implemented for source review. Owner visual acceptance and release QA are pending.
Branch / checkout: `codex/fx-emitters` in `D:\Codex\fx-emitters`. Trial 04 was built from count and controls checkpoint `4902d535`. The current recipe and dropdown changes follow that revision.
Owner / consolidator: Claude reviews; Codex builds
Background: [fx-owner-test-02.md](fx-owner-test-02.md) (round 2 work order), [FX contract](../FX-GLOBAL-ANIMATIONS.md)

## The owner's words (12 November 2026, looking at Fire and Burning cracks on a rider model)

> With the emitter settings - I still find it a bit hard to position them - its like I have one shell to work with and I can just make it thicker or less thick - i cant change height.
>
> But actually, what I should do is also be able to dynamicly position shit - attach different fires to different surfaces etc.
>
> it should have a default offer - but user should have the control individually - up to moving single flames around, changing individual emitters within a bigger emitter setting etc.
>
> Moving shit around should be fast if I want or more accurate if I take time.
> For example a slider to really just tighten formation or individually dragging pieces of emitters too move them /edit each emitter within a single emitter setting.
>
> e.g the fire actually creates a few emitters - but i edit all of them together, right? so i should also be able to quickly access individual ones. also delete individual ones.
>
> Everything FX does is a template to be adjusted - modular building, fully custom.
> But achieve this WITHOUT making it too complicated - I hate cluttered controls and over-abundance

The owner's answers to Claude's questions:

- "Can't change height" means: "Where the emitters are actually attached/positioned."
- An individual edit, then later a whole-layer edit: "offer both solutions to the user."
- What can be attached to another surface: single flames (single emitters).

## How it works now (code at `a8216288`)

- One emitter layer (for example Flames) compiles into several emitters
  (`particles()` and `nativeParticles()` in `src/global-animation-model.js`):
  - Built-in kinds: `count` emitters per skin region, or `count x 4` shared by length on parts with more than four regions (`emissionShares`).
  - Native kinds: one per region, or shared by `sharedSites`.
  - Each emitter sits on the part's surface (`surfaceAt`), pushed out by an amount tied to its size. This is the "one shell" the owner describes.
- Position & size (`GlobalAnimationStage.jsx`) has one move handle (`offset`, moves every emitter of the layer together), top and bottom handles (`upper`/`lower`) and a size handle.
  - The top/bottom handles change nothing on parts with more than four skin regions (shared sites ignore `upper`/`lower`, line 444) and nothing on native emitters (always at the region centre).
  - The owner's rider body and the Footman body both have more than four regions.
- Every emitter of a layer shares all settings. None can be picked, moved, changed or deleted on its own. Open in EMTR opens the layer's first emitter.
- Existing pieces to reuse:
  - Clicking particles in a preview picks their emitter (`pickPreviewParticles` / `onParticlePick` in `GamePreview.jsx`).
  - EMTR's **Snap to surface** (`ParticlePlacementStage.jsx`): press it, double-click a surface, and the emitter is placed there under that surface's bone (`particleSurfaceAnchor`, `onParticleSurfacePlace`).
  - The emitter handles of `ParticleStageTools`.
  - FX's `regionParent` attaches to blended skin.
  - The app's shared small dialog (`app/Dialog.jsx`).

## What to build

Only these. No new panels, lists, tabs or toolbars; the owner hates clutter.

1. **The default offer stays.** Picking a look, an emitter or Change emitter places the emitters automatically, as now. Everything below adjusts that starting point.
2. **Where the layer sits works everywhere.** The move handle and the top/bottom handles of Position & size move and spread the layer's emitters on every part and every emitter kind. This covers many-region bodies and native emitters.
3. **Fast: tighten the formation.** One slider on the emitter layer pulls its emitters together or apart around the layer's centre. The starting placement is the middle of its range. It updates on release like the other FX sliders.
4. **Accurate: each emitter on its own.** While Position & size is on:
   - Each emitter of the selected layer shows as a small marker in the preview. Use the existing emitter marker look; show the smallest indicator per AGENTS.md.
   - Clicking a marker, or that emitter's particles, selects that one emitter. It gets the same move handle the layer uses, with the same look, drag and keys, and dragging moves only it.
   - With one emitter selected:
     - The controls below the layer list change only that emitter: colour, intensity, life, amount, size and the More fields.
     - The panel says which one it is, for example "Flames 3".
     - Clicking the layer's button or pressing Escape returns to the whole layer.
5. **Delete one emitter.** With one emitter selected, a Delete emitter button removes just that emitter.
6. **Attach a single emitter to another surface.**
   - With one emitter selected, EMTR's Snap to surface (same label and behaviour) lets the user double-click any surface of the model, not only the FX part.
   - The emitter moves there and is attached to that surface, so it moves with it in every animation. Use the bone, or the skin attachment for blended skin, as EMTR and `regionParent` do.
   - While Snap to surface is pressed, the double-click places the emitter instead of selecting a part.
7. **Individual edit, then a whole-layer edit: offer both.**
   - When a whole-layer change touches something that an individually edited emitter has its own value for, the app asks once for that change, with two choices:
     - **Apply to all:** every emitter, including the individually edited ones, takes the layer's new value. Hand-placed emitters return to the formation.
     - **Keep individual changes:** individually edited emitters keep their own value. Hand-placed emitters stay exactly where they were put.
   - Examples of such a change: the move handle, the formation slider, the top/bottom handles, or Colour for the layer after one flame was made red.
   - Use the app's shared small dialog. Ask nothing when no emitter has its own value for what changed.
   - Change emitter keeps every emitter's place, including hand-placed and deleted ones; the layer button promises "keep its position".
8. **Open in EMTR** opens the selected emitter when one is selected.
9. **It all lasts.**
   - Individual places, values and deletions survive Apply, reopening FX, re-editing, and saving and reopening the model (.mdx and .mdl).
   - They work for every look and every emitter layer, built-in and native.

## Rules

- Saved stacks without individual edits compile byte-identically. `test/fx-legacy-snapshot.test.js` stays green and its fixture untouched.
- Individual data lives on the layer, keyed by the emitter's existing stable site key (the `nodeFor` keys such as `source<region>-<i>`). If a layer change removes that emitter, its individual data goes with it.
- Use one way of doing things (AGENTS.md):
  - Reuse EMTR's handles, Snap to surface and the existing slider.
  - Never invent a new control scheme.
  - No flavour text.
  - Short tooltips only on the new slider and the dialog choices.
  - Every new UI string goes into all five catalogues in `src/locales/`.
- Live drags update at most once per display frame and do not recompile the whole stack per pointer move (`docs/ARCHITECTURE.md`); the FX editor was already reported as laggy.
- Never reset the user's camera.
- Tests follow `docs/TESTING-RULES.md`:
  - Each new test fails on the old code (show it).
  - Drags are real mouse drags in the packaged app, run hidden on a separate desktop.
  - Tests that read private models skip when the file is missing.
- Local commits only, one item per commit. No push, no PR. Report "saved on your PC, not online".

## Checks

- After each item:
  - Run `pnpm run build` when app code changed.
  - Run `node --test test/fx-*.test.js test/global-animations.test.js test/claude-fx-looks.test.js test/surface-effects.test.js test/localization-catalogs.test.js`.
- At the end:
  - Package the app.
  - Hidden, on the Footman body (many regions) and sword from `D:\Claude\MDLxL\TestBuilds\test-models\TEST FX EDITOR 02.mdx` (work on a copy):
    - Drag one flame.
    - Tighten the formation.
    - Move the layer with the top/bottom handles.
    - Delete one flame.
    - Snap one flame onto the sword and play an animation (it follows the sword).
    - Make one flame red, then change the layer colour and check both dialog choices.
    - Apply, reopen FX, and save and reopen the model.
  - Look at captures and give a verdict per item.
  - Run hidden: `fx-click-sweep`, `fx-layer-editing`, `fx-responsiveness`, `fx-empty-emitters`, `global-animations`. Never the full suite.

## Report

Per item: done or not done; commits; fail-first evidence; test counts; capture paths with verdicts; anything not verified; and the branch and revision for Claude's review.

## Not in scope

Merging FX, round 2 review fixes (Claude reviews round 2 separately), and new looks or emitters.

## Codex implementation evidence

1. Default offer: unchanged from round 2 head a8216288. Existing preset/default tests cover picking looks and emitter ingredients; no new behavior or invented fail-first test. Required source group: 302 pass, 0 fail, 0 skip (out/placement/item-01-tests.log). No app edit, so no rebuild for this item.

2. Layer position/span: opt-in placement mapping now affects built-in and native sites on body and sword; untouched saved stacks keep their old compiler path. Existing EMTR handles update the live emitter pivots without recompiling per move. Eight source cases failed before and pass after. Build and focused group: 310 pass, 0 fail/skip. Hidden real upper-handle drag failed on round 2 (native pivots unchanged), passes on item 2, with playback captures in out/placement/ui/span-*.png. Camera recomposition differed by under 1e-12 world units; the check allows 1e-8, not a visible view change. Full placement acceptance remains at the final gate.

3. Formation: existing RangeField, 0–2 with 1 at the centre, commits on release. Four source cases failed before; hidden UI failed on missing Formation. Final build/source group: 314 pass, 0 fail/skip; hidden span/Formation pass. Capture out/placement/ui/formation-tight.png shows the closer formation. Added both strings to all five catalogues. The source slider-count expectation changed from 11 to 12 solely for this requested slider; every slider still asserts onCommit and no onChange.

4. Individual emitter selection and editing: small existing-style markers, single particle clicks through the shared hit test (FX opt-in), the existing move handle, scoped Colour/Intensity/life/amount/size/More, numbered selection heading, layer-button and Escape return. Individual records use the source site key; unrelated sites stay byte-identical. Four new source cases failed before. Build/group: 318 pass, 0 fail/skip. Hidden markers, one-site drag, one-site red colour, real particle click away from markers, both returns and actual mouse orbit pass. Capture: out/placement/ui/individual-red.png. Live drag uses the existing frame-coalesced handle and particle update path.

Item 4 follow-up: the extended large-drag check exposed a moving animation reference frame and stale selection snapshot. Reused EMTR’s hold-during-drag path and wait for the selected snapshot. Required source group rerun: 318/0/0 (out/placement/item-04-final-source.log). Two corrected hidden runs pass, including a 150 px individual drag and particle click (item-04-follow-ui.log, item-04-final-ui.log). Initial failures remain in item-04-pointer-check*.log.

5. Delete emitter: removes only the selected stable site and returns to the layer. Deletion records survive compilation; stale keys are pruned. Four fail-first source cases; hidden old-package failure on missing Delete emitter. Build/group: 322/0/0. Hidden select → drag → Delete passes; out/placement/ui/deleted-one.png. New label translated in all five catalogues.

6. Snap to surface: reuses EMTR’s picker and label, takes precedence over part selection, and stores the picked triangle/barycentric attachment on the individual record. Existing regionParent samples the actual blended triangle motion; authored tracks are untouched. Four cross-part cases failed before; all target animations, endpoints and intermediate samples now stay within .04 model units. Build/group: 326/0/0. Hidden actual-sword double-click/playback passes (item-06-ui.log, item-06-capture-ui.log); out/placement/ui/snapped-sword.png. The sword is visible in Decay Flesh. Warcraft III itself is not exercised.

7. Shared conflict dialog: only overlapping whole-layer edits ask; Keep preserves the individual record, Apply to all removes the touched value and returns hand placements to formation. Deleted sites remain deleted. Change emitter freezes the current automatic site layout and preserves hand positions/deletions across built-in/native changes. Three source fail-first cases, then 27 focused pass; UI failed first on missing dialog. Build/group: 329/0/0. Hidden both colour choices and Change emitter pass (item-07-ui.log); captures keep-individual.png and apply-all.png under out/placement/ui. Dialog strings/tooltips translated in all five catalogues.

8. Open in EMTR now resolves the selected stable site after Apply, including node renumbering, and keeps the existing representative behavior for a whole layer. Hidden fail-first selected source14-0 instead of source0-1; item-08-ui.log now verifies the exact chosen tag. Build/group: 329/0/0. Capture out/placement/ui/selected-emtr.png. The permanent Footman fixture, supplied TEST FX EDITOR 02.mdx and our copy have the identical SHA-256 FA74AE722B151A1CF5E297BEBE17D5A734FB89225823E37E29A588ECAF527812.

9. Persistence: individual records survive Apply, FX reopen, real MDX/MDL file close/reopen, re-edit and Undo. Native baselines keep subsequent EMTR edits on their own site; a new quick edit supersedes its earlier native override. The new matrix covers 48 look/menu recipes in both formats, four EMTR cases (selected and sibling), two saved surface bindings, one quick-after-native case and two blended-drag cases. The geometry-only Fly swarm keeps its existing workflow. Final build and source group: 386/0/0 (out/item-placement-09-final-tests.log), including the sibling EMTR cases and the precision/first-use picking corrections below.

Final interaction checks found and corrected two cases missed by the earlier simple path: a blended-skin drag shifted about 19 px on release in Attack (source: roughly 5.95 world units), and first-use particle picking lacked texture coverage until a later edit. Manual offsets now retain the attachment frame used during the live drag, and FX registers the existing picker before textures load. Fail-first evidence: item-09-drag-baseline.log, item-09-drag-ui-fail-first.log, item-09-first-pick-fail-first.log. No whole-stack compilation is added to pointer moves. Two additional fail-first cases exposed EMTR edits to another site in a mixed layer being lost on FX re-edit; native baselines now track every live site in that layer (item-09-sibling-fail-first.log, then 4/0/0 selected/sibling EMTR checks).

The full local handoff, per-item captures/verdicts, source logs, package hashes and final harness results are in out/placement/REPORT.md. The frozen legacy fixture remains unchanged (Git blob 32818eaa8b4bbaae1c00be35854bb2542dd7c4b6). The owner's already-open round 2 app/profile are preserved; only this task's hidden test package/profiles and scratch copies are disposable.

## Owner follow-up: usability and first-click placement (12 November)

The owner stopped the final regression rerun to try the app. Pre-follow-up build
and source group passed 386/0/0; the full body/sword placement workflows passed.
The interrupted latest click sweep reached 489 sword + 489 body clicks with no
failures; it did not complete the remaining final gate. These results do not
verify the new work below.

Keep all requested controls and add:
- Easier small-marker picking and quick hide/show.
- The current shared EMTR handle indications; sideways/depth layer stretching.
- Keyboard Delete for the selected individual, including after a drag.
- Remember the overlap-dialog choice for this FX, with direct access to change
  it back to Apply to all without another prompt.
- Mouse-wheel cycling of preview dropdown choices through the existing owner.

The first-click offer must also respect actual geometry. Restore continuous
sword coverage and derive site count/placement from covered shape and surface
extent. Armour should favour shoulder shells and exposed rims, not the centre
of the abdomen. The owner's target is 90% satisfactory first-click offers;
this percentage is a future visual acceptance target, not a measured result.

Read-only study found the concrete sword regression in the owner's
WH_DOC_GreatUCO1C (2).mdx, displayed geoset 11 (index 10): seven sites are still
requested across a 160.47-unit rigid blade, but the exterior-vertex lookup from
e99f89c0 moves stations toward the ends. Release-style axial positions were
[-45,-33,-16,0,16,34,47]% of length from centre; current positions were
[-51,-51,-38,18,45,46,46]%. Repair the sampling, not merely the count. Reuse the
existing strip frame, actual triangles and skin attachment path. New geometry
suggestions must be opt-in for fresh layers; retain saved-stack/site identities.

User assigned Astra to coordinate/review and GPT-6.1 Sol xhigh to code. Shape
study used GPT-6.1 Sol medium. No automated tests/builds/packages for this new
round are approved. Propose a cheaper suitable agent, exact scope and expected
cost, then stop for approval before any such round. The next intended handoff
is an owner-visible test build; QA remains for later.

Preserve the open owner apps and their models/profiles, including the placement
app under out/placement/pkg and out/placement/owner-test. Do not rebuild or
remove either while the owner is using it.

### Follow-up source design

The usability patch adds larger invisible marker hit targets, the shared hover
words, Width/Depth formation handles, Delete through the same selected-site
command as the button, a per-effect remembered conflict policy, and controlled
wheel choice callbacks in the existing dropdown owner. Action menus still need a deliberate click. These changes were in owner trial 02.

The geometry sampler lives in src/fx-emitter-surface.js and reuses a pure
physical-surface-component query from geoset-operations.js. The selected geometry
is divided across matching physical edges before classifying strips; indexed UV
islands are not physical parts. Slaanesh Dual G29 has two physical blades even
though the whole-geoset principal axis runs across their gap. Its G10 has four
compact shoulder shells. Footman G1 contains a narrow island with only 9.4% of
the surface area, so one narrow component must not classify the body as a blade.
Nurgle G9 has small upper/lateral shoulder pieces despite 86% of its area being
in larger lower pieces; pure area allocation misses the requested accents.

Fresh eligible layers freeze versioned surfaceFit recipe inputs (footprint and
live-particle budget). The initial slots are derived deterministically from the
selected geometry and cached with its surface identity. Colour/size/amount edits
do not reallocate those slots. Own-look refits recompute these inputs for their
target geometry. Legacy layers and explicit siteLayout keep precedence. Default
triangle/barycentric anchors use the existing skin attachment path separately
from manual individual records. The owner tried trial 02 and rated the direction about 85%; this is owner feedback, not measured accuracy. Preserve those accepted automatic defaults.

### Trial 02 handoff (historical)

The owner approved GPT-6 Luna low to build/package one isolated manual trial.
Trial 02 built and opened with copied sword/body models under
out/placement/trial-02; its report.txt records the launch and setup limitation.
The owner then tried it and requested only this final polish:

- Add emitter sites inside the selected layer and an Emitters count slider,
  separate from particle output/intensity. Retain existing positions and edits.
- One pending preview across surfaces; switching targets discards the previous
  unapplied draft. Preserve effects already applied to the actual model.
- Reuse EMTR rotation rings for emitter aim, individually and across the layer.
- Preserve the accepted shape placement. Further study must demonstrate a
  useful correction before changing defaults; no speculative retuning.

GPT-6.1 Sol xhigh implemented the polish; Astra reviewed the source. Claude is requested
for a bounded source/regression review, with the handoff and response through
computer use as explicitly authorized by the owner while AFK. This authorizes
review communication, not Git push, merge, publication or new QA execution.
No new tests, linters, builds or app checks are authorized for this polish.
The owner deferred QA until release packaging to avoid duplicate expenditure.
Any future testing round still needs the owner's specific agent/scope approval.
Historical 386/0/0 source results and earlier captures predate these follow-ups.
Review checkpoint: the local commit containing this note follows 49c61d59 and
includes item 9 persistence plus the owner usability, geometry and final-polish
follow-ups. No new test pass is claimed. Latest polish capture count: zero.

Trial 02 polish added a 0–64 Emitters count that parked and restored stable site
keys and records. It also added an extra-emitter button that selected the new or
restored site. Trial 03 feedback later removed that button. Rotation uses the
shared EMTR rings and native Rotation to change aim without moving the formation.
The preview adapter exposes its existing global rotation clock in the snapshot;
rendering behavior and the omitted Unfogged/Priority plane controls are unchanged.
Open in EMTR retains its explicit apply-and-open behavior. The new control labels
and tooltips are in all five translated catalogues. Existing test files in this
commit are the earlier item 9 evidence, not new polish tests.

Trial 02 and the older placement trial have closed. Their disposable packages
and profiles were removed after a process/path check; copied models/textures,
logs and captures remain. The active out/pkg app and out/owner-test-profile were
preserved. Do not disturb that owner app or other tasks' processes.

### Claude review reconciliation (source only)

Claude reviewed local checkpoint 846b5f1b through the owner-approved computer-use
handoff; full report: out/placement/CLAUDE-REVIEW.md. Two concrete corrections:

- Change emitter now preserves siteRateScale for counted native-to-native layers;
  counted built-in-to-native replacement follows the existing frozen-layout budget.
- Registering the first empty individual record for Open in EMTR retains an
  otherwise identical, unplaced layer's existing native nodes. Normal baseline
  capture then records them. Other retain predicates remain unchanged.

Two findings did not justify changes. Global-sequence reorder/delete traverse
track-shaped emitterState baselines through sequence-editor.js visitModel, so
normal clock renumbering updates both sides of the readback comparison. The
extra-emitter button then used a synchronous graph compile and selected the new
individual in the same render, hiding the button before a second click.

Pre-existing absolute manual positions in own looks are outside this polish;
do not silently discard them. Preserving arbitrary earlier manager overrides on
a later real recompile needs a separate migration design; the narrow Open fix does
not claim to solve it. Release QA must exercise count/delete/add/save/reopen,
Change emitter density, native aim timing, ordinary mouse camera rotation and
single-preview surface/group switching. No new tests/build/captures ran for these
corrections. The owner must approve the eventual release testing round and agent.

### Trial 03 feedback and count correction

The owner approved the isolated build, package and launch of `32dfa08c`.
`out/placement/trial-03/report.txt` records its setup and logs. Trial 03 remains
the owner's active copy. It is an earlier revision than the correction below.

Low counts kept the first slots in the offer, which bunched Fire at one end.
The owner asked for the slider alone and for Emitters and Formation immediately
below Intensity. The source correction ranks the existing offered points. One
site uses the point nearest the centre, two use the widest pair, and additional
sites fill the largest remaining gaps. The next slider edit redistributes
coverage. Explicit Delete and Change emitter keep the current surviving live
keys through `activeSiteKeys`. All slot keys, hand placements, parked edits,
deletions and native recipe budgets retain their existing meaning. The
extra-emitter button was removed. The placement row wraps whole controls when
space is tight, so Position & size can keep its natural width.

This checkpoint has source review only. Tests, builds, packages, app runs and
captures for the correction are all zero. Check low counts on the sword and
armour, explicit Delete and Change emitter, and the control order and wrapping in
the next separately approved owner trial.

### Trial 04 and current recipe and dropdown changes

The owner approved the isolated build, package and launch of `4902d535`.
`out/placement/trial-04/report.txt` records its setup and logs. That revision
contains the count and controls checkpoint. It predates the changes below.
Trial packages, owner profiles and unsaved model tabs are preserved.

- **Fire → Variation** offers Surface flames, Enveloping flames and Fireball.
  Enveloping flames overlaps two surface-fitted CloudSingle emitters. Fireball
  starts its flame, glow and sparks at one sampled surface anchor.
- **Arcane → Variation → Shimmering energy** combines the native scrolling
  cloud skin and rising Star7b particles. The existing Arcane default and
  user-added layers remain available. The read-only reference study in
  `out/placement/reference-study-04/STUDY.md` supplied native asset and
  technique references. The patch uses only native art.
- Versioned fresh Surface flames use lighter ballistic fire on strips. The
  per-site rim cap affects the default sprite size, leaving the offered
  positions, placement footprint and count intact. The study's G9 component
  radii suggest a smaller result on its horns. G17, G27 and G31 sit below the
  cap in the source study. Playback of these cases remains pending.
- Saved layers without the opt-in retain their prior recipe. Size edits bypass
  the cap, native values stay authoritative and individual edits remain
  scoped. Fire quick Size, Speed and Rise/Fall show compiled values. Authored
  Speed/Gravity edits use the shared binding. A global track's phase falls back
  to the reported local frame, so it can differ from playback during a loop.
  Own-look refits clear the source triangle and geometry hints before sampling
  the destination.
- Wheel over closed Add emitter, Change emitter, Variation and Add layer menus
  to step choices. Add layer wheels one temporary preview, Add retains it, and
  an ordinary open-menu choice adds directly. Change emitter retains sites,
  and the recipe controls remain available during same-target asset loading.

This patch has zero tests, builds, packages, app runs and captures. The source
study provides starting values for owner review. Placement satisfaction,
reference visual parity and Warcraft III playback remain unmeasured.