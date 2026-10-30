// Private paths are supplied locally. Inputs are parsed as model/JSON data only.
// node test/manual/ai-motion-compare-replay.mjs before.mdx after.mdx [--step ms]
// or --manifest private.json: [{before,after,expected?,channels?:[{name,path,from,to,samples}]}]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { openDocument } from '../../src/editor-document.js';
import { compareMotion, motionTable } from '../../src/ai-motion-compare.js';

const args = process.argv.slice(2), option = name => {
  const at = args.indexOf(name); if (at < 0) return undefined;
  if (!args[at + 1]) throw Error(name + ' needs a value.');
  return args.splice(at, 2)[1];
};
const manifest = option('--manifest'), output = option('--out'), step = option('--step');
const pairs = manifest ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : [{ before: args[0], after: args[1] }];
if (!pairs.length || pairs.some(p => !p.before || !p.after)) throw Error('Supply before/after model paths or --manifest.');
const load = file => openDocument(new Uint8Array(fs.readFileSync(file)), path.basename(file)).model;
const reports = [];
for (const pair of pairs) {
  const started = performance.now(), motion = compareMotion(load(pair.before), load(pair.after), { ...(step ? { step: Number(step) } : {}) });
  if (pair.expected) {
    const expected = JSON.parse(fs.readFileSync(pair.expected, 'utf8'));
    for (const reference of expected.rows) {
      const actual = motion.sequences.find(s => s.name === reference.sequence);
      assert.ok(actual && !actual.missing, reference.sequence);
      for (const [value, wanted, label] of [[actual.distance.distance, reference.maxDev, 'max'], [actual.distance.p95, reference.p95FrameMax, 'p95'],
        [actual.speedDifference.difference, reference.maxVelErr, 'speed'], [actual.endpoints.start, reference.startDev, 'start'], [actual.endpoints.end, reference.endDev, 'end']])
        assert.ok(Math.abs(value - wanted) <= .00051, `${reference.sequence} ${label}: ${value} versus ${wanted}`);
    }
  }
  for (const expected of pair.channels || []) {
    const row = motion.sequences.find(s => s.name === expected.name), channel = row?.channels.find(c => c.path === expected.path);
    assert.ok(channel, 'Missing channel ' + expected.path);
    assert.ok(channel.spans.some(s => ['from', 'to', 'samples'].every(k => expected[k] === undefined || s[k] === expected[k])), JSON.stringify(expected));
  }
  const report = { before: path.basename(pair.before), after: path.basename(pair.after), seconds: (performance.now() - started) / 1000, ...motionTable(motion) };
  reports.push(report);
  console.log(JSON.stringify({ after: report.after, seconds: report.seconds, rows: motion.sequences.map(s => ({ name: s.name, max: s.distance?.distance, speed: s.speedDifference?.difference, channels: s.channels?.map(c => ({ path: c.path, max: c.max, spans: c.spans })) })) }));
}
if (output) fs.writeFileSync(output, JSON.stringify(reports, null, 2) + '\n');
