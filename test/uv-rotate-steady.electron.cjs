const { launchApp, closeApp } = require('./helpers/app.cjs');
// UV map Rotate is a flat 2D turn: the same left/right drag turns the same
// amount wherever it starts, near the selection or far from it.
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
  const { app, page } = await launchApp({ out, profile: path.join(out, 'profile'), args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'], env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture, errors, pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1280, height: 900 }, show: 'hide' });
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
    // Measures the on-screen turn of the selection, in degrees, for one drag.
    const turn = async (start, dx, dy) => {
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      const info = await page.evaluate(() => { const { state, props } = uvRotate(), d = state.drag; return { pivot: d.pivotScreen, sizeX: d.sizeX, sizeY: d.sizeY, ids: Array.from(props.selectedVertices), uv: Array.from(state.uv) }; });
      for (let i = 1; i <= 12; i++) await page.mouse.move(start.x + dx * i / 12, start.y + dy * i / 12);
      const after = await page.evaluate(() => Array.from(uvRotate().state.uv));
      await page.mouse.up(); await idle();
      if (dx) { await canvas.focus(); await page.keyboard.press('Control+z'); await idle(); }
      const center = [0, 0]; info.ids.forEach(i => { center[0] += info.uv[i * 2] / info.ids.length; center[1] += info.uv[i * 2 + 1] / info.ids.length; });
      const turns = info.ids.map(i => { const bx = (info.uv[i * 2] - center[0]) * info.sizeX, by = (info.uv[i * 2 + 1] - center[1]) * info.sizeY, ax = (after[i * 2] - center[0]) * info.sizeX, ay = (after[i * 2 + 1] - center[1]) * info.sizeY; return Math.hypot(bx, by) > 2 ? Math.atan2(bx * ay - by * ax, bx * ax + by * ay) * 180 / Math.PI : null; }).filter(value => value !== null);
      const pivot = { x: box.x + info.pivot[0], y: box.y + info.pivot[1] };
      return { degrees: turns.length ? turns.reduce((a, b) => a + b) / turns.length : NaN, spread: turns.length ? Math.max(...turns) - Math.min(...turns) : NaN, pivot, count: info.ids.length };
    };
    const probe = await turn({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, 0, 0);
    check('selection reached the UV map', probe.count > 0, { count: probe.count });
    const p = probe.pivot, results = {};
    for (const [name, offset] of [['near', [15, 0]], ['far', [260, 0]], ['above', [0, -200]], ['below left', [-180, 150]]])
      results[name] = await turn({ x: p.x + offset[0], y: p.y + offset[1] }, 60, 0);
    for (const [name, value] of Object.entries(results)) check(`${name}: 60px right turns 60 degrees as one rigid piece`, Math.abs(Math.abs(value.degrees) - 60) < 1 && value.spread < 1, value);
    const signs = new Set(Object.values(results).map(value => Math.sign(value.degrees)));
    check('same direction wherever the drag starts', signs.size === 1, [...signs]);
    const vertical = await turn({ x: p.x + 100, y: p.y }, 0, 80);
    check('up/down does not turn', Math.abs(vertical.degrees) < .5, vertical);
    const left = await turn({ x: p.x + 100, y: p.y }, -60, 0);
    check('left turns the other way', Math.sign(left.degrees) === -Math.sign(results.far.degrees), left);
    console.log('Right drag turns ' + (results.far.degrees < 0 ? 'counter-clockwise' : 'clockwise') + ' on screen');
    check('no renderer errors', errors.length === 0, errors);
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors }, null, 2));
    await closeApp(app);
  }
  assert.equal(checks.filter(item => !item.pass).length, 0, 'UV rotate must be a steady 2D turn');
})().catch(error => { console.error(error); process.exitCode = 1; });
