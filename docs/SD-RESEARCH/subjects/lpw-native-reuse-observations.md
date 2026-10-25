# Native paint can outlive its original object

This chapter follows actual UV triangles on 26 directly reviewed owner models. A texture name identifies the file supplying paint; it does not prove which original Blizzard part occupied that paint. The native-island comparison supplies that separate evidence. Cyan overlays below are unions of actual UV triangles, with tiling restricted to the axes enabled by the actual texture flags. Their bounding boxes are not suggested safe rectangles.

## The unlikely sheets are not edge cases

Graveguard's dark engraved shield front uses the Undead inventory cover. Only 6.49% of that image's pixels lie inside this component's UV mask. The dark scrollwork can therefore read as a physical shield surface without bringing the rectangular interface layout with it. Its wooden shield back uses the Human campaign tree sheet, covering 72.39% of that sheet: a broad source area here, a narrow crop for the front. Both percentages count native-resolution pixel centres inside the union of the real UV triangles (8,507 of 131,072 pixels for the front; 23,722 of 32,768 for the back).

| Model and connected piece | Observed use | Triangles | Native sheet | Exact UV picture |
|---|---|---:|---|---|
| Graveguard (`g25:c1`) | shield carved front panel | 42 | UI\Console\Undead\UndeadUITile-InventoryCover.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/g25-c1.jpg) |
| Graveguard (`g22:c1`) | shield wooden back | 42 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignTree.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/g22-c1.jpg) |
| Graveguard (`g6:c1`) | front chainmail skirt | 24 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignFootman.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/g6-c1.jpg) |
| Graveguard (`g12:c1`) | chainmail face veil | 16 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignFootman.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/g12-c1.jpg) |

![shield carved front panel](D:/Codex/sd-research/pictures/owner-reuse/g25-c1.jpg)

Graveguard's 24-triangle front mail skirt and 16-triangle face veil use the same Human campaign Footman sheet. The skirt's mapped area is 4.39% of the sheet. The source supplies the link pattern and its light/dark rhythm; the model supplies a broad hanging surface or a face-covering surface. Their different shapes do not require a separately painted mail sheet. This observation concerns these two mappings; it does not imply that every part of the Footman sheet is mail.

## Nurgle draws from architecture, a creature, a tree and a UI-era soldier

Knight of Nurgle uses Tomb of Relics for both the 55-triangle scythe blade body and its separate 26-triangle cutting edge. Garrison supplies the 13-triangle red grip. The exact masks show small, different selections from those sheets. The blade's visual continuity is assembled across these surfaces, rather than inherited from one complete source weapon.

| Model and connected piece | Observed use | Triangles | Native sheet | Exact UV picture |
|---|---|---:|---|---|
| Knight of Nurgle (`g20:c10`) | scythe blade body | 55 | Buildings\Undead\TombOfRelics\TombOfRelics.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g20-c10.jpg) |
| Knight of Nurgle (`g23:c1`) | scythe cutting edge | 26 | Buildings\Undead\TombOfRelics\TombOfRelics.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g23-c1.jpg) |
| Knight of Nurgle (`g22:c1`) | scythe grip | 13 | Textures\Garrison.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g22-c1.jpg) |
| Knight of Nurgle (`g19:c10`) | shield tooth 1 | 9 | Textures\HeroBladeMaster.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g19-c10.jpg) |
| Knight of Nurgle (`g30:c1`) | shield tongue | 44 | Textures\Abomination.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g30-c1.jpg) |
| Knight of Nurgle (`g32:c1`) | shield Nurgle motif lower disc | 30 | Units\Critters\Marine\SpaceMarine.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g32-c1.jpg) |

![shield Nurgle motif lower disc](D:/Codex/sd-research/pictures/owner-reuse/lpw-nurgle-standard-g32-c1.jpg)

Knight of Nurgle places three separate 30-triangle skull discs on the shield. They use SpaceMarine paint multiplied by the model’s RGB colour (0.568627, 1, 0.254902), with a team-colour layer also present. The source skull is pale; the resulting green skull must not be catalogued as green paint native to the SpaceMarine sheet. The same model's 44-triangle shield tongue uses Abomination and its 86-triangle shield back uses FelwoodTreeBlight. Its shield teeth use HeroBladeMaster. The assembled shield reads as an irregular face because the silhouette, tooth positions and tongue belong to the new object; the sheet names do not describe that assembly.

Knight of Nurgle also uses GiantSeaTurtle for green horse leg armour, and ChaosWarlord for the 208-triangle mutant horse head. These are observed new roles. A head-shaped mesh using ChaosWarlord paint is not yet proof that the mesh itself was taken from the ChaosWarlord; geometry attribution is tracked separately.

## Small decorative images can become hard surfaces

Knight of Slaanesh uses EditorGemAct on both 4-triangle horse spikes and faceted axe gems. In the shown 18-triangle axe gem, the white and purple bands supply most of the apparent bevel contrast. Its geometric outline still matters: the painted bevel cannot create the projection outside the silhouette. This model also takes its 18-triangle ornamental cape from Jaina and its shield face from HarpyWitch.

| Model and connected piece | Observed use | Triangles | Native sheet | Exact UV picture |
|---|---|---:|---|---|
| Knight of Slaanesh · Axe (`g1:c1`) | horse left head spike | 4 | ReplaceableTextures\WorldEditUI\EditorGemAct.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-slaanesh-axe-g1-c1.jpg) |
| Knight of Slaanesh · Axe (`g35:c2`) | axe lower blade gem 1 | 18 | ReplaceableTextures\WorldEditUI\EditorGemAct.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-slaanesh-axe-g35-c2.jpg) |
| Knight of Slaanesh · Axe (`g9:c1`) | ornamental cape | 18 | Units\Human\Jaina\Jaina.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-slaanesh-axe-g9-c1.jpg) |
| Knight of Slaanesh · Axe (`g27:c2`) | shield female face relief | 38 | Units\Creeps\HarpyWitch\HarpyWitch.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-slaanesh-axe-g27-c2.jpg) |
| Knight of Slaanesh · Axe (`g28:c1`) | shield hair shell | 60 | Units\Creeps\SeaGiantGreen\SeaGiantGreen.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-slaanesh-axe-g28-c1.jpg) |

![axe lower blade gem 1](D:/Codex/sd-research/pictures/owner-reuse/lpw-slaanesh-axe-g35-c2.jpg)

Knight of Slaanesh's shield combines a 38-triangle face relief, a 52-triangle torso relief, a 60-triangle hair shell, hair fringe cards, cloth, gem, chains and glow cards. The face and torso use HarpyWitch; the hair uses SeaGiantGreen. The portrait-like reading comes from that spatial assembly. Calling all those pieces a single shield texture would lose the useful information.

## A theme can be built from unrelated red and gold regions

Knight of Khorne's axe cutting edge uses BloodElfDragonhawk, while its 41-triangle crossguard uses UndeadShipyard. The orange edge and red body remain visually connected in the assembled weapon. The crossguard’s sampled geoset tint is neutral white; its red comes from the team-colour material layer beneath alpha-bearing UndeadShipyard paint, not from a red source-sheet rectangle. The same knight uses Cathedral on the two 18-triangle horse side plates, OutlandDoodads on body armour, and UndeadAirBarge on the gold shoulder rims and spikes. These examples make the owner’s selection process legible: a useful painted boundary, colour field or highlight can matter more than the source object's category.

| Model and connected piece | Observed use | Triangles | Native sheet | Exact UV picture |
|---|---|---:|---|---|
| Knight of Khorne · Axe (`g39:c1`) | axe upper cutting edge | 34 | Units\Human\BloodElfDragonHawk\BloodElfDragonhawk.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-khorne-axe-g39-c1.jpg) |
| Knight of Khorne · Axe (`g40:c1`) | axe crossguard | 41 | Buildings\Undead\UndeadShipyard\UndeadShipyard.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-khorne-axe-g40-c1.jpg) |
| Knight of Khorne · Axe (`g12:c1`) | horse left stone side plate | 18 | Doodads\Cityscape\Structures\Cathedral\Cathedral.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-khorne-axe-g12-c1.jpg) |
| Knight of Khorne · Axe (`g43:c3`) | left pauldron inner gold rim | 80 | Textures\UndeadAirBarge.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-khorne-axe-g43-c3.jpg) |

![axe crossguard](D:/Codex/sd-research/pictures/owner-reuse/lpw-khorne-axe-g40-c1.jpg)

Knight Undivided's sword guard has two 12-triangle decorated caps using HumanCampaignCastle, and its 24-triangle grip uses CampaignOrc. Its shoulder stars use Priest. The weapon does not expose a castle, orc or priest as an identifiable original character; it exposes their selected surface decoration.

| Model and connected piece | Observed use | Triangles | Native sheet | Exact UV picture |
|---|---|---:|---|---|
| Knight Undivided · Sword (`g29:c2`) | sword guard left decorated cap | 12 | UI\Glues\SinglePlayer\HumanCampaign3D\HumanCampaignCastle.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-undivided-sword-g29-c2.jpg) |
| Knight Undivided · Sword (`g31:c1`) | sword grip | 24 | UI\Glues\SinglePlayer\OrcCampaign3D\CampaignOrc.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-undivided-sword-g31-c1.jpg) |
| Knight Undivided · Sword (`g25:c1`) | left pauldron eight-point star | 84 | Textures\Priest.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-undivided-sword-g25-c1.jpg) |

## A texture count can conceal animation and death machinery

Warrior of Tzeentch's 24-triangle shield eye samples the Battle.net working-animation series. Its actual MDX table contains 29 such frames; the two Tzeentch knights each contain 30. Counting these as 29 or 30 independent painted materials exaggerates their visual diversity. They are a frame sequence serving an eye motif. The warrior's two-piece glowing shield glyph uses VampiricAura's AuraRune6, and its 100-triangle trident head uses InfernalCannon.

Across all 26 owner models, the union of actual MDX references plus catalogue references is 206 native texture paths, compared with 190 in catalogue geoset lists alone. Those 206 paths resolve to 205 distinct downloaded byte hashes and 202 distinct decoded RGBA images. Air Barge, Crypt Fiend, Timber Wolf and Skeleton each have path aliases with identical decoded paint. These are three different counts answering different questions. Gutz is a frequent reference because corpse geometry remains in models; that frequency alone does not identify a living faction's preferred material.

| Model and connected piece | Observed use | Triangles | Native sheet | Exact UV picture |
|---|---|---:|---|---|
| Warrior of Tzeentch (`g15:c1`) | animated shield eye | 24 | UI\Glues\BattleNet\BattlenetWorkingExpansion\BNetWorkingExp0021.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-warrior-of-tzeentch-g15-c1.jpg) |
| Warrior of Tzeentch (`g16:c1`) | shield glowing glyph main | 18 | Abilities\Spells\Undead\VampiricAura\AuraRune6.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-warrior-of-tzeentch-g16-c1.jpg) |
| Warrior of Tzeentch (`g28:c1`) | trident head | 100 | Textures\InfernalCannon.blp | [view](D:/Codex/sd-research/pictures/owner-reuse/lpw-warrior-of-tzeentch-g28-c1.jpg) |

![animated shield eye](D:/Codex/sd-research/pictures/owner-reuse/lpw-warrior-of-tzeentch-g15-c1.jpg)

## Limits of these conclusions

The source-to-part pictures prove the destination paint and mapped area. They do not by themselves prove the original Blizzard surface's semantic meaning, the artist's intention, the historical order of edits, or Warcraft III runtime acceptance. Part captures force visibility so hidden corpse and alternate surfaces can be inspected; the carrier reference uses authored visibility at the recorded sample. Labels with uncertain anatomical boundaries are marked probable in the dataset. No author’s credit is silently upgraded to a geometry match.
