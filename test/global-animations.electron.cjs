const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,stubDialogs,root}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const fixture=testModel('optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx'),out=path.join(root,'out','global-animation-workflow');
 const {app,page,errors}=await launchApp({fixture,out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),button=n=>fx.getByRole('button',{name:n,exact:true});
 const ready=()=>page.waitForFunction(()=>{const el=document.querySelector('.sfx-stage .game-preview-root');return el&&mdlxlProbe(el).runtime?.captureApi.isReady&&mdlxlProbe(el).runtime.particleSourceModel===mdlxlProbe(el).props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout:45000});
 const open=async()=>{await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();};
 const stack=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Geosets[18]._FxStack);
 const drag=async(label,dx,dy)=>{
  const knob=fx.getByRole('slider',{name:label,exact:true}).locator('circle');await knob.waitFor();
  const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();await ready();
 };
 try{
  await stubDialogs(app,{message:1});await open();
  await fx.getByLabel('Geoset',{exact:true}).selectOption('18');await button('Flaming sword global animation').click();await ready();
  const previous=await stack();assert.equal(previous.layers.length,3);
  const stage=fx.locator('.sfx-stage'),box=await stage.boundingBox();
  const cam=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());
  const oldCamera=await cam(),x=box.x+box.width*.72,y=box.y+box.height*.4;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+72,y+16,{steps:8});await page.mouse.up();assert.notDeepEqual(await cam(),oldCamera);
  await button('Fit selection').click();await button('Position & size').click();await button('Pause').click();await ready();
  await drag('Ribbon upper edge',-22,14);await drag('Ribbon lower edge',14,16);
  const changed=(await stack()).layers[1];assert.notEqual(changed.upper,previous.layers[1].upper);assert.notEqual(changed.lower,previous.layers[1].lower);
  await button('Ember red').click();await fx.getByLabel('Loop length').fill('2380');await fx.getByLabel('Loop length').press('Enter');await ready();
  for(const anim of ['Stand','Walk','Attack','Death']){
   const seq=await fx.getByLabel('Preview animation').locator('option').evaluateAll((a,n)=>a.find(v=>v.textContent.startsWith(n)).value,anim);
   await fx.getByLabel('Preview animation').selectOption(seq);await ready();
   assert.ok(await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.ParticleEmitters2.filter(n=>n._FxTag).every(n=>n.Visibility.GlobalSeqId>=0)));
  }
  await button('Apply effect').click();await fx.waitFor({state:'hidden'});
  const count=()=>page.evaluate(()=>{const m=mdlxlProbe().session.doc.model;return [m.Bones.length,m.ParticleEmitters2.length,m.Geosets.length];});
  const a=await count();
  const surface=await page.evaluate(()=>mdlxlProbe().session.doc.model.Geosets.findIndex(g=>g._FxTag?.endsWith('/shape')));
  const selection=page.getByRole('checkbox',{name:'Select geoset '+surface,exact:true});
  if(await selection.isChecked())await selection.uncheck();
  await selection.check();await open();assert.equal(await fx.getByLabel('Geoset',{exact:true}).inputValue(),'18');
  assert.equal((await stack()).loop,2380);
  await fx.getByLabel('Loop length').fill('2200');await fx.getByLabel('Loop length').press('Enter');await ready();await button('Apply effect').click();await fx.waitFor({state:'hidden'});assert.deepEqual(await count(),a);
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>mdlxlProbe().session.doc.model.Geosets[18]._FxStack?.loop===2380);
  const dest=path.join(out,'reopened.mdx');await stubDialogs(app,{save:dest});await page.keyboard.press('F12');await page.getByRole('button',{name:'Save MDX…',exact:true}).click();await page.getByRole('dialog',{name:'Save model'}).getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[role=dialog][aria-label="Save as"]'));await require('node:timers/promises').setTimeout(100);
  const {openDocument}=await import('../src/editor-document.js');assert.equal(openDocument(fs.readFileSync(dest),dest).model.Geosets[18]._FxStack.loop,2380);
  for(const [name,key] of [['Rune blade','size'],['Fly swarm','size']]){
   await open();await fx.getByLabel('Geoset',{exact:true}).selectOption('18');await button(name+' global animation').click();await ready();
   await button('Fit selection').click();await button('Position & size').click();
   if(await button('Pause').count())await button('Pause').click();
   const before=(await stack()).layers[0];await drag('Resize particle',18,-8);
   assert.notEqual((await stack()).layers[0][key],before[key],name+' radius');
   await drag('Move emitter',14,3);assert.notDeepEqual((await stack()).layers[0].offset,before.offset,name+' position');
   if(name==='Fly swarm'){
    await fx.getByLabel('Amount value').fill('3');await fx.getByLabel('Amount value').press('Enter');await ready();assert.equal((await stack()).layers[0].amount,3);
   }
   await button('Cancel').click();await fx.waitFor({state:'hidden'});
  }
  await open();await fx.getByLabel('Geoset',{exact:true}).selectOption('18');await ready();await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/Blade flames/}).click();await button('Open in EMTR').click();
  await page.getByRole('dialog',{name:'Particle Editor',exact:true}).waitFor();assert.deepEqual(errors,[]);
  console.log('Both blade ends, colour, clock, four clips, actual orbit, Apply, Undo, re-edit, MDX and EMTR passed.');
 }catch(error){console.error((await page.locator('body').innerText()).slice(-1100));await page.screenshot({path:path.join(out,'failure.jpg')});throw error;}
 finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
