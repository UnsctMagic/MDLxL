// Bone Namer library gate: renames every test model with the default plan and proves POSE still finds every handle
// it found before, on the same bone, plus the naming-scheme rules (docs/agent-tasks/bone-namer.md).
// Usage: node scripts/bone-namer-corpus.mjs [--namer <module>] [--out <dir>] [--models <dir>] [--filter <regex>] [folders...]
//   --namer   module exporting planBoneNames / applyBoneNames (default ../src/bone-namer.js)
//   folders   subfolders of the models folder (or absolute paths); default: the rig-relevant set below
// Exit code 1 when anything fails (LOST/MOVED handles, naming-rule breaks, crashes); 2 on bad usage.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '..');
const args = process.argv.slice(2), opt = {}, folderArgs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else folderArgs.push(args[i]);
}
const usage = message => { console.error(`bone-namer-corpus: ${message}`); process.exit(2); };

const namerPath = opt.namer ? path.resolve(opt.namer) : path.join(repo, 'src', 'bone-namer.js');
if (!fs.existsSync(namerPath)) usage(`${opt.namer ? namerPath : 'src/bone-namer.js'} not found (the Bone Namer module is not built yet; pass --namer <module> to use a stub)`);
const modelsRoot = path.resolve(opt.models || process.env.MDLXL_TEST_MODELS || 'D:/Claude/MDLxL-TestModels');
if (!fs.existsSync(modelsRoot)) usage(`models folder not found: ${modelsRoot}`);
const outDir = path.resolve(opt.out || path.join(repo, 'out', 'bone-namer-corpus'));
const only = opt.filter ? new RegExp(opt.filter, 'i') : null;

const imp = file => import(pathToFileURL(path.join(repo, 'src', file)));
const [namer, pose, seq, anim, compat] = await Promise.all([import(pathToFileURL(namerPath)), imp('pose-ik.js'), imp('sequence-editor.js'), imp('animation.js'), imp('mdx-compatibility.js')]);
if (typeof namer.planBoneNames !== 'function' || typeof namer.applyBoneNames !== 'function') usage(`${namerPath} must export planBoneNames and applyBoneNames`);
let docModule = null;

const DEFAULT_FOLDERS = ['corpus-sd', 'corpus-sd800', 'pose', 'pose-odd', 'pose-anatomy', 'pose-anatomy-holdouts', 'pose-complex-fixtures', 'pose-heads', 'pose-wings',
  'pose-flail', 'corpse-fixtures', 'pose-setup-fixture', 'citadel-fixture', 'material-fixture', 'graveguard', 'showcase-queue', 'effect-fixture', 'ai-rig-steve',
  'ribbon-direction', 'glow-up', 'surface-effects', 'section-order-repaired', 'optimizexl-footman', 'optimizexl-review'];
const ROLE_WORDS = new Set(['Body', 'Pelvis', 'Spine', 'Chest', 'Neck', 'Head', 'Hand', 'Foot', 'Hoof', 'Tail', 'Wing']);

// ---------- library ----------
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : /\.mdx$/i.test(entry.name) ? [full] : [];
});
let candidates;
if (folderArgs.length) {
  candidates = folderArgs.flatMap(folder => {
    const dir = fs.existsSync(folder) ? path.resolve(folder) : path.join(modelsRoot, folder);
    if (!fs.existsSync(dir)) usage(`folder not found: ${folder}`);
    return walk(dir);
  });
} else {
  const rootFiles = fs.readdirSync(modelsRoot, { withFileTypes: true }).filter(e => e.isFile() && /\.mdx$/i.test(e.name)).map(e => path.join(modelsRoot, e.name));
  candidates = [...rootFiles, ...DEFAULT_FOLDERS.filter(f => fs.existsSync(path.join(modelsRoot, f))).flatMap(f => walk(path.join(modelsRoot, f)))];
}
const rel = file => path.relative(modelsRoot, file).replace(/\\/g, '/');
candidates = [...new Set(candidates)].sort().filter(file => !only || only.test(rel(file)));
const seen = new Map(), files = [], duplicates = [];
for (const file of candidates) {
  const bytes = fs.readFileSync(file), hash = crypto.createHash('sha1').update(bytes).digest('hex');
  if (seen.has(hash)) { duplicates.push({ file: rel(file), sameAs: seen.get(hash) }); continue; }
  seen.set(hash, rel(file)); files.push({ file, bytes });
}

// ---------- helpers ----------
const same = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b || a == null || b == null || typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(Number.isNaN(a[i]) && Number.isNaN(b[i]))) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const key of ka) if (!(key in b) || !same(a[key], b[key])) return false;
  return true;
};

function openModel(bytes) {
  try { return compat.parseCompatibleMdx(bytes); } catch (error) { error.parse = true; throw error; }
}

const sig = (nodes, id) => nodes.get(id)?.Name ?? `#${id}`;
function runPose(model, nodes, sequence, frame) {
  const rig = pose.suggestPoseRig(model, frame, sequence), nodeList = [...nodes.values()];
  const roleOf = id => {
    const r = pose.poseRole(model, rig, id, nodeList);
    return ROLE_WORDS.has(r) ? r : 'Object';
  };
  return {
    body: rig.body ?? null,
    limbs: (rig.chains || []).map(chain => {
      const joints = pose.poseChainIds(chain).filter(id => id != null), grip = chain.grip ? [...chain.grip] : null;
      const pts = joints.map(id => (id === chain.end && grip) || anim.nodePivot(model, nodes.get(id), id));
      let length = 0; for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      return { end: chain.end, kind: chain.kind, label: chain.label || null, joints, grip, length };
    }),
    parts: (rig.nodes || []).map(id => ({ id, role: roleOf(id) })),
    followers: Object.fromEntries(Object.entries(rig.followers || {}).map(([k, v]) => [k, [...v].sort((a, b) => a - b)])),
    carriers: { ...(rig.carriers || {}) },
  };
}

const limbText = (l, nodes) => `${l.label || l.kind}[${l.joints.map(id => sig(nodes, id)).join(' > ')}]`;
const keyed = o => JSON.stringify(Object.entries(o).sort((a, b) => Number(a[0]) - Number(b[0])));

function compare(before, after, namesBefore, namesAfter, copyModel) {
  const lost = [], moved = [], retyped = [], gained = [], extra = [], grips = [], rerooted = [], tracked = [];
  const nb = id => `${sig(namesBefore, id)} -> ${sig(namesAfter, id)}`;
  // limbs
  const bEnds = new Map(before.limbs.map(l => [l.end, l])), aEnds = new Map(after.limbs.map(l => [l.end, l]));
  const freshLimbs = after.limbs.filter(l => !bEnds.has(l.end));
  for (const [end, l] of bEnds) {
    const other = aEnds.get(end);
    if (other) {
      if (l.grip && !other.grip) {
        if (/^bone[ _]|^helper/i.test(namesAfter.get(end)?.Name || '')) tracked.push({ kind: 'GRIP-TRACKED', text: `limb ${nb(end)}: grip lost, end now named bone_/helper (pose-ik.js:207)` });
        else grips.push(`limb ${nb(end)}: grip disappeared`);
      }
      else if (l.grip && other.grip && Math.hypot(l.grip[0] - other.grip[0], l.grip[1] - other.grip[1], l.grip[2] - other.grip[2]) > 0.01 * l.length) grips.push(`limb ${nb(end)}: grip moved ${Math.hypot(l.grip[0] - other.grip[0], l.grip[1] - other.grip[1], l.grip[2] - other.grip[2]).toFixed(2)} of limb length ${l.length.toFixed(2)}`);
      if (other.kind !== l.kind || other.label !== l.label) retyped.push(`limb ${nb(end)}: ${l.label || l.kind} -> ${other.label || other.kind}`);
      else if (other.joints.join() !== l.joints.join()) retyped.push(`limb joints ${nb(end)}: [${l.joints.join(',')}] -> [${other.joints.join(',')}]`);
      continue;
    }
    const rr = freshLimbs.find(f => f.joints.length === l.joints.length && f.joints.slice(0, -1).join() === l.joints.slice(1).join() && namesBefore.get(f.joints.at(-1))?.Parent === end);
    if (rr) { freshLimbs.splice(freshLimbs.indexOf(rr), 1); rerooted.push(`limb ${limbText(l, namesBefore)} -> ${limbText(rr, namesAfter)}`); continue; }
    const twin = freshLimbs.find(f => f.kind === l.kind && f.label === l.label && f.joints.some(id => l.joints.includes(id)));
    if (twin) { freshLimbs.splice(freshLimbs.indexOf(twin), 1); moved.push(`limb ${limbText(l, namesBefore)} end ${sig(namesBefore, end)} -> end ${sig(namesAfter, twin.end)}`); }
    else lost.push(`limb ${limbText(l, namesBefore)}`);
  }
  for (const l of freshLimbs) gained.push(`limb ${limbText(l, namesAfter)}`);
  // body
  if (before.body !== after.body) {
    if (before.body != null && after.body != null) moved.push(`body ${sig(namesBefore, before.body)} -> ${sig(namesAfter, after.body)}`);
    else if (before.body != null) lost.push(`body ${sig(namesBefore, before.body)}`);
    else gained.push(`body ${sig(namesAfter, after.body)}`);
  }
  // part handles
  const bParts = new Map(before.parts.map(p => [p.id, p])), aParts = new Map(after.parts.map(p => [p.id, p]));
  const freshParts = after.parts.filter(p => !bParts.has(p.id));
  for (const [id, p] of bParts) {
    const other = aParts.get(id);
    if (other) { if (other.role !== p.role) retyped.push(`part ${nb(id)}: ${p.role} -> ${other.role}`); continue; }
    const twin = freshParts.find(f => f.role === p.role);
    const headTracked = twin && p.role === 'Head' && (copyModel.Attachments || []).some(a => a.Parent === twin.id && pose.poseNodeRole(a) === 'Head')
      && pose.poseNodeRole(namesAfter.get(namesAfter.get(twin.id)?.Parent)) === 'Chest' && pose.poseNodeRole(namesBefore.get(namesBefore.get(twin.id)?.Parent)) !== 'Chest';
    if (headTracked) { freshParts.splice(freshParts.indexOf(twin), 1); tracked.push({ kind: 'HEAD-TRACKED', text: `Head ${sig(namesBefore, id)} -> ${sig(namesAfter, twin.id)} (pose-ik.js:164)` }); }
    else if (twin) { freshParts.splice(freshParts.indexOf(twin), 1); moved.push(`part ${p.role} ${sig(namesBefore, id)} -> ${sig(namesAfter, twin.id)}`); }
    else lost.push(`part ${p.role} ${sig(namesBefore, id)}`);
  }
  for (const p of freshParts) gained.push(`part ${p.role} ${sig(namesAfter, p.id)}`);
  // followers / carriers
  if (keyed(before.followers) !== keyed(after.followers)) extra.push({ kind: 'FOLLOWERS', text: `${keyed(before.followers)} -> ${keyed(after.followers)}` });
  if (keyed(before.carriers) !== keyed(after.carriers)) extra.push({ kind: 'CARRIERS', text: `${keyed(before.carriers)} -> ${keyed(after.carriers)}` });
  return { lost, moved, retyped, gained, extra, grips, rerooted, tracked };
}

const SIDE = /_(L|R)(?:_(?:Copy|Death|Portrait)\d*)?$/;
const LONE_W = /(?:^|[\s_.-])(?:w|wep)(?=$|[\s_.-])/i;
const BARE = /^(bone|helper)[ _-]*(any)?[ _-]*[0-9]+$/i;

function checkNames(renamedModel, renamedIds, nodes, sequence, frame) {
  const problems = [], review = [];
  const lowerCounts = new Map();
  const all = anim.allNodes(renamedModel), counts = new Map();
  for (const node of all) counts.set(node.Name, (counts.get(node.Name) || 0) + 1);
  for (const node of all) lowerCounts.set(node.Name.toLowerCase(), (lowerCounts.get(node.Name.toLowerCase()) || 0) + 1);
  const matrices = anim.sampleNodeMatrices(renamedModel, frame, sequence, frame);
  for (const id of renamedIds) {
    const node = nodes.get(id), name = node.Name;
    if (counts.get(name) > 1) problems.push(`duplicate name "${name}" (${counts.get(name)} nodes)`);
    else if (lowerCounts.get(name.toLowerCase()) > 1) review.push({ kind: 'CASE-DUPLICATE', text: `"${name}" differs only in case from another node name` });
    if (Buffer.byteLength(name, 'utf8') > 79) problems.push(`name over 79 bytes: "${name}"`);
    if (/[^\x20-\x7e]/.test(name)) problems.push(`non-ASCII name: ${JSON.stringify(name)}`);
    if (LONE_W.test(name)) problems.push(`lone W/Wep token: "${name}"`);
    if (BARE.test(name)) problems.push(`bare numbered name: "${name}"`);
    if (!name.trim()) problems.push(`empty name on #${id}`);
    const side = name.match(SIDE)?.[1];
    if (side) {
      const y = anim.worldPivot(renamedModel, id, matrices, node).y;
      const bad = side === 'L' ? !(y >= 0) : !(y < 0);
      if (bad) { if (Math.abs(y) <= 1e-4) review.push({ kind: 'SIDE-NEAR-ZERO', text: `"${name}" Stand Y = ${y}` }); else problems.push(`"${name}" is _${side} but Stand Y = ${y.toFixed(3)}`); }
    }
  }
  return { problems, review };
}

// ---------- run ----------
fs.mkdirSync(outDir, { recursive: true });
const report = [], t0 = Date.now();
let index = 0;
for (const { file, bytes } of files) {
  index++;
  const rec = { file: rel(file), bones: 0, helpers: 0, renamed: 0, actors: [], ms: 0, failures: [], review: [], notes: [] };
  const start = performance.now();
  try {
    const model = openModel(bytes);
    const boneIds = new Set((model.Bones || []).map(b => b.ObjectId)), helperIds = new Set((model.Helpers || []).map(h => h.ObjectId));
    rec.bones = boneIds.size; rec.helpers = helperIds.size;
    const nodes = new Map(anim.allNodes(model).map(n => [n.ObjectId, n]));
    const sequence = seq.standSequenceIndex(model);
    const frame = model.Sequences?.[sequence]?.Interval?.[0] || 0;
    rec.stand = { sequence, name: model.Sequences?.[sequence]?.Name ?? null, frame };

    let before = null;
    try { before = runPose(model, nodes, sequence, frame); } catch (error) { rec.notes.push(`POSE threw on the original: ${error.message}`); }
    const pristine = structuredClone(model);

    const plan = namer.planBoneNames(model);
    if (!same(model, pristine)) rec.failures.push({ kind: 'IMPURE', text: 'planBoneNames changed the model it was given' });
    if (plan?.error) rec.notes.push(`plan error: ${plan.error}`);
    rec.actors = (plan?.actors || []).map(a => a.kind);
    const rows = plan?.rows || [];
    const chosen = new Set(rows.filter(r => r.name !== r.current).map(r => r.id));
    rec.rows = rows.length;

    const copy = structuredClone(model);
    const result = namer.applyBoneNames(copy, rows, chosen);
    const changedCount = result?.changed;
    rec.renamed = chosen.size;
    if (typeof changedCount === 'number' && changedCount !== chosen.size) rec.failures.push({ kind: 'COUNT', text: `applyBoneNames reported ${changedCount} changed, ${chosen.size} were ticked` });

    // only Bones/Helpers renamed, and only Name changed
    for (const id of chosen) if (!boneIds.has(id) && !helperIds.has(id)) rec.failures.push({ kind: 'SCOPE', text: `renamed #${id} "${nodes.get(id)?.Name}" which is not a Bone or Helper` });
    const normal = structuredClone(copy);
    for (const node of anim.allNodes(normal)) if (chosen.has(node.ObjectId)) node.Name = nodes.get(node.ObjectId)?.Name;
    // allNodes returns the live node objects, so the restore above edited `normal` itself
    if (!same(normal, pristine)) rec.failures.push({ kind: 'SCOPE', text: 'something other than node names changed' });
    const wrong = rows.filter(r => chosen.has(r.id) && nodes.get(r.id) && anim.allNodes(copy).find(n => n.ObjectId === r.id)?.Name !== r.name);
    if (wrong.length) rec.failures.push({ kind: 'APPLY', text: `${wrong.length} bones did not get their proposed name, e.g. ${wrong[0].id} "${wrong[0].name}"` });

    // stability: a second default run on the renamed copy must change nothing
    {
      const second = structuredClone(copy), plan2 = namer.planBoneNames(second), ch2 = new Set((plan2?.rows || []).filter(r => r.name !== r.current).map(r => r.id));
      if (ch2.size) rec.failures.push({ kind: 'STABILITY', text: `${ch2.size} bones renamed on a second run: ${plan2.rows.filter(r => ch2.has(r.id)).slice(0, 6).map(r => `${r.current} -> ${r.name}`).join('; ')}` });
    }
    const copyNodes = new Map(anim.allNodes(copy).map(n => [n.ObjectId, n]));
    const names = checkNames(copy, chosen, copyNodes, sequence, frame);
    for (const text of names.problems) rec.failures.push({ kind: 'NAME', text });
    rec.review.push(...names.review);

    if (before) {
      let after = null;
      try { after = runPose(copy, copyNodes, sequence, frame); } catch (error) { rec.failures.push({ kind: 'POSE-CRASH', text: `POSE threw on the renamed copy: ${error.message}` }); }
      if (after) {
        const d = compare(before, after, nodes, copyNodes, copy);
        for (const text of d.lost) rec.failures.push({ kind: 'LOST', text });
        for (const text of d.moved) rec.failures.push({ kind: 'MOVED', text });
        for (const text of d.grips) rec.failures.push({ kind: 'GRIP', text });
        rec.review.push(...d.tracked);
        for (const text of d.rerooted) rec.review.push({ kind: 'RE-ROOTED', text });
        for (const text of d.retyped) rec.review.push({ kind: 'RETYPED', text });
        for (const text of d.gained) rec.review.push({ kind: 'GAINED', text });
        rec.review.push(...d.extra);
        rec.handles = { limbs: before.limbs.length, parts: before.parts.length, body: before.body != null };
      }
    }
  } catch (error) {
    rec.failures.push({ kind: error.parse ? 'PARSE' : 'CRASH', text: String(error?.message || error).slice(0, 400) });
    if (!error.parse) rec.stack = String(error?.stack || '').split('\n').slice(0, 4).join(' | ');
  }
  rec.ms = Math.round(performance.now() - start);
  report.push(rec);
  if (index % 50 === 0) console.log(`  ${index}/${files.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
}

// ---------- reports ----------
const elapsed = Math.round((Date.now() - t0) / 1000);
const failed = report.filter(r => r.failures.some(f => f.kind !== 'PARSE')), parseFail = report.filter(r => r.failures.some(f => f.kind === 'PARSE'));
const scanned = report.filter(r => !r.failures.some(f => f.kind === 'PARSE'));
const totBones = scanned.reduce((n, r) => n + r.bones + r.helpers, 0), totRenamed = scanned.reduce((n, r) => n + r.renamed, 0);
const actorTally = {};
for (const r of scanned) for (const k of r.actors) actorTally[k] = (actorTally[k] || 0) + 1;
const failTally = {}, reviewTally = {};
for (const r of report) { for (const f of r.failures) failTally[f.kind] = (failTally[f.kind] || 0) + 1; for (const f of r.review) reviewTally[f.kind] = (reviewTally[f.kind] || 0) + 1; }

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ namer: namerPath, models: modelsRoot, scanned: report.length, duplicatesSkipped: duplicates, elapsedSeconds: elapsed, results: report }, null, 1));
const md = [];
md.push('# Bone Namer library gate', '', `Namer: ${namerPath}`, `Models: ${modelsRoot}`, '',
  `- models scanned: ${report.length} (parse failures: ${parseFail.length}; exact duplicates skipped: ${duplicates.length})`,
  `- run time: ${elapsed} s`,
  `- models failing the gate: ${failed.length}`,
  `- failures by kind: ${Object.entries(failTally).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`,
  `- review items by kind: ${Object.entries(reviewTally).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`,
  `- actors by kind: ${Object.entries(actorTally).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`, '');
md.push(`## Failures (${failed.length} models)`, '');
if (!failed.length) md.push('None.', '');
for (const r of failed) { md.push(`### ${r.file}`); for (const f of r.failures) md.push(`- ${f.kind}: ${f.text}`); if (r.stack) md.push(`  - ${r.stack}`); md.push(''); }
md.push('## Review lists', '', `GRIP-TRACKED and HEAD-TRACKED are caused by main's POSE rules, tracked (pose-ik.js:207 and :164): GRIP-TRACKED ${reviewTally['GRIP-TRACKED'] || 0} limbs in ${report.filter(r => r.review.some(f => f.kind === 'GRIP-TRACKED')).length} models, HEAD-TRACKED ${reviewTally['HEAD-TRACKED'] || 0} in ${report.filter(r => r.review.some(f => f.kind === 'HEAD-TRACKED')).length} models.`, '');
for (const kind of ['RETYPED', 'GAINED', 'FOLLOWERS', 'CARRIERS', 'CASE-DUPLICATE', 'SIDE-NEAR-ZERO', 'RE-ROOTED', 'GRIP-TRACKED', 'HEAD-TRACKED']) {
  const withKind = report.filter(r => r.review.some(f => f.kind === kind));
  md.push(`### ${kind} (${reviewTally[kind] || 0} items in ${withKind.length} models)`, '');
  for (const r of withKind) md.push(`- ${r.file}: ${r.review.filter(f => f.kind === kind).map(f => f.text).join(' | ')}`);
  md.push('');
}
const notes = report.filter(r => r.notes.length);
md.push(`## Notes (${notes.length} models)`, '', ...notes.map(r => `- ${r.file}: ${r.notes.join(' | ')}`), '');
md.push('## Bones renamed', '', `- ${totRenamed} of ${totBones} bones and helpers over ${scanned.length} models (${totBones ? (100 * totRenamed / totBones).toFixed(1) : 0}%)`,
  `- models where nothing was renamed: ${scanned.filter(r => !r.renamed).length}`, '');
fs.writeFileSync(path.join(outDir, 'summary.md'), md.join('\n'));

console.log(`scanned ${report.length} models (${parseFail.length} parse failures, ${duplicates.length} duplicates skipped) in ${elapsed} s`);
console.log(`failing models: ${failed.length}; failures: ${JSON.stringify(failTally)}; review: ${JSON.stringify(reviewTally)}`);
const gripOnly = report.filter(r => r.failures.length && r.failures.every(f => f.kind === 'GRIP')).length;
console.log(`GRIP: ${failTally.GRIP || 0} limbs in ${report.filter(r => r.failures.some(f => f.kind === 'GRIP')).length} models (${gripOnly} models fail on GRIP only); STABILITY: ${failTally.STABILITY || 0} models`);
console.log(`renamed ${totRenamed} of ${totBones} bones/helpers; report in ${outDir}`);
process.exit(failed.length ? 1 : 0);
