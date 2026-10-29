# AI chat attachment isolation

Status: ready for review; awaiting merge approval
Owner / consolidator: Codex / Separate AI chat attachments
Updated: 2026-10-29

## Goal and scope

Keep two model chats independent: donor model chips, draft images/text, provider
context and background-opened donors belong to the originating organiser and its
birds. Preserve the existing console layout, editor tabs, model data and camera.
No version bump, release, merge, installed application or real profile changes.

## Revision and owners

- Branch: `codex/chat-attachment-isolation`, based on `4a96bf98`.
- PR: https://github.com/UnsctMagic/MDLxL/pull/370 (open; awaiting merge approval).
- `app/App.jsx`: mark reference tabs with their owner document and organiser.
- `app/ai-editor.js`: capture that scope with task targets; filter document lists,
  reads and script references; preserve scope for background document/library opens.
- `app/AiAssistant.jsx`: keep drafts by organiser, restore earlier-chat donors,
  capture send context before asynchronous setup and guard late chat updates.
- `test/ai-background.test.js`, `test/ai-attachments.electron.cjs`: regression checks.
- Durable behavior: `docs/AI-HOOK.md`; test routes: `docs/agent-map.md` and
  `scripts/run-packaged-tests.mjs`.

## Verification and next action

- Focused source checks: 36 passed. Full source: 2,102 passed, 22 skipped, no
  failures. Compatibility: 57 passed. Build and package verification passed.
- Hidden-desktop packaged isolation: two simultaneous requests, owner-only donor
  payloads, independent drafts/images, delayed file reads, background opens,
  new-chat isolation, donor removal and actual Alt+mouse camera rotation passed.
- Final packaged run passed all 20 checks, including switching tabs during send
  setup and reopening an earlier chat. No renderer errors. Test apps, profiles
  and packaged runtimes removed; two screenshots and small logs retained.
- Existing `ai-editor.electron.cjs` stopped before editing tests: its generated
  `codex.cmd` launcher is rejected by the unchanged native-executable check
  ("this launcher cannot be run without a shell"). This does not validate the
  full native-sign-in workflow. Local fixture-provider tests use no real account.
- Work and small evidence: `D:\Codex\mdlxl-chat-attachments-20261029`.
- Next: review the attached PR; merge only with explicit owner approval.
