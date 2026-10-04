// Run after building dist; set MDLXL_PLAYWRIGHT_MODULE to the installed Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), output = path.join(root, 'out', 'bit-collection'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument, validateModel } = await import('../src/editor-document.js');
  const { encodeForgeTga } = await import('../src/forge.js');
  const { sampleGeosetAnimation } = await import('../src/animation.js');
  const doc = createStarterDocument(), name = `Collected UI Bit ${Date.now()}`, fixture = path.join(output, 'source.mdx');
  const texture = encodeForgeTga({ width: 2, height: 2, data: new Uint8Array(16).fill(255) });
  const expectedAsset = path.join(root, 'BitsAndParts', 'MDLxL_Parts', require('node:crypto').createHash('sha256').update(texture).digest('hex') + '.tga');
  const assetExisted = fs.existsSync(expectedAsset);
  fs.writeFileSync(path.join(output, 'white.tga'), texture);
  doc.apply('Fixture', [], model => {
    model.Textures[0].Image = 'white.tga';
    for (let gi = 1; gi < 5; gi++) model.Geosets.push(structuredClone(model.Geosets[0]));
    for (let gi = 1; gi < 5; gi++) for (let vertex = 0; vertex < model.Geosets[gi].Vertices.length; vertex += 3) model.Geosets[gi].Vertices[vertex] += 90 * gi;
    model.Sequences = ['Stand', 'Walk', 'Attack'].map((Name, si) => ({ Name, Interval: new Uint32Array([1000 + si * 2000, 1900 + si * 2000]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: model.Info.MinimumExtent.slice(), MaximumExtent: model.Info.MaximumExtent.slice(), BoundsRadius: model.Info.BoundsRadius }));
    model.GeosetAnims = model.Geosets.map((_, GeosetId) => ({ GeosetId, Flags: 2, Alpha: 1, Color: { LineType: 1, GlobalSeqId: null, Keys: model.Sequences.flatMap((sequence, si) => [sequence.Interval[0], sequence.Interval[1]].map((Frame, ki) => ({ Frame, Vector: new Float32Array([(GeosetId + si + ki) % 5 / 4, GeosetId / 4, 1 - GeosetId / 4]) }))) } }));
  });
  const original = Buffer.from(doc.serialize('mdx')); fs.writeFileSync(fixture, original);
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', root, fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  let savedAssets = [], savedModels = [];
  try {
    const page = await app.firstWindow(), errors = []; page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.bitTestState = selector => {
        const host = document.querySelector(selector || '[aria-label="3D model viewport"]');
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
    const before = await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx')));
    const sidebar = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    assert.equal(await page.locator('.pressed-keys-tool img').getAttribute('src'), './classic/btn-magical-sentry.png');
    assert.equal(await page.locator('.pressed-keys-tool>span:not(.warmkey-badge)').textContent(), 'KEY');
    await page.locator('[data-warmkey="bitsAndParts"]').click();
    await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Collect Bit', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Close BitsAndParts', exact: true }).click();
    await page.locator('[data-warmkey="geosetsAll"]').click();
    // Copy five complete geosets through the existing vertex selection callback.
    // Partial patches and loose points are covered in bit-collection.test.js.
    await page.evaluate(() => bitTestState().props.onSelectionChange(Object.fromEntries(Array.from({ length: 5 }, (_, gi) => [gi, Array.from({ length: 8 }, (_, vi) => vi)]))));
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 40'));
    await page.waitForFunction(() => bitTestState().app.session.assets.has('white.tga'));
    await page.locator('[data-warmkey="bitsAndParts"]').click();
    const cases = [null, [{ sequenceIndex: 1, name: 'Walking colors' }], [{ sequenceIndex: 0, name: 'Idle colors' }, { sequenceIndex: 2, name: 'Attack colors' }]];
    for (let ci = 0; ci < cases.length; ci++) {
      if (ci) {
        await page.locator('[data-warmkey="geosetsAll"]').click();
        await page.evaluate(() => bitTestState().props.onSelectionChange(Object.fromEntries(Array.from({ length: 5 }, (_, gi) => [gi, Array.from({ length: 8 }, (_, vi) => vi)]))));
        await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 40'));
        await page.locator('[data-warmkey="bitsAndParts"]').click();
      }
      await page.getByRole('button', { name: 'Collect Bit', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Collect Bit', exact: true }); await dialog.waitFor();
      assert.match(await dialog.innerText(), /5 geosets · 40 selected vertices/);
      assert.equal(await page.getByLabel('Import as is', { exact: true }).isChecked(), true);
      assert.equal(await dialog.getByText('Source RGB key', { exact: true }).count(), 0);
      const bitName = name + '-' + ci, file = path.join(root, 'BitsAndParts', bitName + '.mdx'); savedModels.push(file);
      await page.getByLabel('Bit name', { exact: true }).fill(bitName);
      const chosen = cases[ci];
      if (chosen) {
        await page.getByLabel('Select animations and rename', { exact: true }).check();
        assert.equal(await page.getByRole('button', { name: 'Save Bit', exact: true }).isDisabled(), true);
        for (const { sequenceIndex, name } of chosen) {
          await page.getByLabel(`Include animation ${sequenceIndex + 1}: ${doc.model.Sequences[sequenceIndex].Name}`, { exact: true }).check();
          await page.getByLabel(`Animation ${sequenceIndex + 1} name`, { exact: true }).fill(name);
        }
      }
      await page.getByLabel('Preview animation', { exact: true }).selectOption('0');
      await page.waitForFunction(() => {
        const state = bitTestState('.parts-preview [aria-label="3D model viewport"]');
        return state.viewport?.entries?.length === 5 && state.viewport.entries.every((entry, gi) => entry.meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().every((value, channel) => Math.abs(value - [gi / 4, gi / 4, 1 - gi / 4][channel]) < 1e-6)));
      });
      await page.screenshot({ path: path.join(output, 'collection-' + ci + '.png') });
      await page.getByRole('button', { name: 'Save Bit', exact: true }).click();
      await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor();
      await page.getByLabel('Preview animation', { exact: true }).waitFor();
      const collected = openDocument(fs.readFileSync(file), bitName + '.mdx');
      assert.deepEqual(collected.model.Geosets.map(geoset => geoset.Vertices.length / 3), [8, 8, 8, 8, 8]);
      assert.deepEqual(collected.model.Sequences.map(sequence => sequence.Name), chosen?.map(item => item.name) || ['Stand', 'Walk', 'Attack']);
      const sourceIndices = chosen?.map(item => item.sequenceIndex) || [0, 1, 2];
      for (let si = 0; si < sourceIndices.length; si++) for (let gi = 0; gi < 5; gi++) {
        const frame = collected.model.Sequences[si].Interval[0] + 450;
        assert.deepEqual(sampleGeosetAnimation(collected.model, gi, frame, si), sampleGeosetAnimation(doc.model, gi, doc.model.Sequences[sourceIndices[si]].Interval[0] + 450, sourceIndices[si]));
      }
      const textureFile = path.join(root, 'BitsAndParts', collected.model.Textures[0].Image);
      assert.equal(textureFile, expectedAsset); if (!assetExisted) savedAssets = [textureFile];
      assert.deepEqual(fs.readFileSync(textureFile), Buffer.from(texture));
      assert.deepEqual(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx'))), before);
      // Exercise the same animation-selection controls on import too.
      await page.getByLabel('Select animations and rename', { exact: true }).check();
      for (let si = 0; si < collected.model.Sequences.length; si++) {
        await page.getByLabel(`Include animation ${si + 1}: ${collected.model.Sequences[si].Name}`, { exact: true }).check();
        await page.getByLabel(`Animation ${si + 1} name`, { exact: true }).fill('Imported ' + collected.model.Sequences[si].Name);
      }
      await page.getByRole('button', { name: 'Import whole part', exact: true }).click();
      await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor({ state: 'detached' });
      const imported = openDocument(new Uint8Array(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx')))));
      assert.equal(imported.model.Geosets.length, 10);
      assert.deepEqual(imported.model.Sequences.slice(3).map(item => item.Name), collected.model.Sequences.map(item => 'Imported ' + item.Name));
      for (let si = 0; si < collected.model.Sequences.length; si++) for (let gi = 0; gi < 5; gi++) {
        const frame = imported.model.Sequences[si + 3].Interval[0] + 450;
        assert.deepEqual(sampleGeosetAnimation(imported.model, gi + 5, frame, si + 3), sampleGeosetAnimation(collected.model, gi, collected.model.Sequences[si].Interval[0] + 450, si));
      }
      assert.deepEqual(validateModel(imported.model).filter(issue => issue.severity === 'error'), []);
      await page.locator('[data-warmkey="undo"]').click();
      assert.deepEqual(await page.evaluate(() => Array.from(bitTestState().app.doc.serialize('mdx'))), before);
    }
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebar);
    assert.ok(fs.readFileSync(fixture).equals(original)); assert.deepEqual(errors, []);
    console.log('PASS Electron: five independent geoset RGB tracks in live preview; as-is, single and multiple renamed animation collection; disk save/reopen and selected animation import; donor bytes and sidebar preserved.');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close(); for (const file of savedModels) if (fs.existsSync(file)) fs.unlinkSync(file); for (const file of savedAssets) if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
