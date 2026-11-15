// Offline count only. Never imported by the application or its optimizer.
// How many Hive-similar small turns the production redundant-key owner now
// removes across the frozen corpus, compared with the protected-turn study.
// Usage:
//   node optimizexl-small-turn-corpus.mjs run <manifest> <outDir> [workers] [studyKeys.jsonl]
//   node optimizexl-small-turn-corpus.mjs one <manifest> <outDir> <sha256>
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { visitTracks } from '../../src/animation.js';
import { redundantTrackProposals } from '../../src/optimizexl-redundant-tracks.js';
import { load, at } from './optimizexl-unused-study-lib.mjs';

function countModel(item) {
  const started = Date.now(), { model } = load(item), entries = [];
  visitTracks(model, (track, { path }) => entries.push({ track, path }));
  const plans = redundantTrackProposals(model, entries), removed = [], kept = [];
  for (const p of plans) {
    const track = at(model, p.path), row = f => ({ path: p.path.join('.'), sequence: p.globalSequence != null ? `Global sequence ${p.globalSequence + 1}` : model.Sequences[p.sequence].Name, frame: f, lineType: track.LineType });
    for (const f of p.smallTurns || []) removed.push(row(f));
    for (const f of p.preservedTurns) kept.push(row(f));
  }
  return { ...item, status: 'ok', removed, kept, seconds: (Date.now() - started) / 1000 };
}

async function studyPrediction(file) {
  // Single-key study rows the production boundary should match: authoredTurn,
  // linear, local, ordered, unit, within 0.25% of the part (mesh) and the same
  // absolute distance (effect pivots). Billboarded here means the study's whole
  // influence chain, wider than production's node-and-ancestors rule.
  const keys = new Map(), lines = readline.createInterface({ input: fs.createReadStream(file) });
  for await (const line of lines) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (!r.authoredTurn || r.lineType !== 1) continue;
    const f = r.flags, ok = !f.global && !f.overlap && !f.invalidKeyOrder && !f.nonUnitQuaternion && r.partPct != null && r.partPct <= .25 && r.nonMeshMax <= r.partSize * .0025;
    keys.set(`${r.sha256}|${r.path.join('.')}|${r.sequenceName}|${r.frame}`, { ok, billboarded: f.billboarded, partPct: r.partPct, model: r.model, checkerThrew: r.checkerThrew });
  }
  return keys;
}

const [mode, manifestPath, output, arg, studyKeys] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, ''));
const unique = [...new Map(manifest.files.map(x => [x.sha256, x])).values()].sort((a, b) => a.sha256.localeCompare(b.sha256));
const models = path.join(output, 'models'); fs.mkdirSync(models, { recursive: true });
if (mode === 'one') {
  const item = unique.find(x => x.sha256 === arg); let report;
  try { report = countModel(item); } catch (e) { report = { ...item, status: 'error', error: String(e.message).slice(0, 300) }; }
  fs.writeFileSync(path.join(models, item.sha256 + '.json'), JSON.stringify(report));
} else if (mode === 'run') {
  const workers = Number(arg) || 6, self = fileURLToPath(import.meta.url), queue = [...unique].sort((a, b) => b.bytes - a.bytes); let cursor = 0, complete = 0;
  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++], file = path.join(models, item.sha256 + '.json');
      if (fs.existsSync(file)) { complete++; continue; }
      await new Promise(resolve => {
        const p = spawn(process.execPath, ['--max-old-space-size=4096', self, 'one', manifestPath, output, item.sha256], { windowsHide: true, stdio: 'ignore' });
        const timer = setTimeout(() => p.kill(), 30 * 60 * 1000);
        p.on('exit', code => { clearTimeout(timer); if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ ...item, status: 'error', error: `child exited ${code}` })); if (++complete % 50 === 0) console.log(complete, '/', queue.length); resolve(); });
      });
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  const reports = unique.map(x => JSON.parse(fs.readFileSync(path.join(models, x.sha256 + '.json'))));
  const ok = reports.filter(r => r.status === 'ok'), removed = ok.flatMap(r => r.removed.map(k => ({ ...k, sha256: r.sha256, model: r.relativePath })));
  const kept = ok.flatMap(r => r.kept.map(k => ({ ...k, sha256: r.sha256 })));
  const summary = {
    inputs: unique.length, ok: ok.length, errors: reports.filter(r => r.status !== 'ok').map(r => [r.relativePath, r.error]),
    removedKeys: removed.length, modelsWithRemovals: new Set(removed.map(k => k.sha256)).size,
    keptTurnKeys: kept.length, keptLinear: kept.filter(k => k.lineType === 1).length, keptCubic: kept.filter(k => k.lineType >= 2).length,
    modelsWithTurns: new Set([...removed, ...kept].map(k => k.sha256)).size,
    modelsAllTurnsCleared: ok.filter(r => r.removed.length && !r.kept.length).length,
    modelsAllLinearTurnsCleared: ok.filter(r => r.removed.length && !r.kept.some(k => k.lineType === 1)).length,
  };
  if (studyKeys) {
    const predicted = await studyPrediction(studyKeys), key = k => `${k.sha256}|${k.path}|${k.sequence}|${k.frame}`;
    const removedSet = new Set(removed.map(key)), studyOk = [...predicted].filter(([, v]) => v.ok), studyOkPlain = studyOk.filter(([, v]) => !v.billboarded);
    summary.study = {
      linearTurnRows: predicted.size, predictedSingleKey: studyOk.length, predictedSingleKeyNotBillboarded: studyOkPlain.length,
      removedAndPredicted: studyOk.filter(([k]) => removedSet.has(k)).length,
      predictedNotBillboardedButKept: studyOkPlain.filter(([k]) => !removedSet.has(k)).map(([k, v]) => [k, v.partPct]),
      removedButStudyAbove: removed.filter(k => predicted.get(key(k)) && !predicted.get(key(k)).ok).map(k => [key(k), predicted.get(key(k)).partPct]),
      removedNotInStudy: removed.filter(k => !predicted.has(key(k))).length,
    };
  }
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ ...summary, study: summary.study && { ...summary.study, predictedNotBillboardedButKept: summary.study.predictedNotBillboardedButKept.length, removedButStudyAbove: summary.study.removedButStudyAbove.length } }, null, 1));
} else throw Error('Use one or run');
