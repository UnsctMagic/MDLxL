const { appDist } = require('./helpers/app.cjs');
const { sha256File } = require('./helpers/app.cjs');
const { appTarget } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Real mouse acceptance against the production bundle or a disposable package.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

(async () => {
  const { ObjectLoader, Quaternion, Vector3, Matrix4 } = await import('three');
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { createNode } = await import('../src/editor-document.js');
  const { movementAxisHandles, projectMovementNodes } = await import('../app/movement-overlay.js');
  const { rotationRingTangent } = await import('../src/rotation-drag.js');
  const root = process.cwd(), out = path.resolve(process.env.MDLXL_ROTATION_OUT || 'out/rotation-interaction/' + Date.now());
  fs.mkdirSync(out, { recursive: true });
  const recordOnly = process.env.MDLXL_ROTATION_RECORD === '1', doc = createStarterDocument();
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI).toArray();
  doc.apply('Asymmetric rotation fixture', ['Sequences', 'Nodes', 'Geosets'], model => {
    model.Sequences = [
      { Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
      { Name: 'Attack', Interval: new Uint32Array([2000, 3000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
    ];
    model.Bones[0].Rotation = { LineType: 1, GlobalSeqId: null, Keys: [0, 1000, 2000, 3000].map(Frame => ({ Frame, Vector: new Float32Array(tilt) })) };
    const other = createNode(model, 'Bone'); other.Name = 'Unselected'; other.PivotPoint.set([80, -35, 20]);
    model.Geosets[0].Vertices.forEach((value, index, vertices) => { vertices[index] = value * [1.65, .65, 1.2][index % 3]; });
  });
  const fixture = path.join(out, 'Rotation.mdx'); fs.writeFileSync(fixture, doc.serialize('mdx'));
  const hash = sha256File;
  const fixtureHash = hash(fixture), checks = [], errors = [];
  const packaged = appTarget().packaged;
  const executablePath = appTarget().executablePath;
  const assets = path.join(packaged ? appDist() : path.join(root, 'dist'), 'assets');
  const bundleDigest = crypto.createHash('sha256');
  for (const name of fs.readdirSync(assets).sort()) bundleDigest.update(name).update(fs.readFileSync(path.join(assets, name)));
  const bundleHash = bundleDigest.digest('hex');
  const { app, page } = await launchApp({ out: out, profile: path.join(out, 'profile'), args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'], env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: fixture , errors, pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1280, height: 900 }, show: 'hide' });
  const check = (label, pass, evidence) => { checks.push({ label, pass: !!pass, ...(evidence === undefined ? {} : { evidence }) }); console.log((pass ? 'PASS ' : 'FAIL ') + label + (!pass && evidence !== undefined ? ' ' + JSON.stringify(evidence) : '')); };

  try {

    await page.locator('[data-hotkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('Movement bone or node').selectOption('0');
    await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.getByLabel('Current animation frame').fill('500'); await page.getByLabel('Current animation frame').press('Enter');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.evaluate(() => {
      window.rotationProbe = ()=>{const {runtime,props,session}=mdlxlProbe();if(!runtime||!props||!session)throw Error('Movement runtime missing');return {runtime,props,session};};
    });
    await page.waitForFunction(() => rotationProbe().runtime.captureApi?.isReady);
    check('fresh profile defaults to world/grid axes', await page.evaluate(() => rotationProbe().props.transformSpace === 'world'));
    check('packaged test stays hidden', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(win => !win.isVisible())));
    const settle = async () => {
      await settlePage(page, 100);
      // Undo/commit rebuilds the native renderer asynchronously. Its initial
      // identity matrix at frame zero is not the evaluated tilted bone.
      await page.waitForFunction(() => {
        const { runtime, props } = rotationProbe();
        return runtime.captureApi?.isReady && runtime.native.getFrame() === props.time;
      }, null, { polling: 50 });
    };
    const waitMatrix = matrix => page.waitForFunction(previous => {
      const node = rotationProbe().runtime.native.rendererData.nodes.find(item => item?.node.ObjectId === 0);
      return node && Math.hypot(...Array.from(node.matrix, (value, i) => value - previous[i])) < 1e-5;
    }, matrix, { polling: 50 });
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
        label: document.querySelector('.game-preview-root [role="status"]')?.textContent || '',
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
      return { active, camera, handles: movementAxisHandles(active, camera, data.width, data.height, data.radius, data.space, 'rotate') };
    };
    if (process.env.MDLXL_ROTATION_LOCAL_ONLY === '1') {
      await require('./helpers/rotation-local.electron.cjs')({ app, page, check, settle, snap, menu, waitMatrix });
      check('no visible windows or popups', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 1 && !BrowserWindow.getAllWindows()[0].isVisible()));
      check('input model bytes preserved', hash(fixture) === fixtureHash); check('no renderer errors', errors.length === 0, errors);
      assert.equal(checks.filter(item => !item.pass).length, 0, 'All Local rotation checks must pass');
      return;
    }
    const workplane = page.getByLabel('Workplane', { exact: true });
    // The alternative behavior and editor speed must reach the actual Movement drag.
    const movementSetting = async (behavior, speed) => {
      await menu('settings');const dialog=page.getByRole('dialog',{name:'Settings',exact:true});
      await dialog.getByRole('tab',{name:'Mouse',exact:true}).click();await dialog.getByRole('navigation',{name:'Mouse pages'}).getByRole('button',{name:'Rotation',exact:true}).click();
      await dialog.getByLabel('Rotation editor',{exact:true}).selectOption('movement');await dialog.getByLabel('Rotational Behavior',{exact:true}).selectOption(behavior);
      await dialog.getByLabel('Use default rotation sensitivity').uncheck();await dialog.getByLabel('Rotation sensitivity',{exact:true}).fill(String(speed));await dialog.getByLabel('Rotation sensitivity',{exact:true}).press('Tab');await dialog.getByRole('button',{name:'Close Settings',exact:true}).click();await settle();
    };
    // Along the ring is the default; the steady-turn checks below measure Straight drag (linear).
    check('fresh profile defaults Rotate to Along the ring', await page.evaluate(() => rotationProbe().props.preferences?.rotation?.behavior) === 'ring');
    await movementSetting('linear',1);
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
    async function drag(label, start, dx, dy, cancel = false, expectedAxis = null, { shift = false, sensitivity = 1 } = {}) {
      await settle();
      const before = await snap(), box = await page.locator('[data-clean-model-canvas]').boundingBox(), samples = [];
      const x = Math.round(box.x + start.x), y = Math.round(box.y + start.y);
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.move(x, y); await page.mouse.down();
      for (let step = 1; step <= 6; step++) {
        await page.mouse.move(x + dx * step / 6, y + dy * step / 6);
        await settlePage(page, 25); samples.push(await snap());
      }
      if (cancel === 'right-click') { await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); }
      else if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up(); if (shift) await page.keyboard.up('Shift'); await settle();
      if (cancel) await waitMatrix(before.matrix);
      const after = await snap();
      if (cancel) {
        check(label + ' previews a turn before cancellation', samples.some(sample => delta(sample.matrix, before.matrix) > .001));
        check(label + ' restores model, rendered pose and history', after.model === before.model && after.undo === before.undo && delta(after.matrix, before.matrix) < 1e-5);
      }
      else {
        check(label + ' responds during drag', samples.every((sample, index) => delta(sample.matrix, (index ? samples[index - 1] : before).matrix) > .001), samples.map(sample => delta(sample.matrix, before.matrix)));
        check(label + ' preserves scale and camera', samples.concat(after).every(sample => sample.scale === before.scale && delta(sample.lengths, before.lengths) < 1e-5 && sameCamera(sample.camera, before.camera)), { before: { lengths: before.lengths, camera: before.camera }, after: { lengths: after.lengths, camera: after.camera } });
        check(label + ' preserves mesh, textures, other nodes and sequences', after.preserved === before.preserved);
        if (expectedAxis) {
          const normal = new Vector3().setComponent({ X: 0, Y: 1, Z: 2 }[expectedAxis], 1);
          const orientation = snapshot => new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(snapshot.matrix)).normalize();
          const baseline = orientation(before);
          const expected = (fraction = 1) => {
            let degrees = (dx - dy) * sensitivity * fraction;
            if (shift) degrees = Math.round(degrees / 5) * 5;
            return new Quaternion().setFromAxisAngle(normal, degrees * Math.PI / 180).multiply(baseline);
          };
          check(label + ' turns steadily around the world ' + expectedAxis + ' axis', samples.every((sample, i) => Math.abs(orientation(sample).dot(expected((i + 1) / 6))) > 1 - 1e-5) && Math.abs(orientation(after).dot(expected())) > 1 - 1e-5, { dx, dy, key: after.rotationKey, before: before.matrix, after: after.matrix, dots: samples.map((sample, i) => Math.abs(orientation(sample).dot(expected((i + 1) / 6)))) });
          check(label + ' shows live degrees', samples.every(sample => /Rotate [XYZ]: -?[\d.]+/.test(sample.label)), samples.map(sample => sample.label));
        }
        check(label + ' commits one Undo step', after.undo === before.undo + 1, { before: before.undo, after: after.undo });
        if (after.undo > before.undo) { await menu('undo'); await settle(); check(label + ' exact Undo', (await snap()).model === before.model); }
      }
    }
    await drag('Right-click cancellation', (await handles()).handles.find(item => item.axis === 'Z'), 30, 0, 'right-click');
    // Tilted rest keys make local-axis rotation visibly different from grid rotation.
    // Test both camera sides and both the shaft and the unchanged handle cap.
    for (const view of ['front', 'back', 'perspective']) {
      await page.getByLabel('View direction', { exact: true }).selectOption(view); await settle();
      for (const axis of ['X', 'Y', 'Z']) for (const grip of ['tip', 'shaft']) {
        const { active, handles: axes } = await handles(), handle = axes.find(item => item.axis === axis);
        const start = grip === 'tip' ? handle : { x: active.x + handle.dx * .75, y: active.y + handle.dy * .75 };
        await drag(view + ' ' + axis + ' ' + grip + ' right', start, 30, 0, false, axis);
      }
      const active = (await handles()).active;
      const viewAxis = await page.evaluate(() => {
        const direction = rotationProbe().runtime.controls.object.getWorldDirection(rotationProbe().runtime.controls.target.clone());
        return ['X', 'Y', 'Z'].reduce((best, axis) => Math.abs(direction[axis.toLowerCase()]) > Math.abs(direction[best.toLowerCase()]) ? axis : best, 'X');
      });
      await drag(view + ' bare bone right', active, 30, 0, false, viewAxis);
    }
    for (const axis of ['X', 'Y', 'Z']) {
      await drag(axis + ' up', (await handles()).handles.find(item => item.axis === axis), 0, -30, false, axis);
      await drag(axis + ' left', (await handles()).handles.find(item => item.axis === axis), -30, 0, false, axis);
    }
    await drag('Shift snaps to five degrees', (await handles()).handles.find(item => item.axis === 'Z'), 42, 0, false, 'Z', { shift: true });
    await menu('pointerUp'); await settle();
    const sensitivity = await page.evaluate(() => rotationProbe().props.preferences.pointerSensitivity);
    check('pointer sensitivity control applies', sensitivity > 1, sensitivity);
    await drag('Pointer sensitivity', (await handles()).handles.find(item => item.axis === 'Z'), 30, 0, false, 'Z', { sensitivity });
    await menu('pointerDown'); await settle();
    // Closed circular mouse paths must return to the baseline orientation.
    {
      const handle = (await handles()).handles.find(item => item.axis === 'Z'), before = await snap();
      const box = await page.locator('[data-clean-model-canvas]').boundingBox(), x = Math.round(box.x + handle.x), y = Math.round(box.y + handle.y);
      await page.mouse.move(x, y); await page.mouse.down();
      for (let step = 1; step <= 32; step++) await page.mouse.move(x + Math.round(20 * (Math.cos(step * Math.PI / 16) - 1)), y + Math.round(20 * Math.sin(step * Math.PI / 16)));
      await page.mouse.move(x, y); await page.mouse.up(); await settle();
      const after = await snap(); check('circular mouse path returns to zero rotation', delta(before.matrix, after.matrix) < 1e-5);
      if (after.undo > before.undo) { await menu('undo'); await settle(); }
    }
    for (const plane of ['xy', 'xz', 'yz']) {
      await workplane.check(); await page.locator(`[data-hotkey="plane:${plane}"]`).check(); await settle();
      for (const side of [-1, 1]) for (const direction of ['horizontal', 'vertical']) {
        const active = (await handles()).active;
        await drag(plane + ' side ' + side + ' ' + direction, { x: active.x + 120 * side, y: active.y + 90 * side }, direction === 'horizontal' ? 30 : 0, direction === 'vertical' ? -30 : 0, false, { xy: 'Z', xz: 'Y', yz: 'X' }[plane]);
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
      await page.mouse.up(); await settle(); await waitMatrix(before.matrix); const after = await snap();
      check(interruption + ' cancels selected-part edit', before.model === after.model && before.undo === after.undo);
      check(interruption + ' restores camera controls', await page.evaluate(() => rotationProbe().runtime.controls.enabled));
      // Undo a baseline commit so subsequent checks still exercise the same model.
      if (after.undo > before.undo) { await menu('undo'); await settle(); }
      const next = (await handles()).handles.find(item => item.axis === 'X');
      await drag('rotation after ' + interruption, next, 30, 0, false, 'X');
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
      await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Shift+Z');
      const beforeDragZoom = await snap(); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 30, { steps: 6 }); await page.mouse.up(); await settle(); const afterDragZoom = await snap();
      check('Workplane ' + enabled + ' mouse zoom preserves model', afterDragZoom.camera.zoom > beforeDragZoom.camera.zoom && afterDragZoom.model === beforeDragZoom.model);
      await page.keyboard.press('Shift+Q');
    }
    await page.getByLabel('View direction',{exact:true}).selectOption('top');await workplane.check();await page.locator('[data-hotkey="plane:xy"]').check();await settle();
    await movementSetting('linear',.5);
    let pivot=(await handles()).active;
    await drag('Movement per-editor sensitivity',{x:pivot.x+120,y:pivot.y+40},30,0,false,'Z',{sensitivity:.5});
    await movementSetting('pivot',1);pivot=(await handles()).active;
    {
      const before=await snap(),box=await page.locator('[data-clean-model-canvas]').boundingBox(),x=box.x+pivot.x,y=box.y+pivot.y;
      await page.mouse.move(x+120,y);await page.mouse.down();
      for(let i=1;i<=12;i++)await page.mouse.move(x+120*Math.cos(i*Math.PI/24),y+120*Math.sin(i*Math.PI/24));
      await page.mouse.up();await settle();const after=await snap();
      const baseline=new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(before.matrix)).normalize();
      const expected=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-Math.PI/2).multiply(baseline);
      const actual=new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(after.matrix)).normalize();
      check('Movement Pivot-based choice follows a quarter-circle',Math.abs(actual.dot(expected))>1-1e-4);
      check('Movement Pivot-based commits one Undo step',after.undo===before.undo+1);
      await menu('undo');await settle();check('Movement Pivot-based exact Undo',(await snap()).model===before.model);
    }
    {
      // Front looks down X, so the ZX (Y-axis) turn circle is edge-on: Pivot-based
      // uses the Linear rule there instead of stalling beside the center.
      await page.getByLabel('View direction',{exact:true}).selectOption('front');await page.locator('[data-hotkey="plane:xz"]').check();await settle();pivot=(await handles()).active;
      const before=await snap(),box=await page.locator('[data-clean-model-canvas]').boundingBox(),x=box.x+pivot.x,y=box.y+pivot.y-80;
      await page.mouse.move(x,y);await page.mouse.down();
      for(let i=1;i<=6;i++)await page.mouse.move(x,y-i*5);
      await page.mouse.up();await settle();const after=await snap();
      const baseline=new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(before.matrix)).normalize();
      const expected=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/6).multiply(baseline);
      const actual=new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(after.matrix)).normalize();
      check('Movement Pivot-based edge-on ZX turns with a straight up drag',Math.abs(actual.dot(expected))>1-1e-4,{actual:actual.toArray(),expected:expected.toArray()});
      if(after.undo>before.undo){await menu('undo');await settle();}
      await page.getByLabel('View direction',{exact:true}).selectOption('top');await page.locator('[data-hotkey="plane:xy"]').check();await settle();
    }
    await movementSetting('',1);
    {
      // Along the ring (the default): the same pull along each axis ring turns X, Y and Z by the same angle.
      await workplane.uncheck(); await page.getByLabel('View direction', { exact: true }).selectOption('perspective'); await settle();
      const orientation = snapshot => new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(snapshot.matrix)).normalize(), turns = [];
      for (const axis of ['X', 'Y', 'Z']) for (const grip of ['tip', 'shaft']) {
        const { active, camera, handles: axes } = await handles(), handle = axes.find(item => item.axis === axis), before = await snap();
        const start = grip === 'tip' ? handle : { x: active.x + handle.dx * .75, y: active.y + handle.dy * .75 };
        const box = await page.locator('[data-clean-model-canvas]').boundingBox(), x = Math.round(box.x + start.x), y = Math.round(box.y + start.y);
        const normal = new Vector3().setComponent({ X: 0, Y: 1, Z: 2 }[axis], 1);
        const tangent = rotationRingTangent({ x: x - box.x - active.x, y: y - box.y - active.y }, normal.clone().transformDirection(camera.matrixWorldInverse).toArray());
        await page.mouse.move(x, y); await page.mouse.down();
        for (let step = 1; step <= 6; step++) await page.mouse.move(x + tangent.x * 5 * step, y + tangent.y * 5 * step);
        await page.mouse.up(); await settle(); const after = await snap();
        const turn = orientation(after).multiply(orientation(before).invert()); if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w);
        const degrees = 2 * Math.acos(Math.min(1, turn.w)) * 180 / Math.PI, along = new Vector3(turn.x, turn.y, turn.z).normalize().dot(normal);
        turns.push(degrees);
        check('Along the ring ' + axis + ' ' + grip + ' turns about +' + axis + ' by the 30 pixel pull', Math.abs(degrees - 30) < 1.5 && along > .999, { degrees, along, tangent, label: after.label });
        check('Along the ring ' + axis + ' ' + grip + ' commits one Undo step', after.undo === before.undo + 1);
        if (after.undo > before.undo) { await menu('undo'); await settle(); await waitMatrix(before.matrix); }
      }
      check('Along the ring turns every axis at the same speed', Math.max(...turns) - Math.min(...turns) < 1.5, turns);
    }
    await require('./helpers/rotation-local.electron.cjs')({ app, page, check, settle, snap, menu, waitMatrix });
    await require('./helpers/rotation-editors.electron.cjs')({ app, page, check, out });
    check('no visible windows or popups', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 1 && !BrowserWindow.getAllWindows()[0].isVisible()));
    check('sidebar width preserved', await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width) === sidebarWidth);
    check('input model bytes preserved', hash(fixture) === fixtureHash); check('no renderer errors', errors.length === 0, errors);
    const screenshot = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(out, 'controls.png'), Buffer.from(screenshot, 'base64'));
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ packaged, executablePath, bundleHash, fixtureHash, checks, errors }, null, 2));
    await closeApp(app);
  }
  console.log('Evidence: ' + out);
  if (!recordOnly) assert.equal(checks.filter(check => !check.pass).length, 0, 'All rotation acceptance checks must pass');
})().catch(error => { console.error(error); process.exitCode = 1; });
