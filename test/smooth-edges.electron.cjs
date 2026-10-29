// Hidden packaged acceptance: same renderer survives toggles; only model samples,
// real mouse orbit, XL/VIS visibility and release-PDF evidence.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { launchApp, closeApp, clickMenu } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
(async () => {
  const out = path.resolve('out/smooth-edges'), shots = path.resolve('out/wp-3-10-shots');
  fs.mkdirSync(shots, { recursive: true }); fs.mkdirSync(out, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const paintDoc = createStarterDocument(), paintFixture = path.join(out, 'Paint.mdx');
  paintDoc.apply('Textured Paint fixture', ['Textures'], model => { model.Textures = [{ Image: 'Paint.tga', ReplaceableId: 0, Flags: 0 }]; });
  fs.writeFileSync(paintFixture, paintDoc.serialize('mdx'));
  const texture = Buffer.alloc(18 + 4 * 4 * 4, 150); texture.fill(0, 0, 18); texture[2] = 2;
  texture.writeUInt16LE(4, 12); texture.writeUInt16LE(4, 14); texture[16] = 32; texture[17] = 40;
  for (let i = 21; i < texture.length; i += 4) texture[i] = 255;
  fs.writeFileSync(path.join(out, 'Paint.tga'), texture);
  const { app, page, errors } = await launchApp({ fixture: fixturePath('footman'), out, settings: { preferences: { rendererRevision: 3, graphics: { antialias: true }, wheelMode: 'rotate', updateOfferAnswered: true } } });
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    const host = '[aria-label="3D model viewport"]';
    await page.locator(host + ' canvas').first().waitFor({ timeout: 60000 });
    await page.evaluate(selector => {
      window.wpState = () => findFiberState(selector, state => state?.renderer && state?.entries, { current: true });
    }, host);
    await page.waitForFunction(() => wpState()?.entries.length > 0);
    await page.evaluate(() => { window.originalWPState = wpState(); });
    const toggle = page.locator('.smooth-edges-toggle');
    await toggle.waitFor(); assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => wpState().modelSmoothing.samples === 4);
    assert.equal(await page.evaluate(() => wpState().renderer.getPixelRatio()), await page.evaluate(() => devicePixelRatio), 'Smooth retains native HiDPI resolution');
    assert.equal(await page.evaluate(() => wpState().renderer.getContext().getContextAttributes().antialias), false);
    await toggle.click();
    await page.waitForFunction(() => findFiberProps('.classic-toolbar', p => p.preferences)?.preferences.graphics.antialias === false);
    assert.equal(await page.evaluate(() => wpState() === originalWPState), true, 'Classic keeps the same canvas, camera, textures and selection');
    await toggle.click();
    await page.waitForFunction(() => findFiberProps('.classic-toolbar', p => p.preferences)?.preferences.graphics.antialias === true);
    assert.equal(await page.evaluate(() => wpState() === originalWPState), true, 'Smooth keeps the same renderer');
    await page.locator('select[aria-label="Render mode"]').selectOption('textured');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.locator('[data-hotkey="fit"]').click();
    await page.evaluate(() => {
      const props = findFiberProps('.classic-toolbar', p => p.runCommand);
      props.runCommand('display:wires'); props.runCommand('display:skeleton');
    });
    await page.waitForTimeout(300);
    await page.locator('.classic-toolbar').screenshot({ path: path.join(shots, 'xl-toolbar.png') });
    await page.screenshot({ path: path.join(shots, 'footman-smooth-editor.png') });
    const before = await page.evaluate(() => wpState().camera.quaternion.toArray());
    const box = await page.locator(host).boundingBox();
    await page.mouse.move(box.x + box.width * .6, box.y + box.height * .55);
    await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .63, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const after = await page.evaluate(() => wpState().camera.quaternion.toArray());
    assert.ok(after.some((v, i) => Math.abs(v - before[i]) > .001), 'mouse orbit works with smoothing');
    await page.locator('.vis-toggle').click();
    await page.locator('.classic-app[data-vis-ui]').waitFor(); assert.equal(await toggle.count(), 0);
    await page.locator('.vis-toggle').click(); await toggle.waitFor();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'VIS preserves the graphics preference');
    // Bone preview uses the native renderer. Check its active target while a
    // model draw runs, then its default framebuffer when rig helpers draw.
    await page.evaluate(() => {
      window.wpGLErrors = [];
      for (const name of ['blitFramebuffer', 'drawArrays', 'drawElements']) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function(...args) {
          const result = original.apply(this, args), error = this.getError();
          if (error) wpGLErrors.push({ name, error, args, depthBits: this.getParameter(this.DEPTH_BITS), stencilBits: this.getParameter(this.STENCIL_BITS) });
          return result;
        };
      }
    });
    await page.locator('[data-hotkey="bones"]').first().click();
    await page.locator('[data-clean-model-canvas]').waitFor();
    await page.waitForFunction(() => mdlxlProbe()?.runtime?.native);
    await page.locator('select[aria-label="Render mode"]').selectOption('textured');
    await page.evaluate(() => {
      const state = mdlxlProbe().runtime, gl = state.controls.domElement.getContext('webgl2');
      window.nativeWPState = state;
      const render = state.native.render;
      state.native.render = function(...args) { window.modelWPSamples = gl.getParameter(gl.SAMPLES); return render.apply(this, args); };
      state.redraw();
    });
    await page.waitForFunction(() => window.modelWPSamples === 4);
    assert.equal(await page.evaluate(() => nativeWPState.controls.domElement.getContext('webgl2').getParameter(0x80A9)), 0, 'bone markers use the single-sample default framebuffer');
    assert.deepEqual(await page.evaluate(() => wpGLErrors), [], 'native model draw and framebuffer resolve have no GL error');
    await page.screenshot({ path: path.join(shots, 'footman-smooth-bones.png') });
    const nativeBefore = await page.evaluate(() => nativeWPState.controls.object.quaternion.toArray());
    const nativeBox = await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.mouse.move(nativeBox.x + nativeBox.width * .6, nativeBox.y + nativeBox.height * .55);
    await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(nativeBox.x + nativeBox.width * .7, nativeBox.y + nativeBox.height * .6, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const nativeAfter = await page.evaluate(() => nativeWPState.controls.object.quaternion.toArray());
    assert.ok(nativeAfter.some((v, i) => Math.abs(v - nativeBefore[i]) > .001), 'native mouse orbit works with smoothing');
    await toggle.click();
    await page.waitForFunction(() => findFiberProps('.classic-toolbar', p => p.preferences)?.preferences.graphics.antialias === false);
    assert.equal(await page.evaluate(() => mdlxlProbe().runtime === nativeWPState), true, 'native toggle retains the model and camera');
    await toggle.click();
    await page.waitForFunction(() => findFiberProps('.classic-toolbar', p => p.preferences)?.preferences.graphics.antialias === true);
    console.log('PASS native Smooth target / sharp bone layer, clean GL resolve, retained runtime and mouse orbit');
    await page.locator('input[accept=".mdl,.mdx,.mdlxlpaint"]').setInputFiles(paintFixture);
    await page.waitForFunction(() => document.querySelector('.model-tab.active [role="tab"]')?.getAttribute('aria-label') === 'Paint.mdx');
    await page.locator('[data-hotkey="paint"]').first().click();
    await page.getByRole('button', { name: /^New base coat/ }).click();
    await page.getByRole('button', { name: 'Begin painting', exact: true }).click();
    await page.locator('.paint-texture-view').waitFor();
    await page.locator('.paint-workspace .viewport canvas').first().waitFor();
    await page.evaluate(() => { window.paintWPState = () => findFiberState('.paint-workspace .viewport', s => s?.renderer && s?.entries, { current: true }); });
    await page.waitForFunction(() => paintWPState()?.modelSmoothing.samples === 4);
    const paintBefore = await page.evaluate(() => paintWPState().camera.quaternion.toArray());
    const paintBox = await page.evaluate(() => { const rect = paintWPState().controls.domElement.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; });
    await page.mouse.move(paintBox.x + paintBox.width * .6, paintBox.y + paintBox.height * .55);
    await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(paintBox.x + paintBox.width * .7, paintBox.y + paintBox.height * .6, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const paintAfter = await page.evaluate(() => paintWPState().camera.quaternion.toArray());
    assert.ok(paintAfter.some((v, i) => Math.abs(v - paintBefore[i]) > .001), 'Paint mouse orbit works with smoothing');
    console.log('PASS Paint Smooth model pass and real mouse orbit');
    assert.deepEqual(await page.evaluate(() => wpGLErrors), [], 'native and Paint draw/resolve operations stay valid');
    assert.deepEqual(errors, []);
    console.log('PASS Smooth model target / sharp single-sample editor; live XL switch; absent in VIS; real mouse orbit; Footman captures');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
