// Sets each rule's limit at the level of the pairs the owner accepted (graded 9-10 in the reasonable-50 round):
// the 80th percentile of that group (for "in hand", the 20th). Grades are used only as a group, never pair by pair.
// Writes limits.json once; later runs reuse it so the finish line does not move.
//   node out/scorecard/calibrate.mjs <scores.jsonl> <out scores.jsonl> [--limits limits.json]
import fs from 'node:fs';
const [inFile, outFile] = process.argv.slice(2);
const li = process.argv.indexOf('--limits'), limitsFile = li > 0 ? process.argv[li + 1] : new URL('./limits.json', import.meta.url);
const rows = fs.readFileSync(inFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const metric = {
  shapeShare: r => r.rules?.shape?.share,
  shapeOver: r => r.rules?.shape?.worst?.over ?? 1,
  motionOff: r => r.rules?.motion ? r.rules.motion.off / Math.max(1, r.rules.motion.checked) : null,
  weaponHand: r => r.rules?.weapon?.inHand ?? null,
  weaponAngle: r => r.rules?.weapon?.angle ?? null,
  weaponSecond: r => r.rules?.weapon?.secondHand ?? null,
  twinsWorse: r => r.rules?.twins?.twinClips ? r.rules.twins.worse / r.rules.twins.twinClips : null,
  jitterShare: r => r.rules?.jitter ? r.rules.jitter.clipsOver / Math.max(1, r.clips) : null,
};
let limits;
if (fs.existsSync(limitsFile)) limits = JSON.parse(fs.readFileSync(limitsFile, 'utf8'));
else {
  const grades = JSON.parse(fs.readFileSync('D:/Claude/MDLxL/TestBuilds/transfer-xl-35/reasonable50/answers.json', 'utf8'));
  const accepted = rows.filter(r => grades[r.id]?.grade >= 9);
  const q = (xs, p) => { const s = xs.filter(x => x != null && Number.isFinite(x)).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))] : null; };
  limits = { basedOn: accepted.map(r => r.id), made: new Date().toISOString() };
  for (const [k, f] of Object.entries(metric)) limits[k] = q(accepted.map(f), /Hand|Second/.test(k) ? .2 : .8);
  fs.writeFileSync(limitsFile, JSON.stringify(limits, null, 1));
}
const within = (v, k) => v == null || limits[k] == null ? true : /Hand|Second/.test(k) ? v >= limits[k] - 1e-9 : v <= limits[k] + 1e-9;
for (const r of rows) {
  if (!r.rules) continue;
  const R = r.rules;
  R.shape.pass = within(metric.shapeShare(r), 'shapeShare') && within(metric.shapeOver(r), 'shapeOver');
  R.motion.pass = within(metric.motionOff(r), 'motionOff') && !R.motion.still;
  if (R.weapon.pass != null) R.weapon.pass = within(metric.weaponHand(r), 'weaponHand') && within(metric.weaponAngle(r), 'weaponAngle') && within(metric.weaponSecond(r), 'weaponSecond');
  if (R.twins.pass != null) R.twins.pass = within(metric.twinsWorse(r), 'twinsWorse');
  R.jitter.pass = within(metric.jitterShare(r), 'jitterShare');
}
fs.writeFileSync(outFile, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log('limits', JSON.stringify(Object.fromEntries(Object.entries(limits).filter(([k]) => k in metric))));
// holes has fixed limits of its own (src/xfer-scorecard.js HOLE_*): its pass is kept as scored, not calibrated.
for (const k of ['shape', 'motion', 'weapon', 'twins', 'jitter', 'holes']) console.log(k.padEnd(7), 'pass', rows.filter(r => r.rules?.[k]?.pass === true).length, 'fail', rows.filter(r => r.rules?.[k]?.pass === false).length);
console.log('all rules pass', rows.filter(r => r.rules && Object.values(r.rules).every(x => x.pass !== false)).length, 'of', rows.length);
