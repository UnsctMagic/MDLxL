// Run against the rebuilt bundle: node test/uv-controls.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
const out = path.join(root, 'out', 'uv-controls');
const waitFor = async (page, predicate) => {
  const value = await page.waitForFunction(predicate, null, { timeout: 15000, polling: 100 });
  return value.jsonValue();
};
const click = (page, selector) => page.locator(selector).evaluate(element => element.click());
(async () => {
  const original = fs.readFileSync(fixture);
  const { app, page: main } = await launchApp({ fixture, out, args: ['--disable-gpu'], pageTimeout: 15000 });
  try {
    await main.getByLabel('Select geoset 3', { exact: true }).waitFor();
    await click(main, '[data-hotkey="geosetsClear"]');
    await click(main, '[aria-label="Select geoset 3"]');
    await main.getByLabel('3D model viewport', { exact: true }).waitFor();
    await main.getByLabel('3D model viewport', { exact: true }).focus();
    await main.keyboard.press('Control+a');
    await waitFor(main, () => !document.querySelector('[data-hotkey="uv"]').disabled);
    await click(main, '[data-hotkey="uv"]');
    const uv = main; // the UV Wrapper is an in-app dialog of the main window since f7316110
    await uv.locator('.uv-tab-window .uv-preview-footer [aria-label="Selected Only"]').waitFor();
    await uv.locator('.uv-tab-window .game-preview-root').waitFor();
    const buttons = await uv.evaluate(() => [...document.querySelectorAll('.uv-tab-window .uv-preview-footer>button,.uv-tab-window .uv-preview-footer>*>button[aria-label="Live Select"]')].map(e => e.textContent.trim()));
    assert.deepEqual(buttons, ['Live Select', 'Selected Only', 'Hide RGB']); // Select New was removed in 3e35aca8; Live Select sits in a group with its options arrow
    await uv.evaluate(() => {
      window.uvControlsState = () => {
        const p = mdlxlProbe('.uv-tab-window .game-preview-root').props;
        if (!p) throw Error('Preview props unavailable');
        return { only: p.uvOnlySelected, hidden: p.hiddenGeosets ? [...p.hiddenGeosets] : null, rgb: p.hideRgbGeoset, model: p.model.GeosetAnims[3]?.Color };
      };
    });
    const before = await uv.evaluate(() => uvControlsState());
    assert.equal(before.only, false); assert.equal(before.hidden, null); assert.equal(before.rgb, null);
    await click(uv, '.uv-tab-window [aria-label="Selected Only"]');
    const isolated = await waitFor(uv, () => uvControlsState().only && uvControlsState().hidden?.length === 47 && !uvControlsState().hidden.includes(3));
    assert.equal(isolated, true);
    await click(uv, '.uv-tab-window .uv-preview-footer>button:last-child');
    assert.equal(await waitFor(uv, () => uvControlsState().rgb === 3), true);
    await click(uv, '.uv-tab-window [aria-label="Selected Only"]');
    assert.equal(await waitFor(uv, () => !uvControlsState().only && uvControlsState().hidden === null && uvControlsState().rgb === 3), true);
    await click(uv, '.uv-tab-window .uv-preview-footer>button:last-child');
    assert.equal(await waitFor(uv, () => uvControlsState().rgb === null), true);
    const after = await uv.evaluate(() => uvControlsState());
    assert.deepEqual(after.model, before.model);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS hidden Electron UV: controls, selected-only isolation, per-geoset RGB toggle independent of visibility, original model unchanged');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
