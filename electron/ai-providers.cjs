const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnAgent, stopAgent, lines, prepareEnvironment } = require('./ai-process.cjs');
const { startMcpServer, callEditorTool, IMAGE_DATA_URL } = require('./ai-mcp.cjs');
const { awarenessText } = require('./ai-awareness.cjs');
const { mcpForm, codexQuestions, claudeQuestions, questionCancelled } = require('./ai-user-input.cjs');
// The connections in settings order, with what each one supports: native (a
// signed-in CLI), apiKey, baseUrl (own server address), effort, spendLimit,
// stepLimit, web (has its own web tools) and the logFolders cleanup sweeps.
const PROVIDERS = require('../src/ai-providers.json');
const providerInfo = id => PROVIDERS.find(p => p.id === id);

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
// The connection's API address: its own server, or Anthropic's or OpenAI's.
function apiBase(settings) {
  return endpoint(
    settings.baseUrl || (settings.provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
  );
}
const ANTHROPIC_HEADERS = Object.freeze({ 'anthropic-version': '2023-06-01' });
// Worker jobs and pauses outlast the CLIs' default MCP tool timeouts.
const MCP_TOOL_TIMEOUT_MS = 3600000;
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
    const message = String(detail?.error?.message || detail?.message || response.statusText).slice(0, 1500);
    // A restricted OpenAI key lacks a permission; say which switch to turn on.
    const scope = /Missing scopes?: *(\w+(?:\.\w+)*)/i.exec(message)?.[1],
      hint = scope && new URL(url).hostname === 'api.openai.com'
        ? key?.startsWith('sk-admin-')
          ? ' This is an OpenAI Admin key (sk-admin-…), which can only manage your organization and cannot run models. On platform.openai.com/api-keys, create a normal secret key (sk-proj-…) and paste that instead.'
          : ` Your API key is not allowed to do this (missing "${scope}"). On platform.openai.com/api-keys, edit the key, set Permissions to All, save, and try again. If it still fails, your role in that OpenAI project may be Reader; ask the owner to make you Member.`
        : '';
    throw Error(`AI provider returned HTTP ${response.status}: ${message}${hint}`);
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
// An image ({ mimeType, data }) in the provider's own shape: 'anthropic', 'openai' or 'codex'.
function providerImage({ mimeType, data }, kind) {
  if (kind === 'anthropic') return { type: 'image', source: { type: 'base64', media_type: mimeType, data } };
  const url = 'data:' + mimeType + ';base64,' + data;
  return kind === 'codex' ? { type: 'inputImage', imageUrl: url } : { type: 'image_url', image_url: { url } };
}
// Attached images must be plain base64 (no whitespace), stricter than tool captures.
function imageParts(images = [], kind = 'openai') {
  return images.map(image => {
    const match = IMAGE_DATA_URL.exec(image);
    if (!match || !/^[A-Za-z0-9+/=]+$/.test(match[2])) throw Error('Attach PNG, JPEG or WebP images.');
    return providerImage({ mimeType: match[1], data: match[2] }, kind);
  });
}
// A tool call's display copy, not the arguments passed to the tool. Preserve
// valid JSON when shortening strings or replacing trailing entries with a count.
const DETAIL_LIMIT = 4000;
function toolDetail(input) {
  try {
    let value = input, json = typeof input !== 'string';
    if (typeof input === 'string')
      try {
        value = JSON.parse(input); json = true;
      } catch {
        value = null;
      }
    const named = value && typeof value === 'object' ? value.label || value.id || value.action || value.query || value.name : '',
      line = typeof named === 'string' ? named.slice(0, 200) : '';
    let text = typeof input === 'string' ? input : JSON.stringify(input, null, 1);
    for (let cap = 1000; text.length > DETAIL_LIMIT && json && cap >= 60; cap = Math.floor(cap / 2))
      text = JSON.stringify(value, (key, item) => (typeof item === 'string' && item.length > cap ? item.slice(0, cap) + '…' : item), 1);
    if (text.length > DETAIL_LIMIT && json) {
      const preview = JSON.parse(text), omitted = new WeakMap();
      const trimList = node => {
        if (!node || typeof node !== 'object') return false;
        if (!Array.isArray(node)) return Object.values(node).some(trimList);
        const previous = omitted.get(node) || 0, count = node.length - (previous ? 1 : 0);
        if (!count) return false;
        const keep = Math.floor(count / 2), dropped = previous + count - keep;
        node.splice(keep, node.length - keep, `+${dropped} more`);
        omitted.set(node, dropped);
        return true;
      };
      while (text.length > DETAIL_LIMIT && trimList(preview)) text = JSON.stringify(preview, null, 1);
      // Records without lists can also exceed the display budget. Keep their
      // leading fields rather than cutting a key or value in half.
      const entries = Object.entries(preview);
      for (let keep = Math.floor(entries.length / 2); text.length > DETAIL_LIMIT; keep = Math.floor(keep / 2))
        text = JSON.stringify({ ...Object.fromEntries(entries.slice(0, keep)), [`+${entries.length - keep} more`]: true }, null, 1);
    }
    if (text.length > DETAIL_LIMIT && !json) text = text.slice(0, DETAIL_LIMIT) + '…';
    return line ? { detail: text, line } : { detail: text };
  } catch {
    return { detail: '' };
  }
}
// The start of a tool result's text for its activity row.
function toolSummary(text) {
  return typeof text === 'string' ? text.slice(0, 300) : undefined;
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
// The connection's thinking effort, or null to leave it to the provider.
// Claude 4.6 and OpenAI stop at high; the others also take xhigh.
function effortFor(settings) {
  const effort = settings.effort;
  if (!effort || effort === 'default') return null;
  const capped = effort === 'xhigh' && (/claude-(?:opus|sonnet)-4-6/.test(settings.model || '') || settings.provider === 'openai');
  return capped ? 'high' : effort;
}

// Anthropic's own web search and page reading. The dynamic-filtering versions need
// Opus or Sonnet 4.6 or later; other models get the basic versions.
function anthropicWebTools(model) {
  const match = /claude-(opus|sonnet)-(\d+)(?:-(\d{1,2})(?!\d))?/.exec(model || '');
  const major = Number(match?.[2]),
    minor = Number(match?.[3] || 0);
  const dynamic = !!match && (major > 4 || (major === 4 && minor >= 6));
  return [
    { type: dynamic ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search' },
    { type: dynamic ? 'web_fetch_20260209' : 'web_fetch_20250910', name: 'web_fetch' },
  ];
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
const CANCELLED = 'AI request cancelled.';
// Said when a provider asks for anything beyond MDLxL's own editor tools.
const TOOLS_ONLY = 'Terminal and filesystem access remain disabled.';
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
  web,
}) {
  const anthropic = settings.provider === 'anthropic';
  const base = apiBase(settings);
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
    if (signal.aborted) throw Error(CANCELLED);
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
      if (web) apiTools.push(...anthropicWebTools(settings.model));
      const messages = history.slice();
      const lastMessage = messages.at(-1);
      // A paused web search resumes from its own assistant turn, which stays as sent.
      if (lastMessage?.role === 'user' && Array.isArray(lastMessage.content) && lastMessage.content.length) {
        const blocks = lastMessage.content.slice();
        blocks[blocks.length - 1] = { ...blocks.at(-1), cache_control: cache };
        messages[messages.length - 1] = { ...lastMessage, content: blocks };
      }
      let response;
      try {
        event({ type: 'request', model: settings.model });
        response = await requestJson(
          base + '/messages',
          {
            model: settings.model,
            // Models that think adaptively get room to think and answer; older ones keep their limit.
            max_tokens: thinking ? 64000 : 16384,
            system: typeof system === 'string' && system ? [{ type: 'text', text: system, cache_control: cache }] : system,
            messages,
            ...(apiTools.length ? { tools: apiTools } : {}),
            ...(thinking ? { thinking } : {}),
            ...(thinking && effortFor(settings) ? { output_config: { effort: effortFor(settings) } } : {}),
            stream: true,
          },
          key,
          signal,
          ANTHROPIC_HEADERS,
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
          if (data.delta.type === 'citations_delta') (block.citations ||= []).push(data.delta.citation);
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
        if ((block.type === 'tool_use' || block.type === 'server_tool_use') && block._json) block.input = JSON.parse(block._json);
        delete block._json;
        // Web searches and page reads ran at Anthropic; show them as steps.
        if (block.type === 'server_tool_use')
          event({ type: 'tool', name: block.name, callId: block.id, ...toolDetail(block.input) });
        if (/^web_(search|fetch)_tool_result$/.test(block.type))
          event({
            type: 'tool-result',
            name: block.type.replace('_tool_result', ''),
            callId: block.tool_use_id,
            error: !Array.isArray(block.content) && !!block.content?.error_code,
            summary: block.content?.error_code || '',
          });
      }
      history.push({ role: 'assistant', content });
      const calls = content.filter(b => b.type === 'tool_use');
      // A long web search can pause the turn; sending it back lets it continue.
      if (!calls.length && stopReason === 'pause_turn') continue;
      if (!calls.length) {
        if (stopReason === 'max_tokens')
          throw Error('The provider reached its output limit. Continue the conversation to finish.');
        return;
      }
      const results = [];
      for (const block of calls) {
        event({ type: 'tool', name: block.name, callId: block.id, ...toolDetail(block.input) });
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
          content: result.content.map(c => (c.type === 'image' ? providerImage(c, 'anthropic') : c)),
        });
        event({
          type: 'tool-result',
          name: block.name,
          callId: block.id,
          error: !!result.isError,
          summary: toolSummary(result.content.find(c => c.type === 'text')?.text),
        });
      }
      history.push({ role: 'user', content: results });
    } else {
      event({ type: 'request', model: settings.model });
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
          // Only OpenAI's reasoning models take an effort; others would refuse the request.
          ...(settings.provider === 'openai' && /^(?:o\d|gpt-[5-9])/.test(settings.model) && effortFor(settings) ? { reasoning_effort: effortFor(settings) } : {}),
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
          ...toolDetail(toolCall.function.arguments),
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
          imageMessages.push(providerImage(image, 'openai'));
        event({
          type: 'tool-result',
          name: toolCall.function.name,
          callId: toolCall.id,
          error: !!result.isError,
          summary: toolSummary(textContent),
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
  constructor(settings, { directory, event = () => {}, mcp, signal, web = false, askUser } = {}) {
    this.settings = settings;
    this.askUser = askUser;
    this.questions = new AbortController();
    this.interactions = new Map();
    this.interactionWork = new Set();
    this.rateLimits = new Map();
    this.directory = directory;
    this.web = web;
    this.event = event;
    this.mcp = mcp;
    this.signal = signal;
    this.pending = new Map();
    this.nextId = 1;
  }
  async start() {
    await fs.mkdir(this.directory, { recursive: true });
    const args = ['app-server', '-c', 'features.shell_tool=false', '-c', `web_search="${this.web ? 'live' : 'disabled'}"`];
    if (effortFor(this.settings)) args.push('-c', `model_reasoning_effort="${effortFor(this.settings)}"`);
    const env = await prepareEnvironment(this.directory, 'codex');
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
        `mcp_servers.mdlxl.tool_timeout_sec=${MCP_TOOL_TIMEOUT_MS / 1000}`,
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
      this.fail(Error(CANCELLED));
      this.close();
    };
    this.signal?.addEventListener('abort', this.abort, { once: true });
    if (this.signal?.aborted) {
      this.abort();
      throw Error(CANCELLED);
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
      if (message.method === 'mcpServer/elicitation/request' && ['mcp_tool_call', 'tool_suggestion'].includes(message.params?._meta?.codex_approval_kind)) {
        this.write({ id: message.id, result: { action: 'decline' } });
        this.notice('Additional tool approval was declined. Only registered MDLxL editor tools are enabled.', '', 'warning');
        return;
      }
      if (['item/tool/requestUserInput', 'mcpServer/elicitation/request'].includes(message.method)) {
        this.interact(message);
        return;
      }
      const method = message.method;
      if (method === 'item/permissions/requestApproval') this.write({ id: message.id, result: { permissions: {}, scope: 'turn' } });
      else if (['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(method)) this.write({ id: message.id, result: { decision: 'decline' } });
      else if (['applyPatchApproval', 'execCommandApproval'].includes(method)) this.write({ id: message.id, result: { decision: { denied: { rejection: 'Terminal and filesystem access are disabled in MDLxL.' } } } });
      else if (method === 'item/tool/call') {
        const p = message.params || {};
        const tool = this.tools?.find(t => t.name === p.tool && (!p.namespace || p.namespace === 'mdlxl'));
        if (!tool) this.notice('Provider requested an unregistered tool: ' + p.tool, TOOLS_ONLY, 'warning');
        const run = tool ? callEditorTool(this.tools, this.call, p.tool, p.arguments, this.signal) : Promise.resolve({ isError: true, content: [{ type: 'text', text: 'Only registered MDLxL editor tools are available. Terminal and filesystem access are disabled.' }] });
        run.then(result => { if (!this.questions.signal.aborted) this.write({ id: message.id, result: { success: !result.isError, contentItems: result.content.map(c => c.type === 'text' ? { type: 'inputText', text: c.text } : providerImage(c, 'codex')) } }); }, error => this.write({ id: message.id, error: { code: -32602, message: error.message } }));
        return;
      } else {
        const text = method === 'account/chatgptAuthTokens/refresh'
          ? 'This connection uses Codex-managed sign-in. Sign in again in Connection settings; externally managed tokens are not configured.'
          : method === 'attestation/generate'
            ? 'The provider requested client attestation, which this MDLxL connection cannot generate. Reconnect with a provider that supports this connection.'
            : 'Unsupported provider request: ' + method;
        this.write({ id: message.id, error: { code: method === 'account/chatgptAuthTokens/refresh' ? -32001 : method === 'attestation/generate' ? -32002 : -32601, message: text } });
        this.notice(text);
        if (method === 'account/chatgptAuthTokens/refresh') this.event({ type: 'error', text, authRequired: true });
        return;
      }
      this.notice(TOOLS_ONLY + ' The provider request was declined.', method);
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
    if (message.method === 'serverRequest/resolved')
      this.interactions.get(p.requestId)?.controller.abort(questionCancelled('The provider cancelled or resolved this question. Reply in chat if you still need to clarify the request.'));
    if (message.method === 'turn/completed') {
      for (const pending of this.interactions.values())
        if (!p.turn?.id || pending.turnId === p.turn.id)
          pending.controller.abort(questionCancelled('The AI turn ended before this question was answered. Reply in chat to continue.'));
    }
    if (['warning', 'guardianWarning', 'configWarning', 'deprecationNotice', 'windows/worldWritableWarning'].includes(message.method))
      this.notice(p.message || p.summary || 'Provider warning', p.details || '', 'warning');
    if (message.method === 'mcpServer/startupStatus/updated' && (p.error || ['failed', 'cancelled'].includes(p.status)))
      this.notice('Tool server ' + p.name + ': ' + p.status, p.error || p.failureReason || '', 'warning');
    if (message.method === 'model/rerouted') this.notice('Provider switched from ' + p.fromModel + ' to ' + p.toModel + '.', p.reason || '');
    if (message.method === 'account/rateLimits/updated') {
      const update = p.rateLimits || {}, key = update.limitId || 'default';
      const previous = this.rateLimits.get(key) || {};
      const value = { ...previous, ...Object.fromEntries(Object.entries(update).filter(([, v]) => v != null)) };
      const details = ['primary', 'secondary'].filter(k => value[k]?.usedPercent != null).map(k => k + ': ' + value[k].usedPercent + '% used' + (value[k].resetsAt ? ', resets ' + new Date(value[k].resetsAt * 1000).toISOString() : '')).join('; ');
      if (JSON.stringify(value) !== JSON.stringify(previous)) this.notice('Provider usage limits' + (value.limitName ? ': ' + value.limitName : ''), details || 'Usage values are unavailable.', ['primary', 'secondary'].some(k => value[k]?.usedPercent >= 100) || value.spendControlReached ? 'warning' : 'info');
      this.rateLimits.set(key, value);
    }
    if (message.method === 'turn/plan/updated') this.notice('AI plan updated', [p.explanation, ...(p.plan || []).map(step => step.status + ': ' + step.step)].filter(Boolean).join('\n'));
    if (message.method === 'item/mcpToolCall/progress' && p.message) this.notice('Tool progress', p.message);
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
      if (usage.total?.totalTokens != null) this.event({ type: 'cost', tokens: usage.total.totalTokens, usd: null });
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
      this.event({ type: 'tool', name: p.item.tool, callId: p.item.id, ...toolDetail(p.item.arguments) });
    if (message.method === 'item/completed' && p.item?.type === 'mcpToolCall')
      this.event({
        type: 'tool-result',
        name: p.item.tool,
        callId: p.item.id,
        error: p.item.status === 'failed',
        summary: toolSummary(p.item.error?.message || p.item.result?.content?.find(c => c.type === 'text')?.text),
      });
    // Web research runs inside Codex; its searches show as steps.
    if (message.method === 'item/started' && p.item?.type === 'webSearch')
      this.event({ type: 'tool', name: 'web_search', callId: p.item.id, ...toolDetail(p.item.query || '') });
    if (message.method === 'item/completed' && p.item?.type === 'webSearch')
      this.event({ type: 'tool-result', name: 'web_search', callId: p.item.id, error: false, summary: p.item.query || '' });
    if (message.method === 'account/login/completed') this.login?.(p);
    if (message.method === 'turn/completed') this.turn?.(p.turn);
    if (message.method === 'error')
      this.notice(p.error?.message || 'Codex reported an error.', p.willRetry ? 'The provider will retry this request.' : '', 'warning');
  }
  notice(text, detail = '', severity = 'info') {
    this.event({ type: 'provider-notice', text, detail: typeof detail === 'string' ? detail : JSON.stringify(detail), severity });
  }
  interact(message) {
    if (this.interactions.has(message.id)) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([this.questions.signal, controller.signal, ...(this.signal ? [this.signal] : [])]);
    const params = message.params || {};
    const entry = { controller, turnId: params.turnId };
    this.interactions.set(message.id, entry);
    const run = (async () => {
      try {
        if (!this.askUser) throw Error('This provider operation has no question handler in the current job.');
        let result;
        if (message.method === 'mcpServer/elicitation/request') {
          if (params.mode === 'url') {
            const url = new URL(params.url);
            if (url.protocol !== 'https:' || url.username || url.password) throw Error('The MCP input page must use HTTPS without embedded credentials.');
            const input = await this.askUser({ questions: [{ id: 'confirm', question: params.message || 'Complete the requested input page', link: url.href, options: [{ label: 'Completed' }, { label: 'Decline' }], allowCustom: false }] }, signal);
            result = { action: input.answers.confirm.answers[0] === 'Completed' ? 'accept' : 'decline' };
          } else {
            const form = mcpForm(params);
            const input = await this.askUser({ ...form, message: params.message }, signal);
            result = form.empty && input.answers.confirm.answers[0] === 'No' ? { action: 'decline' } : { action: 'accept', content: form.content(input.answers) };
          }
        } else result = await this.askUser(codexQuestions(params), signal);
        if (!signal.aborted) this.write({ id: message.id, result });
      } catch (error) {
        if (signal.aborted) return;
        if (message.method === 'mcpServer/elicitation/request' && error.code === 'AI_QUESTION_CANCELLED') this.write({ id: message.id, result: { action: 'cancel' } });
        else this.write({ id: message.id, error: { code: error.code === 'AI_QUESTION_CANCELLED' ? -32800 : -32602, message: error.message } });
        if (error.code !== 'AI_QUESTION_CANCELLED') this.notice(error.message, message.method, 'warning');
      } finally {
        this.interactions.delete(message.id);
      }
    })();
    this.interactionWork.add(run);
    run.finally(() => this.interactionWork.delete(run));
  }
  fail(error) {
    this.questions.abort(error);
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
    this.questions.abort(questionCancelled('The provider connection closed before this question was answered.'));
    this.signal?.removeEventListener('abort', this.abort);
    stopAgent(this.child);
    await Promise.allSettled([...this.interactionWork]);
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
    web,
  } = options;
  const mcp = await startMcpServer({ tools, call, awareness });
  // A new thread (first turn, or a resume, which drops the old thread) counts from 0;
  // the previous thread's running total would otherwise hide this run's tokens.
  const tokenBaseline = conversation.threadId ? (conversation.providerTotalTokens ?? null) : 0;
  const client = new CodexProcess(settings, { directory, event: value => {
    if (value.type === 'cost') {
      conversation.providerTotalTokens = value.tokens;
      // Older resumed threads have no recorded total: do not bill their entire past as this turn.
      if (tokenBaseline === null) return;
      value = { ...value, tokens: Math.max(0, value.tokens - tokenBaseline) };
    }
    event(value);
  }, mcp, signal, web, askUser: options.askUser });
  client.tools = tools;
  client.call = call;
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
        .catch(error => event({ type: 'provider-notice', text: 'Live context delivery failed: ' + error.message, severity: 'warning' }))
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
            event({ type: 'context-reset' });
            steering.restore(message);
          }
        }
      });
    };
    unsteer = steering?.subscribe(steer);
    event({ type: 'request', model: settings.model, unit: 'turn' });
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
  askUser,
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
  web,
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
      // Built-in tools stay off, except web search and page reading when the user allows them.
      '--tools',
      [askUser && 'AskUserQuestion', web && 'WebSearch', web && 'WebFetch'].filter(Boolean).join(','),
      '--allowedTools',
      web ? 'mcp__mdlxl__*,WebSearch,WebFetch' : 'mcp__mdlxl__*',
      '--strict-mcp-config',
      '--mcp-config',
      config,
      '--setting-sources',
      '',
      '--system-prompt-file',
      instructions,
    ];
    if (askUser) args.push('--permission-prompt-tool', 'stdio');
    if (settings.model) args.push('--model', settings.model);
    if (effortFor(settings)) args.push('--effort', effortFor(settings));
    if (settings.stepLimit > 0) args.push('--max-turns', String(settings.stepLimit));
    if (conversation.threadId) args.push('--resume', conversation.threadId);
    const env = await prepareEnvironment(directory, 'claude');
    env.MCP_TOOL_TIMEOUT = String(MCP_TOOL_TIMEOUT_MS);
    child = spawnAgent(settings.executable || 'claude', args, { cwd: directory, env });
    let finalResult = null,
      streamed = false,
      newMessage = false,
      inputOpen = true,
      written = 1,
      results = 0,
      idle,
      initializeTimer,
      unsteer;
    const toolNames = new Map();
    const controls = new Map(), controlWork = new Set();
    let used = 0;
    const abort = () => stopAgent(child);
    signal.addEventListener('abort', abort, { once: true });
    const writeUser = content =>
      child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
    // Input stays open while the user may steer; it closes once every message
    // has a result, or after a quiet spell if Claude folded steering into a turn.
    const endInput = () => {
      if (controls.size) return;
      clearTimeout(idle);
      if (!inputOpen) return;
      inputOpen = false;
      unsteer?.();
      child.stdin.end();
    };
    const control = data => {
      const requestId = data.request_id, request = data.request || {};
      if (controls.has(requestId)) return;
      const controller = new AbortController(); controls.set(requestId, controller);
      const questionSignal = AbortSignal.any([signal, controller.signal]);
      const work = (async () => {
        let response;
        try {
          if (request.subtype !== 'can_use_tool') throw Error('Unsupported Claude control request: ' + request.subtype);
          if (request.tool_name === 'AskUserQuestion' && askUser) {
            const questions = claudeQuestions(request.input);
            const result = await askUser({ questions }, questionSignal);
            const answers = Object.fromEntries(questions.map(q => [q.question, q.multiSelect ? result.answers[q.id].answers : result.answers[q.id].answers[0]]));
            response = { subtype: 'success', request_id: requestId, response: { behavior: 'allow', updatedInput: { ...request.input, answers } } };
          } else {
            const own = tools.some(t => request.tool_name === 'mcp__mdlxl__' + t.name);
            response = { subtype: 'success', request_id: requestId, response: own ? { behavior: 'allow', updatedInput: request.input } : { behavior: 'deny', message: 'Terminal and filesystem access are disabled. Use the registered MDLxL editor tools.' } };
            if (!own) event({ type: 'provider-notice', text: 'Claude requested an unavailable tool: ' + request.tool_name, detail: TOOLS_ONLY, severity: 'warning' });
          }
        } catch (error) {
          response = error.code === 'AI_QUESTION_CANCELLED'
            ? { subtype: 'success', request_id: requestId, response: { behavior: 'deny', message: error.message } }
            : { subtype: 'error', request_id: requestId, error: error.message };
          if (!questionSignal.aborted && error.code !== 'AI_QUESTION_CANCELLED') event({ type: 'provider-notice', text: error.message, severity: 'warning' });
        }
        if (!questionSignal.aborted && inputOpen) child.stdin.write(JSON.stringify({ type: 'control_response', response }) + '\n');
      })().finally(() => {
        controls.delete(requestId); controlWork.delete(work);
        if (results >= written) endInput();
      });
      controlWork.add(work);
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
            ? reject(Error(CANCELLED))
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
            if (data.type === 'control_response' && data.response?.request_id === 'mdlxl-initialize') {
              if (data.response.subtype === 'error') { reject(Error(data.response.error)); return; }
              clearTimeout(initializeTimer);
              writeUser([{ type: 'text', text: prompt }, ...imageParts(images, 'anthropic')]);
              return;
            }
            if (data.type === 'control_request') { control(data); return; }
            if (data.type === 'control_cancel_request') { controls.get(data.request_id)?.abort(questionCancelled('Claude cancelled this question.')); return; }
            if (data.type === 'rate_limit_event') event({ type: 'provider-notice', text: 'Claude usage limits updated', detail: JSON.stringify(data.rate_limit_info || {}), severity: data.rate_limit_info?.status === 'rejected' ? 'warning' : 'info' });
            if (data.type === 'system' && ['warning', 'api_retry', 'error'].includes(data.subtype)) event({ type: 'provider-notice', text: data.message || data.error || 'Claude ' + data.subtype, detail: data.error_code || '', severity: 'warning' });
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
              event({ type: 'request', model: settings.model });
              const u = data.message.usage;
              used = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
            }
            if (data.type === 'assistant')
              for (const block of data.message?.content || [])
                if (block.type === 'tool_use') {
                  toolNames.set(block.id, block.name);
                  event({ type: 'tool', name: block.name, callId: block.id, ...toolDetail(block.input) });
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
                    summary: toolSummary(text),
                  });
                }
            if (data.type === 'result') {
              finalResult = data;
              if (data.usage) event({ type: 'cost', tokens: Object.entries(data.usage).filter(([key]) => /^(?:input_tokens|output_tokens|cache_read_input_tokens|cache_creation_input_tokens)$/.test(key)).reduce((n, [, v]) => n + Number(v || 0), 0), usd: data.total_cost_usd ?? null });
              const window = Object.values(data.modelUsage || {})[0]?.contextWindow || 200000;
              if (used) event({ type: 'usage', used, window });
              if (!streamed && data.result) event({ type: 'text', text: data.result });
              results++;
              for (const controller of controls.values()) controller.abort(questionCancelled('Claude ended its turn before this question was answered. Reply in chat to continue.'));
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
        if (askUser) {
          initializeTimer = setTimeout(() => reject(Error('Claude initialization timed out.')), 60000);
          child.stdin.write(JSON.stringify({ type: 'control_request', request_id: 'mdlxl-initialize', request: { subtype: 'initialize' } }) + '\n');
        } else writeUser([{ type: 'text', text: prompt }, ...imageParts(images, 'anthropic')]);
        if (steering) unsteer = steering.subscribe(steer);
        else if (!askUser) endInput();
      });
    } finally {
      clearTimeout(idle);
      clearTimeout(initializeTimer);
      for (const controller of controls.values()) controller.abort(questionCancelled('The Claude connection closed.'));
      await Promise.allSettled([...controlWork]);
      unsteer?.();
      signal.removeEventListener('abort', abort);
    }
  } finally {
    stopAgent(child);
    await mcp.close();
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
}
// One provider turn through the connection's own route: Codex, Claude Code or an API.
function runProvider(options) {
  const provider = options.settings.provider;
  return provider === 'codex' ? runCodex(options) : provider === 'claude' ? runClaude(options) : runApi(options);
}
// The models a connection offers: Codex asks its app server, Claude Code takes
// aliases, and APIs list their own.
async function providerModels(settings, key, signal, { directory } = {}) {
  // Claude Code takes these aliases for the newest model of each kind.
  if (settings.provider === 'claude')
    return [
      { id: 'opus', name: 'Opus (newest)' },
      { id: 'sonnet', name: 'Sonnet (newest, cheaper)' },
      { id: 'haiku', name: 'Haiku (newest, cheapest)' },
      { id: 'fable', name: 'Fable (newest, most capable)' },
    ];
  if (settings.provider === 'codex') {
    const client = new CodexProcess(settings, { directory, signal });
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
  const response = await requestJson(
    apiBase(settings) + '/models',
    null,
    key,
    signal,
    settings.provider === 'anthropic' ? ANTHROPIC_HEADERS : {},
  );
  const data = await response.json();
  let items = data.data || data.models || [];
  // OpenAI also lists speech, image and embedding models; keep the chat ones, newest first.
  if (settings.provider === 'openai' && !settings.baseUrl)
    items = items
      .filter(item => /^(?:gpt-|o\d|chatgpt-)/.test(item.id) && !/audio|realtime|transcribe|tts|image|search|embedding|instruct/.test(item.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0));
  return items.map(item => ({
    id: item.id || item.name,
    name: item.display_name || item.id || item.name,
  }));
}
// Sign in, sign out or check the account of a native CLI connection. Codex
// signs in through its app server and the browser; Claude Code runs
// `claude auth <action>`. `notify` shows progress in the console.
async function providerAuth(settings, action, { directory, signal, openExternal, notify }) {
  if (settings.provider === 'codex') {
    const client = new CodexProcess(settings, { directory, signal });
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
      await openExternal(url.href);
      notify('Complete sign-in in your browser.');
      await completed;
      const result = await client.account();
      if (!result.account) throw authenticationRequired();
      return { loggedIn: true, account: result.account };
    } finally {
      await client.close();
    }
  }
  const env = await prepareEnvironment(directory, 'claude');
  if (signal.aborted) throw Error('Sign-in cancelled.');
  const child = spawnAgent(settings.executable || 'claude', ['auth', action], {
    cwd: directory,
    env,
  });
  let output = '';
  const abort = () => stopAgent(child);
  signal.addEventListener('abort', abort, { once: true });
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
        if (action === 'login') notify(line.slice(0, 1500));
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
    signal.removeEventListener('abort', abort);
    stopAgent(child);
  }
}
module.exports = {
  PROVIDERS,
  providerInfo,
  anthropicCost,
  anthropicThinking,
  claudeCompaction,
  endpoint,
  sseEvents,
  runApi,
  runCodex,
  runClaude,
  runProvider,
  providerModels,
  providerAuth,
  toolDetail,
  CodexProcess,
  effortFor,
  authenticationRequired,
  CANCELLED,
};
