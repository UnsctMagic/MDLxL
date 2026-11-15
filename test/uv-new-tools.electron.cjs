// UV Wrapper Box Projection, Cylinder Projection, Straighten, Mirror Copy, Unwrap and Relax on the real
// Footman (docs/agent-tasks/uv-new-tools.md). Every tool is clicked with the mouse; Ctrl+Z undoes each in
// one step; the live preview's camera and the UV view stay where they were. The expected UVs come from
// the same src/ functions run on the canvas the UV Wrapper showed, with the live preview's view.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launchApp, closeApp, bundleHashes, root } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const unwrap = await import(pathToFileURL(path.join(root, 'src/uv-unwrap.js')).href);
  const uvTools = await import(pathToFileURL(path.join(root, 'src/uv-tools.js')).href);
  const out = path.resolve(process.env.MDLXL_UV_NEW_TOOLS_OUT || 'out/uv-new-tools');
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('footman'), originalFile = fs.readFileSync(fixture);
  const checks = [], errors = [], consoleErrors = [], bundle = bundleHashes();
  const check = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks.push(label); console.log('PASS ' + label); };
  const ok = (label, value, detail) => { assert.ok(value, detail === undefined ? label : label + ' ' + JSON.stringify(detail)); checks.push(label); console.log('PASS ' + label); };
  const { app, page } = await launchApp({ fixture, out, errors, bounds: { x: 0, y: 0, width: 1440, height: 1000 },
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    settings: { preferences: { graphics: { pauseWhenHidden: false } } } });
  try {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.getByLabel('3D model viewport', { exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();
    const uv = page.locator('.uv-tab-window'), canvas = uv.locator('.uv-editor canvas');
    await canvas.waitFor();
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    // Read-only probes; every change below is made with real clicks, drags, wheel and keys.
    await page.evaluate(() => {
      window.toolState = () => findFiberState('.uv-editor', s => s?.uv && s?.draw, { last: true });
      window.toolProps = () => findFiberProps('.uv-editor', p => p?.geoset && p?.onSelectVertices);
      window.toolCanvas = () => { const p = toolProps(), g = p.geoset; return { vertices: Array.from(g.Vertices), uv: Array.from(g.TVertices[0]), faces: Array.from(g.Faces), eligible: Array.from(p.eligibleVertices), selected: Array.from(p.selectedVertices) }; };
      window.toolKey = () => { const p = toolProps(); return JSON.stringify([Array.from(p.geoset.TVertices[0]), p.selectedVertices.length]); };
      window.toolCamera = () => { const s = mdlxlProbe('.uv-tab-window .game-preview-root').runtime; return s ? { position: s.controls.object.position.toArray(), quaternion: s.controls.object.quaternion.toArray(), zoom: s.controls.object.zoom, target: s.controls.target.toArray() } : null; };
      // The view Project from Current View reads, as the UV Wrapper holds it.
      window.toolView = () => { const v = findFiberState('.uv-tab-window .uv-workspace', s => s?.viewMatrix?.length === 16 && s?.projectionMatrix?.length === 16); return v ? { viewMatrix: Array.from(v.viewMatrix), projectionMatrix: Array.from(v.projectionMatrix) } : null; };
      window.toolMap = () => { const s = toolState(); return [s.zoom, s.panX, s.panY]; };
      window.toolModel = () => JSON.stringify(__mdlxl.model());
      window.toolWarning = () => document.querySelector('.uv-tab-window .uv-workspace-warning')?.textContent || '';
    });
    await page.waitForFunction(() => toolCamera() && toolView() && toolCanvas().selected.length > 100);
    const start = await page.evaluate(() => toolCanvas()), modelStart = await page.evaluate(() => toolModel());
    check('the whole Footman body is the working selection', start.selected.length, start.vertices.length / 3);
    await page.screenshot({ path: path.join(out, 'uv-wrapper.png') });
    await uv.locator('.uv-toolbox').screenshot({ path: path.join(out, 'uv-tools.png') });
    const geosetOf = c => ({ Vertices: Float32Array.from(c.vertices), TVertices: [Float32Array.from(c.uv)], Faces: Uint32Array.from(c.faces) });
    const point = (c, index) => c.vertices.slice(index * 3, index * 3 + 3);
    const signedArea = (c, corner) => { const [a, b, d] = [0, 1, 2].map(k => c.uv.slice(c.faces[corner + k] * 2, c.faces[corner + k] * 2 + 2)); return (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]); };
    // Rule 8: poll for the result, then for two equal reads 50 ms apart. The pause is the poll interval.
    const pause = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
    const settle = async (fn, expected, label) => {
      const deadline = Date.now() + 10000; let value;
      while (Date.now() < deadline) {
        value = await page.evaluate(fn);
        if (JSON.stringify(value) === JSON.stringify(expected)) return value;
        await pause();
      }
      assert.deepEqual(value, expected, label);
      return value;
    };
    const changedFrom = async key => {
      await page.waitForFunction(previous => toolKey() !== previous, key);
      let last = await page.evaluate(() => toolKey());
      for (;;) { await pause(); const next = await page.evaluate(() => toolKey()); if (next === last) break; last = next; }
      return page.evaluate(() => toolCanvas());
    };
    const button = name => uv.getByRole('button', { name, exact: true });
    for (const name of ['Box Projection', 'Cylinder Projection', 'Straighten', 'Mirror Copy', 'Unwrap', 'Relax'])
      ok(name + ' has a tooltip', ((await button(name).getAttribute('title')) || '').length > 20);
    const keep = async (label, cameraBefore, mapBefore, warningBefore) => {
      await settle(() => toolCamera(), cameraBefore, label + ': 3D camera unchanged'); checks.push(label + ': 3D camera unchanged'); console.log('PASS ' + label + ': 3D camera unchanged');
      check(label + ': UV view unchanged', await page.evaluate(() => toolMap()), mapBefore);
      check(label + ': no new warning', await page.evaluate(() => toolWarning()), warningBefore);
    };
    const undo = async (label, modelBefore, canvasBefore) => {
      await page.keyboard.press('Control+z');
      await page.waitForFunction(expected => toolModel() === expected, modelBefore, { timeout: 10000 })
        .catch(() => { throw Error(label + ': one Ctrl+Z did not restore the model'); });
      checks.push(label + ': one Ctrl+Z restores the model'); console.log('PASS ' + label + ': one Ctrl+Z restores the model');
      const back = await page.evaluate(() => toolCanvas());
      check(label + ': undo restores the UVs and points', [back.uv, back.vertices.length], [canvasBefore.uv, canvasBefore.vertices.length]);
    };
    const cornerTool = async (name, run, { flips = true } = {}) => {
      const before = await page.evaluate(() => toolCanvas()), modelBefore = await page.evaluate(() => toolModel());
      const view = await page.evaluate(() => toolView()), cameraBefore = await page.evaluate(() => toolCamera()), mapBefore = await page.evaluate(() => toolMap()), warningBefore = await page.evaluate(() => toolWarning());
      const expected = run(geosetOf(before), before.selected, view.viewMatrix, view.projectionMatrix, Float32Array.from(before.uv));
      await button(name).click();
      const after = await changedFrom(JSON.stringify([before.uv, before.selected.length]));
      let worst = 0;
      for (const [corner, value] of expected) for (let axis = 0; axis < 2; axis++) worst = Math.max(worst, Math.abs(after.uv[after.faces[corner] * 2 + axis] - Math.fround(value[axis])));
      ok(name + ': every triangle corner has its expected UV', worst < 2e-6, { worst });
      ok(name + ': the 3D model is unchanged at every corner', before.faces.every((_, corner) => point(after, after.faces[corner]).every((value, axis) => value === point(before, before.faces[corner])[axis])));
      const added = after.vertices.length / 3 - before.vertices.length / 3;
      ok(name + ': point copies only where needed', added >= 0 && added === after.selected.length - before.selected.length, { added });
      check(name + ': the selection keeps its points and gains every copy', after.selected.slice().sort((a, b) => a - b), Array.from({ length: after.vertices.length / 3 }, (_, i) => i));
      if (flips) ok(name + ': no flipped triangle', [...expected.keys()].filter(corner => corner % 3 === 0).every(corner => signedArea(after, corner) <= 0));
      await keep(name, cameraBefore, mapBefore, warningBefore);
      return { before, after, modelBefore, view };
    };
    const uvTool = async (name, run, verify) => {
      const before = await page.evaluate(() => toolCanvas()), modelBefore = await page.evaluate(() => toolModel());
      const cameraBefore = await page.evaluate(() => toolCamera()), mapBefore = await page.evaluate(() => toolMap()), warningBefore = await page.evaluate(() => toolWarning());
      const expected = Array.from(run(before)), changed = expected.filter((value, i) => value !== Math.fround(before.uv[i])).length;
      ok(name + ': the Footman gives this tool something to change', changed > 0, { changed });
      await button(name).click();
      const after = await changedFrom(JSON.stringify([before.uv, before.selected.length]));
      check(name + ': UVs as expected', after.uv, expected);
      check(name + ': no points added and the selection kept', [after.vertices.length, after.selected], [before.vertices.length, before.selected]);
      verify?.(before, after);
      await keep(name, cameraBefore, mapBefore, warningBefore);
      return { before, after, modelBefore };
    };

    // Box Projection and Cylinder Projection read the live preview's view, like Project from Current View.
    let result = await cornerTool('Box Projection', unwrap.boxProjectUVCorners);
    ok('Box Projection: the cut sides need point copies', result.after.vertices.length > result.before.vertices.length);
    await undo('Box Projection', result.modelBefore, result.before);
    result = await cornerTool('Cylinder Projection', unwrap.cylinderProjectUVCorners, { flips: false });
    await undo('Cylinder Projection', result.modelBefore, result.before);
    result = await cornerTool('Unwrap', unwrap.unwrapUVCorners);
    await undo('Unwrap', result.modelBefore, result.before);
    result = await uvTool('Straighten', c => uvTools.straightenUVCoordinates(Float32Array.from(c.uv), c.selected, geosetOf(c)), (before, after) => {
      const us = new Set(after.selected.map(i => after.uv[i * 2])), vs = new Set(after.selected.map(i => after.uv[i * 2 + 1]));
      ok('Straighten: the selection is one row or one column', us.size === 1 || vs.size === 1, { columns: us.size, rows: vs.size });
    });
    await undo('Straighten', result.modelBefore, result.before);
    result = await uvTool('Relax', c => uvTools.relaxUVCoordinates(geosetOf(c), c.selected, c.eligible, Float32Array.from(c.uv)));
    await undo('Relax', result.modelBefore, result.before);

    // Mirror Copy: Box Projection puts the body's left side on its own island; select it with a marquee
    // in the UV map and copy it onto the right side.
    const boxed = await cornerTool('Box Projection', unwrap.boxProjectUVCorners), modelBoxed = await page.evaluate(() => toolModel());
    const m = boxed.view.viewMatrix, side = corner => {
      const [a, b, d] = [0, 1, 2].map(k => point(boxed.after, boxed.after.faces[corner + k]));
      const n = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])];
      const v = [0, 1, 2].map(row => m[row] * n[0] + m[4 + row] * n[1] + m[8 + row] * n[2]);
      return -v[0] > Math.max(v[0], Math.abs(v[1]), Math.abs(v[2])) ? 'left' : 'other';
    };
    const leftUV = [];
    for (let corner = 0; corner < boxed.after.faces.length; corner += 3) if (side(corner) === 'left') for (let k = 0; k < 3; k++) leftUV.push(boxed.after.uv.slice(boxed.after.faces[corner + k] * 2, boxed.after.faces[corner + k] * 2 + 2));
    await page.screenshot({ path: path.join(out, 'box-projection.png') });
    ok('Box Projection gives the Footman body a left island', leftUV.length >= 9, { corners: leftUV.length });
    const low = [Math.min(...leftUV.map(p => p[0])), Math.min(...leftUV.map(p => p[1]))], high = [Math.max(...leftUV.map(p => p[0])), Math.max(...leftUV.map(p => p[1]))];
    let area = await canvas.boundingBox(), mapping;
    const probe = async () => {
      // A Zoom press without moving reads where the map draws its UVs and changes nothing.
      await button('Zoom').click();
      await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2); await page.mouse.down();
      const d = await page.evaluate(() => { const d = toolState().drag; return { pivot: d.pivotScreen, center: d.center, sizeX: d.sizeX, sizeY: d.sizeY }; });
      await page.mouse.up(); await button('Select').click();
      return d;
    };
    const screen = (d, p) => [area.x + d.pivot[0] + (p[0] - d.center[0]) * d.sizeX, area.y + d.pivot[1] + (p[1] - d.center[1]) * d.sizeY];
    for (let attempt = 0; ; attempt++) {
      mapping = await probe();
      const [x0, y0] = screen(mapping, low), [x1, y1] = screen(mapping, high);
      if (x0 > area.x + 12 && y0 > area.y + 12 && x1 < area.x + area.width - 12 && y1 < area.y + area.height - 12) break;
      assert.ok(attempt < 8, 'the left island fits in the UV map after zooming out');
      const zoom = (await page.evaluate(() => toolMap()))[0];
      await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2); await page.mouse.wheel(0, 240);
      await page.waitForFunction(previous => toolMap()[0] !== previous, zoom);
    }
    check('measuring the map changed no UV', (await page.evaluate(() => toolCanvas())).uv, boxed.after.uv);
    const [x0, y0] = screen(mapping, low), [x1, y1] = screen(mapping, high), selectKey = await page.evaluate(() => toolKey());
    await page.mouse.move(x0 - 4, y0 - 4); await page.mouse.down(); await page.mouse.move(x1 + 4, y1 + 4, { steps: 10 }); await page.mouse.up();
    const marked = await changedFrom(selectKey);
    ok('the marquee selects the left island only', marked.selected.length > 2 && marked.selected.length < marked.vertices.length / 2, { selected: marked.selected.length });
    const mirrored = await uvTool('Mirror Copy', c => uvTools.mirrorCopyUVCoordinates(geosetOf(c), c.selected, c.eligible, Float32Array.from(c.uv)), (before, after) => {
      const selected = new Set(before.selected), moved = before.uv.map((value, i) => value !== after.uv[i] ? Math.floor(i / 2) : -1).filter(i => i >= 0);
      ok('Mirror Copy: only unselected points take the copied UVs', moved.length > 0 && moved.every(i => !selected.has(i)), { moved: moved.length });
    });
    await undo('Mirror Copy', modelBoxed, mirrored.before);
    // Back to the start: the marquee and the Box Projection are undone too.
    for (let press = 0; press < 4 && await page.evaluate(() => toolModel()) !== modelStart; press++) {
      const current = await page.evaluate(() => toolKey());
      await page.keyboard.press('Control+z');
      await page.waitForFunction(previous => toolKey() !== previous, current, { timeout: 5000 }).catch(() => {});
    }
    await page.waitForFunction(expected => toolModel() === expected, modelStart, { timeout: 10000 });
    check('Ctrl+Z brings the original Footman back', (await page.evaluate(() => toolCanvas())).uv, start.uv);
    check('source model file unchanged', fs.readFileSync(fixture).equals(originalFile), true);
    check('no error screen', await page.locator('[data-error-boundary],.error-boundary').count(), 0);
    check('no page errors', errors, []);
    check('no console errors', consoleErrors, []);
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors, consoleErrors, fixture, bundle }, null, 2));
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
