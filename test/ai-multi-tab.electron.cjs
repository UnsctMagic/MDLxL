// Three independent direct chats through the packaged UI, on scripts/hidden-run.ps1.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-multi-tab');
const checks = [];
let app, server, release;
const check = (name, value) => { checks.push({name, passed:!!value}); assert.ok(value,name); console.log('PASS '+name); };
(async () => {
  fs.mkdirSync(out,{recursive:true});
  const run = fs.mkdtempSync(path.join(out,'run-')), profile = path.join(run,'profile');
  const ai = path.join(profile,'ai'); fs.mkdirSync(ai,{recursive:true});
  const names = ['First.mdx','Second.mdx','Third.mdx'], values = [101,202,303];
  const files = names.map(name => path.join(run,name));
  for (const file of files) fs.copyFileSync(fixturePath('footman'),file);
  let allStarted; const ready = new Promise(resolve => allStarted=resolve);
  const gate = new Promise(resolve => release=resolve), initial = new Set(), requests = [];
  server = http.createServer(async (req,res) => {
    let raw=''; for await (const part of req) raw+=part;
    if(req.url.endsWith('/models')) { res.writeHead(200,{'content-type':'application/json'}); res.end('{"data":[{"id":"fixture-model"}]}'); return; }
    const data=JSON.parse(raw); requests.push(data);
    const text=data.messages.find(m=>m.role==='user')?.content;
    const prompt=typeof text==='string'?text:text?.find(p=>p.type==='text')?.text;
    const index=Number(prompt.match(/Set model (\d) vertex/)[1])-1;
    const context=JSON.parse(prompt.split(/MDLxL context captured when this prompt was sent[^\n]*:\n/)[1].split('\n')[0]);
    const tools=data.messages.filter(m=>m.role==='tool'), n=tools.length;
    const call=(name,args)=>({delta:{tool_calls:[{index:0,id:'step-'+n,function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'});
    let answer;
    if (!n) { initial.add(index); if(initial.size===3)allStarted(); await gate; answer=call('mdlxl_patch',{target:context.target,label:'Set vertex '+(index+1),scope:['/Geosets/0/Vertices'],operations:[{op:'set',path:'/Geosets/0/Vertices/0',value:values[index]}]}); }
    else if(n===1) answer=call('mdlxl_review',{target:context.target,action:'inspect',checksCode:'return [{name:"Requested vertex only",passed:model.Geosets[0].Vertices[0]==='+values[index]+' && model.Geosets[0].Vertices.slice(1).every((v,i)=>v===before.Geosets[0].Vertices[i+1])}];'});
    else if(n===2) answer=call('mdlxl_review',{target:context.target,action:'finish',outcome:'passed',summary:'Vertex '+(index+1)+' verified.'});
    else answer={delta:{content:'Finished model '+(index+1)+'.'},finish_reason:'stop'};
    res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[answer]})+'\n\n');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  fs.writeFileSync(path.join(ai,'connections.json'),JSON.stringify({provider:'compatible',outsideCheck:false,providers:{compatible:{model:'fixture-model',baseUrl:'http://127.0.0.1:'+server.address().port+'/v1'}}}));
  try {
    const launched=await launchApp({out:run,profile,args:files,env:{MDLXL_DISABLE_UPDATES:'1',MDLVIS_HEADLESS:''}});
    app=launched.app; const {page,errors}=launched;
    await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setContentSize(1440,900);});
    await page.getByRole('button',{name:'AI assistant',exact:true}).click();
    const show=async name=>{await page.getByRole('tab',{name,exact:true}).click();await page.waitForFunction(()=>{const p=document.querySelector('[aria-label="AI prompt"]');return p&&!p.disabled;});};
    await show(names[0]);
    check('Offload switch and bird roster are absent',await page.getByRole('switch',{name:'Offload Mode',exact:true}).count()===0 && await page.locator('.ai-roster').count()===0);
    await page.getByRole('button',{name:'Connection settings',exact:true}).click();
    check('routing and lighter-model settings are absent',await page.getByLabel('Job routing',{exact:true}).count()===0 && await page.getByLabel('Lighter model',{exact:true}).count()===0 && await page.getByText('Allow lighter models for simple jobs',{exact:true}).count()===0);
    await page.getByRole('button',{name:'Connection settings',exact:true}).click();
    for (const name of ['Editing handbook','Web research']) {
      const button=page.getByRole('switch',{name,exact:true}); await button.click();
      await page.waitForFunction(label=>document.querySelector('[role="switch"][aria-label="'+label+'"]')?.getAttribute('aria-checked')==='true',name);
      check(name+' switch still turns on',await button.getAttribute('aria-checked')==='true');await button.click();
      await page.waitForFunction(label=>document.querySelector('[role="switch"][aria-label="'+label+'"]')?.getAttribute('aria-checked')==='false',name);
    }
    let peak=0; const chatIds=[];const originals=[];
    for (const [index,name] of names.entries()) {
      await show(name);originals.push(await page.evaluate(()=>Array.from(window.__mdlxl.model().Geosets[0].Vertices)));
      await page.getByLabel('AI prompt',{exact:true}).fill('Set model '+(index+1)+' vertex to '+values[index]);
      await page.getByRole('button',{name:'Send',exact:true}).click();
      await page.waitForFunction(count=>window.desktop.aiStatus().then(s=>s.running.length===count),index+1);
      const status=await page.evaluate(()=>window.desktop.aiStatus());peak=Math.max(peak,status.running.length);
      chatIds.push(status.running.find(r=>!chatIds.includes(r.id))?.id);
    }
    await Promise.race([ready, new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Three provider jobs did not start')),30000);timer.unref();})]);
    check('three model jobs run simultaneously; aiStatus running peaks at 3',peak===3 && initial.size===3 && new Set(chatIds).size===3);
    release();
    await page.waitForFunction(()=>window.desktop.aiStatus().then(s=>s.running.length===0),null,{timeout:90000});
    check('hidden-tab jobs finish while Third remains on screen',await page.getByRole('tab',{name:names[2],exact:true}).getAttribute('aria-selected')==='true');
    for(const [index,name] of names.entries()) {
      await show(name);await page.getByText('Finished model '+(index+1)+'.',{exact:true}).waitFor();
      const vertices=await page.evaluate(()=>Array.from(window.__mdlxl.model().Geosets[0].Vertices));
      check(name+' receives only its own edit',vertices[0]===values[index] && vertices.slice(1).every((v,i)=>v===originals[index][i+1]));
      check(name+' shows only its own chat',!(await page.locator('.ai-messages').innerText()).includes('Finished model '+((index+1)%3+1)+'.'));
    }
    await page.getByRole('button',{name:'New chat',exact:true}).click();
    await page.getByLabel('Earlier chat',{exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('.ai-messages')?.textContent.includes('Finished model 3.'));
    check('New chat clears the thread',await page.getByLabel('AI prompt',{exact:true}).isEnabled());
    const selector=page.getByLabel('Earlier chat',{exact:true});await selector.selectOption({label:'Earlier chat 1'});
    await page.getByText('Finished model 3.',{exact:true}).waitFor();
    check('Earlier chat stays readable and read only',await page.getByLabel('AI prompt',{exact:true}).isDisabled());
    await selector.selectOption({label:'Current chat'});
    await page.waitForFunction(()=>!document.querySelector('[aria-label="AI prompt"]').disabled);
    check('Current chat remains usable',await page.getByLabel('AI prompt',{exact:true}).isEnabled());
    check('no renderer errors',errors.length===0);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({peak,checks,providerCalls:requests.length,errors},null,2));
  } finally {
    release();if(app)await closeApp(app);app=null;
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
    assert.equal(path.dirname(run),out);fs.rmSync(run,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);fs.writeFileSync(path.join(out,'failure.txt'),error.stack);process.exitCode=1;});
