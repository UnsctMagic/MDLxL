# Undead: different scales of bone, torn cloth and dark armour

![Reviewed SD sources](D:/Codex/sd-research/pictures/warcraft-factions/undead.webp)

Skeleton, HeroLich and HeroDeathKnight all place pale bone-like marks against darker fields, but their construction is not interchangeable. Skeleton's skull including jaw is a 126-triangle connected mesh. HeroDeathKnight's five-triangle skull-faced armour plate and seven-triangle hanging plates carry the eye sockets as paint. A small skull emblem can therefore be a shaped plate, whereas the head that defines Skeleton's identity is a much fuller object.

Skeleton's 52-triangle ribcage/pelvis has internal rib divisions predominantly painted. HeroLich instead includes a thirty-triangle open chest frame and a separate twelve-triangle striped torso surface. HeroLich's 210-triangle head/crown/spiked collar is one combined rigid assembly, with a separate 32-triangle jaw. Calling that whole assembly a skull would inflate skull statistics and lose the crown and shoulders that make the silhouette wide.

HeroLich's floating ragged edge is assembled from eight five-triangle robe strips and three longer ten-triangle strips, with small dark lining strips behind some surfaces. Painted folds and borders strengthen the shape, but the separated strips create the real outer gaps. Necromancer has a different cloth construction: a 22-triangle main skirt and ten-triangle sleeves, topped by a 166-triangle horned animal skull headdress. Its horns and skull are one component; their growth bands and dark cavities are painted.

CryptFiend and Gargoyle supply non-humanoid signatures. CryptFiend combines a broad grey arched shell with a pale striped front, thin legs and detached small spikes; ten spikes cost three triangles each and four others five each. Gargoyle separates dark thin wing membranes from long angular red team-colour fingers in this preview. Four large membrane components are two triangles each, while six finger components cost five each. Its head/hair assembly costs 191 triangles compared with 163 for the headless body.

Necropolis links these contrasts to architecture through dark sloping walls, pale edge ribs, red banners and a skull at the entrance. Acolyte uses a deep dark hood with a small pale face and bright bordered trim. These sources make an undead palette more specific than 'black and green': pale faces/bone, dark grey or purple structural fields, selected saturated identity patches and sharp light borders. The precise native region and its source model remain necessary when reusing the paint; the whole sheet is not uniformly bone or cloth.

| Source model | Sample body triangles | Visible diffuse paths | Raw height / Footman | Actual sampled sheets |
| --- | --- | --- | --- | --- |
| [Skeleton](D:/Codex/sd-research/captures/models/native-sd-5DA840F8D4830A2CD8B8364524C26469/index.html) | 334 | 1 | 1.048 | `textures\skeleton.blp` |
| [Necromancer](D:/Codex/sd-research/captures/models/native-sd-C3D72C140A1B9BDE76CEC1412AB42C4E/index.html) | 540 | 1 | 1.343 | `units\undead\necromancer\necromancer.blp` |
| [HeroLich](D:/Codex/sd-research/captures/models/native-sd-41387D67933F1CFCF35C0DD9AFB1A3E1/index.html) | 508 | 1 | 1.661 | `textures\herolich.blp` |
| [HeroDeathKnight](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html) | 595 | 1 | 1.504 | `units\undead\herodeathknight\herodeathknight.blp` |
| [CryptFiend](D:/Codex/sd-research/captures/models/native-sd-F1B15954BF2ACA46738EB0C5E4EFED67/index.html) | 492 | 1 | 1.448 | `textures\cryptfiend.blp` |
| [Gargoyle](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html) | 468 | 1 | 1.626 | `units\undead\gargoyle\gargoyle.blp` |
| [Necropolis](D:/Codex/sd-research/captures/models/native-sd-7AFDE9CA78C7B80164F7DB08F2334524/index.html) | 278 | 1 | 3.873 | `textures\creepynecropolis.blp` |
| [Acolyte](D:/Codex/sd-research/captures/models/native-sd-3EE79C63F0CDF8C1051BCC15BC52AA7B/index.html) | 353 | 1 | 0.995 | `textures\acolyte.blp` |

Pictures use independently fitted camera framing and the red player colour; they are not a scale lineup. Heights are sampled mesh height before object modelscale. Exact IDs, source hashes, official assignments and reviewed component references are retained in [warcraft-faction-profiles.json](../../data/warcraft-faction-profiles.json).
