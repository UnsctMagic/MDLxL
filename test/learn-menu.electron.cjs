const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'learn-menu');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'learn.mdx');
  await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const legacy = { enabled: false, position: 'top', size: 'large', style: 'plain', duration: 10, learnUses: 3, quietHours: 8 };
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { shredder: legacy, hotkeys: { shredder: ['Alt+J'] } } }));
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  let app, page;
  const errors = [];
  const launch = async () => {
    app = await _electron.launch({ executablePath, args: process.env.MDLXL_ELECTRON_PATH ? [fixture] : [root, fixture], cwd: root,
      env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '1' }, timeout: 60000 });
    page = await app.firstWindow(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setSize(1100, 760); win.showInactive(); });
    await page.locator('.classic-view canvas').first().waitFor();
  };
  const close = async () => { if (app) { await app.close(); app = null; } };
  const click = async locator => {
    await locator.waitFor();
    const point = await locator.evaluate(element => {
      const rect = element.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      if (!element.contains(document.elementFromPoint(x, y))) throw Error('Control is covered: ' + element.textContent);
      return { x, y };
    });
    await page.mouse.click(point.x, point.y);
  };
  const tile = () => page.locator('.learner-tool');
  const menu = () => page.locator('.learn-menu');
  const open = async () => { if (!await menu().count()) await click(tile()); await menu().waitFor(); };
  const row = name => menu().getByRole('menuitemcheckbox', { name, exact: true });
  const hintState = locator => locator.evaluate(element => ({ available: element.dataset.hotkeyAvailable, visibility: getComputedStyle(element.querySelector('[data-hotkey-badge]')).visibility }));
  const screenshot = async name => {
    const window = await app.browserWindow(page);
    const png = await window.evaluate(window => window.webContents.capturePage().then(image => image.toPNG().toString('base64')));
    assert.ok(png.length > 10000, 'nonempty rendered screenshot');
    await fs.writeFile(path.join(out, name + '.png'), Buffer.from(png, 'base64'));
  };
  const rotateCamera = async () => {
    const camera = () => page.evaluate(() => {
      const host = document.querySelector('[aria-label="3D model viewport"]');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.renderer && state?.entries) return state.camera.quaternion.toArray();
      }
      throw Error('Viewport runtime missing');
    });
    const before = await camera(), rect = await page.locator('.classic-view canvas').first().boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 70, rect.y + rect.height / 2 + 40, { steps: 8 });
    await page.mouse.up(); await page.keyboard.up('Alt');
    assert.notDeepEqual(await camera(), before, 'real Alt-mouse drag rotates camera');
  };
  try {
    await launch();
    assert.equal(await tile().getAttribute('aria-pressed'), 'false');
    await page.evaluate(() => {
      localStorage.removeItem('mdlxl-learn-keycaps-v1');
      localStorage.setItem('mdlxl-shredder-keycaps-v1', JSON.stringify({ version: 1, keys: {
        translate: { uses: 0, quietUntil: Date.now() + 86400000, silenced: false },
        rotate: { uses: 2, quietUntil: 0, silenced: true }, shredder: { uses: 2, quietUntil: 0, silenced: false }
      } }));
    });
    await page.reload(); await page.locator('.learner-tool').waitFor();
    await open();
    assert.equal(await menu().locator('button').count(), 3);
    await page.waitForFunction(() => [...document.querySelectorAll('.learn-menu button')].every(button => button.dataset.hotkeyShortcuts));
    for (const keys of await menu().locator('button').evaluateAll(buttons => buttons.map(button => button.dataset.hotkeyShortcuts))) {
      assert.ok(keys.split(' / ').every(key => !key.includes('>') && key.split('+').length <= 2), 'rows get short keys from the name allocator');
    }
    assert.equal(await menu().evaluate(element => getComputedStyle(element.querySelector('button')).fontFamily.includes('MDLxL Dock')), true);
    assert.equal(await menu().evaluate(element => getComputedStyle(element.querySelector('button')).fontWeight), '700');
    assert.equal(await row('Learn mode').evaluate(element => getComputedStyle(element).color), 'rgb(236, 232, 222)', 'off row is readable on dark slate');
    for (const width of [1100, 1920]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 800), width);
      await page.waitForTimeout(200);
      const [button, box] = await Promise.all([tile().boundingBox(), menu().boundingBox()]);
      assert.ok(box.y >= button.y + button.height && box.y < button.y + button.height + 10, 'anchored directly below LER');
      assert.ok(box.x >= 0 && box.x + box.width <= width, 'box fits window');
      await screenshot('learn-menu-' + width);
    }
    await page.keyboard.press('Escape'); await menu().waitFor({ state: 'detached' });
    await open(); await click(tile()); await menu().waitFor({ state: 'detached' });
    await open(); await page.mouse.click(700, 400); await menu().waitFor({ state: 'detached' });
    await rotateCamera();
    console.log('✓ Three-row box is anchored at 1100/1920; Esc, LER and outside click close it; real camera drag works');

    await open(); await click(row('Learn mode'));
    assert.equal(await tile().getAttribute('aria-pressed'), 'true');
    assert.equal(await row('Learn mode').getAttribute('aria-checked'), 'true');
    assert.equal(await row('Learn mode').evaluate(element => getComputedStyle(element).color), 'rgb(242, 227, 92)', 'on row uses LER lemon');
    assert.equal(await menu().count(), 1, 'toggle keeps box open');
    const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-learn-keycaps-v1')));
    assert.ok(migrated.keys.translate.quietUntil > Date.now());
    assert.equal(migrated.keys.rotate.silenced, true); assert.equal(migrated.keys.rotate.uses, 2);
    assert.equal(migrated.keys.learn.uses, 2);
    assert.equal(await page.evaluate(() => localStorage.getItem('mdlxl-shredder-keycaps-v1')), null);
    await page.keyboard.press('Escape');
    await click(page.locator('button[data-hotkey="translate"]:visible').first());
    assert.equal(await page.locator('.learn-keycap').count(), 0, 'migrated learned Move stays quiet');
    await click(page.locator('button[data-hotkey="rotate"]:visible').first());
    assert.equal(await page.locator('.learn-keycap').count(), 0, 'migrated muted Rotate stays quiet');
    await page.keyboard.press('Alt+j');
    assert.equal(await tile().getAttribute('aria-pressed'), 'false', 'custom old command key carries over');
    assert.equal(await menu().count(), 0);
    await page.keyboard.press('Alt+j');
    await open(); await click(menu().getByRole('menuitem', { name: 'Learn settings…', exact: true }));
    assert.equal(await menu().count(), 0);
    assert.equal(await page.locator('#settings-tab-hotkeys').getAttribute('aria-selected'), 'true');
    const heading = page.locator('#learn-settings');
    const visible = await heading.evaluate(element => { const a = element.getBoundingClientRect(), b = element.closest('.settings-body').getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; });
    assert.equal(visible, true, 'Learn block scrolled into view');
    assert.equal(await page.getByLabel('Learn mode: Size', { exact: true }).inputValue(), 'large');
    assert.equal(await page.getByLabel('Learn mode: Where', { exact: true }).inputValue(), 'top');
    await click(page.getByRole('button', { name: 'Close Settings', exact: true }));
    console.log('✓ Old preference values, custom Learn key, learned/muted notebook survive; Learn settings opens at the correct block');

    await open(); await click(row('Show hotkeys'));
    assert.equal(await row('Show hotkeys').getAttribute('aria-checked'), 'true');
    await page.keyboard.press('Escape');
    const move = page.locator('button[data-hotkey="translate"]:visible').first();
    await page.waitForFunction(() => document.querySelector('[data-hotkey="translate"]').dataset.hotkeyAvailable === 'true');
    assert.equal((await hintState(move)).visibility, 'visible');
    await page.keyboard.down('Alt'); await page.keyboard.up('Alt');
    assert.equal((await hintState(move)).visibility, 'visible', 'Alt release keeps persistent hints');
    await rotateCamera();
    await page.keyboard.press('Control+k');
    await page.locator('#settings-tab-hotkeys').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-hotkey="translate"]').dataset.hotkeyAvailable === 'false');
    assert.equal((await hintState(move)).visibility, 'hidden');
    assert.equal((await hintState(page.locator('#settings-tab-hotkeys'))).visibility, 'visible');
    await click(page.getByRole('button', { name: 'Close Settings', exact: true }));
    await page.waitForFunction(() => document.querySelector('[data-hotkey="translate"]').dataset.hotkeyAvailable === 'true');
    console.log('✓ Persistent letters follow opening/closing a dialog, ignore Alt release, and permit real camera rotation');

    // OptimizeXL is the existing real detached React window.
    const childPromise = app.waitForEvent('window');
    await click(page.locator('[data-hotkey="optimizeModel"]'));
    const child = await childPromise; child.setDefaultTimeout(15000);
    await child.locator('.mdlxl-detached-root').waitFor();
    await child.locator('button').first().waitFor();
    await child.evaluate(() => document.querySelector('button').focus());
    // The detached workflow has few shortcut hooks; use one explicit control in its
    // registered root to exercise the shared discovery/availability path without editing a model.
    await child.evaluate(() => { const button = document.querySelector('button'); button.setAttribute('data-hotkey', 'learn-test:detached'); button.setAttribute('data-hotkey-label', 'Detached test'); });
    await child.waitForFunction(() => document.querySelector('[data-hotkey="learn-test:detached"]')?.querySelector('[data-hotkey-badge]'));
    await child.waitForFunction(() => document.documentElement.dataset.shortcutHints === 'true');
    assert.equal(await child.locator('[data-hotkey="learn-test:detached"]').evaluate(element => getComputedStyle(element.querySelector('[data-hotkey-badge]')).visibility), 'visible');
    await child.close();
    await page.evaluate(() => document.querySelector('.classic-view canvas').focus());
    await page.waitForFunction(() => document.querySelector('[data-hotkey="translate"]').dataset.hotkeyAvailable === 'true');
    console.log('✓ Persistent letters recompute for an opened, focused and closed detached window');

    await close(); await launch();
    await page.waitForFunction(() => document.documentElement.dataset.shortcutHints === 'true');
    assert.equal((await hintState(page.locator('button[data-hotkey="translate"]:visible').first())).visibility, 'visible');
    await open(); assert.equal(await row('Show hotkeys').getAttribute('aria-checked'), 'true');
    await click(row('Show hotkeys')); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.shortcutHints), undefined);
    await page.keyboard.down('Alt');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.shortcutHints), 'true');
    await page.keyboard.up('Alt');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.shortcutHints), undefined);
    await click(page.locator('.vis-toggle'));
    assert.equal(await tile().isVisible(), false, 'owner refinement: LER stays hidden in VIS');
    assert.equal(await menu().count(), 0);
    assert.deepEqual(errors, []);
    console.log('✓ Show hotkeys survives restart, switches off, preserves held-Alt behavior; LER stays hidden in VIS as requested');
  } finally {
    await close();
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
