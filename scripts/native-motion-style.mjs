// Builds docs/AI-SD-MOTION-STYLE.json: the motion style of Blizzard SD unit animations by kind (key
// count and spacing, measured interpolation, strike and impact timing, holds), measured with the
// same src/ai-motion-style.js the AI uses, so the AI can compare a clip with Blizzard without a donor.
// Usage: node scripts/native-motion-style.mjs [corpus folder]   (default: the test models' corpus-sd)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { motionStyle } from '../src/ai-motion-style.js';

const { testModel } = createRequire(import.meta.url)('../test/helpers/fixtures.cjs');
const folder = path.resolve(process.argv[2] || testModel('corpus-sd'));
const files = fs.readdirSync(folder).filter(name => /\.mdx$/i.test(name)).sort();
const values = {};
let clips = 0, failures = 0;
for (const name of files) {
  let model;
  try { model = openDocument(fs.readFileSync(path.join(folder, name)), name).model; } catch { failures++; continue; }
  (model.Sequences || []).forEach((_, sequence) => {
    try {
      const style = motionStyle(model, sequence, { step: 20 });
      if (['decay', 'portrait', 'other'].includes(style.kind)) return;
      const kind = values[style.kind] ||= { clips: 0 };
      kind.clips++; clips++;
      const add = (metric, value) => { if (value != null && Number.isFinite(value)) (kind[metric] ||= []).push(value); };
      add('durationMs', style.durationMs);
      add('keysPerTrack', style.keys.perTrack.median);
      add('spacingMs', style.keys.spacingMs?.median);
      add('linear', style.interpolation.measured.linear);
      add('strikePct', style.strike?.pct);
      add('impactPct', style.impact?.pct);
      add('holdShare', style.holds?.share);
    } catch { failures++; }
  });
}
const quantiles = list => {
  const sorted = [...list].sort((a, b) => a - b), at = p => sorted[Math.floor(p * (sorted.length - 1))];
  return { count: sorted.length, min: sorted[0], p10: at(.1), p25: at(.25), median: at(.5), p75: at(.75), p90: at(.9), p95: at(.95), max: sorted.at(-1) };
};
const kinds = Object.fromEntries(Object.entries(values).sort().map(([kind, metrics]) =>
  [kind, Object.fromEntries(Object.entries(metrics).map(([metric, list]) => [metric, metric === 'clips' ? list : quantiles(list)]))]));
const out = {
  schema: 1,
  source: `MDLxL src/ai-motion-style.js (step 20 ms) over ${files.length} Blizzard SD unit models of the test-model corpus (corpus-sd, from the installed game); ${clips} clips; ${failures} unreadable clips or models skipped. Decay and portrait clips left out.`,
  definitions: 'keysPerTrack and spacingMs: the clip median over its active local bone/helper transform tracks; linear: share of keyed segments whose sampled shape stays within 5% of linear interpolation; strikePct: when the fastest part moves fastest; impactPct: when it drops below a quarter of that speed after the strike; holdShare: share of the clip with whole-body speed under 10% of its peak. Quantiles describe Blizzard clips; they are not targets.',
  kinds,
};
fs.writeFileSync(new URL('../docs/AI-SD-MOTION-STYLE.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${files.length} models, ${clips} clips, ${failures} skipped`);
