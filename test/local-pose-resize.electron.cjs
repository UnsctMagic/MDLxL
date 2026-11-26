const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appTarget, launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const { ObjectLoader } = await import('three');
  const { allNodes } = await import('../src/animation.js');
  const { movementAxisHandles } = await import('../app/movement-overlay.js');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const out = path.resolve('out/local-pose-resize');
  fs.mkdirSync(out, { recursive: true });
  assert.ok(appTarget().packaged, 'Exercise the packaged POSE viewport');
  const { app, page, errors } = await launchApp({
    fixture: fixturePath('footman'), out, show: 'hide',
    bounds: { x: 0, y: 0, width: 1440, height: 980 },
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
    settings: { preferences: { language: 'en', graphics: { pauseWhenHidden: false } } },
  });
  page.on('crash', () => errors.push('Renderer crashed'));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    const chestId = 33;
    const tools = page.getByRole('group', { name: 'Movement tool', exact: true });
    const select = name => tools.getByRole('button', { name, exact: true }).click();
    const local = page.getByRole('checkbox', { name: 'Local axes', exact: true });
    const canvas = page.locator('[data-clean-model-canvas]');
    const snapshot = () => page.evaluate(id => {
      const { runtime, props, session } = mdlxlProbe(), canvas = document.querySelector('[data-clean-model-canvas]');
      const model = JSON.parse(JSON.stringify(session.doc.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value));
      return {
        model, config: props.poseConfig, frame: Math.round(runtime.native.getFrame()),
        sequence: props.sequenceIndex, camera: runtime.controls.object.toJSON(),
        width: canvas.clientWidth, height: canvas.clientHeight, revision: session.doc.revision,
        radius: runtime.captureApi.showcaseView().radius, appearance: props.preferences.viewportAppearance.controllers,
        matrix: Array.from(runtime.native.rendererData.nodes[id].matrix),
      };
    }, chestId);
    const geometry = state => {
      const camera = new ObjectLoader().parse(state.camera);
      camera.updateMatrixWorld(true);
      const handles = projectPoseHandles(state.model, state.config, state.frame, state.sequence, camera, state.width, state.height);
      const chest = handles.find(handle => handle.visible && handle.kind === 'node' && handle.id === chestId && !handle.marker);
      assert.ok(chest, 'Footman shows the mapped POSE chest');
      return { camera, chest };
    };
    await page.locator('[data-hotkey="animation"]:visible').first().click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.getByRole('button', { name: 'POSE', exact: true }).click();
    await select('Select');
    await page.waitForFunction(() => {
      const { runtime, props } = mdlxlProbe();
      return runtime?.captureApi?.isReady && props?.poseConfig?.enabled &&
        Math.round(runtime.native.getFrame()) === Math.round(props.time);
    });
    const target = () => page.evaluate(() => mdlxlProbe().props.poseConfig.target);
    const { chest } = geometry(await snapshot()), box = await canvas.boundingBox();
    for (let attempt = 0; attempt < 15; attempt++) {
      const old = await target();
      if (old?.kind === 'node' && old.id === chestId && !old.marker) break;
      await page.mouse.click(box.x + chest.x, box.y + chest.y);
      await page.waitForFunction(old => JSON.stringify(mdlxlProbe().props.poseConfig.target) !== old, JSON.stringify(old));
    }
    await select('Scale');
    const workplane = page.getByRole('checkbox', { name: 'Workplane Constraints', exact: true });
    if (await workplane.isChecked()) await workplane.click();

    const drag = async enabled => {
      if (await local.isChecked() !== enabled) await local.click();
      const before = await snapshot(), { camera, chest } = geometry(before);
      assert.ok(chest.selected, 'The chest is still the active POSE target');
      const handle = movementAxisHandles(chest, camera, before.width, before.height, before.radius, 'world', 'scale', before.appearance)
        .find(handle => handle.axis === 'X');
      const start = { x: box.x + handle.x, y: box.y + handle.y }, length = Math.hypot(handle.dx, handle.dy);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      try {
        await page.mouse.move(start.x + handle.dx / length * 35, start.y + handle.dy / length * 35, { steps: 8 });
        await page.waitForFunction(({ id, previous }) =>
          mdlxlProbe().runtime.native.rendererData.nodes[id].matrix.some((value, i) => Math.abs(value - previous[i]) > .01),
        { id: chestId, previous: before.matrix });
      } finally {
        await page.mouse.up();
      }
      await page.waitForFunction(revision => mdlxlProbe().session.doc.revision !== revision, before.revision);
      const after = await snapshot();
      const scaling = allNodes(after.model).find(node => node.ObjectId === chestId)?.Scaling;
      assert.ok(scaling?.Keys.some(key => key.Frame === before.frame && key.Vector.some(value => Math.abs(1 - value) > .05)),
        'The drag authors a nonidentity scale at the playhead');
      await page.keyboard.press('Control+z');
      await page.waitForFunction(revision => mdlxlProbe().session.doc.revision !== revision, after.revision);
      assert.deepEqual((await snapshot()).model, before.model, 'Undo restores the entire drag before the next one');
      return scaling;
    };
    const world = await drag(false);
    const localScale = await drag(true);
    assert.deepEqual(localScale, world, 'Local must not change the scale keys from an identical POSE drag');
    assert.deepEqual(errors, []);
    console.log('PASS Local leaves POSE Resize on model axes');
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
