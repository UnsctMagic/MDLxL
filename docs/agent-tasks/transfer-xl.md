# Transfer (XFER): animation transfer between models

Status: in progress on local branch `claude/transfer-xl` (worktree `.claude/worktrees/transfer-xl`).
Nothing is online. Director: Claude (Fable). Coders: subagents, one at a time in this worktree.

## Owner intent (15 Nov 2026, quoted)

- "animation transfer for dummies."
- "Full rig to rig transfers -> easy."
- "SELECTED LIMB TRANSFERS -> Two models open side by side, surgery - a bit more difficult but sliders make it work."
- "Mix and match animations as well within the same model."
- "It has to be basically the easiest animation transferer known to WC3 universe."
- "I will open it up and it wont take me more than 5-10 minutes to figure out how to transplant some
  crazy animation - lets say give the lord of change a footmans defend even though he has no shield
  and hes huge and with wings. And also giving a footman a grunts arm swing while using his own
  defend body. I expect it to be easy."

The owner's earlier concept notes are idea material only. This document is the design.

## The two acceptance stories

- **A. Whole body.** Open the Lord of Change. Take everything from the Footman's `Stand Defend`.
  The Lord of Change crouches behind a raised arm, its wings keep their own movement, its feet
  stay on the ground. Add it as a new animation.
- **B. One limb.** Open the Footman. Body animation `Stand Defend`. Take the weapon arm from the
  Grunt's `Attack - 1`. The Footman keeps defending and swings like a Grunt. Add it.

A third use falls out of the same controls: the donor can be the open model itself
(legs from Walk, arm from Attack).

## Design decisions (director)

1. **Movement moves, the model stays.** The open model keeps its own bones, skin, pivots, mesh and
   every existing animation. Transfer writes one new animation onto the model's own bones. No bone
   is added, removed, re-parented or re-bound. This is what makes it safe to play with.
2. **Body parts, not bones.** Both models are read with the existing POSE recognition
   (`suggestPoseRig`). The user only ever sees parts: Hips, Chest, Head, Left arm, Right arm,
   Left leg, Right leg, Left wing, Right wing, Tail. No bone lists, no mapping tables.
3. **One rule for all three uses.** The result is the open model's own *body animation* (base) with
   any number of parts *taken* from another animation (of another model or of itself). Whole body =
   every part taken. A part the donor does not have (wings on a Footman) simply stays on the body
   animation.
4. **Relative to what carries it.** A taken part moves relative to the trunk bone it hangs from, on
   both models. A borrowed arm rides the open model's own chest; the donor's body movement is never
   applied twice.
5. **Own stance or their pose is a slider.** Movement is transferred as the change from each model's
   Stand pose. `Match pose` 0 keeps the open model's own stance and adds the movement; 100 copies
   the donor's pose direction for that part. Defaults: arms 100, everything else 0.
6. **Feet stay down.** When Hips and a leg come from the same donor animation, the foot follows the
   donor foot's travel scaled to the open model's leg length, so a planted donor foot is a planted
   foot here.
7. **Weapon hand to weapon hand.** If both models hold a weapon and on opposite sides, the donor is
   mirrored by default. `Mirror` flips it.
8. **Every change rebuilds from the untouched inputs.** Nothing accumulates; a slider moved and moved
   back gives the identical result. Preview and the added animation come from one code path.

## Engine contract: `src/anim-transfer.js`

Pure module (three.js maths, the shared helpers in `src/animation.js`, `src/node-hierarchy.js`,
`src/pose-ik.js`, `src/sequence-editor.js`, `src/animation-tracks.js`, `src/rig-names.js`).
No DOM, no React. Import the shared node maths; do not copy it.

### `transferRig(model)`

Reads the rig once. Reference pose = first frame of the Stand animation (`standSequenceIndex`),
else the first animation's first frame, else the rest pose.

Returns `{ ok, reference: { sequence, frame }, body, parts, hipHeight, ground, weaponSide, facing, problems }`
where `parts` maps a part key to
`{ key, kind: 'trunk' | 'limb', side: 'L' | 'R' | null, joints, anchor, marker, length, weapon }`.

- Part keys: `hips`, `chest`, `head`, `armL`, `armR`, `legL`, `legR`, `wingL`, `wingR`, `tail`.
  Extra limbs of a kind get `armL2`, `legR2`, ... (legs sorted back to front, arms top to bottom).
- **Side is geometric**: the limb root's reference-pose Y against the body's. +Y is `L`. Names are
  not trusted (the SD Footman's weapon arm is `Bone_Arm1_L` > `Bone_Arm2_L` > `Bone_Hand_R`).
- `hips` = the POSE body bone plus Pelvis-role joints below it. `chest` = Spine and Chest role
  joints in depth order (Lord of Change: `B_Chest_1`, `B_Chest_4`). `head` = Neck and Head joints.
- Limb `joints` = every Bone/Helper on the parent path from the chain's top to its end joint.
  If the chain end is an attachment, the limb ends at its nearest Bone/Helper ancestor. Extend the
  top upward through ancestors that are not trunk joints and carry no other limb (Lord of Change
  leg: `B_Leg_1` > `B_Leg_2` > `B_Leg_3` > `B_Foot`). A helper shared by two limbs (its `B_Sh_R`
  carries an arm and a wing) belongs to neither and stays on the body animation.
- Wings: chains POSE labels `Wing`. Tail: path from the first non-trunk joint to the Tail-role joint.
- `anchor` = nearest joint above the part's first joint that belongs to a trunk part (null for hips).
- `marker` = the joint a UI marker sits on (limb end; last joint of a trunk part).
- `weapon` = an arm with a weapon below it (an attachment or node whose name `isWeaponName` accepts,
  or `Weapon Ref`). `weaponSide` = the side of the only weapon arm, else null.
- Only the actor that owns `rig.body` is read. A rider or second creature stays on the body animation.
- Never throws on an odd rig: `ok: false` with `problems` (plain sentences) when no part is found.

### Recipe (plain JSON, the whole editable state)

```js
{
  base: { sequence },                 // the open model's own animation under everything
  length: null,                       // ms; null = automatic
  sources: { [sourceId]: { mirror: null } },   // null = automatic (weapon rule); true/false = user
  parts: {
    [partKey]: {                      // only taken parts appear here
      source, sequence,               // which model (sourceId) and which of its animations
      from: null,                     // donor part key; null = same key (after mirroring)
      amount: 1,                      // 0..1.5 weight of the taken movement against the body animation
      match: 1 | 0,                   // 0 own stance .. 1 donor pose (default arms 1, others 0)
      offset: [0, 0, 0],              // degrees: limbs Raise / Swing / Twist, trunk Lean / Tilt / Turn
      start: 0, speed: 1, loop: null, // ms offset in the result; 1 = donor speed; null = donor's own looping flag
      blend: 0,                       // ms eased in after the clip starts and out before it ends
      plant: true,                    // legs: keep the foot on the donor foot's scaled path
      travel: 1,                      // hips: scale of the body's travel after leg-length scaling
    }
  }
}
```

`sourceId` `'self'` is the open model. `defaultTransferPart(recipientRig, partKey, wholeBody)` returns
the defaults above (`blend` 0 when the whole body is taken, 150 otherwise).

### `buildTransfer(recipient, sources, recipe, options)`

`sources` is a `Map(sourceId -> model)`; rigs are cached per model object (WeakMap).
Samples every `options.step` ms (default 1000/30) plus the result's first and last frame.
Returns `{ length, times, tracks, driven, nonLooping, moveSpeed, suggestedName, problems }`:
`tracks` = `Map(nodeId -> { Rotation?: Float32Array, Translation?: Float32Array })` with the dense
**local** values of every driven joint. Pure: inputs are never changed.

Per sampled result time `t`:

1. **Body animation.** Local TRS of every node from `recipe.base.sequence` at
   `baseStart + (t mod baseLength)` (clamped instead when that animation is non-looping).
2. **Donor time** per part: `tau = clipStart + (t - start) * speed`, wrapped when looping, else
   clamped. The part's weight `w(t)` = `amount` times the blend ramp (0 at the clip's start rising to
   1 over `blend` ms, falling again before its end; 0 outside a non-looping clip; the ramps are
   skipped where a looping clip wraps).
3. **Rotation transfer**, parts in hierarchy order (hips, chest, head, then limbs):
   - `W(t)` = world rotation of a joint (from `sampleNodeMatrices`, rotation part).
     `D_anchor(t) = W_anchor(t) * W_anchor(ref)^-1` (identity for hips), on each model.
   - Donor joint `a`: `delta_a(t) = D_anchorA(t)^-1 * W_a(t) * W_a(refA)^-1`.
   - Mirroring a source reflects it across the XZ plane before anything else: rotation
     `(x, y, z, w) -> (-x, y, -z, w)`, position `y -> -y`, part sides swapped.
   - If the two models' facings in their reference poses differ by more than 20 degrees (facing =
     left-hip-to-right-hip axis crossed with up), rotate donor deltas and displacements by that yaw.
   - Recipient joint `b` mapped to donor joint `a`:
     `W_b(t) = D_anchorB(t) * O * delta_a(t) * slerp(identity, Align_b, match) * W_b(refB)`.
     `Align_b` = the shortest rotation taking b's reference bone direction (b to the next joint of
     its part) onto a's reference bone direction. The last joint of a part reuses the previous
     joint's Align. `D_anchorB(t)` uses the recipient's anchor as it is in the *result* at `t`
     (body animation or already transferred).
   - `O` = the part's offset, built once from the reference pose and constant in time. Limbs:
     Raise turns about the horizontal axis perpendicular to the limb's horizontal bearing (when the
     limb hangs within 15 degrees of vertical, the bearing is straight out to its side), Swing about
     vertical, Twist about the limb's root-to-end line. Trunk: Lean about the side axis, Tilt about
     the forward axis, Turn about vertical.
   - Local rotation = `parentWorld(t)^-1 * W_b(t)` with the parent as it is in the result so far.
     Final local rotation = `slerp(bodyAnimationLocal, transferredLocal, w)` (w may reach 1.5).
   - **Joint mapping inside a part.** Equal counts map one to one. Otherwise limbs map each
     recipient joint to the donor joint nearest in arc-length fraction along the reference pose
     (first to first, last to last; a zero-length joint shares its neighbour's). Trunk parts with
     unequal counts spread the donor part's total delta evenly: joint `i` of `n` gets `delta^(i/n)`.
   - Joints whose Rotation track runs on a global sequence are not driven (list them in `problems`).
4. **Hips travel.** `C` = hip centre = midpoint of the leg roots' world pivots (the body pivot when
   there are no legs). Target `C_B(refB) + travel * s * (C_A(t) - C_A(refA))`, `s` =
   `hipHeightB / hipHeightA` (hip centre height above the lowest foot in the reference pose).
   Solve the body bone's Translation so the hip centre lands there after its rotations are set.
   Blend against the body animation's translation by `w`.
5. **Planted feet.** For a leg with `plant`, when hips is taken from the same source and animation:
   foot target = `E_B(refB) + s * (E_A(t) - E_A(refA))` (`E` = the end joint's world pivot), blended
   with where the body animation has the foot by `w`, then rotated about the limb root's reference
   position by `O`. Solve the leg after all rotations are set: first scale every interior joint's
   bend angle about its own bend axis by one factor (search the factor) until the root-to-end
   distance matches the target distance (clamped to 0.999 of full reach), then turn the first joint
   by the shortest rotation that aims the end at the target. Restore the end joint's world rotation.
   This keeps the transferred knee direction and works for any joint count.
6. `length` (when `recipe.length` is null) = the latest `start + clipLength / speed` of the taken
   parts, or the body animation's length when nothing is taken.
7. `nonLooping` / `moveSpeed` come from the hips' donor animation when hips are taken (move speed
   times `s * travel`), else from the body animation. `suggestedName` = the first taken part's donor
   animation name, made unique among the model's animations with the game's ` - N` pattern.

### `applyTransfer(model, built, recipe, { name })`

Mutates `model` (the caller wraps it in the document's undo step) and returns `{ sequenceIndex }`.

- Creates one new animation after the last one (existing gap rule of `createSequence`), `length` long.
- Copies the body animation into it for **every** track in the model that is not on a global
  sequence (`visitTracks`): keys time-mapped with the same loop/clamp rule as step 1, plus a sampled
  key at each loop seam and at both ends, so visibility, events, emitters, texture animation and
  undriven bones behave exactly like the body animation.
- Replaces, inside the new interval only, the Rotation keys of driven joints and the Translation
  keys of the body bone with the built motion, reduced: greedy longest-run reduction checked with
  the real sampler (`sampleTrack` on the track's own line type; new keys come from `makeKey`).
  Tolerances: rotation 0.5 degrees, translation 0.2 units. First and last frame are always keys.
- Never touches keys outside the new interval, any line type, any global-sequence track, geosets,
  pivots, the hierarchy or existing animations.
- Sets the animation's NonLooping, MoveSpeed and extents (the existing extents helper).

`transferPreviewModel(recipient, built, recipe)` = a private copy with `applyTransfer` run on it
(share geoset vertex data by reference; copy what `applyTransfer` writes). Returns
`{ model, sequenceIndex }`. Preview and commit therefore agree by construction.

### Engine acceptance (source tests on the real models in `D:\Claude\MDLxL-TestModels`)

Footman `corpus-sd/human__footman.mdx`, Grunt `corpus-sd/orc__grunt.mdx`,
Lord of Change `pose-wings/Lord_of_Changes_Repaired.mdx`. Add them to `test/helpers/fixtures.cjs`.

- **E1 identity.** Footman takes every part from its own `Attack - 1`: every driven joint's world
  pivot stays within 0.5 units of the original animation at every sample.
- **E2 story A.** Lord of Change, everything from Footman `Stand Defend`: no NaN; wing joints and all
  undriven nodes match the Lord of Change's own Stand at the looped time; each foot end moves at most
  1.0 unit while the donor foot moves at most 0.5; the body drops when the donor's does.
- **E3 story B.** Footman, base `Stand Defend`, weapon arm from Grunt `Attack - 1`: only that arm's
  joints are driven; every other node's world matrix equals `Stand Defend` at the looped time; the
  upper arm's direction relative to the chest is within 10 degrees of the Grunt's weapon arm relative
  to its chest at `match` 1.
- **E4 untouched model.** After `applyTransfer`: every earlier animation samples identically
  (world matrices, 10 frames each, difference 0); geoset arrays, pivots, node count, parents, line
  types and global-sequence tracks are identical; MDX save and reopen works and the new animation
  re-samples within 1 degree / 0.5 units of the built motion.
- **E5 preview equals commit.** Same keys from `transferPreviewModel` and `applyTransfer`.
- **E6 no accumulation.** Build, change a slider value, change it back: identical output.
- **E7 key budget.** Stored keys of a transferred attack are at most 60% of the dense samples.
- **E8 mirror.** Footman to Footman with `mirror: true`: joint positions are the mirror image.

Visual check before hand-back: a contact sheet (six frames, front and side) of stories A and B and
E1, rendered from the skinned mesh by a small script in `out/transfer-probe/` (not committed),
looked at by the coder. Numbers alone do not pass.

### Engine as built (16 Nov 2026, director-accepted changes to the contract above)

- **Length and loops** replace step 6. Any non-looping clip (a taken part's, or the body animation
  itself) makes the result non-looping; its length is the latest end of those clips and looping clips
  are simply cut. Otherwise the result loops and is as long as its longest clip, and every looping
  clip plays a whole number of loops inside it (story A: 2000 ms, the Footman's defend twice), so
  nothing pops at the loop point. Blend applies to non-looping taken clips only.
- Exports beyond the contract: `transferNodeTracks(model, sequenceIndex, built)` (the node tracks
  `applyTransfer` writes; also what the window feeds `liveNodeTracks`), `TRANSFER_PART_LABELS`,
  `transferPartLabel(key)`, `clearTransferCache(model)`, `built.baseClock`,
  `applyTransfer(..., { extents })` (the preview skips extents). `defaultTransferPart` leaves
  `source` and `sequence` null for the caller.
- Facing is read from bind-pose pivots (a Stand can turn the hips 15 degrees either way).
- Joint mapping counts the chain's end attachment, so a forearm maps to a forearm when one model
  has no hand bone.
- Keys on Hermite/Bezier tracks get tangents fitted to the motion, and sampled seam keys of the body
  copy too, so cut body animations stay exact.
- `applyTransfer` removes stray keys already lying inside the new animation's time range.
- Extents are computed for the new animation only; existing animations' boxes are not rewritten.
- A driven joint without a Rotation track gets a new linear one.
- Tests: E2 allows each foot the donor foot's travel times the leg scale plus 0.5 (the Footman's
  defend feet do move 0.85); E7's 60% budget is asserted on a whole-body attack (38% measured) and
  only reported for a blended single limb (71%: 64 of 90 keys); E8 checks mirrored movement, since a
  model that keeps its own staggered stance cannot be a position mirror.
- Measured: story A build + preview 24-33 ms, story B about 6 ms; commit with extents 54 / 13 ms.
- Known look: a held weapon keeps its own angle to the forearm, so the Lord of Change's staff ends up
  pointing where the Footman's sword points. Match pose 0 on that arm, or giving the arm back, keeps
  the staff upright. Matching weapon axes is future work, not part of this build.

## Window contract: `app/Transfer.jsx`

Dock button `XFER` (command `transfer`, label `Transfer`, placed right after `ANIM`, own colour
`#8c9bff`), window title `Transfer`, built on `ToolWindow` like AnimXL and FX, near full size.
Disabled like AnimXL (read-only model, saving, showcase, staged bit replacement).

### Layout

```
Transfer                                                                          x
+------------------ From -------------------+------------------ To ----------------+
| [Grunt v]                        [Mirror] | Footman                              |
|                                           |                                      |
|            donor preview                  |           result preview             |
|        (POSE handles, clickable)          |       (POSE handles, clickable)      |
|                                           |                                      |
| Animation [Attack - 1 v] [Take whole body]| Body animation [Stand Defend v]      |
+-------------------------------------------+--------------------------------------+
| [All] [Head] [Chest] [Hips] [Left arm] [Right arm] [Left leg] [Right leg] [Wings..] |
| Right arm   [Take from Grunt - Attack - 1]  [Give back]  [Reset]                  |
| Amount --o--  Match pose ---o  Raise -o-  Swing -o-  Twist -o-                    |
| Start -o-  Speed -o-  Blend -o-                                                   |
+-----------------------------------------------------------------------------------+
| [Play] ----o-------- 0.42 s  [Original]      Name [Attack - 3]  [Clear] [Add animation] |
+-----------------------------------------------------------------------------------+
```

### Behaviour

1. **From.** Before a donor is chosen the left pane shows only its choices as buttons:
   `This model`, one per other open model tab, `Open file...`, `Library...` (the game-file model
   browser in pick mode). After that the same choices live in the `From` dropdown, plus every donor
   loaded in this window. Donor models are read-only and never become tabs. Donor textures resolve
   the way the Library preview does.
2. **Take.** Clicking a POSE handle on the donor takes that part from the donor's current animation
   and selects it. `Take whole body` takes every part both models have and selects `All`.
   A part chip selects the part; the selected part's row has `Take from <model> - <animation>`
   (also retakes from whatever the donor pane shows now), `Give back` and `Reset`. Double-clicking a
   chip takes or gives back. Clicking a handle on the result selects that part. A part keeps its own
   source, so one result can mix several donors and animations.
3. **What is taken is visible.** Chips of taken parts are filled and name their source in the
   tooltip; the taken joints are highlighted on both models. A chip for a part the current donor
   lacks can be selected but `Take` is disabled with the reason in its tooltip. Parts the open model
   lacks are not shown. Left/right chips name the open model's own sides.
4. **Sliders** (shared `RangeField`; each has a short tooltip; live, at most one rebuild per display
   frame, no renderer rebuild during a drag): Amount 0-150 %, Match pose 0-100 %, three offsets
   -90..90 degrees (limbs `Raise`, `Swing`, `Twist`; trunk `Lean`, `Tilt`, `Turn`), Start (ms),
   Speed 25-300 %, Blend 0-500 ms (non-looping clips only), `Plant foot` check on legs, Travel
   0-200 % on Hips. With `All` selected a slider sets every taken part; it shows the shared value or
   stays empty when they differ. Only sliders that apply to the selection are shown, and none until
   a taken part is selected.
5. **Mirror** on the donor pane flips which side feeds which; pressed while mirroring is in effect,
   including the automatic weapon-hand case.
6. **Playback.** One Play/Pause, a scrub bar over the result and a time readout. `Original` shows
   the body animation alone while held on. The donor pane loops its chosen animation and pauses with
   the result. Each pane keeps ordinary mouse camera rotation and its own camera; the camera is never
   reset by a recipe change, only framed when a new model is shown in that pane.
7. **Add animation.** `Name` starts as the engine's suggestion and stays the user's once typed.
   `Add animation` runs `applyTransfer` in one `edit(...)` (one Undo step in the document) with the
   section list AnimXL's "commit as new" uses, selects nothing else, keeps the window open and shows
   `Added <name>` beside the button. `Clear` gives every part back.
8. **Window history.** Ctrl+Z / Ctrl+Y inside the window step through recipe changes
   (`useWindowHotkeys`, as AnimXL does). Closing with taken parts not yet added asks for the second
   close key (`unapplied`).
9. **Unreadable rigs.** If the open model has no recognised parts the window shows the engine's
   problem sentences and nothing else. A donor without parts shows them in the donor pane.
10. **Preview equals result.** The result pane plays a private copy from `transferPreviewModel`;
    slider drags swap node tracks through `liveNodeTracks` using `transferNodeTracks`. The copy is
    rebuilt only when the body animation or the result length changes (for a length change during a
    drag, on release). Every rebuild starts from `doc.model`, the donor models and the recipe.

### Files the window adds or touches

`app/Transfer.jsx`, `app/transfer.css` (theme variables only), `app/AppDialogs.jsx`,
`app/AppToolbar.jsx`, `app/App.jsx` (command + enable rules), `src/commands.js`,
`electron/menu.cjs`, `app/modules.css`, `app/new-look.css`, `docs/TOOLBAR-DOCK.md`,
`scripts/hotkey-manifest.mjs` + regenerated `src/hotkey-manifest.json`, the five locale catalogs
and their guard fixtures, `test/module-button-labels.test.js` / `.browser.cjs`,
`docs/TRANSFER.md` (user guide), `docs/agent-map.md` row, `docs/agent-tasks/README.md` row.

### Window acceptance

- `test/transfer.electron.cjs`, real mouse on the packaged app, hidden:
  **B**: open the Footman, open XFER, choose the Grunt through `Open file...`, choose `Attack - 1`,
  set Body animation `Stand Defend`, click the Grunt's weapon-hand handle, drag one slider, drag the
  camera in both panes (pixels change), `Add animation`; the Footman has one more animation, Undo in
  the main window removes it, no page errors.
  **A**: open the Lord of Change, donor Footman `Stand Defend`, `Take whole body`, `Add animation`,
  save and reopen: the new animation is there.
- Source tests for anything testable without the app (recipe helpers, chip state).
- Before hand-back: package, then a hidden click-through of every control in the window on that
  exact package with both stories, no crash notice.
- Test build in `D:\Claude\MDLxL\TestBuilds\transfer-xl` opening `TEST TRANSFER 01.mdx`.

### Window as built (16 Nov 2026, window coder; awaiting director review)

- `app/Transfer.jsx` + `app/transfer.css`; pure helpers in `src/transfer-window.js` (chip order,
  mirrored donor part, POSE handle to part and back) with `test/transfer-window.test.js`.
- Engine addition: `transferRestoreTracks(recipient, start, built, ids)` gives a node back its
  body-animation tracks inside the preview's new animation, so removing a part and Original swap tracks
  instead of rebuilding the preview (tested equal to a transfer that never took the part).
- Preview: the result copy is rebuilt only when `doc.revision`, the body animation, the length,
  looping or the body clock rate changes, never while a slider is held; otherwise
  `liveNodeTracks` = `transferNodeTracks` for driven joints + `transferRestoreTracks` for joints
  driven earlier. Builds run on the main thread at most once per display frame (no worker).
- The selected part is drawn as a yellow joint path on both models (with **All**: every taken part, thinner):
  `poseConfig.inspectPaths` / `inspectColor` / `inspectThin`, additive options in `GamePreview.jsx` beside
  `inspectIds`. The filled chips say what is taken; `All` is never filled, only outlined when selected.
- Both panes hide the grid and axes and frame the model large: `fitBox` (new opt-in `GamePreview` prop)
  fits the camera to the visible mesh as posed in the first drawn frame, instead of the sphere around
  the model. It frames only when a pane gets a new model (window opened, donor chosen); rebuilds keep
  the camera (`preserveCameraView`), and a camera drag before the first frame cancels it.
- Donors: `This model` (the document itself), other tabs (a `structuredClone` snapshot of the tab's
  model, its textures shared), `Open file...` through the new bridge `transfer:openModel` /
  `openTransferModel` (dialog title "Take animation from", no tab, no recent entry), `Library...`
  through the existing game-file browser hosted in pick mode (`GameFileBrowser` prop `pickLabel`:
  the geoset box is replaced by **Use this model**; Enter / double-click pick; `previewAssets`
  exported for the donor's textures).
- Deviations: with **All** selected the three offset sliders are hidden (their axes differ per part
  kind); Start runs 0-2000 ms; the hotkey label for the Take button is "Take part" (the catalogs
  already translate "Take" as a recording take); default key F11 (F10 is reserved). A donor without
  parts still shows its preview, with the engine's sentence over it.
- Not done here: the test build in `D:\Claude\MDLxL\TestBuilds\transfer-xl` (the coder was told not
  to touch the main checkout); the packaged build is `out\pkg-transfer`.
- Harness `test/transfer.electron.cjs` (registered as `transfer` in `scripts/run-packaged-tests.mjs`):
  stories B and A, a click-through of every control (`MDLXL_TRANSFER_SWEEP=1`), Library pick, a
  donor and an open model without parts (`corpus-sd/undead__plaguecloud.mdx`).

### Window as built, round 2 (16 Nov 2026, window coder; awaiting director review)

- FX shell: 1140 x 740, columns 190 / stage / 250. From list (sources, `Open file...`, `Library...`, the
  chosen source's animations as rows), donor and result views side by side with captions and `Mirror`
  on the donor caption, transport under them, Parts column (Body animation, Take whole body / Clear all,
  the reason sentence, the parts list with a switch per row, the selected part's controls with a closed
  `Timing` fold), footer Name / Added / Cancel / Add animation. The first list row, `All taken parts`
  (no switch, disabled while nothing is taken, selected by Take whole body), edits every taken part:
  Strength, Pose, Timing, Travel when Hips is taken, Keep foot on the ground when a leg is taken; shared
  value or '–'. The result view has POSE handles for taken parts only (`takenPoseConfig`), none when
  nothing is taken; the donor view keeps one for every part.
- Path overlay: `jointPath` in `src/transfer-window.js` samples the selected limb's last joint through
  the result copy with the live tracks swapped in (`withNodeTracks`) and through the donor animation;
  both drawn with `overlayPaths` (orange, a dot at the current time). Recomputed per slider frame.
- Engine hooks: `rigFor` = `transferRig(model, { sequence })` (body animation / donor animation),
  `wholeBodyParts` = `transferWholeBody`, `sourcePartKey(key, mirror, flip)` matches the engine's
  Other side mapping. Double-click on a slider resets it to `defaultTransferPart`'s value.
- Strings: the round-1 strings no longer used ("give back" and the old slider names) are removed from
  the five catalogs and the `current` fixture; the new ones are added.

## Public text rule

Commits, PR text and docs describe MDLxL's own behaviour only. Older tools (Retera's Model Studio,
Oinkerwinkle's tools) may be named. No other editor is named anywhere.

## Round 2 (16 Nov 2026): owner hand test and director trials

Owner after the first test build, quoted: "UI is a bit confusing for me - things are not where they
should be intuitively (play, pause etc)"; "give back makes no sense, just remove or clear all";
"its a bit too much, too big and sparse - FX is nice because it keeps everything where it needs to
be"; "The actual animation transfer is nice"; "make sure the sliders are useful - i tried them but
didnt really understand what I was doing, I saw stuff change though".

Director trials (contact sheets, `out/transfer-probe/trials.mjs` + `trials.json`, looked at by the
director): Footman attack on the two-headed Ogre, Blademaster leap on the Footman, Tauren two-handed
smash on the Footman, Footman walk legs under his own attack, Footman death on the Lord of Change
all read well. What went wrong and what it changes:

### Engine changes

- **R1 default pose.** `match` defaults to 0 for every part. With arms at 1 the Ghoul walked with
  its arms spread like a T; at 0 every trial started and ended in the model's own stance and the
  attacks read just as well. `Pose` toward the donor stays the user's choice.
- **R2 the body the animation moves.** The Demon Hunter has a second skeleton (`... Alternate`) for
  its demon form; the rig picked it and the transferred attack did nothing. A model's rig follows
  the animation in use: among separate skeletons with limbs, use the one whose joints carry the
  most Rotation keys inside that animation (donor: the taken animation; open model: the body
  animation), and take the reference pose from that skeleton's own Stand. `transferRig(model,
  { sequence })`; cache per model and skeleton.
- **R3 upper and lower body.** On rigs whose trunk carries legs in more than one place (Dryad, Pit
  Lord, Knight with rider) a trunk joint that carries a leg belongs to `hips` (the walking body),
  never to `chest`; `chest` is the Spine/Chest joints that lead to the arms and carry no leg;
  `head` is the Neck/Head joints above that chest (a mount's own neck and head stay on the body
  animation). Export `transferWholeBody(recipientRig, donorRig)`: the parts "Take whole body"
  takes. When the two models have a different number of leg pairs it leaves out `hips` and every
  leg (a horse body driven by a biped's hips fell over in the trials) and returns the reason as a
  plain sentence for the window.
- **R4 feet above the ground.** After planting, the sole of a planted foot (vertices skinned only to
  the foot joint, lowest tenth in the reference pose) must not go below its own reference ground
  level: turn the foot joint the least amount that lifts the sole back (the Ghoul's long toes
  dipped under the floor during the Footman's walk).
- **R5 other side.** `part.flip: true` feeds a part from the donor's opposite side (my left arm
  does what their right arm does), mirrored so it bends the right way. Independent of the
  whole-donor Mirror.
- Tests for each (fail first on the old code): R1 defaults; R2 Demon Hunter `Attack` onto the
  Abomination moves the arms (upper arm turns more than 30 degrees) and uses the non-Alternate
  skeleton; R3 Dryad chest from the Sorceress leaves every hoof within 0.5 units of the body
  animation, Knight `transferWholeBody` from the Grunt has no hips or legs; R4 Ghoul soles never
  below ground level minus 0.5; R5 flipped arm equals the mirrored donor's arm. Fixtures for the
  new models go in `test/helpers/fixtures.cjs`.

### Window changes (replace the layout above; behaviour rules 5-10 stay)

Same size and three-column shape as the FX window (`app/SurfaceEffects.jsx`): library left, stage
with the transport directly under it in the middle, controls right, footer with the buttons.

```
Transfer                                                                    x
+- From ----------+------------- stage -------------------+- Parts ----------------+
| This model      |  Grunt - Attack - 1 [Mirror] | Footman |  Body animation [v]     |
| Grunt        <- | +------------+ +------------+          |  [Take whole body] [Clear all] |
| Footman.mdx     | |   donor    | |   result   |          |  [x] Left arm   Grunt - Attack - 1 |
| Open file...    | +------------+ +------------+          |  [ ] Right arm                    |
| Library...      | [Play] ----o------- 0.42 s  [Original] |  [ ] Head ...                     |
| - Animations -  |                                        |  - Left arm -          [Other side] |
| Attack - 1   <- |                                        |  Strength --o   Pose Mine --o Theirs |
| Attack - 2      |                                        |  Raise -o-  Turn -o-  Roll -o-       |
| Stand - 1 ...   |                                        |  > Timing                            |
+-----------------+----------------------------------------+------------------------+
| Name [Attack - 3]                 Added Attack - 3        [Cancel] [Add animation] |
+----------------------------------------------------------------------------------+
```

- **From** is a list like FX's library: the sources (This model, other tabs, loaded donors), then
  `Open file...` and `Library...`, then the chosen source's animations as a list. Clicking an
  animation plays it in the donor view. No dropdowns for these.
- **Stage**: donor and result side by side, each with a one-line caption; `Mirror` sits on the
  donor's caption. Play/Pause, the scrub bar, the time and `Original` sit directly under the stage,
  where FX and the main timeline have them.
- **Parts** is a list, one row per part of the open model: a take switch, the part name and, when
  taken, its source in small text. The switch takes the part from what the donor view shows or
  removes it. Clicking the row selects it. `Take whole body` and `Clear all` sit above the list.
  The words "give back" are gone: a part is taken or removed. Clicking a donor handle still takes,
  clicking a result handle still selects.
- **Selected part** controls sit under the list and only for a taken part: `Strength` (was Amount),
  `Pose` with the ends labelled `Mine` and `Theirs`, `Raise`, `Turn` (was Swing), `Roll` (was Twist;
  trunk parts keep Lean / Tilt / Turn), `Other side` (R5, limbs), `Keep foot on the ground` (legs),
  `Travel` (hips), `Take from <source - animation>` only when the donor view shows something else
  than the part's source. A `Timing` fold, closed by default: `Delay` (was Start), `Speed`, `Ease`
  (was Blend). Double-clicking a slider resets it. One short tooltip each.
- **A slider shows what it does.** While a taken limb is selected, the path its hand or foot travels
  through the whole result is drawn on the result view, and the donor limb's path on the donor
  view (`overlayPaths`, the way AnimXL draws Arcs). Dragging Raise, Turn, Strength, Pose, Delay or
  Speed visibly moves or reshapes that path.
- `Take whole body` uses `transferWholeBody`; when it leaves the lower body out, its sentence shows
  under the buttons.
- Footer: `Name`, the `Added <name>` note, `Cancel` (closes), `Add animation`.

## Round 3 (16 Nov 2026): the extra hour

Owner, away from the PC: "work on it for one more hour before delivering - theres no rush, I want a
really good product"; "I want the best freaking animation transferer WC3 modding has ever seen."
Director's choices for that hour, in order of value:

### W1. Add all animations (the real "full rig to rig")

A modder's usual job is giving a model a whole animation set, not one clip. Footer button
`Add all (N)` beside `Add animation`.

- It uses the source shown in the From list and the parts taken from that source as the template:
  for every animation of that source, the same parts with the same slider values, pointed at that
  animation. Parts taken from other sources stay exactly as they are.
- Left out: animations whose name the open model already has (case-insensitive), and Decay and
  Portrait animations. `N` is what remains; the tooltip lists the names. Disabled with the reason
  in the tooltip when no part is taken from that source or N is 0.
- Body animation per added clip: the open model's own animation whose first word matches the
  donor clip's first word (Walk under `Walk Defend`, Attack under `Attack Slam`), preferring an
  exact name match, else the chosen Body animation. Untaken parts (wings, tail, cloth) then move
  the way they do in that kind of animation.
- Names are the donor's names. Everything is added in one `edit(...)`: one Undo removes the whole
  set. The note beside the buttons says `Added N animations`.
- The plan (which clips, which body animation, which names) is a pure helper in
  `src/transfer-window.js` with a source test; the window loops `buildTransfer` + `applyTransfer`.

### W2. Drag the hand or foot where it should be

Raise and Turn are an aim. On the result view the selected taken limb's end handle can be dragged
with the mouse, like a POSE handle: on release the limb is turned about its root so the hand or
foot is where it was dropped at the paused moment, as one constant aim for the whole movement
(it writes that part's Raise and Turn; the sliders show the new values; the path overlay follows
live during the drag; one window-history step). Camera rotation on empty space stays. Reuse the
existing handle drag path if it can hand over a drag position without POSE writing keys;
otherwise a pointer handler on the view with the projection the path overlay already uses, one
update per display frame, registered in `test/live-drag-frames.test.js`. Time box: if no clean way
exists after a short investigation, leave it out and say why.

### W3. The two views work as one

- Turning the camera in one view turns the other to the same angles (each keeps its own distance
  and framing): `onCameraAnglesChange` / `cameraAnglesRequest`.
- While a taken part is selected, the donor view plays that part's source animation on the result's
  clock (Delay and Speed applied), so the donor's swing and the result's swing happen together and
  Delay/Speed can be seen on both. With nothing selected the donor loops as before.

### Engine

Driven by the director's look at whole animation sets (walks, deaths, victory, spells) once W1
exists; listed here when found.
