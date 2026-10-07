// Verify collection preserves every RGB palette track; import selects one RGB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), output = process.env.MDLXL_TEST_OUTPUT || path.join(root, 'out', 'bit-collection'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument, validateModel } = await import('../src/editor-document.js');
  const { encodeForgeTga } = await import('../src/forge.js');
  const { sampleGeosetAnimation } = await import('../src/animation.js');
  const doc = createStarterDocument(), name = `Collected UI Bit ${Date.now()}`, fixture = path.join(output, 'collection-source.mdx');
  const texture = encodeForgeTga({ width: 2, height: 2, data: new Uint8Array(16).fill(255) }), texturePath = `Textures\\${name}\\Original Skin.TGA`;
  fs.mkdirSync(path.join(output, path.dirname(texturePath)), { recursive: true }); fs.writeFileSync(path.join(output, texturePath), texture);
  doc.apply('Fixture', [], model => {
    model.Textures[0].Image = texturePath;
    for (let gi = 1; gi < 5; gi++) { model.Geosets.push(structuredClone(model.Geosets[0])); for (let vi = 0; vi < model.Geosets[gi].Vertices.length; vi += 3) model.Geosets[gi].Vertices[vi] += 90 * gi; }
    model.Sequences = ['Red', 'Green', 'Blue'].map((Name, si) => ({ Name, Interval: new Uint32Array([1000 + si * 2000, 1900 + si * 2000]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: model.Info.MinimumExtent.slice(), MaximumExtent: model.Info.MaximumExtent.slice(), BoundsRadius: model.Info.BoundsRadius }));
    model.GeosetAnims = model.Geosets.map((_, GeosetId) => ({ GeosetId, Flags: 2, Alpha: 1, Color: { LineType: 1, GlobalSeqId: null, Keys: model.Sequences.flatMap((sequence, si) => [sequence.Interval[0], sequence.Interval[1]].map(Frame => ({ Frame, Vector: Float32Array.from([si === 0 ? 1 : 0, si === 1 ? 1 : 0, si === 2 ? 1 : 0].map(value => value * (1 - GeosetId / 8))) }))) } }));
  });
  const original = Buffer.from(doc.serialize('mdx')); fs.writeFileSync(fixture, original);
  const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'), bank = path.join(process.env.MDLXL_TEST_EXE ? path.dirname(executable) : root, 'BitsAndParts');
  const savedFile = path.join(bank, name + '.mdx'), savedTexture = path.join(bank, texturePath);
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', ...(process.env.MDLXL_TEST_EXE ? [] : [root]), fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'collection-profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(), errors = []; page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.stack || error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setSize(1280, 900); window.show(); });
    await page.locator('.classic-view [aria-label="3D model viewport"]').waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.bitTestState = selector => {
        const host = document.querySelector(selector || '.classic-view [aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))]; const result = {};
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.doc?.apply) result.app = current;
          if (current?.renderer && current?.entries) result.viewport = current;
          if (current?.model && current?.preferences) result.props = current;
        }
        return result;
      };
    });
    await page.waitForFunction(() => bitTestState().app.doc.model.Geosets.length === 5);
    const before = await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx')));
    const sidebar = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    await page.locator('[data-warmkey="bitsAndParts"]').click();
    assert.equal(await page.getByRole('button', { name: 'Collect Bit', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Close BitsAndParts', exact: true }).click();
    await page.locator('[data-warmkey="geosetsAll"]').click();
    await page.evaluate(() => bitTestState().props.onSelectionChange(Object.fromEntries(Array.from({ length: 5 }, (_, gi) => [gi, Array.from({ length: 8 }, (_, vi) => vi)]))));
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 40'));
    await page.waitForFunction(name => bitTestState().app.session.assets.has(name.toLowerCase()), texturePath);
    await page.locator('[data-warmkey="bitsAndParts"]').click(); await page.getByRole('button', { name: 'Collect Bit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Collect Bit', exact: true }); await dialog.waitFor();
    assert.match(await dialog.innerText(), /5 geosets · 40 selected vertices/);
    assert.equal(await dialog.getByText('Select animations and rename', { exact: true }).count(), 0);
    await page.getByLabel('Bit name', { exact: true }).fill(name); await page.getByLabel('RGB animation', { exact: true }).selectOption('0');
    await page.waitForFunction(() => bitTestState('.parts-preview [aria-label="3D model viewport"]').viewport?.entries.every((entry, gi) => entry.meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().join(',') === [1 - gi / 8, 0, 0].join(','))));
    await page.screenshot({ path: path.join(output, 'collected-red-palette.png') });
    await page.getByRole('button', { name: 'Save Bit', exact: true }).click();
    await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor(); await page.getByLabel('RGB animation', { exact: true }).waitFor();
    const collected = openDocument(fs.readFileSync(savedFile), name + '.mdx');
    assert.equal(collected.model.Textures[0].Image, texturePath);
    assert.deepEqual(collected.model.Geosets.map(geoset => geoset.Vertices.length / 3), [8, 8, 8, 8, 8]);
    assert.deepEqual(collected.model.Sequences.map(sequence => sequence.Name), ['Red', 'Green', 'Blue']);
    for (let si = 0; si < 3; si++) for (let gi = 0; gi < 5; gi++) assert.deepEqual(sampleGeosetAnimation(collected.model, gi, collected.model.Sequences[si].Interval[0], si).color, sampleGeosetAnimation(doc.model, gi, doc.model.Sequences[si].Interval[0], si).color);
    assert.deepEqual(fs.readFileSync(savedTexture), Buffer.from(texture));
    assert.deepEqual(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx'))), before);
    await page.getByLabel('RGB animation', { exact: true }).selectOption('2');
    await page.waitForFunction(() => bitTestState('.parts-preview [aria-label="3D model viewport"]').viewport?.entries.every((entry, gi) => entry.meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().join(',') === [0, 0, 1 - gi / 8].join(','))));
    await page.screenshot({ path: path.join(output, 'import-blue-palette.png') });
    await page.getByRole('button', { name: 'Import whole part', exact: true }).click();
    await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor({ state: 'detached' });
    const imported = openDocument(new Uint8Array(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx')))));
    assert.equal(imported.model.Geosets.length, 10); assert.equal(imported.model.Sequences.length, 3);
    for (let gi = 0; gi < 5; gi++) assert.deepEqual(sampleGeosetAnimation(imported.model, gi + 5, 0, -1).color, [0, 0, 1 - gi / 8]);
    assert.equal(imported.model.Textures.length, 1); assert.equal(imported.model.Materials.length, 1);
    assert.deepEqual(validateModel(imported.model).filter(issue => issue.severity === 'error'), []);
    await page.locator('[data-warmkey="undo"]').click(); assert.deepEqual(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx'))), before);
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebar);
    assert.ok(fs.readFileSync(fixture).equals(original)); assert.deepEqual(errors, []);
    console.log('PASS packaged collection: all RGB animation tracks saved; Red and Blue render correctly; per-geoset selected RGB import, textures/materials reused, donor and sidebar preserved.');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close(); for (const file of [savedFile, savedTexture]) if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
