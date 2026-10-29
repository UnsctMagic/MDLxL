// Duplicate-block scanner: finds runs of >= WINDOW normalized lines that appear
// in two or more places across the given files. Usage: node dupscan.mjs <listfile> [window]
import fs from 'node:fs';
import crypto from 'node:crypto';

const listFile = process.argv[2];
const WINDOW = Number(process.argv[3] || 8);
const files = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).filter(Boolean);

function normalize(line) {
  let s = line.replace(/\/\/.*$/, '').trim();
  s = s.replace(/\s+/g, ' ');
  return s;
}
const trivial = new Set(['', '{', '}', '};', ');', '});', ']', '],', '})', ')', 'else {', '} else {', 'return;', 'break;', 'try {', '} catch (error) {', '} catch {', '} finally {']);

const index = new Map(); // hash -> [{file, start, end}]
const perFile = new Map();
for (const file of files) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const raw = text.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const n = normalize(raw[i]);
    if (trivial.has(n) || n.startsWith('import ') || n.startsWith('*') || n.startsWith('/*')) continue;
    lines.push({ n, lineNo: i + 1 });
  }
  perFile.set(file, lines);
  for (let i = 0; i + WINDOW <= lines.length; i++) {
    const key = crypto.createHash('md5').update(lines.slice(i, i + WINDOW).map(l => l.n).join('\n')).digest('hex');
    let arr = index.get(key);
    if (!arr) index.set(key, arr = []);
    arr.push({ file, i });
  }
}

// Merge consecutive duplicate windows into blocks per pair of locations.
const pairBlocks = new Map(); // key fileA|fileB -> array of {aStart,bStart,len}
for (const [, locs] of index) {
  if (locs.length < 2) continue;
  for (let x = 0; x < locs.length; x++) for (let y = x + 1; y < locs.length; y++) {
    const a = locs[x], b = locs[y];
    if (a.file === b.file && Math.abs(a.i - b.i) < WINDOW) continue;
    const key = a.file + '|' + b.file;
    let arr = pairBlocks.get(key);
    if (!arr) pairBlocks.set(key, arr = []);
    arr.push({ a: a.i, b: b.i });
  }
}
const blocks = [];
for (const [key, arr] of pairBlocks) {
  arr.sort((p, q) => p.a - q.a || p.b - q.b);
  const [fa, fb] = key.split('|');
  let cur = null;
  for (const p of arr) {
    if (cur && p.a === cur.aEnd + 1 && p.b === cur.bEnd + 1) { cur.aEnd = p.a; cur.bEnd = p.b; }
    else { if (cur) blocks.push(cur); cur = { fa, fb, aStart: p.a, aEnd: p.a, bStart: p.b, bEnd: p.b }; }
  }
  if (cur) blocks.push(cur);
}
for (const b of blocks) {
  b.len = b.aEnd - b.aStart + WINDOW;
  const la = perFile.get(b.fa), lb = perFile.get(b.fb);
  b.aLine = la[b.aStart].lineNo; b.aLineEnd = la[Math.min(b.aEnd + WINDOW - 1, la.length - 1)].lineNo;
  b.bLine = lb[b.bStart].lineNo; b.bLineEnd = lb[Math.min(b.bEnd + WINDOW - 1, lb.length - 1)].lineNo;
  b.sample = la.slice(b.aStart, b.aStart + 3).map(l => l.n).join(' | ').slice(0, 160);
}
blocks.sort((p, q) => q.len - p.len);
const totalDupLines = blocks.reduce((s, b) => s + b.len, 0);
console.log(`files=${files.length} window=${WINDOW} duplicate blocks=${blocks.length} duplicated normalized lines (sum over pairs)=${totalDupLines}`);
console.log('');
for (const b of blocks.slice(0, Number(process.env.TOP || 80))) {
  console.log(`${String(b.len).padStart(4)}  ${b.fa}:${b.aLine}-${b.aLineEnd}  <->  ${b.fb}:${b.bLine}-${b.bLineEnd}`);
  console.log(`      ${b.sample}`);
}
// Per-file duplicate involvement
const perFileDup = new Map();
for (const b of blocks) { perFileDup.set(b.fa, (perFileDup.get(b.fa) || 0) + b.len); perFileDup.set(b.fb, (perFileDup.get(b.fb) || 0) + b.len); }
console.log('\nMost-involved files:');
for (const [f, n] of [...perFileDup].sort((p, q) => q[1] - p[1]).slice(0, 30)) console.log(`${String(n).padStart(5)}  ${f}`);
