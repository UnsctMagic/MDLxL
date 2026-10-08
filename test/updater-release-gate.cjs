// Full-release acceptance harness. No packaged program file or installer is instrumented.
// Only Updater.fetcher is routed in memory to this loopback HTTP fixture. Production
// response handling, streaming, ZIP digest, extraction, manifest, plan, save prompt,
// Windows install and restart execute unchanged. Inspector is detached before Close.
const fs=require('node:fs/promises'),nativefs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util'),run=promisify(execFile);
const {digest,MANIFEST,extractArchive,listFiles}=require('../electron/updater.cjs');
const base=process.env.MDLXL_GATE_ROOT||'D:/MDLxL-updater-tests/gate-0.21.1';
const candidate=process.env.MDLXL_GATE_PACKAGE||'D:/MDLxL-updater-tests/release-0.21.1-candidate/MDLxL-win32-x64';
const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let activeVersion='0.21.2',client,sequence=0,events=[],config;
async function log(type,data={}){const event={at:new Date().toISOString(),type,...data};events.push(event);await fs.appendFile(path.join(base,'events.jsonl'),JSON.stringify(event)+'\n');console.log(type,JSON.stringify(data));}
async function script(name,body,args=[]){const p=path.join(base,name+'.ps1');await fs.writeFile(p,body);return run(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',p,...args],{windowsHide:true});}
async function zip(source,out){await script('zip',"param($Source,$Archive)\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\n[IO.Compression.ZipFile]::CreateFromDirectory($Source,$Archive,[IO.Compression.CompressionLevel]::Optimal,$false)\n",[source,out]);}
async function manifestCheck(root){const m=JSON.parse(await fs.readFile(path.join(root,MANIFEST),'utf8'));for(const [file,hash]of Object.entries(m.files))if(!/^(Addons|Backgrounds|BitsAndParts|Textures)\//.test(file))assert.equal(await digest(path.join(root,file)),hash,file);return m.version;}
async function prepare(){
 await fs.mkdir(base,{recursive:true});await fs.mkdir(path.join(base,'temp'),{recursive:true});
 const version=JSON.parse(await fs.readFile(path.join(candidate,'resources/app/package.json'),'utf8')).version;assert.equal(version,'0.21.1');
 config={candidate,version,base,target:path.join(base,'installed/MDLxL-win32-x64'),packages:{}};
 const shipped=path.join(base,'MDLxL-0.21.1-win32-x64.zip');await zip(path.dirname(candidate),shipped);
 config.shippingZip=shipped;config.shippingSha256=await digest(shipped);
 await fs.writeFile(shipped+'.sha256',config.shippingSha256+'  '+path.basename(shipped)+'\n');
 await fs.mkdir(path.join(base,'installed'));await extractArchive(shipped,path.join(base,'installed'));
 assert.equal(await manifestCheck(config.target),version);
 for(const [label,v]of [['A','0.21.2'],['B','0.21.3']]){
   const source=path.join(base,label,'MDLxL-win32-x64');await fs.cp(candidate,source,{recursive:true});
   const pkg=path.join(source,'resources/app/package.json'),info=JSON.parse(await fs.readFile(pkg,'utf8'));info.version=v;await fs.writeFile(pkg,JSON.stringify(info,null,2)+'\n');
   await fs.appendFile(path.join(source,'MDLxL.exe'),'\nPrivate acceptance update '+label+'\n');
   const m=JSON.parse(await fs.readFile(path.join(source,MANIFEST),'utf8'));m.version=v;
   for(const relative of ['MDLxL.exe','resources/app/package.json'])m.files[relative]=await digest(path.join(source,relative));
   await fs.writeFile(path.join(source,MANIFEST),JSON.stringify(m,null,2)+'\n');
   const archive=path.join(base,`MDLxL-${v}-win32-x64.zip`);await zip(path.dirname(source),archive);
   config.packages[v]={archive,sha256:await digest(archive),size:(await fs.stat(archive)).size,exeHash:m.files['MDLxL.exe']};
 }
 config.profile=path.join(config.target,'resources/app/profile');await fs.mkdir(config.profile,{recursive:true});
 await fs.writeFile(path.join(config.profile,'settings.json'),JSON.stringify({preferences:{language:'en',checkUpdatesOnStartup:false}}));
 const personal=['resources/app/profile/private/model.mdx','resources/app/profile/private/history.json','resources/app/profile/private/setting.bin','Addons/personal.json','Backgrounds/personal.png','BitsAndParts/personal.mdx','Textures/personal.blp','Showcase Recordings/personal.gif','My Saved Model.mdl','resources/app/user-added.dat'];
 config.personal={};
 for(const file of personal){const p=path.join(config.target,file);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,'unchanged personal bytes: '+file);config.personal[file]=await digest(p);}
 const shippedAddon=(await listFiles(path.join(config.target,'Addons'))).find(x=>x.endsWith('.mdx'));
 if(shippedAddon){const rel='Addons/'+shippedAddon;await fs.appendFile(path.join(config.target,rel),'personal override');config.personal[rel]=await digest(path.join(config.target,rel));}
 await fs.writeFile(path.join(base,'config.json'),JSON.stringify(config,null,2));
 await log('assembled',{shippingSha256:config.shippingSha256,zipBytes:(await fs.stat(shipped)).size,packages:config.packages});
}
async function processes(){const result=await script('processes',"param($Exe)\n@(Get-CimInstance Win32_Process -Filter \"Name='MDLxL.exe'\" | Where-Object { $_.ExecutablePath -eq $Exe -and $_.CommandLine -notmatch '--type=' } | Select-Object ProcessId,ParentProcessId,CommandLine,CreationDate) | ConvertTo-Json -Compress\n",[path.join(config.target,'MDLxL.exe')]);return JSON.parse(result.stdout||'[]');}
class Inspector{
 constructor(ws){this.ws=ws;this.pending=new Map();ws.onmessage=e=>{const data=JSON.parse(e.data);if(data.id){const p=this.pending.get(data.id);this.pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result);}};}
 async eval(expression){const id=++sequence;const answer=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));const result=await answer;if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
 close(){this.ws.close();}
}
async function attach(){
 if(client)return;const p=await processes(),all=Array.isArray(p)?p:[p];assert.equal(all.length,1,'exactly one running test main process');const pid=all[0].ProcessId;
 process._debugProcess(pid);let entries;
 for(let i=0;i<80;i++){try{entries=await(await fetch('http://127.0.0.1:9229/json/list')).json();if(entries.length)break;}catch{}await wait(100);}
 const ws=new WebSocket(entries[0].webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});client=new Inspector(ws);
 const actual=await client.eval('({pid:process.pid,exe:process.execPath,version:process.mainModule.require("electron").app.getVersion()})');assert.equal(actual.pid,pid);assert.equal(path.resolve(actual.exe),path.resolve(config.target,'MDLxL.exe'));
 await log('attached',actual);
 // Change transport only, on the actual instance when its existing response method runs.
 await client.eval(`(()=>{const Updater=process.mainModule.require('./updater.cjs').Updater,original=Updater.prototype.response,network=globalThis.fetch;Updater.prototype.response=function(url,...args){this.fetcher=(address,options)=>network('http://127.0.0.1:18761/network?url='+encodeURIComponent(address),options);return original.call(this,url,...args);};return true;})()`);
}
async function renderer(expression){await attach();return client.eval(`process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()).webContents.executeJavaScript(${JSON.stringify(expression)})`);}
async function launch(){await script('launch',"param($Exe,$Directory,$Profile,$Temp)\n$env:MDLXL_PROFILE=$Profile\n$env:TEMP=$Temp\n$env:TMP=$Temp\nStart-Process -FilePath $Exe -WorkingDirectory $Directory -WindowStyle Hidden\n",[path.join(config.target,'MDLxL.exe'),config.target,config.profile,path.join(base,'temp')]);}
async function verify(){const runtime=await renderer('window.desktop.updateStatus()');const disk=await manifestCheck(config.target);assert.equal(runtime.currentVersion,disk);for(const [file,hash]of Object.entries(config.personal))assert.equal(await digest(path.join(config.target,file)),hash,file);const snapshot=JSON.parse(await fs.readFile(path.join(config.target,'.mdlxl-previous/snapshot.json'),'utf8'));for(const [file,hash]of Object.entries(snapshot.files))assert.equal(await digest(path.join(config.target,'.mdlxl-previous',file)),hash,file);assert.equal(await renderer('document.querySelectorAll(".classic-app canvas").length>0'),true);await log('verified',{runtime,disk,snapshot:snapshot.version,exeHash:await digest(path.join(config.target,'MDLxL.exe')),personalFiles:Object.keys(config.personal).length});return {runtime,disk,snapshot:snapshot.version};}
async function server(){config=JSON.parse(await fs.readFile(path.join(base,'config.json'),'utf8'));
 const service=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/network'){
  const source=new URL(url.searchParams.get('url')),p=config.packages[activeVersion];await log('request',{url:source.href});
  if(source.hostname==='api.github.com'&&source.pathname.endsWith('/releases/latest')){res.setHeader('content-type','application/json');res.end(JSON.stringify({tag_name:'v'+activeVersion,name:'Private acceptance update',html_url:'https://github.com/UnsctMagic/MDLxL/releases/tag/v'+activeVersion,body:'- Private full-package acceptance update.',assets:[{name:`MDLxL-${activeVersion}-win32-x64.zip`,size:p.size,digest:'sha256:'+p.sha256,browser_download_url:`https://github.com/UnsctMagic/MDLxL/releases/download/v${activeVersion}/MDLxL-${activeVersion}-win32-x64.zip`}]}));}
  else if(source.hostname==='github.com'&&source.pathname.endsWith('.zip')){res.setHeader('content-type','application/zip');res.setHeader('content-length',p.size);let count=0;for await(const bytes of nativefs.createReadStream(p.archive,{highWaterMark:256*1024})){res.write(bytes);count+=bytes.length;await wait(12);}res.end();await log('zip-served',{version:activeVersion,bytes:count,sha256:p.sha256});}
  else{res.statusCode=404;res.end('Unexpected fixture route');}return;
 }
 let data='';for await(const chunk of req)data+=chunk;const request=JSON.parse(data||'{}');let result;
 switch(request.action){
 case 'launch':await launch();result=true;break;
 case 'attach':await attach();result=true;break;
 case 'detach':if(client)client.close();client=null;result=true;break;
 case 'offer':activeVersion=request.version;result=activeVersion;break;
 case 'renderer':result=await renderer(request.expression);break;
 case 'main':await attach();result=await client.eval(request.expression);break;
 case 'verify':result=await verify();break;
 case 'processes':result=await processes();break;
 default:throw Error('Unknown test action');}
 res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,result}));
 }catch(error){res.statusCode=500;res.end(JSON.stringify({ok:false,error:error.stack}));}});
 service.listen(18761,'127.0.0.1',()=>console.log('Gate test service listening on 127.0.0.1:18761'));
}
(process.argv[2]==='prepare'?prepare():server()).catch(error=>{console.error(error);process.exitCode=1;});
