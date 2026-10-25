# Editing existing models

The open model is the baseline. Inspect its selected geometry, materials, UV sets, normals, rig and relevant animation before deciding what to change. A vague local request such as "make this armour cooler" authorizes a coherent local improvement, not a new body, texture layout or animation set. State one short plan and preserve everything outside it. A literal technical operation stays literal.

Use existing mesh/UV/material APIs and one Undo step per related change. Do not globally weld coincident positions: they may carry UV seams, hard normals, different materials or different bindings. Do not recolour the game's installed texture; preserve its path or make an explicitly requested original texture. Preserve layer flags, team colour, glow, pivots, bone IDs, weights, events and sequence intervals.

Compare the changed parts with their original counts and silhouette. Existing high counts and smooth shading are not automatic defects; warn about newly introduced excess and judge the requested change in context. Check protected fields and file round-trip, then inspect textured front/back/left/right and game-angle views. For rigged edits sample joint extremes. Flag a floating or clipping join from the images; numeric bounding-box overlap is only a hint, not proof. Keep failures explicit and change approach after a correction fails. Renderer verification and in-game acceptance are separate.

## Measured evidence and limits

Use the material/mesh measurements and the actual source asset; this subject has no reliable automatically isolated part sample.

These counts come from [installed game measurements](../AI-SD-PART-DATA.json). A bone territory may be one segment or several joined parts; portraits, scenery and variants differ. Targets above are construction guidance, not measured percentiles or universal caps. Unknown classifications stay unknown. No source geometry is supplied.
