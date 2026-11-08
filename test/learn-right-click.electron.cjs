// Right-clicking the Learn button opens its drop-down; in Paint that drop-down turns Paint's key labels off and on.
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
(async () => {
  const out = path.resolve('out/learn-right-click');await fs.mkdir(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'demo.mdx');await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const { app, page, errors } = await launchApp({ fixture, out, pageTimeout: 20000 });
  try {
    await page.locator('.classic-view canvas').first().waitFor();
    const learn = page.locator('button[data-hotkey="learn"]'), menu = page.locator('.learn-menu'), labelsItem = menu.getByRole('menuitemcheckbox', { name: 'Paint key labels' });
    await learn.click({ button: 'right' });await settle(page, 300);
    assert.equal(await menu.count(), 1, 'right-click opens the drop-down');
    assert.equal(await labelsItem.count(), 0, 'the Paint switch only appears in Paint');
    await page.keyboard.press('Escape');await settle(page, 300);
    assert.equal(await menu.count(), 0, 'Escape closes it');
    await page.locator('[data-hotkey="paint"]').click();await settle(page, 600);
    await page.getByRole('button', { name: /New base coat/ }).click();await settle(page, 200);
    await page.getByRole('button', { name: 'Begin painting', exact: true }).click();await page.locator('.paint-texture-view').waitFor();await settle(page, 1200);
    const shown = () => page.evaluate(() => [...document.querySelectorAll('.paint-studio .paint-key')].filter(key => key.getClientRects().length).length);
    const startLabels = await shown();assert.ok(startLabels > 20, 'Paint starts with its key labels: ' + startLabels);
    await learn.click({ button: 'right' });await settle(page, 300);
    assert.equal(await labelsItem.getAttribute('aria-checked'), 'true');
    await labelsItem.click();await settle(page, 300);
    assert.equal(await shown(), 0, 'the labels are off');
    await page.keyboard.press('Escape');await settle(page, 300);
    await page.getByRole('button', { name: 'Help', exact: true }).click();await settle(page, 300);
    assert.ok(await shown() > 20, 'the shortcut list still names its keys');
    await page.keyboard.press('Escape');await settle(page, 300);
    assert.equal(await shown(), 0, 'still off after the list closes');
    await learn.click({ button: 'right' });await settle(page, 300);
    await labelsItem.click();await settle(page, 300);
    assert.equal(await shown(), startLabels, 'the labels come back');
    await page.keyboard.press('Escape');await settle(page, 300);
    assert.deepEqual(errors, []);
    console.log('ok - right-click on Learn opens the drop-down, and Paint key labels turn off and on');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
