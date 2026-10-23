const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// An error in the bottom status bar flashes red once and keeps a small red dot until the next normal message.
(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/status-alert');
  fs.mkdirSync(out, { recursive: true });
  const copy = path.join(out, 'fixture.mdl'); fs.copyFileSync(path.join(root, 'fixtures/demo.mdl'), copy);
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  const packaged = process.env.MDLXL_TEST_PACKAGE;
  const app = await _electron.launch({ executablePath: packaged ? path.join(packaged, 'MDLxL.exe') : path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: packaged ? ['--disable-backgrounding-occluded-windows', copy] : ['--disable-backgrounding-occluded-windows', root, copy], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    const screenshot = async name => {
      const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
      fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
    };
    const message = page.locator('.classic-status>span').first();
    await page.getByRole('combobox', { name: 'Geoset tabs', exact: true }).waitFor();
    assert.equal(await page.locator('.classic-status .status-alert,.classic-status .status-ping').count(), 0, 'no alert before an error');

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Textures'));
    await page.locator('.resource-editor').waitFor();
    await page.locator('.resource-editor [role=option],.resource-editor .re-list-row').first().click();
    await page.locator('.re-list-actions').getByRole('button', { name: 'Remove', exact: true }).click();

    await page.locator('.classic-status .status-alert .status-ping').waitFor();
    assert.match(await message.innerText(), /in use by a material or emitter/);
    const flash = await message.evaluate(element => ({ animation: getComputedStyle(element).animationName, ping: getComputedStyle(element.querySelector('.status-ping'), '::after').animationName }));
    assert.equal(flash.animation, 'status-alert-flash'); assert.equal(flash.ping, 'status-alert-ping');
    // The hidden test desktop repaints slowly, so hold the flash at its brightest to photograph it.
    await message.evaluate(element => { for (const animation of element.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 150; } });
    await page.waitForTimeout(1500); await screenshot('flash.png');
    await message.evaluate(element => { for (const animation of element.getAnimations({ subtree: true })) animation.play(); });
    await page.waitForTimeout(3500);
    assert.equal(await page.locator('.classic-status .status-ping').count(), 1, 'dot stays after the flash');
    assert.equal(await message.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'flash fades back');
    await screenshot('after-flash.png');

    const first = await message.elementHandle();
    await page.locator('.re-list-actions').getByRole('button', { name: 'Remove', exact: true }).click();
    await page.waitForFunction(old => document.querySelector('.classic-status>span') !== old, first);
    assert.equal(await page.locator('.classic-status .status-alert').count(), 1, 'the same error flashes again');

    await page.locator('.resource-editor').getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.locator('.resource-editor').waitFor({ state: 'detached' });
    const menu = id => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);
    await menu('selectAll'); await menu('copy');
    await page.waitForFunction(() => /^Copied/.test(document.querySelector('.classic-status>span').innerText));
    assert.equal(await page.locator('.classic-status .status-alert,.classic-status .status-ping').count(), 0, 'a normal message clears the alert');
    assert.deepEqual(errors, []);
    console.log('status-alert: ok');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
