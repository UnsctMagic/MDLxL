# Spawn models: zero stored triangles is not zero authored content

**objects\spawnmodels\other\humanbloodcinematiceffect\humanbloodcinematiceffect.mdx** stores 0 mesh triangles and the emitter counts shown below. **objects\spawnmodels\undead\udeathsmall\udeathsmall.mdx** stores 248 triangles. These are different authoring mechanisms within the same broad use category.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| objects\spawnmodels\other\humanbloodcinematiceffect\humanbloodcinematiceffect.mdx | 0 | 0 | 0 | 0 | 1.68 | — | [pictures](D:/Codex/sd-research/captures/models/native-sd-5D05BFA24CBAD06BEA7E2412A0FF4A9E/index.html) |
| objects\spawnmodels\orc\orcblood\orcbloodpeon.mdx | 0 | 0 | 0 | 0 | 2.69 | — | [pictures](D:/Codex/sd-research/captures/models/native-sd-65D4E8835EB798478457A2A48AF63B5A/index.html) |
| objects\spawnmodels\undead\udeathsmall\udeathsmall.mdx | 248 | 240 | 8 | 1 | 20.73 | 1.46 | [pictures](D:/Codex/sd-research/captures/models/native-sd-9DCEF03DF75AC2EDF2A3A16046E66A20/index.html) |

| Source model | Legacy emitters | ParticleEmitter2 | Popcorn | Ribbon emitters | Sequences |
| --- | --- | --- | --- | --- | --- |
| objects\spawnmodels\other\humanbloodcinematiceffect\humanbloodcinematiceffect.mdx | 0 | 1 | 0 | 0 | Stand 5,500ms |
| objects\spawnmodels\orc\orcblood\orcbloodpeon.mdx | 0 | 1 | 0 | 0 | Stand 4,733ms |
| objects\spawnmodels\undead\udeathsmall\udeathsmall.mdx | 0 | 4 | 0 | 3 | Birth 2,867ms |

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 93 | 0 / 0 / 46 | 0 | 3.65 |

The body count excludes particles generated during playback. It describes stored mesh in **objects\spawnmodels\other\humanbloodcinematiceffect\humanbloodcinematiceffect.mdx**, **objects\spawnmodels\orc\orcblood\orcbloodpeon.mdx**, **objects\spawnmodels\undead\udeathsmall\udeathsmall.mdx**; it does not estimate peak particles, translucent overdraw or a short flash that falls outside the sampled frame.

Source records: native-sd-5D05BFA24CBAD06BEA7E2412A0FF4A9E, native-sd-65D4E8835EB798478457A2A48AF63B5A, native-sd-9DCEF03DF75AC2EDF2A3A16046E66A20. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
