// Run after building dist; uses a hidden Electron window and a synthetic model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const output = path.join(root, 'out/timeline-scrub');
  fs.mkdirSync(output, { recursive: true });
  const run = fs.mkdtempSync(path.join(output, 'run-'));
  const doc = createDemoDocument();
  doc.apply('Dense timeline fixture', ['Nodes'], model => {
    model.Bones[0].Translation = { LineType: 1, Keys: Array.from({ length: 2001 }, (_, Frame) => ({ Frame, Vector: new Float32Array([Frame / 100, 0, 0]) })) };
  });
  const fixture = path.join(run, 'dense.mdx'), original = Buffer.from(doc.serialize('mdx'));
  fs.writeFileSync(fixture, original);
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', root, fixture], cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(run, 'profile') }, timeout: 60000 });
  try {
    const page = await app.firstWindow(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.waitForFunction(() => document.title.includes('dense.mdx'));
    await page.locator('[data-warmkey="animation"]').dispatchEvent('click');
    await page.locator('.classic-reel-track').waitFor();
    // Send native input without waiting for hidden compositor actionability.
    // Pointer capture requires a real active pointer, not synthetic DOM events.
    const pointer = async (type, fraction, lower = true, shiftKey = false) => {
      const rect = await page.locator('.classic-reel-track').boundingBox();
      if (shiftKey) await page.keyboard.down('Shift'); else await page.keyboard.up('Shift');
      await page.mouse.move(rect.x + rect.width * fraction, rect.y + rect.height * (lower ? .8 : .2));
      if (type === 'pointerdown') await page.mouse.down();
      if (type === 'pointerup') await page.mouse.up();
    };
    const frame = async expected => page.waitForFunction(expected => Number(document.querySelector('[aria-label="Current animation frame"]').value) === expected, expected, { polling: 20 });
    assert.ok(await page.locator('.classic-reel-key').count() >= 2001, 'fixture fills the keyframe box');
    await pointer('pointerdown', .2); await frame(0);
    await pointer('pointerup', .2); await frame(1);
    await pointer('pointerdown', .2); await frame(1);
    await pointer('pointermove', .6); await frame(1200);
    await pointer('pointermove', .9); await frame(1800);
    await pointer('pointerup', .9);
    await pointer('pointermove', .1); await frame(1800);
    await pointer('pointerdown', .1); await frame(1800);
    await pointer('pointerup', .1); await frame(1799);
    await pointer('pointerdown', .9, false); await frame(1800);
    await pointer('pointerup', .9, false);
    await pointer('pointerdown', .4, true, true); await frame(1800);
    await pointer('pointermove', .41, true, true); await frame(820);
    assert.equal(await page.locator('.classic-reel-selection').getAttribute('data-range-start'), '820');
    assert.equal(await page.locator('.classic-reel-selection').getAttribute('data-range-end'), '1800');
    await pointer('pointermove', .3, true, true); await frame(600);
    await pointer('pointerup', .3, true, true);
    assert.equal(await page.locator('.classic-reel-selection').getAttribute('data-range-start'), '600');
    // Upper-box key clicks still select a stored key without starting a scrub.
    await pointer('pointerdown', .5, false); await frame(1000);
    await pointer('pointermove', .7, false); await frame(1000);
    await pointer('pointerup', .7, false);
    assert.equal(await page.locator('.classic-reel-selection').count(), 0);
    assert.equal(await page.locator('.motion-reel-warning').count(), 0);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible())), false);
    assert.deepEqual(fs.readFileSync(fixture), original);
    assert.deepEqual(errors, []);
    console.log('PASS: lower click snapping in both directions, dense lower-area drag, drag cleanup, Shift range, upper key clicks, unchanged fixture, hidden window');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
