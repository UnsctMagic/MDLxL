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
  using the existing animation evaluator and POSE recognition. It fits native
  gutz skull, rib/pelvis, limb and extremity regions to the posed body. Landmark
  lengths retain the joints' positions; widths come from the skin, including
  skin on Mesh/Box children of the controlling joints. Width is not capped by
  bone length. A wide body with the same joint layout therefore gets wider ribs
  and limbs. Heads sharing one torso use a shared central rib cage.
  Connected body components distinguish a hand/head from equipment sharing its
  binding.
  Forearms continue into the atlas's hand region; legs continue to the foot's
  skin tip in the native long-bone regions, never stretched hand texture.
  The pieces follow the native gutz standard measured on the 58 study
  models that have one (`NATIVE` in `corpse-geometry.js`). Every limb gets
  one long-bone rectangle for its upper and one for its lower half (a longer
  joint chain is split once near half its length; a limb starts where it
  leaves the trunk, so a thigh above a three-joint leg belongs to the leg);
  each arm gets one palm rectangle; feet, neck and short trunk links get
  none. Rectangles keep the native width/length (bones 0.47, hands 0.62, ribs
  0.57; a broad body widens them up to 0.8, never further, since a wider
  rectangle squashes the bone picture into strings). Sizes come from the
  unit's typical limb bone (joint to joint), which predicted the native sizes
  most steadily: ribs 2.57 and skull 1.18 limb bones long, a hand 1.62 of its
  forearm, and each bone reaching 1.6x its own joints. Heights are shares of
  the dead body's height: legs, arms, hands and ribs on fixed levels from
  12% up in 4% steps, the skull's crown at 43%; overlapping pieces of one
  kind are lifted a quarter level apart and no overlapping pair shares a
  height. Measured against the native corpses on the same models, piece
  lengths, widths and heights match within about 10% (medians), and ours
  covers a median 78% of the native corpse's ground area. Pieces are not cut
  to the body outline. One rib cage per unit: a separate leg-only rig gets
  none of its own.
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
remain covered by the body, which moves vertically underground. Bone decay then
lowers the fitted corpse. Each burial distance is calculated from the highest
posed vertex and a size-dependent clearance; both phases hide their geometry on
the final frame. Corpse vertices start above the ground even when the original
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
