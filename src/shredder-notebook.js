/**
 * Shredder the Wise: what the user already knows, and when he may speak.
 * DOM-free. Every update returns a new notebook so callers can persist it.
 */
export const SHREDDER_STORAGE_KEY = 'mdlxl-shredder-notebook-v1';
const MINUTE = 60 * 1000, DAY = 24 * 60 * MINUTE;
export const SHREDDER_TIMING = Object.freeze({
  quietStart: 2 * MINUTE,
  cooldown: Object.freeze({ normal: 3 * MINUTE, fewer: 10 * MINUTE }),
  idle: 1500,
  candidate: 20 * 1000,
  bubble: 8000,
  occasionGap: 20 * MINUTE,
  thirdShowWait: 2 * DAY,
});
export const LEARNED_OCCASIONS = 3, MAX_SHOWS = 3;
const MAX_LESSONS = 3000, MAX_ID = 300;

export const emptyNotebook = () => ({ version: 1, sessions: 0, quietUntil: 0, lessons: {} });
const count = value => Number.isInteger(value) && value >= 0 ? value : 0;
const time = value => Number.isFinite(value) && value > 0 ? value : 0;

export function normalizeNotebook(input) {
  const notebook = emptyNotebook();
  if (!input || typeof input !== 'object' || input.version !== 1) return notebook;
  notebook.sessions = count(input.sessions); notebook.quietUntil = time(input.quietUntil);
  const lessons = input.lessons && typeof input.lessons === 'object' && !Array.isArray(input.lessons) ? input.lessons : {};
  for (const [id, record] of Object.entries(lessons).slice(-MAX_LESSONS)) {
    if (id.length > MAX_ID || id === '__proto__' || !record || typeof record !== 'object') continue;
    notebook.lessons[id] = {
      area: typeof record.area === 'string' ? record.area.slice(0, 40) : 'everywhere',
      shown: count(record.shown), lastShown: time(record.lastShown), lastShownSession: count(record.lastShownSession),
      occasions: count(record.occasions), lastOccasion: time(record.lastOccasion), lastUseSession: count(record.lastUseSession),
      learnedAt: time(record.learnedAt), retired: record.retired === true,
    };
  }
  return notebook;
}

export const startSession = notebook => ({ ...notebook, sessions: notebook.sessions + 1 });
const blank = area => ({ area, shown: 0, lastShown: 0, lastShownSession: 0, occasions: 0, lastOccasion: 0, lastUseSession: 0, learnedAt: 0, retired: false });
function change(notebook, id, area, update) {
  const previous = notebook.lessons[id] || blank(area || 'everywhere');
  const lessons = { ...notebook.lessons, [id]: update({ ...previous }) };
  const ids = Object.keys(lessons);
  if (ids.length > MAX_LESSONS) delete lessons[ids[0]];
  return { ...notebook, lessons };
}

/** Uses close together are one occasion; another app start or a 20-minute gap is a new one. */
export function recordUse(notebook, id, { now, area, need = LEARNED_OCCASIONS }) {
  return change(notebook, id, area, record => {
    if (record.learnedAt) return record;
    if (record.lastUseSession !== notebook.sessions || now - record.lastOccasion >= SHREDDER_TIMING.occasionGap) {
      record.occasions++; record.lastOccasion = now; record.lastUseSession = notebook.sessions;
    }
    if (record.occasions >= need) record.learnedAt = now;
    return record;
  });
}
export const recordShown = (notebook, id, { now, area }) => change(notebook, id, area, record => ({ ...record, shown: record.shown + 1, lastShown: now, lastShownSession: notebook.sessions }));
export const retireLesson = (notebook, id, { area } = {}) => change(notebook, id, area, record => ({ ...record, retired: true }));
export function quietForToday(notebook, now) {
  const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  return { ...notebook, quietUntil: midnight.getTime() };
}

export const isLearned = record => !!record?.learnedAt;
/** A tip may come back only while it is still useful, and ever more rarely. */
export function lessonReady(record, { now, session }) {
  if (!record) return true;
  if (record.learnedAt || record.retired || record.shown >= MAX_SHOWS) return false;
  if (record.shown === 1) return record.lastShownSession !== session;
  if (record.shown === 2) return record.lastShownSession !== session && now - record.lastShown >= SHREDDER_TIMING.thirdShowWait;
  return true;
}
export function learnedIn(notebook, area) {
  return Object.values(notebook.lessons).filter(record => record.area === area && record.learnedAt).length;
}

/** Global manners: quiet start, cooldown between tips, and "quiet for today". */
export function mayInterrupt({ now, notebook, sessionStartedAt, lastTipAt = 0, pace = 'normal', timing = SHREDDER_TIMING }) {
  if (now < notebook.quietUntil) return false;
  if (now - sessionStartedAt < timing.quietStart) return false;
  return !lastTipAt || now - lastTipAt >= (timing.cooldown[pace] || timing.cooldown.normal);
}

/** Per area: lessons learned, and lessons met so far (shown, practised or learned). */
export function notebookSummary(notebook, areas, now) {
  const records = Object.values(notebook.lessons);
  return {
    areas: areas.map(([area, label]) => {
      const mine = records.filter(record => record.area === area && (record.shown || record.occasions || record.learnedAt));
      return { area, label, learned: mine.filter(record => record.learnedAt).length, met: mine.length };
    }),
    learnedThisWeek: records.filter(record => record.learnedAt && now - record.learnedAt < 7 * DAY).length,
    learned: records.filter(record => record.learnedAt).length,
  };
}
