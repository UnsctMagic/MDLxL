import { createChanges, applyChanges } from '../src/history-store.js';
import { NODE_COLLECTION_KEYS } from '../src/animation.js';
import { ignoreHistoryAlias, recalculateExtents } from '../src/editor-document.js';

const changes = (before, after) => createChanges(before, after, { ignore: ignoreHistoryAlias });

// Keep the exact unsaved document at Send and after each edit the job itself commits.
// Only construct a second EditorDocument if the live editor actually diverges.
export function captureJobBase(source) {
  return { recovery: source.doc.captureRecoveryState({ includeHistory: false }), assets: new Map(source.assets),
    paintRevision: source.paintWorkingRevision, uvPreviews: source.uvPreviews, animationDrafts: source.animationDrafts, resultSelection: null };
}

export function forkJob(bridge, target) {
  const job = target.job;
  job.draft = bridge.host().makeAiDraft(job.recovery, job.assets, target.restore);
  target.revision = job.draft.doc.revision;
  return job.draft;
}

export function changedSource(job, source) {
  return source.doc.revision !== job.recovery.revision || (source.paintProject?.dirty && source.paintWorkingRevision !== job.paintRevision) ||
    source.uvPreviews !== job.uvPreviews || source.animationDrafts !== job.animationDrafts;
}

// Index model paths so checking independent edits does not compare every keyframe with every other.
function changeIndex(edits) {
  const owners = new Map(), parents = new Set();
  for (const edit of edits) {
    const key = JSON.stringify(edit.path);
    if (!owners.has(key)) owners.set(key, []);
    owners.get(key).push(edit);
    for (let i = 1; i < edit.path.length; i++) parents.add(JSON.stringify(edit.path.slice(0, i)));
  }
  return edit => {
    const key = JSON.stringify(edit.path);
    if (parents.has(key)) return true;
    for (let i = 1; i < edit.path.length; i++) if (owners.has(JSON.stringify(edit.path.slice(0, i)))) return true;
    return (owners.get(key) || []).some(other => edit.kind !== 'bytes' || other.kind !== 'bytes' ||
      (edit.offset < other.offset + other.after.length && other.offset < edit.offset + edit.after.length));
  };
}

function checkMerge(job, diff, result) {
  const candidateEdits = changes(job.merge.ancestor, job.merge.candidate);
  const userEdits = changes(job.merge.ancestor, job.recovery.model);
  const inCandidate = changeIndex(candidateEdits), inUser = changeIndex(userEdits);
  const inResult = changeIndex(diff);
  const lostUser = userEdits.find(edit => !inCandidate(edit) && inResult(edit));
  if (lostUser) return 'Restore the latest user value at ' + JSON.stringify(lostUser.path) + '. It was outside the AI candidate edits.';
  const differsFromCandidate = changeIndex(changes(job.merge.candidate, result));
  const lostCandidate = candidateEdits.find(edit => !inUser(edit) && differsFromCandidate(edit));
  if (lostCandidate) return 'Carry the candidate change at ' + JSON.stringify(lostCandidate.path) + ' into the latest model. The user did not edit it.';
}

const isModelBounds = edit => edit.path[0] === 'Info' && ['MinimumExtent', 'MaximumExtent', 'BoundsRadius'].includes(edit.path[1]);
const indexedCollections = ['Textures', 'Materials', 'TextureAnims', 'GlobalSequences', 'Geosets', 'GeosetAnims', 'PivotPoints', ...NODE_COLLECTION_KEYS];
const noPendingWork = (a, b) => a === b || !Object.keys(a || {}).length && !Object.keys(b || {}).length;

// When the user and the job changed separate data, the job's edits apply to the latest model
// as they are. Returns null when they overlap. The model-wide box only summarizes the geosets'
// own boxes, so two sides changing it is not an overlap: it is rebuilt from the combined geosets.
function planIndependentEdits(job, source, diff) {
  if (source.paintProject?.dirty && source.paintWorkingRevision !== job.paintRevision) return null;
  if (!noPendingWork(source.uvPreviews, job.uvPreviews) || !noPendingWork(source.animationDrafts, job.animationDrafts)) return null;
  const before = job.recovery.model, current = source.doc.model;
  if (indexedCollections.some(key => (before[key]?.length ?? 0) !== (current[key]?.length ?? 0))) return null;
  // Deleting an ObjectId leaves a hole in Nodes even when its length stays the same.
  if (before.Nodes?.some((node, id) => node && !current.Nodes?.[id]) ||
      current.Nodes?.some((node, id) => node && !before.Nodes?.[id])) return null;
  const userEdits = changes(before, current);
  const userChanged = changeIndex(userEdits.filter(edit => !isModelBounds(edit)));
  if (diff.some(edit => !isModelBounds(edit) && userChanged(edit))) return null;
  if (!userEdits.some(isModelBounds)) return { edits: diff, rebound: false };
  const edits = diff.filter(edit => !isModelBounds(edit));
  return { edits, rebound: edits.length !== diff.length };
}

// The task's candidate, latest source, and common ancestor stay separate during a merge.
// Final transfer checks the live revision and commits synchronously in one editor Undo.
export function deliverJob(bridge, target, action) {
  const job = target.job, host = bridge.host(), source = host.sessionOf(target.documentId);
  if (!job?.draft) return { delivered: true };
  const draft = job.draft;
  if (action === 'open') {
    host.openAiDraft(draft);
    return { delivered: true, opened: draft.doc.name };
  }
  if (action === 'merge') {
    const ancestor = target.review?.before || job.recovery.model, candidate = draft.doc.model;
    const latest = captureJobBase(source);
    const candidateAssets = draft.assets;
    Object.assign(job, latest, { merge: { ancestor, candidate } });
    // Previous vertex/node IDs can describe different topology after the user's edit.
    target.selection = {}; target.restore.selection = {}; target.restore.selectedNodeIds = [];
    target.restore.keyframes = null; target.keyframes = null;
    const next = forkJob(bridge, target);
    // Keep only candidate textures absent from the current source's library.
    for (const [key, value] of candidateAssets) if (!next.assets.has(key)) next.assets.set(key, value);
    host.dropAiDraft(draft);
    target.review = null;
    return { context: bridge.contextFor(job.token) };
  }
  if (action !== 'finish') throw Error('Unknown AI model delivery action.');
  const diff = changes(job.recovery.model, draft.doc.model);
  if (!diff.length && !job.merge && !target.review?.changed) {
    if (job.resultSelection && !changedSource(job, source)) host.deliverAiSelection(source.id, job.resultSelection);
    return { delivered: true, selectionSkipped: !!job.resultSelection && !!changedSource(job, source) };
  }
  const combined = changedSource(job, source);
  const plan = combined ? planIndependentEdits(job, source, diff) : { edits: diff, rebound: false };
  if (!plan) return { conflict: true };
  if (job.merge) {
    const correction = checkMerge(job, diff, draft.doc.model);
    if (correction) return { correction };
  }
  if (plan.edits.length) {
    const sections = [...new Set(plan.edits.map(change => change.path[0]))];
    let result;
    // A combination the editor rejects leaves the model untouched; the user then gets the choice.
    try {
      result = host.editIn(source.id, job.merge || combined ? 'Merge AI result' : 'Apply AI result', sections,
        model => { applyChanges(model, plan.edits); if (plan.rebound) recalculateExtents(model, []); }, { rethrow: true });
    } catch (error) { if (!combined) throw error; return { conflict: true }; }
    if (result === false && combined) return { conflict: true };
    if (result === false) throw Error('The editor could not apply the AI result.');
    // Existing assets win name collisions. Source textures added during the job stay available.
    source.assets = new Map([...draft.assets, ...source.assets]);
  }
  return { delivered: true, merged: !!job.merge || !!combined, revision: source.doc.revision };
}
