// Run after rebuilding dist. MDLXL_UI_EXECUTABLE optionally targets a portable package.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/uv-tab-window');
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const first = path.join(root, 'fixtures/demo.mdx'), second = path.join(root, 'fixtures/demo.mdl');
  const originals = [first, second].map(file => fs.readFileSync(file));
  const app = await _electron.launch({ executablePath: process.env.MDLXL_UI_EXECUTABLE || path.join(root, 'node_modules/electron/dist/electron.exe'), args: [...(process.env.MDLXL_UI_EXECUTABLE ? [] : [root]), first, second], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  let page;
  const errors = [], checks = [];
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setBounds({ x: 20, y: 20, width: 1440, height: 1000 }); win.show(); });
    await page.getByRole('tab', { name: 'demo.mdl', exact: true }).waitFor();
    await page.evaluate(() => {
      window.uvTestProps = selector => {
        const host = document.querySelector(selector); let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.Geosets) return fiber.memoizedProps;
        throw Error('Model props unavailable: ' + selector);
      };
      window.uvTestModel = () => { const p = uvTestProps('.viewport'); return { vertices: p.model.Geosets.map(g => Array.from(g.Vertices)), uv: p.model.Geosets.map(g => g.TVertices.map(v => Array.from(v))) }; };
      window.uvTestRuntime = () => {
        const host = document.querySelector('.uv-preview-canvas .game-preview-root'); let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) { const state = hook.memoizedState?.current; if (state?.native && state?.controls) return state; }
        return null;
      };
      window.uvTestCamera = () => JSON.parse(JSON.stringify(uvTestRuntime()?.cameraView(), (_key, value) => typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value));
      window.uvTestFraming = () => {
        const state = uvTestRuntime(); if (!state) return null;
        const camera = state.controls.object;
        camera.updateMatrixWorld(); camera.updateProjectionMatrix();
        const direction = camera.position.clone().sub(state.controls.target).normalize().toArray();
        const matrix = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements;
        let edge = 0;
        for (const geo of state.native.model.Geosets) for (let i = 0; i < geo.Vertices.length; i += 3) {
          const [x, y, z] = geo.Vertices.slice(i, i + 3);
          const w = matrix[3]*x + matrix[7]*y + matrix[11]*z + matrix[15];
          edge = Math.max(edge, Math.abs((matrix[0]*x + matrix[4]*y + matrix[8]*z + matrix[12])/w), Math.abs((matrix[1]*x + matrix[5]*y + matrix[9]*z + matrix[13])/w));
        }
        return { direction, edge, orthographic: camera.isOrthographicCamera };
      };
    });
    const openUV = async () => {
      await page.locator('.classic-view > .viewport [aria-label="3D model viewport"]').focus();
      await page.keyboard.press('Control+a');
      await page.locator('[data-hotkey="uv"]').click();
      await page.locator('.uv-tab-window .uv-editor canvas').waitFor();
    };
    await page.getByRole('tab', { name: 'demo.mdx', exact: true }).click();
    const before = await page.evaluate(() => uvTestModel());
    await page.locator('[data-hotkey="camera:rotate"]').click();
    const angle = page.getByLabel('Camera Z coordinate', { exact: true });
    await angle.fill('90'); await angle.press('Enter');
    await page.locator('[data-hotkey="camera:work"]').click();
    await openUV();
    await page.waitForFunction(() => document.querySelectorAll('.classic-view > .viewport').length === 1);
    assert.equal(app.windows().length, 1, 'UV stays inside the model tab');
    assert.equal(await page.locator('.classic-toolbar').isVisible(), true);
    assert.equal(await page.locator('.classic-view > .viewport').isVisible(), true);
    assert.equal(await page.getByRole('dialog', { name: 'UV Wrapper', exact: true }).getAttribute('aria-modal'), 'false');
    assert.equal(await page.locator('.uv-tab-window.expanded').count(), 1, 'UV opens expanded');
    checks.push('UV opens expanded as a nonmodal tab window; vertex viewport and toolbar remain visible');
    await page.waitForFunction(() => uvTestCamera());
    const framing = await page.evaluate(() => uvTestFraming());
    assert.ok(framing.orthographic && Math.abs(framing.direction[0] - 1) < 1e-6 && Math.abs(framing.direction[1]) < 1e-6 && Math.abs(framing.direction[2]) < 1e-6, 'UV opens facing the Warcraft front (+X), independently of the editor view');
    assert.ok(framing.edge > .8 && framing.edge < .9, 'the full model fills the frontal preview with a small margin: ' + framing.edge);
    checks.push('UV starts frontal and tightly framed with the full model in view');
    await page.screenshot({ path: path.join(out, 'uv-front.png') });
    const cameraBefore = await page.evaluate(() => uvTestCamera());
    const preview = await page.locator('.uv-preview-canvas canvas[data-clean-model-canvas]').boundingBox();
    await page.mouse.move(preview.x + preview.width * .5, preview.y + preview.height * .5);
    await page.mouse.down(); await page.mouse.move(preview.x + preview.width * .7, preview.y + preview.height * .65, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(before => JSON.stringify(uvTestCamera()) !== before, JSON.stringify(cameraBefore));
    checks.push('UV model preview rotates with an actual mouse drag');
    const orbited = await page.evaluate(() => uvTestCamera());
    await page.locator('.uv-tab-window').getByLabel('Material Properties', { exact: true }).selectOption('Alpha');
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(() => uvTestCamera()), orbited, 'material rebuild preserves the user orbit and fitted zoom');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(() => uvTestCamera()), orbited);
    checks.push('material rebuilds preserve the chosen camera without replaying the initial front fit');
    await page.locator('.classic-view > .viewport [aria-label="3D model viewport"]').focus();
    await page.keyboard.press('Control+a');
    const coordinate = page.getByRole('spinbutton', { name: 'X coordinate', exact: true });
    const oldX = Number(await coordinate.inputValue());
    await coordinate.fill(String(oldX + 3)); await coordinate.press('Enter');
    assert.notDeepEqual((await page.evaluate(() => uvTestModel())).vertices, before.vertices, 'the vertex editor can edit while the UV window is open');
    await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => uvTestModel()), before);
    checks.push('Vertex coordinate editing and Undo work while UV is open');
    await page.locator('.uv-tab-window [data-hotkey="uv:flip-u"]').click();
    const edited = await page.evaluate(() => uvTestModel());
    assert.notDeepEqual(edited.uv, before.uv); assert.deepEqual(edited.vertices, before.vertices);
    await page.getByRole('button', { name: 'Minimize UV Wrapper', exact: true }).click();
    assert.equal(await page.locator('.uv-tab-window-body').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Close UV Wrapper', exact: true }).isVisible(), true);
    const vertexCanvas = page.locator('.classic-view > .viewport canvas').first();
    const vertexBefore = await vertexCanvas.screenshot();
    const vertexBounds = await vertexCanvas.boundingBox();
    await page.keyboard.down('Alt'); await page.mouse.move(vertexBounds.x + vertexBounds.width * .4, vertexBounds.y + vertexBounds.height * .4);
    await page.mouse.down(); await page.mouse.move(vertexBounds.x + vertexBounds.width * .55, vertexBounds.y + vertexBounds.height * .5, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Alt');
    assert.ok(!(await vertexCanvas.screenshot()).equals(vertexBefore), 'main editor responds to an actual rotation drag while UV is minimized');
    await page.locator('.classic-view > .viewport [aria-label="3D model viewport"]').focus();
    await page.keyboard.press('Escape'); await page.keyboard.press('Control+a');
    assert.ok(await page.evaluate(() => Object.values(uvTestProps('.viewport').selectionByGeoset).some(ids => ids.length)), 'vertex selection still works while UV is minimized');
    await page.getByRole('tab', { name: 'demo.mdl', exact: true }).click();
    assert.equal(await page.locator('.uv-tab-window').count(), 0);
    const otherBefore = await page.evaluate(() => uvTestModel());
    await openUV();
    await page.getByRole('button', { name: 'Restore UV Wrapper size', exact: true }).click();
    await page.getByRole('tab', { name: 'demo.mdx', exact: true }).click();
    assert.equal(await page.locator('.uv-tab-window.minimized').count(), 1);
    assert.deepEqual(await page.evaluate(() => uvTestModel()), edited);
    await page.getByRole('button', { name: 'Restore UV Wrapper', exact: true }).click();
    let undoSteps = 0;
    while (JSON.stringify((await page.evaluate(() => uvTestModel())).uv) !== JSON.stringify(before.uv) && undoSteps < 5) {
      await page.keyboard.press('Control+z'); undoSteps++;
    }
    assert.deepEqual((await page.evaluate(() => uvTestModel())).uv, before.uv);
    for (let i = 0; i < undoSteps; i++) await page.keyboard.press('Control+y');
    assert.deepEqual(await page.evaluate(() => uvTestModel()), edited);
    checks.push('UV edits and Undo/Redo survive tab switches; minimized and expanded state belong to each tab');
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Minimize UV Wrapper', exact: true }).click();
      await page.getByRole('tab', { name: 'demo.mdl', exact: true }).click();
      assert.equal(await page.locator('.uv-tab-window:not(.expanded):not(.minimized)').count(), 1);
      assert.deepEqual(await page.evaluate(() => uvTestModel()), otherBefore);
      await page.getByRole('tab', { name: 'demo.mdx', exact: true }).click();
      await page.getByRole('button', { name: 'Restore UV Wrapper', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Restore UV Wrapper size', exact: true }).click();
    const header = await page.locator('.uv-tab-window>header').boundingBox();
    await page.mouse.move(header.x + 70, header.y + 14); await page.mouse.down(); await page.mouse.move(header.x - 120, header.y + 70, { steps: 8 }); await page.mouse.up();
    const moved = await page.locator('.uv-tab-window').boundingBox(), bounds = await page.locator('.classic-view').boundingBox();
    assert.ok(moved.x >= bounds.x && moved.y >= bounds.y && moved.x + moved.width <= bounds.x + bounds.width + 1);
    await page.getByRole('button', { name: 'Minimize UV Wrapper', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 760));
    await page.getByRole('button', { name: 'Restore UV Wrapper', exact: true }).click();
    const smallClose = await page.getByRole('button', { name: 'Close UV Wrapper', exact: true }).boundingBox();
    assert.ok(smallClose.x >= 0 && smallClose.x + smallClose.width <= 1000 && smallClose.y >= 0 && smallClose.y + smallClose.height <= 760);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 1000));
    checks.push('Repeated minimize/restore/expand and title-bar dragging remain usable inside the tab');
    await page.getByRole('button', { name: 'Replace Texture…', exact: true }).click();
    await page.locator('.uv-tab-window [aria-modal="true"]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.uv-tab-window [aria-modal="true"]').waitFor({ state: 'hidden' });
    checks.push('Texture Library opens and closes inside the UV window');
    await page.screenshot({ path: path.join(out, 'uv-window.png') });
    await page.getByRole('button', { name: 'Close UV Wrapper', exact: true }).click();
    assert.equal(await page.locator('.uv-tab-window').count(), 0);
    assert.deepEqual(await page.evaluate(() => uvTestModel()), edited);
    await page.getByRole('tab', { name: 'demo.mdl', exact: true }).click();
    await page.getByRole('button', { name: 'Minimize UV Wrapper', exact: true }).click();
    await page.getByRole('button', { name: 'Close UV Wrapper', exact: true }).click();
    await page.getByRole('tab', { name: 'demo.mdx', exact: true }).click();
    assert.equal(await page.locator('.uv-tab-window').count(), 0);
    assert.deepEqual(errors, []);
    [first, second].forEach((file, index) => assert.ok(fs.readFileSync(file).equals(originals[index])));
    checks.push('Closing expanded or minimized UV retains document edits; source models remain byte-identical; no renderer errors');
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, checks }, null, 2));
    console.log('PASS ' + checks.join('; '));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
    assert.equal(path.dirname(profile), out);
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
