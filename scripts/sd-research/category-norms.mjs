import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { isActiveSd, excludedBaseNamespaceIds } from './study-scope.mjs';

// Category norms are measured evidence, not target budgets or repair thresholds.
const ROOT=process.env.SD_RESEARCH_ROOT || 'D:/Codex/sd-research';
const DATA=path.join(ROOT,'data');
const DOC=path.resolve(import.meta.dirname,'../../docs/SD-RESEARCH');
const normal=x=>String(x||'').split(':').at(-1).replaceAll('/','\\').replace(/\.mdl$/i,'.mdx').toLowerCase();
const read=f=>JSON.parse(fs.readFileSync(f));
const round=x=>Number.isFinite(x)?Math.round(x*1000)/1000:null;
const unique=a=>[...new Set(a)];
const catalogs=new Map(['sd'].map(t=>[t,read(path.join(DATA,'world-editor-catalog-'+t+'.json'))]));
const catalogMaps=new Map([...catalogs].map(([tier,c])=>{
  const map=new Map();
  for(const e of c.entries) for(const m of e.models){const k=normal(m.path);if(!map.has(k))map.set(k,[]);map.get(k).push({id:e.id,name:e.name,groups:e.groups,kind:e.objectKind,art:m.label});}
  return [tier,map];
}));
const unitMaps=new Map([...catalogs].map(([tier,c])=>{const map=new Map();for(const u of c.unitRecords)for(const p of u.modelPaths){const k=normal(p);if(!map.has(k))map.set(k,[]);map.get(k).push(u);}return [tier,map];}));
const resources=read(path.join(DATA,'hive-permitted-resources.json'));
const resourceMap=new Map(resources.map(r=>[r.url.match(/\.(\d+)\/?$/)[1],r]));
const mountedUnitIds=new Set(['hkni','hgry','orai','okod','otbr','esen','ehpr','Hamg','Udea','Ofar','Emoo']);
function classify(m){
  const paths=unique([m.path,...(m.aliases||[])].map(normal)),p=normal(m.path);
  const official=unique(paths.flatMap(p=>(catalogMaps.get(m.tier||'sd')?.get(p)||[]).map(e=>JSON.stringify(e)))).map(JSON.parse);
  const units=paths.flatMap(p=>unitMaps.get(m.tier||'sd')?.get(p)||[]);
  const entry={category:m.category||'unresolved-category',categoryEvidence:'path pattern; no official object match',official,officialUnitIds:unique(units.map(u=>u.id)),races:unique(units.map(u=>u.race).filter(Boolean)),mountedReference:units.some(u=>mountedUnitIds.has(u.id)),scaleFields:units.map(u=>({id:u.id,...u.scaleFields}))};
  if(p.includes('portrait')&&!p.startsWith('environment\\dnc\\'))return {...entry,category:'portrait',categoryEvidence:'explicit portrait model path'};
  if(p.startsWith('ui\\glues\\'))return {...entry,category:'glue-scene',categoryEvidence:'explicit campaign/menu Glues path'};
  if(p.startsWith('ui\\'))return {...entry,category:'ui-model',categoryEvidence:'explicit UI model path'};
  if(p.startsWith('cinematics\\'))return {...entry,category:p.includes('\\vfx\\')?'cinematic-effect':'cinematic-scene',categoryEvidence:'explicit installed cinematic namespace'};
  if(p.startsWith('environment\\dnc\\'))return {...entry,category:'lighting-rig',categoryEvidence:'explicit installed day-night-cycle namespace'};
  if(p.startsWith('environment\\sky\\'))return {...entry,category:'sky',categoryEvidence:'explicit installed sky namespace'};
  if(p.startsWith('environment\\')&&p.includes('buildingfire'))return {...entry,category:'effect',categoryEvidence:'explicit installed building-fire namespace'};
  if(p.startsWith('objects\\cinematiccameras\\'))return {...entry,category:'cinematic-camera',categoryEvidence:'explicit installed cinematic-camera namespace'};
  if(/^objects\\(?:camerahelper|invalidmodel|invalidobject|randomobject|startlocation)\\/.test(p))return {...entry,category:'editor-helper',categoryEvidence:'explicit installed editor helper namespace'};
  if(p.startsWith('sharedmodels\\'))return {...entry,category:'shared-model',categoryEvidence:'explicit installed shared model namespace; function kept in model path'};
  if(p.startsWith('abilities\\weapons\\')||p.endsWith('\\herobloodsphere.mdx'))return {...entry,category:p.endsWith('\\herobloodsphere.mdx')?'effect':'missile',categoryEvidence:'explicit weapon projectile / hero sphere asset; official dummy-unit uses retained separately'};
  if(units.length){entry.category=units.some(u=>u.isBuilding)?'building':units.some(u=>u.isHero)?'hero':'unit';entry.categoryEvidence='official UnitUI / UnitData / UnitSkin model assignment';return entry;}
  if(official.some(e=>e.kind==='destructible'))return {...entry,category:'destructible',categoryEvidence:'official DestructableData / skins assignment'};
  if(official.some(e=>e.kind==='doodad'))return {...entry,category:'doodad',categoryEvidence:'official Doodads / skins assignment'};
  if(official.some(e=>e.kind==='item'))return {...entry,category:'item',categoryEvidence:'official ItemData / skins assignment'};
  if(official.some(e=>e.art==='Missile'))return {...entry,category:'missile',categoryEvidence:'official ability MissileArt assignment'};
  if(official.some(e=>e.kind==='ability'))return {...entry,category:'effect',categoryEvidence:'official ability art assignment'};
  if(m.source==='hive'){
    const r=resourceMap.get(String(m.resourceId)),tags=r?.tags||[];
    if(tags.includes('#Building'))entry.category='building';
    else if(tags.includes('#Hero'))entry.category='hero';
    else if(tags.includes('#Unit')||tags.includes('#Morphing unit'))entry.category='unit';
    else if(tags.includes('#Item / Ward'))entry.category='item';
    else if(tags.some(t=>/Doodad|Destructible/.test(t)))entry.category='doodad';
    else if(tags.includes('#Missile'))entry.category='missile';
    else if(tags.some(t=>/Buff|Effect/.test(t)))entry.category='effect';
    entry.categoryEvidence='permitted resource category tags; individual auxiliary models can differ';
  }
  if(m.source==='lowpolyworks'){entry.category='unit';entry.categoryEvidence='LowPolyWorks animated army model collection; native category assignment unavailable';}
  return entry;
}
function metrics(m){
  const detailPath=path.join(DATA,'parts',m.id+'.json');
  const detail=fs.existsSync(detailPath)?read(detailPath):JSON.parse(gunzipSync(fs.readFileSync(detailPath+'.gz')));
  const lod0=detail.geosets.filter(g=>g.levelOfDetail==null || g.levelOfDetail<=0),visible=lod0.filter(g=>g.visible);
  const glow=g=>g.layers.some(l=>l.textureSlots.some(t=>t.replaceableId===2));
  const parts=detail.parts.filter(p=>p.visible&&!p.heroGlow&&(p.levelOfDetail==null||p.levelOfDetail<=0));
  const zMin=Math.min(...parts.map(p=>p.posedBounds.min[2])),zMax=Math.max(...parts.map(p=>p.posedBounds.max[2]));
  const diffuse=unique(visible.flatMap(g=>g.layers.filter(l=>l.alpha>.01).flatMap(l=>l.textureSlots.filter(t=>t.slot==='TextureID'&&t.path).map(t=>normal(t.path)))));
  const seq=m.sequences||[];
  const classification=classify(m);const standardFourRacePalette=['unit','hero','building'].includes(classification.category)&&classification.official.some(e=>['Human','Orc','Night Elf','Undead'].some(r=>e.groups.includes(r))&&e.groups.includes(classification.category==='hero'?'Heroes':'Normal'));
  return {...classification,standardFourRacePalette,version:m.version,materialTextureSlotKinds:unique(detail.geosets.flatMap(g=>g.layers.flatMap(l=>l.textureSlots.map(t=>t.slot)))),id:m.id,source:m.source,tier:m.tier||'sd',name:m.name||m.modelName||path.win32.basename(m.path),path:m.path,aliases:m.aliases||[],sha256:m.sha256,bytes:m.bytes,sourceUrl:m.sourceUrl,army:m.army,author:m.author,authors:m.authors,wholeFileTriangles:m.triangles,sampleTrianglesAllLods:m.visibleTriangles,lod0Triangles:lod0.reduce((s,g)=>s+g.triangles,0),sampleTrianglesLod0:visible.reduce((s,g)=>s+g.triangles,0),sampleBodyTrianglesLod0:visible.filter(g=>!glow(g)).reduce((s,g)=>s+g.triangles,0),hiddenTrianglesLod0:lod0.filter(g=>!g.visible).reduce((s,g)=>s+g.triangles,0),lodLevels:unique(detail.geosets.map(g=>g.levelOfDetail??0)).sort((a,b)=>a-b),sample:m.sample,geosets:m.geosetCount,parts:m.partCount,declaredTexturePaths:unique((m.sheets||[]).map(normal)).length,sampleDiffusePaths:diffuse,diffuseSheets:diffuse.length,teamColor:m.teamColor,heroGlow:m.heroGlow,bones:m.bones,helpers:m.helpers,attachments:m.attachments,sequences:seq,sequenceKinds:unique(seq.map(s=>s.name.trim().split(/[ -]/)[0].toLowerCase())),death:seq.filter(s=>/^death(?:\b|\s)/i.test(s.name)),decay:seq.filter(s=>/^decay(?:\b|\s)/i.test(s.name)),dissipate:seq.filter(s=>/^dissipate(?:\b|\s)/i.test(s.name)),birth:seq.filter(s=>/^birth(?:\b|\s)/i.test(s.name)),stand:seq.filter(s=>/^stand(?:\b|\s)/i.test(s.name)),walk:seq.filter(s=>/^walk(?:\b|\s)/i.test(s.name)),emitterCounts:m.emitterCounts,cameras:m.cameras,rawSampleBodyHeight:round(zMax-zMin)};
}
const models=[];for(const source of ['native','lpw','hive']){const file=path.join(DATA,source+'-models.json');if(fs.existsSync(file))models.push(...read(file));}
const rows=[],failures=[];
for(const m of models.filter(isActiveSd))try{rows.push(metrics(m));}catch(error){failures.push({id:m.id,error:error.message});}
const footman=rows.find(r=>r.source==='blizzard'&&r.tier==='sd'&&normal(r.path)==='units\\human\\footman\\footman.mdx');
for(const r of rows)r.rawBodyHeightFootman=Number.isFinite(r.rawSampleBodyHeight)&&footman?.rawSampleBodyHeight?round(r.rawSampleBodyHeight/footman.rawSampleBodyHeight):null;
const quant=(list,key)=>{const a=list.map(x=>x[key]).filter(Number.isFinite).sort((a,b)=>a-b);const q=p=>a.length?round(a[(a.length-1)*p|0]):null;return {count:a.length,min:a[0]??null,p10:q(.1),median:q(.5),p90:q(.9),max:a.at(-1)??null};};
const groups=new Map();for(const r of rows){const key=[r.source,r.tier,r.category].join('/');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
const norms=[...groups].map(([group,list])=>({group,source:list[0].source,tier:list[0].tier,category:list[0].category,count:list.length,standardFourRacePaletteCount:list.filter(r=>r.standardFourRacePalette).length,metrics:Object.fromEntries(['wholeFileTriangles','lod0Triangles','sampleTrianglesLod0','sampleBodyTrianglesLod0','hiddenTrianglesLod0','diffuseSheets','declaredTexturePaths','bytes','bones','geosets','parts','rawBodyHeightFootman'].map(k=>[k,quant(list,k)])),teamColor:list.filter(r=>r.teamColor).length,heroGlow:list.filter(r=>r.heroGlow).length,death:list.filter(r=>r.death.length).length,decay:list.filter(r=>r.decay.length).length,dissipate:list.filter(r=>r.dissipate.length).length,birth:list.filter(r=>r.birth.length).length,withAttachments:list.filter(r=>r.attachments.length).length,classificationEvidence:Object.fromEntries(unique(list.map(r=>r.categoryEvidence)).map(k=>[k,list.filter(r=>r.categoryEvidence===k).length])),modelIds:list.map(r=>r.id)}));
fs.mkdirSync(path.join(DOC,'data'),{recursive:true});
for(const [file,value]of [['category-models.json',rows],['category-norms.json',{schema:1,activeModelCount:rows.length,artScopeSource:'base-namespace-art-exceptions.json',preservedSupplementaryModelIds:[...excludedBaseNamespaceIds],footmanReference:footman?{id:footman.id,path:footman.path,sample:footman.sample,height:footman.rawSampleBodyHeight}:null,notes:['Every polygon metric is authored triangle count, not GPU cost.','Sample pose is Stand at 20% when present, otherwise the first sequence at 20%.','LOD0 includes null, negative shared, and zero LevelOfDetail only. Hero glow is removed only from body count.','File size is MDX/MDL bytes; texture files are separate. Diffuse sheet count measures sampled visible material TextureID paths, normalized by case, not texture memory.','Raw body height is sampled non-glow LOD0 geometry without game object modelscale; it is not game-rendered height. Missing body bounds remain null rather than becoming zero height.','Category aliases are preserved. Resource-level Hive categories can include auxiliary models.'],groups:norms,failures}]]){fs.writeFileSync(path.join(DATA,file),JSON.stringify(value));fs.writeFileSync(path.join(DOC,'data',file),JSON.stringify(value));}
console.log(JSON.stringify({models:rows.length,groups:norms.length,failures:failures.length,footmanHeight:footman?.rawSampleBodyHeight}));
