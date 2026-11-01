const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PROVIDERS = require('../src/ai-providers.json');
// Messages the user sends while a task runs. Providers deliver them at their next
// opportunity; anything left when the AI finishes starts a follow-up turn.
class AiSteering {
  constructor(onAccepted) {
    this.queue = [];
    this.listeners = new Set();
    this.onAccepted = onAccepted;
  }
  push(text, message) {
    if (this.closed) return;
    this.onAccepted(text);
    this.queue.push(message);
    this.notify();
  }
  notify() {
    for (const listener of [...this.listeners]) listener();
  }
  take() {
    if (!this.queue.length) return null;
    return this.queue.splice(0).map(message => typeof message === 'function' ? message() : message).join('\n\n');
  }
  restore(message) {
    this.queue.unshift(message);
  }
  requeue(message) {
    if (!message || this.closed) return;
    this.queue.push(message);
    this.notify();
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  close() {
    this.closed = true;
    this.listeners.clear();
  }
}

// Records what the AI says, thinks and does into a conversation's transcript as
// it streams, and forwards every event to the console. `recordAiEvent` comes
// from src/ai-transcript.js, which the console uses for the same events.
class AiRecorder {
  constructor(conversation, emit, recordAiEvent) {
    this.conversation = conversation;
    this.emit = emit;
    this.record = recordAiEvent;
    this.reply = { role: 'assistant', text: '', parts: [] };
  }
  start(entry) {
    this.conversation.transcript.push(entry, this.reply);
  }
  // A steering message splits the reply where it was sent, as it appears in the chat.
  split(text) {
    this.record(this.conversation.transcript, { type: 'steer', text });
    this.reply = this.conversation.transcript.at(-1);
  }
  parts() {
    return this.conversation.transcript.flatMap(entry => entry.parts || []);
  }
  event(value) {
    if (value.type === 'request') return;
    if (value.type === 'usage') {
      if (value.used > 0 && value.window > 0) this.conversation.usage = { used: value.used, window: value.window };
      return;
    }
    // A reply not started yet (a one-off call metered on this chat) stays out of the saved chat.
    const transcript = this.conversation.transcript,
      changed = this.record(transcript.at(-1) === this.reply ? transcript : [...transcript, this.reply], value);
    // Empty text and a compaction state that did not change are not news.
    if (!changed && ['text', 'thinking', 'compaction'].includes(value.type)) return;
    this.emit(value);
  }
  separate() {
    if (this.reply.text && !this.reply.text.endsWith('\n\n')) this.event({ type: 'text', text: '\n\n' });
  }
  // The last text after the final tool call, used by memory notes.
  report() {
    const parts = this.reply.parts,
      lastTool = parts.findLastIndex(p => p.type === 'tool');
    return parts
      .slice(lastTool + 1)
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join('')
      .trim();
  }
  finish() {
    settleParts(this.parts());
  }
}
// Nothing is still running once a task ended or the app restarted: tool steps and
// bird jobs left "running"/"working" become stopped, compaction is done.
function settleParts(parts) {
  for (const part of parts)
    if (part.status === 'running' || part.status === 'working') {
      part.status = part.type === 'compaction' ? 'done' : 'stopped';
      if (part.type === 'question') part.reason ||= 'The app stopped before this question was answered. Reply in chat to continue.';
    }
}
function settleConversation(conversation) {
  for (const entry of conversation.transcript || []) settleParts(entry.parts || []);
  for (const worker of conversation.workers || []) if (worker.status === 'working') worker.status = 'idle';
  return conversation;
}

// Context pressure for the display, retaining the existing scale for saved chats.
function contextUse(conversation) {
  if (conversation.usage?.window) return conversation.usage.used / Math.min(200000, conversation.usage.window * 0.5);
  const stored = JSON.stringify(conversation.messages || []).length + JSON.stringify(conversation.transcript || []).length;
  return stored / 4 / 100000;
}

// Saves JSON (as it is now) through a temporary file, so a crash or a full disk
// never leaves half a file. Writes to one file happen in the order asked.
const writing = new Map();
function writeJsonAtomic(file, value, space) {
  const text = JSON.stringify(value, null, space);
  const write = (writing.get(file) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      await fs.writeFile(file + '.tmp', text, { mode: 0o600 });
      await fs.rename(file + '.tmp', file);
    });
  writing.set(file, write);
  write.then(
    () => writing.get(file) === write && writing.delete(file),
    () => writing.get(file) === write && writing.delete(file),
  );
  return write;
}

// Organisers per model file (or per unsaved tab), their earlier chats, memory notes
// and the remembered save-cleanup choice.
class OrganiserRegistry {
  constructor(directory) {
    this.file = path.join(directory, 'organisers.json');
    this.data = null;
  }
  async load() {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = { models: {} };
    }
    return this.data;
  }
  save() {
    return writeJsonAtomic(this.file, this.data, 2);
  }
  async model(key, name) {
    if (typeof key !== 'string' || !key || key.length > 1000) throw Error('Invalid model key.');
    const data = await this.load();
    const entry = (data.models[key] ||= { name: name || key, organiser: null, earlier: [], note: null, remember: 'ask', activity: false });
    if (name) entry.name = name;
    return entry;
  }
  async rekey(from, to, name) {
    const data = await this.load();
    if (!data.models[from] || from === to) return;
    if (!data.models[to]) data.models[to] = data.models[from];
    if (name) data.models[to].name = name;
    delete data.models[from];
    await this.save();
  }
  static newId() {
    return crypto.randomUUID();
  }
}

// Deletes the files under `folder`, at most `depth` folders down, that
// `wanted(name, fullPath)` picks. Returns how many were deleted.
async function removeFiles(folder, wanted, depth = 6) {
  let removed = 0;
  for (const entry of await fs.readdir(folder, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (depth > 0) removed += await removeFiles(full, wanted, depth - 1);
    } else if (await wanted(entry.name, full)) {
      await fs.rm(full, { force: true });
      removed++;
    }
  }
  return removed;
}
// Provider-side copies of a conversation (Codex rollouts, Claude Code sessions)
// are named after their thread or session id.
async function deleteProviderSessions(directory, ids) {
  const wanted = ids.filter(id => typeof id === 'string' && /^[a-zA-Z0-9-]{8,}$/.test(id));
  if (!wanted.length) return 0;
  let removed = 0;
  for (const provider of PROVIDERS.filter(p => p.native))
    removed += await removeFiles(path.join(directory, provider.id), name => /\.jsonl?$/i.test(name) && wanted.some(id => name.includes(id)));
  return removed;
}

module.exports = {
  settleConversation,
  AiSteering,
  AiRecorder,
  contextUse,
  OrganiserRegistry,
  writeJsonAtomic,
  removeFiles,
  deleteProviderSessions,
};
