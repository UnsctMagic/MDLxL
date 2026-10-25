# Creature creeps: wings, multi-part anatomy, rock and armour

![Reviewed SD sources](D:/Codex/sd-research/pictures/warcraft-factions/creeps-creature.webp)

RedDragon and AzureDragon share the broad winged quadruped arrangement in these captures, but warm red/orange and cool blue/purple paint change the creature's reading. Their sampled bodies are 425 and 421 triangles. RedDragonWelp has 350: it is a separately measured lower-count model, not merely evidence that all dragon ages use an identical mesh. The contact pictures are independently fitted, so their displayed sizes cannot establish their relative game scale.

Harpy's long feathered wings, pale body and small feet create a different flying silhouette from the dragons' dark membranes and projecting fingers. Its sampled body is 349 triangles. Centaur's 294-triangle body joins a humanoid tool-user to a four-legged carrier, while Hydra's 470-triangle body distributes recognition across multiple heads and a low long body. Nerubian's 368 triangles instead build a compact armoured upper mass over several narrow articulated legs. These specific carrier arrangements are more informative than treating all three as large monsters.

FacelessOne's purple flesh, prominent head appendages, silver bands and massive weapon contrast with Revenant's dark red-black armour and long upright weapon. FacelessOne is 440 sampled triangles and Revenant 364. Their sheets can offer material regions unrelated to the creature as a whole: the owner's reviewed Necrarch book ornament uses FacelessOne paint, while its book frame uses UndeadAirBarge. This transfer is supported by part-level UV records in the owner study, not by a guess from the source filename.

RockGolem has a blocky broken-rock outline and dense crack painting; ThunderLizard has a broad low green body, pale scale markings and a line of projecting dorsal plates. Their sampled bodies are 422 and 533 triangles. SludgeMonster uses a dark blue-purple mass and long pointed extensions at 267 triangles. These three demonstrate different ways to carry texture detail on large forms, but this profile does not claim that every visible crack, scale or tendril was separately traced. Exact painted-versus-modelled boundaries require the component/UV evidence for that part.

The selected creature creeps use one visible diffuse sheet each except RockGolem, which uses two, and Revenant, which uses three in this sample. Revenant combines its armour sheet with BlueWaves and Blue_Glow2 effect surfaces. The body counts exclude hidden alternatives and hero glow. These observations are useful reference families, not a universal quota for wings, scales, rock pieces or creature limbs.

| Source model | Sample body triangles | Visible diffuse paths | Raw height / Footman | Actual sampled sheets |
| --- | --- | --- | --- | --- |
| [RedDragon](D:/Codex/sd-research/captures/models/native-sd-4F83F1E8D2DC7E2E3CFF0E6B546BE2B9/index.html) | 425 | 1 | 1.787 | `textures\reddragon.blp` |
| [RedDragonWelp](D:/Codex/sd-research/captures/models/native-sd-8A35E06719E419F1E76B476243987002/index.html) | 350 | 1 | 1.542 | `textures\reddragon.blp` |
| [AzureDragon](D:/Codex/sd-research/captures/models/native-sd-C17776CAA5B34F4F7668DAF96E405E3E/index.html) | 421 | 1 | 1.786 | `textures\azuredragon.blp` |
| [Harpy](D:/Codex/sd-research/captures/models/native-sd-F0DED76445E6A05BACC742F3CB317EFF/index.html) | 349 | 1 | 0.879 | `units\creeps\harpy\harpy.blp` |
| [Centaur](D:/Codex/sd-research/captures/models/native-sd-E5D7C4B0BC2E9D0685C4C2194B4D799C/index.html) | 294 | 1 | 1.306 | `textures\centaur.blp` |
| [FacelessOne](D:/Codex/sd-research/captures/models/native-sd-9E8A9468F2294181CECACF38404C7CDA/index.html) | 440 | 1 | 1.13 | `units\creeps\facelessone\facelessone.blp` |
| [Nerubian](D:/Codex/sd-research/captures/models/native-sd-C4B767CBB0FD539918A87019D3D41664/index.html) | 368 | 1 | 1.361 | `textures\nerubian.blp` |
| [RockGolem](D:/Codex/sd-research/captures/models/native-sd-26AF984452168ED4A263EF9F1AC93C8F/index.html) | 422 | 2 | 2.14 | `units\creeps\rockgolem\rocktile.blp`<br>`units\creeps\rockgolem\rockgolem2.blp` |
| [SludgeMonster](D:/Codex/sd-research/captures/models/native-sd-982E13D3CE77BE920A681359682B8A59/index.html) | 267 | 1 | 0.858 | `textures\acolyte.blp` |
| [Hydra](D:/Codex/sd-research/captures/models/native-sd-D9A74C7D211D356B53BFAD16FF4D6395/index.html) | 470 | 1 | 2.003 | `units\creeps\hydra\hydraskinblue2.blp` |
| [ThunderLizard](D:/Codex/sd-research/captures/models/native-sd-5C94E7343FC9763299558485236E5F54/index.html) | 533 | 1 | 1.909 | `textures\thunderlizard.blp` |
| [Revenant](D:/Codex/sd-research/captures/models/native-sd-6F6D0F0EA89CCCD01CFFF23931987EFF/index.html) | 364 | 3 | 1.959 | `textures\bluewaves.blp`<br>`units\creeps\revenant\revenant.blp`<br>`textures\blue_glow2.blp` |

Pictures use independently fitted camera framing and the red player colour; they are not a scale lineup. Heights are sampled mesh height before object modelscale. Exact IDs, source hashes, official assignments and reviewed component references are retained in [warcraft-faction-profiles.json](../../data/warcraft-faction-profiles.json).
