const { launchApp, closeApp, clickMenu, settle: settlePage } = require('./helpers/app.cjs');
// Generated fixture, real packaged manager controls; run with test:packaged (hidden desktop).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const output=path.join(root,'out/model-manager-regressions');fs.mkdirSync(output,{recursive:true});
 const run=fs.mkdtempSync(path.join(output,'run-'));let app;
 try{
  const {createStarterDocument}=await import('../src/starter-model.js');
  const {createNode}=await import('../src/editor-document.js');
  const doc=createStarterDocument();
  doc.apply('Collision fixture',['CollisionShapes','Nodes','PivotPoints'],m=>{
   for(const [type,name] of [[0,'Box'],[2,'Sphere'],[1,'Plane'],[3,'Cylinder']]){
    const node=createNode(m,'CollisionShape');Object.assign(node,{Name:name,Shape:type,Vertices:new Float32Array(type===2?[0,0,0]:[-32,-32,-32,32,32,32]),BoundsRadius:type===2||type===3?32:0});
   }
  });
  const file=path.join(run,'Collisions.mdx');fs.writeFileSync(file,doc.serialize('mdx'));
  const exe=path.join(process.env.MDLXL_SUITE_PKG||path.join(root,'out/pkg/MDLxL-win32-x64'),'MDLxL.exe');
  app=(await launchApp({ out: run, profile: path.join(run,'profile'), env: { MDLVIS_HEADLESS:'' }, timeout: 30000, fixture: file })).app;
  const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.unmaximize();w.setContentSize(1300,900);});
  await clickMenu(app, 'Material Manager…');
  await page.getByRole('navigation',{name:'Resource managers'}).getByRole('button',{name:'Model',exact:true}).click();
  await page.locator('.mm-handle').first().waitFor();
  await page.evaluate(()=> { const props = findFiberProps('.model-manager', props => props?.doc); if (props) {window.managerDoc=props.doc;}
   });
  const list=page.getByRole('listbox',{name:'Model collision shapes'});
  for(const [name,count] of [['Box',3],['Sphere',1],['Plane',0],['Cylinder',0]]){
   await list.getByRole('option',{name,exact:true}).click();
   assert.equal(await page.locator('.mm-size input[type=range]').count(),count,name+' has only supported size controls');
   assert.equal(await page.locator('.mm-properties').getByRole('button',{name:'Remove collision shape',exact:true}).isEnabled(),true);
  }
  await list.getByRole('option',{name:'Box',exact:true}).click();
  const view=page.getByLabel('Collision view',{exact:true});
  await view.selectOption('top');
  const handle=page.getByLabel('Resize X positive',{exact:true});
  await page.getByLabel('Resize Z positive',{exact:true}).waitFor({state:'detached'});
  await handle.waitFor();
  const width=await page.getByLabel('Width',{exact:true}).inputValue();
  const at=await handle.locator('circle:not(.pe-grab)').boundingBox();
  await page.mouse.move(at.x+7,at.y+7);await page.mouse.down();await page.mouse.move(at.x+7,at.y+47,{steps:8});
  await page.waitForFunction(before=>document.querySelector('input[aria-label="Width"]')?.value!==before,width);
  assert.notEqual(await page.getByLabel('Width',{exact:true}).inputValue(),width,'Top width creates a visible live draft');
  await page.mouse.up();
  const committed=await page.evaluate(()=>managerDoc.model.CollisionShapes[0].Vertices[3]-managerDoc.model.CollisionShapes[0].Vertices[0]);
  assert.notEqual(committed,64,'Top width drag commits');
  const move=page.getByRole('slider',{name:'Move collision shape',exact:true}).locator('circle:not(.pe-grab)'),mb=await move.boundingBox();
  await page.mouse.move(mb.x+mb.width/2,mb.y+mb.height/2);await page.mouse.down();await page.mouse.move(mb.x+mb.width/2+30,mb.y+mb.height/2+15,{steps:10});await page.mouse.up();
  const offset=await page.evaluate(()=>[...managerDoc.model.CollisionShapes[0].Vertices]);
  const center=v=>[0,1,2].map(a=>(v[a]+v[a+3])/2);
  assert.ok(Math.hypot(...center(offset).slice(0,2))>1,'box moves off the model axis');
  await page.locator('.mm-overlay').getByRole('button',{name:'Center',exact:true}).click();
  await page.waitForFunction(()=>{const v=managerDoc.model.CollisionShapes[0].Vertices;return Math.abs(v[0]+v[3])<.00001&&Math.abs(v[1]+v[4])<.00001;});
  const centered=await page.evaluate(()=>[...managerDoc.model.CollisionShapes[0].Vertices]);assert.equal(center(centered)[2],center(offset)[2]);
  for(let a=0;a<3;a++)assert.ok(Math.abs((centered[a+3]-centered[a])-(offset[a+3]-offset[a]))<.00001,'Center preserves dimensions');
  await page.keyboard.press('Control+z');await page.waitForFunction(v=>JSON.stringify([...managerDoc.model.CollisionShapes[0].Vertices])===JSON.stringify(v),offset);
  await page.keyboard.press('Control+y');await page.waitForFunction(v=>JSON.stringify([...managerDoc.model.CollisionShapes[0].Vertices])===JSON.stringify(v),centered);
  // Keep the grabbed circle and its starting mapping even if the new view hides its axis.
  const next=await handle.locator('circle:not(.pe-grab)').boundingBox();
  await page.mouse.move(next.x+7,next.y+7);await page.mouse.down();await page.mouse.move(next.x+7,next.y+27,{steps:8});
  const draft=await page.getByLabel('Width',{exact:true}).inputValue();
  await view.selectOption('front');
  await page.waitForFunction(()=>findFiberProps('svg.mm-overlay',props=>props?.stage)?.stage.rows[0]?.handles.some(handle=>handle.axis===2));
  await handle.waitFor();
  await page.mouse.move(next.x+7,next.y+67,{steps:8});
  await page.waitForFunction(before=>document.querySelector('input[aria-label="Width"]')?.value!==before,draft);
  assert.notEqual(await page.getByLabel('Width',{exact:true}).inputValue(),draft,'drag continues after its axis loses projection');
  const finalDraft=await page.getByLabel('Width',{exact:true}).inputValue();
  await page.mouse.up();await handle.waitFor({state:'detached'});
  const after=await page.evaluate(()=>managerDoc.model.CollisionShapes[0].Vertices[3]-managerDoc.model.CollisionShapes[0].Vertices[0]);
  assert.ok(after>committed,'latched drag commits the full width change');
  assert.ok(Math.abs(after-Number(finalDraft))<.02,'release commits the final live draft');
  await list.getByRole('option',{name:'Sphere',exact:true}).click();
  await page.getByLabel('Collision view',{exact:true}).selectOption('perspective');
  const canvas=page.locator('.mm-stage canvas[data-clean-model-canvas]'),box=await canvas.boundingBox(),picture=await canvas.screenshot();
  await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width*.4,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.7,{steps:12});await page.mouse.up();await page.keyboard.up('Alt');await settlePage(page, 150);
  assert(!picture.equals(await canvas.screenshot()),'normal mouse input rotates the manager preview');
  assert.deepEqual(errors,[]);
  console.log('PASS packaged manager: sphere/box-only sliders, Center with Undo/Redo, Top width resize, latched drag across view changes, normal mouse rotation');
 }finally{
  if(app){await closeApp(app).catch(()=>{});}
  if(path.dirname(run)!==output)throw Error('Unexpected test directory');fs.rmSync(run,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
