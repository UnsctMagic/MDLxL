# Membrane wings, shell spikes, and animal claws

Gargoyle, CryptFiend, Huntress and Dryad put different kinds of silhouette detail into different representations. Gargoyle has two-triangle membrane panels held by five-triangle finger struts; CryptFiend has separate three- and five-triangle shell spikes; Huntress paints several claws into each two-triangle card; Dryad gives each hoof nine triangles. These are measured alternatives with identifiable source parts, not a single recommended count for every pointed feature.

| Source model and part | Triangles | Vertices / positions | Raw dimensions X x Y x Z | Measured texture region bounds |
|---|---:|---:|---|---|
| [gargoyle g1:c5](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html) wing membrane panel | 2 | 6 / 4 | 52.13 x 25.01 x 24.14 | 0.3176, 0.5339, 0.6095, 0.8558 |
| [gargoyle g1:c6](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html) wing membrane panel | 2 | 4 / 4 | 52.14 x 32.54 x 27.16 | 0.1643, 0.4902, 0.6053, 0.8389 |
| [gargoyle g2:c6](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html) wing finger strut | 5 | 5 / 5 | 35.73 x 30.15 x 47.96 | 0.3638, 0.1465, 0.4633, 0.2013 |
| [gargoyle g2:c8](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html) wing finger strut | 5 | 5 / 5 | 67.32 x 21.96 x 13.46 | 0.3562, 0.1479, 0.4598, 0.2101 |
| [cryptfiend g1:c3](D:/Codex/sd-research/captures/models/native-sd-F1B15954BF2ACA46738EB0C5E4EFED67/index.html) abdomen edge spike | 3 | 5 / 5 | 5.69 x 13.86 x 11.53 | 0.8081, 0.8951, 0.9931, 0.9997 |
| [cryptfiend g1:c5](D:/Codex/sd-research/captures/models/native-sd-F1B15954BF2ACA46738EB0C5E4EFED67/index.html) thorax ridge spike | 5 | 6 / 6 | 10.12 x 4.86 x 13.5 | 0.8188, 0.893, 0.9949, 0.9982 |
| [huntress g2:c4](D:/Codex/sd-research/captures/models/native-sd-C5CABE52A4BC2BFE182A625BA81ACF0C/index.html) panther claw group card | 2 | 4 / 4 | 18.52 x 16.43 x 6.77 | 0.5364, 0.1444, 0.5908, 0.2325 |
| [huntress g1:c3](D:/Codex/sd-research/captures/models/native-sd-C5CABE52A4BC2BFE182A625BA81ACF0C/index.html) panther fang | 2 | 3 / 3 | 7.76 x 3.66 x 12.57 | 0.5033, 0.0069, 0.5558, 0.0452 |
| [dryad g1:c3](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/index.html) cloven hoof | 9 | 7 / 7 | 19.57 x 9.19 x 11.23 | 0.0291, 0.4696, 0.1267, 0.531 |
| [dryad g1:c7](D:/Codex/sd-research/captures/models/native-sd-4725DB7D924771D971D5E22B88A49CBF/index.html) cloven hoof | 9 | 7 / 7 | 13.95 x 9.31 x 12.75 | 0.3474, 0.4613, 0.448, 0.5271 |

Gargoyle's four large membrane components are two triangles and four positions each. Their left/right pairs repeat UV bounds: g1:c5/c7 use u0.317613–0.609482,v0.533866–0.85585, while c6/c8 use another overlapping membrane region. Parallel dark stripes and lighter ridges suggest membrane folds on the same quad. Six main wing fingers use five triangles/five positions each, and two narrow root accents use two triangles each. The broad wingspan comes from a small number of bent panels plus tapering silhouette struts. Calling the entire wing a flat card would miss the separate struts and articulated wing roots.

CryptFiend repeats one abdomen-spike region ten times, once for each three-triangle/five-position edge spike. Those ten spikes all occupy u0.808123–0.993136,v0.895085–0.99965, yet their sizes and orientations change around the abdomen. The four five-triangle thorax spikes reuse a closely overlapping crop. The pale border and dark centre are paint; adding a new surface for every painted bevel would change the construction. CryptFiend's larger arms are 47 triangles each and include hand and trailing cloth, so that count must not be presented as a pure claw count.

Huntress's four panther claw groups each use a single quad. Several white nails appear inside each alpha mask; there is no separate cone for each claw. Its two fangs are even more specific: each uses three positions and two triangles with opposite winding, a double-sided triangular plane. Dryad's four hooves are nine-triangle/seven-position volumes, with front and rear pairs using different UV crops. Their dark cleft is strongly painted. The three examples therefore separate volumetric hoof shape, grouped claw cards, and duplicate-sided fang planes.

![Gargoyle: broad membranes and separate team-colour wing fingers](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/view-1.webp)

[Four angles, wireframe and isolated components](D:/Codex/sd-research/captures/models/native-sd-5DAF86AF76031C3AC549FE759140A91B/index.html).

![Crypt Fiend: repeated small chitin spikes around a larger connected body](D:/Codex/sd-research/captures/models/native-sd-F1B15954BF2ACA46738EB0C5E4EFED67/view-1.webp)

[Four angles, wireframe and isolated components](D:/Codex/sd-research/captures/models/native-sd-F1B15954BF2ACA46738EB0C5E4EFED67/index.html).

![Huntress panther: alpha-painted claw clusters and planar fangs](D:/Codex/sd-research/captures/models/native-sd-C5CABE52A4BC2BFE182A625BA81ACF0C/view-1.webp)

[Four angles, wireframe and isolated components](D:/Codex/sd-research/captures/models/native-sd-C5CABE52A4BC2BFE182A625BA81ACF0C/index.html).

Normal and UV splits, exact UV polygons, source materials and isolated images are stored per annotation. The measurements include all authored faces in a named part; a front/back duplicate is still two triangles in that file. These results concern the named native SD models, not all creatures or their HD replacements.
