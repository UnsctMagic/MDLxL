# Doodads: palette identity and animation are separate evidence

Official Doodads and skin tables supply this identity; animation names alone do not establish gameplay destructibility. In this active SD-art set, 247 of 1396 contents have a Death sequence. The named references **doodads\terrain\cliffs\cliffsccac1.mdx**, **doodads\terrain\ashentree\ashentree0s.mdx**, **doodads\terrain\shrooms\shrooms2s.mdx**, **doodads\dalaran\structures\dalaranvioletholdarchwayendpiece\dalaranvioletholdarchwayendpiece.mdx** show distinct stored states.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| doodads\terrain\cliffs\cliffsccac1.mdx | 16 | 16 | 0 | 0 | 2.08 | 2.60 | [pictures](D:/Codex/sd-research/captures/models/native-sd-025B54746D20E8941CFB3E472C890199/index.html) |
| doodads\terrain\ashentree\ashentree0s.mdx | 44 | 44 | 0 | 0 | 3.47 | 3.31 | [pictures](D:/Codex/sd-research/captures/models/native-sd-8FCD50196CCDEABE2895C4F8F9EDF867/index.html) |
| doodads\terrain\shrooms\shrooms2s.mdx | 104 | 104 | 0 | 0 | 5.08 | 2.24 | [pictures](D:/Codex/sd-research/captures/models/native-sd-A235C01F82DE21874C23431F4127F075/index.html) |
| doodads\dalaran\structures\dalaranvioletholdarchwayendpiece\dalaranvioletholdarchwayendpiece.mdx | 69,285 | 18,858 | 0 | 1 | 3274.08 | 7.58 | [pictures](D:/Codex/sd-research/captures/models/native-sd-4BC367267FF8D5F92C7EC7358DA555AA/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| doodads\terrain\cliffs\cliffsccac1.mdx | Stand 3,333 |
| doodads\terrain\ashentree\ashentree0s.mdx | stand 1,000; stand hit 300; death 1,500; Birth 3,000; Spell EatTree 2,000 |
| doodads\terrain\shrooms\shrooms2s.mdx | stand 1,000; stand hit 300; death 1,500; Birth 3,000; Spell EatTree 2,000 |
| doodads\dalaran\structures\dalaranvioletholdarchwayendpiece\dalaranvioletholdarchwayendpiece.mdx | Stand 1 967 |

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 1396 | 10 / 44 / 212 | 1 | 3.78 |
| hive/sd | 8 | 120 / 120 / 242 | 3 | 14.17 |

The largest named reference, **doodads\dalaran\structures\dalaranvioletholdarchwayendpiece\dalaranvioletholdarchwayendpiece.mdx**, has 69,285 file triangles and 18,858 sampled LOD0 body triangles. This source remains in the active set after the recorded art-tier exceptions are removed. Its measured size is a population example, not a proposed polygon target.

Source records: native-sd-025B54746D20E8941CFB3E472C890199, native-sd-8FCD50196CCDEABE2895C4F8F9EDF867, native-sd-A235C01F82DE21874C23431F4127F075, native-sd-4BC367267FF8D5F92C7EC7358DA555AA. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
