// Packaged mouse acceptance, with a hidden window and a disposable profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

(async () => {
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { samplePoseChain } = await import('../src/pose-ik.js');
  const { openDocument } = await import('../src/editor-document.js');
  const { assertModelEquivalent } = await import('../src/save-equivalence.js');
  const out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-sd-ui');
  const fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/pose-sd-package/MDLxL-win32-x64/MDLxL.exe');
  const profile = path.join(out, 'profile-' + Date.now());
  fs.mkdirSync(profile, { recursive: true });
  fs.cpSync(path.join(path.dirname(fixture), 'Textures'), path.join(out, 'Textures'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const results = { fixture, sourceHash: hash(fixture), executablePath, indexHash: hash(path.join(path.dirname(executablePath), 'resources/app/dist/index.html')), checks: [], measurements: [] }, errors = [];
  const app = await _electron.launch({ executablePath, args: [fixture, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); win.hide(); });
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    const time = page.getByLabel('Current animation frame'); await time.fill('500'); await time.press('Enter');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await page.evaluate(() => {
      window.poseProbe = () => {
        const element = document.querySelector('.game-preview-root'); let runtime, props, session;
        for (let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState, ref = state?.current;
          if (ref?.native && ref?.controls) runtime = ref;
          if (ref?.model && ref?.onPoseCommit) props = ref;
          if (state?.doc?.model && state?.assets) session = state;
        }
        if (!runtime || !props || !session) throw Error('Movement is not ready');
        return { runtime, props, session };
      };
      window.posePlain = value => ArrayBuffer.isView(value) ? Array.from(value) : Array.isArray(value) ? value.map(posePlain) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, posePlain(item)])) : value;
      window.poseSnap = () => { const { session } = poseProbe(); return { model: posePlain(session.doc.model), revision: session.doc.revision, undo: session.doc.historyStats.undoSteps, dirty: session.doc.dirty }; };
    });
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const settle = () => page.waitForTimeout(140);
    const snap = () => page.evaluate(() => poseSnap());
    const box = () => page.locator('[data-clean-model-canvas]').boundingBox();
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true });
    const shot = async name => { await app.evaluate(async ({ BrowserWindow }) => { await BrowserWindow.getAllWindows()[0].webContents.capturePage(); }); await settle(); const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(png, 'base64')); };
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { model: poseSnap().model, config: props.poseConfig, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, 500, 0, camera, data.width, data.height);
    }
    async function select(kind, key) {
      await tool('Select').click();
      for (let attempt = 0; attempt < 16; attempt++) {
        const target = await page.evaluate(() => poseProbe().props.poseConfig.target);
        if (target?.kind === kind && target.key === key) return;
        const handle = (await handles()).find(item => item.kind === kind && item.key === key), rect = await box();
        assert.ok(handle?.visible, kind + ' is visible');
        await page.mouse.click(rect.x + handle.x, rect.y + handle.y); await settle();
      }
      throw Error('Cannot select ' + kind);
    }
    const undo = async () => { await page.keyboard.press('Control+z'); await settle(); };
    const redo = async () => { await page.keyboard.press('Control+y'); await settle(); };
    async function swivel(chain, ending = 'commit', name = '') {
      await select('endpoint', chain.key); await select('bend', chain.key);
      assert.equal(await tool('Rotate').isEnabled(), true, 'Bend accepts the ordinary Rotate tool');
      await tool('Rotate').click();
      const before = await snap(), pose = samplePoseChain(before.model, chain, 500, 0), handle = (await handles()).find(item => item.kind === 'bend'), rect = await box();
      const nativeBefore = await page.evaluate(id => Array.from(poseProbe().runtime.native.rendererData.nodes[id].matrix), chain.root);
      const x = rect.x + handle.x, y = rect.y + handle.y;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 44, y, { steps: 8 }); await settle();
      assert.deepEqual(await snap(), before, 'drag preview is outside the document and history');
      const preview = await page.evaluate(id => ({ model: posePlain(poseProbe().runtime.native.model), rootMatrix: Array.from(poseProbe().runtime.native.rendererData.nodes[id].matrix), status: document.querySelector('.game-preview-root [role=status]')?.textContent }), chain.root);
      assert.notDeepEqual(preview.rootMatrix, nativeBefore, 'the renderer actually moves the limb');
      const posed = samplePoseChain(preview.model, chain, 500, 0);
      const measurement = { name, positionError: posed.end.distanceTo(pose.end), orientationError: 1 - Math.abs(posed.rotations[2].dot(pose.rotations[2])), middleMotion: posed.middle.distanceTo(pose.middle) };
      assert.ok(measurement.positionError < .004 && measurement.orientationError < 1e-6, JSON.stringify(measurement));
      assert.ok(measurement.middleMotion > .005, 'elbow or knee visibly turns');
      if (name) { await shot(name); results.measurements.push(measurement); }
      if (ending === 'cancel') await page.keyboard.press('Escape');
      if (ending === 'return') { await page.mouse.move(x, y, { steps: 8 }); await settle(); }
      await page.mouse.up(); await settle();
      const after = await snap();
      if (ending !== 'commit') assert.deepEqual(after, before, ending + ' leaves no keys or history');
      else { assert.equal(after.undo, before.undo + 1); assertModelEquivalent(after.model, preview.model); }
      return { before, after };
    }
    await page.getByLabel('Movement bone or node').selectOption(''); await settle();
    const initial = await snap(), width = await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width);
    const details = page.locator('.movement-object-details');
    assert.equal(await details.evaluate(el => el.open), false);
    await details.locator('summary').click(); assert.equal(await details.evaluate(el => el.open), true); await details.locator('summary').click();
    await tool('Rotate').click(); await page.getByRole('button', { name: 'POSE', exact: true }).click(); await settle();
    assert.equal(await page.getByRole('button', { name: 'POSE', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await tool('Move').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('dialog', { name: 'POSE setup', exact: true }).count(), 0);
    assert.equal(await page.getByLabel('X coordinate', { exact: true }).count(), 0, 'no disabled numeric filler with no native selection');
    assert.equal(await page.locator('.binding-panel').count(), 0, 'no empty Connected Bones list in Movement');
    assert.equal(await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width), width);
    assert.deepEqual(await snap(), initial); await shot('01-compact-default');
    results.checks.push('POSE starts in Move, no setup gate, compact default, expandable statistics, unchanged sidebar width, no keys');
    const chains = await page.evaluate(() => poseProbe().props.poseConfig.chains), limbs = [chains.find(chain => chain.kind === 'arm'), chains.find(chain => chain.kind === 'leg')];
    for (let view = 0; view < 3; view++) {
      for (const chain of limbs) {
        const result = await swivel(chain, 'commit', `02-${chain.kind}-view-${view}`);
        await undo(); assertModelEquivalent((await snap()).model, result.before.model);
        await redo(); assertModelEquivalent((await snap()).model, result.after.model);
        await undo(); assertModelEquivalent((await snap()).model, result.before.model);
      }
      const before = await page.evaluate(() => poseProbe().runtime.controls.object.quaternion.toArray()), rect = await box();
      await page.keyboard.down('Alt'); await page.mouse.move(rect.x + 80, rect.y + 90); await page.mouse.down(); await page.mouse.move(rect.x + 145, rect.y + 115, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle();
      const after = await page.evaluate(() => poseProbe().runtime.controls.object.quaternion.toArray());
      assert.notDeepEqual(after, before, 'normal Alt + mouse rotates the camera');
    }
    results.checks.push('Arm and leg swivel at three mouse-rotated views: fixed endpoints, native renderer movement, atomic Undo/Redo');
    await swivel(limbs[0], 'cancel'); await swivel(limbs[1], 'return');
    results.checks.push('Escape and returning to the initial grip leave no native edit or history entry');
    await select('endpoint', limbs[1].key);
    await page.getByRole('button', { name: 'Pin selected foot', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-pose-pin]')?.getAttribute('aria-pressed') === 'true');
    assert.equal(await page.getByRole('button', { name: 'Pin selected foot', exact: true }).getAttribute('aria-pressed'), 'true');
    const pinned = await swivel(limbs[1]); await undo(); assertModelEquivalent((await snap()).model, pinned.before.model);
    results.checks.push('A pinned foot can swivel its knee without releasing or moving the pin');
    // Native Undo also restores selection. Select the knee again before
    // checking restrictions on its rotation-driven Move gesture.
    await select('endpoint', limbs[1].key); await select('bend', limbs[1].key);
    const restrictions = page.locator('details.sidebar-section').filter({ has: page.locator('summary', { hasText: /^Restrictions$/ }) });
    await restrictions.locator('summary').click(); await page.getByRole('checkbox', { name: 'Rotation', exact: true }).check();
    await page.waitForFunction(() => poseProbe().props.restrictions.rotation);
    assert.equal(await tool('Rotate').isEnabled(), false); assert.equal(await tool('Move').isEnabled(), false);
    await page.getByRole('checkbox', { name: 'Rotation', exact: true }).uncheck(); await restrictions.locator('summary').click();
    results.checks.push('Existing Rotation restrictions still apply to both bend gestures');
    const edited = await swivel(limbs[0]);
    const dest = path.join(out, 'swivel-posed.mdx');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, dest);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'saveAs'));
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).click(); await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
    assertModelEquivalent(openDocument(fs.readFileSync(dest)).model, edited.after.model);
    await shot('03-saved-pose');
    results.checks.push('Packaged Save As writes the same native pose; MDX reparses with equivalent model contents');
    await page.getByRole('button', { name: 'POSE', exact: true }).click(); await settle();
    assert.equal(await page.getByLabel('X coordinate', { exact: true }).count(), 1);
    await page.locator('.model-tab.active .model-tab-close').click(); await settle();
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, dest);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'open')); await settle();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'animation'));
    await page.getByLabel('Movement current sequence').selectOption('0'); await time.fill('500'); await time.press('Enter'); await settle();
    assertModelEquivalent((await snap()).model, edited.after.model); await shot('04-reopened-pose');
    results.checks.push('The saved pose reopens in the packaged editor at its edited frame with equivalent model contents');
    assert.equal(hash(fixture), results.sourceHash); assert.deepEqual(errors, []);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false, 'test never displays a window');
    results.checks.push('Ordinary Movement coordinates remain available; source file unchanged; window stayed hidden; no renderer errors');
    results.errors = errors; fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(out, 'failure.png'), Buffer.from(png, 'base64')); throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
