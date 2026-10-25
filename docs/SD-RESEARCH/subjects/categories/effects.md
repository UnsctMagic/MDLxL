# Effects: zero stored triangles is not zero authored content

**abilities\spells\other\stampede\stampedemissiledeath.mdx** stores 0 mesh triangles and the emitter counts shown below. **abilities\spells\other\righteousfury\righteousfury.mdx** stores 8,448 triangles. These are different authoring mechanisms within the same broad use category.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| abilities\spells\other\stampede\stampedemissiledeath.mdx | 0 | 0 | 0 | 0 | 5.21 | — | [pictures](D:/Codex/sd-research/captures/models/native-sd-859EB8438611E0D6917A1580EEC51C2E/index.html) |
| abilities\spells\orc\commandaura\commandauratarget.mdx | 4 | 4 | 0 | 1 | 2.16 | 0.00 | [pictures](D:/Codex/sd-research/captures/models/native-sd-7ED1EFDEDD6FA991470D002DAA06FC87/index.html) |
| abilities\spells\other\righteousfury\righteousfury.mdx | 8,448 | 8,448 | 0 | 6 | 245.79 | 2.98 | [pictures](D:/Codex/sd-research/captures/models/native-sd-D5E3445B0DF084ACE17089E092E1AFD2/index.html) |

| Source model | Legacy emitters | ParticleEmitter2 | Popcorn | Ribbon emitters | Sequences |
| --- | --- | --- | --- | --- | --- |
| abilities\spells\other\stampede\stampedemissiledeath.mdx | 0 | 4 | 0 | 0 | Birth 4,400ms |
| abilities\spells\orc\commandaura\commandauratarget.mdx | 0 | 0 | 0 | 0 | Stand 2,167ms |
| abilities\spells\other\righteousfury\righteousfury.mdx | 0 | 15 | 0 | 0 | Birth 1,000ms; Stand 1,000ms; Death 1,000ms |

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 293 | 0 / 4 / 120 | 1 | 5.34 |
| hive/sd | 153 | 0 / 40 / 1,282 | 2 | 12.65 |

The body count excludes particles generated during playback. It describes stored mesh in **abilities\spells\other\stampede\stampedemissiledeath.mdx**, **abilities\spells\orc\commandaura\commandauratarget.mdx**, **abilities\spells\other\righteousfury\righteousfury.mdx**; it does not estimate peak particles, translucent overdraw or a short flash that falls outside the sampled frame.

Source records: native-sd-859EB8438611E0D6917A1580EEC51C2E, native-sd-7ED1EFDEDD6FA991470D002DAA06FC87, native-sd-D5E3445B0DF084ACE17089E092E1AFD2. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
