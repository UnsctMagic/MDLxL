# Reproduce the installed game measurements

Run from the repository with its normal dependencies. These scripts read the
installed Warcraft III CASC through the existing reader. They do not write model
or texture bytes, positions, faces, complete UVs, downloads or preview images.

```
node scripts/sd-knowledge/measure-parts.mjs --game "D:/Warcraft III" --work "D:/Codex/sd-measurements" --out docs
node scripts/sd-knowledge/index-textures.mjs --game "D:/Warcraft III" --work "D:/Codex/sd-measurements" --out docs
```

Part output includes the method/confidence, native source path, model hash,
triangle counts, extents, height ratios, detected planar polygon rings and a
summary, with separate populations for units, portraits, buildings and scenery.
Texture paths provide material context, not proof of an anatomical identity.
Only named bone territories are classified. Renderer-checked numeric examples are
retained on regeneration only when their native file hash still matches. Unclassified surfaces
contribute to coverage counts, not invented anatomical budgets. Stand visibility
uses geoset alpha; positions are bind-pose, and body-relative ratios may include
weapons. A bone territory can be a segment or several joined pieces. Whole-file,
portrait, scenery and unit figures must not be mixed into one rigid part cap.

Texture output includes logical/module paths, dimensions, file hash, header alpha
and decoded alpha measurements. Purpose tags initially come from paths. Unknown
regions and team-colour areas stay unknown; alpha alone does not prove team colour.
Visually checked annotations survive a rebuild only when the texture hash is
unchanged. Add region rectangles only after `mdlxl_assets` preview; record
`checkedByEye`, purpose and any mapping limitation. Runtime lookup never downloads
or copies a game texture.

The handbook's construction targets are authoring guidance informed by these
observations, not percentiles or global limits. Source assets remain untouched.
