const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');
const out = path.resolve('out/ai-model-merge');
function waitPoint() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function waitForProvider(point) {
  let timer;
  try {
    await Promise.race([point.promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('The fixture provider did not receive the expected turn.')), 35000);
    })]);
  } finally { clearTimeout(timer); }
}

async function run(scenario) {
  const paused = [waitPoint(), waitPoint()], proceed = paused.map(waitPoint);
  let generation = 0, action = 0, failure;
  const server = http.createServer(async (req, res) => {
    if (req.url.endsWith('/models')) { res.end('{"data":[{"id":"fixture"}]}'); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    const text = m => Array.isArray(m.content) ? m.content[0]?.text : m.content;
    let delta;
    try {
      if (!action) { paused[generation].resolve(); await proceed[generation].promise; }
      const prior = data.messages.filter(m => m.role === 'tool').at(-1)?.content;
      if (action && prior && !prior.startsWith('{')) throw Error(prior.slice(0, 500));
      const calls = [
        ['mdlxl_plan', { cause: 'Blend time needs the requested value.', reach: 'Model header only.', keep: ['All user animation properties'], options: [{ fix: 'Edit only BlendTime.', cost: 'One field' }, { fix: 'Rebuild the header', cost: 'Broader' }], choice: 0, why: 'Smallest change', checks: ['Header and animations'] }],
        ['mdlxl_script', { edit: true, label:'Set blend time', scope:['/Info/BlendTime'], code: generation ? 'if (!references["merge:candidate"] || !references["merge:base"]) throw Error("Missing merge inputs"); model.Info.BlendTime = references["merge:candidate"].model.Info.BlendTime;' : 'model.Info.BlendTime = 321;' }],
        ['mdlxl_review', { action:'inspect', checksCode:'return [{ name: "Blend time and authored animations", passed:model.Info.BlendTime===321 && JSON.stringify(model.Sequences)===JSON.stringify(before.Sequences)}];' }],
        ['mdlxl_review', { action:'finish', outcome:'passed', summary:'The candidate preserves the animations and changes the requested blend time.' }],
      ];
      if (action < calls.length) {
        const [name,args] = calls[action++];
        if (name !== 'mdlxl_plan') args.target = [...data.messages.filter(m => m.role === 'user').map(text).join('\n').matchAll(/"target"\s*:\s*"([^"]+)"/g)].at(-1)?.[1];
        delta = { tool_calls: [{ index:0, id:'merge-'+generation+'-'+action, function:{name,arguments:JSON.stringify(args)} }] };
      } else { delta = { content:'Candidate verified.' }; generation++; action=0; }
    } catch(e) { failure=e; console.error(e); delta={content:'Fixture error: '+e.message}; }
    res.writeHead(200,{'content-type':'text/event-stream'});
    res.end('data: '+JSON.stringify({choices:[{delta,finish_reason:delta.tool_calls?'tool_calls':'stop'}]})+'\n\n');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  fs.mkdirSync(out,{recursive:true}); const profile = fs.mkdtempSync(path.join(out,'profile-'));
  fs.mkdirSync(path.join(profile,'ai')); fs.writeFileSync(path.join(profile,'ai/connections.json'),JSON.stringify({provider:'compatible',outsideCheck:false,providers:{compatible:{model:'fixture',baseUrl:'http://127.0.0.1:'+server.address().port+'/v1'}}}));
  let app;
  try {
    const fixture = testModel('WH_WOC_KnightSlaaneshChampion01.mdx');
    const launched = await launchApp({ fixture, out, profile, show: 'inactive' });
    app = launched.app;
    const page = launched.page;
    await page.getByRole('button',{ name: 'AI assistant', exact: true }).click();
    await page.getByLabel('AI prompt').fill('Set blend time to exactly 321. Preserve my animation properties.');
    await page.getByRole('button',{ name: 'Send', exact: true }).click();
    const { openDocument } = await import('../src/editor-document.js');
    const original = openDocument(fs.readFileSync(fixture), path.basename(fixture)).model;
    async function readModel() {
      const bytes = await page.evaluate(() => Array.from(window.__mdlxl.document().serialize('mdx')));
      return openDocument(Uint8Array.from(bytes), 'checked.mdx').model;
    }
    await waitForProvider(paused[0]);
    await page.getByRole('button',{ name: 'Animations', exact: true }).click();
    const rarity = page.getByLabel('Use Rarity',{exact:true});
    const initial = await rarity.isChecked();
    const preview = page.locator('.game-preview-root:visible').first();
    const orientation = () => preview.evaluate(el => window.__mdlxl.preview(el).runtime.controls.object.quaternion.toArray());
    let rotated;
    if (scenario === 'view') {
      const box = await preview.locator('canvas[tabindex]').boundingBox();
      const x = box.x + box.width * 0.7, y = box.y + box.height * 0.6;
      const before = await orientation();
      await page.keyboard.down('Alt');
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 70, y - 24, { steps: 8 });
      await page.mouse.up();
      await page.keyboard.up('Alt');
      rotated = await orientation();
      assert.ok(Math.hypot(...rotated.map((v,i) => v-before[i])) > 0.01, 'normal mouse drag rotated the camera');
    } else await rarity.click();
    proceed[0].resolve();
    const choice = page.getByRole('group',{ name: 'Model changed during the AI job'}).filter({ has: page.getByRole('button',{ name: 'Merge', exact: true })});
    if (scenario === 'view') {
      await page.getByRole('button',{ name: 'Stop', exact: true }).waitFor({ state: 'hidden', timeout: 35000 });
      assert.equal(await choice.count(),0,'navigating to the animation leaves the job running');
      assert.ok(Math.hypot(...(await orientation()).map((v,i) => v-rotated[i])) < 1e-5, 'AI delivery preserves the new viewpoint');
      const saved = await readModel();
      assert.equal(saved.Info.BlendTime,321); assert.deepEqual(saved.Sequences,original.Sequences);
      return;
    }
    await choice.waitFor({ timeout: 35000 }).catch(async error => { console.error((await page.locator('body').innerText()).slice(0,6500)); throw error; });
    assert.ok((await choice.textContent()).includes('Editing during the merge can bring this choice back.'));
    await choice.getByRole('button',{ name: 'Merge', exact: true }).click();
    await waitForProvider(paused[1]);
    if (scenario === 'apply') {
      proceed[1].resolve();
      await page.getByRole('button',{ name: 'Stop', exact: true }).waitFor({ state: 'hidden', timeout: 35000 });
      const merged = await readModel();
      assert.equal(merged.Info.BlendTime,321);
      assert.notDeepEqual(merged.Sequences,original.Sequences,'the animation edit survived');
      await page.keyboard.press('Control+z');
      await page.waitForFunction(blend => window.__mdlxl.model().Info.BlendTime === blend, original.Info.BlendTime);
      const undone = await readModel();
      assert.equal(undone.Info.BlendTime,original.Info.BlendTime);
      assert.deepEqual(undone.Sequences,merged.Sequences);
      return;
    }
    await rarity.click(); proceed[1].resolve(); await choice.waitFor({ timeout: 35000 });
    assert.equal(await rarity.isChecked(),initial);
    await choice.getByRole('button',{ name: 'Open as new model', exact: true }).click();
    await page.getByRole('tab',{ name: /\(AI\)\.mdx$/}).waitFor({ timeout: 20000 });
    const copy = await readModel();
    assert.equal(copy.Info.BlendTime,321);
    assert.notDeepEqual(copy.Sequences,original.Sequences);
    await page.getByRole('tab',{ name: path.basename(fixture), exact: true }).click();
    assert.equal(await rarity.isChecked(),initial,'source retains the second edit');
    assert.equal((await readModel()).Info.BlendTime,original.Info.BlendTime);
  } finally {
    for (const turn of proceed) turn.resolve();
    server.closeAllConnections();
    server.close();
    if (app) await closeApp(app);
    assert.ifError(failure);
  }
}
async function main() {
  for (const scenario of ['repeat', 'apply', 'view']) {
    await run(scenario);
    console.log('PASS',scenario);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
