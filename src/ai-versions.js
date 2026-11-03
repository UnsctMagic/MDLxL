// Versions of a model kept side by side for the AI: saved, listed, compared and
// used again. Held in memory per document until MDLxL closes.
import { createChanges } from './history-store.js';
import { ignoreHistoryAlias } from './editor-document.js';
import { encodeAiValue, pointer, prepareAiEdit } from './ai-model.js';

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
    stage(documentId, name, model, origin) {
      if (!origin || typeof origin.target !== 'string' || !Number.isSafeInteger(origin.revision) || origin.revision < 0 || !origin.before) throw Error('A candidate needs its original target and model revision.');
      prepareAiEdit(origin.before, model, origin);
      this.save(documentId, name, model, 'Private candidate; not applied to the model.');
      find(documentId, name).candidate = structuredClone(origin);
      return name;
    },
    origin(documentId, name) {
      const candidate = find(documentId, name).candidate;
      if (!candidate) return null;
      const { before, ...metadata } = candidate;
      return structuredClone(metadata);
    },
    get: (documentId, name) => find(documentId, name).model,
    names: documentId => versionsOf(documentId).list.map(v => v.name),
    list(documentId, current) {
      return versionsOf(documentId).list.map(v => {
        const changes = createChanges(v.model, current, { ignore: ignoreHistoryAlias });
        return {
          name: v.name,
          note: v.note,
          kept: v.candidate ? 'candidate' : v.automatic ? 'automatically' : 'saved',
          ...(v.candidate ? { candidate: this.origin(documentId, v.name) } : {}),
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
    restore(documentId, name, current, origin) {
      const saved = find(documentId, name), version = saved.model;
      if (saved.candidate) {
        const staged = saved.candidate;
        if (!origin || staged.target !== origin.target || staged.chatId !== origin.chatId || staged.plan !== origin.plan) throw Error('This candidate belongs to a different originating target, chat or plan.');
        if (staged.revision !== origin.revision || createChanges(staged.before, current, { ignore: ignoreHistoryAlias }).length) throw Error('This candidate is stale: the originating model changed. Compare it, then stage a new candidate against the current model before use.');
        prepareAiEdit(current, version, staged);
      }
      const sections = [...new Set([...Object.keys(current), ...Object.keys(version)])].filter(key => key !== 'Nodes');
      return {
        scope: saved.candidate?.scope || sections.map(key => '/' + key),
        ...(saved.candidate ? { protectedPaths: saved.candidate.protectedPaths, animationRanges: saved.candidate.animationRanges } : {}),
        operations: sections.map(key =>
          key in version ? { op: 'set', path: '/' + key, value: encodeAiValue(version[key]) } : { op: 'delete', path: '/' + key },
        ),
      };
    },
  };
}
