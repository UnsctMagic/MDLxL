import { createChanges, applyChanges } from '../src/history-store.js';
import { ignoreHistoryAlias } from '../src/editor-document.js';

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
  if (changedSource(job, source)) return { conflict: true };
  if (job.merge) {
    const correction = checkMerge(job, diff, draft.doc.model);
    if (correction) return { correction };
  }
  if (diff.length) {
    const sections = [...new Set(diff.map(change => change.path[0]))];
    const result = host.editIn(source.id, job.merge ? 'Merge AI result' : 'Apply AI result', sections,
      model => applyChanges(model, diff), { rethrow: true });
    if (result === false) throw Error('The editor could not apply the AI result.');
    // Existing assets win name collisions. Source textures added during the job stay available.
    source.assets = new Map([...draft.assets, ...source.assets]);
  }
  return { delivered: true, merged: !!job.merge, revision: source.doc.revision };
}
