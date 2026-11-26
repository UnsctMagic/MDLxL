const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnAgent, stopAgent, lines, prepareEnvironment, resolveExecutable } = require('./ai-process.cjs');
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
// The connection's API address: its own server, the provider's listed address
// (src/ai-providers.json "apiBase"), or Anthropic's or OpenAI's.
function apiBase(settings) {
  const info = providerInfo(settings.provider) || {};
  if (!settings.baseUrl && info.baseUrlRequired)
    throw Error('Enter the API base URL for ' + info.label + ' in AI connection settings.');
  return endpoint(
    settings.baseUrl || info.apiBase || (settings.provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'),
  );
}
const ANTHROPIC_HEADERS = Object.freeze({ 'anthropic-version': '2023-06-01' });
// Editing jobs and pauses outlast the CLIs' default MCP tool timeouts.
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
// The chat-format history as OpenAI Responses input: messages, tool calls and their results.
function responsesInput(history) {
  const part = c =>
    c.type === 'image_url' ? { type: 'input_image', image_url: c.image_url.url } : { type: 'input_text', text: c.text };
  return history.flatMap(m => {
    if (m.role === 'tool') return [{ type: 'function_call_output', call_id: m.tool_call_id, output: m.content }];
    if (m.role === 'assistant')
      return [
        ...(m.reasoning_items || []),
        ...(m.content ? [{ role: 'assistant', content: m.content }] : []),
        ...(m.tool_calls || []).map(c => ({ type: 'function_call', call_id: c.id, name: c.function.name, arguments: c.function.arguments })),
      ];
    return [{ role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(part) }];
  });
}
// Once a long conversation is big, old pictures and long tool results (all but the newest
// few) become short placeholders, so each later step stops paying to re-read them. The
// history itself is trimmed, in one batch, so the provider's prompt cache stays valid
// between trims. Returns how many items were cleared.
function trimOldContext(history, { keepResults = 6, keepPictures = 2, minChars = 1200 } = {}) {
  let cleared = 0;
  const tools = [], pictures = [];
  history.forEach((m, i) => {
    if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > minChars && !m.content.startsWith('[Cleared')) tools.push(i);
    if (m.role === 'user' && Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')) pictures.push(i);
  });
  for (const i of tools.slice(0, Math.max(0, tools.length - keepResults))) {
    history[i] = { ...history[i], content: '[Cleared to save context: an earlier tool result of ' + history[i].content.length + ' characters. Run the step again if you need it.]' };
    cleared++;
  }
  for (const i of pictures.slice(0, Math.max(0, pictures.length - keepPictures))) {
    history[i] = { ...history[i], content: history[i].content.map(c => (c.type === 'image_url' ? { type: 'text', text: '[Earlier picture cleared to save context.]' } : c)) };
    cleared++;
  }
  return cleared;
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
// A prompt may take as many tool rounds as it needs; only the user's own step limit ends it.
// A price list entry for a model id, also when the id ends in a dated snapshot.
function listedPrice(prices, model) {
  return prices[model] || prices[String(model || '').replace(/-\d{4}-?\d{2}-?\d{2}$/, '')] || null;
}
// Anthropic API list prices in US$ per million tokens (checked 2026-11-17). Cache
// writes cost 1.25x input. Unlisted models show tokens only and have no limit.
const ANTHROPIC_PRICES = {
  'claude-fable-5-2': { input: 8, output: 40, cacheRead: 0.2 },
  'claude-mythos-5-2': { input: 8, output: 40, cacheRead: 0.2 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  // Above 100K prompt tokens a request is billed at the long-context rates.
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, long: { above: 100000, input: 0.5, output: 2.5, cacheRead: 0.05 } },
};
// Cost of one request (or the sum of several at one rate). A request is priced on its own
// prompt size, so tiered models never bill a small request at the big-prompt rate.
function anthropicCost(model, spent) {
  const listed = listedPrice(ANTHROPIC_PRICES, model);
  if (!listed) return null;
  const prompt = (spent.input || 0) + (spent.cacheWrite || 0) + (spent.cacheRead || 0);
  const price = listed.long && prompt > listed.long.above ? { ...listed, ...listed.long } : listed;
  return (
    (spent.input * price.input +
      spent.cacheWrite * price.input * 1.25 +
      spent.cacheRead * price.cacheRead +
      spent.output * price.output) /
    1e6
  );
}

// OpenAI API list prices in US$ per million tokens (checked 2026-11-17):
// [input, cached input, output], then the same above 272K input tokens.
const OPENAI_LONG_CONTEXT = 272000;
const OPENAI_PRICES = {
  'gpt-6.2-astra': [8, 0.4, 40, 16, 0.8, 60],
  'gpt-6.2-sol': [2, 0.1, 10, 4, 0.2, 15],
  'gpt-6.1-sol': [2, 0.1, 10, 4, 0.2, 15],
  'gpt-6.1-terra': [1, 0.05, 5, 2, 0.1, 7.5],
  'gpt-6-astra': [10, 1, 50, 20, 2, 75],
  'gpt-6-sol': [2, 0.2, 10, 4, 0.4, 15],
  'gpt-6-luna': [0.1, 0.01, 0.5, 0.2, 0.02, 0.75],
  'gpt-5.6-sol': [4, 0.4, 20, 8, 0.8, 30],
  'gpt-5.6-terra': [2, 0.2, 12, 4, 0.4, 18],
  'gpt-5.6-luna': [0.2, 0.02, 1.2, 0.4, 0.04, 1.8],
};
// List prices of the providers on the chat-completions route, in US$ per million
// tokens (checked 2026-11-19 on each provider's own price page): [input, cached
// input, output], then the same above the provider's long-prompt mark where it has
// one. Unlisted models show tokens only and have no limit. DeepSeek is listed at its
// peak rate (off-peak is half), so its limit never undercounts.
const PROVIDER_PRICES = {
  google: {
    long: 200000,
    'gemini-4-carbon': [2, 0.1, 10],
    'gemini-4-argon': [2, 0.1, 10],
    'gemini-4-neon': [3, 0.15, 15],
    'gemini-4-hydrogen': [1.5, 0.075, 7.5],
    'gemini-3.8-flash': [0.75, 0.075, 3.75],
    'gemini-3.6-flash': [0.75, 0.075, 3.75],
    'gemini-3.5-flash-lite': [0.3, 0.03, 2.5],
    'gemini-3.1-pro-preview': [2, 0.2, 12, 4, 0.4, 18],
    'gemini-3.1-flash-lite': [0.25, 0.025, 1.5],
    'gemini-3-flash-preview': [0.5, 0.05, 3],
    'gemini-2.5-pro': [1.25, 0.125, 10, 2.5, 0.25, 15],
    'gemini-2.5-flash': [0.3, 0.03, 2.5],
    'gemini-2.5-flash-lite': [0.1, 0.01, 0.4],
  },
  xai: {
    long: 200000,
    'grok-4.7': [2, 0.5, 6, 4, 1, 12],
    'grok-4.6': [2, 0.5, 6, 4, 1, 12],
    'grok-4.5': [2, 0.3, 6, 4, 0.6, 12],
    'grok-4.3': [1.25, 0.2, 2.5, 2.5, 0.4, 5],
    'grok-build-0.1': [1, 0.2, 2, 2, 0.4, 4],
  },
  mistral: { 'mistral-large-latest': [0.5, 0.05, 1.5] },
  deepseek: {
    'deepseek-flash': [0.3, 0.006, 1.2],
    'deepseek-v4-flash': [0.3, 0.006, 1.2],
    'deepseek-v4-pro': [1.32, 0.044, 3.96],
  },
  groq: { 'openai/gpt-oss-120b': [0.15, 0.15, 0.6], 'openai/gpt-oss-20b': [0.075, 0.075, 0.3] },
};
// Cost of one chat-completions response, or null when the model has no listed price.
// The prompt count includes the cached part (OpenAI's and DeepSeek's field names).
function compatibleCost(provider, model, usage) {
  const prices = PROVIDER_PRICES[provider], price = prices && listedPrice(prices, String(model || '').replace(/^models\//, ''));
  if (!price) return null;
  const input = usage.prompt_tokens || 0,
    cached = Math.min(usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? 0, input);
  const [rate, cachedRate, outputRate] = prices.long && input > prices.long && price.length > 3 ? price.slice(3) : price;
  return ((input - cached) * rate + cached * cachedRate + (usage.completion_tokens || 0) * outputRate) / 1e6;
}
// A chat-completions answer as stream events: the stream itself, or one event built
// from a whole answer (a provider that cannot stream tool calls).
async function* chatEvents(response, streamed) {
  if (streamed) return yield* sseEvents(response);
  const data = await response.json();
  if (data.error) throw Error(data.error.message || 'AI request failed.');
  const choice = data.choices?.[0], message = choice?.message || {};
  yield {
    usage: data.usage,
    choices: choice
      ? [{
          finish_reason: choice.finish_reason || 'stop',
          delta: { content: message.content || '', reasoning_content: message.reasoning_content, tool_calls: (message.tool_calls || []).map((call, index) => ({ ...call, index })) },
        }]
      : [],
  };
}
// Cost of one OpenAI response; its input count includes the cached part.
function openaiCost(model, usage) {
  const price = listedPrice(OPENAI_PRICES, model);
  if (!price) return null;
  const input = usage.input_tokens || 0,
    cached = Math.min(usage.input_tokens_details?.cached_tokens || 0, input);
  const [rate, cachedRate, outputRate] = input > OPENAI_LONG_CONTEXT ? price.slice(3) : price;
  return ((input - cached) * rate + cached * cachedRate + (usage.output_tokens || 0) * outputRate) / 1e6;
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
// Old pictures, data dumps and reasoning are cleared by the API itself once the
// conversation is large, so later steps stop paying to re-read them. Server-side
// clearing keeps prompt caching and preserved reasoning valid (a client-side edit of
// earlier turns would not). Each clear removes at least 20K tokens, so the cache
// rewrite it causes pays for itself.
//
// A whole job is one API turn (tool results continue it), so clearing reasoning never
// reaches the job's own thinking, which piles up and is re-read on every step. Past
// COMPACT_ABOVE input tokens the API also summarises everything so far into a
// compaction block; the request carries on from that summary, and the saved history
// drops what came before it, so later requests stay small.
const CONTEXT_EDITING_BETA = 'context-management-2025-06-27';
const COMPACTION_BETA = 'compact-2026-01-12';
const COMPACT_ABOVE = 100000;
const COMPACTION_INSTRUCTIONS =
  'Summarize this MDLxL model-editing conversation inside <summary></summary> tags so the work can continue from the summary alone. Keep: ' +
  "the user's request in their own words and every later instruction or correction they gave; the plan and which step is current; " +
  'each change made to the model (what, where, with which tool) and whether it was verified, with the result of each check; ' +
  "every file path in the chat's work folder and any names, ids, indices or numbers that later steps need; open problems; and the remaining work, in order. " +
  'Leave out picture descriptions and data a tool can read again. Do not call any tools while writing this summary; respond with text only.';
const EDIT_TYPES = { thinking: 'clear_thinking_20251015', tools: 'clear_tool_uses_20250919', compact: 'compact_20260112' };
// What each piece is called in the chat when Claude refuses it.
const EDIT_LABELS = {
  [EDIT_TYPES.thinking]: 'clearing of earlier reasoning',
  [EDIT_TYPES.tools]: 'clearing of old tool results',
  [EDIT_TYPES.compact]: 'context compaction',
};
// `off` holds the edit types Claude refused earlier in this run. Returns null when nothing is left.
function anthropicContextEditing(thinking, off = new Set()) {
  const edits = [
    // Keep the reasoning of the job in progress; earlier jobs' reasoning is cleared.
    // Claude requires this one first.
    ...(thinking ? [{ type: EDIT_TYPES.thinking, keep: { type: 'thinking_turns', value: 1 } }] : []),
    {
      type: EDIT_TYPES.tools,
      // Old tool inputs (whole scripts) go too, not only their results.
      clear_tool_inputs: true,
      trigger: { type: 'input_tokens', value: 60000 },
      keep: { type: 'tool_uses', value: 4 },
      clear_at_least: { type: 'input_tokens', value: 20000 },
    },
    // Compaction needs the same models as adaptive thinking (Claude 4.6 and later).
    ...(thinking ? [{ type: EDIT_TYPES.compact, trigger: { type: 'input_tokens', value: COMPACT_ABOVE }, instructions: COMPACTION_INSTRUCTIONS }] : []),
  ].filter(edit => !off.has(edit.type));
  return edits.length ? { edits } : null;
}
// The beta header the edits need.
function anthropicBetas(edits) {
  const betas = [];
  if (edits.some(edit => edit.type !== EDIT_TYPES.compact)) betas.push(CONTEXT_EDITING_BETA);
  if (edits.some(edit => edit.type === EDIT_TYPES.compact)) betas.push(COMPACTION_BETA);
  return betas.join(',');
}
// The edit types a 400 refuses, out of those sent: the ones it names, or the ones whose
// beta it names; a refusal of context management in general takes the newest piece
// first. Any other 400 refuses none, and the error stands.
function refusedEdits(message, edits) {
  if (!edits?.length || !/HTTP 400/.test(message)) return [];
  const types = edits.map(edit => edit.type);
  const named = new Set();
  if (/compact/i.test(message)) named.add(EDIT_TYPES.compact);
  if (/clear_thinking/i.test(message)) named.add(EDIT_TYPES.thinking);
  if (/clear_tool_uses/i.test(message)) named.add(EDIT_TYPES.tools);
  const index = /edits(?:\.|\[)(\d+)/.exec(message);
  if (index && types[index[1]]) named.add(types[index[1]]);
  let hit = types.filter(type => named.has(type));
  if (!hit.length && /context-management-2025-06-27|context[ _-]editing/i.test(message))
    hit = types.filter(type => type !== EDIT_TYPES.compact);
  if (!hit.length && /context[ _]management/i.test(message)) hit = types.slice(-1);
  return hit;
}
// Token counts of one response: the top level counts only the reply itself; with
// compaction, `iterations` lists the summary and the reply, and the bill is their sum.
function usageParts(usage) {
  const count = u => ({
    input: u?.input_tokens || 0,
    cacheWrite: u?.cache_creation_input_tokens || 0,
    cacheRead: u?.cache_read_input_tokens || 0,
    output: u?.output_tokens || 0,
  });
  return Array.isArray(usage?.iterations) && usage.iterations.length ? usage.iterations.map(i => ({ type: i.type, ...count(i) })) : null;
}
const CANCELLED = 'AI request cancelled.';
// Said when a provider asks for anything beyond MDLxL's own editor tools.
const TOOLS_ONLY = 'Terminal and filesystem access remain disabled.';
const CLAUDE_SIGN_IN = 'Sign in to Claude Code in your own terminal with: claude auth login. Then press Check sign-in.';
// Providers whose CLI the user signs in to themselves (src/ai-providers.json "ownSignIn").
const ownSignIn = provider => {
  const info = providerInfo(provider) || {};
  return provider === 'claude' ? CLAUDE_SIGN_IN : 'Sign in to ' + info.label + ' in your own terminal with: ' + info.signInHint + '. Then press Check sign-in.';
};
function authenticationRequired(provider) {
  const message = providerInfo(provider)?.ownSignIn ? ownSignIn(provider) + ' Your prompt has been kept.' : 'Sign in to connect your AI. Your prompt has been kept.';
  return Object.assign(Error(message), {
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
  // OpenAI bills each response on its own, so its cost is added up per response.
  let openaiUsd = 0;
  let anthropicUsd = 0;
  let compatibleUsd = 0;
  const info = providerInfo(settings.provider) || {};
  const charge = usd => {
    event({ type: 'cost', usd, tokens: spent.input + spent.cacheWrite + spent.cacheRead + spent.output });
    if (limit && usd !== null && usd >= limit)
      throw Error(
        `Stopped at about $${usd.toFixed(2)}, the spending limit for one prompt. Progress is kept; send another prompt to continue, or raise the limit in AI connection settings.`,
      );
  };
  // Runs chat-format tool calls and adds their results (and any captures) to the history.
  async function runChatToolCalls(toolCalls) {
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
        content: result.content,
      });
    }
    if (imageMessages.length)
      history.push({
        role: 'user',
        content: [{ type: 'text', text: 'Requested MDLxL viewport captures:' }, ...imageMessages],
      });
  }
  let awarenessVersion = awareness?.version;
  // Cleared and compacted by the API once the conversation is large; a piece Claude
  // refuses stays off for the rest of this prompt, and the chat says so.
  const refused = new Set();
  // Providers without server-side clearing: trim the history here once it is large.
  const TRIM_ABOVE = 60000;
  let lastUsed = 0;
  let compatibleUsage = true, keepReasoning = true;
  const steps = settings.stepLimit > 0 ? settings.stepLimit : Infinity;
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
    if (!anthropic && lastUsed > TRIM_ABOVE && trimOldContext(history)) lastUsed = 0;
    if (anthropic) {
      const thinking = anthropicThinking(settings.model);
      // Prompt caching: the tools/system prefix and the conversation so far are
      // billed at the cached rate on the next step instead of full price.
      const cache = { type: 'ephemeral' };
      const apiTools = tools.map(t => (t.anthropicType ? { type: t.anthropicType, name: t.name } : { name: t.name, description: t.description, input_schema: t.inputSchema }));
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
      const contextManagement = anthropicContextEditing(thinking, refused);
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
            ...(contextManagement ? { context_management: contextManagement } : {}),
            stream: true,
          },
          key,
          signal,
          contextManagement ? { ...ANTHROPIC_HEADERS, 'anthropic-beta': anthropicBetas(contextManagement.edits) } : ANTHROPIC_HEADERS,
        );
      } catch (error) {
        // A model or account without one of the pieces works on without that piece only.
        const pieces = refusedEdits(error.message, contextManagement?.edits);
        if (pieces.length) {
          for (const piece of pieces) {
            refused.add(piece);
            event({
              type: 'provider-notice',
              text: `Claude did not accept ${EDIT_LABELS[piece]}; this prompt continues without it, and long jobs re-read more each step.`,
              detail: error.message,
              severity: 'warning',
            });
          }
          event({ type: 'request-usage', model: settings.model, refused: pieces, error: error.message.slice(0, 500) });
          step--;
          continue;
        }
        // Old reasoning refused: drop it (finished turns first, then all) and ask again.
        if (!STALE_THINKING.test(error.message) || !(dropStaleThinking(history) || dropStaleThinking(history, true))) throw error;
        step--;
        continue;
      }
      const content = [];
      const request = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
      const window = thinking ? 1000000 : 200000;
      let stopReason = null,
        iterations = null,
        appliedEdits = null;
      for await (const data of sseEvents(response)) {
        if (data.type === 'error') throw Error(data.error?.message || 'Claude stream failed.');
        if (data.type === 'content_block_start') content[data.index] = { ...data.content_block, _json: '' };
        // Actual provider context usage for the chat.
        if (data.type === 'message_start' && data.message?.usage) {
          const u = data.message.usage;
          request.input = u.input_tokens || 0;
          request.cacheWrite = u.cache_creation_input_tokens || 0;
          request.cacheRead = u.cache_read_input_tokens || 0;
          event({ type: 'usage', used: request.input + request.cacheRead + request.cacheWrite, window });
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
          // The summary arrives whole in one delta; the block is kept exactly as sent.
          if (data.delta.type === 'compaction_delta') {
            const { type, ...fields } = data.delta;
            for (const [name, value] of Object.entries(fields))
              block[name] = typeof value === 'string' && typeof block[name] === 'string' ? block[name] + value : value;
          }
        }
        if (data.type === 'message_delta') {
          stopReason = data.delta?.stop_reason;
          // The usage here is the reply's final total.
          const u = data.usage || {};
          if (u.input_tokens != null) request.input = u.input_tokens;
          if (u.cache_creation_input_tokens != null) request.cacheWrite = u.cache_creation_input_tokens;
          if (u.cache_read_input_tokens != null) request.cacheRead = u.cache_read_input_tokens;
          if (u.output_tokens) request.output = u.output_tokens;
          iterations = usageParts(u) || iterations;
          appliedEdits = (data.context_management || data.delta?.context_management)?.applied_edits || appliedEdits;
        }
      }
      if (!stopReason) throw Error('The provider stream ended before completion.');
      {
        // A compaction is billed on top of the reply; each part at its own size.
        const parts = iterations?.some(part => part.type === 'compaction') ? iterations : [request];
        for (const part of parts) for (const name of Object.keys(spent)) spent[name] += part[name];
        const costs = parts.map(part => anthropicCost(settings.model, part));
        const usd = costs.includes(null) ? null : costs.reduce((sum, value) => sum + value, 0);
        anthropicUsd = usd === null || anthropicUsd === null ? null : anthropicUsd + usd;
        const compacted = iterations?.find(part => part.type === 'compaction');
        // Each request's tokens, clearing and compaction, kept with the chat as proof of what a step costs.
        event({
          type: 'request-usage',
          model: settings.model,
          ...request,
          stop: stopReason,
          ...(appliedEdits?.length ? { edits: appliedEdits } : {}),
          ...(compacted ? { compaction: { input: compacted.input + compacted.cacheRead + compacted.cacheWrite, output: compacted.output } } : {}),
          ...(usd !== null ? { usd } : {}),
        });
        event({ type: 'usage', used: request.input + request.cacheRead + request.cacheWrite, window });
        charge(anthropicUsd);
      }
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
      const compaction = content.find(b => b.type === 'compaction');
      if (compaction) {
        event({ type: 'compaction', active: true });
        // Claude ignores everything before a summary, so the saved history (and every
        // later upload) starts at it. Without a summary the full history stays.
        if (typeof compaction.content === 'string' && compaction.content) history.splice(0, history.length - 1);
        else
          event({
            type: 'provider-notice',
            text: 'Context compaction wrote no summary; the full history is kept.',
            detail: stopReason === 'refusal' ? 'The summary was declined.' : '',
            severity: 'warning',
          });
        event({ type: 'compaction', active: false });
      }
      const calls = content.filter(b => b.type === 'tool_use');
      // A long web search (or a compaction) can pause the turn; sending it back lets it continue.
      if (!calls.length && (stopReason === 'pause_turn' || stopReason === 'compaction')) continue;
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
          content: result.content,
        });
      }
      history.push({ role: 'user', content: results });
    } else if (settings.provider === 'openai') {
      // OpenAI's newer models take tools together with a thinking effort only
      // through its Responses API. The chat keeps its usual history format.
      event({ type: 'request', model: settings.model });
      const reasoningModel = /^(?:od|gpt-[5-9])/.test(settings.model);
      let response;
      try {
        response = await requestJson(
        base + '/responses',
        {
          model: settings.model,
          instructions: system,
          input: responsesInput(history),
          // Stateless reasoning models hand back encrypted reasoning, kept between steps.
          ...(reasoningModel && keepReasoning ? { include: ['reasoning.encrypted_content'] } : {}),
          ...(tools.length
            ? { tools: tools.map(t => ({ type: 'function', name: t.name, description: t.description, parameters: t.inputSchema, strict: false })) }
            : {}),
          ...(/^(?:o\d|gpt-[5-9])/.test(settings.model) && effortFor(settings) ? { reasoning: { effort: effortFor(settings) } } : {}),
          store: false,
          stream: true,
        },
        key,
        signal,
      );
      } catch (error) {
        // A model, account or changed model that cannot take the saved reasoning runs without it.
        if (keepReasoning && /HTTP 400.*(reasoning|encrypted|include)/is.test(error.message)) {
          keepReasoning = false;
          for (const m of history) delete m.reasoning_items;
          step--;
          continue;
        }
        throw error;
      }
      const calls = [],
        reasoningItems = [];
      let text = '',
        incomplete = null;
      for await (const data of sseEvents(response)) {
        if (data.type === 'error' || data.type === 'response.failed')
          throw Error(data.message || data.response?.error?.message || 'AI stream failed.');
        if (data.type === 'response.output_text.delta') {
          text += data.delta;
          event({ type: 'text', text: data.delta });
        } else if (data.type === 'response.reasoning_summary_text.delta') event({ type: 'thinking', text: data.delta });
        else if (data.type === 'response.output_item.done' && data.item?.type === 'reasoning' && keepReasoning && data.item.encrypted_content)
          reasoningItems.push({ type: 'reasoning', id: data.item.id, summary: data.item.summary || [], encrypted_content: data.item.encrypted_content });
        else if (data.type === 'response.output_item.done' && data.item?.type === 'function_call')
          calls.push({ id: data.item.call_id, type: 'function', function: { name: data.item.name, arguments: data.item.arguments || '{}' } });
        else if (data.type === 'response.completed' || data.type === 'response.incomplete') {
          const usage = data.response?.usage;
          if (usage?.input_tokens) {
            event({ type: 'usage', used: usage.input_tokens, window: 400000 });
            lastUsed = usage.input_tokens;
            spent.input += usage.input_tokens;
            spent.output += usage.output_tokens || 0;
            const usd = openaiCost(settings.model, usage);
            openaiUsd = usd === null || openaiUsd === null ? null : openaiUsd + usd;
            charge(openaiUsd);
          }
          incomplete = data.type === 'response.incomplete' ? data.response?.incomplete_details?.reason || 'incomplete' : '';
        }
      }
      if (incomplete === null) throw Error('The provider stream ended before completion.');
      history.push({ role: 'assistant', content: text || null, ...(reasoningItems.length ? { reasoning_items: reasoningItems } : {}), ...(calls.length ? { tool_calls: calls } : {}) });
      if (!calls.length) {
        if (incomplete === 'max_output_tokens')
          throw Error('The provider reached its output limit. Continue the conversation to finish.');
        return;
      }
      await runChatToolCalls(calls);
    } else {
      event({ type: 'request', model: settings.model });
      // A provider that cannot stream tool calls answers whole (src/ai-providers.json "toolStream").
      const streamed = !(info.toolStream === false && tools.length);
      const effort = info.reasoningEffort ? effortFor(settings) : null;
      let response;
      try {
        response = await requestJson(
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
          stream: streamed,
          ...(effort ? { reasoning_effort: effort === 'xhigh' ? 'high' : effort } : {}),
          // Ask for token counts so the fresh-history rule and trimming can work.
          ...(streamed && compatibleUsage ? { stream_options: { include_usage: true } } : {}),
        },
        key,
        signal,
      );
      } catch (error) {
        if (compatibleUsage && /HTTP 400.*(stream_options|include_usage)/is.test(error.message)) {
          compatibleUsage = false;
          step--;
          continue;
        }
        throw error;
      }
      const calls = new Map();
      let text = '',
        finishReason;
      for await (const data of chatEvents(response, streamed)) {
        if (data.error) throw Error(data.error.message || 'AI stream failed.');
        if (data.usage?.prompt_tokens) {
          event({ type: 'usage', used: data.usage.prompt_tokens, window: info.window || 128000 });
          lastUsed = data.usage.prompt_tokens;
          spent.input += data.usage.prompt_tokens;
          spent.output += data.usage.completion_tokens || 0;
          const cost = compatibleCost(settings.provider, settings.model, data.usage);
          if (cost !== null) compatibleUsd += cost;
          charge(cost === null ? null : compatibleUsd);
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
          // Gemini signs each tool call; the signature must go back with the call.
          if (delta.extra_content) call.extra_content = delta.extra_content;
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
      await runChatToolCalls(toolCalls);
    }
  }
  throw Error(`The AI used ${steps} tool rounds, your step limit. Progress is retained; send another prompt to continue.`);
}

class CodexProcess {
  constructor(settings, { directory, event = () => {}, mcp, signal, web = false, askUser, workDirectory, shellVariables } = {}) {
    this.settings = settings;
    this.workDirectory = workDirectory;
    this.shellVariables = shellVariables;
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
    // With the chat's work folder Codex has its own shell there (sandboxed to the folder,
    // with local network for the MDLxL bridge and package installs); without it, no shell.
    const args = ['app-server', '-c', `features.shell_tool=${this.workDirectory ? 'true' : 'false'}`, '-c', `web_search="${this.web ? 'live' : 'disabled'}"`];
    if (this.workDirectory) args.push('-c', 'sandbox_workspace_write.network_access=true');
    if (effortFor(this.settings)) args.push('-c', `model_reasoning_effort="${effortFor(this.settings)}"`);
    const env = { ...(await prepareEnvironment(this.directory, 'codex')), ...(this.shellVariables || {}) };
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
      // allowlist. This is private to this child; its shell writes only in the work folder.
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
        content: p.item.result?.content,
      });
    // Web research runs inside Codex; its searches show as steps.
    if (message.method === 'item/started' && p.item?.type === 'webSearch')
      this.event({ type: 'tool', name: 'web_search', callId: p.item.id, ...toolDetail(p.item.query || '') });
    if (message.method === 'item/completed' && p.item?.type === 'webSearch')
      this.event({ type: 'tool-result', name: 'web_search', callId: p.item.id, error: false, summary: p.item.query || '' });
    // Its own shell commands and file changes in the chat's work folder show as steps too.
    const own = { commandExecution: 'shell', fileChange: 'edit_file' }[p.item?.type];
    if (own && message.method === 'item/started')
      this.event({ type: 'tool', name: own, callId: p.item.id, ...toolDetail(p.item.command || (p.item.changes || []).map(c => c.path).join(', ')) });
    if (own && message.method === 'item/completed')
      this.event({
        type: 'tool-result',
        name: own,
        callId: p.item.id,
        error: p.item.status === 'failed' || p.item.status === 'declined' || (p.item.exitCode ?? 0) !== 0,
        summary: toolSummary(p.item.aggregatedOutput || ''),
      });
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
  // The job's own server (shared with scripts in the work folder), or one for this turn.
  const mcp = options.mcp || (await startMcpServer({ tools, call, awareness }));
  const workDirectory = options.workDirectory;
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
  }, mcp, signal, web, askUser: options.askUser, workDirectory, shellVariables: options.shellVariables });
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
      cwd: workDirectory || directory,
      approvalPolicy: 'never',
      sandbox: workDirectory ? 'workspace-write' : 'read-only',
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
    if (mcp !== options.mcp) await mcp.close();
  }
}
// Claude Code's own tools for the chat's computer.
const CLAUDE_COMPUTER_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];
async function runClaude({
  mcp: jobMcp,
  workDirectory,
  shellVariables,
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
  const mcp = jobMcp || (await startMcpServer({ tools, call, awareness }));
  const runDirectory = await fs.mkdtemp(path.join(directory, 'claude-run-'));
  // Claude Code keeps a thread with the folder it ran in, so a tool-free turn of a chat
  // with a work folder still runs there.
  const cwd = workDirectory || conversation.threadFolder || directory;
  await fs.mkdir(cwd, { recursive: true });
  const own = workDirectory ? CLAUDE_COMPUTER_TOOLS : [];
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
      // Its own shell and file tools work in the chat's work folder without asking;
      // web search and page reading only when the user allows them.
      '--tools',
      [...own, askUser && 'AskUserQuestion', web && 'WebSearch', web && 'WebFetch'].filter(Boolean).join(','),
      '--allowedTools',
      ['mcp__mdlxl__*', ...own, ...(web ? ['WebSearch', 'WebFetch'] : [])].join(','),
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
    if (settings.spendLimit > 0) args.push('--max-budget-usd', String(settings.spendLimit));
    if (conversation.threadId) args.push('--resume', conversation.threadId);
    const env = { ...(await prepareEnvironment(directory, 'claude')), ...(shellVariables || {}) };
    env.MCP_TOOL_TIMEOUT = String(MCP_TOOL_TIMEOUT_MS);
    child = spawnAgent(settings.executable || 'claude', args, { cwd, env });
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
                    content: Array.isArray(block.content) ? block.content : [],
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
    if (mcp !== jobMcp) await mcp.close();
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
}
// Gemini CLI and GitHub Copilot CLI (src/ai-providers.json "cli"): each prompt is one run
// of the CLI's non-interactive mode, with MDLxL's tools over the local MCP link. Built to
// each CLI's published options; the user's own sign-in is used as it is and never copied.
const CLI_MODELS = {
  gemini: [
    { id: 'gemini-4-neon', name: 'Gemini 4 Neon' },
    { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
  ],
};
// Gemini CLI's own shell, file and web tools stay off unless the chat has a work folder.
const GEMINI_OWN_TOOLS = ['run_shell_command', 'write_file', 'replace', 'save_memory', 'web_fetch', 'google_web_search'];
const CLI_PROMPT_LIMIT = 24000;
const cliToolName = name => String(name || '').replace(/^(?:mcp__)?mdlxl__/, '');
// Whether the CLI is installed and has been set up by its user. The sign-in itself is
// only known to the CLI: a signed-out CLI says so in its answer to the first prompt.
async function cliSignedIn(settings) {
  const kind = providerInfo(settings.provider).cli;
  try {
    resolveExecutable(settings.executable || kind);
  } catch (error) {
    return { loggedIn: false, error: error.message };
  }
  if (kind !== 'gemini') return { loggedIn: true };
  const home = process.env.GEMINI_CLI_HOME || require('node:os').homedir();
  const known = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) || (await fs.stat(path.join(home, '.gemini')).then(() => true, () => false));
  return { loggedIn: known };
}
async function runCli({ mcp: jobMcp, workDirectory, shellVariables, settings, directory, event, tools, call, system, prompt, images, conversation, signal, awareness, steering }) {
  const kind = providerInfo(settings.provider).cli, gemini = kind === 'gemini';
  await fs.mkdir(directory, { recursive: true });
  // Copilot prints only its answer, so its tool steps are reported from MDLxL's end of the link.
  let serial = 0;
  const reported = async (name, args, toolSignal) => {
    const callId = kind + '-' + ++serial;
    event({ type: 'tool', name, callId, ...toolDetail(args) });
    try {
      const result = await call(name, args, toolSignal);
      event({ type: 'tool-result', name, callId, error: false, summary: toolSummary(typeof result === 'string' ? result : JSON.stringify(result ?? '')) });
      return result;
    } catch (error) {
      event({ type: 'tool-result', name, callId, error: true, summary: toolSummary(error.message) });
      throw error;
    }
  };
  const mcp = gemini && jobMcp ? jobMcp : await startMcpServer({ tools, call: gemini ? call : reported, awareness });
  const cwd = workDirectory || conversation.threadFolder || path.join(directory, kind + '-work');
  await fs.mkdir(cwd, { recursive: true });
  const runDirectory = await fs.mkdtemp(path.join(directory, kind + '-run-'));
  const link = mcp.config.mcpServers.mdlxl, written = [];
  const write = async (file, text) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text, { mode: 0o600 });
    written.push(file);
  };
  if (images?.length) event({ type: 'provider-notice', text: 'Pictures attached to the prompt are not passed to this CLI.', severity: 'warning' });
  let child;
  // One run of the CLI for one message; resolves with whether it answered.
  const turn = async (message, resume) => {
    const env = { ...(await prepareEnvironment(directory, settings.provider)), ...(shellVariables || {}) };
    let args, input = null;
    if (gemini) {
      const instructions = path.join(runDirectory, 'system.md');
      await write(instructions, system);
      // Gemini CLI reads its MCP servers from the folder it runs in.
      await write(path.join(cwd, '.gemini', 'settings.json'), JSON.stringify({
        mcpServers: { mdlxl: { httpUrl: link.url, headers: link.headers, timeout: MCP_TOOL_TIMEOUT_MS, trust: true } },
        ...(workDirectory ? {} : { excludeTools: GEMINI_OWN_TOOLS, tools: { exclude: GEMINI_OWN_TOOLS } }),
      }));
      env.GEMINI_SYSTEM_MD = instructions;
      args = ['-o', 'stream-json', '--approval-mode', 'yolo', '--allowed-mcp-server-names', 'mdlxl'];
      if (settings.model) args.push('-m', settings.model);
      if (resume) args.push('--resume', resume);
      // The prompt goes in on standard input, which also selects the non-interactive mode.
      input = message;
    } else {
      const config = path.join(runDirectory, 'mcp.json');
      await write(config, JSON.stringify({ mcpServers: { mdlxl: { type: 'http', url: link.url, headers: link.headers, tools: ['*'] } } }));
      // Copilot CLI reads AGENTS.md in the folder it runs in as its instructions.
      await write(path.join(cwd, 'AGENTS.md'), system);
      let text = message;
      if (text.length > CLI_PROMPT_LIMIT) {
        // Too long for a command line: the request waits in a file the CLI is told to read.
        await write(path.join(cwd, 'MDLXL-REQUEST.md'), message);
        text = 'Read the file MDLXL-REQUEST.md in the current folder and carry out the request in it exactly.';
      }
      args = ['-p', text, '-s', '--no-ask-user', '--additional-mcp-config', '@' + config, '--allow-tool', 'mdlxl'];
      if (text !== message) args.push('--allow-tool', 'read');
      if (workDirectory) args.push('--allow-all-tools');
      else args.push('--deny-tool', 'shell', '--deny-tool', 'write');
      if (settings.model) args.push('--model', settings.model);
    }
    child = spawnAgent(settings.executable || kind, args, { cwd, env });
    const running = child, toolNames = new Map();
    let failure = '', answered = false, streamedText = false, stderr = '';
    const abort = () => stopAgent(running);
    signal.addEventListener('abort', abort, { once: true });
    try {
      await new Promise((resolve, reject) => {
        running.on('error', reject);
        running.once('close', code => (signal.aborted ? reject(Error(CANCELLED)) : failure || code !== 0 ? reject(Error(failure || stderr.trim().slice(-1500) || providerInfo(settings.provider).label + ' ended with code ' + code + '.')) : resolve()));
        running.stdin.on('error', () => {});
        running.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
        if (!gemini) {
          // Plain text: the answer as it is printed.
          running.stdout.setEncoding('utf8');
          running.stdout.on('data', text => { if (text) { answered = true; event({ type: 'text', text }); } });
        } else
          lines(running.stdout, line => {
            let data;
            try {
              data = JSON.parse(line);
            } catch {
              return;
            }
            if (data.type === 'init' && data.session_id) conversation.threadId = data.session_id;
            if (data.type === 'message' && data.role === 'assistant' && data.content) {
              if (!data.delta && streamedText) event({ type: 'text', text: '\n\n' });
              streamedText = true;
              answered = true;
              event({ type: 'text', text: data.content });
            }
            if (data.type === 'tool_use') {
              toolNames.set(data.tool_id, cliToolName(data.tool_name));
              event({ type: 'tool', name: cliToolName(data.tool_name), callId: data.tool_id, ...toolDetail(data.parameters) });
            }
            if (data.type === 'tool_result')
              event({ type: 'tool-result', name: toolNames.get(data.tool_id), callId: data.tool_id, error: data.status === 'error', summary: toolSummary(data.output || data.error?.message || '') });
            if (data.type === 'error') event({ type: 'provider-notice', text: data.message || 'Gemini CLI reported a problem.', severity: data.severity === 'error' ? 'error' : 'warning' });
            if (data.type === 'result') {
              if (data.status === 'error') failure = data.error?.message || 'Gemini CLI ended with an error.';
              const stats = data.stats;
              if (stats) {
                event({ type: 'cost', usd: null, tokens: stats.total_tokens || (stats.input_tokens || 0) + (stats.output_tokens || 0) });
                if (stats.input_tokens) event({ type: 'usage', used: stats.input_tokens, window: 1000000 });
              }
            }
          }, reject);
        if (signal.aborted) return abort();
        if (input !== null) running.stdin.write(input);
        running.stdin.end();
      });
      return answered;
    } finally {
      signal.removeEventListener('abort', abort);
      stopAgent(running);
    }
  };
  try {
    event({ type: 'request', model: settings.model });
    let message = prompt;
    while (message) {
      try {
        await turn(message, gemini ? conversation.threadId : null);
      } catch (error) {
        // A session the CLI no longer has: say it again in a new one.
        if (!gemini || !conversation.threadId || signal.aborted || !/session|resume/i.test(error.message)) throw error;
        conversation.threadId = null;
        await turn(message, null);
      }
      // A message sent while the CLI worked becomes the next run.
      message = steering?.take() || '';
    }
  } finally {
    stopAgent(child);
    if (mcp !== jobMcp) await mcp.close();
    for (const file of written) await fs.rm(file, { force: true });
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
}
// One provider turn through the connection's own route: Codex, Claude Code, another CLI or an API.
function runProvider(options) {
  const provider = options.settings.provider;
  return provider === 'codex' ? runCodex(options) : provider === 'claude' ? runClaude(options) : providerInfo(provider)?.cli ? runCli(options) : runApi(options);
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
  // The other CLIs choose their own default; a model ID can still be typed.
  if (providerInfo(settings.provider)?.cli) return CLI_MODELS[settings.provider] || [];
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
  // Providers that also list speech, image and embedding models: keep the chat ones.
  const filter = providerInfo(settings.provider)?.modelFilter;
  if (filter) items = items.filter(item => new RegExp(filter, 'i').test(String(item.id || item.name || '').replace(/^models\//, '')));
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
  // MDLxL never signs in or out of Claude Code, Gemini CLI or Copilot CLI: the user
  // does that in their own terminal, and MDLxL only checks the result.
  if (action !== 'status') throw Error(ownSignIn(settings.provider));
  if (providerInfo(settings.provider)?.cli) return cliSignedIn(settings);
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
  openaiCost,
  anthropicContextEditing,
  trimOldContext,
  responsesInput,
  anthropicThinking,
  claudeCompaction,
  endpoint,
  sseEvents,
  runApi,
  runCodex,
  runClaude,
  runCli,
  apiBase,
  compatibleCost,
  runProvider,
  providerModels,
  providerAuth,
  toolDetail,
  CodexProcess,
  effortFor,
  authenticationRequired,
  CANCELLED,
};
