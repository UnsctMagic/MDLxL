const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp, settle: waitForSettle } = require('./helpers/app.cjs');

(async()=>{
 const model=process.env.MDLXL_FOOTMAN_MODEL||'C:/Users/PC/Downloads/Footman (Unoptimized).mdx',source=fs.readFileSync(model);
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','motion-ui');fs.mkdirSync(out,{recursive:true});
 const exe=appTarget().packaged;
 const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: model, out });
 try{
  const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;
  await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 20000 });
  // OptimizeXL opens on the Insanity FIxer; this review starts at Duplicate data.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Duplicate data',exact:true}).click();
  const stage=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true}).click();
  const stagesReady=()=>p.locator('nav[aria-label="Optimization stages"][aria-busy="false"]').waitFor();
  const noStar=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true}).locator('.ox-stage-star').count();
  await stagesReady();assert.equal(await noStar('Sphereomancer'),0,'Valid existing spheres need no star before the stage is visited');
  await stage('Irregularities Fixer');
  const select=p.getByLabel('Proposed fix',{exact:true}),warning='Stand - 1: irregular movement (Bone_Root)';
  assert.ok((await select.locator('option').allTextContents()).includes(warning));
  assert.equal(await p.getByText(/Replace the affected translation only/).count(),0,'No repair details until selected');
  await select.selectOption({label:warning});await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
  assert.equal(await p.getByLabel('Animation',{exact:true}).inputValue(),'0');assert.equal(await p.getByLabel('Animation frame',{exact:true}).inputValue(),'167');
  assert.match(await p.locator('.ox-controls').textContent(),/Remove curve bouncing and keyed jitter from Stand - 1 \(whole body\)/);
  assert.equal(await p.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true);
  const frame=p.getByLabel('Animation frame',{exact:true});await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(()=>Number(document.querySelector('[aria-label="Animation frame"]').value)>250);await p.getByRole('button',{name:'Pause',exact:true}).click();
  await p.evaluate(()=>{window.sides=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{const { props } = mdlxlProbe(root); return props;});});
  const originalModel=await p.evaluate(()=>JSON.stringify(sides()[0].model)),originalHeader=await p.locator('[aria-label="Before preview"] h2').textContent();
  assert.match(originalHeader,/Original · 280.78 KB/);
  const originalUnchanged=async()=>{assert.equal(await p.evaluate(()=>JSON.stringify(sides()[0].model)),originalModel);assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),originalHeader);};
  const state=await p.evaluate(()=>{const [a,b]=sides(),root=s=>s.model.Nodes.find(n=>n?.Name==='Bone_Root').Translation;return {sameModel:a.model===b.model,timeA:a.time,timeB:b.time,posesA:root(a).Keys.map(k=>[k.Frame,...k.Vector]),posesB:root(b).Keys.map(k=>[k.Frame,...k.Vector]),controlsChanged:JSON.stringify(root(a))!==JSON.stringify(root(b))};});assert.equal(state.sameModel,false);assert.equal(state.timeA,state.timeB);assert.deepEqual(state.posesA.filter((v,i)=>JSON.stringify(v)!==JSON.stringify(state.posesB[i])).map(v=>v[0]),[833,1033,1067]);assert.equal(state.controlsChanged,true);
  await frame.fill('1067');await waitForSettle(p, 100);await p.screenshot({path:path.join(out,'motion-repair.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o=>o.textContent==='Stand - 1: irregular movement (Bone_Root)'));assert.equal(await p.getByRole('button',{name:'Back',exact:true}).isEnabled(),true);
  await originalUnchanged();assert.notEqual(await p.evaluate(()=>JSON.stringify(sides()[1].model)),originalModel);
  await p.getByRole('button',{name:'Back',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));assert.ok((await select.locator('option').allTextContents()).includes(warning));assert.equal(await select.inputValue(),'motion:0:25:Translation');
  await originalUnchanged();
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o=>o.textContent==='Stand - 1: irregular movement (Bone_Root)'));
  await stage('Animation optimization');await p.getByLabel('Strength',{exact:true}).fill('100');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();
  await originalUnchanged();
  await p.getByLabel('Proposed fix',{exact:true}).selectOption('invalidBounds');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();await p.getByText('No mdx-m3-viewer issues found. Choose Next stage to review movement irregularities.',{exact:true}).waitFor();assert.equal(await p.getByLabel('Proposed fix',{exact:true}).count(),0);assert.equal(await p.getByText(/remain for manual editing/).count(),0);await p.screenshot({path:path.join(out,'sanity-clean.png')});
  await originalUnchanged();await stagesReady();assert.equal(await noStar('Insanity FIxer'),0);assert.equal(await noStar('Sphereomancer'),0);assert.equal(await noStar('Unused data'),0);
  await stage('Duplicate data');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));assert.equal(await p.getByText('Review only — no correction proposed.',{exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true);
  await originalUnchanged();assert.match(await p.locator('.ox-savings span').textContent(),/^280.78 KB → /);
  assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,warning,sequenceSelected:0,frameSelected:167,repairPreviewAndApproval:true,backRestoresCurve:true,removedBadKeyPoses:[833,1033,1067],cleanSanityExplained:true,originalPreviewAndSizeStayPinned:true,starsRequireActualWork:true,playbackSynchronized:true,sourceUnchanged:true,errors},null,2));console.log('Passed OptimizeXL motion repair, pinned original preview/size, actual-work stars, approval, Back and source preservation.');
 }finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
