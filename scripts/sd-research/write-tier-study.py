# Supplementary unfinished historical script. Outside the active SD-only study; not run after scope correction.
import json,pathlib
R=pathlib.Path('D:/Codex/sd-research');D=R/'data';OUT=R/'repo/docs/SD-RESEARCH/subjects/categories'
rows=json.loads((D/'category-models.json').read_text());norms=json.loads((D/'category-norms.json').read_text())
def tbl(head,body):return '| '+' | '.join(head)+' |\n| '+' | '.join('---' for _ in head)+' |\n'+'\n'.join('| '+' | '.join(str(v) for v in r)+' |' for r in body)+'\n'
def num(v):return f'{v:,}' if isinstance(v,int) else str(v)
def path(r):return r['path'].split(':')[-1].lower()
def source(r):return f"{r['tier'].upper()} `{path(r)}`"
base=['units\\human\\footman\\footman.mdx','units\\orc\\grunt\\grunt.mdx','units\\nightelf\\archer\\archer.mdx','units\\undead\\ghoul\\ghoul.mdx','buildings\\human\\townhall\\townhall.mdx','buildings\\orc\\greathall\\greathall.mdx','buildings\\undead\\necropolis\\necropolis.mdx']
samples=[r for p in base for t in ['sd','hd','de'] for r in rows if r['source']=='blizzard' and r['tier']==t and path(r)==p]
manifest=json.loads((D/'native-manifest.json').read_text())
coverage={t:dict(extracted=sum(x['tier']==t for x in manifest),measured=sum(x['source']=='blizzard' and x['tier']==t for x in rows)) for t in ['sd','hd','de']}
text='# SD, HD and DE are separate evidence tiers\n\n'
text+='The tier names below identify the installed CASC module: base `war3.w3mod`, `_hd.w3mod`, and `_hd.w3mod:_de.w3mod`. They are not inferred from polygon counts. The SD namespace also contains large cinematic scenes; those remain outside battlefield unit baselines.\n\n'
text+=tbl(['Tier','Extracted unique model contents','Successful category measurements'],[[t.upper(),coverage[t]['extracted'],coverage[t]['measured']] for t in coverage])
text+='\nThe following models have the same logical asset path across tiers. File triangles include every stored LOD and hidden state; sampled body counts include only visible LOD0 geosets and exclude replaceable glow. They are authored geometry measurements, not renderer performance figures.\n\n'
text+=tbl(['Source model','File triangles','LOD0 stored','Sample body LOD0','LOD levels','Declared texture paths','Sample diffuse paths','Model KiB'],[[source(r),num(r['wholeFileTriangles']),num(r['lod0Triangles']),num(r['sampleBodyTrianglesLod0']),','.join(str(v) for v in r['lodLevels']),r['declaredTexturePaths'],r['diffuseSheets'],round(r['bytes']/1024,1)] for r in samples])
text+='\n'
for p in base[:3]:
 ss=[r for r in samples if path(r)==p]
 if len(ss)>1:
  text+='; '.join(f"{source(r)} stores {num(r['wholeFileTriangles'])} triangles but contributes {num(r['sampleBodyTrianglesLod0'])} visible body triangles at its recorded {r['sample']['sequence']} sample" for r in ss)+'. These quantities describe different things and cannot be used interchangeably.\n\n'
# Use official unit object identities when logical paths change between tiers.
pairs=[]
for oid in ['Edem','Udea','Hamg','Ofar','Emoo']:
 groups=[]
 for t in ['sd','hd','de']:
  matches=[r for r in rows if r['source']=='blizzard' and r['tier']==t and oid in r['officialUnitIds'] and r['category'] in ['unit','hero']]
  for r in matches:groups.append(r)
 if len({r['tier'] for r in groups})>1:
  pairs.extend((oid,r) for r in groups)
if pairs:
 text+='Official unit identity also matters. The same World Editor object can point to different model paths in different tiers. The table follows the actual UnitUI/UnitData/skin assignment, rather than assuming a same-named file is the configured character.\n\n'
 text+=tbl(['Object ID','Tier','Configured model','Sample body LOD0','Texture slot kinds'],[[oid,r['tier'].upper(),path(r),num(r['sampleBodyTrianglesLod0']),', '.join(r['materialTextureSlotKinds'])] for oid,r in pairs])+'\n'
versions={t:sorted(set(r['version'] for r in rows if r['source']=='blizzard' and r['tier']==t)) for t in ['sd','hd','de']}
text+='In the compared '+', '.join(source(r) for r in samples[:3])+', format versions are '+', '.join(str(r['version']) for r in samples[:3])+'. The art tier therefore comes from storage provenance, not the MDX version field.\n\n'
text+='Material channels are kept separate. Each listed source retains its diffuse TextureID paths and the actual additional slot names in `category-models.json`; counting all declared normal, ORM, emissive, corpse and variant paths as visible colour sheets would inflate the comparison.\n\n'
text+=tbl(['Source model','Material texture slot kinds','Sequence count','Attachment count','Raw body height / SD Footman'],[[source(r),', '.join(r['materialTextureSlotKinds']),len(r['sequences']),len(r['attachments']),r['rawBodyHeightFootman']] for r in samples])
text+='\nRaw heights above are model-space measurements. Official `modelscale` and other scale fields are recorded separately; these numbers do not claim equal screen height in the game.\n\n'
text+='The sampled numerical comparison does not establish that all HD/DE material channels render correctly in the research capture viewer. Pixel-level style conclusions require their corresponding captures and decoded texture evidence. DE remains its own tier throughout the manifests and tables.\n\n'
text+='Sources: [category-models.json](../../data/category-models.json), [category-norms.json](../../data/category-norms.json), [native-coverage.json](../../data/native-coverage.json), and the exact official object/table provenance in `D:/Codex/sd-research/data/world-editor-catalog-{sd,hd,de}.json`.\n'
OUT.mkdir(parents=True,exist_ok=True);(OUT/'tiers.md').write_text(text,encoding='utf8')
(D/'tier-comparison.json').write_text(json.dumps({'coverage':coverage,'samePathModelIds':[r['id'] for r in samples],'officialPairs':[{'objectId':o,'modelId':r['id']} for o,r in pairs],'versions':versions},indent=2),encoding='utf8')
(R/'repo/docs/SD-RESEARCH/data/tier-comparison.json').write_text((D/'tier-comparison.json').read_text(),encoding='utf8')
print(json.dumps({'samples':len(samples),'officialPairs':len(pairs),'coverage':coverage}))
