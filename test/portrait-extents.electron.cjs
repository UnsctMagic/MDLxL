const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out/portrait-extents/ui');
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const { createPortraitSequence } = await import('../src/sequence-editor.js');
  const { applyPortraitModelTransform, modelControlRoots } = await import('../src/portrait-model-control.js');
  const { sampleNodeMatrices, skinGeoset } = await import('../src/animation.js');
  const { sampleMovement } = await import('../src/movement.js');
  const doc = createDemoDocument(), fixture = path.join(out, 'portrait-fixture.mdx');
  doc.apply('Fixture', [], model => {
    createPortraitSequence(model, 1200);
    createPortraitSequence(model, 1200);
    applyPortraitModelTransform(model, modelControlRoots(model).map(root => root.id), 3500, 1, { mode: 'move', values: [400, 0, 0] });
    model.Cameras = [{ Name: 'Portrait', Position: new Float32Array([400, -500, 100]), TargetPosition: new Float32Array([400, 0, 100]), FieldOfView: Math.PI / 4, NearClip: 1, FarClip: 2000 }];
  });
  const original = Buffer.from(doc.serialize('mdx')); fs.writeFileSync(fixture, original);
  const packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const app = await _electron.launch({ executablePath: process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: [...(packaged ? [] : [root]), fixture], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()), MDLVIS_HEADLESS: '1' }, timeout: 60000 });
  let page;
  const errors = [];
  const screenshot = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage({}, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    fs.writeFileSync(path.join(out, name), Buffer.from(png, 'base64'));
  };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setBackgroundThrottling(false);
      window.showInactive();
    });
    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    await page.getByRole('button', { name: 'Portrait Frame View', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.evaluate(() => {
      window.portraitRuntime = () => {
        const el = document.querySelector('.game-preview-root');
        let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState?.current;
          if (state?.native && state.controls) return state;
        }
        throw Error('Preview runtime missing');
      };
    });
    await page.waitForFunction(() => portraitRuntime().portraitActive);
    const width = await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width);
    await screenshot('portrait-before.png');
    await page.getByRole('button', { name: 'Set Current View', exact: true }).click();
    const save = async name => {
      const file = path.join(out, name + '.mdx');
      await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: output }); }, file);
      await page.keyboard.press('Control+Shift+s');
      await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
      await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
      return openDocument(fs.readFileSync(file), file).model;
    };
    const check = model => {
      for (const [index, sequence] of model.Sequences.entries()) if (/portrait/i.test(sequence.Name)) {
        const matrices = sampleNodeMatrices(model, sequence.Interval[0], index);
        for (const geoset of model.Geosets) {
          const vertices = skinGeoset(geoset, matrices);
          for (let i = 0; i < vertices.length; i++) for (const box of [sequence, geoset.Anims[index]]) {
            assert.ok(vertices[i] >= box.MinimumExtent[i % 3] && vertices[i] <= box.MaximumExtent[i % 3], 'saved portrait bounds contain posed geometry');
          }
        }
      }
    };
    check(await save('camera-repaired'));
    console.log('PASS packaged Set Current View repairs portrait bounds through Save As');
    await page.getByRole('button', { name: 'Camera rotation', exact: true }).click();
    const cameraBefore = await page.evaluate(() => portraitRuntime().controls.object.position.toArray());
    const box = await page.locator('.game-preview-root canvas[tabindex]').boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .5 + 90, box.y + box.height * .5 + 25, { steps: 10 });
    await page.mouse.up();
    const cameraAfter = await page.evaluate(() => portraitRuntime().controls.object.position.toArray());
    assert.ok(Math.hypot(...cameraBefore.map((v, i) => v - cameraAfter[i])) > 1, 'normal mouse drag rotates the packaged portrait view');
    await page.getByRole('button', { name: 'Snap to Camera', exact: true }).click();
    console.log('PASS packaged portrait camera rotates with a real mouse drag');
    await page.getByRole('button', { name: 'Control Model', exact: true }).click();
    const x = page.locator('.movement-vector input').first();
    await x.fill(String(Number(await x.inputValue()) + 50)); await x.press('Enter');
    const moved = await save('control-model-repaired');
    check(moved);
    assert.equal(sampleMovement(moved, moved.Bones[0], 'Translation', moved.Sequences[1].Interval[0], 1)[0], 450);
    console.log('PASS packaged Control Model commit updates all portrait bounds');
    assert.equal(await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width), width);
    assert.deepEqual(fs.readFileSync(fixture), original);
    await screenshot('portrait-after.png');
    assert.deepEqual(errors, []);
  } catch (error) { if (page) await screenshot('failure.png'); throw error; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
