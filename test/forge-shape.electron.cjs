// Uses an isolated packaged executable and generated fixture; no personal profile or model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/forge-shape-v2-review');
const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'out/forge-shape-v2-native/MDLxL-win32-x64/MDLxL.exe');
const setRange = (locator, value) => locator.evaluate((element, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(value)); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }, value);
const viewportModel = () => {
  const el = document.querySelector('[aria-label="3D model viewport"]'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; let top = fiber; while (top.return) top = top.return; if (top.stateNode?.current !== top && fiber.alternate) fiber = fiber.alternate;
  for (; fiber; fiber = fiber.return) { const model = fiber.memoizedProps?.model; if (model?.Geosets) return model.Geosets.map(g => ({ vertices: Array.from(g.Vertices), faces: Array.from(g.Faces), uv: g.TVertices.map(uv => Array.from(uv)), groups: g.Groups, material: g.MaterialID })); }
  throw Error('Viewport model unavailable');
};
const previewModel = () => {
  const el = document.querySelector('.forge-shape-dialog .forge-preview-canvas'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; let top = fiber; while (top.return) top = top.return; if (top.stateNode?.current !== top && fiber.alternate) fiber = fiber.alternate;
  for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.geosets) return fiber.memoizedProps.geosets.map(g => Array.from(g.Vertices));
  throw Error('Preview unavailable');
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js'), { buildForgePrimitive, FORGE_SHAPES, FLAT_FORGE_SHAPES } = await import('../src/forge-primitives.js'), { commitForge, encodeForgeTga } = await import('../src/forge.js');
  const doc = createDemoDocument(), mesh = buildForgePrimitive({ shape: 'Grid', width: 100, height: 100, complexity: 2 });
  const shieldResult = doc.apply('Shield fixture', [], model => commitForge(model, mesh, { texturePath: 'Textures\\white.blp' })), shieldGi = shieldResult.geosetIndices[0];
  const coarse = structuredClone(mesh), coarseG = coarse.geosets[0]; coarseG.Vertices = new Float32Array([-50,-50,0,50,-50,0,50,50,0,-50,50,0]); coarseG.Normals = new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]); coarseG.TVertices = [new Float32Array([0,0,1,0,1,1,0,1])]; coarseG.Faces = new Uint16Array([0,1,2,0,2,3]);
  const coarseGi = doc.apply('Coarse shield fixture', [], model => commitForge(model, coarse, { texturePath: 'Textures\\white.blp' })).geosetIndices[0];
  const fixture = path.join(out, 'shield.mdx'); fs.writeFileSync(fixture, new Uint8Array(doc.serialize('mdx'))); const hash = () => crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'), beforeHash = hash();
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, `profile-${Date.now()}`) }, timeout: 60000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await page.getByLabel(`Select geoset ${shieldGi}`, { exact: true }).waitFor({ timeout: 60000 });
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.unmaximize(); win.setBounds({ x: 40, y: 40, width: 1280, height: 800 }); win.showInactive(); });
    await page.getByLabel('3D model viewport', { exact: true }).waitFor(); await page.waitForFunction(() => !!document.querySelector('[aria-label="3D model viewport"]'));
    const original = await page.evaluate(viewportModel), sidebar = await page.locator('.classic-sidebar').first().boundingBox();
    await page.screenshot({ path: path.join(out, '01-default.png') });
    await page.locator('[data-warmkey="forge"]').click();
    await page.getByRole('tab', { name: 'Projector', exact: true }).waitFor(); assert.equal(await page.locator('.forge-modes').getByRole('tab').count(), 2); assert.equal(await page.getByRole('tab', { name: 'Projector', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Pick geoset', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Texture library', exact: true }).click(); await page.getByRole('dialog', { name: 'Material and Texture Library' }).waitFor(); await page.getByLabel('Close texture library').click();
    const pcImage = path.join(out, 'projector.tga'); fs.writeFileSync(pcImage, encodeForgeTga({ width: 8, height: 8, data: new Uint8Array(8 * 8 * 4).fill(255) }));
    await page.locator('.forge-source input[type=file]').setInputFiles(pcImage); await page.getByRole('button', { name: 'FORGE', exact: true }).waitFor(); await page.waitForFunction(() => !document.querySelector('.forge-dialog footer .forge-primary').disabled);
    await page.screenshot({ path: path.join(out, '02-projector.png') }); const projectorCounts = await page.locator('.forge-mesh .forge-counts').innerText();
    await page.getByRole('tab', { name: 'Shape', exact: true }).click(); console.log('Forge shape controls opened');
    assert.equal(await page.getByRole('button', { name: 'Load from PC', exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: 'Texture library', exact: true }).count(), 0);
    assert.deepEqual(await page.getByRole('combobox', { name: 'Shape', exact: true }).locator('option').allTextContents(), FORGE_SHAPES);
    let maxTriangles = 0;
    for (const shape of FORGE_SHAPES) {
      await page.getByRole('combobox', { name: 'Shape', exact: true }).selectOption(shape);
      if (shape === 'Plane') { assert.equal(await page.getByLabel('Shape complexity').count(), 0); continue; }
      await setRange(page.getByLabel('Shape complexity'), 1); const low = await page.locator('.forge-primitives .forge-counts').innerText();
      await setRange(page.getByLabel('Shape complexity'), 4); const high = await page.locator('.forge-primitives .forge-counts').innerText(); assert.notEqual(low, high, shape);
      const triangles = Number(high.match(/· (\d+) triangles/)[1]); assert.ok(triangles < 800); maxTriangles = Math.max(maxTriangles, triangles);
      if (shape === 'Monkey') { await page.getByLabel('Wireframe', { exact: true }).uncheck(); await page.screenshot({ path: path.join(out, '03-monkey.png') }); await page.getByLabel('Wireframe', { exact: true }).check(); }
    }
    await page.getByRole('tab', { name: 'Projector', exact: true }).click(); assert.equal(await page.locator('.forge-mesh .forge-counts').innerText(), projectorCounts, 'Projector draft survives mode switching');
    await page.getByRole('button', { name: 'FORGE', exact: true }).click(); await page.locator('.forge-dialog').waitFor({ state: 'detached' }); assert.equal((await page.evaluate(viewportModel)).length, original.length + 1);
    await page.keyboard.press('Control+z'); assert.deepEqual(await page.evaluate(viewportModel), original, 'Projector retains one-step undo');
    for (const shape of FLAT_FORGE_SHAPES) {
      await page.locator('[data-warmkey="forge"]').click(); await page.getByRole('tab', { name: 'Shape', exact: true }).click(); await page.getByLabel('Shape', { exact: true }).selectOption(shape);
      await page.getByLabel('Shape thickness').fill('10');
      assert.equal(await page.getByLabel('Depth', { exact: true }).count(), 0); assert.deepEqual(await page.evaluate(viewportModel), original);
      await page.getByRole('button', { name: 'Add shape', exact: true }).click(); await page.locator('.forge-dialog').waitFor({ state: 'detached' });
      const thick = (await page.evaluate(viewportModel)).at(-1), z = thick.vertices.filter((_, i) => i % 3 === 2); assert.ok(Math.abs(Math.min(...z) + 5) < 1e-5 && Math.abs(Math.max(...z) - 5) < 1e-5, `${shape} thickness commits`);
      await page.keyboard.press('Control+z'); assert.deepEqual(await page.evaluate(viewportModel), original, `${shape} thickness undoes together`);
    }
    await page.locator('[data-warmkey="forge"]').click(); await page.getByRole('tab', { name: 'Shape', exact: true }).click();
    await page.getByLabel('Shape', { exact: true }).selectOption('Grid'); await page.getByLabel('Width', { exact: true }).fill('60'); await page.getByLabel('Height', { exact: true }).fill('100'); await page.getByLabel('Shape thickness').fill('10');
    await page.getByLabel('Checker', { exact: true }).check(); await page.screenshot({ path: path.join(out, '04-grid-thickness.png') });
    assert.deepEqual(await page.evaluate(viewportModel), original, 'preview cannot modify the model');
    await page.getByRole('button', { name: 'Add shape', exact: true }).click(); await page.locator('.forge-dialog').waitFor({ state: 'detached' });
    console.log('Forge Add shape applied'); const added = await page.evaluate(viewportModel); assert.equal(added.length, original.length + 1); assert.ok(added.at(-1).uv[0].length); assert.ok(added.at(-1).groups.length);
    const saved = path.join(out, 'shapes-saved.mdx');
    await app.evaluate(({ dialog }, saved) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved }); }, saved);
    await page.keyboard.press('Control+Shift+s'); const saveButton = page.getByRole('button', { name: 'Save MDX…', exact: true }); await saveButton.click(); await saveButton.waitFor({ state: 'detached' });
    assert.ok(fs.existsSync(saved), 'native Save As creates the model'); const reopened = openDocument(fs.readFileSync(saved)); assert.equal(reopened.model.Geosets.length, added.length); assert.deepEqual(Array.from(reopened.model.Geosets.at(-1).Vertices), added.at(-1).vertices);
    assert.ok(fs.existsSync(path.join(out, 'MDLxL_Forge/mdlxl-shape-white-v1.tga')), 'the generated shape texture is saved beside the model');
    await page.keyboard.press('Control+z'); assert.deepEqual(await page.evaluate(viewportModel), original, 'Add shape is one undo step');
    await page.locator('[data-warmkey="geosetsClear"]').click(); await page.getByLabel(`Select geoset ${shieldGi}`, { exact: true }).check();
    const shapeCommand = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'shape:bend'));
    await shapeCommand(); const dialog = page.getByRole('dialog', { name: 'Shape geosets' }); await dialog.waitFor();
    await dialog.getByLabel('Length axis').selectOption('0'); await dialog.getByLabel('Toward').selectOption('2'); await dialog.getByLabel('Affect', { exact: true }).selectOption('all'); await dialog.getByLabel('Bend style').selectOption('fold'); await setRange(dialog.getByLabel('Shaping amount'), 90);
    console.log('Middle fold preview ready'); const folded = await page.evaluate(previewModel); assert.equal(folded[0].length, mesh.geosets[0].Vertices.length, 'test must target the shield, not a demo part'); assert.notDeepEqual(folded[0], original[shieldGi].vertices); assert.deepEqual(await page.evaluate(viewportModel), original);
    await dialog.getByRole('button', { name: 'Oblique', exact: true }).click(); await page.screenshot({ path: path.join(out, '03-shield-middle-fold.png') });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.deepEqual(await page.evaluate(viewportModel), original);
    await shapeCommand(); await dialog.waitFor(); await dialog.getByLabel('Length axis').selectOption('0'); await dialog.getByLabel('Toward').selectOption('2'); await dialog.getByLabel('Affect', { exact: true }).selectOption('all');
    await dialog.getByRole('button', { name: 'Pick center', exact: true }).click();
    const point = await page.evaluate(() => {
      const el = document.querySelector('.forge-shape-dialog .forge-preview-canvas'); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; let top = fiber; while (top.return) top = top.return; if (top.stateNode?.current !== top && fiber.alternate) fiber = fiber.alternate;
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) { const s = hook.memoizedState?.current; if (s?.camera && s?.renderer) { const p = s.camera.position.clone().set(0, 0, 0).project(s.camera), rect = s.renderer.domElement.getBoundingClientRect(); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 }; } }
      throw Error('Preview camera unavailable');
    });
    await page.mouse.click(point.x, point.y); await dialog.locator('.forge-pick-actions span').filter({ hasText: '1 selected' }).waitFor();
    await page.keyboard.down('Shift'); await page.mouse.click(point.x, point.y); await page.keyboard.up('Shift'); await dialog.locator('.forge-pick-actions span').filter({ hasText: '0 selected' }).waitFor(); await page.mouse.click(point.x, point.y);
    await dialog.getByRole('button', { name: 'Done picking' }).click(); await dialog.getByLabel('Center', { exact: true }).selectOption('selected'); await dialog.getByLabel('Bend style').selectOption('fold'); await setRange(dialog.getByLabel('Shaping amount'), 90);
    await page.waitForFunction(() => document.querySelector('.forge-shape-dialog input[type=number]').value === '90'); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const expected = await page.evaluate(previewModel); assert.notDeepEqual(expected[0], original[shieldGi].vertices, 'selected-center preview must be bent'); await page.screenshot({ path: path.join(out, '04-picked-fold.png') });
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    const applied = await page.evaluate(viewportModel); assert.deepEqual(applied[shieldGi].vertices, expected[0]); assert.deepEqual(applied[0], original[0]); assert.deepEqual(applied[shieldGi].uv, original[shieldGi].uv); assert.deepEqual(applied[shieldGi].faces, original[shieldGi].faces); assert.deepEqual(applied[shieldGi].groups, original[shieldGi].groups);
    await page.keyboard.press('Control+z'); assert.deepEqual(await page.evaluate(viewportModel), original);
    await page.locator('[data-warmkey="geosetsClear"]').click(); await page.getByLabel(`Select geoset ${coarseGi}`, { exact: true }).check(); await shapeCommand(); await dialog.waitFor();
    await dialog.getByLabel('Affect', { exact: true }).selectOption('all'); await dialog.getByLabel('Bend style').selectOption('fold'); await setRange(dialog.getByLabel('Shaping amount'), 90);
    await dialog.locator('summary').filter({ hasText: 'More triangles' }).click(); await setRange(dialog.getByLabel('Shaping support rows'), 1); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const supported = (await page.evaluate(previewModel))[0]; assert.ok(supported.length > 12); const depth = supported.filter((_, i) => i % 3 === 2); assert.ok(Math.max(...depth) - Math.min(...depth) > 20, 'four-corner shield gets a real bent middle');
    await dialog.getByRole('button', { name: 'Oblique', exact: true }).click(); await dialog.getByLabel('Shaping support rows').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, '05-coarse-shield-supported.png') });
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await dialog.waitFor({ state: 'detached' }); assert.deepEqual((await page.evaluate(viewportModel))[coarseGi].vertices, supported);
    await page.keyboard.press('Control+z'); assert.deepEqual(await page.evaluate(viewportModel), original, 'support and bend undo together');
    const afterSidebar = await page.locator('.classic-sidebar').first().boundingBox(); assert.equal(afterSidebar?.width, sidebar?.width); assert.equal(hash(), beforeHash);
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ executable, fixtureSHA256: beforeHash, primitiveCount: FORGE_SHAPES.length, maxTriangles, projectorAndShapeModes: true, pickGeosetRemoved: true, pcImageAndTextureLibrary: true, flatShapesWithThickness: FLAT_FORGE_SHAPES, vertexPick: true, middleFold: true, fourCornerShieldSupport: true, cancelAndUndo: true, sidebarWidth: afterSidebar?.width, nativeSaveAs: true, generatedTextureSaved: true, rendererErrors: errors }, null, 2));
    console.log('PASS packaged Projector/Shape modes, Blender mesh starters and thickness, SHAPE middle/selected-vertex folds, immutable preview, Cancel, Apply, undo, native Save As and texture persistence, UV/rig/face preservation and unchanged sidebar.');
  } catch (e) { const page = await app.firstWindow(); fs.writeFileSync(path.join(out, 'failure.txt'), await page.locator('body').innerText()); fs.writeFileSync(path.join(out, 'failure.html'), await page.content()); await page.screenshot({ path: path.join(out, 'failure.png') }); throw e; } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
