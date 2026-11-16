// Transfer (XFER) acceptance with real mouse input on the app: docs/agent-tasks/transfer-xl.md "Window acceptance".
// Disposable profile and model copies under out/; never opens or replaces a user profile. Run it hidden:
// MDLXL_PLAYWRIGHT_MODULE=<playwright-core> MDLXL_TEST_EXE=<MDLxL.exe> node test/transfer.electron.cjs
// MDLXL_TRANSFER_SWEEP=1 adds a click-through of every control in the window.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');
const { fixturePath, testModel } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_TRANSFER_OUT || 'out/transfer-ui');
const results = { checks: [], errors: [], screenshots: [] };
const watchdog = setTimeout(() => { console.error('Transfer harness timed out'); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ...results, timedOut: true }, null, 2)); process.exit(3); }, Number(process.env.MDLXL_TRANSFER_TIMEOUT || 900000));

function copyModel(key, name) {
  const source = fixturePath(key);
  if (!source || !fs.existsSync(source)) throw Error(`Test model ${key} is not on this machine`);
  const target = path.join(out, name); fs.copyFileSync(source, target); return target;
}
const readModel = async file => { const { parseCompatibleMdx } = await import('../src/mdx-compatibility.js'); const b = fs.readFileSync(file); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

async function session(fixture, label) {
  const errors = [], consoleErrors = [];
  const { app, page } = await launchApp({ out, fixture, errors, bounds: { x: -3000, y: 0, width: 1500, height: 960 }, timeout: 90000, pageTimeout: 30000 });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.waitForFunction(() => !!window.__mdlxl?.model?.(), null, { timeout: 60000 });
  const dialog = page.getByRole('dialog', { name: 'Transfer' });
  const shot = async name => { const file = path.join(out, name + '.png'); await page.screenshot({ path: file }); results.screenshots.push(file); };
  const pane = name => dialog.locator(`section[aria-label="${name}"]`);
  const count = () => page.evaluate(() => window.__mdlxl.model().Sequences.length);
  const noCrash = async where => {
    assert.equal(await page.locator('[data-error-boundary],.error-boundary').count(), 0, `${label}: error screen at ${where}`);
    assert.deepEqual(errors, [], `${label}: page errors at ${where}`);
  };
  // The preview of one pane: camera, frame and handles as its renderer has them.
  const preview = name => page.evaluate(name => {
    const root = document.querySelector(`[role="dialog"][aria-label="Transfer"] section[aria-label="${name}"] .game-preview-root`), probe = window.__mdlxl.preview(root), canvas = root.querySelector('canvas'), box = canvas.getBoundingClientRect();
    return { frame: probe.runtime.native.getFrame(), sequence: probe.props.sequenceIndex, camera: probe.runtime.controls.object.toJSON(), config: probe.props.poseConfig, mode: probe.props.transformMode, box: { x: box.x, y: box.y, width: canvas.clientWidth, height: canvas.clientHeight } };
  }, name);
  const handles = async (name, model) => {
    const { ObjectLoader } = await import('three'), { projectPoseHandles } = await import('../app/pose-overlay.js');
    const data = await preview(name), camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return { box: data.box, list: projectPoseHandles(model, data.config, data.frame, data.sequence, camera, data.box.width, data.box.height, undefined, undefined, undefined, data.mode) };
  };
  // Pixels of a pane's preview, to prove a camera drag moved the view.
  const pixels = async name => { const box = await pane(name).locator('.xf-preview').boundingBox(); return page.screenshot({ clip: box }); };
  const dragCamera = async name => {
    const box = await pane(name).locator('.xf-preview').boundingBox(), before = await pixels(name);
    const x = box.x + box.width * 0.85, y = box.y + box.height * 0.2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(x - i * 12, y + i * 3); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(400);
    assert.ok(!before.equals(await pixels(name)), `${label}: dragging in the ${name} preview turns its camera`);
  };
  const dragSlider = async (field, fraction) => {
    const input = dialog.locator(`input[data-field="${field}"]`), box = await input.boundingBox();
    const y = box.y + box.height / 2, from = box.x + box.width * 0.5, to = box.x + box.width * fraction;
    await page.mouse.move(from, y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(from + (to - from) * i / 10, y); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(300);
  };
  const close = async () => { if (consoleErrors.length) results.consoleErrors = [...(results.consoleErrors || []), ...consoleErrors.map(text => `${label}: ${text}`)]; if (!closed) { closed = true; try { await page.screenshot({ path: path.join(out, `last-${label}.png`) }); } catch {} } try { await closeApp(app); } catch (error) { console.error('close:', error.message); } };
  let closed = false;
  return { app, page, dialog, shot, pane, count, noCrash, handles, dragCamera, dragSlider, close, errors, consoleErrors };
}

async function storyB() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 01.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor.mdx');
  const s = await session(footman, 'B'), { page, dialog } = s;
  try {
    await s.shot('dock');
    await page.locator('button.transfer-tool').click();
    await dialog.waitFor();
    await page.waitForTimeout(800);
    await s.shot('empty-window');
    results.checks.push('B: XFER opens Transfer with the donor choices');
    const before = await s.count();
    await stubDialogs(s.app, { open: grunt });
    await s.pane('From').getByRole('button', { name: 'Open file...' }).click();
    await s.pane('From').getByLabel('From', { exact: true }).waitFor();
    await s.pane('From').getByLabel('Animation', { exact: true }).selectOption({ label: 'Attack - 1' });
    await s.pane('To').getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' });
    await dialog.getByRole('button', { name: 'Pause' }).click();
    await page.waitForTimeout(600);
    // The Grunt's weapon hand: its armL chain (limb:36).
    const gruntModel = await readModel(grunt), { box, list } = await s.handles('From', gruntModel);
    const hand = list.find(h => h.kind === 'endpoint' && h.chain?.end === 36 && h.visible);
    assert.ok(hand, 'B: the Grunt weapon-hand handle is visible');
    await page.mouse.click(box.x + hand.x, box.y + hand.y); await page.waitForTimeout(500);
    const chip = dialog.locator('button[data-part="armL"]');
    assert.equal(await chip.getAttribute('aria-pressed'), 'true', 'B: clicking the hand handle selects Left arm');
    assert.match(await chip.getAttribute('class'), /xf-taken/, 'B: clicking the hand handle takes Left arm');
    results.checks.push('B: clicking the Grunt weapon-hand handle takes and selects Left arm');
    await s.dragSlider('amount', 0.9);
    const amount = await dialog.locator('input[data-field="amount"]').inputValue();
    assert.ok(Number(amount) > 110, `B: Amount dragged up (${amount})`);
    results.checks.push(`B: Amount slider dragged to ${amount}%`);
    await dialog.getByRole('button', { name: 'Play' }).click(); await page.waitForTimeout(300);
    await dialog.getByRole('button', { name: 'Pause' }).click(); await page.waitForTimeout(300);
    // A slider drag moves the result live, on the same renderer (no rebuild while the mouse is down).
    {
      const resultRuntime = () => page.evaluate(() => { const root = document.querySelector('[role="dialog"][aria-label="Transfer"] section[aria-label="To"] .game-preview-root'), runtime = window.__mdlxl.preview(root).runtime; const same = window.__xfRuntime === runtime; window.__xfRuntime = runtime; return same; });
      await resultRuntime();
      const input = dialog.locator('input[data-field="offset0"]'), ib = await input.boundingBox(), y = ib.y + ib.height / 2, area = await s.pane('To').locator('.xf-preview').boundingBox();
      const still = await page.screenshot({ clip: area });
      await page.mouse.move(ib.x + ib.width / 2, y); await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(ib.x + ib.width * (0.5 + 0.04 * i), y); await page.waitForTimeout(30); }
      await page.waitForTimeout(700);
      const moved = await page.screenshot({ clip: area }), sameRenderer = await resultRuntime();
      await page.mouse.up(); await page.waitForTimeout(500);
      assert.ok(!still.equals(moved), 'B: dragging Raise moves the arm in the result while the mouse is down');
      assert.ok(sameRenderer, 'B: the result preview is not rebuilt during the drag');
      assert.ok(await resultRuntime(), 'B: nor after a release that keeps the length');
      results.checks.push('B: dragging Raise moves the arm live; the result renderer is not rebuilt');
    }
    await s.shot('story-b-arm');
    await s.dragCamera('From'); await s.dragCamera('To');
    results.checks.push('B: mouse drags turn the camera in both panes');
    await dialog.getByRole('button', { name: 'Add animation' }).click(); await page.waitForTimeout(800);
    assert.equal(await s.count(), before + 1, 'B: Add animation adds one animation');
    const name = await page.evaluate(() => window.__mdlxl.model().Sequences.at(-1).Name);
    await dialog.getByText('Added').waitFor();
    results.checks.push(`B: Add animation added "${name}"; the window stays open and says so`);
    await dialog.getByRole('button', { name: 'Close Transfer' }).click(); await page.waitForTimeout(300);
    await page.keyboard.press('Control+Z'); await page.waitForTimeout(800);
    assert.equal(await s.count(), before, 'B: one Undo in the editor removes the added animation');
    results.checks.push('B: one Undo in the editor removes it');
    await s.noCrash('story B');
  } finally { await s.close(); }
}

async function storyA() {
  const lord = copyModel('transfer-lord-of-change', 'TEST TRANSFER 02.mdx'), footman = copyModel('transfer-footman', 'footman donor.mdx');
  const s = await session(lord, 'A'), { page, dialog } = s;
  try {
    await page.locator('button.transfer-tool').click();
    await dialog.waitFor();
    const before = await s.count();
    await stubDialogs(s.app, { open: footman });
    await s.pane('From').getByRole('button', { name: 'Open file...' }).click();
    await s.pane('From').getByLabel('Animation', { exact: true }).selectOption({ label: 'Stand Defend' });
    await s.pane('From').getByRole('button', { name: 'Take whole body' }).click();
    await page.waitForTimeout(1500);
    assert.equal(await dialog.locator('button[aria-pressed="true"]', { hasText: 'All' }).count(), 1, 'A: Take whole body selects All');
    const taken = await dialog.locator('button.xf-chip.xf-taken[data-part]').count();
    assert.ok(taken >= 7, `A: ${taken} parts taken`);
    assert.equal(await dialog.locator('button[data-part="wingL"]').getAttribute('class'), 'xf-chip', 'A: the wings stay on the body animation');
    assert.equal(await s.pane('From').getByRole('button', { name: 'Mirror' }).getAttribute('aria-pressed'), 'true', 'A: weapon hands on opposite sides mirror by themselves');
    await s.shot('story-a-whole-body');
    results.checks.push(`A: Take whole body takes ${taken} parts and leaves the wings; Mirror is on by itself`);
    await dialog.getByRole('button', { name: 'Add animation' }).click(); await page.waitForTimeout(1000);
    assert.equal(await s.count(), before + 1, 'A: Add animation adds one animation');
    const name = await page.evaluate(() => window.__mdlxl.model().Sequences.at(-1).Name);
    await dialog.getByRole('button', { name: 'Close Transfer' }).click(); await page.waitForTimeout(300);
    const saved = path.join(out, 'TEST TRANSFER 02 saved.mdx');
    await stubDialogs(s.app, { save: saved, message: 0 });
    await page.evaluate(() => window.__mdlxl && document.activeElement?.blur?.());
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

// Every control of the window, on both stories' models, watching for crashes and page errors.
async function sweep() {
  const footman = copyModel('transfer-footman', 'TEST TRANSFER 03.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor 2.mdx');
  const s = await session(footman, 'sweep'), { page, dialog } = s, clicked = [];
  const click = async (locator, what) => { await locator.click(); await page.waitForTimeout(250); clicked.push(what); await s.noCrash(what); };
  try {
    await page.locator('button.transfer-tool').click(); await dialog.waitFor();
    await click(s.pane('From').getByRole('button', { name: 'This model' }), 'From: This model');
    await s.pane('From').getByLabel('Animation', { exact: true }).selectOption({ label: 'Walk' }); clicked.push('donor Animation');
    await click(s.pane('From').getByRole('button', { name: 'Take whole body' }), 'Take whole body');
    await s.pane('To').getByLabel('Body animation', { exact: true }).selectOption({ label: 'Stand Defend' }); clicked.push('Body animation');
    await stubDialogs(s.app, { open: grunt });
    await s.pane('From').getByLabel('From', { exact: true }).selectOption({ label: 'Open file...' }); await page.waitForTimeout(1200); clicked.push('From: Open file...');
    await s.pane('From').getByLabel('Animation', { exact: true }).selectOption({ label: 'Attack - 1' });
    for (const key of await dialog.locator('button[data-part]').evaluateAll(list => list.map(b => b.dataset.part))) {
      const chip = dialog.locator(`button[data-part="${key}"]`);
      await click(chip, 'chip ' + key);
      const take = dialog.locator('.xf-part-row button', { hasText: 'Take from' });
      if (await take.isEnabled()) await click(take, 'Take ' + key);
      for (const field of await dialog.locator('input[data-field]').evaluateAll(list => list.map(i => i.dataset.field))) { await s.dragSlider(field, 0.75); clicked.push(`slider ${field} (${key})`); await s.noCrash('slider ' + field); }
      if (await dialog.getByLabel('Plant foot').count()) await click(dialog.getByLabel('Plant foot'), 'Plant foot ' + key);
      await click(dialog.getByRole('button', { name: 'Reset', exact: true }), 'Reset ' + key);
      await chip.dblclick(); await page.waitForTimeout(300); clicked.push('double-click chip ' + key); await s.noCrash('double-click ' + key);
    }
    await click(s.pane('From').getByRole('button', { name: 'Take whole body' }), 'Take whole body (Grunt)');
    await click(dialog.getByRole('button', { name: 'All', exact: true }), 'chip All');
    for (const field of await dialog.locator('input[data-field]').evaluateAll(list => list.map(i => i.dataset.field))) { await s.dragSlider(field, 0.3); clicked.push('slider All ' + field); await s.noCrash('All ' + field); }
    await click(s.pane('From').getByRole('button', { name: 'Mirror' }), 'Mirror on');
    await click(s.pane('From').getByRole('button', { name: 'Mirror' }), 'Mirror off');
    await click(dialog.getByRole('button', { name: 'Original' }), 'Original on');
    await click(dialog.getByRole('button', { name: 'Original' }), 'Original off');
    await click(dialog.getByRole('button', { name: 'Pause' }), 'Pause');
    const scrub = dialog.getByLabel('Time', { exact: true }), sb = await scrub.boundingBox();
    await page.mouse.move(sb.x + 4, sb.y + sb.height / 2); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(sb.x + sb.width * i / 11, sb.y + sb.height / 2); await page.waitForTimeout(16); }
    await page.mouse.up(); clicked.push('scrub'); await s.noCrash('scrub');
    await click(dialog.getByRole('button', { name: 'Play' }), 'Play');
    await dialog.getByLabel('Name', { exact: true }).fill('Swing Defend'); clicked.push('Name');
    await click(dialog.getByRole('button', { name: 'Give back' }), 'Give back (All)');
    await click(dialog.locator('button[data-part="armL"]'), 'chip armL again');
    await click(dialog.locator('.xf-part-row button', { hasText: 'Take from' }), 'Take armL again');
    await click(dialog.getByRole('button', { name: 'Add animation' }), 'Add animation');
    assert.equal(await page.evaluate(() => window.__mdlxl.model().Sequences.at(-1).Name), 'Swing Defend', 'the typed name is used');
    await click(dialog.getByRole('button', { name: 'Clear' }), 'Clear');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300); clicked.push('window Ctrl+Z');
    assert.ok(await dialog.locator('button.xf-chip.xf-taken[data-part]').count() > 0, 'Ctrl+Z in the window brings the cleared parts back');
    await page.keyboard.press('Control+y'); await page.waitForTimeout(300); clicked.push('window Ctrl+Y');
    await s.shot('sweep-end');
    await click(dialog.getByRole('button', { name: 'Close Transfer' }), 'close');
    const tabs = await page.locator('.model-tab').count();
    await page.locator('button.transfer-tool').click(); await dialog.waitFor(); clicked.push('reopen');
    await click(s.pane('From').getByRole('button', { name: 'Library...' }), 'Library...');
    const library = page.getByRole('dialog', { name: 'Library' });
    await library.waitFor(); await page.waitForTimeout(1500); await s.shot('library-picker');
    await library.locator('input[type=search], input:not([type])').first().fill('footman'); clicked.push('Library search');
    const row = library.getByRole('treeitem').filter({ hasText: /footman/i }).first();
    await row.waitFor({ timeout: 30000 });
    await row.dblclick(); clicked.push('Library: double-click a model');
    await library.waitFor({ state: 'detached', timeout: 30000 });
    await s.pane('From').getByLabel('From', { exact: true }).waitFor({ timeout: 30000 });
    const picked = await s.pane('From').getByLabel('From', { exact: true }).evaluate(select => select.selectedOptions[0]?.textContent || '');
    assert.match(picked, /footman/i, 'the Library model becomes the donor');
    await page.waitForTimeout(1500); await s.shot('library-donor');
    results.checks.push(`sweep: Library... picks ${picked.trim()} as the donor without opening a tab`);
    assert.equal(await page.locator('.model-tab').count(), tabs, 'the Library donor opens no tab');
    // A donor without parts says so in its pane.
    const cloud = testModel('corpus-sd/undead__plaguecloud.mdx');
    if (fs.existsSync(cloud)) {
      const copy = path.join(out, 'no parts donor.mdx'); fs.copyFileSync(cloud, copy);
      await stubDialogs(s.app, { open: copy });
      await s.pane('From').getByLabel('From', { exact: true }).selectOption({ label: 'Open file...' }); clicked.push('From: Open file... (no parts)');
      await s.pane('From').locator('.xf-overlay-note').waitFor();
      assert.match(await s.pane('From').locator('.xf-overlay-note').innerText(), /no parts|No body/i, 'a donor without parts shows the reason');
      await s.shot('donor-without-parts');
    }
    await click(dialog.getByRole('button', { name: 'Close Transfer' }), 'close again');
    results.checks.push(`sweep: ${clicked.length} controls clicked or dragged, no crash or page error`);
    await s.noCrash('sweep');
  } finally { await s.close(); }
}

// A model with no recognisable parts shows the engine's sentences and nothing else.
async function unreadable() {
  const plain = path.join(out, 'TEST TRANSFER 04 no rig.mdx');
  // The plague cloud has no bones a body can be read from.
  const picked = testModel('corpus-sd/undead__plaguecloud.mdx');
  if (!picked || !fs.existsSync(picked)) { results.checks.push('unreadable rig: corpus-sd/undead__plaguecloud.mdx is not on this machine, skipped'); return; }
  fs.copyFileSync(picked, plain);
  const s = await session(plain, 'unreadable'), { page, dialog } = s;
  try {
    await page.locator('button.transfer-tool').click(); await dialog.waitFor(); await page.waitForTimeout(500);
    assert.equal(await dialog.locator('.xf-problems').count(), 1, 'unreadable rig: the problem sentences show');
    assert.equal(await dialog.locator('.xf-panes').count(), 0, 'unreadable rig: nothing else shows');
    await s.shot('unreadable-rig');
    results.checks.push(`unreadable rig (${path.basename(picked)}): only the problem sentences show`);
    await s.noCrash('unreadable');
  } finally { await s.close(); }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  let failed = null;
  const only = (process.env.MDLXL_TRANSFER_ONLY || 'B,A,sweep,unreadable').split(',');
  for (const [name, run] of [['B', storyB], ['A', storyA], ['sweep', sweep], ['unreadable', unreadable]]) {
    if (!only.includes(name) || (name === 'sweep' && !process.env.MDLXL_TRANSFER_SWEEP && !process.env.MDLXL_TRANSFER_ONLY)) continue;
    try { await run(); } catch (error) { failed ||= error; results.errors.push(`${name}: ${error.stack || error.message}`); console.error(name, error); }
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  for (const check of results.checks) console.log('ok -', check);
  for (const line of results.consoleErrors || []) console.log('console error -', line);
  clearTimeout(watchdog);
  if (failed) { console.error('FAILED'); process.exit(1); }
  console.log('PASSED'); process.exit(0);
})();
