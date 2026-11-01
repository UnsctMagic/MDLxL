// Delayed IPC fixture in the real package; no external AI account or model service.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const output=path.join(root,'out/ai-organiser-refresh');fs.mkdirSync(output,{recursive:true});
 const run=fs.mkdtempSync(path.join(output,'run-'));let app;
 try{
  const {createStarterDocument}=await import('../src/starter-model.js');const bytes=createStarterDocument().serialize('mdx');
  for(const name of ['A.mdx','B.mdx','Donor.mdx'])fs.writeFileSync(path.join(run,name),bytes);
  const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXZkAAAAASUVORK5CYII=';
  fs.writeFileSync(path.join(run,'Picture.png'),Buffer.from(image,'base64'));
  const launched = await launchApp({ args: ['A.mdx', 'B.mdx'].map(n => path.join(run, n)), out: run, env: { MDLVIS_HEADLESS: '' }, timeout: 30000, pageTimeout: 15000 });
  app = launched.app;
  const { page, errors } = launched;
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1440,900);});
  await page.getByRole('button',{name:'AI assistant',exact:true}).click();
  if(!await page.getByLabel('AI provider',{exact:true}).isVisible())await page.getByRole('button',{name:'Connection settings',exact:true}).click();
  await page.getByLabel('AI provider',{exact:true}).selectOption('compatible');
  await page.getByLabel('API base URL',{exact:true}).fill('http://127.0.0.1:9/v1');
  await page.getByLabel('Model',{exact:true}).fill('fixture-model');
  await page.getByRole('button',{name:'Save connection',exact:true}).click();
  await page.getByRole('button',{name:'Connection settings',exact:true}).click();
  const show=async name=>{await page.getByRole('tab',{name,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[aria-label="AI prompt"]').disabled);};
  await show('B.mdx');await page.getByLabel('AI prompt',{exact:true}).fill('Preserve B draft');
  await show('A.mdx');
  await page.locator('.ai-assistant input[type=file]').setInputFiles(['Donor.mdx','Picture.png'].map(n=>path.join(run,n)));
  await page.getByRole('button',{name:'Remove reference Donor.mdx',exact:true}).waitFor();
  await page.locator('.ai-image-chip img').waitFor();
  await page.getByLabel('AI prompt',{exact:true}).fill('Improve A with this donor');
  await app.evaluate(({ipcMain})=>{
   const handler=ipcMain._invokeHandlers.get('ai:organiser'),fresh=ipcMain._invokeHandlers.get('ai:newOrganiser');let once=true;
   ipcMain.removeHandler('ai:organiser');
   ipcMain.handle('ai:organiser',async(...args)=>{
    if(once){once=false;global.refreshStarted=true;await new Promise(r=>global.releaseRefresh=r);return fresh(...args);}
    return handler(...args);
   });
   ipcMain.removeHandler('ai:send');
   ipcMain.handle('ai:send',(_,input)=>{global.sentRefresh=input;return {ok:false,authRequired:true,error:'Fixture account requires sign-in.'};});
  });
  await page.getByRole('button',{name:'Send',exact:true}).click();
  for(const end=Date.now()+15000;!await app.evaluate(()=>!!global.refreshStarted);){if(Date.now()>end)throw Error('Refresh did not begin');await new Promise(r=>setTimeout(r,30));}
  await show('B.mdx');await app.evaluate(()=>releaseRefresh());
  for(const end=Date.now()+15000;!await app.evaluate(()=>!!global.sentRefresh);){if(Date.now()>end)throw Error('Send did not reach the fresh organiser');await new Promise(r=>setTimeout(r,30));}
  // The sign-in refusal opens settings after the asynchronous send returns.
  await page.getByLabel('AI provider',{exact:true}).waitFor();
  await page.waitForFunction(()=>{const provider=document.querySelector('[aria-label="AI provider"]');return provider&&!provider.disabled;});
  assert(await page.getByLabel('AI provider',{exact:true}).isEnabled(),'the old sending indicator clears after switching tabs');
  await page.getByRole('button',{name:'Connection settings',exact:true}).click();
  assert.equal(await page.getByLabel('AI prompt',{exact:true}).inputValue(),'Preserve B draft');
  await show('A.mdx');
  assert.equal(await page.getByLabel('AI prompt',{exact:true}).inputValue(),'Improve A with this donor','signed-out prompt restores into the replacement chat');
  assert.equal(await page.locator('.ai-image-chip img').getAttribute('alt'),'Picture.png');
  await page.getByRole('button',{name:'Remove reference Donor.mdx',exact:true}).waitFor();
  const sent=await app.evaluate(()=>sentRefresh);
  assert.deepEqual(sent.context.documents.map(d=>d.name),['A.mdx','Donor.mdx']);assert.equal(sent.images.length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS packaged organiser replacement: tab switch clears busy state, B draft preserved, A prompt/image/model reference follow the fresh chat after a sign-in refusal');
 }finally{
  if (app) await closeApp(app);
  if(path.dirname(run)!==output)throw Error('Unexpected test directory');fs.rmSync(run,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
