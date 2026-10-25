# Painted metal: four different solutions visible in the sheets

The native Footman, HerrDave's Greenskin – Black Orc, Gluma's Bestigor and Gluma's Stormvermin do not use one interchangeable grey-metal treatment. The following observations were checked against decoded sheets and actual triangle overlays, not inferred from texture names.

| Source model | Sheet | Stored triangles using this sheet | Painting visible in the sheet |
| --- | --- | ---: | --- |
| Native SD Footman | `Textures\Footman.blp` (256×256) | 348 | Wide white edge strokes, nearly black separating bands, cool grey broad faces and yellow-gold borders; the helmet rivets have tiny light/dark pairs |
| HerrDave Greenskin – Black Orc (`lpw-herrdave-87376`) | `Greenskin_BlackOrc.blp` (256×256) | 1,274 | Warm grey-brown plates, soft broad streaks, narrow pale outer edges, repeated small mail pattern, isolated bolt faces and a black/white checker strip |
| Gluma Bestigor (`lpw-gluma-127545`) | `bestigor.blp` (256×256) | 874 | Dark blue-grey plate, strongly white rim and rivet highlights, brown/gold borders, curved rows of separately painted mail loops |
| Gluma Stormvermin (`lpw-gluma-82593`) | `stormvermin.blp` (512×256) | 751 | Cool violet-grey plate, white bevel strips, very dark recesses, pale diagonal scratches and bright dot rivets; warm brown cloth/fur keeps the steel distinct |

These are whole-file texture uses, including hidden copies and alternative geosets. They are not claims about the number of triangles visible together.

The Footman sheet paints an unusually wide white band beside a black trough. The Footman's 256-pixel atlas therefore carries a conspicuous light/dark/light transition before any scene lighting is applied. In the decoded sheet this survives at the shield/armour borders and at the helmet brow. The Footman capture uses ordinary preview lighting; the white stroke is already in the texture, so it must not be interpreted as evidence of a modelled bevel.

The Black Orc sheet takes a different route. Its broad dull plates have soft streaks and dark dents; the strongest narrow accents are reserved for edges, bolts and the checker strip. In `Greenskin_BlackOrc.blp`, the metal is almost the same warm family as the background leather. The rivets and brighter plate edges provide separation. This is observed in this Black Orc sheet; it is not a general claim that all orc metal should be brown.

Bestigor's plate paint separates white rims from blue-black interiors much more sharply than Black Orc's plate. Bestigor also paints chainmail loops as light lower arcs against dark interiors. The loop pattern is present in the diffuse pixels themselves; counting those loops as individual geometry details would be a measurement error. The Bestigor shoulder plates are separate geometry, while the loops and rivet highlights are already visible in their UV regions.

Stormvermin places long pale slashes across the large weapon blade and a dark strip immediately inside its cutting edge. Its weapon is stored twice: geosets 6 and 7 each contain 40 triangles, and their four connected components have matching UV bounds. Each includes a 20-triangle blade component whose UV bounds are `[0.454253,0.195250,0.586598,0.986286]`. The repeated blade paint is therefore a measured reuse of the same authored region, not a second independently painted weapon. Visibility of the two copies depends on animation; the stored duplicate does not establish that both are drawn at once.

## Picture evidence

- Native Footman: `D:/Codex/sd-research/captures/models/proof-footman-sd/uv-001.webp`.
- Black Orc: `D:/Codex/sd-research/captures/models/lpw-herrdave-87376/uv-003.webp`; unmarked sheet `captures/textures/lpwtexture-c722b526b295d50e47.webp`.
- Bestigor: `D:/Codex/sd-research/captures/models/lpw-gluma-127545/uv-001.webp`; unmarked sheet `captures/textures/lpwtexture-81cdd8380a395cb97c.webp`.
- Stormvermin: `D:/Codex/sd-research/captures/models/lpw-gluma-82593/uv-001.webp`; unmarked sheet `captures/textures/lpwtexture-09bd921b35e1fd2c04.webp`.

The bounds above locate the authored Stormvermin island; the exact triangle union is in `data/parts/lpw-gluma-82593.json`. A bounding box is not a claim that every pixel inside it is interchangeable material.
