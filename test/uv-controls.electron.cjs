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
    // Panel width "Drag ... Double-click to reset it": drag the sidebar edge with the mouse, then double-click it.
    const panelWidth = () => main.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-width').trim());
    const sidebar = main.locator('.classic-sidebar'), startWidth = await panelWidth();
    // The handle is a thin strip on the sidebar's left edge (a zero-height element with a full-height hit area).
    const edgeBox = () => sidebar.locator('.sidebar-resizer').evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x - 2, y: r.y + 120, width: 6, height: 0 }; });
    assert.equal(startWidth, '240px', 'a new profile starts at the default panel width');
    let edge = await edgeBox();
    assert.equal(await main.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, [edge.x + 1, edge.y]), 'sidebar-resizer', 'the panel edge is the resize handle');
    await main.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2); await main.mouse.down();
    await main.mouse.move(edge.x + edge.width / 2 - 80, edge.y + edge.height / 2, { steps: 8 }); await main.mouse.up();
    await main.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-width').trim() !== '240px', null, { timeout: 5000 });
    const dragged = await panelWidth(); assert.ok(parseFloat(dragged) > 290, 'dragging the edge left widens the panel: ' + dragged);
    await main.waitForTimeout(300); edge = await edgeBox();
    await main.mouse.dblclick(edge.x + edge.width / 2, edge.y + edge.height / 2);
    await main.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--panel-width').trim() === '240px', null, { timeout: 5000 })
      .catch(async () => { throw Error('double-clicking the panel edge did not reset the width: ' + await panelWidth()); });
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
    // UV splitters "drag or use arrow keys · double-click to reset": drag each with the mouse, then press an
    // arrow key with focus wherever that drag left it, then double-click the splitter.
    for (const [label, delta, key, step, reset] of [['Resize texture and live-view columns', [-60, 0], 'ArrowLeft', 2, 40], ['Resize live model preview', [0, -40], 'ArrowDown', 2, 62]]) {
      const splitter = uv.getByRole('separator', { name: label, exact: true }), value = async () => Number(await splitter.getAttribute('aria-valuenow'));
      const start = await value(); assert.equal(start, reset, label + ' starts at its default');
      let b = await splitter.boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      await uv.mouse.move(cx, cy); await uv.mouse.down(); await uv.mouse.move(cx + delta[0], cy + delta[1], { steps: 8 }); await uv.mouse.up(); await uv.waitForTimeout(200);
      const moved = await value(); assert.notEqual(moved, start, label + ': a mouse drag moves the splitter');
      await uv.keyboard.press(key); await uv.waitForTimeout(150);
      assert.equal(await value(), moved + step, label + ': ' + key + ' after the drag moves it by ' + step);
      b = await splitter.boundingBox(); await uv.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2); await uv.waitForTimeout(200);
      assert.equal(await value(), reset, label + ': double-click resets it');
    }
    const after = await uv.evaluate(() => uvControlsState());
    assert.deepEqual(after.model, before.model);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS hidden Electron UV: panel width drag + double-click reset, UV splitters drag/arrow/double-click reset, controls, selected-only isolation, per-geoset RGB toggle independent of visibility, original model unchanged');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
