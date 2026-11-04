# OptimizeXL exact redundancy

Status: ready for review; awaiting independent Claude QA and merge approval
Owner / consolidator: Codex
Updated: 2026-11-04

## Goal and completion criteria

Add the Slaanesh Champion study's exact cleanup capabilities without changing
established optimizer results. Keep existing preview, approval, Back and save
controls. No merge, release, version bump or installed-profile change authorized.

## Revision and local state

- Branch: `codex/optixl-exact-cleanup`.
- PR: https://github.com/UnsctMagic/MDLxL/pull/548.
- Implementation: `de0a436952842a4cd4356ccbb9a054634ef1d1e4`.
- Base: `f67cbb5564c9e5f47a1b4f3c2a5ab0d661738efa`.
- Disposable checkout: `D:/Codex/optixl-exact-cleanup-20261104` (removed after push).
- Evidence: `D:/Codex/optixl-exact-cleanup-results-20261104`.
- Private fixtures: `test/helpers/fixtures.cjs` names `optimizexl-exact-unit` and
  `optimizexl-exact-hero`, under permanent `MDLxL-TestModels/optimizexl-exact-cleanup`.
  The original supplied MDX bytes and study references remain private.

## Relevant owners

- `src/optimizexl-exact-cleanup.js`: one additional explicit cleanup proposal,
  stale target validation, static conversion and permanently collapsed faces.
- `src/optimizexl-animation.js`: terminal holds shared with world mode.
- `src/optimizexl-world-animation.js`: same existing terminal eligibility/results.
- `src/optimizexl.js`: existing Insanity FIxer catalog and batch/Fix everything flow.

## Findings and decisions

- Existing duplicate/local-animation/unused/Nuclear outputs remain unchanged.
  Additional cleanup is separately previewed and approved as Remove exact redundancy.
- Existing pending corrections retain track ownership. Exact cleanup waits for
  them, then rescans. Track cleanup waits for timeline relocation and structural remapping. World mode
  shares terminal-hold code; stale proposals cannot overwrite its result.
- New cleanup supports step/linear tracks; existing cubic reducers stay unchanged.
- Static conversion is limited to GEOA alpha/colour with matching static base and
  defaults, or identity node TRS. Editor RGB passes through the existing codec.
- Geoset 9's reference RGB swap was a separate conversion error, considered minor
  by the owner. The owner accepted geoset 35 visually. Neither disqualifies the
  optimization lessons; the new implementation preserves both colours and the
  unanimated base instead of copying the reference's representation blindly.
- Collapsed-face proof requires exactly coincident positions and identical ordered
  skin influences, including multiplicities. The order guard also preserves native
  floating-point sums. All-collapsed geosets remain for the existing object owner;
  earlier unused vertices remain for Unused data. Bounds and additive duplicates stay.

## Changes and verification

- New source checks failed first: 7 fail / 1 pass before implementation.
- New hidden packaged check failed first at selecting the absent cleanup option.
- Final source: 2,823 pass / 0 fail / 9 existing skips (reasons in verification guide).
- Compatibility: 57 pass / 0 fail / 0 skip. New exact-cleanup source cases: 13/13.
- Final hidden packaged workflows: 8 pass / 0 fail / 0 skip. Preview, actual paired
  mouse rotation, selected/individual approval, Back and saved bytes pass.
- One source run overlapped a rebuild and missed dist/particle-runtime.mjs; the
  complete source rerun after the build passed without code or baseline changes.
- Study replay: both files save 8,728 bytes, 90 changed tracks each. Across all 15
  sequences, 13,227,660 exact track/time comparisons per model match, and 135 native
  renderer poses per model have zero retained-vertex deviation. Geometry, rig,
  original inputs, animated colours and Unanimated colours are preserved.
- Existing world-zero savings remain 4,684 bytes; new cleanup then world-zero saves
  9,628 bytes total per file.
- Immutable flail verification passes all 56 original comparisons with unchanged
  golden files and the existing authored-key/weld/serializer exceptions.
- Final packaged/source checks pass; PR #548 is open.
- The historical mounted reference uses old preset index 4 (current index 3) and
  matches the unchanged golden hash before the existing serializer exception.
- Three packaged fixtures gain one proposal each (172->173, 188->189, 1->2).
  Direct comparison with base source proves every old proposal/evidence identical.
  Count assertions explicitly include the addition; the bounds check unchecks it
  to retain its original bounds-only saved-byte assertion.

## Next action

Independent Claude QA and owner merge approval remain separate gates. Review
PR #548 and its CI status. The small D: report/capture and permanent private fixtures
are retained; the pushed disposable worktree is removed.
Warcraft III playback has not been exercised.
