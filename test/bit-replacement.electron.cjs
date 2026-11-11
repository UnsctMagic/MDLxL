const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appTarget, launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const target = appTarget(), out = path.resolve('out/bit-replacement');
  assert.ok(target.packaged, 'test Bitz in the packaged app');
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument, validateModel } = await import('../src/editor-document.js');
  const { positionPart } = await import('../src/bits-and-parts.js');
  const bit = createStarterDocument();
  bit.apply('Test Bit', [], model => {
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Color: Float32Array.of(1, 0, 0), Alpha: 1 }];
  });
  const donorBytes = Buffer.from(bit.serialize('mdx'));
  const bank = path.join(path.dirname(target.executablePath), 'BitsAndParts');
  const bucket = fs.mkdtempSync(path.join(bank, 'Bitz test ')), bucketName = path.basename(bucket);
  fs.writeFileSync(path.join(bucket, 'Test Bit.mdx'), donorBytes);
  fs.writeFileSync(path.join(bucket, 'Notes.txt'), 'Bitz fixture');
  const errors = [];
  const { app, page } = await launchApp({ fixture: fixturePath('citadel-footman'), out, errors, pageTimeout: 30000 });
  const dialog = page.getByRole('dialog', { name: 'BitsAndParts', exact: true });
  const button = name => dialog.getByRole('button', { name, exact: true });
  const viewport = page.locator('.classic-view [aria-label="3D model viewport"]');
  const serialized = () => page.evaluate(() => Array.from(__mdlxl.document().serialize('mdx')));
  const replaceAction = page.getByRole('group', { name: 'Replace Part', exact: true });
  const sameColor = (actual, expected) => expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) < .00001));
  const editChannel = async (channel, value) => {
    await page.getByRole('spinbutton', { name: 'Bit ' + channel, exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(String(value));
  };
  try {
    await page.waitForFunction(() => window.__mdlxl?.model()?.Geosets[0]?.Vertices.length > 24);
    await viewport.waitFor();
    const before = await serialized(), original = openDocument(Uint8Array.from(before));
    const incomingIndex = original.model.Geosets.length - 1;
    const selected = Array.from({ length: original.model.Geosets[0].Vertices.length / 3 }, (_, i) => i);
    const centered = Array.from(positionPart(bit.model, original.model, { 0: selected }).Geosets[0].Vertices);
    const file = path.join(bucket, 'Weapons', 'Renamed Bit.mdx');
    await page.locator('[data-hotkey="bitsAndParts"]').click();
    assert.equal(await button('Replace Part').isDisabled(), true);
    assert.equal(await button('Manage').count(), 1, 'Bitz exposes in-app library management');
    await button('Manage').click();
    await button(bucketName).click();
    await button('New folder').click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).click();
    await page.keyboard.type('Weapons');
    await button('Create folder').click();
    await page.getByText('Weapons', { exact: true }).waitFor();

    await button('Test Bit.mdx').click();
    await button('Rename').click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Renamed Bit.mdx');
    await button('Save name').click();
    await button('Renamed Bit.mdx').click();
    await button('Move').click();
    const folder = page.getByRole('combobox', { name: 'Folder', exact: true });
    await button('Cancel').click();
    // A new folder inside the selected file's parent can also be picked by keyboard.
    await button('Move').click();
    const destinationIndex = (await folder.locator('option').allTextContents()).indexOf(bucketName + '/Weapons');
    assert.ok(destinationIndex > 0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Home');
    for (let i = 0; i < destinationIndex; i++) await page.keyboard.press('ArrowDown');
    assert.equal(await folder.inputValue(), bucketName + '/Weapons');
    await button('Move here').click();
    await page.waitForFunction(() => !document.querySelector('.parts-manage-form'));
    assert.deepEqual(fs.readFileSync(file), donorBytes);

    // Substitute the OS recycle-bin destination so test artifacts stay in the test folder.
    const trash = path.join(out, 'trashed-notes.txt');
    await app.evaluate(({ shell }, destination) => { shell.trashItem = async source => process.getBuiltinModule('node:fs').renameSync(source, destination); }, trash);
    await button('Notes.txt').click();
    await button('Delete').click();
    await button('Move to Recycle Bin').click();
    await page.waitForFunction(() => ![...document.querySelectorAll('.parts-body li button')].some(button => button.textContent === 'Notes.txt') || !!document.querySelector('.parts-error'));
    assert.equal(await dialog.getByRole('alert').count(), 0, (await dialog.getByRole('alert').allTextContents()).join('\n'));
    assert.equal(fs.readFileSync(trash, 'utf8'), 'Bitz fixture');
    await button('Done').click();
    await button('Close BitsAndParts').click();

    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).click();
    await viewport.click();
    await page.keyboard.press('Control+a');
    await page.waitForFunction(count => __mdlxl.selection().selection[0]?.length === count, selected.length);
    const tabs = page.locator('.classic-status .model-tabs');
    const dock = page.locator('.classic-toolbar > .toolbar-modules');
    const begin = async (chooseFirst = false) => {
      await tabs.waitFor();
      assert.equal(await dock.evaluate(element => element.inert), false);
      await page.locator('[data-hotkey="bitsAndParts"]').click();
      if (!chooseFirst) await button('Replace Part').click();
      await button('Renamed Bit.mdx').click();
      if (chooseFirst) {
        await dialog.getByRole('spinbutton', { name: 'Bit G', exact: true }).waitFor();
        await button('Replace Part').click();
      }
      await dialog.waitFor({ state: 'detached', timeout: 15000 });
      await replaceAction.getByRole('button', { name: 'Commit' }).waitFor();
      assert.equal(await dock.evaluate(element => element.inert), true);
      assert.equal(await tabs.getByRole('tab', { name: 'Footman.mdx', exact: true }).count(), 1, 'the original tab remains reachable for the close prompt');
      const controls = await replaceAction.boundingBox();
      const front = await page.locator('[data-viewport="front"]').boundingBox();
      const top = await page.locator('[data-viewport="top"]').boundingBox();
      const gap = front.y + front.height - (controls.y + controls.height);
      assert.ok(Math.abs(controls.x + controls.width / 2 - top.x) <= 2 && gap >= 3 && gap <= 10,
        'replacement controls are centered just above the Quad View divider');
      await editChannel('G', 128);
      await page.keyboard.press('Enter');
      await page.waitForFunction(index => {
        const host = document.querySelector('.classic-view [aria-label="3D model viewport"]');
        const state = host && findFiberState(host, r => r?.renderer && r?.entries);
        const tint = state?.entries[index]?.meshes[0]?.material.userData.geosetTint?.value.toArray();
        return tint?.[0] === 1 && Math.abs(tint[1] - 128 / 255) < .00001 && tint[2] === 0;
      }, incomingIndex);
      assert.equal(await page.locator('[data-viewport="perspective"]').count(), 1);
      assert.equal(await page.locator('[data-hotkey="translate"]').getAttribute('aria-pressed'), 'true');
      await page.waitForFunction(index => __mdlxl.selection().selection[index]?.length === 8, incomingIndex);
    };
    const vertices = () => page.evaluate(index => Array.from(__mdlxl.model().Geosets[index].Vertices), incomingIndex);
    const viewportRuntime = () => page.evaluate(() => {
      const state = findFiberState(document.querySelector('.classic-view [aria-label="3D model viewport"]'), r => r?.renderer && r?.entries);
      return state && {
        pane: state.controls.domElement.dataset.viewport,
        position: state.camera.position.toArray(), rotation: state.camera.quaternion.toArray(),
        target: state.controls.target.toArray(), zoom: state.camera.zoom,
      };
    });
    const assertCamera = async saved => {
      const current = await viewportRuntime();
      assert.equal(current.pane, saved.pane);
      for (const key of ['position', 'rotation', 'target']) {
        assert.ok(current[key].every((value, i) => Math.abs(value - saved[key][i]) < .000001), 'Commit restores the previous camera ' + key);
      }
      assert.equal(current.zoom, saved.zoom);
    };
    const quadButton = page.getByRole('button', { name: 'Quad View', exact: true });
    const drag = async (id, dx, dy) => {
      const pane = id === 'single' ? viewport : page.locator('[data-viewport="' + id + '"]'), box = await pane.boundingBox();
      const x = Math.round(box.x + box.width * .18), y = Math.round(box.y + box.height * .25);
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 6 });
      if (id === 'front') {
        await page.waitForFunction(([x, y]) => {
          const state = findFiberState(document.querySelector('.classic-view [aria-label="3D model viewport"]'), r => r?.renderer && r?.entries);
          return state?.drag?.lastMove?.clientX === x && state.drag.lastMove.clientY === y;
        }, [x + dx, y + dy]);
      }
      await page.mouse.up();
    };
    await begin();
    assert.deepEqual(await vertices(), centered);
    sameColor(await page.evaluate(index => Array.from(__mdlxl.model().GeosetAnims.find(anim => anim.GeosetId === index).Color), incomingIndex), [1, 128 / 255, 0]);
    await page.locator('[data-viewport="perspective"]').click({ position: { x: 24, y: 45 } });
    const cameraBefore = (await viewportRuntime()).position;
    await page.keyboard.down('Alt');
    await drag('perspective', 65, 20);
    await page.keyboard.up('Alt');
    await page.waitForFunction(old => {
      const state = findFiberState(document.querySelector('.classic-view [aria-label="3D model viewport"]'), r => r?.renderer && r?.entries);
      return state?.controls.domElement.dataset.viewport === 'perspective' &&
        state.camera.position.toArray().some((value, i) => Math.abs(value - old[i]) > .001);
    }, cameraBefore);
    assert.deepEqual(await vertices(), centered);
    await drag('front', 26, 14);
    await page.waitForFunction(([index, before]) => __mdlxl.model().Geosets[index].Vertices.some((value, i) => Math.abs(value - before[i]) > .001), [incomingIndex, centered]);
    await replaceAction.getByRole('button', { name: 'Cancel' }).click();
    assert.deepEqual(await serialized(), before);
    assert.equal(await quadButton.getAttribute('aria-pressed'), 'false');

    await viewport.click();
    await page.keyboard.press('Control+a');
    await page.waitForFunction(count => __mdlxl.selection().selection[0]?.length === count, selected.length);
    await page.keyboard.press('5');
    await page.keyboard.press('s');
    await page.keyboard.press('r');
    await page.keyboard.down('Alt');
    await drag('single', 45, 18);
    await page.keyboard.up('Alt');
    const beforeSingle = await viewportRuntime();
    assert.equal(await page.getByLabel('View direction').inputValue(), 'perspective');
    assert.equal(await page.getByLabel('Render mode').inputValue(), 'solid');

    await begin(true);
    await drag('front', 40, 14);
    await page.waitForFunction(([index, before]) => __mdlxl.model().Geosets[index].Vertices.some((value, i) => Math.abs(value - before[i]) > .001), [incomingIndex, centered]);
    const moved = await vertices();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(([index, before]) => __mdlxl.model().Geosets[index].Vertices.every((value, i) => value === before[i]), [incomingIndex, centered]);
    await page.keyboard.press('Control+y');
    assert.deepEqual(await vertices(), moved);
    await replaceAction.getByRole('button', { name: 'Commit' }).click();
    await replaceAction.waitFor({ state: 'detached' });
    assert.equal(await quadButton.getAttribute('aria-pressed'), 'false', 'Commit returns to the previous single view');
    assert.equal(await page.getByLabel('View direction').inputValue(), 'perspective');
    assert.equal(await page.getByLabel('Render mode').inputValue(), 'solid');
    assert.equal(await page.locator('[data-hotkey="rotate"]').getAttribute('aria-pressed'), 'true');
    await assertCamera(beforeSingle);
    const committed = await serialized(), reopened = openDocument(Uint8Array.from(committed));
    assert.deepEqual(Array.from(reopened.model.Geosets[incomingIndex].Vertices), moved);
    assert.equal(reopened.model.Geosets.length, original.model.Geosets.length);
    assert.equal(reopened.model.Bones.length, original.model.Bones.length);
    sameColor(Array.from(reopened.model.GeosetAnims.find(anim => anim.GeosetId === incomingIndex).Color), [1, 128 / 255, 0]);
    assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []);
    await page.keyboard.press('Control+z');
    assert.deepEqual(await serialized(), before);
    await page.keyboard.press('Control+y');
    assert.deepEqual(await serialized(), committed);

    await quadButton.click();
    await page.locator('[data-viewport="perspective"]').click({ position: { x: 24, y: 45 } });
    await page.keyboard.down('Alt');
    await drag('perspective', 37, 12);
    await page.keyboard.up('Alt');
    const beforeQuad = await viewportRuntime();
    await begin();
    await page.keyboard.down('Alt');
    await drag('perspective', 55, 20);
    await page.keyboard.up('Alt');
    await page.locator('[data-viewport="top"]').click({ position: { x: 24, y: 45 } });
    await replaceAction.getByRole('button', { name: 'Commit' }).click();
    await replaceAction.waitFor({ state: 'detached' });
    assert.equal(await quadButton.getAttribute('aria-pressed'), 'true');
    await assertCamera(beforeQuad);

    await page.locator('[data-hotkey="bitsAndParts"]').click();
    await button('Renamed Bit.mdx').click();
    await editChannel('B', 64);
    await button('Import whole part').click();
    await dialog.waitFor({ state: 'detached' });
    await tabs.waitFor();
    assert.equal(await dock.evaluate(element => element.inert), false);
    const whole = openDocument(Uint8Array.from(await serialized()));
    assert.equal(whole.model.Geosets.length, reopened.model.Geosets.length + 1);
    sameColor(Array.from(whole.model.GeosetAnims.at(-1).Color), [1, 0, 64 / 255]);
    assert.deepEqual(fs.readFileSync(file), donorBytes);
    assert.deepEqual(errors, []);
    console.log('PASS Bitz: folder creation, rename, move, delete, numeric RGB, Quad camera and Move drags, draft undo/redo, cancel, one-step commit undo/redo, whole import');
  } finally {
    await closeApp(app);
    for (const entry of fs.readdirSync(bucket, { recursive: true, withFileTypes: true }).reverse()) {
      const target = path.join(entry.parentPath, entry.name);
      if (entry.isDirectory()) fs.rmdirSync(target); else fs.unlinkSync(target);
    }
    fs.rmdirSync(bucket);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
