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
    // Shift slows only subsequent movement; pressing/releasing it never jumps
    // the current UV orientation and works in both circular directions.
    for (const winding of [1, -1]) {
      await page.mouse.move(cx + 60, cy); await page.mouse.down();
      await arc(60, 0, winding * Math.PI / 4);
      const normal = winding * Math.PI / 4 * .7;
      await page.waitForFunction(expected => uvRotateInfo().uv.every((v, i) => Math.abs(v - expected[i]) < 2e-6), expectedUV(normal));
      await page.keyboard.down('Shift');
      check('Shift press keeps the current UV orientation ' + winding, matches((await page.evaluate(() => uvRotateInfo())).uv, expectedUV(normal)));
      await arc(60, winding * Math.PI / 4, winding * Math.PI / 4);
      const slowTurn = await page.evaluate(() => uvRotateState().drag.turn);
      check('Shift held mid-drag slows circular rotation ' + winding, Math.abs(slowTurn - normal * 1.2) < .002);
      await page.waitForFunction(expected => uvRotateInfo().uv.every((v, i) => Math.abs(v - expected[i]) < 2e-6), expectedUV(slowTurn));
      await page.keyboard.up('Shift');
      check('Shift release keeps the current UV orientation ' + winding, matches((await page.evaluate(() => uvRotateInfo())).uv, expectedUV(slowTurn)));
      await arc(60, winding * Math.PI / 2, winding * Math.PI / 4);
      const resumedTurn = await page.evaluate(() => uvRotateState().drag.turn);
      check('Shift release restores normal circular speed ' + winding, Math.abs(resumedTurn - slowTurn - normal) < .002);
      await page.mouse.up();
      check('Shift circular gesture commits visible UVs ' + winding, matches((await page.evaluate(() => uvRotateInfo())).uv, expectedUV(resumedTurn)));
      await undo();
    }
    // Owner lock (6 Nov 2026, docs/UV-ROTATE-ZOOM.md): only movement AROUND the
    // centre turns the selection. These checks fail on the 4 Nov straight-line rule.
    const turnNow = () => page.evaluate(() => uvRotateState().drag.turn);
    // Same circle, same strength at any distance from 48 px outward.
    for (const [name, radius, start, sweep, fine] of [
      ['quarter circle at 24 px', 24, 0, Math.PI / 2, false],
      ['quarter circle at 60 px', 60, 0, Math.PI / 2, false],
      ['quarter circle at 120 px', 120, Math.PI, Math.PI / 2, false],
      ['quarter circle at 300 px', 300, Math.PI / 2, Math.PI / 2, false],
      ['full circle ending at its start', 60, 0, Math.PI * 2, false],
      ['clockwise past a full turn', 100, 0, Math.PI * 2.5, false],
      ['counterclockwise past two turns', 100, 0, -Math.PI * 4.5, false],
      ['Alt fine control', 80, 0, Math.PI / 2, true],
    ]) {
      if (fine) await page.keyboard.down('Alt');
      await page.mouse.move(cx + radius * Math.cos(start), cy + radius * Math.sin(start));
      await page.mouse.down();
      await arc(radius, start, sweep);
      const turn = await turnNow();
      await page.mouse.up();
      if (fine) await page.keyboard.up('Alt');
      await page.waitForFunction(() => !uvRotateState().drag);
      const after = await page.evaluate(() => uvRotateInfo().uv), angle = sweep * .7 * (fine ? .2 : 1);
      const expected = expectedUV(angle), maxUVError = Math.max(...after.map((v, i) => Math.abs(v - expected[i])));
      measurements.push({ name, radius, expectedDegrees: angle * 180 / Math.PI, actualDegrees: turn * 180 / Math.PI, maxUVError });
      check(name + ': turns 70% of the mouse circle', Math.abs(turn - angle) < .002 && maxUVError < .002);
      await undo();
    }
    // Close to the centre the same circle turns less, steadily, never more.
    {
      await page.mouse.move(cx + 12, cy); await page.mouse.down();
      await arc(12, 0, Math.PI / 2);
      const turn = await turnNow(); await page.mouse.up();
      measurements.push({ name: 'quarter circle at 12 px', actualDegrees: turn * 180 / Math.PI });
      check('quarter circle at 12 px turns half as far, same direction', Math.abs(turn - Math.PI / 2 * .7 * .5) < .01);
      await page.screenshot({ path: path.join(out, 'circular-rotate.png') });
      await undo();
    }
    // Moving straight toward or away from the centre never turns the selection.
    for (const [name, vx, vy] of [
      ['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1],
      ['down-right', Math.SQRT1_2, Math.SQRT1_2], ['up-left', -Math.SQRT1_2, -Math.SQRT1_2],
    ]) {
      for (const [from, to] of [[24, 130], [130, 24]]) {
        await page.mouse.move(cx + vx * from, cy + vy * from); await page.mouse.down();
        await page.mouse.move(cx + vx * to, cy + vy * to, { steps: 16 });
        const turn = await turnNow(); await page.mouse.up();
        measurements.push({ name: `straight ${name} ${from}->${to}`, actualDegrees: turn * 180 / Math.PI });
        check(`straight ${name} ${from < to ? 'away from' : 'toward'} the centre does not turn`, Math.abs(turn) < .01);
        if (await page.evaluate(before => JSON.stringify(__mdlxl.model()) !== before, modelBefore)) await undo();
      }
    }
    // Sweeping straight across the piece, just beside its centre, never snaps.
    for (const offset of [6, -6]) {
      await page.mouse.move(cx - 150, cy + offset); await page.mouse.down();
      let previous = 0, biggest = 0;
      for (let x = -148; x <= 150; x += 2) {
        await page.mouse.move(cx + x, cy + offset);
        const turn = await turnNow(); biggest = Math.max(biggest, Math.abs(turn - previous)); previous = turn;
      }
      await page.mouse.up();
      measurements.push({ name: 'across the piece at ' + offset + ' px', totalDegrees: previous * 180 / Math.PI, biggestStepDegrees: biggest * 180 / Math.PI });
      // 2 px per sample: under 3 degrees per pixel, the speed of circling at 24 px.
      check('across the piece at ' + offset + ' px: no step faster than 3 degrees per pixel', biggest < 2 * 3 * Math.PI / 180);
      check('across the piece at ' + offset + ' px: no spin past 100 degrees', Math.abs(previous) < 100 * Math.PI / 180);
      await undo();
    }
    // An imperfect circle keeps its direction when its radius wobbles.
    for (const winding of [1, -1]) {
      await page.mouse.move(cx + 80, cy); await page.mouse.down();
      let previousTurn = 0;
      for (let step = 1; step <= 72; step++) {
        const angle = winding * 2 * Math.PI * step / 72, radius = 80 + 20 * Math.sin(3 * angle);
        await page.mouse.move(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        const turn = await turnNow();
        assert.ok((turn - previousTurn) * winding > 0, 'varying-radius circle keeps its winding at step ' + step);
        previousTurn = turn;
      }
      await page.mouse.up();
      check('varying-radius circle ' + winding + ' turns exactly one 70% circle', Math.abs(previousTurn - winding * 2 * Math.PI * .7) < .002);
      await undo();
    }
    // A committed rotation does not change how the next circle turns.
    await page.mouse.move(cx + 60, cy); await page.mouse.down();
    await arc(60, 0, Math.PI / 2); await page.mouse.up();
    const rotated = await page.evaluate(() => uvRotateInfo().uv), firstAngle = Math.PI / 2 * .7;
    check('first committed circle turns clockwise', matches(rotated, expectedUV(firstAngle)));
    await page.mouse.move(cx + 60, cy); await page.mouse.down();
    await arc(60, 0, Math.PI / 2); await page.mouse.up();
    check('the next clockwise circle adds the same turn', matches((await page.evaluate(() => uvRotateInfo())).uv, expectedUV(firstAngle * 2)));
    await page.keyboard.press('Control+z');
    await page.waitForFunction(expected => uvRotateInfo().uv.every((v, i) => Math.abs(v - expected[i]) < 2e-6), rotated);
    check('undo restores the preceding rotated state', matches((await page.evaluate(() => uvRotateInfo())).uv, rotated));
    await undo();
    // Reversing the same circular path restores the original UVs.
    await page.mouse.move(cx + 60, cy); await page.mouse.down();
    await arc(60, 0, Math.PI / 2);
    await page.waitForFunction(before => uvRotateInfo().uv.some((v, i) => Math.abs(v - before[i]) > .001), before.uv);
    await arc(60, Math.PI / 2, -Math.PI / 2); await page.mouse.up();
    check('circular backtracking restores the original UVs', matches((await page.evaluate(() => uvRotateInfo())).uv, before.uv));
    if (await page.evaluate(before => JSON.stringify(__mdlxl.model()) !== before, modelBefore)) await undo();
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
