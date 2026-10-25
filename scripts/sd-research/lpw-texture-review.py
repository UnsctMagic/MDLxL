"""Build inspectable texture atlases of every sheet used by the owner's 26 LPW models."""
from pathlib import Path
import json, hashlib, math, struct
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont
root=Path('D:/Codex/sd-research'); raw=root/'lowpolyworks'; catalog=json.loads((raw/'catalogue.json').read_text('utf-8'));mapping=json.loads((raw/'textures.json').read_text('utf-8'))
models=[m for m in catalog if any('Unsanctioned' in a['name'] for a in m['authors'])];usage=defaultdict(list)
for m in models:
 for g in m['geosets']:
  for t in set(g['textures']):
   if t!='Team colour / glow':usage[t.lower().replace('/','\\')].append({'modelId':'lpw-'+m['id'],'geoset1':g['index']+1,'triangles':g['triangles']})
for m in models:
 measured=json.loads((root/('data/parts/lpw-'+m['id']+'.json')).read_text('utf-8'))
 for t in measured['textures']:
  if t['path']:
   key=t['path'].lower().replace('/','\\')
   if not any(u['modelId']=='lpw-'+m['id'] for u in usage[key]):usage[key].append({'modelId':'lpw-'+m['id'],'geoset1':None,'usage':'texture table; not present in catalogue geosets'})
def decode(p):
 try:return Image.open(p).convert('RGBA')
 except (ValueError,OSError,NotImplementedError):
  b=p.read_bytes()
  if b[:4]==b'BLP1' and struct.unpack_from('<I',b,4)[0]==1:
   bits,w,h=struct.unpack_from('<III',b,8);offset=struct.unpack_from('<I',b,28)[0];size=w*h;pixels=bytearray(size*4)
   for i in range(size):
    q=156+b[offset+i]*4;alpha=255 if not bits else ((b[offset+size+(i*bits)//8]>>((i*bits)%8))&((1<<bits)-1))*255//((1<<bits)-1)
    pixels[i*4:i*4+4]=bytes((b[q+2],b[q+1],b[q],alpha))
   return Image.frombytes('RGBA',(w,h),bytes(pixels))
  if b[:4]==b'BLP2' and b[8]==3:
   w,h,offset=struct.unpack_from('<III',b,12);return Image.frombytes('RGBA',(w,h),b[offset:offset+w*h*4],'raw','BGRA')
  raise
ordered=sorted(usage,key=lambda t:(-len({x['modelId'] for x in usage[t]}),t));folder=root/'pictures/owner-textures';folder.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',12);big=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',17)
records=[]
for i,t in enumerate(ordered):
 target=mapping.get(t);p=raw/target if target else None; record={'reference':t,'uses':usage[t],'atlasNumber':i+1}
 if p and p.exists():
  try:
   dest=folder/(hashlib.sha256(t.encode()).hexdigest()[:16]+'.png');img=Image.open(dest).convert('RGBA');record.update(width=img.width,height=img.height,file=p.as_posix());record['decodedFile']=dest.as_posix()
  except Exception as e:record['decodeError']=str(e)
 else:record['missing']=True
 records.append(record)
for batch in range(math.ceil(len(records)/20)):
 group=records[batch*20:(batch+1)*20];sheet=Image.new('RGB',(1200,55+math.ceil(len(group)/5)*295),'#29292e');draw=ImageDraw.Draw(sheet);draw.text((12,12),f'Owner native sheets: RGB paint (alpha shown separately later) | atlas {batch+1}',font=big,fill='white')
 for j,r in enumerate(group):
  x=j%5*240;y=55+j//5*295
  if r.get('decodedFile'):
   img=Image.open(r['decodedFile']);img.thumbnail((232,232));sheet.paste(img.convert('RGB'),(x+(240-img.width)//2,y))
  text=r['reference'].replace('\\','/')
  tail=text.split('/')[-1];prefix='/'.join(text.split('/')[-3:-1]);lines=[f'{r["atlasNumber"]}. {tail}',prefix,f'{len(set(u["modelId"] for u in r["uses"]))} models | {len(r["uses"])} geosets']
  for k,line in enumerate(lines):draw.text((x+5,y+235+k*17),line[:36],font=font,fill='white')
 sheet.save(folder/f'atlas-{batch+1:02}.jpg',quality=92)
(root/'data/lpw-owner-texture-review.json').write_text(json.dumps(records,indent=2),'utf-8');print(json.dumps({'ownerModels':len(models),'uniqueReferences':len(records),'atlases':math.ceil(len(records)/20),'decodeFailures':sum('decodeError' in r or 'missing' in r for r in records)}))