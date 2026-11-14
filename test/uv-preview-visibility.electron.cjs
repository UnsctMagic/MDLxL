// Run against a rebuilt package: MDLXL_TEST_EXE=<MDLxL.exe> node test/uv-preview-visibility.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, bundleHashes, root } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');

const source = testModel('corpus-sd800', 'creeps__archnathid.mdx');
const target = 3; // Geoset 4 (guts): its geoset and material-layer alpha both start at zero in Stand.
const preview = '.uv-tab-window .game-preview-root';
const out = path.join(root, 'out', 'uv-preview-visibility');

(async () => {
  const original = fs.readFileSync(source);
  const { openDocument } = await import('../src/editor-document.js');
  const document = openDocument(original, source);
  document.apply('UV appearance fixture', ['GeosetAnims', 'Materials'], model => {
    const color = model.GeosetAnims.find(animation => animation.GeosetId === target);
    color.Flags |= 2;
    color.Color = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: model.Sequences[0].Interval[0], Vector: new Float32Array([.75, .25, .5]) }] };
    color._MdxDefaults.Color = new Float32Array([.25, .5, .75]);
    model.GeosetAnims.find(animation => animation.GeosetId === 5)._MdxDefaults.Alpha = 0;
    const layer = model.Materials[model.Geosets[4].MaterialID].Layers[0];
    layer.Alpha = structuredClone(model.GeosetAnims.find(animation => animation.GeosetId === 4).Alpha);
    (layer._MdxDefaults ||= {}).Alpha = .5;
  });
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'UV-appearance.mdx');
  const bytes = document.serialize('mdx');
  fs.writeFileSync(fixture, bytes);
  const { app, page, errors, target: appUnderTest } = await launchApp({
    fixture, out, bounds: { x: -3000, y: 0, width: 1440, height: 1000 },
    settings: { preferences: { graphics: { pauseWhenHidden: false },
      hotkeys: { 'uv-wrapper:preview-rgb-red': ['Ctrl+Alt+R'], 'uv-wrapper:hide-extras': ['Ctrl+Alt+H'] } } },
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
    const beforeRevision = await page.evaluate(() => window.__mdlxl.session().doc.revision);
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
        if (tint) drawsByCanvas.get(this.canvas)?.set(buffer, Array.from(this.getUniform(program, tint)));
        return drawElements.apply(this, args);
      };
      window.uvMeshDraws = selector => {
        const root = document.querySelector(selector);
        const canvas = root?.querySelector('canvas[data-clean-model-canvas]');
        const native = root && mdlxlProbe(root).runtime?.native;
        const draws = drawsByCanvas.get(canvas);
        return native?.indexBuffer.flatMap((buffer, index) => draws?.has(buffer) ? [{ index, rgb: draws.get(buffer).slice(0, 3), alpha: draws.get(buffer)[3] }] : []) || [];
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
    const workingDraw = { index: target, rgb: [.25, .5, .75], alpha: 1 };
    assert.deepEqual(full.find(draw => draw.index === target), workingDraw,
      'UV Live Preview uses the authored static RGB and keeps the working geoset visible: ' + JSON.stringify(full));
    assert.equal(full.find(draw => draw.index === 4)?.alpha, .5, 'context uses static geoset and layer alpha');
    assert.equal(full.some(draw => draw.index === 5), false, 'context with static alpha zero stays hidden');
    const wrapper = page.locator('.uv-tab-window');
    const hideExtras = wrapper.getByRole('button', { name: 'Hide extras', exact: true });
    await hideExtras.waitFor({ timeout: 5000 }).catch(() => assert.fail('Hide Extras is available in the Live Model Preview footer'));
    const beforeExtras = await camera();
    assert.ok(full.some(draw => draw.index === 6), 'the other extra is drawn before filtering');
    await page.keyboard.press('Control+Alt+H');
    await page.waitForFunction(selector => !uvMeshDraws(selector).some(draw => draw.index === 6), preview, { timeout: 5000 });
    assert.equal(await hideExtras.getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await draws(), full.filter(draw => draw.index !== 6),
      'Hide Extras hides the other drawn extra and keeps the working extra and ordinary context');
    assert.deepEqual(await camera(), beforeExtras, 'Hide Extras preserves the camera');
    assert.ok(await geoset.isChecked(), 'the working extra stays checked in the Vertex editor');
    await click(hideExtras);
    await page.waitForFunction(selector => uvMeshDraws(selector).some(draw => draw.index === 6), preview, { timeout: 5000 });
    assert.deepEqual(await draws(), full, 'turning off Hide Extras restores the other extra');
    const red = wrapper.getByRole('spinbutton', { name: 'Preview RGB R', exact: true });
    const green = wrapper.getByRole('spinbutton', { name: 'Preview RGB G', exact: true });
    const blue = wrapper.getByRole('spinbutton', { name: 'Preview RGB B', exact: true });
    const reset = wrapper.getByRole('button', { name: 'Reset preview RGB', exact: true });
    await red.waitFor({ timeout: 5000 }).catch(() => assert.fail('Preview RGB offers a red number input beside Hide RGB'));
    assert.equal((await wrapper.getByRole('group', { name: 'Preview RGB', exact: true }).innerText()).replace(/\s+/g, ' ').trim(), 'Preview RGB Reset');
    for (const [field, id] of [[red, 'preview-rgb-red'], [green, 'preview-rgb-green'], [blue, 'preview-rgb-blue'], [hideExtras, 'hide-extras']]) {
      assert.equal(await field.getAttribute('data-hotkey'), 'uv-wrapper:' + id);
      assert.notEqual(await field.getAttribute('data-hotkey-manual'), null);
    }
    const quickColors = await page.locator('.quick-display label:has([data-hotkey="rgb"]) svg path')
      .evaluateAll(paths => paths.map(path => getComputedStyle(path).fill));
    assert.equal(quickColors.length, 3, 'Quick display has three RGB colors');
    const rgbColors = await wrapper.locator('.uv-preview-rgb label svg path')
      .evaluateAll(paths => paths.map(path => getComputedStyle(path).fill));
    assert.deepEqual(rgbColors, quickColors, 'each channel uses its filled Quick display RGB color');
    const footerBox = await wrapper.locator('.uv-preview-footer').boundingBox();
    const extrasBox = await hideExtras.boundingBox();
    const redBox = await red.boundingBox();
    assert.ok(Math.abs(extrasBox.y + extrasBox.height / 2 - redBox.y - redBox.height / 2) < 2,
      'Hide Extras shares the RGB line');
    assert.ok(footerBox.x + footerBox.width - extrasBox.x - extrasBox.width <= 7,
      'Hide Extras is aligned with the right edge of the footer');
    const enter = async (input, value) => {
      await click(input);
      await page.keyboard.press('Control+a');
      await page.keyboard.type(value);
      assert.equal(await input.inputValue(), value);
    };
    const expectRGB = rgb => page.waitForFunction(({ selector, target, rgb }) =>
      uvMeshDraws(selector).find(draw => draw.index === target)?.rgb.every((value, index) => value === rgb[index]),
    { selector: preview, target, rgb }, { timeout: 5000 });
    const beforeRGB = await camera();
    await page.keyboard.press('Control+Alt+R');
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-hotkey') === 'uv-wrapper:preview-rgb-red');
    await page.keyboard.type('255');
    assert.equal(await red.inputValue(), '255');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }));
    assert.deepEqual((await draws()).find(draw => draw.index === target).rgb, workingDraw.rgb, 'typing does not tint the preview until Enter');
    await page.keyboard.press('Enter');
    await expectRGB([1, .5, .75]);
    await enter(green, '0');
    await enter(blue, '128');
    await page.keyboard.press('Enter');
    const override = [1, 0, Math.fround(128 / 255)];
    await expectRGB(override);
    assert.deepEqual(await draws(), full.map(draw => draw.index === target ? { ...draw, rgb: override } : draw),
      'Preview RGB replaces only the working geoset tint and preserves opacity');
    assert.deepEqual(await camera(), beforeRGB, 'typing RGB leaves the camera where it was');
    assert.equal(await model(), before, 'typing RGB leaves authored model data intact');
    assert.equal(await page.evaluate(() => window.__mdlxl.session().doc.revision), beforeRevision, 'typing RGB creates no model revision');
    await enter(blue, '256');
    await page.keyboard.press('Enter');
    await expectRGB([1, 0, .75]);
    await click(reset);
    await expectRGB(workingDraw.rgb);
    assert.deepEqual(await draws(), full, 'Reset restores the authored appearance of the full preview');
    for (const field of [red, green, blue]) assert.equal(await field.inputValue(), '');

    const selectedOnly = wrapper.getByRole('button', { name: 'Selected Only', exact: true });
    await click(selectedOnly);
    await page.waitForFunction(({ selector, target }) => {
      const draws = uvMeshDraws(selector);
      return draws.length === 1 && draws[0].index === target;
    }, { selector: preview, target });
    await canvas.screenshot({ path: path.join(out, 'selected-only.png') });
    const hideRGB = page.locator('.uv-tab-window').getByRole('button', { name: 'Hide RGB', exact: true });
    await click(hideRGB);
    await page.waitForFunction(({ selector, target }) => uvMeshDraws(selector).some(draw => draw.index === target && draw.rgb.every(value => value === 1)), { selector: preview, target });
    assert.deepEqual(await draws(), [{ index: target, rgb: [1, 1, 1], alpha: 1 }]);
    await click(hideRGB);
    await expectRGB(workingDraw.rgb);
    await click(hideRGB);
    await expectRGB([1, 1, 1]);
    await enter(green, '255');
    await page.keyboard.press('Enter');
    await expectRGB([.25, 1, .75]);
    assert.equal(await hideRGB.getAttribute('aria-pressed'), 'false', 'typing a tint turns Hide RGB off');
    await click(hideRGB);
    await expectRGB([1, 1, 1]);
    await click(reset);
    await expectRGB(workingDraw.rgb);
    assert.equal(await hideRGB.getAttribute('aria-pressed'), 'false', 'Reset returns to the authored RGB');

    const beforeRotation = await camera();
    const box = await canvas.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 75, y + 40, { steps: 8 }); await page.mouse.up();
    const afterRotation = await camera();
    assert.ok(afterRotation.some((value, axis) => Math.abs(value - beforeRotation[axis]) > .01), 'normal left drag rotates the live preview');
    assert.deepEqual(await draws(), [workingDraw], 'rotation keeps the isolated working geoset visible');
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
    assert.deepEqual(fs.readFileSync(fixture), Buffer.from(bytes), 'fixture bytes remain identical');
    assert.ok(fs.readFileSync(source).equals(original), 'source model bytes remain identical');
    assert.deepEqual(errors, []);
    console.log('PASS UV visibility: unanimated RGB and opacity, working geoset drawn, Selected Only, Hide Extras with working extra preserved, RGB dots, Preview RGB and Reset, Hide RGB, mouse rotation, Live Preview polygon picking, authored model and disk bytes unchanged');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
