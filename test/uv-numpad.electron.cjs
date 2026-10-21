// Run after rebuilding dist; MDLXL_UI_EXECUTABLE optionally targets a portable package.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const out = path.resolve(process.env.MDLXL_TEST_OUTPUT || path.join(root, 'out/uv-numpad'));
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const fixture = path.join(root, 'fixtures/demo.mdx'), original = fs.readFileSync(fixture);
  const app = await _electron.launch({
    executablePath: process.env.MDLXL_UI_EXECUTABLE || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: [...(process.env.MDLXL_UI_EXECUTABLE ? [] : [root]), fixture], cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000,
  });
  const errors = [], checks = [];
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setBounds({ x: -3000, y: 0, width: 1440, height: 1000 }); win.showInactive();
    });
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.evaluate(() => {
      window.uvProps = (selector, key) => {
        const element = document.querySelector(selector);
        let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
        let top = fiber; while (top.return) top = top.return;
        const pending = [top.stateNode.current];
        while (pending.length) {
          const node = pending.pop();
          if (node.stateNode === element) { fiber = node; break; }
          if (node.child) pending.push(node.child);
          if (node.sibling) pending.push(node.sibling);
        }
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.[key]) return fiber.memoizedProps;
        throw Error('Props unavailable: ' + selector);
      };
      window.uvValues = () => Array.from(uvProps('.uv-editor', 'geoset').geoset.TVertices[0]);
      window.modelSnapshot = () => JSON.stringify(uvProps('.classic-view > .viewport', 'model').model);
    });
    await page.getByLabel('3D model viewport', { exact: true }).focus();
    await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();
    const canvas = page.getByLabel('UV coordinate editor', { exact: true });
    await canvas.waitFor();
    await page.evaluate(() => uvProps('.uv-editor', 'geoset').onSelectVertices([0, 1]));
    await page.waitForFunction(() => uvProps('.uv-editor', 'geoset').selectedVertices.length === 2);
    const baseline = await page.evaluate(() => uvValues()), modelBefore = await page.evaluate(() => modelSnapshot());
    const selected = await page.evaluate(() => uvProps('.uv-editor', 'geoset').selectedVertices);
    const assertOffset = async (dx, dy) => {
      const actual = await page.evaluate(() => uvValues());
      baseline.forEach((value, index) => {
        const delta = selected.includes(Math.floor(index / 2)) ? (index % 2 ? dy : dx) * .001 : 0;
        assert.ok(Math.abs(actual[index] - (value + delta)) < 1e-6, `UV ${index}: ${actual[index]} != ${value + delta}`);
      });
      const before = JSON.parse(modelBefore), after = JSON.parse(await page.evaluate(() => modelSnapshot()));
      after.Geosets.forEach((geoset, index) => { geoset.TVertices = before.Geosets[index].TVertices; });
      assert.deepEqual(after, before, 'Only texture coordinates may change');
    };
    const undo = async () => {
      await canvas.focus(); await page.keyboard.press('Control+z');
      await page.waitForFunction(before => modelSnapshot() === before, modelBefore);
    };
    const cdp = await page.context().newCDPSession(page);
    const key = async (digit, numLock, repeat = false) => {
      const navigation = { 7: ['Home', 36], 8: ['ArrowUp', 38], 9: ['PageUp', 33], 4: ['ArrowLeft', 37], 6: ['ArrowRight', 39], 1: ['End', 35], 2: ['ArrowDown', 40], 3: ['PageDown', 34] };
      const data = { code: 'Numpad' + digit, key: numLock ? String(digit) : navigation[digit][0], windowsVirtualKeyCode: numLock ? 96 + digit : navigation[digit][1], isKeypad: true, location: 3 };
      await cdp.send('Input.dispatchKeyEvent', { ...data, type: 'rawKeyDown', autoRepeat: repeat });
      await cdp.send('Input.dispatchKeyEvent', { ...data, type: 'keyUp' });
    };
    for (const numLock of [true, false]) {
      for (const [digit, dx, dy] of [[7, -1, -1], [8, 0, -1], [9, 1, -1], [4, -1, 0], [6, 1, 0], [1, -1, 1], [2, 0, 1], [3, 1, 1]]) {
        await canvas.focus(); await key(digit, numLock);
        await page.waitForFunction(before => modelSnapshot() !== before, modelBefore);
        await assertOffset(dx, dy);
        const edited = await page.evaluate(() => modelSnapshot());
        await undo(); await page.keyboard.press('Control+y');
        await page.waitForFunction(after => modelSnapshot() === after, edited);
        await undo();
      }
      checks.push(`All eight directions, selection-only edits and Undo/Redo with Num Lock ${numLock ? 'on' : 'off'}`);
    }
    await page.locator('.uv-tab-window [data-hotkey="translate"]').click();
    await key(6, true); await assertOffset(1, 0); await undo();
    const previewCanvas = page.locator('.uv-preview-canvas canvas[data-clean-model-canvas]');
    await previewCanvas.focus(); await key(9, true); await assertOffset(1, -1); await undo();
    checks.push('Nudges work after using the UV toolbar or live model preview');
    await canvas.focus();
    for (let i = 0; i < 3; i++) await key(6, true, i > 0);
    await assertOffset(3, 0);
    for (let i = 0; i < 3; i++) await page.keyboard.press('Control+z');
    await page.waitForFunction(before => modelSnapshot() === before, modelBefore);
    checks.push('Held-key repeats accumulate tiny nudges');
    await canvas.focus(); await page.keyboard.press('8');
    assert.equal(await page.evaluate(() => modelSnapshot()), modelBefore);
    const input = page.getByLabel('UV map tile limit', { exact: true });
    await input.focus(); await page.keyboard.press('Numpad6');
    assert.equal(await page.evaluate(() => modelSnapshot()), modelBefore);
    await page.locator('.classic-view > .viewport [aria-label="3D model viewport"]').focus();
    await key(6, true);
    assert.equal(await page.evaluate(() => modelSnapshot()), modelBefore);
    await canvas.focus(); await page.keyboard.press('Control+Numpad6');
    assert.equal(await page.evaluate(() => modelSnapshot()), modelBefore);
    checks.push('Number row, text input, main viewport and Ctrl chords do not nudge UVs');
    await canvas.focus(); await page.keyboard.press('Escape');
    await key(6, true);
    assert.equal(await page.evaluate(() => modelSnapshot()), modelBefore);
    await page.keyboard.press('Control+a');
    await page.waitForFunction(() => uvProps('.uv-editor', 'geoset').selectedVertices.length > 2);
    checks.push('Empty selection does not edit; existing Escape and Select All shortcuts still work');
    await page.locator('.uv-tab-window [data-hotkey="translate"]').click();
    const bounds = await canvas.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 20, bounds.y + bounds.height / 2 + 12, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(before => modelSnapshot() !== before, modelBefore);
    await undo();
    checks.push('Existing mouse Move and Undo remain usable');
    const preview = page.locator('.uv-preview-canvas canvas[data-clean-model-canvas]');
    await preview.waitFor(); const imageBefore = await preview.screenshot(), box = await preview.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .65, { steps: 12 }); await page.mouse.up();
    assert.ok(!(await preview.screenshot()).equals(imageBefore), 'Live preview rotates with the mouse');
    checks.push('Live model preview rotates with an actual mouse drag');
    assert.deepEqual(errors, []); assert.ok(fs.readFileSync(fixture).equals(original));
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, checks, rendererErrors: errors, fixtureUnchanged: true }, null, 2));
    console.log('PASS ' + checks.join('; '));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
    assert.equal(path.dirname(profile), out); fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
