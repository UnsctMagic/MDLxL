const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Camera rotation mode chosen on another tab must not hide the Animations controls.
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'animations-sidebar-ui');
  await fs.mkdir(out, { recursive: true }); const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'animations-sidebar.mdx'); await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  const packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const app = await _electron.launch({ executablePath, args: packaged ? [fixture] : [root, fixture], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '1' }, timeout: 60000 });
  const errors = [], checks = []; let page;
  const capture = async rect => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return app.evaluate(async ({ BrowserWindow }, rect) => (await BrowserWindow.getAllWindows()[0].capturePage(rect, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'), rect);
  };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    const toolbox = page.getByRole('region', { name: 'Animations toolbox', exact: true });
    const anglePanel = page.locator('.camera-angle-panel');
    const tab = name => page.getByRole('button', { name, exact: true }).click();
    const expectToolbox = async label => { await toolbox.waitFor({ state: 'visible' }); checks.push(label); };

    await page.locator('.classic-sidebar').waitFor();
    await page.keyboard.press('Shift+E');
    await anglePanel.waitFor({ state: 'visible' });
    await tab('Animations');
    assert.equal(await anglePanel.isVisible(), true, 'rotation mode carries over');
    await expectToolbox('Vertices (camera rotation) -> Animations keeps the Animations toolbox');

    await tab('Movement'); await tab('Animations');
    await expectToolbox('Movement -> Animations keeps the Animations toolbox');

    // Real mouse drag in the preview: the camera turns, then the toolbox returns.
    const preview = await page.evaluate(() => {
      const visible = [...document.querySelectorAll('main canvas')].map(canvas => canvas.getBoundingClientRect()).filter(rect => rect.width > 100 && rect.height > 100);
      const rect = visible.sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    assert.ok(preview, 'preview canvas');
    const clip = { x: Math.round(preview.x), y: Math.round(preview.y), width: Math.round(preview.width), height: Math.round(preview.height) };
    const before = await capture(clip);
    await page.mouse.move(preview.x + preview.width * 0.5, preview.y + preview.height * 0.5);
    await page.mouse.down(); await page.mouse.move(preview.x + preview.width * 0.75, preview.y + preview.height * 0.45, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await capture(clip);
    assert.notEqual(after, before, 'mouse drag rotates the preview camera');
    checks.push('Mouse drag rotates the Animations preview camera');
    await expectToolbox('Toolbox is back after the camera drag');

    await tab('Vertices'); await tab('Animations');
    await expectToolbox('Vertices -> Animations again keeps the toolbox');
    await page.keyboard.press('Shift+Q');
    await expectToolbox('Work mode keeps the toolbox');
    await fs.writeFile(path.join(out, 'animations-sidebar.png'), Buffer.from(await capture(undefined), 'base64'));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, checks }, null, 2));
  } catch (error) {
    if (page) console.error('page text:', await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(cause => cause.message));
    console.error(error); console.log(JSON.stringify({ ok: false, checks, errors }, null, 2)); process.exitCode = 1;
  } finally {
    await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 10000))]);
    process.exit();
  }
})();
