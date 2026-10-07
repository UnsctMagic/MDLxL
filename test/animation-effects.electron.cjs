// Run against rebuilt dist; MDLXL_ELECTRON_PATH can point to a packaged MDLxL.exe.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'animation-effects', String(Date.now()));
  const profile = path.join(out, 'profile');
  await fs.mkdir(profile, { recursive: true });
  const { createDemoDocument, createNode } = await import('../src/editor-document.js');
  const { starterTextureAsset } = await import('../src/particle-starters.js');
  const doc = createDemoDocument();
  const visibility = () => ({ LineType: 0, GlobalSeqId: null, Keys: [[0, 1], [2000, 1], [3000, 0], [5000, 0]].map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) });
  doc.apply('Animation effect fixture', ['Nodes', 'PivotPoints', 'Textures', 'Materials', 'Sequences'], model => {
    model.Sequences.push({ ...structuredClone(model.Sequences[0]), Name: 'Effects hidden', Interval: new Uint32Array([3000, 5000]) });
    const texture = model.Textures.push({ Image: starterTextureAsset().name, ReplaceableId: 0, Flags: 0 }) - 1;
    const particle = createNode(model, 'ParticleEmitter2');
    Object.assign(particle, { Name: 'Visible sparks', TextureID: texture, Visibility: visibility(), EmissionRate: 60, LifeSpan: .6, Speed: 35,
      ParticleScaling: new Float32Array([5, 9, 0]), SegmentColor: Array.from({ length: 3 }, () => new Float32Array([1, .4, .05])) });
    particle.PivotPoint.set([35, 0, 120]);
    const material = model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 4, Shading: 17, TextureID: texture, CoordId: 0, Alpha: 1 }] }) - 1;
    const ribbon = createNode(model, 'RibbonEmitter');
    Object.assign(ribbon, { Name: 'Visible ribbon', MaterialID: material, Visibility: visibility(), EmissionRate: 60, LifeSpan: .3, HeightAbove: 7, HeightBelow: 7,
      Translation: { LineType: 1, GlobalSeqId: null, Keys: [[0, -55], [1000, 55], [2000, -55]].map(([Frame, x]) => ({ Frame, Vector: new Float32Array([x, 0, 165]) })) } });
  });
  const fixture = path.join(out, 'animation-effects.mdx'), bytes = Buffer.from(doc.serialize('mdx'));
  await fs.writeFile(fixture, bytes);
  const texture = starterTextureAsset(), texturePath = path.join(out, ...texture.name.split('\\'));
  await fs.mkdir(path.dirname(texturePath), { recursive: true });
  await fs.writeFile(texturePath, texture.bytes);
  // Also prove Animations works when the graphics effect preference is disabled.
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { particles: false }, emitterMarker: 'pentagram' } }));
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  const packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const app = await _electron.launch({ executablePath, args: packaged ? [fixture] : [root, fixture], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '0' }, timeout: 60000 });
  const errors = [];
  const screenshot = async name => {
    const png = await app.evaluate(async ({ BrowserWindow }) =>
      (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    await fs.writeFile(path.join(out, name), Buffer.from(png, 'base64'));
  };
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await page.getByText('Opened animation-effects.mdx', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    await page.getByLabel('Choose animation sequence', { exact: true }).selectOption('0');
    // Observe the actual GL marker draw, including unselected emitters that
    // would otherwise leave the same single node-overlay canvas in the DOM.
    await page.evaluate(() => {
      const markerPrograms = new WeakMap(), original = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (mode, first, count) {
        const program = this.getParameter(this.CURRENT_PROGRAM);
        if (program && !markerPrograms.has(program)) markerPrograms.set(program,
          this.getAttachedShaders(program).some(shader => this.getShaderSource(shader).includes('out vec3 tint;')));
        if (program && markerPrograms.get(program) && mode === this.TRIANGLES) window.markerTriangles = count;
        return original.call(this, mode, first, count);
      };
    });
    const readRuntime = () => page.evaluate(() => {
      const el = document.querySelector('.game-preview-root');
      let fiber = el?.[Object.keys(el).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native && state.controls) {
          const native = state.native;
          return { frame: native.getFrame(), ready: state.captureApi?.isReady,
            particles: native.particlesController.emitters.map(emitter => emitter.particles.filter(particle => particle.lifeSpan > 0).length),
            ribbons: native.ribbonsController.emitters.map(emitter => emitter.creationTimes.length),
            nodes: el.querySelectorAll('[data-node-overlay]').length,
            markerTriangles: el.querySelector('[data-node-overlay]') ? window.markerTriangles || 0 : 0,
            camera: state.controls.object.position.toArray(), geosets: native.model.Geosets.length };
        }
      }
      return null;
    });
    const waitFor = async (predicate, label) => {
      const end = Date.now() + 20000;
      while (Date.now() < end) { const state = await readRuntime(); if (state && predicate(state)) return state; await page.waitForTimeout(100); }
      throw Error(label + ': ' + JSON.stringify(await readRuntime()));
    };
    const command = action => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), action);
    await waitFor(state => state.ready, 'Preview ready');
    assert.equal(await page.locator('.animation-node-list input:checked').count(), 0);
    assert.equal(await page.getByRole('dialog', { name: 'Particle Editor', exact: true }).count(), 0);
    const sidebarWidth = await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const visible = await waitFor(state => state.particles[0] > 0 && state.ribbons[0] > 1, 'Particles and ribbon emit without selection');
    assert.equal(visible.nodes, 0); assert.equal(visible.geosets, doc.model.Geosets.length);
    await screenshot('animations-effects.png');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    // The display switch must not show unselected emitter markers.
    await command('display:particles');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const toggled = await waitFor(state => state.particles[0] > 0 && state.ribbons[0] > 1, 'Effects survive the display switch');
    assert.equal(toggled.nodes, 0);
    await page.getByLabel('Select node Visible sparks', { exact: true }).check();
    const selected = await waitFor(state => state.markerTriangles === 222 && state.particles[0] > 0 && state.ribbons[0] > 1,
      'Only the selected particle emitter has a pentagram; both effects keep rendering');
    await screenshot('animations-selected-emitter.png');
    await page.getByLabel('Select node Visible ribbon', { exact: true }).check();
    await waitFor(state => state.markerTriangles === 444, 'Both selected emitters have pentagrams');
    await page.getByLabel('Select node Visible sparks', { exact: true }).uncheck();
    await waitFor(state => state.markerTriangles === 222 && state.particles[0] > 0 && state.ribbons[0] > 1,
      'Deselecting one emitter removes only its marker');
    await screenshot('animations-selected-ribbon.png');
    await page.getByLabel('Select node Visible ribbon', { exact: true }).uncheck();
    await waitFor(state => state.nodes === 0 && state.particles[0] > 0 && state.ribbons[0] > 1,
      'Deselecting all emitters removes all markers and leaves effects running');
    await command('display:particles');
    await page.getByLabel('Select node Visible sparks', { exact: true }).check();
    await waitFor(state => state.markerTriangles === 222 && state.particles[0] > 0 && state.ribbons[0] > 1,
      'Selected marker and authored effects also work with the display switch off');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByLabel('Choose animation sequence', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const hidden = await waitFor(state => state.frame > 3200 && state.particles[0] === 0 && state.ribbons[0] === 0, 'Authored hidden animation stays hidden');
    assert.equal(hidden.markerTriangles, 222, 'Selected marker remains visible even when the authored effect is hidden');
    await screenshot('animations-authored-hidden.png');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await command('camera:rotate');
    const cameraBefore = (await readRuntime()).camera, canvas = await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .75, canvas.y + canvas.height * .75);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .65, canvas.y + canvas.height * .65, { steps: 12 });
    await page.mouse.up();
    await waitFor(state => state.camera.some((value, i) => Math.abs(value - cameraBefore[i]) > 1), 'Normal mouse drag rotates the preview camera');
    await command('camera:work');
    await page.getByLabel('Select node Visible sparks', { exact: true }).uncheck();
    await waitFor(state => state.nodes === 0, 'Hidden animation also clears the marker on deselection');
    assert.equal(await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width), sidebarWidth);
    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    await command('display:particles');
    await waitFor(state => state.markerTriangles === 444, 'Movement retains all emitter editing markers');
    await screenshot('movement-markers.png');
    assert.deepEqual(await fs.readFile(fixture), bytes);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, packaged, executablePath, out, visible, toggled, selected, hidden, sidebarWidth,
      fixtureSha256: createHash('sha256').update(bytes).digest('hex') }));
  } catch (error) {
    if (page) { await screenshot('failure.png').catch(() => {}); console.error((await page.locator('body').innerText()).slice(-1200)); }
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
