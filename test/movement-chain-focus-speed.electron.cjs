// Rebuilt Electron acceptance for chain copy, focused skeleton, playback speed and collapsible sidebars.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createNode } = await import('../src/editor-document.js');
  const { createStarterDocument } = await import('../src/starter-model.js');
  const cwd = process.cwd(), out = path.join(cwd, 'out/movement-chain-focus-speed');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'chain.mdx'), doc = createStarterDocument();
  let shoulderId;
  doc.apply('Chain fixture', ['Sequences', 'Nodes', 'PivotPoints'], model => {
    model.Sequences = [{ Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 }];
    const chest = model.Bones[0]; chest.Name = 'Chest'; chest.Rotation = track(100); place(chest, [0, 0, 0]);
    const shoulder = createNode(model, 'Bone'); shoulder.Name = 'Shoulder 1'; shoulder.Parent = chest.ObjectId; shoulder.Rotation = track(200); place(shoulder, [25, 20, 0]); shoulderId = shoulder.ObjectId;
    const arm = createNode(model, 'Bone'); arm.Name = 'Arm 1'; arm.Parent = shoulder.ObjectId; arm.Rotation = track(300); place(arm, [50, 0, 0]);
    const hand = createNode(model, 'Bone'); hand.Name = 'Hand 1'; hand.Parent = arm.ObjectId; hand.Rotation = track(400); place(hand, [75, 20, 0]);
    const unrelated = createNode(model, 'Bone'); unrelated.Name = 'Other Shoulder'; unrelated.Parent = chest.ObjectId; unrelated.Rotation = track(500); place(unrelated, [-40, -30, 0]);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));

  const app = await _electron.launch({
    executablePath: path.join(cwd, 'node_modules/electron/dist/electron.exe'),
    args: ['--disable-backgrounding-occluded-windows', cwd, fixture],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000,
  });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => { throw error; });
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setPosition(-3000, 0); window.showInactive(); });
    await page.locator('[data-hotkey="animation"]').click();
    await page.getByLabel('Movement bone or node').selectOption(String(shoulderId));
    await page.getByRole('group', { name: 'Movement tool' }).getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.getByLabel('Highlight KF').check();
    assert.deepEqual(await markerFrames(page), [200]);
    await page.getByLabel('Highlight Chain').check();
    assert.deepEqual(await markerFrames(page), [200, 300, 400]);
    assert.equal(await page.locator('.classic-reel-key[data-frame="100"]').count(), 0, 'parent key stays outside the downstream chain');

    await sendMenu(app, 'keyframe:selectAll'); await page.locator('.classic-reel-selection').waitFor(); await sendMenu(app, 'keyframe:copy');
    await page.waitForFunction(() => document.querySelector('.classic-status')?.textContent.includes('3 stored keys copied.'));

    const focused = page.getByLabel('Focused Skeleton', { exact: true }), skeleton = page.getByLabel('Skeleton', { exact: true });
    await focused.check(); assert.equal(await skeleton.isChecked(), false);
    await skeleton.check(); assert.equal(await focused.isChecked(), false);

    // Focused Skeleton shows the selected bone's chain with Bones off; a real
    // click on the next bone in that chain must select it.
    await focused.check();
    const picker = page.getByLabel('Movement bone or node'), bones = page.locator('input[data-hotkey="display:bones"]').first();
    if (await bones.isChecked()) await bones.uncheck();
    await page.locator('[data-hotkey="select"]').click();
    await picker.selectOption(String(shoulderId)); await page.waitForTimeout(300);
    const arm = await screenPoint(page, [50, 0, 0]), other = await screenPoint(page, [-40, -30, 0]);
    await page.mouse.click(other.x, other.y); await page.waitForTimeout(300);
    assert.doesNotMatch(await picker.locator('option:checked').textContent(), /Other Shoulder/, 'a bone outside the focused chain stays unpickable with Bones off');
    await picker.selectOption(String(shoulderId)); await page.waitForTimeout(300);
    await page.mouse.click(arm.x, arm.y); await page.waitForTimeout(300);
    assert.match(await picker.locator('option:checked').textContent(), /Arm 1$/, 'clicking the focused child bone selects it');
    const hand = await screenPoint(page, [75, 20, 0]);
    await page.mouse.click(hand.x, hand.y); await page.waitForTimeout(300);
    assert.match(await picker.locator('option:checked').textContent(), /Hand 1$/, 'the next bone down the chain is pickable too');
    await page.screenshot({ path: path.join(out, 'focused-pick.png') });

    const speed = page.getByLabel('Playback speed percent');
    assert.equal(await speed.inputValue(), '100');
    await speed.fill('999'); await speed.blur(); assert.equal(await speed.inputValue(), '250');
    await speed.fill('-100'); await speed.blur(); assert.equal(await speed.inputValue(), '1');
    await speed.fill('100'); await speed.blur();
    const settingsBox = await page.locator('.classic-reel-settings').evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, rows: element.querySelectorAll('label').length }));
    assert.deepEqual(settingsBox, { width: 76, height: 48, rows: 2 });

    const movementSections = page.locator('.classic-sidebar details.sidebar-section');
    assert.ok(await movementSections.count() >= 8);
    assert.equal(await movementSections.evaluateAll(items => items.every(item => item.open)), true);
    await movementSections.first().locator('summary').click(); assert.equal(await movementSections.first().evaluate(item => item.open), false);
    await focused.check();
    await page.screenshot({ path: path.join(out, 'movement.png') });

    await page.locator('[data-hotkey="animations"]').click();
    await page.locator('.animation-controller').waitFor();
    const animationSections = page.locator('.classic-sidebar details.sidebar-section');
    assert.ok(await animationSections.count() >= 4);
    assert.equal(await page.getByLabel('Focused Skeleton', { exact: true }).count(), 1);
    assert.equal(await page.getByLabel('Playback speed percent').inputValue(), '100');
    await page.screenshot({ path: path.join(out, 'animations.png') });
    console.log('PASS: Highlight Chain copy, Focused Skeleton exclusivity, 1-250% playback speed, and collapsible Movement/Animations sidebars');
  } finally {
    await app.evaluate(({ app }) => app.exit(0));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

function track(Frame) {
  return { LineType: 1, GlobalSeqId: null, Keys: [{ Frame, Vector: new Float32Array([0, 0, 0, 1]) }] };
}
function place(node, point) {
  node.PivotPoint.set(point);
}
function sendMenu(app, command) {
  return app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), command);
}
// Bind-pose pivot to page coordinates, using the Movement preview's own camera.
function screenPoint(page, world) {
  return page.evaluate(world => {
    const root = document.querySelector('.game-preview-root'), canvas = root.querySelector('canvas'), rect = canvas.getBoundingClientRect();
    let fiber = root[Object.keys(root).find(key => key.startsWith('__reactFiber'))], camera;
    for (; fiber && !camera; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) { const state = hook.memoizedState?.current; if (state?.native && state.controls) { camera = state.controls.object; break; } }
    camera.updateMatrixWorld();
    const apply = (m, [x, y, z, w]) => [0, 1, 2, 3].map(r => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r] * w);
    const clip = apply(camera.projectionMatrix.elements, apply(camera.matrixWorldInverse.elements, [...world, 1]));
    return { x: rect.left + (clip[0] / clip[3] + 1) * rect.width / 2, y: rect.top + (1 - clip[1] / clip[3]) * rect.height / 2 };
  }, world);
}
async function markerFrames(page) {
  return page.locator('.classic-reel-key').evaluateAll(items => items.map(item => Number(item.dataset.frame)).sort((a, b) => a - b));
}
