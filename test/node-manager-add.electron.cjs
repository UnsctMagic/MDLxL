const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp, prepareWindow, waitForInfo } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const fixture = fixturePath('citadel-footman');
  const { app, page, errors } = await launchApp({
    fixture, out: path.join(process.cwd(), 'out', 'node-manager-add'),
  });
  try {
    await waitForInfo(page, 'Opened ' + path.basename(fixture));
    const manager = page.getByRole('dialog', { name: 'Node Manager', exact: true });
    const newButton = manager.getByRole('button', { name: 'New', exact: true });
    const categories = manager.getByRole('group', { name: 'Event objects', exact: true });
    const addEvent = manager.getByRole('button', { name: 'Add event', exact: true });
    const openManager = async () => { await page.keyboard.press('Alt+o'); await manager.waitFor(); };
    const nodes = () => page.evaluate(() => {
      const { doc } = findFiberProps('.re-window', props => props?.doc?.serialize);
      return doc.model.Nodes.filter(Boolean).map(node => ({ name: node.Name, flags: node.Flags, frames: Array.from(node.EventTrack || []) }));
    });
    await openManager();
    const before = await nodes();
    await manager.locator('[data-node-type="Bones"]').first().click();
    await newButton.click();
    assert.equal(await categories.isVisible(), true, 'New must show event categories before creating a node');
    assert.deepEqual(await nodes(), before);
    assert.equal(await manager.getByRole('button', { name: 'Clone', exact: true }).isDisabled(), true);
    assert.deepEqual(await categories.getByRole('button').allTextContents(), ['Sound', 'Blood Splat', 'Footprint', 'Uber Splat', 'Spawn Object']);
    await categories.getByRole('button', { name: 'Sound', exact: true }).click();
    await manager.getByRole('tree', { name: 'Sound categories' }).waitFor();
    await manager.getByLabel('Search sounds', { exact: true }).click();
    await page.keyboard.type('DFOO');
    await manager.locator('[data-sound-id="DFOO"]').click();
    await manager.getByLabel('Sound preview', { exact: true }).waitFor();
    assert.deepEqual(await nodes(), before, 'choosing a sound for preview does not create it');
    await addEvent.click();
    assert.deepEqual((await nodes()).at(-1), { name: 'SNDxDFOO', flags: 1024, frames: [0] });
    await manager.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    assert.deepEqual(await nodes(), before, 'one Undo removes the complete event');
    await newButton.click();
    for (const category of ['Blood Splat', 'Footprint', 'Uber Splat', 'Spawn Object']) {
      await categories.getByRole('button', { name: category, exact: true }).click();
      await manager.getByLabel(category, { exact: true }).locator('option:not([disabled])').first().waitFor({ state: 'attached' });
      assert.equal(await addEvent.isDisabled(), true, 'each category starts without a choice');
    }
    const spawns = manager.getByLabel('Spawn Object', { exact: true });
    await spawns.click();
    await page.keyboard.press('Home');
    const spawnId = await spawns.inputValue();
    assert.match(spawnId, /^[A-Za-z0-9]{4}$/);
    assert.deepEqual(await nodes(), before);
    await addEvent.click();
    const afterSpawn = await nodes();
    assert.equal(afterSpawn.at(-1).name, 'SPNx' + spawnId);
    await newButton.click();
    await categories.getByRole('button', { name: 'Blood Splat', exact: true }).click();
    await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(await nodes(), afterSpawn);
    await newButton.click();
    await manager.getByRole('button', { name: 'Light', exact: true }).click();
    const afterLight = await nodes();
    assert.equal(afterLight.length, afterSpawn.length + 1);
    assert.equal(afterLight.at(-1).flags, 512);

    await newButton.click();
    await manager.getByRole('button', { name: 'Emitters (EMTR)', exact: true }).click();
    const emtr = page.getByRole('dialog', { name: 'Particle Editor', exact: true });
    assert.equal(await emtr.getByRole('button', { name: 'Library', exact: true }).getAttribute('aria-pressed'), 'true');
    await emtr.getByRole('button', { name: 'Close Particle Editor', exact: true }).click();
    await openManager();
    assert.deepEqual(await nodes(), afterLight);

    await newButton.click();
    const opening = app.waitForEvent('window');
    await manager.getByRole('button', { name: 'Sphere (Sphereomancer)', exact: true }).click();
    const popup = await opening;
    await prepareWindow(app, popup, { errors });
    await popup.getByRole('heading', { name: 'Sphereomancer', exact: true }).waitFor();
    await popup.getByRole('button', { name: 'Add sphere', exact: true }).waitFor();
    const beforeStage = '[aria-label="Before preview"] .game-preview-root';
    const camera = selector => mdlxlProbe(selector).runtime?.controls?.object?.position.toArray();
    await popup.waitForFunction(camera, beforeStage);
    const initialCamera = await popup.evaluate(camera, beforeStage);
    const box = await popup.locator(beforeStage).boundingBox();
    await popup.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
    await popup.mouse.down();
    await popup.mouse.move(box.x + box.width / 3 + 50, box.y + box.height / 2 + 25, { steps: 8 });
    await popup.mouse.up();
    await popup.waitForFunction(({ selector, initial }) => {
      const position = mdlxlProbe(selector).runtime?.controls?.object?.position;
      return position && Math.hypot(position.x - initial[0], position.y - initial[1], position.z - initial[2]) > 1;
    }, { selector: beforeStage, initial: initialCamera });
    await popup.getByRole('button', { name: 'Close', exact: true }).click();
    await openManager();
    assert.deepEqual(await nodes(), afterLight, 'opening Sphereomancer leaves the model intact');
    await manager.getByRole('button', { name: 'Close Node Manager', exact: true }).click();
    const regularOpening = app.waitForEvent('window');
    await page.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();
    const regularPopup = await regularOpening;
    await prepareWindow(app, regularPopup, { errors });
    await regularPopup.getByRole('heading', { name: 'Insanity FIxer', exact: true }).waitFor();
    await regularPopup.getByRole('button', { name: 'Close', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log('PASS Node Manager categories, event creation and Undo, Light, EMTR Library and direct Sphereomancer with mouse orbit.');
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
