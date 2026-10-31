const { testModel } = require('./helpers/fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp, settle: waitForSettle } = require('./helpers/app.cjs');

(async()=>{
 // Fixture: the owner's WH_WOC_WarriorNurgle_Flail12_Optimized.mdx (Downloads, copied to out/optimizexl-motion). No LowPolyWorks
 // model combines a repairable irregular movement with an Insanity FIxer whose only repair is invalid bounds, and no available
 // model (LowPolyWorks, Downloads, SD MDX800; out/fixture-scan/scan.mjs) has a whole-body irregular movement in Stand like the
 // original Footman, so the "(whole body)" wording is not coverable; the repair, preview, approval, Back and pinning are.
 // Measured with out/fixture-scan/motion.mjs and sim.mjs on prepareOptimizeXL bytes (findIrregularities, runOptimizeStage with
 // the single fix, test/helpers/hive.mjs sanityTest): 123.74 KB; finding motion:4:21:Rotation "Death: irregular movement
 // (Flail_Head)" in sequence 4 (Death, 34333-37667) at frame 34855, detail "Remove keyed jitter from Death. Replace the affected
 // rotation only; ..."; its preview changes exactly the Flail_Head Rotation key at 34856. Insanity FIxer: 0 errors / 0 severe /
 // 26 warnings / 0 notices, all repaired by the one invalidBounds proposal. Existing collision spheres equal the Standard preset
 // (out/fixture-scan/spheres.mjs), so they are valid. Playback must pass frame 34938, 83 frames after the finding, as 250 was
 // 83 after 167 in the original.
 const KB='123.74 KB',warning='Death: irregular movement (Flail_Head)',ID='motion:4:21:Rotation',SEQUENCE='4',FRAME='34855',NODE='Flail_Head',PROPERTY='Rotation',CHANGED=[34856],PLAYED=34938;
 const model=process.env.MDLXL_FOOTMAN_MODEL||testModel('optimizexl-motion/WH_WOC_WarriorNurgle_Flail12_Optimized.mdx'),source=fs.readFileSync(model);
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
  const select=p.getByLabel('Proposed fix',{exact:true});
  assert.ok((await select.locator('option').allTextContents()).includes(warning));
  assert.equal(await p.getByText(/Replace the affected translation only/).count(),0,'No repair details until selected');
  await select.selectOption({label:warning});await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
  assert.equal(await p.getByLabel('Animation',{exact:true}).inputValue(),SEQUENCE);assert.equal(await p.getByLabel('Animation frame',{exact:true}).inputValue(),FRAME);
  assert.match(await p.locator('.ox-controls').textContent(),/Remove keyed jitter from Death\. Replace the affected rotation only/);
  assert.equal(await p.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true);
  const frame=p.getByLabel('Animation frame',{exact:true});await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(played=>Number(document.querySelector('[aria-label="Animation frame"]').value)>played,PLAYED);await p.getByRole('button',{name:'Pause',exact:true}).click();
  await p.evaluate(()=>{window.sides=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{const { props } = mdlxlProbe(root); return props;});});
  const originalModel=await p.evaluate(()=>JSON.stringify(sides()[0].model)),originalHeader=await p.locator('[aria-label="Before preview"] h2').textContent();
  assert.ok(originalHeader.includes('Original · '+KB));
  const originalUnchanged=async()=>{assert.equal(await p.evaluate(()=>JSON.stringify(sides()[0].model)),originalModel);assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),originalHeader);};
  const state=await p.evaluate(({NODE,PROPERTY})=>{const [a,b]=sides(),root=s=>s.model.Nodes.find(n=>n?.Name===NODE)[PROPERTY];return {sameModel:a.model===b.model,timeA:a.time,timeB:b.time,posesA:root(a).Keys.map(k=>[k.Frame,...k.Vector]),posesB:root(b).Keys.map(k=>[k.Frame,...k.Vector]),controlsChanged:JSON.stringify(root(a))!==JSON.stringify(root(b))};},{NODE,PROPERTY});assert.equal(state.sameModel,false);assert.equal(state.timeA,state.timeB);assert.deepEqual(state.posesA.filter((v,i)=>JSON.stringify(v)!==JSON.stringify(state.posesB[i])).map(v=>v[0]),CHANGED);assert.equal(state.controlsChanged,true);
  await frame.fill(String(CHANGED.at(-1)));await waitForSettle(p, 100);await p.screenshot({path:path.join(out,'motion-repair.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(warning=>!Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o=>o.textContent===warning),warning);assert.equal(await p.getByRole('button',{name:'Back',exact:true}).isEnabled(),true);
  await originalUnchanged();assert.notEqual(await p.evaluate(()=>JSON.stringify(sides()[1].model)),originalModel);
  await p.getByRole('button',{name:'Back',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));assert.ok((await select.locator('option').allTextContents()).includes(warning));assert.equal(await select.inputValue(),ID);
  await originalUnchanged();
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(warning=>!Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o=>o.textContent===warning),warning);
  await stage('Animation optimization');await p.getByLabel('Strength',{exact:true}).fill('100');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();
  await originalUnchanged();
  // Since 3a5c89a4 the Insanity FIxer is the first stage, so approving Unused data moves on to the Irregularities Fixer; the
  // user opens the Insanity FIxer from the stage list. Its clean message changed then to "...Choose Next stage to continue."
  await stage('Insanity FIxer');await p.getByLabel('Proposed fix',{exact:true}).selectOption('invalidBounds');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();await p.getByText('No mdx-m3-viewer issues found. Choose Next stage to continue.',{exact:true}).waitFor();assert.equal(await p.getByLabel('Proposed fix',{exact:true}).count(),0);assert.equal(await p.getByText(/remain for manual editing/).count(),0);await p.screenshot({path:path.join(out,'sanity-clean.png')});
  await originalUnchanged();await stagesReady();assert.equal(await noStar('Insanity FIxer'),0);assert.equal(await noStar('Sphereomancer'),0);assert.equal(await noStar('Unused data'),0);
  await stage('Duplicate data');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));assert.equal(await p.getByText('Review only — no correction proposed.',{exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'Approve',exact:true}).isEnabled(),true);
  await originalUnchanged();assert.ok((await p.locator('.ox-savings span').textContent()).startsWith(KB+' → '));
  assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,warning,sequenceSelected:Number(SEQUENCE),frameSelected:Number(FRAME),repairPreviewAndApproval:true,backRestoresCurve:true,removedBadKeyPoses:CHANGED,cleanSanityExplained:true,originalPreviewAndSizeStayPinned:true,starsRequireActualWork:true,playbackSynchronized:true,sourceUnchanged:true,errors},null,2));console.log('Passed OptimizeXL motion repair, pinned original preview/size, actual-work stars, approval, Back and source preservation.');
 }finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
