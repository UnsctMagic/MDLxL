const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'sequence-reorder-ui');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument, createNode, openDocument } = await import('../src/editor-document.js');
  const { createSequenceFromCurrent } = await import('../src/sequence-editor.js');
  const doc = createDemoDocument();
  doc.apply('Fixture', [], model => {
    createSequenceFromCurrent(model, 0); createSequenceFromCurrent(model, 0);
    model.Sequences[1].Name = 'Walk'; model.Sequences[2].Name = 'Stand 3';
    model.GlobalSequences = [800, 1200];
    model.TextureAnims.push({ Translation: { LineType: 1, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array(3) }, { Frame: 800, Vector: new Float32Array([1, 0, 0]) }] } });
    const event = createNode(model, 'EventObject', 'SNDxReorder'); event.EventTrack = new Uint32Array([777, 3777, 6777]);
    const global = createNode(model, 'EventObject', 'SNDxGlobal'); global.GlobalSeqId = 0; global.EventTrack = new Uint32Array([100]);
  });
  const fixture = path.join(out, 'reorder-fixture.mdx'), original = doc.serialize('mdx'); await fs.writeFile(fixture, original);
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'out/pkg/MDLxL-win32-x64/MDLxL.exe');
  const app = await _electron.launch({ executablePath, args: [fixture], cwd: root, env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '1' }, timeout: 60000 });
  let page; const errors = [];
  const screenshot = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage({}, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    await fs.writeFile(path.join(out, name), Buffer.from(png, 'base64'));
  };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    const choose = page.getByLabel('Choose animation sequence', { exact: true }), button = page.getByRole('button', { name: 'Reorder', exact: true });
    await choose.selectOption('2');
    const readRuntime = () => page.evaluate(() => {
      const element = document.querySelector('.game-preview-root');
      let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native && state.controls) return { ready: state.captureApi?.isReady, frame: state.native.getFrame(), camera: state.controls.object.position.toArray(), names: state.native.model.Sequences.map(sequence => sequence.Name), intervals: state.native.model.Sequences.map(sequence => Array.from(sequence.Interval)) };
      }
      return null;
    });
    const waitFor = async (predicate, label) => {
      const until = Date.now() + 20000;
      while (Date.now() < until) { const state = await readRuntime(); if (state && predicate(state)) return state; await page.waitForTimeout(100); }
      throw Error(label + ': ' + JSON.stringify(await readRuntime()));
    };
    await waitFor(state => state.ready, 'Preview ready');
    const sidebarWidth = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    const actionLayout = await page.locator('.ac-sequence-actions').evaluate(element => ({ height: element.getBoundingClientRect().height, buttons: [...element.querySelectorAll('button')].map(button => ({ name: button.textContent, x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight, clipped: button.scrollWidth > button.clientWidth })) }));
    assert.deepEqual(actionLayout.buttons.map(button => button.name), ['Create', 'Global', 'Create from current', 'Delete', 'Reorder']);
    const [create, globalButton, copy, remove, reorderButton] = actionLayout.buttons;
    assert.equal(create.y, globalButton.y); assert.equal(remove.y, reorderButton.y);
    assert.ok(create.y < copy.y && copy.y < remove.y); assert.ok(copy.width > create.width * 1.9);
    assert.ok(actionLayout.height <= 90, 'Actions occupy three compact rows');
    assert.ok(actionLayout.buttons.every(button => !button.clipped), 'Button labels fit');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await screenshot('default.png');
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Reorder Animations', exact: true }), list = dialog.getByLabel('Animation order', { exact: true });
    await dialog.getByRole('button', { name: 'Move to top', exact: true }).click();
    assert.deepEqual(await list.locator('option').allTextContents(), ['1. Stand 3', '2. Stand', '3. Walk']);
    assert.deepEqual((await readRuntime()).names, ['Stand', 'Walk', 'Stand 3']);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await choose.inputValue(), '2');
    await button.click();
    await dialog.getByRole('button', { name: 'Up', exact: true }).click();
    await dialog.getByRole('button', { name: 'Down', exact: true }).click();
    await dialog.getByRole('button', { name: 'Move to top', exact: true }).click();
    await screenshot('reorder.png');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await waitFor(state => state.names[0] === 'Stand 3', 'Reordered runtime');
    assert.equal(await choose.inputValue(), '0');
    assert.equal(await page.getByLabel('Animation sequence name', { exact: true }).inputValue(), 'Stand 3');
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebarWidth);
    await page.keyboard.press('Control+z');
    await waitFor(state => state.names[0] === 'Stand', 'Undo restores order');
    await page.keyboard.press('Control+y');
    await waitFor(state => state.names[0] === 'Stand 3', 'Redo restores order');
    await choose.selectOption('global:0');
    await button.click();
    assert.equal(await dialog.getByLabel('Animation order type').inputValue(), 'global');
    await dialog.getByRole('button', { name: 'Move to bottom', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await choose.inputValue(), 'global:1');
    assert.equal(await page.getByLabel('Sequence last frame', { exact: true }).inputValue(), '800');
    // The composite label's text input is disabled for globals. Keyboard
    // navigation exercises the enabled select without Playwright retargeting
    // its options to that disabled labelled input.
    await choose.press('Home'); await choose.press('ArrowDown');
    assert.equal(await choose.inputValue(), '0');
    await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: output + '/saved.' + options.filters[0].extensions[0] }); }, out);
    for (const format of ['mdx', 'mdl']) {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'saveAs'));
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
      const saved = openDocument(await fs.readFile(path.join(out, 'saved.' + format)), 'saved.' + format);
      assert.equal(saved.readOnly, false);
      assert.deepEqual(saved.model.Sequences.map(sequence => sequence.Name), ['Stand 3', 'Stand', 'Walk']);
      assert.deepEqual(saved.model.GlobalSequences, [1200, 800]);
      assert.equal(saved.model.TextureAnims[0].Translation.GlobalSeqId, 1);
      assert.equal(saved.model.EventObjects[1].GlobalSeqId, 1);
      assert.deepEqual(Array.from(saved.model.EventObjects[0].EventTrack), [777, 3777, 6777]);
      await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, path.join(out, 'saved.' + format));
      await page.keyboard.press('Control+o');
      await page.getByRole('tab', { name: 'saved.' + format, exact: true, selected: true }).waitFor();
      await page.getByRole('button', { name: 'Animations', exact: true }).click(); await choose.selectOption('0');
      await waitFor(state => state.ready && state.names[0] === 'Stand 3', 'Reopened model');
    }
    // Existing playback and normal mouse rotation still work on the hidden desktop.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'camera:rotate'));
    const before = await readRuntime(), canvas = await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .75, canvas.y + canvas.height * .7); await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .6, canvas.y + canvas.height * .6, { steps: 12 }); await page.mouse.up();
    await waitFor(state => state.camera.some((value, i) => Math.abs(value - before.camera[i]) > 1), 'Mouse rotation');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const playback = await readRuntime(); await waitFor(state => Math.abs(state.frame - playback.frame) > 10, 'Playback advances');
    assert.deepEqual(await fs.readFile(fixture), Buffer.from(original)); assert.deepEqual(errors, []);
    const result = { passed: true, executablePath, sidebarWidth, actionLayout, localOrder: ['Stand 3', 'Stand', 'Walk'], globalDurations: [1200, 800], undoRedo: true, saveReopen: ['mdx', 'mdl'], mouseRotation: true, playback: true, rendererErrors: errors };
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } catch (error) {
    if (page) { await screenshot('failure.png').catch(() => {}); console.error((await page.locator('body').innerText()).slice(-1400)); }
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
