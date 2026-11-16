// Reset view: the small corner button of tool-window previews and of the UV map, with real mouse
// input on the app. After zooming and turning a preview, one click frames the model again.
// Disposable profile and model copy under out/. Run it hidden:
// MDLXL_PLAYWRIGHT_MODULE=<playwright-core> MDLXL_TEST_EXE=<MDLxL.exe> node test/reset-view.electron.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_RESET_VIEW_OUT || 'out/reset-view'); fs.mkdirSync(out, { recursive: true });
const checks = [];
const watchdog = setTimeout(() => { console.error('reset-view timed out'); process.exit(3); }, 300000);

(async () => {
  const source = fixturePath('transfer-footman');
  if (!source || !fs.existsSync(source)) throw Error('Test model transfer-footman is not on this machine');
  const fixture = path.join(out, 'TEST RESET VIEW 01.mdx'); fs.copyFileSync(source, fixture);
  const errors = [];
  const { app, page } = await launchApp({ out, fixture, errors, bounds: { x: -3000, y: 0, width: 1500, height: 960 }, timeout: 90000, pageTimeout: 30000 });
  try {
    await page.waitForFunction(() => !!window.__mdlxl?.model?.(), null, { timeout: 60000 });
    // One preview's camera: where it looks from (unit vector), its lens zoom and its whole matrix.
    const camera = root => root.evaluate(element => { const c = window.__mdlxl.preview(element).runtime.controls.object, m = c.matrixWorld.elements; return { facing: [m[8], m[9], m[10]], zoom: c.zoom, all: Array.from(m).map(v => Math.round(v * 100) / 100).join(',') + ' ' + c.zoom.toFixed(3) }; });
    // Zoom with the wheel and turn with the mouse button the preview rotates with, then Reset view.
    const preview = async (label, root) => {
      await root.waitFor({ timeout: 30000 }); await page.waitForTimeout(1500);
      const button = root.locator('.preview-reset-view');
      assert.equal(await button.count(), 1, `${label}: the preview has one Reset view button`);
      assert.ok(await button.isVisible(), `${label}: Reset view is visible`);
      // Before anything was touched Reset view has nothing to undo.
      // Some windows frame their part a moment after opening: wait until the view stands still.
      let untouched = await camera(root); for (let i = 0; i < 20; i++) { await page.waitForTimeout(400); const now = await camera(root); if (now.all === untouched.all) break; untouched = now; }
      await button.click(); await page.waitForTimeout(400);
      assert.equal((await camera(root)).all, untouched.all, `${label}: Reset view leaves an untouched view alone`);
      const box = await root.boundingBox(), x = box.x + box.width * 0.5, y = box.y + box.height * 0.5, before = await camera(root);
      await page.mouse.move(x, y);
      for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(80); }
      for (const mouse of ['middle', 'right']) { await page.mouse.move(x, y); await page.mouse.down({ button: mouse }); await page.mouse.move(x + 70, y + 30, { steps: 6 }); await page.mouse.up({ button: mouse }); await page.waitForTimeout(120); }
      const moved = await camera(root);
      assert.notEqual(moved.all, before.all, `${label}: the wheel and the mouse changed the view`);
      await button.click(); await page.waitForTimeout(500);
      const reset = await camera(root);
      assert.notEqual(reset.all, moved.all, `${label}: Reset view changes the view back`);
      assert.equal(reset.all, before.all, `${label}: Reset view gives the view as it was framed`);
      await button.click(); await page.waitForTimeout(300);
      assert.equal((await camera(root)).all, reset.all, `${label}: a second Reset view changes nothing`);
      assert.deepEqual(errors, [], `${label}: no page errors`);
      await page.screenshot({ path: path.join(out, `${label.replace(/[^a-z0-9]+/gi, '-')}.png`) });
      checks.push(`${label}: Reset view frames the model again after zooming and turning`);
    };
    const closeDialog = async dialog => { await dialog.locator('[data-hotkey="close"]').first().click(); await dialog.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {}); await page.waitForTimeout(400); };

    // Surface Effects.
    await page.locator('button.surface-effects-tool').click();
    const fx = page.getByRole('dialog', { name: 'Surface Effects' }); await fx.waitFor(); await page.waitForTimeout(2500);
    await preview('Surface Effects', fx.locator('.game-preview-root').first());
    await closeDialog(fx);
    // AnimXL.
    await page.locator('button.animxl-tool, [data-hotkey="animXL"]').first().click();
    const anim = page.getByRole('dialog', { name: 'AnimXL' }); await anim.waitFor(); await page.waitForTimeout(2500);
    await preview('AnimXL', anim.locator('.game-preview-root').first());
    await closeDialog(anim);
    // Transfer keeps its own button beside each scrubber and has no corner one.
    await page.locator('button.transfer-tool').click();
    const transfer = page.getByRole('dialog', { name: 'Transfer' }); await transfer.waitFor(); await page.waitForTimeout(1500);
    assert.equal(await transfer.locator('.preview-reset-view').count(), 0, 'Transfer: no corner button');
    assert.ok(await transfer.locator('.xs-reset').count() >= 1, 'Transfer: Reset view sits at the end of the scrubber');
    checks.push('Transfer: Reset view stays beside the scrubber, no second button in the corner');
    await closeDialog(transfer);
    // The main editor viewport has its own Fit and no corner button.
    assert.equal(await page.locator('[aria-label="3D model viewport"] .preview-reset-view').count(), 0, 'editor viewport: no corner button');
    // UV Wrapper: the live model preview and the UV map.
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.locator('[aria-label="3D model viewport"]').click();
    await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();
    const uv = page.locator('.uv-tab-window'); await uv.locator('.uv-grid-toolbar').waitFor({ timeout: 30000 }); await page.waitForTimeout(2000);
    await preview('UV live preview', uv.locator('.uv-live-preview .game-preview-root'));
    const pane = uv.locator('.uv-map-pane'), mapButton = pane.locator(':scope > .preview-reset-view');
    assert.equal(await mapButton.count(), 1, 'UV map: one Reset view button');
    // The map is a 2D canvas: where the picture sits on it and how big it is (the box around everything
    // brighter than the background). Hover highlights change single pixels, never that box.
    const paneBox = await pane.boundingBox(), park = () => page.mouse.move(paneBox.x + 12, paneBox.y + 70, { steps: 4 });
    const drawn = () => page.evaluate(() => { const canvas = document.querySelector('.uv-tab-window [aria-label="UV coordinate editor"]'), w = canvas.width, data = canvas.getContext('2d').getImageData(0, 0, w, canvas.height).data; let x0 = w, y0 = canvas.height, x1 = -1, y1 = -1; for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 150) { const x = (i / 4) % w, y = Math.floor(i / 4 / w); if (y < 40) continue; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; });
    await mapButton.click(); await park(); await page.waitForTimeout(500);
    const framed = await drawn();
    await page.mouse.move(paneBox.x + paneBox.width * 0.4, paneBox.y + paneBox.height * 0.4);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(80); }
    await park(); await page.waitForTimeout(500);
    const zoomed = await drawn();
    assert.ok(zoomed[2] - zoomed[0] > (framed[2] - framed[0]) * 1.3, `UV map: the wheel zoomed the map (${framed} -> ${zoomed})`);
    await mapButton.click(); await park(); await page.waitForTimeout(500);
    const reset = await drawn();
    assert.ok(reset.every((value, index) => Math.abs(value - framed[index]) <= 1), `UV map: Reset view shows the map where and as big as it was framed (${framed} -> ${reset})`);
    assert.deepEqual(errors, [], 'UV map: no page errors');
    await page.screenshot({ path: path.join(out, 'UV-Wrapper.png') });
    checks.push('UV map: Reset view undoes the zoom');
    for (const line of checks) console.log('ok - ' + line);
    console.log('PASSED');
  } finally { await closeApp(app); clearTimeout(watchdog); }
})().catch(error => { for (const line of checks) console.log('ok - ' + line); console.error(error); console.log('FAILED'); process.exit(1); });
