import json,pathlib,math,struct,hashlib,subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=pathlib.Path('D:/Codex/sd-research');D=R/'data';DOC=R/'repo/docs/SD-RESEARCH';OUT=R/'pictures/custom-painting';OUT.mkdir(exist_ok=True)
subprocess.run(['node',str(pathlib.Path(__file__).parent/'decode-custom-painting.mjs')],cwd=R/'repo',check=True)
models={};caps={};a=[]
def add(mid,g,cs,label,tags,notes):
 if mid not in models:
  models[mid]=json.loads((D/'parts'/f'{mid}.json').read_text('utf8'));caps[mid]=json.loads((R/'captures/models'/mid/'capture.json').read_text('utf8'))
 for c in cs:a.append(dict(modelId=mid,geoset1=g,component1=c,componentId=f'{mid}:g{g}:c{c}',label=label,materialTags=tags.split('|'),notes=notes,method='direct visual review',certainty='high'))
for mid,shift in [('lpw-gluma-137328',0),('lpw-gluma-137329',-1)]:
 g=3+shift
 add(mid,g,[1],'connected scaled reptile body','blue scales|blue skin|ivory claws','466 triangles includes head,body,limbs andtail. Hundreds of scales are painted, with pale cyan upper edges and deep blue lower outlines; larger head plates use thicker outlines.')
 add(mid,g,[2,11],'closed blue hand','blue skin','Ten triangles each; dark finger divisions painted on a broad hand volume.')
 add(mid,g,[3,4,5,6,7,8,12,13,14],'head horn','yellow ivory','Four or six triangles per horn; pale yellow tip, darker root and one broad highlight painted.')
 add(mid,g,[9,10],'mouth tooth strip','ivory teeth|red gums','Twelve triangles per bent strip; individual small teeth are painted cutouts.')
 add(mid,g,[15,16],'orange eyeball','orange eye','Seventy triangles per small rounded eye; dark pupil paint, geometry is unusually dense relative to horn pieces.')
 add(mid,g,[17],'gold-rimmed club head','black metal|gold trim','Twenty triangles; small round gold studs are painted in a row, not separately modeled.')
 add(mid,g,[18],'wrapped club grip','brown leather','Twelve triangles; dark diagonal wrapping strokes painted.')
 add(mid,g,[19],'gold club pommel','gold metal','Twelve triangles; square spiral motif and shine painted.')
 add(mid,g,[20],'club ring card','gold metal','Two triangles; ring hole supplied by alpha rather than loop geometry.')
 add(mid,g,list(range(21,27)),'club edge tooth','dark metal|white edge highlight','Six triangles per wedge; sharp silhouette modeled, broad white-to-black bevel painted.')
 add(mid,g+1,[1],'large scaled shield','team-colour scales|gold trim','92 triangles; scale borders outlined dark, each cell carries its own highlight. Team colour fills scale interiors.')
 add(mid,g+1,[2,3],'shield gold point','gold metal','Eight triangles each; longitudinal bright streak follows point direction.')
 add(mid,g+1,[4,5],'gold-edged wrist band','team-colour cloth|gold trim|blue skin','Eight triangles each; red centre, narrow gold borders and blue skin all packed into one small crop.')
mid='lpw-herrdave-87376'
add(mid,4,[1],'closed metal helmet','grey iron','129 triangles; dark slit paint, bright rim lines and lower jaw tooth pattern share custom sheet.')
add(mid,4,[2,10],'helmet horn socket','grey iron','Sixteen triangles each; broad central light and dark surrounding rim painted.')
add(mid,4,[3,4,5,11,12,13],'segmented helmet horn','yellow ivory','23 or24 triangles per segment; source uses a soft bright centre and dark base, with little fine surface noise.')
add(mid,4,[6],'skull belt buckle','ivory bone|dark outline','Fifteen triangles; skull silhouette and recesses mostly painted on a broad bent plate.')
add(mid,4,[7,8],'metal boot','grey iron','Fourteen triangles each; stacked plate highlights painted.')
add(mid,4,[9,16],'metal gauntlet and mail cuff','grey iron|chainmail','47 triangles each; dense mail grid is painted against broad metal highlights.')
add(mid,4,[14,15],'metal shin cuff','grey iron','Sixteen triangles each; inset rectangle and rim highlights painted.')
add(mid,4,list(range(18,25)),'layered waist armour plate','grey iron','Twelve triangles each; most use the same broad smooth metal patch with light border.')
add(mid,5,[7],'serrated team-colour pauldron','grey iron|team colour','56 triangles; zigzag metal-to-colour boundary is painted across the surface, outer curved outline modeled.')
add(mid,5,[9],'long blade edge','grey steel','Ten triangles; narrow bright metal ridge.')
add(mid,5,[13,14,15,16],'team-colour waist armour panel','grey iron|team colour','Eight,twelve,ten,ten triangles; jagged inner border painted rather than cut away.')
add(mid,7,[1],'torso cuirass with mail skirt','grey iron|chainmail','103 triangles; broad vertical plate shine contrasts with fine repeated chain rings at hem.')
add(mid,7,[2],'shield metal face','white steel|black gouges','26 triangles; dark horizontal gouges painted, no matching cutout holes in these faces.')
add(mid,7,[3],'shield wooden back','brown wood','Nine triangles; long parallel grain strokes painted.')
add(mid,7,list(range(4,17)),'shield rivet card','grey steel','Two triangles each; round rivet and screwdriver-slot look painted on flat card.')
mid='lpw-herrdave-75064'
add(mid,1,[1],'fitted coat torso','red-brown leather|gold trim|silver buttons|white cloth','98 triangles; rows of silver buttons and pale buttonholes painted onto the chest panels.')
add(mid,1,[3,4],'boot and lower-leg cloth','red-brown leather|white cloth','43 and44 triangles; broad white folds form alternating light and dark strips.')
add(mid,1,[5],'human face and neck','pale skin|dark hair|red collar','140 triangles; sunken cheeks, brow shadows and lip colour are strongly painted.')
add(mid,1,[8,10],'skull-pattern glove cuff','yellow leather|skull motif|red trim','Eighteen triangles each; small skull motif is paint on the cuff.')
add(mid,2,[2],'long thin sword','polished steel','24 triangles; central pale line and dark sides supply blade definition.')
add(mid,2,[7],'stitched broad-brim hat','red-brown leather|gold trim','64 triangles; curved stitched seams are painted and remain visible on broad smooth hat panels.')
add(mid,2,[8],'coat shoulder capelet','red-brown leather|silver button','24 triangles; button and wear marks painted.')
add(mid,2,[9],'pistol barrel and wooden grip','polished steel|brown wood','Thirty triangles; muzzle dark circle and barrel highlight painted.')
add(mid,2,[14,15],'square pistol fitting','polished steel','Eight triangles each; square opening is modeled while shine is painted.')
add(mid,2,[16],'book page block','parchment','Twelve triangles; pale flat page surface.')
add(mid,2,[17],'studded book cover','red-brown leather|silver studs|gold skull','Eight triangles; studs and skull medallion painted.')
add(mid,2,[18],'book spine','brown leather','Ten triangles; broad central highlight.')
add(mid,2,[22,23,30],'wax seal and parchment strip','red wax|parchment','Four triangles each; skull on seal and text strokes on parchment are painted.')
add(mid,5,[1],'coat upper flap','red-brown leather|gold trim','28 triangles; narrow gold edge follows visible hem.')
add(mid,5,[2],'long coat skirt','red-brown leather|gold trim|silver buttons','Thirty triangles; many horizontal fasteners are painted on each long panel.')
def mask_for(tris,w,h,flags):
 mask=np.zeros((h,w),dtype=bool)
 for tri in tris:
  p=np.array(tri).reshape(3,2)
  if not np.isfinite(p).all():continue
  xs=range(-math.floor(float(p[:,0].max())),-math.floor(float(p[:,0].min()))+1) if flags&1 else [0]
  ys=range(-math.floor(float(p[:,1].max())),-math.floor(float(p[:,1].min()))+1) if flags&2 else [0]
  for ox in xs:
   for oy in ys:
    q=(p+[ox,oy])*[w,h];lo=np.maximum(np.floor(q.min(axis=0)).astype(int),[0,0]);hi=np.minimum(np.ceil(q.max(axis=0)).astype(int),[w,h])
    if (hi<=lo).any():continue
    yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]];xx=xx+.5;yy=yy+.5
    sign=[]
    for j in range(3):
     x1,y1=q[j];x2,y2=q[(j+1)%3];sign.append((xx-x1)*(y2-y1)-(yy-y1)*(x2-x1))
    ab=q[1]-q[0];ac=q[2]-q[0];area=ab[0]*ac[1]-ab[1]*ac[0]
    if abs(float(area))<1e-8:continue
    inside=(np.minimum.reduce(sign)>=-1e-8)|(np.maximum.reduce(sign)<=1e-8);mask[lo[1]:hi[1],lo[0]:hi[0]]|=inside
 return mask
textures=json.loads((D/'lpw-textures.json').read_text('utf8'))
def decode(p):
 digest=hashlib.sha256(p.read_bytes()).hexdigest();meta=json.loads((OUT/(digest+'.json')).read_text('utf8'));return Image.frombytes('RGBA',(meta['width'],meta['height']),(OUT/(digest+'.rgba')).read_bytes())
out=[];atlases={};masks={}
for o in a:
 md=models[o['modelId']];cap=caps[o['modelId']];p=next(x for x in md['parts'] if x['id']==o['componentId']);g=next(g for g in md['geosets'] if g['geoset1']==o['geoset1']);cp=next(c for c in cap['components'] if c['id']==o['componentId']);paths=list(dict.fromkeys(t['path'] for l in g['layers'] for t in l['textureSlots'] if t.get('path')));sheet=next(s for s in cap['sheets'] if s['name'].lower()==paths[0].lower());tex=next(t for t in md['textures'] if t['path'].lower()==paths[0].lower());w,h=sheet['width'],sheet['height'];mask=mask_for(p['uv']['triangles'],w,h,tex['flags']);key=o['modelId']+'|'+paths[0].lower();masks[o['componentId']]=mask
 if key not in atlases:
  tr=next(t for t in textures if t.get('sha256')==sheet['contentHash'] and t.get('file'));file=pathlib.Path(tr['file']);file=file if file.is_absolute() else R/file;img=decode(file);atlases[key]={'image':img,'sheet':sheet,'flags':tex['flags'],'model':md,'path':paths[0]};img.save(OUT/(sheet['contentHash']+'.png'))
 pixels=np.array(atlases[key]['image'])[mask];tc=any(t.get('replaceableId')==1 for l in g['layers'] for t in l['textureSlots']);out.append({**o,'triangles':p['triangles'],'vertices':p['vertices'],'distinctPositions':p['distinctPositions'],'uvBounds':p['uv']['bounds'],'uvTriangles':p['uv']['triangles'],'sourceTexturePaths':paths,'sourceTextureSha256':sheet['contentHash'],'textureDimensions':[w,h],'textureFlags':tex['flags'],'teamColourUnderlayer':tc,'mappedPixelCentres':int(mask.sum()),'atlasPixelFraction':round(float(mask.mean()),6),'mappedRgbMean':[round(float(x),2) for x in pixels[:,:3].mean(axis=0)] if len(pixels) else None,'alphaBelow128Fraction':round(float((pixels[:,3]<128).mean()),6) if len(pixels) else None,'alphaBelow255Fraction':round(float((pixels[:,3]<255).mean()),6) if len(pixels) else None,'visualEvidence':[f"captures/models/{o['modelId']}/{cp['file']}",f"captures/models/{o['modelId']}/{cp['sideFile']}"],'visibleAtSample':p['visible'],'pixelMeasurement':'Union of triangle footprints sampled at original sheet pixel centres; overlaps counted once per component. Repeat applied only on authored texture flag axes. Alpha is image data, not an automatic material interpretation.'})
for key,at in atlases.items():
 mid=key.split('|')[0];md=at['model'];alltris=[t for p in md['parts'] if any(at['path'].lower()==t['path'].lower() for g in md['geosets'] if g['geoset1']==p['geoset1'] for l in g['layers'] for t in l['textureSlots'] if t.get('path')) for t in p['uv']['triangles']];whole=mask_for(alltris,at['sheet']['width'],at['sheet']['height'],at['flags']);at['mappedWholePixels']=int(whole.sum())
 for o in out:
  if o['modelId']==mid and o['sourceTextureSha256']==at['sheet']['contentHash']:o['fractionOfAllMappedAtlasPixels']=round(o['mappedPixelCentres']/at['mappedWholePixels'],6) if at['mappedWholePixels'] else 0
 # Three-column contact atlas shows exact UV masks with each selected source part.
 group=[o for o in out if o['modelId']==mid and o['sourceTextureSha256']==at['sheet']['contentHash']];font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',12);canvas=Image.new('RGB',(960,math.ceil(len(group)/3)*370),'#172026');dr=ImageDraw.Draw(canvas)
 for i,o in enumerate(group):
  x=(i%3)*320;y=(i//3)*370;base=at['image'].convert('RGB').resize((300,300),Image.Resampling.NEAREST);ma=Image.fromarray((masks[o['componentId']]*210).astype('uint8')).resize((300,300),Image.Resampling.NEAREST);overlay=Image.new('RGB',(300,300),'#ffc93f');base=Image.blend(base,Image.composite(overlay,base,ma),.35);canvas.paste(base,(x+10,y+40));dr.text((x+8,y+6),f"g{o['geoset1']}:c{o['component1']} | {o['label'][:36]}",font=font,fill='white');dr.text((x+8,y+22),f"{o['triangles']} triangles | {o['mappedPixelCentres']} pixels ({o['atlasPixelFraction']*100:.2f}% sheet)",font=font,fill='white')
 canvas.save(OUT/(mid+'-regions.webp'),quality=88)
for dest in [D/'annotations/custom-painting-parts.json',DOC/'data/custom-painting-parts.json']:dest.write_text(json.dumps(out,indent=2),encoding='utf8')
summary=[{'modelId':key.split('|')[0],'texturePath':at['path'],'sha256':at['sheet']['contentHash'],'dimensions':[at['sheet']['width'],at['sheet']['height']],'mappedWholePixels':at['mappedWholePixels'],'mappedFraction':round(at['mappedWholePixels']/(at['sheet']['width']*at['sheet']['height']),6),'regionSheet':str(OUT/(key.split('|')[0]+'-regions.webp'))} for key,at in atlases.items()]
for dest in [D/'custom-painting-atlases.json',DOC/'data/custom-painting-atlases.json']:dest.write_text(json.dumps(summary,indent=2),encoding='utf8')
print(json.dumps({'labels':len(out),'atlases':summary}))

# Offline source/region browser is regenerated with the data.
page='<!doctype html><meta charset="utf-8"><title>Custom painting evidence</title><style>body{background:#172026;color:white;font:17px Arial;margin:30px}img{max-width:100%}a{color:#9ad3ff}</style><h1>Custom painting: exact reviewed UV regions</h1><p>Gold overlays are real triangle footprints, not proposed rectangles. Multiple parts may map to the same painted pixels.</p>'
for atlas in summary:
 mid=atlas['modelId'];page+=f'<h2>{mid}</h2><p><a href="../../captures/models/{mid}/index.html">Model and component captures</a></p><img src="{mid}-regions.webp">'
(OUT/'index.html').write_text(page,encoding='utf8')
