# Crates, barrels, coins, and crystal facets

Crates0 uses two bottomless boxes with ten triangles each. Both have eight distinct positions and 20 serialized vertices, with four boundary edges around the omitted underside. The top's diagonal timber brace, the side planks, dark inset corners and edge highlights are entirely painted. The two crates differ in shape: one is 20.775 units tall and the other 37.95, but they reuse nearly identical regions of Doodads0-0.blp.

| Model and exact part | Triangles | Vertices / positions | Bind size X x Y x Z | UV bounds |
|---|---:|---:|---|---|
| [crates0 g1:c1](D:/Codex/sd-research/captures/models/native-sd-6C3552A19B011054F10D2AB7B7A46C9E/index.html) bottomless wooden crate | 10 | 20 / 8 | 41.41 x 41.41 x 20.77 | 0.3769, 0.0017, 0.8129, 0.2457 |
| [crates0 g1:c2](D:/Codex/sd-research/captures/models/native-sd-6C3552A19B011054F10D2AB7B7A46C9E/index.html) bottomless wooden crate | 10 | 20 / 8 | 45.26 x 45.26 x 37.95 | 0.3755, 0.0014, 0.8124, 0.2456 |
| [floatingbarrel g1:c1](D:/Codex/sd-research/captures/models/native-sd-9E577BDD3358A66800FE2C58293451F1/index.html) bulged floating barrel | 60 | 61 / 32 | 73.19 x 74.52 x 67.81 | 0.5048, 0.039, 0.7944, 0.4909 |
| [treasurechest g1:c1](D:/Codex/sd-research/captures/models/native-sd-F7B272E3B73597ED2AFADE311803466A/index.html) treasure chest bowl and coins surface | 20 | 28 / 13 | 52.67 x 53.59 x 32.04 | 0.0048, 0.2357, 0.987, 0.9725 |
| [treasurechest g1:c2](D:/Codex/sd-research/captures/models/native-sd-F7B272E3B73597ED2AFADE311803466A/index.html) treasure chest raised lid | 18 | 28 / 11 | 39.25 x 39.96 x 38.11 | 0.4989, 0.2371, 0.9857, 0.9396 |
| [treasurechest g1:c3](D:/Codex/sd-research/captures/models/native-sd-F7B272E3B73597ED2AFADE311803466A/index.html) treasure chest lock block | 10 | 20 / 8 | 13.92 x 14.45 x 15.49 | 0.5963, 0.0013, 0.9977, 0.2113 |
| [icecrown_crystal0 g1:c1](D:/Codex/sd-research/captures/models/native-sd-97841DEF1E9FFC158CD1D9F239128753/index.html) ice crystal cluster | 48 | 144 / 31 | 256.24 x 249.41 x 393.73 | 0.0005, 0.0005, 0.9995, 0.9995 |

FloatingBarrel's single 60 triangle closed component has 32 positions: three rings of ten perimeter positions and two cap centres. Each end cap has ten triangles;40 triangles connect the rings. The body bulge is geometric. The alternating wooden staves, grooves, and metal hoops are painted on the same surface; neither hoops nor planks are separate parts. Its UVs repeatedly crop the barrel side region of Doodads0 rather than mapping each side to a unique sheet area.

TreasureChest's main bowl and gold surface are 20 triangles, its raised lid 18, and its lock block 10. The apparently numerous gold coins are a continuous four-triangle patch. The silver rim and wood panels change colour without creating one component per material; the main bowl remains connected. The chest's four two-triangle star cards belong to a separate sparkling presentation layer, with only two visible in the sample, so they are distinct from the modeled chest body.

Icecrown_Crystal0 has 48 triangles, 144 serialized vertices and 31 distinct positions. Every triangle therefore has its own vertices, and all 31 shared positions have split normals. That makes a different construction from the smooth tree trunks and barrel: geometry deliberately supports faceted shading. Its cyan-white diagonal streaks and dark teal lower areas remain on crystal.blp. The mesh is a joined cluster, so its principal cross-section corner counts 24/25/14 are measurements through the cluster, not a claim that every individual crystal is a24-sided prism.

![FloatingBarrel: a bulged closed mesh with painted hoops](D:/Codex/sd-research/captures/models/native-sd-9E577BDD3358A66800FE2C58293451F1/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-9E577BDD3358A66800FE2C58293451F1/index.html).

![TreasureChest: one painted gold surface stands in for many coins](D:/Codex/sd-research/captures/models/native-sd-F7B272E3B73597ED2AFADE311803466A/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-F7B272E3B73597ED2AFADE311803466A/index.html).

![Icecrown crystal: split normals and painted cyan streaks](D:/Codex/sd-research/captures/models/native-sd-97841DEF1E9FFC158CD1D9F239128753/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-97841DEF1E9FFC158CD1D9F239128753/index.html).

These are source-specific examples of material meaning and mesh topology disagreeing: visible silver/wood/gold need not mean three separate meshes, while the crate can split vertices for normals and UV seams without increasing the eight geometric corners.
