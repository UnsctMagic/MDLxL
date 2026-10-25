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
- Decision: commands with only a Ctrl+Alt+Space code get no popup (kept from
  the earlier Shredder: a click is faster than a code).
- Verified: a held key counts once (`event.repeat`), and each keyboard event is
  counted once (WeakSet), in the Electron test.

## Changes and verification

- Checks: `node --test test/shredder.test.js` (8 pass); localization tests pass;
  `pnpm run build`; `test/shredder.electron.cjs` on the hidden desktop (6 checks pass);
  full `pnpm run test:source` (1936 pass) and `pnpm test` (57 pass).
- Remaining: owner's hand test of the look and settings; screenshots time out on
  the hidden desktop, so only the "beside the button" one was captured.

## Blockers and next action

- `SHREDDER_TEST_VERSION` is `true` (on by default). Decide before release.
- PR #269 (old bird Shredder) is superseded; close it once the owner agrees.
