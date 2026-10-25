# Creeps with humanoid tools: head motifs, skin variants and fur

![Reviewed SD sources](D:/Codex/sd-research/pictures/warcraft-factions/creeps-humanoid.webp)

Gnoll, Kobold, Ogre and Murloc do not form one silhouette family even though the installed object rows group them as creeps. Gnoll has a long muzzle and hunched furred upper body; Kobold is compact under oversized ear/head shapes and equipment; the reviewed two-headed Ogre has a broad bare torso and blunt club; Murloc places a very large round-eyed head over a small narrow body and legs. Their sampled bodies are 378, 266, 494 and 358 triangles. A single creep median would conceal precisely the head and body choices that identify these creatures.

ForestTroll, IceTroll and DarkTroll each have 421 sampled body triangles and one visible diffuse sheet. In the reviewed captures their posture and extended arm/ear shapes correspond closely, while skin changes from green through pale cyan to purple. Equal counts alone do not prove identical vertex positions, UVs or rigging; this profile records a visually corresponding family and exact counts, not an unmeasured clone claim. The sheet paths retain the three painted variants rather than collapsing them into a generic troll skin.

Ogre and OgreMagi both have 494 sampled body triangles. OgreMagi's blue skin and strong dark body markings contrast with Ogre's tan skin while preserving the visible two-head, broad torso and club arrangement. Furbolg instead reads through a large brown furry body, broad paws and coloured projecting ornaments, at 288 sampled triangles. Satyr uses a narrower horned humanoid profile with cloven-looking lower limbs and long pointed head extensions, at 404. Those fur, skin and ornament regions cannot be inferred safely from the common category label.

Tuskar uses a compact brown-and-pale body, prominent tusks and a pale blue weapon, at 534 sampled triangles. Magnataur spreads a furred mammoth-like carrier across four feet with a large upper body and long tusks, at 851. In the directly inspected Magnataur parts, the head/body/limbs form a 542-triangle connected assembly, four fur-covered feet cost fifteen each, and fur-fringe strips range from two to six triangles. Its polearm comprises a twenty-triangle blade, 27-triangle haft and four six-triangle head spikes. These are measured component boundaries, rather than estimates from the unit's bone names.

The Magnataur sheet is also an owner texture source: the reviewed Strigoi Vampire reuses it for skirt and waist pieces. That reuse selects pale/brown painted structure for a new humanoid garment rather than importing Magnataur's original mammoth anatomy. The original and reused component evidence is linked in the vampire study, demonstrating why the visual material library must allow a creature sheet to supply cloth-like or trim-like areas.

| Source model | Sample body triangles | Visible diffuse paths | Raw height / Footman | Actual sampled sheets |
| --- | --- | --- | --- | --- |
| [Gnoll](D:/Codex/sd-research/captures/models/native-sd-EFF70748D885FB93193272B82485798F/index.html) | 378 | 1 | 1.122 | `textures\gnoll.blp` |
| [Kobold](D:/Codex/sd-research/captures/models/native-sd-34487446E4D035BAC3290BCD45607A23/index.html) | 266 | 1 | 0.736 | `units\creeps\kobold\kobold.blp` |
| [Ogre](D:/Codex/sd-research/captures/models/native-sd-027C15CEBF992983793FF689E9844E63/index.html) | 494 | 1 | 1.367 | `units\creeps\ogre\ogre.blp` |
| [OgreMagi](D:/Codex/sd-research/captures/models/native-sd-E4081BBC61F108BDC2ABE451C81E3EBC/index.html) | 494 | 1 | 1.367 | `units\creeps\ogremagi\ogremagi.blp` |
| [ForestTroll](D:/Codex/sd-research/captures/models/native-sd-285C2B6FB1BE7593E75194A9AC855E2E/index.html) | 421 | 1 | 1.079 | `textures\foresttroll.blp` |
| [IceTroll](D:/Codex/sd-research/captures/models/native-sd-383CC97A64FE8FA779C482088D2D0D50/index.html) | 421 | 1 | 1.079 | `units\creeps\icetroll\icetroll.blp` |
| [DarkTroll](D:/Codex/sd-research/captures/models/native-sd-D3DC0F9371E25E9D882DDF3D0F954BA4/index.html) | 421 | 1 | 1.079 | `units\creeps\darktroll\darktroll.blp` |
| [Murloc](D:/Codex/sd-research/captures/models/native-sd-7A8808DCE929C4027DE478656F4E37C0/index.html) | 358 | 1 | 0.879 | `units\creeps\murloc\murloc.blp` |
| [Furbolg](D:/Codex/sd-research/captures/models/native-sd-46EE393A642D6164E5F7293BF68BEC76/index.html) | 288 | 1 | 1.286 | `units\creeps\furbolg\furbolg.blp` |
| [Satyr](D:/Codex/sd-research/captures/models/native-sd-56650181A36B63361BB79B64D0DE33C1/index.html) | 404 | 1 | 1.092 | `textures\satyr.blp` |
| [tuskar](D:/Codex/sd-research/captures/models/native-sd-7A138F70EC332C079DBAF9610DBD1FAD/index.html) | 534 | 1 | 1.428 | `units\creeps\tuskar\tuskarr.blp` |
| [Magnataur](D:/Codex/sd-research/captures/models/native-sd-8BBB89493A5E87B21E7B7F18D8B211F2/index.html) | 851 | 1 | 1.7 | `units\creeps\magnataur\magnataur.blp` |

Pictures use independently fitted camera framing and the red player colour; they are not a scale lineup. Heights are sampled mesh height before object modelscale. Exact IDs, source hashes, official assignments and reviewed component references are retained in [warcraft-faction-profiles.json](../../data/warcraft-faction-profiles.json).
