// Versions of a model kept side by side for the AI: saved, listed, compared and
// used again. Held in memory per document until MDLxL closes.
import { createChanges } from './history-store.js';
import { ignoreHistoryAlias } from './editor-document.js';
import { encodeAiValue, pointer } from './ai-model.js';

// Automatic versions beyond this many are dropped oldest first; "original" and
// versions the AI named itself are always kept.
const AUTOMATIC_KEPT = 12;

export function createVersionStore() {
  const documents = new Map();
  const versionsOf = documentId => {
    if (!documents.has(documentId)) documents.set(documentId, { list: [], jobs: 0 });
    return documents.get(documentId);
  };
  const find = (documentId, name) => {
    const version = versionsOf(documentId).list.find(v => v.name === name);
    if (!version) throw Error(`There is no version called "${name}". Use mdlxl_versions list.`);
    return version;
  };
  return {
    save(documentId, name, model, note = '', automatic = false) {
      if (typeof name !== 'string' || !name.trim() || name.length > 80) throw Error('A version needs a short name.');
      const own = versionsOf(documentId);
      if (!automatic && (name === 'original' || /^before job \d+$/.test(name)))
        throw Error(`"${name}" is kept automatically; choose another name.`);
      own.list = own.list.filter(v => v.name !== name);
      own.list.push({ name, note: String(note || ''), automatic, at: Date.now(), model: structuredClone(model) });
      const extra = own.list.filter(v => v.automatic && v.name !== 'original');
      for (const old of extra.slice(0, Math.max(0, extra.length - AUTOMATIC_KEPT))) own.list.splice(own.list.indexOf(old), 1);
      return name;
    },
    // Called before each job's first edit: "original" once, then "before job N".
    beforeJob(documentId, model) {
      const own = versionsOf(documentId);
      if (!own.list.some(v => v.name === 'original'))
        this.save(documentId, 'original', model, 'The model before the first AI edit since it was opened.', true);
      own.jobs++;
      return this.save(documentId, `before job ${own.jobs}`, model, "The model before this job's first edit.", true);
    },
    get: (documentId, name) => find(documentId, name).model,
    names: documentId => versionsOf(documentId).list.map(v => v.name),
    list(documentId, current) {
      return versionsOf(documentId).list.map(v => {
        const changes = createChanges(v.model, current, { ignore: ignoreHistoryAlias });
        return {
          name: v.name,
          note: v.note,
          kept: v.automatic ? 'automatically' : 'saved',
          savedAt: new Date(v.at).toISOString(),
          sameAsCurrent: changes.length === 0,
          differencesFromCurrent: changes.length,
        };
      });
    },
    compare(documentId, name, current, other) {
      const from = find(documentId, name).model,
        to = other ? find(documentId, other).model : current;
      const changes = createChanges(from, to, { ignore: ignoreHistoryAlias });
      const sections = {};
      for (const change of changes) sections[change.path[0]] = (sections[change.path[0]] || 0) + 1;
      return {
        from: name,
        to: other || 'current model',
        differences: changes.length,
        bySection: sections,
        changes: changes.slice(0, 100).map(c => ({ path: pointer(c.path), kind: c.kind })),
        truncated: changes.length > 100,
      };
    },
    // Patch operations that make the current model exactly this version again.
    restore(documentId, name, current) {
      const version = find(documentId, name).model;
      const sections = [...new Set([...Object.keys(current), ...Object.keys(version)])].filter(key => key !== 'Nodes');
      return {
        scope: sections.map(key => '/' + key),
        operations: sections.map(key =>
          key in version ? { op: 'set', path: '/' + key, value: encodeAiValue(version[key]) } : { op: 'delete', path: '/' + key },
        ),
      };
    },
  };
}
