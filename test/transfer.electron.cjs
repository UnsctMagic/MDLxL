// Transfer (XFER) acceptance with real mouse input on the app: docs/agent-tasks/transfer-xl.md "Window acceptance"
// and "Round 2". Disposable profile and model copies under out/; never opens or replaces a user profile. Run it hidden:
// MDLXL_PLAYWRIGHT_MODULE=<playwright-core> MDLXL_TEST_EXE=<MDLxL.exe> node test/transfer.electron.cjs
// MDLXL_TRANSFER_SWEEP=1 adds a click-through of every control; MDLXL_TRANSFER_ONLY=B,A,fx,sweep,unreadable,trials,freeze picks parts.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');
const { fixturePath, testModel } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_TRANSFER_OUT || 'out/transfer-ui'), shots = path.join(out, 'round2'), shots3 = path.join(out, 'round3'), shots4 = path.join(out, 'round4'), shotsF = path.join(out, 'final'), shots5 = path.join(out, 'round5'), shots7 = path.join(out, 'round7'), shots7b = path.join(out, 'round7b'), shots8 = path.join(out, 'round8');
const results = { checks: [], errors: [], screenshots: [] };
const watchdog = setTimeout(() => { console.error('Transfer harness timed out'); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ...results, timedOut: true }, null, 2)); process.exit(3); }, Number(process.env.MDLXL_TRANSFER_TIMEOUT || 1200000));

function copyModel(key, name) {
  const source = fixturePath(key);
  if (!source || !fs.existsSync(source)) throw Error(`Test model ${key} is not on this machine`);
  const target = path.join(out, name); fs.copyFileSync(source, target); return target;
}
function copyTestModel(relative, name) {
  const source = testModel(relative);
  if (!fs.existsSync(source)) return null;
  const target = path.join(out, name); fs.copyFileSync(source, target); return target;
}
const readModel = async file => { const { parseCompatibleMdx } = await import('../src/mdx-compatibility.js'); const b = fs.readFileSync(file); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

async function session(fixture, label, settings) {
  const errors = [], consoleErrors = [];
  const { app, page } = await launchApp({ out, fixture, errors, settings, bounds: { x: -3000, y: 0, width: 1500, height: 960 }, timeout: 90000, pageTimeout: 30000 });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.waitForFunction(() => !!window.__mdlxl?.model?.(), null, { timeout: 60000 });
  const dialog = page.getByRole('dialog', { name: 'Transfer' });
  const shot = async (name, folder = shots) => { const file = path.join(folder, name + '.png'); await page.screenshot({ path: file }); results.screenshots.push(file); };
  const from = () => dialog.locator('aside[aria-label="From"]'), parts = () => dialog.locator('aside[aria-label="Parts"]');
  const view = name => dialog.locator(`section[aria-label="${name}"]`);
  const count = () => page.evaluate(() => window.__mdlxl.model().Sequences.length);
  const noCrash = async where => {
    assert.equal(await page.locator('[data-error-boundary],.error-boundary').count(), 0, `${label}: error screen at ${where}`);
    assert.deepEqual(errors, [], `${label}: page errors at ${where}`);
  };
  // One view's renderer: camera, frame, handles and the drawn path.
  const probe = name => page.evaluate(name => {
    const root = document.querySelector(`[role="dialog"][aria-label="Transfer"] section[aria-label="${name}"] .game-preview-root`), p = window.__mdlxl.preview(root), canvas = root.querySelector('canvas'), box = canvas.getBoundingClientRect();
    return { frame: p.runtime.native.getFrame(), sequence: p.props.sequenceIndex, camera: p.runtime.controls.object.toJSON(), config: p.props.poseConfig, mode: p.props.transformMode, path: p.props.overlayPaths?.[0]?.points || null, box: { x: box.x, y: box.y, width: canvas.clientWidth, height: canvas.clientHeight } };
  }, name);
  const handles = async (name, model) => {
    const { ObjectLoader } = await import('three'), { projectPoseHandles } = await import('../app/pose-overlay.js');
    const data = await probe(name), camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return { box: data.box, list: projectPoseHandles(model, data.config, data.frame, data.sequence, camera, data.box.width, data.box.height, undefined, undefined, undefined, data.mode) };
  };
  const pixels = async name => page.screenshot({ clip: await view(name).locator('.xf-preview').boundingBox() });
  const dragCamera = async name => {
    const box = await view(name).locator('.xf-preview').boundingBox(), before = await pixels(name);
    const x = box.x + box.width * 0.85, y = box.y + box.height * 0.2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(x - i * 12, y + i * 3); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(400);
    assert.ok(!before.equals(await pixels(name)), `${label}: dragging in the ${name} view turns its camera`);
  };
  const dragSlider = async (field, fraction, hold) => {
    const input = dialog.locator(`input[data-field="${field}"]`);
    // The parts column scrolls: bring the slider into view before the mouse goes to it.
    await input.scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
    const box = await input.boundingBox();
    const y = box.y + box.height / 2, start = box.x + box.width * 0.5, to = box.x + box.width * fraction;
    await page.mouse.move(start, y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(start + (to - start) * i / 10, y); await page.waitForTimeout(25); }
    if (hold) await hold();
    await page.mouse.up(); await page.waitForTimeout(300);
  };
  const openDonor = async file => { await stubDialogs(app, { open: file }); await from().getByRole('button', { name: 'Open file...' }).click(); await view('Donor').locator('.xf-caption button', { hasText: 'Mirror' }).waitFor({ timeout: 30000 }); await page.waitForTimeout(500); };
  const animation = async name => { await from().locator('.xf-animations button', { hasText: new RegExp(`^${name.replace(/[-]/g, '\\-')}$`) }).first().click(); await page.waitForTimeout(400); };
  const close = async () => { if (consoleErrors.length) results.consoleErrors = [...(results.consoleErrors || []), ...consoleErrors.map(text => `${label}: ${text}`)]; if (!closed) { closed = true; try { await page.screenshot({ path: path.join(out, `last-${label}.png`) }); } catch {} } try { await closeApp(app); } catch (error) { console.error('close:', error.message); } };
  let closed = false;
  return { app, page, dialog, shot, from, parts, view, count, noCrash, probe, handles, dragCamera, dragSlider, openDonor, animation, close, errors, consoleErrors };
}
// The parts column must not scroll in normal use; no model name shows its file extension.
const noScroll = async (s, what) => { const { scroll, client } = await s.parts().evaluate(e => ({ scroll: e.scrollHeight, client: e.clientHeight })); assert.ok(scroll <= client + 1, `${what}: the parts column fits without scrolling (${scroll} > ${client})`); };
const noExtensions = async (s, what) => { const text = await s.dialog.innerText(); assert.doesNotMatch(text, /\.(mdx|mdl)\b/i, `${what}: no file extension in the window`); };
// The window opens in Transplant (owner, build 23); the Retarget stories switch to Retarget first.
const openTransfer = async (s, mode = 'retarget') => { await s.page.locator('button.transfer-tool').click(); await s.dialog.waitFor(); await s.page.waitForTimeout(800); if (mode === 'retarget') { await s.dialog.locator('button[data-mode="retarget"]').click(); await s.dialog.locator('aside[aria-label="Parts"], .xf-problems').first().waitFor(); await s.page.waitForTimeout(300); } };
const pathMoved = (a, b) => !!a && !!b && a.length === b.length && a.some((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2]) > 1);

async function storyB() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 01.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor.mdx');
  const s = await session(footman, 'B'), { page, dialog } = s;
  try {
    await s.shot('dock');
    await openTransfer(s);
    await s.shot('01-empty-window');
    await s.shot('01-empty-window', shotsF);
    assert.equal((await s.probe('Result')).config, null, 'B: with nothing taken the result view has no handles');
    results.checks.push('B: XFER opens Transfer with the source choices');
    const before = await s.count();
    await s.openDonor(grunt);
    await s.animation('Attack - 1');
    await s.parts().getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' });
    await dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }).click();
    // Each view has its own Play now: hold the donor still too before aiming at its hand.
    await dialog.locator('section[aria-label="Donor"] .xs-strip').getByRole('button', { name: 'Pause' }).click();
    await page.waitForTimeout(600);
    // The Grunt's weapon hand: its armL chain (limb:36).
    const gruntModel = await readModel(grunt), { box, list } = await s.handles('Donor', gruntModel);
    const hand = list.find(h => h.kind === 'endpoint' && h.chain?.end === 36 && h.visible);
    assert.ok(hand, 'B: the Grunt weapon-hand handle is visible');
    await page.mouse.click(box.x + hand.x, box.y + hand.y); await page.waitForTimeout(600);
    assert.equal(await dialog.locator('button[data-part="armL"]').getAttribute('aria-pressed'), 'true', 'B: clicking the hand handle selects Left arm');
    assert.equal(await dialog.locator('input[data-part-switch="armL"]').isChecked(), true, 'B: clicking the hand handle takes Left arm');
    results.checks.push('B: clicking the Grunt weapon-hand handle takes and selects Left arm');
    const own = (await s.probe('Result')).config;
    assert.equal(own.chains.length, 1, 'B: the result view has a handle for the taken arm only');
    assert.equal(own.body, -1, 'B: no body handle while Hips is not taken');
    assert.ok((await s.probe('Donor')).config.chains.length >= 4, 'B: the donor keeps a handle for every limb');
    results.checks.push('B: the result view shows handles for taken parts only; the donor for every part');
    await page.waitForTimeout(500);
    const first = await s.probe('Result'), donorPath = (await s.probe('Donor')).path;
    assert.ok(first.path?.length > 5, 'B: the hand path is drawn on the result');
    assert.ok(donorPath?.length > 5, 'B: the Grunt hand path is drawn on the donor');
    await s.shot('02-story-b-arm-path');
    await noScroll(s, 'B arm'); await noExtensions(s, 'B');
    await s.shot('02-story-b-arm', shotsF);
    results.checks.push('B: the arm\'s controls fit without scrolling; no file extension anywhere');
    await s.dragSlider('amount', 0.9);
    const amount = await dialog.locator('input[data-field="amount"]').inputValue();
    assert.ok(Number(amount) > 110, `B: Strength dragged up (${amount})`);
    assert.ok(pathMoved(first.path, (await s.probe('Result')).path), 'B: dragging Strength moves the hand path');
    // Raise moves the result live, on the same renderer, and moves the drawn path while the mouse is down.
    const runtime = () => page.evaluate(() => { const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'), r = window.__mdlxl.preview(root).runtime; const same = window.__xfRuntime === r; window.__xfRuntime = r; return same; });
    await runtime();
    const area = await s.view('Result').locator('.xf-preview').boundingBox(), still = await page.screenshot({ clip: area }), beforeRaise = (await s.probe('Result')).path;
    let moved, sameRenderer, raisedPath;
    await s.dragSlider('offset0', 0.95, async () => { await page.waitForTimeout(800); moved = await page.screenshot({ clip: area }); sameRenderer = await runtime(); raisedPath = (await s.probe('Result')).path; });
    assert.ok(!still.equals(moved), 'B: dragging Raise moves the arm in the result while the mouse is down');
    assert.ok(sameRenderer, 'B: the result view is not rebuilt during the drag');
    assert.ok(pathMoved(beforeRaise, raisedPath), 'B: dragging Raise moves the hand path while the mouse is down');
    assert.ok(await runtime(), 'B: nor after a release that keeps the length');
    await page.waitForTimeout(400);
    await s.shot('03-story-b-raise-dragged');
    // N6: the arm's clip on the timeline. Dragging it later sets Delay and moves the swing later;
    // its right edge trims it (Speed stays on its slider); each drag is one step of the window's history.
    const clip = dialog.locator('.xt-clip.xt-main').first(), lanesBefore = await dialog.locator('.xt-lane').count();
    assert.equal(lanesBefore, 2, 'B: the timeline has the body lane and one clip lane');
    assert.match(await dialog.locator('.xt-lane:not(.xt-body) .xt-label').innerText(), /Attack - 1/, 'B: the lane names its source animation');
    const timingOpen = async () => { if (!(await dialog.locator('.xf-timing[open]').count())) await dialog.locator('.xf-timing > summary').click(); await page.waitForTimeout(200); };
    await timingOpen();
    const pathBefore = (await s.probe('Result')).path, cb = await clip.boundingBox(), cells = await dialog.locator('.xt-lane:not(.xt-body) .xt-cells').boundingBox();
    await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(cb.x + cb.width * 0.3 + cells.width * 0.25 * i / 10, cb.y + cb.height / 2); await page.waitForTimeout(25); }
    await page.waitForTimeout(400);
    const liveDelay = Number(await dialog.locator('input[data-field="start"]').inputValue());
    assert.ok(liveDelay > 0, `B: the Delay slider follows the clip while it is dragged (${liveDelay} ms)`);
    await page.mouse.up(); await page.waitForTimeout(1200);
    const delay = Number(await dialog.locator('input[data-field="start"]').inputValue());
    assert.ok(delay >= 100, `B: dragging the clip later sets Delay (${delay} ms)`);
    const pathAfter = (await s.probe('Result')).path;
    // A later swing makes the result longer: the path gains samples, and the samples it starts with stay near the hand's rest.
    assert.ok(pathAfter.length > pathBefore.length, `B: the swing happens later: the result and its hand path get longer (${pathBefore.length} -> ${pathAfter.length} samples)`);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(800); await timingOpen();
    assert.equal(Number(await dialog.locator('input[data-field="start"]').inputValue()), 0, 'B: one Ctrl+Z in the window undoes the whole clip drag');
    await page.keyboard.press('Control+y'); await page.waitForTimeout(800); await timingOpen();
    assert.equal(Number(await dialog.locator('input[data-field="start"]').inputValue()), delay, 'B: Ctrl+Y redoes it');
    const edge = dialog.locator('.xt-clip.xt-main .xt-edge-right').first(), eb = await edge.boundingBox();
    await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(eb.x + eb.width / 2 - cells.width * 0.15 * i / 8, eb.y + eb.height / 2); await page.waitForTimeout(25); }
    await page.mouse.up(); await page.waitForTimeout(1200); await timingOpen();
    const speed = Number(await dialog.locator('input[data-field="speed"]').inputValue()), trimmedArm = (await page.evaluate(() => window.__mdlxl.transfer())).recipe.parts.armL;
    assert.equal(speed, 100, 'B: the right edge no longer changes Speed');
    assert.ok(Array.isArray(trimmedArm.clip) && trimmedArm.clip[0] === 0 && trimmedArm.clip[1] > 0, `B: the right edge trims the clip (${JSON.stringify(trimmedArm.clip)})`);
    await dialog.locator('button[data-part="armR"]').click(); await page.waitForTimeout(200);
    await dialog.locator('.xt-lane:not(.xt-body) .xt-label').click(); await page.waitForTimeout(300);
    assert.equal(await dialog.locator('button[data-part="armL"]').getAttribute('aria-pressed'), 'true', "B: clicking a lane's label selects its part");
    assert.equal(await dialog.locator('.xf-animations .xf-playing').count(), 0, 'B: no animation marked as playing in step; the donor has its own clock');
    await page.waitForTimeout(600);
    await s.shot('01-story-b-timeline', shots4);
    results.checks.push(`B: timeline clip drag sets Delay ${delay} ms (one history step, the swing moves later), its right edge trims it to ${JSON.stringify(trimmedArm.clip)} with Speed left at ${speed}%, the lane label selects the arm`);
    results.checks.push('B: Strength and Raise drags move the drawn hand path and the arm live, without a renderer rebuild');
    // W3: turning one view's camera turns the other to the same angles.
    await s.dragCamera('Donor'); await page.waitForTimeout(600);
    const quaternion = async name => { const { ObjectLoader } = await import('three'), c = new ObjectLoader().parse((await s.probe(name)).camera); return c.quaternion; };
    const qa = await quaternion('Donor'), qb = await quaternion('Result');
    assert.ok(Math.abs(qa.dot(qb)) > 0.999, `B: both views face the same way after turning the donor (dot ${qa.dot(qb).toFixed(4)})`);
    await s.shot('03-both-views-same-angle', shots3);
    await s.dragCamera('Result'); await page.waitForTimeout(600);
    const qc = await quaternion('Donor'), qd = await quaternion('Result');
    assert.ok(Math.abs(qc.dot(qd)) > 0.999, 'B: and after turning the result');
    results.checks.push('B: turning either view turns the other to the same angles');
    // The viewpoint stays level: a sideways drag only turns the model around (no tilt, no change of
    // height), an upward drag stops at the top instead of flipping over. matrix[2] is how far the
    // camera's right edge leaves the horizontal, matrix[10] how high the camera sits.
    const pose = async name => { const m = (await s.probe(name)).camera.object.matrix; return { tilt: Math.asin(Math.max(-1, Math.min(1, m[2]))) * 180 / Math.PI, height: Math.asin(Math.max(-1, Math.min(1, m[10]))) * 180 / Math.PI, turn: Math.atan2(m[9], m[8]) * 180 / Math.PI }; };
    const steadyDrag = async (name, dx, dy, steps) => { const box = await s.view(name).locator('.xf-preview').boundingBox(), x = box.x + box.width * (dx ? 0.5 : 0.08) - dx * steps / 2, y = box.y + box.height * (dy ? 0.5 : 0.93) - dy * steps / 2, seen = []; await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= steps; i++) { await page.mouse.move(x + dx * i, y + dy * i); await page.waitForTimeout(16); seen.push(await pose(name)); } await page.mouse.up(); await page.waitForTimeout(300); return seen; };
    for (const name of ['Donor', 'Result']) {
      const before = await pose(name), sideways = await steadyDrag(name, 6, 0, 30), other = await pose(name === 'Donor' ? 'Result' : 'Donor');
      assert.ok(sideways.every(p => Math.abs(p.tilt) < 0.2), `B: a sideways drag in the ${name} view keeps the horizon level (tilt up to ${Math.max(...sideways.map(p => Math.abs(p.tilt))).toFixed(1)}°)`);
      assert.ok(sideways.every(p => Math.abs(p.height - before.height) < 0.2), `B: a sideways drag in the ${name} view keeps the camera's height`);
      assert.ok(Math.abs(sideways.at(-1).turn - before.turn) > 20, `B: a sideways drag in the ${name} view turns the model`);
      assert.ok(Math.abs(other.tilt) < 0.2 && Math.abs(other.height - sideways.at(-1).height) < 0.2, `B: the other view follows the ${name} view level`);
      const up = await steadyDrag(name, 0, 5, 80), turns = up.map(p => p.turn);
      assert.ok(up.every(p => Math.abs(p.tilt) < 0.2) && turns.every(t => Math.abs(((t - turns[0] + 540) % 360) - 180) < 1), `B: a long upward drag in the ${name} view never flips or tilts it`);
      await steadyDrag(name, 0, -5, 30);
    }
    results.checks.push('B: sideways drags keep both views level, a long vertical drag never flips them');
    results.checks.push('B: mouse drags turn the camera in both views');
    await dialog.getByRole('button', { name: 'Add animation' }).click(); await page.waitForTimeout(800);
    assert.equal(await s.count(), before + 1, 'B: Add animation adds one animation');
    const name = await page.evaluate(() => window.__mdlxl.model().Sequences.at(-1).Name);
    await dialog.getByText('Added').waitFor();
    results.checks.push(`B: Add animation added "${name}"; the window stays open and says so`);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForTimeout(300);
    assert.equal(await dialog.count(), 0, 'B: Cancel closes the window');
    await page.keyboard.press('Control+Z'); await page.waitForTimeout(800);
    assert.equal(await s.count(), before, 'B: one Undo in the editor removes the added animation');
    results.checks.push('B: Cancel closes; one Undo in the editor removes the animation');
    await s.noCrash('story B');
  } finally { await s.close(); }
}

async function storyA() {
  const lord = copyModel('transfer-lord-of-change', 'TEST TRANSFER 02.mdx'), footman = copyModel('transfer-footman', 'footman donor.mdx');
  const s = await session(lord, 'A'), { page, dialog } = s;
  try {
    await openTransfer(s);
    const before = await s.count();
    await s.openDonor(footman);
    await s.animation('Stand Defend');
    await s.parts().getByRole('button', { name: 'Take whole body' }).click();
    await page.waitForTimeout(1500);
    const taken = await dialog.locator('input[data-part-switch]:checked').count();
    assert.ok(taken >= 7, `A: ${taken} parts taken`);
    assert.equal(await dialog.locator('input[data-part-switch="wingL"]').isChecked(), false, 'A: the wings stay on the body animation');
    assert.equal(await s.view('Donor').getByRole('button', { name: 'Mirror' }).getAttribute('aria-pressed'), 'true', 'A: weapon hands on opposite sides mirror by themselves');
    assert.equal(await dialog.locator('button[data-part="all"]').getAttribute('aria-pressed'), 'true', 'A: All taken parts is selected after Take whole body');
    await dialog.locator('.xf-timing > summary').click(); await page.waitForTimeout(300);
    await s.shot('04-story-a-whole-body');
    assert.equal(await dialog.locator('.xt-lane:not(.xt-body)').count(), 1, 'A: the whole body shares one clip lane');
    await s.shot('02-story-a-lanes', shots4);
    await s.shot('06-lord-of-change-whole-body', shotsF);
    // One drag slows every taken part down.
    await s.dragSlider('speed', 0.05);
    const speeds = [];
    for (const key of await dialog.locator('input[data-part-switch]:checked').evaluateAll(list => list.map(i => i.dataset.partSwitch))) {
      await dialog.locator(`button[data-part="${key}"]`).click(); await page.waitForTimeout(150);
      if (!(await dialog.locator('.xf-timing[open]').count())) await dialog.locator('.xf-timing > summary').click();
      speeds.push(Number(await dialog.locator('input[data-field="speed"]').inputValue()));
    }
    assert.ok(speeds.length >= 7 && speeds.every(v => v === speeds[0] && v < 50), `A: one Speed drag with All taken parts sets every part (${speeds.join(', ')})`);
    await dialog.locator('button[data-part="all"]').click(); await page.waitForTimeout(200);
    assert.equal(await dialog.locator('input[data-field="speed"]').inputValue(), String(speeds[0]), 'A: All shows the shared Speed');
    assert.equal(await dialog.locator('input[data-field="offset0"]').count(), 0, 'A: no Raise/Turn/Roll with All');
    results.checks.push(`A: Take whole body selects All taken parts; one Speed drag sets all ${speeds.length} parts to ${speeds[0]}%`);
    results.checks.push(`A: Take whole body takes ${taken} parts and leaves the wings; Mirror is on by itself`);
    await dialog.getByRole('button', { name: 'Add animation' }).click(); await page.waitForTimeout(1000);
    assert.equal(await s.count(), before + 1, 'A: Add animation adds one animation');
    const name = await page.evaluate(() => window.__mdlxl.model().Sequences.at(-1).Name);
    await dialog.getByRole('button', { name: 'Close Transfer' }).click(); await page.waitForTimeout(300);
    const saved = path.join(out, 'TEST TRANSFER 02 saved.mdx');
    if (fs.existsSync(saved)) fs.unlinkSync(saved);
    await stubDialogs(s.app, { save: saved, message: 0 });
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'saveAs'));
    await page.waitForTimeout(1000);
    const format = page.getByRole('button', { name: 'Save MDX…' });
    if (await format.count()) await format.click();
    for (let i = 0; i < 40 && !fs.existsSync(saved); i++) await page.waitForTimeout(250);
    assert.ok(fs.existsSync(saved), 'A: Save as wrote the file');
    await page.waitForTimeout(500);
    const reopened = await readModel(saved);
    assert.equal(reopened.Sequences.length, before + 1, 'A: the saved file has the new animation');
    assert.equal(reopened.Sequences.at(-1).Name, name, 'A: under its name');
    results.checks.push(`A: Add animation added "${name}"; Save as and reopening the file keep it`);
    await s.noCrash('story A');
  } finally { await s.close(); }
}

// W1: Add all on the Lord of Change from the Footman: one Undo for the set, save and reopen keeps it.
async function storyAll() {
  const lord = copyModel('transfer-lord-of-change', 'TEST TRANSFER 05 add all.mdx'), footman = copyModel('transfer-footman', 'footman donor all.mdx');
  const s = await session(lord, 'all'), { page, dialog } = s;
  try {
    await openTransfer(s);
    const before = await s.count(), names = await page.evaluate(() => window.__mdlxl.model().Sequences.map(q => q.Name));
    await s.openDonor(footman);
    await s.animation('Stand Defend');
    const button = dialog.locator('button[data-hotkey="transfer:add-all"]');
    assert.equal(await button.isDisabled(), true, 'all: Add all waits for a taken part');
    await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(1500);
    // This story covers Keep own animations on (only new names); story set covers replacing (the default since stage 2).
    await dialog.getByLabel('Keep own animations').click(); await page.waitForTimeout(300);
    const label = await button.innerText(), n = Number(label.match(/\((\d+)\)/)[1]), tip = await button.getAttribute('title');
    assert.ok(n > 5, `all: ${label}`);
    assert.ok(!/decay|portrait/i.test(tip) && !tip.split(/: |, /).includes('Death'), `all: the tooltip lists only new names (${tip})`);
    await button.hover(); await page.waitForTimeout(1200);
    await s.shot('01-footer-add-all', shots3);
    const takenBefore = await dialog.locator('input[data-part-switch]:checked').count(), selectedBefore = await dialog.locator('button[data-part][aria-pressed="true"]').getAttribute('data-part');
    await button.click(); await page.waitForTimeout(3000);
    assert.equal(await dialog.locator('input[data-part-switch]:checked').count(), takenBefore, 'all: the taken parts stay after Add all');
    assert.equal(await dialog.locator('button[data-part][aria-pressed="true"]').getAttribute('data-part'), selectedBefore, 'all: the selection stays after Add all');
    assert.equal(await s.count(), before + n, `all: Add all adds ${n} animations`);
    await dialog.getByText(`Added ${n} animations`).waitFor();
    const added = await page.evaluate(count => window.__mdlxl.model().Sequences.slice(-count).map(q => q.Name), n);
    assert.ok(added.every(name => !names.some(old => old.toLowerCase() === name.toLowerCase())), `all: new names only (${added.join(', ')})`);
    results.checks.push(`all: Add all (${n}) adds ${added.join(', ')}`);
    await dialog.getByRole('button', { name: 'Close Transfer' }).click(); await page.waitForTimeout(300);
    await page.keyboard.press('Control+Z'); await page.waitForTimeout(2000);
    assert.equal(await s.count(), before, 'all: one Undo removes the whole set');
    await page.keyboard.press('Control+Y'); await page.waitForTimeout(2000);
    assert.equal(await s.count(), before + n, 'all: Redo brings it back');
    // The new names in the editor's own animation list (the Sequence Manager).
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Sequences')); await page.waitForTimeout(1500);
    await s.shot('02-lord-of-change-animation-list', shots3);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const saved = path.join(out, 'TEST TRANSFER 05 saved.mdx');
    if (fs.existsSync(saved)) fs.unlinkSync(saved);
    await stubDialogs(s.app, { save: saved, message: 0 });
    await s.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'saveAs'));
    await page.waitForTimeout(1000);
    const format = page.getByRole('button', { name: 'Save MDX…' });
    if (await format.count()) await format.click();
    for (let i = 0; i < 60 && !fs.existsSync(saved); i++) await page.waitForTimeout(250);
    await page.waitForTimeout(800);
    const reopened = await readModel(saved);
    assert.deepEqual(reopened.Sequences.slice(-n).map(q => q.Name), added, 'all: the saved file keeps every added animation');
    results.checks.push(`all: one Undo removes all ${n}, Redo restores them, Save as and reopening keep them`);
    await s.noCrash('add all');
  } finally { await s.close(); }
}

// N6: three sources on one Footman: body Walk, the Grunt's attack arm, his own Stand Victory chest and head.
async function mix() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 06 mix.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor mix.mdx');
  const s = await session(footman, 'mix'), { page, dialog } = s;
  try {
    await openTransfer(s);
    await s.parts().getByLabel('Body animation', { exact: true }).selectOption({ label: 'Walk' });
    await s.openDonor(grunt); await s.animation('Attack - 1');
    await dialog.locator('input[data-part-switch="armL"]').click(); await page.waitForTimeout(400);
    await s.from().getByRole('button', { name: 'This model' }).click(); await page.waitForTimeout(400);
    await s.animation('Stand Victory');
    await dialog.locator('input[data-part-switch="chest"]').click(); await page.waitForTimeout(300);
    await dialog.locator('input[data-part-switch="head"]').click(); await page.waitForTimeout(800);
    const labels = await dialog.locator('.xt-lane .xt-label').allInnerTexts();
    assert.equal(labels.length, 3, `mix: body lane and two clip lanes (${labels.join(' | ')})`);
    await dialog.locator('.xt-lane:not(.xt-body) .xt-label', { hasText: 'Stand Victory' }).click(); await page.waitForTimeout(300);
    assert.equal(await dialog.locator('button[data-part="all"]').getAttribute('aria-pressed'), 'true', 'mix: a lane of two parts selects All taken parts');
    await dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }).click(); await page.waitForTimeout(800);
    await s.shot('03-three-source-mix', shots4);
    await s.shot('07-three-source-mix', shotsF);
    results.checks.push(`mix: ${labels.map(l => l.replace(/\s+/g, ' ')).join(' | ')}`);
    await s.noCrash('mix');
  } finally { await s.close(); }
}

// N7: drag the Footman's hand on the result; This moment writes a fix with its diamond.
async function aimStory() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 07 aim.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor aim.mdx');
  const s = await session(footman, 'aim'), { page, dialog } = s;
  // The hand: the drawn path's dot (the hand at the shown moment), projected by the view itself.
  const hand = () => page.evaluate(() => {
    const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'), p = window.__mdlxl.preview(root), path = p.props.overlayPaths?.[0];
    if (!path) return null;
    const canvas = root.querySelector('canvas'), box = canvas.getBoundingClientRect(), [x, y] = p.runtime.captureApi.project(path.points[path.marker]), scale = canvas.width / box.width;
    return { x: box.left + x / scale, y: box.top + y / scale, points: path.points };
  });
  const raise = async () => Number(await dialog.locator('input[data-field="offset0"]').inputValue());
  const drag = async (from, dy, during) => {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(from.x + i * 2, from.y - dy * i / 10); await page.waitForTimeout(30); }
    await page.waitForTimeout(600);
    if (during) await during();
    await page.mouse.up(); await page.waitForTimeout(1000);
  };
  try {
    await openTransfer(s);
    await s.parts().getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' });
    await s.openDonor(grunt); await s.animation('Attack - 1');
    await dialog.locator('input[data-part-switch="armL"]').click(); await page.waitForTimeout(800);
    await dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }).click();
    const ruler = await dialog.getByLabel('Time', { exact: true }).boundingBox();
    await page.mouse.click(ruler.x + ruler.width * 0.45, ruler.y + ruler.height / 2); await page.waitForTimeout(1000);
    const start = await hand();
    assert.ok(start, 'aim: the hand path is drawn');
    let during;
    await drag(start, 70, async () => { during = (await hand()).points; await s.shot('04-hand-mid-drag', shots4); await s.shot('03-hand-mid-drag', shotsF); });
    assert.ok(pathMoved(start.points, during), 'aim: the arm and its path follow during the drag');
    const raised = await raise();
    assert.notEqual(raised, 0, `aim: dragging the hand up changes Raise (${raised})`);
    results.checks.push(`aim: dragging the hand sets Raise ${raised}°; the arm follows during the drag`);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
    assert.equal(await raise(), 0, 'aim: one Ctrl+Z restores Raise');
    // This moment: a fix at the paused time, its diamond on the lane; other moments keep their pose.
    await dialog.getByRole('button', { name: 'This moment' }).click(); await page.waitForTimeout(200);
    const before = await hand();
    await drag(before, 60);
    assert.equal(await dialog.locator('.xt-fix').count(), 1, 'aim: This moment puts a diamond on the lane');
    assert.equal(await raise(), 0, 'aim: This moment leaves the whole-movement Raise alone');
    const after = (await hand()).points, far = 0;
    assert.ok(Math.hypot(...[0, 1, 2].map(a => after[far][a] - before.points[far][a])) < 1, 'aim: the pose at the start of the animation is unchanged');
    assert.ok(pathMoved(before.points, after), 'aim: the hand moves at the fixed moment');
    await s.shot('05-moment-fix', shots4);
    await s.shot('04-moment-fix', shotsF);
    await dialog.getByRole('button', { name: 'Clear fixes' }).click(); await page.waitForTimeout(500);
    assert.equal(await dialog.locator('.xt-fix').count(), 0, 'aim: Clear fixes removes it');
    results.checks.push('aim: This moment writes a fix with a diamond, the start pose stays, Clear fixes removes it');
    await s.noCrash('aim');
  } finally { await s.close(); }
}

// N8: the Kurgan Warlord takes only his weapon arm from the Footman's attack; both hands stay on the hammer.
async function weaponStory() {
  const kurgan = fixturePath('transfer-kurgan');
  if (!kurgan || !fs.existsSync(kurgan)) { results.checks.push('weapon: the Kurgan Warlord is not on this machine, skipped'); return; }
  const copy = path.join(out, 'TEST TRANSFER 08 kurgan.mdx'); fs.copyFileSync(kurgan, copy);
  const footman = copyModel('transfer-footman', 'footman donor kurgan.mdx');
  const s = await session(copy, 'weapon'), { page, dialog } = s;
  try {
    await openTransfer(s);
    await s.openDonor(footman); await s.animation('Attack - 1');
    const weaponArm = await page.evaluate(() => null) || 'armR';
    await dialog.locator(`input[data-part-switch="${weaponArm}"]`).click(); await page.waitForTimeout(1200);
    const both = dialog.getByLabel('Both hands on the weapon');
    assert.equal(await both.count(), 1, 'weapon: Both hands on the weapon is shown');
    assert.equal(await both.isChecked(), true, 'weapon: and on');
    assert.equal(await dialog.getByLabel('Keep weapon above the ground').count(), 1, 'weapon: Keep weapon above the ground is shown');
    assert.equal(await dialog.getByLabel('Point weapon like theirs').count(), 1, 'weapon: Point weapon like theirs is shown (the Footman holds a sword)');
    assert.match(await dialog.locator('button[data-part="armL"]').innerText(), /holds the weapon/, 'weapon: the other arm says it holds the weapon');
    await dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }).click();
    const ruler = await dialog.getByLabel('Time', { exact: true }).boundingBox();
    await page.mouse.click(ruler.x + ruler.width * 0.45, ruler.y + ruler.height / 2); await page.waitForTimeout(1200);
    await noScroll(s, 'Kurgan weapon arm');
    await s.shot('06-kurgan-both-hands', shots4);
    await s.shot('05-kurgan-weapon-arm', shotsF);
    for (const label of ['Both hands on the weapon', 'Keep weapon above the ground', 'Point weapon like theirs']) {
      const box = dialog.getByLabel(label), was = await box.isChecked();
      await box.click(); await page.waitForTimeout(400); assert.equal(await box.isChecked(), !was, label + ' switches');
      await box.click(); await page.waitForTimeout(400); assert.equal(await box.isChecked(), was, label + ' switches back');
      await s.noCrash(label);
    }
    results.checks.push('weapon: the weapon arm\'s controls fit without scrolling; each weapon switch turns off and on');
    results.checks.push('weapon: Kurgan takes the weapon arm; the three weapon switches show, both hands on, the other arm holds the weapon');
    await s.noCrash('weapon');
  } finally { await s.close(); }
}

// N9: a setup saved on the Footman (Grunt's attack arm) is kept, cleared, loaded back, saved to a
// file, and loaded on the Lord of Change, which reopens the Grunt by its path.
async function setupStory() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 09 setup.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor setup.mdx');
  const setupFile = path.join(out, 'grunt swing.mdlxl-preset');
  if (fs.existsSync(setupFile)) fs.unlinkSync(setupFile);
  let s = await session(footman, 'setup'), { page, dialog } = s;
  try {
    await openTransfer(s);
    await s.parts().getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' });
    await s.openDonor(grunt); await s.animation('Attack - 1');
    await dialog.locator('input[data-part-switch="armL"]').click(); await page.waitForTimeout(500);
    await s.dragSlider('amount', 0.85);
    const amount = await dialog.locator('input[data-field="amount"]').inputValue();
    await dialog.getByRole('button', { name: 'Save as…' }).click();
    await dialog.getByLabel('Preset name').fill('Grunt swing');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(300);
    await dialog.getByText('Grunt swing saved.').waitFor();
    await dialog.getByRole('button', { name: 'Clear all' }).click(); await page.waitForTimeout(300);
    assert.equal(await dialog.locator('input[data-part-switch]:checked').count(), 0, 'setup: cleared');
    await dialog.getByRole('button', { name: 'Load from…' }).click();
    await dialog.locator('.xf-setups button', { hasText: 'Grunt swing' }).click(); await page.waitForTimeout(1500);
    assert.equal(await dialog.locator('input[data-part-switch="armL"]').isChecked(), true, 'setup: loading takes the arm again');
    await dialog.locator('button[data-part="armL"]').click(); await page.waitForTimeout(200);
    assert.equal(await dialog.locator('input[data-field="amount"]').inputValue(), amount, 'setup: with its Strength');
    await stubDialogs(s.app, { save: setupFile });
    await dialog.getByRole('button', { name: 'Save as…' }).click();
    await dialog.getByLabel('Preset name').fill('Grunt swing');
    await dialog.getByRole('button', { name: 'Save to file…' }).click();
    for (let i = 0; i < 40 && !fs.existsSync(setupFile); i++) await page.waitForTimeout(250);
    assert.ok(fs.existsSync(setupFile), 'setup: Save to file wrote it');
    const saved = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
    assert.equal(saved.parts.armL.animation, 'Attack - 1', 'setup: animations by name');
    assert.match(Object.values(saved.sources)[0].path, /grunt donor setup\.mdx$/, 'setup: the donor by its path');
    results.checks.push('setup: Save keeps it, Clear all then Load from brings the arm back with its Strength, Save to file writes paths and names');
    await s.noCrash('setup');
  } finally { await s.close(); }
  const lord = copyModel('transfer-lord-of-change', 'TEST TRANSFER 10 setup lord.mdx');
  s = await session(lord, 'setup-lord'); ({ page, dialog } = s);
  try {
    await openTransfer(s);
    await stubDialogs(s.app, { open: setupFile });
    await dialog.getByRole('button', { name: 'Load from…' }).click();
    await dialog.locator('.xf-setups').getByRole('button', { name: 'Load from file…', exact: true }).click(); await page.waitForTimeout(3000);
    assert.equal(await dialog.locator('input[data-part-switch="armL"]').isChecked(), true, 'setup: on the Lord of Change the arm is taken');
    assert.match(await s.view('Donor').locator('.xf-caption > span').innerText(), /^grunt donor setup$/i, 'setup: the donor caption is the model name');
    assert.equal(await s.view('Donor').getByLabel('Animation in this view').evaluate(e => e.selectedOptions[0].textContent), 'Attack - 1', 'setup: the donor view shows the animation the parts use');
    assert.match(await s.view('Donor').locator('.xf-caption > span').innerText(), /grunt donor setup/i, 'setup: the Grunt reopened by its path');
    await dialog.locator('button[data-part="armL"]').click(); await page.waitForTimeout(300);
    assert.equal(await dialog.locator('.xf-part-controls button', { hasText: 'Take from' }).count(), 0, 'setup: no Take from button by itself');
    await s.shot('07-setup-on-lord-of-change', shots4);
    results.checks.push(`setup: loaded on the Lord of Change, the Grunt reopens by path (${await dialog.locator('.xf-setup-bar .preset-bar-status').innerText()})`);
    await s.noCrash('setup on lord');
  } finally { await s.close(); }
}

// The same arm story under a dark theme: path, ghost, lanes and diamonds must read.
async function darkStory() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 11 dark.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor dark.mdx');
  const s = await session(footman, 'dark', { preferences: { theme: 'dark' } }), { page, dialog } = s;
  try {
    await openTransfer(s, 'transplant');
    const shotsT = path.resolve(process.env.MDLXL_TRANSPLANT_SHOTS || 'out/transplant-ui'); fs.mkdirSync(shotsT, { recursive: true });
    await s.shot('00-just-opened-dark', shotsT);
    await dialog.locator('button[data-mode="retarget"]').click(); await s.parts().waitFor(); await page.waitForTimeout(300);
    await s.parts().getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' });
    await s.openDonor(grunt); await s.animation('Attack - 1');
    await dialog.locator('input[data-part-switch="armL"]').click(); await page.waitForTimeout(800);
    await dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }).click();
    const ruler = await dialog.getByLabel('Time', { exact: true }).boundingBox();
    await page.mouse.click(ruler.x + ruler.width * 0.45, ruler.y + ruler.height / 2); await page.waitForTimeout(1000);
    await dialog.getByRole('button', { name: 'This moment' }).click();
    const hand = await page.evaluate(() => { const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'), p = window.__mdlxl.preview(root), path = p.props.overlayPaths[0], canvas = root.querySelector('canvas'), box = canvas.getBoundingClientRect(), [x, y] = p.runtime.captureApi.project(path.points[path.marker]), scale = canvas.width / box.width; return { x: box.left + x / scale, y: box.top + y / scale }; });
    await page.mouse.move(hand.x, hand.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(hand.x + i * 2, hand.y - 6 * i); await page.waitForTimeout(30); }
    await page.waitForTimeout(600);
    await s.shot('03-hand-mid-drag-dark', shotsF);
    await page.mouse.up(); await page.waitForTimeout(1000);
    assert.equal(await dialog.locator('.xt-fix').count(), 1, 'dark: the moment fix has its diamond');
    await page.mouse.click(ruler.x + ruler.width * 0.2, ruler.y + ruler.height / 2); await page.waitForTimeout(800);
    await noScroll(s, 'dark arm');
    await s.shot('08-story-b-dark', shotsF);
    results.checks.push('dark: the arm story under the dark theme, mid-drag ghost and fix diamond shot');
    await s.noCrash('dark');
  } finally { await s.close(); }
}

// Every control added in rounds 3 and 4, clicked or dragged, watching for errors.
async function sweep34() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 12 sweep34.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor sweep34.mdx');
  const setupFile = path.join(out, 'sweep34.mdlxl-preset');
  if (fs.existsSync(setupFile)) fs.unlinkSync(setupFile);
  const s = await session(footman, 'sweep34'), { page, dialog } = s, clicked = [];
  const click = async (locator, what) => { await locator.click(); await page.waitForTimeout(300); clicked.push(what); await s.noCrash(what); };
  const drag = async (locator, dx, what) => { const b = await locator.boundingBox(), x = b.x + b.width - 3, y = b.y + b.height / 2; await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(x + dx * i / 8, y); await page.waitForTimeout(25); } await page.mouse.up(); await page.waitForTimeout(800); clicked.push(what); await s.noCrash(what); };
  try {
    await openTransfer(s);
    await s.openDonor(grunt); await s.animation('Attack - 1');
    await click(dialog.locator('input[data-part-switch="armL"]'), 'take Left arm');
    await click(s.from().getByRole('button', { name: 'This model' }), 'This model'); await s.animation('Stand Victory');
    await click(dialog.locator('input[data-part-switch="head"]'), 'take Head');
    // Timeline: scrub, both clip drags, lane labels.
    const ruler = dialog.getByLabel('Time', { exact: true }), rb = await ruler.boundingBox();
    await page.mouse.move(rb.x + 5, rb.y + rb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(rb.x + rb.width * i / 9, rb.y + rb.height / 2); await page.waitForTimeout(20); }
    await page.mouse.up(); clicked.push('timeline scrub'); await s.noCrash('scrub');
    for (const label of await dialog.locator('.xt-lane:not(.xt-body) .xt-label').all()) await click(label, 'lane label');
    const clipMain = dialog.locator('.xt-clip.xt-main').first(), cbx = await clipMain.boundingBox();
    await page.mouse.move(cbx.x + cbx.width * 0.3, cbx.y + cbx.height / 2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(cbx.x + cbx.width * 0.3 + 40 * i / 8, cbx.y + cbx.height / 2); await page.waitForTimeout(25); }
    await page.mouse.up(); await page.waitForTimeout(800); clicked.push('clip drag (Delay)'); await s.noCrash('clip drag');
    await drag(dialog.locator('.xt-clip.xt-main .xt-edge-right').first(), -30, 'clip edge drag (trim)');
    // Aim: scope buttons, a moment fix, its diamond clicked and deleted, Clear fixes.
    await click(dialog.locator('button[data-part="armL"]'), 'select Left arm');
    await click(dialog.getByRole('button', { name: 'Whole movement' }), 'Whole movement');
    await click(dialog.getByRole('button', { name: 'This moment' }), 'This moment');
    await dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }).click().catch(() => {});
    await page.mouse.click(rb.x + rb.width * 0.4, rb.y + rb.height / 2); await page.waitForTimeout(800);
    const hand = await page.evaluate(() => { const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'), p = window.__mdlxl.preview(root), path = p.props.overlayPaths?.[0]; if (!path) return null; const canvas = root.querySelector('canvas'), box = canvas.getBoundingClientRect(), [x, y] = p.runtime.captureApi.project(path.points[path.marker]), scale = canvas.width / box.width; return { x: box.left + x / scale, y: box.top + y / scale }; });
    assert.ok(hand, 'sweep34: the hand path is drawn');
    await page.mouse.move(hand.x, hand.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(hand.x + i * 2, hand.y - 5 * i); await page.waitForTimeout(30); }
    await page.mouse.up(); await page.waitForTimeout(1000); clicked.push('hand drag (This moment)'); await s.noCrash('hand drag');
    const diamond = dialog.locator('.xt-fix').first();
    assert.equal(await dialog.locator('.xt-fix').count(), 1, 'sweep34: a diamond');
    await click(diamond, 'fix diamond');
    await diamond.focus(); await page.keyboard.press('Delete'); await page.waitForTimeout(400); clicked.push('Delete on the diamond');
    assert.equal(await dialog.locator('.xt-fix').count(), 0, 'sweep34: Delete removes the fix');
    await page.mouse.move(hand.x, hand.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(hand.x + i * 2, hand.y - 5 * i); await page.waitForTimeout(30); }
    await page.mouse.up(); await page.waitForTimeout(1000);
    await click(dialog.getByRole('button', { name: 'Clear fixes' }), 'Clear fixes');
    // Setups: Save as (keep), Save to file, Load from (saved and file).
    await click(dialog.getByRole('button', { name: 'Save as…' }), 'Save as…');
    await dialog.getByLabel('Preset name').fill('Sweep setup');
    await click(dialog.getByRole('button', { name: 'Save', exact: true }), 'Save setup');
    await stubDialogs(s.app, { save: setupFile, open: setupFile });
    await click(dialog.getByRole('button', { name: 'Save as…' }), 'Save as… again');
    await dialog.getByLabel('Preset name').fill('Sweep setup');
    await click(dialog.getByRole('button', { name: 'Save to file…' }), 'Save to file…');
    for (let i = 0; i < 40 && !fs.existsSync(setupFile); i++) await page.waitForTimeout(250);
    assert.ok(fs.existsSync(setupFile), 'sweep34: Save to file wrote the setup');
    await click(dialog.getByRole('button', { name: 'Load from…' }), 'Load from…');
    await click(dialog.locator('.xf-setups button', { hasText: 'Sweep setup' }), 'load saved setup'); await page.waitForTimeout(1000);
    await click(dialog.getByRole('button', { name: 'Load from…' }), 'Load from… again');
    await click(dialog.locator('.xf-setups').getByRole('button', { name: 'Load from file…', exact: true }), 'load setup file'); await page.waitForTimeout(1500);
    // Add all from the donor shown.
    await s.from().locator('[data-source^="file:"]').first().click(); await page.waitForTimeout(500);
    await s.animation('Attack - 1');
    const before = await s.count(), addAll = dialog.locator('button[data-hotkey="transfer:add-all"]');
    if (await addAll.isEnabled()) { await click(addAll, 'Add all'); await page.waitForTimeout(2500); assert.ok(await s.count() > before, 'sweep34: Add all adds animations'); await dialog.getByText(/Added \d+ animations/).waitFor(); }
    results.checks.push(`sweep34: ${clicked.length} round 3-4 controls clicked or dragged, no crash or page error`);
    await s.noCrash('sweep34');
  } finally { await s.close(); }
}

// Round 5: each view has its own strip. The donor's dropdown is the Animations list's choice and its
// Pause freezes only the donor; the result's dropdown shows one of the model's own animations without
// touching the recipe; using the timeline brings the new animation back; Speed 50% halves that view only.
async function viewsStory() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 13 views.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor views.mdx');
  const s = await session(footman, 'views'), { page, dialog } = s;
  const strip = name => s.view(name).locator('.xs-strip');
  // How far a view's clock moves in a fixed wait (frames per second, wrapped loops ignored).
  const advance = async name => { const a = (await s.probe(name)).frame; await page.waitForTimeout(800); const b = (await s.probe(name)).frame; return b - a; };
  // Frames per wall-clock second, from short steps with the loop's wrap-arounds left out.
  const steady = async name => { let total = 0, time = 0, last = await page.evaluate(n => ({ f: (() => { const root = document.querySelector(`[role="dialog"][aria-label="Transfer"] section[aria-label="${n}"] .game-preview-root`); return window.__mdlxl.preview(root).runtime.native.getFrame(); })(), t: performance.now() }), name);
    for (let i = 0; i < 16; i++) { await page.waitForTimeout(100); const now = await page.evaluate(n => ({ f: (() => { const root = document.querySelector(`[role="dialog"][aria-label="Transfer"] section[aria-label="${n}"] .game-preview-root`); return window.__mdlxl.preview(root).runtime.native.getFrame(); })(), t: performance.now() }), name); const d = now.f - last.f; if (d > 0) { total += d; time += now.t - last.t; } last = now; }
    return time ? Math.round(total / time * 1000) : 0; };
  try {
    await openTransfer(s);
    await s.openDonor(grunt);
    await page.waitForTimeout(1200);
    await s.shot('01-default', shots5);
    // The donor's dropdown switches its animation, and the Animations list follows.
    await strip('Donor').getByLabel('Animation in this view').selectOption({ label: 'Attack - 1' }); await page.waitForTimeout(600);
    const attack = (await readModel(grunt)).Sequences.findIndex(q => q.Name === 'Attack - 1');
    assert.equal((await s.probe('Donor')).sequence, attack, 'views: the donor dropdown switches the donor animation');
    assert.equal(await s.from().locator(`.xf-animations [data-animation="${attack}"]`).getAttribute('aria-pressed'), 'true', 'views: the Animations list follows');
    await s.from().locator('.xf-animations button', { hasText: /^Walk$|^walk$/ }).first().click(); await page.waitForTimeout(400);
    assert.match(await strip('Donor').getByLabel('Animation in this view').evaluate(e => e.selectedOptions[0].textContent), /walk/i, 'views: the dropdown follows the Animations list');
    await strip('Donor').getByLabel('Animation in this view').selectOption({ label: 'Attack - 1' }); await page.waitForTimeout(400);
    // Donor Pause freezes the donor; the result keeps playing.
    await strip('Donor').getByRole('button', { name: 'Pause' }).click(); await page.waitForTimeout(300);
    assert.equal(await advance('Donor'), 0, 'views: donor Pause freezes the donor');
    assert.ok(Math.abs(await advance('Result')) > 0, 'views: the result keeps playing');
    await strip('Donor').getByRole('button', { name: 'Play' }).click(); await page.waitForTimeout(300);
    results.checks.push('views: the donor dropdown and the Animations list are one choice; donor Pause freezes only the donor');
    // Speed 50% roughly halves that view's advance only.
    // Measured on the Grunt's looping walk, so the clock never stops at an end.
    await strip('Donor').getByLabel('Animation in this view').selectOption({ label: 'walk' }); await page.waitForTimeout(600);
    const donorFull = await steady('Donor'), resultFull = await steady('Result');
    await strip('Donor').getByLabel('Viewing speed').selectOption('50'); await page.waitForTimeout(400);
    const donorHalf = await steady('Donor'), resultSame = await steady('Result');
    assert.ok(donorHalf > donorFull * 0.3 && donorHalf < donorFull * 0.7, `views: donor Speed 50% halves its advance (${donorFull} -> ${donorHalf})`);
    assert.ok(resultSame > resultFull * 0.75, `views: the result keeps its speed (${resultFull} -> ${resultSame})`);
    await strip('Donor').getByLabel('Viewing speed').selectOption('100');
    results.checks.push(`views: donor Speed 50% halves its advance (${donorFull} -> ${donorHalf} ms per second), the result keeps ${resultSame}`);
    // Whole body, both views playing different things.
    await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(1500);
    await strip('Donor').getByLabel('Animation in this view').selectOption({ label: 'walk' }); await page.waitForTimeout(1200);
    await s.shot('02-whole-body-both-playing', shots5);
    // The result shows one of the model's own animations: handles off, recipe and Body animation unchanged.
    const body = await s.parts().getByLabel('Body animation', { exact: true }).inputValue(), takenBefore = await dialog.locator('input[data-part-switch]:checked').count(), countBefore = await s.count();
    const cameraOf = async name => { const c = (await s.probe(name)).camera.object; return c.matrix.map(v => Math.round(v * 100) / 100).join(',') + ' zoom ' + c.zoom; };
    const cameraBefore = await cameraOf('Result'), donorCameraBefore = await cameraOf('Donor');
    await strip('Result').getByLabel('Animation in this view').selectOption({ label: 'Walk' }); await page.waitForTimeout(1000);
    assert.equal(await cameraOf('Result'), cameraBefore, 'views: showing an own animation keeps the result camera');
    assert.equal(await cameraOf('Donor'), donorCameraBefore, 'views: and the donor camera');
    const own = await s.probe('Result'), walk = (await readModel(footman)).Sequences.findIndex(q => q.Name === 'Walk');
    assert.equal(own.sequence, walk, 'views: the result plays the model\'s own Walk');
    assert.equal(own.config, null, 'views: no handles while an own animation is shown');
    assert.equal(await dialog.locator('.xt-timeline').getAttribute('aria-disabled'), 'true', 'views: the timeline is dimmed');
    assert.equal(await s.parts().getByLabel('Body animation', { exact: true }).inputValue(), body, 'views: Body animation unchanged');
    assert.equal(await dialog.locator('input[data-part-switch]:checked').count(), takenBefore, 'views: the taken parts unchanged');
    assert.equal(await s.count(), countBefore, 'views: the model unchanged');
    await s.shot('03-result-own-animation', shots5);
    // A timeline click brings the new animation back.
    const ruler = await dialog.getByLabel('Time', { exact: true }).boundingBox();
    await page.mouse.click(ruler.x + ruler.width * 0.3, ruler.y + ruler.height / 2); await page.waitForTimeout(800);
    assert.equal(await strip('Result').getByLabel('Animation in this view').inputValue(), 'new', 'views: using the timeline returns to New animation');
    assert.notEqual((await s.probe('Result')).sequence, walk, 'views: the result plays the new animation again');
    assert.equal(await dialog.locator('.xt-timeline').getAttribute('aria-disabled'), null, 'views: the timeline is active again');
    assert.equal(await cameraOf('Result'), cameraBefore, 'views: returning to New animation keeps the result camera');
    // Picking an own animation then moving a slider returns too.
    await strip('Result').getByLabel('Animation in this view').selectOption({ label: 'Walk' }); await page.waitForTimeout(500);
    await dialog.locator('button[data-part="armL"]').click(); await page.waitForTimeout(300);
    await s.dragSlider('amount', 0.8);
    assert.equal(await strip('Result').getByLabel('Animation in this view').inputValue(), 'new', 'views: a slider change returns to New animation');
    results.checks.push('views: the result shows the model\'s own Walk with no handles, recipe and Body animation unchanged; the timeline and a slider bring the new animation back');
    // An arm selected with its path, for the pictures.
    await dialog.locator('button[data-part="armL"]').click(); await page.waitForTimeout(800);
    await s.shot('04-arm-selected-path', shots5);
    // Choosing another donor never moves the result's viewpoint; the new donor view faces the same way.
    const facing = async name => { const m = (await s.probe(name)).camera.object.matrix; return [m[8], m[9], m[10]]; };
    const resultCamera = await cameraOf('Result'), donorRow = await s.from().locator('[data-source]').evaluateAll(rows => rows.findIndex(row => row.classList.contains('selected')));
    await s.from().locator('[data-source="self"]').click(); await page.waitForTimeout(1500);
    assert.equal(await cameraOf('Result'), resultCamera, 'views: choosing another donor keeps the result camera');
    const fa = await facing('Donor'), fb = await facing('Result');
    assert.ok(fa[0] * fb[0] + fa[1] * fb[1] + fa[2] * fb[2] > 0.999, 'views: the new donor view faces the same way as the result');
    await s.from().locator('[data-source]').nth(donorRow).click(); await page.waitForTimeout(1500);
    assert.equal(await cameraOf('Result'), resultCamera, 'views: and choosing the first donor again');
    results.checks.push('views: choosing another donor keeps the result viewpoint; the donor view takes the same direction');
    // Reset view (the small button at the end of each scrubber): after turning, zooming and panning, one
    // click gives the view a new model opens with, and the other view turns back with it.
    const opening = [1, -1.5, .9].map(v => v / Math.hypot(1, 1.5, .9)), lens = async name => (await s.probe(name)).camera.object.zoom ?? 1;
    for (const name of ['Result', 'Donor']) {
      const box = await s.view(name).locator('.xf-preview').boundingBox(), framed = await cameraOf(name);
      await s.dragCamera(name); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
      await page.mouse.down({ button: 'right' }); await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 40, { steps: 6 }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(300);
      assert.notEqual(await cameraOf(name), framed, `views: the ${name} view was turned, zoomed and moved`);
      await strip(name).getByRole('button', { name: name === 'Donor' ? 'Reset donor view' : 'Reset view', exact: true }).click(); await page.waitForTimeout(500);
      const now = await facing(name), far = await facing(name === 'Donor' ? 'Result' : 'Donor');
      assert.ok(now[0] * opening[0] + now[1] * opening[1] + now[2] * opening[2] > 0.999, `views: Reset view turns the ${name} view back to the opening angle`);
      assert.ok(far[0] * opening[0] + far[1] * opening[1] + far[2] * opening[2] > 0.999, `views: and the other view with it`);
      assert.ok(Math.abs(await lens(name) - 1) < 0.001, `views: Reset view undoes the ${name} view's zoom`);
    }
    results.checks.push('views: Reset view beside each scrubber undoes turning, zoom and panning; the other view turns back with it');
    await s.noCrash('views');
  } finally { await s.close(); }
  // The same window under the dark theme.
  const footman2 = copyModel('transfer-footman', 'TEST TRANSFER 14 views dark.mdx'), grunt2 = copyModel('transfer-grunt', 'grunt donor views dark.mdx');
  const d = await session(footman2, 'views-dark', { preferences: { theme: 'dark' } });
  try {
    await openTransfer(d);
    await d.openDonor(grunt2);
    await d.view('Donor').locator('.xs-strip').getByLabel('Animation in this view').selectOption({ label: 'Attack - 1' }); await d.page.waitForTimeout(400);
    await d.dialog.locator('input[data-part-switch="armL"]').click(); await d.page.waitForTimeout(1200);
    await d.shot('05-dark', shots5);
    await d.noCrash('views dark');
  } finally { await d.close(); }
}

// Round 7: the three switches, trim by the clip edges, Add after (chained clips) and setups that carry
// all of it. The window's recipe is read through the test hook (window.__mdlxl.transfer()); the result's
// motion through a checksum of its preview model and swapped tracks.
async function round7Story() {
  const recipeOf = page => page.evaluate(() => window.__mdlxl.transfer());
  const motion = page => page.evaluate(() => {
    const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'), p = window.__mdlxl.preview(root).props;
    let sum = 0, n = 0;
    const add = track => { for (const key of track?.Keys || []) { const v = key.Vector || []; for (let i = 0; i < v.length; i++) sum += v[i] * (++n % 97 + 1); } };
    // Each joint's effective track: a swapped-in live track wins over the preview copy's own.
    const live = new Map((p.liveNodeTracks || []).map(item => [item.id + ':' + item.property, item.track]));
    for (const bone of [...(p.model.Bones || []), ...(p.model.Helpers || [])]) for (const property of ['Rotation', 'Translation']) add(live.get(bone.ObjectId + ':' + property) || bone[property]);
    return Math.round(sum * 1000) / 1000;
  });
  const ruler = async dialog => Number(await dialog.getByLabel('Time', { exact: true }).getAttribute('aria-valuemax'));
  const check = async (dialog, page, label) => { await dialog.getByText(label, { exact: true }).click(); await page.waitForTimeout(1500); };
  // (a) Range and Keep arm out of the body: the Abomination takes the Demon Hunter's attack.
  {
    const abom = copyModel('transfer-abomination', 'TEST TRANSFER 15 switches.mdx'), hunter = copyModel('transfer-demon-hunter', 'demon hunter r7.mdx');
    const hunterModel = await readModel(hunter), attack = hunterModel.Sequences.find(q => /^attack/i.test(q.Name) && !/alternate/i.test(q.Name))?.Name;
    assert.ok(attack, 'round7: the Demon Hunter has an attack');
    const s = await session(abom, 'round7-switches'), { page, dialog } = s;
    try {
      await openTransfer(s); await s.openDonor(hunter); await s.animation(attack);
      // Whole body: the arms go into the trunk in this attack (engine measurements, round 7).
      await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(1500);
      const all = s.parts().locator('[role="group"][aria-label="All taken parts"]');
      let before = await motion(page);
      await check(all, page, 'Keep arm out of the body');
      let parts = (await recipeOf(page)).recipe.parts;
      assert.deepEqual([parts.armL.avoid, parts.armR.avoid], [1, 1], 'round7: Keep arm out of the body sets avoid on both arms');
      let after = await motion(page);
      assert.notEqual(after, before, 'round7: Keep arm out of the body changes the motion of the arms');
      await dialog.locator('button[data-part="armL"]').click(); await page.waitForTimeout(300);
      const arm = s.parts().locator('[role="group"][aria-label="Left arm"]');
      for (const label of ['Stay in own range', 'Keep arm out of the body']) assert.equal(await arm.getByText(label, { exact: true }).count(), 1, `round7: an arm shows ${label}`);
      assert.equal((await recipeOf(page)).recipe.parts.armL.range, 0, 'round7: new transfers keep Stay in own range off');
      await s.shot('01-switches-on-an-arm', shots7);
      before = after;
      await check(arm, page, 'Stay in own range');
      assert.equal((await recipeOf(page)).recipe.parts.armL.range, 1, 'round7: Stay in own range sets range');
      assert.notEqual(await motion(page), before, 'round7: Stay in own range changes the motion of the arm');
      await check(arm, page, 'Keep arm out of the body');
      assert.equal((await recipeOf(page)).recipe.parts.armL.avoid, 0, 'round7: the switch of the arm turns avoid off for that arm');
      await check(arm, page, 'Stay in own range');
      assert.equal((await recipeOf(page)).recipe.parts.armL.range, 0, 'round7: and range off again');
      results.checks.push('round7: on the Abomination with the Demon Hunter\'s attack, Keep arm out of the body (All, whole body) sets avoid on both arms and Stay in own range (Left arm) sets range; each changes the motion');
      await s.noCrash('round7 switches');
    } finally { await s.close(); }
  }
  // (a) The two switches in All taken parts on a whole body (Pads and cloth follow became the Own features list in round 8).
  {
    const warrior = copyModel('glow-dual-weapon', 'TEST TRANSFER 16 follow.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor r7 follow.mdx');
    const s = await session(warrior, 'round7-follow'), { page, dialog } = s;
    try {
      await openTransfer(s); await s.openDonor(grunt); await s.animation('Attack - 1');
      await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(1500);
      const all = s.parts().locator('[role="group"][aria-label="All taken parts"]');
      for (const label of ['Stay in own range', 'Keep arm out of the body']) assert.equal(await all.getByText(label, { exact: true }).count(), 1, `round7: All taken parts shows ${label}`);
      assert.equal(await s.parts().getByText('Pads and cloth follow', { exact: true }).count(), 0, 'round8: Pads and cloth follow is gone from All taken parts');
      await s.shot('02-all-taken-parts-switches', shots7);
      results.checks.push('round7: All taken parts on the Slaanesh warrior shows Stay in own range and Keep arm out of the body; Pads and cloth follow is gone (round 8)');
      await s.noCrash('round7 follow');
    } finally { await s.close(); }
  }
  // (b)-(e) Trim, Add after and setups on the Footman with the Grunt.
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 17 trim chain.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor r7.mdx');
  const oldSetup = path.join(out, 'old setup r7.mdlxl-preset');
  fs.writeFileSync(oldSetup, JSON.stringify({ kind: 'mdlxl-transfer-setup', version: 1, name: 'Old swing', body: 'Stand - 1', length: null, sources: { g: { kind: 'file', path: grunt, name: 'grunt donor r7.mdx', mirror: null } },
    parts: { armL: { from: null, flip: false, amount: 0.8, match: 0, offset: [5, 0, 0], start: 0, speed: 1, loop: null, blend: 150, plant: true, travel: 1, fixes: [], grip: null, clear: null, aim: null, source: 'g', animation: 'Attack - 1' } } }));
  let s = await session(footman, 'round7'), { page, dialog } = s;
  try {
    await openTransfer(s); await s.openDonor(grunt); await s.animation('Attack - 1');
    await dialog.locator('input[data-part-switch="armL"]').click(); await page.waitForTimeout(1200);
    const lengthWhole = await ruler(dialog), cells = await dialog.locator('.xt-lane:not(.xt-body) .xt-cells').first().boundingBox();
    const dragEdge = async (side, fraction) => {
      const e = await dialog.locator(`.xt-clip.xt-main .xt-edge-${side}`).first().boundingBox(), x = e.x + e.width / 2, y = e.y + e.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(x + cells.width * fraction * i / 10, y); await page.waitForTimeout(25); }
      await page.mouse.up(); await page.waitForTimeout(1200);
    };
    await dragEdge('right', -0.2);
    let arm = (await recipeOf(page)).recipe.parts.armL;
    assert.ok(arm.clip && arm.clip[0] === 0 && arm.clip[1] > 0, `round7: the right edge trims the end (${JSON.stringify(arm.clip)})`);
    assert.equal(arm.start, 0, 'round7: a right trim keeps Delay');
    const lengthRight = await ruler(dialog);
    assert.ok(lengthRight < lengthWhole - 100, `round7: the result gets shorter (${lengthWhole} -> ${lengthRight} ms)`);
    await dragEdge('left', 0.12);
    arm = (await recipeOf(page)).recipe.parts.armL;
    assert.ok(arm.clip[0] > 0, `round7: the left edge trims the start (${JSON.stringify(arm.clip)})`);
    assert.ok(Math.abs(arm.start - arm.clip[0] / arm.speed) <= 1, `round7: the kept part stays in time: Delay = cut / Speed (${arm.start} ms)`);
    assert.ok(Math.abs(await ruler(dialog) - lengthRight) <= 2, 'round7: a left trim does not move the end');
    assert.equal(await dialog.locator('.xt-clip.xt-main.xt-cut-left.xt-cut-right').count(), 1, 'round7: the cut ends are drawn as cut');
    await s.shot('03-trimmed-clip', shots7);
    const dbl = async side => { const e = await dialog.locator(`.xt-clip.xt-main .xt-edge-${side}`).first().boundingBox(); await page.mouse.dblclick(e.x + e.width / 2, e.y + e.height / 2); await page.waitForTimeout(1200); };
    await dbl('left');
    arm = (await recipeOf(page)).recipe.parts.armL;
    assert.ok(arm.clip && arm.clip[0] === 0 && arm.start === 0, `round7: double-click puts the start back (${JSON.stringify(arm.clip)}, Delay ${arm.start})`);
    await dbl('right');
    assert.equal((await recipeOf(page)).recipe.parts.armL.clip, null, 'round7: and the end: the clip is whole again');
    assert.equal(await ruler(dialog), lengthWhole, 'round7: with its whole length');
    results.checks.push(`round7: trimming the right edge shortens the result (${lengthWhole} -> ${lengthRight} ms), the left edge moves Delay by the cut, double-clicks restore both ends`);

    // (c) Add after with the whole body taken.
    await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(1500);
    const firstLength = await ruler(dialog), firstLanes = await dialog.locator('.xt-lane:not(.xt-body)').count();
    await s.animation('Attack - 2');
    await s.parts().getByRole('button', { name: 'Add after' }).click(); await page.waitForTimeout(2000);
    let state = await recipeOf(page);
    const takenKeys = Object.keys(state.recipe.parts), attack2 = (await readModel(grunt)).Sequences.findIndex(q => q.Name === 'Attack - 2');
    for (const key of takenKeys) {
      const next = state.recipe.parts[key].next;
      assert.equal(next?.length, 1, `round7: Add after chains a clip on ${key}`);
      assert.equal(next[0].sequence, attack2, `round7: from the donor view's animation (${key})`);
      assert.equal(next[0].start, firstLength - 150, `round7: starting 150 ms before the result ended (${key})`);
      assert.equal(next[0].blend, 150);
    }
    assert.ok(await ruler(dialog) > firstLength + 300, `round7: the result gets longer (${firstLength} -> ${await ruler(dialog)} ms)`);
    const chained = dialog.locator('.xt-lane[data-clip-index="1"]');
    assert.ok(await chained.count() >= 1, 'round7: the chained clips have lanes of their own');
    assert.equal(await dialog.locator('.xt-lane:not(.xt-body)').count(), firstLanes + await chained.count(), 'round7: one more lane per clip group');
    assert.match(await dialog.locator('button[data-part="armL"] small').innerText(), /Attack - 1, then Attack - 2/, 'round7: the parts list names the clips in order');
    // The second lane selected: Strength edits that clip only; Whole movement and This moment hide.
    await chained.first().locator('.xt-label').click(); await page.waitForTimeout(400);
    state = await recipeOf(page);
    assert.equal(state.clip, 1, 'round7: selecting a chained lane selects that clip');
    assert.equal(await s.parts().getByRole('button', { name: 'This moment' }).count(), 0, 'round7: no This moment on a chained clip');
    const amountsBefore = Object.fromEntries(takenKeys.map(key => [key, [state.recipe.parts[key].amount, state.recipe.parts[key].next[0].amount]]));
    await s.dragSlider('amount', 0.3); await page.waitForTimeout(800);
    state = await recipeOf(page);
    const changedKeys = takenKeys.filter(key => state.recipe.parts[key].next[0].amount !== amountsBefore[key][1]);
    assert.ok(changedKeys.length > 0, 'round7: Strength changes the chained clip');
    for (const key of takenKeys) assert.equal(state.recipe.parts[key].amount, amountsBefore[key][0], `round7: and not the first clip of ${key}`);
    await s.shot('04-two-chained-lanes-second-selected', shots7);
    results.checks.push(`round7: Add after chains Attack - 2 on ${takenKeys.length} parts at ${firstLength - 150} ms with a 150 ms hand-over, lanes per clip, the parts list says "then"; Strength on the second lane changes only the second clip`);

    // (d) A setup round trip keeps the switches, a trim and the chain.
    await dialog.locator('button[data-part="armL"]').click(); await page.waitForTimeout(300);
    await check(s.parts().locator('[role="group"][aria-label="Left arm"]'), page, 'Stay in own range');
    await dragEdge('right', -0.05);
    const keep = JSON.stringify((await recipeOf(page)).recipe.parts);
    assert.match(keep, /"range":1/); assert.match(keep, /"clip":\[/); assert.match(keep, /"next":\[/);
    await dialog.getByRole('button', { name: 'Save as…' }).click();
    await dialog.getByLabel('Preset name').fill('Chain r7');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(300);
    await dialog.getByRole('button', { name: 'Clear all' }).click(); await page.waitForTimeout(500);
    await dialog.getByRole('button', { name: 'Load from…' }).click();
    await dialog.locator('.xf-setups button', { hasText: 'Chain r7' }).click(); await page.waitForTimeout(2000);
    assert.deepEqual((await recipeOf(page)).recipe.parts, JSON.parse(keep), 'round7: a saved setup brings back switches, trims and chained clips exactly');
    results.checks.push('round7: Save as / Load from keeps range, the trim and the chained clips');

    // Removing chained clips: the x on a lane, and Delete while a chained lane is selected.
    const chainedLanes = await chained.count();
    await chained.first().locator('.xt-remove').click(); await page.waitForTimeout(1200);
    assert.equal(await chained.count(), chainedLanes - 1, 'round7: the x removes that clip');
    if (await chained.count()) {
      const keysLeft = Object.entries((await recipeOf(page)).recipe.parts).filter(([, part]) => part.next).length;
      await chained.first().locator('.xt-label').click(); await page.waitForTimeout(300);
      await page.keyboard.press('Delete'); await page.waitForTimeout(1200);
      assert.ok(Object.entries((await recipeOf(page)).recipe.parts).filter(([, part]) => part.next).length < keysLeft, 'round7: Delete removes the selected chained clip');
    } else {
      await s.parts().getByRole('button', { name: 'Add after' }).click(); await page.waitForTimeout(1500);
      await chained.first().locator('.xt-label').click(); await page.waitForTimeout(300);
      await page.keyboard.press('Delete'); await page.waitForTimeout(1200);
      assert.equal(await chained.count(), 0, 'round7: Delete removes the selected chained clip');
    }
    assert.ok(Object.values((await recipeOf(page)).recipe.parts).every(part => part.amount != null), 'round7: the first clips stay');
    results.checks.push('round7: the x on a chained lane and Delete on a selected chained lane remove that clip');

    // (e) An old setup without the new fields loads to the same recipe as before.
    await dialog.getByRole('button', { name: 'Clear all' }).click(); await page.waitForTimeout(500);
    await stubDialogs(s.app, { open: oldSetup });
    await dialog.getByRole('button', { name: 'Load from…' }).click();
    await dialog.locator('.xf-setups').getByRole('button', { name: 'Load from file…', exact: true }).click(); await page.waitForTimeout(2500);
    const loaded = (await recipeOf(page)).recipe, gruntAttack = (await readModel(grunt)).Sequences.findIndex(q => q.Name === 'Attack - 1');
    const expected = { from: null, flip: false, amount: 0.8, match: 0, offset: [5, 0, 0], start: 0, speed: 1, loop: null, blend: 150, plant: true, travel: 1, fixes: [], grip: null, clear: null, aim: null, source: loaded.parts.armL?.source, sequence: gruntAttack };
    assert.deepEqual(loaded.parts, { armL: expected }, 'round7: an old setup gives exactly the old recipe (no new fields added)');
    results.checks.push('round7: an old setup without the new fields loads to the same recipe as before');
    await s.noCrash('round7');
  } finally { await s.close(); }
  // Dark theme: a trimmed first clip and a chained one.
  const footman2 = copyModel('transfer-footman', 'TEST TRANSFER 18 r7 dark.mdx'), grunt2 = copyModel('transfer-grunt', 'grunt donor r7 dark.mdx');
  const d = await session(footman2, 'round7-dark', { preferences: { theme: 'dark' } });
  try {
    await openTransfer(d); await d.openDonor(grunt2); await d.animation('Attack - 1');
    await d.dialog.locator('input[data-part-switch="armL"]').click(); await d.page.waitForTimeout(1000);
    await d.animation('Attack - 2');
    await d.parts().getByRole('button', { name: 'Add after' }).click(); await d.page.waitForTimeout(1500);
    await d.dialog.locator('.xt-lane[data-clip-index="1"] .xt-label').first().click(); await d.page.waitForTimeout(800);
    await d.shot('05-dark', shots7);
    await d.noCrash('round7 dark');
  } finally { await d.close(); }
}

// Round 7b: a model that is two creatures (a rider on a mount) is read as Both, Rider or Mount, on the
// donor (sources[id].actor) and on the open model (base.actor). Real mouse input; the window's recipe
// through the test hook; the result's motion through a checksum of its preview.
async function ridersStory() {
  const recipeOf = page => page.evaluate(() => window.__mdlxl.transfer().recipe);
  const motion = page => page.evaluate(() => {
    const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'), p = window.__mdlxl.preview(root).props;
    let sum = 0, n = 0;
    const add = track => { for (const key of track?.Keys || []) { const v = key.Vector || []; for (let i = 0; i < v.length; i++) sum += v[i] * (++n % 97 + 1); } };
    // Each joint's effective track: a swapped-in live track wins over the preview copy's own.
    const live = new Map((p.liveNodeTracks || []).map(item => [item.id + ':' + item.property, item.track]));
    for (const bone of [...(p.model.Bones || []), ...(p.model.Helpers || [])]) for (const property of ['Rotation', 'Translation']) add(live.get(bone.ObjectId + ':' + property) || bone[property]);
    return Math.round(sum * 1000) / 1000;
  });
  const { rigFor } = await import('../src/transfer-window.js');
  const chooser = (s, view) => s.view(view).locator('.xf-caption button[data-actor]');
  const pick = async (s, view, actor) => { await s.view(view).locator(`.xf-caption button[data-actor="${actor}"]`).click(); await s.page.waitForTimeout(1500); };
  const checked = async (dialog, key) => dialog.locator(`input[data-part-switch="${key}"]`).isChecked();
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 19 riders.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor riders.mdx'), knight = copyModel('transfer-knight', 'knight donor riders.mdx');
  const knightModel = await readModel(knight), attack = knightModel.Sequences.find(q => /^attack/i.test(q.Name))?.Name;
  assert.ok(attack, 'riders: the Knight has an attack');
  let s = await session(footman, 'riders'), { page, dialog } = s;
  try {
    await openTransfer(s);
    await s.openDonor(grunt);
    assert.equal(await chooser(s, 'Donor').count(), 0, 'riders: no chooser for the Grunt (one creature)');
    assert.equal(await chooser(s, 'Result').count(), 0, 'riders: and none for the Footman');
    await s.openDonor(knight); await s.animation(attack);
    assert.equal(await chooser(s, 'Donor').count(), 3, 'riders: Both, Rider and Mount for the Knight');
    assert.equal(await s.view('Donor').locator('button[data-actor="both"]').getAttribute('aria-pressed'), 'true', 'riders: Both at first');
    await s.shot('01-chooser-on-the-donor-both', shots7b);
    // Both + Take whole body: the rider's upper body; the legs stay (two legs against four).
    await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(1500);
    for (const key of ['chest', 'head', 'armL', 'armR']) assert.equal(await checked(dialog, key), true, `riders: Both takes ${key}`);
    for (const key of ['hips', 'legL', 'legR']) assert.equal(await checked(dialog, key), false, `riders: Both leaves ${key}`);
    assert.match(await s.parts().locator('.xf-reason').innerText(), /number of legs/, 'riders: the sentence about the legs shows');
    results.checks.push('riders: no chooser for the Grunt; the Knight offers Both, Rider, Mount; Both + Take whole body takes chest, head and arms and says why the legs stay');
    // Rider + Take whole body: seven parts, hips and legs at Pose Theirs, the unit sits.
    const standing = await motion(page);
    await pick(s, 'Donor', 'seated');
    await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(2000);
    let recipe = await recipeOf(page);
    const knightId = Object.keys(recipe.sources).find(id => /knight donor riders/.test(id));
    assert.equal(Object.keys(recipe.parts).length, 7, `riders: Rider + Take whole body takes seven parts (${Object.keys(recipe.parts)})`);
    assert.equal(recipe.sources[knightId].actor, 'seated', 'riders: the donor reads as the rider (sources[id].actor)');
    for (const key of ['hips', 'legL', 'legR']) assert.equal(recipe.parts[key].match, 1, `riders: ${key} takes the rider at Pose Theirs`);
    assert.notEqual(await motion(page), standing, 'riders: the result changes: the legs take the seat');
    // A leg's Pose slider shows its `match`; the trunk's shows `stance`, which a seated rider leaves alone (seatedMatch).
    await dialog.locator('button[data-part="legL"]').click(); await page.waitForTimeout(300);
    assert.equal(await dialog.locator('input[data-field="match"]').inputValue(), '100', 'riders: the left leg\'s Pose slider shows Theirs');
    await s.shot('02-rider-whole-body-footman-seated', shots7b);
    const before = await s.count();
    await dialog.getByRole('button', { name: 'Add animation' }).click(); await page.waitForTimeout(1500);
    assert.equal(await s.count(), before + 1, 'riders: Add animation adds the seated animation');
    results.checks.push('riders: Rider + Take whole body takes seven parts with sources[knight].actor = seated and hips and legs at Pose Theirs; the result changes; Add animation adds it');
    // Rider -> Both removes hips and legs with the sentence; Undo brings them back.
    await pick(s, 'Donor', 'both');
    for (const key of ['hips', 'legL', 'legR']) assert.equal(await checked(dialog, key), false, `riders: Both removes ${key}`);
    for (const key of ['chest', 'head', 'armL', 'armR']) assert.equal(await checked(dialog, key), true, `riders: and keeps ${key}`);
    assert.match(await s.parts().locator('.xf-reason').innerText(), /^Removed with this choice: .*Hips/, 'riders: one sentence names what was removed');
    await dialog.locator('.xf-caption').first().click(); await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
    recipe = await recipeOf(page);
    assert.equal(recipe.sources[knightId].actor, 'seated', 'riders: Undo puts Rider back');
    for (const key of ['hips', 'legL', 'legR']) assert.equal(await checked(dialog, key), true, `riders: and ${key}`);
    results.checks.push('riders: Rider -> Both removes hips and legs and names them; one Undo brings Rider and them back');
    // Mount: the donor's handles are the mount's only.
    await pick(s, 'Donor', 'walker');
    const mountRig = rigFor(knightModel, knightModel.Sequences.findIndex(q => q.Name === attack), 'walker'), mountJoints = new Set(Object.values(mountRig.parts).flatMap(part => part.joints));
    const config = (await s.probe('Donor')).config;
    assert.ok(config.chains.length > 0, 'riders: the mount has handles');
    for (const chain of config.chains) assert.ok(mountJoints.has(chain.end) || mountJoints.has(chain.root), `riders: the handle on joint ${chain.end} belongs to the mount`);
    assert.ok(!Object.values(mountRig.parts).some(part => /^arm/.test(part.key)), 'riders: the mount has no arms');
    await s.shot('03-mount', shots7b);
    results.checks.push(`riders: Mount shows the mount's ${config.chains.length} handles only`);
    await s.noCrash('riders');
    // One Undo in the editor removes the added animation.
    await dialog.getByRole('button', { name: 'Cancel' }).click(); await page.waitForTimeout(500);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
    assert.equal(await s.count(), before, 'riders: one Undo removes the added animation');
    results.checks.push('riders: one Undo in the editor removes the seated animation');
  } finally { await s.close(); }

  // The Nurgle knight as the open model: the chooser in the result caption changes the parts list.
  const nurgle = copyModel('transfer-nurgle-knight', 'TEST TRANSFER 20 knight open.mdx'), knight2 = copyModel('transfer-knight', 'knight donor open.mdx');
  const oldSetup = path.join(out, 'old setup r7b.mdlxl-preset');
  s = await session(nurgle, 'riders-open'); ({ page, dialog } = s);
  try {
    await openTransfer(s);
    assert.equal(await chooser(s, 'Result').count(), 3, 'riders: the Nurgle knight shows the chooser on the result');
    const legs = () => dialog.locator('button[data-part^="leg"]').count();
    const bothLegs = await legs();
    assert.equal(bothLegs, 4, 'riders: Both lists the mount\'s four legs');
    await pick(s, 'Result', 'seated');
    assert.equal(await legs(), 2, 'riders: Rider lists two legs');
    assert.equal((await recipeOf(page)).base.actor, 'seated', 'riders: base.actor');
    await s.openDonor(knight2); await s.animation(attack);
    await pick(s, 'Donor', 'seated');
    await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(2000);
    await s.shot('04-knight-as-the-open-model', shots7b);
    results.checks.push('riders: with the Nurgle knight open, the result caption chooser switches the parts list (Both: four legs, Rider: two)');
    // A setup round trip keeps both readings.
    const keep = await recipeOf(page);
    await dialog.getByRole('button', { name: 'Save as…' }).click();
    await dialog.getByLabel('Preset name').fill('Two readings');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(300);
    await dialog.getByRole('button', { name: 'Clear all' }).click(); await page.waitForTimeout(300);
    await pick(s, 'Result', 'both');
    await dialog.getByRole('button', { name: 'Load from…' }).click();
    await dialog.locator('.xf-setups button', { hasText: 'Two readings' }).click(); await page.waitForTimeout(2500);
    const back = await recipeOf(page);
    assert.deepEqual(back.base, keep.base, 'riders: the setup keeps base.actor');
    assert.deepEqual(back.sources, keep.sources, 'riders: and sources[*].actor');
    assert.deepEqual(back.parts, keep.parts, 'riders: and the parts');
    // An old setup (no readings) loads as before: no actor fields.
    fs.writeFileSync(oldSetup, JSON.stringify({ kind: 'mdlxl-transfer-setup', version: 1, name: 'Old knight', body: back.base.sequence != null ? (await readModel(nurgle)).Sequences[back.base.sequence].Name : '', length: null,
      sources: { k: { kind: 'file', path: knight2, name: 'knight donor open.mdx', mirror: null } }, parts: { head: { amount: 1, offset: [0, 0, 0], start: 0, speed: 1, blend: 150, source: 'k', animation: attack } } }));
    await stubDialogs(s.app, { open: oldSetup });
    await dialog.getByRole('button', { name: 'Load from…' }).click();
    await dialog.locator('.xf-setups').getByRole('button', { name: 'Load from file…', exact: true }).click(); await page.waitForTimeout(2500);
    const plain = await recipeOf(page);
    assert.equal(plain.base.actor, undefined, 'riders: an old setup sets no reading for the open model');
    assert.ok(Object.values(plain.sources).every(source => source.actor === undefined), 'riders: nor for its donor');
    assert.deepEqual(Object.keys(plain.parts), ['head'], 'riders: and takes what it says');
    results.checks.push('riders: a setup keeps base.actor and sources[*].actor; an old setup loads without them');
    await s.noCrash('riders open');
  } finally { await s.close(); }

  // Dark theme: the Footman seated by the Knight's rider.
  const footman3 = copyModel('transfer-footman', 'TEST TRANSFER 21 riders dark.mdx'), knight3 = copyModel('transfer-knight', 'knight donor dark.mdx');
  const d = await session(footman3, 'riders-dark', { preferences: { theme: 'dark' } });
  try {
    await openTransfer(d); await d.openDonor(knight3); await d.animation(attack);
    await pick(d, 'Donor', 'seated');
    await d.parts().getByRole('button', { name: 'Take whole body' }).click(); await d.page.waitForTimeout(2000);
    await d.shot('05-dark', shots7b);
    await d.noCrash('riders dark');
  } finally { await d.close(); }
}

// Round 8: the open model's own features, one switch each (transferFeatures). Real mouse input; the
// recipe through the test hook; the highlight through the result view's poseConfig; motion by checksum.
async function featuresStory() {
  const state = page => page.evaluate(() => window.__mdlxl.transfer());
  const motion = page => page.evaluate(() => {
    const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'), p = window.__mdlxl.preview(root).props;
    let sum = 0, n = 0;
    const add = track => { for (const key of track?.Keys || []) { const v = key.Vector || []; for (let i = 0; i < v.length; i++) sum += v[i] * (++n % 97 + 1); } };
    // Each joint's effective track: a swapped-in live track wins over the preview copy's own.
    const live = new Map((p.liveNodeTracks || []).map(item => [item.id + ':' + item.property, item.track]));
    for (const bone of [...(p.model.Bones || []), ...(p.model.Helpers || [])]) for (const property of ['Rotation', 'Translation']) add(live.get(bone.ObjectId + ':' + property) || bone[property]);
    return Math.round(sum * 1000) / 1000;
  });
  const { transferFeatures } = await import('../src/anim-transfer.js'), { rigFor } = await import('../src/transfer-window.js');
  const featuresOf = (model, sequence) => { const rig = rigFor(model, sequence); return transferFeatures(model, { sequence }).filter(feature => rig.parts[feature.part]); };
  const rows = dialog => dialog.locator('.xf-features .xf-feature');
  const fold = dialog => dialog.locator('details.xf-features-box');
  const header = dialog => fold(dialog).locator('summary');
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 22 features.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor features.mdx'), nurgle = copyModel('transfer-nurgle-warrior', 'TEST TRANSFER 23 nurgle features.mdx');
  const setupFile = path.join(out, 'nurgle belly kept.mdlxl-preset'); if (fs.existsSync(setupFile)) fs.unlinkSync(setupFile);
  const footmanModel = await readModel(footman), nurgleModel = await readModel(nurgle);
  // The Footman: its own features (or none), and a donor changes nothing.
  let s = await session(footman, 'features-footman'), { page, dialog } = s;
  try {
    await openTransfer(s);
    const own = featuresOf(footmanModel, (await state(page)).recipe.base.sequence);
    assert.equal(await rows(dialog).count(), own.length, `features: the Footman lists its ${own.length} own features`);
    assert.equal(await fold(dialog).count(), own.length ? 1 : 0, 'features: no list without features');
    if (own.length) {
      assert.equal(await fold(dialog).getAttribute('open'), null, 'features: the fold is closed at first (no new row in the commonest case)');
      assert.equal((await header(dialog).innerText()).trim(), `Own features (${own.length})`, 'features: its header counts the features');
    }
    await s.openDonor(grunt); await s.animation('Attack - 1');
    assert.equal(await rows(dialog).count(), own.length, 'features: the donor does not change the list (it is the open model\'s)');
    results.checks.push(`features: the Footman lists ${own.length} own features${own.length ? '' : ' (no list)'}; the Grunt as donor changes nothing`);
    await s.noCrash('features footman');
  } finally { await s.close(); }

  // A model without features (the Grunt open): no list at all.
  s = await session(copyModel('transfer-grunt', 'TEST TRANSFER 26 no features.mdx'), 'features-none'); ({ page, dialog } = s);
  try {
    await openTransfer(s);
    assert.equal(featuresOf(await readModel(copyModel('transfer-grunt', 'grunt features probe.mdx')), (await state(page)).recipe.base.sequence).length, 0, 'features: the Grunt has no features');
    assert.equal(await fold(dialog).count(), 0, 'features: and shows no list');
    await s.shot('04-no-features-no-list', shots8);
    results.checks.push('features: a model without features (the Grunt) shows no list');
    await s.noCrash('features none');
  } finally { await s.close(); }

  // The Nurgle warrior: rows dimmed until their part is taken.
  const nurgleSeq = nurgleModel.Sequences.findIndex(q => /^stand/i.test(q.Name));
  s = await session(nurgle, 'features'); ({ page, dialog } = s);
  try {
    await openTransfer(s);
    const own = featuresOf(nurgleModel, (await state(page)).recipe.base.sequence), belly = own.find(feature => feature.name === 'BellyBone1');
    assert.ok(belly, `features: the Nurgle warrior has BellyBone1 (${own.map(feature => feature.name)})`);
    assert.equal(await rows(dialog).count(), own.length, 'features: one row per feature');
    assert.equal(await fold(dialog).getAttribute('open'), null, 'features: closed at first');
    assert.equal((await header(dialog).innerText()).trim(), `Own features (${own.length})`, 'features: "Own features (N)"');
    await s.shot('01-nurgle-fold-closed', shots8);
    await header(dialog).click(); await page.waitForTimeout(300);
    assert.equal(await fold(dialog).getAttribute('open'), '', 'features: a click opens it');
    for (const name of ['BellyBone1', 'BellyGut', 'Cape 1']) if (own.some(feature => feature.name === name)) assert.equal(await rows(dialog).filter({ hasText: name }).count(), 1, `features: a row for ${name}`);
    const bellyRow = rows(dialog).filter({ hasText: 'BellyBone1' });
    assert.match(await bellyRow.innerText(), /Chest · 3 bones/, 'features: the row says its part and its bones');
    assert.equal(await bellyRow.locator('input').isDisabled(), true, 'features: nothing taken: the row is off');
    assert.equal(await bellyRow.getAttribute('title'), 'Take Chest first.', 'features: and says why');
    assert.equal(await bellyRow.locator('input').getAttribute('aria-label'), "Keep BellyBone1's own movement");
    await s.shot('01b-nurgle-fold-open-nothing-taken', shots8);
    // Whole body from the Grunt: rows on; hovering lights the feature up, leaving restores, the camera stays.
    await s.openDonor(grunt); await s.animation('Attack - 1');
    await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(2000);
    assert.equal(await bellyRow.locator('input').isDisabled(), false, 'features: the chest taken: the row is on');
    assert.match(await bellyRow.getAttribute('title'), /own animation of the same kind\. It is part of the body: arms are kept out of it\./, 'features: a body feature says so');
    const before = await s.probe('Result'), box = await bellyRow.boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2); await page.waitForTimeout(500);
    const lit = await s.probe('Result'), nodes = [...(nurgleModel.Bones || []), ...(nurgleModel.Helpers || [])];
    const bellyIds = belly.joints.map(name => nodes.find(node => node.Name === name)?.ObjectId);
    assert.deepEqual(lit.config.inspectPaths, [bellyIds], 'features: hovering BellyBone1 lights its joints up on the result');
    assert.deepEqual(lit.camera, before.camera, 'features: the camera does not move');
    await s.shot('02-whole-body-bellybone1-hovered', shots8);
    const top = await dialog.locator('header').boundingBox(); await page.mouse.move(top.x + 40, top.y + top.height / 2); await page.waitForTimeout(500);
    assert.deepEqual((await s.probe('Result')).config.inspectPaths, before.config.inspectPaths, 'features: leaving the row restores the highlight');
    results.checks.push(`features: the Nurgle warrior lists ${own.length} features, dimmed with "Take Chest first." until taken; hovering BellyBone1 lights its ${bellyIds.length} joints, leaving restores, the camera stays`);
    // Keep BellyBone1: one Undo step, the motion changes.
    const still = await motion(page);
    await bellyRow.locator('input').click(); await page.waitForTimeout(1800);
    assert.deepEqual((await state(page)).recipe.features?.[belly.id], { keep: 1 }, 'features: the switch keeps BellyBone1');
    assert.notEqual(await motion(page), still, 'features: the belly moves differently');
    await s.shot('03-bellybone1-kept', shots8);
    // Closed, the header still says a feature is kept; the fold stays as the user leaves it.
    await header(dialog).click(); await page.waitForTimeout(300);
    assert.equal(await fold(dialog).getAttribute('open'), null, 'features: closed again');
    assert.match((await header(dialog).innerText()).trim(), /^Own features \(\d+\)\s*·\s*1 kept$/, 'features: the closed header shows the kept feature');
    await s.shot('03b-fold-closed-one-kept', shots8);
    await dialog.locator('button[data-part="armL"]').click(); await page.waitForTimeout(300);
    assert.equal(await fold(dialog).getAttribute('open'), null, 'features: the fold stays as the user left it');
    await header(dialog).click(); await page.waitForTimeout(300);
    // Pads and cloth follow is gone from the part controls.
    await dialog.locator('button[data-part="chest"]').click(); await page.waitForTimeout(300);
    assert.equal(await s.parts().getByText('Pads and cloth follow', { exact: true }).count(), 0, 'features: no Pads and cloth follow in the part controls');
    await dialog.locator('button[data-part="all"]').click(); await page.waitForTimeout(300);
    assert.equal(await s.parts().getByText('Pads and cloth follow', { exact: true }).count(), 0, 'features: nor in All taken parts');
    // A setup to file with BellyBone1 kept (loaded on the Footman below).
    await stubDialogs(s.app, { save: setupFile });
    await dialog.getByRole('button', { name: 'Save as…' }).click();
    await dialog.getByLabel('Preset name').fill('Nurgle belly');
    await dialog.getByRole('button', { name: 'Save to file…' }).click();
    for (let i = 0; i < 40 && !fs.existsSync(setupFile); i++) await page.waitForTimeout(250);
    assert.deepEqual(JSON.parse(fs.readFileSync(setupFile, 'utf8')).features, { BellyBone1: { keep: 1 } }, 'features: the setup keeps the feature by name');
    await dialog.locator('.xf-caption').first().click(); await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
    assert.equal((await state(page)).recipe.features?.[belly.id], undefined, 'features: one Undo removes it');
    assert.equal(await motion(page), still, 'features: and the motion is as before');
    results.checks.push('features: keeping BellyBone1 sets recipe.features[id] = { keep: 1 } and changes the motion; the closed fold says "1 kept" and stays as left; one Undo removes it; Pads and cloth follow is gone');
    // An old setup with follow: 1 still drives the loose joints.
    const attackName = 'Attack - 1';
    const oldSetup = follow => { const file = path.join(out, `old follow ${follow}.mdlxl-preset`); fs.writeFileSync(file, JSON.stringify({ kind: 'mdlxl-transfer-setup', version: 1, name: 'Old chest', body: nurgleModel.Sequences[(nurgleSeq >= 0 ? nurgleSeq : 0)].Name, length: null,
      sources: { g: { kind: 'file', path: grunt, name: 'grunt donor features.mdx', mirror: null } }, parts: { chest: { amount: 1, offset: [0, 0, 0], start: 0, speed: 1, blend: 150, follow, source: 'g', animation: attackName } } })); return file; };
    const load = async file => { await stubDialogs(s.app, { open: file }); await dialog.getByRole('button', { name: 'Load from…' }).click(); await dialog.locator('.xf-setups').getByRole('button', { name: 'Load from file…', exact: true }).click(); await page.waitForTimeout(2500); };
    await load(oldSetup(0)); const without = await motion(page);
    await load(oldSetup(1));
    assert.equal((await state(page)).recipe.parts.chest.follow, 1, 'features: an old setup keeps follow');
    assert.notEqual(await motion(page), without, 'features: and follow still drives the loose joints');
    results.checks.push('features: an old setup with follow: 1 loads and still drives the loose joints');
    await s.noCrash('features');
  } finally { await s.close(); }

  // The setup on the Footman: BellyBone1 is left out and named.
  s = await session(copyModel('transfer-footman', 'TEST TRANSFER 24 features setup.mdx'), 'features-setup'); ({ page, dialog } = s);
  try {
    await openTransfer(s);
    await stubDialogs(s.app, { open: setupFile });
    await dialog.getByRole('button', { name: 'Load from…' }).click();
    await dialog.locator('.xf-setups').getByRole('button', { name: 'Load from file…', exact: true }).click(); await page.waitForTimeout(3000);
    assert.match(await dialog.locator('.preset-bar-status').innerText(), /Left out:.*BellyBone1/, 'features: the Footman leaves BellyBone1 out and names it');
    assert.equal((await state(page)).recipe.features, undefined, 'features: and keeps no feature');
    results.checks.push('features: the Nurgle setup on the Footman leaves BellyBone1 out and names it');
    await s.noCrash('features setup');
  } finally { await s.close(); }

  // Dark theme.
  const d = await session(copyModel('transfer-nurgle-warrior', 'TEST TRANSFER 25 features dark.mdx'), 'features-dark', { preferences: { theme: 'dark' } });
  try {
    await openTransfer(d); await d.openDonor(copyModel('transfer-grunt', 'grunt donor features dark.mdx')); await d.animation('Attack - 1');
    await d.parts().getByRole('button', { name: 'Take whole body' }).click(); await d.page.waitForTimeout(2000);
    await d.dialog.locator('details.xf-features-box summary').click(); await d.page.waitForTimeout(300);
    await d.dialog.locator('.xf-features .xf-feature').filter({ hasText: 'BellyBone1' }).locator('input').click(); await d.page.waitForTimeout(1500);
    await d.shot('05-dark', shots8);
    await d.noCrash('features dark');
  } finally { await d.close(); }
}

// The FX window on the same Footman, for comparing density.
async function fx() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER FX.mdx');
  const s = await session(footman, 'fx'), { page } = s;
  try {
    await page.locator('button.surface-effects-tool').click();
    const window = page.getByRole('dialog', { name: 'Surface Effects' });
    await window.waitFor(); await page.waitForTimeout(3000);
    await s.shot('05-fx-window-footman');
    results.checks.push('fx: the Surface Effects window on the Footman, for density');
  } finally { await s.close(); }
}

// Every control of the window, watching for crashes and page errors.
async function sweep() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 03.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor 2.mdx');
  const s = await session(footman, 'sweep'), { page, dialog } = s, clicked = [];
  const click = async (locator, what) => { await locator.click(); await page.waitForTimeout(250); clicked.push(what); await s.noCrash(what); };
  try {
    await openTransfer(s);
    await click(s.from().getByRole('button', { name: 'This model' }), 'From: This model');
    for (const name of ['Walk', 'Attack - 1', 'Stand - 1']) { await s.animation(name); clicked.push('animation ' + name); }
    assert.equal(await s.probe('Donor').then(p => p.sequence), (await readModel(footman)).Sequences.findIndex(q => q.Name === 'Stand - 1'), 'clicking an animation plays it in the donor view');
    await s.animation('Walk');
    await click(s.parts().getByRole('button', { name: 'Take whole body' }), 'Take whole body');
    await s.parts().getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' }); clicked.push('Body animation');
    await s.openDonor(grunt); clicked.push('Open file...');
    await s.animation('Attack - 1');
    for (const key of await dialog.locator('button[data-part]').evaluateAll(list => list.map(b => b.dataset.part).filter(key => key !== 'all'))) {
      const row = dialog.locator(`button[data-part="${key}"]`), toggle = dialog.locator(`input[data-part-switch="${key}"]`);
      await click(row, 'part ' + key);
      if (!(await toggle.isDisabled())) {
        if (await toggle.isChecked()) { await click(toggle, 'switch off ' + key); assert.equal(await toggle.isChecked(), false, 'switching a part off removes it'); }
        await click(toggle, 'switch on ' + key); assert.equal(await toggle.isChecked(), true, 'switching a part on takes it');
        const takeFrom = dialog.locator('.xf-part-controls button', { hasText: 'Take from' });
        if (await takeFrom.count() && await takeFrom.isEnabled()) await click(takeFrom, 'Take from ' + key);
        const other = dialog.locator('.xf-part-title button', { hasText: 'Other side' });
        if (await other.count() && await other.isEnabled()) { await click(other, 'Other side on ' + key); assert.equal(await other.getAttribute('aria-pressed'), 'true'); await click(other, 'Other side off ' + key); }
        const timing = dialog.locator('.xf-timing > summary');
        if (await timing.count() && !(await dialog.locator('.xf-timing[open]').count())) await click(timing, 'Timing fold ' + key);
        for (const field of await dialog.locator('input[data-field]').evaluateAll(list => list.map(i => i.dataset.field))) { await s.dragSlider(field, 0.75); clicked.push(`slider ${field} (${key})`); await s.noCrash('slider ' + field); }
        const input = dialog.locator('input[data-field="amount"]');
        await input.dblclick(); await page.waitForTimeout(300); clicked.push('double-click Strength ' + key);
        assert.equal(await input.inputValue(), '100', 'double-clicking Strength puts 100% back');
        const keep = dialog.getByLabel('Keep foot on the ground');
        if (await keep.count()) { await click(keep, 'Keep foot off ' + key); await click(keep, 'Keep foot on ' + key); }
      }
    }
    await click(dialog.locator('button[data-part="all"]'), 'All taken parts');
    for (const field of await dialog.locator('input[data-field]').evaluateAll(list => list.map(i => i.dataset.field))) { await s.dragSlider(field, 0.3); clicked.push('All ' + field); await s.noCrash('All ' + field); }
    await click(s.view('Donor').getByRole('button', { name: 'Mirror' }), 'Mirror on');
    await click(s.view('Donor').getByRole('button', { name: 'Mirror' }), 'Mirror off');
    await s.view('Result').getByLabel('Animation in this view').selectOption({ label: 'Stand Defend' }); await page.waitForTimeout(400); clicked.push('result view: an own animation'); await s.noCrash('own animation');
    await s.view('Result').getByLabel('Animation in this view').selectOption({ label: 'New animation' }); await page.waitForTimeout(400); clicked.push('result view: New animation'); await s.noCrash('new animation');
    await s.view('Donor').getByLabel('Viewing speed').selectOption('50'); clicked.push('donor speed'); await s.noCrash('donor speed');
    await click(s.view('Donor').locator('.xs-strip').getByRole('button', { name: /Pause|Play/ }), 'donor Play/Pause');
    const ds = await s.view('Donor').getByLabel('Time in this view').boundingBox();
    await page.mouse.move(ds.x + 3, ds.y + ds.height / 2); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(ds.x + ds.width * i / 7, ds.y + ds.height / 2); await page.waitForTimeout(20); }
    await page.mouse.up(); clicked.push('donor scrub'); await s.noCrash('donor scrub');
    await click(dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }), 'Pause');
    const scrub = dialog.getByLabel('Time', { exact: true }), sb = await scrub.boundingBox();
    await page.mouse.move(sb.x + 4, sb.y + sb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(sb.x + sb.width * i / 11, sb.y + sb.height / 2); await page.waitForTimeout(16); }
    await page.mouse.up(); clicked.push('scrub'); await s.noCrash('scrub');
    await click(dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Play' }), 'Play');
    await dialog.getByLabel('Name', { exact: true }).fill('Swing Defend'); clicked.push('Name');
    await click(dialog.getByRole('button', { name: 'Add animation' }), 'Add animation');
    assert.equal(await page.evaluate(() => window.__mdlxl.model().Sequences.at(-1).Name), 'Swing Defend', 'the typed name is used');
    await click(dialog.getByRole('button', { name: 'Clear all' }), 'Clear all');
    assert.equal(await dialog.locator('input[data-part-switch]:checked').count(), 0, 'Clear all removes every part');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300); clicked.push('window Ctrl+Z');
    assert.ok(await dialog.locator('input[data-part-switch]:checked').count() > 0, 'Ctrl+Z in the window brings the cleared parts back');
    await page.keyboard.press('Control+y'); await page.waitForTimeout(300); clicked.push('window Ctrl+Y');
    // Both modes: Transplant (the Footman on the Grunt's skeleton), each of its settings, and back to Retarget unchanged.
    const takenBefore = await dialog.locator('input[data-part-switch]:checked').count();
    await click(dialog.locator('button[data-mode="transplant"]'), 'Transplant mode');
    await s.view('Result').locator('.game-preview-root').waitFor({ timeout: 60000 });
    for (const name of ['Sounds', 'Effects']) { await click(dialog.getByLabel(name, { exact: true }), name); await page.waitForTimeout(1500); await click(dialog.getByLabel(name, { exact: true }), name + ' back'); }
    for (const box of await dialog.locator('[data-keep] input').all()) { await click(box, 'Keep'); await page.waitForTimeout(1000); await click(box, 'Keep back'); }
    await click(s.view('Result').locator('.xs-strip').getByRole('button', { name: /Pause|Play/ }), 'transplant result Play/Pause');
    await page.waitForTimeout(1500); await s.noCrash('transplant settings');
    await click(dialog.locator('button[data-mode="retarget"]'), 'Retarget mode');
    assert.equal(await dialog.locator('input[data-part-switch]:checked').count(), takenBefore, 'Retarget keeps its taken parts after Transplant mode');
    const tabs = await page.locator('.model-tab').count();
    await click(dialog.getByRole('button', { name: 'Cancel', exact: true }), 'Cancel');
    await openTransfer(s); clicked.push('reopen');
    await click(s.from().getByRole('button', { name: 'Library...' }), 'Library...');
    const library = page.getByRole('dialog', { name: 'Library' });
    await library.waitFor(); await page.waitForTimeout(1500);
    await library.locator('input[type=search], input:not([type])').first().fill('footman'); clicked.push('Library search');
    const row = library.getByRole('treeitem').filter({ hasText: /footman/i }).first();
    await row.waitFor({ timeout: 30000 });
    await row.dblclick(); clicked.push('Library: double-click a model');
    await library.waitFor({ state: 'detached', timeout: 30000 });
    await s.view('Donor').getByRole('button', { name: 'Mirror' }).waitFor({ timeout: 30000 });
    const picked = await s.view('Donor').locator('.xf-caption > span').innerText();
    assert.match(picked, /footman/i, 'the Library model becomes the donor');
    assert.equal(await page.locator('.model-tab').count(), tabs, 'the Library donor opens no tab');
    results.checks.push(`sweep: Library... picks ${picked.split(' - ')[0]} as the donor without opening a tab`);
    // A donor without parts says so in its view.
    const cloud = copyTestModel('corpus-sd/undead__plaguecloud.mdx', 'no parts donor.mdx');
    if (cloud) {
      await stubDialogs(s.app, { open: cloud });
      await click(s.from().getByRole('button', { name: 'Open file...' }), 'Open file... (no parts)');
      await s.view('Donor').locator('.xf-overlay-note').waitFor();
      assert.match(await s.view('Donor').locator('.xf-overlay-note').innerText(), /no parts|No body/i, 'a donor without parts shows the reason');
    }
    await click(dialog.getByRole('button', { name: 'Close Transfer' }), 'close');
    results.checks.push(`sweep: ${clicked.length} controls clicked or dragged, no crash or page error`);
    await s.noCrash('sweep');
  } finally { await s.close(); }
}

// A model with no recognisable parts shows the engine's sentences and nothing else.
async function unreadable() {
  const plain = copyTestModel('corpus-sd/undead__plaguecloud.mdx', 'TEST TRANSFER 04 no rig.mdx');
  if (!plain) { results.checks.push('unreadable rig: corpus-sd/undead__plaguecloud.mdx is not on this machine, skipped'); return; }
  const s = await session(plain, 'unreadable'), { page, dialog } = s;
  try {
    await openTransfer(s);
    assert.equal(await dialog.locator('.xf-problems').count(), 1, 'unreadable rig: the problem sentences show');
    assert.equal(await dialog.locator('.xf-body').count(), 0, 'unreadable rig: nothing else shows');
    results.checks.push('unreadable rig (undead__plaguecloud.mdx): only the problem sentences show');
    await s.noCrash('unreadable');
  } finally { await s.close(); }
}

// XFER stage 2, second part (docs/agent-tasks/xfer-both-ways.md): the trial result by clicks alone. The Kurgan
// takes the Tauren's whole body, All taken parts Pose to Theirs (stance on Head, Chest and Hips, match on limbs),
// Both hands on the weapon off on the weapon arm, Add all: every added animation's keys are what buildTransfer
// makes of the same recipe, the model has each Tauren name once, and one Undo puts its own set back.
async function setStory() {
  const kurganFile = fixturePath('transfer-kurgan'), taurenFile = fixturePath('transfer-tauren');
  if (![kurganFile, taurenFile].every(file => file && fs.existsSync(file))) { results.checks.push('set: the Kurgan or the Tauren is not on this machine, skipped'); return; }
  const kurgan = copyModel('transfer-kurgan', 'TEST TRANSFER SET 01 kurgan.mdx'), tauren = copyModel('transfer-tauren', 'tauren donor set.mdx');
  const { buildTransfer, applyTransfer, clearTransferCache } = await import('../src/anim-transfer.js'), { addAllPlan, rigFor } = await import('../src/transfer-window.js');
  const own = await readModel(kurgan), donorModel = await readModel(tauren);
  const state = page => page.evaluate(() => window.__mdlxl.transfer());
  // Wait for a result (rule 8): poll with a time limit and say what was last seen.
  const until = async (read, ok, what, ms = 90000) => { let last; for (const end = Date.now() + ms; Date.now() < end;) { last = await read(); if (ok(last)) return last; await new Promise(r => setTimeout(r, 150)); } throw new Error(`set: ${what} (last: ${JSON.stringify(last)?.slice(0, 300)})`); };
  // Every node key inside one animation, by node name and track, frames from the animation's start.
  const KINDS = ['Bones', 'Helpers', 'Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'CollisionShapes'];
  const tracksIn = (model, [start, end], kinds) => {
    const tracks = {};
    for (const kind of kinds) for (const node of model[kind] || []) for (const property of ['Translation', 'Rotation', 'Scaling']) {
      const track = node[property];
      if (!track?.Keys || (track.GlobalSeqId != null && track.GlobalSeqId >= 0)) continue;
      const keys = track.Keys.filter(key => key.Frame >= start && key.Frame <= end).map(key => [key.Frame - start, ...Array.from(key.Vector)]);
      if (keys.length) tracks[`${kind}:${node.Name}:${property}`] = keys;
    }
    return tracks;
  };
  const s = await session(kurgan, 'set'), { page, dialog } = s;
  try {
    await openTransfer(s);
    await s.openDonor(tauren);
    await s.parts().getByRole('button', { name: 'Take whole body' }).click();
    const taken = await until(() => state(page), v => Object.keys(v.recipe.parts).length > 5, 'Take whole body takes the parts');
    const rig = rigFor(own, taken.recipe.base.sequence), trunk = Object.keys(taken.recipe.parts).filter(key => rig.parts[key]?.kind === 'trunk'), limbs = Object.keys(taken.recipe.parts).filter(key => rig.parts[key]?.kind === 'limb');
    assert.ok(trunk.includes('hips') && trunk.includes('chest') && limbs.length >= 4, `set: whole body takes the trunk and the limbs (${trunk} | ${limbs})`);
    assert.equal(await dialog.locator('button[data-part="all"]').getAttribute('aria-pressed'), 'true', 'set: Take whole body selects All taken parts');
    // All taken parts: Pose to Theirs in one drag writes stance on the trunk and match on the limbs.
    await s.dragSlider('match', 1.3);
    const posed = await until(() => state(page), v => trunk.every(key => v.recipe.parts[key].stance === 1) && limbs.every(key => v.recipe.parts[key].match === 1), 'Pose at Theirs writes stance 1 on the trunk and match 1 on the limbs');
    assert.ok(trunk.every(key => posed.recipe.parts[key].match === taken.recipe.parts[key].match), 'set: the trunk parts keep their match');
    assert.ok(limbs.every(key => !(posed.recipe.parts[key].stance > 0)), 'set: the limbs get no stance');
    assert.equal(await dialog.locator('input[data-field="match"]').inputValue(), '100', 'set: the All taken parts Pose shows the shared 100');
    results.checks.push(`set: one Pose drag on All taken parts: stance 1 on ${trunk.join(', ')}, match 1 on ${limbs.join(', ')}`);
    // A trunk part's Pose shows its stance and says so.
    await dialog.locator('button[data-part="hips"]').click();
    const hipsPose = dialog.locator('input[data-field="match"]');
    await until(async () => [await hipsPose.inputValue(), await hipsPose.getAttribute('title')], ([value, title]) => value === '100' && /takes the donor's stance/.test(title || ''), 'Hips Pose shows 100 and the stance tooltip');
    // The weapon arm: Both hands on the weapon off.
    const weaponArm = Object.keys(rig.parts).find(key => rig.parts[key].kind === 'limb' && rig.parts[key].weapon && typeof rig.parts[key].weapon === 'object' && rig.parts[key].weapon.grip);
    assert.ok(weaponArm && taken.recipe.parts[weaponArm], `set: the Kurgan has a two-handed weapon arm (${weaponArm})`);
    await dialog.locator(`button[data-part="${weaponArm}"]`).click();
    const both = dialog.getByLabel('Both hands on the weapon');
    assert.equal(await both.isChecked(), true, 'set: Both hands on the weapon starts on');
    await both.click();
    const recipe = (await until(() => state(page), v => v.recipe.parts[weaponArm].grip === false, 'Both hands on the weapon off writes grip false')).recipe;
    results.checks.push(`set: Hips Pose reads 100 with the stance tooltip; ${weaponArm} Both hands on the weapon off`);
    // Add all and its count follow Keep own animations (off at first).
    const donorId = recipe.parts.hips.source, sources = new Map([[donorId, donorModel]]);
    const replacing = addAllPlan(own, donorModel, donorId, recipe, recipe.base.sequence, { replace: true }).clips, keeping = addAllPlan(own, donorModel, donorId, recipe, recipe.base.sequence).clips;
    const button = dialog.locator('button[data-hotkey="transfer:add-all"]'), keep = dialog.getByLabel('Keep own animations'), count = async () => Number((await button.innerText()).match(/\((\d+)\)/)?.[1]);
    assert.equal(await keep.isChecked(), false, 'set: Keep own animations is off at first');
    assert.equal(await count(), replacing.length, `set: Add all counts every Tauren animation (${replacing.length})`);
    await keep.click(); await until(count, n => n === keeping.length, `Keep own animations on: Add all (${keeping.length})`);
    await keep.click(); await until(count, n => n === replacing.length, `Keep own animations off again: Add all (${replacing.length})`);
    results.checks.push(`set: Add all (${replacing.length}) with Keep own animations off, (${keeping.length}) with it on`);
    const before = own.Sequences.map(q => q.Name), baseName = before[recipe.base.sequence], gone = new Set(replacing.flatMap(clip => clip.replaces));
    await button.click();
    await dialog.getByText(`Added ${replacing.length} animations`).waitFor({ timeout: 120000 });
    const names = await until(() => page.evaluate(() => window.__mdlxl.model().Sequences.map(q => q.Name)), list => list.length === before.length - gone.size + replacing.length, 'Add all leaves the model with its kept animations and the Tauren set');
    // (b) Each Tauren name once, the Kurgan's other animations still there once each.
    for (const clip of replacing) assert.equal(names.filter(n => n.toLowerCase() === clip.name.toLowerCase()).length, 1, `set: ${clip.name} once (${names.join(', ')})`);
    for (const [i, n] of before.entries()) if (!gone.has(i)) assert.equal(names.filter(x => x === n).length, before.filter(x => x === n).length, `set: the Kurgan's own ${n} stays`);
    const after = await state(page);
    assert.equal(names[after.recipe.base.sequence], baseName, `set: the Body animation stays ${baseName}`);
    results.checks.push(`set: Add all leaves ${names.length} animations (${before.length} - ${gone.size} replaced + ${replacing.length}); each Tauren name once; Body animation still ${baseName}`);
    // (a) Every added animation's keys equal buildTransfer's for the same recipe on the Kurgan as opened.
    const kinds = KINDS.filter(kind => (own[kind] || []).length);
    const actual = await page.evaluate(({ wanted, kinds }) => {
      const model = window.__mdlxl.model(), out = {};
      for (const name of wanted) {
        const matches = model.Sequences.filter(q => q.Name === name);
        if (matches.length !== 1) { out[name] = { count: matches.length }; continue; }
        const [start, end] = matches[0].Interval, tracks = {};
        for (const kind of kinds) for (const node of model[kind] || []) for (const property of ['Translation', 'Rotation', 'Scaling']) {
          const track = node[property];
          if (!track?.Keys || (track.GlobalSeqId != null && track.GlobalSeqId >= 0)) continue;
          const keys = track.Keys.filter(key => key.Frame >= start && key.Frame <= end).map(key => [key.Frame - start, ...Array.from(key.Vector)]);
          if (keys.length) tracks[`${kind}:${node.Name}:${property}`] = keys;
        }
        out[name] = { count: 1, length: end - start, tracks };
      }
      return out;
    }, { wanted: replacing.map(clip => clip.name), kinds });
    const report = [];
    for (const clip of replacing) {
      const m = structuredClone(own);
      clearTransferCache(m);
      applyTransfer(m, buildTransfer(m, sources, clip.recipe), clip.recipe, { name: clip.name });
      // m still has the Kurgan's own animation of that name: read the new one, the last.
      const got = actual[clip.name], [start, end] = m.Sequences.at(-1).Interval, wantTracks = tracksIn(m, [start, end], kinds);
      assert.equal(got.count, 1, `set: ${clip.name} is in the model once`);
      assert.equal(got.length, end - start, `set: ${clip.name} lasts ${end - start} ms`);
      const names = Object.keys(wantTracks).sort();
      assert.deepEqual(Object.keys(got.tracks).sort(), names, `set: ${clip.name} has keys on the same tracks`);
      let diff = 0, keys = 0;
      for (const name of names) {
        const a = got.tracks[name], b = wantTracks[name];
        assert.equal(a.length, b.length, `set: ${clip.name} ${name}: ${a.length} keys, buildTransfer makes ${b.length}`);
        for (let i = 0; i < a.length; i++) { keys++; assert.equal(a[i][0], b[i][0], `set: ${clip.name} ${name} key ${i} frame`); for (let j = 1; j < b[i].length; j++) diff = Math.max(diff, Math.abs(a[i][j] - b[i][j])); }
      }
      assert.ok(diff < 1e-4, `set: ${clip.name} keys differ from buildTransfer by ${diff}`);
      report.push(`${clip.name} ${names.length} tracks ${keys} keys max diff ${diff.toExponential(1)}`);
    }
    results.checks.push(`set: every added animation's keys equal buildTransfer's for the same recipe: ${report.join('; ')}`);
    // One Undo puts the Kurgan's own set back.
    await dialog.getByRole('button', { name: 'Close Transfer' }).click(); await page.waitForTimeout(300);
    await page.keyboard.press('Control+Z');
    await until(() => page.evaluate(() => window.__mdlxl.model().Sequences.map(q => q.Name)), list => JSON.stringify(list) === JSON.stringify(before), 'one Undo puts the Kurgan\'s own animations back');
    results.checks.push(`set: one Undo puts the Kurgan's own ${before.length} animations back`);
    await s.noCrash('set');
  } finally { await s.close(); }
}

// Transplant mode (docs/agent-tasks/xfer-both-ways.md "Transplant in the window"): the Kurgan onto the
// Tauren's skeleton through the window, every setting toggled, one Transplant, one Undo. Screenshots in
// out/transplant-ui (MDLXL_TRANSPLANT_SHOTS).
async function transplantStory() {
  const kurganFile = fixturePath('transfer-kurgan'), taurenFile = fixturePath('transfer-tauren');
  if (![kurganFile, taurenFile].every(file => file && fs.existsSync(file))) { results.checks.push('transplant: the Kurgan or the Tauren is not on this machine, skipped'); return; }
  const shotsT = path.resolve(process.env.MDLXL_TRANSPLANT_SHOTS || 'out/transplant-ui'); fs.mkdirSync(shotsT, { recursive: true });
  const kurgan = copyModel('transfer-kurgan', 'TEST TRANSPLANT WINDOW 01.mdx'), tauren = copyModel('transfer-tauren', 'tauren donor transplant.mdx');
  const magnataurFile = fixturePath('transfer-magnataur'), magnataur = magnataurFile && fs.existsSync(magnataurFile) ? copyModel('transfer-magnataur', 'magnataur donor transplant.mdx') : null;
  const own = await readModel(kurgan), donorModel = await readModel(tauren), donorNames = donorModel.Sequences.map(q => q.Name), ownNames = own.Sequences.map(q => q.Name);
  const state = page => page.evaluate(() => window.__mdlxl.transfer());
  const until = async (read, ok, what, ms = 90000) => { let last; for (const end = Date.now() + ms; Date.now() < end;) { last = await read(); if (ok(last)) return last; await new Promise(r => setTimeout(r, 150)); } throw new Error(`transplant: ${what} (last: ${JSON.stringify(last)?.slice(0, 400)})`); };
  const s = await session(kurgan, 'transplant'), { page, dialog } = s, clicked = [];
  const click = async (locator, what) => { await locator.click(); await page.waitForTimeout(250); clicked.push(what); await s.noCrash(what); };
  const settings = () => dialog.locator('aside[aria-label="Transplant"]'), button = () => dialog.locator('button[data-hotkey="transfer:transplant"]');
  const shown = () => page.evaluate(() => { const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="Result"] .game-preview-root'); if (!root) return null; const p = window.__mdlxl.preview(root).props; return { names: p.model.Sequences.map(q => q.Name), sequence: p.model.Sequences[p.sequenceIndex]?.Name, bones: p.model.Bones.length }; });
  const ready = (what, test = () => true) => until(() => state(page), v => v.transplant?.ready && test(v.transplant), what);
  const cameraOf = async name => (await s.probe(name)).camera.object.matrix.map(v => Math.round(v * 1000) / 1000).join(',');
  try {
    await openTransfer(s, 'transplant');
    assert.equal(await dialog.locator('button[data-mode="transplant"]').getAttribute('aria-pressed'), 'true', 'transplant: the window opens in Transplant');
    assert.equal(await dialog.locator('button[data-mode="retarget"]').getAttribute('aria-pressed'), 'false', 'transplant: Retarget is not pressed');
    const order = await dialog.locator('header .xf-mode-switch button').evaluateAll(list => list.map(b => b.dataset.mode + ':' + b.innerText.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(order, ['transplant:Transplant Whole skeleton', 'retarget:Retarget Pick parts'], 'transplant: the caption bar holds Transplant then Retarget with their sub-labels');
    assert.equal(await s.parts().count(), 0, 'transplant: the parts column is replaced');
    assert.equal(await dialog.locator('.xt-lane').count(), 0, 'transplant: no clip timeline');
    for (const name of ['Add animation', 'Add all', 'Take whole body']) assert.equal(await dialog.getByRole('button', { name, exact: true }).count(), 0, `transplant: no ${name}`);
    assert.equal(await settings().getByLabel('Sounds').isChecked(), true, 'transplant: Sounds on at first');
    assert.equal(await settings().getByLabel('Effects').isChecked(), false, 'transplant: Effects off at first');
    assert.equal(await button().isDisabled(), true, 'transplant: Transplant waits for a donor');
    assert.match(await s.view('Result').innerText(), /Choose a model under From/, 'transplant: the result view asks for a donor');
    await s.shot('00-just-opened-light', shotsT);
    results.checks.push('transplant: the window opens in Transplant (caption switch: Transplant | Retarget); it shows the settings column (Sounds on, Effects off), no parts, timeline or Add buttons; Transplant waits for a donor');
    if (magnataur) {
      // A poor fit is named with its reason; the transplant is still offered.
      await s.openDonor(magnataur);
      const poor = await ready('the Magnataur result', t => t.fit === 'poor');
      await settings().locator('.xf-poor').waitFor({ timeout: 30000 });
      assert.match(await settings().locator('.xf-poor').innerText(), /Poor fit[\s\S]+\w/, 'transplant: the poor-fit line shows with a reason');
      // One share line first, then at most three more sentences (docs/agent-tasks/xfer-transplant-fixes.md, Poor fit).
      assert.match(poor.transplant.reasons[0] || '', /^\d+% of the body follows the donor\.$/, 'transplant: the poor fit starts with the share line');
      assert.ok(poor.transplant.reasons.length <= 4, `transplant: at most 4 sentences under Poor fit (${poor.transplant.reasons.length})`);
      assert.equal(await settings().locator('.xf-poor .xf-reason').count(), poor.transplant.reasons.length, 'transplant: every sentence is shown');
      assert.equal(await button().isEnabled(), true, 'transplant: a poor fit can still be transplanted');
      results.checks.push(`transplant: the Kurgan on the Magnataur shows "Poor fit" with a share line and ${poor.transplant.reasons.length} sentence(s) in all (at most 4); Transplant stays enabled`);
    }
    await s.openDonor(tauren);
    await ready('the Tauren result', t => t.fit === 'good');
    assert.equal(await settings().locator('.xf-poor').count(), 0, 'transplant: no poor-fit line for a good fit');
    let view = await until(shown, v => v && JSON.stringify(v.names) === JSON.stringify(donorNames), 'the result view plays the transplanted model with the Tauren\'s animations');
    await s.animation('Walk');
    view = await until(shown, v => v?.sequence === 'Walk', 'the result view plays the donor view\'s Walk');
    await s.animation('Attack - 1'); await until(shown, v => v?.sequence === 'Attack - 1', 'the result view follows the donor view to Attack - 1'); clicked.push('animation Walk', 'animation Attack - 1');
    await s.view('Result').getByLabel('Animation in this view').selectOption({ label: 'Walk' }); await page.waitForTimeout(400); clicked.push('result view: Walk');
    assert.equal(await s.probe('Donor').then(p => p.sequence), donorNames.indexOf('Walk'), 'transplant: choosing in the result view moves the donor view too');
    await s.shot('02-transplant-tauren-picked', shotsT);
    results.checks.push(`transplant: the result view shows the Kurgan on the Tauren skeleton (${view.bones} bones, the Tauren's ${donorNames.length} animations) and plays the donor view's animation both ways`);
    await s.dragCamera('Result'); clicked.push('result camera drag');
    const camera = await cameraOf('Result');
    // Every setting: Sounds, Effects, each Keep, Mirror; each rebuilds the result and keeps the camera.
    const settle = async (what, test) => { await ready(what, test); await page.waitForTimeout(300); assert.equal(await cameraOf('Result'), camera, `transplant: ${what} keeps the result camera`); };
    const first = (await state(page)).transplant;
    await click(settings().getByLabel('Sounds'), 'Sounds off'); await settle('Sounds off', t => t.options.events === false);
    await click(settings().getByLabel('Sounds'), 'Sounds on'); await settle('Sounds on', t => t.options.events === true && t.events === first.events);
    await click(settings().getByLabel('Effects'), 'Effects on'); const fx = (await ready('Effects on', t => t.options.emitters === true)).transplant; await settle('Effects on', t => t.options.emitters === true);
    assert.ok(fx.emitters > first.emitters, `transplant: Effects brings the donor's effects (${first.emitters} -> ${fx.emitters})`);
    await click(settings().getByLabel('Effects'), 'Effects off'); await settle('Effects off', t => t.options.emitters === false);
    const extras = first.extras;
    assert.ok(extras.length > 0, 'transplant: the Kurgan lists Keep options');
    assert.equal(await settings().locator('[data-keep]').count(), extras.length, 'transplant: one Keep box per extra');
    for (const extra of extras) {
      const box = settings().locator(`[data-keep="${extra.id}"] input`);
      assert.equal(await box.isChecked(), false, `transplant: Keep ${extra.name} off at first`);
      await click(box, 'Keep ' + extra.name); await settle('Keep ' + extra.name, t => t.options.keep.includes(extra.id) && t.extras.find(e => e.id === extra.id)?.kept);
      await click(box, 'Keep off ' + extra.name); await settle('Keep off ' + extra.name, t => !t.options.keep.includes(extra.id));
    }
    const mirror = s.view('Donor').getByRole('button', { name: 'Mirror' }), mirrored = (await state(page)).transplant.options.mirror;
    await click(mirror, 'Mirror'); await settle('Mirror', t => t.options.mirror === !mirrored);
    await click(mirror, 'Mirror back'); await settle('Mirror back', t => t.options.mirror === mirrored);
    results.checks.push(`transplant: Sounds, Effects (${first.emitters} -> ${fx.emitters} effects), ${extras.length} Keep boxes (${extras.map(e => e.name).join(', ')}) and Mirror each rebuild the result; the camera stays where it was dragged`);
    // Transport of the result view.
    await click(s.view('Result').locator('.xs-strip').getByRole('button', { name: /Pause|Play/ }), 'result Play/Pause');
    await s.view('Result').getByLabel('Viewing speed').selectOption('50'); clicked.push('result speed');
    const rs = await s.view('Result').getByLabel('Time in this view').boundingBox();
    await page.mouse.move(rs.x + 3, rs.y + rs.height / 2); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(rs.x + rs.width * i / 7, rs.y + rs.height / 2); await page.waitForTimeout(20); }
    await page.mouse.up(); clicked.push('result scrub'); await s.noCrash('result scrub');
    // Transplant: in place, one Undo step.
    const tabs = await page.locator('.model-tab').count();
    await click(button(), 'Transplant');
    await dialog.getByText('Transplanted', { exact: true }).waitFor({ timeout: 120000 });
    const after = await until(() => page.evaluate(() => { const m = window.__mdlxl.model(); return { names: m.Sequences.map(q => q.Name), bones: [...m.Bones, ...(m.Helpers || [])].map(b => b.Name), cameras: (m.Cameras || []).map(c => c.Name) }; }), v => JSON.stringify(v.names) === JSON.stringify(donorNames), 'the open model has the Tauren\'s animation list');
    assert.equal(await page.locator('.model-tab').count(), tabs, 'transplant: no new tab');
    assert.deepEqual(after.cameras, (own.Cameras || []).map(c => c.Name), 'transplant: the model keeps its own camera');
    const donorJoints = new Set([...donorModel.Bones, ...(donorModel.Helpers || [])].map(b => b.Name)), theirs = after.bones.filter(name => donorJoints.has(name)).length;
    assert.ok(theirs >= 30, `transplant: the model has the Tauren's joints (${theirs} of its ${after.bones.length} by name)`);
    assert.equal(await button().isDisabled(), true, 'transplant: Transplant is done for these settings');
    await s.shot('03-transplant-done', shotsT);
    results.checks.push(`transplant: Transplant puts the Kurgan on the Tauren skeleton in place (${after.names.length} animations: the Tauren's; ${theirs} of its ${after.bones.length} joints are the Tauren's by name; own camera kept; no new tab)`);
    await click(dialog.locator('button[data-mode="retarget"]'), 'Retarget mode');
    assert.equal(await s.parts().count(), 1, 'transplant: Retarget brings the parts column back');
    await click(dialog.getByRole('button', { name: 'Close Transfer' }), 'close');
    await page.keyboard.press('Control+Z');
    const back = await until(() => page.evaluate(() => { const m = window.__mdlxl.model(); return { names: m.Sequences.map(q => q.Name), bones: m.Bones.length }; }), v => JSON.stringify(v.names) === JSON.stringify(ownNames), 'one Undo puts the Kurgan back');
    assert.equal(back.bones, own.Bones.length, 'transplant: one Undo restores the Kurgan\'s own bones');
    results.checks.push(`transplant: one Undo restores the Kurgan (${ownNames.length} animations, ${own.Bones.length} bones); ${clicked.length} controls clicked, no crash or page error`);
    await s.noCrash('transplant');
  } finally { await s.close(); }
}

// A transplant builds off the main thread (app/transplant.worker.js): while the Lord of Change goes onto the
// HD Footman's skeleton (the HD Footman opens read-only, so it is the donor; ~6 s of engine work), a click on
// another control answers within 200 ms, the longest main-thread task stays short, and the result view keeps
// the last result.
async function freezeStory() {
  const have = key => { const file = fixturePath(key); return !!file && fs.existsSync(file); };
  const [ownKey, donorKey] = have('transfer-lord-of-change') && have('forge-hd-footman') ? ['transfer-lord-of-change', 'forge-hd-footman'] : ['transfer-kurgan', 'transfer-tauren'];
  if (!have(ownKey) || !have(donorKey)) { results.checks.push('freeze: neither the Lord of Change with the HD Footman nor the Kurgan with the Tauren is on this machine, skipped'); return; }
  const own = copyModel(ownKey, 'TEST TRANSPLANT FREEZE 01.mdx'), donor = copyModel(donorKey, 'freeze donor.mdx'), file = fixturePath(donorKey);
  const s = await session(own, 'freeze'), { page, dialog } = s;
  const state = () => page.evaluate(() => window.__mdlxl.transfer()?.transplant || null);
  try {
    await openTransfer(s, 'transplant');
    await page.evaluate(() => { const p = window.__xfPerf = { long: [] }; try { new PerformanceObserver(list => { for (const e of list.getEntries()) p.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask' }); } catch {} });
    const loaded = Date.now();
    await s.openDonor(donor);
    const opened = await page.evaluate(() => { const p = window.__xfPerf, before = p.long; p.long = []; return Math.round(Math.max(0, ...before.map(e => e[1]))); });
    // Clicks on the donor view's Play/Pause while the transplant builds: each answers within 200 ms.
    const play = s.view('Donor').locator('.xs-strip').getByRole('button', { name: /Pause|Play/ }), answers = [];
    for (let i = 0; i < 3; i++) {
      const before = await play.innerText(), t0 = Date.now();
      await play.click();
      await page.waitForFunction(([text]) => { const b = [...document.querySelectorAll('[role="dialog"][aria-label="Transfer"] section[aria-label="Donor"] .xs-strip button')].find(x => /Pause|Play/.test(x.innerText)); return b && b.innerText !== text; }, [before], { timeout: 60000 });
      answers.push({ ms: Date.now() - t0, building: !!(await state())?.building });
      await page.waitForTimeout(150);
    }
    const during = answers.filter(a => a.building);
    const longSoFar = await page.evaluate(() => Math.round(Math.max(0, ...window.__xfPerf.long.map(e => e[1]))));
    assert.ok(during.length > 0, `freeze: the clicks came while the transplant was building (${JSON.stringify(answers)}; longest main-thread task ${Math.max(opened, longSoFar)} ms)`);
    assert.ok(Math.max(...during.map(a => a.ms)) < 200, `freeze: a click answers within 200 ms while the transplant builds (${JSON.stringify(answers)})`);
    assert.equal(await dialog.locator('[data-transplant-view] .xf-placeholder').innerText(), 'Building…', 'freeze: the result view says Building… before the first result');
    let ready = null;
    for (const end = Date.now() + 180000; Date.now() < end && !ready?.ready; await new Promise(r => setTimeout(r, 200))) ready = await state();
    assert.ok(ready?.ready, `freeze: the transplant finishes (${JSON.stringify(ready)?.slice(0, 300)})`);
    const built = Date.now() - loaded, long = await page.evaluate(() => window.__xfPerf.long);
    const longest = Math.round(Math.max(0, ...long.map(e => e[1])));
    // A setting change keeps the last result on screen with Building… and the camera where it is.
    const camera = async () => (await s.probe('Result')).camera.object.matrix.map(v => Math.round(v * 1000) / 1000).join(',');
    await page.waitForTimeout(500); const before = await camera();
    const firstLong = await page.evaluate(() => { const p = window.__xfPerf, all = p.long; p.long = []; return all.map(e => Math.round(e[1])).filter(d => d > 100); });
    await dialog.locator('aside[aria-label="Transplant"]').getByLabel('Sounds').click();
    await dialog.locator('[data-transplant-building]').waitFor({ timeout: 10000 });
    assert.equal(await dialog.locator('[data-transplant-view] .game-preview-root').count(), 1, 'freeze: the last result stays on screen while a setting rebuilds');
    // A newer setting supersedes the running build: only the newest options arrive.
    await dialog.locator('aside[aria-label="Transplant"]').getByLabel('Sounds').click();
    for (const end = Date.now() + 180000; Date.now() < end; await new Promise(r => setTimeout(r, 200))) { ready = await state(); if (ready?.ready) break; }
    assert.ok(ready?.ready && ready.options.events === true, 'freeze: the newest setting (Sounds back on) is the one built');
    assert.equal(await camera(), before, 'freeze: rebuilding keeps the result camera');
    await page.waitForTimeout(1000);
    const rebuildLong = await page.evaluate(() => window.__xfPerf.long.map(e => Math.round(e[1])).filter(d => d > 100));
    // Window Ctrl+Z in Transplant mode does nothing; Transplant applies once.
    await dialog.locator('button[data-hotkey="transfer:transplant"]').click();
    await dialog.getByText('Transplanted', { exact: true }).waitFor({ timeout: 120000 });
    await page.waitForTimeout(3000);
    assert.equal(await dialog.locator('button[data-hotkey="transfer:transplant"]').isDisabled(), true, 'freeze: Transplant stays off after it was applied');
    const sounds = await dialog.locator('aside[aria-label="Transplant"]').getByLabel('Sounds').isChecked(), revision = await page.evaluate(() => window.__mdlxl.document().revision);
    await dialog.locator('aside[aria-label="Transplant"]').getByLabel('Sounds').focus(); await page.keyboard.press('Control+Z'); await page.waitForTimeout(500);
    assert.equal(await dialog.locator('aside[aria-label="Transplant"]').getByLabel('Sounds').isChecked(), sounds, 'freeze: window Ctrl+Z in Transplant mode changes no setting');
    assert.equal(await page.evaluate(() => window.__mdlxl.document().revision), revision, 'freeze: window Ctrl+Z in Transplant mode leaves the model as it is');
    assert.equal(await dialog.getByText('Transplanted', { exact: true }).count(), 1, 'freeze: still Transplanted after Ctrl+Z');
    results.checks.push(`freeze: ${ownKey} onto ${donorKey} (${path.basename(file)}) built in ${(built / 1000).toFixed(1)} s with the window answering: clicks ${answers.map(a => a.ms + ' ms' + (a.building ? '' : ' (built)')).join(', ')}; longest main-thread task ${longest} ms after the donor opened (${opened} ms while it opened; tasks over 100 ms until the first result: ${JSON.stringify(firstLong)}, over two rebuilds: ${JSON.stringify(rebuildLong)}); a setting change keeps the last result and camera with Building…, the newer setting wins; Transplant applies once; window Ctrl+Z does nothing in Transplant mode`);
    await s.noCrash('freeze');
  } finally { await s.close(); }
}

// Director trials: whole body onto very different rigs, caught mid-movement.
async function trials() {
  const footman = copyModel('transfer-footman', 'footman donor 3.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor 3.mdx');
  for (const [model, donor, animation, file, at] of [
    ['corpus-sd/creeps__ogre.mdx', footman, 'Attack - 1', '06-ogre-footman-attack', 0.45],
    ['corpus-sd/human__knight.mdx', grunt, 'Attack - 1', '07-knight-grunt-attack', 0.45],
    ['corpus-sd/undead__ghoul.mdx', footman, 'Walk', '08-ghoul-footman-walk', 0.3],
  ]) {
    const copy = copyTestModel(model, `TEST TRANSFER ${file}.mdx`);
    if (!copy) { results.checks.push(`trials: ${model} is not on this machine, skipped`); continue; }
    const s = await session(copy, file), { page, dialog } = s;
    try {
      await openTransfer(s);
      await s.openDonor(donor);
      await s.animation(animation);
      await s.parts().getByRole('button', { name: 'Take whole body' }).click(); await page.waitForTimeout(1500);
      await dialog.locator('section[aria-label="Result"] .xs-strip').getByRole('button', { name: 'Pause' }).click();
      const scrub = dialog.getByLabel('Time', { exact: true }), sb = await scrub.boundingBox();
      await page.mouse.click(sb.x + sb.width * at, sb.y + sb.height / 2); await page.waitForTimeout(1200);
      await s.shot(file);
      const reason = await dialog.locator('.xf-reason').count() ? await dialog.locator('.xf-reason').innerText() : '';
      results.checks.push(`trials: ${path.basename(model)} takes ${await dialog.locator('input[data-part-switch]:checked').count()} parts${reason ? ` ("${reason}")` : ''}`);
      await s.noCrash(file);
    } finally { await s.close(); }
  }
}

(async () => {
  fs.mkdirSync(shots, { recursive: true }); fs.mkdirSync(shots3, { recursive: true }); fs.mkdirSync(shots4, { recursive: true }); fs.mkdirSync(shotsF, { recursive: true }); fs.mkdirSync(shots5, { recursive: true }); fs.mkdirSync(shots7, { recursive: true }); fs.mkdirSync(shots7b, { recursive: true }); fs.mkdirSync(shots8, { recursive: true });
  let failed = null;
  const all = ['B', 'A', 'all', 'mix', 'aim', 'weapon', 'setup', 'dark', 'sweep34', 'views', 'round7', 'riders', 'features', 'set', 'transplant', 'freeze', 'fx', 'sweep', 'unreadable', 'trials'];
  const only = process.env.MDLXL_TRANSFER_ONLY ? process.env.MDLXL_TRANSFER_ONLY.split(',') : all.filter(name => name !== 'sweep' || process.env.MDLXL_TRANSFER_SWEEP);
  for (const [name, run] of [['B', storyB], ['A', storyA], ['all', storyAll], ['mix', mix], ['aim', aimStory], ['weapon', weaponStory], ['setup', setupStory], ['dark', darkStory], ['sweep34', sweep34], ['views', viewsStory], ['round7', round7Story], ['riders', ridersStory], ['features', featuresStory], ['set', setStory], ['transplant', transplantStory], ['freeze', freezeStory], ['fx', fx], ['sweep', sweep], ['unreadable', unreadable], ['trials', trials]]) {
    if (!only.includes(name)) continue;
    try { await run(); } catch (error) { failed ||= error; results.errors.push(`${name}: ${error.stack || error.message}`); console.error(name, error); }
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  for (const check of results.checks) console.log('ok -', check);
  for (const line of results.consoleErrors || []) console.log('console error -', line);
  clearTimeout(watchdog);
  if (failed) { console.error('FAILED'); process.exit(1); }
  console.log('PASSED'); process.exit(0);
})();
