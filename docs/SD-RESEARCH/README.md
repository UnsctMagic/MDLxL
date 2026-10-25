# SD modelling research: a usable first volume

This is a research checkpoint, not a claim that every model has been understood. The strongest completed section is the owner's 26 LowPolyWorks models: all 3,078 connected pieces have been visually named, their real texture selections recorded, and their colour controls distinguished. The native comparison chapters explain specific construction choices rather than proposing triangle budgets.

The active scope is Classic SD, including SD assets stored in MDX version 1800. The active inventory has 4,207 models: 3,431 native, 130 LowPolyWorks and 646 permitted Hive. The original base-namespace inventory contains 3,448 native contents; 17 modern or uncertain art exceptions are preserved separately. Earlier Reforged and Definitive Edition measurements and captures also remain as unfinished supplementary findings; no further work on those tiers is included in this volume.

## Start with the pictures

- [Illustrated findings for the owner](FINDINGS.md)
- [All model pictures, categories and factions](D:/Codex/sd-research/pictures/index.html)
- [Texture regions and the parts that actually use them](D:/Codex/sd-research/pictures/material-library/index.html)
- [Family, category and faction contact sheets](D:/Codex/sd-research/pictures/contacts/index.html)
- [Warcraft race and creature comparisons](D:/Codex/sd-research/pictures/warcraft-factions/index.html)

## The most useful reading routes

**Choosing paint by appearance:** [native texture reuse](subjects/lpw-native-reuse-observations.md), [small paint selections with large effects](subjects/lpw-small-paint-large-effect.md), [metal painting](subjects/painting-metal.md), [flesh, fur and cloth](subjects/painting-flesh-fur-cloth.md).

**Building a part:** [sword blades](subjects/families/weapons-sword-blades.md), [axes and polearms](subjects/families/weapons-axes-and-polearms.md), [hafts and grips](subjects/families/weapons-hafts-grips-and-totems.md), [shields](subjects/families/armour-shields-and-surfaces.md), [shoulders and bracers](subjects/families/armour-shoulders-and-bracers.md), [heads, skulls and helmets](subjects/families/heads-skulls-helmets-and-crowns.md), [capes and robes](subjects/families/clothing-capes-robes-and-linings.md), [chains and rings](subjects/families/ornaments-chains-rings-and-gems.md).

**Environment construction:** [roofs and chimneys](subjects/families/environment-roofs-and-chimneys.md), [trees](subjects/families/environment-trees.md), [wood, stone and stairs](subjects/families/environment-wood-stone-and-stairs.md), [banners](subjects/families/environment-banners.md), [props and crystals](subjects/families/environment-props-and-crystals.md).

**Painting a coherent custom sheet:** [every supplied Gluma/HerrDave custom image](subjects/lpw-custom-painting-survey.md), [four detailed scale, iron and leather comparisons](subjects/materials/custom-painted-scales-iron-leather.md).

**Comparing kitbashes:** [controlled variants](subjects/lpw-controlled-variants.md), [vampire texture reuse and exact shared geometry](subjects/families/vampire-native-reuse.md), [construction families](subjects/lpw-construction-families.md).

**Understanding spells and glows:** [particle atlas construction](subjects/painting-effect-atlases.md), [painted light masks](subjects/painting-light-masks.md). A zero-mesh-triangle spell can still contain many generated particle cards; those are counted separately.

**Knowing what is normal:** [measurement method](subjects/categories/measurement-method.md), [units](subjects/categories/units.md), [heroes](subjects/categories/heroes.md), [mounts](subjects/categories/mounts.md), [buildings](subjects/categories/buildings.md), [doodads](subjects/categories/doodads.md), [items](subjects/categories/items.md), [missiles](subjects/categories/missiles.md), [portraits](subjects/categories/portraits.md), [death and spawn assets](subjects/categories/spawns.md), [glue scenes](subjects/categories/glue-scenes.md), [UI models](subjects/categories/ui-models.md). Each category retains its actual source membership rather than turning a percentile into a rule.

The complete chapter index is generated into the local HTML handbook. Faction chapters cover the LowPolyWorks armies and separate Warcraft races/creeps; Chaos marks are treated within the Warriors of Chaos chapter according to the models actually present.

## What the numbers mean

A **component** is an edge-connected piece within a geoset. It may be an entire connected body, one blade, or one face of a larger assembly. Names retain that boundary. A 210-triangle Lich head/crown/collar is not presented as a 210-triangle isolated skull.

A **UV region** is the actual triangle projection onto a texture, not a guessed rectangle. Mesh regions, animated texture choices and particle atlas cells have different records. Region appearance can be altered by model tint, team colour, alpha and lighting; the source paint and the rendered appearance remain distinct.

A **direct annotation** follows visual inspection. A **matching candidate** or **strict transfer** names its source and method and is not silently promoted to direct review. A credit is an attribution, not geometric proof. Unreviewed components retain their measurements and explicit pending status.

Footman height = 1 is the documented raw model-space Stand sample, before object-editor scale. Slice corner counts are measurements of a plane cutting triangulated geometry, not automatically the number of sides in an authored ring. Stored vertex counts include normal/UV splits; distinct-position counts are separate.

## Data and continuation

[DATASETS.md](DATASETS.md) describes the searchable exports. [METHOD.md](METHOD.md) records sampling, image and provenance limits. The task note in `docs/agent-tasks/sd-research.md` gives the exact regeneration order and unfinished work.

All downloadable models, source textures, extracted game bytes and image captures remain on D:. Git contains scripts and derived knowledge only. MDLxL application code and the installed game are not changed.
