const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {launchApp,closeApp,root}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
const {addEmitter}=require('./helpers/fx-input.cjs');
// WRITTEN, NOT RUN. The user's own looks: edit Fire, Save as… "My fire", find it under My looks, use it on another
// geoset, keep it across a restart, delete it with ×, then build from Empty and undo the Apply. Real clicks only.
(async()=>{
 const out=path.join(root,'out/fx-own-looks');fs.mkdirSync(out,{recursive:true});
 const profile=path.join(out,'profile-own-looks');fs.rmSync(profile,{recursive:true,force:true});
 const fixture=testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),errors=[];
 let app,page,fx;
 const launch=async()=>{
  ({app,page}=await launchApp({fixture,out,profile,errors,bounds:{x:0,y:0,width:1450,height:960}}));
  fx=page.getByRole('dialog',{name:'Surface Effects',exact:true});
 };
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const type=async(input,value)=>{await input.click();await page.keyboard.press('Control+a');await page.keyboard.type(String(value));};
 const find=async name=>{await type(fx.getByLabel('Find a surface effect'),name);};
 const choose=async name=>{await find(name);await fx.getByRole('button',{name:name+' global animation',exact:true}).click();await ready();};
 const select=async name=>{await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:new RegExp('^'+name)}).click();await ready();};
 const stack=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Geosets.find(g=>g._FxStack)?._FxStack||null);
 const revision=()=>page.evaluate(()=>mdlxlProbe().session.doc.revision),source=()=>page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model));
 const openFx=async()=>{await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();};
 const geoset=async value=>{await fx.getByLabel('Geoset',{exact:true}).selectOption(String(value));await ready();};
 const saved=()=>{try{return fs.readFileSync(path.join(profile,'settings.json'),'utf8');}catch{return '';}};
 try{
  await launch();await openFx();await geoset(28);

  // Pick Fire, change a colour and Amount, then Save as… "My fire".
  await choose('Fire');await select('Flames');
  await fx.getByLabel('RGB tint').fill('#00ff00');await ready();
  const amount=fx.getByLabel('Amount value',{exact:true});await type(amount,117);await page.keyboard.press('Enter');await ready();
  const flame=(await stack()).layers.find(l=>l.label==='Blade flames');assert.equal(flame.amount,117);assert.deepEqual(flame.tint,[0,1,0]);
  const before=await revision();
  await fx.getByRole('button',{name:'Save as…',exact:true}).click();
  await fx.getByLabel('Preset name',{exact:true}).fill('My fire');
  await fx.getByRole('button',{name:'Save',exact:true}).click();
  assert.ok(await fx.getByRole('status').filter({hasText:'My fire saved.'}).isVisible(),'the status says it was saved');
  assert.equal(await fx.isVisible(),true,'saving does not close the window');
  assert.equal(await revision(),before,'saving a look is not a model edit');
  assert.equal(await fx.getByRole('heading',{name:'My fire',exact:true}).isVisible(),true,'the title shows the user name');
  const folders=await fx.locator('.sfx-cards section>button').allTextContents();
  assert.match(folders[0],/^My looks/,'My looks is the first folder');
  assert.equal(await fx.getByRole('button',{name:'My fire global animation',exact:true}).getAttribute('aria-pressed'),'true','the library selects the saved look');

  // Another geoset: clicking My fire brings its layers with the edited values.
  await geoset(27);await choose('Glow');await find('');await page.keyboard.press('Backspace');
  await fx.getByRole('button',{name:'My fire global animation',exact:true}).click();await ready();
  const again=await stack();
  assert.equal(again.look,'own-my-fire');
  const mine=again.layers.find(l=>l.label==='Blade flames');
  assert.equal(mine.amount,117,'the edited Amount comes along');assert.deepEqual(mine.tint,[0,1,0],'the edited colour comes along');
  assert.ok(await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Flames/}).isVisible());

  // Restart: the look is still listed.
  for(let i=0;i<50&&!saved().includes('own-my-fire');i++)await page.waitForTimeout(100);
  assert.ok(saved().includes('own-my-fire'),'the look was written to settings.json');
  await closeApp(app,{keepProfile:true});
  await launch();await openFx();
  await fx.getByRole('button',{name:/^My looks/}).click();
  assert.equal(await fx.getByRole('button',{name:'My fire global animation',exact:true}).isVisible(),true,'My fire is still there after a restart');

  // Delete it with ×.
  await fx.getByRole('button',{name:'My fire global animation',exact:true}).click();await ready();
  await fx.getByRole('button',{name:'Delete this look',exact:true}).click();
  await fx.getByRole('button',{name:/^My looks/}).waitFor({state:'detached'});
  assert.equal(await fx.getByRole('button',{name:'My fire global animation',exact:true}).count(),0,'the look is gone from the library');
  assert.ok(await fx.getByRole('group',{name:'Layers'}).getByRole('button').count()>0,'the effect on screen is kept');

  // Empty: no layers; add one layer and one emitter, Apply, and one Undo restores the model.
  await geoset(28);await choose('Empty');
  assert.equal(await fx.getByRole('group',{name:'Layers'}).getByRole('button').count(),0,'Empty starts with no layers');
  const original=await source();
  await fx.getByLabel('Add layer',{exact:true}).selectOption('Flowing energy');await ready();
  await addEmitter(page,fx,'Rising embers',ready);
  assert.equal(await fx.getByRole('group',{name:'Layers'}).getByRole('button').count(),2);
  const applied=await revision();
  await fx.getByRole('button',{name:'Apply effect',exact:true}).click();await fx.waitFor({state:'hidden'});
  assert.notEqual(await revision(),applied,'Apply edits the model');
  const afterApply=await revision();await page.keyboard.press('Control+z');
  await page.waitForFunction(r=>mdlxlProbe().session.doc.revision!==r,afterApply);
  assert.deepEqual(JSON.parse(await source()),JSON.parse(original),'one Undo restores the exact original model');
  assert.deepEqual(errors,[]);console.log('PASS own looks: save, reuse on another geoset, restart, delete, Empty build and Undo');
 }catch(error){console.error((await page.locator('body').innerText()).slice(-2100));await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
