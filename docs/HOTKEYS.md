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

    Citadel Paint's keys live in its own key handler
    ([app/PaintStudioLayout.jsx](../app/PaintStudioLayout.jsx)). It handles them
    before the rest of the app does.

  - Patterns:
    - F4–F9 open the workspaces and editors.
    - Ctrl+number opens a Settings page (in tab order).
    - Alt+letter opens a manager.
    - Digits pick a view.
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
    new controls never move an existing shortcut.

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

- Citadel Paint handles its own keys before the rest of the app.
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
- The Particle Editor, AnimXL and the Texture Library have no hotkey-reachable
  controls yet.

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
