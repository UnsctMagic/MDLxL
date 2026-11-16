// Disposable mouse acceptance for Movement's Motion path tick: the curve a hand draws through
// Attack, in plain Movement and in POSE, following real mouse drags live. Never opens a user profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { appTarget, bundleHashes, launchApp, closeApp, settle: settlePage, sha256File: hash } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const { ObjectLoader, Matrix4 } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { movementAxisHandles, projectMovementNodes } = await import('../app/movement-overlay.js');
  const { openDocument } = await import('../src/editor-document.js');
  const out = path.resolve(process.env.MDLXL_MOTION_PATH_OUT || 'out/motion-path'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || fixturePath('footman'));
  fs.mkdirSync(out, { recursive: true });
  const sourceModel = openDocument(fs.readFileSync(fixture)).model;
  const sequence = sourceModel.Sequences.findIndex(item => /^attack - 1$/i.test(item.Name)), frame = sourceModel.Sequences[sequence].Interval[0] + 300;
  const HAND = [...sourceModel.Bones, ...(sourceModel.Helpers || [])].find(node => /^bone_hand_r$/i.test(node.Name)).ObjectId;
  const { executablePath } = appTarget(), errors = [], results = { fixture, fixtureHash: hash(fixture), executablePath, executableHash: hash(executablePath), bundle: bundleHashes(), checks: [] };
  const { app, page } = await launchApp({ fixture, out, profile: path.join(out, 'profile-' + Date.now()), errors });
  try {
    await page.locator('[data-hotkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption(String(sequence));
    const time = page.getByLabel('Current animation frame'); await time.fill(String(frame)); await time.press('Enter');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.evaluate(() => { window.pathProbe = () => { const { runtime, props, session } = mdlxlProbe(); if (!runtime || !props || !session) throw Error('Movement not ready'); return { runtime, props, session }; }; });
    await page.waitForFunction(() => { try { return !!pathProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const settle = () => settlePage(page, 200);
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const viewportBox = () => page.locator('[data-clean-model-canvas]').boundingBox();
    const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
    // The orange curve on the path layer: how many pixels, and where they sit on average.
    const curve = () => page.evaluate(() => {
      const canvas = document.querySelector('[data-path-overlay]'); if (!canvas) return null;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let count = 0, x = 0, y = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 100 && pixels[i] > 200 && pixels[i + 1] > 100 && pixels[i + 1] < 180 && pixels[i + 2] < 90) { const at = i / 4; count++; x += at % canvas.width; y += Math.floor(at / canvas.width); }
      return count ? { count, x: x / count, y: y / count } : { count: 0 };
    });
    const moved = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > 1.5 || Math.abs(a.count - b.count) > 20;
    const camera = async () => { const data = await page.evaluate(() => { const { runtime, props } = pathProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, config: props.poseConfig, radius: runtime.captureApi.showcaseView().radius, matrices: (runtime.native.rendererData.nodes || []).flatMap((n, i) => n?.matrix ? [[i, Array.from(n.matrix)]] : []) }; }); const cam = new ObjectLoader().parse(data.camera); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); return { ...data, cam }; };
    const toggle = page.getByLabel('Motion path', { exact: true });
    await page.getByLabel('Workplane Constraints', { exact: true }).uncheck();

    // Off by default; ticking it with nothing selected draws nothing.
    assert.equal(await toggle.isChecked(), false, 'Motion path starts off');
    await page.getByLabel('Movement bone or node').selectOption(String(HAND)); await settle();
    assert.equal(await curve(), null, 'no curve while the tick is off');
    await toggle.check(); await settle();
    const start = await curve(); assert.ok(start?.count > 60, 'the selected hand draws its curve: ' + JSON.stringify(start));
    await shot('1-fk-curve'); results.checks.push('tick draws the selected hand curve');

    // Plain Movement: a real Move-arrow drag on the hand changes the curve while the mouse is still down.
    await tool('Move'); await settle();
    {
      const data = await camera(), active = projectMovementNodes(sourceModel, data.frame, data.sequence, data.cam, data.width, data.height, data.frame, new Map(data.matrices.map(([i, m]) => [i, new Matrix4().fromArray(m)]))).find(point => point.node.ObjectId === HAND);
      const arrow = movementAxisHandles(active, data.cam, data.width, data.height, data.radius, 'world', 'move', []).find(handle => ['X', 'Y', 'Z'].includes(handle.axis) && Math.hypot(handle.dx, handle.dy) > 25);
      assert.ok(arrow, 'a Move arrow on screen');
      const box = await viewportBox(), from = { x: box.x + arrow.startX + arrow.dx * .8, y: box.y + arrow.startY + arrow.dy * .8 }, unit = Math.hypot(arrow.dx, arrow.dy);
      await page.mouse.move(from.x, from.y); await settle(); await page.mouse.down();
      await page.mouse.move(from.x + arrow.dx / unit * 60, from.y + arrow.dy / unit * 60, { steps: 12 }); await settle();
      const during = await curve(); assert.ok(moved(start, during), 'the curve follows the drag before release: ' + JSON.stringify({ start, during }));
      await shot('2-fk-during-drag');
      await page.mouse.up(); await settle();
      const after = await curve(); assert.ok(moved(start, after), 'the committed curve stays moved');
      await page.keyboard.press('Control+z'); await settle();
      const undone = await curve(); assert.ok(!moved(start, undone), 'undo brings the curve back: ' + JSON.stringify({ start, undone }));
      results.checks.push('Movement Move drag updates the curve live; undo restores it');
    }

    // POSE: pick the hand handle; its curve follows a real limb drag live.
    await page.getByRole('button', { name: 'POSE', exact: true }).click(); await settle(); await tool('Select');
    {
      const handleFor = async () => { const data = await camera(); return projectPoseHandles(sourceModel, data.config, data.frame, data.sequence, data.cam, data.width, data.height).find(handle => !handle.marker && handle.kind === 'endpoint' && handle.chain?.end === HAND); };
      let handle = await handleFor(), box = await viewportBox();
      assert.ok(handle?.visible, 'hand handle on screen');
      for (let i = 0; i < 30 && (await page.evaluate(() => pathProbe().props.poseConfig.target?.kind)) !== 'endpoint'; i++) { await page.mouse.click(box.x + handle.x, box.y + handle.y); await settle(); }
      assert.equal(await page.evaluate(() => pathProbe().props.poseConfig.target?.kind), 'endpoint', 'hand handle picked');
      const before = await curve(); assert.ok(before?.count > 60, 'the picked POSE hand draws its curve');
      await tool('Move'); await settle(); handle = await handleFor(); box = await viewportBox();
      await page.mouse.move(box.x + handle.x, box.y + handle.y); await settle(); await page.mouse.down();
      await page.mouse.move(box.x + handle.x + 45, box.y + handle.y - 35, { steps: 12 }); await settle();
      const during = await curve(); assert.ok(moved(before, during), 'the POSE curve follows the limb drag before release: ' + JSON.stringify({ before, during }));
      await shot('3-pose-during-drag');
      await page.mouse.up(); await settle();
      results.checks.push('POSE hand drag updates the curve live');
    }

    await toggle.uncheck(); await settle();
    assert.equal(await curve(), null, 'untick removes the curve');
    results.checks.push('untick removes the curve');
    assert.deepEqual(errors, [], 'no page errors');
    results.passed = true;
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...results, errors }, null, 2));
    await closeApp(app);
  }
  console.log('motion path:', results.checks.join('; '));
})().catch(error => { console.error(error); process.exitCode = 1; });
