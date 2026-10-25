import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root=process.env.SD_RESEARCH_ROOT||'D:/Codex/sd-research';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/native-manifest.json')));
const records=Array.isArray(manifest)?manifest:manifest.models;
const groups=new Map();for(const r of records){const k=r.sha256;if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
let copied=0,existing=0,missing=0;const provenance=[];
for(const r of records.filter(r=>r.tier==='de')){
 const out=path.join(root,'data/parts',r.id+'.json.gz');if(fs.existsSync(out)){existing++;continue;}
 const source=(groups.get(r.sha256)||[]).find(s=>s.id!==r.id&&fs.existsSync(path.join(root,'data/parts',s.id+(s.tier==='sd'?'.json':'.json.gz'))));if(!source){missing++;continue;}
 const sourceFile=path.join(root,'data/parts',source.id+(source.tier==='sd'?'.json':'.json.gz'));
 let raw=fs.readFileSync(sourceFile);if(sourceFile.endsWith('.gz'))raw=zlib.gunzipSync(raw);
 const d=JSON.parse(raw.toString().replaceAll(source.id,r.id));Object.assign(d,r);d.analysisReusedFrom={modelId:source.id,sha256:r.sha256,reason:'Byte-identical model content; analytical geometry, materials and stored animation tracks are identical. External texture resolution remains tier-specific.'};
 fs.writeFileSync(out,zlib.gzipSync(JSON.stringify(d)));provenance.push({id:r.id,sourceId:source.id,sha256:r.sha256});copied++;
 if(copied%100===0)console.log(JSON.stringify({copied,missing}));
}
fs.writeFileSync(path.join(root,'data/analysis-byte-identical-reuse.json'),JSON.stringify(provenance,null,2));console.log(JSON.stringify({copied,existing,missing}));
