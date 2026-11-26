// Tunes the limits on graded results: greedy, adds the limit that catches the most bad results (grade <= 3)
// per good result (grade >= 9) it wrongly flags, until the good-flag budget is spent. Writes thresholds.json.
// node scripts/xfer-look/tune.mjs <measured.jsonl> [budget=0.15] [out=thresholds.json]
// --check <measured.jsonl> <thresholds.json> instead prints how many bad/good results the limits flag.
import fs from 'node:fs';
import { scores } from './verdict.mjs';

const args = process.argv.slice(2);
const load = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.m && r.m.clips.length);
const hit = (s, t) => Object.entries(t).some(([k, v]) => (s[k] ?? -Infinity) > v);
if (args[0] === '--check') {
  const rows = load(args[1]), th = JSON.parse(fs.readFileSync(args[2], 'utf8')), S = rows.map(r => ({ r, s: scores(r.m).o }));
  const B = S.filter(x => x.r.grade <= 3), G = S.filter(x => x.r.grade >= 9);
  console.log(`bad ${B.filter(x => hit(x.s, th)).length} of ${B.length}, good ${G.filter(x => hit(x.s, th)).length} of ${G.length}`);
} else {
  const [file, budgetS = '0.15', out = new URL('./thresholds.json', import.meta.url)] = args, budget = +budgetS;
  const S = load(file).map(r => ({ r, s: scores(r.m).o })), G = S.filter(x => x.r.grade >= 9), B = S.filter(x => x.r.grade <= 3);
  const K = [...new Set(S.flatMap(x => Object.keys(x.s)))], th = Object.fromEntries(K.map(k => [k, Infinity]));
  for (;;) {
    const gNow = G.filter(x => hit(x.s, th)).length, bNow = B.filter(x => hit(x.s, th)).length; let best = null;
    for (const k of K) for (const v of [...new Set(S.map(x => x.s[k]).filter(v => Number.isFinite(v) && v < th[k]))].sort((a, b) => b - a).slice(0, 60)) {
      const t2 = { ...th, [k]: v }, g = G.filter(x => hit(x.s, t2)).length, b = B.filter(x => hit(x.s, t2)).length;
      if (g > budget * G.length || b <= bNow) continue; const gain = (b - bNow) / (1 + g - gNow);
      if (!best || gain > best.gain || gain === best.gain && v > best.v) best = { k, v, gain, b, g };
    }
    if (!best) break; th[best.k] = best.v; console.log(`+ ${best.k} > ${best.v.toFixed(3)} -> bad ${best.b}/${B.length}, good flagged ${best.g}/${G.length}`);
  }
  fs.writeFileSync(out, JSON.stringify(Object.fromEntries(Object.entries(th).filter(([, v]) => Number.isFinite(v))), null, 1));
  console.log('\nmissed bad:'); for (const x of B.filter(x => !hit(x.s, th))) console.log(`  ${x.r.grade} ${x.r.sheet} ${x.r.id} ${x.r.pair} | ${x.r.comment.slice(0, 70)}`);
  console.log('\nflagged good:'); for (const x of G.filter(x => hit(x.s, th))) console.log(`  ${x.r.grade} ${x.r.sheet} ${x.r.id} ${x.r.pair} | ${Object.keys(th).filter(k => (x.s[k] ?? -Infinity) > th[k]).join(', ')}`);
}
