# Controlled variants separate silhouette cost from animation cost

Gluma’s Skink High Priest hero and swimless hero have the same 954 triangles and the same multiset of component shape fingerprints. The full version is 370,952 bytes; the swimless version is 286,572 bytes. Six named swim sequences are absent in the smaller file. The unit pair similarly retains 984 triangles while removing seven swim sequences. The worker pair retains 776 triangles while removing eleven. These are controlled comparisons inside one author's variants, not unrelated high/low endpoints.

| First model | Second model | Triangles A/B | Bytes A/B | Sequences A/B | Same component geometry multiset |
|---|---|---:|---:|---:|---|
| lpw-gluma-135399 — Skink High Priest Hero | lpw-gluma-135400 — Skink High Priest Hero (Swimless) | 954/954 | 370,952/286,572 | 20/14 | True |
| lpw-gluma-135401 — Skink High Priest Unit | lpw-gluma-135402 — Skink High Priest Unit (Swimless) | 984/984 | 372,389/287,117 | 22/15 | True |
| lpw-gluma-134840 — Skink Worker | lpw-gluma-134841 — Skink Worker Swimless | 776/776 | 372,914/254,206 | 34/23 | True |
| lpw-gluma-134399 — Blowpipe Skink | lpw-gluma-134404 — Orange Blowpipe Skink | 753/753 | 244,104/244,096 | 19/19 | True |
| lpw-gluma-134400 — Skink Skirmisher | lpw-gluma-134402 — Orange Skink Skirmisher | 863/863 | 264,652/264,612 | 19/19 | True |
| lpw-gluma-137328 — Saurus Warrior | lpw-gluma-137329 — Saurus Warrior Hero | 942/918 | 254,261/255,521 | 21/20 | False |
| lpw-gluma-140895 — Saurus Oldblood Hero | lpw-gluma-140896 — Saurus Oldblood Unit | 1056/1080 | 350,953/345,894 | 20/21 | False |
| lpw-gluma-160458 — Dark Elf Beastmaster unit | lpw-gluma-160459 — Dark Elf Beastmaster hero | 602/580 | 229,685/231,796 | 18/17 | False |

The blue and orange Blowpipe Skink variants retain 753 triangles; the corresponding Skirmisher variants retain 863. Their colour identity can therefore change without a larger mesh. The fingerprint comparison deliberately ignores material, rig and animation, so it proves shape similarity only.

Saurus Warrior unit and hero make a different point: the unit has 942 total triangles and 904 sample-visible; the hero has 918 total and 916 sample-visible. The unit includes Decay Bone/Flesh while the hero has Dissipate. A total that includes hidden death geometry can move in the opposite direction from the living sampled surface. The exact sample sequence/frame is stored with every metric. Neither number is a universal in-game visibility count.

The Black Orc Warboss unit/hero pair changes from 2,181 to 2,187 triangles. These six extra triangles cannot by themselves explain the hero's complete presentation: attachments, materials, sequence names and effect setup are separate properties. The datasets retain those properties rather than treating a hero as simply a larger polygon count.
