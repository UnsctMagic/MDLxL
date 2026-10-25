# MDLxL 0.32.0 release

Status: in progress
Owner: Claude release session (local_29a47c5c-87dd-42f1-84cd-e799e845aafb)
Updated: 2026-10-25

## Scope

Merged since 0.31.0: #305 (Quad View toolbar), #306 (find Codex/Claude Code CLIs),
#307 (AI in the background, several jobs at once), #308 (AI drawing tool state),
#309 (themed dropdowns, Russian UV label), #310 (UV Wrapper front framing), #311
(separate MDL/MDX file icons). #301 only recorded 0.31.0 acceptance. Minor bump
because #307 and #311 add features.

## Owner decisions

"Start testing, when it's good pack the new release and fire Garithos" (test, then
release and publish). Real AI checks: gpt-6-luna on low effort, simple prompts only.

## Release files

- Notes: `docs/RELEASE-0.32.0{,-ES,-RU,-ZH-CN}.md`; README title, current-version
  summary and history; `package.json` 0.32.0.
- Guides: only the AI console guide changed (#307 removed "switching tabs pauses the
  AI"). `docs/MDLxL-0.32.0-AI-Guide-*.pdf` are the 0.31.0 PDFs with that one sentence
  replaced in place and the header version stamp removed (the embedded font subset has
  no "2"). The sign-in guide and interface map ship unchanged as their 0.31.0 files;
  `scripts/package.mjs` lists each guide with its own version. The guide generator
  (shots/content/build) is kept outside git in `D:\Claude\MDLxL-gate\guides`.

## Verification

- Source suite 1,968 pass / 0 fail / 13 skipped; compatibility 57 pass.
- Packaged suite (default, all, on the 0.32.0 package): 133 pass, 24 configured skips.
  Not passing: `ai-editor` (known PC-specific), `showcase-effects` (fails the same on
  the 0.31.0 release package), and `paint-tab-camera`, `showcase`, `update-shredder`,
  which pass on 0.31.0 and passed on a rerun of the 0.32.0 package (one-off during the
  long run). The first run hit a full D: drive (ENOSPC); the owner allowed deleting
  the old `updater-live` / `updater-processes` outputs in the release-check and
  release-0.29.0 worktrees (~26 GB). The runner also exited once without a message;
  `SUITE_RESUME=1` finished the rest.
- Real Codex, gpt-6-luna with `model_reasoning_effort = "low"` in the test profile's
  `ai/codex/config.toml`, `test/ai-live-tabs.electron.cjs` with `MDLXL_AI_LIVE_FROM=5`
  (4 simple prompts on three models, jobs side by side): 20/20 checks. The test
  profile signed in with its own `codex login` and was signed out afterwards.
