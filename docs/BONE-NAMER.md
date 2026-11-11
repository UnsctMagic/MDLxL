# Bone Namer

Open **Bones → Tools → Bone Namer**, beside Attachemator. It uses the same
recognition as POSE and proposes Blizzard's standard Warcraft III SD bone names.
Only existing Bones and Helpers can be renamed. Attachments and all other model
data stay unchanged.

## Review and correct

1. Review the current and new names. Click a row or a skeleton marker to select
   its bone. The preview labels that limb (or the trunk) and highlights the
   selection. Drag empty space to rotate the camera. Nothing can be moved.
2. If a part is wrong, choose its **Part**: for example, change the first leg
   joint to Pelvis. Arm and leg numbering updates from the body outward; you
   never type names or numbers. Use **Keep name** for an unrecognised or excluded
   bone, or untick a proposed rename to retain its current name.
3. Correct **Side** if needed. Left and right are from the unit's viewpoint:
   it faces +X, with +Y on its left. Legs, feet and hooves also offer Front,
   Middle and Rear when there are multiple pairs.
4. For several bodies, use the group dropdown to choose Main, Mount, Extra or
   Copy. Choosing a new Main swaps it with the old Main.
5. **Commit** applies the ticked names as one **Bone Namer** edit. One Undo
   restores the names. Read-only documents can preview but cannot commit.

The window starts from a proposal without changing your model. Changing a part,
side, actor or tick counts as unapplied work: Escape asks for a second press,
while Close and × close immediately, exactly as in Attachemator.

## Fixed naming scheme

| Part | Name | Numbering / side |
| --- | --- | --- |
| Root | `Bone_Root` | the actor's whole-body driver (POSE `Body`) |
| Pelvis | `Bone_Pelvis` | |
| Spine | `Bone_Spine` or `Bone_Spine1`, `Bone_Spine2`… | numbered from the pelvis up, only when there are two or more |
| Chest | `Bone_Chest` | |
| Neck | `Bone_Neck` or `Bone_Neck1`, `Bone_Neck2`… | numbered from the chest up, only when two or more |
| Head | `Bone_Head` | |
| Arm | `Bone_Arm1_L`, `Bone_Arm2_L`… | always numbered, from the body outward |
| Hand | `Bone_Hand_L` | |
| Leg | `Bone_Leg1_L`… / `Bone_Leg1_Front_L`… | always numbered, from the body down |
| Foot | `Bone_Foot_L` / `Bone_Foot_Front_L` | |
| Hoof | `Bone_Hoof_L` / `Bone_Hoof_Rear_R` | |
| Tail | `Bone_Tail1`, `Bone_Tail2`… | always numbered, from the body outward |
| Wing | `Bone_Wing1_L`, `Bone_Wing2_L`… | always numbered, from the body outward |
| Keep name | unchanged | the bone keeps its current name |


Numbers follow hierarchy depth within one actor, part, position and side. Spine
and Neck get numbers only when there is more than one; Arm, Leg, Tail and Wing
always get numbers. Arm, Leg and Wing numbering restarts for each limb chain,
even when two limbs are on the same side. Root through Head and Tail never receive a side suffix.

Positions and sides are measured at the first frame of Stand, not guessed from
old names. Leg pairs are ordered by foot position along X, front first. One pair
has no position word; two pairs use Front and Rear; three use Front, Middle and
Rear. More pairs use Middle1, Middle2, and so on.

Actors with visible Stand skin come first, then actors with two hands, then the
larger span of limb joints. Main has no prefix. Another actor with the same set
of proposed names is a Copy, with `_Death`, `_Portrait` or `_Copy` according to
its current bone/body names. Further copies add a number, such as `_Copy2`.
Other actors larger than Main use `Bone_Mount_…`, `Bone_Mount2_…`, etc.;
smaller actors use `Bone_Extra_…`, `Bone_Extra2_…`, etc. The actor word follows
`Bone_`, so a mount leg is `Bone_Mount_Leg1_Front_R`. An actor that POSE marks
as a mount with followers is never Main; the first eligible actor becomes Main,
and every other actor retains its normal relative order. A nested Body is a separate actor
only when at least two leg chains (without the Chain label) have it as their nearest body; otherwise
it stays with the enclosing actor and keeps its name. Names already used by another node receive a unique
numeric suffix. Kept names reserve their original names too.

Bones POSE does not identify start as **Keep name**, in **Not recognised** at the
end of the list. Assign a part to include one. The preview uses a renamed copy
in the rest pose, hiding geosets that Stand hides. Edits preserve your camera.

Wing limbs recognised only from shape keep every joint's name. Wing chains
with joints already read as Wing by name keep the standard naming above.

Shared hub joints keep their names. If a limb ends at an attachment, the last
bone uses Hand, Foot or Hoof only when POSE resolves that role; otherwise it
keeps the next Arm/Leg number. The attachment itself is never renamed. A lone
Hand, Foot or Hoof role outside a chain keeps its name; these parts come only
from chain endpoints.

A mesh-piece end that POSE grips by its skin uses `Mesh_` instead of `Bone_`:
`Mesh_Hand_L`, `Mesh_Foot_Front_R`, or `Mesh_Mount_Hoof_Rear_L`, with any copy
suffix retained. This preserves POSE's skin grip rather than treating the
mesh's arbitrary pivot as an authored joint.

Before showing the default proposal, Bone Namer plans and applies names to a
scratch copy, then asks POSE again, for up to three rounds. The list still shows
your original current names. Part, side and actor corrections apply on top of
that proposal; no model names change until Commit.
