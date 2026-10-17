# NormalsXL

In Vertices, click **NormalsXL** (below **Merge Geosets**). A small panel opens in the model view and the whole visible model immediately shows the recalculated normals. With vertices selected first, only those vertices get new normals. Nothing changes until **Apply**; **Cancel**, the × button or Escape leave the model exactly as it was.

- **Smoothing angle** (default 90°, the Model Studio default; 0–180°).
- **Show normals** (on): bright direction lines, yellow where the normal changes.
- **Apply**: the previewed normals, as one undo step.
- **Fix facing**: flips triangles that face the wrong way, as its own undo step. The panel stays open on the result.
- One result line, for example `1,240 normals changed` or `12 triangles flipped · 1,240 normals changed`.

NormalsXL never adds, removes, merges or moves vertices. Faces, UVs and skinning stay as they are, so an MDX keeps its exact byte size.

## How it works (`src/normals-rebuild.js`)

The method is Retera's Model Studio "Recalculate normals" (`GeosetVertex.createNormalFromFaces`), the usual Hive Workshop tool:

1. Vertices at the same position (tolerance 1e-4 of the model size, across all included geosets) form a group, but only when their skinning matches (same bone set; for HD the same bones and weights) and their geosets show and hide together (same GeosetAnim alpha). Swords never smooth into hands and swap parts stay separate.
2. For each vertex, *own* is the sum of the unit normals of its own triangles. Its new normal is the sum of the unit normals of every triangle touching its group whose angle to *own* is below the smoothing angle.
3. Duplicated vertices at the same spot therefore act as hard edges (each copy only picks up the faces on its side), while UV-seam duplicates smooth together.
4. Stored normals are never read: a patch of inverted, random or zero normals comes out exactly like a clean one. Collapsed triangles are ignored; a vertex used only by them takes the shading at its position. Unshaded geosets are skipped. With a selection, only selected vertices change, but every triangle at their positions counts.

**Fix facing** works per connected piece: triangles of one geoset joined by edges at the same positions. Triangles wound against the clear majority of their piece (by area; a whole patch of them, up to 40%) are flipped. A closed piece is turned the way its volume says is outward, so an inside-out closed piece is reversed. Open pieces without a clear majority, open pieces as a whole, back-to-back twin triangles and pieces that cannot be wound consistently are left alone. Flipping only swaps the corner order in Faces. The normals at positions touched by flipped triangles are then recalculated as above, and HD tangents follow.

## Evidence

54 classic SD models, Apply at each angle (dark corner = a vertex normal facing away from one of its triangles; seam = coincident same-skinning vertices on a smooth edge with normals over 10° apart):

| angle | dark corners | seams | authored hard edges smoothed |
|---|---|---|---|
| before | 9,919 | 1,461 | — |
| 60° | 12,094 | 1,523 | 227 / 2,587 |
| 75° | 8,297 | 1,166 | 464 |
| **90°** | **4,445** | **883** | 796 |
| 120° | 4,312 | 314 | 1,665 |
| 180° | 5,346 | 1 | 2,405 |

Every MDX keeps its byte length and a second run changes nothing. Fix facing then Apply at 90° flips 1,037 triangles in 46 models and gives 3,966 dark corners. 90° was chosen from offline renders of Greenskin_Orc1, KnightNurgleChampion, Empire_Swordsman and Ogre10: bodies and limbs are smooth like authored WC3 models, while cube-like 90° corners made of duplicated vertices stay hard. 75° leaves blocky legs and arms faceted; 120° and more also smooths away authored armour edges.
