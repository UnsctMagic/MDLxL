// Measures many donor/result pairs in parallel and writes one JSON line per pair (raw measurements, no verdicts).
// node scripts/xfer-look/measure-all.mjs <rows.json> <out.jsonl> [workers=6]
// rows.json: [{ id, donor, result, ...anything }]. Resumes: rows already in out.jsonl are skipped.
import fs from 'node:fs';
import os from 'node:os';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [rowsFile, outFile, workersS = '6', role] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
const keyOf = r => (r.sheet || '') + '|' + r.id + '|' + r.result;

if (role === '--worker') {
  try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  const { measurePair, forget } = await import('./check.mjs');
  process.on('message', ({ i }) => {
    const r = rows[i], t = Date.now();
    let line;
    try { line = { key: keyOf(r), ...r, ms: 0, m: measurePair(r.donor, r.result, { native: r.native || null }) }; }
    catch (e) { line = { key: keyOf(r), ...r, error: String(e && e.stack || e).slice(0, 400) }; }
    line.ms = Date.now() - t; forget();
    process.send({ line });
  });
  process.send({ ready: true });
} else {
  const done = new Set();
  if (fs.existsSync(outFile)) for (const l of fs.readFileSync(outFile, 'utf8').split('\n')) if (l.trim()) { try { done.add(JSON.parse(l).key); } catch {} }
  const todo = rows.map((r, i) => i).filter(i => !done.has(keyOf(rows[i])));
  console.log(`${todo.length} to measure, ${done.size} already done`);
  const out = fs.openSync(outFile, 'a'); let next = 0, finished = 0, live = 0;
  const me = fileURLToPath(import.meta.url);
  for (let w = 0; w < Math.min(+workersS, todo.length); w++) {
    const child = fork(me, [rowsFile, outFile, workersS, '--worker'], { execArgv: ['--max-old-space-size=4096'] }); live++;
    const feed = () => { if (next < todo.length) child.send({ i: todo[next++] }); else child.kill(); };
    child.on('message', msg => { if (msg.line) { fs.writeSync(out, JSON.stringify(msg.line) + '\n'); finished++; if (finished % 20 === 0) console.log(`${finished}/${todo.length}`); } feed(); });
    child.on('exit', () => { if (--live === 0) { fs.closeSync(out); console.log('done', finished); } });
  }
}
