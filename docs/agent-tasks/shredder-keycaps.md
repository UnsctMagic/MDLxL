# Shredder keycap shortcut reminders

Status: ready for review
Owner / consolidator: Codex continuation of Claude Code’s PR #304
Updated: 2026-10-26

## Goal and completion criteria

- Rework Shredder into a keycap-only reminder mode (owner's request relayed by
  Codex on 2026-10-25): a mouse click on something with a key shows only that key;
  using the key closes it; 5 uses quiet that key for 24 hours, renewed by later
  uses; clicking dismisses only this reminder; settings in the keyboard-controls
  workflow; a plain on/off
  mode with no other gates. Behaviour contract: [docs/SHREDDER.md](../SHREDDER.md).
- Draft PR only; merging and publishing were not authorized.

## Revision and local state

- Branch: `claude/shredder-keycaps`, PR #304 (draft, not merged).
- Codex working copy: `D:\Codex\mdlxl-shredder-keycaps-20261026\source`; continued
  from pushed commit `6780d2b1`. The original Claude checkout is preserved.
- Base: `origin/main` at 2d6ca1e8 (after 0.31.0).
- Fixtures: none (the Electron test writes a demo model to `out/shredder`).

## Findings and decisions

- Decision: built fresh from main rather than on PR #269. That branch's bird,
  sprites, bubble, notebook gates and lessons are all things the owner asked to
  drop; only the click/hotkey detection idea (trusted click with a click count,
  `mdlxl-hotkey-used`, `mdlxl-menu-command`, `directKey`) was carried over.
- Decision: MDLxL has no "Controls" menu. The on/off item is in the Settings menu
  next to "Show pressed keys"; the settings block is on Settings → Keyboard
  Shortcuts. Easy to move if the owner meant another place.
- Decision: "K.E.Y.-style" = the toolbar KEY button's Show pressed keys overlay,
  so the popup reuses its look (dark box, white bold text, `key-appear`).
- Decision (scope clarified 2026-10-25): no blanket exclusions. Code-only
  commands show their Ctrl+Alt+Space code; Citadel Paint's own keys are wired in
  through `data-paint-key` labels and `paintKeyLabel`. The first draft skipped
  both; that was reversed at the owner's request.
- Verified: a held key counts once (`event.repeat`), and each keyboard event is
  counted once (WeakSet), in the Electron test.

## Changes and verification

- Checks: `node --test test/shredder.test.js` (9 pass); `pnpm run build`;
  `test/shredder.electron.cjs` on the hidden desktop (8 checks pass, including a
  code-only button and Citadel Paint); full `pnpm run test:source` (1937 pass)
  and `pnpm test` (57 pass).
- Test tips: `SHREDDER_NO_SHOTS=1` skips the screenshots, which time out on the
  hidden desktop and cost a minute each. In Paint, the demo model needs "New base
  coat" before "Begin painting". A clicked slider keeps focus, and Paint ignores
  keys typed into fields.
- Remaining: owner's hand test of the look and settings; screenshots time out on
  the hidden desktop, so only the "beside the button" one was captured.

## Hotkey pass (2026-10-25, same branch)

- Request: the owner saw the `Ctrl + Alt + Space > A1X` popups and asked for proper
  one- or two-key shortcuts for the whole interface. Existing one- and two-key
  shortcuts stay as they are.
- Done:
  - Every command has a hand-picked key (src/commands.js).
  - On-screen controls get keys from their names, per window
    (src/hotkey-allocation.js, `contextualHotkeyDefaults`). `runShortcut` runs only
    what is on screen.
  - Three-key defaults, including Paint's, became two-key ones.
  - Rules: [docs/HOTKEYS.md](../HOTKEYS.md).
- Checks:
  - `out/hotkey-crawl/crawl.cjs` + `check.mjs` (scratch, not in git): 858 of 950
    control sightings keyed. No codes, no keys longer than two, no clashes inside
    a window.
  - The Shredder Electron test covers Fit = Home and the Material Manager's N and
    Esc.
  - Tests that pressed Ctrl+Shift+S / Ctrl+Shift+V now press F12 / Shift+V.
- Not covered: the Particle Editor, AnimXL and the Texture Library have no
  `data-hotkey` controls at all; giving them keys means adding `data-hotkey`
  there.

## Blockers and next action

- `SHREDDER_TEST_VERSION` is `true` (on by default). Decide before release.
- PR #269 (old bird Shredder) is superseded; close it once the owner agrees.


## Owner-requested refinement (2026-10-26)

- Same visible keycaps and learning threshold; test-default switch stays true.
- Repeated clicks on the same visible reminder preserve its element, animation
  and expiry. Learned shortcuts renew quiet time on every actual use.
- Popup placement avoids neighboring controls and updates for new dialogs,
  scrolling and resizing. A completely packed window hides the popup instead
  of blocking a control.
- Clicking dismisses only the current reminder; it does not permanently mute.
  Existing saved silences can still be restored in Settings; that recovery
  control appears only when needed.
- Particle Editor, AnimXL and Texture Library shortcut coverage stays a
  separate follow-up. No release/default-off decision or merge is authorized.
- Verification: focused source checks 32 pass; full source suite 1,939 pass,
  22 skipped, zero failures; compatibility 57 pass. The catalog-size assertion
  was updated for the four new translated help strings per language.
- The rebuilt renderer and the packaged app both pass the Shredder interaction
  test: repeated-click lifetime, quiet renewal, temporary dismissal, legacy
  silence recovery, newly appearing neighboring button clicks, small-window
  large-popup placement, actual Alt-mouse camera rotation, Fit/Home, Material
  Manager and Paint shortcuts, settings and the menu toggle.
- Review build: `D:\Codex\mdlxl-shredder-keycaps-20261026\review\MDLxL-win32-x64\MDLxL.exe`, separate test profile on D:.
  The original test window has a user model open and must remain untouched.
- Ready for the owner’s visible test. No Warcraft III gameplay test or release.
