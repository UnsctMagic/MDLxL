// Packaged Motion workflow. Uses only disposable models/profile/output.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { openDocument } = await import('../src/editor-document.js');
  const { assertModelEquivalent } = await import('../src/save-equivalence.js');
  const { preparePoseMotion, buildPoseMotion, applyPoseMotion } = await import('../src/pose-motion.js');
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const fixture = path.resolve(process.env.MDLXL_MOTION_FIXTURE || 'out/motion-study-originals/peon/peon-attack-even-sparse.mdx');
  const exe = path.resolve(process.env.MDLXL_MOTION_EXE || 'out/motion-review-package/MDLxL-win32-x64/MDLxL.exe');
  const out = path.resolve(process.env.MDLXL_MOTION_OUT || 'out/motion-ui'); fs.mkdirSync(out, { recursive: true });
  const source = fs.readFileSync(fixture), errors = [], checks = [];
  const plain = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const app = await _electron.launch({ executablePath: exe, args: [fixture, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message)); page.on('crash', () => errors.push('Renderer crashed'));
    app.process().stderr?.on('data', data => fs.appendFileSync(path.join(out, 'electron-stderr.log'), data));
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); w.showInactive(); w.webContents.setBackgroundThrottling(false); });
    const menu = action => app.evaluate(({ BrowserWindow }, command) => BrowserWindow.getAllWindows()[0].webContents.send('menu', command), action);
    const settle = () => page.waitForTimeout(120), dialog = page.getByRole('dialog', { name: 'POSE Motion', exact: true });
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await page.getByLabel('View direction', { exact: true }).selectOption('front');
    await page.getByRole('button', { name: 'POSE', exact: true }).click();
    await page.evaluate(() => {
      window.motionProbe = () => {
        let session, motion;
        const views = Array.from(document.querySelectorAll('.game-preview-root'), root => {
          let runtime, props;
          for (let f = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))]; f; f = f.return) for (let h = f.memoizedState; h; h = h.next) {
            const state = h.memoizedState, ref = state?.current;
            if (ref?.native && ref?.controls) runtime = ref;
            if (ref?.model?.Geosets && ref?.sequenceIndex != null) props = ref;
            if (ref?.variants && ref?.editing) motion = ref;
            if (state?.doc?.model && state?.assets) session = state;
          }
          return { runtime, props };
        });
        return { session, motion, views };
      };
      window.motionSnapshot = () => { const { session } = motionProbe(); return { model: JSON.parse(JSON.stringify(session.doc.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)), undo: session.doc.historyStats.undoSteps, dirty: session.doc.dirty }; };
    });
    await page.waitForFunction(() => motionProbe().session && motionProbe().views[0]?.runtime?.captureApi?.isReady);
    const snap = () => page.evaluate(() => motionSnapshot()), motion = () => page.evaluate(() => motionProbe().motion);
    const ready = async () => { await page.waitForFunction(() => motionProbe().motion && Object.values(motionProbe().motion.variants).every(v => !v.pending)); const value = await motion(); assert.equal(value.error, ''); return value; };
    const pause = async () => { const button = dialog.getByRole('button', { name: 'Pause', exact: true }); if (await button.count()) await button.click(); };
    const open = async () => { await page.getByRole('button', { name: 'Motion', exact: true }).click(); await ready(); await pause(); };
    const seek = async frame => { const field = page.getByLabel('Current animation frame'); await field.fill(String(frame)); await field.press('Enter'); await settle(); await page.evaluate(() => motionProbe().views.forEach(v => v.runtime.captureApi.captureFrame())); };
    const native = () => page.evaluate(() => motionProbe().views.map(v => v.runtime.native.rendererData.nodes.map(n => n?.matrix ? Array.from(n.matrix) : null)));
    const unchanged = async before => assert.deepEqual(await snap(), before, 'Preview must preserve document, dirty state and history');
    const screenshot = name => page.screenshot({ path: path.join(out, name + '.png') });
    const baseline = await snap(), interval = baseline.model.Sequences[0].Interval, at = ratio => Math.round(interval[0] + (interval[1] - interval[0]) * ratio);
    const width = await page.locator('.classic-sidebar').evaluate(e => e.getBoundingClientRect().width);

    await open(); assert.equal((await motion()).settings.style, 'flow'); assert.ok((await motion()).result.tracks.length); await unchanged(baseline);
    assert.equal(await page.getByRole('button', { name: 'Commit A', exact: true }).isEnabled(), true);
    assert.equal(await page.getByLabel('Weight part').count(), 0);
    const singleCamera = await page.evaluate(() => motionProbe().views[0].runtime.controls.object.position.toArray()), singleBox = await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.keyboard.down('Alt'); await page.mouse.move(singleBox.x + singleBox.width * .35, singleBox.y + singleBox.height * .8); await page.mouse.down(); await page.mouse.move(singleBox.x + singleBox.width * .35 + 48, singleBox.y + singleBox.height * .8 + 12, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Alt');
    assert.notDeepEqual(await page.evaluate(() => motionProbe().views[0].runtime.controls.object.position.toArray()), singleCamera, 'Single Motion view allows the normal Alt+drag camera rotation');
    await seek(at(.42)); const transformed = await native();
    await dialog.getByRole('button', { name: 'Original', exact: true }).click(); await settle(); await seek(at(.42)); const original = await native();
    assert.notDeepEqual(transformed, original, 'Original toggle changes the live native pose');
    await dialog.getByRole('button', { name: 'Original', exact: true }).click(); await seek(at(.42)); assert.deepEqual(await native(), transformed);
    await screenshot('01-single'); checks.push('Opens with no selected part, vertices or range; native preview, normal mouse camera rotation and Original toggle; document unchanged');
    await page.getByRole('slider', { name: 'Timing', exact: true }).fill('0'); await page.getByRole('slider', { name: 'Body response', exact: true }).fill('0'); await ready();
    assert.deepEqual((await motion()).result.tracks, [], 'All visible Flow controls at zero is a true no-op'); assert.equal(await page.getByRole('button', { name: 'Commit A', exact: true }).isDisabled(), true);
    await page.getByRole('slider', { name: 'Timing', exact: true }).fill('65'); await page.getByRole('slider', { name: 'Body response', exact: true }).fill('35'); await ready();

    await page.getByRole('button', { name: 'Edit B', exact: true }).click();
    const timing = page.getByRole('slider', { name: 'Timing', exact: true }); await timing.fill('20'); await timing.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    await ready(); let value = await motion(); assert.equal(value.variants.A.settings.timing, 65); assert.equal(value.variants.B.settings.timing, 30);
    const expectedB = buildPoseMotion(preparePoseMotion(baseline.model, value.config, value.sequence, value.range), value.variants.B.settings, {});
    assert.deepEqual(plain(value.variants.B.result), plain(expectedB), 'Worker keeps latest rapid slider request');
    await page.getByRole('button', { name: 'Edit A', exact: true }).click(); await page.getByRole('button', { name: 'Copy A → B', exact: true }).click(); await ready();
    value = await motion(); assert.deepEqual(value.variants.A.settings, value.variants.B.settings);
    await page.getByRole('button', { name: 'Edit B', exact: true }).click(); await timing.fill('25'); await ready();
    await page.getByRole('checkbox', { name: 'Side by side', exact: true }).check();
    await page.waitForFunction(() => motionProbe().views.length === 2 && motionProbe().views.every(v => v.runtime?.captureApi?.isReady));
    await unchanged(baseline);
    const visiblePictures = await Promise.all([0, 1].map(index => page.locator('[data-clean-model-canvas]').nth(index).screenshot()));
    await page.getByRole('checkbox', { name: 'Show all geosets', exact: true }).uncheck(); await page.locator('[data-warmkey="geosetsClear"]').click(); await settle();
    const hidden = await page.evaluate(() => motionProbe().views.map(v => Array.from(v.props.hiddenGeosets || [])));
    assert.deepEqual(hidden, [baseline.model.Geosets.map((_, index) => index), baseline.model.Geosets.map((_, index) => index)]);
    for (let index = 0; index < 2; index++) assert.notDeepEqual(await page.locator('[data-clean-model-canvas]').nth(index).screenshot(), visiblePictures[index], 'Hiding geometry changes both native preview images');
    await page.locator('[data-warmkey="geosetsAll"]').click(); await page.getByRole('checkbox', { name: 'Show all geosets', exact: true }).check(); await settle();
    const afterSelection = await snap(); assert.deepEqual(afterSelection.model, baseline.model); assert.equal(afterSelection.dirty, baseline.dirty);
    assert.equal(afterSelection.undo, baseline.undo + 2, 'Clear and All create only their two normal selection-history entries'); baseline.undo = afterSelection.undo;
    await page.getByLabel('Left preview animation').selectOption('A'); await page.getByLabel('Right preview animation').selectOption('B');
    await page.getByRole('button', { name: 'Edit A', exact: true }).click();
    assert.equal(await page.getByLabel('Left preview animation').inputValue(), 'A'); assert.equal(await page.getByLabel('Right preview animation').inputValue(), 'B');
    await page.getByRole('button', { name: 'Edit B', exact: true }).click(); assert.equal(await page.getByLabel('Left preview animation').inputValue(), 'A');
    for (const side of ['Left', 'Right']) {
      const before = await page.evaluate(() => motionProbe().views.map(v => v.runtime.controls.object.position.toArray()));
      const box = await page.getByLabel(side + ' motion preview', { exact: true }).locator('[data-clean-model-canvas]').boundingBox();
      await page.mouse.move(box.x + box.width * .4, box.y + box.height * .76); await page.mouse.down(); await page.mouse.move(box.x + box.width * .4 + 55, box.y + box.height * .76 + 12, { steps: 10 }); await page.mouse.up();
      const after = await page.evaluate(() => motionProbe().views.map(v => v.runtime.controls.object.position.toArray()));
      assert.notDeepEqual(after[0], before[0]); assert.ok(after[0].every((x, i) => Math.abs(x - after[1][i]) < 1e-6));
    }
    const rotatedCamera = await page.evaluate(() => motionProbe().views.map(v => v.runtime.controls.object.position.toArray()));
    for (const id of ['original', 'A', 'B']) {
      await page.getByLabel('Left preview animation').selectOption(id); await seek(at(.42));
      const result = await page.evaluate(() => motionProbe().views[0].props.weightPreview);
      assert.deepEqual(plain(result ?? null), id === 'original' ? null : plain((await motion()).variants[id].result));
      const retainedCamera = await page.evaluate(() => motionProbe().views.map(v => v.runtime.controls.object.position.toArray()));
      assert.ok(retainedCamera.every((xyz, pane) => xyz.every((value, axis) => Math.abs(value - rotatedCamera[pane][axis]) < 1e-6)), 'Variant changes and timeline seeks preserve the mouse-adjusted camera');
    }
    await page.getByLabel('Left preview animation').selectOption('A');
    const clockChecks = [];
    for (const speed of [25, 50, 100]) {
      await page.getByRole('button', { name: speed + '%', exact: true }).click(); await seek(interval[0]);
      await dialog.getByRole('button', { name: 'Play', exact: true }).click(); await page.waitForTimeout(260); await pause(); await settle();
      const clocks = await page.evaluate(() => motionProbe().views.map(v => ({ frame: v.runtime.native.getFrame(), requested: v.props.time, global: v.props.playbackGlobalTime })));
      assert.deepEqual(clocks[0], clocks[1]); assert.ok(clocks[0].frame > interval[0]); assert.ok(Math.abs(clocks[0].frame - clocks[0].requested) < .0001);
      assert.equal(await page.getByLabel('Playback speed percent').inputValue(), String(speed)); clockChecks.push({ speed, ...clocks[0] });
    }
    assert.equal(await page.locator('.classic-sidebar').evaluate(e => e.getBoundingClientRect().width), width); await unchanged(baseline); await screenshot('02-variants');
    checks.push('Independent A/B settings and latest worker requests; copying variants; selectors survive Edit changes; both previews respect hidden geometry; actual mouse rotates both linked cameras; 25/50/100% clocks synchronized');

    await page.getByRole('checkbox', { name: 'Side by side', exact: true }).uncheck(); await settle();
    await dialog.getByRole('button', { name: 'Swing', exact: true }).click(); await ready();
    await dialog.locator('summary').click(); await seek(at(.37)); await dialog.getByRole('button', { name: 'Keep pose at playhead', exact: true }).click(); await ready();
    assert.ok((await motion()).result.anchors.includes(at(.37)));
    await dialog.getByRole('button', { name: String(at(.37)), exact: true }).click(); assert.equal(await page.getByLabel('Current animation frame').inputValue(), String(at(.37)));
    await page.getByRole('button', { name: 'Remove kept pose ' + at(.37), exact: true }).click(); await ready(); assert.ok(!(await motion()).result.anchors.includes(at(.37)));
    await dialog.getByRole('button', { name: 'Automatic poses', exact: true }).click(); await ready(); assert.equal((await motion()).settings.anchors, undefined);
    await seek(at(.54)); await dialog.getByRole('button', { name: 'Pick hit pose', exact: true }).click(); await ready();
    assert.equal((await motion()).result.impact, at(.54)); assert.ok((await motion()).result.anchors.includes(at(.54))); assert.equal(await page.getByLabel('Motion hit pose').inputValue(), String(at(.54)));
    await page.getByLabel('Motion hit pose').selectOption(String(interval[0])); await ready(); assert.equal((await motion()).result.impact, interval[0]);
    await dialog.getByRole('button', { name: 'Auto hit', exact: true }).click(); await ready();
    await page.getByRole('checkbox', { name: 'Keep planted feet', exact: true }).uncheck(); await ready(); assert.equal((await motion()).settings.contacts, false);
    await dialog.locator('summary').click();
    for (const name of ['Timing', 'Follow-through', 'Body response']) await page.getByRole('slider', { name, exact: true }).fill('0');
    await ready(); assert.deepEqual((await motion()).result.tracks, []); assert.equal(await page.getByRole('button', { name: 'Commit B', exact: true }).isDisabled(), true); await unchanged(baseline);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await settle(); await unchanged(baseline);
    await open(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await unchanged(baseline);
    await open(); await page.getByLabel('Movement current sequence').selectOption('-1'); await dialog.waitFor({ state: 'hidden' }); await unchanged(baseline); await page.getByLabel('Movement current sequence').selectOption('0');
    await seek(at(.1)); const rangeField = page.getByLabel('Current animation frame'); await rangeField.fill(String(at(.9))); await rangeField.press('Shift+Enter'); await settle();
    await open(); assert.deepEqual((await motion()).range, [at(.1), at(.9)]); await dialog.locator('summary').click();
    await seek(at(.4)); await dialog.getByRole('button', { name: 'Keep pose at playhead', exact: true }).click(); await ready(); assert.ok((await motion()).settings.anchors);
    await dialog.getByRole('button', { name: 'Whole animation', exact: true }).click(); await ready(); assert.deepEqual((await motion()).range, interval); assert.equal((await motion()).settings.anchors, undefined);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await unchanged(baseline); await seek(interval[0]);
    checks.push('Kept-pose add/remove/seek/reset and explicit hit preserve chosen source pose; contacts setting; all-zero no-op; Cancel, Escape and sequence switch discard');

    await open(); await page.locator('summary').filter({ hasText: /^Restrictions$/ }).click();
    const rotation = page.getByRole('group', { name: 'Transform restrictions' }).getByRole('checkbox', { name: 'Rotation', exact: true });
    await rotation.check(); await page.waitForFunction(() => motionProbe().motion && !motionProbe().motion.pending && !!motionProbe().motion.error);
    assert.match((await motion()).error, /Rotation is restricted/); assert.equal(await page.getByRole('button', { name: 'Commit A', exact: true }).isDisabled(), true); await unchanged(baseline);
    await rotation.uncheck(); await ready(); await page.locator('summary').filter({ hasText: /^Restrictions$/ }).click();
    const saveAs = async file => {
      await app.evaluate(({ dialog }, target) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: target }); }, file);
      await menu('saveAs'); await page.getByRole('button', { name: 'Save MDX…', exact: true }).click(); await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' }); await settle();
    };
    const uncommitted = path.join(out, 'original-before-commit.mdx'); await saveAs(uncommitted); await dialog.waitFor({ state: 'hidden' });
    assertModelEquivalent(openDocument(fs.readFileSync(uncommitted)).model, baseline.model); await unchanged(baseline);
    checks.push('Transform restriction blocks commit visibly; Save As during preview writes original, never silently applies variant');

    await open(); await page.getByRole('button', { name: 'Edit B', exact: true }).click(); await timing.fill('80'); await ready();
    value = await motion(); const expected = structuredClone(baseline.model); applyPoseMotion(expected, value.result);
    await page.getByRole('button', { name: 'Commit B', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); await settle();
    const committed = await snap(); assert.equal(committed.undo, baseline.undo + 1); assert.equal(committed.dirty, true); assertModelEquivalent(committed.model, expected);
    assert.deepEqual(committed.model.Geosets, baseline.model.Geosets); assert.deepEqual(committed.model.Textures, baseline.model.Textures);
    await menu('undo'); await settle(); assertModelEquivalent((await snap()).model, baseline.model); await menu('redo'); await settle(); assertModelEquivalent((await snap()).model, committed.model);
    const saved = path.join(out, 'committed-motion.mdx'); await saveAs(saved); assertModelEquivalent(openDocument(fs.readFileSync(saved)).model, committed.model);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, saved); await menu('open'); await settle(); await menu('animation');
    await page.getByLabel('Movement current sequence').selectOption('0'); await seek(at(.45)); assertModelEquivalent((await snap()).model, committed.model);
    if (await page.getByRole('button', { name: 'POSE', exact: true }).getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'POSE', exact: true }).click();
    await page.getByLabel('View direction', { exact: true }).selectOption('front'); await page.getByRole('button', { name: 'Fit', exact: true }).click(); await settle();
    const data = await page.evaluate(() => { const { views } = motionProbe(), v = views[0], canvas = document.querySelector('[data-clean-model-canvas]'); return { model: motionSnapshot().model, config: v.props.poseConfig, camera: v.runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight, frame: v.runtime.native.getFrame(), sequence: v.props.sequenceIndex, appearance: v.props.preferences.viewportAppearance.controllers }; });
    const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const handle = projectPoseHandles(data.model, data.config, data.frame, data.sequence, camera, data.width, data.height, data.frame, undefined, data.appearance).find(h => h.visible && !h.quiet && h.kind === 'endpoint' && h.chain.kind === 'arm');
    assert.ok(handle); await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Move', exact: true }).click();
    const beforePose = await snap(), box = await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.mouse.move(box.x + handle.x, box.y + handle.y); await page.mouse.down(); await page.mouse.move(box.x + handle.x + 12, box.y + handle.y - 8, { steps: 8 }); await page.mouse.up(); await settle();
    assert.equal((await snap()).undo, beforePose.undo + 1, 'Normal POSE drag edits committed native keys'); assert.notDeepEqual((await snap()).model, beforePose.model);
    await menu('undo'); await settle(); assertModelEquivalent((await snap()).model, committed.model); await screenshot('03-native-edit');
    checks.push('Explicit Commit B writes selected native variant in one Undo/Redo step; geometry/textures preserved; Save As/reopen equivalent; normal POSE mouse editing still works');

    // Build a fresh animation through the user's actual POSE/clipboard workflow.
    await seek(interval[0]); await page.locator('[data-clean-model-canvas]').focus(); await page.keyboard.press('Control+c');
    await page.locator('[data-warmkey="animations"]').click(); await page.getByLabel('Animations toolbox').getByRole('button', { name: 'Create', exact: true }).click();
    const name = page.getByLabel('Animation sequence name'); await name.fill('Motion authored'); await name.press('Enter');
    await page.locator('[data-warmkey="animation"]').click(); await settle();
    const freshModel = (await snap()).model, freshIndex = freshModel.Sequences.length - 1, freshRange = freshModel.Sequences[freshIndex].Interval;
    assert.equal(freshModel.Sequences[freshIndex].Name, 'Motion authored');
    await page.getByLabel('Movement current sequence').selectOption(String(freshIndex));
    if (await page.getByRole('button', { name: 'POSE', exact: true }).getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'POSE', exact: true }).click();
    await seek(freshRange[0]); await page.locator('[data-clean-model-canvas]').focus(); await page.keyboard.press('Control+v'); await settle();
    await page.keyboard.press('Control+c');
    await seek(freshRange[1]); await page.locator('[data-clean-model-canvas]').focus(); await page.keyboard.press('Control+v'); await settle();
    await seek(Math.round((freshRange[0] + freshRange[1]) / 2));
    const middleData = await page.evaluate(() => { const v = motionProbe().views[0], c = document.querySelector('[data-clean-model-canvas]'); return { model: motionSnapshot().model, config: v.props.poseConfig, camera: v.runtime.controls.object.toJSON(), width: c.clientWidth, height: c.clientHeight, frame: v.runtime.native.getFrame(), sequence: v.props.sequenceIndex, appearance: v.props.preferences.viewportAppearance.controllers }; });
    const middleCamera = new ObjectLoader().parse(middleData.camera); middleCamera.updateProjectionMatrix(); middleCamera.updateMatrixWorld(true);
    const middleHandle = projectPoseHandles(middleData.model, middleData.config, middleData.frame, middleData.sequence, middleCamera, middleData.width, middleData.height, middleData.frame, undefined, middleData.appearance).find(h => h.visible && !h.quiet && h.kind === 'endpoint' && h.chain.kind === 'arm');
    assert.ok(middleHandle); const freshBox = await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Move', exact: true }).click();
    await page.mouse.move(freshBox.x + middleHandle.x, freshBox.y + middleHandle.y); await page.mouse.down(); await page.mouse.move(freshBox.x + middleHandle.x + 24, freshBox.y + middleHandle.y - 18, { steps: 12 }); await page.mouse.up(); await settle();
    const authored = await snap();
    await open(); await dialog.getByRole('button', { name: 'Flow', exact: true }).click(); await ready();
    assert.equal(await page.getByRole('slider', { name: 'Follow-through', exact: true }).count(), 0, 'Flow exposes only effective controls');
    assert.ok((await motion()).result.tracks.length); assert.deepEqual((await motion()).range, freshRange); await unchanged(authored);
    await page.getByRole('button', { name: 'Commit A', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); await settle();
    assert.equal((await snap()).undo, authored.undo + 1); assert.notDeepEqual((await snap()).model, authored.model);
    await screenshot('04-created-animation');
    const authoredSaved = path.join(out, 'created-animation-motion.mdx'); await saveAs(authoredSaved);
    assertModelEquivalent(openDocument(fs.readFileSync(authoredSaved)).model, (await snap()).model);
    checks.push('Actual Create animation, name it, POSE whole-pose copy/paste first-to-last, middle POSE mouse edit, Flow preview and one-step native Commit');

    const stepFixture = path.resolve(process.env.MDLXL_MOTION_STEP_FIXTURE || 'out/motion-study-originals/footman/footman-walk-contact-3pose.mdx'), stepSource = fs.readFileSync(stepFixture);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, stepFixture); await menu('open'); await settle();
    await page.locator('[data-warmkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption('0');
    if (await page.getByRole('button', { name: 'POSE', exact: true }).getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'POSE', exact: true }).click();
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured'); await page.getByLabel('View direction', { exact: true }).selectOption('left'); await page.getByRole('button', { name: 'Fit', exact: true }).click();
    const stepBefore = await snap(); await open(); await dialog.getByRole('button', { name: 'Step', exact: true }).click(); await ready();
    assert.ok((await motion()).result.tracks.length); assert.equal((await motion()).result.impact, null);
    for (const label of ['Hang time', 'Foot lift', 'Landing response']) assert.equal(await page.getByRole('slider', { name: label, exact: true }).count(), 1);
    await dialog.locator('summary').click(); assert.equal(await page.getByLabel('Motion hit pose').count(), 0);
    await page.getByLabel('Motion ground height').fill('-2'); await page.getByLabel('Motion ground height').press('Enter'); await ready(); assert.equal((await motion()).settings.ground, -2);
    await page.getByLabel('Motion ground height').fill('2'); await page.getByLabel('Motion ground height').press('Enter'); await ready(); assert.equal((await motion()).settings.ground, 2);
    await page.getByRole('checkbox', { name: 'Keep planted feet', exact: true }).uncheck(); await page.getByRole('slider', { name: 'Foot lift', exact: true }).fill('70'); await ready();
    assert.ok((await motion()).result.tracks.length); assert.equal((await motion()).settings.contacts, false);
    await page.getByRole('checkbox', { name: 'Keep planted feet', exact: true }).check(); await ready();
    const stepValue = await motion(), stepExpected = buildPoseMotion(preparePoseMotion(stepBefore.model, stepValue.config, stepValue.sequence, stepValue.range), stepValue.settings, {});
    assert.deepEqual(plain(stepValue.result), plain(stepExpected)); await unchanged(stepBefore);
    await seek(Math.round(stepValue.range[0] + (stepValue.range[1] - stepValue.range[0]) * .25)); const stepTransformed = await native();
    await dialog.getByRole('button', { name: 'Original', exact: true }).click(); await settle();
    assert.notDeepEqual(await native(), stepTransformed, 'Step changes the native between-pose movement');
    await dialog.getByRole('button', { name: 'Original', exact: true }).click(); await dialog.locator('summary').click();
    await page.getByRole('checkbox', { name: 'Side by side', exact: true }).check(); await page.waitForFunction(() => motionProbe().views.length === 2 && motionProbe().views.every(v => v.runtime?.captureApi?.isReady)); await settle(); await screenshot('05-step');
    await page.getByRole('button', { name: 'Commit A', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); await settle();
    assert.equal((await snap()).undo, stepBefore.undo + 1); const stepCommitted = structuredClone(stepBefore.model); applyPoseMotion(stepCommitted, stepExpected); assertModelEquivalent((await snap()).model, stepCommitted);
    const stepSaved = path.join(out, 'step-motion.mdx'); await saveAs(stepSaved); assertModelEquivalent(openDocument(fs.readFileSync(stepSaved)).model, stepCommitted);
    assert.deepEqual(fs.readFileSync(stepFixture), stepSource);
    checks.push('Step on sparse Footman walk: effective Hang time/Foot lift/Landing response controls, ground height, contacts, native preview, explicit one-step Commit and native save');

    assert.deepEqual(fs.readFileSync(fixture), source); assert.deepEqual(errors, []);
    fs.rmSync(path.join(out, 'failure.json'), { force: true });
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ fixture, sourceHash: hash(source), executable: exe, indexHash: hash(fs.readFileSync(path.join(path.dirname(exe), 'resources/app/dist/index.html'))), checks, clockChecks, errors }, null, 2));
    console.log(checks.join('\n'));
  } catch (error) {
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ checks, errors, error: error.stack }, null, 2)); throw error;
  } finally { await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy(); }).catch(() => {}); await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
