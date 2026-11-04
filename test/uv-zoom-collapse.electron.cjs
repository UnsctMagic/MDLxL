const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve(process.env.MDLXL_UV_ZOOM_OUT || 'out/uv-zoom-collapse');
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('footman'), originalFile = fs.readFileSync(fixture);
  const checks = [], errors = [], bundle = bundleHashes();
  const check = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks.push(label); console.log('PASS ' + label); };
  const { app, page } = await launchApp({ fixture, out, errors, bounds: { x: 0, y: 0, width: 1440, height: 1000 },
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    settings: { preferences: { pointerSensitivity: 1.22, uvSensitivity: 1, fineSensitivity: .2, graphics: { pauseWhenHidden: false } } } });
  try {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.getByLabel('3D model viewport', { exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();
    const uv = page.locator('.uv-tab-window'), canvas = uv.locator('.uv-editor canvas');
    await canvas.waitFor();
    // Read-only probes: every selection, transform, undo and camera change uses real input.
    await page.evaluate(() => {
      window.zoomState = () => findFiberState('.uv-editor', s => s?.uv && s?.draw, { last: true });
      window.zoomProps = () => findFiberProps('.uv-editor', p => p?.geoset && p?.onSelectVertices);
      window.zoomInfo = () => ({ ids: Array.from(zoomProps().selectedVertices), uv: Array.from(zoomState().uv) });
      window.zoomCamera = () => { const s = mdlxlProbe('.uv-tab-window .game-preview-root').runtime;
        return s ? { position: s.controls.object.position.toArray(), quaternion: s.controls.object.quaternion.toArray(), zoom: s.controls.object.zoom, target: s.controls.target.toArray() } : null; };
      window.zoomMap = () => { const s = zoomState(); return [s.zoom, s.panX, s.panY]; };
    });
    await page.waitForFunction(() => zoomCamera() && zoomInfo().ids.length > 2);
    await uv.getByRole('button', { name: 'Zoom', exact: true }).click();
    const box = await canvas.boundingBox();
    const probeDrag = async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const d = await page.evaluate(() => { const d = zoomState().drag; return { pivot: d.pivotScreen, center: d.center, sizeX: d.sizeX, sizeY: d.sizeY }; });
      await page.mouse.up();
      return d;
    };
    const initial = await page.evaluate(() => zoomInfo()), mapping = await probeDrag();
    const points = initial.ids.map(i => ({ i, x: mapping.pivot[0] + (initial.uv[i * 2] - mapping.center[0]) * mapping.sizeX,
      y: mapping.pivot[1] + (initial.uv[i * 2 + 1] - mapping.center[1]) * mapping.sizeY }));
    const candidates = points.filter(p => p.x > 35 && p.x < box.width - 35 && p.y > 35 && p.y < box.height - 35);
    const first = candidates[0], second = candidates.find(p => Math.abs(p.x - first.x) > 20 && Math.abs(p.y - first.y) > 20);
    assert.ok(second, 'real Footman supplies two separated UV points');
    await uv.getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.click(box.x + first.x, box.y + first.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(box.x + second.x, box.y + second.y);
    await page.keyboard.up('Shift');
    await page.waitForFunction(() => zoomInfo().ids.length === 2);
    const before = await page.evaluate(() => zoomInfo()), modelBefore = await page.evaluate(() => JSON.stringify(__mdlxl.model()));
    await uv.getByRole('button', { name: 'Zoom', exact: true }).click();
    const selectedMapping = await probeDrag(), pivot = selectedMapping.pivot.map((v, i) => v + (i ? box.y : box.x));
    const cameraBefore = await page.evaluate(() => zoomCamera()), mapBefore = await page.evaluate(() => zoomMap());
    const center = [0, 1].map(axis => before.ids.reduce((sum, i) => sum + before.uv[i * 2 + axis] / 2, 0));
    const undo = async () => {
      await page.keyboard.press('Control+z');
      await page.waitForFunction(expected => JSON.stringify(__mdlxl.model()) === expected, modelBefore);
      check('undo restores all model data', await page.evaluate(() => zoomInfo().uv), before.uv);
    };
    const drag = async (label, start, end, factor, { alt = false, axis = null, hold = false } = {}) => {
      if (alt) await page.keyboard.down('Alt');
      if (axis) await page.keyboard.down('Shift');
      await page.mouse.move(pivot[0] + start[0], pivot[1] + start[1]); await page.mouse.down();
      await page.mouse.move(pivot[0] + end[0], pivot[1] + end[1], { steps: 8 });
      if (hold) {
        await page.waitForFunction(() => { const s = zoomState(), d = s.drag, p = s.pendingMove?.rawEnd; return d && p && Math.abs(d.endX - (d.x + (p.x - d.x) * d.pointerSensitivity)) < .01; });
        const live = await page.evaluate(() => zoomInfo());
        check(label + ': live drag reaches identical coordinates', live.ids.map(i => live.uv.slice(i * 2, i * 2 + 2)), [center.map(Math.fround), center.map(Math.fround)]);
        await page.mouse.move(pivot[0] + end[0] * 2, pivot[1] + end[1] * 2, { steps: 4 });
      }
      const dragEvidence = await page.evaluate(() => { const d = zoomState().drag; return { sensitivity: d?.pointerSensitivity, x: d?.x, endX: d?.endX, pending: zoomState().pendingMove?.rawEnd }; });
      await page.mouse.up();
      if (axis) await page.keyboard.up('Shift');
      if (alt) await page.keyboard.up('Alt');
      await page.waitForFunction(() => !zoomState().drag && Array.from(zoomProps().geoset.TVertices[0]).every((v, i) => v === zoomState().uv[i]));
      const after = await page.evaluate(() => zoomInfo());
      for (const i of before.ids) for (let a = 0; a < 2; a++) {
        const value = axis === (a ? 'X' : 'Y') ? before.uv[i * 2 + a] : Math.fround(center[a] + (before.uv[i * 2 + a] - center[a]) * factor);
        assert.ok(Math.abs(after.uv[i * 2 + a] - value) < .002, label + ': expected UV scale ' + factor + ' ' + JSON.stringify({ actual: after.uv[i * 2 + a], expected: value, dragEvidence }));
      }
      if (factor === 0 && !axis) check(label + ': both vertices coincide exactly', after.uv.slice(before.ids[0] * 2, before.ids[0] * 2 + 2), after.uv.slice(before.ids[1] * 2, before.ids[1] * 2 + 2));
      check(label + ': unselected UVs unchanged', after.uv.filter((_, i) => !before.ids.includes(Math.floor(i / 2))), before.uv.filter((_, i) => !before.ids.includes(Math.floor(i / 2))));
      check(label + ': UV view unchanged', await page.evaluate(() => zoomMap()), mapBefore);
      check(label + ': 3D camera unchanged', await page.evaluate(() => zoomCamera()), cameraBefore);
      await undo();
    };
    // Restore the pre-patch rule: left shrinks to zero, right enlarges,
    // regardless of the starting side or distance from the selection centre.
    await drag('left drag past zero', [90, 8], [-30, 8], 0, { hold: true });
    for (const [label, start] of [['right of centre', [80, 0]], ['left of centre', [-80, 0]], ['above centre', [0, -80]], ['below centre', [0, 80]], ['at centre', [0, 0]]]) {
      await drag(label + ' enlarge', start, [start[0] + 50, start[1]], 1.5);
      await drag(label + ' shrink', start, [start[0] - 50, start[1]], .5);
      await drag(label + ' collapse', start, [start[0] - 120, start[1]], 0);
    }
    await drag('diagonal left drag', [90, 30], [-30, -60], 0);
    await drag('Alt fine drag', [90, 0], [-30, 0], .76, { alt: true });
    for (const axis of ['X', 'Y']) {
      await uv.getByRole('button', { name: 'UV ' + axis + ' axis', exact: true }).click();
      await drag('Shift ' + axis + ' collapse', [90, 0], [-30, 0], 0, { axis });
      await uv.getByRole('button', { name: 'UV ' + axis + ' axis', exact: true }).click();
    }
    // Exercise the adjacent tools through their normal controls as preservation checks.
    for (const tool of ['Move', 'Rotate', 'Mirror by X', 'Mirror by Y', 'Fold']) {
      await uv.getByRole('button', { name: tool, exact: true }).click();
      if (tool === 'Move' || tool === 'Rotate') {
        await page.mouse.move(pivot[0] + 80, pivot[1]); await page.mouse.down();
        const end = tool === 'Move' ? [130, 30] : [0, 80];
        await page.mouse.move(pivot[0] + end[0], pivot[1] + end[1], { steps: 12 }); await page.mouse.up();
      }
      await page.waitForFunction(value => JSON.stringify(__mdlxl.model()) !== value, modelBefore);
      const after = await page.evaluate(() => zoomInfo());
      for (const i of before.ids) {
        const u = before.uv[i * 2], v = before.uv[i * 2 + 1];
        const expected = tool === 'Move' ? [u + 50 / selectedMapping.sizeX, v + 30 / selectedMapping.sizeY]
          : tool === 'Rotate' ? [center[0] + (u - center[0]) * Math.cos(-80 * .7 / 48) - (v - center[1]) * Math.sin(-80 * .7 / 48) * selectedMapping.sizeY / selectedMapping.sizeX, center[1] + (u - center[0]) * Math.sin(-80 * .7 / 48) * selectedMapping.sizeX / selectedMapping.sizeY + (v - center[1]) * Math.cos(-80 * .7 / 48)]
          : tool === 'Mirror by X' ? [2 * center[0] - u, v]
          : tool === 'Mirror by Y' ? [u, 2 * center[1] - v]
          : [Math.min(...before.ids.map(id => before.uv[id * 2])), v];
        assert.ok(expected.every((value, axis) => Math.abs(after.uv[i * 2 + axis] - value) < .01), tool + ' produces its expected result');
      }
      check(tool + ': unselected UVs unchanged', after.uv.filter((_, i) => !before.ids.includes(Math.floor(i / 2))), before.uv.filter((_, i) => !before.ids.includes(Math.floor(i / 2))));
      check(tool + ': UV view unchanged', await page.evaluate(() => zoomMap()), mapBefore);
      check(tool + ': 3D camera unchanged', await page.evaluate(() => zoomCamera()), cameraBefore);
      await undo();
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -200);
    await page.waitForFunction(zoom => zoomMap()[0] !== zoom, mapBefore[0]);
    check('UV wheel zoom leaves UV coordinates unchanged', await page.evaluate(() => zoomInfo().uv), before.uv);
    const preview = uv.locator('[data-clean-model-canvas]'), previewBox = await preview.boundingBox();
    await page.mouse.move(previewBox.x + previewBox.width / 2, previewBox.y + previewBox.height / 2);
    await page.mouse.down(); await page.mouse.move(previewBox.x + previewBox.width / 2 + 65, previewBox.y + previewBox.height / 2 + 30, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(q => JSON.stringify(zoomCamera().quaternion) !== JSON.stringify(q), cameraBefore.quaternion);
    check('normal mouse drag still rotates the 3D preview', (await page.evaluate(() => zoomCamera())).quaternion.some((v, i) => v !== cameraBefore.quaternion[i]), true);
    const zoomBefore = (await page.evaluate(() => zoomCamera())).zoom;
    await page.mouse.wheel(0, -200); await page.waitForFunction(z => zoomCamera().zoom !== z, zoomBefore);
    check('3D wheel zoom still works', (await page.evaluate(() => zoomCamera())).zoom !== zoomBefore, true);
    check('navigation leaves the model unchanged', await page.evaluate(() => JSON.stringify(__mdlxl.model())), modelBefore);
    check('source model file unchanged', fs.readFileSync(fixture).equals(originalFile), true);
    check('no renderer errors', errors, []);
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png') });
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors, fixture, bundle }, null, 2));
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
