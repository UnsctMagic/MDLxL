// Real packaged renderer, real mouse/keyboard events, isolated fixture/profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const output = path.join(root, 'out/shredder-helper-ui');
  await fs.mkdir(output, { recursive: true });
  const run = await fs.mkdtemp(path.join(output, 'run-')), profile = path.join(run, 'profile');
  await fs.mkdir(profile);
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { language: 'en', shredderEnabled: false, checkUpdatesOnStartup: false, hotkeys: { translate: ['Q'] }, graphics: { pauseWhenHidden: false } } }));
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(run, 'Shredder-test.mdx');
  await fs.writeFile(fixture, createStarterDocument().serialize('mdx'));
  const packaged = process.env.MDLXL_TEST_PACKAGE || path.join(root, 'out/shredder-helper-package/MDLxL-win32-x64');
  const app = await _electron.launch({ executablePath: path.join(packaged, 'MDLxL.exe'), args: ['--disable-backgrounding-occluded-windows', fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  let page;
  const errors = [], checks = [];
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow, dialog }) => { dialog.showMessageBoxSync = () => 1; const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setPosition(-3000, 0); win.showInactive(); });
    await page.waitForFunction(() => document.querySelector('.classic-counts')?.textContent.includes('Vertices: 8'));
    await page.evaluate(() => {
      window.shredderClockOffset = 0; const nativeNow = performance.now.bind(performance);
      performance.now = () => nativeNow() + window.shredderClockOffset;
      window.activeDocument = () => {
        const host = document.querySelector('.classic-app'); let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current; if (value?.doc?.model?.Geosets && value.session) return value.doc;
        }
        throw Error('Active document not found');
      };
      window.viewportState = () => {
        const host = document.querySelector('.viewport'); let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current; if (value?.renderer && value?.entries) return value;
        }
        throw Error('Viewport not found');
      };
      window.modelBytes = () => Array.from(activeDocument().serialize('mdx'));
    });
    const advance = async ms => { await page.evaluate(ms => { window.shredderClockOffset += ms; }, ms); await page.waitForTimeout(130); };
    const shot = async name => { await page.screenshot({ path: path.join(output, name + '.png') }); };
    const openSettings = async () => { await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[6].submenu.items[0].click()); await page.locator('.settings-window').waitFor(); };
    const closeSettings = async () => { await page.locator('.settings-window>header button').click(); await page.locator('.settings-window').waitFor({ state: 'detached' }); await page.waitForTimeout(150); };
    const birdToggle = () => page.locator('.settings-window input[data-warmkey="shredder"]');
    const language = async id => { await page.locator('.language-trigger').click(); await page.getByRole('option', { name: ({ en: 'English', ru: 'Russian', es: 'Spanish', zh: 'Chinese', mordor: 'The Language of Mordor' })[id], exact: true }).click(); };
    const repeat = async id => { for (let count = 0; count < 3; count++) await page.locator(`button[data-warmkey="${id}"]:visible`).first().click(); };
    const before = await page.evaluate(() => modelBytes()), sidebar = await page.locator('.classic-sidebar').boundingBox();
    assert.equal(await page.locator('.shredder-layer').count(), 0);
    await shot('01-default');
    await openSettings(); await birdToggle().check(); await closeSettings();
    await page.locator('.shredder-sprite').waitFor();
    await shot('02-perched');
    assert.equal((await page.locator('.classic-sidebar').boundingBox()).width, sidebar.width);
    assert.equal(await page.locator('.shredder-balloon').isVisible(), false);
    assert.equal(await page.locator('.shredder-layer').evaluate(element => getComputedStyle(element).pointerEvents), 'none');
    checks.push('Opt-in, small idle visitor, unchanged sidebar and click-through overlay');
    // A programmatic activation cannot masquerade as repeated mouse work.
    await page.locator('button[data-warmkey="translate"]:visible').first().evaluate(element => { for (let i = 0; i < 5; i++) element.click(); });
    assert.equal(await page.locator('.shredder-balloon').isVisible(), false);
    await repeat('translate');
    await page.locator('.shredder-balloon').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.shredder-balloon kbd').innerText(), 'Q');
    assert.ok(await page.locator('[data-shredder-hint][data-warmkey="translate"]').count());
    await shot('03-shortcut-tip');
    await page.keyboard.press('Q'); await page.locator('.shredder-balloon').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-shredder-hint]').count(), 0);
    await advance(61000); await repeat('translate');
    await advance(61000); await repeat('translate');
    await advance(61000); await repeat('translate');
    await advance(61000); await repeat('translate');
    await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase === 'tantrum');
    await advance(1000); await shot('04-tantrum');
    const passThrough = await page.locator('.shredder-sprite').evaluate(element => { const r = element.getBoundingClientRect(), x = Math.max(1, Math.min(innerWidth - 1, r.x + 32)), y = Math.max(1, Math.min(innerHeight - 1, r.y + 40)); return !document.elementFromPoint(x, y)?.closest('.shredder-layer'); });
    assert.equal(passThrough, true, 'flying and pecking never steal the cursor');
    await advance(8000);
    assert.equal(await page.locator('.shredder-sprite').getAttribute('data-phase'), 'perch');
    await advance(61000); await repeat('translate');
    assert.equal(await page.locator('.shredder-balloon').isVisible(), false, 'tantrum cannot repeat for the same ignored advice');
    assert.deepEqual(await page.evaluate(() => modelBytes()), before, 'all normal Shredder behavior leaves actual model bytes unchanged');
    checks.push('Trusted mouse repetitions, custom Q advice, target pointing, shortcut recognition, bounded single tantrum and byte-preserving normal mode');
    const cameraBefore = await page.evaluate(() => viewportState().camera.quaternion.toArray());
    await page.keyboard.press('W');
    const viewport = await page.locator('.viewport').boundingBox(), x = viewport.x + viewport.width * .45, y = viewport.y + viewport.height * .45;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 95, y + 50, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(200);
    assert.notDeepEqual(await page.evaluate(() => viewportState().camera.quaternion.toArray()), cameraBefore);
    await page.keyboard.press('W');
    assert.deepEqual(await page.evaluate(() => modelBytes()), before);
    checks.push('Normal mouse drag actually rotates the packaged 3D camera with Shredder enabled');
    await language('mordor');
    const warning = page.locator('.shredder-warning'); await warning.waitFor();
    assert.deepEqual(await warning.locator('p').allTextContents(), ['Do not tempt Shredder with the powers of Mordor', 'Proceed?']);
    assert.deepEqual(await warning.locator('button').allTextContents(), ['Aye!', 'Nay!']);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    await shot('05-language-warning');
    await warning.getByRole('button', { name: 'Nay!', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    await language('mordor'); await warning.getByRole('button', { name: 'Aye!', exact: true }).click();
    await page.locator('.shredder-crown').waitFor();
    await advance(15000);
    await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase === 'attack');
    await advance(1600); await shot('06-mordor-carry');
    await advance(2100);
    assert.notDeepEqual(await page.evaluate(() => modelBytes()), before, 'Mordor attacks mutate the actual live model');
    const vertexAfter = await page.evaluate(() => ({ source: Array.from(activeDocument().model.Geosets[0].Vertices), preview: Array.from(viewportState().entries[0].geometry.attributes.position.array) }));
    assert.deepEqual(vertexAfter.preview, vertexAfter.source, 'the visible mesh contains the attacked coordinates');
    await page.keyboard.press('Control+Z');
    assert.deepEqual(await page.evaluate(() => modelBytes()), before, 'the existing editor Undo restores exact model bytes');
    await page.waitForFunction(() => Array.from(viewportState().entries[0].geometry.attributes.position.array).every((value, index) => value === activeDocument().model.Geosets[0].Vertices[index]));
    await language('en'); await advance(61000); await repeat('translate');
    assert.equal(await page.locator('.shredder-balloon').isVisible(), false, 'language switching cannot restart a used tantrum while Shredder remains enabled');
    await language('mordor'); await warning.getByRole('button', { name: 'Aye!', exact: true }).click();
    await openSettings(); await birdToggle().uncheck();
    await birdToggle().click(); await warning.waitFor();
    assert.deepEqual(await warning.locator('p').allTextContents(), ['Do not summon this beast into the lands of Mordor...', 'Proceed?']);
    assert.deepEqual(await warning.locator('button').allTextContents(), ['Aye!', 'Nay!']);
    assert.match(await warning.evaluate(element => getComputedStyle(element.querySelector('p')).fontFamily), /Tahoma/);
    await shot('07-summon-warning');
    await warning.getByRole('button', { name: 'Nay!', exact: true }).click();
    assert.equal(await birdToggle().isChecked(), false);
    await birdToggle().click(); await warning.getByRole('button', { name: 'Aye!', exact: true }).click();
    assert.equal(await birdToggle().isChecked(), true); await closeSettings();
    checks.push('Exact English warnings in both directions; Nay cancels; Aye unlocks crown, real visible vertex attacks and normal Undo');
    for (const id of ['en', 'ru', 'es', 'zh']) {
      await language(id); await openSettings(); await birdToggle().uncheck(); await birdToggle().check(); await closeSettings();
      await repeat('translate'); await page.locator('.shredder-balloon').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.shredder-balloon kbd').innerText(), 'Q');
      const text = await page.locator('.shredder-balloon').innerText();
      if (id !== 'en') assert.doesNotMatch(text, /You keep clicking|Try /);
      await shot('08-speech-' + id);
      await page.keyboard.press('Q'); await page.locator('.shredder-balloon').waitFor({ state: 'hidden' });
    }
    await page.waitForTimeout(400);
    const saved = JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8'));
    assert.equal(saved.preferences.shredderEnabled, true);
    assert.deepEqual(saved.preferences.hotkeys.translate, ['Q']);
    assert.deepEqual(await fs.readFile(fixture), Buffer.from(before), 'the fixture file was never saved or overwritten by attacks');
    assert.deepEqual(errors, []);
    checks.push('Localized speech and literal Q in every ordinary language, Mordor speech/crown, remembered opt-in and no disk writes to the model');
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ checks, errors, packaged, profile }, null, 2));
    await fs.rm(path.join(output, 'failure.json'), { force: true });
    await fs.rm(path.join(output, 'failure.png'), { force: true });
    console.log('PASS packaged Shredder\n' + checks.join('\n'));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, checks, errors }, null, 2));
    throw error;
  } finally { await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 0); }).catch(() => {}); await app.close().catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
