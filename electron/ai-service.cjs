const fs = require('node:fs/promises');
const path = require('node:path');
const { simpleJob, lighterModels } = require('./ai-model-choice.cjs');
const { recordJob, noteOwnerReply, diaryText } = require('./ai-diary.cjs');
// Thinking effort for a connection; "default" leaves it to the provider.
const EFFORTS = ['default', 'medium', 'high', 'xhigh'];
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { startMcpServer } = require('./ai-mcp.cjs');
const { runModelScript } = require('./ai-sandbox.cjs');
const {
  runApi,
  runCodex,
  runClaude,
  providerModels,
  CodexProcess,
  endpoint,
  authenticationRequired,
} = require('./ai-providers.cjs');
const {
  spawnAgent,
  stopAgent,
  lines,
  providerEnvironment,
  checkAgentExecutable,
} = require('./ai-process.cjs');
const { AiAwareness, awarenessText } = require('./ai-awareness.cjs');
const {
  AiSteering,
  AiRecorder,
  OrganiserRegistry,
  RETIRE_AT,
  nextBird,
  contextUse,
  deleteProviderSessions,
  settleConversation,
} = require('./ai-offload.cjs');

// Optional per-prompt limits the user can set: dollars (API) and tool rounds. 0 = none.
const LIMITS = { spendLimit: 'Enter a spending limit in dollars, or leave it empty for none.', stepLimit: 'Enter a number of steps, or leave it empty for none.' };
function limitOf(config, name) {
  return typeof config[name] === 'number' ? config[name] : 0;
}
// Chats of models not used for this many days are cleaned up; 0 = never.
const DAY = 24 * 60 * 60 * 1000;
function cleanupDaysOf(config) {
  return typeof config.cleanupDays === 'number' ? config.cleanupDays : 3;
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
    this.workerLocks = new Map();
    this.random = Math.random;
  }
  async init() {
    if (!this.contract) this.contract = import(pathToFileURL(path.join(this.root, 'src/ai-tools.js')).href);
    return this.contract;
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
          this.config = { provider: 'codex', enabled: false, port: 0, providers: {} };
        }
        this.awareness.setEnabled(this.config.awareness === true);
        return this.config;
      })().catch(error => {
        this.loading = null;
        throw error;
      });
    return this.loading;
  }
  async persist() {
    await fs.writeFile(path.join(this.directory, 'connections.json'), JSON.stringify(this.config, null, 2), {
      mode: 0o600,
    });
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
      offload: config.offload !== false,
      routing: config.routing || 'manual',
      outsideCheck: config.outsideCheck !== false,
      allowLighter: provider.allowLighter === true,
      lightModel: provider.lightModel || '',
      effort: provider.effort || 'high',
      lighterModels: this.lighterChoices({ ...provider, provider: name }),
      spendLimit: limitOf(config, 'spendLimit'),
      stepLimit: limitOf(config, 'stepLimit'),
      cleanupDays: cleanupDaysOf(config),
      sdBrain:(await this.sdBrainAvailable()) && config.sdBrain === true,
      sdBrainAvailable: await this.sdBrainAvailable(),
      editingHandbook: config.editingHandbook === true,
      webResearch: config.webResearch === true,
    };
  }
  async setAwareness(enabled) {
    if (typeof enabled !== 'boolean') throw Error('Choose on or off.');
    const config = await this.configuration();
    config.awareness = enabled;
    await this.persist();
    this.awareness.setEnabled(enabled);
    this.emit({ type: 'awareness', enabled });
    return this.status();
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
  // Which chats are working, for the console: each task's chat and its current bird.
  runningChats() {
    return [...this.tasks.values()].flatMap(t => t.workers?.size ? [...t.workers.values()].map(w => ({ id: t.id, worker: w.id, documentId: t.documentId })) : [{ id: t.id, worker: t.worker?.id || null, documentId: t.documentId }]);
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
    if (!['codex', 'claude', 'openai', 'anthropic', 'compatible'].includes(input.provider))
      throw Error('Unknown AI provider.');
    if (input.routing !== undefined && !['manual', 'automatic', 'both'].includes(input.routing)) throw Error('Choose Manual, Automatic, or Both routing.');
    const previous = config.providers?.[input.provider] || {};
    if (input.baseUrl) endpoint(input.baseUrl);
    const native = ['codex', 'claude'].includes(input.provider),
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
      model: String(input.model || '').trim(),
      executable,
      baseUrl,
      key: baseUrl === (previous.baseUrl || '') ? previous.key || '' : '',
      allowLighter: input.allowLighter === undefined ? previous.allowLighter === true : input.allowLighter === true,
      lightModel: String(input.lightModel ?? previous.lightModel ?? ''),
      effort: EFFORTS.includes(input.effort) ? input.effort : previous.effort || 'high',
    };
    if (input.apiKey !== undefined && input.apiKey !== '') next.key = this.encrypt(String(input.apiKey));
    if (input.clearKey) next.key = '';
    const providerChanged = config.provider !== input.provider;
    config.provider = input.provider;
    if (input.routing !== undefined) config.routing = input.routing;
    if (input.outsideCheck !== undefined) config.outsideCheck = input.outsideCheck === true;
    config.providers ||= {};
    config.providers[input.provider] = next;
    await this.persist();
    if (providerChanged) this.emit({ type: 'organiser-reset' });
    return this.status();
  }
  lighterChoices(settings) {
    const models = this.modelCatalog?.[settings.provider + ':' + (settings.baseUrl || '')] || (settings.provider === 'claude' ? [{id:'haiku',name:'Haiku'}] : []);
    return lighterModels(models, settings.model);
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
            : Error('AI request cancelled.'),
        );
      };
      let timer = setTimeout(() => controller.abort(Error('The editor tool timed out.')), 180000);
      const finish = (error, value) => {
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
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id || '')) throw Error('Invalid conversation ID.');
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
        JSON.parse(await fs.readFile(path.join(this.directory, 'chat-' + id + '.json'), 'utf8')),
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      value = { id, provider, transcript: [], messages: [] };
    }
    if (value.provider !== provider) throw Error('Start a new chat after changing AI providers.');
    this.conversations.set(id, value);
    return value;
  }
  persistConversation(conversation) {
    const file = path.join(this.directory, 'chat-' + conversation.id + '.json'),
      text = JSON.stringify(conversation);
    const write = (this.writes.get(conversation.id) || Promise.resolve()).then(async () => {
      await fs.writeFile(file + '.tmp', text, { mode: 0o600 });
      await fs.rename(file + '.tmp', file);
    });
    this.writes.set(conversation.id, write);
    return write;
  }
  async taskInfo(id) {
    const settings = await this.settings(),
      conversation = await this.conversation(id, settings.provider),
      task = conversation.task;
    if (!task) return null;
    if (task.status === 'running' && !this.runningIds.has(id)) {
      task.status = 'interrupted';
      await this.persistConversation(conversation);
    }
    return {
      status: task.status,
      phase: task.phase,
      steps: task.steps,
      summary: task.summary || '',
      canResume: !task.regionJobs && ['interrupted', 'incomplete'].includes(task.status),
    };
  }
  async send({ id, text, images = [], context, resume = false, route, worker, job, lightChoice }) {
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
    // account before recording a turn or letting a provider make a model request.
    if (['codex', 'claude'].includes(settings.provider)) {
      const auth = await this.auth('status');
      if (!auth.loggedIn) {
        const error = authenticationRequired();
        return { ok: false, authRequired: true, error: error.message };
      }
    }
    const conversation = await this.conversation(id, settings.provider);
    if (!resume && conversation.kind === 'worker' && conversation.light) {
      return this.send({ id: conversation.organiserId, text, images, context, worker: conversation.name, route: 'continue', lightChoice: simpleJob(text, images) ? lightChoice : 'chosen' });
    }
    // The owner's next message is their reaction to the last job on this model.
    if (!resume && conversation.modelKey) {
      const entry = await this.registry.model(conversation.modelKey);
      if (noteOwnerReply(entry, text)) await this.registry.save();
    }
    if (settings.allowLighter && !this.modelCatalog?.[settings.provider + ':' + (settings.baseUrl || '')] && settings.provider !== 'claude') await this.models();
    const choices = this.lighterChoices(settings);
    const light = choices.find(m => m.id === settings.lightModel) || choices[0];
    const currentBird = conversation.workers?.find(w => w.status !== 'retired' && (worker ? (w.id === worker || w.name === worker) : (!route || route === 'continue') && w.id === conversation.currentWorker));
    if (currentBird?.light && !simpleJob(text, images)) lightChoice = 'chosen';
    const canUseLight = settings.allowLighter && light && (await this.configuration()).offload !== false;
    if (lightChoice !== undefined && !['chosen', 'light'].includes(lightChoice)) throw Error('Choose which model should do this job.');
    if (!resume && canUseLight && !simpleJob(text, images) && !lightChoice && conversation.kind !== 'worker') return { ok: false, modelChoiceRequired: true, message: 'This job may need judgement about shape or motion. A lighter model can lower the quality. Which model should do this job?' };
    settings.jobModel = canUseLight && lightChoice !== 'chosen' && (simpleJob(text, images) || lightChoice === 'light') ? light.id : settings.model;
    if (conversation.retired)
      throw Error(`${conversation.name ? 'The ' + conversation.name : 'This chat'} is retired. Ask the organiser, or start a new chat.`);
    if (conversation.region && !resume) context = await this.call('mdlxl_regions', { action: 'target', target: context.target, region: conversation.region, name: conversation.name }, controller.signal);
    const recorder = new AiRecorder(conversation, value => this.emit({ id, ...value }));
    const steering = new AiSteering(text => recorder.split(text));
    const active = { id, controller, steering, recorder, worker: null, documentId: context.documentId || null, modelKey: conversation.modelKey || null };
    this.tasks.set(id, active);
    this.emitRunning();
    const config = await this.configuration();
    if (conversation.modelKey) await this.markActivity(conversation.modelKey);
    try {
      const offload = conversation.kind === 'organiser' && config.offload !== false;
      const run = offload ? this.runOffload.bind(this) : this.runTask.bind(this);
      await run({
        route, worker, job,
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
        organiser: conversation.kind === 'organiser' && config.offload !== false ? active : null,
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
      recorder.reply.error = error.message;
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
  // The organiser is a local ledger. Only unaddressed automatic routing asks a model.
  async runOffload({ conversation, recorder, steering, text, images, context, resume, settings, contract, signal, organiser: active, policy, route, worker, job }) {
    if (resume) {
      const prior = conversation.task;
      if (!prior || !['interrupted', 'incomplete'].includes(prior.status))
        throw Object.assign(Error('There is no interrupted task to resume.'), { precondition: true });
      if (prior.regionJobs) throw Object.assign(Error('This multi-part job is unfinished. Send a new job with the remaining work so its current parts and combined result can be checked again. Applied edits remain in Undo.'), { precondition: true });
      const bird = await this.conversation(prior.workerId, settings.provider);
      const birdRecorder = new AiRecorder(bird, value => this.emit({ id: bird.id, ...value }));
      const birdSteering = new AiSteering(value => birdRecorder.split(value));
      recorder.start({ role: 'user', text: 'Resume task' });
      active.worker = { id: bird.id, steering: birdSteering };
      steering.forward = birdSteering;
      try {
        await this.runTask({ conversation: bird, recorder: birdRecorder, steering: birdSteering, text: '', images: [], context, resume: true, settings, contract, signal, policy });
        const report = birdRecorder.report();
        recorder.event({ type: 'text', text: report });
        conversation.messages.push({ role: 'assistant', content: report });
        prior.status = 'complete';
      } finally { steering.forward = null; active.worker = null; birdSteering.close(); birdRecorder.finish(); }
      return;
    }
    const config = await this.configuration();
    const workers = (conversation.workers || []).filter(w => w.status !== 'retired');
    const current = workers.find(w => w.id === conversation.currentWorker) || workers.at(-1);
    const named = workers.find(w => worker === w.id || worker === w.name || new RegExp('^(?:ask\\s+)?' + w.name + '(?:[:,]|\\s+to\\b)', 'i').test(text.trim()));
    route ||= config.routing === 'automatic' ? 'auto' : 'continue';
    if (!['continue', 'new', 'tiny', 'auto'].includes(route)) throw Error('Choose a job destination.');
    if (worker && !named) throw Error('That bird is no longer available. Choose a current bird.');
    recorder.start({ role: 'user', text, document: context.name, selection: context.selection, drawings: context.annotations?.strokes?.length || 0 });
    active.cost = {};
    let args = { job: job || text.trim().split(/\s+/).slice(0, 6).join(' ') };
    if (named) args.worker = named.name;
    else if (route === 'tiny') args.tiny = true;
    else if (route === 'continue' && current) { args.worker = current.name; args.job = current.job; }
    else if (route === 'auto') args = await this.routeJob({ conversation, recorder, text, workers, settings, contract, signal, structure: await this.call('mdlxl_regions', { action: 'summary', target: context.target }, signal) });
    const continuing = args.worker && workers.find(w => w.name === args.worker);
    if (continuing?.region) args.jobs = [{ ...continuing.region, worker: continuing.name, job: args.job }];
    const previousNote = conversation.modelKey ? (await this.registry.model(conversation.modelKey)).note : null;
    conversation.task = { prompt: text, context, status: 'running', phase: 'inspecting', steps: [], sdBrain: policy };
    conversation.messages ||= [];
    conversation.messages.push({ role: 'user', content: text });
    try {
      if (args.jobs) {
        conversation.task.regionJobs = args.jobs;
        const results = await this.runRegionJobs({ conversation, recorder, steering, text, images, context, settings, contract, signal, active, policy, jobs: args.jobs });
        conversation.task.status = 'complete'; conversation.task.phase = 'verified';
        conversation.task.summary = results.map(r => r.worker + ': ' + r.report).join('\n');
        return;
      }
      const result = await this.runWorker({ organiser: conversation, active, args, userText: text, images, context, settings, contract, signal, parent: recorder, parentSteering: steering, policy, memory: previousNote });
      conversation.task.workerId = conversation.currentWorker;
      conversation.messages.push({ role: 'assistant', content: result.worker + ': ' + result.report });
      if (result.status !== 'done') throw Error(result.error || result.report);
      conversation.task.status = 'complete';
      conversation.task.phase = 'complete';
      conversation.task.summary = result.report;
    } catch (error) {
      conversation.task.workerId = active.lastWorker || conversation.currentWorker;
      conversation.task.status = signal.aborted ? 'interrupted' : 'incomplete';
      throw error;
    }
  }
  async runRegionJobs({ conversation, recorder, steering, text, images, context, settings, contract, signal, active, policy, jobs }) {
    const { regionsConflict } = await import(pathToFileURL(path.join(this.root, 'src/ai-regions.js')).href);
    const declared = await this.call('mdlxl_regions', { target: context.target, action: 'declare', jobs }, signal);
    active.parallel = true; active.workers = new Map();
    const waiting = declared.jobs.map((job, index) => ({ job, index })), running = new Map(), results = [];
    let failure;
    const start = entry => {
      const promise = (async () => {
        const jobContext = await this.call('mdlxl_regions', { action: 'begin', batch: declared.batch, index: entry.index }, signal);
        const result = await this.runWorker({ organiser: conversation, active, args: { ...entry.job, lockKey: declared.batch + ':' + entry.index }, userText: text, images, context: jobContext, settings, contract, signal, parent: recorder, parentSteering: steering, policy });
        results[entry.index] = result;
        conversation.messages.push({ role: 'assistant', content: result.worker + ': ' + result.report });
        if (result.status !== 'done') failure ||= Error(result.error || result.report);
      })().catch(error => { failure ||= error; }).finally(() => running.delete(entry.index));
      running.set(entry.index, { region: entry.job.region, promise });
    };
    try {
      while (waiting.length || running.size) {
        if (signal.aborted) throw Error('AI request cancelled.');
        for (let i = 0; i < waiting.length;) {
          const entry = waiting[i];
          // Earlier conflicting jobs keep their order, including an exclusive structural job.
          const blocked = [...running.values()].some(r => regionsConflict(entry.job.region, r.region)) || waiting.slice(0, i).some(w => regionsConflict(entry.job.region, w.job.region));
          if (blocked) { i++; continue; }
          waiting.splice(i, 1); start(entry);
        }
        if (running.size) await Promise.race([...running.values()].map(r => r.promise));
        if (failure) { waiting.length = 0; await Promise.all([...running.values()].map(r => r.promise)); throw failure; }
      }
      const combined = await this.call('mdlxl_regions', { action: 'finish', batch: declared.batch }, signal);
      conversation.task.combinedReview = combined;
      recorder.event({ type: 'text', text: combined.passed ? 'Combined model checks passed: region boundaries, posed seams, and save/reopen.' : 'Combined model checks failed. The job is not complete.' });
      if (!combined.passed) throw Error('Combined model checks failed; inspect the seams and validation results before continuing.');
      return results;
    } finally {
      await Promise.allSettled([...running.values()].map(r => r.promise));
      await this.call('mdlxl_regions', { action: 'close', batch: declared.batch });
      active.parallel = false;
    }
  }
  async routeJob({ conversation, recorder, text, workers, settings, signal, structure }) {
    const routing = { id: conversation.id + '-router', messages: [], transcript: [], organiserId: conversation.id };
    let reply = '';
    const meter = this.measureUsage(routing, recorder, 'router');
    const available = this.modelCatalog?.[settings.provider + ':' + (settings.baseUrl || '')] || (settings.provider === 'claude' ? [{ id: 'haiku' }] : []);
    const light = available.find(m => /haiku|nano|mini|luna/i.test(m.id));
    const options = {
      settings: { ...settings, model: light?.id || settings.model, stepLimit: 1, effort: 'default' }, key: this.decrypt(settings.key), directory: this.directory,
      event: value => { if (value.type === 'text') reply += value.text; else meter(value); },
      tools: [], call: async () => { throw Error('Routing has no editor tools.'); },
      system: 'Route one message. Return only JSON: {"worker":"existing bird name or empty","job":"short title","tiny":false}. Continue the relevant bird for follow-ups. New unrelated jobs have an empty worker. Small one-step jobs use tiny:true. Do not answer or paraphrase the request. If the supplied structure proves a multi-part request can be split, return {"jobs":[{"job":"short part-specific task","scope":["/Geosets/0"],"readOnly":false,"structural":false}]}. Each job must have explicit canonical model paths (or readOnly:true). Include protectedPaths, animationRanges and globalSequence when needed. Adding, deleting or reordering tables, changing IDs, bindings or group tables is structural and exclusive. Unknown dependencies mean one job. Do not split a follow-up already addressed to a bird.',
      prompt: JSON.stringify({ text, current: conversation.currentWorker, birds: workers.map(w => ({ id: w.id, name: w.name, job: w.job, tiny: w.tiny })), ...(structure ? { structure } : {}) }),
      images: [], conversation: routing, signal, awareness: null, steering: new AiSteering(() => {}),
    };
    try {
      if (settings.provider === 'codex') await runCodex(options);
      else if (settings.provider === 'claude') await runClaude(options);
      else await runApi(options);
    } finally { options.steering.close(); }
    const args = JSON.parse(reply.trim().replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/g, ''));
    if (Array.isArray(args.jobs) && args.jobs.length) {
      if (args.jobs.some(j => !j || typeof j.job !== 'string' || !j.job.trim() || (!j.readOnly && !Array.isArray(j.scope)))) throw Error('The router did not declare valid model parts.');
      return { jobs: args.jobs };
    }
    if (typeof args.job !== 'string' || !args.job.trim() || (args.worker && !workers.some(w => w.name === args.worker))) throw Error('The router did not choose a valid job. Select a bird or New job and send again.');
    return { job: args.job.slice(0, 160), worker: args.worker || undefined, tiny: args.tiny === true };
  }
  measureUsage(conversation, recorder, role) {
    let lastTokens = 0, lastUsd = 0;
    const own = { calls: 0, tokens: null, usd: null };
    return value => {
      if (!['request', 'cost'].includes(value.type)) { recorder.event(value); return; }
      const active = this.tasks.get(conversation.organiserId) || this.tasks.get(conversation.id);
      if (!active) { if (value.type === 'cost') recorder.event(value); return; }
      const costs = (active.cost ||= {}), cost = (costs[role] ||= { calls: 0, tokens: null, usd: null });
      if (value.type === 'request') { cost.calls++; own.calls++; if (value.unit) cost.unit = own.unit = value.unit; }
      else {
        const delta = Math.max(0, value.tokens - lastTokens); cost.tokens = (cost.tokens || 0) + delta; own.tokens = (own.tokens || 0) + delta; lastTokens = value.tokens;
        if (value.usd !== null) { const deltaUsd = Math.max(0, value.usd - lastUsd); cost.usd = (cost.usd || 0) + deltaUsd; own.usd = (own.usd || 0) + deltaUsd; lastUsd = value.usd; }
        if (recorder !== active.recorder) recorder.event({ ...value, model: conversation.model, light: conversation.light, roles: { [role]: { ...own } } });
      }
      const rows = Object.values(costs);
      active.recorder.event({ type: 'cost', tokens: rows.every(c => c.tokens !== null) ? rows.reduce((n, c) => n + c.tokens, 0) : null, usd: rows.every(c => c.usd !== null) ? rows.reduce((n, c) => n + c.usd, 0) : null, roles: structuredClone(costs) });
    };
  }
  // One task on one conversation: the provider turn, edit checkpoints, verification
  // and steering. The organiser and each of its workers run through this.
  async runTask({ conversation, recorder, steering, text, images, context, resume, settings, contract, signal, organiser, entry, policy }) {
    const {
      AI_TOOLS,
      AI_SYSTEM_PROMPT,
      AI_EDITING_HANDBOOK,
      AI_PLAN_TOOL,
      guidesForRequest,
      AI_WEB_RESEARCH,
      AI_WORKER_TOOL,
      AI_ORGANISER_PROMPT,
      AI_WORKER_NOTE,
      aiToolEditsModel,
      sdBrainInstructions,
      sdReviewProblem,
    } = contract;
    const id = conversation.id;
    if (conversation.kind === 'worker' && conversation.model !== undefined) settings = { ...settings, model: conversation.model };
    const lightController = new AbortController();
    signal = AbortSignal.any([signal, lightController.signal]);
    let lightFailure;
    const escalate = reason => { lightFailure = Error(reason); lightFailure.code = 'AI_LIGHT_ESCALATE'; lightController.abort(lightFailure); throw lightFailure; };
    let task;
    if (resume) {
      task = conversation.task;
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
    } else
      task = conversation.task = {
        prompt: text,
        images,
        context,
        status: 'running',
        phase: 'inspecting',
        steps: [],
        sdBrain: policy || { enabled: false },
      };
    // SD Brain and the editing handbook stay as they were when the task started;
    // toggling applies to the next task. Workers inherit the organiser's policy.
    const sd = (task.sdBrain ||= policy || { enabled: false });
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
    let prompt =
      text +
      (resume
        ? '\n\nResume the interrupted task. Inspect the current model and these completed steps before continuing; do not repeat an applied edit. A pending step may have been interrupted before its result was recorded.\n' +
          JSON.stringify(task.steps)
        : '');
    if (organiser) prompt += '\n\n' + (await this.organiserBriefing(conversation));
    // SD Brain: the request first becomes an art brief, once per task. Workers get
    // the organiser task's brief with their job instead of writing their own.
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
    if (sd.handbook === true && !organiser && !conversation.toolsOff && !resume)
      for (const topic of guidesForRequest(text)) {
        try {
          const guide = await this.call('mdlxl_help', { topic }, signal);
          if (guide?.text) prompt += `\n\nEditing guide for this job (${topic}). Use its procedures where they fit this model:\n${guide.text}`;
        } catch {
          // A guide that cannot be read leaves the job as it was.
        }
      }
    // The AI doing the work sees what earlier jobs on this model did and why.
    if (!organiser && !conversation.toolsOff && conversation.modelKey) {
      const diary = diaryText(await this.registry.model(conversation.modelKey));
      if (diary) prompt += '\n\n' + diary;
    }
    if (await this.sdBrainAvailable()) prompt += `\n\nTask settings: SD Brain ${sd.enabled ? 'on' : 'off'} (policy ${sd.revision || 'n/a'}).`;
    if (this.awareness.enabled) prompt += '\n\n' + awarenessText(this.awareness.snapshot());
    prompt += '\n\nMDLxL context captured when this prompt was sent:\n' + JSON.stringify(context);
    let workerImages = images,
      lastInspect = null;
    const call = async (name, args, callSignal) => {
      if (signal.aborted) throw Error('AI request cancelled.');
      if (!tools.some(tool => tool.name === name)) throw Error('This tool is not available to this bird.');
      if (organiser && name === 'mdlxl_worker') {
        const attached = workerImages;
        workerImages = [];
        return this.runWorker({ organiser: conversation, active: organiser, args, userText: text, images: attached, context, settings, contract, signal, parent: recorder, parentSteering: steering, policy: sd, artBrief: task.artBrief });
      }
      // Look first, then change once: the plan is kept with the task, not sent to the editor.
      if (name === 'mdlxl_plan') {
        const options = Array.isArray(args.options) ? args.options : [];
        if (!String(args.cause || '').trim() || !String(args.reach || '').trim() || !args.keep?.length)
          throw Error('A plan names the cause, how far it reaches and what must stay the same.');
        if (options.length < 2 && !simpleJob(text, images))
          throw Error('Give at least two genuinely different fixes with what each costs, then choose one.');
        if (!Number.isInteger(args.choice) || !options[args.choice]) throw Error('choice must be the index of one of the options.');
        const replaces = !!task.plan;
        task.plan = { cause: args.cause, reach: args.reach, keep: args.keep, options, choice: args.choice, why: args.why, afterStep: task.steps.length };
        await this.persistConversation(conversation);
        return {
          recorded: true,
          ...(replaces ? { replaced: 'the previous plan' } : {}),
          chosen: options[args.choice].fix,
          next: 'Edit according to this plan. The review checks every keep item.',
        };
      }
      if (args.target && args.target !== context.target)
        throw Error('Use the target captured with the current prompt.');
      const requestSignal = callSignal ? AbortSignal.any([callSignal, signal]) : signal;
      const edit = aiToolEditsModel(name, args);
      // Model edits need a plan, except exact value edits; switching the view or going
      // back to a saved version does not.
      if (edit && name !== 'mdlxl_view' && name !== 'mdlxl_versions' && !task.plan && tools.includes(AI_PLAN_TOOL) && !simpleJob(text, images))
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
        if (sd.enabled) {
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
        if (args.action === 'finish' && args.outcome === 'passed' && sd.outside === true && !organiser && lastInspect) {
          const verdict = await this.outsideCheck({ request: task.prompt || text, plan: task.plan, inspect: lastInspect, settings, contract, signal, conversation, recorder });
          if (verdict) {
            task.outsideCheck = verdict;
            if (verdict.verdict !== 'good') {
              const said = `Outside check (a separate AI that saw only the request, the keep list, your checks and the pictures) says ${verdict.verdict}: ${verdict.problems.join('; ') || 'no reason given'}.`;
              if ((task.outsideRounds = (task.outsideRounds || 0) + 1) <= 2)
                throw Error(`${said} Correct what is real, run mdlxl_review inspect again, then finish.`);
              // Running out of rounds never turns a rejection into a pass.
              throw Error(
                `${said} This was round ${task.outsideRounds}; the result cannot be marked passed. Keep the edit and call mdlxl_review finish with outcome blocked, saying in one short plain sentence what the review could not confirm (for example that it could not compare matching poses).`,
              );
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
            ...(name === 'mdlxl_help' ? {} : { target: context.target }),
            ...(sd.enabled && name === 'mdlxl_review' && args.action === 'inspect' ? { turnaround: true } : {}),
          },
          requestSignal,
        );
        // What the outside check will judge: the latest inspected checks and pictures.
        if (edit) lastInspect = null;
        if (name === 'mdlxl_review' && args.action === 'inspect' && result && typeof result === 'object')
          lastInspect = { checks: result.review?.checks || [], images: result.images || [], missing: result.review?.missingEvidence || [] };
        // The review judges the plan's keep list along with the request.
        if (name === 'mdlxl_review' && args.action === 'inspect' && task.plan && result && typeof result === 'object')
          result.plan = { cause: task.plan.cause, chosen: task.plan.options[task.plan.choice].fix, keep: task.plan.keep, check: 'Confirm each keep item with a measured check or a visible comparison.' };
        if (edit || name === 'mdlxl_review') {
          task.checkpoint = await this.call('mdlxl_checkpoint', { target: context.target }, requestSignal);
          if (edit)
            Object.assign(task.steps.at(-1), {
              status: 'applied',
              changes: result.changes || [],
              applied: result.applied ?? task.checkpoint.review.changed,
            });
          if (edit || task.checkpoint.review.phase === 'verified') delete task.unresolvedEditError;
          await this.persistConversation(conversation);
        }
        if (conversation.light && name === 'mdlxl_review' && (result.review?.passed === false || result.passed === false || (args.action === 'finish' && ['needs-correction', 'blocked'].includes(args.outcome)))) escalate('The lighter model review failed; continuing with the chosen model.');
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
    const tools = organiser
      ? [
          AI_WORKER_TOOL,
          AI_TOOLS.find(tool => tool.name === 'mdlxl_help'),
          // With SD Brain on the organiser looks at the combined result itself.
          ...(sd.enabled ? [AI_TOOLS.find(tool => tool.name === 'mdlxl_capture')] : []),
        ]
      : conversation.toolsOff
        ? []
        : [...AI_TOOLS, AI_PLAN_TOOL];
    // The organiser only routes, so web research goes to the AI that does the work.
    const web = sd.web === true && !organiser;
    const editing =
      (sd.handbook === true ? AI_SYSTEM_PROMPT + '\n' + AI_EDITING_HANDBOOK : AI_SYSTEM_PROMPT) +
      (web ? '\n' + AI_WEB_RESEARCH : '');
    const system =
      organiser || (conversation.kind === 'organiser' && conversation.toolsOff)
      ? AI_ORGANISER_PROMPT
      : conversation.kind === 'worker'
        ? AI_WORKER_NOTE + '\n' + editing.slice(editing.indexOf('\n') + 1)
        : editing;
    // The SD Brain policy travels in the trusted instructions of every turn, so an
    // earlier "on" can never keep governing a task that started with it off.
    const instructions = (await this.sdBrainAvailable())
      ? system + '\n\n' + sdBrainInstructions(sd, organiser ? 'organiser' : conversation.toolsOff ? 'note' : 'direct')
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
          event: this.measureUsage(conversation, recorder, conversation.kind === 'worker' ? 'bird' : organiser || conversation.toolsOff ? 'organiser' : 'direct'),
          tools,
          call,
          system: instructions,
          prompt,
          images: runs++ ? [] : images,
          conversation,
          signal,
          awareness: this.awareness,
          steering,
          web,
        };
        if (settings.provider === 'codex') await runCodex(options);
        else if (settings.provider === 'claude') await runClaude(options);
        else await runApi(options);
        if (lightFailure) throw lightFailure;
        if (conversation.light && /\b(?:cannot|can't|couldn't|could not|unable to)\s+(?:finish|complete|do)\b/i.test(recorder.report())) escalate('The lighter model reported that it could not finish.');
        // Steering that arrived as the AI finished starts a follow-up turn on the same task.
        const late = steering.take();
        if (late) {
          recorder.separate();
          prompt = late + '\n\nMDLxL context captured when this prompt was sent:\n' + JSON.stringify(context);
          continue;
        }
        attempt++;
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
        if (conversation.light && review.changed && review.phase !== 'verified') escalate('The lighter model could not verify its edit.');
        // A short first line; the worker's own explanation follows in the same box.
        if (review.phase === 'blocked')
          throw Error(review.summary ? 'The edit is kept but not verified.\n' + review.summary : 'The edited model still needs verification.');
        if (attempt >= 4) break;
        await progress('verifying');
        recorder.event({ type: 'notice', text: 'Checking the result before completing the task.' });
        prompt =
          'The edit is still unverified. Do not repeat the edit. Call mdlxl_review inspect with checksCode for the requested result and protected data, inspect the images, correct failures, then mdlxl_review finish. Current review: ' +
          JSON.stringify(review) +
          '\n\nMDLxL context captured when this prompt was sent:\n' +
          JSON.stringify(context);
      }
      throw Error(
        'The edit is applied but verification is incomplete. Resume the task to finish checking it.',
      );
    } catch (error) {
      if (lightFailure) error = lightFailure;
      task.status = signal.aborted && !lightFailure ? 'interrupted' : 'incomplete';
      task.summary = error.message;
      throw error;
    } finally {
      this.runningIds.delete(id);
      // The decision diary keeps what this job did and why with the model.
      if (conversation.modelKey && !organiser)
        try {
          const entry = await this.registry.model(conversation.modelKey);
          task.diaryId ||= crypto.randomUUID();
          const outcome =
            (task.phase === 'verified' ? 'verified' : task.status === 'complete' ? 'complete' : (task.status || 'incomplete') + (task.summary ? ': ' + task.summary : '')) +
            (task.outsideCheck ? `; outside check: ${task.outsideCheck.verdict}` : '');
          if (recordJob(entry, { id: task.diaryId, request: task.prompt || text, plan: task.plan, steps: task.steps, outcome, bird: conversation.kind === 'worker' ? conversation.name : undefined })) {
            await this.persistConversation(conversation);
            await this.registry.save();
          }
        } catch {
          // A diary that cannot be written never fails the job itself.
        }
    }
  }
  // The roster and memory the organiser needs for routing, added to each prompt.
  async organiserBriefing(conversation) {
    const workers = (conversation.workers || []).filter(worker => worker.status !== 'retired');
    const entry = conversation.modelKey ? await this.registry.model(conversation.modelKey) : null;
    const lines = workers.map(
      worker =>
        `- ${worker.name}${worker.tiny ? ' (tiny jobs)' : ''}: ${worker.job}; ${Math.round((worker.use || 0) * 100)}% of its memory used`,
    );
    // Names the organiser can use before the worker exists: "I'll ask Crow to…".
    const tiny = workers.find(worker => worker.tiny);
    const names =
      `\nA new job would go to a new worker called ${this.pendingBird(conversation)}.` +
      (tiny ? ` Tiny jobs go to ${tiny.name}.` : ' The first tiny job starts a tiny-jobs worker with that next free name.');
    return (
      (lines.length ? 'Workers for this model:\n' + lines.join('\n') : 'No workers yet for this model.') +
      names +
      (entry?.note && conversation.transcript.length <= 2
        ? '\n\nMemory note from earlier work on this model:\n' + entry.note
        : '')
    );
  }
  // The next new worker's name is drawn once, so the organiser can announce it.
  pendingBird(organiser) {
    organiser.birds ||= [];
    if (!organiser.nextName || organiser.birds.includes(organiser.nextName))
      organiser.nextName = nextBird(organiser.birds, this.random);
    return organiser.nextName;
  }
  async runWorker({ organiser, active, args, userText, images, context, settings, contract, signal, parent, parentSteering, policy, artBrief, memory }) {
    // One bird edits a model at a time; birds of other models work alongside.
    const key = args.lockKey || organiser.modelKey || organiser.id,
      previous = this.workerLocks.get(key);
    let release;
    const lock = new Promise(resolve => (release = resolve));
    this.workerLocks.set(key, lock);
    await previous;
    organiser.workers ||= [];
    organiser.birds ||= [];
    const parentSignal = signal;
    let worker = null,
      handover = args.handover || null;
    try {
      const named = String(args.worker || '').trim().toLowerCase();
      if (named) {
        worker = organiser.workers.find(w => w.name.toLowerCase() === named);
        if (!worker)
          return {
            error: `There is no worker called ${args.worker}. Workers: ${organiser.workers.filter(w => w.status !== 'retired').map(w => w.name).join(', ') || 'none yet'}.`,
          };
        if (worker.status === 'retired')
          return { error: `${worker.name} is retired. Start a new worker for this job and include what it needs to know.` };
      } else if (args.tiny && !args.forceChosen) worker = organiser.workers.find(w => w.tiny && w.status !== 'retired') || null;
      if (worker?.light && (args.forceChosen || !settings.allowLighter || !simpleJob(userText, images))) {
        const previous = await this.conversation(worker.id, settings.provider);
        handover = { name: worker.name, note: this.workerHandover(previous, 'The follow-up requires the chosen model.') };
        await this.retireWorker(organiser, worker); worker = null; args = { ...args, forceChosen: true };
      }
      // A worker past half of its memory writes a handover note and retires.
      if (worker && (worker.use || 0) >= RETIRE_AT) {
        handover = { name: worker.name, note: await this.handover(worker, settings, contract, context, signal, policy) };
        await this.retireWorker(organiser, worker);
        worker = null;
      }
      if (!worker) {
        const name = this.pendingBird(organiser);
        delete organiser.nextName;
        organiser.birds.push(name);
        worker = {
          id: `${organiser.id}-${name.toLowerCase().replace(/\s+/g, '-')}`,
          name,
          job: args.tiny ? 'Tiny jobs' : args.job,
          tiny: !!args.tiny,
          model: args.forceChosen ? settings.model : (settings.jobModel || settings.model),
          light: !args.forceChosen && !!settings.jobModel && settings.jobModel !== settings.model,
          ...(args.region ? { region: args.region } : {}),
          status: 'idle',
          use: 0,
        };
        organiser.workers.push(worker);
        const created = { id: worker.id, provider: settings.provider, transcript: [], messages: [], kind: 'worker', organiserId: organiser.id, modelKey: organiser.modelKey, name, tiny: worker.tiny, model: worker.model, light: worker.light, ...(args.region ? { region: args.region } : {}) };
        this.conversations.set(worker.id, created);
        await this.persistConversation(created);
      } else if (!worker.tiny) worker.job = args.job;
      worker.model ??= settings.model;
      worker.status = 'working';
      await this.persistConversation(organiser);
      this.emitRoster(organiser);
      parent.event({ type: 'worker', workerId: worker.id, name: worker.name, job: args.job, model: worker.model, light: worker.light, region: context.region ? (context.region.readOnly ? 'read only' : context.region.scope.join(', ')) : undefined, status: 'working' });
      const conversation = await this.conversation(worker.id, settings.provider);
      const recorder = new AiRecorder(conversation, value => this.emit({ id: worker.id, ...value }));
      const steering = new AiSteering(text => recorder.split(text));
      if (!active.parallel) parentSteering.forward = steering;
      const controller = new AbortController();
      signal = AbortSignal.any([signal, controller.signal]);
      const runningWorker = { id: worker.id, name: worker.name, light: worker.light, steering, controller };
      (active.workers ||= new Map()).set(worker.id, runningWorker);
      if (!active.parallel) active.worker = { id: worker.id, steering };
      active.lastWorker = worker.id;
      this.emitRunning();
      const text =
        `Job: ${args.job}\n\n${userText}` +
        (policy?.enabled && artBrief ? `\n\nSD art brief for this request:\n${artBrief}` : '') +
        (handover ? `\n\nHandover note from ${handover.name}, who worked on this before you:\n${handover.note}` : '') +
        (!conversation.messages.length && memory ? `\n\nMemory note from earlier work on this model:\n${memory}` : '');
      if (context.region) {
        await this.call('mdlxl_regions', { action: 'label', target: context.target, name: worker.name });
      }
      let status = 'done',
        error;
      try {
        await this.runTask({ conversation, recorder, steering, text, images, context, resume: false, settings: { ...settings, model: worker.model }, contract, signal, policy, entry: { from: 'organiser', job: args.job } });
      } catch (reason) {
        if (signal.aborted && !runningWorker.escalation) throw reason;
        if (runningWorker.escalation) userText += '\n\nUser steering: ' + runningWorker.escalation;
        status = 'failed';
        error = runningWorker.escalation ? 'The user steered this job into work for the chosen model.' : reason.message;
        recorder.reply.error = reason.message;
        recorder.event({ type: 'error', text: reason.message, worker: true });
      } finally {
        recorder.finish();
        if (!active.parallel) parentSteering.forward = null;
        active.workers?.delete(worker.id);
        if (active.worker?.id === worker.id) active.worker = null;
        this.emitRunning();
        const late = steering.take();
        if (late && !active.parallel) parentSteering.requeue(late);
        steering.close();
        worker.use = contextUse(conversation);
        worker.status = 'idle';
        await this.persistConversation(conversation);
      }
      organiser.currentWorker = worker.id;
      const report = recorder.report().slice(-4000);
      parent.event({ type: 'worker', workerId: worker.id, name: worker.name, job: args.job, status, report, model: worker.model, light: worker.light, cost: recorder.reply.cost ? { ...recorder.reply.cost, model: worker.model, light: worker.light } : undefined });
      if (status === 'failed' && worker.light && !args.forceChosen) {
        const note = this.workerHandover(conversation, error || 'The lighter model did not finish.');
        await this.retireWorker(organiser, worker);
        parent.event({ type: 'notice', text: worker.name + ' handed the unfinished job to the chosen model.' });
        release();
        return this.runWorker({ organiser, active, args: { ...args, worker: undefined, forceChosen: true, handover: { name: worker.name, note } }, userText, images, context, settings, contract, signal: parentSignal, parent, parentSteering, policy, artBrief, memory });
      }
      return {
        worker: worker.name,
        status,
        report: report || '(no report)',
        ...(error ? { error } : {}),
        memoryUsed: Math.round(worker.use * 100) + '%',
        ...(handover ? { replaced: `${handover.name} retired with a handover note; ${worker.name} took over.` } : {}),
      };
    } finally {
      if (worker) await this.persistConversation(organiser).catch(() => {});
      if (worker) this.emitRoster(organiser);
      release();
      if (this.workerLocks.get(key) === lock) this.workerLocks.delete(key);
    }
  }
  workerHandover(conversation, reason) {
    return reason + '\nApplied edits remain in the model; inspect and verify before making further changes. Do not repeat completed edits.\n' + JSON.stringify({ task: conversation.task?.prompt, steps: conversation.task?.steps, review: conversation.task?.checkpoint?.review, report: conversation.task?.summary }).slice(-12000);
  }
  // SD Brain's art director: one tool-free turn in a throwaway chat that turns the
  // user's words into an SD art brief. Nothing of it is kept but the brief.
  async artDirection({ text, images, context, settings, contract, signal, conversation }) {
    const art = { id: `${conversation.id}-art`, provider: settings.provider, transcript: [], messages: [], kind: 'art' };
    const counts = context.counts || {},
      model = counts.geosets
        ? `The open model ${context.name} has ${counts.geosets} geosets and ${counts.triangles} triangles${context.selection && Object.keys(context.selection).length ? ', with a selection the user made' : ''}.`
        : `The open model ${context.name} is empty, so this creates something new.`;
    let reply = '';
    const options = {
      settings,
      key: this.decrypt(settings.key),
      directory: this.directory,
      event: (() => { const meter = this.measureUsage(conversation, new AiRecorder(conversation, () => {}), 'bird'); return value => { if (value.type === 'text') reply += value.text; else meter(value); }; })(),
      tools: [],
      call: async () => {
        throw Error('The art director has no tools.');
      },
      system: contract.AI_SD_ART_DIRECTOR,
      prompt: `The user's request, exactly as written:\n${text}\n\n${model}`,
      images,
      conversation: art,
      signal,
      // The art director never watches the editor (providers skip awareness when it is null).
      awareness: null,
      steering: new AiSteering(() => {}),
    };
    if (settings.provider === 'codex') await runCodex(options);
    else if (settings.provider === 'claude') await runClaude(options);
    else await runApi(options);
    return reply.trim().slice(0, 4000);
  }
  // One tool-free call to a fresh AI with no part of the worker's conversation.
  // Returns {verdict, confidence, problems, strengths}, or null when it could not judge.
  async outsideCheck({ request, plan, inspect, settings, contract, signal, conversation, recorder }) {
    const judge = { id: `${conversation.id}-check`, provider: settings.provider, transcript: [], messages: [], kind: 'check' };
    const { pictures, left } = choosePictures(inspect.images);
    let reply = '';
    const meter = this.measureUsage(conversation, new AiRecorder(conversation, () => {}), 'outside check');
    const options = {
      settings,
      key: this.decrypt(settings.key),
      directory: this.directory,
      event: value => {
        if (value.type === 'text') reply += value.text;
        else meter(value);
      },
      tools: [],
      call: async () => {
        throw Error('The outside check has no tools.');
      },
      system: contract.AI_OUTSIDE_CHECK,
      prompt: [
        `The owner's request, exactly as written:\n${request}`,
        plan
          ? `The worker's plan: cause: ${plan.cause}; chosen fix: ${plan.options?.[plan.choice]?.fix}; promised to keep: ${(plan.keep || []).join('; ')}.`
          : 'The worker recorded no plan (an exact value edit).',
        `The worker's own checks:\n${JSON.stringify(inspect.checks.map(c => ({ name: c.name, passed: c.passed, actual: c.actual, expected: c.expected }))).slice(0, 4000)}`,
        `Pictures, in order: ${pictures.map((p, i) => `${i + 1}. ${p.label}`).join('; ') || 'none'}.`,
        ...(left.length ? [`Not sent, to keep the set small (the worker saw them): ${left.join('; ')}.`] : []),
        ...(inspect.missing?.length ? [`Evidence the review could not produce: ${inspect.missing.join(' ')}`] : []),
      ].join('\n\n'),
      images: pictures.map(p => p.image),
      conversation: judge,
      signal,
      // The judge never watches the editor and is never steered.
      awareness: null,
      steering: new AiSteering(() => {}),
    };
    // The check is a step in the chat like any tool: a tick when good, a cross otherwise;
    // clicking it shows the verdict.
    const callId = `${judge.id}-${Date.now()}`;
    recorder.event({ type: 'tool', name: 'outside_check', callId, detail: 'Judging the request, the keep list and the pictures.' });
    try {
      if (settings.provider === 'codex') await runCodex(options);
      else if (settings.provider === 'claude') await runClaude(options);
      else await runApi(options);
      const found = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
      if (!['good', 'doubtful', 'wrong'].includes(found.verdict)) throw Error('no verdict');
      const verdict = {
        verdict: found.verdict,
        confidence: Math.max(0, Math.min(1, Number(found.confidence) || 0)),
        problems: (Array.isArray(found.problems) ? found.problems : []).map(String).slice(0, 8),
        strengths: (Array.isArray(found.strengths) ? found.strengths : []).map(String).slice(0, 8),
      };
      const text = `Outside check: ${verdict.verdict} (confidence ${Math.round(verdict.confidence * 100)}%)${verdict.problems.length ? ' — ' + verdict.problems.join('; ') : ''}`;
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
  async handover(worker, settings, contract, context, signal, policy) {
    const conversation = await this.conversation(worker.id, settings.provider);
    const recorder = new AiRecorder(conversation, value => this.emit({ id: worker.id, ...value }));
    const steering = new AiSteering(() => {});
    conversation.toolsOff = true;
    try {
      await this.runTask({ conversation, recorder, steering, text: contract.AI_HANDOVER_PROMPT, images: [], context, resume: false, settings, contract, signal, policy, entry: { from: 'organiser', job: 'Handover' } });
    } finally {
      delete conversation.toolsOff;
      steering.close();
      recorder.finish();
    }
    return recorder.report() || recorder.reply.text.trim() || '(no note)';
  }
  async retireWorker(organiser, worker) {
    worker.status = 'retired';
    worker.retiredAt = new Date().toISOString();
    const conversation = this.conversations.get(worker.id);
    if (conversation) {
      conversation.retired = true;
      await this.persistConversation(conversation);
    }
    await this.persistConversation(organiser);
    this.emitRoster(organiser);
  }
  emitRoster(organiser) {
    this.emit({ id: organiser.id, type: 'roster', workers: organiser.workers || [] });
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
      config = await this.configuration(),
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
      workers: conversation.workers || [],
      earlier: entry.earlier,
      offload: config.offload !== false,
      currentWorker: conversation.currentWorker || null,
      hasNote: !!entry.note,
    };
  }
  async createOrganiser(entry, modelKey, settings) {
    const id = OrganiserRegistry.newId();
    const conversation = { id, provider: settings.provider, transcript: [], messages: [], kind: 'organiser', modelKey, name: entry.name, workers: [], birds: [] };
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
    if (typeof enabled !== 'boolean') throw Error('Choose on or off.');
    const config = await this.configuration();
    config.sdBrain = enabled;
    await this.persist();
    this.emit({ type: 'sd-brain', enabled });
    return this.status();
  }
  // The editing handbook is off until the user turns it on; it applies from the next task.
  async setEditingHandbook(enabled) {
    if (typeof enabled !== 'boolean') throw Error('Choose on or off.');
    const config = await this.configuration();
    config.editingHandbook = enabled;
    await this.persist();
    this.emit({ type: 'editing-handbook', enabled });
    return this.status();
  }
  // Web research is off until the user turns it on; it applies from the next task.
  async setWebResearch(enabled) {
    if (typeof enabled !== 'boolean') throw Error('Choose on or off.');
    const config = await this.configuration();
    config.webResearch = enabled;
    await this.persist();
    this.emit({ type: 'web-research', enabled });
    return this.status();
  }
  async sdBrainPolicy() {
    const config = await this.configuration(),
      { SD_BRAIN_REVISION } = await this.init();
    return { enabled: (await this.sdBrainAvailable()) && config.sdBrain === true, revision: SD_BRAIN_REVISION };
  }
  async setOffload(enabled) {
    if (typeof enabled !== 'boolean') throw Error('Choose on or off.');
    const config = await this.configuration();
    config.offload = enabled;
    await this.persist();
    this.emit({ type: 'offload', enabled });
    return this.status();
  }
  async setRememberedCleanup({ modelKey, remember }) {
    if (!['ask', 'keep', 'summary', 'wipe'].includes(remember)) throw Error('Unknown choice.');
    const entry = await this.registry.model(modelKey);
    entry.remember = remember;
    await this.registry.save();
    return { remember };
  }
  // After a save: keep everything, keep a memory note, or delete every chat for this model.
  async cleanup({ modelKey, mode, remember = false }) {
    if (!['keep', 'summary', 'wipe'].includes(mode)) throw Error('Unknown cleanup choice.');
    if (this.active || this.modelBusy(modelKey)) throw Error('Wait until the AI finishes before cleaning up its chats.');
    const entry = await this.registry.model(modelKey);
    if (remember) entry.remember = mode;
    entry.activity = false;
    if (mode === 'keep') {
      await this.registry.save();
      return { mode };
    }
    const settings = await this.settings();
    let note = null;
    if (mode === 'summary' && entry.organiser) {
      const organiser = await this.conversation(entry.organiser, settings.provider).catch(() => null);
      if (organiser?.transcript.length) note = await this.memoryNote(organiser, settings, entry.note);
    }
    const { ids, providerFiles } = await this.removeChats(entry);
    entry.note = mode === 'summary' ? note || entry.note : null;
    // A summary keeps the decision diary; wiping removes it with the chats.
    if (mode === 'wipe') delete entry.diary;
    entry.organiser = null;
    entry.earlier = [];
    await this.registry.save();
    this.emit({ type: 'organiser-reset', modelKey });
    return { mode, removedChats: ids.length, providerFiles, note: entry.note };
  }
  // A model's chat files: its organisers, their birds, and the provider thread ids.
  async chatsOf(entry) {
    const ids = [],
      threads = [];
    for (const organiserId of [entry.organiser, ...(entry.earlier || [])].filter(Boolean)) {
      const organiser = await this.readConversation(organiserId);
      ids.push(organiserId);
      if (organiser?.threadId) threads.push(organiser.threadId);
      for (const worker of organiser?.workers || []) {
        const conversation = await this.readConversation(worker.id);
        ids.push(worker.id);
        if (conversation?.threadId) threads.push(conversation.threadId);
      }
    }
    return { ids, threads };
  }
  async removeChats(entry) {
    const { ids, threads } = await this.chatsOf(entry);
    for (const id of ids) {
      this.conversations.delete(id);
      await this.writes.get(id)?.catch(() => {});
      await fs.rm(path.join(this.directory, 'chat-' + id + '.json'), { force: true });
    }
    return { ids, providerFiles: await deleteProviderSessions(this.directory, threads) };
  }
  // Important models keep their chats; automatic cleanup never removes them.
  async setImportant({ modelKey, important }) {
    if (typeof important !== 'boolean') throw Error('Choose on or off.');
    const entry = await this.registry.model(modelKey);
    entry.important = important;
    await this.registry.save();
    return { important };
  }
  // Models get moved, renamed or edited in other programs, so their chats can be
  // left behind. Every chat, note, diary, provider copy and temporary file of a
  // model not used for `cleanupDays` days is deleted, unless the model is important.
  async cleanupUnused(now = Date.now()) {
    const days = cleanupDaysOf(await this.configuration());
    if (!days || this.active || this.tasks.size || this.closing) return { models: 0, files: 0 };
    const cutoff = now - days * DAY,
      data = await this.registry.load(),
      kept = new Set(),
      keptThreads = new Set();
    let models = 0,
      files = 0;
    const newest = async ids => {
      let time = 0;
      for (const id of ids) {
        const stat = await fs.stat(path.join(this.directory, 'chat-' + id + '.json')).catch(() => null);
        if (stat) time = Math.max(time, stat.mtimeMs);
      }
      return time;
    };
    for (const [key, entry] of Object.entries(data.models)) {
      const chats = await this.chatsOf(entry);
      const used = Math.max(entry.used || 0, await newest(chats.ids));
      // An entry with no date yet starts its timer now.
      if (!used) entry.used = now;
      if (entry.important || this.modelBusy(key) || !used || used > cutoff) {
        for (const id of chats.ids) kept.add(id);
        for (const thread of chats.threads) keptThreads.add(thread);
        continue;
      }
      const removed = await this.removeChats(entry);
      files += removed.ids.length + removed.providerFiles;
      delete data.models[key];
      models++;
      this.emit({ type: 'organiser-reset', modelKey: key });
    }
    await this.registry.save();
    // Chats no model points to any more, and provider copies and run folders left by them.
    const old = async full => ((await fs.stat(full).catch(() => null))?.mtimeMs ?? now) <= cutoff;
    for (const name of await fs.readdir(this.directory).catch(() => [])) {
      const full = path.join(this.directory, name),
        chat = /^chat-([a-zA-Z0-9_-]{1,80})\.json(\.tmp)?$/.exec(name);
      if (chat ? kept.has(chat[1]) || this.conversations.has(chat[1]) : !/^claude-run-/.test(name)) continue;
      if (!(await old(full))) continue;
      await fs.rm(full, { recursive: true, force: true });
      files++;
    }
    // Only session logs and temporary files: sign-in and provider settings stay.
    const sweep = async (folder, unwanted, depth = 0) => {
      for (const item of await fs.readdir(folder, { withFileTypes: true }).catch(() => [])) {
        const full = path.join(folder, item.name);
        if (item.isDirectory()) {
          if (depth < 6) await sweep(full, unwanted, depth + 1);
        } else if (unwanted(item.name) && (await old(full))) {
          await fs.rm(full, { force: true });
          files++;
        }
      }
    };
    const orphanLog = name => /\.jsonl?$/i.test(name) && ![...keptThreads].some(id => name.includes(id));
    await sweep(path.join(this.directory, 'temp'), () => true);
    for (const folder of ['codex/sessions', 'codex/archived_sessions', 'claude/projects'])
      await sweep(path.join(this.directory, folder), orphanLog);
    return { models, files };
  }
  // Checks a minute after start and then every few hours while MDLxL is open.
  startCleanup() {
    const run = () => this.cleanupUnused().catch(error => console.error('AI cleanup: ' + error.message));
    this.cleanupTimers = [setTimeout(run, 60000), setInterval(run, 6 * 60 * 60 * 1000)];
    for (const timer of this.cleanupTimers) timer.unref?.();
  }
  async memoryNote(organiser, settings, previousNote) {
    const contract = await this.init(),
      controller = new AbortController();
    const active = { id: organiser.id, controller, steering: null, worker: null };
    this.active = active;
    const recorder = new AiRecorder(organiser, value => this.emit({ id: organiser.id, ...value }));
    const steering = new AiSteering(() => {});
    organiser.toolsOff = true;
    try {
      await this.runTask({
        conversation: organiser,
        recorder,
        steering,
        text: contract.AI_MEMORY_PROMPT + (previousNote ? '\n\nThe earlier memory note to fold in:\n' + previousNote : ''),
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
      return settleConversation(JSON.parse(await fs.readFile(path.join(this.directory, 'chat-' + id + '.json'), 'utf8')));
    } catch {
      return null;
    }
  }
  // The task a chat belongs to: its own, or the organiser task its bird works for.
  taskOf(id) {
    return [...this.tasks.values()].find(t => t.id === id || t.worker?.id === id || t.workers?.has(id)) || null;
  }
  modelBusy(modelKey) {
    return [...this.tasks.values()].some(t => t.modelKey && t.modelKey === modelKey);
  }
  async steer({ id, text, annotations }) {
    const active = this.taskOf(id);
    if (!active?.steering) return { queued: false };
    if (typeof text !== 'string' || !text.trim() || text.length > 20000)
      throw Error('Enter a message of 1–20000 characters.');
    const message =
      'The user sent this while you were working. Treat it as steering for the current task:\n' +
      text +
      (annotations ? '\n\nCurrent console drawings (context.annotations):\n' + JSON.stringify(annotations) : '');
    // Steering the organiser reaches the worker it is waiting on; steering a
    // running worker directly goes only to that worker.
    const deliver = w => {
      if (w.light && !simpleJob(text)) { w.escalation = text; w.controller.abort(Error('Complex steering requires the chosen model.')); }
      else w.steering.push(text, message);
      this.emit({ id: w.id, type: 'steer', text });
    };
    const addressed = active.workers?.get(id);
    if (addressed) {
      deliver(addressed); return { queued: true };
    }
    if (active.parallel && active.workers?.size) {
      const conversation = await this.readConversation(active.id);
      const workers = (conversation.workers || []).filter(w => active.workers.has(w.id));
      const named = workers.find(w => new RegExp('^(?:ask\\s+)?' + w.name + '(?:[:,]|\\s+to\\b)', 'i').test(text.trim()));
      const choice = named ? { worker: named.name } : await this.routeJob({ conversation, recorder: active.recorder, text, workers, settings: await this.settings(), signal: active.controller.signal });
      const selected = workers.find(w => w.name === choice.worker);
      const targets = selected ? [active.workers.get(selected.id)] : [...active.workers.values()];
      for (const w of targets) deliver(w);
      active.recorder.split(text); return { queued: true };
    }
    if (active.worker && id === active.worker.id) {
      active.worker.steering.push(text, message);
      this.emit({ id, type: 'steer', text });
      return { queued: true };
    }
    if (active.id !== id) return { queued: false };
    const only = active.workers?.size === 1 ? [...active.workers.values()][0] : null;
    if (only?.light && !simpleJob(text)) { active.recorder.split(text); deliver(only); return { queued: true }; }
    active.steering.push(text, message);
    this.emit({ id, type: 'steer', text });
    if (active.worker) this.emit({ id: active.worker.id, type: 'steer', text });
    return { queued: true };
  }
  // Stop one chat's task (and its bird); without a chat, everything.
  cancel(id) {
    if (id) { const task = this.taskOf(id); return (task?.workers?.get(id)?.controller || task?.controller)?.abort(); }
    this.active?.controller.abort();
    for (const task of this.tasks.values()) task.controller.abort();
  }
  async models() {
    if (this.busy()) throw Error('Stop the current AI request before loading models.');
    const active = { controller: new AbortController() };
    this.active = active;
    try {
      const settings = await this.settings(),
        signal = active.controller.signal;
      if (settings.provider === 'codex') {
        const client = new CodexProcess(settings, { directory: this.directory, signal });
        try {
          await client.start();
          const result = await client.request('model/list');
          const models = (result.data || []).map(m => ({
            id: m.model || m.id,
            name: m.displayName || m.model || m.id,
          }));
          (this.modelCatalog ||= {})[settings.provider + ':' + (settings.baseUrl || '')] = models;
          return models;
        } finally {
          await client.close();
        }
      }
      const models = await providerModels(settings, this.decrypt(settings.key), signal);
      (this.modelCatalog ||= {})[settings.provider + ':' + (settings.baseUrl || '')] = models;
      return models;
    } finally {
      if (this.active === active) this.active = null;
    }
  }
  async auth(action) {
    if (!['login', 'logout', 'status'].includes(action)) throw Error('Unknown sign-in action.');
    // Checking the account only reads it, so it runs beside jobs on other models (the
    // console checks before every send); signing in or out waits for every job.
    const exclusive = action !== 'status';
    if (exclusive && this.busy()) throw Error('Stop the current AI request before signing in or out.');
    const settings = await this.settings();
    if (!['codex', 'claude'].includes(settings.provider)) throw Error('This provider uses an API key.');
    const controller = new AbortController();
    if (exclusive) this.active = { controller, auth: true };
    try {
      if (settings.provider === 'codex') {
        const client = new CodexProcess(settings, { directory: this.directory, signal: controller.signal });
        try {
          await client.start();
          if (action === 'status') {
            const result = await client.account();
            return {
              account: result.account,
              loggedIn: !!result.account || result.requiresOpenaiAuth === false,
            };
          }
          if (action === 'logout') {
            await client.request('account/logout');
            return { loggedIn: false };
          }
          const completed = new Promise((resolve, reject) => {
            client.login = p => (p.success ? resolve() : reject(Error(p.error || 'Login failed.')));
            client.loginError = reject;
          });
          completed.catch(() => {});
          const login = await client.request('account/login/start', { type: 'chatgpt' });
          const url = new URL(login.authUrl);
          if (url.protocol !== 'https:') throw Error('Invalid sign-in URL.');
          await this.electron.shell.openExternal(url.href);
          this.emit({ type: 'auth', text: 'Complete sign-in in your browser.' });
          await completed;
          const result = await client.account();
          if (!result.account) throw authenticationRequired();
          return { loggedIn: true, account: result.account };
        } finally {
          await client.close();
        }
      }
      const env = providerEnvironment(this.directory, 'claude');
      await fs.mkdir(env.CLAUDE_CONFIG_DIR, { recursive: true });
      await fs.mkdir(env.TEMP, { recursive: true });
      if (controller.signal.aborted) throw Error('Sign-in cancelled.');
      const child = spawnAgent(settings.executable || 'claude', ['auth', action], {
        cwd: this.directory,
        env,
      });
      let output = '';
      const abort = () => stopAgent(child);
      controller.signal.addEventListener('abort', abort, { once: true });
      try {
        await new Promise((resolve, reject) => {
          child.on('error', reject);
          child.once('close', code =>
            code === 0 || (action === 'status' && code === 1)
              ? resolve()
              : reject(Error('Claude authentication did not complete.')),
          );
          lines(child.stdout, line => {
            output += line + '\n';
            if (action === 'login') this.emit({ type: 'auth', text: line.slice(0, 1500) });
          });
          child.stderr.on('data', () => {});
          child.stdin.end();
        });
        if (action === 'status') {
          const status = JSON.parse(output);
          return { loggedIn: !!status.loggedIn, authMethod: status.authMethod };
        }
        return { loggedIn: action === 'login' };
      } finally {
        controller.signal.removeEventListener('abort', abort);
        stopAgent(child);
      }
    } finally {
      if (exclusive) this.active = null;
    }
  }
  close() {
    return (this.closePromise ||= Promise.resolve().then(async () => {
      this.closing = true;
      for (const timer of this.cleanupTimers || []) clearTimeout(timer);
      this.cancel();
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
  handle('ai:organiser', input => service.organiser(input));
  handle('ai:newOrganiser', input => service.newOrganiser(input));
  handle('ai:rekey', input => service.rekey(input));
  handle('ai:saveState', input => service.saveState(input));
  handle('ai:cleanup', input => service.cleanup(input));
  handle('ai:rememberCleanup', input => service.setRememberedCleanup(input));
  handle('ai:important', input => service.setImportant(input));
  handle('ai:offload', enabled => service.setOffload(enabled));
  handle('ai:sdBrain', enabled => service.setSdBrain(enabled));
  handle('ai:editingHandbook', enabled => service.setEditingHandbook(enabled));
  handle('ai:webResearch', enabled => service.setWebResearch(enabled));
  handle('ai:model', model => service.setModel(model));
  handle('ai:auth', action => service.auth(action));
  handle('ai:models', () => service.models());
  handle('ai:transcript', async id => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id || '')) throw Error('Invalid conversation ID.');
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
  handle('ai:capture', async rect => {
    if (rect && !['x', 'y', 'width', 'height'].every(k => Number.isInteger(rect[k]) && rect[k] >= 0))
      throw Error('Invalid capture rectangle.');
    return (await getWindow().webContents.capturePage(rect)).toDataURL();
  });
  handle('ai:gesture', async ({ requestId, points, button = 'left', modifiers = [] }) => {
    const request = service.pending.get(requestId),
      win = getWindow();
    if (!request) throw Error('The input request is no longer active.');
    const [width, height] = win.getContentSize();
    if (
      !Array.isArray(points) ||
      !points.length ||
      points.length > 300 ||
      points.some(
        p =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((v, i) => !Number.isInteger(v) || v < 0 || v >= (i ? height : width)),
      )
    )
      throw Error('Invalid editor gesture.');
    if (
      !['left', 'middle', 'right'].includes(button) ||
      modifiers.some(m => !['shift', 'control', 'alt', 'meta'].includes(m))
    )
      throw Error('Invalid mouse button or modifiers.');
    const mouse = (type, point) =>
      win.webContents.sendInputEvent({
        type,
        x: point[0],
        y: point[1],
        button,
        clickCount: 1,
        modifiers: [...modifiers, ...(type === 'mouseMove' ? [button + 'buttondown'] : [])],
      });
    let last = points[0];
    if (request.signal?.aborted) throw Error('AI request cancelled.');
    mouse('mouseMove', last);
    mouse('mouseDown', last);
    try {
      for (const point of points.slice(1)) {
        if (request.signal?.aborted) throw Error('AI request cancelled.');
        last = point;
        mouse('mouseMove', point);
        await new Promise(resolve => setTimeout(resolve, 16));
      }
    } finally {
      if (!win.isDestroyed()) mouse('mouseUp', last);
    }
    return { performed: true };
  });
  handle('ai:readModel', async ({ path: file }) => {
    if (!path.isAbsolute(file || '') || !['.mdx', '.mdl'].includes(path.extname(file).toLowerCase()))
      throw Error('Choose an absolute MDL or MDX path.');
    return readModel(file);
  });
  handle('ai:writeModel', async ({ path: file, bytes, overwrite, format, forgeAssets }) => {
    if (!path.isAbsolute(file || '') || !['.mdx', '.mdl'].includes(path.extname(file).toLowerCase()))
      throw Error('Choose an absolute MDL or MDX output path.');
    return writeModel({
      path: file,
      bytes,
      format,
      forgeAssets,
      overwrite: overwrite === true,
      export: true,
    });
  });
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
    service.emit({ type: 'waiting', waiting: !!data.waiting, document: String(data?.document || '') });
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
    if (group.items.length > room) return;
    chosen.add(group);
    room -= group.items.length;
  };
  const phases = groups.filter(g => /^frame /.test(g.key));
  groups.filter(g => g.key === 'still').forEach(take);
  for (let count = phases.length; count > 0; count--) {
    const spread = [...new Set(Array.from({ length: count }, (_, i) => Math.round(count === 1 ? (phases.length - 1) / 2 : (i * (phases.length - 1)) / (count - 1))))].map(i => phases[i]);
    if (spread.reduce((n, g) => n + g.items.length, 0) <= room) {
      spread.forEach(take);
      break;
    }
  }
  groups.filter(g => g.key !== 'still' && !phases.includes(g)).forEach(take);
  const pictures = groups.filter(g => chosen.has(g)).flatMap(g => g.items);
  return { pictures, left: images.filter(image => !pictures.includes(image)).map(image => image.label) };
}

module.exports = { AiService, AiSteering, registerAiService, choosePictures };
