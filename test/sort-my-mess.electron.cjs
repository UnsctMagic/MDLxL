const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
function png(rgba) {
  const crc = bytes => { let value = -1; for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); } return (value ^ -1) >>> 0; };
  const chunk = (tag, data) => { const name = Buffer.from(tag), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([size, name, data, checksum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
  const row = Buffer.from([0, ...rgba, ...rgba]);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat([row, row]))), chunk('IEND', Buffer.alloc(0))]);
}
// Run on a separate desktop: the packaged window must never reach the user's screen.
(async () => {
  const { createDemoDocument, openDocument, validateModel } = await import('../src/editor-document.js');
  const root = path.resolve(__dirname, '..'), output = path.join(root, 'out/sort-my-mess-proof'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'smm-skin.png'), png([210, 180, 140, 255])); fs.writeFileSync(path.join(output, 'smm-other.png'), png([90, 140, 220, 255]));
  const doc = createDemoDocument();
  const layer = TextureID => ({ TextureID, FilterMode: 0, Shading: 16, Alpha: 1, CoordId: 0, TVertexAnimId: null });
  const steps = (...pairs) => ({ LineType: 0, GlobalSeqId: null, Keys: pairs.map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) });
  doc.apply('Create sorting fixture', ['Sequences', 'Textures', 'Materials', 'Geosets', 'GeosetAnims', 'Info'], model => {
    const extent = model.Sequences[0];
    model.Sequences = [['Stand', 0, 1000], ['Death', 1100, 2000], ['Portrait', 2100, 3000]].map(([Name, start, end]) => ({ ...structuredClone(extent), Name, Interval: new Uint32Array([start, end]) }));
    for (const geoset of model.Geosets) geoset.Anims = model.Sequences.map(() => structuredClone(geoset.Anims[0]));
    // Skin is imported twice; materials 1 and 2 are identical; part 4 is an exact copy of part 2.
    model.Textures = [{ Image: 'smm-skin.png', ReplaceableId: 0, Flags: 0 }, { Image: 'smm-skin.png', ReplaceableId: 0, Flags: 0 }, { Image: 'smm-other.png', ReplaceableId: 0, Flags: 0 }];
    model.Materials = [0, 1, 0, 2].map(id => ({ PriorityPlane: 0, RenderMode: 0, Layers: [layer(id)] }));
    model.Geosets[3] = structuredClone(model.Geosets[1]);
    model.Geosets.forEach((geoset, i) => { geoset.MaterialID = [0, 1, 2, 1, 3][i]; });
    model.GeosetAnims = model.Geosets.map((_, GeosetId) => ({ GeosetId, Alpha: GeosetId === 2 ? steps([2100, 0]) : 1, Flags: GeosetId === 2 ? 2 : 0, Color: new Float32Array(GeosetId === 2 ? [1, 0, 0] : [1, 1, 1]) }));
  });
  const modelFile = path.join(output, 'sort-fixture.mdx'); fs.writeFileSync(modelFile, doc.serialize('mdx')); const source = fs.readFileSync(modelFile);
  const exe = process.env.MDLXL_SORT_EXE || path.join(root, 'out/sort-my-mess-native/MDLxL-win32-x64/MDLxL.exe');
  // Without a display the compositor runs at about 1 fps; these flags restore real playback timing.
  const app = await _electron.launch({ executablePath: exe, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', modelFile], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 90000 });
  const errors = []; let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', cause => errors.push(cause.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(1500, 980); win.webContents.setBackgroundThrottling(false); win.showInactive(); });
    await page.getByText('Opened sort-fixture.mdx', { exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Materials'));
    await page.getByRole('dialog', { name: 'Material Manager', exact: true }).waitFor();
    await page.evaluate(() => { const root = document.querySelector('.re-window'); for (let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.doc?.serialize) { window.sortDoc = fiber.memoizedProps.doc; break; } });
    const originalState = await page.evaluate(() => JSON.stringify(sortDoc.model));
    assert.equal(await page.locator('.smm-window').count(), 0);
    await page.getByRole('button', { name: 'Sort My Mess', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Sort My Mess' }); await dialog.waitFor();
    await page.evaluate(() => { window.sortPreview = () => [...document.querySelectorAll('.smm-previews .game-preview-root')].map(root => {
      let props, runtime;
      for (let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) { const value = hook.memoizedState?.current; if (value?.native && value?.controls) runtime = value; if (value?.model?.Geosets && value?.compareCamera) props = value; }
      if (!runtime || !props) return null;
      return { ids: props.isolatedGeosets || null, geosets: props.model.Geosets.length, position: runtime.controls.object.position.toArray(), frame: runtime.native.getFrame() };
    }); });

    // 1. List first: groups by texture, numbers as shown in MDLxL, nothing applied.
    const rows = page.locator('.smm-row:not(.smm-head)'), row = name => rows.filter({ hasText: name }).first();
    assert.deepEqual(await rows.locator('[role=cell]:first-child').allInnerTexts(), ['smm-other', 'smm-skin']);
    const skinRow = await row('smm-skin').innerText();
    for (const text of ['1, 2, 3, 4', 'M1, M2, M3', 'RGB', 'Visibility', 'Same shape', 'Records', 'Delete 4 (copy of 2)', 'Merge 1 + 2 → 1', 'Share identical records']) assert.ok(skinRow.includes(text), `${text} in ${skinRow}`);
    assert.equal(await page.getByRole('button', { name: 'Apply selected', exact: true }).isDisabled(), true);
    await page.waitForFunction(() => sortPreview().length === 2 && sortPreview().every(Boolean));
    assert.deepEqual((await page.evaluate(() => sortPreview())).map(preview => preview.ids), [null, null]);
    await page.screenshot({ path: path.join(output, '01-list.png') });

    // 2. Differences with exact per-animation visibility, then choices.
    await row('smm-skin').click();
    const details = page.locator('.smm-details');
    for (const text of ['Portrait', 'hidden', '255,0,0', 'exact copies', 'imported 2 times']) assert.ok((await details.innerText()).includes(text), text);
    await page.waitForFunction(() => sortPreview().every(preview => preview?.ids?.join() === '0,1,2,3'));
    await page.getByRole('button', { name: 'Use proposed fix', exact: true }).click();
    await page.getByLabel('Action for geoset 3', { exact: true }).selectOption('0');
    await page.getByRole('radiogroup', { name: 'Color for geoset 1' }).getByRole('radio').filter({ hasText: '255,0,0' }).click();
    await page.getByRole('radiogroup', { name: 'Visibility from for geoset 1' }).getByRole('radio').filter({ hasText: /^3/ }).click();
    const chips = page.getByRole('group', { name: 'Visibility of geoset 1 by animation' }), portrait = chips.getByRole('button', { name: 'Portrait', exact: true });
    await page.waitForFunction(() => document.querySelector('[aria-label="Visibility of geoset 1 by animation"] button:nth-child(3)')?.getAttribute('aria-pressed') === 'false');
    await portrait.click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Visibility of geoset 1 by animation"] button:nth-child(3)')?.getAttribute('aria-pressed') === 'true');
    const changes = await page.locator('.smm-changes').innerText();
    for (const text of ['merged into 1', 'deleted', 'RGB none → 255,0,0']) assert.ok(changes.includes(text), `${text} in ${changes}`);
    await page.waitForFunction(() => sortPreview()[1]?.ids?.join() === '0' && sortPreview()[1].geosets === 2);
    assert.equal(await page.evaluate(() => JSON.stringify(sortDoc.model)), originalState, 'Choices change nothing before Apply');
    await page.screenshot({ path: path.join(output, '02-choices.png') });

    // 3. Choices persist while another group is opened.
    await row('smm-other').click();
    assert.equal(await row('smm-skin').locator('.smm-status').innerText(), 'Selected');
    assert.deepEqual(await page.getByLabel('Action for geoset 5', { exact: true }).locator('optgroup option').allInnerTexts(), ['Merge into 1 · smm-skin'], 'only kept parts of other textures are offered');
    await row('smm-skin').click();
    assert.equal(await page.getByLabel('Action for geoset 3', { exact: true }).inputValue(), '0');

    // 4. Mouse rotation turns both previews together.
    let previews = await page.evaluate(() => sortPreview()); const start = previews[0].position, box = await page.getByLabel('Before preview', { exact: true }).boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .6, { steps: 10 }); await page.mouse.up();
    await page.waitForFunction(old => Math.hypot(...sortPreview()[0].position.map((v, i) => v - old[i])) > 1, start);
    previews = await page.evaluate(() => sortPreview()); previews[0].position.forEach((value, i) => assert.ok(Math.abs(value - previews[1].position[i]) < 1e-6));

    // 5. Playback runs at real speed and both previews stay on the same frame.
    await page.getByRole('slider', { name: 'Comparison frame' }).fill('0');
    await page.waitForFunction(() => sortPreview().every(preview => preview.frame < 5));
    await page.getByRole('button', { name: 'Play comparison', exact: true }).click();
    const began = Date.now(); await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Pause comparison', exact: true }).click();
    const elapsed = Date.now() - began; previews = await page.evaluate(() => sortPreview());
    assert.ok(previews[0].frame > elapsed * .6 && previews[0].frame <= elapsed + 50, `played ${previews[0].frame} ms of animation in ${elapsed} ms`);
    assert.ok(Math.abs(previews[0].frame - previews[1].frame) < 2);
    await page.locator('.smm-check').getByRole('button', { name: 'Portrait', exact: true }).click();
    await page.waitForFunction(() => sortPreview().every(preview => Math.abs(preview.frame - 2100) < 2));

    // 6. Apply: one undoable edit, mapping summary, refreshed list.
    await page.getByRole('button', { name: 'Apply 1 selected', exact: true }).click();
    const summary = page.locator('.smm-applied'); await summary.waitFor();
    const text = await summary.innerText();
    for (const part of ['Applied 1 choice', 'Geosets 5 → 2', '1 + 2 + 3 → 1', 'Deleted:', '4', 'Checked: 1 other parts unchanged', 'triangles']) assert.ok(text.includes(part), `${part} in ${text}`);
    await page.getByRole('button', { name: 'Show all 4 changed numbers', exact: true }).click();
    assert.equal((await page.locator('.smm-mapping').innerText()).replace(/\s+/g, ' ').trim(), '2 → 1 3 → 1 4 → — 5 → 2');
    assert.deepEqual(await rows.locator('[role=cell]:nth-child(2)').allInnerTexts(), ['2', '1']);
    await page.screenshot({ path: path.join(output, '03-applied.png') });
    const result = await page.evaluate(() => ({ geosets: sortDoc.model.Geosets.length, materials: sortDoc.model.Materials.length, textures: sortDoc.model.Textures.length, anim: sortDoc.model.GeosetAnims.find(anim => anim.GeosetId === 0), bytes: Array.from(sortDoc.serialize('mdx')) }));
    assert.deepEqual([result.geosets, result.materials, result.textures], [2, 2, 2]);
    assert.deepEqual(Object.values(result.anim.Color), [1, 0, 0]); assert.equal(result.anim.Flags & 2, 2);
    const reopened = openDocument(new Uint8Array(result.bytes), 'sorted.mdx');
    assert.equal(validateModel(reopened.model).filter(d => d.severity === 'error').length, 0);

    // 7. Escape closes; Undo/Redo restore the edit as one step.
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.locator('.smm-window').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.stringify(sortDoc.model)), originalState);
    await page.getByRole('button', { name: 'Redo manager edit', exact: true }).click();
    assert.equal(await page.evaluate(() => sortDoc.model.Geosets.length), 2);
    assert.deepEqual(fs.readFileSync(modelFile), source); assert.deepEqual(errors, []);
    console.log(JSON.stringify({ packagedExecutable: exe, groups: ['smm-other', 'smm-skin'], geosets: '5 -> 2', mapping: '2→1 3→1 4→deleted 5→2', choicesPersist: true, cameraSynchronized: true, playbackMsPerMs: +(previews[0].frame / elapsed).toFixed(2), saveReopen: true, undoRedo: true, sourceUnchanged: true, screenshots: output }));
  } catch (cause) { if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw cause; }
  finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    // A packaged close can hang; never leave the test build running.
    await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 8000))]);
    try { app.process().kill(); } catch {}
  }
})().catch(cause => { console.error(cause); process.exitCode = 1; });
