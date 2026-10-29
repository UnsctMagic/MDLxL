const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const cwd = process.cwd(), out = path.join(cwd, 'out/geoset-save');
  fs.mkdirSync(out, { recursive: true });
  const copy = path.join(out, 'ui-fixture.mdx');
  fs.copyFileSync('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', copy);
  const app = (await launchApp({ out: path.resolve('out'), profile: path.join(out, 'profile-' + Date.now()), args: ([cwd, copy]).filter(arg => arg !== path.resolve(__dirname, '..') && arg !== '--disable-backgrounding-occluded-windows'), env: {  }, timeout: 60000 })).app;
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    // A never-shown headless window cannot be captured by page.screenshot; show it inactive and off-screen.
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    page.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await page.waitForSelector('[data-hotkey="animations"]', { timeout: 60000 });
    console.log('LOADED', await page.title());
    await page.locator('[data-hotkey="animations"]').click();
    await page.getByLabel('Choose animation sequence').selectOption({ label: 'Decay Bone' });
    await page.locator('[data-hotkey="geosetsAll"]').click();
    await page.getByRole('button', { name: 'Create Visibility', exact: true }).click();
    await page.getByLabel('Visibility alpha percent').fill('0');
    await page.getByLabel('Visibility alpha percent').press('Enter');
    console.log('HIDDEN', await page.getByLabel('Visibility alpha percent').inputValue());
    await page.evaluate(() => {
      window.saveEvents = []; window.saveWorkerCount = 0; window.saveTicks = 0;
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(...args) { super(...args); if (String(args[0]).includes('model-save')) {
          window.saveWorkerCount++;
          const started = window.saveTicks;
          this.addEventListener('message', e => window.saveEvents.push({ error: e.data.error, timings: e.data.timings, ticksDuringSave: window.saveTicks - started }));
        } }
      };
      window.tickTimer = setInterval(() => window.saveTicks++, 10);
    });
    await app.evaluate(({ dialog }, out) => {
      globalThis.saveDialogs = 0;
      dialog.showSaveDialog = async (_window, options) => { globalThis.saveDialogs++; return { canceled: false, filePath: out + '/ui-saved.' + options.filters[0].extensions[0] }; };
    }, out);
    // The fixture's Helpers carry the Bone type bit, which MDL expresses only by
    // its block keyword; MDL export now verifies and writes instead of failing.
    await page.keyboard.press('F12');
    await page.getByRole('button', { name: 'Save MDL…', exact: true }).click();
    await page.waitForFunction(() => window.saveEvents.length === 1);
    await page.getByRole('button', { name: 'Save MDL…', exact: true }).waitFor({ state: 'hidden' });
    console.log('SAVED MDL', await page.evaluate(() => ({ events: window.saveEvents, workers: window.saveWorkerCount, ticks: window.saveTicks })));
    if (await page.evaluate(() => window.saveEvents[0].error)) throw Error('MDL save verification failed');
    if (await app.evaluate(() => globalThis.saveDialogs) !== 1 || !fs.existsSync(path.join(out, 'ui-saved.mdl'))) throw Error('MDL save did not write output');
    await page.keyboard.press('F12');
    // Save as also names the model itself, not only the file.
    await page.getByLabel('Model name').fill('Renamed Knight');
    await page.screenshot({ path: path.join(out, 'electron-save-as-name.png') });
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.waitForFunction(() => window.saveEvents.length === 2);
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).waitFor({ state: 'hidden' });
    console.log('SAVED', await page.evaluate(() => ({ events: window.saveEvents, workers: window.saveWorkerCount, ticks: window.saveTicks, alpha: document.querySelector('[aria-label="Visibility alpha percent"]').value })));
    if (!fs.existsSync(path.join(out, 'ui-saved.mdx'))) throw Error('Save did not write output');
    if (!fs.readFileSync(path.join(out, 'ui-saved.mdx')).includes('Renamed Knight')) throw Error('Save as did not write the model name');
    const metrics = await page.evaluate(() => window.saveEvents);
    if (metrics.some(event => event.ticksDuringSave < 1)) throw Error('UI did not tick during worker save');
    fs.writeFileSync(path.join(out, 'electron-metrics.json'), JSON.stringify(metrics, null, 2));
    if (!fs.readFileSync(copy).equals(fs.readFileSync('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx'))) throw Error('Original copy changed on Save As');
    await app.evaluate(({ dialog }, out) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [out + '/ui-saved.mdx'] }); }, out);
    await page.keyboard.press('Control+o');
    await page.waitForFunction(() => document.title.includes('ui-saved.mdx'));
    await page.locator('[data-hotkey="animations"]').click();
    await page.getByLabel('Choose animation sequence').selectOption({ label: 'Decay Bone' });
    await page.locator('[data-hotkey="geosetsAll"]').click();
    if (await page.getByLabel('Visibility alpha percent').inputValue() !== '0') throw Error('Reopened visibility edit was lost');
    await page.screenshot({ path: path.join(out, 'electron-reopened.png') });
    console.log('REOPENED alpha=0; fixture preserved; controls usable');
  } finally { await closeApp(app); }
})().catch(e => { console.error(e); process.exitCode = 1; });
