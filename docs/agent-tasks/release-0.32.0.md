# MDLxL 0.32.0 release

Status: completed
Owner: Claude release session (local_29a47c5c-87dd-42f1-84cd-e799e845aafb)
Updated: 2026-10-25

## Result

- Published [MDLxL 0.32.0](https://github.com/UnsctMagic/MDLxL/releases/tag/v0.32.0)
  on 2026-10-25 22:47 UTC from tag v0.32.0 (merge 5e19b08a of release PR #312).
  Garithos workflow run 40241799361 succeeded.
- Public ZIP sha256 70c6ce33…d862 (208,468,004 bytes), matching the checked draft.
  Assets: the four 0.32.0 AI guides, the unchanged 0.31.0 sign-in guides and
  interface maps, and the reused FFmpeg source ZIP (`electron/ffmpeg/` unchanged).
- Notes live on the MDLxL page via LowPolyWorks #41 (main) and gh-pages 4b9e0579.
- The updater release gate was not run: the owner stopped it ("updates work").
- Sessions of the shipped PRs were already archived. The release worktree is kept as
  the fixture source for the next packaged-test run.

## Scope

Merged since 0.31.0: #305 (Quad View toolbar), #306 (find Codex/Claude Code CLIs),
#307 (AI in the background, several jobs at once), #308 (AI drawing tool state),
#309 (themed dropdowns, Russian UV label), #310 (UV Wrapper front framing), #311
(separate MDL/MDX file icons). #301 only recorded 0.31.0 acceptance. Minor bump
because #307 and #311 add features.

## Owner decisions

"Start testing, when it's good pack the new release and fire Garithos" (test, then
release and publish). Real AI checks: gpt-6-luna on low effort, simple prompts only.

## Late fix (owner request during the release)

The owner could add reference models in the AI console but not remove them (they
open as tabs; nothing in the console showed or removed them). Reference tabs are now
marked (`session.reference`, set in the host's `addReference` in `app/App.jsx`), and
the composer shows a chip with a × for each reference, plus a × on the model chip when
the active tab is a reference. × calls `removeReference`, which uses the normal tab
close (so unsaved changes still prompt). `test/ai-console.electron.cjs` covers attach,
chip and removal.

Also from the owner: Ctrl+C on text selected in the AI chat ran the editor's "Copy
selection" (the global handler in `app/Hotkeys.jsx` consumed it); it now leaves Ctrl+C
to the browser when the text selection is inside `.ai-assistant`. Pasting into the
prompt attached the picture that Word/web pages put beside copied text; the prompt now
pastes text whenever the clipboard has `text/plain`. Both covered in `ai-console`.

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
