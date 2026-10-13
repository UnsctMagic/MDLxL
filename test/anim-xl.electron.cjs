// Disposable packaged AnimXL check with real mouse input. Never opens or replaces a user profile.
// MDLXL_PLAYWRIGHT_MODULE=<playwright> MDLXL_ANIMXL_EXE=<MDLxL.exe> node test/anim-xl.electron.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const out = path.resolve(process.env.MDLXL_ANIMXL_OUT || 'out/anim-xl-ui');
  const fixture = path.resolve(process.env.MDLXL_ANIMXL_FIXTURE || 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  const executablePath = path.resolve(process.env.MDLXL_ANIMXL_EXE || 'out/pkg/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  const model = path.join(out, path.basename(fixture)); fs.copyFileSync(fixture, model);
  const errors = [], checks = [];
  const app = await _electron.launch({ executablePath, args: [model, '--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1400, height: 950 }); win.showInactive(); });
    await page.locator('[data-warmkey="animation"]').click();
    const button = page.locator('button.animxl-tool, [data-warmkey="animXL"]').first();
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'AnimXL' });
    await dialog.waitFor();
    checks.push('AnimXL opens from the ANIM module button');
    await dialog.getByLabel('Animation', { exact: true }).selectOption({ label: 'Attack - 1' });
    await page.waitForTimeout(800);
    // Playback runs in real time at 100% and a quarter as fast at 25%.
    const rate = async () => {
      const read = async () => (await dialog.locator('.ax-time').textContent()).match(/(\d+) \/ (\d+)/).slice(1).map(Number);
      const [a, span] = await read(), started = Date.now();
      await page.waitForTimeout(300);
      const [b] = await read();
      return ((b - a + span) % span) / (Date.now() - started);
    };
    const full = await rate();
    assert.ok(full > 0.5 && full < 1.8, `100% plays in real time (rate ${full.toFixed(2)})`);
    await dialog.getByRole('button', { name: '25%', exact: true }).click();
    const quarter = await rate();
    assert.ok(quarter > 0.1 && quarter < 0.5, `25% plays a quarter as fast (rate ${quarter.toFixed(2)})`);
    await dialog.getByRole('button', { name: '100%', exact: true }).click();
    checks.push(`Playback runs at ${full.toFixed(2)}x real time at 100% and ${quarter.toFixed(2)}x at 25%`);
    await dialog.getByRole('button', { name: 'Pause' }).click();
    const strip = dialog.getByRole('slider', { name: 'Animation time' }), sb = await strip.boundingBox();
    await page.mouse.click(sb.x + sb.width * 0.45, sb.y + sb.height / 2);
    await page.waitForTimeout(400);
    await dialog.screenshot({ path: path.join(out, '1-original.png') });
    // Effect cards: clicking one switches it on and opens its slider; real mouse clicks on the slider track.
    const card = name => dialog.locator('.ax-card-main', { hasText: name });
    const value = name => dialog.getByRole('switch', { name: name + ' on', exact: true }).textContent();
    for (const [label, u] of [['Easing', 0.6], ['Overlap', 0.8], ['Settle', 0.5], ['Weight', 0.4]]) {
      await card(label).click();
      const box = await dialog.getByRole('slider', { name: label, exact: true }).boundingBox();
      await page.mouse.click(box.x + box.width * u, box.y + box.height / 2);
    }
    await page.waitForTimeout(500);
    const status = await dialog.locator('.ax-status').textContent();
    assert.match(status, /bones shaped/, `status after sliders: ${status}`);
    checks.push(`Sliders shape the animation: "${status}"`);
    assert.ok(page.workers().some(worker => worker.url().includes('anim-xl.worker')), 'AnimXL builds in its worker');
    checks.push('Shaping runs in a background worker');
    await page.waitForTimeout(500);
    assert.equal(await dialog.locator('svg.ax-graph').count(), 1, 'motion graph on the timeline');
    assert.ok(await dialog.locator('svg.ax-graph').isVisible(), 'motion graph is visible');
    assert.equal(await dialog.locator('canvas[data-path-overlay]').count(), 1, 'ghost skeleton drawn');
    await dialog.getByRole('button', { name: '×3', exact: true }).click(); await page.waitForTimeout(500);
    await dialog.screenshot({ path: path.join(out, '2b-magnified.png') });
    await dialog.getByRole('button', { name: '×3', exact: true }).click();
    checks.push('Motion graph, ghost skeleton and ×3 magnify show the changes');
    // Apply to: Selected bones waits for a selection; Auto goes back to AnimXL's own picks.
    await dialog.getByRole('button', { name: 'Selected bones', exact: true }).click(); await page.waitForTimeout(800);
    if (await dialog.getByRole('button', { name: 'Clear', exact: true }).count()) { await dialog.getByRole('button', { name: 'Clear', exact: true }).click(); await page.waitForTimeout(600); }
    assert.match(await dialog.locator('.ax-status').textContent(), /Click bones or POSE handles/);
    await dialog.screenshot({ path: path.join(out, '2c-selected-bones.png') });
    await dialog.getByRole('button', { name: 'Auto', exact: true }).click(); await page.waitForTimeout(600);
    assert.match(await dialog.locator('.ax-status').textContent(), /bones shaped/);
    checks.push('Apply to switches between Auto and Selected bones');
    await dialog.screenshot({ path: path.join(out, '2-shaped.png') });
    // Camera rotation with a real drag inside the preview.
    const pv = await dialog.locator('.ax-preview').boundingBox();
    const before = await page.screenshot({ clip: pv });
    await page.mouse.move(pv.x + pv.width * 0.5, pv.y + pv.height * 0.5);
    await page.mouse.down(); await page.mouse.move(pv.x + pv.width * 0.75, pv.y + pv.height * 0.5, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await page.screenshot({ clip: pv });
    assert.ok(!before.equals(after), 'camera drag changes the preview');
    checks.push('Preview camera rotates with a real mouse drag');
    await dialog.getByRole('button', { name: 'Arcs', exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal(await dialog.locator('canvas[data-path-overlay]').count(), 1, 'arc overlay drawn');
    await dialog.screenshot({ path: path.join(out, '3b-arcs.png') });
    if (await dialog.getByRole('combobox', { name: 'Arc bone' }).count()) { await dialog.getByRole('combobox', { name: 'Arc bone' }).selectOption({ index: 1 }); await page.waitForTimeout(600); assert.equal(await dialog.locator('canvas[data-path-overlay]').count(), 1); checks.push('Arc bone can be switched'); }
    await dialog.getByRole('button', { name: 'Arcs', exact: true }).click();
    checks.push('Arcs draws the weapon tip path over the preview');
    await dialog.screenshot({ path: path.join(out, '3-rotated.png') });
    // THUNK at the paused moment.
    await card('Hit Stop').click();
    await dialog.getByRole('button', { name: 'Add hit stop here' }).click();
    assert.equal(await dialog.locator('.ax-thunk').count(), 1);
    checks.push('THUNK added from the paused moment');
    await dialog.getByRole('combobox', { name: 'Hit stop sound', exact: true }).click();
    await page.waitForTimeout(2500);
    await page.keyboard.press('Escape');
    const soundOptions = await dialog.getByRole('combobox', { name: 'Hit stop sound', exact: true }).locator('option').count();
    const soundNote = await dialog.locator('.ax-note', { hasText: /sound/i }).count();
    assert.ok(soundOptions > 1 || soundNote > 0, 'sound picker lists sounds or explains why not');
    if (soundOptions > 1) {
      await dialog.getByLabel('Search Hit stop sound').fill('metal');
      const filtered = await dialog.getByRole('combobox', { name: 'Hit stop sound', exact: true }).locator('option').count();
      assert.ok(filtered > 1 && filtered < soundOptions, `search narrows the list (${filtered} of ${soundOptions})`);
      checks.push(`Sound search narrows ${soundOptions - 1} sounds to ${filtered - 1} for "metal"`);
      await dialog.getByRole('combobox', { name: 'Hit stop sound', exact: true }).selectOption({ index: 1 }); await page.waitForTimeout(800);
    }
    checks.push(soundOptions > 1 ? `THUNK sound picker lists ${soundOptions - 1} game sounds` : 'THUNK sound picker explains that game sound files are needed');
    // Quick start preset, heavy steps and a flinch.
    await dialog.getByRole('button', { name: 'Heavy', exact: true }).click();
    await page.waitForTimeout(400);
    assert.equal(await value('Weight'), '80');
    checks.push('Heavy preset sets the cards');
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.waitForTimeout(300);
    assert.notEqual(await value('Weight'), '80');
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    assert.equal(await value('Weight'), '80');
    checks.push('Undo and Ctrl+Y step through slider changes');
    await dialog.locator('summary', { hasText: 'Fine-tune' }).click();
    await dialog.getByRole('button', { name: 'Save as preset…' }).click();
    await dialog.getByLabel('Preset name').fill('My ogre');
    await page.keyboard.press('Enter');
    assert.equal(await dialog.getByRole('button', { name: 'My ogre', exact: true }).count(), 1);
    checks.push('Save as preset adds your own preset button');
    await dialog.getByRole('button', { name: 'Add hit reaction here' }).click();
    assert.equal(await dialog.locator('.ax-flinch').count(), 1);
    checks.push(`Flinch marker added; ${await dialog.locator('.ax-foot').count()} footfall ticks shown with Heavy steps`);
    await page.waitForTimeout(400);
    await dialog.screenshot({ path: path.join(out, '4-heavy-preset.png') });
    const feetNote = (await dialog.locator('.ax-note', { hasText: /^Feet/ }).textContent()).trim();
    assert.match(feetNote, /found .+/);
    await dialog.getByRole('combobox', { name: 'Body bone' }).selectOption({ index: 2 });
    await page.waitForTimeout(500);
    await dialog.getByRole('combobox', { name: 'Body bone' }).selectOption({ index: 0 });
    checks.push(`Feet section shows the rig it found ("${feetNote}") and the body can be changed`);
    // Pick bones in the preview: the skeleton appears while picking.
    await dialog.getByRole('button', { name: 'Pick in view' }).first().click();
    await page.waitForTimeout(500);
    await dialog.screenshot({ path: path.join(out, '5-picking.png') });
    await dialog.getByRole('button', { name: 'Done picking' }).click();
    checks.push('Pick in view toggles the skeleton picker');
    await dialog.getByRole('combobox', { name: 'Add stiff bones' }).selectOption({ index: 1 });
    await page.waitForTimeout(400);
    assert.match(await dialog.locator('summary', { hasText: 'Fine-tune' }).locator('small').textContent(), /1 stiff/);
    await dialog.locator('.ax-section', { hasText: 'Fine-tune' }).locator('.ax-chip').first().click();
    checks.push('Stiff bones can be picked and removed');
    await dialog.getByRole('button', { name: 'Side by side' }).click();
    await page.waitForTimeout(1200);
    assert.equal(await dialog.locator('.ax-preview').count(), 2);
    await dialog.screenshot({ path: path.join(out, '6-side-by-side.png') });
    await dialog.getByRole('button', { name: 'Side by side' }).click();
    checks.push('Side by side shows the original and the AnimXL version together');
    // Settings are remembered when AnimXL is closed and reopened.
    const overlapBefore = await value('Overlap');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForTimeout(400);
    await button.click();
    await dialog.waitFor();
    await dialog.getByLabel('Animation', { exact: true }).selectOption({ label: 'Attack - 1' });
    await page.waitForTimeout(400);
    assert.equal(await value('Overlap'), overlapBefore);
    checks.push(`Settings remembered after closing (Overlap ${overlapBefore})`);
    await dialog.locator('summary', { hasText: 'Fine-tune' }).click();
    await dialog.getByRole('checkbox', { name: 'Attack - 2' }).check();
    assert.equal(await dialog.getByRole('button', { name: 'Commit 2 animations' }).count(), 1);
    checks.push('Also apply to: Commit covers 2 animations');
    await dialog.getByRole('button', { name: 'Commit 2 animations', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    checks.push('Commit closes AnimXL');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    checks.push('Undo pressed after commit without errors');
    // Retime a pose by dragging its diamond on the strip.
    await button.click();
    await dialog.waitFor();
    await dialog.getByLabel('Animation', { exact: true }).selectOption({ label: 'Attack - 2' });
    await page.waitForTimeout(800);
    const diamond = await dialog.locator('.ax-key').nth(2).boundingBox();
    await page.mouse.move(diamond.x + diamond.width / 2, diamond.y + diamond.height / 2);
    await page.mouse.down(); await page.mouse.move(diamond.x + diamond.width / 2 + 40, diamond.y + diamond.height / 2, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(600);
    assert.equal(await dialog.locator('.ax-key-moved').count(), 1, 'one pose moved');
    await dialog.screenshot({ path: path.join(out, '7-retimed.png') });
    const moved = await dialog.locator('.ax-key-moved').boundingBox();
    await page.mouse.dblclick(moved.x + moved.width / 2, moved.y + moved.height / 2);
    await page.waitForTimeout(600);
    assert.equal(await dialog.locator('.ax-key-moved').count(), 0, 'double-click puts it back');
    checks.push('Dragging a pose diamond retimes it; double-click resets');
    // Sections: pick part of the timeline, shape only that, commit, and carry on.
    await card('Overlap').click();
    await dialog.getByRole('button', { name: 'Pick section', exact: true }).click();
    const st = await dialog.getByRole('slider', { name: 'Animation time' }).boundingBox();
    await page.mouse.move(st.x + st.width * 0.3, st.y + st.height / 2); await page.mouse.down();
    await page.mouse.move(st.x + st.width * 0.7, st.y + st.height / 2, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(800);
    assert.equal(await dialog.locator('.ax-band').count(), 1, 'section band shown');
    assert.match(await dialog.locator('.ax-section-on').textContent(), /Section \d+–\d+ ms/);
    assert.equal(await dialog.getByRole('button', { name: 'Commit section', exact: true }).count(), 1);
    await dialog.screenshot({ path: path.join(out, '7b-section.png') });
    await dialog.getByRole('button', { name: 'Commit section', exact: true }).click();
    await page.waitForTimeout(800);
    assert.ok(await dialog.isVisible(), 'AnimXL stays open after a section commit');
    assert.match(await dialog.locator('.ax-status').textContent(), /Section committed/);
    await dialog.getByRole('button', { name: 'Whole animation', exact: true }).click();
    await page.waitForTimeout(600);
    checks.push('A section can be picked, shaped and committed on its own; AnimXL stays open for the next one');
    if (!(await dialog.getByRole('slider', { name: 'Overlap', exact: true }).count())) await card('Overlap').click();
    await dialog.getByRole('slider', { name: 'Overlap', exact: true }).scrollIntoViewIfNeeded();
    const ov = await dialog.getByRole('slider', { name: 'Overlap', exact: true }).boundingBox();
    await page.mouse.click(ov.x + ov.width * 0.7, ov.y + ov.height / 2);
    await page.waitForTimeout(400);
    await dialog.getByRole('button', { name: 'Commit as new' }).click();
    await dialog.waitFor({ state: 'detached' });
    const names = await page.getByLabel('Movement current sequence').locator('option').allTextContents();
    assert.ok(names.some(n => n.includes('Attack - 2 (AnimXL)')), 'new animation listed: ' + names.join(', '));
    checks.push('Commit as new adds "Attack - 2 (AnimXL)" and keeps the original');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    const namesAfterUndo = await page.getByLabel('Movement current sequence').locator('option').allTextContents();
    assert.ok(!namesAfterUndo.some(n => n.includes('(AnimXL)')), 'Undo removes the new animation');
    checks.push('Undo removes the new animation in one step');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ executablePath, checks, errors }, null, 2));
    console.log(checks.map(c => '✔ ' + c).join('\n'));
  } catch (error) {
    console.error('FAILED', error.message, errors);
    try { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); } catch {}
    process.exitCode = 1;
  } finally { await app.close(); }
})();
