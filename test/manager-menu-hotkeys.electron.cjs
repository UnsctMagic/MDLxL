const assert = require('node:assert/strict');
const path = require('node:path');
const { appDist, clickMenu, closeApp, launchApp, prepareWindow } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const managers = [
  ['Surface Effects', 'K'], ['Material Manager', 'M'], ['Texture Manager', 'T'],
  ['Node Manager', 'O'], ['Geoset Manager', 'G'], ['Geoset Animation Manager', 'H'],
  ['Sequence Manager', 'Q'], ['Texture Animation Manager', 'X'], ['Global Sequence Manager', 'L'],
];
const fixture = fixturePath('citadel-footman');
const editorNames = ['Vertices', 'Bones', 'Movement', 'Animations', 'Citadel Paint', 'Showcase'];
const tabs = page => page.locator('.editor-modules > button').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')));
const nativeMenus = app => app.evaluate(({ Menu }) => {
  const read = menu => menu.items.map(item => ({
    label: item.label.replace('&', ''), accelerator: item.accelerator, register: item.registerAccelerator,
    children: item.submenu && read(item.submenu),
  }));
  return read(Menu.getApplicationMenu());
});
const menuItem = (menus, group, label) => menus.find(menu => menu.label === group).children.find(item => item.label === label);

(async () => {
  const { app, page, errors } = await launchApp({
    out: path.resolve('out/manager-menu-hotkeys'), fixture,
    settings: { preferences: { language: 'en', learn: { enabled: false } } },
  });
  try {
    await page.getByRole('tab', { name: path.basename(fixture), exact: true }).waitFor();
    assert.deepEqual(await tabs(page), editorNames);
    await page.keyboard.press('F5');
    await page.getByRole('button', { name: 'Animations', exact: true, pressed: true }).waitFor();
    const bones = page.locator('.quick-display [data-hotkey="display:bones"]');
    await page.waitForFunction(() => document.querySelector('.quick-display [data-hotkey="display:bones"]')?.getAttribute('data-hotkey-shortcuts'));
    const bonesKey = await bones.getAttribute('data-hotkey-shortcuts');
    const menus = await nativeMenus(app);
    assert.equal(menuItem(menus, 'View', 'Bones').accelerator, bonesKey, 'View shows the shortcut assigned to Quick Display Bones');
    const bonesVisible = await bones.isChecked();
    await page.keyboard.press(bonesKey);
    assert.equal(await bones.isChecked(), !bonesVisible, 'the shortcut shown in View toggles Bones');
    assert.equal(menuItem(menus, 'Modules', 'Managers'), undefined);
    assert.deepEqual(menus.find(menu => menu.label === 'Managers').children.map(item => item.label), managers.map(([label]) => label + '…'));
    for (const [name, key] of managers) {
      const entry = menuItem(menus, 'Managers', name + '…');
      assert.equal(entry.accelerator, 'Alt+' + key, name);
      assert.equal(entry.register, false, name);
      await page.keyboard.press('Alt+' + key.toLowerCase());
      const popup = page.getByRole('dialog', { name, exact: true });
      await popup.waitFor();
      await page.keyboard.press('Escape');
      await popup.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('button', { name: 'Animations', exact: true, pressed: true }).count(), 1, name);
    }
    await clickMenu(app, 'Material Manager…');
    const material = page.getByRole('dialog', { name: 'Material Manager', exact: true });
    await material.waitFor();
    await material.getByRole('navigation', { name: 'Resource managers' }).getByRole('button', { name: 'Model', exact: true }).click();
    const model = page.getByRole('dialog', { name: 'Model Manager', exact: true });
    await model.waitFor();
    await model.getByRole('button', { name: 'Close Model Manager', exact: true }).click();
    await model.waitFor({ state: 'detached' });

    await page.keyboard.press('Control+k');
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.getByRole('textbox', { name: 'Search Hotkeys', exact: true }).fill('Material Manager');
    const binding = settings.getByRole('row', { name: /^Material Manager Resources/ });
    await binding.getByRole('button', { name: 'Remove Alt+M from Material Manager', exact: true }).click();
    await binding.getByRole('button', { name: 'Assign shortcut to Material Manager', exact: true }).click();
    await settings.getByLabel('Press a key combination', { exact: true }).waitFor();
    await page.keyboard.press('Control+F9');
    await settings.getByRole('button', { name: 'Assign shortcut', exact: true }).click();
    await settings.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await settings.waitFor({ state: 'detached' });
    await app.evaluate(async ({ Menu }) => {
      const end = Date.now() + 5000;
      while (Date.now() < end) {
        const material = Menu.getApplicationMenu().items.find(item => item.label === 'Managers').submenu.items.find(item => item.label === 'Material Manager…');
        if (material.accelerator === 'Ctrl+F9') return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw Error('Material Manager menu still shows the old shortcut after rebinding');
    });
    await page.keyboard.press('Control+F9');
    await material.waitFor();
    await page.keyboard.press('Escape');
    await material.waitFor({ state: 'detached' });

    const opened = app.waitForEvent('window');
    await app.evaluate(async ({ BrowserWindow }, file) => {
      globalThis.menuBrowser = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
      globalThis.menuBrowser.setMenu(null);
      await globalThis.menuBrowser.loadFile(file);
    }, path.join(appDist(), 'index.html'));
    const browser = await opened;
    await prepareWindow(app, browser, { errors });
    await browser.locator('.classic-menu').waitFor();
    assert.deepEqual(await tabs(browser), editorNames);
    const checks = [
      ['File', 'open', 'Ctrl+O'], ['Edit', 'undo', 'Ctrl+Z'], ['Shape', 'shape:bend', 'Shift+B'],
      ['View', 'grid', 'Shift+G'], ['Modules', 'vertices', 'F1'], ['Settings', 'settings', 'Ctrl+,'],
      ['Help', 'launcher', 'Ctrl+F2'],
    ];
    for (const [group, action, expected] of checks) {
      const menu = browser.locator('.classic-menu details').filter({ has: browser.getByText(group, { exact: true }).and(browser.locator('summary')) });
      await menu.locator('summary').click();
      const key = menu.locator(`button[data-hotkey="${action}"] kbd`);
      await key.waitFor();
      assert.equal(await key.innerText(), expected, group);
      await menu.locator('summary').click();
    }
    const menu = browser.locator('.classic-menu details').filter({ has: browser.getByText('Managers', { exact: true }).and(browser.locator('summary')) });
    await menu.locator('summary').click();
    const keys = menu.locator('kbd');
    assert.ok((await keys.allInnerTexts()).includes('Alt+K'));
    const materialRow = menu.locator('button[data-hotkey="Materials"]');
    assert.equal(await materialRow.locator('kbd').innerText(), 'Ctrl+F9');
    const edge = node => node.getBoundingClientRect().right;
    const rightEdges = await keys.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().right));
    assert.ok(rightEdges.every(right => Math.abs(right - rightEdges[0]) < 1), 'shortcut column is right-aligned');
    assert.ok(await materialRow.locator('kbd').evaluate(edge) > await materialRow.locator('span').evaluate(edge), 'key is to the right of the label');
    await materialRow.click();
    await browser.getByRole('dialog', { name: 'Material Manager', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS manager tab removal, nine native shortcut labels and key routes, popup menu and internal Model tab, live remap, browser menu hints and right alignment');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
