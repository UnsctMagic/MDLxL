"""Write manually reviewed LPW semantics. Labels below come from fitted two-angle part images plus posed location, not bone-name classification."""
import json
from pathlib import Path
root=Path('D:/Codex/sd-research');dest=root/'repo/docs/SD-RESEARCH/data'
model='lpw-graveguard'
# geoset:component labels are deliberately explicit; asymmetric pieces remain distinct.
manual={
'1':['back mantle fur','neck mantle fur','lower back mantle fur','right hip fur trim','left hip fur trim','right wrist fur cuff','left wrist fur cuff'],
'2':['upper polearm haft segment','lower polearm haft segment'],
'3':['right pauldron shell','left pauldron shell','left gauntlet plate insert','polearm collar','right gauntlet plate insert'],
'4':['long skirt cloth','right pauldron cloth inset','left pauldron inner cloth inset','left pauldron outer cloth inset'],
'5':['breastplate','right shoulder spike card 1','right pauldron metal rim','right shoulder spike card 2','right shoulder spike card 3','right shoulder spike card 4','right shoulder spike card 5','right hip plate','left hip plate','helmet top finial','helmet crown bowl','helmet face surround','helmet crown ridge','helmet finial base','waist gold rim','front waist rivet upper right','front waist rivet upper left','front waist rivet lower right','front waist rivet lower left','front waist clasp frame','left gauntlet','right gauntlet'],
'6':['front chainmail skirt'],
'7':['portrait backdrop plane'],
'8':['left hip skull relief plate','right hip skull relief plate'],
'9':['right exposed upper arm bone','left exposed upper arm bone'],
'10':['waist armour shell','lower waist armour band'],
'11':['polearm blade','polearm guard upper bladelet','polearm guard lower bladelet','polearm guard rim'],
'12':['chainmail face veil'],
'13':['left helmet wing lower membrane','left helmet wing middle membrane','left helmet wing tip card','right helmet wing lower membrane','right helmet wing middle membrane','right helmet wing tip card'],
'14':['left eye purple glow card','right eye purple glow card'],
'15':['left helmet wing upper spur','left helmet wing lower spur','left helmet wing middle spur','right helmet wing upper spur','right helmet wing lower spur','right helmet wing middle spur'],
'16':['skirt hem narrow metal strip'],
'17':['skirt hem ornamental border'],
'18':['polearm grip wrap'],
'19':['waist skull emblem'],
'20':['upper waist armour band','middle waist armour band'],
'21':['shield ornate rim','shield central backing strip'],
'22':['shield wooden back'],
'23':['shield gargoyle head','shield face lower cheek accent','shield face lower jaw accent'],
'24':['shield left purple eye glow','shield right purple eye glow'],
'25':['shield carved front panel'],
'26':['skull face','right eye colour inset','left eye colour inset'],
'27':['right forearm bone lower','right forearm bone upper','left forearm bone lower','left forearm bone upper'],
'28':['shield central purple-and-gold ornament']}
material={1:['black fur'],2:['dark iron','silver wear'],3:['dark green-black plate','dull edge highlight','gold collar'],4:['team-coloured cloth','painted folds'],5:['dark plate','gold trim','silver edge highlight'],6:['chainmail'],7:['team glow'],8:['pale bone','dark eye sockets'],9:['pale bone'],10:['black iron'],11:['pale blade metal','dark guard metal'],12:['chainmail'],13:['dark stone-like wing membrane'],14:['purple glow'],15:['team-colour accents','dark framework'],16:['silver edge'],17:['bronze scrollwork'],18:['pale wrapped grip'],19:['pale skull'],20:['dark iron','silver rivets'],21:['bronze scrollwork','team-colour strip'],22:['brown wood grain'],23:['warm brown carved face'],24:['purple glow'],25:['dark engraved metal'],26:['pale bone','eye glint'],27:['pale bone'],28:['purple surface','gold angular trim']}
d=json.loads((root/f'data/parts/{model}.json').read_text('utf-8'));capture=json.loads((root/f'captures/models/{model}/capture.json').read_text('utf-8'));pictures={r['id']:r for r in capture['components']};records=[];reuse=[]
for part in d['parts']:
 g,c=part['geoset1'],part['component1'];label=manual[str(g)][c-1];geo=d['geosets'][g-1];textures=list(dict.fromkeys(s['path']for layer in geo['layers']for s in layer['textureSlots']if s['path']));pic=pictures[part['id']]
 r={'modelId':model,'componentId':part['id'],'geoset1':g,'component1':c,'label':label,'family':label.replace('right ','').replace('left ',''),'materialTags':material[g],'certainty':'visual identification supported by posed location and rig assignment','visualEvidence':[f'captures/models/{model}/{pic[k]}'for k in ('file','sideFile','contextFile')],'triangles':part['triangles'],'vertices':part['vertices'],'sourceTexturePaths':textures,'posedBounds':part['posedBounds'],'boneNamesSupportingLocation':[b['name']for b in part['bones']],'reviewNote':'Counts belong to this connected piece. A named assembly can contain several pieces or materials.'}
 if g==5 and c in (16,17,18,19):r['certainty']='probable: tiny raised waist fastener visible as separate geometry; exact hardware type uncertain'
 if g==23 and c in (2,3):r['certainty']='probable: lower decorative pieces of the shield face; exact anatomical boundary uncertain'
 records.append(r)
 for t in textures:
  bounds=part['uv']['bounds'];reuse.append({'modelId':model,'componentId':part['id'],'texturePath':t,'newUse':label,'triangles':part['triangles'],'uvBounds':bounds,'uvTriangles':part['uv']['triangles'],'uvRegionDefinition':'exact triangles from UV set zero; bounds are descriptive, not safe rectangles','outsideUnitSquare':part['uv']['outsideUnitSquare'],'uvSpan':[round(bounds[2]-bounds[0],6),round(bounds[3]-bounds[1],6)],'originalUse':'awaiting matching native UV-island comparison','originalUseCertainty':'unresolved; filename is not original-part evidence','visualMaterialTags':material[g],'visualEvidence':r['visualEvidence']})
(dest/'lpw-semantic-graveguard.json').write_text(json.dumps(records,indent=2),'utf-8');(dest/'lpw-reuse-graveguard.json').write_text(json.dumps(reuse,indent=2),'utf-8')
print(json.dumps({'model':model,'partsReviewed':len(records),'reuseRecords':len(reuse),'probableLabels':sum(r['certainty'].startswith('probable')for r in records)}))