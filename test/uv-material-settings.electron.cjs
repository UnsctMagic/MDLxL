// Run the rebuilt native package with a separate profile and synthetic model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, appTarget, sha256File: hash } = require('./helpers/app.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'out', 'uv-material-settings-test-' + Date.now());

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
  const { executablePath: exe } = appTarget();
  const { app, page: launchedPage } = await launchApp({ fixture: input, out, bounds: { x: -3000, y: 0, width: 1600, height: 1000 } });
  let main, uv;
  try {
    main = launchedPage;
    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await main.locator('[data-hotkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 0', { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click();
    await main.keyboard.press('Control+a');
    uv = main; const uvw = main.locator('.uv-tab-window'); // in-app dialog since f7316110
    await main.locator('[data-hotkey="uv"]').click();
    await uvw.getByLabel('Material Properties', { exact: true }).waitFor({ timeout: 60000 });
    await uv.evaluate(() => {
      window.uvProps = () => {
        const props = findFiberProps('.uv-workspace', props => props.materialModel && props.onMaterialPreset);
        if (!props) throw Error('Missing UV props');
        return props;
      };
      window.visibleMaterial = () => {
        const model = uvProps().materialModel, id = model.Geosets[0].MaterialID;
        return { id, layers: model.Materials[id].Layers, textures: model.Textures };
      };
      window.nativeMaterial = () => {
        const native = mdlxlProbe('.uv-tab-window .game-preview-root').runtime?.native;
        return native?.model ? native.model.Materials[native.model.Geosets[0].MaterialID] : null;
      };
    });
    const dropdown = uvw.getByLabel('Material Properties', { exact: true });
    const modes = ['None', 'Transparent', 'Alpha', 'Add', 'Add Alpha', 'Modulate', 'Modulate2x'];
    assert.deepEqual(await dropdown.locator('option').allTextContents(), ['-Current-', 'Team Color Overlay', 'Color Tint', 'Team Color', ...modes]);
    assert.equal(await dropdown.inputValue(), 'Alpha');
    const original = await uv.evaluate(() => visibleMaterial().layers[0]);
    const layout = await uvw.locator('.uv-side-panel').boundingBox();
    const replace = async name => {
      await uvw.getByRole('button', { name: 'Replace Texture…', exact: true }).click();
      const dialog = uvw.getByRole('dialog', { name: 'Material and Texture Library', exact: true });
      await dialog.waitFor();
      await dialog.getByLabel('Texture source', { exact: true }).selectOption('custom');
      await dialog.getByLabel('Vibe search', { exact: true }).uncheck();
      await dialog.getByLabel('Search textures', { exact: true }).fill(name);
      await dialog.locator('.tl-tile').filter({ hasText: name.replace(/\.[^.]+$/, '') }).first().click();
      await dialog.getByRole('button', { name: 'Preview Texture in Editor', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await uvw.getByRole('button', { name: 'Save texture', exact: true }).waitFor();
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
    await uvw.getByRole('button', { name: 'Save texture', exact: true }).click();
    await uvw.getByRole('button', { name: 'Save texture', exact: true }).waitFor({ state: 'detached' });
    await replace('Second.tga');
    assert.equal(await dropdown.inputValue(), 'Modulate2x');
    await uvw.getByRole('button', { name: 'Revert texture', exact: true }).click();
    await uvw.getByRole('button', { name: 'Save texture', exact: true }).waitFor({ state: 'detached' });
    state = await uv.evaluate(() => visibleMaterial());
    assert.equal(state.textures[state.layers[0].TextureID].Image, 'Replacement.tga');
    assert.equal(state.layers[0].FilterMode, 6);
    const finalLayout = await uvw.locator('.uv-side-panel').boundingBox();
    assert.equal(finalLayout.width, layout.width);
    const { openDocument } = await import('../src/editor-document.js');
    const bytes = await main.evaluate(() => {
      const doc = mdlxlProbe().session?.doc;
      if (typeof doc?.serialize === 'function') return Array.from(doc.serialize('mdx'));
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
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
