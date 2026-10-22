// The Library button browses every installed game file; texture pickers stay texture-only.
// Needs an installed Warcraft III 1.30+ (MDLVIS_GAME_DATA, default D:\Warcraft III).
// MDLXL_PACKAGED_EXE runs a packaged MDLxL.exe instead of the source checkout.
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||process.env.MDLXL_REAL_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'out/game-file-library'),checks=[];
const shot=async(page,name)=>page.screenshot({path:path.join(out,name+'.png')});
(async()=>{
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  const {createDemoDocument}=await import('../src/editor-document.js');
  const document=createDemoDocument(),model=document.model;
  model.Textures.push({Image:'Textures\\Footman.blp',ReplaceableId:0,Flags:3});
  model.Materials[model.Geosets[0].MaterialID].Layers[0].TextureID=model.Textures.length-1;
  const fixture=path.join(out,'demo.mdx');fs.writeFileSync(fixture,document.serialize('mdx'));
  fs.mkdirSync(path.join(out,'profile'),{recursive:true});fs.writeFileSync(path.join(out,'profile','settings.json'),JSON.stringify({preferences:{graphics:{pauseWhenHidden:false},...(process.env.MDLXL_TEST_THEME?{theme:process.env.MDLXL_TEST_THEME}:{})}}));
  const packaged=process.env.MDLXL_PACKAGED_EXE,flags=['--disable-gpu-vsync','--disable-frame-rate-limit'];
  const app=await _electron.launch({executablePath:packaged||path.join(root,'node_modules/electron/dist/electron.exe'),args:packaged?[...flags,fixture]:[...flags,root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile'),MDLVIS_GAME_DATA:process.env.MDLVIS_GAME_DATA||'D:\\Warcraft III'},timeout:90000});
  try{
    const page=await app.firstWindow();page.setDefaultTimeout(45000);
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1440,980);w.showInactive();});
    await page.getByRole('tab',{name:'demo.mdx',exact:true}).waitFor();
    // The UV Wrapper's library is the unchanged texture picker: no tabs, same title.
    await page.locator('.classic-view > .viewport [aria-label="3D model viewport"]').focus();await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();await page.locator('.uv-tab-window .uv-editor canvas').waitFor();
    await page.getByRole('button',{name:'Replace Texture…',exact:true}).click();
    const picker=page.locator('[aria-modal="true"][aria-label="Material and Texture Library"]');await picker.waitFor();
    assert.equal(await page.locator('.tl-tabs').count(),0);assert.equal(await picker.locator('h2').innerText(),'Material & Texture Library');
    await page.getByRole('searchbox',{name:'Search textures'}).fill('footman');
    const footmanTile=page.locator('.tl-tile').filter({hasText:/^Footman/}).first();await footmanTile.waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.tl-tile')].some(tile=>/textures\\footman\.(blp|dds)$/i.test(tile.title)));
    await page.evaluate(()=>[...document.querySelectorAll('.tl-tile')].find(tile=>/textures\\footman\.(blp|dds)$/i.test(tile.title)).click());
    const preview=page.getByRole('button',{name:'Preview Texture in Editor',exact:true});await page.waitForFunction(()=>{const b=[...document.querySelectorAll('.tl-actions button')].find(b=>b.textContent==='Preview Texture in Editor');return b&&!b.disabled;});
    await preview.click();
    const choice=page.getByRole('group',{name:'Material for this texture'});await choice.waitFor();
    assert.match(await choice.innerText(),/already in the model[\s\S]*Material \d+ \(geoset 1\) shows it/);
    await shot(page,'uv-picker-material-choice');
    await choice.getByRole('button',{name:'Use existing material',exact:true}).click();
    await picker.waitFor({state:'hidden'});
    checks.push('UV Replace Texture opens the unchanged texture picker; a texture already in the model asks for an existing or new material');
    await page.getByRole('button',{name:'Close UV Wrapper',exact:true}).click().catch(()=>{});
    // The toolbar Library button is the full viewer.
    await page.locator('[data-hotkey="textureLibrary"]').click();
    const library=page.locator('[aria-modal="true"][aria-label="Warcraft III Library"]');await library.waitFor();
    assert.deepEqual(await page.locator('.tl-tabs [role="tab"]').allInnerTexts(),['Textures','Models','Sounds','All files']);
    await page.getByRole('searchbox',{name:'Search textures'}).fill('painting');
    await page.waitForFunction(()=>/^\d[\d,]* textures/.test(document.querySelector('.tl-result-status')?.textContent||'')&&document.querySelectorAll('.tl-tile').length>0);
    const paintings=await page.locator('.tl-tile').evaluateAll(tiles=>tiles.map(tile=>tile.title));
    assert.ok(paintings.length>=20,'painting search finds artwork');
    assert.ok(paintings.every(title=>/loading|keyart|campaignselect|concept|scorescreen|backgrounds|victoryscreen|timeindicator|day-indicator|splash|blizzcon|homescreen|definitive|sketch/i.test(title)),paintings.filter(t=>!/loading|keyart|campaignselect|concept|scorescreen|backgrounds/i.test(t)).slice(0,5).join(', '));
    await page.waitForTimeout(1500);await shot(page,'painting-search');
    checks.push(`Vibe search "painting" lists ${paintings.length} illustrations only`);
    // Material prompt from the Library's Add button, making a new material.
    await page.getByRole('searchbox',{name:'Search textures'}).fill('footman');
    await page.waitForFunction(()=>[...document.querySelectorAll('.tl-tile')].some(tile=>/textures\\footman\.(blp|dds)$/i.test(tile.title)));
    await page.evaluate(()=>[...document.querySelectorAll('.tl-tile')].find(tile=>/textures\\footman\.(blp|dds)$/i.test(tile.title)).click());
    const add=page.getByRole('button',{name:'Texture already in model…',exact:true});await page.waitForFunction(()=>{const b=[...document.querySelectorAll('.tl-actions button')].find(b=>b.textContent==='Texture already in model…');return b&&!b.disabled;});
    await add.click();await choice.waitFor();await choice.getByRole('button',{name:'Make a new material',exact:true}).click();
    await page.getByText('Added a new material.',{exact:true}).waitFor();
    await page.waitForFunction(()=>/Added Material \d+ using Textures\\Footman\.blp/.test(document.body.innerText));
    checks.push('Add texture on an existing texture offers the choice and "Make a new material" adds one');
    // Models: browse like the game folders, view with mouse rotation, open in the editor.
    await page.getByRole('tab',{name:'Models',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search game files'}).waitFor();
    await page.waitForFunction(()=>/folders · [\d,]+ files/.test(document.querySelector('.tl-result-status')?.textContent||''));
    const rootFolders=await page.locator('.gf-row').allInnerTexts();assert.ok(rootFolders.some(text=>/^Units/.test(text)),rootFolders.join('|'));
    await page.locator('.gf-row').filter({hasText:/^Units/}).dblclick();
    await page.locator('.gf-crumbs').getByRole('button',{name:'Units',exact:true}).waitFor();
    await page.locator('.gf-row').filter({hasText:/^Human/}).dblclick();
    await page.locator('.gf-row').filter({hasText:/^Footman/}).first().dblclick();
    await page.locator('.gf-row').filter({hasText:/^Footman\.mdx/}).first().click();
    const stage=page.locator('.gf-model-stage canvas').first();await stage.waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('[aria-label="Model animation"] option')].length>3);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.waitForTimeout(2500);
    const box=await stage.boundingBox(),clip={x:box.x,y:box.y,width:box.width,height:box.height};
    const before=await page.screenshot({clip}),still=(await page.waitForTimeout(1500),await page.screenshot({clip}));
    assert.ok(before.equals(still),'paused model preview is static before dragging');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+120,box.y+box.height/2+30,{steps:12});await page.mouse.up();
    await page.waitForTimeout(2500);const after=await page.screenshot({clip});
    assert.ok(!before.equals(after),'a mouse drag turns the preview camera');
    await shot(page,'model-view');
    checks.push('Models tab: Units › Human › Footman, preview with animations, real mouse drag rotates the camera');
    await page.getByRole('button',{name:'Open in editor',exact:true}).click();
    await library.waitFor({state:'hidden'});await page.getByRole('tab',{name:'Footman.mdx',exact:true}).waitFor();
    await page.waitForTimeout(2500);await shot(page,'opened-in-editor');
    checks.push('Open in editor adds a Footman.mdx tab and closes the Library');
    // Sounds: search and play.
    await page.locator('[data-hotkey="textureLibrary"]').click();await library.waitFor();
    await page.getByRole('tab',{name:'Sounds',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search game files'}).fill('footmanyes');
    await page.waitForFunction(()=>/\d+ matching files/.test(document.querySelector('.tl-result-status')?.textContent||'')&&document.querySelector('.gf-row'));
    await page.locator('.gf-row').first().click();
    await page.waitForFunction(()=>{const audio=document.querySelector('.gf-audio');return audio&&audio.duration>0&&!audio.error;});
    const audio=await page.evaluate(()=>({duration:document.querySelector('.gf-audio').duration,src:!!document.querySelector('.gf-audio').src}));
    assert.ok(audio.duration>0.2&&audio.src);
    checks.push(`Sounds tab: a Footman voice line decodes and plays (${audio.duration.toFixed(2)} s)`);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.gf-row').nth(1).getAttribute('aria-selected'),'true','arrow keys step through the list after a click');
    checks.push('Arrow keys move through the list after clicking a row');
    // All files: text files show their contents.
    await page.getByRole('tab',{name:'All files',exact:true}).click();
    await page.getByLabel('File type',{exact:true}).selectOption('text');
    await page.getByRole('searchbox',{name:'Search game files'}).fill('unitui.slk');
    await page.waitForFunction(()=>/\d+ matching files/.test(document.querySelector('.tl-result-status')?.textContent||'')&&/^Unitui\.slk/i.test(document.querySelector('.gf-row')?.textContent||''));await page.locator('.gf-row').first().click();
    await page.waitForFunction(()=>/unitID|ID;|^ID/m.test(document.querySelector('.gf-text')?.textContent||''),null,{timeout:20000}).catch(async error=>{await shot(page,'text-file-failure');console.error(await page.locator('.gf-details').innerText());throw error;});
    await shot(page,'text-file');
    checks.push('All files tab: a game data table opens as text');
    await page.keyboard.press('Escape');
    await library.waitFor({state:'hidden',timeout:5000});
    checks.push('Escape closes the Library while the file list has focus');
    // MDLXL_TEST_THEME=dark repeats the whole flow with the dark palette.
    await page.locator('[data-hotkey="textureLibrary"]').click();await library.waitFor();
    await page.getByRole('tab',{name:'Models',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search game files'}).fill('footman');
    await page.waitForFunction(()=>/\d+ matching files/.test(document.querySelector('.tl-result-status')?.textContent||''));
    await page.locator('.gf-row').first().click();await page.locator('.gf-model-stage canvas').first().waitFor();await page.waitForTimeout(2500);
    await shot(page,'theme-'+(process.env.MDLXL_TEST_THEME||'light'));await page.keyboard.press('Escape');await library.waitFor({state:'hidden'});
    console.log('PASS:\n- '+checks.join('\n- '));
  }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
