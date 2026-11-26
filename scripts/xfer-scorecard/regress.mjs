// Byte-for-byte regression check of the XFER transplant (docs/agent-tasks/xfer-fable-plan.md, step 2).
//   node scripts/xfer-scorecard/regress.mjs --write [--all]   save regression-baseline.json
//   node scripts/xfer-scorecard/regress.mjs --check [--all]   print every pair that differs from it (exit 1 if any)
// Options: --pairs <file> (default pairs-reasonable.json), --baseline <file>, --only id,id, --jobs n (parallel processes),
//          --suggestions <live.jsonl> (--all: take the suggester's ticks from a live-suggest.mjs run instead of running it).
// Without --all: the pairs marked `regression` are built at the ticks the owner graded (`ticks`). With --all: every pair is
// also built at the suggester's ticks, and pairs whose ticks changed are listed too.
// The hash is the SHA-256 of generateCompatibleMdx(result), the file the app exports.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDocument } from '../../src/editor-document.js';
import { generateCompatibleMdx } from '../../src/mdx-compatibility.js';
import { transplantSkeleton } from '../../src/skeleton-transplant.js';
import { transplantRepairOptions } from '../../src/transfer-window.js';
import { defaultRepairKeys, repairFlags } from '../../src/transplant-autofix.js';
import { suggestToggles } from '../../src/xfer-suggest-toggles.js';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const flag = name => args.includes('--' + name);
const here = file => fileURLToPath(new URL(file, import.meta.url));
const pairsFile = opt('pairs') ?? here('./pairs-reasonable.json');
const baselineFile = opt('baseline') ?? here('./regression-baseline.json');
const all = flag('all');

const cases = JSON.parse(fs.readFileSync(pairsFile)).cases.map(row => ({ row, t: row.variants.find(v => v.transplant)?.transplant })).filter(c => c.t);
let todo = cases;
if (opt('only')) { const only = new Set(opt('only').split(',')); todo = todo.filter(c => only.has(c.row.id)); }
if (!all) todo = todo.filter(c => c.row.regression);

const load = file => openDocument(fs.readFileSync(file), file).model;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function exportHash(t, ticks) {
  const own = load(t.recipient), donor = load(t.donor);
  const options = transplantRepairOptions(own, donor, { ...t.options, autoFix: ticks.length ? repairFlags(ticks) : false });
  return sha(generateCompatibleMdx(transplantSkeleton(load(t.recipient), load(t.donor), options).model));
}
const live = opt('suggestions')
  ? new Map(fs.readFileSync(opt('suggestions'), 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l)).map(l => [l.id, l]))
  : null;
function measurePair({ row, t }) {
  const line = { id: row.id };
  if (row.regression) line.regression = { ticks: row.ticks, sha256: exportHash(t, row.ticks) };
  if (all) {
    let suggested;
    if (live) {
      const l = live.get(row.id);
      if (!l || l.error) throw new Error(`${row.id}: no suggestion in ${opt('suggestions')}`);
      suggested = l.suggested;
    } else suggested = suggestToggles(load(t.recipient), load(t.donor), { ...t.options }).suggested;
    const ticks = defaultRepairKeys(suggested);
    line.all = { suggested, ticks, sha256: exportHash(t, ticks) };
  }
  return line;
}

// Worker: one JSON line per pair on stdout.
if (flag('emit')) {
  const [k, n] = opt('shard').split('/').map(Number);
  for (const c of todo.filter((_, i) => i % n === k)) {
    let line;
    try { line = measurePair(c); } catch (e) { line = { id: c.row.id, error: String(e.stack || e).slice(0, 400) }; }
    process.stdout.write(JSON.stringify(line) + '\n');
    process.stderr.write(c.row.id + '\n');
  }
  process.exit(0);
}

const jobs = Math.max(1, Math.min(+(opt('jobs') ?? 1), todo.length));
const passOn = args.filter(a => a !== '--write' && a !== '--check' && a !== '--jobs' && a !== opt('jobs'));
const results = new Map();
await Promise.all(Array.from({ length: jobs }, (_, k) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...passOn, '--emit', '--shard', `${k}/${jobs}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  let text = '';
  child.stdout.on('data', chunk => { text += chunk; });
  child.on('error', reject);
  child.on('close', code => {
    if (code) return reject(new Error(`worker ${k} exited ${code}`));
    for (const l of text.trim().split(/\r?\n/).filter(Boolean)) { const line = JSON.parse(l); results.set(line.id, line); }
    resolve();
  });
})));
const failed = [...results.values()].filter(l => l.error);
for (const l of failed) console.error(`${l.id}: ERROR ${l.error}`);
const ordered = todo.map(c => results.get(c.row.id)).filter(l => l && !l.error);

if (flag('write')) {
  if (failed.length) { console.error('not written: some pairs failed'); process.exit(1); }
  const old = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile)) : {};
  let revision = 'unknown';
  try {
    revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    if (execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim()) revision += ' (src changed)';
  } catch { /* not a checkout */ }
  const base = { revision, pairs: pairsFile.replace(/\\/g, '/').split('/').pop(), regression: { ...old.regression }, all: { ...old.all } };
  for (const l of ordered) { if (l.regression) base.regression[l.id] = l.regression; if (l.all) base.all[l.id] = l.all; }
  fs.writeFileSync(baselineFile, JSON.stringify(base, null, 1) + '\n');
  console.log(`wrote ${baselineFile}: ${Object.keys(base.regression).length} regression pairs, ${Object.keys(base.all).length} pairs at suggested ticks (${revision})`);
} else if (flag('check')) {
  const base = JSON.parse(fs.readFileSync(baselineFile));
  let differ = failed.length;
  for (const l of ordered) {
    if (l.regression) {
      const b = base.regression?.[l.id];
      if (!b) { console.log(`${l.id}: regression pair not in the baseline`); differ++; }
      else if (b.sha256 !== l.regression.sha256) { console.log(`${l.id}: export differs at the graded ticks (${l.regression.ticks.join(', ') || 'none'})`); differ++; }
    }
    if (l.all) {
      const b = base.all?.[l.id];
      if (!b) { console.log(`${l.id}: not in the baseline`); differ++; continue; }
      const was = b.ticks.join(', ') || 'none', now = l.all.ticks.join(', ') || 'none';
      if (was !== now) { console.log(`${l.id}: ticks changed: ${was} -> ${now}`); differ++; }
      else if (b.sha256 !== l.all.sha256) { console.log(`${l.id}: export differs at the suggested ticks (${now})`); differ++; }
    }
  }
  console.log(`${ordered.length} pairs checked, ${differ} differ${failed.length ? ` (${failed.length} failed)` : ''}`);
  process.exit(differ ? 1 : 0);
} else {
  console.error('pass --write or --check');
  process.exit(2);
}
