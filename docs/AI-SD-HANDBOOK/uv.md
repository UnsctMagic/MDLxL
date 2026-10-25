# UV mapping

Inspect the current material, UV set, selected faces, sheet and existing islands first. Preserve correct authored UVs outside scope. Assign a suitable native sheet with the existing material APIs; then map selected triangle ids onto a checked catalogue rectangle in one mdlxl_script edit. The sd-native-uv module's mapNativeRegion uses exact triangle ids, creates only necessary UV boundary splits, preserves normals/weights and other UV sets, and refuses to silently replace a material. Read its signature before use.

Use projection:"fit" to retain an existing island's arrangement, or projection:"planar" and axes:"xz", "xy" or "yz" for flat selected faces. Region coordinates are [u0,v0,u1,v1], top-left origin and V down. One pixel of padding protects the region from filtering. Mirror opposite blade sides onto the same region when the painted light permits it. Keep the blade's long axis aligned with the highlight strip, trims straight and cloth grain consistent. Split a seam only where it needs independent UVs. A boxy grip can use a simple strip unwrap with its seam underneath; do not project an entire cylinder flat.

Example after choosing the sheet and region by preview: const uv=await api.module('sd-native-uv'); return await uv.mapNativeRegion(model,{geosetId:0,faces:[0,1],texturePath:'<exact catalogue path>',region:'<checked region name>',projection:'planar',axes:'xz'}). Use the actual returned path and region name, never these placeholders. Check both faces, the reverse side and seams at game scale. Do not unwrap everything to answer "uv map this properly".

For the native Skeleton skull side atlas, map one shaped half continuously from the side, then mirror GEOMETRY across Y=0 with its UV coordinates unchanged. Use ai-mesh.mirrorSelection, which corrects winding. Flipping U a second time or mapping the side atlas onto a whole front destroys the paired anatomical layout. Read skulls-bones.md for the landmark checks.

Reuse paired and repeated UV islands deliberately, keeping the seam underneath a grip or inside a limb. Retain UV/normal splits where paint or shading changes. Reused UVs need not mean reused geometry: change the outline, ring spacing and relative masses while keeping the material language coherent.

For a solid grip, blade or plate, choose an opaque interior; the catalogue records alpha in each checked rectangle. A foliage cutout or team-colour roof mask needs its matching existing material setup. Previewing the sheet alone cannot certify those material choices.

## Measured evidence and limits

Use the material/mesh measurements and the actual source asset; this subject has no reliable automatically isolated part sample.

These counts come from [installed game measurements](../AI-SD-PART-DATA.json). A bone territory may be one segment or several joined parts; portraits, scenery and variants differ. Targets above are construction guidance, not measured percentiles or universal caps. Unknown classifications stay unknown. No source geometry is supplied.
