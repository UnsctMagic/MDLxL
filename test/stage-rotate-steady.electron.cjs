// EMTR rotate handles stay steady during a real rotate drag (owner: "when I rotate the gizmo
// flickers"). Records the rotate gizmo every frame at full frame rate: it must never be blank,
// zero-sized or remounted, and never show a one-frame twitch. The animation holds its frame while the
// handle is dragged (owner: "keep the frame so it's easier to align") and plays on afterwards. Before the fix the per-frame
// redraw used the first render's size and state: 25-33 one-frame twitches per drag.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { launchApp, closeApp, clickMenu, settle, waitForInfo } = require('./helpers/app.cjs');
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'stage-rotate-steady', String(Date.now())); fs.mkdirSync(out, { recursive: true });
  const { createStarterRecipe } = await import('../src/particle-starters.js'), { generateCompatibleMdx } = await import('../src/mdx-compatibility.js');
  const model = createStarterRecipe().native, emitter = model.ParticleEmitters2[0];
  const fixture = path.join(out, 'steady.mdx'); fs.writeFileSync(fixture, Buffer.from(generateCompatibleMdx(model)));
  const errors = []; let app;
  try {
    // Real frame rate on the hidden desktop, so every frame of the drag is seen.
    const launched = await launchApp({ out, fixture, errors, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'], bounds: { x: -3000, y: 0, width: 1400, height: 920 } }); app = launched.app; const page = launched.page;
    await waitForInfo(page, 'Opened steady.mdx');
    await page.evaluate(async () => { const s = await window.desktop.getSettings(); await window.desktop.configure({ preferences: { ...s.preferences, graphics: { ...s.preferences.graphics, pauseWhenHidden: false } } }); });
    await clickMenu(app, 'Particle Editor…'); await page.getByLabel('Particle context', { exact: true }).waitFor();
    if (await page.getByRole('button', { name: 'Close Particle Library', exact: true }).count()) await page.getByRole('button', { name: 'Close Particle Library', exact: true }).click();
    await page.getByLabel('Particle context', { exact: true }).selectOption('On model');
    await page.getByLabel('Effect ingredient', { exact: true }).selectOption(String(emitter.ObjectId));
    await settle(page, 1500); await page.getByRole('button', { name: 'Fit view', exact: true }).click(); await settle(page, 1000);
    const handle = page.getByRole('slider', { name: 'Rotate Z', exact: true }); await handle.waitFor();
    await page.evaluate(() => {
      window.__frames = []; let id = 0; const ids = new WeakMap();
      const tick = () => { const c = document.querySelector('canvas.pe-rotate-gizmo'); let painted = 0;
        if (c) { if (!ids.has(c)) ids.set(c, ++id); if (c.width && c.height) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i]) painted++; } }
        window.__frames.push({ canvas: c ? ids.get(c) : 0, size: c ? c.width * c.height : 0, painted });
        if (window.__frames.length < 5000) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const clip = () => page.locator('.pe-preview .game-preview-root').first().evaluate(element => { const p = mdlxlProbe(element).props; return { playing: !!p.playing, time: p.time }; });
    assert.equal((await clip()).playing, true, 'the effect plays before the drag');
    const [x1, y1, x2, y2] = await handle.locator('line').evaluate(l => ['x1', 'y1', 'x2', 'y2'].map(k => Number(l.getAttribute(k))));
    const box = await handle.evaluate(el => { const b = el.ownerSVGElement.getBoundingClientRect(); return { x: b.x, y: b.y }; });
    const length = Math.hypot(x2 - x1, y2 - y1) || 1, x = box.x + x1 + (x2 - x1) * .6, y = box.y + y1 + (y2 - y1) * .6;
    await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(150); const held = await clip(); const from = await page.evaluate(() => window.__frames.length);
    for (let i = 1; i <= 40; i++) { await page.mouse.move(x - (y2 - y1) / length * 3 * i, y + (x2 - x1) / length * 3 * i); await page.waitForTimeout(40); }
    const to = await page.evaluate(() => window.__frames.length); const still = await clip(); await page.mouse.up(); await page.waitForTimeout(500);
    assert.equal(held.playing, false, 'the animation holds while the handle is dragged'); assert.equal(still.time, held.time, 'the frame stays put for the whole drag');
    assert.equal((await clip()).playing, true, 'the animation plays on after the drag');
    const frames = (await page.evaluate(() => window.__frames)).slice(from, to);
    assert.ok(frames.length > 60, 'enough frames were recorded: ' + frames.length);
    assert.equal(new Set(frames.map(f => f.canvas)).size, 1, 'the gizmo is never rebuilt during a drag');
    assert.ok(frames.every(f => f.canvas && f.size > 0 && f.painted > 0), 'the gizmo is never blank or zero-sized during a drag');
    let twitches = 0; for (let i = 1; i < frames.length - 1; i++) if (frames[i].painted - frames[i - 1].painted > 15 && frames[i].painted - frames[i + 1].painted > 15) twitches++;
    assert.equal(twitches, 0, 'no one-frame twitches during a drag');
    assert.deepEqual(errors, []);
    console.log(`Rotate gizmo steady over ${frames.length} drag frames`);
  } catch (error) { if (app) { const page = await app.firstWindow(); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); } throw error; }
  finally { if (app) await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
