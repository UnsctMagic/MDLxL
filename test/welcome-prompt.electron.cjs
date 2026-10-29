const { launchApp, closeApp } = require('./helpers/app.cjs');
// Optional: MDLXL_PLAYWRIGHT_MODULE points to an external Playwright install.
// Drives the first-launch Auto update welcome hidden: a big icon beside a blue title, Yes / No thanks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  const output = path.join(root, 'out/welcome-prompt');
  fs.mkdirSync(output, { recursive: true });
  const run = fs.mkdtempSync(path.join(output, 'regression-'));
  const entry = path.join(run, 'main.cjs');
  fs.writeFileSync(entry, `
    const { app, nativeImage } = require('electron');
    const { showWelcomePrompt } = require(${JSON.stringify(path.join(root, 'electron/welcome-prompt.cjs'))});
    app.on('window-all-closed', () => {});
    app.whenReady().then(async () => {
      const icon = nativeImage.createFromPath(${JSON.stringify(path.join(root, 'public/branding/MDLxL.png'))}).resize({ width: 192, height: 192 }).toDataURL();
      const ask = () => showWelcomePrompt(null, { title: 'MDLxL', heading: 'Welcome to MDLxL', question: 'Would you like to enable auto updating?', detail: 'Detail', note: 'Note', labels: { yes: 'Yes, enable it', no: 'No thanks' }, icon, theme: 'light' });
      globalThis.answers = [await ask(), await ask()];
    });
  `);
  const { app, page: prompt } = await launchApp({ out: run, profile: path.join(run, 'profile'), env: { MDLVIS_HEADLESS: '1' }, timeout: 30000 });
  try {

    await prompt.waitForSelector('button.yes', { timeout: 15000 });
    const layout = await prompt.evaluate(() => {
      const img = document.querySelector('img').getBoundingClientRect(), h1 = document.querySelector('h1');
      return { iconWidth: img.width, iconRight: img.right, headingLeft: h1.getBoundingClientRect().left, headingColor: getComputedStyle(h1).color, buttons: [...document.querySelectorAll('button')].map(b => b.textContent) };
    });
    assert.ok(layout.iconWidth >= 90, 'the MDLxL icon is big');
    assert.ok(layout.iconRight <= layout.headingLeft, 'the icon sits beside the text');
    assert.equal(layout.headingColor, 'rgb(23, 74, 161)', 'the welcome title is blue');
    assert.deepEqual(layout.buttons, ['Yes, enable it', 'No thanks']);
    const frame = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds().height === BrowserWindow.getAllWindows()[0].getContentBounds().height);
    assert.ok(frame, 'the welcome has no title bar');
    await prompt.getByRole('button', { name: 'Yes, enable it' }).click();
    console.log('PASS big icon beside a blue title, no title bar');

    for (const started = Date.now(); ; await new Promise(r => setTimeout(r, 50))) {
      prompt = app.windows().find(page => !page.isClosed());
      if (prompt) break;
      if (Date.now() - started > 15000) throw new Error('the second welcome did not open');
    }
    await prompt.waitForSelector('button.yes', { timeout: 15000 });
    await prompt.keyboard.down('Escape');
    for (const started = Date.now(); !(await app.evaluate(() => Array.isArray(globalThis.answers))); await new Promise(r => setTimeout(r, 50)))
      if (Date.now() - started > 15000) throw new Error('the welcome did not answer');
    assert.deepEqual(await app.evaluate(() => globalThis.answers), ['yes', 'no']);
    console.log('PASS Yes turns Auto update on and Escape answers No thanks');
  } finally {
    await closeApp(app).catch(() => {});
    fs.rmSync(run, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
