// Auto fix in the Transplant settings, clicked in the app (docs/agent-tasks/xfer-auto-fix.md). Luc Valonforth takes the
// Forest Troll Pillager (the owner's pair-18: "the weapon and angles are wrong ... offer users an AUTO FIX"): the checkbox
// is off when the window opens, ticking it rebuilds the result and says what it corrected, unticking it takes that back,
// and Transplant with it on is one Undo. Disposable profile and model copies under out/. Run it hidden:
// MDLXL_PLAYWRIGHT_MODULE=<playwright-core> MDLXL_TEST_EXE=<MDLxL.exe> node test/transplant-autofix.electron.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_AUTOFIX_OUT || 'out/transplant-autofix-ui');
const results = { checks: [], screenshots: [] };
const watchdog = setTimeout(() => { console.error('Auto fix harness timed out'); process.exit(3); }, Number(process.env.MDLXL_AUTOFIX_TIMEOUT || 420000));
const NOTE = 'Weapon set by its real grip and tip.';

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
    // The result view has its model and is not rebuilding.
    const built = async () => { await dialog.locator('[data-transplant-view] .game-preview-root').waitFor({ timeout: 120000 }); await dialog.locator('[data-transplant-building]').waitFor({ state: 'detached', timeout: 120000 }); await page.waitForTimeout(400); };
    const box = () => dialog.getByRole('checkbox', { name: 'Auto fix' });
    const notes = () => dialog.locator('aside[aria-label="Transplant"] p.xf-reason').allInnerTexts();
    const nodes = () => page.evaluate(() => { const m = window.__mdlxl.model(); return [m.Bones, m.Helpers].flat().filter(Boolean).length; });

    await page.locator('button.transfer-tool').click(); await dialog.waitFor(); await page.waitForTimeout(800);
    assert.equal(await dialog.locator('button[data-mode="transplant"]').getAttribute('aria-pressed'), 'true', 'the window opens in Transplant');
    await stubDialogs(app, { open: troll });
    await dialog.locator('aside[aria-label="From"]').getByRole('button', { name: 'Open file...' }).click();
    await built();
    assert.equal(await box().isChecked(), false, 'Auto fix is off when the window opens');
    assert.ok(!(await notes()).includes(NOTE), 'off: no Auto fix line');
    await shot('01-auto-fix-off'); await noCrash('plain result');
    results.checks.push('Auto fix is off by default; the plain result builds');

    await box().check(); await page.waitForTimeout(300); await built();
    await dialog.locator('aside[aria-label="Transplant"] p.xf-reason', { hasText: NOTE }).waitFor({ timeout: 60000 });
    await shot('02-auto-fix-on'); await noCrash('Auto fix on');
    results.checks.push('ticking Auto fix rebuilds the result and lists the weapon correction');

    await box().uncheck(); await page.waitForTimeout(300); await built();
    assert.ok(!(await notes()).includes(NOTE), 'off again: the line is gone');
    await noCrash('Auto fix off again');
    results.checks.push('unticking takes the line and the correction back');

    // Transplant with Auto fix on, then one Undo.
    await box().check(); await page.waitForTimeout(300); await built();
    const before = await nodes();
    await dialog.locator('button[data-hotkey="transfer:transplant"]').click();
    await page.waitForFunction(count => { const m = window.__mdlxl.model(); return [m.Bones, m.Helpers].flat().filter(Boolean).length !== count; }, before, { timeout: 120000 });
    await page.waitForTimeout(800); await shot('03-transplanted'); await noCrash('Transplant with Auto fix');
    await dialog.getByRole('button', { name: 'Close Transfer' }).click(); await page.waitForTimeout(300);
    await page.keyboard.press('Control+Z'); await page.waitForFunction(count => { const m = window.__mdlxl.model(); return [m.Bones, m.Helpers].flat().filter(Boolean).length === count; }, before, { timeout: 60000 });
    await noCrash('Undo');
    results.checks.push('Transplant with Auto fix on swaps the model in; one Undo restores it');
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    console.log('PASS', results.checks.length, 'checks'); for (const line of results.checks) console.log(' -', line);
  } catch (error) {
    try { await page.screenshot({ path: path.join(out, 'failed.png') }); } catch {}
    console.error('FAILED', error?.stack || error); process.exitCode = 1;
  } finally { clearTimeout(watchdog); try { await closeApp(app); } catch {} }
})();
