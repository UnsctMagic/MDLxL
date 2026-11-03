// Black-box startup check: real Chromium context failure, real process relaunch,
// real packaged editor and command-line model. No application functions are invoked.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {appTarget}=require('./helpers/app.cjs');
const {tempDir,fixturePath}=require('./helpers/fixtures.cjs');

(async()=>{
  const target=appTarget();
  assert.ok(target.packaged,'Set MDLXL_TEST_EXE to the package under test');
  const root=tempDir('software-rendering-'),fixture=path.join(root,'package');
  const results=[];
  try{
    await fs.cp(path.dirname(target.executablePath),fixture,{recursive:true,filter:source=>!['profile','Addons','Backgrounds','BitsAndParts','Showcase Recordings'].includes(path.basename(source))});
    const entry=path.join(fixture,'resources/app/electron/main.cjs');
    const original=await fs.readFile(entry,'utf8');
    const instrumentation=`
      const testElectron=require('electron'),testFs=require('node:fs'),testPath=require('node:path');
      const testRoot=process.env.MDLXL_WARP_TEST_ROOT;
      testFs.appendFileSync(testPath.join(testRoot,'launches.jsonl'),JSON.stringify({pid:process.pid,args:process.argv,angle:testElectron.app.commandLine.getSwitchValue('use-angle'),gl:testElectron.app.commandLine.getSwitchValue('use-gl')})+'\\n');
      // Remove only the test-induced failure from the next process; WARP selection and relaunch remain real.
      const testRelaunch=testElectron.app.relaunch.bind(testElectron.app);
      testElectron.app.relaunch=options=>testRelaunch({...options,args:options.args.filter(arg=>!['--disable-gpu','--disable-software-rasterizer'].includes(arg))});
      testElectron.app.on('web-contents-created',(_,contents)=>contents.on('did-finish-load',async()=>{
        if(!contents.getURL().endsWith('/dist/index.html'))return;
        const result=await contents.executeJavaScript(\`new Promise(resolve=>{
          function check(){
            if(!document.querySelector('.classic-app')||!window.__mdlxl?.model()?.Geosets?.length)return false;
            const gl=document.createElement('canvas').getContext('webgl2');
            const ext=gl?.getExtension('WEBGL_debug_renderer_info');
            resolve({editor:true,geosets:window.__mdlxl.model().Geosets.length,webgl:!!gl,renderer:gl?gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER):''});
            return true;
          }
          if(!check()){const observer=new MutationObserver(()=>{if(check())observer.disconnect();});observer.observe(document,{subtree:true,childList:true,attributes:true});}
        })\`);
        testFs.writeFileSync(testPath.join(testRoot,'result.json'),JSON.stringify(result));
        testElectron.app.exit(0);
      }));
    `;
    await fs.writeFile(entry,instrumentation+original);
    for(const scenario of [{name:'normal',failure:false,args:[],launches:1},{name:'fallback',failure:true,args:['--disable-gpu','--disable-software-rasterizer'],launches:2},{name:'explicit-warp',failure:false,args:['--use-angle=d3d11-warp'],launches:1}]){
      const run=path.join(root,scenario.name);await fs.mkdir(run);
      const profile=path.join(run,'profile');await fs.mkdir(profile);
      await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({preferences:{checkUpdatesOnStartup:false,disableSounds:true}}));
      let watcher,timer,child;
      const done=new Promise((resolve,reject)=>{
        watcher=require('node:fs').watch(run,(_event,name)=>{if(name==='result.json')resolve();});
        timer=setTimeout(()=>reject(Error(scenario.name+': editor did not finish loading')),45000);
      });
      try{
        child=spawn(path.join(fixture,path.basename(target.executablePath)),[fixturePath('footman'),...scenario.args],{windowsHide:true,stdio:'ignore',env:{...process.env,MDLXL_PROFILE:profile,MDLVIS_HEADLESS:'1',MDLXL_TEST_HOOK:'1',MDLXL_WARP_TEST_ROOT:run}});
        await done;
        const result=JSON.parse(await fs.readFile(path.join(run,'result.json'),'utf8'));
        const launches=(await fs.readFile(path.join(run,'launches.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
        console.log(JSON.stringify({scenario:scenario.name,launches,result}));
        assert.equal(launches.length,scenario.launches,scenario.name+': expected automatic WARP retry when WebGL is unavailable');
        assert.equal(result.webgl,true,scenario.name+': editor has usable WebGL');
        assert.ok(result.geosets>0,scenario.name+': command-line Footman remains open');
        if(scenario.name!=='normal')assert.match(result.renderer,/basic render driver/i,scenario.name+': Windows WARP is active');
        if(scenario.failure)assert.ok(launches[1].args.includes('--use-angle=d3d11-warp'),'automatic retry supplies WARP');
        results.push({scenario:scenario.name,launches:launches.length,...result});
      }finally{
        clearTimeout(timer);watcher?.close();
        // A relaunch is a new process tree; clean only recorded fixture PIDs.
        const records=await fs.readFile(path.join(run,'launches.jsonl'),'utf8').catch(()=>'');
        for(const line of records.trim().split('\n').filter(Boolean)){
          const {pid}=JSON.parse(line);
          try{execFileSync('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}
        }
        if(child?.pid)try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}
      }
    }
    console.log(JSON.stringify({pass:results.length,fail:0,skip:0,results},null,2));
  }finally{await fs.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});
