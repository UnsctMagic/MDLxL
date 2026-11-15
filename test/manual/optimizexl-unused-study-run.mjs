import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';import {testModel} from '../helpers/fixtures.cjs';import {load,patchBytes,hash} from './optimizexl-unused-study-lib.mjs';
const [root]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const manifest=read(path.join(root,'corpus-manifest.json')),fixed=read(path.join(root,'fixed-deep-cases.json')),byHash=new Map(manifest.files.map(i=>[i.sha256,i]));
const census=[...byHash.keys()].map(h=>read(path.join(root,'census',h+'.json'))),used=new Set(fixed.map(i=>i.sha256)),picked=[];
for(const native of [true,false]){
 const rows=census.filter(r=>r.status==='ok'&&r.eligible.length&&!used.has(r.sha256)&&r.relativePath.startsWith('corpus-')===native).sort((a,b)=>b.eligible.length-a.eligible.length||a.sha256.localeCompare(b.sha256));
 for(const r of rows.slice(0,4)){picked.push({...byHash.get(r.sha256),selection:native?'top-native':'top-custom',unresolvedKeys:r.eligible.length});used.add(r.sha256);}
}
const refs=[
 {relativePath:'optimizexl-lahmian-unused/WH_VC_LahmianVampire01.mdx',sha256:'7301332715e50dfadf5ce9a049a8cd262bd6a1ba387ea394c22ccda69db54488',accepted:'22dad1df7374ef013f8da6814246bfa0d3c8461fb08759cee5cb853edf8f6301',output:'WH_VC_LahmianVampire01_accepted.mdx'},
 {relativePath:'optimizexl-lahmian-unused/WH_VC_LahmianVampire01_variant1.mdx',sha256:'795bd0a56dd8230cf15281ae0f9de9014e13942a6eb61b5cd7e9c0badaef1f18',accepted:'040ee125f5c257768e316593fd75780021a86274a18697c4da0d8d4ff994b3a7',output:'WH_VC_LahmianVampire01_variant1_accepted.mdx'}
];
const targets=[[12,8033],[34,20517],[104,31409],[105,31409],[105,35934]].map(([bone,frame])=>({path:['Bones',bone,'Rotation'],frame}));
for(const item of refs){const {bytes}=load(item),repaired=patchBytes(bytes,targets);assert.equal(hash(repaired),item.accepted,'Reconstruct only the exact owner-accepted byte output');const target=testModel('optimizexl-lahmian-unused',item.output);if(fs.existsSync(target))assert.equal(hash(fs.readFileSync(target)),item.accepted);else fs.writeFileSync(target,repaired);}
const items=[...fixed.map(i=>({...i,selection:'fixed'})),...picked,...refs.filter(i=>!used.has(i.sha256)).map(i=>({...i,selection:'accepted-reference-family'}))];
const indexFile=path.join(root,'deep-selection.json'),out=path.join(root,'deep');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(indexFile,JSON.stringify(items,null,2));
let cursor=0,complete=0;const started=Date.now(),self=fileURLToPath(new URL('./optimizexl-unused-deep.mjs',import.meta.url));
async function worker(){while(cursor<items.length){const index=cursor++,item=items[index],result=path.join(out,item.sha256+'.json');if(fs.existsSync(result)){complete++;continue;}const scan=census.find(r=>r.sha256===item.sha256);
 if(scan&&scan.status!=='ok'){fs.writeFileSync(result,JSON.stringify({...item,status:'unsupported-checker',error:scan.error,phase:scan.phase},null,2));complete++;continue;}
 await new Promise(resolve=>{const log=fs.createWriteStream(path.join(out,item.sha256+'.log')),child=spawn(process.execPath,[self,path.join(root,'corpus-manifest.json'),indexFile,out,String(index)],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log);child.stderr.pipe(log);let timeout=false;
  const timer=setTimeout(()=>{timeout=true;child.kill();},1800000);
  child.on('exit',code=>{clearTimeout(timer);log.end();if(!fs.existsSync(result))fs.writeFileSync(result,JSON.stringify({...item,status:'error',phase:'process',error:timeout?'30-minute deep model timeout':`child exit ${code}`}));complete++;console.log(JSON.stringify({complete,total:items.length,model:item.relativePath,result:read(result).status,seconds:(Date.now()-started)/1000}));resolve();});
 });
}}
await Promise.all([worker(),worker()]);const rows=items.map(i=>read(path.join(out,i.sha256+'.json')));const summary={total:rows.length,byStatus:Object.fromEntries([...new Set(rows.map(r=>r.status))].map(s=>[s,rows.filter(r=>r.status===s).length])),rows:rows.map(r=>({model:r.relativePath,status:r.status,removed:r.removed,reason:r.reason,error:r.error})),elapsedSeconds:(Date.now()-started)/1000};fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
