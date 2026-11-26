// Does the grading sheet load? (plan step 8; once the owner saw an error from a broken "answers" path.)
//   node scripts/xfer-scorecard/sheet-smoke.cjs [--launcher "<...\GRADE - XFER reasonable.cmd>"]          part 1, no app
//   --row-timeout <seconds> (default 180): how long one row may take until its After view has finished building.
//   MDLXL_PLAYWRIGHT_MODULE=<playwright-core> node scripts/xfer-scorecard/sheet-smoke.cjs --app [--launcher ...]
//     parts 1 to 3 in the packaged app. Run it hidden, through scripts/hidden-run.ps1 (MDLXL_HIDDEN_COMMAND).
// Part 1: the cases file parses, "answers" is an absolute path whose folder exists, the answers file (if any) parses,
//   every model file exists, every control row (marked `regression` in the pair list) has its graded ticks seeded.
// Part 2a: the app started with the launcher's own command line (its exe, model and --transfer-picks): the sheet appears,
//   no page error, no problem text, and the first row's views (Donor, Own, Before, After) finish loading.
// Part 2b + 3: the same app on a copy of the cases file whose answers are reasonable\answers-smoke.json (beside the real
//   answers): one repair box is ticked and unticked (the file appears and parses), then every row is opened in turn by
//   grading it, each row's views finish loading; the smoke answers are deleted at the end. The owner's answers file is
//   never written: the copy only ever names answers-smoke.json, and the run fails if the real file changes.
// Output: one line per check and a JSON report in out/sheet-smoke/report.json (screenshots beside it).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const launcher = opt('launcher') || 'D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER reasonable.cmd';
const rowTimeout = 1000 * Number(opt('row-timeout') || 180);
const pairsFile = path.join(__dirname, 'pairs-reasonable.json');
const out = path.resolve(__dirname, '../../out/sheet-smoke');
const report = { launcher, checks: [], problems: [], screenshots: [] };
const check = (ok, text) => { report.checks.push({ ok: !!ok, text }); console.log((ok ? 'ok   ' : 'FAIL ') + text); if (!ok) report.problems.push(text); };
const hash = file => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;

// The launcher's command line: start "" "<exe>" "<model>" "--transfer-picks=<cases>"
function readLauncher(file) {
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => /^\s*start\s+""/i.test(l));
  const quoted = [...(line || '').matchAll(/"([^"]*)"/g)].map(m => m[1]).slice(1);
  const picks = quoted.find(a => a.startsWith('--transfer-picks='));
  return { exe: quoted[0], model: quoted.find((a, i) => i > 0 && /\.(mdx|mdl)$/i.test(a)), picks, cases: picks?.slice('--transfer-picks='.length) };
}

async function partOne(cmd) {
  const { parseCases, parseAnswers } = await import('../../src/transfer-picks.js');
  check(cmd.exe && cmd.model && cmd.cases, `launcher names an exe, a model and a cases file (${path.basename(launcher)})`);
  check(fs.existsSync(cmd.model), `the launcher's model exists: ${cmd.model}`);
  let sheet = null;
  try { sheet = parseCases(fs.readFileSync(cmd.cases, 'utf8')); check(true, `cases file parses: ${sheet.cases.length} rows`); }
  catch (error) { check(false, `cases file parses: ${error.message}`); return null; }
  check(path.isAbsolute(sheet.answers) && fs.existsSync(path.dirname(sheet.answers)), `"answers" is an absolute path whose folder exists: ${sheet.answers}`);
  let answers = {};
  if (fs.existsSync(sheet.answers)) {
    const text = fs.readFileSync(sheet.answers, 'utf8');
    try { JSON.parse(text); answers = parseAnswers(text); check(true, 'the answers file parses'); } catch (error) { check(false, `the answers file parses: ${error.message}`); }
  } else check(true, 'no answers file yet');
  const files = new Set();
  for (const row of sheet.cases) {
    if (row.model) files.add(row.model);
    for (const v of row.variants) for (const f of [v.file, v.transplant?.recipient, v.transplant?.donor]) if (f) files.add(f);
  }
  const missing = [...files].filter(f => !fs.existsSync(f));
  check(!missing.length, `every model file of every row exists (${files.size})${missing.length ? ': missing ' + missing.join(', ') : ''}`);
  const pairs = new Map(JSON.parse(fs.readFileSync(pairsFile, 'utf8')).cases.map(c => [c.id, c]));
  for (const row of sheet.cases) {
    const pair = pairs.get(row.id);
    if (!pair?.regression) continue;
    const seeded = answers[row.id]?.toggles;
    check(JSON.stringify(seeded) === JSON.stringify(pair.ticks), `control ${row.id} opens at its graded ticks (${pair.ticks.join(', ') || 'none'})${JSON.stringify(seeded) === JSON.stringify(pair.ticks) ? '' : ': seeded ' + JSON.stringify(seeded ?? null)}`);
  }
  return sheet;
}

async function partTwo(cmd, sheet) {
  const { launchApp, closeApp } = require('../../test/helpers/app.cjs');
  fs.mkdirSync(out, { recursive: true });
  const target = { executablePath: cmd.exe, args: [], packaged: true };
  const realAnswers = sheet.answers, before = hash(realAnswers);
  const shot = async (page, name) => { const file = path.join(out, name + '.png'); await page.screenshot({ path: file }).catch(() => {}); report.screenshots.push(file); };
  const open = async (picks, label) => {
    const errors = [];
    const { app, page } = await launchApp({ out, target, fixture: cmd.model, args: [picks], errors, bounds: { x: -3000, y: 0, width: 1600, height: 1000 }, timeout: 120000, pageTimeout: 60000 });
    const dialog = page.getByRole('dialog', { name: 'Pick sheet' });
    await dialog.waitFor({ timeout: 120000 });
    return { app, page, dialog, errors, close: () => closeApp(app).catch(() => {}), label };
  };
  // A row is loaded when its After view has finished building (the sheet enables the grades only then), every pane has a
  // canvas and nothing reports a failure. A row that does not finish within --row-timeout fails with its id.
  const afterDone = () => { const b = [...document.querySelectorAll('[role="dialog"][aria-label="Pick sheet"] .xp-grades button')].find(x => x.textContent === '5'); return !!b && !b.disabled; };
  const rowLoaded = async (s, id) => {
    const started = Date.now();
    try {
      await s.page.waitForFunction(afterDone, null, { timeout: rowTimeout });
      const panes = s.dialog.locator('[data-transplant-pane]'), count = await panes.count();
      for (let i = 0; i < count; i++) await panes.nth(i).locator('.game-preview-root canvas').first().waitFor({ timeout: Math.max(1000, rowTimeout - (Date.now() - started)) });
      const failed = await s.dialog.locator('.xp-failed, .xp-message[role="alert"], .xp-problem').allInnerTexts();
      const names = await panes.evaluateAll(list => list.map(p => p.getAttribute('aria-label')));
      check(count >= 3 && !failed.length && !s.errors.length, `${s.label} ${id}: ${count} views load in ${Math.round((Date.now() - started) / 1000)} s (${names.join(', ')})${failed.length ? ' | ' + failed.join(' | ') : ''}${s.errors.length ? ' | page errors: ' + s.errors.join(' | ') : ''}`);
      return true;
    } catch (error) {
      check(false, `${s.label} ${id}: the After view did not finish within ${rowTimeout / 1000} s (${String(error.message).split(/\r?\n/)[0]})`);
      return false;
    }
  };

  // 2a. The launcher's own command line.
  let s = await open(cmd.picks, 'launcher');
  try {
    const first = (await s.dialog.locator('.xp-question b').innerText().catch(() => '')).trim();
    await rowLoaded(s, first || 'first row');
    await shot(s.page, 'launcher-first-row');
  } finally { await s.close(); }

  // 2b + 3. A copy whose answers are answers-smoke.json beside the real ones.
  const smokeAnswers = path.join(path.dirname(realAnswers), 'answers-smoke.json');
  const copy = path.join(path.dirname(cmd.cases), path.basename(cmd.cases, '.json') + '-smoke.json');
  fs.rmSync(smokeAnswers, { force: true });
  // The copy starts from the real seeds (controls' graded ticks) so the rows open as the owner will see them.
  if (fs.existsSync(realAnswers)) fs.copyFileSync(realAnswers, smokeAnswers);
  fs.writeFileSync(copy, JSON.stringify({ ...JSON.parse(fs.readFileSync(cmd.cases, 'utf8')), answers: smokeAnswers }, null, 1));
  s = await open('--transfer-picks=' + copy, 'copy');
  try {
    await rowLoaded(s, sheet.cases[0].id);
    const box = s.dialog.locator('[data-transplant-repairs] input[data-repair]').first();
    if (await box.count()) {
      await box.click(); await s.page.waitForTimeout(800); await box.click(); await s.page.waitForTimeout(800);
      let parsed = false;
      try { JSON.parse(fs.readFileSync(smokeAnswers, 'utf8')); parsed = true; } catch {}
      check(parsed, 'a repair box ticked and unticked: answers-smoke.json is written and parses');
    } else check(false, 'the first row shows a repair box to tick');
    // Engine per region (engine 2 sheets): one box unticked, the row rebuilds, the choice is saved; then ticked back.
    const engineBox = s.dialog.locator('[data-transplant-engines] input[data-engine-region]').first();
    if (await engineBox.count()) {
      const region = await engineBox.getAttribute('data-engine-region');
      await engineBox.click(); await s.page.waitForTimeout(800);
      await rowLoaded(s, sheet.cases[0].id);
      let saved = null;
      try { saved = JSON.parse(fs.readFileSync(smokeAnswers, 'utf8'))[sheet.cases[0].id]?.regions?.[region]; } catch {}
      await engineBox.click(); await s.page.waitForTimeout(800);
      await rowLoaded(s, sheet.cases[0].id);
      check(saved === 1 || saved === 2, `an Engine 2 box (${region}) changed: the row rebuilds and answers-smoke.json keeps the choice (${saved})`);
    }
    let walked = 0;
    for (let i = 0; i < sheet.cases.length; i++) {
      const id = sheet.cases[i].id;
      // The grades stay disabled until After has finished: a row that never finishes ends the walk (it cannot be passed).
      if (i && !await rowLoaded(s, id)) break;
      await shot(s.page, `row-${String(i + 1).padStart(2, '0')}-${id}`);
      await s.dialog.locator('.xp-grades button', { hasText: /^5$/ }).click();
      walked++;
    }
    if (walked === sheet.cases.length) {
      await s.dialog.getByText('Done. You can close this window.').waitFor({ timeout: 60000 });
      check(true, `every row opened in turn (${sheet.cases.length})`);
    } else check(false, `rows opened: ${walked} of ${sheet.cases.length}`);
  } finally {
    await s.close();
    fs.rmSync(smokeAnswers, { force: true }); fs.rmSync(copy, { force: true });
  }
  check(!fs.existsSync(smokeAnswers), 'answers-smoke.json deleted');
  check(hash(realAnswers) === before, 'the real answers file is unchanged');
}

(async () => {
  const cmd = readLauncher(launcher);
  const sheet = await partOne(cmd);
  if (args.includes('--app') && sheet) await partTwo(cmd, sheet);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(report.problems.length ? `${report.problems.length} problem(s)` : 'all checks passed');
  process.exit(report.problems.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
