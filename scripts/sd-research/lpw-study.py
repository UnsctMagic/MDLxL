"""Derive provenance records and offline contact sheets from the exact downloaded LPW catalogue."""
import argparse, json, re, zipfile, hashlib, math
from pathlib import Path
from collections import Counter
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('--root',default='D:/Codex/sd-research');a=p.parse_args()
root=Path(a.root);raw=root/'lowpolyworks';out=root/'repo/docs/SD-RESEARCH/data';out.mkdir(parents=True,exist_ok=True)
models=json.loads((raw/'catalogue.json').read_text('utf-8'));textures=json.loads((raw/'textures.json').read_text('utf-8'))
write=lambda file,data:file.write_text(json.dumps(data,indent=2,ensure_ascii=False),'utf-8')
# Archive inventory is retained. Only textures are extracted, and hash-identical members share one file.
extracted=root/'lowpolyworks/pack-textures';extracted.mkdir(exist_ok=True)
archive_members=[]
for archive in sorted((raw/'downloads').rglob('*.zip')):
 with zipfile.ZipFile(archive) as z:
  for member in z.infolist():
   if member.is_dir():continue
   entry={'archive':archive.relative_to(raw).as_posix(),'member':member.filename,'bytes':member.file_size,'compressedBytes':member.compress_size,'crc32':f'{member.CRC:08x}'}
   if Path(member.filename).suffix.lower() in ('.blp','.tga','.dds','.png','.jpg','.jpeg'):
    data=z.read(member);h=hashlib.sha256(data).hexdigest();target=extracted/(h+Path(member.filename).suffix.lower())
    if not target.exists():target.write_bytes(data)
    entry.update(sha256=h,extractedPath=target.as_posix())
   archive_members.append(entry)
write(raw/'pack-members.json',archive_members)
# Credit prose is testimony, not proof of geometry identity. Keep all raw clauses and distinguish modelling operations.
credits=[]
for m in models:
 lines=[v.strip(' \r\n') for v in re.split(r'[\r\n]+',m.get('credits','')) if v.strip()]
 for i,line in enumerate(lines):
  split=re.split(r'\s+[-–—]\s*',line,maxsplit=1)
  part,source=(split+[None])[:2]
  kind='credit-claim' if source else 'unparsed-credit-clause'
  if part.lower()=='attitude':kind='figurative-comment'
  edits=[]
  for term in ('reshaped','adapted','modified','edited','projected','skinned','wrapped','frames','smooth','converted','based on'):
   if term in line.lower():edits.append(term)
  credit={'id':f'lpw-{m["id"]}:credit:{i+1}','modelId':'lpw-'+m['id'],'modelName':m['name'],'partLabel':part,'sourceClaim':source,'rawClause':line,'recordKind':kind,'explicitOperationWords':edits,'geometryMatchStatus':'not-yet-matched','confidence':'author-stated' if kind=='credit-claim' else 'unresolved','sourceUrl':'https://www.lowpolyworks.com/catalogue.json'}
  credits.append(credit)
write(out/'lpw-credit-provenance.json',credits)
# Family sheets here are published website thumbnail observations, not newly rendered multi-angle captures.
fontpath='C:/Windows/Fonts/segoeui.ttf';font=ImageFont.truetype(fontpath,15);small=ImageFont.truetype(fontpath,12)
groups={}
for m in models:groups.setdefault(m['army'],[]).append(m)
groups['unsanctioned-magic']=[m for m in models if any('Unsanctioned' in au['name'] for au in m.get('authors',[]))]
gallery=root/'pictures/lowpolyworks';gallery.mkdir(parents=True,exist_ok=True)
index=[]
for group,rows in groups.items():
 for batch in range(math.ceil(len(rows)/12)):
  subset=rows[batch*12:(batch+1)*12];w=1000;h=55+math.ceil(len(subset)/4)*300
  sheet=Image.new('RGB',(w,h),(29,29,32));d=ImageDraw.Draw(sheet);d.text((12,12),f'{group} | published LowPolyWorks thumbnails | page {batch+1}',font=font,fill='white')
  for j,m in enumerate(subset):
   x=j%4*250;y=55+j//4*300;img=Image.open(raw/('thumbs/unit-'+m['id']+'.png')).convert('RGBA');img.thumbnail((244,234))
   sheet.paste(img,(x+(250-img.width)//2,y),img)
   name=m['name'];lines=[]
   while name:
    end=min(len(name),30)
    if end<len(name) and ' ' in name[:end]:end=name[:end].rfind(' ')
    lines.append(name[:end]);name=name[end:].lstrip()
   for k,line in enumerate(lines[:2]):d.text((x+6,y+234+k*17),line,font=small,fill='white')
   tris=sum(g['triangles'] for g in m['geosets']);sheets=len({t.lower() for g in m['geosets'] for t in g['textures'] if t!='Team colour / glow'})
   d.text((x+6,y+270),f'{tris} tris | {len(m["geosets"])} geosets | {sheets} refs',font=small,fill='#bbbbaa')
  dest=gallery/f'{group}-{batch+1}.jpg';sheet.save(dest,quality=91)
  index.append({'group':group,'path':dest.as_posix(),'models':['lpw-'+m['id'] for m in subset],'imageSource':'published thumbnail; not study-rendered camera views'})
write(gallery/'index.json',index)
print(json.dumps({'provenanceClauses':len(credits),'textureArchiveMembers':sum('sha256' in e for e in archive_members),'allArchiveMembers':len(archive_members),'contactSheets':len(index)}))