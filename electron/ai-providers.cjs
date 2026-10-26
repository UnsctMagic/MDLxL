const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnAgent, stopAgent, lines, providerEnvironment } = require('./ai-process.cjs');
const { startMcpServer, callEditorTool } = require('./ai-mcp.cjs');
const { awarenessText } = require('./ai-awareness.cjs');

function endpoint(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    )
  )
    throw Error('Use an HTTPS API base URL, or HTTP on localhost.');
  return url.href.replace(/\/$/, '');
}
async function requestJson(url, body, key, signal, headers = {}) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    signal,
    redirect: 'error',
    headers: {
      'content-type': 'application/json',
      ...(key ? { Authorization: 'Bearer ' + key } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    let detail;
    try {
      detail = await response.json();
    } catch {}
    throw Error(
      `AI provider returned HTTP ${response.status}: ${String(detail?.error?.message || detail?.message || response.statusText).slice(0, 1500)}`,
    );
  }
  return response;
}
async function* sseEvents(response) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = event
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n');
      if (data && data !== '[DONE]') yield JSON.parse(data);
    }
  }
}
function imageParts(images = [], kind = 'openai') {
  return images.map(image => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if (!match) throw Error('Attach PNG, JPEG or WebP images.');
    return kind === 'anthropic'
      ? { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }
      : { type: 'image_url', image_url: { url: image } };
  });
}
// Short, readable form of a tool call's input for the console's activity rows.
function toolDetail(input) {
  try {
    const text = typeof input === 'string' ? input : JSON.stringify(input, null, 1);
    return text.length > 4000 ? text.slice(0, 4000) + '…' : text;
  } catch {
    return '';
  }
}
// One prompt may take at most this many tool rounds unless the user sets a step limit.
const API_STEP_LIMIT = 64;
// Anthropic API list prices in US$ per million tokens (checked 2026-10). Cache
// writes cost 1.25x input. Unlisted models show tokens only and have no limit.
const ANTHROPIC_PRICES = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
function anthropicCost(model, spent) {
  const price = ANTHROPIC_PRICES[model];
  if (!price) return null;
  return (
    (spent.input * price.input +
      spent.cacheWrite * price.input * 1.25 +
      spent.cacheRead * price.cacheRead +
      spent.output * price.output) /
    1e6
  );
}

// Claude 4.6+ thinks adaptively; summarized display lets the console show it.
// Older and unknown models keep the provider default.
function anthropicThinking(model) {
  const match = /claude-(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(model || '');
  if (!match) return null;
  const major = Number(match[1]),
    minor = Number(match[2] || 0);
  return major > 4 || (major === 4 && minor >= 6) ? { type: 'adaptive', display: 'summarized' } : null;
}
// Claude signs its reasoning for the tool list it was written with, and refuses
// it once that list changes (an MDLxL update, SD Brain switched on or off).
// Finished turns do not need it: drop it from them, keeping the reasoning of a
// tool loop still running unless everything has to go. Returns true if changed.
function dropStaleThinking(history, everything = false) {
  const last = history.findLastIndex(m => m.role === 'assistant');
  const running = !everything && Array.isArray(history[last + 1]?.content) && history[last + 1].content.some(b => b.type === 'tool_result');
  let changed = false;
  history.forEach((message, index) => {
    if (message.role !== 'assistant' || !Array.isArray(message.content) || (running && index === last)) return;
    const content = message.content.filter(b => b.type !== 'thinking' && b.type !== 'redacted_thinking');
    if (content.length === message.content.length) return;
    message.content = content.length ? content : [{ type: 'text', text: '(reasoning omitted)' }];
    changed = true;
  });
  return changed;
}
const STALE_THINKING = /HTTP 400.*(signature|thinking)/is;
// Claude Code reports compaction as a status and ends it with a boundary marker.
// Returns true/false when compaction starts/ends, otherwise null.
function claudeCompaction(data) {
  if (data?.type !== 'system') return null;
  if (data.subtype === 'compact_boundary') return false;
  if (data.subtype === 'status') return data.status === 'compacting';
  return null;
}
function authenticationRequired() {
  return Object.assign(Error('Sign in to connect your AI. Your prompt has been kept.'), {
    code: 'AI_AUTH_REQUIRED',
  });
}
async function runApi({
  settings,
  key,
  tools,
  call,
  prompt,
  images,
  system,
  conversation,
  signal,
  event,
  awareness,
  steering,
}) {
  const anthropic = settings.provider === 'anthropic';
  const base = endpoint(
    settings.baseUrl || (anthropic ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
  );
  if (!settings.model?.trim()) throw Error('Choose a model in AI connection settings.');
  const history = conversation.messages || [];
  history.push({
    role: 'user',
    content: [{ type: 'text', text: prompt }, ...imageParts(images, anthropic ? 'anthropic' : 'openai')],
  });
  conversation.messages = history;
  // What this prompt has spent so far, shown under the reply and checked against the limit.
  const spent = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  const limit = settings.spendLimit > 0 ? settings.spendLimit : 0;
  const charge = usd => {
    event({ type: 'cost', usd, tokens: spent.input + spent.cacheWrite + spent.cacheRead + spent.output });
    if (limit && usd !== null && usd >= limit)
      throw Error(
        `Stopped at about $${usd.toFixed(2)}, the spending limit for one prompt. Progress is kept; send another prompt to continue, or raise the limit in AI connection settings.`,
      );
  };
  let awarenessVersion = awareness?.version;
  const steps = settings.stepLimit > 0 ? settings.stepLimit : API_STEP_LIMIT;
  for (let step = 0; step < steps; step++) {
    if (signal.aborted) throw Error('AI request cancelled.');
    if (awareness?.enabled && awareness.version !== awarenessVersion) {
      history.push({ role: 'user', content: [{ type: 'text', text: awarenessText(awareness.snapshot()) }] });
      awarenessVersion = awareness.version;
    }
    // Steering joins the next request, after the results of the tools just run.
    const steer = steering?.take();
    if (steer) {
      const last = history.at(-1);
      if (anthropic && last?.role === 'user' && Array.isArray(last.content))
        last.content.push({ type: 'text', text: steer });
      else history.push({ role: 'user', content: anthropic ? [{ type: 'text', text: steer }] : steer });
    }
    if (anthropic) {
      const thinking = anthropicThinking(settings.model);
      // Prompt caching: the tools/system prefix and the conversation so far are
      // billed at the cached rate on the next step instead of full price.
      const cache = { type: 'ephemeral' };
      const apiTools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
      if (apiTools.length) apiTools[apiTools.length - 1] = { ...apiTools.at(-1), cache_control: cache };
      const messages = history.slice();
      const lastMessage = messages.at(-1);
      if (lastMessage && Array.isArray(lastMessage.content) && lastMessage.content.length) {
        const blocks = lastMessage.content.slice();
        blocks[blocks.length - 1] = { ...blocks.at(-1), cache_control: cache };
        messages[messages.length - 1] = { ...lastMessage, content: blocks };
      }
      let response;
      try {
        response = await requestJson(
          base + '/messages',
          {
            model: settings.model,
            max_tokens: 16384,
            system: typeof system === 'string' && system ? [{ type: 'text', text: system, cache_control: cache }] : system,
            messages,
            ...(apiTools.length ? { tools: apiTools } : {}),
            ...(thinking ? { thinking } : {}),
            stream: true,
          },
          key,
          signal,
          { 'anthropic-version': '2023-06-01' },
        );
      } catch (error) {
        // Old reasoning refused: drop it (finished turns first, then all) and ask again.
        if (!STALE_THINKING.test(error.message) || !(dropStaleThinking(history) || dropStaleThinking(history, true))) throw error;
        step--;
        continue;
      }
      const content = [];
      let stopReason = null;
      for await (const data of sseEvents(response)) {
        if (data.type === 'error') throw Error(data.error?.message || 'Claude stream failed.');
        if (data.type === 'content_block_start') content[data.index] = { ...data.content_block, _json: '' };
        // How full the context is, for retiring Offload workers at half.
        if (data.type === 'message_start' && data.message?.usage) {
          const u = data.message.usage;
          spent.input += u.input_tokens || 0;
          spent.cacheWrite += u.cache_creation_input_tokens || 0;
          spent.cacheRead += u.cache_read_input_tokens || 0;
          event({
            type: 'usage',
            used: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
            window: anthropicThinking(settings.model) ? 1000000 : 200000,
          });
        }
        if (data.type === 'content_block_delta') {
          const block = content[data.index];
          if (!block) continue;
          if (data.delta.type === 'text_delta') {
            block.text = (block.text || '') + data.delta.text;
            event({ type: 'text', text: data.delta.text });
          }
          if (data.delta.type === 'input_json_delta') block._json += data.delta.partial_json;
          if (data.delta.type === 'thinking_delta') {
            block.thinking = (block.thinking || '') + data.delta.thinking;
            event({ type: 'thinking', text: data.delta.thinking });
          }
          if (data.delta.type === 'signature_delta')
            block.signature = (block.signature || '') + data.delta.signature;
        }
        if (data.type === 'message_delta') {
          stopReason = data.delta?.stop_reason;
          // output_tokens here is the reply's final total.
          if (data.usage?.output_tokens) spent.output += data.usage.output_tokens;
        }
      }
      if (!stopReason) throw Error('The provider stream ended before completion.');
      charge(anthropicCost(settings.model, spent));
      for (const block of content) {
        if (block.type === 'tool_use' && block._json) block.input = JSON.parse(block._json);
        delete block._json;
      }
      history.push({ role: 'assistant', content });
      const calls = content.filter(b => b.type === 'tool_use');
      if (!calls.length) {
        if (stopReason === 'max_tokens')
          throw Error('The provider reached its output limit. Continue the conversation to finish.');
        return;
      }
      const results = [];
      for (const block of calls) {
        event({ type: 'tool', name: block.name, callId: block.id, detail: toolDetail(block.input) });
        let result;
        try {
          result = await callEditorTool(tools, call, block.name, block.input, signal, awareness);
        } catch (error) {
          result = { isError: true, content: [{ type: 'text', text: error.message }] };
        }
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          is_error: !!result.isError,
          content: result.content.map(c =>
            c.type === 'image'
              ? { type: 'image', source: { type: 'base64', media_type: c.mimeType, data: c.data } }
              : c,
          ),
        });
        event({
          type: 'tool-result',
          name: block.name,
          callId: block.id,
          error: !!result.isError,
          summary: result.content.find(c => c.type === 'text')?.text?.slice(0, 300),
        });
      }
      history.push({ role: 'user', content: results });
    } else {
      const response = await requestJson(
        base + '/chat/completions',
        {
          model: settings.model,
          messages: [{ role: 'system', content: system }, ...history],
          ...(tools.length
            ? {
                tools: tools.map(t => ({
                  type: 'function',
                  function: { name: t.name, description: t.description, parameters: t.inputSchema },
                })),
              }
            : {}),
          ...(settings.provider === 'openai' ? { stream_options: { include_usage: true } } : {}),
          stream: true,
        },
        key,
        signal,
      );
      const calls = new Map();
      let text = '',
        finishReason;
      for await (const data of sseEvents(response)) {
        if (data.error) throw Error(data.error.message || 'AI stream failed.');
        if (data.usage?.prompt_tokens) {
          event({ type: 'usage', used: data.usage.prompt_tokens, window: 128000 });
          spent.input += data.usage.prompt_tokens;
          spent.output += data.usage.completion_tokens || 0;
          charge(null);
        }
        const choice = data.choices?.[0];
        if (!choice) continue;
        finishReason = choice.finish_reason || finishReason;
        // Reasoning models behind compatible servers stream their thinking here.
        const reasoning = choice.delta?.reasoning_content ?? choice.delta?.reasoning;
        if (typeof reasoning === 'string' && reasoning) event({ type: 'thinking', text: reasoning });
        if (choice.delta?.content) {
          text += choice.delta.content;
          event({ type: 'text', text: choice.delta.content });
        }
        for (const delta of choice.delta?.tool_calls || []) {
          let call = calls.get(delta.index);
          if (!call) {
            call = { id: '', type: 'function', function: { name: '', arguments: '' } };
            calls.set(delta.index, call);
          }
          if (delta.id) call.id = delta.id;
          if (delta.function?.name) call.function.name += delta.function.name;
          if (delta.function?.arguments) call.function.arguments += delta.function.arguments;
        }
      }
      if (!finishReason) throw Error('The provider stream ended before completion.');
      const toolCalls = [...calls.values()];
      history.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      if (!toolCalls.length) {
        if (finishReason === 'length')
          throw Error('The provider reached its output limit. Continue the conversation to finish.');
        return;
      }
      const imageMessages = [];
      for (const toolCall of toolCalls) {
        event({
          type: 'tool',
          name: toolCall.function.name,
          callId: toolCall.id,
          detail: toolDetail(toolCall.function.arguments),
        });
        let result;
        try {
          result = await callEditorTool(
            tools,
            call,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            signal,
            awareness,
          );
        } catch (error) {
          result = { isError: true, content: [{ type: 'text', text: error.message }] };
        }
        const textContent = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        history.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: textContent || 'Viewport image follows.',
        });
        for (const image of result.content.filter(c => c.type === 'image'))
          imageMessages.push({
            type: 'image_url',
            image_url: { url: `data:${image.mimeType};base64,${image.data}` },
          });
        event({
          type: 'tool-result',
          name: toolCall.function.name,
          callId: toolCall.id,
          error: !!result.isError,
          summary: textContent.slice(0, 300),
        });
      }
      if (imageMessages.length)
        history.push({
          role: 'user',
          content: [{ type: 'text', text: 'Requested MDLxL viewport captures:' }, ...imageMessages],
        });
    }
  }
  throw Error(`The AI used ${steps} tool rounds. Progress is retained; send another prompt to continue.`);
}

class CodexProcess {
  constructor(settings, { directory, event = () => {}, mcp, signal } = {}) {
    this.settings = settings;
    this.directory = directory;
    this.event = event;
    this.mcp = mcp;
    this.signal = signal;
    this.pending = new Map();
    this.nextId = 1;
  }
  async start() {
    await fs.mkdir(this.directory, { recursive: true });
    const args = ['app-server', '-c', 'features.shell_tool=false', '-c', 'web_search="disabled"'];
    const env = providerEnvironment(this.directory, 'codex');
    await fs.mkdir(env.TEMP, { recursive: true });
    await fs.mkdir(env.CODEX_HOME, { recursive: true });
    if (this.mcp) {
      env.MDLXL_AI_TOKEN = this.mcp.token;
      args.push(
        '-c',
        `mcp_servers.mdlxl.url=${JSON.stringify(this.mcp.url)}`,
        '-c',
        'mcp_servers.mdlxl.bearer_token_env_var="MDLXL_AI_TOKEN"',
        '-c',
        'mcp_servers.mdlxl.required=true',
        '-c',
        'mcp_servers.mdlxl.tool_timeout_sec=3600',
      );
      // Sending a prompt authorizes MDLxL's own editor tools, as in the Claude
      // allowlist. This is private to this child; shell/filesystem access stays restricted.
      for (const name of this.mcp.toolNames || [])
        args.push('-c', `mcp_servers.mdlxl.tools.${name}.approval_mode="approve"`);
    }
    this.child = spawnAgent(this.settings.executable || 'codex', args, { cwd: this.directory, env });
    this.exited = new Promise(resolve => this.child.once('close', resolve));
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', (code, signal) => this.fail(Error(`Codex process exited (${code ?? signal}).`)));
    this.child.stdin.on('error', error => this.fail(error));
    lines(
      this.child.stdout,
      line => {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          return;
        }
        this.receive(message);
      },
      error => this.fail(error),
    );
    this.child.stderr.on('data', () => {});
    this.abort = () => {
      this.fail(Error('AI request cancelled.'));
      this.close();
    };
    this.signal?.addEventListener('abort', this.abort, { once: true });
    if (this.signal?.aborted) {
      this.abort();
      throw Error('AI request cancelled.');
    }
    await this.request('initialize', { clientInfo: { name: 'mdlxl', title: 'MDLxL', version: '1.0.0' } });
    this.write({ method: 'initialized', params: {} });
    return this;
  }
  write(value) {
    this.child.stdin.write(JSON.stringify(value) + '\n');
  }
  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error('Codex request timed out: ' + method));
      }, 60000);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ id, method, params });
    });
  }
  receive(message) {
    if (message.id !== undefined && message.method) {
      // The editor grants model tools, not terminal or arbitrary filesystem access.
      const decision = message.method.includes('requestApproval') ? { decision: 'decline' } : null;
      this.write(
        decision
          ? { id: message.id, result: decision }
          : {
              id: message.id,
              error: {
                code: -32601,
                message: 'Ask the user in the conversation; this client supports MDLxL tools.',
              },
            },
      );
      this.event({
        type: 'notice',
        text: 'Codex requested an operation outside the editor tools: ' + message.method,
      });
      return;
    }
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      message.error ? pending.reject(Error(message.error.message)) : pending.resolve(message.result);
      return;
    }
    const p = message.params || {};
    if (message.method === 'item/agentMessage/delta') {
      if (p.itemId && this.messageId && p.itemId !== this.messageId)
        this.event({ type: 'text', text: '\n\n' });
      this.messageId = p.itemId || this.messageId;
      this.event({ type: 'text', text: p.delta });
    }
    if (message.method === 'thread/tokenUsage/updated') {
      const usage = p.tokenUsage || p.usage || {},
        last = usage.last || usage.total || {};
      const used = last.inputTokens ?? last.totalTokens;
      if (used && usage.modelContextWindow) this.event({ type: 'usage', used, window: usage.modelContextWindow });
    }
    if (message.method === 'item/reasoning/summaryTextDelta' || message.method === 'item/reasoning/textDelta') {
      if (p.itemId && this.reasoningId && p.itemId !== this.reasoningId)
        this.event({ type: 'thinking', text: '\n\n' });
      this.reasoningId = p.itemId || this.reasoningId;
      this.event({ type: 'thinking', text: p.delta });
    }
    // A full conversation is summarized before the turn can go on; it shows no output meanwhile.
    if ((message.method === 'item/started' || message.method === 'item/completed') && /compaction/i.test(p.item?.type || ''))
      this.event({ type: 'compaction', active: message.method === 'item/started' });
    if (message.method === 'thread/compacted') this.event({ type: 'compaction', active: false });
    if (message.method === 'item/started' && p.item?.type === 'mcpToolCall')
      this.event({ type: 'tool', name: p.item.tool, callId: p.item.id, detail: toolDetail(p.item.arguments) });
    if (message.method === 'item/completed' && p.item?.type === 'mcpToolCall')
      this.event({
        type: 'tool-result',
        name: p.item.tool,
        callId: p.item.id,
        error: p.item.status === 'failed',
        summary: (p.item.error?.message || p.item.result?.content?.find(c => c.type === 'text')?.text)?.slice(0, 300),
      });
    if (message.method === 'account/login/completed') this.login?.(p);
    if (message.method === 'turn/completed') this.turn?.(p.turn);
    if (message.method === 'error')
      this.event({ type: 'notice', text: p.error?.message || 'Codex reported an error.' });
  }
  fail(error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
    this.turnError?.(error);
    this.loginError?.(error);
  }
  async account() {
    return this.request('account/read', { refreshToken: true });
  }
  async close() {
    this.signal?.removeEventListener('abort', this.abort);
    stopAgent(this.child);
    if (this.exited)
      await Promise.race([this.exited, new Promise(resolve => setTimeout(resolve, 5000).unref())]);
  }
}
async function runCodex(options) {
  const {
    settings,
    directory,
    event,
    tools,
    call,
    system,
    prompt,
    images,
    conversation,
    signal,
    awareness,
    steering,
  } = options;
  const mcp = await startMcpServer({ tools, call, awareness });
  const client = new CodexProcess(settings, { directory, event, mcp, signal });
  let unsubscribe,
    unsteer,
    turnId,
    delivery = Promise.resolve(),
    updates = Promise.resolve(),
    pendingContext,
    delivering = false;
  try {
    await client.start();
    const account = await client.account();
    if (!account.account && account.requiresOpenaiAuth !== false) throw authenticationRequired();
    const params = {
      cwd: directory,
      approvalPolicy: 'never',
      sandbox: 'read-only',
      ...(settings.model ? { model: settings.model } : {}),
      developerInstructions: system,
    };
    const result = conversation.threadId
      ? await client.request('thread/resume', { ...params, threadId: conversation.threadId })
      : await client.request('thread/start', params);
    conversation.threadId = result.thread.id;
    unsubscribe = awareness?.subscribe(value => {
      if (signal.aborted) return;
      pendingContext = value;
      if (delivering) return;
      delivering = true;
      updates = (async () => {
        while (pendingContext && !signal.aborted) {
          const latest = pendingContext;
          pendingContext = null;
          await client.request('thread/inject_items', {
            threadId: conversation.threadId,
            items: [
              {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: awarenessText(latest) }],
              },
            ],
          });
          event({ type: 'awareness-delivered', version: latest.version });
        }
      })()
        .catch(error => event({ type: 'notice', text: 'Live context delivery failed: ' + error.message }))
        .finally(() => {
          delivering = false;
        });
    });
    const completed = new Promise((resolve, reject) => {
      client.turn = turn =>
        turn.status === 'completed'
          ? resolve()
          : reject(Error(turn.error?.message || 'Codex turn ' + turn.status));
      client.turnError = reject;
    });
    // Install the completion listener first: short turns can finish before turn/start replies.
    completed.catch(() => {});
    // Steering goes into the running turn; older Codex builds take it as a thread item.
    const steer = () => {
      delivery = delivery.then(async () => {
        const message = turnId && !signal.aborted ? steering.take() : null;
        if (!message) return;
        const input = [{ type: 'text', text: message }];
        try {
          await client.request('turn/steer', { threadId: conversation.threadId, expectedTurnId: turnId, input });
        } catch {
          try {
            await client.request('thread/inject_items', {
              threadId: conversation.threadId,
              items: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: message }] }],
            });
          } catch {
            steering.restore(message);
          }
        }
      });
    };
    unsteer = steering?.subscribe(steer);
    const started = await client.request('turn/start', {
      threadId: conversation.threadId,
      input: [{ type: 'text', text: prompt }, ...(images || []).map(url => ({ type: 'image', url }))],
    });
    turnId = started?.turn?.id;
    if (steering) steer();
    await completed;
  } finally {
    unsubscribe?.();
    unsteer?.();
    await delivery;
    await updates;
    await client.close();
    await mcp.close();
  }
}
async function runClaude({
  settings,
  directory,
  event,
  tools,
  call,
  system,
  prompt,
  images,
  conversation,
  signal,
  awareness,
  steering,
}) {
  await fs.mkdir(directory, { recursive: true });
  const mcp = await startMcpServer({ tools, call, awareness });
  const runDirectory = await fs.mkdtemp(path.join(directory, 'claude-run-'));
  let child;
  try {
    const config = path.join(runDirectory, 'mcp.json'),
      instructions = path.join(runDirectory, 'instructions.txt');
    await fs.writeFile(config, JSON.stringify(mcp.config), { mode: 0o600 });
    await fs.writeFile(instructions, system);
    const args = [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--tools',
      '',
      '--allowedTools',
      'mcp__mdlxl__*',
      '--strict-mcp-config',
      '--mcp-config',
      config,
      '--setting-sources',
      '',
      '--system-prompt-file',
      instructions,
    ];
    if (settings.model) args.push('--model', settings.model);
    if (settings.stepLimit > 0) args.push('--max-turns', String(settings.stepLimit));
    if (conversation.threadId) args.push('--resume', conversation.threadId);
    const env = providerEnvironment(directory, 'claude');
    // Worker jobs and pauses outlast Claude Code's default MCP tool timeout.
    env.MCP_TOOL_TIMEOUT = '3600000';
    await fs.mkdir(env.TEMP, { recursive: true });
    await fs.mkdir(env.CLAUDE_CONFIG_DIR, { recursive: true });
    child = spawnAgent(settings.executable || 'claude', args, { cwd: directory, env });
    let finalResult = null,
      streamed = false,
      newMessage = false,
      inputOpen = true,
      written = 1,
      results = 0,
      idle,
      unsteer;
    const toolNames = new Map();
    let used = 0;
    const abort = () => stopAgent(child);
    signal.addEventListener('abort', abort, { once: true });
    const writeUser = content =>
      child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
    // Input stays open while the user may steer; it closes once every message
    // has a result, or after a quiet spell if Claude folded steering into a turn.
    const endInput = () => {
      clearTimeout(idle);
      if (!inputOpen) return;
      inputOpen = false;
      unsteer?.();
      child.stdin.end();
    };
    const steer = () => {
      if (!inputOpen) return;
      const message = steering.take();
      if (!message) return;
      clearTimeout(idle);
      written++;
      writeUser([{ type: 'text', text: message }]);
    };
    try {
      await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.once('close', code =>
          signal.aborted
            ? reject(Error('AI request cancelled.'))
            : !finalResult || finalResult.is_error || code !== 0
              ? reject(
                  Error(
                    finalResult?.result ||
                      finalResult?.errors?.join('\n') ||
                      'Claude ended without a completed result.',
                  ),
                )
              : resolve(),
        );
        child.stdin.on('error', reject);
        lines(
          child.stdout,
          line => {
            let data;
            try {
              data = JSON.parse(line);
            } catch {
              return;
            }
            if (data.session_id) conversation.threadId = data.session_id;
            if (data.type !== 'result') clearTimeout(idle);
            const compacting = claudeCompaction(data);
            if (compacting !== null) event({ type: 'compaction', active: compacting });
            if (data.type === 'stream_event' && data.event?.type === 'message_start') newMessage = true;
            if (data.type === 'stream_event' && data.event?.type === 'content_block_delta') {
              const delta = data.event.delta;
              if (delta?.type === 'thinking_delta' && delta.thinking)
                event({ type: 'thinking', text: delta.thinking });
              if (delta?.text) {
                if (newMessage && streamed) event({ type: 'text', text: '\n\n' });
                newMessage = false;
                streamed = true;
                event({ type: 'text', text: delta.text });
              }
            }
            if (data.type === 'assistant' && data.message?.usage) {
              const u = data.message.usage;
              used = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
            }
            if (data.type === 'assistant')
              for (const block of data.message?.content || [])
                if (block.type === 'tool_use') {
                  toolNames.set(block.id, block.name);
                  event({ type: 'tool', name: block.name, callId: block.id, detail: toolDetail(block.input) });
                }
            if (data.type === 'user' && Array.isArray(data.message?.content))
              for (const block of data.message.content)
                if (block.type === 'tool_result') {
                  const text = Array.isArray(block.content)
                    ? block.content.find(c => c.type === 'text')?.text
                    : block.content;
                  event({
                    type: 'tool-result',
                    name: toolNames.get(block.tool_use_id),
                    callId: block.tool_use_id,
                    error: !!block.is_error,
                    summary: typeof text === 'string' ? text.slice(0, 300) : undefined,
                  });
                }
            if (data.type === 'result') {
              finalResult = data;
              const window = Object.values(data.modelUsage || {})[0]?.contextWindow || 200000;
              if (used) event({ type: 'usage', used, window });
              if (!streamed && data.result) event({ type: 'text', text: data.result });
              results++;
              clearTimeout(idle);
              if (results >= written) endInput();
              else idle = setTimeout(endInput, 8000);
            }
          },
          reject,
        );
        child.stderr.on('data', () => {});
        if (signal.aborted) {
          abort();
          return;
        }
        writeUser([{ type: 'text', text: prompt }, ...imageParts(images, 'anthropic')]);
        if (steering) unsteer = steering.subscribe(steer);
        else endInput();
      });
    } finally {
      clearTimeout(idle);
      unsteer?.();
      signal.removeEventListener('abort', abort);
    }
  } finally {
    stopAgent(child);
    await mcp.close();
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
}
async function providerModels(settings, key, signal) {
  // Claude Code takes these aliases for the newest model of each kind.
  if (settings.provider === 'claude')
    return [
      { id: 'opus', name: 'Opus (newest)' },
      { id: 'sonnet', name: 'Sonnet (newest, cheaper)' },
      { id: 'haiku', name: 'Haiku (newest, cheapest)' },
      { id: 'fable', name: 'Fable (newest, most capable)' },
    ];
  if (settings.provider === 'codex') return [];
  const anthropic = settings.provider === 'anthropic',
    base = endpoint(
      settings.baseUrl || (anthropic ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
    );
  const response = await requestJson(
    base + '/models',
    null,
    key,
    signal,
    anthropic ? { 'anthropic-version': '2023-06-01' } : {},
  );
  const data = await response.json();
  return (data.data || data.models || []).map(item => ({
    id: item.id || item.name,
    name: item.display_name || item.id || item.name,
  }));
}
module.exports = {
  anthropicCost,
  anthropicThinking,
  claudeCompaction,
  endpoint,
  sseEvents,
  runApi,
  runCodex,
  runClaude,
  providerModels,
  CodexProcess,
  authenticationRequired,
};
