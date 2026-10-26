import { encodeAiValue, decodeAiValue, pointer } from '../src/ai-model.js';
import { ignoreHistoryAlias } from '../src/editor-document.js';
import { createChanges } from '../src/history-store.js';
import { prepareModelSaveAsync } from './model-save.js';

export async function aiCheckpoint(
  bridge,
  id,
  { includeBaseline = false, baseline, restore, restoreReview } = {},
) {
  const target = bridge.requireTarget(id);
  if (restore) {
    const { live, session } = bridge.env(target);
    if (
      session.paintProject?.dirty ||
      Object.keys(session.uvPreviews || {}).length ||
      Object.keys(session.animationDrafts || {}).length
    )
      throw Error('Apply or cancel the current preview before resuming this task.');
    if (live) {
      await bridge.host().restoreContext(restore);
      bridge.advance(id, true);
    } else {
      // A tab that is not showing resumes with the task's own selection and view.
      Object.assign(target, {
        selection: structuredClone(restore.selection),
        sequence: restore.sequence,
        globalSequence: restore.globalSequence,
        frame: restore.frame,
        keyframes: structuredClone(restore.keyframes ?? null),
        workplane: restore.workplane,
        restore: structuredClone(restore),
      });
      bridge.host().selectIn(target.documentId, {
        vertices: restore.selection,
        nodeIds: restore.selectedNodeIds,
        geosetIds: restore.checkedGeosets,
        activeGeoset: restore.activeGeoset,
      });
      bridge.advance(id);
    }
  }
  if (baseline)
    target.review = {
      before: decodeAiValue(baseline),
      changed: restoreReview?.changed === true,
      phase: restoreReview?.changed ? 'pending' : 'unchanged',
      changes: restoreReview?.changes || [],
      animation: !!restoreReview?.animation,
    };
  const { doc, session } = bridge.env(target);
  const bytes = (await prepareModelSaveAsync(doc, 'mdx')).bytes;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  bridge.requireTarget(id);
  return {
    fingerprint: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''),
    path: session.path || null,
    name: doc.name,
    context: bridge.context(id),
    review: reviewStatus(target.review),
    ...(includeBaseline && target.review ? { baseline: encodeAiValue(target.review.before) } : {}),
  };
}
export const reviewStatus = review => ({
  changed: !!review?.changed,
  phase: review?.phase || 'unchanged',
  changes: review?.changes || [],
  animation: !!review?.animation,
  summary: review?.summary || '',
});
export async function beginAiReview(bridge, id, options) {
  const target = bridge.requireTarget(id);
  if (target.review) return target.review;
  const before = structuredClone(bridge.env(target).model);
  // Review pictures are drawn off-screen, so before and after match whichever tab shows.
  const image = (await bridge.picture(id)).image;
  bridge.requireTarget(id);
  return (target.review = {
    before,
    image,
    changed: false,
    phase: 'unchanged',
    changes: [],
    animation: false,
  });
}
const containsTrack = value =>
  value &&
  typeof value === 'object' &&
  !ArrayBuffer.isView(value) &&
  (Array.isArray(value.Keys) || Object.values(value).some(containsTrack));
export function recordAiChange(review, result, model) {
  review.changed = true;
  review.phase = 'pending';
  delete review.inspectedRevision;
  delete review.summary;
  const changes = createChanges(review.before, model, { ignore: ignoreHistoryAlias });
  review.changes = changes.slice(0, 100).map(c => ({ path: pointer(c.path), kind: c.kind }));
  review.animation ||= changes.some(
    c =>
      /\/(?:Sequences|GlobalSequences)(?:\/|$)|\/Keys(?:\/|$)/.test(pointer(c.path)) ||
      containsTrack(c.before) ||
      containsTrack(c.after),
  );
}
export async function reviewAiModel(bridge, args, options) {
  const target = bridge.requireTarget(args.target),
    review = target.review;
  if (args.action === 'status') return reviewStatus(review);
  if (!review?.changed) return { changed: false, phase: 'unchanged' };
  if (args.action === 'finish') {
    if (typeof args.summary !== 'string' || !args.summary.trim()) throw Error('Explain the review result.');
    if (
      args.outcome === 'passed' &&
      (review.phase !== 'inspected' ||
        review.inspectedRevision !== bridge.env(target).doc.revision ||
        !review.passed)
    )
      throw Error('Inspect and pass the current model checks and images before completing the task.');
    review.phase =
      args.outcome === 'passed' ? 'verified' : args.outcome === 'needs-correction' ? 'correcting' : 'blocked';
    review.summary = args.summary;
    if (Array.isArray(args.criteria)) review.criteria = args.criteria;
    return reviewStatus(review);
  }
  if (args.action !== 'inspect') throw Error('Unknown review action.');
  if (typeof args.checksCode !== 'string' || !args.checksCode.trim())
    throw Error(
      'Provide read-only checksCode returning [{name,passed,actual?,expected?}] for the requested result. The original model is available as before.',
    );
  const env = bridge.env(target),
    revision = env.doc.revision,
    state = env.state;
  const tested = await window.desktop.aiScript({
    requestId: options.requestId,
    code: args.checksCode,
    model: structuredClone(state.model),
    before: structuredClone(review.before),
    selection: structuredClone(target.selection),
    context: bridge.contextFor(args.target),
    references: {},
  });
  bridge.requireTarget(args.target);
  if (
    createChanges(state.model, tested.model, { ignore: ignoreHistoryAlias }).length ||
    createChanges(review.before, tested.before, { ignore: ignoreHistoryAlias }).length
  )
    throw Error(
      'Verification code must inspect model and before without changing either. Use an edit tool to correct the result, then inspect again.',
    );
  const checks = encodeAiValue(tested.value);
  if (
    !Array.isArray(checks) ||
    !checks.length ||
    checks.length > 100 ||
    checks.some(c => !c || typeof c.name !== 'string' || !c.name.trim() || typeof c.passed !== 'boolean')
  )
    throw Error('Verification must return 1–100 named checks with boolean passed results.');
  const validation = await bridge.dispatch(
    'mdlxl_document',
    { target: args.target, action: 'validate' },
    options,
  );
  const images = [],
    poses = [];
  if (review.image) images.push({ label: 'Before the task', image: review.image });
  images.push({ label: 'After the edit', image: (await bridge.picture(args.target)).image });
  if (args.turnaround)
    // The result from every side: a part that only works from the front shows here.
    // Drawn off-screen, so the user's own view and camera never move.
    for (const side of ['front', 'back', 'left', 'right']) {
      bridge.requireTarget(args.target);
      images.push({
        label: `After the edit; ${side} view`,
        image: (await bridge.picture(args.target, { view: side })).image,
      });
    }
  if (review.animation) {
    const interval =
      state.globalSeqId == null
        ? state.model.Sequences[state.sequence]?.Interval
        : [0, state.model.GlobalSequences[state.globalSeqId]];
    const samples =
      args.frames || (interval ? [interval[0], (interval[0] + interval[1]) / 2, interval[1]] : []);
    if (new Set(samples).size < 3)
      throw Error(
        'Animation verification needs at least three distinct frames. Select the edited sequence and provide frames.',
      );
    poses.push(await bridge.dispatch('mdlxl_sample', { target: args.target, frames: samples }, options));
    for (const frame of samples) {
      bridge.requireTarget(args.target);
      images.push({
        label: `After; animation frame ${frame}`,
        image: (await bridge.picture(args.target, { frame })).image,
      });
    }
  }
  bridge.requireTarget(args.target);
  const current = bridge.env(target);
  const drafts =
    !!current.session.paintProject?.dirty ||
    Object.keys(current.session.uvPreviews || {}).length > 0 ||
    Object.keys(current.session.animationDrafts || {}).length > 0;
  const structural = validation.results.every(
    r => !r.error && !r.readOnly && !r.diagnostics?.some(d => d.severity === 'error'),
  );
  review.passed = checks.every(c => c.passed) && structural && !drafts && current.doc.revision === revision;
  review.phase = 'inspected';
  review.inspectedRevision = revision;
  return {
    review: {
      ...reviewStatus(review),
      passed: review.passed,
      checks,
      validation,
      poses,
      pendingPreviews: !!drafts,
      next: args.turnaround
        ? 'Inspect every image, including each side view. Name the weakest visible spot from each side (gaps, clipping, flat or floating parts, unpainted or noisy texture). Correct failures, or call mdlxl_review finish with outcome passed and a short visual assessment. Structural checks do not prove appearance.'
        : 'Inspect the images. Correct failures, or call mdlxl_review finish with outcome passed and a short visual assessment. Structural checks do not prove appearance.',
    },
    images,
  };
}
