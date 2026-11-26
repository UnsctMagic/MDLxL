// Rule 6: which rule results started passing or failing between two calibrated scorecards.
//   node scripts/xfer-scorecard/compare.mjs <before-cal.jsonl> <after-cal.jsonl>
import fs from 'node:fs';
const rd = f => new Map(fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map(l => { const r = JSON.parse(l); return [r.id, r]; }));
const [a, b] = process.argv.slice(2).map(rd), up = [], down = [];
for (const [id, r] of b) { const o = a.get(id); if (!o?.rules || !r.rules) continue; for (const k of ['shape', 'motion', 'weapon', 'twins', 'jitter', 'holes']) { const x = o.rules[k]?.pass, y = r.rules[k]?.pass; if (x === false && y === true) up.push(id + ' ' + k); if (x === true && y === false) down.push(id + ' ' + k); } }
const all = m => [...m.values()].filter(r => r.rules && Object.values(r.rules).every(x => x.pass !== false)).length;
console.log('all rules:', all(a), '->', all(b));
console.log('started passing', up.length, up.join(', '));
console.log('started failing', down.length, down.join(', '));
