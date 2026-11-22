// Collects every XFER transplant result the owner graded: donor file, graded result file, grade, comment.
// node scripts/xfer-look/graded-rows.mjs <out.json>
// Reads the grade sheets listed in the Fresh cloak and tail 20 sheet record (plus that sheet itself).
// For a sheet with several result variants the graded one is the last non-donor variant (the sheets
// say "Grade the Auto fix result on the right").
import fs from 'node:fs';
import path from 'node:path';

const RECORD = 'D:/Codex/xfer-engine-34/Fresh cloak and tail 20/Sheet record.json';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const manifests = [...read(RECORD).previousSheetManifests, 'D:/Codex/xfer-engine-34/Fresh cloak and tail 20/cases.json'];

function gradesBeside(manifest) {
  const dir = path.dirname(manifest), out = {};
  for (const name of fs.readdirSync(dir)) {
    if (!/^(answers|grades).*\.json$/i.test(name)) continue;
    let g; try { g = read(path.join(dir, name)); } catch { continue; }
    const src = g.answers && !Array.isArray(g.answers) ? g.answers : g.grades && !Array.isArray(g.grades) ? g.grades : g;
    for (const [k, v] of Object.entries(src)) if (v && typeof v.grade === 'number') out[k] = v;
  }
  return out;
}

const rows = [], seen = new Set();
for (const m of manifests) {
  if (!fs.existsSync(m)) continue;
  let c; try { c = read(m); } catch { continue; }
  const cases = c.cases || (Array.isArray(c) ? c : []);
  const grades = { ...(c.answers && !Array.isArray(c.answers) ? c.answers : {}), ...gradesBeside(m) };
  for (const x of cases) {
    const g = grades[x.id];
    if (!g || typeof g.grade !== 'number' || !Array.isArray(x.variants)) continue;
    const donor = x.variants.find(v => v.id === 'donor');
    const graded = [...x.variants].reverse().find(v => v.id !== 'donor');
    if (!donor || !graded || x.variants.length > 3) continue;
    if (!fs.existsSync(donor.file) || !fs.existsSync(graded.file)) continue;
    const key = path.resolve(graded.file).toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    rows.push({ sheet: path.basename(path.dirname(m)), id: x.id, pair: x.question || '', grade: g.grade, comment: g.comment || '', donor: donor.file, result: graded.file });
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
const by = {}; for (const r of rows) by[r.sheet] = (by[r.sheet] || 0) + 1;
console.log(rows.length, 'graded results', by, 'low (<=3):', rows.filter(r => r.grade <= 3).length, 'high (>=9):', rows.filter(r => r.grade >= 9).length);
