const { launchApp, closeApp, clickMenu } = require('./helpers/app.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
// After a handle drag the preview still remembers the dragged value. A ribbon field must
// clear that, or the preview sees "nothing changed" and keeps showing the old trail.
(async () => {
  const out = path.join(process.cwd(), 'out', 'ribbon-live-edit-' + Date.now()); fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js'), { createStarterRecipe } = await import('../src/particle-starters.js'), { placeParticleRecipe } = await import('../src/particle-recipes.js'), { generateCompatibleMdx } = await import('../src/mdx-compatibility.js');
  const doc = createDemoDocument(); placeParticleRecipe(doc.model, createStarterRecipe('ribbon'), { position: [0, 100, 50] });
  const fixture = path.join(out, 'ribbon.mdx'); fs.writeFileSync(fixture, Buffer.from(generateCompatibleMdx({ ...doc.model, BindPoses: undefined })));
  const { app, page } = await launchApp({ fixture, out, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 15000 });
  try {
    await page.waitForFunction(() => /ribbon/i.test(document.title));
    await clickMenu(app, 'Particle Editor…');
    const context = page.getByLabel('Particle context', { exact: true }); await context.waitFor(); await page.waitForTimeout(800);
    const library = page.getByRole('button', { name: 'Close Particle Library', exact: true }); if (await library.count()) await library.click();
    await context.selectOption('On model');
    const effect = page.getByLabel('Effect ingredient', { exact: true });
    await effect.selectOption(await effect.evaluate(select => [...select.options].find(option => /ribbon/i.test(option.textContent)).value));
    await page.waitForTimeout(500);
    const liveField = () => page.evaluate(() => { for (const element of document.querySelectorAll('.pe-window *')) { let f = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))]; for (; f; f = f.return) if (f.memoizedProps && 'particleLiveField' in f.memoizedProps) return f.memoizedProps.particleLiveField ?? null; } throw Error('Preview not found'); });
    const handle = page.locator('svg[aria-label="Particle stage handles"] circle').first(), box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 6, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(400);
    assert.notEqual(await liveField(), null, 'The handle drag names the value it changed');
    const smoothness = page.getByRole('spinbutton', { name: 'Ribbon smoothness', exact: true });
    await smoothness.fill('12'); await smoothness.press('Enter'); await page.waitForTimeout(300);
    assert.equal(await liveField(), null, 'A ribbon field makes the preview rebuild the trail');
    const play = page.getByRole('button', { name: 'Play', exact: true }).first(); if (await play.count()) await play.click();
    await smoothness.fill('20'); await smoothness.press('Enter'); await page.waitForTimeout(300);
    assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).count() > 0, true, 'Editing a ribbon field keeps the animation playing');
    console.log('Ribbon fields rebuild the live trail after a handle drag and keep playback running');
  } finally { await closeApp(app); fs.rmSync(out, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exit(1); });
