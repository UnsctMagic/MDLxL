const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { appTarget, launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const { Quaternion, Vector3 } = await import('three');
  const { sampleNodeProperty } = await import('../src/animation.js');
  const out = path.resolve('out/local-workplane-rotation');
  fs.mkdirSync(out, { recursive: true });
  assert.ok(appTarget().packaged, 'Exercise the packaged Movement viewport');
  const { app, page, errors } = await launchApp({
    fixture: fixturePath('glow-dual-weapon'), out, show: 'hide',
    bounds: { x: 0, y: 0, width: 1440, height: 980 },
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
    settings: { preferences: { language: 'en', graphics: { pauseWhenHidden: false } } },
  });
  page.on('crash', () => errors.push('Renderer crashed'));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.locator('[data-hotkey="animation"]:visible').first().click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.getByLabel('Movement bone or node').selectOption('8'); // Bone_Arm2_R
    await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Rotate', exact: true }).click();
    const workplane = page.getByRole('checkbox', { name: 'Workplane Constraints', exact: true });
    if (!await workplane.isChecked()) await workplane.click();
    await page.getByRole('radio', { name: 'XY', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Local axes', exact: true }).click();
    await page.waitForFunction(() => {
      const { runtime, props } = mdlxlProbe();
      return runtime?.captureApi?.isReady && props?.transformSpace === 'local' &&
        props.selectedNodeIds.at(-1) === 8 && Math.round(runtime.native.getFrame()) === Math.round(props.time);
    });
    const before = await page.evaluate(() => {
      const { runtime, props, session } = mdlxlProbe();
      const pose = runtime.native.rendererData.nodes[8].matrix;
      const canvas = document.querySelector('[data-clean-model-canvas]');
      return {
        camera: runtime.controls.object.toJSON(), frame: Math.round(runtime.native.getFrame()),
        sequence: props.sequenceIndex, model: JSON.parse(JSON.stringify(session.doc.model, (_key, value) =>
          ArrayBuffer.isView(value) ? Array.from(value) : value)), matrix: Array.from(pose),
        width: canvas.clientWidth, height: canvas.clientHeight, revision: session.doc.revision,
      };
    });
    const node = before.model.Bones.find(bone => bone.ObjectId === 8);
    const original = new Quaternion().fromArray(sampleNodeProperty(before.model, node, 'Rotation', before.frame, before.sequence)).normalize();
    assert.ok(original.angleTo(new Quaternion()) > .4, 'Use an arm with a nonidentity starting rotation');
    const { Matrix4, ObjectLoader } = await import('three');
    const camera = new ObjectLoader().parse(before.camera);
    camera.updateMatrixWorld(true);
    const pivot = new Vector3().fromArray(before.model.PivotPoints[8]).applyMatrix4(new Matrix4().fromArray(before.matrix)).project(camera);
    const canvas = await page.locator('[data-clean-model-canvas]').boundingBox();
    const x = Math.round(canvas.x + (pivot.x + 1) * before.width / 2 + 116);
    const y = Math.round(canvas.y + (1 - pivot.y) * before.height / 2 - 85);
    assert.ok(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('[data-clean-model-canvas]'), [x, y]), 'Start on the model canvas');
    const overlay = page.locator('[data-node-overlay]');
    await page.mouse.move(x, y);
    await page.mouse.down();
    let degrees;
    try {
      await page.waitForFunction(() => document.querySelector('[data-node-overlay]')?.dataset.rotationDirection);
      const [dx, dy] = (await overlay.getAttribute('data-rotation-direction')).split(',').map(Number);
      await page.mouse.move(x + dx * 39, y + dy * 39, { steps: 9 });
      await page.waitForFunction(() => {
        const feedback = document.querySelector('[data-node-overlay]')?.dataset.rotationFeedback || '';
        return feedback.startsWith('Z ') && Math.abs(Number(feedback.slice(2)) - 39) < .1;
      });
      degrees = Number((await overlay.getAttribute('data-rotation-feedback')).slice(2));
    } finally {
      await page.mouse.up();
    }
    await page.waitForFunction(revision => mdlxlProbe().session.doc.revision !== revision, before.revision);
    const vector = await page.evaluate(frame => {
      const bone = mdlxlProbe().session.doc.model.Bones.find(node => node.ObjectId === 8);
      const key = bone.Rotation.Keys.find(key => key.Frame === frame);
      return key && Array.from(key.Vector);
    }, before.frame);
    assert.ok(vector, 'The drag writes a rotation key at the current frame');
    const actual = new Quaternion().fromArray(vector).normalize();
    const delta = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), degrees * Math.PI / 180);
    const wanted = original.multiply(delta);
    const error = actual.angleTo(wanted) * 180 / Math.PI;
    assert.ok(error < .12, 'A Local XY drag must turn the arm about its own Z. Key differs by ' + error + ' degrees.');
    assert.deepEqual(errors, []);
    console.log('PASS Local XY constrained drag authors the arm’s local Z rotation');
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
