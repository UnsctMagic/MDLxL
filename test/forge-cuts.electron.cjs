const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
// Packaged UI: only mouse/keyboard mutate the app; React reads assert the result.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TEST_OUT||path.join(root,'out/cut-check');
const existing=fs.readFileSync(path.join(root,'test/forge-face-editing.electron.cjs'),'utf8');eval(existing.slice(existing.indexOf('function readView'),existing.indexOf('(async()=>{')));
function readDraft(){
 const el=document.querySelector('.forge-dialog .forge-editor');
 { const state = findFiberState(el, state => state?.shapes&&state?.mode, { current: true }); if (state) return structuredClone(state); }
 throw Error('Missing Forge draft');
}
function readCutCount(){
 const el=document.querySelector('.forge-dialog .forge-editor');
 { const state = findFiberState(el, state => state?.positions&&state?.frames, { current: true }); if (state) return Object.values(state.positions).reduce((n,positions)=>n+positions.length,0); }
 throw Error('Missing Forge cut preview');
}
function pointForVertex(view,position,index=0){const g=view.model.Geosets[index];for(let i=0;i<g.Vertices.length;i+=3)if(position.every((n,a)=>Math.abs(n-g.Vertices[i+a])<1e-4))return view.points[index][i/3];throw Error('Vertex missing');}
function pointForFace(view,shape,face){const points=face.vertices.map(i=>pointForVertex(view,shape.vertices[i]));return {x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length};}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {forgeFaceNormal}=await import('../src/forge-shape-editing.js');
 const launched = await launchApp({ out, env: { MDLVIS_HEADLESS:'0' }, timeout: 60000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'inactive', pageTimeout: 15000 }); const app = launched.app;let page;const checks=[],errors=launched.errors;
 const capture=async name=>{await settle(page, 450);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage());await settle(page, 150);const data=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i=>i.toPNG().toString('base64')));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
 try{
 page=launched.page;await page.getByRole('button',{name:'Forge',exact:true}).click();const d=page.getByRole('dialog',{name:'Forge',exact:true});
 const click=async name=>{await d.getByRole('button',{name,exact:true}).click();await settle(page, 150);};
 const view=async()=>{await settle(page, 150);return page.evaluate(readView);};const doc=()=>page.evaluate(readDraft);
 // The draft hook can be read a render early; small pointer moves let React finish before checking.
 const settledDoc=async ready=>{for(let i=0;i<20;i++){const value=await doc();if(ready(value))return value;await page.mouse.move(20+i,50);await settle(page, 100);}return doc();};
 const placedCuts=async count=>{for(let i=0;i<30;i++){if(await page.evaluate(readCutCount)===count)return;await settle(page, 50);}assert.equal(await page.evaluate(readCutCount),count,'Each cut click finishes before the next action');};
 const tops=shape=>shape.faces.filter(f=>forgeFaceNormal(shape,f)[2]>.999).sort((a,b)=>a.vertices.reduce((n,i)=>n+shape.vertices[i][0],0)/a.vertices.length-b.vertices.reduce((n,i)=>n+shape.vertices[i][0],0)/b.vertices.length);
 const pick=async p=>{await page.mouse.dblclick(p.x,p.y,{delay:90});await settle(page, 150);};
 await d.getByLabel('Width',{exact:true}).fill('300');await d.getByLabel('Height',{exact:true}).fill('100');await d.getByLabel('Depth',{exact:true}).fill('30');await click('Cube');
 const base=await doc(),baseView=await view(),sidebar=await d.locator('.forge-editor-sidebar').boundingBox();
 assert.equal(await d.locator('.forge-editor-toolbar').getByRole('button',{name:'Cut',exact:true}).count(),0);
 const cutButton=d.locator('.forge-shape-operations').getByRole('button',{name:'Cut',exact:true}),cutBounds=await cutButton.boundingBox(),insetBounds=await d.getByRole('button',{name:'Inset',exact:true}).boundingBox();
 assert.ok(cutBounds.x>insetBounds.x&&Math.abs(cutBounds.y-insetBounds.y)<2);assert.ok(cutBounds.x>=sidebar.x&&cutBounds.x+cutBounds.width<=sidebar.x+sidebar.width);
 checks.push('Cut sits beside Extrude and Inset in the existing sidebar and is removed from the top toolbar');
 await click('Cut');assert.equal(await d.getByRole('group',{name:'Cut controls',exact:true}).count(),1);assert.deepEqual(await doc(),base);assert.ok((await view()).model.Geosets[0].Faces.length>baseView.model.Geosets[0].Faces.length);
 const popup=await d.getByRole('group',{name:'Cut controls',exact:true}).boundingBox();assert.ok(popup.x>=0&&popup.x+popup.width<=baseView.rect.x+baseView.rect.width+sidebar.width+70);assert.ok(popup.y>=cutBounds.y+cutBounds.height);
 await d.getByLabel('Cut sections',{exact:true}).fill('6');let preview=await view();assert.deepEqual(await doc(),base);await capture('equal-cut-preview');
 await click('Turn cuts');assert.notDeepEqual((await view()).model.Geosets,preview.model.Geosets);await click('Turn cuts');assert.deepEqual((await view()).model.Geosets,preview.model.Geosets);
 await click('Apply cuts');let divided=await doc();assert.equal(tops(divided.shapes[0]).length,6);assert.equal(await d.getByRole('group',{name:'Cut controls',exact:true}).count(),0);assert.equal((await d.locator('.forge-editor-sidebar').boundingBox()).width,sidebar.width);
 await click('Undo');assert.deepEqual(await doc(),base);await click('Redo');assert.deepEqual(await doc(),divided);
 checks.push('Equal cuts preview and turn without changing the draft; Apply creates six sections; one Undo/Redo restores them and sidebar width stays unchanged');
 let v=await view(),shape=divided.shapes[0],faces=tops(shape),p=pointForFace(v,shape,faces[0]);await pick(p);assert.equal((await view()).tool,'translate');await click('Select');
 await page.keyboard.down('Shift');for(const index of [2,4]){const next=pointForFace(v,shape,faces[index]);await page.mouse.click(next.x,next.y);}await page.keyboard.up('Shift');
 assert.equal((await doc()).selection[shape.id].length,3);await page.keyboard.press('e');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y-65,{steps:10});await page.mouse.up();
 let raised=await doc();assert.equal((await view()).tool,'translate');const max= Math.max(...raised.shapes[0].vertices.map(p=>p[2]));assert.ok(max>100);assert.equal(tops(raised.shapes[0]).filter(f=>f.vertices.every(i=>Math.abs(raised.shapes[0].vertices[i][2]-max)<1e-4)).length,3);await capture('fort-wall');await click('Undo');assert.deepEqual((await doc()).shapes,divided.shapes);
 checks.push('Double-click and Shift selection choose alternating top sections; E-drag builds three connected battlements and Undo restores the wall');
 await click('Undo');assert.deepEqual((await doc()).shapes,base.shapes);await click('Edit Cube 1');const manualBase=await doc();await click('Cut');await click('Place cuts');v=await view();shape=manualBase.shapes[0];const front=shape.faces.find(f=>forgeFaceNormal(shape,f)[1]<-.999);
 const endpoints=[-150,150].map(x=>{const pts=front.vertices.filter(i=>Math.abs(shape.vertices[i][0]-x)<1e-4).map(i=>pointForVertex(v,shape.vertices[i]));return {x:pts.reduce((n,p)=>n+p.x,0)/pts.length,y:pts.reduce((n,p)=>n+p.y,0)/pts.length};});
 for(const [index,fraction] of [.23,.68].entries()){const q={x:endpoints[0].x+(endpoints[1].x-endpoints[0].x)*fraction,y:endpoints[0].y+(endpoints[1].y-endpoints[0].y)*fraction};await page.mouse.move(q.x,q.y);await settle(page, 150);assert.deepEqual(await doc(),manualBase);await page.mouse.click(q.x,q.y);await placedCuts(index+1);}
 await page.mouse.move(20,50);await click('Apply cuts');assert.equal(tops((await settledDoc(d=>tops(d.shapes[0]).length===3)).shapes[0]).length,3);await click('Undo');assert.deepEqual(await doc(),manualBase);
 checks.push('Two individually clicked cuts preview on the surface and create three sections in a single Undo step');
 await click('Cut');await click('Place cuts');const beforeCamera=await view();await page.keyboard.down('Alt');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+45,p.y+20,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');assert.notDeepEqual((await view()).quaternion,beforeCamera.quaternion);assert.deepEqual(await doc(),manualBase);await page.keyboard.press('Escape');assert.equal(await d.getByRole('group',{name:'Cut controls',exact:true}).count(),0);assert.deepEqual(await doc(),manualBase);
 await click('Cut');await click('Cancel cuts');assert.deepEqual(await doc(),manualBase);checks.push('Normal mouse rotation works while cutting; Escape and Cancel discard the preview without changing the draft');
 await click('Cancel');await page.getByRole('button',{name:'Forge',exact:true}).click();
 await d.getByLabel('Width',{exact:true}).fill('300');await d.getByLabel('Height',{exact:true}).fill('100');await d.getByLabel('Depth',{exact:true}).fill('30');await click('Cube');
 const faceBase=await doc();shape=faceBase.shapes[0];v=await view();const facePoint=pointForFace(v,shape,tops(shape)[0]);await pick(facePoint);const faceBefore=await doc();assert.equal(faceBefore.mode,'Faces');assert.deepEqual(faceBefore.shapes,faceBase.shapes);
 const onlyTop=shape=>{assert.equal(shape.faces.filter(f=>forgeFaceNormal(shape,f)[2]<.999).length,5);for(const old of faceBase.shapes[0].faces.filter(f=>forgeFaceNormal(faceBase.shapes[0],f)[2]<.999))assert.ok(shape.faces.some(f=>f.id===old.id));};
 await click('Cut');assert.deepEqual(await doc(),faceBefore);await capture('face-cut-preview');await click('Apply cuts');
 const faceDivided=await doc();assert.equal(faceDivided.mode,'Faces');assert.equal(faceDivided.selection[shape.id].length,4);assert.equal(tops(faceDivided.shapes[0]).length,4);onlyTop(faceDivided.shapes[0]);
 await click('Undo');assert.deepEqual(await doc(),faceBefore);await click('Redo');assert.deepEqual(await doc(),faceDivided);
 checks.push('Double-click selects a face; equal cuts divide only that surface, retain Face selection and leave the other five sides as individual faces; Undo/Redo restores the exact result');
 v=await view();shape=faceDivided.shapes[0];faces=tops(shape);p=pointForFace(v,shape,faces[0]);await pick(p);await click('Select');
 await page.keyboard.down('Shift');const other=pointForFace(v,shape,faces[2]);await page.mouse.click(other.x,other.y);await page.keyboard.up('Shift');assert.equal((await doc()).selection[shape.id].length,2);
 await page.keyboard.press('e');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y-65,{steps:10});await page.mouse.up();raised=await doc();
 assert.equal((await view()).tool,'translate');const faceMax=Math.max(...raised.shapes[0].vertices.map(p=>p[2]));assert.ok(faceMax>100);assert.equal(tops(raised.shapes[0]).filter(f=>f.vertices.every(i=>Math.abs(raised.shapes[0].vertices[i][2]-faceMax)<1e-4)).length,2);await capture('face-cut-wall');
 await click('Undo');assert.deepEqual((await doc()).shapes,faceDivided.shapes);await click('Undo');assert.deepEqual(await doc(),faceBefore);
 checks.push('Alternating sections from a face-only cut extrude into battlements with the existing E-drag control');
 await click('Cut');await click('Place cuts');v=await view();shape=faceBefore.shapes[0];const frontPoint=pointForFace(v,shape,shape.faces.find(f=>forgeFaceNormal(shape,f)[1]<-.999));
 await page.mouse.move(frontPoint.x,frontPoint.y);await page.mouse.click(frontPoint.x,frontPoint.y);assert.equal(await d.getByRole('button',{name:'Apply cuts',exact:true}).isEnabled(),false);assert.deepEqual((await view()).model.Geosets, v.model.Geosets);
 const topFace=tops(shape)[0],topEnds=[-150,150].map(x=>{const pts=topFace.vertices.filter(i=>Math.abs(shape.vertices[i][0]-x)<1e-4).map(i=>pointForVertex(v,shape.vertices[i]));return {x:pts.reduce((n,p)=>n+p.x,0)/pts.length,y:pts.reduce((n,p)=>n+p.y,0)/pts.length};});
 for(const [index,fraction] of [.23,.68].entries()){const q={x:topEnds[0].x+(topEnds[1].x-topEnds[0].x)*fraction,y:topEnds[0].y+(topEnds[1].y-topEnds[0].y)*fraction};await page.mouse.move(q.x,q.y);await settle(page, 150);await page.mouse.click(q.x,q.y);await placedCuts(index+1);}
 await page.mouse.move(20,50);await click('Apply cuts');const manualFace=await doc();assert.equal(tops(manualFace.shapes[0]).length,3);onlyTop(manualFace.shapes[0]);await click('Undo');assert.deepEqual(await doc(),faceBefore);
 checks.push('Manual face cuts accept clicks only on the selected surface and divide it without cutting through the rest of the block');
 await click('Cancel');await page.getByRole('button',{name:'Forge',exact:true}).click();await click('Plane');const planeBase=await doc();await click('Cut');await click('Apply cuts');const plane=await doc();assert.equal(plane.shapes[0].faces.length,4);assert.ok(plane.shapes[0].vertices.every(p=>Math.abs(p[2])<1e-6));await click('Undo');assert.deepEqual(await doc(),planeBase);checks.push('The same Cut control divides a flat plane and keeps it flat');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,checks,rendererErrors:errors},null,2));console.log(JSON.stringify({pass:true,checks},null,2));
 }catch(e){if(page)await capture('failure');throw e;}finally{if(app)await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
