# Learn: shortcut reminders

Learn is a mode that teaches keyboard shortcuts. When you click a button (or
a menu entry) for a command with a key, a small popup shows that key, in the look of the
K.E.Y. (Show pressed keys) overlay. The popup contains only the keycaps.

Only commands are taught: the hand-picked keys of menus, the toolbar, modes and
tools ([src/commands.js](../src/commands.js)), and Citadel Paint's own keys. A
window's own buttons (Settings pages, file-icon choices, Material Manager's New)
have keys from their names so the window can be worked from the keyboard; clicking
them shows no popup.

Click **LER** (the Ancient of Lore icon beside **KEY**) for three choices:
**Learn mode** switches reminders, **Show hotkeys** keeps the existing green
shortcut letters visible, and **Learn settings…** opens Keyboard Shortcuts at
the Learn block. Both toggles keep the box open. Click outside, press Esc, or
click LER again to close it. The rows use the existing name-based shortcut allocator.

**Ctrl+J**, **Settings → Learn mode**, and the Learn block switch the same
reminder preference. The LER label glows while Learn mode is on. Learn works
immediately, with no waiting or progress gate. The owner chose to keep LER
hidden in VIS; the classic Settings menu and Ctrl+J remain available there.

**Show hotkeys** is off by default and saved across restarts. It uses the same
green letters and active-control filtering as holding Alt, following focus,
dialogs and detached windows. Releasing Alt leaves persistent letters visible.
When Show hotkeys is off, holding and releasing Alt works as before.

## What decides whether a key shows

- **The mode is on.**
- **You learned that key.** Using a key 5 times quiets its reminders for 24
  hours. Every later successful use restarts that command's quiet period,
  including after it expires. This is per command: learning M (Move) does not
  quiet R (Rotate). **Bring back learned keys** resets learning immediately.
- **You muted that shortcut.** Right-clicking its popup stops its reminders
  until you choose **Bring back silenced keys** in Settings → Keyboard
  Shortcuts. That button appears while any shortcuts are muted. Existing saved
  silences work the same way. Both muted and learned counts update while Settings
  remains open. If browser storage fails, learning and mutes remain available
  for the current app session, including their separate restore controls.

Using the key while its popup is up closes it at once. **Clicking the popup
only dismisses this reminder**; it changes neither learning nor future reminders.
**Right-click mutes that shortcut** until it is restored in Settings.
Clicking the same command again while its reminder is visible does not restart
its animation or extend its original lifetime.

The default popup is centered immediately above the clicked button. It goes
below only when there is no room above, and stays inside the window. Neighboring
controls do not move it into a different gap. Other position settings keep their
fixed locations. There is still only one popup.

The popup shows the command's own key or combination: one key, or one key with
Shift, Ctrl or Alt (see [Keyboard shortcuts](HOTKEYS.md)). A window's extra Close /
Cancel / Done buttons show Esc when Esc closes that window. Pressing the key a
popup shows closes it.

Citadel Paint handles its own keys and shows them on its buttons and sliders
(Color **B**, Save **Ctrl+S**, Brush size **[ ]**). Those carry `data-paint-key`;
a click shows that label, and when Paint runs one of its keys it reports it with
`paintKeyLabel` (in [learn-keycaps.js](../src/learn-keycaps.js)) under the
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
(`preferences.learn`, normalized by `normalizeLearn`):

| Setting | Choices | Default |
| --- | --- | --- |
| Where | Beside what you clicked, Bottom middle, Top middle, Bottom right, Bottom left | Beside what you clicked (menu commands use Bottom middle) |
| Size | Small, Medium (the K.E.Y. size), Large | Medium |
| Look | Standard, Flashing (a few accent flashes; none with reduced motion) | Standard |
| Stays for | 3, 5, 10 seconds, Until used or clicked | 5 seconds |
| Learned after | 3, 5, 10 uses | 5 uses |
| Then quiet for | 1, 8, 24, 72 hours | 24 hours |

## Test version

`LEARN_TEST_VERSION` in [learn-keycaps.js](../src/learn-keycaps.js) is
`false` since 0.33.0: Learn mode ships off by default (owner decision). Set it
to `true` only for a hand-test build.

## Owners and tests

- Rules: [src/learn-keycaps.js](../src/learn-keycaps.js) (DOM-free; notebook
  in browser storage `mdlxl-learn-keycaps-v1`).
- Toolbar box: `AppToolbar` in [app/AppToolbar.jsx](../app/AppToolbar.jsx),
  using the existing `learn` command. Native SD icon:
  `ReplaceableTextures\CommandButtons\BTNAncientOfLore.dds`, converted without
  changing its pixels to [public/classic/btn-ancient-of-lore.png](../public/classic/btn-ancient-of-lore.png).
- Popup and listeners: [app/Learn.jsx](../app/Learn.jsx), [app/learn.css](../app/learn.css).
- Settings block: `LearnSettings` in [app/Settings.jsx](../app/Settings.jsx).
- Menu command `learn`: [src/commands.js](../src/commands.js), [electron/menu.cjs](../electron/menu.cjs), `commands` in [App.jsx](../app/App.jsx).
- [test/learn.test.js](../test/learn.test.js): rules, defaults, damaged notebooks.
- [test/learn.electron.cjs](../test/learn.electron.cjs): the real app — popup
  beside the button, key closes it, five uses quiet one key only, held keys and
  text fields do not count, temporary dismissal, repeated-click timing, renewed
  quiet time, live learned counts, storage read/write failures, right-click
  mute/restore, crowded-sidebar anchoring, mouse camera
  rotation, settings (its own page tabs show no popup), Fit's Home key, the Material Manager's own keys and its footer Close (Esc), Citadel Paint's own keys and
  slider, and turning it off.

## History

Learn replaces an earlier concept; PR #269 is closed.

Saved `preferences.shredder`, custom keys for the former `shredder` command
(including discovered-control IDs), and `mdlxl-shredder-keycaps-v1` notebooks
migrate once to the Learn names. Existing new-name data wins. Old notebook
storage is removed only after the migrated notebook is successfully written;
a failed write preserves the original and the loaded session data.
