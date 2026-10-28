// Double-click a part in Movement: the bones that move it show as a Focused
// Skeleton of bone shapes even with Bones and Focused Skeleton off; with Bones
// on, the other bones keep their normal markers. Esc clears. Synthetic data
// and an isolated profile only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const cwd = process.cwd(), out = path.join(cwd, 'out/motion-chain');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'motion-chain-fixture.mdx'), errors = [];
  const doc = createDemoDocument();
  doc.apply('Synthetic sway', ['Nodes'], model => {
    const tilt = degrees => new Float32Array([Math.sin(degrees * Math.PI / 360), 0, 0, Math.cos(degrees * Math.PI / 360)]);
    model.Bones[0].Rotation = { LineType: 1, Keys: [[0, 0], [1000, 25], [2000, 0]].map(([Frame, degrees]) => ({ Frame, Vector: tilt(degrees) })) };
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const app = await _electron.launch({ executablePath: path.join(cwd, 'node_modules/electron/dist/electron.exe'), args: [cwd, fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.setSize(1600, 1000); window.showInactive(); });
    page.on('console', message => { if (message.type() === 'error' && /TypeError|ReferenceError/.test(message.text())) errors.push(message.text()); });
    await page.locator('[data-hotkey="animation"]').click({ timeout: 60000 });
    await page.getByLabel('Movement current sequence').selectOption('0');
    const quick = page.getByRole('group', { name: 'Quick display', exact: true }), toggle = key => quick.locator(`input[data-hotkey="${key}"]`);
    for (const key of ['display:bones', 'display:skeleton', 'display:focusedSkeleton']) if (await toggle(key).count()) await toggle(key).setChecked(false);
    const canvas = page.locator('canvas[data-clean-model-canvas]'), status = page.locator('.classic-status');
    const shapes = () => page.evaluate(() => document.querySelector('[data-node-overlay]')?.dataset.boneShapes ?? null);
    await canvas.waitFor();
    const box = await canvas.boundingBox();
    assert.ok(!await shapes(), 'no bone shapes before the double-click');
    let hit = null;
    for (const [dx, dy] of [[0, 0], [0, -40], [0, 40], [-30, 0], [30, 0], [0, -80], [0, 80]]) {
      await canvas.dblclick({ position: { x: box.width / 2 + dx, y: box.height / 2 + dy } });
      if (/Moved by/.test(await status.innerText())) { hit = [dx, dy]; break; }
    }
    assert.ok(hit, `no part found: ${await status.innerText()}`);
    assert.match(await status.innerText(), /Moved by Blade_Root/);
    await page.waitForFunction(() => document.querySelector('[data-node-overlay]')?.dataset.boneShapes);
    const chain = (await shapes()).split(',');
    assert.ok(chain.includes('0'), `chain shown as bone shapes with the overlays off: ${chain}`);
    await page.screenshot({ path: path.join(out, 'chain-overlays-off.png') });

    // With Bones on, bones outside the chain keep their normal markers.
    await toggle('display:bones').setChecked(true);
    await page.waitForTimeout(300);
    assert.deepEqual((await shapes()).split(','), chain, 'Bones on does not change the chain shapes');
    await page.screenshot({ path: path.join(out, 'chain-bones-on.png') });

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('[data-node-overlay]')?.dataset.boneShapes === '');
    await toggle('display:bones').setChecked(false);

    // Normal mouse camera rotation still works.
    const before = await page.screenshot({ clip: box });
    const x = box.x + box.width / 2 + 200, y = box.y + box.height / 2;
    await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 30, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForTimeout(300);
    assert.ok(!before.equals(await page.screenshot({ clip: box })), 'Alt+drag still turns the camera');
    assert.deepEqual(errors, []);
    console.log('motion-chain: ok', JSON.stringify({ hit, chain }));
  } finally { await app.close().catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
