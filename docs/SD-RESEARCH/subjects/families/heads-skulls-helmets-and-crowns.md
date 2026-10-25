# Skulls, helmets and crowns: distinguish ornament from head

Footman's helmet shell and visor are 47 triangles; his face and moustache are a separate 44-triangle component. The opening is therefore real geometry around another surface, not merely a dark patch painted on an uninterrupted helmet. The shell uses 59 stored vertices for 29 positions, including ten positions with normal splits. Its steel planes, gold borders and painted rivets cooperate; vertex count alone would overstate the geometric complexity.

Skeleton's 126-triangle skull includes its jaw in one connected component. Necromancer's 166-triangle animal-skull headdress includes two long curved horns and sits over a different 114-triangle human head-and-beard assembly. These are not two samples of the same bare-skull problem. Necromancer's horn growth bands and dark skull cavities are painted, but the long horn curves alter the silhouette geometrically.

Lich's 210-triangle rigid component includes skull, crown and spiked shoulder collar. His 32-triangle pointed lower jaw is articulated separately. Counting every bone near the head as a skull would conceal both the collar and jaw boundary. Mountain King's 123-triangle head assembly likewise includes helmet, face and long beard, with separate 20-triangle moustache and four-triangle brows.

Death Knight devotes 144 triangles to head and white hair. The large bright hair silhouette is a major part of the overhead reading. His skull-faced five- and seven-triangle armour plates provide the opposite approach: the skulls on those plates are mostly painted symbols, with eye sockets visible in paint but not cut out as cavities. The same motif therefore appears as anatomy, headdress and flat armour decoration in three distinct constructions.

The LowPolyWorks Graveguard uses a 56-triangle face skull and sixteen triangles of helmet-wing cards across six components. These parts belong to a new assembly with native texture reuse. Its credit text and exact component source matching are retained independently; a matching skull motif or bone paint is insufficient to assign a copied mesh source.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| heromountainking.mdx g1:c2 | Helmet, face and long beard assembly | 123 | 124 / 69 | 0.706 × 0.226 × 0.225 | 6 |
| heromountainking.mdx g1:c4 | Curved helmet horn | 15 | 10 / 10 | 0.251 × 0.192 × 0.078 | 0 |
| heromountainking.mdx g1:c10 | Rear helmet point | 3 | 7 / 4 | 0.113 × 0.063 × 0.071 | 3 |
| rifleman.mdx g1:c3 | Face and beard | 94 | 121 / 59 | 0.440 × 0.175 × 0.152 | 0 |
| footman.mdx g1:c2 | Helmet shell and visor | 47 | 59 / 29 | 0.244 × 0.209 × 0.172 | 10 |
| grunt.mdx g2:c1 | Head with jaw and large tusks | 130 | 187 / 79 | 0.496 × 0.386 × 0.178 | 9 |
| skeleton.mdx g1:c2 | Skull including jaw | 126 | 112 / 77 | 0.260 × 0.149 × 0.150 | 13 |
| templeofthedamned.mdx g3:c6 | Fanged temple skull | 66 | 42 / 42 | 1.064 × 0.738 × 0.584 | 0 |
| herolich.mdx g1:c2 | Skull, crown and spiked shoulder collar | 210 | 255 / 115 | 0.453 × 0.458 × 0.276 | 58 |
| herolich.mdx g1:c3 | Pointed lower jaw | 32 | 32 / 24 | 0.114 × 0.061 × 0.062 | 0 |
| necromancer.mdx g2:c1 | Head and long beard | 114 | 117 / 75 | 0.564 × 0.272 × 0.174 | 6 |
| necromancer.mdx g2:c2 | Horned animal skull headdress | 166 | 125 / 98 | 0.612 × 0.666 × 0.213 | 4 |
| herodeathknight.mdx g1:c2 | Rider head and white hair | 144 | 151 / 86 | 0.431 × 0.249 × 0.254 | 9 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\human\heromountainking\heromountainking.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C2B7CC84AB5D0B4DA75D24AE427F57F8/index.html).
- `units\human\rifleman\rifleman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA28A7F3EB64E659C17311F550A3877/index.html).
- `units\human\footman\footman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-3BD0831FAD186C0C08767F15A9663E4B/index.html).
- `units\orc\grunt\grunt.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-1D5D5C34938F91BFC1989A223ABC8096/index.html).
- `units\undead\skeleton\skeleton.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA840F8D4830A2CD8B8364524C26469/index.html).
- `buildings\undead\templeofthedamned\templeofthedamned.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-521B007AF78AC7EC9CD7F57C5B6D75DB/index.html).
- `units\undead\herolich\herolich.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-41387D67933F1CFCF35C0DD9AFB1A3E1/index.html).
- `units\undead\necromancer\necromancer.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C3D72C140A1B9BDE76CEC1412AB42C4E/index.html).
- `units\undead\herodeathknight\herodeathknight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
