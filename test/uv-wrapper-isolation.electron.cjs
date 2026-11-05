const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { launchApp, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
(async () => {
  const out = path.resolve(process.env.MDLXL_UV_ISOLATION_OUT || 'out/uv-wrapper-isolation');
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('footman'), originalFile = fs.readFileSync(fixture), checks = [], errors = [];
  const check = (label, value) => { assert.ok(value, label); checks.push(label); console.log('PASS ' + label); };
  const { app, page } = await launchApp({ fixture, out, errors, bounds: { x: 0, y: 0, width: 1450, height: 1000 },
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    settings: { preferences: { uvSensitivity: 1, fineSensitivity: .2, graphics: { pauseWhenHidden: false } } } });
  try {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    const originalModel = await page.evaluate(() => JSON.stringify(__mdlxl.model()));
    await page.getByRole('button', { name: 'Surface Effects', exact: true }).click();
    const fx = page.getByRole('dialog', { name: 'Surface Effects', exact: true });
    const ready = () => page.waitForFunction(() => { const el = document.querySelector('.sfx-stage .game-preview-root'); if (!el) return false; const p = mdlxlProbe(el); return p.runtime?.captureApi.isReady && p.runtime.particleSourceModel === p.props.model && !document.querySelector('.sfx-apply')?.disabled; });
    await ready();
    await fx.getByLabel('Geoset', { exact: true }).selectOption('0');
    await fx.getByLabel('Find a surface effect').fill('Rune blade');
    await fx.getByRole('button', { name: 'Rune blade global animation', exact: true }).click();
    await ready();
    await fx.getByRole('button', { name: 'Rotate UVs', exact: true }).click();
    const canvas = fx.locator('.fx-uv-canvas .uv-editor canvas');
    await canvas.scrollIntoViewIfNeeded();
    await page.evaluate(() => { window.fitState = () => findFiberState('.fx-uv-canvas .uv-editor', s => s?.uv && s?.draw, { last: true }); });
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const map = await page.evaluate(() => { const d = fitState().drag; return { pivot: d.pivotScreen, center: d.center, sizeX: d.sizeX, sizeY: d.sizeY }; });
    await page.mouse.up();
    const before = await page.evaluate(() => Array.from(fitState().uv)), cx = box.x + map.pivot[0], cy = box.y + map.pivot[1];
    const rotated = angle => before.map((v, i) => { const j = i - i % 2, x = (before[j] - map.center[0]) * map.sizeX, y = (before[j + 1] - map.center[1]) * map.sizeY; return i % 2 ? map.center[1] + (x * Math.sin(angle) + y * Math.cos(angle)) / map.sizeY : map.center[0] + (x * Math.cos(angle) - y * Math.sin(angle)) / map.sizeX; });
    for (const shift of [false, true]) {
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.move(cx + 60, cy); await page.mouse.down();
      for (let step = 1; step <= 12; step++) { const a = Math.PI / 2 * step / 12; await page.mouse.move(cx + 60 * Math.cos(a), cy + 60 * Math.sin(a)); }
      const turn = await page.evaluate(() => fitState().drag.turn);
      check('FX Rotate retains its original one-for-one rate, Shift=' + shift, Math.abs(turn - Math.PI / 2) < .002);
      // Pointer coordinates round slightly; render the already-verified turn exactly.
      await page.waitForFunction(expected => Array.from(fitState().uv).every((v, i) => Math.abs(v - expected[i]) < 2e-6), rotated(turn));
      check('FX Rotate visible UVs retain original result, Shift=' + shift, true);
      await page.keyboard.press('Escape'); await page.mouse.up();
      if (shift) await page.keyboard.up('Shift');
      check('FX cancel restores UVs', JSON.stringify(await page.evaluate(() => Array.from(fitState().uv))) === JSON.stringify(before));
    }
    await fx.getByRole('button', { name: 'Scale UVs', exact: true }).click();
    await page.keyboard.down('Shift');
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + 50, cy, { steps: 10 });
    const expected = before.map((v, i) => map.center[i % 2] + (v - map.center[i % 2]) * 1.5);
    await page.waitForFunction(expected => Array.from(fitState().uv).every((v, i) => Math.abs(v - expected[i]) < 2e-6), expected);
    check('FX Scale with Shift retains its original full speed', true);
    await page.keyboard.press('Escape'); await page.mouse.up(); await page.keyboard.up('Shift');
    check('FX gestures leave the original model unchanged', await page.evaluate(() => JSON.stringify(__mdlxl.model())) === originalModel);
    check('source fixture unchanged', fs.readFileSync(fixture).equals(originalFile));
    check('no renderer errors', errors.length === 0);
  } catch (error) { await page.screenshot({ path: path.join(out, 'failure.png') }); throw error; }
  finally { fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors, fixture, bundle: bundleHashes() }, null, 2)); await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
