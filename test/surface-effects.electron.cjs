const {fixturePath,testModel}=require('./helpers/fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,root,stubDialogs}=require('./helpers/app.cjs');
(async()=>{
 const out=path.join(root,'out/surface-effects');fs.mkdirSync(out,{recursive:true});
 const run=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:-3000,y:0,width:1440,height:1000}});
 const {page,app}=run,checks=[];app.process().stderr.on('data',d=>fs.appendFileSync(path.join(out,'electron.log'),d));app.process().on('exit',(code,signal)=>console.log('APP EXIT',code,signal));
 const {ObjectLoader,Vector3,Matrix4}=await import('three');
 const {movementAxisHandles}=await import('../app/movement-overlay.js');
 const dragHandle=async mode=>{
  await page.getByRole('group',{name:'Effect placement',exact:true}).getByRole('button',{name:mode==='scale'?'Scale':'Move',exact:true}).click();await ready();
  await page.locator('.sfx-stage canvas[data-node-overlay]').waitFor();
  const data=await page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),id=p.props.selectedNodeIds[0],n=p.runtime.native.rendererData.nodes.find(n=>n?.node.ObjectId===id);if(!n)throw Error(JSON.stringify({id,selected:p.props.selectedNodeIds,helpers:p.props.model.Helpers.map(n=>[n.Name,n.ObjectId]),nodes:p.runtime.native.rendererData.nodes.map(n=>[n?.node?.Name,n?.node?.ObjectId])}));return {camera:p.runtime.controls.object.toJSON(),radius:p.runtime.captureApi.showcaseView().radius,pivot:Array.from(n.node.PivotPoint),matrix:Array.from(n.matrix)};});
  const canvas=page.locator('.sfx-stage .game-preview-surface canvas').first(),box=await canvas.boundingBox(),camera=new ObjectLoader().parse(data.camera);camera.updateMatrixWorld(true);
  const world=new Vector3().fromArray(data.pivot).applyMatrix4(new Matrix4().fromArray(data.matrix)),screen=world.clone().project(camera);
  const handles=movementAxisHandles({visible:true,world,x:(screen.x+1)*box.width/2,y:(1-screen.y)*box.height/2},camera,box.width,box.height,data.radius,'world',mode),h=handles.find(h=>h.axis==='Z');
  const from=await read(),length=Math.hypot(h.dx,h.dy);
  await page.mouse.move(box.x+h.x,box.y+h.y);await page.mouse.down();await page.mouse.move(box.x+h.x+h.dx/length*35,box.y+h.y+h.dy/length*35,{steps:8});await page.mouse.up();await ready();
  const after=await read(),property=mode==='scale'?'Scaling':'Translation';
  assert.notDeepEqual(after.model.Helpers.at(-1)[property],from.model.Helpers.at(-1)[property],mode+' drag changes the draft anchor');
  checks.push(mode+' handle moves with the real mouse');
 };
 const button=name=>page.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;const r=mdlxlProbe(el).runtime;return r?.captureApi.isReady&&r.particleSourceModel===mdlxlProbe(el).props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const read=()=>page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return {model:JSON.parse(JSON.stringify(p.props.model,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)),camera:p.runtime.controls.object.position.toArray(),frame:p.runtime.native.getFrame(),globals:p.runtime.native.rendererData.globalSequencesFrames};});
 const documentModel=()=>page.evaluate(()=>JSON.parse(JSON.stringify(mdlxlProbe().session.doc.model,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)));
 try{
  await button('Surface Effects').click();await ready();
  const original=await documentModel();
  const before=await read(),box=await page.locator('.sfx-stage canvas').first().boundingBox();
  await page.mouse.move(box.x+box.width*.7,box.y+box.height*.35);await page.mouse.down();await page.mouse.move(box.x+box.width*.7+65,box.y+box.height*.35+35,{steps:8});await page.mouse.up();
  await page.waitForFunction(before=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray().some((v,i)=>Math.abs(v-before[i])>.001),before.camera);
  checks.push('Normal mouse drag rotates the camera');
  await page.waitForFunction(frame=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame()!==frame,before.frame);
  checks.push('Native preview advances while playing');
  const speed=page.getByRole('slider',{name:'Speed',exact:true});
  const range=await speed.boundingBox();
  await page.evaluate(()=>{window.fxDragStart=mdlxlProbe('.sfx-stage .game-preview-root').runtime;});
  await page.mouse.move(range.x+range.width*.20,range.y+range.height/2);await page.mouse.down();
  await page.mouse.move(range.x+range.width*.64,range.y+range.height/2,{steps:18});
  assert.equal(await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime===window.fxDragStart),true,'Dragging a range keeps the same live renderer until release');
  await page.mouse.up();await ready();
  assert.equal(await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime===window.fxDragStart),false,'Release installs the adjusted effect');
  checks.push('Slider draft keeps renderer until release');
  // Find a different visible surface through the same hover feedback a user gets.
  let picked=null;
  for(const y of [.4,.45,.5,.55,.6,.65]) {
   for(const x of [.48,.52,.46,.54,.44,.56,.42,.58]) {
    await page.mouse.move(box.x+x*box.width,box.y+y*box.height);
    const id=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(mdlxlProbe('.sfx-stage .game-preview-root').props.hoveredGeoset))));
    if(id!=null&&id>0){picked=id;break;}
   }
   if(picked!==null)break;
  }
  assert.notEqual(picked,null,'Another geoset highlights under the pointer');
  await page.keyboard.down('Control');await page.mouse.down();await page.mouse.up();await page.keyboard.up('Control');
  await page.waitForFunction(id=>document.querySelector('.sfx-target select').value===String(id),picked);
  await page.getByLabel('Geoset',{exact:true}).selectOption('0');await ready();checks.push('Ctrl-click selects the highlighted surface');
  assert.ok((await read()).model.GlobalSequences.at(-1)<before.model.GlobalSequences.at(-1),'Speed shortens the imported loop');
  await button('Replace').click();await ready();
  assert.equal((await read()).model.Geosets.length,original.Geosets.length);
  await button('New geoset').click();await ready();
  let result=await read();assert.equal(result.model.Geosets.length,original.Geosets.length+1);
  assert.equal(result.model.Geosets.at(-1).Vertices.length,12,'Native eye surface has four vertices');
  await page.getByLabel('Shape',{exact:true}).selectOption('copy');await ready();
  result=await read();assert.deepEqual(result.model.Geosets.at(-1).VertexGroup,original.Geosets[0].VertexGroup);
  await page.getByLabel('Shape',{exact:true}).selectOption('native');await ready();
  await dragHandle('move');await dragHandle('scale');
  await page.screenshot({path:path.join(out,'eye-placement.png')});
  const placedPreview=await read();
  await button('Apply effect').click();
  await page.getByRole('dialog',{name:'Surface Effects',exact:true}).waitFor({state:'hidden'});
  await page.waitForFunction(n=>mdlxlProbe().session.doc.model.Geosets.length===n,original.Geosets.length+1);
  const inserted=await documentModel();assert.deepEqual(inserted.Helpers,original.Helpers,'Placement leaves no helper');assert.deepEqual(inserted.PivotPoints,original.PivotPoints);assert.deepEqual(inserted.GlobalSequences,placedPreview.model.GlobalSequences,'Only material clocks are saved');assert.deepEqual(inserted.Bones,original.Bones);assert.deepEqual(inserted.Sequences,original.Sequences);checks.push('Overlay, Replace, copy shape and native eye surface');
  await stubDialogs(app,{save:path.join(out,'eye-result.mdx')});
  await page.keyboard.press('F12');
  await button('Save MDX…').click();
  await page.waitForFunction(()=>!document.querySelector('[role=dialog][aria-label="Save as"]'));
  const {openDocument}=await import('../src/editor-document.js');
  const savedEye=openDocument(fs.readFileSync(path.join(out,'eye-result.mdx')),'eye-result.mdx').model;
  assert.equal(savedEye.Geosets.length,inserted.Geosets.length);
  assert.equal(savedEye.Helpers.length,original.Helpers.length);assert.deepEqual(savedEye.GlobalSequences,inserted.GlobalSequences);
  checks.push('Saved native eye reopens with the expected geometry and clocks');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(n=>mdlxlProbe().session.doc.model.Geosets.length===n,original.Geosets.length);
  const undone=await documentModel();assert.deepEqual(undone,original);checks.push('One Undo restores model');
  const {SURFACE_EFFECTS}=await import('../src/surface-effects.js');
  for(const {name} of SURFACE_EFFECTS.filter(entry=>entry.id!=='eye')){
   await button('Surface Effects').click();await ready();console.log('PREVIEW',name);await button(name).click();await ready();
   const state=await read();assert.ok(!await page.locator('.sfx-error').count(),name);
   await button('Apply effect').click();await page.getByRole('dialog',{name:'Surface Effects',exact:true}).waitFor({state:'hidden'});
   const current=await documentModel();assert.deepEqual(current.Sequences,original.Sequences,name+' sequence times');
   await page.keyboard.press('Control+z');await page.waitForFunction(n=>mdlxlProbe().session.doc.model.Textures.length===n,original.Textures.length);
   assert.deepEqual(await documentModel(),original,name+' undo');checks.push(name+' previews, applies and undoes');console.log('PASS',name);
  }
  await button('Surface Effects').click();await ready();await button('Water skin').click();await ready();
  await page.screenshot({path:path.join(out,'workspace.png')});await button('Cancel').click();
  {
   await stubDialogs(app,{open:testModel('surface-effects/WH_WOC_KnightTzeentchSword04.mdx')});await page.keyboard.press('Control+o');
   await page.waitForFunction(()=>mdlxlProbe().session.path?.includes('KnightTzeentchSword'));
   await button('Surface Effects').click();await ready();await page.getByLabel('Geoset',{exact:true}).selectOption('26');await button('Replace').click();await ready();await page.locator('.sfx-window').getByRole('button',{name:'Solo',exact:true}).click();await ready();await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.hiddenGeosets?.size>0);await page.locator('.sfx-window').getByRole('button',{name:'Fit selection',exact:true}).click();
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame()>0);
   const stage=await page.locator('.sfx-stage canvas').first().boundingBox();
   await page.mouse.move(stage.x+stage.width*.7,stage.y+stage.height*.36);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.7+45,stage.y+stage.height*.36+20,{steps:6});await page.mouse.up();
   const cameraBeforeSeek=(await read()).camera;
   const clip=page.getByLabel('Preview animation',{exact:true});
   const next=await clip.locator('option').evaluateAll(rows=>rows.find(row=>!row.selected)?.value);
   if(next!=null){await clip.selectOption(next);await page.waitForFunction(n=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getSequence()===Number(n),next);assert.ok((await read()).camera.every((v,i)=>Math.abs(v-cameraBeforeSeek[i])<1e-9),'Changing animation retains the manually rotated solo camera');}
   await page.screenshot({path:path.join(out,'knight-eye.png')});await button('Cancel').click();checks.push('Tzeentch knight geoset 27 previews the native eye');
  }
  assert.deepEqual(run.errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,checks},null,2));
 }catch(error){console.error('FAILURE',error);if(!page.isClosed()){console.error((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}
 finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
