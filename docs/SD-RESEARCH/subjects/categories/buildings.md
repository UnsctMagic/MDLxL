# Buildings: several building stages can occupy one MDX

**buildings\human\townhall\townhall.mdx**, **buildings\orc\greathall\greathall.mdx**, **buildings\undead\necropolis\necropolis.mdx** contain 3,220, 2,707, 1,242 triangles in their files, while the sampled bodies use 225, 482, 278. Their authored sequence names include Upgrade First and Upgrade Second. Counting every geoset as one visible building overstates these samples by factors of 14.31, 5.62, 4.47.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| buildings\human\townhall\townhall.mdx | 3,220 | 225 | 2,995 | 2 | 289.06 | 5.05 | [pictures](D:/Codex/sd-research/captures/models/native-sd-7BD5E75DF150BB66269D99B8A5B3358C/index.html) |
| buildings\orc\greathall\greathall.mdx | 2,707 | 482 | 2,225 | 2 | 196.98 | 3.74 | [pictures](D:/Codex/sd-research/captures/models/native-sd-55B31DD1FD14BD44E6BBFC66584FF533/index.html) |
| buildings\undead\necropolis\necropolis.mdx | 1,242 | 278 | 964 | 1 | 94.24 | 3.87 | [pictures](D:/Codex/sd-research/captures/models/native-sd-7AFDE9CA78C7B80164F7DB08F2334524/index.html) |
| buildings\nightelf\treeoflife\treeoflife.mdx | 1,531 | 698 | 833 | 1 | 359.24 | 2.69 | [pictures](D:/Codex/sd-research/captures/models/native-sd-2EA4837CE66553BC3C15DD147D1CAF6B/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| buildings\human\townhall\townhall.mdx | Birth 60,000; Stand 333; Stand Work 5,333; Portrait -1 3,334; Birth Upgrade First 60,000; Stand Upgrade First 167; Stand Work Upgrade First 2,000; Portrait Upgrade First 1,000; Birth Upgrade Second 60,000; Stand Upgrade Second 333; Stand Work Upgrade Second 2,000; Portrait Upgrade Second 3,334; Death 3,167; Decay 60,000 |
| buildings\orc\greathall\greathall.mdx | birth 60,000; Stand Work 3,333; stand 333; Death 2,333; Decay 60,000; Stand Upgrade First 25,433; Stand Work Upgrade First 6,667; Stand Upgrade Second 37,567; Stand Work Upgrade Second 10,000; Portrait -1 12,000; Portrait Upgrade First 12,000; Portrait Upgrade Second 12,000; Birth Upgrade First 60,000; Birth Upgrade Second 60,000 |
| buildings\undead\necropolis\necropolis.mdx | birth 60,000; Stand 3,334; Stand Work 2,166; Portrait 3,333; Birth Upgrade First 60,000; Stand Upgrade First 3,333; Stand Work Upgrade First 2,166; Portrait Upgrade First 1,667; Death 1,500; Decay 60,000; Birth Upgrade Second 60,000; Stand Upgrade Second 3,333; Stand Work Upgrade Second 2,166; Portrait Upgrade Second 1,667 |
| buildings\nightelf\treeoflife\treeoflife.mdx | Stand Upgrade First Second 2,000; Walk 1,167; Morph 2,000; stand birth alternate work upgrade first second 3,333; hold 1,000; Stand Alternate Upgrade First Second 1,667; Morph Alternate 2,000; Attack 1,000; Death 3,334; Birth Alternate 60,000; Death Alternate 2,767; Decay Alternate 33; Decay 60,000; Spell Eat Tree 3,000; ATTACK ALTERNATE 1,000 |

TownHall's Birth, Birth Upgrade First and Birth Upgrade Second each last 60,000 milliseconds. Necropolis names a BirthLink attachment and Sprite RallyPoint Ref; TownHall names Sprite First Ref through Sprite Fifth Ref plus its rally point. These explicit hooks accompany the painted structure and staged forms.

| Measured set | Models | Body triangles p10 / median / p90 | Median diffuse paths | Median file KiB |
| --- | --- | --- | --- | --- |
| blizzard/sd | 164 | 94 / 267 / 582 | 1 | 34.28 |
| hive/sd | 139 | 212 / 859 / 3,896 | 5 | 154.65 |

GreatHall's sample is Stand Work, the first authored Stand variant. This comparison describes the recorded poses; it is not a claim that every upgrade or animation frame has the same visible triangle count.

Source records: native-sd-7BD5E75DF150BB66269D99B8A5B3358C, native-sd-55B31DD1FD14BD44E6BBFC66584FF533, native-sd-7AFDE9CA78C7B80164F7DB08F2334524, native-sd-2EA4837CE66553BC3C15DD147D1CAF6B. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
