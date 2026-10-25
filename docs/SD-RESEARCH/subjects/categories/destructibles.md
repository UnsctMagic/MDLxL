# Destructibles: palette identity and animation are separate evidence

Official DestructableData and skin tables supply this identity; the presence of a Death sequence alone is insufficient. In this active SD-art set, 274 of 291 contents have a Death sequence. The named references **doodads\terrain\barrenstree\barrenstree6.mdx**, **doodads\terrain\rockchunks\rockchunks2.mdx**, **doodads\terrain\citybridgesmall135\citybridgesmall135.mdx**, **doodads\barrens\terrain\orgrimmargate_completed\orgrimmargate_completed.mdx** show distinct stored states.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| doodads\terrain\barrenstree\barrenstree6.mdx | 61 | 36 | 25 | 0 | 6.60 | 3.41 | [pictures](D:/Codex/sd-research/captures/models/native-sd-65BE857D459244874187043294D94E82/index.html) |
| doodads\terrain\rockchunks\rockchunks2.mdx | 72 | 72 | 0 | 1 | 7.79 | 1.18 | [pictures](D:/Codex/sd-research/captures/models/native-sd-960BE1E36127BB3011739F7D954AB35A/index.html) |
| doodads\terrain\citybridgesmall135\citybridgesmall135.mdx | 192 | 192 | 0 | 0 | 18.30 | 4.76 | [pictures](D:/Codex/sd-research/captures/models/native-sd-BF3497EEDD45EC5D8789C7CD6C6B5610/index.html) |
| doodads\barrens\terrain\orgrimmargate_completed\orgrimmargate_completed.mdx | 61,603 | 15,488 | 0 | 2 | 2334.61 | 5.33 | [pictures](D:/Codex/sd-research/captures/models/native-sd-B6A0DE29CBE0F77884CBEB81BB38D23C/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| doodads\terrain\barrenstree\barrenstree6.mdx | stand 1,000; stand hit 300; death 1,500; Birth 60,000 |
| doodads\terrain\rockchunks\rockchunks2.mdx | Stand 333; Death 833 |
| doodads\terrain\citybridgesmall135\citybridgesmall135.mdx | Stand 1,200; Death 1,000; Birth 6,667 |
| doodads\barrens\terrain\orgrimmargate_completed\orgrimmargate_completed.mdx | Stand 1 967 |

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 291 | 24 / 72 / 2,971 | 1 | 7.79 |

The largest named reference, **doodads\barrens\terrain\orgrimmargate_completed\orgrimmargate_completed.mdx**, has 61,603 file triangles and 15,488 sampled LOD0 body triangles. This source remains in the active set after the recorded art-tier exceptions are removed. Its measured size is a population example, not a proposed polygon target.

Source records: native-sd-65BE857D459244874187043294D94E82, native-sd-960BE1E36127BB3011739F7D954AB35A, native-sd-BF3497EEDD45EC5D8789C7CD6C6B5610, native-sd-B6A0DE29CBE0F77884CBEB81BB38D23C. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
