# Shoulder armour and bracers: paint creates inset layers

The reviewed shoulder caps make a compact comparison with clear assembly boundaries: Grunt has two eight-triangle metal plates with pale fur edging; Footman has two nine-triangle team-colour caps; Mountain King has two eleven-triangle team-colour plates; Skeleton has two fifteen-triangle shoulder plates before its detached spike faces are counted. These are individual plates, not all shoulder-area geometry or the entire upper arm.

Footman's red cap has a broad white-grey border and a dark inset outline. Mountain King's red plate substitutes a gold border. Grunt's pale irregular fringe is painted on the same component as the dark metal. These three pieces obtain different material and faction readings without requiring a separate mesh for every visible border. Skeleton's gold-rimmed dark plates add detached single-triangle spike faces, so its spiky shoulder assembly must be considered beyond the 15-triangle cap.

Blademaster's bracers (g2:c6 and c26) each use five triangles. Two dark inset bands and multiple gold borders are painted into those few planes. The component views make the distinction plain: the apparent layered metal detail does not have matching geometric recesses. His lower legs combine skin, straps and feet in 25- and 26-triangle components, so they are not interchangeable with the isolated bracer count.

Magnataur's four red leg bands have nine triangles each and its two red wrist bands have eight. Their black borders and painted fur surround the saturated centre. The proportions table shows the much larger carrier context, but its part dimensions remain raw model measurements; World Editor scale is stored separately in category data.

The two pale round ten-triangle Mountain King caps are retained with medium confidence about their exact armour placement. Their shallow faceted form and painted bright centre are observable; assigning an exact body location from the small isolated sample would overstate the evidence. This is an explicit uncertainty, not an excuse to mix them into a broad shoulder budget.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| heroblademaster.mdx g2:c6 | Angular bracer plate | 5 | 6 / 6 | 0.338 × 0.280 × 0.048 | 0 |
| heromountainking.mdx g1:c6 | Pale round armour cap | 10 | 7 / 7 | 0.235 × 0.222 × 0.150 | 0 |
| heromountainking.mdx g2:c1 | Team-colour shoulder plate | 11 | 9 / 9 | 0.223 × 0.180 × 0.159 | 0 |
| magnataur.mdx g2:c1 | Team-colour leg band | 9 | 9 / 9 | 0.347 × 0.290 × 0.250 | 0 |
| magnataur.mdx g2:c5 | Team-colour wrist band | 8 | 8 / 8 | 0.388 × 0.291 × 0.278 | 0 |
| footman.mdx g2:c2 | Team-colour pauldron cap | 9 | 14 / 9 | 0.243 × 0.167 × 0.133 | 0 |
| footman.mdx g2:c3 | Team-colour greave panel | 4 | 6 / 6 | 0.392 × 0.177 × 0.080 | 0 |
| grunt.mdx g4:c1 | Metal pauldron with fur border | 8 | 6 / 6 | 0.819 × 0.084 × 0.058 | 0 |
| skeleton.mdx g1:c7 | Shoulder plate | 15 | 11 / 11 | 0.328 × 0.264 × 0.229 | 0 |
| herolich.mdx g1:c11 | Upper chest medallion plate | 13 | 25 / 10 | 0.195 × 0.223 × 0.224 | 5 |
| herodeathknight.mdx g1:c11 | Skull-faced armour plate | 5 | 9 / 6 | 0.373 × 0.299 × 0.182 | 0 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\orc\heroblademaster\heroblademaster.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C88B7CBDA1F975C9F06EE463EF0CDF70/index.html).
- `units\human\heromountainking\heromountainking.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C2B7CC84AB5D0B4DA75D24AE427F57F8/index.html).
- `units\creeps\magnataur\magnataur.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-8BBB89493A5E87B21E7B7F18D8B211F2/index.html).
- `units\human\footman\footman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-3BD0831FAD186C0C08767F15A9663E4B/index.html).
- `units\orc\grunt\grunt.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-1D5D5C34938F91BFC1989A223ABC8096/index.html).
- `units\undead\skeleton\skeleton.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA840F8D4830A2CD8B8364524C26469/index.html).
- `units\undead\herolich\herolich.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-41387D67933F1CFCF35C0DD9AFB1A3E1/index.html).
- `units\undead\herodeathknight\herodeathknight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
