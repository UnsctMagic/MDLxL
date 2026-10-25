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

- #296 merged (4af766e9) and merged into this branch. Version 0.31.0, notes in four
  languages, README, AI-HOOK wording (AI icon in the dock) committed.
- Source suite on main before #296: 1,933 pass / 0 fail; compatibility 57 pass.
- PDFs: `docs/MDLxL-0.31.0-{AI-Guide,AI-Sign-in,Interface-Map}-{EN,ES,RU,ZH-CN}.pdf`,
  built from `out/guide-shots` (app screenshots per language, `shots.cjs`) and
  `out/guide-shots/pdf/{content,build}.mjs` (HTML -> headless Chrome). The package
  ships these instead of the 0.22.0 manual and Paint guide; old PDFs removed from docs.
- Packaged suite runner: AI tests now get the package (`MDLXL_AI_TEST_EXE`); `ai-live`
  is skipped as an opt-in real-account check.
- Site notes committed on LowPolyWorks branches `claude/mdlxl-0.31.0-notes` (main PR)
  and `claude/gh-pages-mdlxl-0.31.0` (worktrees `D:\Claude\LowPolyWorks-mdlxl-0.31.0`,
  `D:\Claude\LowPolyWorks-pages-0.31.0`); site tests 6/6 and project check pass. Not pushed yet.
- Gate driver: `D:\Claude\MDLxL-gate\driver.cjs` (candidate -> A -> B -> revert, checks
  routed pings). No dirty model, so the save prompt is not shown; the revert confirm is
  answered in memory. Run it on the CI ZIP after the draft build.
- Old GitHub release assets (Paint guide on 0.17.0-0.21.2, 0.22.0 / 0.27.0 / 0.29.0 PDFs)
  are permanent deletions and were left for the owner.
