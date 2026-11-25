// The final grading sheet: the pairs whose default ticks changed, every donated animation, the new ticks as defaults.
const fs = require('fs');
const root = 'D:/Claude/MDLxL/TestBuilds/transfer-xl-35/';
const ids = JSON.parse(fs.readFileSync('out/scorecard/final/changed.json', 'utf8'));
const live = new Map(fs.readFileSync('out/scorecard/final/suggestions.jsonl', 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l)).map(l => [l.id, l]));
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
const exe = 'D:\\Claude\\MDLxL\\TestBuilds\\transfer-xl-35\\MDLxL-win32-x64\\MDLxL.exe';
const model = 'D:\\Claude\\MDLxL\\TestBuilds\\transfer-xl-35\\reasonable50\\fixtures\\HighElfFootman-4859392a\\HighElfFootman.mdx';
fs.writeFileSync('D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER final.cmd',
  `@echo off\r\nstart "" "${exe}" "${model}" "--transfer-picks=D:\\Claude\\MDLxL\\TestBuilds\\transfer-xl-35\\cases-final.json"\r\n`);
console.log(rows.length, 'rows');
