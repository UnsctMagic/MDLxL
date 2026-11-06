// EMTR keeps the user's camera through edits, undo and redo (owner: "ctrl z resets viewpoint").
// Orbits the preview with a real mouse drag, rotates the emitter with its handle, then presses
// Ctrl+Z and Ctrl+Y: the preview rebuilds each time, and the camera must stay exactly where the user left it.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { launchApp, closeApp, clickMenu, settle, waitForInfo } = require('./helpers/app.cjs');
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'emtr-undo-camera', String(Date.now())); fs.mkdirSync(out, { recursive: true });
  const { createStarterRecipe } = await import('../src/particle-starters.js'), { generateCompatibleMdx } = await import('../src/mdx-compatibility.js');
  const model = createStarterRecipe().native, emitter = model.ParticleEmitters2[0];
  const fixture = path.join(out, 'undo-camera.mdx'); fs.writeFileSync(fixture, Buffer.from(generateCompatibleMdx(model)));
  const errors = []; let app;
  try {
    const launched = await launchApp({ out, fixture, errors, bounds: { x: -3000, y: 0, width: 1400, height: 920 } }); app = launched.app; const page = launched.page;
    await waitForInfo(page, 'Opened undo-camera.mdx');
    await clickMenu(app, 'Particle Editor…'); await page.getByLabel('Particle context', { exact: true }).waitFor();
    if (await page.getByRole('button', { name: 'Close Particle Library', exact: true }).count()) await page.getByRole('button', { name: 'Close Particle Library', exact: true }).click();
    await page.getByLabel('Particle context', { exact: true }).selectOption('On model');
    await page.getByLabel('Effect ingredient', { exact: true }).selectOption(String(emitter.ObjectId));
    await settle(page, 1500);
    const stage = page.locator('.pe-preview .game-preview-root').first();
    const camera = () => stage.evaluate(element => { const r = mdlxlProbe(element).runtime; return { runtime: (window.__runtimes ||= []).includes(r) ? window.__runtimes.indexOf(r) : window.__runtimes.push(r) - 1, position: r.controls.object.position.toArray(), target: r.controls.target.toArray() }; });
    const same = (a, b, label) => { for (const key of ['position', 'target']) a[key].forEach((v, i) => assert.ok(Math.abs(v - b[key][i]) < 1e-4, `${label}: camera ${key} kept (${a[key]} vs ${b[key]})`)); };
    // Orbit away from the fitted view with a real drag in an empty corner of the preview.
    const box = await stage.boundingBox(); const fitted = await camera();
    await page.mouse.move(box.x + 60, box.y + box.height - 60); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 60 + i * 18, box.y + box.height - 60 - i * 6);
    await page.mouse.up(); await settle(page, 300);
    const orbited = await camera();
    assert.ok(orbited.position.some((v, i) => Math.abs(v - fitted.position[i]) > 1e-3), 'the drag orbits the camera');
    // A real edit: turn the emitter with its Rotate Z handle.
    const handle = page.getByRole('slider', { name: 'Rotate Z', exact: true }); await handle.waitFor();
    const [x1, y1, x2, y2] = await handle.locator('line').evaluate(l => ['x1', 'y1', 'x2', 'y2'].map(k => Number(l.getAttribute(k))));
    const svg = await handle.evaluate(el => { const b = el.ownerSVGElement.getBoundingClientRect(); return { x: b.x, y: b.y }; });
    const length = Math.hypot(x2 - x1, y2 - y1) || 1, x = svg.x + x1 + (x2 - x1) * .6, y = svg.y + y1 + (y2 - y1) * .6;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x - (y2 - y1) / length * 4 * i, y + (x2 - x1) / length * 4 * i);
    await page.mouse.up(); await settle(page, 800);
    const edited = await camera(); same(edited, orbited, 'after the edit');
    for (const [key, label] of [['Control+z', 'after undo'], ['Control+y', 'after redo'], ['Control+z', 'after a second undo']]) {
      await page.keyboard.press(key); await settle(page, 1200);
      const now = await camera(); same(now, orbited, label);
    }
    assert.ok((await camera()).runtime > 0, 'undo rebuilt the preview, so the check covers a rebuild');
    assert.deepEqual(errors, []);
    console.log('EMTR keeps the camera through edit, undo and redo');
  } catch (error) { if (app) { const page = await app.firstWindow(); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); } throw error; }
  finally { if (app) await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
