// Real packaged renderer, real mouse/keyboard events, isolated fixture/profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const output = path.join(root, 'out/shredder-helper-v2-ui');
  await fs.mkdir(output, { recursive: true });
  const run = await fs.mkdtemp(path.join(output, 'run-')), profile = path.join(run, 'profile');
  await fs.mkdir(profile);
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { language: 'en', shredderEnabled: false, checkUpdatesOnStartup: false, hotkeys: { translate: ['Q'] }, graphics: { pauseWhenHidden: false } } }));
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(run, 'Shredder-test.mdx');
  await fs.writeFile(fixture, createStarterDocument().serialize('mdx'));
  const packaged = process.env.MDLXL_TEST_PACKAGE || path.join(root, 'out/shredder-helper-v2-package/MDLxL-win32-x64');
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
      window.previewState = () => {
        const host = document.querySelector('.game-preview-surface'); let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current; if (value?.native && value.controls && value.captureApi) return value;
        }
        return null;
      };
    });
    const advance = async ms => { await page.evaluate(ms => { window.shredderClockOffset += ms; }, ms); await page.waitForTimeout(130); };
    const shot = async name => { await page.screenshot({ path: path.join(output, name + '.png') }); };
    const openSettings = async () => { await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[6].submenu.items[0].click()); await page.locator('.settings-window').waitFor(); };
    const closeSettings = async () => { await page.locator('.settings-window>header button').click(); await page.locator('.settings-window').waitFor({ state: 'detached' }); await page.waitForTimeout(150); };
    const birdToggle = () => page.locator('.settings-window input[data-warmkey="shredder"]');
    const language = async id => { await page.locator('.language-trigger').click(); await page.getByRole('option', { name: ({ en: 'English', ru: 'Russian', es: 'Spanish', zh: 'Chinese', mordor: 'The Language of Mordor' })[id], exact: true }).click(); };
    const repeat = async id => { for (let count = 0; count < 2; count++) await page.locator(`button[data-warmkey="${id}"]:visible`).first().click(); };
    const toggle = () => page.locator('.shredder-tool');
    const before = await page.evaluate(() => modelBytes()), sidebar = await page.locator('.classic-sidebar').boundingBox();
    assert.equal(await page.locator('.shredder-layer').count(), 0);
    await shot('01-default');
    assert.equal(await toggle().innerText(), 'SHRD');
    assert.equal(await toggle().getAttribute('aria-pressed'), 'false');
    await openSettings(); await birdToggle().check(); await closeSettings();
    assert.equal(await toggle().getAttribute('aria-pressed'), 'true');
    await page.locator('.shredder-sprite').waitFor();
    await shot('02-perched');
    assert.equal((await page.locator('.classic-sidebar').boundingBox()).width, sidebar.width);
    assert.match(await page.locator('.shredder-balloon').innerText(), /Drag me/);
    assert.equal(await page.locator('.shredder-layer').evaluate(element => getComputedStyle(element).pointerEvents), 'none');
    const perched = await page.locator('.shredder-sprite').boundingBox();
    await page.mouse.move(perched.x + 32, perched.y + 35); await page.waitForTimeout(250);
    assert.deepEqual(await page.locator('.shredder-sprite').boundingBox(), perched, 'hovering does not make him dodge');
    const grip = await page.locator('.shredder-handle').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
    await page.mouse.move(grip.x - 320, grip.y - 120, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(200);
    const dropped = await page.locator('.shredder-sprite').boundingBox();
    assert.ok(dropped.x < perched.x - 250 && dropped.y < perched.y - 70, 'actual mouse dragging moves the pet');
    await page.mouse.move(dropped.x + 32, dropped.y + 35); await page.waitForTimeout(250);
    assert.deepEqual(await page.locator('.shredder-sprite').boundingBox(), dropped, 'he stays where dropped while the mouse is nearby');
    assert.deepEqual(await page.evaluate(() => modelBytes()), before, 'dragging never edits the model');
    await openSettings(); assert.equal(await birdToggle().isChecked(), true); await closeSettings();
    await page.locator('.vis-toggle').click(); assert.equal(await toggle().isVisible(), true, 'SHRD is also available in VIS'); await page.locator('.vis-toggle').click();
    await advance(11000); await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase === 'walk');
    await advance(1000); assert.notEqual((await page.locator('.shredder-sprite').boundingBox()).x, dropped.x);
    await advance(10000); await advance(6500);
    await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase === 'excursion');
    await advance(1600);
    const away = await page.locator('.shredder-sprite').boundingBox();
    assert.ok(away.x < -64 || away.x > 1100, 'autonomous flights actually leave the view');
    await advance(3200); await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase !== 'excursion');
    await toggle().click(); await toggle().click();
    checks.push('Bird/SHRD beside KEY/VIS; synchronized opt-in; real dragging; no hover dodge; edge walking and off-view flights; unchanged sidebar');
    // A programmatic activation cannot masquerade as repeated mouse work.
    await page.locator('button[data-warmkey="translate"]:visible').first().evaluate(element => { for (let i = 0; i < 5; i++) element.click(); });
    assert.equal(await page.locator('.shredder-balloon kbd').count(), 0);
    await repeat('translate');
    await page.locator('.shredder-balloon').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.shredder-balloon kbd').innerText(), 'Q');
    assert.ok(await page.locator('[data-shredder-hint][data-warmkey="translate"]').count());
    await shot('03-shortcut-tip');
    await page.keyboard.press('Q');
    await page.waitForFunction(() => document.querySelector('.shredder-balloon')?.textContent.includes('Much faster'));
    assert.match(await page.locator('.shredder-balloon').innerText(), /Much faster/);
    assert.equal(await page.locator('[data-shredder-hint]').count(), 0);
    await advance(5000); await repeat('translate');
    const taughtAt = Date.now();
    for (let index = 0; index < 8; index++) { await page.waitForTimeout(650); await page.locator(`button[data-warmkey="${['rotate', 'scale', 'translate'][index % 3]}"]:visible`).first().click(); }
    await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase === 'tantrum');
    await advance(1000); await shot('04-tantrum');
    assert.ok(Date.now() - taughtAt < 10000, 'ignored advice causes anger in real seconds, without accelerating the clock');
    assert.equal(await page.locator('.shredder-balloon').evaluate(element => getComputedStyle(element).pointerEvents), 'none');
    await advance(1000);
    await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase === 'peck');
    assert.equal(await page.locator('.shredder-handle').evaluate(element => getComputedStyle(element).pointerEvents), 'none', 'cursor pecks do not intercept editing input');
    await advance(8000);
    assert.equal(await page.locator('.shredder-sprite').getAttribute('data-phase'), 'perch');
    await advance(30000); await repeat('translate');
    assert.notEqual(await page.locator('.shredder-sprite').getAttribute('data-phase'), 'tantrum', 'useful advice can continue without repeating harassment');
    assert.deepEqual(await page.evaluate(() => modelBytes()), before, 'all normal Shredder behavior leaves actual model bytes unchanged');
    checks.push('Two-click remapped Q advice, mixed-action ignored advice and real-time anger, praise for shortcuts, bounded single tantrum and byte-preserving normal behavior');
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
    assert.equal(await page.locator('.shredder-sprite svg').count(), 0, 'the crown is painted into the sprite');
    await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.phase === 'attack');
    await page.waitForFunction(() => document.querySelector('.shredder-sprite')?.dataset.carrying === 'true');
    await shot('06-mordor-carry');
    const art = await page.locator('.shredder-picture').evaluate(async element => {
      const img = new Image(); img.src = getComputedStyle(element).backgroundImage.slice(5, -2); await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      return { size: getComputedStyle(element).width, alpha: ctx.getImageData(0, 0, 1, 1).data[3] };
    });
    assert.deepEqual(art, { size: '112px', alpha: 0 });
    const heldControl = await page.locator('button[data-warmkey="translate"]:visible').first().boundingBox();
    await page.mouse.move(heldControl.x + heldControl.width / 2, heldControl.y + heldControl.height / 2); await page.mouse.down();
    const heldRevision = await page.evaluate(() => activeDocument().revision);
    await page.waitForTimeout(2200);
    assert.equal(await page.evaluate(() => activeDocument().revision), heldRevision, 'a held editor gesture defers atomic vertex edits without cancelling flight');
    await page.mouse.up();
    await page.waitForFunction(start => activeDocument().revision > start, heldRevision);
    const attackRevision = await page.evaluate(() => activeDocument().revision), darkLines = new Set();
    for (let index = 0; index < 24; index++) {
      await page.waitForTimeout(650); await page.locator('button[data-warmkey="translate"]:visible').first().click();
      darkLines.add(await page.locator('.shredder-balloon').innerText());
    }
    assert.ok(await page.evaluate(start => activeDocument().revision - start >= 8, attackRevision), 'chaos continues well beyond five attacks while the user keeps clicking');
    assert.ok(darkLines.size >= 3, 'Mordor keeps talking with varied lines');
    assert.notDeepEqual(await page.evaluate(() => modelBytes()), before, 'Mordor attacks mutate the actual live model');
    const vertexAfter = await page.evaluate(() => ({ source: Array.from(activeDocument().model.Geosets[0].Vertices), preview: Array.from(viewportState().entries[0].geometry.attributes.position.array) }));
    assert.deepEqual(vertexAfter.preview, vertexAfter.source, 'the visible mesh contains the attacked coordinates');
    for (const id of ['bones', 'animation']) {
      await page.locator(`button[data-warmkey="${id}"]:visible`).first().click();
      await page.waitForFunction(() => previewState()?.captureApi.isReady);
      const start = await page.evaluate(() => activeDocument().revision);
      await page.waitForFunction(start => activeDocument().revision > start, start);
      await page.waitForFunction(() => Array.from(previewState().native.model.Geosets[0].Vertices).every((value, index) => value === activeDocument().model.Geosets[0].Vertices[index]));
    }
    await shot('06b-mordor-movement');
    await toggle().click();
    const attackCount = await page.evaluate(() => activeDocument().revision);
    // Editor Undo also includes selection history from changing workspaces.
    for (let index = 0; index < attackCount + 40 && await page.evaluate(() => activeDocument().canUndo); index++) await page.keyboard.press('Control+Z');
    assert.deepEqual(await page.evaluate(() => modelBytes()), before, 'existing Undo restores exact model bytes after sustained multi-view chaos');
    await page.waitForFunction(() => Array.from(previewState().native.model.Geosets[0].Vertices).every((value, index) => value === activeDocument().model.Geosets[0].Vertices[index]));
    await toggle().click(); await warning.waitFor();
    assert.deepEqual(await warning.locator('p').allTextContents(), ['Do not summon this beast into the lands of Mordor...', 'Proceed?']);
    assert.deepEqual(await warning.locator('button').allTextContents(), ['Aye!', 'Nay!']);
    assert.match(await warning.evaluate(element => getComputedStyle(element.querySelector('p')).fontFamily), /Tahoma/);
    await shot('07-summon-warning');
    await warning.getByRole('button', { name: 'Nay!', exact: true }).click();
    assert.equal(await toggle().getAttribute('aria-pressed'), 'false');
    await toggle().click(); await warning.getByRole('button', { name: 'Aye!', exact: true }).click();
    assert.equal(await toggle().getAttribute('aria-pressed'), 'true');
    await language('en');
    const previewCamera = await page.evaluate(() => previewState().controls.object.quaternion.toArray());
    await page.keyboard.press('W'); const surface = await page.locator('.game-preview-surface').boundingBox();
    await page.mouse.move(surface.x + surface.width * .4, surface.y + surface.height * .4); await page.mouse.down();
    await page.mouse.move(surface.x + surface.width * .4 + 85, surface.y + surface.height * .4 + 50, { steps: 10 }); await page.mouse.up();
    assert.notDeepEqual(await page.evaluate(() => previewState().controls.object.quaternion.toArray()), previewCamera);
    await page.keyboard.press('W');
    await page.locator('button[data-warmkey="vertices"]:visible').first().click();
    checks.push('Exact English warnings in both directions; painted large Morgoth animation; sustained real-time varied Mordor speech and visible attacks in Vertices/Bones/Movement; exact Undo and actual mouse preview rotation');
    for (const id of ['en', 'ru', 'es', 'zh']) {
      await language(id); await toggle().click(); await toggle().click();
      await repeat('translate'); await page.locator('.shredder-balloon').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.shredder-balloon kbd').innerText(), 'Q');
      const text = await page.locator('.shredder-balloon').innerText();
      if (id !== 'en') assert.doesNotMatch(text, /You keep clicking|Try /);
      await shot('08-speech-' + id);
      await page.keyboard.press('Q'); await page.waitForFunction(() => !document.querySelector('[data-shredder-hint]'));
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
