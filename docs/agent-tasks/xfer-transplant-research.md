# Transplant: design study (17 Nov 2026)

Transplant = the open model's mesh ends up on the donor's skeleton (donor bones, names, hierarchy,
fitted into the open model's body) and plays every donor animation; the open model's own
animations are dropped. Read-only study on branch `claude/transfer-xl`; no product code written.

Probes (all in `out/transfer-probe/`, outputs beside them as `.txt` / `.json`):

| Probe | What it measures |
| --- | --- |
| `transplant-pair.mjs` → `transplant-pair.txt` | The owner's pair: inventory, pairing read from the engine, skin per bone, unpaired bones, attachments and effects, rest-pose angles |
| `transplant-tree.mjs` | Node tree with pivots, keys and skin (used on the Kurgan and the Tauren) |
| `transplant-census.mjs` → `transplant-census.txt/.json` | 1,200 models: what a transplant must carry; 561 plain bodies x 4 donors: kinds of joint match and the skin on each |
| `transplant-joint-cost.mjs` → `transplant-joint-cost.txt` | For each donor joint: how far the point it carries moves from where its parent alone would put it (cost of "bind nothing to it") |
| `transplant-held.mjs` → `transplant-held.txt` | Whether a separately animated weapon stays in the hand (Tauren totem; Kurgan hammer and shoulder piece) |
| `transplant-extra.mjs` → `transplant-extra.txt` | Which skinned joints sit outside the body parts and move by themselves (Footman, Grunt) |

The pairing used everywhere is the engine's own: `buildTransfer` in `src/anim-transfer.js` hands the
taken parts (`entries`, each with `map` and `chordEnds` from `limbPairing`/`prepareTaken`) to its
`probe` callback; the probes read them there, so they measure exactly what stage 1 builds.

---

## 1. Inventory: everything in a parsed model that depends on the node list

Parsed model = `parseCompatibleMdx` (`src/mdx-compatibility.js`), on top of war3-model's `parseMDX`.
Node collections are listed in `NODE_COLLECTION_KEYS` (`src/animation.js`); `model.Nodes[ObjectId]`
indexes all of them; `allNodes(model)` returns them sorted by id.

| What | Where in the parsed model | Depends on nodes how | What a transplant must do |
| --- | --- | --- | --- |
| Bones, helpers | `model.Bones`, `model.Helpers`, `model.Nodes[id]`; `ObjectId`, `Parent`, `Flags`, `Translation`/`Rotation`/`Scaling` tracks | Are the skeleton | Replace the open model's body joints with the donor's (cloned, with keys). Keep own extras (weapon, plates, cloth bones) and re-parent them. |
| Pivot points | `model.PivotPoints[id]` and `node.PivotPoint` (aliased; `nodePivot` in `src/animation.js`) | One per node id | Donor joints get new pivots fitted into the own body (section 3, step 2). |
| Parent links | `node.Parent` (ObjectId or null/-1) | Node ids | Remap donor parents to new ids; own extras re-parented to the paired donor joint. |
| Node flags | `node.Flags`: inherit bits 1/2/4, billboard bits 8..64 (`setBoneBillboarded`, `inheritedParentMatrix` in `src/animation.js`) | Per node | Carry with each node. Census: billboarded nodes in 43% of models, nodes that do not inherit in 6%. |
| Classic skin | `geoset.VertexGroup[v]` → `geoset.Groups[g]` (array of node ids, equal weights), `TotalGroupsCount`; max 256 groups per geoset (`groupFor` in `src/bone-tools.js`) | Node ids | Rebuild every group with donor ids (section 3, step 3). Census: 89% of models have groups of more than one bone. |
| HD skin | `geoset.SkinWeights` (8 per vertex: 4 node ids, 4 weights summing to 255); ids are node ids (`skinGeoset`, `canonicalizeSerializedNodeOrder` remaps them) | Node ids | Same as groups. Census: 2 of 1,200 models. |
| Bind poses | `model.BindPoses[i].Matrices[id]`, camera matrices after the node slots (`createNode`, `deleteRigNode`, `canonicalizeSerializedNodeOrder`) | One matrix per node id | Census: 2 of 1,200. Refuse, as `commitPart` (`src/bits-and-parts.js`) does ("require baking"), or extend by id. |
| Bone geoset links | `bone.GeosetId`, `bone.GeosetAnimId` | Geoset / geoset-animation indices | Donor bones point at donor geosets: set null, as `importGeosets` and `pasteNodesToDummy` do. Census: 96% of models set them. |
| Attachments | `model.Attachments` (`Parent`, `AttachmentID`, `Path`, `Visibility` track) | Parent node | Re-parent (section 3, step 6). Census: in 93% of models; 8,638 hang on a joint, 2,665 at the top level. |
| Particle emitters (1, 2, popcorn), ribbons, lights | `ParticleEmitters`, `ParticleEmitters2`, `ParticleEmitterPopcorns`, `RibbonEmitters`, `Lights`; `Parent`, keyed `Visibility`, `EmissionRate`, etc.; PE2 `TextureID`, ribbon `MaterialID` | Parent node, sequence-timed keys, texture/material ids | Own: re-parent and re-time keys. Donor's: optional, imported with their texture/material (`createResourceImporter`). Census: 69% of models; 2,511 on a joint, 1,698 top level. |
| Event objects | `EventObjects`, `EventTrack` (frame list), optional `GlobalSeqId` | Parent node, frames inside sequences | Own events lose every frame when own sequences go; donor events carry the donor's sounds and footprints at donor frames. Census: 96% of models; 8,284 top level, 116 on a joint. |
| Collision shapes | `CollisionShapes` (`Shape`, `Vertices`, `BoundsRadius`) | Parent node | Keep the own ones (they fit the own mesh). Census: 87%. |
| Cameras | `model.Cameras` (portrait camera; `Position`, `TargetPosition`, tracks) | Not node-parented; bind-pose slots after the nodes | Keep the own camera (it frames the own head). Census: 37%. |
| Sequences | `model.Sequences[i]`: `Name`, `Interval`, `NonLooping`, `MoveSpeed`, `Rarity`, extents, `SyncPoint`, `Flags` | Every local key and event frame is placed inside an interval | Replace with the donor's list (same intervals keeps donor keys valid as they are). `MoveSpeed` scaled by size. Extents recomputed. |
| Per-sequence geoset extents | `geoset.Anims[i]` (one per sequence) | Sequence index | Rebuild for the new list (`fillSequenceExtents`, `newSequenceExtents` in `src/anim-transfer.js`). |
| Geoset animations | `model.GeosetAnims` (`GeosetId`, `Alpha`, `Color` tracks, `_MdxDefaults`) | Geoset index; keys timed in own sequences | Own geosets keep their animations, but their keys sit in dropped sequences: re-time (section 3, step 7). |
| Materials, texture animations | `Materials[].Layers[]` (`Alpha`, `TextureID` keyed), `TextureAnims` | Keys timed in sequences or global sequences | Local keys re-timed as geoset animations; global ones untouched. |
| Global sequences | `model.GlobalSequences` (durations), `track.GlobalSeqId` | Not nodes, but donor joint tracks may use them | Census: global-sequence tracks on joints in 41% of models. Copy durations with the donor nodes (`globalRef` in `createResourceImporter`). |
| Info counts and extents | `model.Info` (`NumBones`, …, extents) | Counts | `updateCounts`, `recalculateExtents` (`src/editor-document.js`). |
| Serialized node order | Writers resolve ids by section order; `hasCanonicalSerializedNodeOrder`, `canonicalizeSerializedNodeOrder` (`src/node-id-order.js`) | Every id above | Run `canonicalizeSerializedNodeOrder` last; it remaps parents, groups, skin weights and bind poses in one plan. |

Census of what else a transplant meets (`transplant-census.txt`, 1,200 models): format 800 in 800
models, 1200+ in 400; more than one root joint in 84% (Master/Mother setups, separate weapon roots);
translation keys on more than three joints in 81%; scaling keys in 73%; skin carried by still
"skin carrier" bones under turning joints (the Tauren's `Geo_*` habit) in 71%; skin on helpers in 1
model.

## 2. Existing helpers to reuse, and what is missing

Exists:

| Job | Function | Note |
| --- | --- | --- |
| Create a node with a free id, pivot slot, bind-pose slot | `createNode` (`src/editor-document.js`), `createRigNode` (`src/bone-tools.js`) | |
| Delete a node | `deleteRigNode` (`src/bone-tools.js`): strips it from groups and weights, handles bind poses, children become roots; `deleteNode` refuses while skin uses it | Children are unparented, not re-parented |
| Remove many nodes and renumber | `remapNodes` (`src/optimizexl-nodes.js`) | Remaps groups and parents only, **not** `SkinWeights` or bind poses |
| Renumber every reference safely | `canonicalizeSerializedNodeOrder` (`src/node-id-order.js`) | Groups, skin weights, bind poses, pivots, parents in one plan |
| Rename | `renameRigNode` (`src/bone-tools.js`, 79-byte limit); Bone Namer `planBoneNames` / `applyBoneNames` (`src/bone-namer.js`) | Donor names come with the donor nodes; Bone Namer not needed |
| Re-parent | `attachToBone` (`src/bone-tools.js`) | Parent must be a Bone; a transplant sets `Parent` directly |
| Bone ↔ helper | `changeNodeType` (`src/optimizexl-nodes.js`) | For donor joints that are helpers and must carry skin |
| Rebind vertices | `changeVertexBinding` (hard/soft/detach, `src/bone-tools.js`), `writeWeights`, `groupFor` | Per selection; a transplant needs a whole-mesh version |
| Bind by nearest existing binding | `inheritPartBindings` (`src/bits-and-parts.js`) | Nearest donor *vertex*, not nearest bone segment |
| Copy nodes with their keys from another model | `pasteNodesToDummy` (`src/node-clipboard.js`), node part of `importGeosets` (`src/editor-document.js`), both on `createResourceImporter` (`src/model-import.js`: global sequences, textures, materials, texture animations remapped) | Copy keys at source frame times; roots go under a DummyBone / anchor |
| Model format conversion | `adaptPasteFormat` (`src/paste-format.js`) | Donor Tauren is version 1800, the Kurgan 800 |
| Sequences | `createSequence`, `createSequenceFromCurrent`, `deleteSequence` (removes their keys and events), `reorderSequences`, `deleteGlobalSequence`, `fillSequenceExtents` (`src/sequence-editor.js`) | |
| Re-time every track of one animation into another interval (loops, seams, events) | `copyBodyAnimation` (`src/anim-transfer.js`) | Private; exactly the job of step 7 below |
| Animation of the same kind by name | `sameKindSequence` (`src/anim-transfer.js`) | Private |
| Extents of a new animation | `newSequenceExtents` (`src/anim-transfer.js`, private), `recalculateExtents` (`src/editor-document.js`) | |
| Retargeted keys for one limb | `buildTransfer`, `transferNodeTracks`, `applyTransfer` (`src/anim-transfer.js`) | For the unequal-joint limbs (section 4) |
| Body reading and pairing | `transferRig`, `transferWholeBody`, `limbPairing` (private), `poseLimbStart` (`src/pose-recognition.js`), `transferFeatures` | |
| Foot sole, body shapes, depth in body | `footSole`, `bodyShapes`, `depthIn` (`src/anim-transfer.js`, private) | For the gate (section 6) |
| Standard attachment points from the mesh | `planAttachments`, `applyAttachmentPlan` (`src/attachemator.js`) | Fallback for missing points |
| Unused bones | `unusedNodes` (`src/optimizexl.js`) | Drops the donor's emptied skin carriers |
| Check and write | `validateModel` (`src/editor-document.js`), `generateCompatibleMdx` (`src/mdx-compatibility.js`) | |
| Result in a new unsaved tab | `newSession(opened, null)` + `install` (`app/App.jsx`, `openGameModel`) | Same as opening a game model |

Missing (a transplant module would add these):

1. One "replace skeleton" operation that removes the own body joints, brings in the donor's, and
   remaps all references in one plan (pieces exist; no whole).
2. Whole-mesh rebinding by nearest bone segment inside a part (section 3, step 3).
3. Fitting donor pivots into another body (section 3, step 2).
4. Per-key constant correction of rotation keys (section 3, step 5); today only dense resampling
   through `buildTransfer`.
5. Re-timing the own non-skeleton tracks into the donor's sequence list by kind; `copyBodyAnimation`
   and `sameKindSequence` do it for one animation but are private.
6. Translation and `MoveSpeed` scaling by size (a `sizeRatio` exists, private).

## 3. Algorithm, step by step, with options

Size ratio below: open hip height / donor hip height (`sizeRatio`, `src/anim-transfer.js`); the
owner's pair 42.2 / 51.7 = 0.817 (`transplant-pair.txt`).

### Step 1. Pair (exists)
Stage 1 role pairing, unchanged: `transferRig` on both, `limbPairing` for arms and legs, trunk by
depth. On the owner's pair (`transplant-pair.txt`): every limb paired by role; arms 5 own joints on
4 donor joints (own collar `RAC` and shoulder piece `RAS` both on `Bone_ClavicalL`); legs 3 on 4
(own shin `RL2` spans `Bone_Leg2L`..`Bone_FootL`, the hock `Bone_Leg3L` has no own joint).

One change for transplant: the trunk pairs by *what hangs from it*, not by depth. The engine pairs
the Kurgan's `Head` with `Bone_Neck` and its `Hip` with `Root`; but the Tauren's legs hang from
`Bone_Pelvis` and its head mesh rides `Bone_Head` (`transplant-tree.mjs` on the Tauren). Skin on the
own hips must follow the joint the legs hang from; skin on the own head the deepest head joint.

### Step 2. Fit the donor skeleton into the open model

| Donor joint kind | Option A | Option B | Recommendation |
| --- | --- | --- | --- |
| Paired joint | Pivot = own paired joint's pivot. Cost: none; own proportions exact. | Donor pivot scaled by the size ratio about the hip centre. Breaks: own limbs are not donor-shaped (Kurgan upper arm is 0.27 of the Tauren's, size ratio 0.82), mesh and joints would not line up. | A |
| In-between limb joint (hock) | On the own segment it lies inside, at the donor's length fraction. | Leave the limb as the own joints (retarget-only limb, section 4). | B, see section 4 |
| Above the limb (donor collar the own lacks) | On the line from the own anchor (chest) pivot to the own limb's first joint, at the donor's fraction. Its turn then lifts the shoulder as it does on the donor. | Stacked on the own limb's first joint. Breaks: its turn swings the arm about the shoulder instead of lifting it. | A |
| Unpaired trunk joint (pelvis under a root, neck above a head) | Stacked on the paired joint's pivot: turns add about one point; orientation exact, place off by the donor's offset. | Donor offset from the paired joint, scaled by size. Breaks: the Tauren neck pivot sits 18 units above its head pivot (hump); scaled onto the Kurgan it lands inside the head. | A |
| Donor-only parts (tail, the Tauren's totem root `Bone_Totum`) | Donor pivots scaled by the size ratio about the hip centre, kept. | Dropped. Breaks: donor animations that move them lose that motion; harmless with no own skin on them. | A (they cost nothing; a tail with no skin is invisible) |

### Step 3. Re-attach the mesh

Per vertex (classic groups: per group), the own bone it follows becomes a donor bone:

| Own bone kind | Option A | Option B | Recommendation |
| --- | --- | --- | --- |
| Paired one to one | The paired donor joint. | — | A |
| Several own joints on one donor joint ("shared") | All to that donor joint. The donor has no motion between them, so nothing is lost. | — | A |
| Own joint with no donor counterpart (own collar, "none") | The donor joint its anchor pairs with. | The donor joint the next own joint pairs with. | A (Kurgan `RAC`, `LAC` carry 0 vertices) |
| Own skin on a still carrier bone (`Geo_*` habit, 71% of models) | Counted for the part joint that moves it (what `transplant-census.mjs` does). | — | A |
| One own bone over several donor joints of its part (own head over neck+head, own hip over root+pelvis, own shin over hock) | Nearest donor bone segment, restricted to the donor joints of that part; vertices near a boundary get both (classic: a 2-bone group; HD: split weights). | Whole bone to one donor joint. Breaks: see the costs in section 4 (Tauren hock 0.18 hip heights at the median). | A for trunk parts; the hock is section 4 |
| Donor joint is a helper (all 26 animated Tauren joints are helpers; skin on helpers occurs in 1 of 1,200 models) | Bind to its still skin-carrier child bone when it has exactly one (`Geo_*`). | Turn the helper into a bone (`changeNodeType`). | B: one rule for every model; the emptied carriers then go with `unusedNodes`. Whether the game draws vertices bound to helpers is not verified (inferred: avoid). |
| Classic group limit | A geoset holds at most 256 groups (`groupFor`). The rebinding can only merge groups (many own bones onto fewer donor joints) except where step A of the last row splits; check per geoset. | | |

### Step 4. Copy the donor's keys
Copy every donor joint's `Rotation`, `Translation`, `Scaling` tracks with the donor's sequence list
and intervals unchanged, so no key moves in time (`createResourceImporter.globalRef` for global
sequences). Then:

| Track | Option A | Option B | Recommendation |
| --- | --- | --- | --- |
| Rotation | As they are. | Multiplied per key by constants (step 5). | Step 5 decides |
| Translation, body joint | Times the size ratio. | Times own/donor limb length. | A. Tauren `Root` moves up to 3.4 hip heights, Grunt 2.5, Ghoul 2.4 (`transplant-joint-cost.txt`): unscaled, a smaller model would leap and slide by donor distances. |
| Translation, other joints | Times the size ratio. | Times own/donor length of the stretch above it. | A first (simple). Sizes measured: Tauren feet up to 0.71 hip height (other Tauren keys are zero), Grunt arms up to 0.49, Ghoul up to 0.43. B only if the gate shows hands or feet drifting. |
| Scaling | As they are (ratios). | — | A |
| `MoveSpeed` | Times the size ratio. | Left. Breaks: feet slide in game. | A |

### Step 5. The rest-pose difference
Measured on the owner's pair, angle between own and donor rest stretches (`transplant-pair.txt`):
collar 12°, upper arm 21°, forearm 22°, thigh 19 to 25°, lower leg 3 to 5°. Collection: half of all
limb parts within 8 to 13° of the average direction (rest census, task note).

With rotation keys copied as they are and pivots at own places, every node's world turn equals the
donor's, so each own stretch stays off the donor's by exactly its rest difference at every moment
(it does not add up down the chain; positions of hands and feet are off by the sum of length x
angle).

| Option | Cost | Breaks |
| --- | --- | --- |
| A. Leave it | Nothing; keys byte-identical to the donor's. | Every limb part off by its rest difference (Kurgan thighs 19 to 25°): splayed or tucked legs, feet off the ground, hands off a two-handed weapon. |
| B. Correct the keys, per key, by constants | For each paired joint i: q'(t) = C(parent)⁻¹ · q(t) · C(i), where C(i) turns the own rest stretch onto the donor's. Key count unchanged; slerp and tangent quaternions transform the same way (inferred: Hermite/Bezier tangents need the same multiply). Mesh and rest view untouched. In game the result equals option C. | Twist about the bone is free in C(i): the shortest turn keeps the own palm and weapon as modelled; a bend-plane match (elbow, knee) is better and costs one more axis. |
| C. Re-pose the mesh once | Skin the mesh once with the pose C and bake; keys then copied as they are. | Changes the model's geometry and rest view; joints of hard-skinned SD meshes open by 12 to 25° in the rest pose (they open more than that in any animation, so in game it is no worse). |
| D. Retarget (`buildTransfer`, Pose = Theirs) for every animation | Proven (pose-fair: 0 to 4°), with feet kept down and grips. | Dense resampled keys, not the donor's; that is retargeting, which the owner keeps as the other mode. |

Recommendation: B for limbs (exact donor motion, own mesh and look unchanged); A for the trunk (the
Tauren's hunch is in its shape, not its pose, stage 2 `stance-check`; turning the own torso to the
donor's would change the model's look). Feet then land where the donor's land, scaled; contacts are
the donor's.

### Step 6. Own extras, attachments, effects

| Thing | Option A | Option B | Recommendation |
| --- | --- | --- | --- |
| Own extras (weapon, plates, cloth, belt: skinned joints outside the parts that move by themselves; census median 26% of a model's skin, Kurgan 63%: hammer `Wep` 675, shoulder piece `RP` 222, `Belt` 8) | Keep the node and its skin; parent = the donor joint its old parent pairs with; its keys frozen at the own reference pose (relative to its parent). | Keep it and re-drive its keys from its own animation of the same kind (step 7). Breaks: the own keys were made for the own body's motion; on the donor's motion they swing at the wrong moments. | A, plus followers: where `ownMotion` finds a steady share of a limb joint's turn (shoulder pads), carry that share of the paired donor joint's turn. Measured: Kurgan `RP` turns up to 104° relative to its collar in its own animations, `Wep` up to 180° relative to its hand (`transplant-held.txt`); frozen, those motions are gone. |
| Weapon when the donor animates its weapon apart from the hand (Tauren `Bone_Totum`, its own root, `Weapon Ref` on it) | Hang the own weapon on the donor's hand. Breaks: the donor's weapon leaves the hand in its attacks (totem up to 54 units and 165° from the hand in Attack - 1, 82 units in Attack Slam; 2 units in Stand and Walk, `transplant-held.txt`): a thrown or swung-away weapon stays in the hand. | Hang it on the donor's weapon node, placed so the grip matches at the donor's reference frame. Breaks when the two weapons are held differently (a hammer vs a totem pole). | Owner decision; default A (the hammer stays in the hand), since the donor's weapon node has no own-weapon meaning. |
| Own attachments (`Weapon Ref`, `Hand Right Ref`, …) | Keep, re-parent to the donor joint the old parent pairs with; positions stay on the own mesh. | Take the donor's, positions fitted like step 2. | A; `planAttachments` places any standard point the model lacks. Kurgan: 7 of 9 hang on paired joints; `Origin Ref` and `Overhead Ref` hang on `Mother` (a container helper with no skin). |
| Own attachment and emitter keys (Visibility, emission) | Re-timed like step 7. | — | A |
| Donor emitters, events (Tauren: 2 particle emitters, 10 events, footprints and sounds) | Bring them (events at the donor's frames, which are the new sequences' frames; emitters with texture via `createResourceImporter`, positions scaled). | Leave them; keep own events. Breaks: own event frames sat in dropped animations; the result is silent. | A for events (sounds and footprints belong to the motion); emitters: owner decision. |
| Own containers (`Master`, `Father`, `Mother` helpers, top-level `Portrait Background`) | Keep at the top level, keys frozen. | — | A |
| Own collision shapes, camera | Keep. | — | A |

### Step 7. Everything else timed in sequences
Own geoset animations (Kurgan: 15), material and texture-animation keys, attachment visibility: for
each donor animation, copy the keys of the own animation of the same kind (`sameKindSequence`),
fitted to the new length (`copyBodyAnimation` does this, including loop seams and events), else of
the own Stand. Without this, a geoset hidden except in Portrait or Death shows everywhere or
nowhere. Then extents per animation (`newSequenceExtents`), `updateCounts`,
`canonicalizeSerializedNodeOrder`, `validateModel`.

## 4. Unequal joints

Kinds (open model against donor, by the engine's pairing; `transplant-census.txt`, 561 plain bodies;
"skin" = share of the open model's skin on joints of that kind, median / 90th percentile):

| Kind | Tauren (limbs 4/4/4/4) | Grunt (3/3/3/3) | Footman (3/2/3/3) | Ghoul (3/3/3/3) |
| --- | --- | --- | --- | --- |
| Paired one to one | 554 models; skin 59% / 77% | 553; 59% / 81% | 553; 55% / 76% | 554; 63% / 83% |
| Several own joints on one donor joint | 128 models; skin 0% / 5% | 148; 0% / 26% | 523; 5% / 30% | 117; 0% / 6% |
| Own joint with no donor joint (own collar) | 14; skin 0% / 0% | 80 | 80 | 80 |
| Own joint spanning donor joints (donor hock) | **502 models; skin 4% / 8%** (208 models over 5%) | 0 | 0 | 0 |
| Donor joint above the limb (donor collar) | 492 | 0 | 0 | 0 |
| Donor limb joint between paired ones, not spanned | 74 | 42 | 13 | 173 |
| Donor trunk joint unpaired | 461 | 76 | 76 | 461 |
| Own skin on extras (weapons, plates, second bodies) | 26% / 58% | same | same | same |
| Own skin outside every part (gutz, portrait backgrounds) | 7% / 13% | same | same | same |

Limb shapes: own legs 3 joints in 974 of 1,122, own arms 3 in 911; the Tauren is the only standard
donor with four-joint limbs, so the hock problem is a donor-with-hooves problem, and nearly every
model meets it with such a donor (502 of 561).

What skipping a donor joint costs (`transplant-joint-cost.txt`; how far the point the joint carries
moves from where its parent alone puts it, share of hip height, median / 90th / max, over every
animation except death, decay, portrait):

| Donor joint | Cost |
| --- | --- |
| Tauren hock `Bone_Leg3L` / `R` | 0.18 / 0.30 / 0.78 and 0.09 / 0.34 / 0.84 |
| Tauren collar `Bone_ClavicalL` / `R` | 0.01 / 0.18 / 0.24 and 0.00 / 0.14 / 0.34 |
| Tauren neck, head | 0.10 / 0.21 / 0.31; 0.06 / 0.18 / 0.32 |
| Pelvis under a root | Tauren 0.00 / 0.02 / 0.03; Grunt 0.01 / 0.04; Footman 0.10 / 0.20; Ghoul 0.01 / 0.10 |

Options for a limb joint only one side has:

| Option | Cost | Breaks |
| --- | --- | --- |
| 1. Keep the donor joint, bind nothing to it | None; skeleton and keys exact. | Hock: the shin's lower end and the foot part by the hock's cost, about 9 units at the median and 16 to 18 at the 90th percentile on the Tauren (hip height 52): a visible gap or overlap at the ankle. Collar: small (median 0), shoulder seam stretches at the 90th percentile. Pelvis: negligible except Footman-like pelvises (0.20). |
| 2. Bind the neighbouring mesh across it (split by nearest segment, blended band) | Same skeleton; mesh rebinding only. | With option 5B the straight own shin is bent into the donor's hock shape: the Tauren's rest hock is a 104° zig-zag (angle between its two shin stretches, computed by hand from the `Bone_Leg2L` → `Bone_Leg3L` → `Bone_FootL` pivots that `transplant-tree.mjs` prints), so a Kurgan would grow backward hocks. Without 5B for those two joints the shin bends only by the hock's motion, but feet no longer land where the donor's land. |
| 3. Drop the joint and convert keys | Skeleton = donor minus that joint; the own shin follows the donor's knee-to-foot line, the foot keeps the donor's world turn. | Keys are recomputed for that limb (no longer as they are); the knee-to-foot distance changes as the hock bends, so feet need the stage 2 placing to stay down. |
| 4. That limb is "retarget only" | The limb keeps its own joints, hung on the donor's anchor; its keys come from `buildTransfer` (Pose = Theirs, feet kept down) for each donor animation. Proven on this pair: thigh 0°, lower leg 0 to 1° from the Tauren's (pose-fair), feet stay down in 95% of 530 bodies (contact-sweep). | Mixed skeleton (own leg bones under the donor pelvis); more keys; build time per animation. |

Recommendation: 4 for limbs where the open model's limb has fewer joints *inside* the limb than the
donor's (the hock: spanned, "chord"); 1 for donor joints above the limb (collars) and unpaired trunk
joints, with option 2's nearest-segment split on the own trunk mesh near them (head over neck and
head, hip over root and pelvis); "shared" and own-only joints as step 3. The window can show such a
limb as "follows" instead of "transplanted" (owner to decide whether it shows at all).

## 5. The owner's pair (Kurgan `TEST TRANSFER 03.mdx`, donor `transfer-donors\Tauren.mdx`)

From `transplant-pair.txt` and `transplant-tree.mjs`:

- **Formats.** Kurgan: version 800, 15 geosets, 1,445 vertices, classic groups (1,322 vertices on a
  single bone), 26 bones and helpers, 9 attachments, 8 events, 2 collision shapes, 1 camera, 15
  animations, 15 geoset animations, no emitters. Tauren: version 1800 without HD skin, 3 geosets,
  571 vertices, 24 still `Geo_*` skin bones under 26 animated helpers, 9 attachments, 2 particle
  emitters, 10 events, 10 animations (incl. `Decay Flesh`, `Decay Bone`).
- **Sizes.** Hip height 42.2 vs 51.7 (ratio 0.817). Stretch lengths own/donor: thigh 0.66 to 0.71,
  shin 0.75, collar 0.61, upper arm **0.27**, forearm 0.38 to 0.39: proportions differ far more than
  the size ratio says, which is why step 2 keeps own pivots.
- **Skin per own bone** (weighted vertices): `Head` 312, `Hip` 25, `Chest` 24, `Belt` 8, left arm
  `RAC` 0 / `RAS` 6 / `RA1` 4 / `RA2` 14 / `RAH` 7, right arm `LAC` 0 / `LAS` 1 / `LA1` 4 / `LA2` 20 /
  `LAH` 13, left leg `RL1` 22 / `RL2` 19 / `RLF` 12, right leg `LL1` 23 / `LL2` 19 / `LLF` 12; extras
  `Wep` 675 (hammer), `RP` 222 (piece on the left collar), `Portrait Background` 4.
- **Pairing (engine).** `Hip`→`Root`, `Chest`→`Bone_Chest`, `Head`→`Bone_Neck`; `RAC`,`RAS`→
  `Bone_ClavicalL`, `RA1`→`Bone_UpperArmL`, `RA2`→`Bone_LowerArmL`, `RAH`→`Bone_HandL` (right arm the
  same); `RL1`→`Bone_UpperlegL`, `RL2`→`Bone_Leg2L` across to `Bone_FootL`, `RLF`→`Bone_FootL` (right
  leg the same). (The Kurgan's `R*` bones are on its left; names are viewer-side.)
- **Skin by kind.** On paired part joints 536 vertices (37%), on unpaired part joints 0, on bones
  outside the parts 909 (63%: the hammer 47%, the collar piece 15%, belt and portrait background).
  On spanning joints (the shins) 38 (2.6%).
- **Own bones with no counterpart.** `RAC`, `LAC` (0 vertices, share the clavicle), `Belt` (8, sits
  between `Hip` and `Chest`, moves by itself; the Tauren's chest hangs straight from `Root`), the
  extras above, and the containers `Master`, `Father`, `Mother` (no skin; carry events and two
  attachments).
- **Donor bones that get no vertices.** Of 50 donor bones and helpers, 17 take own skin; left
  empty: `Bone_Pelvis` (engine pairs the hip with `Root`; step 1 change fixes it), `Bone_Head`
  (engine pairs the head with `Bone_Neck`; step 1 change), `Bone_Leg3L`/`R` (the hocks), `Bone_Tail1`
  to `4` (no own tail), `Bone_Totum` (the totem's root), and all 24 `Geo_*` skin carriers plus
  `gutz00` (redundant after rebinding).
- **Attachments.** Own `Weapon Ref` on `Wep`, `Hand`/`Foot`/`Chest`/`Head Ref` on paired joints,
  `Origin`/`Overhead Ref` on `Mother`. Donor `Weapon Ref` on `Bone_Totum`.
- **Rest-pose difference.** collar 12°, upper arm 21°, forearm 22°, thigh 19 to 25°, shin 3 to 5°.
- **Weapons.** Tauren totem stays within 2 units and 3° of the hand in Stand, Walk, Stand Ready;
  leaves it in Attack - 1 (54 units, 165°), Attack Slam (82 units, 116°), Stand - 3 (10 units, 36°),
  Stand Victory (7 units, 25°). Kurgan hammer turns up to 180° relative to its hand in its own Spell
  Slam (dropped with its animations).

Feasible: every limb joint pairs by role; no skinned own body joint lacks a counterpart; the only
real mismatch on the body is the hock (38 vertices). The work is in the extras (63% of the skin,
whose own motion is lost) and the weapon question.

## 6. Measuring success without eyes (gate)

Each as statistics over the collection and per donor; compare against the same measure on the open
model's own animations and on the donor's own (a native baseline), never one yes/no.

| Measure | Catches | Misses |
| --- | --- | --- |
| Skin coverage: share of own skin bound to a donor joint paired by role, and on each kind of section 4 | Pairing failures, bodies read wrongly, models that are mostly extras | Anything about motion |
| Pose fidelity: each limb stretch's angle to the donor's paired stretch over time (as `pose-fair.mjs`, `pairing-sweep.mjs`) | Wrong sides, wrong pairing, missing rest correction | Mesh tearing; extras |
| Seam stretch: each mesh edge (vertices welded by place, as `bodyShapes` does) length over time against the rest, 99th percentile and share of edges over 1.5x | Gaps at skipped joints (hock, collar), wrong rebinding, extras hung on the wrong joint | SD meshes that already open at joints (needs the native baseline) |
| Sole contact: lowest vertex of each foot's own skin (`footSole`) against the floor over time, against the donor's sole, scaled | Floating and sinking feet. Not the ankle joint's height: that lifts 25 to 47% of hip height in native walks with toes down (stage 2 lesson) | Sliding (add: sole speed while down) |
| Sole sliding: horizontal speed of a planted sole against `MoveSpeed` | Wrong translation or `MoveSpeed` scaling | Short contacts |
| Arms in the body: arm points inside trunk shapes (`bodyShapes`, `depthIn`) against the open model's own animations | Proportion clashes (long donor swings on a broad body) | Weapon-through-body |
| Weapon path: own `Weapon Ref` against the donor's, scaled, per attack | Weapon left in the hand while the donor's is thrown; weapon pointing the wrong way | Look of the swing |
| Structural: `validateModel` without errors, round trip through `generateCompatibleMdx` / `parseCompatibleMdx`, finite keys, group count ≤ 256, unique names | Broken files | Everything visual |
| Geoset visibility: per animation, which own geosets show, against the own animation of the same kind | Lost or wrong visibility (death gutz everywhere, portrait background in game) | Colour |

## 7. Decisions open for the owner (with recommended defaults)

1. Where does the result go? Default: a new unsaved tab named "<model> on <donor>", the open model
   untouched (stage 3 note already says never over the open model).
2. The model's own Portrait and Portrait Talk: replace with the donor's, or keep the own? Default:
   take the donor's like every other animation, keep the own camera.
3. Attachments: keep the model's own, moved onto the new skeleton? Default: yes; add missing
   standard points from the mesh.
4. Effects and sounds: bring the donor's emitters and events? Default: events yes (they belong to
   the motion), emitters off unless ticked.
5. The model's own extras (weapon, plates, cloth) lose their own motion. Default: kept on their
   bones, still, except pieces that follow a limb (shoulder pads), which keep following.
6. Weapon when the donor's weapon moves apart from the hand (Tauren totem): stays in the own hand,
   or follows the donor's weapon? Default: stays in the hand.
7. A leg or arm with a joint only the donor has (the Tauren's hock): that limb follows the donor
   (retarget) instead of taking its bones. Show it in the window or do it silently? Default: silently,
   with a one-word mark on that part.
8. Poor fit (bodies not read as two arms and two legs on both, different leg counts, or most skin on
   extras): refuse with a reason, or transplant what pairs? Default: refuse, name the reason, point to
   retargeting.

## 8. Risks, and the three most likely to make it look bad

Risks:

- Extras carry a large share of the skin (median 26%, Kurgan 63%) and lose their own motion; capes,
  hair and belts go stiff.
- Donor weapons animated as their own root (Tauren totem) leave the hand in attacks; an own weapon
  hung on the hand will not follow.
- Hard-skinned SD meshes open at joints; rest correction (step 5B) moves the own limbs by 12 to 25°
  more than they were modelled for.
- Proportions: the Kurgan's upper arm is 0.27 of the Tauren's while the size ratio is 0.82; donor
  arm swings designed around a long arm meet a broad body (arms through the belly).
- Format: donor 1800, open 800; bind poses and HD skin exist in 4 models only, but must be refused or
  handled.
- Group limit 256 per classic geoset when splitting bindings.
- Helpers as skin bones are untested in game (inferred risk; avoided by converting to bones).
- Twist: the shortest rest correction can roll a hand and its weapon; needs the bend-plane match.
- Geoset visibility and material keys re-timed by animation kind; animations with no own kind (the
  Tauren's `Stand Victory`) fall back to Stand.

Most likely to make the result look bad:

1. **Stiff extras and the weapon.** The hammer and the shoulder piece are most of the Kurgan's mesh;
   frozen on their bones they ride the donor's motion without their own swing, and the hammer stays
   in the hand where the Tauren throws its totem.
2. **Hooves to feet.** With a hoofed donor nearly every model (502 of 561) meets the hock; any choice
   other than "retarget that limb" shows a gap at the ankle (median 0.18, 90th 0.30 hip heights) or
   backward-bent shins.
3. **Proportion clashes.** Donor motion made for long Tauren arms and a hunched trunk, played on a
   short-armed, upright body: hands that miss the weapon grip, arms into the torso, feet whose
   stride no longer matches the scaled `MoveSpeed`.
