const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,bundleHashes}=require('./helpers/app.cjs');
const {fixturePath,gameFolder}=require('./helpers/fixtures.cjs');
const {click,type,orbit}=require('./helpers/library-browser.cjs');
(async()=>{
 const out=path.resolve('out/library-browser-integration'),checks=[];await fs.mkdir(out,{recursive:true});
 const folder=await gameFolder();
 const record=message=>{checks.push(message);console.log('PASS '+message);};
 let app;
 try{
  const launched=await launchApp({out,fixture:fixturePath('footman'),show:'hide',bounds:{x:0,y:0,width:1500,height:1000},settings:{gameData:folder,preferences:{checkUpdatesOnStartup:false}},env:{MDLVIS_GAME_DATA:folder},pageTimeout:45000});app=launched.app;const page=launched.page;
  await page.getByRole('tab',{name:'Footman.mdx',exact:true}).waitFor();
  const button=name=>page.getByRole('button',{name,exact:true}),lib=page.getByRole('dialog',{name:'Warcraft III Library',exact:true});
  const row=name=>lib.getByRole('treeitem',{name,exact:true});
  const open=async()=>{await click(page,button('Material and Texture Library'));await lib.waitFor();await click(page,page.getByRole('tab',{name:'Models',exact:true}));await row('Human').waitFor();};
  const ready=name=>page.waitForFunction(name=>document.querySelector('.gf-info h3')?.textContent===name&&!document.querySelector('.gf-stage-busy')&&mdlxlProbe('.gf-stage .game-preview-root').runtime?.captureApi?.isReady,name);
  await open();await click(page,button('World Editor Style'));
  await click(page,row('Human'));await page.keyboard.press('ArrowLeft');assert.equal(await row('Human').getAttribute('aria-expanded'),'false');
  await page.keyboard.press('ArrowRight');await row('Units').waitFor();await page.keyboard.press('ArrowDown');assert.ok((await lib.locator('.gf-row.focused').innerText()).startsWith('Units'));
  await page.keyboard.press('ArrowRight');await row('Normal').waitFor();await page.keyboard.press('ArrowDown');assert.ok((await lib.locator('.gf-row.focused').innerText()).startsWith('Normal'));await page.keyboard.press('ArrowRight');
  await click(page,row('Footman'));await ready('Footman');await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>{const selected=document.querySelector('.gf-row.selected');return selected&&!selected.classList.contains('folder')&&selected.getAttribute('aria-label')!=='Footman'&&!document.querySelector('.gf-stage-busy');});
  await click(page,row('Footman'));await ready('Footman');await orbit(page,lib.locator('.gf-stage'));await click(page,row('Footman'));await ready('Footman');await page.keyboard.press('Enter');await lib.waitFor({state:'hidden'});await page.getByRole('tab',{name:'Footman.mdx',exact:true}).and(page.locator('[aria-selected="true"]')).waitFor();record('Models: real Left/Right/Down navigation, native preview, camera drag and Enter opens Footman');
  await open();await click(page,row('Human'));await click(page,row('Units'));await click(page,row('Normal'));await click(page,row('Footman'),{clickCount:2});await lib.waitFor({state:'hidden'});await page.getByRole('tab',{name:'Footman.mdx',exact:true}).and(page.locator('[aria-selected="true"]')).waitFor();record('World Editor model double-click opens the native model');
  await open();await click(page,button('Standard'));for(const name of ['Units','Human','Footman'])await click(page,row(name));await click(page,row('Footman.mdx'));await ready('Footman.mdx');assert.equal(await button('Standard').getAttribute('aria-pressed'),'true');await click(page,button('World Editor Style'));assert.equal(await button('World Editor Style').getAttribute('aria-pressed'),'true');await row('Human').waitFor();record('Models: Standard native folders and World Editor Style toggle retain both layouts');
  await click(page,page.getByRole('tab',{name:'Sounds',exact:true}));const search=page.getByRole('searchbox',{name:'Search game files'});await type(page,search,'footmanyes');const voice=lib.getByRole('treeitem',{name:/^Footmanyes1\.(ogg|flac|wav)$/i});await voice.waitFor();await click(page,voice);await page.waitForFunction(()=>document.querySelector('.gf-audio')?.duration>0);const first=await lib.locator('.gf-row.selected').getAttribute('data-row');await page.keyboard.press('ArrowDown');await page.waitForFunction(first=>document.querySelector('.gf-row.selected')?.dataset.row!==first&&document.querySelector('.gf-audio')?.duration>0,first);record('Sounds: native voice decodes; real ArrowDown changes the selected voice');
  await click(page,page.getByRole('tab',{name:'All files',exact:true}));await type(page,search,'footman.mdx');const nativeModel=lib.getByRole('treeitem',{name:'Footman.mdx',exact:true}).first();await nativeModel.waitFor();assert.ok(await page.getByLabel('File type',{exact:true}).isVisible());await click(page,nativeModel);await page.waitForFunction(()=>document.querySelector('.gf-info code')?.textContent.toLowerCase().endsWith('footman.mdx')&&!document.querySelector('.gf-stage-busy'));await orbit(page,lib.locator('.gf-stage'));record('All files: file-type control, native file search and rotating model preview');
  assert.deepEqual(launched.errors,[]);await lib.screenshot({path:path.join(out,'all-files.png')});
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({bundle:bundleHashes(),passed:checks.length,failed:0,skipped:0,checks},null,2));console.log('PASS '+checks.length+' integrated main Library checks\n'+checks.join('\n'));
 }catch(error){if(app)await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
