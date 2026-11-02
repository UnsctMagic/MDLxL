// Contract acceptance through the packaged app's real mouse/keyboard paths.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,sha256File,bundleHashes,appTarget}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
function readViewport(selector){
 const host=document.querySelector(selector+' [aria-label="3D model viewport"]');let props;
 const state=findFiberState(host,(value,p)=>{if(value?.renderer&&value?.entries){props=p;return true;}return false;},{current:true});
 if(!state)return null;
 return {model:JSON.stringify(props.model),camera:state.camera.toJSON(),position:state.camera.position.toArray(),quaternion:state.camera.quaternion.toArray(),zoom:state.camera.zoom,target:state.controls.target.toArray(),selection:props.selectionByGeoset||{},points:state.entries.map(e=>Array.from(e.geometry.attributes.position.array)),handles:(state.gizmoHandles||[]).map(({axis,plane,x,y,startX,startY,ring,points,polygon,dx,dy,mode})=>({axis,plane,x,y,startX,startY,ring,points,polygon,dx,dy,mode})),rotation:state.drag?.payload?.rotation,degrees:state.drag?.rotationDrag?.degrees,turnAxis:state.drag?.rotationDrag?.axisName,constrained:state.drag?.rotationDrag?.constrained,translation:state.drag?.payload?.translation};
}
(async()=>{
 const out=path.resolve(process.env.MDLXL_ROTATION_OUT||'out/rotation-interaction'),fixture=fixturePath('footman');fs.mkdirSync(out,{recursive:true});
 const hash=sha256File(fixture),checks=[],errors=[];const ownerProfile=process.env.MDLXL_MOUSE_PROFILE;
 const saved=ownerProfile?JSON.parse(fs.readFileSync(path.join(ownerProfile,'settings.json'),'utf8')).preferences:{};
 const settings={preferences:{...saved,language:'en',rotation:{sensitivity:1,precision:.1,editors:{}},graphics:{...saved.graphics,pauseWhenHidden:false}}};
 const dpi=Number(saved.pointerSensitivity)||1;
 const {app,page}=await launchApp({fixture,out,settings,errors,show:'hide',bounds:{x:0,y:0,width:1500,height:980},args:['--disable-gpu-vsync','--disable-frame-rate-limit']});
 const {Vector3,Euler,ObjectLoader,Matrix4}=await import('three');
 const {movementAxisHandles,projectMovementNodes,pickMovementHandle}=await import('../app/movement-overlay.js');
 const {projectPoseHandles,pickPoseHandle}=await import('../app/pose-overlay.js');
 const check=(name)=>{checks.push(name);console.log('PASS '+name);};
 const shot=async name=>{const bytes=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(bytes,'base64'));};
 const settingsDialog=async()=>{await page.keyboard.press('Control+,');const d=page.getByRole('dialog',{name:'Settings',exact:true});await d.waitFor();return d;};
 const setStyle=async(rotate,move)=>{const d=await settingsDialog();await d.getByRole('tab',{name:'Appearance',exact:true}).click();await d.getByRole('navigation',{name:'Appearance pages'}).getByRole('button',{name:'Controllers',exact:true}).click();if(rotate)await d.getByLabel('Rotate handles',{exact:true}).selectOption(rotate);if(move)await d.getByLabel('Move gizmo',{exact:true}).selectOption(move);await d.getByRole('button',{name:'Close Settings',exact:true}).click();};
 const setSpeed=async(editor,speed,precision)=>{const d=await settingsDialog();await d.getByRole('tab',{name:'Mouse',exact:true}).click();await d.getByRole('navigation',{name:'Mouse pages'}).getByRole('button',{name:'Rotation',exact:true}).click();assert.equal(await d.getByLabel('Rotational Behavior',{exact:true}).count(),0);await d.getByLabel('Rotation editor',{exact:true}).selectOption(editor);if(editor!=='all')await d.getByLabel('Use default rotation sensitivity').uncheck();await page.waitForFunction(editor=>{const p=findFiberProps('.settings-window',p=>p.preferences&&p.onChange),r=p?.preferences.rotation,n=document.querySelector('[aria-label="Rotation sensitivity"]');return n&&!n.disabled&&Number(n.value)===(editor==='all'?r.sensitivity:r.editors[editor]?.sensitivity??r.sensitivity);},editor);const n=d.getByLabel('Rotation sensitivity',{exact:true});await n.fill(String(speed));await n.press('Enter');await page.waitForFunction(({editor,speed})=>{const p=findFiberProps('.settings-window',p=>p.preferences&&p.onChange);const r=p?.preferences.rotation;return r&&(editor==='all'?r.sensitivity:r.editors[editor]?.sensitivity)===speed;},{editor,speed});if(precision!==undefined){if(editor!=='all')await d.getByLabel('Use default rotation precision').uncheck();const n=d.getByLabel('Shift rotation precision',{exact:true});await n.fill(String(precision));await n.press('Enter');}const r=await page.evaluate(()=>findFiberProps('.settings-window',p=>p.preferences&&p.onChange)?.preferences.rotation);console.log('SET SPEED',editor,speed,JSON.stringify(r));assert.equal(editor==='all'?r.sensitivity:r.editors[editor]?.sensitivity,speed);await shot('settings-rotation');await d.getByRole('button',{name:'Close Settings',exact:true}).click();};
 async function rawDrag(start,end,{shift=false,live}={}){if(shift)await page.keyboard.down('Shift');await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});if(live)await live();await page.mouse.up();if(shift)await page.keyboard.up('Shift');}
 const almost=(a,b,t=1e-4)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
 async function orbit(target,read){const rect=await target.boundingBox(),before=await read();await page.keyboard.down('Alt');await rawDrag({x:rect.x+rect.width*.55,y:rect.y+rect.height*.55},{x:rect.x+rect.width*.55+35,y:rect.y+rect.height*.55+20});await page.keyboard.up('Alt');await page.waitForFunction(({selector,old})=>{let p;const h=document.querySelector(selector+' [aria-label="3D model viewport"]'),r=findFiberState(h,(v,q)=>{if(v?.renderer&&v?.entries){p=q;return true;}return false;},{current:true});return r&&r.camera.quaternion.toArray().some((v,i)=>Math.abs(v-old[i])>1e-5);},{selector:target._scopeSelector||'.classic-view',old:before.quaternion});}
 try{
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible())),true);
  await page.getByLabel('3D model viewport',{exact:true}).waitFor();
  await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 0',{exact:true}).check();
  if(process.env.MDLXL_ROTATION_TARGET!=='movement'){
  let scope='.classic-view',root=page.locator(scope),sidebar=page.locator('.classic-sidebar');
  await sidebar.getByRole('button',{name:'Select',exact:true}).click();const box=await root.getByLabel('3D model viewport',{exact:true}).boundingBox();await page.mouse.click(box.x+box.width*.7,box.y+box.height*.7);await page.keyboard.press('Control+a');
  await sidebar.getByRole('button',{name:'Rotate',exact:true}).click();
  const read=()=>page.evaluate(readViewport,scope);
  await page.waitForFunction(()=>{const h=document.querySelector('[aria-label="3D model viewport"]');const r=findFiberState(h,v=>v?.renderer&&v?.entries,{current:true});return r&&Object.keys(r.entries).length>0;});
  const normalControls=await page.locator('.classic-sidebar .classic-planes').innerHTML();
  await shot('default-view');
  async function vertexTurn(target,plane,{shift=false,speed=1,precision=.1,label='Vertices',off=false,style='lines'}={}){
   const b=await target.boundingBox();await page.mouse.click(b.x+b.width*.72,b.y+b.height*.7);if(off)await page.waitForFunction(selector=>{const r=findFiberState(document.querySelector(selector+' [aria-label="3D model viewport"]'),v=>v?.renderer&&v?.entries,{current:true});return r?.gizmoHandles?.some(h=>h.mode==='rotate');},scope);const before=await read();let start={x:b.x+b.width*.72,y:b.y+b.height*.7},end={x:start.x+40,y:start.y+17};
   if(off){const h=before.handles.find(h=>h.ring?h.points.some(p=>p.x>25&&p.y>25&&p.x<b.width-30&&p.y<b.height-30):h.axis==='X')||before.handles[0];assert.ok(h,'visible Rotate handle');const at=h.ring?h.points.find(p=>p.x>25&&p.y>25&&p.x<b.width-30&&p.y<b.height-30):h;start={x:b.x+at.x,y:b.y+at.y};const pivot={x:b.x+h.startX,y:b.y+h.startY},dx=start.x-pivot.x,dy=start.y-pivot.y;end={x:pivot.x+dx*Math.cos(.45)-dy*Math.sin(.45),y:pivot.y+dx*Math.sin(.45)+dy*Math.cos(.45)};}
   if(off){await page.mouse.move(start.x,start.y);await page.waitForFunction(({selector,pane})=>{const canvas=document.querySelector((pane?'[data-viewport="'+pane+'"]':selector)+' [data-move-gizmo]');if(!canvas?.dataset.activeHandle)return false;const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let yellow=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>190&&pixels[i+1]>180&&pixels[i+2]<140&&pixels[i+3]>80&&++yellow>=25)return true;return false;},{selector:scope,pane:await target.getAttribute('data-viewport')});if(style==='lines')await shot('hover-highlight');}
   await rawDrag(start,end,{shift,live:async()=>{await page.waitForFunction(({selector,x,y})=>{const r=findFiberState(document.querySelector(selector+' [aria-label="3D model viewport"]'),v=>v?.renderer&&v?.entries,{current:true});const at=r?.drag?.lastMove?.rawEnd;return at&&Math.abs(at.x-x)<.1&&Math.abs(at.y-y)<.1;},{selector:scope,x:end.x-b.x,y:end.y-b.y});const live=await read();assert.ok(live.rotation?.some(v=>Math.abs(v)>1e-5),'geometry has a live turn');if(!off){const expected=40*({xy:1,xz:-1,yz:1}[plane])*dpi*speed*(shift?precision:1);almost(live.degrees,expected,.05);assert.equal(live.turnAxis,{xy:'Z',xz:'Y',yz:'X'}[plane]);}const e=new Euler(...live.rotation.map(v=>v*Math.PI/180));const key=Object.keys(before.selection).find(k=>before.selection[k]?.length);if(key){const ids=before.selection[key],pivot=ids.reduce((v,id)=>v.add(new Vector3().fromArray(before.points[key],id*3)),new Vector3()).multiplyScalar(1/ids.length),id=ids[0],expected=new Vector3().fromArray(before.points[key],id*3).sub(pivot).applyEuler(e).add(pivot);assert.ok(expected.distanceTo(new Vector3().fromArray(live.points[key],id*3))<.01,'visible geometry follows turn');}if(off||checks.length===0)await shot(off?'drag-'+style:'constrained-arrow');}});
   await page.waitForFunction(({selector,old})=>{let p;findFiberState(document.querySelector(selector+' [aria-label="3D model viewport"]'),(v,q)=>{if(v?.renderer&&v?.entries){p=q;return true;}return false;},{current:true});return p&&JSON.stringify(p.model)!==old;},{selector:scope,old:before.model});
   const after=await read();after.position.forEach((v,i)=>almost(v,before.position[i],1e-8));after.quaternion.forEach((v,i)=>almost(v,before.quaternion[i],1e-8));check(`${label} ${off?style:plane} ${shift?'precision':'normal'} commits and keeps camera`);
  }
  async function vertexMove(label,style){
   await sidebar.getByRole('button',{name:'Move',exact:true}).click();
   const b=await root.getByLabel('3D model viewport',{exact:true}).boundingBox();
   await page.waitForFunction(selector=>{const r=findFiberState(document.querySelector(selector+' [aria-label="3D model viewport"]'),v=>v?.renderer&&v?.entries,{current:true});return r?.gizmoHandles?.some(h=>h.mode==='move');},scope);
   for(const kind of ['arrow','square']){
    const before=await read();const handle=kind==='arrow'?before.handles.find(h=>h.axis==='X'&&!h.plane):before.handles.find(h=>h.plane&&pickMovementHandle(before.handles,h.x,h.y,'move')?.plane===h.plane);assert.ok(handle,'pickable '+kind);
    const start={x:b.x+handle.x,y:b.y+handle.y};
    await rawDrag(start,{x:start.x+23,y:start.y+18},{shift:true,live:async()=>{
     await page.waitForFunction(({selector,x,y})=>{const r=findFiberState(document.querySelector(selector+' [aria-label="3D model viewport"]'),v=>v?.renderer&&v?.entries,{current:true});const at=r?.drag?.lastMove?.rawEnd;return at&&Math.abs(at.x-x)<.1&&Math.abs(at.y-y)<.1&&r.drag.payload?.translation?.some(v=>Math.abs(v)>1e-6);},{selector:scope,x:handle.x+23,y:handle.y+18});
     const live=await read(),v=live.translation;
     if(kind==='arrow')almost(v[0],0,1e-7);else{assert.equal(v.filter(n=>Math.abs(n)>1e-6).length,1);almost(v['XYZ'.indexOf(({xy:'Z',xz:'Y',yz:'X'})[handle.plane])],0,1e-7);}
     await page.keyboard.up('Shift');await page.mouse.move(start.x+30,start.y+23,{steps:6});
     await page.waitForFunction(({selector,old,x,y})=>{const r=findFiberState(document.querySelector(selector+' [aria-label="3D model viewport"]'),v=>v?.renderer&&v?.entries,{current:true});return r?.drag?.lastMove?.rawEnd&&Math.abs(r.drag.lastMove.rawEnd.x-x)<.1&&Math.abs(r.drag.lastMove.rawEnd.y-y)<.1&&r.drag.payload?.translation?.some((v,i)=>Math.abs(v-old[i])>1e-6);},{selector:scope,old:v,x:handle.x+30,y:handle.y+23});
     if(kind==='arrow'){const next=(await read()).translation;almost(next[1],v[1],1e-6);almost(next[2],v[2],1e-6);}
    }});check(`${label} ${style} Shift+${kind} switches mid-drag continuously`);
   }
  }
  for(const view of (process.env.MDLXL_ROTATION_TARGET==='later'?[]:['front','top','perspective'])){await page.getByLabel('View direction',{exact:true}).selectOption(view);await page.getByLabel('Workplane Constraints',{exact:true}).check();for(const plane of ['xy','xz','yz']){await page.getByLabel(({xy:'XY',xz:'ZX',yz:'YZ'})[plane]+' workplane',{exact:true}).check();for(let i=0;i<3;i++)await vertexTurn(root.getByLabel('3D model viewport',{exact:true}),plane);}}
  if(process.env.MDLXL_ROTATION_TARGET!=='later')await vertexTurn(root.getByLabel('3D model viewport',{exact:true}),'yz',{shift:true});await page.getByLabel('Workplane Constraints',{exact:true}).check();await page.getByLabel('YZ workplane',{exact:true}).check();await setSpeed('vertices',2,.2);await vertexTurn(root.getByLabel('3D model viewport',{exact:true}),'yz',{shift:true,speed:2,precision:.2});await setSpeed('vertices',1,.1);
  for(const style of ['lines','rings','arcs']){await setStyle(style);await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();await vertexTurn(root.getByLabel('3D model viewport',{exact:true}),'xy',{off:true,style});}
  for(const style of ['classic','today','bold']){await setStyle(null,style);await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();await vertexMove('Vertices',style);}
  await sidebar.getByRole('button',{name:'Rotate',exact:true}).click();
  await page.getByRole('button',{name:'Quad View',exact:true}).click();assert.equal(await sidebar.locator('.classic-planes').count(),0);await shot('quad-perspective-toolbar');
  for(const [id,plane] of [['front','yz'],['top','xy'],['side','xz'],['perspective','xy']]){const pane=page.locator(`[data-viewport="${id}"]`);await vertexTurn(pane,plane,{label:'Quad '+id});const b=await pane.boundingBox(),beforeOrbit=await read();await page.keyboard.down('Alt');await rawDrag({x:b.x+b.width*.5,y:b.y+b.height*.5},{x:b.x+b.width*.5+25,y:b.y+b.height*.5+15});await page.keyboard.up('Alt');const afterOrbit=await read();assert.ok(afterOrbit.quaternion.some((v,i)=>Math.abs(v-beforeOrbit.quaternion[i])>1e-5),'real mouse orbit changes camera');check('Quad '+id+' orbit changes camera');}
  await page.locator('[data-viewport="perspective"]').getByRole('button',{name:'ZX',exact:true}).click();assert.equal(await page.locator('[data-viewport="perspective"]').getByRole('button',{name:'ZX',exact:true}).getAttribute('aria-pressed'),'true');await vertexTurn(page.locator('[data-viewport="perspective"]'),'xz',{label:'Quad perspective toolbar ZX'});
  await page.locator('[data-viewport="perspective"]').getByRole('checkbox',{name:'Perspective Workplane Constraints',exact:true}).uncheck();await vertexTurn(page.locator('[data-viewport="perspective"]'),'xy',{off:true,style:'arcs',label:'Quad perspective off'});
  await page.getByRole('button',{name:'Quad View',exact:true}).click();assert.equal(await sidebar.locator('.classic-planes').count(),1);assert.ok(normalControls.includes('Workplane Constraints'));check('Single controls remain; quad sidebar removes plane controls');
  // Forge keeps its existing modal workflow: choose Settings before opening it.
  const forge=page.getByRole('dialog',{name:'Forge',exact:true});
  scope='.forge-dialog .forge-editor';root=page.locator(scope);sidebar=forge.locator('.forge-editor-sidebar');
  const openForge=async()=>{await page.getByRole('button',{name:'Forge',exact:true}).click();await forge.getByRole('button',{name:'Cube',exact:true}).click();await sidebar.getByRole('button',{name:'Rotate',exact:true}).click();};
  const closeForge=()=>forge.getByRole('button',{name:'Cancel',exact:true}).click();
  await openForge();await forge.getByLabel('Workplane Constraints',{exact:true}).check();
  for(const view of ['front','top','perspective']){await forge.getByLabel('View direction',{exact:true}).selectOption(view);for(const plane of ['xy','xz','yz']){await forge.getByLabel(({xy:'XY',xz:'ZX',yz:'YZ'})[plane]+' workplane',{exact:true}).check();for(let turn=0;turn<3;turn++)await vertexTurn(root.getByLabel('3D model viewport',{exact:true}),plane,{label:'Forge'});}}
  await closeForge();await setSpeed('forge',2,.2);await openForge();await forge.getByLabel('Workplane Constraints',{exact:true}).check();await forge.getByLabel('YZ workplane',{exact:true}).check();await vertexTurn(root.getByLabel('3D model viewport',{exact:true}),'yz',{label:'Forge',shift:true,speed:2,precision:.2});await closeForge();await setSpeed('forge',1,.1);
  for(const style of ['lines','rings','arcs']){await setStyle(style);await openForge();await forge.getByLabel('Workplane Constraints',{exact:true}).uncheck();await vertexTurn(root.getByLabel('3D model viewport',{exact:true}),'xy',{off:true,style,label:'Forge'});await closeForge();}
  for(const style of ['classic','today','bold']){await setStyle(null,style);await openForge();await forge.getByLabel('Workplane Constraints',{exact:true}).uncheck();await vertexMove('Forge',style);await closeForge();}
  await openForge();await forge.getByRole('button',{name:'Quad View',exact:true}).click();assert.equal(await sidebar.locator('.classic-planes').count(),0);
  for(const [id,plane]of [['front','yz'],['top','xy'],['side','xz'],['perspective','xy']]){const pane=forge.locator(`[data-viewport="${id}"]`);await vertexTurn(pane,plane,{label:'Forge quad '+id});const b=await pane.boundingBox(),before=await read();await page.keyboard.down('Alt');await rawDrag({x:b.x+b.width*.5,y:b.y+b.height*.5},{x:b.x+b.width*.5+25,y:b.y+b.height*.5+15});await page.keyboard.up('Alt');assert.ok((await read()).quaternion.some((v,i)=>Math.abs(v-before.quaternion[i])>1e-5));check('Forge quad '+id+' mouse orbit');}
  await closeForge();
  }
  // Movement, POSE, and Bones are continued below.
  await page.locator('[data-hotkey="animation"]').click();await page.getByLabel('Movement current sequence').selectOption('0');await page.getByLabel('Movement bone or node').selectOption('0');await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
  const tools=page.getByRole('group',{name:'Movement tool',exact:true});await tools.getByRole('button',{name:'Rotate',exact:true}).click();
  const gameData=async()=>{await page.waitForFunction(()=>{const {runtime:r,props:p}=mdlxlProbe();return r?.captureApi?.isReady&&(p.restPose||Math.round(r.native.getFrame())===Math.round(p.time));});return page.evaluate(()=>{const {runtime:r,props:p,session:s}=mdlxlProbe(),c=document.querySelector('[data-clean-model-canvas]');return {model:p.model,document:JSON.stringify(s.doc.model),camera:r.controls.object.toJSON(),frame:r.native.getFrame(),sequence:p.sequenceIndex,config:p.poseConfig,selected:p.selectedNodeIds,space:p.transformSpace,width:c.clientWidth,height:c.clientHeight,radius:r.captureApi.showcaseView().radius,appearance:p.preferences.viewportAppearance.controllers,matrices:(r.native.rendererData.nodes||[]).flatMap((node,index)=>node?.matrix?[[index,Array.from(node.matrix)]]:[])};});};
  async function checkMarkerClicks(label) {
   const before = await gameData(), camera = new ObjectLoader().parse(before.camera);
   camera.updateMatrixWorld(true);
   const matrices = new Map(before.matrices.map(([id,m]) => [id,new Matrix4().fromArray(m)]));
   const points = projectMovementNodes(before.model,before.frame,before.sequence,camera,before.width,before.height,before.frame,matrices);
   const box = await page.locator('[data-clean-model-canvas]').boundingBox();
   const controllers = label === 'POSE' ? projectPoseHandles(before.model,before.config,before.frame,before.sequence,camera,before.width,before.height) : [];
   const candidates = points.filter(p => p.visible && p.overlayKind === 'bones' && !p.helperNode && p.x>20 && p.y>20 && p.x<box.width-20 && p.y<box.height-20);
   const isolated = candidates.filter(p => points.every(q => q===p || Math.hypot(p.x-q.x,p.y-q.y)>3));
   const first = isolated.find(p => {
    if (label !== 'POSE') return true;
    const hit = pickPoseHandle(controllers,p.x,p.y,before.config.target,candidates,true);
    return hit?.kind === 'node' && hit.id === p.node.ObjectId;
   });
   const second = isolated.find(p => first && Math.hypot(p.x-first.x,p.y-first.y)>26);
   assert.ok(first && second, label+' has two separated bone markers');
   const click = async (point, key, expected) => {
    const undo = await page.evaluate(()=>mdlxlProbe().session.doc.historyStats.undoSteps);
    if(key) await page.keyboard.down(key);
    await page.mouse.click(box.x+point.x,box.y+point.y);
    if(key) await page.keyboard.up(key);
    try {
     await page.waitForFunction(ids=>JSON.stringify(mdlxlProbe().props.selectedNodeIds)===JSON.stringify(ids),expected);
    } catch (error) {
     assert.deepEqual((await gameData()).selected,expected,label+' '+(key||'plain')+' click at '+point.x+','+point.y);
     throw error;
    }
    if (!key && label !== 'Bones') assert.equal(await page.evaluate(()=>mdlxlProbe().session.doc.historyStats.undoSteps),undo,label+' plain click adds no undo');
   };
   const a=first.node.ObjectId,b=second.node.ObjectId,blank={x:box.width*.86,y:box.height*.22};
   await click(first,null,[a]);
   await click(second,'Shift',[a,b]);
   await click(second,'Control',[a]);
   await click(blank,null,[]);
   assert.equal((await gameData()).document,before.document);
   if(label!=='Bones'){
    await click(first,null,[a]);
    const start={x:box.x+blank.x,y:box.y+blank.y};
    await rawDrag(start,{x:start.x+25,y:start.y+45});
    await page.waitForFunction(old=>JSON.stringify(mdlxlProbe().session.doc.model)!==old,before.document);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(old=>JSON.stringify(mdlxlProbe().session.doc.model)===old,before.document);
   }
   check(label+' marker selection and undo history'+(label==='Bones'?'':' plus drag-away rotation'));
  }
  async function gameOrbit(label){const before=await gameData(),b=await page.locator('[data-clean-model-canvas]').boundingBox();await page.keyboard.down('Alt');await rawDrag({x:b.x+b.width*.65,y:b.y+b.height*.65},{x:b.x+b.width*.65+30,y:b.y+b.height*.65+20});await page.keyboard.up('Alt');await page.waitForFunction(old=>mdlxlProbe().runtime.controls.object.quaternion.toArray().some((v,i)=>Math.abs(v-old[i])>1e-5),new ObjectLoader().parse(before.camera).quaternion.toArray());assert.equal((await gameData()).document,before.document);check(label+' actual mouse orbit preserves document');}
  async function ensurePoseBody(mode){
   await tools.getByRole('button',{name:'Select',exact:true}).click();const current=await gameData(),camera=new ObjectLoader().parse(current.camera);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
   const body=projectPoseHandles(current.model,current.config,current.frame,current.sequence,camera,current.width,current.height).find(h=>h.kind==='body'),box=await page.locator('[data-clean-model-canvas]').boundingBox();
   assert.ok(body?.visible,'Body is visible for overlap cycling');
   for(let i=0;i<45;i++){
    const target=await page.evaluate(()=>mdlxlProbe().props.poseConfig.target);if(target?.kind==='body'){assert.equal((await gameData()).document,current.document,'selection cycling does not edit the model');await tools.getByRole('button',{name:mode,exact:true}).click();return;}
    const stamp=JSON.stringify(target);await page.mouse.click(box.x+body.x,box.y+body.y);await page.waitForFunction(old=>JSON.stringify(mdlxlProbe().props.poseConfig.target)!==old,stamp);
   }
   assert.fail('Body must be selectable through the existing overlap cycle');
  }
  async function gameMove(label,style,pose=false){
   if(pose)await ensurePoseBody('Move');
   const state=await gameData(),c=new ObjectLoader().parse(state.camera);c.updateMatrixWorld(true);c.updateProjectionMatrix();
   const points=pose?projectPoseHandles(state.model,state.config,state.frame,state.sequence,c,state.width,state.height):projectMovementNodes(state.model,state.frame,state.sequence,c,state.width,state.height,state.frame,new Map(state.matrices.map(([id,m])=>[id,new Matrix4().fromArray(m)]))),active=pose?points.find(h=>h.selected):points.find(h=>h.node.ObjectId===state.selected.at(-1));assert.ok(active);
   const handles=movementAxisHandles(active,c,state.width,state.height,state.radius,'world','move',state.appearance),h=handles.find(h=>h.axis==='X'&&!h.plane),b=await page.locator('[data-clean-model-canvas]').boundingBox();
   await rawDrag({x:b.x+h.x,y:b.y+h.y},{x:b.x+h.x+24,y:b.y+h.y+19},{shift:true});
   await page.waitForFunction(old=>JSON.stringify(mdlxlProbe().session.doc.model)!==old,state.document);
   const after=await gameData();if(pose)assert.equal(after.config.target.kind,'body','Move handle keeps the selected Body');const cc=new ObjectLoader().parse(after.camera);cc.updateMatrixWorld(true);
   const moved=pose?projectPoseHandles(after.model,after.config,after.frame,after.sequence,cc,after.width,after.height).find(h=>h.selected):projectMovementNodes(after.model,after.frame,after.sequence,cc,after.width,after.height,after.frame,new Map(after.matrices.map(([id,m])=>[id,new Matrix4().fromArray(m)]))).find(p=>p.node.ObjectId===state.selected.at(-1));
   const delta=moved.world.clone().sub(active.world);if(Math.abs(delta.x)>.015)fs.writeFileSync(path.join(out,'move-oracle.json'),JSON.stringify({state,after,delta:delta.toArray(),before:active.world.toArray(),moved:moved.world.toArray(),label,style},null,2));almost(delta.x,0,.015);assert.ok(delta.length()>.001);check(`${label} ${style} Shift+arrow changes visible world position in YZ`);
  }
  async function movementTurn({pose=false,plane='xy',off=false,shift=false,speed=1,precision=.1,style='arcs'}={}){
   await page.waitForFunction(()=>{const {runtime:r,props:p}=mdlxlProbe();return r?.captureApi?.isReady&&Math.round(r.native.getFrame())===Math.round(p.time);});
   const state=await page.evaluate(()=>{const {runtime:r,props:p,session:s}=mdlxlProbe();const c=document.querySelector('[data-clean-model-canvas]');return {model:p.model,document:JSON.stringify(s.doc.model),camera:r.controls.object.toJSON(),quaternion:r.controls.object.quaternion.toArray(),position:r.controls.object.position.toArray(),frame:r.native.getFrame(),sequence:p.sequenceIndex,config:p.poseConfig,selected:p.selectedNodeIds,space:p.transformSpace,width:c.clientWidth,height:c.clientHeight,radius:r.captureApi.showcaseView().radius,appearance:p.preferences.viewportAppearance.controllers,matrices:(r.native.rendererData.nodes||[]).flatMap((node,index)=>node?.matrix?[[index,Array.from(node.matrix)]]:[])};});
   const b=await page.locator('[data-clean-model-canvas]').boundingBox(),camera=new ObjectLoader().parse(state.camera);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();const points=pose?projectPoseHandles(state.model,state.config,state.frame,state.sequence,camera,state.width,state.height):projectMovementNodes(state.model,state.frame,state.sequence,camera,state.width,state.height);const active=pose?points.find(h=>h.selected):points.find(h=>h.node.ObjectId===state.selected.at(-1));assert.ok(active,'active control');let start={x:b.x+active.x+100,y:b.y+active.y+80},end={x:start.x+40,y:start.y+17};
   if(off){
    const handles=movementAxisHandles(active,camera,state.width,state.height,state.radius,state.space,'rotate',state.appearance);
    const nodes=projectMovementNodes(state.model,state.frame,state.sequence,camera,state.width,state.height,state.frame,new Map(state.matrices.map(([i,m])=>[i,new Matrix4().fromArray(m)])));
    const at=handles.flatMap(h=>(h.ring?h.points:[h]).filter(pt=>{
     if(Math.hypot(pt.x-active.x,pt.y-active.y)<22 || pt.x<10 || pt.y<10 || pt.x>state.width-10 || pt.y>state.height-10) return false;
     if(pickMovementHandle(handles,pt.x,pt.y,'rotate')!==h) return false;
     return !pose || pickMovementHandle(handles,pt.x,pt.y,'tip')===h || !pickPoseHandle(points,pt.x,pt.y,state.config.target,nodes,true);
    }))[0];
    assert.ok(at,'visible '+style+' handle clear of higher-priority POSE markers');start={x:b.x+at.x,y:b.y+at.y};const dx=at.x-active.x,dy=at.y-active.y;end={x:b.x+active.x+dx*Math.cos(.45)-dy*Math.sin(.45),y:b.y+active.y+dx*Math.sin(.45)+dy*Math.cos(.45)};}
   await rawDrag(start,end,{shift,live:async()=>{const expected=(off ? .45*180/Math.PI : 40*({xy:1,xz:-1,yz:1}[plane]))*dpi*speed*(shift?precision:1);await page.waitForFunction(expected=>{const el=document.querySelector('[data-rotation-feedback]:not([data-rotation-feedback=""])');const angle=Number(el?.getAttribute('data-rotation-feedback')?.split(' ').at(-1));return !!el&&Math.abs(Math.abs(angle)-Math.abs(expected))<.06;},expected);const value=await page.locator('[data-rotation-feedback]:not([data-rotation-feedback=""])').getAttribute('data-rotation-feedback');if(!off)almost(Number(value.split(' ').at(-1)),40*({xy:1,xz:-1,yz:1}[plane])*dpi*speed*(shift?precision:1),.06);await shot(pose?'pose-'+style:'movement-'+style);}});
   await page.waitForFunction(old=>JSON.stringify(mdlxlProbe().session.doc.model)!==old,state.document);check((pose?'POSE':'Movement')+' '+(off?style:plane)+(shift?' precision':'')+' changes authored tracks');
  }
  await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();
  await checkMarkerClicks('Movement');
  await page.getByLabel('Movement bone or node').selectOption('0');
  for(const view of ['front','top','perspective']){await page.getByLabel('View direction',{exact:true}).selectOption(view);await page.getByLabel('Workplane Constraints',{exact:true}).check();for(const plane of ['xy','xz','yz']){await page.locator(`[data-hotkey="plane:${plane}"]`).check();for(let i=0;i<3;i++)await movementTurn({plane});}}
  await movementTurn({plane:'yz',shift:true});await setSpeed('movement',2,.2);await movementTurn({plane:'yz',shift:true,speed:2,precision:.2});await setSpeed('movement',1,.1);
  for(const style of ['lines','rings','arcs']){await setStyle(style);await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();await movementTurn({off:true,style});}
  await tools.getByRole('button',{name:'Move',exact:true}).click();for(const style of ['classic','today','bold']){await setStyle(null,style);for(const view of ['front','top','perspective']){await page.getByLabel('View direction',{exact:true}).selectOption(view);await gameMove('Movement',style);}}
  await gameOrbit('Movement');
  await page.getByRole('button',{name:'POSE',exact:true}).click();await tools.getByRole('button',{name:'Select',exact:true}).click();
  await ensurePoseBody('Rotate');
  const poseBones=page.getByRole('group',{name:'Quick display',exact:true}).locator('input[data-hotkey="display:bones"]');
  const bonesWereVisible=await poseBones.isChecked();
  await poseBones.check();
  await checkMarkerClicks('POSE');
  await poseBones.setChecked(bonesWereVisible);
  await ensurePoseBody('Rotate');
  await page.getByLabel('Workplane Constraints',{exact:true}).check();for(const view of ['front','top','perspective']){await page.getByLabel('View direction',{exact:true}).selectOption(view);for(const plane of ['xy','xz','yz']){await page.locator(`[data-hotkey="plane:${plane}"]`).check();for(let turn=0;turn<3;turn++)await movementTurn({pose:true,plane});}}await movementTurn({pose:true,plane:'yz',shift:true});await setSpeed('movement',2,.2);await movementTurn({pose:true,plane:'yz',shift:true,speed:2,precision:.2});await setSpeed('movement',1,.1);await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();for(const style of ['lines','rings','arcs']){await setStyle(style);await movementTurn({pose:true,off:true,style});}
  await tools.getByRole('button',{name:'Move',exact:true}).click();for(const style of ['classic','today','bold']){await setStyle(null,style);for(const view of ['front','top','perspective']){await page.getByLabel('View direction',{exact:true}).selectOption(view);await gameMove('POSE',style,true);}}
  await gameOrbit('POSE');
  await page.locator('[data-hotkey="bones"]').click();await page.getByLabel('Movement bone or node').selectOption('0');const bonesTools=page.getByRole('group',{name:'Bones tools',exact:true});await bonesTools.getByRole('button',{name:'Select Tool',exact:true}).click();await checkMarkerClicks('Bones');await page.getByLabel('Movement bone or node').selectOption('0');assert.equal(await bonesTools.getByRole('button',{name:'Rotate',exact:true}).count(),0);await bonesTools.getByRole('button',{name:'Move',exact:true}).click();await page.getByLabel('Workplane Constraints',{exact:true}).uncheck();for(const style of ['classic','today','bold']){await setStyle(null,style);for(const view of ['front','top','perspective']){await page.getByLabel('View direction',{exact:true}).selectOption(view);await gameMove('Bones',style);}}await gameOrbit('Bones');check('Bones preserves Select/Move restriction');
  assert.equal(sha256File(fixture),hash);assert.deepEqual(errors,[]);check('Original Footman bytes preserved; no renderer errors');
 }catch(error){await shot('failure');throw error;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,dpi,fixture,fixtureHash:hash,target:process.env.MDLXL_ROTATION_TARGET||'full',packaged:appTarget().packaged,executableHash:sha256File(appTarget().executablePath),bundle:bundleHashes()},null,2));await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
