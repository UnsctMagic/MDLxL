# AI real-use run after the chat fixes

The copied Codex login reported signed out. The harness stopped the live attempt and ran one inert stand-in repetition. **There are no live after-fixes measurements.** K=2 was requested; only 1 stand-in repeat (6 scenarios) was observed. Its scores and completion states describe the test plumbing, not model editing.

PR [#430](https://github.com/UnsctMagic/MDLxL/pull/430), “AI chat: send the editor snapshot once, then only changes; user's words first”, merged at 2026-10-30T02:17:31Z; this check found it at 2026-10-30T02:27:44.975Z, within the four-hour window. The four-hour fallback was not used. The tested main commit is `56fb26c861715cc0e2188b9f0a00503bb70c35dc`, which includes [#427](https://github.com/UnsctMagic/MDLxL/pull/427) and #430.

The [baseline](ai-real-use-baseline-2026-10-30.md) ran on `d1dc4ffe17be3930a1d7f6854931a5b2447a0915` before #427, with K=1 and 6 live scenario observations. It is unchanged.

## Before and after

Each baseline cell is **mean / min / max per six-scenario repeat**, with n=1. A live K=2 rerun would use n=2 repeat totals. No live after sample exists, so unavailable cells are not zeroes. Counts and denominators are explicit; these are observations, not a verdict about the fixes.

| Measurement | Before: live K=1 | After: live K=2 requested | Unit |
|---|---|---|---|
| Resumes | 7 / 7 / 7 | Unavailable (0 live observations) | per six-scenario repeat |
| Outside checks | 17 / 17 / 17 | Unavailable (0 live observations) | per six-scenario repeat |
| Finished scenario states | 3/6 / 3/6 / 3/6 | Unavailable (0 live observations) | of 6 scenarios per repeat |
| Stud addition: new protruding patches | 0 / 0 / 0 | Unavailable (0 live observations) | per reference-studs scenario; requested 4 |
| Follow-example weld coverage | 0% / 0% / 0% | Unavailable (0 live observations) | fraction of remaining eligible duplicate points |
| Just-deliver weld coverage | 0% / 0% / 0% | Unavailable (0 live observations) | fraction of remaining eligible duplicate points |
| Keep-the-look: maximum sampled surface drift | 6.865e-12 / 6.865e-12 / 6.865e-12 | Unavailable (0 live observations) | model units across the 3 keep-look scenarios |
| Keep-the-look: maximum bounds drift | 0 / 0 / 0 | Unavailable (0 live observations) | model units across the 3 keep-look scenarios |
| Keep-the-look: maximum UV drift | 1.452e-13 / 1.452e-13 / 1.452e-13 | Unavailable (0 live observations) | UV units across the 3 keep-look scenarios |
| Keep-the-look: minimum silhouette overlap | 100% / 100% / 100% | Unavailable (0 live observations) | fraction across the 3 keep-look scenarios |
| Keep-the-look: texture/material changes | 0 / 0 / 0 | Unavailable (0 live observations) | of 3 keep-look scenarios per repeat |
| Scenario wall time | 1,358.018 / 1,358.018 / 1,358.018 | Unavailable (0 live observations) | seconds per six-scenario repeat; excludes build and packaging |
| App-recorded tokens | 25,125,677 / 25,125,677 / 25,125,677 | Unavailable (0 live observations) | per six-scenario repeat; includes cached input where counted |
| Provider Stopped. cut-offs | 0 / 0 / 0 | Unavailable (0 live observations) | scenarios per repeat |
| False model/selection-change refusals | 0 / 0 / 0 | Unavailable (0 live observations) | scenarios per repeat |
| Harness timeouts | 0 / 0 / 0 | Unavailable (0 live observations) | scenarios per repeat |

The baseline finished 3/6 scenario states, with 7 resumes, 17 outside checks and 25,125,677 transcript-reported tokens. Both example cases had 0% requested weld coverage, including one that reported a complete state. Its 1,358.018 seconds is scenario wall time (22m 38s), separate from preparation. The three keep-look scenarios had no texture/material changes; their surface and UV differences were at floating-point scale. These baseline numbers have no new live counterpart in this attempt.

## What was actually exercised

The live configuration requested Codex `gpt-6-luna` with low reasoning effort, two repeats, all six scenarios, 240,000 ms per-turn measurement timeout and two resume attempts, with offload/outside checks on and the lighter-model switch off. These match the baseline. The account check returned signed out before a live editing turn. No interactive sign-in was opened and the owner profile was not modified.

The actual provider was `inert-stand-in`: 8 local provider requests in 1 repeat. Image attachment was observed, and normal mouse rotation worked in the hidden package. The scenario states below are stand-in output, separate from the live comparison.

| Stand-in scenario | Recorded state | Resumes | Outside checks | Scenario seconds | Recorded tokens |
|---|---|---:|---:|---:|---:|
| thicken-band | complete | 0 | 0 | 1.496 | unknown |
| reference-studs | complete | 0 | 0 | 2.097 | unknown |
| reduce-studs | complete | 0 | 0 | 2.907 | unknown |
| keep-the-look | complete | 0 | 0 | 2.593 | unknown |
| follow-example | complete | 0 | 0 | 2.946 | unknown |
| just-deliver | complete | 0 | 0 | 3.839 | unknown |

The stand-in scenario times total 15.878 seconds. The whole harness took 46.13 seconds, including account/setup/report work. Preparation took 220.642 seconds and is recorded separately. None is a live-model speed comparison. Token and dollar fields without provider usage remain unknown.

## Reproduction and limits

The scenario definitions, live driver, fixture model/photo and graders are identical to baseline harness commit `dd23abac46cba1e05239f874b88a1f58691fb103`. Intervening main changes updated `test/helpers/app.cjs`, `test/helpers/fiber-probe.cjs`, `scripts/run-packaged-tests.mjs`; no test or product source was edited for this attempt. The JSON lists file identities and the raw measured stand-in runs and summaries.

Renderer index SHA-256: `97984a21197e318f2ada655532c698dae41d9f7a2b49ff8d29fe8e70ae730225`. Renderer assets SHA-256: `ed885744a13a6a66e5b2177f069f2fa21d5c39869a49a8bf58cd70155220f10b`.

`npx vite build` and package verification completed (1,332 runtime/asset files). The final AI source suite recorded 266 passed tests and 1 existing skip, including the 11 grader tests. The first source check used an explicit temp override that bypassed the fake agents’ CommonJS scope; rerunning with the existing default D: temp helper resolved those 13 fixture failures without code changes. The packaged runner exited zero because it produced measurements, not because a live edit was accepted.

Surface/silhouette and UV checks are finite samples; they do not establish photo resemblance, shading or Warcraft III acceptance. A live comparison still requires an available signed-in disposable Codex profile. This report makes no before/after claim about the chat fixes.
