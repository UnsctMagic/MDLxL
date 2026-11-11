// Lists which library models get different POSE handles between two source trees (base vs candidate).
// Every change to POSE handle detection must list which models changed and why.
// Usage: node scripts/pose-corpus-diff.mjs --base <clean checkout> [--candidate <dir>] [--models <dir>]
//   [--out <dir>] [--filter <regex>] [--examples <n>] [--expect-none]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--expect-none') opt.expectNone = true;
  else if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
}
const fail = message => { console.error(`pose-corpus-diff: ${message}`); process.exit(2); };
if (!opt.base) fail('--base <checkout dir> is required');
const baseRoot = path.resolve(opt.base), candRoot = path.resolve(opt.candidate || path.join(here, '..'));
for (const root of [baseRoot, candRoot]) if (!fs.existsSync(path.join(root, 'src', 'pose-ik.js'))) fail(`no src/pose-ik.js in ${root}`);
// Same default as test/helpers/fixtures.cjs (modelsRoot), which is not editable here.
const modelsRoot = path.resolve(opt.models || process.env.MDLXL_TEST_MODELS || 'D:/Claude/MDLxL-TestModels');
if (!fs.existsSync(modelsRoot)) fail(`models folder not found: ${modelsRoot}`);
const outDir = path.resolve(opt.out || path.join(candRoot, 'out', 'pose-corpus-diff'));
const only = opt.filter ? new RegExp(opt.filter, 'i') : null;
const want = Number(opt.examples ?? 4);

const load = async root => {
  const src = path.join(root, 'src');
  return {
    pose: await import(pathToFileURL(path.join(src, 'pose-ik.js'))),
    doc: await import(pathToFileURL(path.join(src, 'editor-document.js'))),
    anim: await import(pathToFileURL(path.join(src, 'animation.js'))),
  };
};
const base = await load(baseRoot), cand = await load(candRoot);

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : /\.(mdx|mdl)$/i.test(entry.name) ? [full] : [];
});
const files = walk(modelsRoot).sort().filter(file => !only || only.test(path.relative(modelsRoot, file).replace(/\\/g, '/')));

function summarize(api, bytes) {
  const model = api.doc.openDocument(bytes).model;
  const nodes = api.anim.allNodes(model), name = id => nodes.find(node => node.ObjectId === id)?.Name ?? `#${id}`;
  const sequence = Math.max(0, (model.Sequences || []).findIndex(s => /^stand(?:\s|$)/i.test(s.Name)));
  const frame = model.Sequences?.[sequence]?.Interval?.[0] || 0;
  const start = performance.now();
  const rig = api.pose.suggestPoseRig(model, frame, sequence);
  const ms = performance.now() - start;
  const role = id => api.pose.poseRole(model, rig, id, nodes);
  return {
    ms: Math.round(ms),
    nodeCount: nodes.length,
    geosets: (model.Geosets || []).length,
    body: rig.body == null ? null : { id: rig.body, name: name(rig.body) },
    chains: rig.chains.map(chain => {
      const ids = api.pose.poseChainIds(chain);
      return { kind: chain.kind, label: chain.label || null, end: chain.end, ids, names: ids.map(name), grip: !!chain.grip };
    }),
    nodes: (rig.nodes || []).map(id => ({ id, name: name(id), role: role(id) })),
    followers: Object.keys(rig.followers || {}).length,
    carriers: Object.keys(rig.carriers || {}).length,
    unavailable: (rig.unavailable || []).map(item => ({ id: item.id, name: name(item.id), reason: item.reason })),
  };
}

const rows = [];
for (const file of files) {
  const rel = path.relative(modelsRoot, file).replace(/\\/g, '/'), row = { file: rel };
  let bytes;
  try { bytes = fs.readFileSync(file); } catch (error) { row.readError = error.message; rows.push(row); continue; }
  for (const [key, api] of [['base', base], ['cand', cand]]) {
    try { row[key] = summarize(api, bytes); } catch (error) { row[key] = { error: String(error?.message || error).slice(0, 300) }; }
  }
  rows.push(row);
}

const tally = {}, bump = key => { tally[key] = (tally[key] || 0) + 1; };
const examples = {}, note = (key, text) => { (examples[key] ||= []).push(text); };
const perModel = [];
let total = 0, same = 0, bothEmpty = 0;
for (const row of rows) {
  const b = row.base, c = row.cand;
  if (!b || !c) { bump('unreadable'); continue; }
  if (b.error || c.error) { bump(b.error && c.error ? 'both threw' : b.error ? 'base threw only' : 'cand threw only'); if (!b.error && c.error) note('cand threw only', `${row.file}: ${c.error}`); continue; }
  total++;
  const diffs = [];
  const bEnds = new Map(b.chains.map(ch => [ch.end, ch])), cEnds = new Map(c.chains.map(ch => [ch.end, ch]));
  const show = ch => `${ch.label || ch.kind}[${ch.names.join(' > ')}]`;
  for (const [end, ch] of bEnds) {
    const other = cEnds.get(end);
    if (!other) { diffs.push(['limb handle lost', show(ch)]); continue; }
    if (other.kind !== ch.kind || (other.label || null) !== (ch.label || null)) diffs.push(['limb kind/label changed', `${show(ch)} -> ${other.label || other.kind}`]);
    if (other.ids.join() !== ch.ids.join()) diffs.push(['limb joints changed', `${show(ch)} -> ${show(other)}`]);
    if (other.grip !== ch.grip) diffs.push(['limb grip changed', show(ch)]);
  }
  for (const [end, ch] of cEnds) if (!bEnds.has(end)) diffs.push(['limb handle added', show(ch)]);
  if ((b.body?.id ?? null) !== (c.body?.id ?? null)) diffs.push(['body changed', `${b.body?.name ?? 'none'} -> ${c.body?.name ?? 'none'}`]);
  const bNodes = new Map(b.nodes.map(n => [n.id, n])), cNodes = new Map(c.nodes.map(n => [n.id, n]));
  for (const [id, n] of bNodes) {
    const other = cNodes.get(id);
    if (!other) diffs.push([`part handle lost (${n.role})`, n.name]);
    else if (other.role !== n.role) diffs.push(['part role changed', `${n.name}: ${n.role} -> ${other.role}`]);
  }
  for (const [id, n] of cNodes) if (!bNodes.has(id)) diffs.push([`part handle added (${n.role})`, n.name]);
  const heads = list => list.filter(n => n.role === 'Head').length;
  if (heads(b.nodes) !== heads(c.nodes)) diffs.push(['head count changed', `${heads(b.nodes)} -> ${heads(c.nodes)}`]);
  if (!b.chains.length && !b.nodes.length && b.body == null && !c.chains.length && !c.nodes.length && c.body == null) bothEmpty++;
  if (!diffs.length) { same++; continue; }
  const kinds = new Set(diffs.map(d => d[0]));
  for (const kind of kinds) { bump(kind); note(kind, `${row.file}: ${diffs.filter(d => d[0] === kind).map(d => d[1]).slice(0, 3).join(' | ')}`); }
  perModel.push({ file: row.file, baseChains: b.chains.length, candChains: c.chains.length, baseParts: b.nodes.length, candParts: c.nodes.length, diffs });
}

const sortedTally = Object.entries(tally).sort((a, b) => b[1] - a[1]);
const lines = [];
const say = text => { console.log(text); lines.push(text); };
say(`compared ${total}; identical ${same} (of which nothing recognised by either: ${bothEmpty}); different ${total - same}`);
const baseHad = rows.filter(r => r.base && !r.base.error && (r.base.chains.length || r.base.nodes.length)).length;
say(`models where base recognises anything: ${baseHad}`);
say('\nmodels affected, by kind of difference:');
for (const [key, count] of sortedTally) say(`  ${String(count).padStart(4)}  ${key}`);
console.log('\nexamples:');
for (const [key, list] of Object.entries(examples).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`- ${key} (${list.length})`);
  for (const text of list.slice(0, want)) console.log(`    ${text.slice(0, 330)}`);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'handles.json'), JSON.stringify(rows));
fs.writeFileSync(path.join(outDir, 'changes.json'), JSON.stringify(perModel, null, 1));
const md = ['# POSE handle changes', '', `Base: ${baseRoot}`, `Candidate: ${candRoot}`, `Models: ${modelsRoot}`, '', '```', ...lines, '```', ''];
const byKind = {};
for (const m of perModel) for (const [kind, text] of m.diffs) ((byKind[kind] ||= {})[m.file] ||= []).push(text);
for (const [kind] of sortedTally) {
  const group = byKind[kind] || {};
  md.push(`## ${kind} (${Object.keys(group).length})`, '');
  for (const [file, texts] of Object.entries(group)) md.push(`- ${file}: ${texts.join(' | ')}`);
  md.push('');
}
fs.writeFileSync(path.join(outDir, 'changes.md'), md.join('\n'));
console.log(`\nwritten to ${outDir}`);
process.exit(opt.expectNone && total - same > 0 ? 1 : 0);
