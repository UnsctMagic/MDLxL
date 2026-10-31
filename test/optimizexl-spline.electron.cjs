const { testModel } = require('./helpers/fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp, stubDialogs } = require('./helpers/app.cjs');

(async()=>{
  // Fixture: LowPolyWorks gluma Warp_Lightning_CannonB.mdx (out/optimizexl-spline, docs/PACKAGED-TESTS.md), whose Hermite/Bezier
  // tracks carry mdx-m3-viewer redundant-key notices that only spline resampling clears. Measured with out/fixture-scan/sim.mjs
  // (raw and prepareOptimizeXL bytes alike; test/helpers/hive.mjs sanityTest, sanityProposals, select-all batches through
  // runOptimizeStage until none is left): 0 errors / 0 severe / 0 warnings / 14 notices; 13 automatic proposals, 2 of them
  // splineResample; one pass leaves 0 notices, so Back returns to the original 14 notices.
  const START='mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · 14 notices',BACK=START;
  const model=process.env.MDLXL_SPLINE_MODEL||testModel('optimizexl-spline/Warp_Lightning_CannonB.mdx');
  const source=fs.readFileSync(model),out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','spline-ui-'+Date.now()),copies=path.join(out,'copies');fs.mkdirSync(copies,{recursive:true});const work=path.join(out,path.basename(model));fs.copyFileSync(model,work);
  const {openDocument}=await import('../src/editor-document.js'),{sanityProposals,runOptimizeStage}=await import('../src/optimizexl.js');
  let expected=new Uint8Array(source);const passes=[];
  for(let i=0;i<10;i++){const fixes=sanityProposals(openDocument(expected,'x.mdx').model).filter(f=>!f.inspectionOnly);if(!fixes.length)break;
    expected=runOptimizeStage(expected,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;passes.push({count:fixes.length,bytes:Buffer.from(expected)});
  }
  const exe=appTarget().packaged;
  const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: work, out });
  try{
    const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;
    await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 30000 }); await stubDialogs(app, { open: copies });
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
    assert.ok(sanityProposals(openDocument(new Uint8Array(source),'x.mdx').model).some(f=>f.kind==='splineResample'&&!f.inspectionOnly),'The fixture has spline-resample repairs');
    await stage();await p.getByText(START,{exact:true}).waitFor();
    assert.equal(await p.locator('.ox-fix-selection details[open]').count(),0);
    const before=await p.locator('[aria-label="Before preview"] h2').textContent();
    await p.screenshot({path:path.join(out,'01-original-findings.png')});
    let approved=source;
    for(let i=0;i<passes.length;i++){
      const list=p.locator('.ox-fix-selection');if(await list.locator('details').getAttribute('open')===null)await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();
      assert.equal(await list.locator('input:checked').count(),passes[i].count);
      await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await ready();
      await save(approved);await p.screenshot({path:path.join(out,`02-preview-${i}.png`)});
      await p.getByRole('button',{name:'Approve selected',exact:true}).click();approved=passes[i].bytes;
      await stage();await p.waitForFunction(()=>Array.from(document.querySelectorAll('[role="status"]')).some(e=>e.textContent.startsWith('mdx-m3-viewer:')));
      assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),before);
    }
    await p.getByText('mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · 0 notices',{exact:true}).waitFor();await save(approved);
    await p.getByLabel('Animation frame',{exact:true}).press('End');
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await p.screenshot({path:path.join(out,'03-clean-approved.png')});
    await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByText(BACK,{exact:true}).waitFor();
    await p.screenshot({path:path.join(out,'04-back.png')});
    assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,passes:passes.map(p=>p.count),approvedOnlySaves:true,beforePinned:true,backRestoresFindings:true,sourceUnchanged:true,errors,copies},null,2));console.log(out);
  }finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
