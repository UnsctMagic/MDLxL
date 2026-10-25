# A creature and a machine spend their triangles differently

These two complete component reviews extend the owner-model study with Gluma’s Spear Skink and Dwarf Cannon. All 40 Skink components and all 36 Cannon components are identified from fitted views; uncertain mechanism names and one nearly invisible animation card remain explicitly qualified. Both use their supplied custom paint. Counts below refer to the model’s recorded Stand sample, not the maximum across every animation.

## Spear Skink: eye and mouth motion have a real geometry cost

Spear Skink contains 746 stored triangles, of which 600 are visible at the recorded Stand sample. Its connected head/neck is 132 triangles and its connected torso/legs/tail 124. Each arm and hand is 47. Two separate eyeballs cost 48 each: together 96, more than the entire 41-triangle spear assembly. The eye geometry is visibly rounded; the tiny teeth mostly use strips or cards instead. The asymmetry of the two foot components (8 and 9 triangles) is measured, not rounded into an assumed mirrored count.

| Spear Skink part | Triangles | What the inspected piece actually includes |
|---|---:|---|
| Head and neck, g1:c1 |132| One connected surface with painted blue scale cells and broad light snout. |
| Body/legs/tail, g2:c1 |124| Connected lower body and long tail; not separate torso and tail budgets. |
| Arms, g2:c2/c3 |47 each| Arm, hand and gold wrist band occupy the same connected piece. |
| Eyes, g2:c4/c5 |48 each| Separate rounded yellow eyes. |
| Tooth strips, g1:c3/c6/c7/c8 |8/2/2/4| Fine tooth silhouettes supplied partly by painted alpha edges. |
| Front fangs, g1:c9/c10 |5 each| Separate small projections. |
| Spear, g4:c1 |41| Shaft, wrapped grip and head remain connected. |
| Tongue, g5:c1 |58| Hidden in this Stand sample; long unfolding tongue geometry remains in the file. |
| Eyelids, g8:c1/c2 |24 each| Hidden in this Stand sample; blue surfaces cover the corresponding eyes. |

![left eyeball](D:/Codex/sd-research/captures/models/lpw-gluma-134398/part-0014.webp)

![elongating tongue assembly](D:/Codex/sd-research/captures/models/lpw-gluma-134398/part-0036.webp)

The spear has 72 vertex records but only 21 distinct positions. That difference matters: a raw vertex count is not a count of unique geometric corners. Its three principal-axis slices at 25%, 50%, 75% each have four simplified corners in one closed loop, consistent with the visibly faceted long weapon. The 41 triangles still include the head and grip, so this number cannot be reused as a naked shaft budget.

The Skink’s scales, small finger divisions and wrist decoration are paint on these broad surfaces. The contrasting red crest is separate geometry: 32 triangles on the head plus three 8-triangle back spines. That allows the silhouette to retain recognisable fins even though their internal colour bands are painted. Source-sheet evidence is `skink.blp`; exact per-component UV footprints and alpha distributions are in the pixel-measurement dataset.

## Dwarf Cannon: tiny flat mechanisms beside heavy closed solids

Dwarf Cannon contains 582 stored triangles and 522 visible at its Stand sample. The main barrel is 80 triangles, the four wheels 44 each, and the two long carriage side frames 36 each. The largest hard shapes are therefore not merely one arbitrary box budget. The barrel’s measured central slices at 25% and 50% have six simplified corners; the later slice reaches 10 where its end profile changes. The exact cross-section records retain those differences rather than reporting one unexplained side count for the entire barrel.

| Dwarf Cannon part | Triangles | Painted versus geometric distinction |
|---|---:|---|
| Main barrel, g5:c14 |80| Closed solid with faceted profile; bright gold bands and small lion ornament painted. |
| Four wheels, g5:c20–c23 |44 each| Closed wheel volumes; gear/rivet detail on their faces is paint. |
| Left/right carriage frames, g5:c6/c10 |36 each| The long outlined side silhouette is geometry; runes and gold emblems painted. |
| Front/rear axles, g5:c8/c9 |20 each| Crossing structural bars with gold wrap texture. |
| Large/small gear cards, g5:c13/c19 |2 each| Flat gear silhouettes depend on source alpha; no 3D tooth ring in these components. |
| Ring/adjustment cards, g5:c1–c4 |2 each| Thin surfaces with painted holes. |
| Four heraldic plaques, g6:c1–c4 |2 each| Red team-colour-capable panels with painted gold borders and motifs. |
| Shell and casing, g2:c1/g3:c1 |28/18| Stored ammunition shapes hidden at this Stand sample. |

![complete cannon barrel](D:/Codex/sd-research/captures/models/lpw-gluma-145021/part-0018.webp)

![large side gear card](D:/Codex/sd-research/captures/models/lpw-gluma-145021/part-0017.webp)

These two models make a useful bounded comparison: the Skink spends geometry on independently animated eyes, eyelids and tongue, while the Cannon often renders small rings and gears as two-triangle cards around denser rigid solids. This is an observation about these actual models, not a universal rule that creatures require more triangles or machines should always use cards. The file-level animation/effect surfaces are retained in both records so hidden auxiliary geometry is not silently mixed into the visible body budget.
