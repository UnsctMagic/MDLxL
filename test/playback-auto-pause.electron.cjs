// Auto-pause while editing (app/playback-hold.js), the user's way: the Footman's Walk plays in the
// main window, and every edit pauses it, lands on the frame the user saw, then playback plays on.
// Play, Stop and the frame reel stay the user's: they never bring playback back by themselves.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { appTarget, bundleHashes, launchApp, closeApp, sha256File: hash } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const { ObjectLoader, Matrix4 } = await import('three');
  const { movementAxisHandles, projectMovementNodes } = await import('../app/movement-overlay.js');
  const { openDocument } = await import('../src/editor-document.js');
  const out = path.resolve(process.env.MDLXL_AUTO_PAUSE_OUT || 'out/playback-auto-pause'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || fixturePath('footman'));
  fs.mkdirSync(out, { recursive: true });
  const sourceModel = openDocument(fs.readFileSync(fixture)).model;
  const WALK = sourceModel.Sequences.findIndex(item => /^walk$/i.test(item.Name));
  const HAND = [...sourceModel.Bones, ...(sourceModel.Helpers || [])].find(node => /^bone_hand_r$/i.test(node.Name)).ObjectId;
  assert.ok(WALK >= 0 && !sourceModel.Sequences[WALK].NonLooping, 'the Footman has a looping Walk');
  const { executablePath } = appTarget(), errors = [], results = { fixture, fixtureHash: hash(fixture), executablePath, executableHash: hash(executablePath), bundle: bundleHashes(), checks: [] };
  const { app, page } = await launchApp({ fixture, out, profile: path.join(out, 'profile-' + Date.now()), errors });
  const pass = name => { results.checks.push(name); console.log('ok - ' + name); };
  try {
    // Reads only: the play button's label, the preview's frame and the open model.
    const playLabel = () => page.locator('.classic-reel-play').first().getAttribute('aria-label');
    const frame = () => page.evaluate(() => Math.round(mdlxlProbe().runtime.native.getFrame()));
    const model = () => page.evaluate(() => { const { session } = mdlxlProbe(); return JSON.parse(JSON.stringify({ sequences: session.doc.model.Sequences.map(s => s.Name), nodes: session.doc.model.Nodes.filter(Boolean).map(n => n.Name), geosetAnims: session.doc.model.GeosetAnims, hand: session.doc.model.Nodes.find(n => n?.ObjectId === HAND_ID)?.Translation })); }).catch(error => { throw error; });
    await page.evaluate(id => { window.HAND_ID = id; }, HAND);
    const waitPlaying = async (expected, why) => {
      try { await page.waitForFunction(label => document.querySelector('.classic-reel-play')?.getAttribute('aria-label') === label, expected ? 'Stop' : 'Play', { timeout: 6000 }); }
      catch { assert.fail(`${why}: expected ${expected ? 'playing' : 'paused'}, the button says ${await playLabel()}`); }
    };
    // Playing means the frame moves on; paused means the button says Play and the frame holds still.
    const advances = async why => {
      const from = await frame();
      try { await page.waitForFunction(at => Math.round(mdlxlProbe().runtime.native.getFrame()) !== at, from, { timeout: 6000 }); }
      catch { assert.fail(`${why}: the frame stayed at ${from}`); }
    };
    const stillAt = async (why, expected) => {
      assert.equal(await playLabel(), 'Play', `${why}: the button should say Play (paused)`);
      // A pause lands the preview on the editor's frame at its next draw: read once two reads 50 ms apart agree.
      let a = await frame();
      for (const limit = Date.now() + 2000; Date.now() < limit;) { await page.waitForTimeout(50); const next = await frame(); if (next === a) break; a = next; }
      await page.waitForTimeout(350); const b = await frame();
      assert.equal(b, a, `${why}: the frame moved from ${a} to ${b} while paused`);
      if (expected !== undefined) assert.equal(b, expected, `${why}: paused on ${b}, not on the frame the edit began at (${expected})`);
      return b;
    };
    const stays = async (expected, why) => { await page.waitForTimeout(700); assert.equal(await playLabel(), expected ? 'Stop' : 'Play', why); };
    const play = async () => { if (await playLabel() !== 'Stop') await page.locator('.classic-reel-play').first().click(); await waitPlaying(true, 'Play starts playback'); await advances('Play moves the frame'); };

    await page.locator('[data-hotkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption(String(WALK));
    await page.waitForFunction(() => { try { return !!mdlxlProbe().runtime.captureApi?.isReady; } catch { return false; } });
    // Slow playback (the user's own Playback Speed field) so a Move arrow stays under the mouse.
    const speed = page.getByLabel('Playback speed percent');
    await speed.click({ clickCount: 3 }); await page.keyboard.type('10'); await page.keyboard.press('Enter');
    await play();
    pass('Walk plays in the main window');

    // 1. Object Manager: opening it pauses; adding an event works on a still frame; closing plays on.
    {
      const manager = page.getByRole('dialog', { name: 'Object Manager', exact: true });
      const before = (await model()).nodes.length;
      await page.keyboard.press('Alt+o'); await manager.waitFor();
      await waitPlaying(false, 'opening the Object Manager pauses');
      const held = await stillAt('Object Manager open');
      await manager.locator('[data-node-type="Bones"]').first().click();
      await manager.getByRole('button', { name: 'New', exact: true }).click();
      await manager.getByRole('group', { name: 'Event objects', exact: true }).getByRole('button', { name: 'Blood Splat', exact: true }).click();
      const splat = manager.getByLabel('Blood Splat', { exact: true });
      await splat.locator('option:not([disabled])').first().waitFor({ state: 'attached' });
      await splat.click(); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
      await manager.getByRole('button', { name: 'Add event', exact: true }).click();
      assert.equal((await model()).nodes.length, before + 1, 'Add event added one object');
      await stillAt('after adding an event in the Object Manager', held);
      await page.getByRole('button', { name: 'Close Object Manager', exact: true }).click();
      await manager.waitFor({ state: 'detached' });
      await waitPlaying(true, 'closing the Object Manager plays on'); await advances('the Walk moves again after the Object Manager');
      pass('Object Manager: paused while open, the event was added, playback resumed on close');
    }

    // 2. A real Move drag on the right hand in the 3D view: paused while the mouse is down, keyed, then plays on.
    {
      await page.getByLabel('Workplane Constraints', { exact: true }).uncheck();
      await page.getByLabel('Movement bone or node').selectOption(String(HAND));
      await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Move', exact: true }).click();
      await play();
      const handBefore = JSON.stringify((await model()).hand);
      const data = await page.evaluate(() => { const { runtime, props } = mdlxlProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, radius: runtime.captureApi.showcaseView().radius, matrices: (runtime.native.rendererData.nodes || []).flatMap((n, i) => n?.matrix ? [[i, Array.from(n.matrix)]] : []) }; });
      const cam = new ObjectLoader().parse(data.camera); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      const active = projectMovementNodes(sourceModel, data.frame, data.sequence, cam, data.width, data.height, data.frame, new Map(data.matrices.map(([i, m]) => [i, new Matrix4().fromArray(m)]))).find(point => point.node.ObjectId === HAND);
      const arrow = movementAxisHandles(active, cam, data.width, data.height, data.radius, 'world', 'move', []).find(handle => ['X', 'Y', 'Z'].includes(handle.axis) && Math.hypot(handle.dx, handle.dy) > 25);
      assert.ok(arrow, 'a Move arrow on screen');
      const box = await page.locator('[data-clean-model-canvas]').boundingBox(), from = { x: box.x + arrow.startX + arrow.dx * .8, y: box.y + arrow.startY + arrow.dy * .8 }, unit = Math.hypot(arrow.dx, arrow.dy);
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await waitPlaying(false, 'pressing on the Move arrow pauses');
      const held = await stillAt('mouse down on the Move arrow');
      await page.mouse.move(from.x + arrow.dx / unit * 60, from.y + arrow.dy / unit * 60, { steps: 12 });
      await stillAt('dragging the hand', held);
      await page.mouse.up();
      await waitPlaying(true, 'releasing the drag plays on'); await advances('the Walk moves again after the drag');
      assert.notEqual(JSON.stringify((await model()).hand), handBefore, 'the drag keyed the hand');
      pass('Move drag in the preview: paused while dragging, the hand was keyed, playback resumed on release');
    }

    // 3. Animations: typing an Alpha keeps the typed number and keys it on the frame that was showing.
    {
      await page.locator('[data-hotkey="animations"]').click();
      await play();
      const alpha = page.getByLabel('Visibility alpha percent', { exact: true });
      const before = JSON.stringify((await model()).geosetAnims);
      await alpha.click();
      await waitPlaying(false, 'clicking into Alpha pauses');
      const held = await stillAt('typing in Alpha');
      await page.keyboard.press('Control+a'); await page.keyboard.type('40');
      await page.waitForTimeout(300);
      assert.equal(await alpha.inputValue(), '40', 'the typed Alpha is not refilled by playback');
      await page.keyboard.press('Enter');
      await waitPlaying(true, 'finishing the Alpha field plays on'); await advances('the Walk moves again after Alpha');
      const after = (await model()).geosetAnims;
      assert.notEqual(JSON.stringify(after), before, 'Alpha wrote a key');
      const keyed = after.flatMap(anim => anim?.Alpha?.Keys || []).filter(key => key.Frame === held).map(key => Math.round(key.Vector[0] * 100));
      assert.ok(keyed.length && keyed.every(value => value === 40), `Alpha 40 keyed at frame ${held}: ${JSON.stringify(keyed)}`);
      pass('Alpha: paused while typing, 40 keyed at the frame shown, playback resumed');
    }

    // 4. Reorder: paused while the window is open, Apply moves the animation, playback resumes.
    {
      await play();
      const reorder = page.getByRole('dialog', { name: 'Reorder Animations', exact: true });
      const before = (await model()).sequences;
      await page.getByRole('button', { name: 'Reorder', exact: true }).click(); await reorder.waitFor();
      await waitPlaying(false, 'opening Reorder pauses');
      const held = await stillAt('Reorder open');
      const list = reorder.getByLabel('Animation order', { exact: true });
      await list.locator('option', { hasText: 'Walk' }).first().click();
      await reorder.getByRole('button', { name: 'Down', exact: true }).click();
      await stillAt('after moving Walk down', held);
      await reorder.getByRole('button', { name: 'Apply', exact: true }).click();
      await reorder.waitFor({ state: 'detached' });
      const after = (await model()).sequences, at = before.indexOf('Walk');
      assert.deepEqual(after.slice(at, at + 2), [before[at + 1], 'Walk'], 'Walk moved down one place: ' + JSON.stringify(after));
      await waitPlaying(true, 'applying Reorder plays on'); await advances('the Walk moves again after Reorder');
      pass('Reorder: paused while open, Walk moved down, playback resumed');
    }

    // 5. Holding the mouse on a button pauses until it is let go, even when the press goes nowhere.
    {
      await play();
      const button = await page.getByRole('button', { name: 'Reorder', exact: true }).boundingBox();
      await page.mouse.move(button.x + 4, button.y + 4); await page.mouse.down();
      await waitPlaying(false, 'holding the mouse on a button pauses');
      await stillAt('mouse held on a button');
      await page.mouse.move(button.x - 300, button.y + 200, { steps: 4 }); await page.mouse.up();
      await waitPlaying(true, 'letting go plays on'); await advances('the Walk moves again after letting go');
      pass('a held button press pauses and letting go resumes');
    }

    // 6. Stop and the frame reel are the user's: no resume afterwards.
    {
      await play();
      await page.locator('.classic-reel-play').first().click();
      await waitPlaying(false, 'Stop stops'); await stays(false, 'Stop stays stopped');
      await play();
      const reel = await page.locator('.classic-reel-track').first().boundingBox();
      await page.mouse.click(reel.x + reel.width * .3, reel.y + reel.height * .75);
      await waitPlaying(false, 'clicking the frame reel stops'); await stays(false, 'the frame reel stays stopped');
      pass('Stop and the frame reel stay stopped');
    }
    assert.deepEqual(errors, [], 'no page errors');
    results.passed = true;
  } finally {
    results.errors = errors;
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exit(1); });
