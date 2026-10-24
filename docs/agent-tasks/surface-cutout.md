# Native low-poly surface cutout

Status: ready for review; awaiting merge approval
Owner / consolidator: Codex
Updated: 2026-10-24

## Goal and scope

Implement the supplied surface-cutout handoff in the existing UV Wrapper:
local triangle partitioning, explicit instance targeting, low-poly outlines,
linked preview and one undoable Cut & Separate transaction.
Keep user assets private and immutable. No version bump, merge or release is
authorized. Advanced direct-model markup and geometric mirror remain later work.

## Revision and local state

- Branch: codex/low-poly-surface-cutout-20261024.
- PR: https://github.com/UnsctMagic/MDLxL/pull/289 (open; merge approval pending).
- Base: cb6a66950ac9f965f92ae3a8cb0946b57e8ecbc8, version 0.30.1.
- Isolated Windows checkout: D:\Codex\mdlxl-surface-cutout-20261024\repo.
- The private ZIP and fixture files are local inputs outside the checkout.
  MDLXL_CUTOUT_FIXTURE_DIR enables their optional tests.
- Feature owner and policy: [surface cutout](../SURFACE-CUTOUT.md).

## Verified milestones

- Geometry: real inside/outside partition with no generated center points.
  Synthetic octagon: six piece faces, eleven surrounding faces, +16 total.
- The private two-instance fixture targets the intended upper faces, adds
  twelve piece triangles / +32 overall, and preserves unrelated original
  geosets. Strict mode rejects its mixed-binding partner.
- Reviewed approximation reports maximum sampled error 2.4253 model units
  across 362 poses. It is not exact all-frame motion preservation.
- Production bundle and disposable portable package build successfully.
- Portable private-fixture mouse test passes: source picking, polygon capture,
  normal camera rotation, textured source-only/piece-only inspection, temporary
  RGB, Cancel, Apply, selection, keyboard undo/redo and actual MDX save/reopen.
- MDX to MDL to MDX source/interaction round trips pass.
- Final source suite: 1,901 tests, 1,880 passed, 21 skipped, zero failures;
  the existing CI baseline check passes with no additions.
- Compatibility: 57/57. Focused geometry: 29/29 including the private fixture.
- Final portable synthetic test also passes actual ellipse drag, lasso closure
  and Escape cancellation. The existing UV numpad/move/selection/undo/mouse
  rotation harness passes against the same portable bundle.
- Independent audit of the UI-saved MDX: all 23 protected original raw geoset
  records are byte-identical, including geoset 24. Only GEOS and GEOA chunks
  differ. Both components are eight vertices / six faces at the expected upper
  locations. Coverage, source holes and interior non-overlap pass independent
  floating-point checks.
- Source textures, materials, authored animation records, node data and pivots
  remain unchanged. Private inputs retain their original hashes.
- GitHub CI passed for implementation commit f71de79166b2b53940a942e222b38081b3f0e6a5.

## Handoff boundary

Code and verification are ready for branch/PR review. The initiating Codex task
holds the attached PR and the local report with screenshots and serialized-record
audit. No user installation, profile or supplied asset is replaced.

Cleanup is blocked by automatic approval review: both a bounded bulk removal and
removal of the single verified disposable package directory were rejected with
"blocked by policy"; no further reason was supplied. Generated packages, test
output/profile folders, runtime copies and the dependency junction remain in the
isolated D: task folder. No task-started applications or helpers remain running.
Remove the dependency junction as a link before any enclosing recursive cleanup.

Await explicit owner approval before merging. Warcraft III playback, continuous
animation guarantees and pixel-level lighting equivalence were not exercised.
