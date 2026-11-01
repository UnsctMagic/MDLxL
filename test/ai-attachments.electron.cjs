// Attachment isolation in the packaged app. Run on scripts/hidden-run.ps1.
// Generated models and a local fixture provider; never uses a real profile or AI account.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-attachments');
const checks = [], requests = [], pending = [];
let errors = [];
let app, page, server, link;
const check = (name, value) => { checks.push({ name, passed: !!value }); assert.ok(value, name); };
async function tool(name, args = {}) {
  const response = await fetch(link.url, { method: 'POST', headers: { ...link.headers, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name, arguments: args } }) });
  const reply = await response.json();
  if (reply.error) throw Error(reply.error.message);
  if (reply.result.isError) throw Error(reply.result.content[0].text);
  return JSON.parse(reply.result.content[0].text.split('\nMDLxL continuous awareness')[0]);
}
async function show(name) {
  await page.getByRole('tab', { name, exact: true }).click();
  await page.waitForFunction(name => document.querySelector('.ai-composer .ai-chip')?.textContent.includes(name), name);
  await settle(page, 150);
}
async function attach(...names) { await page.locator('.ai-assistant input[type=file]').setInputFiles(names.map(name => path.join(out, name))); }
async function donors() { return page.locator('.ai-composer button[aria-label^="Remove reference "]').evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-label').replace('Remove reference ', ''))); }
async function images() { return page.locator('.ai-image-chip img').evaluateAll(imgs => imgs.map(i => i.alt)); }
(async () => {
  fs.mkdirSync(path.join(out, 'temp'), { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const bytes = createStarterDocument().serialize('mdx');
  for (const name of ['Model A.mdx', 'Model B.mdx', 'Donor A.mdx', 'Donor B.mdx', 'Delayed donor.mdx', 'Background donor.mdx']) fs.writeFileSync(path.join(out, name), bytes);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXZkAAAAASUVORK5CYII=', 'base64');
  for (const name of ['Image A.png', 'Image B.png', 'Delayed image.png']) fs.writeFileSync(path.join(out, name), png);
  server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    if (req.url.endsWith('/models')) return res.end('{"data":[{"id":"fixture-model"}]}');
    requests.push(JSON.parse(raw));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: '+JSON.stringify({ choices: [{ delta: { content: 'Checking this chat. ' } }] })+'\n\n');
    pending.push(() => res.end('data: '+JSON.stringify({ choices: [{ delta: { content: 'Chat complete.' }, finish_reason: 'stop' }] })+'\n\n'));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const launched = await launchApp({ args: ['Model A.mdx', 'Model B.mdx'].map(name => path.join(out, name)), out, env: { MDLVIS_HEADLESS: '', MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') } });
  ({ app, page, errors } = launched);
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setContentSize(1440, 900); });
  link = (await page.evaluate(async () => {
    await window.desktop.aiEnable(true); return window.desktop.aiConfig();
  })).mcpServers.mdlxl;
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  if (!await page.getByLabel('AI provider', { exact: true }).isVisible()) await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByLabel('AI provider', { exact: true }).selectOption('compatible');
  await page.getByLabel('API base URL', { exact: true }).fill('http://127.0.0.1:'+server.address().port+'/v1');
  await page.getByLabel('Model', { exact: true }).fill('fixture-model');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await show('Model A.mdx');
  await attach('Donor A.mdx', 'Image A.png');
  await page.getByRole('button', { name: 'Remove reference Donor A.mdx', exact: true }).waitFor();
  await page.locator('.ai-image-chip img[alt="Image A.png"]').waitFor();
  check('attaching a model creates no editor tab', await page.getByRole('tab', { name: 'Donor A.mdx', exact: true }).count() === 0);
  await page.getByLabel('AI prompt', { exact: true }).fill('Count model A vertices');
  const contextA = await tool('mdlxl_context');
  check('A context contains only A and its donor', contextA.documents.map(d => d.name).join('|') === 'Model A.mdx|Donor A.mdx');
  await app.evaluate(({ipcMain})=>{
    const handler=ipcMain._invokeHandlers.get('ai:organiser');let hold=true;
    ipcMain.removeHandler('ai:organiser');
    ipcMain.handle('ai:organiser',async(...args)=>{
      if(hold){hold=false;await new Promise(r=>global.releaseLoadingChat=r);}
      return handler(...args);
    });
  });
  await page.getByRole('tab',{name:'Model B.mdx',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="AI prompt"]').disabled);
  check('composer is disabled while its model chat loads',await page.getByLabel('AI prompt',{exact:true}).isDisabled());
  check('loading chat cannot accept stranded files',await page.getByRole('button',{name:'Attach',exact:true}).isDisabled());
  await app.evaluate(()=>releaseLoadingChat());
  await page.waitForFunction(()=>!document.querySelector('[aria-label="AI prompt"]').disabled);
  await show('Model B.mdx');
  check('B starts with no A attachments or draft', !(await donors()).length && !(await images()).length && await page.getByLabel('AI prompt', { exact: true }).inputValue() === '');
  await attach('Donor B.mdx', 'Image B.png');
  await page.getByRole('button', { name: 'Remove reference Donor B.mdx', exact: true }).waitFor();
  await page.locator('.ai-image-chip img[alt="Image B.png"]').waitFor();
  await page.getByLabel('AI prompt', { exact: true }).fill('Count model B vertices');
  const contextB = await tool('mdlxl_context');
  check('B context contains only B and its donor', contextB.documents.map(d => d.name).join('|') === 'Model B.mdx|Donor B.mdx');
  const readA = await tool('mdlxl_script', { target: contextA.target, code: 'return Object.values(references).map(r=>r.name);' });
  check('background A scripts receive only A donor', readA.value.join('|') === 'Donor A.mdx');
  await tool('mdlxl_document', { target: contextA.target, action: 'open', path: path.join(out, 'Background donor.mdx') });
  check('AI document open creates no editor tab', await page.getByRole('tab', { name: 'Background donor.mdx', exact: true }).count() === 0);
  check('background donor does not appear in B', (await donors()).join('|') === 'Donor B.mdx');
  await page.screenshot({ path: path.join(out, 'model-b.png') });
  await show('Model A.mdx');
  check('A restores its own draft and image', await page.getByLabel('AI prompt', { exact: true }).inputValue() === 'Count model A vertices' && (await images()).join('|') === 'Image A.png');
  check('A shows only its own donors including background addition', (await donors()).join('|') === 'Donor A.mdx|Background donor.mdx');
  // Delay both file types so their reads finish after switching to another model.
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () { if (this.name.startsWith('Delayed')) await new Promise(r => setTimeout(r, 1200)); return read.call(this); };
    const image = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (file) { if (file.name.startsWith('Delayed')) setTimeout(() => image.call(this, file), 1200); else image.call(this, file); };
  });
  await attach('Delayed donor.mdx', 'Delayed image.png');
  await show('Model B.mdx');
  await settle(page, 2800);
  check('delayed A file reads do not add attachments to B', (await donors()).join('|') === 'Donor B.mdx' && (await images()).join('|') === 'Image B.png');
  // Hold the send's settings round-trip while the user changes model tabs.
  await app.evaluate(({ ipcMain }) => {
    const handler = ipcMain._invokeHandlers.get('ai:configure'); let delay = true;
    ipcMain.removeHandler('ai:configure');
    ipcMain.handle('ai:configure', async (...args) => {
      if (delay) { delay = false; await new Promise(r => setTimeout(r, 1000)); }
      return handler(...args);
    });
  });
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await show('Model A.mdx');
  for (let i = 0; i < 100 && requests.length < 1; i++) await new Promise(r => setTimeout(r, 50));
  check('switching during B send keeps A draft and messages separate', await page.getByLabel('AI prompt', { exact: true }).inputValue() === 'Count model A vertices' && !(await page.locator('.ai-messages').innerText()).includes('Count model B vertices'));
  check('delayed files return to A', (await donors()).includes('Delayed donor.mdx') && (await images()).includes('Delayed image.png'));
  await page.getByLabel('AI prompt', { exact: true }).press('Control+Enter');
  for (let i = 0; i < 100 && requests.length < 2; i++) await new Promise(r => setTimeout(r, 50));
  check('both model chats run simultaneously', requests.length === 2 && (await page.evaluate(() => window.desktop.aiStatus())).running.length === 2);
  const requestA = requests.find(r => JSON.stringify(r).includes('Count model A vertices'));
  const requestB = requests.find(r => JSON.stringify(r).includes('Count model B vertices'));
  check('A provider receives only A donor context', !!requestA && JSON.stringify(requestA).includes('Donor A.mdx') && !JSON.stringify(requestA).includes('Donor B.mdx') && !JSON.stringify(requestA).includes('Model B.mdx'));
  check('B provider receives only B donor context', !!requestB && JSON.stringify(requestB).includes('Donor B.mdx') && !JSON.stringify(requestB).includes('Donor A.mdx') && !JSON.stringify(requestB).includes('Model A.mdx'));
  for (const finish of pending.splice(0)) finish();
  await page.waitForFunction(async () => (await window.desktop.aiStatus()).running.length === 0);
  const canvas = page.locator('.classic-view canvas').first(), box = await canvas.boundingBox(), before = await canvas.screenshot();
  await page.keyboard.down('Alt'); await page.mouse.move(box.x+box.width/2, box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+box.width/2+90, box.y+box.height/2+25, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page, 250);
  check('normal mouse drag still rotates model view', !before.equals(await canvas.screenshot()));
  await page.screenshot({ path: path.join(out, 'model-a.png') });
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.ai-composer button[aria-label^="Remove reference "]'));
  check('new chat starts with no inherited attachments or draft', !(await donors()).length && !(await images()).length && await page.getByLabel('AI prompt', { exact: true }).inputValue() === '');
  const earlier = await page.getByLabel('Earlier chat', { exact: true }).locator('option').allTextContents();
  const label = earlier.find(text => text.startsWith('Earlier chat'));
  await page.getByLabel('Earlier chat', { exact: true }).selectOption({ label });
  check('earlier A chat retains only its own donors', (await donors()).join('|') === 'Donor A.mdx|Background donor.mdx|Delayed donor.mdx');
  check('earlier chats disable attachment controls',await page.getByRole('button',{name:'Attach',exact:true}).isDisabled() && await page.locator('.ai-assistant input[type=file]').isDisabled());
  const earlierImages=await images();
  await page.evaluate(()=>{
    const data=new DataTransfer();data.items.add(new File(['unused'],'stranded.png',{type:'image/png'}));
    document.querySelector('[aria-label="AI prompt"]').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:data}));
  });
  check('earlier chat paste adds no stranded attachment',JSON.stringify(await images())===JSON.stringify(earlierImages));
  await page.getByLabel('Earlier chat', {exact:true}).selectOption({label:'Current chat'});
  check('returning to current chat does not inherit old donors', !(await donors()).length);
  await show('Model B.mdx');
  check('starting a new A chat preserves B donor', (await donors()).join('|') === 'Donor B.mdx');
  await page.getByRole('button', { name: 'Remove reference Donor B.mdx', exact: true }).click();
  await page.getByRole('tab', { name: 'Donor B.mdx', exact: true }).waitFor({ state: 'detached' });
  check('removing B donor removes it from AI context', (await tool('mdlxl_context')).documents.map(d => d.name).join('|') === 'Model B.mdx');
  await show('Model A.mdx');
  await page.getByLabel('Earlier chat', { exact: true }).selectOption({ label });
  check('removing B donor leaves A references intact without tabs', (await donors()).includes('Donor A.mdx') && await page.getByRole('tab', { name: 'Donor A.mdx', exact: true }).count() === 0);
  const reviewContext = await tool('mdlxl_context');
  const donor = reviewContext.documents.find(d => d.name === 'Donor A.mdx');
  const read = await tool('mdlxl_read', { target: reviewContext.target, documentId: donor.id, path: '/Geosets/0/Vertices' });
  check('hidden donor remains directly readable', JSON.stringify(read).includes('-32'));
  await tool('mdlxl_script', { target: reviewContext.target, edit: true, label: 'Fixture donor review', scope: ['/Geosets/0/Vertices'], code: 'model.Geosets[0].Vertices[0] += 1;' });
  const reviewed = await tool('mdlxl_review', { target: reviewContext.target, action: 'inspect', checksCode: 'return [{name:"fixture change",passed:model.Geosets[0].Vertices[0]===before.Geosets[0].Vertices[0]+1}]', donor: { documentId: donor.id, sequence: -1 } });
  check('hidden donor renders in the actual review', reviewed.review.compared.donor.includes('Donor A.mdx'));
  check('all references stayed out of the editor tab strip', await page.locator('.model-tabs [role=tab]').count() === 2);
  await tool('mdlxl_command', { target: reviewContext.target, id: 'undo' });
  check('no renderer errors', errors.length === 0);
})().catch(async e => { if(page) { await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{}); fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify({body:await page.locator('.ai-assistant').innerText(),requests,status:await page.evaluate(()=>window.desktop.aiStatus())},null,2)); } checks.push({ name: 'exception', passed: false, error: e.stack }); process.exitCode = 1; }).finally(async () => {
  for (const finish of pending.splice(0)) finish();
  if (app) await closeApp(app);
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
});
