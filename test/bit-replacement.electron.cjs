// Run after building; MDLXL_TEST_EXE exercises the packaged desktop executable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), output = process.env.MDLXL_TEST_OUTPUT || path.join(root, 'out', 'bit-replacement');
  fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument, validateModel, recalculateExtents } = await import('../src/editor-document.js');
  const { transformVertices } = await import('../src/editor-commands.js');
  const { encodeForgeTga } = await import('../src/forge.js');
  const doc = createStarterDocument(), source = createStarterDocument();
  const texturePath = 'Textures\\Replacement.TGA', texture = encodeForgeTga({ width: 2, height: 2, data: new Uint8Array(16).fill(255) });
  const selection = { 0: Array.from({ length: 8 }, (_, id) => id) };
  doc.apply('Replacement fixture', [], model => {
    model.Textures[0].Image = texturePath;
    model.Materials.push(structuredClone(model.Materials[0])); model.Materials[0].PriorityPlane = 2;
    model.Geosets.push(structuredClone(model.Geosets[0])); model.Geosets[1].MaterialID = 1;
    transformVertices(model.Geosets[0], selection[0], [0, 0, 70], [.4, .4, .4]);
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Color: new Float32Array([1, 0, 0]), Alpha: 1 }];
    recalculateExtents(model);
  });
  source.apply('Bit fixture', [], model => {
    model.Textures[0].Image = 'textures/replacement.tga';
    transformVertices(model.Geosets[0], selection[0], [200, 0, 0], [.3, .3, .7]);
    model.Sequences = ['Red', 'Blue'].map((Name, index) => ({ Name, Interval: Uint32Array.of(1000 + index * 2000, 1900 + index * 2000), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: model.Info.MinimumExtent.slice(), MaximumExtent: model.Info.MaximumExtent.slice(), BoundsRadius: model.Info.BoundsRadius }));
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: 1, _MdxDefaults: { Color: new Float32Array([0, 1, 0]), Alpha: 1 }, Color: { LineType: 1, GlobalSeqId: null, Keys: [1000, 1900, 3000, 3900].map((Frame, index) => ({ Frame, Vector: Float32Array.from(index < 2 ? [1, 0, 0] : [0, 0, 1]) })) } }];
    recalculateExtents(model);
  });
  const fixture = path.join(output, 'replacement-target.mdx'), original = Buffer.from(doc.serialize('mdx'));
  fs.writeFileSync(fixture, original);
  fs.mkdirSync(path.join(output, 'Textures'), { recursive: true }); fs.writeFileSync(path.join(output, texturePath), texture);
  const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe');
  const bank = path.join(process.env.MDLXL_TEST_EXE ? path.dirname(executable) : root, 'BitsAndParts');
  fs.mkdirSync(bank, { recursive: true });
  const bitName = 'Replacement Test Bit ' + Date.now() + '.mdx', bitFile = path.join(bank, bitName);
  const donorBytes = Buffer.from(source.serialize('mdx')); fs.writeFileSync(bitFile, donorBytes);
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', ...(process.env.MDLXL_TEST_EXE ? [] : [root]), fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(), pageErrors = []; page.setDefaultTimeout(15000); page.on('pageerror', error => pageErrors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setSize(1280, 900); window.show(); });
    await page.getByRole('button', { name: 'Quad View', exact: true }).waitFor({ timeout: 60000 });
    await page.locator('.classic-view [aria-label="3D model viewport"]').waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.bitState = selector => {
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
    await page.waitForFunction(() => bitState().app?.doc.model.Info.Name === 'Untitled' && bitState().app.doc.model.Geosets.length === 2);
    const before = await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx')));
    const sidebar = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    await page.locator('[data-warmkey="bitsAndParts"]').click();
    assert.equal(await page.getByRole('button', { name: 'Replace Part', exact: true }).isDisabled(), true);
    assert.deepEqual(await page.locator('.parts-header-actions button').allTextContents(), ['Collect Bit', 'Replace Part']);
    await page.getByRole('button', { name: 'Close BitsAndParts', exact: true }).click();
    await page.locator('[data-warmkey="geosetsAll"]').click();
    await page.evaluate(selection => bitState().props.onSelectionChange(selection), selection);
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 8'));
    await page.waitForFunction(name => bitState().app.session.assets.has(name.toLowerCase()), texturePath);
    const begin = async () => {
      await page.locator('[data-warmkey="bitsAndParts"]').click();
      await page.getByRole('button', { name: 'Replace Part', exact: true }).click();
      await page.waitForFunction(() => bitState('.parts-preview [aria-label="3D model viewport"]').viewport?.entries.length === 1);
      const absent = await page.evaluate(() => {
        const state = bitState('.parts-preview [aria-label="3D model viewport"]');
        return { count: state.props.model.Geosets.length, anims: state.props.model.GeosetAnims.length, quad: state.props.quadView };
      });
      assert.deepEqual(absent, { count: 1, anims: 0, quad: true });
      await page.getByRole('button', { name: bitName, exact: true }).click();
      await page.waitForFunction(() => bitState('.parts-preview [aria-label="3D model viewport"]').viewport?.entries.length === 2);
      await page.waitForFunction(() => { const state = bitState('.parts-preview [aria-label="3D model viewport"]'); return state.viewport.entries[1].meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().join(',') === '0,1,0'); });
    };
    await begin();
    assert.equal(await page.getByText('Select animations and rename', { exact: true }).count(), 0);
    const chooseRgb = async (index, rgb) => {
      await page.getByLabel('RGB animation', { exact: true }).selectOption(String(index));
      await page.waitForFunction(rgb => { const state = bitState('.parts-preview [aria-label="3D model viewport"]'); return state.viewport.entries[1].meshes.every(mesh => mesh.material.userData.geosetTint.value.toArray().join(',') === rgb); }, rgb.join(','));
    };
    await chooseRgb(0, [1, 0, 0]);
    await page.screenshot({ path: path.join(output, 'quad-placement.png') });
    await chooseRgb(1, [0, 0, 1]);
    await page.screenshot({ path: path.join(output, 'blue-placement.png') });
    const incoming = () => page.evaluate(() => { const state = bitState('.parts-preview [aria-label="3D model viewport"]'); return Array.from(state.props.model.Geosets[state.props.selectedGeoset].Vertices); });
    const positioned = await incoming();
    // Drag through the actual front quad pane using the editor's existing tools.
    const preview = await page.locator('.parts-preview').boundingBox();
    const drag = async (dx, dy) => {
      const x = preview.x + preview.width * .25, y = preview.y + preview.height * .25;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 10 }); await page.mouse.up();
    };
    await drag(15, 5); await page.waitForFunction(old => {
      const state = bitState('.parts-preview [aria-label="3D model viewport"]');
      return Array.from(state.props.model.Geosets[state.props.selectedGeoset].Vertices).some((value, index) => value !== old[index]);
    }, positioned);
    const moved = await incoming();
    await page.locator('.parts-placement-tools').getByRole('button', { name: 'Rotate', exact: true }).click(); await drag(12, 0);
    await page.waitForFunction(old => { const state = bitState('.parts-preview [aria-label="3D model viewport"]'); return Array.from(state.props.model.Geosets[state.props.selectedGeoset].Vertices).some((value, index) => value !== old[index]); }, moved);
    const rotated = await incoming();
    await page.locator('.parts-placement-tools').getByRole('button', { name: 'Scale', exact: true }).click(); await drag(12, 0);
    await page.waitForFunction(old => { const state = bitState('.parts-preview [aria-label="3D model viewport"]'); return Array.from(state.props.model.Geosets[state.props.selectedGeoset].Vertices).some((value, index) => value !== old[index]); }, rotated);
    await page.getByRole('button', { name: 'Normal View', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Normal View', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('Placement view', { exact: true }).selectOption('front');
    await page.screenshot({ path: path.join(output, 'normal-placement.png') });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx'))), before);
    await begin();
    await chooseRgb(1, [0, 0, 1]);
    await page.getByRole('button', { name: 'Normal View', exact: true }).click();
    await page.getByLabel('Placement view', { exact: true }).selectOption('front');
    const normalBefore = await incoming();
    await drag(12, 0);
    await page.waitForFunction(old => { const state = bitState('.parts-preview [aria-label="3D model viewport"]'); return Array.from(state.props.model.Geosets[state.props.selectedGeoset].Vertices).some((value, index) => value !== old[index]); }, normalBefore);
    const finalPositions = await incoming();
    await page.getByRole('button', { name: 'Apply replacement', exact: true }).click();
    await page.getByRole('dialog', { name: 'BitsAndParts', exact: true }).waitFor({ state: 'detached' });
    const bytes = new Uint8Array(await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx'))));
    const reopened = openDocument(bytes);
    assert.equal(reopened.model.Geosets.length, 2); assert.equal(reopened.model.Textures.length, 1); assert.equal(reopened.model.Materials.length, 1);
    assert.deepEqual(Array.from(reopened.model.Geosets[1].Vertices), finalPositions);
    assert.deepEqual(reopened.model.Geosets[1].Groups, [[0]]); assert.equal(reopened.model.Bones.length, 1);
    assert.deepEqual(Array.from(reopened.model.GeosetAnims[0].Color), [0, 0, 1]);
    assert.equal(reopened.model.Sequences.length, 0);
    assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []);
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebar);
    await page.locator('[data-warmkey="geosetsAll"]').click();
    await page.screenshot({ path: path.join(output, 'applied-replacement.png') });
    // Selection changes have their own history entries in MDLxL.
    await page.locator('[data-warmkey="undo"]').click();
    await page.locator('[data-warmkey="undo"]').click(); assert.deepEqual(await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx'))), before);
    await page.locator('[data-warmkey="redo"]').click(); assert.deepEqual(await page.evaluate(() => Array.from(bitState().app.doc.serialize('mdx'))), Array.from(bytes));
    assert.ok(fs.readFileSync(fixture).equals(original)); assert.ok(fs.readFileSync(bitFile).equals(donorBytes)); assert.deepEqual(pageErrors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ executable, passed: true, quadMoveRotateScale: true, normalViewMove: true, cancelUnchanged: true, undoRedo: true, textureCount: 1, materialCount: 1, bonesPreserved: true, sidebarWidth: sidebar }, null, 2));
    console.log('PASS packaged Electron: button placement, old part absent, quad move/rotate/scale, normal view move, cancel, replacement, dependency reuse, bones, undo/redo, roundtrip and unchanged fixtures/sidebar.');
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close(); fs.unlinkSync(bitFile); }
})().catch(error => { console.error(error); process.exitCode = 1; });
