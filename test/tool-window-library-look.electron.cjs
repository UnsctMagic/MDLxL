// The library opened from a tool window (FX "Change texture") must look exactly like the main one.
const assert = require('node:assert/strict'), path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const PARTS = {
  search: '.tl-toolbar input[type=search]',
  source: '.tl-toolbar select',
  style: '.tl-folders button',
  close: '.tl-header button[data-hotkey=close]',
};
const look = page => page.evaluate(parts => Object.fromEntries(Object.entries(parts).map(([name, selector]) => {
  const css = getComputedStyle(document.querySelector('.tl-dialog ' + selector));
  return [name, Object.fromEntries(['borderTopStyle', 'borderTopWidth', 'borderTopColor', 'backgroundColor', 'color', 'fontFamily', 'fontSize', 'minHeight', 'borderRadius'].map(key => [key, css[key]]))];
})), PARTS);

(async () => {
  const out = path.resolve('out/tool-window-library-look'), errors = [];
  const { app, page } = await launchApp({ fixture: fixturePath('footman'), out, errors, bounds: { x: 0, y: 0, width: 1450, height: 1000 } });
  try {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Material and Texture Library', exact: true }).click();
    const library = page.locator('.tl-dialog');
    await library.waitFor();
    if (await library.getByRole('tab', { name: 'Textures', exact: true }).count()) await library.getByRole('tab', { name: 'Textures', exact: true }).click();
    await library.getByRole('button', { name: 'Standard', exact: true }).click();
    await library.locator(PARTS.search).waitFor();
    const main = await look(page);
    await library.getByRole('button', { name: 'Close texture library', exact: true }).click();

    await page.getByRole('button', { name: 'Surface Effects', exact: true }).click();
    const fx = page.getByRole('dialog', { name: 'Surface Effects', exact: true });
    await fx.getByLabel('Geoset', { exact: true }).selectOption('0');
    await fx.getByLabel('Find a surface effect').fill('Rune blade');
    await fx.getByRole('button', { name: 'Rune blade global animation', exact: true }).click();
    await fx.getByRole('button', { name: 'Change texture', exact: true }).first().click();
    await library.waitFor();
    assert.equal(await page.locator('.resource-editor .tl-dialog').count(), 0, 'The library is outside the tool window styles');
    assert.deepEqual(await look(page), main, 'The FX library matches the main library');
    await library.screenshot({ path: path.join(out, 'fx-library.png') });
    console.log('PASS FX library matches the main library');

    await library.getByRole('button', { name: 'Close texture library', exact: true }).click();
    await library.waitFor({ state: 'detached' });
    assert.ok(await fx.isVisible(), 'Closing the library leaves FX open');
    console.log('PASS closing the library returns to FX');
    assert.deepEqual(errors, [], 'No page errors');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
