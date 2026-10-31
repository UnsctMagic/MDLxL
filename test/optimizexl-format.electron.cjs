const { testModel } = require('./helpers/fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp, stubDialogs } = require('./helpers/app.cjs');

(async()=>{
  // Fixture: LowPolyWorks herrdave KnightOfTheBlazingSun.mdx (out/optimizexl-format, docs/PACKAGED-TESTS.md): its Visibility
  // track has a non-None interpolation (the format quirk, kind visibilityInterpolation) and sequence 8 is a Portrait with a
  // particle emitter. Measured with out/fixture-scan/sim.mjs (SIM_RAW=1 and prepared bytes; test/helpers/hive.mjs sanityTest,
  // sanityProposals, one select-all batch through runOptimizeStage): 0 errors / 0 severe / 1 warnings / 784 notices before;
  // 172 automatic proposals (the visibility repair plus 171 redundant-key repairs) and 72 inspection-only ones; after that
  // batch 0 errors / 0 severe / 0 warnings / 267 notices. Sequences: 7 Decay Flesh, 8 Portrait (11 in all).
  // The exact-pose checks below prove that format repairs keep every pose. Redundant-key repairs are approximate by design
  // (mdx-m3-viewer: "roughly the same value"; a select-all preview moved node matrices by about 2e-4), so after checking the
  // Select all counts the user clears the list and checks only the format repair, the one this fixture has:
  // "BlizPart_RidingDust: constant visibility interpolation" (out/fixture-scan/one-fix.mjs: its approval alone gives
  // 0 errors / 0 severe / 0 warnings / 784 notices).
  // No LowPolyWorks, Downloads or SD MDX800 model has the original's sequence-timeline quirk (out/fixture-scan/scan.mjs found
  // no sequenceTimeline proposal anywhere), so this fixture covers the visibility-interpolation repair only.
  const BEFORE='mdx-m3-viewer: 0 errors · 0 severe · 1 warnings · 784 notices',AFTER='mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · 784 notices',AUTOMATIC=172,INSPECTION=72,NOTICES_KEPT=784,FORMAT_KINDS=new Set(['visibilityInterpolation','sequenceTimeline']);
  // Portrait effects: no model with a format quirk has a particle emitter visible in a Portrait sequence (sampled with
  // src/animation.js sampleTrack: this fixture's BlizPart_RidingDust Visibility is 0 at 106667 and 109500, the whole Portrait;
  // Vile Knight and SteamTank are the same or have no Portrait), so the authored portrait-particle check is not coverable
  // here; the paired portrait frame is still required. Set MDLXL_FORMAT_PORTRAIT_PARTICLES=1 for a fixture that has them.
  const PORTRAIT_PARTICLES=process.env.MDLXL_FORMAT_PORTRAIT_PARTICLES==='1';
  const file=process.env.MDLXL_FORMAT_MODEL||testModel('optimizexl-format/KnightOfTheBlazingSun.mdx');
  const source=fs.readFileSync(file),out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','format-ui-'+Date.now()),copies=path.join(out,'copies');fs.mkdirSync(copies,{recursive:true});const work=path.join(out,path.basename(file));fs.copyFileSync(file,work);
  const {openDocument}=await import('../src/editor-document.js'),{sanityProposals,runOptimizeStage}=await import('../src/optimizexl.js');
  const before=openDocument(new Uint8Array(source),'x.mdx').model,fixes=sanityProposals(before).filter(f=>!f.inspectionOnly);
  assert.equal(fixes.length,AUTOMATIC);const formatFixes=fixes.filter(f=>FORMAT_KINDS.has(f.kind));assert.equal(formatFixes.length,1);
  const expected=Buffer.from(runOptimizeStage(new Uint8Array(source),'sanity',{}, {kind:'batch',stage:'sanity',entries:formatFixes.map(fix=>({fix}))}).bytes);
  const exe=appTarget().packaged;
  const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: work, out, settings: {preferences:{graphics:{particles:false}}} });let p;
  try{
    const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();p=await pending;
    await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 25000 }); await stubDialogs(app, { open: copies });
  // OptimizeXL opens on the Insanity FIxer; this review starts at Duplicate data.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Duplicate data',exact:true}).click();
    const stage=()=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Insanity FIxer',exact:true}).click();
    const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    const save=async(bytes)=>{
   // Save writes the open working copy; the private fixture itself is never touched.
   const button=p.getByRole('button',{name:'Save',exact:true});
   if(await button.isEnabled()){await button.click();const keep=p.getByRole('button',{name:'Save without backup',exact:true});if(await keep.isVisible())await keep.click();
    await p.waitForFunction(()=>!Array.from(document.querySelectorAll('header button')).some(b=>b.textContent==='Saving…')&&Array.from(document.querySelectorAll('[role="status"]')).some(e=>/^Saved /.test(e.textContent)));}
   const {openDocument:open}=await import('../src/editor-document.js'),plain=x=>JSON.stringify(open(new Uint8Array(x),'x.mdx').model,(k,v)=>k==='Nodes'?undefined:ArrayBuffer.isView(v)?Array.from(v):v);
   assert.equal(plain(fs.readFileSync(work)),plain(bytes),'The open file holds exactly the approved model');
  };
    await stage();await p.getByText(BEFORE,{exact:true}).waitFor();
    assert.equal(await p.locator('.ox-fix-selection details[open]').count(),0);
    const pinned=await p.locator('[aria-label="Before preview"] h2').textContent();
    await p.evaluate(()=>{window.formatState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
      const { runtime, props } = mdlxlProbe(root); if(!runtime||!props)return null;return {frame:runtime.native.getFrame(),requestedFrame:props.time,sequence:runtime.native.getSequence(),requestedSequence:props.sequenceIndex,
        start:props.model.Sequences[props.sequenceIndex].Interval[0],matrices:runtime.native.rendererData.nodes.filter(Boolean).map(n=>Array.from(n.matrix)),camera:runtime.controls.object.position.toArray(),portrait:!!props.portraitMode,framed:root.classList.contains('portrait-preview-root'),frameLoaded:!!root.querySelector('.portrait-human-frame'),particles:runtime.native.particlesController.emitters.map(e=>e.particles.filter(p=>p.lifeSpan>0).length)};
    });});
    const pose=async()=>{try{await p.waitForFunction(()=>formatState().every(s=>s&&Math.abs(s.frame-s.requestedFrame)<1e-5&&s.sequence===s.requestedSequence));}catch(e){fs.writeFileSync(path.join(out,'failed-state.json'),JSON.stringify(await p.evaluate(()=>formatState()),null,2));await p.screenshot({path:path.join(out,'failed-state.png')});throw e;}const states=await p.evaluate(()=>formatState());
      assert.equal(states[0].frame-states[0].start,states[1].frame-states[1].start);assert.deepEqual(states[0].matrices,states[1].matrices);const portrait=/portrait/i.test(before.Sequences[states[0].sequence].Name);states.forEach(s=>{assert.equal(s.portrait,portrait);assert.equal(s.framed,portrait);});return states;
    };
    await p.screenshot({path:path.join(out,'01-original-findings.png')});
    const list=p.locator('.ox-fix-selection');await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();assert.equal(await list.locator('input:checked').count(),AUTOMATIC);assert.equal(await list.locator('input:disabled').count(),INSPECTION);
    await list.getByRole('button',{name:'Clear all',exact:true}).click();assert.equal(await list.locator('input:checked').count(),0);
    for(const fix of formatFixes)await list.getByRole('checkbox',{name:'Select '+fix.label,exact:true}).check();assert.equal(await list.locator('input:checked').count(),formatFixes.length);
    await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await ready();await save(source);
    for(let si=0;si<before.Sequences.length;si++){
      await p.getByLabel('Animation',{exact:true}).selectOption(String(si));
      for(const elapsed of [0,(before.Sequences[si].Interval[1]-before.Sequences[si].Interval[0])/2,before.Sequences[si].Interval[1]-before.Sequences[si].Interval[0]]){
        await p.getByLabel('Animation frame',{exact:true}).fill(String(before.Sequences[si].Interval[0]+Math.floor(elapsed)));await pose();
      }
    }
    await p.getByLabel('Animation',{exact:true}).selectOption('7');const old=await pose(),box=await p.locator('[aria-label="Before preview"] [data-clean-model-canvas]').boundingBox();
    await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.65,box.y+box.height*.57,{steps:12});await p.mouse.up();
    await p.waitForFunction(previous=>formatState()[0].camera.some((v,i)=>Math.abs(v-previous[i])>.1),old[0].camera);const rotated=await pose();
    rotated[0].camera.forEach((v,i)=>assert.ok(Math.abs(v-rotated[1].camera[i])<1e-5));
    await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(frame=>formatState()[0].frame>frame,rotated[0].frame);await p.getByRole('button',{name:'Pause',exact:true}).click();await pose();
    await p.screenshot({path:path.join(out,'02-paired-rotated-preview.png')});
    await p.getByLabel('Animation',{exact:true}).selectOption('8');await p.getByRole('button',{name:'Start',exact:true}).click();await pose();await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(particles=>formatState().every(s=>s.frameLoaded&&(!particles||s.particles[0]>0)),PORTRAIT_PARTICLES);await p.getByRole('button',{name:'Pause',exact:true}).click();await pose();await p.screenshot({path:path.join(out,'02b-portrait-breath-effects.png')});
    await p.getByRole('button',{name:'Approve selected',exact:true}).click();await p.getByText(AFTER,{exact:true}).waitFor();
    assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),pinned);await save(expected);
    for(let si=0;si<before.Sequences.length;si++){await p.getByLabel('Animation',{exact:true}).selectOption(String(si));await p.getByRole('button',{name:'End',exact:true}).click();await pose();}
    await p.screenshot({path:path.join(out,'03-approved-preserved-motion.png')});
    await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByText(BEFORE,{exact:true}).waitFor();await ready();await save(source);await pose();
    assert.deepEqual(fs.readFileSync(file),source);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,allAnimations:before.Sequences.length,exactNativePoses:true,realMouseRotation:true,pairedCamera:true,pairedPortraitFrames:true,authoredBreathEffects:PORTRAIT_PARTICLES,playback:true,approvedOnlySaves:true,beforePinned:true,backRestoresFindings:true,retainedMotionNotices:NOTICES_KEPT,sourceUnchanged:true,errors,copies},null,2));console.log(out);
  }catch(e){if(p){fs.writeFileSync(path.join(out,'failed-state.json'),JSON.stringify(await p.evaluate(()=>window.formatState?.()),null,2));await p.screenshot({path:path.join(out,'failed-state.png')});}throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
