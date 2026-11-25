// For every checkbox: score every pair where it is offered with that checkbox flipped (on if the live suggestion has it
// off, off if on). One scores file per checkbox under <out folder>. Uses the shard option of score.mjs.
//   node scripts/xfer-scorecard/toggle-sweep.mjs <live suggestions.jsonl> <out folder> [--shard k/n]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [liveFile, outDir] = process.argv.slice(2);
const si = process.argv.indexOf('--shard'), shard = si > 0 ? process.argv[si + 1] : null;
fs.mkdirSync(outDir, { recursive: true });
const live = fs.readFileSync(liveFile, 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l)).filter(l => l.keys);
const toggles = [...new Set(live.flatMap(l => l.visible || []))].filter(k => k !== 'donorPose');
for (const t of toggles) {
  const rows = live.filter(l => l.visible?.includes(t)).map(l => ({ id: l.id, keys: l.keys.includes(t) ? l.keys.filter(k => k !== t) : [...l.keys, t] }));
  if (!rows.length) continue;
  const keysFile = path.join(outDir, `keys-${t}.jsonl`);
  fs.writeFileSync(keysFile, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  const out = path.join(outDir, `scores-${t}${shard ? '-' + shard.replace('/', 'of') : ''}.jsonl`);
  if (fs.existsSync(out)) continue;
  execFileSync(process.execPath, [path.resolve('scripts/xfer-scorecard/score.mjs'), out, '--keys-from', keysFile, '--only', rows.map(r => r.id).join(','), ...(shard ? ['--shard', shard] : [])], { stdio: 'ignore' });
  process.stderr.write(`${t}: ${rows.length} pairs\n`);
}
