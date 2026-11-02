const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,launchApp,closeApp,stubDialogs}=require('./helpers/app.cjs'),{testModel}=require('./helpers/fixtures.cjs');
const {selectOption,addEmitter}=require('./helpers/fx-input.cjs');
(async()=>{
 const {GLOBAL_LOOKS}=await import('../src/global-animation-looks.js'),out=path.join(root,'out/empty-emitter');fs.mkdirSync(out,{recursive:true});
 const {legacyFlamingSword}=await import('./helpers/fx-legacy-fixtures.mjs'),legacyFiles=legacyFlamingSword(out);
 const mouseSettings=process.env.FX_MOUSE_SETTINGS;
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960},...(mouseSettings?{settings:JSON.parse(fs.readFileSync(mouseSettings))}:{})});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage');
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const type=async(input,value)=>{await input.click();await page.keyboard.press('Control+a');await page.keyboard.type(String(value));};
 const choose=async name=>{await type(fx.getByLabel('Find a surface effect'),name);await fx.getByRole('button',{name:name+' global animation',exact:true}).click();await ready();};
 const model=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model),source=()=>page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model));
 const openFx=async()=>{await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await selectOption(page,fx.getByLabel('Geoset',{exact:true}),'Geoset 29 · EredarPurple');await ready();};
 const apply=async()=>{await fx.getByRole('button',{name:'Apply effect',exact:true}).click();await fx.waitFor({state:'hidden'});};
 const undo=async original=>{const revision=await page.evaluate(()=>mdlxlProbe().session.doc.revision);await page.keyboard.press('Control+z');await page.waitForFunction(revision=>mdlxlProbe().session.doc.revision!==revision,revision);assert.deepEqual(JSON.parse(await source()),JSON.parse(original),'one Undo restores the exact original model');};
 const open=async file=>{await stubDialogs(app,{open:file});await page.keyboard.press('Control+o');await page.waitForFunction(file=>mdlxlProbe().session?.path===file,file);};
 const save=async file=>{await stubDialogs(app,{save:file});await page.keyboard.press('F12');await page.getByRole('button',{name:'Save '+path.extname(file).slice(1).toUpperCase()+'…',exact:true}).click();await page.getByRole('dialog',{name:'Save model',exact:true}).getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(file=>mdlxlProbe().session.path===file&&!mdlxlProbe().session.doc.dirty,file);await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});assert.ok(fs.statSync(file).size>1000);};
 const motion=async name=>{
  for(let i=0;i<5;i++){
   const time=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame());
   await page.waitForFunction(t=>{const n=mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame();return n<t||n>t+200;},time);
   await stage.screenshot({path:path.join(out,name+'-'+i+'.jpg'),type:'jpeg',quality:86});
  }
 };
 try{
  await stubDialogs(app,{message:1});await page.waitForFunction(()=>mdlxlProbe().session?.doc?.model?.Geosets?.length>28);const original=await source();await openFx();await choose('Flaming sword');
  let m=await model();assert.equal(m.Geosets[28]._FxStack.layers.filter(l=>l.type==='Particles').length,0,'Flaming sword starts with zero particle layers');assert.equal(m.ParticleEmitters2.filter(p=>p._FxTag).length,0);
  const own=fx.getByLabel('Add emitter',{exact:true});assert.deepEqual((await own.locator('option').allTextContents()).slice(0,3),['Add emitter','Blade flames (recommended)','Rising embers']);
  await apply();assert.equal(JSON.parse(await source()).ParticleEmitters2.length,JSON.parse(original).ParticleEmitters2.length);await undo(original);
  await openFx();
  for(const look of GLOBAL_LOOKS){
   await choose(look.name);m=await model();assert.equal(await fx.getByRole('group',{name:'Layers',exact:true}).locator('.fx-layer-row').count(),look.layers.filter(l=>l.type!=='Particles').length,look.name+' shows only non-particle layers');assert.equal(m.ParticleEmitters2.filter(p=>p._FxTag).length,0,look.name+' creates no emitters');
   const expected=look.layers.filter(l=>l.type==='Particles').map((l,i)=>l.label+(i===0?' (recommended)':'')),labels=(await own.locator('option').allTextContents()).slice(1);
   assert.deepEqual(labels.slice(0,expected.length),expected);assert.equal(labels.filter(l=>l.endsWith(' (recommended)')).length,expected.length?1:0);
  }
  await choose('Lightning blade');m=await model();assert.deepEqual(m.Geosets[28]._FxStack.layers.map(l=>l.label),['Storm steel','Forked arcs','Blade arcs']);assert.equal(await fx.getByLabel('Create as overlay').isChecked(),false);
  await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Blade arcs/}).click();for(const label of ['Time between bursts (s)','Burst duration (s)','Flashes per burst'])assert.equal(await fx.getByLabel(label,{exact:true}).count(),0);
  await choose('Ice skin');assert.equal(await fx.getByLabel('Ice variation',{exact:true}).inputValue(),'white');assert.equal((await model()).ParticleEmitters2.filter(p=>p._FxTag).length,0);
  await choose('Flaming sword');await addEmitter(page,fx,'Blade flames (recommended)',ready);m=await model();assert.equal(m.Geosets[28]._FxStack.layers.filter(l=>l.type==='Particles').length,1);assert.deepEqual([...new Set(m.ParticleEmitters2.filter(p=>p._FxTag).map(p=>p.Parent))].sort((a,b)=>a-b),[19,22]);
  await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props.Name.startsWith('FX Blade flames')).every(e=>e.particles.length>0));
  const b=await stage.boundingBox(),camera=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray()),before=await camera();
  await page.mouse.move(b.x+b.width*.72,b.y+b.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.72+55,b.y+b.height*.4+15,{steps:10});await page.mouse.up();assert.notDeepEqual(await camera(),before,'normal mouse orbit works');await fx.getByRole('button',{name:'Fit selection',exact:true}).click();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,300);await ready();
  for(const clip of ['Stand - 1','Walk','Attack 1']){await selectOption(page,fx.getByLabel('Preview animation'),clip);await ready();await motion(clip.replace(/\W/g,''));}
  await apply();const files=[];for(const ext of ['mdx','mdl']){const file=path.join(out,'recommended.'+ext);await save(file);files.push(file);}await undo(original);
  for(const file of [...files,...legacyFiles]){
   assert.ok(fs.existsSync(file),'Prepare the legacy fixture with 676aaf6f: '+file);console.log('Re-editing',path.basename(file));await open(file);const reopened=await source(),count=JSON.parse(reopened).ParticleEmitters2.length;await openFx();m=await model();assert.equal(m.Geosets[28]._FxStack.look,'flaming-sword');assert.ok(m.Geosets[28]._FxStack.layers.some(l=>l.label==='Blade flames'));assert.equal(m.ParticleEmitters2.length,count);
   await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Blade flames/}).click();const amount=fx.getByLabel('Amount value',{exact:true});await type(amount,117);await page.keyboard.press('Enter');await ready();assert.equal((await model()).Geosets[28]._FxStack.layers.find(l=>l.label==='Blade flames').amount,117);await apply();await undo(reopened);
  }
  assert.deepEqual(errors,[]);console.log('PASS all '+GLOBAL_LOOKS.length+' presets empty and ordered; recommended flames on both blades; normal mouse orbit; Stand/Walk/Attack; Apply/exact Undo; MDX/MDL save/reopen/re-edit; pre-change MDX/MDL emitters retained.');
 }catch(e){await page.screenshot({path:path.join(out,'failure.jpg')});throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
