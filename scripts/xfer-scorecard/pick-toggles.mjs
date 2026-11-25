// From a toggle sweep: per pair, the checkbox flips that pass at least one more rule and fail none that passed.
// Writes a keys file (live ticks plus the chosen flips) for score.mjs --keys-from.
//   node scripts/xfer-scorecard/pick-toggles.mjs <live suggestions.jsonl> <baseline scores.jsonl> <sweep folder> <out keys.jsonl>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [liveFile, baseFile, sweepDir, outFile] = process.argv.slice(2);
const read = f => fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
const calibrated = file => { const tmp = file + '.cal'; execFileSync(process.execPath, [path.resolve('scripts/xfer-scorecard/calibrate.mjs'), file, tmp], { stdio: 'ignore' }); const r = new Map(read(tmp).map(x => [x.id, x])); fs.unlinkSync(tmp); return r; };
const RULES = ['shape', 'motion', 'weapon', 'twins', 'jitter'];
const base = calibrated(baseFile);
const live = new Map(read(liveFile).filter(l => l.keys).map(l => [l.id, l]));
const flips = new Map();
const byToggle = new Map();
for (const f of fs.readdirSync(sweepDir).filter(f => /^scores-/.test(f))) {
  const t = f.replace(/^scores-/, '').replace(/(-\dof\d)?\.jsonl$/, '');
  const all = path.join(sweepDir, `all-${t}.jsonl`);
  if (!byToggle.has(t)) byToggle.set(t, []);
  byToggle.get(t).push(path.join(sweepDir, f));
}
for (const [t, files] of byToggle) {
  const merged = path.join(sweepDir, `merged-${t}.jsonl`);
  fs.writeFileSync(merged, files.map(f => fs.readFileSync(f, 'utf8').trim()).filter(Boolean).join('\n') + '\n');
  const after = calibrated(merged);
  for (const [id, r] of after) {
    const o = base.get(id); if (!o?.rules || !r.rules) continue;
    const gained = RULES.filter(k => o.rules[k].pass === false && r.rules[k].pass === true);
    const lost = RULES.filter(k => o.rules[k].pass === true && r.rules[k].pass === false);
    if (gained.length && !lost.length) { if (!flips.has(id)) flips.set(id, []); flips.get(id).push({ t, gained }); }
  }
}
const out = [];
for (const [id, l] of live) {
  let keys = [...l.keys];
  for (const { t } of flips.get(id) || []) keys = keys.includes(t) ? keys.filter(k => k !== t) : [...keys, t];
  out.push({ id, keys, flips: (flips.get(id) || []).map(f => f.t + ':' + f.gained.join('+')) });
}
fs.writeFileSync(outFile, out.map(r => JSON.stringify(r)).join('\n') + '\n');
const changed = out.filter(r => r.flips.length);
console.log('pairs with a helpful flip:', changed.length);
const count = {}; for (const r of changed) for (const f of r.flips) { const t = f.split(':')[0]; count[t] = (count[t] || 0) + 1; }
console.log(Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '));
