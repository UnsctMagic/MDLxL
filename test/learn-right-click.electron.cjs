// Right-clicking the Learn button turns the hotkey overlay on and off, without opening its menu.
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
(async () => {
  const out = path.resolve('out/learn-right-click');await fs.mkdir(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'demo.mdx');await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const { app, page, errors } = await launchApp({ fixture, out, pageTimeout: 20000 });
  try {
    await page.locator('.classic-view canvas').first().waitFor();
    const learn = page.locator('button[data-hotkey="learn"]'), overlay = () => page.evaluate(() => document.documentElement.dataset.shortcutHints === 'true');
    assert.equal(await overlay(), false);
    await learn.click({ button: 'right' });await settle(page, 300);
    assert.equal(await overlay(), true, 'right-click turns the overlay on');
    assert.equal(await page.locator('.learn-menu').count(), 0, 'the menu stays closed');
    await learn.click({ button: 'right' });await settle(page, 300);
    assert.equal(await overlay(), false, 'right-click again turns it off');
    await learn.click();await settle(page, 200);
    assert.equal(await page.locator('.learn-menu').count(), 1, 'left-click still opens the menu');
    assert.deepEqual(errors, []);
    console.log('ok - right-click on Learn toggles the hotkey overlay');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
