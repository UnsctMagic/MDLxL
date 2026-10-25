# Shared pieces and environment rigs stay in the corpus

**environment\dnc\dnclordaeron\dnclordaeronunit\dnclordaeronunit.mdx**, **environment\sky\lordaeronsummersky\lordaeronsummersky.mdx**, **sharedmodels\feather1.mdx**, **sharedmodels\bones1.mdx**, **sharedmodels\illidanimprisoned.mdx** have file triangle counts of 0, 38, 8, 24, 660. The day/night rig stores timed data without a renderable mesh, the shared feather is eight triangles, and the imprisoned character is a complete authored model. These named objects remain separately indexed rather than being forced into the unit category.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| environment\dnc\dnclordaeron\dnclordaeronunit\dnclordaeronunit.mdx | 0 | 0 | 0 | 0 | 1.46 | — | [pictures](D:/Codex/sd-research/captures/models/native-sd-A1EB3C003360166BA144FDF7AA369FB9/index.html) |
| environment\sky\lordaeronsummersky\lordaeronsummersky.mdx | 38 | 38 | 0 | 1 | 4.12 | 39.81 | [pictures](D:/Codex/sd-research/captures/models/native-sd-D0B263B0A7FB7DED9A3BC280FE41BCC3/index.html) |
| sharedmodels\feather1.mdx | 8 | 8 | 0 | 1 | 1.90 | 0.03 | [pictures](D:/Codex/sd-research/captures/models/native-sd-2046FE46A21740DB9DDE0AC074C12CD8/index.html) |
| sharedmodels\bones1.mdx | 24 | 24 | 0 | 1 | 2.84 | 0.49 | [pictures](D:/Codex/sd-research/captures/models/native-sd-678ACFECF72D49FF7A7D09834C0550BB/index.html) |
| sharedmodels\illidanimprisoned.mdx | 660 | 654 | 0 | 1 | 44.25 | 1.65 | [pictures](D:/Codex/sd-research/captures/models/native-sd-84FE9689C1473860B4D77E925F313422/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| environment\dnc\dnclordaeron\dnclordaeronunit\dnclordaeronunit.mdx | Stand 60,000 |
| environment\sky\lordaeronsummersky\lordaeronsummersky.mdx | Stand 60,000 |
| sharedmodels\feather1.mdx | Stand 3,333 |
| sharedmodels\bones1.mdx | Stand 467; Stand 2 466 |
| sharedmodels\illidanimprisoned.mdx | Stand 1,667 |

The shared fragment records establish reusable source pieces. They do not by themselves prove that a LowPolyWorks part copied them; that separate claim requires geometry or credit evidence.

Source records: native-sd-A1EB3C003360166BA144FDF7AA369FB9, native-sd-D0B263B0A7FB7DED9A3BC280FE41BCC3, native-sd-2046FE46A21740DB9DDE0AC074C12CD8, native-sd-678ACFECF72D49FF7A7D09834C0550BB, native-sd-84FE9689C1473860B4D77E925F313422. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
