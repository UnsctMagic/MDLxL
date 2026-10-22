# MDLxL Project Instructions

Shared instructions for Codex and Claude Code. Maintain common rules here;
[CLAUDE.md](CLAUDE.md) imports this file. Tool settings and private memories stay
separate and are not a shared handover.

## Select context before editing

- Translate the user's normal description into the relevant area of the
  [project map](docs/agent-map.md); do not require them to know filenames.
- Start with applicable instructions, the relevant map entry, and the current
  task note when continuing work. Check `git status --short --branch`, the current
  revision, and relevant committed/uncommitted diffs before trusting a handover.
- Before editing, check for instructions along the target directory's ancestry,
  including nested `AGENTS.md`, `AGENTS.override.md`, and `CLAUDE.md`. Discovery
  differs between clients: follow the [loading guidance](docs/agent-tasks/README.md#instruction-discovery)
  when adding nested rules or switching directories.
- Search the likely owner first with `rg` / `rg --files`, then broaden as needed.
  Read relevant sections/functions, their call path and dependencies, and an
  existing good use before editing; avoid dumping large files by default.
- Reuse unchanged information still in the conversation. Reread when context is
  missing or condensed, files changed, or correctness needs it. There is no fixed
  file limit or search ban.
- Do not routinely load unrelated guides, completed task notes, generated output,
  or large logs. Follow ordinary documentation links only for the current work.
- Current code establishes implementation facts; the user's request and
  applicable instructions govern intended behavior. Notes override neither.
  Correct stale notes when found; label uncertain or historical evidence.

## Essential constraints

- Make the smallest requested change in the existing workflow. Preserve unrelated
  work, authored model data and intended motion. Do not edit imported libraries.
- On the owner's Windows PC, keep all task-controlled work, builds, caches,
  temporary files and reports on D:. Codex uses `D:\Codex\<task>`; C: is read-only
  input. Cloud checkouts use their own temporary workspace. Keep each tool's approved
  workspace and private settings separate; do not change global configuration.
  Link existing `node_modules` with a junction rather than copying dependencies.
- Preserve real profiles, personal libraries, settings, saves, recordings and
  user-added files. An offline upgrade must preserve the entire
  `resources/app/profile` and personal files, verify migration before replacing
  shortcuts, then remove the superseded installation unless the user asks to keep it.
- Remove task-created disposable builds/profiles/runtimes after verification,
  keeping the small report and needed captures. Stop unused task-started processes.
  After pushing or merging, remove the finished task worktree and prune its
  registration. Preserve source, Git history and unfinished work. Remove junctions
  as links before cleanup; never recursively delete through a junction.
- Keep MDLxL simple and compact, in the spirit of MDLVis and the VIS button.
  Do not add unsolicited panels, dashboards, toolbars, menu redesigns or apps.
  Preserve existing sidebars, widths and controls unless explicitly requested.
- One way of doing things. When a feature has an existing counterpart, reuse
  its controls exactly: same handles, look, drag behaviour, keys and wording.
  Never invent a new control scheme for a familiar job (for example sliders
  where the app already drags). In EMTR, emitters are moved and resized by
  dragging handles in the preview, so ribbons, glows and anything else placed
  there are dragged the same way. Users learn one way, not one per feature.
- Complicated or ambiguous controls need a short plain-language tooltip when
  hovering either the control or label. For example, `Billboarded` explains that
  the bone and attached parts turn toward the viewer as the camera moves.
- Every 3D preview must allow normal mouse camera rotation unless explicitly
  requested otherwise. Verify actual mouse drags in the packaged app;
  programmatic camera changes do not verify the user's controls.
- Show only the smallest relevant indicator by default. Explanations/editing
  controls appear after a deliberate click, remain dismissible and stay out of
  the normal layout. Verify both the uncluttered default and opened details.

## Read detailed rules only for the affected area

- Motion warnings/timeline diagnostics: read [Motion warnings](docs/MOTION-INSPECTOR.md),
  including its required constraints, before changing detection, selection or UI.
- OptimizeXL detection/repairs: read [the teaching agreement](docs/OPTIMIZEXL_TEACHING.md)
  and relevant verification sections. Add reusable capability without regressions
  or competing repair ownership; record exact correction boundaries, interactions
  and regression proof. Repaired counterparts are test references only: runtime
  repairs use the model under review. Preserve the immutable accepted flail baseline.
- Movement toolbar, View menu or workplane changes: read the applicable
  [merger constraints](MERGER_NOTES.md).
- Other feature contracts, ownership maps and verification notes are linked from
  the relevant [map entry](docs/agent-map.md); do not load the whole collection.

## Build and verification

Use Node.js 22.12+ and pnpm; [package.json](package.json) owns script definitions
and [README source development](README.md#source-development) explains setup.

- `pnpm run build` builds `dist/`; rebuild before desktop verification because
  Electron loads that bundle. `pnpm start` launches it; `pnpm run package` packages it.
- `pnpm test` runs compatibility tests in `tests/`; `pnpm run test:source` runs
  source tests in `test/`. Use relevant focused tests from the map as well.
- [CI](.github/workflows/ci.yml) fetches FFmpeg, builds, runs compatibility tests,
  and checks the full source suite against [.github/known-test-failures.txt](.github/known-test-failures.txt).
  Missing built assets are not automatically a source regression; do not hide
  new failures by widening the baseline.
- For documentation-only changes, check links/paths, named symbols, commands,
  instruction imports and preserved constraints; do not package the app solely
  for prose changes. Required PR CI still applies.
- `dist/` and FFmpeg executables/DLLs in `electron/ffmpeg/` are untracked: never
  commit them. `pnpm run fetch-ffmpeg` verifies the pinned binaries against
  [PROVENANCE.json](electron/ffmpeg/PROVENANCE.json).
- Report checks actually run and remaining gaps. Static checks do not prove a
  visible result; say `ready to test` when the changed behavior has not run.

## Shared notes and handovers

Both agents maintain the map and relevant task note as part of the work; the
user should not maintain them. For substantial work needing continuation, reuse
its existing note or use the [task-note guide and template](docs/agent-tasks/README.md).
Update after meaningful discoveries, milestones and before handing over, not
after every tool call. Keep one current account, mark completed tasks, and move
durable findings into the existing topic guide. Do not load old task notes at startup.

Shared files do not synchronize branches, checkouts or private memories: hand over
the revision, code and note together. Delegation and tool-switching steps are in
the [task-note guide](docs/agent-tasks/README.md#switching-tools-or-checkouts).

## Branches, approval and releases

- Continue the task's explicitly named feature branch when switching tools.
  Otherwise use the tool's own prefix: `codex/` for Codex, `claude/` for Claude
  Code. Preserve unrelated local work.
- Push the feature branch to `origin`, open a PR into `main`, and include its URL
  in the handover (attach it to the Codex chat when using Codex). A local-only
  commit/merge or direct push/merge to `main` is not a completed handoff.
- Every PR description names the session that did the work in one line:
  `Session: claude local_<id>` or `Session: codex <task or chat name/link>`.
  Before merging, add the line if it is missing (edit the description; no commit).
- Merge through the PR only after explicit user authorization. Until then, report
  `ready for review; awaiting merge approval`. After authorized merging, verify
  both the merged PR and its change on online `main` before reporting completion.
- Do not bump versions for unshipped local edits. For a release, choose the next
  version from the latest released version and include all intended changes.
  Never reuse a version: patch for fixes/maintenance, minor for compatible
  features, major for incompatible changes. Update `package.json`, the README
  title and its current-version summary together.
- A `v<version>` tag triggers **Draft release**; publishing remains manual.
  Before release/upgrade work, read [AUTO_UPDATES.md](docs/AUTO_UPDATES.md) and the
  [portable release gate](docs/UPDATER_RELEASE_GATE.md).
- After a release is published (not at tag or draft time), automatically
  archive the sessions whose PRs shipped in it, without asking, as described in
  [archive finished sessions](docs/AUTO_UPDATES.md#after-publishing-archive-finished-sessions).
