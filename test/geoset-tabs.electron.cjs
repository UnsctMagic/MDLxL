const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/geoset-tabs');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(root, 'fixtures/demo.mdl'), original = fs.readFileSync(fixture);
  const copy = path.join(out, 'fixture.mdl'); fs.writeFileSync(copy, original);
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  const packaged = process.env.MDLXL_TEST_PACKAGE;
  const app = await _electron.launch({ executablePath: packaged ? path.join(packaged, 'MDLxL.exe') : path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: packaged ? ['--disable-backgrounding-occluded-windows', copy] : ['--disable-backgrounding-occluded-windows', root, copy], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    const screenshot = async name => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const png = await app.evaluate(async ({ BrowserWindow }) => {
        const image = await BrowserWindow.getAllWindows()[0].capturePage({ x: 0, y: 0, width: 1100, height: 760 }, { stayHidden: true, stayAwake: true });
        return image.toPNG().toString('base64');
      });
      fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
    };
    const manager = page.getByRole('button', { name: 'Manage geoset tabs', exact: true });
    await manager.waitFor();
    assert.equal(await page.getByLabel('New geoset tab name').count(), 0);
    const width = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    await screenshot('default.png');
    const state = () => page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const host = document.querySelector('.viewport');
      let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      while (fiber?.return) fiber = fiber.return;
      const stack = [fiber?.stateNode?.current];
      while (stack.length) {
        const current = stack.pop(); if (!current) continue;
        if (current.memoizedProps?.model?.Geosets && current.memoizedProps?.hiddenGeosets) {
          const props = current.memoizedProps;
          return { count: props.model.Geosets.length, hidden: [...props.hiddenGeosets], selectable: [...props.selectableGeosets], tabs: props.model._GeosetTabs || [] };
        }
        stack.push(current.sibling, current.child);
      }
      throw Error('Viewport model props not found');
    });
    const initial = await state(); assert.ok(initial.count >= 2);
    await manager.click(); await page.getByLabel('New geoset tab name').fill('Body');
    await page.locator('.geoset-tab-controls').getByRole('button', { name: 'New', exact: true }).click();
    await page.getByRole('tab', { name: 'Body', exact: true }).waitFor();
    assert.deepEqual((await state()).hidden, Array.from({ length: initial.count - 1 }, (_, i) => i + 1));
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 1);
    await page.getByRole('tab', { name: 'All tabs', exact: true }).click();
    await page.locator('[data-warmkey="geosetsClear"]').click();
    await page.getByRole('checkbox', { name: 'Select geoset 1', exact: true }).check();
    await page.getByLabel('New geoset tab name').fill('Armor'); await page.locator('.geoset-tab-controls').getByRole('button', { name: 'New', exact: true }).click();
    assert.deepEqual((await state()).selectable, [1]);
    assert.equal((await state()).hidden.includes(1), false);
    await page.getByRole('tab', { name: 'Body', exact: true }).click();
    await page.locator('[data-warmkey="geosetsAll"]').click(); assert.deepEqual((await state()).selectable, [0]);
    await page.getByRole('button', { name: 'Show tab Body', exact: true }).click();
    assert.equal((await state()).hidden.length, initial.count);
    assert.deepEqual((await state()).selectable, []);
    assert.equal(await page.getByRole('checkbox', { name: 'Select geoset 0', exact: true }).isEnabled(), false);
    await page.getByRole('tab', { name: 'All tabs', exact: true }).click();
    assert.deepEqual((await state()).hidden, [0]);
    await page.getByRole('button', { name: 'Show tab Body', exact: true }).click();
    assert.deepEqual((await state()).hidden, []);
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), width);
    await manager.click(); await screenshot('tabs.png');
    await app.evaluate(({ dialog }, output) => {
      dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: pathJoin(output, 'ui-tabs.' + options.filters[0].extensions[0]) });
      function pathJoin(directory, file) { return directory + '/' + file; }
    }, out);
    for (const format of ['mdx', 'mdl']) {
      await page.keyboard.press('Control+Shift+s');
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      await page.getByRole('button', { name: 'Save MDX…', exact: true }).waitFor({ state: 'hidden' });
      assert.ok(fs.existsSync(path.join(out, 'ui-tabs.' + format)));
    }
    await app.evaluate(({ dialog }, output) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [output + '/ui-tabs.mdx'] }); }, out);
    await page.keyboard.press('Control+o');
    await page.getByRole('tab', { name: 'ui-tabs.mdx', exact: true }).waitFor();
    assert.equal((await state()).tabs.length, 2);
    assert.ok((await state()).tabs.every(tab => tab.visible));
    await page.getByRole('tab', { name: 'Armor', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 1);
    await screenshot('reopened.png');
    await manager.click(); await page.locator('[data-warmkey="geosetsAll"]').click();
    const bodyId = (await state()).tabs.find(tab => tab.name === 'Body').id;
    await page.getByLabel('Move checked geosets to tab').selectOption(bodyId);
    await page.getByRole('button', { name: 'Move checked (1)', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 0);
    await page.getByRole('tab', { name: 'Body', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 2);
    await page.getByLabel('Geoset tab name', { exact: true }).fill('Working body');
    await page.getByRole('tab', { name: 'Working body', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete tab', exact: true }).click();
    await page.getByRole('tab', { name: 'Ungrouped', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), initial.count);
    assert.ok(fs.readFileSync(copy).equals(original)); assert.ok(fs.readFileSync(fixture).equals(original));
    assert.deepEqual(errors, []);
    console.log('Geoset tabs UI passed: create, move, rename, delete, scoped selection, isolation, eyes, All tabs, sidebar width, worker MDL/MDX saves and MDX reopen; fixture unchanged.');
  } catch (error) {
    const page = await app.firstWindow();
    console.error('UI status:', await page.locator('.classic-status').innerText());
    console.error('Renderer errors:', errors);
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
