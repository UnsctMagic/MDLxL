const { launchApp, closeApp } = require('./helpers/app.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const root = process.cwd(), file = process.env.MDLXL_TEST_MODEL || testModel('graveguard/graveguard_Optimized Weapon (1).mdx');
  const { app, page } = await launchApp({ out: root, profile: path.join(root, 'out/menu-scroll-test/profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, fixture: file , pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1600, height: 1000 }, show: 'inactive' });
  try {

    await page.getByText('Opened ' + path.basename(file), { exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Nodes'));
    await page.getByLabel('Search nodes').fill('SND');
    await page.locator('.re-tree-row').filter({ hasText: 'SNDx' }).first().click();
    await page.getByRole('tree', { name: 'Sound categories' }).waitFor();
    await page.getByLabel('Search sounds').fill('DVNG');
    assert.equal(await page.locator('[data-sound-id=DVNG]').count(), 0, 'unresolved sound IDs are not offered');
    assert.equal(await page.getByText(/Sound definition unavailable/).count(), 0, 'an existing unresolved node is preserved without a broken selectable row');
    await page.getByLabel('Search sounds').fill('DWAR');
    await page.locator('[data-sound-id=DWAR]').click();
    await page.getByLabel('Search sounds').fill('');
    const tree = page.getByRole('tree', { name: 'Sound categories' });
    const folder = tree.getByRole('button', { name: 'Interface', exact: true });
    const position = () => tree.evaluate(element => ({ list: element.scrollTop, panel: element.closest('.re-properties').scrollTop }));
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await folder.scrollIntoViewIfNeeded();
    const before = await position();
    await folder.click(); await settle();
    const after = await position();
    console.log({ before, after });
    assert.deepEqual(after, before, 'opening another folder must not scroll back to the selected sound or move the manager panel');
    await folder.click(); await settle();
    assert.deepEqual(await position(), before, 'closing the folder preserves the same scroll positions');
    console.log('PASS sound folder open/close keeps scroll position');
  } finally { await closeApp(app).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
