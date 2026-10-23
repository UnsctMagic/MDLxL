// Run against the rebuilt bundle: node test/uv-grabthrough.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve('out/uv-grabthrough'); fs.mkdirSync(output, { recursive: true });
  const fixture = path.resolve('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const geosetIndex = 15;
  const app = await _electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, `profile-${Date.now()}`) }, timeout: 60000,
  });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setBounds({ x: -3000, y: 0, width: 1440, height: 1000 }); window.showInactive(); });
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
        const root = document.querySelector('.uv-workspace');
        let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.eligibleSelection) return fiber.memoizedProps;
        throw Error('UV workspace props unavailable');
      };
      window.previewState = () => {
        const root = document.querySelector('.uv-tab-window .game-preview-root');
        let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState?.current;
          if (state?.native && state?.controls) return state;
        }
        throw Error('Preview camera unavailable');
      };
      // Unselected Live Select markers are filled with this exact blue.
      window.markerPixels = () => {
        const overlay = document.querySelector('.uv-tab-window [data-geometry-overlay]');
        const pixels = overlay.getContext('2d').getImageData(0, 0, overlay.width, overlay.height).data;
        let count = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] === 8 && pixels[offset + 1] === 111 && pixels[offset + 2] === 209 && pixels[offset + 3] === 255) count++;
        return count;
      };
    });
    await page.waitForFunction(() => uvState().selectionByGeoset[15]?.length === 248);
    const grabThrough = uvw.getByLabel('Grabthrough', { exact: true });
    assert.equal(await grabThrough.count(), 0, 'Grabthrough stays hidden until Live Select is on');

    await liveSelect.click();
    assert.equal(await liveSelect.getAttribute('aria-pressed'), 'true');
    await grabThrough.waitFor();
    assert.equal(await grabThrough.isChecked(), true, 'UV Grabthrough defaults on, like the vertex editor');
    assert.match(await grabThrough.locator('xpath=..').getAttribute('title'), /hidden behind it/, 'Grabthrough explains itself on hover');

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
      await page.waitForTimeout(150);
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

    await grabThrough.uncheck();
    assert.equal(await grabThrough.isChecked(), false);
    await clearSelection();
    await page.waitForFunction(value => markerPixels() > 0 && markerPixels() < value, throughPixels);
    const seenPixels = await page.evaluate(() => markerPixels());
    const seenCount = await marqueeAll();
    assert.ok(seenCount > 0, 'Grabthrough off: vertices on the visible side are still selected');
    assert.ok(seenCount < throughCount, `Grabthrough off skips vertices hidden behind the model (${throughCount} -> ${seenCount})`);

    await grabThrough.check();
    await clearSelection();
    assert.equal(await marqueeAll(), throughCount, 'turning Grabthrough back on picks through the model again');

    await liveSelect.click();
    assert.equal(await grabThrough.count(), 0, 'Grabthrough hides again when Live Select is off');
    console.log(`PASS Electron UV Grabthrough: defaults on, off hides back markers (${throughPixels} -> ${seenPixels} px) and skips hidden vertices (${throughCount} -> ${seenCount}), camera still rotates`);
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
