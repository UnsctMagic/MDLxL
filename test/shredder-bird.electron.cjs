const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Shredder's sprite bird is never in the way: he perches only where the 3D view's own
// picture is under him, clicks pass through him, and he flies off when the mouse comes
// near or a window opens.
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'shredder-bird');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'bird.mdx');
  await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  const app = await _electron.launch({ executablePath,
    args: process.env.MDLXL_ELECTRON_PATH ? [fixture] : [root, fixture], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '1' }, timeout: 60000 });
  const errors = [], checks = [], consoleErrors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setBackgroundThrottling(false); window.setSize(1280, 800);
    });
    await page.locator('.classic-view canvas').first().waitFor();
    // Short visits for the test; switching him off and on picks them up.
    await page.evaluate(() => localStorage.setItem('mdlxl-shredder-timing', JSON.stringify({ birdFirst: 500, birdPerch: [60000, 60000], birdAway: [1500, 1500], quietStart: 600000 })));
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').click();
    const toggle = page.locator('input[data-hotkey="configuration:shredder"]');
    if (await toggle.isChecked()) await toggle.uncheck();
    await toggle.check();
    await page.keyboard.press('Escape');
    await page.mouse.move(5, 5);
    const sprite = page.locator('.shredder-bird-sprite');
    const perched = () => page.waitForFunction(() => document.querySelector('.shredder-bird-sprite')?.dataset.phase === 'perch', null, { timeout: 20000 });
    await perched();
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => {
      const bird = document.querySelector('.shredder-bird-sprite'), box = bird.getBoundingClientRect(), view = document.querySelector('.classic-view').getBoundingClientRect();
      const under = [];
      for (const fx of [.3, .5, .7]) for (const fy of [.35, .6, .85]) under.push(document.elementFromPoint(box.left + box.width * fx, box.top + box.height * fy));
      return {
        box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, view: { left: view.left, right: view.right, bottom: view.bottom },
        under: under.map(element => element && (element.tagName + '.' + element.className)), open: under.every(element => element && element.matches('canvas, .viewport, .viewport-area, .viewport-host, .classic-view') && element.closest('.classic-view')),
        pointer: getComputedStyle(bird).pointerEvents, layer: getComputedStyle(bird.parentElement).pointerEvents,
        background: getComputedStyle(bird.firstElementChild).backgroundImage,
      };
    });
    assert.equal(state.pointer, 'none'); assert.equal(state.layer, 'none');
    assert.ok(state.open, 'only the 3D picture is under him: ' + state.under.join(', '));
    assert.ok(state.box.left >= state.view.left && state.box.right <= state.view.right, 'inside the 3D view');
    assert.ok(Math.abs(state.box.bottom - state.view.bottom) < 40, 'standing on its bottom edge');
    assert.match(state.background, /stand-.*\.png/);
    await page.screenshot({ path: path.join(out, 'perched.png'), clip: { x: Math.max(0, state.box.left - 160), y: state.box.top - 120, width: 400, height: 220 } });
    checks.push('He lands on the bottom edge of the 3D view with only the 3D picture under him; clicks pass through');

    // Controls placed where he stands make him move along or leave.
    await page.evaluate(({ left, top, right, bottom }) => {
      const blocker = document.createElement('button'); blocker.id = 'bird-blocker'; blocker.textContent = 'Useful';
      Object.assign(blocker.style, { position: 'fixed', left: left - 4 + 'px', top: top + 'px', width: right - left + 8 + 'px', height: bottom - top + 'px', zIndex: 20 });
      document.body.appendChild(blocker);
    }, state.box);
    await page.waitForFunction(() => {
      const bird = document.querySelector('.shredder-bird-sprite'), blocker = document.getElementById('bird-blocker').getBoundingClientRect(), box = bird.getBoundingClientRect();
      return bird.dataset.phase === 'away' || bird.dataset.phase === 'perch' && (box.right < blocker.left || box.left > blocker.right);
    }, null, { timeout: 5000 });
    await page.evaluate(() => document.getElementById('bird-blocker').remove());
    checks.push('A control appearing where he stands sends him along or away');

    await perched();
    const box = await sprite.boundingBox();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
    await page.waitForFunction(() => ['escape', 'away'].includes(document.querySelector('.shredder-bird-sprite').dataset.phase), null, { timeout: 2000 });
    await page.mouse.move(5, 5);
    checks.push('The mouse coming near sends him flying off');

    await perched();
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').waitFor();
    await page.waitForFunction(() => document.querySelector('.shredder-bird-sprite').dataset.phase === 'away', null, { timeout: 2000 });
    assert.equal(await sprite.evaluate(element => getComputedStyle(element).visibility), 'hidden');
    await page.waitForTimeout(2500);
    assert.equal(await sprite.getAttribute('data-phase'), 'away', 'he stays away while a window is open');
    await page.keyboard.press('Escape');
    checks.push('A window opening hides him until it closes');

    // While the user works (input within the last moments) he does not come back.
    await page.waitForFunction(() => document.querySelector('.shredder-bird-sprite').dataset.phase === 'away');
    const start = Date.now();
    while (Date.now() - start < 4000) { await page.keyboard.press('Shift'); await page.waitForTimeout(300); }
    assert.equal(await sprite.getAttribute('data-phase'), 'away', 'he waits for a pause before coming back');
    await perched();
    checks.push('He only comes back when the user pauses');

    await page.locator('#settings-tab-configuration').waitFor({ state: 'detached' }).catch(() => {});
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log(JSON.stringify({ ok: true, checks, errors, consoleErrors }, null, 2));
  } catch (error) {
    console.error(error); console.log(JSON.stringify({ ok: false, checks, errors, consoleErrors }, null, 2));
    process.exitCode = 1;
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
