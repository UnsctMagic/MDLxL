// Explicitly opt-in. Real prompts go through the console, never directly to a provider.
// No product code, live profile or input model is modified. Windows must use the hidden runner.
if (process.env.MDLXL_AI_REAL_USE !== '1') {
  console.log('SKIP ai-real-use: set MDLXL_AI_REAL_USE=1 and select ai-real-use explicitly.');
} else {
  run().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
async function run(note='') {
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http');
  const { execFileSync } = require('node:child_process');
  const { launchApp, closeApp, settle, stubDialogs, clickMenu, bundleHashes } = require('./helpers/app.cjs');
  const { openDocument } = await import('../src/editor-document.js');
  const { gatherStreams } = await import('../src/mesh-tools.js');
  const { snapshotModel, duplicateGroups, gradeScenario, summarize, markdownReport } = await import('./helpers/ai-real-use-grade.js');
  const root = path.resolve(__dirname,'..');
  if (process.platform === 'win32' && process.env.MDLXL_SUITE_HIDDEN !== '1') throw Error('Use node scripts/run-packaged-tests.mjs default ai-real-use: this run requires the hidden desktop.');
  if (process.platform === 'win32' && !/^D:[\\/]/i.test(root)) throw Error('Run from a worktree on D:.');
  const integer=(name,fallback,min=1)=>{const n=Number(process.env[name]||fallback);if(!Number.isSafeInteger(n)||n<min)throw Error(name+' must be an integer >= '+min);return n;};
  const repeats=integer('MDLXL_AI_REAL_USE_REPEATS',3), from=integer('MDLXL_AI_LIVE_FROM',1), timeout=integer('MDLXL_AI_REAL_USE_TURN_MS',240000), resumeBudget=integer('MDLXL_AI_REAL_USE_RESUMES',2,0);
  const scenarios=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ai-real-use/scenarios.json'))).slice(from-1);
  if(!scenarios.length)throw Error('MDLXL_AI_LIVE_FROM exceeds the scenario count.');
  const out=path.join(root,'out/ai-real-use',new Date().toISOString().replace(/[:.]/g,'-'));
  const scratch=path.join(out,'scratch'), profile=path.join(scratch,'profile');
  fs.mkdirSync(path.join(profile,'ai/codex'),{recursive:true});
  const model='gpt-6-luna', provider='codex';
  const report={mode:process.env.MDLXL_AI_REAL_USE_DRY_RUN==='1'?'dry-run':'live',model,repeats,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),started:new Date().toISOString(),runs:[],summary:[],note,environment:{hiddenDesktop:process.env.MDLXL_SUITE_HIDDEN==='1',turnTimeoutMs:timeout,resumeBudget,from}};
  const save=()=>{report.summary=summarize(report.runs);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,'report.md'),markdownReport(report));};
  save();
  let app,page,server,link,authUnavailable=false;
  // Copy ONLY sign-in material; never copy chats, personal files or settings. Never sign in interactively.
  const source=process.env.MDLXL_AI_LIVE_PROFILE;
  let retryDryRun=false;
  if(report.mode==='live') {
    const auth=source&&path.join(path.resolve(source),'ai/codex/auth.json');
    if(auth&&fs.existsSync(auth))fs.copyFileSync(auth,path.join(profile,'ai/codex/auth.json'));
    else {authUnavailable=true;report.mode='dry-run';report.note='Codex login copy unavailable. Inert stand-in only; no live baseline.';}
  }
  fs.writeFileSync(path.join(profile,'ai/codex/config.toml'),'model = "gpt-6-luna"\nmodel_reasoning_effort = "low"\n');
  // Native settings support "default", so the copied provider config owns the requested low effort.
  fs.writeFileSync(path.join(profile,'ai','connections.json'),JSON.stringify({provider,enabled:false,offload:true,routing:'manual',outsideCheck:true,providers:{codex:{model,effort:'default',allowLighter:false}},editingHandbook:true}));
  const bytes=fs.readFileSync(path.join(__dirname,'fixtures/ai-real-use/helmet.mdx'));
  // Textures are disposable CASC reads, never committed game files. The model copy remains immutable.
  const { CascReader } = require('../electron/casc.cjs');
  try {
  const casc=new CascReader(process.env.MDLXL_AI_REAL_USE_GAME||'D:/Warcraft III',scratch);
  try {
    for(const texture of openDocument(bytes,'helmet.mdx').model.Textures)if(texture.Image){
      let data=null;for(const name of [texture.Image,'war3.w3mod:'+texture.Image]){data=await casc.read(name);if(data)break;}
      if(!data)throw Error('Missing CASC texture '+texture.Image);
      const file=path.resolve(scratch,texture.Image.replaceAll('\\','/'));
      if(!file.startsWith(scratch+path.sep))throw Error('Fixture texture escapes scratch');
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
    }
    report.textures='All fixture texture paths resolved from CASC.';
  } finally {casc.close();}
  const fixture=(scenario,repeat)=>{
    const doc=openDocument(bytes,'Helmet.mdx');
    if(scenario.split)doc.apply('Fixture: redundant compatible points',['Geosets'],m=>{
      const g=m.Geosets[scenario.meshIndex],ids=Array.from(g.Faces);
      Object.assign(g,gatherStreams(g,ids),{Faces:new Uint16Array(ids.map((_,i)=>i))});
    });
    const file=path.join(scratch,`${repeat}-${scenario.id}.mdx`);fs.writeFileSync(file,doc.serialize('mdx'));return file;
  };
  const first=fixture(scenarios[0],1);
    const launched=await launchApp({fixture:first,out:scratch,profile,env:{MDLVIS_HEADLESS:'',MDLXL_DISABLE_UPDATES:'1',TEMP:path.join(scratch,'temp'),TMP:path.join(scratch,'temp')},args:['--disable-gpu-vsync','--disable-frame-rate-limit']});
    ({app,page}=launched);report.package={...bundleHashes(launched.target),executable:launched.target.executablePath};
    await page.waitForSelector('.classic-toolbar',{timeout:60000});await settle(page,1000);
    await stubDialogs(app,{message:1,save:null,open:null});
    await app.evaluate(({shell,dialog})=>{shell.openExternal=async()=>{throw Error('External UI disabled in this harness');};dialog.showErrorBox=()=>{};});
    await page.evaluate(async()=>{await window.desktop.aiEnable(true);});
    link=(await page.evaluate(()=>window.desktop.aiConfig())).mcpServers.mdlxl;
    const tool=async(name,args={})=>{
      const response=await fetch(link.url,{method:'POST',headers:{...link.headers,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}})});
      const value=await response.json();if(value.error||value.result?.isError)throw Error(value.error?.message||value.result.content[0].text);
      const c=value.result.content[0];return c.type==='image'?c:JSON.parse(c.text.split('\nMDLxL continuous awareness')[0]);
    };
    if(report.mode==='live') {
      try {const auth=await page.evaluate(()=>window.desktop.aiAuth('status'));if(!auth.loggedIn)throw Error('Copied Codex login is signed out.');report.auth='Existing owner login copied; status signed in.';}
      catch(error){authUnavailable=true;report.mode='dry-run';report.note='Codex login unavailable or stale: '+error.message+'. Inert stand-in only; no live baseline.';}
    }
    if(report.mode==='dry-run') {
      report.requestedModel=model;report.model='inert-stand-in';
      server=http.createServer(async(req,res)=>{
        let raw='';for await(const part of req)raw+=part;
        if(req.url.endsWith('/models'))return res.end('{"data":[{"id":"inert-stand-in"}]}');
        const data=JSON.parse(raw||'{}');
        report.standInRequests=(report.standInRequests||0)+1;
        if(JSON.stringify(data).includes('image_url'))report.standInSawImage=true;
        res.writeHead(200,{'content-type':'text/event-stream'});
        res.end('data: '+JSON.stringify({choices:[{delta:{content:'Dry run only. No model edits were made by the inert stand-in.'},finish_reason:'stop'}]})+'\n\n');
      });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    }
    await page.getByRole('button',{name:'AI assistant',exact:true}).click();await page.waitForSelector('.ai-assistant');
    if(report.mode==='dry-run'){
      if(!await page.getByLabel('AI provider',{exact:true}).isVisible())await page.getByRole('button',{name:'Connection settings',exact:true}).click();
      await page.getByLabel('AI provider',{exact:true}).selectOption('compatible');
      await page.getByLabel('API base URL',{exact:true}).fill(`http://127.0.0.1:${server.address().port}/v1`);
      await page.getByLabel('Model',{exact:true}).fill('inert-stand-in');
      await page.getByRole('button',{name:'Save connection',exact:true}).click();
      await page.getByRole('button',{name:'Connection settings',exact:true}).click();
    }
    // Prove the normal mouse control in the hidden package. No static preview or programmatic turn.
    const canvas=page.locator('.classic-view canvas').first(), box=await canvas.boundingBox(), cameraBefore=await canvas.screenshot();
    await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2+25,{steps:10});await page.mouse.up();await page.keyboard.up('Alt');await settle(page,250);
    report.mouseRotationObserved=!cameraBefore.equals(await canvas.screenshot());
    const snapshot=()=>page.evaluate(()=>{
      const {session}=window.mdlxlProbe();if(!session?.doc?.model)throw Error('No current model session');
      const m=session.doc.model;
      return {Textures:m.Textures,Materials:m.Materials,Geosets:m.Geosets.map(g=>({...g,Vertices:Array.from(g.Vertices),Normals:Array.from(g.Normals),Faces:Array.from(g.Faces),TVertices:g.TVertices.map(u=>Array.from(u)),VertexGroup:Array.from(g.VertexGroup),SkinWeights:g.SkinWeights?Array.from(g.SkinWeights):[]}))};
    }).then(snapshotModel);
    // Saved chat trees include workers: their tool errors and final text matter too.
    const chats=id=>{
      const seen=new Set(),all=[];
      const visit=key=>{if(!key||seen.has(key))return;seen.add(key);const file=path.join(profile,'ai','chat-'+key+'.json');if(!fs.existsSync(file))return;const c=JSON.parse(fs.readFileSync(file));all.push({id:key,task:c.task,transcript:c.transcript||[]});for(const w of c.workers||[])visit(w.id);};visit(id);return all;
    };
    measurements: for(let repeat=1;repeat<=(authUnavailable?1:repeats);repeat++)for(const scenario of scenarios) {
      console.log(`MEASURING repeat ${repeat}/${repeats}: ${scenario.id}`);
      const started=Date.now(), turns=[];let error=null, before, after, task, tree=[], demo=null, scenarioChat=null;
      const prefix=`${repeat}-${scenario.id}`;
      try {
        if(repeat!==1||scenario!==scenarios[0]){
          await stubDialogs(app,{open:fixture(scenario,repeat)});await clickMenu(app,'Open…');await page.waitForFunction(name=>document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes(name),`${repeat}-${scenario.id}.mdx`);await settle(page,500);
        }
        await page.getByRole('button',{name:'New chat',exact:true}).click();await settle(page,400);
        await page.waitForFunction(()=>!document.querySelector('[aria-label="AI prompt"]').disabled);
        await tool('mdlxl_command',{target:(await tool('mdlxl_context')).target,id:'vertices'});
        if(scenario.demo){
          const original=await snapshot(), groups=duplicateGroups(original.meshes[scenario.meshIndex]);
          const zs=groups.map(g=>g.position[2]).sort((a,b)=>a-b), ys=groups.map(g=>g.position[1]).sort((a,b)=>a-b);
          const sample=groups.find(g=>g.position[2]<=zs[Math.floor(zs.length/3)]&&g.position[1]<=ys[Math.floor(ys.length/2)]);
          if(!sample)throw Error('No lower-right demonstration group');
          const context=await tool('mdlxl_context');
          await tool('mdlxl_select',{target:context.target,geosetIds:[scenario.meshIndex],activeGeoset:scenario.meshIndex,vertices:{[scenario.meshIndex]:sample.indices}});
          await tool('mdlxl_command',{target:(await tool('mdlxl_context')).target,id:'Weld'});await settle(page,200);
          const demonstrated=await snapshot();
          const removed=original.meshes[scenario.meshIndex].vertices.length/3-demonstrated.meshes[scenario.meshIndex].vertices.length/3;
          if(removed<=0)throw Error('Demonstration did not weld live geometry');
          demo={area:'lower right of Geoset 1',position:sample.position,removedVertices:removed,before:original,after:demonstrated};
        }
        const state=await snapshot(), context=await tool('mdlxl_context'), gi=scenario.meshIndex;
        await tool('mdlxl_select',{target:context.target,geosetIds:[gi],activeGeoset:gi,vertices:{[gi]:Array.from({length:state.meshes[gi].vertices.length/3},(_,i)=>i)}});
        before=await snapshot();
        const id=await page.evaluate(()=>window.findFiberState('.ai-assistant',s=>s&&typeof s==='object'&&s.id&&s.modelKey,{current:true})?.id);
        if(!id)throw Error('Console has no active chat');
        scenarioChat=id;
        async function turn(prompt,resume=false) {
          const entry={prompt,resume,started:new Date().toISOString(),timedOut:false};turns.push(entry);
          if(resume)await page.getByRole('button',{name:'Resume task',exact:true}).click();
          else {
            await page.getByLabel('AI prompt',{exact:true}).fill(prompt);
            if(scenario.image&&turns.length===1){
              await page.locator('.ai-assistant input[type=file]').setInputFiles(path.join(__dirname,'fixtures/ai-real-use',scenario.image));
              await page.locator('.ai-image-chip img').waitFor();
            }
            await page.getByRole('button',{name:'Send',exact:true}).click();
          }
          const deadline=Date.now()+timeout;await settle(page,500);
          while(Date.now()<deadline){
            const state=await page.evaluate(async()=>({status:await window.desktop.aiStatus(),error:document.querySelector('.ai-error')?.textContent,send:document.querySelector('.ai-send')?.getAttribute('aria-label')}));
            if(!(state.status.running||[]).length&&state.send!=='Stop'){entry.consoleError=state.error||null;break;}
            await settle(page,500);
          }
          if(Date.now()>=deadline){entry.stoppedBeforeCancel=chats(id).some(c=>c.transcript.some(m=>m.role==='assistant'&&/\bStopped\./.test(m.text||'')));entry.timedOut=true;await page.evaluate(id=>window.desktop.aiCancel(id),id);await page.waitForFunction(async()=>!(await window.desktop.aiStatus()).running.length,null,{timeout:20000});}
          if(report.mode==='live'&&/sign.?in|authenticat|unauthori[sz]ed|expired.*token|token.*expired/i.test(entry.consoleError||'')) { retryDryRun=true;throw Error('Copied Codex login became unavailable: '+entry.consoleError); }
          entry.seconds=(Date.now()-Date.parse(entry.started))/1000;
          await settle(page,300);task=await page.evaluate(id=>window.desktop.aiTask(id),id);
          // This records a harness-initiated cutoff, distinct from a provider stopping by itself.
          if(entry.timedOut)entry.cancellation='harness measurement timeout';
        }
        for(const prompt of scenario.turns) {
          await turn(prompt);if(turns.at(-1).timedOut)break;
        }
        while(task?.canResume&&turns.filter(t=>t.resume).length<resumeBudget&&!turns.at(-1).timedOut)await turn('Resume task',true);
        after=await snapshot();tree=chats(id);
        fs.writeFileSync(path.join(out,prefix+'-evidence.json'),JSON.stringify({scenario,turns,task,chats:tree,before,after,demo},null,2));
      } catch(e){
        error=e.message;console.error(prefix+': '+error);
        if(page&&scenarioChat){
          await page.evaluate(id=>window.desktop.aiCancel(id),scenarioChat);
          await page.waitForFunction(async()=>!(await window.desktop.aiStatus()).running.length,null,{timeout:20000});
          task=await page.evaluate(id=>window.desktop.aiTask(id),scenarioChat);tree=chats(scenarioChat);
        }
        if(page)after=await snapshot().catch(()=>before);
      }
      if(!before)throw Error('Scenario setup failed before measurement: '+error);
      const parent=tree[0]?.transcript||[], children=tree.slice(1).flatMap(c=>c.transcript.map(m=>({...m,cost:undefined})));
      const result=gradeScenario({scenario,before,after:after||before,transcript:[...parent,...children],task,turns,error,seconds:(Date.now()-started)/1000});
      result.repeat=repeat;result.demonstration=demo&&{area:demo.area,removedVertices:demo.removedVertices};
      result.harnessCancelled=turns.some(t=>t.timedOut);report.runs.push(result);save();
      console.log(JSON.stringify({id:scenario.id,repeat,workflow:result.workflow.score,quality:result.qualityScore,seconds:result.seconds}));
      if(retryDryRun){report.note='Copied login became stale during sending. Live calls stopped; follow with an inert dry run.';save();break measurements;}
      // Each scenario starts from a fresh fixture; no saves go to source files.
    }
    if(authUnavailable)report.note+=' Stopped after one dry-run repetition.';
    report.finished=new Date().toISOString();save();
    console.log('REPORT '+path.join(out,'report.md'));
  } catch(error) {report.note+=' Harness error: '+error.message;save();throw error;}
  finally {
    if(app)await closeApp(app);
    if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
    // Exact task-owned scratch root, no junctions are created here.
    if(!scratch.startsWith(path.join(root,'out','ai-real-use')+path.sep))throw Error('Unexpected scratch path');
    fs.rmSync(scratch,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }
  if(retryDryRun){
    process.env.MDLXL_AI_REAL_USE_DRY_RUN='1';
    process.env.MDLXL_AI_REAL_USE_REPEATS='1';
    await run('Copied Codex login became stale during sending. Live calls stopped; inert stand-in only.');
  }
}
