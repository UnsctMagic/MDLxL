# Hands and facial hair: selective detail around the face

Tauren's two block hands each have ten triangles. Necromancer's hands each have seven. Both use broad painted surfaces to suggest knuckles and fingers; they are not meshes with every finger separated. The hand silhouettes are compact enough to fit the weapon or book without a full finger rig. These measured examples support a specific observation about these hands, not a rule that all Warcraft hands should be blocks.

Rifleman's face-and-beard component has 94 triangles, while his moustache is a separate 23-triangle piece and each long eyebrow has four. Mountain King has a 20-triangle two-lobed moustache and four-triangle eyebrows beside a 123-triangle head/helmet/beard assembly. Necromancer's moustache has ten triangles beside his 114-triangle head and beard. The facial-hair lobes bend away from the head; their pale hair strands and dark roots are painted on those larger surfaces.

Footman, Mountain King, Rifleman, Knight and Blademaster each have separate one-triangle eye surfaces in the reviewed pieces. A tiny painted iris or dark eye does not need many triangles to be an independent surface. Necromancer's eyelids are two-triangle strips with eyelid rig assignment, distinct from an iris surface. Names alone were not used to invent these labels: the isolated texture, posed position and matching facial context were inspected.

The distribution of effort is uneven within the same character. Rifleman can use one triangle for an eye, four for a brow, 23 for the moustache and 94 for the head-and-beard assembly. The useful knowledge is this hierarchy and the exact component boundary. A broad minimum/maximum across everything called face would discard it.

## Measured examples

| Model / part (1-based) | Identified piece | Triangles | Stored vertices / positions | Principal spans in Footman heights | Normal-split positions |
|---|---|---:|---:|---|---:|
| dryad.mdx g1:c10 | closed mitten hand | 11 | 8 / 8 | 0.163 × 0.132 × 0.102 | 0 |
| shaman.mdx g1:c5 | closed green hand | 9 | 7 / 7 | 0.259 × 0.182 × 0.138 | 0 |
| headhunter.mdx g2:c9 | closed troll hand | 7 | 11 / 6 | 0.193 × 0.127 × 0.127 | 0 |
| herodemonhunter.mdx g1:c6 | closed mitten hand | 9 | 7 / 7 | 0.218 × 0.157 × 0.151 | 0 |
| heroblademaster.mdx g2:c23 | Eye surface | 1 | 3 / 3 | 0.025 × 0.017 × 0.000 | 0 |
| heromountainking.mdx g1:c9 | Two-lobed moustache | 20 | 18 / 18 | 0.188 × 0.193 × 0.077 | 0 |
| heromountainking.mdx g1:c11 | Raised eyebrow | 4 | 8 / 5 | 0.059 × 0.021 × 0.010 | 3 |
| heromountainking.mdx g1:c17 | Eye surface | 1 | 3 / 3 | 0.019 × 0.016 × 0.000 | 0 |
| rifleman.mdx g1:c1 | Eye surface | 1 | 3 / 3 | 0.019 × 0.016 × 0.000 | 0 |
| rifleman.mdx g1:c5 | Moustache | 23 | 35 / 18 | 0.144 × 0.136 × 0.051 | 4 |
| rifleman.mdx g1:c12 | Long eyebrow | 4 | 8 / 5 | 0.053 × 0.016 × 0.009 | 2 |
| tauren.mdx g1:c2 | Block hand | 10 | 8 / 8 | 0.256 × 0.194 × 0.150 | 0 |
| knight.mdx g1:c20 | Rider eye surface | 1 | 3 / 3 | 0.010 × 0.009 × 0.000 | 0 |
| magnataur.mdx g1:c4 | Hand and fur cuff | 18 | 20 / 12 | 0.361 × 0.335 × 0.240 | 6 |
| footman.mdx g1:c3 | Face and moustache | 44 | 44 / 28 | 0.128 × 0.108 × 0.080 | 0 |
| footman.mdx g1:c15 | Eye surface | 1 | 3 / 3 | 0.017 × 0.017 × 0.000 | 0 |
| necromancer.mdx g2:c6 | Long moustache lobes | 10 | 16 / 12 | 0.175 × 0.107 × 0.045 | 0 |
| necromancer.mdx g2:c8 | Nose and facial plane | 6 | 10 / 6 | 0.039 × 0.026 × 0.001 | 4 |
| necromancer.mdx g2:c9 | Eyelid surface | 2 | 4 / 4 | 0.023 × 0.008 × 0.001 | 0 |
| necromancer.mdx g2:c14 | Block hand | 7 | 6 / 6 | 0.158 × 0.132 × 0.094 | 0 |
| herodeathknight.mdx g1:c8 | White moustache or facial hair lobe | 7 | 7 / 7 | 0.055 × 0.024 × 0.013 | 0 |

The three spans follow the component’s principal axes in its bind geometry. Footman height=1 means 98.257613 raw model units at the documented Stand sample; these are not in-game object-scaled sizes. Stored vertices can split at normals or UVs without adding positions.

## Traceable sources and pictures

- `units\nightelf\dryad\dryad.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/index.html).
- `units\orc\shaman\shaman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-4939AC42330023985C6BB59E83A21CE1/index.html).
- `units\orc\headhunter\headhunter.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/index.html).
- `units\nightelf\herodemonhunter\herodemonhunter.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-F158FE60187900CF9D03B53FEFF39C61/index.html).
- `units\orc\heroblademaster\heroblademaster.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C88B7CBDA1F975C9F06EE463EF0CDF70/index.html).
- `units\human\heromountainking\heromountainking.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C2B7CC84AB5D0B4DA75D24AE427F57F8/index.html).
- `units\human\rifleman\rifleman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-5DA28A7F3EB64E659C17311F550A3877/index.html).
- `units\orc\tauren\tauren.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-DA2AF4DD7727DA5466F7CAA4B7FD955D/index.html).
- `units\human\knight\knight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-7503B2C77940A164DEF7DC704AF9413C/index.html).
- `units\creeps\magnataur\magnataur.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-8BBB89493A5E87B21E7B7F18D8B211F2/index.html).
- `units\human\footman\footman.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-3BD0831FAD186C0C08767F15A9663E4B/index.html).
- `units\undead\necromancer\necromancer.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-C3D72C140A1B9BDE76CEC1412AB42C4E/index.html).
- `units\undead\herodeathknight\herodeathknight.mdx` — [four angles, wireframe, component views and UVs](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html).

Exact component measurements, UV triangles, material paths, uncertainties and observation notes: [reviewed part dataset](../../data/native-reviewed-parts.json).
