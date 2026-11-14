const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve('out/fx-uv-click-threshold');
  const { app, page, errors } = await launchApp({ fixture: fixturePath('footman'), out,
    settings: { preferences: { language: 'en', graphics: { pauseWhenHidden: false } } } });
  try {
    const click = async locator => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    await click(page.getByRole('button', { name: 'Surface Effects', exact: true }));
    const fx = page.getByRole('dialog', { name: 'Surface Effects', exact: true });
    await click(fx.getByLabel('Find a surface effect'));
    await page.keyboard.type('Rune blade');
    await click(fx.getByRole('button', { name: 'Rune blade global animation', exact: true }));
    await click(fx.getByRole('button', { name: 'Move UVs', exact: true }));
    const canvas = fx.locator('.fx-uv-canvas .uv-editor canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
    const uv = () => page.evaluate(() => {
      const state = findFiberState('.fx-uv-canvas .uv-editor', value => value?.uv && value?.draw, { last: true });
      return Array.from(state.uv);
    });
    await page.waitForFunction(() => findFiberState('.fx-uv-canvas .uv-editor', value => value?.uv && value?.draw, { last: true }));
    const before = await uv();
    const drag = async distance => {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + distance, y);
      await page.mouse.up();
    };
    await drag(1);
    assert.deepEqual(await uv(), before, 'one-pixel FX Move leaves the fit unchanged');
    await drag(15);
    assert.notDeepEqual(await uv(), before, 'an intentional FX Move still changes the fit');
    assert.deepEqual(errors, []);
    console.log('PASS FX texture fitting ignores a one-pixel move and accepts a deliberate drag');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
