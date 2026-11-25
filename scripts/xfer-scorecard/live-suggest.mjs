// The app's live suggestion (src/xfer-suggest-toggles.js, as the transplant worker runs it) for every scorecard pair.
//   node scripts/xfer-scorecard/live-suggest.mjs <out.jsonl> [--shard k/n]
import fs from 'node:fs';
import { openDocument } from '../../src/editor-document.js';
import { suggestToggles } from '../../src/xfer-suggest-toggles.js';
import { defaultRepairKeys } from '../../src/transplant-autofix.js';

const args = process.argv.slice(2), outFile = args[0];
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const ROOT = 'D:/Claude/MDLxL/TestBuilds/transfer-xl-35/';
const pairs = [];
for (const sheet of ['weapons14', 'reasonable50', 'new30', 'random30']) for (const row of JSON.parse(fs.readFileSync(ROOT + `cases-${sheet}.json`)).cases) {
  const t = row.variants.find(v => v.transplant)?.transplant;
  if (t && !pairs.some(p => p.id === row.id)) pairs.push({ id: row.id, t });
}
let todo = pairs;
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
