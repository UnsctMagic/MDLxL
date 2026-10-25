# What this study has found

The most useful result so far is a detailed record of how the owner's models turn familiar Warcraft artwork into unfamiliar objects. The evidence now shows the selected paint and the resulting part together, with its actual geometry. This first volume can already be used as a reference for texture selection, part construction and comparisons between finished models. It remains an unfinished study of the wider corpus.

## An inventory panel can become a shield

The Graveguard's carved shield front is a 42-triangle piece. Its UVs select the dark engraved lower panel of the undead inventory cover, occupying 6.49% of that 256-by-512 sheet using the full-resolution pixel-centre method. The shield does not copy the whole interface picture: it selects a coherent dark pattern and gives that paint a new outline and curvature. The rim, rear, gargoyle head and upper ornament are separate pieces with other source sheets.

![Graveguard: exact inventory-cover paint and shield result](D:/Codex/sd-research/pictures/owner-reuse/g25-c1.jpg)

The same habit appears elsewhere: Blood Dragon's eight-triangle axe shaft takes a narrow brown strip from the Night Elf inventory cover, and Von Carstein's 324-triangle ornate sword blade uses the undead custom-campaign minimap frame. These are observed uses, not suggestions inferred from texture filenames. [Detailed comparison](subjects/lpw-small-paint-large-effect.md).

## A tiny familiar image can supply convincing material

The Slaanesh axe's lower gem is 18 triangles mapped onto the editor's active purple gem image. The selected painted facets continue to read as facets on the new object. The source is only 64 by 64 pixels; its strongly separated light and dark faces matter more here than its original interface role.

![Editor gem reused on a Slaanesh axe](D:/Codex/sd-research/pictures/owner-reuse/lpw-slaanesh-axe-g35-c2.jpg)

Warrior of Khorne's 14-triangle cleaver edge instead selects lava cracks from dungeon terrain. Its ten-triangle upper blade uses a Battle.net login-door sheet. The fiery pattern and the dark structural surface are deliberately separate selections. [More examples](subjects/lpw-small-paint-large-effect.md).

![Lava terrain becomes a cutting edge](D:/Codex/sd-research/pictures/owner-reuse/lpw-warrior-of-khorne-cleaver-g19-c1.jpg)

## The same small object can be painted or fully modelled

Knight of Khorne's flail has seven closed 48-triangle chain links, 336 triangles for those links. Knight of Nurgle Champion uses six four-triangle chain surfaces arranged as three links, 24 triangles for those surfaces. Their source paint comes from different glue-screen metal sheets. These are different constructions with different visible thickness; combining them into one broad “chain budget” would discard the useful evidence.

![A modelled Khorne chain link using a small interface-metal selection](D:/Codex/sd-research/pictures/owner-reuse/lpw-khorne-flail-g34-c1.jpg)

Blizzard's Undead Air Barge has four-triangle hanging chain strips with the individual links painted into alpha. The Lich also uses narrow hanging chain surfaces. The custom Black Orc examples add two-triangle rivet cards, while Aspiring Champion has 36-triangle projecting axe studs. The study records these as distinct representation choices, with oblique views and topology to tell them apart. [Native chains](subjects/families/ornaments-chains-rings-and-gems.md) · [Custom painted hardware](subjects/materials/custom-painted-scales-iron-leather.md).

## Green armour does not necessarily come from a green texture

Knight of Nurgle's skull discs select pale SpaceMarine skull paint and apply an authored colour multiplier of approximately (0.569, 1, 0.255); their material also includes team colour. Knight of Khorne's shipyard-painted crossguard keeps a neutral white multiplier and gets its red through the team-colour layer. Blood Dragon's campaign-Footman mail is reddened by a model colour multiplier. Searching only the source image's colour would miss those mechanisms.

![Pale source skull paint and the green Nurgle result](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g32-c1.jpg)

The records distinguish source RGB, texture alpha, model tint, team-colour layer and sampled visibility. Alpha coverage is measured per actual UV region; simply sharing a team-colour-capable material does not prove that every part displays team colour. [Colour and paint evidence](subjects/lpw-small-paint-large-effect.md).

## A few native parts explain more than a broad triangle range

Footman and Blademaster each have a nine-triangle sword blade with seven distinct positions: two triangular rings and a tip, with an open proximal end. Footman's ten stored vertices include normal splits; they are not ten separate positions. A middle plane cuts five corners because the side triangles twist, even though the authored rings contain three points. That is why automatic slice counts need interpretation.

Skeleton's curved blade uses 14 triangles and changes the silhouette. Death Knight's 24-triangle connected weapon includes more than its blade, so it is labelled as a whole weapon body. Lich's 210-triangle head, crown and collar is likewise kept separate from Skeleton's 126-triangle skull or the Temple of the Damned's 66-triangle crown skull and eight-triangle partial skull plate. [Sword construction](subjects/families/weapons-sword-blades.md) · [Skulls and helmets](subjects/families/heads-skulls-helmets-and-crowns.md).

![Footman, Knight and Blademaster blades, independently fitted; labels preserve their measured triangles](D:/Codex/sd-research/pictures/contacts/family-straight-blade-8e1e7b8c/sheet-001.webp)

## A shared sheet can allocate detail very unevenly

Gluma's Saurus comparison contains a 70-triangle eyeball using 177 covered source pixels and a 20-triangle club head using 4,059. Geometry density and paint allocation are different decisions. The ordinary Saurus and its hero counterpart retain the same 904-triangle body; their stored totals differ because corpse, portrait and hero-glow pieces differ.

![Measured custom-paint regions on Gluma's Saurus](D:/Codex/sd-research/pictures/custom-painting/lpw-gluma-137328-regions.webp)

All 42 distinct supplied custom images associated with Gluma/HerrDave models have been inspected. The survey compares actual face shadows, edge highlights, fur direction, cloth folds, mail, stitches and small painted fasteners. Model attribution is retained from the catalogue; the study does not independently establish who painted each stroke. [Illustrated painting survey](subjects/lpw-custom-painting-survey.md).

## Variants can prove what changed

The Von Carstein and Dread Knight comparison finds ten visually identified pieces with exactly identical raw face-corner positions, normals and named bone weights. Their 81-triangle hair has all 243 UV corners changed and switches from HeroArchmage to Hair02_09. The 324-triangle sword blade retains its UVs. The record therefore distinguishes a change of paint mapping from a change of shape or rig, without inventing which variant was made first. [Exact comparison](subjects/families/vampire-native-reuse.md).

The two carrier pictures below locate the compared pieces; the linked study supplies the exact geometry and UV comparison.

![Von Carstein Vampire, the first compared carrier](D:/Codex/sd-research/captures/models/lpw-von-carstein/view-1.webp)

![Von Carstein Dread Knight, the second compared carrier](D:/Codex/sd-research/captures/models/lpw-von-carstein-dread-knight/view-1.webp)

## Ordinary numbers need the correct model state

Footman stores 372 triangles but shows 323 at the documented normal sample. Grunt stores 688 and shows 421. Town Hall stores 3,220 but shows 225 at its normal sample: construction, upgrade and death geometry cannot all be treated as simultaneously visible building detail. The category tables preserve whole-file, sampled visible, body and glow counts separately, together with sequence durations, attachment names and object-scale evidence. These are observed populations, not repair thresholds. [Category reference](subjects/categories/measurement-method.md).

![Footman at the documented normal sample: 323 visible triangles out of 372 stored in the file](D:/Codex/sd-research/captures/models/native-sd-3BD0831FAD186C0C08767F15A9663E4B/view-1.webp)

## What is complete enough to use, and what remains open

The active corpus contains 3,431 native SD models, all 130 LowPolyWorks models and 646 models from the permitted Hive resources: 4,207 in total. Their measurements and picture records are available. The original 3,448-content base-game inventory also contains 17 modern or uncertain art exceptions; those remain preserved outside active SD statistics. All 11,920 distinct base-namespace texture contents have decoded previews; that inventory is broader than a claim that every painted region has been interpreted. The owner subset has complete connected-piece visual naming, while the broader native and Hive semantic study is still incomplete.

The final picture audit records all expected image files for the 4,207 active models. Twelve models still have unresolved texture references. Ninety-four samples are blank: 55 use unsupported effect systems, 36 contain no renderable surface at this sample, and three remain unexplained. These cases are listed in the picture browser and are not presented as successful visual study.

The remaining work is substantial: more native and permitted-Hive parts need direct naming; some connected bodies need finer semantic subdivision; many native painted regions still need material and original-purpose interpretation; and historical geometry provenance is only established for a limited set of matches. Missing texture references, unsupported effect systems and capture limitations are listed explicitly in the coverage and method records. An image file existing does not prove that every visible state is captured correctly, and none of these offline renders proves Warcraft III gameplay acceptance.

Earlier HD/DE findings have been retained outside the active scope as requested. The next research session can continue from the exact labels, measurements, scripts and open questions rather than repeating collection. [Open the picture browser](D:/Codex/sd-research/pictures/index.html) · [Open the texture-region browser](D:/Codex/sd-research/pictures/material-library/index.html).
