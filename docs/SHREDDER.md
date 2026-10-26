# Shredder: shortcut reminders

Shredder is a mode that teaches keyboard shortcuts. When you click a button (or
a menu entry) that has a key, a small popup shows that key, in the look of the
K.E.Y. (Show pressed keys) overlay. Nothing else: no text, no bird, no bubble.

Turn it on or off in **Settings → Shortcut reminders** (menu) or in **Settings →
Keyboard Shortcuts → Shortcut reminders**. It works as soon as it is on: there is
no quiet start, waiting, lesson order or progress gate.

## What decides whether a key shows

- **The mode is on.**
- **You learned that key.** Using a key 5 times quiets its reminders for 24
  hours. Every later successful use restarts that command's quiet period,
  including after it expires. This is per command: learning M (Move) does not
  quiet R (Rotate). **Bring back learned keys** resets learning immediately.
- Shortcuts silenced in an earlier test version stay silenced until restored
  with **Bring back silenced keys** in Settings → Keyboard Shortcuts. That
  recovery button appears only while old silences remain.

Using the key while its popup is up closes it at once. **Clicking the popup
only dismisses this reminder**; it changes neither learning nor future reminders.
Clicking the same command again while its reminder is visible does not restart
its animation or extend its original lifetime.

The popup uses the chosen location when clear and otherwise moves to nearby
free space, leaving buttons, labels, fields and sliders unobstructed. Placement
is checked again on scrolling, resizing and added/removed controls. If the
window is entirely packed with controls, the popup stays hidden until space is
available; it must not block a control. There is still only one popup.

The popup shows the command's own key or combination: one key, or one key with
Shift, Ctrl or Alt (see [Keyboard shortcuts](HOTKEYS.md)). A window's extra Close /
Cancel / Done buttons show Esc when Esc closes that window. Pressing the key a
popup shows closes it.

Citadel Paint handles its own keys and shows them on its buttons and sliders
(Color **B**, Save **Ctrl+S**, Brush size **[ ]**). Those carry `data-paint-key`;
a click shows that label, and when Paint runs one of its keys it reports it with
`paintKeyLabel` (in [shredder-keycaps.js](../src/shredder-keycaps.js)) under the
same label, so the same rules apply. Paint keys without a labelled button (Esc,
for example) never show a popup.

## What counts as a use

- Only shortcuts that actually ran: `mdlxl-hotkey-used` from `runShortcut` in
  [Hotkeys.jsx](../app/Hotkeys.jsx), and from Citadel Paint's key handler in
  [PaintStudioLayout.jsx](../app/PaintStudioLayout.jsx). Typing in a text field
  never runs a shortcut, so it never counts.
- One key press counts once, even if it reaches the handler twice, and holding a
  key down (auto-repeat) counts once.
- A click that the hotkey system makes itself, or Enter/Space on a focused
  button, is not a mouse click and shows no popup.

## Settings

All in Settings → Keyboard Shortcuts, below the shortcut table
(`preferences.shredder`, normalized by `normalizeShredder`):

| Setting | Choices | Default |
| --- | --- | --- |
| Where | Beside what you clicked, Bottom middle, Top middle, Bottom right, Bottom left | Beside what you clicked (menu commands use Bottom middle) |
| Size | Small, Medium (the K.E.Y. size), Large | Medium |
| Look | Standard, Flashing (a few accent flashes; none with reduced motion) | Standard |
| Stays for | 3, 5, 10 seconds, Until used or clicked | 5 seconds |
| Learned after | 3, 5, 10 uses | 5 uses |
| Then quiet for | 1, 8, 24, 72 hours | 24 hours |

## Test version

`SHREDDER_TEST_VERSION` in [shredder-keycaps.js](../src/shredder-keycaps.js) is
`true`: the mode is on by default so it can be tried right away. **Decide before
release** whether it ships on or off by default, and set the switch.

## Owners and tests

- Rules: [src/shredder-keycaps.js](../src/shredder-keycaps.js) (DOM-free; notebook
  in browser storage `mdlxl-shredder-keycaps-v1`).
- Popup and listeners: [app/Shredder.jsx](../app/Shredder.jsx), [app/shredder.css](../app/shredder.css).
- Settings block: `ShredderSettings` in [app/Settings.jsx](../app/Settings.jsx).
- Menu command `shredder`: [src/commands.js](../src/commands.js), [electron/menu.cjs](../electron/menu.cjs), `commands` in [App.jsx](../app/App.jsx).
- [test/shredder.test.js](../test/shredder.test.js): rules, defaults, damaged notebooks.
- [test/shredder.electron.cjs](../test/shredder.electron.cjs): the real app — popup
  beside the button, key closes it, five uses quiet one key only, held keys and
  text fields do not count, temporary dismissal, repeated-click timing, renewed
  quiet time, neighboring-control clicks, mouse camera rotation, settings, Fit's
  Home key, the Material
  Manager's own keys and its footer Close (Esc), Citadel Paint's own keys and
  slider, and turning it off.

## History

An earlier Shredder (PR #269, `claude/shredder-tutor`, not merged) was a roaming
bird with speech-bubble tips, a notebook, quiet start and lesson gates. The owner
replaced that concept with this keycap-only mode on 2026-10-25.
