# Heroes: identity and animation do not require thousands of body triangles

**units\human\heroarchmage\heroarchmage.mdx**, **units\orc\heroblademaster\heroblademaster.mdx**, **units\undead\herodeathknight\herodeathknight.mdx**, **units\nightelf\herodemonhunter\herodemonhunter.mdx** allocate 512, 424, 595, 453 triangles to their sampled bodies. Their model files occupy 178.74 KiB, 180.43 KiB, 156.76 KiB, 380.74 KiB and carry 10, 14, 8, 22 named sequences. Polygon count and authored animation data measure different resources.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| units\human\heroarchmage\heroarchmage.mdx | 530 | 512 | 0 | 1 | 178.74 | 1.78 | [pictures](D:/Codex/sd-research/captures/models/native-sd-D6B47FED4FB56F46EB576AF7F0DC98D7/index.html) |
| units\orc\heroblademaster\heroblademaster.mdx | 550 | 424 | 116 | 1 | 180.43 | 1.95 | [pictures](D:/Codex/sd-research/captures/models/native-sd-C88B7CBDA1F975C9F06EE463EF0CDF70/index.html) |
| units\undead\herodeathknight\herodeathknight.mdx | 617 | 595 | 6 | 1 | 156.76 | 1.50 | [pictures](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html) |
| units\nightelf\herodemonhunter\herodemonhunter.mdx | 1,259 | 453 | 766 | 1 | 380.74 | 1.55 | [pictures](D:/Codex/sd-research/captures/models/native-sd-F158FE60187900CF9D03B53FEFF39C61/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| units\human\heroarchmage\heroarchmage.mdx | Walk 700; Stand 1 2,833; Stand 2 3,333; Stand Victory 2,233; Attack - 1 1,400; Stand 3 3,667; Spell 2,700; Death 2,800; Dissipate 2,000; Stand Channel 1,000 |
| units\orc\heroblademaster\heroblademaster.mdx | Stand - 2 3,534; Stand cinematic 5,467; Attack 1,167; Attack Slam 1,133; Stand - 4 1,534; Death 1,900; Walk 733; Stand 1,167; Attack 2 1,134; Stand Ready 1,400; Stand Victory 3,100; Dissipate 3,367; Portrait 1 1,700; Attack Walk Stand Spin 433 |
| units\undead\herodeathknight\herodeathknight.mdx | Walk 567; Stand -2 2,833; Stand -1 3,666; Spell - 1 1,500; Attack -1 967; Death 2,167; Stand Ready 1,500; Dissipate 2,000 |
| units\nightelf\herodemonhunter\herodemonhunter.mdx | Stand 1,400; Stand 2 2,000; Stand 3 4,033; Stand 4 5,734; Stand Ready 766; Attack 900; Attack 2 900; Death 4,100; Walk 867; Spell Throw 900; Dissipate 2,000; Spell 766; Stand Channel 1,233; Stand Alternate 933; Walk Alternate 766; Attack Alternate 933; Spell Alternate 933; Stand Ready Alternate 733; Death Alternate 1,767; Dissipate Alternate 2,000; Morph 1,500; Morph Alternate 1,466 |

**units\human\heroarchmage\heroarchmage.mdx**, **units\orc\heroblademaster\heroblademaster.mdx**, **units\undead\herodeathknight\herodeathknight.mdx**, **units\nightelf\herodemonhunter\herodemonhunter.mdx** contain explicit Dissipate sequences; the table preserves their durations. Hero identity comes from official object IDs and palette entries. The four-triangle HeroBloodSphere effect is kept outside this category despite its filename.

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 62 | 437 / 529 / 706 | 1 | 243.94 |
| hive/sd | 98 | 48 / 891 / 1,885 | 4 | 157.87 |


Source records: native-sd-D6B47FED4FB56F46EB576AF7F0DC98D7, native-sd-C88B7CBDA1F975C9F06EE463EF0CDF70, native-sd-84EAB8DFA355A0924FB44500842C42F1, native-sd-F158FE60187900CF9D03B53FEFF39C61. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
