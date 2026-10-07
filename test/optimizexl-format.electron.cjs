const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const file=process.env.MDLXL_FORMAT_MODEL;if(!file)throw Error('Set MDLXL_FORMAT_MODEL to the private review fixture.');
  const source=fs.readFileSync(file),out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','format-ui-'+Date.now()),copies=path.join(out,'copies');fs.mkdirSync(copies,{recursive:true});
  const profile=path.join(out,'profile');fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences:{graphics:{particles:false}}}));
  const {openDocument}=await import('../src/editor-document.js'),{sanityProposals,runOptimizeStage}=await import('../src/optimizexl.js');
  const before=openDocument(new Uint8Array(source),'x.mdx').model,fixes=sanityProposals(before).filter(f=>!f.inspectionOnly);
  assert.equal(fixes.length,2);const expected=Buffer.from(runOptimizeStage(new Uint8Array(source),'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes);
  const exe=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[];
  const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});let p;
  try{
    const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();p=await pending;p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow,dialog},directory)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[directory]});for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}},copies);
    const stage=()=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Insanity FIxer',exact:true}).click();
    const ready=()=>p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    const save=async(bytes)=>{const old=new Set(fs.readdirSync(copies));await p.getByRole('button',{name:'Optimize New Copy',exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelectorAll('header button')).some(b=>b.textContent==='Saving…'));
      const added=fs.readdirSync(copies).filter(n=>!old.has(n));assert.equal(added.length,2);assert.deepEqual(fs.readFileSync(path.join(copies,added.find(n=>n.includes('_Before')))),source);assert.deepEqual(fs.readFileSync(path.join(copies,added.find(n=>n.includes('_After')))),bytes);
    };
    await stage();await p.getByText('Hive: 0 errors · 8 severe · 1 warnings · 3 notices',{exact:true}).waitFor();
    assert.equal(await p.locator('.ox-fix-selection details[open]').count(),0);
    const pinned=await p.locator('[aria-label="Before preview"] h2').textContent();
    await p.evaluate(()=>{window.formatState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
      let runtime,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)runtime=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}
      if(!runtime||!props)return null;return {frame:runtime.native.getFrame(),requestedFrame:props.time,sequence:runtime.native.getSequence(),requestedSequence:props.sequenceIndex,
        start:props.model.Sequences[props.sequenceIndex].Interval[0],matrices:runtime.native.rendererData.nodes.filter(Boolean).map(n=>Array.from(n.matrix)),camera:runtime.controls.object.position.toArray(),portrait:!!props.portraitMode,framed:root.classList.contains('portrait-preview-root'),frameLoaded:!!root.querySelector('.portrait-human-frame'),particles:runtime.native.particlesController.emitters.map(e=>e.particles.filter(p=>p.lifeSpan>0).length)};
    });});
    const pose=async()=>{try{await p.waitForFunction(()=>formatState().every(s=>s&&Math.abs(s.frame-s.requestedFrame)<1e-5&&s.sequence===s.requestedSequence));}catch(e){fs.writeFileSync(path.join(out,'failed-state.json'),JSON.stringify(await p.evaluate(()=>formatState()),null,2));await p.screenshot({path:path.join(out,'failed-state.png')});throw e;}const states=await p.evaluate(()=>formatState());
      assert.equal(states[0].frame-states[0].start,states[1].frame-states[1].start);assert.deepEqual(states[0].matrices,states[1].matrices);const portrait=/portrait/i.test(before.Sequences[states[0].sequence].Name);states.forEach(s=>{assert.equal(s.portrait,portrait);assert.equal(s.framed,portrait);});return states;
    };
    await p.screenshot({path:path.join(out,'01-original-findings.png')});
    const list=p.locator('.ox-fix-selection');await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();assert.equal(await list.locator('input:checked').count(),2);assert.equal(await list.locator('input:disabled').count(),3);
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
    await p.getByLabel('Animation',{exact:true}).selectOption('8');await p.getByRole('button',{name:'Start',exact:true}).click();await pose();await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(()=>formatState().every(s=>s.frameLoaded&&s.particles[0]>0));await p.getByRole('button',{name:'Pause',exact:true}).click();await pose();await p.screenshot({path:path.join(out,'02b-portrait-breath-effects.png')});
    await p.getByRole('button',{name:'Approve selected',exact:true}).click();await p.getByText('Hive: 0 errors · 0 severe · 0 warnings · 3 notices',{exact:true}).waitFor();
    assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),pinned);await save(expected);
    for(let si=0;si<before.Sequences.length;si++){await p.getByLabel('Animation',{exact:true}).selectOption(String(si));await p.getByRole('button',{name:'End',exact:true}).click();await pose();}
    await p.screenshot({path:path.join(out,'03-approved-preserved-motion.png')});
    await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByText('Hive: 0 errors · 8 severe · 1 warnings · 3 notices',{exact:true}).waitFor();await ready();await save(source);await pose();
    assert.deepEqual(fs.readFileSync(file),source);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,allAnimations:before.Sequences.length,exactNativePoses:true,realMouseRotation:true,pairedCamera:true,pairedPortraitFrames:true,authoredBreathEffects:true,playback:true,approvedOnlySaves:true,beforePinned:true,backRestoresFindings:true,retainedMotionNotices:3,sourceUnchanged:true,errors,copies},null,2));console.log(out);
  }catch(e){if(p){fs.writeFileSync(path.join(out,'failed-state.json'),JSON.stringify(await p.evaluate(()=>window.formatState?.()),null,2));await p.screenshot({path:path.join(out,'failed-state.png')});}throw e;}finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
