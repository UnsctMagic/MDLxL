// A sound the game's table lists but whose file is not in the game is greyed
// out with a plain note; a sound whose file Blizzard stored in another folder plays.
const { waitForInfo, launchApp, closeApp } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const root = process.cwd(), file = process.env.MDLXL_TEST_MODEL || testModel('graveguard/graveguard_Optimized Weapon (1).mdx');
  const { app, page } = await launchApp({ out: root, profile: path.join(root, 'out/event-sound-missing/profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, fixture: file, pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1600, height: 1000 }, show: 'inactive' });
  try {
    await waitForInfo(page, 'Opened ' + path.basename(file));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Nodes'));
    await page.getByLabel('Search nodes').fill('SND');
    await page.locator('.re-tree-row').filter({ hasText: 'SNDx' }).first().click();
    await page.getByRole('tree', { name: 'Sound categories' }).waitFor();
    const search = page.getByLabel('Search sounds'), audio = page.getByLabel('Sound preview');

    // A sound with a file in another folder: picking it loads playable audio.
    await search.fill('KAOE');
    await page.locator('[data-sound-id=KAOE]').click();
    await page.waitForFunction(() => document.querySelector('audio[aria-label="Sound preview"]')?.src?.startsWith('blob:'), null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('audio[aria-label="Sound preview"]')?.readyState >= 1, null, { timeout: 20000 });
    assert.equal(await page.getByText(/Sound not found/).count(), 0, 'Ancient of the Earth attack plays from its real folder');

    // A sound with no file in the game: greyed, not pickable, plain note instead of the red error.
    await search.fill('DFRW');
    const missing = page.locator('[data-sound-id=DFRW]');
    await page.waitForFunction(() => document.querySelector('[data-sound-id=DFRW]')?.classList.contains('re-sound-item-missing'), null, { timeout: 20000 });
    assert.equal(await missing.getAttribute('aria-disabled'), 'true');
    const box = await missing.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.locator('.re-tree-row.re-selected').filter({ hasText: /SND.KAOE/i }).waitFor();
    assert.equal(await page.locator('[data-sound-id=DFRW][aria-selected=true]').count(), 0, 'a sound with no game file cannot be picked');
    assert.equal(await audio.count(), 1, 'the previous playable sound stays chosen');

    // A model that already uses it (like WH_DOC_GreatUCO1C's SNDnDFRW) shows the note, not the red error.
    await page.locator('.re-event-settings > summary').click();
    const name = page.getByLabel('Name', { exact: true });
    await name.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('SNDnDFRW'); await page.keyboard.press('Enter');
    await page.locator('.re-tree-row.re-selected').filter({ hasText: 'SNDnDFRW' }).waitFor();
    await page.getByText('No sound file in the game', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Sound not found/).count(), 0, 'no red error');
    assert.equal(await page.locator('[data-sound-id=DFRW][aria-selected=true]').count(), 1, 'the current sound is still shown as chosen');
    assert.equal(await audio.count(), 0, 'no empty player for a sound with no file');
    console.log('PASS moved sound plays; missing sound greyed, not pickable, plain note');
  } finally { await closeApp(app).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
