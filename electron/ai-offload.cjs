const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Offload Mode building blocks: worker names, the per-model organiser registry,
// recording of streamed replies, steering and cleanup of saved chats.

// Everyday birds only; a model's organiser never reuses a name. The console
// colours each bird by its place in this list.
const BIRDS = require('../src/ai-birds.json');
// The first bird of a chat is a corvid; later ones come from the whole list.
const CORVIDS = ['Crow', 'Raven', 'Jackdaw', 'Rook', 'Magpie', 'Jay'];
function nextBird(used = [], random = Math.random) {
  const taken = new Set(used.map(name => name.toLowerCase()));
  for (let round = 1; ; round++) {
    const pool = (used.length ? BIRDS : CORVIDS)
      .map(bird => (round === 1 ? bird : `${bird} ${round}`))
      .filter(name => !taken.has(name.toLowerCase()));
    if (pool.length) return pool[Math.floor(random() * pool.length)];
  }
}
// A worker past half of its context hands over to a fresh one.
const RETIRE_AT = 0.5;

// Messages the user sends while a task runs. Providers deliver them at their next
// opportunity; anything left when the AI finishes starts a follow-up turn. While a
// worker runs for the organiser, steering is forwarded to that worker.
class AiSteering {
  constructor(onAccepted) {
    this.queue = [];
    this.listeners = new Set();
    this.onAccepted = onAccepted;
    this.forward = null;
  }
  push(text, message) {
    if (this.closed) return;
    this.onAccepted(text);
    if (this.forward && !this.forward.closed) return this.forward.push(text, message);
    this.queue.push(message);
    this.notify();
  }
  notify() {
    for (const listener of [...this.listeners]) listener();
  }
  take() {
    if (!this.queue.length) return null;
    return this.queue.splice(0).join('\n\n');
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
// it streams, and forwards every event to the console.
class AiRecorder {
  constructor(conversation, emit) {
    this.conversation = conversation;
    this.emit = emit;
    this.reply = { role: 'assistant', text: '', parts: [] };
  }
  start(entry) {
    this.conversation.transcript.push(entry, this.reply);
  }
  // A steering message splits the reply where it was sent, as it appears in the chat.
  split(text) {
    this.reply = { role: 'assistant', text: '', parts: [] };
    this.conversation.transcript.push({ role: 'user', text, steer: true }, this.reply);
  }
  parts() {
    return this.conversation.transcript.flatMap(entry => entry.parts || []);
  }
  event(value) {
    const reply = this.reply;
    if (value.type === 'request') return;
    if (value.type === 'text' || value.type === 'thinking') {
      if (!value.text) return;
      if (value.type === 'text') reply.text += value.text;
      const last = reply.parts.at(-1);
      if (last?.type === value.type) last.text += value.text;
      else reply.parts.push({ type: value.type, text: value.text });
    } else if (value.type === 'compaction') {
      const running = this.parts().findLast(p => p.type === 'compaction' && p.status === 'running');
      if (value.active && !running) reply.parts.push({ type: 'compaction', status: 'running' });
      else if (!value.active && running) running.status = 'done';
      else return;
    } else if (value.type === 'question') {
      reply.parts.push({ type: 'question', questionId: value.questionId, questions: value.questions, name: value.name, status: 'running' });
    } else if (value.type === 'question-result') {
      const part = this.parts().find(p => p.type === 'question' && p.questionId === value.questionId);
      if (part) Object.assign(part, { status: value.status, answers: value.answers });
    } else if (value.type === 'tool') {
      reply.parts.push({ type: 'tool', id: value.callId, name: value.name, detail: value.detail, status: 'running' });
    } else if (value.type === 'tool-result') {
      // A steering message may have split the reply since the tool started.
      const parts = this.parts();
      const part =
        parts.findLast(p => p.type === 'tool' && value.callId && p.id === value.callId) ||
        parts.findLast(p => p.type === 'tool' && p.status === 'running' && p.name === value.name);
      if (part) Object.assign(part, { status: value.error ? 'error' : 'done', summary: value.summary });
    } else if (value.type === 'worker') {
      const part = this.parts().findLast(p => p.type === 'worker' && p.workerId === value.workerId && p.status === 'working');
      if (part && value.status !== 'working') Object.assign(part, { status: value.status, report: value.report, cost: value.cost, model: value.model, light: value.light });
      else if (!part) reply.parts.push({ type: 'worker', workerId: value.workerId, name: value.name, job: value.job, status: value.status, region: value.region, model: value.model, light: value.light });
    } else if (value.type === 'art') {
      // SD Brain's art brief: a row that fills in once the brief is written.
      const part = reply.parts.findLast(p => p.type === 'art' && p.status === 'running');
      if (part) Object.assign(part, { status: value.status, text: value.text || '' });
      else reply.parts.push({ type: 'art', status: value.status, text: value.text || '' });
    } else if (value.type === 'cost') {
      // What the prompt has spent so far, kept with the reply it belongs to.
      reply.cost = { usd: value.usd, tokens: value.tokens, model: value.model, light: value.light, ...(value.roles ? { roles: value.roles } : {}) };
    } else if (value.type === 'usage') {
      if (value.used > 0 && value.window > 0) this.conversation.usage = { used: value.used, window: value.window };
      return;
    }
    this.emit(value);
  }
  separate() {
    if (this.reply.text && !this.reply.text.endsWith('\n\n')) this.event({ type: 'text', text: '\n\n' });
  }
  // The last thing the AI said after its last tool call: a worker's report.
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
    if (part.status === 'running' || part.status === 'working')
      part.status = part.type === 'compaction' ? 'done' : 'stopped';
}
function settleConversation(conversation) {
  for (const entry of conversation.transcript || []) settleParts(entry.parts || []);
  for (const worker of conversation.workers || []) if (worker.status === 'working') worker.status = 'idle';
  return conversation;
}

// How full a conversation's context is, 0..1. Providers report real token use;
// otherwise it is estimated from the stored history.
function contextUse(conversation) {
  if (conversation.usage?.window) return conversation.usage.used / conversation.usage.window;
  const stored = JSON.stringify(conversation.messages || []).length + JSON.stringify(conversation.transcript || []).length;
  return stored / 4 / 200000;
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
  async save() {
    await fs.writeFile(this.file + '.tmp', JSON.stringify(this.data, null, 2), { mode: 0o600 });
    await fs.rename(this.file + '.tmp', this.file);
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

// Provider-side copies of a conversation (Codex rollouts, Claude Code sessions)
// are named after their thread or session id.
async function deleteProviderSessions(directory, ids) {
  const wanted = ids.filter(id => typeof id === 'string' && /^[a-zA-Z0-9-]{8,}$/.test(id));
  if (!wanted.length) return 0;
  let removed = 0;
  const walk = async (folder, depth) => {
    let entries;
    try {
      entries = await fs.readdir(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (depth < 6) await walk(full, depth + 1);
      } else if (/\.jsonl?$/i.test(entry.name) && wanted.some(id => entry.name.includes(id))) {
        await fs.rm(full, { force: true });
        removed++;
      }
    }
  };
  for (const provider of ['codex', 'claude']) await walk(path.join(directory, provider), 0);
  return removed;
}

module.exports = {
  settleConversation,
  BIRDS,
  CORVIDS,
  nextBird,
  RETIRE_AT,
  AiSteering,
  AiRecorder,
  contextUse,
  OrganiserRegistry,
  deleteProviderSessions,
};
