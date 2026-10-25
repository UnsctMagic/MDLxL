# Architectural wood, stone, and painted stairs

Human Farm, Elven Farm and Orc Barracks all use stair paintings to imply more treads than their geometry contains. Human Farm g2:c12 and Elven Farm g1:c6 each have four triangles and six positions; their UV bounds are exactly equal despite different texture sheets. Their grey tread lines sit on a bent surface with no series of individual risers. Orc Barracks g3:c7 uses eight triangles, adding timber-sided volume around a painted stair face.

| Model and exact part | Triangles | Vertices / positions | Bind size X x Y x Z | UV bounds |
|---|---:|---:|---|---|
| [farm g2:c12](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/index.html) painted stair surface | 4 | 10 / 6 | 39.84 x 40.76 x 50.86 | 0.5, 0.7344, 0.9961, 1 |
| [elvenfarm g1:c6](D:/Codex/sd-research/captures/models/native-sd-5DDCB26506F37C06BAED1437C9D0FA77/index.html) painted stair surface | 4 | 10 / 6 | 40.76 x 39.84 x 50.86 | 0.5, 0.7344, 0.9961, 1 |
| [orcbarracks g3:c7](D:/Codex/sd-research/captures/models/native-sd-A448F47297A0020F61C299AAAC97D80A/index.html) painted stairs with timber sides | 8 | 16 / 8 | 103.63 x 108.79 x 167.04 | 0.3922, 0.201, 0.6549, 0.9949 |
| [farm g2:c1](D:/Codex/sd-research/captures/models/native-sd-B0E940AAD91D4347FFD54D2AFDB4EADB/index.html) stone foundation shell | 8 | 14 / 8 | 160.64 x 152.81 x 90.14 | 0.5, 0.7695, 0.9961, 1 |
| [humanbarracks g2:c6](D:/Codex/sd-research/captures/models/native-sd-179CDF9433D7D934FDCD203296897A43/index.html) square tower wall shell | 24 | 39 / 16 | 107.11 x 102.81 x 151.83 | -0.0003, 0.0724, 0.3679, 1 |
| [humanbarracks g2:c8](D:/Codex/sd-research/captures/models/native-sd-179CDF9433D7D934FDCD203296897A43/index.html) battlement wall section | 25 | 51 / 24 | 80.52 x 68.51 x 91.85 | -0.0005, 0.0039, 0.998, 1 |
| [orcbarracks g1:c4](D:/Codex/sd-research/captures/models/native-sd-A448F47297A0020F61C299AAAC97D80A/index.html) stone support pillar | 10 | 12 / 8 | 53.25 x 47.79 x 111.24 | 0, 0, 0.3216, 0.3922 |
| [watchtower g1:c4](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/index.html) slender timber brace | 6 | 8 / 6 | 13.47 x 63.42 x 61.9 | 0.2524, 0.002, 0.3131, 0.2485 |
| [watchtower g1:c5](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/index.html) tall bound timber post | 8 | 8 / 8 | 29.62 x 44.85 x 109.19 | 0.0048, 0.2505, 0.0841, 0.7402 |
| [watchtower g1:c8](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/index.html) short capped timber post | 10 | 16 / 8 | 33.61 x 48.44 x 67.13 | 0.0054, 0.3002, 0.3647, 0.7402 |
| [watchtower g1:c35](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/index.html) rope card | 2 | 4 / 4 | 4.05 x 4.18 x 26.92 | 0, 0.9198, 0.0157, 1 |

Human Farm's foundation has eight triangles and eight positions; rough stone blocks are painted on an open shell. The Human Barracks entrance g2:c1 uses 16 triangles to preserve a real arch opening. Its 25 triangle side wall sections model crenellation silhouettes, while their masonry joints and window darkness stay on the sheet. Each 24 triangle corner tower shell has an overhanging upper rim, but the many stone courses are painted. These are different choices: an opening that changes the silhouette receives geometry, while a window that only changes the wall's appearance may remain dark paint.

Orc Barracks' six ten-triangle stone pillars reuse the same roughstone-with-timber-rim region of OrcBarraks.blp. Their stones are not individual pieces. Its four six-triangle wooden beams have a row of painted metal studs; the studs are not separate objects. Orc Barracks' skull plaque g1:c25 is also a six-triangle bent board with a skull painting. The nearby shield-and-weapon emblems g1:c1/c11 each occupy one two-triangle alpha card, and the hanging axe head g1:c19 is another two-triangle card. They must not be treated as reusable solid weapon geometry merely because the isolated image looks like a shield or axe.

Orc WatchTower separates its frame into three-sided six-triangle slender braces, four-sided eight-triangle tall posts, and ten-triangle capped short posts. A structural cross-section can therefore change within one model according to the piece. Its twisted rope g1:c35/c36 is a two-triangle card; most rope wraps on posts are painted directly into the post texture. WatchTower's two 16 triangle skulls have twelve positions each, modeling the outer head and jaw taper while eye sockets and teeth are dark and pale paint.

![Human Barracks: real arch and crenellation silhouette, painted masonry](D:/Codex/sd-research/captures/models/native-sd-179CDF9433D7D934FDCD203296897A43/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-179CDF9433D7D934FDCD203296897A43/index.html).

![Orc Barracks: broad material masses and some completely flat weapon emblems](D:/Codex/sd-research/captures/models/native-sd-A448F47297A0020F61C299AAAC97D80A/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-A448F47297A0020F61C299AAAC97D80A/index.html).

These conclusions compare the named native components only. The annotation table preserves exact triangles, normal splits, UV splits and capture evidence per piece; it does not generalize one brace count to every Warcraft beam.
