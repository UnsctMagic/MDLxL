from research_scope import is_active_sd
"""Research consistency audit; never edits the game, assets or application."""
import ast,gzip,hashlib,json,re,subprocess
from pathlib import Path
from collections import Counter
R=Path('D:/Codex/sd-research');P=R/'repo';D=P/'docs/SD-RESEARCH/data'
issues=[];counts=Counter();ids=set();modelids=set()
for f in sorted((R/'data/parts').glob('*.json')):
 m=json.loads(f.read_text('utf-8-sig'))
 if not is_active_sd(m):continue
 counts['models']+=1;modelids.add(m['id']);tri=Counter();seen={}
 source=Path(m['file']);source=source if source.is_absolute()else R/source
 if not source.exists():source=Path(str(source)+'.gz')
 if not source.exists():issues.append({'kind':'sourceMissing','id':m['id']})
 else:
  raw=source.read_bytes();raw=gzip.decompress(raw)if source.suffix=='.gz'else raw
  if m.get('sha256')and hashlib.sha256(raw).hexdigest()!=m['sha256']:issues.append({'kind':'sourceHash','id':m['id']})
 for part in m['parts']:
  if part['id']in ids:issues.append({'kind':'duplicatePart','id':part['id']})
  ids.add(part['id']);counts['components']+=1;tri[part['geoset1']]+=part['triangles']
  faces=part['faces0'];prior=seen.setdefault(part['geoset1'],set())
  if len(faces)!=part['triangles']or prior.intersection(faces):issues.append({'kind':'partitionOverlapOrCount','id':part['id']})
  prior.update(faces)
  if part['distinctPositions']>part['vertices']:issues.append({'kind':'positionCount','id':part['id']})
 for g in m['geosets']:
  if tri[g['geoset1']]!=g['triangles']or seen.get(g['geoset1'],set())!=set(range(g['triangles'])):issues.append({'kind':'triangleConservation','id':m['id'],'geoset':g['geoset1']})
 if sum(tri.values())!=m['triangles']:issues.append({'kind':'modelTriangleConservation','id':m['id']})
for name in ['native-reviewed-parts.json','native-transferred-parts.json','lpw-semantic-owner-parts.json','lpw-selective-parts.json','custom-painting-parts.json']:
 seen=set()
 for a in json.loads((D/name).read_text('utf-8-sig')):
  key=a.get('partId',a.get('componentId'))
  if key in seen or key not in ids:issues.append({'kind':'annotationId','dataset':name,'id':key})
  seen.add(key);counts['annotationRecords']+=1
for name,expected in [('models-sd.jsonl.gz',modelids),('parts-sd.jsonl.gz',ids)]:
 with gzip.open(D/name,'rt',encoding='utf-8')as f:actual={json.loads(line)['id']for line in f}
 if actual!=expected:issues.append({'kind':'exportMembership','dataset':name,'missing':len(expected-actual),'extra':len(actual-expected)})
for p in (P/'scripts/sd-research').glob('*.py'):
 try:ast.parse(p.read_text('utf-8-sig'));counts['pythonParsed']+=1
 except SyntaxError as e:issues.append({'kind':'syntax','file':p.name,'error':str(e)})
for p in list((P/'scripts/sd-research').glob('*.mjs'))+list((P/'scripts/sd-research').glob('*.js')):
 result=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 if result.returncode:issues.append({'kind':'syntax','file':p.name,'error':result.stderr})
 else:counts['javascriptParsed']+=1
for p in (P/'docs/SD-RESEARCH').rglob('*.md'):
 for match in re.finditer(r'!?\[[^\]]*\]\(([^)]+)\)',p.read_text('utf-8-sig')):
  target=match.group(1).strip('<>').split('#')[0]
  if not target or re.match(r'^(https?://|codex:|mailto:)',target):continue
  f=Path(target)if re.match(r'^[A-Z]:[/\\]',target,re.I)else p.parent/target
  counts['documentLinks']+=1
  if not f.exists():issues.append({'kind':'missingDocumentTarget','document':str(p.relative_to(P)),'target':target})
result={'scope':'SD source/measurement/export/link consistency. This is not visual completeness or game acceptance.','counts':dict(counts),'issues':issues}
(R/'data/checkpoint-audit.json').write_text(json.dumps(result,indent=2),'utf-8')
print(json.dumps({'counts':dict(counts),'issues':len(issues),'kinds':dict(Counter(x['kind']for x in issues))}))
raise SystemExit(bool(issues))
