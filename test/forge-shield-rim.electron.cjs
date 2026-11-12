const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
const {assertShieldRim}=require('./helpers/forge-rim.cjs');
function read(){
 const sel='[aria-label="3D model viewport"]',s=findFiberState(sel,s=>s?.renderer&&s?.entries),p=findFiberProps(sel,p=>p?.model&&p?.onTransform),r=s.renderer.domElement.getBoundingClientRect();
 const op=findFiberState('.forge-vertex-tools',s=>s?.kind==='Bevel'&&s?.mold,{current:true}),direction=op?.mold.direction??0;
 const project=point=>{const v=s.camera.position.clone().fromArray(point).project(s.camera);return{x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};};
 return {geosets:p.model.Geosets.map(g=>({vertices:Array.from(g.Vertices),faces:Array.from(g.Faces)})),selection:p.selectionByGeoset,quaternion:s.camera.quaternion.toArray(),target:s.controls.target.toArray(),amount:op?.mold.amount||0,handles:(p.editHandles?.points||[]).map(h=>({...h,...project(h.position),end:project(h.position.map((n,i)=>n+(i===direction?5:0)))}))};
}
(async()=>{
 const {openDocument}=await import('../src/editor-document.js'),{detachFaces}=await import('../src/mesh-tools.js');
 const doc=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx'),out=path.resolve('out/shield-rim');fs.mkdirSync(out,{recursive:true});
 doc.apply('Separate shield plate',['Geosets','GeosetAnims','Bones','Info'],m=>detachFaces(m,0,Array.from({length:14},(_,i)=>253+i)));
 const fixture=path.join(out,'plate-fixture.mdx');fs.writeFileSync(fixture,doc.serialize('mdx'));
 const {app,page}=await launchApp({fixture,out:path.join(out,'interaction'),pageTimeout:10000});
 try{
  await page.waitForFunction(()=>findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries)?.entries.length>0);
  const view=page.getByLabel('3D model viewport',{exact:true});
  await page.getByRole('button',{name:'Forge',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Call Upon Forge',exact:true}).click();
  const drawer=page.getByRole('complementary',{name:'Forge tools',exact:true});await drawer.waitFor();
  await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 5',{exact:true}).check();await page.getByLabel('Show all geosets',{exact:true}).uncheck();
  await drawer.getByRole('button',{name:'Vertices',exact:true}).click();await view.click();await page.keyboard.press('Control+a');
  let before=await page.evaluate(read);assert.equal(before.selection[5].length,14);
  await page.getByLabel('View direction',{exact:true}).selectOption('left');await page.getByRole('button',{name:'Fit selection',exact:true}).click();
  await page.waitForFunction(t=>JSON.stringify(findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries).controls.target.toArray())!==JSON.stringify(t),before.target);
  await page.getByLabel('Render mode',{exact:true}).selectOption('solid');
  before=await page.evaluate(read);const box=await view.boundingBox();
  await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+10,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
  assert.notDeepEqual((await page.evaluate(read)).quaternion,before.quaternion,'normal mouse rotation');before=await page.evaluate(read);
  await drawer.getByRole('button',{name:'Bevel',exact:true}).click();
  await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles?.points.length);
  const h=(await page.evaluate(read)).handles.find(h=>h.id==='amount'),dx=h.end.x-h.x,dy=h.end.y-h.y,len=Math.hypot(dx,dy);
  await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x+dx/len*28,h.y+dy/len*28,{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>findFiberState('.forge-vertex-tools',s=>s?.kind==='Bevel'&&s?.mold,{current:true})?.mold.amount>0);
  const angled=await page.evaluate(read);assert.equal(await drawer.getByRole('alert').count(),0);
  assertShieldRim(before.geosets[5],angled.geosets[5]);assert.equal(angled.geosets[5].faces.length/3,19);
  assert.deepEqual(angled.geosets.slice(0,5),before.geosets.slice(0,5));
  await page.screenshot({path:path.join(out,'shield-rim-angled.png')});
  await drawer.getByRole('button',{name:'Angled',exact:true}).click();
  await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.model.Geosets[5].Faces.length/3===61);
  const rounded=await page.evaluate(read);assertShieldRim(before.geosets[5],rounded.geosets[5]);
  assert.deepEqual(rounded.geosets.slice(0,5),before.geosets.slice(0,5));
  await page.screenshot({path:path.join(out,'shield-rim-rounded.png')});
  await drawer.getByRole('button',{name:'Keep shaping',exact:true}).click();
  await page.waitForFunction(()=>!findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles);
  assert.deepEqual((await page.evaluate(read)).geosets,rounded.geosets);
  await page.keyboard.press('Control+z');
  await page.waitForFunction(v=>JSON.stringify(Array.from(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[5].Vertices))===JSON.stringify(v),before.geosets[5].vertices);
  await page.keyboard.press('Control+y');
  await page.waitForFunction(v=>JSON.stringify(Array.from(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[5].Vertices))===JSON.stringify(v),rounded.geosets[5].vertices);
  console.log('PASS real shield plate: seven intact edges, angled 19 triangles / rounded 61, live drag, normal rotation, Commit / Undo / Redo, unrelated model unchanged.');
 }finally{await closeApp(app);fs.unlinkSync(fixture);}
})().catch(e=>{console.error(e);process.exitCode=1;});
