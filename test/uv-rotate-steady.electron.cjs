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
    const arc = async (radius, start, sweep) => {
      const steps = Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
      for (let i = 1; i <= steps; i++) {
        const angle = start + sweep * i / steps;
        await page.mouse.move(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      }
    };
    // Starting left must not choose the opposite direction for the next circle.
    await page.mouse.move(cx + 72, cy); await page.mouse.down();
    await page.mouse.move(cx + 12, cy, { steps: 12 });
    const leftFirst = await page.evaluate(() => uvRotateState().drag.turn);
    check('starting left still rotates clockwise', Math.abs(leftFirst - .875) < .002);
    await arc(12, 0, Math.PI / 2);
    const afterLeftCircle = await page.evaluate(() => uvRotateState().drag.turn);
    await page.mouse.up();
    const mixedAngle = .875 + Math.PI / 2 * .7;
    check('a circle after moving left keeps the same direction', Math.abs(afterLeftCircle - mixedAngle) < .002 && matches((await page.evaluate(() => uvRotateInfo())).uv, expectedUV(afterLeftCircle)));
    await undo();
    for (const [name, radius, start, sweep, fine] of [
      ['inside the former 2px dead zone', 1.5, 0, Math.PI / 2, false],
      ['near the center', 12, 0, Math.PI / 2, false],
      ['outside the former slowdown', 60, 0, Math.PI / 2, false],
      ['far from the center', 200, Math.PI, Math.PI / 2, false],
      ['full circle ending at its start', 60, 0, Math.PI * 2, false],
      ['clockwise past a full turn', 100, 0, Math.PI * 2.5, false],
      ['counterclockwise past two turns', 100, 0, -Math.PI * 4.5, false],
      ['Alt precision near the center', 12, 0, Math.PI / 2, true],
    ]) {
      if (fine) await page.keyboard.down('Alt');
      await page.mouse.move(cx + radius * Math.cos(start), cy + radius * Math.sin(start));
      await page.mouse.down();
      await arc(radius, start, sweep);
      const turn = await page.evaluate(() => uvRotateState().drag.turn);
      await page.mouse.up();
      if (fine) await page.keyboard.up('Alt');
      await page.waitForFunction(() => !uvRotateState().drag);
      const after = await page.evaluate(() => uvRotateInfo().uv), angle = Math.abs(sweep) * .7 * (fine ? .2 : 1);
      const expected = expectedUV(angle), maxUVError = Math.max(...after.map((v, i) => Math.abs(v - expected[i])));
      measurements.push({ name, radius, expectedDegrees: angle * 180 / Math.PI, actualDegrees: turn * 180 / Math.PI, maxUVError });
      check(name + ': circular rotation at 70% with no center attenuation', Math.abs(turn - angle) < .002 && maxUVError < .002);
      if (radius === 12 && !fine) await page.screenshot({ path: path.join(out, 'circular-rotate.png') });
      await undo();
    }
    // Backtracking must keep turning clockwise, including after release at the start.
    await page.mouse.move(cx + 60, cy); await page.mouse.down();
    await arc(60, 0, Math.PI / 2);
    await page.waitForFunction(before => uvRotateInfo().uv.some((v, i) => Math.abs(v - before[i]) > .001), before.uv);
    await arc(60, Math.PI / 2, -Math.PI / 2); await page.mouse.up();
    await page.waitForFunction(before => JSON.stringify(__mdlxl.model()) !== before, modelBefore);
    check('circular backtracking keeps rotating clockwise after release', matches((await page.evaluate(() => uvRotateInfo())).uv, expectedUV(Math.PI * .7)));
    await undo();
    for (const [name, vx, vy] of [
      ['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1],
      ['down-right', Math.SQRT1_2, Math.SQRT1_2], ['up-left', -Math.SQRT1_2, -Math.SQRT1_2],
      ['up-right', Math.SQRT1_2, -Math.SQRT1_2], ['down-left', -Math.SQRT1_2, Math.SQRT1_2],
    ]) {
      await page.mouse.move(cx + vx * 12, cy + vy * 12); await page.mouse.down();
      await page.mouse.move(cx + vx * 72, cy + vy * 72, { steps: 12 });
      const turn = await page.evaluate(() => uvRotateState().drag.turn);
      await page.mouse.up();
      const after = await page.evaluate(() => uvRotateInfo().uv);
      const expectedMagnitude = 60 / 48 * .7;
      measurements.push({ name: 'straight ' + name, expectedMagnitudeDegrees: expectedMagnitude * 180 / Math.PI, actualDegrees: turn * 180 / Math.PI });
      check('straight ' + name + ' drag rotates clockwise', Math.abs(turn - expectedMagnitude) < .002 && matches(after, expectedUV(turn)));
      await undo();
    }
    // Both legs of a straight backtrack turn clockwise, even with the same endpoint.
    await page.mouse.move(cx + 12, cy); await page.mouse.down();
    await page.mouse.move(cx + 72, cy, { steps: 12 });
    await page.waitForFunction(before => uvRotateInfo().uv.some((v, i) => Math.abs(v - before[i]) > .001), before.uv);
    await page.mouse.move(cx + 12, cy, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(before => JSON.stringify(__mdlxl.model()) !== before, modelBefore);
    check('straight backtracking keeps rotating clockwise after release', matches((await page.evaluate(() => uvRotateInfo())).uv, expectedUV(1.75)));
    await undo();
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
