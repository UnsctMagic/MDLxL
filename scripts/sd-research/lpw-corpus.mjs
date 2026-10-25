/** Read-only public corpus acquisition. Run with Node 22+, outputs only beneath --root. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const root=path.resolve(option('--root','D:/Codex/sd-research'));
const site='https://www.lowpolyworks.com/';
const raw=path.join(root,'lowpolyworks');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const derived=path.join(repo,'docs/SD-RESEARCH/data');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const norm=s=>String(s).replaceAll('\\','/').toLowerCase();
await Promise.all([raw,derived,path.join(root,'data')].map(p=>fs.mkdir(p,{recursive:true})));
const statePath=path.join(raw,'download-ledger.json');
let previous={}; try { previous=JSON.parse(await fs.readFile(statePath,'utf8')).files; } catch(e) { if(e.code!=='ENOENT') throw e; }
const files={...previous};
let done=0,failed=0;
async function download(relative,kind,force=false) {
  const url=new URL(relative,site);
  if(url.origin!==new URL(site).origin) throw new Error(`Unexpected origin: ${url}`);
  const rel=decodeURIComponent(url.pathname.slice(1));
  const target=path.resolve(raw,rel);
  if(!target.startsWith(raw+path.sep)) throw new Error(`Path escaped corpus: ${relative}`);
  if(!force&&files[rel]?.sha256) {
    try { const b=await fs.readFile(target);if(hash(b)===files[rel].sha256) return files[rel]; } catch(e) {if(e.code!=='ENOENT')throw e;}
  }
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
      if(!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      await fs.mkdir(path.dirname(target),{recursive:true});
      await fs.writeFile(target+'.partial',bytes);
      await fs.rename(target+'.partial',target);
      const item={url:String(url),relative:rel,kind,bytes:bytes.length,sha256:hash(bytes),retrievedAt:new Date().toISOString(),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
      files[rel]=item;
      done++;
      if(done%100===0) {await saveLedger();console.log(JSON.stringify({downloaded:done,failed,last:rel}));}
      return item;
    } catch(e) {
      if(attempt===2) {failed++;files[rel]={url:String(url),relative:rel,kind,error:String(e),failedAt:new Date().toISOString()};return files[rel];}
      await new Promise(r=>setTimeout(r,500*(attempt+1)));
    }
  }
}
async function saveLedger(){await fs.writeFile(statePath,JSON.stringify({site,generatedAt:new Date().toISOString(),files},null,2));}
const names=['catalogue','variants','armies','textures','projects'];
const metadata={};
for(const name of names) {const item=await download(name+'.json','metadata',!args.includes('--offline'));if(item.error) throw new Error(item.error);metadata[name]=JSON.parse(await fs.readFile(path.join(raw,name+'.json'),'utf8'));}
await saveLedger();
const c=metadata.catalogue,textureMap=metadata.textures;
const allPaths=new Map();
for(const m of c) {
  allPaths.set('models/'+m.file,'model');
  if(m.downloadPack) allPaths.set(m.downloadPack,'download-pack');
  allPaths.set('thumbs/unit-'+m.id+'.png','published-thumbnail');
  for(const target of Object.values(m.textureFiles??{})) allPaths.set(target,'model-specific-texture');
}
for(const target of Object.values(textureMap)) allPaths.set(target,'texture');
const queue=[...allPaths];let cursor=0;
const jobs=Number(option('--concurrency','8'));
await Promise.all(Array.from({length:jobs},async()=>{while(cursor<queue.length){const [rel,kind]=queue[cursor++];await download(rel,kind);}}));
await saveLedger();
const models=c.map(m=>{
 const f=files['models/'+m.file];
 const texturePaths=[...new Set(m.geosets.flatMap(g=>g.textures).filter(t=>t!=='Team colour / glow').map(norm))];
 return {...m,id:'lpw-'+m.id,catalogueId:m.id,originalFile:m.file,file:'lowpolyworks/models/'+m.file,source:'lowpolyworks',path:path.join(raw,'models',m.file),sha256:f?.sha256,bytes:f?.bytes,catalogueBytes:m.bytes,texturePaths,geosetCount:m.geosets.length,triangleCount:m.geosets.reduce((s,g)=>s+g.triangles,0),textureCount:texturePaths.length};
});
await fs.writeFile(path.join(root,'data/lpw-manifest.json'),JSON.stringify(models,null,2));
const textureUsage=new Map();
for(const m of models) for(const g of m.geosets) for(const t of new Set(g.textures.filter(t=>t!=='Team colour / glow').map(norm))) {
 if(!textureUsage.has(t))textureUsage.set(t,[]);
 textureUsage.get(t).push({modelId:m.id,geosetId:g.index+1,triangles:g.triangles});
}
const textures=Object.entries(textureMap).map(([reference,target])=>({reference:norm(reference),url:new URL(target,site).href,localPath:path.join(raw,target),sha256:files[target]?.sha256,bytes:files[target]?.bytes,uses:textureUsage.get(norm(reference))??[],originClassification:'unresolved-until-compared-with-installed-game-index'}));
const rendererTextures=[];
for(const m of models)for(const [reference,target] of Object.entries(m.textureFiles??{})) rendererTextures.push({id:'lpwtexture-'+hash(Buffer.from(m.id+reference)).slice(0,18),source:'lowpolyworks-custom',path:reference,file:'lowpolyworks/'+target,modelIds:[m.id],sha256:files[target]?.sha256});
for(const [reference,target] of Object.entries(textureMap)) rendererTextures.push({id:'lpwtexture-'+hash(Buffer.from(reference)).slice(0,18),source:'lowpolyworks',path:reference,file:'lowpolyworks/'+target,sha256:files[target]?.sha256});
await fs.writeFile(path.join(root,'data/lpw-textures.json'),JSON.stringify(rendererTextures,null,2));
const authors={};for(const m of models)for(const a of m.authors??[])(authors[a.name]??=[]).push(m.id);
const summary={generatedAt:new Date().toISOString(),models:models.length,packsReferenced:c.filter(m=>m.downloadPack).length,uniquePacks:new Set(c.map(m=>m.downloadPack).filter(Boolean)).size,textureReferences:Object.keys(textureMap).length,uniqueTextureDownloads:new Set(Object.values(textureMap)).size,authors:Object.fromEntries(Object.entries(authors).map(([n,a])=>[n,a.length])),armies:Object.fromEntries(metadata.armies.map(a=>[a.id,models.filter(m=>m.army===a.id).length])),downloadFailures:Object.values(files).filter(f=>f.error),totalDownloadedBytes:Object.values(files).filter(f=>f.sha256).reduce((s,f)=>s+f.bytes,0)};
await fs.writeFile(path.join(derived,'lpw-models.json'),JSON.stringify(models.map(({path,description,searchDescription,descriptionLinks,...m})=>m),null,2));
await fs.writeFile(path.join(derived,'lpw-texture-usage.json'),JSON.stringify(textures.map(({localPath,...t})=>t),null,2));
await fs.writeFile(path.join(derived,'lpw-corpus-coverage.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));