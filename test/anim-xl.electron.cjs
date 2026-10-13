// Disposable packaged AnimXL check with real mouse input. Never opens or replaces a user profile.
// MDLXL_PLAYWRIGHT_MODULE=<playwright> MDLXL_ANIMXL_EXE=<MDLxL.exe> node test/anim-xl.electron.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const out = path.resolve(process.env.MDLXL_ANIMXL_OUT || 'out/anim-xl-ui');
  const fixture = path.resolve(process.env.MDLXL_ANIMXL_FIXTURE || 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const executablePath = path.resolve(process.env.MDLXL_ANIMXL_EXE || 'out/pkg/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  const model = path.join(out, path.basename(fixture)); fs.copyFileSync(fixture, model);
  const errors = [], checks = [];
  const app = await _electron.launch({ executablePath, args: [model, '--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1400, height: 950 }); win.showInactive(); });
    await page.locator('[data-warmkey="animation"]').click();
    const button = page.locator('button.animxl-tool, [data-warmkey="animXL"]').first();
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'AnimXL' });
    await dialog.waitFor();
    checks.push('AnimXL opens from the ANIM module button');
    await dialog.getByLabel('Animation', { exact: true }).selectOption({ label: 'Attack - 1' });
    await page.waitForTimeout(800);
    await dialog.getByRole('button', { name: 'Pause' }).click();
    const strip = dialog.getByRole('slider', { name: 'Animation time' }), sb = await strip.boundingBox();
    await page.mouse.click(sb.x + sb.width * 0.45, sb.y + sb.height / 2);
    await page.waitForTimeout(400);
    await dialog.screenshot({ path: path.join(out, '1-original.png') });
    // Real mouse clicks on the slider tracks.
    for (const [label, u] of [['Ease', 0.6], ['Overlap', 0.8], ['Settle', 0.5], ['Weight', 0.4]]) {
      const box = await dialog.getByRole('slider', { name: label, exact: true }).boundingBox();
      await page.mouse.click(box.x + box.width * u, box.y + box.height / 2);
    }
    await page.waitForTimeout(500);
    const status = await dialog.locator('.ax-status').textContent();
    assert.match(status, /bones shaped/, `status after sliders: ${status}`);
    checks.push(`Sliders shape the animation: "${status}"`);
    await dialog.screenshot({ path: path.join(out, '2-shaped.png') });
    // Camera rotation with a real drag inside the preview.
    const pv = await dialog.locator('.ax-preview').boundingBox();
    const before = await page.screenshot({ clip: pv });
    await page.mouse.move(pv.x + pv.width * 0.5, pv.y + pv.height * 0.5);
    await page.mouse.down(); await page.mouse.move(pv.x + pv.width * 0.75, pv.y + pv.height * 0.5, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await page.screenshot({ clip: pv });
    assert.ok(!before.equals(after), 'camera drag changes the preview');
    checks.push('Preview camera rotates with a real mouse drag');
    await dialog.screenshot({ path: path.join(out, '3-rotated.png') });
    // THUNK at the paused moment.
    await dialog.getByRole('button', { name: 'Add THUNK here' }).click();
    assert.equal(await dialog.locator('.ax-thunk').count(), 1);
    checks.push('THUNK added from the paused moment');
    // Quick start preset, heavy steps and a flinch.
    await dialog.getByRole('button', { name: 'Heavy', exact: true }).click();
    await page.waitForTimeout(400);
    assert.equal(await dialog.getByRole('slider', { name: 'Weight', exact: true }).inputValue(), '80');
    checks.push('Heavy preset sets the sliders');
    await dialog.getByRole('button', { name: 'Add flinch here' }).click();
    assert.equal(await dialog.locator('.ax-flinch').count(), 1);
    checks.push(`Flinch marker added; ${await dialog.locator('.ax-foot').count()} footfall ticks shown with Heavy steps`);
    await page.waitForTimeout(400);
    await dialog.screenshot({ path: path.join(out, '4-heavy-preset.png') });
    // Pick bones in the preview: the skeleton appears while picking.
    await dialog.getByRole('button', { name: 'Pick in view' }).first().click();
    await page.waitForTimeout(500);
    await dialog.screenshot({ path: path.join(out, '5-picking.png') });
    await dialog.getByRole('button', { name: 'Done picking' }).click();
    checks.push('Pick in view toggles the skeleton picker');
    // Settings are remembered when AnimXL is closed and reopened.
    const overlapBefore = await dialog.getByRole('slider', { name: 'Overlap', exact: true }).inputValue();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForTimeout(400);
    await button.click();
    await dialog.waitFor();
    await dialog.getByLabel('Animation', { exact: true }).selectOption({ label: 'Attack - 1' });
    await page.waitForTimeout(400);
    assert.equal(await dialog.getByRole('slider', { name: 'Overlap', exact: true }).inputValue(), overlapBefore);
    checks.push(`Settings remembered after closing (Overlap ${overlapBefore})`);
    await dialog.getByRole('button', { name: 'Commit' }).click();
    await dialog.waitFor({ state: 'detached' });
    checks.push('Commit closes AnimXL');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    checks.push('Undo pressed after commit without errors');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ executablePath, checks, errors }, null, 2));
    console.log(checks.map(c => '✔ ' + c).join('\n'));
  } catch (error) {
    console.error('FAILED', error.message, errors);
    try { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); } catch {}
    process.exitCode = 1;
  } finally { await app.close(); }
})();
