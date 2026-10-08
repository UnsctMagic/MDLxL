# Portrait animated bounds repair — 2026-10-08

## Community evidence

- [Hive: Issue with pitch black portrait animation](https://www.hiveworkshop.com/threads/solved-issue-with-pitch-black-portrait-animation.324885/): only some Portrait variants went black. GhostWolf recommended recalculating extents; the author confirmed the repair. The author also noted that including a portrait background in general model bounds can affect the health bar.
- [Hive: Why is this portrait not working?](https://www.hiveworkshop.com/threads/why-is-this-portrait-not-working.357804/): the author confirmed a repair after recalculation of extents and normals. This is supporting evidence, not proof that normals need changing in the present files.
- [XGM: animation visibility bug](https://xgm.guru/p/wc3/205553): a newly authored animation disappeared at the viewport edge; recalculating bounds was the accepted, confirmed solution.
- [XGM: Makeba's model repair report](https://xgm.guru/user/Makeba/comments/57): a report links incorrect geometry bounds with both failed selection and a missing portrait. Its mesh-deletion workaround is model-specific and is not applied here.

These firsthand reports identify animated extent/culling errors as a cause of black portraits. They do not establish that every black portrait has this cause. No repaired counterpart was used to choose this patch.

## Current source defect and correction

`recalculateExtents` deliberately updates only bind-pose geometry and model bounds. That behavior remains appropriate for its existing callers and is unchanged. However, Set Current View called only that function; portrait rig edits did not refresh sequence or geoset animation bounds. Creating a portrait copied static bounds despite shared global animation still being active.

The new portrait operation uses the existing native-renderer bounds calculation and updates only Portrait sequence extents and their matching geoset `Anims` entries. It runs when setting a camera, creating a portrait, or committing node edits in the portrait workspace. The common commit covers numeric fields, timeline edits, and mouse gestures. Temporary drag previews do not run a complete sweep.

Bounds are sampled at endpoints, authored transform keys and regular subframes. Portrait callers additionally include global-key occurrences within the interval. The optional global-key sampling leaves OptimizeXL's existing default calculation and detection unchanged. This remains sampled coverage, not a mathematical envelope for every possible spline extremum or independent global-sequence phase.

The bounds operation does not change cameras, rig keys, mesh vertices, normals, UVs, materials, texture references, model/bind-pose extents, or non-Portrait animation extents. Set Current View retains its existing camera-authoring and bind-pose recalculation behavior. No UI, version, installation, or release change is included.

## Supplied-model evidence

Private models and repaired copies are outside Git under `out/portrait-extents/repairs`.

| Input | Portrait variants | Geosets with sampled positions outside their saved bounds | After repair |
| --- | ---: | ---: | --- |
| Desktop `WH_VC_StrigoiLord_04.mdx` | 3 | 17 | All sampled points contained |
| Downloads `WH_VC_NecrarchLord_Final_SpellSlam_Fixed (1).mdx` | 4 | 16 | All sampled points contained |

Each variant was checked at 181 times using the native renderer after MDX save/reopen. Only `SEQS` and `GEOS` chunks changed; field comparison confirmed that only the targeted extent fields changed inside them. All other chunks, all rig keys, and all non-Portrait sequence/geoset bounds match exactly. Original files retained their SHA-256 hashes. No normals or animation keys were removed.

## Verification

- 42 portrait, sequence-editor and animated-bounds tests passed, including undo/redo, MDL/MDX round trips, preservation, moved/rotated roots, new portraits with global motion, and missing extent entries.
- 57 format compatibility tests passed.
- 116 OptimizeXL source tests passed; its detector and default repair behavior remain unchanged.
- The available immutable Flail01 fixture passed all 31 recorded result comparisons, including the previously approved authored-key-retention exception. Golden hashes were not changed; the matching Flail03 input was not available locally.
- Production build and portable package validation passed: 546 runtime/asset files and 55 locale files.
- Packaged Electron: Set Current View repaired deliberately stale bounds through real Save As; numeric Control Model movement updated every Portrait variant and persisted the actual move; normal camera rotation control plus mouse drag changed the camera; sidebar width and source bytes were preserved. The rendered portrait and compact layout were inspected.
- Four failures in `editor-document.test.js` reproduce on untouched HEAD: node deletion/reference remapping, unset/static visibility serialization, unsupported-version expectation, and conversion expectation. The other 19 tests in that file passed on both revisions.

Warcraft III itself was not exercised. The extent defect and editor/export correction are verified; the supplied repaired copies still require an in-game portrait test before claiming the user's black-frame symptom resolved.
