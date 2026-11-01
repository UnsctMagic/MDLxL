const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {launchApp,closeApp,root}=require('./helpers/app.cjs');const {testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.join(root,'out/owner-round');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),button=n=>fx.getByRole('button',{name:n,exact:true});
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const model=()=>page.evaluate(()=>JSON.parse(JSON.stringify(mdlxlProbe('.sfx-stage .game-preview-root').props.model)));
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await fx.getByRole('button',{name:new RegExp('^'+name+' (global animation|impact)$')}).click();await ready();};
 const edit=async(label,value)=>{await fx.getByLabel(label,{exact:true}).fill(String(value));await fx.getByLabel(label,{exact:true}).press('Enter');await ready();};
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await choose('Flaming sword');
  await fx.locator('.sfx-cards .folder svg').first().waitFor({state:'visible',timeout:3000});
  await page.waitForFunction(()=>document.querySelector('.sfx-card img.gf-icon')?.naturalWidth>0);
  for(const [i,name] of ['Born','Halfway','End'].entries()){
   assert.equal(await fx.getByLabel(name+' color',{exact:true}).count(),1,'FX exposes EMTR '+name+' color');
   const colour=['#ff0000','#00ff00','#0000ff'][i];
   await fx.getByLabel(name+' color',{exact:true}).click();await page.keyboard.press('Escape');await fx.getByLabel(name+' color',{exact:true}).fill(colour);await fx.getByLabel('Loop length',{exact:true}).click();await ready();
   await edit(name+' size',i+2);await edit(name+' see-through',i*25);
  }
  const m=await model(),flames=m.ParticleEmitters2.filter(n=>n._FxTag?.includes('/2/'));
  assert.ok(flames.length);for(const p of flames){assert.deepEqual(p.SegmentColor.map(c=>Object.values(c)),[[1,0,0],[0,1,0],[0,0,1]]);assert.deepEqual(Object.values(p.ParticleScaling),[2,3,4]);assert.deepEqual(Object.values(p.Alpha),[255,191,128]);}
  await button('Pause').click();const stage=fx.locator('.sfx-stage'),before=await stage.screenshot();await fx.getByLabel('Highlight geoset',{exact:true}).check();
  await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.hoveredGeoset===28);const lit=await stage.screenshot();assert.notDeepEqual(lit,before,'Highlight changes rendered preview');await fx.getByLabel('Highlight geoset',{exact:true}).uncheck();
  const box=await stage.boundingBox(),camera=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray()),old=await camera();
  await page.mouse.move(box.x+box.width*.75,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.75+45,box.y+box.height*.4+15,{steps:8});await page.mouse.up();assert.notDeepEqual(await camera(),old,'ordinary mouse orbit works');
  let picked=false;for(const [x,y] of [[.5,.45],[.5,.3],[.4,.45],[.4,.6],[.6,.4],[.5,.6]]){await page.mouse.dblclick(box.x+box.width*x,box.y+box.height*y);await ready();if(await fx.getByLabel('Geoset',{exact:true}).inputValue()!=='28'){picked=true;break;}}assert.ok(picked,'double-click selects the visible surface without Ctrl');
  await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await choose('Iron strike');
  assert.equal(await button('Continuous').count(),0);const input=fx.getByLabel('Impact moment value',{exact:true}),hit=Number(await input.inputValue());await edit('Impact moment value',hit+5);const impact=await model();assert.equal(impact.Geosets[28]._FxStack.hit,hit+5);assert.ok(impact.ParticleEmitters2.filter(p=>p._FxTag).every(p=>p.EmissionRate.GlobalSeqId===null));
  await choose('Recall seal');assert.equal((await model()).EventObjects.filter(p=>p._FxTag).length,0);await fx.getByLabel('Enable Ground seal',{exact:true}).check();await ready();assert.equal((await model()).EventObjects.filter(p=>p._FxTag).length,1);await fx.getByLabel('Enable Ground seal',{exact:true}).uncheck();await ready();assert.equal((await model()).EventObjects.filter(p=>p._FxTag).length,0);
  await choose('Glowing skin');const strength=fx.getByRole('slider',{name:'Intensity',exact:true}),bounds=await strength.boundingBox(),prior=(await model()).Geosets[28]._FxStack.layers[0].strength;
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width-3,bounds.y+bounds.height/2,{steps:8});assert.equal((await model()).Geosets[28]._FxStack.layers[0].strength,prior,'drag does not rebuild until release');await page.mouse.up();await ready();assert.ok((await model()).Geosets[28]._FxStack.layers[0].strength>3.5);
  await page.screenshot({path:path.join(out,'controls.png')});assert.deepEqual(errors,[]);console.log('PASS 3 colors + 3 sizes + 3 transparency fields, highlight, double-click, mouse orbit, Attack timing, optional ground and release-only strength.');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});console.error((await page.locator('body').innerText()).slice(-1400));throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
