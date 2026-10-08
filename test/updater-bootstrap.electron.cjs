// Test the repair-first online path with the unchanged 0.20.1 updater and helper.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {execFile}=require('node:child_process'),{promisify}=require('node:util'),run=promisify(execFile);
const {chromium}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const {digest,MANIFEST}=require('../electron/updater.cjs');
const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(check,timeout=60000){const end=Date.now()+timeout;while(Date.now()<end){const result=await check();if(result)return result;await pause(100);}throw Error('Timed out waiting for the repair/update lifecycle.');}
(async()=>{
 const build=JSON.parse(await fs.readFile(process.env.MDLXL_BOOTSTRAP_BUILD,'utf8'));
 const root=await fs.mkdtemp(path.join(path.dirname(build.zip),'test-')),target=path.join(root,'installed'),repair=path.join(root,'repair/MDLxL-win32-x64'),full=path.join(root,'full/MDLxL-win32-x64');
 await fs.cp(build.previousRoot,target,{recursive:true});await fs.cp(build.packageRoot,repair,{recursive:true});
 await fs.cp(process.env.MDLXL_TEST_FULL_PACKAGE,full,{recursive:true});
 const fullInfo=JSON.parse(await fs.readFile(path.join(full,'resources/app/package.json'),'utf8'));fullInfo.version='0.21.1';await fs.writeFile(path.join(full,'resources/app/package.json'),JSON.stringify(fullInfo));
 await fs.copyFile(path.resolve('electron/update-install.ps1'),path.join(full,'resources/app/electron/update-install.ps1'));
 const profile=path.join(target,'resources/app/profile');await fs.mkdir(profile,{recursive:true});
 await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({preferences:{checkUpdatesOnStartup:true}}));
 const personal=['resources/app/profile/personal-save.mdx','Addons/mine.json','Backgrounds/mine.png','BitsAndParts/mine.mdx','Showcase Recordings/mine.gif'];
 for(const name of personal){await fs.mkdir(path.dirname(path.join(target,name)),{recursive:true});await fs.writeFile(path.join(target,name),'personal data: '+name);}
 const before=Object.fromEntries(await Promise.all(personal.map(async name=>[name,await digest(path.join(target,name))])));
 const oldHelper=await digest(path.join(target,'resources/app/electron/update-install.ps1'));
 const originalExe=await digest(path.join(target,'MDLxL.exe'));
 const prefix=`require('electron').app.commandLine.appendSwitch('remote-debugging-port','0');
require('electron').dialog.showMessageBox=async()=>({response:0});
require('electron').dialog.showMessageBoxSync=()=>2;
require('electron').app.on('browser-window-created',(_,win)=>win.webContents.on('ipc-message',(_,channel)=>{if(channel==='updates:startup')win.webContents.send('menu','settings');}));
require('./updater.cjs').Updater.prototype.response=async function(url){
const fs=require('node:fs/promises'),p=require('node:path'),root=${JSON.stringify(root)};
if(url.includes('api.github.com'))return new Response(await fs.readFile(p.join(root,'release.json')));
if(url.endsWith('.zip'))return new Response(await fs.readFile(p.join(root,'download.zip')));
return new Response('- Updater repair.');};
const originalPrepare=require('./updater.cjs').Updater.prototype.prepare;
require('./updater.cjs').Updater.prototype.prepare=async function(){const result=await originalPrepare.call(this);if(result.state==='ready'){const fs=require('node:fs/promises'),p=require('node:path'),crypto=require('node:crypto');await fs.writeFile(${JSON.stringify(path.join(root,'prepared.json'))},JSON.stringify({version:this.currentVersion,helper:crypto.createHash('sha256').update(await fs.readFile(p.join(this.prepared.stage,'install.ps1'))).digest('hex'),plan:JSON.parse(await fs.readFile(this.prepared.planFile,'utf8'))}));}return result;};
`;
 for(const packageRoot of [target,repair,full]){
  const entry=path.join(packageRoot,'resources/app/electron/main.cjs');await fs.writeFile(entry,prefix+await fs.readFile(entry,'utf8'));
  const manifest=JSON.parse(await fs.readFile(path.join(packageRoot,MANIFEST),'utf8'));
  manifest.version=JSON.parse(await fs.readFile(path.join(packageRoot,'resources/app/package.json'),'utf8')).version;
  for(const file of ['resources/app/electron/main.cjs','resources/app/electron/update-install.ps1','resources/app/package.json'])manifest.files[file]=await digest(path.join(packageRoot,file));
  await fs.writeFile(path.join(packageRoot,MANIFEST),JSON.stringify(manifest));
 }
 assert.equal(await digest(path.join(target,'resources/app/electron/update-install.ps1')),oldHelper);
 const zipper=path.join(root,'zip.ps1');await fs.writeFile(zipper,"param($Source,$Archive)\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\n[IO.Compression.ZipFile]::CreateFromDirectory($Source,$Archive,[IO.Compression.CompressionLevel]::Fastest,$false)\n");
 async function offer(packageRoot,version){
  const zip=path.join(root,version+'.zip');await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',zipper,path.dirname(packageRoot),zip],{windowsHide:true});
  await fs.copyFile(zip,path.join(root,'download.zip'));
  await fs.writeFile(path.join(root,'release.json'),JSON.stringify({tag_name:'v'+version,name:'Updater repair',html_url:'https://github.com/UnsctMagic/MDLxL/releases/tag/v'+version,body:'- Updater repair.',assets:[{name:`MDLxL-${version}-win32-x64.zip`,size:(await fs.stat(zip)).size,digest:'sha256:'+await digest(zip),browser_download_url:`https://github.com/UnsctMagic/MDLxL/releases/download/v${version}/MDLxL-${version}-win32-x64.zip`}]}));
 }
 await offer(repair,'0.20.2');
 const launcher=path.join(root,'launch.ps1');await fs.writeFile(launcher,'param($Executable,$Directory)\nStart-Process -FilePath $Executable -WorkingDirectory $Directory -WindowStyle Hidden\n');
 const env={...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile};
 let browser;
 async function connect(version){
  let page;
  await waitFor(async()=>{try{const port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const response=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(1000)});if(!response.ok)return false;browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);page=browser.contexts()[0].pages()[0];await page.waitForFunction(()=>!!window.desktop?.updateStatus);return (await page.evaluate(()=>window.desktop.updateStatus())).currentVersion===version;}catch{return false;}});
  return page;
 }
 try{
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,path.join(target,'MDLxL.exe'),target],{windowsHide:true,env});
  let page=await connect('0.20.1');
  await page.getByRole('button',{name:'Update and restart',exact:true}).click();
  await waitFor(async()=>JSON.parse(await fs.readFile(path.join(target,'resources/app/package.json'),'utf8')).version==='0.20.2');
  const first=JSON.parse(await fs.readFile(path.join(root,'prepared.json'),'utf8'));
  assert.equal(first.helper,oldHelper,'The first installation must use the unchanged old installer');
  assert.ok(!first.plan.operations.some(operation=>operation.relative==='MDLxL.exe'),'Repair must skip EXE replacement');
  page=await connect('0.20.2');await waitFor(async()=>(await page.evaluate(()=>window.desktop.updateStatus())).state==='current');
  assert.equal(await digest(path.join(target,'MDLxL.exe')),originalExe);
  const repairedHelper=await digest(path.join(target,'resources/app/electron/update-install.ps1'));
  assert.equal(repairedHelper,await digest(path.resolve('electron/update-install.ps1')));
  console.log('PASS unchanged 0.20.1 updater downloads and installs repair 0.20.2, skips EXE, restarts and reports current');
  await offer(full,'0.21.1');
  await page.locator('[data-warmkey="updates:check"]').click();
  await page.getByRole('button',{name:'Update and restart',exact:true}).click();
  await waitFor(async()=>JSON.parse(await fs.readFile(path.join(target,'resources/app/package.json'),'utf8')).version==='0.21.1');
  const second=JSON.parse(await fs.readFile(path.join(root,'prepared.json'),'utf8'));
  assert.equal(second.helper,repairedHelper,'Full update uses the repaired installer');
  assert.ok(second.plan.operations.some(operation=>operation.relative==='MDLxL.exe'));
  page=await connect('0.21.1');await waitFor(async()=>(await page.evaluate(()=>window.desktop.updateStatus())).state==='current');
  await page.waitForFunction(()=>!!document.querySelector('.classic-app canvas'));
  assert.equal(await page.locator('[data-warmkey="update:install"]').count(),0);
  for(const [name,hash]of Object.entries(before))assert.equal(await digest(path.join(target,name)),hash,name);
  await fs.writeFile(path.join(root,'proof.json'),JSON.stringify({oldVersion:'0.20.1',repairVersion:'0.20.2',fullVersion:'0.21.1',oldHelper,repairedHelper,firstOperations:first.plan.operations.map(row=>row.relative),personalFiles:personal,passed:true},null,2));
  console.log('PASS repaired 0.20.2 updater installs the full package including EXE, restarts without a repeated prompt, preserves all personal fixtures; '+root);
 }finally{
  const cleanup=path.join(root,'close.ps1');await fs.writeFile(cleanup,"param($Executable)\nGet-Process MDLxL -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $Executable } | Stop-Process\n");
  await run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',cleanup,path.join(target,'MDLxL.exe')],{windowsHide:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
