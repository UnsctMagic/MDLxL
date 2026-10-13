// Real mouse acceptance against the production bundle or a disposable package.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const { ObjectLoader } = await import('three');
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { createNode } = await import('../src/editor-document.js');
  const { movementAxisHandles, projectMovementNodes } = await import('../app/movement-overlay.js');
  const root = process.cwd(), out = path.resolve(process.env.MDLXL_ROTATION_OUT || 'out/rotation-interaction/' + Date.now());
  fs.mkdirSync(out, { recursive: true });
  const recordOnly = process.env.MDLXL_ROTATION_RECORD === '1', doc = createStarterDocument();
  doc.apply('Asymmetric rotation fixture', ['Sequences', 'Nodes', 'Geosets'], model => {
    model.Sequences = [
      { Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
      { Name: 'Attack', Interval: new Uint32Array([2000, 3000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
    ];
    model.Bones[0].Rotation = { LineType: 1, GlobalSeqId: null, Keys: [0, 1000, 2000, 3000].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, 0, 1]) })) };
    const other = createNode(model, 'Bone'); other.Name = 'Unselected'; other.PivotPoint.set([80, -35, 20]);
    model.Geosets[0].Vertices.forEach((value, index, vertices) => { vertices[index] = value * [1.65, .65, 1.2][index % 3]; });
  });
  const fixture = path.join(out, 'Rotation.mdx'); fs.writeFileSync(fixture, doc.serialize('mdx'));
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const fixtureHash = hash(fixture), checks = [], errors = [];
  const packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  const assets = path.join(packaged ? path.join(path.dirname(executablePath), 'resources/app/dist') : path.join(root, 'dist'), 'assets');
  const bundleDigest = crypto.createHash('sha256');
  for (const name of fs.readdirSync(assets).sort()) bundleDigest.update(name).update(fs.readFileSync(path.join(assets, name)));
  const bundleHash = bundleDigest.digest('hex');
  const app = await _electron.launch({
    executablePath,
    args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...(packaged ? [fixture] : [root, fixture])],
    cwd: root, env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile'), MDLVIS_HEADLESS: '1' }, timeout: 60000,
  });
  const check = (label, pass, evidence) => { checks.push({ label, pass: !!pass, ...(evidence === undefined ? {} : { evidence }) }); console.log((pass ? 'PASS ' : 'FAIL ') + label); };
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setSize(1280, 900); });
    await page.locator('[data-hotkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('Movement bone or node').selectOption('0');
    await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.getByLabel('Current animation frame').fill('500'); await page.getByLabel('Current animation frame').press('Enter');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.evaluate(() => {
      window.rotationProbe = () => {
        const root = document.querySelector('.game-preview-root'); let runtime, props, session;
        for (let fiber = root?.[Object.keys(root).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const ref = hook.memoizedState?.current;
          if (ref?.native && ref?.controls) runtime = ref;
          if (ref?.model && ref?.onNodeTransform) props = ref;
          if (hook.memoizedState?.doc?.model && hook.memoizedState?.assets) session = hook.memoizedState;
        }
        if (!runtime || !props || !session) throw Error('Movement runtime missing');
        return { runtime, props, session };
      };
    });
    await page.waitForFunction(() => rotationProbe().runtime.captureApi?.isReady);
    const settle = () => page.waitForTimeout(100);
    const menu = command => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), command);
    const snap = () => page.evaluate(() => {
      const { runtime, session } = rotationProbe(), camera = runtime.controls.object;
      const bone = runtime.native.rendererData.nodes.find(item => item?.node.ObjectId === 0);
      const matrix = Array.from(bone.matrix);
      return { model: JSON.stringify(session.doc.model), undo: session.doc.historyStats.undoSteps,
        rotation: JSON.stringify(bone.node.Rotation), scale: JSON.stringify(bone.node.Scaling),
        rotationKey: Array.from(bone.node.Rotation?.Keys.find(key => key.Frame === 500)?.Vector || [0, 0, 0, 1]),
        preserved: JSON.stringify({ geosets: session.doc.model.Geosets, materials: session.doc.model.Materials, textures: session.doc.model.Textures,
          nodes: session.doc.model.Bones.map(node => node.ObjectId === 0 ? { ...node, Rotation: { ...node.Rotation, Keys: node.Rotation.Keys.filter(key => key.Frame >= 2000) } } : node) }),
        matrix, lengths: [0, 4, 8].map(i => Math.hypot(...matrix.slice(i, i + 3))),
        camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), zoom: camera.zoom, target: runtime.controls.target.toArray() } };
    });
    const delta = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
    const sameCamera = (a, b) => Math.abs(a.zoom - b.zoom) < 1e-10 && ['position', 'quaternion', 'target'].every(key => delta(a[key], b[key]) < 1e-8);
    const handles = async () => {
      const data = await page.evaluate(() => {
        const { runtime, props } = rotationProbe(), canvas = document.querySelector('[data-clean-model-canvas]');
        return { camera: runtime.controls.object.toJSON(), frame: runtime.native.getFrame(), sequence: props.sequenceIndex, width: canvas.clientWidth, height: canvas.clientHeight, space: props.transformSpace, radius: runtime.captureApi.showcaseView().radius, model: props.model };
      });
      const camera = new ObjectLoader().parse(data.camera); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
      const active = projectMovementNodes(data.model, data.frame, data.sequence, camera, data.width, data.height).find(item => item.node.ObjectId === 0);
      return { active, handles: movementAxisHandles(active, camera, data.width, data.height, data.radius, data.space, 'rotate') };
    };
    const workplane = page.getByLabel('Workplane', { exact: true });
    const sidebarWidth = await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width);
    for (const [plane, normal] of [['xy', 'Z'], ['xz', 'Y'], ['yz', 'X']]) {
      await workplane.check(); await page.locator(`[data-hotkey="plane:${plane}"]`).check();
      const disabled = await Promise.all(['X', 'Y', 'Z'].map(axis => page.getByLabel(axis + ' coordinate', { exact: true }).isDisabled()));
      check(plane + ' numeric XYZ rotation includes its normal ' + normal, disabled.every(value => !value), disabled);
      const input = page.getByLabel(normal + ' coordinate', { exact: true });
      if (!await input.isDisabled()) {
        const before = await snap(); await input.fill('20'); await input.press('Enter');
        // Numeric edits rebuild the native preview. Wait for its first evaluated
        // frame; live drags below deliberately retain short per-step sampling.
        await page.waitForFunction(previous => {
          const node = rotationProbe().runtime.native.rendererData.nodes.find(item => item?.node.ObjectId === 0);
          return Math.hypot(...Array.from(node.matrix, (value, i) => value - previous[i])) > .1;
        }, before.matrix);
        const after = await snap();
        check(plane + ' numeric rotation changes the selected part', delta(before.matrix, after.matrix) > .1);
        check(plane + ' numeric rotation preserves scale and camera', after.scale === before.scale && delta(before.lengths, after.lengths) < 1e-5 && sameCamera(after.camera, before.camera));
        check(plane + ' numeric rotation commits one Undo step', after.undo === before.undo + 1);
        await menu('undo'); await settle(); check(plane + ' numeric exact Undo', (await snap()).model === before.model);
      }
    }
    await workplane.uncheck();
    check('Workplane off enables all XYZ fields', (await Promise.all(['X', 'Y', 'Z'].map(axis => page.getByLabel(axis + ' coordinate', { exact: true }).isDisabled()))).every(value => !value));
    async function drag(label, start, dx, dy, cancel = false, expectedAxis = null) {
      const before = await snap(), box = await page.locator('[data-clean-model-canvas]').boundingBox(), samples = [];
      await page.mouse.move(box.x + start.x, box.y + start.y); await page.mouse.down();
      for (let step = 1; step <= 6; step++) {
        await page.mouse.move(box.x + start.x + dx * step / 6, box.y + start.y + dy * step / 6);
        await page.waitForTimeout(25); samples.push(await snap());
      }
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up(); await settle(); const after = await snap();
      if (cancel) check(label + ' restores model and history', after.model === before.model && after.undo === before.undo);
      else {
        check(label + ' responds during drag', samples.every((sample, index) => delta(sample.matrix, (index ? samples[index - 1] : before).matrix) > .001), samples.map(sample => delta(sample.matrix, before.matrix)));
        check(label + ' preserves scale and camera', samples.concat(after).every(sample => sample.scale === before.scale && delta(sample.lengths, before.lengths) < 1e-5 && sameCamera(sample.camera, before.camera)), { before: { lengths: before.lengths, camera: before.camera }, after: { lengths: after.lengths, camera: after.camera } });
        check(label + ' preserves mesh, textures, other nodes and sequences', after.preserved === before.preserved);
        if (expectedAxis) {
          const index = { X: 0, Y: 1, Z: 2 }[expectedAxis];
          check(label + ' rotates the requested axis', Math.abs(after.rotationKey[index]) > .001 && after.rotationKey.slice(0, 3).every((value, i) => i === index || Math.abs(value) < 1e-5), after.rotationKey);
        }
        check(label + ' commits one Undo step', after.undo === before.undo + 1, { before: before.undo, after: after.undo });
        if (after.undo > before.undo) { await menu('undo'); await settle(); check(label + ' exact Undo', (await snap()).model === before.model); }
      }
    }
    for (const axis of ['X', 'Y', 'Z']) for (const direction of ['radial', 'perpendicular']) {
      const handle = (await handles()).handles.find(item => item.axis === axis), length = Math.hypot(handle.dx, handle.dy), ux = handle.dx / length, uy = handle.dy / length;
      await drag(axis + ' ' + direction, handle, (direction === 'radial' ? ux : -uy) * 30, (direction === 'radial' ? uy : ux) * 30, false, axis);
    }
    await page.getByLabel('View direction', { exact: true }).selectOption('bottom'); await settle();
    const shortZ = (await handles()).handles.find(item => item.axis === 'Z');
    await drag('Bottom-view Z handle cap', shortZ, shortZ.dx, shortZ.dy, false, 'Z');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective'); await settle();
    for (const plane of ['xy', 'xz', 'yz']) {
      await workplane.check(); await page.locator(`[data-hotkey="plane:${plane}"]`).check(); await settle();
      for (const direction of ['horizontal', 'vertical']) {
        const active = (await handles()).active;
        await drag(plane + ' ' + direction, { x: active.x + 120, y: active.y + 90 }, direction === 'horizontal' ? 30 : 0, direction === 'vertical' ? 30 : 0, false, { xy: 'Z', xz: 'Y', yz: 'X' }[plane]);
      }
    }
    await drag('Escape cancellation', { x: (await handles()).active.x + 120, y: (await handles()).active.y + 90 }, 30, 20, true);
    await workplane.uncheck();
    for (const interruption of ['capture lost', 'window blurred']) {
      const handle = (await handles()).handles.find(item => item.axis === 'X'), box = await page.locator('[data-clean-model-canvas]').boundingBox(), before = await snap();
      await page.mouse.move(box.x + handle.x, box.y + handle.y); await page.mouse.down();
      await page.mouse.move(box.x + handle.x + handle.dx / 3, box.y + handle.y + handle.dy / 3, { steps: 4 }); await settle();
      await page.evaluate(kind => {
        const canvas = document.querySelector('[data-clean-model-canvas]');
        if (kind === 'window blurred') window.dispatchEvent(new Event('blur'));
        else { for (let id = 1; id < 6; id++) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); }
      }, interruption);
      await page.mouse.up(); await settle(); const after = await snap();
      check(interruption + ' cancels selected-part edit', before.model === after.model && before.undo === after.undo);
      check(interruption + ' restores camera controls', await page.evaluate(() => rotationProbe().runtime.controls.enabled));
      // Undo a baseline commit so subsequent checks still exercise the same model.
      if (after.undo > before.undo) { await menu('undo'); await settle(); }
      const next = (await handles()).handles.find(item => item.axis === 'X');
      await drag('rotation after ' + interruption, next, next.dx / 2, next.dy / 2);
    }
    for (const enabled of [false, true]) {
      const beforeToggle = await snap(); await workplane.setChecked(enabled); await settle();
      check('Workplane ' + enabled + ' preserves camera framing', sameCamera((await snap()).camera, beforeToggle.camera));
      const box = await page.locator('[data-clean-model-canvas]').boundingBox(), x = box.x + 40, y = box.y + 70;
      const beforeRotate = await snap();
      await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 70, y + 30, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle();
      const afterRotate = await snap(); check('Workplane ' + enabled + ' actual Alt mouse camera rotation', delta(beforeRotate.camera.quaternion, afterRotate.camera.quaternion) > .01 && beforeRotate.model === afterRotate.model);
      const beforeZoom = await snap(); await page.mouse.move(x, y); await page.mouse.wheel(0, -120); await settle(); const afterZoom = await snap();
      check('Workplane ' + enabled + ' wheel zoom preserves model', afterZoom.camera.zoom > beforeZoom.camera.zoom && afterZoom.model === beforeZoom.model);
      await page.locator('[data-hotkey="camera:zoom"]').click();
      const beforeDragZoom = await snap(); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 30, { steps: 6 }); await page.mouse.up(); await settle(); const afterDragZoom = await snap();
      check('Workplane ' + enabled + ' mouse zoom preserves model', afterDragZoom.camera.zoom > beforeDragZoom.camera.zoom && afterDragZoom.model === beforeDragZoom.model);
      await page.locator('[data-hotkey="camera:work"]').click();
    }
    check('sidebar width preserved', await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width) === sidebarWidth);
    check('input model bytes preserved', hash(fixture) === fixtureHash); check('no renderer errors', errors.length === 0, errors);
    const screenshot = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(out, 'controls.png'), Buffer.from(screenshot, 'base64'));
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ packaged, executablePath, bundleHash, fixtureHash, checks, errors }, null, 2));
    await app.evaluate(({ app }) => app.exit(0));
  }
  console.log('Evidence: ' + out);
  if (!recordOnly) assert.equal(checks.filter(check => !check.pass).length, 0, 'All rotation acceptance checks must pass');
})().catch(error => { console.error(error); process.exitCode = 1; });
