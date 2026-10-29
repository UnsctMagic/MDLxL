const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Run after building: node test/light-dark-shortcut.electron.cjs
// Presses the real Shift+F1 / Shift+F2 keys and checks the interface, the
// saved preferences and the Keyboard Shortcuts list. MDLXL_TEST_EXE runs a package.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const root = process.cwd(), out = path.join(root, 'out/light-dark-shortcut');
  fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile-' + Date.now()); fs.mkdirSync(profile);
  // Start from a customized Durotar: the switch must bring that exact look back.
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { rendererRevision: 3, theme: 'gruvbox-dark', accent: '#123456', viewportPreset: 'custom' } }));
  const launch = () => launchApp({ out: path.dirname(profile), profile: profile, env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: path.join(root, 'test/fixtures/demo.mdx') }).then(({ app }) => app);
  const errors = [];
  const open = async app => {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.setPosition(-3000, 0); w.showInactive(); });
    await page.locator('.classic-app').waitFor(); await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    return page;
  };
  const look = page => page.evaluate(() => ({ scheme: document.documentElement.dataset.theme, panel: getComputedStyle(document.documentElement).getPropertyValue('--ui-panel').trim(), accent: getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim(), status: document.querySelector('.classic-status [role=status], .classic-status span')?.textContent || '' }));
  const press = async (page, key) => { await page.locator('canvas').first().hover(); await page.keyboard.press(key); await settlePage(page, 250); return look(page); };
  let app = await launch();
  try {
    let page = await open(app);
    const start = await look(page);
    assert.deepEqual([start.scheme, start.panel, start.accent], ['dark', '#282828', '#123456']);
    const same = await press(page, 'Shift+F1');
    assert.deepEqual([same.scheme, same.panel, same.accent], [start.scheme, start.panel, start.accent], 'Shift+F1 on a dark look changes nothing');
    assert.match(same.status, /Already using a dark look/);
    const light = await press(page, 'Shift+F2');
    assert.equal(light.scheme, 'light'); assert.equal(light.panel, '#eee8d5', 'Durotar → Silvermoon');
    assert.match(light.status, /Silvermoon loaded/);
    await page.screenshot({ path: path.join(out, 'light.png') });
    const back = await press(page, 'Shift+F1');
    assert.deepEqual([back.scheme, back.panel, back.accent], ['dark', '#282828', '#123456'], 'customized Durotar restored');
    await press(page, 'Shift+F2');
    await page.keyboard.press('Control+k');
    await page.getByRole('searchbox').or(page.getByPlaceholder(/search/i)).first().fill('interface');
    const listed = await page.locator('.settings-panel, [role=dialog]').first().innerText();
    assert.match(listed, /Darker interface[\s\S]*Shift\+F1|Shift\+F1[\s\S]*Darker interface/);
    assert.match(listed, /Lighter interface[\s\S]*Shift\+F2|Shift\+F2[\s\S]*Lighter interface/);
    await page.keyboard.press('Escape');
    await closeApp(app, { keepProfile: true });
    // The remembered dark look survives a restart.
    app = await launch(); page = await open(app);
    assert.equal((await look(page)).panel, '#eee8d5', 'Silvermoon kept after restart');
    const restored = await press(page, 'Shift+F1');
    assert.deepEqual([restored.panel, restored.accent], ['#282828', '#123456'], 'customized Durotar restored after restart');
    await page.screenshot({ path: path.join(out, 'dark.png') });
    assert.deepEqual(errors, []);
    console.log('light/dark shortcut ok');
  } finally { await closeApp(app).catch(() => {}); }
})().catch(error => { console.error(error); process.exit(1); });
