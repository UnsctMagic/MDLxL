// A window's catalog Close works from text inputs without stealing number Escape.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,settle}=require('./helpers/app.cjs');
(async()=>{
 const out=path.resolve('out/escape-input');fs.mkdirSync(out,{recursive:true});
 const {createDemoDocument}=await import('../src/editor-document.js');const fixture=path.join(out,'EscapeInput.mdx');fs.writeFileSync(fixture,createDemoDocument().serialize('mdx'));
 const {app,page,errors}=await launchApp({out,fixture,settings:{preferences:{language:'en',theme:'light',updateOfferAnswered:true,modelLookAnswered:true}},show:'inactive',bounds:{x:0,y:0,width:1440,height:1000}});
 const checks=[];
 try{
  await page.locator('.classic-toolbar').waitFor();
  await page.evaluate(()=>{window.closeKeyUses=[];window.addEventListener('mdlxl-hotkey-used',event=>window.closeKeyUses.push(event.detail.id));});
  await page.locator('.classic-view > .viewport [aria-label="3D model viewport"]').focus();await page.keyboard.press('Control+a');await page.locator('[data-hotkey="uv"]').click();await page.locator('.uv-tab-window .uv-editor canvas').waitFor();
  await page.getByRole('button',{name:'Replace Texture…',exact:true}).click();
  const modal=page.locator('.uv-tab-window [aria-modal="true"]');await modal.waitFor();
  await page.waitForFunction(()=>document.querySelector('.tl-dialog [data-hotkey="close"]')?.getAttribute('data-hotkey-shortcuts')==='Escape');
  const search=page.getByLabel('Search textures',{exact:true});await search.fill('shared-close-proof');assert.ok(await search.evaluate(e=>e===document.activeElement));
  await search.press('Escape');await modal.waitFor({state:'hidden'});
  assert.equal(await page.locator('.uv-tab-window').count(),1,'Only the inner library closes');
  const uses=await page.evaluate(()=>window.closeKeyUses);assert.equal(uses.filter(id=>id.endsWith('texture-library:close')).length,1,'The catalog Close runs and reports its key use');
  checks.push('UV Texture Library: Escape closes from Search through the catalog; UV stays open');
  await page.getByRole('button',{name:'Close UV Wrapper',exact:true}).click();
  await page.keyboard.press('Control+k');const settings=page.getByRole('dialog',{name:'Settings',exact:true});await settings.waitFor();
  await page.waitForFunction(()=>document.querySelector('.settings-window [data-hotkey="close"]')?.getAttribute('data-hotkey-shortcuts')==='Escape');
  const hotkeySearch=page.getByLabel('Search Hotkeys',{exact:true});await hotkeySearch.fill('rotation');await hotkeySearch.press('Escape');await settings.waitFor({state:'hidden'});
  checks.push('Settings: Escape closes while Search Hotkeys has focus');
  await page.getByRole('button',{name:'Showcase',exact:true}).first().click();await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
  await page.locator('.showcase-preset-actions').first().getByRole('button',{name:'Save preset',exact:true}).click();const preset=page.getByRole('dialog',{name:'Save preset',exact:true});await preset.waitFor();
  const name=page.getByLabel('Showcase preset name',{exact:true});await name.fill('Do not save');await name.press('Escape');await preset.waitFor({state:'hidden'});
  checks.push('Showcase: Escape closes a dialog from an ordinary text field');
  assert.deepEqual(errors,[]);await settle(page,100);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));
 }catch(error){await page.screenshot({path:path.join(out,'failure.png'),timeout:4000}).catch(()=>{});throw error;}finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
