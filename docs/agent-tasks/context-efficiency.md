# Shared context efficiency

Status: ready for review; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-10-21

## Goal and completion criteria

Give Claude Code and Codex one maintained instruction source, a selective project
map and concise continuation notes. Preserve existing constraints and application
behavior. Verify paths, symbols, commands, imports, instruction preservation and
client loading where available. Branch: `codex/context-efficiency`; no merge without
explicit approval. No dependencies, services, background processes or global edits.

## Revision and local state

- Base: online main `01d99e3114373dee1e3de2b655736cb1127faccc` (v0.28.4).
- The supplied C: checkout was clean at `73f9025a` (v0.26.0); left untouched.
  Work uses the isolated `D:\Codex\mdlxl-context-efficiency-20261021\repo` clone.
- Documentation revision: the commit containing this note. Resolve it with
  `git log -1 --format=%H -- docs/agent-tasks/context-efficiency.md`, then compare
  current HEAD and diffs. A branch name alone does not identify the snapshot.
- Working tree at the documentation handoff: no unfinished application changes.
  The ten Markdown files listed below are the entire patch. The commit containing
  this note includes the corresponding documentation; check current diffs on resume.
  No external fixtures are needed.

## Audit: verified discoveries and decisions

- Root AGENTS.md was the only repository instruction file. There was no root or
  nested CLAUDE.md, AGENTS.override.md, .claude configuration or .codex configuration.
  No repository-wide feature map or generic task-note convention was present.
- Existing particle and paint handoffs contain useful ownership/evidence, mixed
  with old C: workspaces, one-off budgets and release permissions. They are now
  marked historical; reuse relevant sections without reviving those instructions.
- Root motion-warning requirements overlapped docs/MOTION-INSPECTOR.md. Their
  complete wording moves there under a required-constraints heading; root retains
  a mandatory conditional link. UI, optimizer, build, version and PR gates remain.
- No blanket read-everything rule was found. Context cost came from always-loaded
  feature detail, scattered task records and poor routing to large owner files.
  The map routes to existing guides instead of copying them.
- README recommends Node 22.12+, while package.json's engine floor is >=20 and CI
  uses Node 22. Shared setup follows the README/CI recommendation; no engine change.
- Package scripts distinguish compatibility tests in tests/ from source tests in
  test/. CI builds assets first and compares source failures to the existing
  baseline. There is no configured lint script to invent.
- A private Claude instruction currently uses its own D: workspace and branch
  prefix and describes AGENTS as Codex-specific. It was read only for this audit,
  not copied or modified. Shared rules explicitly retain a task's requested branch.
  That personal override remains a possible difference in configured-client behavior.
- Official Codex/Claude discovery guidance was checked. Root CLAUDE imports only
  AGENTS; future nested common instructions need a sibling Claude import and an
  explicit applicable-rule check. Optional guides are ordinary links.

## Changes

- Root AGENTS.md: shared context selection, constraints, selective reading,
  verification, agent-maintained notes, tool switching and existing delivery gates.
- Root CLAUDE.md: one import; README: a discovery link for contributors.
- docs/agent-map.md: verified source owners, symbols, existing guides and checks.
- docs/agent-tasks/README.md and TEMPLATE.md: current-task index and handover lifecycle.
- This real task note provides the example; the template contains placeholders only.
- Existing motion guide and particle/paint handoffs: conditional constraints and
  historical-status clarification, with original evidence retained.

## Verification and remaining work

- Passed: 307 local Markdown links/anchors, 20 source symbols, all eight referenced
  package scripts, focused-test paths and the ten-file Markdown-only change boundary.
- Passed: CLAUDE.md is exactly one import; the graph is CLAUDE.md -> AGENTS.md,
  with no cycle or automatic imports of the map, task notes or topic guides.
- Passed: the original motion-rule block is preserved verbatim. Reviewed all
  existing UI, optimizer, version, generated-output and PR/approval constraints.
  Historical handoff bodies and evidence remain intact below their new notices.
- Passed: installed Codex's `codex debug prompt-input` loaded one complete copy of
  the new shared instructions from this checkout in an isolated D: profile.
  It did not expand the project map, task guide or detailed motion document.
  This checks the real loader without a model request or private-profile changes.
- Claude Desktop exists, but no usable Claude Code CLI was found on PATH or in
  the inspected standard/tool/package locations. Its actual loading is unverified;
  the import and nesting guidance were checked against the official documentation.
- Passed: `git diff --check`. No dependency installation, app build or application
  test run was needed for this documentation-only patch. Required PR CI is pending.
- Remaining context overhead: personal/global instructions and client tool/skill
  metadata still load independently. Existing long topic guides are selective;
  the older private Claude branch convention remains untouched.

## Blockers and next action

No implementation blocker. Open and attach the feature PR, inspect its CI, then
wait for explicit merge approval. On an authorized merge, verify the PR and online
main before marking this task completed and removing its active-index entry.
No release or application changes are part of this task.
