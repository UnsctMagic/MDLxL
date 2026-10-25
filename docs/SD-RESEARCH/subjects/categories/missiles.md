# Missiles: zero stored triangles is not zero authored content

**abilities\spells\items\orbcorruption\orbcorruptionmissile.mdx** stores 0 mesh triangles and the emitter counts shown below. **units\creeps\earthpandarenbrewmaster\earthpandarenbrewmaster_missile.mdx** stores 485 triangles. These are different authoring mechanisms within the same broad use category.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| abilities\spells\items\orbcorruption\orbcorruptionmissile.mdx | 0 | 0 | 0 | 0 | 6.20 | — | [pictures](D:/Codex/sd-research/captures/models/native-sd-05FBBF44B02D73F24377A49CA2D42970/index.html) |
| abilities\weapons\flyingmachine\flyingmachinemissile.mdx | 36 | 24 | 12 | 1 | 9.45 | 0.32 | [pictures](D:/Codex/sd-research/captures/models/native-sd-5BDFC52B3BAFA282D7CED6CA9E9F2362/index.html) |
| units\creeps\earthpandarenbrewmaster\earthpandarenbrewmaster_missile.mdx | 485 | 485 | 0 | 2 | 28.36 | 1.02 | [pictures](D:/Codex/sd-research/captures/models/native-sd-93526DDCF5A5A9382747B5B1E5CDE333/index.html) |

| Source model | Legacy emitters | ParticleEmitter2 | Popcorn | Ribbon emitters | Sequences |
| --- | --- | --- | --- | --- | --- |
| abilities\spells\items\orbcorruption\orbcorruptionmissile.mdx | 0 | 1 | 0 | 3 | Birth 67ms; Stand 533ms; Death 966ms |
| abilities\weapons\flyingmachine\flyingmachinemissile.mdx | 0 | 3 | 0 | 0 | Birth 2,633ms; Stand 100ms; Death 1,966ms |
| units\creeps\earthpandarenbrewmaster\earthpandarenbrewmaster_missile.mdx | 0 | 0 | 0 | 0 | Birth 500ms; stand 1,000ms; Death 500ms |

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 160 | 0 / 24 / 102 | 2 | 7.37 |
| hive/sd | 24 | 0 / 1 / 42 | 1 | 10.80 |

The body count excludes particles generated during playback. It describes stored mesh in **abilities\spells\items\orbcorruption\orbcorruptionmissile.mdx**, **abilities\weapons\flyingmachine\flyingmachinemissile.mdx**, **units\creeps\earthpandarenbrewmaster\earthpandarenbrewmaster_missile.mdx**; it does not estimate peak particles, translucent overdraw or a short flash that falls outside the sampled frame.

Source records: native-sd-05FBBF44B02D73F24377A49CA2D42970, native-sd-5BDFC52B3BAFA282D7CED6CA9E9F2362, native-sd-93526DDCF5A5A9382747B5B1E5CDE333. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
