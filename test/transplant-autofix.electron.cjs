// Click the suggested Grip markers repair in Transplant on Luc Valonforth, then apply it and Undo.
// Run hidden using the shared packaged-app launcher.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_AUTOFIX_OUT || 'out/transplant-autofix-ui');
const results = { checks: [], screenshots: [] };
const watchdog = setTimeout(() => { console.error('Transplant repairs harness timed out'); process.exit(3); }, Number(process.env.MDLXL_AUTOFIX_TIMEOUT || 420000));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const copy = (key, name) => { const source = fixturePath(key); if (!source || !fs.existsSync(source)) throw Error(`Test model ${key} is not on this machine`); const target = path.join(out, name); fs.copyFileSync(source, target); return target; };
  const luc = copy('autofix-18-own', 'TEST XFER AUTOFIX 01.mdx'), troll = copy('autofix-18-donor', 'forest troll donor.mdx');
  const errors = [];
  const { app, page } = await launchApp({ out, fixture: luc, errors, bounds: { x: -3000, y: 0, width: 1500, height: 960 }, timeout: 90000, pageTimeout: 30000 });
  try {
    await page.waitForFunction(() => !!window.__mdlxl?.model?.(), null, { timeout: 60000 });
    const dialog = page.getByRole('dialog', { name: 'Transfer' });
    const shot = async name => { const file = path.join(out, name + '.png'); await page.screenshot({ path: file }); results.screenshots.push(file); };
    const noCrash = async where => { assert.equal(await page.locator('[data-error-boundary],.error-boundary').count(), 0, `error screen at ${where}`); assert.deepEqual(errors, [], `page errors at ${where}`); };
    const state = () => page.evaluate(() => window.__mdlxl.transfer()?.transplant);
    const built = previous => page.waitForFunction(old => {
      const view = window.__mdlxl.transfer()?.transplant;
      return view?.ready && !view.building && view.resultKey !== old;
    }, previous ?? null, {timeout:120000});
    const box = () => dialog.locator('input[data-repair="markers"]');
    const clickRepair = async () => {
      const {resultKey} = await state();
      await box().scrollIntoViewIfNeeded();
      const b = await box().boundingBox();
      assert.ok(b);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await built(resultKey);
    };
    const nodes = () => page.evaluate(() => { const m = window.__mdlxl.model(); return [m.Bones, m.Helpers].flat().filter(Boolean).length; });

    await page.locator('button.transfer-tool').click(); await dialog.waitFor(); await page.waitForTimeout(800);
    assert.equal(await dialog.locator('button[data-mode="transplant"]').getAttribute('aria-pressed'), 'true', 'the window opens in Transplant');
    await stubDialogs(app, { open: troll });
    await dialog.locator('aside[aria-label="From"]').getByRole('button', { name: 'Open file...' }).click();
    await built();
    await box().waitFor({timeout:120000});
    await built();
    assert.ok(await box().isChecked(), 'the suggested Grip markers starts checked');
    await noCrash('suggested repair');
    await shot('01-grip-markers-suggested');
    results.checks.push('the suggested Grip markers repair is ticked automatically');

    await clickRepair();
    assert.equal(await box().isChecked(),false);
    assert.equal((await state()).options.autoFix?.markers,undefined);
    await noCrash('Grip markers off');
    results.checks.push('unticking Grip markers rebuilds without that key');

    await clickRepair();
    assert.ok(await box().isChecked());
    assert.equal((await state()).options.autoFix.markers,true);
    const before = await nodes();
    await dialog.locator('button[data-hotkey="transfer:transplant"]').click();
    await page.waitForFunction(count => { const m = window.__mdlxl.model(); return [m.Bones, m.Helpers].flat().filter(Boolean).length !== count; }, before, { timeout: 120000 });
    await page.waitForTimeout(800); await shot('03-transplanted'); await noCrash('Transplant with Grip markers');
    await dialog.getByRole('button', { name: 'Close Transfer' }).click(); await page.waitForTimeout(300);
    await page.keyboard.press('Control+Z'); await page.waitForFunction(count => { const m = window.__mdlxl.model(); return [m.Bones, m.Helpers].flat().filter(Boolean).length === count; }, before, { timeout: 60000 });
    await noCrash('Undo');
    results.checks.push('Transplant with Grip markers swaps the model in and one Undo restores it');
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    console.log('PASS', results.checks.length, 'checks'); for (const line of results.checks) console.log(' -', line);
  } catch (error) {
    try { await page.screenshot({ path: path.join(out, 'failed.png') }); } catch {}
    console.error('FAILED', error?.stack || error); process.exitCode = 1;
  } finally { clearTimeout(watchdog); try { await closeApp(app); } catch {} }
})();
