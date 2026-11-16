// A Manager opened over Showcase undoes its own model edits (click sweep, 15 Nov 2026: every Manager edit made in
// Showcase failed Undo, because Showcase sent all Undo to its own settings history). Real clicks and keys only.
// Showcase's own Ctrl+Z (outside a Manager) keeps undoing Showcase settings, as before.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { launchApp, closeApp, waitForInfo } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve(process.env.MDLXL_SCREENSHOTS || 'out/showcase-manager-undo');
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  // A throwaway copy: the test-model collection is never written.
  const source = fixturePath('footman'), file = path.join(out, 'Footman.mdx');
  fs.copyFileSync(source, file); fs.cpSync(path.join(path.dirname(source), 'Textures'), path.join(out, 'Textures'), { recursive: true });
  const { app, page, errors } = await launchApp({ fixture: file, out, bounds: { x: -3000, y: 0, width: 1440, height: 1000 }, settings: { preferences: { language: 'en', learn: { enabled: false } } } });
  try {
    await waitForInfo(page, 'Opened Footman.mdx');
    const materials = () => page.evaluate(() => window.__mdlxl.model().Materials.length);
    const before = await materials();

    await page.getByRole('button', { name: 'Showcase', exact: true }).click();
    // Showcase's preset buttons wait for its preview; once enabled, Showcase is ready.
    await page.waitForFunction(() => document.querySelector('[data-hotkey="showcase:save-preset"]')?.disabled === false, null, { timeout: 30000 });

    await page.getByRole('menuitem', { name: 'Managers', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Material Manager…', exact: true }).click();
    const manager = page.getByRole('dialog', { name: 'Material Manager', exact: true });
    await manager.waitFor();

    await manager.getByRole('button', { name: 'New', exact: true }).click();
    await page.waitForFunction(count => window.__mdlxl.model().Materials.length === count + 1, before);

    // Ctrl+Z and Ctrl+Y with focus where the click left it, inside the Manager.
    await page.keyboard.press('Control+z');
    await page.waitForFunction(count => window.__mdlxl.model().Materials.length === count, before, { timeout: 5000 }).catch(() => {});
    assert.equal(await materials(), before, 'Ctrl+Z in a Manager over Showcase undoes the new material');
    await page.keyboard.press('Control+y');
    await page.waitForFunction(count => window.__mdlxl.model().Materials.length === count + 1, before, { timeout: 5000 }).catch(() => {});
    assert.equal(await materials(), before + 1, 'Ctrl+Y redoes it');

    // The Manager's own Undo and Redo buttons do the same.
    await manager.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    await page.waitForFunction(count => window.__mdlxl.model().Materials.length === count, before, { timeout: 5000 }).catch(() => {});
    assert.equal(await materials(), before, 'Undo manager edit undoes the new material in Showcase');
    await manager.getByRole('button', { name: 'Redo manager edit', exact: true }).click();
    await page.waitForFunction(count => window.__mdlxl.model().Materials.length === count + 1, before, { timeout: 5000 }).catch(() => {});
    assert.equal(await materials(), before + 1, 'Redo manager edit redoes it');
    await page.screenshot({ path: path.join(out, 'manager-over-showcase.png') });

    // Outside a Manager, Ctrl+Z in Showcase stays with Showcase's own settings and leaves the model alone.
    await manager.getByRole('button', { name: 'Close Material Manager', exact: true }).click();
    await manager.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Showcase', exact: true }).click();
    await page.keyboard.press('Control+z'); await page.waitForTimeout(600);
    assert.equal(await materials(), before + 1, 'Showcase Ctrl+Z does not undo model edits');

    assert.deepEqual(errors, []);
    console.log('showcase-manager-undo: passed');
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exit(1); });
