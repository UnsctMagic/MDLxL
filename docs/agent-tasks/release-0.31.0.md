# MDLxL 0.31.0 release

Status: in progress
Owner: Claude release session (branch `claude/release-0.31.0`, worktree `.claude/worktrees/release-0.31.0`)
Updated: 2026-10-25

## Owner decisions (given up front, so the run is unattended)

- Wait for the new look (PR #296), merge it once finished and CI passes, then release.
- Approved: merging #296 and the release PR, the LowPolyWorks site notes, publishing (Garithos).
- A new test failure versus 0.30.1: fix it, then release. A late #296: keep waiting.
- Notes in order of importance: AI first, then the new look (VIS keeps the classic MDLVis look), then the rest.
- New PDFs in EN/ES/RU/ZH-CN: AI console guide, AI sign-in guide, map of the new interface.
  Old PDFs in `docs/` are removed (legacy guides are not kept).

## Contents since 0.30.1

#288 (0.30.1 acceptance record), #292 duplicate geoset animations open normally,
#293 live Coords while dragging, #295 Shift+F1/F2 light/dark, #294 UV Live Select
Lines + menu, #297 updater install ping, #298 short texture names, #291 (with #287)
AI console and editor hook, #296 new look (pending).

## Gate note

#297 pings `lowpolyworks-vault…workers.dev/api/events` after a successful update.
The two-cycle updater gate installs private test versions, so their ping must be
kept off the real counter (route it to the loopback fixture in the private copies).
`test/updater-release-gate.cjs` still hard-codes 0.21.x versions and must be
parameterised for the candidate version.

## Progress

- Worktree, fixtures and a pre-run package of main at 932858df built.
- English notes drafted in `docs/RELEASE-0.31.0.md`.
