import { createChanges, applyChanges } from './history-store.js';
import { EditorDocument, ignoreHistoryAlias, MODEL_COUNT_FIELDS, recalculateExtents } from './editor-document.js';

// The AI chat works on its own copy of a model: a hidden document taken when the
// prompt is sent. The user keeps clicking and editing the real model meanwhile.
// When the job ends, the AI's changes go back in as one Undo step, unless both
// changed the same part; then the user chooses.

/** A detached copy of an editor document: same content and saved state, no Undo. */
export function copyDocument(doc) {
  const copy = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ includeHistory: false, compact: true }));
  copy.name = doc.name;
  return copy;
}

// Info bounds and counts follow the geometry and lists; they never count as a part.
const derived = path => path[0] === 'Info' && (['MinimumExtent', 'MaximumExtent', 'BoundsRadius'].includes(path[1]) || !!MODEL_COUNT_FIELDS[path[1]]);

/** The parts a list of changes touches. A part is one item of a model list
 *  (geoset 2, bone 5, animation 1) or one field of a section such as Info. */
export function changedParts(changes, model) {
  const parts = [];
  for (const change of changes) {
    const [section, item] = change.path;
    if (derived(change.path)) continue;
    const list = Array.isArray(model?.[section]);
    if (change.path.length === 1)
      parts.push(change.kind === 'splice'
        ? { section, from: change.index, to: change.index + change.before.length, splice: true }
        : { section, whole: true });
    else if (list && /^\d+$/.test(item)) parts.push({ section, item: Number(item) });
    else parts.push({ section, field: item });
  }
  return parts;
}

// Whether an AI part and a user part are the same part. Adding or removing items
// moves the later items of that list, so the other side's later items clash too.
function clashes(ai, user) {
  if (ai.section !== user.section) return false;
  if (ai.whole || user.whole) return true;
  if (ai.field !== undefined || user.field !== undefined) return ai.field === user.field;
  if (ai.splice && user.splice) return true;
  if (ai.splice) return user.item >= ai.from && user.item < ai.to;
  if (user.splice) return ai.item >= user.from;
  return ai.item === user.item;
}

const describe = part => part.field !== undefined ? part.section + '/' + part.field : part.item !== undefined ? part.section + '/' + part.item : part.section;

/** Compares the AI's copy and the user's model against the model at send time. */
export function mergePlan(base, live, ai) {
  const aiChanges = createChanges(base, ai, { ignore: ignoreHistoryAlias }),
    userChanges = createChanges(base, live, { ignore: ignoreHistoryAlias });
  const aiParts = changedParts(aiChanges, base),
    userParts = changedParts(userChanges, base);
  const clashing = aiParts.filter(a => userParts.some(u => clashes(a, u)));
  return {
    aiChanges,
    userChanges,
    clashing,
    // Lists whose items moved (added, removed or replaced as a whole) on either side.
    moved: new Set([...aiParts, ...userParts].filter(p => p.splice || p.whole).map(p => p.section)),
    changed: aiChanges.some(c => !derived(c.path)),
    userChanged: userParts.length > 0,
    clashes: [...new Set(clashing.map(describe))],
    sections: [...new Set(aiChanges.map(c => c.path[0]))],
  };
}

/** Puts the AI's changes into the user's model (called inside one editor edit).
 *  aiWins: the AI's version of each part both changed replaces the user's (the
 *  whole list when its items moved), and the user's edits elsewhere stay. */
export function applyMerge(model, plan, ai, { aiWins = false } = {}) {
  if (plan.clashes.length && !aiWins) throw Error('The AI and the user changed the same parts.');
  const replaced = new Set(), items = [];
  if (aiWins) for (const part of plan.clashing) {
    if (part.whole || part.splice || plan.moved.has(part.section)) replaced.add(part.section);
    else items.push(part);
  }
  const taken = path => replaced.has(path[0]) || items.some(p => p.section === path[0] && String(p.item ?? p.field) === path[1]);
  applyChanges(model, plan.aiChanges.filter(c => !derived(c.path) && !taken(c.path)));
  for (const section of replaced) model[section] = structuredClone(ai[section]);
  for (const part of items) model[part.section][part.item ?? part.field] = structuredClone(ai[part.section][part.item ?? part.field]);
  const geosets = new Set();
  for (const c of plan.aiChanges) if (c.path[0] === 'Geosets') {
    if (c.path.length === 1) for (let i = 0; i < (model.Geosets?.length || 0); i++) geosets.add(i);
    else geosets.add(Number(c.path[1]));
  }
  if (replaced.has('Geosets')) for (let i = 0; i < model.Geosets.length; i++) geosets.add(i);
  // Counts follow the lists the AI changed, as its own copy had them.
  for (const c of plan.aiChanges) if (c.path[0] === 'Info' && MODEL_COUNT_FIELDS[c.path[1]]) model.Info[c.path[1]] = model[MODEL_COUNT_FIELDS[c.path[1]]]?.length || 0;
  const valid = [...geosets].filter(i => model.Geosets?.[i]);
  if (valid.length) recalculateExtents(model, valid);
}

/** One Undo label for the AI's whole job, from the copy's own Undo steps. */
export function mergeLabel(copyDoc) {
  const labels = copyDoc.history.map(h => h.label).filter(label => !/^(Undo|Redo): /.test(label));
  if (!labels.length) return 'AI changes';
  return 'AI: ' + (labels.length === 1 ? labels[0] : `${labels.at(-1)} (+${labels.length - 1} more)`);
}
