# Units: the body, the corpse and the file are different budgets

The four ordinary race references **units\human\footman\footman.mdx**, **units\orc\grunt\grunt.mdx**, **units\nightelf\archer\archer.mdx**, **units\undead\ghoul\ghoul.mdx** use 323, 421, 417, 463 triangles for their sampled bodies, respectively. Their complete files contain 372, 688, 449, 1,035. The difference is measured hidden geometry at this pose. The sequence table below preserves the authored death and decay states; a hidden-at-Stand count does not establish that those parts are dispensable.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| units\human\footman\footman.mdx | 372 | 323 | 49 | 1 | 103.13 | 1.00 | [pictures](D:/Codex/sd-research/captures/models/native-sd-3BD0831FAD186C0C08767F15A9663E4B/index.html) |
| units\orc\grunt\grunt.mdx | 688 | 421 | 267 | 1 | 100.69 | 1.00 | [pictures](D:/Codex/sd-research/captures/models/native-sd-1D5D5C34938F91BFC1989A223ABC8096/index.html) |
| units\nightelf\archer\archer.mdx | 449 | 417 | 32 | 1 | 143.53 | 0.94 | [pictures](D:/Codex/sd-research/captures/models/native-sd-3DAA369BA7A21461738BAED6D653E540/index.html) |
| units\undead\ghoul\ghoul.mdx | 1,035 | 463 | 572 | 1 | 277.89 | 0.71 | [pictures](D:/Codex/sd-research/captures/models/native-sd-B87206133D6345080E4C0EF76E51DE83/index.html) |

The installed four-race Normal palette subset contains 55 measured contents. Its body-triangle p10/median/p90 are 305 / 445 / 648. This is narrower than the broader comparison below, which also includes campaign units, special models and the selected community collections.

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 340 | 157 / 399 / 602 | 1 | 115.95 |
| hive/sd | 89 | 316 / 536 / 1,320 | 3 | 129.88 |
| lowpolyworks/sd | 130 | 532 / 826 / 2,230 | 2 | 183.74 |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| units\human\footman\footman.mdx | Stand - 1 1,500; Stand - 2 2,500; Stand Victory 2,333; Stand - 4 5,267; Attack - 1 1,000; Attack - 2 1,000; Walk 800; Stand Defend 1,000; Walk Defend 1,100; Death 3,034; Decay Flesh 60,000; Attack Defend 1,000; Decay Bone 60,000 |
| units\orc\grunt\grunt.mdx | walk 666; Stand - 1 3,000; Attack - 1 967; Death 1,567; Decay Flesh 60,000; Attack - 2 966; Stand - 2 3,333; Stand Victory 1,333; Stand - 3 1,433; Spell 1,434; Stand Ready 966; Decay Bone 60,000 |
| units\nightelf\archer\archer.mdx | Stand 1,166; Stand - 2 2,000; Stand - 3 3,000; Stand - 5 3,700; Death 3,233; Attack - 1 1,000; Attack - 2 1,000; Walk 833; Stand Hit 34; Stand Victory 3,734; Stand Ready 1,133; Decay Flesh 60,000; Decay Bone 60,000 |
| units\undead\ghoul\ghoul.mdx | Stand -2 1,000; Walk 667; Stand 1,000; Attack -2 833; Stand -3 2,667; Attack -1 833; Death 1,667; Decay Flesh 60,000; Decay Bone 60,000; Stand Ready 1,000; Stand Victory 1,500; Stand Channel 1,000; Stand Lumber 1,000; Attack Lumber 833; Walk Lumber 834; Stand Ready Lumber 1,000; Stand Channel Lumber 1,000 |

Footman's raw sampled non-glow LOD0 body is 98.26 model units high. Grunt's installed SD modelscale is 1.1, while Footman's is 1; the raw-height column does not apply object-table scale. The raw mesh and the map's configured size are different measurements. Sources: these two models and official UnitSkin objects hfoo and ogru.

Source records: native-sd-3BD0831FAD186C0C08767F15A9663E4B, native-sd-1D5D5C34938F91BFC1989A223ABC8096, native-sd-3DAA369BA7A21461738BAED6D653E540, native-sd-B87206133D6345080E4C0EF76E51DE83. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
