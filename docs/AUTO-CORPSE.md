# Auto Corpse

The temporary **CORP** button lives in the existing VIS toolbar row. It opens
the small Auto Corpse window (`app/AutoCorpse.jsx`, laid out like
Attachemator): a preview that turns with the mouse, **Size** and **Height**
sliders in AnimXL's slider style (25–200%, 100% = fitted), **Show body** and
**Reset**. The preview shows the corpse alone at the start of Decay Bone, or
under the body 200 ms into Decay Flesh with Show body. **Create** runs one
undoable edit and selects Decay Flesh; **Close** changes nothing. Size scales
the fitted corpse's footprint about its centre; Height scales how far each
piece rises above its own level. Above 100% the corpse is no longer fitted
under the body and can show through it while the body sinks; the tooltips
say so. Burial before the last-frame hide still uses the scaled corpse.
Creating again regenerates from Death and does not accumulate copies.

## What owns the result

- `src/corpse-geometry.js` samples the literal last frame of each Death variant
  using the existing animation evaluator and POSE recognition. It fits native
  gutz skull, rib/pelvis, limb and extremity regions to the posed body. Landmark
  lengths retain the joints' positions; widths come from the skin, including
  skin on Mesh/Box children of the controlling joints. Width is not capped by
  bone length. A wide body with the same joint layout therefore gets wider ribs
  and limbs. Heads sharing one torso use a shared central rib cage.
  Connected body components distinguish a hand/head from equipment sharing its
  binding. The existing polygon boolean owner trims complete corpse triangles
  to the posed body outline, preserving UVs and interior volume.
  Forearms continue into the atlas's hand region; legs continue to the foot's
  skin tip in the native long-bone regions, never stretched hand texture.
  Each limb and rib piece is a rounded lump, not a flat decal: its middle
  rises by 60% of its half-width and, where the body rests on the ground,
  to 40% of the body's own thickness there. Native gutz corpses top out at a
  median 39% of the dead body's height in the study; the fitted corpses now
  measure a median 40% on the same models.
  Whatever hangs below a hand is held equipment (a weapon, its head or
  chain, a carried object) and never becomes a skull, limb or branch,
  whatever its bones are called.
  A body whose head is not recognized still gets a trunk: the skin of the
  joints its limbs hang from, along that skin's long axis.
  A joint that fans out to several pieces is linked to them only where the
  body actually lies along the link; spokes to scattered pieces are skipped.
  A single continuing link, such as a tail tip, is kept.
- `src/auto-corpse.js` applies the edit through `EditorDocument`. It reuses
  matching Decay Flesh/Bone intervals, promotes matching generic Decay to Decay
  Flesh, or appends 60-second non-looping clips. Alternate Death variants have
  separate matching decay clips and terminal poses.
- `app/App.jsx` owns the normal edit/Undo/selection path; `AppToolbar.jsx` owns
  only the compact temporary button. The normal camera controls remain active.

The original body vertices, UVs, bindings and authored transform curves remain
unchanged. Separate body meshes hold the last Death pose during Decay Flesh,
including models whose original rig has global motion. Their material/UV
appearance is sampled at that frame. Original body meshes are hidden in the
generated decay intervals. Existing corpse meshes are hidden so they do not
overlap the fitted corpse.

Bones switch on at 167 ms into Decay Flesh, matching the studied Footman. They
remain covered by the body, which moves vertically underground. Bone decay then
lowers the fitted corpse. Each burial distance is calculated from the highest
posed vertex and a size-dependent clearance; both phases hide their geometry on
the final frame. Corpse vertices start above the ground even when the original
Death mesh penetrates the floor, so limbs are not buried before decay begins.
Elsewhere every corpse vertex keeps a clearance (0.6% of the body span, at
least 0.25) below the lowest body surface in its small neighbourhood. A
corpse almost touching the body's visible surface z-fights, and a piece
poking through pops into view when the bones switch on; both read as
flicker right after Death.
Corpse pieces that overlap each other (ribs under an arm, a skull on the
ribs) would z-fight with each other in the same way, most visibly in Decay
Bone once the body is gone. Each overlapping piece therefore gets its own
level, one band of 0.15% of the span (at least 0.15) above the next, ribs
lowest. Where the body leaves too little room for every band, the bands
close up instead of poking through the body.
Effects and attachments are masked in those decay intervals;
ordinary Death events and original transform animation are retained.

The output uses Warcraft's `Textures\gutz.blp`, native geosets, materials, bones,
sequences and visibility tracks. No runtime editor dependency or imported game
texture bytes are embedded in the saved model.

## Study and verification

`scripts/audit-corpse-decay.mjs GAME OUTPUT` reads 100 unique base SD models from
the locally installed Warcraft III CASC. It records asset paths, SHA-256 hashes,
terminal Death geometry, original decay durations, sampled body/corpse movement,
visibility and rig hierarchy. The selection spans Human, Orc, Undead, Night Elf,
critters, Naga, creeps and demons. Read the compact measurements in
`research/auto-corpse-models.json`; game binaries are not committed.

The native examples establish a separate broad, textured corpse beneath the
body, rather than a line representation of its rig. The initial prototype's
direct-joint-only skin lookup missed mesh children and produced thin strips;
that approach was rejected. The implementation measures the actual skin and
uses the correct top-right skull region of the gutz atlas. Wisp and Statue-style
effect deaths are outside the requested scope.
Some flying units also shrink their whole body to 0.001 scale at the literal
final Death frame. These do not supply a physical terminal pose: the command
reports the collapsed pose and leaves the model unchanged. The verifier records
these separately instead of counting an almost invisible corpse as a success.

Run:

```
node --test test/auto-corpse.test.js test/localization-catalogs.test.js
node scripts/audit-corpse-decay.mjs GAME OUTPUT
node scripts/verify-auto-corpse.mjs OUTPUT REPORT.json
```

The corpus verifier checks the exact terminal body pose, original geometry and
transform preservation, burial before each final-frame hide, MDX/MDL reopen,
Undo/Redo and repeat-click behavior. A source MDL export limitation is reported
separately only if the untouched input reproduces the exact same error.

`test/auto-corpse.electron.cjs` uses a hidden production or packaged window with
an isolated profile. Set `MDLXL_CORPSE_FIXTURE`, `MDLXL_TEST_OUT`, and optionally
`MDLXL_TEST_EXE` and `MDLXL_PLAYWRIGHT_MODULE`. It verifies the actual button,
normal mouse camera rotation, native Save As in both formats, Undo/Redo and
repeat clicks. Captures use the same camera for the body and its corpse. Test
profiles are removed on exit. `MDLXL_CORPSE_CAPTURE_ONLY=1` captures other study
models without repeating the interaction suite.

## Boundaries

This is automatic geometric fitting, not per-model artistic approval. The study
uses SD models; a model with an unusual unnamed rig, billboarded anatomy or HD
palette constraints still needs visual review. The command reports an error
atomically when no body exists, the final pose is collapsed, the timeline has no
room, or visibility cannot be made sequence-local without altering global
behavior. It does not silently erase global animation to complete a command.

Flying units' Death falls far below the terrain (for example Gargoyle,
Harpy, Gryphon Rider), and some deaths turn into an effect (Dreadlord bats)
or a separate bone pile (summoned Skeleton). Warcraft III leaves no corpse
for those units, so their fitted corpse is not tuned.

The native preview has no opaque terrain surface by default, so a sunk body can
remain visible below the grid during scrubbing. The final-frame visibility is
explicitly zero, and numerical checks independently verify Z burial. Warcraft
III gameplay acceptance is separate from the native renderer and file checks.
