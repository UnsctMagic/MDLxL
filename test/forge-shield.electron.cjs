const assert=require('node:assert/strict'),path=require('node:path');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
const shield=[...Array.from({length:7},(_,i)=>225+i),...Array.from({length:14},(_,i)=>253+i),...Array.from({length:10},(_,i)=>425+i)];
function read(){
  const selector='[aria-label="3D model viewport"]',s=findFiberState(selector,s=>s?.renderer&&s?.entries),p=findFiberProps(selector,p=>p?.model&&p?.onTransform),r=s.renderer.domElement.getBoundingClientRect();
  const project=point=>{const v=s.camera.position.clone().fromArray(point).project(s.camera);return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};};
  return {vertices:p.model.Geosets.map(g=>Array.from(g.Vertices)),selection:p.selectionByGeoset,handles:(p.editHandles?.points||[]).map(h=>({...h,...project(h.position)}))};
}
(async()=>{
  const {app,page}=await launchApp({fixture:fixturePath('citadel-footman'),out:path.resolve('out/shield-polish/interaction'),pageTimeout:5000});
  try{
    const view=page.getByLabel('3D model viewport',{exact:true}),forge=page.getByRole('button',{name:'Forge',exact:true}),menu=page.getByRole('menu',{name:'Forge',exact:true}),learn=page.getByRole('menu',{name:'Learn',exact:true});
    await page.waitForFunction(()=>findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries)?.entries.length>0);
    const menuStyle=element=>{const m=getComputedStyle(element),b=getComputedStyle(element.querySelector('button'));return [m.backgroundImage,m.backgroundColor,m.borderRadius,m.boxShadow,b.font,b.minHeight];};
    await page.getByRole('button',{name:'Learn',exact:true}).click({button:'right'});await learn.waitFor();const style=await learn.evaluate(menuStyle);
    await forge.click({button:'right'});await menu.waitFor();
    assert.deepEqual(await menu.evaluate(menuStyle),style,'Forge reuses the LER menu styling');
    await learn.waitFor({state:'hidden'});
    const trigger=await forge.boundingBox(),popup=await menu.boundingBox();
    assert.ok(Math.abs(popup.y-trigger.y-trigger.height-6)<2,'menu anchors below its icon');
    assert.ok(Math.abs(popup.x+popup.width-trigger.x-trigger.width)<2,'menu aligns with the icon');
    await forge.click({button:'right'});await menu.waitFor({state:'hidden'});
    await forge.click({button:'right'});await menu.waitFor();await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    await forge.click({button:'right'});await menu.getByRole('menuitem',{name:'Call Upon Forge',exact:true}).click();
    const drawer=page.getByRole('complementary',{name:'Forge tools',exact:true});await drawer.waitFor();
    console.log('PASS shared LER menu appearance, placement, mutual exclusion, toggle and Escape.');
    await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 0',{exact:true}).check();
    await page.getByLabel('View direction',{exact:true}).selectOption('front');
    await drawer.getByRole('button',{name:'Vertices',exact:true}).click();
    await page.waitForFunction(()=>findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries)?.appliedView==='front');
    const projectTargets=()=>page.evaluate(ids=>{
      const s=findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries),r=s.renderer.domElement.getBoundingClientRect(),g=s.entries[0].geoset;
      return ids.map(id=>{const v=s.camera.position.clone().fromArray(g.Vertices,id*3).project(s.camera);return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};}).filter((p,i,all)=>all.findIndex(q=>Math.hypot(p.x-q.x,p.y-q.y)<.01)===i);
    },shield);
    const selectTargets=async()=>{for(const [i,p] of (await projectTargets()).entries()){
      if(i)await page.keyboard.down('Shift');
      await page.mouse.move(p.x-3,p.y-3);await page.mouse.down();await page.mouse.move(p.x+3,p.y+3,{steps:2});await page.mouse.up();
      if(i)await page.keyboard.up('Shift');
    }};
    await selectTargets();
    // Like a user, frame the coarse selection and turn the view to separate
    // the shield strap from forearm vertices that overlap in the front view.
    const target=await page.evaluate(()=>findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries).controls.target.toArray());
    await page.getByRole('button',{name:'Fit selection',exact:true}).click();
    await page.waitForFunction(t=>JSON.stringify(findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries).controls.target.toArray())!==JSON.stringify(t),target);
    const box=await view.boundingBox();await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+50,box.y+box.height/2+20,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
    await selectTargets();
    assert.deepEqual((await page.evaluate(read)).selection[0].sort((a,b)=>a-b),shield,'select the recorded shield through the viewport');
    await page.getByLabel('Render mode',{exact:true}).selectOption('solid');
    const before=await page.evaluate(read);
    await drawer.getByRole('button',{name:'Bevel',exact:true}).click();
    await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles?.points.length);
    const h=(await page.evaluate(read)).handles.find(h=>h.id==='amount');
    await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x,h.y+20,{steps:8});await page.mouse.up();
    await page.waitForFunction(v=>JSON.stringify(Array.from(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[0].Vertices))!==JSON.stringify(v),before.vertices[0]);
    assert.equal(await drawer.getByRole('alert').count(),0);
    assert.ok(await page.evaluate(()=>findFiberState('.forge-vertex-tools',s=>s?.kind==='Bevel'&&s?.mold,{current:true}).mold.amount<0),'the tested drag moved inward');
    const angled=await page.evaluate(read);assert.deepEqual(angled.vertices.slice(1),before.vertices.slice(1));
    await drawer.getByRole('button',{name:'Angled',exact:true}).click();
    await page.waitForFunction(n=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[0].Vertices.length>n,angled.vertices[0].length);
    const preview=await page.evaluate(read);assert.deepEqual(preview.vertices.slice(1),before.vertices.slice(1));
    await page.screenshot({path:path.resolve('out/shield-polish/footman-shield-bevel.png')});
    await drawer.getByRole('button',{name:'Keep shaping',exact:true}).click();
    await page.waitForFunction(()=>!findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles);
    assert.deepEqual((await page.evaluate(read)).vertices,preview.vertices);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(v=>JSON.stringify(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets.map(g=>Array.from(g.Vertices)))===JSON.stringify(v),before.vertices);
    console.log('PASS inward drag bevels the recorded Footman shield, angled and rounded, inside the full model; Commit and Undo preserve the rest.');
  }catch(error){console.error(await page.evaluate(()=>({selection:findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.selectionByGeoset,error:document.querySelector('.forge-vertex-tools [role="alert"]')?.textContent})));throw error;}
  finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
