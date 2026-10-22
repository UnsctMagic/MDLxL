const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Shredder the Wise in the real app: on only in the test version, a hello, one tip after a
// mouse click, silence while a window is open, gone once the key is used, and a
// notebook that opens only when the bird is clicked.
// The lower right corner of the window, where the bird and his bubble sit.
const shot = async page => { const size = page.viewportSize() || await page.evaluate(() => ({ width: innerWidth, height: innerHeight })); return { x: size.width - 520, y: size.height - 300, width: 520, height: 300 }; };
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
    await page.locator('.classic-status').waitFor();
    await page.locator('.classic-view canvas').first().waitFor();
    const { SHREDDER_TEST_VERSION } = await import('../src/shredder-notebook.js');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.shredder-bird').count(), SHREDDER_TEST_VERSION ? 1 : 0, 'on by default only in the test version');
    assert.equal(await page.locator('.shredder-notebook').count(), 0, 'the notebook opens only on a click');
    assert.ok(['intro:welcome', null].includes(await page.locator('.shredder-bubble').getAttribute('data-shredder-lesson', { timeout: 500 }).catch(() => null)), 'at start, at most the hello');
    // SHREDDER_THEME=dark repeats the screenshots in another theme (the theme.js variables only).
    const theme = process.env.SHREDDER_THEME && require('../src/application-themes.json')[process.env.SHREDDER_THEME];
    // Preference changes re-apply the saved theme, so this runs right before each screenshot.
    const paint = () => theme && page.evaluate(theme => { document.documentElement.dataset.theme = theme.scheme; for (const [name, value] of Object.entries(theme.colors)) document.documentElement.style.setProperty(`--ui-${name}`, value); }, theme);
    const suffix = theme ? '-' + process.env.SHREDDER_THEME : '';
    checks.push(SHREDDER_TEST_VERSION ? 'Test version: the bird is there from the start, nothing but his hello' : 'Off by default: no bird, no bubble');

    const bubble = page.locator('.shredder-bubble'), seen = [];
    const buttons = () => bubble.getByRole('button').allTextContents();
    const kBro = async () => { await bubble.getByRole('button', { name: 'K, bro.' }).click(); await bubble.waitFor({ state: 'detached', timeout: 3000 }); };
    /** Waits for the tip `id`, saying "K, bro." to other tips that come first (tricks come before key tips). */
    const waitTip = async id => {
      for (let i = 0; i < 8; i++) {
        await bubble.waitFor({ timeout: 15000 });
        const current = await bubble.getAttribute('data-shredder-lesson'); seen.push(current);
        if (current === id) return;
        assert.deepEqual(await buttons(), ['K, bro.', 'Tell me later, bro.'], current);
        await kBro();
      }
      throw new Error(`tip ${id} never came: ${seen.join(', ')}`);
    };
    // He says hello once, the first time he may speak.
    const greeted = async () => {
      await waitTip('intro:welcome');
      assert.match(await bubble.locator('p').textContent(), /^Hi, I'm Shredder\./);
      assert.deepEqual(await buttons(), ['K, bro.']);
      await kBro();
    };
    if (SHREDDER_TEST_VERSION) { await greeted(); checks.push('Test version: he says hello by himself, once'); }

    // Short waits for the test. The two-minute quiet start applies only when MDLxL opens with him
    // already on; switching him on later (here after 10 s) lets him talk at once.
    await page.evaluate(() => localStorage.setItem('mdlxl-shredder-timing', JSON.stringify({ idle: 300, bubble: 6000, cooldown: 0, remindLater: 4000 })));
    await page.waitForFunction(() => performance.now() > 11000, null, { timeout: 30000 });
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').click();
    const toggle = page.locator('input[data-hotkey="configuration:shredder"]');
    // Switching him off and on again picks up the shortened waits.
    await toggle.uncheck(); await toggle.check();
    await page.keyboard.press('Escape');
    await page.locator('#settings-tab-configuration').waitFor({ state: 'detached' });
    const bird = page.locator('.classic-status .shredder-bird');
    await bird.waitFor();
    if (!SHREDDER_TEST_VERSION) await greeted();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.shredder-bubble, .shredder-notebook').count(), 0, 'the hello is said only once; then only the bird shows');
    const statusHeight = await page.locator('.classic-status').evaluate(element => element.getBoundingClientRect().height);
    assert.equal(Math.round(statusHeight), 20, 'the bird fits in the existing status bar');
    checks.push('Settings → Configuration switches him; only a small bird in the status bar');

    // Alt shows only short key badges; long chords and Ctrl+Alt+Space codes stay in the tooltips.
    await page.locator('.classic-view canvas').first().hover();
    await page.keyboard.down('Alt'); await page.waitForTimeout(300);
    const badgeTexts = await page.evaluate(() => [...document.querySelectorAll('.classic-app [data-hotkey-badge]')].filter(badge => !badge.closest('[data-hotkey^="forge:"]')).map(badge => badge.textContent));
    await page.keyboard.up('Alt');
    assert.ok(badgeTexts.length > 5, 'badges are still shown');
    assert.deepEqual(badgeTexts.filter(text => text.length > 3), [], 'no long badges');
    await bubble.waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
    if (await bubble.count()) await kBro();
    checks.push('Alt shows only short key badges');

    const move = page.locator('button[data-hotkey="translate"]').first();
    await move.click();
    await waitTip('key:translate');
    assert.ok(seen.includes('trick:move-axis'), 'picking Move also brings its Shift trick: ' + seen.join(', '));
    assert.equal((await bubble.locator('p').textContent()).trim(), 'Next time press M for Move.');
    assert.deepEqual(await buttons(), ['K, bro.', 'Tell me later, bro.']);
    await paint(); await page.screenshot({ path: path.join(out, `tip${suffix}.png`), clip: await shot(page) });
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.shredder')), false, 'the tip never takes the keyboard');
    checks.push('The first mouse click on Move: the Shift trick and the M tip, each with K, bro. / Tell me later, bro.');

    await page.locator('.classic-view canvas').first().hover();
    await page.keyboard.press('m');
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    checks.push('Pressing the key the tip names closes it at once');

    // Manners: a waiting tip stays quiet while a window is open, then comes when it closes.
    const rotate = page.locator('button[data-hotkey="rotate"]').first();
    await rotate.click();
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').waitFor();
    await page.waitForTimeout(1200);
    assert.equal(await bubble.count(), 0, 'silent while Settings is open');
    await page.keyboard.press('Escape');
    await waitTip('trick:rotate-snap');
    assert.equal((await bubble.locator('p').textContent()).trim(), 'While you rotate, hold Shift to snap to 15° steps.');
    await bubble.getByRole('button', { name: 'Tell me later, bro.' }).click();
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    await waitTip('key:rotate'); await kBro();
    assert.ok(seen.includes('trick:hotkeys-page'), 'opening Settings brings the Ctrl+K trick: ' + seen.join(', '));
    checks.push('Silent while a window is open; the tips come after it closes (including Ctrl+K for Hotkeys)');

    await page.waitForTimeout(600);
    const notebook = await page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-notebook-v1')));
    assert.equal(notebook.lessons['key:translate'].shown, 1);
    assert.equal(notebook.lessons['key:translate'].occasions, 1, 'using the key once while its tip is open counts once');
    assert.equal(notebook.lessons['key:rotate'].occasions, 0, '"K, bro." is not a use');
    assert.equal(notebook.lessons['trick:rotate-snap'].occasions, 0, '"Tell me later, bro." is not a use');
    assert.ok(notebook.lessons['trick:rotate-snap'].remindAfter > Date.now() - 60000);
    checks.push('Only real uses count toward learning; K, bro. and Tell me later, bro. do not');

    // The third click on keyed buttons within a minute brings the Alt trick.
    await rotate.click();
    await waitTip('trick:alt-badges');
    assert.equal((await bubble.locator('p').textContent()).trim(), 'Hold Alt to see the key on every button.');
    await page.locator('.classic-view canvas').first().hover();
    await page.keyboard.down('Alt'); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.shortcutHints), 'true', 'holding Alt shows the key badges');
    await page.keyboard.up('Alt');
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    checks.push('Three keyed clicks bring the Hold Alt trick; holding Alt closes it');

    // "Tell me later, bro." brings the rotate trick back; doing the trick (Shift while rotating) closes it.
    await page.waitForTimeout(4200);
    await page.keyboard.press('m'); await page.waitForTimeout(200); await page.keyboard.press('r');
    await waitTip('trick:rotate-snap');
    await page.keyboard.press('Control+a'); await page.waitForTimeout(200);
    const view = await page.locator('.classic-view canvas').first().boundingBox();
    await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2); await page.mouse.down();
    await page.keyboard.down('Shift');
    await page.mouse.move(view.x + view.width / 2 + 60, view.y + view.height / 2 + 30, { steps: 6 });
    await page.keyboard.up('Shift'); await page.mouse.up();
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    await page.keyboard.press('Control+z');
    checks.push('Tell me later, bro. brings the tip back; Shift while rotating closes it');

    // Picking Resize (the "zoom" tool) always brings Zoom anchor, even with one vertex selected.
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.keyboard.press('z');
    await waitTip('trick:zoom-anchor');
    assert.match(await bubble.locator('p').textContent(), /^Zoom anchor: select some vertices, press 1, then drag a box over one of them\./);
    await page.keyboard.press('Control+a'); await page.waitForTimeout(300);
    await page.keyboard.press('1');
    await bubble.waitFor({ state: 'detached', timeout: 3000 });
    await page.keyboard.press('Escape');
    checks.push('Picking Resize brings the Zoom anchor tip, even with nothing selected; pressing 1 closes it');

    // Alt-drag in the viewport is heard (and still turns the camera; Shredder never consumes it).
    const canvas = page.locator('.classic-view canvas').first(), box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 6 });
    await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForTimeout(600);
    const heard = await page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-notebook-v1')).lessons['trick:alt-orbit']?.occasions);
    assert.equal(heard, 1, 'Alt-drag counts toward the Alt-orbit trick');
    checks.push('Alt + left drag in the viewport is recorded');

    await bird.click();
    const book = page.locator('.shredder-notebook');
    await book.waitFor();
    const rows = await book.locator('tr').allTextContents();
    await paint(); await page.screenshot({ path: path.join(out, `notebook${suffix}.png`), clip: await shot(page) });
    assert.ok(rows.some(row => /^Vertex editor\d+ of \d+ learned$/.test(row)), rows.join(' | '));
    assert.ok(rows.some(row => row.startsWith('UV editor') && row.includes('Not visited yet')), rows.join(' | '));
    await page.keyboard.press('Escape');
    await book.waitFor({ state: 'detached', timeout: 3000 });
    checks.push('Clicking the bird opens his notebook; Esc closes it');

    await bird.click(); await book.getByRole('button', { name: 'Turn off' }).click();
    await bird.waitFor({ state: 'detached', timeout: 3000 });
    await page.keyboard.press('Control+Comma');
    await page.locator('#settings-tab-configuration').click();
    assert.equal(await toggle.isChecked(), false, 'Turn off clears the Settings switch');
    await page.keyboard.press('Escape');
    checks.push('Turn off in the notebook removes the bird and clears the setting');

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
