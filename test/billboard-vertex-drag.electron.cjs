// Exercise the rebuilt production bundle: node test/billboard-vertex-drag.electron.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

const close = (actual, expected, label, epsilon = 1.5) => assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: ${actual} != ${expected}`);

(async () => {
  const out = path.resolve('out/billboard-vertex-drag'); fs.mkdirSync(out, { recursive: true });
  const suppliedFixture = process.env.MDLXL_BILLBOARD_MODEL, geosetIndex = suppliedFixture ? 12 : 0, vertexCount = suppliedFixture ? 36 : 4;
  let fixture = suppliedFixture;
  if (!fixture) {
    const { createStarterDocument } = await import('../src/starter-model.js');
    const doc = createStarterDocument();
    doc.apply('Billboard drag fixture', ['Geosets', 'Bones', 'PivotPoints'], model => {
      const geoset = model.Geosets[0];
      geoset.Vertices = new Float32Array([10,-24,-24, 10,-24,24, 10,24,24, 10,24,-24]);
      geoset.Normals = new Float32Array([1,0,0, 1,0,0, 1,0,0, 1,0,0]);
      geoset.TVertices = [new Float32Array([0,0, 0,1, 1,1, 1,0])];
      geoset.Faces = new Uint16Array([0,1,2, 0,2,3]);
      geoset.VertexGroup = new Uint8Array(4); geoset.Groups = [[0]]; geoset.TotalGroupsCount = 1;
      geoset.MinimumExtent = new Float32Array([10,-24,-24]); geoset.MaximumExtent = new Float32Array([10,24,24]); geoset.BoundsRadius = 35;
      model.Bones[0].Flags = 264; model.Bones[0].PivotPoint = new Float32Array([0,0,0]); model.PivotPoints[0] = new Float32Array([0,0,0]);
    });
    fixture = path.join(out, 'billboard-drag.mdx'); fs.writeFileSync(fixture, Buffer.from(doc.serialize('mdx')));
  }
  const original = fs.readFileSync(fixture), errors = [];
  const app = await _electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000,
  });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.locator('[data-warmkey="geosetsClear"]').click(); await page.getByLabel(`Select geoset ${geosetIndex}`, { exact: true }).check();
    await page.waitForFunction(count => document.querySelector('.classic-counts')?.textContent.includes(`Vertices: ${count}`), vertexCount);
    await page.evaluate(index => {
      window.dragGeosetIndex = index;
      window.viewportState = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current; if (value?.renderer && value?.entries) return value;
        }
        throw Error('Viewport runtime not found');
      };
      const state = viewportState(), render = state.renderer.render;
      window.drawnBillboards = {};
      state.renderer.render = function(scene, camera) {
        drawnBillboards[camera.uuid] = Array.from(state.entries[dragGeosetIndex].geometry.attributes.position.array);
        return render.call(this, scene, camera);
      };
      window.vertexCentroid = vertices => {
        const state = viewportState(), source = vertices || Array.from(state.entries[dragGeosetIndex].geometry.attributes.position.array), point = state.controls.target.clone().set(0,0,0);
        for (let index = 0; index < source.length; index += 3) point.add({ x: source[index], y: source[index + 1], z: source[index + 2] });
        point.multiplyScalar(3 / source.length).project(state.camera);
        const rect = state.controls.domElement.getBoundingClientRect();
        return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
      };
      window.authoredVertices = () => Array.from(viewportState().entries[dragGeosetIndex].geoset.Vertices);
    }, geosetIndex);
    const idle = () => page.waitForTimeout(180);
    const moveBy = async (start, dx, beforeVisual) => {
      await page.mouse.move(start.x, start.y); await page.mouse.down(); await idle();
      const pressed = await page.evaluate(() => vertexCentroid());
      close(pressed.x, beforeVisual.x, 'pointer-down x'); close(pressed.y, beforeVisual.y, 'pointer-down y');
      await page.mouse.move(start.x + dx, start.y, { steps: 4 }); await idle();
      const live = await page.evaluate(() => vertexCentroid()); close(live.x, beforeVisual.x + dx, 'live horizontal drag'); close(live.y, beforeVisual.y, 'live vertical position');
      await page.mouse.up(); await idle(); return live;
    };

    await page.getByLabel('View direction', { exact: true }).selectOption('right');
    await page.getByLabel('Workplane', { exact: true }).check(); await page.getByLabel('ZX workplane', { exact: true }).check();
    const viewport = page.getByLabel('3D model viewport', { exact: true }); await viewport.focus(); await page.keyboard.press('a'); await idle();
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10); await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 10, { steps: 5 }); await page.mouse.up(); await idle();
    await page.waitForFunction(count => viewportState().entries[dragGeosetIndex].selectedPoints.geometry.index?.count === count, vertexCount);
    await page.keyboard.press('m'); await idle();
    await page.getByRole('button', { name: 'Fit selection', exact: true }).click(); await idle();
    const normalBefore = await page.evaluate(() => ({ point: vertexCentroid(), authored: authoredVertices() }));
    const normalLive = await moveBy(normalBefore.point, 42, normalBefore.point);
    const normalAfter = await page.evaluate(() => ({ point: vertexCentroid(), authored: authoredVertices() }));
    close(normalAfter.point.x, normalLive.x, 'normal view release x'); close(normalAfter.point.y, normalLive.y, 'normal view release y');
    assert.notDeepEqual(normalAfter.authored, normalBefore.authored, 'normal view drag commits authored coordinates');
    await page.keyboard.press('Control+z'); await idle(); assert.deepEqual(await page.evaluate(() => authoredVertices()), normalBefore.authored);

    await page.getByRole('button', { name: 'Quad View', exact: true }).click(); await page.locator('[data-viewport="side"]').focus(); await idle();
    await page.getByLabel('View direction', { exact: true }).selectOption('right'); await page.getByRole('button', { name: 'Fit selection', exact: true }).click(); await idle();
    const quadBefore = await page.evaluate(() => {
      const state = viewportState(), vertices = drawnBillboards[state.camera.uuid]; return { point: vertexCentroid(vertices), authored: authoredVertices() };
    });
    const quadLive = await moveBy(quadBefore.point, -37, quadBefore.point);
    await idle();
    const quadAfter = await page.evaluate(() => {
      const state = viewportState(), vertices = drawnBillboards[state.camera.uuid]; return { point: vertexCentroid(vertices), authored: authoredVertices() };
    });
    close(quadAfter.point.x, quadLive.x, 'quad release x'); close(quadAfter.point.y, quadLive.y, 'quad release y');
    assert.notDeepEqual(quadAfter.authored, quadBefore.authored, 'quad drag commits authored coordinates');
    await page.keyboard.press('Control+z'); await idle(); assert.deepEqual(await page.evaluate(() => authoredVertices()), quadBefore.authored);
    await page.screenshot({ path: path.join(out, suppliedFixture ? 'supplied-billboard-drag-stable.png' : 'billboard-drag-stable.png') });
    assert.deepEqual(errors, []); assert.deepEqual(fs.readFileSync(fixture), original, 'fixture bytes stay unchanged');
    console.log('PASS billboard vertex drag stays under the pointer in normal and quad views');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
