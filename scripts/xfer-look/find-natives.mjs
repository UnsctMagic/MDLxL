// Finds each result's original recipient model (the unit before the transplant) in the known model folders.
// A candidate counts only when every geoset has the same vertex and face count as the result (same mesh).
// node scripts/xfer-look/find-natives.mjs <rows.json> <out rows.json>
import fs from 'node:fs';
import path from 'node:path';
import { openDocument } from '../../src/editor-document.js';

const ROOTS = ['D:/Claude/MDLxL-TestModels', 'D:/Claude/BindXL-research/refs', 'D:/Claude/lpw-main/dist/models'];
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const norm = f => path.basename(f, path.extname(f)).toLowerCase().replace(/[\s_\-]+/g, '');
const index = new Map(), all = [];
function walk(d) { let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const x of e) { const p = path.join(d, x.name); if (x.isDirectory()) walk(p); else if (/\.mdx$/i.test(x.name)) { all.push(p); const k = norm(p); if (!index.has(k)) index.set(k, []); index.get(k).push(p); } } }
ROOTS.forEach(walk);
const shapes = new Map();
function shape(f) {
  if (!shapes.has(f)) { try { const m = openDocument(fs.readFileSync(f), f).model; shapes.set(f, (m.Geosets || []).map(g => g.Vertices.length + '/' + g.Faces.length).join(',')); } catch { shapes.set(f, null); } }
  return shapes.get(f);
}
// by shape for the fallback, built lazily from the files whose size is close to the result's
let found = 0;
for (const r of rows) {
  const want = shape(r.result); r.native = null;
  if (!want) continue;
  const cands = index.get(norm(r.result)) || [];
  r.native = cands.find(c => path.resolve(c) !== path.resolve(r.result) && shape(c) === want) || null;
  if (!r.native) {
    const size = fs.statSync(r.result).size;
    for (const c of all) { const s = fs.statSync(c).size; if (Math.abs(s - size) > size * 0.6) continue; if (shape(c) === want) { r.native = c; break; } }
  }
  if (r.native) found++;
}
fs.writeFileSync(process.argv[3], JSON.stringify(rows, null, 1));
console.log(`native found for ${found}/${rows.length}; missing:`, rows.filter(r => !r.native).map(r => r.sheet + ' ' + r.id).join(', '));
