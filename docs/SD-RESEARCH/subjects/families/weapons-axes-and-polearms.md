# Axe and polearm heads: perimeter before ornament

Grunt's axe is unusually economical in this comparison: g8:c1 is an eight-triangle head with six distinct positions; g8:c2 is a separate eight-triangle haft. The head's broad dark face and pale cutting edge read as heavy iron. The bright edge is painted onto the wedge rather than carried by a separate narrow bevel ring. Its six-position solid can be inspected independently of the hand and body.

Mountain King's axe head (g1:c16) has ten triangles. Its broad dark centre looks rounded and raised because of a circular painted highlight, although the mesh does not follow that circular boundary. The axe haft (g1:c8) contributes another ten triangles. In the normal material state the head is dark steel; enabling the dormant Avatar layer produces a different appearance and was explicitly excluded from this normal-state comparison.

Magnataur's polearm is a different family within the broad weapon-head category. The main pointed blade (g1:c3) has twenty triangles; four separate spikes (g1:c10–13) have six each; the haft and end fitting (g1:c6) add twenty-seven. Those identified weapon pieces total 71 triangles. Reporting only the 20-triangle blade would omit 24 triangles of silhouette spikes. Gold bolt-like squares and dark channels remain painted on the main blade, while the separate spikes create the unmistakable shape from the game-camera elevation.

Death Knight's five-triangle armour spikes are included in the comparison table as a boundary case: similar pointed solids can belong to armour rather than a weapon. Their carrier and attachment location are retained. The Orc Barracks weapon emblem is a stronger boundary: its axe can be a two-triangle alpha-painted decoration, documented in the environment chapters. It is not a volumetric axe reference merely because the image depicts an axe.

LowPolyWorks' Knight of Nurgle separates a 55-triangle scythe blade body from a 26-triangle cutting-edge component, both mapped to Tomb of Relics. The model thus reuses building paint while giving the silhouette substantially more geometry than Grunt's eight-triangle head. The source sheet identity does not imply that the scythe geometry came from the building. The owner's labelled component records and source-to-part plates retain that distinction.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| heromountainking.mdx g1:c16 | Wide axe head | 10 | 17 / 7 | 0.541 × 0.325 × 0.084 | 6 |
| magnataur.mdx g1:c3 | Polearm blade | 20 | 18 / 12 | 0.859 × 0.335 × 0.168 | 0 |
| magnataur.mdx g1:c10 | Polearm head spike | 6 | 6 / 5 | 0.342 × 0.086 × 0.052 | 1 |
| grunt.mdx g8:c1 | Heavy axe blade | 8 | 9 / 6 | 0.441 × 0.370 × 0.061 | 0 |
| herodeathknight.mdx g1:c19 | Pale armour spike | 5 | 5 / 5 | 0.254 × 0.105 × 0.095 | 0 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\human\heromountainking\heromountainking.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C2B7CC84AB5D0B4DA75D24AE427F57F8/index.html).
- `units\creeps\magnataur\magnataur.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-8BBB89493A5E87B21E7B7F18D8B211F2/index.html).
- `units\orc\grunt\grunt.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-1D5D5C34938F91BFC1989A223ABC8096/index.html).
- `units\undead\herodeathknight\herodeathknight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
