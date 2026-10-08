const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = process.env.MDLXL_TEST_OUT || path.join(root, 'out/forge-toy-ui');
const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'out/forge-toy-native/MDLxL-win32-x64/MDLxL.exe');

function modelState() {
  const el = document.querySelector('[aria-label="3D model viewport"]'); let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
  let top = f; while (top.return) top = top.return;
  const stack = [[top.stateNode.current, null]]; while (stack.length) { let [node, owner] = stack.pop(); if (node.memoizedProps?.model?.Geosets) owner = node; if (node.stateNode === el) { f = owner; break; } for (let child = node.child; child; child = child.sibling) stack.push([child, owner]); }
  for (; f; f = f.return) if (f.memoizedProps?.model?.Geosets) return structuredClone(f.memoizedProps.model);
  throw Error('Model unavailable');
}
function previewState(request = {}) {
  const el = document.querySelector('.forge-primitives .forge-preview-canvas'); let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
  let top = f; while (top.return) top = top.return;
  const stack = [[top.stateNode.current, null]]; while (stack.length) { let [node, owner] = stack.pop(); if (node.memoizedProps?.meshEditing) owner = node; if (node.stateNode === el) { f = owner; break; } for (let child = node.child; child; child = child.sibling) stack.push([child, owner]); }
  for (; f; f = f.return) if (f.memoizedProps?.meshEditing) {
    let s; for (let h = f.memoizedState; h; h = h.next) if (h.memoizedState?.current?.renderer) s = h.memoizedState.current;
    const edit = f.memoizedProps.meshEditing, rect = s.renderer.domElement.getBoundingClientRect(), project = p => { const v = s.camera.position.clone().set(...p).project(s.camera); return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 }; };
    if (request.face || request.edge || request.center) {
      const shape = edit.shapes.find(shape => shape.id === request.shapeId) || edit.shapes[0];
      if (request.center) return project(shape.vertices.reduce((p, v) => p.map((n, a) => n + v[a] / shape.vertices.length), [0, 0, 0]));
      const face = shape.faces.find(face => face.vertices.every(id => Math.abs(shape.vertices[id][2] - Math.max(...shape.vertices.map(p => p[2]))) < .01));
      if (request.edge) {
        const edges = face.vertices.map((id, i) => [id, face.vertices[(i + 1) % face.vertices.length]]).sort((a, b) => a.reduce((n, id) => n + shape.vertices[id][1], 0) - b.reduce((n, id) => n + shape.vertices[id][1], 0)), ids = edges[0];
        return project(ids.reduce((p, id) => p.map((v, a) => v + shape.vertices[id][a] / 2), [0, 0, 0]));
      }
      const center = face.vertices.reduce((p, id) => p.map((v, a) => v + shape.vertices[id][a] / face.vertices.length), [0, 0, 0]);
      return { ...project(center), faceId: face.id, end: project(center.map((v, a) => v + (a === 2 ? 25 : 0))) };
    }
    return { projectedBounds: edit.shapes.map(shape => { const x = shape.vertices.map(p => project(p).x); return { min: Math.min(...x), max: Math.max(...x) }; }), shapes: structuredClone(edit.shapes), selection: edit.selection, mode: edit.mode, tool: edit.tool, camera: s.camera.position.toArray(), up: s.camera.up.toArray(), target: s.controls.target.toArray(), zoom: s.camera.zoom, colors: s.group.children.filter(o => o.isMesh).map(o => Array.from(o.geometry.attributes.color.array)), meshes: f.memoizedProps.geosets.map(g => ({ vertices: Array.from(g.Vertices), faces: Array.from(g.Faces), uv: Array.from(g.TVertices[0]) })) };
  }
  throw Error('Shape preview unavailable');
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const { THUMPER_TEXTURE } = await import('../src/forge-thumper.js');
  const fixture = path.join(out, 'fixture.mdx'); fs.writeFileSync(fixture, new Uint8Array(createDemoDocument().serialize('mdx')));
  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'), beforeHash = hash();
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, `profile-${Date.now()}`) }, timeout: 60000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await page.getByLabel('3D model viewport', { exact: true }).waitFor({ timeout: 60000 });
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.unmaximize(); win.setBounds({ x: 40, y: 40, width: 1280, height: 800 });  });
    const capture = async file => { const pixels = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG().toString('base64'))); fs.writeFileSync(file, Buffer.from(pixels, 'base64')); };
    const before = await page.evaluate(modelState), sidebar = await page.locator('.classic-sidebar').first().boundingBox();
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const open = async () => { await page.locator('[data-warmkey="forge"]').click(); await page.getByRole('tab', { name: 'Shape', exact: true }).click(); await page.getByRole('button', { name: 'Add shape', exact: true }).waitFor(); await settle(); };
    await open(); const dialog = page.getByRole('dialog', { name: 'Forge', exact: true });
    await capture(path.join(out, '01-create.png'));
    await dialog.getByLabel('Width', { exact: true }).fill('120'); await dialog.getByLabel('Height', { exact: true }).fill('80'); await dialog.getByLabel('Depth', { exact: true }).fill('80');
    await dialog.getByRole('button', { name: 'Add shape', exact: true }).click(); await settle();
    const added = await page.evaluate(previewState); assert.equal(added.shapes.length, 1); assert.deepEqual(added.selection['1'], ['shape']); assert.equal(added.mode, 'Shape'); assert.deepEqual(await page.evaluate(modelState), before);
    assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0);
    for (const name of ['Move', 'Scale', 'Rotate', 'Extrude', 'Inset']) assert.equal(await dialog.getByRole('button', { name, exact: true }).isEnabled(), true);
    const drag = async (point, dx, dy, modifiers = [], button = 'left') => { for (const key of modifiers) await page.keyboard.down(key); await page.mouse.move(point.x, point.y); await page.mouse.down({ button }); await page.mouse.move(point.x + dx, point.y + dy, { steps: 12 }); await page.mouse.up({ button }); for (const key of modifiers) await page.keyboard.up(key); await settle(); };
    const center = await page.evaluate(previewState, { center: true });
    await page.evaluate(() => { window.__forgeDragEvents = []; const canvas = document.querySelector('.forge-primitives canvas'); for (const type of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(type, e => { if (e.target === canvas) window.__forgeDragEvents.push([e.type, e.clientX, e.clientY, e.buttons]); }, true); });
    await drag(center, 40, 0); const movedCenter = await page.evaluate(previewState, { center: true });
    assert.ok(Math.abs(movedCenter.x - center.x - 40) < 1, `first drag follows the mouse: ${JSON.stringify({ center, movedCenter, events: await page.evaluate(() => window.__forgeDragEvents), camera: (await page.evaluate(previewState)).camera })}`); assert.ok(Math.abs(movedCenter.y - center.y) < 1);
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, added.shapes);
    await dialog.getByRole('button', { name: 'Face', exact: true }).click();
    let point = await page.evaluate(previewState, { face: true }); await page.mouse.click(point.x, point.y); await settle();
    assert.deepEqual((await page.evaluate(previewState)).selection['1'], [point.faceId]); assert.equal((await page.evaluate(previewState)).mode, 'Faces');
    await dialog.getByRole('button', { name: 'Inset', exact: true }).click(); await dialog.getByRole('button', { name: 'More inset', exact: true }).click(); await settle();
    const inset = await page.evaluate(previewState); assert.equal(inset.shapes[0].faces.length, 10);
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.equal((await page.evaluate(previewState)).shapes[0].faces.length, 6);
    await dialog.getByRole('button', { name: 'Redo', exact: true }).click(); await settle(); assert.equal((await page.evaluate(previewState)).shapes[0].faces.length, 10);
    await dialog.getByRole('button', { name: 'Extrude', exact: true }).click(); await settle();
    point = await page.evaluate(previewState, { face: true }); await drag(point, point.end.x - point.x, point.end.y - point.y);
    const extended = await page.evaluate(previewState); assert.ok(extended.shapes[0].faces.length > inset.shapes[0].faces.length, 'dragging a face creates extrusion geometry'); assert.ok(Math.max(...extended.shapes[0].vertices.map(p => p[2])) > Math.max(...inset.shapes[0].vertices.map(p => p[2])) + 20, 'dragging upward extrudes upward');
    await capture(path.join(out, '02-face-extrude.png'));
    point = await page.evaluate(previewState, { face: true });
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.end.x, point.end.y, { steps: 8 }); await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
    assert.deepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'Escape cancels an in-progress extrusion'); assert.ok(await dialog.isVisible());
    await page.keyboard.press('s'); await settle(); assert.equal((await page.evaluate(previewState)).tool, 'Scale');
    point = await page.evaluate(previewState, { face: true }); await drag(point, 25, -5);
    assert.notDeepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'direct drag scales a selected face'); await page.keyboard.press('Control+z'); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'one undo restores a complete scaling drag');
    await page.keyboard.press('r'); await settle(); assert.equal((await page.evaluate(previewState)).tool, 'Rotate'); await dialog.getByRole('button', { name: 'More rotate', exact: true }).click(); await settle(); assert.notDeepEqual((await page.evaluate(previewState)).shapes, extended.shapes); await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, extended.shapes);
    await dialog.getByRole('button', { name: 'Scale', exact: true }).click();
    const slider = await dialog.getByLabel('Shape adjustment').boundingBox(); await drag({ x: slider.x + slider.width / 2, y: slider.y + slider.height / 2 }, 15, 0);
    assert.notDeepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'slider changes the mesh live without Apply');
    const sliderEdit = (await page.evaluate(previewState)).shapes; await page.keyboard.press('Control+z'); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'undo works while the live slider has focus'); await page.keyboard.press('Control+y'); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, sliderEdit);
    const draftBeforeTab = await page.evaluate(previewState); await page.getByRole('tab', { name: 'Projector', exact: true }).click(); await page.getByRole('tab', { name: 'Shape', exact: true }).click(); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, draftBeforeTab.shapes, 'staged edits survive Forge mode switching');
    await dialog.getByRole('button', { name: 'Edge', exact: true }).click();
    const edge = await page.evaluate(previewState, { edge: true }); await page.mouse.click(edge.x, edge.y); await page.waitForFunction(() => document.querySelector('.forge-live-adjustment>span')?.textContent === 'Scale · edge'); await settle(); assert.equal((await page.evaluate(previewState)).mode, 'Edges'); assert.equal(Object.values((await page.evaluate(previewState)).selection).flat().length, 1, 'actual mouse picks an edge in Edge scope');
    const edgeBefore = (await page.evaluate(previewState)).shapes; await dialog.getByRole('button', { name: 'More scale', exact: true }).click(); await settle(); assert.notDeepEqual((await page.evaluate(previewState)).shapes, edgeBefore); await page.keyboard.press('Control+z'); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, edgeBefore);
    const canvas = await dialog.locator('canvas').boundingBox(), viewBefore = await page.evaluate(previewState);
    const orbitPoint = { x: canvas.x + canvas.width * .8, y: canvas.y + canvas.height * .8 };
    await drag(orbitPoint, 65, 0, ['Alt']); const horizontal = await page.evaluate(previewState), a = viewBefore.camera.map((v, i) => v - viewBefore.target[i]), b = horizontal.camera.map((v, i) => v - horizontal.target[i]);
    assert.ok(Math.abs(a[2] - b[2]) < .001, 'horizontal mouse orbit keeps height in the Z-up view'); assert.ok(a[0] * b[1] - a[1] * b[0] < 0, 'horizontal orbit follows MDLxL direction'); assert.deepEqual(horizontal.up, [0, 0, 1]);
    await drag(orbitPoint, 0, -30, ['Alt']); const vertical = await page.evaluate(previewState); assert.ok(vertical.camera[2] < horizontal.camera[2], 'vertical orbit uses the editor controller direction'); assert.deepEqual(vertical.shapes, viewBefore.shapes);
    await drag(orbitPoint, 20, 0, [], 'right'); assert.notDeepEqual((await page.evaluate(previewState)).target, vertical.target, 'right mouse uses the editor pan binding');
    await page.mouse.click(orbitPoint.x, orbitPoint.y, { button: 'middle' }); const middleBefore = await page.evaluate(previewState); await drag(orbitPoint, 20, 0); assert.notDeepEqual((await page.evaluate(previewState)).camera, middleBefore.camera, 'middle click enables left mouse rotation'); await page.mouse.click(orbitPoint.x, orbitPoint.y, { button: 'middle' });
    await dialog.getByRole('button', { name: 'Oblique', exact: true }).click(); await dialog.getByRole('button', { name: 'Commit', exact: true }).click(); await settle(); assert.deepEqual(await page.evaluate(modelState), before); assert.equal(await dialog.getByRole('button', { name: 'Extrude', exact: true }).isVisible(), true); assert.ok(Object.values((await page.evaluate(previewState)).selection).flat().length, 'Commit keeps editing ready');
    await dialog.getByText('Add a different shape', { exact: true }).click(); await dialog.getByRole('button', { name: 'ThumperXL', exact: true }).click(); await settle();
    const second = await page.evaluate(previewState); assert.equal(second.shapes.length, 2); assert.equal(second.mode, 'Shape');
    assert.ok(second.projectedBounds[1].min > second.projectedBounds[0].max, 'new shape starts visibly beside existing shapes in the current view');
    // Grab another whole shape directly, without a separate selection click.
    const secondCenter = await page.evaluate(previewState, { center: true, shapeId: 2 });
    await dialog.getByRole('button', { name: 'Edit Cube 1', exact: true }).click();
    await drag(secondCenter, -45, -20); const movedSecond = await page.evaluate(previewState);
    assert.deepEqual(movedSecond.shapes[0], second.shapes[0]); assert.notDeepEqual(movedSecond.shapes[1].vertices, second.shapes[1].vertices);
    const projectedSecond = await page.evaluate(previewState, { center: true, shapeId: 2 }); assert.ok(Math.abs(projectedSecond.x - secondCenter.x + 45) < 1); assert.ok(Math.abs(projectedSecond.y - secondCenter.y + 20) < 1);
    await dialog.getByRole('button', { name: 'Scale', exact: true }).click(); await dialog.getByRole('button', { name: 'Height', exact: true }).click(); await dialog.getByRole('button', { name: 'More scale', exact: true }).click(); await settle();
    const heightOnly = await page.evaluate(previewState); heightOnly.shapes[1].vertices.forEach((v, i) => { assert.equal(v[0], movedSecond.shapes[1].vertices[i][0]); assert.equal(v[1], movedSecond.shapes[1].vertices[i][1]); });
    assert.notDeepEqual(heightOnly.shapes[1].vertices, movedSecond.shapes[1].vertices);
    await dialog.getByRole('button', { name: 'Duplicate', exact: true }).click(); await settle(); assert.equal((await page.evaluate(previewState)).shapes.length, 3);
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click(); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, heightOnly.shapes);
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.equal((await page.evaluate(previewState)).shapes.length, 3);
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, heightOnly.shapes);
    await dialog.getByRole('button', { name: 'Side', exact: true }).click(); await dialog.getByRole('button', { name: 'Add shape', exact: true }).click(); await settle();
    const sideAdded = await page.evaluate(previewState); assert.equal(sideAdded.shapes.length, 3); assert.ok(sideAdded.projectedBounds[2].min > Math.max(...sideAdded.projectedBounds.slice(0, 2).map(b => b.max)), 'Side view also adds beside the assembly, not hidden behind it');
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Edit Cube 1', exact: true }).click(); await dialog.getByRole('button', { name: 'Edit ThumperXL 2', exact: true }).click({ modifiers: ['Shift'] });
    const grouped = (await page.evaluate(previewState)).shapes;
    await dialog.getByRole('button', { name: 'Duplicate', exact: true }).click(); await settle(); const groupedCopies = (await page.evaluate(previewState)).shapes.slice(2), offset = groupedCopies[0].vertices[0].map((n, a) => n - grouped[0].vertices[0][a]);
    groupedCopies.forEach((copy, i) => copy.vertices.forEach((v, j) => v.forEach((n, a) => assert.ok(Math.abs(n - grouped[i].vertices[j][a] - offset[a]) < 1e-6, 'group duplication preserves relative placement'))));
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Move', exact: true }).click(); await dialog.getByRole('button', { name: 'More move', exact: true }).click(); await settle();
    const ready = await page.evaluate(previewState); assert.equal(Object.values(ready.selection).filter(ids => ids.length).length, 2);
    await dialog.getByRole('button', { name: 'Commit', exact: true }).click(); await dialog.getByRole('button', { name: 'Edit Cube 1', exact: true }).click(); await dialog.getByRole('button', { name: 'Oblique', exact: true }).click(); point = await page.evaluate(previewState, { face: true }); await page.mouse.click(point.x, point.y); await settle(); await capture(path.join(out, '03-staged-shapes.png'));
    const staged = await page.evaluate(previewState); assert.notDeepEqual(staged.colors[0].slice(0, 3), staged.colors[1].slice(0, 3)); assert.deepEqual(await page.evaluate(modelState), before);
    const theme = await dialog.evaluate(el => { const color = selector => getComputedStyle(el.querySelector(selector)).backgroundColor; return { panel: getComputedStyle(el).backgroundColor, aside: color('.forge-primitives aside'), button: color('.forge-edit-tools button:not(.active)'), font: getComputedStyle(el).fontFamily, mainFont: getComputedStyle(document.body).fontFamily, radius: getComputedStyle(el).borderRadius }; });
    assert.equal(theme.font, theme.mainFont); assert.equal(theme.radius, '0px'); assert.equal(theme.panel, 'rgb(240, 240, 240)'); assert.equal(theme.aside, theme.panel); assert.equal(theme.button, theme.panel);
    await dialog.getByRole('button', { name: 'Add to model', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    const after = await page.evaluate(modelState); assert.equal(after.Geosets.length, before.Geosets.length + 2);
    for (let i = 0; i < before.Geosets.length; i++) for (const key of ['Vertices', 'Normals', 'TVertices', 'Faces', 'Groups', 'VertexGroup', 'MaterialID']) assert.deepEqual(after.Geosets[i][key], before.Geosets[i][key]);
    assert.equal(after.Textures[after.Materials[after.Geosets.at(-1).MaterialID].Layers[0].TextureID].Image, THUMPER_TEXTURE);
    for (const format of ['mdl', 'mdx']) {
      const destination = path.join(out, `edited-${Date.now()}.${format}`);
      await app.evaluate(({ dialog }, destination) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination }); }, destination);
      await page.keyboard.press('Control+Shift+s'); const saveButton = page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }); await saveButton.click(); await saveButton.waitFor({ state: 'detached' });
      for (let i = 0; i < 100 && !fs.existsSync(destination); i++) await new Promise(resolve => setTimeout(resolve, 100));
      const reopened = openDocument(fs.readFileSync(destination)); assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0); assert.equal(reopened.model.Geosets.length, after.Geosets.length);
      for (let i = before.Geosets.length; i < after.Geosets.length; i++) { assert.deepEqual(reopened.model.Geosets[i].Vertices, after.Geosets[i].Vertices); assert.deepEqual(reopened.model.Geosets[i].TVertices, after.Geosets[i].TVertices); }
    }
    await page.keyboard.press('Control+z'); const undone = await page.evaluate(modelState); assert.equal(undone.Geosets.length, before.Geosets.length);
    await open(); await dialog.getByRole('button', { name: 'Add shape', exact: true }).click(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await dialog.waitFor({ state: 'detached' }); assert.deepEqual(await page.evaluate(modelState), undone);
    assert.equal((await page.locator('.classic-sidebar').first().boundingBox()).width, sidebar.width); assert.equal(hash(), beforeHash); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ executable, fixtureSHA256: beforeHash, firstDragFollowsMouse: true, mouseFacePicking: true, mouseEdgePicking: true, liveSlider: true, inset: true, mouseExtrusion: true, mouseScale: true, rotate: true, horizontalAndVerticalOrbitDirection: true, editorPanAndMiddleToggle: true, theme, escapeCancelsDrag: true, draftSurvivesTabSwitch: true, commitKeepsControls: true, stagedCommitPreservesModel: true, twoShapes: true, secondShapeIndependentDrag: true, dimensionScaling: true, duplicateDeleteUndo: true, groupDuplicatePreservesPlacement: true, newShapeVisibleInSideView: true, mixedTextures: true, distinctShading: true, atomicAddAndUndo: true, cancel: true, mdlMdxSaveReopen: true, sidebarWidth: sidebar.width, rendererErrors: errors }, null, 2));
    console.log('PASS packaged Forge direct shape dragging, explicit whole/face/edge scope and independent second-shape movement, live slider, extrusion, scale, orbit direction, editor mouse bindings, classic theme, Commit, mixed shapes, atomic add/undo and MDL/MDX save/reopen.');
  } catch (e) { const page = await app.firstWindow(); fs.writeFileSync(path.join(out, 'failure.txt'), await page.locator('body').innerText()); fs.writeFileSync(path.join(out, 'failure.png'), Buffer.from(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG().toString('base64'))), 'base64')); throw e; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
