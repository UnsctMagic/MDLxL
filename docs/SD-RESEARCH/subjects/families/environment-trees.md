# Tree trunks, bent leaf cards, and object-bound texture variants

AshenTree0, LordaeronTree0 and RuinsTree0 do not specify a normal named texture on their main material. The installed destructible skin table supplies it. ATtr binds replacement 32 to ReplaceableTextures/AshenvaleTree/AshenTree, LTlt binds 31 to ReplaceableTextures/LordaeronTree/LordaeronSummerTree, and ZTtw binds 36 to ReplaceableTextures/RuinsTree/RuinsTree. The study captures record those object bindings. A black tree produced by ignoring replacement slots is a renderer omission, not evidence of the original tree painting.

| Model and exact part | Triangles | Vertices / positions | Bind size X x Y x Z | UV bounds |
|---|---:|---:|---|---|
| [ashentree0 g1:c1](D:/Codex/sd-research/captures/models/native-sd-71CC81917666253A46B42B264CB84BA1/index.html) bent tapering tree trunk | 31 | 30 / 19 | 59.69 x 57.75 x 313.03 | 0.504, 0.0037, 0.7451, 0.4962 |
| [ashentree0 g1:c2](D:/Codex/sd-research/captures/models/native-sd-71CC81917666253A46B42B264CB84BA1/index.html) bent leaf canopy card | 4 | 5 / 5 | 254.67 x 285.12 x 86.35 | 0.0007, 0.0038, 0.491, 0.4953 |
| [ashentree0 g1:c3](D:/Codex/sd-research/captures/models/native-sd-71CC81917666253A46B42B264CB84BA1/index.html) bent leaf canopy card | 4 | 5 / 5 | 179.87 x 186.55 x 82.12 | 0.0007, 0.0038, 0.491, 0.4953 |
| [ashentree0 g1:c4](D:/Codex/sd-research/captures/models/native-sd-71CC81917666253A46B42B264CB84BA1/index.html) bent leaf canopy card | 4 | 5 / 5 | 182.73 x 208.27 x 91.66 | 0.0031, 0.499, 0.4934, 0.9905 |
| [lordaerontree0 g1:c1](D:/Codex/sd-research/captures/models/native-sd-6767BD5321F0F19441227A8DD0C9924E/index.html) tapering tree trunk | 12 | 16 / 12 | 64.93 x 74.98 x 220.18 | 0.504, 0.0037, 0.7451, 0.4962 |
| [lordaerontree0 g1:c2](D:/Codex/sd-research/captures/models/native-sd-6767BD5321F0F19441227A8DD0C9924E/index.html) bent leaf canopy card | 4 | 5 / 5 | 112.2 x 124.07 x 52.05 | 0.0007, 0.0038, 0.491, 0.4953 |
| [lordaerontree0 g1:c5](D:/Codex/sd-research/captures/models/native-sd-6767BD5321F0F19441227A8DD0C9924E/index.html) bent leaf canopy card | 4 | 5 / 5 | 63.85 x 80.93 x 53.72 | 0.5025, 0.514, 0.7378, 0.7493 |
| [ruinstree0 g1:c1](D:/Codex/sd-research/captures/models/native-sd-CD37C1A3717D90E182A7832446C0F80E/index.html) curved palm trunk | 24 | 30 / 16 | 46.95 x 47.33 x 247.75 | 0.5005, 0.0077, 0.7461, 0.4963 |
| [ruinstree0 g1:c2](D:/Codex/sd-research/captures/models/native-sd-CD37C1A3717D90E182A7832446C0F80E/index.html) radial palm frond canopy | 12 | 9 / 9 | 172.02 x 169.13 x 70.5 | 0.0048, 0.5038, 0.497, 0.996 |
| [lordaerontree0 g2:c2](D:/Codex/sd-research/captures/models/native-sd-6767BD5321F0F19441227A8DD0C9924E/index.html) cut tree stump | 16 | 22 / 12 | 41.5 x 46.29 x 19.95 | 0.5044, 0.0081, 0.9944, 0.4997 |

LordaeronTree0 has a 12 triangle trunk and four separate four-triangle bent canopy cards. Each canopy card has only five positions; dense leaves, branch gaps and irregular outer silhouettes come from alpha painting. Three larger cards repeat exactly the same UV bounds, while the smallest crown uses another patch. The six-sided trunk has no normal splits at shared positions, unlike the hard-faceted Icecrown crystal. Its bark fissures and light streaks are painted vertically.

AshenTree0 also uses four-triangle/five-position leaf cards, but only three of them. Two sample the upper-left foliage region and one the lower-left region. Its 31 triangle bent trunk uses six-sided sampled sections and a pointed upper silhouette. RuinsTree0 takes another construction: its 24 triangle curved palm trunk has three-sided sampled sections, while the entire palm-frond canopy is one 12 triangle/nine-position bent component. Individual leaflets and fine stems are painted cutouts; their visibility does not imply hundreds of thin frond meshes.

All three tree files also carry a 16 triangle stump and three three-triangle fallen-foliage cards, hidden during the sampled Stand. Their stump UV bounds match, including the endgrain region, even though the three bound sheets paint different bark treatments. A whole-file tree count would include this post-death geometry. The ordinary standing tree counts here are 43 triangles for AshenTree0, 28 for LordaeronTree0 and 36 for RuinsTree0.

The installed bindings make reuse more interesting than one model/one texture: CTtr uses the AshenTree prefix with FelwoodTree, ITtw uses it with Ice_Tree, and FTtw/WTtw/WTst use the LordaeronTree prefix with Fall/Winter/Snow sheets. Their texture assignments are explicit data, not filenames guessed by the study. world-editor-replaceables.json preserves 219 active SD bindings, including multiple objects sharing one model prefix.

![AshenTree0 with official ATtr texture assignment](D:/Codex/sd-research/captures/models/native-sd-71CC81917666253A46B42B264CB84BA1/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-71CC81917666253A46B42B264CB84BA1/index.html).

![RuinsTree0: one canopy component paints the individual palm leaflets](D:/Codex/sd-research/captures/models/native-sd-CD37C1A3717D90E182A7832446C0F80E/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-CD37C1A3717D90E182A7832446C0F80E/index.html).

A model-only atlas query must carry the object identity when the same replacement slot can have several valid sheets. The examples above concern variant 0 and do not assume all ten Lordaeron variants have the same trunk or canopy counts.
