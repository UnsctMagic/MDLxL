// Transfer (XFER) acceptance with real mouse input on the app: docs/agent-tasks/transfer-xl.md "Window acceptance"
// and "Round 2". Disposable profile and model copies under out/; never opens or replaces a user profile. Run it hidden:
// MDLXL_PLAYWRIGHT_MODULE=<playwright-core> MDLXL_TEST_EXE=<MDLxL.exe> node test/transfer.electron.cjs
// MDLXL_TRANSFER_SWEEP=1 adds a click-through of every control; MDLXL_TRANSFER_ONLY=B,A,fx,sweep,unreadable,trials picks parts.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');
const { fixturePath, testModel } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_TRANSFER_OUT || 'out/transfer-ui'), shots = path.join(out, 'round2'), shots3 = path.join(out, 'round3'), shots4 = path.join(out, 'round4');
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

async function session(fixture, label) {
  const errors = [], consoleErrors = [];
  const { app, page } = await launchApp({ out, fixture, errors, bounds: { x: -3000, y: 0, width: 1500, height: 960 }, timeout: 90000, pageTimeout: 30000 });
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
const openTransfer = async s => { await s.page.locator('button.transfer-tool').click(); await s.dialog.waitFor(); await s.page.waitForTimeout(800); };
const pathMoved = (a, b) => !!a && !!b && a.length === b.length && a.some((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2]) > 1);

async function storyB() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 01.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor.mdx');
  const s = await session(footman, 'B'), { page, dialog } = s;
  try {
    await s.shot('dock');
    await openTransfer(s);
    await s.shot('01-empty-window');
    assert.equal((await s.probe('Result')).config, null, 'B: with nothing taken the result view has no handles');
    results.checks.push('B: XFER opens Transfer with the source choices');
    const before = await s.count();
    await s.openDonor(grunt);
    await s.animation('Attack - 1');
    await s.parts().getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' });
    await dialog.locator('.xt-timeline').getByRole('button', { name: 'Pause' }).click();
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
    // its right edge sets Speed; each drag is one step of the window's history.
    const clip = dialog.locator('.xt-clip.xt-main').first(), lanesBefore = await dialog.locator('.xt-lane').count();
    assert.equal(lanesBefore, 2, 'B: the timeline has the body lane and one clip lane');
    assert.match(await dialog.locator('.xt-lane:not(.xt-body) .xt-label').innerText(), /Attack - 1/, 'B: the lane names its source animation');
    const timingOpen = async () => { if (!(await dialog.locator('.xf-timing[open]').count())) await dialog.locator('.xf-timing > summary').click(); await page.waitForTimeout(200); };
    await timingOpen();
    const pathBefore = (await s.probe('Result')).path, cb = await clip.boundingBox(), cells = await dialog.locator('.xt-lane:not(.xt-body) .xt-cells').boundingBox();
    await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(cb.x + cb.width * 0.3 + cells.width * 0.25 * i / 10, cb.y + cb.height / 2); await page.waitForTimeout(25); }
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
    const edge = dialog.locator('.xt-clip.xt-main .xt-edge').first(), eb = await edge.boundingBox();
    await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(eb.x + eb.width / 2 - cells.width * 0.15 * i / 8, eb.y + eb.height / 2); await page.waitForTimeout(25); }
    await page.mouse.up(); await page.waitForTimeout(1200); await timingOpen();
    const speed = Number(await dialog.locator('input[data-field="speed"]').inputValue());
    assert.ok(speed > 105, `B: shortening the clip by its right edge speeds it up (${speed}%)`);
    await dialog.locator('button[data-part="armR"]').click(); await page.waitForTimeout(200);
    await dialog.locator('.xt-lane:not(.xt-body) .xt-label').click(); await page.waitForTimeout(300);
    assert.equal(await dialog.locator('button[data-part="armL"]').getAttribute('aria-pressed'), 'true', "B: clicking a lane's label selects its part");
    assert.ok(await dialog.locator('.xf-animations .xf-playing').count() <= 1, 'B: at most one animation marked as playing in step');
    await page.waitForTimeout(600);
    await s.shot('01-story-b-timeline', shots4);
    results.checks.push(`B: timeline clip drag sets Delay ${delay} ms (one history step, the swing moves later), its edge sets Speed ${speed}%, the lane label selects the arm`);
    results.checks.push('B: Strength and Raise drags move the drawn hand path and the arm live, without a renderer rebuild');
    // W3: the donor plays the selected part's animation on the result's clock.
    await dialog.locator('.xt-timeline').getByRole('button', { name: 'Play' }).click(); await page.waitForTimeout(200);
    await dialog.locator('.xt-timeline').getByRole('button', { name: 'Pause' }).click(); await page.waitForTimeout(300);
    const scrub = dialog.getByLabel('Time', { exact: true }), sb = await scrub.boundingBox(), frames = [];
    for (const at of [0.2, 0.6]) { await page.mouse.click(sb.x + sb.width * at, sb.y + sb.height / 2); await page.waitForTimeout(700); const d = await s.probe('Donor'); frames.push(d.frame); assert.equal(d.sequence, gruntModel.Sequences.findIndex(q => q.Name === 'Attack - 1'), "B: the donor plays the arm's animation"); }
    assert.ok(Math.abs(frames[1] - frames[0]) > 100, `B: scrubbing the result moves the donor with it (${frames.join(' -> ')})`);
    results.checks.push(`B: with the arm selected the donor follows the result's clock (${frames.join(' -> ')})`);
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
    const label = await button.innerText(), n = Number(label.match(/\((\d+)\)/)[1]), tip = await button.getAttribute('title');
    assert.ok(n > 5, `all: ${label}`);
    assert.ok(!/decay|portrait/i.test(tip) && !tip.split(/: |, /).includes('Death'), `all: the tooltip lists only new names (${tip})`);
    await button.hover(); await page.waitForTimeout(1200);
    await s.shot('01-footer-add-all', shots3);
    await button.click(); await page.waitForTimeout(3000);
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
    await dialog.locator('.xt-timeline').getByRole('button', { name: 'Pause' }).click(); await page.waitForTimeout(800);
    await s.shot('03-three-source-mix', shots4);
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
    await dialog.locator('.xt-timeline').getByRole('button', { name: 'Pause' }).click();
    const ruler = await dialog.getByLabel('Time', { exact: true }).boundingBox();
    await page.mouse.click(ruler.x + ruler.width * 0.45, ruler.y + ruler.height / 2); await page.waitForTimeout(1000);
    const start = await hand();
    assert.ok(start, 'aim: the hand path is drawn');
    let during;
    await drag(start, 70, async () => { during = (await hand()).points; await s.shot('04-hand-mid-drag', shots4); });
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
    await dialog.locator('.xt-timeline').getByRole('button', { name: 'Pause' }).click();
    const ruler = await dialog.getByLabel('Time', { exact: true }).boundingBox();
    await page.mouse.click(ruler.x + ruler.width * 0.45, ruler.y + ruler.height / 2); await page.waitForTimeout(1200);
    await s.shot('06-kurgan-both-hands', shots4);
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
    await dialog.locator('.xf-setups').getByRole('button', { name: 'File…' }).click(); await page.waitForTimeout(3000);
    assert.equal(await dialog.locator('input[data-part-switch="armL"]').isChecked(), true, 'setup: on the Lord of Change the arm is taken');
    assert.match(await s.view('Donor').locator('.xf-caption > span').innerText(), /grunt donor setup/i, 'setup: the Grunt reopened by its path');
    await s.shot('07-setup-on-lord-of-change', shots4);
    results.checks.push(`setup: loaded on the Lord of Change, the Grunt reopens by path (${await dialog.locator('.xf-setup-bar .preset-bar-status').innerText()})`);
    await s.noCrash('setup on lord');
  } finally { await s.close(); }
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
    await click(dialog.getByRole('button', { name: 'Original' }), 'Original on');
    await click(dialog.getByRole('button', { name: 'Original' }), 'Original off');
    await click(dialog.locator('.xt-timeline').getByRole('button', { name: 'Pause' }), 'Pause');
    const scrub = dialog.getByLabel('Time', { exact: true }), sb = await scrub.boundingBox();
    await page.mouse.move(sb.x + 4, sb.y + sb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(sb.x + sb.width * i / 11, sb.y + sb.height / 2); await page.waitForTimeout(16); }
    await page.mouse.up(); clicked.push('scrub'); await s.noCrash('scrub');
    await click(dialog.locator('.xt-timeline').getByRole('button', { name: 'Play' }), 'Play');
    await dialog.getByLabel('Name', { exact: true }).fill('Swing Defend'); clicked.push('Name');
    await click(dialog.getByRole('button', { name: 'Add animation' }), 'Add animation');
    assert.equal(await page.evaluate(() => window.__mdlxl.model().Sequences.at(-1).Name), 'Swing Defend', 'the typed name is used');
    await click(dialog.getByRole('button', { name: 'Clear all' }), 'Clear all');
    assert.equal(await dialog.locator('input[data-part-switch]:checked').count(), 0, 'Clear all removes every part');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300); clicked.push('window Ctrl+Z');
    assert.ok(await dialog.locator('input[data-part-switch]:checked').count() > 0, 'Ctrl+Z in the window brings the cleared parts back');
    await page.keyboard.press('Control+y'); await page.waitForTimeout(300); clicked.push('window Ctrl+Y');
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
      await dialog.locator('.xt-timeline').getByRole('button', { name: 'Pause' }).click();
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
  fs.mkdirSync(shots, { recursive: true }); fs.mkdirSync(shots3, { recursive: true }); fs.mkdirSync(shots4, { recursive: true });
  let failed = null;
  const all = ['B', 'A', 'all', 'mix', 'aim', 'weapon', 'setup', 'fx', 'sweep', 'unreadable', 'trials'];
  const only = process.env.MDLXL_TRANSFER_ONLY ? process.env.MDLXL_TRANSFER_ONLY.split(',') : all.filter(name => name !== 'sweep' || process.env.MDLXL_TRANSFER_SWEEP);
  for (const [name, run] of [['B', storyB], ['A', storyA], ['all', storyAll], ['mix', mix], ['aim', aimStory], ['weapon', weaponStory], ['setup', setupStory], ['fx', fx], ['sweep', sweep], ['unreadable', unreadable], ['trials', trials]]) {
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
