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
    const picker = page.getByRole('combobox', { name: 'Geoset tabs', exact: true });
    await picker.waitFor();
    assert.equal(await page.getByLabel('New geoset tab name').count(), 0);
    assert.equal(await page.locator('.geoset-tabs [role=tab],.geoset-tab-controls').count(), 0);
    const width = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    const listHeight = await page.getByRole('listbox', { name: 'Geosets', exact: true }).evaluate(element => element.getBoundingClientRect().height);
    const placement = await picker.evaluate(element => ({ gap: element.nextElementSibling.getBoundingClientRect().top - element.getBoundingClientRect().bottom, above: element.previousElementSibling === null }));
    assert.equal(placement.gap, 2); assert.ok(placement.above);
    await screenshot('default.png');
    await picker.selectOption('action:create'); await page.keyboard.press('Escape');
    assert.equal(await page.getByLabel('New geoset tab name').count(), 0);
    assert.equal(await picker.inputValue(), 'all');
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
          return { count: props.model.Geosets.length, hidden: [...props.hiddenGeosets], selectable: [...props.selectableGeosets], tabs: props.model._GeosetTabs || [], memberships: props.model.Geosets.map(geoset => geoset._GeosetTabId || null) };
        }
        stack.push(current.sibling, current.child);
      }
      throw Error('Viewport model props not found');
    });
    const initial = await state(); assert.ok(initial.count >= 3);
    const create = async name => {
      await picker.selectOption('action:create'); await page.getByLabel('New geoset tab name').fill(name);
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.getByRole('dialog', { name: 'New geoset tab', exact: true }).waitFor({ state: 'hidden' });
      return (await state()).tabs.find(tab => tab.name === name).id;
    };
    const bodyId = await create('Body');
    assert.deepEqual((await state()).hidden, Array.from({ length: initial.count - 1 }, (_, i) => i + 1));
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 1);
    await picker.selectOption('all');
    await page.locator('[data-warmkey="geosetsClear"]').click();
    await page.getByRole('checkbox', { name: 'Select geoset 1', exact: true }).check();
    const armorId = await create('Armor');
    assert.deepEqual((await state()).selectable, [1]);
    assert.equal((await state()).hidden.includes(1), false);
    await picker.dispatchEvent('wheel', { deltaY: 100, cancelable: true });
    assert.equal(await picker.inputValue(), armorId);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await picker.selectOption('all');
    await page.getByRole('checkbox', { name: 'Select geoset 2', exact: true }).click({ button: 'right' });
    assert.deepEqual((await state()).selectable, [1]);
    assert.equal(await page.getByRole('menuitemcheckbox', { name: 'Leave as visible', exact: true }).count(), 1);
    await page.getByRole('menuitem', { name: 'Add to tab…', exact: true }).click();
    const addDialog = page.getByRole('dialog', { name: 'Add to tab', exact: true });
    await addDialog.getByRole('combobox', { name: 'Geoset tab', exact: true }).selectOption(bodyId);
    await addDialog.getByRole('button', { name: 'Add', exact: true }).click();
    assert.deepEqual((await state()).memberships, [bodyId, armorId, bodyId, ...Array(initial.count - 3).fill(null)]);
    assert.deepEqual((await state()).selectable, [1]);
    assert.equal(await page.getByRole('menu').count(), 0);
    await page.keyboard.press('Control+z'); assert.equal((await state()).memberships[2], null);
    await page.keyboard.press('Control+y'); assert.equal((await state()).memberships[2], bodyId);
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Select geoset 2', exact: true }).click({ button: 'right' });
    assert.equal(await page.getByRole('menuitemcheckbox', { name: 'Leave as visible', exact: true }).count(), 0);
    await page.getByRole('menuitem', { name: 'Add to tab…', exact: true }).click();
    await addDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Vertices', exact: true }).click();
    await picker.selectOption(bodyId);
    await page.locator('[data-warmkey="geosetsAll"]').click(); assert.deepEqual((await state()).selectable, [0, 2]);
    const eyeInBox = await page.getByRole('button', { name: 'Show tab Body', exact: true }).evaluate(element => {
      const eye = element.getBoundingClientRect(), box = element.parentElement.getBoundingClientRect();
      return eye.left >= box.left && eye.right <= box.right && eye.top >= box.top && eye.bottom <= box.bottom;
    });
    assert.ok(eyeInBox);
    await page.getByRole('button', { name: 'Show tab Body', exact: true }).click();
    assert.equal((await state()).hidden.length, initial.count);
    assert.deepEqual((await state()).selectable, []);
    assert.equal(await page.getByRole('checkbox', { name: 'Select geoset 0', exact: true }).isEnabled(), false);
    await picker.selectOption('all');
    assert.deepEqual((await state()).hidden, [0, 2]);
    await picker.selectOption(bodyId);
    await page.getByRole('button', { name: 'Show tab Body', exact: true }).click();
    await picker.selectOption('all');
    assert.deepEqual((await state()).hidden, []);
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), width);
    assert.equal(await page.getByRole('listbox', { name: 'Geosets', exact: true }).evaluate(element => element.getBoundingClientRect().height), listHeight);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await screenshot('tabs.png');
    await app.evaluate(({ dialog }, output) => {
      dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: pathJoin(output, 'ui-tabs.' + options.filters[0].extensions[0]) });
      function pathJoin(directory, file) { return directory + '/' + file; }
    }, out);
    for (const format of ['mdx', 'mdl']) {
      await page.keyboard.press('Control+Shift+s');
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="Save model"]') || !document.querySelector('[role="dialog"][aria-label="Save as"]'));
      const saveOptions = page.getByRole('dialog', { name: 'Save model', exact: true });
      if (await saveOptions.isVisible()) await saveOptions.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('button', { name: 'Save MDX…', exact: true }).waitFor({ state: 'hidden' });
      assert.ok(fs.existsSync(path.join(out, 'ui-tabs.' + format)));
    }
    await app.evaluate(({ dialog }, output) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [output + '/ui-tabs.mdx'] }); }, out);
    await page.keyboard.press('Control+o');
    await page.getByRole('tab', { name: 'ui-tabs.mdx', exact: true }).waitFor();
    assert.equal((await state()).tabs.length, 2);
    assert.ok((await state()).tabs.every(tab => tab.visible));
    assert.equal((await state()).memberships[2], bodyId);
    await picker.selectOption(armorId);
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 1);
    await screenshot('reopened.png');
    await page.locator('[data-warmkey="geosetsAll"]').click();
    await picker.selectOption('action:move');
    await page.getByLabel('Move checked geosets to tab').selectOption(bodyId);
    await page.getByRole('dialog', { name: 'Move checked geosets', exact: true }).getByRole('button', { name: 'Move', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 0);
    await picker.selectOption(bodyId);
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 3);
    await picker.selectOption('action:rename');
    await page.getByLabel('Geoset tab name', { exact: true }).fill('Working body');
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    assert.equal((await state()).tabs.find(tab => tab.id === bodyId).name, 'Working body');
    await picker.selectOption('action:delete');
    await picker.selectOption('ungrouped');
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), initial.count);
    assert.ok(fs.readFileSync(copy).equals(original)); assert.ok(fs.readFileSync(fixture).equals(original));
    assert.deepEqual(errors, []);
    console.log('Geoset tabs UI passed: clicked-only right-click assignment in vertices/animations, undo/redo, single dropdown above box, view toggle inside box, dismissible actions, create, move, rename, delete, selection/visibility isolation, All tabs, unchanged sidebar/list size, worker MDL/MDX saves and MDX reopen; fixture unchanged.');
  } catch (error) {
    const page = await app.firstWindow();
    console.error('UI status:', await page.locator('.classic-status').innerText());
    console.error('Renderer errors:', errors);
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
