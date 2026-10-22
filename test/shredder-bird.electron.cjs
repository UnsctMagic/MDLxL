const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Shredder the bird: website size, roams the bottom edge of the 3D view with only its own
// picture under him, does not run from the mouse, opens his notebook on a click, can be
// carried anywhere (and protests a little), moves on when a control appears under him,
// and hides while a window is open.
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
    // No tips in this test (long quiet start); short visits; he always protests when picked up.
    await page.evaluate(() => localStorage.setItem('mdlxl-shredder-timing', JSON.stringify({ birdFirst: 300, birdPerch: [600000, 600000], birdAway: [800, 800], birdPlaced: 600000, protest: 1, quietStart: 600000 })));
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').click();
    const toggle = page.locator('input[data-hotkey="configuration:shredder"]');
    if (await toggle.isChecked()) await toggle.uncheck();
    await toggle.check();
    await page.keyboard.press('Escape');
    await page.mouse.move(5, 5);
    const sprite = page.locator('.shredder-bird-sprite'), hit = page.locator('.shredder-bird-hit');
    const phase = () => sprite.getAttribute('data-phase');
    const perched = () => page.waitForFunction(() => document.querySelector('.shredder-bird-sprite')?.dataset.phase === 'perch', null, { timeout: 20000 });
    const birdBox = () => page.evaluate(() => { const box = document.querySelector('.shredder-bird-sprite').getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height, cx: (box.left + box.right) / 2 }; });
    await perched();
    assert.equal(await page.locator('.classic-status .shredder-bird, .classic-status button[aria-label="Shredder the Wise"]').count(), 0, 'no status-bar button: the bird himself is Shredder');
    const state = await page.evaluate(() => {
      const bird = document.querySelector('.shredder-bird-sprite'), layer = bird.parentElement, box = bird.getBoundingClientRect(), view = document.querySelector('.classic-view').getBoundingClientRect();
      const under = [];
      for (const fx of [.3, .5, .7]) for (const fy of [.3, .6, .85]) under.push(document.elementsFromPoint(box.left + box.width * fx, box.top + box.height * fy).find(element => !layer.contains(element)));
      return { box: { left: box.left, right: box.right, bottom: box.bottom, width: box.width }, view: { left: view.left, right: view.right, bottom: view.bottom },
        open: under.every(element => element && element.matches('canvas, .viewport, .viewport-area, .viewport-host, .classic-view') && element.closest('.classic-view')),
        under: under.map(element => element && element.tagName + '.' + element.className), sprite: getComputedStyle(bird).pointerEvents };
    });
    assert.ok(state.box.width >= 110, 'website size, not tiny: ' + state.box.width);
    assert.equal(state.sprite, 'none', 'only his body takes the mouse');
    assert.ok(state.open, 'only the 3D picture is under him: ' + state.under.join(', '));
    assert.ok(state.box.left >= state.view.left - 1 && state.box.right <= state.view.right + 1 && Math.abs(state.box.bottom - state.view.bottom) < 60, 'on the bottom edge of the 3D view');
    await page.screenshot({ path: path.join(out, 'perched.png'), clip: { x: Math.max(0, state.box.left - 200), y: state.box.bottom - 260, width: 520, height: 280 } });
    checks.push('He lands on the bottom edge of the 3D view, website size, with only the 3D picture under him');

    let box = await birdBox();
    await page.mouse.move(box.cx + 50, box.top - 20, { steps: 5 }); await page.waitForTimeout(1500);
    assert.ok(['perch', 'walk', 'land'].includes(await phase()), 'he does not run from the mouse: ' + await phase());
    await page.mouse.move(5, 5);
    checks.push('The mouse coming near does not chase him off');

    // A control appearing where he roams sends him along.
    box = await birdBox();
    await page.evaluate(({ left, top, right, bottom }) => {
      const blocker = document.createElement('button'); blocker.id = 'bird-blocker'; blocker.textContent = 'Useful';
      Object.assign(blocker.style, { position: 'fixed', left: left - 4 + 'px', top: top + 'px', width: right - left + 8 + 'px', height: bottom - top + 'px', zIndex: 20 });
      document.body.appendChild(blocker);
    }, box);
    await page.waitForFunction(() => {
      const bird = document.querySelector('.shredder-bird-sprite'), blocker = document.getElementById('bird-blocker').getBoundingClientRect(), box = bird.getBoundingClientRect();
      return bird.dataset.phase === 'away' || bird.dataset.phase === 'perch' && (box.right - box.width * .2 < blocker.left || box.left + box.width * .2 > blocker.right);
    }, null, { timeout: 6000 });
    await page.evaluate(() => document.getElementById('bird-blocker').remove());
    checks.push('A control appearing where he stands sends him along');

    // A click on him opens his notebook beside him; Esc closes it.
    await perched(); box = await birdBox();
    await hit.click();
    const panel = page.locator('.shredder-panel');
    await panel.waitFor();
    const panelBox = await panel.boundingBox();
    assert.ok(Math.abs(panelBox.x + panelBox.width / 2 - box.cx) < 420 && panelBox.y < box.bottom, 'the notebook opens beside him: ' + JSON.stringify({ panelBox, box, now: await birdBox() }));
    assert.ok(await panel.getByText("Shredder's notebook").count());
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'detached', timeout: 3000 });
    checks.push('Clicking him opens his notebook beside him; Esc closes it');

    // Pick him up and put him anywhere. He protests (always, in this test).
    box = await hit.boundingBox();
    const target = { x: 420, y: 330 };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y, { steps: 3 });
    await page.waitForFunction(() => document.querySelector('.shredder-bird-sprite').dataset.phase === 'held', null, { timeout: 2000 });
    const protest = page.locator('.shredder-protest');
    // The hidden test desktop draws about once a second, so check what he said rather than catch the 1.8 s line on screen.
    await page.waitForFunction(() => document.querySelector('.shredder-protest')?.textContent.trim().length > 0, null, { timeout: 3000 });
    const line = (await protest.textContent()).trim();
    assert.ok(['Hey!', 'Easy on the feathers -_-', 'I was comfy there...', 'Fine, here then :P', 'Dude, put me down.'].includes(line), line);
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();
    await perched();
    box = await birdBox();
    assert.ok(Math.abs(box.cx - target.x) < 6, 'he stands where he was put: ' + box.cx);
    await page.mouse.move(5, 5); await page.waitForTimeout(3000);
    const kept = await birdBox();
    assert.ok(Math.abs(kept.cx - box.cx) < 2 && Math.abs(kept.bottom - box.bottom) < 2, 'he stays where he was put');
    await page.screenshot({ path: path.join(out, 'placed.png'), clip: { x: Math.max(0, kept.left - 120), y: Math.max(0, kept.top - 60), width: 400, height: 260 } });
    checks.push(`He can be picked up (protest: "${line}") and put anywhere, and he stays there`);

    // A window hides him; afterwards he comes back to the place he was put.
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').waitFor();
    await page.waitForFunction(() => document.querySelector('.shredder-bird-sprite').dataset.phase === 'away', null, { timeout: 2000 });
    assert.equal(await sprite.evaluate(element => getComputedStyle(element).visibility), 'hidden');
    await page.keyboard.press('Escape');
    await page.mouse.move(5, 5);
    await perched();
    const back = await birdBox();
    assert.ok(Math.abs(back.cx - box.cx) < 6, 'back where he was put');
    checks.push('A window hides him; afterwards he comes back to where he was put');

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
