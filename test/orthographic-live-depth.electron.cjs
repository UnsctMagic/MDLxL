const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sameCamera = (actual, expected) => assert.ok(actual.flat(Infinity).every((v, i) => Math.abs(v - expected.flat(Infinity)[i]) < 1e-8), 'camera, zoom and orbit target stay in place');

(async () => {
  const out = path.resolve('out/orthographic-live-depth'); fs.mkdirSync(out, { recursive: true });
  const errors = [], failures = [];
  const { app, page } = await launchApp({ out, fixture: fixturePath('footman'), errors, bounds: { x: 0, y: 0, width: 1920, height: 1054 } });
  try {
    const viewport = page.getByLabel('3D model viewport', { exact: true }); await viewport.waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.evaluate(() => {
      window.depthState = () => findFiberState(document.querySelector('[aria-label="3D model viewport"]'), v => v?.renderer && v?.entries);
      window.depthRead = () => {
        const s = depthState(), e = s.entries[0], c = s.camera, p = s.controls.target.clone(), vertices = e.geometry.attributes.position;
        let clipped = 0, onScreen = 0, minX = 1, maxX = -1, minY = 1, maxY = -1;
        for (let i = 0; i < vertices.count; i++) { p.fromBufferAttribute(vertices, i).project(c); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1) { onScreen++; if (Math.abs(p.z) > 1) clipped++; } }
        const rect = s.controls.domElement.getBoundingClientRect(), h = s.gizmoHandles?.find(h => h.axis === 'XY');
        return { clipped, onScreen, near: c.near, far: c.far, ortho: !!c.isOrthographicCamera,
          camera: [c.position.toArray(), c.quaternion.toArray(), c.zoom, s.controls.target.toArray()],
          live: Array.from(vertices.array), authored: Array.from(e.geoset.Vertices), selected: e.selectedPoints.geometry.index?.count,
          crop: { x: Math.floor(rect.x + (minX + 1) * rect.width / 2 - 5), y: Math.floor(rect.y + (1 - maxY) * rect.height / 2 - 5), width: Math.ceil((maxX - minX) * rect.width / 2 + 10), height: Math.ceil((maxY - minY) * rect.height / 2 + 10) },
          handle: h && { x: rect.x + h.x, y: rect.y + h.y } };
      };
    });
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10); await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 10, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => depthRead().selected === 447);
    await page.keyboard.press('m');
    await page.getByLabel('Workplane Constraints', { exact: true }).uncheck();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 545);
    await page.waitForFunction(() => depthRead().handle && depthState().camera.zoom < .7);
    const capture = async (label, state) => {
      const screenshot = await page.screenshot({ path: path.join(out, `${label}.png`), clip: state.crop });
      const red = await app.evaluate(({ nativeImage }, base64) => {
        const bitmap = nativeImage.createFromBuffer(Buffer.from(base64, 'base64')).toBitmap();
        let count = 0;
        for (let i = 0; i < bitmap.length; i += 4) if (bitmap[i + 2] > 200 && bitmap[i + 1] < 100 && bitmap[i] < 100) count++;
        return count;
      }, screenshot.toString('base64'));
      console.log(label, 'selected red pixels', red);
      if (red < 200) failures.push(`${label}: selected geometry has only ${red} red pixels`);
    };
    for (const [label, dy] of [['near', 320], ['far', -350]]) {
      const before = await page.evaluate(() => depthRead()); assert.ok(before.ortho, 'default camera is orthographic');
      await page.mouse.move(before.handle.x, before.handle.y); await page.mouse.down();
      await page.mouse.move(before.handle.x, before.handle.y + dy, { steps: 20 });
      await page.waitForFunction(original => depthRead().live.some((v, i) => Math.abs(v - original[i]) > 1), before.live);
      const held = await page.evaluate(() => depthRead());
      console.log(label, 'held', JSON.stringify({ clipped: held.clipped, onScreen: held.onScreen, near: held.near, far: held.far }));
      await capture(`${label}-held`, held);
      sameCamera(held.camera, before.camera);
      assert.deepEqual(held.authored, before.authored, 'held drag is preview only');
      if (held.clipped) failures.push(`${label}: held geometry has ${held.clipped} depth-clipped on-screen vertices`);
      assert.ok(held.onScreen > 400, `${label}: geometry remains within the viewport`);
      await page.mouse.up();
      await page.waitForFunction(original => depthRead().authored.some((v, i) => Math.abs(v - original[i]) > 1), before.authored);
      const released = await page.evaluate(() => depthRead());
      await capture(`${label}-released`, released);
      if (released.clipped) failures.push(`${label}: released geometry has ${released.clipped} depth-clipped on-screen vertices`);
      sameCamera(released.camera, before.camera);
      await page.keyboard.press('Control+z');
      await page.waitForFunction(original => depthRead().authored.every((v, i) => v === original[i]), before.authored);
      assert.equal((await page.evaluate(() => depthRead())).clipped, 0, 'undo geometry remains visible');
    }
    const undone = await page.evaluate(() => depthRead().authored);
    await page.keyboard.press('Control+y');
    await page.waitForFunction(original => depthRead().authored.some((v, i) => Math.abs(v - original[i]) > 1), undone);
    const beforeRotate = await page.evaluate(() => depthRead().camera);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForFunction(original => depthRead().camera[1].some((v, i) => Math.abs(v - original[1][i]) > .01), beforeRotate);
    if ((await page.evaluate(() => depthRead())).clipped) failures.push('real mouse rotation clips committed geometry');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(original => depthRead().authored.every((v, i) => v === original[i]), undone);
    assert.equal((await page.evaluate(() => depthRead())).clipped, 0, 'undo after real mouse rotation retains depth coverage');
    assert.deepEqual(errors, [], 'no renderer exceptions');
    assert.deepEqual(failures, [], 'live and committed Footman remain depth-visible in both directions');
    console.log('PASS orthographic Footman live depth, commit, undo and real mouse rotation');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
