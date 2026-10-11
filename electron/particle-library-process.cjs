// Keep the indexer's native-buffer allocations outside the editor process.
let cancelled=false,started=false;
process.parentPort.on('message',({data})=>{
  if(data==='cancel'){cancelled=true;return;}
  if(started)return;started=true;
  import('./particle-library-worker.mjs').then(({scanParticleLibrary})=>scanParticleLibrary({...data,shouldCancel:()=>cancelled,onProgress:status=>process.parentPort.postMessage({type:'progress',status})})).then(result=>{
    process.parentPort.postMessage({type:'done',summary:{...result.manifest,assets:undefined,processed:undefined}});
    setImmediate(()=>process.exit(0));
  },error=>{
    process.parentPort.postMessage({type:'error',message:error.message});
    setImmediate(()=>process.exit(1));
  });
});
