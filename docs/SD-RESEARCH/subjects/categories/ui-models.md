# UI models: mesh, painted cards and particle feedback share the format

**ui\feedback\goldcredit\goldcredit.mdx**, **ui\minimap\minimap-questobjectivebonus.mdx**, **ui\feedback\autocast\ui-modalbuttonon.mdx** contain 102, 2, 0 mesh triangles, respectively. GoldCredit is a 102-triangle object, the minimap objective is a two-triangle card, and the autocast example stores no mesh. UI is a use category rather than a single geometric construction.

| Source model | File triangles | Sample body LOD0 | Hidden LOD0 | Diffuse paths | File KiB | Raw height / Footman | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ui\feedback\goldcredit\goldcredit.mdx | 102 | 102 | 0 | 2 | 15.30 | 1.10 | [pictures](D:/Codex/sd-research/captures/models/native-sd-1B944535F9B2A1E1B9B7B5428E25DCB1/index.html) |
| ui\minimap\minimap-questobjectivebonus.mdx | 2 | 2 | 0 | 1 | 1.45 | 0.00 | [pictures](D:/Codex/sd-research/captures/models/native-sd-0F1C7C0C7B7BA348AAB23857839CBD76/index.html) |
| ui\feedback\autocast\ui-modalbuttonon.mdx | 0 | 0 | 0 | 0 | 2.16 | — | [pictures](D:/Codex/sd-research/captures/models/native-sd-6BAF046F1B50D6E276A434759B39D9A6/index.html) |

| Source model | Authored sequence / milliseconds |
| --- | --- |
| ui\feedback\goldcredit\goldcredit.mdx | stand 1,334 |
| ui\minimap\minimap-questobjectivebonus.mdx | Stand 2,000 |
| ui\feedback\autocast\ui-modalbuttonon.mdx | Stand 1,667 |

| Source model | ParticleEmitter2 | Diffuse paths at sample |
| --- | --- | --- |
| ui\feedback\goldcredit\goldcredit.mdx | 0 | textures\gold.blp; ui\feedback\goldcredit\star4_32.blp |
| ui\minimap\minimap-questobjectivebonus.mdx | 0 | ui\minimap\minimap-questobjectivebonus.blp |
| ui\feedback\autocast\ui-modalbuttonon.mdx | 4 |  |


Source records: native-sd-1B944535F9B2A1E1B9B7B5428E25DCB1, native-sd-0F1C7C0C7B7BA348AAB23857839CBD76, native-sd-6BAF046F1B50D6E276A434759B39D9A6. Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).
