// Isolated packaged acceptance for the POSE console, focus rig and appearance.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { allNodes } = await import('../src/animation.js');
  const { poseChainIds } = await import('../src/pose-ik.js');
  const out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-console-ui');
  const fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/pose-console-package/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile-' + Date.now());
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const fixtureHash = digest(fixture), errors = [], result = { fixture, fixtureHash, executablePath, checks: [] };
  const app = await _electron.launch({ executablePath, args: [fixture, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); win.hide(); });
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    const time = page.getByLabel('Current animation frame');
    const seek = async frame => { await time.fill(String(frame)); await time.press('Enter'); await page.waitForTimeout(150); };
    await seek(500); await page.getByLabel('Render mode', { exact: true }).selectOption('textured'); await page.getByLabel('View direction', { exact: true }).selectOption('front');
    await page.evaluate(() => {
      window.poseProbe = () => {
        const root = document.querySelector('.game-preview-root'); let runtime, props, session;
        for (let fiber = root?.[Object.keys(root).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState, ref = state?.current;
          if (ref?.native && ref?.controls) runtime = ref;
          if (ref?.model && ref?.onPoseCommit) props = ref;
          if (state?.doc?.model && state?.assets) session = state;
        }
        if (!runtime || !props || !session) throw Error('Packaged owners not ready');
        return { runtime, props, session };
      };
      window.poseSnapshot = () => { const { session } = poseProbe(); return { model: JSON.parse(JSON.stringify(session.doc.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)), undo: session.doc.historyStats.undoSteps }; };
    });
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const snap = () => page.evaluate(() => poseSnapshot());
    const canvas = page.locator('[data-clean-model-canvas]');
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const settle = () => page.waitForTimeout(150);
    const width = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'POSE', exact: true }).click(); await settle();
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await settle();
    const config = await page.evaluate(() => poseProbe().props.poseConfig);
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { model: poseSnapshot().model, config: props.poseConfig, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight, appearance: props.preferences.viewportAppearance.controllers }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, 500, 0, camera, data.width, data.height, 500, undefined, data.appearance);
    }
    async function select(chain) {
      await tool('Select');
      for (let attempt = 0; attempt < 40; attempt++) {
        const selected = await page.evaluate(() => poseProbe().props.poseConfig.target);
        if (selected?.kind === 'endpoint' && selected.key === chain.key && !selected.marker) return;
        const handle = (await handles()).find(item => item.kind === 'endpoint' && item.key === chain.key), box = await canvas.boundingBox();
        assert.ok(handle?.visible); await page.mouse.click(box.x + handle.x, box.y + handle.y); await settle();
      }
      throw Error('Cannot select limb ' + chain.key);
    }
    const paint = async () => { await page.waitForFunction(() => { try { const { runtime, props } = poseProbe(); return props.suspended || runtime.captureApi?.isReady; } catch { return false; } }); await page.evaluate(() => { const { runtime, props } = poseProbe(); if (!props.suspended) runtime.captureApi.captureFrame(); }); await settle(); };
    const shot = async name => { console.log('Screenshot: ' + name); await paint(); const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(png, 'base64')); };
    const prefs = () => page.evaluate(() => poseProbe().props.preferences);
    const menu = action => app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('menu', value), action);
    const section = title => page.locator('.settings-appearance-section').filter({ has: page.locator('summary', { hasText: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
    const openSection = async title => { const item = section(title); if (!await item.evaluate(el => el.open)) await item.locator('summary').click(); };
    const restrict = page.getByRole('button', { name: 'Restrict POSE', exact: true });
    assert.equal(await restrict.getAttribute('aria-pressed'), 'false');
    const restrictBox = await restrict.boundingBox(), setupBox = await page.getByRole('button', { name: 'POSE setup', exact: true }).boundingBox();
    assert.ok(restrictBox.x < setupBox.x && Math.abs(restrictBox.y - setupBox.y) < 1, 'Restrict sits immediately left of Setup');
    const sections = await page.locator('.movement-controller > details > summary').allTextContents();
    assert.ok(sections.indexOf('Controller') < sections.indexOf('Restrictions'));
    assert.equal(await page.locator('.movement-controller > details').filter({ has: page.locator('summary', { hasText: /^Restrictions$/ }) }).evaluate(el => el.open), false);
    assert.equal(await page.getByLabel('Controller type', { exact: true }).evaluate(el => el.tagName), 'SELECT');
    console.log('Check passed'); result.checks.push('permanent console, Restrict off by default, Controller dropdown above collapsed Restrictions');

    for (const kind of ['arm', 'leg']) for (const limited of [true, false]) {
      if ((await restrict.getAttribute('aria-pressed') === 'true') !== limited) await restrict.click();
      const chain = config.chains.find(chain => chain.kind === kind); await select(chain); await tool('Move'); await paint();
      const handle = (await handles()).find(item => item.kind === 'endpoint' && item.key === chain.key), box = await canvas.boundingBox(), before = await snap();
      await page.mouse.move(box.x + handle.x, box.y + handle.y); await page.mouse.down(); await page.mouse.move(box.x + handle.x + 12, box.y + handle.y - 8, { steps: 6 }); await settle();
      assert.deepEqual(await snap(), before, 'preview isolated'); await page.mouse.up(); await paint();
      const after = await snap(), jointIds = new Set(poseChainIds(chain)), oldNodes = new Map(allNodes(before.model).map(node => [node.ObjectId, node]));
      const bodyChanges = allNodes(after.model).filter(node => !jointIds.has(node.ObjectId) && ['Translation', 'Rotation'].some(property => JSON.stringify(node[property]) !== JSON.stringify(oldNodes.get(node.ObjectId)[property])));
      assert.equal(after.undo, before.undo + 1); assert.equal(bodyChanges.length > 0, !limited, kind + ' body lead matches Restrict');
      await canvas.focus(); await page.keyboard.press('Control+z'); await paint(); assert.deepEqual((await snap()).model, before.model);
    }
    result.checks.push('real hand and foot drags with Restrict on/off, isolated preview and exact atomic Undo');

    await page.getByRole('checkbox', { name: 'Focused Skeleton', exact: true }).check();
    await tool('Select');
    const pelvis = (await handles()).find(handle => handle.label === 'Pelvis'), view = await canvas.boundingBox();
    for (let i = 0; i < 25; i++) { const target = await page.evaluate(() => poseProbe().props.poseConfig.target); if (target?.kind === pelvis.kind && target.id === pelvis.id && !target.marker) break; await page.mouse.click(view.x + pelvis.x, view.y + pelvis.y); await settle(); }
    await paint();
    assert.equal(await page.evaluate(() => poseProbe().props.poseConfig.target.id), pelvis.id);
    assert.equal(await page.locator('[data-node-overlay]').evaluate(el => el.getContext('2d').getTransform().isIdentity), true, 'drawing restores canvas transform');
    const skeletonCheck = await page.locator('[data-node-overlay]').evaluate(el => ({ count: Number(el.dataset.poseSkeleton), yellow: Array.from(el.getContext('2d').getImageData(0, 0, el.width, el.height).data).filter((v, i, a) => i % 4 === 0 && v === 255 && a[i + 1] === 255 && a[i + 2] === 0 && a[i + 3] > 200).length }));
    assert.ok(skeletonCheck.count >= 10 && skeletonCheck.count < 30); assert.equal(skeletonCheck.yellow, 0, 'no native yellow descendant tangle');
    const connectors = await page.locator('[data-connector-overlay]').evaluate(el => el.getContext('2d').getImageData(0, 0, el.width, el.height).data.some((v, i) => i % 4 === 3 && v));
    assert.equal(connectors, false); await shot('focused-pelvis');
    result.checks.push('pelvis uses mapped pose skeleton, with no raw mesh or weapon connectors');

    const leg = config.chains.find(chain => chain.kind === 'leg'); await select(leg); await tool('Move'); await paint();
    const pin = page.locator('[data-pose-pin]');
    for (let turn = 0; turn < 3; turn++) {
      const hs = await handles(), limb = hs.find(handle => handle.kind === 'endpoint' && handle.key === leg.key), body = hs.find(handle => handle.label === 'Pelvis') || hs.find(handle => handle.kind === 'body');
      const b = await pin.boundingBox(), c = await canvas.boundingBox();
      assert.ok(limb.x > body.x ? b.x - c.x > limb.x + 25 : b.x - c.x + b.width < limb.x - 25, 'Pin stays on the outside of the limb');
      const before = await snap(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); assert.deepEqual(await pin.boundingBox(), b);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await paint(); assert.deepEqual(await pin.boundingBox(), b); assert.deepEqual(await snap(), before);
      await pin.press('Space'); await paint(); assert.deepEqual(await snap(), before);
      await shot('outward-pin-' + turn);
      const cameraBefore = await page.evaluate(() => poseProbe().runtime.controls.object.position.toArray());
      await page.keyboard.down('Alt'); await page.mouse.move(c.x + 70, c.y + 90); await page.mouse.down(); await page.mouse.move(c.x + 155, c.y + 110, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await paint();
      assert.notDeepEqual(await page.evaluate(() => poseProbe().runtime.controls.object.position.toArray()), cameraBefore);
    }
    result.checks.push('outward Pin after actual camera rotations, stable under pointer, mouse/Space pin toggles add no history');

    const appearanceBefore = await snap();
    await menu('configurationSettings'); await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
    assert.equal(await page.locator('.settings-tabs').getByRole('tab').first().innerText(), 'Configuration');
    assert.equal(await page.locator('.settings-page h3').first().innerText(), 'Updates');
    await shot('configuration'); await page.getByRole('tab', { name: 'Appearance', exact: true }).click();
    assert.equal(await page.locator('.settings-appearance-section[open]').count(), 1); await shot('appearance-collapsed');
    const { BUILT_IN_VIEWPORT_PRESETS } = await import('../src/viewport-appearance.js');
    for (const preset of Object.values(BUILT_IN_VIEWPORT_PRESETS)) {
      await page.getByLabel('Viewport appearance preset').selectOption(preset.id); await paint();
      assert.equal((await prefs()).theme, preset.theme); assert.deepEqual((await prefs()).viewportAppearance.controllers, preset.appearance.controllers);
      assert.equal(await pin.getAttribute('data-style'), preset.appearance.controllers.pinStyle);
      assert.equal(await page.locator('html').evaluate(el => el.style.getPropertyValue('--controller-color')), preset.appearance.controllers.color);
    }
    await page.getByLabel('Viewport appearance preset').selectOption('mdlvis-vanilla');
    await openSection('Controllers'); await page.getByLabel('Controllers appearance set').selectOption('blender-style'); await paint();
    let mixed = await prefs(); assert.equal(mixed.theme, 'light'); assert.equal(mixed.viewportAppearance.background.color, '#cccccc'); assert.equal(mixed.viewportAppearance.controllers.color, '#ffb765');
    assert.equal(await pin.getAttribute('data-style'), 'icon'); assert.equal((await pin.boundingBox()).width, 30);
    for (const shape of ['circle', 'square', 'diamond', 'triangle']) { await page.getByLabel('Handle shape', { exact: true }).selectOption(shape); await paint(); assert.equal((await prefs()).viewportAppearance.controllers.shape, shape); }
    await page.getByLabel('Pin button style').selectOption('round'); await page.getByLabel('Controller size', { exact: true }).fill('22'); await page.getByLabel('Controller size', { exact: true }).press('Tab');
    await page.getByRole('checkbox', { name: 'Show body-part symbols' }).uncheck(); await paint(); await shot('controllers-mixed');
    mixed = await prefs(); assert.equal(mixed.viewportAppearance.controllers.pinStyle, 'round'); assert.equal(mixed.viewportAppearance.controllers.size, 22); assert.equal(mixed.viewportAppearance.controllers.symbols, false);
    result.checks.push('all seven global themes change live controllers; Lordaeron interface with independent Blackrock controllers, four shapes and three Pin styles');

    const titles = await page.locator('.settings-appearance-section > summary').allTextContents();
    for (const title of titles.filter(title => !['Presets', 'Controllers'].includes(title))) {
      await openSection(title); const select = page.getByLabel(title + ' appearance set', { exact: true }); assert.equal(await select.count(), 1, title + ' has a set picker');
      const previous = await prefs(); await select.selectOption('nord'); await paint(); const next = await prefs();
      assert.deepEqual(next.viewportAppearance.controllers, previous.viewportAppearance.controllers, title + ' leaves controller customisations intact');
    }
    result.checks.push('every Appearance submenu has a working independent set selector');
    await page.getByRole('button', { name: 'Done', exact: true }).click(); await paint();
    assert.deepEqual(await snap(), appearanceBefore, 'all Appearance edits preserve model and history');
    assert.equal(await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width), width);
    await shot('mixed-pose');
    await menu('appearanceSettings'); await openSection('Controllers'); assert.equal(await page.getByLabel('Handle shape', { exact: true }).inputValue(), 'triangle');
    assert.equal(await page.getByLabel('Pin button style').inputValue(), 'round'); await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(digest(fixture), fixtureHash); assert.deepEqual(errors, []);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    result.errors = errors; fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const png = await (await app.firstWindow()).screenshot({ timeout: 10000 }).then(data => data.toString('base64')).catch(() => null);
    if (png) fs.writeFileSync(path.join(out, 'failure.png'), Buffer.from(png, 'base64'));
    result.errors = errors; result.failure = error.stack; fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify(result, null, 2)); throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
