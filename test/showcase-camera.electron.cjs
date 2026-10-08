const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out/showcase-camera', String(Date.now()));
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument(), fixture = path.join(out, 'CameraTest.mdx');
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const original = fs.readFileSync(fixture);
  const packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const app = await _electron.launch({
    executablePath: process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...(packaged ? [fixture] : [root, fixture])], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile'), MDLVIS_HEADLESS: '1' }, timeout: 60000,
  });
  try {
    const page = await app.firstWindow(), errors = [];
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('button', { name: 'Showcase', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.showcase-record')?.disabled);
    await page.evaluate(() => {
      window.cameraRuntime = () => {
        const el = document.querySelector('.showcase-preview .game-preview-root');
        let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber$'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next)
          if (hook.memoizedState?.current?.controls) return hook.memoizedState.current;
        throw Error('Preview runtime missing');
      };
    });
    const input = page.locator('.showcase-preview canvas[tabindex]');
    const box = await input.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const view = () => page.evaluate(() => ({ ...cameraRuntime().captureApi.cameraView(), quaternion: cameraRuntime().controls.object.quaternion.toArray() }));
    const delta = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    const drag = async (button = 'left') => {
      await page.mouse.move(x, y); await page.mouse.down({ button });
      await page.mouse.move(x + 95, y + 35, { steps: 8 }); await page.mouse.up({ button });
    };
    const rotate = async label => {
      const before = await view(); await drag(); const after = await view();
      assert.ok(delta(before.quaternion, after.quaternion) > .01, label + ': view must rotate, including near a pole');
      assert.ok(delta(before.target, after.target) < 1e-6, label + ': left drag must not pan');
      console.log('PASS ' + label);
    };
    await rotate('ordinary left drag');
    const beforePan = await view(); await drag('right');
    assert.ok(delta(beforePan.target, (await view()).target) > 1, 'right drag must still pan');
    // Emulate capture interruption followed by release outside the app: the
    // application never receives that release. Next input uses real mouse drags.
    await page.mouse.move(x, y); await page.mouse.down({ button: 'right' });
    await page.mouse.move(x + 30, y + 10, { steps: 3 });
    await page.evaluate(() => {
      const controls = cameraRuntime().controls;
      controls.domElement.releasePointerCapture(controls._pointers[0]);
      window.addEventListener('pointerup', event => event.stopImmediatePropagation(), { capture: true, once: true });
    });
    await page.mouse.up({ button: 'right' });
    await rotate('left drag after lost capture and missing release');
    const interruptPan = async (label, interrupt) => {
      await page.mouse.move(x, y); await page.mouse.down({ button: 'right' });
      await page.mouse.move(x + 30, y + 10, { steps: 3 });
      await page.evaluate(() => window.addEventListener('pointerup', event => event.stopImmediatePropagation(), { capture: true, once: true }));
      await interrupt(); await page.mouse.up({ button: 'right' });
      await rotate(label);
    };
    await interruptPan('left drag after window blur', () => page.evaluate(() => window.dispatchEvent(new Event('blur'))));
    await interruptPan('left drag after an unreported release', async () => {});
    await page.mouse.move(x, y); await page.mouse.down({ button: 'right' });
    await page.evaluate(() => {
      const controls = cameraRuntime().controls;
      controls.domElement.dispatchEvent(new PointerEvent('pointercancel', { pointerId: controls._pointers[0], pointerType: 'mouse', bubbles: true }));
    });
    await page.mouse.up({ button: 'right' }); await rotate('left drag after pointer cancellation');
    await page.getByLabel('Crop size', { exact: true }).selectOption('square');
    await page.waitForTimeout(150);
    await rotate('left drag with square crop');
    await page.keyboard.down('Shift'); await rotate('Shift left drag'); await page.keyboard.up('Shift');
    const beforeCtrl = await view(); await page.keyboard.down('Control'); await drag(); await page.keyboard.up('Control');
    assert.ok(delta(beforeCtrl.target, (await view()).target) > 1, 'Ctrl left drag retains pan');
    await rotate('left drag after modifier release');
    const beforeZoom = await view(); await page.mouse.move(x, y); await page.mouse.wheel(0, -120);
    await page.waitForTimeout(150);
    assert.notEqual((await view()).fieldOfView, beforeZoom.fieldOfView, 'wheel zoom retained');
    await page.getByRole('button', { name: 'Vertices', exact: true }).click();
    await page.getByRole('button', { name: 'Showcase', exact: true }).click();
    await rotate('left drag after workspace round trip');
    assert.deepEqual(fs.readFileSync(fixture), original, 'fixture bytes preserved');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(out, 'rotation-restored.png') });
    console.log('PASS Showcase camera: ' + out);
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
