const { clickMenu } = require('./helpers/app.cjs');
const { launchApp, closeApp } = require('./helpers/app.cjs');
// Run after building. Uses a disposable profile, never the user's running app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/geoset-leave-visible');
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const { app, page, errors } = await launchApp({ out: path.dirname(profile), profile: profile, env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: path.join(root, 'test/fixtures/demo.mdx') , pageTimeout: 30000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'inactive' });

  try {

    const capture = async name => {
      const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
      fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
    };
    await page.getByRole('checkbox', { name: 'Select geoset 0', exact: true }).waitFor();
    await page.evaluate(() => {
      window.geosetView = () => { const host=document.querySelector('.viewport')||document.querySelector('.game-preview-root'); const props=findFiberState(host,p=>p?.selectableGeosets&&p?.model?.Geosets,{tree:true,props:true}); if(!props)throw Error('Editor viewport props not found');return props; };
    });
    const state = () => page.evaluate(() => { const p = geosetView(); return { editable: [...p.selectableGeosets], visible: [...p.visibleGeosets], hidden: [...p.hiddenGeosets], selected: Object.keys(p.selectionByGeoset).filter(i => p.selectionByGeoset[i].length) }; });
    const pin = async () => {
      await page.locator('.geoset-row').first().click({ button: 'right' });
      await page.getByRole('menuitemcheckbox', { name: 'Leave as visible', exact: true }).click();
      await page.mouse.move(300, 50);
    };
    await page.getByRole('checkbox', { name: 'Show all geosets', exact: true }).uncheck();
    await pin();
    assert.deepEqual(await state(), { editable: [], visible: [0], hidden: [1, 2, 3, 4], selected: [] });
    // Select-all cannot make the visible-only geometry editable.
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true })));
    assert.deepEqual((await state()).selected, []);
    const unchanged = await page.evaluate(() => {
      const p = geosetView(), before = Array.from(p.model.Geosets[0].Vertices);
      p.onTransform({ selections: { 0: [0, 1] }, translation: [100, 0, 0] });
      return JSON.stringify(before) === JSON.stringify(Array.from(p.model.Geosets[0].Vertices));
    });
    assert.equal(unchanged, true, 'even a stale transform payload cannot edit a visible-only geoset');
    await capture('vertex-visible.png');
    await clickMenu(app, 'Undo');
    await page.waitForFunction(() => document.querySelector('[aria-label="Select geoset 0"]')?.checked === true);
    assert.equal(await page.getByRole('checkbox', { name: 'Select geoset 0', exact: true }).isChecked(), true);
    assert.deepEqual((await state()).editable, [0]);
    await clickMenu(app, 'Redo');
    await page.waitForFunction(() => document.querySelector('[aria-label="Select geoset 0"]')?.checked === false);
    assert.deepEqual((await state()).editable, []);
    assert.deepEqual((await state()).visible, [0]);
    await page.locator('[data-hotkey="animation"]').click();
    await page.locator('.movement-controller').waitFor();
    await page.locator('.game-preview-root canvas').first().waitFor();
    assert.deepEqual((await state()).editable, []);
    assert.deepEqual((await state()).visible, [0]);
    await capture('movement-visible.png');
    await pin();
    assert.deepEqual((await state()).visible, []);
    await pin();
    assert.deepEqual((await state()).visible, [0]);
    await clickMenu(app, 'New model');
    await page.getByRole('tab', { name: 'Untitled.mdx', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Geoset 0 left visible').count(), 0);
    await page.getByRole('tab', { name: 'demo.mdx' }).click();
    await page.locator('.game-preview-root canvas').first().waitFor();
    assert.deepEqual((await state()).editable, []);
    assert.deepEqual((await state()).visible, [0]);
    await page.getByRole('checkbox', { name: 'Select geoset 0', exact: true }).check();
    assert.deepEqual((await state()).editable, [0]);
    assert.equal(await page.getByLabel('Geoset 0 left visible').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS vertex/movement visible-only state, hidden-geoset exclusion, selection protection, undo/redo, toggle and re-enable editing');
  } finally { await closeApp(app).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
