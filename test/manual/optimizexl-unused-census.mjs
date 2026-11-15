import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {load,check,inventory} from './optimizexl-unused-study-lib.mjs';
const [mode,manifestPath,output,arg]=process.argv.slice(2),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8').replace(/^\uFEFF/,''));
const unique=[...new Map(manifest.files.map(x=>[x.sha256,x])).values()].sort((a,b)=>a.sha256.localeCompare(b.sha256));
fs.mkdirSync(output,{recursive:true});
if(mode==='one'){
 const item=unique.find(x=>x.sha256===arg);let phase='load',report={...item};
 try{const {bytes,model}=load(item);phase='checker';const checker=check(bytes);phase='inventory';const data=inventory(model,checker);
  report={...report,status:'ok',version:model.Version,sequences:model.Sequences.length,vertices:model.Geosets.reduce((s,g)=>s+g.Vertices.length/3,0),checker,...data};
 }catch(error){report={...report,status:'error',phase,error:error.message,stack:error.stack};}
 fs.writeFileSync(path.join(output,item.sha256+'.json'),JSON.stringify(report));
}else if(mode==='census'){
 let cursor=0,complete=0;const started=Date.now(),self=fileURLToPath(import.meta.url);
 async function worker(){while(cursor<unique.length){const item=unique[cursor++],file=path.join(output,item.sha256+'.json');
  if(fs.existsSync(file)){complete++;continue;}
  await new Promise(resolve=>{const p=spawn(process.execPath,[self,'one',manifestPath,output,item.sha256],{windowsHide:true,stdio:['ignore','pipe','pipe']});let log='',timedOut=false;p.stdout.on('data',x=>log+=x);p.stderr.on('data',x=>log+=x);
   const timer=setTimeout(()=>{timedOut=true;p.kill();},120000);
   p.on('exit',code=>{clearTimeout(timer);if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify({...item,status:'error',phase:'process',error:timedOut?'120-second per-model timeout':`child exited ${code}`,log}));complete++;if(complete%25===0||complete===unique.length)console.log(JSON.stringify({complete,total:unique.length,elapsedSeconds:(Date.now()-started)/1000}));resolve();});
  });
 }}
 await Promise.all([worker(),worker()]);
 const rows=unique.map(i=>JSON.parse(fs.readFileSync(path.join(output,i.sha256+'.json'),'utf8')));
 const summary={total:rows.length,ok:rows.filter(x=>x.status==='ok').length,errors:rows.filter(x=>x.status!=='ok').map(({relativePath,sha256,phase,error})=>({relativePath,sha256,phase,error})),withEligible:rows.filter(x=>x.eligible?.length).length,eligibleKeys:rows.reduce((s,x)=>s+(x.eligible?.length||0),0),elapsedSeconds:(Date.now()-started)/1000};
 fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}else throw Error('Use one or census');
