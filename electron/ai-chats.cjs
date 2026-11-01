const fs = require('node:fs/promises');
const path = require('node:path');
const PROVIDERS = require('../src/ai-providers.json');
const { removeFiles, deleteProviderSessions } = require('./ai-chat-state.cjs');

// A model's AI chats on disk: the save-cleanup choices, important models and the
// automatic cleanup of chats left behind. Each function takes the AiService.

// Chats of models not used for this many days are cleaned up; 0 = never.
const DAY = 24 * 60 * 60 * 1000;
function cleanupDaysOf(config) {
  return typeof config.cleanupDays === 'number' ? config.cleanupDays : 3;
}
// Chat ids, and chat files (with their temporary copies) in the AI folder.
const CHAT_ID_PATTERN = '[a-zA-Z0-9_-]{1,80}';
const CHAT_ID = new RegExp('^' + CHAT_ID_PATTERN + '$');
const CHAT_FILE = new RegExp('^chat-(' + CHAT_ID_PATTERN + ')\\.json(\\.tmp)?$');
async function setRememberedCleanup(service, { modelKey, remember }) {
  if (!['ask', 'keep', 'summary', 'wipe'].includes(remember)) throw Error('Unknown choice.');
  const entry = await service.registry.model(modelKey);
  entry.remember = remember;
  await service.registry.save();
  return { remember };
}
// After a save: keep everything, keep a memory note, or delete every chat for this model.
async function cleanup(service, { modelKey, mode, remember = false }) {
  if (!['keep', 'summary', 'wipe'].includes(mode)) throw Error('Unknown cleanup choice.');
  if (service.active || service.modelBusy(modelKey)) throw Error('Wait until the AI finishes before cleaning up its chats.');
  const entry = await service.registry.model(modelKey);
  if (remember) entry.remember = mode;
  entry.activity = false;
  if (mode === 'keep') {
    await service.registry.save();
    return { mode };
  }
  const settings = await service.settings();
  let note = null;
  if (mode === 'summary' && entry.organiser) {
    const organiser = await service.conversation(entry.organiser, settings.provider).catch(() => null);
    if (organiser?.transcript.length) note = await service.memoryNote(organiser, settings, entry.note);
  }
  const { ids, providerFiles } = await removeChats(service, entry);
  entry.note = mode === 'summary' ? note || entry.note : null;
  // A summary keeps the decision diary; wiping removes it with the chats.
  if (mode === 'wipe') delete entry.diary;
  entry.organiser = null;
  entry.earlier = [];
  await service.registry.save();
  service.emit({ type: 'organiser-reset', modelKey });
  return { mode, removedChats: ids.length, providerFiles, note: entry.note };
}
// Model chats and legacy delegated files, retained only for complete cleanup.
async function chatsOf(service, entry) {
  const ids = [],
    threads = [];
  for (const organiserId of [entry.organiser, ...(entry.earlier || [])].filter(Boolean)) {
    const organiser = await service.readConversation(organiserId);
    ids.push(organiserId);
    if (organiser?.threadId) threads.push(organiser.threadId);
    for (const worker of organiser?.workers || []) {
      const conversation = await service.readConversation(worker.id);
      ids.push(worker.id);
      if (conversation?.threadId) threads.push(conversation.threadId);
    }
  }
  return { ids, threads };
}
async function removeChats(service, entry) {
  const { ids, threads } = await chatsOf(service, entry);
  for (const id of ids) {
    service.conversations.delete(id);
    await service.writes.get(id)?.catch(() => {});
    await fs.rm(service.chatFile(id), { force: true });
    await fs.rm(service.chatFile(id) + '.tmp', { force: true });
  }
  return { ids, providerFiles: await deleteProviderSessions(service.directory, threads) };
}
// Important models keep their chats; automatic cleanup never removes them.
async function setImportant(service, { modelKey, important }) {
  if (typeof important !== 'boolean') throw Error('Choose on or off.');
  const entry = await service.registry.model(modelKey);
  entry.important = important;
  await service.registry.save();
  return { important };
}
// Models get moved, renamed or edited in other programs, so their chats can be
// left behind. Every chat, note, diary, provider copy and temporary file of a
// model not used for `cleanupDays` days is deleted, unless the model is important.
async function cleanupUnused(service, now = Date.now()) {
  const days = cleanupDaysOf(await service.configuration());
  if (!days || service.active || service.tasks.size || service.closing) return { models: 0, files: 0 };
  const cutoff = now - days * DAY,
    data = await service.registry.load(),
    kept = new Set(),
    keptThreads = new Set();
  let models = 0,
    files = 0;
  const newest = async ids => {
    let time = 0;
    for (const id of ids) {
      const stat = await fs.stat(service.chatFile(id)).catch(() => null);
      if (stat) time = Math.max(time, stat.mtimeMs);
    }
    return time;
  };
  for (const [key, entry] of Object.entries(data.models)) {
    const chats = await chatsOf(service, entry);
    const used = Math.max(entry.used || 0, await newest(chats.ids));
    // An entry with no date yet starts its timer now.
    if (!used) entry.used = now;
    if (entry.important || service.modelBusy(key) || !used || used > cutoff) {
      for (const id of chats.ids) kept.add(id);
      for (const thread of chats.threads) keptThreads.add(thread);
      continue;
    }
    const removed = await removeChats(service, entry);
    files += removed.ids.length + removed.providerFiles;
    delete data.models[key];
    models++;
    service.emit({ type: 'organiser-reset', modelKey: key });
  }
  await service.registry.save();
  // Chats no model points to any more, and provider copies and run folders left by them.
  const old = async full => ((await fs.stat(full).catch(() => null))?.mtimeMs ?? now) <= cutoff;
  for (const name of await fs.readdir(service.directory).catch(() => [])) {
    const full = path.join(service.directory, name),
      chat = CHAT_FILE.exec(name);
    if (chat ? kept.has(chat[1]) || service.conversations.has(chat[1]) : !/^claude-run-/.test(name)) continue;
    if (!(await old(full))) continue;
    await fs.rm(full, { recursive: true, force: true });
    files++;
  }
  // Only session logs and temporary files: sign-in and provider settings stay.
  const sweep = (folder, unwanted) => removeFiles(path.join(service.directory, folder), async (name, full) => unwanted(name) && (await old(full)));
  const orphanLog = name => /\.jsonl?$/i.test(name) && ![...keptThreads].some(id => name.includes(id));
  files += await sweep('temp', () => true);
  for (const folder of PROVIDERS.flatMap(p => p.logFolders)) files += await sweep(folder, orphanLog);
  return { models, files };
}
// Checks a minute after start and then every few hours while MDLxL is open.
function startCleanup(service) {
  const run = () => cleanupUnused(service).catch(error => console.error('AI cleanup: ' + error.message));
  service.cleanupTimers = [setTimeout(run, 60000), setInterval(run, 6 * 60 * 60 * 1000)];
  for (const timer of service.cleanupTimers) timer.unref?.();
}

module.exports = { DAY, cleanupDaysOf, CHAT_ID, CHAT_FILE, setRememberedCleanup, cleanup, chatsOf, removeChats, setImportant, cleanupUnused, startCleanup };
