# EMTR: add an effect the way ribbons are added

Status: R1–R9 implementation completed on PR #491; ready to test (unmerged)
Owner / consolidator: Codex (build); Claude Code (review and contract)
Updated: 2026-11-01

## Goal and completion criteria

The owner, 1 November 2026: adding an effect in EMTR must feel the same as adding
a ribbon. Today it "sucks". The only part the owner likes is **Snap to surface**:
keep it exactly as it is.

Done means the owner can do this without reading anything:

1. In Vertices, select some vertices (or nothing).
2. Press EMTR, open **Library**, click an effect.
3. Press **Add to model**.
4. See *that* effect on the model, at the selection, already playing.
5. Tick the animations it shows in, press **Create**. One Undo removes it.
6. Afterwards, drag it to adjust, like ribbon ends.

Scope: the effect (PE2 and Library recipe) placement path in the Particle Editor.
Ribbons, Glow Up, the Library browser and the recipe copy code (`placeParticleRecipe`)
keep their current behaviour. No new panels, no new windows. Follow
[contract §12.2](../particle-editor/CONTRACT.md) and AGENTS.md "One way of doing
things": this contract replaces the §12.2 placement panel shape with the ribbon shape.

## Revision and local state

- Build on: `codex/emtr-library-browse` ([PR #491](https://github.com/UnsctMagic/MDLxL/pull/491)),
  based on `a5c5a17e`. This implementation addresses the owner's placement bug and the full R1–R9 flow.
- Contract branch: `claude/emtr-placement-contract` (documentation only).
- Owner's live review app/profile `D:\Codex\mdlxl-491-particle-review`: preserve it.

## Implementation (1 November 2026)

The toolbar and stage Add routes share Library recipe reading and load-then-place. Selected vertices use the extracted ribbon influence rule in `src/particle-selection.js`. App forwards a single selected bone, helper or attachment for the no-vertex pivot fallback; other node kinds fall back to the origin. One placement panel serves effects and ribbons. Local tracks fit each checked animation; globals and unrelated target data remain unchanged. The recipe-copy API is unchanged.

Placement uses the shared ribbon circle at the native emitter point. Its pointer basis uses displayed canvas pixels, including UI scaling, and its updates use the preview frame scheduler. Moving the wrapper replays the actual particle simulation. Snap retains its button/double-click interaction and takes the parent from the hit face. The stage retains its last valid graph on error. Create selects the effect in On model with the requested message; existing move and key-track controls remain. Clicking a timing diamond now gives it keyboard focus, matching the stage handles.

Native wrapper names use the authored emitter name rather than a Unicode gallery caption, so inserting a friendly-named recipe remains saveable. Catalogue metadata and source recipes are unchanged.

New checks: `test/particle-add-like-ribbons.test.js` (six source cases), the real opening action in `test/particle-reentry.test.js` (bone/helper/attachment forwarding) and `test/emtr-add-like-ribbons.electron.cjs` (P1–P10, plus after-Create handle/key-track input). The latter uses the real SD Footman, three visible hand vertices, Fireball Missile and Howl of Terror recipes, and a copied indexed recipe with a deliberately unavailable source identity. All input is real mouse/keyboard on the hidden desktop. It measures native emitter and rendered particle displacement, target anchoring and animated sword attachment, exact serialized Undo/Redo/Cancel, and camera rotation.

Fail-first: the frozen `a5c5a17e` package reports “P1 placement must contain the clicked Library effect, not starter Soft sparks: Soft sparks”. The first corrected package exposed a native Unicode helper-name save failure. The drag check then measured only 91.7 pixels of movement for a 100-pixel pointer drag and no particle movement; the display-pixel basis and replay correction address those two paths. The after-Create check failed “R9 existing key track changes effect visibility” before the shared diamond focus correction. The selected-helper opening check also failed `undefined !== 4` before App forwarded helpers and attachments. These failures were measured before the corresponding changes.

## Verification — final package

P1–P10: **10 passed / 0 failed / 0 skipped**, hidden desktop with real mouse and keyboard. P1 compares the clicked native emitter and texture, the copied graph's hand parent, and the actual native emitter at the selected vertex centre. P5 measured 100.0 px emitter movement and 101.0 px rendered-particle movement for a 100 px drag, with unchanged camera. P6 proves the snapped point and animated sword parent (bone 19). After Create the same handle moved 50.0 px for a 50 px drag; a real click and arrow key changed the timing diamond. Cancel/Esc and Undo/Redo restore exact model bytes. P10 retains ribbon creation/edge editing, Glow Up and browsing; its camera drag starts on empty canvas, outside the glow resize handles.

All five final packaged Library workflows passed: layout, previews, copy, browse and indexing (**5 / 0 / 0**). The resumed scan processed 3,501 candidates into 4,589 readable recipes; virtual scrolling loaded thumbnails beyond the initial snapshot. Source: **2,647 passed / 0 failed / 10 existing skips**; focused placement/opening/ribbon/preview/frame tests **80 / 0 / 0**; compatibility **57 / 0 / 0**. Vite build (config loader runner) and package verification passed: **1,381 runtime/asset files, 55 locales**. No failure baseline was changed. The ten source skips are the existing Windows SIGTERM/symlink/8.3 limitations and optional archer, private Fx, skin-pair, twin-head, Tinker/Brown Magnataur and two POSE corpus inputs.

[Measured results and exact tested bundle hashes](../../test/evidence/emtr-add/results.json). Screenshots: [P1](../../test/evidence/emtr-add/P1.png), [P4](../../test/evidence/emtr-add/P4.png), [P5](../../test/evidence/emtr-add/P5.png), [P6](../../test/evidence/emtr-add/P6.png). Small logs are retained at D:/Codex/mdlxl-491-add-effects-report. The implementation revision is the PR #491 commit carrying this note and results; its source base is a5c5a17e.

Warcraft III gameplay, non-enUS installed data and independent Claude/owner acceptance remain unverified. D:/Codex/mdlxl-491-particle-review was preserved and was not rebuilt or replaced. Test builds/profiles are disposable. No merge or release.

## Relevant owners (contract review at `a5c5a17e`)

- [ParticleEditor.jsx](../../app/ParticleEditor.jsx): `initialPlacement`, `beginPlacement`
  (toolbar **Add to model**), `beginRibbon` (**Add ribbon**), `place`, `placementRecipe`,
  the Library `adding==='model'` route that calls `setPlacement(initialPlacement())`.
- [ParticlePlacementControls.jsx](../../app/ParticlePlacementControls.jsx): the ribbon
  branch (Visibility checkboxes + **Create** + **Cancel**) is the model to copy; the
  effect branch (Attach to / Animation / Start / End / Position & motion) is what goes.
- [ParticlePlacementStage.jsx](../../app/ParticlePlacementStage.jsx): placement preview,
  "Placement ghost" handle, **Snap to surface**, **End here**.
- [particle-placement.js](../../src/particle-placement.js): `particlePlacementInterval`,
  `placeTimedParticleRecipe` (ribbon visibility keys already written per ticked animation).
- [particle-ribbon-fit.js](../../src/particle-ribbon-fit.js): `ribbonPolygonSelection`
  already picks the parent bone from the selection's skin weights. Reuse that rule.
- [ParticleLibrary.jsx](../../app/ParticleLibrary.jsx): row click sets local `selected`
  only; the recipe reaches the editor only through Open in Lab / Enter / double-click.
- [particle-preview-adapter.js](../../app/particle-preview-adapter.js): `particleStageSnapshot`
  computes `anchor` (the ghost dot) from the anchor helper.

## Findings (review of `a5c5a17e`, owner screenshots 1 Nov 21:17 and 21:18)

Verified from code unless marked.

1. **The Library pick is ignored.** Toolbar **Add to model** (`beginPlacement`) closes the
   Library and places `extractParticleRecipe` of the *Lab* model, so the last Lab effect
   (owner: "Soft sparks") is placed instead of the clicked Library effect.
2. **Two different "add" routes.** The stage **Add** button (`adding='model'`) loads the
   chosen recipe first and then places it; the toolbar **Add to model** does not. Same job,
   two behaviours.
3. **The selection is ignored.** `initialPlacement` uses `attachmentNodeId` only. A selected
   vertex gives "Model origin" at `[0,0,0]`. Ribbons fit to the selection and pick its bone.
4. **Start is a meaningless number.** `from` is the main timeline's `previewFrame` clamped into
   the animation (owner saw 1507), not the start of the animation.
5. **End is required and starts empty.** **Confirm placement** is disabled and "Choose when the
   effect ends." is shown before the user has done anything. Ribbons need no end.
6. **End here produces an invalid end.** The ghost playhead loops the whole animation, not
   Start→end, and **End here** writes whatever frame it is on, including frames before Start
   (owner saw End 174 with Start 1507).
7. **One invalid number blanks the preview.** `placeTimedParticleRecipe` throws inside the stage's
   `graph`; the stage then renders only the error, so the model, playhead and End here vanish
   and the user cannot scrub back (owner screenshot 1: black stage).
8. **Ghost handle and effect disagree.** Owner screenshot 2: the "Placement ghost" dot floats by
   the staff top while the flame plays at the model origin. The dot is the wrapper helper's
   pivot (`anchor`), not the visible emitter. Exact cause not proven; fix by requirement R5.
9. **Panel is a form, not a placement.** Attach to, Animation, Start, End, Position X/Y/Z,
   Motion and Fit timing are all exposed. The ribbon panel has one checkbox list and Create.
10. **Label/wording drift.** Ribbon: **Create** / **Cancel**. Effect: **Confirm placement** /
    **Cancel placement**. Ribbon panel title "Add ribbon"; effect panel "Add to model".

## Requirements

**R1. One route, the chosen effect.** **Add to model** places the effect the user is looking at:
the Library's selected row when the Library is open, otherwise the Lab effect. Route it through
the same load-then-place path the stage **Add** button uses (load into Lab, then place), so Lab
and placement always show the same thing. If the recipe fails to load, show the error and do
not open placement. Never fall back to the previous Lab recipe or starter sparks.

**R2. Where = the selection, like ribbons.** With vertices selected, the effect's anchor starts at
their centre and its parent is the bone chosen by the `ribbonPolygonSelection` influence rule
(take it out into a shared helper that works on vertices, not only full polygons; ribbons keep
using it). Nothing selected: the selected bone/attachment node (`attachmentNodeId`) pivot, else
the model origin. No "Attach to" dropdown in the panel.

**R3. When = ribbon Visibility.** Replace Animation / Start / End / Fit timing / End here with the
ribbon's **Visibility** checkbox list, same component, same default (the current animation
ticked). The effect shows for the whole of each ticked animation, written as visibility keys the
way `placeTimedParticleRecipe` already does for ribbons. Source timing is mapped to the animation
as today's default fit does. Shorter windows are edited *after* placement with the existing key
track ("Change when the ribbon shows" / `setEmitterSpans`), the same as ribbons. No frame number
boxes in placement.

**R4. Same panel.** Effect placement panel = ribbon panel: title "Add effect", Visibility, **Create**,
**Cancel**. Remove Position & motion from placement (position is dragged, motion is the default
target motion). If a field truly cannot be inferred, ask in one line; do not reintroduce the form.

**R5. The handle sits on the effect.** The drag handle is drawn at the visible effect (the placed
emitter's world position), not at a helper elsewhere. Dragging it moves the effect by the same
on-screen amount. It uses the same handle look and drag behaviour as the ribbon end handles
(AGENTS.md "One way of doing things"); no text label like "Placement ghost".

**R6. Snap to surface stays.** Keep the button, its wording and double-click behaviour exactly.
Snapping also re-picks the parent: the bone of the surface that was clicked (same R2 rule on
that face's vertices).

**R7. The preview never blanks.** Placement cannot reach an invalid state (R3 removes the frame
inputs). Any remaining error shows as one line in the panel while the model and effect stay
visible and the camera still rotates with the mouse.

**R8. One step in, one step out.** **Create** is one undoable change; Undo removes the effect and
everything copied with it. **Cancel** and Esc leave the model untouched. After Create the editor
switches to On model with the new effect selected and shows the message "Effect added. Drag it
to adjust." (mirror of the ribbon message).

**R9. Same after-placement editing.** After Create the effect gets the same drag handle as R5 in
On model, plus the existing key track, so adjusting an effect and adjusting a ribbon feel the same.

## Acceptance (packaged app, hidden desktop, real mouse and keyboard)

| ID | Do | Pass |
| --- | --- | --- |
| P1 | Select 3 hand vertices → EMTR → Library → click effect A → Add to model → Create | The model gains effect A's native emitters (compare names/texture paths with A's recipe), parented to the hand bone, anchored at the vertices' centre. Not Soft sparks. |
| P2 | Open effect A in Lab, then in Library click effect B → Add to model | B is placed, not A. |
| P3 | Library effect that fails to load → Add to model | Error shown; no placement opens; Lab unchanged; model unchanged. |
| P4 | Placement open | Panel shows only Visibility, Create, Cancel (+ Snap to surface in the stage). No frame boxes. Effect visible and playing; mouse drag rotates the camera. |
| P5 | Drag the handle 100 px right | Effect's on-screen centre moves ~100 px right (handle and effect stay together). |
| P6 | Snap to surface → double-click the weapon | Anchor on the weapon; parent is the weapon's bone; effect follows the weapon in the animation. |
| P7 | Tick Stand and Attack, Create, play each animation | Effect shows through all of Stand and Attack, hidden in others. |
| P8 | Create → Undo → Redo | Undo restores the exact prior model (node count, textures, materials); Redo brings it back. |
| P9 | Cancel and Esc | Model unchanged (serialize before/after equal). |
| P10 | Add ribbon flow, Glow Up, Library browsing | Unchanged (existing tests pass). |

Record screenshots of P1, P4, P5 and P6 in the PR. Owner click-through for `ready to test`:
select a vertex on the hand → EMTR → Library → pick any effect → Add to model → Create.

## Blockers and next action

- Ready to test on PR #491. Next: Claude independently reruns QA and the owner clicks through the hand-vertex → EMTR → Library pick → Add to model → Create workflow.
- The placement shape is folded into [contract §12.2](../particle-editor/CONTRACT.md). Claude owns the independent QA verdict; owner acceptance and Warcraft III playback remain pending. No merge or release.
