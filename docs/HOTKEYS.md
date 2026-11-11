# Keyboard shortcuts

Every command and button default must use **one key, or one key
with Shift, Ctrl or Alt**. Nothing longer. Current coverage gaps are listed below. The owner asked for this on
2026-10-25: one-key and two-key shortcuts stayed as they were, and everything
else got a proper short key. Generated Ctrl+Alt+Space codes are no longer handed
out. A code the user typed in themselves still works.

## Shortcut labels

Held-Alt and Show hotkeys use the same transparent green labels, with a sharp
dark text shadow for contrast. Labels retain the complete chord: for example
`Ctrl+J`, `Shift+K`, `Shift+Home`. On narrow icons a chord wraps before `+`
without dropping a modifier or its key. Existing single-key aliases such as
DEL, ESC and arrow glyphs also work inside chords.

Labels are drawn in the browser's top layer while remaining attached to their
original control, so an icon's clipping cannot cut them off. They have no box,
border, or mouse hit area and do not change control sizes or icon frames.
Position and visibility follow resize, scroll, active dialogs and detached
windows. A control fully outside its scroll area gets no floating label.

Owners: [hotkey-badge.js](../src/hotkey-badge.js), the existing hint effect in
[Hotkeys.jsx](../app/Hotkeys.jsx), and [settings.css](../app/settings.css).
Verification: [readable labels](../test/hotkey-badges.test.js) and
[packaged rendering/input](../test/hotkey-badges.electron.cjs).

## Where the keys come from

- **Commands** (menus, toolbar, modes; [src/commands.js](../src/commands.js)) have
  hand-picked keys. They are unique wherever they can fire: the editor, Forge's
  shape tools (`forge-shapes`) and Citadel Paint (`paint`).
  - Original MDLVis keys are unchanged.
  - H, K, Ctrl+X and Ctrl+B stay free in the editor, as in MDLVis.
  - Alt+F and Alt+E open the File and Edit menus.
  - Three-key defaults became two-key ones:

    | Command | Was | Now |
    | --- | --- | --- |
    | Save as | Ctrl+Shift+S | F12 |
    | Paste special | Ctrl+Shift+V | Shift+V |
    | Redo | also Ctrl+Shift+Z | Ctrl+Y only |
    | Peon | Ctrl+Alt+P | Shift+P |
    | Wisp | Ctrl+Alt+I | Shift+I |
    | Paint: Cut patch | Ctrl+Shift+C | Alt+X |
    | Paint: Copy texture | Ctrl+Alt+C | Alt+C |
    | Paint: Paste texture | Ctrl+Alt+V | Alt+V |
    | Paint: Import image | Ctrl+Shift+O | Alt+O |

    Citadel Paint keeps its keycap renderer; its plain keys use the same catalog. V is Symmetry.

  - Patterns:
    - F4–F9 open the workspaces and editors.
    - Ctrl+number opens a Settings page (in tab order).
    - Alt+letter opens a manager.
    - Digits pick a view.
    - Shift+Space toggles Animated in the Vertex editor. The viewport freezes at the chosen sequence's first frame by default. Right-click Animated and enter a timeline frame to change the preview. Vertex edits still go to the base pose.
    - Alt+digits toggle the grids.
- **On-screen controls** (anything with `data-hotkey`) get a key from their name,
  chosen within their own window ([src/hotkey-allocation.js](../src/hotkey-allocation.js),
  `contextualHotkeyDefaults` in [src/hotkey-defaults.js](../src/hotkey-defaults.js)).
  - A window is the editor, a modal dialog, or one page of a tabbed dialog
    (Settings). `controlWindow` in [app/Hotkeys.jsx](../app/Hotkeys.jsx) records
    it when the control is first seen.
  - Inside a window, a key goes to:
    1. the initials of the control's name;
    2. the other letters of its name;
    3. then other letters and digits;
    4. each alone before Shift+.
  - Buttons get the best keys, then tabs, switches, lists, fields and section
    toggles.
  - The window's close button gets Esc. Its other Close / Cancel / Done buttons
    have no key of their own.
  - Controls that exist once per item (each geoset row, each list entry) get
    none.
  - The editor's own controls, and windows that show the editor's tools (Forge,
    the shaping tools), avoid every command key. They may also use Alt+, Ctrl+
    and F keys.
  - A key, once given, is saved with the discovered controls (`defaultKey`), so
    new controls never move an existing shortcut. A key the user assigns only
    moves a saved key where both can fire; assigning N in the editor leaves New
    in the Material Manager alone.
  - A non-modal panel (`aria-modal="false"`: Add-ons, Glow Up, NormalsXL) sits
    over the working editor, so its keys avoid the commands, like Forge. It
    keeps Esc for its Close.
- **Manual controls** (`data-hotkey-manual`, with `data-hotkey-label`) get **no
  default key**. Settings lists them and the user can bind them. Their window
  sets the Settings category. Every one is in the generated
  [src/hotkey-manifest.json](../src/hotkey-manifest.json), so a window never
  opened on this PC can still be bound. After adding one, run
  `node scripts/hotkey-manifest.mjs`; the id's first segment must be listed in
  `MANUAL_WINDOWS` there.
- `Search commands` (Ctrl+F2) and `Next toolbar style` (Shift+F3) are new
  commands. Both keys sit outside the automatic pool, so adding them moved no
  existing default.

Tool-window keys come from the catalog, including local Undo/Redo/Play and Paint’s plain keys. Window actions follow the user’s command bindings until rebound separately, so Settings, badges and Learn agree. Escape closes every tool window after its active inner state is cancelled. AI drawing tools, Learn, bone creation and shortcut recording keep their Escape order through claims; the generic `mdlxl-window-key` event carries `detail.scope` and `detail.event`. Active drags claim at priority 0, after the menus and before window-local dismissal (priority 10), so the first Escape restores the drag and a later Escape dismisses its window.

A window holding work that closing would discard sets `data-hotkey-unapplied` (`unapplied` on `ToolWindow`). Its close key then shows `Press Esc again to discard.`, and the second press within four seconds closes it; any other key or a click starts over. The × button still closes at once, and a window with nothing unapplied closes on one Esc. Each window decides from its own state:

| Window | Unapplied when |
| --- | --- |
| AnimXL | the settings produce shaped tracks that are not committed, and the model is not read-only |
| Auto Corpse | Size, Height, colour, pieces or blood were changed (`changed`) |
| Attachemator | a point was dragged, given another bone, or a tick differs from the proposal |
| Bone Namer | a part, side, actor or tick differs from the proposal; direct Close/× clicks also ask before discarding |
| Surface Effects | a part's effect stack differs from how that part was first shown |
| Sort My Mess | any group has a chosen change (`selected`) |
| Forge | the mask has edits, or Shape has at least one shape |
| Shaping | history exists, or any setting differs from when it opened |

## Keys on any keyboard

`layoutKey` in [src/preferences.js](../src/preferences.js) decides what a press means. A Latin letter is the letter printed on the key, so Ctrl+Z is Undo on QWERTZ and AZERTY. Digit-row keys are digits even where the layout needs Shift for them. Russian and other non-Latin layouts use the key's position for letters, and for `, . - = \` [ ]`, where it types a non-ASCII letter. Hold-A selection and Forge and texture-fit tool keys read the same value.

With a closed dropdown, slider or colour swatch focused, only its navigation keys (arrows, Home, End, PageUp, PageDown, Enter, Space) stay with it; every other key still runs. A control scrolled out of its panel does not fire; a field still takes focus. After a tapped Alt, the next key means Alt+key or nothing.

## The same key in different windows

A letter can mean different things in different windows. N is Show normals in
the editor and New in the Material Manager. `runShortcut` in
[app/Hotkeys.jsx](../app/Hotkeys.jsx) runs only what is on screen in the active
window:

- a visible, enabled control with that key;
- or a command that can run there.

If two would fire, it does nothing. A control on screen beats a command that
merely could run. In Settings, `hotkeyConflicts` only reports keys that can fire
together.

## Workspaces that own keys first

- Citadel Paint’s catalog actions take priority over mesh commands in Paint.
- Forge's shape tools win inside Forge.
- The focused UV editor owns the number pad, even when nothing is selected.
  Numpad keys there never reach digit shortcuts such as 6 (Team color) or
  Ctrl+6 (Appearance settings).

## Tests

- [test/hotkey-defaults.test.js](../test/hotkey-defaults.test.js) checks:
  - command keys;
  - window keys from names;
  - stability;
  - the editor's reserved keys;
  - Forge.
- [test/learn.electron.cjs](../test/learn.electron.cjs) checks, in the real
  app:
  - Fit is Home;
  - in the Material Manager, N is New and Esc closes it.
- The 2026-10-26 crawl after merging main inspected 1,032 registered control
  sightings; 940 had keys, with no generated codes, keys longer than two, or
  clashes within a window. The remainder are extra Close / Done / Cancel
  buttons and per-item rows. It used the existing Footman for editor/windows
  and an MDX800 demo for Paint (the Footman is MDX1800, unsupported by Paint).
  The new MDL/MDX icon choices use letters from their names; Bones keeps F4.
  Scratch scripts and audit evidence are in the D: review task's report.
- [test/hotkey-default-overlaps.test.js](../test/hotkey-default-overlaps.test.js)
  is the permanent guard, driven by the real command table, Paint's real key
  table, the window sources and the allocator: no overlap in a scope, nothing
  over two keys, reserved keys free, and the manifest up to date.
  [test/hotkey-layouts.test.js](../test/hotkey-layouts.test.js) covers QWERTY,
  QWERTZ, AZERTY and Russian event shapes.
  [test/hotkey-defaults-audit.electron.cjs](../test/hotkey-defaults-audit.electron.cjs)
  opens every window and checks the keys the running app hands out.
- The Particle Editor, AnimXL, the Texture Library and the other windows in
  `MANUAL_WINDOWS` keep few default keys; the rest of their primary controls
  are manual, so users can bind them.

- [AI console interaction test](../test/ai-hotkeys.electron.cjs) separately
  audits 101 keyed control sightings across the console, API/native settings,
  reference attachment and palette. All keys come from names, with no long
  defaults or clashes. It also checks compact layout, typing/copy/paste, sending,
  reference removal, settings, cleanup and focus changes between AI/Paint/editor.
- The docked AI console is its own shortcut window while focus is inside it
  (click a console control or its background). Clicking the model editor gives
  its keys back. Prompt and connection fields keep native typing and clipboard
  keys; Enter still sends. A modal takes precedence over the console. Tooltips
  and Learn teach the keys without adding permanent badges to its controls.
  Repeated chat/history entries retain the existing per-item policy.

## Mouse drag keys and keys during a drag

- [modifier-bindings.js](../src/modifier-bindings.js) is the table of what Shift, Ctrl and Alt mean during a mouse drag. `preferences.modifiers` holds only changes; a value is Shift, Ctrl, Alt or none. Inside one scope a key has one meaning; Settings refuses a clash until Replace. `modifierRows` feeds the "Mouse drag keys" rows, and the same values travel in a Hotkeys preset.
- Drag code reads `modifierHeld`, `dragKeys` or `selectionKeys`, never `event.shiftKey` for a table meaning. Tooltips use `modifierSentence` so they name the current key.
- [gesture-keys.js](../app/gesture-keys.js): while a mouse drag is live only modifier keys and Esc act. Each drag owner answers the window-key claim at priority 0 with `holdGestureKey`. Camera moves keep the keyboard. Alt pressed during a drag arms nothing, shows no key hints and does not open the menu bar. Paint keeps its brush and stamp keys during a stroke. Forge's Shape tab keeps Undo and Redo: there they cancel the live drag and edit nothing.
- Snap keys: held from before the mouse press, a snap key keeps its old meaning and waits for one release, in every editor. Pressing or letting go of the key alone redraws the drag.
- Keys that stay fixed on purpose: list ranges (Shift, Ctrl), timeline and AnimXL section Shift, Forge part snap, camera Shift speed and Shift+wheel, arrow nudges, Paint's Alt+middle and Alt+right camera drags and Ctrl+right brush drag, Paint Cut-out's own table.
