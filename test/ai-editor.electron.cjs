// Full prompt -> provider -> MCP -> live editor -> Undo/MDX/MDL workflow.
// Run through scripts/hidden-run.ps1 on Windows. Never uses the user's profile.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { isDeepStrictEqual: equal } = require('node:util');
const crypto = require('node:crypto');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-editor');
const checks = [];
let app, server, page;
const digest = value =>
  crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : Buffer.from(value))
    .digest('hex');
const check = (name, condition, detail) => {
  checks.push({ name, passed: !!condition, ...(detail ? { detail } : {}) });
  assert.ok(condition, name);
};
const sse = (res, value) => res.write('data: ' + JSON.stringify(value) + '\n\n');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  fs.rmSync(path.join(out, 'AI-export.mdx'), { force: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const doc = createStarterDocument();
  doc.apply('AI fixture', ['Geosets', 'Sequences', 'Bones'], model => {
    const g = model.Geosets[0];
    Object.assign(g, {
      Vertices: new Float32Array([0, 0, 0, 40, 0, 0, 0, 0, 40]),
      Normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0]),
      Faces: new Uint16Array([0, 1, 2]),
      VertexGroup: new Uint8Array([0, 0, 0]),
      TVertices: [new Float32Array([0, 0, 1, 0, 0, 1])],
    });
    delete g.Tangents;
    delete g.SkinWeights;
    const other = structuredClone(g);
    for (let i = 0; i < other.Vertices.length; i += 3) other.Vertices[i] += 90;
    model.Geosets.push(other);
    model.Sequences = [
      { Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
      { Name: 'Attack', Interval: new Uint32Array([2000, 3000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
    ];
    model.Bones[0].Translation = {
      LineType: 1,
      GlobalSeqId: null,
      Keys: [0, 1000, 2000, 3000].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, 0]) })),
    };
  });
  const fixture = path.join(out, 'AI-fixture.mdx');
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  let requests = 0;
  server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"data":[{"id":"fixture-model"}]}');
      return;
    }
    const data = JSON.parse(body);
    requests++;
    // The app now asks a separate, tool-free reviewer after the editor checks.
    if (String(data.messages[0]?.content).includes('independent reviewer')) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      sse(res, { choices: [{ delta: { content: JSON.stringify({ verdict: 'good', confidence: 0.9, problems: [], strengths: ['Selected faces mirrored; protected geometry preserved'] }) }, finish_reason: 'stop' }] });
      res.end(); return;
    }
    // Only owner prompts carry the captured editor context. Image evidence and
    // awareness updates are also user-role messages in the provider protocol.
    const promptText = message => Array.isArray(message.content) ? message.content[0]?.text : message.content;
    const user = [...data.messages].reverse().find(message => message.role === 'user' &&
      /MDLxL context (?:captured when this prompt was sent|for this prompt:)/.test(promptText(message) || ''));
    const text = promptText(user);
    // Later turns send a context delta; target is always included (ai-service.cjs).
    const context = JSON.parse(text.slice(text.lastIndexOf('\n') + 1));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const turnMessages = data.messages.slice(data.messages.lastIndexOf(user) + 1);
    const previousCall = turnMessages
      .filter(m => m.tool_calls?.length)
      .at(-1)
      ?.tool_calls.at(-1)?.function;
    const previousResult = turnMessages.filter(m => m.role === 'tool').at(-1)?.content;
    const emitTool = (name, args) => {
      sse(res, {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: 'review-' + requests, function: { name, arguments: JSON.stringify(args) } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      });
      res.end();
    };
    // The current agent protocol requires inspection and a recorded plan before edits.
    const called = turnMessages.flatMap(message => message.tool_calls || []).map(call => call.function.name);
    if (!called.includes('mdlxl_context')) return emitTool('mdlxl_context', {});
    if (!called.includes('mdlxl_plan')) return emitTool('mdlxl_plan', {
      cause: text.startsWith('slow') ? 'The first vertex needs the timed +5 X test edit.' : 'The selected faces need their mirrored counterpart across X=0.',
      reach: 'Selected faces in geoset 0.',
      keep: ['Other geometry, rig, materials and textures'],
      options: [
        { fix: text.startsWith('slow') ? 'Move the first vertex +5 X after the requested delay' : 'Mirror selected faces and weld the compatible seam', cost: 'Changes only the requested geometry' },
        { fix: 'Duplicate and mirror the whole geoset', cost: 'Also duplicates unselected faces' },
      ],
      choice: 0,
      why: 'Preserves unselected geometry.',
      checks: ['Mirrored selection and welded seam', 'Other mesh and rig unchanged', 'MDX and MDL save/reopen preserve the result'],
    });
    if (previousCall?.name === 'mdlxl_script' && previousResult?.includes('"applied":true'))
      return emitTool('mdlxl_review', {
        target: context.target,
        action: 'inspect',
        checksCode: text.startsWith('slow')
          ? 'return [{name:"Timed vertex edit",passed:model.Geosets[0].Vertices[0]===before.Geosets[0].Vertices[0]+5},{name:"Other mesh and rig unchanged",passed:JSON.stringify(model.Geosets[1])===JSON.stringify(before.Geosets[1])&&JSON.stringify(model.Bones)===JSON.stringify(before.Bones)}];'
          : 'return [{name:"Mirrored selected faces",passed:model.Geosets[0].Vertices.length===12&&model.Geosets[0].Faces.length===6},{name:"Other mesh and rig unchanged",passed:JSON.stringify(model.Geosets[1])===JSON.stringify(before.Geosets[1])&&JSON.stringify(model.Bones)===JSON.stringify(before.Bones)}];',
      });
    if (previousCall?.name === 'mdlxl_review') {
      if (JSON.parse(previousCall.arguments).action === 'inspect')
        return emitTool('mdlxl_review', {
          target: context.target,
          action: 'finish',
          outcome: 'passed',
          summary: 'Compared the two viewport images and checked the mirrored seam.',
        });
      sse(res, {
        choices: [
          {
            delta: {
              content:
                'Mirrored the marked vertices and welded the compatible seam.\n\n**Seam:** `X=0`\n- Other geometry preserved.\n\n<img src=x onerror="window.aiUnsafeMarkup=true">',
            },
            finish_reason: 'stop',
          },
        ],
      });
      res.end();
      return;
    }
    if (previousCall?.name === 'mdlxl_script' && data.messages.at(-1).role === 'tool') {
      const result = JSON.parse(data.messages.at(-1).content);
      sse(res, {
        choices: [
          {
            delta: {
              content: result.applied
                ? 'Mirrored the marked vertices and welded the compatible seam.\n\n**Seam:** `X=0`\n- Other geometry preserved.\n\n<img src=x onerror="window.aiUnsafeMarkup=true">'
                : 'Editor response: ' + JSON.stringify(result),
            },
            finish_reason: 'stop',
          },
        ],
      });
      res.end();
      return;
    }
    const slow = text.startsWith('slow'),
      delay = text.startsWith('slow closing') ? 30000 : 3000,
      code = slow
        ? `await new Promise(resolve=>setTimeout(resolve,${delay})); model.Geosets[0].Vertices[0]+=5; return "changed";`
        : 'const {mirrorSelection}=await api.module("ai-mesh"); const result=mirrorSelection(model,selection,{axis:"x",plane:0,weld:true}); for(const key of Object.keys(selection))delete selection[key];Object.assign(selection,result.selection);return result.details;';
    const args = {
      target: context.target,
      code,
      edit: true,
      label: slow ? 'Slow edit' : 'AI mirror selection',
      scope: ['/Geosets/0'],
      protectedPaths: ['/Geosets/1', '/Bones', '/Materials', '/Textures'],
    };
    sse(res, {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'test-' + requests,
                function: { name: 'mdlxl_script', arguments: JSON.stringify(args) },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const launched = await launchApp({ pageTimeout: 30000, fixture, out, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'], env: { MDLVIS_HEADLESS: '', MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') } });
  ({ app, page } = launched);
  const { profile, errors } = launched;
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await settle(page, 1000);
  // This workflow checks direct editing by one chat; Offload Mode (organiser and
  // workers) has its own test in ai-console.electron.cjs.
  await page.evaluate(() => window.desktop.aiOffload(false));
  check('AI panel is closed by default', (await page.locator('.ai-assistant').count()) === 0);
  // Exercise the native sign-in UI through real provider child processes. The
  // browser launch is intercepted, so this never opens a window on the desktop.
  fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}');
  const authScript = path.join(out, 'auth-fixture.js'),
    authExecutable = path.join(out, 'auth-bin', 'codex.cmd'),
    authDirectory = path.join(profile, 'ai');
  fs.writeFileSync(
    authScript,
    String.raw`
const fs=require('node:fs'),args=process.argv.slice(2),send=value=>process.stdout.write(JSON.stringify(value)+'\n');
require('node:readline').createInterface({input:process.stdin}).on('line',async line=>{
 const m=JSON.parse(line);if(m.id===undefined)return;
 if(m.method==='initialize')return send({id:m.id,result:{userAgent:'auth-fixture'}});
 if(m.method==='account/read')return send({id:m.id,result:{account:fs.existsSync('fixture-signed-in')?{type:'chatgpt',planType:'plus'}:null,requiresOpenaiAuth:true}});
 if(m.method==='model/list')return send({id:m.id,result:{data:[{model:'native-test',displayName:'Native test model'}]}});
 if(m.method==='account/login/start'){
   send({id:m.id,result:{type:'chatgpt',loginId:'fixture',authUrl:'https://auth.openai.com/fixture'}});
   const mode=fs.readFileSync('fixture-login-mode','utf8');if(mode==='cancel')return;
   setTimeout(()=>{if(mode==='success')fs.writeFileSync('fixture-signed-in','');send({method:'account/login/completed',params:{success:mode==='success',error:'Login declined'}});},50);return;
 }
 if(m.method==='thread/start')return send({id:m.id,result:{thread:{id:'native-fixture'}}});
 if(m.method==='turn/start'){
   send({id:m.id,result:{turn:{id:'native-turn'}}});const setting=args.find(a=>a.startsWith('mcp_servers.mdlxl.url='));
   const response=await fetch(JSON.parse(setting.slice(setting.indexOf('=')+1)),{method:'POST',headers:{authorization:'Bearer '+process.env.MDLXL_AI_TOKEN,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'mdlxl_context',arguments:{}}})});
   const result=await response.json();if(result.result?.isError)process.exit(8);
   send({method:'item/agentMessage/delta',params:{delta:'Native account connected to the live model.'}});send({method:'turn/completed',params:{turn:{status:'completed'}}});return;
 }
 send({id:m.id,result:{}});
});`,
  );
  fs.mkdirSync(path.dirname(authExecutable), { recursive: true });
  // Run the stand-in with this Node, not whatever program .js files open with on this PC.
  fs.writeFileSync(authExecutable, `@"${process.execPath}" "%~dp0\\..\\auth-fixture.js" %*\r\n`);
  await page.evaluate(
    executable => window.desktop.aiConfigure({ provider: 'codex', executable }),
    authExecutable,
  );
  await page.reload();
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await settle(page, 300);
  await app.evaluate(({ shell }) => {
    shell.openExternal = async () => {};
  });
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.ai-account')?.textContent.includes('Sign in to connect'),
  );
  check(
    'signed-out native connection opens setup instead of appearing ready',
    await page.getByLabel('AI provider', { exact: true }).isVisible(),
  );
  const draft = 'turn this into a circle';
  await page.getByLabel('AI prompt').fill(draft);
  fs.writeFileSync(path.join(authDirectory, 'fixture-login-mode'), 'fail');
  await page.getByRole('button', { name: 'Sign in to send', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.ai-error')?.textContent.includes('Login declined'),
  );
  check(
    'failed login keeps the prompt and does not create a chat turn',
    (await page.getByLabel('AI prompt').inputValue()) === draft &&
      (await page.locator('.ai-message').count()) === 0,
  );
  fs.writeFileSync(path.join(authDirectory, 'fixture-login-mode'), 'cancel');
  await page.getByRole('button', { name: 'Sign in to send', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to send', exact: true }).waitFor();
  check('cancelled login keeps the prompt', (await page.getByLabel('AI prompt').inputValue()) === draft);
  fs.writeFileSync(path.join(authDirectory, 'fixture-login-mode'), 'success');
  await page.getByRole('button', { name: 'Sign in to send', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.ai-account')?.textContent === 'Signed in.');
  check(
    'completed login preserves the prompt for sending',
    (await page.getByLabel('AI prompt').inputValue()) === draft,
  );
  await page.getByLabel('Chat model', { exact: true }).selectOption('native-test');
  check(
    'model picker loads available native models and saves the choice',
    (await page.evaluate(() => window.desktop.aiStatus())).model === 'native-test',
  );
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('.ai-messages')
      ?.textContent.includes('Native account connected to the live model.'),
  );
  check('verified native login survives fresh provider processes and reaches live MCP', true);
  await page.getByRole('button', { name: 'Close AI assistant', exact: true }).click();
  const sideWidth = await page.locator('.classic-workspace').evaluate(el => el.getBoundingClientRect().width);
  const connection = await page.evaluate(async () => {
    await window.desktop.aiEnable(true);
    return window.desktop.aiConfig();
  });
  const link = connection.mcpServers.mdlxl;
  const tool = async (name, args = {}, content = false) => {
    const response = await fetch(link.url, {
      method: 'POST',
      headers: { ...link.headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    const reply = await response.json();
    if (reply.error) throw Error(reply.error.message);
    if (reply.result.isError) throw Error(reply.result.content[0].text);
    return content
      ? reply.result.content
      : reply.result.content[0].type === 'image'
        ? reply.result.content[0]
        : JSON.parse(reply.result.content[0].text);
  };
  // SD Brain is parked: external clients hear nothing of it and help leaves out its guides.
  const initialized = await fetch(link.url, {
    method: 'POST',
    headers: { ...link.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'sd-rules', method: 'initialize', params: { protocolVersion: '2025-11-25' } }),
  }).then(response => response.json());
  check('the parked SD Brain is not mentioned to external clients', !/SD Brain/.test(initialized.result.instructions));
  check('mdlxl_context carries no SD Brain state while it is parked', (await tool('mdlxl_context')).sdBrain === undefined);
  check('help leaves out the SD guides while SD Brain is parked', !(await tool('mdlxl_help')).topics.some(topic => topic.includes('AI-SD-')));
  let context = await tool('mdlxl_context');
  check('live model loaded', context.name === 'AI-fixture.mdx', context.name);
  await tool('mdlxl_select', { target: context.target, geosetIds: [0], activeGeoset: 0 });
  await page
    .locator('.classic-view canvas')
    .first()
    .click({ position: { x: 120, y: 180 } });
  await page.keyboard.press('Control+A');
  await settle(page, 150);
  context = await tool('mdlxl_context');
  check('normal editor selection reaches AI context', JSON.stringify(context.selection) === '{"0":[0,1,2]}', {
    selection: context.selection,
    mode: context.mode,
    checked: context.checkedGeosets,
    pending: context.pending,
    focus: await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 300)),
  });
  const original = await tool('mdlxl_read', { path: '/Geosets/0' }),
    protectedData = await tool('mdlxl_read', { path: '/Geosets/1' }),
    bones = await tool('mdlxl_read', { path: '/Bones' });
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  if (!(await page.getByLabel('AI provider', { exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByLabel('AI provider', { exact: true }).selectOption('compatible');
  await page.getByLabel('API key', { exact: true }).fill('fixture-test-secret');
  await page.getByLabel('API base URL', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
  await page.getByLabel('Model', { exact: true }).fill('fixture-model');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  check(
    'credentials are encrypted in the actual app profile',
    !fs.readFileSync(path.join(profile, 'ai', 'connections.json'), 'utf8').includes('fixture-test-secret'),
  );
  check(
    'chat does not resize the workspace',
    (await page.locator('.classic-workspace').evaluate(el => el.getBoundingClientRect().width)) === sideWidth,
  );
  await page.evaluate(() => {
    window.aiCapturePanel = document.querySelector('.ai-assistant'); window.aiHiddenChanges = [];
    window.aiCaptureObserver = new MutationObserver(records => {
      for (const change of records) if ((change.oldValue || '').includes('visibility: hidden')) window.aiHiddenChanges.push(change.oldValue);
    });
    window.aiCaptureObserver.observe(window.aiCapturePanel,{attributes:true,attributeOldValue:true,attributeFilter:['style']});
  });
  await page.getByLabel('AI prompt').focus();
  const unobstructed = await tool('mdlxl_capture', {target:context.target});
  const uiCapture = await tool('mdlxl_ui', {target:context.target,action:'capture'});
  const pixels = await page.evaluate(async data => {
    const image = new Image(); image.src='data:image/png;base64,'+data; await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const values=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let red=0,blue=0;for(let i=0;i<values.length;i+=4){if(values[i]>160&&values[i+1]<120&&values[i+2]<120)red++;if(values[i+2]>160&&values[i]<120&&values[i+1]<160)blue++;}
    return {red,blue};
  },unobstructed.data);
  check('viewport capture retains actual marked and unmarked vertices',pixels.red>3&&pixels.blue>3,pixels);
  check('viewport and UI captures keep the same visible focused assistant',await page.evaluate(()=>window.aiHiddenChanges.length===0&&window.aiCapturePanel===document.querySelector('.ai-assistant')&&document.activeElement?.getAttribute('aria-label')==='AI prompt')&&uiCapture.mimeType==='image/png');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('ai:event',{type:'tool-result',name:'mdlxl_script',error:true}));
  await page.waitForFunction(()=>document.querySelector('.ai-status')?.textContent==='The AI is checking an editor error.');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('ai:event',{type:'tool-result',name:'mdlxl_capabilities',error:false}));
  await page.waitForFunction(()=>document.querySelector('.ai-status')?.textContent==='Finding modeling tools');
  check('successful tool completion clears a previous recoverable-error status',true);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('ai:event',{type:'done'}));
  await page.getByLabel('AI prompt').fill('mirror these vertices and weld the seam');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.ai-messages')?.textContent.includes('Mirrored the marked vertices'),
    null,
    { timeout: 45000 },
  );
  const mirrored = await tool('mdlxl_read', { path: '/Geosets/0' });
  check(
    'assistant formatting is readable and provider HTML stays inert',
    (await page.locator('.ai-prose strong').last().textContent()) === 'Seam:' &&
      (await page.locator('.ai-prose code').last().textContent()) === 'X=0' &&
      (await page.locator('.ai-prose img').count()) === 0 &&
      !(await page.evaluate(() => window.aiUnsafeMarkup)),
  );
  check(
    'prompt changed the real selected mesh',
    mirrored.value.Vertices.$data.length === 12 && mirrored.value.Faces.$data.length === 6,
  );
  check('before/after verification never hides the assistant',await page.evaluate(()=>window.aiHiddenChanges.length===0));
  await page.evaluate(()=>window.aiCaptureObserver.disconnect());
  check(
    'unselected geoset and rig preserved',
    equal(await tool('mdlxl_read', { path: '/Geosets/1' }), protectedData) &&
      equal(await tool('mdlxl_read', { path: '/Bones' }), bones),
  );
  context = await tool('mdlxl_context');
  await tool('mdlxl_command', { target: context.target, id: 'undo' });
  const undone = await tool('mdlxl_read', { path: '/Geosets/0' });
  check(
    'one normal Undo restores original mesh',
    equal(undone, original),
    equal(undone, original) ? undefined : { original, undone },
  );
  context = await tool('mdlxl_context');
  await tool('mdlxl_command', { target: context.target, id: 'redo' });
  check(
    'normal Redo restores generated mesh',
    equal(await tool('mdlxl_read', { path: '/Geosets/0' }), mirrored),
  );
  context = await tool('mdlxl_context');
  const validation = await tool('mdlxl_document', { target: context.target, action: 'validate' });
  check(
    'MDX and MDL round trips reopen',
    validation.results.every(result => !result.error && !result.readOnly),
    validation.results,
  );
  const exported = path.join(out, 'AI-export.mdx');
  await tool('mdlxl_document', { target: context.target, action: 'export', path: exported });
  const exportedBytes = fs.readFileSync(exported);
  check(
    'export writes the edited model through the normal writer',
    exportedBytes.length > 0 && !exportedBytes.equals(fs.readFileSync(fixture)),
  );
  await assert.rejects(
    () => tool('mdlxl_document', { target: context.target, action: 'export', path: exported }),
    /exist/i,
  );
  check('export does not overwrite without explicit intent', exportedBytes.equals(fs.readFileSync(exported)));
  const script = await tool('mdlxl_script', {
    target: context.target,
    code: 'return {node:typeof process,desktop:typeof window.desktop,modules:api.modules.length,source:(await api.source("animation")).text.includes("sampleNodeMatrices")};',
  });
  check(
    'scripts inspect editor APIs without Node or desktop access',
    script.value.node === 'undefined' &&
      script.value.desktop === 'undefined' &&
      script.value.modules > 30 &&
      script.value.source,
  );
  await assert.rejects(
    () =>
      tool('mdlxl_script', {
        target: context.target,
        edit: true,
        label: 'Invalid script result',
        scope: ['/Geosets/0/Vertices'],
        code: 'model.Geosets[0].Vertices[0]+=10;const result={};result.self=result;return result;',
      }),
    /circular|clone/i,
  );
  check(
    'invalid script result cannot apply a hidden edit',
    equal(await tool('mdlxl_read', { path: '/Geosets/0' }), mirrored),
  );
  await assert.rejects(() =>
    tool('mdlxl_script', { target: context.target, code: 'return await fetch("https://example.com");' }),
  );
  check('model script network access blocked', true);
  await page.getByLabel('AI prompt').fill('slow edit');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.ai-status')?.textContent === 'Working on the model',
  );
  await settle(page, 300);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await settle(page, 3500);
  check(
    'Stop prevents pending script mutations',
    equal(await tool('mdlxl_read', { path: '/Geosets/0' }), mirrored),
  );
  context = await tool('mdlxl_context');
  const old = context.target;
  await tool('mdlxl_select', { target: context.target, vertices: { 0: [0] } });
  // Capture two independent targets, then change selection through normal editor controls.
  const stale = await tool('mdlxl_context');
  await page.getByRole('button', { name: 'Close AI assistant', exact: true }).click();
  await page
    .locator('.classic-view canvas')
    .first()
    .click({ position: { x: 120, y: 180 } });
  await page.keyboard.press('Control+A');
  await settle(page, 120);
  await assert.rejects(
    () =>
      tool('mdlxl_patch', {
        target: stale.target,
        label: 'stale',
        scope: ['/Geosets/0/Vertices'],
        operations: [{ op: 'set', path: '/Geosets/0/Vertices/0', value: 500 }],
      }),
    /selection changed/,
  );
  check('changed user selection blocks delayed edits', true);
  context = await tool('mdlxl_context');
  const capture = await tool('mdlxl_capture', { target: context.target });
  check('real viewport capture returns PNG', capture.mimeType === 'image/png' && capture.data.length > 500);
  const canvas = page.locator('.classic-view canvas').first(),
    beforeCamera = await canvas.screenshot(),
    box = await canvas.boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 + 90, box.y + box.height * 0.5 + 45, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await settle(page, 200);
  check(
    'normal mouse drag still rotates the viewport',
    digest(beforeCamera) !== digest(await canvas.screenshot()),
  );
  context = await tool('mdlxl_context');
  const controls = await tool('mdlxl_ui', { action: 'inspect' }),
    viewport = controls.find(c => c.type === 'canvas' && c.rect.width > 500);
  const beforeGesture = await canvas.screenshot();
  await tool('mdlxl_ui', {
    target: context.target,
    action: 'gesture',
    id: viewport.id,
    points: [
      [0.5, 0.5],
      [0.53, 0.53],
      [0.56, 0.56],
    ],
    modifiers: ['alt'],
  });
  await settle(page, 150);
  check(
    'AI can use the actual viewport mouse controls',
    digest(beforeGesture) !== digest(await canvas.screenshot()),
  );
  context = await tool('mdlxl_context');
  await tool('mdlxl_view', {
    target: context.target,
    mode: 'animation',
    sequence: 0,
    frame: 500,
    playing: false,
  });
  context = await tool('mdlxl_context');
  await tool('mdlxl_select', { target: context.target, nodeIds: [0] });
  context = await tool('mdlxl_context');
  check(
    'animation context includes selected bone, sequence and frame',
    context.sequence === 0 && context.frame === 500 && equal(context.selectedNodeIds, [0]),
  );
  const motion = await tool('mdlxl_script', {
    target: context.target,
    edit: true,
    label: 'AI sparse Stand key',
    scope: ['/Bones/0/Translation'],
    protectedPaths: ['/Geosets', '/Materials'],
    animationRanges: [[0, 1000]],
    code: 'const track=model.Bones[0].Translation;track.Keys.push({Frame:context.frame,Vector:new Float32Array([12,0,0])});track.Keys.sort((a,b)=>a.Frame-b.Frame);const {sampleTrack}=await api.module("animation");return {frame:context.frame,mid:sampleTrack(track,500,{interval:[0,1000],fallback:[0,0,0]}),later:sampleTrack(track,750,{interval:[0,1000],fallback:[0,0,0]})};',
  });
  check(
    'sparse animation edit uses captured frame and interpolates correctly',
    motion.value.frame === 500 && equal(motion.value.mid, [12, 0, 0]) && equal(motion.value.later, [6, 0, 0]),
    motion.value,
  );
  await assert.rejects(
    () =>
      tool('mdlxl_review', {
        target: context.target,
        action: 'inspect',
        checksCode:
          'model.Bones[0].Translation.Keys[0].Vector[0]=999;return [{name:"invalid check",passed:true}];',
      }),
    /without changing either/,
  );
  check('verification scripts cannot change their model copy to manufacture a pass', true);
  // A material without its render mode passes the editor's checks but cannot be saved.
  const renderMode = (await tool('mdlxl_script', { target: context.target, code: 'return model.Materials[0].RenderMode;' })).value;
  await assert.rejects(
    () =>
      tool('mdlxl_script', {
        target: context.target,
        edit: true,
        label: 'Bare material',
        scope: ['/Materials'],
        code: 'delete model.Materials[0].RenderMode; return model;',
      }),
    /could not be saved after this edit .*so it was undone/,
  );
  check(
    'an AI edit that would make the model unsavable is undone and explained',
    (await tool('mdlxl_script', { target: context.target, code: 'return model.Materials[0].RenderMode;' })).value === renderMode,
    renderMode,
  );
  const reviewImages = await tool(
    'mdlxl_review',
    {
      target: context.target,
      action: 'inspect',
      checksCode:
        'return [{name:"Sparse key at frame 500",passed:model.Bones[0].Translation.Keys.some(k=>k.Frame===500&&k.Vector[0]===12)},{name:"Other keys preserved",passed:JSON.stringify(model.Bones[0].Translation.Keys.filter(k=>k.Frame!==500))===JSON.stringify(before.Bones[0].Translation.Keys)}];',
    },
    true,
  );
  // Each of three phases now has both its original and edited picture.
  const reviewReport = JSON.parse(reviewImages[0].text).review;
  check(
    'animation verification samples intermediate poses and returns before/after images',
    reviewReport.passed &&
      reviewReport.poses.length === 1 &&
      reviewImages.filter(x => x.type === 'image').length === 6,
    { report: reviewReport, imageCount: reviewImages.filter(x => x.type === 'image').length },
  );
  check(
    'animation verification restores the playhead',
    (await tool('mdlxl_context', { target: context.target })).liveFrame === 500,
  );
  const viewBefore = (await tool('mdlxl_context', { target: context.target })).view;
  const turned = await tool(
    'mdlxl_review',
    { target: context.target, action: 'inspect', turnaround: true, checksCode: 'return [{name:"Sparse key kept",passed:true}];' },
    true,
  );
  check(
    'the review can show the result from the front, back, left and right',
    turned.filter(x => x.type === 'image').length === 10 &&
      ['front', 'back', 'left', 'right'].every(side => turned.some(x => x.type === 'text' && x.text.includes(`${side} view`))),
    turned.filter(x => x.type === 'text').map(x => x.text.slice(0, 60)),
  );
  check(
    'the side views leave the user\'s camera view as it was',
    (await tool('mdlxl_context', { target: context.target })).view === viewBefore,
  );
  await tool('mdlxl_review', {
    target: context.target,
    action: 'finish',
    outcome: 'passed',
    summary: 'Checked the captured endpoint and intermediate poses.',
  });
  const changedBones = await tool('mdlxl_read', { path: '/Bones' });
  check(
    'other animation keys and geometry preserved',
    equal(
      changedBones.value[0].Translation.Keys.filter(k => k.Frame >= 2000),
      bones.value[0].Translation.Keys.filter(k => k.Frame >= 2000),
    ) && equal(await tool('mdlxl_read', { path: '/Geosets/0' }), mirrored),
  );
  await page
    .getByRole('group', { name: 'Movement tool', exact: true })
    .getByRole('button', { name: 'Move', exact: true })
    .click();
  context = await tool('mdlxl_context');
  await tool('mdlxl_command', { target: context.target, id: 'keyframe:selectAll' });
  context = await tool('mdlxl_context');
  check('selected timeline keys reach the AI', context.keyframes?.keys?.length >= 3, context.keyframes);
  const middlePose = await tool('mdlxl_capture', { target: context.target });
  await tool('mdlxl_view', { target: context.target, frame: 0 });
  const endpointPose = await tool('mdlxl_capture', { target: context.target });
  check('animation edit is visible in actual rendered poses', middlePose.data !== endpointPose.data);
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  const panel = page.locator('section.ai-assistant'),
    panelBefore = await panel.boundingBox(),
    edge = await panel.locator('.ai-resize').boundingBox();
  await page.mouse.move(edge.x + 3, edge.y + 120);
  await page.mouse.down();
  await page.mouse.move(edge.x + 143, edge.y + 120, { steps: 6 });
  await page.mouse.up();
  check(
    'docked chat resizes by dragging its right edge',
    (await panel.boundingBox()).width - panelBefore.width > 100,
  );
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.unmaximize();
    win.setContentSize(1280, 800);
  });
  await settle(page, 150);
  const panelAfter = await panel.boundingBox(),
    size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  check(
    'chat remains reachable after resizing the app to 1280 by 800',
    size.width === 1280 &&
      size.height === 800 &&
      panelAfter.x >= 0 &&
      panelAfter.y >= 0 &&
      panelAfter.x + panelAfter.width <= size.width + 1 &&
      panelAfter.y + panelAfter.height <= size.height + 1,
    { size, panelAfter },
  );
  context = await tool('mdlxl_context');
  const activeDocument = context.documentId;
  await panel.locator('input[type=file]').setInputFiles(fixture);
  await page.waitForFunction(
    () => document.querySelector('.ai-status')?.textContent === 'Reference model added.',
  );
  context = await tool('mdlxl_context');
  check(
    'attaching a reference preserves the active model',
    context.documentId === activeDocument && context.documents.length === 2,
  );
  const reference = await tool('mdlxl_script', {
    target: context.target,
    code: 'const donor=Object.values(references)[0];return {name:donor.name,vertices:donor.model.Geosets[0].Vertices.length/3};',
  });
  check(
    'scripts can inspect complete attached reference models',
    reference.value.name === 'AI-fixture.mdx' && reference.value.vertices === 3,
  );
  const help = await tool('mdlxl_help', { topic: 'AI-HOOK.md' });
  check(
    'AI can read the installed program guide',
    help.text.includes('mdlxl_script') && help.text.includes('Mark vertices'),
  );
  const discovery = await tool('mdlxl_capabilities', { query: 'extrude' }),
    rigApi = await tool('mdlxl_capabilities', { module: 'pose-ik' });
  check(
    'task discovery exposes actual modeling and IK APIs',
    discovery.modules.some(m => m.exports.includes('extrudeFaces')) &&
      rigApi.signatures.some(s => s.name === 'poseChainBetween'),
  );
  const runtimeApis = await tool('mdlxl_script', {
    target: context.target,
    timeoutMs: 120000,
    code: 'const {AI_AREAS}=await api.module("ai-capabilities");const names=[...new Set(AI_AREAS.flatMap(a=>a.modules))],loaded=[];for(const name of names){const module=await api.module(name);loaded.push({name,exports:Object.keys(module).length});}return loaded;',
  });
  check(
    'every advertised task-area module loads inside the packaged script runtime',
    runtimeApis.value.length > 40 && runtimeApis.value.every(m => m.exports > 0),
    runtimeApis.value,
  );
  const referenceByPath = await tool('mdlxl_document', {
    target: context.target,
    action: 'open',
    path: fixture,
  });
  check(
    'AI opens donor models without switching or invalidating its task',
    referenceByPath.reference.id &&
      (await tool('mdlxl_context', { target: context.target })).documentId === activeDocument,
  );
  await tool('mdlxl_view', {
    target: context.target,
    mode: 'animation',
    sequence: 0,
    frame: 500,
    playing: false,
  });
  const selectedKeys = await tool('mdlxl_select', {
    target: context.target,
    keyframes: { nodeId: 0, property: 'Translation', frames: [500] },
  });
  check(
    'AI selects exact native timeline keys',
    selectedKeys.keyframes.keys.length === 1 &&
      selectedKeys.keyframes.keys[0].frame === 500 &&
      selectedKeys.keyframes.keys[0].target.property === 'Translation',
    selectedKeys,
  );
  const samples = await tool('mdlxl_sample', {
    target: context.target,
    frames: [0, 500, 750],
    nodeIds: [0],
    geosetIds: [0],
    vertices: { 0: [0] },
  });
  check(
    'batch pose measurements use live skinned geometry',
    samples.samples[1].nodes[0].position[0] - samples.samples[0].nodes[0].position[0] === 12 &&
      samples.samples[2].geosets[0].bounds.min[0] - samples.samples[0].geosets[0].bounds.min[0] === 6,
  );
  // Front looks along X, so X translation is intentionally invisible there.
  await page.evaluate(()=>{
    window.aiHiddenChanges=[];
    window.aiCaptureObserver=new MutationObserver(records=>{for(const change of records)if((change.oldValue||'').includes('visibility: hidden'))window.aiHiddenChanges.push(change.oldValue);});
    window.aiCaptureObserver.observe(document.querySelector('.ai-assistant'),{attributes:true,attributeOldValue:true,attributeFilter:['style']});
  });
  const captures = await tool(
    'mdlxl_capture',
    {
      target: context.target,
      samples: [
        { view: 'right', frame: 0 },
        { view: 'right', frame: 500 },
        { view: 'front', frame: 500 },
      ],
    },
    true,
  );
  check(
    'multi-frame multi-view capture returns separate labeled real images',
    captures.filter(c => c.type === 'image').length === 3 &&
      captures[1].data !== captures[3].data &&
      captures[3].data !== captures[5].data &&
      captures[4].text.includes('front'),
    captures.map(c => (c.type === 'image' ? { imageHash: digest(c.data) } : { label: c.text })),
  );
  check('native animation captures never hide the assistant',await page.evaluate(()=>window.aiHiddenChanges.length===0));
  await page.evaluate(()=>window.aiCaptureObserver.disconnect());
  await tool('mdlxl_view', {
    target: context.target,
    mode: 'vertices',
    view: 'perspective',
    renderMode: 'solid',
    fit: 'model',
  });
  context = await tool('mdlxl_context');
  const compositeBefore = await tool('mdlxl_read', { path: '' });
  const composite = await tool('mdlxl_script', {
    target: context.target,
    edit: true,
    label: 'AI multi-domain construction',
    scope: [
      '/Geosets',
      '/Bones',
      '/Helpers',
      '/PivotPoints',
      '/Materials',
      '/Textures',
      '/Info',
      '/GeosetAnims',
      '/ParticleEmitters2',
    ],
    code: `
    const {buildForgePrimitive}=await api.module('forge-primitives'),{commitForge}=await api.module('forge');
    const {createRigNode,changeVertexBinding}=await api.module('bone-tools');
    const {createStarterRecipe}=await api.module('particle-starters'),{encodeForgeTga}=await api.module('forge'),{placeParticleRecipe}=await api.module('particle-recipes');
    const bone=createRigNode(model,'Bone',{0:[0]});changeVertexBinding(model,model.Geosets[0],[0],bone.ObjectId,'hard');
    model.Geosets[0].TVertices[0][0]+=.125;model.Materials[0].Layers[0].Alpha=.75;
    const picture={name:'MDLxL_Forge\\\\AI_Disc_Test.tga',bytes:encodeForgeTga({width:1,height:1,data:new Uint8Array([255,255,255,255])})};assets.push(picture);
    commitForge(model,buildForgePrimitive({shape:'Circle',width:20,height:20,position:[60,0,0]}),{texturePath:picture.name});
    const effect=placeParticleRecipe(model,createStarterRecipe('sparks'),{parent:bone.ObjectId,position:[0,0,10]});
    return {bone:bone.ObjectId,effects:effect.ids};
  `,
  });
  const built = await tool('mdlxl_read', { path: '' });
  check(
    'one script constructs geometry, edits UV/material, rigs vertices and places particles',
    composite.applied &&
      built.value.Geosets.length === compositeBefore.value.Geosets.length + 1 &&
      built.value.Bones.length === compositeBefore.value.Bones.length + 2 &&
      built.value.ParticleEmitters2.length > 0 &&
      built.value.Materials[0].Layers[0].Alpha === 0.75,
  );
  check(
    'multi-domain construction preserves unrelated mesh and stored animation',
    equal(built.value.Geosets[1], compositeBefore.value.Geosets[1]) &&
      equal(built.value.Bones[0], compositeBefore.value.Bones[0]),
  );
  const generated = await tool('mdlxl_assets', {
    target: context.target,
    source: 'model',
    query: 'AI_Disc_Test',
  });
  check('the compound script registers its generated Forge texture', generated.items.length === 1 && generated.items[0].Image.includes('AI_Disc_Test'));
  const textureImage = await tool('mdlxl_assets', {
    target: context.target,
    source: 'model',
    action: 'preview',
    textureId: generated.items[0].id,
  });
  check(
    'generated texture reaches the real editor and can be inspected as an image',
    textureImage.mimeType === 'image/png' && textureImage.data.length > 100,
  );
  const assetExport = path.join(out, 'AI-assets.mdx');
  await tool('mdlxl_document', { target: context.target, action: 'export', path: assetExport });
  check(
    'normal export includes generated texture bytes',
    fs.existsSync(path.join(out, 'MDLxL_Forge/AI_Disc_Test.tga')),
  );
  await tool('mdlxl_command', { target: context.target, id: 'undo' });
  check(
    'one Undo restores all compound model changes',
    equal(await tool('mdlxl_read', { path: '' }), compositeBefore),
  );
  await tool('mdlxl_command', { target: context.target, id: 'redo' });
  check(
    'one Redo restores the compound edit and its texture',
    equal(await tool('mdlxl_read', { path: '' }), built),
  );
  const compoundValidation = await tool('mdlxl_document', { target: context.target, action: 'validate' });
  check(
    'compound geometry/rig/material/effect edit reopens as MDX and MDL',
    compoundValidation.results.every(r => !r.error && !r.readOnly),
    compoundValidation.results,
  );
  await tool('mdlxl_command', { target: context.target, id: 'undo' });
  context = await tool('mdlxl_context');
  const rainbowBefore = await tool('mdlxl_read', {path:''});
  const rainbow = await tool('mdlxl_script', {
    target:context.target, edit:true, label:'Three-second rainbow animation',
    scope:['/Sequences','/GeosetAnims','/Geosets/0/Anims','/Geosets/1/Anims','/Textures','/Materials/0/Layers/0/TextureID'],
    protectedPaths:['/Geosets/0/Vertices','/Geosets/0/Faces','/Geosets/0/VertexGroup','/Geosets/1/Vertices','/Bones'],
    code:`const seq=await api.module('sequence-editor'),anim=await api.module('animation-tracks');
const sequence=seq.createSequence(model,3000);seq.setSequenceName(model,sequence,'Rainbow Stand');
const target=anim.animationTargets(model,{geosetIds:[0]}).find(t=>t.property==='Color'),[start,end]=model.Sequences[sequence].Interval;
const colors=[[1,0,0],[1,.5,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,0,0]];
for(let i=0;i<colors.length;i++)anim.setAnimationKey(model,[target],start+(end-start)*i/6,colors[i],sequence);
const bytes=new Uint8Array(34);bytes[2]=2;bytes[12]=2;bytes[14]=2;bytes[16]=32;bytes[17]=0x28;bytes.fill(255,18);
const name='MDLxL_Forge/AI_Rainbow_Test.tga';assets.push({name,bytes});model.Materials[0].Layers[0].TextureID=model.Textures.length;model.Textures.push({Image:name,ReplaceableId:0,Flags:0});
return {duration:end-start,loop:!model.Sequences[sequence].NonLooping,keys:anim.readAnimationTrack(model,target).Keys.filter(k=>k.Frame>=start&&k.Frame<=end).map(k=>[k.Frame,Array.from(k.Vector)])};`,
  });
  const rainbowCount=(await tool('mdlxl_read',{path:'/Info/NumGeosetAnims'})).value;
  check('rainbow task commits once with canonical scopes and automatic counts',rainbow.applied&&rainbow.value.duration===3000&&rainbow.value.loop&&rainbow.value.keys.length===7&&rainbowCount===1,{result:rainbow.value,count:rainbowCount});
  const rainbowValidation=await tool('mdlxl_document',{target:context.target,action:'validate'});
  check('rainbow animation reopens as MDX and MDL',rainbowValidation.results.every(r=>!r.error&&!r.readOnly),rainbowValidation.results);
  await tool('mdlxl_command',{target:context.target,id:'undo'});
  check('one Undo restores the complete model after the rainbow task',equal(await tool('mdlxl_read',{path:''}),rainbowBefore));
  await page.screenshot({ path: path.join(out, 'ai-editor.png') });
  check('no renderer errors', errors.length === 0, errors);
  const mainId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id),
    workerOpened = app.waitForEvent('window', { timeout: 10000 });
  await page.getByLabel('AI prompt').fill('slow closing edit');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await workerOpened;
  const closed = app.waitForEvent('close', { timeout: 8000 }),
    closingAt = Date.now();
  await app
    .evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).destroy(), mainId)
    .catch(error => {
      if (!/closed|destroyed/i.test(error.message)) throw error;
    });
  await closed;
  check('closing the editor cancels its 30-second script immediately', Date.now() - closingAt < 5000);
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ checks, requests }, null, 2));
  console.log(
    JSON.stringify({ passed: checks.length, requests, report: path.join(out, 'verification.json') }),
  );
})()
  .catch(async error => {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      path.join(out, 'verification.json'),
      JSON.stringify({ checks, error: error.stack }, null, 2),
    );
    if (page) {
      await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
      fs.writeFileSync(
        path.join(out, 'failure-ui.txt'),
        await page
          .locator('body')
          .innerText()
          .catch(() => ''),
      );
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await closeApp(app);
    if (server)
      await new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      });
    for (const name of [
      'profile',
      'temp',
      'AI-fixture.mdx',
      'AI-export.mdx',
      'AI-assets.mdx',
      'MDLxL_Forge',
      'auth-fixture.js',
      'package.json',
      'auth-bin',
    ])
      fs.rmSync(path.join(out, name), { recursive: true, force: true });
  });
