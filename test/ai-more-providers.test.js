// More AI providers: the order of the list, each provider's address and prices, the
// request and answer formats against a local mock server, and the Gemini CLI and GitHub
// Copilot CLI routes against stand-in programs. No real keys, logins or AI requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tempDir } from './helpers/fixtures.cjs';
const require = createRequire(import.meta.url);
const { runApi, runCli, runProvider, apiBase, compatibleCost, providerModels, providerAuth, authenticationRequired, PROVIDERS } = require('../electron/ai-providers.cjs');
const providers = JSON.parse(readFileSync(new URL('../src/ai-providers.json', import.meta.url)));
const ids = providers.map(provider => provider.id);
const TOOL = { name: 'mdlxl_read', description: 'Read model data.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } };

// A local stand-in for a provider's chat-completions API: `answer(body, count)` returns the reply.
async function mock(t, answer, models) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET') {
      requests.push({ url: req.url, authorization: req.headers.authorization });
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ data: models || [] }));
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    requests.push({ url: req.url, authorization: req.headers.authorization, body: data });
    const reply = answer(data, requests.filter(item => item.body).length);
    if (data.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const event of reply) res.write('data: ' + JSON.stringify(event) + '\n\n');
      res.end('data: [DONE]\n\n');
    } else {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(reply));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return { requests, baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1' };
}
const job = (settings, extra = {}) => {
  const events = [], calls = [], conversation = {};
  return {
    events, calls, conversation,
    options: { settings, key: 'test-key', tools: [TOOL], call: async (name, args) => { calls.push({ name, args }); return { value: 42 }; }, prompt: 'Read the model.', images: [], system: 'MDLxL tools only',
      conversation, signal: new AbortController().signal, event: event => events.push(event), ...extra },
  };
};

test('the list starts with Claude, then Codex, and ends with the custom connection', () => {
  assert.deepEqual(ids.slice(0, 4), ['claude', 'anthropic', 'codex', 'openai']);
  assert.equal(ids.at(-1), 'compatible');
  assert.deepEqual(ids.slice(4, -1), ['gemini', 'copilot', 'google', 'xai', 'mistral', 'deepseek', 'qwen', 'openrouter', 'groq', 'azure', 'ollama', 'lmstudio']);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(PROVIDERS[0].id, 'claude', 'a new profile starts on Claude');
  for (const provider of providers) {
    assert.ok(provider.label && !/[.!]$/.test(provider.label), provider.id + ' has a plain name');
    if (provider.native) assert.ok(!provider.apiKey && (provider.id === 'codex' || provider.ownSignIn), provider.id + ' signs in through its own program');
    else assert.ok(provider.apiKey || provider.baseUrl, provider.id + ' has a key or an address field in the existing form');
  }
});

test('each key provider talks to its own official address', () => {
  const base = id => apiBase({ provider: id });
  assert.equal(base('anthropic'), 'https://api.anthropic.com/v1');
  assert.equal(base('openai'), 'https://api.openai.com/v1');
  assert.equal(base('google'), 'https://generativelanguage.googleapis.com/v1beta/openai');
  assert.equal(base('xai'), 'https://api.x.ai/v1');
  assert.equal(base('mistral'), 'https://api.mistral.ai/v1');
  assert.equal(base('deepseek'), 'https://api.deepseek.com');
  assert.equal(base('openrouter'), 'https://openrouter.ai/api/v1');
  assert.equal(base('groq'), 'https://api.groq.com/openai/v1');
  assert.equal(base('ollama'), 'http://localhost:11434/v1');
  assert.equal(base('lmstudio'), 'http://localhost:1234/v1');
  // Azure and Qwen addresses belong to the user's own resource or workspace.
  assert.throws(() => base('azure'), /API base URL for Azure OpenAI/);
  assert.throws(() => base('qwen'), /API base URL for Qwen/);
  assert.equal(apiBase({ provider: 'azure', baseUrl: 'https://mine.openai.azure.com/openai/v1/' }), 'https://mine.openai.azure.com/openai/v1');
  assert.equal(apiBase({ provider: 'ollama', baseUrl: 'http://127.0.0.1:9999/v1' }), 'http://127.0.0.1:9999/v1', 'a typed address wins');
  assert.throws(() => apiBase({ provider: 'google', baseUrl: 'http://example.com/v1' }), /HTTPS/);
});

test('list prices: long prompts, cached input, and tokens only for unlisted models', () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + ' vs ' + expected);
  near(compatibleCost('google', 'gemini-4-hydrogen', { prompt_tokens: 1e6, completion_tokens: 1e6 }), 9);
  near(compatibleCost('google', 'models/gemini-4-hydrogen', { prompt_tokens: 1e6, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 1e6 } }), .075);
  near(compatibleCost('google', 'gemini-3.1-pro-preview', { prompt_tokens: 300000, completion_tokens: 0 }), 1.2);
  near(compatibleCost('xai', 'grok-4.7', { prompt_tokens: 100000, completion_tokens: 100000 }), .8);
  near(compatibleCost('xai', 'grok-4.7', { prompt_tokens: 250000, completion_tokens: 0 }), 1);
  near(compatibleCost('deepseek', 'deepseek-v4-pro', { prompt_tokens: 1e6, prompt_cache_hit_tokens: 5e5, completion_tokens: 0 }), .66 + .022);
  near(compatibleCost('mistral', 'mistral-large-latest', { prompt_tokens: 1e6, completion_tokens: 1e6 }), 2);
  near(compatibleCost('groq', 'openai/gpt-oss-120b', { prompt_tokens: 1e6, completion_tokens: 1e6 }), .75);
  assert.equal(compatibleCost('google', 'gemini-99', { prompt_tokens: 5 }), null);
  assert.equal(compatibleCost('openrouter', 'anything', { prompt_tokens: 5 }), null);
  assert.equal(compatibleCost('compatible', 'local', { prompt_tokens: 5 }), null);
});

test('Gemini API: tools over the OpenAI-compatible route, signatures returned, effort and cost', async t => {
  const signature = { google: { thought_signature: 'sig-1' } };
  const api = await mock(t, (body, count) =>
    count === 1
      ? [
          { choices: [{ delta: { reasoning_content: 'Looking.' } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', extra_content: signature, function: { name: 'mdlxl_read', arguments: '{"path":' } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"/Info"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 1000, completion_tokens: 100 } },
        ]
      : [{ choices: [{ delta: { content: 'Done.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 2000, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 1000 } } }]);
  const run = job({ provider: 'google', model: 'gemini-4-hydrogen', baseUrl: api.baseUrl, effort: 'xhigh', spendLimit: 5 });
  await runProvider(run.options);
  const [first, second] = api.requests.map(request => request.body);
  assert.equal(api.requests[0].url, '/v1/chat/completions');
  assert.equal(api.requests[0].authorization, 'Bearer test-key');
  assert.equal(first.stream, true);
  assert.deepEqual(first.stream_options, { include_usage: true });
  assert.equal(first.reasoning_effort, 'high', 'extra high is sent as high: only some Gemini models take more');
  assert.deepEqual(first.tools.map(tool => tool.function.name), ['mdlxl_read']);
  assert.deepEqual(run.calls, [{ name: 'mdlxl_read', args: { path: '/Info' } }]);
  const echoed = second.messages.find(message => message.role === 'assistant').tool_calls[0];
  assert.deepEqual(echoed.extra_content, signature, 'the signed tool call goes back as it came');
  assert.equal(second.messages.at(-1).role, 'tool');
  assert.equal(run.events.filter(event => event.type === 'text').map(event => event.text).join(''), 'Done.');
  assert.ok(run.events.some(event => event.type === 'thinking' && event.text === 'Looking.'));
  assert.equal(run.events.find(event => event.type === 'usage').window, 1000000);
  const cost = run.events.filter(event => event.type === 'cost').at(-1);
  const expected = (1000 * 1.5 + 100 * 7.5 + 1000 * 1.5 + 1000 * .075 + 50 * 7.5) / 1e6;
  assert.ok(Math.abs(cost.usd - expected) < 1e-12, cost.usd + ' vs ' + expected);
  assert.equal(cost.tokens, 3150);
});

test('Qwen: a tool round is asked for and answered whole, since its tools do not stream', async t => {
  const api = await mock(t, (body, count) =>
    count === 1
      ? { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: '', tool_calls: [{ id: 'q1', type: 'function', function: { name: 'mdlxl_read', arguments: '{"path":"/Info"}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }
      : { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'The model is a Footman.' } }], usage: { prompt_tokens: 20, completion_tokens: 6 } });
  const run = job({ provider: 'qwen', model: 'qwen4-max', baseUrl: api.baseUrl });
  await runProvider(run.options);
  const first = api.requests[0].body;
  assert.equal(first.stream, false);
  assert.equal(first.stream_options, undefined);
  assert.equal(first.reasoning_effort, undefined);
  assert.deepEqual(run.calls, [{ name: 'mdlxl_read', args: { path: '/Info' } }]);
  assert.equal(run.events.filter(event => event.type === 'text').map(event => event.text).join(''), 'The model is a Footman.');
  assert.equal(run.events.filter(event => event.type === 'cost').at(-1).usd, null, 'no listed price: tokens only');
  assert.equal(run.events.filter(event => event.type === 'cost').at(-1).tokens, 41);
  // Without tools (a memory note) it streams like the others.
  const plain = await mock(t, () => [{ choices: [{ delta: { content: 'Hi.' }, finish_reason: 'stop' }] }]);
  const note = job({ provider: 'qwen', model: 'qwen4-max', baseUrl: plain.baseUrl });
  await runProvider({ ...note.options, tools: [] });
  assert.equal(plain.requests[0].body.stream, true);
});

test('a local server needs no key, and Stop ends a request', async t => {
  const api = await mock(t, () => [{ choices: [{ delta: { content: 'Local.' }, finish_reason: 'stop' }] }]);
  const run = job({ provider: 'ollama', model: 'qwen3', baseUrl: api.baseUrl });
  await runProvider({ ...run.options, key: '' });
  assert.equal(api.requests[0].authorization, undefined);
  assert.equal(run.events.find(event => event.type === 'text').text, 'Local.');
  const stopped = new AbortController();
  stopped.abort();
  await assert.rejects(runProvider({ ...job({ provider: 'groq', model: 'openai/gpt-oss-120b', baseUrl: api.baseUrl }).options, signal: stopped.signal }), /cancelled/i);
  await assert.rejects(runProvider(job({ provider: 'xai', model: '', baseUrl: api.baseUrl }).options), /Choose a model/);
});

test('model lists keep the chat models', async t => {
  const api = await mock(t, () => [], [{ id: 'models/gemini-4-hydrogen' }, { id: 'models/gemini-embedding-2' }, { id: 'models/gemini-3-pro-image-preview' }, { id: 'models/gemini-3.8-flash' }]);
  assert.deepEqual((await providerModels({ provider: 'google', baseUrl: api.baseUrl }, 'k')).map(model => model.id), ['models/gemini-4-hydrogen', 'models/gemini-3.8-flash']);
  assert.equal(api.requests[0].url, '/v1/models');
  const mistral = await mock(t, () => [], [{ id: 'mistral-large-latest' }, { id: 'mistral-embed' }, { id: 'mistral-moderation-latest' }]);
  assert.deepEqual((await providerModels({ provider: 'mistral', baseUrl: mistral.baseUrl }, 'k')).map(model => model.id), ['mistral-large-latest']);
  assert.ok((await providerModels({ provider: 'gemini' })).length >= 1);
  assert.deepEqual(await providerModels({ provider: 'copilot' }), []);
});

// Stand-in command-line programs: they check the options MDLxL passes, call one MDLxL tool
// over the MCP link they were given, and answer in the CLI's own published output format.
const cliFixture = String.raw`
const fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(2);
const copilot=args.includes('-s');const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
fs.appendFileSync(path.join(__dirname,'cli-args.jsonl'),JSON.stringify({args,cwd:process.cwd(),system:process.env.GEMINI_SYSTEM_MD?fs.readFileSync(process.env.GEMINI_SYSTEM_MD,'utf8'):null})+'\n');
async function tool(url,headers){const response=await fetch(url,{method:'POST',headers:{...headers,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'mdlxl_read',arguments:{path:'/Info'}}})});const text=await response.text();if(!response.ok)throw Error('tool '+response.status+' '+text);return text;}
let input='';process.stdin.on('data',chunk=>input+=chunk).on('end',async()=>{try{
 if(copilot){
  const config=JSON.parse(fs.readFileSync(args[args.indexOf('--additional-mcp-config')+1].slice(1),'utf8')).mcpServers.mdlxl;
  if(!fs.readFileSync('AGENTS.md','utf8').includes('MDLxL tools only'))process.exit(5);
  if(!args.includes('--no-ask-user')||args[args.indexOf('--allow-tool')+1]!=='mdlxl')process.exit(6);
  await tool(config.url,config.headers);
  process.stdout.write('Copilot answer for: '+args[args.indexOf('-p')+1].slice(0,40));
 }else{
  const settings=JSON.parse(fs.readFileSync(path.join('.gemini','settings.json'),'utf8'));const link=settings.mcpServers.mdlxl;
  if(args[args.indexOf('-o')+1]!=='stream-json'||args[args.indexOf('--approval-mode')+1]!=='yolo'||args[args.indexOf('--allowed-mcp-server-names')+1]!=='mdlxl')process.exit(6);
  if(args.includes('--resume')&&args[args.indexOf('--resume')+1]==='gone'){send({type:'result',status:'error',error:{type:'x',message:'Session gone not found; cannot resume.'}});process.exit(1);}
  send({type:'init',session_id:'gemini-fixture',model:'gemini-4-hydrogen'});
  send({type:'message',role:'user',content:input});
  send({type:'tool_use',tool_name:'mdlxl__mdlxl_read',tool_id:'t1',parameters:{path:'/Info'}});
  const output=await tool(link.httpUrl,link.headers);
  send({type:'tool_result',tool_id:'t1',status:'success',output});
  send({type:'message',role:'assistant',content:'Gemini answer ',delta:true});
  send({type:'message',role:'assistant',content:'for: '+input.slice(0,20),delta:true});
  send({type:'error',severity:'warning',message:'A small warning.'});
  send({type:'result',status:'success',stats:{total_tokens:120,input_tokens:100,output_tokens:20,cached:0,input:100,duration_ms:5,tool_calls:1,models:{}}});
 }}catch(error){process.stderr.write(String(error.stack||error));process.exit(9);}});
`;
async function cli(t, name) {
  const directory = tempDir('mdlxl-ai-cli-');
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'agent.js'), cliFixture);
  const file = path.join(directory, 'bin', process.platform === 'win32' ? name + '.cmd' : name);
  await fs.mkdir(path.dirname(file));
  if (process.platform === 'win32') await fs.writeFile(file, '@"%dp0%\\..\\agent.js" %*\r\n');
  else {
    await fs.writeFile(file, '#!' + process.execPath + '\n' + cliFixture.replace("path.join(__dirname,'cli-args.jsonl')", JSON.stringify(path.join(directory, 'cli-args.jsonl'))));
    await fs.chmod(file, 0o700);
  }
  const seen = async () => (await fs.readFile(path.join(directory, 'cli-args.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  return { directory, executable: file, seen };
}
const cliJob = (provider, config, extra = {}) => {
  const events = [], calls = [], conversation = {};
  return { events, calls, conversation, options: { settings: { provider, executable: config.executable, model: 'm-1' }, directory: path.join(config.directory, 'ai'), tools: [TOOL],
    call: async (name, args) => { calls.push({ name, args }); return { name: 'Footman' }; }, system: 'MDLxL tools only', prompt: 'Describe the model.', images: [], conversation,
    signal: new AbortController().signal, event: event => events.push(event), ...extra } };
};

test('Gemini CLI: one run per prompt, MDLxL tools over its MCP link, the answer streamed', async t => {
  const config = await cli(t, 'gemini'), run = cliJob('gemini', config);
  await runProvider(run.options);
  assert.deepEqual(run.calls, [{ name: 'mdlxl_read', args: { path: '/Info' } }], 'the CLI reached MDLxL through the link it was given');
  const [seen] = await config.seen();
  assert.equal(seen.system, 'MDLxL tools only');
  assert.deepEqual(seen.args.slice(seen.args.indexOf('-m'), seen.args.indexOf('-m') + 2), ['-m', 'm-1']);
  assert.ok(!seen.args.includes('--resume'));
  assert.equal(run.conversation.threadId, 'gemini-fixture');
  assert.equal(run.events.filter(event => event.type === 'text').map(event => event.text).join(''), 'Gemini answer for: Describe the model.');
  const step = run.events.find(event => event.type === 'tool'), result = run.events.find(event => event.type === 'tool-result');
  assert.equal(step.name, 'mdlxl_read', 'the step shows under the tool\'s own name');
  assert.ok(result.callId === step.callId && result.name === 'mdlxl_read' && result.error === false);
  assert.ok(run.events.some(event => event.type === 'provider-notice' && event.text === 'A small warning.'));
  assert.equal(run.events.find(event => event.type === 'cost').tokens, 120);
  // The link's token does not stay behind in the work folder.
  await assert.rejects(fs.stat(path.join(seen.cwd, '.gemini', 'settings.json')));
  // The next prompt continues the same session; a steering message becomes one more run.
  let steered = 'And its size?';
  const again = cliJob('gemini', config, { conversation: run.conversation, steering: { take: () => { const text = steered; steered = ''; return text; } } });
  await runProvider(again.options);
  const runs = await config.seen();
  assert.equal(runs.length, 3);
  assert.deepEqual(runs[1].args.slice(runs[1].args.indexOf('--resume'), runs[1].args.indexOf('--resume') + 2), ['--resume', 'gemini-fixture']);
  assert.ok(again.events.filter(event => event.type === 'text').some(event => event.text.includes('And its size?')));
  // A session the CLI has lost is started afresh instead of failing the prompt.
  const thread = { threadId: 'gone' };
  await runProvider(cliJob('gemini', config, { conversation: thread }).options);
  assert.equal(thread.threadId, 'gemini-fixture');
});

test('GitHub Copilot CLI: its answer is shown and its tool steps are reported from MDLxL\'s side', async t => {
  const config = await cli(t, 'copilot'), run = cliJob('copilot', config);
  await runCli(run.options);
  assert.deepEqual(run.calls, [{ name: 'mdlxl_read', args: { path: '/Info' } }]);
  assert.equal(run.events.filter(event => event.type === 'text').map(event => event.text).join(''), 'Copilot answer for: Describe the model.');
  const step = run.events.find(event => event.type === 'tool'), result = run.events.find(event => event.type === 'tool-result');
  assert.ok(step.name === 'mdlxl_read' && result.callId === step.callId && result.error === false);
  const [seen] = await config.seen();
  assert.ok(seen.args.includes('--deny-tool') && !seen.args.includes('--allow-all-tools'), 'its own shell and file tools stay off without a work folder');
  await assert.rejects(fs.stat(path.join(seen.cwd, 'AGENTS.md')));
  // A request too long for a command line waits in a file.
  const long = cliJob('copilot', config, { prompt: 'x'.repeat(30000) });
  await runCli(long.options);
  const second = (await config.seen())[1];
  assert.ok(second.args[second.args.indexOf('-p') + 1].length < 200 && second.args.includes('read'));
});

test('the CLIs are signed in to by their user: MDLxL only checks, and says how', async t => {
  const config = await cli(t, 'copilot');
  assert.deepEqual(await providerAuth({ provider: 'copilot', executable: config.executable }, 'status', { directory: config.directory, signal: new AbortController().signal }), { loggedIn: true });
  await assert.rejects(providerAuth({ provider: 'copilot', executable: config.executable }, 'login', { directory: config.directory, signal: new AbortController().signal }), /your own terminal with: copilot login/);
  await assert.rejects(providerAuth({ provider: 'gemini' }, 'logout', { directory: config.directory, signal: new AbortController().signal }), /your own terminal with: gemini/);
  const missing = await providerAuth({ provider: 'copilot', executable: path.join(config.directory, 'nowhere', 'copilot.cmd') }, 'status', { directory: config.directory, signal: new AbortController().signal });
  assert.equal(missing.loggedIn, false);
  assert.match(authenticationRequired('gemini').message, /Gemini CLI in your own terminal with: gemini\. Then press Check sign-in\. Your prompt has been kept\./);
  assert.match(authenticationRequired('claude').message, /claude auth login/);
  assert.match(authenticationRequired('codex').message, /^Sign in to connect your AI/);
});
