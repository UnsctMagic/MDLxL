const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

// Real mouse input on the packaged app. The probes only read the rendered
// resources, live UVs and cameras; they never drive editor state.
(async () => {
  const out = path.resolve(process.env.MDLXL_UV_DRAG_OUT || 'out/uv-drag-smooth');
  fs.mkdirSync(out, { recursive: true });
  const checks = [], measurements = [], errors = [];
  const check = (label, pass, detail) => {
    checks.push({ label, pass: !!pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${label}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`);
  };
  const settings = { preferences: { pointerSensitivity: .82, scrollSensitivity: 2.5,
    graphics: { pauseWhenHidden: false, maxFps: 60, particles: false } } };
  for (const name of ['footman', 'optimizexl-review']) {
    const fixture = fixturePath(name);
    assert.ok(fs.existsSync(fixture), `Required permanent fixture: ${fixture}`);
    const { app, page } = await launchApp({ out, fixture, settings, errors, show: 'inactive',
      args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
      bounds: { x: 0, y: 0, width: 1440, height: 1000 } });
    try {
      const mainCanvas = page.locator('.classic-view > .viewport [aria-label="3D model viewport"]');
      await mainCanvas.waitFor();
      await page.locator('[data-hotkey="geosetsAll"]').click();
      await mainCanvas.click();
      await page.keyboard.press('Control+a');
      await page.locator('[data-hotkey="uv"]').click();
      const uv = page.locator('.uv-tab-window');
      const canvas = uv.locator('.uv-editor canvas');
      await canvas.waitFor();
      await page.evaluate(() => {
        window.uvDragRead = () => {
          const main = findFiberState('.classic-view > .viewport', v => v?.modelGroup && v?.entries && v?.controls);
          const preview = mdlxlProbe('.uv-tab-window .game-preview-root').runtime;
          const editor = findFiberState('.uv-editor', v => v?.uv && v?.draw);
          const props = findFiberProps('.uv-editor', p => p?.geoset && p?.onSelectVertices);
          const mainProps = findFiberProps('.classic-view > .viewport', p => p?.model?.Geosets);
          // OrbitControls round-trips spherical coordinates (~1e-12 noise on a resting camera).
          const rounded = values => values.map(value => Math.round(value * 1e9) / 1e9);
          const camera = state => ({ position: rounded(state.controls.object.position.toArray()), target: rounded(state.controls.target.toArray()), zoom: Math.round(state.controls.object.zoom * 1e9) / 1e9 });
          return { main, preview, editor, props, mainProps, camera };
        };
        window.uvDragSnapshot = () => {
          const { main, preview, editor, mainProps, camera } = uvDragRead();
          return { geometry: main.entries.map(e => e.geometry.uuid), materials: main.entries.map(e => e.meshes.map(m => m.material.uuid)),
            uv: Array.from(editor.uv), documentUV: window.__mdlxl.session().doc.model.Geosets.map(g => g.TVertices.map(v => Array.from(v))),
            mainUV: main.entries.map(e => e.meshes.map(m => Array.from(m.geometry.attributes.uv.array))),
            baseUV: main.entries.map(e => e.meshes.map(m => Array.from(m.userData.baseUV))),
            previewUV: preview.native.model.Geosets.map(g => Array.from(g.TVertices[0])),
            expected: mainProps.model.Geosets.map(g => g.TVertices.map(v => Array.from(v))),
            mainCamera: camera(main), previewCamera: camera(preview) };
        };
      });
      await page.waitForFunction(() => uvDragRead().preview?.native && uvDragRead().props.selectedVertices.length > 0);
      const previewCanvas = uv.locator('canvas[data-clean-model-canvas]');
      const box = await canvas.boundingBox();
      for (const tool of ['Move', 'Rotate']) {
        await uv.getByRole('button', { name: tool, exact: true }).click();
        const beforePixels = await previewCanvas.screenshot();
        const before = await page.evaluate(() => uvDragSnapshot());
        const x = box.x + box.width * .65, y = box.y + box.height * .5;
        await page.mouse.move(x, y); await page.mouse.down();
        await page.evaluate(() => {
          window.uvDragFrames = { times: [], geometries: new Set(), active: true };
          const sample = time => {
            if (!uvDragFrames.active) return;
            uvDragFrames.times.push(time);
            const main = uvDragRead().main;
            uvDragFrames.geometries.add(main.entries.map(e => e.geometry.uuid).join(','));
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        for (let step = 1; step <= 24; step++) {
          await page.mouse.move(x + 65 * step / 24, y + 40 * Math.sin(step / 24 * Math.PI / 2));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        }
        await page.waitForFunction(old => JSON.stringify(uvDragSnapshot().previewUV) !== old, JSON.stringify(before.previewUV));
        const held = await page.evaluate(() => uvDragSnapshot());
        const heldPixels = await previewCanvas.screenshot();
        const measurement = await page.evaluate(() => {
          uvDragFrames.active = false;
          const gaps = uvDragFrames.times.slice(1).map((t, i) => t - uvDragFrames.times[i]).sort((a,b) => a-b);
          return { frames: gaps.length, p50: gaps[Math.floor(gaps.length * .5)], p95: gaps[Math.floor(gaps.length * .95)], max: gaps.at(-1), geometryGenerations: uvDragFrames.geometries.size };
        });
        measurements.push({ model: name, tool, ...measurement });
        fs.writeFileSync(path.join(out, `${name}-${tool}-map.png`), await canvas.screenshot());
        check(`${name} ${tool}: model pixels update before release`, !beforePixels.equals(heldPixels));
        check(`${name} ${tool}: live preview UVs update before release`, JSON.stringify(held.previewUV) !== JSON.stringify(before.previewUV));
        check(`${name} ${tool}: document is unchanged while held`, JSON.stringify(held.documentUV) === JSON.stringify(before.documentUV));
        check(`${name} ${tool}: main geometry and materials stay allocated throughout drag`,
          JSON.stringify(held.geometry) === JSON.stringify(before.geometry) && JSON.stringify(held.materials) === JSON.stringify(before.materials) && measurement.geometryGenerations === 1, measurement);
        const renderMatches = await page.evaluate(() => {
          const { main, mainProps, preview } = uvDragRead();
          return main.entries.every((e, i) => e.meshes.every((mesh, k) => {
            const g = mainProps.model.Geosets[i], values = g.TVertices[e.layers[k].CoordId || 0] || g.TVertices[0];
            return values.every((v, j) => Math.abs(v - mesh.geometry.attributes.uv.array[j]) < 1e-6 && Math.abs(v - mesh.userData.baseUV[j]) < 1e-6);
          })) && mainProps.model.Geosets.every((g, i) => g.TVertices[0].every((v, j) => Math.abs(v - preview.native.model.Geosets[i].TVertices[0][j]) < 1e-6));
        });
        check(`${name} ${tool}: both renderers contain current UV values`, renderMatches);
        check(`${name} ${tool}: cameras stay unchanged`, JSON.stringify([held.mainCamera,held.previewCamera]) === JSON.stringify([before.mainCamera,before.previewCamera]), { before: [before.mainCamera,before.previewCamera], after: [held.mainCamera,held.previewCamera] });
        await page.mouse.up();
        await page.waitForFunction(old => JSON.stringify(uvDragSnapshot().documentUV) !== old, JSON.stringify(before.documentUV));
        const committed = await page.evaluate(() => uvDragSnapshot());
        check(`${name} ${tool}: release commits the last held values`, JSON.stringify(committed.uv) === JSON.stringify(held.uv));
        await page.keyboard.press('Control+z');
        await page.waitForFunction(old => JSON.stringify(uvDragSnapshot().documentUV) === old, JSON.stringify(before.documentUV));
        await page.waitForFunction(old => JSON.stringify(uvDragSnapshot().previewUV) === old, JSON.stringify(before.previewUV));
        check(`${name} ${tool}: undo restores both views`, JSON.stringify((await page.evaluate(() => uvDragSnapshot())).mainUV) === JSON.stringify(before.mainUV));
      }
      // Escape cancels the preview while the mouse remains held.
      await uv.getByRole('button', { name: 'Move', exact: true }).click();
      const beforeCancel = await page.evaluate(() => uvDragSnapshot());
      await page.mouse.move(box.x + box.width*.5, box.y + box.height*.5); await page.mouse.down();
      await page.mouse.move(box.x + box.width*.5+45, box.y + box.height*.5+15, { steps: 8 });
      await page.waitForFunction(old => JSON.stringify(uvDragSnapshot().previewUV) !== old, JSON.stringify(beforeCancel.previewUV));
      await page.keyboard.press('Escape'); await page.mouse.up();
      await page.waitForFunction(old => JSON.stringify(uvDragSnapshot().previewUV) === old, JSON.stringify(beforeCancel.previewUV));
      check(`${name}: Escape restores live UVs without a commit`, JSON.stringify((await page.evaluate(() => uvDragSnapshot())).documentUV) === JSON.stringify(beforeCancel.documentUV));
      // The existing left-button orbit must still work.
      const cameraBefore = await page.evaluate(() => uvDragSnapshot().previewCamera);
      const pb = await previewCanvas.boundingBox();
      await page.mouse.move(pb.x+pb.width*.5,pb.y+pb.height*.5); await page.mouse.down();
      await page.mouse.move(pb.x+pb.width*.7,pb.y+pb.height*.6,{steps:12}); await page.mouse.up();
      await page.waitForFunction(old => JSON.stringify(uvDragSnapshot().previewCamera) !== old, JSON.stringify(cameraBefore));
      check(`${name}: live preview rotates with normal mouse drag`, true);
    } finally { await closeApp(app); }
  }
  check('no renderer errors', errors.length === 0, errors);
  fs.writeFileSync(path.join(out,'result.json'), JSON.stringify({checks,measurements,errors},null,2));
  assert.equal(checks.filter(c => !c.pass).length, 0, 'UV drags must keep both previews live without rebuilding geometry');
})().catch(error => { console.error(error); process.exitCode = 1; });
