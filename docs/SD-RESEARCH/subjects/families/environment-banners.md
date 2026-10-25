# Banners, poles, and decoration cards

BannerHuman0 and BannerOrc0 share Textures/Doodads0.blp. Their blue and red cloth are painted colours, not proof of team colour: neither doodad uses a team-colour replacement texture. In contrast, the Human Barracks and Orc WatchTower banners use team-colour material treatment. This distinction matters when a region is chosen for its apparent red cloth.

| Model and exact part | Triangles | Vertices / positions | Bind size X x Y x Z | UV bounds |
|---|---:|---:|---|---|
| [bannerhuman0 g1:c1](D:/Codex/sd-research/captures/models/native-sd-D17EDDF0D916E7448FCDE25C4BE7C7C6/index.html) wood banner mast | 7 | 18 / 6 | 7.43 x 7.06 x 197.45 | 0.9647, 0.5059, 0.9961, 1 |
| [bannerhuman0 g1:c7](D:/Codex/sd-research/captures/models/native-sd-D17EDDF0D916E7448FCDE25C4BE7C7C6/index.html) Alliance banner cloth | 5 | 9 / 7 | 0.0 x 40.6 x 73.67 | 0.251, 0.251, 0.498, 0.498 |
| [bannerhuman0 g1:c8](D:/Codex/sd-research/captures/models/native-sd-D17EDDF0D916E7448FCDE25C4BE7C7C6/index.html) wood banner crossbar | 8 | 21 / 6 | 4.08 x 62.95 x 4.72 | 0.9647, 0.5059, 0.9961, 1 |
| [bannerhuman0 g1:c3](D:/Codex/sd-research/captures/models/native-sd-D17EDDF0D916E7448FCDE25C4BE7C7C6/index.html) crossed steel finial card | 3 | 5 / 5 | 0 x 19.43 x 8.77 | 0.9451, 0, 0.9961, 0.1843 |
| [bannerorc0 g1:c6](D:/Codex/sd-research/captures/models/native-sd-46443B47D692A634CB1A8DA049A52B29/index.html) wood banner mast | 7 | 18 / 6 | 11.47 x 14.86 x 196.3 | 0.9647, 0.5059, 0.9961, 1 |
| [bannerorc0 g1:c3](D:/Codex/sd-research/captures/models/native-sd-46443B47D692A634CB1A8DA049A52B29/index.html) Horde banner cloth | 6 | 8 / 8 | 0.0 x 71.95 x 72.93 | 0, 0.2471, 0.2471, 0.4941 |
| [humanbarracks g1:c1](D:/Codex/sd-research/captures/models/native-sd-179CDF9433D7D934FDCD203296897A43/index.html) Lordaeron banner | 5 | 11 / 7 | 17.17 x 26.08 x 52.35 | 0.8767, 0.3483, 1, 0.4716 |
| [watchtower g2:c1](D:/Codex/sd-research/captures/models/native-sd-A8FF19FAC4AD4C5F4E559D583F75E7BD/index.html) Horde banner | 6 | 10 / 8 | 12.16 x 23.74 x 28.85 | 0.2466, 0.7436, 0.411, 0.9145 |

BannerHuman0's cloth is five triangles and seven positions, occupying u0.25098–0.498039,v0.25098–0.498039. BannerOrc0's cloth is six triangles and eight positions in the adjacent lower-left patch, u0–0.247059,v0.247059–0.494118. The Human hanging cloth measures 73.67 units in height and 40.60 across; the Orc panel is 72.93 high and 71.95 across. The differing silhouette comes from panel proportions and edge shape, while emblem, fold highlights and dark creases are painted.

Both doodads use seven-triangle three-sided vertical masts and eight-triangle three-sided crossbars. All four parts sample the same narrow wood-and-binding strip, u0.964706–0.996078,v0.505882–1. BannerHuman0 adds four three-triangle planar metal finial cards, crossed in perpendicular planes. Bright steel facets are texture painting on cards. Its five-triangle gold tassel is also planar. BannerOrc0 instead has a 23 triangle pale finial; the sampled views used here establish a bone-coloured volume, but do not establish enough frontal detail to label it a skull with high confidence.

![Human banner: blue painted panel and three-sided poles](D:/Codex/sd-research/captures/models/native-sd-D17EDDF0D916E7448FCDE25C4BE7C7C6/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-D17EDDF0D916E7448FCDE25C4BE7C7C6/index.html).

![Orc banner: wider fixed-red panel on the same atlas](D:/Codex/sd-research/captures/models/native-sd-46443B47D692A634CB1A8DA049A52B29/view-1.webp)

[Four angles, wireframe, exact UV overlays and isolated parts](D:/Codex/sd-research/captures/models/native-sd-46443B47D692A634CB1A8DA049A52B29/index.html).

The UV coordinates refer to actual measured triangles. They are not guaranteed clean rectangles: the exact masks and neighbouring painted content remain visible in the source overlays. These 14 environment models received 156 visually reviewed component annotations; this chapter does not claim all corpus banners have been individually reviewed.
