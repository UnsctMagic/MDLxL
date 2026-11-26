// XFER scorecard (docs/agent-tasks/xfer-finish-line.md): the owner's six rules, measured on every pair and every
// donated animation, at the pair's default ticks. One JSON line per pair.
//   node scripts/xfer-scorecard/score.mjs <out.jsonl> [--pairs <file>] [--only id,id] [--shard k/n] [--src <folder holding src/>]
// --pairs defaults to pairs-reasonable.json beside this script (the reasonable test set, models in MDLxL-TestModels).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const outFile = args[0];
const opt = (name, fallback = null) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const srcRoot = path.resolve(opt('src', path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..')));
const { openDocument } = await import(pathToFileURL(path.join(srcRoot, 'src', 'editor-document.js')).href);
const { transplantSkeleton } = await import(pathToFileURL(path.join(srcRoot, 'src', 'skeleton-transplant.js')).href);
const { transplantRepairOptions } = await import(pathToFileURL(path.join(srcRoot, 'src', 'transfer-window.js')).href);
const { repairFlags } = await import(pathToFileURL(path.join(srcRoot, 'src', 'transplant-autofix.js')).href);
const { scoreResult } = await import(pathToFileURL(path.join(srcRoot, 'src', 'xfer-scorecard.js')).href);

const pairsFile = opt('pairs') ?? new URL('./pairs-reasonable.json', import.meta.url);
const pairs = [];
for (const row of JSON.parse(fs.readFileSync(pairsFile)).cases) {
  const t = row.variants.find(v => v.transplant)?.transplant;
  if (t && !pairs.some(p => p.id === row.id)) pairs.push({ id: row.id, title: row.question, t, choice: row.choice === true, keys: (row.suggestion?.suggested || []).filter(k => k !== 'donorPose') });
}
// A `choice` row (legs-01: there for the owner to try the front-leg boxes) is left out of the counts unless named by --only.
let todo = opt('only') ? pairs : pairs.filter(p => !p.choice);
// --keys-from live.jsonl: use these ticks per pair (the app's live suggestion) instead of the sheet's stored ones.
if (opt('keys-from')) { const live = new Map(fs.readFileSync(opt('keys-from'), 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l)).filter(l => l.keys).map(l => [l.id, l.keys])); for (const p of pairs) if (live.has(p.id)) p.keys = [...live.get(p.id)]; }
// --add seatWeapon: tick these too on every pair (trial of a suggestion change).
if (opt('add')) for (const p of pairs) for (const k of opt('add').split(',')) if (!p.keys.includes(k)) p.keys.push(k);
if (opt('only')) { const only = new Set(opt('only').split(',')); todo = todo.filter(p => only.has(p.id) || only.has(p.id.replace(/^reasonable-/, ''))); }
if (opt('shard')) { const [k, n] = opt('shard').split('/').map(Number); todo = todo.filter((_, i) => i % n === k); }

const load = p => openDocument(fs.readFileSync(p), p).model;
async function scorePair(pair) {
  const { t, keys } = pair;
  const own = load(t.recipient), donor0 = load(t.donor);
  const opts = transplantRepairOptions(own, donor0, { ...t.options, autoFix: keys.length ? repairFlags(keys) : false });
  const M = transplantSkeleton(load(t.recipient), load(t.donor), opts).model;
  return { id: pair.id, title: pair.title, keys, ...scoreResult(own, donor0, M, opts.mirror) };
}

const out = fs.createWriteStream(outFile, { flags: 'a' });
for (const pair of todo) {
  const t0 = Date.now();
  let line;
  try { line = await scorePair(pair); } catch (e) { line = { id: pair.id, title: pair.title, error: String(e.stack || e).slice(0, 400) }; }
  line.ms = Date.now() - t0;
  out.write(JSON.stringify(line) + '\n');
  process.stderr.write(pair.id + ' ' + line.ms + 'ms\n');
}
out.end();
