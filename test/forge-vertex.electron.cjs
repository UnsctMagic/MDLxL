const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
function read() {
  const selector='[aria-label="3D model viewport"]', s=findFiberState(selector,s=>s?.renderer&&s?.entries), p=findFiberProps(selector,p=>p?.model&&p?.onTransform);
  const r=s.renderer.domElement.getBoundingClientRect(),operation=findFiberState('.forge-vertex-tools',s=>s?.kind&&s?.draft,{current:true}),direction=operation?.mold?.direction??operation?.handle?.direction??0;
  const project=point=>{const v=s.camera.position.clone().fromArray(point).project(s.camera);return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};};
  return {vertices:p.model.Geosets.map(g=>Array.from(g.Vertices)),faces:p.model.Geosets.map(g=>Array.from(g.Faces)),buffers:s.entries.map(e=>e.geometry.uuid),camera:s.camera.position.toArray(),target:s.controls.target.toArray(),quaternion:s.camera.quaternion.toArray(),selection:p.selectionByGeoset,
    handles:(p.editHandles?.points||[]).map(h=>({...h,...project(h.position),end:project(h.position.map((n,i)=>n+(i===direction?10:0)))})),
    props:p.editHandles?true:false};
}
(async () => {
  const { app, page } = await launchApp({ fixture: fixturePath('citadel-footman'), out: path.resolve('out/forge-vertex'), show: 'inactive', pageTimeout: 5000 });
  try {
    const view = page.getByLabel('3D model viewport', { exact: true });
    await page.waitForFunction(() => findFiberState('[aria-label="3D model viewport"]', s => s?.renderer && s?.entries)?.entries?.length > 0);
    const cameraBefore=await page.evaluate(read);
    const original = await page.evaluate(() => findFiberState('[aria-label="3D model viewport"]', s => s?.renderer && s?.entries).entries.map(e => Array.from(e.geoset.Vertices)));
    await page.getByRole('button', { name: 'Forge', exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Call Upon Forge', exact: true }).click();
    await page.getByRole('complementary', { name: 'Forge tools', exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Forge', exact: true }).count(), 0);
    assert.equal(await view.count(), 1);
    assert.deepEqual(await page.evaluate(() => findFiberState('[aria-label="3D model viewport"]', s => s?.renderer && s?.entries).entries.map(e => Array.from(e.geoset.Vertices))), original);
    const open=await page.evaluate(read);
    // OrbitControls recomputes its spherical position on resize; observed drift
    // is 1e-13 model units, so compare camera values at numerical precision.
    for(const key of ['camera','target'])assert.ok(open[key].every((n,i)=>Math.abs(n-cameraBefore[key][i])<1e-9),'opening preserves '+key);
    const drawer=page.getByRole('complementary',{name:'Forge tools',exact:true});
    assert.ok((await drawer.boundingBox()).x<(await view.boundingBox()).x,'toolset sits to the left of the same viewport');
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0',{exact:true}).check();
    await view.click();await page.keyboard.press('Control+a');
    const beforeDrag=await page.evaluate(read);
    await drawer.getByRole('button',{name:'Taper',exact:true}).click();
    await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles?.points?.length>0);
    const h=(await page.evaluate(read)).handles.find(h=>h.id==='amount');
    await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x+35,h.y-25,{steps:8});await page.mouse.up();
    await page.waitForFunction(original=>JSON.stringify(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets.map(g=>Array.from(g.Vertices)))!==JSON.stringify(original),original);
    const preview=await page.evaluate(read);
    assert.deepEqual(preview.buffers.slice(1),beforeDrag.buffers.slice(1),'a Forge preview keeps untouched geoset buffers');
    await drawer.getByRole('button',{name:'Keep shaping',exact:true}).click();
    await page.waitForFunction(()=>!findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles);
    assert.deepEqual((await page.evaluate(read)).vertices,preview.vertices,'Commit keeps the exact preview');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(original=>JSON.stringify(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets.map(g=>Array.from(g.Vertices)))===JSON.stringify(original),original);
    await page.keyboard.press('Control+y');
    await page.waitForFunction(vertices=>JSON.stringify(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets.map(g=>Array.from(g.Vertices)))===JSON.stringify(vertices),preview.vertices);
    await page.keyboard.press('Control+z');
    await drawer.getByRole('button',{name:'Add shape',exact:true}).click();
    await drawer.getByRole('button',{name:'Cube',exact:true}).click();
    await page.waitForFunction(count=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[0].Vertices.length>count,original[0].length);
    const added=await page.evaluate(read);assert.ok(added.selection[0].every(i=>i>=original[0].length/3));
    const waitVertices=async(vertices,equal=true)=>page.waitForFunction(({vertices,equal})=>(JSON.stringify(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets.map(g=>Array.from(g.Vertices)))===JSON.stringify(vertices))===equal,{vertices,equal});
    const dragAmount=async(pixels=16)=>{
      await page.waitForFunction(()=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles?.points?.length>0);
      const h=(await page.evaluate(read)).handles.find(h=>h.id==='amount'),dx=h.end.x-h.x,dy=h.end.y-h.y,length=Math.hypot(dx,dy);
      assert.ok(length>1e-6,'handle direction is visible');
      await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x+dx/length*pixels,h.y+dy/length*pixels,{steps:8});await page.mouse.up();
    };
    for(const key of ['Escape','Control+z']){
      await drawer.getByRole('button',{name:'Taper',exact:true}).click();await dragAmount();await waitVertices(added.vertices,false);
      await page.keyboard.press(key);await waitVertices(added.vertices);
      await page.waitForFunction(()=>!findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles);
    }
    await page.keyboard.press('m');
    const moveBox=await view.boundingBox(),mx=moveBox.x+moveBox.width*.25,my=moveBox.y+moveBox.height*.4;
    await page.mouse.move(mx,my);await page.mouse.down();await page.mouse.move(mx+28,my-18,{steps:8});await page.mouse.up();await waitVertices(added.vertices,false);
    const moved=await page.evaluate(read);
    assert.deepEqual(moved.vertices[0].slice(0,original[0].length),original[0],'ordinary Move affects only the added selected object');
    await page.keyboard.press('Control+z');await waitVertices(added.vertices);
    console.log('PASS: Escape and Ctrl+Z cancel only the current Forge preview; ordinary Move and Undo work with the drawer open.');
    for(const name of ['Bend','Bulge / Pinch','Bevel','Twist']){
      await drawer.getByRole('button',{name,exact:true}).click();await dragAmount();await waitVertices(added.vertices,false);
      await drawer.getByRole('button',{name:'Keep shaping',exact:true}).click();
      await page.waitForFunction(()=>!findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles);
      if(name==='Bevel')assert.ok((await page.evaluate(read)).selection[0].length<original[0].length/3,'bevel keeps the edited object selected instead of the whole geoset');
      await page.keyboard.press('Control+z');await waitVertices(added.vertices);
      console.log('PASS:',name,'on an object added inside the real model, Commit and Undo.');
    }
    await drawer.getByRole('button',{name:'Faces',exact:true}).click();
    const face=await page.evaluate(min=>{
      const selector='[aria-label="3D model viewport"]',s=findFiberState(selector,s=>s?.renderer&&s?.entries),p=findFiberProps(selector,p=>p?.model&&p?.onTransform),g=p.model.Geosets[0],r=s.renderer.domElement.getBoundingClientRect(),candidates=[];
      for(let i=0;i<g.Faces.length;i+=3){const ids=Array.from(g.Faces.slice(i,i+3));if(ids.some(id=>id<min))continue;
        const center=[0,1,2].map(a=>ids.reduce((n,id)=>n+g.Vertices[id*3+a]/3,0)),q=s.camera.position.clone().fromArray(center).project(s.camera);
        candidates.push({x:r.x+(q.x+1)*r.width/2,y:r.y+(1-q.y)*r.height/2,z:q.z});}
      return candidates.sort((a,b)=>a.z-b.z)[0];
    },original[0].length/3);
    await page.mouse.click(face.x,face.y);
    await page.waitForFunction(min=>{const p=findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform),ids=p.selectionByGeoset[0];return ids?.length>0&&ids.length<24&&ids.every(i=>i>=min);},original[0].length/3);
    await drawer.getByRole('button',{name:'Inset',exact:true}).click();await dragAmount(9);await waitVertices(added.vertices,false);
    await drawer.getByRole('button',{name:'Commit inset',exact:true}).click();await page.keyboard.press('Control+z');await waitVertices(added.vertices);
    await drawer.getByRole('button',{name:'Cut',exact:true}).click();await waitVertices(added.vertices,false);
    await drawer.getByRole('button',{name:'Commit cut',exact:true}).click();await page.keyboard.press('Control+z');await waitVertices(added.vertices);
    await drawer.getByRole('button',{name:'Extrude',exact:true}).click();
    await page.mouse.move(face.x,face.y);await page.mouse.down();await page.mouse.move(face.x+20,face.y-30,{steps:8});await page.mouse.up();await waitVertices(added.vertices,false);
    await page.keyboard.press('Control+z');await waitVertices(added.vertices);
    console.log('PASS: pick an existing face, Inset, Cut and drag Extrude each commit and Undo through normal editor history.');
    await drawer.getByRole('button',{name:'Vertices',exact:true}).click();
    const joins=await page.evaluate(min=>{
      const s=findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries),g=s.entries[0].geoset,r=s.renderer.domElement.getBoundingClientRect();
      const points=Array.from({length:g.Vertices.length/3},(_,id)=>{const v=s.camera.position.clone().fromArray(g.Vertices,id*3).project(s.camera);return {id,x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2,z:v.z};}).filter(p=>p.z>=-1&&p.z<=1&&p.x>r.x+8&&p.x<r.right-8&&p.y>r.y+8&&p.y<r.bottom-8);
      const old=points.filter(p=>p.id<min),added=points.filter(p=>p.id>=min),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
      const second=added.sort((a,b)=>Math.min(...old.map(p=>distance(b,p)))-Math.min(...old.map(p=>distance(a,p))))[0];
      const first=old.find(p=>distance(p,second)>25),area=p=>Math.abs((second.x-first.x)*(p.y-first.y)-(second.y-first.y)*(p.x-first.x));
      const third=added.sort((a,b)=>area(b)-area(a))[0];
      return [first,second,third];
    },original[0].length/3);
    await page.mouse.click(joins[0].x,joins[0].y);
    await page.keyboard.down('Shift');await page.mouse.click(joins[1].x,joins[1].y);await page.keyboard.up('Shift');
    const joint=(await page.evaluate(read)).selection[0];
    assert.equal(joint.length,2);assert.ok(joint.some(id=>id<original[0].length/3)&&joint.some(id=>id>=original[0].length/3),'select one authored and one Forge vertex');
    await page.locator('[data-hotkey="Weld"]').click();
    await page.waitForFunction(n=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[0].Vertices.length<n,added.vertices[0].length);
    await page.keyboard.press('Control+z');await waitVertices(added.vertices);
    await page.keyboard.down('Shift');await page.mouse.click(joins[2].x,joins[2].y);await page.keyboard.up('Shift');
    assert.equal((await page.evaluate(read)).selection[0].length,3);
    await page.locator('[data-hotkey="Create triangle"]').click();
    await page.waitForFunction(n=>findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[0].Faces.length===n+3,added.faces[0].length);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(f=>JSON.stringify(Array.from(findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform).model.Geosets[0].Faces))===JSON.stringify(f),added.faces[0]);
    console.log('PASS: mouse-select authored and Forge vertices, weld them, add a connecting face, and undo both with Forge still open.');
    await page.getByRole('button',{name:'Close Forge tools',exact:true}).click();
    await drawer.waitFor({state:'detached'});
    await page.getByRole('button',{name:'Forge',exact:true}).click({button:'right'});
    await page.getByRole('menuitem',{name:'Call Upon Forge',exact:true}).click();
    await drawer.waitFor();
    // Keep the combined model for camera and standalone-entry checks.
    const prior=await page.evaluate(read),box=await view.boundingBox();
    await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+60,box.y+box.height*.5+20,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
    await page.waitForFunction(q=>JSON.stringify(findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries).camera.quaternion.toArray())!==JSON.stringify(q),prior.quaternion);
    await page.screenshot({path:path.resolve('out/forge-vertex-tools.png')});
    await drawer.getByRole('button',{name:'Close Forge tools',exact:true}).click();
    await drawer.waitFor({state:'detached'});
    await page.getByRole('button',{name:'Forge',exact:true}).click({button:'right'});
    await page.getByRole('menuitem',{name:'Enter the Forge',exact:true}).click();
    await page.getByRole('dialog',{name:'Forge',exact:true}).waitFor();
    console.log('PASS: Call Upon Forge adds tools to the existing Vertex editor without changing its geometry.');
    console.log('PASS: Taper preview/Commit, editor Undo/Redo, add object into the existing geoset, mouse rotation, close tools and standalone Forge.');
  } catch(error) {
    await page.screenshot({path:path.resolve('out/forge-vertex-failure.png')});
    console.error(await page.evaluate(()=>({alert:document.querySelector('.forge-vertex-tools [role="alert"]')?.textContent,operation:findFiberState('.forge-vertex-tools',s=>s?.kind&&s?.draft)?.mold,props:findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform)?.editHandles,box:document.querySelector('[aria-label="3D model viewport"]')?.getBoundingClientRect().toJSON()})));
    throw error;
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
