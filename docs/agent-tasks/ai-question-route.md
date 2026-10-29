# AI clarification route

State: ready for review; awaiting merge approval.
Branch: codex/ai-question-route. Base: 188be9cb.

## Request and cause

Codex said it had asked the owner a question, but no question or answer controls
appeared. CodexProcess treated item/tool/requestUserInput as unsupported,
returned an RPC error and showed only a transient notice.

## Change

Handle that native request through AiService. Keep the provider RPC pending
until an explicit answer or cancellation; identify each request independently.
Record and show the question in its own bird chat and the organiser chat.
Show the actual options, descriptions and a typed answer field; no option is
submitted or selected automatically. Return answers under the original question
IDs. Keep answered questions readable; stop pending controls on cancellation,
provider exit or persisted-chat recovery. Secret answers are masked in transcripts.
Terminal and filesystem approval requests keep their existing decline path.

## Verification

- Production build and package passed.
- Source: 2,118 passed, 22 skipped, no failures (2,140 total).
- Compatibility: all 57 passed.
- Focused native/offload/question tests: 41 passed, one platform skip.
- Hidden packaged ai-questions: all eight checks passed: organiser delivery,
  explicit choices plus free text, native RPC continuation, bird chat switching,
  text-only answers, Stop and actual Alt/mouse viewport rotation.
- Generated model and local native protocol fixture only; live paid providers
  were not exercised. No installed app/profile, user model, release or merge changed.

## Handoff

Push this branch and attach its PR. Remove the test package, disposable profiles
and task working files after verification; keep the small report/logs and question
screenshot in D:/Codex/mdlxl-ai-question-result-20261029.
