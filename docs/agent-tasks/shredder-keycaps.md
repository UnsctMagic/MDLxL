# Shredder keycap shortcut reminders

Status: ready for review; awaiting merge approval. AI shortcut scope remains pending.
Owner / consolidator: Codex continuation of Claude Code’s PR #304
Updated: 2026-10-26

## Goal and completion criteria

- Rework Shredder into a keycap-only reminder mode (owner's request relayed by
  Codex on 2026-10-25): a mouse click on something with a key shows only that key;
  using the key closes it; 5 uses quiet that key for 24 hours, renewed by later
  uses; left-click dismisses this reminder; right-click mutes the shortcut;
  settings and un-muting in the keyboard-controls workflow; a plain on/off mode. Behaviour contract: [docs/SHREDDER.md](../SHREDDER.md).
- Draft PR only; merging and publishing were not authorized.

## Revision and local state

- Branch: `claude/shredder-keycaps`, PR #304 (draft, not merged).
- Current continuation started from Claude's pushed review `1bfb6297`.
  Main `548c1b89` was merged into this same feature branch in `c29171aa`.
  Original checkouts and user-opened test apps are preserved.
- Working task: `D:\Codex\mdlxl-shredder-review-20261026`; its disposable
  source/build/profile are removed after pushing; small verification reports remain.
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

- Keep the accepted timing changes: repeated clicks preserve the visible
  reminder and original expiry; learned shortcuts renew quiet time on use.
- Owner rejected the collision-avoidance placement after the visible test.
  Restore the original position directly above the clicked button (below only
  at the top window edge); other chosen positions stay fixed. Do not search for
  gaps between controls or move the popup into the viewport.
- Left-click dismisses only this reminder. Right-click mutes that shortcut until
  Bring back silenced keys in Settings. Its count updates while Settings is open.
- Keep SHREDDER_TEST_VERSION true. Particle Editor, AnimXL and Texture Library
  shortcut coverage stays a separate follow-up. No merge or release authorized.
- Historical test copy (removed after push): D:\Codex\mdlxl-shredder-keycaps-20261026\revision2\source,
  same claude/shredder-keycaps branch. Both previous test apps have user work
  open; do not replace their files, close them, or reload their windows.
- Verification: 33 focused checks pass; full source suite 1,938 pass, 22 skipped,
  zero failures; compatibility 57 pass. Production build and verified portable
  packaging pass.
- Packaged interaction test passes: Delete centered above its crowded sidebar
  button, same-popup lifetime with a controlled test clock, learned-key renewal,
  left-click dismissal, real right-click mute for Rotate and Paint, un-muting in
  Settings (including live count updates), fixed position settings, Fit/Home,
  Material Manager, global toggle and actual Alt-mouse camera rotation.
- Review build: D:\Codex\mdlxl-shredder-keycaps-20261026\revision2\review\MDLxL-win32-x64\MDLxL.exe.
  Open-Test.ps1 in revision2 launches it with a separate D: test profile.
- Remove the temporary revision2/source checkout after pushing. Continue from
  origin/claude/shredder-keycaps; old user-opened checkouts remain untouched.
- Ready for the owner’s visible test. Warcraft III gameplay was not exercised.

## Review patch for Codex (Claude Code review, 2026-10-26)

Reviewed `5c84c94d` and `91dcc194` against `6780d2b1`. The owner's refinement
is implemented as asked: same-popup timing, renewed quiet time, centered
placement restored, left-click dismiss, right-click mute, live muted count,
three translations, tests and docs. Remaining work, in order:

1. **Merge `origin/main` into this branch (blocking).** The PR is
   `CONFLICTING`, so GitHub has not run CI since `0671762d` (2026-10-25 11:10);
   the hotkey pass and both refinement commits have never passed CI. Conflicts:
   `app/App.jsx`, `app/Hotkeys.jsx`, `src/preferences.js`,
   `test/localization-catalogs.test.js` (recount the three catalog sizes after
   the merge; do not just pick one side). In `Hotkeys.jsx`, keep main's
   translated "Hotkey:" tooltip prefix from `092eb378` together with this
   branch's per-window keys. Push and get PR CI green.
2. **Re-run the hotkey crawl after the merge.** Main gained new controls since
   `2d6ca1e8` (AI console and its reference-model/copy/paste buttons, AI
   settings, MDL/MDX file-icon settings, the Bones chip in the Bones editor's
   top row). Confirm with `out/hotkey-crawl` that they get one- or two-key keys
   from their names in their own window, no codes, no clashes, and that
   `test/hotkey-defaults.test.js` still holds. Update the counts in
   `docs/HOTKEYS.md` and the PR body if they change.
3. **Learned count is not live in Settings (small).** In `app/Shredder.jsx`
   the `used` handler saves through `save()`, which stores the notebook but
   does not dispatch `mdlxl-shredder-notebook`. With Settings open, "Bring back
   learned keys (n)" keeps its old number after a key becomes learned, while
   the muted count does update. Dispatch the event after a use changes
   `quietUntil` (not on every use), so both counts behave the same.
4. **Mute without storage wipes the session's memory (small).** `silence` now
   goes through `updateShredderNotebook`, whose `CHANGED` event makes
   `changed()` reload with `loadShredderNotebook()`. When `localStorage` is
   unavailable that returns an empty notebook, so a right-click mute is lost at
   once and every key learned this session is forgotten. Before this commit the
   in-memory notebook was kept. Keep the running notebook when storage cannot
   be written (for example, apply the update to `notebook.current` first and
   only reload from storage on events from Settings). Add a unit or Electron
   check with storage throwing.

Leave unchanged: `SHREDDER_TEST_VERSION = true`; Particle Editor, AnimXL and
Texture Library coverage as a separate follow-up; the hidden-when-zero "Bring
back silenced keys" button (documented in `docs/SHREDDER.md`). No merge into
`main` or release is authorized. When done: update this note's status, re-run
the focused Shredder tests, full `pnpm run test:source`, `pnpm test`, and the
packaged Shredder check, then report `ready for review; awaiting merge approval`.

## Codex review patch result (2026-10-26)

- Resolved the four main conflicts, preserving AI offscreen rendering, MDL icon
  preferences, per-window shortcut allocation and the translated Hotkey prefix.
  Recounted merged catalogs: Russian 6,396; Spanish 6,408; Chinese 3,595.
- Learned-key quiet-time changes now broadcast the existing notebook event;
  ordinary uses do not. Settings updates its learned count without reopening.
- Storage failures preserve the session notebook. Failed writes cannot reload
  stale storage over a new mute; Settings can restore mutes and learning
  independently even when reads and writes both throw.
- Verification: 27 focused tests; full source 1,971 pass / 22 skipped / zero
  failures; compatibility 57 pass; production build and verified packaging pass.
  Packaged interaction checks pass, including both regression cases, the
  owner's above-button placement, mute/restore, timing and actual mouse rotation.
- Crawl: 930 / 1,022 registered control sightings keyed, no codes, long defaults
  or within-window clashes. MDL/MDX icon controls use their names; Bones keeps
  F4. Paint was audited separately using an MDX800 demo because the old Footman
  fixture is MDX1800. The first crawl's Paint timeouts were fixture limitations;
  the separate Paint crawl completed, followed by a transient profile-file lock
  during cleanup. Audit outputs were written successfully.
- Coverage gap: AI console and connection settings have no shortcut hooks,
  including Attach/reference and connection-copy controls. This contradicts
  the review's assumption that allocation could simply be confirmed. The owner
  was asked whether to add these here or handle them separately; no answer yet.
  This remains an open scope decision, not a newly approved exclusion.
- Preserve test-on flag, original three exclusions and every owner refinement.
  No merge into main, release, installed-app/profile change or new visible app.
- PR CI is checked after pushing; its final result is recorded in the review
  report and PR description. User visible acceptance and Warcraft III gameplay
  are not claimed by these checks.
