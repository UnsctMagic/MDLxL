# Shields: front, reverse, boss and added ornaments

Footman's shield front (g2:c1) has nine triangles. The white border and dark outline are painted into that front. Its central steel boss is a separate eight-triangle low-relief component (g1:c14), with a broad light face and dark flank. A shield count based on the front alone would omit the boss; a count based on all arm-weighted vertices would include unrelated armour.

Skeleton also has a nine-triangle shield front, but its wooden reverse is a separate three-triangle part (g1:c16). Detached single-triangle spike faces sit at the shield edge. The common nine-triangle front count does not make these shield assemblies identical: paint, reverse material, boss and spike treatment differ. The dataset therefore retains an assembly relationship rather than flattening all shields into one triangle range.

Graveguard's LowPolyWorks shield is a more elaborate assembled object. Its frame has 204 triangles; the wooden back has 42; the front surface has 42. The back takes paint from the campaign Human Tree, and the front uses the Undead inventory-cover sheet. The front occupies only 6.49% of that sheet in the union of its actual UV triangles sampled at native pixel centres (8,507 of 131,072 pixels). The back covers 72.39% of the tree sheet (23,722 of 32,768 pixel centres). Those are measured used pixels, not rectangles judged visually safe.

A 146-triangle gargoyle-like head plus 6- and 8-triangle fragments decorates that shield, while a 17-triangle Destroyer-painted ornament contributes purple and gold. The owner's credits identify a Blizzard gargoyle head, but the exact native geometry source remains a separate matching question. Texture use from Gargoyle Spire is evidence about paint, not sufficient geometry provenance.

The native Footman and Skeleton examples spend few triangles on the readable front surface. Graveguard invests much more in the frame and attached relief while borrowing an interface sheet for the central face. This specific comparison explains why a native-looking kitbash can have many sheets and a much richer silhouette without painting a new shield atlas.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| footman.mdx g1:c14 | Shield central boss | 8 | 10 / 6 | 0.150 × 0.107 × 0.107 | 4 |
| footman.mdx g2:c1 | Shield front and white rim | 9 | 12 / 9 | 0.641 × 0.455 × 0.091 | 3 |
| skeleton.mdx g1:c16 | Wooden shield reverse | 3 | 9 / 5 | 0.582 × 0.387 × 0.018 | 0 |
| skeleton.mdx g2:c1 | Shield front | 9 | 8 / 8 | 0.611 × 0.388 × 0.105 | 0 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\human\footman\footman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-3BD0831FAD186C0C08767F15A9663E4B/index.html).
- `units\undead\skeleton\skeleton.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA840F8D4830A2CD8B8364524C26469/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
