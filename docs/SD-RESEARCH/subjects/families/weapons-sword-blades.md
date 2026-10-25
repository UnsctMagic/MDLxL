# Sword blades: thin solids, broad painted faces

The Footman blade (g1:c9) and Blademaster blade (g4:c2) each use nine triangles and seven distinct positions. This is a specific construction shared by these two examples, not a recommended budget for every sword. Their two triangular longitudinal rings and terminal tip create a very thin solid with an open proximal end. Footman's ten stored vertices represent seven positions because three positions carry split normals. Blademaster has eleven stored vertices for its seven positions. Extra stored vertices therefore do not necessarily buy extra silhouette.

Footman's real side triangles are slightly twisted. A plane through the middle encounters five corners even though the authored rings each have three points. Calling that a five-sided blade from slice statistics alone would misdescribe the construction. The triangle topology and ring positions were inspected directly; the dataset keeps both the automatic slice observations and this interpretation.

The Knight blade (g1:c18) uses ten triangles and a broader reinforced base. Its black central channel is bounded by bright silver paint. Skeleton's curved sword (g1:c6) uses fourteen triangles and nine distinct positions, with a closed surface. The bend changes the outline; the dark groove does not require another inset strip of geometry. These are different silhouette problems even when the material is similarly silver steel.

Death Knight's twenty-four-triangle sword (g1:c16) is a whole connected weapon body: blade, hilt colour, green gem and red grip are visible on it. Its white curling runes are paint. Comparing 24 against Footman's blade-only 9 would mix assembly boundaries. The useful comparison is that Death Knight spends additional geometry on a more complicated connected silhouette while retaining elaborate internal decoration in the sheet.

Footman's diamond guard (g1:c10) and Blademaster's guard (g4:c1) are separate two-triangle planar pieces. Both look more elaborate in the intact model because concentric or angular highlights are painted on them. These guards should not be described as solid metal bosses. Their oblique views reveal the lack of thickness.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| heroblademaster.mdx g4:c2 | Long sword blade | 9 | 11 / 7 | 1.211 × 0.201 × 0.041 | 0 |
| knight.mdx g1:c18 | Sword blade | 10 | 20 / 7 | 0.586 × 0.130 × 0.083 | 7 |
| footman.mdx g1:c9 | Straight sword blade | 9 | 10 / 7 | 0.800 × 0.139 × 0.045 | 3 |
| skeleton.mdx g1:c6 | Curved sword blade | 14 | 9 / 9 | 0.798 × 0.198 × 0.045 | 0 |
| herodeathknight.mdx g1:c16 | Runed sword | 24 | 14 / 14 | 1.236 × 0.269 × 0.077 | 0 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\orc\heroblademaster\heroblademaster.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C88B7CBDA1F975C9F06EE463EF0CDF70/index.html).
- `units\human\knight\knight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-7503B2C77940A164DEF7DC704AF9413C/index.html).
- `units\human\footman\footman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-3BD0831FAD186C0C08767F15A9663E4B/index.html).
- `units\undead\skeleton\skeleton.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA840F8D4830A2CD8B8364524C26469/index.html).
- `units\undead\herodeathknight\herodeathknight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
