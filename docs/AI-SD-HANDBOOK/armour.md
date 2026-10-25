# Armour and hats

Build a shoulder pad as a few broad sloped planes, about 8–24 triangles, and a helmet as a 5–6 sided shell with a strong brow, about 20–64 triangles. Let overlapping plates read through painted edge light and dark contact; do not add bevels and thickness to every engraved line. Human armour uses shaped upright plate, orcs larger uneven shoulders, elves long tapering plates and undead broken/ribbed silhouettes.

For a Footman-like soldier inspect the native model and textures/footman.dds before inventing the body paint. The checked helmet-side-layout, human-face-side-layout and curved-armour-layout need anatomical/plate alignment; they are not tiny seamless swatches. Shoulder/greave team masks need the existing material-presets applyMaterialPreset(model, materialId, "Team Color") stack. Preserve the native stack when reshaping an existing unit. A flat grey palette over boxes cannot replace the painted curved metal.

A pointed wizard hat starts with a 5–6 sided brim and three or four low-sided cone rings, bent deliberately toward one side. Roughly 35–70 triangles is a practical starting design target, not a measured native hat percentile. Paint folds, seams and a simple band; model the silhouette bend and brim thickness. A broad dark cloth region can supply the material; check the painted light direction.

For "make this armour cooler", inspect the existing silhouette and texture first, choose one local improvement and preserve everything else. A stronger pauldron outline or a cleaner painted edge is often enough. Keep joint clearance, material animations, UVs outside the edit, normals at intended seams, bindings and other sequences. Never replace a whole body to satisfy an armour edit.

## Measured evidence and limits

shoulder: 137 named-bone territories; triangles median 10, P10–P90 2–17; 0 detected planar-ring samples. helmet: 9 named-bone territories; triangles median 49, P10–P90 12–90; 0 detected planar-ring samples. torso: 682 named-bone territories; triangles median 32, P10–P90 6–80; 3 detected planar-ring samples (median 4 sides).

Unit models only, excluding portrait files: shoulder: 76 territories, median 11 triangles; helmet: 7 territories, median 49 triangles; torso: 310 territories, median 32 triangles. Heroes and differently named bone territories are still mixed; inspect the comparable role.

These counts come from [installed game measurements](../AI-SD-PART-DATA.json). A bone territory may be one segment or several joined parts; portraits, scenery and variants differ. Targets above are construction guidance, not measured percentiles or universal caps. Unknown classifications stay unknown. No source geometry is supplied.
