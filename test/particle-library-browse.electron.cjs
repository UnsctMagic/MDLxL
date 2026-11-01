// Real classic CASC migration and user flow. Supply MDLXL_REAL_PROFILE with a completed
// extraction. Use a private copy, so the fixture can also be the owner's installed profile.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {click,type,orbit}=require('./helpers/library-browser.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
(async()=>{
  const source=process.env.MDLXL_REAL_PROFILE, out=path.resolve('out/particle-browse-check'),profile=path.join(out,'profile');
  assert.ok(source,'Provide a completed real catalogue via MDLXL_REAL_PROFILE');
  const {sourceKey,folder}=JSON.parse(await fs.readFile(path.join(source,'particles/current.json')));
  const directory=path.join(profile,'particles'),cache=path.join(directory,sourceKey);
  await fs.mkdir(directory,{recursive:true});
  await fs.cp(path.join(source,'particles',sourceKey),cache,{recursive:true,filter:file=>path.basename(file)!=='browse.json'});
  await fs.copyFile(path.join(source,'particles/current.json'),path.join(directory,'current.json'));
  const fixture=fixturePath('footman');await fs.access(fixture);
  let app;
  try {
    const launched=await launchApp({out,profile,fixture,show:'hide',settings:{gameData:folder,preferences:{checkUpdatesOnStartup:false}},env:{MDLVIS_GAME_DATA:folder},pageTimeout:60000});
    app=launched.app;const page=launched.page,dialog=page.getByRole('dialog',{name:'Particle Editor',exact:true});
    const button=name=>page.getByRole('button',{name,exact:true}),library=page.locator('.pe-library');
    const object=name=>library.getByRole('treeitem',{name,exact:true});
    await click(page,button('Emitter Editor'));await library.waitFor();
    assert.equal(await library.locator('.gf-tree').count(),1,'Particle browsing uses GameFileBrowser');
    await object('Warcraft').waitFor();
    await click(page,button('World Editor Style'));await click(page,object('Units'));
    assert.equal(await object('Units').getAttribute('aria-expanded'),'true');
    await page.keyboard.press('ArrowLeft');assert.equal(await object('Units').getAttribute('aria-expanded'),'false');
    await page.keyboard.press('ArrowRight');await click(page,object('Undead'));await click(page,object('Normal'));
    await object('Abomination').locator('img').waitFor();await click(page,object('Abomination'));
    await click(page,object('Disease Cloud · Target'));await page.keyboard.press('ArrowDown');
    const selected=library.locator('.gf-row.selected'),id=await selected.getAttribute('data-effect-id');assert.ok(id);
    await library.locator('.gf-stage canvas').first().waitFor();await orbit(page,library.locator('.gf-stage'));
    await click(page,button('View source context'));await page.locator('.pe-source-stage canvas').first().waitFor();await orbit(page,page.locator('.pe-source-stage'));
    await click(page,button('Close source context'));await page.locator('.pe-source-context').waitFor({state:'hidden'});
    await click(page,library.getByRole('button',{name:/^Favorite /}));
    await click(page,object('Warcraft'));await click(page,object('Favorites'));
    assert.equal(await library.locator('[data-effect-id="'+id+'"]').count(),1,'The same recipe appears in Favorites');
    await click(page,object('Favorites'));await click(page,object('Warcraft'));
    const search=page.getByLabel('Find an effect');await type(page,search,'inner fire');
    assert.match(await library.innerText(),/Inner Fire[\s\S]*No indexed emitters/);
    await type(page,search,'abomination disease cloud');
    await click(page,library.locator('[data-effect-id="'+id+'"]').first(),{clickCount:2});await library.waitFor({state:'hidden'});
    const labId=await page.evaluate(()=>findFiberState(document.querySelector('.pe-window'),v=>v?.recipe&&v?.doc)?.recipe.id);assert.equal(labId,id);
    await orbit(page,page.locator('.pe-preview'));
    const modelCount=()=>page.evaluate(()=>findFiberState(document.querySelector('.classic-app'),v=>v?.doc?.model&&v.assets).doc.model.ParticleEmitters2.length);
    const before=await modelCount();await click(page,button('Add to model'));
    const start=Number(await page.getByLabel('Effect start',{exact:true}).inputValue());
    await type(page,page.getByLabel('Effect end',{exact:true}),String(start+500));await click(page,button('Confirm placement'));
    assert.ok(await modelCount()>before,'Disease Cloud was placed on the real Footman');
    await click(page,dialog.getByRole('button',{name:'Library',exact:true}));await library.waitFor();await page.keyboard.press('Escape');await library.waitFor({state:'hidden'});
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(win=>win.isVisible())),false);
    assert.deepEqual(launched.errors,[]);console.log('PASS real Disease Cloud',id,'shared tree, arrows, favorite, zero-emitter search, mouse orbit, double-click Lab, real-model placement, Escape');
  } finally {if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
