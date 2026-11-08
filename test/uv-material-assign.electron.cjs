// The UV Wrapper's material dropdown assigns any model material directly and
// cancels an unsaved test texture on the same geoset without asking.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'out', 'uv-material-assign-test-' + Date.now());

async function fixture() {
  fs.mkdirSync(out, { recursive: true });
  const tga = (name, color) => {
    const bytes = Buffer.alloc(18 + 32 * 32 * 4);
    bytes[2] = 2; bytes.writeUInt16LE(32, 12); bytes.writeUInt16LE(32, 14); bytes[16] = 32; bytes[17] = 40;
    for (let i = 18; i < bytes.length; i += 4) bytes.set([color[2], color[1], color[0], color[3]], i);
    fs.writeFileSync(path.join(out, name), bytes);
  };
  tga('First.tga', [190, 150, 80, 255]);
  tga('Second.tga', [80, 180, 230, 255]);
  tga('Trial.tga', [170, 230, 80, 255]);
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument();
  doc.apply('Two material fixture', ['Materials', 'Textures', 'Geosets'], m => {
    const first = m.Textures.push({ Image: 'First.tga', ReplaceableId: 0, Flags: 3 }) - 1;
    const second = m.Textures.push({ Image: 'Second.tga', ReplaceableId: 0, Flags: 3 }) - 1;
    const layer = TextureID => ({ TextureID, FilterMode: 0, Shading: 0, Alpha: 1, CoordId: 0, TVertexAnimId: null });
    m.Materials = [{ PriorityPlane: 0, RenderMode: 0, Layers: [layer(first)] }, { PriorityPlane: 0, RenderMode: 0, Layers: [layer(second)] }];
    for (const geoset of m.Geosets) geoset.MaterialID = 0;
  });
  const file = path.join(out, 'UVMaterialAssign.mdx');
  fs.writeFileSync(file, doc.serialize('mdx'));
  return file;
}

(async () => {
  const input = await fixture();
  const { app, page: main } = await launchApp({ fixture: input, out, bounds: { x: -3000, y: 0, width: 1600, height: 1000 } });
  try {
    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await main.locator('[data-hotkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 0', { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click();
    await main.keyboard.press('Control+a');
    const uvw = main.locator('.uv-tab-window');
    await main.locator('[data-hotkey="uv"]').click();
    const picker = uvw.getByLabel('UV material', { exact: true });
    await picker.waitFor({ timeout: 60000 });
    await main.evaluate(() => {
      window.uvProps = () => findFiberProps('.uv-workspace', props => props.materialModel && props.onMaterialPreset);
      window.savedMaterial = () => uvProps().model.Geosets[0].MaterialID;
      window.nativeTexture = () => {
        const native = mdlxlProbe('.uv-tab-window .game-preview-root').runtime?.native?.model;
        return native ? native.Textures[native.Materials[native.Geosets[0].MaterialID].Layers[0].TextureID].Image : null;
      };
    });
    const saveTexture = uvw.getByRole('button', { name: 'Save texture', exact: true });

    assert.deepEqual(await picker.locator('option').allTextContents(), ['Material 1 · First.tga', 'Material 2 · Second.tga']);
    assert.equal(await picker.inputValue(), '0');
    assert.match(await picker.locator('xpath=..').getAttribute('title'), /unsaved test texture/);

    await picker.selectOption('1');
    await main.waitForFunction(() => savedMaterial() === 1);
    await main.waitForFunction(() => nativeTexture() === 'Second.tga');
    assert.equal(await picker.inputValue(), '1');
    await uvw.getByText('Material 2 · Second.tga').first().waitFor({ state: 'attached' });

    await main.keyboard.press('Control+z');
    await main.waitForFunction(() => savedMaterial() === 0);
    await main.waitForFunction(() => nativeTexture() === 'First.tga');
    assert.equal(await picker.inputValue(), '0');

    // A test texture is cancelled by simply picking another material.
    await uvw.getByRole('button', { name: 'Replace Texture…', exact: true }).click();
    const library = uvw.getByRole('dialog', { name: 'Material and Texture Library', exact: true });
    await library.waitFor();
    await library.getByRole('button', { name: 'Standard', exact: true }).click();
    await library.getByLabel('Texture source', { exact: true }).selectOption('custom');
    await library.getByLabel('Vibe search', { exact: true }).uncheck();
    await library.getByLabel('Search textures', { exact: true }).fill('Trial.tga');
    await library.locator('.tl-tile').filter({ hasText: 'Trial' }).first().click();
    await library.getByRole('button', { name: 'Preview Texture in Editor', exact: true }).click();
    await library.waitFor({ state: 'detached' });
    await saveTexture.waitFor();
    await main.waitForFunction(() => nativeTexture() === 'Trial.tga');

    await picker.selectOption('1');
    await saveTexture.waitFor({ state: 'detached' });
    await main.waitForFunction(() => savedMaterial() === 1);
    await main.waitForFunction(() => nativeTexture() === 'Second.tga');
    assert.equal(await main.evaluate(() => uvProps().model.Textures.some(texture => texture.Image === 'Trial.tga')), false);
    assert.equal(await uvw.getByRole('dialog').count(), 0);

    // The live preview keeps its normal mouse camera after a material change.
    const canvas = uvw.locator('.uv-preview-canvas canvas').first();
    const box = await canvas.boundingBox();
    const before = await canvas.screenshot();
    await main.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await main.mouse.down({ button: 'right' });
    await main.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 20, { steps: 8 });
    await main.mouse.up({ button: 'right' });
    await main.waitForTimeout(1500);
    assert.notDeepEqual(await canvas.screenshot(), before, 'the preview camera did not move');
    await main.screenshot({ path: path.join(out, 'assigned.png') });
    console.log(JSON.stringify({ output: out, checks: ['every model material listed', 'direct assign reaches native preview', 'undo restores', 'unsaved test texture cancelled without a prompt', 'preview camera drag still works'] }));
  } catch (error) {
    if (!main.isClosed()) { await main.screenshot({ path: path.join(out, 'failure.png') }); console.error(await main.locator('body').innerText()); }
    throw error;
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
