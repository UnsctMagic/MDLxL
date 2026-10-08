const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/forge-face-ui');
const executable = path.join(root, 'out/forge-face-native/MDLxL-win32-x64/MDLxL.exe');

function modelState() {
  const el = document.querySelector('[aria-label="3D model viewport"]'); let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
  let top = f; while (top.return) top = top.return; if (top.stateNode?.current !== top && f.alternate) f = f.alternate;
  for (; f; f = f.return) if (f.memoizedProps?.model?.Geosets) return structuredClone(f.memoizedProps.model);
  throw Error('Model unavailable');
}
function previewState(request = {}) {
  const el = document.querySelector('.forge-primitives .forge-preview-canvas'); let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
  let top = f; while (top.return) top = top.return; if (top.stateNode?.current !== top && f.alternate) f = f.alternate;
  for (; f; f = f.return) if (f.memoizedProps?.meshEditing) {
    let s; for (let h = f.memoizedState; h; h = h.next) if (h.memoizedState?.current?.renderer) s = h.memoizedState.current;
    const edit = f.memoizedProps.meshEditing, rect = s.renderer.domElement.getBoundingClientRect(), project = p => { const v = s.camera.position.clone().set(...p).project(s.camera); return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 }; };
    if (request.face || request.edge) { const shape = edit.shapes.find(s => s.id === request.shapeId) || edit.shapes[0], face = shape.faces.filter(f => f.vertices.every(id => Math.abs(shape.vertices[id][2] - Math.max(...shape.vertices.map(p => p[2]))) < .01))[0]; if (request.edge) { const edges = face.vertices.map((id, i) => [id, face.vertices[(i + 1) % face.vertices.length]]).sort((a, b) => b.reduce((n, id) => n + shape.vertices[id][1], 0) - a.reduce((n, id) => n + shape.vertices[id][1], 0)), ids = edges[0]; return project(ids.reduce((p, id) => p.map((v, a) => v + shape.vertices[id][a] / 2), [0, 0, 0])); } return { ...project(face.vertices.reduce((p, id) => p.map((v, a) => v + shape.vertices[id][a] / face.vertices.length), [0, 0, 0])), faceId: face.id }; }
    if (request.handle) {
      const objects = s.gizmo._gizmo.gizmo[s.gizmo.mode].children.filter(o => o.name === request.handle && o.geometry);
      const positions = objects.map(o => { o.geometry.computeBoundingBox(); const p = o.geometry.boundingBox.getCenter(s.camera.position.clone()).applyMatrix4(o.matrixWorld), next = p.clone(); next.setComponent(['X', 'Y', 'Z'].indexOf(request.handle), next.getComponent(['X', 'Y', 'Z'].indexOf(request.handle)) + 25); return { ...project(p.toArray()), end: project(next.toArray()), world: p.toArray() }; });
      return positions.sort((a, b) => b.world[['X', 'Y', 'Z'].indexOf(request.handle)] - a.world[['X', 'Y', 'Z'].indexOf(request.handle)])[0];
    }
    return { shapes: structuredClone(edit.shapes), selection: edit.selection, mode: edit.mode, tool: edit.tool, camera: s.camera.position.toArray(), target: s.controls.target.toArray(), colors: s.group.children.filter(o => o.isMesh).map(o => Array.from(o.geometry.attributes.color.array)), meshes: f.memoizedProps.geosets.map(g => ({ vertices: Array.from(g.Vertices), faces: Array.from(g.Faces), uv: Array.from(g.TVertices[0]) })) };
  }
  throw Error('Shape preview unavailable');
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const { THUMPER_TEXTURE } = await import('../src/forge-thumper.js');
  const fixture = path.join(out, 'fixture.mdx'); fs.writeFileSync(fixture, new Uint8Array(createDemoDocument().serialize('mdx')));
  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'), beforeHash = hash();
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, `profile-${Date.now()}`) }, timeout: 60000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await page.getByLabel('3D model viewport', { exact: true }).waitFor({ timeout: 60000 });
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.unmaximize(); win.setBounds({ x: 40, y: 40, width: 1280, height: 800 }); win.showInactive(); });
    const before = await page.evaluate(modelState), sidebar = await page.locator('.classic-sidebar').first().boundingBox();
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const open = async () => { await page.locator('[data-warmkey="forge"]').click(); await page.getByRole('tab', { name: 'Shape', exact: true }).click(); await page.getByRole('button', { name: 'Add shape', exact: true }).waitFor(); await settle(); };
    await open(); const dialog = page.getByRole('dialog', { name: 'Forge', exact: true });
    await page.screenshot({ path: path.join(out, '01-create.png') });
    await dialog.getByLabel('Width', { exact: true }).fill('120'); await dialog.getByLabel('Height', { exact: true }).fill('80'); await dialog.getByLabel('Depth', { exact: true }).fill('10');
    await dialog.getByRole('button', { name: 'Add shape', exact: true }).click(); await settle();
    assert.equal((await page.evaluate(previewState)).shapes.length, 1); assert.deepEqual(await page.evaluate(modelState), before);
    let point = await page.evaluate(previewState, { face: true }); await page.mouse.click(point.x, point.y); await settle();
    assert.deepEqual((await page.evaluate(previewState)).selection['1'], [point.faceId]);
    await dialog.getByRole('button', { name: 'Inset', exact: true }).click(); await dialog.getByLabel('Shape edit amount').fill('5'); await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await settle();
    const inset = await page.evaluate(previewState); assert.equal(inset.shapes[0].faces.length, 10);
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.equal((await page.evaluate(previewState)).shapes[0].faces.length, 6);
    await dialog.getByRole('button', { name: 'Redo', exact: true }).click(); await settle(); assert.equal((await page.evaluate(previewState)).shapes[0].faces.length, 10);
    await dialog.getByRole('button', { name: 'Extrude', exact: true }).click(); await settle();
    const handle = await page.evaluate(previewState, { handle: 'Z' });
    await page.mouse.move(handle.x, handle.y); await page.mouse.down(); await page.mouse.move(handle.end.x, handle.end.y, { steps: 12 }); await page.mouse.up(); await settle();
    const extended = await page.evaluate(previewState); assert.ok(extended.shapes[0].faces.length > inset.shapes[0].faces.length, 'mouse handle creates geometry'); assert.ok(Math.max(...extended.shapes[0].vertices.map(p => p[2])) > 10);
    await page.screenshot({ path: path.join(out, '02-face-extrude.png') });
    const cancelHandle = await page.evaluate(previewState, { handle: 'Z' });
    await page.mouse.move(cancelHandle.x, cancelHandle.y); await page.mouse.down(); await page.mouse.move(cancelHandle.end.x, cancelHandle.end.y, { steps: 8 }); await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
    assert.deepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'Escape cancels an in-progress extrusion'); assert.ok(await dialog.isVisible());
    await page.keyboard.press('s'); await settle(); assert.equal((await page.evaluate(previewState)).tool, 'Scale');
    const scaleHandle = await page.evaluate(previewState, { handle: 'X' });
    await page.mouse.move(scaleHandle.x, scaleHandle.y); await page.mouse.down(); await page.mouse.move(scaleHandle.end.x, scaleHandle.end.y, { steps: 8 }); await page.mouse.up(); await settle();
    assert.notDeepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'mouse handle scales a selected face'); await page.keyboard.press('Control+z'); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, extended.shapes, 'one undo restores a complete scaling drag');
    await page.keyboard.press('r'); await settle(); assert.equal((await page.evaluate(previewState)).tool, 'Rotate'); await dialog.getByLabel('Shape edit amount').fill('15'); await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await settle(); assert.notDeepEqual((await page.evaluate(previewState)).shapes, extended.shapes); await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, extended.shapes);
    await dialog.getByRole('button', { name: 'Scale', exact: true }).click(); await dialog.getByRole('group', { name: 'Transform axis' }).getByRole('button', { name: 'X', exact: true }).click(); await dialog.getByLabel('Shape edit amount').fill('70'); await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await settle();
    const draftBeforeTab = await page.evaluate(previewState); await page.getByRole('tab', { name: 'Projector', exact: true }).click(); await page.getByRole('tab', { name: 'Shape', exact: true }).click(); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, draftBeforeTab.shapes, 'staged edits survive Forge mode switching');
    await dialog.getByRole('button', { name: 'Edges', exact: true }).click(); await settle(); const edge = await page.evaluate(previewState, { edge: true }); await page.mouse.click(edge.x, edge.y); await settle(); assert.equal(Object.values((await page.evaluate(previewState)).selection).flat().length, 1, 'actual mouse picks an edge');
    const edgeBefore = (await page.evaluate(previewState)).shapes; await dialog.getByLabel('Shape edit amount').fill('5'); await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await settle(); assert.notDeepEqual((await page.evaluate(previewState)).shapes, edgeBefore); await page.keyboard.press('Control+z'); await settle(); assert.deepEqual((await page.evaluate(previewState)).shapes, edgeBefore);
    const canvas = await dialog.locator('canvas').boundingBox(), viewBefore = await page.evaluate(previewState);
    await page.mouse.move(canvas.x + canvas.width * .8, canvas.y + canvas.height * .8); await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width * .8 + 65, canvas.y + canvas.height * .8 - 30, { steps: 12 }); await page.mouse.up(); await settle();
    assert.notDeepEqual((await page.evaluate(previewState)).camera, viewBefore.camera, 'actual mouse drag rotates camera');
    await dialog.getByRole('button', { name: 'Commit', exact: true }).click(); await settle(); assert.deepEqual(await page.evaluate(modelState), before);
    await dialog.getByRole('button', { name: 'Add shape', exact: true }).click(); await dialog.getByRole('button', { name: 'ThumperXL', exact: true }).click(); await dialog.getByText('Placement', { exact: true }).click(); await dialog.getByLabel('Shape position X').fill('140'); await dialog.getByRole('button', { name: 'Add shape', exact: true }).click(); await settle();
    assert.equal((await page.evaluate(previewState)).shapes.length, 2);
    await dialog.getByRole('button', { name: 'Edit Cube 1', exact: true }).click(); await dialog.getByRole('button', { name: 'Edit ThumperXL 2', exact: true }).click({ modifiers: ['Shift'] });
    await dialog.getByRole('button', { name: 'Move', exact: true }).click(); await dialog.getByLabel('Shape edit amount').fill('10'); await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await settle();
    const ready = await page.evaluate(previewState); assert.equal(Object.values(ready.selection).filter(ids => ids.length).length, 2);
    await dialog.getByRole('button', { name: 'Commit', exact: true }).click(); await dialog.getByRole('button', { name: 'Oblique', exact: true }).click(); await page.screenshot({ path: path.join(out, '03-staged-shapes.png') });
    const staged = await page.evaluate(previewState); assert.notDeepEqual(staged.colors[0].slice(0, 3), staged.colors[1].slice(0, 3)); assert.deepEqual(await page.evaluate(modelState), before);
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
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ executable, fixtureSHA256: beforeHash, mouseFacePicking: true, mouseEdgePicking: true, inset: true, mouseExtrusion: true, mouseScale: true, rotate: true, mouseOrbit: true, escapeCancelsDrag: true, draftSurvivesTabSwitch: true, stagedCommitPreservesModel: true, twoShapes: true, mixedTextures: true, distinctShading: true, atomicAddAndUndo: true, cancel: true, mdlMdxSaveReopen: true, sidebarWidth: sidebar.width, rendererErrors: errors }, null, 2));
    console.log('PASS packaged Forge face picking, inset, mouse extrusion, scaling, mouse rotation, shaded staging, multi-shape edits, mixed textures, one-step add/undo, Cancel and MDL/MDX save/reopen.');
  } catch (e) { const page = await app.firstWindow(); fs.writeFileSync(path.join(out, 'failure.txt'), await page.locator('body').innerText()); await page.screenshot({ path: path.join(out, 'failure.png') }); throw e; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
