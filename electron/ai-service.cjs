const fs = require('node:fs/promises');
const path = require('node:path');
const { planChecks, exactValueRequest, expandRoutine, recordFailures, checkpointNote } = require('./ai-job-plan.cjs');
const { recordJob, noteOwnerReply, diaryText } = require('./ai-diary.cjs');
// Thinking effort for a connection; "default" leaves it to the provider.
const EFFORTS = ['default', 'medium', 'high', 'xhigh'];
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { startMcpServer } = require('./ai-mcp.cjs');
const { runModelScript } = require('./ai-sandbox.cjs');
const {
  PROVIDERS,
  providerInfo,
  runProvider,
  providerModels,
  providerAuth,
  endpoint,
  authenticationRequired,
  CANCELLED,
} = require('./ai-providers.cjs');
const { checkAgentExecutable } = require('./ai-process.cjs');
const { AiAwareness, awarenessText } = require('./ai-awareness.cjs');
const { questionCancelled } = require('./ai-user-input.cjs');
const {
  AiSteering,
  AiRecorder,
  OrganiserRegistry,
  writeJsonAtomic,
  settleConversation,
} = require('./ai-chat-state.cjs');

// Optional per-prompt limits the user can set: dollars (API) and tool rounds. 0 = none.
const LIMITS = { spendLimit: 'Enter a spending limit in dollars, or leave it empty for none.', stepLimit: 'Enter a number of steps, or leave it empty for none.' };
function limitOf(config, name) {
  return typeof config[name] === 'number' ? config[name] : 0;
}
const chats = require('./ai-chats.cjs');
const { registerAiEditorIpc } = require('./ai-editor-ipc.cjs');
const { cleanupDaysOf, CHAT_ID } = chats;
// Model lists are kept per provider and server.
function catalogKey(settings) {
  return settings.provider + ':' + (settings.baseUrl || '');
}
// A native connection's account, per provider and CLI.
function accountKey(settings) {
  return settings.provider + ':' + (settings.executable || '');
}
// The editing instructions, with the handbook and web research when they are on.
// The common editor functions stay the same on every turn for prompt caching.
function editingPrompt(contract, { handbook, web, functions }) {
  return (
    contract.AI_SYSTEM_PROMPT +
    (handbook ? '\n' + contract.AI_EDITING_HANDBOOK : '') +
    (web ? '\n' + contract.AI_WEB_RESEARCH : '') +
    (functions ? '\n' + functions : '')
  );
}
const memoryNoteText = note => '\n\nMemory note from earlier work on this model:\n' + note;
// The editor snapshot goes in full once per conversation (and again when its
// provider history starts over); later prompts carry the target, where the user
// is, and only the fields that changed. mdlxl_context returns everything,
// including the editor command list, which prompts leave out.
function contextText(conversation, context) {
  const { commands, ...snapshot } = context;
  const fingerprints = Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, crypto.createHash('sha1').update(JSON.stringify(value) ?? '').digest('base64')]));
  const sameModel = conversation.sentContextDocument === snapshot.documentId &&
    !(Number.isFinite(snapshot.revision) && snapshot.revision < conversation.sentContextRevision);
  const sameThread = conversation.sentContextThread === undefined || conversation.sentContextThread === (conversation.threadId || null);
  const sent = (conversation.messages?.length || conversation.threadId) && sameModel && sameThread && conversation.sentContext;
  conversation.sentContextDocument = snapshot.documentId;
  conversation.sentContextRevision = snapshot.revision;
  conversation.sentContextThread = conversation.threadId || null;
  conversation.sentContext = fingerprints;
  if (!sent) return '\n\nMDLxL context captured when this prompt was sent (call mdlxl_context for the editor command list):\n' + JSON.stringify(snapshot);
  const delta = {};
  for (const key of Object.keys(snapshot)) if (key === 'target' || fingerprints[key] !== sent[key]) delta[key] = snapshot[key];
  for (const key of Object.keys(sent)) if (!(key in snapshot)) delta[key] = null;
  return '\n\nMDLxL context for this prompt: the target and changes since the last context you received. Omitted fields keep their previous values. Call mdlxl_context for the full lists.\n' + JSON.stringify(delta);
}

class AiService {
  constructor({ root, profile, electron, getWindow, sdBrainAvailable }) {
    this.root = root;
    // Tests may bring SD Brain back while it is parked; otherwise src/ai-sd-rules.js decides.
    this.sdBrainOverride = sdBrainAvailable;
    this.directory = path.join(profile, 'ai');
    this.electron = electron;
    this.getWindow = getWindow;
    this.pending = new Map();
    this.questions = new Map();
    this.conversations = new Map();
    this.ready = false;
    this.config = null;
    // Exclusive requests (sign-in, model lists, memory notes) use `active`; prompt
    // tasks run one per model tab at the same time, in `tasks` by chat id.
    this.active = null;
    this.tasks = new Map();
    this.external = null;
    this.running = new Set();
    this.awareness = new AiAwareness();
    this.writes = new Map();
    this.runningIds = new Set();
    this.registry = new OrganiserRegistry(this.directory);
    // Native accounts found signed in this session; sending checks only the others.
    this.signedIn = new Set();
  }
  // The tool contract and prompts, and the transcript rules the console shares.
  async init() {
    if (!this.contract) {
      const load = file => import(pathToFileURL(path.join(this.root, file)).href);
      this.contract = Promise.all([load('src/ai-tools.js'), load('src/ai-transcript.js')]).then(([contract, transcript]) => {
        this.recordAiEvent = transcript.recordAiEvent;
        return contract;
      });
    }
    return this.contract;
  }
  // The editor functions handed to the AI (the common list and per-job pages),
  // read once from the same src files its scripts load.
  async functionCards() {
    this.cards ||= (async () => {
      const capabilities = await import(pathToFileURL(path.join(this.root, 'src/ai-capabilities.js')).href);
      const modules = [...new Set([...Object.keys(capabilities.AI_COMMON_FUNCTIONS), ...capabilities.AI_AREAS.flatMap(area => area.modules)])];
      const sources = Object.fromEntries(
        await Promise.all(modules.map(async module => [module, await fs.readFile(path.join(this.root, 'src', module + '.js'), 'utf8').catch(() => '')])),
      );
      return {
        common: capabilities.aiCommonFunctionsText(sources),
        areas: capabilities.AI_AREAS.map(area => area.id),
        areasForRequest: capabilities.areasForRequest,
        pages: areas => capabilities.aiToolPages(sources, areas),
      };
    })();
    return this.cards;
  }
  // A recorder for a chat; init() has loaded the transcript rules by then.
  recorder(conversation, emit) {
    return new AiRecorder(conversation, emit, this.recordAiEvent);
  }
  async configuration() {
    if (this.config) return this.config;
    if (!this.loading)
      this.loading = (async () => {
        await fs.mkdir(this.directory, { recursive: true });
        try {
          this.config = JSON.parse(await fs.readFile(path.join(this.directory, 'connections.json'), 'utf8'));
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          this.config = { provider: PROVIDERS[0].id, enabled: false, port: 0, providers: {} };
        }
        // Drop obsolete delegation preferences on the next save.
        delete this.config.offload;
        delete this.config.routing;
        for (const provider of Object.values(this.config.providers || {})) {
          delete provider.allowLighter;
          delete provider.lightModel;
        }
        this.awareness.setEnabled(this.config.awareness === true);
        return this.config;
      })().catch(error => {
        this.loading = null;
        throw error;
      });
    return this.loading;
  }
  persist() {
    return writeJsonAtomic(path.join(this.directory, 'connections.json'), this.config, 2);
  }
  encrypt(secret) {
    if (!this.electron.safeStorage.isEncryptionAvailable())
      throw Error('OS credential encryption is unavailable. The key was not saved.');
    return this.electron.safeStorage.encryptString(secret).toString('base64');
  }
  decrypt(secret) {
    return secret ? this.electron.safeStorage.decryptString(Buffer.from(secret, 'base64')) : '';
  }
  async status(name) {
    const config = await this.configuration();
    name ||= config.provider;
    const provider = config.providers?.[name] || {};
    return {
      provider: name,
      model: provider.model || '',
      baseUrl: provider.baseUrl || '',
      executable: provider.executable || '',
      hasKey: !!provider.key,
      enabled: !!this.external,
      url: this.external?.url || null,
      busy: this.busy(),
      running: this.runningChats(),
      awareness: this.awareness.enabled,
      outsideCheck: config.outsideCheck !== false,
      effort: provider.effort || 'high',
      spendLimit: limitOf(config, 'spendLimit'),
      stepLimit: limitOf(config, 'stepLimit'),
      cleanupDays: cleanupDaysOf(config),
      sdBrain:(await this.sdBrainAvailable()) && config.sdBrain === true,
      sdBrainAvailable: await this.sdBrainAvailable(),
      editingHandbook: config.editingHandbook === true,
      webResearch: config.webResearch === true,
    };
  }
  // An on/off setting: saved, applied by `after`, then announced to the console.
  async setSwitch(key, eventType, enabled, after) {
    if (typeof enabled !== 'boolean') throw Error('Choose on or off.');
    const config = await this.configuration();
    config[key] = enabled;
    await this.persist();
    after?.();
    this.emit({ type: eventType, enabled });
    return this.status();
  }
  setAwareness(enabled) {
    return this.setSwitch('awareness', 'awareness', enabled, () => this.awareness.setEnabled(enabled));
  }
  // The model can change while the AI works: a running task keeps the settings it
  // started with, and the next message uses the new model.
  async setModel(model) {
    if (typeof model !== 'string' || model.length > 200) throw Error('Choose a model.');
    const config = await this.configuration();
    config.providers ||= {};
    const provider = (config.providers[config.provider] ||= {});
    provider.model = model.trim();
    await this.persist();
    return this.status();
  }
  busy() {
    return !!this.active || this.tasks.size > 0;
  }
  // Which per-model chats are working, for the console.
  runningChats() {
    return [...this.tasks.values()].map(t => ({ id: t.id, documentId: t.documentId }));
  }
  emitRunning() {
    // A covered or minimized window stops drawing, and the AI's pictures and
    // captures with it. Keep drawing while a task works; normal again after.
    const win = this.getWindow();
    if (win && !win.isDestroyed()) win.webContents.setBackgroundThrottling?.(this.tasks.size === 0);
    this.emit({ type: 'running', running: this.runningChats() });
  }
  async configure(input) {
    const config = await this.configuration();
    // Limits can change at any time; a running prompt keeps the ones it started with.
    for (const [name, message] of Object.entries(LIMITS)) {
      if (input[name] === undefined) continue;
      const limit = input[name] === '' || input[name] === null ? 0 : Number(input[name]);
      if (!Number.isFinite(limit) || limit < 0 || limit > 100000) throw Error(message);
      if (limit !== limitOf(config, name)) {
        config[name] = limit;
        await this.persist();
      }
    }
    if (input.cleanupDays !== undefined) {
      const days = input.cleanupDays === '' || input.cleanupDays === null ? 0 : Number(input.cleanupDays);
      if (!Number.isInteger(days) || days < 0 || days > 3650) throw Error('Enter a number of days, or leave it empty to never clean up.');
      if (days !== cleanupDaysOf(config)) {
        config.cleanupDays = days;
        await this.persist();
      }
    }
    if (this.busy()) {
      // Sending re-saves the connection; while other models' jobs run, an unchanged
      // connection is fine. Only an actual change has to wait.
      const current = config.providers?.[config.provider] || {};
      const unchanged =
        input.provider === config.provider &&
        String(input.model || '').trim() === (current.model || '') &&
        String(input.baseUrl || '').trim() === (current.baseUrl || '') &&
        String(input.executable || '').trim() === (current.executable || '') &&
        !input.apiKey &&
        !input.clearKey;
      if (unchanged) return this.status();
      throw Error('Stop the current AI request before changing providers.');
    }
    if (!providerInfo(input.provider)) throw Error('Unknown AI provider.');
    const previous = config.providers?.[input.provider] || {};
    if (input.baseUrl) endpoint(input.baseUrl);
    const native = providerInfo(input.provider).native,
      baseUrl = String(input.baseUrl || '').trim();
    // A new CLI path must name the provider's CLI; an unchanged saved path keeps working.
    const requested = String(input.executable || '').trim();
    const executable = !native
      ? ''
      : requested === (previous.executable || '')
        ? requested
        : checkAgentExecutable(input.provider, requested);
    // A saved key belongs to the server it was entered for; never send it to a new address.
    const next = {
      ...previous,
      model: String(input.model || '').trim(),
      executable,
      baseUrl,
      key: baseUrl === (previous.baseUrl || '') ? previous.key || '' : '',
      effort: EFFORTS.includes(input.effort) ? input.effort : previous.effort || 'high',
    };
    if (input.apiKey !== undefined && input.apiKey !== '') next.key = this.encrypt(String(input.apiKey));
    if (input.clearKey) next.key = '';
    const providerChanged = config.provider !== input.provider;
    config.provider = input.provider;
    if (input.outsideCheck !== undefined) config.outsideCheck = input.outsideCheck === true;
    config.providers ||= {};
    config.providers[input.provider] = next;
    await this.persist();
    if (providerChanged) this.emit({ type: 'organiser-reset' });
    return this.status();
  }
  async settings() {
    const c = await this.configuration();
    return {
      provider: c.provider,
      spendLimit: limitOf(c, 'spendLimit'),
      stepLimit: limitOf(c, 'stepLimit'),
      // Editing work thinks hard unless the owner chose otherwise.
      effort: 'high',
      ...c.providers?.[c.provider],
    };
  }
  emit(value) {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('ai:event', value);
  }
  call(name, args = {}, signal) {
    const win = this.getWindow();
    if (!this.ready || !win || win.isDestroyed())
      return Promise.reject(Error('The MDLxL editor is not ready.'));
    const id = crypto.randomUUID(),
      controller = new AbortController(),
      requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    return new Promise((resolve, reject) => {
      const cancel = () => {
        if (!win.isDestroyed()) win.webContents.send('ai:toolCancel', id);
        finish(
          controller.signal.reason instanceof Error
            ? controller.signal.reason
            : Error(CANCELLED),
        );
      };
      let settled = false, timer = setTimeout(() => controller.abort(Error('The editor tool timed out.')), 180000);
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        requestSignal.removeEventListener('abort', cancel);
        this.pending.delete(id);
        error ? reject(error) : resolve(value);
      };
      this.pending.set(id, {
        finish,
        signal: requestSignal,
        cancel: () => controller.abort(Error('Editor closed.')),
        waiting: waiting => {
          if (settled) return;
          clearTimeout(timer);
          if (!waiting) timer = setTimeout(() => controller.abort(Error('The editor tool timed out.')), 180000);
        },
      });
      requestSignal.addEventListener('abort', cancel, { once: true });
      if (requestSignal.aborted) {
        cancel();
        return;
      }
      win.webContents.send('ai:tool', { id, name, arguments: args });
    });
  }
  enable(enabled) {
    const operation = (this.enabling || Promise.resolve())
      .catch(() => {})
      .then(() => this.setEnabled(enabled));
    this.enabling = operation;
    return operation;
  }
  async setEnabled(enabled) {
    if (this.closing) throw Error('The editor is closing.');
    const config = await this.configuration();
    if (enabled && !this.external) {
      const { AI_TOOLS } = await this.init();
      const token = config.token ? this.decrypt(config.token) : crypto.randomBytes(32).toString('hex');
      this.external = await startMcpServer({
        tools: AI_TOOLS,
        port: config.port || 0,
        token,
        awareness: this.awareness,
        call: async (name, args, signal) => {
          try {
            const result = await this.call(name, args, signal);
            if (name !== 'mdlxl_context' || !(await this.sdBrainAvailable())) return result;
            const policy = await this.sdBrainPolicy(),
              { sdBrainInstructions } = await this.init();
            return { ...result, sdBrain: { ...policy, instructions: sdBrainInstructions(policy, 'external') } };
          } finally {
            this.emit({ type: 'external-done', busy: this.busy() });
          }
        },
        onCall: name => this.emit({ type: 'external', name }),
      });
      config.port = this.external.port;
      config.token = this.encrypt(token);
    } else if (!enabled && this.external) {
      await this.external.close();
      this.external = null;
    }
    // Turning the connection off retires its key; the next connection gets a new one.
    if (!enabled) delete config.token;
    config.enabled = !!enabled;
    await this.persist();
    return this.status();
  }
  async conversation(id, provider) {
    if (!CHAT_ID.test(id || '')) throw Error('Invalid conversation ID.');
    // A chat belongs to the connection it started on, also while it is still loaded.
    if (this.conversations.has(id)) {
      const loaded = this.conversations.get(id);
      if (loaded.provider !== provider) throw Error('Start a new chat after changing AI providers.');
      return loaded;
    }
    let value;
    try {
      // Loaded from disk means nothing of it is running in this app session.
      value = settleConversation(
        JSON.parse(await fs.readFile(this.chatFile(id), 'utf8')),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      value = { id, provider, transcript: [], messages: [] };
    }
    if (value.provider !== provider) throw Error('Start a new chat after changing AI providers.');
    this.conversations.set(id, value);
    return value;
  }
  chatFile(id) {
    return path.join(this.directory, 'chat-' + id + '.json');
  }
  persistConversation(conversation) {
    const write = writeJsonAtomic(this.chatFile(conversation.id), conversation);
    this.writes.set(conversation.id, write);
    return write;
  }
  async taskInfo(id) {
    const settings = await this.settings(),
      conversation = await this.conversation(id, settings.provider),
      task = conversation.task;
    if (!task) return null;
    if (task.status === 'running' && !this.runningIds.has(id) && !this.tasks.has(id)) {
      task.status = 'interrupted';
      await this.persistConversation(conversation);
    }
    return {
      status: task.status,
      phase: task.phase,
      steps: task.steps,
      summary: task.summary || '',
      canResume: !task.workerId && !task.regionJobs && ['interrupted', 'incomplete'].includes(task.status),
    };
  }
  async send({ id, text, images = [], context, resume = false }) {
    if (this.active) throw Error('Wait for the current AI request to finish.');
    if (this.tasks.has(id)) throw Error('This chat is already working.');
    // One job per model: another chat of the same model tab waits its turn.
    if ([...this.tasks.values()].some(t => t.documentId && t.documentId === context?.documentId))
      throw Error('Another AI chat is already working on this model. Send this when it finishes.');
    if (!resume && (typeof text !== 'string' || !text.trim() || text.length > 100000))
      throw Error('Enter a prompt of 1–100000 characters.');
    if (
      images.length > 4 ||
      images.some(image => typeof image !== 'string' || image.length > 12 * 1024 * 1024)
    )
      throw Error('Attach up to four images, each under 9 MB.');
    if (!context?.target) throw Error('Capture the model context before sending.');
    const settings = await this.settings(),
      contract = await this.init(),
      controller = new AbortController();
    // Account discovery/model lists can work while signed out. Check the actual
    // account before recording a turn or letting a provider make a model request,
    // once per session: a signed-out turn or signing in or out checks again.
    if (providerInfo(settings.provider)?.native && !this.signedIn.has(accountKey(settings))) {
      const auth = await this.auth('status');
      if (!auth.loggedIn) {
        const error = authenticationRequired();
        return { ok: false, authRequired: true, error: error.message };
      }
    }
    const conversation = await this.conversation(id, settings.provider);
    // The owner's next message is their reaction to the last job on this model.
    if (!resume && conversation.modelKey) {
      const entry = await this.registry.model(conversation.modelKey);
      if (noteOwnerReply(entry, text)) await this.registry.save();
    }
    const recorder = this.recorder(conversation, value => this.emit({ id, ...value }));
    const steering = new AiSteering(text => recorder.split(text));
    const active = { id, controller, steering, recorder, documentId: context.documentId || null, modelKey: conversation.modelKey || null };
    this.tasks.set(id, active);
    this.emitRunning();
    const config = await this.configuration();
    if (conversation.modelKey) await this.markActivity(conversation.modelKey);
    try {
      if (!resume && await this.acceptDelivery({ conversation, recorder, text, context, signal: controller.signal })) {
        recorder.event({ type: 'done' });
        return { ok: true };
      }
      await this.runTask({
        conversation,
        recorder,
        steering,
        text,
        images,
        context,
        resume,
        settings,
        contract,
        signal: controller.signal,
        policy: { ...(await this.sdBrainPolicy()), handbook: config.editingHandbook === true, web: config.webResearch === true, outside: config.outsideCheck !== false },
      });
      recorder.event({ type: 'done' });
      return { ok: true };
    } catch (error) {
      // A resume that cannot start is refused outright; nothing was recorded.
      if (error.precondition) throw error;
      if (controller.signal.aborted) {
        recorder.separate();
        recorder.event({
          type: 'text',
          text: 'Stopped. Applied edits remain in Undo. Resume task to continue from the checkpoint.',
        });
        recorder.event({ type: 'done' });
        return { ok: false, cancelled: true };
      }
      const authRequired = error.code === 'AI_AUTH_REQUIRED';
      if (authRequired) this.signedIn.delete(accountKey(settings));
      recorder.event({ type: 'error', text: error.message, authRequired });
      return { ok: false, error: error.message, authRequired };
    } finally {
      if (this.tasks.get(id) === active) this.tasks.delete(id);
      this.emitRunning();
      steering.close();
      recorder.finish();
      await this.persistConversation(conversation);
      this.emit({ id, type: 'task', task: await this.taskInfo(id) });
    }
  }
  // This is the owner's acceptance, not another model's judgement. Reuse finish
  // so the review, saved task and organiser all leave the blocked state together.
  async acceptDelivery({ conversation, recorder, text, context, signal }) {
    if (!acceptsDelivery(text)) return false;
    const task = conversation.task;
    if (!task || task.status === 'complete' || !task.checkpoint?.review?.changed) return false;
    await this.call('mdlxl_checkpoint', { target: context.target, baseline: task.baseline, restoreReview: task.checkpoint.review }, signal);
    const concerns = [task.summary, ...(task.outsideCheck?.problems || []), ...(task.outsideCheck?.notes || [])].filter(Boolean);
    const summary = 'You accepted the current result.' + (concerns.length ? '\nNote: ' + [...new Set(concerns)].join('; ') : '');
    const review = await this.call('mdlxl_review', { target: context.target, action: 'finish', outcome: 'passed', acceptedByUser: true, summary }, signal);
    Object.assign(task, { acceptedByUser: true, status: 'complete', phase: review.phase, summary });
    delete task.unresolvedEditError;
    delete task.baseline;
    delete task.images;
    recorder.start({ role: 'user', text, document: context.name, selection: context.selection });
    recorder.event({ type: 'text', text: summary });
    return true;
  }
    async askOnce({ settings, system, prompt, images = [], conversation, signal, meter, label, stepLimit }) {
    let reply = '';
    const steering = new AiSteering(() => {});
    try {
      await runProvider({
        settings: stepLimit ? { ...settings, stepLimit } : settings,
        key: this.decrypt(settings.key),
        directory: this.directory,
        event: value => {
          if (value.type === 'text') reply += value.text;
          else meter(value);
        },
        tools: [],
        call: async () => {
          throw Error(label);
        },
        system,
        prompt,
        images,
        conversation,
        signal,
        awareness: null,
        steering,
      });
    } finally {
      steering.close();
    }
    return reply;
  }
  measureUsage(conversation, recorder, role) {
    let lastTokens = 0, lastUsd = 0;
    const own = { calls: 0, tokens: null, usd: null };
    return value => {
      if (value.type === 'context-reset') { delete conversation.sentContext; return; }
      if (value.type === 'compaction') delete conversation.sentContext;
      if (value.type === 'request') conversation.sentContextThread = conversation.threadId || null;
      if (!['request', 'cost'].includes(value.type)) {
        recorder.event(value);
        return;
      }
      const active = this.tasks.get(conversation.id);
      if (!active) { if (value.type === 'cost') recorder.event(value); return; }
      const costs = (active.cost ||= {}), cost = (costs[role] ||= { calls: 0, tokens: null, usd: null });
      if (value.type === 'request') { cost.calls++; own.calls++; if (value.unit) cost.unit = own.unit = value.unit; }
      else {
        const delta = Math.max(0, value.tokens - lastTokens); cost.tokens = (cost.tokens || 0) + delta; own.tokens = (own.tokens || 0) + delta; lastTokens = value.tokens;
        if (value.usd !== null) { const deltaUsd = Math.max(0, value.usd - lastUsd); cost.usd = (cost.usd || 0) + deltaUsd; own.usd = (own.usd || 0) + deltaUsd; lastUsd = value.usd; }
        if (recorder !== active.recorder) recorder.event({ ...value, model: conversation.model, roles: { [role]: { ...own } } });
      }
      const rows = Object.values(costs);
      active.recorder.event({ type: 'cost', tokens: rows.every(c => c.tokens !== null) ? rows.reduce((n, c) => n + c.tokens, 0) : null, usd: rows.every(c => c.usd !== null) ? rows.reduce((n, c) => n + c.usd, 0) : null, roles: structuredClone(costs) });
    };
  }
  // One task on one conversation: the provider turn, edit checkpoints, verification
  // and steering, independently of jobs on other model tabs.
  async runTask({ conversation, recorder, steering, text, images, context, resume, settings, contract, signal, entry, policy }) {
    const {
      AI_JOB_TOOLS,
      AI_JOB_CHECKPOINT,
      AI_PLAN_TOOL,
      guidesForRequest,
      aiToolEditsModel,
      sdBrainInstructions,
      sdReviewProblem,
    } = contract;
    const id = conversation.id;
    context = structuredClone(context);
    const previousTask = conversation.task;
    let task;
    if (resume) {
      task = conversation.task;
      if (task?.workerId || task?.regionJobs)
        throw Object.assign(Error('This legacy delegated task cannot resume. Send a new prompt in this model chat.'), { precondition: true });
      if (!task || !['running', 'interrupted', 'incomplete'].includes(task.status))
        throw Object.assign(Error('There is no interrupted task to resume.'), { precondition: true });
      if (task.checkpoint) {
        const current = await this.call('mdlxl_checkpoint', { target: context.target });
        if (
          current.fingerprint !== task.checkpoint.fingerprint ||
          (current.path || current.name) !== (task.checkpoint.path || task.checkpoint.name)
        )
          throw Object.assign(
            Error(
              'The model differs from this task checkpoint. Restore its model through MDLxL recovery, or send a new prompt for the current model.',
            ),
            { precondition: true },
          );
        context = (
          await this.call('mdlxl_checkpoint', {
            target: context.target,
            restore: task.checkpoint.context,
            baseline: task.baseline,
            restoreReview: task.checkpoint.review,
          })
        ).context;
      }
      text = task.prompt;
      images = task.images || [];
      // Provider histories may contain an unfinished tool call after a crash.
      // Reconstruct a fresh turn from durable editor checkpoints, never replay it.
      conversation.messages = [];
      delete conversation.threadId;
      delete conversation.sentToolAreas;
    } else
      task = conversation.task = {
        prompt: text,
        request: text,
        latestRequest: text,
        images,
        context,
        status: 'running',
        phase: 'inspecting',
        steps: [],
        sdBrain: policy || { enabled: false },
      };
    // SD Brain and the editing handbook stay as they were when the task started;
    // toggling applies to the next task.
    const sd = (task.sdBrain ||= policy || { enabled: false });
    task.context = context;
    task.latestRequest ||= task.request || text;
    task.status = 'running';
    task.summary = '';
    this.runningIds.add(id);
    recorder.start({
      role: 'user',
      text: resume ? 'Resume task' : text,
      document: context.name,
      selection: context.selection,
      ...entry,
    });
    const progress = async phase => {
      task.phase = phase;
      await this.persistConversation(conversation);
      this.emit({ id, type: 'task', task: await this.taskInfo(id) });
    };
    let promptHasContext = false;
    let prompt =
      (resume ? 'Resume task\n\nOriginal request:\n' + text : text) +
      (resume
        ? '\n\nResume the interrupted task. Inspect the current model and these completed steps before continuing; do not repeat an applied edit. A pending step may have been interrupted before its result was recorded.\n' +
          checkpointNote(task)
        : '');
    // SD Brain: the request first becomes an art brief, once per task.
    if (sd.enabled && !conversation.toolsOff && !task.artBrief) {
      recorder.event({ type: 'art', status: 'running' });
      let failure = '';
      try {
        task.artBrief = await this.artDirection({ text, images, context, settings, contract, signal, conversation });
        if (!task.artBrief) failure = 'The art director returned no brief.';
      } catch (error) {
        if (signal.aborted) throw error;
        task.artBrief = '';
        failure = error.message;
      }
      // Without a brief the task still runs on the SD Brain policy; the row says why.
      recorder.event(failure ? { type: 'art', status: 'error', text: failure } : { type: 'art', status: 'done', text: task.artBrief });
      await this.persistConversation(conversation);
    }
    if (task.artBrief)
      prompt += "\n\nSD art brief for this request (the user's own words above come first):\n" + task.artBrief;
    // With the handbook on, the job carries the guides its request touches.
    if (sd.handbook === true && !conversation.toolsOff && !resume)
      for (const topic of guidesForRequest(text)) {
        try {
          const guide = await this.call('mdlxl_help', { topic }, signal);
          if (guide?.text) prompt += `\n\nEditing guide for this job (${topic}). Use its procedures where they fit this model:\n${guide.text}`;
        } catch {
          // A guide that cannot be read leaves the job as it was.
        }
      }
    // Function pages inferred from the request go once per conversation; capabilities finds the rest.
    const cards = await this.functionCards();
    if (!conversation.toolsOff) {
      // The pages sent earlier are gone once the provider history restarts.
      const sent = conversation.sentContext ? conversation.sentToolAreas || [] : [];
      const areas = cards.areasForRequest(text).filter(area => !sent.includes(area));
      const pages = cards.pages(areas);
      if (pages) prompt += '\n\n' + pages;
      conversation.sentToolAreas = [...sent, ...areas];
    }
    if (!conversation.toolsOff && conversation.modelKey && !conversation.messages.length && !conversation.threadId) {
      const entry = await this.registry.model(conversation.modelKey);
      if (entry.note) prompt += memoryNoteText(entry.note);
    }
    // The AI doing the work sees what earlier jobs on this model did and why.
    if (!conversation.toolsOff && conversation.modelKey) {
      const diary = diaryText(await this.registry.model(conversation.modelKey), { request: task.request, context, previous: previousTask?.diaryId });
      if (diary) prompt += '\n\n' + diary;
    }
    if (await this.sdBrainAvailable()) prompt += `\n\nTask settings: SD Brain ${sd.enabled ? 'on' : 'off'} (policy ${sd.revision || 'n/a'}).`;
    if (this.awareness.enabled) prompt += '\n\n' + awarenessText(this.awareness.snapshot());
    let callsInFlight = 0;
    const call = async (name, args, callSignal) => {
      callsInFlight++;
      try { return await performCall(name, args, callSignal); }
      catch (error) {
        if (aiToolEditsModel(name, args)) task.unresolvedEditError = error.message;
        throw error;
      }
      finally { callsInFlight--; }
    };
    // Keep the evidence the editing AI actually saw, also across Resume and native
    // provider turns (whose picture history lives outside our messages array).
    if (images.length) conversation.referenceImages = [...new Set([...images, ...(conversation.referenceImages || [])])];
    let lastInspect = null;
    const performCall = async (name, args, callSignal) => {
      if (signal.aborted) throw Error(CANCELLED);
      if (!tools.some(tool => tool.name === name)) throw Error('This tool is not available to this chat.');
      if (name === 'mdlxl_job_checkpoint') {
        if (!['candidate', 'verify'].includes(args.phase) || typeof args.evidence !== 'string' || !args.evidence.trim() || args.evidence.length > 4000 || !Array.isArray(args.remaining) || args.remaining.length > 20 || args.remaining.some(v => typeof v !== 'string' || v.length > 500)) throw Error('A checkpoint needs a phase, concise evidence and specific remaining work.');
        if (callsInFlight !== 1) throw Error('Wait for the other tool operations before recording a phase checkpoint.');
        task.workCheckpoint = { phase: args.phase, evidence: args.evidence, remaining: args.remaining };
        task.checkpoint = await this.call('mdlxl_checkpoint', { target: context.target }, signal);
        await this.persistConversation(conversation);
        return { checkpointed: true, remaining: args.remaining, replanRequired: task.replanRequired || null, next: args.remaining.length ? 'Continue only the remaining work; preserve the baseline and reuse saved routines.' : 'Finish the agreed review and report; do not add polishing goals.' };
      }
      // Look first, then change once: the plan is kept with the task, not sent to the editor.
      if (name === 'mdlxl_plan') {
        const options = Array.isArray(args.options) ? args.options : [];
        if (!String(args.cause || '').trim() || !String(args.reach || '').trim() || !args.keep?.length)
          throw Error('A plan names the cause, how far it reaches and what must stay the same.');
        if (options.length < 2 && !exactValueRequest(task.request || text, images))
          throw Error('Give at least two genuinely different fixes with what each costs, then choose one.');
        if (!Number.isInteger(args.choice) || !options[args.choice]) throw Error('choice must be the index of one of the options.');
        const checks = planChecks(args.checks, contract.AI_SWEEP_SCHEMA);
        if (task.replanRequired && task.plan && args.cause === task.plan.cause && options[args.choice].fix === task.plan.options[task.plan.choice].fix) throw Error('The same check failed twice: ' + task.replanRequired + '. Audit the cause and choose a materially different plan, or finish blocked.');
        if (!task.plan || args.cause !== task.plan.cause || options[args.choice].fix !== task.plan.options[task.plan.choice].fix) {
          delete task.replanRequired;
          task.checkFailures = {};
        }
        const replaces = !!task.plan;
        task.plan = { cause: args.cause, reach: args.reach, keep: args.keep, options, choice: args.choice, why: args.why, checks, afterStep: task.steps.length };
        await this.persistConversation(conversation);
        return {
          recorded: true,
          ...(replaces ? { replaced: 'the previous plan' } : {}),
          chosen: options[args.choice].fix,
          next: 'Check a representative candidate before exhaustive work. The final review must cover checks and keep items.',
        };
      }
      if (args.target && args.target !== context.target)
        throw Error('Use the target captured with the current prompt.');
      const requestSignal = callSignal ? AbortSignal.any([callSignal, signal]) : signal;
      const edit = aiToolEditsModel(name, args);
      if (edit && task.replanRequired) throw Error('The same check failed twice: ' + task.replanRequired + '. Revise mdlxl_plan based on evidence or finish blocked before another edit.');
      args = expandRoutine(task, name, args);
      if (task.routines) await this.persistConversation(conversation);
      // Model edits need a plan, except exact value edits; switching the view or going
      // back to a saved version does not.
      if (edit && name !== 'mdlxl_view' && name !== 'mdlxl_versions' && !task.plan && tools.includes(AI_PLAN_TOOL) && !exactValueRequest(task.request || text, images))
        throw Error('Look first: inspect what the request touches, then record your plan with mdlxl_plan before the first edit.');
      if (edit) {
        task.unresolvedEditError = 'An edit did not finish. Inspect the current model before continuing.';
        const checkpoint = await this.call(
          'mdlxl_checkpoint',
          { target: context.target, prepare: true, includeBaseline: !task.baseline },
          requestSignal,
        );
        if (checkpoint.baseline) {
          task.baseline = checkpoint.baseline;
          delete checkpoint.baseline;
        }
        task.checkpoint = checkpoint;
        task.steps.push({ tool: name, label: args.label || args.id || name, status: 'pending' });
        await progress('editing');
      } else if (name === 'mdlxl_review') {
        // SD Brain review: a pass needs a verdict per criterion, and a criterion
        // that keeps failing stops blind revisions.
        if (sd.enabled && !task.acceptedByUser) {
          const problem = sdReviewProblem(args);
          if (problem) throw Error(problem);
          if (args.action === 'finish' && args.outcome === 'needs-correction') {
            task.corrections ||= {};
            const failed = (args.criteria || []).filter(c => c.result === 'needs-correction').map(c => c.name);
            for (const name of failed.length ? failed : ['result']) task.corrections[name] = (task.corrections[name] || 0) + 1;
            const repeated = Object.entries(task.corrections).filter(([, count]) => count >= 3).map(([name]) => name);
            if (repeated.length)
              throw Error(
                `SD Brain review: ${repeated.join(', ')} failed three times. Do not revise blindly again; finish with outcome blocked and name the blocker.`,
              );
          }
          if (args.action === 'finish' && args.outcome === 'passed') task.criteria = args.criteria;
        }
        // The outside check: a separate AI that never saw this work judges the result
        // before it counts as verified; a doubtful result goes back with its reasons.
        if (args.action === 'finish' && args.outcome === 'passed' && sd.outside === true && !task.acceptedByUser && lastInspect) {
          const sweepChecks = (task.plan?.checks || []).filter(c => c.sweep);
          const sweeps = sweepChecks.length ? (await this.call('mdlxl_review', {
            target: context.target, action: 'status', baseline: lastInspect.baseline, sweepChecks,
          }, requestSignal)).sweeps : undefined;
          const verdict = await this.outsideCheck({ request: task.prompt || text, plan: task.plan, inspect: { ...lastInspect, sweeps, images: [...lastInspect.images, ...(task.evidenceImages || []), ...(conversation.referenceImages || task.images || []).map((image, i) => ({ role: 'reference', group: 'reference ' + i, label: 'User reference ' + (i + 1), image }))] }, settings, contract, signal, conversation, recorder });
          if (verdict) {
            task.outsideCheck = verdict;
            if (verdict.verdict !== 'good' && verdict.problems.length) {
              const said = `Outside check (a separate AI that saw only the request, the keep list, your checks and the pictures) says ${verdict.verdict}: ${verdict.problems.join('; ')}.`;
              throw Error(`${said} Correct what is real, run mdlxl_review inspect again, then finish. Missing evidence is a note, not a reason to block delivery.`);
            }
          }
        }
        await progress(
          args.action === 'finish' && args.outcome === 'needs-correction' ? 'correcting' : 'verifying',
        );
      }
      try {
        const result = await this.call(
          name,
          {
            ...args,
            ...(name === 'mdlxl_review' && args.action === 'finish' && task.acceptedByUser ? { outcome: 'passed', acceptedByUser: true } : {}),
            ...(name === 'mdlxl_help' ? {} : { target: context.target }),
            ...(name === 'mdlxl_review' && args.action === 'inspect' ? { sweepChecks: (task.plan?.checks || []).filter(c => c.sweep) } : {}),
            ...(sd.enabled && name === 'mdlxl_review' && args.action === 'inspect' ? { turnaround: true } : {}),
          },
          requestSignal,
        );
        if (name === 'mdlxl_context' && result?.target === context.target) {
          Object.assign(context, result);
        } else if (result?.context?.target === context.target) Object.assign(context, result.context);
        else if (result?.target === context.target) {
          for (const key of Object.keys(context)) if (key in result) context[key] = result[key];
        }
        if (task.steeringAnnotations) {
          context.annotations = task.steeringAnnotations;
          if (name === 'mdlxl_context') result.annotations = task.steeringAnnotations;
        }
        if (name === 'mdlxl_context' && result?.target === context.target)
          contextText(conversation, context); // The full tool result is the editing AI's new baseline.
        // What the outside check will judge: the latest inspected checks and pictures.
        if (edit) {
          lastInspect = null;
          // Earlier after-images no longer show the current result; originals stay.
          task.evidenceImages = (task.evidenceImages || []).filter(p => p.role === 'original');
        }
        if (name === 'mdlxl_capture' && result) {
          const original = !task.checkpoint?.review?.changed;
          const captures = result.images || (result.image ? [{ image: result.image }] : []);
          const saved = task.evidenceImages || [];
          captures.forEach((picture, i) => {
            const sample = args.samples?.[i] || {},
              group = 'capture ' + JSON.stringify(sample),
              role = original ? 'original' : 'edited',
              entry = { ...picture, role, group, label: `${original ? 'Original before the task' : 'Edited target'}; ${picture.label || JSON.stringify(sample)}` };
            const previous = saved.findIndex(p => p.group === group && p.role === role);
            if (previous < 0) saved.push(entry);
            else if (!original) saved[previous] = entry;
          });
          task.evidenceImages = choosePictures(saved).pictures;
          await this.persistConversation(conversation);
        }
        if (name === 'mdlxl_review' && args.action === 'inspect' && result && typeof result === 'object')
          lastInspect = { checks: result.review?.checks || [], images: result.images || [], missing: result.review?.missingEvidence || [], motion: result.review?.motion, baseline: args.baseline };
        // The review judges the plan's keep list along with the request.
        if (name === 'mdlxl_review' && args.action === 'inspect' && task.plan && result && typeof result === 'object')
          result.plan = { cause: task.plan.cause, chosen: task.plan.options[task.plan.choice].fix, keep: task.plan.keep, checks: task.plan.checks, check: 'Confirm each keep item with a measured check or a visible comparison.' };
        if (edit || name === 'mdlxl_review') {
          task.checkpoint = await this.call('mdlxl_checkpoint', { target: context.target }, requestSignal);
          if (task.checkpoint.context?.target === context.target) Object.assign(context, task.checkpoint.context);
          if (task.steeringAnnotations) context.annotations = task.steeringAnnotations;
          if (edit)
            Object.assign(task.steps.at(-1), {
              status: 'applied',
              changes: result.changes || [],
              applied: result.applied ?? task.checkpoint.review.changed,
            });
          if (name === 'mdlxl_review' && args.action === 'inspect') {
            const repeated = recordFailures(task, result.review?.checks, task.checkpoint.fingerprint);
            if (repeated) result.planUpdate = 'Repeated failures: ' + repeated + '. Reassess the mechanism and record a revised plan before another edit.';
          }
          if (edit || task.checkpoint.review.phase === 'verified') delete task.unresolvedEditError;
          await this.persistConversation(conversation);
        }
        return result;
      } catch (error) {
        if (edit) {
          task.unresolvedEditError = error.message;
          Object.assign(task.steps.at(-1), { status: 'failed', error: error.message });
          await this.persistConversation(conversation);
        }
        throw error;
      }
    };
    const tools = conversation.toolsOff ? [] : [...AI_JOB_TOOLS, AI_PLAN_TOOL, AI_JOB_CHECKPOINT];
    const web = sd.web === true;
    const system = editingPrompt(contract, { handbook: sd.handbook === true, web, functions: cards.common });
    // The SD Brain policy travels in the trusted instructions of every turn, so an
    // earlier "on" can never keep governing a task that started with it off.
    const instructions = (await this.sdBrainAvailable())
      ? system + '\n\n' + sdBrainInstructions(sd, conversation.toolsOff ? 'note' : 'direct')
      : system;
    try {
      await progress('inspecting');
      let runs = 0;
      for (let attempt = 0; attempt < 4; ) {
        if (attempt) recorder.separate();
        const options = {
          settings,
          key: this.decrypt(settings.key),
          directory: this.directory,
          askUser: (params, questionSignal) => this.askUser(conversation, recorder, params, questionSignal),
          event: this.measureUsage(conversation, recorder, 'direct'),
          tools,
          call,
          system: instructions,
          prompt: prompt + (promptHasContext && conversation.sentContext ? '' : contextText(conversation, context)),
          images: runs++ ? [] : images,
          conversation,
          signal,
          awareness: this.awareness,
          steering,
          web,
        };
        try { await runProvider(options); }
        catch (error) { delete conversation.sentContext; throw error; }
        // Steering that arrived as the AI finished starts a follow-up turn on the same task.
        const late = steering.take();
        if (late) {
          recorder.separate();
          prompt = late;
          promptHasContext = true;
          continue;
        }
        attempt++;
        if (task.acceptedByUser && task.steps.length) {
          const concerns = [...(task.outsideCheck?.problems || []), ...(task.outsideCheck?.notes || [])];
          const summary = 'You accepted the current result.' + (concerns.length ? '\nNote: ' + concerns.join('; ') : '');
          await this.call('mdlxl_review', { target: context.target, action: 'finish', outcome: 'passed', acceptedByUser: true, summary }, signal);
          recorder.event({ type: 'text', text: '\n\n' + summary });
        }
        const review = task.steps.length
          ? await this.call('mdlxl_review', { target: context.target, action: 'status' }, signal)
          : { changed: false };
        if (!review.changed && task.unresolvedEditError) throw Error(task.unresolvedEditError);
        if (!review.changed || review.phase === 'verified') {
          task.status = 'complete';
          task.phase = review.changed ? 'verified' : 'complete';
          task.summary = review.summary || '';
          delete task.baseline;
          delete task.images;
          await this.persistConversation(conversation);
          this.emit({ id, type: 'task', task: await this.taskInfo(id) });
          return;
        }
        // A short first line; the editing AI's own explanation follows in the same box.
        if (review.phase === 'blocked')
          throw Error(review.summary ? 'The edit is kept but not verified.\n' + review.summary : 'The edited model still needs verification.');
        if (attempt >= 4) break;
        await progress('verifying');
        recorder.event({ type: 'notice', text: 'Checking the result before completing the task.' });
        promptHasContext = false;
        prompt =
          task.latestRequest + '\n\nTask update:\nThe edit is still unverified. Do not repeat the edit. Call mdlxl_review inspect with checksCode for the requested result and protected data, inspect the images, correct failures, then mdlxl_review finish. Current review: ' +
          JSON.stringify(review);
      }
      throw Error(
        'The edit is applied but verification is incomplete. Resume the task to finish checking it.',
      );
    } catch (error) {
      task.status = signal.aborted ? 'interrupted' : 'incomplete';
      task.summary = error.message;
      throw error;
    } finally {
      this.runningIds.delete(id);
      // The decision diary keeps what this job did and why with the model.
      if (conversation.modelKey)
        try {
          const entry = await this.registry.model(conversation.modelKey);
          task.diaryId ||= crypto.randomUUID();
          const outcome =
            (task.phase === 'verified' ? 'verified' : task.status === 'complete' ? 'complete' : (task.status || 'incomplete') + (task.summary ? ': ' + task.summary : '')) +
            (task.outsideCheck ? `; outside check: ${task.outsideCheck.verdict}` : '');
          if (recordJob(entry, { id: task.diaryId, request: task.request || task.prompt || text, plan: task.plan, steps: task.steps, nodeIds: context.selectedNodeIds, outcome })) {
            await this.persistConversation(conversation);
            await this.registry.save();
          }
        } catch {
          // A diary that cannot be written never fails the job itself.
        }
    }
  }
  async artDirection({ text, images, context, settings, contract, signal, conversation }) {
    const art = { id: `${conversation.id}-art`, provider: settings.provider, transcript: [], messages: [], kind: 'art' };
    const counts = context.counts || {},
      model = counts.geosets
        ? `The open model ${context.name} has ${counts.geosets} geosets and ${counts.triangles} triangles${context.selection && Object.keys(context.selection).length ? ', with a selection the user made' : ''}.`
        : `The open model ${context.name} is empty, so this creates something new.`;
    const reply = await this.askOnce({
      settings,
      meter: this.measureUsage(conversation, this.recorder(conversation, () => {}), 'art direction'),
      label: 'The art director has no tools.',
      system: contract.AI_SD_ART_DIRECTOR,
      prompt: `The user's request, exactly as written:\n${text}\n\n${model}`,
      images,
      conversation: art,
      signal,
    });
    return reply.trim().slice(0, 4000);
  }
  // One tool-free call to a fresh AI with no part of the editing AI's conversation.
  // Returns {verdict, confidence, problems, strengths}, or null when it could not judge.
  async outsideCheck({ request, plan, inspect, settings, contract, signal, conversation, recorder }) {
    const judge = { id: `${conversation.id}-check`, provider: settings.provider, transcript: [], messages: [], kind: 'check' };
    const { pictures, left } = choosePictures(inspect.images);
    const question = {
      settings,
      meter: this.measureUsage(conversation, this.recorder(conversation, () => {}), 'outside check'),
      label: 'The outside check has no tools.',
      system: contract.AI_OUTSIDE_CHECK,
      prompt: [
        `The owner's request, exactly as written:\n${request}`,
        plan
          ? `The editing AI's plan: cause: ${plan.cause}; chosen fix: ${plan.options?.[plan.choice]?.fix}; promised to keep: ${(plan.keep || []).join('; ')}; completion criteria: ${(plan.checks || []).map(c => c.name ?? c).join('; ')}.`
          : 'The worker recorded no plan (an exact value edit).',
        `The editing AI's own checks:\n${JSON.stringify(inspect.checks.map(c => ({ name: c.name, passed: c.passed, actual: c.actual, expected: c.expected }))).slice(0, 4000)}`,
        ...(inspect.sweeps?.length ? [outsideSweepBlock(inspect.sweeps)] : []),
        ...(inspect.motion ? [`MDLxL's own measurement, not written by the editing AI:\n${JSON.stringify(inspect.motion)}`] : []),
        `Pictures, in order: ${pictures.map((p, i) => `${i + 1}. ${p.label}`).join('; ') || 'none'}.`,
        ...(left.length ? [`Not sent, to keep the set small (the editing AI saw them): ${left.join('; ')}.`] : []),
        ...(inspect.missing?.length ? [`Evidence the review could not produce: ${inspect.missing.join(' ')}`] : []),
      ].join('\n\n'),
      images: pictures.map(p => p.image),
      conversation: judge,
      signal,
    };
    // The check is a step in the chat like any tool: a tick when good, a cross otherwise;
    // clicking it shows the verdict.
    const callId = `${judge.id}-${Date.now()}`;
    recorder.event({ type: 'tool', name: 'outside_check', callId, detail: 'Judging the request, the keep list and the pictures.' });
    try {
      const reply = await this.askOnce(question);
      const found = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
      if (!['good', 'doubtful', 'wrong'].includes(found.verdict)) throw Error('no verdict');
      const verdict = {
        verdict: found.verdict,
        confidence: Math.max(0, Math.min(1, Number(found.confidence) || 0)),
        problems: (Array.isArray(found.problems) ? found.problems : []).map(String).slice(0, 8),
        strengths: (Array.isArray(found.strengths) ? found.strengths : []).map(String).slice(0, 8),
        notes: (Array.isArray(found.notes) ? found.notes : []).map(String),
      };
      const text = `Outside check: ${verdict.verdict} (confidence ${Math.round(verdict.confidence * 100)}%)${verdict.problems.length ? ' — ' + verdict.problems.join('; ') : ''}${verdict.notes.length ? '. Note: ' + verdict.notes.join('; ') : ''}`;
      recorder.event({ type: 'tool-result', name: 'outside_check', callId, error: verdict.verdict !== 'good', summary: text });
      recorder.event({ type: 'notice', text });
      return verdict;
    } catch (error) {
      if (signal.aborted) throw error;
      // A check that could not run never blocks the job; the chat says so.
      const text = 'Outside check could not judge this result: ' + error.message;
      recorder.event({ type: 'tool-result', name: 'outside_check', callId, error: true, summary: text });
      recorder.event({ type: 'notice', text });
      return null;
    }
  }
  async markActivity(modelKey) {
    const entry = await this.registry.model(modelKey);
    if (!entry.activity) {
      entry.activity = true;
      await this.registry.save();
    }
  }
  // The organiser chat that belongs to a model (file path, or the unsaved tab).
  async organiser({ modelKey, name }) {
    const settings = await this.settings(),
      entry = await this.registry.model(modelKey, name);
    // Opening a model's chat counts as using it for automatic cleanup.
    entry.used = Date.now();
    await this.registry.save();
    let conversation = null;
    if (entry.organiser)
      try {
        conversation = await this.conversation(entry.organiser, settings.provider);
      } catch {
        // Another provider's chat stays readable among the earlier chats.
        entry.earlier.push(entry.organiser);
      }
    if (!conversation) conversation = await this.createOrganiser(entry, modelKey, settings);
    return {
      id: conversation.id,
      earlier: entry.earlier,
      hasNote: !!entry.note,
    };
  }
  async createOrganiser(entry, modelKey, settings) {
    const id = OrganiserRegistry.newId();
    const conversation = { id, provider: settings.provider, transcript: [], messages: [], kind: 'organiser', modelKey, name: entry.name };
    this.conversations.set(id, conversation);
    await this.persistConversation(conversation);
    entry.organiser = id;
    await this.registry.save();
    return conversation;
  }
  async newOrganiser({ modelKey, name }) {
    if (this.active || this.modelBusy(modelKey)) throw Error('Stop the current AI request before starting a new chat.');
    const settings = await this.settings(),
      entry = await this.registry.model(modelKey, name);
    if (entry.organiser) entry.earlier.push(entry.organiser);
    await this.createOrganiser(entry, modelKey, settings);
    return this.organiser({ modelKey, name });
  }
  async rekey({ from, to, name }) {
    await this.registry.rekey(from, to, name);
    for (const conversation of this.conversations.values())
      if (conversation.modelKey === from) {
        conversation.modelKey = to;
        await this.persistConversation(conversation);
      }
    return { ok: true };
  }
  async saveState({ modelKey }) {
    const entry = await this.registry.model(modelKey);
    return { activity: !!entry.activity, remember: entry.remember || 'ask', important: entry.important === true };
  }
  // SD Brain is off until the user turns it on; it applies from the next task.
  async sdBrainAvailable() {
    return this.sdBrainOverride ?? (await this.init()).SD_BRAIN_AVAILABLE === true;
  }
  async setSdBrain(enabled) {
    if (enabled && !(await this.sdBrainAvailable())) throw Error('SD Brain is not available in this version.');
    return this.setSwitch('sdBrain', 'sd-brain', enabled);
  }
  // The editing handbook is off until the user turns it on; it applies from the next task.
  setEditingHandbook(enabled) {
    return this.setSwitch('editingHandbook', 'editing-handbook', enabled);
  }
  // Web research is off until the user turns it on; it applies from the next task.
  setWebResearch(enabled) {
    return this.setSwitch('webResearch', 'web-research', enabled);
  }
  async sdBrainPolicy() {
    const config = await this.configuration(),
      { SD_BRAIN_REVISION } = await this.init();
    return { enabled: (await this.sdBrainAvailable()) && config.sdBrain === true, revision: SD_BRAIN_REVISION };
  }
  setRememberedCleanup(input) {
    return chats.setRememberedCleanup(this, input);
  }
  // After a save: keep everything, keep a memory note, or delete every chat for this model.
  cleanup(input) {
    return chats.cleanup(this, input);
  }
  chatsOf(entry) {
    return chats.chatsOf(this, entry);
  }
  removeChats(entry) {
    return chats.removeChats(this, entry);
  }
  setImportant(input) {
    return chats.setImportant(this, input);
  }
  cleanupUnused(now) {
    return chats.cleanupUnused(this, now);
  }
  startCleanup() {
    chats.startCleanup(this);
  }
  async memoryNote(organiser, settings, previousNote) {
    const contract = await this.init(),
      controller = new AbortController();
    const active = { id: organiser.id, controller, steering: null };
    this.active = active;
    const recorder = this.recorder(organiser, value => this.emit({ id: organiser.id, ...value }));
    const steering = new AiSteering(() => {});
    // Legacy native chats may have a local ledger without a provider thread.
    // Include it in memory notes; API routes send it as history.
    const ledger =
      providerInfo(settings.provider)?.native && !organiser.threadId && organiser.messages?.length
        ? '\n\nThe requests and reports from this conversation, oldest first:\n' +
          organiser.messages.map(m => (m.role === 'user' ? 'User: ' : '') + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n\n').slice(-24000)
        : '';
    const diary = organiser.modelKey ? diaryText(await this.registry.model(organiser.modelKey)) : '';
    organiser.toolsOff = true;
    try {
      await this.runTask({
        conversation: organiser,
        recorder,
        steering,
        text: contract.AI_MEMORY_PROMPT + ledger + (diary ? '\n\n' + diary : '') + (previousNote ? '\n\nThe earlier memory note to fold in:\n' + previousNote : ''),
        images: [],
        context: { target: 'cleanup' },
        resume: false,
        settings,
        contract,
        signal: controller.signal,
        entry: { from: 'mdlxl' },
      });
      return recorder.report() || null;
    } finally {
      delete organiser.toolsOff;
      steering.close();
      if (this.active === active) this.active = null;
    }
  }
  async readConversation(id) {
    if (this.conversations.has(id)) return this.conversations.get(id);
    try {
      return settleConversation(JSON.parse(await fs.readFile(this.chatFile(id), 'utf8')));
    } catch {
      return null;
    }
  }
  // Each direct chat owns its task.
  taskOf(id) {
    return this.tasks.get(id) || null;
  }
  modelBusy(modelKey) {
    return [...this.tasks.values()].some(t => t.modelKey && t.modelKey === modelKey);
  }
  async askUser(conversation, recorder, params, signal) {
    const questions = params?.questions;
    if (!Array.isArray(questions) || !questions.length || questions.some(q =>
      !q || typeof q.id !== 'string' || !q.id || typeof q.question !== 'string' || !q.question.trim() ||
      (q.options != null && (!Array.isArray(q.options) || q.options.some(o => typeof o?.label !== 'string' || !o.label.trim())))) ||
      new Set(questions.map(q => q.id)).size !== questions.length)
      throw Error('The AI must supply a question with a unique ID and readable options.');
    signal.throwIfAborted();
    const questionId = crypto.randomUUID();
    const publish = value => recorder.event(value);
    const persist = () => this.persistConversation(conversation);
    let resolve, reject, answers, reason;
    const response = new Promise((yes, no) => { resolve = yes; reject = no; });
    response.catch(() => {});
    const abort = () => { this.questions.delete(questionId); reject(signal.reason || questionCancelled('AI question cancelled.')); };
    this.questions.set(questionId, { questions, resolve, reject, validate: params.validateAnswers });
    signal.addEventListener('abort', abort, { once: true });
    try {
      publish({ type: 'question', questionId, questions, message: params.message || '', name: conversation.name || '', status: 'running' });
      await persist();
      answers = await response;
      return { answers };
    } catch (error) {
      reason = error.message;
      throw error;
    } finally {
      signal.removeEventListener('abort', abort);
      this.questions.delete(questionId);
      const shown = answers && Object.fromEntries(questions.map(q => [q.id, q.isSecret ? { answers: ['••••'] } : answers[q.id]]));
      publish({ type: 'question-result', questionId, status: answers ? 'done' : 'stopped', answers: shown, reason });
      await persist();
    }
  }
  async openQuestionLink({ questionId, id }) {
    const q = this.questions.get(questionId)?.questions.find(q => q.id === id);
    if (!q?.link) throw Error('This input page is no longer waiting for you.');
    const url = new URL(q.link);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid input page URL.');
    await this.electron.shell.openExternal(url.href);
    return { opened: true };
  }
  answerQuestion({ questionId, answers, cancel = false }) {
    const pending = this.questions.get(questionId);
    if (!pending) throw Error('This question is no longer waiting for an answer.');
    if (cancel) { this.questions.delete(questionId); pending.reject(questionCancelled('You cancelled this question.')); return { cancelled: true }; }
    if (!answers || typeof answers !== 'object' || pending.questions.some(q => {
      const values = answers[q.id]?.answers;
      return !Array.isArray(values) || (!q.multiSelect && values.length > 1) || (q.required !== false && !values.length) ||
        values.some(v => typeof v !== 'string' || !v.trim() || v.length > 20000) || new Set(values).size !== values.length ||
        (q.allowCustom === false && values.some(v => !q.options?.some(o => o.label === v)));
    })) throw Error('Answer each required question before sending.');
    const result = Object.fromEntries(pending.questions.map(q => [q.id, { answers: [...answers[q.id].answers] }]));
    if (typeof pending.validate === 'function') pending.validate(result);
    this.questions.delete(questionId);
    pending.resolve(result);
    return { answered: true };
  }
  async steer({ id, text, annotations }) {
    const active = this.taskOf(id);
    if (!active?.steering) return { queued: false };
    if (typeof text !== 'string' || !text.trim() || text.length > 20000)
      throw Error('Enter a message of 1–20000 characters.');
    const messageFor = id => {
      const conversation = this.conversations.get(id), task = conversation?.task;
      if (task) task.latestRequest = text;
      // Render at delivery, after the pending editor operation has returned its
      // updated state. Queued steering must not freeze the pre-edit snapshot.
      return () => {
        const context = task?.context;
        if (context && annotations) context.annotations = task.steeringAnnotations = annotations;
        return text + '\n\nSteering:\nThe user sent this while you were working. Treat it as steering for the current task.' +
          (context ? contextText(conversation, context) : '');
      };
    };
    if (acceptsDelivery(text)) { const task = this.conversations.get(id)?.task; if (task) task.acceptedByUser = true; }
    active.steering.push(text, messageFor(id));
    this.emit({ id, type: 'steer', text });
    return { queued: true };
  }
  // Stop one chat's task; without a chat, everything.
  cancel(id) {
    if (id) return this.taskOf(id)?.controller.abort();
    this.active?.controller.abort();
    for (const task of this.tasks.values()) task.controller.abort();
  }
  async models() {
    if (this.busy()) throw Error('Stop the current AI request before loading models.');
    const active = { controller: new AbortController() };
    this.active = active;
    try {
      const settings = await this.settings();
      const models = await providerModels(settings, this.decrypt(settings.key), active.controller.signal, { directory: this.directory });
      (this.modelCatalog ||= {})[catalogKey(settings)] = models;
      return models;
    } finally {
      if (this.active === active) this.active = null;
    }
  }
  async auth(action) {
    if (!['login', 'logout', 'status'].includes(action)) throw Error('Unknown sign-in action.');
    // Checking the account only reads it, so it runs beside jobs on other models (the
    // first send of a session checks it); signing in or out waits for every job.
    const exclusive = action !== 'status';
    if (exclusive && this.busy()) throw Error('Stop the current AI request before signing in or out.');
    const settings = await this.settings();
    if (!providerInfo(settings.provider)?.native) throw Error('This provider uses an API key.');
    const controller = new AbortController(),
      key = accountKey(settings);
    if (exclusive) {
      this.active = { controller, auth: true };
      this.signedIn.clear();
    }
    try {
      const result = await providerAuth(settings, action, {
        directory: this.directory,
        signal: controller.signal,
        openExternal: url => this.electron.shell.openExternal(url),
        notify: text => this.emit({ type: 'auth', text }),
      });
      if (action === 'status') result.loggedIn ? this.signedIn.add(key) : this.signedIn.delete(key);
      return result;
    } finally {
      if (exclusive) this.active = null;
    }
  }
  close() {
    return (this.closePromise ||= Promise.resolve().then(async () => {
      this.closing = true;
      for (const timer of this.cleanupTimers || []) clearTimeout(timer);
      this.cancel();
      for (const pending of this.questions.values()) pending.reject(questionCancelled('The editor closed before this question was answered.'));
      this.questions.clear();
      for (const pending of [...this.pending.values()]) pending.cancel();
      await this.enabling?.catch(() => {});
      if (this.external) {
        await this.external.close();
        this.external = null;
      }
      await Promise.allSettled([...this.running]);
    }));
  }
}
function registerAiService({ root, profile, electron, getWindow, readModel, writeModel }) {
  const service = new AiService({ root, profile, electron, getWindow }),
    { ipcMain } = electron;
  service.readModel = readModel;
  service.writeModel = writeModel;
  service.startCleanup();
  const own = event => {
    if (event.sender !== getWindow()?.webContents || event.senderFrame !== event.sender.mainFrame)
      throw Error('Only the editor can use its AI connection.');
  };
  const handle = (name, fn) =>
    ipcMain.handle(name, (event, payload) => {
      own(event);
      const result = Promise.resolve().then(() => fn(payload, event));
      service.running.add(result);
      result.then(
        () => service.running.delete(result),
        () => service.running.delete(result),
      );
      return result;
    });
  handle('ai:status', provider => service.status(provider));
  handle('ai:configure', input => service.configure(input));
  handle('ai:enable', enabled => service.enable(enabled));
  handle('ai:awareness', enabled => service.setAwareness(enabled));
  handle('ai:task', id => service.taskInfo(id));
  handle('ai:config', () => {
    if (!service.external) throw Error('Enable the AI connection first.');
    return service.external.config;
  });
  handle('ai:send', input => service.send(input));
  handle('ai:cancel', id => service.cancel(id));
  handle('ai:steer', input => service.steer(input));
  handle('ai:answerQuestion', input => service.answerQuestion(input));
  handle('ai:questionLink', input => service.openQuestionLink(input));
  handle('ai:organiser', input => service.organiser(input));
  handle('ai:newOrganiser', input => service.newOrganiser(input));
  handle('ai:rekey', input => service.rekey(input));
  handle('ai:saveState', input => service.saveState(input));
  handle('ai:cleanup', input => service.cleanup(input));
  handle('ai:rememberCleanup', input => service.setRememberedCleanup(input));
  handle('ai:important', input => service.setImportant(input));
  handle('ai:sdBrain', enabled => service.setSdBrain(enabled));
  handle('ai:editingHandbook', enabled => service.setEditingHandbook(enabled));
  handle('ai:webResearch', enabled => service.setWebResearch(enabled));
  handle('ai:model', model => service.setModel(model));
  handle('ai:auth', action => service.auth(action));
  handle('ai:models', () => service.models());
  handle('ai:transcript', async id => {
    if (!CHAT_ID.test(id || '')) throw Error('Invalid conversation ID.');
    return (await service.readConversation(id))?.transcript || [];
  });
  handle('ai:script', payload => {
    const request = service.pending.get(payload.requestId);
    if (!request) throw Error('The script request is no longer active.');
    return runModelScript({
      BrowserWindow: electron.BrowserWindow,
      ipcMain,
      root,
      payload,
      signal: request.signal,
    });
  });
  registerAiEditorIpc(service, getWindow, handle);
  ipcMain.on('ai:ready', async (event, ready) => {
    own(event);
    service.ready = !!ready;
    if (ready)
      try {
        const config = await service.configuration();
        if (config.enabled) await service.enable(true);
      } catch (error) {
        service.emit({ type: 'error', text: error.message });
      }
  });
  ipcMain.on('ai:toolWaiting', (event, data) => {
    own(event);
    service.pending.get(data?.id)?.waiting(!!data.waiting);
  });
  ipcMain.on('ai:toolResult', (event, data) => {
    own(event);
    service.pending.get(data?.id)?.finish(data.error ? Error(data.error) : null, data.result);
  });
  ipcMain.on('ai:contextChanged', (event, context) => {
    own(event);
    if (!service.awareness.enabled) return;
    if (!context || typeof context.documentId !== 'string' || !Number.isFinite(context.revision)) return;
    service.awareness.update(context);
  });
  ipcMain.on('ai:awarenessError', (event, message) => {
    own(event);
    service.emit({ type: 'error', text: String(message) });
  });
  return service;
}
// Only an explicit instruction in the owner's own message can accept a result.
// Negated, quoted or conditional requests must not silently finish a task.
function acceptsDelivery(text) {
  return /^(?:(?:please|just|fucking)\s+)*(?:i\s+)?(?:deliver|accept)(?:\s+(?:it|this(?:\s+(?:result|edit|model))?|(?:the\s+)?(?:current\s+)?(?:result|edit|model)))?(?:\s+(?:anyway|now|as[ -]is))?(?:\s*$|[,.!;]|\s+i (?:don['’]?t|do not) care)/i.test(String(text || '').trim());
}
function outsideSweepBlock(sweeps) {
  const header = 'MDLxL plan sweep measurements:\n', limit = 4000;
  const full = header + JSON.stringify(sweeps);
  if (full.length <= limit) return full;

  const note = '\n[Truncated to the before/edited worst measurements and errors that fit.]';
  const summary = [];
  let length = header.length + 2 + note.length; // Include the JSON array brackets.
  for (const { name, before, edited } of sweeps) {
    const row = JSON.stringify({ name, before: before?.worst ?? before?.error ?? null, edited: edited?.worst ?? edited?.error ?? null });
    const added = row.length + (summary.length ? 1 : 0);
    if (length + added > limit) continue;
    summary.push(row);
    length += added;
  }
  return header + '[' + summary.join(',') + ']' + note;
}

// The outside check gets a bounded but complete comparison set: whole groups only,
// so the original, edited and donor pictures of one phase stay together. The still
// comparison comes first, then as many phases as fit, spread over the animation,
// then side views. Returns the labels left out so the judge is told.
function choosePictures(images, limit = 12) {
  const groups = [];
  for (const image of images) {
    const key = image.group || image.label,
      group = groups.find(g => g.key === key);
    if (group) group.items.push(image);
    else groups.push({ key, items: [image] });
  }
  const chosen = new Set();
  let room = limit;
  const take = group => {
    if (chosen.has(group) || group.items.length > room) return;
    chosen.add(group);
    room -= group.items.length;
  };
  const phases = groups.filter(g => /^frame /.test(g.key));
  groups.filter(g => g.key === 'still').forEach(take);
  groups.filter(g => g.items.some(p => p.role === 'reference')).forEach(take);
  // Reserve a matching captured comparison (e.g. wireframe) before animation
  // phases consume the budget. Whole groups always survive or leave together.
  const captured = groups.filter(g => g.key.startsWith('capture ') && g.items.some(p => p.role === 'original'));
  captured.forEach(take);
  // Measurement-selected groups retain the worst motion/speed and other
  // touched animations before spare start/middle/end pictures. Old explicit
  // frame results have no priority and keep the existing spread unchanged.
  groups.filter(g => g.items.some(p => p.motionPriority != null))
    .sort((a, b) => Math.min(...a.items.map(p => p.motionPriority)) - Math.min(...b.items.map(p => p.motionPriority)))
    .forEach(take);
  const remainingPhases = phases.filter(g => !chosen.has(g));
  for (let count = remainingPhases.length; count > 0; count--) {
    const spread = [...new Set(Array.from({ length: count }, (_, i) => Math.round(count === 1 ? (remainingPhases.length - 1) / 2 : (i * (remainingPhases.length - 1)) / (count - 1))))].map(i => remainingPhases[i]);
    if (spread.reduce((n, g) => n + g.items.length, 0) <= room) {
      spread.forEach(take);
      break;
    }
  }
  groups.filter(g => g.key !== 'still' && !phases.includes(g)).forEach(take);
  const pictures = groups.filter(g => chosen.has(g)).flatMap(g => g.items);
  return { pictures, left: images.filter(image => !pictures.includes(image)).map(image => image.label) };
}

module.exports = { AiService, AiSteering, registerAiService, choosePictures, editingPrompt };
