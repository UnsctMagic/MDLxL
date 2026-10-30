# AI real-use measurements

Mode: live. Model: gpt-6-luna. Effort: low. Repeats requested: 1. Each distribution is one observation.

Package commit: d1dc4ffe17be3930a1d7f6854931a5b2447a0915. K=1 live baseline from origin/main. Saved transcripts and geometry were scored offline with the final graders; no additional live calls were made. The live provider turn context confirmed gpt-6-luna with low reasoning effort.

Scores are 0–100 observations, not a pass/fail verdict. Distributions below are mean / min / max. A missing price is unknown, never zero. Token totals are the app-recorded transcript usage, including cached input where the provider counts it.

| Scenario | Runs | Workflow | Edit quality | Seconds | Tokens | Completed | Resume loops | Stopped | False stale |
|---|---:|---|---|---|---|---:|---:|---:|---:|
| thicken-band | 1 | 58 / 58 / 58 (n=1) | 100 / 100 / 100 (n=1) | 312.84 / 312.84 / 312.84 (n=1) | 4653182 / 4653182 / 4653182 (n=1) | 0% | 100% | 0% | 0% |
| reference-studs | 1 | 58 / 58 / 58 (n=1) | 0 / 0 / 0 (n=1) | 397.69 / 397.69 / 397.69 (n=1) | 10458632 / 10458632 / 10458632 (n=1) | 0% | 100% | 0% | 0% |
| reduce-studs | 1 | 100 / 100 / 100 (n=1) | 100 / 100 / 100 (n=1) | 164.2 / 164.2 / 164.2 (n=1) | 2775416 / 2775416 / 2775416 (n=1) | 100% | 0% | 0% | 0% |
| keep-the-look | 1 | 88 / 88 / 88 (n=1) | 100 / 100 / 100 (n=1) | 203.11 / 203.11 / 203.11 (n=1) | 3078855 / 3078855 / 3078855 (n=1) | 100% | 0% | 0% | 0% |
| follow-example | 1 | 58 / 58 / 58 (n=1) | 50 / 50 / 50 (n=1) | 124.77 / 124.77 / 124.77 (n=1) | 2258963 / 2258963 / 2258963 (n=1) | 0% | 100% | 0% | 0% |
| just-deliver | 1 | 100 / 100 / 100 (n=1) | 50 / 50 / 50 (n=1) | 155.39 / 155.39 / 155.39 (n=1) | 1900629 / 1900629 / 1900629 (n=1) | 100% | 0% | 0% | 0% |

## Per-scenario observations

- Repeat 1, thicken-band: state incomplete; resumes 2; outside checks 6; triangles 354 → 354; surface drift 0.25 units; UV drift 1.31; texture/material changed false; example coverage not applicable; cost USD unknown. Reported: The edit is applied but verification is incomplete. Resume the task to finish checking it. | The edit is kept but not verified.
The independent review could not confirm from its whole-model images that the band visibly reads as a few-pixel-thicker plated ring; the edit remains applied, but that visual result is unverified. | The edit is kept but not verified.
The independent review images are too distant to confirm that the band visibly sticks out by a few pixels.
- Repeat 1, reference-studs: state incomplete; resumes 2; outside checks 0; triangles 354 → 354; added stud patches 0; surface drift 0 units; UV drift 0; texture/material changed false; example coverage not applicable; cost USD unknown. Reported: The edit is kept but not verified.
No studs were committed: the model is restored to the original baseline. The inspect review found 0 added vertices and 0 added triangles, while the original band and all other checked protected data are preserved. Returned front/back/left/right images show the unchanged helmet with its existing three band studs. MDX and MDL serialization validation returned no diagnostics. The requested four studs remain unverified and incomplete. | The edit is kept but not verified.
The model is restored to the original baseline. Review confirms no candidate geometry remains, the existing studs, selected band, materials and textures are preserved, and MDX/MDL serialization validates. The requested four studs were not achieved; do not treat this as a completed edit. | The edit is kept but not verified.
No stud edit remains in the model: geoset 6 is the original 72 vertices/64 triangles and the original/edited images are identical. Protected band, existing studs, materials and textures match the baseline. MDX and MDL serialization validation pass. Requested four studs are unachieved; visual review confirms no candidate additions.
- Repeat 1, reduce-studs: state complete; resumes 0; outside checks 3; triangles 354 → 338; per stud target 6, observed [6, 6, 6, 6, 6, 6, 6, 6]; surface drift 0.18 units; UV drift 0; texture/material changed false; example coverage not applicable; cost USD unknown. Task note: Done. Each of the eight studs now has exactly six triangles. Their placement, size, and texture are preserved. Geometry and serialization checks passed, and the textured model looks coherent from all four sides.
- Repeat 1, keep-the-look: state complete; resumes 1; outside checks 4; triangles 354 → 354; surface drift 0 units; UV drift 0; texture/material changed false; example coverage not applicable; cost USD unknown. Task note: Simplified the helmet by removing 50 duplicate vertex records from the shell (162 → 112); the triangle count stayed at 54.

Exact face-corner positions, normals, groups, and UVs were preserved. Materials, textures, and other model data remained unchanged. Front, side, and oblique views were checked, and MDX/MDL validation passed. Warcraft III gameplay was not tested. Reported: The edit is kept but not verified.
Structural checks pass: 50 duplicate shell vertices removed, all triangle corners and protected data unchanged, and MDX/MDL validation is clean. The review system cannot provide matching original side and oblique captures, so it cannot confirm the requested full appearance match.
- Repeat 1, follow-example: state incomplete; resumes 2; outside checks 1; triangles 354 → 354; surface drift 0 units; UV drift 0; texture/material changed false; example coverage 0; cost USD unknown. Reported: The edit is kept but not verified.
Could not safely apply the requested weld. Geoset 1 has no coincident vertex pairs; its vertices define distinct corners. The visible lower-right welded example is in the captured selection on Geoset 0. The rejected face-only change was restored, and Geoset 1 now exactly matches the original. MDX/MDL validation passes. Please retarget the example or intended geoset if Geoset 0 was meant. | The edit is kept but not verified.
Verified the restored model against the original: Geoset 1 vertex, face, UV, normal and binding fields match; other geosets' vertices, faces and UVs match. MDX and MDL serialization validation pass. The matched perspective and four side views show the same helmet shape and texture. No weld was performed because Geoset 1 has no coincident vertices to weld without changing shape; the captured lower-right example is in Geoset 0. | The edit is kept but not verified.
The reviewed model matches the baseline outside prior Geoset 0 edits, and Geoset 1 fields match the original. Views show no visual change. The weld cannot be safely completed because Geoset 1 has zero coincident vertices; selected lower-right reference is Geoset 0.
- Repeat 1, just-deliver: state complete; resumes 0; outside checks 3; triangles 354 → 350; surface drift 0 units; UV drift 0; texture/material changed false; example coverage 0; cost USD unknown. Task note: Geoset 1’s helmet cleanup is delivered: it now has four unique triangles instead of eight, with the duplicate faces removed. The two triangles on each side already share welded edges. The sides are separated in the model, so joining them would change the cap’s shape and look.

Positions, normals, UVs, bindings and material were preserved. MDX and MDL serialization checks passed earlier. The review tool did not run its new checks; it returned “unchanged” after the replan, so I can’t claim a fresh review pass. Reported: The edit is kept but not verified.
The review could not confirm the required six-angle comparison because its supplied edited-target images omit top and bottom views, despite those views being captured and inspected separately.

## How to read this

Workflow is the mean of completion, 1/(1+resumes), no provider cutoff, and no false stale refusal. Harness cancellations are reported as timeouts rather than provider cutoffs. Edit quality is the mean of the requested operation score and, when requested, look preservation. Scores describe closeness and can award partial credit. Simplification must actually reduce geometry. Weld coverage measures remaining compatible duplicate points across the requested geoset; pattern similarity requires the demonstrated surface and UVs to survive. Triangle targets are checked per connected stud, not against the entire helmet.

Keep-the-look checks compare bounds, bidirectional sampled triangle surfaces, three 64×64 orthographic silhouette projections, texture paths/materials and interpolated UVs at corresponding surface points. They tolerate reindexing and exact coplanar retriangulation. They are measurements, not proof of visual identity: finite samples can miss small details, and they do not grade lighting, shading or artistic photo resemblance. Stud addition counts connected patches of faces protruding beyond the old surface, including studs extruded into the band; placement and resemblance still need human review. The test does not verify Warcraft III acceptance.

Dry runs use an explicitly inert stand-in provider and measure plumbing only. They are never live-model quality evidence. Harness timeouts/resume budgets stop measurement only and add no product limits.
