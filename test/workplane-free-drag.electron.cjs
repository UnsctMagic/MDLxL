const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Exercise the rebuilt production bundle: node test/workplane-free-drag.electron.cjs
// Set MDLXL_EXE to a packaged MDLxL.exe to drive the packaged app instead.
// Workplane off frees a Move drag to the screen plane; Shift or Workplane on keeps it in XY.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const out = path.resolve('out/workplane-free-drag'); fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument();
  const fixture = path.join(out, 'workplane-drag.mdx'); fs.writeFileSync(fixture, Buffer.from(doc.serialize('mdx')));
  const errors = [];
  const packaged = process.env.MDLXL_EXE && path.resolve(process.env.MDLXL_EXE);
  const app = (await launchApp({ out: path.resolve('out'), profile: path.join(out, 'profile-' + Date.now()), args: (packaged ? [fixture, '--disable-backgrounding-occluded-windows'] : ['--disable-backgrounding-occluded-windows', process.cwd(), fixture]).filter(arg => arg !== path.resolve(__dirname, '..') && arg !== '--disable-backgrounding-occluded-windows'), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000 })).app;
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    const viewport = page.getByLabel('3D model viewport', { exact: true }); await viewport.waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click(); await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Vertices: 14'));
    await page.evaluate(() => {
      window.viewportState = (scope = '') => {
        const host = document.querySelector(scope + ' [aria-label="3D model viewport"]');
        
        { const value = findFiberState(host, value => value?.renderer && value?.entries); if (value?.renderer && value?.entries) return value; }

        throw Error('Viewport runtime not found');
      };
      // The Move gizmo's arrows and squares, in page coordinates.
      window.gizmo = (scope = '') => {
        const state = viewportState(scope), rect = state.controls.domElement.getBoundingClientRect();
        return { canvas: !!document.querySelector(scope + ' [data-move-gizmo]'), handles: (state.gizmoHandles || []).map(h => ({ axis: h.axis, plane: h.plane, x: rect.x + h.x, y: rect.y + h.y, startX: rect.x + h.startX, startY: rect.y + h.startY, dx: h.dx, dy: h.dy })) };
      };
      window.modelCentroid = (scope = '') => {
        const c = [0, 0, 0]; let count = 0;
        for (const entry of viewportState(scope).entries) for (let i = 0; i < (entry?.geoset.Vertices.length || 0); i++) { c[i % 3] += entry.geoset.Vertices[i]; if (i % 3 === 0) count++; }
        return c.map(value => value / count);
      };
      window.authoredCentroid = () => {
        const v = viewportState().entries[0].geoset.Vertices, c = [0, 0, 0];
        for (let i = 0; i < v.length; i++) c[i % 3] += v[i] * 3 / v.length;
        return c;
      };
      window.screenCentroid = () => {
        const state = viewportState(), c = authoredCentroid(), point = state.controls.target.clone().set(...c).project(state.camera);
        const rect = state.controls.domElement.getBoundingClientRect();
        return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
      };
      window.displayedCoords = (scope = '.classic-sidebar') => Array.from(document.querySelectorAll(scope + ' .classic-coordinates input'), input => Number(input.value));
      window.cameraFacing = () => { const s = viewportState(); return s.camera.getWorldDirection(s.controls.target.clone()).toArray(); };
    });
    const idle = () => settlePage(page, 180);
    const expectCoords = (actual, expected, label) => assert.ok(actual.length === 3 && actual.every((value, axis) => Math.abs(value - expected[axis]) < .0002), label + ': ' + actual + ' != ' + expected);
    await page.getByLabel('View direction', { exact: true }).selectOption('front'); await idle();
    await viewport.focus(); const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10); await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 10, { steps: 5 }); await page.mouse.up(); await idle();
    await page.waitForFunction(() => viewportState().entries[0].selectedPoints.geometry.index?.count === 14);
    const planeRadio = name => page.getByLabel(name + ' workplane', { exact: true }).or(page.getByRole('radio', { name, exact: true })).first();
    const drag = async ({ workplane, shift = false, plane = 'XY' }) => {
      const checkbox = page.getByLabel('Workplane', { exact: true });
      if (workplane) await checkbox.check(); else await checkbox.uncheck();
      await planeRadio(plane).check(); await idle();
      const before = await page.evaluate(() => ({ c: authoredCentroid(), s: screenCentroid() }));
      await page.mouse.move(before.s.x, before.s.y); if (shift) await page.keyboard.down('Shift');
      await page.mouse.down(); await page.mouse.move(before.s.x + 50, before.s.y - 40, { steps: 6 }); await idle();
      const liveCoords = await page.evaluate(() => displayedCoords());
      assert.notDeepEqual(liveCoords, before.c, 'Coords updates during a vertex drag');
      assert.deepEqual(await page.evaluate(() => authoredCentroid()), before.c, 'drag preview leaves authored vertices unchanged');
      await page.mouse.up();
      if (shift) await page.keyboard.up('Shift'); await idle();
      const after = await page.evaluate(() => ({ c: authoredCentroid(), s: screenCentroid() }));
      expectCoords(liveCoords, after.c, 'live Coords matches released vertex positions');
      await page.keyboard.press('Control+z'); await idle();
      assert.deepEqual(await page.evaluate(() => authoredCentroid()), before.c, 'undo restores the vertices');
      return { delta: after.c.map((value, i) => value - before.c[i]), screen: [after.s.x - before.s.x, after.s.y - before.s.y] };
    };
    const length = v => Math.hypot(...v), dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    // The user's case: Front looks along X, so the screen is YZ; ZX blocks sideways (Y) movement, Workplane off must not.
    const expectFront = (label, { on, off, shifted }) => {
      console.log(label, 'Front ZX', JSON.stringify({ on, off, shifted }));
      assert.ok(length(on.delta) > 2 && Math.abs(on.delta[1]) < 1e-3, `${label} Front: Workplane on keeps the drag in ZX: ${on.delta}`);
      assert.ok(length(shifted.delta) > 2 && Math.abs(shifted.delta[1]) < 1e-3, `${label} Front: Workplane off + Shift locks the drag to ZX: ${shifted.delta}`);
      assert.ok(Math.abs(off.delta[1]) > 1 && Math.abs(off.delta[2]) > 1 && Math.abs(off.delta[0]) < 1e-3, `${label} Front: Workplane off follows the screen (Y and Z): ${off.delta}`);
    };
    const threeDrags = async (dragOnce, plane) => ({ on: await dragOnce({ workplane: true, plane }), off: await dragOnce({ workplane: false, plane }), shifted: await dragOnce({ workplane: false, shift: true, plane }) });
    const expectFree = (label, facing, { on, off, shifted }) => {
      console.log(label, JSON.stringify({ facing, on, off, shifted }));
      assert.ok(length(on.delta) > 2 && Math.abs(on.delta[2]) < 1e-3, `${label}: Workplane on keeps the drag in XY: ${on.delta}`);
      assert.ok(length(shifted.delta) > 2 && Math.abs(shifted.delta[2]) < 1e-3, `${label}: Workplane off + Shift locks the drag to XY: ${shifted.delta}`);
      assert.ok(Math.abs(off.delta[2]) > 1, `${label}: Workplane off leaves the XY plane: ${off.delta}`);
      assert.ok(Math.abs(dot(off.delta, facing)) < length(off.delta) * .03, `${label}: Workplane off drags in the screen plane: ${off.delta}`);
      assert.ok(Math.abs(off.screen[0] - 50) < 4 && Math.abs(off.screen[1] + 40) < 4, `${label}: Workplane off follows the pointer: ${off.screen}`);
    };
    await page.getByRole('button', { name: 'Fit selection', exact: true }).click(); await viewport.focus(); await page.keyboard.press('m'); await idle();
    expectFront('Vertices', await threeDrags(drag, 'ZX'));

    // A rotated perspective view, turned with a real Alt+drag: screen plane != any workplane.
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective'); await idle();
    const facingBefore = await page.evaluate(() => cameraFacing());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await idle();
    const facing = await page.evaluate(() => cameraFacing());
    assert.ok(facing.some((value, i) => Math.abs(value - facingBefore[i]) > .05), `Alt+drag rotates the camera: ${facingBefore} -> ${facing}`);
    assert.ok(facing.every(value => Math.abs(value) > .1), `rotated view is oblique: ${facing}`);
    await page.getByRole('button', { name: 'Fit selection', exact: true }).click(); await idle();
    await viewport.focus(); await page.keyboard.press('m'); await idle();

    expectFree('Vertices', facing, await threeDrags(drag, 'XY'));
    await page.screenshot({ path: path.join(out, 'vertices-free-drag.png') });

    // Workplane off + Move shows the POSE arrows and plane squares; an arrow keeps its axis, a square its plane.
    const gizmoDrags = async (label, scope, measure) => {
      const checkbox = (scope ? page.locator(scope) : page).getByLabel('Workplane', { exact: true });
      await checkbox.check(); await idle();
      assert.equal((await page.evaluate(scope => gizmo(scope), scope)).canvas, false, `${label}: no gizmo with Workplane on`);
      await checkbox.uncheck(); await idle();
      const shown = await page.evaluate(scope => gizmo(scope), scope);
      assert.ok(shown.canvas && ['X', 'Y', 'Z', 'XY', 'XZ', 'YZ'].every(axis => shown.handles.some(h => h.axis === axis)), `${label}: Workplane off shows arrows and squares: ${shown.handles.map(h => h.axis)}`);
      const dragHandle = async (axis, move) => {
        const h = (await page.evaluate(scope => gizmo(scope), scope)).handles.find(h => h.axis === axis);
        const from = h.plane ? { x: h.x, y: h.y } : { x: h.startX + h.dx * .7, y: h.startY + h.dy * .7 }, before = await page.evaluate(measure, scope);
        if (!h.plane) { const length = Math.hypot(h.dx, h.dy), ux = h.dx / length, uy = h.dy / length; move = [ux * 40 - uy * 25, uy * 40 + ux * 25]; }
        await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + move[0], from.y + move[1], { steps: 6 }); await idle();
        const liveCoords = await page.evaluate(scope => displayedCoords(scope || '.classic-sidebar'), scope);
        expectCoords(await page.evaluate(measure, scope), before, label + ': gizmo preview does not commit');
        await page.mouse.up(); await idle();
        expectCoords(liveCoords, await page.evaluate(measure, scope), label + ': gizmo updates Coords while held');
        const delta = (await page.evaluate(measure, scope)).map((value, i) => value - before[i]);
        if (scope) await page.locator(scope + ' [data-hotkey="undo"]').click(); else await page.keyboard.press('Control+z');
        let restored; for (let tries = 0; tries < 10; tries++) { await idle(); restored = await page.evaluate(measure, scope); if (restored.every((value, i) => Math.abs(value - before[i]) < 1e-3)) break; }
        assert.ok(restored.every((value, i) => Math.abs(value - before[i]) < 1e-3), `${label}: undo restores after ${axis}: ${before} -> ${delta} -> ${restored}`);
        return { h, delta };
      };
      for (const [index, axis] of ['X', 'Y', 'Z'].entries()) {
        const { delta } = await dragHandle(axis);
        console.log(label, 'arrow', axis, JSON.stringify(delta));
        assert.ok(delta[index] > .5 && delta.every((value, i) => i === index || Math.abs(value) < 1e-3), `${label}: the ${axis} arrow moves along +${axis} only: ${delta}`);
      }
      const { delta } = await dragHandle('XY', [30, -25]);
      console.log(label, 'square XY', JSON.stringify(delta));
      assert.ok(Math.hypot(delta[0], delta[1]) > .5 && Math.abs(delta[2]) < 1e-3, `${label}: the XY square stays in XY: ${delta}`);
      await page.screenshot({ path: path.join(out, label.toLowerCase() + '-gizmo.png') });
    };
    await gizmoDrags('Vertices', '', () => authoredCentroid());
    await page.keyboard.press('a'); await idle();
    assert.equal((await page.evaluate(() => gizmo())).canvas, false, 'Vertices: no gizmo with the Select tool');
    await viewport.focus(); await page.keyboard.press('m'); await idle();

    // Forge uses the same viewport: a new Cube, a real Alt+drag rotation, then the gizmo.
    await page.getByRole('button', { name: 'Forge', exact: true }).click();
    const forge = page.getByRole('dialog', { name: 'Forge', exact: true }); await forge.waitFor();
    await forge.getByRole('button', { name: 'Cube', exact: true }).click(); await idle();
    await forge.getByLabel('View direction', { exact: true }).selectOption('perspective'); await idle();
    const forgeBox = await forge.getByLabel('3D model viewport', { exact: true }).boundingBox(), forgeBefore = await page.evaluate(() => { const s = viewportState('.forge-dialog'); return s.camera.quaternion.toArray(); });
    await page.mouse.move(forgeBox.x + forgeBox.width / 2, forgeBox.y + forgeBox.height / 2); await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(forgeBox.x + forgeBox.width / 2 + 90, forgeBox.y + forgeBox.height / 2 + 60, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await idle();
    assert.notDeepEqual(await page.evaluate(() => viewportState('.forge-dialog').camera.quaternion.toArray()), forgeBefore, 'Alt+drag rotates the Forge camera');
    await gizmoDrags('Forge', '.forge-dialog', scope => modelCentroid(scope));
    await forge.getByRole('button', { name: 'Close Forge', exact: true }).click(); await forge.waitFor({ state: 'hidden' });

    // Bones (rest pose) and Movement (animation key): the same drags on a bone in the 3D preview.
    await page.evaluate(() => {
      window.previewRuntime = () => {
        const root = document.querySelector('.game-preview-root');
        { const ref = mdlxlProbe(root).runtime; if (ref?.native && ref?.controls) return ref; }

        throw Error('Preview runtime not ready');
      };
      window.boneWorld = id => {
        const node = previewRuntime().native.rendererData.nodes.find(entry => entry?.node.ObjectId === id), m = node.matrix, [x, y, z] = node.node.PivotPoint;
        return [0, 1, 2].map(i => m[i] * x + m[4 + i] * y + m[8 + i] * z + m[12 + i]);
      };
      window.boneScreen = id => {
        const camera = previewRuntime().controls.object, point = camera.position.clone().fromArray(boneWorld(id)).project(camera), rect = document.querySelector('[data-clean-model-canvas]').getBoundingClientRect();
        return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
      };
      window.previewFacing = () => { const camera = previewRuntime().controls.object; return camera.getWorldDirection(camera.position.clone()).toArray(); };
    });
    const previewReady = () => page.waitForFunction(() => { try { return !!previewRuntime().captureApi?.isReady; } catch { return false; } });
    // Bones is on by default and shared by Bones/Movement/Animations (PR #238), so switch it on rather than toggling it.
    const showBones = async () => { const bones = page.getByRole('checkbox',{name:'Bones',exact:true}); if (!await bones.isChecked()) await bones.check(); assert.equal(await bones.isChecked(), true, 'Bones display on'); };
    const rotatePreview = async () => {
      await page.getByLabel('View direction', { exact: true }).selectOption('perspective'); await page.getByRole('button', { name: 'Fit', exact: true }).click(); await idle();
      const canvas = await page.locator('[data-clean-model-canvas]').boundingBox(), before = await page.evaluate(() => previewFacing());
      await page.mouse.move(canvas.x + 60, canvas.y + 60); await page.keyboard.down('Alt'); await page.mouse.down();
      await page.mouse.move(canvas.x + 150, canvas.y + 120, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await idle();
      const after = await page.evaluate(() => previewFacing());
      assert.ok(after.some((value, i) => Math.abs(value - before[i]) > .05), `Alt+drag rotates the preview camera: ${before} -> ${after}`);
      assert.ok(after.every(value => Math.abs(value) > .1), `rotated preview is oblique: ${after}`);
      return after;
    };
    const boneDrag = async (id, { workplane, shift = false, plane = 'XY' }) => {
      const checkbox = page.getByLabel('Workplane', { exact: true });
      if (workplane) await checkbox.check(); else await checkbox.uncheck();
      await planeRadio(plane).check(); await idle();
      const before = await page.evaluate(id => ({ c: boneWorld(id), s: boneScreen(id) }), id);
      await page.mouse.move(before.s.x, before.s.y); if (shift) await page.keyboard.down('Shift');
      await page.mouse.down(); await page.mouse.move(before.s.x + 50, before.s.y - 40, { steps: 6 }); await idle(); await page.mouse.up();
      if (shift) await page.keyboard.up('Shift'); await idle();
      const after = await page.evaluate(id => ({ c: boneWorld(id), s: boneScreen(id) }), id);
      await page.keyboard.press('Control+z'); await idle();
      const restored = await page.evaluate(id => boneWorld(id), id);
      assert.ok(restored.every((value, i) => Math.abs(value - before.c[i]) < 1e-3), `undo restores the bone: ${restored} != ${before.c}`);
      return { delta: after.c.map((value, i) => value - before.c[i]), screen: [after.s.x - before.s.x, after.s.y - before.s.y] };
    };
    const boneDrags = (id, plane) => threeDrags(options => boneDrag(id, options), plane);
    const frontPreview = async () => { await page.getByLabel('View direction', { exact: true }).selectOption('front'); await page.getByRole('button', { name: 'Fit', exact: true }).click(); await idle(); };

    await page.locator('[data-hotkey="bones"]').click(); await previewReady(); await showBones(); await idle();
    await page.getByRole('group', { name: 'Bones tools', exact: true }).getByRole('button', { name: 'Move', exact: true }).click(); await idle();
    await frontPreview(); expectFront('Bones', await boneDrags(1, 'ZX'));
    expectFree('Bones', await rotatePreview(), await boneDrags(1, 'XY'));
    await page.screenshot({ path: path.join(out, 'bones-free-drag.png') });

    await page.locator('[data-hotkey="animation"]').click(); await previewReady(); await showBones();
    await page.getByLabel('Movement current sequence').selectOption('0');
    const frame = page.getByLabel('Current animation frame'); await frame.fill('1000'); await frame.press('Enter'); await idle();
    await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Move', exact: true }).click(); await idle();
    await frontPreview(); expectFront('Movement', await boneDrags(1, 'ZX'));
    expectFree('Movement', await rotatePreview(), await boneDrags(1, 'XY'));
    await page.screenshot({ path: path.join(out, 'movement-free-drag.png') });

    await page.screenshot({ path: path.join(out, 'vertices-free-drag.png') });
    assert.deepEqual(errors, []);
    console.log('PASS Workplane off: free drag in Vertices, Bones, Movement; Move gizmo arrows and squares in Vertices and Forge; Shift and Workplane on keep the plane');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
