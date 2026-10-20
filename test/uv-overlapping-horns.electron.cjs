// Run against the rebuilt bundle: node test/uv-overlapping-horns.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const fixture = path.resolve('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const original = fs.readFileSync(fixture);
  const output = path.resolve('out/uv-overlapping-horns'); fs.mkdirSync(output, { recursive: true });
  const app = await _electron.launch({
    executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', process.cwd(), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, `profile-${Date.now()}`) }, timeout: 60000,
  });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setPosition(-3000, 0); win.showInactive(); });
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    // Since 3e35aca8 the UV entry is the vertex-editor selection (the "Select New" picker is gone):
    // box-select only the first horn (vertices 0-4) in the main viewport, then open UV.
    await page.evaluate(() => {
      window.mainViewport = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current; if (value?.renderer && value?.entries) return value;
        }
        throw Error('Viewport runtime not found');
      };
      window.mainPoints = () => {
        const state = mainViewport(), source = state.entries[0].geometry.attributes.position.array, rect = state.controls.domElement.getBoundingClientRect();
        return Array.from({ length: source.length / 3 }, (_, id) => {
          const point = state.controls.target.clone().set(source[id * 3], source[id * 3 + 1], source[id * 3 + 2]).project(state.camera);
          return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
        });
      };
    });
    const viewport = page.locator('[aria-label="3D model viewport"]'); await viewport.focus(); await page.keyboard.press('a');
    const mainPoints = await page.evaluate(() => mainPoints()), hornBox = mainPoints.slice(0, 5);
    const boxLeft = Math.min(...hornBox.map(point => point.x)) - 6, boxTop = Math.min(...hornBox.map(point => point.y)) - 6;
    const boxRight = Math.max(...hornBox.map(point => point.x)) + 6, boxBottom = Math.max(...hornBox.map(point => point.y)) + 6;
    assert.ok(mainPoints.slice(5).every(point => point.x < boxLeft || point.x > boxRight || point.y < boxTop || point.y > boxBottom), 'the other horn lies outside the first-horn box');
    await page.mouse.move(boxLeft, boxTop); await page.mouse.down(); await page.mouse.move(boxRight, boxBottom, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => /^Selected: 5$/m.test(document.querySelector('.classic-counts')?.innerText || ''));
    const uv = page, uvw = page.locator('.uv-tab-window'); // in-app dialog since f7316110
    await page.locator('[data-hotkey="uv"]').click();
    await uvw.locator('[data-clean-model-canvas]').waitFor({ timeout: 60000 });
    await uv.evaluate(() => {
      window.hornState = () => {
        const root = document.querySelector('.uv-workspace');
        let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.eligibleSelection) return fiber.memoizedProps;
        throw Error('UV workspace props unavailable');
      };
      window.hornRuntime = () => {
        const root = document.querySelector('.uv-tab-window .game-preview-root');
        let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState?.current;
          if (state?.native && state?.controls) return state;
        }
        throw Error('Preview camera unavailable');
      };
      window.hornLocations = () => {
        const rect = document.querySelector('.uv-tab-window [data-clean-model-canvas]').getBoundingClientRect();
        const geo = hornState().model.Geosets[0], camera = hornRuntime().controls.object, Vector3 = camera.position.constructor;
        const points = Array.from({ length: geo.Vertices.length / 3 }, (_, id) => {
          const point = new Vector3().fromArray(geo.Vertices, id * 3).project(camera);
          return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2, z: point.z };
        });
        const faces = Array.from({ length: geo.Faces.length / 3 }, (_, face) => {
          const ids = Array.from(geo.Faces.slice(face * 3, face * 3 + 3)), ps = ids.map(id => points[id]);
          return { face, ids, x: ps.reduce((sum, p) => sum + p.x, 0) / 3, y: ps.reduce((sum, p) => sum + p.y, 0) / 3,
            area: Math.abs((ps[1].x - ps[0].x) * (ps[2].y - ps[0].y) - (ps[1].y - ps[0].y) * (ps[2].x - ps[0].x)) / 2 };
        });
        return { rect: rect.toJSON(), faces, points };
      };
    });
    const initial = await uv.evaluate(() => hornLocations());
    await uv.mouse.move(initial.rect.x + initial.rect.width / 2, initial.rect.y + initial.rect.height / 2);
    await uv.mouse.wheel(0, -1200);
    await uv.waitForFunction(() => hornState().eligibleSelection[0]?.length > 0 && hornState().eligibleSelection[0].length < 10);
    const entry = await uv.evaluate(() => hornState().eligibleSelection[0]);
    assert.ok(entry.every(id => id < 5), 'the UV work area initially contains only the first horn');
    const otherHorn = (await uv.evaluate(() => hornLocations())).faces.filter(face => face.face >= 4).sort((a, b) => b.area - a.area);
    let selected = null;
    for (const candidate of otherHorn) {
      const face = (await uv.evaluate(() => hornLocations())).faces[candidate.face];
      await uv.mouse.move(face.x, face.y);
      await uv.keyboard.down('a'); await uv.mouse.click(face.x, face.y); await uv.keyboard.up('a');
      const ids = await uv.evaluate(() => hornState().selectionByGeoset[0] || []);
      if (ids.length === 3 && ids.every(id => id >= 5)) { selected = ids; break; }
    }
    assert.ok(selected, 'Live Select picks one triangle of the other horn outside the original UV entry');
    const before = await uv.evaluate(() => Array.from(hornState().model.Geosets[0].TVertices[0]));
    const firstHornUV = Array.from({ length: 5 }, (_, id) => before.slice(id * 2, id * 2 + 2).join(','));
    assert.ok(selected.every(id => firstHornUV.includes(before.slice(id * 2, id * 2 + 2).join(','))), 'the picked triangle begins directly stacked on the first horn');
    const map = uvw.locator('.uv-map-pane canvas').first(), box = await map.boundingBox();
    await uvw.getByRole('button', { name: 'Move', exact: true }).click();
    await uv.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await uv.mouse.down(); await uv.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 5 }); await uv.mouse.up();
    await uv.waitForFunction(originalUV => hornState().model.Geosets[0].TVertices[0].some((value, index) => value !== originalUV[index]), before);
    const after = await uv.evaluate(() => Array.from(hornState().model.Geosets[0].TVertices[0]));
    assert.ok(selected.some(id => after[id * 2] !== before[id * 2] || after[id * 2 + 1] !== before[id * 2 + 1]), 'selected horn coordinates moved');
    for (let id = 0; id < 5; id++) assert.deepEqual(after.slice(id * 2, id * 2 + 2), before.slice(id * 2, id * 2 + 2), `the stacked coordinate of first horn vertex ${id} did not move`);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS Electron UV: Live Select picks one Knight horn triangle beyond initial selection and moves only its stacked UV coordinates');
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
