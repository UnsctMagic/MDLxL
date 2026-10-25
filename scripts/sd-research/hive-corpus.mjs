import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Copy only the exact retained, permitted resource/model arrays. Scalar totals in
// the earlier file predate its curation, so this script deliberately checks arrays.
// Run: node scripts/sd-research/hive-corpus.mjs [root] [prior-study]
const root=path.resolve(process.argv[2] || 'D:/Codex/sd-research');
const prior=path.resolve(process.argv[3] || 'D:/Codex/mdlxl-sd-rulebook-20261024');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=f=>JSON.parse(fs.readFileSync(path.join(prior,f)));
const catalogue=load('outputs/hive-catalogue.json');
if(catalogue.resources.length!==90 || catalogue.rows.length!==646) throw Error('Permitted corpus arrays changed; expected 90 resources and 646 models');
const ids=new Set(catalogue.resources.map(r=>r.url.match(/\.(\d+)\/?$/)?.[1]));
if(ids.size!==90 || ids.has(undefined)) throw Error('Invalid permitted resource identifiers');
const base=path.join(root,'hive'),data=path.join(root,'data');
for(const dir of [base,data,path.join(base,'models'),path.join(base,'textures'),path.join(base,'archives')]) fs.mkdirSync(dir,{recursive:true});
const records=[],textures=[],archives=[];
const copy=(row,kind)=>{
  if(!ids.has(String(row.resourceId))) throw Error('Model outside permitted resource set');
  const source=path.resolve(prior,row.file),bytes=fs.readFileSync(source),sha256=hash(bytes);
  if(row.sha256 && row.sha256!==sha256) throw Error('Source hash mismatch: '+row.member);
  const file=path.join(base,kind==='model'?'models':'textures',sha256+path.extname(row.member).toLowerCase());
  if(!fs.existsSync(file)) fs.writeFileSync(file,bytes);
  return {id:'hive-'+row.resourceId+'-'+sha256.slice(0,24),source:'hive',tier:'sd',kind,resourceId:String(row.resourceId),path:row.member,logicalPath:row.member,aliases:[row.member],file,bytes:bytes.length,sha256,state:'extracted',sourceUrl:row.sourceUrl,resourceTitle:row.resourceTitle,author:row.author,permittedSourceFile:row.file};
};
for(const row of catalogue.rows) records.push(copy(row,'model'));
for(const row of load('work/hive-texture-files.json').filter(r=>ids.has(String(r.resourceId)))) textures.push(copy(row,'texture'));
const rankToId=new Map(catalogue.resources.map(r=>[r.rank,r.url.match(/\.(\d+)\/?$/)[1]]));
for(const row of load('work/hive-downloads.json').downloads.filter(r=>rankToId.has(r.rank))) {
  const resourceId=rankToId.get(row.rank),bytes=fs.readFileSync(path.resolve(prior,row.archive)),sha256=hash(bytes);
  if(row.sha256 && row.sha256!==sha256) throw Error('Archive hash mismatch '+resourceId);
  const file=path.join(base,'archives',resourceId+'.zip');
  if(!fs.existsSync(file)) fs.writeFileSync(file,bytes);
  archives.push({resourceId,sourceUrl:row.url,file,sha256,bytes:bytes.length});
}
for(const [name,value] of [['hive-manifest.json',records],['hive-textures.json',textures],['hive-permitted-resources.json',catalogue.resources],['hive-archives.json',archives]]) fs.writeFileSync(path.join(data,name),JSON.stringify(value));
const coverage={schema:1,generatedAt:new Date().toISOString(),source:'Exact curated resource and row arrays from the earlier study; source bytes checked against their recorded SHA-256',permittedResources:ids.size,permittedModels:records.length,textureEntries:textures.length,uniqueModelBytes:new Set(records.map(r=>r.sha256)).size,uniqueTextureBytes:new Set(textures.map(r=>r.sha256)).size,archives:archives.length,modelsMissing:0};
fs.writeFileSync(path.join(data,'hive-coverage.json'),JSON.stringify(coverage,null,2));
const derived=path.resolve(import.meta.dirname,'../../docs/sd-research/data');fs.mkdirSync(derived,{recursive:true});
fs.writeFileSync(path.join(derived,'hive-coverage.json'),JSON.stringify(coverage,null,2));
// The whitelist contains names, source URLs and content hashes, never geometry.
fs.writeFileSync(path.join(derived,'hive-permitted-models.json'),JSON.stringify(records.map(({file,permittedSourceFile,state,...record})=>record)));
console.log(JSON.stringify(coverage,null,2));
