const { testModel } = require('./helpers/fixtures.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');

(async () => {
  // Fixture: Blizzard SD Muradin converted to MDX800 (out/corpus-sd800/human__muradin.mdx, copied to out/optimizexl-selection).
  // Measured with out/fixture-scan/motion.mjs, pair.mjs and sim.mjs on prepareOptimizeXL bytes (findIrregularities,
  // runOptimizeStage, src/animation.js sampleTrack, test/helpers/hive.mjs sanityTest): 26 animations (1 Stand - 2 at 1833-4133,
  // so playback still passes 2100; 0 Stand - 1 at 167-1667; 2 Stand Third; 8 Death Second at 22667-25667). The Irregularities
  // Fixer list starts motion:8:21:Translation "Death Second: irregular movement (1Cylinder04)" (orange, "Body part · 3/26
  // animations") and motion:8:37:Translation "... (1Cylinder03)" (orange, "Body part · 2/26 animations"), then five
  // loop-endpoint fixes (the first pose:0:167:0:1667, Stand - 1) and two inspection-only findings, the first
  // context:2:48:Rotation in Stand Third. The two Death Second fixes together move node 21 (1Cylinder04) Translation X at
  // frame 24167 from 14.0653 to 6.772181452545066. The Insanity FIxer offers invalidBounds.
  // Not coverable: no available model (LowPolyWorks, Downloads, SD MDX800) has a red finding beside orange ones and a context
  // inspection, nor a whole-body irregular movement plus a snap in one animation like the original Footman. The red-level
  // checks therefore check the measured orange levels, and the selected pair is the two Death Second fixes.
  const FIRST = 'motion:8:21:Translation', SECOND = 'motion:8:37:Translation', CONTEXT = 'context:2:48:Rotation', CONTEXT_SEQUENCE = '2', ADVANCE = 'pose:0:167:0:1667';
  const labels = ['Death Second: irregular movement (1Cylinder04)', 'Death Second: irregular movement (1Cylinder03)'];
  const PAIR_SEQUENCE = '8', PAIR_FRAME = 24167, PAIR_NODE = 21, PAIR_X = 6.772181452545066;
  const model = process.env.MDLXL_FOOTMAN_MODEL || testModel('optimizexl-selection/human__muradin.mdx'), source = fs.readFileSync(model);
  const out = path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT || 'out', 'selection-ui'); fs.mkdirSync(out, { recursive: true });
  const exe = appTarget().packaged;
  const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: model, out });
  try {
    const main = await app.firstWindow(); await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({ timeout: 60000 });
    const pending = app.waitForEvent('window'); await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click(); const p = await pending;
    await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 20000 });
    const stage = name => p.getByRole('navigation', { name: 'Optimization stages' }).getByRole('button', { name, exact: true }).click();
    const ready = () => p.waitForFunction(() => !!document.querySelector('.ox-savings strong') && !document.querySelector('.ox-error'));
    // OptimizeXL opens on the Insanity FIxer since 3a5c89a4; this review starts at Duplicate data, which has a preview.
    await stage('Duplicate data'); await ready();
    await p.evaluate(() => { window.sides = () => Array.from(document.querySelectorAll('.ox-preview .game-preview-root'), root => { const { props, runtime } = mdlxlProbe(root); return { props, runtime }; }); });
    const original = await p.evaluate(() => JSON.stringify(sides()[0].props.model)), originalHeader = await p.locator('[aria-label="Before preview"] h2').textContent();
    const originalUnchanged = async () => { assert.equal(await p.evaluate(() => JSON.stringify(sides()[0].props.model)), original); assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(), originalHeader); };
    const animation = p.getByLabel('Animation', { exact: true }), frame = p.getByLabel('Animation frame', { exact: true });
    // All native selects in the detached document share the normal wheel API.
    await p.getByRole('button', { name: 'Play', exact: true }).click(); await animation.hover(); await p.mouse.wheel(0, 100);
    await p.waitForFunction(() => document.querySelector('[aria-label="Animation"]').value === '1'); assert.equal(await p.getByRole('button', { name: 'Pause', exact: true }).count(), 1);
    await p.waitForFunction(() => Number(document.querySelector('[aria-label="Animation frame"]').value) > 2100);
    await p.getByRole('button', { name: 'Pause', exact: true }).click(); await animation.selectOption('0'); await frame.fill('1000');
    await stage('Irregularities Fixer');
    const select = p.getByLabel('Proposed fix', { exact: true }), selection = p.locator('.ox-fix-selection'), summary = selection.locator('summary');
    assert.equal(await selection.locator('details').getAttribute('open'), null); assert.equal(await p.locator('.ox-controls').evaluate(e => e.getBoundingClientRect().width), 255);
    assert.equal(await p.locator('.ox-motion-context').count(), 0, 'Context details stay hidden until a finding is selected');
    const ids = await select.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
    await select.hover(); await p.mouse.wheel(0, 100); await p.waitForFunction(id => document.querySelector('[aria-label="Proposed fix"]').value === id, ids[0]); await ready();
    await select.hover(); await p.mouse.wheel(0, 100); await p.waitForFunction(id => document.querySelector('[aria-label="Proposed fix"]').value === id, ids[1]); await ready();
    assert.deepEqual(ids.slice(0, 2), [FIRST, SECOND]);
    await p.locator('.ox-motion-context[data-motion-level="orange"]').waitFor(); assert.match(await p.locator('.ox-motion-context').textContent(), /Body part · 2\/26 animations/);
    await select.selectOption(FIRST); await ready(); await p.locator('.ox-motion-context[data-motion-level="orange"]').waitFor();
    assert.match(await p.locator('.ox-motion-context').textContent(), /Body part · 3\/26 animations/);
    await select.selectOption(CONTEXT); await p.getByText('Inspection only — play or scrub this animation.', { exact: true }).waitFor();
    assert.equal(await p.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), false);
    assert.equal(await animation.inputValue(), CONTEXT_SEQUENCE); await p.screenshot({ path: path.join(out, 'red-context-inspection.png') });
    // Approve and Skip must advance without opening the dropdown again.
    await select.selectOption(ADVANCE); await ready(); await p.getByRole('button', { name: 'Approve', exact: true }).click();
    await p.waitForFunction(id => document.querySelector('[aria-label="Proposed fix"]').value && document.querySelector('[aria-label="Proposed fix"]').value !== id, ADVANCE); await ready(); await originalUnchanged();
    await p.getByRole('button', { name: 'Back', exact: true }).click(); await ready(); assert.equal(await select.inputValue(), ADVANCE);
    await p.getByRole('button', { name: 'Skip fix', exact: true }).click(); await p.waitForFunction(id => document.querySelector('[aria-label="Proposed fix"]').value && document.querySelector('[aria-label="Proposed fix"]').value !== id, ADVANCE); await ready();
    await stage('Duplicate data'); assert.equal(await animation.inputValue(), '0'); assert.equal(await frame.inputValue(), '1000');
    await stage('Irregularities Fixer'); await summary.click();
    const preview = p.getByRole('button', { name: 'Preview all selected fixes', exact: true }); assert.equal(await preview.isEnabled(), false);
    await selection.getByRole('button', { name: 'Select all', exact: true }).click();
    const total = await selection.locator('input:not(:disabled)').count(); assert.ok(total > 2); assert.equal(await selection.locator('input:checked').count(), total);
    assert.equal(await selection.locator('input:disabled:checked').count(), 0, 'Inspection-only flags cannot become automatic fixes');
    assert.ok(await selection.locator('[data-motion-level="orange"]').count());
    await preview.click(); await ready(); assert.equal(await p.getByRole('button', { name: 'Approve selected', exact: true }).isEnabled(), true, 'The complete selected queue must also compose successfully');
    await originalUnchanged();
    await selection.getByRole('button', { name: 'Clear all', exact: true }).click(); assert.equal(await selection.locator('input:checked').count(), 0); assert.equal(await preview.isEnabled(), false);
    for (const label of labels) await selection.getByRole('checkbox', { name: 'Select ' + label, exact: true }).check();
    assert.equal(await p.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), false, 'Checkbox changes wait for the requested combined preview');
    await preview.click(); await ready(); assert.equal(await p.getByRole('button', { name: 'Approve selected', exact: true }).isEnabled(), true);
    assert.match(await selection.textContent(), /Previewing 2 selected fixes/); await animation.selectOption(PAIR_SEQUENCE); await frame.fill(String(PAIR_FRAME));
    await p.waitForFunction(frame => sides().every(s => s.props.time === frame), PAIR_FRAME);
    const after = await p.evaluate(() => JSON.stringify(sides()[1].props.model));
    const positions = await p.evaluate(node => sides().map(s => { const r = s.runtime.native; return Array.from(r.interp.vec3(new Float32Array(3), s.props.model.Nodes[node].Translation)); }), PAIR_NODE);
    assert.ok(Math.abs(positions[0][0] - positions[1][0]) > .3); assert.ok(Math.abs(positions[1][0] - PAIR_X) < 1e-5);
    await originalUnchanged(); await p.screenshot({ path: path.join(out, 'selected-stand4-fixes.png') });
    // Browsing one selected finding keeps the combined model active.
    await select.selectOption({ label: labels[1] }); await ready(); assert.equal(await p.evaluate(() => JSON.stringify(sides()[1].props.model)), after);
    await p.getByRole('button', { name: 'Approve selected', exact: true }).click(); await p.waitForFunction(id => !Array.from(document.querySelector('[aria-label="Proposed fix"]').options).some(o => o.value === id), SECOND); await originalUnchanged();
    await p.getByRole('button', { name: 'Back', exact: true }).click(); await ready(); assert.equal(await selection.locator('input:checked').count(), 2);
    assert.equal(await p.getByRole('button', { name: 'Approve selected', exact: true }).isEnabled(), true); assert.equal(await p.evaluate(() => JSON.stringify(sides()[1].props.model)), after); await originalUnchanged();
    await selection.getByRole('checkbox', { name: 'Select ' + labels[1], exact: true }).uncheck();
    await p.waitForFunction(() => !document.querySelector('.ox-savings strong')); assert.equal(await p.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), false);
    await preview.click(); await ready(); assert.notEqual(await p.evaluate(() => JSON.stringify(sides()[1].props.model)), after, 'Unchecked fixes are excluded from the proposal');
    await stage('Sphereomancer'); await ready(); const preset = p.getByLabel('Sphere preset', { exact: true }), previous = Number(await preset.inputValue());
    await preset.hover(); await p.mouse.wheel(0, 100); await p.waitForFunction(n => Number(document.querySelector('[aria-label="Sphere preset"]').value) === n + 1, previous); await ready();
    await stage('Insanity FIxer'); await p.getByLabel('Proposed fix', { exact: true }).waitFor(); await summary.click(); await selection.getByRole('button', { name: 'Select all', exact: true }).click(); await preview.click(); await ready();
    assert.equal(await p.getByRole('button', { name: 'Approve selected', exact: true }).isEnabled(), true); await p.getByRole('button', { name: 'Approve selected', exact: true }).click();
    await p.waitForFunction(() => !Array.from(document.querySelectorAll('[aria-label="Proposed fix"] option')).some(o => o.value === 'invalidBounds')); await originalUnchanged();
    assert.deepEqual(fs.readFileSync(model), source); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, packaged: !!exe, checkboxSubset: true, selectAllClearAll: true, combinedPreviewApprovalAndUndo: true, autoAdvanceApproveAndSkip: true, dropdownWheel: ['Animation', 'Proposed fix', 'Sphere preset'], animationSelectionKeepsPlaying: true, beforePinned: true, noSourceWrites: true, errors }, null, 2));
    console.log('Passed selected-fix previews, atomic approval/Back, auto-next, dropdown wheels, playback continuity and pinned original.');
  } finally { await closeApp(app); }
})().catch(e => { console.error(e); process.exitCode = 1; });
