const { clickMenu } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out/sanity-ui');fs.mkdirSync(out,{recursive:true});
 const { app, page, errors } = await launchApp({ out: out, profile: path.join(out,'profile'), env: { MDLVIS_HEADLESS:'1' }, timeout: 60000, fixture: path.join(root,'test/fixtures/demo.mdx') , pageTimeout: 20000 });
 try {

  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setFocusable(false);w.setSkipTaskbar(true);w.setIgnoreMouseEvents(true);w.setOpacity(0);w.setPosition(-5000,-5000);w.showInactive();});
  await page.locator('.classic-app').waitFor();
  await clickMenu(app, 'Sanity Check');
  const popup=page.getByRole('dialog',{name:'Sanity Check',exact:true});await popup.waitFor();
  await popup.getByText(/structural errors ·/).waitFor();
  assert.ok(await popup.getByText('Advisory findings', {exact:false}).count());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const png=await app.evaluate(async ({BrowserWindow}) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage({}, {stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  fs.writeFileSync(path.join(out,'sanity-check.png'),Buffer.from(png,'base64'));
  await popup.getByRole('button',{name:'Close',exact:true}).click(); await popup.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log('PASS hidden Electron: native Help command opens current-model status, mdx-m3-viewer results render, Close dismisses, no renderer errors.');
 } finally {await closeApp(app);}
})();

