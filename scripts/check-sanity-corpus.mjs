import fs from 'node:fs';
import crypto from 'node:crypto';
import {repoRoot} from './lib/paths.mjs';
import {loadHiveViewer} from '../test/helpers/hive.mjs';
import { CascReader } from '../electron/casc.cjs';
import { openDocument } from '../src/editor-document.js';
import { checkSanity } from '../src/sanity-check.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';
const [game, output] = process.argv.slice(2);
if (!game || !output) throw Error('Usage: node scripts/check-sanity-corpus.mjs GAME OUTPUT.json');
loadHiveViewer();
const hive = async bytes => { const m = new ModelViewer.parsers.mdlx.Model(); m.load(bytes.slice().buffer); const r = ModelViewer.utils.mdlx.sanityTest(m); return { ...r, findings: flattenHiveFindings(r.nodes) }; };
const reader = new CascReader(game, repoRoot), rows = [];
try {
  const { names } = await reader.list('models');
  const families = ['units', 'buildings', 'doodads', 'abilities', 'ui'];
  for (const family of families) {
    const candidates = names.filter(n => n.toLowerCase().startsWith(`war3.w3mod:${family}\\`) && /\.mdx$/i.test(n)).sort();
    const selected = [...new Set(Array.from({length: Math.min(20, candidates.length)}, (_, i) => candidates[Math.floor(i * candidates.length / Math.min(20, candidates.length))]))];
    for (const name of selected) {
      let hash;
      try {
        const bytes = await reader.read(name);
        if (!bytes) throw Error('Asset unavailable');
        hash = crypto.createHash('sha256').update(bytes).digest('hex');
        const doc = openDocument(bytes, name);
        const report = await checkSanity(doc.model, hive, doc.diagnostics);
        rows.push({ name, hash, version: doc.model.Version, status: report.status, structural: report.structural, hiveCounts: report.hive && {errors: report.hive.errors, severe: report.hive.severe, warnings: report.hive.warnings, unused: report.hive.unused}, limitation: report.limitation });
      } catch (error) { rows.push({name, hash, failure: error.message}); }
    }
  }
} finally { reader.close(); }
fs.writeFileSync(output, JSON.stringify({ date: new Date().toISOString(), game, rows }, null, 2));
console.log(JSON.stringify({models: rows.length, failures: rows.filter(r=>r.failure), errors: rows.filter(r=>r.structural?.some(f=>f.severity==='error')).map(r=>({name:r.name, issues:r.structural}))},null,2));

