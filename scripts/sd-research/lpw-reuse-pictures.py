"""Picture evidence for native texture reuse: exact UV mask, fitted part, and carrier context."""
from pathlib import Path
import json, math, hashlib
from PIL import Image, ImageDraw, ImageFont
root=Path('D:/Codex/sd-research');out=root/'pictures/owner-reuse';out.mkdir(parents=True,exist_ok=True)
records=json.loads((root/'repo/docs/SD-RESEARCH/data/lpw-semantic-owner-parts.json').read_text('utf-8')); parsed={}
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18);small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',14)
chosen=['g6:c1','g12:c1','g8:c1','g18:c1','g19:c1','g22:c1','g25:c1','g28:c1','g21:c1','g23:c1','g11:c1','g5:c8']
chosen=['lpw-graveguard:'+v for v in chosen]+[
'lpw-warrior-of-tzeentch:g15:c1','lpw-warrior-of-tzeentch:g16:c1','lpw-warrior-of-tzeentch:g28:c1',
'lpw-chaos-ogre:g11:c1','lpw-chaos-ogre:g4:c14','lpw-chaos-ogre:g6:c1',
'lpw-nurgle-standard:g4:c4','lpw-nurgle-standard:g10:c1','lpw-nurgle-standard:g19:c10','lpw-nurgle-standard:g20:c10','lpw-nurgle-standard:g22:c1','lpw-nurgle-standard:g23:c1','lpw-nurgle-standard:g29:c1','lpw-nurgle-standard:g30:c1','lpw-nurgle-standard:g32:c1',
'lpw-undivided-sword:g25:c1','lpw-undivided-sword:g29:c2','lpw-undivided-sword:g31:c1',
'lpw-khorne-axe:g12:c1','lpw-khorne-axe:g39:c1','lpw-khorne-axe:g40:c1','lpw-khorne-axe:g43:c3',
'lpw-slaanesh-axe:g1:c1','lpw-slaanesh-axe:g9:c1','lpw-slaanesh-axe:g27:c2','lpw-slaanesh-axe:g28:c1','lpw-slaanesh-axe:g34:c2','lpw-slaanesh-axe:g35:c2']
chosen += [
'lpw-khorne-flail:g37:c1','lpw-khorne-flail:g35:c1','lpw-kurgan-warlord:g9:c1','lpw-kurgan-warlord:g6:c1','lpw-warrior-of-khorne-cleaver:g19:c1','lpw-warrior-of-khorne-cleaver:g17:c1','lpw-warrior-of-khorne-berserker:g24:c1','lpw-warrior-of-khorne-berserker:g29:c1','lpw-warrior-of-khorne:g12:c10','lpw-warrior-of-khorne:g19:c1','lpw-chaos-warrior-of-nurgle:g7:c1','lpw-chaos-warrior-of-nurgle:g23:c1','lpw-chaos-warrior-of-nurgle:g9:c2','lpw-chaos-warrior-of-nurgle:g20:c1','lpw-nurgle-champion:g32:c1','lpw-nurgle-champion:g37:c1','lpw-nurgle-champion:g43:c3','lpw-tzeentch-sword:g20:c1','lpw-tzeentch-sword:g29:c1','lpw-tzeentch-lance:g19:c1','lpw-von-carstein:g9:c1','lpw-necrarch-vampire:g20:c1','lpw-necrarch-vampire:g23:c1','lpw-blood-dragon:g18:c1','lpw-blood-dragon:g19:c1','lpw-blood-dragon:g28:c1','lpw-aspiring:g2:c1']
chosen += ['lpw-khorne-flail:g34:c1','lpw-aspiring:g5:c1','lpw-aspiring:g3:c1','lpw-aspiring:g14:c1','lpw-tzeentch-sword:g15:c1','lpw-tzeentch-sword:g30:c1']
model_names={m['id']:m['name']for m in json.loads((root/'data/lpw-manifest.json').read_text('utf-8'))}
measurements={(x['componentId'],x['texturePath'].lower()):x for x in json.loads((root/'repo/docs/SD-RESEARCH/data/lpw-region-pixel-measurements.json').read_text('utf-8'))}
summary=[]
for rid in chosen:
 mid,suffix=rid.split(':',1)
 if mid not in parsed: parsed[mid]=json.loads((root/f'data/parts/{mid}.json').read_text('utf-8'))
 r=next(v for v in records if v['componentId']==rid);part=next(p for p in parsed[mid]['parts']if p['id']==rid);t=r['sourceTexturePaths'][0].lower();source=root/('pictures/owner-textures/'+hashlib.sha256(t.encode()).hexdigest()[:16]+'.png');img=Image.open(source).convert('RGBA');overlay=Image.new('RGBA',img.size);od=ImageDraw.Draw(overlay)
 flags=next(tex['flags']for tex in parsed[mid]['textures']if tex['path'].lower()==t)
 for tri in part['uv']['triangles']:
  us=tri[0::2];vs=tri[1::2]
  for du in (range(math.floor(min(us)),math.floor(max(us))+1) if flags&1 else [0]):
   for dv in (range(math.floor(min(vs)),math.floor(max(vs))+1) if flags&2 else [0]):
    poly=[((u-du)*img.width,(v-dv)*img.height)for u,v in zip(us,vs)];od.polygon(poly,fill=(0,240,255,50),outline=(0,255,255,210))
 painted=img.convert('RGB').convert('RGBA');painted.alpha_composite(overlay);painted=painted.resize((round(painted.width*min(350/painted.width,350/painted.height)),round(painted.height*min(350/painted.width,350/painted.height))),Image.Resampling.NEAREST)
 sheet=Image.new('RGB',(1400,500),'#24292e');d=ImageDraw.Draw(sheet);d.text((16,12),f'{model_names[mid]} | {suffix} | {r["label"]} | {r["triangles"]} triangles',font=font,fill='white');d.text((16,42),t,font=small,fill='#dddddd')
 sheet.paste(painted.convert('RGB'),(16,100));d.text((16,78),'Source sheet with exact UV triangles',font=small,fill='white')
 for j,evidence in enumerate(r['visualEvidence'][:2]):
  image=Image.open(root/evidence).convert('RGB');image.thumbnail((400,350));sheet.paste(image,(390+j*400,100));d.text((390+j*400,78),['Fitted game-angle part','Second fitted angle'][j],font=small,fill='white')
 context=Image.open(root/f'captures/models/{mid}/view-1.webp').convert('RGB');context.thumbnail((180,180));sheet.paste(context,(1210,110));d.text((1200,78),'Carrier reference',font=small,fill='white')
 measurement=measurements[(rid,t)];assert measurement['dimensions']==[img.width,img.height];count=measurement['mappedPixelCentres'];coverage=count/(img.width*img.height);d.text((16,462),f'UV coverage at original {img.width}x{img.height} pixel centres: {coverage:.2%}. Cyan is mapped paint, not a guessed rectangle.',font=small,fill='#dddddd')
 dest=out/(((''if mid=='lpw-graveguard'else mid+'-')+suffix.replace(':','-'))+'.jpg');sheet.save(dest,quality=94);summary.append({'componentId':rid,'label':r['label'],'sourceTexturePath':t,'triangles':r['triangles'],'uvCoveredPixels':count,'texturePixels':img.width*img.height,'uvCoveredFraction':coverage,'picture':dest.relative_to(root).as_posix(),'textureFlags':flags,'clampEdgePixelsOmitted':measurement['clampedEdgeFootprintOmitted'],'coverageMethod':'Union of exact UV triangles sampled at native pixel centres; authored repeat flags respected; clamped outside footprint omitted. Canonical lpw-region-pixel-measurements.json values.'})
(root/'repo/docs/SD-RESEARCH/data/lpw-graveguard-picture-evidence.json').write_text(json.dumps([r for r in summary if r['componentId'].startswith('lpw-graveguard:')],indent=2),'utf-8');(root/'repo/docs/SD-RESEARCH/data/lpw-owner-picture-evidence.json').write_text(json.dumps(summary,indent=2),'utf-8');print(json.dumps({'pictures':len(summary)}))