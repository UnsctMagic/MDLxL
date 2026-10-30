# Testing rules (binding)

These rules bind every agent working on MDLxL, Codex and Claude alike. They exist
because release 0.36.0 was recalled: the Corpse Editor said "Delete removes it",
its test passed, and Delete did nothing once the user had dragged a handle. The
test had given the handle focus with `.focus()`; no user does that. A pull
request that breaks a rule below is not reviewed. It goes back.

## Who tests

- Claude owns QA: release test runs, release checks and the final verdict.
  Codex builds features and fixes. A Codex report of "tests pass" is a claim, not
  evidence; Claude reruns the tests before anything merges.
- The agent that built a feature never decides alone that it works.

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

## Never

- Loosen, delete or skip an assertion to make a test pass. A stale expectation is
  changed only with proof that the app is right (measure old and new code) and
  the reason in the commit message.
- Widen `.github/known-test-failures.txt` or add a `SKIP` entry to hide a failure.
- Report a missing fixture as "fixture absent" and move on. Prepare it
  (`out/fixtures.sh` in the release worktree) or ask the owner for the model.
- Run the packaged suite on an older build and rerun only "the tests you think
  changed". The release run is the full suite on the final package.
- Report "all pass" without the numbers: pass / fail / skip counts and every
  skip's reason.

## Every PR states

- What the user can now do, and the exact steps that test it.
- The tests added or changed, with the failing-on-old-code proof.
- The packaged tests run (names), their result, and any skip with its reason.
- What was not verified (Warcraft III itself, visual taste) in one line.

## Release gate (Claude)

Zero failures in the full packaged suite on the final package, zero unexplained
skips, source and compatibility suites green, every feature the owner asked to
include merged and tested the user's way. Anything less: no tag, no publish.
