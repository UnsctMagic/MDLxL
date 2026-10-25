from pathlib import Path
import json,re,gzip,argparse,hashlib
parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
R=Path('D:/Codex/sd-research');P=Path('D:/Codex/mdlxl-sd-rulebook-20261024');DOC=R/'repo/docs/SD-RESEARCH'
allowed={x['url'].rstrip('/').lower() for x in json.loads((P/'outputs/hive-catalogue.json').read_text('utf8'))['resources']}
excluded=[x for x in json.loads((P/'work/hive-ranking-private.json').read_text('utf8'))['cards'] if x['url'].rstrip('/').lower() not in allowed]
urls=[x['url'].rstrip('/') for x in excluded];titles=[x['title'] for x in excluded]
reason='Source is not in the permitted source corpus.'
def badurl(s):return isinstance(s,str) and any(u.lower() in s.lower() for u in urls)
def badtitle(s):return isinstance(s,str) and any(len(t)>=5 and re.search(r'(?<!\w)'+re.escape(t)+r'(?!\w)',s,re.I) for t in titles)
def sanitize(v):
 if isinstance(v,list):return [sanitize(x) for x in v]
 if not isinstance(v,dict):return v
 out={k:sanitize(x) for k,x in v.items()}
 # Resource references are distinct from model names. Native paths and the full
 # requested LPW model roster remain intact even when an outside title collides.
 original=str(v.get('partLabel','')).strip().lower()=='original resource'
 if original and (badtitle(v.get('sourceClaim')) or badurl(v.get('sourceUrl'))):
  for key in ['sourceClaim','rawClause']:out[key]=reason
  out['sourceUrl']=None
 for key in ['url','sourceUrl','downloadUrl','resourceUrl']:
  if badurl(v.get(key)):
   out[key]=None;out['sourceAvailability']=reason
   if key=='url' and 'text' in v:out['text']='Source outside the permitted corpus'
 if badtitle(v.get('sourcePack')):out['sourcePack']=None;out['sourceAvailability']=reason
 if isinstance(v.get('credits'),str):
  out['credits']='\n'.join(reason if (re.search(r'original\s+resource',line,re.I) and badtitle(line)) or badurl(line) else line for line in v['credits'].split('\n'))
 if isinstance(v.get('textureFiles'),dict) and any(badtitle(x) for x in v['textureFiles'].values()):
  out.pop('textureFiles',None);out['textureFilesLocation']='Original mappings are retained in local LowPolyWorks download metadata.'
 return out

def sanitize_markdown(text):
 # Only linked resources or explicit source clauses; native and LPW asset names
 # in ordinary descriptive prose are not resource references.
 text=re.sub(r'\[([^\]]*)\]\((https?://[^)]+)\)',lambda m:reason if badurl(m[2]) else m[0],text)
 return '\n'.join(reason if re.search(r'original\s+resource\s*[-:]',l,re.I) and badtitle(l) else l for l in text.split('\n'))
paths=[p for p in DOC.rglob('*') if p.is_file() and (p.suffix in ['.json','.md','.jsonl'] or p.name.endswith(('.json.gz','.jsonl.gz'))) ]
# These are derived copies only. The public downloaded catalogue stays unchanged.
for name in ['category-models.json','lpw-credit-provenance.json','lpw-models.json','models-sd.jsonl.gz']:
 p=R/'data'/name
 if p.exists():paths.append(p)
changes=[];remaining=[]
for p in paths:
 zipped=p.suffix=='.gz';raw=gzip.decompress(p.read_bytes()) if zipped else p.read_bytes();text=raw.decode('utf-8-sig')
 if p.suffix=='.md':result=sanitize_markdown(text)
 elif '.jsonl' in p.name:
  result='\n'.join(json.dumps(sanitize(json.loads(l)),ensure_ascii=False,separators=(',',':')) for l in text.splitlines() if l.strip())+'\n'
 else:result=json.dumps(sanitize(json.loads(text)),ensure_ascii=False,separators=(',',':'))
 if any(u.lower() in result.lower() for u in urls):remaining.append(str(p.relative_to(R)))
 if result!=text:
  # Re-serialization alone is not a change to report or write.
  different=(result!=text) if p.suffix=='.md' else (json.loads(result)!=json.loads(text) if '.jsonl' not in p.name else any(json.loads(a)!=json.loads(b) for a,b in zip(result.splitlines(),text.splitlines())))
  if different:
   changes.append({'file':str(p.relative_to(R)),'sha256Before':hashlib.sha256(raw).hexdigest(),'sha256After':hashlib.sha256(result.encode()).hexdigest()})
   if args.apply:
    blob=result.encode('utf8');p.write_bytes(gzip.compress(blob,compresslevel=6,mtime=0) if zipped else blob)
report={'applied':args.apply,'nonPermittedResourcesChecked':len(excluded),'changedFiles':changes,'remainingNonPermittedUrlFiles':remaining,'collisionPolicy':'Preserve native asset names/paths and explicitly requested LPW model names. Remove only nonpermitted resource URL/title references in provenance metadata. Raw downloads are unchanged.'}
(R/'data/permitted-reference-sanitization.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'applied':args.apply,'changedFiles':[x['file'] for x in changes],'remainingNonPermittedUrlFiles':remaining},indent=2))
if remaining:raise SystemExit(2)
