const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'animation-speed-ui');
  await fs.mkdir(out, { recursive: true }); const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const { createSequenceFromCurrent } = await import('../src/sequence-editor.js');
  const { animationSpeedData, setAnimationActualSpeed } = await import('../src/animation-speed.js');
  const { removeEditorData } = await import('../src/editor-data.js');
  const doc = createDemoDocument();
  doc.apply('Two animations', [], model => { createSequenceFromCurrent(model, 0); model.Sequences[1].Name = 'Walk'; });
  const baseline = doc.model.Bones[0].Translation.Keys.map(key => key.Frame);
  const fixture = path.join(out, 'speed-fixture.mdx'), original = doc.serialize('mdx'); await fs.writeFile(fixture, original);
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  const packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const app = await _electron.launch({ executablePath, args: packaged ? [fixture] : [root, fixture], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '1' }, timeout: 60000 });
  const errors = []; let page;
  const screenshot = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage({}, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    await fs.writeFile(path.join(out, name), Buffer.from(png, 'base64'));
  };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    await page.getByLabel('Choose animation sequence', { exact: true }).selectOption('0');
    const width = await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width);
    const slider = page.getByRole('slider', { name: 'Animation Actual Speed', exact: true });
    assert.equal(await slider.inputValue(), '100'); assert.equal(await slider.getAttribute('min'), '1'); assert.equal(await slider.getAttribute('max'), '300');
    const rememberTiming = page.getByRole('region', { name: 'Animations toolbox', exact: true }).getByRole('checkbox', { name: 'Remember Original Timing', exact: true });
    assert.equal(await rememberTiming.isChecked(), true);
    assert.equal(await page.getByRole('dialog').count(), 0);
    const placement = await slider.evaluate(el => ({ afterRarity: el.closest('label').previousElementSibling.classList.contains('ac-rarity'), nextButton: el.closest('label').nextElementSibling.textContent }));
    assert.equal(placement.afterRarity, true); assert.equal(placement.nextButton, 'Adjust All Speed');
    await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: output + '/unused.' + options.filters[0].extensions[0] }); }, out);
    await page.keyboard.press('Control+Shift+s');
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('dialog', { name: 'Save model', exact: true }).count(), 0);
    assert.deepEqual(await fs.readFile(path.join(out, 'unused.mdx')), Buffer.from(original));
    const setRange = async (range, value) => { await range.fill(String(value)); await page.waitForTimeout(150); };
    const readRuntime = () => page.evaluate(() => {
      const el = document.querySelector('.game-preview-root');
      let fiber = el?.[Object.keys(el).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native && state.controls) return { frame: state.native.getFrame(), camera: state.controls.object.position.toArray(), translation: Array.from(state.native.model.Bones[0].Translation.Keys.map(key => key.Frame)), interval: Array.from(state.native.model.Sequences[0].Interval), ready: state.captureApi?.isReady, rootMatrix: state.native.model.Nodes[0].matrix?.toArray?.() };
      }
      return null;
    });
    const waitFor = async (predicate, label) => {
      const until = Date.now() + 20000;
      while (Date.now() < until) { const state = await readRuntime(); if (state && predicate(state)) return state; await page.waitForTimeout(100); }
      throw Error(label + ': ' + JSON.stringify(await readRuntime()));
    };
    await waitFor(state => state.ready, 'Preview loaded');
    await screenshot('default.png');
    await setRange(slider, 50);
    await waitFor(state => state.interval[1] === 4000 && state.translation[1] === 2000, 'Real preview intervals and keyframes retimed');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const playing = await waitFor(state => state.frame > 600 && state.frame < 1800, 'Slower animation is playing');
    await screenshot('half-speed-playing.png');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await setRange(slider, 100);
    assert.deepEqual((await readRuntime()).translation, baseline);
    await page.getByRole('button', { name: 'Adjust All Speed', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Adjust All Speed', exact: true });
    const master = menu.getByRole('slider', { name: 'Master Controller', exact: true });
    assert.equal(await master.inputValue(), '100');
    assert.equal(await menu.getByRole('checkbox', { name: 'Remember Original Timing', exact: true }).isChecked(), true);
    assert.ok(await menu.getByLabel('Include Stand in Master Controller', { exact: true }).isChecked());
    assert.ok(await menu.getByLabel('Include Walk in Master Controller', { exact: true }).isChecked());
    await menu.getByLabel('Include Walk in Master Controller', { exact: true }).uncheck();
    await setRange(master, 50);
    assert.equal(await menu.getByRole('slider', { name: 'Stand speed', exact: true }).inputValue(), '50');
    assert.equal(await menu.getByRole('slider', { name: 'Walk speed', exact: true }).inputValue(), '100');
    await setRange(menu.getByRole('slider', { name: 'Walk speed', exact: true }), 200);
    await screenshot('all-speed-menu.png');
    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width), width);
    await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: output + '/saved.' + options.filters[0].extensions[0] }); }, out);
    for (const format of ['mdx', 'mdl']) {
      await page.keyboard.press('Control+Shift+s');
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      const saveOptions = page.getByRole('dialog', { name: 'Save model', exact: true });
      await saveOptions.waitFor();
      assert.equal(await saveOptions.getByRole('checkbox', { name: /Remove all MDLxL editor data/ }).isChecked(), false);
      await screenshot('save-options-' + format + '.png');
      await saveOptions.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('button', { name: 'Save MDX…', exact: true }).waitFor({ state: 'hidden' });
      const saved = openDocument(await fs.readFile(path.join(out, 'saved.' + format)), 'saved.' + format);
      assert.equal(saved.readOnly, false);
      assert.equal(animationSpeedData(saved.model).master, 50);
      assert.deepEqual(animationSpeedData(saved.model).sequences.map(item => [item.percent, item.checked]), [[50, true], [200, false]]);
      saved.apply('Reset', [], model => { setAnimationActualSpeed(model, 0, 100); setAnimationActualSpeed(model, 1, 100); });
      assert.deepEqual(saved.model.Bones[0].Translation.Keys.map(key => key.Frame), baseline);
    }
    for (const format of ['mdx', 'mdl']) {
      await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, path.join(out, 'saved.' + format));
      await page.keyboard.press('Control+o'); await page.getByRole('tab', { name: 'saved.' + format, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Animations', exact: true }).click();
      await page.getByLabel('Choose animation sequence', { exact: true }).selectOption('0');
      assert.equal(await slider.inputValue(), '50');
      await page.getByRole('button', { name: 'Adjust All Speed', exact: true }).click();
      assert.equal(await master.inputValue(), '50'); assert.equal(await menu.getByLabel('Include Walk in Master Controller', { exact: true }).isChecked(), false);
      await setRange(master, 100); await setRange(menu.getByRole('slider', { name: 'Walk speed', exact: true }), 100);
      await page.keyboard.press('Escape');
      await waitFor(state => JSON.stringify(state.translation) === JSON.stringify(baseline), 'UI restores original frames after ' + format + ' reopen');
    }
    // The checkbox affects persistence, while the running model keeps its
    // adjusted timing. Both controls share the same document-level setting.
    await setRange(slider, 50);
    await rememberTiming.uncheck();
    await page.getByRole('button', { name: 'Adjust All Speed', exact: true }).click();
    assert.equal(await menu.getByRole('checkbox', { name: 'Remember Original Timing', exact: true }).isChecked(), false);
    await menu.getByRole('button', { name: 'Close', exact: true }).click();
    await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: output + '/not-remembered.' + options.filters[0].extensions[0] }); }, out);
    await page.keyboard.press('Control+Shift+s');
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
    const notRemembered = openDocument(await fs.readFile(path.join(out, 'not-remembered.mdx')), 'not-remembered.mdx');
    assert.equal(animationSpeedData(notRemembered.model), null);
    assert.equal(notRemembered.model.Sequences[0].Interval[1], 4000);
    assert.equal(await slider.inputValue(), '50');
    await rememberTiming.check();

    for (const format of ['mdx', 'mdl']) {
      await app.evaluate(({ dialog }, output) => { dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: output + '/stripped.' + options.filters[0].extensions[0] }); }, out);
      await page.keyboard.press('Control+Shift+s');
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      const saveOptions = page.getByRole('dialog', { name: 'Save model', exact: true });
      await saveOptions.waitFor();
      await saveOptions.getByRole('checkbox', { name: /Remove all MDLxL editor data/ }).check();
      // Cancel must preserve the checkbox, original timing and live playback.
      await saveOptions.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('dialog', { name: 'Save as', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await rememberTiming.isChecked(), true);
      assert.equal(await slider.inputValue(), '50');
      const before = await readRuntime();
      await page.keyboard.press('Control+Shift+s');
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      await saveOptions.getByRole('checkbox', { name: /Remove all MDLxL editor data/ }).check();
      await saveOptions.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
      const strippedBytes = await fs.readFile(path.join(out, 'stripped.' + format)), stripped = openDocument(strippedBytes, 'stripped.' + format);
      assert.equal(removeEditorData(strippedBytes, format).removedBytes, 0);
      assert.equal(animationSpeedData(stripped.model), null);
      assert.deepEqual(Array.from(stripped.model.Sequences[0].Interval), before.interval);
      assert.deepEqual(stripped.model.Bones[0].Translation.Keys.map(key => key.Frame), before.translation);
      assert.equal(await rememberTiming.isChecked(), false);
      assert.equal(await slider.inputValue(), '100');
      await page.keyboard.press('Control+z');
      assert.equal(await rememberTiming.isChecked(), true);
      assert.equal(await slider.inputValue(), '50');
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'camera:rotate'));
    await page.waitForTimeout(150);
    const cameraBefore = (await readRuntime()).camera, canvas = await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .75, canvas.y + canvas.height * .75); await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .60, canvas.y + canvas.height * .60, { steps: 12 }); await page.mouse.up();
    const rotated = await waitFor(state => state.camera.some((value, i) => Math.abs(value - cameraBefore[i]) > 1), 'Normal mouse drag rotates preview');
    await screenshot('reopened-and-rotated.png');
    assert.deepEqual(await fs.readFile(fixture), Buffer.from(original)); assert.deepEqual(errors, []);
    const result = { passed: true, packaged, executablePath, out, sidebarWidth: width, playing, cameraBefore, cameraAfter: rotated.camera, originalFrames: baseline, rendererErrors: errors };
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result));
    console.log(JSON.stringify(result));
  } catch (error) {
    if (page) { await screenshot('failure.png').catch(() => {}); console.error((await page.locator('body').innerText()).slice(-1400)); }
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
