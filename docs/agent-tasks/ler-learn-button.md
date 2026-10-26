# LER button: Learn menu

Status: Claude review (2026-10-26) found one actionable issue; back to Codex; not merged. See "Claude review: changes required" at the end.
Follow-up PR: [#325](https://github.com/UnsctMagic/MDLxL/pull/325) (draft, same branch; not merged)
Owner / consolidator: Codex; written by Claude Code
Updated: 2026-10-26

## Goal and completion criteria

The owner's request (2026-10-26): clicking **LER** no longer just switches
reminders on or off. It opens a small, elegant box with three choices:

1. **Learn mode** (on/off). This is today's Shredder, renamed: clicking a
   button that has a key shows that key ([behaviour contract](../LEARN.md)).
2. **Show hotkeys** (on/off). Keeps the green key letters on every button
   visible until switched off. Today they only show while a key is held.
3. **Learn settings…**. Opens Settings → Keyboard Shortcuts straight at the
   Learn block (today's "Shortcut reminders" block).

Done means:

- **Box.** LER opens a small box anchored under the LER icon. It has the look
  of the toolbar's icon dock ([TOOLBAR-DOCK.md](../TOOLBAR-DOCK.md)): the same
  dark WC3 feel, the dock's bold Oxanium label font, LER's lemon `#f2e35c` as
  its accent, theme variables, no new game look. Three rows, nothing else: no
  heading, no help text, no icons beyond what the rows need. The two on/off
  rows show their state with a tick or a lit label. *"The style of the icon
  menu" is read as "the style of the icon dock"; ask the owner if the first
  screenshot misses.*
- **Behaviour.** Reuse the existing small anchored popups (for example
  Movement's Create menu, `bone-create-anchor` in
  [MovementControllerRecomp.jsx](../../app/MovementControllerRecomp.jsx)):
  click outside or Esc closes it, clicking LER again closes it. Choosing an
  on/off row switches it and keeps the box open so both can be set; choosing
  **Learn settings…** closes the box and opens Settings. The rows get keys from
  the existing name allocator like every other control; no hand-made keys.
- **LER icon state.** The label glows (existing switched-on look) while Learn
  mode is on, as now. Ctrl+J still switches Learn mode without opening the box.
- **Show hotkeys.** Uses the exact display the held key uses today
  (`data-shortcut-hints` in [Hotkeys.jsx](../../app/Hotkeys.jsx) and
  [settings.css](../../app/settings.css)), including which buttons count as
  available in the active window or dialog. While switched on it must follow
  focus, opened and closed dialogs and detached windows (recompute what the
  held-key path computes once on keydown). Holding the key while it is on
  changes nothing; releasing the key does not hide the letters. It is saved as
  a preference and survives a restart. Off by default. The held-key behaviour
  stays exactly as it is when this is off.
  *Note:* the code reveals the letters while **Alt** is held (Shift doesn't
  matter); the owner described it as Alt+Shift. Don't change the hold key.
- **Rename Shredder to Learn**, everywhere a user can see it and in the code:
  - Words: menu item, command name, tooltip, Settings heading, docs, the three
    translations (recount catalog sizes in
    [localization-catalogs.test.js](../../test/localization-catalogs.test.js)).
    "Shortcut reminders" becomes "Learn mode"; the settings block is "Learn".
  - Code: `src/shredder-keycaps.js`, `app/Shredder.jsx`, `app/shredder.css`,
    tests, the `shredder` command id and `preferences.shredder` become
    `learn` names. `SHREDDER_TEST_VERSION` becomes `LEARN_TEST_VERSION` and
    stays `true`.
  - Migrate, don't lose: saved `preferences.shredder`, a customised key for the
    old `shredder` command, and the notebook in `mdlxl-shredder-keycaps-v1`
    (learned and muted keys) carry over once to the new names.
  - [docs/SHREDDER.md](../LEARN.md) becomes `docs/LEARN.md`; update links in
    [HOTKEYS.md](../HOTKEYS.md), [AI-HOOK.md](../AI-HOOK.md),
    [agent-map.md](../agent-map.md) and the packaged test list in
    [run-packaged-tests.mjs](../../scripts/run-packaged-tests.mjs).
- **Bird concept removed.** Close PR #269 (`claude/shredder-tutor`, the old
  bird tutor) with a short comment that the owner dropped the concept, and
  delete that remote branch. Remove bird/bubble/tutor wording from the Learn
  docs' History section (one line saying it replaced an earlier concept is
  enough). **Do not touch** `app/UpdateShredder.jsx` / `UpdateShredder.css`:
  that is the update-download animation shipped since PR #132, a different
  feature.
- Out of scope: popup placement, timing, learning and muting rules (keep every
  owner refinement in [shredder-keycaps.md](shredder-keycaps.md)); the
  Particle Editor / AnimXL / Texture Library key coverage; any other dock icon.

## Revision and local state

- Started from `claude/shredder-keycaps` at `2c2d2457`. GitHub confirms PR #304
  was already merged as `a4c86621` on 2026-10-26; the original contract's open-PR
  assumption was stale. Main was merged into this branch in `2f363304`.
- Branch: continue `claude/shredder-keycaps`. The owner explicitly approved
  a follow-up PR from this same branch and updating #304's description.
- No fixtures needed beyond the existing Shredder Electron test's demo model.

## Relevant owners

- LER `Tool` in the dock: [AppToolbar.jsx](../../app/AppToolbar.jsx) line ~48
  (`className="learner-tool"`, `active={preferences.shredder.enabled}`).
- Command and key: [commands.js](../../src/commands.js) (`shredder`, Ctrl+J),
  [electron/menu.cjs](../../electron/menu.cjs), `commands` in
  [App.jsx](../../app/App.jsx).
- Held-key letters: second `useEffect` near the end of
  [Hotkeys.jsx](../../app/Hotkeys.jsx) (`reveal` / `dismiss`).
- Settings block: `ShredderSettings` in [Settings.jsx](../../app/Settings.jsx);
  Settings opens through `settingsTab` / the `hotkeys` command in App.jsx.
- Preferences: [preferences.js](../../src/preferences.js) (`shredder:
  DEFAULT_SHREDDER`, `normalizeShredder`).
- Dock rules and tests: [TOOLBAR-DOCK.md](../TOOLBAR-DOCK.md),
  [module-button-labels.test.js](../../test/module-button-labels.test.js),
  [module-button-labels.browser.cjs](../../test/module-button-labels.browser.cjs).
- Map row: Shredder / hotkeys in [agent-map.md](../agent-map.md).

## Verification required

- Source tests: rename `test/shredder.test.js`; add checks for the preference
  and notebook migration (old saved data comes through, damaged data still
  normalises) and for the Show hotkeys preference default and round trip.
- Packaged app on a hidden desktop (never pop windows on the owner's screen):
  - LER opens the box under the icon; Esc, click outside and LER close it.
  - Learn mode row switches reminders and the LER glow; Ctrl+J does the same
    without the box.
  - Show hotkeys row: letters stay visible with no key held, follow opening and
    closing a dialog and a detached window, survive a restart, and go away
    when switched off; holding Alt with it off still works as before.
  - Learn settings… lands on Keyboard Shortcuts with the Learn block in view.
  - A profile with old Shredder settings, learned and muted keys keeps them.
  - Re-run the existing Shredder packaged checks under the new name.
  - Mouse camera rotation in the preview still works (real drag) with the box
    closed and with Show hotkeys on.
- Screenshot of the box open (new look) for the owner; check it at 1100 and
  1920 widths. Owner refinement during implementation (2026-10-26): **keep
  LER hidden in VIS**. Preserve the current hide rule; verify the icon and box
  remain hidden there instead of exposing a new VIS control. New-look box CSS
  remains scoped away from VIS.
- `pnpm test`, `pnpm run test:source`, `pnpm run build`, PR CI green.
- Update PR #304's description (`Session:` lines kept, add `Session: codex
  <task>`), report `ready to test` with a short click-through for the owner.
  No merge or release without the owner's word.

## Result (2026-10-26)

- Continued `claude/shredder-keycaps`; no new branch. Main was merged first.
  Implementation: `d1ccec9a`; follow-up [PR #325](https://github.com/UnsctMagic/MDLxL/pull/325).
  Since #304 had already merged, the owner approved a follow-up PR from this
  branch. #304's description is also updated, with existing Session lines retained.
- LER opens exactly three rows, anchored under its icon. The box reuses the
  dock's slate, bold Oxanium and lemon accent. Toggles keep it open; LER,
  outside clicks and Esc close it. Ctrl+J remains the Learn-mode toggle.
  Learn settings opens Keyboard Shortcuts and scrolls the Learn block into view.
- Show hotkeys defaults off, persists, and reuses held-Alt availability and
  display, refreshing for focus, dialogs and detached roots. Alt release does
  not hide persistent letters. With the preference off, held Alt is unchanged.
- Renamed the keycap feature and its owners/tests to Learn. Preferences,
  custom command/control keys and learned/muted notebook records migrate once;
  current names win. Failed storage writes retain old saved data and session
  memory. `LEARN_TEST_VERSION` remains true.
- Preserved every owner refinement in [the historical note](shredder-keycaps.md):
  original above-button placement, fixed alternative positions, stable popup
  lifetime, renewed quiet time, left-click dismiss, right-click mute, independent
  restore controls, live counts, Paint keys, AI routing and the three excluded
  editors. UpdateShredder and every other dock icon are unchanged.
- Owner's current VIS decision overrides the earlier screenshot clause: **LER
  stays hidden in VIS**. Its hide rule was not changed. New box styling is scoped
  to the new look.
- PR #269 is closed with the requested explanation. Its remote branch was
  verified against that PR's head and deleted.
- Local verification: 28 focused tests; full source 1,977 pass / 22 skipped /
  zero failures; compatibility 57 pass; production build and portable package
  verification (1,216 runtime/assets) pass. Catalog sizes: RU 6,401 / ES 6,413 /
  ZH 3,600.
- Hidden packaged tests: renamed Learn regression passes (including original
  timing, mutes/learning, live counts, storage failures, Paint, Material Manager
  and actual camera drag). New Learn-menu test passes migration from an old
  profile, customized command keys, actual learned/muted suppression, all three
  close paths, allocator keys, 1100/1920 placement and readable dock styling,
  settings target, Alt behavior, dialog and detached-root focus changes, restart
  persistence, VIS hiding, and real camera drags with Show hotkeys off and on.
  Module-label browser checks pass. No window was opened on the owner's desktop.
- The box uses the existing local-window shortcut boundary and takes focus when
  opened. Esc closes it before editor selection or Paint can consume the key;
  Paint's ordinary keys resume after it closes. The packaged Paint regression
  also presses the box's allocated Show hotkeys key in Paint and closes with Esc.
- Additional AI shortcut audit stops on the pre-existing unkeyed **Editing
  handbook** control. `origin/main:app/AiAssistant.jsx` has that same control
  without `data-hotkey`; the owning file is unchanged. This is outside this
  contract, not a passing check or a new Learn regression.
- Two final box captures and verification logs are kept in
  `D:\Codex\mdlxl-learn-menu-20261026`; disposable packaged apps and test profiles
  were removed after verification. Existing user checkouts/apps/profiles were
  untouched. No version bump, merge or release. Owner visual acceptance remains.

## Next action

- Owner click-through: LER → Learn mode / Show hotkeys / Learn settings;
  try Ctrl+J, close the box with Esc or an outside click, rotate the preview,
  open and close a dialog, restart, then check VIS still hides LER.

## Owner test refinement: readable shortcut labels (2026-10-26)

- Owner found multi-part shortcuts cropped on icons and surrounded by white
  boxes. Fixed the shared badge rendering on this same branch / PR #325.
- Removed the special long-label box and negative top offset. Complete compact
  chords use existing key aliases and wrap on narrow controls. All labels share
  transparent styling, 11px bold green text and a sharp dark contrast shadow.
- Existing badge spans use manual top-layer rendering to escape icon/container
  clipping; no new panel, setting, key assignment or control size. Corrected the
  new-look icon-content hide rule to exclude badges. Existing held-Alt and
  persistent availability rules remain; labels follow scroll/resize, dialogs
  and detached roots and never take mouse input.
- Required existing main update was merged first, retaining the AI idle-lag fix.
  Original visible test / model / profile remain untouched in
  `D:\Codex\mdlxl-learn-menu-20261026`; refinement work is isolated in
  `D:\Codex\mdlxl-hotkey-badges-20261026`.
- Hidden packaged badge, Learn-menu and dock checks pass at 1100/1920, including
  full text bounds, actual rendered visibility, zero box/border, unchanged dock
  geometry, clipped scrolling, modal availability, persistence, detached roots,
  normal Alt dismissal and real mouse camera rotation. Full source: 1,978 pass /
  22 skipped / zero failures; compatibility: 57 pass; focused: 18 pass. Production
  build and verified portable package (1,216 runtime/assets) pass. PR CI is
  checked on the final pushed revision. Owner visible acceptance remains pending.
- Existing Forge shortcut packaged regression also passes: held-Alt visibility,
  custom key assignments, normal/quad-view mouse rotation, editing and undo.

## Claude review: changes required (2026-10-26)

Reviewed head `02283e3e` (CI run 40343931617 green) across all five areas. Not
merged because of one actionable issue. Everything else checked out; do not
redesign it.

### Finding: Show hotkeys re-measures every label ~30 times a second during playback

- Where: [Hotkeys.jsx](../../app/Hotkeys.jsx) persistent-hint effect. The
  observer at line ~297 watches `style` and `class` on the **whole app**
  subtree (line ~309), and every record runs `update()` (line ~254).
  `update()` loops all `.hotkey-control` elements twice, calls `visible()`
  (`getClientRects` + `getComputedStyle`) on each, then `hintRect()` walks
  every badge's ancestors with `getComputedStyle` and `getBoundingClientRect`,
  which forces a layout after each DOM change.
- Why it fires during playback: [Viewport.jsx:834](../../app/Viewport.jsx)
  reports the frame every 32 ms, App re-renders, and the timeline cursor's
  inline `style.left` changes ([KeyframeTimeline.jsx:246](../../app/KeyframeTimeline.jsx)).
  That one style record triggers the full scan. The discovery pass's
  `classList.add('hotkey-control')` can also queue `class` records after any
  render that adds/removes children. With Show hotkeys **off** none of this runs
  (held Alt only), so the cost is new and only reached when the owner turns it on.
- Not covered: the packaged checks measured camera drags but no animation
  playback with Show hotkeys on. Owner rule: measure real playback speed, not stills.
- Claude could not measure it: running a probe on the hidden desktop was
  refused by this session's permission check. The probe is left in the checkout
  at `out/claude-review/playback-cost.cjs` (untracked). It opens the demo model
  in the verified package, starts playback in Movement and logs fps, worst frame
  and `getBoundingClientRect` calls per second for Show hotkeys off and on.

### Expected behaviour

Playback, scrubbing and camera drags run as smoothly with Show hotkeys on as
off (no measurable fps drop, no long frames). Labels still follow focus,
dialogs, detached windows, scroll and resize exactly as now.

### Suggested narrow fix (Codex's choice; keep the display unchanged)

Ignore mutation records that cannot change what the labels show, for example
attribute records whose target neither is nor contains a `.hotkey-control`
(the reel cursor contains none), and records caused by the badges themselves.
Optionally batch to one `requestAnimationFrame` instead of a microtask. Do not
change the held-Alt path, the label look, or availability rules.

### Required checks

- Run the probe (or an equivalent packaged test) on the hidden desktop: fps and
  worst frame with Show hotkeys off vs on while playing, default and
  `slow-cpu` variants. Record the numbers here.
- Re-run hidden packaged `hotkey-badges`, `learn-menu`, `learn` and the Forge
  shortcut test; confirm labels still update when a dialog opens/closes, a
  detached window takes focus, and a scrolled list moves.
- Full source suite, compatibility tests, build; CI green on the new head.

### Checked and fine (no change needed)

- LER box: three rows only; LER/outside click/Esc close; toggles keep it open;
  allocator keys; Ctrl+J and hotkey-driven (untrusted) LER clicks still toggle
  Learn mode; Learn settings opens Keyboard Shortcuts and scrolls to `#learn-settings`;
  VIS keeps LER hidden; new-look styling scoped away from VIS.
- Migration: `preferences.shredder` -> `learn` (new name wins), the
  `shredder` id segment in custom keys, notebook `mdlxl-shredder-keycaps-v1`
  copied once with the original kept on write failure; config import migrates too.
- Learn.jsx / learn-keycaps.js are a pure rename of Shredder apart from the
  migration; timing, placement, learning, muting and recovery are unchanged.
- Labels: complete chords via `hotkeyHint`, `<wbr>` wrap at `+`, transparent,
  no border, `pointer-events:none`, manual top layer, control sizes untouched.
- UpdateShredder untouched.
