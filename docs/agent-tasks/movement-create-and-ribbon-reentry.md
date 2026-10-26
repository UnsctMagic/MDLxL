# Create animation from Movement; reopen existing ribbons in EMTR

Status: completed — merged in PR #331 (98d5842b), shipped in 0.33.0
Owner / consolidator: Codex (implementer); owner approves merge
Updated: 2026-10-26

## Where this comes from

Discord feedback (HerrDave), accepted by the owner for the next patch:

1. While animating a first-person weapon viewmodel he kept jumping between the
   **Animations** panel and **Movement** just to create new animations. He asked
   for a **Create** button in the Movement toolbox (or at the top of the MdlVis
   view).
2. He could not find a way back into the **Ribbon Editor** for an existing ribbon
   without creating a new ribbon. Today the way back is to select the ribbon and
   press EMTR (or use **Edit effect** in Movement). The owner wants that to be
   simpler.

## Goal and completion criteria

### Part A: Create in Movement

- The Movement toolbox's **Current Sequence** section gets a **Create** button
  next to the sequence dropdown. It works exactly like **Create** in the
  Animations panel: a one-second blank sequence, the same undo label
  (`Create animation sequence`), the same status message, and it switches the
  timeline to the new sequence and seeks to its first frame.
- One way of doing things: move the logic into one shared helper (or pass one
  shared callback down from `App.jsx`) so both buttons call the same code. Do not
  copy `addSequence` into Movement.
- The button sits inside the existing section row. No new toolbar, panel or
  top-of-screen strip. Movement is already shown in the VIS/MdlVis layout
  (`vanilla={visUI}`), so this one placement covers the "MdlVis view" request.
  Check that the row still fits the existing sidebar width in both layouts.
- Hidden in rest pose (the section already is). In portrait mode, follow what
  Animations' Create does for portrait models. If it is not safe there, disable
  it with a tooltip rather than hiding it silently.
- Tooltip: `Make a new blank one-second animation and switch to it.`
- Out of scope: **Create from current**, **Global** and **Delete** stay in
  Animations only. Do not add a hotkey. The hotkey pass (draft PR #304, not on
  `main` yet) owns shortcuts and allows at most two keys per shortcut.

### Part B: Reopen an existing ribbon/effect

- Opening EMTR when the model already has effects (ribbons or particles) and no
  effect is selected must open **On model** with an existing effect chosen,
  not the **Lab** "make a new effect" view. Prefer the first ribbon if there is
  one, otherwise the first effect. The existing effect dropdown in EMTR
  (`Effect ingredient`) then lets the user switch between them. **New** and
  **Library** keep working as they do now.
- A model with no effects still opens in Lab, exactly as today.
- Clicking a ribbon or emitter in the main preview or selecting it and pressing
  EMTR still opens straight on that effect (already works; must not regress).
- Do not add a new button, list or panel for this. The fix is choosing the right
  default when EMTR opens. If you think a visible cue is still needed, propose it
  in the PR and don't build it.

### Not in scope

- No change to how ribbons are created (`Add ribbon`), dragged or sized.
- No change to Lab presets, Library or Glow Up.

## Revision and local state

- Base: latest `origin/main` at `96d45dbb`. Branch: `codex/movement-create-ribbon-reentry`.
- Implementation and matching tests: `7b8862f0`; PR link is recorded below.
- Fixtures: any model with several sequences and one or more `RibbonEmitters`
  (the particle-editor tests' fixtures have ribbons).

## Relevant owners

Map rows: "Animation, Movement, keyframes and POSE" and "Particles, emitters,
ribbons and library" in [the project map](../agent-map.md).

- Shared Create action: `app/sequence-actions.js` `addAnimationSequence()`, used
  by both `app/AnimationController.jsx` and `app/MovementControllerRecomp.jsx`;
  model change remains in `src/sequence-editor.js` `createSequence()`.
- Movement sequence picker: `app/MovementControllerRecomp.jsx`, the
  `Current Sequence` `SidebarSection` (around line 175, `aria-label="Movement current sequence"`).
  It receives `onEdit`, `onTimelineChange`, `portraitMode`, `disabled` and now
  consumes the `onSeek` callback already passed by `App.jsx`. Portrait Create
  follows Animations: it creates an ordinary blank sequence and switches to it.
- EMTR opening: `app/App.jsx` `openParticles(id)` preserves an explicit or
  selected effect, then prefers the first ribbon, then the first effect.
  `app/ParticleEditor.jsx` picks `'On model'` only when `selectedNodeId` is a number, otherwise
  `'Lab'`; `chooseContext` (line 277) shows how On model picks its first effect.
  `effectNodes()` comes from `src/particle-recipes.js`.
- Existing shortcut into an effect: `app/EmitterVisibility.jsx` **Edit effect**
  button (shown in Movement when an effect is selected). Keep it.
- Contract for EMTR behaviour: [particle-editor/CONTRACT.md](../particle-editor/CONTRACT.md);
  read only the sections about opening/context.

## Rules that apply (from AGENTS.md)

- Smallest change in the existing workflow; no new panels/toolbars.
- Reuse the existing control: same label `Create`, same behaviour as Animations.
- Tooltip on anything not obvious.
- Previews keep normal mouse camera rotation (EMTR opened On model too).
- New visible strings go through the existing translation tables; keep the
  translation-count test passing.

## Verification

- Unit/source: extend `test/sequence-editor.test.js` if the helper moves;
  add a case to `test/movement-component.test.js` that the Create button calls
  the shared create and switches sequence. Add a source test for the EMTR
  default: model with ribbons and no selection opens On model on the first
  ribbon; model with no effects opens Lab.
- `pnpm test` and `pnpm run test:source` against
  `.github/known-test-failures.txt`; no baseline widening.
- `pnpm run build`, then the packaged suite (`pnpm run test:packaged`) hidden,
  never on the owner's visible desktop.
- Packaged-app click-through for the owner (`ready to test` list in the PR):
  1. Open a unit model, go to Movement, click **Create**: a new animation
     appears in the dropdown and is selected; Ctrl+Z removes it.
  2. Same in the VIS/MdlVis layout.
  3. Open a model that has a ribbon, select nothing, press EMTR: the existing
     ribbon is shown and editable, with no new ribbon created. Drag-rotate the
     preview with the mouse.
  4. Open a model with no effects, press EMTR: Lab opens as before.

## Implementation and verification result

- Movement has **Create** beside its existing sequence dropdown. Both Create
  buttons use one action with the original transaction sections, undo label,
  success/error notices, one-second duration, timeline switch and first-frame
  seek. Movement pauses playback when seeking, matching Animations. Rest pose
  hides the section; read-only/saving disables Create. The tooltip is translated
  in the existing Russian, Spanish and Chinese catalogs.
- EMTR opening uses the existing `effectNodes()` API and changes only its
  opening selection. No effect is created by opening it. New, Library, Lab,
  explicit selection and existing preview controls retain their owners.
- Passed: 29 focused source tests; `pnpm test` (57 passed);
  `pnpm run test:source` (2,014 passed, 22 skipped, zero failures), with zero
  new failures against the unchanged baseline; `pnpm run build`; pinned FFmpeg
  verification and disposable Windows packaging.
- Passed on the separate hidden Windows desktop:
  `pnpm run test:packaged default movement-create-ribbon-reentry`. The packaged
  regression clicks Create and Ctrl+Z at 1100/1600 px in XL and VIS, verifies
  selected sequence, first frame, paused playback and exact model restoration,
  checks Animations Create and rest-pose exclusion, opens the first existing
  ribbon without selection, switches/reopens the selected particle, checks
  Library/New, and opens Lab for a model without effects. Actual Alt+mouse drags
  rotate both EMTR previews without mutating model data.
- The packaged harness uses the existing compatible-MDX fixture generator and
  waits for EMTR's asynchronous draft-save close before reopening. Source tests
  also cover portrait Create, disabled controls, creation validation errors,
  particle-only models and explicit effect ObjectId 0.
- Remaining: owner click-through on their own models, including portrait mode
  in the packaged app and main-preview effect picking. No Warcraft III gameplay
  verification is claimed. The installed app and real profiles were untouched.

## Blockers and next action

- No implementation blockers. PR: [#331](https://github.com/UnsctMagic/MDLxL/pull/331), into `main`.
- Stop at `ready for review; awaiting merge approval`. No merge, release or
  installed-app upgrade is authorized by this task.
- After an authorized merge, record the merged revision, mark this note
  completed and remove its row from the README table. Keep it current until then.
