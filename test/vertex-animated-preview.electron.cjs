const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { isDeepStrictEqual } = require('node:util');
const { launchApp, closeApp } = require('./helpers/app.cjs');

(async () => {
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { createSequence } = await import('../src/sequence-editor.js');
  const { setKey, transformVertices } = await import('../src/editor-commands.js');
  const { sampleNodeMatrices, skinGeoset } = await import('../src/animation.js');
  const doc = createStarterDocument();
  doc.apply('Animated vertex fixture', ['Sequences', 'Bones', 'Geosets', 'GeosetAnims'], model => {
    const geo = model.Geosets[0];
    const other = structuredClone(geo);
    for (let i = 2; i < other.Vertices.length; i += 3) other.Vertices[i] -= 80;
    model.Geosets.push(other);
    createSequence(model, 350, { name: 'Attack' });
    model.Sequences[0].Interval.set([100, 450]);
    createSequence(model, 250, { name: 'Stand', gap: 250 });
    const bone = model.Bones[0];
    setKey(bone, 'Rotation', 100, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    setKey(bone, 'Rotation', 250, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    setKey(bone, 'Rotation', 450, [.5, 0, 0, Math.sqrt(.75)]);
    setKey(bone, 'Translation', 100, [12, -6, 0]);
    setKey(bone, 'Translation', 450, [45, 19, 0]);
    setKey(bone, 'Translation', 700, [-24, 17, 0]);
    setKey(bone, 'Translation', 950, [11, 34, 0]);
    const anim = { GeosetId: 1, Flags: 0, Color: new Float32Array([1, 1, 1]) };
    setKey(anim, 'Alpha', 100, [0]);
    setKey(anim, 'Alpha', 450, [1]);
    setKey(anim, 'Alpha', 700, [1]);
    model.GeosetAnims.push(anim);
  });
  const out = path.resolve('out/vertex-animated-preview');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'animated-preview.mdx');
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const { app, page, errors } = await launchApp({ fixture, out, show: 'inactive', bounds: { x: -3000, y: 0, width: 1280, height: 920 },
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
    settings: { preferences: { language: 'en', graphics: { pauseWhenHidden: false } } } });
  try {
    await page.evaluate(() => {
      window.vertexPreviewRuntime = () => findFiberState(document.querySelector('[aria-label="3D model viewport"]'), value => value?.renderer && value?.entries, { current: true });
    });
    const host = page.getByLabel('3D model viewport', { exact: true });
    const button = page.getByRole('button', { name: 'Animated', exact: true });
    const picker = page.getByLabel('Choose animation', { exact: true });
    const inspect = () => page.evaluate(() => {
      const state = vertexPreviewRuntime(), entry = state.entries[0];
      return {
        vertices: Array.from(entry.geoset.Vertices), drawn: Array.from(entry.geometry.attributes.position.array),
        selection: Array.from(entry.selectedPoints.geometry.index?.array || []),
        camera: state.camera.quaternion.toArray(), target: state.controls.target.toArray(), zoom: state.camera.zoom,
        tracks: JSON.stringify(state.geometrySource.model.Bones),
        visibility: state.entries[1].group.visible,
        drag: state.drag?.payload || null
      };
    });
    const painted = (sequence, frame) => page.waitForFunction(([sequence, frame]) => {
      const state = vertexPreviewRuntime();
      return state?.sampledSequence === sequence && state.sampledFrame === frame && state.entries.length === 2;
    }, [sequence, frame], { polling: 16 });
    const closeArray = (actual, expected, label) => {
      assert.equal(actual.length, expected.length, label);
      actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < .0002, label + ' at component ' + index));
    };
    const expectedPose = (vertices, sequence, frame = doc.model.Sequences[sequence].Interval[0]) => {
      return skinGeoset({ ...doc.model.Geosets[0], Vertices: vertices }, sampleNodeMatrices(doc.model, frame, sequence));
    };
    await button.waitFor();
    await painted(-1, 0);
    await page.getByLabel('View direction', { exact: true }).selectOption('top');
    await page.getByLabel('XY workplane', { exact: true }).check();
    const hostBox = await host.boundingBox();
    await page.mouse.click(hostBox.x + 5, hostBox.y + 5);
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    assert.equal(await picker.inputValue(), '0');
    assert.ok((await picker.boundingBox()).width <= 20, 'only the arrow-sized picker receives clicks');
    const rest = await inspect();
    const switchTimes = [];
    for (let i = 0; i < 10; i++) {
      const animated = i % 2 === 0, start = Date.now();
      await page.keyboard.press('Shift+Space');
      await painted(animated ? 0 : -1, animated ? 100 : 0);
      switchTimes.push(Date.now() - start);
      assert.equal(await button.getAttribute('aria-pressed'), String(animated));
    }
    assert.ok(switchTimes.every(ms => ms < 1000), 'each switch responds within a second: ' + switchTimes);
    console.log('Ten consecutive hotkey switches, worst key-to-render ' + Math.max(...switchTimes) + ' ms');
    assert.deepEqual(await inspect(), rest, 'switches leave the model, camera, zoom and selection alone');
    await button.click();
    await painted(0, 100);
    const first = await inspect();
    assert.equal(first.visibility, false, 'sample first-frame geoset alpha');
    closeArray(first.drawn, expectedPose(first.vertices, 0), 'first sequence is frozen at its start');
    await page.waitForTimeout(160);
    assert.deepEqual(await inspect(), first, 'the first frame stays frozen');

    const field = page.getByRole('textbox', { name: 'Frame', exact: true });
    await button.click({ button: 'right' });
    assert.equal(await field.inputValue(), '100', 'the field defaults to the first timeline frame');
    await field.fill('700');
    await field.press('Enter');
    assert.equal(await field.isVisible(), true, 'out-of-range frames are rejected');
    assert.deepEqual(await inspect(), first);
    await field.fill('250');
    await field.press('Escape');
    await field.waitFor({ state: 'hidden' });
    assert.deepEqual(await inspect(), first, 'Escape cancels a frame change');
    await button.click({ button: 'right' });
    await field.fill('250');
    await field.press('Enter');
    await field.waitFor({ state: 'hidden' });
    await painted(0, 250);
    const custom = await inspect();
    closeArray(custom.drawn, expectedPose(custom.vertices, 0, 250), 'the chosen frame is sampled');
    await page.keyboard.press('Shift+Space');
    await painted(-1, 0);
    await page.keyboard.press('Shift+Space');
    await painted(0, 250);

    const screenVertex = index => page.evaluate(index => {
      const state = vertexPreviewRuntime(), entry = state.entries[0], rect = state.controls.domElement.getBoundingClientRect();
      const at = state.controls.target.clone().fromBufferAttribute(entry.geometry.attributes.position, index).project(state.camera);
      return { x: rect.left + (at.x + 1) * rect.width / 2, y: rect.top + (1 - at.y) * rect.height / 2 };
    }, index);
    await page.keyboard.press('a');
    const start = await screenVertex(0);
    await page.mouse.click(start.x, start.y);
    await page.waitForFunction(() => vertexPreviewRuntime().entries[0].selectedPoints.geometry.index?.count === 1);
    assert.deepEqual((await inspect()).selection, [0], 'pick the displaced vertex by its displayed position');
    await page.keyboard.press('m');
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 18, start.y + 5, { steps: 4 });
    for (const deadline = performance.now() + 5000; performance.now() < deadline;) {
      const position = await screenVertex(0);
      if (Math.abs(position.x - start.x - 18) < 1 && Math.abs(position.y - start.y - 5) < 1) break;
      await delay(25);
    }
    const moved = await screenVertex(0);
    assert.ok(Math.abs(moved.x - start.x - 18) < 1 && Math.abs(moved.y - start.y - 5) < 1,
      'the frozen vertex follows the pointer: ' + JSON.stringify({ start, moved }));
    const live = await inspect();
    assert.deepEqual(live.vertices, rest.vertices, 'live drag leaves the authored model alone until release');
    const expected = structuredClone(doc.model.Geosets[0]);
    // The frozen bone is turned 90 degrees about Z. Its inverse maps the screen-space move back to the base.
    const [x, y, z] = live.drag.translation;
    transformVertices(expected, [0], [y, -x, z], [1, 1, 1], [0, 0, 0], live.drag.pivot);
    closeArray(live.drawn, expectedPose(expected.Vertices, 0, 250), 'live preview skins the edited base vertex at the chosen frame');
    await page.mouse.up();
    await page.waitForFunction(() => !vertexPreviewRuntime().drag && vertexPreviewRuntime().entries[0].geoset.Vertices[0] !== -32);
    const committed = await inspect();
    closeArray(committed.vertices, expected.Vertices, 'release writes only the base edit');
    closeArray(committed.drawn, live.drawn, 'release keeps the displayed result');
    assert.equal(committed.tracks, rest.tracks, 'bone tracks stay intact');
    assert.deepEqual(committed.selection, [0]);

    await picker.click();
    await page.waitForFunction(() => document.querySelector('.vertex-animation-picker select').matches(':open'));
    await page.keyboard.press('Escape');
    await picker.press('ArrowDown');
    await painted(1, 700);
    const second = await inspect();
    assert.equal(second.visibility, true);
    closeArray(second.drawn, expectedPose(second.vertices, 1), 'picker shows the other sequence at its first frame');
    await button.click({ button: 'right' });
    assert.equal(await field.inputValue(), '700', 'a new animation starts at its own first frame');
    await field.press('Escape');
    await page.keyboard.press('Shift+Space');
    await painted(-1, 0);
    closeArray((await inspect()).drawn, committed.vertices, 'base view shows the committed edit');
    await page.keyboard.press('Shift+Space');
    await painted(1, 700);

    const rect = await host.boundingBox();
    await page.keyboard.down('Alt');
    await page.mouse.move(rect.x + rect.width * .6, rect.y + rect.height * .5);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * .6 + 40, rect.y + rect.height * .5 + 20, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await page.waitForFunction(old => vertexPreviewRuntime().camera.quaternion.toArray().some((value, index) => Math.abs(value - old[index]) > .00001), second.camera);
    await page.getByRole('button', { name: 'Quad View', exact: true }).click();
    await page.locator('[data-viewport="top"]').waitFor();
    await page.keyboard.press('Shift+Space');
    await painted(-1, 0);
    await page.keyboard.press('Shift+Space');
    await painted(1, 700);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => vertexPreviewRuntime().entries[0].geoset.Vertices[0] === -32);
    const undone = await inspect();
    assert.deepEqual(undone.vertices, rest.vertices);
    closeArray(undone.drawn, expectedPose(undone.vertices, 1), 'undo refreshes the frozen preview');
    await page.getByRole('button', { name: 'Quad View', exact: true }).click();
    await page.getByLabel('View direction', { exact: true }).selectOption('top');
    await page.getByLabel('XY workplane', { exact: true }).check();
    await picker.click();
    await page.waitForFunction(() => document.querySelector('.vertex-animation-picker select').matches(':open'));
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowUp');
    await painted(0, 100);
    await button.click({ button: 'right' });
    await field.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('450');
    await page.keyboard.press('Enter');
    await painted(0, 450);
    await page.keyboard.press('Control+a');
    await page.waitForFunction(() => vertexPreviewRuntime().entries[0].selectedPoints.geometry.index?.count > 1);
    const tilted = await inspect();
    const pane = await host.boundingBox();
    const center = await screenVertex(0);
    const begin = { x: Math.min(pane.x + pane.width - 135, center.x + 70), y: Math.min(pane.y + pane.height - 135, center.y + 60) };
    for (const tool of ['r', 'z']) {
      const toolName = tool === 'r' ? 'Rotate' : 'Resize';
      const compareDrawn = (actual, expected, label) => {
        assert.equal(actual.length, expected.length, `${toolName} ${label}: actual length ${actual.length}, expected length ${expected.length}`);
        for (const [index, value] of actual.entries()) {
          assert.ok(Math.abs(value - expected[index]) < .0002,
            `${toolName} ${label} at component ${index}: actual ${value}, expected ${expected[index]}`);
        }
      };
      await page.keyboard.press(tool);
      await page.mouse.move(begin.x, begin.y);
      await page.mouse.down();
      if (tool === 'r') {
        const rotation = await page.evaluate(() => {
          const drag = vertexPreviewRuntime().drag.rotationDrag;
          return { tangent: drag.tangent, circle: drag.circle, pivot: drag.pivot, start: drag.start };
        });
        if (rotation.circle) {
          const dx = rotation.start.x - rotation.pivot.x, dy = rotation.start.y - rotation.pivot.y;
          for (let step = 1; step <= 8; step++) {
            const angle = step * Math.PI / 16;
            await page.mouse.move(pane.x + rotation.pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle),
              pane.y + rotation.pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle));
          }
        } else await page.mouse.move(begin.x + rotation.tangent.x * 50, begin.y + rotation.tangent.y * 50, { steps: 8 });
      } else await page.mouse.move(begin.x + 35, begin.y, { steps: 8 });
      await page.waitForFunction(tool => {
        const drag = vertexPreviewRuntime().drag?.payload;
        return tool === 'r' ? drag?.rotation?.some(value => Math.abs(value) > 1) : drag?.scale?.some(value => Math.abs(value - 1) > .01);
      }, tool);
      const deadline = performance.now() + 5000;
      let previous = await inspect();
      let turned;
      while (performance.now() + 50 <= deadline) {
        await delay(50);
        const current = await inspect();
        if (current.drag && isDeepStrictEqual(current.drawn, previous.drawn) && isDeepStrictEqual(current.drag, previous.drag)) {
          turned = current;
          break;
        }
        previous = current;
      }
      assert.ok(turned, `${toolName} preview did not settle within 5 s`);
      const visiblePivot = await page.evaluate(() => vertexPreviewRuntime().drag.viewPivot.toArray());
      const posed = { Vertices: new Float32Array(tilted.drawn) };
      transformVertices(posed, tilted.selection, [0, 0, 0], turned.drag.scale || [1, 1, 1], turned.drag.rotation || [0, 0, 0], visiblePivot);
      compareDrawn(turned.drawn, posed.Vertices, 'follows the frozen workplane');
      await page.mouse.up();
      await page.waitForFunction(before => vertexPreviewRuntime().entries[0].geoset.Vertices.some((value, index) => value !== before[index]), tilted.vertices);
      compareDrawn((await inspect()).drawn, turned.drawn, 'release keeps the posed edit');
      await page.keyboard.press('Control+z');
      await page.waitForFunction(before => vertexPreviewRuntime().entries[0].geoset.Vertices.every((value, index) => value === before[index]), tilted.vertices);
      compareDrawn((await inspect()).drawn, tilted.drawn, 'undo restores the frozen pose');
    }
    assert.deepEqual(errors, []);
    console.log('PASS frozen preview, frame selection, vertex picking, posed Move, Rotate and Resize with base-pose commits, exact undo, mouse orbit and quad switching');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
