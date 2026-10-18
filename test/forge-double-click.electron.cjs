// Packaged integration: all edits use mouse/keyboard; runtime reads only assert results.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.MDLXL_TEST_OUT || path.join(root, 'out/forge-double-click');
const executable = process.env.MDLXL_TEST_EXE;
const existing = fs.readFileSync(path.join(root, 'test/forge-face-editing.electron.cjs'), 'utf8');
eval(existing.slice(existing.indexOf('function readView'), existing.indexOf('(async()=>{')));
function visibleFaces(state, index = 0) {
  const g = state.model.Geosets[index], points = state.points[index], faces = [];
  for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
    const values = Array.from(g.Vertices).filter((_, i) => i % 3 === axis), bound = side < 0 ? Math.min(...values) : Math.max(...values);
    if ((state.camera[axis] - bound) * side <= 0) continue;
    const p = points.filter((_, i) => Math.abs(values[i] - bound) < 1e-5);
    faces.push({ axis, side, x: p.reduce((sum, p) => sum + p.x, 0) / p.length, y: p.reduce((sum, p) => sum + p.y, 0) / p.length });
  }
  return faces;
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '0', MDLXL_PROFILE: path.join(out, 'profile') }, timeout: 60000 });
  let page; const checks = [], errors = [];
  const capture = async name => {
    await page.waitForTimeout(500);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage());
    await page.waitForTimeout(150);
    const b64 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i => i.toPNG().toString('base64')));
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(b64, 'base64'));
  };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await page.getByRole('button', { name: 'Forge', exact: true }).click();
    const d = page.getByRole('dialog', { name: 'Forge', exact: true });
    const click = async name => { await d.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(120); };
    const read = async () => { await page.waitForTimeout(150); return page.evaluate(readView); };
    const pick = async p => { await page.mouse.dblclick(p.x, p.y, { delay: 90 }); return read(); };
    const mode = state => state.modelingOverlay[0].mode;
    const face = state => { assert.equal(mode(state), 'Faces'); assert.equal(state.modelingOverlay[0].selectedFaceIndices.length, 6); assert.equal(state.editOverlays[0].faces, true); };
    await click('Cube');
    assert.equal(await d.getByRole('button', { name: 'Face', exact: true }).count(), 0);
    await page.keyboard.press('Alt+2');
    let state = await read(); assert.equal(mode(state), 'Shape');
    const original = state.model.Geosets;
    const targets = visibleFaces(state); assert.equal(targets.length, 3);
    assert.equal(state.tool, 'translate');
    state = await pick(targets[0]); face(state); assert.equal(state.tool, 'translate'); assert.deepEqual(state.model.Geosets, original);
    assert.equal(await d.locator('.forge-editor-status').innerText(), '1 faces selected');
    checks.push('Double-click in the initial Move tool selects exactly one visible face without changing geometry; Face button and Alt+2 removed');
    await capture('face-selected');
    const firstSelection = state.selection;
    await page.keyboard.down('Shift'); state = await pick(targets[1]); await page.keyboard.up('Shift');
    assert.equal(mode(state), 'Faces'); assert.equal(state.modelingOverlay[0].selectedFaceIndices.length, 12); assert.equal(state.tool, 'translate'); assert.deepEqual(state.model.Geosets, original);
    assert.equal(await d.locator('.forge-editor-status').innerText(), '2 faces selected');
    await page.keyboard.down('Shift'); state = await pick(targets[2]); await page.keyboard.up('Shift');
    assert.equal(state.modelingOverlay[0].selectedFaceIndices.length, 18); assert.deepEqual(state.model.Geosets, original);
    state = await pick(targets[0]); face(state); assert.deepEqual(state.selection, firstSelection);
    checks.push('Shift+double-click adds more faces; a plain double-click goes back to one face');
    await click('Move'); state = await pick(targets[1]); face(state); assert.notDeepEqual(state.selection, firstSelection); assert.deepEqual(state.model.Geosets, original);
    for (const button of ['Edge', 'Vertex', 'Shape']) { await click(button); state = await pick(targets[2]); face(state); assert.deepEqual(state.model.Geosets, original); }
    checks.push('Double-click switches directly from Shape, Edge, Vertex and Move to the chosen face');
    await click('Shape'); await click('Move');
    const target = targets[0];
    for (const clickCount of [1, 2]) {
      await page.mouse.move(target.x, target.y); await page.mouse.down({ clickCount });
      await page.mouse.move(target.x + 3, target.y + 2); await page.mouse.up({ clickCount });
    }
    state = await read(); face(state); assert.deepEqual(state.model.Geosets, original);
    checks.push('Small hand movement during a double-click does not nudge the shape');
    await click('Shape');
    await page.keyboard.down('Alt'); await pick(targets[0]); await page.keyboard.up('Alt');
    state = await read(); assert.equal(mode(state), 'Shape'); assert.deepEqual(state.model.Geosets, original);
    await click('Camera rotation'); await pick(targets[0]); state = await read(); assert.equal(mode(state), 'Shape');
    const beforeCamera = state.quaternion;
    await page.mouse.move(targets[0].x, targets[0].y); await page.mouse.down(); await page.mouse.move(targets[0].x + 60, targets[0].y + 30, { steps: 10 }); await page.mouse.up();
    state = await read(); assert.notDeepEqual(state.quaternion, beforeCamera); assert.deepEqual(state.model.Geosets, original);
    await click('Work mode');
    const empty = { x: state.rect.x + 15, y: state.rect.y + 15 };
    state = await pick(empty); assert.equal(mode(state), 'Shape'); assert.deepEqual(state.model.Geosets, original);
    checks.push('Empty space and camera double-clicks do not enter Face mode; real mouse rotation still works');
    await click('Edit Cube 1'); await click('Move'); state = await read();
    const beforeDrag = state.model.Geosets, start = visibleFaces(state)[0];
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 35, start.y, { steps: 8 }); await page.mouse.up();
    state = await read(); assert.equal(mode(state), 'Shape'); assert.notDeepEqual(state.model.Geosets, beforeDrag);
    await click('Undo'); assert.deepEqual((await read()).model.Geosets, beforeDrag);
    checks.push('Normal drag still moves the piece and Undo restores it');
    await click('Add shape'); await click('Cube'); state = await read(); const twoShapes = state.model.Geosets;
    const firstFace = visibleFaces(state, 0)[0]; state = await pick(firstFace);
    face(state); assert.ok(state.selection[0].length); assert.equal(state.selection[1].length, 0); assert.deepEqual(state.model.Geosets, twoShapes);
    await click('Extrude'); await page.mouse.move(firstFace.x, firstFace.y); await page.mouse.down(); await page.mouse.move(firstFace.x + 45, firstFace.y - 15, { steps: 8 }); await page.mouse.up(); state = await read(); assert.ok(state.model.Geosets[0].Faces.length > twoShapes[0].Faces.length); assert.deepEqual(state.model.Geosets[1], twoShapes[1]);
    await click('Undo'); assert.deepEqual((await read()).model.Geosets, twoShapes);
    checks.push('Picking another piece selects its visible face; Extrude and Undo operate only on that piece');
    state = await read(); const otherFace = visibleFaces(state, 1)[1]; await click('Select');
    await page.keyboard.down('Shift'); await page.mouse.click(otherFace.x, otherFace.y); await page.keyboard.up('Shift');
    state = await read(); assert.ok(state.selection[0].length && state.selection[1].length);
    await page.keyboard.press('e'); await page.mouse.move(firstFace.x, firstFace.y); await page.mouse.down(); await page.mouse.move(firstFace.x + 45, firstFace.y - 15, { steps: 8 }); await page.mouse.up(); state = await read();
    const extent = (mesh, axis) => { const values = Array.from(mesh.Vertices).filter((_, i) => i % 3 === axis); return Math.max(...values) - Math.min(...values); };
    assert.ok(extent(state.model.Geosets[0], 0) > extent(twoShapes[0], 0));
    assert.equal(extent(state.model.Geosets[0], 2), extent(twoShapes[0], 2));
    for (let axis = 0; axis < 3; axis++) {
      if (axis === otherFace.axis) assert.ok(extent(state.model.Geosets[1], axis) > extent(twoShapes[1], axis));
      else assert.equal(extent(state.model.Geosets[1], axis), extent(twoShapes[1], axis));
    }
    await click('Undo'); assert.deepEqual((await read()).model.Geosets, twoShapes);
    checks.push('Existing multi-shape selection keeps each shape extending along its own selected-face normal');
    await click('Cancel'); await page.getByRole('button', { name: 'Forge', exact: true }).click(); await click('Cube');
    state = await read(); const topFace = visibleFaces(state)[2]; state = await pick(topFace);
    const base = state.model.Geosets;
    const maxZ = model => Math.max(...Array.from(model[0].Vertices).filter((_, i) => i % 3 === 2));
    await page.keyboard.press('e'); state = await read(); assert.deepEqual(state.model.Geosets, base);
    assert.equal(await d.getByRole('button', { name: 'Extrude', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.mouse.move(topFace.x, topFace.y); await page.mouse.down();
    assert.deepEqual((await read()).model.Geosets, base);
    await page.mouse.move(topFace.x, topFace.y - 25, { steps: 5 });
    const half = await read(); assert.equal(half.model.Geosets[0].Faces.length, base[0].Faces.length + 24); assert.ok(maxZ(half.model.Geosets) > maxZ(base));
    await page.mouse.move(topFace.x, topFace.y - 50, { steps: 5 });
    const full = await read(); assert.ok(Math.abs((maxZ(full.model.Geosets) - maxZ(base)) / (maxZ(half.model.Geosets) - maxZ(base)) - 2) < 1e-4);
    await page.mouse.up(); state = await read(); assert.deepEqual(state.model.Geosets, full.model.Geosets); assert.equal(state.tool, 'translate');
    assert.equal(await d.getByRole('button', { name: 'Extrude', exact: true }).getAttribute('aria-pressed'), 'false');
    await capture('extrusion-released');
    await page.mouse.move(topFace.x, topFace.y - 50); await page.mouse.down(); await page.mouse.move(topFace.x + 30, topFace.y - 50, { steps: 6 }); await page.mouse.up();
    state = await read(); assert.equal(state.model.Geosets[0].Faces.length, full.model.Geosets[0].Faces.length); assert.notDeepEqual(state.model.Geosets, full.model.Geosets);
    await click('Undo'); assert.deepEqual((await read()).model.Geosets, full.model.Geosets);
    await click('Undo'); assert.deepEqual((await read()).model.Geosets, base);
    await click('Redo'); assert.deepEqual((await read()).model.Geosets, full.model.Geosets); await click('Undo');
    checks.push('E and mouse-down start at zero; drag previews proportional outward extrusion; release returns to Move and one Undo removes the extension');
    await page.keyboard.press('e'); await page.keyboard.press('Escape'); state = await read(); assert.deepEqual(state.model.Geosets, base); assert.ok(state.selection[0].length);
    assert.equal(await d.getByRole('button', { name: 'Extrude', exact: true }).getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('e'); await page.mouse.move(topFace.x, topFace.y); await page.mouse.down(); await page.mouse.move(topFace.x, topFace.y - 35, { steps: 6 });
    assert.ok((await read()).model.Geosets[0].Faces.length > base[0].Faces.length);
    await page.keyboard.press('Escape'); await page.mouse.up(); state = await read(); assert.deepEqual(state.model.Geosets, base); assert.equal(state.tool, 'translate');
    await page.keyboard.press('e'); await page.mouse.click(topFace.x, topFace.y); assert.deepEqual((await read()).model.Geosets, base);
    checks.push('Escape cancels both armed and previewed extrusion; a click without dragging adds no geometry');
    await page.keyboard.press('e'); await click('Select'); assert.equal((await read()).tool, 'select');
    assert.equal(await d.getByRole('button', { name: 'Extrude', exact: true }).getAttribute('aria-pressed'), 'false');
    await pick(topFace); await page.keyboard.press('e'); await page.mouse.move(topFace.x, topFace.y); await page.mouse.down(); await page.mouse.move(topFace.x, topFace.y - 35, { steps: 5 }); await page.mouse.move(topFace.x, topFace.y, { steps: 5 }); await page.mouse.up();
    assert.deepEqual((await read()).model.Geosets, base);
    checks.push('Choosing another tool cancels armed extrusion; dragging back to zero leaves no extra faces');
    await page.keyboard.press('e'); state = await pick(visibleFaces(await read())[0]);
    assert.equal(state.tool, 'translate'); assert.deepEqual(state.model.Geosets, base);
    assert.equal(await d.getByRole('button', { name: 'Extrude', exact: true }).getAttribute('aria-pressed'), 'false');
    checks.push('Double-clicking another face cancels pending extrusion and leaves Move ready');
    await click('Quad View');
    const top = await d.getByLabel('Top viewport', { exact: true }).boundingBox();
    state = await pick({ x: top.x + top.width / 2, y: top.y + top.height / 2 }); face(state);
    checks.push('Double-click also selects a face in the active Quad View pane');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ pass: true, executable, checks, rendererErrors: errors }, null, 2));
    console.log(JSON.stringify({ pass: true, checks }, null, 2));
  } catch (error) { if (page) await capture('failure'); throw error; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
