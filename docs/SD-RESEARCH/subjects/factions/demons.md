# Demon sources and Chaos Grunt: silhouette before a single palette

![Reviewed SD sources](D:/Codex/sd-research/pictures/warcraft-factions/demons.webp)

Doomguard, Felhound and Infernal are the only reviewed units here whose official unit race field is demon; the installed category also assigns several visibly demonic models to other race values. The visual sample therefore explicitly includes Demoness, Felgaurd, EredarWarlock, ChaosGrunt and HeroPitLord by inspected source model, without silently rewriting their official race fields.

Doomguard combines wings, a muscular humanoid torso and a long weapon; Felhound is a low four-legged red creature with pale projecting horns and dark spines; Infernal is made of dark angular stone masses with green light between or around them. Their sampled bodies are 529, 509 and 528 triangles. The Infernal research capture contains sharply edged green effect geometry, so the screenshot is evidence for the rendered sample and material arrangement, not a verified in-game glow shape.

Demoness uses a smaller horned humanoid silhouette with dark wings and warm red-orange skin; Felgaurd is a broad armoured humanoid with a large patterned blade; EredarWarlock places red skin and gold-black ornaments around an upright caster body. Their sampled bodies are 616, 599 and 529 triangles. HeroPitLord's 655-triangle body makes the lower carrier much broader and longer than the upper torso. A generic 'red humanoid with horns' profile would omit the low quadruped, rock-bodied and massive multi-limbed examples in this same sample.

ChaosGrunt and ordinary Grunt each measure 421 sampled body triangles. The reviewed ChaosGrunt retains the recognisable axe, shoulder mass and low tusked head arrangement while changing exposed skin to red-orange and shifting surrounding paint. This is a visual/count comparison only, without claiming an exact geometry clone. Warcraft's ChaosGrunt is also a distinct source from LowPolyWorks' Warhammer Chaos armies: their names do not justify treating the materials, symbols or construction as identical.

| Source model | Sample body triangles | Visible diffuse paths | Raw height / Footman | Actual sampled sheets |
| --- | --- | --- | --- | --- |
| [doomgaurd](D:/Codex/sd-research/captures/models/native-sd-B95F592DAED463329CF6E259F713F144/index.html) | 529 | 2 | 2.003 | `units\demon\doomguard\doomgaurd.blp`<br>`textures\clouds_anim1_bw.blp` |
| [felhound](D:/Codex/sd-research/captures/models/native-sd-03C3C2702BD3AEB7BD15A34D59DC049A/index.html) | 509 | 1 | 0.975 | `textures\felhound.blp` |
| [Infernal](D:/Codex/sd-research/captures/models/native-sd-4541C46FE17BE798E5D5C6349057770A/index.html) | 528 | 3 | 2.749 | `units\demon\infernal\infernal.blp`<br>`textures\yellow_star.blp`<br>`textures\clouds_anim1_bw.blp` |
| [Demoness](D:/Codex/sd-research/captures/models/native-sd-C86012FC29C2C5CF27C9DE75C7D6C8C7/index.html) | 616 | 1 | 1.11 | `units\demon\demoness\demoness.blp` |
| [Felgaurd](D:/Codex/sd-research/captures/models/native-sd-CB9D39CBA336D02C72878EE2B2BC0CDC/index.html) | 599 | 1 | 1.962 | `units\demon\felgaurd\felguard.blp` |
| [EredarWarlock](D:/Codex/sd-research/captures/models/native-sd-458E7A9E68130207A3BFA0C3EA3451C7/index.html) | 529 | 1 | 1.371 | `textures\eredarred.blp` |
| [ChaosGrunt](D:/Codex/sd-research/captures/models/native-sd-968D105344B079C59A13EDD50AC32430/index.html) | 421 | 1 | 1.005 | `textures\chaosgrunt.blp` |
| [HeroPitLord](D:/Codex/sd-research/captures/models/native-sd-DBD7288D7713444E531CF7F218CBD96E/index.html) | 655 | 1 | 2.004 | `units\demon\heropitlord\heropitlord.blp` |

Pictures use independently fitted camera framing and the red player colour; they are not a scale lineup. Heights are sampled mesh height before object modelscale. Exact IDs, source hashes, official assignments and reviewed component references are retained in [warcraft-faction-profiles.json](../../data/warcraft-faction-profiles.json).
