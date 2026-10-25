# Chains, rings and gems: apparent complexity on thin surfaces

Lich's hanging chains use four connected ribbons: the upper pair have four triangles each, the lower pair six each. The visible links, gaps and interlocking pattern are painted on those bent strips. There are no individually modelled torus links in these components. Their geometry provides the changing direction of the chain, while the sheet supplies the repetition and metallic highlights.

Blademaster's gold hoop earring and Tauren's U-shaped nose ring each occupy a two-triangle planar surface. The transparent centre and curved outer edge are texture alpha. Their side views become extremely thin. These pieces solve a silhouette-and-paint problem, not a solid jewellery problem, and their planar status is recorded alongside the semantic label.

Mountain King's hammer medallion is another two-triangle overlay. An oval gold rim and a dark steel centre appear on a planar card attached to the hammer face. The hammer underneath is a twelve-triangle box. Separating these pieces explains how a simple solid can carry a curved-looking ornamental insert without adding an oval bevel loop.

Lich's purple arm ornaments have four triangles each. Their rounded purple highlights are painted into gold-bordered plates. His eight red robe badges also have four triangles each, but their square silver rims and star-shaped internal light pattern produce a different material reading. Neither example justifies calling every bright painted patch a modelled gemstone.

LowPolyWorks' Knight of Nurgle uses separate crossed chain cards for the reins. This preserves the useful native ribbon approach while changing the carrier and material. Its reviewed label records distinguish outer and crossing cards on both sides. A future assembly system would need those relationships: one selected card is only one surface of the chain representation.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| shaman.mdx g1:c9 | chain collar card | 4 | 8 / 6 | 0.317 × 0.184 × 0.061 | 0 |
| heroblademaster.mdx g2:c21 | Gold hoop earring card | 2 | 4 / 4 | 0.062 × 0.047 × 0.000 | 0 |
| heromountainking.mdx g1:c13 | Hammer face medallion card | 2 | 4 / 4 | 0.173 × 0.143 × 0.000 | 0 |
| tauren.mdx g1:c8 | Nose ring card | 2 | 4 / 4 | 0.112 × 0.089 × 0.000 | 0 |
| undeadairbarge.mdx g1:c7 | Hanging chain strip | 4 | 6 / 6 | 0.403 × 0.134 × 0.000 | 0 |
| herolich.mdx g1:c12 | Upper hanging chain strip | 4 | 8 / 6 | 0.390 × 0.038 × 0.000 | 0 |
| herolich.mdx g1:c13 | Lower hanging chain strip | 6 | 8 / 8 | 0.636 × 0.041 × 0.000 | 0 |
| herolich.mdx g1:c16 | Purple arm ornament | 4 | 5 / 5 | 0.160 × 0.156 × 0.039 | 0 |
| herolich.mdx g2:c7 | Red gem-like robe badge | 4 | 5 / 5 | 0.144 × 0.144 × 0.091 | 0 |
| herodeathknight.mdx g1:c24 | Green gem fitting | 2 | 4 / 4 | 0.446 × 0.107 × 0.000 | 0 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\orc\shaman\shaman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-4939AC42330023985C6BB59E83A21CE1/index.html).
- `units\orc\heroblademaster\heroblademaster.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C88B7CBDA1F975C9F06EE463EF0CDF70/index.html).
- `units\human\heromountainking\heromountainking.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C2B7CC84AB5D0B4DA75D24AE427F57F8/index.html).
- `units\orc\tauren\tauren.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-DA2AF4DD7727DA5466F7CAA4B7FD955D/index.html).
- `units\undead\undeadairbarge\undeadairbarge.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-CD3482BE89D17744E78A33722D06749D/index.html).
- `units\undead\herolich\herolich.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-41387D67933F1CFCF35C0DD9AFB1A3E1/index.html).
- `units\undead\herodeathknight\herodeathknight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
