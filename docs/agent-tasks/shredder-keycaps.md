# Shredder keycap shortcut reminders

Status: ready for review
Owner / consolidator: Claude Code (session named in the PR)
Updated: 2026-10-25

## Goal and completion criteria

- Rework Shredder into a keycap-only reminder mode (owner's request relayed by
  Codex on 2026-10-25): a mouse click on something with a key shows only that key;
  using the key closes it; 5 uses quiet that key for 24 hours; clicking silences
  it; settings and un-silencing in the keyboard-controls workflow; a plain on/off
  mode with no other gates. Behaviour contract: [docs/SHREDDER.md](../SHREDDER.md).
- Draft PR only; merging and publishing were not authorized.

## Revision and local state

- Branch / checkout: `claude/shredder-keycaps`, worktree `.claude/worktrees/shredder-keycaps`.
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

## Blockers and next action

- `SHREDDER_TEST_VERSION` is `true` (on by default). Decide before release.
- PR #269 (old bird Shredder) is superseded; close it once the owner agrees.
