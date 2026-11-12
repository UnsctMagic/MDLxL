const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
// Locate the visible gold handle from screenshot pixels, not React handle data.
async function gold(page,view){
 const box=await view.boundingBox(),png=await view.screenshot();
 const p=await page.evaluate(async data=>{
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
  const {data:d,width,height}=ctx.getImageData(0,0,canvas.width,canvas.height),points=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(d[i]===255&&d[i+1]===209&&d[i+2]===102)points.push([x,y]);}
  return points.length?{x:points.reduce((n,p)=>n+p[0],0)/points.length,y:points.reduce((n,p)=>n+p[1],0)/points.length,width,height}:null;
 },png.toString('base64'));
 assert.ok(p,'gold handle is visible in the viewport screenshot');
 return {x:box.x+p.x*box.width/p.width,y:box.y+p.y*box.height/p.height};
}
function read(){const p=findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform),s=findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries);return{model:JSON.stringify(p.model),faces:p.model.Geosets[5].Faces.length/3,quaternion:s.camera.quaternion.toArray(),selection:p.selectionByGeoset};}
(async()=>{
 const {openDocument}=await import('../src/editor-document.js'),{detachFaces}=await import('../src/mesh-tools.js');
 const out=path.resolve('out/shield-controls');fs.mkdirSync(out,{recursive:true});
 const doc=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx');
 detachFaces(doc.model,0,Array.from({length:14},(_,i)=>253+i));
 const fixture=path.join(out,'shield.mdx');fs.writeFileSync(fixture,doc.serialize('mdx'));
 const {app,page,errors}=await launchApp({fixture,out:path.join(out,'interaction')});
 try{
  const view=page.getByLabel('3D model viewport',{exact:true});await view.waitFor();
  await page.getByRole('button',{name:'Forge',exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'Call Upon Forge',exact:true}).click();
  const drawer=page.getByRole('complementary',{name:'Forge tools',exact:true});
  await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 5',{exact:true}).check();await page.getByLabel('Show all geosets',{exact:true}).uncheck();
  const select=async()=>{await drawer.getByRole('button',{name:'Vertices',exact:true}).click();await view.click({position:{x:50,y:150}});await page.keyboard.press('Control+a');};
  await select();await page.getByLabel('View direction',{exact:true}).selectOption('left');await page.getByRole('button',{name:'Fit selection',exact:true}).click();await page.getByLabel('Render mode',{exact:true}).selectOption('solid');
  const original=await page.evaluate(read);assert.equal(original.selection[5].length,14);
  const drag=async dy=>{const start=await gold(page,view);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x,start.y+dy,{steps:12});await page.mouse.up();const end=await gold(page,view);return{start,end,error:Math.hypot(end.x-start.x,end.y-start.y-dy)};};
  await drawer.getByRole('button',{name:'Inset',exact:true}).click();
  const first=await drag(20),messages=await drawer.getByRole('alert').allTextContents();
  await page.screenshot({path:path.join(out,'inset-first-drag.png')});
  assert.deepEqual({handleFollowsMouse:first.error<3,errors:messages},{handleFollowsMouse:true,errors:[]},JSON.stringify({first,messages}));
  const drags=[first];
  for(const dy of [15,-10,-40,20]){const move=await drag(dy);drags.push(move);assert.ok(move.error<3,'repeated/reversed drag stays within 3 px of the mouse: '+JSON.stringify(move));assert.equal(await drawer.getByRole('alert').count(),0);}
  assert.equal((await page.evaluate(read)).faces,19,'Inset adds a visible continuous border');
  await drawer.getByRole('button',{name:'Commit inset',exact:true}).click();const inset=await page.evaluate(read);await page.keyboard.press('Control+z');await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[5].Faces.length/3===5);assert.equal((await page.evaluate(read)).model,original.model);
  await page.keyboard.press('Control+y');await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[5].Faces.length/3===19);assert.equal((await page.evaluate(read)).model,inset.model);await page.keyboard.press('Control+z');
  await select();await drawer.getByRole('button',{name:'Inset',exact:true}).click();assert.ok((await drag(20)).error<3);assert.equal(await drawer.getByRole('alert').count(),0);await page.keyboard.press('Escape');assert.equal((await page.evaluate(read)).model,original.model);
  // An excessive inset can be backed off through the same handle, then cancelled.
  await drawer.getByRole('button',{name:'Inset',exact:true}).click();assert.ok((await drag(190)).error<3);assert.match(await drawer.getByRole('alert').innerText(),/too wide/);assert.ok((await drag(-170)).error<3);assert.equal(await drawer.getByRole('alert').count(),0);await page.keyboard.press('Escape');
  const box=await view.boundingBox(),camera=(await page.evaluate(read)).quaternion;
  await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+10,{steps:10});await page.mouse.up();await page.keyboard.up('Alt');assert.notDeepEqual((await page.evaluate(read)).quaternion,camera);
  await page.mouse.wheel(0,100);await drawer.getByRole('button',{name:'Bevel',exact:true}).click();
  // With the mildly rotated camera, the visible handle axis is close to vertical.
  const start=await gold(page,view);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x,start.y+28,{steps:12});await page.mouse.up();
  assert.equal(await drawer.getByRole('alert').count(),0);assert.equal((await page.evaluate(read)).faces,19);await page.screenshot({path:path.join(out,'bevel-angled.png')});
  await drawer.getByRole('button',{name:'Angled',exact:true}).click();await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[5].Faces.length/3===61);await page.screenshot({path:path.join(out,'bevel-rounded.png')});
  await drawer.getByRole('button',{name:'Keep shaping',exact:true}).click();await page.keyboard.press('Control+z');await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[5].Faces.length/3===5);assert.equal((await page.evaluate(read)).model,original.model);assert.deepEqual(errors,[]);
  console.log('PASS screenshot-located shield handles: repeated/reversed drags, Inset, reselect, oversized-inset recovery, Cancel, Commit, Undo/Redo, mouse rotation/zoom, Angled/Rounded Bevel. Maximum cursor error: '+Math.max(...drags.map(d=>d.error)).toFixed(3)+' px.');
 }finally{await closeApp(app);fs.unlinkSync(fixture);}
})().catch(e=>{console.error(e);process.exitCode=1;});
