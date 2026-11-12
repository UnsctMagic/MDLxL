# Testing rules (binding)

These rules bind every agent working on MDLxL, Codex and Claude alike. They exist
because release 0.36.0 was recalled: the Corpse Editor said "Delete removes it",
its test passed, and Delete did nothing once the user had dragged a handle. The
test had given the handle focus with `.focus()`; no user does that. A pull
request that breaks a rule below is not reviewed. It goes back.

## Who tests

- Codex, Claude or another agent may run tests and assess the results, including
  for their own changes. Everyone follows the same shared testing rules and
  project scripts; no agent has exclusive ownership of QA or the release gate.
- Use the maintained shared scripts and ruleset. Do not create a separate
  agent-specific testing process. Reports must identify the commands, tested
  revision/package, pass/fail/skip counts and remaining gaps; the agent's name
  does not substitute for evidence.

## Before merging

- For code changes, build and run focused checks of the affected behavior,
  proportional to the change. UI behavior needs the relevant real interaction
  checks below. Documentation-only changes need link, path and rule-consistency
  checks, not an application rebuild.
- Do not require the full release regression or packaged-app suite, or a separate
  Claude/second-agent rerun, solely to merge a change. Required configured CI
  checks still apply; use their results rather than repeat them locally.
- Reuse passing results while the tested behavior, tests, relevant dependencies
  and build inputs remain unchanged. Rerun affected checks when a change,
  failure or unresolved concern invalidates that evidence. Record which results
  were reused and the revision/package they cover.

## Every test must

1. **Do what the user does.** Real clicks, drags, wheel and keys through
   Playwright `page.mouse` / `page.keyboard` on the packaged app. Focus stays
   wherever the user's last real click left it.
2. **Never cheat the path.** Forbidden in a check: `.focus()`, `dispatchEvent`,
   calling React props or app functions directly, setting state through the test
   hook, `force: true` clicks, or waiting a fixed time instead of for a result.
   Setup may use the test hook only to load a model or read state for assertions.
3. **Fail first.** A new or changed check must fail on the broken code before it
   counts. Prove it: run it against the old code (or the commit before the fix)
   and quote the failing assertion in the PR.
4. **Check the effect the user sees**, not that a function ran: the piece is gone,
   the value changed, the window stayed open, Ctrl+Z brought it back.
5. **Cover the whole promise.** Anything the UI tells the user ("Delete removes
   it", "Esc cancels", "Enter applies", "double-click to reset") gets a test of
   that exact action, including after the steps a user naturally takes first
   (select, drag a handle, click elsewhere) and the follow-up key (Ctrl+Z).
6. **Use real models.** The Blizzard SD corpus from the installed game, the
   owner's models (flails, Fx, Graveguard, Aspiring) and the fixtures in
   [PACKAGED-TESTS.md](PACKAGED-TESTS.md). A generated toy model alone is never
   enough for a feature that touches rigs, animation or geometry.
7. **Measure, don't eyeball.** Motion with MDLxL's own playback
   (`src/ai-motion-compare.js`), size from the saved bytes, every animation, and
   first/last poses. Stills hide bad motion.
8. **Read after the app has caught up.** A drag is drawn once per display frame
   and a recovery copy is written a moment after the edit, so a read taken right
   after the last `page.mouse.move`, or a single look for a file, can see an
   earlier step. Before sampling a live preview, poll with a time limit until
   the expected position is reached or two reads 50 ms apart are identical, and
   compare the state after release only with that sample. Wait for something on
   disk by polling from the test (`page.evaluate` in a loop): an async function
   passed to `page.waitForFunction` returns a Promise, which counts as true, so
   it reads once. This is waiting for a result, not a fixed wait (rule 2). A
   failing comparison prints its numbers. On 11 and 12 Nov 2026 three harnesses
   failed on a correct app for this reason; see the settled reads in
   [vertex-animated-preview](../test/vertex-animated-preview.electron.cjs) and
   the checkpoint poll in [review-bitz](../test/review-bitz.electron.cjs).

## Never

- Loosen, delete or skip an assertion to make a test pass. A stale expectation is
  changed only with proof that the app is right (measure old and new code) and
  the reason in the commit message.
- Widen `.github/known-test-failures.txt` or add a `SKIP` entry to hide a failure.
- Report a missing fixture as "fixture absent" and move on. Prepare it
  (`out/fixtures.sh` in the release worktree) or ask the owner for the model.
- Run the full release suite on an older package and present it as evidence for
  the release candidate. Start with the frozen release candidate, then follow
  the affected-check rerun rules below for subsequent fixes.
- Report "all pass" without the numbers: pass / fail / skip counts and every
  skip's reason.

## Every PR states

- What the user can now do, and the exact steps that test it.
- The tests added or changed, with the failing-on-old-code proof.
- The packaged tests run (names), their result, and any skip with its reason.
- What was not verified (Warcraft III itself, visual taste) in one line.

## Before releasing

Run the full regression checks for the release: source and compatibility suites,
plus the full packaged-app suite on the release candidate. Any agent may run and
verify them using the shared scripts and rules.

Require zero failures in the full packaged suite, zero unexplained skips, source
and compatibility suites green, and every feature the owner asked to include
merged and tested the user's way. Anything less: no tag, no publish. Owner
approval is still required for merging and releasing.

**One full run per release, never more.** The full suite takes about 1.5 hours
and the owner waits for it. Run it once, after the release scope is frozen.
After a fix or a late addition, rerun only the failed tests plus the tests that
cover the changed files (map the changed components, styles and source files
to test names). Tests that passed on code that has not changed since are not
rerun. A passing result stays valid until its own code changes.
