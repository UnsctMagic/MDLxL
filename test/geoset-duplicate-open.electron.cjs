const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// A model with duplicate geoset animations opens straight into the editor. The fix waits behind a
// status-bar warning, is an ordinary undoable edit, and a read-only file (as Windows hands out from a zip)
// asks for another place on Save instead of failing.
// MDLXL_PLAYWRIGHT_MODULE=<playwright> node test/geoset-duplicate-open.electron.cjs [model.mdx]
// MDLXL_DUPLICATE_EXE=<MDLxL.exe> tests a package (default out/pkg); without an argument a duplicate
// is added to the bundled Tzeentch fixture.
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');

(async () => {
  const cwd = process.cwd(), out = path.join(cwd, 'out/geoset-duplicate-open');
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const { openDocument } = await import(pathToFileURL(path.join(cwd, 'src/editor-document.js')));
  const { scanGeosetAnimationDuplicates } = await import(pathToFileURL(path.join(cwd, 'src/geoset-animation-repair.js')));
  const model = path.join(out, 'duplicate.mdx');
  if (process.argv[2]) fs.copyFileSync(process.argv[2], model);
  else {
    const doc = openDocument(fs.readFileSync('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx'), 'duplicate.mdx');
    doc.apply('Duplicate', ['GeosetAnims', 'Info'], m => { m.GeosetAnims.push({ GeosetId: 0, Flags: 0, Alpha: 0.5, Color: new Float32Array([1, 1, 1]) }); });
    fs.writeFileSync(model, doc.serialize('mdx'));
  }
  const original = fs.readFileSync(model);
  if (!scanGeosetAnimationDuplicates(openDocument(original, 'duplicate.mdx').model).length) throw Error('Fixture has no duplicate geoset animations.');
  fs.chmodSync(model, 0o444);
  const executablePath = path.resolve(process.env.MDLXL_DUPLICATE_EXE || 'out/pkg/MDLxL-win32-x64/MDLxL.exe');
  const app = (await launchApp({ out: path.resolve('out'), profile: path.join(out, 'profile'), args: ([model]).filter(arg => arg !== path.resolve(__dirname, '..') && arg !== '--disable-backgrounding-occluded-windows'), env: {  }, timeout: 60000 })).app;
  const errors = [], started = Date.now(), step = name => console.log(`${((Date.now() - started) / 1000).toFixed(1)}s ${name}`);
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1400, height: 900 }); win.showInactive(); });
    await page.waitForSelector('[data-hotkey="animations"]', { timeout: 60000 }); step('editor shown');
    const warning = page.getByRole('button', { name: 'Duplicate geoset animations' });
    await warning.waitFor();
    if (await page.getByRole('dialog').count()) throw Error('A dialog opened before the warning was clicked.');
    // It flashes red and keeps a pulsing red dot, like other warnings, and carries a warning icon.
    const look = await warning.evaluate(element => ({ flash: getComputedStyle(element).animationName, ping: getComputedStyle(element, '::before').animationName, icon: !!element.querySelector('svg') }));
    if (look.flash !== 'alert-flash' || look.ping !== 'alert-ping' || !look.icon) throw Error('Warning does not ping: ' + JSON.stringify(look));
    await page.screenshot({ path: path.join(out, '1-opened.png') }); await settlePage(page, 3500);
    await page.screenshot({ path: path.join(out, '1b-after-ping.png') }); step('warning only');
    // The timeline mounts and plays with the duplicate still present.
    await page.locator('[data-hotkey="animations"]').click();
    await settlePage(page, 800);
    await page.screenshot({ path: path.join(out, '2-animations.png') }); step('animations');
    await warning.click();
    const dialog = page.getByRole('dialog', { name: 'Duplicate geoset animations' });
    await dialog.waitFor();
    await page.screenshot({ path: path.join(out, '3-dialog.png') }); step('dialog');
    await dialog.getByRole('button', { name: 'Not now' }).click();
    await dialog.waitFor({ state: 'detached' });
    await warning.click(); await dialog.getByRole('button', { name: 'Fix', exact: true }).click();
    await dialog.waitFor({ state: 'detached' }); await warning.waitFor({ state: 'detached' });
    step('FIXED ' + await page.locator('.classic-status').innerText());
    await page.keyboard.press('Control+z'); await warning.waitFor();
    step('UNDO restores warning');
    await page.keyboard.press('Control+y').catch(() => {});
    if (await warning.count()) { await warning.click(); await dialog.getByRole('button', { name: 'Fix', exact: true }).click(); }
    await warning.waitFor({ state: 'detached' });
    const saved = path.join(out, 'saved.mdx');
    await app.evaluate(({ dialog }, file) => { globalThis.saveTitles = []; dialog.showSaveDialog = async (_window, options) => { globalThis.saveTitles.push(options.title); return { canceled: false, filePath: file }; }; }, saved);
    await page.keyboard.press('Control+s');
    for (let i = 0; i < 100 && !fs.existsSync(saved); i++) await settlePage(page, 100);
    // The file lands a moment before the editor records the save; closing earlier would ask to save.
    await page.locator('.classic-status').filter({ hasText: 'Saved saved.mdx' }).waitFor({ timeout: 10000 }).catch(() => {});
    if (!fs.existsSync(saved)) throw Error('Save did not write a new file: ' + await page.locator('.classic-status').innerText());
    console.log('SAVE DIALOG', await app.evaluate(() => globalThis.saveTitles));
    if (!fs.readFileSync(model).equals(original)) throw Error('The read-only original changed.');
    const reopened = openDocument(fs.readFileSync(saved), 'saved.mdx');
    if (scanGeosetAnimationDuplicates(reopened.model).length) throw Error('Saved copy still has duplicates.');
    if (errors.length) throw Error('Page errors: ' + errors.join(' | '));
    step('PASS ' + saved);
  } finally { await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 8000))]); fs.chmodSync(model, 0o666); }
})().catch(error => { console.error('FAIL', error.message); process.exitCode = 1; });
