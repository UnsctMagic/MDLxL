# Orcs and Goblins: mass and armour separate the represented roles

Scope: 6 downloaded catalogue models. Visual evidence: `D:/Codex/sd-research/pictures/lowpolyworks/orcs-and-goblins-*.jpg`; all four study-rendered angles and UV overlays are in `captures/models/<id>/`. These observations describe the examples, not mandatory style rules.

Snotling and Greenskin Savage Orc expose green torsos, outsized forearms, wide mouths with triangular teeth and short legs. The Savage Orc carries a pale spiked club; Snotling carries no weapon in the published pose. Their total meshes are 544 and 596 triangles.

Sources: Snotling (`lpw-herrdave-103868`), Greenskin - Savage Orc (`lpw-herrdave-87374`).

Greenskin Orc Boy uses a broad wooden shield and cleaver, with bright green accent shapes on the shield and upper body. Black Orc shifts the silhouette into a large closed helmet and a tall plated shield with a pale face-like emblem. Both preserve the large hand/weapon and short lower-body emphasis, but the material coverage changes the read from exposed muscle to solid armour.

Sources: Greenskin - Orc Boy (`lpw-herrdave-87375`), Greenskin - Black Orc (`lpw-herrdave-87376`).

Black Orc Warboss adds a wide horned skull construction above the helmet and chains that descend from it. The hero and unit variants have 2,187 and 2,181 triangles respectively; the hero adds a green ground glow in the published image. That six-triangle difference is much smaller than the difference between Black Orc and Warboss (1,527 versus 2,181).

Sources: Greenskin - Black Orc (`lpw-herrdave-87376`), Greenskin - Black Orc Warboss (`lpw-herrdave-87377`), Greenskin - Black Orc Warboss (Hero) (`lpw-herrdave-104264`).

Black Orc, both Warboss variants and Orc Boy map custom texture files under the same Greenskin collection, but each catalogue row has an explicit model-scoped texture mapping. Identical texture basenames cannot be resolved globally without checking those per-model mappings.

Sources: Greenskin - Black Orc (`lpw-herrdave-87376`), Greenskin - Black Orc Warboss (`lpw-herrdave-87377`), Greenskin - Black Orc Warboss (Hero) (`lpw-herrdave-104264`), Greenskin - Orc Boy (`lpw-herrdave-87375`).

## Measured examples

The visible column is the measured Stand-like sample recorded per model; total includes hidden and death-only geometry. Texture paths include effects and animated frames.

| Model | Total triangles | Sample visible | Geosets | Texture paths | Bytes |
|---|---:|---:|---:|---:|---:|
| Greenskin - Black Orc | 1527 | 1463 | 7 | 4 | 123,475 |
| Greenskin - Black Orc Warboss | 2181 | 2117 | 8 | 4 | 140,472 |
| Greenskin - Black Orc Warboss (Hero) | 2187 | 2123 | 9 | 4 | 142,384 |
| Greenskin - Orc Boy | 1030 | 966 | 8 | 6 | 110,187 |
| Snotling | 544 | 480 | 6 | 5 | 64,570 |
| Greenskin - Savage Orc | 596 | 532 | 6 | 5 | 82,122 |

## What this sample does not establish

The six entries do not cover mounted orcs, ordinary goblin troops, shamans, monsters or buildings. This is a profile of the represented Greenskin bodies and armour, not the entire army.
