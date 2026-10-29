const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');

// Real packaged UI/input; provider calls are local fixtures, never an external AI.
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'ai-hotkeys');
  await fs.mkdir(out, { recursive: true });
  // Learn mode ships off; this test checks its reminders, so it turns it on.
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'shortcuts.mdx');
  await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const { app, page, errors } = await launchApp({ fixture, out, env: { MDLVIS_HEADLESS: '' }, settings: { preferences: { learn: { enabled: true } } }, bounds: { x: -3000, y: 0, width: 1440, height: 1000 } });
  const rows = [];
  try {
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      const win = BrowserWindow.getAllWindows()[0]; win.setSize(1440, 1000);
      let settings = { provider: 'compatible', model: 'fixture', baseUrl: 'http://127.0.0.1', hasKey: true, enabled: false, running: [], sdBrainAvailable: true };
      global.__aiShortcutCalls = {};
      const handle = (channel, fn) => { ipcMain.removeHandler(channel); ipcMain.handle(channel, (_, value) => { global.__aiShortcutCalls[channel] = (global.__aiShortcutCalls[channel] || 0) + 1; return fn(value); }); };
      handle('ai:status', provider => ({ ...settings, provider: provider || settings.provider }));
      handle('ai:configure', value => (settings = { ...settings, ...value }));
      handle('ai:models', () => [{ id: 'fixture', name: 'Fixture' }]);
      handle('ai:auth', () => ({ loggedIn: true }));
      handle('ai:send', () => ({ ok: true }));
      handle('ai:enable', enabled => ({ enabled }));
      handle('ai:config', () => ({ fixture: 'connection' }));
      handle('ai:saveState', () => ({ activity: true, remember: 'ask' }));
    });
    await page.reload(); await page.locator('.classic-view canvas').first().waitFor();
    await page.evaluate(() => {
      window.__used = [];
      window.addEventListener('mdlxl-hotkey-used', event => window.__used.push(event.detail.id));
      Object.defineProperty(navigator.clipboard, 'writeText', { value: async value => { window.__copied = value; } });
    });
    const ai = page.locator('.ai-assistant'), popup = page.locator('.learn-keycap');
    const key = async locator => { await locator.waitFor(); const value = await locator.getAttribute('data-hotkey-shortcuts'); assert.ok(value, 'shortcut missing'); return value.split(' / ')[0].replace('Ctrl+', 'Control+'); };
    const run = async locator => { const chord = await key(locator); await ai.focus(); await page.keyboard.press(chord); return chord; };
    const local = id => ai.locator(`[data-hotkey="${id}"]`);
    const audit = async place => {
      await settle(page, 150);
      const found = await ai.locator('button, select, input:not([hidden]), textarea, summary').evaluateAll(elements => elements.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => ({
        id: e.dataset.hotkey || '', label: e.dataset.hotkeyLabel || e.getAttribute('aria-label') || e.textContent.trim(), keys: e.dataset.hotkeyShortcuts || '', tag: e.tagName,
      })));
      const used = new Set();
      for (const row of found) {
        assert.ok(row.id && row.keys, `${place}: missing shortcut for ${row.label}`);
        for (const chord of row.keys.split(' / ')) {
          assert.ok(!chord.includes('>') && chord.split('+').length <= 2, `${row.id}: ${chord}`);
          assert.ok(!used.has(chord), `${place}: duplicate ${chord}`); used.add(chord);
          if (chord !== 'Escape') assert.ok(row.label.toUpperCase().includes(chord.split('+').at(-1)), `${row.id}: ${chord} is not from ${row.label}`);
        }
      }
      rows.push(...found.map(row => ({ place, ...row })));
      assert.equal(await ai.locator('[data-hotkey-badge]').count(), 0, 'console remains compact');
    };
    const open = page.locator('[data-hotkey="ai:open"]');
    await page.keyboard.press(await key(open)); await ai.waitFor();
    await audit('AI console');
    const width = await ai.evaluate(e => e.getBoundingClientRect().width);
    assert.equal(width, 400);
    await local('tool:marker').click();
    assert.equal(await popup.count(), 0, 'contextual console keys are not Learn command reminders');
    const markerKey = await key(local('tool:marker'));
    await page.keyboard.press(markerKey); await popup.waitFor({ state: 'detached' });
    assert.equal(await local('tool:marker').getAttribute('aria-pressed'), 'false');
    assert.equal((await page.evaluate(() => window.__used)).at(-1), 'ai:tool:marker');
    await page.locator('button[data-hotkey="translate"]:visible').first().click();
    await popup.waitFor();
    const moveKey = await key(page.locator('button[data-hotkey="translate"]:visible').first());
    assert.equal((await popup.textContent()).trim(), moveKey.replace('Control+', 'Ctrl + ').replace('Shift+', 'Shift + '));
    await page.keyboard.press('m'); await popup.waitFor({ state: 'detached' });
    assert.equal((await page.evaluate(() => window.__used)).at(-1), 'translate', 'editor M remains editor M beside the console');
    await run(local('prompt')); await page.keyboard.type('mrz hello');
    assert.equal(await local('prompt').inputValue(), 'mrz hello');
    assert.equal((await page.evaluate(() => window.__used)).at(-1), 'ai:prompt', 'typing does not run shortcuts');
    assert.equal(await local('prompt').evaluate(element => ['c', 'v'].every(key => element.dispatchEvent(new KeyboardEvent('keydown', { key, code: 'Key' + key.toUpperCase(), ctrlKey: true, bubbles: true, cancelable: true })))), true, 'native prompt copy/paste remains unconsumed');
    await run(local('connection')); await local('provider').waitFor();
    await run(local('external:expand'));
    await audit('AI API settings');
    await run(local('external'));
    await page.waitForFunction(() => !document.querySelector('.ai-assistant [data-hotkey="copy-connection"]').disabled);
    await run(local('copy-connection'));
    await page.waitForFunction(() => window.__copied?.includes('connection'));
    await run(local('load-models'));
    assert.ok(await app.evaluate(() => global.__aiShortcutCalls['ai:models'] > 0));
    await local('provider').selectOption('codex'); await local('advanced:expand').waitFor(); await run(local('advanced:expand'));
    await audit('AI native settings');
    await run(local('connection')); await local('provider').waitFor({ state: 'detached' });
    const chooser = page.waitForEvent('filechooser'); await run(local('attach')); await (await chooser).setFiles(fixture);
    const reference = local('reference:0'); await reference.waitFor();
    await audit('AI reference'); await run(reference); await reference.waitFor({ state: 'detached' });
    // Enter keeps its existing send behavior; the named Send shortcut uses that same handler.
    await local('prompt').fill('fixture message'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.ai-user-text')?.textContent === 'fixture message');
    await local('prompt').fill('shortcut message'); await run(local('send'));
    await page.waitForFunction(() => document.querySelector('.ai-assistant [data-hotkey="prompt"]')?.value === '');
    assert.equal(await app.evaluate(() => global.__aiShortcutCalls['ai:send']), 2);
    await page.evaluate(fixture => window.dispatchEvent(new CustomEvent('mdlxl-model-saved', { detail: { documentId: 'fixture', path: fixture, previousPath: fixture, name: 'shortcuts.mdx' } })), fixture);
    const cleanup = page.getByRole('dialog', { name: 'Tidy up AI chats', exact: true }); await cleanup.waitFor();
    await page.keyboard.press('Escape'); await cleanup.waitFor({ state: 'detached' });
    await page.locator('[data-hotkey="paint"]').first().click();
    await page.getByRole('button', { name: /New base coat/ }).click();
    await page.getByRole('button', { name: 'Begin painting', exact: true }).click();
    await run(local('tool:marker'));
    await page.waitForFunction(() => document.querySelector('.ai-assistant [data-hotkey="tool:marker"]')?.getAttribute('aria-pressed') === 'true' && document.querySelector('[data-hotkey="vertices"]')?.getAttribute('aria-pressed') === 'true');
    assert.equal((await page.evaluate(() => window.__used)).at(-1), 'ai:tool:marker', 'Paint does not consume console keys');
    await run(local('color')); await audit('AI palette');
    const color = ai.locator('[data-hotkey^="color:"]').first();
    const colorName = await color.getAttribute('aria-label'); await run(color);
    assert.equal(await local('color').getAttribute('aria-label'), 'Color: ' + colorName);
    // A modal must own its keys even when focus is still in the AI console.
    await ai.focus(); await page.keyboard.press('Control+Comma'); await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
    await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor({ state: 'detached' });
    await ai.focus(); await page.keyboard.press('Escape'); await ai.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    console.log('PASS: AI keys from names; local/editor/modal isolation; compact layout; Learn; prompt typing/copy/paste; settings/copy; reference attach/remove; Enter and named Send; cleanup and Esc.');
  } catch (error) {
    console.log('AI calls:', await app.evaluate(() => global.__aiShortcutCalls));
    console.log('UI:', await (await app.firstWindow()).evaluate(() => ({ used: window.__used, error: document.querySelector('.ai-error')?.textContent, focus: document.activeElement?.outerHTML.slice(0, 400) })));
    throw error;
  } finally {
    await fs.writeFile(path.join(out, 'inventory.json'), JSON.stringify(rows, null, 2));
    await closeApp(app);
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
