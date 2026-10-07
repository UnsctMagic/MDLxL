const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
function png() {
  const crc = bytes => { let value = -1; for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ -1) >>> 0; };
  const chunk = (tag, data) => { const name = Buffer.from(tag), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([size, name, data, checksum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
  const row = Buffer.from([0, 255, 255, 255, 150, 255, 255, 255, 150]);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat([row, row]))), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const { createDemoDocument, openDocument, validateModel } = await import('../src/editor-document.js');
  const root = path.resolve(__dirname, '..'), output = path.join(root, 'out/sort-my-mess-proof'); fs.mkdirSync(output, { recursive: true });
  for (const name of ['smm-skin.png','smm-team.png','smm-render.png','smm-other.png']) fs.writeFileSync(path.join(output, name), png());
  const doc = createDemoDocument();
  const material = (TextureID, FilterMode = 0, Alpha = 1) => ({ PriorityPlane: 0, RenderMode: 0, Layers: [{ TextureID, FilterMode, Alpha, Shading: 16, CoordId: 0, TVertexAnimId: null }] });
  doc.apply('Create sorting fixture', ['Textures','Materials','Geosets','GeosetAnims','Info'], model => {
    const base = model.Geosets[0];
    model.Textures = ['smm-skin.png','smm-team.png','smm-render.png','smm-other.png'].map(Image => ({ Image, ReplaceableId: 0, Flags: 0 }));
    model.Textures.push({ Image: '', ReplaceableId: 1, Flags: 0 }, { Image: 'smm-skin.png', ReplaceableId: 0, Flags: 0 });
    model.Materials = [material(0), material(5), material(0), material(1, 2), { ...material(1, 2), Layers: [material(4).Layers[0], material(1, 2).Layers[0]] }, material(2, 3), material(2, 5), material(2, 3, .25), material(3)];
    model.Geosets = model.Materials.map((_, MaterialID) => { const geo = structuredClone(base); geo.MaterialID = MaterialID; for (let i = 0; i < geo.Vertices.length; i += 3) geo.Vertices[i] += MaterialID * 42; return geo; });
    model.GeosetAnims = model.Geosets.map((_, GeosetId) => ({ GeosetId, Alpha: 1, Flags: GeosetId < 3 ? 2 : 0, Color: new Float32Array([[1,0,0],[.8,.1,.1],[.7,.15,.15]][GeosetId] || [1,1,1]) }));
  });
  const modelFile = path.join(output, 'sort-fixture.mdx'); fs.writeFileSync(modelFile, doc.serialize('mdx')); const source = fs.readFileSync(modelFile);
  const exe = process.env.MDLXL_SORT_EXE || path.join(root, 'out/sort-my-mess-native/MDLxL-win32-x64/MDLxL.exe');
  const app = await _electron.launch({ executablePath: exe, args: [modelFile], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  const errors = []; let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', cause => errors.push(cause.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(1400, 950); win.setPosition(-3000, 0); win.webContents.setBackgroundThrottling(false); win.showInactive(); });
    await page.getByText('Opened sort-fixture.mdx', { exact: true }).waitFor();
    const menu = kind => app.evaluate(({ BrowserWindow }, kind) => BrowserWindow.getAllWindows()[0].webContents.send('menu', kind), kind);
    await menu('Materials'); await page.getByRole('dialog', { name: 'Material Manager', exact: true }).waitFor();
    await page.evaluate(() => { const root = document.querySelector('.re-window'); for (let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.doc?.serialize) { window.sortDoc = fiber.memoizedProps.doc; break; } });
    const originalState = await page.evaluate(() => JSON.stringify(sortDoc.model));
    assert.equal(await page.getByRole('button', { name: 'Sort My Mess', exact: true }).count(), 1);
    assert.equal(await page.locator('.smm-window').count(), 0);
    await page.screenshot({ path: path.join(output, 'manager-default.png') });
    const start = async () => { await page.getByRole('button', { name: 'Sort My Mess', exact: true }).click(); await page.getByText('Different RGB', { exact: true }).waitFor(); };
    await start();
    await page.evaluate(() => { window.sortPreview = () => [...document.querySelectorAll('.smm-previews .game-preview-root')].map(root => {
      let props, runtime;
      for (let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) { const value = hook.memoizedState?.current; if (value?.native && value?.controls) runtime = value; if (value?.model?.Geosets && value?.compareCamera) props = value; }
      if (!runtime || !props) return null;
      return { ids: props.isolatedGeosets, hidden: [...props.hiddenGeosets], position: runtime.controls.object.position.toArray(), zoom: runtime.controls.object.zoom, frame: runtime.native.getFrame(), tint: props.model.GeosetAnims.slice(0, 3).map(anim => Array.from(anim.Color)) };
    }); });
    await page.waitForFunction(() => sortPreview().length === 2 && sortPreview().every(Boolean));
    let previews = await page.evaluate(() => sortPreview());
    for (const preview of previews) { assert.deepEqual(preview.ids, [0,1,2]); assert.deepEqual(preview.hidden, [3,4,5,6,7,8]); }
    assert.notDeepEqual(previews[0].tint, previews[1].tint);
    const beforeCamera = previews[0].position, box = await page.getByLabel('Before preview', { exact: true }).boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width * .6, box.y + box.height * .6, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(old => Math.hypot(...sortPreview()[0].position.map((v, i) => v - old[i])) > 1, beforeCamera);
    previews = await page.evaluate(() => sortPreview()); previews[0].position.forEach((value, i) => assert.ok(Math.abs(value - previews[1].position[i]) < 1e-8));
    await page.screenshot({ path: path.join(output, 'rgb-before-after.png') });
    await page.getByRole('button', { name: 'Play comparison', exact: true }).click();
    await page.waitForFunction(() => sortPreview()[0].frame > 50);
    await page.getByRole('button', { name: 'Pause comparison', exact: true }).click();
    previews = await page.evaluate(() => sortPreview()); assert.ok(Math.abs(previews[0].frame - previews[1].frame) < 2);
    await page.getByRole('slider', { name: 'Comparison frame' }).fill('1000');
    await page.waitForFunction(() => sortPreview().every(preview => Math.abs(preview?.frame - 1000) < 2));
    await page.getByRole('slider', { name: 'Comparison frame' }).fill('100');
    await page.waitForFunction(() => sortPreview().every(preview => Math.abs(preview?.frame - 100) < 2));
    await page.getByRole('slider', { name: 'Comparison frame' }).fill('1990');
    await page.waitForFunction(() => sortPreview().every(preview => Math.abs(preview?.frame - 1990) < 2));
    await page.getByRole('button', { name: 'Play comparison', exact: true }).click();
    await page.waitForFunction(() => sortPreview().every(preview => preview?.frame < 500));
    await page.getByRole('button', { name: 'Pause comparison', exact: true }).click();
    await page.getByRole('button', { name: 'Choose most similar RGB', exact: true }).click();
    await page.getByText('Team color', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close Sort My Mess', exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.stringify(sortDoc.model)), originalState, 'Cancel discards accepted draft decisions and exact cleanup');
    await page.getByRole('button', { name: 'Textures', exact: true }).click();
    await page.getByRole('dialog', { name: 'Texture Manager', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Sort My Mess', exact: true }).count(), 1);
    await start(); await page.getByRole('button', { name: 'Ignore', exact: true }).click();
    await page.getByText('Team color', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Remove team color', exact: true }).click();
    await page.waitForFunction(() => sortPreview().every(Boolean));
    previews = await page.evaluate(() => sortPreview()); assert.deepEqual(previews[0].ids, [3,4]);
    await page.screenshot({ path: path.join(output, 'team-remove-before-after.png') });
    await page.getByRole('button', { name: 'Merge & next', exact: true }).click();
    await page.getByText('Different rendering', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Use Modulate/ }).click();
    await page.waitForFunction(() => sortPreview().every(Boolean));
    previews = await page.evaluate(() => sortPreview()); assert.deepEqual(previews[0].ids, [5,6]);
    await page.screenshot({ path: path.join(output, 'modulate-before-after.png') });
    await page.getByRole('button', { name: 'Merge & next', exact: true }).click();
    await page.getByText('All done', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(sortDoc.model)), originalState, 'Live document remains untouched until Done');
    await page.screenshot({ path: path.join(output, 'done.png') });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const result = await page.evaluate(() => ({ materials: sortDoc.model.Materials.length, textures: sortDoc.model.Textures.length, tint: sortDoc.model.GeosetAnims.slice(0, 3).map(a => Array.from(a.Color)), ids: sortDoc.model.Geosets.map(g => g.MaterialID), alpha: sortDoc.model.Materials[sortDoc.model.Geosets[7].MaterialID].Layers[0].Alpha, filter: sortDoc.model.Materials[sortDoc.model.Geosets[5].MaterialID].Layers[0].FilterMode, bytes: Array.from(sortDoc.serialize('mdx')) }));
    assert.equal(result.materials, 5); assert.equal(result.textures, 5); assert.equal(result.alpha, .25); assert.equal(result.filter, 5);
    assert.equal(result.ids[3], result.ids[4]); assert.equal(result.ids[5], result.ids[6]); assert.notEqual(result.ids[5], result.ids[7]);
    assert.deepEqual(result.tint, openDocument(source, 'fixture.mdx').model.GeosetAnims.slice(0, 3).map(a => Array.from(a.Color)));
    assert.equal(validateModel(openDocument(new Uint8Array(result.bytes), 'sorted.mdx').model).filter(d => d.severity === 'error').length, 0);
    await page.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.stringify(sortDoc.model)), originalState);
    await page.getByRole('button', { name: 'Redo manager edit', exact: true }).click();
    assert.equal(await page.evaluate(() => sortDoc.model.Materials.length), 5);
    assert.deepEqual(fs.readFileSync(modelFile), source); assert.deepEqual(errors, []);
    console.log(JSON.stringify({ packagedExecutable: exe, materials: '9 -> 5', textures: '6 -> 5', rgbIgnored: true, visibilityPreserved: true, cancelledDraftPreserved: true, cameraSynchronized: true, isolation: [[0,1,2],[3,4],[5,6]], saveReopen: true, undoRedo: true, sourceUnchanged: true, screenshots: output }));
  } catch (cause) { if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw cause; }
  finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close(); }
})().catch(cause => { console.error(cause); process.exitCode = 1; });
