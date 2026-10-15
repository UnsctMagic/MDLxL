const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {createStarterDocument}=await import('../src/starter-model.js');
 const {openDocument}=await import('../src/editor-document.js');
 const {sanityProposals,runOptimizeStage}=await import('../src/optimizexl.js');
 const root=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out/optimizer-teaching','constant-ui');fs.mkdirSync(root,{recursive:true});
 const copies=path.join(root,'copies');fs.mkdirSync(copies,{recursive:true});
 const d=createStarterDocument();d.apply('Exact constant teaching fixture',['Sequences','Bones'],m=>{
  m.Sequences=[{Name:'Constant span',Interval:new Uint32Array([100,500]),MinimumExtent:new Float32Array([-50,-50,0]),MaximumExtent:new Float32Array([50,50,100]),BoundsRadius:100,MoveSpeed:0,NonLooping:false,Rarity:0}];
  m.Sequences.push({...structuredClone(m.Sequences[0]),Name:'Moving span',Interval:new Uint32Array([1000,1500])});
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[[100,[4,2,3]],[500,[4,2,3]],[1000,[4,2,3]],[1500,[20,2,3]]].map(([Frame,Vector])=>({Frame,Vector:new Float32Array(Vector)}))};
 });
 const source=Buffer.from(d.serialize('mdx')),file=path.join(root,'generated-fixture.mdx');fs.writeFileSync(file,source);
 const fixes=sanityProposals(openDocument(new Uint8Array(source),'x.mdx').model).filter(f=>f.kind==='constantTransform');assert.equal(fixes.length,1);
 const expected=Buffer.from(runOptimizeStage(new Uint8Array(source),'sanity',{},fixes[0]).bytes),exe=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[];
 const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(root,'profile')},timeout:60000});
 const pid=app.process().pid;
 try{
  const main=await app.firstWindow();await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();const p=await pending;p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow,dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}},copies);
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Insanity FIxer',exact:true}).click();
  const list=p.locator('.ox-fix-selection');await list.locator('summary').click();
  await list.getByRole('button',{name:fixes[0].label,exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
  const pinned=await p.locator('[aria-label="Before preview"] h2').textContent();
  await p.evaluate(()=>{window.constantState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
   let runtime,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)runtime=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}
   return runtime&&props?{frame:runtime.native.getFrame(),camera:runtime.controls.object.position.toArray(),target:runtime.controls.target.toArray(),matrix:Array.from(runtime.native.rendererData.nodes[props.model.Bones[0].ObjectId].matrix)}:null;
  });});
  for(const frame of [100,300,500]){await p.getByLabel('Animation frame',{exact:true}).fill(String(frame));await p.waitForFunction(frame=>constantState().every(s=>s&&Math.abs(s.frame-frame)<1e-5&&s.matrix[12]===4&&s.matrix[13]===2&&s.matrix[14]===3),frame);const s=await p.evaluate(()=>constantState());assert.deepEqual(s[0].matrix,s[1].matrix);}
  const beforeCamera=await p.evaluate(()=>constantState().map(s=>s.camera));const box=await p.locator('[aria-label="After preview"] canvas[data-clean-model-canvas]').boundingBox();assert.ok(box);
  await p.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.68,box.y+box.height*.57,{steps:12});await p.mouse.up();
  await p.waitForFunction(before=>constantState().some((s,i)=>JSON.stringify(s.camera)!==JSON.stringify(before[i])),beforeCamera);
  const rotated=await p.evaluate(()=>constantState());const direction=s=>{const v=s.camera.map((x,i)=>x-s.target[i]),n=Math.hypot(...v);return v.map(x=>x/n);};const a=direction(rotated[0]),b=direction(rotated[1]);assert.ok(a.every((x,i)=>Math.abs(x-b[i])<1e-6));assert.ok(rotated.every((s,i)=>JSON.stringify(s.camera)!==JSON.stringify(beforeCamera[i])));
  await p.screenshot({path:path.join(root,'constant-preview.png')});
  const save=async(bytes)=>{const old=new Set(fs.readdirSync(copies));await p.getByRole('button',{name:'Optimize New Copy',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelectorAll('header button')).some(b=>b.textContent==='Saving…'));const added=fs.readdirSync(copies).filter(n=>!old.has(n));assert.equal(added.length,2);assert.deepEqual(fs.readFileSync(path.join(copies,added.find(n=>n.includes('_Before')))),source);assert.deepEqual(fs.readFileSync(path.join(copies,added.find(n=>n.includes('_After')))),bytes);};
  await save(source);await p.getByRole('button',{name:'Approve',exact:true}).click();
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Insanity FIxer',exact:true}).click();
  assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),pinned);await save(expected);
  await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('button',{name:fixes[0].label,exact:true}).waitFor();
  assert.match(await p.locator('footer').textContent(),/Total saved: 0.00 KB/);assert.deepEqual(fs.readFileSync(file),source);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,packaged:!!exe,pid,nativePairedPoses:3,mouseRotationVerified:true,camerasPaired:true,beforePinned:true,approvedOnlySaveVerified:true,backRestoresOriginal:true,errors},null,2));console.log(root);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
