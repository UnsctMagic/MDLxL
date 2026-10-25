# Portraits: separate presentation rather than a cropped unit count

**units\human\footman\footman_portrait.mdx**, **units\orc\grunt\grunt_portrait.mdx**, **units\nightelf\archer\archer_portrait.mdx**, **units\undead\ghoul\ghoul_portrait.mdx** contain 207, 0, 242, 325 sampled body triangles. Their corresponding field models are **units\human\footman\footman.mdx**, **units\orc\grunt\grunt.mdx**, **units\nightelf\archer\archer.mdx**, **units\undead\ghoul\ghoul.mdx**. Each portrait file carries its own animation and camera data.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| units\human\footman\footman_portrait.mdx | 209 | 207 | 0 | 1 | 39.98 | 0.46 | [pictures](D:/Codex/sd-research/captures/models/native-sd-422B73E3D6DA2C3E4ED60B4D6AB5979F/index.html) |
| units\orc\grunt\grunt_portrait.mdx | 219 | 0 | 219 | 0 | 43.51 | — | [pictures](D:/Codex/sd-research/captures/models/native-sd-D8F3F54627284479C13E4363BEE7FA4A/index.html) |
| units\nightelf\archer\archer_portrait.mdx | 244 | 242 | 0 | 1 | 107.60 | 0.40 | [pictures](D:/Codex/sd-research/captures/models/native-sd-502CD7F107624067A23421267150AADA/index.html) |
| units\undead\ghoul\ghoul_portrait.mdx | 327 | 325 | 0 | 1 | 37.51 | 0.65 | [pictures](D:/Codex/sd-research/captures/models/native-sd-5F2C070725B3F4560BB35452A73D249C/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| units\human\footman\footman_portrait.mdx | Portrait 1,466; Portrait 2 2,934; Portrait 3 2,933; Portrait Talk 2,766; Portrait Talk 2 2,766 |
| units\orc\grunt\grunt_portrait.mdx | Base 333; Portrait - 1 3,333; Portrait - 2 4,733; Portrait - 3 5,334; Portrait Talk - 1 2,667; Portrait Talk - 2 2,000 |
| units\nightelf\archer\archer_portrait.mdx | Portrait -1 2,667; Portrait -2 2,667; Portrait Talk -1 2,667; Portrait Talk -2 2,667; Portrait -3 5,000 |
| units\undead\ghoul\ghoul_portrait.mdx | Portrait Talk 1,666; Portrait -1 1,667 |

| Portrait | Cameras | Attachments | Replaceable ID 2 present |
| --- | --- | --- | --- |
| units\human\footman\footman_portrait.mdx | 1 | Chest Ref01 | yes |
| units\orc\grunt\grunt_portrait.mdx | 1 |  | yes |
| units\nightelf\archer\archer_portrait.mdx | 1 |  | yes |
| units\undead\ghoul\ghoul_portrait.mdx | 1 |  | yes |

Replaceable ID 2 is recorded as a format fact. Its presence in these portrait files is not proof of a hero aura; the body metric excludes that material while the pictures preserve its actual presentation.

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 342 | 174 / 288 / 427 | 1 | 32.87 |
| hive/sd | 31 | 219 / 410 / 759 | 3 | 35.77 |


Source records: native-sd-422B73E3D6DA2C3E4ED60B4D6AB5979F, native-sd-D8F3F54627284479C13E4363BEE7FA4A, native-sd-502CD7F107624067A23421267150AADA, native-sd-5F2C070725B3F4560BB35452A73D249C. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
