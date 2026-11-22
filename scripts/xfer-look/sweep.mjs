// Builds today's transplant for many own/donor pairs and measures each result (same measurements as measure-all).
// node scripts/xfer-look/sweep.mjs <pairs.json> <out.jsonl> [workers=6]
// pairs.json: [{ id, own:{file}, donor:{file} }] (the overnight humanoid / panel lists). Resumes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [pairsFile, outFile, workersS = '6', role] = process.argv.slice(2);
const pairs = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
const keyOf = (p, i) => (p.id ?? i) + '|' + p.own.file + '|' + p.donor.file;

if (role === '--worker') {
  try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  const C = await import('./check.mjs');
  const ED = await import('../../src/editor-document.js'), ST = await import('../../src/skeleton-transplant.js'), TW = await import('../../src/transfer-window.js'), SQ = await import('../../src/sequence-editor.js');
  const open = f => ED.openDocument(new Uint8Array(fs.readFileSync(f)), path.basename(f)).model;
  const first = m => { const i = SQ.standSequenceIndex(m); return i >= 0 ? i : (m.Sequences?.length ? 0 : -1); };
  process.on('message', ({ i }) => {
    const p = pairs[i], t = Date.now(); let line = { key: keyOf(p, i), index: i, id: p.id ?? i, own: p.own.file, donor: p.donor.file };
    try {
      const own = open(p.own.file), donor = open(p.donor.file);
      const rb = TW.rigFor(own, first(own)), ra = TW.rigFor(donor, first(donor)), mirror = !!(ra?.weaponSide && rb?.weaponSide && ra.weaponSide !== rb.weaponSide);
      const made = ST.transplantSkeleton(structuredClone(own), structuredClone(donor), TW.transplantOptions({ sounds: true, effects: false, keep: [], mirror }));
      const shown = mirror ? ST.mirrorModel(structuredClone(donor)) : donor;
      line.mirror = mirror;
      line.m = C.measurePair({ key: 'donor:' + i, model: shown }, { key: 'result:' + i, model: made.model }, { native: { key: 'own:' + i, model: own } });
    } catch (e) { line.error = String(e && e.stack || e).slice(0, 400); }
    line.ms = Date.now() - t; C.forget();
    process.send({ line });
  });
  process.send({ ready: true });
} else {
  const done = new Set();
  if (fs.existsSync(outFile)) for (const l of fs.readFileSync(outFile, 'utf8').split('\n')) if (l.trim()) { try { done.add(JSON.parse(l).key); } catch {} }
  const todo = pairs.map((p, i) => i).filter(i => !done.has(keyOf(pairs[i], i)));
  console.log(`${todo.length} to build and measure, ${done.size} already done`);
  const out = fs.openSync(outFile, 'a'); let next = 0, finished = 0, live = 0;
  const me = fileURLToPath(import.meta.url);
  for (let w = 0; w < Math.min(+workersS, todo.length); w++) {
    const child = fork(me, [pairsFile, outFile, workersS, '--worker'], { execArgv: ['--max-old-space-size=4096'] }); live++;
    const feed = () => { if (next < todo.length) child.send({ i: todo[next++] }); else child.kill(); };
    child.on('message', msg => { if (msg.line) { fs.writeSync(out, JSON.stringify(msg.line) + '\n'); finished++; if (finished % 50 === 0) console.log(`${finished}/${todo.length}`); } feed(); });
    child.on('exit', () => { if (--live === 0) { fs.closeSync(out); console.log('done', finished); } });
  }
}
