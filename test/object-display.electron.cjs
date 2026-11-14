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
      window.visibilityKeys = id => { const model = rigState().props.model, track = ['ParticleEmitters2', 'RibbonEmitters', 'Lights', 'Attachments'].flatMap(key => model[key] || []).find(node => node.ObjectId === id).Visibility; return track?.Keys ? track.Keys.map(key => [key.Frame, key.Vector[0]]) : track ?? null; };
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

    // Movement: the clicked object's diamonds on the keyframe track, EMTR's look and behaviour.
    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    await page.getByLabel('Movement controller', { exact: true }).waitFor(); await ready();
    const sequencePick = page.getByLabel('Movement current sequence', { exact: true });
    await sequencePick.selectOption('0'); await ready(); await idle();
    assert.deepEqual(await switches(), XL.movement, 'Movement switches');
    assert.match(await quick.getByLabel('F.Skeleton', { exact: true }).getAttribute('title'), /^Focused Skeleton(\n|$)/, 'F.Skeleton tooltip');
    const { emitterSpans } = await import('../src/emitter-timing.js');
    const reel = page.locator('.classic-reel-diamonds');
    const shown = () => reel.locator('.pe-key-diamond').evaluateAll(items => items.map(item => Number(item.getAttribute('aria-valuenow'))));
    const visibility = id => page.evaluate(id => visibilityKeys(id), id);
    const xOf = async frame => { const box = await reel.boundingBox(), [start, end] = await reel.locator('.pe-key-diamond').first().evaluate(item => [Number(item.getAttribute('aria-valuemin')), Number(item.getAttribute('aria-valuemax'))]); return box.x + (frame - start) / (end - start) * box.width; };
    const drag = async (handle, frame) => {
      const box = await handle.boundingBox(), y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width / 2, y); await page.mouse.down(); await page.mouse.move(await xOf(frame), y, { steps: 8 }); await page.mouse.up(); await idle();
    };
    const camera = await page.evaluate(() => cameraMatrix());
    const sameCamera = async what => assert.deepEqual(await page.evaluate(() => cameraMatrix()), camera, what + ': the camera did not move');

    // The owner's case: BlizParticle shockwaves in Attack Slam.
    const slam = String(saved.Sequences.findIndex(clip => clip.Name === 'Attack Slam'));
    await sequencePick.selectOption(slam); await ready(); await idle();
    await click(ids.particle);
    assert.equal(await picker().inputValue(), String(ids.particle), 'the emitter symbol was clicked');
    const slamSpans = emitterSpans(saved, ids.particle, Number(slam)).spans;
    assert.deepEqual(await shown(), slamSpans.flat(), 'the emitter\'s shows/hides diamonds are on the keyframe track');
    const showsDiamond = reel.locator('.pe-key-diamond.shows').first(), size = await showsDiamond.boundingBox(), reelBox = await page.locator('.classic-reel-track').boundingBox();
    assert.ok(size.width >= 10 && size.height >= 10 && size.y >= reelBox.y - 2 && size.y + size.height <= reelBox.y + reelBox.height / 2 + 4, 'diamonds are full size on the reel: ' + JSON.stringify(size));
    assert.equal(await reel.locator('.pe-key-span').count(), slamSpans.length, 'the blue bar between each pair');
    await page.locator('.classic-keyframe-reel').screenshot({ path: path.join(out, 'emitter-diamonds.png') });
    await sameCamera('clicking the emitter');
    const keysBefore = await visibility(ids.particle), target = slamSpans[0][0] - 120;
    await drag(showsDiamond, target);
    const moved = Number(await showsDiamond.getAttribute('aria-valuenow'));
    assert.ok(Math.abs(moved - target) <= 3, `dragged to ${moved}, wanted about ${target}`);
    assert.ok((await visibility(ids.particle)).some(([frame, value]) => frame === moved && value === 1), 'the Visibility key moved to the dropped frame');
    assert.ok(!(await visibility(ids.particle)).some(([frame, value]) => frame === slamSpans[0][0] && value === 1), 'no key left at the old frame');
    assert.equal(await picker().inputValue(), String(ids.particle), 'the emitter stays selected');
    await sameCamera('dragging a diamond');
    await page.keyboard.press('Control+z'); await idle();
    assert.deepEqual(await visibility(ids.particle), keysBefore, 'Ctrl+Z restores the Visibility keys');
    assert.deepEqual(await shown(), slamSpans.flat());
    await page.getByRole('button', { name: '+ ◆◆', exact: true }).click(); await idle();
    assert.equal((await shown()).length, slamSpans.flat().length + 2, '+ ◆◆ adds a pair');
    const added = (await shown()).find(frame => !slamSpans.flat().includes(frame));
    await reel.locator(`.pe-key-diamond[aria-valuenow="${added}"]`).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Remove this pair', exact: true }).click(); await idle();
    assert.deepEqual(await shown(), slamSpans.flat(), 'right-click, Remove this pair');
    await sameCamera('adding and removing a pair');
    checks.push('Movement: a clicked emitter shows EMTR\'s diamonds on the keyframe track; drag, Ctrl+Z, + ◆◆, Remove this pair');

    // A light in Walk.
    await sequencePick.selectOption('0'); await ready(); await idle();
    const lights = quick.getByLabel('Lights', { exact: true });
    await lights.check(); await idle();
    await click(ids.light);
    assert.equal(await picker().inputValue(), String(ids.light), 'Lights on: the light symbol can be clicked');
    assert.deepEqual(await shown(), emitterSpans(saved, ids.light, 0).spans.flat(), 'the light\'s shows/hides diamonds');
    assert.ok((await shown()).includes(700), 'the light comes on at 700');
    checks.push('Movement: a clicked light shows its diamonds');
    await lights.uncheck(); await idle();

    // Bones have none.
    await picker().selectOption(String(saved.Bones[0].ObjectId)); await idle();
    assert.equal(await reel.count(), 0, 'a bone shows no diamonds');

    // An event: one diamond per frame; drag, + ◆ at the playhead, right-click Remove, Ctrl+Z.
    await click(ids.footprint);
    assert.equal(await picker().inputValue(), String(ids.footprint), 'the event symbol was clicked');
    const original = await page.evaluate(id => eventFrames(id), ids.footprint), walk = original.filter(frame => frame >= 333 && frame <= 900);
    assert.deepEqual(await shown(), walk, 'event frames show as diamonds');
    await drag(reel.locator('.pe-key-diamond').first(), walk[0] + 50);
    const dropped = (await shown())[0];
    assert.ok(Math.abs(dropped - walk[0] - 50) <= 3, `event dragged to ${dropped}`);
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), original.map(frame => frame === walk[0] ? dropped : frame).sort((a, b) => a - b), 'the event frame moved');
    await page.keyboard.press('Control+z'); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), original, 'Ctrl+Z puts it back');
    const frameBox = page.getByLabel('Current animation frame', { exact: true });
    await frameBox.fill('450'); await frameBox.press('Enter'); await idle();
    await page.getByRole('button', { name: '+ ◆', exact: true }).click(); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), [...original, 450].sort((a, b) => a - b), '+ ◆ adds a frame at the playhead');
    assert.ok((await shown()).includes(450));
    await reel.locator('.pe-key-diamond[aria-valuenow="450"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Remove', exact: true }).click(); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), original, 'right-click, Remove');
    await page.keyboard.press('Control+z'); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), [...original, 450].sort((a, b) => a - b), 'Ctrl+Z brings the removed frame back');
    await page.keyboard.press('Control+z'); await idle();
    assert.deepEqual(await page.evaluate(id => eventFrames(id), ids.footprint), original, 'Ctrl+Z removes the added frame');
    await sameCamera('editing event diamonds');
    checks.push('Movement: a clicked event shows a diamond per frame; drag, + ◆, Remove, Ctrl+Z; camera unchanged');

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
