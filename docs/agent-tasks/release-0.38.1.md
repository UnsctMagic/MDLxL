# MDLxL 0.38.1 hotfix release

Status: Release preparation in progress. No tag or publication yet.
Session: codex 01a1a88f-016d-7483-9ef0-d84ef91e6598
Base: b326c370ac10a4b5458f63f3cf887bbffa7e1f9a (main after PR #553).

## Scope

Package the changes merged since v0.38.0 as 0.38.1. Change only package.json, README version/summary, six new release-note files, and this release handover. LowPolyWorks adds dist/mdlxl/releases/0.38.1.json; all existing posts, including 0.38.0, stay byte-identical. No new PDF guide is needed for this hotfix. Preserve historical guides in the portable package.

Included feature PRs: #539 (French/German), #544 (icons/Select through), #546 (OptimizeXL playback), #549 (UV Zoom), #550 (UV drag performance), #553 (UV Rotate), #554 (unused pivots), #556 (editor/recovery/Showcase performance), #558 (optional game-cache wording). Closeout/documentation PRs are included by ancestry.

## Verification

- Local build and package passed: 1,441 runtime/asset files verified, 55 Electron locales, no redundant dependencies.
- Focused source: 189 pass / 0 fail / 1 existing skip (volume has no 8.3 short names).
- Compatibility: 57 pass / 0 fail / 0 skip.
- Site release-page tests: 9 pass / 0 fail / 0 skip.
- Fifteen affected packaged workflows running on hidden Windows desktop. Results pending.
- FFmpeg corresponding-source ZIP matches the existing official SHA-256 01b14874f33eb3c4f94afe05abb028dc6da29eb12ba419ccb147462fe701091b.

## Approval boundary and next action

The owner requested necessary tests only. docs/TESTING-RULES.md separately requires Claude-led QA/full packaged acceptance before any tag or publication. The owner has been asked to choose targeted Codex verification and publication, or a package prepared for Claude QA. That decision is pending. Do not interpret silence as an exception. Claude Code CLI is unavailable here. No product/test assertions or failure baselines were changed.

After the decision, finish the appropriate portable-update acceptance, open/merge the release PR only within the approved gate, tag its exact approved commit, use the Draft release workflow, verify the CI ZIP/checksum/manifest and companion source, publish the additive site post, then publish the release. Use the compact six-language announcement text, preserving old posts. Archive only eligible shipped Codex sessions after publication. Preserve owner installations/profiles and the permanent test-model collection.

Evidence and disposable work: D:/Codex/mdlxl-hotfix-0.38.1. Remove task-created test packages/profiles/runtimes after use and finished worktrees after push/merge. No Warcraft III gameplay verification.
