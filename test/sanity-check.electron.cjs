const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out/sanity-ui');fs.mkdirSync(out,{recursive:true});
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root,path.join(root,'fixtures/demo.mdx')],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
 try {
  const page=await app.firstWindow(); page.setDefaultTimeout(20000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setFocusable(false);w.setSkipTaskbar(true);w.setIgnoreMouseEvents(true);w.setOpacity(0);w.setPosition(-5000,-5000);w.showInactive();});
  await page.locator('.classic-app').waitFor();
  await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(x=>x.label==='Help').submenu.items.find(x=>x.label==='Sanity Check').click());
  const popup=page.getByRole('dialog',{name:'Sanity Check',exact:true});await popup.waitFor();
  await popup.getByText(/structural errors ·/).waitFor();
  assert.ok(await popup.getByText('Advisory findings', {exact:false}).count());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const png=await app.evaluate(async ({BrowserWindow}) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage({}, {stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  fs.writeFileSync(path.join(out,'sanity-check.png'),Buffer.from(png,'base64'));
  await popup.getByRole('button',{name:'Close',exact:true}).click(); await popup.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log('PASS hidden Electron: native Help command opens current-model status, mdx-m3-viewer results render, Close dismisses, no renderer errors.');
 } finally {await app.close();}
})();


