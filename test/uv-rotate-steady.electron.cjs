const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

// Real mouse drags on the packaged UV Wrapper. Probes only read state.
(async () => {
  const out = path.resolve(process.env.MDLXL_UV_ROTATE_OUT || 'out/uv-rotate-steady');
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('footman'), originalFile = fs.readFileSync(fixture);
  const checks = [], errors = [], measurements = [], bundle = bundleHashes();
  const check = (label, actual, expected = true) => {
    assert.deepEqual(actual, expected, label); checks.push(label); console.log('PASS ' + label);
  };
  const { app, page } = await launchApp({ fixture, out, errors,
    bounds: { x: 0, y: 0, width: 1440, height: 1000 },
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    settings: { preferences: { pointerSensitivity: 1.22, uvSensitivity: 1.7, fineSensitivity: .2,
      rotation: { behavior: 'ring', sensitivity: .3, editors: {} }, graphics: { pauseWhenHidden: false } } } });
  try {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.getByLabel('3D model viewport', { exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();
    const uv = page.locator('.uv-tab-window'), canvas = uv.locator('.uv-editor canvas');
    await canvas.waitFor();
    await page.evaluate(() => {
      window.uvRotateState = () => findFiberState('.uv-editor', s => s?.uv && s?.draw, { last: true });
      window.uvRotateProps = () => findFiberProps('.uv-editor', p => p?.geoset && p?.onSelectVertices);
      window.uvRotateInfo = () => ({ ids: Array.from(uvRotateProps().selectedVertices), uv: Array.from(uvRotateState().uv) });
    });
    await page.waitForFunction(() => uvRotateInfo().ids.length > 2);
    await uv.getByRole('button', { name: 'Rotate', exact: true }).click();
    const box = await canvas.boundingBox(), before = await page.evaluate(() => uvRotateInfo());
    const modelBefore = await page.evaluate(() => JSON.stringify(__mdlxl.model()));
    // A stationary press reads the existing map transform without editing it.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const map = await page.evaluate(() => {
      const d = uvRotateState().drag; return { pivot: d.pivotScreen, center: d.center, sizeX: d.sizeX, sizeY: d.sizeY };
    });
    await page.mouse.up();
    const cx = box.x + map.pivot[0], cy = box.y + map.pivot[1];
    const expectedUV = angle => {
      const values = before.uv.slice();
      for (const i of before.ids) {
        const x = (before.uv[i * 2] - map.center[0]) * map.sizeX, y = (before.uv[i * 2 + 1] - map.center[1]) * map.sizeY;
        values[i * 2] = map.center[0] + (x * Math.cos(angle) - y * Math.sin(angle)) / map.sizeX;
        values[i * 2 + 1] = map.center[1] + (x * Math.sin(angle) + y * Math.cos(angle)) / map.sizeY;
      }
      return values;
    };
    const matches = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < 2e-6);
    const undo = async () => {
      await page.keyboard.press('Control+z');
      await page.waitForFunction(before => uvRotateInfo().uv.every((v, i) => Math.abs(v - before[i]) < 2e-6), before.uv);
      check('undo restores the entire model', await page.evaluate(() => JSON.stringify(__mdlxl.model())), modelBefore);
    };
    for (const [name, offsetX, offsetY, distance, fine] of [
      ['at the center', 0, 0, 48, false], ['inside the old dead zone', 0, 1, 48, false],
      ['across the center', -24, 0, 48, false], ['above the center', -24, -100, 48, false],
      ['far from the center', -180, 100, 48, false], ['reverse direction', 24, 0, -48, false],
      ['past a full turn', -240, 80, 480, false], ['Alt precision at the center', 0, 0, 48, true],
    ]) {
      if (fine) await page.keyboard.down('Alt');
      await page.mouse.move(cx + offsetX, cy + offsetY); await page.mouse.down();
      await page.mouse.move(cx + offsetX + distance, cy + offsetY, { steps: Math.max(8, Math.abs(distance) / 6) });
      await page.mouse.up();
      if (fine) await page.keyboard.up('Alt');
      await page.waitForFunction(() => !uvRotateState().drag);
      const after = await page.evaluate(() => uvRotateInfo().uv), angle = distance * .7 / 48 * (fine ? .2 : 1);
      const maxUVError = Math.max(...after.map((v, i) => Math.abs(v - expectedUV(angle)[i])));
      measurements.push({ name, expectedDegrees: angle * 180 / Math.PI, maxUVError });
      check(name + ': full drag response at 70% of the previous per-pixel rate', matches(after, expectedUV(angle)));
      if (name === 'at the center') await page.screenshot({ path: path.join(out, 'center-drag.png') });
      await undo();
    }
    // Reversing the same drag returns to the original UVs without a jump.
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + 48, cy, { steps: 8 });
    await page.waitForFunction(before => uvRotateInfo().uv.some((v, i) => Math.abs(v - before[i]) > .001), before.uv);
    await page.mouse.move(cx, cy, { steps: 8 }); await page.mouse.up();
    check('reversing a drag restores the original coordinates', matches((await page.evaluate(() => uvRotateInfo())).uv, before.uv));
    check('source model file unchanged', fs.readFileSync(fixture).equals(originalFile));
    check('no renderer errors', errors, []);
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png') });
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors, measurements, fixture, bundle }, null, 2));
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
