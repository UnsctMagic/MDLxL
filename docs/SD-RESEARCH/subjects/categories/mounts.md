# Mounted units: rider and mount have separate attachment vocabularies

**units\human\heroarchmage\heroarchmage.mdx**, **units\undead\herodeathknight\herodeathknight.mdx**, **units\human\knight\knight.mdx**, **units\orc\wolfrider\wolfrider.mdx** name rider anchors such as Hand Right Ref and mount anchors such as Head Mount, Chest Mount and rear feet. Their composite body counts are below. These are whole mounted models; they are not isolated horse or wolf budgets.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| units\human\gryphonrider\gryphonrider.mdx | 535 | 431 | 104 | 1 | 225.80 | 1.47 | [pictures](D:/Codex/sd-research/captures/models/native-sd-1095786D02723A2B1093D23037552825/index.html) |
| units\human\heroarchmage\heroarchmage.mdx | 530 | 512 | 0 | 1 | 178.74 | 1.78 | [pictures](D:/Codex/sd-research/captures/models/native-sd-D6B47FED4FB56F46EB576AF7F0DC98D7/index.html) |
| units\human\knight\knight.mdx | 1,104 | 489 | 615 | 1 | 303.78 | 1.51 | [pictures](D:/Codex/sd-research/captures/models/native-sd-7503B2C77940A164DEF7DC704AF9413C/index.html) |
| units\nightelf\heromoonpriestess\heromoonpriestess.mdx | 486 | 460 | 0 | 1 | 113.50 | 1.48 | [pictures](D:/Codex/sd-research/captures/models/native-sd-355CD49F1E15EE34B958EB51A5826338/index.html) |
| units\nightelf\huntress\huntress.mdx | 651 | 523 | 128 | 1 | 177.04 | 1.29 | [pictures](D:/Codex/sd-research/captures/models/native-sd-C5CABE52A4BC2BFE182A625BA81ACF0C/index.html) |
| units\nightelf\riddenhippogryph\riddenhippogryph.mdx | 625 | 621 | 4 | 2 | 203.94 | 1.32 | [pictures](D:/Codex/sd-research/captures/models/native-sd-4DEF29B65F06B1274B38FCA9065D4384/index.html) |
| units\orc\battroll\battroll.mdx | 603 | 516 | 87 | 3 | 211.75 | 1.00 | [pictures](D:/Codex/sd-research/captures/models/native-sd-73DE6AB4FBF6BDAB768CFAF14B85EF4B/index.html) |
| units\orc\herofarseer\herofarseer.mdx | 566 | 548 | 0 | 1 | 131.09 | 1.76 | [pictures](D:/Codex/sd-research/captures/models/native-sd-1AF9595992741472794375A606C4A28F/index.html) |
| units\orc\kotobeast\kotobeast.mdx | 669 | 599 | 70 | 1 | 239.98 | 1.70 | [pictures](D:/Codex/sd-research/captures/models/native-sd-D2160856B286FED2ED023A5FDA316CBE/index.html) |
| units\orc\wolfrider\wolfrider.mdx | 595 | 461 | 134 | 1 | 153.59 | 1.73 | [pictures](D:/Codex/sd-research/captures/models/native-sd-EFC3B66C1E780CA52C6595F27318D2FB/index.html) |
| units\undead\herodeathknight\herodeathknight.mdx | 617 | 595 | 6 | 1 | 156.76 | 1.50 | [pictures](D:/Codex/sd-research/captures/models/native-sd-84EAB8DFA355A0924FB44500842C42F1/index.html) |

| Source model | Mount / rear-foot attachments |
| --- | --- |
| units\human\gryphonrider\gryphonrider.mdx | Head Mount Ref; Chest Mount Ref; Foot Left Rear Ref; Foot Right Rear Ref; Chest Mount Rear Ref; Chest Mount Left Ref; Chest Mount Right Ref |
| units\human\heroarchmage\heroarchmage.mdx | Head Mount - Ref; Chest Mount Ref; Chest Mount Left Ref; Chest Mount Right Ref; Foot Left Rear Ref; Foot Right Rear Ref; Chest Mount Rear Ref |
| units\human\knight\knight.mdx | Head Mount - Ref; Chest Mount Ref; Chest Mount Left Ref; Chest Mount Right Ref; Foot Right Rear Ref; Foot Left Rear Ref; Chest Mount Rear Ref |
| units\nightelf\heromoonpriestess\heromoonpriestess.mdx | Head Mount - Ref; Chest Mount Ref; Chest Mount Right Ref; Chest Mount Left Ref; Chest Mount Rear Ref; Foot Left Rear Ref; Foot Right Rear Ref |
| units\nightelf\huntress\huntress.mdx | Head Mount - Ref; Foot Left Rear Ref; Foot Right Rear Ref; Chest Mount Rear Ref; Chest Mount Left Ref; Chest Mount Right Ref; Chest Mount Ref |
| units\nightelf\riddenhippogryph\riddenhippogryph.mdx | Chest Mount Ref |
| units\orc\battroll\battroll.mdx | Head Mount Ref; Chest Mount Ref |
| units\orc\herofarseer\herofarseer.mdx | Chest Mount Ref; Chest Mount Right Ref; Chest Mount Left Ref; Chest Mount Rear Ref; Foot Right Rear Ref; Foot Left Rear Ref; Head Mount - Ref |
| units\orc\kotobeast\kotobeast.mdx | Foot Right Rear Ref; Foot Left Rear Ref; Chest Mount Rear Ref; Chest Mount Right Ref; Chest Mount Left Ref; Head Mount - Ref; Chest Mount Ref |
| units\orc\wolfrider\wolfrider.mdx | Foot Right Rear Ref; Foot Left Rear Ref; Chest Mount Ref; Chest Mount Right Ref; Chest Mount Left Ref; Chest Mount Rear Ref; Head Mount - Ref |
| units\undead\herodeathknight\herodeathknight.mdx | Foot Right Rear Ref; Foot Left Rear Ref; Chest Mount Rear Ref; Head Mount - Ref; Chest Mount Ref; Chest Mount Right Ref; Chest Mount Left Ref |

This named reference subset uses official objects hkni, hgry, orai, okod, otbr, esen, ehpr, Hamg, Udea, Ofar and Emoo. It does not claim automatic recognition of every rider. Knight has 17 attachments; BatTroll has 9. The differing lists are preserved rather than replaced with a universal mount template.

Source records: native-sd-1095786D02723A2B1093D23037552825, native-sd-D6B47FED4FB56F46EB576AF7F0DC98D7, native-sd-7503B2C77940A164DEF7DC704AF9413C, native-sd-355CD49F1E15EE34B958EB51A5826338, native-sd-C5CABE52A4BC2BFE182A625BA81ACF0C, native-sd-4DEF29B65F06B1274B38FCA9065D4384, native-sd-73DE6AB4FBF6BDAB768CFAF14B85EF4B, native-sd-1AF9595992741472794375A606C4A28F, native-sd-D2160856B286FED2ED023A5FDA316CBE, native-sd-EFC3B66C1E780CA52C6595F27318D2FB, native-sd-84EAB8DFA355A0924FB44500842C42F1. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
