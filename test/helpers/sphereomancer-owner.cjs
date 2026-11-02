const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PROBE_SOURCE}=require('./fiber-probe.cjs');
exports.checkOwnerPopup=async({app,main,popup,source,out,shapeState,ready})=>{
 await popup.evaluate(PROBE_SOURCE);
 const report={checks:[],failures:[],hits:[]};
 const check=async(name,run)=>{try{await run();report.checks.push(name);}catch(error){report.failures.push({name,error:error.message,step:report.numberDragStep});}finally{await popup.mouse.up();await popup.keyboard.up('Shift');await ready();}};
 const overlay=()=>popup.evaluate(()=>{const p=findFiberProps('.ox-collision',p=>p?.stage);return {stage:p.stage,selected:p.selectedId};});
 const at=async(point)=>{const {stage}=await overlay(),r=await popup.locator('.ox-collision').boundingBox();return {x:r.x+point[0]*r.width/stage.width,y:r.y+point[1]*r.height/stage.height};};
 const selectField=async i=>{await popup.getByRole('button',{name:'Advanced',exact:true}).click();await popup.getByLabel('X '+(i+1),{exact:true}).click();await popup.getByRole('button',{name:'Simple',exact:true}).click();};
 const preset=popup.getByLabel('Sphere preset',{exact:true});
 const {openDocument}=await import('../../src/editor-document.js');
 const existing=openDocument(source,'x.mdx').model.CollisionShapes.filter(s=>s.Shape===0||s.Shape===2).map(s=>s.Shape===0?[...s.Vertices]:[...s.Vertices,s.BoundsRadius]);
 await check('authored collision proposal',async()=>assert.deepEqual((await shapeState()).rows,existing,'proposal starts from the model collisions'));
 await preset.selectOption('1');await ready();
 await check('number boxes move their own sphere with Shift and Escape',async()=>{
  const startNumber=async index=>{
   await popup.waitForFunction(()=>{const {rows,size}=oxShapes(),stage=findFiberProps('.ox-collision',p=>p?.stage).stage;return stage.rows.length===rows.length&&stage.rows.every((r,i)=>r.source&&[...r.source.Vertices].every((v,j)=>v===Math.fround(rows[i][j]*size)));});
   const b=await boxes.nth(index).boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   assert.equal(await popup.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[aria-label]')?.getAttribute('aria-label'),{x,y}),'Select collision shape '+(index+1),'drag starts on the intended number');
   return {x,y,before:await overlay()};
  };
  report.numberDragStep='plain click';
  await popup.getByLabel('Sphere size',{exact:true}).fill('1.23');await ready();const boxes=popup.locator('.ox-collision .mm-sphere-select');
  const untouched=await shapeState();await boxes.nth(1).click();assert.deepEqual(await shapeState(),untouched,'a number click selects without changing fractional-size geometry');
  report.numberDragStep='move second number';
  let {x,y,before}=await startNumber(1);
  await popup.mouse.move(x,y);await popup.mouse.down();await popup.mouse.move(x+36,y+8,{steps:10});
  await popup.waitForFunction(x=>Math.abs(findFiberProps('.ox-collision',p=>p?.stage).stage.rows[1].center[0]-x)>5,before.stage.rows[1].center[0],{timeout:1500});
  await popup.mouse.up();await ready();const moved=await shapeState();assert.notDeepEqual(moved.rows[1],untouched.rows[1],'second number moves the second sphere');assert.deepEqual(moved.rows[0],untouched.rows[0],'other sphere stays unchanged');
  report.numberDragStep='Escape from first number';
  ({x,y,before}=await startNumber(0));
  await popup.mouse.move(x,y);await popup.mouse.down();await popup.mouse.move(x+32,y+10,{steps:10});report.numberDragStep='Escape movement';await popup.waitForFunction(x=>Math.abs(findFiberProps('.ox-collision',p=>p?.stage).stage.rows[0].center[0]-x)>5,before.stage.rows[0].center[0]);
  await popup.keyboard.press('Escape');await popup.mouse.up();await ready();assert.deepEqual(await shapeState(),moved,'Escape cancels a drag begun on an unselected number');assert.equal(await popup.locator('.ox-root').count(),1);
  report.numberDragStep='Shift from second number';
  ({x,y,before}=await startNumber(1));
  await popup.keyboard.down('Shift');await popup.mouse.move(x,y);await popup.mouse.down();await popup.mouse.move(x+30,y+4,{steps:8});await popup.waitForFunction(x=>Math.abs(findFiberProps('.ox-collision',p=>p?.stage).stage.rows[1].center[0]-x)>5,before.stage.rows[1].center[0]);
  await popup.mouse.move(x+40,y+34,{steps:8});let current=await overlay();assert.ok(Math.abs(current.stage.rows[1].center[1]-before.stage.rows[1].center[1])<.1,'number Shift drag stays locked');
  report.numberDragStep='release Shift';
  await popup.keyboard.up('Shift');await popup.mouse.move(x+45,y+42,{steps:8});await popup.waitForFunction(y=>Math.abs(findFiberProps('.ox-collision',p=>p?.stage).stage.rows[1].center[1]-y)>3,before.stage.rows[1].center[1]);current=await overlay();assert.ok(Math.abs(current.stage.rows[1].center[1]-before.stage.rows[1].center[1])<12,'release adds only new perpendicular travel');await popup.mouse.up();await ready();report.numberDragStep='done';
 });
 await popup.getByLabel('Sphere size',{exact:true}).fill('1');await preset.selectOption('0');await preset.selectOption('1');await ready();
 await check('Center preserves sphere height and radius',async()=>{
  const before=(await shapeState()).rows[0];await popup.locator('.ox-collision').getByRole('button',{name:'Center',exact:true}).click({timeout:1500});await ready();
  const after=(await shapeState()).rows[0];assert.deepEqual(after,[0,0,before[2],before[3]]);
 });
 await check('Shift Move latches direction and releases without snapping',async()=>{
  const grab=popup.getByRole('slider',{name:'Move collision shape',exact:true}).locator('circle:not(.pe-grab)'),b=await grab.boundingBox(),before=await overlay();
  const x=b.x+b.width/2,y=b.y+b.height/2;await popup.keyboard.down('Shift');await popup.mouse.move(x,y);await popup.mouse.down();await popup.mouse.move(x+35,y+5,{steps:8});
  await popup.waitForFunction(y=>Math.abs(findFiberProps('.ox-collision',p=>p?.stage).stage.rows[0].center[0]-y)>5,before.stage.rows[0].center[0]);
  let current=await overlay();assert.ok(Math.abs(current.stage.rows[0].center[1]-before.stage.rows[0].center[1])<.1,'Shift keeps screen height');
  await popup.mouse.move(x+45,y+35,{steps:8});current=await overlay();assert.ok(Math.abs(current.stage.rows[0].center[1]-before.stage.rows[0].center[1])<.1,'lock stays latched despite perpendicular travel');
  const held=current.stage.rows[0].center[1];await popup.keyboard.up('Shift');await popup.mouse.move(x+50,y+43,{steps:8});
  await popup.waitForFunction(y=>Math.abs(findFiberProps('.ox-collision',p=>p?.stage).stage.rows[0].center[1]-y)>3,held);
  current=await overlay();assert.ok(Math.abs(current.stage.rows[0].center[1]-held)<12,'release adds only new travel');await popup.mouse.up();await ready();
 });
 await preset.selectOption('4');await ready();
 await check('Center preserves box height and dimensions',async()=>{
  await popup.getByRole('button',{name:'Advanced',exact:true}).click();const row=(await shapeState()).rows[0];
  await popup.getByLabel('Min X 1',{exact:true}).fill(String(row[0]+24));await popup.getByLabel('Max X 1',{exact:true}).fill(String(row[3]+24));
  await popup.getByRole('button',{name:'Simple',exact:true}).click();await ready();
  const before=(await shapeState()).rows[0];await popup.locator('.ox-collision').getByRole('button',{name:'Center',exact:true}).click({timeout:1500});await ready();
  const after=(await shapeState()).rows[0];for(let a=0;a<3;a++)assert.ok(Math.abs((after[a+3]-after[a])-(before[a+3]-before[a]))<.00001,'dimensions preserved within Float32 translation roundoff');assert.equal(after[2],before[2]);assert.equal(after[5],before[5]);assert.equal(after[0]+after[3],0);assert.equal(after[1]+after[4],0);
 });
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
