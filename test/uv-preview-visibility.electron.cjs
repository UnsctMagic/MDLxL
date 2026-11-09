// Run against a rebuilt package: MDLXL_TEST_EXE=<MDLxL.exe> node test/uv-preview-visibility.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, bundleHashes, root } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');

const fixture = testModel('corpus-sd800', 'creeps__archnathid.mdx');
const target = 3; // Geoset 4 (guts): its geoset and material-layer alpha both start at zero in Stand.
const preview = '.uv-tab-window .game-preview-root';
const out = path.join(root, 'out', 'uv-preview-visibility');

(async () => {
  const original = fs.readFileSync(fixture);
  const { app, page, errors, target: appUnderTest } = await launchApp({
    fixture, out, bounds: { x: -3000, y: 0, width: 1440, height: 1000 },
    settings: { preferences: { graphics: { pauseWhenHidden: false } } },
  });
  try {
    console.log(JSON.stringify(bundleHashes(appUnderTest)));
    const click = async locator => {
      await locator.waitFor({ state: 'visible' });
      const { x, y, width, height } = await locator.boundingBox();
      await page.mouse.click(x + width / 2, y + height / 2);
    };
    const canvas = page.locator(preview + ' canvas[data-clean-model-canvas]');
    const camera = () => page.evaluate(selector => mdlxlProbe(selector).runtime.controls.object.quaternion.toArray(), preview);
    const draws = () => page.evaluate(selector => uvMeshDraws(selector), preview);
    const model = () => page.evaluate(() => JSON.stringify(window.__mdlxl.session().doc.model));
    const geoset = page.getByLabel('Select geoset ' + target, { exact: true });
    await geoset.waitFor({ timeout: 60000 });
    const before = await model();
    await page.evaluate(() => {
      const drawsByCanvas = new WeakMap();
      const gl = WebGL2RenderingContext.prototype;
      const { clear, drawElements } = gl;
      gl.clear = function (mask) {
        if (mask & this.COLOR_BUFFER_BIT) drawsByCanvas.set(this.canvas, new Map());
        return clear.call(this, mask);
      };
      gl.drawElements = function (...args) {
        const buffer = this.getParameter(this.ELEMENT_ARRAY_BUFFER_BINDING);
        const program = this.getParameter(this.CURRENT_PROGRAM);
        const tint = program && this.getUniformLocation(program, 'uMdlvisGeosetTint');
        if (tint) drawsByCanvas.get(this.canvas)?.set(buffer, this.getUniform(program, tint)[3]);
        return drawElements.apply(this, args);
      };
      window.uvMeshDraws = selector => {
        const root = document.querySelector(selector);
        const canvas = root?.querySelector('canvas[data-clean-model-canvas]');
        const native = root && mdlxlProbe(root).runtime?.native;
        const draws = drawsByCanvas.get(canvas);
        return native?.indexBuffer.flatMap((buffer, index) => draws?.has(buffer) ? [{ index, alpha: draws.get(buffer) }] : []) || [];
      };
    });

    await click(page.locator('[data-hotkey="geosetsClear"]'));
    await click(geoset);
    assert.ok(await geoset.isChecked());
    await click(page.getByLabel('3D model viewport', { exact: true }));
    await page.keyboard.press('Control+a');
    await click(page.locator('[data-hotkey="uv"]'));
    await canvas.waitFor({ timeout: 60000 });
    await page.waitForFunction(selector => uvMeshDraws(selector).some(draw => draw.index === 0), preview);
    const full = await draws();
    await canvas.screenshot({ path: path.join(out, 'full.png') });
    assert.deepEqual(full.find(draw => draw.index === target), { index: target, alpha: 1 },
      'UV Live Preview must draw the working geoset at full visibility despite both Stand alpha tracks: ' + JSON.stringify(full));
    assert.equal(full.some(draw => draw.index === 4), false, 'unrelated Stand-hidden geosets stay hidden');
    const selectedOnly = page.locator('.uv-tab-window').getByRole('button', { name: 'Selected Only', exact: true });
    await click(selectedOnly);
    await page.waitForFunction(({ selector, target }) => {
      const draws = uvMeshDraws(selector);
      return draws.length === 1 && draws[0].index === target;
    }, { selector: preview, target });
    await canvas.screenshot({ path: path.join(out, 'selected-only.png') });

    const beforeRotation = await camera();
    const box = await canvas.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 75, y + 40, { steps: 8 }); await page.mouse.up();
    const afterRotation = await camera();
    assert.ok(afterRotation.some((value, axis) => Math.abs(value - beforeRotation[axis]) > .01), 'normal left drag rotates the live preview');
    assert.deepEqual(await draws(), [{ index: target, alpha: 1 }], 'rotation keeps the isolated working geoset visible');
    const point = await page.evaluate(({ selector, target }) => {
      const { runtime } = mdlxlProbe(selector);
      const camera = runtime.controls.object;
      const { Vertices, Faces } = runtime.native.model.Geosets[target];
      const rect = document.querySelector(selector + ' canvas[data-clean-model-canvas]').getBoundingClientRect();
      const points = Array.from({ length: Vertices.length / 3 }, (_, index) => camera.position.clone().fromArray(Vertices, index * 3).project(camera));
      for (let offset = 0; offset < Faces.length; offset += 3) {
        const [a, b, c] = Array.from(Faces.slice(offset, offset + 3), id => points[id]);
        const x = (a.x + b.x + c.x) / 3, y = (a.y + b.y + c.y) / 3;
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
        if (area * rect.width * rect.height > 80 && Math.abs(x) < .9 && Math.abs(y) < .9) {
          return { x: rect.left + (x + 1) * rect.width / 2, y: rect.top + (1 - y) * rect.height / 2 };
        }
      }
      return null;
    }, { selector: preview, target });
    assert.ok(point, 'a working polygon is on screen');
    await page.mouse.move(point.x, point.y);
    await page.keyboard.down('a');
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up('a');
    await page.waitForFunction(target => findFiberProps('.uv-workspace', props => !!props.eligibleSelection)?.selectionByGeoset[target]?.length === 3, target);
    await click(page.getByRole('button', { name: 'Close UV Wrapper', exact: true }));
    assert.equal(await canvas.count(), 0);
    assert.equal(await model(), before, 'opening, isolating, rotating and closing UV preserves the authored document');
    assert.ok(fs.readFileSync(fixture).equals(original), 'fixture bytes remain identical');
    assert.deepEqual(errors, []);
    console.log('PASS UV visibility: working geoset drawn, unrelated visibility preserved, Selected Only, mouse rotation, Live Preview polygon picking, authored model and disk bytes unchanged');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
