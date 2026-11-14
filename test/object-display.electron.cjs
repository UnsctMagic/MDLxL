// Objects display, MDLxL look (owner's revised spec, docs/agent-tasks/node-display-plan.md).
// Real mouse on a real unit with a ribbon, particle emitters and events; a keyed light is added to its copy.
// Run against the rebuilt portable app with MDLXL_TEST_EXE; fixtures and profiles stay on D:.
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XL_MENU = require('../src/view-menu-xl.json');
const VIS_MENU = require('../src/view-menu.json');

// The quick row shows every View row except Clear (its own button) and Axis guides (View menu only).
const quickRows = menu => Object.fromEntries(Object.entries(menu).map(([mode, rows]) => [mode, rows.filter(([, id]) => id !== 'clearDisplay' && id !== 'axes').map(([label]) => label)]));
const XL = quickRows(XL_MENU), VIS = quickRows(VIS_MENU);

(async () => {
  const out = path.resolve(process.env.MDLXL_OBJECT_DISPLAY_OUT || 'out/object-display'), source = fixturePath('optimizexl-exact-unit');
  fs.mkdirSync(out, { recursive: true });
  const { openDocument, createNode } = await import('../src/editor-document.js');
  const doc = openDocument(fs.readFileSync(source), source);
  doc.apply('Add a test light', ['Nodes', 'PivotPoints'], model => {
    const light = createNode(model, 'Light'); light.Name = 'Test Lamp'; light.PivotPoint.set([0, 0, 320]);
    // Off at 400 and on again at 700, inside Walk (333-900).
    light.Visibility = { LineType: 0, Keys: [{ Frame: 400, Vector: new Float32Array([0]) }, { Frame: 700, Vector: new Float32Array([1]) }] };
  });
  const fixture = path.join(out, 'TEST OBJECT DISPLAY 02.mdx');
  fs.writeFileSync(fixture, Buffer.from(doc.serialize('mdx')));
  for (const file of fs.readdirSync(path.dirname(source))) if (/\.(blp|tga|dds)$/i.test(file)) fs.copyFileSync(path.join(path.dirname(source), file), path.join(out, file));
  const saved = openDocument(fs.readFileSync(fixture), fixture).model;
  const ids = { light: saved.Lights.find(node => node.Name === 'Test Lamp').ObjectId, ribbon: saved.RibbonEmitters[0].ObjectId, particle: saved.ParticleEmitters2[0].ObjectId,
    footprint: saved.EventObjects.find(node => node.Name.startsWith('FPT') && Array.from(node.EventTrack).some(frame => frame >= 333 && frame <= 900)).ObjectId };
  const checks = [];
  let app, page, errors;
  try {
    ({ app, page, errors } = await launchApp({ out, fixture, timeout: 60000 }));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(1600, 1000); win.webContents.setBackgroundThrottling(false); });
    const idle = () => settlePage(page, 250);
    const quick = page.getByRole('group', { name: 'Quick display', exact: true });
    const switches = () => quick.locator('input[type=checkbox]').evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label')));
    const picker = () => page.getByLabel('Movement bone or node', { exact: true });
    const installProbe = () => page.evaluate(() => {
      window.rigState = () => {
        const host = document.querySelector('.game-preview-root'); let runtime, props;
        { const v = findFiberState(host, v => v?.native && v?.controls, { last: true }); if (v?.native && v?.controls) runtime = v; }
        { const v = findFiberState(host, v => v?.model && v?.overlays && 'onParticlePick' in v, { last: true }); if (v?.model && v?.overlays) props = v; }
        if (!runtime || !props) throw Error('Preview not ready'); return { runtime, props };
      };
      window.objectScreen = id => {
        const { runtime } = rigState(), camera = runtime.controls.object, node = runtime.native.rendererData.nodes.find(item => item?.node.ObjectId === id), m = node.matrix, [x, y, z] = node.node.PivotPoint;
        const point = camera.position.clone().fromArray([0, 1, 2].map(i => m[i] * x + m[4 + i] * y + m[8 + i] * z + m[12 + i])).project(camera), box = document.querySelector('[data-clean-model-canvas]').getBoundingClientRect();
        return { x: box.x + (point.x + 1) * box.width / 2, y: box.y + (1 - point.y) * box.height / 2 };
      };
      window.cameraMatrix = () => rigState().runtime.controls.object.matrixWorld.toArray().map(value => Math.round(value * 1e4) / 1e4);
      window.eventFrames = id => Array.from(rigState().props.model.EventObjects.find(node => node.ObjectId === id).EventTrack || []);
    });
    const ready = () => page.waitForFunction(() => { try { return !!rigState().runtime.captureApi?.isReady; } catch { return false; } });
    const screen = id => page.evaluate(id => objectScreen(id), id);
    const click = async id => { const point = await screen(id); await page.mouse.click(point.x, point.y); await idle(); };
    const editor = page.getByRole('dialog', { name: 'Particle Editor', exact: true });
    const modules = id => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);

    // Vertices (the editor the model opens in).
    assert.deepEqual(await switches(), XL.vertices, 'Vertex switches');
    assert.equal(await quick.getByLabel('Objects', { exact: true }).isChecked(), false, 'Vertex starts with Objects off');
    checks.push('Vertices: owner\'s switch row, Objects off');

    // Bones: the row and the right-click Objects menu.
    await page.locator('[data-hotkey="bones"]').first().click();
    await page.getByLabel('Bones controller', { exact: true }).waitFor();
    await installProbe(); await ready();
    assert.deepEqual(await switches(), XL.bones, 'Bones switches');
    await quick.locator('label').filter({ has: page.getByLabel('Objects', { exact: true }) }).click({ button: 'right' });
    const typesMenu = page.getByRole('menu', { name: 'Object types', exact: true });
    await typesMenu.waitFor();
    const types = () => typesMenu.getByRole('menuitemcheckbox').evaluateAll(items => items.map(item => [item.textContent.replace('✓', ''), item.getAttribute('aria-checked')]));
    assert.deepEqual(await types(), [['Attachments', 'true'], ['Emitters', 'true'], ['Events', 'true'], ['Sounds', 'true']], 'Objects menu: every type ticked');
    await typesMenu.getByRole('menuitemcheckbox', { name: 'Sounds' }).click(); await idle();
    assert.deepEqual((await types()).map(([, checked]) => checked), ['true', 'true', 'true', 'false'], 'unticking Sounds');
    assert.equal(await page.evaluate(() => rigState().props.overlays.objectTypesSounds), false);
    await typesMenu.getByRole('menuitemcheckbox', { name: 'Sounds' }).click(); await idle();
    await page.keyboard.press('Escape'); await typesMenu.waitFor({ state: 'hidden' });
    checks.push('Bones: owner\'s switch row; right-click Objects ticks Attachments, Emitters, Events, Sounds');
    await page.getByLabel('View direction', { exact: true }).selectOption('front'); await idle();
    // Double-click a ribbon symbol: EMTR opens on it and the camera stays put.
    const before = await page.evaluate(() => cameraMatrix()), point = await screen(ids.ribbon);
    await page.mouse.dblclick(point.x, point.y);
    await editor.waitFor();
    assert.equal(await page.getByLabel('Effect ingredient', { exact: true }).inputValue(), String(ids.ribbon), 'EMTR opens on the double-clicked ribbon');
    await page.getByRole('button', { name: 'Close Particle Editor', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await idle();
    assert.deepEqual(await page.evaluate(() => cameraMatrix()), before, 'the camera did not move');
    checks.push('Bones: double-click a ribbon symbol opens EMTR, camera unchanged');

    // Movement: row, a light's diamonds, an event's diamonds (Add key, Delete, Undo).
    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    await page.getByLabel('Movement controller', { exact: true }).waitFor(); await ready();
    await page.getByLabel('Movement current sequence', { exact: true }).selectOption('0'); await ready(); await idle();
    assert.deepEqual(await switches(), XL.movement, 'Movement switches');
    assert.match(await quick.getByLabel('F.Skeleton', { exact: true }).getAttribute('title'), /^Focused Skeleton(\n|$)/, 'F.Skeleton tooltip');
    const lights = quick.getByLabel('Lights', { exact: true });
    await lights.check(); await idle();
    await click(ids.light);
    assert.equal(await picker().inputValue(), String(ids.light), 'Lights on: the light symbol can be clicked');
    const diamond = frame => page.locator(`.classic-reel-key[data-frame="${frame}"]`);
    assert.equal(await diamond(400).count(), 1, 'the light\'s off key shows as a diamond');
    assert.equal(await diamond(700).count(), 1, 'the light\'s on key shows as a diamond');
    checks.push('Movement: a clicked light shows its Visibility diamonds');

    await picker().selectOption(String(ids.footprint)); await idle();
    const original = await page.evaluate(id => eventFrames(id), ids.footprint);
    for (const frame of original.filter(frame => frame >= 333 && frame <= 900)) assert.equal(await diamond(frame).count(), 1, 'event frame ' + frame + ' shows as a diamond');
    const frameBox = page.getByLabel('Current animation frame', { exact: true });
    await frameBox.fill('450'); await frameBox.press('Enter'); await idle();
    const menuAt = async () => { await page.locator('.classic-reel-speed > span').first().click({ button: 'right' }); await page.locator('.classic-reel-menu').waitFor(); };
    await menuAt();
    await page.getByRole('menuitem', { name: 'Add key at 450', exact: true }).click(); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), [...original, 450].sort((a, b) => a - b), 'Add key adds the event frame');
    assert.equal(await diamond(450).count(), 1, 'the new event frame shows as a diamond');
    await menuAt();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click(); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), original, 'Delete removes the event frame at the playhead');
    assert.equal(await diamond(450).count(), 0);
    await page.keyboard.press('Control+z'); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), [...original, 450].sort((a, b) => a - b), 'Undo brings the deleted frame back');
    await page.keyboard.press('Control+z'); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), original, 'Undo removes the added frame');
    checks.push('Movement: event diamonds; Add key at N, Delete, Undo twice');
    await lights.uncheck(); await idle();

    // Animations: the owner's row and no symbols.
    await page.getByRole('button', { name: 'Animations', exact: true }).click(); await ready(); await idle();
    assert.deepEqual(await switches(), XL.animations, 'Animations switches');
    assert.equal(await page.evaluate(() => { const canvas = document.querySelector('.game-preview-root [data-node-overlay]'); return !canvas || !canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value); }), true, 'Animations draws no symbols');
    checks.push('Animations: owner\'s switch row, no symbols');

    // VIS: every row is main's.
    await page.locator('.vis-toggle').click(); await page.locator('.classic-app[data-vis-ui]').waitFor(); await idle();
    assert.deepEqual(await switches(), VIS.animations, 'VIS Animations');
    await modules('animation'); await page.getByLabel('Movement controller', { exact: true }).waitFor(); await ready(); await idle();
    assert.deepEqual(await switches(), VIS.movement, 'VIS Movement');
    await modules('bones'); await page.getByLabel('Bones controller', { exact: true }).waitFor(); await ready(); await idle();
    assert.deepEqual(await switches(), VIS.bones, 'VIS Bones');
    await modules('vertices'); await page.getByLabel('Bones controller', { exact: true }).waitFor({ state: 'hidden' }); await idle();
    assert.deepEqual(await switches(), VIS.vertices, 'VIS Vertices');
    checks.push('VIS: every editor\'s row is main\'s');

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ fixture, checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally { if (app) await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
