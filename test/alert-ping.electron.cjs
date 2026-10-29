const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Warnings (status bar errors, manager footers, any role=alert) flash red once and keep a small pulsing red dot.
(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/alert-ping');
  fs.mkdirSync(out, { recursive: true });
  const copy = path.join(out, 'fixture.mdl'); fs.copyFileSync(path.join(root, 'test/fixtures/demo.mdl'), copy);
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  const packaged = process.env.MDLXL_TEST_PACKAGE;
  const app = (await launchApp({ out: path.resolve('out'), profile: profile, args: (packaged ? ['--disable-backgrounding-occluded-windows', copy] : ['--disable-backgrounding-occluded-windows', root, copy]).filter(arg => arg !== path.resolve(__dirname, '..') && arg !== '--disable-backgrounding-occluded-windows'), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000 })).app;
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    const screenshot = async name => {
      const png = await app.evaluate(async ({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.invalidate(); await new Promise(resolve => setTimeout(resolve, 1000)); return (await window.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'); });
      fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
    };
    const message = page.locator('.classic-status>span').first(), footer = page.locator('.resource-editor .re-status');
    const alerting = locator => locator.evaluate(element => ({ marked: element.matches('[role=alert],[data-alert]'), flash: getComputedStyle(element).animationName, ping: getComputedStyle(element, '::before').animationName, dot: getComputedStyle(element, '::before').backgroundColor }));
    const expectAlert = async locator => assert.deepEqual(await alerting(locator), { marked: true, flash: 'alert-flash', ping: 'alert-ping', dot: 'rgb(224, 32, 32)' });
    const remove = () => page.locator('.re-list-actions').getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('combobox', { name: 'Geoset tabs', exact: true }).waitFor();
    assert.equal((await alerting(message)).marked, false, 'no alert before an error');

    // Deleting a material that a geoset still uses warns in the manager's footer and in the status bar.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Materials'));
    await page.locator('.resource-editor').waitFor();
    await page.locator('.resource-editor [role=option],.resource-editor .re-list-row').first().click();
    assert.equal((await alerting(footer)).marked, false);
    await remove();
    await page.locator('.resource-editor .re-status[data-alert]').waitFor();
    assert.match(await footer.innerText(), /material is in use/);
    await expectAlert(footer);
    await page.waitForFunction(() => document.querySelector('.classic-status>span').matches('[data-alert]'));
    assert.match(await message.innerText(), /material is in use/);
    await expectAlert(message);
    // The hidden test desktop repaints slowly, so hold the flash at its brightest to photograph it.
    const hold = () => page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.animationName?.startsWith('alert-')) { animation.pause(); animation.currentTime = 150; } });
    await hold(); await settlePage(page, 1500); await screenshot('material-flash.png');
    await page.evaluate(() => { for (const animation of document.getAnimations()) animation.play(); });
    await settlePage(page, 3500);
    assert.equal(await footer.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'flash fades back');
    assert.equal((await alerting(footer)).dot, 'rgb(224, 32, 32)', 'dot stays after the flash');
    await screenshot('material-after.png');

    // The same warning again flashes again.
    const first = await footer.elementHandle();
    await remove();
    await page.waitForFunction(old => document.querySelector('.resource-editor .re-status') !== old, first);
    await expectAlert(footer);

    // Texture in use: same treatment.
    await page.getByRole('navigation', { name: 'Resource managers' }).getByRole('button', { name: 'Textures', exact: true }).click();
    await page.locator('.resource-editor [role=option],.resource-editor .re-list-row').first().click();
    await remove();
    await page.waitForFunction(() => /texture is in use/.test(document.querySelector('.resource-editor .re-status')?.innerText));
    await expectAlert(footer);

    // A new warning text on an element already on screen replays the flash.
    await page.evaluate(() => { const element = document.createElement('p'); element.setAttribute('role', 'alert'); element.id = 'probe'; element.textContent = 'one'; document.body.append(element); });
    await settlePage(page, 1500);
    await page.evaluate(() => { document.getElementById('probe').textContent = 'two'; });
    await settlePage(page, 50);
    assert.ok(await page.evaluate(() => document.getElementById('probe').getAnimations({ subtree: true }).every(animation => animation.currentTime < 1000)), 'changed text replays');
    await page.evaluate(() => document.getElementById('probe').remove());

    await page.locator('.resource-editor').getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.locator('.resource-editor').waitFor({ state: 'detached' });
    const menu = id => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);
    await menu('selectAll'); await menu('copy');
    await page.waitForFunction(() => /^Copied/.test(document.querySelector('.classic-status>span').innerText));
    assert.equal((await alerting(message)).marked, false, 'a normal message clears the alert');
    assert.deepEqual(errors, []);
    console.log('alert-ping: ok');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
