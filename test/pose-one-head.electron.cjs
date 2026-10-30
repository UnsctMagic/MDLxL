// Packaged real-use check: a weapon's "head" on its own skeleton (the owner's
// flail) is no second head in POSE / Focused Skeleton. Hidden window, disposable profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { appTarget, bundleHashes, launchApp, closeApp, sha256File: hash } = require('./helpers/app.cjs');

(async () => {
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { openDocument } = await import('../src/editor-document.js');
  const fixture = path.resolve(process.env.MDLXL_FLAIL_MODEL || 'out/pose-flail/Fx_original.mdx'), out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-one-head');
  fs.mkdirSync(out, { recursive: true });
  const model = openDocument(fs.readFileSync(fixture)).model, sequence = Math.max(0, model.Sequences.findIndex(s => /^stand(?:\s|$)/i.test(s.Name) && !/portrait/i.test(s.Name))), frame = model.Sequences[sequence].Interval[0];
  const byName = name => [...model.Bones, ...model.Helpers].find(node => node.Name === name).ObjectId, flailHead = byName('Flail_Head'), bodyHead = byName('Bone_Head');
  const results = { fixture, fixtureHash: hash(fixture), executablePath: appTarget().executablePath, bundle: bundleHashes(), checks: [] };
  const { app, page, errors } = await launchApp({ fixture, out });
  const shot = async name => { const data = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data, 'base64')); };
  try {
    await page.locator('[data-hotkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption(String(sequence));
    const time = page.getByLabel('Current animation frame'); await time.fill(String(frame)); await time.press('Enter');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.evaluate(() => { window.poseProbe = () => { const { runtime, props, session } = mdlxlProbe(); if (!runtime || !props || !session) throw Error('Movement is not ready'); return { runtime, props, session }; }; }); // test/helpers/fiber-probe.cjs
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const settle = () => page.waitForTimeout(180), box = () => page.locator('[data-clean-model-canvas]').boundingBox();
    const camera = async () => { const camera = new ObjectLoader().parse(await page.evaluate(() => poseProbe().runtime.controls.object.toJSON())); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); return camera; };
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { config: props.poseConfig, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, width: canvas.clientWidth, height: canvas.clientHeight }; });
      return projectPoseHandles(model, data.config, data.frame, data.sequence, await camera(), data.width, data.height);
    }
    // Turn POSE on the way a user does; Focused Skeleton comes on with it.
    await page.getByRole('button', { name: 'POSE', exact: true }).click(); await settle();
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await settle();
    assert.equal((await page.evaluate(() => poseProbe().props.overlays)).focusedSkeleton, true);
    let points = await handles();
    const heads = points.filter(point => point.visible && !point.quiet && point.label === 'Head');
    results.heads = heads.map(point => point.id);
    assert.deepEqual(heads.map(point => point.id), [bodyHead], 'Focused Skeleton shows one Head, on the body');
    assert.ok(!points.some(point => point.id === flailHead && !point.quiet), 'the flail ball has no POSE handle');
    assert.ok(!points.some(point => point.kind === 'node' && !point.quiet && point.label === 'Body'), 'the flail root is no second Body');
    await shot('flail-one-head'); results.checks.push('POSE on the flail: one Head handle (Bone_Head), none on Flail_Head');
    // Click where the flail ball is: it must not select a head.
    const ball = points.find(point => point.id === flailHead);
    if (ball?.visible) {
      const rect = await box();
      await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Select', exact: true }).click();
      await page.mouse.click(rect.x + ball.x, rect.y + ball.y); await settle();
      const target = await page.evaluate(() => poseProbe().props.poseConfig.target);
      const picked = (await handles()).find(point => target?.kind === 'node' && point.id === target.id);
      results.flailClick = { target, label: picked?.label };
      assert.notEqual(picked?.label, 'Head', 'clicking the flail ball selects no head');
      results.checks.push('Clicking the flail ball selects no head');
    }
    // The preview keeps normal mouse camera rotation.
    const before = await camera(), rect = await box();
    await page.keyboard.down('Alt'); await page.mouse.move(rect.x + 50, rect.y + 50); await page.mouse.down(); await page.mouse.move(rect.x + 120, rect.y + 70, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle();
    assert.ok(before.quaternion.angleTo((await camera()).quaternion) > .001, 'mouse rotation turns the camera');
    points = await handles();
    assert.deepEqual(points.filter(point => point.visible && !point.quiet && point.label === 'Head').map(point => point.id), [bodyHead], 'still one Head after turning the view');
    await shot('flail-one-head-turned'); results.checks.push('Mouse rotation works; still one Head from another angle');
    assert.equal(hash(fixture), results.fixtureHash); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify({ checks: results.checks, errors }));
  } catch (error) { console.error(error); await shot('failure').catch(() => {}); throw error; } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
