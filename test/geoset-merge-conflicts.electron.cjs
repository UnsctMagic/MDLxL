// Run against rebuilt dist or set MDLXL_TEST_PACKAGE to a packaged app directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), output = path.join(root, 'out/geoset-merge-conflicts');
  fs.mkdirSync(output, { recursive: true });
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  let source = process.argv[2] && path.resolve(process.argv[2]);
  if (!source) {
    const fixture = createDemoDocument();
    fixture.apply('Prepare merge conflicts', [], model => {
      model.Geosets = Array.from({ length: 28 }, () => structuredClone(model.Geosets[0]));
      model.Geosets[0].MaterialID = model.Materials.push({ ...structuredClone(model.Materials[0]), PriorityPlane: 2 }) - 1;
      model.GeosetAnims = model.Geosets.map((_, GeosetId) => ({ GeosetId, Flags: 2,
        Color: Float32Array.of(GeosetId === 27 ? 0.5 : 1, 0, 0),
        Alpha: { LineType: GeosetId === 27 ? 1 : 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: Float32Array.of(1) }, { Frame: 500, Vector: Float32Array.of(1) }] },
      }));
    });
    source = path.join(output, 'conflicts.mdx'); fs.writeFileSync(source, fixture.serialize('mdx'));
  }
  const bytes = fs.readFileSync(source), initial = openDocument(bytes, path.basename(source)).model;
  const profile = fs.mkdtempSync(path.join(output, 'profile-'));
  const packaged = process.env.MDLXL_TEST_PACKAGE;
  const app = await _electron.launch({
    executablePath: packaged ? path.join(packaged, 'MDLxL.exe') : path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', ...(packaged ? [] : [root]), source], cwd: packaged || root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000,
  });
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.waitForFunction(count => document.title.includes('.mdx') && document.querySelectorAll('.classic-geoset-list [role="option"]').length === count, initial.Geosets.length);
    const screenshot = async name => {
      await app.evaluate(async ({ BrowserWindow }) => { await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
      fs.writeFileSync(path.join(output, name), Buffer.from(png, 'base64'));
    };
    await page.evaluate(() => {
      window.mergeState = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.doc?.apply) return current;
        }
        throw Error('Editor state missing');
      };
      window.mergeViewport = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const current = hook.memoizedState?.current;
          if (current?.controls?.object) return current;
        }
        throw Error('Viewport state missing');
      };
    });
    const choose = async indices => {
      await page.locator('[data-warmkey="geosetsClear"]').click();
      for (const index of indices) await page.getByLabel(`Select geoset ${index}`, { exact: true }).click();
      await page.locator('[aria-label="3D model viewport"]').focus(); await page.keyboard.press('Control+A');
    };
    const before = await page.evaluate(() => ({ revision: mergeState().doc.revision, sidebar: document.querySelector('.classic-sidebar').getBoundingClientRect().width }));
    assert.equal(await page.getByRole('dialog', { name: 'Merge Geosets', exact: true }).count(), 0);
    await choose([4, 27]);
    const openMerge = () => page.getByRole('button', { name: 'Merge Geosets', exact: true }).click();
    await openMerge();
    const popup = page.getByRole('dialog', { name: 'Merge Geosets', exact: true });
    await popup.waitFor();
    assert.match(await popup.textContent(), /Geosets 5, 28/);
    assert.match(await popup.textContent(), /RGB/); assert.match(await popup.textContent(), /Visibility/);
    assert.equal(await popup.getByRole('button', { name: 'Merge', exact: true }).isEnabled(), false);
    const box = await popup.boundingBox(), viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(box.width <= 400); assert.ok(Math.abs(box.x + box.width / 2 - viewport.width / 2) < 3);
    assert.ok(Math.abs(box.y + box.height / 2 - viewport.height / 2) < 3);
    await screenshot('popup.png');
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => mergeState().doc.revision), before.revision);
    await openMerge(); await popup.waitFor(); await page.keyboard.press('Escape'); await popup.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => mergeState().doc.revision), before.revision);
    await openMerge(); await popup.waitFor();
    await popup.getByRole('combobox', { name: 'RGB resolution for geosets 5, 28', exact: true }).selectOption('27');
    await popup.getByRole('combobox', { name: 'Visibility resolution for geosets 5, 28', exact: true }).selectOption('4');
    assert.equal(await popup.getByRole('button', { name: 'Merge', exact: true }).isEnabled(), true);
    await popup.getByRole('button', { name: 'Merge', exact: true }).click();
    await page.waitForFunction(count => mergeState().doc.model.Geosets.length === count - 1, initial.Geosets.length);
    const saved = Uint8Array.from(await page.evaluate(() => Array.from(mergeState().doc.serialize('mdx'))));
    const reopened = openDocument(saved, 'resolved.mdx').model, merged = reopened.Geosets[4];
    assert.deepEqual(Array.from(merged.Vertices), [...initial.Geosets[4].Vertices, ...initial.Geosets[27].Vertices]);
    assert.deepEqual(Array.from(merged.TVertices[0]), [...initial.Geosets[4].TVertices[0], ...initial.Geosets[27].TVertices[0]]);
    const anim = reopened.GeosetAnims.find(record => record.GeosetId === 4);
    assert.deepEqual(anim.Color, initial.GeosetAnims.find(record => record.GeosetId === 27).Color);
    assert.deepEqual(anim.Alpha, initial.GeosetAnims.find(record => record.GeosetId === 4).Alpha);
    assert.equal(await page.evaluate(() => mergeState().doc.revision), before.revision + 1);
    assert.equal(await page.evaluate(() => document.querySelector('.classic-sidebar').getBoundingClientRect().width), before.sidebar);
    await screenshot('merged.png');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'undo'));
    await page.waitForFunction(count => mergeState().doc.model.Geosets.length === count, initial.Geosets.length);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'redo'));
    await page.waitForFunction(count => mergeState().doc.model.Geosets.length === count - 1, initial.Geosets.length);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'undo'));
    await page.waitForFunction(count => mergeState().doc.model.Geosets.length === count, initial.Geosets.length);
    const unlike = initial.Geosets.findIndex(g => g.MaterialID !== initial.Geosets[4].MaterialID);
    assert.ok(unlike >= 0); await choose([unlike, 4]); await openMerge();
    await page.waitForFunction(() => document.querySelector('.classic-status span').textContent === 'No geosets share compatible materials and RGB.');
    assert.equal(await popup.count(), 0); assert.equal(await page.evaluate(() => mergeState().doc.model.Geosets.length), initial.Geosets.length);
    // Actual mouse input through the existing camera rotation control.
    await page.locator('[aria-label="3D model viewport"]').focus(); await page.keyboard.press('w');
    const canvas = page.locator('[aria-label="3D model viewport"] canvas').first(), area = await canvas.boundingBox();
    const cameraBefore = await page.evaluate(() => mergeViewport().controls.object.quaternion.toArray());
    await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2); await page.mouse.down();
    await page.mouse.move(area.x + area.width / 2 + 90, area.y + area.height / 2 + 30, { steps: 10 }); await page.mouse.up();
    const cameraAfter = await page.evaluate(() => mergeViewport().controls.object.quaternion.toArray());
    assert.ok(Math.hypot(...cameraBefore.map((v, i) => v - cameraAfter[i])) > 0.01, 'normal mouse drag rotates the camera');
    assert.deepEqual(fs.readFileSync(source), bytes);
    console.log('PASS: centered conflict popup, explicit independent choices, cancel/Escape, merge, MDX reopen, undo/redo, material warning, sidebar preservation, actual mouse rotation, original file unchanged');
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => { const state = typeof mergeState === 'function' && mergeState(); if (state) Object.defineProperty(state.doc, 'dirty', { get: () => false }); window.desktop?.setDirty({ dirty: false, saved: true }); });
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
