// Packaged audit of the default keys the running app really hands out: opens every window with real clicks,
// reads the catalog each one registers, and fails on an overlap, a key over two presses, a reserved key
// or a default on a manual control. Then checks a rebind reaches tooltips, Show hotkeys and Learn live,
// that loading a preset does the same, and the second Esc on unapplied work.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp } = require('./helpers/app.cjs');

const CATALOG_KEY = 'mdlvis-classic-hotkeys-catalog-v1', NOTEBOOK_KEY = 'mdlxl-learn-keycaps-v1';
const SETTINGS_COMMANDS = ['settings', 'hotkeys', 'graphics', 'captureSettings', 'appearanceSettings', 'configurationSettings', 'gridSettings', 'gameDataSettings'];
const SETTINGS_TABS = ['configuration', 'mouse', 'hotkeys', 'graphics', 'capture', 'visuals', 'grid', 'gameData'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const out = path.resolve('out/hotkey-defaults-audit'); fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const { COMMANDS } = await import('../src/commands.js');
  const { contextualHotkeyDefaults } = await import('../src/hotkey-defaults.js');
  const { effectiveBindings, hotkeyConflicts } = await import('../src/preferences.js');
  const fixture = path.join(out, 'HotkeyAudit.mdx'); fs.writeFileSync(fixture, createDemoDocument().serialize('mdx'));
  const { app, page, errors } = await launchApp({ fixture, out, settings: { preferences: { language: 'en', learn: { enabled: false } } } });
  const visited = [], skipped = [], checks = [];
  const click = async locator => { await locator.first().waitFor({ state: 'visible', timeout: 8000 }); const box = await locator.first().boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await pause(250); };
  const control = id => page.locator(`[data-hotkey="${id}"]:visible`);
  const closeDialogs = async () => { for (let i = 0; i < 4 && await page.locator('[role="dialog"][aria-modal="true"]:visible').count(); i++) { await page.keyboard.press('Escape'); await pause(200); } };
  // Every state is reached the way the owner reaches it. A window this demo model cannot open is reported, not hidden.
  const visit = async (name, open) => {
    try { await open(); await pause(400); visited.push(name); }
    catch (error) { skipped.push(`${name}: ${error.message.split('\n')[0]}`); await page.screenshot({ path: path.join(out, `skipped-${skipped.length}.png`) }).catch(() => {}); }
    await closeDialogs();
  };
  try {
    await page.waitForFunction(() => document.querySelector('.model-tabs')?.textContent.includes('HotkeyAudit.mdx'));
    for (const mode of ['vertices', 'bones', 'animation', 'animations']) await visit(mode, () => click(control(mode)));
    await visit('uv', async () => { await click(control('vertices')); await page.keyboard.press('Control+a'); await click(control('uv')); await page.locator('.uv-workspace').waitFor(); await pause(400); await click(page.getByRole('button', { name: 'Exit UV Wrapper', exact: true })); await page.locator('.uv-workspace').waitFor({ state: 'detached' }); });
    await page.keyboard.press('Escape'); await visit('vertices again', () => click(control('vertices')));
    await visit('AnimXL', async () => { await click(control('animation')); await click(control('animXL')); await page.getByRole('dialog', { name: 'AnimXL', exact: true }).waitFor(); });
    await visit('Particle Editor', async () => { await click(control('particles')); await page.getByRole('dialog', { name: 'Particle Editor', exact: true }).waitFor(); });
    // Forge's Shape tab embeds the vertex editor, where Esc is Clear, so it closes from its own button.
    await visit('Forge', async () => { await click(control('forge')); const forge = page.getByRole('dialog', { name: 'Forge', exact: true }); await forge.waitFor(); await pause(400); await click(forge.getByRole('button', { name: 'Close Forge', exact: true })); await forge.waitFor({ state: 'detached' }); });
    await visit('Texture Library', async () => { await click(control('textureLibrary')); await page.locator('.tl-dialog').waitFor(); });
    await visit('BitsAndParts', async () => { await click(control('bitsAndParts')); await page.locator('.parts-dialog').waitFor(); });
    // The demo model has no skin to edit, so Paint starts from a new base coat.
    await visit('Paint', async () => { await click(control('paint')); await click(page.getByRole('button', { name: /New base coat/ })); await click(page.getByRole('button', { name: 'Begin painting', exact: true })); await page.locator('.paint-studio .studio-toolbar').waitFor(); });
    await visit('Paint shortcuts', async () => { await click(page.getByRole('button', { name: 'Help', exact: true })); await page.locator('.paint-shortcuts').waitFor(); });
    await visit('vertices after Paint', () => click(control('vertices')));
    await visit('Showcase', async () => { await click(page.getByRole('button', { name: 'Showcase', exact: true })); await page.locator('.showcase-sidebar').waitFor(); });
    await visit('vertices after Showcase', () => click(control('vertices')));
    for (const [name, chord] of [['Material Manager', 'Alt+m'], ['Texture Manager', 'Alt+t'], ['Node Manager', 'Alt+o'], ['Geoset Manager', 'Alt+g'], ['Sequence Manager', 'Alt+q'], ['Texture Animation', 'Alt+x'], ['Global Sequence', 'Alt+l'], ['Geoset Animation Manager', 'Alt+h']]) await visit(name, async () => { await page.keyboard.press(chord); await page.locator('[role="dialog"][aria-modal="true"]').first().waitFor({ timeout: 5000 }); });
    await visit('LER box', async () => { await click(page.locator('.learner-tool')); await page.locator('.learn-menu').waitFor(); await page.keyboard.press('Escape'); });
    for (const tab of SETTINGS_TABS) await visit(`Settings: ${tab}`, async () => { await page.keyboard.press('Control+k'); await click(page.locator(`#settings-tab-${tab}`)); await page.locator(`#settings-panel-${tab}`).waitFor(); });
    await pause(400);
    fs.writeFileSync(path.join(out, 'visited.json'), JSON.stringify({ visited, skipped }, null, 1));
    assert.ok(visited.length >= 24, `only ${visited.length} windows opened; skipped: ${skipped.join(' | ')}`);
    assert.ok(!skipped.some(entry => /^(vertices|AnimXL|Particle Editor|Forge|Texture Library|Paint|Showcase|Settings)\b/.test(entry)), skipped.join(' | '));
    checks.push(`Opened ${visited.length} windows and states`);

    // The merged catalog, as the app saved it.
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), CATALOG_KEY);
    assert.ok(stored.length > 300, `catalog has only ${stored.length} entries`);
    const rows = [...COMMANDS.map(action => ({ ...action, allowInModal: SETTINGS_COMMANDS.includes(action.id) })), ...stored.filter(row => !COMMANDS.some(action => action.id === row.id)).map(row => ({ ...row, contextual: true, defaultKeys: [] }))];
    const catalog = contextualHotkeyDefaults(rows, [], {}), bindings = effectiveBindings(catalog, {});
    const moved = catalog.filter(action => action.contextual && !action.bindingCommand && !action.keys && !action.manual && action.defaultKey !== (stored.find(row => row.id === action.id)?.defaultKey || ''));
    assert.deepEqual(moved.map(action => action.id), [], 'the allocator keeps what the app saved');
    const groups = new Map(); for (const action of catalog.filter(item => item.contextual && item.group)) (groups.get(action.group) || groups.set(action.group, []).get(action.group)).push(action);
    const overlaps = [], longKeys = [], reserved = [], manualKeys = [];
    for (const [group, actions] of groups) { const seen = new Map(); for (const action of actions) for (const key of bindings[action.id] || []) { if (seen.has(key)) overlaps.push(`${group}: ${key} is ${seen.get(key)} and ${action.id}`); else seen.set(key, action.id); } }
    for (const action of catalog) for (const key of bindings[action.id] || []) {
      if (key.replace(/\+Plus$/, '+P').split(/\+(?=.)/).length > 2 || key.includes('>')) longKeys.push(`${action.id}: ${key}`);
      if (hotkeyConflicts(catalog, {}, action.id, key).length) overlaps.push(`${action.id}: ${key} clashes with ${hotkeyConflicts(catalog, {}, action.id, key).join(', ')}`);
      if (['H', 'K', 'Ctrl+X', 'Ctrl+B'].includes(key) && (action.group === 'editor' || !action.contextual && action.scope === 'editor')) reserved.push(`${action.id}: ${key}`);
      if (action.manual) manualKeys.push(`${action.id}: ${key}`);
    }
    fs.writeFileSync(path.join(out, 'allocated.json'), JSON.stringify(catalog.map(action => ({ id: action.id, label: action.label, group: action.group, manual: !!action.manual, keys: bindings[action.id] })), null, 1));
    assert.deepEqual(overlaps, [], 'no overlap inside a window'); assert.deepEqual(longKeys, [], 'no key over two presses'); assert.deepEqual(reserved, [], 'reserved keys stay free'); assert.deepEqual(manualKeys, [], 'manual controls get no default');
    checks.push(`${catalog.length} catalog rows: no overlap, nothing over two keys, reserved keys free, manual controls without keys`);
    const live = await page.evaluate(() => [...document.querySelectorAll('[data-hotkey]')].map(element => element.getAttribute('data-hotkey-shortcuts') || '').filter(Boolean));
    for (const keys of live) for (const key of keys.split(' / ')) assert.ok(key.replace(/\+Plus$/, '+P').split(/\+(?=.)/).length <= 2, key);

    // A never-opened window can be bound: the manifest is in the table with the window closed.
    await page.keyboard.press('Control+k'); await click(page.locator('#settings-tab-hotkeys'));
    await page.locator('.hotkeys-table').waitFor();
    assert.equal(await page.locator('.hotkeys-table [title="sort-my-mess:apply"]').count(), 1, 'Sort My Mess was never opened and is still listed');
    assert.equal(await page.locator('.hotkeys-table [title="particles:add-ribbon"]').count(), 1);
    checks.push('A window never opened on this profile is listed and can be bound');

    // Rebind Fit with real keys: Learn forgets it, the tooltip and Show hotkeys follow at once.
    const notebook = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{"keys":{}}').keys, NOTEBOOK_KEY);
    const seed = () => page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, keys: { fit: { uses: 3, quietUntil: Date.now() + 1e7, silenced: true }, frame: { uses: 2, quietUntil: Date.now() + 1e7, silenced: false } } })), NOTEBOOK_KEY);
    const expectForgot = async how => { await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).keys.fit.quietUntil === 0, NOTEBOOK_KEY); const keys = await notebook(); assert.deepEqual([keys.fit.uses, keys.fit.silenced], [0, true], how); assert.ok(keys.frame.quietUntil > 0, `${how}: other keys stay`); };
    await seed();
    await page.getByLabel('Search Hotkeys', { exact: true }).fill('Fit model');
    const settingsWindow = page.getByRole('dialog', { name: 'Settings', exact: true });
    await click(settingsWindow.getByRole('button', { name: /^Assign shortcut to Fit model/ }));
    await settingsWindow.getByLabel('Press a key combination', { exact: true }).waitFor();
    await page.keyboard.press('Control+F9'); await click(settingsWindow.getByRole('button', { name: 'Assign shortcut', exact: true }));
    await expectForgot('manual rebind');
    await click(page.getByRole('button', { name: 'Close Settings', exact: true }));
    await page.waitForFunction(() => document.querySelector('[data-hotkey="fit"]')?.getAttribute('data-hotkey-shortcuts')?.includes('Ctrl+F9'));
    assert.match(await page.locator('[data-hotkey="fit"]').first().getAttribute('title'), /Ctrl\+F9/);
    checks.push('A rebind reaches the tooltip at once and forgets only that key in Learn, keeping its mute');

    // Choosing Default asks before it puts Fit back.
    await seed();
    await page.keyboard.press('Control+k'); await click(page.locator('#settings-tab-hotkeys'));
    const preset = settingsWindow.getByLabel('Hotkeys preset', { exact: true });
    for (let step = 0; step < 8 && !await preset.evaluate(el => document.activeElement === el); step++) await page.keyboard.press('Tab');
    assert.ok(await preset.evaluate(el => document.activeElement === el), 'Tab reaches the Hotkeys preset');
    await page.keyboard.press('ArrowDown');
    const confirm = settingsWindow.getByRole('button', { name: 'Restore all defaults', exact: true });
    await confirm.waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await preset.inputValue(), 'custom', 'Default waits for confirmation');
    const confirmBox = await confirm.boundingBox();
    await page.mouse.click(confirmBox.x + confirmBox.width / 2, confirmBox.y + confirmBox.height / 2);
    await expectForgot('preset load');
    await click(page.getByRole('button', { name: 'Close Settings', exact: true }));
    await page.waitForFunction(() => document.querySelector('[data-hotkey="fit"]')?.getAttribute('data-hotkey-shortcuts') === 'Home');
    assert.doesNotMatch(await page.locator('[data-hotkey="fit"]').first().getAttribute('title'), /Ctrl\+F9/);
    checks.push('A hotkeys preset reaches the tooltip at once and forgets the rebound key in Learn');

    // Esc on unapplied work asks first; nothing unapplied closes at once.
    await click(control('animation')); await click(control('animXL'));
    const anim = page.getByRole('dialog', { name: 'AnimXL', exact: true }); await anim.waitFor();
    await page.keyboard.press('Escape'); await anim.waitFor({ state: 'detached' });
    await click(control('animXL')); await anim.waitFor();
    await click(anim.getByRole('button', { name: 'Heavy', exact: true }));
    await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label="AnimXL"]')?.hasAttribute('data-hotkey-unapplied'));
    await page.keyboard.press('Escape');
    assert.match(await page.locator('.hotkeys-discard-cue').innerText(), /Press Esc again to discard/);
    assert.equal(await anim.count(), 1, 'the first Esc keeps the work');
    await page.keyboard.press('Escape'); await anim.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.hotkeys-discard-cue').count(), 0);
    checks.push('AnimXL: one Esc with nothing unapplied, two with unapplied work');
    assert.deepEqual(errors, []);
    console.log(`PASS hotkey defaults audit\n- ${checks.join('\n- ')}${skipped.length ? `\nCould not open with this model: ${skipped.join(' | ')}` : ''}`);
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
