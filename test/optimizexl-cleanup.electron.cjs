const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');

(async()=>{
  const model=process.env.MDLXL_OPENING_MODEL||'C:/Users/PC/Downloads/WH_WOC_KnightKhorneFlail02_After.mdx',source=fs.readFileSync(model);
  const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','cleanup-ui');fs.mkdirSync(out,{recursive:true});
  const exe=appTarget().packaged;
  const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: model, out });
  try{
    const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;
    await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 20000 });
  // OptimizeXL opens on the Insanity FIxer; this review starts at Duplicate data.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Duplicate data',exact:true}).click();
    const stage=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true}).click();
    const all=async()=>{const list=p.locator('.ox-fix-selection');if(!await list.evaluate(e=>e.open))await list.locator('summary').click();await list.getByRole('button',{name:'Select all',exact:true}).click();await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));};
    await stage('Insanity FIxer');await p.getByText('mdx-m3-viewer: 0 errors · 1 severe · 0 warnings · 3 notices',{exact:true}).waitFor();
    await p.evaluate(()=>{window.sides=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{const { props } = mdlxlProbe(root); return props;});});
    const original=await p.evaluate(()=>JSON.stringify(sides()[0].model));
    await all();assert.equal(await p.locator('.ox-fix-selection input:checked').count(),4);
    await p.getByRole('button',{name:'Approve selected',exact:true}).click();
    await p.getByText('mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · 0 notices',{exact:true}).waitFor();
    await p.screenshot({path:path.join(out,'hive-clear.png')});
    await stage('Irregularities Fixer');
    const label='Portrait - 1: glow Geoset 49 visible without its attached geometry';
    await p.getByLabel('Proposed fix',{exact:true}).selectOption({label});await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    assert.equal(await p.getByLabel('Animation',{exact:true}).inputValue(),'7');
    assert.deepEqual(await p.evaluate(()=>sides().map(s=>s.model.GeosetAnims.find(a=>a.GeosetId===48)?.Alpha?.Keys?.find(k=>k.Frame===140000)?.Vector[0]??1)),[1,0]);
    await p.screenshot({path:path.join(out,'portrait-glow-preview.png')});
    const selection=p.locator('.ox-fix-selection');await selection.locator('summary').click();
    for(const name of ['Portrait - 1','Portrait Talk - 1','Decay Bone'])await selection.getByRole('checkbox',{name:'Select '+name+': glow Geoset 49 visible without its attached geometry',exact:true}).check();
    await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    await p.getByRole('button',{name:'Approve selected',exact:true}).click();
    await p.waitForFunction(()=>!Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o=>o.textContent.includes('glow Geoset 49')));
    assert.equal(await p.evaluate(()=>JSON.stringify(sides()[0].model)),original);
    await stage('Insanity FIxer');await p.getByText('mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · 0 notices',{exact:true}).waitFor();
    await stage('Sphereomancer');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
    const spheres=await p.evaluate(()=>sides()[1].model.CollisionShapes.map(c=>[...c.Vertices,c.BoundsRadius]));
    assert.deepEqual(spheres,[[5.257450103759766,0,63.22100067138672,38.07600021362305],[3.239419937133789,0,22.847400665283203,38.07600021362305]]);
    await p.screenshot({path:path.join(out,'footman-spheres.png')});
    assert.deepEqual(fs.readFileSync(model),source);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,zeroHiveFindings:true,threeGlowCorrections:true,footmanSpheres:true,pinnedBefore:true,sourceUnchanged:true,errors},null,2));
    console.log('Passed combined cleanup, zero mdx-m3-viewer findings, glow preview/approval and Footman spheres.');
  }finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
