# Critters: tiny bodies still have distinct allocations

![Reviewed SD sources](D:/Codex/sd-research/pictures/warcraft-factions/critters.webp)

Sheep, Pig and Seal are the sparse end of this reviewed sample at 69, 70 and 52 sampled triangles. Sheep reads through a pale wool mass with dark face/feet; Pig through a warm mottled body and projecting snout; Seal through an elongated pale spotted body with flattened flippers. Their one-sheet designs concentrate recognition on broad body proportions and a small number of appendages, rather than on equipment.

BrownWolf and BlackStagMale rise to 168 and 212 sampled triangles. BrownWolf has a long narrow muzzle, pointed ears and a raised tail; BlackStagMale adds slender legs and antler branches around a leaner four-legged carrier. In the reviewed captures their fur markings vary substantially, even though both are small background animals. The independently fitted pictures do not prove the two animals have similar in-game heights.

Albatross and Penguin use very different bird outlines at 123 and 164 triangles. Albatross has outstretched wings with painted dark feather edges and a small central body; Penguin has an upright oval body with pale belly, dark flanks and projecting yellow head feathers. HermitCrab is the expensive outlier here at 398 triangles, distributing geometry over claws, legs and a large pale shell. This reviewed critter set therefore cannot support a rule that all ambient animals should be under one hundred triangles.

Each of the eight named critters uses one sampled visible diffuse path. Their texture names and UV captures provide material sources for wool, fur, feather and shell appearances even when a later kitbash has no relation to the source animal. This profile records appearance and whole-model measurements; it does not claim a complete individually labelled anatomical decomposition of these eight models.

| Source model | Sample body triangles | Visible diffuse paths | Raw height / Footman | Actual sampled sheets |
| --- | --- | --- | --- | --- |
| [Sheep](D:/Codex/sd-research/captures/models/native-sd-7C44418EB4C797D5CC5EF1E15BF578BB/index.html) | 69 | 1 | 0.368 | `textures\sheepa.blp` |
| [Pig](D:/Codex/sd-research/captures/models/native-sd-143DF96A7292B7840E2A030C321E9BA1/index.html) | 70 | 1 | 0.448 | `units\critters\pig\pig.blp` |
| [Seal](D:/Codex/sd-research/captures/models/native-sd-927E45ECAB83B242183C4C21F4F8B812/index.html) | 52 | 1 | 0.366 | `units\critters\seal\greyseal.blp` |
| [BrownWolf](D:/Codex/sd-research/captures/models/native-sd-0198596B6F12B8D45F08DF6068B49F04/index.html) | 168 | 1 | 0.524 | `textures\brownwolf.blp` |
| [BlackStagMale](D:/Codex/sd-research/captures/models/native-sd-F9EE0FEE26CBCAFB639395C4F234E74F/index.html) | 212 | 1 | 0.842 | `units\critters\blackstagmale\blackstag.blp` |
| [Albatross](D:/Codex/sd-research/captures/models/native-sd-1CFD0426D1B28D8E12FEB24D8F036620/index.html) | 123 | 1 | 0.389 | `textures\albatross.blp` |
| [Penguin](D:/Codex/sd-research/captures/models/native-sd-092074D394AFA3E8FD6D80C899E25569/index.html) | 164 | 1 | 0.596 | `units\critters\penguin\pengo.blp` |
| [HermitCrab](D:/Codex/sd-research/captures/models/native-sd-B83512C65A71A14A82675F1EC0CB53F3/index.html) | 398 | 1 | 0.377 | `units\critters\hermitcrab\hermitcrabskin.blp` |

Pictures use independently fitted camera framing and the red player colour; they are not a scale lineup. Heights are sampled mesh height before object modelscale. Exact IDs, source hashes, official assignments and reviewed component references are retained in [warcraft-faction-profiles.json](../../data/warcraft-faction-profiles.json).
