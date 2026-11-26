// Transfer pick sheet (test builds only) with real mouse input on the app: docs/agent-tasks/transfer-xl.md
// "Pick sheet as built". Disposable profile and model copies under out/; never opens a user profile. Run it hidden:
// MDLXL_PLAYWRIGHT_MODULE=<playwright-core> MDLXL_TEST_EXE=<MDLxL.exe> node test/transfer-picks.electron.cjs
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_PICKS_OUT || 'out/transfer-ui/picks-run'), shots = path.resolve(process.env.MDLXL_PICKS_SHOTS || 'out/transfer-ui/picks');
const results = { checks: [], screenshots: [], consoleErrors: [] };
const watchdog = setTimeout(() => { console.error('Pick sheet harness timed out'); process.exit(3); }, Number(process.env.MDLXL_PICKS_TIMEOUT || 900000));

function copyModel(key, name) {
  const source = fixturePath(key);
  if (!source || !fs.existsSync(source)) throw Error(`Test model ${key} is not on this machine`);
  const target = path.join(out, name); fs.copyFileSync(source, target); return target;
}
const readModel = async file => { const { parseCompatibleMdx } = await import('../src/mdx-compatibility.js'); const b = fs.readFileSync(file); return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

// Two cases on the Footman with the Grunt: whole body at three strengths, the left arm at two.
async function writeCases(footman, grunt, answers) {
  const { defaultTransferPart } = await import('../src/anim-transfer.js'), { rigFor, wholeBodyParts } = await import('../src/transfer-window.js');
  const model = await readModel(footman), donor = await readModel(grunt);
  const stand = model.Sequences.findIndex(q => q.Name === 'Stand - 1'), attack = donor.Sequences.findIndex(q => q.Name === 'Attack - 1');
  assert.ok(stand >= 0 && attack >= 0, 'the Footman has Stand - 1 and the Grunt Attack - 1');
  const rigB = rigFor(model, stand), rigA = rigFor(donor, attack), whole = wholeBodyParts(rigB, rigA).parts;
  const recipe = (keys, amount) => ({ base: { sequence: stand }, length: null, sources: {}, parts: Object.fromEntries(keys.map(key => [key, { ...defaultTransferPart(rigB, key, keys.length > 1), source: 'd0', sequence: attack, amount }])) });
  const cases = {
    answers,
    cases: [
      { id: 'whole-strength', question: 'Which attack looks right?', hint: 'Whole body from the Grunt.', model: footman, donors: { d0: grunt },
        variants: [{ id: 'zero', recipe: recipe(whole, 0) }, { id: 'half', recipe: recipe(whole, 0.5) }, { id: 'full', recipe: recipe(whole, 1) }] },
      { id: 'arm-strength', question: 'Which arm swing looks right?', model: footman, donors: { d0: grunt },
        variants: [{ id: 'soft', recipe: recipe(['armL'], 0.3) }, { id: 'strong', recipe: recipe(['armL'], 1) }] },
    ],
  };
  const file = path.join(out, 'picks-cases.json'); fs.writeFileSync(file, JSON.stringify(cases, null, 2)); return { file, cases };
}

async function session(fixture, label, args = [], settings) {
  const errors = [], consoleErrors = [];
  const { app, page } = await launchApp({ out, fixture, errors, args, settings, bounds: { x: -3000, y: 0, width: 1500, height: 960 }, timeout: 90000, pageTimeout: 30000 });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.waitForFunction(() => !!window.__mdlxl?.model?.(), null, { timeout: 60000 });
  const sheet = page.getByRole('dialog', { name: 'Pick sheet' });
  const shot = async name => { const file = path.join(shots, name + '.png'); await page.screenshot({ path: file }); results.screenshots.push(file); };
  const view = letter => sheet.locator(`section[aria-label="Variant ${letter}"]`);
  const probe = letter => page.evaluate(letter => {
    const root = document.querySelector(`[role="dialog"][aria-label="Pick sheet"] section[aria-label="Variant ${letter}"] .game-preview-root`), p = window.__mdlxl.preview(root);
    return { frame: p.runtime.native.getFrame(), camera: p.runtime.controls.object.matrix.elements.map(v => Math.round(v * 1000) / 1000).join(',') };
  }, letter);
  const noCrash = where => { assert.equal(errors.length, 0, `${label}: page errors at ${where}: ${errors.join(' | ')}`); };
  const close = async () => { results.consoleErrors.push(...consoleErrors.map(text => `${label}: ${text}`)); try { await closeApp(app); } catch (error) { console.error('close:', error.message); } };
  return { app, page, sheet, shot, view, probe, noCrash, close };
}
const ready = async (s, letters) => {
  await s.sheet.waitFor({ timeout: 60000 });
  for (const letter of letters) await s.view(letter).locator('.game-preview-root canvas').first().waitFor({ timeout: 60000 });
  await s.page.waitForFunction(count => document.querySelectorAll('[role="dialog"][aria-label="Pick sheet"] .xp-view .game-preview-root').length === count, letters.length, { timeout: 30000 });
  await s.page.waitForTimeout(1500);
};
const readAnswers = file => JSON.parse(fs.readFileSync(file, 'utf8'));

async function main() {
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(shots, { recursive: true });
  const footman = copyModel('transfer-footman', 'TEST PICKS 01.mdx'), grunt = copyModel('transfer-grunt', 'grunt donor picks.mdx');
  const answers = path.join(out, 'picks-answers.json'); fs.rmSync(answers, { force: true });
  const { file, cases } = await writeCases(footman, grunt, answers);
  const { parseCases, caseLetters } = await import('../src/transfer-picks.js');
  const parsed = parseCases(fs.readFileSync(file, 'utf8')).cases, letters1 = caseLetters(parsed[0]), letters2 = caseLetters(parsed[1]);
  const arg = `--transfer-picks=${file}`;

  // 1. The sheet opens by itself with one live view per variant, one clock and one camera.
  let s = await session(footman, 'picks', [arg]);
  try {
    await ready(s, ['A', 'B', 'C']);
    assert.match(await s.sheet.locator('.xp-count').innerText(), /^1 \/ 2$/, 'the header counts the cases');
    assert.match(await s.sheet.locator('.xp-question').innerText(), /Which attack looks right\?[\s\S]*Whole body from the Grunt\./, 'the header shows the question and the hint');
    assert.equal(await s.sheet.locator('.xp-view').count(), 3, 'three live views for three variants');
    const before = await Promise.all(['A', 'B', 'C'].map(s.probe)); await s.page.waitForTimeout(800);
    const after = await Promise.all(['A', 'B', 'C'].map(s.probe));
    after.forEach((p, i) => assert.notEqual(p.frame, before[i].frame, `view ${'ABC'[i]} plays`));
    results.checks.push(`three live views play (frames ${before.map(p => p.frame).join('/')} -> ${after.map(p => p.frame).join('/')})`);
    await s.shot('01-case1-three-views');
    // A drag in view B turns all three (one camera).
    const box = await s.view('B').locator('.xf-preview').boundingBox(), x = box.x + box.width * 0.8, y = box.y + box.height * 0.5;
    await s.page.mouse.move(x, y); await s.page.mouse.down();
    for (let i = 1; i <= 12; i++) { await s.page.mouse.move(x - i * 14, y + i * 2); await s.page.waitForTimeout(16); }
    await s.page.mouse.up(); await s.page.waitForTimeout(500);
    const turned = await Promise.all(['A', 'B', 'C'].map(s.probe));
    assert.notEqual(turned[1].camera, after[1].camera, 'the drag turns view B');
    assert.equal(turned[0].camera, turned[1].camera, 'view A turns with B'); assert.equal(turned[2].camera, turned[1].camera, 'view C turns with B');
    results.checks.push('a mouse drag in view B turns all three views the same way');
    // The strip's scrub drives every view: they stop on the same moment, and the variants differ there.
    const scrub = await s.sheet.getByLabel('Time in this view').boundingBox();
    await s.page.mouse.click(scrub.x + scrub.width * 0.45, scrub.y + scrub.height / 2); await s.page.waitForTimeout(800);
    const held = await Promise.all(['A', 'B', 'C'].map(s.probe));
    assert.ok(Math.max(...held.map(p => p.frame)) - Math.min(...held.map(p => p.frame)) <= 1, `the scrub puts every view on one moment (${held.map(p => p.frame).join('/')})`);
    await s.page.waitForTimeout(400);
    assert.deepEqual((await Promise.all(['A', 'B', 'C'].map(s.probe))).map(p => p.frame), held.map(p => p.frame), 'scrubbing pauses every view');
    const picture = async letter => { const b = await s.view(letter).locator('.xf-preview').boundingBox(); return s.page.screenshot({ clip: { x: b.x + 2, y: b.y + 60, width: b.width - 4, height: b.height - 64 } }); };
    const pictures = await Promise.all(['A', 'B', 'C'].map(picture));
    assert.ok(!pictures[0].equals(pictures[1]) && !pictures[1].equals(pictures[2]) && !pictures[0].equals(pictures[2]), 'the three variants look different at the same moment');
    results.checks.push(`the strip's scrub holds every view on frame ${held[0].frame}; the variants look different there`);
    // Space plays every view again.
    await s.sheet.locator('.xp-question').click(); await s.page.keyboard.press('Space'); await s.page.waitForTimeout(700);
    const again = await Promise.all(['A', 'B', 'C'].map(s.probe));
    again.forEach((p, i) => assert.notEqual(p.frame, held[i].frame, `Space plays view ${'ABC'[i]} again`));
    assert.equal(await s.sheet.locator('.xs-strip .xs-play').innerText(), 'Pause', 'the strip shows Pause while playing');
    results.checks.push('Space plays and the strip shows it');
    await s.shot('02-case1-after-drag');
    // Pick B writes the answer with the letter mapping and moves on.
    await s.view('B').getByRole('button', { name: 'Pick B' }).click();
    await s.sheet.locator('.xp-count', { hasText: '2 / 2' }).waitFor({ timeout: 10000 });
    let saved = readAnswers(answers);
    assert.equal(saved['whole-strength'].pick, letters1.B, 'Pick B records the variant id behind B');
    assert.deepEqual(saved['whole-strength'].letters, letters1, 'the answer records which variant each letter was');
    assert.ok(!Number.isNaN(Date.parse(saved['whole-strength'].at)), 'the answer has a time');
    results.checks.push(`Pick B wrote ${letters1.B} with the letters ${JSON.stringify(letters1)}`);
    await ready(s, ['A', 'B']);
    assert.equal(await s.sheet.locator('.xp-view').count(), 2, 'case 2 shows two live views');
    await s.shot('03-case2-two-views');
    // Back shows case 1 with B marked; the A key changes the answer.
    await s.sheet.getByRole('button', { name: 'Back' }).click();
    await s.sheet.locator('.xp-count', { hasText: '1 / 2' }).waitFor({ timeout: 10000 });
    await ready(s, ['A', 'B', 'C']);
    assert.equal(await s.view('B').getByRole('button', { name: 'Pick B' }).getAttribute('aria-pressed'), 'true', 'Back shows the earlier pick');
    await s.sheet.locator('.xp-question').click(); await s.page.keyboard.press('a');
    await s.sheet.locator('.xp-count', { hasText: '2 / 2' }).waitFor({ timeout: 10000 });
    saved = readAnswers(answers);
    assert.equal(saved['whole-strength'].pick, letters1.A, 'the A key changes the answer to the variant behind A');
    assert.equal(saved['arm-strength'], undefined, 'case 2 is still open');
    results.checks.push(`Back and the A key changed the answer to ${letters1.A}`);
    // Only the answers file named in the cases file can be written.
    const refused = await s.page.evaluate(async other => { try { await window.desktop.writeTransferPicks(other, '{}'); return ''; } catch (error) { return error.message; } }, path.join(out, 'other.json'));
    assert.match(refused, /writes only the answers file/, 'another path is refused');
    assert.ok(!fs.existsSync(path.join(out, 'other.json')), 'nothing was written there');
    results.checks.push('writing any other path is refused');
    s.noCrash('first run');
  } finally { await s.close(); }

  // 2. Reopening resumes at the first unanswered case (dark theme for the picture).
  s = await session(footman, 'picks-resume', [arg], { preferences: { theme: 'dark' } });
  try {
    await ready(s, ['A', 'B']);
    assert.match(await s.sheet.locator('.xp-count').innerText(), /^2 \/ 2$/, 'reopening resumes at the first unanswered case');
    results.checks.push('reopening the app resumes at case 2');
    await s.shot('04-resume-dark');
    await s.sheet.getByRole('button', { name: 'None looks right' }).click();
    await s.sheet.getByText('Done. You can close this window.').waitFor({ timeout: 10000 });
    const saved = readAnswers(answers);
    assert.equal(saved['arm-strength'].pick, 'none', 'None looks right records none');
    assert.deepEqual(saved['arm-strength'].letters, letters2, 'with the letters');
    assert.equal(saved['whole-strength'].pick, letters1.A, 'the first answer is kept');
    await s.shot('05-done');
    results.checks.push('None looks right on the last case writes "none" and shows Done');
    s.noCrash('resume');
  } finally { await s.close(); }

  // 3. A malformed cases file shows a readable sentence in the window.
  const bad = path.join(out, 'picks-bad.json'), broken = JSON.parse(fs.readFileSync(file, 'utf8'));
  broken.cases[1].variants = broken.cases[1].variants.slice(0, 1); fs.writeFileSync(bad, JSON.stringify(broken));
  s = await session(footman, 'picks-bad', [`--transfer-picks=${bad}`]);
  try {
    await s.sheet.waitFor({ timeout: 60000 });
    assert.match(await s.sheet.getByRole('alert').innerText(), /Case 2 \(arm-strength\): needs 2 to 4 variants\./, 'the malformed file is named in plain words');
    await s.shot('06-malformed');
    results.checks.push('a malformed cases file shows "Case 2 (arm-strength): needs 2 to 4 variants."');
    s.noCrash('malformed');
  } finally { await s.close(); }

  // 4. Without the argument there is no trace of the sheet.
  s = await session(footman, 'no-picks');
  try {
    await s.page.waitForTimeout(4000);
    assert.equal(await s.sheet.count(), 0, 'no pick sheet without the argument');
    assert.equal(await s.page.getByRole('button', { name: /^Pick [A-D]$|^No difference$|^None looks right$/ }).count(), 0, 'no pick buttons anywhere');
    assert.equal(await s.page.evaluate(() => window.desktop.transferPicks()), null, 'the bridge reports no sheet');
    results.checks.push('without --transfer-picks the app shows no sheet and no buttons');
    s.noCrash('no argument');
  } finally { await s.close(); }
}

main().then(() => {
  clearTimeout(watchdog);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  for (const check of results.checks) console.log('ok - ' + check);
  if (results.consoleErrors.length) console.log('console errors:\n' + results.consoleErrors.join('\n'));
  console.log('PASSED'); process.exit(0);
}, error => {
  clearTimeout(watchdog);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ ...results, error: String(error.stack || error) }, null, 2));
  for (const check of results.checks) console.log('ok - ' + check);
  console.error(error); console.log('FAILED'); process.exit(1);
});
