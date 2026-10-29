const { clickMenu } = require('./helpers/app.cjs');
const { appTarget } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Run after building; MDLXL_TEST_EXE exercises the packaged desktop executable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..'), output = process.env.MDLXL_TEST_OUTPUT || path.join(root, 'out', 'bit-replacement');
  fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument, validateModel, recalculateExtents } = await import('../src/editor-document.js');
  const { transformVertices } = await import('../src/editor-commands.js');
  const { encodeForgeTga } = await import('../src/forge.js');
  const doc = createStarterDocument(), source = createStarterDocument();
  const texturePath = 'Textures\\Replacement.TGA', texture = encodeForgeTga({ width: 2, height: 2, data: new Uint8Array(16).fill(255) });
  const selection = { 0: Array.from({ length: 8 }, (_, id) => id) };
  doc.apply('Replacement fixture', [], model => {
    model.Textures[0].Image = texturePath;
    model.Materials.push(structuredClone(model.Materials[0])); model.Materials[0].PriorityPlane = 2;
    model.Geosets.push(structuredClone(model.Geosets[0])); model.Geosets[1].MaterialID = 1;
    transformVertices(model.Geosets[0], selection[0], [0, 0, 70], [.4, .4, .4]);
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Color: new Float32Array([1, 0, 0]), Alpha: 1 }];
    recalculateExtents(model);
  });
  source.apply('Bit fixture', [], model => {
    model.Textures[0].Image = 'textures/replacement.tga';
    transformVertices(model.Geosets[0], selection[0], [200, 0, 0], [.3, .3, .7]);
    model.Sequences = ['Red', 'Blue'].map((Name, index) => ({ Name, Interval: Uint32Array.of(1000 + index * 2000, 1900 + index * 2000), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: model.Info.MinimumExtent.slice(), MaximumExtent: model.Info.MaximumExtent.slice(), BoundsRadius: model.Info.BoundsRadius }));
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: 1, _MdxDefaults: { Color: new Float32Array([0, 1, 0]), Alpha: 1 }, Color: { LineType: 1, GlobalSeqId: null, Keys: [1000, 1900, 3000, 3900].map((Frame, index) => ({ Frame, Vector: Float32Array.from(index < 2 ? [1, 0, 0] : [0, 0, 1]) })) } }];
    recalculateExtents(model);
  });
  const fixture = path.join(output, 'replacement-target.mdx'), original = Buffer.from(doc.serialize('mdx'));
  fs.writeFileSync(fixture, original);
  fs.mkdirSync(path.join(output, 'Textures'), { recursive: true }); fs.writeFileSync(path.join(output, texturePath), texture);
  const executable = appTarget().executablePath;
  const bank = path.join(process.env.MDLXL_TEST_EXE ? path.dirname(executable) : root, 'BitsAndParts');
  fs.mkdirSync(bank, { recursive: true });
  const bitName = 'Replacement Test Bit ' + Date.now() + '.mdx', bitFile = path.join(bank, bitName);
  const donorBytes = Buffer.from(source.serialize('mdx')); fs.writeFileSync(bitFile, donorBytes);
  const { app, page } = await launchApp({ out: output, profile: path.join(output, 'profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: fixture , pageTimeout: 15000 });
  try {
    const pageErrors = [];  page.on('pageerror', error => pageErrors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setSize(1280, 900); window.show(); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    await page.locator('.classic-view [aria-label="3D model viewport"]').waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.bitState = selector => {
        const host = document.querySelector(selector || '.classic-view [aria-label="3D model viewport"]');
         const result = {};
        { const current = findFiberState(host, current => current?.doc?.apply, { last: true }); if (current?.doc?.apply) result.app = current; }
{ const current = findFiberState(host, current => current?.renderer && current?.entries, { last: true }); if (current?.renderer && current?.entries) result.viewport = current; }
{ const current = findFiberState(host, current => current?.model && current?.preferences, { last: true }); if (current?.model && current?.preferences) result.props = current; }

        return result;
      };
    });
    await page.waitForFunction(() => bitState().app?.doc.model.Info.Name === 'Untitled' && bitState().app.doc.model.Geosets.length === 2);
    const before = await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx')));
    const sidebar = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    await page.locator('[data-hotkey="bitsAndParts"]').click();
    assert.equal(await page.getByRole('button', { name: 'Replace Part', exact: true }).isDisabled(), true);
    assert.deepEqual(await page.locator('.parts-header-actions button').allTextContents(), ['Collect Bit', 'Replace Part']);
    await page.getByRole('button', { name: 'Close BitsAndParts', exact: true }).click();
    await page.locator('[data-hotkey="geosetsAll"]').click();
    await page.evaluate(selection => bitState().props.onSelectionChange(selection), selection);
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 8'));
    await page.waitForFunction(name => bitState().app.session.assets.has(name.toLowerCase()), texturePath);
    const partsViewport = '.parts-preview [aria-label="3D model viewport"]';
    const begin = async () => {
      await page.locator('[data-hotkey="bitsAndParts"]').click();
      await page.getByRole('button', { name: 'Replace Part', exact: true }).click();
      await page.waitForFunction(selector => bitState(selector).viewport?.entries.length === 1, partsViewport);
      const absent = await page.evaluate(selector => {
        const state = bitState(selector);
        return { count: state.props.model.Geosets.length, anims: state.props.model.GeosetAnims.length };
      }, partsViewport);
      assert.deepEqual(absent, { count: 1, anims: 0 });
      await page.getByRole('button', { name: bitName, exact: true }).click();
      await page.waitForFunction(selector => bitState(selector).viewport?.entries.length === 2, partsViewport);
      await page.waitForFunction(selector => { const state = bitState(selector); return state.viewport.entries[1].meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().join(',') === '0,1,0'); }, partsViewport);
    };
    await begin();
    // BITZ previews the automatic fit; manual adjustments remain in the vertex editor.
    const dialog = page.getByRole('dialog', { name: 'BitsAndParts', exact: true });
    assert.equal(await page.locator('.parts-placement-menu').count(), 0);
    for (const name of ['Move', 'Rotate', 'Scale', 'Quad View', 'Normal View']) assert.equal(await dialog.getByRole('button', { name, exact: true }).count(), 0, name);
    assert.equal(await page.getByText('Select animations and rename', { exact: true }).count(), 0);
    const chooseRgb = async (index, rgb) => {
      await page.getByLabel('RGB animation', { exact: true }).selectOption(String(index));
      await page.waitForFunction(([selector, rgb]) => { const state = bitState(selector); return state.viewport.entries[1].meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().join(',') === rgb); }, [partsViewport, rgb.join(',')]);
    };
    await chooseRgb(0, [1, 0, 0]);
    await page.screenshot({ path: path.join(output, 'replacement-preview.png') });
    await chooseRgb(1, [0, 0, 1]);
    const incoming = () => page.evaluate(selector => Array.from(bitState(selector).props.model.Geosets[1].Vertices), partsViewport);
    const centered = await incoming();
    const expectedVertices = Array.from(doc.model.Geosets[0].Vertices);
    centered.forEach((value, index) => assert.ok(Math.abs(value - expectedVertices[index]) < 1e-4, 'replacement matches selected size and position'));
    assert.ok(centered.some((value, index) => Math.abs(value - source.model.Geosets[0].Vertices[index]) > 1), 'source geometry was resized and positioned');
    // The preview camera still rotates with a normal mouse drag and never edits geometry.
    const preview = await page.locator('.parts-preview').boundingBox(), cameraAt = () => page.evaluate(selector => bitState(selector).viewport.camera.position.toArray(), partsViewport);
    const cameraBefore = await cameraAt();
    await page.mouse.move(preview.x + preview.width / 2, preview.y + preview.height / 2); await page.mouse.down();
    await page.mouse.move(preview.x + preview.width / 2 + 60, preview.y + preview.height / 2 + 20, { steps: 10 }); await page.mouse.up();
    await page.waitForFunction(([selector, old]) => bitState(selector).viewport.camera.position.toArray().some((value, axis) => Math.abs(value - old[axis]) > 1e-3), [partsViewport, cameraBefore]);
    assert.deepEqual(await incoming(), centered);
    await page.screenshot({ path: path.join(output, 'blue-preview.png') });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx'))), before);
    await begin();
    await chooseRgb(1, [0, 0, 1]);
    await page.getByRole('button', { name: 'Apply replacement', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    const bytes = new Uint8Array(await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx'))));
    const reopened = openDocument(bytes);
    assert.equal(reopened.model.Geosets.length, 2); assert.equal(reopened.model.Textures.length, 1); assert.equal(reopened.model.Materials.length, 1);
    assert.deepEqual(Array.from(reopened.model.Geosets[1].Vertices), centered);
    assert.deepEqual(reopened.model.Geosets[1].Groups, [[0]]); assert.equal(reopened.model.Bones.length, 1);
    assert.deepEqual(Array.from(reopened.model.GeosetAnims[0].Color), [0, 0, 1]);
    assert.equal(reopened.model.Sequences.length, 0);
    assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []);
    // The Bit arrives selected in the vertex editor with Move ready.
    assert.deepEqual(await page.evaluate(() => { const app = bitState().app; return { mode: app.mode, selection: app.selection[1]?.length, others: Object.entries(app.selection).filter(([key, ids]) => key !== '1' && ids.length).length }; }), { mode: 'vertices', selection: 8, others: 0 });
    assert.equal(await page.locator('[data-hotkey="translate"]').getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: path.join(output, 'replacement-selected.png') });
    // Place it with the vertex editor's own Move tool through a real mouse drag.
    await settlePage(page, 300);
    const start = await page.evaluate(() => {
      const state = bitState().viewport, entry = state.entries[1];
      const source = entry.geometry.attributes.position.array, point = state.camera.position.clone().set(0, 0, 0);
      for (let index = 0; index < source.length; index += 3) point.add({ x: source[index], y: source[index + 1], z: source[index + 2] });
      point.multiplyScalar(3 / source.length).project(state.camera);
      const rect = state.controls.domElement.getBoundingClientRect();
      return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
    });
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await settlePage(page, 150);
    await page.mouse.move(start.x + 40, start.y, { steps: 6 }); await settlePage(page, 150); await page.mouse.up();
    await page.waitForFunction(old => Array.from(bitState().app.doc.model.Geosets[1].Vertices).some((value, index) => value !== old[index]), centered);
    const moved = await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx')));
    await page.screenshot({ path: path.join(output, 'replacement-moved.png') });
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebar);
    // Selection changes have their own history entries in MDLxL.
    const serialized = () => page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx')));
    const seen = [];
    for (let step = 0; step < 8 && JSON.stringify(seen.at(-1)) !== JSON.stringify(before); step++) { await clickMenu(app, 'Undo'); seen.push(await serialized()); }
    assert.deepEqual(seen.at(-1), before); assert.ok(seen.some(state => JSON.stringify(state) === JSON.stringify(Array.from(bytes))), 'undo passes through the unmoved replacement');
    for (let step = 0; step < 8 && JSON.stringify(await serialized()) !== JSON.stringify(moved); step++) await clickMenu(app, 'Redo');
    assert.deepEqual(await serialized(), moved);
    assert.ok(fs.readFileSync(fixture).equals(original)); assert.ok(fs.readFileSync(bitFile).equals(donorBytes)); assert.deepEqual(pageErrors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ executable, passed: true, fittedToSelection: true, noPlacementToolsInBitz: true, previewCameraRotates: true, selectedInVertexEditor: true, movedWithVertexMoveTool: true, cancelUnchanged: true, undoRedo: true, textureCount: 1, materialCount: 1, bonesPreserved: true, sidebarWidth: sidebar }, null, 2));
    console.log('PASS packaged Electron: BITZ previews only, preview camera rotates, cancel, replacement lands selected in the vertex editor and moves with its Move tool, dependency reuse, bones, undo/redo and unchanged fixtures/sidebar.');
  } finally { await closeApp(app); fs.unlinkSync(bitFile); }
})().catch(error => { console.error(error); process.exitCode = 1; });
