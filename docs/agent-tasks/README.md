# Shared task handovers

Agents maintain these notes; the user describes work normally. Create a note only
for a substantial task that needs continuation across sessions or agents. Reuse
an existing topic handoff for the same task instead of creating competing notes.

## Current tasks

| Task | State | Note / owner |
| --- | --- | --- |
| MdlVis-style Rotate drag | Ready for Claude re-review; Local-axis follow-up verified | [Rotate drag](mdlvis-style-rotate-drag.md) / Codex |
| Full AI editor connection | Ready for review; awaiting merge approval | [AI editor hook](ai-editor-hook.md) / Codex |
| Shared project context | Ready for review; awaiting merge approval | [Context efficiency](context-efficiency.md) / Codex |
| Movement Create button; reopen existing ribbons in EMTR | Not started | [Movement Create and ribbon re-entry](movement-create-and-ribbon-reentry.md) / Codex |
| New MDLxL look (carved tools, slate-and-gold dock, floating Geosets) | Ready for review; awaiting merge approval | [New look](new-look.md) / Claude Code |
| WC3 editing knowledge for the AI (general rules, reuse existing research) | Core and seven guides ready for owner review; #317 overlap documented | [WC3 editing agent](wc3-editing-agent.md) / Codex |

Keep this table limited to current work. On completion, mark the note completed
with its result/revision, remove its table entry, and leave the note as searchable
history. Do not read completed notes or the whole folder at startup.

## Maintain a useful handover

Use [TEMPLATE.md](TEMPLATE.md) for new tasks, with a descriptive filename.
Keep the goal, decisions, current state and next action up to date; replace stale
status rather than appending a tool-by-tool diary. Update after meaningful
discoveries, useful milestones, and before a tool/agent/session handoff.
Separate verified facts from assumptions and pending tests. Record failures only
when knowing why they failed can prevent repeated investigation.

Put durable implementation knowledge in the existing topic guide and link it.
Keep task-specific revisions, local state and blockers in the task note.
Do not turn a handover into a second source manual or copy private conversations,
credentials, global settings or built-in memory stores into the repository.

## Switching tools or checkouts

1. The outgoing agent records the branch, base/relevant revision, exact unfinished
   files and checks, any PR, and the next concrete action. Commit code and the
   matching note together when appropriate; disclose any uncommitted work.
2. The receiving agent inspects `git status --short --branch`, `git rev-parse HEAD`,
   relevant history and `git diff` / `git diff --cached`. Compare them with the
   note before relying on its findings. Do not overwrite unrelated work.
3. Continue the task's named branch. Another checkout must obtain the relevant
   commits and note through the normal Git workflow; uncommitted/ignored files
   require an explicit handoff too. Record how any needed local fixture is obtained.
4. Read only the matching map entry and current note, then inspect the owner code.
   Correct stale statements and distinguish already verified results from new gaps.

Shared files do not synchronize branches, worktrees, computers or cloud checkouts.
Switching clients does not transfer private conversations or either client's
memory. No daemon, external memory service or global configuration change is needed.
Do not assume the other tool is on the same revision because its folder has the
same project name.

For concurrent work, use a separate note per task. Give each delegate a bounded
job, relevant paths, known findings, constraints and expected output. Name one
owner to reconcile shared findings and map edits; avoid overlapping writes and
repeating repository-wide discovery.

## Instruction discovery

The repository's common rules belong in root [AGENTS.md](../../AGENTS.md).
Root [CLAUDE.md](../../CLAUDE.md) imports it with `@AGENTS.md`, not a copied body.
The map, template and task notes use ordinary links and are opened only when relevant.

- Codex builds its startup instruction chain from the repository root to its
  starting directory; a local `AGENTS.override.md` takes precedence over
  `AGENTS.md`. Starting at root does not automatically preload every subtree.
- Claude expands its `CLAUDE.md` imports relative to the importing file. Ancestor
  instructions load at startup; subtree instructions load when working with files
  there. The explicit root import also supports clients without native AGENTS support.
- Before editing a deeper area, both agents check that target's ancestor directories
  for applicable rules, even if their client has not loaded them automatically.
  If a future nested common rule is needed, put it in a nested `AGENTS.md` and
  add a sibling `CLAUDE.md` with only `@AGENTS.md` plus necessary Claude-specific
  guidance. Do not import the parent again or import the documentation tree.
  If an override already exists, inspect it and reconcile the effective rules
  for both tools rather than assuming Claude reads Codex overrides.
- There were no nested instruction files at setup. Do not add empty per-directory
  files just to mirror the tree. New nested requirements should remain selective.
- Global/private instructions are separate. A conflicting personal branch rule or
  client override must be surfaced, not silently rewritten. The user's explicit
  task branch and approval boundaries remain the starting point.

For loading diagnostics only, consult the official
[Codex discovery guide](https://developers.openai.com/codex/guides/agents-md) and
[Claude memory/import guide](https://code.claude.com/docs/en/memory).
Start a fresh session in the intended checkout after changing startup instructions.
Use Claude's `/context` or `/memory` to inspect loaded files; ask Codex to identify
its instruction sources. Actual client loading must be distinguished from a static
import/path check. No client settings are changed by this documentation.

## Assess whether this helps

On future comparable tasks, record time to locate the owner, repeated file reads
or repeated investigations, and missing/stale handoff facts. Compare similar scope
and available context; use client context/token counts if available. Do not claim
a percentage saving without measurements. Fix recurring navigation gaps in the
map or existing guide rather than increasing mandatory startup reading.
