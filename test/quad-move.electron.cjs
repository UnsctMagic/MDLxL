const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp, appTarget } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  assert.ok(appTarget().packaged, 'run this regression against a packaged app');
  const errors = [], out = path.resolve('out/quad-move');
  const { app, page } = await launchApp({ fixture: fixturePath('footman'), out, errors });
  try {
    const viewport = page.getByLabel('3D model viewport', { exact: true });
    await viewport.waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await viewport.click(); await page.keyboard.press('Control+a');
    await page.keyboard.press('m');
    await page.getByRole('button', { name: 'Quad View', exact: true }).click();
    await page.evaluate(() => {
      window.quadState = () => findFiberState(document.querySelector('[aria-label="3D model viewport"]'), r => r?.renderer && r?.entries);
      window.quadVertices = () => Array.from(quadState().entries[0].geoset.Vertices);
      window.quadPreview = () => Array.from(quadState().entries[0].geometry.attributes.position.array);
    });
    await page.waitForFunction(() => quadState().entries[0].selectedPoints.geometry.index?.count === 447);
    const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const same = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < 1e-4);
    const paintedSelection = box => app.evaluate(async ({ BrowserWindow }, box) => {
      const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage({ x: Math.round(box.x), y: Math.round(box.y), width: Math.floor(box.width), height: Math.floor(box.height) }, { stayHidden: true, stayAwake: true });
      const bytes = image.toBitmap(), pixels = [];
      for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 2] > 170 && bytes[i + 1] < 190 && bytes[i] < 100) pixels.push(i / 4);
      return pixels;
    }, box);
    async function drag(id, { shift = false, constraints = true, dx = 36, dy = 18, handle = false } = {}) {
      const pane = page.locator(`[data-viewport="${id}"]`), box = await pane.boundingBox();
      const checkbox = pane.getByRole('checkbox');
      if (await checkbox.count()) await checkbox.setChecked(constraints);
      const before = await page.evaluate(() => quadVertices());
      let start = { x: Math.round(box.x + box.width * .18), y: Math.round(box.y + box.height * .25) };
      if (handle) {
        await pane.click({ position: { x: 24, y: 45 } });
        await frames();
        start = await page.evaluate(() => {
          const s = quadState(), h = s.gizmoHandles.find(h => h.axis === 'X' && !h.plane), r = s.controls.domElement.getBoundingClientRect();
          return h && { x: r.x + h.startX + h.dx * .7, y: r.y + h.startY + h.dy * .7 };
        });
        assert.ok(start, 'quad X handle is visible');
      }
      const paintedBefore = new Set(await paintedSelection(box));
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      if (shift) {
        await page.mouse.move(start.x + 8, start.y + 3);
        await frames(); await page.keyboard.down('Shift');
      }
      await page.mouse.move(start.x + dx, start.y + dy, { steps: 6 });
      await frames();
      assert.deepEqual(errors, [], `${id}: ordinary Move must not throw renderer exceptions`);
      await page.waitForFunction(before => quadPreview().some((v, i) => Math.abs(v - before[i]) > .001), before);
      const paintedHeld = await paintedSelection(box);
      assert.ok(paintedHeld.length > 20 && paintedHeld.filter(pixel => !paintedBefore.has(pixel)).length > 20, `${id}: selected geometry visibly moves in the rendered pane while held`);
      assert.deepEqual(await page.evaluate(() => quadVertices()), before, `${id}: held preview does not commit`);
      if (shift) {
        const held = await page.evaluate(() => quadPreview());
        await page.keyboard.up('Shift'); await frames();
        assert.ok(same(await page.evaluate(() => quadPreview()), held), `${id}: releasing Shift keeps the accumulated preview`);
        await page.mouse.move(start.x + dx + 9, start.y + dy + 7, { steps: 3 });
        await frames();
      }
      const preview = await page.evaluate(() => quadPreview());
      await page.mouse.up();
      await page.waitForFunction(before => quadVertices().some((v, i) => Math.abs(v - before[i]) > .001), before);
      assert.ok(same(await page.evaluate(() => quadVertices()), preview), `${id}: release commits the visible geometry`);
      await page.keyboard.press('Control+z');
      await page.waitForFunction(before => quadVertices().every((v, i) => Math.abs(v - before[i]) < .0001), before);
      assert.deepEqual(errors, [], `${id}: release and undo are exception-free`);
    }
    for (const id of ['front', 'top', 'side', 'perspective']) {
      await drag(id);
      await drag(id, { shift: true });
      if (id === 'perspective') await drag(id, { shift: true, constraints: false });
      // A subpixel drag still previews, but must not create a committed edit.
      const pane = page.locator(`[data-viewport="${id}"]`), box = await pane.boundingBox(), before = await page.evaluate(() => quadVertices());
      const x = Math.round(box.x + box.width * .18), y = Math.round(box.y + box.height * .25);
      for (const distance of [.5, 1]) {
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + distance, y);
        await frames(); await page.mouse.up(); await frames();
        assert.deepEqual(await page.evaluate(() => quadVertices()), before, `${id}: ${distance} pixel does not commit`);
      }
      await drag(id, { constraints: id !== 'perspective', dx: 2, dy: 0 });
    }
    await drag('perspective', { constraints: false, handle: true });
    await drag('perspective', { constraints: false, handle: true, shift: true });
    assert.deepEqual(errors, []);
    console.log('PASS quad Move: Footman four-pane live preview, release, undo, Shift, constraints, subpixel threshold and handle');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
