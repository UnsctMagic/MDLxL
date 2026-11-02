const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PROBE_SOURCE}=require('./fiber-probe.cjs');
exports.checkOwnerPopup=async({app,main,popup,source,out,shapeState,ready})=>{
 await popup.evaluate(PROBE_SOURCE);
 const report={checks:[],failures:[],hits:[]};
 const check=async(name,run)=>{try{await run();report.checks.push(name);}catch(error){report.failures.push({name,error:error.message});}finally{await popup.mouse.up();await ready();}};
 const overlay=()=>popup.evaluate(()=>{const p=findFiberProps('.ox-collision',p=>p?.stage);return {stage:p.stage,selected:p.selectedId};});
 const at=async(point)=>{const {stage}=await overlay(),r=await popup.locator('.ox-collision').boundingBox();return {x:r.x+point[0]*r.width/stage.width,y:r.y+point[1]*r.height/stage.height};};
 const selectField=async i=>{await popup.getByRole('button',{name:'Advanced',exact:true}).click();await popup.getByLabel('X '+(i+1),{exact:true}).click();await popup.getByRole('button',{name:'Simple',exact:true}).click();};
 const preset=popup.getByLabel('Sphere preset',{exact:true});
 const {openDocument}=await import('../../src/editor-document.js');
 const existing=openDocument(source,'x.mdx').model.CollisionShapes.filter(s=>s.Shape===0||s.Shape===2).map(s=>s.Shape===0?[...s.Vertices]:[...s.Vertices,s.BoundsRadius]);
 await check('authored collision proposal',async()=>assert.deepEqual((await shapeState()).rows,existing,'proposal starts from the model collisions'));
 await preset.selectOption('1');await ready();
 await check('right-side boxes select every sphere',async()=>{
  const boxes=popup.locator('.ox-collision .mm-sphere-select');await boxes.first().waitFor({timeout:1500});assert.equal(await boxes.count(),2);
  for(const i of [1,0]){await boxes.nth(i).click();await popup.waitForFunction(id=>findFiberProps('.ox-collision',p=>p?.stage)?.selectedId===id,-1-i);assert.equal(await boxes.nth(i).getAttribute('aria-pressed'),'true');}
 });
 await check('second shape center selection',async()=>{const {stage}=await overlay(),p=await at(stage.rows[1].center);await popup.mouse.click(p.x,p.y);await popup.waitForFunction(()=>findFiberProps('.ox-collision',p=>p?.stage)?.selectedId===-2,null,{timeout:1000});});
 await selectField(1);
 await check('wide outline selection',async()=>{const {stage}=await overlay(),row=stage.rows[0],edge=row.outlines[0][32],d=Math.hypot(edge[0]-row.center[0],edge[1]-row.center[1]);const p=await at([edge[0]+6*(edge[0]-row.center[0])/d,edge[1]+6*(edge[1]-row.center[1])/d]);await popup.mouse.click(p.x,p.y);await popup.waitForFunction(()=>findFiberProps('.ox-collision',p=>p?.stage)?.selectedId===-1,null,{timeout:1000});});
 await selectField(0);
 // Focus emulation is session-scoped: a second CDP session cannot clear
 // Playwright's original override. Change that session's environment only.
 const mainCDP=main._connection.toImpl(main).delegate._mainFrameSession._client;
 await mainCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 // The covered parent is explicitly hidden as well, so the inactive-desktop
 // compositor cannot accidentally keep its frame clock running for the test.
 await app.evaluate(({BrowserWindow})=>{const child=BrowserWindow.getAllWindows().find(w=>w.getParentWindow()),parent=child.getParentWindow();parent.minimize();child.show();child.maximize();});
 report.background=await app.evaluate(({app,BrowserWindow})=>({flags:['disable-background-timer-throttling','disable-backgrounding-occluded-windows','disable-renderer-backgrounding'].map(k=>[k,app.commandLine.hasSwitch(k)]),windows:BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),minimized:w.isMinimized(),parent:!!w.getParentWindow()}))}));
 await check('main frame clock is actually backgrounded',async()=>{await main.waitForFunction(()=>document.hidden,null,{timeout:2000,polling:100});});
 for(const kind of ['Move collision shape','Resize sphere radius'])await check(kind+' live with covered main',async()=>{
  const control=popup.getByRole('slider',{name:kind,exact:true}),circle=control.locator('circle:not(.pe-grab)'),box=await circle.boundingBox();
  const before=await popup.locator('.ox-collision .mm-outline').first().getAttribute('points');
  await popup.mouse.move(box.x+box.width/2,box.y+box.height/2);await popup.mouse.down();await popup.mouse.move(box.x+box.width/2+45,box.y+box.height/2,{steps:12});
  await popup.waitForFunction(before=>document.querySelector('.ox-collision .mm-outline')?.getAttribute('points')!==before,before,{timeout:1000});
  assert.equal(await popup.evaluate(()=>window.__ownerPointerDown),true,'outline changes before pointer release');
 });
 await check('overlapping outline cannot swallow trash',async()=>{
  await preset.selectOption('1');await ready();await selectField(0);
  const button=popup.locator('.ox-collision').getByRole('button',{name:'Remove collision shape',exact:true}),b=await button.boundingBox();
  const target={x:b.x+b.width/2,y:b.y+b.height/2};
  await selectField(1);
  const {stage}=await overlay(),row=stage.rows[1],edge=await at(row.outlines[0][0]);
  const grab=popup.getByRole('slider',{name:'Move collision shape',exact:true}).locator('circle:not(.pe-grab)'),r=await grab.boundingBox();
  await popup.mouse.move(r.x+r.width/2,r.y+r.height/2);await popup.mouse.down();await popup.mouse.move(r.x+r.width/2+target.x-edge.x,r.y+r.height/2+target.y-edge.y,{steps:12});await popup.mouse.up();await ready();
  await selectField(0);
  const box=await button.boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2};
  report.overlapHit=await popup.evaluate(({x,y})=>document.elementFromPoint(x,y)?.outerHTML.slice(0,300),point);
  await popup.mouse.click(point.x,point.y);
  await popup.waitForFunction(()=>oxShapes().rows.length===1,null,{timeout:1500});
 });
 await check('trash deletes every shape in maximized popup',async()=>{
  for(const value of ['3','1']){
   await preset.selectOption(value);await ready();
   while((await shapeState()).rows.length){const n=(await shapeState()).rows.length,i=n>1?1:0;await selectField(i);
    const button=popup.locator('.ox-collision').getByRole('button',{name:'Remove collision shape',exact:true}),r=await button.boundingBox();
    report.hits.push(await popup.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return {x,y,tag:e?.tagName,html:e?.outerHTML.slice(0,350)};},{x:r.x+r.width/2,y:r.y+r.height/2}));
    await button.click({timeout:2000});await popup.waitForFunction(n=>oxShapes().rows.length===n-1,n,{timeout:1500});await ready();
   }
  }
 });

 report.windows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({title:w.getTitle(),maximized:w.isMaximized(),throttled:w.webContents.getBackgroundThrottling(),bounds:w.getBounds()})));
 fs.writeFileSync(path.join(out,'owner-popup.json'),JSON.stringify(report,null,2));
 await mainCDP.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await app.evaluate(({BrowserWindow})=>{const child=BrowserWindow.getAllWindows().find(w=>w.getParentWindow());child.getParentWindow().restore();child.getParentWindow().showInactive();child.show();child.maximize();});
 assert.deepEqual(report.failures,[],'owner popup regression checks');
 await preset.selectOption('1');await ready();
};
