# Report a problem

Status: awaiting approval (owner hand test, then "merge")
Owner / consolidator: Claude Code (two Sonnet subagents built the server and app parts)
Updated: 2026-11-16

## Goal and completion criteria

- Owner, 16 Nov 2026: wants to leave Discord; a Report button in MDLxL that cannot be
  abused, collecting messages that are reviewed once a week while the program is
  actively managed. Owner chose LowPolyWorks as the inbox and "Limit it to 20 reports
  a day" (site-wide); per-PC 3 and per-IP 5 a day stay underneath so one sender cannot
  use up the 20.
- Owner, 16 Nov 2026: "I want you to add the name." Optional Name field, 40 characters;
  the server side of that request lives only in LowPolyWorks.
- Done when the owner has hand-tested the button and said "merge" for both repositories.

## Revision and local state

- MDLxL: branch `claude/report-button`, worktree `D:\Claude\MDLxL\.claude\worktrees\report-button`, from main 4aaa1a80.
- LowPolyWorks: branch `claude/report-inbox`, worktree `D:\Claude\LowPolyWorks-report`, commits db2210d5e + 46b8e3fd6 from origin/main 89573c88c.
- Test build: `D:\Claude\MDLxL\TestBuilds\report-button` (`START TEST REPORT.cmd` starts a
  local inbox from the LowPolyWorks worktree on 127.0.0.1:8791 and opens
  `TestBuilds\test-models\TEST REPORT 01.mdx`). Delete `local-inbox.sqlite` there to reset limits.

## Relevant owners

- App: `electron/report.cjs` (Reporter, PC id = SHA-256 of Windows MachineGuid, profile
  `report-id.txt` fallback), IPC `report:status`/`report:send` in `electron/main.cjs`,
  `app/ReportDialog.jsx`, command `reportProblem` in `src/commands.js`, Help menus in
  `electron/menu.cjs` and `app/AppToolbar.jsx`.
- Server: LowPolyWorks `tracker/api/feedback.js`, `tracker/lib/feedback.js`,
  `tracker/migrations/0003_feedback.sql`, Vault owner tab Reports
  (`tracker/vaultofsecrets.js`), contract in `tracker/README.md` "Problem reports".

## Findings and decisions

- Decision: `/api/feedback` on the existing `lowpolyworks-vault` Worker + D1, not a
  Discord webhook or GitHub token (a key inside the app can be extracted).
- Decision: count and insert are one conditional SQL statement; raw IP never stored,
  only a day-keyed HMAC that is cleared after a day; 500 unreviewed reports cap.
- Decision: `MDLXL_REPORT_ENDPOINT` overrides the address only for
  `http://127.0.0.1:<port>/api/feedback`, for local test builds.
- Verified: the subagent's registry path had lost its backslashes (always fell back
  to the profile id); fixed in e73075c9 with a Windows test that fails on the bug.

## Changes and verification

- Checks: `node --test tracker/feedback.test.js` 9/9 and the touched tracker suites
  pass; `node tools/check-project.mjs` passes. MDLxL `test/report.test.js` 7/7, focused
  locale/hotkey/command tests 43/43, `pnpm run test:source` 4042 pass with one
  failure that was fixed and rechecked in its file.
- Packaged hidden click check (16 Nov): Help → Report a problem opens, Send disabled
  when empty, 3 × "Sent.", 4th "Daily limit reached. Try again tomorrow." (server 429
  pc), Cancel closes, no page errors.
- Remaining: Vault Reports tab not clicked in a browser; live Worker not deployed.

## Blockers and next action

- Waiting on the owner's hand test and "merge".
- On merge: push and merge both PRs; deploy the LowPolyWorks Worker with every step
  in its `tracker/README.md` "Problem reports" (migration, deploy, private setup);
  check `GET /api/feedback` with an `MDLxL/x.y.z` User-Agent returns `{"open":true}`.
  The button reaches users with the next MDLxL release.
- Weekly review: read `GET /api/feedback?inbox=1` with `USAGE_READ_TOKEN`
  (LowPolyWorks `.internal/usage-reader.json`), summarize for the owner, then mark the
  reports reviewed with `POST ?inbox=1 {"reviewed":[ids]}`. Set up a weekly scheduled
  task after merge if the owner wants one.
