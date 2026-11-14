const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = process.env.MDLXL_TEST_OUT || path.join(__dirname, '../out/glow-up-multiple');
const firstAxe = 'AxHandle01', secondAxe = 'AxHandle02';

async function center(locator) {
  await locator.waitFor();
  const box = await locator.boundingBox();
  assert.ok(box, 'the control is visible');
  return [box.x + box.width / 2, box.y + box.height / 2];
}

async function waitFor(read, accept, message) {
  const deadline = Date.now() + 15000;
  let actual;
  do {
    actual = await read();
    if (accept(actual)) return actual;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.fail(message + ' — last read: ' + JSON.stringify(actual));
}

async function run() {
  const { app, page, errors } = await launchApp({
    fixture: fixturePath('glow-dual-weapon'), out,
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
    bounds: { x: 0, y: 0, width: 1600, height: 1000 },
  });
  const click = async locator => page.mouse.click(...await center(locator));
  const button = (scope, name) => scope.getByRole('button', { name, exact: true });
  const editor = page.getByRole('dialog', { name: 'Particle Editor', exact: true });
  const panel = editor.getByRole('dialog', { name: 'Glow Up', exact: true });
  const picker = panel.getByLabel('Weapon', { exact: true });
  const editWeapon = panel.getByLabel('Edit weapon glow', { exact: true });
  const brightness = panel.getByLabel('Weapon brightness % value', { exact: true });
  const add = button(panel, 'Add weapon glow');
  const choose = async (select, label) => {
    const labels = (await select.locator('option').allTextContents()).map(text => text.trim());
    const index = labels.indexOf(label);
    assert.ok(index >= 0, label + ' missing from ' + JSON.stringify(labels));
    if ((await select.locator('option:checked').textContent()).trim() === label) return;
    await click(select);
    await page.keyboard.press('Home');
    for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal((await select.locator('option:checked').textContent()).trim(), label);
  };
  const drag = async (x, y, dx, dy) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  };
  const snapshot = (base, preview = false) => page.evaluate(({ base, preview }) => {
    const doc = findFiberState(document.querySelector('.classic-app'), v => v?.doc?.model && v.assets)?.doc;
    if (!preview) return { count: doc.model.Geosets.length, undo: doc.historyStats.undoSteps };
    const el = document.querySelector('.pe-preview .game-preview-root') || document.querySelector('.pe-preview canvas');
    const model = el && findFiberProps(el, p => p?.presentation === 'preview' && p.model)?.model;
    const runtime = el && findFiberState(el, s => (s?.camera || s?.controls?.object)?.position);
    return {
      camera: (runtime?.camera || runtime?.controls?.object)?.position.toArray(),
      glows: model?.Geosets.slice(base).map(g => ({
        parents: [...new Set(g.Groups.flat().map(id => model.Nodes[model.Nodes[id]?.Parent]?.Name))],
        alpha: model.Materials[g.MaterialID].Layers[0].Alpha,
        width: Math.abs(g.Vertices[7] - g.Vertices[1]),
      })),
    };
  }, { base, preview });
  const openGlow = async () => {
    await click(button(editor, 'Glow Up'));
    await panel.waitFor();
  };
  const prepareSingle = async () => {
    const origin = panel.getByLabel('Origin glow', { exact: true });
    const weapon = panel.getByLabel('Weapon glow', { exact: true });
    if (await origin.isChecked()) await click(origin);
    if (!await weapon.isChecked()) await click(weapon);
    await choose(picker, firstAxe);
  };
  const commit = async name => {
    await click(button(panel, name));
    await panel.waitFor({ state: 'hidden' });
  };
  const countGlows = (base, count) => waitFor(() => snapshot(base, true),
    value => value.glows?.length === count && value.camera, 'preview should draw ' + count + ' glows');

  try {
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    const original = await snapshot(), base = original.count;
    await click(button(page, 'Emitter Editor'));
    await openGlow();
    await prepareSingle();
    assert.equal(await add.count(), 1, 'Glow Up lets the user stage a second weapon glow');
    if (await button(editor, 'Pause').isVisible()) await click(button(editor, 'Pause'));

    await click(add);
    await choose(picker, secondAxe);
    await click(button(panel, 'Remove weapon glow'));
    const single = await countGlows(base, 1);
    assert.deepEqual(single.glows[0].parents, [firstAxe]);
    assert.deepEqual(await snapshot(), original);

    await click(add);
    await choose(picker, secondAxe);
    const before = await countGlows(base, 2);
    assert.deepEqual(before.glows.map(g => g.parents), [[firstAxe], [secondAxe]]);
    await click(brightness);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('42');
    await page.keyboard.press('Enter');
    await waitFor(() => snapshot(base, true), value => Math.abs(value.glows?.[1]?.alpha - .42) < 1e-6,
      'the second glow should use 42% brightness');
    const corner = editor.locator('[aria-label="Resize weapon glow"] circle:not(.pe-grab)');
    const [x, y] = await center(corner);
    await drag(x, y, 32, -32);
    const resized = await waitFor(() => snapshot(base, true), value => value.glows?.[1]?.width > before.glows[1].width * 1.05,
      'dragging the size corner should resize the second glow');
    assert.deepEqual(resized.glows[0], before.glows[0]);
    assert.ok(resized.camera.every((v, i) => Math.abs(v - before.camera[i]) < 1e-3));

    const secondCorner = await center(corner);
    const cornerDistance = ([cx, cy]) => Math.hypot(cx - secondCorner[0], cy - secondCorner[1]);
    await choose(editWeapon, firstAxe);
    assert.equal(await brightness.inputValue(), '75');
    await waitFor(() => center(corner), point => cornerDistance(point) > 3, 'handles should switch to the first glow while paused');
    await choose(editWeapon, secondAxe);
    assert.equal(await brightness.inputValue(), '42');
    await waitFor(() => center(corner), point => cornerDistance(point) < 2, 'handles should return to the second glow');
    const canvas = await editor.locator('.pe-preview canvas').first().boundingBox();
    await drag(canvas.x + canvas.width / 2, canvas.y + canvas.height * .85, 105, 35);
    await waitFor(() => snapshot(base, true), value => value.camera?.some((v, i) => Math.abs(v - before.camera[i]) > .1),
      'a normal mouse drag should orbit the preview');
    await commit('Create');
    assert.deepEqual(await snapshot(), { count: base + 2, undo: original.undo + 1 });
    await click(button(editor, 'Undo'));
    assert.deepEqual(await snapshot(), original);

    await openGlow();
    await prepareSingle();
    await commit('Create');
    await openGlow();
    await click(add);
    await choose(picker, secondAxe);
    await commit('Apply');
    assert.deepEqual(await snapshot(), { count: base + 2, undo: original.undo + 2 });
    await click(button(editor, 'Undo'));
    assert.deepEqual(await snapshot(), { count: base + 1, undo: original.undo + 1 });
    assert.deepEqual(errors, []);
    console.log('Two workflows passed: create separate axe glows together, and add a glow alongside an existing one.');
  } finally {
    await closeApp(app);
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
