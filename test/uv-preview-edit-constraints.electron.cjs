// Rebuilt native bundle; optionally pass a separately packaged MDLxL executable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, settle, stubDialogs, clickMenu } = require('./helpers/app.cjs');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = process.env.MDLXL_TEST_OUTPUT || path.join(root, 'out', `uv-preview-edit-constraints-${Date.now()}`);
  fs.mkdirSync(output, { recursive: true });
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument(), fixture = path.join(output, 'preview-edit.mdx');
  const original = Buffer.from(doc.serialize('mdx')); fs.writeFileSync(fixture, original);
  const { app, page: launchedPage } = await launchApp({ fixture, out: output, pageTimeout: 15000 });
  let uv;
  try {
    const main = launchedPage; const uvw = main.locator('.uv-tab-window');
    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await main.getByLabel('3D model viewport', { exact: true }).waitFor({ timeout: 60000 });
    const installHelpers = page => page.evaluate(() => {
      window.ownerProps = (selector, key) => {
        const props = findFiberProps(selector, props => !!props[key]);
        if (!props) throw Error('Missing props ' + selector);
        return props;
      };
      window.modelState = () => ownerProps('[aria-label="3D model viewport"]', 'onSelectionChange').model;
      window.uvState = () => ownerProps('.uv-workspace', 'onUVChanges');
    });
    await installHelpers(main);
    const baseline = await main.evaluate(() => JSON.stringify(modelState()));
    const sidebarWidth = await main.locator('.classic-sidebar').evaluate(e => getComputedStyle(e).width);
    await main.locator('[data-hotkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 0', { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click();
    await main.keyboard.press('Control+a');
    const openUV = async () => {
      // The UV Wrapper is an in-app dialog of the main window since f7316110.
      await main.locator('[data-hotkey="uv"]').click(); uv = main;
      await uvw.getByLabel('UV coordinate editor').waitFor(); await installHelpers(uv);
    };
    const closeUV = async () => {
      await uvw.getByRole('button', { name: 'Exit UV Wrapper', exact: true }).click(); await uvw.waitFor({ state: 'detached' });
      await main.getByLabel('3D model viewport', { exact: true }).waitFor();
    };
    const replaceTexture = async () => {
      await uvw.getByRole('button', { name: 'Replace Texture…', exact: true }).click();
      await uvw.locator('.tl-dialog').waitFor();
      // Exercise the normal library-to-editor callback with an in-memory PNG,
      // independent of installed Warcraft archives or an external test texture.
      await uv.evaluate(async () => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
        const context = canvas.getContext('2d'); context.fillStyle = '#22bb66'; context.fillRect(0, 0, 16, 16);
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        await ownerProps('.tl-dialog', 'onPreviewTexture').onPreviewTexture({ name: 'PreviewEdit.png', bytes: new Uint8Array(await blob.arrayBuffer()), source: 'library' });
      });
      await uvw.getByRole('button', { name: 'Revert texture', exact: true }).waitFor();
    };
    await openUV(); await replaceTexture();
    await uvw.locator('.uv-live-preview .game-preview-surface canvas[data-clean-model-canvas]').waitFor();
    await uv.evaluate(() => {
      window.previewCanvasBeforeUVEdit = document.querySelector('.uv-live-preview .game-preview-surface canvas[data-clean-model-canvas]');
      window.previewRevisionBeforeUVEdit = uvState().revision;
    });
    await uv.evaluate(() => { const p = uvState(), values = p.model.Geosets[0].TVertices[0].slice(); values[0] += .2; p.onUVChanges([{ geosetIndex: 0, uvSet: 0, values }]); });
    await uv.waitForFunction(() => uvState().revision > window.previewRevisionBeforeUVEdit);
    await settle(uv, 250);
    assert.equal(await uv.evaluate(() => window.previewCanvasBeforeUVEdit === document.querySelector('.uv-live-preview .game-preview-surface canvas[data-clean-model-canvas]')), true,
      'A UV edit with a temporary texture must keep the live preview canvas mounted');
    const previewCanvas = uvw.locator('.uv-live-preview .game-preview-surface canvas[data-clean-model-canvas]');
    const beforeCameraDrag = await previewCanvas.screenshot();
    const bounds = await previewCanvas.boundingBox();
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await uv.mouse.move(center.x, center.y);
    await uv.mouse.down();
    await uv.mouse.move(center.x + 65, center.y + 35, { steps: 8 });
    await uv.mouse.up();
    await settle(uv, 150);
    assert.notDeepEqual(await previewCanvas.screenshot(), beforeCameraDrag, 'The live preview must rotate through a normal mouse drag');
    await closeUV();
    const before = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    await main.locator('[data-hotkey="Reverse normals"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Reverse normals');
    const reversed = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.notDeepEqual(reversed.Geosets[0].Faces, before.Geosets[0].Faces);
    assert.notDeepEqual(reversed.Geosets[0].Normals, before.Geosets[0].Normals);
    await clickMenu(app,'Undo');
    await main.waitForFunction(value => JSON.stringify(modelState()) === value, JSON.stringify(before));
    await clickMenu(app,'Redo');
    await main.waitForFunction(value => JSON.stringify(modelState()) === value, JSON.stringify(reversed));
    // Select one complete triangle through the viewport's normal selection path.
    await main.evaluate(() => { const p = ownerProps('[aria-label="3D model viewport"]', 'onSelectionChange'); p.onSelectionChange({ 0: Array.from(p.model.Geosets[0].Faces.slice(0, 3)) }); });
    await main.locator('[data-hotkey="Delete triangles"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Delete triangles');
    const edited = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.ok(Object.keys(edited.Geosets[0].Faces).length < Object.keys(reversed.Geosets[0].Faces).length);
    await main.locator('[data-hotkey="Create triangle"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Create triangle');
    const created = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.ok(Object.keys(created.Geosets[0].Faces).length > Object.keys(edited.Geosets[0].Faces).length);
    // Match the user's failed test: weld two selected vertices while unsaved.
    await main.evaluate(() => ownerProps('[aria-label="3D model viewport"]', 'onSelectionChange').onSelectionChange({ 0: [0, 1] }));
    await main.locator('[data-hotkey="Weld"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Weld');
    const welded = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.ok(Object.keys(welded.Geosets[0].Vertices).length < Object.keys(created.Geosets[0].Vertices).length);
    await clickMenu(app,'Undo');
    await main.waitForFunction(value => JSON.stringify(modelState()) === value, JSON.stringify(created));
    await clickMenu(app,'Redo');
    await main.waitForFunction(value => JSON.stringify(modelState()) === value, JSON.stringify(welded));
    await main.locator('[data-hotkey="Uncouple"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Uncouple');
    const topologyEdited = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.ok(Object.keys(topologyEdited.Geosets[0].Vertices).length > Object.keys(welded.Geosets[0].Vertices).length);
    await openUV();
    assert.equal(await uv.evaluate(() => uvState().draftCount), 1);
    await uv.screenshot({ path: path.join(output, 'temporary-texture-after-vertex-edits.png') });
    await uvw.getByRole('button', { name: 'Revert texture', exact: true }).click();
    await uv.waitForFunction(() => uvState().draftCount === 0);
    await closeUV();
    const reverted = JSON.parse(await main.evaluate(() => JSON.stringify(modelState()))), originalModel = JSON.parse(baseline);
    assert.deepEqual(reverted.Geosets[0].TVertices, topologyEdited.Geosets[0].TVertices);
    assert.equal(reverted.Geosets[0].MaterialID, originalModel.Geosets[0].MaterialID);
    assert.deepEqual(reverted.Textures, originalModel.Textures);
    assert.deepEqual(reverted.Geosets[0].Faces, topologyEdited.Geosets[0].Faces);
    assert.deepEqual(reverted.Geosets[0].Normals, topologyEdited.Geosets[0].Normals);
    assert.deepEqual(reverted.Geosets[0].Vertices, topologyEdited.Geosets[0].Vertices);
    assert.equal(await main.locator('.classic-sidebar').evaluate(e => getComputedStyle(e).width), sidebarWidth);
    // A second preview commits the new texture with the edited geometry intact.
    await openUV(); await replaceTexture(); await uvw.getByRole('button', { name: 'Save texture', exact: true }).click();
    await uv.waitForFunction(() => uvState().draftCount === 0);
    await closeUV();
    const committed = await main.evaluate(() => JSON.stringify(modelState()));
    assert.ok(JSON.parse(committed).Textures.some(texture => texture.Image === 'PreviewEdit.png'));
    const saved = path.join(output, 'saved.mdx');
    await stubDialogs(app, { save: saved });
    await main.keyboard.press('F12');
    await main.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent.startsWith('Saved '));
    const reopened = openDocument(fs.readFileSync(saved), 'saved.mdx');
    assert.ok(reopened.model.Textures.some(texture => texture.Image === 'PreviewEdit.png'));
    const savedGeometry = JSON.parse(JSON.stringify(reopened.model.Geosets[0]));
    assert.deepEqual(savedGeometry.Faces, topologyEdited.Geosets[0].Faces);
    assert.deepEqual(savedGeometry.Normals, topologyEdited.Geosets[0].Normals);
    assert.deepEqual(savedGeometry.Vertices, topologyEdited.Geosets[0].Vertices);
    assert.deepEqual(savedGeometry.TVertices, topologyEdited.Geosets[0].TVertices);
    assert.ok(fs.readFileSync(fixture).equals(original));
    await main.screenshot({ path: path.join(output, 'saved-vertex-edits.png') });
    console.log('PASS packaged Electron: temporary texture UV edit keeps live preview canvas, mouse drag rotates preview, vertex edits and undo/redo preserve UV and geometry, Save texture and MDX reload, sidebar width and input file preserved');
  } catch (error) {
    console.error(error); if (uv && !uv.isClosed()) await uv.screenshot({ path: path.join(output, 'failure-uv.png') }).catch(() => {});
    const main = launchedPage; console.error(await main.locator('.classic-status').innerText());
    await main.screenshot({ path: path.join(output, 'failure-main.png') }).catch(() => {}); throw error;
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
