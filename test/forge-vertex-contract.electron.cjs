const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
function read(){
 const p=findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform),s=findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries);
 const op=findFiberState('.forge-vertex-tools',s=>s?.kind&&s?.draft,{current:true});
 return {selection:p.selectionByGeoset,vertices:p.model.Geosets.map(g=>Array.from(g.Vertices)),operation:op?.kind,turned:op?.turned};
}
(async()=>{
 const out=path.resolve('out/contract-review/interaction');fs.mkdirSync(out,{recursive:true});
 const {openDocument}=await import('../src/editor-document.js'),{detachFaces}=await import('../src/mesh-tools.js');
 const doc=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx');detachFaces(doc.model,0,Array.from({length:14},(_,i)=>253+i));
 const fixture=path.join(out,'shield.mdx');fs.writeFileSync(fixture,doc.serialize('mdx'));
 const {app,page,errors}=await launchApp({fixture,out}),failures=[];
 try{
  const view=page.getByLabel('3D model viewport',{exact:true});await view.waitFor();
  await page.getByRole('button',{name:'Forge',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Call Upon Forge',exact:true}).click();
  const drawer=page.getByRole('complementary',{name:'Forge tools',exact:true});
  await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 5',{exact:true}).check();
  await view.click({position:{x:50,y:150}});await page.keyboard.press('Control+a');
  await page.getByLabel('Select geoset 0',{exact:true}).check();await page.getByLabel('View direction',{exact:true}).selectOption('left');
  const point=await page.evaluate(()=>{
   const s=findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries),g=s.entries[0].geoset,b=s.renderer.domElement.getBoundingClientRect();
   return Array.from({length:g.Vertices.length/3},(_,id)=>{const p=s.camera.position.clone().fromArray(g.Vertices,id*3).project(s.camera);return{id,x:b.x+(p.x+1)*b.width/2,y:b.y+(1-p.y)*b.height/2};}).filter(p=>p.y>b.y+75&&p.y<b.bottom-20&&p.x>b.x+10&&p.x<b.right-10).sort((a,b)=>a.y-b.y)[0];
  });
  await page.keyboard.down('Shift');await page.mouse.click(point.x,point.y);await page.keyboard.up('Shift');
  const original=await page.evaluate(read);assert.ok(original.selection[0]?.length>0&&original.selection[0].length<3);assert.equal(original.selection[5].length,14);
  await drawer.getByRole('button',{name:'Cut',exact:true}).click();assert.equal(await drawer.getByRole('alert').count(),0);
  await drawer.getByRole('button',{name:'Commit cut',exact:true}).click();
  const committed=await page.evaluate(read);
  if(JSON.stringify(committed.selection[0])!==JSON.stringify(original.selection[0]))failures.push('Commit lost the untouched body selection');
  await page.keyboard.press('Control+z');
  await drawer.getByRole('button',{name:'Cut',exact:true}).click();
  await page.getByRole('menuitem',{name:'Help',exact:true}).click();await page.getByRole('menuitem',{name:'About',exact:true}).hover();await page.keyboard.press('Enter');
  const about=page.getByRole('dialog',{name:'About MDLxL',exact:true});await about.waitFor();assert.equal((await page.evaluate(read)).operation,'Cut','Enter in a menu does not commit the underlying operation');
  await about.locator('p').first().click();
  const onClose=()=>page.evaluate(()=>document.activeElement?.closest('[aria-label="About MDLxL"]')&&document.activeElement.matches('button[data-hotkey="close"],footer button'));
  for(let n=0;n<8&&!await onClose();n++)await page.keyboard.press('Tab');
  assert.ok(await onClose(),'Tab reached the dialog Close button');
  await page.keyboard.press('Enter');await about.waitFor({state:'detached'});assert.equal((await page.evaluate(read)).operation,'Cut','Enter in a dialog does not commit the underlying operation');
  await drawer.getByRole('button',{name:'Turn cuts',exact:true}).click();await page.keyboard.press('Enter');
  const turned=await page.evaluate(read);
  if(turned.operation!=='Cut'||turned.turned!==false)failures.push('Enter on Turn cuts committed instead of activating the button');
  if(turned.operation==='Cut'){
   await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Cancel cut');await page.keyboard.press('Enter');
   assert.deepEqual((await page.evaluate(read)).vertices,original.vertices,'Enter on Cancel discards, never commits');
   await drawer.getByRole('button',{name:'Cut',exact:true}).click();await view.click({position:{x:50,y:150}});await page.keyboard.press('Enter');
   assert.equal((await page.evaluate(read)).operation,undefined,'Enter in the viewport still commits');
  }
  console.log(JSON.stringify({failures}));await page.screenshot({path:path.join(out,'contract.png')});assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log('PASS: other-geoset selection survives Commit; focused buttons own Enter; viewport Enter commits.');
 }finally{await closeApp(app);fs.unlinkSync(fixture);}
})().catch(e=>{console.error(e);process.exitCode=1;});
