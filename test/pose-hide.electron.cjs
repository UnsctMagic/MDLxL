// Disposable packaged mouse acceptance for hiding and revealing POSE handles. Never opens or replaces a user profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { appTarget, bundleHashes, launchApp, closeApp, sha256File: hash } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { samplePoseChain } = await import('../src/pose-ik.js');
  const out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-hide'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || fixturePath('footman'));
  const { executablePath } = appTarget();
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(path.dirname(fixture), 'Textures'), path.join(out, 'Textures'), { recursive: true });
  const results = { fixture, fixtureHash: hash(fixture), executablePath, executableHash: hash(executablePath), checks: [] };
  results.bundle = bundleHashes();
  const { app, page, errors } = await launchApp({ fixture, out });
  try {
    await page.locator('[data-hotkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption('0');
    const time = page.getByLabel('Current animation frame'); await time.fill('500'); await time.press('Enter');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.evaluate(() => {
      window.poseProbe = () => {
        const { runtime, props, session } = mdlxlProbe(); // test/helpers/fiber-probe.cjs
        if (!runtime || !props || !session) throw Error('Packaged Movement owners not ready');
        return { runtime, props, session };
      };
      window.poseSnapshot = () => { const { session } = poseProbe(); return { revision: session.doc.revision, undo: session.doc._historyStore.undoEntries.filter(entry => entry.changes.length).length, dirty: session.doc.dirty, model: JSON.parse(JSON.stringify(session.doc.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)) }; };
    });
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const snap = () => page.evaluate(() => poseSnapshot());
    const settle = () => page.waitForTimeout(220);
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
    const menu = command => app.evaluate(({ BrowserWindow }, command) => BrowserWindow.getAllWindows()[0].webContents.send('menu', command), command);
    const viewportBox = () => page.locator('[data-clean-model-canvas]').boundingBox();
    const config = () => page.evaluate(() => poseProbe().props.poseConfig);
    const historyDepth = () => page.evaluate(() => poseProbe().session.doc.historyStats.undoSteps);
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { model: poseSnapshot().model, config: props.poseConfig, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight, mode: props.transformMode }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, data.frame, data.sequence, camera, data.width, data.height, undefined, undefined, undefined, data.mode);
    }
    async function handleFor(kind, endpoint) { const points = await handles(); const result = points.find(handle => !handle.marker && handle.kind === kind && (endpoint == null || (kind === 'node' ? handle.id : handle.chain?.end) === endpoint)); assert.ok(result?.visible, `Visible ${kind} ${endpoint}`); return result; }
    async function selectHandle(kind, endpoint) {
      const depth = await historyDepth(); await tool('Select'); const h = await handleFor(kind, endpoint), b = await viewportBox();
      for (let i = 0; i < 45; i++) {
        const target = await page.evaluate(() => poseProbe().props.poseConfig.target);
        if (target?.kind === kind && !target.marker && (kind === 'node' ? target.id === h.id : !h.key || target.key === h.key)) { assert.equal(await historyDepth(), depth); return; }
        await page.mouse.click(b.x + h.x, b.y + h.y); await settle();
      }
      throw Error('Cannot select ' + kind + ' ' + endpoint);
    }
    const rect = selector => page.locator(selector).first().boundingBox();
    const revealButtons = () => page.locator('[data-pose-reveal]');
    const contextItems = () => page.locator('.classic-context').evaluateAll(menus => menus.map(menu => [...menu.querySelectorAll('button')].map(button => button.textContent.trim())));
    const cameraState = () => page.evaluate(() => { const { controls } = poseProbe().runtime; return { target: controls.target.toArray(), position: controls.object.position.toArray(), quaternion: controls.object.quaternion.toArray() }; });
    const FOOT = 'limb:29'; let HAND;

    await page.getByRole('button', { name: 'POSE', exact: true }).click(); await settle();
    const recognized = await config();
    assert.deepEqual(recognized.chains.map(chain => chain.end).sort((a, b) => a - b), [29, 32, 38, 42]);
    assert.ok(!recognized.hidden?.length, 'nothing is hidden at first');
    assert.equal(await revealButtons().count(), 0, 'no reveal strip while nothing is hidden');
    await tool('Select');

    // (a) A right-button drag across empty viewport still pans the camera and opens no menu.
    {
      const b = await viewportBox(), all = await handles();
      const spot = [[.1, .88], [.9, .88], [.1, .12], [.9, .12]].map(([fx, fy]) => ({ x: b.x + b.width * fx, y: b.y + b.height * fy })).find(point => all.every(h => !h.visible || Math.hypot(point.x - b.x - h.x, point.y - b.y - h.y) > 70));
      assert.ok(spot, 'a point far from every handle');
      const before = await cameraState();
      await page.mouse.move(spot.x, spot.y); await page.mouse.down({ button: 'right' }); await page.mouse.move(spot.x + 60, spot.y + 15, { steps: 10 }); await page.mouse.up({ button: 'right' }); await settle();
      assert.notDeepEqual((await cameraState()).target, before.target, 'a right drag pans the camera');
      assert.equal(await page.locator('.classic-context').count(), 0, 'a right drag opens no menu');
      const empty = (await handles()).every(h => !h.visible || Math.hypot(spot.x + 60 - b.x - h.x, spot.y + 15 - b.y - h.y) > 70);
      if (empty) { await page.mouse.click(spot.x + 60, spot.y + 15, { button: 'right' }); await settle(); assert.equal(await page.locator('.classic-context').count(), 0, 'a right click on empty viewport opens no menu'); }
      results.checks.push('(a) right drag pans the camera, no menu');
    }

    // (b) Right-click a foot: one-item menu; Hide hides it and shows one reveal button next to the sidebar.
    await selectHandle('endpoint', 29);
    await page.getByRole('button', { name: 'Pin selected foot', exact: true }).click(); await settle();
    assert.deepEqual((await config()).pins, [FOOT]);
    assert.equal(await page.locator('[data-pose-pin]').count(), 1);
    const beforeHide = await snap(), depthBefore = await historyDepth(), footBefore = await handleFor('endpoint', 29);
    {
      const b = await viewportBox();
      await page.mouse.click(b.x + footBefore.x, b.y + footBefore.y, { button: 'right' }); await settle();
      assert.deepEqual(await contextItems(), [['Hide']], 'one menu with the single item Hide');
      await shot('01-menu');
      await page.locator('.classic-context').getByRole('menuitem', { name: 'Hide', exact: true }).click(); await settle();
      assert.equal(await page.locator('.classic-context').count(), 0, 'the menu closes');
      var afterHide = await snap(), depthAfterHide = await historyDepth();
      assert.deepEqual((await config()).hidden, [FOOT], 'the handle is flagged hidden');
      assert.equal((await handles()).find(h => h.kind === 'endpoint' && h.key === FOOT).hidden, true);
      assert.equal(await page.locator('[data-pose-pin]').count(), 0, 'no Pin button is left floating');
      assert.equal((await config()).target, null, 'the selection is cleared');
      await page.mouse.click(b.x + footBefore.x, b.y + footBefore.y); await settle();
      assert.notEqual((await config()).target?.key, FOOT, 'a left click at the old position does not select it');
      assert.equal(await revealButtons().count(), 1, 'exactly one reveal button');
      const reveal = await revealButtons().first().boundingBox(), sidebar = await rect('.classic-sidebar'), pose = await rect('button[aria-label="POSE"]');
      const gap = sidebar.x - (reveal.x + reveal.width);
      assert.ok(gap >= 0 && gap <= 16, `reveal button sits within 16 px left of the sidebar (gap ${gap})`);
      const overlap = Math.min(reveal.y + reveal.height, pose.y + pose.height) - Math.max(reveal.y, pose.y);
      assert.ok(overlap >= reveal.height / 2, `reveal button is on the POSE button row (overlap ${overlap} of ${reveal.height})`);
      assert.equal(await revealButtons().first().getAttribute('aria-label'), 'Show Foot');
      assert.equal(await revealButtons().first().getAttribute('title'), 'Show Foot');
      results.measurements = { gap, overlap, reveal, pose };
      await shot('02-hidden');
      results.checks.push('(b) right click opens Hide; Hide hides, clears selection and Pin, one reveal button beside the sidebar on the POSE row');
    }

    // (c) Hiding is not an edit.
    {
      const after = afterHide;
      assert.equal(after.undo, beforeHide.undo, 'no Undo step'); assert.equal(depthAfterHide, depthBefore, 'no history entry of any kind');
      assert.equal(after.dirty, beforeHide.dirty, 'the model is not marked changed'); assert.equal(after.revision, beforeHide.revision);
      assert.deepEqual(after.model, beforeHide.model, 'model data unchanged');
      results.checks.push('(c) no Undo step, not dirty');
    }

    // (d) A hidden pinned foot still compensates when the body moves.
    {
      const feetBefore = await snap(), poseBefore = samplePoseChain(feetBefore.model, (await config()).chains.find(c => c.key === FOOT), 500, 0);
      await selectHandle('body'); await tool('Move');
      const body = await handleFor('body'), b = await viewportBox(), x = b.x + body.x, y = b.y + body.y, undoBefore = await historyDepth();
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 6, { steps: 8 }); await settle(); await page.mouse.up(); await settle();
      assert.equal(await historyDepth(), undoBefore + 1, 'the body drag is one Undo step');
      const after = await snap(), poseAfter = samplePoseChain(after.model, (await config()).chains.find(c => c.key === FOOT), 500, 0);
      assert.ok(after.revision > feetBefore.revision, 'the body moved');
      const error = poseAfter.end.distanceTo(poseBefore.end);
      assert.ok(error < .004, `the hidden foot stays where it was (${error})`);
      assert.deepEqual((await config()).hidden, [FOOT], 'still hidden');
      await menu('undo'); await settle();
      assert.deepEqual((await snap()).model, feetBefore.model, 'Undo restores the model');
      results.checks.push('(d) hidden pinned foot compensates, error ' + error);
    }

    // (e) A second hidden handle accumulates to the left of the first, on the same row.
    {
      await tool('Select');
      const all = await handles(), hands = all.filter(h => h.kind === 'endpoint' && [38, 42].includes(h.chain.end) && h.visible), clear = h => Math.min(...all.filter(o => o !== h && o.visible && !o.quiet).map(o => Math.hypot(o.x - h.x, o.y - h.y)));
      const hand = hands.sort((a, c) => clear(c) - clear(a))[0], b = await viewportBox(); HAND = hand.key;
      await page.mouse.click(b.x + hand.x, b.y + hand.y, { button: 'right' }); await settle();
      assert.deepEqual(await contextItems(), [['Hide']]);
      await page.locator('.classic-context').getByRole('menuitem', { name: 'Hide', exact: true }).click(); await settle();
      assert.deepEqual((await config()).hidden, [FOOT, HAND], 'hidden handles keep the order they were hidden in');
      assert.equal(await revealButtons().count(), 2);
      const first = await page.locator(`[data-pose-reveal="${FOOT}"]`).boundingBox(), second = await page.locator(`[data-pose-reveal="${HAND}"]`).boundingBox();
      assert.ok(second.x + second.width <= first.x, 'the second button is left of the first');
      assert.ok(Math.abs(second.y - first.y) <= 1, 'same row');
      await shot('03-two-hidden');
      results.checks.push('(e) two reveal buttons accumulate leftwards on one row');
    }

    // (f) Revealing brings the handle back exactly as before.
    {
      await page.locator(`[data-pose-reveal="${FOOT}"]`).click(); await settle();
      assert.deepEqual((await config()).hidden, [HAND]);
      assert.equal(await revealButtons().count(), 1);
      const foot = await handleFor('endpoint', 29), b = await viewportBox();
      assert.ok(!foot.hidden);
      assert.ok(Math.hypot(foot.x - footBefore.x, foot.y - footBefore.y) < 40, 'the foot handle is back');
      await tool('Select'); await page.mouse.click(b.x + foot.x, b.y + foot.y); await settle();
      assert.equal((await config()).target?.key, FOOT, 'a real left click selects it');
      assert.deepEqual((await config()).pins, [FOOT], 'its pin was kept');
      await shot('04-revealed');
      const final = await snap(); assert.equal(final.undo, beforeHide.undo, 'no edit step from hiding or revealing');
      results.checks.push('(f) reveal restores the handle, left click selects it, one button remains');
    }

    // (g) Alt + left drag still rotates the camera.
    {
      const before = await cameraState(), b = await viewportBox();
      await page.keyboard.down('Alt'); await page.mouse.move(b.x + 80, b.y + 90); await page.mouse.down(); await page.mouse.move(b.x + 145, b.y + 115, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle();
      assert.notDeepEqual((await cameraState()).quaternion, before.quaternion, 'Alt + mouse rotates the camera');
      results.checks.push('(g) Alt + left drag rotates the camera');
    }

    assert.deepEqual(errors, []); results.errors = errors; fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
  } catch (error) { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); throw error; }
  finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
