# Roofs, chimney pots, and the Farm atlas

The Human Farm and Elven Farm spend different geometry on related painted areas. Human Farm's main house is one 54 triangle connected component containing walls and roof; Elven Farm's comparable component has 62 triangles. Counting either entire component as a roof would mix the house walls into the roof family. The isolated components and surface patches provide the separation needed for inspection.

| Model and exact part | Triangles | Vertices / positions | Bind size X x Y x Z | UV bounds |
|---|---:|---:|---|---|
| [farm g2:c2](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/index.html) dormer thatch roof | 10 | 16 / 10 | 53.51 x 52.03 x 18.07 | 0.502, 0.502, 0.7843, 0.6902 |
| [farm g2:c3](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/index.html) main house shell with roof and walls | 54 | 93 / 36 | 149.96 x 146.92 x 121.31 | 0, 0.0039, 0.9961, 0.7647 |
| [farm g2:c9](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/index.html) five-sided chimney pot | 13 | 34 / 10 | 8.99 x 8.55 x 12.1 | 0.1211, 0.6914, 0.25, 0.7656 |
| [farm g2:c10](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/index.html) five-sided chimney pot | 13 | 34 / 10 | 9.44 x 8.96 x 13.8 | 0.1211, 0.6914, 0.25, 0.7656 |
| [elvenfarm g1:c2](D:/Codex/sd-research/captures/models/native-sd-5DDCB26506F37C06BAED1437C9D0FA77/index.html) main elven house shell | 62 | 109 / 39 | 220.44 x 218.39 x 251.23 | 0, 0.003, 0.9961, 1 |
| [elvenfarm g1:c7](D:/Codex/sd-research/captures/models/native-sd-5DDCB26506F37C06BAED1437C9D0FA77/index.html) dormer thatch roof | 8 | 14 / 9 | 76.53 x 67.6 x 45.05 | 0.502, 0.502, 0.7843, 0.6863 |
| [elvenfarm g1:c8](D:/Codex/sd-research/captures/models/native-sd-5DDCB26506F37C06BAED1437C9D0FA77/index.html) dormer thatch roof | 8 | 14 / 9 | 65.32 x 76.97 x 42.44 | 0.502, 0.502, 0.7843, 0.6863 |
| [humanbarracks g1:c3](D:/Codex/sd-research/captures/models/native-sd-179CDF9433D7D934FDCD203296897A43/index.html) main tiled roof | 4 | 8 / 6 | 191.5 x 164.73 x 23.63 | 0.7495, 0.002, 0.998, 0.2466 |
| [humanbarracks g1:c6](D:/Codex/sd-research/captures/models/native-sd-179CDF9433D7D934FDCD203296897A43/index.html) pyramidal tower roof | 4 | 10 / 5 | 88.14 x 83.62 x 28.51 | 0.5616, 0, 0.7456, 0.1429 |
| [watchtower g2:c2](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/index.html) hexagonal shingled roof | 6 | 7 / 7 | 103.67 x 99.38 x 48.46 | 0.0008, -0.0024, 0.2474, 0.2466 |
| [orcbarracks g2:c1](D:/Codex/sd-research/captures/models/native-sd-A448F47297A0020F61C299AAAC97D80A/index.html) radial upper roof | 24 | 33 / 17 | 98.77 x 98.77 x 50.17 | 0, 0.4989, 0.8891, 0.8237 |
| [orcbarracks g2:c2](D:/Codex/sd-research/captures/models/native-sd-A448F47297A0020F61C299AAAC97D80A/index.html) annular lower roof | 32 | 40 / 24 | 187.99 x 187.99 x 50.23 | 0.0037, 0.6511, 0.9959, 0.9951 |

In Human Farm, each chimney pot has 13 triangles,34 serialized vertices and ten distinct positions. Five sampled sides stay five at 25%,50% and 75% of the principal length. Its sides account for ten triangles; the top is a flat three-triangle cap. The black round mouth is paint on that cap, not an open hole with an interior wall. Both pots reuse UV bounds(0.121094,0.691406) to(0.25,0.765625) of Buildings/Human/Farm/House.blp, though their heights differ: 12.095 and 13.796 model units. This is a precise example of a convincing dark cavity made without cavity geometry.

Human Farm's detached dormer roof has ten triangles. Elven Farm's two dormer roofs use eight each, with a curved ridge outline and painted fine straw. The corresponding roof regions lie at about u0.502–0.784,v0.502–0.69 on the respective House and ElvenFarm sheets. Elven Farm's two 25 triangle ornamental supports sample the same part of ElvenFarm's atlas that Human Farm's brick chimney mainly occupies on House. Their gold looping pattern replaces brick while the UV layout remains closely related. This is a same-layout artistic substitution, not evidence that the complete models share geometry.

Human Barracks makes its long main tiled roof from four triangles and each of its four pyramidal tower caps from four. Orc WatchTower's six-triangle roof is a six-sided pyramid with seven positions. On both roofs, the dozens of painted red tiles, edge glints and overlapping shingle rows greatly outnumber the actual faces. Orc Barracks instead models a radial 24 triangle upper roof and a 32 triangle lower ring with an open centre. Its dark wooden spokes and team-colour perimeter marks follow the radial sheet region; the connected roof geometry carries broad bends, while much thinner spoke detail remains paint.

![Human Farm: broad painted surfaces and two tiny chimney pots](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/index.html).

![Orc WatchTower: six roof faces carry a densely painted shingle field](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/index.html).

Coordinates above are bounds of measured UV triangles, not empty-space guarantees or recommended rectangles. The exact polygons are retained in native-environment.json and the UV overlay. Sizes are raw bind-space dimensions, without official game object scale. These examples are native Blizzard SD; no LowPolyWorks building counterpart was asserted.
