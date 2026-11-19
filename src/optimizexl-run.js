// OptimizeXL stages as one call on a model, with the same settings object the OptimizeXL window uses
// (simpleSettings or its Advanced fields), and a planner that reports what reaching a size would take.
// Neither changes the model you pass: they return a candidate; commit it with applyOptimized inside
// one Undo step (scope: every section the model has, as the OptimizeXL recipe in the guide does).
import { openDocument } from './editor-document.js';
import { STAGES, simpleSettings, runOptimizeStage, triangleCount } from './optimizexl.js';

export const OPTIMIZE_STAGES = STAGES.map(stage => stage.id);

function snapshot(model) {
  const doc = openDocument('Version { FormatVersion ' + model.Version + ', }\nModel "AI working copy" { BlendTime 150, }', 'working.mdl');
  doc.apply('Working model snapshot', Object.keys(model).filter(key => key !== 'Nodes'), working => { Object.assign(working, structuredClone(model)); });
  return doc;
}

/** The size in bytes the model would have saved as MDX. */
export function modelBytes(model) { return snapshot(model).serialize('mdx').byteLength; }

/**
 * Runs one OptimizeXL stage ('sanity', 'duplicates', 'animation', 'unused', 'irregularities', 'spheres', 'nuclear')
 * on a copy of `model`. `settings` is the window's settings object; leave it out for the window's own defaults at
 * `strength` 0-100 (the slider; `mode` 'world' for world-space animation reduction). `fix` is one finding for the
 * Insanity and Irregularities fixers. Returns { candidate (a model), report (bytes, saved, stats, review...), settings }.
 */
export function optimizeModelStage(model, stage, { settings, strength = 0, mode, fix = null } = {}) {
  if (!OPTIMIZE_STAGES.includes(stage)) throw Error('Unknown OptimizeXL stage: ' + stage + '. Use one of ' + OPTIMIZE_STAGES.join(', ') + '.');
  const doc = snapshot(model), source = doc.serialize('mdx'), used = settings ?? simpleSettings(stage, strength, doc.model, mode);
  const report = runOptimizeStage(source, stage, used, fix);
  return { candidate: openDocument(report.bytes, 'candidate.mdx').model, report, settings: used };
}

/** Puts a candidate from optimizeModelStage into `model` (call inside one Undo step). */
export function applyOptimized(model, candidate) { return Object.assign(model, candidate); }

/**
 * What it would take to get `model` to `targetBytes` (and/or `targetTriangles`) with OptimizeXL, without changing it:
 * the safest stages first (unused data, duplicates, then animation at rising strength), then Nuclear only when a
 * triangle target is given. Returns { startBytes, endBytes, reached, steps: [{ stage, strength, bytes, saved,
 * triangles }], candidate }. Steps that saved nothing are left out; stop at the step you accept by running
 * optimizeModelStage with the same stage and strength.
 */
export function planToSize(model, { targetBytes, targetTriangles, strengths = [0, 25, 50, 75, 100] } = {}) {
  if (!(targetBytes > 0) && !(targetTriangles > 0)) throw Error('Give targetBytes and/or targetTriangles.');
  let current = model, bytes = modelBytes(model);
  const startBytes = bytes, steps = [];
  const done = () => (!(targetBytes > 0) || bytes <= targetBytes) && (!(targetTriangles > 0) || triangleCount(current) <= targetTriangles);
  const run = (stage, strength, settings) => {
    const out = optimizeModelStage(current, stage, { strength, settings }), now = out.report.afterBytes;
    if (out.report.changed && (now < bytes || stage === 'nuclear')) {
      steps.push({ stage, strength, bytes: now, saved: bytes - now, triangles: out.report.triangles });
      current = out.candidate; bytes = now;
    }
  };
  if (!done()) run('unused', 0);
  if (!done()) run('duplicates', 0);
  for (const strength of strengths) if (!done()) run('animation', strength);
  if (!done() && targetTriangles > 0) run('nuclear', 100, { ...simpleSettings('nuclear', 0, current), target: Math.round(targetTriangles) });
  return { startBytes, endBytes: bytes, reached: done(), steps, candidate: current === model ? null : current };
}
