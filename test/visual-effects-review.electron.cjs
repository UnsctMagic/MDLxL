const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {launchApp,closeApp,root,stubDialogs}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
const alternate=process.env.MDLXL_REVIEW_ALTERNATE==='1',evidence=process.env.MDLXL_FX_SHOTS==='1';
const directory=path.join(root,'out',evidence?'visual-effects-shots':alternate?'visual-effects-alternate':'visual-effects-review');
const khorne=testModel('optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx');
const nurgle=testModel('surface-effects/WH_WOC_WarriorNurgle02.mdx');
const footman=testModel('pose/Footman.mdx');
const jobs=alternate?[
 ['Energy streaks',nurgle,19],['Auras',khorne,12],['Ambient',nurgle,19],['Weapons',nurgle,19],
 ['Impacts',footman,0],['Buffs & curses',khorne,17],['Skins',khorne,12],['Terrain',khorne,12],['Model',nurgle,19],
]:[
 ['Energy streaks',khorne,18],['Auras',nurgle,8],['Ambient',khorne,12],
 ['Weapons',khorne,18],['Impacts',khorne,12],['Buffs & curses',nurgle,8],
 ['Skins',khorne,18],['Terrain',nurgle,19],['Model',khorne,12],
];
(async()=>{
 const {SURFACE_EFFECTS}=await import('../src/surface-effects.js');
 const subset=process.env.MDLXL_REVIEW_EFFECTS?.split(',');
 const batch=jobs.filter(([group])=>!subset||SURFACE_EFFECTS.some(e=>e.category===group&&subset.includes(e.id)));
 await fs.mkdir(directory,{recursive:true});
 let current=batch[0][1];
 const {app,page,errors}=await launchApp({out:directory,fixture:current,bounds:{x:-3000,y:0,width:1460,height:940}});
 const dialog=page.getByRole('dialog',{name:'Surface Effects',exact:true});
 const button=name=>dialog.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;const p=mdlxlProbe(el);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const camera=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());
 const frame=()=>page.evaluate(()=>{
   const p=mdlxlProbe('.sfx-stage .game-preview-root'),n=p.runtime.native,base=p.session.doc.model;
   return {frame:n.getFrame(),sequence:n.getSequence(),particles:n.particlesController.emitters.slice(base.ParticleEmitters2.length).map(e=>e.particles.length),
     ribbons:n.ribbonsController.emitters.slice(base.RibbonEmitters.length).map(e=>e.creationTimes.length)};
 });
 async function orbit(box,dx,dy){
  const x=box.x+box.width*.75,y=box.y+box.height*.33;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:6});await page.mouse.up();
  await page.mouse.move(box.x-8,box.y-5);
 }
 try{
  await page.waitForFunction(name=>mdlxlProbe().session?.path?.endsWith(name),path.basename(current));
  for(const [category,file,geoset] of batch){
   if(file!==current){await stubDialogs(app,{open:file});await page.keyboard.press('Control+o');await page.waitForFunction(name=>mdlxlProbe().session.path?.endsWith(name),path.basename(file));current=file;}
   await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
   assert.equal(await button('Moving eye').count()+await button('Classic eye').count(),0,'The two test eyes are retired');
   await button(category).click();await dialog.getByLabel('Geoset',{exact:true}).selectOption(String(geoset));await ready();
   const stage=dialog.locator('.sfx-stage'),box=await stage.boundingBox();
   if(!evidence&&['Energy streaks','Skins','Terrain','Model'].includes(category)){await button('Solo').click();await ready();}
   await button('Fit selection').click();
   if(category==='Auras'||category==='Buffs & curses'){await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,135);}
   if(category==='Weapons'||category==='Impacts'){
    await page.mouse.move(box.x+box.width*.55,box.y+box.height*.46);await page.mouse.wheel(0,200);
   }
   if(category==='Weapons'){
    const attack=await dialog.getByLabel('Preview animation').locator('option').evaluateAll(opts=>opts.find(o=>/^attack/i.test(o.textContent))?.value);
    if(attack)await dialog.getByLabel('Preview animation').selectOption(attack);
   }
   for(const effect of SURFACE_EFFECTS.filter(e=>e.category===category&&(!subset||subset.includes(e.id)))){
    console.log('LOOK',effect.id);await button(effect.name).click();await ready();
    if(effect.cue)await page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p.runtime.native.getSequence()===p.props.sequenceIndex;});
    const before=await camera(),frames=[],dir=path.join(directory,effect.id);await fs.mkdir(dir,{recursive:true});
    for(let i=0;i<3;i++){
     if(i===1)await orbit(box,53,14);
     const previous=await frame();
     await page.waitForFunction(({cue,i,previous})=>{
       const p=mdlxlProbe('.sfx-stage .game-preview-root'),time=p.runtime.native.getFrame(),clip=p.props.model.Sequences[p.runtime.native.getSequence()]?.Interval;
       if(!clip)return false;
       if(!cue)return Math.abs(time-previous.frame)>[170,260,390][i];
       const t=(time-clip[0])/(clip[1]-clip[0]);
       return t>=[.18,.29,.48][i] && t<=[.245,.39,.68][i];
     },{cue:!!effect.cue,i,previous},{timeout:30000});
     frames.push(await frame());await stage.screenshot({path:path.join(dir,i+'.jpg'),type:'jpeg',quality:84});
     if(evidence)await page.screenshot({path:path.join(dir,'workspace-'+i+'.jpg'),type:'jpeg',quality:85});
    }
    if(effect.accents?.some(a=>a.ribbon))assert.ok(frames.some(f=>f.ribbons.every(segments=>segments>0)&&f.ribbons.length),'Every fitted ribbon emits during the swing: '+effect.name);
    const after=await camera();assert.ok(after.some((v,i)=>Math.abs(v-before[i])>.001),'Real camera drag rotates '+effect.name);
    const fields=await dialog.locator('.sfx-controls input[type=range]').evaluateAll(nodes=>nodes.map(n=>({name:n.getAttribute('aria-label'),tip:n.closest('[title]')?.title})));
    assert.ok(fields.every(row=>row.tip),'Every range describes its effect');
    const count=await dialog.locator('.sfx-controls .sfx-colours,.sfx-controls .range-field,.sfx-controls .sfx-place,.sfx-controls select').count();
    assert.ok(count>=2&&count<=4,effect.name+' exposes '+count+' tuning controls');
    await fs.writeFile(path.join(dir,'review.json'),JSON.stringify({id:effect.id,name:effect.name,category,geoset:geoset+1,model:path.basename(file),frames,before,after,fields},null,2));
    await orbit(box,-53,-14);
   }
   await button('Cancel').click();
  }
  assert.deepEqual(errors,[]);
 }catch(e){if(!page.isClosed()){console.error((await page.locator('body').innerText()).slice(-1900));await page.screenshot({path:path.join(directory,'failure.jpg')});}throw e;}
 finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
