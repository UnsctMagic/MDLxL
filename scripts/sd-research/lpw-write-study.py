"""Write evidence-led LPW subject notes; prose is curated, tables use measured records."""
import json
from pathlib import Path
root=Path('D:/Codex/sd-research');dest=root/'repo/docs/SD-RESEARCH/subjects';data=root/'repo/docs/SD-RESEARCH/data'
r=json.loads((data/'lpw-semantic-owner-parts.json').read_text('utf-8'));by={x['componentId']:x for x in r};pics=json.loads((data/'lpw-owner-picture-evidence.json').read_text('utf-8'));picby={x['componentId']:x for x in pics}
models={m['id']:m for m in json.loads((root/'data/lpw-manifest.json').read_text('utf-8'))}
def table(ids):
 lines=['| Model and connected piece | Observed use | Triangles | Native sheet | Exact UV picture |','|---|---|---:|---|---|']
 for rid in ids:
  x=by[rid];p=picby.get(rid);link=f'[view]({(root/p["picture"]).as_posix()})'if p else f'[part]({(root/x["visualEvidence"][0]).as_posix()})';lines.append('| '+models[x['modelId']]['name']+' (`'+rid.split(':',1)[1]+'`) | '+x['label']+' | '+str(x['triangles'])+' | '+'; '.join(x['sourceTexturePaths'])+' | '+link+' |')
 return '\n'.join(lines)
def photo(rid):return '!['+by[rid]['label']+']('+str((root/picby[rid]['picture']).as_posix())+')'
reuse='''# Native paint can outlive its original object

This chapter follows actual UV triangles on 26 directly reviewed owner models. A texture name identifies the file supplying paint; it does not prove which original Blizzard part occupied that paint. The native-island comparison supplies that separate evidence. Cyan overlays below are unions of actual UV triangles, with tiling restricted to the axes enabled by the actual texture flags. Their bounding boxes are not suggested safe rectangles.

## The unlikely sheets are not edge cases

Graveguard's dark engraved shield front uses the Undead inventory cover. Only 6.49% of that image's pixels lie inside this component's UV mask. The dark scrollwork can therefore read as a physical shield surface without bringing the rectangular interface layout with it. Its wooden shield back uses the Human campaign tree sheet, covering 72.39% of that sheet: a broad source area here, a narrow crop for the front. Both percentages count native-resolution pixel centres inside the union of the real UV triangles (8,507 of 131,072 pixels for the front; 23,722 of 32,768 for the back).

'''+table(['lpw-graveguard:g25:c1','lpw-graveguard:g22:c1','lpw-graveguard:g6:c1','lpw-graveguard:g12:c1'])+'\n\n'+photo('lpw-graveguard:g25:c1')+'''

Graveguard's 24-triangle front mail skirt and 16-triangle face veil use the same Human campaign Footman sheet. The skirt's mapped area is 4.39% of the sheet. The source supplies the link pattern and its light/dark rhythm; the model supplies a broad hanging surface or a face-covering surface. Their different shapes do not require a separately painted mail sheet. This observation concerns these two mappings; it does not imply that every part of the Footman sheet is mail.

## Nurgle draws from architecture, a creature, a tree and a UI-era soldier

Knight of Nurgle uses Tomb of Relics for both the 55-triangle scythe blade body and its separate 26-triangle cutting edge. Garrison supplies the 13-triangle red grip. The exact masks show small, different selections from those sheets. The blade's visual continuity is assembled across these surfaces, rather than inherited from one complete source weapon.

'''+table(['lpw-nurgle-standard:g20:c10','lpw-nurgle-standard:g23:c1','lpw-nurgle-standard:g22:c1','lpw-nurgle-standard:g19:c10','lpw-nurgle-standard:g30:c1','lpw-nurgle-standard:g32:c1'])+'\n\n'+photo('lpw-nurgle-standard:g32:c1')+'''

Knight of Nurgle places three separate 30-triangle skull discs on the shield. They use SpaceMarine paint multiplied by the model’s RGB colour (0.568627, 1, 0.254902), with a team-colour layer also present. The source skull is pale; the resulting green skull must not be catalogued as green paint native to the SpaceMarine sheet. The same model's 44-triangle shield tongue uses Abomination and its 86-triangle shield back uses FelwoodTreeBlight. Its shield teeth use HeroBladeMaster. The assembled shield reads as an irregular face because the silhouette, tooth positions and tongue belong to the new object; the sheet names do not describe that assembly.

Knight of Nurgle also uses GiantSeaTurtle for green horse leg armour, and ChaosWarlord for the 208-triangle mutant horse head. These are observed new roles. A head-shaped mesh using ChaosWarlord paint is not yet proof that the mesh itself was taken from the ChaosWarlord; geometry attribution is tracked separately.

## Small decorative images can become hard surfaces

Knight of Slaanesh uses EditorGemAct on both 4-triangle horse spikes and faceted axe gems. In the shown 18-triangle axe gem, the white and purple bands supply most of the apparent bevel contrast. Its geometric outline still matters: the painted bevel cannot create the projection outside the silhouette. This model also takes its 18-triangle ornamental cape from Jaina and its shield face from HarpyWitch.

'''+table(['lpw-slaanesh-axe:g1:c1','lpw-slaanesh-axe:g35:c2','lpw-slaanesh-axe:g9:c1','lpw-slaanesh-axe:g27:c2','lpw-slaanesh-axe:g28:c1'])+'\n\n'+photo('lpw-slaanesh-axe:g35:c2')+'''

Knight of Slaanesh's shield combines a 38-triangle face relief, a 52-triangle torso relief, a 60-triangle hair shell, hair fringe cards, cloth, gem, chains and glow cards. The face and torso use HarpyWitch; the hair uses SeaGiantGreen. The portrait-like reading comes from that spatial assembly. Calling all those pieces a single shield texture would lose the useful information.

## A theme can be built from unrelated red and gold regions

Knight of Khorne's axe cutting edge uses BloodElfDragonhawk, while its 41-triangle crossguard uses UndeadShipyard. The orange edge and red body remain visually connected in the assembled weapon. The crossguard’s sampled geoset tint is neutral white; its red comes from the team-colour material layer beneath alpha-bearing UndeadShipyard paint, not from a red source-sheet rectangle. The same knight uses Cathedral on the two 18-triangle horse side plates, OutlandDoodads on body armour, and UndeadAirBarge on the gold shoulder rims and spikes. These examples make the owner’s selection process legible: a useful painted boundary, colour field or highlight can matter more than the source object's category.

'''+table(['lpw-khorne-axe:g39:c1','lpw-khorne-axe:g40:c1','lpw-khorne-axe:g12:c1','lpw-khorne-axe:g43:c3'])+'\n\n'+photo('lpw-khorne-axe:g40:c1')+'''

Knight Undivided's sword guard has two 12-triangle decorated caps using HumanCampaignCastle, and its 24-triangle grip uses CampaignOrc. Its shoulder stars use Priest. The weapon does not expose a castle, orc or priest as an identifiable original character; it exposes their selected surface decoration.

'''+table(['lpw-undivided-sword:g29:c2','lpw-undivided-sword:g31:c1','lpw-undivided-sword:g25:c1'])+'''

## A texture count can conceal animation and death machinery

Warrior of Tzeentch's 24-triangle shield eye samples the Battle.net working-animation series. Its actual MDX table contains 29 such frames; the two Tzeentch knights each contain 30. Counting these as 29 or 30 independent painted materials exaggerates their visual diversity. They are a frame sequence serving an eye motif. The warrior's two-piece glowing shield glyph uses VampiricAura's AuraRune6, and its 100-triangle trident head uses InfernalCannon.

Across all 26 owner models, the union of actual MDX references plus catalogue references is 206 native texture paths, compared with 190 in catalogue geoset lists alone. Those 206 paths resolve to 205 distinct downloaded byte hashes and 202 distinct decoded RGBA images. Air Barge, Crypt Fiend, Timber Wolf and Skeleton each have path aliases with identical decoded paint. These are three different counts answering different questions. Gutz is a frequent reference because corpse geometry remains in models; that frequency alone does not identify a living faction's preferred material.

'''+table(['lpw-warrior-of-tzeentch:g15:c1','lpw-warrior-of-tzeentch:g16:c1','lpw-warrior-of-tzeentch:g28:c1'])+'\n\n'+photo('lpw-warrior-of-tzeentch:g15:c1')+'''

## Limits of these conclusions

The source-to-part pictures prove the destination paint and mapped area. They do not by themselves prove the original Blizzard surface's semantic meaning, the artist's intention, the historical order of edits, or Warcraft III runtime acceptance. Part captures force visibility so hidden corpse and alternate surfaces can be inspected; the carrier reference uses authored visibility at the recorded sample. Labels with uncertain anatomical boundaries are marked probable in the dataset. No author’s credit is silently upgraded to a geometry match.
'''
(dest/'lpw-native-reuse-observations.md').write_text(reuse,'utf-8')
families='''# Construction families in the directly reviewed owner models

## A shield is a layered assembly, not one polygon budget

Graveguard, Warrior of Tzeentch, Knight of Nurgle and Knight of Slaanesh each have a 204-triangle principal shield rim. Knight of Khorne has a 199-triangle principal rim; Knight Undivided has a 104-triangle rim. These numbers refer to the identified connected rim, not the whole shield. Equal counts are not proof of an identical source mesh. The rest of each shield explains its character:

| Model | Identified shield pieces | Construction implication |
|---|---|---|
| Graveguard | Rim 204; carved front 42; wooden back 42; main gargoyle head 146; purple/gold ornament 17; additional jaw/cheek accents and glow cards | A low-count broad front and back support a much denser projected head and rim. The highest triangle investment is in the silhouette/decorative relief. |
| Warrior of Tzeentch | Rim 204; scaled front 32; wood back 32; eye 24; eye frame 16; glyph 18+6; metal accent 76; side band 48 | A small animated surface becomes the focal point inside a comparatively elaborate frame. |
| Knight of Nurgle | Rim 204; seven flesh-shell pieces 133; back 86; tongue 44; three skull discs 90; 23 teeth 191; mouth lining 8; horns 28+28 | The disturbing mouth is made from independently placed teeth and tongue, not merely a painted symbol. |
| Knight of Slaanesh | Rim 204; face 38; torso 52; hair 60; gem 6; gem frame 18; chains and small fringe cards | A figure is mounted inside the shield. Individual materials follow anatomy, cloth, jewellery and background roles. |
| Knight of Khorne | Rim 199; Khorne emblem 117; gold accent 39; 22 rim spikes at 4 each; skull jaw 86; cheek pieces 42 each; skull upper face 76; front/back 41+44 | Repeated small wedges sharpen the outer silhouette, while the centre spends triangles on the raised skull. |

The totals above name the listed pieces, not an exhaustive aggregate budget; exact component records and UV masks remain the searchable source. In Graveguard, the metal-looking front is painted by a UI inventory sheet while the silhouette of the gargoyle head is modelled. In Knight of Nurgle, tooth silhouettes remain geometric even though their colour comes from HeroBladeMaster. This separation is the useful craft observation.

## Rings and painted bands support very different horns

| Model / component family | Measured construction | Paint source and appearance |
|---|---|---|
| Graveguard helmet wing membranes | Six disconnected pieces: 5,2,1 triangles per side | GargoyleStatue dark wing membrane; separate framework pieces use NewBlacksmith. |
| Knight Undivided main helmet horns | Two 54-triangle curved pieces | Necromancer pale/brown bands; the curvature is geometry, the banded light pattern is paint. |
| Knight of Nurgle branched helmet horns | Two 54-triangle branched pieces | SkeletonArcher pink banding; the side branches change the outline beyond the painted stripes. |
| Knight of Slaanesh helmet horn assembly | Two upper curves at 64 each and two lower curves at 36 each | InfernalCannon gold regions; narrow twisting outlines and bright paint work together. |
| Chaos Ogre helmet horns | Two roots at 118 each, plus two tips at 125 each | Necromancer pale roots; NewBlacksmith red tips. The colour break is a component/material break. |
| Knight of Slaanesh horse spikes | Four separate 4-triangle wedges | EditorGemAct purple/white bevel bands make the very small geometry read as faceted ornaments. |

The Chaos Ogre roots and tips are far denser than the four-triangle Slaanesh horse wedges; they serve different outlines and should not be collapsed into one broad “horn budget.” The comparison remains useful when subdivision, size, assembly role and material are retained together.

## Mail is painted on low-count carrier surfaces

Graveguard's HumanCampaignFootman mail covers a 24-triangle skirt and 16-triangle face veil. Chaos Ogre uses the same sheet on a 16-triangle face/neck veil. Warrior of Tzeentch uses it on two 6-triangle upper-arm patches, a 24-triangle skirt, an 8-triangle face border and a 64-triangle face veil. The 64-triangle veil spends geometry on the covering shape; none of these meshes builds each mail link individually. Their exact mapped islands, rather than the texture's filename, locate the useful link patterns.

Knight Undivided uses HumanCampaignFootman on a 35-triangle horse mail caparison. Knight of Khorne uses it on a 32-triangle caparison and 16-triangle neck collar. The rider's mail and the mount's cloth-sized surface therefore belong to the same painted material family but very different carrier roles.

## Painted rivets and separate rivets coexist

Knight of Nurgle's six helmet stud pieces each contain 8 triangles and use InfernalCannon's painted rivet region. Each stud is a separate raised piece whose image also supplies a round highlight. In Graveguard, four small front-waist fasteners contain 8 triangles each; their exact hardware interpretation remains probable because they are tiny in the full model. In both cases a flat-vs-modelled binary would be incomplete: a raised geometric plate carries a painted rounded rivet.

The broader lesson is bounded to these examples: keep a named assembly, its connected components, and its painted sub-features as separate records. A shield's carved engraving, a mail link or a horn stripe can be painted, while the containing surface still has purposeful geometry.
'''
(dest/'lpw-construction-families.md').write_text(families,'utf-8')
pairs=json.loads((data/'lpw-controlled-comparisons.json').read_text('utf-8'))
text='''# Controlled variants separate silhouette cost from animation cost

Gluma’s Skink High Priest hero and swimless hero have the same 954 triangles and the same multiset of component shape fingerprints. The full version is 370,952 bytes; the swimless version is 286,572 bytes. Six named swim sequences are absent in the smaller file. The unit pair similarly retains 984 triangles while removing seven swim sequences. The worker pair retains 776 triangles while removing eleven. These are controlled comparisons inside one author's variants, not unrelated high/low endpoints.

'''
text+='| First model | Second model | Triangles A/B | Bytes A/B | Sequences A/B | Same component geometry multiset |\n|---|---|---:|---:|---:|---|\n'
for p in pairs:
 a,b=p['a'],p['b'];text+=f'| {a["id"]} — {a["name"]} | {b["id"]} — {b["name"]} | {a["triangles"]}/{b["triangles"]} | {a["bytes"]:,}/{b["bytes"]:,} | {a["sequences"]}/{b["sequences"]} | {p["sameUnorientedComponentGeometryMultiset"]} |\n'
text+='''
The blue and orange Blowpipe Skink variants retain 753 triangles; the corresponding Skirmisher variants retain 863. Their colour identity can therefore change without a larger mesh. The fingerprint comparison deliberately ignores material, rig and animation, so it proves shape similarity only.

Saurus Warrior unit and hero make a different point: the unit has 942 total triangles and 904 sample-visible; the hero has 918 total and 916 sample-visible. The unit includes Decay Bone/Flesh while the hero has Dissipate. A total that includes hidden death geometry can move in the opposite direction from the living sampled surface. The exact sample sequence/frame is stored with every metric. Neither number is a universal in-game visibility count.

The Black Orc Warboss unit/hero pair changes from 2,181 to 2,187 triangles. These six extra triangles cannot by themselves explain the hero's complete presentation: attachments, materials, sequence names and effect setup are separate properties. The datasets retain those properties rather than treating a hero as simply a larger polygon count.
'''
(dest/'lpw-controlled-variants.md').write_text(text,'utf-8')
print('Wrote three evidence-led LPW study chapters.')

# Keep the curated comparison chapter's numeric cells tied to the same pixel-centre records.
import re
manual=dest/'lpw-small-paint-large-effect.md'
lines=manual.read_text('utf-8').splitlines()
for i,line in enumerate(lines):
 if not line.startswith('| ')or not re.search(r'\| [\d.]+% \|$',line):continue
 fields=[x.strip()for x in line.strip('|').split('|')]
 match=re.fullmatch(r'(.+) \(`(g\d+:c\d+)`\)',fields[0])
 if not match:raise ValueError('Unrecognised measured comparison row: '+line)
 candidates=[x for x in pics if models[x['componentId'].split(':')[0]]['name']==match[1]and x['componentId'].split(':',1)[1]==match[2]and x['sourceTexturePath'].lower()==fields[3].lower()]
 if len(candidates)!=1:raise ValueError('Ambiguous measured comparison row: '+line)
 fields[-1]=f"{candidates[0]['uvCoveredFraction']:.2%}"
 lines[i]='| '+' | '.join(fields)+' |'
manual.write_text('\n'.join(lines)+'\n','utf-8')
