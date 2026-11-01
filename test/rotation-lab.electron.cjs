const {launchApp,closeApp}=require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.MDLXL_LAB_REPORT||'out/rotation-lab-checks');fs.mkdirSync(out,{recursive:true});
const lab=path.dirname(process.env.MDLXL_TEST_EXE),log=path.join(lab,'rotation-drags.jsonl');
const readLog=()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const report={scope:process.env.MDLXL_LAB_SINGLE_ONLY==='1'?'single only':'full',checks:[],table:[],errors:[]};
const check=(name,pass)=>{assert.ok(pass,name);report.checks.push(name);console.log('PASS '+name);};
(async()=>{
 const settings=JSON.parse(fs.readFileSync(process.env.MDLXL_LAB_SETTINGS||path.join(lab,'lab-profile/settings.json'),'utf8'));
 const {app,page}=await launchApp({out,settings,show:'hide',bounds:{x:0,y:0,width:1400,height:1000},errors:report.errors,args:['--disable-gpu-vsync','--disable-frame-rate-limit','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
 try{
  await page.waitForFunction(()=>!!window.__mdlxl?.document());
  check('five live style buttons exist',await page.locator('.rotation-lab-row button[aria-pressed]').count()===6);
  if(process.env.MDLXL_LAB_BASELINE==='1')return;
  await page.waitForFunction(()=>document.querySelectorAll('.quad-pane').length===4&&findFiberState('.viewport',v=>v?.entries?.length&&v?.controls));
  await page.evaluate(()=>{
   window.labRead=()=>{
    const r=findFiberState('.viewport',v=>v?.entries&&v?.controls),doc=__mdlxl.document();
    const selected=__mdlxl.selection().selection,point=r.controls.target.clone().set(0,0,0);let count=0;
    for(const [gi,ids]of Object.entries(selected))for(const id of ids){const v=r.controls.target.clone().fromArray(doc.model.Geosets[gi].Vertices,id*3);point.add(v);count++;}
    point.multiplyScalar(1/count).project(r.camera);const rect=r.controls.domElement.getBoundingClientRect();
    return {surface:doc.model.Geosets.map(g=>({normals:Array.from(g.Normals||[]),tangents:Array.from(g.Tangents||[])})),vertices:doc.model.Geosets.map(g=>Array.from(g.Vertices)),undo:doc.historyStats.undoSteps,pivot:{x:rect.x+(point.x+1)*rect.width/2,y:rect.y+(1-point.y)*rect.height/2},camera:{position:r.camera.position.toArray(),quaternion:r.camera.quaternion.toArray(),zoom:r.camera.zoom,target:r.controls.target.toArray()},quaternion:r.camera.quaternion.toArray(),target:r.controls.target.toArray(),selected:count,name:doc.name};
   };
  });
  const read=()=>page.evaluate(()=>labRead());
  check('quad starts on, vertices selected and Rotate active',(await read()).selected>0&&await page.locator('[data-hotkey="rotate"][aria-pressed="true"]').count()===1);
  const initialImage=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'));fs.writeFileSync(path.join(out,'startup.png'),Buffer.from(initialImage,'base64'));
  check('owner speed starts active',await page.getByLabel('Your speed / 1×',{exact:true}).innerText()==='Your speed');
  await page.getByLabel('Your speed / 1×',{exact:true}).click();
  const activate=async pane=>{
   await page.keyboard.press('Shift+E');
   if(pane!=='single')await page.locator(`[data-viewport="${pane}"]`).click({position:{x:30,y:35}});
   await page.keyboard.press('Shift+Q');
  };
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const sameCamera=(a,b)=>Math.abs(a.zoom-b.zoom)<1e-10&&["position","quaternion","target"].every(k=>a[k].every((v,i)=>Math.abs(v-b[k][i])<1e-8));
  const waitVertices=async before=>page.waitForFunction(before=>JSON.stringify(__mdlxl.model().Geosets.map(g=>Array.from(g.Vertices)))!==JSON.stringify(before),before);
  const undo=async before=>{await page.keyboard.press('Control+z');await page.waitForFunction(before=>JSON.stringify(__mdlxl.model().Geosets.map(g=>Array.from(g.Vertices)))===JSON.stringify(before),before);};
  const drag=async(style,pane,label,{shift=false,dx=40,dy=0}={})=>{
   await page.getByRole('button',{name:new RegExp('^'+style+' ')}).click();await activate(pane);
   const before=await read(),n=readLog().length,start={x:before.pivot.x+40,y:before.pivot.y-40};
   if(shift)await page.keyboard.down('Shift');
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   await page.mouse.move(start.x+dx,start.y+dy,{steps:12});await page.mouse.up();
   if(shift)await page.keyboard.up('Shift');
   await waitVertices(before.vertices);
   await page.waitForFunction(n=>__mdlxl.document().historyStats.undoSteps>n,before.undo);
   const after=await read();
   check(`${style} ${label}${shift?' Shift':''} changes selected vertices`,!same(before.vertices,after.vertices));
   check(`${style} ${label} keeps camera`,sameCamera(before.camera,after.camera));
   // Measure every selected vertex independently from the committed Euler payload.
   const records=readLog();assert.equal(records.length,n+1,'one local record per drag');const record=records.at(-1);
   assert.equal(record.style,style);assert.equal(record.pane,pane);
   const {Euler,Vector3,Quaternion}=await import('three');const e=new Euler(...record.rotationDegrees.map(d=>d*Math.PI/180),'ZYX');
   if(style==='E'){const cameraQ=new Quaternion(...before.quaternion),up=new Vector3(0,1,0).applyQuaternion(cameraQ),right=new Vector3(1,0,0).applyQuaternion(cameraQ),q=new Quaternion().setFromAxisAngle(up,record.freeDegrees.up*Math.PI/180).multiply(new Quaternion().setFromAxisAngle(right,record.freeDegrees.right*Math.PI/180));assert.ok(Math.abs(new Quaternion().setFromEuler(e).dot(q))>1-1e-10,'Free turn follows actual screen axes');}
   const points=before.vertices.flat(),pivot=[0,0,0];for(let i=0;i<points.length;i++)pivot[i%3]+=points[i]/(points.length/3);
   for(let gi=0;gi<before.vertices.length;gi++)for(let i=0;i<before.vertices[gi].length;i+=3){const v=new Vector3(...before.vertices[gi].slice(i,i+3)).sub(new Vector3(...pivot)).applyEuler(e).add(new Vector3(...pivot));for(let a=0;a<3;a++)assert.ok(Math.abs(v.getComponent(a)-after.vertices[gi][i+a])<.0002,'visible model agrees with logged turn');}
   if(shift){const values=style==='E'?Object.values(record.freeDegrees):record.rotationDegrees.filter(v=>Math.abs(v)>.001);check(`${style} ${label} snaps to 15°`,values.every(v=>Math.abs(v/15-Math.round(v/15))<1e-8));}
   else report.table.push({style,view:label,model:before.name,pixels:record.pixels,degrees:record.freeDegrees??record.rotationDegrees,cameraDirection:record.cameraDirection});
   await undo(before.vertices);check(`${style} ${label} Ctrl+Z restores vertices`,same((await read()).vertices,before.vertices));
   return record;
  };
  const orbit=async pane=>{
   await page.keyboard.press('Shift+E');
   const area=pane==='single'?page.getByLabel('3D model viewport',{exact:true}):page.locator(`[data-viewport="${pane}"]`);
   await area.click({position:pane==='single'?{x:180,y:140}:{x:30,y:35}});const before=await read(),box=await area.boundingBox();
   await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.45+45,box.y+box.height*.45+25,{steps:10});await page.mouse.up();
   await page.waitForFunction(q=>JSON.stringify(labRead().quaternion)!==JSON.stringify(q),before.quaternion);
   check(`${pane} normal mouse camera orbit`,!same((await read()).quaternion,before.quaternion));
   check(`${pane} orbit preserves authored vertices`,same((await read()).vertices,before.vertices));
   await page.keyboard.press('Shift+Q');
  };
  for(const pane of (process.env.MDLXL_LAB_SINGLE_ONLY==='1'?[]:['front','top','side','perspective'])){
   for(const style of ['A','B','C','D','E'])await drag(style,pane,'Quad '+pane);
   for(const style of ['A','B','C','D','E'])await drag(style,pane,'Quad '+pane,{shift:true});
   await orbit(pane);
  }
  await page.getByRole('button',{name:'Quad View',exact:true}).click();
  await page.locator('.quad-pane').first().waitFor({state:'hidden'});
  for(const tilt of [30,60,85]){
   await page.getByLabel('View direction',{exact:true}).selectOption('top');
   await page.keyboard.press('Shift+E');
   for(const [axis,value]of [['X',tilt],['Y',0],['Z',0]]){const field=page.getByLabel(`Camera ${axis} coordinate`,{exact:true});await field.fill(String(value));await field.press('Enter');}
   await page.getByLabel('3D model viewport',{exact:true}).click({position:{x:180,y:140}});
   await page.keyboard.press('Shift+Q');
   for(const style of ['A','B','C','D','E'])await drag(style,'single','Single '+tilt+'°');
   await drag('E','single','Single '+tilt+'° vertical',{dx:0,dy:40});
   if(tilt===85)await drag('E','single','Single 85° diagonal',{dx:40,dy:25,shift:true});
  }
  await orbit('single');
  // Reset is a real document edit and keeps the camera; undo Reset restores the turn.
  await page.getByRole('button',{name:'C Straight drag',exact:true}).click();
  const resetBase=await read(),start={x:resetBase.pivot.x+40,y:resetBase.pivot.y-40};
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+40,start.y,{steps:10});await page.mouse.up();await waitVertices(resetBase.vertices);
  const turned=await read();await page.getByRole('button',{name:'Reset model',exact:true}).click();
  await page.waitForFunction(v=>JSON.stringify(labRead().vertices)===JSON.stringify(v),resetBase.vertices);
  check('Reset restores original vertices and keeps camera',sameCamera((await read()).camera,turned.camera));
  check('Reset restores original normals and tangents',same((await read()).surface,resetBase.surface));
  await undo(turned.vertices);check('Ctrl+Z undoes Reset',same((await read()).vertices,turned.vertices));
  await page.getByRole('button',{name:'Reset model',exact:true}).click();
  await page.waitForFunction(v=>JSON.stringify(labRead().vertices)===JSON.stringify(v),resetBase.vertices);
  await page.getByRole('tab',{name:/Box.mdx/}).click();
  await page.waitForFunction(()=>__mdlxl.document().name==='Box.mdx');
  await drag('E','single','Box single');
  await page.getByLabel('Your speed / 1×',{exact:true}).click();
  const record=await drag('C','single','Your speed');
  const rotation=settings.preferences.rotation,expected=40*(rotation.editors?.vertices?.sensitivity??rotation.sensitivity)*(settings.preferences.pointerSensitivity??1);
  check('Your speed uses copied owner rotation and pointer speeds',Math.abs(Math.hypot(...record.rotationDegrees)-expected)<.0001);
  check('no renderer errors',report.errors.length===0);
  check('all windows stayed hidden',await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible())));
  const image=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'));fs.writeFileSync(path.join(out,'lab.png'),Buffer.from(image,'base64'));
 }catch(error){report.failure=error.stack;throw error;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
