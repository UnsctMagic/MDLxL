# BindXL

BindXL binds vertices to bones on a moving model. The owner's brief: the
geoset pose is how the model should look and the skeleton is already laid out;
it only needs binding. Armour keeps its plating feel and moves as one piece;
skin, cloth and fur bend; seams never tear. Above all, BindXL must never
destroy a good binding.

Open it from the **BIND** dock icon, Managers → BindXL, or Alt+B. Commit
applies the result as one undoable edit ("BindXL"); Close discards it.

## What the user sees

- A preview playing an animation (Walk first, then an attack or spell), or
  **Flex**, which swings each bone in turn in the rest pose. Only the geosets
  that animation shows are drawn; it opens facing the model, fitted to it.
- **Bone colours**: ten strong colours; bones next to each other in the
  skeleton or in the model never share one. A blended joint shows the mix of its
  two colours; a stiff part is one flat colour. Clicking a bone (a chip in the
  part panel, or a joint while picking) lights up only its area in yellow and
  turns everything else grey; clicking it again goes back. Untick to see
  textures. **Skeleton** draws the bones as lines.
- Two sliders (0–100%):
  - **Soft joints** (Sharp ↔ Smooth): how far bending parts blend two bones
    around a joint. Default 30%.
  - **Plates** (Bend ↔ Stiff): how readily a part that needs a new binding
    moves stiffly with one bone. Default 50%.
- **Protect current binding**, off by default. Off, BindXL changes a bound
  part only on strong evidence (below). On, a **Protect** scale (None ↔ Full,
  starting at Full) sets how much of the current binding to keep: Full keeps
  every bound part and only fixes torn seams, stray and unbound vertices; None
  binds everything again from the skeleton, except parts marked Good.
- Click a part on the model to select it (Shift adds, Ctrl removes); its
  vertices show as dots and the bones it follows are listed with their colours.
  Choose for it:
  - **Auto**: BindXL decides; a part that is bound well stays.
  - **Stiff**: one bone, the one a well-bound model would use for what the part
    sits on. Several selected parts marked Stiff together move as one plate
    with one shared bone (a shoulder guard made of five parts).
  - **Bend**: bound again per vertex from the skeleton, with Soft joints.
  - **Good**: locked; nothing in BindXL changes it.
  - Or a bone from the list, or with **Pick** (then click a joint; Esc cancels).
- A clicked bone also shows a **Bind to this bone** tick.
- Dragging empty space turns the camera; the wheel zooms.

## How it binds ([src/bind-xl.js](../src/bind-xl.js))

- `analyzeBinding` (setting-free; about 0.1–0.2 s on a 3–4k-vertex model):
  - flattens the vertices and finds **pieces** (faces joined inside one
    geoset, plus vertices on the same spot);
  - lists vertices on the same spot across the model (seams), and the three
    nearest vertices of other pieces for every vertex (what a piece sits on);
  - measures every vertex against every bone region;
  - finds which geosets show in the living animations (portrait backdrops and
    gibs that only show while dying or decaying stay as they are);
  - samples up to 64 animation poses (Flex poses for a model without
    animations) and judges every stiff piece: does its bone rank close to the
    best candidate, and does it keep the piece with what it sits on as well as
    the best one would (`misrank`, `misfit`);
  - estimates whether each piece is likely stiff or bending from its shape
    around the skeleton (`stiff`).
- **Regions** (`bindingBones`): a vertex follows a bone, but the bone moves with
  the nearest node that animates: itself, or, in Blizzard-style rigs, the helper
  joint it hangs under (those bones often share one junk pivot). A joint moves
  the space from its pivot to the joints below it; an end joint reaches on along
  its parent's direction. Bones on one joint share a region.
- **Ranking a stiff piece's bone** (`pieceRows`): candidates are the bones near
  its vertices, bones whose pivot sits inside it, and the bones of what it sits
  on. A weighted score ranks them; the weights come from a study of about 970
  well-bound models (natives and community models, kept private, not in the
  repository) and were checked on 816 more. Strongest clues: the bone of the nearest other geometry, a bone
  of its own whose pivot sits at the piece's centre, and the nearest bone.
- `planBinding` (about 10–20 ms; runs on every slider move):
  1. nearest allowed region per vertex, speckles smoothed over neighbours, and
     separate islands of one bone on a piece (the inside of a thigh claimed by
     the other leg) given to what surrounds them;
  2. each piece **stays** (kept or cleaned) or is bound again as **stiff** or
     **bending** (Plates against its `stiff` estimate). Without Protect a bound
     piece stays unless its bone ranks more than 6 below the best and drifts at
     least 2% of the model size further from what it sits on; a part alone on
     a prop bone (an end bone never blended with another) always stays;
  3. cleaned pieces: unbound or turned-off vertices take their neighbours'
     binding; strays sharing no bone with any neighbour take theirs;
  4. stiff pieces, biggest first, take the best-ranked bone for what they sit
     on (so small plates see their bigger neighbours' new bones);
  5. **seams**: vertices on the same spot of one body move together. A piece
     bound again takes the binding of the piece that stays; two pieces that
     stay blend their seam only across a parent-child joint. Pieces on
     unrelated skeletons (a rider and its mount, chains, bats) never glue.
- `defaultExcludedBones`: unused portrait/backdrop/background/glow bones, unused
  loose bones and roots that only carry the skeleton start turned off. A bone
  the model already uses is never turned off (modellers blend with a still bone
  to calm a part's motion).
- `applyBinding` rebuilds classic vertex groups compactly (max 256 per geoset)
  or writes HD weights (summing to 255). `previewBinding` gives the preview a
  copy whose only new arrays are the bindings, so GamePreview re-uploads bone
  buffers (`isSkinOnlyPreviewChange`, `updateSkin`) without a rebuild.
- `boneColors` colours the skeleton greedily from the roots so parents,
  children, siblings, grandparents and bones whose pivots are close never share
  a colour; `focusColors` lights one bone.

## Measured (7 Nov 2026)

Bench: take a well-bound model, damage its binding in a realistic way, let
BindXL fix it, play the animations and compare every part with the authored
binding (a part counts as broken above 1% of model size). Sets: 384 native
units, about 1,300 community models including 816 mounted ones (riders,
chariots, dragons), and the owner's Vampire Dragon with its earlier versions.

- **Well-bound models stay**: default settings change 0% of good parts on
  expert and mounted models and 0.3% on natives (seam blends at joints and a few
  vehicle parts). On the Vampire Dragon and its earlier versions BindXL moves
  the result at most 0.001% (of model size) further from the owner's repaired
  version (the first BindXL moved its throne onto the rider).
- **Strays**: 93–96% fixed. **Torn seams**: 62–78% fixed.
- **Protect** trades safety for repairs (parts on a wrong nearby bone /
  new parts left on one bone, good parts harmed): 75% → 13% / 12%, 0.1%;
  50% → 46% / 36%, 0.4–0.6%; 25% → 62% / 48%, 2–3%; None binds everything
  again from the skeleton.
- **Stiff part ranking** (bone choice for a part, with its surroundings bound
  well): matches the authored motion for 82–89% of parts on held-out sets
  (natives 76%, mounted 89%); nearest bone alone manages 54–60%.
- **From the skeleton alone** (Protect None) bending parts are the weak spot:
  about half of them end up more than 1% from the authored motion. A binding
  cannot always be judged from shape alone; well-bound models often use bones
  that are not the nearest. That is why BindXL keeps bound parts by default,
  and why the colours, click-to-fix, Stiff/Bend and Good exist.

## Checks

- [Engine](../test/bind-xl.test.js): regions, pieces, a well-bound model stays,
  seams of one body, rider and mount stay apart, soft joints, strays, Protect,
  marks, stiff together, turned-off and in-use bones, Blizzard helper joints,
  HD weights, colours and one-bone focus.
- [Packaged workflow](../test/bind-xl.electron.cjs): dock opens the window,
  animation plays, a left drag turns the camera, clicking selects a part,
  Stiff, Good, a bone chip lights one bone, Protect and its scale, a slider,
  colours off, Flex, Commit, Undo. Run hidden with a model argument.
