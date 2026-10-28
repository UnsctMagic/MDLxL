const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const file=process.env.MDLXL_BOUNDS_MODEL;if(!file)throw Error('Set MDLXL_BOUNDS_MODEL to the private model under review.');
 const source=fs.readFileSync(file),out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','bounds-ui-'+Date.now()),copies=path.join(out,'copies');fs.mkdirSync(copies,{recursive:true});const work=path.join(out,path.basename(file));fs.copyFileSync(file,work);
 const {openDocument}=await import('../src/editor-document.js'),{sanityProposals,runOptimizeStage}=await import('../src/optimizexl.js'),{flattenHiveFindings}=await import('../app/optimizexl-hive.js');
 vm.runInThisContext(fs.readFileSync(path.resolve('public/vendor/hive-viewer-5.12.0.js'),'utf8'));
 const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(new Uint8Array(bytes).buffer);return ModelViewer.utils.mdlx.sanityTest(m);};
 const beforeModel=openDocument(new Uint8Array(source),'input.mdx').model,fix=sanityProposals(beforeModel).find(f=>f.kind==='bounds'),expected=Buffer.from(runOptimizeStage(new Uint8Array(source),'sanity',{},fix).bytes);
 assert.ok(fix.targets.every(t=>t.sequenceExtents));
 const originalCheck=hive(source),repairedCheck=hive(expected),summary=r=>`mdx-m3-viewer: ${r.errors} errors · ${r.severe} severe · ${r.warnings} warnings · ${r.unused} notices`;
 const exe=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[],app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),work],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
 try{
  const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow,dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}},copies);
  // OptimizeXL opens on the Insanity FIxer; this review starts at Duplicate data.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Duplicate data',exact:true}).click();
  const stage=()=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Insanity FIxer',exact:true}).click();
  await stage();await p.getByText(summary(originalCheck),{exact:true}).waitFor();
  assert.equal(await p.locator('.ox-fix-selection details[open]').count(),0);
  const pinned=await p.locator('[aria-label="Before preview"] h2').textContent();
  await p.evaluate(()=>{window.boundsState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
   let runtime,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)runtime=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}
   if(!runtime||!props)return null;return {frame:runtime.native.getFrame(),sequence:runtime.native.getSequence(),camera:runtime.controls.object.position.toArray(),matrices:runtime.native.rendererData.nodes.filter(Boolean).map(n=>Array.from(n.matrix)),counts:props.model.Geosets.map(g=>g.Anims.length)};
  });});
  await p.waitForFunction(()=>boundsState().every(Boolean));
  const save=async(bytes)=>{
   // Save writes the open working copy; the private fixture itself is never touched.
   const button=p.getByRole('button',{name:'Save',exact:true});
   if(await button.isEnabled()){await button.click();const keep=p.getByRole('button',{name:'Save without backup',exact:true});if(await keep.isVisible())await keep.click();
    await p.waitForFunction(()=>!Array.from(document.querySelectorAll('header button')).some(b=>b.textContent==='Saving…')&&Array.from(document.querySelectorAll('[role="status"]')).some(e=>/^Saved /.test(e.textContent)));}
   const {openDocument:open}=await import('../src/editor-document.js'),plain=x=>JSON.stringify(open(new Uint8Array(x),'x.mdx').model,(k,v)=>k==='Nodes'?undefined:ArrayBuffer.isView(v)?Array.from(v):v);
   assert.equal(plain(fs.readFileSync(work)),plain(bytes),'The open file holds exactly the approved model');
  };
  await p.screenshot({path:path.join(out,'01-default.png')});
  await p.getByLabel('Proposed fix',{exact:true}).selectOption(fix.id);
  await p.waitForFunction(n=>boundsState()[1]?.counts.every(c=>c===n),beforeModel.Sequences.length);
  await save(source);
  for(const label of ['Before preview','After preview']){
   const initial=await p.evaluate(()=>boundsState()),box=await p.getByLabel(label,{exact:true}).boundingBox();
   await p.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.45+75,box.y+box.height*.5+25,{steps:10});await p.mouse.up();await p.waitForTimeout(150);
   const rotated=await p.evaluate(()=>boundsState());assert.ok(Math.hypot(...rotated[0].camera.map((v,i)=>v-initial[0].camera[i]))>1);
   rotated[0].camera.forEach((v,i)=>assert.ok(Math.abs(v-rotated[1].camera[i])<1e-8));
  }
  let poses=0;
  for(let si=0;si<beforeModel.Sequences.length;si++){
   await p.getByLabel('Animation',{exact:true}).selectOption(String(si));const [lo,hi]=beforeModel.Sequences[si].Interval;
   for(const frame of [lo,(lo+hi)/2,hi]){
    await p.getByLabel('Animation frame',{exact:true}).fill(String(frame));
    await p.waitForFunction(({si,frame})=>boundsState().every(s=>s?.sequence===si&&Math.abs(s.frame-frame)<1e-4),{si,frame});
    const states=await p.evaluate(()=>boundsState());assert.deepEqual(states[0].matrices,states[1].matrices);poses++;
   }
  }
  await p.getByLabel('Animation',{exact:true}).selectOption('0');await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForTimeout(300);await p.getByRole('button',{name:'Pause',exact:true}).click();
  assert.ok((await p.evaluate(()=>boundsState()))[0].frame>beforeModel.Sequences[0].Interval[0]);
  await p.screenshot({path:path.join(out,'02-preview.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await stage();await p.getByText(summary(repairedCheck),{exact:true}).waitFor();
  assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),pinned);await save(expected);
  await p.screenshot({path:path.join(out,'03-approved.png')});
  await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByText(summary(originalCheck),{exact:true}).waitFor();await save(source);
  const list=p.locator('.ox-fix-selection');await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();
  assert.equal(await list.locator('input:checked').count(),1);await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();
  await p.waitForFunction(n=>boundsState()[1]?.counts.every(c=>c===n),beforeModel.Sequences.length);
  await p.getByRole('button',{name:'Approve selected',exact:true}).click();await stage();await p.getByText(summary(repairedCheck),{exact:true}).waitFor();await save(expected);
  assert.deepEqual(fs.readFileSync(file),source);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,tables:fix.targets.length,sequences:beforeModel.Sequences.length,nativePairedPoses:poses,cameraMouseRotationBothPanes:true,playback:true,collapsedDefault:true,individualAndSelectedApproval:true,approvedOnlySaves:true,beforePinned:true,backRestoresFindings:true,sourceUnchanged:true,remainingFindings:flattenHiveFindings(repairedCheck.nodes),errors,copies},null,2));console.log(out);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
