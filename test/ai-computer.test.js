// Owner, 18 Nov 2026: "I want FULL power - that means I want the SAME capacity it has in
// claude/chatgpt/codex + the powers of having a modeling program." Each chat has its own
// computer: a kept work folder, a real shell and file tools, and scripts that drive MDLxL
// through the job's MCP server without an AI round trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire, register } from 'node:module';
import { tempDir } from './helpers/fixtures.cjs';
import { AI_TOOLS, AI_COMPUTER_TOOLS_ANTHROPIC, AI_WORKSPACE_TOOL, aiToolEditsModel } from '../src/ai-tools.js';
import { EditorDocument, openDocument } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { prepareModelSave } from '../src/save-target.js';
import { editTab, undoTab, selectTab } from '../src/ai-tab.js';

const require = createRequire(import.meta.url);
const { createComputer, prepareWorkFolder, bridgeVariables, workFolderOf } = require('../electron/ai-computer.cjs');
const { startMcpServer } = require('../electron/ai-mcp.cjs');
const { runApi, runClaude, runCodex } = require('../electron/ai-providers.cjs');
const { AiService } = require('../electron/ai-service.cjs');
const chats = require('../electron/ai-chats.cjs');

const root = path.resolve(import.meta.dirname, '..');
const folderFor = t => {
  const folder = tempDir('mdlxl-ai-computer-');
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  return folder;
};
const shellEnv = folder => ({ ...process.env, ...bridgeVariables(folder) });
const python = spawnSync('python', ['--version'], { encoding: 'utf8' }).status === 0;

test('the shell runs in the work folder, caps long output, times out and is killed by Stop', async t => {
  const folder = folderFor(t);
  const computer = createComputer({ folder, env: shellEnv(folder) });
  const where = (await computer.run('shell', { command: 'node -e "console.log(process.cwd())"' })).toolText;
  assert.equal(path.resolve(where.trim()), path.resolve(folder));
  const long = (await computer.run('shell', { command: 'node -e "process.stdout.write(String(1).repeat(100000))"' })).toolText;
  assert.ok(long.length < 31000, 'output is capped');
  assert.match(long, /output cut: 100000 characters/);
  assert.match((await computer.run('shell', { command: 'node -e "process.exit(3)"' })).toolText, /exit code 3/);
  let started = Date.now();
  const slow = (await computer.run('shell', { command: 'node -e "setTimeout(() => {}, 60000)"', timeout: 1 })).toolText;
  assert.match(slow, /stopped after 1 s/);
  assert.ok(Date.now() - started < 20000, 'a runaway command is stopped');
  // Stop: the job's signal kills the command and its children.
  const stop = new AbortController();
  started = Date.now();
  setTimeout(() => stop.abort(), 500);
  await assert.rejects(computer.run('shell', { command: 'node -e "setTimeout(() => {}, 60000)"' }, stop.signal), /cancelled/);
  assert.ok(Date.now() - started < 20000);
});

test('file tools write only inside the work folder, edit exactly once and open one picture', async t => {
  const folder = folderFor(t);
  const computer = createComputer({ folder, env: shellEnv(folder) });
  await computer.run('str_replace_based_edit_tool', { command: 'create', path: 'scripts/pose.py', file_text: 'angle = 10\nprint(angle)\n' });
  await computer.run('str_replace_based_edit_tool', { command: 'str_replace', path: 'scripts/pose.py', old_str: 'angle = 10', new_str: 'angle = 25' });
  assert.match((await computer.run('read_file', { path: 'scripts/pose.py' })).toolText, /1\tangle = 25/);
  await assert.rejects(computer.run('edit_file', { path: 'scripts/pose.py', old_text: 'missing', new_text: '' }), /No match/);
  await assert.rejects(computer.run('write_file', { path: path.join(path.dirname(folder), 'outside.txt'), text: 'x' }), /inside the work folder/);
  await assert.rejects(computer.run('write_file', { path: '../outside.txt', text: 'x' }), /inside the work folder/);
  await fs.writeFile(path.join(folder, 'shot.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  const picture = await computer.run('view_image', { path: 'shot.png' });
  assert.match(picture.image, /^data:image\/png;base64,/);
});

test('scripts in the work folder call mdlxl tools through the MCP url and save pictures as files', async t => {
  const folder = folderFor(t), calls = [];
  const tools = AI_TOOLS.filter(tool => ['mdlxl_read', 'mdlxl_capture'].includes(tool.name));
  const server = await startMcpServer({
    tools,
    call: async (name, args) => {
      calls.push({ name, args });
      if (name === 'mdlxl_capture')
        return { images: [{ label: 'front', image: 'data:image/png;base64,iVBORw0KGgo=' }, { label: 'side', image: 'data:image/png;base64,iVBORw0KGgo=' }] };
      return { info: 'from MDLxL', target: args.target };
    },
  });
  t.after(() => server.close());
  const connection = { url: server.url, auth: server.token, target: 'job-target' };
  await prepareWorkFolder(folder, connection);
  const computer = createComputer({ folder, env: { ...process.env, ...bridgeVariables(folder, connection) } });
  await computer.run('write_file', {
    path: 'probe.mjs',
    text: "import * as mdlxl from './mdlxl.mjs';\nconst read = await mdlxl.call('mdlxl_read', { path: '/Info' });\nconst shots = await mdlxl.capture('pose', { samples: [{ view: 'front' }, { view: 'left' }] });\nconsole.log(JSON.stringify({ read, shots }));\n",
  });
  const output = JSON.parse((await computer.run('shell', { command: 'node probe.mjs' })).toolText);
  assert.deepEqual(output.read, { info: 'from MDLxL', target: 'job-target' });
  assert.deepEqual(output.shots.map(s => s.label), ['front', 'side']);
  for (const shot of output.shots) assert.ok(existsSync(shot.path) && shot.path.startsWith(path.join(folder, 'pictures')));
  assert.equal(calls[0].args.target, 'job-target', 'the job target is filled in');
  if (python) {
    const result = (await computer.run('shell', { command: 'python -c "import mdlxl; print(mdlxl.call(\'read\', {\'path\': \'/Info\'})[\'info\'])"' })).toolText;
    assert.equal(result.trim(), 'from MDLxL');
  }
});

test('Claude API gets its own bash and text editor tools by type, run by MDLxL in the work folder', async t => {
  const folder = folderFor(t), bodies = [];
  const computer = createComputer({ folder, env: shellEnv(folder) });
  const send = (res, value) => res.write('data: ' + JSON.stringify(value) + '\n\n');
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    bodies.push(JSON.parse(body));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if (bodies.length === 1) {
      send(res, { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'b1', name: 'bash', input: {} } });
      send(res, { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ command: 'node -e "console.log(40+2)"' }) } });
      send(res, { type: 'message_delta', delta: { stop_reason: 'tool_use' } });
    } else {
      send(res, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      send(res, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Done.' } });
      send(res, { type: 'message_delta', delta: { stop_reason: 'end_turn' } });
    }
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  await runApi({
    settings: { provider: 'anthropic', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: 'test-claude' },
    key: 'k',
    tools: [...AI_TOOLS, ...AI_COMPUTER_TOOLS_ANTHROPIC],
    call: (name, args, signal) => computer.run(name, args, signal),
    prompt: 'Add numbers',
    system: 'editor',
    conversation: { messages: [] },
    signal: new AbortController().signal,
    event: () => {},
  });
  const sent = bodies[0].tools;
  assert.deepEqual(sent.find(tool => tool.name === 'bash'), { type: 'bash_20250124', name: 'bash' });
  assert.deepEqual(sent.find(tool => tool.name === 'str_replace_based_edit_tool'), { type: 'text_editor_20250728', name: 'str_replace_based_edit_tool' });
  assert.ok(sent.find(tool => tool.name === 'view_image').input_schema);
  const result = bodies[1].messages.at(-1).content[0];
  assert.equal(result.tool_use_id, 'b1');
  assert.equal(result.content[0].text.trim(), '42');
});

// A provider fixture that records how it was launched, then answers once.
const agent = String.raw`
const fs=require('node:fs');const args=process.argv.slice(2),codex=args[0]==='app-server';
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const record=extra=>fs.writeFileSync(process.env.MDLXL_FIXTURE_OUT,JSON.stringify({args,cwd:process.cwd(),url:process.env.MDLXL_URL,work:process.env.MDLXL_WORK,...extra}));
if(codex){
 require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id===undefined)return;
  if(m.method==='initialize')return send({id:m.id,result:{userAgent:'fixture'}});
  if(m.method==='account/read')return send({id:m.id,result:{account:{type:'chatgpt'},requiresOpenaiAuth:true}});
  if(m.method==='thread/start'||m.method==='thread/resume'){record({thread:m.params});return send({id:m.id,result:{thread:{id:'codex-thread'}}});}
  if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn'}}});send({method:'turn/completed',params:{turn:{status:'completed'}}});return;}
  send({id:m.id,result:{}});
 });
}else{
 record({});
 let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{send({type:'result',session_id:'claude-thread',is_error:false,result:'ok'});});
}
`;
async function agentExecutable(directory, name) {
  await fs.writeFile(path.join(directory, 'agent.js'), agent);
  const file = path.join(directory, 'bin', process.platform === 'win32' ? name + '.cmd' : name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (process.platform === 'win32') await fs.writeFile(file, '@"%dp0%\\..\\agent.js" %*\r\n');
  else {
    await fs.writeFile(file, '#!' + process.execPath + '\n' + agent);
    await fs.chmod(file, 0o700);
  }
  return file;
}
for (const [name, run] of [['claude', runClaude], ['codex', runCodex]])
  test(`${name === 'claude' ? 'Claude Code' : 'Codex'} runs with its own shell and file tools in the chat's work folder`, async t => {
    const directory = folderFor(t), work = path.join(directory, 'work', 'chat');
    const out = path.join(directory, 'launch.json');
    process.env.MDLXL_FIXTURE_OUT = out;
    t.after(() => delete process.env.MDLXL_FIXTURE_OUT);
    const mcp = await startMcpServer({ tools: AI_TOOLS, call: async () => ({}) });
    t.after(() => mcp.close());
    const connection = { url: mcp.url, auth: mcp.token, target: 't' };
    await prepareWorkFolder(work, connection);
    await run({
      settings: { executable: await agentExecutable(directory, name) },
      directory,
      workDirectory: work,
      mcp,
      shellVariables: bridgeVariables(work, connection),
      tools: AI_TOOLS,
      call: async () => ({}),
      system: 'editor',
      prompt: 'test prompt',
      images: [],
      conversation: {},
      signal: new AbortController().signal,
      event: () => {},
    });
    const launch = JSON.parse(await fs.readFile(out, 'utf8'));
    assert.equal(launch.url, mcp.url, 'commands see the MDLxL bridge');
    assert.equal(path.resolve(launch.work), path.resolve(work));
    if (name === 'claude') {
      const value = flag => launch.args[launch.args.indexOf(flag) + 1];
      assert.equal(path.resolve(launch.cwd), path.resolve(work));
      assert.deepEqual(value('--tools').split(','), ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']);
      assert.deepEqual(value('--allowedTools').split(','), ['mcp__mdlxl__*', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']);
      assert.ok(!launch.args.includes('--dangerously-skip-permissions'));
    } else {
      assert.ok(launch.args.includes('features.shell_tool=true'));
      assert.ok(launch.args.includes('sandbox_workspace_write.network_access=true'));
      assert.equal(launch.thread.sandbox, 'workspace-write');
      assert.equal(launch.thread.approvalPolicy, 'never');
      assert.equal(path.resolve(launch.thread.cwd), path.resolve(work));
    }
  });

test('a chat keeps its work folder across prompts, has no workspace offer, and loses the folder with the chat', async t => {
  const profile = tempDir('mdlxl-ai-computer-chat-');
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const requests = [];
  const answers = [
    { tool: 'write_file', args: { path: 'notes.txt', text: 'kept for the next prompt' } },
    { tool: 'write_file', args: { path: 'probe.mjs', text: "import { call } from './mdlxl.mjs';\nconsole.log(JSON.stringify(await call('mdlxl_read', { path: '/Info' })));\n" } },
    { tool: 'shell', args: { command: 'node probe.mjs' } },
    { text: 'First prompt done.' },
    { tool: 'read_file', args: { path: 'notes.txt' } },
    { text: 'Second prompt done.' },
  ];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    requests.push(JSON.parse(body));
    const answer = answers[requests.length - 1];
    const choice = answer.tool
      ? { delta: { tool_calls: [{ index: 0, id: 'call-' + requests.length, function: { name: answer.tool, arguments: JSON.stringify(answer.args) } }] }, finish_reason: 'tool_calls' }
      : { delta: { content: answer.text }, finish_reason: 'stop' };
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [choice] }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const service = new AiService({ root, profile, electron: {}, getWindow: () => null });
  service.emit = () => {};
  const editorCalls = [];
  service.call = async (name, args) => {
    editorCalls.push({ name, args });
    if (name === 'mdlxl_read') return { info: 'model info', target: args.target };
    if (name === 'mdlxl_checkpoint') return { fingerprint: 'f', review: { changed: false, phase: 'unchanged' } };
    throw Error('Unexpected tool ' + name);
  };
  t.after(() => service.close());
  await service.configure({ provider: 'compatible', model: 'test', baseUrl: `http://127.0.0.1:${server.address().port}/v1` });
  const context = { target: 'selected', documentId: 'model', name: 'model.mdx', selection: {} };
  assert.equal((await service.send({ id: 'chat1', text: 'Write a note and read the model from a script', context })).ok, true);
  const work = workFolderOf(service.directory, 'chat1');
  assert.ok(existsSync(path.join(work, 'notes.txt')), 'the file stays after the prompt');
  assert.ok(existsSync(path.join(work, 'mdlxl.py')) && existsSync(path.join(work, 'mdlxl.mjs')), 'the helpers are in the folder');
  // The script reached the editor through the bridge, on the job's target.
  const shellResult = requests[3].messages.at(-1);
  assert.equal(shellResult.role, 'tool');
  assert.deepEqual(JSON.parse(shellResult.content), { info: 'model info', target: 'selected' });
  assert.ok(editorCalls.some(c => c.name === 'mdlxl_read' && c.args.target === 'selected'));
  // The second prompt of the same chat finds the file.
  assert.equal((await service.send({ id: 'chat1', text: 'What did you note?', context })).ok, true);
  assert.match(requests[5].messages.at(-1).content, /1\tkept for the next prompt/);
  // No offer, no switch: the computer is simply on and the AI is told about it.
  const first = requests[0];
  const names = first.tools.map(tool => tool.function.name);
  for (const tool of ['shell', 'read_file', 'write_file', 'edit_file', 'view_image', 'mdlxl_workspace']) assert.ok(names.includes(tool), tool);
  const workspace = first.tools.find(tool => tool.function.name === 'mdlxl_workspace').function.parameters;
  assert.ok(!workspace.properties.action.enum.includes('offer'));
  assert.ok(!AI_WORKSPACE_TOOL.inputSchema.properties.action.enum.includes('offer'));
  assert.doesNotMatch(JSON.stringify(first.messages), /action offer|workspace is off/);
  assert.match(first.messages[0].content, /Your own computer for this chat/);
  assert.match(JSON.stringify(first.messages[1]), /Work folder of this chat/);
  assert.ok(!('localWorkspace' in (await service.status())));
  // Deleting the chat deletes its computer.
  await chats.removeChats(service, { organiser: 'chat1' });
  assert.equal(existsSync(work), false);
});

// app/ modules are Vite modules: stand in for their build-time file lists.
register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function load(url, context, next) {
      const result = await next(url, context);
      if (!/\\/app\\/[^/]+\\.js$/.test(url)) return result;
      return { ...result, source: String(result.source).replaceAll('import.meta.glob(', '(() => ({}))(') };
    }`),
);
test('mdlxl_document apply puts a model file on the model as one Undo step with its change report', async () => {
  globalThis.window = Object.assign(new EventTarget(), { desktop: {} });
  // Read-backs and checkpoints use the real serializer, as the app's save worker does.
  globalThis.Worker = class {
    postMessage({ snapshot, format, name }) {
      Promise.resolve().then(() => this.onmessage({ data: prepareModelSave(EditorDocument.restoreRecoveryState(snapshot), format, name) }));
    }
    terminate() {}
  };
  const { AiEditorBridge } = await import('../app/ai-editor.js');
  const doc = createStarterDocument();
  doc.name = 'A.mdx';
  const session = {
    id: 'A.mdx', doc, path: 'A.mdx', assets: new Map(), uvPreviews: {}, animationDrafts: {},
    viewState: { mode: 'vertices', selectable: new Set([0]), visibleOnly: new Set(), selection: { 0: [0] }, hidden: {}, activeGeoset: 0, uvSet: 0, selectedNodeIds: [] },
  };
  const host = {
    state: () => ({
      session, sessions: [session], doc, model: doc.model, selection: session.viewState.selection, selectedNodeIds: [], selectable: new Set([0]),
      activeGeoset: 0, uvSet: 0, mode: 'vertices', animationPanel: 'movement', sequence: -1, globalSeqId: null, time: 0, view: 'perspective',
      workplane: 'xy', keyframes: null, renderMode: 'wireframe', hidden: {}, hiddenGeosets: new Set(), playing: false, saving: false, dialog: null, uvEditing: false,
    }),
    sessions: () => [session],
    summary: () => ({ documentId: session.id }),
    commands: () => [{ id: 'undo', label: 'Undo', enabled: true }],
    command: async id => { if (id === 'undo') doc.undo(); },
    edit: (label, sections, operation, options) => doc.apply(label, sections, operation, options),
    select: value => selectTab(session, value),
    restoreContext: async () => {},
    sessionOf: () => session,
    editIn: (id, ...change) => editTab(session, ...change),
    undoIn: (id, redo) => undoTab(session, redo),
    selectIn: (id, value) => selectTab(session, value),
    assetsIn: () => [],
    addAssetsIn: async () => {},
  };
  const bridge = new AiEditorBridge(() => host);
  const { target } = bridge.context();
  // What a Python script would write: the exported MDL text with one vertex moved.
  const exported = openDocument(prepareModelSave(doc, 'mdl', 'model.mdl').bytes, 'model.mdl');
  const x = doc.model.Geosets[0].Vertices[0];
  exported.model.Geosets[0].Vertices[0] = x + 7;
  const bytes = prepareModelSave(exported, 'mdl', 'model.mdl').bytes;
  window.desktop.aiReadModel = async ({ path: file }) => ({ name: path.basename(file), path: file, bytes });
  assert.equal(aiToolEditsModel('mdlxl_document', { action: 'apply' }), true, 'the job records it as an edit');
  const undoBefore = doc._historyStore.undoEntries.length;
  const result = await bridge.call('mdlxl_document', { target, action: 'apply', path: 'D:/work/model.mdl', label: 'Python edit' });
  assert.equal(result.applied, true);
  assert.equal(result.changeCount, 1, 'only what the file changed, not how MDL text stores the rest');
  assert.deepEqual(result.changes.map(c => c.path), ['/Geosets/0/Vertices']);
  assert.ok(Math.abs(doc.model.Geosets[0].Vertices[0] - (x + 7)) < 1e-4);
  assert.equal(doc._historyStore.undoEntries.length, undoBefore + 1, 'one Undo step');
  assert.equal(doc._historyStore.undoEntries.at(-1).label, 'Python edit');
  doc.undo();
  assert.equal(doc.model.Geosets[0].Vertices[0], x);
  // The same file without changes changes nothing.
  window.desktop.aiReadModel = async () => ({ name: 'same.mdl', bytes: prepareModelSave(doc, 'mdl', 'same.mdl').bytes });
  const same = await bridge.call('mdlxl_document', { target: bridge.context().target, action: 'apply', path: 'D:/work/same.mdl' });
  assert.equal(same.applied, false);
});
