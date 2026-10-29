const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Perspective wheel zoom in the real app: node test/perspective-zoom.electron.cjs
// (MDLXL_TEST_EXE runs a packaged MDLxL.exe; otherwise the built dist/ under Electron.)
// Zooming out must back the camera away instead of widening the lens: a 170-degree
// lens stretched nearby legs and the grid toward the screen edges.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const out = path.resolve('out/perspective-zoom'); fs.mkdirSync(out, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(out, 'perspective-zoom.mdx'); fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  const packaged = process.env.MDLXL_TEST_EXE, errors = [];
  const app = (await launchApp({ out: path.resolve('out'), profile: path.join(out, 'profile-' + Date.now()), args: (['--disable-backgrounding-occluded-windows', ...(packaged ? [] : [process.cwd()]), fixture]).filter(arg => arg !== path.resolve(__dirname, '..') && arg !== '--disable-backgrounding-occluded-windows'), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000 })).app;
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setBounds({ x: -3000, y: 0, width: 1400, height: 900 }); window.showInactive(); });
    const viewport = page.getByLabel('3D model viewport', { exact: true }); await viewport.waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.viewportState = () => {
        const host = document.querySelector('[aria-label="3D model viewport"]');
        
        { const value = findFiberState(host, value => value?.renderer && value?.entries); if (value?.renderer && value?.entries) return value; }

        throw Error('Viewport runtime not found');
      };
    });
    await page.waitForFunction(() => { try { return viewportState().entries.length > 0; } catch { return false; } });
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await settlePage(page, 300);
    const camera = () => page.evaluate(() => {
      const { camera, controls } = viewportState(), direction = camera.position.clone().sub(controls.target).normalize();
      return { perspective: camera.isPerspectiveCamera, zoom: camera.zoom, distance: camera.position.distanceTo(controls.target), direction: direction.toArray() };
    });
    const box = await viewport.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const wheel = async notches => { await page.mouse.move(x, y); for (let i = 0; i < Math.abs(notches); i++) { await page.mouse.wheel(0, Math.sign(notches) * 100); await settlePage(page, 20); } await settlePage(page, 200); };
    const fitted = await camera(); assert.ok(fitted.perspective); assert.equal(fitted.zoom, 1);

    await wheel(20);
    const zoomedOut = await camera();
    assert.equal(zoomedOut.zoom, 1, 'zooming out keeps the normal lens');
    assert.ok(zoomedOut.distance > fitted.distance * 5, `camera backed away (${fitted.distance} -> ${zoomedOut.distance})`);

    // Camera rotation keeps working with a real mouse drag (W toggles camera rotation).
    await viewport.focus(); await page.keyboard.press('w');
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 200, y + 50, { steps: 12 }); await page.mouse.up(); await settlePage(page, 200);
    await page.keyboard.press('w');
    const rotated = await camera(), turned = Math.acos(Math.min(1, rotated.direction.reduce((sum, value, axis) => sum + value * zoomedOut.direction[axis], 0)));
    assert.ok(turned > .3, `mouse drag rotates the camera (${turned} rad)`);
    assert.ok(Math.abs(rotated.distance - zoomedOut.distance) < zoomedOut.distance * 1e-4, 'rotation keeps the distance');

    await wheel(-20);
    const back = await camera();
    assert.ok(Math.abs(back.distance - fitted.distance) < fitted.distance * 1e-4 && Math.abs(back.zoom - 1) < 1e-6, 'zooming back in returns to the fitted view');
    await wheel(-6);
    const zoomedIn = await camera();
    assert.ok(zoomedIn.zoom > 1.5 && Math.abs(zoomedIn.distance - fitted.distance) < fitted.distance * 1e-4, 'zooming in narrows the lens without moving into the mesh');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ fitted: fitted.distance, zoomedOut: zoomedOut.distance, turned, zoomedIn: zoomedIn.zoom }));
  } finally {
    await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 8000))]);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
