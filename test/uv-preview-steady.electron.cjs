// UV Wrapper keeps its texture warning steady while a material change re-renders
// the texture map: the warning never blinks out and the workspace never jumps.
// Usage: node test/uv-preview-steady.electron.cjs <MDLxL.exe>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'out', 'uv-preview-steady-' + Date.now());

async function fixture() {
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument();
  doc.apply('UV steady fixture', ['Materials', 'Textures', 'Geosets'], m => {
    // A texture that no profile can resolve gives a lasting "is not loaded" warning.
    m.Textures.push({ Image: 'Textures\\MDLxLMissingProbe.blp', ReplaceableId: 0, Flags: 3 });
    m.Materials[0].Layers = [{ TextureID: m.Textures.length - 1, FilterMode: 2, Shading: 17, Alpha: 1, CoordId: 0, TVertexAnimId: null }];
    m.Geosets[1].MaterialID = 0;
  });
  const file = path.join(out, 'UVSteady.mdx');
  fs.writeFileSync(file, doc.serialize('mdx'));
  return file;
}

(async () => {
  const input = await fixture();
  const exe = path.resolve(process.argv[2] || process.env.MDLXL_TEST_EXE);
  const app = await _electron.launch({
    executablePath: exe, args: ['--disable-backgrounding-occluded-windows', input],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile') }, timeout: 60000,
  });
  try {
    const main = await app.firstWindow(); main.setDefaultTimeout(20000);
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false);
      w.setBounds({ x: -3000, y: 0, width: 1600, height: 1000 }); w.showInactive();
    });
    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await main.locator('[data-hotkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 0', { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click();
    await main.keyboard.press('Control+a');
    const uvw = main.locator('.uv-tab-window');
    await main.locator('[data-hotkey="uv"]').click();
    const dropdown = uvw.getByLabel('Material Properties', { exact: true });
    await dropdown.waitFor({ timeout: 60000 });
    const warning = uvw.locator('.uv-workspace-warning');
    await warning.waitFor({ timeout: 30000 });
    assert.match(await warning.textContent(), /MDLxLMissingProbe\.blp is not loaded/);
    // Watch every frame and DOM change from here on.
    await main.evaluate(() => {
      const body = () => document.querySelector('.uv-workspace-body');
      window.uvSteady = { removed: 0, tops: new Set([Math.round(body().getBoundingClientRect().top)]) };
      const sample = () => { if (!document.querySelector('.uv-workspace-warning')) window.uvSteady.removed++; window.uvSteady.tops.add(Math.round(body().getBoundingClientRect().top)); };
      new MutationObserver(sample).observe(document.querySelector('.uv-workspace'), { childList: true, subtree: true });
      const frame = () => { sample(); requestAnimationFrame(frame); }; frame();
    });
    for (const preset of ['Add', 'Modulate', 'Alpha', 'Team Color', 'Transparent']) {
      await dropdown.selectOption(preset);
      await main.waitForTimeout(500);
    }
    const result = await main.evaluate(() => ({ removed: window.uvSteady.removed, tops: [...window.uvSteady.tops] }));
    assert.equal(result.removed, 0, 'the warning blinked out while the texture map re-rendered');
    assert.deepEqual(result.tops.length, 1, `the UV workspace moved: tops ${result.tops.join(', ')}`);
    assert.match(await warning.textContent(), /MDLxLMissingProbe\.blp is not loaded/);
    console.log(`PASS UV texture warning stays put across 5 material changes; workspace top fixed at ${result.tops[0]}px`);
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  }
})().catch(error => { console.error(error); process.exit(1); });
