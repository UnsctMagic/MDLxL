// Exercise the shared provider protocol inside the packaged app, on the hidden desktop.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const helmetDigest = '76da1f1d3deba1b540bd990b902747611a3aee4609b0997598b848c92f473279';
const script = `const bone = model.Bones.find(b => b.Name === JSON.parse(files['part.json']).bone);
const candidate = {};
for (const [gi, ids] of Object.entries(selection)) {
  const geo = model.Geosets[gi];
  const part = ids.filter(id => {
    const group = geo.Groups[geo.VertexGroup[id]];
    return group.length === 1 && group[0] === bone.ObjectId;
  });
  if (part.length) candidate[gi] = part;
}
return candidate;`;

// A deterministic provider makes each tool call visible and gives the test an exact
// oracle. It never contacts an AI service or substitutes a mock for the editor.
async function main() {
  const fixture = testModel('WH_WOC_KnightSlaaneshChampion01.mdx');
  const before = digest(fs.readFileSync(fixture));
  const out = path.resolve('out/ai-local-workspace');
  fs.mkdirSync(out, { recursive: true });
  let round = 0, failure, firstContext, actual;
  let offRequests = 0;
  const reason = 'I can check the marked vertices against the head bone in one pass and preview the helmet before changing your selection.';
  const toolCall = (id, args) => ({ tool_calls: [{ index: 0, id, function: { name: 'mdlxl_workspace', arguments: JSON.stringify(args) } }] });
  const actions = [
    { action: 'write', file: 'part.json', text: '{"bone":"Bone_Head"}' },
    { action: 'write', file: 'find.js', text: script },
    { action: 'run', file: 'find.js', output: 'candidate.json' },
    { action: 'write', file: 'outside.json', text: '{"0":[0]}' },
    { action: 'select', file: 'outside.json' },
    { action: 'preview', file: 'candidate.json', view: 'perspective' },
    { action: 'select', file: 'candidate.json' },
  ];
  const server = http.createServer(async (req, res) => {
    if (req.url.endsWith('/models')) { res.end('{"data":[{"id":"fixture"}]}'); return; }
    let raw = ''; for await (const bytes of req) raw += bytes;
    const data = JSON.parse(raw);
    let delta;
    try {
      const messages = data.messages;
      const ownerIndex = messages.findLastIndex(m => m.role === 'user' && (Array.isArray(m.content) ? m.content[0].text : m.content)?.includes('MDLxL context'));
      const content = messages[ownerIndex].content;
      const owner = Array.isArray(content) ? content[0].text : content;
      const replies = messages.slice(ownerIndex + 1).filter(m => m.role === 'tool');
      const available = data.tools?.some(t => t.function.name === 'mdlxl_workspace') || false;
      assert.ok(available, 'the provider can offer the JavaScript workspace while the switch is off');
      if (owner.startsWith('Workspace off')) {
        firstContext ||= JSON.parse(owner.slice(owner.lastIndexOf('\n') + 1));
        if (replies.length === 0) delta = toolCall('disabled', { action: 'list' });
        else { assert.match(replies[0].content, /disabled/i); delta = { content: 'Workspace unavailable ' + (++offRequests) + '.' }; }
      } else if (owner.startsWith('Manual')) {
        if (!replies.length) delta = toolCall('manual', { action: 'list' });
        else { assert.deepEqual(JSON.parse(replies[0].content).files, []); delta = { content: 'Manual workspace available.' }; }
      } else if (!replies.length) {
        delta = toolCall('offer', { action: 'offer', reason });
      } else if (owner.startsWith('Decline')) {
        assert.equal(JSON.parse(replies[0].content).enabled, false);
        if (replies.length === 1) delta = toolCall('repeat', { action: 'offer', reason });
        else if (replies.length === 2) delta = toolCall('declined', { action: 'list' });
        else { assert.match(replies.at(-1).content, /disabled/i); delta = { content: 'Continued without workspace.' }; }
      } else {
        assert.equal(JSON.parse(replies[0].content).enabled, true);
        assert.ok(available, 'same conversation advertises the tool after enabling');
        const response = messages.filter(m => m.role === 'tool').at(-1)?.content;
        if (!round) {
          Object.assign(firstContext, JSON.parse(owner.slice(owner.lastIndexOf('\n') + 1)));
          assert.ok(!firstContext.selection[0] && firstContext.selection[25]?.length === 338, 'mixed geoset marked, horse geoset outside the partial selection');
        } else if (round === 5) {
          assert.match(response, /subset of the vertices/);
        } else if (round === 6) {
          assert.doesNotThrow(() => JSON.parse(response), response);
          assert.equal(JSON.parse(response).triangles, 649);
          const picture = messages.at(-1).content.find(p => p.type === 'image_url');
          fs.writeFileSync(path.join(out, 'knight-helmet.png'), Buffer.from(picture.image_url.url.split(',')[1], 'base64'));
        } else if (round === 7) {
          assert.equal(JSON.parse(response).selectedVertices, 425);
        } else if (round === 8) {
          actual = JSON.parse(response);
          assert.equal(actual.documentId, firstContext.documentId);
          assert.equal(actual.revision, firstContext.revision);
          assert.equal(digest(JSON.stringify(actual.selection)), helmetDigest);
        } else assert.doesNotThrow(() => JSON.parse(response), response);
        if (round <= actions.length) {
          const name = round === actions.length ? 'mdlxl_context' : 'mdlxl_workspace';
          delta = { tool_calls: [{ index: 0, id: 'workspace-' + round, function: { name, arguments: JSON.stringify(actions[round] || {}) } }] };
          round++;
        } else delta = { content: '425 helmet vertices selected.' };
      }
    } catch (err) { failure = err; delta = { content: 'Workspace test failed.' }; }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [{ delta, finish_reason: delta.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.mkdirSync(path.join(profile, 'ai'));
  fs.writeFileSync(path.join(profile, 'ai/connections.json'), JSON.stringify({ provider: 'compatible', providers: { compatible: { model: 'fixture', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1' } } }));
  let app;
  try {
    const session = await launchApp({ fixture, out, profile, show: 'inactive' });
    app = session.app;
    const { page } = session;
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    const toggle = page.getByRole('switch', { name: 'Local workspace', exact: true });
    assert.equal(await toggle.count(), 1, 'Local workspace switch is available in the AI header');
    assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    async function prompt(text, done, choice) {
      await page.getByLabel('AI prompt').fill(text);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      if (choice) {
        const card = page.getByRole('group', { name: 'JavaScript workspace' }).filter({ has: page.getByRole('button', { name: choice, exact: true }) });
        await card.waitFor();
        assert.ok((await card.textContent()).includes(reason));
        const green = await card.evaluate(el => getComputedStyle(el).backgroundColor);
        const [r, g, b] = green.match(/[\d.]+/g).map(Number);
        assert.ok(g > r && g > b, 'offer has a green background');
        if (choice === 'Yes') await page.screenshot({ clip: await card.boundingBox(), path: path.join(out, 'workspace-offer.png') });
        await card.getByRole('button', { name: choice, exact: true }).click();
      }
      await page.waitForFunction(expected => {
        const text = document.querySelector('.ai-messages')?.textContent || '';
        return text.includes(expected) || text.includes('Workspace test failed.');
      }, done, { timeout: 90000 });
      if (failure) throw failure;
      await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'hidden' });
    }
    await prompt('Workspace off: check available tools.', 'Workspace unavailable 1.');
    await toggle.click();
    await prompt('Manual switch enabled.', 'Manual workspace available.');
    await toggle.click();
    await prompt('Decline this offer.', 'Continued without workspace.', 'No');
    await page.locator('[data-hotkey="geosetsAll"]').click();
    await page.locator('[data-hotkey="geoset:0"]').uncheck();
    await page.keyboard.press('Control+a');
    await page.waitForFunction(() => /3373 vertices/.test(document.querySelector('.ai-chips')?.textContent));
    await prompt('Isolate the helmet within my selection.', '425 helmet vertices selected.', 'Yes');
    await page.waitForFunction(() => /425 vertices/.test(document.querySelector('.ai-chips')?.textContent));
    assert.equal(fs.readdirSync(path.join(profile, 'ai')).filter(x => x.startsWith('workspace-')).length, 0);
    assert.equal(digest(fs.readFileSync(fixture)), before);
    assert.equal(await toggle.getAttribute('aria-checked'), 'false', 'Yes only enables the current request');
    assert.equal(await page.getByRole('group', { name: 'JavaScript workspace' }).count(), 2, 'one offer per job');
    await prompt('Workspace off again: check tools.', 'Workspace unavailable 2.');
    console.log('PASS: toggle off/on/off, 3373 marked -> 425 helmet vertices, 649 isolated faces, out-of-selection rejected, same tab/revision, source bytes preserved, scratch removed.');
  } finally {
    server.closeAllConnections(); server.close();
    if (app) await closeApp(app);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
