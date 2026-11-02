const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp, prepareWindow, stubDialogs } = require('./helpers/app.cjs');
const { fixturePath, testModel } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve('out/shift-lock-badge');
  const { app, page } = await launchApp({fixture: fixturePath('footman'), out, profile: path.join(out, 'profile'), bounds: {width: 1280, height: 920}});
  try {
    const viewport = page.getByLabel('3D model viewport', {exact: true});
    await viewport.waitFor();
    await page.getByLabel('Select geoset 0', {exact: true}).check();
    await viewport.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('m');
    const enabled = page.getByLabel('Workplane Constraints', {exact: true});
    await enabled.check();
    const badge = page.locator('.shift-lock-badge:visible');
    async function drag(target, label, capture) {
      const b = await target.boundingBox();
      const x = Math.round(b.x + b.width * (capture ? .62 : .47)), y = Math.round(b.y + b.height * (capture ? .33 : .45));
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 20, y + 8, {steps: 4});
      assert.equal(await badge.count(), 0);
      await page.keyboard.down('Shift');
      await page.mouse.move(x + 54, y + 9, {steps: 4});
      if (label) {
        await badge.waitFor({timeout: 3000}).catch(async e => {
          const details = await page.evaluate(({x,y}) => {
            const el = document.querySelector('[aria-label="3D model viewport"]'), state = el && findFiberState(el,r=>r?.renderer&&r?.entries);
            return {hit:document.elementFromPoint(x,y)?.outerHTML.slice(0,120), counts:document.querySelector('.classic-counts')?.textContent, action:state?.drag?.action, node:!!state?.nodeDrag, plane:state?.drag?.workplane, enabled:state?.drag?.workplaneEnabled, axis:state?.drag?.screenMotion?.axis, translation:state?.drag?.payload?.translation, info:document.querySelector('.game-gesture-label')?.textContent};
          },{x,y});
          throw Error(target + ' expected '+ label + ' ' + JSON.stringify(details) + ': ' + e.message);
        });
        assert.equal(await badge.innerText(), label);
        await page.waitForFunction(({x,y}) => {
          const r = document.querySelector('.shift-lock-badge')?.getBoundingClientRect();
          return r && Math.abs(r.x-x-68) < 2 && Math.abs(r.y-y-23) < 2;
        }, {x,y}, {timeout:3000});
        if (capture) await page.screenshot({path: path.join(out, capture + '.png')});
      } else {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await badge.count(), 0);
      }
      if (capture === 'dark') {
        await page.keyboard.press('Escape'); await badge.waitFor({state:'hidden'});
        await page.mouse.up(); await page.keyboard.up('Shift');
      } else if (capture === 'vis') {
        await page.mouse.up(); await badge.waitFor({state:'hidden'}); await page.keyboard.up('Shift');
        await page.keyboard.press('Control+z');
      } else {
        await page.keyboard.up('Shift'); await badge.waitFor({state:'hidden'});
        await page.keyboard.press('Escape'); await page.mouse.up();
      }
    }
    for (const [plane, label] of [['ZX','Z'], ['XY','X'], ['YZ','Y']]) {
      await page.getByLabel(plane + ' workplane', {exact:true}).check();
      await drag(viewport, label, plane === 'ZX' ? 'light' : null);
    }
    await enabled.uncheck(); await drag(viewport, null);
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    await page.waitForFunction(() => findFiberState(document.querySelector('[aria-label="3D model viewport"]'),r=>r?.renderer && r?.entries)?.gizmoHandles?.length);
    const handles = await viewport.evaluate(el => {
      const state = findFiberState(el, r => r?.renderer && r?.entries);
      const rect = state.controls.domElement.getBoundingClientRect();
      return [state.gizmoHandles.find(h => h.axis === 'X' && !h.plane), state.gizmoHandles.find(h => h.plane === 'xy')].map(h => ({x:rect.x+h.x,y:rect.y+h.y}));
    });
    for (const h of handles) {
      await page.mouse.move(h.x,h.y); await page.mouse.down(); await page.keyboard.down('Shift');
      await page.mouse.move(h.x+33,h.y+12,{steps:8});
      await page.waitForFunction(() => findFiberState(document.querySelector('[aria-label="3D model viewport"]'),r=>r?.renderer && r?.entries)?.drag?.handle);
      assert.equal(await badge.count(),0,'constraints-off handle stays badge-free');
      await page.mouse.up(); await page.keyboard.up('Shift'); await page.keyboard.press('Control+z');
    }
    await enabled.check(); await page.locator('.classic-sidebar').getByRole('button',{name:'Rotate',exact:true}).click(); await drag(viewport, null);
    await page.locator('.classic-sidebar').getByRole('button',{name:'Move',exact:true}).click();
    await page.locator('.classic-sidebar').getByRole('button',{name:'Resize',exact:true}).click();
    await drag(viewport,null);
    await page.locator('.classic-sidebar').getByRole('button',{name:'Move',exact:true}).click();
    await page.keyboard.press('Shift+F1');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await drag(viewport,'Y','dark');
    await page.locator('.vis-toggle').click();
    await page.waitForFunction(() => document.querySelector('.classic-app[data-vis-ui]'));
    await drag(viewport,'Y','vis');
    await page.locator('.vis-toggle').click();
    await page.getByRole('button', {name:'Quad View',exact:true}).click();
    await page.locator('[data-viewport="front"]').click({position:{x:45,y:45}});
    await page.keyboard.press('Control+a');
    await page.locator('.classic-sidebar').getByRole('button',{name:'Move',exact:true}).click();
    for (const [id, label] of [['front','Y'],['side','X'],['top','Y'],['perspective','XY']]) {
      const pane = page.locator('[data-viewport="'+id+'"]');
      if (id === 'perspective') await pane.getByRole('checkbox').check();
      await drag(pane,label);
      const quaternion = () => viewport.evaluate(el => findFiberState(el, r=>r?.renderer && r?.entries).camera.quaternion.toArray());
      const before = await quaternion(), b = await pane.boundingBox();
      const x=b.x+b.width*.6, y=b.y+b.height*.6;
      await page.mouse.move(x,y); await page.keyboard.down('Alt'); await page.mouse.down();
      await page.mouse.move(x+40,y+24,{steps:8}); await page.mouse.up(); await page.keyboard.up('Alt');
      assert.notDeepEqual(await quaternion(),before,id + ' mouse orbit');
    }
    await page.getByRole('button', {name:'Quad View',exact:true}).click();
    await page.getByRole('button',{name:'Forge',exact:true}).click();
    const forge = page.getByRole('dialog',{name:'Forge',exact:true});
    await forge.getByRole('button',{name:'Cube',exact:true}).click();
    await forge.getByLabel('Workplane Constraints',{exact:true}).check();
    await forge.getByLabel('ZX workplane',{exact:true}).check();
    await forge.getByRole('button',{name:'Move',exact:true}).click();
    await drag(forge.getByLabel('3D model viewport',{exact:true}),'Z');
    await forge.getByRole('button',{name:'Close Forge',exact:true}).click();
    await page.locator('[data-hotkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('Movement bone or node').selectOption('0');
    const tools = page.getByRole('group',{name:'Movement tool',exact:true});
    const canvas = page.locator('[data-clean-model-canvas]');
    await tools.getByRole('button',{name:'Move',exact:true}).click();
    await enabled.check(); await page.locator('[data-hotkey="plane:yz"]').check();
    await drag(canvas,'Y');
    await page.getByRole('button',{name:'POSE',exact:true}).click();
    await page.getByLabel('Movement bone or node').selectOption('0');
    await tools.getByRole('button',{name:'Move',exact:true}).click();
    await enabled.check(); await page.locator('[data-hotkey="plane:xz"]').check();
    await drag(canvas,'Z');
    await page.locator('[data-hotkey="vertices"]').click();
    await page.getByLabel('Workplane Constraints',{exact:true}).check();
    await page.getByLabel('XY workplane',{exact:true}).check();
    const sphereFixture = testModel('optimizexl/WH_WOC_KnightKhorneFlail01_HIVE_OPTIMIZED.mdx');
    await stubDialogs(app,{open:sphereFixture});
    await page.keyboard.press('Control+o');
    await page.locator('.model-tab.active').filter({hasText:path.basename(sphereFixture)}).waitFor();
    const opened = app.waitForEvent('window');
    await page.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();
    const popup = await opened;
    await prepareWindow(app,popup,{bounds:{x:0,y:0,width:1280,height:920}});
    await popup.getByRole('heading',{name:'OptimizeXL',exact:true}).waitFor({timeout:10000}).catch(async err => {
      throw Error(err.message + ' popup: ' + (await popup.locator('body').innerText()).slice(0,500) + ' main: ' + (await page.locator('body').innerText()).slice(-500));
    });
    await popup.getByRole('button',{name:'Sphereomancer',exact:true}).click();
    await popup.getByLabel('Sphere preset',{exact:true}).selectOption('1');
    const grab = popup.getByRole('slider',{name:'Move collision shape',exact:true}).locator('circle:not(.pe-grab)');
    const p = await grab.boundingBox(), sx=p.x+p.width/2, sy=p.y+p.height/2;
    await popup.mouse.move(sx,sy); await popup.mouse.down(); await popup.keyboard.down('Shift');
    await popup.mouse.move(sx+27,sy+7,{steps:8});
    const childBadge = popup.locator('.shift-lock-badge:visible');
    await childBadge.waitFor({timeout:3000});
    assert.ok(['X','Y','XY'].includes(await childBadge.innerText()),'sphere solves in the inherited XY plane');
    assert.equal(await badge.count(),0,'popup feedback belongs to the popup');
    await popup.keyboard.press('Escape'); await childBadge.waitFor({state:'hidden'});
    await popup.mouse.up(); await popup.keyboard.up('Shift');
    console.log('PASS detached Sphereomancer');
    console.log('PASS badge appearance, Shift/Up/Escape, exclusions, quad, Forge and Movement/POSE');
  } finally { await closeApp(app); }
})().catch(error => {console.error(error); process.exitCode = 1;});
