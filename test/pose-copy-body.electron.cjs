// Isolated packaged acceptance for pose clipboard and limb-led body movement.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { ObjectLoader, Vector3 } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { allNodes } = await import('../src/animation.js');
  const { sampleMovement } = await import('../src/movement.js');
  const { poseChainIds, samplePoseChain } = await import('../src/pose-ik.js');
  const out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-copy-ui');
  const fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/pose-copy-package/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile-' + Date.now());
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const fixtureHash = digest(fixture), errors = [], result = { fixture, fixtureHash, executablePath, checks: [], measurements: [] };
  const app = await _electron.launch({ executablePath, args: [fixture, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); win.hide(); });
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    const time = page.getByLabel('Current animation frame');
    const seek = async frame => { await time.fill(String(frame)); await time.press('Enter'); await page.waitForTimeout(150); };
    await seek(500); await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
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
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { model: poseSnapshot().model, config: props.poseConfig, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, 500, 0, camera, data.width, data.height);
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
    for (const kind of ['arm', 'leg']) {
      const chain = config.chains.find(chain => chain.kind === kind);
      await select(chain); await tool('Move'); await settle();
      const handle = (await handles()).find(item => item.kind === 'endpoint' && item.key === chain.key), box = await canvas.boundingBox(), before = await snap();
      const beforePose = samplePoseChain(before.model, chain, 500, 0);
      await page.mouse.move(box.x + handle.x, box.y + handle.y); await page.mouse.down();
      await page.mouse.move(box.x + handle.x + 12, box.y + handle.y - 8, { steps: 6 }); await settle();
      assert.deepEqual(await snap(), before, 'drag preview is isolated');
      await page.mouse.up(); await settle();
      const after = await snap(), afterPose = samplePoseChain(after.model, chain, 500, 0), jointIds = new Set(poseChainIds(chain));
      assert.equal(after.undo, before.undo + 1, 'one limb/body gesture is one Undo');
      assert.ok(afterPose.end.distanceTo(beforePose.end) > .001, 'endpoint moves');
      const oldNodes = new Map(allNodes(before.model).map(node => [node.ObjectId, node]));
      const bodyChanges = allNodes(after.model).filter(node => !jointIds.has(node.ObjectId) && ['Translation', 'Rotation'].some(property => JSON.stringify(node[property]) !== JSON.stringify(oldNodes.get(node.ObjectId)[property])));
      assert.ok(bodyChanges.length > 0, 'limb leads a connected body part');
      beforePose.lengths.forEach((length, i) => assert.ok(Math.abs(length - afterPose.lengths[i]) < .006, 'limb does not stretch'));
      result.measurements.push({ kind, bodyChanges: bodyChanges.map(node => node.ObjectId), endpointDistance: afterPose.end.distanceTo(beforePose.end) });
      result.checks.push(kind + ' mouse drag leads body, keeps lengths and commits one Undo');
    }
    await seek(513);
    const copied = await snap();
    await canvas.focus(); await page.keyboard.press('Control+c'); await settle();
    assert.deepEqual(await snap(), copied, 'copy adds no history');
    await seek(700); await page.getByLabel('Movement bone or node').selectOption(String(config.body)); await tool('Scale');
    const controller = page.locator('details.sidebar-section').filter({ has: page.locator('summary', { hasText: /^Controller$/ }) });
    if (!await controller.evaluate(element => element.open)) await controller.locator('summary').click();
    await page.getByRole('checkbox', { name: 'Highlight KF', exact: true }).check();
    const beforePaste = await snap(); await canvas.focus(); await page.keyboard.press('Control+v'); await settle();
    const pasted = await snap(); assert.equal(pasted.undo, beforePaste.undo + 1, 'whole paste is one Undo');
    const assertPose = (model, frame, sequence) => {
      for (const node of allNodes(copied.model)) for (const property of ['Translation', 'Rotation', 'Scaling']) {
        if (Number.isInteger(node[property]?.GlobalSeqId) && node[property].GlobalSeqId >= 0) continue;
        const target = allNodes(model).find(item => item.ObjectId === node.ObjectId), expected = sampleMovement(copied.model, node, property, 513, 0), actual = sampleMovement(model, target, property, frame, sequence);
        assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) < .00001), `${node.ObjectId} ${property} restores full pose`);
      }
    };
    assertPose(pasted.model, 700, 0);
    await page.keyboard.press('Control+z'); await settle(); assert.deepEqual((await snap()).model, beforePaste.model);
    await page.keyboard.press('Control+y'); await settle(); assertPose((await snap()).model, 700, 0);
    result.checks.push('Ctrl+C samples between keys; Ctrl+V restores whole pose despite tool/selection/Highlight KF changes; Undo/Redo atomic');
    await page.getByLabel('Movement current sequence').selectOption('1');
    const interval = copied.model.Sequences[1].Interval, destination = Math.round((interval[0] + interval[1]) / 2);
    await seek(destination); await canvas.focus(); await page.keyboard.press('Control+v'); await settle(); assertPose((await snap()).model, destination, 1);
    result.checks.push('whole pose pastes into another animation');
    const rotationBefore = await page.evaluate(() => poseProbe().runtime.controls.object.position.toArray());
    const box = await canvas.boundingBox(); await page.keyboard.down('Alt'); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .3); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7 + 70, box.y + box.height * .3 + 25, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle();
    const rotationAfter = await page.evaluate(() => poseProbe().runtime.controls.object.position.toArray());
    assert.ok(new Vector3(...rotationBefore).distanceTo(new Vector3(...rotationAfter)) > .01, 'normal Alt+mouse camera rotation works');
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), width);
    assert.equal(await page.getByRole('dialog', { name: 'POSE setup' }).count(), 0);
    result.checks.push('actual mouse camera rotation and unchanged compact sidebar');
    assert.equal(digest(fixture), fixtureHash); assert.deepEqual(errors, []);
    await app.evaluate(async ({ BrowserWindow }) => { await BrowserWindow.getAllWindows()[0].webContents.capturePage(); }); await settle();
    const screenshot = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(out, 'pose-copy-body.png'), Buffer.from(screenshot, 'base64'));
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false, 'acceptance never displays a window');
    result.errors = errors; fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.errors = errors; result.failure = error.stack; fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify(result, null, 2)); throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
