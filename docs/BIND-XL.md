# BindXL

BindXL binds vertices to bones from where they sit around the skeleton, on a
moving model. The owner's brief: the geoset pose is how the model should look
and the skeleton is already laid out; it only needs binding. Armour keeps its
plating feel and moves as one piece; skin, cloth and fur bend; seams never tear.

Open it from the **BIND** dock icon, Managers → BindXL, or Alt+B. Commit
applies the result as one undoable edit ("BindXL"); Close discards it.

## What the user sees

- A preview playing an animation (Walk first, then an attack or spell), or
  **Flex**, which swings each bone in turn in the rest pose. Only the geosets
  that animation shows are drawn; it opens facing the model, fitted to it.
- **Bone colours**: every vertex shows the average colour of its bones, so a
  blended joint is a gradient and a stiff part is one flat colour. Untick to
  see textures. **Skeleton** draws the bones as lines.
- Four sliders (0–100%):
  - **Rebind** (Current ↔ Skeleton). Current keeps every binding whose bone
    is near its vertex and only fixes torn seams, strays and unbound vertices.
    Skeleton binds everything by position. Default 50%.
  - **Soft joints** (Sharp ↔ Smooth): how far bending parts blend two bones
    around a joint. Default 30%.
  - **Plates** (Bend ↔ Stiff): how readily a separate part moves stiffly with
    one bone. Default 70%.
  - **Seams** (Touching ↔ Near): how close vertices of different parts must be
    to share one binding. Default 20%.
- Click a part on the model to select it (Shift adds, Ctrl removes); its
  vertices show as dots and the bones it follows are listed with their colours.
  Choose **Auto / Stiff / Bend / Current** for it, or give it a bone from the
  list or with **Pick** (then click a joint in the preview; Esc cancels).
- Clicking a listed bone shows its vertices and a **Bind to this bone** tick.
- Dragging empty space turns the camera; the wheel zooms.

## How it binds ([src/bind-xl.js](../src/bind-xl.js))

- `analyzeBinding` (setting-free, ~0.1 s on a 5k-vertex model): flattens the
  vertices, finds **pieces** (faces joined inside one geoset, plus vertices on
  the same spot), lists **touching vertices** across the whole model, and
  measures every vertex against every bone region.
- **Regions** (`bindingBones`): a vertex follows a bone, but the bone moves with
  the nearest node that animates: itself, or, in Blizzard-style rigs, the helper
  joint it hangs under (those bones often share one junk pivot). A joint moves
  the space from its pivot to the joints below it; an end joint reaches on along
  its parent's direction. A joint whose only children are small end bones (jaw,
  mouth corners) still reaches past its pivot. Bones on one joint share a region.
- `planBinding` (~15 ms; runs on every slider move):
  1. nearest allowed region per vertex, speckles smoothed over neighbours;
  2. current binding kept where its bones are allowed and not much further away
     than the nearest bone (Rebind sets "much further");
  3. pieces mostly kept → **cleaned** (off vertices take their neighbours'
     binding, strays sharing no bone with any neighbour are fixed); otherwise
     **stiff** (one bone, or two when split evenly over neighbouring bones) or
     **bending** (bone plus close neighbours across a joint, up to 4);
  4. **seams**: touching vertices share one binding; kept parts win, then stiff
     and cleaned parts (the side agreeing with the skeleton first, then bigger).
- `defaultExcludedBones`: portrait/backdrop/glow bones, loose bones outside the
  skeleton (corpse gibs, planes) and roots that only carry the skeleton start
  turned off. Parts held only by turned-off bones keep their binding.
- `applyBinding` rebuilds classic vertex groups compactly (max 256 per geoset)
  or writes HD weights (summing to 255). `previewBinding` gives the preview a
  copy whose only new arrays are the bindings, so GamePreview re-uploads bone
  buffers (`isSkinOnlyPreviewChange`, `updateSkin`) without a rebuild.

## Measured against references (7 Nov 2026)

Scoring: strip or scramble a well-bound model, rebind it, play every animation
(7 samples each) and compare where each vertex lands with the authored binding,
as a share of model size. Sets: 70 native units, 34 owner models, and 40 other
well-bound reference models (kept private; not in the repository).

- Native standard: 63% of vertices on one bone, 30% on two; 74–79% of separate
  pieces stay on one bone (57% of vertices); seams across geosets always agree.
- From the skeleton alone (Rebind 100%): about 2% mean drift on native units,
  2.4% on owner models, 1.3–2.3% on the other references.
- On a well-bound model at the default Rebind 50%: 0.01–0.5% drift (nearly
  untouched).
- On a scrambled model (12% of pieces on a wrong nearby bone, 3% stray
  vertices, a quarter of seams torn): 15–25% of the damage repaired, with every
  seam closed.
- Tried and dropped: choosing a stiff piece's bone by the pivot inside it, or by
  the bone line passing through it (worse on owner models).

Pieces bound to a plausible but wrong nearby bone cannot be told from right
ones by position; the colours and click-to-fix exist for those.

## Checks

- [Engine](../test/bind-xl.test.js): regions, pieces, seams, soft joints, keep,
  marks, turned-off bones, Blizzard helper joints, HD weights, colours.
- [Packaged workflow](../test/bind-xl.electron.cjs): dock opens the window,
  animation plays, a left drag turns the camera, clicking selects a part, Stiff,
  a slider, colours off, Flex, Commit, Undo. Run hidden with a model argument.
