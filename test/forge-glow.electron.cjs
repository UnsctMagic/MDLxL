// Run against an isolated packaged executable, never an installed personal app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/glow-ui');
const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'out/glow-native/MDLxL-win32-x64/MDLxL.exe');
const range = (locator, value) => locator.evaluate((el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
const readModel = (selector = '[aria-label="3D model viewport"]') => {
  const el = document.querySelector(selector); let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; let top = fiber; while (top.return) top = top.return; if (top.stateNode?.current !== top && fiber.alternate) fiber = fiber.alternate;
  for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.Geosets) return JSON.parse(JSON.stringify(fiber.memoizedProps.model));
  throw Error('Model unavailable');
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument } = await import('../src/editor-document.js');
  const doc = createStarterDocument();
  // Keep the glow clearly visible beside the small fixture mesh.
  doc.apply('Fixture', [], m => { m.Geosets[0].Vertices = Float32Array.from(m.Geosets[0].Vertices, v => v / 4); m.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 }]; });
  const fixture = path.join(out, 'cube.mdx'); fs.writeFileSync(fixture, new Uint8Array(doc.serialize('mdx')));
  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'), beforeHash = hash();
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, `profile-${Date.now()}`) }, timeout: 60000 });
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await page.getByLabel('3D model viewport', { exact: true }).waitFor({ timeout: 60000 });
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.unmaximize(); win.setBounds({ x: -3000, y: 0, width: 1280, height: 800 }); win.showInactive(); });
    const base = await page.evaluate(readModel), sidebar = await page.locator('.classic-sidebar').first().boundingBox();
    await page.screenshot({ path: path.join(out, '01-default.png') });
    const open = async () => { await page.locator('[data-warmkey="forge"]').click(); await page.getByRole('tab', { name: 'Glow Up', exact: true }).click(); };
    await open(); await page.getByRole('alert').filter({ hasText: 'Select vertices' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Add', exact: true }).isEnabled(), false);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Control+a');
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Selected: 8'));
    await open(); await page.locator('.forge-glow-preview canvas').first().waitFor();
    assert.equal(await page.getByLabel('Glow attachment', { exact: true }).inputValue(), '0');
    await range(page.getByLabel('Glow width slider', { exact: true }), 120); await range(page.getByLabel('Glow height slider', { exact: true }), 80); await range(page.getByLabel('Glow intensity', { exact: true }), 40);
    assert.equal(await page.getByLabel('Glow width', { exact: true }).inputValue(), '120');
    assert.deepEqual(await page.evaluate(readModel), base, 'preview must not edit the document');
    const preview = await page.evaluate(readModel, '.forge-glow-preview .game-preview-root'); assert.equal(preview.Materials.at(-1).Layers[0].Alpha, .4);
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stage = page.locator('.forge-glow-preview .game-preview-root');
    await range(page.getByLabel('Glow intensity', { exact: true }), 0); await settle(); const dark = await stage.screenshot({ path: path.join(out, 'alpha-0.png') });
    await range(page.getByLabel('Glow intensity', { exact: true }), 100); await settle(); const bright = await stage.screenshot({ path: path.join(out, 'alpha-100.png') });
    assert.notDeepEqual(dark, bright, 'intensity changes the rendered glow pixels');
    await range(page.getByLabel('Glow intensity', { exact: true }), 40); await settle();
    await page.screenshot({ path: path.join(out, '02-billboard.png') });
    await page.getByLabel('Glow type', { exact: true }).selectOption('plane'); await page.getByLabel('Glow plane', { exact: true }).selectOption('xy');
    await page.screenshot({ path: path.join(out, '03-flat.png') });
    for (const type of ['lockX', 'lockY', 'lockZ']) { await page.getByLabel('Glow type', { exact: true }).selectOption(type); const model = await page.evaluate(readModel, '.forge-glow-preview .game-preview-root'); assert.equal(model.Bones.at(-1).Flags, { lockX: 272, lockY: 288, lockZ: 320 }[type]); }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.deepEqual(await page.evaluate(readModel), base, 'Cancel preserves document');
    await open(); await range(page.getByLabel('Glow width slider', { exact: true }), 120); await range(page.getByLabel('Glow height slider', { exact: true }), 80); await range(page.getByLabel('Glow intensity', { exact: true }), 40);
    await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.locator('.forge-dialog').waitFor({ state: 'detached' });
    const added = await page.evaluate(readModel); assert.equal(added.Geosets.length, base.Geosets.length + 1); assert.equal(added.Bones.at(-1).Flags, 264); assert.equal(added.Bones.at(-1).Parent, 0);
    assert.deepEqual(added.Geosets.slice(0, -1), base.Geosets); assert.deepEqual(added.Bones.slice(0, -1), base.Bones);
    for (const format of ['MDX', 'MDL']) {
      const saved = path.join(out, `glow-saved.${format.toLowerCase()}`); await app.evaluate(({ dialog }, saved) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: saved }); }, saved);
      await page.keyboard.press('Control+Shift+s'); await page.getByRole('button', { name: `Save ${format}…`, exact: true }).click(); await page.getByRole('button', { name: `Save ${format}…`, exact: true }).waitFor({ state: 'detached' });
      const reopened = openDocument(fs.readFileSync(saved), path.basename(saved)).model; assert.equal(reopened.Geosets.length, added.Geosets.length); assert.equal(reopened.Bones.at(-1).Name, 'Glow'); assert.ok(Math.abs(reopened.Materials.at(-1).Layers[0].Alpha - .4) < 1e-6);
    }
    await page.keyboard.press('Control+z'); assert.deepEqual(await page.evaluate(readModel), base, 'one-step undo');
    const afterSidebar = await page.locator('.classic-sidebar').first().boundingBox(); assert.equal(afterSidebar.width, sidebar.width); assert.equal(hash(), beforeHash); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ executable, noSelectionGate: true, sizeSliders: true, alpha: .4, types: ['billboard', 'plane', 'lockX', 'lockY', 'lockZ'], independentPreview: true, cancel: true, oneStepUndo: true, saves: ['MDL', 'MDX'], sidebarWidth: sidebar.width, fixtureSHA256: beforeHash, rendererErrors: errors }, null, 2));
    console.log('PASS packaged Glow Up: selection, types, dimensions, alpha, rig preservation, Cancel, Add, undo, MDL/MDX Save As, unchanged sidebar and fixture.');
  } catch (e) { const page = await app.firstWindow(); fs.writeFileSync(path.join(out, 'failure.txt'), await page.locator('body').innerText()); await page.screenshot({ path: path.join(out, 'failure.png') }); throw e; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
