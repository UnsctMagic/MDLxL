// Owner-profile browser comparison, also run against the rejected PR head.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {click,type,orbit}=require('./helpers/library-browser.cjs');
(async()=>{
  const out=path.resolve('out/particle-library-layout'),profile=path.join(out,'profile');
  assert.ok(process.env.MDLXL_REAL_PROFILE,'MDLXL_REAL_PROFILE must name the read-only owner profile');
  // Copy the owner's settings and personal data. Chromium caches and decoded
  // game-texture caches are regenerated, leaving the live installation read-only.
  await fs.cp(process.env.MDLXL_REAL_PROFILE,profile,{recursive:true,preserveTimestamps:true,filter:file=>!['Network','Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','Session Storage','native-textures','texture-previews'].includes(path.relative(process.env.MDLXL_REAL_PROFILE,file).split(path.sep)[0])});
  const settings=JSON.parse(await fs.readFile(path.join(profile,'settings.json'),'utf8'));
  settings.preferences={...settings.preferences,checkUpdatesOnStartup:false};
  const evidence=path.resolve('test/evidence/particle-library');await fs.mkdir(evidence,{recursive:true});
  let app;
  try{
    const launched=await launchApp({out,profile,settings,show:'hide',bounds:{x:0,y:0,width:1440,height:1000},pageTimeout:60000});
    app=launched.app;const page=launched.page;
    const button=name=>page.getByRole('button',{name,exact:true});
    await click(page,button('Material and Texture Library'));
    await click(page,page.getByRole('tab',{name:'Models',exact:true}));
    const main=page.getByRole('dialog',{name:'Warcraft III Library',exact:true});
    await main.locator('.gf-row').first().waitFor();
    await click(page,button('World Editor Style'));
    const modelRow=name=>main.getByRole('treeitem',{name,exact:true});
    for(const name of ['Human','Units','Normal','Footman'])await click(page,modelRow(name));
    await main.locator('.gf-stage canvas').first().waitFor();
    await orbit(page,main.locator('.gf-stage'));
    await main.screenshot({path:path.join(evidence,'models.png')});
    const style=await main.locator('.gf-row').first().evaluate(el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el).font}));
    await click(page,modelRow('Footman'));await page.keyboard.press('Enter');await main.waitFor({state:'hidden'});
    await page.getByRole('tab',{name:'Footman.mdx',exact:true}).waitFor();
    await click(page,button('Emitter Editor'));
    const library=page.locator('.pe-library');await library.waitFor();
    if(process.env.MDLXL_BROWSER_BEFORE){
      await library.locator('.pe-effect-card').first().waitFor();
      await library.screenshot({path:path.join(evidence,'before.png')});
    }
    assert.equal(await library.locator('.gf-tree').count(),1,'Particle Library must use the main Library virtual tree');
    assert.equal(await library.locator('.pe-effect-card,.pe-collections,.pe-origin-rows').count(),0,'The rejected card browser is gone');
    assert.equal(await button('Standard').getAttribute('aria-pressed'),'true','By type opens with the existing Standard switch');
    const row=name=>library.getByRole('treeitem',{name,exact:true});
    assert.equal(await row('Warcraft').getAttribute('aria-expanded'),'true');
    assert.equal(await row('Warcraft').locator('.gf-twist svg').isVisible(),true,'The shared folder arrow remains visible inside EMTR');
    assert.equal(await row('Warcraft').locator('.gf-icon-glyph').isVisible(),true,'The shared folder icon remains visible inside EMTR');
    assert.deepEqual(await library.locator('.gf-row').first().evaluate(el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el).font})),style,'Both browsers render the same rows');
    await click(page,row('Fire'));await library.locator('[data-effect-id]').first().waitFor();await page.keyboard.press('ArrowDown');
    await library.locator('.gf-stage canvas').first().waitFor();await orbit(page,library.locator('.gf-stage'));
    const time=await page.evaluate(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.getFrame());
    assert.equal(typeof time,'number');
    await page.waitForFunction(time=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.getFrame()!==time,time);
    await button('Index Warcraft assets').waitFor();
    await page.waitForFunction(()=>{const runtime=mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime;return runtime.captureApi?.isReady&&runtime.native.particlesController.emitters.some(emitter=>emitter.particles.length>0);});
    await library.screenshot({path:path.join(evidence,'after.png')});
    await page.keyboard.press('Tab');
    await click(page,library.locator('.gf-row.selected'),{clickCount:2});
    await library.waitFor({state:'hidden'});
    assert.deepEqual(launched.errors,[]);
    console.log('PASS owner profile: shared rows/switch, Fire arrow preview, mouse camera rotation, double-click Lab');
  }catch(error){console.error(error);if(app)await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});throw error;}
  finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
