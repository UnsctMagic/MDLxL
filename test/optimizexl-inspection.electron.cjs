const { testModel } = require('./helpers/fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp, settle: waitForSettle } = require('./helpers/app.cjs');

(async()=>{
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','optimizexl-inspection-proof');fs.mkdirSync(out,{recursive:true});
 const model=process.env.MDLXL_OPTIMIZEXL_MODEL||testModel('optimizexl/WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx');
 const source=fs.readFileSync(model),packaged=appTarget().packaged;
 const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: model, out });
 try{
  const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;
  await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1440, height: 900 }, errors, pageTimeout: 15000 });
  // OptimizeXL opens on the Insanity FIxer; this review starts at Duplicate data.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Duplicate data',exact:true}).click();
  const animation=p.getByLabel('Animation',{exact:true}),frame=p.getByLabel('Animation frame',{exact:true});
  await animation.selectOption({label:'Stand'});await frame.fill('2000');await p.getByLabel('Playback speed (%)',{exact:true}).fill('50');
  await p.getByRole('checkbox',{name:'Loop',exact:true}).uncheck();
  await p.waitForFunction(()=>document.querySelectorAll('.ox-preview canvas:not([data-background])').length>=2);
  await p.evaluate(()=>{window.inspectState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{const { runtime: r } = mdlxlProbe(root);if(r)return {sequence:r.native.getSequence(),frame:r.native.getFrame(),position:r.controls.object.position.toArray(),target:r.controls.target.toArray(),zoom:r.controls.object.zoom};return null;});});
  await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===1&&s.frame===2000));
  const box=await p.getByLabel('Before preview',{exact:true}).boundingBox();await p.mouse.move(box.x+200,box.y+230);await p.mouse.down();await p.mouse.move(box.x+230,box.y+240,{steps:6});await p.mouse.up();await p.mouse.wheel(0,-200);await waitForSettle(p, 150);
  const camera=(await p.evaluate(()=>inspectState()))[0];
  const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));
  const inspect=async(id='decay:37')=>{await p.getByRole('button',{name:'Irregularities Fixer',exact:true}).click();await p.getByLabel('Proposed fix',{exact:true}).selectOption(id);await ready();};
  const restored=async()=>{
   assert.equal(await animation.inputValue(),'1','Leaving a finding must restore the previous whole-model animation');assert.equal(await frame.inputValue(),'2000','Restore the previous frame, not the sequence start');
   await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===1&&s.frame===2000));
   for(const state of await p.evaluate(()=>inspectState()))for(const key of ['position','target','zoom']){
    const actual=[state[key]].flat(),expected=[camera[key]].flat();assert.equal(actual.length,expected.length);
    actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-8,'Keep the paired camera while leaving inspection'));
   }
   assert.equal(await p.getByLabel('Playback speed (%)',{exact:true}).inputValue(),'50');assert.equal(await p.getByRole('checkbox',{name:'Loop',exact:true}).isChecked(),false);
  };
  await ready();await p.screenshot({path:path.join(out,'01-normal.png')});
  for(const name of ['Duplicate data','Animation optimization','Unused data','Insanity FIxer','Sphereomancer','Nuclear Polygon Destroyer']){
   await inspect();await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===10));
   if(name==='Duplicate data')await p.screenshot({path:path.join(out,'02-decay-inspection.png')});
   await p.getByRole('button',{name,exact:true}).click();await p.screenshot({path:path.join(out,'03-returned.png')});await restored();
  }
  // Changing findings must keep the original return point, not the last finding.
  await inspect();await p.getByLabel('Proposed fix',{exact:true}).selectOption('visibility:45:13');await ready();await p.getByRole('button',{name:'Next stage',exact:true}).click();await restored();
  // Clearing finishes inspection. Skip/Approve inspect the next finding;
  // leaving that queue still restores the original return point.
  await inspect();await p.getByLabel('Proposed fix',{exact:true}).selectOption('');await restored();
  await inspect('decay:38');await p.getByRole('button',{name:'Skip fix',exact:true}).click();assert.notEqual(await p.getByLabel('Proposed fix',{exact:true}).inputValue(),'decay:38');await p.getByRole('button',{name:'Duplicate data',exact:true}).click();await restored();
  await inspect();await p.getByRole('button',{name:'Approve',exact:true}).click();assert.notEqual(await p.getByLabel('Proposed fix',{exact:true}).inputValue(),'decay:37');await p.getByRole('button',{name:'Duplicate data',exact:true}).click();await restored();
  // Back reopens the undone finding, then leaving it restores normal playback.
  await p.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await p.getByLabel('Proposed fix',{exact:true}).inputValue(),'decay:37');await p.waitForFunction(()=>inspectState().every(s=>s?.sequence===10));
  await p.getByRole('button',{name:'Duplicate data',exact:true}).click();await restored();
  // Ordinary stage changes must retain an animation the user chose deliberately.
  await animation.selectOption({label:'Decay Bone'});await frame.fill('180000');await p.getByRole('button',{name:'Unused data',exact:true}).click();assert.equal(await animation.inputValue(),'10');assert.equal(await frame.inputValue(),'180000');
  await animation.selectOption({label:'Stand'});await frame.fill('2000');await restored();await ready();
  assert.match(await p.locator('footer').textContent(),/Total saved: 0.00 KB/);await p.screenshot({path:path.join(out,'04-restored-final.png')});
  assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!packaged,errors,sourceUnchanged:true,stageExits:6,restoredSequence:'Stand',restoredFrame:2000},null,2));
 }finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
