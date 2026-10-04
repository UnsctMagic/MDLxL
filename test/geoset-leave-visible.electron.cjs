// Run after building. Uses a disposable profile, never the user's running app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/geoset-leave-visible');
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', root, path.join(root, 'fixtures/demo.mdx')], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setPosition(-3000, 0); win.showInactive(); });
    const capture = async name => {
      const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
      fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
    };
    await page.getByRole('checkbox', { name: 'Select geoset 0', exact: true }).waitFor();
    await page.evaluate(() => {
      window.geosetView = () => {
        const host = document.querySelector('.viewport') || document.querySelector('.game-preview-root');
        let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        let rootFiber = fiber; while (rootFiber?.return) rootFiber = rootFiber.return;
        const pending = [rootFiber.stateNode.current];
        while (pending.length) {
          fiber = pending.pop();
          if (fiber.memoizedProps?.selectableGeosets && fiber.memoizedProps?.model?.Geosets) return fiber.memoizedProps;
          if (fiber.sibling) pending.push(fiber.sibling);
          if (fiber.child) pending.push(fiber.child);
        }
        throw Error('Editor viewport props not found');
      };
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
    await page.locator('[data-warmkey="undo"]').first().click();
    assert.equal(await page.getByRole('checkbox', { name: 'Select geoset 0', exact: true }).isChecked(), true);
    assert.deepEqual((await state()).editable, [0]);
    await page.locator('[data-warmkey="redo"]').first().click();
    assert.deepEqual((await state()).editable, []);
    assert.deepEqual((await state()).visible, [0]);
    await page.locator('[data-warmkey="animation"]').click();
    await page.locator('.movement-controller').waitFor();
    await page.locator('.game-preview-root canvas').first().waitFor();
    assert.deepEqual((await state()).editable, []);
    assert.deepEqual((await state()).visible, [0]);
    await capture('movement-visible.png');
    await pin();
    assert.deepEqual((await state()).visible, []);
    await pin();
    assert.deepEqual((await state()).visible, [0]);
    await page.locator('[data-warmkey="new"]').first().click();
    await page.getByRole('tab', { name: /Untitled\.mdx/ }).waitFor();
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
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
