const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');

(async () => {
  const file = testModel('optimizexl-selection/human__muradin.mdx'), source = fs.readFileSync(file);
  const out = path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT || 'out', 'finding-playback');
  fs.mkdirSync(out, { recursive: true });
  const { app, errors } = await launchApp({ fixture: file, out, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const checks = [];
  try {
    const main = await app.firstWindow();
    const pending = app.waitForEvent('window');
    await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();
    const p = await pending;
    await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors });
    const stage = name => p.getByRole('navigation', { name: 'Optimization stages' }).getByRole('button', { name, exact: true }).click();
    const ready = () => p.waitForFunction(() => document.querySelector('.ox-savings strong') && !document.querySelector('.ox-error'));
    const finding = p.getByLabel('Proposed fix', { exact: true }), animation = p.getByLabel('Animation', { exact: true });
    // Use the real native select with mouse/keyboard, including its normal focus.
    const choose = async (select, index) => {
      await select.click(); await p.keyboard.press('Home');
      for (let i = 0; i < index; i++) await p.keyboard.press('ArrowDown');
      await p.keyboard.press('Enter');
    };
    const running = async label => {
      assert.equal(await p.getByRole('button', { name: 'Pause', exact: true }).count(), 1, label + ' keeps playback running');
      const frames = await p.locator('.ox-preview .game-preview-root').evaluateAll(roots => roots.map(root => mdlxlProbe(root).runtime.native.getFrame()));
      await p.waitForFunction(previous => Array.from(document.querySelectorAll('.ox-preview .game-preview-root')).every((root, i) => Math.abs(mdlxlProbe(root).runtime.native.getFrame() - previous[i]) > 1), frames);
      checks.push(label);
    };
    const paused = async label => {
      assert.equal(await p.getByRole('button', { name: 'Play', exact: true }).count(), 1, label + ' stays paused');
      const state = await p.locator('.ox-preview .game-preview-root').evaluateAll(roots => roots.map(root => mdlxlProbe(root).props));
      assert.ok(state.every(props => !props.playbackRunning), label + ' freezes both previews');
      checks.push(label);
    };
    await stage('Irregularities Fixer');
    await choose(finding, 1); await ready(); await paused('Initial finding');
    await p.getByRole('button', { name: 'Play', exact: true }).click(); await running('Play');
    await choose(finding, 2); await ready(); await running('Finding dropdown');
    const priorFinding = await finding.inputValue();
    await finding.hover(); await p.mouse.wheel(0, 100);
    await p.waitForFunction(previous => document.querySelector('[aria-label="Proposed fix"]').value !== previous, priorFinding);
    await ready(); await running('Finding wheel');
    const selection = p.locator('.ox-fix-selection');
    await selection.locator('summary').click();
    await selection.locator('.ox-fix-name').first().click(); await ready(); await running('Finding row');
    await selection.getByRole('button', { name: 'Select all', exact: true }).click();
    await selection.getByRole('button', { name: 'Preview all selected fixes', exact: true }).click();
    await ready(); await running('Selected-fix preview');
    await choose(finding, 2); await ready(); await running('Finding in selected preview');
    await choose(animation, 1); await running('Animation dropdown');
    const priorAnimation = await animation.inputValue();
    await animation.hover(); await p.mouse.wheel(0, 100);
    await p.waitForFunction(previous => document.querySelector('[aria-label="Animation"]').value !== previous, priorAnimation);
    await running('Animation wheel');
    await choose(finding, 0); await running('Return from finding inspection');
    await stage('Duplicate data'); await ready(); await running('Stage change');
    await stage('Irregularities Fixer'); await choose(finding, 1); await ready();
    await p.getByRole('button', { name: 'Approve', exact: true }).click(); await ready(); await running('Approve and next finding');
    await p.getByRole('button', { name: 'Back', exact: true }).click(); await ready(); await running('Back');
    await p.getByRole('button', { name: 'Skip fix', exact: true }).click(); await ready(); await running('Skip and next finding');
    await p.getByRole('button', { name: 'Pause', exact: true }).click(); await paused('Explicit Pause');
    await choose(finding, 1); await ready(); await paused('Finding while paused');
    await selection.locator('summary').click();
    await selection.getByRole('button', { name: 'Select all', exact: true }).click();
    await selection.getByRole('button', { name: 'Preview all selected fixes', exact: true }).click();
    await ready(); await paused('Selected preview while paused');
    await choose(animation, 1); await paused('Animation while paused');
    assert.deepEqual(fs.readFileSync(file), source); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, packaged: appTarget().packaged, checks, sourceUnchanged: true, errors }, null, 2));
    console.log('Passed ' + checks.length + ' finding/animation playback transitions.');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
