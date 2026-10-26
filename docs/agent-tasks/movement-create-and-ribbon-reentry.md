# Create animation from Movement; reopen existing ribbons in EMTR

Status: active (contract for Codex; not started)
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

- Base: `origin/main` at `e3839ae3`. Branch: `codex/movement-create-ribbon-reentry`.
- Uncommitted changes: none expected beyond this note.
- Fixtures: any model with several sequences and one or more `RibbonEmitters`
  (the particle-editor tests' fixtures have ribbons).

## Relevant owners

Map rows: "Animation, Movement, keyframes and POSE" and "Particles, emitters,
ribbons and library" in [the project map](../agent-map.md).

- Animations Create: `app/AnimationController.jsx` `addSequence()` (around line
  178) and the `ac-sequence-actions` row; model change in
  `src/sequence-editor.js` `createSequence()`.
- Movement sequence picker: `app/MovementControllerRecomp.jsx`, the
  `Current Sequence` `SidebarSection` (around line 175, `aria-label="Movement current sequence"`).
  It already receives `onEdit`, `onTimelineChange`, `portraitMode`, `disabled`.
  Seeking needs a callback from `App.jsx` (Movement props are assembled near
  `App.jsx` line 1641).
- EMTR opening: `app/App.jsx` `openParticles(id)` (around line 658) sets
  `nodeId` only when the selection is an effect. `app/ParticleEditor.jsx`
  line 56 picks `'On model'` only when `selectedNodeId` is a number, otherwise
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

## Blockers and next action

- None. Next: Codex branches from `origin/main`, implements A then B, opens a PR
  into `main` with `Session: codex <task>` and the click-through list, and
  reports `ready for review; awaiting merge approval`.
- On completion: mark this note completed with the PR and merged revision, and
  remove its row from the README table.
