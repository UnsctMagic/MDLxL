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
2. For each vertex, *own* is the sum of the unit normals of its own triangles. Its new normal is *own* plus the unit normals of the other triangles touching its group whose angle to *own* is below the smoothing angle. A vertex always keeps all of its own triangles: it has only one normal, and the SD models' normals are this plain sum (see Evidence).
3. Duplicated vertices at the same spot therefore act as hard edges (each copy only picks up the faces on its side), while UV-seam duplicates smooth together. The smoothing angle only decides which copies join.
4. Stored normals are never read: a patch of inverted, random or zero normals comes out exactly like a clean one. Collapsed triangles are ignored; a vertex used only by them takes the shading at its position. Unshaded geosets are skipped. With a selection, only selected vertices change, but every triangle at their positions counts.

**Fix facing** works per connected piece: triangles of one geoset joined by edges at the same positions. Triangles wound against the clear majority of their piece (by area; a whole patch of them, up to 40%) are flipped. A closed piece is turned the way its volume says is outward, so an inside-out closed piece is reversed. An open **band** (a cuff, bracer, belt, knee band or sleeve around a limb: exactly two boundary loops that both go once around the line through their centres) is turned to face away from that line, even when it is wholly inside out or half and half; the side whose triangles point outward must win clearly (more than half of the area-weighted vote), otherwise the band is left alone. Other open pieces without a clear majority, other open pieces as a whole (flaps, capes, ground decals), back-to-back twin triangles and pieces that cannot be wound consistently are left alone.

Two-sided materials do not hide wrong facing in the game: Warcraft III lights the back of a two-sided triangle with the same normal as its front (mdx-m3-viewer and Model Studio do the same). MDLxL's preview flips the normal for the back side, so an inside-out two-sided part can look right in MDLxL and wrong in the game; Show normals reveals it. Flipping only swaps the corner order in Faces. The normals at positions touched by flipped triangles are then recalculated as above, and HD tangents follow.

## Evidence

### Bands and own triangles (2026-10)

Measured on the SD unit models of the installed game (CASC `war3.w3mod:units\…`, portraits and HD skins excluded; 401–416 models). Found because a 3-sided two-sided glove cuff added to a unit stayed inside out whatever NormalsXL did: Fix facing skipped it as an open piece, and at 90° its corners came out half smooth, half hard.

- Every SD piece's stored normals lie on the front side of its winding. All 307 single-row rings found by an independent detector face away from their axis (168 are 3-sided; about 95% of those are smooth).
- The band rule in Fix facing finds 716 bands and tubes: 688 already face outward and are left alone, 26 are unclear and left alone, none faces inward as a whole. The only change against the previous Fix facing is the 3-sided bow band of Burning Archer and Skeleton Archer (authored mixed, 4 triangles in and 2 out), which is now turned all outward instead of all inward: 1,146 → 1,150 triangles flipped in 401 models.
- On smooth 3-sided rings the authored normals equal the plain sum of the unit normals of the vertex's triangles (median 0.01°); corner-angle weighting (23.7°) and area weighting (13.2°) match worse. 112 of 160 such rings have a corner leaning more than 90° from one of its faces, so that lean is native.
- Apply at 90° compared with the authored normals of all 236,630 used vertices: previously median 2.6°, 66.4% within 10°, 16,416 dark corners; keeping all own triangles gives median 2.1°, 68.5% within 10°, 15,238 dark corners (authored: 16,824).
- Coincident same-skinning vertices in different geosets share their authored normal in 94.7% of smooth continuations and 85.2% of 30–90° folds, so positions keep combining across geosets.

### Smoothing angle (measured before vertices always kept their own triangles)

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
