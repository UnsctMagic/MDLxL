# Bows, firearms, books and staves: assemblies with different jobs

Archer's recurved bow has 24 triangles. Its angular direction changes and taper carry the weapon's silhouette, while the pale wood and silver binding paint provide material detail. The bowstring uses two four-triangle components in crossing planes. Its visibility from more than one direction comes from this crossed arrangement; it is not a thin cylindrical string.

Archer's twelve-triangle quiver shell carries strong cyan and dark-blue chevrons. The chevrons decorate the shell in paint. The bow, string and quiver remain separate parts with separate placement, rather than being merged into an undifferentiated ranged-weapon count.

Rifleman's 32-triangle connected rifle body includes stock and barrel form. A six-triangle lower fitting, four-triangle narrow strip, two-triangle lock plate and four-triangle lock/trigger silhouette remain separate. The small mechanism's holes and individual-looking pieces are largely alpha paint on the card. Some exact mechanism names are retained as uncertain where the isolated rendering proves a fitting but not its precise function. The ejected shell body is another eight-triangle component associated with the rifle animation, not part of the standing weapon surface budget.

Necromancer's seventy-triangle staff has a connected shaft and angular branched head. Its yellow wrapping and wood/metal colour changes are painted. His two twelve-triangle waist dagger-and-hilt components use gold, green gem paint and dark grip bands. His twenty-triangle book models a thick page block, while the white skull on the black cover and the page-edge stripes are painted.

These examples explain why the category must retain the carrier and sequence. Rifleman's shell belongs to an animation event; Archer's quiver belongs on the back; Necromancer's book belongs in the hand. Matching a texture colour or elongated shape alone would not supply that assembly knowledge.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| headhunter.mdx g3:c3 | quiver | 12 | 8 / 8 | 0.606 × 0.158 × 0.119 | 0 |
| witchdoctor.mdx g1:c3 | crooked wooden staff | 22 | 13 / 13 | 1.677 × 0.340 × 0.082 | 0 |
| rifleman.mdx g1:c2 | Rifle stock and barrel body | 32 | 22 / 18 | 1.110 × 0.211 × 0.212 | 4 |
| rifleman.mdx g1:c8 | Rifle lower fitting | 6 | 6 / 5 | 0.187 × 0.132 × 0.074 | 0 |
| rifleman.mdx g1:c14 | Long rifle detail strip | 4 | 4 / 4 | 0.489 × 0.071 × 0.000 | 0 |
| rifleman.mdx g1:c15 | Rifle lock plate card | 2 | 3 / 3 | 0.160 × 0.103 × 0.000 | 0 |
| rifleman.mdx g1:c16 | Rifle lock and trigger silhouette card | 4 | 4 / 4 | 0.159 × 0.144 × 0.000 | 0 |
| rifleman.mdx g3:c1 | Ejected shell body | 8 | 8 / 8 | 0.141 × 0.060 × 0.060 | 0 |
| archer.mdx g1:c2 | Recurved bow | 24 | 14 / 14 | 1.016 × 0.267 × 0.080 | 0 |
| archer.mdx g1:c3 | Quiver shell | 12 | 12 / 8 | 0.400 × 0.201 × 0.107 | 0 |
| archer.mdx g1:c6 | Crossed bowstring card | 4 | 4 / 4 | 1.011 × 0.082 × 0.000 | 0 |
| necromancer.mdx g2:c4 | Waist dagger and decorated hilt | 12 | 9 / 9 | 0.254 × 0.054 × 0.038 | 0 |
| necromancer.mdx g2:c5 | Branched staff | 70 | 65 / 44 | 1.347 × 0.433 × 0.197 | 0 |
| necromancer.mdx g2:c16 | Book | 20 | 32 / 12 | 0.372 × 0.288 × 0.075 | 12 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\orc\headhunter\headhunter.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/index.html).
- `units\orc\witchdoctor\witchdoctor.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-B6342BB397AD19DA9CEE5681CE2670F0/index.html).
- `units\human\rifleman\rifleman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA28A7F3EB64E659C17311F550A3877/index.html).
- `units\nightelf\archer\archer.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-3DAA369BA7A21461738BAED6D653E540/index.html).
- `units\undead\necromancer\necromancer.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C3D72C140A1B9BDE76CEC1412AB42C4E/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
