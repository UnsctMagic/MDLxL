// Production Electron bundle; all edits use UI input. React/camera reads are
// assertions only. The test window stays hidden and uses its own D: profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TEST_OUT||path.join(root,'out/forge-detail');
const old=fs.readFileSync(path.join(root,'test/forge-face-editing.electron.cjs'),'utf8');eval(old.slice(old.indexOf('function readView'),old.indexOf('(async()=>{')));
function readForge(){
 const el=document.querySelector('.forge-dialog .forge-editor');let draft,cut,repeat;
 for(let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState;if(v?.shapes&&v?.mode)draft=structuredClone(v);if(v?.frames&&v?.positions&&v?.base)cut=structuredClone(v);if(v?.source&&v?.ids&&v?.offset)repeat=structuredClone(v);}
 const viewport=el.querySelector('[aria-label="3D model viewport"]');let projection;
 for(let f=viewport[Object.keys(viewport).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState?.current;if(v?.renderer&&v?.entries)projection={world:v.camera.matrixWorldInverse.toArray(),projection:v.camera.projectionMatrix.toArray()};}
 return {draft,cut,repeat,projection};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {createStarterDocument}=await import('../src/starter-model.js'),{forgeFaceNormal}=await import('../src/forge-shape-editing.js'),{Vector3,Matrix4}=await import('three');
 const fixture=path.join(out,'fixture.mdl');fs.writeFileSync(fixture,createStarterDocument().serialize('mdl'));const initialBytes=fs.readFileSync(fixture);
 const app=await _electron.launch({executablePath:require('electron'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});let page;const errors=[],checks=[];
 try{
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setBounds({x:0,y:0,width:1500,height:950});});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  await page.getByLabel('3D model viewport',{exact:true}).waitFor();const main=(await page.evaluate(readView,'.classic-view')).model;
  await page.getByRole('button',{name:'Forge',exact:true}).click();const d=page.getByRole('dialog',{name:'Forge',exact:true});
  await d.locator('.forge-editor').waitFor();
  const settle=()=>page.waitForTimeout(100),click=async name=>{await d.getByRole('button',{name,exact:true}).click({force:true});await settle();},doc=async()=>(await page.evaluate(readForge)).draft,view=()=>page.evaluate(readView);
  const fill=async(label,value)=>{const el=d.getByLabel(label,{exact:true});await el.fill(String(value));await el.press('Tab');await settle();};
  const center=(shape,face)=>[0,1,2].map(a=>face.vertices.reduce((n,id)=>n+shape.vertices[id][a],0)/face.vertices.length);
  const normal=(shape,axis,sign=1)=>shape.faces.filter(f=>forgeFaceNormal(shape,f)[axis]*sign>.999);
  async function project(point){const {projection}=await page.evaluate(readForge),v=await view(),p=new Vector3(...point).applyMatrix4(new Matrix4().fromArray(projection.world)).applyMatrix4(new Matrix4().fromArray(projection.projection));return {x:v.rect.x+(p.x+1)*v.rect.width/2,y:v.rect.y+(1-p.y)*v.rect.height/2};}
  async function pickFace(shape,face){const p=await project(center(shape,face));await page.mouse.dblclick(p.x,p.y,{delay:80});await settle();assert.equal((await doc()).mode,'Faces');return p;}
  async function dragWorld(point,delta,live){const a=await project(point),tip=await project(point.map((v,i)=>v+delta[i]/(Math.hypot(...delta)||1))),length=Math.hypot(...delta);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+(tip.x-a.x)*length,a.y+(tip.y-a.y)*length,{steps:8});await settle();if(live)await live();await page.mouse.up();await settle();}
  async function capture(name){const bytes=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}).then(i=>i.toPNG().toString('base64')));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(bytes,'base64'));}
  async function fresh(width=300,height=100,depth=40){if((await doc()).shapes.length){await click('Cancel');await page.getByRole('button',{name:'Forge',exact:true}).click();await d.locator('.forge-editor').waitFor();}await fill('Width',width);await fill('Height',height);await fill('Depth',depth);await click('Cube');return (await doc()).shapes[0];}
  let shape=await fresh(),sidebar=await d.locator('.forge-editor-sidebar').boundingBox();
  assert.equal(await d.getByRole('group',{name:'Repeat detail controls',exact:true}).count(),0);
  for(const name of ['Mirror','Blend']){const tool=d.getByRole('button',{name,exact:true}),box=await tool.boundingBox();assert.ok(box.width<=32&&box.x>=sidebar.x&&box.x+box.width<=sidebar.x+sidebar.width);assert.ok((await tool.getAttribute('title')).length>50);}
  checks.push('Mirror and Blend are compact tooltiped controls in the existing sidebar; no permanent panel or wider sidebar');
  await pickFace(shape,normal(shape,2)[0]);await click('Cut');await click('Apply cuts');shape=(await doc()).shapes[0];
  const strip=normal(shape,2).sort((a,b)=>center(shape,a)[0]-center(shape,b)[0])[0];await pickFace(shape,strip);await click('Extrude');await dragWorld(center(shape,strip),[0,0,20]);
  let raised=await doc();assert.equal(raised.shapes[0].details.length,1);assert.equal(raised.selection[1].length,1);assert.ok(Math.abs(Math.max(...raised.shapes[0].vertices.map(p=>p[2]))-120)<1e-4);
  await click('Mirror');assert.equal(await d.getByRole('group',{name:'Repeat detail controls',exact:true}).count(),1);await click('Mirror X');assert.deepEqual(await doc(),raised);assert.equal(await d.getByRole('button',{name:'Apply detail',exact:true}).isEnabled(),true);
  const preview=await view();assert.ok(preview.model.Geosets[0].Faces.length>raised.shapes[0].faces.reduce((n,f)=>n+f.triangles.length*3,0));
  const camera=preview.quaternion;await page.keyboard.down('Alt');await page.mouse.move(600,450);await page.mouse.down();await page.mouse.move(645,470,{steps:6});await page.mouse.up();await page.keyboard.up('Alt');await settle();assert.notDeepEqual((await view()).quaternion,camera);assert.deepEqual(await doc(),raised);
  await click('Apply detail');let mirrored=await doc();assert.equal(mirrored.shapes.length,1);assert.ok(mirrored.selection[1].length>=5);assert.equal((await d.locator('.forge-editor-sidebar').boundingBox()).width,sidebar.width);
  await capture('mirrored-detail');await click('Undo');assert.deepEqual(await doc(),raised);await click('Redo');assert.deepEqual(await doc(),mirrored);await click('Undo');
  console.log('mirror apply and history passed');await click('Mirror');await page.keyboard.press('Escape');await settle();assert.deepEqual(await doc(),raised);assert.equal(await d.getByRole('group',{name:'Repeat detail controls',exact:true}).count(),0);
  await click('Mirror');await d.getByLabel('Mirror plane',{exact:true}).focus();await page.keyboard.press('Escape');await settle();assert.deepEqual(await doc(),raised);assert.equal(await d.getByRole('group',{name:'Repeat detail controls',exact:true}).count(),0);
  await click('Mirror');await page.keyboard.press('Control+z');await settle();assert.deepEqual(await doc(),raised);assert.equal(await d.getByRole('group',{name:'Repeat detail controls',exact:true}).count(),0);
  checks.push('Marking only an extrusion end mirrors its complete detail onto the same shape; preview, Apply, exact Undo/Redo, Escape and Ctrl+Z cancellation work');
  checks.push('Actual Alt+mouse rotation works during the detail preview and never changes the draft');
  console.log('preview cancellation and rotation passed');
  // Reference cuts on the top snap a later front-panel cut to exactly the same X.
  await click('Undo');shape=(await doc()).shapes[0];const front=normal(shape,1,-1)[0];await pickFace(shape,front);await click('Cut');await click('Place cuts');
  const aim=await project([-74.1,-20,50]);await page.mouse.move(aim.x,aim.y);await settle();const cut=(await page.evaluate(readForge)).cut;
  assert.equal(cut.hover.snapped,true);assert.ok(Math.abs(cut.frames[1].min+(cut.frames[1].max-cut.frames[1].min)*cut.hover.fraction+75)<1e-5);assert.match(await d.getByRole('status').innerText(),/Snap: existing cut/);
  await page.mouse.click(aim.x,aim.y);await page.mouse.move(20,80);await click('Apply cuts');shape=(await doc()).shapes[0];assert.equal(normal(shape,1,-1).length,2);
  checks.push('A cut placed near a top-panel reference snaps exactly to it on the front panel');
  console.log('cut snapping passed');
  const tops=normal(shape,2).sort((a,b)=>center(shape,a)[0]-center(shape,b)[0]);await pickFace(shape,tops[0]);await click('Extrude');await dragWorld(center(shape,tops[0]),[0,0,20]);shape=(await doc()).shapes[0];
  const other=normal(shape,2).find(f=>center(shape,f)[0]>0&&center(shape,f)[2]<110);await pickFace(shape,other);await click('Extrude');await dragWorld(center(shape,other),[0,0,20.4],async()=>assert.match(await d.getByRole('status').innerText(),/Snap: matching extrusion/));
  shape=(await doc()).shapes[0];assert.ok(Math.abs(center(shape,shape.faces.find(f=>f.id===other.id))[2]-120)<1e-4);
  const side=normal(shape,1,-1)[0];await pickFace(shape,side);await click('Extrude');await dragWorld(center(shape,side),[0,-20.3,0],async()=>assert.match(await d.getByRole('status').innerText(),/Snap: matching extrusion/));
  shape=(await doc()).shapes[0];assert.ok(Math.abs(center(shape,shape.faces.find(f=>f.id===side.id))[1]+40)<1e-4);
  checks.push('Extrusion drags snap to existing heights and reuse an extrusion depth on a perpendicular panel');
  console.log('extrusion snapping passed');
  // Copy a short raised band down a vertical panel without copying the cube.
  shape=await fresh(120,150,40);await pickFace(shape,normal(shape,1,-1)[0]);await click('Cut');await click('Apply cuts');shape=(await doc()).shapes[0];
  const upper=normal(shape,1,-1).sort((a,b)=>center(shape,b)[2]-center(shape,a)[2])[0];await pickFace(shape,upper);await click('Inset');shape=(await doc()).shapes[0];const cap=shape.faces.find(f=>f.id===upper.id);await click('Extrude');await dragWorld(center(shape,cap),[0,-10,0]);const original=await doc();
  await click('Copy');await click('Paste');assert.equal(await d.getByRole('group',{name:'Repeat detail controls',exact:true}).count(),1);const offset=d.getByLabel('Copy Z offset',{exact:true});await offset.fill('');await offset.pressSequentially('-60');await offset.press('Tab');await settle();assert.equal(await offset.inputValue(),'-60');assert.equal(await d.getByRole('button',{name:'Apply detail',exact:true}).isEnabled(),true);assert.deepEqual(await doc(),original);
  await dragWorld(center(original.shapes[0],original.shapes[0].faces.find(f=>f.id===upper.id)),[0,0,-5]);assert.ok(Math.abs(Number(await d.getByLabel('Copy Z offset',{exact:true}).inputValue())+65)<.1);assert.ok(Math.abs(Number(await d.getByLabel('Copy X offset',{exact:true}).inputValue()))<2e-5);
  assert.equal(await d.getByRole('button',{name:'Apply detail',exact:true}).isEnabled(),true);await click('Apply detail');const copied=await doc();assert.equal(copied.shapes.length,1);assert.ok(copied.selection[1].length>4);await click('Undo');assert.deepEqual(await doc(),original);await click('Redo');assert.deepEqual(await doc(),copied);await click('Undo');
  await click('Duplicate');assert.equal(await d.getByRole('group',{name:'Repeat detail controls',exact:true}).count(),1);await click('Cancel detail');assert.deepEqual(await doc(),original);
  checks.push('Copy/Paste and Duplicate repeat a multistep detail on the same shape; numeric placement and surface dragging can place it lower at identical size; Undo/Redo preserves the original');
  console.log('copy lower passed');
  shape=await fresh();await pickFace(shape,normal(shape,2)[0]);await click('Cut');await click('Apply cuts');let divided=await doc();const sideFaces=divided.shapes[0].faces.filter(f=>forgeFaceNormal(divided.shapes[0],f)[2]<.999);
  assert.equal(divided.selection[1].length,4);await click('Blend');let blended=await doc();assert.equal(normal(blended.shapes[0],2).length,1);assert.deepEqual(blended.shapes[0].faces.filter(f=>!blended.selection[1].includes(f.id)),sideFaces);
  await click('Undo');assert.deepEqual(await doc(),divided);await click('Redo');assert.deepEqual(await doc(),blended);
  shape=blended.shapes[0];await click('Extrude');await dragWorld(center(shape,normal(shape,2)[0]),[0,0,15]);let extended=await doc();assert.equal(extended.shapes[0].faces.length,blended.shapes[0].faces.length+4);await capture('blended-top');
  checks.push('Blend removes selected top divisions while keeping all side planes separate; the blended surface extrudes with only four perimeter walls and one Undo/Redo step');
  await click('Add to model');await d.waitFor({state:'hidden'});const added=(await page.evaluate(readView,'.classic-view')).model;assert.deepEqual(added.Geosets.slice(0,main.Geosets.length),main.Geosets);assert.equal(added.Geosets.length,main.Geosets.length+1);await page.keyboard.press('Control+z');await settle();assert.deepEqual((await page.evaluate(readView,'.classic-view')).model.Geosets,main.Geosets);
  assert.deepEqual(fs.readFileSync(fixture),initialBytes);assert.deepEqual(errors,[]);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  checks.push('Add to model remains atomic, preserves the existing model, and does not change the input file; no renderer errors; window stayed hidden');
  const result={pass:true,checks,rendererErrors:errors};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }catch(e){if(page){try{fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await page.evaluate(readForge),null,2));console.error(await page.locator('.forge-editor-status').innerText());}catch{}}throw e;}finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
