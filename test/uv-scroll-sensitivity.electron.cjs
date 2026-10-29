// Run against the rebuilt bundle with MDLXL_PLAYWRIGHT_MODULE pointing to Playwright.
const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');

const preferenceValue = selector => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) throw Error('Missing ${selector}');
  const props = findFiberProps(${JSON.stringify(selector)}, props => Number.isFinite(props.preferences?.scrollSensitivity));
  if (props) return props.preferences.scrollSensitivity;
  throw Error('Scroll sensitivity preferences unavailable for ${selector}');
})()`;

(async () => {
  const root = path.resolve(__dirname, '..');
  const fixture = path.join(root, 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const out = path.join(root, 'out', 'uv-scroll-sensitivity');
  const { app, page: launchedPage } = await launchApp({ fixture, out, pageTimeout: 15000 });
  try {
    const main = launchedPage;
    await main.getByLabel('Select geoset 3', { exact: true }).waitFor({ timeout: 60000 });
    await main.locator('[data-hotkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 3', { exact: true }).check();
    await main.locator('[aria-label="3D model viewport"]').click();
    await main.keyboard.press('Control+a');
    const outsideBefore = await main.evaluate(preferenceValue('[aria-label="3D model viewport"]'));

    const uvw = main.locator('.uv-tab-window'); // in-app dialog of the main window since f7316110
    await main.locator('[data-hotkey="uv"]').click();
    let uv = main;
    const map = uvw.getByLabel('UV coordinate editor');
    await map.waitFor({ timeout: 60000 });
    await uvw.locator('.game-preview-root').waitFor({ timeout: 60000 });
    assert.equal(await uv.evaluate(preferenceValue('[aria-label="UV coordinate editor"]')), 1.3);
    assert.equal(await uv.evaluate(preferenceValue('.uv-tab-window .game-preview-root')), 1.3);

    const bounds = await map.boundingBox();
    await uv.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await uv.mouse.down({ button: 'right' });
    await uv.mouse.wheel(0, -100);
    await uv.getByRole('status').filter({ hasText: 'Scroll sensitivity: 1.59×' }).waitFor();
    await uv.mouse.up({ button: 'right' });

    await uvw.getByRole('button', { name: 'Exit UV Wrapper', exact: true }).click();
    await uvw.waitFor({ state: 'detached' });
    await main.locator('[aria-label="3D model viewport"]').waitFor();
    assert.equal(await main.evaluate(preferenceValue('[aria-label="3D model viewport"]')), outsideBefore);

    await main.locator('[data-hotkey="uv"]').click();
    await uvw.getByLabel('UV coordinate editor').waitFor({ timeout: 60000 });
    await uvw.locator('.game-preview-root').waitFor({ timeout: 60000 });
    assert.equal(await uv.evaluate(preferenceValue('[aria-label="UV coordinate editor"]')), 1.3);
    assert.equal(await uv.evaluate(preferenceValue('.uv-tab-window .game-preview-root')), 1.3);
    console.log('PASS UV scroll sensitivity: starts at 1.3, stays UV-only, and resets after reopening');
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
