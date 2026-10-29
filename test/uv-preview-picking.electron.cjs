// Run against the rebuilt bundle: node test/uv-preview-picking.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
// Camera quaternions are recomputed every frame; ignore floating-point noise far below any visible rotation.
const assertSameCamera = (actual, expected, message) => assert.ok(actual.every((value, index) => Math.abs(value - expected[index]) < 1e-9), message + ': ' + JSON.stringify({ actual, expected }));

(async () => {
  const output = path.resolve('out/uv-preview-picking'); fs.mkdirSync(output, { recursive: true });
  const fixture = path.resolve('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const geosetIndex = 15;
  const original = fs.readFileSync(fixture);
  const { app, page: launchedPage } = await launchApp({ fixture, out: output, pageTimeout: 15000, bounds: { x: -3000, y: 0, width: 1440, height: 1000 } });
  let uv;
  try {
    const page = launchedPage;
    await page.getByLabel(`Select geoset ${geosetIndex}`, { exact: true }).waitFor({ timeout: 60000 });
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel(`Select geoset ${geosetIndex}`, { exact: true }).check();
    await page.locator('[aria-label="3D model viewport"]').click();
    await page.keyboard.press('Control+a');
    const uvw = page.locator('.uv-tab-window'); // in-app dialog of the main window since f7316110
    await page.locator('[data-hotkey="uv"]').click(); uv = page;
    const toggle = uvw.getByRole('button', { name: 'Live Select', exact: true });
    await toggle.waitFor();
    await uvw.locator('[data-clean-model-canvas]').waitFor({ timeout: 60000 });
    await uv.evaluate(() => {
      window.uvState = () => {
        const props = findFiberProps('.uv-workspace', props => !!props.eligibleSelection);
        if (!props) throw Error('UV workspace props unavailable');
        return props;
      };
      window.previewState = () => mdlxlProbe('.uv-tab-window .game-preview-root').runtime;
      window.uvMapSelection = () => {
        const props = findFiberProps('.uv-map-pane canvas', props => props.geoset?.TVertices && props.selectedVertices);
        if (!props) throw Error('UV map selection unavailable');
        return props.selectedVertices;
      };
      window.previewProps = () => {
        const props = findFiberState('.uv-tab-window .game-preview-root', value => value.previewSelectionMode);
        if (!props) throw Error('Preview props unavailable');
        return props;
      };
      window.pickLocations = () => {
        const canvas = document.querySelector('.uv-tab-window [data-clean-model-canvas]'), rect = canvas.getBoundingClientRect();
        const geoset = uvState().model.Geosets[15], camera = previewState().controls.object;
        const Vector3 = camera.position.constructor;
        const points = Array.from({ length: geoset.Vertices.length / 3 }, (_, index) => {
          const projected = new Vector3().fromArray(geoset.Vertices, index * 3).project(camera);
          return { x: (projected.x + 1) * rect.width / 2, y: (1 - projected.y) * rect.height / 2, z: projected.z };
        });
        const faces = [];
        for (let offset = 0; offset < geoset.Faces.length; offset += 3) {
          const ids = Array.from(geoset.Faces.slice(offset, offset + 3));
          const center = { x: ids.reduce((sum, id) => sum + points[id].x, 0) / 3, y: ids.reduce((sum, id) => sum + points[id].y, 0) / 3, z: ids.reduce((sum, id) => sum + points[id].z, 0) / 3 };
          const a = points[ids[0]], b = points[ids[1]], c = points[ids[2]], area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
          if (area > 10 && center.x > 10 && center.x < rect.width - 10 && center.y > 10 && center.y < rect.height - 10) faces.push({ ids, ...center, area });
        }
        faces.sort((a, b) => a.z - b.z || b.area - a.area);
        return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, faces, points };
      };
      // Client coordinates of a face centre / vertex in the preview's current layout.
      window.faceClientPoint = ids => { const { rect, points } = pickLocations(), corners = ids.map(id => points[id]); return { x: rect.x + corners.reduce((sum, p) => sum + p.x, 0) / 3, y: rect.y + corners.reduce((sum, p) => sum + p.y, 0) / 3 }; };
      window.vertexClientPoint = index => { const { rect, points } = pickLocations(); return { x: rect.x + points[index].x, y: rect.y + points[index].y }; };
    });
    await uv.waitForFunction(() => uvState().selectionByGeoset[15]?.length === 248);
    const before = await uv.evaluate(() => JSON.stringify(uvState().model));
    const selectedOnly = uvw.getByRole('button', { name: 'Selected Only', exact: true });
    assert.equal(await selectedOnly.getAttribute('aria-pressed'), 'false');
    assert.equal(await uv.evaluate(() => uvState().preferences.visuals.uvSelection), '#4cff59');
    assert.equal(await uv.evaluate(() => uvState().preferences.uvPreviewDisplay.size), .25);
    assert.ok((await uv.evaluate(() => pickLocations())).faces.length, 'Normal Warcraft model polygons must be large enough to pick on first open');
    const canvas = uvw.locator('[data-clean-model-canvas]'), box = await canvas.boundingBox();
    const cameraBefore = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    await uv.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'idle polygon selection uses the normal pointer');
    await uv.mouse.down(); await uv.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
    assert.match(await canvas.evaluate(element => element.style.cursor), /data:image\/svg\+xml/, 'polygon mode shows the rotate pointer during a rotation drag');
    await uv.mouse.up();
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'releasing a rotation restores the normal pointer');
    const cameraAfter = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    assert.notDeepEqual(cameraAfter, cameraBefore, 'dragging the preview must rotate the camera');
    assert.equal(await uv.evaluate(() => uvState().selectionByGeoset[15]?.length), 248, 'camera drag must not change UV selection');
    const zoomBefore = await uv.evaluate(() => previewState().controls.object.zoom);
    await uv.mouse.wheel(0, -250);
    await uv.waitForFunction(value => previewState().controls.object.zoom !== value, zoomBefore);
    const moveTool = uvw.getByRole('button', { name: 'Move', exact: true });
    await moveTool.click();
    const mapBox = await uvw.locator('.uv-map-pane canvas').first().boundingBox();
    await uv.mouse.move(mapBox.x + 20, mapBox.y + 20);
    await uv.keyboard.down('a'); await uv.keyboard.up('a');
    assert.equal(await uvw.getByRole('button', { name: 'Select', exact: true }).getAttribute('aria-pressed'), 'true', 'A over the UV map restores the Select tool');
    // The UV dialog can still reflow while its material texture finishes loading (a transient
    // "not loaded" notice above the map disappears), which moves the Live Preview canvas on a
    // slow/software GPU. Choose faces and vertices once, but project them in the current layout
    // right before every click instead of reusing screen positions captured earlier.
    const location = await uv.evaluate(() => pickLocations());
    const facePoint = face => uv.evaluate(ids => faceClientPoint(ids), face.ids);
    const canvasCenter = async () => { const rect = await canvas.boundingBox(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; };
    assert.ok(location.faces.length, 'Projected Warcraft model polygons must be visible');
    let pickedFace = null;
    const firstFace = location.faces[0];
    let face0 = await facePoint(firstFace);
    await uv.mouse.click(face0.x, face0.y);
    assert.equal(await uv.evaluate(() => uvState().selectionByGeoset[15]?.length), 248, 'ordinary preview clicks leave UV selection unchanged');
    await moveTool.click();
    face0 = await facePoint(firstFace);
    await uv.mouse.move(face0.x, face0.y);
    assert.equal(await uv.evaluate(() => document.querySelector('.uv-workspace-body').dataset.pointerRegion), 'preview', 'pointer is over Live Preview');
    await uv.keyboard.down('a');
    assert.equal(await moveTool.getAttribute('aria-pressed'), 'true', 'A over Live Preview keeps the UV map tool');
    const clickCamera = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    for (const face of location.faces.slice(0, 100)) {
      if (pickedFace) break;
      const point = await facePoint(face);
      await uv.mouse.click(point.x, point.y);
      if (await uv.evaluate(() => uvState().selectionByGeoset[15]?.length === 3)) { pickedFace = face; break; }
    }
    assert.ok(pickedFace, 'holding A selects model polygons while other geosets remain visible');
    assertSameCamera(await uv.evaluate(() => previewState().controls.object.quaternion.toArray()), clickCamera, 'A selection must not rotate the camera');
    await uv.keyboard.up('a');
    await uv.waitForFunction(() => uvMapSelection().length === 3);
    const selectedWithA = await uv.evaluate(() => JSON.stringify(uvState().selectionByGeoset));
    face0 = await facePoint(firstFace);
    await uv.mouse.click(face0.x, face0.y);
    assert.equal(await uv.evaluate(() => JSON.stringify(uvState().selectionByGeoset)), selectedWithA, 'releasing A returns clicks to camera control');
    assert.equal(await selectedOnly.getAttribute('aria-pressed'), 'false');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await uvw.getByLabel('Highlight selected vertices in live preview').check();
    await uvw.getByLabel('Live selection and texture-frame color').fill('#33cc66');
    const thickness = uvw.getByLabel('Live selection thickness');
    await thickness.focus(); await thickness.press('ArrowUp');
    await uv.waitForFunction(() => previewProps().previewOverlay.color === '#33cc66' && previewProps().previewOverlay.size === .5);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await uv.waitForFunction(() => previewProps().previewSelectionMode === 'vertices');
    await uv.waitForFunction(() => {
      const canvas = document.querySelector('.uv-tab-window [data-geometry-overlay]');
      if (!canvas) return false;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] === 51 && pixels[offset + 1] === 204 && pixels[offset + 2] === 102 && pixels[offset + 3]) return true;
      return false;
    });
    let center = await canvasCenter();
    await uv.mouse.move(center.x, center.y);
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'idle Live Select uses the normal pointer');
    assert.equal(await uv.evaluate(() => previewProps().previewSelectionMode), 'vertices');
    assert.equal(await uv.evaluate(() => previewProps().previewOverlay.color), '#33cc66');
    assert.equal(await uv.evaluate(() => previewProps().previewOverlay.size), .5);
    const firstVertex = await uv.evaluate(() => { const { rect, points } = pickLocations(); return points.findIndex(point => point.x > 10 && point.x < rect.width - 10 && point.y > 10 && point.y < rect.height - 10 && point.z >= -1 && point.z <= 1); });
    assert.ok(firstVertex >= 0, 'A selectable Warcraft model vertex is on screen');
    const { x: vertexX, y: vertexY } = await uv.evaluate(index => vertexClientPoint(index), firstVertex);
    await uv.mouse.move(vertexX, vertexY);
    await uv.keyboard.down('a');
    await uv.mouse.move(vertexX, vertexY); await uv.mouse.down();
    const vertexCamera = await uv.evaluate(() => previewState().controls.object.quaternion.toArray());
    await uv.mouse.move(vertexX + 3, vertexY + 1);
    assertSameCamera(await uv.evaluate(() => previewState().controls.object.quaternion.toArray()), vertexCamera, 'A vertex selection must not rotate the camera');
    await uv.mouse.up();
    await uv.keyboard.up('a');
    assert.equal(await uv.evaluate(() => uvState().selectionByGeoset[15]?.length), 1, 'holding A selects a model vertex on the UV map');
    await uv.waitForFunction(() => uvMapSelection().length === 1);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    const picked = await facePoint(pickedFace);
    await uv.mouse.move(picked.x, picked.y);
    await uv.keyboard.down('a');
    await uv.mouse.click(picked.x, picked.y);
    await uv.keyboard.up('a');
    await uv.waitForFunction(() => uvState().selectionByGeoset[15]?.length === 3);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    center = await canvasCenter();
    await uv.mouse.move(center.x, center.y);
    await uv.mouse.down(); await uv.mouse.move(center.x + 30, center.y + 20, { steps: 3 });
    assert.match(await canvas.evaluate(element => element.style.cursor), /data:image\/svg\+xml/, 'Live Select shows the rotate pointer during a rotation drag');
    await uv.mouse.up();
    assert.equal(await canvas.evaluate(element => element.style.cursor), 'default', 'Live Select restores the normal pointer after rotation');
    assert.equal(await uv.evaluate(() => JSON.stringify(uvState().model)), before);
    assert.ok(fs.readFileSync(fixture).equals(original));
    console.log('PASS Electron UV: A switches the texture map to Select and selects only in Live View when the pointer is there; camera controls, vertex markers, shared highlight, and model data remain intact');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
