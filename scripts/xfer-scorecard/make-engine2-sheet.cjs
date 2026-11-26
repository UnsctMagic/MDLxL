// The engine 2 grading sheet (docs/agent-tasks/xfer-engine2.md): 20 pairs, each with Donor, Receiver, Engine 1 and Engine 2,
// every donated animation. Engine 1 builds at the ticks the owner graded (else the pair's suggestion); Engine 2 builds
// with `engine: 2` and no ticks.
//   node scripts/xfer-scorecard/make-engine2-sheet.cjs
const fs = require('fs');
const root = 'D:/Claude/MDLxL/TestBuilds/transfer-xl-35/';
const win = p => p.split('/').join('\\');
const IDS = [
  // the owner's 9-10 pairs
  'reasonable-05', 'reasonable-29', 'new-08', 'random-10', 'new-01', 'random-21', 'new-05', 'new-02', 'reasonable-31', 'reasonable-32', 'reasonable-39', 'reasonable-45',
  // more reasonable pairs, other kinds of animation: near-twins, axe, polearm, bow, caster, big bodies, four legs
  'reasonable-07', 'reasonable-06', 'reasonable-12', 'reasonable-17', 'reasonable-23', 'reasonable-15', 'reasonable-44',
];
const pairs = new Map(JSON.parse(fs.readFileSync(__dirname + '/pairs-reasonable.json', 'utf8')).cases.map(c => [c.id, c]));
const row = (id, question, hint, donor, recipient, options, ticks) => ({
  id, question, grade: true, hint, model: donor,
  variants: [
    { id: 'donor', label: 'Donor', file: donor },
    { id: 'own', label: 'Receiver', file: recipient },
    { id: 'before', label: 'Engine 1', transplant: { recipient, donor, options: { ...options, toggles: ticks } } },
    { id: 'after', label: 'Engine 2', transplant: { recipient, donor, options: { ...options, engine: 2 } } },
  ],
  looks: [], suggestion: { visible: [], suggested: [] },
});
const rows = IDS.map(id => {
  const pair = pairs.get(id);
  if (!pair) throw new Error('no pair ' + id);
  const t = pair.variants.find(v => v.id === 'before').transplant;
  const ticks = (pair.regression ? pair.ticks : pair.suggestion?.suggested || []).filter(k => k !== 'donorPose');
  return row(id, pair.question, pair.hint || '', t.donor, t.recipient, t.options, ticks);
});
const nurgle = 'D:\\Claude\\MDLxL-TestModels\\WH_WOC_NurgleSorcerer_A1_Balanced.mdx', footman = 'D:\\Claude\\MDLxL-TestModels\\reasonable-50\\human__footman-fa74ae72\\footman.mdx';
for (const file of [nurgle, footman]) if (!fs.existsSync(file)) throw new Error('missing ' + file);
rows.splice(12, 0, row('nurgle-01', 'Nurgle Sorcerer → Footman', 'Wide-hipped donor with straight legs: watch how far apart the feet stand.', nurgle, footman, { events: true, emitters: false, keep: [], mirror: false }, []));
const folder = root + 'engine2/', answers = win(folder + 'answers.json'), cases = win(root + 'cases-engine2.json');
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(cases, JSON.stringify({ answers, cases: rows }, null, 1));
const exe = win(root + 'MDLxL-win32-x64/MDLxL.exe'), model = 'D:\\Claude\\MDLxL\\TestBuilds\\test-models\\TEST XFER 37.mdx';
fs.writeFileSync('D:/Claude/MDLxL/TestBuilds/_START HERE/GRADE - XFER engine 2.cmd',
  `@echo off\r\nrem ${rows.length} transplant pairs: Donor, Receiver, Engine 1, Engine 2. Grade Engine 2.\r\nstart "" "${exe}" "${model}" "--transfer-picks=${cases}"\r\n`);
console.log(rows.length, 'rows ->', cases);
