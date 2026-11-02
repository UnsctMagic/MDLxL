const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,launchApp,closeApp}=require('./helpers/app.cjs'),{testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const {GLOBAL_LOOKS}=await import('../src/global-animation-looks.js'),out=path.join(root,'out/empty-emitter');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage');
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await fx.getByRole('button',{name:name+' global animation',exact:true}).click();await ready();};
 const model=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model),source=()=>page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model));
 try{
  await page.waitForFunction(()=>mdlxlProbe().session?.doc?.model?.Geosets?.length>28);const original=await source();await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await choose('Lightning blade');
  assert.equal(await fx.getByLabel('Add emitter',{exact:true}).count(),1,'the emitter choice is available before adding any emitter');
  assert.equal(await fx.getByLabel('Add emitter',{exact:true}).inputValue(),'');assert.equal(await fx.getByLabel('Create as overlay').isChecked(),false);
  let m=await model();assert.deepEqual(m.Geosets[28]._FxStack.layers.map(l=>l.label),['Storm steel','Forked arcs','Blade arcs']);assert.equal(m.ParticleEmitters2.filter(p=>p._FxTag).length,0);
  await page.screenshot({path:path.join(out,'lightning-default.jpg'),type:'jpeg',quality:86});
  for(const look of GLOBAL_LOOKS){await choose(look.name);assert.equal(await fx.getByLabel('Add emitter',{exact:true}).inputValue(),'');}
  await choose('Ice skin');assert.equal(await fx.getByLabel('Ice variation',{exact:true}).inputValue(),'white');m=await model();assert.ok(m.Textures.some(t=>/North_Snow/i.test(t.Image)));
  await page.screenshot({path:path.join(out,'ice-default.jpg'),type:'jpeg',quality:86});
  await fx.getByLabel('Ice variation',{exact:true}).selectOption('dark');await ready();assert.ok((await model()).Textures.some(t=>/Ice_Natural01/i.test(t.Image)));
  await choose('Lightning blade');await fx.getByLabel('Add emitter',{exact:true}).selectOption('Star sparks');await ready();
  assert.equal(await fx.getByLabel('Add emitter',{exact:true}).inputValue(),'');m=await model();assert.ok(m.ParticleEmitters2.some(p=>p._FxTag&&p.Name.startsWith('FX Star sparks')));
  for(const stage of ['Born','Halfway','End'])assert.equal(await fx.getByLabel(stage+' color',{exact:true}).count(),1);
  await fx.getByLabel('Born color',{exact:true}).fill('#34aaff');await fx.getByLabel('Loop length',{exact:true}).click();await ready();m=await model();assert.ok(m.ParticleEmitters2.filter(p=>p._FxTag&&p.Name.startsWith('FX Star sparks')).every(p=>Math.abs(p.SegmentColor[0][0]-52/255)<1e-5&&p.SegmentColor[0][2]===1));
  await fx.getByRole('button',{name:'Apply effect',exact:true}).click();await fx.waitFor({state:'hidden'});await page.keyboard.press('Control+z');await page.waitForFunction(()=>!mdlxlProbe().session.doc.model.Geosets[28]._FxStack);assert.equal(await source(),original);
  assert.deepEqual(errors,[]);console.log('PASS empty emitter choice on all '+GLOBAL_LOOKS.length+' presets, restored surface defaults, white ice default, emitter creation, native life fields and exact Undo.');
 }catch(e){await page.screenshot({path:path.join(out,'failure.jpg')});throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});