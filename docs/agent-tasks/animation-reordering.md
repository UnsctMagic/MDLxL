# Animation reordering

PR: https://github.com/UnsctMagic/MDLxL/pull/359
Branch: codex/animation-reorder-20261028
Session: codex PR 359 test build and compact buttons

## Current state — 2026-10-28

Animations > Reorder opens the existing local/global ordering dialog. The sequence
actions occupy three compact rows: Create / Global, full-width Create from
current, then Delete / Reorder. The Reorder label has no ellipsis in all four
languages. Existing actions, enabled states and sidebar width are preserved.

The packaged UI test checks the row positions, unclipped labels, 84 px action
height and unchanged 240 px sidebar, plus local/global reorder, cancel,
undo/redo, MDX/MDL save/reopen, playback and actual mouse rotation.

## Model evidence

20 distinct real Hive models passed 60 local reorder permutations and MDX
save/reopen; 14 also passed MDL save/reopen within MDLxL. Per-clip
keys/tangents, events, metadata, geoset bounds, sampled motion and unchanged
geometry/rig/texture data were compared. Global IDs were reordered for
8 models while preserving independent clocks. Originals were unchanged.

The live online Hive Sanity Checker parsed every reordered MDX. All 20 retained
the originals' diagnostic counts and normalized issue families. Eleven received
fully clean Passed results, including Wight, Lordaeron Palace, Gilneas Town
Hall, Gul'dan, Khadgar, Kilrogg, Demonologist, Dwarven Fortress, Alleria,
Turalyon and Throne of War. Other baseline findings were preserved.
6 additional unsafe inputs were rejected unchanged (mismatched geoset bounds
or invalid zero-duration global sequences).

Limits: Hive rejects the existing SyncPoint MDL extension in both baseline and
reordered exports (10 comparisons); those are not online passes. An unchanged
Grommash MDL conversion independently fails the existing ribbon Flags save
check. Deathwing already has an invalid Origin Ref path. These are separate
from reordering. No serializer changes were made. Warcraft III was not tested.

Full source suite: 2068 passed, 22 skipped; compatibility: 57 passed. Production
build, packaging and hidden UI passed. Detailed local reports/captures are in
D:\Codex\mdlxl-reorder-validation-20261028. Ready for review; awaiting merge
approval. Version remains 0.35.0.

## Visibility bake follow-up

The existing Bake Sequence RGB and Bake All RGB buttons now use
`bakeGeosetAnimationSettings` to bake the displayed Alpha and RGB together.
Sequence scope, checked geoset scope, labels and notices remain unchanged.
Both channels are prepared atomically and committed as one undo step.

`test/animation-bake.electron.cjs` clicks the real buttons and verifies 25%
alpha in one sequence, zero alpha in all sequences, RGB, untouched unchecked
geosets/other sequences, preserved gap keys, undo/redo, and MDX/MDL saves.
The hidden packaged test passed with zero renderer errors. Focused tests:
54 passed. Full source: 2068 passed, 22 skipped; compatibility: 57 passed.
Detailed results and the refreshed test build are in
D:\Codex\mdlxl-bake-visibility-20261028. No text or version update was made.
