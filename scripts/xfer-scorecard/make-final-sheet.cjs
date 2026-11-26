// A grading sheet: the chosen pairs, every donated animation, today's suggested ticks as defaults, and its launcher.
//   node scripts/xfer-scorecard/make-final-sheet.cjs                     the final sheet (26 Nov), from out/scorecard/final
//   node scripts/xfer-scorecard/make-final-sheet.cjs --pairs scripts/xfer-scorecard/pairs-reasonable.json
//        --ids a,b,c --live <live-suggest.jsonl> --name reasonable --model <file> [--leg-timing legs-01=25]
//     rows from the pair list (in --ids order) with the live suggestion of each; cases-<name>.json and answers in <name>\,
//     launcher "_START HERE\GRADE - XFER <name>.cmd" opening <model>. --leg-timing seeds that pair's saved Leg timing in
//     a new answers file (an existing answers file is never touched).
const fs = require('fs');
const path = require('path');
const root = 'D:/Claude/MDLxL/TestBuilds/transfer-xl-35/';
const win = p => p.split('/').join('\\');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const readLive = file => new Map(fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l)).map(l => [l.id, l]));
const exe = win(root + 'MDLxL-win32-x64/MDLxL.exe');

if (!opt('pairs')) {
  const ids = JSON.parse(fs.readFileSync('out/scorecard/final/changed.json', 'utf8'));
  const live = readLive('out/scorecard/final/suggestions.jsonl');
  const rows = [];
  for (const id of ids) {
    let row = null;
    for (const s of ['weapons14', 'reasonable50', 'new30', 'random30']) row ??= JSON.parse(fs.readFileSync(root + `cases-${s}.json`, 'utf8')).cases.find(c => c.id === id);
    const copy = JSON.parse(JSON.stringify(row));
    delete copy.sequences;
    const s = live.get(id);
    copy.suggestion = { ...copy.suggestion, visible: s.visible, suggested: s.suggested };
    rows.push(copy);
  }
  fs.mkdirSync(root + 'final', { recursive: true });
  fs.writeFileSync(root + 'cases-final.json', JSON.stringify({ answers: 'D:\\Claude\\MDLxL\\TestBuilds\\transfer-xl-35\\final\\answers.json', cases: rows }, null, 1));
  const model = 'D:\\Claude\\MDLxL\\TestBuilds\\transfer-xl-35\\reasonable50\\fixtures\\HighElfFootman-4859392a\\HighElfFootman.mdx';
  fs.writeFileSync('D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER final.cmd',
    `@echo off\r\nstart "" "${exe}" "${model}" "--transfer-picks=D:\\Claude\\MDLxL\\TestBuilds\\transfer-xl-35\\cases-final.json"\r\n`);
  console.log(rows.length, 'rows');
} else {
  const name = opt('name'), model = opt('model'), ids = opt('ids').split(',');
  if (!/^[a-z0-9-]+$/.test(name || '') || !model || !fs.existsSync(model)) throw new Error('--name (lower case) and an existing --model are needed');
  const pairs = new Map(JSON.parse(fs.readFileSync(opt('pairs'), 'utf8')).cases.map(c => [c.id, c]));
  const live = readLive(opt('live'));
  const rows = ids.map(id => {
    const row = pairs.get(id), s = live.get(id);
    if (!row) throw new Error('no pair ' + id);
    if (!s || s.error) throw new Error('no live suggestion for ' + id);
    // Every donated animation: no animation list of its own. Pair-list fields the sheet does not read are left out.
    const { sequences, regression, ticks, choice, ...copy } = JSON.parse(JSON.stringify(row));
    copy.suggestion = { visible: s.visible, suggested: s.suggested };
    return copy;
  });
  const folder = root + name + '/', answers = win(folder + 'answers.json'), cases = win(root + `cases-${name}.json`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(cases, JSON.stringify({ answers, cases: rows }, null, 1));
  if (opt('leg-timing') && !fs.existsSync(answers)) {
    const seeded = {};
    for (const item of opt('leg-timing').split(',')) {
      const [id, value] = item.split('=');
      const s = live.get(id);
      seeded[id] = { grade: null, comment: '', at: new Date().toISOString(), toggles: s.suggested.filter(k => k !== 'donorPose'), suggested: s.suggested, legTiming: Number(value) };
    }
    fs.writeFileSync(answers, JSON.stringify(seeded, null, 1));
  }
  const launcher = path.join('D:/Claude/MDLxL/TestBuilds/_START HERE', `GRADE - XFER ${name}.cmd`);
  fs.writeFileSync(launcher, `@echo off\r\nrem ${rows.length} transplant pairs to grade: the pairs this round changed, the eight 9-10 pairs as controls, and legs-01 (try Mirror legs, its Leg timing slider, and Use arms).\r\n` +
    `start "" "${exe}" "${win(model)}" "--transfer-picks=${cases}"\r\n`);
  console.log(rows.length, 'rows ->', cases, '|', launcher);
}
