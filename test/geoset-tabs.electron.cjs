const { appTarget } = require('./helpers/app.cjs');
const { stubDialogs } = require('./helpers/app.cjs');
const { launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.resolve(process.env.MDLXL_TABS_TEST_OUT || path.join(root, 'out/geoset-tabs'));
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('effect'), original = fs.readFileSync(fixture), copy = fixture;
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  const packaged = process.env.MDLXL_TEST_PACKAGE;
  const { app, page: initialPage, errors } = await launchApp({ out: path.dirname(profile), profile: profile, settings: { preferences: { rendererRevision: 3, modelLookAnswered: true, graphics: { pauseWhenHidden: false } } }, target: packaged ? { executablePath: path.join(packaged, 'MDLxL.exe'), args: [], packaged: true } : appTarget(), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: copy , pageTimeout: 15000 });
  const page = initialPage.url().startsWith('file:') ? initialPage : app.windows().find(window => window.url().startsWith('file:')) || await app.waitForEvent('window', { predicate: window => window.url().startsWith('file:') });
  await prepareWindow(app, page, { show: 'hide', errors });

  try {

    const screenshot = async name => {
      const png = await app.evaluate(async ({ BrowserWindow }) => {
        const image = await BrowserWindow.getAllWindows()[0].capturePage(undefined, { stayHidden: true, stayAwake: true });
        return image.toPNG().toString('base64');
      });
      fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
    };
    const strip = page.getByRole('tablist', { name: 'Geoset tabs', exact: true });
    assert.equal(await strip.count(), 1, 'Geoset tabs are a visible tab strip');
    const picker = {
      inputValue: () => strip.getByRole('tab', { selected: true }).getAttribute('data-tab-id'),
      selectOption: async value => {
        if (value.startsWith('action:')) {
          await page.getByRole('button', { name: 'Geoset tab actions', exact: true }).click();
          await page.getByRole('menu', { name: 'Tab actions', exact: true }).getByRole('menuitem', { name: { create: 'New tab…', move: 'Move checked…', rename: 'Rename tab…', delete: 'Delete tab' }[value.slice(7)], exact: true }).click();
        } else {
          const tab = strip.locator(`[data-tab-id="${value}"]`);
          if (await tab.isVisible()) await tab.click();
          else {
            await page.getByRole('button', { name: 'More geoset tabs', exact: true }).click();
            await page.getByRole('menu', { name: 'Geoset tabs', exact: true }).locator(`[data-tab-id="${value}"]`).click();
          }
        }
      }
    };
    await strip.getByRole('tab', { name: 'All tabs', exact: true }).waitFor();
    assert.equal(await page.getByLabel('New geoset tab name').count(), 0);
    assert.equal(await page.getByRole('combobox', { name: 'Geoset tabs', exact: true }).count(), 0);
    assert.ok(await page.getByRole('button', { name: 'New geoset tab', exact: true }).evaluate(element => !!element.closest('.classic-geosets > summary')), 'New and actions stay in the existing Geosets heading');
    const width = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    const listHeight = await page.getByRole('listbox', { name: 'Geosets', exact: true }).evaluate(element => element.getBoundingClientRect().height);
    assert.ok(await strip.evaluate(element => element.getBoundingClientRect().bottom <= element.closest('.geoset-tabs').querySelector('.geoset-list-box').getBoundingClientRect().top));
    await screenshot('default.png');
    await picker.selectOption('action:create'); await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'New geoset tab', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await page.getByLabel('New geoset tab name').count(), 0);
    assert.equal(await picker.inputValue(), 'all');
    const state = () => page.evaluate(() => { const props=findFiberState('.viewport',p=>p?.model?.Geosets&&p?.hiddenGeosets,{tree:true,props:true});if(!props)throw Error('Viewport model props not found');return {count:props.model.Geosets.length,hidden:[...props.hiddenGeosets],selectable:[...props.selectableGeosets],tabs:props.model._GeosetTabs||[],memberships:props.model.Geosets.map(g=>g._GeosetTabId||null)}; });
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
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByRole('checkbox', { name: 'Select geoset 1', exact: true }).check();
    const armorId = await create('Armor');
    assert.deepEqual((await state()).selectable, [1]);
    assert.equal((await state()).hidden.includes(1), false);
    await strip.hover(); await page.mouse.wheel(0, 100);
    assert.equal(await picker.inputValue(), armorId);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await picker.selectOption('all');
    await page.getByRole('checkbox', { name: 'Select geoset 2', exact: true }).click({ button: 'right' });
    assert.deepEqual((await state()).selectable, [1]);
    assert.equal(await page.getByRole('menuitemcheckbox', { name: /^(Leave as visible|Show Always)$/ }).count(), 1);
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
    await page.getByRole('menuitem', { name: 'Add to tab…', exact: true }).click();
    await addDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Vertices', exact: true }).click();
    await picker.selectOption(bodyId);
    await page.locator('[data-hotkey="geosetsAll"]').click(); assert.deepEqual((await state()).selectable, [0, 2]);
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
      await page.keyboard.press('F12');
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="Save model"]') || !document.querySelector('[role="dialog"][aria-label="Save as"]'));
      const saveOptions = page.getByRole('dialog', { name: 'Save model', exact: true });
      if (await saveOptions.isVisible()) await saveOptions.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('button', { name: 'Save MDX…', exact: true }).waitFor({ state: 'hidden' });
      assert.ok(fs.existsSync(path.join(out, 'ui-tabs.' + format)));
    }
    await stubDialogs(app, { open: [(out) + '/ui-tabs.mdx'] });
    await page.keyboard.press('Control+o');
    await page.getByRole('tab', { name: 'ui-tabs.mdx', exact: true }).waitFor();
    assert.equal((await state()).tabs.length, 2);
    assert.ok((await state()).tabs.every(tab => tab.visible));
    assert.equal((await state()).memberships[2], bodyId);
    await picker.selectOption(armorId);
    assert.equal(await page.getByRole('checkbox', { name: /^Select geoset/ }).count(), 1);
    await screenshot('reopened.png');
    await page.locator('[data-hotkey="geosetsAll"]').click();
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
    await page.getByRole('button', { name: 'New geoset tab', exact: true }).click();
    await page.keyboard.press('Escape');
    for (const name of ['A long weapon tab for overflow', 'Effects', 'Another long group']) await create(name);
    await page.getByRole('button', { name: 'More geoset tabs', exact: true }).click();
    await page.getByRole('menu', { name: 'Geoset tabs', exact: true }).getByRole('menuitemradio', { name: 'Armor', exact: true }).click();
    await page.keyboard.press('End'); assert.equal(await strip.getByRole('tab', { name: 'Ungrouped', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home'); assert.equal(await picker.inputValue(), 'all');
    await page.getByRole('button', { name: 'Geoset tab actions', exact: true }).click();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByRole('menu', { name: 'Tab actions', exact: true }).waitFor({ state: 'hidden' });
    const camera = () => page.evaluate(() => findFiberState('.viewport', value => value?.renderer && value?.entries).camera.position.toArray());
    const beforeCamera = await camera(), canvas = await page.locator('.viewport canvas').first().boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .55, canvas.y + canvas.height * .45);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(canvas.x + canvas.width * .55 + 75, canvas.y + canvas.height * .45 + 35, { steps: 10 });
    await page.mouse.up({ button: 'right' });
    await page.waitForFunction(before => JSON.stringify(findFiberState('.viewport', value => value?.renderer && value?.entries).camera.position.toArray()) !== JSON.stringify(before), beforeCamera);
    const rotated = await camera();
    await picker.selectOption(armorId); await picker.selectOption('all');
    assert.ok((await camera()).every((value, index) => Math.abs(value - rotated[index]) < 1e-8), 'Tab changes preserve the rotated viewpoint');
    await page.getByRole('button', { name: 'Float Geosets', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'New geoset tab', exact: true }).evaluate(element => !!element.closest('.geosets-float > header')), 'Header controls follow the floating panel');
    await page.getByRole('button', { name: 'New geoset tab', exact: true }).click(); await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'New geoset tab', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Dock Geosets back', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'New geoset tab', exact: true }).evaluate(element => !!element.closest('.classic-geosets > summary')));
    console.log('PASS geoset tabs: real model; header controls and visible strip; overflow and keyboard; clicked-only right-click assignment; vertices/animations; undo/redo; eye; Escape/outside dismissal; create/move/rename/delete; selection/visibility isolation; sidebar/list size; mouse rotation and viewpoint; MDL/MDX saves and reopen; original unchanged.');
  } catch (error) {

    console.error('Tab workflow error:', error);
    if (!page.isClosed()) console.error('UI status:', await page.locator('.classic-status').innerText());
    console.error('Renderer errors:', errors);
    throw error;
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
