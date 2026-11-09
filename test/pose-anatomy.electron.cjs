// True user-input acceptance of POSE discovery on supplied and adversarial rigs.
// Run through scripts/hidden-run.ps1; never use the owner's app or profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,stubDialogs,appTarget,bundleHashes,sha256File}=require('./helpers/app.cjs');
(async()=>{
 const {pathToFileURL}=require('node:url');const {ObjectLoader,Matrix4,Vector3}=await import('three'),pose=await import(process.env.MDLXL_POSE_SOURCE?pathToFileURL(path.resolve(process.env.MDLXL_POSE_SOURCE,'pose-ik.js')):new URL('../src/pose-ik.js',pathToFileURL(__filename)));
 const {projectPoseHandles}=await import('../app/pose-overlay.js');
 const {allNodes,skinGeoset}=await import('../src/animation.js');
 const {realAnatomyCases,analyticalCases,nameVariants,anatomyProblems,anatomicalMapping}=await import('./helpers/pose-anatomy-fixtures.mjs');
 const {holdoutAnatomyCases}=await import('./helpers/pose-anatomy-holdouts.mjs');
 const {prepareAnatomyUIFixture}=await import('./helpers/pose-anatomy-export.mjs');
 const out=path.resolve(process.env.MDLXL_POSE_OUT||'out/pose-anatomy-ui'),scratch=path.join(out,'derived-fixtures');
 const selected=(process.env.MDLXL_POSE_CASES||'').split(',').filter(Boolean),variants=(process.env.MDLXL_POSE_VARIANTS||'').split(',').filter(Boolean);
 const cases=[...realAnatomyCases,...analyticalCases,...holdoutAnatomyCases].filter(s=>!selected.length||selected.includes(s.key)),modes=variants.length?variants:nameVariants;
 assert.ok(cases.length&&modes.length,'No acceptance cases selected');fs.mkdirSync(out,{recursive:true});
 const report={executablePath:appTarget().executablePath,bundle:bundleHashes(),cases:[],totals:{pass:0,fail:0,skip:0}};
 let opened=null;
 const read=()=>opened.page.evaluate(()=>{const hook=window.__mdlxl,preview=hook.preview(),model=hook.model(),config=preview.props.poseConfig;return {model:JSON.parse(JSON.stringify(model,(_k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)),config:{enabled:config.enabled,initialized:!!config.initialized,body:config.body,chains:config.chains,nodes:config.nodes,roles:config.roles,followers:config.followers,carriers:config.carriers,pins:config.pins,target:config.target},camera:preview.runtime.controls.object.toJSON(),frame:preview.runtime.native.getFrame(),sequence:preview.props.sequenceIndex,undo:hook.document().historyStats.undoSteps,appearance:preview.props.preferences.viewportAppearance.controllers};});
 const waitReady=()=>opened.page.waitForFunction(()=>{const p=window.__mdlxl?.preview();return p?.runtime?.captureApi?.isReady&&p?.props?.model&&window.__mdlxl?.document();});
 const waitPose=()=>opened.page.waitForFunction(()=>window.__mdlxl?.preview()?.props?.poseConfig?.enabled&&window.__mdlxl.preview().props.poseConfig.initialized);
 const points=async()=>{const s=await read(),canvas=opened.page.locator('[data-clean-model-canvas]'),box=await canvas.boundingBox(),camera=new ObjectLoader().parse(s.camera);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return {snapshot:s,box,handles:projectPoseHandles(s.model,s.config,Number(s.frame),s.sequence,camera,box.width,box.height,Number(s.frame),undefined,s.appearance,'move')};};
 const nativeMatrices=async()=>new Map((await opened.page.evaluate(()=>window.__mdlxl.preview().runtime.native.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,Array.from(n.matrix)]))).map(([id,m])=>[id,new Matrix4().fromArray(m)]));
 const rigidHeadPoints=(model,id,matrices)=>{const points=[];for(const geo of model.Geosets){const posed=skinGeoset(geo,matrices),hd=geo.SkinWeights?.length===geo.Vertices.length/3*8;for(let i=0;i<geo.Vertices.length/3;i++){const influences=hd?[0,1,2,3].filter(slot=>geo.SkinWeights[i*8+slot+4]).map(slot=>geo.SkinWeights[i*8+slot]):geo.Groups?.[geo.VertexGroup?.[i]]||[];if(influences.length&&influences.every(bone=>bone===id))points.push(new Vector3().fromArray(posed,i*3));}}return points;};
 const checkLimbDrag=async(representative,row)=>{
  const {page}=opened;await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();await page.getByRole('group',{name:'Movement tool',exact:true}).getByRole('button',{name:'Move',exact:true}).click();
  const p=await points(),h=p.handles.find(h=>h.kind==='endpoint'&&h.key===representative.key),before=p.snapshot,camera=new ObjectLoader().parse(before.camera),matrixBefore=await nativeMatrices(),end=h.chain.end,node=allNodes(before.model).find(n=>n.ObjectId===end),grip=h.chain.grip||node.PivotPoint;
  camera.updateMatrixWorld(true);const screen=matrices=>{const v=new Vector3(...grip).applyMatrix4(matrices.get(end)).project(camera);return {x:(v.x+1)*p.box.width/2,y:(1-v.y)*p.box.height/2};},start=screen(matrixBefore),target={x:start.x+10,y:start.y-10};
  await page.mouse.move(p.box.x+h.x,p.box.y+h.y);await page.mouse.down();await page.mouse.move(p.box.x+h.x+10,p.box.y+h.y-10,{steps:8});await page.mouse.up();await page.waitForFunction(depth=>window.__mdlxl.document().historyStats.undoSteps===depth+1,before.undo);
  const after=await read();assert.notDeepEqual(after.model,before.model,'Endpoint drag changes native model keys');assert.equal(after.undo,before.undo+1,'One endpoint gesture creates exactly one undo action');
  const aCamera=new ObjectLoader().parse(after.camera);assert.ok(aCamera.position.distanceTo(camera.position)<1e-10&&aCamera.quaternion.angleTo(camera.quaternion)<1e-7,'Endpoint editing leaves the camera unchanged');
  await page.waitForFunction(({end,matrix})=>{const n=window.__mdlxl.preview().runtime.native.rendererData.nodes.find(n=>n?.node.ObjectId===end);return n&&n.matrix.some((v,i)=>Math.abs(v-matrix[i])>.000001);},{end,matrix:matrixBefore.get(end).elements});
  const finish=screen(await nativeMatrices()),move={x:finish.x-start.x,y:finish.y-start.y},toward=(move.x*10-move.y*10)/Math.SQRT2/10;assert.ok(toward>.1,'Rendered endpoint moves toward the actual pointer drag');assert.ok(Math.hypot(finish.x-target.x,finish.y-target.y)<Math.hypot(start.x-target.x,start.y-target.y),'Rendered endpoint gets closer to the pointer target');
  await page.keyboard.press('Control+z');await page.waitForFunction(depth=>window.__mdlxl.document().historyStats.undoSteps===depth,before.undo);assert.deepEqual((await read()).model,before.model,'Real Ctrl+Z exactly restores every authored field after the endpoint drag');
  row.limbDeformation={end,key:representative.key,pixels:move,toward};row.checks.push('Real Move drag edits native keys once, moves the rendered endpoint toward the pointer, holds the camera and exactly undoes');
 };
 const checkHeadDrag=async(fixture,row,headIndex=0)=>{
  const {page}=opened,owner=fixture.expected.heads[headIndex],config=(await read()).config,id=[owner,...(fixture.expected.headAlternatives?.[owner]||[])].find(id=>pose.poseRole(fixture.model,config,id)==='Head');
  await page.getByLabel('View direction',{exact:true}).selectOption('right');await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();
  await page.getByRole('group',{name:'Movement tool',exact:true}).getByRole('button',{name:'Select',exact:true}).click();let picked=false;
  for(let attempt=0;attempt<20&&!picked;attempt++){const p=await points(),h=p.handles.find(h=>h.kind==='node'&&h.id===id&&!h.marker);assert.ok(h?.visible,'Head handle visible');await page.mouse.click(p.box.x+h.x,p.box.y+h.y);const t=(await read()).config.target;picked=t?.kind==='node'&&t.id===id&&!t.marker;}
  assert.ok(picked,'Actual mouse selects the anatomical head');await page.getByRole('group',{name:'Movement tool',exact:true}).getByRole('button',{name:'Move',exact:true}).click();
  const before=await read(),matrixBefore=await nativeMatrices(),oldPoints=rigidHeadPoints(before.model,owner,matrixBefore),p=await points(),h=p.handles.find(h=>h.kind==='node'&&h.id===id&&!h.marker);assert.ok(oldPoints.length>3,'Head surface has rigidly bound witness vertices');
  await page.mouse.move(p.box.x+h.x,p.box.y+h.y);await page.mouse.down();await page.mouse.move(p.box.x+h.x+14,p.box.y+h.y-8,{steps:8});await page.mouse.up();await page.waitForFunction(depth=>window.__mdlxl.document().historyStats.undoSteps===depth+1,before.undo);
  const after=await read();assert.equal(after.undo,before.undo+1,'Head drag is one native undo action');
  await page.waitForFunction(({owner,matrix})=>{const n=window.__mdlxl.preview().runtime.native.rendererData.nodes.find(n=>n?.node.ObjectId===owner);return n&&n.matrix.some((v,i)=>Math.abs(v-matrix[i])>.0001);},{owner,matrix:matrixBefore.get(owner).elements});
  const newPoints=rigidHeadPoints(after.model,owner,await nativeMatrices());assert.equal(newPoints.length,oldPoints.length);const movement=Math.max(...oldPoints.map((v,i)=>v.distanceTo(newPoints[i])));assert.ok(movement>.001,'Rendered head surface actually deforms with the handle');
  const stretch=Math.max(...oldPoints.map((v,i)=>Math.abs(v.distanceTo(oldPoints[0])-newPoints[i].distanceTo(newPoints[0]))));assert.ok(stretch<.005,'Skull remains rigid through the native head gesture');
  if(id!==owner){const a=allNodes(before.model).find(n=>n.ObjectId===owner),b=allNodes(after.model).find(n=>n.ObjectId===owner);for(const channel of ['Translation','Rotation','Scaling'])assert.deepEqual(b[channel],a[channel],'Parent head control preserves child skull animation '+channel);}
  await page.keyboard.press('Control+z');await page.waitForFunction(depth=>window.__mdlxl.document().historyStats.undoSteps===depth,before.undo);assert.deepEqual((await read()).model,before.model,'Real Ctrl+Z exactly restores head gesture');
  row.headDeformation={joint:id,skinOwner:owner,vertices:oldPoints.length,movement,maxStretch:stretch,childTracksPreserved:id!==owner};row.checks.push('Head drag moves rendered skull, preserves its shape and authored child animation, and exactly undoes');
 };
 const shot=async name=>{const data=await opened.app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
 try{
  for(const spec of cases)for(const mode of modes){
   const row={key:spec.key,mode,checks:[]};let fixture;
   try{
    fixture=prepareAnatomyUIFixture(spec,mode,scratch);row.expected=fixture.expected;row.generated=spec.options?{options:spec.options,geosets:fixture.model.Geosets.length,nodes:fixture.model.Bones.length}:undefined;row.input=fixture.source||fixture.file;row.inputHash=fixture.sourceHash||sha256File(fixture.file);
    if(!opened){opened=await launchApp({fixture:fixture.file,out,show:'hide',settings:{preferences:{graphics:{pauseWhenHidden:false}}},args:['--disable-renderer-backgrounding','--disable-gpu-vsync','--disable-frame-rate-limit']});}
    else{
     const {page,app}=opened;const close=page.locator('.model-tab.active .model-tab-close');if(await close.count()){await close.click();const confirm=page.getByRole('dialog',{name:'Close model tab?',exact:true});if(await confirm.isVisible())await confirm.getByRole('button',{name:"Don't save",exact:true}).click();}
     await stubDialogs(app,{open:fixture.file,message:1});await page.keyboard.press('Control+o');
    }
    const {page}=opened;await page.waitForFunction(name=>window.__mdlxl?.session()?.path?.replaceAll('\\','/').toLowerCase()===name.replaceAll('\\','/').toLowerCase(),fixture.file);
    await page.locator('[data-hotkey="animation"]').click();await waitReady();
    const sequence=spec.key==='lahmian'?8:0,frame=spec.key==='lahmian'?21083:fixture.model.Sequences[sequence].Interval[0];
    if(spec.key==='lahmian')assert.deepEqual(Array.from(fixture.model.Sequences[sequence].Interval),[20633,21533],'Use the exact reported Attack 2 clip even with its name removed');
    await page.getByLabel('Movement current sequence').selectOption(String(sequence));
    const time=page.getByLabel('Current animation frame');await time.fill(String(frame));await time.press('Enter');
    await page.waitForFunction(({sequence,frame})=>window.__mdlxl.preview().props.sequenceIndex===sequence&&Math.abs(window.__mdlxl.preview().runtime.native.getFrame()-frame)<.001,{sequence,frame});row.pose={sequence,frame,interval:Array.from(fixture.model.Sequences[sequence].Interval)};
    await page.getByLabel('Render mode',{exact:true}).selectOption('solid');await page.getByLabel('View direction',{exact:true}).selectOption('orthographic');await page.getByRole('button',{name:'Fit',exact:true}).click();await waitReady();
    const before=await read(),sidebar=await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width);
    assert.equal(before.config.initialized,false,'Fresh model has no prior POSE map; the button must run discovery');
    if(before.config.enabled)await page.getByRole('button',{name:'POSE',exact:true}).click();
    await page.getByRole('button',{name:'POSE',exact:true}).click();await waitPose();await waitReady();
    const snapshot=await read();assert.deepEqual(snapshot.model,before.model,'Enabling POSE changes no authored model data');
    row.mapping=anatomicalMapping(snapshot.model,snapshot.config,pose);row.problems=anatomyProblems(snapshot.model,snapshot.config,fixture.expected,pose);
    assert.deepEqual(row.problems,[],`${spec.key}/${mode}: ${row.problems.join('; ')}`);row.checks.push('Real POSE button finds the expected anatomy and no false limbs');
    if(!fixture.expected.noPartControls)await page.waitForFunction(()=>Number(document.querySelector('[data-node-overlay]')?.dataset.poseSkeleton)>0);
    assert.equal(await page.getByRole('dialog',{name:/POSE/i}).count(),0,'Discovery adds no setup dialog');assert.equal(await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width),sidebar,'Sidebar width remains unchanged');
    if(!fixture.expected.noPartControls){
    const initial=await points(),visibleEndpoints=initial.handles.filter(h=>h.visible&&h.kind==='endpoint'&&!h.quiet&&h.x>12&&h.y>12&&h.x<initial.box.width-12&&h.y<initial.box.height-12),extraArm=(fixture.expected.limbs.filter(l=>l.kind==='arm').length>2?fixture.expected.limbs.filter(l=>l.kind==='arm').at(-1):null),representative=spec.key==='lahmian'?visibleEndpoints.find(h=>h.chain.kind==='leg'):extraArm?visibleEndpoints.find(h=>extraArm.ends.includes(h.chain.end)):fixture.expected.limbs.some(l=>l.kind==='wing')?visibleEndpoints.find(h=>h.chain.label==='Wing'):visibleEndpoints[0];
    assert.ok(representative,'A discovered endpoint is visible on the actual viewport');
    await page.getByRole('group',{name:'Movement tool',exact:true}).getByRole('button',{name:'Select',exact:true}).click();
    let picked=false;
    for(let attempt=0;attempt<16&&!picked;attempt++){
     const p=await points(),h=p.handles.find(h=>h.key===representative.key&&h.kind==='endpoint');assert.ok(h?.visible);
     await page.mouse.click(p.box.x+h.x,p.box.y+h.y);await page.waitForFunction(()=>window.__mdlxl.preview().props.poseConfig.target!=null);
     const target=(await read()).config.target;picked=target?.kind==='endpoint'&&target.key===representative.key&&!target.marker;
    }
    assert.ok(picked,'Actual mouse selects a recognized anatomical endpoint');row.checks.push('Recognized endpoint is visible and selectable by real mouse');
    await checkLimbDrag(representative,row);
    }else row.checks.push('POSE creates no false anatomical handles on the rigid prop');
    const p=await points(),cameraBefore=new ObjectLoader().parse(p.snapshot.camera);await page.keyboard.down('Alt');await page.mouse.move(p.box.x+60,p.box.y+80);await page.mouse.down();await page.mouse.move(p.box.x+130,p.box.y+105,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
    await page.waitForFunction(before=>{const q=window.__mdlxl.preview().runtime.controls.object.quaternion;return Math.abs(q.x-before[0])+Math.abs(q.y-before[1])+Math.abs(q.z-before[2])+Math.abs(q.w-before[3])>.001;},cameraBefore.quaternion.toArray());
    assert.deepEqual((await read()).model,before.model,'Normal mouse rotation writes no model changes');row.checks.push('Normal mouse rotation works after POSE selection');
    if(spec.key==='necrarch'||spec.key==='three-heads')await checkHeadDrag(fixture,row,spec.key==='three-heads'?2:0);
    if((spec.key==='lahmian'&&mode==='anonymous')||(spec.key==='six-arms'&&mode==='anonymous'))await shot(spec.key+'-'+mode);
    assert.deepEqual(opened.errors,[],'No renderer errors');if(fixture.source)assert.equal(sha256File(fixture.source),fixture.sourceHash,'Supplied original bytes unchanged');else if(spec.file)assert.equal(sha256File(fixture.file),row.inputHash);
    row.pass=true;report.totals.pass++;console.log('PASS '+spec.key+'/'+mode);
   }catch(error){row.pass=false;row.error=error.stack;row.pageState=opened?await opened.page.evaluate(()=>({path:window.__mdlxl?.session()?.path,preview:!!window.__mdlxl?.preview(),runtime:!!window.__mdlxl?.preview()?.runtime,ready:window.__mdlxl?.preview()?.runtime?.captureApi?.isReady,text:document.body.innerText.slice(0,1800)})):null;row.rendererErrors=opened?.errors;report.totals.fail++;console.error('FAIL '+spec.key+'/'+mode+': '+error.message);}
   report.cases.push(row);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  }
 }finally{
  if(opened)await closeApp(opened.app);
  if(fs.existsSync(scratch)){const resolved=path.resolve(scratch);assert.ok(resolved.startsWith(path.resolve(out)+path.sep));assert.ok(fs.readdirSync(resolved,{withFileTypes:true}).every(e=>e.isFile()&&!e.isSymbolicLink()));for(const f of fs.readdirSync(resolved))fs.unlinkSync(path.join(resolved,f));fs.rmdirSync(resolved);}
 }
 console.log(JSON.stringify(report.totals));if(report.totals.fail)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
