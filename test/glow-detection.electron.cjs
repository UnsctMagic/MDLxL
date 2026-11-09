const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = process.env.MDLXL_TEST_OUT || path.join(__dirname, '../out/glow-detection');
const fixture = fixturePath('glow-eye-effect');

async function click(page, locator) {
  await locator.waitFor();
  const box = await locator.boundingBox();
  assert.ok(box, 'control has a clickable box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function run() {
  const { app, page, errors, target } = await launchApp({
    fixture, out, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
    bounds: { x: 0, y: 0, width: 1500, height: 950 },
  });
  const button = (scope, name) => scope.getByRole('button', { name, exact: true });
  const editor = page.getByRole('dialog', { name: 'Particle Editor', exact: true });
  const panel = editor.getByRole('dialog', { name: 'Glow Up', exact: true });
  const picker = panel.getByLabel('Weapon', { exact: true });
  const review = button(panel, 'Review detected glow');
  const notGlow = button(panel, 'Not a glow');
  const restore = button(panel, 'Use as glow');
  const capture = async name => {
    const png = await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i => i.toPNG().toString('base64')));
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(png, 'base64'));
  };
  const read = () => page.evaluate(() => {
    const state = findFiberState(document.querySelector('.classic-app'), value => value?.doc?.model && value.assets);
    const doc = state.doc, eyes = doc.model.Geosets[35];
    return JSON.parse(JSON.stringify({
      eyes, material: doc.model.Materials[eyes.MaterialID], undo: doc.historyStats.undoSteps,
      geosets: doc.model.Geosets.length, bladeGlows: doc.model.Bones.filter(b => /^Glow Weapon/.test(b.Name) && b.Parent === 66).length,
    }));
  });
  const openEditor = async () => {
    await click(page, button(page, 'Emitter Editor'));
    await editor.waitFor();
  };
  const openGlow = () => click(page, button(editor, 'Glow Up'));
  const closeGlow = async () => {
    await click(page, button(panel, 'Cancel'));
    await panel.waitFor({ state: 'hidden' });
  };
  try {
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    const original = await read();
    await openEditor();
    await openGlow();
    await panel.waitFor();
    assert.equal(await picker.count(), 1, 'the eye effect must not hide the weapon picker');
    assert.equal(await picker.locator('option:checked').textContent(), 'VC_Rider_Blade');
    assert.equal(await review.count(), 0, 'the eye pieces do not enter the review list');

    await click(page, panel.getByLabel('Origin glow', { exact: true }));
    await click(page, button(panel, 'Create'));
    await panel.waitFor({ state: 'hidden' });
    const withGlow = await read();
    assert.equal(withGlow.geosets, original.geosets + 1);
    assert.equal(withGlow.undo, original.undo + 1);
    assert.ok(withGlow.bladeGlows > 0);
    assert.deepEqual([withGlow.eyes, withGlow.material], [original.eyes, original.material]);

    await openGlow();
    await review.waitFor();
    assert.equal(await notGlow.count(), 0, 'review controls start collapsed');
    assert.equal(await picker.count(), 0, 'the existing blade glow owns the weapon controls');
    await click(page, review);
    await notGlow.waitFor();
    await capture('review');
    const pieces = panel.getByLabel('Detected glow piece', { exact: true });
    const count = await pieces.locator('option').count();
    for (let index = 0; index < count; index++) {
      if (index > 0) {
        await click(page, pieces);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        assert.equal(await pieces.inputValue(), String(index));
      }
      await click(page, notGlow);
      await restore.waitFor();
    }
    await picker.waitFor();
    assert.equal(await picker.locator('option:checked').textContent(), 'VC_Rider_Blade');
    assert.deepEqual(await read(), withGlow, 'review choices do not edit the model or history');
    await closeGlow();
    await click(page, button(editor, 'Close Particle Editor'));
    await editor.waitFor({ state: 'hidden' });
    await openEditor();
    await openGlow();
    await picker.waitFor();
    await click(page, review);
    await click(page, restore);
    await picker.waitFor({ state: 'hidden' });
    assert.deepEqual(await read(), withGlow, 'restoring a piece changes only detection');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({
      ...bundleHashes(target), checks: 2, pieces: count, errors,
    }, null, 2));
    console.log('2 workflows passed: create blade glow without touching the eyes, and exclude/restore detected pieces.');
  } catch (error) {
    await capture('failure').catch(() => {});
    throw error;
  } finally {
    await closeApp(app);
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
