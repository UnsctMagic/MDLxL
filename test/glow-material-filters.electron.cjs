const { sha256File } = require('./helpers/app.cjs');
const { appTarget } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Test the UV filter dropdown against an isolated rebuilt Windows package.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'out', 'glow-material-filters-' + Date.now());
const hash = sha256File;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const size = 32, pixels = Buffer.alloc(18 + size * size * 4);
  pixels[2] = 2; pixels.writeUInt16LE(size, 12); pixels.writeUInt16LE(size, 14); pixels[16] = 32; pixels[17] = 40;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const glow = Math.max(0, 1 - Math.hypot(x - 15.5, y - 15.5) / 16);
    pixels.set([Math.round(150 * glow), Math.round(40 * glow), Math.round(150 * glow), Math.round(180 * glow)], 18 + (y * size + x) * 4);
  }
  const texture = path.join(out, 'Glow.tga'); fs.writeFileSync(texture, pixels);
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument } = await import('../src/editor-document.js');
  const doc = createStarterDocument();
  doc.apply('Two authored glow passes', ['Materials', 'Textures'], model => {
    model.Textures.push({ Image: 'Glow.tga', ReplaceableId: 0, Flags: 0 });
    const layer = { TextureID: model.Textures.length - 1, FilterMode: 4, Shading: 49, Alpha: 1, CoordId: 0, TVertexAnimId: null };
    model.Materials[0].Layers = [structuredClone(layer), structuredClone(layer)];
  });
  const input = path.join(out, 'TwoPassGlow.mdx'); fs.writeFileSync(input, doc.serialize('mdx'));
  const beforeHash = hash(input), textureHash = hash(texture), original = doc.model.Materials[0];
  const exe = appTarget().executablePath;
  const { app, page: main } = await launchApp({ out: out, profile: path.join(out, 'profile'), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: input , pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1400, height: 900 }, show: 'inactive' });
  let uv;
  try {

    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await main.getByLabel('3D model viewport', { exact: true }).click(); await main.keyboard.press('Control+a');
    uv = main; const uvw = main.locator('.uv-tab-window'); await main.locator('[data-hotkey="uv"]').click();
    await uvw.getByLabel('Material Properties', { exact: true }).waitFor({ timeout: 60000 });
    // The UV Wrapper is an in-app dialog of the main window (f7316110).
    await uv.evaluate(() => {
      window.glowState = ()=>{const selector='.uv-tab-window',state={};const material=findFiberState(selector,p=>p?.materialModel,{tree:true,props:true});if(material)state.material=material.materialModel.Materials[0];const texture=findFiberState(selector,p=>p?.textureUrl,{tree:true,props:true});if(texture)state.textureUrl=texture.textureUrl;const runtime=mdlxlProbe(selector+' .game-preview-root').runtime;if(runtime){state.native=runtime.native.model.Materials[0];state.camera=Array.from(runtime.controls.object.matrixWorld.elements);}return state;};
    });
    const dropdown = uvw.getByLabel('Material Properties', { exact: true });
    await uv.waitForFunction(() => glowState().textureUrl && glowState().native?.Layers.length === 2);
    assert.equal(await dropdown.inputValue(), 'Add Alpha');
    const before = await uv.evaluate(() => glowState()), sidebar = await uvw.locator('.uv-side-panel').boundingBox();
    const settle = () => uv.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await settle();
    const originalPreview = await uvw.locator('.uv-preview-canvas').screenshot();
    await uv.screenshot({ path: path.join(out, 'before.png') });
    for (const [mode, preset] of ['None', 'Transparent', 'Alpha', 'Add', 'Add Alpha', 'Modulate', 'Modulate2x'].entries()) {
      await dropdown.selectOption(preset);
      await uv.waitForFunction(mode => glowState().native?.Layers.length === 2 && glowState().native.Layers.every(layer => layer.FilterMode === mode), mode);
      assert.equal(await dropdown.inputValue(), preset);
      assert.deepEqual(await uv.evaluate(() => glowState().material), { ...original, Layers: original.Layers.map(layer => ({ ...layer, FilterMode: mode })) });
    }
    await dropdown.selectOption('Add Alpha');
    await uv.waitForFunction(url => glowState().textureUrl === url && glowState().native?.Layers.every(layer => layer.FilterMode === 4), before.textureUrl);
    assert.deepEqual((await uv.evaluate(() => glowState())).material, before.material);
    await settle();
    assert.deepEqual(await uvw.locator('.uv-preview-canvas').screenshot(), originalPreview, 'returning to Add Alpha restores the rendered 3D glow pixels');
    await uv.screenshot({ path: path.join(out, 'restored.png') });
    await uv.keyboard.press('Control+z'); await uv.waitForFunction(() => glowState().native?.Layers.every(layer => layer.FilterMode === 6));
    await uv.keyboard.press('Control+y'); await uv.waitForFunction(url => glowState().textureUrl === url, before.textureUrl);
    // The user's recording switches through Team Color before returning.
    await dropdown.selectOption('Add');
    await uv.waitForFunction(() => glowState().native?.Layers.every(layer => layer.FilterMode === 3));
    await dropdown.selectOption('Team Color');
    await uv.waitForFunction(() => glowState().native?.Layers.length === 2 && glowState().native.Layers[0].FilterMode === 0);
    const teamColor = await uv.evaluate(() => glowState().material);
    await dropdown.selectOption('Add Alpha');
    await uv.waitForFunction(url => glowState().native?.Layers.length === 2 && glowState().native.Layers.every(layer => layer.FilterMode === 4) && glowState().textureUrl === url, before.textureUrl);
    assert.deepEqual((await uv.evaluate(() => glowState())).material, before.material);
    await settle();
    assert.deepEqual(await uvw.locator('.uv-preview-canvas').screenshot(), originalPreview, 'Add -> Team Color -> Add Alpha restores the original 3D glow');
    await uv.screenshot({ path: path.join(out, 'restored-through-team-color.png') });
    await dropdown.selectOption('Team Color');
    await uv.waitForFunction(() => glowState().native?.Layers[0].FilterMode === 0);
    assert.deepEqual((await uv.evaluate(() => glowState())).material, teamColor, 'returning to Team Color restores that setting too');
    await dropdown.selectOption('Add Alpha');
    await uv.waitForFunction(url => glowState().textureUrl === url, before.textureUrl);
    const stage = uvw.locator('.uv-preview-canvas canvas').first(), rect = await stage.boundingBox();
    const camera = (await uv.evaluate(() => glowState())).camera;
    await uv.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await uv.mouse.down();
    await uv.mouse.move(rect.x + rect.width / 2 + 90, rect.y + rect.height / 2 + 35, { steps: 12 }); await uv.mouse.up();
    await uv.waitForFunction(before => glowState().camera.some((value, index) => Math.abs(value - before[index]) > .01), camera);
    assert.equal((await uvw.locator('.uv-side-panel').boundingBox()).width, sidebar.width);
    const bytes = await main.evaluate(() => {
      const element = document.querySelector('.classic-app');
      { const doc = mdlxlProbe().session?.doc; if (typeof doc?.serialize === 'function') return Array.from(doc.serialize('mdx')); }

      throw Error('Missing document');
    });
    assert.deepEqual(openDocument(Uint8Array.from(bytes), 'reopened.mdx').model.Materials[0], original);
    assert.equal(hash(input), beforeHash); assert.equal(hash(texture), textureHash);
    console.log(JSON.stringify({ executable: exe, output: out, checks: ['all seven filters preserve two glow layers and 100% alpha', 'Add -> Team Color -> Add Alpha restores identical UV and 3D glow pixels without Undo', 'returning to Team Color restores its settings', 'native renderer has both layers', 'undo/redo', 'mouse drag rotates live preview', 'MDX reopen', 'sidebar width unchanged', 'model and texture hashes unchanged'] }, null, 2));
  } catch (error) {
    if (uv && !uv.isClosed()) await uv.screenshot({ path: path.join(out, 'failure.png') });
    throw error;
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
