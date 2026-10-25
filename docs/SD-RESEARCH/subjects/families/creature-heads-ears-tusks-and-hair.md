# Heads, ears, tusks, and hair receive different shares of the mesh

The native Gargoyle devotes 191 triangles to its connected head and swept hair, more than the 163 triangles in its connected headless body/limbs/wing roots. Dryad has 114 triangles in its head and leaf-green hair versus 148 in its connected headless body. HeadHunter gives its separate head 113 triangles while its two trousered legs and feet share 97. These component boundaries reveal where detail was spent, but they do not prove that every individual face inside the head component is facial anatomy: hair can be part of the same piece.

| Source model and part | Triangles | Vertices / positions | Raw dimensions X x Y x Z | Measured texture region bounds |
|---|---:|---:|---|---|
| [gargoyle g1:c2](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html) head and swept hair | 191 | 249 / 112 | 37.96 x 20.35 x 53.99 | 0, 0.0112, 0.7092, 0.7532 |
| [gargoyle g1:c1](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html) connected headless body and wing roots | 163 | 185 / 98 | 67.07 x 97.96 x 90.9 | 0.1039, 0.0535, 0.9966, 0.9986 |
| [dryad g1:c2](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/index.html) head and leaf-green hair | 114 | 68 / 61 | 18.76 x 12.33 x 18.99 | 0.5021, 0.0013, 0.735, 0.4 |
| [dryad g1:c1](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/index.html) headless centauroid body and arms | 148 | 138 / 78 | 74.42 x 52.38 x 92.51 | 0.0028, 0.0027, 0.487, 0.7858 |
| [headhunter g2:c2](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/index.html) troll head | 113 | 133 / 64 | 37.87 x 18.5 x 24.11 | 0.1568, 0.0035, 0.9956, 0.5977 |
| [headhunter g2:c4](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/index.html) trousered legs and feet | 97 | 116 / 52 | 43.91 x 51.11 x 97.88 | 0.0187, 0.2429, 0.7034, 0.9997 |
| [witchdoctor g1:c2](D:/Codex/sd-research/captures/models/native-sd-B6342BB397AD19DA9CEE5681CE2670F0/index.html) troll head | 80 | 81 / 51 | 27.11 x 15.57 x 23.07 | 0.7296, 0.4701, 0.9953, 0.997 |
| [herodemonhunter g1:c2](D:/Codex/sd-research/captures/models/native-sd-F158FE60187900CF9D03B53FEFF39C61/index.html) head and long hair | 141 | 118 / 81 | 38.42 x 23.37 x 62.61 | 0.6804, 0.0028, 1.0426, 0.7482 |
| [herodemonhunter g1:c1](D:/Codex/sd-research/captures/models/native-sd-F158FE60187900CF9D03B53FEFF39C61/index.html) topknot hair | 27 | 32 / 16 | 21.31 x 6.83 x 14.03 | 0.703, 0.0647, 0.9212, 0.3192 |

HeadHunter's head contains 64 positions and 113 triangles before its separate ears and tusks are counted. WitchDoctor's smaller head has 51 positions and 80 triangles. Each HeadHunter tusk has 15 triangles/ten positions and a pronounced bend; WitchDoctor's corresponding tusks have nine triangles/seven positions and a shorter wedge-like shape. Ochre lengthwise highlights, dark ridges and a pink gum base supply the small texture details in both. This is a narrow family comparison with distinct shapes, not a range pooled from unrelated blades or horns.

| Source model and part | Triangles | Vertices / positions | Raw dimensions X x Y x Z | Measured texture region bounds |
|---|---:|---:|---|---|
| [headhunter g2:c3](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/index.html) curved troll tusk | 15 | 10 / 10 | 9.22 x 6.79 x 13.54 | 0.5641, 0.0035, 0.6606, 0.2171 |
| [witchdoctor g1:c6](D:/Codex/sd-research/captures/models/native-sd-B6342BB397AD19DA9CEE5681CE2670F0/index.html) short troll tusk | 9 | 8 / 7 | 11.75 x 6.2 x 8.57 | 0.5949, 0.4872, 0.6914, 0.6732 |
| [headhunter g2:c1](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/index.html) pointed troll ear | 4 | 8 / 6 | 21.27 x 13.35 x 16.96 | 0.1598, 0.8353, 0.2867, 0.993 |
| [witchdoctor g1:c11](D:/Codex/sd-research/captures/models/native-sd-B6342BB397AD19DA9CEE5681CE2670F0/index.html) pointed troll ear | 4 | 8 / 6 | 15.79 x 12.14 x 18.96 | 0.3255, 0.8301, 0.4543, 0.9717 |
| [dryad g1:c6](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/index.html) long pointed elf ear | 6 | 5 / 5 | 35.89 x 10.07 x 9.19 | 0.5409, 0.3051, 0.7478, 0.5208 |
| [druidoftheclaw g1:c2](D:/Codex/sd-research/captures/models/native-sd-276600FF85FAD41DA35BBD95336D419A/index.html) long pointed elf ear | 9 | 10 / 7 | 49.46 x 19.01 x 20.93 | 0.3382, 0.278, 0.3965, 0.5225 |
| [herodemonhunter g1:c7](D:/Codex/sd-research/captures/models/native-sd-F158FE60187900CF9D03B53FEFF39C61/index.html) pointed elf ear | 8 | 9 / 9 | 32.1 x 16.17 x 9.96 | 0.6901, 0.3281, 0.8377, 0.6413 |

HeadHunter and WitchDoctor ears both use four triangles/six positions per ear, but their outlines and dimensions differ. The three Night Elf examples also differ: Dryad has six triangles/five positions, DemonHunter eight/nine, and DruidOfTheClaw nine/seven. The thin inner groove and bright rim are painted on elongated ear surfaces. In raw model space, Dryad's ear spans 35.89 units along X, while its entire head/hair component spans 18.76 along X. DruidOfTheClaw's ears span49.46 and DemonHunter's32.10; these are measured axis-aligned spans, not game-scaled head proportions or template targets.

DemonHunter divides its hair into a 27 triangle topknot and a 141 triangle head/long-hair component. Pale blue stripes run with the swept hair direction on dark masses. HeadHunter instead gives its tall team-colour mohawk 16 triangles/14 positions; fine red strands are paint. WitchDoctor's hanging beard has 12 triangles/13 positions, with a pointed split silhouette and a zigzag team-colour strand pattern. These examples distinguish a smooth large hair volume with painted locks from a thin, angular crest or beard.

![Dryad: head detail and long ears above a very small centauroid body mesh](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/view-1.webp)

[Four angles, wireframe and isolated components](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/index.html).

![HeadHunter: separate tusks, ears and hair crest](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/view-1.webp)

[Four angles, wireframe and isolated components](D:/Codex/sd-research/captures/models/native-sd-366115CF4EBC8BDE4BDDE82280FAFC0C/index.html).

![Demon Hunter: swept painted hair and broad tattooed body surfaces](D:/Codex/sd-research/captures/models/native-sd-F158FE60187900CF9D03B53FEFF39C61/view-1.webp)

[Four angles, wireframe and isolated components](D:/Codex/sd-research/captures/models/native-sd-F158FE60187900CF9D03B53FEFF39C61/index.html).

The body components in this comparison are explicitly mixed. No claim here assigns their entire count to one torso, skull or limb. The data records preserve those boundaries so a later system can subdivide them further without inheriting a misleading label.
