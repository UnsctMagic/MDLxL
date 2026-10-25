const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Shredder's keycap reminders in the real app: a mouse click on a button with a key shows
// just that key; using the key closes it; five real uses quiet that key only; holding a key
// or typing in a field does not count; clicking the popup silences it; Settings → Keyboard
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
    assert.ok(Math.abs(cap.x + cap.width / 2 - (button.x + button.width / 2)) < 40 && (cap.y + cap.height <= button.y + 1 || cap.y >= button.y + button.height - 1), 'beside the clicked button');
    await snap(path.join(out, 'keycap-beside.png'));
    checks.push('A click on Move shows just [M] beside it');

    // 2. Using the key closes it at once.
    await pressInView('m');
    await gone();
    checks.push('Pressing M closes it');

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
    await rotate.click(); await popup.waitFor();
    assert.deepEqual(await caps(), ['R'], 'other keys still remind');
    checks.push('Five real presses of M quiet M; a held key and typing in a field do not count; R still reminds');

    // 4. Clicking the popup silences that key.
    await popup.click(); await gone();
    await move.click(); await rotate.click(); await page.waitForTimeout(400);
    assert.equal(await popup.count(), 0, 'R is silenced');
    await page.locator('button[data-hotkey="scale"]:visible').first().click(); await popup.waitFor();
    assert.deepEqual(await caps(), ['Z']);
    await pressInView('z'); await gone();
    checks.push('Clicking [R] silences R; Resize still shows [Z]');

    // 5. Settings: position, size, flashing, and bringing keys back.
    await settings();
    const restoreSilenced = page.getByRole('button', { name: /Bring back silenced keys \(1\)/ }), restoreLearned = page.getByRole('button', { name: /Bring back learned keys \(1\)/ });
    await page.locator('select[aria-label="Shortcut reminders: Where"]').selectOption('bottom');
    await page.locator('select[aria-label="Shortcut reminders: Size"]').selectOption('large');
    await page.locator('select[aria-label="Shortcut reminders: Look"]').selectOption('flash');
    await page.locator('select[aria-label="Shortcut reminders: Stays for"]').selectOption('0');
    await snap(path.join(out, 'settings.png'));
    await restoreSilenced.click(); await restoreLearned.click();
    assert.equal(await page.getByRole('button', { name: /Bring back silenced keys \(0\)/ }).isDisabled(), true);
    await closeSettings();
    await rotate.click(); await popup.waitFor();
    const style = await popup.evaluate(element => ({ position: element.dataset.position, size: element.dataset.size, look: element.dataset.style, font: parseFloat(getComputedStyle(element).fontSize), box: element.getBoundingClientRect().toJSON() }));
    assert.deepEqual([style.position, style.size, style.look], ['bottom', 'large', 'flash']);
    assert.ok(style.font >= 28 && Math.abs(style.box.x + style.box.width / 2 - 640) < 20, JSON.stringify(style));
    await page.waitForTimeout(6000);
    assert.equal(await popup.count(), 1, '"Until used or clicked" keeps it up');
    await snap(path.join(out, 'keycap-bottom-large.png'));
    await pressInView('r'); await gone();
    await move.click(); await popup.waitFor();
    assert.deepEqual(await caps(), ['M'], 'learned M is back');
    await pressInView('m'); await gone();
    checks.push('Settings move it to the bottom middle, make it large and flashing, keep it until used, and bring back silenced and learned keys');

    // 6. A button with only a Ctrl+Alt+Space code shows that code; typing the code closes it and counts.
    const fitUses = () => page.evaluate(() => JSON.parse(localStorage.getItem('mdlxl-shredder-keycaps-v1')).keys.fit?.uses || 0);
    await page.locator('button[data-hotkey="fit"]:visible').first().click(); await popup.waitFor();
    const codeText = (await popup.textContent()).trim(), code = /^Ctrl \+ Alt \+ Space > ([A-Z0-9]{3})$/.exec(codeText)?.[1];
    assert.ok(code, 'the code is shown: ' + codeText);
    await page.locator('.classic-view canvas').first().hover();
    await page.keyboard.press('Control+Alt+Space'); for (const character of code) await page.keyboard.press(character);
    await gone();
    assert.equal(await fitUses(), 1);
    checks.push(`Fit, which has only a code, shows [${codeText}]; typing the code closes it and counts`);

    // 7. Citadel Paint's own keys: a click shows the key its button shows; Paint's key closes it.
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
    assert.equal(await popup.count(), 0, 'B is silenced');
    await page.locator('input[type="range"][aria-label="Opacity"]').click(); await popup.waitFor();
    assert.equal((await popup.textContent()).trim(), '− +');
    // The slider keeps focus after a click, and Paint leaves keys typed into its fields alone.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('-'); await gone();
    checks.push('Citadel Paint: Erase shows [E] and E closes it; clicking [B] silences it; the Opacity slider shows [− +] and − closes it');

    // 8. Turning the mode off stops it; the Settings menu command toggles it.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'shredder'));
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Erase', exact: true }).click(); await page.waitForTimeout(400);
    assert.equal(await popup.count(), 0, 'off');
    checks.push('Settings → Shortcut reminders turns the mode off');

    assert.deepEqual(errors, []);
    console.log(checks.map(check => '✓ ' + check).join('\n'));
  } finally {
    // Unsaved Paint work makes the window ask before closing; don't wait for it.
    await Promise.race([app.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 10000))]);
    // Kill the whole Electron process tree (renderer and GPU too), not just its main process.
    try { const pid = app.process().pid; if (process.platform === 'win32') require('node:child_process').spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']); else app.process().kill(); } catch {}
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
