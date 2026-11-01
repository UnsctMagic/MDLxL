const {fixturePath,testModel}=require('./helpers/fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,root,stubDialogs}=require('./helpers/app.cjs');
(async()=>{
 const out=path.join(root,'out/surface-effects');fs.mkdirSync(out,{recursive:true});
 const run=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:-3000,y:0,width:1440,height:1000}});
 const {page,app}=run,checks=[];app.process().stderr.on('data',d=>fs.appendFileSync(path.join(out,'electron.log'),d));app.process().on('exit',(code,signal)=>console.log('APP EXIT',code,signal));
 const dragAccent=async(label,field,dx,dy)=>{
  const knob=page.locator('.sfx-stage').getByRole('slider',{name:label,exact:true}).locator('circle');
  await knob.waitFor();const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  const values=()=>page.evaluate(f=>{const r=mdlxlProbe('.sfx-stage .game-preview-root').props.model;return r.ParticleEmitters2.slice(-2).map(n=>Array.from(n[f]));},field);
  const start=await values();await page.evaluate(()=>{window.fxHandleRuntime=mdlxlProbe('.sfx-stage .game-preview-root').runtime;});
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});
  await page.waitForFunction(({field,start})=>{const r=mdlxlProbe('.sfx-stage .game-preview-root').runtime;return r===window.fxHandleRuntime&&r.native.model.ParticleEmitters2.slice(-2).some((n,i)=>Array.from(n[field]).some((v,j)=>Math.abs(v-start[i][j])>.001));},{field,start});
  await page.mouse.up();await ready();
  assert.notDeepEqual(await values(),start,label+' changes the staged accent');checks.push(label+' uses the EMTR handle');
 };
 const button=name=>page.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;const r=mdlxlProbe(el).runtime;return r?.captureApi.isReady&&r.particleSourceModel===mdlxlProbe(el).props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const read=()=>page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return {model:JSON.parse(JSON.stringify(p.props.model,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)),camera:p.runtime.controls.object.position.toArray(),frame:p.runtime.native.getFrame(),globals:p.runtime.native.rendererData.globalSequencesFrames};});
 const documentModel=()=>page.evaluate(()=>JSON.parse(JSON.stringify(mdlxlProbe().session.doc.model,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)));
 try{
  await button('Surface Effects').click();await ready();
  const original=await documentModel();
  const before=await read(),box=await page.locator('.sfx-stage').boundingBox();
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
  await button('Moon orbit').click();await ready();await button('New geoset').click();await ready();
  const staged=await read();assert.equal(staged.model.Geosets.length,original.Geosets.length+1);
  assert.deepEqual(staged.model.Geosets.at(-1).VertexGroup,original.Geosets[0].VertexGroup);
  await button('Position & size').click();await button('Pause').click();await ready();
  await dragAccent('Move emitter','PivotPoint',29,-14);await dragAccent('Resize particle','ParticleScaling',21,-12);
  const final=await read();await button('Apply effect').click();await page.getByRole('dialog',{name:'Surface Effects',exact:true}).waitFor({state:'hidden'});
  const inserted=await documentModel();assert.deepEqual(inserted.Helpers,original.Helpers);
  assert.deepEqual(inserted.PivotPoints,final.model.PivotPoints);assert.deepEqual(inserted.Bones,original.Bones);assert.deepEqual(inserted.Sequences,original.Sequences);
  const file=path.join(out,'orbit-result.mdx');await stubDialogs(app,{save:file});await page.keyboard.press('F12');await button('Save MDX…').click();
  await page.waitForFunction(()=>!document.querySelector('[role=dialog][aria-label="Save as"]'));
  const {openDocument}=await import('../src/editor-document.js');const saved=openDocument(fs.readFileSync(file),'orbit-result.mdx').model;
  assert.equal(saved.Geosets.length,inserted.Geosets.length);assert.deepEqual(saved.ParticleEmitters2.slice(-2).map(n=>Array.from(n.PivotPoint)),inserted.ParticleEmitters2.slice(-2).map(n=>n.PivotPoint));
  checks.push('Overlay, Replace, copied shape and both placed accents survive saved MDX');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(n=>mdlxlProbe().session.doc.model.Geosets.length===n,original.Geosets.length);
  const undone=await documentModel();assert.deepEqual(undone,original);checks.push('One Undo restores model');
  const {SURFACE_EFFECTS}=await import('../src/surface-effects.js');
  for(const {name} of SURFACE_EFFECTS){
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
   await button('Surface Effects').click();await ready();await page.getByLabel('Geoset',{exact:true}).selectOption('26');await button('Storm filament').click();await ready();await button('Replace').click();await ready();await page.locator('.sfx-window').getByRole('button',{name:'Solo',exact:true}).click();await ready();await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.hiddenGeosets?.size>0);await page.locator('.sfx-window').getByRole('button',{name:'Fit selection',exact:true}).click();
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame()>0);
   const cameraBeforeDrag=(await read()).camera,stage=await page.locator('.sfx-stage').boundingBox();
   await page.mouse.move(stage.x+stage.width*.7,stage.y+stage.height*.36);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.7+45,stage.y+stage.height*.36+20,{steps:6});await page.mouse.up();
   await page.waitForFunction(prior=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray().some((v,i)=>Math.abs(v-prior[i])>.001),cameraBeforeDrag);
   const cameraBeforeSeek=(await read()).camera;
   const clip=page.getByLabel('Preview animation',{exact:true});
   const next=await clip.locator('option').evaluateAll(rows=>rows.find(row=>!row.selected)?.value);
   if(next!=null){await clip.selectOption(next);await page.waitForFunction(n=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getSequence()===Number(n),next);assert.ok((await read()).camera.every((v,i)=>Math.abs(v-cameraBeforeSeek[i])<1e-9),'Changing animation retains the manually rotated solo camera');}
   await page.screenshot({path:path.join(out,'knight-filament.png')});await button('Cancel').click();checks.push('Tzeentch shield previews a moving filament and keeps its rotated camera');
  }
  assert.deepEqual(run.errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,checks},null,2));
 }catch(error){console.error('FAILURE',error);if(!page.isClosed()){console.error((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}
 finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
