const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {root,launchApp,closeApp,stubDialogs}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
const out=path.join(root,'out','visual-effects-save');
const fixture=testModel('surface-effects/WH_WOC_WarriorNurgle02.mdx');
const ready=page=>page.waitForFunction(()=>{
 const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;
 const p=mdlxlProbe(el);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;
});
const model=page=>page.evaluate(()=>JSON.parse(JSON.stringify(mdlxlProbe().session.doc.model,(key,value)=>ArrayBuffer.isView(value)?Array.from(value):value)));
// MDX writes nodes by section. Compare the pivot on its owning node and
// resolve parent and skin IDs to that same identity after the writer reindexes.
function bindings(m){
 const names=new Map();
 for(const family of ['Bones','Helpers','Attachments','Lights','EventObjects','CollisionShapes','ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters']){
  (m[family]||[]).forEach((n,i)=>names.set(n.ObjectId,family+'/'+i+'/'+n.Name));
 }
 const nodes=Array.from(names,([id,key])=>[key,Array.from(m.PivotPoints[id]),names.get(m.Nodes[id].Parent)||null]);
 return {nodes,skins:m.Geosets.map(g=>g.Groups.map(group=>group.map(id=>names.get(id))))};
}
async function saveVariant(page,app,name){
 const file=path.join(out,name+'.mdx');await stubDialogs(app,{save:file});await page.keyboard.press('F12');
 await page.getByRole('button',{name:'Save MDX…',exact:true}).click();await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
 return file;
}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const saved=[],{app,page,errors}=await launchApp({out,fixture,bounds:{x:-3000,y:0,width:1430,height:965}});
 const dialog=page.getByRole('dialog',{name:'Surface Effects',exact:true}),button=name=>dialog.getByRole('button',{name,exact:true});
 try{
  await page.waitForFunction(file=>mdlxlProbe().session?.path?.endsWith(file),path.basename(fixture));
  const original=await model(page);
  for(const name of ['Thunder print','Rime trail']){
   await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready(page);
   await dialog.getByLabel('Geoset',{exact:true}).selectOption('19');await button(name).click();await ready(page);
   if(name==='Rime trail'){
    await button('Position & size').click();await button('Pause').click();
    const upper=dialog.getByRole('slider',{name:'Ribbon upper edge'}),lower=dialog.getByRole('slider',{name:'Ribbon lower edge'});
    const a=await upper.locator('circle').boundingBox(),b=await lower.locator('circle').boundingBox();
    assert.ok(a&&b);const x=a.x+a.width/2,y=a.y+a.height/2,dx=a.x-b.x,dy=a.y-b.y,length=Math.hypot(dx,dy);
    const width=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.RibbonEmitters.at(-1).HeightAbove);
    const before=await width();await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+22*dx/length,y+22*dy/length,{steps:8});await page.mouse.up();await ready(page);
    assert.ok(await width()>before,'Dragging the EMTR upper edge widens the saved trail');
   }
   await button('Apply effect').click();await dialog.waitFor({state:'hidden'});
   const after=await model(page),file=await saveVariant(page,app,name);
   await page.keyboard.press('Control+z');await page.waitForFunction(n=>mdlxlProbe().session.doc.model.Materials.length===n,original.Materials.length);
   assert.deepEqual(await model(page),original,name+' restores the original model in one undo');
   saved.push({name,file,after});console.log('Saved and restored',name);
  }
  assert.deepEqual(errors,[]);
 }finally{await closeApp(app);}
 for(const {file,after,name} of saved){
  const fresh=await launchApp({out,fixture:file,bounds:{x:-3000,y:0,width:1430,height:965}});
  try{
   await fresh.page.waitForFunction(f=>mdlxlProbe().session?.path?.endsWith(f),path.basename(file));
   const reopened=await model(fresh.page);
   assert.deepEqual(reopened.Textures.map(t=>[t.Image,t.Flags,t.ReplaceableId]),after.Textures.map(t=>[t.Image,t.Flags,t.ReplaceableId]));
   assert.deepEqual(bindings(reopened),bindings(after));assert.deepEqual(reopened.GlobalSequences,after.GlobalSequences);
   if(name==='Thunder print'){
    const stamp=reopened.EventObjects.find(e=>e.Name.slice(0,3)==='UBR'&&e.Name.endsWith('THND'));
    assert.ok(stamp?.EventTrack.length);assert.ok(reopened.ParticleEmitters2.some(n=>n.Name===name&&n.Squirt));
   }else{
    const ribbons=reopened.RibbonEmitters.slice(-2),expected=after.RibbonEmitters.slice(-2);
    assert.deepEqual(ribbons.map(r=>r.Name),[name,name+' 2']);
    ribbons.forEach((r,i)=>{assert.equal(r.HeightAbove,Math.fround(expected[i].HeightAbove));assert.deepEqual(r.Rotation,expected[i].Rotation);});
    assert.notDeepEqual(ribbons[0].PivotPoint,ribbons[1].PivotPoint,'The two frost lines follow separate positions along the blade');
   }
   await fresh.page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready(fresh.page);
   await fresh.page.getByRole('dialog',{name:'Surface Effects'}).getByRole('button',{name:'Original',exact:true}).click();await ready(fresh.page);
   assert.deepEqual(fresh.errors,[]);console.log('Reopened in a fresh packaged window',name);
  }finally{await closeApp(fresh.app);}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
