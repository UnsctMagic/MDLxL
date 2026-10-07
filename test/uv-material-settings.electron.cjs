// Run the rebuilt native package with a separate profile and synthetic model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'out', 'uv-material-settings-test-' + Date.now());
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function fixture() {
  fs.mkdirSync(out, { recursive: true });
  const tga = (name, color) => {
    const bytes = Buffer.alloc(18 + 32 * 32 * 4);
    bytes[2] = 2; bytes.writeUInt16LE(32, 12); bytes.writeUInt16LE(32, 14); bytes[16] = 32; bytes[17] = 40;
    for (let i = 18; i < bytes.length; i += 4) bytes.set([color[2], color[1], color[0], color[3]], i);
    fs.writeFileSync(path.join(out, name), bytes);
  };
  tga('Original.tga', [190, 150, 80, 180]);
  tga('Replacement.tga', [80, 180, 230, 180]);
  tga('Second.tga', [170, 230, 80, 180]);
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument();
  doc.apply('UV material fixture', ['Materials', 'Textures', 'Geosets'], m => {
    m.Textures.push({ Image: 'Original.tga', ReplaceableId: 0, Flags: 3 });
    m.Materials[0].Layers = [{ TextureID: m.Textures.length - 1, FilterMode: 2, Shading: 17, Alpha: .65, CoordId: 0, TVertexAnimId: null }];
    m.Geosets[1].MaterialID = 0;
  });
  const file = path.join(out, 'UVMaterialSettings.mdx');
  fs.writeFileSync(file, doc.serialize('mdx'));
  return file;
}

(async () => {
  const input = await fixture(), before = hash(input);
  const exe = path.resolve(process.argv[2] || path.join(root, 'out/uv-material-settings-package/MDLxL-win32-x64/MDLxL.exe'));
  const app = await _electron.launch({
    executablePath: exe, args: ['--disable-backgrounding-occluded-windows', input],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile') }, timeout: 60000,
  });
  let main, uv;
  try {
    main = await app.firstWindow(); main.setDefaultTimeout(20000);
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false);
      w.setBounds({ x: -3000, y: 0, width: 1600, height: 1000 }); w.showInactive();
    });
    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await main.locator('[data-warmkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 0', { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click();
    await main.keyboard.press('Control+a');
    const opened = app.waitForEvent('window');
    await main.locator('[data-warmkey="uv"]').click(); uv = await opened; uv.setDefaultTimeout(20000);
    await uv.getByLabel('Material Properties', { exact: true }).waitFor({ timeout: 60000 });
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === 'about:blank');
      w.webContents.setBackgroundThrottling(false); w.setBounds({ x: -3000, y: 0, width: 1600, height: 1000 }); w.showInactive();
    });
    await uv.evaluate(() => {
      window.currentUVFiber = () => {
        const element = document.querySelector('.uv-workspace');
        let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
        while (fiber.return) fiber = fiber.return;
        const find = node => {
          if (node.memoizedProps?.materialModel && node.memoizedProps?.onMaterialPreset) return node;
          for (let child = node.child; child; child = child.sibling) { const found = find(child); if (found) return found; }
        };
        return find(fiber.stateNode.current);
      };
      window.uvProps = () => {
        const fiber = currentUVFiber();
        if (!fiber) throw Error('Missing UV props');
        return fiber.memoizedProps;
      };
      window.visibleMaterial = () => {
        const model = uvProps().materialModel, id = model.Geosets[0].MaterialID;
        return { id, layers: model.Materials[id].Layers, textures: model.Textures };
      };
      window.nativeMaterial = () => {
        const find = node => {
          for (let h = node.memoizedState; h; h = h.next) {
            const native = h.memoizedState?.current?.native;
            if (native?.model) return native.model.Materials[native.model.Geosets[0].MaterialID];
          }
          for (let child = node.child; child; child = child.sibling) { const found = find(child); if (found) return found; }
        };
        return find(currentUVFiber()) || null;
      };
    });
    const dropdown = uv.getByLabel('Material Properties', { exact: true });
    const modes = ['None', 'Transparent', 'Alpha', 'Add', 'Add Alpha', 'Modulate', 'Modulate2x'];
    assert.deepEqual(await dropdown.locator('option').allTextContents(), ['-Current-', 'Team Color Overlay', 'Color Tint', 'Team Color', ...modes]);
    assert.equal(await dropdown.inputValue(), 'Alpha');
    const original = await uv.evaluate(() => visibleMaterial().layers[0]);
    const layout = await uv.locator('.uv-side-panel').boundingBox();
    const replace = async name => {
      await uv.getByRole('button', { name: 'Replace Texture…', exact: true }).click();
      const dialog = uv.getByRole('dialog', { name: 'Material and Texture Library', exact: true });
      await dialog.waitFor();
      await dialog.getByLabel('Texture source', { exact: true }).selectOption('custom');
      await dialog.getByLabel('Vibe search', { exact: true }).uncheck();
      await dialog.getByLabel('Search textures', { exact: true }).fill(name);
      await dialog.locator('.tl-tile').filter({ hasText: name.replace(/\.[^.]+$/, '') }).first().click();
      await dialog.getByRole('button', { name: 'Preview Texture in Editor', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await uv.getByRole('button', { name: 'Save texture', exact: true }).waitFor();
      assert.equal(await dropdown.isEnabled(), true);
    };
    await replace('Replacement.tga');
    assert.equal(await dropdown.inputValue(), 'Alpha');
    let state = await uv.evaluate(() => visibleMaterial());
    assert.deepEqual({ ...state.layers[0], TextureID: original.TextureID }, original);
    assert.equal(state.textures[state.layers[0].TextureID].Image, 'Replacement.tga');
    await uv.waitForFunction(() => nativeMaterial()?.Layers[0].FilterMode === 2);
    for (const [mode, preset] of modes.entries()) {
      await dropdown.selectOption('Team Color');
      await uv.waitForFunction(() => visibleMaterial().layers.length === 2);
      await dropdown.selectOption(preset);
      await uv.waitForFunction(mode => nativeMaterial()?.Layers.length === 1 && nativeMaterial().Layers[0].FilterMode === mode, mode);
      state = await uv.evaluate(() => visibleMaterial());
      assert.equal(await dropdown.inputValue(), preset);
      assert.equal(state.layers.length, 1); assert.equal(state.layers[0].FilterMode, mode);
      assert.equal(state.textures[state.layers[0].TextureID].ReplaceableId, 0);
      assert.equal(state.textures[state.layers[0].TextureID].Image, 'Replacement.tga');
      if (preset === 'Alpha') await uv.screenshot({ path: path.join(out, 'alpha-replaces-team-color.png') });
    }
    await uv.keyboard.press('Control+z');
    await uv.waitForFunction(() => visibleMaterial().layers.length === 2);
    await uv.keyboard.press('Control+y');
    await uv.waitForFunction(() => visibleMaterial().layers.length === 1 && visibleMaterial().layers[0].FilterMode === 6);
    await uv.getByRole('button', { name: 'Save texture', exact: true }).click();
    await uv.getByRole('button', { name: 'Save texture', exact: true }).waitFor({ state: 'detached' });
    await replace('Second.tga');
    assert.equal(await dropdown.inputValue(), 'Modulate2x');
    await uv.getByRole('button', { name: 'Revert texture', exact: true }).click();
    await uv.getByRole('button', { name: 'Save texture', exact: true }).waitFor({ state: 'detached' });
    state = await uv.evaluate(() => visibleMaterial());
    assert.equal(state.textures[state.layers[0].TextureID].Image, 'Replacement.tga');
    assert.equal(state.layers[0].FilterMode, 6);
    const finalLayout = await uv.locator('.uv-side-panel').boundingBox();
    assert.equal(finalLayout.width, layout.width);
    const { openDocument } = await import('../src/editor-document.js');
    const bytes = await main.evaluate(() => {
      const element = document.querySelector('.classic-app');
      let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let h = fiber.memoizedState; h; h = h.next) {
        const doc = h.memoizedState?.doc;
        if (typeof doc?.serialize === 'function') return Array.from(doc.serialize('mdx'));
      }
      throw Error('Missing active document');
    });
    fs.writeFileSync(path.join(out, 'Checked.mdx'), Uint8Array.from(bytes));
    const reopened = openDocument(Uint8Array.from(bytes), 'checked.mdx');
    assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0);
    assert.equal(reopened.model.Materials[reopened.model.Geosets[0].MaterialID].Layers[0].FilterMode, 6);
    assert.equal(hash(input), before);
    console.log(JSON.stringify({ executable: exe, output: out, checks: ['native dropdown modes', 'Alpha preserved on replacement', 'all modes remove team-color layers during pending replacement', 'native renderer updated', 'undo/redo', 'save/repeated replacement/revert', 'MDX reopen', 'sidebar width unchanged', 'fixture hash unchanged'] }, null, 2));
  } catch (error) {
    if (uv && !uv.isClosed()) { await uv.screenshot({ path: path.join(out, 'failure.png') }); console.error(await uv.locator('body').innerText()); }
    else if (main && !main.isClosed()) console.error(await main.locator('body').innerText());
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
