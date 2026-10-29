// Real installed HD assets, isolated hidden profile, production packaged renderer.
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), out = path.resolve(process.env.MDLXL_HD_TEST_OUT || path.join(root, 'out/hd-library-preview'));
const checks = [];

(async () => {
  fs.mkdirSync(path.join(out, 'profile'), { recursive: true });
  fs.writeFileSync(path.join(out, 'profile/settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const executablePath = process.env.MDLXL_PACKAGED_EXE || path.join(root, 'node_modules/electron/dist/electron.exe');
  const app = await _electron.launch({ executablePath, args: process.env.MDLXL_PACKAGED_EXE ? [] : [root], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile'), MDLVIS_GAME_DATA: process.env.MDLVIS_GAME_DATA || 'D:/Warcraft III' }, timeout: 90000 });
  try {
    const page = await app.firstWindow(), errors = []; page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1440, 980); w.webContents.setBackgroundThrottling(false); });
    const capture = async name => {
      const result = await app.evaluate(async ({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0];
        const image = await w.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
        return { base64: image.toPNG().toString('base64'), visible: w.isVisible() };
      });
      assert.equal(result.visible, false);
      if (name) fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.base64, 'base64'));
    };
    const state = () => page.evaluate(() => {
      const host = document.querySelector('.game-preview-root');
      let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const s = hook.memoizedState?.current;
        if (s?.native && s?.controls) return { frame: s.native.getFrame(), sequence: s.native.getSequence(), position: s.controls.object.position.toArray(), matrices: s.native.rendererData.nodes.filter(Boolean).flatMap(n => Array.from(n.matrix)), version: s.native.model.Version, glError: s.native.gl.getError() };
      }
      return null;
    });
    await page.locator('[data-hotkey="textureLibrary"]').dispatchEvent('click');
    await page.getByRole('tab', { name: 'Models', exact: true }).dispatchEvent('click');
    for (const [variant, query, label] of [['classic', 'footman', 'Footman'], ['forsaken-kingdom', 'peon', 'Peon'], ['reforged', 'blademaster', 'Blademaster']]) {
      await page.getByLabel('Game version', { exact: true }).selectOption(variant);
      await page.getByRole('searchbox', { name: 'Search game files' }).fill(query);
      await page.locator('.gf-row').filter({ has: page.locator('.gf-name', { hasText: new RegExp('^' + label) }) }).first().dispatchEvent('click');
      await page.waitForFunction(name => document.querySelector('.gf-info h3')?.textContent === name && !document.querySelector('.gf-stage-busy') && document.querySelector('[aria-label="Model animation"]'), label, { polling: 100 });
      await page.waitForTimeout(3000); await capture();
      const info = await page.locator('.gf-info').innerText(), warnings = await page.locator('.game-preview-root').innerText();
      assert.doesNotMatch(info, /textures not found/); assert.doesNotMatch(warnings, /Unsupported DDS|textures unresolved|Texture has no/);
      const animation = page.getByLabel('Model animation', { exact: true });
      const options = await animation.locator('option').evaluateAll(items => items.map(item => ({ value: item.value, name: item.textContent })));
      for (const prefix of ['Stand', 'Walk', 'Attack']) {
        const option = options.find(item => item.name.startsWith(prefix)); assert.ok(option, label + ': ' + prefix);
        await animation.selectOption(option.value); await page.waitForTimeout(200); await capture(); const before = await state();
        await page.waitForTimeout(200); await capture(); const after = await state();
        assert.notEqual(before.frame, after.frame, label + ' animation advances');
        assert.notDeepEqual(before.matrices, after.matrices, label + ' bones animate');
        assert.equal(after.glError, 0, label + ' has no WebGL error');
      }
      await animation.selectOption(options.find(item => item.name.startsWith('Stand')).value);
      await page.getByRole('button', { name: 'Pause', exact: true }).dispatchEvent('click');
      await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
      await capture(); const beforeDrag = await state(), box = await page.locator('.gf-stage canvas').first().boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 35, { steps: 12 }); await page.mouse.up();
      await capture(); assert.notDeepEqual((await state()).position, beforeDrag.position, label + ' normal mouse drag rotates camera');
      if (variant !== 'classic') await capture(variant);
      checks.push(variant + ': textures, Stand/Walk/Attack playback, WebGL, normal mouse rotation'); console.log(checks.at(-1));
    }
    await page.getByRole('button', { name: 'Open in editor', exact: true }).dispatchEvent('click');
    await page.getByRole('tab', { name: /HeroBladeMaster\.mdx/i }).waitFor();
    assert.match(await page.locator('body').innerText(), /view-only; saving is disabled/);
    const closeNotice = page.getByRole('button', { name: 'OK', exact: true });
    if (await closeNotice.count()) await closeNotice.dispatchEvent('click');
    await page.locator('[data-hotkey="animation"]').dispatchEvent('click');
    await page.waitForTimeout(1500); await capture(); assert.equal((await state()).version, 1800);
    checks.push('Library opens original MDX1800 in editor; HD view-only/save restriction retained');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors, hidden: true }, null, 2));
    console.log(JSON.stringify({ checks, errors, hidden: true }, null, 2));
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
