const { launchApp, closeApp } = require('./helpers/app.cjs');
// UV map Rotate is a flat 2D turn: the selection follows the mouse around its
// centre one for one, near or far, from a drag started on it or away from it, and
// keeps adding up past a full circle. The profile carries the owner's real mouse
// settings (3D rotation at 0.3x, pointer 1.22x), which must not slow it.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const { createStarterDocument } = await import('../src/starter-model.js');
  const out = path.resolve(process.env.MDLXL_UV_ROTATE_OUT || 'out/uv-rotate-steady/' + Date.now());
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'Starter.mdx'); fs.writeFileSync(fixture, createStarterDocument().serialize('mdx'));
  const checks = [], errors = [];
  const check = (label, pass, evidence) => { checks.push({ label, pass: !!pass, evidence }); console.log((pass ? 'PASS ' : 'FAIL ') + label + (evidence === undefined ? '' : ' ' + JSON.stringify(evidence))); };
  const profile = path.join(out, 'profile'); fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { pointerSensitivity: 1.22, rotation: { behavior: 'ring', sensitivity: .3, editors: {} } } }));
  const { app, page } = await launchApp({ out, profile, args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'], env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture, errors, pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1280, height: 900 }, show: 'hide' });
  try {
    const idle = () => page.waitForTimeout(180);
    const menu = id => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);
    await menu('vertices'); await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click(); await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.getByLabel('3D model viewport', { exact: true }).focus(); await menu('selectAll'); await idle();
    await menu('uv'); const uv = page.locator('.uv-tab-window'); await uv.waitFor();
    await uv.getByRole('button', { name: 'Rotate', exact: true }).click(); await idle();
    await page.evaluate(() => { window.uvRotate = () => { const el = document.querySelector('.uv-editor'); return { state: findFiberState(el, v => v?.uv && v?.draw, { last: true }), props: findFiberState(el, v => v?.geoset && v?.onSelectVertices, { last: true }) }; }; });
    const canvas = uv.locator('.uv-editor canvas'), box = await canvas.boundingBox();
    const info = async () => { const p = await page.evaluate(() => { const { state, props } = uvRotate(), ids = Array.from(props.selectedVertices), uv = Array.from(state.uv), c = [0, 0]; ids.forEach(i => { c[0] += uv[i * 2] / ids.length; c[1] += uv[i * 2 + 1] / ids.length; }); return { ids, uv, c }; }); return p; };
    // Circles the mouse `turns` times around the selection centre at `radius`
    // pixels, starting at `start` radians, then reports the on-screen turn.
    // `fromCentre` presses on the centre and moves out before circling.
    const circle = async (radius, turns, start = 0, fromCentre = false) => {
      const before = await info();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      const m = await page.evaluate(() => { const d = uvRotate().state.drag; return { pivot: d.pivotScreen, sizeX: d.sizeX, sizeY: d.sizeY }; });
      await page.mouse.up(); await idle();
      const cx = box.x + m.pivot[0], cy = box.y + m.pivot[1], steps = Math.ceil(Math.abs(turns) * 48);
      if (fromCentre) { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + radius * Math.cos(start), cy + radius * Math.sin(start), { steps: 8 }); }
      else { await page.mouse.move(cx + radius * Math.cos(start), cy + radius * Math.sin(start)); await page.mouse.down(); }
      for (let i = 1; i <= steps; i++) { const a = start + turns * 2 * Math.PI * i / steps; await page.mouse.move(cx + radius * Math.cos(a), cy + radius * Math.sin(a)); }
      const swept = await page.evaluate(() => uvRotate().state.drag.turn * 180 / Math.PI);
      const after = (await info()).uv;
      await page.mouse.up(); await idle(); await canvas.focus(); await page.keyboard.press('Control+z'); await idle();
      const turnsSeen = before.ids.map(i => { const bx = (before.uv[i * 2] - before.c[0]) * m.sizeX, by = (before.uv[i * 2 + 1] - before.c[1]) * m.sizeY, ax = (after[i * 2] - before.c[0]) * m.sizeX, ay = (after[i * 2 + 1] - before.c[1]) * m.sizeY; return Math.hypot(bx, by) > 2 ? Math.atan2(bx * ay - by * ax, bx * ax + by * ay) * 180 / Math.PI : null; }).filter(value => value !== null);
      return { swept, onScreen: turnsSeen.reduce((a, b) => a + b, 0) / turnsSeen.length, spread: Math.max(...turnsSeen) - Math.min(...turnsSeen), count: before.ids.length };
    };
    const wrap = degrees => ((degrees % 360) + 540) % 360 - 180;
    for (const [name, radius, turns, start, fromCentre] of [['near', 60, .25, 0], ['far', 300, .25, 2], ['pressed on the centre', 60, .375, .5, true], ['small circle over the piece', 12, .25, 0], ['clockwise full turn and a quarter', 120, 1.25, 1], ['counter-clockwise two full turns', 200, -2, -1]]) {
      // Within 48 px of the centre a turn goes by distance moved, so it cannot snap.
      const result = await circle(radius, turns, start, fromCentre), expected = turns * 360 * Math.min(1, radius / 48);
      check(`${name}: the selection follows the mouse (${expected}°)`, result.count > 0 && Math.abs(result.swept - expected) < 2 && Math.abs(wrap(result.onScreen - expected)) < 2 && result.spread < 1, result);
    }
    // Sliding the mouse straight across the piece must not snap it to one side.
    { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      const pivot = await page.evaluate(() => uvRotate().state.drag.pivotScreen); await page.mouse.up(); await idle();
      const cx = box.x + pivot[0], cy = box.y + pivot[1];
      await page.mouse.move(cx - 20, cy + 1); await page.mouse.down();
      for (let i = 1; i <= 40; i++) await page.mouse.move(cx - 20 + i, cy + 1 - (i % 2));
      const turn = await page.evaluate(() => uvRotate().state.drag.turn * 180 / Math.PI);
      await page.mouse.up(); await idle(); await canvas.focus(); await page.keyboard.press('Control+z'); await idle();
      check('sliding across the piece does not snap it', Math.abs(turn) < 15, { turn }); }
    check('no renderer errors', errors.length === 0, errors);
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors }, null, 2));
    await closeApp(app);
  }
  assert.equal(checks.filter(item => !item.pass).length, 0, 'UV rotate must follow the mouse around the selection');
})().catch(error => { console.error(error); process.exitCode = 1; });
