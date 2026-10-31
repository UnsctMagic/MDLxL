const { testModel } = require('./helpers/fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');

(async()=>{
  // Fixture: LowPolyWorks WH_WOC_WarriorKhorneGW02.mdx (out/optimizexl-diagnostics, docs/PACKAGED-TESTS.md), a model whose
  // only mdx-m3-viewer findings are unused notices that the Insanity FIxer repairs. Measured with out/fixture-scan/sim.mjs
  // (prepareOptimizeXL bytes -> test/helpers/hive.mjs sanityTest, sanityProposals, classifyHiveFindings, one select-all
  // batch through runOptimizeStage): 0 errors / 0 severe / 0 warnings / 25 notices; all 25 checker findings have status
  // 'preview'; 25 automatic proposals (0 inspection-only); the first finding's fix is redundant:GeosetAnims.1.Alpha:6
  // (sequence 6, Decay Flesh); one approved batch leaves 0 notices.
  const NOTICES=25,AUTOMATIC=25,FIRST_SEQUENCE='6';
  const model=process.env.MDLXL_DIAGNOSTICS_MODEL||testModel('optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx'),source=fs.readFileSync(model);
  const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','diagnostics-ui');fs.mkdirSync(out,{recursive:true});
  const exe=appTarget().packaged;
  const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: model, out });
  try{
    const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;
    await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 20000 });
  // OptimizeXL opens on the Insanity FIxer; this review starts at Duplicate data.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Duplicate data',exact:true}).click();
    const stage=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true}).click();
    await stage('Unused data');await p.locator('.ox-hive-unused').filter({hasText:NOTICES+' mdx-m3-viewer unused notices remain'}).waitFor();
    assert.equal(await p.getByText('No unused data to remove.',{exact:true}).count(),0);await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.screenshot({path:path.join(out,'unused-routing.png')});
    await p.getByRole('button',{name:'Review mdx-m3-viewer cleanup',exact:true}).click();
    await p.getByText(`mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · ${NOTICES} notices`,{exact:true}).waitFor();
    await p.getByText(`Checker findings (${NOTICES})`,{exact:true}).click();
    assert.equal(await p.getByRole('button',{name:'Preview fix',exact:true}).count(),NOTICES);
    await p.getByRole('button',{name:'Preview fix',exact:true}).first().click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    assert.equal(await p.getByLabel('Animation',{exact:true}).inputValue(),FIRST_SEQUENCE);
    const before=await p.locator('[aria-label="Before preview"] h2').textContent();
    await p.getByText(`Checker findings (${NOTICES})`,{exact:true}).click();
    const list=p.locator('.ox-fix-selection');await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();
    assert.equal(await list.locator('input:checked').count(),AUTOMATIC);
    await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    await p.screenshot({path:path.join(out,'five-key-preview.png')});await p.getByRole('button',{name:'Approve selected',exact:true}).click();
    await p.getByText('mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · 0 notices',{exact:true}).waitFor();assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),before);
    await p.screenshot({path:path.join(out,'hive-clean.png')});await stage('Unused data');await p.getByText('No mdx-m3-viewer unused notices.',{exact:true}).waitFor();
    await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByText(`mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · ${NOTICES} notices`,{exact:true}).waitFor();
    assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,allFiveNoticesRouted:true,zeroAfterApproval:true,backRestoresFindings:true,sourceUnchanged:true,errors},null,2));
    console.log('Passed unused routing, every direct repair link, combined cleanup, zero mdx-m3-viewer result and Back.');
  }finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
