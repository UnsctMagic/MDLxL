# AI real-use after the chat fixes

This is the single authorized live retry: K=2, 12 scenario observations, `gpt-6-luna`, low reasoning effort, on the hidden desktop. The current owner login was copied immediately before launch, reported signed in, and the first live turn started **5.855 seconds after the copy**. No owner login/profile was modified. No stand-in data is included in the after sample.

Tested main: `0541756b63ed5d9c863af5c47aa44b701370a382`, including [#427](https://github.com/UnsctMagic/MDLxL/pull/427) and [#430](https://github.com/UnsctMagic/MDLxL/pull/430). #430 merged within the original wait window; no four-hour fallback was used. The [baseline](ai-real-use-baseline-2026-10-30.md) is unchanged: K=1 on `d1dc4ffe17be3930a1d7f6854931a5b2447a0915`, before #427.

## Before and after

Each mean is for **one six-scenario repeat**. Before has n=1 (its mean, minimum and maximum are the same); after has n=2, with the observed minimum–maximum shown. Raw totals below keep their different denominators. Unknown values stay unknown; the JSON also records how many values were known for each distribution. These are observations, not a verdict about the fixes. Finished task states and measured edits are separate.

| Measurement | Before K=1 | After K=2 mean | After min–max | Unit |
|---|---:|---:|---|---|
| Resumes | 7 | 2.5 | 2–3 | per six-scenario repeat |
| Outside checks | 17 | 3.5 | 3–4 | per six-scenario repeat |
| Finished scenario states | 3/6 | 5/6 | 5/6–5/6 | out of 6 per repeat |
| Stud addition: new protruding patches | 0 | 2 | 0–4 | per photo scenario; requested 4 |
| Follow-example weld coverage | 0% | 0% | 0%–0% | eligible duplicate points, % |
| Just-deliver weld coverage | 0% | 100% | 100%–100% | eligible duplicate points, % |
| Follow-example pattern similarity | 100% | 100% | 100%–100% | fraction, %; requires surface/UV preservation |
| Just-deliver pattern similarity | 100% | 100% | 100%–100% | fraction, %; requires surface/UV preservation |
| Keep-look maximum sampled surface drift | 6.865e-12 | 6.865e-12 | 6.865e-12–6.865e-12 | model units; maximum of 3 keep-look cases per repeat |
| Keep-look maximum bounds drift | 0 | 0 | 0–0 | model units; maximum of 3 keep-look cases per repeat |
| Keep-look maximum UV drift | 1.452e-13 | 1.452e-13 | 1.452e-13–1.452e-13 | UV units; maximum of 3 keep-look cases per repeat |
| Keep-look minimum silhouette overlap | 100% | 100% | 100%–100% | fraction, %; minimum of 3 keep-look cases per repeat |
| Keep-look texture/material changes | 0 | 0 | 0–0 | out of 3 keep-look cases per repeat |
| Scenario wall time | 1,358.018 | 818.272 | 681.519–955.025 | seconds per six-scenario repeat |
| App-recorded tokens | 25,125,677 | 12,640,476.5 | 11,577,481–13,703,472 | per six-scenario repeat; cached input included where counted |
| Dollar cost | unknown | unknown (n=0 known) | unknown | USD per repeat; unknown when not reported |
| Provider Stopped. cut-offs | 0 | 0 | 0–0 | scenario count per repeat |
| False model/selection-change refusals | 0 | 0 | 0–0 | scenario count per repeat |
| Measurement timeouts | 0 | 0.5 | 0–1 | scenario count per repeat |
| Workflow score | 77 | 92 | 91–93 | mean of 6 scenario scores, 0–100 |
| Edit quality score | 66.667 | 79.167 | 75–83.333 | mean of 6 scenario scores, 0–100 |

Raw totals: before 3/6 finished states, 7 resumes, 17 outside checks, 1,358.018 scenario seconds and 25,125,677 tokens. After: 10/12 finished states, 5 resumes, 7 outside checks, 1,636.544 scenario seconds and 25,280,953 tokens across both repeats. Token counts include cached input where the provider counts it; dollar cost is unknown when absent from the transcript.

## Scenario distributions

Arrows show the before observation → after mean (after min–max). Finished states use raw per-scenario denominators, 1 before and 2 after.

| Scenario | Finished states | Resumes | Outside checks | Seconds | Tokens | After weld coverage |
|---|---|---|---|---|---|---|
| thicken-band | 0/1 → 2/2 | 2 → 0 (0–0) | 6 → 1 (1–1) | 312.844 → 47.897 (47.482–48.312) | 4,653,182 → 620,223 (575,708–664,738) | not requested |
| reference-studs | 0/1 → 0/2 | 2 → 1.5 (1–2) | 0 → 0 (0–0) | 397.693 → 314.799 (305.773–323.824) | 10,458,632 → 5,589,850 (4,277,182–6,902,518) | not requested |
| reduce-studs | 1/1 → 2/2 | 0 → 1 (0–2) | 3 → 1 (1–1) | 164.2 → 285.512 (98.976–472.047) | 2,775,416 → 3,899,259 (711,647–7,086,871) | not requested |
| keep-the-look | 1/1 → 2/2 | 1 → 0 (0–0) | 4 → 0.5 (0–1) | 203.114 → 77.313 (39.027–115.599) | 3,078,855 → 1,459,683 (636,646–2,282,720) | not requested |
| follow-example | 0/1 → 2/2 | 2 → 0 (0–0) | 1 → 0 (0–0) | 124.774 → 12.914 (10.632–15.196) | 2,258,963 → 107,754 (84,495–131,013) | 0%–0% |
| just-deliver | 1/1 → 2/2 | 0 → 0 (0–0) | 3 → 1 (1–1) | 155.393 → 79.838 (75.5–84.176) | 1,900,629 → 963,707.5 (931,363–996,052) | 100%–100% |

## Measured edit observations

Triangle and vertex counts below are for the whole model; per-stud targets are listed separately. Measurement timeouts are test-driver cancellations and are counted separately from provider cut-offs.

- Repeat 1, thicken-band: state complete; resumes 0; outside checks 1; triangles 354 → 354; vertices 383 → 383; surface drift 0.6 model units; UV drift 1.305; texture/material changed false.
- Repeat 1, reference-studs: state incomplete; resumes 2; outside checks 0; triangles 354 → 354; vertices 383 → 383; new stud patches 0; surface drift 6.865e-12 model units; UV drift 1.452e-13; texture/material changed false.
- Repeat 1, reduce-studs: state complete; resumes 0; outside checks 1; triangles 354 → 338; vertices 383 → 367; per-stud target 6, measured [6, 6, 6, 6, 6, 6, 6, 6]; surface drift 0.177 model units; UV drift 0.003; texture/material changed false.
- Repeat 1, keep-the-look: state complete; resumes 0; outside checks 1; triangles 354 → 354; vertices 487 → 380; surface drift 6.865e-12 model units; UV drift 1.452e-13; texture/material changed false.
- Repeat 1, follow-example: state complete; resumes 0; outside checks 0; triangles 354 → 354; vertices 485 → 485; weld coverage 0%, pattern similarity 100%; surface drift 6.865e-12 model units; UV drift 1.452e-13; texture/material changed false.
- Repeat 1, just-deliver: state complete; resumes 0; outside checks 1; triangles 354 → 354; vertices 485 → 383; weld coverage 100%, pattern similarity 100%; surface drift 6.865e-12 model units; UV drift 1.452e-13; texture/material changed false.
- Repeat 2, thicken-band: state complete; resumes 0; outside checks 1; triangles 354 → 354; vertices 383 → 383; surface drift 2 model units; UV drift 1.311; texture/material changed false.
- Repeat 2, reference-studs: state incomplete; resumes 1; outside checks 0; triangles 354 → 386; vertices 383 → 419; new stud patches 4; surface drift 0.997 model units; UV drift 1.452e-13; texture/material changed false; harness measurement timeout.
- Repeat 2, reduce-studs: state complete; resumes 2; outside checks 1; triangles 354 → 338; vertices 383 → 367; per-stud target 6, measured [6, 6, 6, 6, 6, 6, 6, 6]; surface drift 0.177 model units; UV drift 0.003; texture/material changed false.
- Repeat 2, keep-the-look: state complete; resumes 0; outside checks 0; triangles 354 → 354; vertices 487 → 487; surface drift 6.865e-12 model units; UV drift 1.452e-13; texture/material changed false.
- Repeat 2, follow-example: state complete; resumes 0; outside checks 0; triangles 354 → 354; vertices 485 → 485; weld coverage 0%, pattern similarity 100%; surface drift 6.865e-12 model units; UV drift 1.452e-13; texture/material changed false.
- Repeat 2, just-deliver: state complete; resumes 0; outside checks 1; triangles 354 → 354; vertices 485 → 383; weld coverage 100%, pattern similarity 100%; surface drift 6.865e-12 model units; UV drift 1.452e-13; texture/material changed false.

## Method and limits

Scenario definitions, fixture model/photo and grading functions match baseline harness commit `dd23abac46cba1e05239f874b88a1f58691fb103`. The test driver only had a temporary authentication-stop guard to obey the retry instruction: signed-out/authentication errors abort without the ordinary stand-in fallback. It also recorded copy/start timestamps. That local guard was restored before committing. The committed change contains only these reports. Scenario prompts, graders, timeout, two-resume budget and the full six-scenario sequence were unchanged. Offload and outside checking stayed on, routing stayed manual, and lighter-model switching stayed off. The JSON contains the run/summary data, both repeat totals, source identities and renderer hashes.

The band/addition/reduction cases intentionally change geometry. The drift comparison above covers only the three scenarios that explicitly ask to keep the look: simplification and the two example-following cases. Each repeat contributes its maximum surface/bounds/UV drift, minimum silhouette overlap and count of texture/material changes for those cases. Coverage is reported alongside pattern similarity: removing duplicate points alone does not establish that the demonstrated surface/UV pattern survived.

Stud addition measures new protruding patches, not artistic resemblance. Surface, silhouette and UV checks sample geometry; they do not prove shading, visual identity or Warcraft III acceptance. The sample sizes differ and are small, with no reliability or causal claim. The prior signed-out attempt is excluded from the live comparison. Scenario time includes scenario setup and chat work and excludes build/packaging.

Validation: Vite build and package verification (1,332 runtime/asset files); 266 AI source tests passed with one existing skip, including 11 grader tests. Actual mouse rotation was observed in the hidden app. Renderer index SHA-256: `664ab8763388b5d4042729eec1e65f8f91914b5e318dbffb1017c9ba2d5af99c`; assets SHA-256: `acc31d286b035cae269104db3c7768c7bca3d6c8b81fd61ccbfb760f324d85ac`.
