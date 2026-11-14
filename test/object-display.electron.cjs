// Objects: one set of switch names in every editor (docs/agent-tasks/node-display-plan.md).
// Real mouse on a real unit with a ribbon, particle emitters, events and collision; a light is added to its copy.
// Run against the rebuilt portable app with MDLXL_TEST_EXE; fixtures and profiles stay on D:.
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const KINDS = ['Bones', 'Attachments', 'Emitters', 'Events', 'Sounds', 'Lights', 'Collision'];
const VERTEX = ['Shadows', 'RGB', 'Vertices', 'Bones', 'Normals', 'Wireframe Overlay', 'Grid'];
const ANIMATIONS = ['Emitters', 'Events', 'Sounds', 'Wireframe', 'Grid'];

(async () => {
  const out = path.resolve(process.env.MDLXL_OBJECT_DISPLAY_OUT || 'out/object-display'), source = fixturePath('optimizexl-exact-unit');
  fs.mkdirSync(out, { recursive: true });
  const { openDocument, createNode } = await import('../src/editor-document.js');
  const doc = openDocument(fs.readFileSync(source), source), ids = {};
  doc.apply('Add test light', ['Nodes', 'PivotPoints'], model => {
    const light = createNode(model, 'Light'); light.Name = 'Test Lamp'; light.PivotPoint.set([0, 0, 320]); ids.light = light.ObjectId;
  });
  const fixture = path.join(out, 'TEST OBJECT DISPLAY 01.mdx');
  fs.writeFileSync(fixture, Buffer.from(doc.serialize('mdx')));
  for (const file of fs.readdirSync(path.dirname(source))) if (/\.(blp|tga|dds)$/i.test(file)) fs.copyFileSync(path.join(path.dirname(source), file), path.join(out, file));
  const saved = openDocument(fs.readFileSync(fixture), fixture).model;
  ids.light = saved.Lights.find(node => node.Name === 'Test Lamp').ObjectId;
  ids.ribbon = saved.RibbonEmitters[0].ObjectId; ids.particle = saved.ParticleEmitters2[0].ObjectId;
  const checks = [];
  let app, page, errors;
  try {
    ({ app, page, errors } = await launchApp({ out, fixture, timeout: 60000 }));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(1600, 1000); win.webContents.setBackgroundThrottling(false); });
    const idle = () => settlePage(page, 250);
    const quick = page.getByRole('group', { name: 'Quick display', exact: true });
    const switches = () => quick.locator('input[type=checkbox]').evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label')));
    const kindSwitches = async () => (await switches()).filter(label => KINDS.includes(label));
    const picker = () => page.getByLabel('Movement object', { exact: true });
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
      window.modelCounts = () => { const model = rigState().props.model; return { particles: model.ParticleEmitters2.map(node => node.ObjectId), nodes: model.Nodes.filter(Boolean).length }; };
    });
    const ready = () => page.waitForFunction(() => { try { return !!rigState().runtime.captureApi?.isReady; } catch { return false; } });
    const screen = id => page.evaluate(id => objectScreen(id), id);
    const click = async id => { const point = await screen(id); await page.mouse.click(point.x, point.y); await idle(); };
    const blank = async () => { const box = await page.locator('[data-clean-model-canvas]').boundingBox(); await page.mouse.click(box.x + 12, box.y + box.height - 12); await idle(); };
    const editor = page.getByRole('dialog', { name: 'Particle Editor', exact: true });
    const opensEditor = async (id, where) => {
      const before = await page.evaluate(() => cameraMatrix()), point = await screen(id);
      await page.mouse.dblclick(point.x, point.y);
      await editor.waitFor();
      assert.equal(await page.getByLabel('Effect ingredient', { exact: true }).inputValue(), String(id), where + ': EMTR opens on the double-clicked symbol');
      await page.getByRole('button', { name: 'Close Particle Editor', exact: true }).click(); await editor.waitFor({ state: 'hidden' }); await idle();
      assert.deepEqual(await page.evaluate(() => cameraMatrix()), before, where + ': the camera did not move');
      checks.push(where + ': double-click symbol opens EMTR, camera unchanged');
    };
    const lightSwitch = async where => {
      const lights = quick.getByLabel('Lights', { exact: true });
      await lights.uncheck(); await blank(); await click(ids.light);
      assert.notEqual(await picker().inputValue(), String(ids.light), where + ': a hidden light cannot be clicked');
      await lights.check(); await idle(); await click(ids.light);
      assert.equal(await picker().inputValue(), String(ids.light), where + ': Lights shows the light and it can be clicked');
      await lights.uncheck(); await blank();
      checks.push(where + ': Lights shows and hides the light');
    };

    // Vertex: the mesh and Bones, nothing else.
    assert.deepEqual(await switches(), VERTEX, 'Vertex switches');
    checks.push('Vertex has Bones as its only object switch');

    // Bones.
    await page.locator('[data-hotkey="bones"]').first().click();
    await page.getByLabel('Bones controller', { exact: true }).waitFor();
    await installProbe(); await ready();
    assert.deepEqual(await kindSwitches(), KINDS, 'Bones switch names and order');
    assert.equal((await switches()).includes('Nodes'), false, 'no Nodes switch');
    assert.equal(await page.locator('.movement-object-filters').getByLabel('Attachments', { exact: true }).count(), 1, 'the sidebar tick is called Attachments too');
    await page.getByLabel('View direction', { exact: true }).selectOption('front'); await idle();
    await lightSwitch('Bones');
    await quick.getByLabel('Emitters', { exact: true }).check(); await idle();
    await click(ids.ribbon);
    assert.equal(await picker().inputValue(), String(ids.ribbon), 'Bones: the ribbon symbol can be clicked');
    await opensEditor(ids.ribbon, 'Bones ribbon');

    // Movement.
    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    await page.getByLabel('Movement controller', { exact: true }).waitFor(); await ready();
    await page.getByLabel('Movement current sequence', { exact: true }).selectOption('0'); await ready(); await idle();
    assert.deepEqual(await kindSwitches(), KINDS, 'Movement switch names and order');
    assert.equal((await switches()).includes('Nodes'), false, 'no Nodes switch');
    await lightSwitch('Movement');
    await quick.getByLabel('Emitters', { exact: true }).check(); await idle();
    await click(ids.particle);
    assert.equal(await picker().inputValue(), String(ids.particle), 'Movement: the emitter symbol can be clicked');
    await opensEditor(ids.particle, 'Movement emitter');
    // An emitter offers Edit effect only; its visibility lives in EMTR.
    const strip = page.locator('.movement-emitter-controls');
    await click(ids.particle);
    assert.equal(await picker().inputValue(), String(ids.particle));
    assert.equal(await strip.getByRole('button', { name: 'Edit effect', exact: true }).count(), 1);
    assert.equal(await strip.getByRole('checkbox').count(), 0, 'no Visible tick for an emitter');
    // A light keeps the Visible tick and has no effect to edit.
    await picker().selectOption(String(ids.light)); await idle();
    assert.equal(await strip.getByRole('checkbox', { name: 'Object visible at current frame', exact: true }).count(), 1, 'a light keeps Visible');
    assert.equal(await strip.getByRole('button', { name: 'Edit effect', exact: true }).count(), 0);
    checks.push('Movement: emitter shows Edit effect only; light shows Visible');
    // Delete, with the same button as Bones, and Undo.
    await click(ids.particle);
    assert.equal(await picker().inputValue(), String(ids.particle));
    const before = await page.evaluate(() => modelCounts());
    await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Delete selected object', exact: true }).click(); await idle();
    const removed = await page.evaluate(() => modelCounts());
    assert.equal(removed.particles.length, before.particles.length - 1, 'Delete removed the emitter');
    assert.equal(removed.nodes, before.nodes - 1);
    await page.keyboard.press('Control+z'); await idle();
    assert.deepEqual(await page.evaluate(() => modelCounts()), before, 'Undo brings the emitter back');
    checks.push('Movement: Delete removes the selected object, Undo restores it');

    // Animations: a model preview with effect switches only.
    await page.getByRole('button', { name: 'Animations', exact: true }).click(); await ready(); await idle();
    assert.deepEqual(await switches(), ANIMATIONS, 'Animations switches');
    for (const name of ANIMATIONS.slice(0, 3)) await quick.getByLabel(name, { exact: true }).check();
    await idle();
    assert.equal(await page.locator('.game-preview-root [data-node-overlay]').count(), 0, 'Animations draws no symbols');
    assert.equal(await page.locator('.classic-sidebar summary').filter({ hasText: /^Nodes$/ }).count(), 0, 'the Nodes list is gone');
    assert.equal(await page.locator('.animation-node-list').count(), 0);
    checks.push('Animations: effect switches only, no symbols, no Nodes list');

    // ViS: the same words in the same order.
    await page.locator('.vis-toggle').click(); await page.locator('.classic-app[data-vis-ui]').waitFor(); await idle();
    assert.deepEqual(await switches(), ANIMATIONS, 'ViS Animations switches');
    // The ViS look has no editor buttons on the toolbar: the Modules menu switches editors.
    const modules = id => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);
    await modules('animation'); await page.getByLabel('Movement controller', { exact: true }).waitFor(); await ready(); await idle();
    assert.deepEqual(await kindSwitches(), KINDS, 'ViS Movement switch names and order');
    await lightSwitch('ViS Movement');
    await modules('bones'); await page.getByLabel('Bones controller', { exact: true }).waitFor(); await ready(); await idle();
    assert.deepEqual(await kindSwitches(), KINDS, 'ViS Bones switch names and order');
    await lightSwitch('ViS Bones');
    await modules('vertices'); await page.getByLabel('Bones controller', { exact: true }).waitFor({ state: 'hidden' }); await idle();
    assert.deepEqual((await switches()).filter(label => KINDS.includes(label)), ['Bones'], 'ViS Vertex shows bones only');
    checks.push('ViS: same switch names and order');

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ fixture, checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally { if (app) await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
