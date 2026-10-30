# Sort My Mess

The Material, Texture and Geoset managers share one **Sort My Mess** button. It is a guided cleanup: **list what exists → show what differs → ask for the choices → apply only the selected fixes.** Nothing changes until **Apply selected**.

## List first

The dialog opens on an inventory of the current model, grouped by recognizable texture names:

**Texture → Geosets → Materials → Differences → Proposed fix → Choice**

- A texture imported several times (different texture records, or different case and slashes in the path) still forms one group. Its records are listed under *Records*.
- Team colour and fixed colour tints decorate a material; they do not split a group. Materials that mix several textures in their layers form their own group, marked **mixed** (for example *Felwood_Poison + HeroTinkerTank*). They are never folded into the plain texture's group.
- Every number is the 1-based geoset or material number shown in MDLxL for the model currently open.

Groups whose parts look identical (same material content, RGB, visibility behaviour, UV/skin format and selection settings) get a proposed merge. Exact copies (same triangles, same bindings) are proposed for deletion. Parts that share a texture but differ are listed as **Decide: …**; conflicts are shown, not hidden.

## Differences

Clicking a group shows each part and only the differences that exist:

- **RGB**: no tint, a static value (0–255), or an animated track. Stored defaults that only the unanimated view uses are listed separately.
- **Visibility**: which parts show in which named animations, with exact timing (for example *shown → hidden at 98133 (final frame)*). Behaviour is compared by sampling every track at the union of their keys, so matching keys with different defaults, or different keys with the same result, are judged by what actually renders.
- **Material**: opacity/filter mode, two-sided, other shading flags, team colour, extra layers, layer alpha, texture records, draw priority and texture animation.
- **Same shape**: identical triangles, either exact copies or copies bound to different bones (swap copies used by different animations).
- **Compatibility**: UV-set, tangent and skin-weight formats that prevent a merge, selection/LOD settings a merge would drop, several geoset animations, and global visibility loops.

## Choices

Per part: **Keep**, **Delete**, or **Merge into N** (a kept, compatible part of the same group). A merge uses the target's settings unless the result box says otherwise:

- *Material*, *Color* and *Visibility from* appear only when the parts differ in that respect, and offer existing parts' settings. RGB is never invented.
- Per-animation chips set the result's visibility: click to show or hide it in that animation; outlined chips are changes. **Show in portraits**, **Shown where any part shows** (each animation takes the visibility, including exact timing, of the part that shows most) and **Reset** are shortcuts.
- **Adjust** opens the same box for a kept part without merging.

Per group: **Make opaque** (bottom layer becomes Opaque; upper layers such as team colour stay), **Make two-sided** (every layer), **Share identical records**, **Use proposed fix**, **Leave as is** and **Clear**. A material shared with anything outside the choice (another part or a ribbon) is copied before it changes.

Choices are kept per group while other groups are refined. The After preview and the **What changes** list show the result of every selected choice before it is applied; **Check** chips jump the synchronized previews to the animations whose visibility changes. Both previews rotate together with the mouse. Opening a group frames its parts once; choices, Check chips and animation changes keep the user's camera (`frameKey` in `GamePreview`).

## Apply

**Apply selected** commits every selected choice as one undoable document edit. The list refreshes with the new numbers and a summary shows:

- merged parts and their new number, deleted parts, and the full old → new mapping on request;
- a check that every part outside the choices is unchanged, and triangle counts before and after;
- what was not checked here (Warcraft III in game; overlap order inside merged see-through parts).

*Leave as is* marks stay with their groups after applying. Closing the dialog (Escape or ×) discards unapplied choices.

Merging appends the other parts' triangles to the target geoset (its vertices first), unions animation extents, and remaps geoset animations, bones' geoset references and gliders. Only materials and textures that the applied choices left unused are removed; older unused records stay. Interpolated texture-ID tracks keep their texture index domain.

## Research and correction boundaries

Hive's [Model Optimizer](https://www.hiveworkshop.com/threads/model-optimizer-v1-3-0.323265/) records fixes for texture merging breaking Texture ID animations, and textures used only by those animations being deleted. Texture removal here uses the existing `visitTextureReferences` owner: classic and HD slots, discrete texture-ID keys, retained static MDX defaults and particle-emitter references. Interpolated texture-ID domains are preserved rather than compacted.

The author of [War3 Model Tuner](https://www.hiveworkshop.com/threads/war3-model-tuner-v1-3-8.357550/) notes ribbon emitters must be considered when removing materials. Geosets and ribbons are both treated as material users.

[Modeling and Animation 101](https://www.hiveworkshop.com/threads/modeling-and-animation-101.41840/) explains that filter modes composite differently and team colour uses replaceable ID 1 in an ordered layer stack. Layer passes are therefore never treated as redundant merely because their texture matches, and appearance changes always wait for the user's choice.

Matching settings do not guarantee an identical render: merged see-through parts draw in one geoset, so their overlap order can change. The dialog says so when it applies.

This manager command owns resource and geoset consolidation and explicit appearance choices. It does not invoke or alter OptimizeXL's accepted reductions, irregularity repairs, animations or immutable flail baseline. No fixture counterpart is used at runtime.

## Verification

`test/sort-my-mess.test.js` covers texture grouping across repeated imports, mixed and team-colour materials, every difference kind with exact timing, proposals (merge, delete copies, open decisions), merge-into-target with old → new mapping and bone/glider remapping, X's colour with Y's visibility plus per-animation overrides, "shown where any part shows" timing, opaque/two-sided without merging (with copy-on-write for a ribbon's material), deleting copies, sharing only orphaned records, interpolated texture-ID protection, refused invalid choices, MDX/MDL reopening and undo/redo. With `MDLXL_SORT_NURGLE` (and optionally `MDLXL_SORT_NURGLE_RESULT`) it replays the accepted Nurgle Tinker and Brown Magnataur choices and compares every resulting part with the accepted file.

`test/sort-my-mess.electron.cjs` drives the packaged dialog on the same choices: list and details, choices that persist across groups, the After preview and What changes, synchronized mouse rotation, real-speed playback, Apply with the mapping summary, Escape, and Undo/Redo.
