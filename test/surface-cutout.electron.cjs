// Production-bundle mouse checks. Run through scripts/hidden-run.ps1 on Windows.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.resolve(process.env.MDLXL_TEST_OUTPUT || path.join(root, 'out/surface-cutout'));
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(out, 'profile-')), checks = [], errors = [];
  const privateDirectory = process.env.MDLXL_CUTOUT_FIXTURE_DIR;
  let fixture, contour, targets, centers;
  const { openDocument, createDemoDocument, recalculateExtents } = await import('../src/editor-document.js');
  if (privateDirectory) {
    fixture = path.join(privateDirectory, 'before_upper_cutout.mdx');
    const spec = JSON.parse(fs.readFileSync(path.join(privateDirectory, 'request-example.json'), 'utf8'));
    contour = spec.contour.uv_points; targets = spec.explicit_targets.map(t => t.original_triangle_ordinal); centers = spec.explicit_targets.map(t => t.expected_patch_centroid);
  } else {
    const doc = createDemoDocument();
    doc.apply('Mouse cutout fixture', ['Geosets', 'Info'], model => {
      const g = model.Geosets[0];
      Object.assign(g, { Vertices: Float32Array.of(0, 0, 0, 100, 0, 0, 0, 100, 0), Normals: Float32Array.of(0, 0, 1, 0, 0, 1, 0, 0, 1), Faces: Uint16Array.of(0, 1, 2), VertexGroup: Uint8Array.of(0, 0, 0), TVertices: [Float32Array.of(0, 0, 1, 0, 0, 1)], PrimitiveTypes: Uint32Array.of(4), PrimitiveCounts: Uint32Array.of(3) });
      model.Geosets = [g]; model.GeosetAnims = model.GeosetAnims.filter(a => a.GeosetId === 0); model.Info.NumGeosets = 1; model.Info.NumGeosetAnims = model.GeosetAnims.length;
      recalculateExtents(model);
    });
    fixture = path.join(out, 'synthetic.mdx'); fs.writeFileSync(fixture, doc.serialize('mdx'));
    contour = Array.from({ length: 8 }, (_, i) => [.3 + .08 * Math.cos(i * Math.PI / 4), .3 + .08 * Math.sin(i * Math.PI / 4)]);
    targets = [0]; centers = [[30, 30, 0]];
  }
  const original = fs.readFileSync(fixture), originalHash = crypto.createHash('sha256').update(original).digest('hex');
  const before = openDocument(original, 'before.mdx').model, countBefore = before.Geosets.length, sourceIndex = privateDirectory ? 11 : 0;
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ gameData: process.env.MDLXL_TEST_GAME_DATA, preferences: { graphics: { pauseWhenHidden: false } } }));
  const app = await _electron.launch({
    executablePath: process.env.MDLXL_UI_EXECUTABLE || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...(process.env.MDLXL_UI_EXECUTABLE ? [] : [root]), fixture],
    cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000,
  });
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    const visibility = await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(1440, 1000); win.webContents.setBackgroundThrottling(false); return { visible: win.isVisible(), focused: win.isFocused() }; });
    assert.deepEqual(visibility, { visible: false, focused: false }); checks.push('Hidden and unfocused Electron window');
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    if (privateDirectory) await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('3D model viewport', { exact: true }).focus(); await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click(); await page.getByLabel('UV coordinate editor', { exact: true }).waitFor();
    if (privateDirectory) await page.getByLabel('UV material', { exact: true }).selectOption(String(before.Geosets[sourceIndex].MaterialID));
    await page.evaluate(() => {
      window.cutFiber = (selector, key) => {
        const element = document.querySelector(selector);
        let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))], top = fiber;
        while (top.return) top = top.return;
        const pending = [top.stateNode.current];
        while (pending.length) { const item = pending.pop(); if (item.stateNode === element) { fiber = item; break; } if (item.child) pending.push(item.child); if (item.sibling) pending.push(item.sibling); }
        for (; fiber; fiber = fiber.return) if (Object.hasOwn(fiber.memoizedProps || {}, key)) return fiber;
        throw Error('Missing current props: ' + selector + ' / ' + key);
      };
      window.cutProps = (selector, key) => cutFiber(selector, key).memoizedProps;
      window.cutDoc = () => cutProps('.uv-workspace', 'doc').doc;
      window.cutProjection = () => {
        for (let hook = cutFiber('.uv-workspace', 'onCutoutApply').memoizedState; hook; hook = hook.next) if (hook.memoizedState?.current?.viewMatrix) return hook.memoizedState.current;
        return null;
      };
      window.cutAtView = preset => {
        const matrix = cutProjection()?.viewMatrix;
        return !!matrix && Math.abs(matrix[preset === 'front' ? 2 : 10] - 1) < 1e-4;
      };
      window.cutMap = () => {
        const fiber = cutFiber('.uv-editor', 'geoset'), p = fiber.memoizedProps;
        let s;
        for (let hook = fiber.memoizedState; hook; hook = hook.next) if (hook.memoizedState?.current?.uv && hook.memoizedState?.current?.zoom != null) { s = hook.memoizedState.current; break; }
        const canvas = document.querySelector('.uv-editor canvas'), rect = canvas.getBoundingClientRect(), width = rect.width, height = rect.height;
        const sourceWidth = s.image?.naturalWidth || p.textureSize?.[0] || 1, sourceHeight = s.image?.naturalHeight || p.textureSize?.[1] || 1;
        const aspect = Math.max(.01, sourceWidth / sourceHeight), base = Math.max(20, Math.min((width - 40) / 2.7, (height - 40) / 2.3)), sizeX = base * (aspect >= 1 ? aspect : 1) * s.zoom, sizeY = base * (aspect >= 1 ? 1 : 1 / aspect) * s.zoom;
        return { x: rect.x + (width - sizeX) / 2 + s.panX, y: rect.y + (height - sizeY) / 2 + s.panY, sizeX, sizeY, rect: { x: rect.x, y: rect.y, width, height } };
      };
      window.cutProjectPoint = point => {
        const projection = cutProjection(); if (!projection) throw Error('Projection not ready');
        const multiply = (matrix, vector) => [0, 1, 2, 3].map(row => vector.reduce((sum, v, column) => sum + matrix[column * 4 + row] * v, 0));
        const p = multiply(projection.projectionMatrix, multiply(projection.viewMatrix, [...point, 1]));
        const rect = document.querySelector('.uv-preview-canvas canvas').getBoundingClientRect();
        return { x: rect.x + (p[0] / p[3] + 1) * rect.width / 2, y: rect.y + (1 - p[1] / p[3]) * rect.height / 2 };
      };
    });
    assert.equal(await page.getByRole('dialog', { name: 'Low-poly cutout', exact: true }).count(), 0);
    const modelBefore = await page.evaluate(() => JSON.stringify(cutDoc().model)), revisionBefore = await page.evaluate(() => cutDoc().revision);
    const sideWidth = await page.locator('.uv-side-panel').evaluate(e => e.getBoundingClientRect().width);
    async function capture(name) {
      const data = await app.evaluate(async ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        const image = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
        return image.toPNG().toString('base64');
      });
      fs.writeFileSync(path.join(out, name), Buffer.from(data, 'base64'));
    }
    async function openTool() {
      await page.getByRole('button', { name: 'Low-poly cutout', exact: true }).click();
      await page.getByLabel('Cutout draw mode', { exact: true }).selectOption('polygon');
      await page.getByLabel('Standard projection view', { exact: true }).selectOption(privateDirectory ? 'front' : 'top');
      await page.waitForFunction(preset => cutAtView(preset), privateDirectory ? 'front' : 'top');
      for (let i = 0; i < centers.length; i++) {
        if (i === 1) { await page.getByText('Cutout settings', { exact: true }).click(); await page.getByLabel('Add picked surface', { exact: true }).check(); }
        const point = await page.evaluate(point => cutProjectPoint(point), centers[i]);
        await page.mouse.click(point.x, point.y);
      }
      if (privateDirectory) {
        await page.getByLabel('Approximate existing rig', { exact: true }).check();
        await page.getByText('Cutout settings', { exact: true }).click();
      }
    }
    await openTool();
    const pickedText = await page.getByRole('dialog', { name: 'Low-poly cutout', exact: true }).innerText();
    for (const target of targets) assert.ok(pickedText.includes('face ' + (target + 1)), 'actual picked face identity');
    assert.ok(Math.abs(await page.locator('.uv-side-panel').evaluate(e => e.getBoundingClientRect().width) - sideWidth) < 1);
    checks.push('Default view uncluttered; existing sidebar width retained');
    const center = contour[0].map((_, axis) => contour.reduce((sum, p) => sum + p[axis] / contour.length, 0));
    for (let i = 0; i < 25; i++) {
      const m = await page.evaluate(() => cutMap());
      if (m.sizeX >= (privateDirectory ? 5500 : 900)) break;
      await page.mouse.move(m.x + center[0] * m.sizeX, m.y + center[1] * m.sizeY); await page.mouse.wheel(0, -160); await page.waitForTimeout(30);
    }
    async function draw() {
      const m = await page.evaluate(() => cutMap());
      for (const p of contour) await page.mouse.click(m.x + p[0] * m.sizeX, m.y + p[1] * m.sizeY);
      await page.keyboard.press('Enter'); await page.getByLabel('Cutout triangle counts', { exact: true }).waitFor();
    }
    if (!privateDirectory) {
      await page.getByLabel('Cutout draw mode', { exact: true }).selectOption('ellipse');
      let m = await page.evaluate(() => cutMap());
      await page.mouse.move(m.x + .22 * m.sizeX, m.y + .22 * m.sizeY); await page.mouse.down(); await page.mouse.move(m.x + .38 * m.sizeX, m.y + .38 * m.sizeY, { steps: 12 }); await page.mouse.up();
      await page.getByLabel('Cutout triangle counts', { exact: true }).waitFor();
      await page.getByLabel('UV coordinate editor', { exact: true }).focus(); await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: 'Low-poly cutout', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => JSON.stringify(cutDoc().model)), modelBefore);
      await openTool(); await page.getByLabel('Cutout draw mode', { exact: true }).selectOption('lasso');
      m = await page.evaluate(() => cutMap());
      await page.mouse.move(m.x + contour[0][0] * m.sizeX, m.y + contour[0][1] * m.sizeY); await page.mouse.down();
      for (let edge = 0; edge < contour.length; edge++) {
        const a = contour[edge], b = contour[(edge + 1) % contour.length];
        for (let step = 1; step <= 8; step++) await page.mouse.move(m.x + (a[0] + (b[0] - a[0]) * step / 8) * m.sizeX, m.y + (a[1] + (b[1] - a[1]) * step / 8) * m.sizeY);
      }
      await page.mouse.up(); await page.getByLabel('Cutout triangle counts', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await openTool();
      checks.push('Actual ellipse drag, lasso closure, Escape and Cancel preserve the document');
    }
    await draw();
    assert.equal(await page.evaluate(() => JSON.stringify(cutDoc().model)), modelBefore, 'preview does not edit');
    const output = await page.getByLabel('Cutout triangle counts', { exact: true }).textContent();
    assert.ok(output.includes(privateDirectory ? '12 piece triangles' : '6 piece triangles'));
    checks.push('Real surface mouse pick and polygon mouse gesture create a minimal draft');
    const cameraBefore = await page.evaluate(() => JSON.stringify(cutProjection()));
    const live = await page.locator('.uv-preview-canvas canvas').first().boundingBox();
    await page.mouse.move(live.x + live.width * .8, live.y + live.height * .7); await page.mouse.down(); await page.mouse.move(live.x + live.width * .65, live.y + live.height * .6, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(before => JSON.stringify(cutProjection()) !== before, cameraBefore);
    checks.push('Normal mouse drag rotates the native live camera with a pending cut');
    // Inspect at a useful scale using the normal wheel and right-button pan.
    await page.getByLabel('Standard projection view', { exact: true }).selectOption(privateDirectory ? 'front' : 'top');
    await page.waitForFunction(preset => cutAtView(preset), privateDirectory ? 'front' : 'top');
    const anchor = centers[0], scalePoint = privateDirectory ? centers[1] : [anchor[0] + 5, anchor[1], anchor[2]];
    for (let i = 0; i < 22; i++) {
      const pair = await page.evaluate(points => points.map(cutProjectPoint), [anchor, scalePoint]);
      if (Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) > (privateDirectory ? 150 : 30)) break;
      await page.mouse.move(live.x + live.width / 2, live.y + live.height / 2); await page.mouse.wheel(0, -140); await page.waitForTimeout(40);
    }
    const center3d = anchor.map((v, axis) => (v + scalePoint[axis]) / 2);
    for (let i = 0; i < 5; i++) {
      const projected = await page.evaluate(point => cutProjectPoint(point), center3d);
      const dx = live.x + live.width / 2 - projected.x, dy = live.y + live.height / 2 - projected.y;
      if (Math.hypot(dx, dy) < 15) break;
      const x = live.x + live.width / 2, y = live.y + live.height / 2;
      await page.mouse.move(x, y); await page.mouse.down({ button: 'right' }); await page.mouse.move(x + Math.max(-100, Math.min(100, dx)), y + Math.max(-100, Math.min(100, dy)), { steps: 8 }); await page.mouse.up({ button: 'right' });
    }
    await page.getByLabel('Cutout inspection view', { exact: true }).selectOption('source');
    await page.waitForTimeout(200); await capture('source-hole.png');
    await page.getByLabel('Cutout inspection view', { exact: true }).selectOption('piece');
    await page.getByText('Contrast preview', { exact: true }).click();
    await page.waitForTimeout(200); await capture('piece-only.png');
    const draft = await page.locator('.uv-preview-canvas .game-preview-root').evaluate(() => {
      const p = cutProps('.uv-preview-canvas .game-preview-root', 'model'); return { count: p.model.Geosets.length, hidden: [...p.hiddenGeosets], pieceFaces: p.model.Geosets.at(-1).Faces.length / 3, color: Array.from(p.model.GeosetAnims.find(a => a.GeosetId === p.model.Geosets.length - 1).Color) };
    });
    assert.equal(draft.count, countBefore + 1); assert.equal(draft.pieceFaces, privateDirectory ? 12 : 6); assert.equal(draft.hidden.length, countBefore);
    assert.ok(draft.color[0] > .9 && draft.color[1] < .2);
    assert.equal(await page.evaluate(() => JSON.stringify(cutDoc().model)), modelBefore);
    checks.push('Source-only / piece-only wireframe inspection and temporary RGB override');
    if (privateDirectory) {
      assert.equal(await page.getByRole('button', { name: 'Cut & Separate', exact: true }).isEnabled(), false);
      await page.getByLabel('Accept sampled rig approximation', { exact: true }).check();
    }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => cutDoc().revision), revisionBefore);
    assert.equal(await page.evaluate(() => JSON.stringify(cutDoc().model)), modelBefore);
    checks.push('Cancel leaves geometry, revision and history unchanged');
    await openTool(); await draw();
    if (privateDirectory) await page.getByLabel('Accept sampled rig approximation', { exact: true }).check();
    await page.getByRole('button', { name: 'Cut & Separate', exact: true }).click();
    await page.waitForFunction(n => cutDoc().model.Geosets.length === n + 1, countBefore);
    assert.equal(await page.evaluate(() => cutDoc().revision), revisionBefore + 1);
    assert.equal(await page.evaluate(() => cutProps('.uv-workspace', 'activeGeoset').activeGeoset), countBefore);
    assert.equal(await page.evaluate(index => cutProps('.uv-workspace', 'selectionByGeoset').selectionByGeoset[index].length, countBefore), privateDirectory ? 16 : 8);
    const applied = await page.evaluate(() => JSON.stringify(cutDoc().model));
    const sourceAfter = JSON.parse(applied);
    for (let i = 0; i < countBefore; i++) if (i !== sourceIndex) assert.deepEqual(sourceAfter.Geosets[i], JSON.parse(modelBefore).Geosets[i]);
    checks.push('Apply commits once, selects appended geoset and preserves every unrelated geoset');
    await page.getByLabel('UV coordinate editor', { exact: true }).focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(n => cutDoc().model.Geosets.length === n, countBefore);
    assert.equal(await page.evaluate(() => JSON.stringify(cutDoc().model)), modelBefore);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(n => cutDoc().model.Geosets.length === n + 1, countBefore);
    assert.equal(await page.evaluate(() => JSON.stringify(cutDoc().model)), applied);
    checks.push('Keyboard undo/redo restores the exact document');
    await app.evaluate(({ dialog }, out) => { dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: pathForSave(out, options) }); function pathForSave(root, options) { return root + '/ui-saved.' + options.filters[0].extensions[0]; } }, out);
    await page.keyboard.press('Control+Shift+s');
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.classic-modal'));
    const savedPath = path.join(out, 'ui-saved.mdx');
    for (let n = 0; n < 100 && !fs.existsSync(savedPath); n++) await page.waitForTimeout(100);
    const reopened = openDocument(fs.readFileSync(savedPath), 'ui-saved.mdx');
    assert.equal(reopened.model.Geosets.length, countBefore + 1); assert.equal(reopened.model.Geosets.at(-1).Faces.length / 3, privateDirectory ? 12 : 6);
    const mdl = reopened.serialize('mdl'), second = openDocument(mdl, 'via.mdl'), mdx = second.serialize('mdx');
    assert.equal(openDocument(mdx, 'via.mdx').model.Geosets.at(-1).Faces.length / 3, privateDirectory ? 12 : 6);
    checks.push('Actual Save MDX dialog path, compatible reopen and MDX → MDL → MDX');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'), originalHash);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ passed: true, privateFixture: !!privateDirectory, originalHash, counts: output, checks, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, errors }));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); fs.writeFileSync(path.join(out, 'failure-dom.txt'), await page.locator('body').innerText().catch(() => '')); }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ passed: false, checks, errors, error: error.stack }, null, 2));
    throw error;
  } finally {
    await app.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
