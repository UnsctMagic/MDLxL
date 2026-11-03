const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  assert.equal(process.env.MDLXL_SUITE_HIDDEN, '1', 'Use the hidden packaged runner');
  const out = path.resolve(process.env.MDLXL_DISPLAY_OUT || 'out/view-vertex-display');
  fs.mkdirSync(out, { recursive: true });
  const { app, page, errors } = await launchApp({
    out, fixture: fixturePath('archer'),
    settings: { preferences: { rendererRevision: 3, graphics: { antialias: false, pauseWhenHidden: false },
      viewportAppearance: { unselectedVertex: { color: '#00ff00', size: 7, style: 'square' },
        selectedVertex: { color: '#ff00ff', size: 7, style: 'square' } } } },
  });
  try {
    await page.locator('.vis-toggle').waitFor();
    await page.evaluate(() => { window.displayProbe = () => ({ runtime: findFiberState('.viewport', value => value?.entries && value?.controls), props: findFiberState('.viewport', value => value?.model && value?.onSelectionChange) }); });
    await page.waitForFunction(() => displayProbe().runtime?.entries?.length > 0);
    const originalModel = await page.evaluate(() => JSON.stringify(window.__mdlxl.model()));
    const state = () => page.evaluate(() => {
      const { runtime, props } = displayProbe();
      return { overlays: props.overlays, camera: runtime.camera.position.toArray(), quaternion: runtime.camera.quaternion.toArray(), target: runtime.controls.target.toArray() };
    });
    const menu = () => app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'View').submenu.items.map(item => item.label));
    if (process.env.MDLXL_DISPLAY_CASE !== 'points') {
      for (const key of ['F1', 'F4', 'F3']) {
        await page.keyboard.press(key);
        await page.waitForFunction(() => document.querySelector('.quick-display'));
        const xl = await menu();
        assert.ok(!xl.includes('X-Ray'), 'View has no separate X-Ray control');
        await page.locator('.vis-toggle').click();
        await page.waitForFunction(() => document.querySelector('.classic-app').hasAttribute('data-vis-ui'));
        assert.deepEqual(await menu(), xl, key + ': View offers the same entries in ViS and XL');
        assert.equal(await page.locator('.quick-display input[data-hotkey="xrayVertices"]').count(), 0, 'ViS has no extra X-Ray display shortcut');
        await page.locator('.vis-toggle').click();
        await page.waitForFunction(() => !document.querySelector('.classic-app').hasAttribute('data-vis-ui'));
      }
      await page.keyboard.press('F1');
      for (const vis of [false, true]) {
        if (vis) await page.locator('.vis-toggle').click();
        const bones = page.locator('.quick-display input[data-hotkey="display:bones"]');
        await bones.waitFor();
        if (!(await bones.isChecked())) await bones.click();
        await page.waitForFunction(() => displayProbe().props.overlays.bones);
        const before = await state();
        const shown = await page.locator('.viewport').screenshot();
        await bones.click();
        await page.waitForFunction(() => !displayProbe().props.overlays.bones);
        const hidden = await page.locator('.viewport').screenshot();
        assert.notDeepEqual(shown, hidden, 'Bones changes the rendered viewport in ' + (vis ? 'ViS' : 'XL'));
        assert.deepEqual((await state()).camera, before.camera, 'display toggles preserve viewpoint');
        assert.equal(await page.locator('.quick-display input[data-hotkey="xrayVertices"]').count(), 0, 'Vertex Manager has no extra X-Ray display shortcut');
        await page.locator('.quick-display button').filter({ hasText: /^Clear$/ }).click();
        await page.waitForFunction(() => Object.entries(displayProbe().props.overlays).filter(([key]) => !key.startsWith('boneTypes')).every(([, value]) => !value));
      }
      await page.locator('.vis-toggle').click();
    }
    if (process.env.MDLXL_DISPLAY_CASE !== 'menu') {
      await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
      await page.locator('.quick-display button').filter({ hasText: /^Clear$/ }).click();
      await page.locator('.quick-display input[data-hotkey="showVertices"]').click();
      await page.getByLabel('Grabthrough', { exact: true }).check();
      await page.getByRole('button', { name: 'All', exact: true }).click();
      await page.getByRole('button', { name: 'Fit', exact: true }).click();
      await page.waitForFunction(() => {
        const { runtime } = displayProbe();
        return runtime.entries.some(entry => entry?.points.visible && entry.hiddenPoints.visible);
      });
      const canvas = page.locator('.viewport canvas').first();
      const measurements = [];
      assert.equal(await page.evaluate(() => displayProbe().props.preferences.viewportAppearance.xrayVertices), false, 'Grabthrough works with the existing appearance X-Ray setting off');
      for (const smooth of [false, true]) {
        const current = await page.evaluate(() => displayProbe().props.preferences.graphics.antialias);
        if (smooth !== current) await page.locator('.smooth-edges-toggle').click();
        await page.waitForFunction(value => displayProbe().props.preferences.graphics.antialias === value, smooth);
        const points = await page.evaluate(() => {
          const { runtime } = displayProbe();
          const camera = runtime.camera, rect = runtime.renderer.domElement.getBoundingClientRect();
          return runtime.entries.filter(entry => entry?.group.visible && entry.points.visible).flatMap(entry => {
            const attribute = entry.geometry.attributes.position;
            return Array.from({ length: attribute.count }, (_, index) => {
              const point = camera.position.clone().fromBufferAttribute(attribute, index).applyMatrix4(entry.points.matrixWorld).project(camera);
              return { x: (point.x + 1) * rect.width / 2, y: (1 - point.y) * rect.height / 2, z: point.z };
            }).filter(point => point.z > -1 && point.z < 1 && point.x > 4 && point.y > 4 && point.x < rect.width - 4 && point.y < rect.height - 4);
          });
        });
        assert.ok(points.length > 100, 'real model supplies vertex targets');
        const shot = await canvas.screenshot();
        const bitmap = await app.evaluate(({ nativeImage }, encoded) => {
          const image = nativeImage.createFromBuffer(Buffer.from(encoded, 'base64'));
          return { ...image.getSize(), pixels: image.toBitmap().toString('base64') };
        }, shot.toString('base64'));
        const pixels = Buffer.from(bitmap.pixels, 'base64'), box = await canvas.boundingBox();
        const found = points.filter(point => {
          const x = Math.round(point.x * bitmap.width / box.width), y = Math.round(point.y * bitmap.height / box.height);
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const offset = ((y + dy) * bitmap.width + x + dx) * 4;
            if (pixels[offset] < 45 && pixels[offset + 1] > 220 && pixels[offset + 2] < 45) return true;
          }
          return false;
        }).length;
        measurements.push({ smooth, grabThrough: true, targets: points.length, visible: found });
        fs.writeFileSync(path.join(out, 'pixels.json'), JSON.stringify(measurements, null, 2));
        fs.writeFileSync(path.join(out, smooth ? 'smooth.png' : 'classic.png'), shot);
        assert.equal(found, points.length, (smooth ? 'Smooth' : 'Classic') + ': every vertex dot stays above every material with Grabthrough');
      }
      const before = await state(), box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * .55, box.y + box.height * .55);
      await page.keyboard.down('Alt');
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .7, box.y + box.height * .65, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Alt');
      await page.waitForFunction(position => {
        const camera = displayProbe().runtime.camera;
        return camera.quaternion.toArray().some((value, index) => Math.abs(value - position[index]) > .001);
      }, before.quaternion);
      assert.notDeepEqual((await state()).quaternion, before.quaternion, 'normal mouse drag rotates the camera');
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.__mdlxl.model())), originalModel, 'View choices and camera gestures preserve authored model data');
    assert.deepEqual(errors, []);
    console.log('PASS shared View without an extra X-Ray control, ViS/XL Bones and Clear, Grabthrough pixels and mouse rotation');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
