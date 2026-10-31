// Contract verification through real clicks, keys and drags on the hidden desktop.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launchApp, closeApp, stubDialogs, appDist } = require('./helpers/app.cjs');
const { fixturePath, testModel } = require('./helpers/fixtures.cjs');
(async () => {
  const out = path.resolve('out/top-bar-layout'); fs.mkdirSync(out, { recursive: true });
  const settingsPath = process.env.MDLXL_LAYOUT_SETTINGS;
  const settings = settingsPath ? JSON.parse(fs.readFileSync(settingsPath)) : undefined;
  const originalSettings = settingsPath && fs.readFileSync(settingsPath);
  const checks = [], capture = (page, name) => page.screenshot({ path: path.join(out, name + '.png') });
  const fixture = fixturePath('citadel-footman');
  // Test inputs are copies of a real Blizzard model; the permanent collection is read-only.
  const { openDocument } = await import(pathToFileURL(path.resolve('src/editor-document.js')));
  const duplicate = openDocument(fs.readFileSync(fixture), 'Duplicate Footman.mdx');
  duplicate.apply('Duplicate warning fixture', ['GeosetAnims'], model => {
    const record = model.GeosetAnims.find(item => item.GeosetId === 0) || { GeosetId: 0, Flags: 0, Alpha: 1, Color: null };
    if (!model.GeosetAnims.includes(record)) model.GeosetAnims.push(record);
    model.GeosetAnims.push(structuredClone(record));
  });
  const duplicatePath = path.join(out, 'Duplicate Footman.mdx'); fs.writeFileSync(duplicatePath, Buffer.from(duplicate.serialize('mdx')));
  const invalidPath = path.join(out, 'Invalid.mdx'); fs.writeFileSync(invalidPath, 'invalid model');
  const readOnlyPath = path.join(out, 'Read-only.mdl'); fs.writeFileSync(readOnlyPath, 'Version { FormatVersion 800, }\nModel "quoted \\" name" {}');
  const hd = openDocument(fs.readFileSync(fixture), 'HD Footman.mdx'); hd.convertVersion(1000);
  hd.apply('HD warning fixture', ['Materials'], model => { model.Materials[0].Shader = 'Shader_HD_DefaultUnit'; });
  const hdPath = path.join(out, 'HD Footman.mdx'); fs.writeFileSync(hdPath, Buffer.from(hd.serialize('mdx')));
  const { app, page, errors } = await launchApp({ out, fixture, settings, bounds: { x: 0, y: 0, width: 1280, height: 920 } });
  const open = async file => {
    await stubDialogs(app, { open: file }); await page.keyboard.press('Control+o');
    await page.getByRole('tab', { name: path.basename(file), exact: true }).waitFor();
    await page.waitForFunction(name => window.__mdlxl.document()?.name === name, path.basename(file));
  };
  const noChatter = async target => assert.doesNotMatch(await target.locator('.classic-status').innerText(), /Ready|Opened|Saved|Modified|editor \(F|Human UI/);
  const topGeometry = async () => {
    const rects = await page.evaluate(() => {
      const rect = el => { const r=el.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height }; };
      return { width:innerWidth, group:rect(document.querySelector('.toolbar-model')), primary:rect(document.querySelector('.toolbar-primary')), dock:rect(document.querySelector('.toolbar-modules')), items:[...document.querySelector('.toolbar-model').children].map(rect), bottom:rect(document.querySelector('.classic-status')), viewport:rect(document.querySelector('.classic-view')) };
    });
    assert.ok(rects.group.right <= rects.primary.right + 1, 'all model controls fit without horizontal clipping');
    assert.ok(rects.primary.right <= rects.dock.x + 1, 'model controls do not overlap the unchanged module dock');
    assert.ok(rects.dock.right <= rects.width + 1, 'module dock stays on screen');
    assert.equal(Math.round(rects.bottom.height), 26, 'bottom row keeps its default-look height');
    return rects;
  };
  try {
    await page.getByRole('tab', { name: 'Footman.mdx', exact: true }).waitFor();
    assert.equal(await page.locator('.toolbar-model [data-hotkey="convertVersion"]').count(), 1, 'MDX conversion belongs to the top model group');
    assert.equal(await page.locator('.classic-status .model-tab').count(), 1, 'one open model stays visible in the bottom row');
    assert.equal(await page.locator('.classic-modules .model-tabs-bar,.classic-modules .module-divider').count(), 0);
    assert.match(await page.locator('.toolbar-model .compact-input-strength').innerText(), /DPI.*Scroll/s);
    if (settings) assert.match(await page.locator('.compact-input-strength').innerText(), new RegExp('DPI '+settings.preferences.pointerSensitivity+'×'));
    await topGeometry(); await noChatter(page);
    await page.locator('.editor-modules [data-hotkey="animations"]').click();
    await page.waitForFunction(() => window.mdlxlProbe()?.runtime?.controls);
    await capture(page, 'xl-one-model'); checks.push('1280 px: shared top controls, no empty editor row, one bottom tab, real owner settings');

    const error = page.locator('.warning-toast:not([data-persistent])').filter({hasText:'This file has no readable model header.'});
    const forceError = async () => { await stubDialogs(app, { open: invalidPath }); await page.keyboard.press('Control+o'); await error.waitFor(); };
    await forceError();
    const before = await page.evaluate(() => mdlxlProbe().runtime.controls.object.quaternion.toArray());
    const box = await page.locator('.game-preview-root canvas').first().boundingBox();
    await page.mouse.move(box.x + box.width*.65, box.y + box.height*.35);
    await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(box.x + box.width*.8, box.y + box.height*.45, {steps:10}); await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForFunction(previous => mdlxlProbe().runtime.controls.object.quaternion.toArray().some((v,i)=>Math.abs(v-previous[i])>.001), before);
    assert.equal(await error.count(), 1, 'camera drag leaves the warning visible');
    const warningBox = await error.boundingBox(), viewBox = await page.locator('.classic-view').boundingBox();
    assert.ok(warningBox.x >= viewBox.x && warningBox.y+warningBox.height <= viewBox.y+viewBox.height && warningBox.y+warningBox.height >= viewBox.y+viewBox.height-12, 'warning sits just above the timeline inside the viewport');
    await capture(page,'xl-error-and-camera');
    await page.waitForFunction(() => document.querySelector('.warning-toast')?.getAnimations().some(a=>a.animationName==='warning-fade' && a.currentTime>800));
    await forceError(); assert.equal(await error.count(),1,'repeated errors do not stack');
    await page.waitForFunction(() => document.querySelector('.warning-toast')?.getAnimations().some(a=>a.animationName==='warning-fade' && a.currentTime<700));
    await page.waitForFunction(() => { const el=document.querySelector('.warning-toast:not([data-persistent])');const opacity=el&&Number(getComputedStyle(el).opacity);return opacity>0 && opacity<.9; },null,{polling:30});
    await capture(page,'xl-fading-error'); await error.waitFor({state:'detached'}); await capture(page,'xl-faded-error');
    await forceError(); await error.locator('button').click(); await error.waitFor({state:'detached'});
    checks.push('error location, repeat timer, one copy, visible fade, auto removal, click dismissal, actual Alt+mouse orbit with warning visible');

    await page.locator('.toolbar-model [data-hotkey="convertVersion"]').click();
    await page.waitForFunction(() => window.__mdlxl.model().Version === 1000);
    assert.equal(await page.locator('.model-tab.active .model-tab-dirty').innerText(),'●');
    await page.keyboard.press('Control+z'); await page.waitForFunction(() => window.__mdlxl.model().Version===800);
    assert.equal(await page.locator('.model-tab.active .model-tab-dirty').innerText(),'');
    await noChatter(page); checks.push('top MDX convert remains functional; bottom dirty dot and Undo retained');
    for(const name of ['Ogre.mdx','Medivh.mdx','Guldan.mdx']) await open(testModel('pose',name));
    assert.equal(await page.locator('.classic-status .model-tab').count(),4); await capture(page,'xl-four-models');
    await page.getByRole('tab',{name:'Footman.mdx',exact:true}).click();
    await page.waitForFunction(()=>window.__mdlxl.document().name==='Footman.mdx');
    await page.getByRole('tab',{name:'Guldan.mdx',exact:true}).click({button:'middle'});
    await page.getByRole('tab',{name:'Guldan.mdx',exact:true}).waitFor({state:'detached'});
    await page.getByRole('button',{name:'Close Ogre.mdx',exact:true}).click();
    await page.getByRole('tab',{name:'Ogre.mdx',exact:true}).waitFor({state:'detached'});
    assert.equal(await page.locator('.classic-status .model-tab').count(),2);
    for(let i=0;i<10;i++) {
      const file=path.join(out,'Warcraft Footman long shared filename '+i+'.mdx');fs.copyFileSync(fixture,file);await open(file);
    }
    await page.getByRole('button',{name:'Scroll model tabs left',exact:true}).waitFor();
    const strip=page.locator('.model-tabs');const scrollBefore=await strip.evaluate(el=>el.scrollLeft);
    await strip.hover();await page.mouse.wheel(0,-600);
    await page.waitForFunction(previous=>document.querySelector('.model-tabs').scrollLeft<previous,scrollBefore);
    await page.getByRole('tab',{name:'Footman.mdx',exact:true}).click();
    await page.waitForFunction(()=>window.__mdlxl.document().name==='Footman.mdx');
    checks.push('four-model layout, regular and middle click, close ×, overflow arrows, wheel scroll and active-tab reveal');
    for(let i=0;i<10;i++) await page.getByRole('button',{name:'Close Warcraft Footman long shared filename '+i+'.mdx',exact:true}).click();
    for(const name of ['Ogre.mdx','Guldan.mdx']) await open(testModel('pose',name));

    await open(duplicatePath);
    const repair=page.getByRole('button',{name:'Duplicate geoset animations',exact:true});await repair.waitFor();
    await repair.click();const dialog=page.getByRole('dialog',{name:'Duplicate geoset animations',exact:true});await dialog.waitFor();
    await capture(page,'xl-duplicate-repair');await dialog.getByRole('button',{name:'Not now',exact:true}).click();
    await page.getByRole('button',{name:'Dismiss Duplicate geoset animations',exact:true}).click();await repair.waitFor({state:'detached'});
    await page.getByRole('button',{name:'Close Duplicate Footman.mdx',exact:true}).click();
    checks.push('duplicate-animation action opens the unchanged repair dialog and can be dismissed');
    await open(readOnlyPath);
    await page.locator('.warning-message').filter({hasText:'Read-only model; original data retained.'}).waitFor();
    assert.equal(await page.locator('.toolbar-model [data-hotkey="convertVersion"]').isDisabled(),true);
    await forceError();assert.equal(await page.locator('.warning-toast').count(),2,'at most two distinct warnings, newest first');
    assert.match(await page.locator('.warning-toast').first().innerText(),/no readable model header/);
    while(await page.locator('.warning-message').count()) await page.locator('.warning-message').first().click();
    await page.getByRole('button',{name:'Close Read-only.mdl',exact:true}).click();
    await open(hdPath);
    await page.locator('.warning-message').filter({hasText:'This model is open view-only; saving is disabled.'}).waitFor();
    await page.getByRole('dialog',{name:'HD models',exact:true}).getByRole('button',{name:'Open view-only',exact:true}).click();
    assert.equal(await page.locator('.toolbar-model [data-hotkey="convertVersion"]').isDisabled(),true);
    await page.locator('.warning-message').click();await page.getByRole('button',{name:'Close HD Footman.mdx',exact:true}).click();
    checks.push('read-only and HD warnings remain visible; conversion disabled; two distinct warnings capped and newest first');
    await page.locator('.vis-toggle').click();await page.locator('.classic-app[data-vis-ui]').waitFor();
    assert.equal(await page.locator('.toolbar-model').count(),0);assert.equal(await page.locator('.classic-toolbar .compact-input-strength').count(),1);
    assert.equal(await page.locator('.classic-status .model-tab').count(),4);await noChatter(page);await capture(page,'vis-four-models');
    for(const name of ['Medivh.mdx','Ogre.mdx','Guldan.mdx']) await page.getByRole('button',{name:'Close '+name,exact:true}).click();
    assert.equal(await page.locator('.classic-status .model-tab').count(),1);
    await forceError();await capture(page,'vis-error');await error.waitFor({state:'detached'});
    await capture(page,'vis-faded');checks.push('VIS keeps its top DPI/Scroll, bottom tabs and fading warnings');
    await page.locator('.vis-toggle').click();await page.locator('.toolbar-model').waitFor();
    await page.getByRole('tab',{name:'Footman.mdx',exact:true}).click();
    await page.waitForFunction(()=>window.__mdlxl.document().name==='Footman.mdx');
    const nativeSettings=await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='Settings').submenu.items.map(item=>({label:item.label,type:item.type,enabled:item.enabled})));
    const addonIndex=nativeSettings.findIndex(item=>item.label==='Add-ons…');assert.ok(addonIndex>=0);assert.equal(nativeSettings[addonIndex+1].type,'separator');assert.equal(nativeSettings[addonIndex].enabled,true);

    // The native template is checked in addons.test.js. This second packaged
    // renderer has no desktop preload, so real clicks exercise the browser menu.
    const waiting=app.waitForEvent('window').catch(()=>null);
    await app.evaluate(async ({BrowserWindow},file)=>{
      globalThis.layoutBrowser=new BrowserWindow({show:false,width:1280,height:920,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
      globalThis.layoutBrowser.setMenu(null);await globalThis.layoutBrowser.loadFile(file);globalThis.layoutBrowser.showInactive();
    },path.join(appDist(),'index.html'));
    const browser=await waiting;browser.setDefaultTimeout(15000);browser.on('pageerror',e=>errors.push(e.message));
    await browser.locator('.classic-menu').waitFor();
    const settingsMenu=browser.locator('.classic-menu details').filter({has:browser.locator('summary',{hasText:/^Settings$/})});
    const openAddons=async()=>{await settingsMenu.locator('summary').click();await settingsMenu.getByRole('menuitem',{name:'Add-ons…',exact:true}).click();await browser.getByRole('dialog',{name:'Add-ons',exact:true}).waitFor();};
    await settingsMenu.locator('summary').click();await capture(browser,'settings-menu');
    await settingsMenu.getByRole('menuitem',{name:'Add-ons…',exact:true}).click();
    const addons=browser.getByRole('dialog',{name:'Add-ons',exact:true});await addons.waitFor();
    const panelBox=await addons.boundingBox();assert.ok(panelBox.x>=0 && panelBox.y>=0 && panelBox.x+panelBox.width<=1280 && panelBox.y+panelBox.height<=920,'existing Add-ons panel opens on screen near the top');
    const chooser=browser.waitForEvent('filechooser');await addons.getByRole('button',{name:'Install manifest…',exact:true}).click();await (await chooser).setFiles(path.resolve('Addons/inspection-example.json'));
    const manifest=JSON.parse(fs.readFileSync('Addons/inspection-example.json'));await addons.getByText(manifest.name,{exact:true}).waitFor();
    await capture(browser,'addons-panel');
    const enabled=addons.getByRole('checkbox',{name:manifest.name,exact:true});await enabled.uncheck();assert.equal(await addons.getByRole('button',{name:manifest.actions[0].label,exact:true}).count(),0);await enabled.check();
    await addons.getByRole('button',{name:manifest.actions[0].label,exact:true}).click();await addons.waitFor({state:'detached'});
    await openAddons();await addons.getByRole('button',{name:'Close add-ons',exact:true}).click();await addons.waitFor({state:'detached'});
    await openAddons();await addons.getByRole('button',{name:'Remove',exact:true}).click();await addons.getByText('No add-ons installed.',{exact:true}).waitFor();
    await browser.keyboard.press('Escape');await addons.waitFor({state:'detached'});
    await app.evaluate(()=>globalThis.layoutBrowser.destroy());
    checks.push('packaged browser Settings → Add-ons, top anchor, install/list/enable/disable/run/remove, close × and Escape');
    assert.equal(errors.length,0,errors.join('\n'));if(settingsPath)assert.deepEqual(fs.readFileSync(settingsPath),originalSettings,'real settings file unchanged');
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,settingsPath,dpi:process.env.MDLXL_VARIANT_ARGS||'default',nativeMenu:'template verified in source; browser fallback clicked in packaged renderer'},null,2));
    for(const check of checks)console.log('PASS '+check);
  } catch(error) { await capture(page,'failure').catch(()=>{});throw error; }
  finally { await closeApp(app); }
})().catch(error=>{console.error(error);process.exitCode=1;});
