# Heads and faces

For a unit, inspect a native unit head in its posed body before choosing proportions. The Footman head/helmet territory is roughly one quarter of the visible figure height, including its helmet and beard; a generic realistic head/body ratio is not a suitable default. For a fresh head start with a low ring around the brow, a wider cheek/jaw ring and a narrow chin; use a few front vertices to project the nose and brow. Around 40–90 triangles is a useful ordinary unit-head target; the named-head measurement median is not a mandate to simplify portraits. Avoid a smooth UV sphere with painted stickers. Eyes, nostrils, mouth creases, teeth divisions and eyebrow shapes usually belong in the texture. Give the nose, jaw, tusks or ears real outline when the view needs them.

A human face reads through a broad brow and jaw, an orc through jaw/tusks and a heavy brow, an elf through an angular cheek and long ear silhouette, an undead through the cranium/jaw contrast. Change jaw width, cranium slope, nose projection, cheek planes and ear placement independently. Keep eyes aligned with the painted sheet; do not map the whole head to one tiny skin swatch. For a face use the native head island with its real anatomical UV arrangement or paint an original diffuse if no sheet fits. A rectangular metal or skin region is a material patch, not a complete face unwrap. Check whether the head island contains a full front, one half, or a side layout: a side island with one socket must not be projected onto a two-eye front face. Map the painted landmarks to their anatomical surfaces and mirror where appropriate.

Give the helmet a wrapping crown, sloped brow and cheek/back coverage following the reference. A simple low-sided shell is a starting mesh to reshape, not a flat cap or horizontal brim on top of a face box. Paint engraving and seams. A plume is a tapered solid tuft or deliberate alpha cards. Check eye positions, jaw thickness and the head/neck join from behind as well as the front.

## Measured evidence and limits

head: 890 named-bone territories; triangles median 66, P10–P90 5–158; 26 detected planar-ring samples (median 4 sides). helmet: 9 named-bone territories; triangles median 49, P10–P90 12–90; 0 detected planar-ring samples.

Unit models only, excluding portrait files: head: 373 territories, median 40 triangles; helmet: 7 territories, median 49 triangles. Heroes and differently named bone territories are still mixed; inspect the comparable role.

These counts come from [installed game measurements](../AI-SD-PART-DATA.json). A bone territory may be one segment or several joined parts; portraits, scenery and variants differ. Targets above are construction guidance, not measured percentiles or universal caps. Unknown classifications stay unknown. No source geometry is supplied.
