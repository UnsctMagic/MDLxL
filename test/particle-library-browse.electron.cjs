// Real classic CASC migration and user flow. Supply MDLXL_REAL_PROFILE with a completed
// extraction. Use a private copy, so the fixture can also be the owner's installed profile.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
(async()=>{
  const source=process.env.MDLXL_REAL_PROFILE, out=path.resolve('out/particle-browse-check'),profile=path.join(out,'profile');
  assert.ok(source,'Provide a completed real catalogue via MDLXL_REAL_PROFILE');
  const {sourceKey,folder}=JSON.parse(await fs.readFile(path.join(source,'particles/current.json')));
  const directory=path.join(profile,'particles'),cache=path.join(directory,sourceKey);
  await fs.mkdir(directory,{recursive:true});
  await fs.cp(path.join(source,'particles',sourceKey),cache,{recursive:true,filter:file=>path.basename(file)!=='browse.json'});
  await fs.copyFile(path.join(source,'particles/current.json'),path.join(directory,'current.json'));
  const {createDemoDocument}=await import('../src/editor-document.js');
  const fixture=path.join(out,'placement.mdx');await fs.writeFile(fixture,Buffer.from(createDemoDocument().serialize('mdx')));
  let app;
  try {
    const launched=await launchApp({out,profile,fixture,show:'hide',settings:{gameData:folder,preferences:{checkUpdatesOnStartup:false}},env:{MDLVIS_GAME_DATA:folder},pageTimeout:60000});
    app=launched.app;const page=launched.page,dialog=page.getByRole('dialog',{name:'Particle Editor',exact:true});
    const button=name=>page.getByRole('button',{name,exact:true});
    await page.waitForFunction(()=>findFiberState(document.querySelector('.classic-app'),v=>v?.doc?.model&&v.assets)?.doc.name==='placement.mdx');
    const object=name=>page.getByRole('treeitem',{name,exact:true});
    const started=Date.now();await button('Emitter Editor').click();await page.locator('.pe-effect-card').first().waitFor();
    console.log('First page (ms)',Date.now()-started);
    assert.equal(await button('By type').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.pe-effect-card').count(),36);
    assert.ok(await page.locator('.pe-group-title').count()>1);
    await button('World Editor').click();await object('Other effects').waitFor();
    await object('Units').click();assert.equal(await object('Units').getAttribute('aria-expanded'),'true');
    await object('Units').click();assert.equal(await object('Units').getAttribute('aria-expanded'),'false');
    await object('Units').click();await object('Undead').click();await object('Normal').click();
    await object('Abomination').locator('img').waitFor();
    await object('Abomination').click();
    const disease=page.locator('section').filter({has:page.getByRole('heading',{name:'Disease Cloud · Target',exact:true})});
    const card=disease.locator('article').first(),id=await card.getAttribute('data-effect-id');
    await card.getByRole('button',{name:/^Favorite /}).click();
    await button('Favorites').click();await button('By type').click();
    assert.equal(await page.locator('article').first().getAttribute('data-effect-id'),id);
    await button('Warcraft').click();await button('World Editor').click();
    const search=page.getByLabel('Find an effect');await search.fill('inner fire');await object('Priest').click();
    assert.match(await page.locator('.pe-library').innerText(),/Inner Fire[\s\S]*No indexed emitters/);
    await search.fill('abomination');await object('Abomination').click();
    await disease.locator('[data-effect-id="'+id+'"] .pe-effect-card').click();
    await page.locator('.pe-library').waitFor({state:'hidden'});
    const labId=await page.evaluate(()=>findFiberState(document.querySelector('.pe-window'),v=>v?.recipe&&v?.doc)?.recipe.id);
    assert.equal(labId,id);
    const canvas=page.locator('.pe-preview .game-preview-root canvas').first();await canvas.waitFor();
    const camera=()=>page.evaluate(()=>mdlxlProbe(document.querySelector('.pe-preview .game-preview-root')).runtime.controls.object.position.toArray());
    const beforeCamera=await camera(),box=await canvas.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y+35,{steps:8});await page.mouse.up();assert.notDeepEqual(await camera(),beforeCamera);
    const modelCount=()=>page.evaluate(()=>findFiberState(document.querySelector('.classic-app'),v=>v?.doc?.model&&v.assets).doc.model.ParticleEmitters2.length);
    const before=await modelCount();await button('Add to model').click();
    const start=Number(await page.getByLabel('Effect start',{exact:true}).inputValue());
    await page.getByLabel('Effect end',{exact:true}).fill(String(start+500));await button('Confirm placement').click();
    assert.ok(await modelCount()>before,'Disease Cloud was placed on the open model');
    await dialog.getByRole('button',{name:'Library',exact:true}).click();await page.locator('.pe-library').waitFor();await page.keyboard.press('Escape');await page.locator('.pe-library').waitFor({state:'hidden'});
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(win=>win.isVisible())),false);
    assert.deepEqual(launched.errors,[]);console.log('PASS real Disease Cloud',id,'shared favorite, localized search, mouse orbit, placement, Escape');
  } finally {if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
