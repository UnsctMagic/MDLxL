const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const presets = [
  ['gruvbox-dark', 'Durotar', '#b8bb26'],
  ['mdlvis-vanilla', 'Lordaeron', '#71b5f3'],
  ['blender-style', 'Blackrock', '#ff8a00'],
  ['warm-graphite', 'Ironforge', '#d7ad77'],
  ['nord', 'Northrend', '#88c0d0'],
  ['solarized-light', 'Silvermoon', '#268bd2'],
  ['catppuccin-mocha', 'Dalaran', '#cba6f7'],
];

(async () => {
  const scenario = process.argv[2] || 'all';
  const out = path.resolve('out/geoset-preset-colors-vis', scenario);
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('effect'), original = fs.readFileSync(fixture);
  const { app, page: initialPage, errors } = await launchApp({ out, fixture, show: 'hide', settings: { preferences: { rendererRevision: 3, modelLookAnswered: true, graphics: { pauseWhenHidden: false } } } });
  const page = initialPage.url().startsWith('file:') ? initialPage : app.windows().find(window => window.url().startsWith('file:')) || await app.waitForEvent('window', { predicate: window => window.url().startsWith('file:') });
  await prepareWindow(app, page, { show: 'hide', errors });
  const camera = () => page.evaluate(() => findFiberState('.viewport', value => value?.renderer && value?.entries).camera.position.toArray());
  try {
    await page.locator('.compact-geoset-list').waitFor();
    await page.waitForFunction(() => !!findFiberState('.viewport', value => value?.renderer && value?.entries)?.camera);
    const originalCamera = await camera();
    if (scenario !== 'vis') {
      await page.keyboard.press('Control+6');
      const pages = page.getByRole('navigation', { name: 'Appearance pages' });
      await pages.getByRole('button', { name: 'Interface', exact: true }).click();
      const colors = page.getByRole('combobox', { name: 'Interface appearance set', exact: true });
      const color = page.getByLabel('Compact Set color', { exact: true });
      const style = page.getByRole('combobox', { name: 'Geoset set', exact: true });
      for (const [id, name, expected] of presets) {
        await colors.selectOption(id);
        assert.equal(await color.inputValue(), expected, `Interface ${name} loads its own Compact Set color`);
        assert.equal(await page.locator('.compact-geoset-list').evaluate(element => getComputedStyle(element).getPropertyValue('--geoset-set-color').trim()), expected, `${name} updates the visible geoset grid`);
      }
      await color.fill('#b060ff');
      assert.equal(await colors.inputValue(), '', 'A custom Compact Set color marks the interface color set Custom');
      await style.selectOption('classic');
      await colors.selectOption('mdlvis-vanilla');
      assert.equal(await style.inputValue(), 'classic', 'Changing preset colors preserves the chosen set style');
      await style.selectOption('compact');
      for (const [id, name, expected] of presets) {
        await pages.getByRole('button', { name: 'Presets', exact: true }).click();
        await page.getByRole('combobox', { name: 'Viewport appearance preset', exact: true }).selectOption(id);
        await pages.getByRole('button', { name: 'Interface', exact: true }).click();
        assert.equal(await color.inputValue(), expected, `Full ${name} preset loads its own Compact Set color`);
      }
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      console.log('PASS all seven Interface color sets and full appearance presets; live grid colors; custom color; chosen style preserved.');
    }
    if (scenario !== 'colors') {
      const setColor = await page.locator('.compact-geoset-list').evaluate(element => getComputedStyle(element).getPropertyValue('--geoset-set-color').trim());
      await page.locator('.vis-toggle').click();
      await page.locator('.classic-app[data-vis-ui]').waitFor();
      assert.equal(await page.locator('.compact-geoset-list').count(), 0, 'VIS automatically uses Classic Set');
      assert.equal(await page.locator('[data-hotkey="geoset:0"]').evaluate(element => getComputedStyle(element).opacity), '1', 'VIS shows the native checklist checkbox');
      await page.locator('.vis-toggle').click();
      await page.locator('.compact-geoset-list').waitFor();
      assert.equal(await page.locator('.compact-geoset-list').evaluate(element => getComputedStyle(element).getPropertyValue('--geoset-set-color').trim()), setColor, 'Leaving VIS restores the chosen Compact Set color');
      await page.keyboard.press('Control+6');
      await page.getByRole('navigation', { name: 'Appearance pages' }).getByRole('button', { name: 'Interface', exact: true }).click();
      await page.getByRole('combobox', { name: 'Geoset set', exact: true }).selectOption('classic');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.locator('.vis-toggle').click(); await page.locator('.vis-toggle').click();
      assert.equal(await page.locator('.compact-geoset-list').count(), 0, 'The user-selected Classic Set is retained outside VIS');
      console.log('PASS VIS forces Classic Set; leaving VIS restores the selected style and color.');
    }
    assert.ok((await camera()).every((value, index) => Math.abs(value - originalCamera[index]) < 1e-8), 'Color sets and VIS changes preserve the viewpoint');
    const bounds = await page.locator('.viewport canvas').first().boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .45);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(bounds.x + bounds.width * .55 + 70, bounds.y + bounds.height * .45 + 30, { steps: 10 });
    await page.mouse.up({ button: 'right' });
    await page.waitForFunction(before => JSON.stringify(findFiberState('.viewport', value => value?.renderer && value?.entries).camera.position.toArray()) !== JSON.stringify(before), originalCamera);
    assert.ok(fs.readFileSync(fixture).equals(original), 'Source model unchanged');
    assert.deepEqual(errors, []);
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
