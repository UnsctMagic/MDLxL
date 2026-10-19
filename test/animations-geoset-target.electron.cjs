const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// A bone picked in Movement or Bones must not take Visibility & Color away from
// the checked geosets in Animations, and it must be there again on return.
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'animations-geoset-target-ui');
  await fs.mkdir(out, { recursive: true }); const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'animations-geoset-target.mdx'); await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  const packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const app = await _electron.launch({ executablePath, args: packaged ? [fixture] : [root, fixture], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '1' }, timeout: 60000 });
  const errors = [], checks = []; let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    const tab = name => page.getByRole('button', { name, exact: true }).click();
    const picker = page.getByRole('combobox', { name: 'Movement bone or node', exact: true });
    const visible = page.getByRole('checkbox', { name: 'Visible at current frame', exact: true });
    const alpha = page.getByRole('spinbutton', { name: 'Visibility alpha percent', exact: true });
    const red = page.getByRole('spinbutton', { name: 'Animation R', exact: true });
    const notice = page.locator('.ac-notice');
    const expectGeosetControls = async label => {
      await red.waitFor({ state: 'visible' });
      assert.equal(await visible.isEnabled(), true, `${label}: Visibility checkbox`);
      assert.equal(await alpha.isEnabled(), true, `${label}: Alpha`);
      assert.equal(await red.isEnabled(), true, `${label}: RGB`);
      checks.push(`${label}: Visibility, Alpha and RGB follow the checked geosets`);
    };

    await page.locator('.classic-sidebar').waitFor();
    await tab('Movement');
    const rune = await picker.locator('option', { hasText: 'Rune_Core' }).getAttribute('value');
    await picker.selectOption(rune);
    assert.equal(await picker.inputValue(), rune);
    await tab('Animations');
    await expectGeosetControls('Movement -> Animations');

    await red.fill('128'); await red.press('Enter');
    await notice.filter({ hasText: /color tint/i }).waitFor({ state: 'attached' });
    assert.equal(await red.inputValue(), '128');
    checks.push(`RGB edit applies at once: ${await notice.textContent()}`);

    await tab('Movement');
    assert.equal(await picker.inputValue(), rune, 'Movement gets its bone back');
    checks.push('Animations -> Movement keeps the picked bone');

    await tab('Bones');
    const bones = page.getByRole('combobox', { name: 'Movement bone or node', exact: true });
    assert.equal(await bones.inputValue(), rune, 'Bones shares the selection');
    await tab('Animations');
    await expectGeosetControls('Bones -> Animations');
    await tab('Bones');
    assert.equal(await bones.inputValue(), rune, 'Bones gets its bone back');
    checks.push('Animations -> Bones keeps the picked bone');

    // Switching tabs adds no undo steps: the first Undo takes back the RGB edit.
    await tab('Animations');
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelector('input[aria-label="Animation R"]')?.value !== '128');
    await expectGeosetControls('After Undo');
    checks.push(`First Undo restores R to ${await red.inputValue()}`);

    // Unchecking and rechecking a geoset is no longer needed, but still works.
    const geoset = page.getByRole('checkbox', { name: 'Select geoset 0', exact: true });
    if (await geoset.count()) { await geoset.uncheck(); await geoset.check(); await expectGeosetControls('Geoset recheck'); }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, checks }, null, 2));
  } catch (error) {
    if (page) console.error('page text:', await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(cause => cause.message));
    console.error(error); console.log(JSON.stringify({ ok: false, checks, errors }, null, 2)); process.exitCode = 1;
  } finally {
    await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 10000))]);
    process.exit();
  }
})();
