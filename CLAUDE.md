@AGENTS.md

## Claude Code only

- Branches use the `claude/` prefix.
- When the owner says "merge", merge right away. Run the merge as its own
  command, exactly `gh api repos/UnsctMagic/MDLxL/pulls/<n>/merge -X PUT -f merge_method=merge`;
  that form is pre-approved in `.claude/settings.json`.
- A cloud checkout cannot run the packaged Windows app or real mouse drags. Run
  the build and tests that work there, then report `ready to test` with a short
  plain-language click-through list for the owner, who is not a programmer.
- Keep handovers in `docs/agent-tasks/`, not only in a claude.ai Project or
  private memory, so Codex can continue the work.
- Give each subagent the matching [map](docs/agent-map.md) row and task note
  rather than letting it rediscover the repository.
