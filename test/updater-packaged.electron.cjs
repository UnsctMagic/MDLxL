// End-to-end update/revert/restart using disposable real portable executables.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const run=promisify(execFile);
const { chromium }=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const {MANIFEST,digest}=require('../electron/updater.cjs');
const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const root=path.resolve(__dirname,'..'),output=process.env.MDLXL_TEST_OUTPUT||path.join(root,'out/updater-live');
let ownedBrowser;
async function waitFor(check,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){const value=await check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,200));}throw Error('Timed out waiting for updater lifecycle.');}
(async()=>{
  await fs.mkdir(output,{recursive:true});const fixture=await fs.mkdtemp(path.join(output,'run-'));
  const target=path.join(fixture,'installed'),future=path.join(fixture,'future'),source=path.join(future,'MDLxL-win32-x64');
  await fs.cp(process.env.MDLXL_TEST_PACKAGE||path.join(root,'out/updater-package/MDLxL-win32-x64'),target,{recursive:true});
  // Only these disposable fixture copies expose a debug port after the restart.
  const entry=path.join(target,'resources/app/electron/main.cjs');await fs.writeFile(entry,`require('electron').app.commandLine.appendSwitch('remote-debugging-port','0');
require('electron').dialog.showMessageBox=async()=>({response:0});require('electron').dialog.showMessageBoxSync=()=>2;
require('electron').app.on('browser-window-created',(_,win)=>win.webContents.on('ipc-message',(_,channel)=>{if(channel==='updates:startup')win.webContents.send('menu','settings');}));
require('./updater.cjs').Updater.prototype.response=async function(url){
 const fs=require('node:fs/promises'),path=require('node:path'),fixture=path.resolve(__dirname,'../../../..');
 if(url.includes('api.github.com'))return new Response(await fs.readFile(path.join(fixture,'release.json')));
 if(url.endsWith('.zip'))return new Response(await fs.readFile(path.join(fixture,'future.zip')));
 return new Response('- Verified portable update.');
};
`+await fs.readFile(entry,'utf8'));
  const baseline=JSON.parse(await fs.readFile(path.join(target,MANIFEST),'utf8'));baseline.files['resources/app/electron/main.cjs']=await digest(entry);await fs.writeFile(path.join(target,MANIFEST),JSON.stringify(baseline));
  await fs.cp(target,source,{recursive:true});
  const current=JSON.parse(await fs.readFile(path.join(target,'resources/app/package.json'),'utf8')).version;
  const version=current.split('.').map((part,index)=>index===2?Number(part)+1:part).join('.'), info=JSON.parse(await fs.readFile(path.join(source,'resources/app/package.json'),'utf8'));info.version=version;await fs.writeFile(path.join(source,'resources/app/package.json'),JSON.stringify(info));
  const manifest=JSON.parse(await fs.readFile(path.join(source,MANIFEST),'utf8'));manifest.version=version;manifest.files['resources/app/package.json']=await digest(path.join(source,'resources/app/package.json'));await fs.writeFile(path.join(source,MANIFEST),JSON.stringify(manifest));
  const profile=path.join(target,'resources/app/profile');await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({preferences:{checkUpdatesOnStartup:false}}));await fs.writeFile(path.join(profile,'personal-save.mdx'),'immutable personal model');
  const archive=path.join(fixture,'future.zip'),zipper=path.join(fixture,'zip.ps1');
  await fs.writeFile(zipper,'param($Source,$Archive)\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\n[IO.Compression.ZipFile]::CreateFromDirectory($Source,$Archive,[IO.Compression.CompressionLevel]::Fastest,$false)\n');
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',zipper,future,archive],{windowsHide:true});
  const release={tag_name:'v'+version,html_url:'https://github.com/UnsctMagic/MDLxL/releases/tag/v'+version,body:'- Verified portable update.',assets:[{name:`MDLxL-${version}-win32-x64.zip`,size:(await fs.stat(archive)).size,digest:'sha256:'+await digest(archive),browser_download_url:`https://github.com/UnsctMagic/MDLxL/releases/download/v${version}/MDLxL-${version}-win32-x64.zip`}]};
  await fs.writeFile(path.join(fixture,'release.json'),JSON.stringify(release));
  const launcher=path.join(fixture,'launch.ps1');await fs.writeFile(launcher,'param($Executable,$Directory)\nStart-Process -FilePath $Executable -WorkingDirectory $Directory -WindowStyle Hidden\n');
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,path.join(target,'MDLxL.exe'),target],{windowsHide:true,env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile}});
  async function connect(){const port=await waitFor(async()=>{try{const port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const response=await fetch('http://127.0.0.1:'+port+'/json/version');return response.ok?port:false;}catch{return false;}});return chromium.connectOverCDP('http://127.0.0.1:'+port);}
  const initialBrowser=await connect();ownedBrowser=initialBrowser;const initial=await waitFor(()=>initialBrowser.contexts()[0]?.pages()[0]);initial.setDefaultTimeout(15000);await initial.waitForFunction(()=>!!document.querySelector('.classic-app canvas'));
  assert.equal((await initial.evaluate(()=>window.desktop.updateStatus())).currentVersion,current);
  await initial.locator('[data-warmkey="updates:check"]').dispatchEvent('click');await initial.locator('[data-warmkey="update:install"]').waitFor();
  const updating=initial.waitForEvent('close');await initial.locator('[data-warmkey="update:install"]').dispatchEvent('click');
  await updating;await waitFor(async()=>JSON.parse(await fs.readFile(path.join(target,'resources/app/package.json'),'utf8')).version===version);
  await initialBrowser.close();ownedBrowser=null;
  const updatedBrowser=await connect();ownedBrowser=updatedBrowser;const page=await waitFor(()=>updatedBrowser.contexts()[0]?.pages()[0]);await page.waitForFunction(()=>!!window.desktop?.updateStatus);
  const status=await waitFor(async()=>{const value=await page.evaluate(()=>window.desktop.updateStatus());return value.currentVersion===version?value:false;});
  assert.equal(status.previousVersion,current);assert.equal(status.canInstall,true);
  await page.locator('.settings-window').waitFor();assert.equal(await page.locator('[data-warmkey="updates:revert"]').isEnabled(),true);
  const closing=page.waitForEvent('close');
  await page.locator('[data-warmkey="updates:revert"]').dispatchEvent('click');
  await closing;
  // Do not send Browser.close during MDLxL's asynchronous shutdown.
  await waitFor(async()=>JSON.parse(await fs.readFile(path.join(target,'resources/app/package.json'),'utf8')).version===current);
  await updatedBrowser.close();ownedBrowser=null;
  await waitFor(async()=>{try{return (await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim();}catch{return false;}});
  const browser=await connect();ownedBrowser=browser;const restarted=await waitFor(()=>browser.contexts()[0]?.pages()[0]);
  await restarted.waitForFunction(()=>!!window.desktop?.updateStatus);const restored=await waitFor(async()=>{try{const value=await restarted.evaluate(()=>window.desktop.updateStatus());return value.currentVersion===current?value:false;}catch{return false;}});
  assert.equal(restored.previousVersion,undefined);assert.equal(await fs.readFile(path.join(profile,'personal-save.mdx'),'utf8'),'immutable personal model');
  await restarted.evaluate(()=>{window.desktop.setDirty({dirty:false,saved:true});window.desktop.close();});await browser.close();ownedBrowser=null;
  console.log('PASS real portable executable update, one-version retention, offline revert, and restarted version '+current);
})().catch(async error=>{console.error(error);if(ownedBrowser){try{for(const page of ownedBrowser.contexts()[0].pages())await page.evaluate(()=>{window.desktop.setDirty({dirty:false,saved:true});window.desktop.close();});await ownedBrowser.close();}catch{}}process.exitCode=1;});
