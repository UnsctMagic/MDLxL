const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const out=path.resolve(process.env.MDLXL_GIZMO_REPORT||'out/gizmo-checks');fs.mkdirSync(out,{recursive:true});
const report={scope:process.env.MDLXL_GIZMO_CASES||'all',checks:[],measurements:[],errors:[]};
const check=(name,pass,evidence)=>{assert.ok(pass,name+(evidence?' '+JSON.stringify(evidence):''));report.checks.push(name);console.log('PASS '+name);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));};
(async()=>{
 const folder=path.dirname(process.env.MDLXL_TEST_EXE),settings=JSON.parse(fs.readFileSync(path.join(folder,'lab-profile/settings.json'),'utf8'));
 const {app,page}=await launchApp({out,settings,show:'hide',bounds:{x:0,y:0,width:1500,height:1040},errors:report.errors,args:['--disable-gpu-vsync','--disable-frame-rate-limit','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
 const capture=async name=>{const b64=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(b64,'base64'));};
 try{
  await page.waitForFunction(()=>!!window.__mdlxl?.document());
  check('Gizmo Lab has Lines Rings Arcs and Reset, without old style buttons',await page.getByRole('group',{name:'Gizmo Lab',exact:true}).getByRole('button').count()===4);
  await page.waitForFunction(()=>findFiberState('.viewport',v=>v?.gizmoLabViews?.size===4));
  await page.evaluate(()=>{window.gizmoRead=()=>{
   const r=findFiberState('.viewport',v=>v?.entries&&v?.controls),p=findFiberProps('.viewport',v=>v?.model&&v?.transformMode),doc=__mdlxl.document();
   const camera={position:r.camera.position.toArray(),quaternion:r.camera.quaternion.toArray(),zoom:r.camera.zoom,target:r.controls.target.toArray()};
   const panes=Object.fromEntries([...r.gizmoLabViews].map(([id,v])=>[id,{at:v.data.at,unit:v.data.unit,appearance:v.data.appearance,constrained:v.data.constrained,plane:v.data.plane,tool:v.data.tool,defaultAxis:v.data.defaultAxis,visual:v.visual,handles:v.data.handles.map(h=>({axis:h.axis,plane:h.plane,kind:h.kind,x:h.x,y:h.y,startX:h.startX,startY:h.startY,dx:h.dx,dy:h.dy,points:h.points,polygon:h.polygon}))}]));
   return {name:doc.name,vertices:doc.model.Geosets.map(g=>Array.from(g.Vertices)),normals:doc.model.Geosets.map(g=>Array.from(g.Normals||[])),undo:doc.historyStats.undoSteps,selection:__mdlxl.selection().selection,camera,cameraJSON:r.camera.toJSON(),live:r.entries.map(e=>e?Array.from(e.geometry.attributes.position.array):[]),panes,tool:p.transformMode,workplane:p.workplane,enabled:p.workplaneEnabled,drag:r.drag?.gizmoLab?{axis:r.drag.gizmoLab.axis,handle:r.drag.gizmoLab.handle,angle:r.drag.gizmoLab.angle,plane:r.drag.gizmoLab.usedPlane,usedAxis:r.drag.gizmoLab.usedAxis,translation:r.drag.gizmoLab.translation,shift:r.drag.gizmoLab.shift,constraints:r.drag.gizmoLab.constraints,payload:r.drag.payload}:null};
  };});
  const read=()=>page.evaluate(()=>gizmoRead());
  check('starts in quad with Rotate active, constraints off and Lines selected',(await read()).tool==='rotate'&&!(await read()).enabled&&await page.getByRole('button',{name:'Lines',exact:true}).getAttribute('aria-pressed')==='true');
  check('Perspective is unconstrained and Front Top Side use their own planes',Object.entries((await read()).panes).every(([id,p])=>id==='perspective'?!p.constrained:p.constrained&&p.plane==={front:'yz',top:'xy',side:'xz'}[id]));
  const tooltip='On: Move and Rotate stay locked to the chosen plane. Off: pick the axis or plane with the handles.';
  check('Workplane Constraints has the agreed tooltip',await page.getByLabel('Workplane Constraints',{exact:true}).locator('..').getAttribute('title')===tooltip);
  await capture('default');
  if(process.env.MDLXL_GIZMO_SMOKE==='1')return;

  const {Vector3,Euler,Quaternion,ObjectLoader,Raycaster,Plane}=await import('three');
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),close=(a,b,eps=1e-7)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<eps);
  const sameCamera=(a,b)=>Math.abs(a.zoom-b.zoom)<1e-10&&['position','quaternion','target'].every(k=>close(a[k],b[k],1e-8));
  const area=pane=>pane==='single'?page.getByLabel('3D model viewport',{exact:true}):page.locator(`[data-viewport="${pane}"]`);
  const logFile=path.join(folder,'rotation-drags.jsonl');
  const records=()=>fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8').split('\n').slice(0,-1).filter(Boolean).map(JSON.parse):[];
  report.logStart=records().length;
  const nextRecord=async count=>{
   if(records().length>count)return records().at(-1);
   return new Promise((resolve,reject)=>{const watcher=fs.watch(folder,(_event,name)=>{if(name!=='rotation-drags.jsonl')return;const rows=records();if(rows.length>count){clearTimeout(timer);watcher.close();resolve(rows.at(-1));}});const timer=setTimeout(()=>{watcher.close();reject(Error('drag log did not record the gesture'));},5000);});
  };
  const activate=async(pane,tool)=>{
   await page.keyboard.press('Shift+E');await area(pane).click({position:{x:180,y:80}});await page.keyboard.press('Shift+Q');
   await page.locator(`[data-hotkey="${tool}"]`).click();
   await page.waitForFunction(({pane,tool})=>gizmoRead().panes[pane]?.tool===tool,{pane,tool});
  };
  const constraint=async(pane,value)=>{
   const input=page.getByLabel('Workplane Constraints',{exact:true});
   if(['front','top','side'].includes(pane)){check(pane+' switch is locked on',await input.isDisabled()&&await input.isChecked());return;}
   if(value)await input.check();else await input.uncheck();
   await page.waitForFunction(({pane,value})=>gizmoRead().panes[pane]?.constrained===value,{pane,value});
  };
  const appearance=async(pane,name)=>{await page.getByRole('button',{name,exact:true}).click();await page.waitForFunction(({pane,name})=>gizmoRead().panes[pane]?.appearance===name,{pane,name});};
  const at=async(pane,point)=>{const b=await area(pane).boundingBox();return {x:b.x+point.x,y:b.y+point.y};};
  const waitFrame=async(end,shift)=>page.waitForFunction(({end,shift})=>{
   const r=findFiberState('.viewport',v=>v?.entries&&v?.controls),move=r.drag?.gizmoLab?.lastMove;
   return move&&Math.abs(move.rawEnd.x-end.x)<.2&&Math.abs(move.rawEnd.y-end.y)<.2&&move.shiftKey===shift&&!!r.drag.payload;
  },{end,shift});
  const waitVertices=before=>page.waitForFunction(before=>JSON.stringify(gizmoRead().vertices)!==JSON.stringify(before),before);
  const undo=async before=>{await page.keyboard.press('Control+z');await page.waitForFunction(before=>JSON.stringify(gizmoRead().vertices)===JSON.stringify(before),before);};
  const verifyGeometry=(before,after,payload,label)=>{
   const e=new Euler(...(payload.rotation||[0,0,0]).map(v=>v*Math.PI/180)),pivot=new Vector3(...payload.pivot),t=new Vector3(...(payload.translation||[0,0,0]));
   for(const [gi,ids]of Object.entries(before.selection))for(const i of ids){const expected=new Vector3().fromArray(before.vertices[gi],i*3).sub(pivot).applyEuler(e).add(pivot).add(t);for(let a=0;a<3;a++)assert.ok(Math.abs(expected.getComponent(a)-after.vertices[gi][i*3+a])<.0003,label+' committed vertices follow the visible transform');}
  };
  const posePick=(view,axis,plane)=>{
   const h=view.handles.find(h=>plane?h.plane===plane:h.axis===axis&&!h.plane);assert.ok(h,'visible '+(plane||axis)+' handle');
   if(!plane)return {x:h.x,y:h.y};
   const all=view.handles.filter(x=>!x.plane),poly=h.polygon;
   const segmentDistance=(p,h)=>{const dx=h.x-h.startX,dy=h.y-h.startY,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-h.startX)*dx+(p.y-h.startY)*dy)/l));return Math.hypot(p.x-h.startX-dx*t,p.y-h.startY-dy*t);};
   const inside=(p,poly)=>{const signs=poly.map((a,i)=>{const b=poly[(i+1)%poly.length];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);});return signs.every(v=>v>=0)||signs.every(v=>v<=0);};
   const candidates=[];for(const u of [.15,.35,.5,.65,.85])for(const v of [.15,.35,.5,.65,.85]){const p={x:poly[0].x+(poly[1].x-poly[0].x)*u+(poly[3].x-poly[0].x)*v,y:poly[0].y+(poly[1].y-poly[0].y)*u+(poly[3].y-poly[0].y)*v};candidates.push({p,score:Math.min(...all.map(a=>segmentDistance(p,a)))-(view.handles.some(other=>other.plane&&other.plane!==plane&&inside(p,other.polygon))?1000:0)});}
   return candidates.sort((a,b)=>b.score-a.score)[0].p;
  };
  const rotateStart=(view,off=false)=>{
   if(off)return {x:view.at.x+130,y:view.at.y-80};
   if(view.appearance==='Lines'){const h=view.handles.filter(h=>!h.plane).sort((a,b)=>Math.hypot(b.dx,b.dy)-Math.hypot(a.dx,a.dy))[0];return {x:h.x,y:h.y};}
   const ring=view.handles.find(h=>h.axis===view.defaultAxis);const point=ring.points[view.appearance==='Arcs'?48:12];return {x:point.x,y:point.y};
  };
  const beginPointer=async(pane,start,shift)=>{if(shift)await page.keyboard.down('Shift');const point=await at(pane,start);await page.mouse.move(point.x,point.y);await page.mouse.down();};
  const finish=async(before,pane,label,payload,count,{keep=false,shift=false}={})=>{
   await page.mouse.up();if(shift)await page.keyboard.up('Shift');await waitVertices(before.vertices);
   const after=await read(),record=await nextRecord(count);
   check(label+' changes selected vertices',!same(before.vertices,after.vertices));check(label+' keeps the camera',sameCamera(before.camera,after.camera));
   verifyGeometry(before,after,payload,label);check(label+' log matches tool and pane',record.pane===pane&&record.tool===(payload.rotation?'Rotate':'Move'));
   check(label+' has a non-cancelled local record',!record.cancelled);
   report.measurements.push({label,...record});
   if(!keep){await undo(before.vertices);check(label+' Ctrl+Z restores the model',same((await read()).vertices,before.vertices));}
   return {record,after,before};
  };
  const rotate=async(pane,name,locked,label,{snap=false,keep=false,off=false,shot}={})=>{
   report.activeCase=label;await activate(pane,'rotate');await constraint(pane,locked);await appearance(pane,name);
   const before=await read(),view=before.panes[pane],start=locked?{x:view.at.x+45,y:view.at.y-45}:rotateStart(view,off),count=records().length;
   await beginPointer(pane,start,snap);
   let end;
   if(locked){end={x:start.x+37,y:start.y+19};const p=await at(pane,end);await page.mouse.move(p.x,p.y,{steps:12});}
   else{const dx=start.x-view.at.x,dy=start.y-view.at.y,a=37*Math.PI/180;for(let i=1;i<=16;i++){const theta=a*i/16;end={x:view.at.x+dx*Math.cos(theta)-dy*Math.sin(theta),y:view.at.y+dx*Math.sin(theta)+dy*Math.cos(theta)};const p=await at(pane,end);await page.mouse.move(p.x,p.y);}}
   await waitFrame(end,snap);const live=await read();
   check(label+' previews before committing',same(live.vertices,before.vertices)&&!same(live.live,before.live));
   check(label+' shows the angle at the cursor',await page.locator('[data-gizmo-feedback]').count()===1&&/°/.test(await page.locator('[data-gizmo-feedback]').innerText()));
   check(label+' draws the dashed start ghost',live.panes[pane].visual.ghost);
   if(locked){const sign={xy:1,xz:-1,yz:1}[view.plane],expected=(snap?30:37)*sign;check(label+' matches fixed MDLVis direction and speed',Math.abs(live.drag.angle-expected)<.01);check(label+' has the yellow double arrow',(await page.locator('[data-gizmo-feedback]').innerText()).startsWith('↔ '));}
   else{check(label+' uses the 37-degree cursor sweep',Math.abs(Math.abs(live.drag.angle)-(snap?30:37))<.02);check(label+' shows the active ring',live.panes[pane].visual.ring);if(off)check(label+' picks the camera-facing axis',live.drag.axis===view.defaultAxis);}
   if(snap)check(label+' snaps to 15 degrees',Math.abs(live.drag.angle/15-Math.round(live.drag.angle/15))<1e-9);
   if(shot)await capture(shot);
   const result=await finish(before,pane,label,live.drag.payload,count,{keep,shift:snap});
   if(pane==='perspective'&&name==='Lines'&&!locked&&!off){await page.waitForFunction(()=>gizmoRead().panes.perspective.visual.activeHandle===gizmoRead().panes.perspective.defaultAxis);check(label+' hover follows the pointer after release',true);}
   return result;
  };
  const move=async(pane,name,locked,label,{axis,plane,shift=false,transition=false}={})=>{
   report.activeCase=label;await activate(pane,'translate');await constraint(pane,locked);await appearance(pane,name);
   const before=await read(),view=before.panes[pane],start=axis||plane?posePick(view,axis,plane):{x:view.at.x+130,y:view.at.y-65},count=records().length;
   await beginPointer(pane,start,shift);
   if(axis||plane)await page.waitForFunction(({axis,plane})=>{const h=gizmoRead().drag?.handle;return h&&(plane?h.plane===plane:h.axis===axis&&!h.plane);},{axis,plane});
   const shiftHeld=shift;let end={x:start.x+26,y:start.y+17};
   const send=async(point,held)=>{const p=await at(pane,point);await page.mouse.move(p.x,p.y,{steps:10});await waitFrame(point,held);return (await read()).drag.translation;};
   let delta=await send(end,shiftHeld);
   if(transition){
    const first=delta;await page.keyboard.down('Shift');await waitFrame(end,true);check(label+' Shift press keeps the visible offset',close((await read()).drag.translation,first,1e-7));
    end={x:end.x+24,y:end.y-18};delta=await send(end,true);const change=delta.map((v,i)=>v-first[i]);
    if(axis)check(label+' Shift switches arrow to its perpendicular plane',Math.abs(change['XYZ'.indexOf(axis)])<1e-8&&change.some((v,i)=>i!=='XYZ'.indexOf(axis)&&Math.abs(v)>.001));
    else check(label+' Shift square locks one in-plane axis',change.filter(v=>Math.abs(v)>.0001).length===1&&plane.toUpperCase().includes((await read()).drag.usedAxis));
    await page.keyboard.up('Shift');await waitFrame(end,false);check(label+' Shift release keeps the visible offset',close((await read()).drag.translation,delta,1e-7));
    end={x:end.x+15,y:end.y+12};delta=await send(end,false);
   }
   const live=await read();check(label+' previews before committing',same(before.vertices,live.vertices)&&!same(before.live,live.live));
   check(label+' shows four-way distance feedback',(await page.locator('[data-gizmo-feedback]').innerText()).startsWith('↔↕ '));
   check(label+' draws the dashed start ghost',live.panes[pane].visual.ghost);
   if(locked)check(label+' stays in its workplane',Math.abs(delta['XYZ'.indexOf({xy:'Z',xz:'Y',yz:'X'}[view.plane])])<1e-8);
   else if(axis&&shift)check(label+' Shift arrow cannot move along its own axis',Math.abs(delta['XYZ'.indexOf(axis)])<1e-8);
   else if(plane&&shift)check(label+' Shift square moves one axis',delta.filter(v=>Math.abs(v)>.001).length===1&&plane.toUpperCase().includes(live.drag.usedAxis));
   else if(axis&&!transition)check(label+' arrow moves only on its own axis',delta.every((v,i)=>i==='XYZ'.indexOf(axis)||Math.abs(v)<1e-8));
   else if(!axis&&!plane&&!locked){const used={X:'yz',Y:'xz',Z:'xy'}[view.defaultAxis];check(label+' off-handle drag chooses the camera-facing world plane',live.drag.plane===used&&Math.abs(delta['XYZ'.indexOf(view.defaultAxis)])<1e-8);}
   if(!locked&&!axis&&!plane){
    const camera=new ObjectLoader().parse(before.cameraJSON),ray=new Raycaster(),normal=new Vector3().setComponent('XYZ'.indexOf(view.defaultAxis),1),pivot=new Vector3(...live.drag.payload.pivot),worldPlane=new Plane().setFromNormalAndCoplanarPoint(normal,pivot),box=await area(pane).boundingBox();
    camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
    const hit=point=>{ray.setFromCamera({x:point.x/box.width*2-1,y:1-point.y/box.height*2},camera);return ray.ray.intersectPlane(worldPlane,new Vector3());};
    const expected=hit(end).sub(hit(start)).toArray();check(label+' follows the raw mouse one to one without DPI',close(delta,expected,1e-5));
   }
   return finish(before,pane,label,live.drag.payload,count,{shift});
  };
  const orbit=async pane=>{
   report.activeCase=pane+' camera orbit';await page.keyboard.press('Shift+E');await area(pane).click({position:{x:180,y:80}});const before=await read(),b=await area(pane).boundingBox(),start={x:b.x+b.width*.46,y:b.y+b.height*.45};
   await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+45,start.y+25,{steps:12});await page.mouse.up();
   await page.waitForFunction(q=>!gizmoRead().camera.quaternion.every((v,i)=>Math.abs(v-q[i])<1e-8),before.camera.quaternion);
   check(pane+' supports normal mouse camera rotation',!sameCamera(before.camera,(await read()).camera));check(pane+' camera orbit preserves model',same(before.vertices,(await read()).vertices));await page.keyboard.press('Shift+Q');
  };
  // Hover is checked on the visible POSE endpoint, not via a test-injected action.
  await activate('perspective','rotate');const initial=await read(),ball=initial.panes.perspective.handles.find(h=>h.axis==='X'),hoverPoint=await at('perspective',ball);
  await page.mouse.move(hoverPoint.x,hoverPoint.y);await page.waitForFunction(()=>gizmoRead().panes.perspective.visual.activeHandle==='X');
  check('visible Rotate handle highlights on real mouse hover',await page.locator('[data-viewport="perspective"] [data-gizmo-lab]').getAttribute('data-active-handle')==='X');await capture('hover');
  const leaveBox=await area('front').boundingBox();await page.mouse.move(leaveBox.x+180,leaveBox.y+80);await page.waitForFunction(()=>gizmoRead().panes.perspective.visual.activeHandle===null);check('hover highlight clears when the pointer leaves the pane',true);
  if(process.env.MDLXL_GIZMO_CASES==='proof'){
   for(const name of ['Lines','Rings','Arcs'])await rotate('perspective',name,false,'Proof '+name,{shot:'mid-'+name});
   await rotate('front','Lines',true,'Proof constrained',{shot:'constrained-readout'});await move('perspective','Lines',false,'Proof move');return;
  }
  if(!['modifiers','cancel'].includes(process.env.MDLXL_GIZMO_CASES)){
   for(const pane of ['front','top','side','perspective']){
    for(const locked of (pane==='perspective'?[false,true]:[true]))for(const name of ['Lines','Rings','Arcs']){
     await rotate(pane,name,locked,`Quad ${pane} ${name} ${locked?'on':'off'}`,{shot:pane==='perspective'&&!locked?'mid-'+name:pane==='front'&&name==='Lines'?'constrained-readout':undefined});
     await move(pane,name,locked,`Quad ${pane} ${name} Move ${locked?'on':'off'}`);
    }
    await rotate(pane,'Lines',true,'Quad '+pane+' constrained Shift',{snap:true});
    if(pane==='perspective'){
     await rotate(pane,'Rings',false,'Quad Perspective gizmo Shift',{snap:true});
     for(const axis of ['X','Y','Z']){await move(pane,'Lines',false,'Quad Shift arrow '+axis,{axis,shift:true});await move(pane,'Lines',false,'Quad Mid Shift arrow '+axis,{axis,transition:true});}
     for(const plane of ['xy','xz','yz']){await move(pane,'Lines',false,'Quad Shift square '+plane,{plane,shift:true});await move(pane,'Lines',false,'Quad Mid Shift square '+plane,{plane,transition:true});}
    }
    if(pane==='front'){const steps=[];for(let i=0;i<3;i++)steps.push(await rotate('front','Lines',true,'Front consecutive '+(i+1),{keep:true}));check('Front three consecutive constrained Rotate drags keep MDLVis direction',steps.every(s=>Math.abs(s.record.degrees-37)<.01));for(let i=steps.length-1;i>=0;i--)await undo(steps[i].before.vertices);}
    await orbit(pane);
   }
  }
  await page.getByRole('button',{name:'Quad View',exact:true}).click();await page.locator('.quad-pane').first().waitFor({state:'hidden'});
  const cameraAngle=async tilt=>{
   await page.getByLabel('View direction',{exact:true}).selectOption('perspective');await page.keyboard.press('Shift+E');
   for(const [axis,value]of [['X',tilt],['Y',25],['Z',0]]){const input=page.getByLabel(`Camera ${axis} coordinate`,{exact:true});await input.fill(String(value));await input.press('Enter');await page.waitForFunction(({axis,value})=>{const a=findFiberState('.classic-app',v=>v&&typeof v==='object'&&Object.keys(v).length===3&&['x','y','z'].every(k=>Number.isFinite(v[k])),{current:true});return a&&Math.abs(a[axis.toLowerCase()]-value)<.01;},{axis,value});}
   await area('single').click({position:{x:180,y:140}});await page.keyboard.press('Shift+Q');
   const q=new Quaternion().setFromEuler(new Euler(tilt*Math.PI/180,25*Math.PI/180,0,'XYZ')).toArray();await page.waitForFunction(q=>Math.abs(gizmoRead().camera.quaternion.reduce((sum,v,i)=>sum+v*q[i],0))>1-1e-8,q);
   check(`single view is really at ${tilt} degrees`,true);
  };
  if(!['modifiers','cancel'].includes(process.env.MDLXL_GIZMO_CASES)){
   for(const tilt of [30,60,85]){await cameraAngle(tilt);for(const locked of [false,true])for(const name of ['Lines','Rings','Arcs']){await rotate('single',name,locked,`Single ${tilt} ${name} ${locked?'on':'off'}`);await move('single',name,locked,`Single ${tilt} ${name} Move ${locked?'on':'off'}`);}}
   for(const locked of [false,true])for(const name of ['Lines','Rings','Arcs'])await rotate('single',name,locked,`Shift ${name} ${locked?'on':'off'}`,{snap:true});
   for(const name of ['Lines','Rings','Arcs'])await rotate('single',name,false,`Off-handle ${name}`,{off:true});
   await orbit('single');
   for(const locked of [false,true])for(const name of ['Lines','Rings','Arcs']){const turns=[];for(let i=0;i<3;i++)turns.push((await rotate('single',name,locked,`Repeated ${name} ${locked?'on':'off'} ${i+1}`,{keep:true})).record.degrees);check(`${name} ${locked?'on':'off'} three consecutive Rotate drags turn the same way`,turns.every(v=>Math.sign(v)===Math.sign(turns[0])&&Math.abs(v-turns[0])<.01));}
   await page.getByRole('button',{name:'Reset model',exact:true}).click();
  }
  if(process.env.MDLXL_GIZMO_CASES!=='cancel'){
   await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
   await activate('single','translate');await constraint('single',false);await appearance('single','Lines');
   await page.getByRole('button',{name:'Fit',exact:true}).click();
   for(const axis of ['X','Y','Z']){await move('single','Lines',false,'Arrow '+axis,{axis});await move('single','Lines',false,'Shift arrow '+axis,{axis,shift:true});await move('single','Lines',false,'Mid Shift arrow '+axis,{axis,transition:true});}
   for(const plane of ['xy','xz','yz']){await move('single','Lines',false,'Square '+plane,{plane});await move('single','Lines',false,'Shift square '+plane,{plane,shift:true});await move('single','Lines',false,'Mid Shift square '+plane,{plane,transition:true});}
  }
  // Real cancellation keys after a visible drag; no focus manipulation.
  for(const cancel of ['Escape','right click']){
   const label='Cancel '+cancel;report.activeCase=label;await activate('single','rotate');await constraint('single',false);await appearance('single','Rings');
   const before=await read(),view=before.panes.single,start=rotateStart(view),count=records().length;await beginPointer('single',start,false);const end={x:start.x+25,y:start.y+15},p=await at('single',end);await page.mouse.move(p.x,p.y,{steps:12});await waitFrame(end,false);
   if(cancel==='Escape')await page.keyboard.press('Escape');else{await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});}await page.mouse.up();
   await page.waitForFunction(()=>!gizmoRead().drag);const after=await read(),record=await nextRecord(count);check(label+' restores geometry without an undo step',same(before.vertices,after.vertices)&&after.undo===before.undo);check(label+' keeps camera and selection',sameCamera(before.camera,after.camera)&&same(before.selection,after.selection));check(label+' records cancellation and clears feedback',record.cancelled&&await page.locator('[data-gizmo-feedback]').count()===0);
  }
  const resetBase=await read();await rotate('single','Lines',true,'Reset setup',{keep:true});const turned=await read();
  await page.getByRole('button',{name:'Reset model',exact:true}).click();await page.waitForFunction(v=>JSON.stringify(gizmoRead().vertices)===JSON.stringify(v),resetBase.vertices);
  check('Reset restores vertices and normals and keeps camera',same((await read()).vertices,resetBase.vertices)&&same((await read()).normals,resetBase.normals)&&sameCamera((await read()).camera,turned.camera));
  await undo(turned.vertices);check('Ctrl+Z undoes Reset including surface normals',same((await read()).normals,turned.normals));
  await page.getByRole('tab',{name:'Box.mdx',exact:true}).click();await page.waitForFunction(()=>gizmoRead().name==='Box.mdx');
  await rotate('single','Rings',false,'Box Rotate');await move('single','Arcs',false,'Box Move');
  check('no renderer errors',report.errors.length===0,report.errors);check('all native windows stayed hidden',await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible())));
  report.dragRecords=records().slice(report.logStart);delete report.activeCase;

 }catch(error){report.failure=error.stack;try{report.lastState=await page.evaluate(()=>window.gizmoRead?.());await capture('failure');}catch(captureError){report.captureError=captureError.message;}throw error;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
