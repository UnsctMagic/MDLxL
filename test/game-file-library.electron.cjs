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
    // Models, World Editor Style: races with icons, one central view that glides between models.
    const row=name=>page.locator('.gf-row').filter({has:page.locator('.gf-name',{hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).first();
    const stageClip=async()=>{const box=await page.locator('.gf-stage').boundingBox();return {x:box.x,y:box.y,width:box.width,height:box.height};};
    const waitModel=name=>page.waitForFunction(value=>document.querySelector('.gf-info h3')?.textContent===value&&!document.querySelector('.gf-stage-busy')&&document.querySelector('[aria-label="Model animation"]'),name,{timeout:45000});
    await page.getByRole('tab',{name:'Models',exact:true}).click();
    await page.getByRole('button',{name:'World Editor Style',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'World Editor Style',exact:true}).getAttribute('aria-pressed'),'true');
    await row('Human').waitFor();
    assert.deepEqual((await page.locator('.gf-row[aria-level="1"] .gf-name').allInnerTexts()).slice(0,9),['Human','Orc','Night Elf','Undead','Naga','Neutral Hostile','Neutral Passive','Items','Doodads']);
    await row('Human').click();await row('Units').click();await row('Normal').click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.gf-row img.gf-icon')].filter(img=>img.naturalWidth>0).length>=8,null,{timeout:45000});
    await row('Footman').click();await waitModel('Footman');
    await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(2500);
    const clip=await stageClip(),shownFootman=await page.screenshot({clip});
    await row('Heroes').click();await row('Units').click();await row('Buildings').click();await row('Normal').click();await page.waitForTimeout(1500);
    assert.ok(shownFootman.equals(await page.screenshot({clip})),'opening folders leaves the central view alone');
    await shot(page,'we-tree');
    checks.push('World Editor Style: Human … Items, Doodads with game icons; opening folders leaves the view unchanged');
    const box=await page.locator('.gf-stage canvas').first().boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+140,box.y+box.height/2+40,{steps:12});await page.mouse.up();
    await page.waitForTimeout(2000);
    assert.ok(!shownFootman.equals(await page.screenshot({clip})),'a mouse drag turns the camera');
    checks.push('A real mouse drag turns the camera in the central view');
    // A much larger model: the camera keeps its turned angle and glides out to frame it.
    await row('Altar of Kings').click();
    const frames=[];for(let i=0;i<8;i++){frames.push(await page.screenshot({clip}));await page.waitForTimeout(100);}
    await waitModel('Altar of Kings');await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(2000);
    frames.forEach((frame,i)=>fs.writeFileSync(path.join(out,`glide-${i}.png`),frame));await shot(page,'glide-end');
    checks.push('Choosing another model keeps the turned angle and glides to frame it (frames saved)');
    // Spells, doodads and items through World Editor search.
    const search=page.getByRole('searchbox',{name:'Search game files'});
    for(const [query,name,detail] of [['holy light','Holy Light',/Human › Spells › Heroes/],['mushrooms','Mushrooms',/Doodads › Ashenvale › Environment/],['crown of kings','Crown of Kings +5',/Items › /]]){
      await search.fill(query);await page.waitForFunction(()=>/match/.test(document.querySelector('.gf-tree-status')?.textContent||''));
      await page.locator('.gf-row').filter({hasText:detail}).filter({hasText:name}).first().click();await waitModel(name);
      await page.waitForFunction(()=>document.querySelector('.gf-row.selected img.gf-icon')?.naturalWidth>0,null,{timeout:15000}).catch(()=>{throw Error(name+' shows no icon in the list');});
      assert.equal(await page.locator('.gf-stage img, .gf-info img').count(),0,'icons stay in the folder list, never in the preview');
    }
    const cameraDistance=()=>page.evaluate(()=>{const host=document.querySelector('.gf-stage .game-preview-root');let fiber=host?.[Object.keys(host).find(key=>key.startsWith('__reactFiber'))];
      for(;fiber;fiber=fiber.return)for(let hook=fiber.memoizedState;hook;hook=hook.next){const state=hook.memoizedState?.current;if(state?.native&&state?.controls)return Math.round(state.controls.object.position.distanceTo(state.controls.target));}return null;});
    await page.waitForTimeout(2000);const chestDistance=await cameraDistance();
    assert.ok(chestDistance>150&&chestDistance<320,'the camera settles on the small treasure chest, not on the previous model or hidden geometry: '+chestDistance);
    await shot(page,'we-item');await search.fill('');
    checks.push('Spell (Holy Light effect), doodad (Ashenvale Mushrooms) and item (Crown of Kings) open from World Editor search');
    // Standard: the game's own folders, still with unit icons on model files.
    await page.getByRole('button',{name:'Standard',exact:true}).click();
    await row('Units').click();await row('Human').click();await row('Footman').click();
    await row('Footman.mdx').click();await waitModel('Footman.mdx');
    await page.waitForFunction(()=>[...document.querySelectorAll('.gf-row img.gf-icon')].some(img=>img.naturalWidth>0));
    await shot(page,'standard-tree');
    checks.push('Standard: Units › Human › Footman › Footman.mdx with its unit icon');
    await page.getByRole('button',{name:'World Editor Style',exact:true}).click();
    await row('Human').click();await row('Units').click();await row('Normal').click();
    await row('Footman').click();await waitModel('Footman');await row('Footman').dblclick();
    await library.waitFor({state:'hidden'});await page.getByRole('tab',{name:'Footman.mdx',exact:true}).waitFor();
    await page.waitForTimeout(2500);await shot(page,'opened-in-editor');
    checks.push('Double-clicking Footman opens it in the editor as a new tab');
    // Geoset box: pick geosets of a model, split them, import them, open only them.
    const editorModel=()=>page.evaluate(()=>{const host=document.querySelector('.classic-view > .viewport');let fiber=host?.[Object.keys(host).find(key=>key.startsWith('__reactFiber'))];
      for(;fiber;fiber=fiber.return){const model=fiber.memoizedProps?.model;if(model?.Geosets)return {geosets:model.Geosets.length,dummy:(model.Bones||[]).filter(bone=>bone.Name==='DummyBone').length};}return null;});
    const before=await editorModel();
    await page.locator('[data-hotkey="textureLibrary"]').click();await library.waitFor();
    await row('Human').click();await row('Units').click();await row('Normal').click();await row('Footman').click();await waitModel('Footman');
    const boxes=page.getByRole('listbox',{name:'Library geosets'}).getByRole('checkbox');
    const footmanGeosets=await boxes.count();assert.ok(footmanGeosets>=3,'the geoset box lists the model geosets');
    assert.equal(await page.locator('.gf-geosets .classic-geoset-count').innerText(),`${footmanGeosets} of ${footmanGeosets} selected`);
    await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(1500);
    const fullView=await page.screenshot({clip});
    await page.locator('.gf-geosets').getByRole('button',{name:'Clear',exact:true}).click();await boxes.nth(0).check();
    await page.getByLabel('View selected only',{exact:true}).check();await page.waitForTimeout(1500);
    assert.ok(!fullView.equals(await page.screenshot({clip})),'View selected only hides the other geosets');
    await shot(page,'geosets-selected-only');
    await page.getByLabel('View selected only',{exact:true}).uncheck();
    await page.locator('.gf-geosets').getByRole('button',{name:'All',exact:true}).click();
    await page.locator('.gf-geosets').getByRole('button',{name:'Seperate by Loose parts',exact:true}).click();
    await page.waitForFunction(count=>document.querySelectorAll('[aria-label="Library geosets"] input').length>count,footmanGeosets);
    const split=await boxes.count();
    checks.push(`Geoset box: ${footmanGeosets} Footman geosets, View selected only, Seperate by Loose parts → ${split} geosets without selecting vertices`);
    await page.locator('.gf-geosets').getByRole('button',{name:'Nuclear Seperation',exact:true}).click();await page.waitForTimeout(800);
    await page.locator('.gf-geosets').getByRole('button',{name:'Clear',exact:true}).click();await boxes.nth(0).check();await boxes.nth(1).check({modifiers:['Control']});
    assert.equal(await page.locator('.gf-geosets .classic-geoset-count').innerText(),`2 of ${await boxes.count()} selected`);
    await page.locator('.gf-geosets').getByRole('button',{name:'Import to current',exact:true}).click();
    await page.getByText(/^Imported 2 geosets into /).waitFor({timeout:20000}).catch(async error=>{await shot(page,'import-failure');console.error('INFO:',await page.locator('.gf-info').innerText());throw error;});
    await shot(page,'geosets-imported');
    await page.locator('.gf-geosets').getByRole('button',{name:'Open in editor',exact:true}).click();
    await library.waitFor({state:'hidden'});await page.waitForTimeout(1500);
    const opened=await editorModel();assert.equal(opened.geosets,2,'Open in editor keeps only the checked geosets');
    await page.getByRole('tab',{name:'Footman.mdx',exact:true}).first().waitFor();
    const tabs=page.getByRole('tab',{name:'Footman.mdx',exact:true});await tabs.nth((await tabs.count())-2).click();await page.waitForTimeout(1000);
    const imported=await editorModel();
    assert.equal(imported.geosets,before.geosets+2,'two geosets were imported into the model being edited');assert.ok(imported.dummy>=1,'imported geosets hang on DummyBone');
    await shot(page,'geosets-after-import');
    checks.push('Import to current adds the 2 checked geosets on DummyBone; Open in editor opens a tab with only those 2 geosets');
    // Sounds: search, play, arrow keys.
    await page.locator('[data-hotkey="textureLibrary"]').click();await library.waitFor();
    await page.getByRole('tab',{name:'Sounds',exact:true}).click();
    await search.fill('footmanyes');
    await page.waitForFunction(()=>/\d+ match/.test(document.querySelector('.gf-tree-status')?.textContent||'')&&document.querySelector('.gf-row'));
    await page.locator('.gf-row').first().click();
    await page.waitForFunction(()=>{const audio=document.querySelector('.gf-audio');return audio&&audio.duration>0&&!audio.error;});
    const audio=await page.evaluate(()=>document.querySelector('.gf-audio').duration);assert.ok(audio>0.2);
    checks.push(`Sounds tab: a Footman voice line decodes and plays (${audio.toFixed(2)} s)`);
    const firstSound=await page.locator('.gf-row').first().getAttribute('data-row');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(first=>{const row=document.querySelector('.gf-row[aria-selected="true"]');return row&&row.dataset.row!==first;},firstSound);
    checks.push('Arrow keys move through the list after clicking a row');
    // All files: text files show their contents.
    await page.getByRole('tab',{name:'All files',exact:true}).click();
    await page.getByLabel('File type',{exact:true}).selectOption('text');
    await search.fill('unitui.slk');
    await page.waitForFunction(()=>/match/.test(document.querySelector('.gf-tree-status')?.textContent||'')&&/^Unitui\.slk/i.test(document.querySelector('.gf-row .gf-name')?.textContent||''));await page.locator('.gf-row').first().click();
    await page.waitForFunction(()=>/ID;/.test(document.querySelector('.gf-text')?.textContent||''),null,{timeout:20000});
    await shot(page,'text-file');
    checks.push('All files tab: a game data table opens as text');
    await page.keyboard.press('Escape');
    await library.waitFor({state:'hidden',timeout:5000});
    checks.push('Escape closes the Library while the file list has focus');
    // MDLXL_TEST_THEME=dark repeats the whole flow with the dark palette.
    await page.locator('[data-hotkey="textureLibrary"]').click();await library.waitFor();
    await page.getByRole('tab',{name:'Models',exact:true}).click();
    await row('Orc').click();await row('Units').click();await row('Heroes').click();await row('Blademaster').click();await waitModel('Blademaster');await page.waitForTimeout(2000);
    await shot(page,'theme-'+(process.env.MDLXL_TEST_THEME||'light'));await page.keyboard.press('Escape');await library.waitFor({state:'hidden'});
    console.log('PASS:\n- '+checks.join('\n- '));
  }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
