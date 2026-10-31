// Run against the rebuilt bundle: node test/uv-grabthrough.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');

(async () => {
  const output = path.resolve('out/uv-grabthrough'); fs.mkdirSync(output, { recursive: true });
  const fixture = path.resolve('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const geosetIndex = 15;
  const { app, page: launchedPage } = await launchApp({ fixture, out: output, pageTimeout: 15000, bounds: { x: -3000, y: 0, width: 1440, height: 1000 } });
  try {
    const page = launchedPage;
    await page.getByLabel(`Select geoset ${geosetIndex}`, { exact: true }).waitFor({ timeout: 60000 });
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel(`Select geoset ${geosetIndex}`, { exact: true }).check();
    await page.locator('[aria-label="3D model viewport"]').click();
    await page.keyboard.press('Control+a');
    const uvw = page.locator('.uv-tab-window');
    await page.locator('[data-hotkey="uv"]').click();
    const liveSelect = uvw.getByRole('button', { name: 'Live Select', exact: true });
    await liveSelect.waitFor();
    const canvas = uvw.locator('[data-clean-model-canvas]');
    await canvas.waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.uvState = () => {
        const props = findFiberProps('.uv-workspace', props => !!props.eligibleSelection);
        if (!props) throw Error('UV workspace props unavailable');
        return props;
      };
      window.previewState = () => mdlxlProbe('.uv-tab-window .game-preview-root').runtime;
      // Unselected Live Select markers are filled with this exact blue.
      window.markerPixels = () => {
        const overlay = document.querySelector('.uv-tab-window [data-geometry-overlay]');
        const pixels = overlay.getContext('2d').getImageData(0, 0, overlay.width, overlay.height).data;
        let count = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] === 8 && pixels[offset + 1] === 111 && pixels[offset + 2] === 209 && pixels[offset + 3] === 255) count++;
        return count;
      };
      // Everything the overlay draws: markers plus the anti-aliased wire between them.
      window.drawnPixels = () => {
        const overlay = document.querySelector('.uv-tab-window [data-geometry-overlay]');
        const pixels = overlay.getContext('2d').getImageData(0, 0, overlay.width, overlay.height).data;
        let count = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset + 3]) count++;
        return count;
      };
    });
    await page.waitForFunction(() => uvState().selectionByGeoset[15]?.length === 248);
    const grabThrough = uvw.getByLabel('Grabthrough', { exact: true });
    assert.equal(await grabThrough.count(), 0, 'Grabthrough stays hidden until Live Select is on');
    assert.equal(await uvw.getByLabel('Lines', { exact: true }).count(), 0, 'Lines stays hidden until Live Select is on');

    await liveSelect.click();
    assert.equal(await liveSelect.getAttribute('aria-pressed'), 'true');
    await grabThrough.waitFor();
    assert.equal(await grabThrough.getAttribute('aria-pressed'), 'true', 'UV Grabthrough defaults on, like the vertex editor');
    assert.match(await grabThrough.getAttribute('title'), /hidden behind it/, 'Grabthrough explains itself on hover');

    const lines = uvw.getByLabel('Lines', { exact: true });
    assert.equal(await lines.getAttribute('aria-pressed'), 'true', 'Lines defaults on');
    assert.match(await lines.getAttribute('title'), /lines between vertices/, 'Lines explains itself on hover');
    // Lines and Grabthrough are toggle buttons right next to Live Select, like it.
    const footerOrder = await uvw.locator('.uv-preview-footer > *').evaluateAll(items => items.map(item => item.getAttribute('aria-label') || item.querySelector('input')?.getAttribute('aria-label') || item.textContent));
    assert.deepEqual(footerOrder, ['Live Select', 'Lines', 'Grabthrough', 'Selected Only', 'Hide RGB'], 'footer order');
    await uvw.locator('.uv-live-preview').screenshot({ path: path.join(output, 'live-select-footer.png') });

    // Turn the model with a real mouse drag so the far side faces away.
    let box = await canvas.boundingBox();
    const cameraBefore = await page.evaluate(() => previewState().controls.object.quaternion.toArray());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 8 }); await page.mouse.up();
    assert.notDeepEqual(await page.evaluate(() => previewState().controls.object.quaternion.toArray()), cameraBefore, 'dragging the Live Select preview rotates the camera');

    const marqueeAll = async () => {
      box = await canvas.boundingBox();
      await page.mouse.move(box.x + 4, box.y + 4);
      await page.keyboard.down('a');
      await page.mouse.move(box.x + 4, box.y + 4); await page.mouse.down();
      await page.mouse.move(box.x + box.width - 4, box.y + box.height - 4, { steps: 6 });
      await page.mouse.up();
      await page.keyboard.up('a');
      await settle(page, 150);
      return page.evaluate(() => uvState().selectionByGeoset[15]?.length || 0);
    };
    const clearSelection = async () => {
      await page.evaluate(() => uvState().onSelectionChange({ ...uvState().selectionByGeoset, 15: [] }));
      await page.waitForFunction(() => !uvState().selectionByGeoset[15]?.length);
    };

    await clearSelection();
    await page.waitForFunction(() => markerPixels() > 0);
    const throughPixels = await page.evaluate(() => markerPixels());
    const throughCount = await marqueeAll();
    assert.ok(throughCount > 0, 'Grabthrough on: a box over the preview selects vertices');

    await grabThrough.click();
    assert.equal(await grabThrough.getAttribute('aria-pressed'), 'false');
    await clearSelection();
    await page.waitForFunction(value => markerPixels() > 0 && markerPixels() < value, throughPixels);
    const seenPixels = await page.evaluate(() => markerPixels());
    const seenCount = await marqueeAll();
    assert.ok(seenCount > 0, 'Grabthrough off: vertices on the visible side are still selected');
    assert.ok(seenCount < throughCount, `Grabthrough off skips vertices hidden behind the model (${throughCount} -> ${seenCount})`);

    await grabThrough.click();
    await clearSelection();
    assert.equal(await marqueeAll(), throughCount, 'turning Grabthrough back on picks through the model again');

    // With Lines off the wire between vertices disappears; the vertex dots stay.
    await page.waitForFunction(() => drawnPixels() > 0);
    const drawnWithLines = await page.evaluate(() => drawnPixels());
    await lines.click();
    await page.waitForFunction(value => drawnPixels() < value, drawnWithLines);
    const drawnWithoutLines = await page.evaluate(() => drawnPixels());
    assert.ok(drawnWithoutLines > 0, 'vertex dots stay visible with Lines off');
    await lines.click();
    await page.waitForFunction(value => drawnPixels() >= value, drawnWithLines);
    console.log(`Lines toggle: wire hidden while vertex dots stay (${drawnWithLines} -> ${drawnWithoutLines} drawn px)`);

    await liveSelect.click();
    assert.equal(await grabThrough.count(), 0, 'Grabthrough hides again when Live Select is off');
    assert.equal(await uvw.getByLabel('Lines', { exact: true }).count(), 0, 'Lines hides when Live Select is off');

    // Show normals (N) cannot be switched on from the UV mapper.
    // The Quick display box mirrors the setting at once; the main view behind the
    // expanded UV Wrapper only redraws later, so its props would read stale.
    const quickNormals = page.locator('.quick-display input[data-hotkey="normals"]');
    const mainNormals = () => quickNormals.isChecked();
    // Each press is checked on its own: two presses would cancel out and hide a toggle.
    const pressN = async () => { await page.keyboard.press('n'); await settle(page, 400); return mainNormals(); };
    const overUV = async () => { box = await canvas.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); };
    assert.equal(await mainNormals(), false);
    await overUV();
    assert.equal(await pressN(), false, 'N inside the UV mapper cannot turn normals on');
    assert.equal(await pressN(), false, 'not even on a second press');
    assert.equal(await quickNormals.isDisabled(), true, 'the Quick display Normals box is greyed out while the UV mapper is in use');
    await uvw.getByRole('button', { name: 'Exit UV Wrapper', exact: true }).click();
    await uvw.waitFor({ state: 'detached' });
    const mainView = await page.locator('[aria-label="3D model viewport"]').boundingBox();
    await page.mouse.move(mainView.x + mainView.width / 2, mainView.y + mainView.height / 2);
    assert.equal(await pressN(), true, 'N still turns normals on in the main view');
    // Normals that were already on can be turned off from the UV mapper, but not back on.
    await page.locator('[data-hotkey="uv"]').click();
    await canvas.waitFor({ timeout: 60000 });
    await overUV();
    assert.equal(await pressN(), false, 'N inside the UV mapper turns normals that were on off');
    assert.equal(await pressN(), false, 'but not back on');
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.quick-display')), false, 'the N shortcut does not pull focus out of the UV mapper');
    console.log(`PASS Electron UV Grabthrough: defaults on, off hides back markers (${throughPixels} -> ${seenPixels} px) and skips hidden vertices (${throughCount} -> ${seenCount}), camera still rotates; N cannot turn normals on from the UV mapper but still works in the main view`);
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
