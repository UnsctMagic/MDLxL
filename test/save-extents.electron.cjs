// Save As with "Calculate extents" ticked must save every time, including when
// the extents are already right and calculating changes nothing.
const { launchApp, closeApp } = require('./helpers/app.cjs');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const out = path.join(process.cwd(), 'out/save-extents');
  fs.mkdirSync(out, { recursive: true });
  const copy = path.join(out, 'fixture.mdx');
  fs.copyFileSync('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', copy);
  const { app, page } = await launchApp({ out, profile: path.join(out, 'profile-' + Date.now()), timeout: 60000, fixture: copy, pageTimeout: 20000, show: 'inactive' });
  try {
    page.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await page.waitForSelector('[data-hotkey="animations"]', { timeout: 60000 });
    await app.evaluate(({ dialog }, out) => {
      globalThis.saves = 0;
      dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: `${out}/saved-${++globalThis.saves}.${options.filters[0].extensions[0]}` });
    }, out);
    const saveAs = async () => {
      await page.keyboard.press('F12');
      const button = page.getByRole('button', { name: 'Save MDX…', exact: true });
      await button.waitFor();
      const extents = page.getByRole('checkbox', { name: 'Calculate extents' });
      if (!(await extents.isChecked())) await extents.check();
      await button.click();
      await button.waitFor({ state: 'hidden', timeout: 60000 });
    };
    await saveAs();
    if (!fs.existsSync(path.join(out, 'saved-1.mdx'))) throw Error('First Save As did not write');
    // The extents are now up to date: calculating again changes nothing.
    await saveAs();
    if (!fs.existsSync(path.join(out, 'saved-2.mdx'))) throw Error('Second Save As with up-to-date extents did not write');
    console.log('SAVE EXTENTS OK');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
