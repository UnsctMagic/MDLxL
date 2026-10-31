const { testModel } = require('./helpers/fixtures.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');

(async () => {
  // Fixture: LowPolyWorks herrdave Spanish_Halberdier.mdx (out/optimizexl-opening, docs/PACKAGED-TESTS.md), whose only severe
  // mdx-m3-viewer finding is a missing opening key. Measured with out/fixture-scan/sim.mjs and one-fix.mjs (prepareOptimizeXL
  // bytes, test/helpers/hive.mjs sanityTest, sanityProposals, runOptimizeStage with that one proposal):
  // before 0 errors / 1 severe / 0 warnings / 409 notices; proposal opening:Bones.5.Translation:2 "Jaw: missing opening
  // Translation in Portrait Talk" (sequence 2, interval 11700-14567, frame 11700); Bones.5.Translation gains exactly key
  // 11700 and keeps its first authored key in the sequence, 11799; after approval 0 severe and the 409 notices remain.
  const SEVERE = 'mdx-m3-viewer: 0 errors · 1 severe · 0 warnings · 409 notices', CLEARED = 'mdx-m3-viewer: 0 errors · 0 severe · 0 warnings · 409 notices';
  const label = 'Jaw: missing opening Translation in Portrait Talk', SEQUENCE = '2', OPENING = 11700, AUTHORED = 11799, BETWEEN = '11750';
  const model = process.env.MDLXL_OPENING_MODEL || testModel('optimizexl-opening/Spanish_Halberdier.mdx');
  const source = fs.readFileSync(model), out = path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT || 'out', 'opening-ui'); fs.mkdirSync(out, { recursive: true });
  const exe = appTarget().packaged;
  const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: model, out });
  try {
    const main = await app.firstWindow(); await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({ timeout: 60000 });
    const pending = app.waitForEvent('window'); await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click(); const p = await pending;
    await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 20000 });
    await p.getByRole('navigation', { name: 'Optimization stages' }).getByRole('button', { name: 'Insanity FIxer', exact: true }).click();
    await p.getByText(SEVERE, { exact: true }).waitFor();
    const select = p.getByLabel('Proposed fix', { exact: true });
    assert.ok((await select.locator('option').allTextContents()).includes(label));
    await select.selectOption({ label }); await p.waitForFunction(() => !!document.querySelector('.ox-savings strong'));
    assert.equal(await p.getByLabel('Animation', { exact: true }).inputValue(), SEQUENCE);
    assert.equal(await p.getByLabel('Animation frame', { exact: true }).inputValue(), String(OPENING));
    assert.equal(await p.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), true);
    await p.evaluate(() => { window.sides = () => Array.from(document.querySelectorAll('.ox-preview .game-preview-root'), root => { const { props } = mdlxlProbe(root); return props; }); });
    const original = await p.evaluate(() => JSON.stringify(sides()[0].model)), header = await p.locator('[aria-label="Before preview"] h2').textContent();
    const preview = await p.evaluate(() => sides().map(s => s.model.Bones[5].Translation.Keys.map(k => k.Frame)));
    assert.equal(preview[1].length, preview[0].length + 1); assert.ok(preview[1].includes(OPENING)); assert.ok(preview.every(frames => frames.includes(AUTHORED)));
    await p.getByLabel('Animation frame', { exact: true }).fill(BETWEEN); await p.screenshot({ path: path.join(out, 'opening-preview.png') });
    await p.getByRole('button', { name: 'Approve', exact: true }).click();
    await p.getByText(CLEARED, { exact: true }).waitFor();
    assert.equal(await p.evaluate(() => JSON.stringify(sides()[0].model)), original); assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(), header);
    assert.ok(!(await select.locator('option').allTextContents()).includes(label)); await p.screenshot({ path: path.join(out, 'opening-approved.png') });
    await p.getByRole('button', { name: 'Back', exact: true }).click();
    await p.getByText(SEVERE, { exact: true }).waitFor();
    assert.ok((await select.locator('option').allTextContents()).includes(label));
    assert.deepEqual(fs.readFileSync(model), source); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, packaged: !!exe, missingOpeningPreviewApprovalAndBack: true,
      severeCleared: true, unusedNoticesRetained: 409, pinnedBefore: true, noSourceWrites: true, errors }, null, 2));
    console.log('Passed missing-opening preview, approval, mdx-m3-viewer severe clearance, unused-record preservation and Back.');
  } finally { await closeApp(app); }
})().catch(e => { console.error(e); process.exitCode = 1; });
