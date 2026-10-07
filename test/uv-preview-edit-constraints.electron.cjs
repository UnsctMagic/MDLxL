// Rebuilt native bundle; optionally pass a separately packaged MDLxL executable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = process.env.MDLXL_TEST_OUTPUT || path.join(root, 'out', `uv-preview-edit-constraints-${Date.now()}`);
  fs.mkdirSync(output, { recursive: true });
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument(), fixture = path.join(output, 'preview-edit.mdx');
  const original = Buffer.from(doc.serialize('mdx')); fs.writeFileSync(fixture, original);
  const executable = process.argv[2] || path.join(root, 'node_modules/electron/dist/electron.exe');
  const app = await _electron.launch({ executablePath: executable,
    args: ['--disable-backgrounding-occluded-windows', ...(process.argv[2] ? [] : [root]), fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, `profile-${Date.now()}`) }, timeout: 60000 });
  let uv;
  try {
    const main = await app.firstWindow(); main.setDefaultTimeout(15000);
    await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) { w.webContents.setBackgroundThrottling(false); w.setPosition(-3000, 0); w.showInactive(); } });
    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    const installHelpers = page => page.evaluate(() => {
      window.ownerProps = (selector, key) => {
        const element = document.querySelector(selector); if (!element) throw Error('Missing ' + selector);
        let fiber = element[Object.keys(element).find(name => name.startsWith('__reactFiber'))];
        let top = fiber; while (top.return) top = top.return;
        const current = top.stateNode.current;
        const pending = [current];
        while (pending.length) {
          const node = pending.pop();
          if (node.stateNode === element) { fiber = node; break; }
          if (node.child) pending.push(node.child);
          if (node.sibling) pending.push(node.sibling);
        }
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.[key]) return fiber.memoizedProps;
        throw Error('Missing props ' + key);
      };
      window.modelState = () => ownerProps('[aria-label="3D model viewport"]', 'onSelectionChange').model;
      window.uvState = () => ownerProps('.uv-workspace', 'onUVChanges');
    });
    await installHelpers(main);
    const baseline = await main.evaluate(() => JSON.stringify(modelState()));
    const sidebarWidth = await main.locator('.classic-sidebar').evaluate(e => getComputedStyle(e).width);
    await main.locator('[data-warmkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 0', { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click();
    await main.keyboard.press('Control+a');
    const openUV = async () => {
      const opened = app.waitForEvent('window');
      await main.locator('[data-warmkey="uv"]').click(); uv = await opened; uv.setDefaultTimeout(15000);
      await app.evaluate(({ BrowserWindow }) => { for (const w of BrowserWindow.getAllWindows()) { w.webContents.setBackgroundThrottling(false); w.setPosition(-3000, 0); w.showInactive(); } });
      await uv.getByLabel('UV coordinate editor').waitFor(); await installHelpers(uv);
    };
    const closeUV = async () => {
      const closed = uv.waitForEvent('close'); await uv.getByRole('button', { name: 'Exit UV Wrapper', exact: true }).click(); await closed;
      await main.getByLabel('3D model viewport', { exact: true }).waitFor();
    };
    const replaceTexture = async () => {
      await uv.getByRole('button', { name: 'Replace Texture…', exact: true }).click();
      await uv.locator('.tl-dialog').waitFor();
      // Exercise the normal library-to-editor callback with an in-memory PNG,
      // independent of installed Warcraft archives or an external test texture.
      await uv.evaluate(async () => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
        const context = canvas.getContext('2d'); context.fillStyle = '#22bb66'; context.fillRect(0, 0, 16, 16);
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        await ownerProps('.tl-dialog', 'onPreviewTexture').onPreviewTexture({ name: 'PreviewEdit.png', bytes: new Uint8Array(await blob.arrayBuffer()), source: 'library' });
      });
      await uv.getByRole('button', { name: 'Revert texture', exact: true }).waitFor();
    };
    await openUV(); await replaceTexture();
    await uv.evaluate(() => { const p = uvState(), values = p.model.Geosets[0].TVertices[0].slice(); values[0] += .2; p.onUVChanges([{ geosetIndex: 0, uvSet: 0, values }]); });
    await closeUV();
    const before = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    await main.locator('[data-warmkey="Reverse normals"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Reverse normals');
    const reversed = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.notDeepEqual(reversed.Geosets[0].Faces, before.Geosets[0].Faces);
    assert.notDeepEqual(reversed.Geosets[0].Normals, before.Geosets[0].Normals);
    await main.locator('[data-warmkey="undo"]').click();
    await main.waitForFunction(value => JSON.stringify(modelState()) === value, JSON.stringify(before));
    await main.locator('[data-warmkey="redo"]').click();
    await main.waitForFunction(value => JSON.stringify(modelState()) === value, JSON.stringify(reversed));
    // Select one complete triangle through the viewport's normal selection path.
    await main.evaluate(() => { const p = ownerProps('[aria-label="3D model viewport"]', 'onSelectionChange'); p.onSelectionChange({ 0: Array.from(p.model.Geosets[0].Faces.slice(0, 3)) }); });
    await main.locator('[data-warmkey="Delete triangles"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Delete triangles');
    const edited = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.ok(Object.keys(edited.Geosets[0].Faces).length < Object.keys(reversed.Geosets[0].Faces).length);
    await main.locator('[data-warmkey="Create triangle"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'Create triangle');
    const created = JSON.parse(await main.evaluate(() => JSON.stringify(modelState())));
    assert.ok(Object.keys(created.Geosets[0].Faces).length > Object.keys(edited.Geosets[0].Faces).length);
    await main.locator('[data-warmkey="Uncouple"]').click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent.includes('changed vertex or UV structure'));
    assert.deepEqual(JSON.parse(await main.evaluate(() => JSON.stringify(modelState()))), created, 'a vertex-count change on the preview target remains atomic');
    await openUV();
    assert.equal(await uv.evaluate(() => uvState().draftCount), 1);
    await uv.screenshot({ path: path.join(output, 'temporary-texture-after-vertex-edits.png') });
    await uv.getByRole('button', { name: 'Revert texture', exact: true }).click();
    await uv.waitForFunction(() => uvState().draftCount === 0);
    await closeUV();
    const reverted = JSON.parse(await main.evaluate(() => JSON.stringify(modelState()))), originalModel = JSON.parse(baseline);
    assert.deepEqual(reverted.Geosets[0].TVertices, originalModel.Geosets[0].TVertices);
    assert.deepEqual(reverted.Geosets[0].Faces, created.Geosets[0].Faces);
    assert.deepEqual(reverted.Geosets[0].Normals, created.Geosets[0].Normals);
    assert.deepEqual(reverted.Geosets[0].Vertices, created.Geosets[0].Vertices);
    assert.equal(await main.locator('.classic-sidebar').evaluate(e => getComputedStyle(e).width), sidebarWidth);
    // A second preview commits the new texture with the edited geometry intact.
    await openUV(); await replaceTexture(); await uv.getByRole('button', { name: 'Save texture', exact: true }).click();
    await uv.waitForFunction(() => uvState().draftCount === 0);
    await closeUV();
    const committed = await main.evaluate(() => JSON.stringify(modelState()));
    assert.ok(JSON.parse(committed).Textures.some(texture => texture.Image === 'PreviewEdit.png'));
    const saved = path.join(output, 'saved.mdx');
    await app.evaluate(({ dialog }, filename) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: filename }); }, saved);
    await main.keyboard.press('Control+Shift+s');
    await main.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await main.waitForFunction(() => document.querySelector('.classic-status span').textContent.startsWith('Saved '));
    const reopened = openDocument(fs.readFileSync(saved), 'saved.mdx');
    assert.ok(reopened.model.Textures.some(texture => texture.Image === 'PreviewEdit.png'));
    const savedGeometry = JSON.parse(JSON.stringify(reopened.model.Geosets[0]));
    assert.deepEqual(savedGeometry.Faces, created.Geosets[0].Faces);
    assert.deepEqual(savedGeometry.Normals, created.Geosets[0].Normals);
    assert.ok(fs.readFileSync(fixture).equals(original));
    await main.screenshot({ path: path.join(output, 'saved-vertex-edits.png') });
    console.log('PASS packaged Electron: temporary texture, UV edit, Reverse normals, undo/redo, Delete/Create triangle, atomic vertex-count guard, Revert preserves geometry, Save texture and MDX reload, sidebar width and input file preserved');
  } catch (error) {
    console.error(error); if (uv && !uv.isClosed()) await uv.screenshot({ path: path.join(output, 'failure-uv.png') }).catch(() => {});
    const main = await app.firstWindow(); console.error(await main.locator('.classic-status').innerText());
    await main.screenshot({ path: path.join(output, 'failure-main.png') }).catch(() => {}); throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
