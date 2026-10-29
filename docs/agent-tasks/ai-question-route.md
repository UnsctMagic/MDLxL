# AI questions and provider protocol routes

State: ready for review; awaiting merge approval. PR #375, codex/ai-question-route.
Original base: 188be9cb. Original question route: dbe1d07f.

## Request

Fix missing questions, remaining unsupported protocol paths, question lifecycle
and hidden warnings. Keep terminal and arbitrary filesystem access disabled.
No merge, release or installed-profile change is authorised by this task.

## Implementation

- Native Codex requests each own a cancellation signal. Resolved requests,
  turn completion, provider exit, editor shutdown and restart cannot leave live
  answer controls behind. A live nonblocking request remains answerable while
  ordinary output continues. Cancellation keeps the question and reason readable.
- Protocol correction to the earlier audit: Codex itself invalidates outstanding
  requests at turn end. Sending a late answer to that expired RPC is invalid;
  the stopped card directs the owner to reply in the original chat to continue.
- Claude Code AskUserQuestion uses the documented stdio control channel and the
  same chat UI, including multiselection and cancellation. Its built-in tool
  list still excludes terminal/filesystem tools. Unexpected tool requests are denied.
- MCP typed forms and HTTPS input pages use the existing question UI. Optional
  fields may be omitted; values preserve their schema types. Empty-form No is
  a decline. Input URLs open only on a click tied to a live question.
- Permission/legacy approval requests use the correct empty-grant/decline shapes.
  Privileged MCP tool-approval forms cannot enable additional tools. Dynamic
  calls can reach only the job's already registered MDLxL editor tools.
- Provider warnings/errors, startup failures, sparse usage-limit updates, model
  switches and plans are recorded as compact expandable/dismissible chat rows.
  Bird notices also reach the organiser; later status changes do not erase them.
- External auth-token refresh and attestation have explicit actionable errors.
  These mechanisms are not configured in this Codex-managed sign-in connection;
  no credentials or attestation tokens are fabricated.

## Verification

- Final source suite: 2,133 passed, 22 skipped, zero failures (2,155 total).
- Compatibility: all 57 passed. Production build and package passed.
- Hidden packaged check: all 21 assertions passed across Codex and Claude paths,
  including pending/answered chat restoration, nonblocking questions, owner and
  provider cancellation, turn-end cleanup, typed MCP forms, persistent warning
  details/dismissal, refused terminal requests and actual Alt/mouse rotation.
- Installed Claude CLI accepted an isolated initialization/control-channel probe;
  no user prompt or model request was sent.
- Model turns use local native-protocol fixtures and generated models. Live paid
  providers and external form sites were not exercised. The installed app/profile
  and real user models were not changed.

## Protocol references

- https://github.com/openai/codex/blob/main/codex-rs/app-server/src/bespoke_event_handling.rs
- https://github.com/openai/codex/blob/main/codex-rs/protocol/src/mcp_approval_meta.rs
- https://code.claude.com/docs/en/agent-sdk/user-input
- https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py

## Handoff

Update PR #375 and await explicit merge approval. Keep the small report/logs and
up to two captures in D:/Codex/mdlxl-protocol-result-20261029. Remove disposable
packages, profiles, generated schemas and task worktree after verification/push.
