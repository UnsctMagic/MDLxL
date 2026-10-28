// Show pivot in Movement: double-click a moving part, its ring appears at the
// bone it swings from, clicking the ring selects that bone, Esc clears.
// Synthetic data and an isolated profile only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const cwd = process.cwd(), out = path.join(cwd, 'out/show-pivot');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'show-pivot-fixture.mdx'), errors = [];
  const doc = createDemoDocument();
  doc.apply('Synthetic sway', ['Nodes'], model => {
    const tilt = degrees => new Float32Array([Math.sin(degrees * Math.PI / 360), 0, 0, Math.cos(degrees * Math.PI / 360)]);
    model.Bones[0].Rotation = { LineType: 1, Keys: [[0, 0], [1000, 25], [2000, 0]].map(([Frame, degrees]) => ({ Frame, Vector: tilt(degrees) })) };
    model.Bones[1].Rotation = { LineType: 1, Keys: [0, 2000].map(Frame => ({ Frame, Vector: tilt(0) })) };
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const app = await _electron.launch({ executablePath: path.join(cwd, 'node_modules/electron/dist/electron.exe'), args: [cwd, fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.setSize(1600, 1000); window.showInactive(); });
    page.on('console', message => { if (message.type() === 'error' && /TypeError|ReferenceError/.test(message.text())) errors.push(message.text()); });
    await page.locator('[data-hotkey="animation"]').click({ timeout: 60000 });
    await page.getByLabel('Movement current sequence').selectOption('0');
    const canvas = page.locator('canvas[data-clean-model-canvas]'), status = page.locator('.classic-status');
    await canvas.waitFor();
    const box = await canvas.boundingBox();
    let hit = null;
    for (const [dx, dy] of [[0, 0], [0, -40], [0, 40], [-30, 0], [30, 0], [0, -80], [0, 80]]) {
      await canvas.dblclick({ position: { x: box.width / 2 + dx, y: box.height / 2 + dy } });
      if (/Moves from/.test(await status.innerText())) { hit = [dx, dy]; break; }
    }
    assert.ok(hit, `no moving part found: ${await status.innerText()}`);
    assert.match(await status.innerText(), /Moves from Blade_Root\b/);
    const rings = JSON.parse(await page.locator('[data-path-overlay]').getAttribute('data-pivots'));
    assert.deepEqual(rings.map(ring => ring.nodeId), [0], 'one ring, at Blade_Root (Rune_Core keys never change)');
    await page.screenshot({ path: path.join(out, 'show-pivot-rings.png') });

    await canvas.click({ position: { x: rings[0].x, y: rings[0].y } });
    await page.waitForFunction(() => !document.querySelector('[data-path-overlay]'));
    const object = await page.getByLabel('Movement bone or node').evaluate(select => select.selectedOptions[0]?.textContent || '');
    assert.match(object, /Blade_Root/, 'ring click selects the bone');
    await page.screenshot({ path: path.join(out, 'show-pivot-selected.png') });

    await canvas.dblclick({ position: { x: box.width / 2 + hit[0], y: box.height / 2 + hit[1] } });
    await page.locator('[data-path-overlay]').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-path-overlay]'));

    // Normal mouse camera rotation still works after Show pivot.
    const before = await page.screenshot({ clip: box });
    const x = box.x + box.width / 2 + 200, y = box.y + box.height / 2;
    await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 30, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForTimeout(300);
    const after = await page.screenshot({ clip: box });
    assert.ok(!before.equals(after), 'Alt+drag still turns the camera');
    assert.deepEqual(errors, []);
    console.log('show-pivot: ok', JSON.stringify({ hit, rings }));
  } finally { await app.close().catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
