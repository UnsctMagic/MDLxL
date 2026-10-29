# AI-only model references

Status: completed — merged in #371 (0635d566)
Owner: Codex / AI-only model references
Updated: 2026-10-29

## Goal and scope

Models attached to AI chat or opened by AI document/library tools stay available
only to that chat and its birds. They do not create editor tabs or replace the
visible model. Normal model opening, editing, Undo and camera controls remain.
No release, version bump, installed application or real profile changes.

## Revision and owners

- Branch: codex/ai-private-models; base: 8a36f2a1 (includes attachment isolation #370).
- app/App.jsx: separate in-memory references; retain texture URLs; release on
  chip removal or owner closure and cancel pending texture loads.
- app/ai-editor.js: lists, reads, scripts and donor pictures use AI references.
- app/ai-review.js: donor comparisons use the captured chat scope.
- app/AiAssistant.jsx and src/ai-tools.js: remove obsolete tab-opening wording.
- Durable behavior: docs/AI-HOOK.md.

## Verification

- Final focused tests: 24 passed (background access, donor images, library assets).
- Full source: 2,106 passed, 22 skipped, no failures. Compatibility: 57 passed.
- Build/package passed: 1,278 runtime/assets; 55 locale files.
- Packaged hidden-desktop test: all 26 checks passed, zero renderer errors.
  Attachment/AI-opened models without tabs, simultaneous chats, delayed reads,
  background opens, new/earlier chats, removal, direct donor reads, actual donor
  review rendering and actual Alt+mouse camera rotation passed.
- Generated fixtures/local provider only; paid/native providers and real user
  models were not exercised.
- Small evidence: D:/Codex/mdlxl-ai-private-models-20261029. Disposable build and
  test profile removed after verification; source worktree removed after push.

## Next action

Review the PR; merge only with explicit owner approval, then verify merged PR
and online main. Installed application updates require separate authorization.
