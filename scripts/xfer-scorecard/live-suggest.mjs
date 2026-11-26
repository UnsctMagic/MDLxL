// The app's live suggestion (src/xfer-suggest-toggles.js, as the transplant worker runs it) for every scorecard pair.
//   node scripts/xfer-scorecard/live-suggest.mjs <out.jsonl> [--pairs <file>] [--only id,id] [--shard k/n]
// --pairs defaults to pairs-reasonable.json beside this script (the reasonable test set, models in MDLxL-TestModels).
import fs from 'node:fs';
import { openDocument } from '../../src/editor-document.js';
import { suggestToggles } from '../../src/xfer-suggest-toggles.js';
import { defaultRepairKeys } from '../../src/transplant-autofix.js';

const args = process.argv.slice(2), outFile = args[0];
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const pairsFile = opt('pairs') ?? new URL('./pairs-reasonable.json', import.meta.url);
const pairs = [];
for (const row of JSON.parse(fs.readFileSync(pairsFile)).cases) {
  const t = row.variants.find(v => v.transplant)?.transplant;
  if (t && !pairs.some(p => p.id === row.id)) pairs.push({ id: row.id, t });
}
let todo = pairs;
if (opt('only')) { const only = new Set(opt('only').split(',')); todo = todo.filter(p => only.has(p.id) || only.has(p.id.replace(/^reasonable-/, ''))); }
if (opt('shard')) { const [k, n] = opt('shard').split('/').map(Number); todo = todo.filter((_, i) => i % n === k); }
const load = p => openDocument(fs.readFileSync(p), p).model;
for (const { id, t } of todo) {
  let line;
  try {
    const s = suggestToggles(load(t.recipient), load(t.donor), { ...t.options });
    line = { id, suggested: s.suggested, keys: defaultRepairKeys(s.suggested), visible: s.visible };
  } catch (e) { line = { id, error: String(e.message || e).slice(0, 200) }; }
  fs.appendFileSync(outFile, JSON.stringify(line) + '\n');
  process.stderr.write(id + '\n');
}
