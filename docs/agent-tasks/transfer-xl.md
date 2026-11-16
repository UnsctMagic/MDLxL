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

## Round 4 (night of 16 Nov 2026)

Owner, going to sleep: "you have no limits, you can make the BEST animation transferer. I kinda
just wanna be wowed." Director's plan for the night. Each item is built, tested and committed on
its own, so a shaky item can be left out of the morning build.

### Engine (weapons and moment fixes)

- **N1 weapon shape.** An arm part knows its weapon: every vertex skinned only to joints at or
  below the limb's end joint; when their longest principal extent is more than 0.6 of the arm's
  length there is a weapon. Keep, in the end joint's reference space, its axis ends (`butt`,
  `tip`), its length and up to twelve outline points (the extremes along its three principal
  axes). `part.weapon` becomes that object (or null); `rig.weaponSide` as before.
- **N2 both hands on the weapon.** The open model holds its weapon with two hands when, in its
  reference pose, the other arm's hand lies on the weapon (closer to the butt-tip line than a
  fifth of its own forearm length; calibrate on the Kurgan Warlord's hammer, the Tauren's totem,
  the Footman, the Grunt and the Nurgle warrior, and state the rule you end with). Then, whenever
  the weapon arm is taken, the other hand stays on its grip point (where it was on the weapon in
  the reference pose, kept in the weapon hand's space): solve the other arm with the existing
  length-then-aim solver after the weapon arm, starting from that arm's own taken or body-animation
  pose, weighted by the weapon arm's weight. Recipe: `grip` on the weapon arm, null = automatic,
  true/false = user. The other arm's joints become driven.
- **N3 weapon above the ground.** For a taken weapon arm (recipe `clear`, null = on): when an
  outline point would go below the model's ground level, raise the arm about its root by the
  least angle that lifts it, searched per sample, then made smooth in time (the largest need
  within 80 ms either side, then a 60 ms blur) so the lift eases in and out. Runs before N2.
- **N4 point the weapon like theirs.** Recipe `aim` 0..1 on a weapon arm, default 0, used when the
  donor arm also has a weapon: turn the end joint so the weapon's axis points where the donor's
  weapon points relative to its chest (after mirroring and facing), by that amount.
- **N5 fix one moment.** Recipe `fixes: [{ time, raise, turn, roll, width }]` per part (ms in the
  result, degrees, width default 250 ms): extra aim on top of the part's offset that is full at
  `time` and fades smoothly to nothing `width` either side (wrapping in a looping result). A
  planted foot's target moves with it, like the offset.
- Tests on real models, fail first: Kurgan Warlord taking the Footman's `Attack - 1` on the weapon
  arm only keeps the other hand within 1.5 units of its grip point at every sample (and it is
  more than 10 away without N2); Kurgan taking the Grunt's `Attack - 1` whole body keeps every
  outline point at or above ground minus 0.5 (it goes well below without N3) and the lift never
  changes by more than 6 degrees between neighbouring samples; N4 at 1 puts the weapon axis within
  5 degrees of the donor's; N5 moves the hand at `time`, leaves it untouched beyond `width`, and
  equals the plain result when `fixes` is empty. Look at the Kurgan sheets.

### Window

- **N6 clip timeline.** The strip under the stage becomes a small timeline: Play/Pause, a ruler to
  scrub, then lanes: the body animation (its loops drawn as repeats), then one lane per taken
  source animation with the parts that share it (label `Grunt - Attack - 1: Left arm`). A clip is
  dragged sideways to change Delay and by its right edge to change Speed; the Ease ramps are drawn
  at its ends; moment fixes show as diamonds on their lane (click = jump there and select the
  part, Delete removes). Compact lanes, scroll past four. Timing sliders stay in the fold and stay
  in step. Drags follow the live-drag rule.
- **N7 this moment.** The drag from W2 gets a scope switch beside the part's aim sliders,
  `Whole movement | This moment`. This moment writes a fix (N5) at the paused time instead of the
  constant aim; dragging again near an existing fix edits that one. `Clear fixes` on the part.
- **N8 weapon switches** on a weapon arm: `Both hands on the weapon` (when the model holds it so),
  `Keep weapon above the ground`, `Point weapon like theirs`. One short tooltip each.
- **N9 save and load a setup.** `Save as` / `Load from` like FX's look bar (`app/FxLookBar.jsx`,
  `app/PresetBar.jsx`): a saved setup holds the recipe with sources by file or game path and
  animations by name. Loading on another model reopens the donors (a missing one is asked for
  once), maps parts and animations by name and leaves out what the model lacks. With Add all this
  turns a whole warband into one setup. Time box: last, only if N6-N8 are solid.

### Round 3 as built (16 Nov 2026, window coder; awaiting director review)

- **W1 built.** `addAllPlan` / `bodyAnimationFor` in `src/transfer-window.js` (source tests); footer
  `Add all (N)` with the names in its tooltip and the reason when disabled; one `edit(...)` loops
  `buildTransfer` + `applyTransfer` (cache cleared per clip); note `Added N animations`. Harness: Lord
  of Change + Footman, Add all (7), one Undo removes all 7, Redo, Save as and reopen keep them.
- **W3 built.** Camera angles shared through `onCameraAnglesChange` / `cameraAnglesRequest` (the echo
  of a request is ignored); with a taken part from the shown donor selected, the donor view plays that
  part's animation at the result's time (Delay, Speed, looping wrap or clamp) instead of its own clock.
- **W2 not built.** The POSE handle drag writes keys through its own gesture and hands back track
  changes, not a drop position, so it cannot be reused without changing GamePreview's pose gesture.
  A separate pointer handler can find the drop point, but turning it into Raise and Turn needs an
  inverse of the engine's offset (a search over buildTransfer, about 30-60 builds per update), too slow
  for a live per-frame path; a release-only solve without the live path was not worth the risk in the
  time box. A clean way: an engine helper that returns the end point for given offsets cheaply.

### Round 4 window as built (window coder; awaiting director review)

- **N6 built.** `app/TransferTimeline.jsx` under the stage: Play/Pause, ruler (click or drag to scrub),
  time and Original on the strip; body lane (`clipBlocks` repeats from `built.baseClock`), one lane per
  taken source animation (`clipLanes`: same source + animation + Delay + Speed share a lane). Clip drag
  = Delay (10 ms steps, 0-2000), right edge = Speed (0.25-3); one window-history step per drag; the axis
  is the previewed result and changes on release. Lanes are keyed by their parts so a drag keeps its
  pointer capture. Ease ramps at play-once clip ends; `fixes` diamonds (click = jump + select, Delete =
  remove). Lane label selects its part, or All taken parts for a lane of several. Registered in
  `test/live-drag-frames.test.js`. Polish: `Adding…` while Add all runs (footer disabled), Add all drawn
  secondary, the Animations row the donor actually plays in step is marked.
- **N7 built.** Capture-phase pointer handler on the result view: only a press within 14 px of the
  selected taken limb's end (`transferEndPoint`, projected with a new `captureApi.ray` / existing
  `project` in GamePreview) starts the aim; elsewhere the camera turns. `dropPoint` (sphere around the
  root, else the plane through the end) feeds `transferAim` once per frame; Whole movement writes
  `offset`, This moment writes or updates a fix; dashed ghost from root to drop point; one history step;
  note when `clamped`. `Clear fixes`. Registered in `test/live-drag-frames.test.js`.
- **N8 built.** Weapon switches on an arm with `weapon`: Both hands (when `weapon.grip`), Keep above
  ground (`clear`), Point like theirs (`aim`, only when the donor arm has a weapon; null = on for a
  play-once clip). Untaken limbs the build drives show `holds the weapon`.
- **N9 built.** `setupFromRecipe` / `parseSetup` / `recipeFromSetup` in `src/transfer-window.js`
  (source test): sources by kind and path (`file`, `library`, `self`), animations and the body
  animation by name, parts by key. The bar (`PresetNameRow`, `writePresetFile`, the preset open
  dialog) sits at the top of the parts column; saved setups live in the profile's store
  (`mdlxl.transfer.setups`). Loading reopens donors through the new read-only bridge
  `transfer:readModel` / `readTransferModel` (file) or `gameFilesFindPath` + `gameFilesRead` (library),
  asks once with the open dialog when one is missing, and names what was left out.

### Final polish as built (window coder)

- Parts-column sliders are single rows (name 58 px, track, value 40 px; Mine / Theirs under the
  track) and the column's gaps are tighter: a selected weapon arm (Kurgan) or story B's arm shows the
  scope buttons, five sliders and the weapon switches without a scrollbar with Timing closed (the
  harness checks `scrollHeight <= clientHeight`). No column widths changed.
- Model names never show their extension; lane labels are animation first, the full label and parts
  in the lane's tooltip. Timing sliders follow a clip drag live. Loading a setup selects the donor and
  animation of its first part. The aim grab radius is the POSE handle's (20 px); the ghost is a blue
  dashed line over a white halo. Add all keeps the taken parts and the selection.
- Harness: one run covers every story, a dark-theme story (`preferences.theme = 'dark'`) and
  `sweep34`, a click-through of every round 3-4 control.

## Round 5: a playback strip under each view (owner, 16 Nov 2026 morning)

Owner on build `transfer-xl-03`: "What is load from and presets for? Why cant I easily view
animations on each model? you gated me hard here. I have two view points - Each should have its own
play track where the green box is. Play, Pause, Speed and a drop box to select animations to view.
Havent been able to test beyond that as it gates me". The green box in his screenshot spans the
bottom edge of both view panes, directly above the timeline.

Contract (director):

- **P1 Strip per view.** Each of the two views gets its own playback strip along its bottom edge:
  Play/Pause, a thin scrub track, a viewing Speed, and a dropdown with the animation the view shows.
  The two views play independently: own clock, own Play/Pause, own Speed.
- **P2 Donor strip.** Its dropdown lists the donor's animations and is the same choice as the
  Animations list on the left (either one changes both). The donor no longer follows the result's
  clock when a taken part is selected; nothing changes what the donor shows except the owner.
- **P3 Result strip.** Its dropdown has `New animation` first (the result being built; the default),
  then every animation the open model already has, to look at. Picking one only changes what the
  view shows; it never changes the Body animation or the recipe. While an own animation is shown the
  taken-part handles, the path and the drag-to-aim are off and the timeline is dimmed; using the
  timeline, taking a part or moving a slider returns the view to `New animation`.
- **P4 One Play per view.** The timeline's own Play button and the `Original` button go (the result
  strip's Play and the dropdown replace them); the timeline keeps its ruler, time readout and lanes.
- **P5 Speed is for viewing.** Reuse the app's existing playback-speed control and `GamePreview`'s
  `playbackSpeed`; it never changes the animation that is added. Its tooltip says so, because a part
  has its own Speed under Timing.
- **P6 Setups wording.** The load menu's lone `File…` row reads `Load from file…`, and the file
  dialogs say setup, not preset.

### Round 5 as built (window coder; awaiting director review)

- `app/TransferViewStrip.jsx`: one 24 px row per view, [Play|Pause] [scrub] [Speed] [animation].
  The height comes from the preview; the window did not grow. The scrub is coalesced to one update per
  frame (registered in `test/live-drag-frames.test.js`).
- Speed is a compact select (25/50/100/200%) on `GamePreview`'s `playbackSpeed`, not the
  KeyframeTimeline number field: that field ("Playback Speed [n] %") does not fit a ~330 px strip next
  to the dropdown. Tooltip: "Viewing speed only. It does not change the animation."
- Donor: `DonorStage` owns its time, Play and Speed; no `onPlayingChange`, so a non-looping clip
  keeps its clock. Linking (`donorClock`, `linked`, `donorShows`, `xf-playing`) is gone; the
  caption is the model name; the donor path follows the animation the donor shows.
- Result: `viewSeq` (null = New animation). Own animations turn off handles, path and aim and dim the
  timeline (`aria-disabled`, `xt-dimmed`; a pointer-down on it returns to New animation). It also
  returns on any recipe change (part switch, slider, Take whole body, Clear all, Body animation,
  setup load), a slider draft or a fix/lane click. Time jumps to the sequence start and back to the
  preview start; the camera is untouched (the views story asserts both cameras before and after).
- Timeline Play and `Original` removed with their state; the readout sits in the left cell.
  `transfer:play` is the result strip's Play; `transfer:original` left the manifest, catalogs and
  tests; the donor Play is `transfer:play-donor` (manual, "Play donor").
- `File…` reads `Load from file…`; the setup file dialogs are titled Save setup / Load setup through
  an additive `title` on `preset:saveFile` / `preset:openFile` (other callers keep "preset").
- Harness: story `views` (dropdown ↔ Animations list, donor Pause, own animation without touching
  the recipe, timeline/slider return, Speed 50% on one view, unchanged cameras) and the sweep's
  Original step replaced by the result dropdown, donor Speed/Play/scrub. Pictures in
  `out/transfer-ui/round5/`.
- Director's change after reviewing the pictures: the scrub track runs the full width of the view
  above the strip's buttons (a 60 px track beside the dropdown was too short to use). Build
  `TestBuilds\transfer-xl-04`: the full harness passed hidden on that exact copy (34 checks).

## Round 6: level viewpoint, window over the editor area (owner, 16 Nov 2026)

Owner on build `transfer-xl-04`, with a screenshot of the Footman tilted in the result view: "Did you
actually try this program?", "the view point is buggy, jittery, not fun to use - this is still
difficult just to get started", "also make it slightly bigger, like the UV wrapper", "like the whole
window should take the editor space".

Found by recording real mouse drags in the packaged app (`out/transfer-probe/feel.cjs`, both cameras
read at every step): the "views turn together" link sent XYZ camera angles through React state and
applied them with `setEditorCameraAngles`, which also sets the camera's up vector to the camera's own
up. From then on OrbitControls orbited around a tilted axis: a sideways drag changed the camera's
height and rolled the horizon (26 degrees in 240 px), an upward drag went over the top and turned the
view around, and choosing a donor sent the new donor view's default angles to the result view,
moving the owner's viewpoint.

As built (director):

- `GamePreview` has an additive `turnCamera` prop, a bus `{ saved, listeners }` like `compareCamera`
  but sharing only the viewing direction (unit vector from target to camera). Each view keeps its
  own target, distance and zoom; world up stays up; nothing goes through React. A view that mounts
  takes the direction already on the bus, and `fit()` frames along it, so a new donor never moves
  the result's viewpoint. Transfer no longer uses `cameraAnglesRequest` / `onCameraAnglesChange`.
- The window opens over the whole editor area (`main.classic-workspace`: under the toolbars, across
  viewport and sidebar), as the UV Wrapper does, and follows that area's size; moving or resizing it
  by hand still works. Side columns are 210 px and 270 px, the views take the rest.
- Harness: story B drags sideways and up in both views and reads the cameras at every step (level
  horizon, same height, no flip); the views story checks that choosing a donor keeps the result
  camera. Both were run against build 04 first and fail there.
- Not built: a way back after zooming or panning a view (a Fit button per view); proposed to the owner.
- Reset view (owner, same morning: "in lowpoly works i have a small reset button next to the scrubber
  on the view point - that is a handy way to reset view (and can be added to uv map and other places
  where I have a preview)"): a small `↺` button at the end of each view's scrub track calls the new
  `captureApi.resetView()` (drops the shared direction, fits the view again); the other view turns
  back with it and keeps its own zoom and pan. Built for Transfer only; the UV map and the other
  previews are a separate change, offered to the owner. Build `TestBuilds\transfer-xl-06`: full
  harness passed on the camera and size change (run on 05, apart from one faulty new test line),
  then stories B, views and the control sweep passed on the exact 06 copy with the reset button.

## Reset view in every preview (owner "Yes, add it", 16 Nov 2026)

Separate commit on this branch (it can be picked onto another branch if Transfer is held back).

- `GamePreview` draws a small `↺` button (`.preview-reset-view`, bottom-right corner, no hotkey id)
  on every tool-window preview: default for `presentation="preview"`, opt-in with `resetViewButton`
  where a window uses the editor presentation (Attachemator, Bone Namer, spawn-object preview),
  off for Showcase, portrait mode, the off-screen thumbnail renderer, the main editor viewport (it
  has Fit) and Transfer (its own button sits beside each scrubber).
- What it returns to: the camera as it was before the user's first own gesture since the program
  last framed the view (opening, Fit, a newly framed part). The preview records that on the
  controls' `start` event and forgets it when the camera changes outside a gesture. Views on one
  `compareCamera` share it, so Reset in either of a Before/After pair works. This keeps each
  window's own framing (FX frames the chosen part, the UV preview faces the selected faces).
- The UV map (2D) has the same button; it runs the map's own fit through `mdlvis-uv-action`
  `reset-view`.
- `test/reset-view.electron.cjs` (real mouse, packaged app): FX, AnimXL, the UV live preview and
  the UV map; Transfer has no corner button. It fails on build 06 (no button). Whole source suite
  4063 pass, 0 fail. Build `TestBuilds\transfer-xl-07`: this test plus Transfer stories B, views and
  the control sweep passed on the exact copy.
- Not clicked one by one: the particle windows, Library browser, OptimizeXL, Sort My Mess,
  Attachemator, Bone Namer, Auto Corpse, Model Manager and the part thumbnails; they use the same
  shared button.

### Reset view: every preview window checked (owner "check that risk and fix it", 16 Nov 2026)

Director's sweep `out/transfer-probe/reset-sweep.cjs` (packaged app, hidden, real mouse): for each
preview on screen it checks that the button is reachable, what lies under it, and that it returns
the camera after a wheel zoom and two drags.

- Reset works in: Surface Effects, AnimXL, Auto Corpse, the Particle Editor stage, the Particle
  Library, the Warcraft III Library model view, Geoset preview, Model Manager, the spawn-object
  preview, Sort My Mess (both views), Attachemator, Bone Namer and OptimizeXL (both views, compared
  by picture because that window is detached). No button in the main editor viewport or Showcase.
- Fault found and fixed: the button (z-index 60) showed through a panel laid over a preview, e.g.
  the Particle Library over the particle stage, where it sat on the "Coverage" line. A preview that
  has the button now keeps its layers to itself (`.preview-with-reset{isolation:isolate}`), so the
  button is above the preview's own canvases and under anything a window lays over the preview.
  Only previews with the button are isolated; the main editor viewport is unchanged.
  `test/reset-view.electron.cjs` covers it and fails on build 07.
- Not reached: the particle comparison, ingredients, test and source views (no simple way in from
  the default state). They are the same component with the same button.
- Build `TestBuilds\transfer-xl-08`: reset-view test and the Transfer views story passed on the copy.

## Pick sheet as built (test builds only, 16 Nov 2026)

Owner: "show me results to pick from" and "make sure results are viewpoints - e.g models i can
interact with". Director contract: the same transfer built several ways, as live views, one click to pick.

- Launch: `MDLxL.exe "<model>" --transfer-picks="<absolute path of a cases .json>"`. Main reads the
  argument (`transfer:picks` returns `{ path, text, answers }` or null; preload
  `window.desktop.transferPicks()`). Without the argument nothing renders and no chunk loads; there
  is no button, menu item, hotkey id or string. With it the sheet opens once the editor shows a model
  (`PickSheetLauncher` in `app/AppDialogs.jsx`).
- Cases file rules (`parseCases` in `src/transfer-picks.js`, each failure is one sentence naming
  the case and variant, shown in the window): a JSON object; `answers` an absolute path ending
  `.json`; `cases` a non-empty list; each case `id` 1-80 of letters, digits, `.`, `-`, `_` and
  unique; `question` non-empty; `hint` optional text; `model` an absolute `.mdx`/`.mdl` path;
  `donors` optional object of names (same id rule, not `self`) to absolute `.mdx`/`.mdl` paths;
  `variants` 2 to 4, each with a unique `id` (not `same` or `none`) and a `recipe` object with
  `base.sequence` an integer >= 0, `parts` an object whose parts have `source` `self` or a donor
  name and `sequence` an integer >= 0. Everything else in a recipe is passed to the engine untouched.
- Window (`app/TransferPicks.jsx`): the Transfer shell and sizing (`useEditorArea` in
  `app/editor-area.js`, now shared with Transfer); header with question, hint and "3 / 8"; one
  live `GamePreview` per variant in one row, built as Transfer's result view builds it
  (`buildTransfer` + `transferPreviewModel`, body animation's box for framing, fitBox, no
  grid/axes), with a big letter. Models and donors load through `app/transfer-files.js`
  (`readPreviewModel`: Transfer's file reading and texture lookup, now shared), team colour from the
  editor. Letters are shuffled per case, seeded by the case id. One `compareCamera` bus per case
  (turn, zoom and pan together; a new case frames anew) and one clock: the first built view reports
  time, every view gets the same time, playing and speed. One strip under the row
  (`TransferViewStrip plain`: Play/Pause, scrub, Speed, reset; no dropdown, no hotkey ids). Loops,
  starts playing. A variant that fails shows the engine's sentence in its place and cannot be picked.
- Picks: "Pick A" under each view, "No difference" (`same`), "None looks right" (`none`), Back.
  Each pick writes the answers file at once and goes to the next case; after the last: "Done. You
  can close this window." Format `{ "<case id>": { "pick", "letters": { "A": id, ... }, "at" } }`.
  Reopening resumes at the first unanswered case. Keys: A-D pick, Space plays/pauses (window key
  claim, not catalog hotkeys). `transfer:writePicks` writes only the `answers` path of the cases
  file given on the command line and refuses any other path.
- English only: the window section carries `translate="no"`. The repository has no exemption list
  for untranslated surfaces (the catalog tests check listed strings, not every source file), so no
  test or catalog changed. The strip's plain reset tooltip is English-only too.
- Tests: `test/transfer-picks.test.js` (reader rules, letters, resume; 4 pass) and
  `test/transfer-picks.electron.cjs` (packaged, real mouse; 11 checks: three views play, a drag in
  B turns all, the scrub holds every view on one frame where the variants differ, Space, Pick B
  writes the mapping, Back and the A key change it, other paths refused, resume, None looks right
  and Done, malformed file sentence, no trace without the argument). Pictures in
  `out/transfer-ui/picks/`. Transfer stories B and setup rerun on the same package after the
  shared-loading refactor.
- Not built: no case may name the open editor model by tab; every model is read from its path.

## Round 7: four improvements (owner "Go, top four", 16 Nov 2026)

Owner: "How much more powerful can you make it without changing it much? e.g improving algorithms,
improving controls." He chose the first four of seven; the director codes the movement maths, agents
do plumbing; looks are judged on a pick sheet of live views ("make sure results are viewpoints - e.g
models i can interact with"). Regression rule agreed with him: saved setups keep giving today's
result, and the new limits are switches whose default he picks on the sheet.

### Engine as built (director, commit cafcd8a1 and the next)

Every new recipe field is off when absent, 0, false or null. Proof: `out/transfer-probe/baseline.mjs`
fingerprints the dense tracks and the saved animation of 30 trial pairs; before and after are
identical. 31 engine tests.

- **Learned once per rig from the model's own animations** (`ownMotion`; death, decay, dissipate,
  portrait, birth left out; about 240 frames): each part joint's range of local turn (a box in the
  principal axes of its own turns); the body bone's travel range; *followers* (a loose joint whose
  turn is a steady share of one limb joint's turn: fit at least 0.8, share 0.1 to 1.3); *chains*
  (loose joints with keys of their own that hang from a trunk part, turn at least 2 degrees and
  carry no body part); trunk ellipsoids and arm thickness for the arm guard.
  Measured: the Slaanesh warrior's pauldrons follow the upper arm at 0.50 with fit 1.00, the Nurgle
  warrior's shoulder bones at 0.24 (fit 0.95 and 0.98); capes, belly bones and belts are chains.
- `part.range` (0..1): the part's joints stay inside their own range (15% and 5 degrees past the
  extremes, then a soft stop over 10 more); hips travel the same way, planted feet shift with what was
  taken off. A leg with a planted foot and an arm that grips the weapon are left alone (their IK
  solve needs the freedom).
- `part.follow` (0..1): followers of a taken limb keep their learned share of the driver joint's
  turn; chains of a taken trunk part play the model's own animation of the same kind as the taken
  clip, fitted to its time (nothing when there is none, or it is the body animation).
  `transferLooseParts(model, { sequence })` says which parts have such joints.
- `part.avoid` (0..1, arms): the shoulder turns (at most 30 degrees) so the arm's joints and
  midpoints come out of the trunk ellipsoids, only where a point is clearly deeper (under 0.8) than
  the same arm sits in the body animation and in the reference pose; dilated 80 ms, blurred 60 ms.
  The arm that grips a two-handed weapon is not turned. Held weapons and shields are NOT obstacles:
  as rough ellipsoids they pushed arms the wrong way (Nurgle warrior, Kurgan); promised to the owner
  as "body, shield and weapon", delivered as trunk only.
  Measured (share of a body radius still inside, off -> on): Abomination 0.23 / 0.12 -> 0.01 / 0.01,
  Nurgle warrior 0.43 / 0.19 -> 0.13 / 0.00, Kurgan weapon arm 0.19 -> 0.12 (its gripping arm
  unchanged).
- `part.clip` = [from, to] ms inside the donor animation (trim); `part.next` = more clips of the
  same part, each a full part object (chain). A clip holds its pose while the next clip of the part
  fades in, so a hand-over never dips to the body animation: start the next clip its `blend` before
  the previous one ends. One weapon arm, one arm guard and one set of loose joints per part,
  whatever its number of clips. Drag-to-aim and moment fixes address a part's first clip.
- `transferDiagnostics(recipient, sources, recipe)` gives the numbers above for tests and probes.

### Round 7 window as built (window coder)

- **Switches** in the part controls and in All taken parts, below Keep foot on the ground, as
  `xf-check` rows like Keep weapon above the ground: **Stay in own range** (`range`), **Pads and
  cloth follow** (`follow`, only for parts `transferLooseParts` lists for the body animation; the
  tooltip is one neutral sentence with the joint names), **Keep arm out of the body** (`avoid`, arms).
  All taken parts shows a dash (indeterminate, `aria-checked="mixed"`) when the parts differ. New
  transfers keep all three off. Whole-part settings (`PART_WIDE`: flip, plant, grip, clear, aim,
  range, follow, avoid, hang) are written to every clip of the part, and copied to a chained clip.
- **Trim**: dragging a clip's left or right edge sets `clip` (`trimmedClip`); a left trim moves
  `start` later by the cut / Speed so the kept part stays in time; at least 50 ms stay; trimming back
  to the whole clip is `clip: null`. Cut ends are dashed with a lighter edge. Double-click an edge
  puts that end back (`restoredClip`). The right edge no longer sets Speed. Per frame, Escape and a
  lost press cancel, as before. Taking a part from another animation drops its old trim.
- **Add after** beside Take whole body / Clear all (labels no longer wrap): for the selected taken part,
  else every taken part, that the donor has, a chained clip (`chainedClip`) from the donor view's
  animation starting `built.length - 150` with blend 150. Lanes are per clip group (`clipLanes` now
  has `index`, `clip`, `full`); a lane label selects that clip (`clipAt`), and the sliders edit
  it (`clipOfPart` / `withClip`); the part or All title then names that clip's animation. Chained
  lanes have an × ("Remove this clip") and Delete removes the selected chained clip. Drag to aim,
  Whole movement / This moment, Take from and the fix diamonds are first-clip only. The parts list
  says "Attack - 1, then Attack - 2". The Delay slider reaches past a chained clip's late start.
- **Setups** carry every part field (range, follow, avoid, hang, clip, unknown ones) and `next`, each
  chained clip with its own source reference and animation name; a chained clip whose donor or
  animation is missing is left out and named. Old setups load to the same recipe. **Add all** keeps
  first clips only (no `next`) and drops the trim of the retargeted parts (a trim belongs to the
  animation it was made on); it keeps the switches and unknown fields.
- Test hook: `window.__mdlxl.transfer()` gives `{ recipe, selected, clip }` of the open window.
- Tests: `test/transfer-window.test.js` 20 (5 new); harness story `round7` (7 checks) with real
  mouse input; B and the sweep trim by the right edge instead of setting Speed. Pictures in
  `out/transfer-ui/round7/`.
- Found while testing: on the Abomination with the Demon Hunter's attack, Keep arm out of the body
  changed nothing with only the left arm taken; with the whole body taken it changes both arms. The
  test uses the whole body.

### Round 7b: one creature was the engine's blind spot (owner, 16 Nov 2026)

Owner, on the Footman taking WH_WOC_KnightNurgle16's attack (only Head was offered, and it was the
horse's): "It couldnt do this transfer", then "I dont want case specific improvements - you need to
identify a weakness in your engine and improve it", then "what if I want to turn a unit into a rider?
So give me the option to control - when it identifies a complex rig it should show me some easy
controls to improve my selection ... this is for dummies like me ... Be thorough, lowpolyworks has a
lot of complex rigs but also test WC3 natives - all of them".

Weakness: the engine read a model as ONE creature, the subtree under one body joint. A model built
as two creatures lost a half (a rider hanging from a second root), or mixed them (a rider nested
under the horse counted as a third pair of legs).

As built (director; no bone names anywhere in the rule, a test strips them):
- `seatedAssemblies`: a separate assembly with arms that stands over the walker (inside its floor
  plan grown 30%, not below its body joint by more than a quarter of its height) when the walker has
  no arms. Its hierarchy root counts as the body's skeleton.
- Nested: one subtree under the body with an arm and a pair of legs, one each side, that hang over
  15% of the walker's height above its lowest foot. Arms on a walking body without such legs (a
  centaur) and limbs that join the trunk separately (dragons, spider-bodied creatures) stay one
  creature.
- `transferRig(model, { sequence, actor })`: 'both' (the seated one's chest, head and arms on the
  walker's hips and legs; default), 'seated' (the one on top whole, with its own body joint, hips
  and legs), 'walker' (the one below whole). `rig.actors` lists what a model offers; one creature
  offers 'both' only. Recipe: `sources[id].actor`, `base.actor`. Legs taken from a 'seated' reading
  are not planted. To seat a unit, hips and legs take the rider with Pose at Theirs (match 1): the
  seat is the rider's stance, not a movement away from it.
- Sweep (`out/transfer-probe/survey-all.mjs`): every model as donor to the Footman (stand, attack,
  walk, spell, death) and as receiver of its Attack - 1 and Walk (the attack also saved), in every
  reading. WC3 unit models: 398 files, 388 with a skeleton, all rigged, 2,487 builds, 0 threw, 0
  non-finite, 211 had nothing to give or take (ships, machines, mines). LowPolyWorks checkout: 134
  models, all rigged, 1,106 builds, 0 threw, 0 non-finite, 61 nothing. Two creatures: natives 9
  (Knight, Archmage and ghost, both wolf riders, Bandit Lord, Bandit Mage, Garithos; the Meat Wagon
  is a false one), LowPolyWorks 16 (the 13 Chaos knights, Knight of the Blazing Sun; the two Bray
  Shamans are false ones). Not separated: Cold One Riders and the Blood Dragon knight read as one
  creature.
