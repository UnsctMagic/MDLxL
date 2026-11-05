# MDLxL 0.38.0 release

Status: completed — release published 2026-11-04
Owner / consolidator: Codex, continuing Claude's release lane

## Shipped

- [Release v0.38.0](https://github.com/UnsctMagic/MDLxL/releases/tag/v0.38.0), published as latest after the owner's explicit merge/tag/publish/Garithos approval.
- [Release PR #541](https://github.com/UnsctMagic/MDLxL/pull/541) merged at `63b3f4dca1775818063bd0556ee0b9659347bf5b`; tag `v0.38.0` points to that exact commit. Online main's package version was verified as 0.38.0.
- Includes the new layout and geoset tabs, Compact Set, shared Workplane Constraints and Shift lock, frame-coalesced drags, FX, EMTR placement, Sphereomancer, World Editor Style textures, Nuclear Weld, Fix model, direct per-model AI chats, startup fallback, Hive-only Sanity Check and translation catch-up. The four full release logs are `docs/RELEASE-0.38.0{,-ES,-RU,-ZH-CN}.md`.
- Nineteen release assets: the versioned portable ZIP and checksum, 16 EN/ES/RU/ZH-CN guide PDFs (AI Sign-in, Interface Map, AI Guide, New Features), and FFmpeg corresponding source. The fixed ZIP name begins at 0.39.0.
- [Website release notes](https://www.lowpolyworks.com/mdlxl/?version=0.38.0), uploaded as their own four-language JSON card and merged through [LowPolyWorks #57](https://github.com/UnsctMagic/LowPolyWorks/pull/57). No release folding or release-feed code change.
- [FX tutorial](https://www.lowpolyworks.com/mdlxl/tutorials/fx/) publication followed the release, through [LowPolyWorks #58](https://github.com/UnsctMagic/LowPolyWorks/pull/58), using the previously reviewed four-step package in five languages.

## Verification and limits

- [PR CI](https://github.com/UnsctMagic/MDLxL/actions/runs/41749883609), [merged-main CI](https://github.com/UnsctMagic/MDLxL/actions/runs/41752119136), and [draft package workflow](https://github.com/UnsctMagic/MDLxL/actions/runs/41752197431) succeeded. Claude's handoff recorded compatibility 57 pass / 0 fail / 0 skip and source 2,798 pass / 0 fail / 9 existing skips.
- Claude's full packaged run covered 231 checks before the repair lane: 161 pass / 64 fail / 6 explicit skips. The repairs and focused final reruns supplement that run; this is not a claim that a fresh full packaged suite passed.
- Final 39-check packaged rerun: 36 pass / 3 fail. `particle-prototype` is on the owner's kept list. `particle-library-layout` failed because the supplied profile lacked settings; it passed in 67 s with a disposable copy of existing settings and the genuine current-game catalogue. `particle-workflow` failed at the post-drag translation read, then passed unchanged in 13 s on the same final package. Focused follow-up: 2 pass / 0 fail. Earlier `emtr-add-like-ribbons` lacked its required profile variable; the final rerun passed all ten checks in 112 s. No new application regression was confirmed.
- The six full-run skips were opt-in signed-in AI (`ai-live-tabs`, `ai-live`), copied-profile indexing (`particle-library-indexing`), old-baseline performance (`particle-performance`), the legacy 0.20.1 ZIP (`updater-bootstrap`), and the separate manual HTTP release gate (`updater-release-gate`). None was added to conceal a failure. The separate release gate passed.
- Existing updater gate logs at `D:\Claude\MDLxL-gate\logs-0.38.0` confirm candidate → A → B → offline revert, 35 blocked relaunches per update cycle, preserved personal data and no hash mismatches on revert. This fixture gate does not prove GitHub CDN delivery.
- All 19 release-body download links matched uploaded assets. Staged asset sizes and available GitHub SHA-256 digests matched. All 16 downloaded public PDFs opened. Public ZIP SHA-256 matched its public `.sha256`: `d1fcbb02f90f05fae2f841423b7974dc07b7a3bc4df4541fab11e42383b86510`.
- Public `releases/latest` returned `v0.38.0`; all four live website JSON translations matched the final release source; a background browser rendered the 0.38.0 card, Workplane Constraints and Sanity Check notes.
- [Mega Garithos Discord workflow](https://github.com/UnsctMagic/MDLxL/actions/runs/41752824457) succeeded after publication. No second Discord announcement or edit was sent.
- Warcraft III gameplay was not exercised in this completion session. The owner's installation, real profile and unrelated MDLxL processes were not modified. The release worktree and permanent test-model collection were retained as requested.

## Owner's kept follow-up list

This is the owner's complete deferred list; some checks now pass. It does not say that every listed test still fails:

`citadel-locales`, `game-file-library`, `particle-world-effects`, `pose-complex`, `pose-ik`, `showcase`, `showcase-layout`, `showcase-queue`, `showcase-recording-particles`, `visual-effects-review`, `updater-packaged`, `event-sound-scroll`, `manager-simplification`, `tree-appearance`, `citadel-studio`, `particle-prototype`.

See [the repair lane](release-038-test-repairs.md) for exact stale-test, environment and unresolved-render findings. Assertions and the failure baseline were not weakened during release completion.

## Handover

Evidence retained at `D:\Codex\mdlxl-0.38.0-finish`. Finished, identifiable Codex chats with clean source worktrees were archived after publication. Chats with open PRs or retained test work, the active release chat, and other-tool sessions were left available. No remaining release publication action requires approval.
