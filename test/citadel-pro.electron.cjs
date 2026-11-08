// New base coat layout and the controls a professional painter expects, through real input.
const { launchApp, closeApp, settle: waitForSettle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const fixture = process.env.MDLXL_PAINT_FIXTURE || fixturePath('citadel-footman');
const out = path.resolve(process.env.MDLXL_PAINT_OUT || 'out/citadel-audit/pro-' + Date.now());
fs.mkdirSync(out, { recursive: true });
const result = { checks: [], errors: [] };
let app, page;
const settle = (ms = 120) => waitForSettle(page, ms);
const passed = text => { result.checks.push(text); console.log('ok - ' + text); };

async function drag(from, to, { button = 'left', steps = 14, modifiers = [] } = {}) {
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.move(...from); await page.mouse.down({ button }); await page.mouse.move(...to, { steps }); await page.mouse.up({ button });
  for (const key of modifiers) await page.keyboard.up(key);
  await settle();
}
const coat = id => page.evaluate(id => audit().project.targets[0].coats.find(c => c.id === id).raster.data.slice(), id);
async function changedBy(action, id = 'base') {
  await page.evaluate(id => { window.before = audit().project.targets[0].coats.find(c => c.id === id).raster.data.slice(); }, id);
  await action();
  return page.evaluate(id => { const now = audit().project.targets[0].coats.find(c => c.id === id).raster.data; let n = 0; for (let i = 0; i < now.length; i += 4) if (now[i] !== before[i] || now[i + 1] !== before[i + 1] || now[i + 2] !== before[i + 2]) n++; return n; }, id);
}
const undo = async () => { await page.keyboard.press('Control+z'); await settle(); };
const camera = () => page.evaluate(() => { const r = audit().runtime; return { position: r.camera.position.toArray(), target: r.controls.target.toArray(), lens: r.camera.fov / r.camera.zoom }; });
const distance = c => Math.hypot(...c.position.map((v, i) => v - c.target[i]));
const moved = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

async function penStroke(cdp, from, to, pressure) {
  const send = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: 1, pointerType: 'pen', force: pressure, clickCount: 1, ...extra });
  await send('mouseMoved', from[0], from[1], { button: 'none', buttons: 0, force: 0 });
  await send('mousePressed', from[0], from[1]);
  for (let i = 1; i <= 16; i++) await send('mouseMoved', from[0] + (to[0] - from[0]) * i / 16, from[1] + (to[1] - from[1]) * i / 16);
  await send('mouseReleased', to[0], to[1], { buttons: 0, force: 0 });
  await settle();
}

async function run() {
  ({ app, page, errors: result.errors } = await launchApp({ fixture, out, bounds: { x: -3000, y: 0, width: 1500, height: 1000 }, pageTimeout: 20000 }));
  await page.locator('[data-hotkey="paint"]').click(); await settle(500);
  await page.getByRole('button', { name: /New base coat/ }).click(); await settle();
  assert.equal(await page.getByLabel('Share pixels between matching parts').isChecked(), false, 'sharing starts off');
  await page.getByRole('button', { name: 'Begin painting', exact: true }).click(); await page.locator('.paint-texture-view').waitFor(); await settle(800);
  await page.evaluate(() => {
    window.audit = () => { const props = findFiberState('.paint-workspace', p => p?.onWorkingModelChange && p?.originalModel, { tree: true, props: true }), viewport = findFiberState('.paint-workspace', p => p?.onPaintStart && p?.paintMode, { tree: true, props: true }), runtime = findFiberState('.paint-workspace', s => s?.renderer && s?.camera, { tree: true }), layout = findFiberState('.paint-workspace', p => p?.onBrush && p?.onShape, { tree: true, props: true }); return { props, project: props.project, runtime, viewport, layout }; };
    window.pointFor = world => { const r = audit().runtime, p = r.camera.position.clone().set(...world).project(r.camera), b = r.renderer.domElement.getBoundingClientRect(); return [b.x + (p.x + 1) * b.width / 2, b.y + (1 - p.y) * b.height / 2]; };
  });
  assert.equal(await page.evaluate(() => audit().project.paintAtlasVersion), 2);
  passed('New base coat uses the artist layout');

  const stats = await page.evaluate(() => { const g = audit().props.model.Geosets[0], uv = g.TVertices.at(-1); let outside = 0; for (const v of uv) if (v < 0 || v > 1) outside++; return { outside, count: uv.length }; });
  assert.equal(stats.outside, 0); passed('every UV stays inside the image');

  // Face-on so left and right are both in view.
  await page.evaluate(() => { const r = audit().runtime; r.camera.position.set(170, 0, 55); r.controls.target.set(0, 0, 55); r.controls.update(); r.controls.dispatchEvent?.({ type: 'change' }); });
  await settle(400);
  await page.getByRole('button', { name: 'Round brush' }).click(); await page.getByLabel('Brush size value').fill('14'); await settle();
  await page.getByLabel('Paint color', { exact: true }).fill('#aa2211'); await settle();
  const a = await page.evaluate(() => pointFor([14, -7, 72])), b = await page.evaluate(() => pointFor([14, -3, 64]));
  const plain = await changedBy(() => drag(a, b)); assert.ok(plain > 20, `mouse stroke painted ${plain}`); passed(`a real mouse stroke paints (${plain} texels)`);
  await undo();

  await page.keyboard.press('v'); await settle();
  assert.equal(await page.getByRole('button', { name: 'Symmetry' }).getAttribute('aria-pressed'), 'true');
  const both = await changedBy(() => drag(a, b)); assert.ok(both > plain * 1.6, `symmetry ${both} vs ${plain}`); passed(`Symmetry paints the opposite side too (${both} texels)`);
  await undo(); await page.keyboard.press('v'); await settle();
  // A side view: the opposite side faces away and still receives paint.
  await page.evaluate(() => { const r = audit().runtime; r.camera.position.set(25, 170, 60); r.controls.target.set(0, 0, 60); r.controls.update(); r.controls.dispatchEvent?.({ type: 'change' }); });
  await settle(400);
  const sideA = await page.evaluate(() => pointFor([0, 27, 76])), sideB = await page.evaluate(() => pointFor([8, 27, 74]));
  const oneSide = await changedBy(() => drag(sideA, sideB)); await undo();
  await page.keyboard.press('v'); await settle();
  const away = await changedBy(() => drag(sideA, sideB)); assert.ok(away > oneSide * 1.5, `away ${away} vs ${oneSide}`); passed('Symmetry reaches a side facing away from the camera');
  await undo(); await page.keyboard.press('v'); await settle();
  await page.evaluate(() => { const r = audit().runtime; r.camera.position.set(170, 0, 55); r.controls.target.set(0, 0, 55); r.controls.update(); r.controls.dispatchEvent?.({ type: 'change' }); });
  await settle(400);

  const cdp = await page.context().newCDPSession(page);
  assert.equal(await page.getByRole('group', { name: 'Pen pressure' }).count(), 0, 'pen buttons stay hidden for mouse users');
  const light = await changedBy(() => penStroke(cdp, a, b, .12)); await undo();
  const heavy = await changedBy(() => penStroke(cdp, a, b, 1)); await undo();
  assert.ok(heavy > light * 1.5, `pen heavy ${heavy} vs light ${light}`); passed(`pen pressure thins the stroke (${light} light, ${heavy} heavy)`);
  assert.equal(await page.getByRole('group', { name: 'Pen pressure' }).count(), 1); passed('pen controls appear only after a pen is used');

  const brushValue = name => page.evaluate(name => audit().layout.brush[name], name);
  const size0 = await brushValue('size'), mid = await page.evaluate(() => { const b = audit().runtime.renderer.domElement.getBoundingClientRect(); return [b.x + b.width * .8, b.y + b.height * .5]; });
  await drag(mid, [mid[0] + 120, mid[1]], { button: 'right', modifiers: ['Control'] });
  assert.ok(await brushValue('size') > size0 * 1.5, 'Ctrl + right drag grows the brush'); passed('Ctrl + right drag resizes the brush');
  await page.getByLabel('Brush size value').fill('14'); await settle();
  const hard0 = await brushValue('hardness');
  await drag(mid, [mid[0], mid[1] - 100], { button: 'right', modifiers: ['Control'] });
  assert.notEqual(await brushValue('hardness'), hard0); passed('Ctrl + right drag up and down sets softness');
  await page.getByLabel('Brush size value').fill('14'); await settle();

  let c0 = await camera();
  await drag(mid, [mid[0] + 90, mid[1] + 20], { modifiers: ['Alt'] }); let c1 = await camera();
  assert.ok(moved(c0.position, c1.position) > 1, 'Alt + left rotates'); passed('Alt + left drag rotates');
  c0 = c1; await drag(mid, [mid[0] + 80, mid[1]], { button: 'middle', modifiers: ['Alt'] }); c1 = await camera();
  assert.ok(moved(c0.target, c1.target) > .5, 'Alt + middle pans'); passed('Alt + middle drag pans');
  c0 = c1; await drag(mid, [mid[0], mid[1] - 110], { button: 'right', modifiers: ['Alt'] }); c1 = await camera();
  assert.ok(Math.abs(distance(c0) - distance(c1)) > 1 || Math.abs(c0.lens - c1.lens) > .5, 'Alt + right zooms'); passed('Alt + right drag zooms');
  c0 = c1; await drag(mid, [mid[0] + 60, mid[1]], { button: 'right' }); c1 = await camera();
  assert.ok(moved(c0.target, c1.target) > .5 || moved(c0.position, c1.position) > .5, 'plain right drag keeps its setting'); passed('plain right drag still does what the settings say');

  // Smoothing still finishes at the pointer.
  await page.evaluate(() => { const r = audit().runtime; r.camera.position.set(170, 0, 55); r.controls.target.set(0, 0, 55); r.controls.update(); r.controls.dispatchEvent?.({ type: 'change' }); });
  await settle(400);
  await page.getByRole('button', { name: 'Soft brush' }).click(); await page.getByRole('button', { name: 'Round brush' }).click(); await page.getByLabel('Brush size value').fill('14'); await settle();
  const a2 = await page.evaluate(() => pointFor([14, -7, 72])), b2 = await page.evaluate(() => pointFor([14, -3, 64]));
  const straight = await changedBy(() => drag(a2, b2)); await undo();
  await page.getByLabel('Smoothing value').fill('90'); await settle();
  const smooth = await changedBy(() => drag(a2, b2)); assert.ok(smooth > straight * .85, `smoothing ${smooth} vs ${straight}`); passed('Smoothing keeps the stroke reaching the pointer');
  await undo(); await page.getByLabel('Smoothing value').fill('0'); await settle();

  // Layer opacity changes what is shown, not the painted pixels.
  await drag(a2, b2);
  const composite = () => page.evaluate(() => { const c = audit().project.targets[0]; let n = 0; const d = c.coats.find(x => x.id === 'base').raster.data; return { opacity: c.coats.find(x => x.id === 'base').opacity, sum: d.reduce((s, v) => s + v, 0) }; });
  const before = await composite();
  await page.getByLabel('Layer opacity value').fill('40'); await settle();
  const after = await composite(); assert.equal(after.opacity, .4); assert.equal(after.sum, before.sum); passed('Layer opacity changes the layer without touching its pixels');
  await page.getByLabel('Layer opacity value').fill('100'); await settle();

  // Detail: real clicks, paint keeps its place, Undo restores the layout.
  assert.ok(Object.keys(await page.evaluate(() => audit().project.pieceDetail)).length > 0, 'the head starts with extra detail'); passed('the head starts with extra detail');
  const selectTool = page.getByRole('button', { name: 'Select', exact: true }); await selectTool.click(); await settle(); await page.mouse.click(...a2); await settle(300); await selectTool.click(); await settle(300);
  const layoutKey = () => page.evaluate(() => Array.from(audit().viewport.model.Geosets[0].TVertices[0].slice(0, 40)).join());
  const paintedOn = () => page.evaluate(() => audit().project.targets[0].coats.find(c => c.id === 'base').raster.data.reduce((n, v, i) => n + (i % 4 === 0 && v > 150 ? 1 : 0), 0));
  const oldLayout = await layoutKey(), oldPaint = await paintedOn();
  await page.getByRole('group', { name: 'Detail' }).getByRole('button', { name: 'More' }).click();
  await page.waitForFunction(() => audit().layout.detailLevel === 1.6, null, { timeout: 15000 }); await settle(400);
  assert.notEqual(await layoutKey(), oldLayout); const newPaint = await paintedOn(); assert.ok(newPaint > oldPaint, 'the selected part grows, so its paint covers more pixels: ' + oldPaint + ' to ' + newPaint); passed('Detail gives the selection more pixels and its paint comes along');
  await page.keyboard.press('Control+z'); await settle(600);
  assert.equal(await layoutKey(), oldLayout); assert.equal(await paintedOn(), oldPaint); passed('Undo restores the old layout and paint exactly');
  await page.keyboard.press('Control+d'); await settle();
  assert.deepEqual(result.errors, []);
  console.log(JSON.stringify({ out, checks: result.checks.length }, null, 2));
}
run().catch(async error => { result.failure = error.stack; console.error(error); process.exitCode = 1; if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); }).finally(async () => { if (app) await closeApp(app); fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2)); });
