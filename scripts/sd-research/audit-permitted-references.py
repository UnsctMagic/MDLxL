from pathlib import Path
import json,re,collections
R=Path('D:/Codex/sd-research'); prior=Path('D:/Codex/mdlxl-sd-rulebook-20261024')
allow=json.loads((prior/'outputs/hive-catalogue.json').read_text('utf8'))['resources'];allowed={x['url'].rstrip('/') for x in allow}
allcards=json.loads((prior/'work/hive-ranking-private.json').read_text('utf8'))['cards'];excluded=[x for x in allcards if x['url'].rstrip('/') not in allowed]
records=[]
for p in (R/'repo/docs/SD-RESEARCH').rglob('*'):
 if not p.is_file() or p.suffix not in ['.json','.md','.csv','.jsonl','.html']:continue
 s=p.read_text('utf-8-sig');url_hits=[];title_hits=[]
 for i,x in enumerate(excluded):
  u=x['url'].rstrip('/');title=x['title'];
  if u.lower() in s.lower():url_hits.append(i)
  if title and len(title)>=5 and re.search(r'(?<!\w)'+re.escape(title)+r'(?!\w)',s,re.I):title_hits.append(i)
 if url_hits or title_hits:records.append({'file':str(p.relative_to(R/'repo')),'urlMatches':len(url_hits),'titleCandidates':len(title_hits),'urlIndices':url_hits,'titleIndices':title_hits})
result={'scope':'Private read-only scan of derived SD research docs/data; titles are candidates until native-name collisions are checked','nonPermittedResourceCount':len(excluded),'files':records}
(R/'data/excluded-reference-audit.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps({'nonPermittedResourceCount':len(excluded),'affected':[{'file':r['file'],'urlMatches':r['urlMatches'],'titleCandidates':r['titleCandidates']} for r in records]},indent=2))
