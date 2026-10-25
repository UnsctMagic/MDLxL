# Native textures

Search mdlxl_assets with source:"native" and plain meaning, such as "orc axe blade", "elven purple cloth", "bone" or "roof stone". The catalogue contains installed SD paths, dimensions, measured alpha use and explicitly labelled checked regions. Most entries have automatic path-derived tags only: those are search candidates, not verified descriptions or safe UV islands. A region is usable only when checkedByEye is true. Use mdlxl_assets preview to inspect a candidate before committing.

Keep the game path in model.Textures; never package, extract, recolour or redistribute the installed sheet as a new output. Referencing a native texture path is encouraged and is different from copying model geometry. Keep mirrored/reused islands and the material's existing alpha/team-colour behaviour. Transparent pixels may be cutouts, team-colour masks or unused padding; do not infer team colour from alpha alone. Catalogue team-colour evidence comes from actual model material use.

Choose a region for its painted material, value and highlight direction. Blade steel, grip leather, gold trim, skin, cloth, wood, stone, roof and bone need different islands. A small material swatch cannot replace an anatomical face or a complete shield emblem. If no native sheet fits the specific subject, paint an original diffuse with broad top light, dark contacts and clear edge accents. Keep a small palette and avoid baked photographic reflections, procedural stripes, normal/roughness maps and noisy scratches. The optional sd-kit painter is a fallback; it does not decide construction or impose prefab geometry.

Use several compatible islands from one native sheet together: skin, cloth, leather and metal can share an atlas without borrowing its model. Match the painted light direction and value range at joins. A colour match alone is insufficient when one patch contains a face, hair or a painted symbol. Check the patch at its actual texel scale before stretching it over a large surface.

For a solid grip, blade or plate, choose an opaque interior; the catalogue records alpha in each checked rectangle. A foliage cutout or team-colour roof mask needs its matching existing material setup. Previewing the sheet alone cannot certify those material choices.


A checked rectangle can be a painted panel or anatomical island, not a uniform material. Read its materialUse and note as well as its name. A pale metal outline on purple armour will become an unwanted white streak if stretched across cloth. For a whole garment, use a suitable cloth island with continuous lighting; omit optional bands/seams that the native region cannot supply, or paint an original modest diffuse if the required layout is missing.

## Measured evidence and limits

Use the material/mesh measurements and the actual source asset; this subject has no reliable automatically isolated part sample.

These counts come from [installed game measurements](../AI-SD-PART-DATA.json). A bone territory may be one segment or several joined parts; portraits, scenery and variants differ. Targets above are construction guidance, not measured percentiles or universal caps. Unknown classifications stay unknown. No source geometry is supplied.
