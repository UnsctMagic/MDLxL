# FX: place and edit each emitter of a layer

Status: in progress in Codex; items 1–4 verified, items 5–9 pending
Branch / checkout: Codex continues `codex/fx-emitters` in `D:\Codex\fx-emitters` (round 2 head `a8216288`, not yet reviewed by Claude)
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
