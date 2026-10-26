const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Shredder's keycap reminders in the real app: a mouse click on a button with a key shows
// just that key; using the key closes it; five real uses quiet that key only; holding a key
// or typing in a field does not count; clicking the popup dismisses only that reminder; Settings → Keyboard
// Shortcuts changes the look and brings silenced and learned keys back.
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
  const errors = [], checks = [];
  const check = message => { checks.push(message); console.log('✓ ' + message); };
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setSize(1280, 800); });
    await page.locator('.classic-view canvas').first().waitFor();
    const { SHREDDER_TEST_VERSION } = await import('../src/shredder-keycaps.js');
    const popup = page.locator('.shredder-keycap');
    const move = page.locator('button[data-hotkey="translate"]:visible').first(), rotate = page.locator('button[data-hotkey="rotate"]:visible').first();
    // The hidden test desktop draws slowly; a missing screenshot is not a failure.
    const snap = file => process.env.SHREDDER_NO_SHOTS ? null : page.screenshot({ path: file, timeout: 60000 }).catch(error => console.warn('screenshot skipped: ' + error.message.split('\n')[0]));
    const caps = () => popup.locator('kbd').allTextContents();
    const gone = () => popup.waitFor({ state: 'detached', timeout: 3000 });
    const pressInView = async key => { await page.locator('.classic-view canvas').first().hover(); await page.keyboard.press(key); };

    const settings = async () => { await page.keyboard.press('Control+Comma'); await page.locator('#settings-tab-hotkeys').click(); };
    const closeSettings = async () => { await page.getByRole('button', { name: 'Close Settings', exact: true }).click(); await page.locator('#settings-tab-hotkeys').waitFor({ state: 'detached' }); };
    if (!SHREDDER_TEST_VERSION) { await settings(); await page.locator('input[data-hotkey="hotkeys:shredder"]').check(); await closeSettings(); }

    // 1. A click shows only the key, beside the button.
    await move.click();
    await popup.waitFor();
    assert.deepEqual(await caps(), ['M']);
    assert.equal((await popup.textContent()).trim(), 'M', 'nothing but the key');
    const [button, cap] = await Promise.all([move.boundingBox(), popup.boundingBox()]);
    assert.ok(cap.y + cap.height <= button.y || cap.y >= button.y + button.height || cap.x + cap.width <= button.x || cap.x >= button.x + button.width, 'does not cover its button');
    assert.ok(await popup.evaluate(element => {
      const box = element.getBoundingClientRect();
      return [...document.querySelectorAll('button, input, select, textarea')].filter(control => control.checkVisibility()).every(control => {
        const rect = control.getBoundingClientRect();
        return box.right <= rect.left || box.left >= rect.right || box.bottom <= rect.top || box.top >= rect.bottom;
      });
    }), 'neighboring buttons and fields stay clear');
    await snap(path.join(out, 'keycap-beside.png'));
    check('A click on Move shows just [M] beside it');

    // Repeated clicks must preserve both the visible element and its original deadline.
    const firstPopup = await popup.elementHandle();
    await page.waitForTimeout(2800);
    await move.click();
    assert.equal(await firstPopup.evaluate(element => element === document.querySelector('.shredder-keycap')), true, 'same popup is not remounted');
    await gone();
    check('Repeated clicks do not replay the animation or extend the original five-second lifetime');

    await move.click(); await popup.waitFor();
    // A newly appearing adjacent control must remain clickable, without restarting the popup.
    await popup.evaluate(element => {
      const rect = element.getBoundingClientRect(), control = document.createElement('button');
      control.id = 'shredder-neighbor-test'; control.textContent = 'Test adjacent control';
      Object.assign(control.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', zIndex: '1200' });
      control.onclick = () => window.neighborClicks = (window.neighborClicks || 0) + 1;
      document.body.append(control);
    });
    await page.waitForFunction(() => {
      const control = document.getElementById('shredder-neighbor-test'), rect = control.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === control;
    });
    await page.locator('#shredder-neighbor-test').click();
    assert.equal(await page.evaluate(() => window.neighborClicks), 1, 'the neighbor receives the actual click');
    await page.locator('#shredder-neighbor-test').evaluate(element => element.remove());
    check('Popup moves clear of a newly appearing button; the button receives the mouse click');

    // 2. Using the key closes it at once.
    await pressInView('m');
    await gone();
    check('Pressing M closes it');

    // 3. Holding a key down and typing in a field do not count; five real uses quiet M only.
    await page.locator('.classic-view canvas').first().hover();
    await page.keyboard.down('m'); await page.waitForTimeout(700); await page.keyboard.up('m');
    const uses = () => page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-keycaps-v1') || '{"keys":{}}').keys.translate?.uses || 0);
    assert.equal(await uses(), 2, 'one press plus one held press: ' + await uses());
    await settings();
    await page.locator('input[data-hotkey="hotkeys:search"]').click(); await page.keyboard.type('mmmm');
    await closeSettings();
    assert.equal(await uses(), 2, 'typing in a field does not count');
    for (let press = 0; press < 3; press++) await pressInView('m');
    await move.click(); await page.waitForTimeout(400);
    assert.equal(await popup.count(), 0, 'M is quiet after five uses');
    // Learned key uses renew quiet time in the actual app too.
    const quietBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-keycaps-v1')).keys.translate.quietUntil);
    await pressInView('m');
    const quietAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-keycaps-v1')).keys.translate.quietUntil);
    assert.ok(quietAfter > quietBefore, 'using learned M extends its quiet time');

    await rotate.click(); await popup.waitFor();
    assert.deepEqual(await caps(), ['R'], 'other keys still remind');
    check('Five real presses of M quiet M; a held key and typing in a field do not count; R still reminds');

    // 4. Clicking dismisses this popup without changing learning or silencing the key.
    const notebookBeforeDismiss = await page.evaluate(() => localStorage.getItem('mdlxl-shredder-keycaps-v1'));
    await popup.click(); await gone();
    assert.equal(await page.evaluate(() => localStorage.getItem('mdlxl-shredder-keycaps-v1')), notebookBeforeDismiss);
    await move.click(); await rotate.click(); await popup.waitFor();
    assert.deepEqual(await caps(), ['R'], 'a later click can remind again');
    await popup.click(); await gone();
    await page.locator('button[data-hotkey="scale"]:visible').first().click(); await popup.waitFor();
    assert.deepEqual(await caps(), ['Z']);
    await pressInView('z'); await gone();
    check('Clicking [R] dismisses only that popup, keeps learning intact, and permits later reminders');

    // Legacy silences remain recoverable; new dismissals create no silenced keys.
    await page.evaluate(() => {
      const notebook = JSON.parse(localStorage.getItem('mdlxl-shredder-keycaps-v1'));
      notebook.keys['legacy-muted'] = { uses: 0, quietUntil: 0, silenced: true };
      localStorage.setItem('mdlxl-shredder-keycaps-v1', JSON.stringify(notebook));
      window.dispatchEvent(new CustomEvent('mdlxl-shredder-notebook'));
    });
    // 5. Settings: position, size, flashing, and bringing keys back.
    await settings();
    const restoreSilenced = page.getByRole('button', { name: /Bring back silenced keys \(1\)/ }), restoreLearned = page.getByRole('button', { name: /Bring back learned keys \(1\)/ });
    await page.locator('select[aria-label="Shortcut reminders: Where"]').selectOption('bottom');
    await page.locator('select[aria-label="Shortcut reminders: Size"]').selectOption('large');
    await page.locator('select[aria-label="Shortcut reminders: Look"]').selectOption('flash');
    await page.locator('select[aria-label="Shortcut reminders: Stays for"]').selectOption('0');
    await snap(path.join(out, 'settings.png'));
    await restoreSilenced.click(); await restoreLearned.click();
    assert.equal(await page.getByRole('button', { name: /Bring back silenced keys/ }).count(), 0, 'legacy recovery control disappears when no silences remain');
    await closeSettings();
    await rotate.click(); await popup.waitFor();
    const style = await popup.evaluate(element => ({ position: element.dataset.position, size: element.dataset.size, look: element.dataset.style, font: parseFloat(getComputedStyle(element).fontSize), box: element.getBoundingClientRect().toJSON() }));
    assert.deepEqual([style.position, style.size, style.look], ['bottom', 'large', 'flash']);
    assert.ok(style.font >= 28 && Math.abs(style.box.x + style.box.width / 2 - 640) < 20, JSON.stringify(style));
    await page.waitForTimeout(6000);
    assert.equal(await popup.count(), 1, '"Until used or clicked" keeps it up');
    await snap(path.join(out, 'keycap-bottom-large.png'));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 560));
    await page.waitForTimeout(200);
    assert.ok(await popup.evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight &&
        [...document.querySelectorAll('button, input, select, textarea')].filter(control => control.checkVisibility()).every(control => {
          const rect = control.getBoundingClientRect();
          return box.right <= rect.left || box.left >= rect.right || box.bottom <= rect.top || box.top >= rect.bottom;
        });
    }), 'large reminders stay within a small window and clear of controls after resize');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800));
    await pressInView('r'); await gone();
    await move.click(); await popup.waitFor();
    assert.deepEqual(await caps(), ['M'], 'learned M is back');
    await pressInView('m'); await gone();
    check('Settings move it to the bottom middle, make it large and flashing, keep it until used, and bring back silenced and learned keys');

    // The overlay must leave the existing camera mouse controls usable.
    const camera = () => page.evaluate(() => {
      const host = document.querySelector('[aria-label="3D model viewport"]');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.renderer && state?.entries) return state.camera.quaternion.toArray();
      }
      throw Error('Viewport runtime not found');
    });
    const beforeRotation = await camera(), canvasBox = await page.locator('.classic-view canvas').first().boundingBox();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.keyboard.down('Alt'); await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 70, canvasBox.y + canvasBox.height / 2 + 45, { steps: 6 });
    await page.mouse.up(); await page.keyboard.up('Alt');
    assert.notDeepEqual(await camera(), beforeRotation, 'actual Alt-drag rotates the camera');
    check('Actual Alt-mouse drag still rotates the model');

    // 6. Buttons that used to have only a Ctrl+Alt+Space code now have a short key: Fit is Home.
    const fitUses = () => page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-keycaps-v1')).keys.fit?.uses || 0);
    await page.locator('button[data-hotkey="fit"]:visible').first().click(); await popup.waitFor();
    assert.equal((await popup.textContent()).trim(), 'Home');
    await page.locator('.classic-view canvas').first().hover(); await page.keyboard.press('Home');
    await gone();
    assert.equal(await fitUses(), 1);
    check('Fit shows [Home]; pressing Home closes it and counts');

    // 7. A window's buttons have keys of their own, from their names: in the Material Manager N is New
    //    (in the editor it shows normals). The footer Close reminds of Esc; Alt+M opens it, Esc closes it.
    await page.locator('.classic-view canvas').first().hover(); await page.keyboard.press('Alt+M');
    const manager = page.getByRole('dialog', { name: 'Material Manager' }); await manager.waitFor();
    const materials = () => manager.locator('[data-hotkey^="item:"]').count(), before = await materials();
    assert.equal(await manager.locator('button', { hasText: /^New/ }).first().getAttribute('data-hotkey-shortcuts'), 'N');
    await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('n');
    await page.waitForFunction(count => document.querySelectorAll('[role="dialog"] [data-hotkey^="item:"]').length === count, before + 1);
    await manager.locator('footer button', { hasText: /^Close/ }).click(); await popup.waitFor();
    assert.equal((await popup.textContent()).trim(), 'Escape');
    await manager.waitFor({ state: 'detached' });
    await page.keyboard.press('Escape'); await gone();
    await page.locator('.classic-view canvas').first().hover(); await page.keyboard.press('Alt+M'); await manager.waitFor();
    await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Escape'); await manager.waitFor({ state: 'detached' });
    check('Material Manager: Alt+M opens it, N makes a new material, its footer Close reminds of [Escape], Esc closes it');

    // 8. Citadel Paint's own keys: a click shows the key its button shows; Paint's key closes it.
    await page.locator('[data-hotkey="paint"]').first().click();
    if (await popup.count()) await popup.click();
    await page.getByRole('button', { name: /New base coat/ }).click();
    await page.getByRole('button', { name: 'Begin painting', exact: true }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).waitFor().catch(async error => { console.log((await page.locator('body').innerText()).slice(0, 3000)); throw error; });
    await page.getByRole('button', { name: 'Erase', exact: true }).click(); await popup.waitFor();
    assert.equal((await popup.textContent()).trim(), 'E');
    await page.mouse.move(640, 30); await page.keyboard.press('e'); await gone();
    const paintUses = () => page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-keycaps-v1')).keys['paint-key:E']?.uses || 0);
    assert.equal(await paintUses(), 1, 'Paint keys count like other shortcuts');
    await page.getByRole('button', { name: 'Undo paint', exact: true }).evaluate(element => element.disabled) || await page.getByRole('button', { name: 'Undo paint', exact: true }).click();
    await page.getByRole('button', { name: 'Color', exact: true }).click(); await popup.waitFor();
    assert.equal((await popup.textContent()).trim(), 'B');
    await popup.click(); await gone();
    await page.getByRole('button', { name: 'Color', exact: true }).click(); await page.waitForTimeout(400);
    await popup.waitFor();
    assert.equal((await popup.textContent()).trim(), 'B', 'Paint dismissal also allows later reminders');
    await popup.click(); await gone();
    await page.locator('input[type="range"][aria-label="Opacity"]').click(); await popup.waitFor();
    assert.equal((await popup.textContent()).trim(), '− +');
    // The slider keeps focus after a click, and Paint leaves keys typed into its fields alone.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('-'); await gone();
    check('Citadel Paint: Erase shows [E] and E closes it; clicking [B] dismisses only that reminder; the Opacity slider shows [− +] and − closes it');

    // 9. Turning the mode off stops it; the Settings menu command toggles it.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'shredder'));
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Erase', exact: true }).click(); await page.waitForTimeout(400);
    assert.equal(await popup.count(), 0, 'off');
    check('Settings → Shortcut reminders turns the mode off');

    assert.deepEqual(errors, []);

  } finally {
    // Unsaved Paint work makes the window ask before closing; don't wait for it.
    await Promise.race([app.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 10000))]);
    // Kill the whole Electron process tree (renderer and GPU too), not just its main process.
    try { const pid = app.process().pid; if (process.platform === 'win32') require('node:child_process').spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']); else app.process().kill(); } catch {}
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
