import json,pathlib
R=pathlib.Path('D:/Codex/sd-research');D=R/'data';DOC=R/'repo/docs/SD-RESEARCH'
a=json.loads((D/'annotations/lpw-vampire-vision.json').read_text('utf8'));models={m:json.loads((D/'parts'/f'{m}.json').read_text('utf8')) for m in sorted({x['modelId'] for x in a})}
def table(h,rs):return '| '+' | '.join(h)+' |\n| '+' | '.join('---' for _ in h)+' |\n'+'\n'.join('| '+' | '.join(str(x) for x in r)+' |' for r in rs)+'\n'
def image(mid):return f'![{models[mid]["name"]}](D:/Codex/sd-research/captures/models/{mid}/view-1.webp)\n'
def p(mid,g,c=1):return next(x for x in a if x['modelId']==mid and x['geoset1']==g and x['component1']==c)
def partrow(mid,g,c=1):
 x=p(mid,g,c);return [models[mid]['name'],f'g{g}:c{c}',x['label'],x['triangles'],'; '.join(x['sourceTexturePaths'])]
text='''# Vampire silhouettes assembled from unrelated native sheets

Von Carstein Vampire, Von Carstein Dread Knight, Strigoi Vampire, Necrarch Vampire and Blood Dragon Vampire are direct component-image studies. Each component has a labelled record with its measured triangles, exact UV triangles, material appearance and image evidence in [lpw-vampire-vision.json](../../data/lpw-vampire-vision.json). The visual labels describe the final parts; source filenames do not determine those labels.

'''
text+=table(['Model','Stored triangles','Sample visible triangles','Connected components','Declared texture paths','Model KiB'],[[m['name'],m['triangles'],m['visibleTriangles'],len(m['parts']),len(m['sheets']),round(m['bytes']/1024,1)] for m in models.values()])
text+='\nVon Carstein Vampire and Von Carstein Dread Knight both store 1,535 triangles and show 1,269 at the recorded sample, yet their connected-component counts are 97 and 114 and their declared sheet counts are 22 and 24. The Dread Knight separates the armoured body into metal shells, chainmail panels and bands. Whole-model triangle totals alone conceal that construction difference.\n\n'
text+=image('lpw-von-carstein')+image('lpw-von-carstein-dread-knight')
text+='\nTheir 81-triangle hair components have exactly matching raw face-corner positions, normals and named bone weights, but different UV coordinates and texture sources. All 243 UV face corners change; maximum UV distance is 0.906761. The bound scale ratio is 1 on all axes, with no vertex-count or normal-split change. Von Carstein uses HeroArchmage hair; the Dread Knight uses Hair02_09. Their 324-triangle main sword blades, 90-triangle hilt skulls, paired 34-triangle shoulder skulls and 74 triangles of cape fur have matching shape fingerprints and matching UV triangle coordinates. Exact face-corner position, normal and named-weight checks confirm ten corresponding parts with no reshaping, scale or rig changes. Eight of those parts also retain exact UVs; the hair changes all UV corners and the jewel changes 28 of 60. The full per-part evidence is in [owner-variant-provenance.json](../../data/owner-variant-provenance.json). These comparisons establish reuse within these two supplied models; they do not establish the original author of the shared geometry.\n\n'
text+=table(['Model','Part','Observed final use','Triangles','Actual source path'],[partrow('lpw-von-carstein',g) for g in [1,6,8,9,10,11,14,15,16]]+[partrow('lpw-von-carstein-dread-knight',g) for g in [1,22,24,25,35]])
text+='''
The sword blade in both Von Carstein versions uses `UI\\Widgets\\Glues\\Minimap-CustomCampaign-Undead.blp`: its pale ornament and dark recesses become metal along a narrow, modeled blade. The twenty-triangle jewel uses the campaign Lich sheet; the eight-triangle ribbed fitting uses the campaign Night Elf bow sheet. The same weapon therefore combines UI ornament, a cinematic character jewel, a cinematic prop strip and a SkeletonOrc skull. These are exact material assignments, not guesses from the assembled appearance.

On the Dread Knight, the campaign Footman sheet supplies the eight-triangle collar, four sixteen-triangle limb panels and six-triangle chest panel. The visible rows of chain rings are painted onto those broad surfaces. The sixteen-triangle shin guards instead use UndeadTransportShip, whose angular light-and-dark bands read as layered greaves. The contrast between soft repeated ring texture and hard V-shaped metal ridges survives because the parts occupy different anatomical zones.

'''
text+=image('lpw-strigoi-vampire')
text+='''
Strigoi Vampire changes the proportion of modeled mass. Its connected upper torso, arms and hands use 544 triangles, the two legs use 140 each, and the head uses 173. The Gargoyle sheet supplies all of these body surfaces. Eight ten-triangle finger claws and eight four-triangle toe claws use the Skeleton sheet, while Magnataur supplies a 53-triangle skirt and 28-triangle waist band, and FacelessOne supplies a 56-triangle red sash. Pale exposed skin occupies the broad silhouette; dark and red cloth concentrate around the waist. This observation belongs to this model, not a claimed rule for every Strigoi design.

'''
text+=table(['Model','Part','Observed final use','Triangles','Actual source path'],[partrow('lpw-strigoi-vampire',g,c) for g,c in [(2,1),(2,2),(3,1),(4,1),(4,9),(5,1),(5,2),(6,1),(8,1)]])
text+='\n'+image('lpw-necrarch-vampire')
text+='''
Necrarch Vampire builds a different hierarchy: 173 triangles for the cowl, 106 for the upper robe and sleeves, and 108 for the lower robe, all using HeroLich dark cloth. The pale head alone has 373 triangles and each articulated hand has 107. The hood obscures much of the head in the ordinary whole-model view, so visible silhouette importance and stored face complexity are different measurements here.

The Necrarch book is a substantial modeled accessory. Its UndeadAirBarge frame has 268 triangles; two FacelessOne ornaments have 36 each; the bound page block has 16; and the CreepyNecropolis skull has 96, plus two two-triangle eye glows. Those named parts total 456 triangles. The book combines sources for architectural trim, red organic ridges, bound pages and carved bone. Its shoulder chain has only twelve triangles across a bent loop and short connecting card: repeated links are painted with Meatwagon imagery rather than modeled as separate rings.

'''
text+=table(['Model','Part','Observed final use','Triangles','Actual source path'],[partrow('lpw-necrarch-vampire',g,c) for g,c in [(1,1),(2,1),(3,1),(5,1),(5,2),(7,1),(7,2),(20,1),(21,1),(22,1),(23,1)]])
text+='''
Von Carstein Vampire, Von Carstein Dread Knight, Strigoi Vampire and Necrarch Vampire also contain hidden bat assemblies. Their isolated captures show pointed eight-triangle bodies and dark membrane wings, usually four triangles per wing component; one connected wing assembly has six. These parts use HeroDreadlord and are hidden at the sampled Stand pose. They are recorded as animation parts rather than being counted as unexplained armour, hair or cloth. The precise event timing is retained in each model's sequences and alpha tracks; this chapter does not infer it from the material name.

The uncertain observations are narrow: Strigoi's small angular head/neck infill and ridged dorsal panel, the Necrarch red book ornament's fictional material, and the precise event purpose of detached red glow cards. Their shapes, source paths and measurements are still recorded; uncertainty is not filled with a fabricated body-part name.
'''

text+='\n'+image('lpw-blood-dragon')
text+='''
Blood Dragon Vampire makes the head silhouette exceptionally expensive: 559 triangles of helmet/strut structure plus 310 triangles of RedDragon membrane form 869 triangles of headgear, about 47.3% of its 1,839 visible sampled triangles. The corrected capture uses the model's animated red tint; an earlier research render incorrectly swapped red and blue channels and is not evidence for this palette.

The broad red shoulder shells are four fourteen-triangle pieces using RedDragon paint. The black cape uses 58 triangles and SkeletonMage imagery. Chainmail appears on a 44-triangle gorget, 22-triangle hip panel and nineteen-triangle arm panels using the campaign Footman sheet. These parts preserve separate material zones even though all draw from native sheets made for other subjects.

Blood Dragon's eight-triangle axe haft uses `UI\\Console\\NightElf\\NightElfUITile-InventoryCover.blp`. Brown grain from a UI sheet becomes a long wooden shaft. Together with the Von Carstein blade's undead campaign-minimap sheet, this is direct evidence that interface paint belongs in the material-source library. The actual UV triangles and source paths are recorded per part, rather than replacing the use with a guessed whole-sheet material tag.

'''
text+=table(['Model','Part','Observed final use','Triangles','Actual source path'],[partrow('lpw-blood-dragon',g,c) for g,c in [(18,1),(19,1),(22,1),(28,1)]])

(DOC/'subjects/families/vampire-native-reuse.md').write_text(text,encoding='utf8')
print('Wrote vampire-native-reuse.md')
