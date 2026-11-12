const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const { app, page, errors } = await launchApp({ fixture: fixturePath('footman'), out: path.resolve('out/axis-guides-menu'),
    settings: { preferences: { language: 'en', graphics: { pauseWhenHidden: false } } } });
  try {
    const click = async locator => {
      await locator.waitFor();
      const box = await locator.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    const bar = page.getByRole('menubar', { name: 'Application menu' });
    const view = bar.getByRole('menuitem', { name: 'View', exact: true });
    const menu = bar.getByRole('menu', { name: 'View', exact: true });
    const axes = menu.getByRole('menuitemcheckbox', { name: 'Axis guides', exact: true });
    const search = page.getByPlaceholder('Search commands', { exact: true });
    const openSearch = async () => {
      await page.keyboard.press('Control+F2');
      await search.waitFor();
      await page.keyboard.type('Axis guides');
    };
    await click(view);
    assert.equal(await axes.count(), 1, 'Vertex editor offers Axis guides');
    const before = await axes.getAttribute('aria-checked');
    await click(axes);
    await click(view);
    assert.notEqual(await axes.getAttribute('aria-checked'), before);
    await page.keyboard.press('Escape');
    await openSearch();
    assert.equal(await page.getByRole('option').filter({ hasText: 'Axis guides' }).count(), 1);
    await page.keyboard.press('Escape');
    await click(page.getByRole('button', { name: 'Animations', exact: true }));
    await click(view);
    assert.equal(await axes.count(), 0, 'clean Animations cannot display Axis guides');
    await page.keyboard.press('Escape');
    await openSearch();
    assert.equal(await page.getByRole('option').filter({ hasText: 'Axis guides' }).count(), 0);
    await page.keyboard.press('Escape');
    await click(page.getByRole('button', { name: 'Movement', exact: true }));
    await click(page.getByRole('button', { name: 'Portrait settings', exact: true }));
    await click(page.getByRole('button', { name: 'New Camera', exact: true }));
    await page.getByRole('button', { name: 'Full Model View', exact: true }).waitFor();
    await click(view);
    assert.equal(await axes.isEnabled(), false, 'portrait camera hides the axes, so the View toggle is disabled');
    await page.keyboard.press('Escape');
    await openSearch();
    assert.equal(await page.getByRole('option').filter({ hasText: 'Axis guides' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS Axis guides toggles in Vertex View, stays out of clean Animations, and is disabled in portrait-camera View');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
