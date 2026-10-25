# Campaign and menu scenes: an intentionally different scale of asset

**ui\glues\singleplayer\humancampaign3d\humancampaign3d.mdx**, **ui\glues\singleplayer\orccampaign3d\orccampaign3d.mdx**, **ui\glues\singleplayer\undeadcampaign3d\undeadcampaign3d.mdx** contain 10,309, 12,352, 10,905 file triangles and 50, 30, 17 declared texture paths. These are scene assets outside the unit battlefield presentation. Their painted sheets remain available to the material study and the owner's cross-purpose reuse.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ui\glues\singleplayer\humancampaign3d\humancampaign3d.mdx | 10,309 | 10,309 | 0 | 44 | 774.80 | 138.35 | [pictures](D:/Codex/sd-research/captures/models/native-sd-BE6110E745A39A421BF0ED527E3004C8/index.html) |
| ui\glues\singleplayer\orccampaign3d\orccampaign3d.mdx | 12,352 | 12,352 | 0 | 25 | 660.01 | 108.77 | [pictures](D:/Codex/sd-research/captures/models/native-sd-EAD069961A5E0B0CC62761338527E48D/index.html) |
| ui\glues\singleplayer\undeadcampaign3d\undeadcampaign3d.mdx | 10,905 | 9,333 | 1,572 | 14 | 694.99 | 71.87 | [pictures](D:/Codex/sd-research/captures/models/native-sd-D390C366414853C29EA4F84BD74BE157/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| ui\glues\singleplayer\humancampaign3d\humancampaign3d.mdx | Stand 61,500; Birth 2,700 |
| ui\glues\singleplayer\orccampaign3d\orccampaign3d.mdx | Stand 9,967; Birth 2,400 |
| ui\glues\singleplayer\undeadcampaign3d\undeadcampaign3d.mdx | Stand 13,867; Birth 2,133 |

The original base-namespace inventory contains 72 Glues paths, reducing to 71 distinct contents after alias grouping. HumanReCampaign3D is preserved outside the active SD-art scope, leaving 70 active contents. This namespace also includes tiny login and menu elements, so its global median does not describe a complete campaign scene.

Source records: native-sd-BE6110E745A39A421BF0ED527E3004C8, native-sd-EAD069961A5E0B0CC62761338527E48D, native-sd-D390C366414853C29EA4F84BD74BE157. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
