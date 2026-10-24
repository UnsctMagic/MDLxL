# MDLxL 0.30.1 release acceptance

Status: active
Owner: Codex release session
Updated: 2026-10-24

The owner authorized merging Paint clipboard import (#284), unattended full testing, release after all checks pass, and the multilingual Garithos announcement. #284 and release preparation #285 are merged. Version 0.30.0 remains an unpublished draft.

Full testing found two runtime blockers. Forge picked the hover-split preview: the screen picker accepted a seam triangle but strict ray-triangle intersection returned null. Cut placement now picks the original draft surfaces and respects the original selected faces. POSE setup enabled Bones for joint picking after Helpers had already been resolved false; explicit Helper visibility now follows setup picking. Existing controls, authored models, undo/redo and normal camera rotation are preserved.

Hidden native integration checks passed all Forge cuts and POSE ragdoll assertions after these changes, including actual mouse rotation, connected joints, save/reopen, unchanged source bytes and undo/redo. The release verification also refreshes stale test controls, shader observation, hidden evidence capture, teardown and manifest-only updater fixtures; no behavior/data assertions are removed.

Candidate 0.30.1 includes the full unpublished 0.30.0 change set plus these fixes. Notes are in English, Spanish, Russian and Simplified Chinese. Remaining: source/compatibility CI, fresh official draft ZIP, complete app suite and portable updater gate on that ZIP, website notes, publication and Garithos verification. The updater gate already passed on the superseded 0.30.0 ZIP; it must be repeated on 0.30.1. No publication is allowed while failures remain.
