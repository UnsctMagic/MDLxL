// Acceptance proof: an empty file becomes a house through public UI input only.
// No React internals, mesh injection, or private editing calls.
// Run against a packaged app using MDLXL_TEST_EXE and MDLXL_PLAYWRIGHT_MODULE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.MDLXL_TEST_OUT || path.join(root, 'out/forge-house-proof');
const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'out/forge-house-final/MDLxL-win32-x64/MDLxL.exe');
const actions = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/forge-house-mouse.json'), 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  fs.mkdirSync(path.join(out, 'steps'), { recursive: true });
  const modelPath = path.join(out, 'Forge House.mdl');
  fs.writeFileSync(modelPath, 'Version { FormatVersion 800, }\nModel "Forge House" { BlendTime 150, }\n');
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', modelPath], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, `profile-${Date.now()}`) }, timeout: 60000 });
  let page, step = 0;
  const errors = [], timings = [];
  const capture = async label => {
    const file = path.join(out, 'steps', `${String(step).padStart(3, '0')}-${label}.png`);
    const pixels = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG().toString('base64')));
    fs.writeFileSync(file, Buffer.from(pixels, 'base64'));
    fs.writeFileSync(file.replace('.png', '.txt'), await page.locator('body').innerText());
  };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: 0, y: 0, width: 1600, height: 1000 }); });
    await page.getByLabel('3D model viewport', { exact: true }).waitFor(); await capture('empty-model');
    for (const action of actions) {
      step++; const began = Date.now();
      if (action.type === 'click') {
        if (action.name) await page.getByRole(action.role || 'button', { name: action.name, exact: true }).click();
        else if (action.label) await page.getByLabel(action.label, { exact: true }).click();
        else if (action.selector) await page.locator(action.selector).click();
        else await page.mouse.click(action.x, action.y, { button: action.button || 'left' });
      } else if (action.type === 'drag') {
        let { x, y } = action;
        if (action.label) { const box = await page.getByLabel(action.label, { exact: true }).boundingBox(); x = box.x + box.width / 2; y = box.y + box.height / 2; }
        for (const key of action.modifiers || []) await page.keyboard.down(key);
        await page.mouse.move(x, y); await page.mouse.down({ button: action.button || 'left' });
        for (let i = 1; i <= 6; i++) { await page.mouse.move(x + (action.dx || 0) * i / 6, y + (action.dy || 0) * i / 6); await sleep(Math.max(1500, action.duration || 0) / 6); }
        await page.mouse.up({ button: action.button || 'left' });
        for (const key of action.modifiers || []) await page.keyboard.up(key);
      } else if (action.type === 'wheel') {
        await page.mouse.move(action.x, action.y); await page.mouse.wheel(0, action.delta);
      } else if (action.type === 'key') await page.keyboard.press(action.key);
      else if (action.type === 'save') await page.keyboard.press('Control+s');
      await sleep(750); // Deliberately human-paced, including ordinary button clicks.
      await capture(action.labelName || action.type);
      timings.push({ ...action, elapsedMs: Date.now() - began });
      if (action.labelName || step % 20 === 0) console.log(`${step}/${actions.length}: ${action.labelName || action.type}`);
    }
    const { openDocument } = await import('../src/editor-document.js');
    const document = openDocument(fs.readFileSync(modelPath));
    assert.deepEqual(document.diagnostics.filter(diagnostic => diagnostic.severity === 'error'), []);
    assert.equal(document.model.Geosets.length, 15);
    const triangles = document.model.Geosets.reduce((count, geoset) => count + geoset.Faces.length / 3, 0);
    assert.equal(triangles, 268);
    for (const geoset of document.model.Geosets) {
      assert.ok([...geoset.Vertices, ...geoset.Normals, ...geoset.TVertices[0]].every(Number.isFinite));
      assert.ok(geoset.Faces.every(index => index < geoset.Vertices.length / 3));
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'actions.json'), JSON.stringify(timings, null, 2));
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ executable, modelPath, construction: 'Public mouse/button controls only, from an empty model', actions: timings.length, geosets: 15, triangles, rendererErrors: errors }, null, 2));
    console.log(`PASS: mouse-built house saved to ${modelPath}`);
  } catch (error) { if (page) await capture('failure'); throw error; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
