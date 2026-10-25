# Capes and robes: separate drape, lining and emblem

Archer's 33-triangle cloak is one articulated cloth component with a broad team-colour field and dark painted fold shading. Rifleman's visible clothing is divided more explicitly: a 59-triangle hood, 43-triangle shoulder cloak and 13-triangle trailing cape. The trailing cape has a separate eleven-triangle brown lining; the upper lining is another five triangles. Treating the red and brown surfaces as one arbitrary cloth budget would hide this front/back construction.

The Rifleman hood's pointed trailing shape and the cape's bends are geometric. Gold hems, patterned grey-white trim and dark fold bands are painted. The lining is comparatively flat brown. This contrast makes the outside and inside distinguishable without a simulated cloth material. The 13-triangle outside and 11-triangle inside are not identical topology, so a blanket assumption that lining doubles the front count is wrong for this model.

Lich builds his lower silhouette from many narrow flared strips. Eight reviewed short outer strips have five triangles each; three longer strips have ten each. Separate four-triangle dark lining strips sit behind portions of the robe. Repeated four-triangle red gem-like badges attach to the cloth. Their bright square rims and star-shaped highlights are painted, while the independent strip bends make the floating, torn outline.

Necromancer's main skirt has 22 triangles and two wide sleeves have ten each. Two three-triangle side hems complete separate lower surfaces. The broad red fields, gold hem and painted shadows remain legible while the mesh supplies only major drape changes. Death Knight's twelve-triangle cape and Blademaster's twelve-triangle back banner similarly carry complex gold emblems without mesh tracing every emblem line.

These are observed alternatives: Archer's single cloak, Rifleman's hood-plus-cape-and-lining, Lich's many separate strips, and Necromancer's skirt and sleeves. They should remain separate families or subfamilies. Calling all of them a cape and averaging the counts would lose the construction choices that the examples actually teach.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| heroblademaster.mdx g3:c1 | Waist cloth | 29 | 30 / 21 | 0.507 × 0.600 × 0.377 | 0 |
| heroblademaster.mdx g3:c2 | Back banner | 12 | 12 / 8 | 0.497 × 0.582 × 0.006 | 1 |
| rifleman.mdx g1:c9 | Upper cloak lining | 5 | 7 / 7 | 0.518 × 0.236 × 0.077 | 0 |
| rifleman.mdx g1:c10 | Lower cloak lining | 11 | 21 / 11 | 0.639 × 0.537 × 0.129 | 0 |
| rifleman.mdx g2:c1 | Hood | 59 | 99 / 26 | 0.425 × 0.214 × 0.190 | 17 |
| rifleman.mdx g2:c2 | Shoulder cloak | 43 | 45 / 29 | 0.522 × 0.384 × 0.235 | 0 |
| rifleman.mdx g2:c3 | Trailing cape | 13 | 25 / 13 | 0.639 × 0.642 × 0.125 | 0 |
| tauren.mdx g2:c1 | Waist covering and straps | 21 | 26 / 18 | 0.358 × 0.328 × 0.224 | 0 |
| knight.mdx g2:c1 | Lance pennant | 10 | 22 / 7 | 0.306 × 0.160 × 0.020 | 7 |
| archer.mdx g2:c1 | Team-colour cloak | 33 | 67 / 20 | 0.847 × 0.454 × 0.202 | 7 |
| archer.mdx g2:c2 | Small team-colour cloth panel | 4 | 6 / 6 | 0.128 × 0.110 × 0.066 | 0 |
| undeadairbarge.mdx g1:c1 | Torn skull banner | 10 | 16 / 10 | 1.362 × 1.257 × 0.113 | 0 |
| herolich.mdx g1:c6 | Waist armour and hanging dark strips | 32 | 50 / 32 | 0.853 × 0.370 × 0.272 | 0 |
| herolich.mdx g1:c7 | Dark cloth lining strip | 4 | 8 / 6 | 0.576 × 0.134 × 0.016 | 0 |
| herolich.mdx g2:c1 | Outer flared robe strip | 5 | 12 / 7 | 0.927 × 0.430 × 0.147 | 0 |
| herolich.mdx g2:c6 | Upper team-colour mantle | 7 | 10 / 9 | 0.505 × 0.466 × 0.167 | 0 |
| herolich.mdx g3:c1 | Long flared robe strip | 10 | 12 / 12 | 1.400 × 0.281 × 0.000 | 0 |
| necromancer.mdx g1:c1 | Main robe skirt | 22 | 46 / 18 | 0.782 × 0.565 × 0.691 | 3 |
| necromancer.mdx g1:c2 | Wide robe sleeve | 10 | 13 / 9 | 0.339 × 0.164 × 0.099 | 0 |
| necromancer.mdx g2:c18 | Robe side hem | 3 | 7 / 5 | 0.519 × 0.301 × 0.124 | 0 |
| herodeathknight.mdx g2:c3 | Embroidered red cape | 12 | 24 / 12 | 0.947 × 0.557 × 0.139 | 0 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\orc\heroblademaster\heroblademaster.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C88B7CBDA1F975C9F06EE463EF0CDF70/index.html).
- `units\human\rifleman\rifleman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA28A7F3EB64E659C17311F550A3877/index.html).
- `units\orc\tauren\tauren.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-DA2AF4DD7727DA5466F7CAA4B7FD955D/index.html).
- `units\human\knight\knight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-7503B2C77940A164DEF7DC704AF9413C/index.html).
- `units\nightelf\archer\archer.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-3DAA369BA7A21461738BAED6D653E540/index.html).
- `units\undead\undeadairbarge\undeadairbarge.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-CD3482BE89D17744E78A33722D06749D/index.html).
- `units\undead\herolich\herolich.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-41387D67933F1CFCF35C0DD9AFB1A3E1/index.html).
- `units\undead\necromancer\necromancer.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C3D72C140A1B9BDE76CEC1412AB42C4E/index.html).
- `units\undead\herodeathknight\herodeathknight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
