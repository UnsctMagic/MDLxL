# Vampire silhouettes assembled from unrelated native sheets

Von Carstein Vampire, Von Carstein Dread Knight, Strigoi Vampire, Necrarch Vampire and Blood Dragon Vampire are direct component-image studies. Each component has a labelled record with its measured triangles, exact UV triangles, material appearance and image evidence in [lpw-vampire-vision.json](../../data/lpw-vampire-vision.json). The visual labels describe the final parts; source filenames do not determine those labels.

| Model | Stored triangles | Sample visible triangles | Connected components | Declared texture paths | Model KiB |
| --- | --- | --- | --- | --- | --- |
| Blood Dragon | 2099 | 1839 | 120 | 16 | 248.3 |
| Necrarch Vampire | 1866 | 1606 | 78 | 15 | 170.6 |
| Strigoi Vampire | 1544 | 1284 | 77 | 8 | 144.2 |
| Von Carstein Vampire | 1535 | 1269 | 97 | 22 | 193.3 |
| Von Carstein Dread Knight | 1535 | 1269 | 114 | 24 | 198.0 |

Von Carstein Vampire and Von Carstein Dread Knight both store 1,535 triangles and show 1,269 at the recorded sample, yet their connected-component counts are 97 and 114 and their declared sheet counts are 22 and 24. The Dread Knight separates the armoured body into metal shells, chainmail panels and bands. Whole-model triangle totals alone conceal that construction difference.

![Von Carstein Vampire](D:/Codex/sd-research/captures/models/lpw-von-carstein/view-1.webp)
![Von Carstein Dread Knight](D:/Codex/sd-research/captures/models/lpw-von-carstein-dread-knight/view-1.webp)

Their 81-triangle hair components have exactly matching raw face-corner positions, normals and named bone weights, but different UV coordinates and texture sources. All 243 UV face corners change; maximum UV distance is 0.906761. The bound scale ratio is 1 on all axes, with no vertex-count or normal-split change. Von Carstein uses HeroArchmage hair; the Dread Knight uses Hair02_09. Their 324-triangle main sword blades, 90-triangle hilt skulls, paired 34-triangle shoulder skulls and 74 triangles of cape fur have matching shape fingerprints and matching UV triangle coordinates. Exact face-corner position, normal and named-weight checks confirm ten corresponding parts with no reshaping, scale or rig changes. Eight of those parts also retain exact UVs; the hair changes all UV corners and the jewel changes 28 of 60. The full per-part evidence is in [owner-variant-provenance.json](../../data/owner-variant-provenance.json). These comparisons establish reuse within these two supplied models; they do not establish the original author of the shared geometry.

| Model | Part | Observed final use | Triangles | Actual source path |
| --- | --- | --- | --- | --- |
| Von Carstein Vampire | g1:c1 | long swept white hair | 81 | Units\Human\HeroArchMage\HeroArchmage.blp |
| Von Carstein Vampire | g6:c1 | framed sword jewel | 20 | UI\Glues\SinglePlayer\UndeadCampaign3D\UndeadCampaignLich.blp |
| Von Carstein Vampire | g8:c1 | sword skull ornament | 90 | Units\Creeps\SkeletonOrc\SkeletonOrc.blp |
| Von Carstein Vampire | g9:c1 | ornate straight sword blade | 324 | UI\Widgets\Glues\Minimap-CustomCampaign-Undead.blp |
| Von Carstein Vampire | g10:c1 | ribbed sword fitting | 8 | UI\Glues\SinglePlayer\NightElfCampaign3D\Bow.blp |
| Von Carstein Vampire | g11:c1 | wrapped sword grip | 9 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignSwordHandlr.blp |
| Von Carstein Vampire | g14:c1 | wing-shaped sword guard panel | 2 | Units\Undead\Gargoyle\Gargoyle.blp |
| Von Carstein Vampire | g15:c1 | sculpted skull pauldron | 34 | Buildings\Undead\TempleOfTheDamned\NewTempleOfTheDamned.blp |
| Von Carstein Vampire | g16:c1 | cape side fur trim | 28 | Units\NightElf\MalFurion\NewStag.blp |
| Von Carstein Dread Knight | g1:c1 | long swept white hair | 81 | Textures\Hair02_09.blp |
| Von Carstein Dread Knight | g22:c1 | chainmail collar | 8 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignFootman.blp |
| Von Carstein Dread Knight | g24:c1 | chainmail upper sleeve | 16 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignFootman.blp |
| Von Carstein Dread Knight | g25:c1 | layered shin guard | 16 | Textures\UndeadTransportShip.blp |
| Von Carstein Dread Knight | g35:c1 | chainmail chest panel | 6 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignFootman.blp |

The sword blade in both Von Carstein versions uses `UI\Widgets\Glues\Minimap-CustomCampaign-Undead.blp`: its pale ornament and dark recesses become metal along a narrow, modeled blade. The twenty-triangle jewel uses the campaign Lich sheet; the eight-triangle ribbed fitting uses the campaign Night Elf bow sheet. The same weapon therefore combines UI ornament, a cinematic character jewel, a cinematic prop strip and a SkeletonOrc skull. These are exact material assignments, not guesses from the assembled appearance.

On the Dread Knight, the campaign Footman sheet supplies the eight-triangle collar, four sixteen-triangle limb panels and six-triangle chest panel. The visible rows of chain rings are painted onto those broad surfaces. The sixteen-triangle shin guards instead use UndeadTransportShip, whose angular light-and-dark bands read as layered greaves. The contrast between soft repeated ring texture and hard V-shaped metal ridges survives because the parts occupy different anatomical zones.

![Strigoi Vampire](D:/Codex/sd-research/captures/models/lpw-strigoi-vampire/view-1.webp)

Strigoi Vampire changes the proportion of modeled mass. Its connected upper torso, arms and hands use 544 triangles, the two legs use 140 each, and the head uses 173. The Gargoyle sheet supplies all of these body surfaces. Eight ten-triangle finger claws and eight four-triangle toe claws use the Skeleton sheet, while Magnataur supplies a 53-triangle skirt and 28-triangle waist band, and FacelessOne supplies a 56-triangle red sash. Pale exposed skin occupies the broad silhouette; dark and red cloth concentrate around the waist. This observation belongs to this model, not a claimed rule for every Strigoi design.

| Model | Part | Observed final use | Triangles | Actual source path |
| --- | --- | --- | --- | --- |
| Strigoi Vampire | g2:c1 | torn waist skirt | 53 | Units\Creeps\Magnataur\Magnataur.blp |
| Strigoi Vampire | g2:c2 | folded waist band | 28 | Units\Creeps\Magnataur\Magnataur.blp |
| Strigoi Vampire | g3:c1 | red layered sash | 56 | Units\Creeps\FacelessOne\FacelessOne.blp |
| Strigoi Vampire | g4:c1 | long curved finger claw | 10 | Textures\Skeleton.blp |
| Strigoi Vampire | g4:c9 | short toe claw | 4 | Textures\Skeleton.blp |
| Strigoi Vampire | g5:c1 | hulking torso arms and hands | 544 | Units\Undead\Gargoyle\Gargoyle.blp |
| Strigoi Vampire | g5:c2 | bent leg and clawed foot body | 140 | Units\Undead\Gargoyle\Gargoyle.blp |
| Strigoi Vampire | g6:c1 | batlike vampire head | 173 | Units\Undead\Gargoyle\Gargoyle.blp |
| Strigoi Vampire | g8:c1 | ridged dorsal mane panel | 20 | Units\Undead\Gargoyle\Gargoyle.blp |

![Necrarch Vampire](D:/Codex/sd-research/captures/models/lpw-necrarch-vampire/view-1.webp)

Necrarch Vampire builds a different hierarchy: 173 triangles for the cowl, 106 for the upper robe and sleeves, and 108 for the lower robe, all using HeroLich dark cloth. The pale head alone has 373 triangles and each articulated hand has 107. The hood obscures much of the head in the ordinary whole-model view, so visible silhouette importance and stored face complexity are different measurements here.

The Necrarch book is a substantial modeled accessory. Its UndeadAirBarge frame has 268 triangles; two FacelessOne ornaments have 36 each; the bound page block has 16; and the CreepyNecropolis skull has 96, plus two two-triangle eye glows. Those named parts total 456 triangles. The book combines sources for architectural trim, red organic ridges, bound pages and carved bone. Its shoulder chain has only twelve triangles across a bent loop and short connecting card: repeated links are painted with Meatwagon imagery rather than modeled as separate rings.

| Model | Part | Observed final use | Triangles | Actual source path |
| --- | --- | --- | --- | --- |
| Necrarch Vampire | g1:c1 | deep hood and shoulder cowl | 173 | Textures\HeroLich.blp |
| Necrarch Vampire | g2:c1 | robe torso and flared sleeves | 106 | Textures\HeroLich.blp |
| Necrarch Vampire | g3:c1 | buckled waist belt | 34 | UI\Glues\SinglePlayer\OrcCampaign3D\CampaignOrcSash.blp |
| Necrarch Vampire | g5:c1 | bald vampire head and neck | 373 | units\Undead\HeroDreadLord\HeroDreadlord.blp |
| Necrarch Vampire | g5:c2 | long-fingered vampire hand | 107 | units\Undead\HeroDreadLord\HeroDreadlord.blp |
| Necrarch Vampire | g7:c1 | hanging chain loop | 10 | Textures\Meatwagon.blp |
| Necrarch Vampire | g7:c2 | chain connecting strip | 2 | Textures\Meatwagon.blp |
| Necrarch Vampire | g20:c1 | ornate book cover frame | 268 | Textures\UndeadAirBarge.blp |
| Necrarch Vampire | g21:c1 | red book cover ornament | 36 | Units\Creeps\FacelessOne\FacelessOne.blp |
| Necrarch Vampire | g22:c1 | closed book pages and spine | 16 | Units\Creeps\OrcWarlockRed\OrcWarlockRed.blp; Units\Orc\OrcWarlockGuldan\OrcWarlockGuldan.blp |
| Necrarch Vampire | g23:c1 | book cover skull emblem | 96 | Buildings\Undead\Necropolis\CreepyNecropolis.blp |

Von Carstein Vampire, Von Carstein Dread Knight, Strigoi Vampire and Necrarch Vampire also contain hidden bat assemblies. Their isolated captures show pointed eight-triangle bodies and dark membrane wings, usually four triangles per wing component; one connected wing assembly has six. These parts use HeroDreadlord and are hidden at the sampled Stand pose. They are recorded as animation parts rather than being counted as unexplained armour, hair or cloth. The precise event timing is retained in each model's sequences and alpha tracks; this chapter does not infer it from the material name.

The uncertain observations are narrow: Strigoi's small angular head/neck infill and ridged dorsal panel, the Necrarch red book ornament's fictional material, and the precise event purpose of detached red glow cards. Their shapes, source paths and measurements are still recorded; uncertainty is not filled with a fabricated body-part name.

![Blood Dragon](D:/Codex/sd-research/captures/models/lpw-blood-dragon/view-1.webp)

Blood Dragon Vampire makes the head silhouette exceptionally expensive: 559 triangles of helmet/strut structure plus 310 triangles of RedDragon membrane form 869 triangles of headgear, about 47.3% of its 1,839 visible sampled triangles. The corrected capture uses the model's animated red tint; an earlier research render incorrectly swapped red and blue channels and is not evidence for this palette.

The broad red shoulder shells are four fourteen-triangle pieces using RedDragon paint. The black cape uses 58 triangles and SkeletonMage imagery. Chainmail appears on a 44-triangle gorget, 22-triangle hip panel and nineteen-triangle arm panels using the campaign Footman sheet. These parts preserve separate material zones even though all draw from native sheets made for other subjects.

Blood Dragon's eight-triangle axe haft uses `UI\Console\NightElf\NightElfUITile-InventoryCover.blp`. Brown grain from a UI sheet becomes a long wooden shaft. Together with the Von Carstein blade's undead campaign-minimap sheet, this is direct evidence that interface paint belongs in the material-source library. The actual UV triangles and source paths are recorded per part, rather than replacing the use with a guessed whole-sheet material tag.

| Model | Part | Observed final use | Triangles | Actual source path |
| --- | --- | --- | --- | --- |
| Blood Dragon | g18:c1 | long helmet wing struts | 156 | Textures\UndeadAirBarge.blp |
| Blood Dragon | g19:c1 | broad helmet wing membrane | 80 | Textures\RedDragon.blp |
| Blood Dragon | g22:c1 | pointed boot toe plate | 12 | Buildings\Undead\AltarOfDarkness\CreepyAltarOfDark.blp |
| Blood Dragon | g28:c1 | long axe shaft | 8 | UI\Console\NightElf\NightElfUITile-InventoryCover.blp |
