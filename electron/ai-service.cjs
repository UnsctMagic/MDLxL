const fs = require('node:fs/promises');
const path = require('node:path');
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

class AiService {
  constructor({ root, profile, electron, getWindow }) {
    this.root = root;
    this.directory = path.join(profile, 'ai');
    this.electron = electron;
    this.getWindow = getWindow;
    this.pending = new Map();
    this.conversations = new Map();
    this.ready = false;
    this.config = null;
    this.active = null;
    this.external = null;
    this.running = new Set();
    this.awareness = new AiAwareness();
    this.writes = new Map();
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
      busy: !!this.active,
      awareness: this.awareness.enabled,
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
  async configure(input) {
    if (this.active) throw Error('Stop the current AI request before changing providers.');
    const config = await this.configuration();
    if (!['codex', 'claude', 'openai', 'anthropic', 'compatible'].includes(input.provider))
      throw Error('Unknown AI provider.');
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
    };
    if (input.apiKey !== undefined && input.apiKey !== '') next.key = this.encrypt(String(input.apiKey));
    if (input.clearKey) next.key = '';
    config.provider = input.provider;
    config.providers ||= {};
    config.providers[input.provider] = next;
    await this.persist();
    return this.status();
  }
  async settings() {
    const c = await this.configuration();
    return { provider: c.provider, ...c.providers?.[c.provider] };
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
      const timer = setTimeout(() => controller.abort(Error('The editor tool timed out.')), 180000);
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
            return await this.call(name, args, signal);
          } finally {
            this.emit({ type: 'external-done', busy: !!this.active });
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
    if (this.conversations.has(id)) return this.conversations.get(id);
    let value;
    try {
      value = JSON.parse(await fs.readFile(path.join(this.directory, 'chat-' + id + '.json'), 'utf8'));
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
    if (task.status === 'running' && this.active?.id !== id) {
      task.status = 'interrupted';
      await this.persistConversation(conversation);
    }
    return {
      status: task.status,
      phase: task.phase,
      steps: task.steps,
      summary: task.summary || '',
      canResume: ['interrupted', 'incomplete'].includes(task.status),
    };
  }
  async send({ id, text, images = [], context, resume = false }) {
    if (this.active) throw Error('An AI request is already running.');
    if (!resume && (typeof text !== 'string' || !text.trim() || text.length > 100000))
      throw Error('Enter a prompt of 1–100000 characters.');
    if (
      images.length > 4 ||
      images.some(image => typeof image !== 'string' || image.length > 12 * 1024 * 1024)
    )
      throw Error('Attach up to four images, each under 9 MB.');
    if (!context?.target) throw Error('Capture the model context before sending.');
    const settings = await this.settings(),
      { AI_TOOLS, AI_SYSTEM_PROMPT, aiToolEditsModel } = await this.init(),
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
    const conversation = await this.conversation(id, settings.provider),
      reply = { role: 'assistant', text: '' };
    let task;
    if (resume) {
      task = conversation.task;
      if (!task || !['running', 'interrupted', 'incomplete'].includes(task.status))
        throw Error('There is no interrupted task to resume.');
      if (task.checkpoint) {
        const current = await this.call('mdlxl_checkpoint', { target: context.target });
        if (
          current.fingerprint !== task.checkpoint.fingerprint ||
          (current.path || current.name) !== (task.checkpoint.path || task.checkpoint.name)
        )
          throw Error(
            'The model differs from this task checkpoint. Restore its model through MDLxL recovery, or send a new prompt for the current model.',
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
      };
    task.status = 'running';
    task.summary = '';
    conversation.transcript.push(
      {
        role: 'user',
        text: resume ? 'Resume task' : text,
        document: context.name,
        selection: context.selection,
      },
      reply,
    );
    const active = { id, controller };
    this.active = active;
    let responseText = '';
    const event = value => {
      if (value.type === 'text') {
        responseText += value.text;
        return;
      }
      this.emit({ id, ...value });
    };
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
    if (this.awareness.enabled) prompt += '\n\n' + awarenessText(this.awareness.snapshot());
    prompt += '\n\nMDLxL context captured when this prompt was sent:\n' + JSON.stringify(context);
    const call = async (name, args, signal) => {
      if (controller.signal.aborted) throw Error('AI request cancelled.');
      if (args.target && args.target !== context.target)
        throw Error('Use the target captured with the current prompt.');
      const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      const edit = aiToolEditsModel(name, args);
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
      } else if (name === 'mdlxl_review')
        await progress(
          args.action === 'finish' && args.outcome === 'needs-correction' ? 'correcting' : 'verifying',
        );
      try {
        const result = await this.call(
          name,
          { ...args, ...(name === 'mdlxl_help' ? {} : { target: context.target }) },
          requestSignal,
        );
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
    try {
      await progress('inspecting');
      for (let attempt = 0; attempt < 4; attempt++) {
        responseText = '';
        const options = {
          settings,
          key: this.decrypt(settings.key),
          directory: this.directory,
          event,
          tools: AI_TOOLS,
          call,
          system: AI_SYSTEM_PROMPT,
          prompt,
          images: attempt ? [] : images,
          conversation,
          signal: controller.signal,
          awareness: this.awareness,
        };
        if (settings.provider === 'codex') await runCodex(options);
        else if (settings.provider === 'claude') await runClaude(options);
        else await runApi(options);
        const review = task.steps.length
          ? await this.call('mdlxl_review', { target: context.target, action: 'status' }, controller.signal)
          : { changed: false };
        if (!review.changed && task.unresolvedEditError) throw Error(task.unresolvedEditError);
        if (!review.changed || review.phase === 'verified') {
          task.status = 'complete';
          task.phase = review.changed ? 'verified' : 'complete';
          task.summary = review.summary || '';
          delete task.baseline;
          delete task.images;
          reply.text = responseText;
          this.emit({ id, type: 'text', text: responseText });
          await this.persistConversation(conversation);
          this.emit({ id, type: 'task', task: await this.taskInfo(id) });
          event({ type: 'done' });
          return { ok: true };
        }
        if (review.phase === 'blocked')
          throw Error(review.summary || 'The edited model still needs verification.');
        await progress('verifying');
        event({ type: 'notice', text: 'Checking the result before completing the task.' });
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
      task.status = controller.signal.aborted ? 'interrupted' : 'incomplete';
      task.summary = error.message;
      if (controller.signal.aborted) {
        reply.text = 'Stopped. Applied edits remain in Undo. Resume task to continue from the checkpoint.';
        this.emit({ id, type: 'text', text: reply.text });
        event({ type: 'done' });
        return { ok: false, cancelled: true };
      }
      const authRequired = error.code === 'AI_AUTH_REQUIRED';
      reply.error = error.message;
      event({ type: 'error', text: error.message, authRequired });
      return { ok: false, error: error.message, authRequired };
    } finally {
      if (this.active === active) this.active = null;
      await this.persistConversation(conversation);
      this.emit({ id, type: 'task', task: await this.taskInfo(id) });
    }
  }
  cancel() {
    this.active?.controller.abort();
  }
  async models() {
    if (this.active) throw Error('Stop the current AI request before loading models.');
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
          return (result.data || []).map(m => ({
            id: m.model || m.id,
            name: m.displayName || m.model || m.id,
          }));
        } finally {
          await client.close();
        }
      }
      return await providerModels(settings, this.decrypt(settings.key), signal);
    } finally {
      if (this.active === active) this.active = null;
    }
  }
  async auth(action) {
    if (!['login', 'logout', 'status'].includes(action)) throw Error('Unknown sign-in action.');
    if (this.active) throw Error('Stop the current AI request before signing in or out.');
    const settings = await this.settings();
    if (!['codex', 'claude'].includes(settings.provider)) throw Error('This provider uses an API key.');
    const controller = new AbortController();
    this.active = { controller, auth: true };
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
      this.active = null;
    }
  }
  close() {
    return (this.closePromise ||= Promise.resolve().then(async () => {
      this.closing = true;
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
  handle('ai:cancel', () => service.cancel());
  handle('ai:auth', action => service.auth(action));
  handle('ai:models', () => service.models());
  handle('ai:transcript', async id => {
    const settings = await service.settings();
    return (await service.conversation(id, settings.provider)).transcript;
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
module.exports = { AiService, registerAiService };
