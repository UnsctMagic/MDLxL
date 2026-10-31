const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
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
  await page.getByRole('button',{name:'Managers',exact:true}).click();
  await page.getByRole('navigation',{name:'Resource managers'}).getByRole('button',{name:'Model',exact:true}).click();
  await page.locator('.mm-handle').first().waitFor();
  await page.evaluate(()=> { const props = findFiberProps('.model-manager', props => props?.doc); if (props) {window.managerDoc=props.doc;}
   });
  const list=page.getByRole('listbox',{name:'Model collision shapes'});
  for(const [name,count] of [['Box',3],['Sphere',1],['Plane',0],['Cylinder',0]]){
   await list.getByRole('option',{name,exact:true}).click();
   assert.equal(await page.locator('.mm-size input[type=range]').count(),count,name+' has only supported size controls');
   assert.equal(await page.getByRole('button',{name:'Remove collision shape',exact:true}).isEnabled(),true);
  }
  await list.getByRole('option',{name:'Box',exact:true}).click();
  const before=await page.evaluate(()=>({vertices:[...managerDoc.model.CollisionShapes[0].Vertices],undo:managerDoc.historyStats.undoSteps}));
  const handle=page.getByLabel('Resize Z positive',{exact:true}),at=await handle.boundingBox();
  const height=await page.getByLabel('Height',{exact:true}).inputValue();
  await page.mouse.move(at.x+5,at.y+5);await page.mouse.down();await page.mouse.move(at.x+5,at.y-35,{steps:8});
  // Live drags update once per frame; wait for that frame instead of the same tick.
  await page.waitForFunction(before=>document.querySelector('input[aria-label="Height"]')?.value!==before,height,{timeout:2000}).catch(()=>{});
  assert.notEqual(await page.getByLabel('Height',{exact:true}).inputValue(),height,'the drag creates a live draft');
  await page.getByLabel('Collision view',{exact:true}).selectOption('top');
  await handle.waitFor({state:'detached'});await page.mouse.up();
  await list.getByRole('option',{name:'Sphere',exact:true}).click();
  const after=await page.evaluate(()=>({vertices:[...managerDoc.model.CollisionShapes[0].Vertices],undo:managerDoc.historyStats.undoSteps}));
  assert.deepEqual(after,before,'selecting another shape cannot commit the vanished-handle draft');
  await page.getByLabel('Collision view',{exact:true}).selectOption('perspective');
  const canvas=page.locator('.mm-stage canvas[data-clean-model-canvas]'),box=await canvas.boundingBox(),picture=await canvas.screenshot();
  await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width*.4,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.7,{steps:12});await page.mouse.up();await page.keyboard.up('Alt');await settlePage(page, 150);
  assert(!picture.equals(await canvas.screenshot()),'normal mouse input rotates the manager preview');
  assert.deepEqual(errors,[]);
  console.log('PASS packaged manager: sphere/box-only sliders, disappearing-handle cancellation, no stale commit, normal mouse rotation');
 }finally{
  if(app){await closeApp(app).catch(()=>{});}
  if(path.dirname(run)!==output)throw Error('Unexpected test directory');fs.rmSync(run,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
