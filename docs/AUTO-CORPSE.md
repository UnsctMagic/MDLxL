# Auto Corpse

The temporary **CORP** button lives in the existing VIS toolbar row. It opens
the small Auto Corpse window (`app/AutoCorpse.jsx`, laid out like
Attachemator) with two tabs and one preview that turns with the mouse.
**Create** runs one undoable edit for both tabs and immediately shows the
first frame of Decay Bone, paused; **Close** changes nothing; **Reset** goes
back to the fitted corpse and the model's own blood. Creating again
regenerates from Death and does not accumulate copies.

**Corpse Editor** shows the corpse at the start of Decay Bone, with a chalk
line around where the dead body lies (**Body outline**, on by default; it
follows the body only, not what it holds). **Show body** puts the textured
body back over the corpse.
- Double-click a body part in the preview to grab it, then drag the
  EMTR/Glow Up handles (`app/CorpseStageTools.jsx`): the middle moves it,
  the ends stretch it, the side handle widens it. Double-click empty ground
  to let go. Delete removes the grabbed part. Ctrl+Z / Ctrl+Y undo and redo
  changes inside the window.
- **+ Skull / + Ribs / + Bone / + Hand** add a part in the middle of the body.
- **Size** and **Height** sliders in AnimXL's slider style (25-200%, 100% =
  fitted) and **Color Tint** R/G/B, like the Animations colour tint.

**Blood Editor** (`src/corpse-blood.js`) plays or scrubs the Death animation
with its splats and sprays. It works like Blizzard's own units, which bleed
with 2–5 ground splats (`SPL` events from `Splats\SplatData.slk`, code =
race letter + B + S/L + shape 0–3: H red, O dark red, U undead, E night elf,
D green demon) and one spray model (an `SPN` event from
`Splats\SpawnData.slk`; blood sprays have B as their second letter and
spawn particle-only models). The list starts with the Death animation's own
blood. Every splat and spray has its own **Kind** (human red, orc, undead,
night elf, demon green; sprays also other creatures, whose spray codes start
with another letter; night elf sprays start with N). A splat's kind is its
colour; a spray's kind narrows its list to that kind's sprays and starts
with that kind's plain small spray. New blood takes the kind picked last.
Each splat also has Size and Shape; every row has a Time
(**Now** takes the preview's time) and a position dragged with the move
handle. Only blood keys inside the first Death animation are replaced; keys
in other animations and all non-blood events stay. Community blood models
were studied (Hive Workshop, XGM) but are not bundled: their credit terms
could not be confirmed, and the game's own blood ships with every copy.

## Design rule (owner, 30 Oct 2026)

CORP is a normal Warcraft III style corpse maker. The body is already there in
the Death animation; decay continues from it.

- Pressing **Create** takes the **last frame of Death** as the starting pose of
  decay.
- The body goes down and disappears exactly as Blizzard's own units do: the
  same body geosets stay visible and the bones are keyed to hold that pose and
  sink. No copies or extra parts are made for the body.
- CORP creates **only the corpse**: the body parts left behind for decay
  (gutz). The corpse is sized to the unit, easy to adjust, and parts are easy to
  delete and add.

Codex's first version (PR #276, 23 Oct 2026, in 0.33.0–0.36.0) made a frozen
copy of every body geoset for Decay Flesh and hid the real body. The owner's
verdict, in their words: "Codex is a FUCKING idiot." 0.37.0 replaced it with
the Blizzard way below; a repeat Create on a model made by the old version
removes the old copies.

## What owns the result

- `src/corpse-geometry.js` samples the literal last frame of each Death variant
  with the shared animation evaluator and POSE recognition. Skull, ribs/pelvis,
  leg bones and hands are fitted to the posed skin of their own body parts.
  Shared body surfaces retain all disconnected skin patches (including belly
  panels and boots); keeping only the patch nearest a joint produced tiny parts.
  Hands keep the closest palm component so a club or shield sharing the binding
  cannot set their size. A hand reference without skin uses its lower-arm skin.
  Following the owner's correction, a normal articulated arm gets an upper-arm
  bone plus the native hand picture over its forearm (reach 1.62 forearms).
  A chain with no separate upper-arm segment keeps its hand piece. Each leg
  gets two long bones, with its lower part including the foot skin. No copied
  body is made. Recognized tail joints own their skin even when POSE exposes
  only the terminal tail handle; tail skin cannot lengthen the rib cage.

  The automatic fit measures the union of the projected corpse meshes and targets
  0.826 of the chalk-outline area: the median measured on 206 Blizzard SD units
  with a visible gutz corpse. The fit retains each part's length and location,
  adjusting widths to reach that area; the native skull scales uniformly about
  its head centre, preserving width/length 0.724, crown/length 0.42 and base/length
  0.218. The owner explicitly chose native overall size with small overhangs over
  strict containment (30 Oct 2026). This is mesh footprint area, including the
  transparent padding of the gutz rectangles, not an alpha-pixel measurement.
  Targeting the median does not reproduce every species' native corpse ratio.
  Owner review of the captures remains the acceptance gate.

  The chalk outline stays the equipment-filtered final body footprint. Default
  fitting can grow or shrink; it no longer repeatedly shrinks every piece whose
  rectangular corners cross the outline. User-edited pieces bypass automatic
  fitting, and the existing Size/Height controls retain their behavior.
  Held skeletons remain excluded. A separate Death chest with a POSE-recognized
  anatomical root still supplies its head, as on the owner's dismembered Ratling;
  a separate named flail root does not. Heads sharing a torso share one rib cage.
  Headless bodies retain the existing skin-based trunk and rigid-remnant rules.
  Height layering keeps overlapping parts apart; Decay behavior stays in its
  existing owner below.
- `src/auto-corpse.js` applies the edit through `EditorDocument`. It reuses
  matching Decay Flesh/Bone intervals, promotes matching generic Decay to Decay
  Flesh, or appends 60-second non-looping clips. Alternate Death variants have
  separate matching decay clips and terminal poses.
- `app/AutoCorpse.jsx` resolves the draft's native gutz texture with the existing
  game-data loader when the original model did not use it. Supplied model
  textures retain precedence.
- `app/App.jsx` owns the normal edit/Undo/selection path; `AppToolbar.jsx` owns
  only the compact temporary button. The normal camera controls remain active.

Decay works like Blizzard's own units (measured on 208 SD units with Decay
Flesh and Decay Bone, 30 Oct 2026). The body geosets that show at the end of
Death stay visible through Decay Flesh and switch off on its last frame; Decay
Bone shows only the corpse. Every bone that moves the body gets one key at the
start of Decay Flesh that holds its last-Death value, and each top bone gets a
straight-line key pair that carries the body down. A top bone that bobs on a
global loop (ships) keeps bobbing and hands the drop to the bones under it.
Global loops keep running in decay, as on Blizzard's units; a body bound
directly to a globally moving top bone is refused. Keyed layer and UV
animation, layer alpha and geoset colour likewise hold their last-Death value.
A body that switches off on exactly the last Death frame shows whole in decay.
Only keys inside the decay clips change: body vertices, UVs, bindings, living
animations, Death and keys elsewhere stay as they are. Existing corpse meshes
are hidden so they do not overlap the fitted corpse.

Bones switch on at 167 ms into Decay Flesh, matching the studied Footman. They
remain covered by the body, which moves vertically underground. The burial
distance is calculated from the highest posed vertex and a size-dependent
clearance. In Decay Bone the corpse lies completely still where Decay Flesh left
it and shows until the last frame, exactly as on all 206 SD units that have a
corpse (measured frame by frame, 30 Oct 2026); the game itself sinks the remains
afterwards. Both phases hide their geometry on the final frame. Corpse vertices start above the ground even when the original
Death mesh penetrates the floor, so limbs are not buried before decay begins.
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

The corpus verifier checks the exact terminal body pose, original geometry,
transform keys outside the decay clips, burial before each final-frame hide, MDX/MDL reopen,
Undo/Redo and repeat-click behavior. A source MDL export limitation is reported
separately only if the untouched input reproduces the exact same error.

`test/corpse-size.electron.cjs` clicks CORP/Create, saves through the native MDX
Save As dialog, measures the saved footprint against the fixture's original
native corpse, and checks normal mouse rotation plus drag/Escape/Delete/Ctrl+Z.
It uses no forced focus, synthetic DOM events or state mutation. Capture mode
accepts `MDLXL_SHOT_FIXTURES` (semicolon-separated Windows model paths) and
`MDLXL_SHOT_OUT`; it records both the corpse and Show body at the same camera,
including explicit errors. It waits for the draft gutz asset to resolve before
recording the preview; Krell reproduces the old missing-texture failure.
Run via the existing hidden packaged runner.
Source regressions need `out/pose/Footman.mdx`, `out/pose/Ogre.mdx`,
`MDLXL_CORPSE_FLAIL` (the owner's Fx model), `MDLXL_CORPSE_DETACHED` (Ratling),
and `MDLXL_CORPSE_TAILED` (Skink).

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
