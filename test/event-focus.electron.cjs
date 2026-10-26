const assert = require('node:assert/strict');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Sound and blood events show only their own kind; node fields wait behind Node settings.
(async () => {
  const root = process.cwd(), file = process.env.MDLXL_TEST_MODEL || path.join(root, 'out/pose/Footman.mdx');
  const app = await _electron.launch({
    executablePath: process.env.MDLXL_ELECTRON || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: process.env.MDLXL_ELECTRON ? [file] : [root, file],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(root, 'out/event-focus-test/profile-' + Date.now()) },
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setSize(1600, 1000); window.webContents.setBackgroundThrottling(false); window.showInactive();
    });
    await page.getByText('Opened ' + path.basename(file), { exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Nodes'));
    await page.getByLabel('Search nodes').fill('SND');
    await page.locator('.re-tree-row').filter({ hasText: /^SND/i }).first().click();
    const tree = page.getByRole('tree', { name: 'Sound categories' });
    await tree.waitFor();

    const settings = page.locator('.re-event-settings');
    assert.equal(await settings.evaluate(element => element.open), false, 'node settings start closed');
    for (const label of ['Type', 'Global sequence', 'Name', 'Parent']) assert.equal(await page.getByLabel(label, { exact: true }).isVisible(), false, `${label} stays hidden by default`);
    for (const folder of ['Spells', 'Weapons & missiles', 'Units', 'Buildings']) await tree.getByRole('button', { name: folder }).waitFor();

    const chip = key => page.getByRole('group', { name: 'Expansions' }).getByRole('button', { name: new RegExp('^' + key) });
    const total = () => tree.evaluate(element => [...element.querySelectorAll(':scope > div > .re-sound-folder small')].reduce((sum, small) => sum + Number(small.textContent), 0));
    const everything = await total();
    const fk = Number((await chip('FK').locator('small').textContent()));
    assert.ok(everything > 600 && fk > 0, `all expansions offer the full sound table (${everything}, FK ${fk})`);
    for (const key of ['ROC', 'TFT', 'RE']) await chip(key).click();
    assert.equal(await chip('FK').getAttribute('aria-pressed'), 'true');
    assert.equal(await total(), fk, 'only Forsaken Kingdom sounds remain');

    await page.getByLabel('Search sounds').fill('ACON');
    await page.locator('[data-sound-id=ACON]').click();
    await page.locator('.re-tree-row.re-selected').filter({ hasText: /SND.ACON/i }).waitFor();
    for (const key of ['ROC', 'TFT', 'RE']) await chip(key).click();
    await page.getByLabel('Search sounds').fill('');
    assert.equal(await total(), everything, 'turning the expansions back on restores every sound');

    await settings.locator(':scope > summary').click();
    assert.match(await page.getByLabel('Name', { exact: true }).inputValue(), /^SND.ACON$/i, 'node fields open on request');
    await page.getByLabel('Type', { exact: true }).waitFor();

    await page.getByLabel('Search nodes').fill('SPL');
    const blood = page.locator('.re-tree-row').filter({ hasText: /^SPL/i }).first();
    if (await blood.count()) {
      await blood.click();
      const options = await page.getByRole('listbox', { name: 'Blood Splat' }).locator('option').allTextContents();
      assert.ok(options.length > 20 && options.every(text => !/foo?t?print/i.test(text)), 'blood list holds no footprints');
      assert.equal(await page.getByRole('tree', { name: 'Sound categories' }).count(), 0, 'no sound list while editing blood');
    }
    console.log('PASS event editor shows only the chosen event kind; expansion filter works');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
