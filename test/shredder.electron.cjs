const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Shredder's tips in the real app: they come out of the bird, in a modern bubble with
// key caps and two small buttons; he flies near the view to say them (never at the mouse);
// he only suggests a way that is faster than the one the user uses, for their own mouse
// settings; the right action closes a tip; and only real uses count toward learning.
const shot = async page => { const size = page.viewportSize() || await page.evaluate(() => ({ width: innerWidth, height: innerHeight })); return { x: 0, y: 0, width: size.width, height: size.height }; };
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'shredder');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'shredder.mdx');
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
    const { SHREDDER_TEST_VERSION } = await import('../src/shredder-notebook.js');
    // SHREDDER_THEME=dark repeats the screenshots in another theme (the theme.js variables only).
    const theme = process.env.SHREDDER_THEME && require('../src/application-themes.json')[process.env.SHREDDER_THEME];
    const paint = () => theme && page.evaluate(theme => { document.documentElement.dataset.theme = theme.scheme; for (const [name, value] of Object.entries(theme.colors)) document.documentElement.style.setProperty(`--ui-${name}`, value); }, theme);
    const suffix = theme ? '-' + process.env.SHREDDER_THEME : '';
    const bubble = page.locator('.shredder-bubble'), seen = [];
    const visible = () => bubble.evaluate(element => getComputedStyle(element).visibility === 'visible').catch(() => false);
    const buttons = () => bubble.getByRole('button').allTextContents();
    const lessonText = () => bubble.locator('.shredder-text').textContent();
    const understood = async () => { await bubble.getByRole('button', { name: 'Understood' }).click(); await bubble.waitFor({ state: 'detached', timeout: 3000 }); };
    /** Waits until the bird says the tip `id`, saying "Understood" to other tips first. */
    const waitTip = async id => {
      for (let i = 0; i < 8; i++) {
        await page.waitForFunction(() => { const element = document.querySelector('.shredder-bubble'); return element && getComputedStyle(element).visibility === 'visible'; }, null, { timeout: 15000 });
        const current = await bubble.getAttribute('data-shredder-lesson'); seen.push(current);
        if (current === id) return;
        await understood();
      }
      throw new Error(`tip ${id} never came: ${seen.join(', ')}`);
    };
    const geometry = () => page.evaluate(() => {
      const rect = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; };
      return { bird: rect('.shredder-bird-sprite'), bubble: rect('.shredder-bubble'), view: rect('.classic-view') };
    });
    /** The bubble comes out of the bird: beside his head, not across the window. */
    const fromBird = ({ bird, bubble }) => {
      const gap = Math.max(bubble.left - bird.right, bird.left - bubble.right, 0) + Math.max(bubble.top - bird.bottom, 0);
      return gap < 40 && bubble.bottom > bird.top && bubble.bottom <= bird.bottom + 4;
    };

    const greet = async () => {
      await waitTip('intro:welcome');
      assert.equal((await bubble.locator('.shredder-caption').textContent()).trim(), 'Shredder');
      assert.match(await lessonText(), /^Hi, I'm Shredder\./);
      assert.deepEqual(await buttons(), ['Understood'], 'the hello has one small button');
      assert.ok(fromBird(await geometry()), 'he says it himself: ' + JSON.stringify(await geometry()));
      await understood();
      checks.push('He says hello himself, once, with one small Understood button');
    };
    if (SHREDDER_TEST_VERSION) await greet();
    // Short waits; switching him off and on picks them up.
    await page.evaluate(() => localStorage.setItem('mdlxl-shredder-timing', JSON.stringify({ idle: 300, bubble: 15000, cooldown: 0, remindLater: 4000, birdFirst: 300, birdPerch: [600000, 600000], birdAway: [800, 800], protest: 0 })));
    await page.waitForFunction(() => performance.now() > 11000, null, { timeout: 30000 });
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').click();
    const toggle = page.locator('input[data-hotkey="configuration:shredder"]');
    if (await toggle.isChecked()) await toggle.uncheck();
    await toggle.check();
    await page.keyboard.press('Escape');
    await page.mouse.move(5, 5);

    if (!SHREDDER_TEST_VERSION) await greet();

    // A key tip: the first mouse click on Move.
    const move = page.locator('button[data-hotkey="translate"]').first();
    await move.click();
    await waitTip('key:translate');
    assert.equal((await bubble.locator('.shredder-caption').textContent()).trim(), 'Shortcut');
    assert.equal((await lessonText()).replace(/\s+/g, ' ').trim(), 'Next time press M for Move.');
    assert.deepEqual(await bubble.locator('kbd').allTextContents(), ['M'], 'keys are key caps');
    assert.deepEqual(await buttons(), ['Remind me', 'Understood']);
    const style = await bubble.evaluate(element => { const css = getComputedStyle(element); return { radius: parseFloat(css.borderTopLeftRadius), shadow: css.boxShadow }; });
    assert.ok(style.radius >= 10 && style.shadow !== 'none', 'a rounded bubble with a soft shadow');
    const buttonHeight = await bubble.getByRole('button', { name: 'Understood' }).evaluate(element => element.getBoundingClientRect().height);
    assert.ok(buttonHeight <= 24, 'small buttons: ' + buttonHeight);
    assert.ok(fromBird(await geometry()), 'from the bird: ' + JSON.stringify(await geometry()));
    await paint(); await page.screenshot({ path: path.join(out, `tip${suffix}.png`), clip: await shot(page) });
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.shredder-ui')), false, 'the tip never takes the keyboard');
    await page.locator('.classic-view canvas').first().hover({ position: { x: 300, y: 200 } });
    await page.keyboard.press('m');
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    checks.push('Click Move: he says "Next time press [M] for Move." beside himself; pressing M closes it');

    // Faster ways for the camera, for the default (classic) mouse buttons.
    // Someone who already turns the camera a fast way (here Alt-drag) never hears about another way of turning it.
    const canvas = page.locator('.classic-view canvas').first(), view = await canvas.boundingBox();
    await page.mouse.move(view.x + view.width / 2, view.y + view.height / 3);
    await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(view.x + view.width / 2 + 60, view.y + view.height / 3 + 10, { steps: 5 });
    await page.mouse.up(); await page.keyboard.up('Alt');
    await page.locator('button[data-hotkey="camera:rotate"]').click();
    await page.locator('button[data-hotkey="camera:work"]').click();
    await page.mouse.move(view.x + 40, view.y + 40);
    await page.waitForTimeout(2500);
    const after = await visible() ? await bubble.getAttribute('data-shredder-lesson') : '';
    assert.ok(!after.startsWith('faster:orbit'), 'no turning tip for someone who already turns the camera fast: ' + after);
    if (after) await understood();
    checks.push('Turning the camera with the buttons brings no tip to someone who already turns it fast (Alt-drag)');

    // Moving the camera with the Move camera button: the fastest way here is the right mouse button.
    await page.locator('button[data-hotkey="camera:move"]').click();
    await waitTip('faster:pan-right');
    assert.equal((await bubble.locator('.shredder-caption').textContent()).trim(), 'Faster way');
    assert.match(await lessonText(), /^Drag with the right mouse button to move the camera/);
    await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
    await page.mouse.down({ button: 'right' }); await page.mouse.move(view.x + view.width / 2 + 40, view.y + view.height / 2, { steps: 4 }); await page.mouse.up({ button: 'right' });
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    await page.locator('button[data-hotkey="camera:work"]').click();
    await page.waitForTimeout(800);
    if (await visible()) await understood();
    checks.push('The Move camera button brings "Drag with the right mouse button..."; doing it closes the tip');

    // The Zoom tool: the wheel is faster. He comes near the view to say it, but never at the mouse.
    await page.locator('button[data-hotkey="camera:zoom"]').click();
    const pointer = { x: view.x + view.width * .55, y: view.y + view.height * .75 };
    await page.mouse.move(pointer.x, pointer.y);
    await waitTip('faster:zoom-wheel');
    const zoomGeometry = await geometry();
    const birdCentre = { x: (zoomGeometry.bird.left + zoomGeometry.bird.right) / 2, y: (zoomGeometry.bird.top + zoomGeometry.bird.bottom) / 2 };
    assert.ok(Math.hypot(birdCentre.x - pointer.x, birdCentre.y - pointer.y) >= 180, 'not in your face: ' + JSON.stringify({ birdCentre, pointer }));
    assert.ok(zoomGeometry.bird.left >= zoomGeometry.view.left - 2 && zoomGeometry.bird.right <= zoomGeometry.view.right + 2, 'near the view');
    await page.mouse.wheel(0, -120);
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    await page.locator('button[data-hotkey="camera:work"]').click();
    checks.push('The Zoom tool brings "Spin the mouse wheel..." near the view but away from the mouse; spinning it closes the tip');

    // "Remind me" brings the tip back after a while; neither button counts as a use.
    await page.waitForTimeout(800);
    if (await visible()) await understood();
    const rotate = page.locator('button[data-hotkey="rotate"]').first();
    await rotate.click();
    await waitTip('key:rotate');
    await bubble.getByRole('button', { name: 'Remind me' }).click();
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    await page.waitForTimeout(600);
    const notebook = await page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-notebook-v1')));
    assert.equal(notebook.lessons['key:rotate'].occasions, 0, '"Remind me" is not a use');
    assert.ok(notebook.lessons['key:rotate'].remindAfter > 0);
    assert.equal(notebook.lessons['key:translate'].occasions, 1, 'pressing M while the tip was open counts once');
    assert.ok(notebook.lessons['faster:orbit-middle-click'].learnedAt, 'the fast Alt-drag covers the middle-click tip');
    await page.waitForTimeout(4200);
    await page.mouse.move(5, 5);
    await rotate.click();
    await waitTip('key:rotate');
    await understood();
    checks.push('Remind me brings the tip back after the wait; neither button counts as using it');

    // Zoom anchor whenever Resize is picked; pressing the key closes it.
    await page.locator('.classic-view canvas').first().hover({ position: { x: 200, y: 150 } });
    await page.keyboard.press('Control+a'); await page.waitForTimeout(200);
    await page.keyboard.press('z');
    await waitTip('tip:zoom-anchor');
    assert.deepEqual(await bubble.locator('kbd').allTextContents(), ['1']);
    await page.keyboard.press('1');
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    await page.keyboard.press('Escape');
    checks.push('Picking Resize brings Zoom anchor; pressing [1] closes it');

    // His notebook opens from the bird; Turn off removes him.
    await page.mouse.move(5, 5);
    await page.waitForFunction(() => ['perch', 'walk'].includes(document.querySelector('.shredder-bird-sprite')?.dataset.phase), null, { timeout: 15000 });
    await page.locator('.shredder-bird-hit').click();
    const panel = page.locator('.shredder-panel');
    await panel.waitFor();
    const rows = await panel.locator('tr').allTextContents();
    assert.ok(rows.some(row => /^Camera and view\d+ of \d+ learned$/.test(row)), rows.join(' | '));
    await paint(); await page.screenshot({ path: path.join(out, `notebook${suffix}.png`), clip: await shot(page) });
    await panel.getByRole('button', { name: 'Turn off' }).click();
    await page.locator('.shredder-bird-layer').waitFor({ state: 'detached', timeout: 3000 });
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').click();
    assert.equal(await toggle.isChecked(), false, 'Turn off clears the Settings switch');
    await page.keyboard.press('Escape');
    checks.push(`His notebook opens from the bird; Turn off removes him (test version: ${SHREDDER_TEST_VERSION})`);

    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log(JSON.stringify({ ok: true, checks, seen, errors, consoleErrors }, null, 2));
  } catch (error) {
    console.error(error); console.log(JSON.stringify({ ok: false, checks, errors, consoleErrors }, null, 2));
    process.exitCode = 1;
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
