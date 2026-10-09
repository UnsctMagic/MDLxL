// After building and packaging: set MDLXL_TEST_EXE to the portable executable.
// The check uses real mouse events and never shows a window.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'viewport-cache');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { recalculateExtents } = await import('../src/editor-document.js');
  const doc = createStarterDocument(), count = 20000;
  doc.apply('Large selection fixture', ['Geosets', 'GeosetAnims', 'Info'], model => {
    const geo = model.Geosets[0];
    geo.Vertices = Float32Array.from({length: count * 3}, (_, i) => i % 3 === 0 ? Math.floor(i / 3) % 200 - 100 : i % 3 === 1 ? Math.floor(i / 600) - 50 : 20);
    geo.Normals = Float32Array.from({length: count * 3}, (_, i) => i % 3 === 2 ? 1 : 0);
    geo.TVertices = [new Float32Array(count * 2)]; geo.VertexGroup = new Uint8Array(count);
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: 1, Color: new Float32Array([.7, .7, .7]) }];
    recalculateExtents(model);
  });
  const fixture = path.join(out, 'large-selection.mdx'), bytes = Buffer.from(doc.serialize('mdx'));
  await fs.writeFile(fixture, bytes);
  const app = await _electron.launch({
    executablePath: process.env.MDLXL_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', ...(process.env.MDLXL_TEST_EXE ? [] : [root]), fixture],
    env: {...process.env, MDLVIS_HEADLESS:'1', MDLXL_PROFILE:profile}, timeout:60000,
  });
  const errors = [], report = { vertexCount: count };
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.getByLabel('Select geoset 0', {exact:true}).waitFor();
    await page.locator('[aria-label="3D model viewport"] canvas').waitFor();
    await page.evaluate(() => {
      window.viewportAudit = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState?.current;
          if (state?.renderer && state.entries && state.controls) return state;
        }
        throw Error('Viewport runtime missing');
      };
      window.editorAudit = () => {
        const host = document.querySelector('.classic-app');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.doc?.model) return current.doc;
        }
        throw Error('Editor document missing');
      };
    });
    await page.waitForFunction(() => viewportAudit().entries[0]?.geometry.attributes.position.count === 20000);
    const modelBefore = await page.evaluate(() => JSON.stringify(editorAudit().model));
    const menu = id => app.evaluate(({BrowserWindow}, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);
    await menu('selectAll');
    await page.waitForFunction(() => viewportAudit().entries[0].selectedPoints.geometry.index?.count === 20000);
    await page.getByLabel('View direction', {exact:true}).selectOption('perspective');
    await page.getByRole('button', {name:'Quad View', exact:true}).click();
    await page.locator('[data-viewport="perspective"]').focus();
    await page.locator('[data-warmkey="camera:rotate"]').click();
    await page.waitForFunction(() => document.querySelector('[data-warmkey="camera:rotate"]').getAttribute('aria-pressed') === 'true');
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      window.selectionSerializations = 0; window.renderedPanes = new Set();
      const stringify = JSON.stringify;
      JSON.stringify = (value, ...args) => { if (value?.[0]?.length === 20000) selectionSerializations++; return stringify(value, ...args); };
      const renderer = viewportAudit().renderer, render = renderer.render;
      renderer.render = function(...args) { const rect = this.getViewport({copy: v => [v.x,v.y,v.z,v.w]}); renderedPanes.add(rect.join(',')); return render.apply(this, args); };
    });
    const before = await page.evaluate(() => viewportAudit().controls.object.quaternion.toArray());
    const rect = await page.locator('[data-viewport="perspective"]').boundingBox(), x = rect.x + rect.width * .5, y = rect.y + rect.height * .5;
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+65,y+35,{steps:12}); await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ quaternion: viewportAudit().controls.object.quaternion.toArray(), serializations: selectionSerializations, panes: renderedPanes.size, selected: viewportAudit().entries[0].selectedPoints.geometry.index.count }));
    report.editorQuaternionDelta = Math.hypot(...before.map((value, i) => value - after.quaternion[i]));
    report.selectionSerializationsDuringRotation = after.serializations; report.renderedPanes = after.panes;
    assert.ok(report.editorQuaternionDelta > .01, 'normal mouse drag rotates the perspective camera');
    assert.equal(after.serializations, 0, 'camera frames reuse the selection signature');
    assert.equal(after.panes, 4); assert.equal(after.selected, count);
    await menu('hide'); await page.waitForFunction(() => viewportAudit().entries[0].selectedPoints.geometry.index?.count === 0 && viewportAudit().entries[0].points.geometry.index?.count === 0);
    await menu('show'); await menu('selectAll'); await page.waitForFunction(() => viewportAudit().entries[0].selectedPoints.geometry.index?.count === 20000);
    await page.getByLabel('Select geoset 0', {exact:true}).uncheck();
    await page.waitForFunction(() => !viewportAudit().entries[0].selectedPoints.visible);
    await page.getByLabel('Select geoset 0', {exact:true}).check(); await menu('selectAll');
    await page.waitForFunction(() => viewportAudit().entries[0].selectedPoints.geometry.index?.count === 20000 && viewportAudit().entries[0].selectedPoints.visible);
    assert.equal(await page.evaluate(() => JSON.stringify(editorAudit().model)), modelBefore);
    report.selectionHideRestoreAndScope = true;
    await page.getByRole('button', {name:'Quad View', exact:true}).click();
    await page.locator('[data-warmkey="camera:work"]').click();
    await page.locator('[data-warmkey="animation"]').click(); await page.getByRole('button', {name:'Animations', exact:true}).click();
    const rgb = String(Math.round(new Float32Array([.7])[0] * 255));
    await page.waitForFunction(value => document.querySelector('[aria-label="Animation R"]')?.value === value, rgb);
    report.mountedInlineRGB = await page.getByLabel('Animation R', {exact:true}).inputValue();
    await page.locator('[data-warmkey="paint"]').click(); await page.locator('.paint-workspace').waitFor();
    await page.waitForFunction(() => viewportAudit().entries[0]?.geometry.attributes.position.count === 20000);
    await page.getByRole('button', {name:'Camera rotation', exact:true}).click();
    await page.waitForFunction(() => document.querySelector('[data-warmkey="camera:rotate"]').getAttribute('aria-pressed') === 'true');
    await page.waitForTimeout(150);
    await page.evaluate(() => { selectionSerializations = 0; });
    const paintBefore = await page.evaluate(() => viewportAudit().controls.object.quaternion.toArray());
    // The startup card occupies the middle of the preview until painting begins.
    // Drag an exposed part of the real canvas, rather than the card above it.
    const {x:px,y:py} = await page.evaluate(() => {
      const canvas = viewportAudit().renderer.domElement, rect = canvas.getBoundingClientRect();
      for (const [fx,fy] of [[.5,.5],[.15,.15],[.85,.15],[.15,.85],[.85,.85]]) {
        const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
        if (document.elementFromPoint(x,y) === canvas) return {x,y};
      }
      throw Error('Paint canvas has no exposed drag point');
    });
    await page.mouse.move(px,py); await page.mouse.down(); await page.mouse.move(px+65,py+35,{steps:12}); await page.mouse.up();
    await page.waitForTimeout(200);
    const paintAfter = await page.evaluate(() => viewportAudit().controls.object.quaternion.toArray());
    report.paintQuaternionDelta = Math.hypot(...paintBefore.map((value,i) => value - paintAfter[i]));
    assert.ok(report.paintQuaternionDelta > .01, 'normal mouse controls rotate the Paint preview');
    report.paintSelectionSerializationsDuringRotation = await page.evaluate(() => selectionSerializations);
    assert.equal(report.paintSelectionSerializationsDuringRotation, 0);
    assert.equal(await page.evaluate(() => JSON.stringify(editorAudit().model)), modelBefore);
    report.visibleWindows = await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().filter(window => window.isVisible()).length);
    assert.equal(report.visibleWindows, 0); assert.deepEqual(errors, []); assert.deepEqual(await fs.readFile(fixture), bytes);
    report.modelSha256 = crypto.createHash('sha256').update(modelBefore).digest('hex'); report.fixtureUnchanged = true;
    await fs.writeFile(path.join(out,'results.json'), JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
  } finally { await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(window => window.destroy())); await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
