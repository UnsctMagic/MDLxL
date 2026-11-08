// Graphic, Trim and Hidden and the command launcher, through real clicks, keys and drags on the hidden desktop.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { launchApp, closeApp, clickMenu, settle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const THEMES = require('../src/application-themes.json');

const OUT = path.resolve('out/toolbar-modes');
const LIGHT_DARK = ['light', 'dark'];
const CONTEXT_KEYS = { 'ai:open': ['Alt+J'], teamColor: ['Alt+Y'], 'display:bones': ['Alt+B'] };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { app, page, errors } = await launchApp({
    out: OUT, fixture: fixturePath('citadel-footman'), env: { MDLVIS_HEADLESS: '' }, bounds: { x: -3000, y: 0, width: 1500, height: 900 },
    settings: { preferences: { language: 'en', theme: 'light', modelLookAnswered: true, updateOfferAnswered: true, disableSounds: true, wheelMode: 'rotate', hotkeys: CONTEXT_KEYS } },
  });
  const passed = [], check = name => passed.push(name);
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
  const setPrefs = patch => app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('settings:preferences', value), patch);
  const toolbarMode = () => page.evaluate(() => document.querySelector('.classic-app').dataset.toolbar || 'graphic');
  const waitMode = mode => page.waitForFunction(value => (document.querySelector('.classic-app').dataset.toolbar || 'graphic') === value, mode);
  const setTheme = async id => { await setPrefs({ theme: id }); await page.waitForFunction(value => document.documentElement.style.getPropertyValue('--ui-panel').trim() === value, THEMES[id].colors.panel); await settle(page, 80); };
  const setWidth = async width => {
    await app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].setBounds({ x: -3000, y: 0, width: value, height: 900 }), width);
    await page.waitForFunction(value => Math.abs(innerWidth - value) < 40, width); await settle(page, 200);
  };
  // A real click on the empty part of the status row: keys then reach the editor, not a field.
  const focusEditor = async () => { const box = await page.locator('.classic-status').boundingBox(); await page.mouse.click(box.x + box.width * .55, box.y + box.height / 2); };
  const rects = () => page.evaluate(() => {
    const rect = selector => { const element = document.querySelector(selector), box = element.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
    return { width: innerWidth, toolbar: rect('.classic-toolbar'), modules: rect('.classic-modules'), primary: rect('.toolbar-primary'), dock: rect('.toolbar-modules'), view: rect('.classic-view') };
  });
  const nativeToolbar = () => app.evaluate(({ Menu }) => {
    const row = Menu.getApplicationMenu().items.find(item => item.label === 'Settings').submenu.items.find(item => item.label === 'Toolbar');
    return { enabled: row.enabled, checked: row.submenu.items.find(item => item.checked)?.label };
  });
  const waitNative = async expected => { const end = Date.now() + 5000; let last; do { last = await nativeToolbar(); if (last.checked === expected.checked && last.enabled === expected.enabled) return; await settle(page, 60); } while (Date.now() < end); assert.deepEqual(last, expected); };
  const viewport = page.getByLabel('3D model viewport', { exact: true });
  const orbitChanges = async () => {
    const box = await viewport.boundingBox(), before = await viewport.screenshot();
    const start = [box.x + box.width * .5, box.y + box.height * .5];
    await page.keyboard.down('Alt');
    await page.mouse.move(...start); await page.mouse.down(); await page.mouse.move(start[0] + 120, start[1] + 30, { steps: 12 }); await page.mouse.up();
    await page.keyboard.up('Alt'); await settle(page, 200);
    return !(await viewport.screenshot()).equals(before);
  };
  const launcher = page.locator('.command-launcher'), search = page.getByPlaceholder('Search commands', { exact: true });
  const options = launcher.getByRole('option');
  const openLauncher = async () => { await focusEditor(); await page.keyboard.press('Control+F2'); await search.waitFor(); };
  const selectedText = () => launcher.locator('[aria-selected="true"]').innerText();
  const editorChip = page.locator('.toolbar-hidden-editor'), inputChip = page.locator('.toolbar-hidden-input'), formatChip = page.locator('.toolbar-hidden-status>button');
  const modelVersion = () => page.evaluate(() => window.__mdlxl.document().model.Version);

  try {
    // The console only needs to accept a draft: local stand-ins, never an external AI.
    await app.evaluate(({ ipcMain }) => {
      const status = { provider: 'compatible', model: 'fixture', baseUrl: 'http://127.0.0.1', hasKey: true, enabled: false, running: [], sdBrainAvailable: true };
      const handle = (channel, run) => { ipcMain.removeHandler(channel); ipcMain.handle(channel, run); };
      handle('ai:status', (_, provider) => ({ ...status, provider: provider || status.provider }));
      handle('ai:models', () => [{ id: 'fixture', name: 'Fixture' }]);
      handle('ai:auth', () => ({ loggedIn: true }));
    });
    await page.reload();
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({ timeout: 60000 });
    await page.locator('.toolbar-modules').waitFor();
    await settle(page, 400);

    // Graphic is the default and stays exactly what it was.
    assert.equal(await page.locator('.classic-app').getAttribute('data-toolbar'), null);
    const graphic = await rects();
    assert.equal(Math.round(graphic.toolbar.height), 56); assert.equal(Math.round(graphic.modules.height), 39);
    const graphicHtml = () => page.evaluate(() => document.querySelector('.classic-toolbar').outerHTML + document.querySelector('.classic-modules').outerHTML);
    const before = await graphicHtml();
    const dockNames = () => page.locator('.toolbar-modules>button').evaluateAll(buttons => buttons.map(button => [button.getAttribute('aria-label'), button.getAttribute('title')]));
    const namesBefore = await dockNames();
    await setPrefs({ toolbarMode: 'trim' }); await waitMode('trim');
    await setPrefs({ toolbarMode: 'hidden', toolbarHiddenNoted: true }); await waitMode('hidden');
    await setPrefs({ toolbarMode: 'graphic', toolbarHiddenNoted: false }); await waitMode('graphic');
    await settle(page, 200);
    assert.equal(await graphicHtml(), before, 'Graphic DOM is byte-identical after visiting the other modes');
    check('Graphic is the default: no attribute, 56 + 39 px, DOM unchanged after a round trip');

    // Trim: two slim rows at every width and in every theme.
    await setPrefs({ toolbarMode: 'trim' }); await waitMode('trim');
    assert.deepEqual(await dockNames(), namesBefore, 'Trim keeps every dock control, name and tooltip');
    for (const width of [720, 1100, 1920]) {
      await setWidth(width);
      const trim = await rects();
      assert.equal(Math.round(trim.toolbar.height), 32, 'top row');
      assert.equal(Math.round(trim.modules.height), 30, 'editor row');
      assert.ok(trim.primary.right <= trim.dock.x + 1, `${width}: model controls stay clear of the dock`);
      assert.ok(trim.dock.right <= trim.width + 1, `${width}: dock stays on screen`);
      assert.equal(await page.locator('.toolbar-primary').evaluate(element => element.scrollWidth - element.clientWidth <= 1), true, `${width}: top row has nothing to scroll`);
      const heights = await page.locator('.toolbar-modules>button,.editor-modules>button,.quick-display-options>label,.toolbar-model>button').evaluateAll(items => [...new Set(items.map(item => Math.round(item.getBoundingClientRect().height)))]);
      assert.deepEqual(heights, [26], `${width}: one control height`);
      assert.ok(await page.locator('.toolbar-modules>button>img').evaluateAll(images => images.every(image => getComputedStyle(image).display === 'none')), 'no pictures');
      await page.screenshot({ path: path.join(OUT, `trim-${width}.png`), clip: { x: 0, y: 0, width: Math.min(width, 1920), height: 120 } });
    }
    check('Trim is 32 + 30 px, nothing overlaps or scrolls in the top row at 720, 1100 and 1920');
    await setWidth(1500);

    const contrastAt = selector => page.locator(selector).first().evaluate(element => {
      const parse = value => {
        const modern = value.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/);
        if (modern) return [modern[1] * 255, modern[2] * 255, modern[3] * 255, modern[4] === undefined ? 1 : +modern[4]];
        if (!/^rgba?\(/.test(value)) throw Error('unreadable colour: ' + value);
        const numbers = value.match(/[\d.]+/g).map(Number);
        return [numbers[0], numbers[1], numbers[2], numbers[3] === undefined ? 1 : numbers[3]];
      };
      const layers = [];
      for (let node = element; node; node = node.parentElement) { const color = parse(getComputedStyle(node).backgroundColor); if (color[3] > 0) { layers.push(color); if (color[3] === 1) break; } }
      const background = layers.reverse().reduce((under, [r, g, b, a]) => [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)], [255, 255, 255]);
      const luminance = rgb => rgb.reduce((sum, value, index) => { const c = value / 255; return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index]; }, 0);
      // A translucent label is measured as drawn, over its own background.
      const [r, g, b, alpha] = parse(getComputedStyle(element).color), text = [r, g, b].map((value, index) => value * alpha + background[index] * (1 - alpha));
      const [high, low] = [luminance(text), luminance(background)].sort((a, b) => b - a);
      return (high + .05) / (low + .05);
    });
    const contrast = {};
    for (const id of Object.keys(THEMES)) {
      await setTheme(id);
      const seen = { editor: await contrastAt('.editor-modules>button[aria-pressed=false]'), activeEditor: await contrastAt('.editor-modules>button[aria-pressed=true]'), dock: await contrastAt('.toolbar-modules>button:not(:disabled)>:is(.module-icon-badge,span:not(.hotkey-badge))'), display: await contrastAt('.quick-display-options>label'), readout: await contrastAt('.compact-input-strength>span') };
      for (const [name, value] of Object.entries(seen)) assert.ok(value >= 4.5, `${id} ${name}: ${value.toFixed(2)}`);
      contrast[id] = Object.fromEntries(Object.entries(seen).map(([name, value]) => [name, +value.toFixed(2)]));
      await page.screenshot({ path: path.join(OUT, `trim-theme-${id}.png`), clip: { x: 0, y: 0, width: 1500, height: 110 } });
    }
    fs.writeFileSync(path.join(OUT, 'contrast.json'), JSON.stringify(contrast, null, 2));
    check('Trim labels measure at least 4.5:1 as rendered in every theme');

    for (const id of LIGHT_DARK) { await setTheme(id); await shot(`trim-${id}`); }
    assert.ok(await orbitChanges(), 'Alt+drag orbits in Trim');
    check('Trim: real Alt+drag camera orbit');
    await setTheme('light');

    // Hidden, chosen from the native menu like a user would.
    await clickMenu(app, 'Graphic'); await waitMode('graphic');
    const shown = await rects();
    await clickMenu(app, 'Hidden'); await waitMode('hidden');
    await waitNative({ enabled: true, checked: 'Hidden' });
    const note = page.locator('.warning-toast', { hasText: 'Toolbar hidden. Settings > Toolbar or Shift+F3 brings it back.' });
    await note.waitFor();
    assert.doesNotMatch(await note.innerText(), /Error/);
    const hiddenRects = await rects();
    assert.ok(hiddenRects.view.y < shown.view.y - 80, 'the editor takes the freed space');
    const bars = await page.evaluate(() => [...document.querySelectorAll('.classic-toolbar,.classic-modules')].map(element => ({ right: element.getBoundingClientRect().right, display: getComputedStyle(element).display, boxes: element.getClientRects().length })));
    assert.ok(bars.every(bar => bar.right < 0 && bar.display !== 'none' && bar.boxes > 0), JSON.stringify(bars));
    for (const id of LIGHT_DARK) { await setTheme(id); await shot(`hidden-${id}`); }
    await setTheme('light');
    await note.locator('button').first().click();
    await note.waitFor({ state: 'detached' });
    await clickMenu(app, 'Trim'); await waitMode('trim');
    await clickMenu(app, 'Hidden'); await waitMode('hidden');
    await settle(page, 500);
    assert.equal(await note.count(), 0, 'the note shows once');
    check('Hidden: off-screen but laid out, editor grows, native radio follows, note appears once');

    // What the status row keeps of the toolbar.
    assert.match(await formatChip.innerText(), /^MDX\d+ ⇄$/);
    assert.equal(await editorChip.innerText(), 'Vertices');
    assert.equal(await inputChip.count(), 0, 'DPI and Scroll are not shown at rest');
    await focusEditor();
    await page.keyboard.press('Equal'); await inputChip.waitFor();
    assert.match(await inputChip.innerText(), /^Scroll /);
    await inputChip.waitFor({ state: 'detached', timeout: 5000 });
    await page.keyboard.press('Alt+Equal'); await inputChip.waitFor();
    assert.match(await inputChip.innerText(), /^DPI /);
    await inputChip.waitFor({ state: 'detached', timeout: 5000 });
    const version = await modelVersion();
    await formatChip.click();
    await page.waitForFunction(value => window.__mdlxl.document().model.Version !== value, version);
    await focusEditor(); await page.keyboard.press('Control+z');
    await page.waitForFunction(value => window.__mdlxl.document().model.Version === value, version);
    check('Status row: format chip converts, editor name shows, DPI and Scroll only while they change');

    // Contextual keys still fire on the off-screen controls.
    const bones = page.locator('input[data-hotkey="display:bones"]'), bonesWas = await bones.isChecked();
    await focusEditor(); await page.keyboard.press('Alt+b');
    await page.waitForFunction(([was]) => document.querySelector('[data-hotkey="display:bones"]').checked !== was, [bonesWas]);
    await page.keyboard.press('Alt+b');
    check('Hidden: a contextual Quick Display key still toggles');

    await page.keyboard.press('Alt+y');
    await search.waitFor();
    assert.equal(await search.inputValue(), 'Team color');
    assert.ok(await options.count() >= 12, 'team colours are listed');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('placeholder')), 'Search commands', 'the hidden select does not keep the keyboard');
    await search.fill('team blue');
    await page.keyboard.press('Enter');
    await launcher.waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-hotkey="teamColor"]').inputValue(), '#0042ff');
    check('Hidden: the team colour key searches colours, Enter applies one');

    // The AI console and its draft survive every mode.
    await focusEditor(); await page.keyboard.press('Alt+j');
    const ai = page.locator('.ai-assistant'), prompt = ai.locator('textarea').first();
    await prompt.waitFor();
    await prompt.fill('keep this draft');
    await focusEditor();
    const order = ['graphic', 'trim', 'hidden'];
    for (const next of order) { await page.keyboard.press('Shift+F3'); await waitMode(next); assert.equal(await prompt.inputValue(), 'keep this draft', next); }
    await waitNative({ enabled: true, checked: 'Hidden' });
    check('Shift+F3 cycles every mode; the AI console and its draft survive');
    await focusEditor(); await page.keyboard.press('Alt+j'); await ai.waitFor({ state: 'detached' });

    assert.ok(await orbitChanges(), 'Alt+drag orbits in Hidden');
    check('Hidden: real Alt+drag camera orbit');

    // Launcher: opens on demand, closes four ways, draws nothing otherwise.
    assert.equal(await launcher.count(), 0);
    await openLauncher();
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('placeholder')), 'Search commands');
    for (const id of LIGHT_DARK) { await setTheme(id); await shot(`launcher-${id}`); }
    await setTheme('light');
    await page.keyboard.press('Escape'); await launcher.waitFor({ state: 'detached' });
    await openLauncher(); await page.keyboard.press('Control+F2'); await launcher.waitFor({ state: 'detached' });
    await openLauncher();
    await focusEditor();
    await launcher.waitFor({ state: 'detached' });
    await clickMenu(app, 'Search commands…'); await search.waitFor();
    await page.keyboard.press('Escape'); await launcher.waitFor({ state: 'detached' });

    await openLauncher();
    const first = await selectedText(), count = await options.count();
    assert.match(first, /Vertex editor/); assert.match(first, /F1/);
    await page.keyboard.press('ArrowDown');
    assert.match(await selectedText(), /Bones/);
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    assert.equal(await launcher.locator('[aria-selected="true"]').getAttribute('id'), `command-launcher-${count - 1}`, 'up wraps to the end');
    await page.keyboard.press('ArrowDown');
    await search.fill('movement editor');
    await page.keyboard.press('Enter');
    await launcher.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelector('.toolbar-hidden-editor')?.textContent === 'Movement');
    await focusEditor(); await page.keyboard.press('F1');
    await page.waitForFunction(() => document.querySelector('.toolbar-hidden-editor')?.textContent === 'Vertices');
    check('Launcher: Esc, its own key, outside click, menu; arrows wrap; Enter runs and closes');

    await setPrefs({ hotkeys: { ...CONTEXT_KEYS, vertices: ['Ctrl+F9'] } });
    await openLauncher();
    assert.match(await options.first().innerText(), /Ctrl\+F9/, 'rows show the current binding');
    await page.keyboard.press('Escape'); await launcher.waitFor({ state: 'detached' });
    await setPrefs({ hotkeys: CONTEXT_KEYS });
    await openLauncher(); await search.fill('uv editor');
    assert.equal(await options.count(), 0, 'nothing selected: the UV editor cannot run, so it is not offered');
    await page.keyboard.press('Escape'); await launcher.waitFor({ state: 'detached' });
    await focusEditor(); await page.keyboard.press('Control+a');
    await openLauncher(); await search.fill('uv editor');
    assert.equal(await options.count(), 1);
    await page.keyboard.press('Escape'); await launcher.waitFor({ state: 'detached' });
    check('Launcher: shows current keys and only what can run');

    const runRow = async text => { await openLauncher(); await search.fill(text); await page.keyboard.press('Enter'); await launcher.waitFor({ state: 'detached' }); };
    const smooth = page.locator('.smooth-edges-toggle'), smoothWas = await smooth.getAttribute('aria-pressed');
    await runRow('smooth edges');
    await page.waitForFunction(was => document.querySelector('.smooth-edges-toggle').getAttribute('aria-pressed') !== was, smoothWas);
    await runRow('language deutsch');
    await page.waitForFunction(() => document.documentElement.lang === 'de');
    await clickMenu(app, 'English');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await runRow('toolbar graphic'); await waitMode('graphic');
    await runRow('toolbar hidden'); await waitMode('hidden');
    check('Launcher: extra rows change Smooth edges, Language and Toolbar');

    // Every control that only had a toolbar button now has a menu route.
    const closes = async (label, name) => {
      await clickMenu(app, label);
      const dialog = page.getByRole('dialog', { name, exact: true }); await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Close ' + name, exact: true }).first().click();
      await dialog.waitFor({ state: 'detached' });
    };
    await closes('Forge…', 'Forge');
    await clickMenu(app, 'BitsAndParts…');
    { const dialog = page.getByRole('dialog', { name: 'BitsAndParts', exact: true }); await dialog.waitFor(); await dialog.getByRole('button', { name: /^Close/ }).first().click(); await dialog.waitFor({ state: 'detached' }); }
    await closes('Auto Corpse…', 'Auto Corpse');
    { // Closed the way the window's X closes it: the app is told through beforeunload, which page.close() would skip.
      const opened = app.waitForEvent('window', { timeout: 30000 }); await clickMenu(app, 'OptimizeXL…'); const child = await opened, gone = child.waitForEvent('close');
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().sort((a, b) => b.id - a.id)[0].close()); await gone;
      // Closed the moment it opened: the editor survives, and the next menu command (AI console) runs at once.
      await settle(page, 800);
      assert.equal(await page.getByText('The interface could not finish drawing.', { exact: true }).count(), 0, 'a window closed while opening does not crash the editor'); }
    await clickMenu(app, 'AI console'); await ai.waitFor(); await clickMenu(app, 'AI console'); await ai.waitFor({ state: 'detached' });
    const version2 = await modelVersion();
    await clickMenu(app, 'Convert MDX800 / MDX1000');
    await page.waitForFunction(value => window.__mdlxl.document().model.Version !== value, version2);
    await focusEditor(); await page.keyboard.press('Control+z');
    await page.waitForFunction(value => window.__mdlxl.document().model.Version === value, version2);
    for (const [label, editor] of [['Citadel Paint', 'Citadel Paint'], ['Managers', 'Managers'], ['Showcase', 'Showcase']]) {
      await clickMenu(app, label);
      await page.waitForFunction(value => document.querySelector('.toolbar-hidden-editor')?.textContent === value, editor, { timeout: 45000 });
      await page.keyboard.press('Shift+F3'); await waitMode('graphic');
      await page.keyboard.press('Shift+F3'); await waitMode('trim');
      await page.keyboard.press('Shift+F3'); await waitMode('hidden');
      await page.keyboard.press('F1');
      await page.waitForFunction(() => document.querySelector('.toolbar-hidden-editor')?.textContent === 'Vertices');
    }
    await clickMenu(app, 'Show hotkeys');
    await page.waitForFunction(() => document.documentElement.dataset.shortcutHints === 'true');
    await clickMenu(app, 'Show hotkeys');
    await page.waitForFunction(() => document.documentElement.dataset.shortcutHints !== 'true');
    await clickMenu(app, 'Learn settings…');
    { const settings = page.getByRole('dialog', { name: 'Settings', exact: true }); await settings.waitFor(); await settings.getByRole('button', { name: 'Close Settings', exact: true }).click(); await settings.waitFor({ state: 'detached' }); }
    await clickMenu(app, 'Deutsch');
    await page.waitForFunction(() => document.documentElement.lang === 'de');
    await clickMenu(app, 'English');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    check('Every route: Forge, BitsAndParts, Auto Corpse, OptimizeXL, AI, Convert, Paint, Managers, Showcase, Show hotkeys, Learn settings, Language');

    // VIS ignores the setting and keeps its own chrome.
    await clickMenu(app, 'VIS look');
    await page.locator('.classic-app[data-vis-ui]').waitFor();
    await waitNative({ enabled: false, checked: 'Hidden' });
    assert.ok((await rects()).toolbar.right > 0, 'VIS keeps its toolbar on screen');
    assert.equal(await page.locator('.toolbar-hidden-status').count(), 0);
    await focusEditor(); await page.keyboard.press('Shift+F3'); await settle(page, 200);
    assert.equal(await toolbarMode(), 'hidden', 'the cycle does nothing while VIS is on');
    await openLauncher();
    await search.fill('toolbar');
    assert.equal(await options.filter({ hasText: /^Toolbar:/ }).count(), 0, 'no choice that cannot apply');
    await page.keyboard.press('Escape'); await launcher.waitFor({ state: 'detached' });
    await clickMenu(app, 'VIS look');
    await page.locator('.classic-app:not([data-vis-ui])').waitFor();
    assert.ok((await rects()).toolbar.right < 0, 'leaving VIS brings Hidden back');
    check('VIS ignores Hidden and Trim: toolbar on screen, cycle and choices off');

    // Back to a normal toolbar through the menu.
    await clickMenu(app, 'Graphic'); await waitMode('graphic');
    await waitNative({ enabled: true, checked: 'Graphic' });
    assert.ok((await rects()).toolbar.x >= 0);
    await shot('graphic-restored');
    check('Back to Graphic from the menu');

    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ passed, contrast }, null, 2));
    console.log(`toolbar-modes: ${passed.length} groups passed\n- ${passed.join('\n- ')}`);
  } catch (error) {
    await shot('failure').catch(() => {});
    throw error;
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exit(1); });
