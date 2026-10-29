const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, shell, nativeTheme, utilityProcess } = require('electron');
// Check before loading editor modules: another launch must not read a changing install.
if (app.isPackaged && require('node:fs').existsSync(require('node:path').join(require('node:path').dirname(process.execPath), '.mdlxl-installing'))) {
  app.exit(0);
  return;
}
const APPLICATION_THEMES = require('../src/application-themes.json');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
// Install folder (next to MDLxL.exe when packaged), and whether this is a person's own run rather than a test.
const appFolder=app.isPackaged?path.dirname(process.execPath):app.getAppPath();
const showcaseRecordings=path.join(appFolder,'Showcase Recordings');
const headless=process.env.MDLVIS_HEADLESS==='1';
const userRun=app.isPackaged&&!process.env.MDLXL_PROFILE&&!headless;
const {RecoveryStore}=require('./recovery.cjs');
const {SettingsStore}=require('./settings.cjs');
const {buildMenuTemplate,normalizeMenuChecks}=require('./menu.cjs');
const {GameDataDiscovery,selectedGameDataSources}=require('./game-data.cjs');
const {TextureResolver,IMAGE_EXTENSIONS}=require('./texture-resolver.cjs');
const {CascTextures,CascReader}=require('./casc.cjs');
const {Mpq}=require('./mpq.cjs');
const {ParticleLibrary}=require('./particle-library.cjs');
const {resolveParticleSourceAssets,resolveParticleSourceContext}=require('./particle-source.cjs');
const {HUMAN_PORTRAIT_RESOURCES,validateHumanPortraitResources}=require('./human-portrait-frame.cjs');
const {TextureLibrary,previewCatalog}=require('./texture-library.cjs');
const {GameFileLibrary}=require('./game-file-library.cjs');
const {TexturePreviewCache}=require('./texture-preview-cache.cjs');
const {SessionJournal}=require('./session.cjs');
const {savePreviewCapture}=require('./preview-capture.cjs');
const {PreviewRecordingStore}=require('./preview-ffmpeg.cjs');
const {saveForgeAssets}=require('./forge-assets.cjs');
const {normalizeModelCloseState,needsModelClosePrompt,modelClosePrompt,modelCloseAction}=require('./model-close.cjs');
const {showClosePrompt}=require('./close-prompt.cjs');
const {showWelcomePrompt}=require('./welcome-prompt.cjs');
const {backupModelFile}=require('./optimizexl-save.cjs');
const {BackgroundLibrary}=require('./preview-backgrounds.cjs');
const {PaintTextureLibrary}=require('./paint-textures.cjs');
const {BitsAndPartsLibrary}=require('./bits-and-parts.cjs');
const {modelPathsFromArguments,MODEL_EXTENSIONS,WARCRAFT_MODEL_EXTENSIONS}=require('./external-model-open.cjs');
const {Updater,externalURL}=require('./updater.cjs');
const {FileTypeRegistration}=require('./file-types.cjs');
let updater, startupUpdateChecked=false;
let bitsAndPartsLibrary;
function getBitsAndPartsLibrary() { return bitsAndPartsLibrary ||= new BitsAndPartsLibrary(path.join(appFolder, 'BitsAndParts')); }
let previewBackgroundLibrary;
let paintTextureLibrary;
function getPaintTextureLibrary() {
  return paintTextureLibrary ||= new PaintTextureLibrary(path.join(appFolder,'Textures'),path.join(app.getAppPath(),'dist','paint-library'));
}
function getPreviewBackgroundLibrary() {
  return previewBackgroundLibrary ||= new BackgroundLibrary({directory:path.join(appFolder,'Backgrounds'),bundledDirectory:path.resolve(__dirname,'../dist/backgrounds')});
}
app.setName('MDLxL');
if (process.platform === 'win32') app.setAppUserModelId('com.mdlxl.editor');
const profile = process.env.MDLXL_PROFILE || path.resolve(__dirname,'../profile');
app.setPath('userData',profile);
const launchModelPaths=modelPathsFromArguments(process.argv.slice(1),process.cwd());
const singleInstanceLock=app.requestSingleInstanceLock({modelPaths:launchModelPaths});
if(!singleInstanceLock) { app.exit(0); return; }
// A launch can have passed the first check before the closing owner set the lock.
if (app.isPackaged && require('node:fs').existsSync(path.join(path.dirname(process.execPath), '.mdlxl-installing'))) { app.exit(0); return; }
function sendToEditor(channel,value){if(win&&!win.isDestroyed())win.webContents.send(channel,value);}
let win, modelCloseState={dirty:false,saved:false}, recents=[],settings={},initialModel=null,initialModels=[];
const aiService=require('./ai-service.cjs').registerAiService({root:path.resolve(__dirname,'..'),profile,electron:require('electron'),getWindow:()=>win,readModel:file=>readModel(file,false),writeModel:payload=>{const operation=saveQueue.catch(()=>{}).then(()=>writeAiModel(payload));saveQueue=operation;return operation;}});
let externalModelsReady=false,externalModelQueue=[],externalOpenChain=Promise.resolve();
let settingsStore,preferenceApi,commandCatalog;
// Test runs (own profile or headless) must not point Explorer at a temporary build.
const fileTypes=userRun&&process.platform==='win32'?new FileTypeRegistration({executable:process.execPath,brandingDirectory:path.join(__dirname,'../dist/branding')}):null;
function registerFileTypes(){fileTypes?.apply({mdx:settings.preferences?.fileIcon,mdl:settings.preferences?.fileIconMdl}).catch(error=>console.warn('File types: '+error.message));}
let nativeEditorState={readOnly:true,saving:false};
let translateText=value=>value;
let gameDataDiscovery,recoveryPrompt=false,crashedWithEdits=false;
const particleLibrary=new ParticleLibrary({directory:path.join(profile,'particles'),discover:()=>gameDataDiscovery.discover({explicitFolder:settings.gameData}),createWorker:data=>{const child=utilityProcess.fork(path.join(__dirname,'particle-library-process.cjs'),[],{serviceName:'Warcraft asset indexing'});child.once('spawn',()=>child.postMessage(data));return child;},onProgress:status=>sendToEditor('particles:progress',status)});
ipcMain.handle('particles:workingCopy',(_,payload)=>particleLibrary.workingCopy(payload));

ipcMain.handle('particles:assets',(_,payload)=>resolveParticleSourceAssets(payload,{discover:()=>gameDataDiscovery.discover({explicitFolder:settings.gameData}),casc:textureResolver.casc}));
ipcMain.handle('particles:sourceContext',async(_,payload)=>{if(!payload||!Number.isInteger(payload.sourceIndex)||payload.sourceIndex<0)throw Error('Choose an indexed source.');const {parseParticleData}=await import('../src/particle-data.js'),recipe=parseParticleData(await particleLibrary.read(payload.id));return resolveParticleSourceContext(recipe.sources[payload.sourceIndex],{discover:()=>gameDataDiscovery.discover({explicitFolder:settings.gameData}),casc:textureResolver.casc});});
ipcMain.handle('particles:thumbnails',(_,ids)=>particleLibrary.thumbnails(ids));
ipcMain.handle('particles:duplicate',(_,id)=>particleLibrary.duplicate(id));
ipcMain.handle('particles:import',async()=>{
 const result=await dialog.showOpenDialog(win,{title:'Import particle preset',filters:[{name:'MDLxL particle preset',extensions:['mdlxl-particle','json']}],properties:['openFile']});
 if(result.canceled)return null;const file=result.filePaths[0],info=await fs.stat(file);if(info.size>16*1024*1024)throw Error('Preset exceeds 16 MiB.');
 return particleLibrary.save({data:await fs.readFile(file,'utf8')});
});
ipcMain.handle('particles:export',async(_,id)=>{
 const data=await particleLibrary.exportData(id),{parseParticleData}=await import('../src/particle-data.js'),recipe=parseParticleData(data);
 const result=await dialog.showSaveDialog(win,{title:'Export particle preset',defaultPath:recipe.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.mdlxl-particle',filters:[{name:'MDLxL particle preset',extensions:['mdlxl-particle']}]});
 if(result.canceled)return null;await fs.writeFile(result.filePath,data,'utf8');return {path:result.filePath};
});
ipcMain.handle('particles:thumbnail',(_,data)=>particleLibrary.thumbnail(data));
ipcMain.handle('particles:catalog',()=>particleLibrary.catalog());
ipcMain.handle('particles:read',(_,id)=>particleLibrary.read(id));
ipcMain.handle('particles:save',(_,data)=>particleLibrary.save(data));
ipcMain.handle('particles:annotate',(_,data)=>particleLibrary.annotate(data));
ipcMain.handle('particles:remove',(_,id)=>particleLibrary.remove(id));
ipcMain.handle('particles:draft',(_,data)=>particleLibrary.draft(data));
ipcMain.handle('particles:scan',()=>particleLibrary.scan());
ipcMain.handle('particles:cancel',()=>particleLibrary.cancel());
let saveQueue=Promise.resolve();
let artifactSaveQueue=Promise.resolve();
let captureBusy=false;
const captureOperations=new Set();
const previewRecordings=new PreviewRecordingStore({destination:showcaseRecordings});
function captureOperation(operation){captureOperations.add(operation);operation.finally(()=>captureOperations.delete(operation)).catch(()=>{});return operation;}
// Requests from other windows are refused: with a message, an error; without one, false.
function editorOnly(event,message){if(event.sender===win?.webContents)return true;if(message)throw Error(message);return false;}
function captureOwner(event){editorOnly(event,'Preview capture is unavailable in this window.');return event.sender.id;}
const recoveryStore=new RecoveryStore(path.join(profile,'recovery'));
const sessionJournal=new SessionJournal(path.join(profile,'sessions'));
const createTextureResolver=()=>new TextureResolver({ casc: new CascTextures({cacheDirectory:path.join(profile,'native-textures')}) });
let textureResolver=createTextureResolver();
let textureLibrary=new TextureLibrary({casc:textureResolver.casc});
let gameFiles=new GameFileLibrary({casc:textureResolver.casc});
const texturePreviews=new TexturePreviewCache({directory:path.join(profile,'texture-previews'),onProgress:status=>sendToEditor('texture:preloadProgress',status)});
let textureDecoder=null;
const thumbnailRequests=new Map();
function rejectThumbnailRequests(message){for(const request of thumbnailRequests.values()){clearTimeout(request.timer);request.reject(Error(message));}thumbnailRequests.clear();}
function decodeThumbnail(asset){
  if(!textureDecoder||textureDecoder.isDestroyed())return Promise.reject(Error('Texture preview decoder is unavailable.'));
  return new Promise((resolve,reject)=>{
    const requestId=crypto.randomBytes(12).toString('hex');
    const timer=setTimeout(()=>{thumbnailRequests.delete(requestId);reject(Error('Texture preview decoding timed out.'));},30000);
    thumbnailRequests.set(requestId,{resolve,reject,timer,sender:textureDecoder});
    textureDecoder.send('texture:preloadDecode',{requestId,name:asset.name,bytes:asset.bytes});
  });
}
ipcMain.on('texture:decoderReady',(event,ready)=>{if(!editorOnly(event))return;textureDecoder=ready?event.sender:null;if(!ready){texturePreviews.cancel();rejectThumbnailRequests('Texture preview decoder closed.');}});
ipcMain.on('texture:decoded',(event,payload)=>{const request=thumbnailRequests.get(payload?.requestId);if(!request||request.sender!==event.sender)return;clearTimeout(request.timer);thumbnailRequests.delete(payload.requestId);if(payload.error)request.reject(Error(String(payload.error).slice(0,500)));else request.resolve(payload.url);});
const textureOperations=new Set();
const readyToClose=new WeakSet(),closingWindows=new WeakSet(),savingBeforeCloseWindows=new WeakSet(),closePromptWindows=new WeakSet();
const openedPaths=new Set();
const filters=[{name:'Models and Paint Projects',extensions:MODEL_EXTENSIONS},{name:'Warcraft III models',extensions:WARCRAFT_MODEL_EXTENSIONS},{name:'MDLxL Paint Project',extensions:['mdlxlpaint']}];
let recentQueue = Promise.resolve();
async function persistRecents(file){
  if(file)recents=[file,...recents.filter(p=>p.toLowerCase()!==file.toLowerCase())].slice(0,12);
  const encoded=JSON.stringify(recents);
  const operation=recentQueue.catch(()=>{}).then(async()=>{await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'recent.json'),encoded);});
  recentQueue=operation; await operation; if(commandCatalog)refreshMenu();
}
async function readModel(file,remember=true){
  const extension=path.extname(file).toLowerCase();if(!MODEL_EXTENSIONS.includes(extension.slice(1)))throw new Error('Choose an MDL, MDX, or MDLxL Paint Project.');
  const stat=await fs.stat(file),limit=extension==='.mdlxlpaint'?512:128;if(stat.size>limit*1024*1024)throw new Error(`This file exceeds the current ${limit} MB opening limit.`);
  const bytes=await fs.readFile(file);openedPaths.add(path.resolve(file));
  const result={name:path.basename(file),path:file,bytes};
  if(remember){await persistRecents(file);initialModel=result;}
  return result;
}
function focusMainWindow(){
  if(!win||win.isDestroyed()||headless)return;
  if(win.isMinimized())win.restore();
  win.show();win.focus();
}
function flushExternalModels(){
  if(!externalModelsReady||!externalModelQueue.length||!win||win.isDestroyed())return;
  sendToEditor('model:externalOpen',externalModelQueue.splice(0));
}
function enqueueExternalModels(files){
  focusMainWindow();
  if(!files.length)return;
  externalOpenChain=externalOpenChain.then(async()=>{
    const records=[];
    for(const file of files)try{records.push(await readModel(file));}catch(error){console.error(`Could not open ${file}: ${error.message}`);}
    externalModelQueue.push(...records);flushExternalModels();
  });
}
ipcMain.on('model:externalReady',(event,ready)=>{if(!editorOnly(event))return;externalModelsReady=ready===true;if(externalModelsReady)flushExternalModels();});
if(singleInstanceLock)app.on('second-instance',(_event,commandLine,workingDirectory,additionalData)=>{
  const supplied=Array.isArray(additionalData?.modelPaths)?additionalData.modelPaths:commandLine.slice(1);
  enqueueExternalModels(modelPathsFromArguments(supplied,workingDirectory||process.cwd()));
});
async function selectOpen(){const result=await dialog.showOpenDialog(win,{filters,properties:['openFile']});if(result.canceled)return [];return Promise.all(result.filePaths.map(file=>readModel(file)));}
ipcMain.handle('model:open',selectOpen);
// Files dragged from Explorer onto the window; the Showcase keeps them out of Recent Files like its own Open.
ipcMain.handle('model:openDropped',async(_,paths,showcase=false)=>{
  const files=modelPathsFromArguments((Array.isArray(paths)?paths:[]).filter(file=>typeof file==='string'&&path.isAbsolute(file)));
  if(!files.length)throw new Error('Choose an MDL, MDX, or MDLxL Paint Project.');
  const records=[];let failure=null;
  for(const file of showcase?files.slice(0,1):files)try{records.push(await readModel(file,!showcase));}catch(error){failure||=error;console.error(`Could not open ${file}: ${error.message}`);}
  if(!records.length)throw failure;
  return records;
});
ipcMain.handle('preview:openModel',async event=>{
  captureOwner(event);
  const result=await dialog.showOpenDialog(win,{title:'Load Showcase model',filters:[{name:'Warcraft model',extensions:WARCRAFT_MODEL_EXTENSIONS}],properties:['openFile']});
  return result.canceled?null:readModel(result.filePaths[0],false);
});
ipcMain.handle('parts:list',()=>getBitsAndPartsLibrary().list());
ipcMain.handle('parts:read',(_,id)=>getBitsAndPartsLibrary().read(id));
ipcMain.handle('parts:save',(_,data)=>getBitsAndPartsLibrary().save(data));
ipcMain.handle('parts:folder',async()=>{const {directory}=await getBitsAndPartsLibrary().list();const error=await shell.openPath(directory);if(error)throw Error(error);return directory;});
ipcMain.handle('preview:backgrounds',()=>getPreviewBackgroundLibrary().list());
ipcMain.handle('preview:background',(_,id)=>getPreviewBackgroundLibrary().read(id));
ipcMain.handle('preview:backgroundFolder',async()=>{const {directory}=await getPreviewBackgroundLibrary().list();const error=await shell.openPath(directory);if(error)throw Error(error);return directory;});
ipcMain.handle('paint:textures',()=>getPaintTextureLibrary().list());
ipcMain.handle('paint:texture',(_,id)=>getPaintTextureLibrary().read(id));
ipcMain.handle('paint:saveTexture',(_,payload)=>getPaintTextureLibrary().save(payload));
ipcMain.handle('paint:textureFolder',async()=>{await getPaintTextureLibrary().ensure();const error=await shell.openPath(getPaintTextureLibrary().directory);if(error)throw Error(error);});
ipcMain.handle('paint:exportTexture',async(_,payload)=>{
  const name=path.basename(String(payload?.name||'')),extension=path.extname(name).slice(1).toLowerCase();
  if(!['png','blp','dds'].includes(extension))throw Error('Save a PNG, BLP or DDS texture.');
  const bytes=Buffer.from(payload.bytes||[]);if(!bytes.length||bytes.length>64*1024*1024)throw Error('Choose a texture smaller than 64 MiB.');
  const result=await dialog.showSaveDialog(win,{title:'Save texture copy',defaultPath:name,filters:[{name:extension.toUpperCase(),extensions:[extension]}]});
  if(result.canceled)return null;let destination=result.filePath;if(!destination.toLowerCase().endsWith('.'+extension))destination+='.'+extension;
  await fs.writeFile(destination,bytes);return {name:path.basename(destination),path:destination};
});
ipcMain.on('preview:busy',(event,value)=>{if(editorOnly(event))captureBusy=!!value;});
ipcMain.handle('preview:capture',(event,payload)=>{
  captureOwner(event);
  return captureOperation(savePreviewCapture(showcaseRecordings,payload));
});
ipcMain.handle('preview:recordBegin',(event,payload)=>captureOperation(previewRecordings.begin(captureOwner(event),payload)));
ipcMain.handle('preview:recordFrame',(event,payload)=>captureOperation(previewRecordings.frame(captureOwner(event),payload)));
ipcMain.handle('preview:recordFinish',(event,payload)=>captureOperation(previewRecordings.finish(captureOwner(event),payload)));
ipcMain.handle('preview:recordSave',(event,id)=>captureOperation(previewRecordings.save(captureOwner(event),id)));
ipcMain.handle('preview:recordDiscard',(event,id)=>captureOperation(previewRecordings.discard(captureOwner(event),id)));
ipcMain.handle('model:recent',()=>recents);
ipcMain.handle('model:clearRecent',async()=>{recents=[];await persistRecents();return [];});
ipcMain.handle('model:openRecent',async(_,p,showcase=false)=>{
  if(!recents.includes(p))throw new Error('Not in recent files.');
  try{return await readModel(p,!showcase);}catch(error){
    if(['ENOENT','ENOTDIR'].includes(error.code)){recents=recents.filter(file=>file!==p);await persistRecents();throw new Error('This recent file was moved or deleted: '+p);}
    throw error;
  }
});
ipcMain.on('model:dirty',(_,value)=>{modelCloseState=normalizeModelCloseState(value,modelCloseState);win?.setDocumentEdited(modelCloseState.dirty);sessionJournal.setDirty(modelCloseState.dirty).catch(error=>console.warn('Session journal: '+error.message));});
ipcMain.on('menu:state',(event,value)=>{
  if(!editorOnly(event)||typeof value?.readOnly!=='boolean'||typeof value?.saving!=='boolean')return;
  const checks=normalizeMenuChecks(value.checks);
  const next={readOnly:value.readOnly,saving:value.saving,uvEnabled:value.uvEnabled===true,viewMode:value.viewMode,vanilla:value.vanilla===true,checks};
  if(JSON.stringify(nativeEditorState)===JSON.stringify(next))return;
  nativeEditorState=next;
  if(commandCatalog)refreshMenu();
});
async function saveModel(payload){
  if(!payload || !['mdl','mdx'].includes(payload.format))throw new Error('Unsupported format.');
  const bytes=Buffer.from(payload.bytes);if(bytes.length>128*1024*1024)throw new Error('Output exceeds 128 MB.');
  let destination=payload.path;
  const choose=async title=>{const result=await dialog.showSaveDialog(win,{title,defaultPath:destination||payload.name||`Untitled.${payload.format}`,filters:[{name:payload.format.toUpperCase()+' model',extensions:[payload.format]}]});return result.canceled?null:result.filePath;};
  let chosen=!destination||payload.saveAs||!openedPaths.has(path.resolve(destination));
  if(chosen&&!(destination=await choose(payload.export?'Export model':'Save model')))return null;
  if(path.extname(destination).toLowerCase()!=='.'+payload.format)destination+='.'+payload.format;
  try{await writeModelFile(destination,bytes,payload.forgeAssets||[]);}catch(error){
    // A read-only original (a file opened straight from a zip, for example) asks for another place instead of failing.
    if(chosen||!['EPERM','EACCES','EROFS'].includes(error.code))throw error;
    if(!(destination=await choose('This file is read-only. Save model as')))return null;
    if(path.extname(destination).toLowerCase()!=='.'+payload.format)destination+='.'+payload.format;
    await writeModelFile(destination,bytes,payload.forgeAssets||[]);
  }
  openedPaths.add(path.resolve(destination));await persistRecents(destination);
  initialModel={name:path.basename(destination),path:destination,bytes};
  return {name:path.basename(destination),path:destination};
}
// Writes through a verified temporary file. Without overwrite, an existing
// destination is refused before any texture or temporary file is written.
async function writeModelFile(destination,bytes,forgeAssets=[],{overwrite=true}={}){
  if(!overwrite&&await fs.access(destination).then(()=>true,()=>false))throw new Error('A file already exists at '+destination+'.');
  const temporary=destination+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{
    await saveForgeAssets(destination,forgeAssets);
    await fs.writeFile(temporary,bytes,{flag:'wx'});
    const check=await fs.readFile(temporary);if(!check.equals(bytes))throw new Error('Write verification failed.');
    // copyFile with COPYFILE_EXCL also works on FAT/exFAT drives, unlike hard links.
    if(overwrite)await fs.rename(temporary,destination);
    else{await fs.copyFile(temporary,destination,require('node:fs').constants.COPYFILE_EXCL);await fs.unlink(temporary);}
  }catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}
}
// AI exports go to the path the AI names, without a save dialog, but replacing
// an existing file always asks the user first. They never change Recent files,
// the startup model or the set of opened files.
async function writeAiModel(payload){
  if(!['mdl','mdx'].includes(payload?.format))throw new Error('Unsupported format.');
  const bytes=Buffer.from(payload.bytes);if(bytes.length>128*1024*1024)throw new Error('Output exceeds 128 MB.');
  const destination=path.resolve(payload.path);
  if(path.extname(destination).toLowerCase()!=='.'+payload.format)throw new Error('The output path must end in .'+payload.format+'.');
  let overwrite=false;
  if(await fs.access(destination).then(()=>true,()=>false)){
    if(!payload.overwrite)throw new Error('A file already exists at '+destination+'. Ask the user before replacing it.');
    const answer=await dialog.showMessageBox(win,{type:'warning',buttons:['Replace','Cancel'],defaultId:1,cancelId:1,noLink:true,title:'AI export',message:'The AI wants to replace '+path.basename(destination)+'.',detail:destination});
    if(answer.response!==0)throw new Error('The user did not allow replacing '+destination+'.');
    overwrite=true;
  }
  await writeModelFile(destination,bytes,payload.forgeAssets||[],{overwrite});
  return {name:path.basename(destination),path:destination};
}
ipcMain.handle('model:save',(_,payload)=>{const operation=saveQueue.catch(()=>{}).then(()=>saveModel(payload));saveQueue=operation;return operation;});
ipcMain.handle('model:backup',(event,payload)=>{
  editorOnly(event,'Backups are only available from the editor.');
  const source=path.resolve(String(payload?.path||''));
  // Only a file this editor opened or saved can be copied.
  if(!openedPaths.has(source))throw Error('Only the open model file can be backed up.');
  const operation=saveQueue.catch(()=>{}).then(()=>backupModelFile(source));saveQueue=operation;return operation;
});
async function saveArtifact(payload){
  const requested=path.basename(String(payload?.name||'')),extension=path.extname(requested).toLowerCase(),allowed=new Set(['.mdlxlpaint','.zip']);
  if(!allowed.has(extension))throw Error('Only .mdlxlpaint and .zip painter artifacts can be saved.');
  const bytes=Buffer.from(payload?.bytes||[]);if(!bytes.length)throw Error('The painter artifact is empty.');if(bytes.length>512*1024*1024)throw Error('The painter artifact exceeds 512 MB.');
  const result=await dialog.showSaveDialog(win,{title:extension==='.zip'?'Export Warcraft paint package':'Save editable paint project',defaultPath:requested,filters:[{name:extension==='.zip'?'ZIP package':'MDLxL Paint Project',extensions:[extension.slice(1)]}]});
  if(result.canceled)return null;let destination=result.filePath;if(path.extname(destination).toLowerCase()!==extension)destination+=extension;
  if(!allowed.has(path.extname(destination).toLowerCase()))throw Error('The selected painter artifact extension is not allowed.');
  const temporary=destination+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  try{await fs.writeFile(temporary,bytes,{flag:'wx'});const check=await fs.readFile(temporary);if(!check.equals(bytes))throw Error('Artifact write verification failed.');await fs.rename(temporary,destination);return {name:path.basename(destination),path:destination,bytes:bytes.length};}
  catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}
}
ipcMain.handle('artifact:save',(_,payload)=>{const operation=artifactSaveQueue.catch(()=>{}).then(()=>saveArtifact(payload));artifactSaveQueue=operation;return operation;});
const imageExtensions=IMAGE_EXTENSIONS;
async function resolveTextures(payload, extensions){
  if(!Array.isArray(payload?.names))throw Error('Missing texture paths.');
  if(!payload.names.length)return [];
  const root=payload.path&&(openedPaths.has(path.resolve(payload.path))||bitsAndPartsLibrary?.openedPaths.has(path.resolve(payload.path)))?path.dirname(path.resolve(payload.path)):null;
  // Capture the configured folder once.  A picker change while this async
  // lookup is running must not combine one discovery result with another
  // folder's setting.
  const selectedFolder=settings.gameData;
  const discovered=await gameDataDiscovery.discover({explicitFolder:selectedFolder,modelFolders:[root,...[...openedPaths].map(file=>path.dirname(file))].filter(Boolean)});
  const selected=selectedGameDataSources(discovered,selectedFolder);
  const custom=discovered.customSources||{archives:[],cascFolders:[]};
  return textureResolver.resolve(payload.names,{modelFolders:[root].filter(Boolean),customArchives:custom.archives,customCascFolders:custom.cascFolders,folders:[root,...selected.folders].filter(Boolean),archives:selected.archives,cascFolders:(discovered.cascFolders||[]).filter(folder=>selected.folders.includes(folder)),fallbackCascFolders:(discovered.cascFolders||[]).filter(folder=>!selected.folders.includes(folder)&&!custom.cascFolders.includes(folder)),fallbackFolders:discovered.folders.filter(folder=>!selected.folders.includes(folder)&&!custom.cascFolders.includes(folder)),fallbackArchives:discovered.archives.filter(file=>!selected.archives.includes(file)&&!custom.archives.includes(file))},extensions);
}
// Texture-source resets wait for these lookups before closing the old reader.
function trackTextureOperation(operation){textureOperations.add(operation);operation.finally(()=>textureOperations.delete(operation)).catch(()=>{});return operation;}
ipcMain.handle('texture:resolve',(_,payload)=>trackTextureOperation(resolveTextures(payload)));
// Event previews use the same installed-game lookup and cache as textures.
// Limit this separate read-only endpoint to resources consumed by that preview.
ipcMain.handle('preview:eventResources',(_,payload)=>trackTextureOperation(resolveTextures(payload,[...IMAGE_EXTENSIONS,'slk','mdl','mdx','wav','mp3','ogg','flac'])));
ipcMain.handle('preview:humanPortraitFrame',()=>trackTextureOperation(resolveTextures({names:HUMAN_PORTRAIT_RESOURCES},[...IMAGE_EXTENSIONS,'fdf','txt']).then(validateHumanPortraitResources)));
async function textureLibraryContext(payload){
    const modelPath=typeof payload?.modelPath==='string'&&openedPaths.has(path.resolve(payload.modelPath))?path.resolve(payload.modelPath):null;
    const chosen=settings.gameData;
    const discovered=await gameDataDiscovery.discover({explicitFolder:chosen,modelFolders:modelPath?[path.dirname(modelPath)]:[]});
    const selected=selectedGameDataSources(discovered,chosen);
    const folders=discovered.cascFolders||[];
    const custom=discovered.customSources?.cascFolders||[];
    const resolver=textureResolver;
    const catalog=await textureLibrary.catalog({modelPath,cascFolders:[...custom,...folders.filter(folder=>selected.folders.includes(folder)&&!custom.includes(folder)),...folders.filter(folder=>!selected.folders.includes(folder)&&!custom.includes(folder))]});
    texturePreviews.register(catalog.items);
    return {catalog,readAsset:async item=>({name:item.lookupName,bytes:item.source==='native'?await resolver.casc.readSnapshot(item.lookupName,item.sourceFolder,item.sourceKey):await resolver.loose(item.lookupName,modelPath?[path.dirname(modelPath)]:[])}),decode:decodeThumbnail};
}
ipcMain.handle('texture:library',(_,payload)=>trackTextureOperation(textureLibraryContext(payload).then(context=>context.catalog)));
ipcMain.handle('texture:libraryPreview',(_,payload)=>trackTextureOperation(textureLibraryContext(payload).then(context=>previewCatalog(context.catalog,payload?.format==='blp'?'blp':'all'))));
// The Library's game-file browser reads one installation: the folder chosen in
// Settings first, then added CASC sources, then discovered installations.
async function gameFileIndex(){
  const chosen=settings.gameData,library=gameFiles;
  const discovered=await gameDataDiscovery.discover({explicitFolder:chosen});
  const selected=selectedGameDataSources(discovered,chosen),folders=discovered.cascFolders||[],custom=discovered.customSources?.cascFolders||[];
  const folder=[...folders.filter(item=>selected.folders.includes(item)),...custom,...folders][0];
  const index=await library.load(folder?[folder]:[]);
  return {library,index,folder:folder||null};
}
const gameFileRequest=payload=>({folder:typeof payload?.folder==='string'?payload.folder.slice(0,512):'',variant:['classic','reforged','forsaken-kingdom','language','other','all'].includes(payload?.variant)?payload.variant:'classic',type:['all','models','textures','sounds','text','maps','video','fonts','other'].includes(payload?.type)?payload.type:'all',query:typeof payload?.query==='string'?payload.query.slice(0,200):'',offset:Number.isSafeInteger(payload?.offset)?payload.offset:0,limit:Number.isSafeInteger(payload?.limit)?payload.limit:200});
ipcMain.handle('gameFiles:summary',()=>trackTextureOperation(gameFileIndex().then(({library,index,folder})=>({...library.summary(index),folder}))));
ipcMain.handle('gameFiles:browse',(_,payload)=>trackTextureOperation(gameFileIndex().then(({library,index})=>{const request=gameFileRequest(payload);return request.query.trim()?library.search(index,request):library.browse(index,request);})));
ipcMain.handle('gameFiles:read',(_,payload)=>trackTextureOperation(gameFileIndex().then(async({library,index})=>{const entry=library.entry(index,payload?.id,payload?.signature);return {...library.publicEntry(entry),bytes:await library.read(index,entry)};})));
ipcMain.handle('gameFiles:resolve',(_,payload)=>trackTextureOperation(gameFileIndex().then(({library,index})=>{if(!Array.isArray(payload?.names))throw Error('Missing texture paths.');return library.resolve(index,library.entry(index,payload.id,payload.signature),payload.names);})));
// World Editor view: the renderer builds its tree from these read-only game tables.
const worldEditorString=path=>/^units\\[a-z]*strings\.txt$|^ui\\worldedit(?:game)?strings\.txt$/.test(path);
ipcMain.handle('gameFiles:worldEditorSources',(_,payload)=>trackTextureOperation(gameFileIndex().then(({library,index})=>{
  const files=Array.isArray(payload?.files)?payload.files.filter(path=>typeof path==='string'&&/^(?:units|doodads|ui)\\[a-z0-9_]+\.(?:slk|txt)$/i.test(path)).slice(0,64):[];
  return library.worldEditorSources(index,{files,isString:worldEditorString});
})));
ipcMain.handle('gameFiles:readPath',(_,payload)=>trackTextureOperation(gameFileIndex().then(async({library,index})=>{
  if(typeof payload?.path!=='string'||payload.path.length>260)throw Error('Invalid game path.');
  const entry=library.findPath(index,payload.path,gameFileRequest(payload).variant);
  return entry?{...library.publicEntry(entry),signature:index.signature,bytes:await library.read(index,entry)}:null;
})));
ipcMain.handle('gameFiles:findPath',(_,payload)=>trackTextureOperation(gameFileIndex().then(({library,index})=>{
  if(typeof payload?.path!=='string'||payload.path.length>260)throw Error('Invalid game path.');
  const entry=library.findPath(index,payload.path,gameFileRequest(payload).variant);
  return entry?{...library.publicEntry(entry),signature:index.signature}:null;
})));
ipcMain.handle('gameFiles:export',async(_,payload)=>{
  const {library,index}=await gameFileIndex(),entry=library.entry(index,payload?.id,payload?.signature);
  const answer=await dialog.showSaveDialog(win,{title:'Save a copy of '+entry.name,defaultPath:entry.name,buttonLabel:'Save copy'});
  if(answer.canceled||!answer.filePath)return null;
  await fs.writeFile(answer.filePath,await library.read(index,entry));return answer.filePath;
});
ipcMain.handle('texture:copyPath',(_,value)=>{
  if(typeof value!=='string'||!value||value.length>1024)throw Error('Invalid texture path.');
  clipboard.writeText(value);
});
// Paint textures travel through the system clipboard as images, so Photoshop,
// GIMP and other editors can paste them and copy edits back.
ipcMain.handle('paint:clipboardWrite',(_,bytes)=>{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>256*1024*1024)throw Error('Invalid texture image.');
  const image=nativeImage.createFromBuffer(Buffer.from(bytes));if(image.isEmpty())throw Error('The texture could not be copied.');
  clipboard.writeImage(image);
});
ipcMain.handle('paint:clipboardRead',()=>{const image=clipboard.readImage();return image.isEmpty()?null:new Uint8Array(image.toPNG());});
ipcMain.handle('texture:preloadStatus',()=>texturePreviews.getStatus());
ipcMain.handle('texture:preloadStart',(event,payload)=>{
  editorOnly(event,'Texture preview decoder is not ready.');if(textureDecoder!==event.sender)throw Error('Texture preview decoder is not ready.');
  return texturePreviews.start(()=>textureLibraryContext(payload));
});
ipcMain.handle('texture:preloadCancel',(_,payload)=>texturePreviews.cancel(payload?.jobId));
ipcMain.handle('texture:thumbnails',(_,payload)=>texturePreviews.readMany(payload?.keys));
ipcMain.handle('texture:saveThumbnail',(_,payload)=>texturePreviews.save(payload?.key,payload?.url));
ipcMain.handle('settings:gameData',async()=>{
  const answer=await dialog.showOpenDialog(win,{title:'Choose your Warcraft III installation folder',buttonLabel:'Use this folder',defaultPath:settings.gameData||undefined,properties:['openDirectory']});
  if(answer.canceled)return null;
  return updateSettings({gameData:answer.filePaths[0]});
});
ipcMain.handle('settings:clearGameData',()=>updateSettings({gameData:null}));
ipcMain.handle('settings:addGameDataSource',async(_,kind)=>{
  if(!['casc','mpq'].includes(kind))throw Error('Choose CASC or MPQ.');
  const answer=await dialog.showOpenDialog(win,kind==='casc'
    ? {title:'Choose a custom CASC storage folder',buttonLabel:'Use this folder',properties:['openDirectory']}
    : {title:'Choose custom MPQ archives',buttonLabel:'Use these archives',filters:[{name:'MPQ archives',extensions:['mpq']}],properties:['openFile','multiSelections']});
  if(answer.canceled||!answer.filePaths.length)return null;
  const sources=answer.filePaths.map(file=>({kind,path:path.resolve(file)}));
  for(const source of sources){
    if(kind==='mpq'){
      const reader=await Mpq.open(source.path);await reader.close();
    }else{
      const build=await fs.stat(path.join(source.path,'.build.info')).catch(()=>null),data=await fs.stat(path.join(source.path,'Data')).catch(()=>null);
      if(!build?.isFile()||!data?.isDirectory())throw Error('Choose the CASC storage folder containing .build.info and Data.');
      const reader=new CascReader(source.path,__dirname);
      try{await reader.ready;}finally{reader.close();}
    }
  }
  return updateSettings({gameDataSources:[...(settings.gameDataSources||[]),...sources]});
});
ipcMain.handle('settings:removeGameDataSource',(_,file)=>{
  if(typeof file!=='string')throw Error('Choose a saved custom archive.');
  return updateSettings({gameDataSources:(settings.gameDataSources||[]).filter(source=>source.path!==file)});
});
ipcMain.handle('settings:rescanGameData',async()=>{
  texturePreviews.cancel();await texturePreviews.settle();
  const result=await gameDataDiscovery.discover({explicitFolder:settings.gameData,modelFolders:[...openedPaths].map(file=>path.dirname(file)),force:true});
  await resetTextureSources();
  return result;
});
async function resetTextureSources(){
  const previous=textureResolver;textureResolver=createTextureResolver();textureLibrary=new TextureLibrary({casc:textureResolver.casc});gameFiles=new GameFileLibrary({casc:textureResolver.casc});
  await Promise.allSettled([...textureOperations]);await previous.close();
}
ipcMain.handle('recovery:write',(_,payload)=>recoveryStore.write(payload));
ipcMain.handle('recovery:list',()=>recoveryStore.list());
ipcMain.handle('recovery:read',async(_,id)=>{const payload=await recoveryStore.read(id);if(typeof payload.path==='string'&&/\.(mdl|mdx)$/i.test(payload.path)){try{if((await fs.stat(payload.path)).isFile())openedPaths.add(path.resolve(payload.path));}catch{}}return payload;});
const publicSettings=()=>({...settings,gameData:settings.gameData||null,gameDataSources:settings.gameDataSources||[],gameDataDiscovery:gameDataDiscovery?.result});
// Historical drafts are only needed for a crash prompt or the Recovery command.
// A normal launch must not wait on every saved draft before starting the viewport.
ipcMain.handle('app:initial',async()=>({settings:publicSettings(),model:initialModel,models:initialModels,recoveryPrompt,recovery:recoveryPrompt?(await recoveryStore.list()).filter(r=>r.dirty!==false):[]}));
ipcMain.handle('settings:get',publicSettings);
ipcMain.handle('updates:status',()=>updater?.status());
ipcMain.handle('updates:check',event=>{editorOnly(event,'Update checks require the main editor.');return updater.check(settings.preferences.language);});
// People who download each release by hand often never find Auto update, so a
// fresh copy asks once. Test profiles and headless runs are never asked.
// It is a themed welcome window with a short fanfare, not a native message box,
// whose alert sound made the welcome feel like an error.
async function offerStartupUpdates(){
  const t=text=>translateText(text,settings.preferences.language);
  const icon=nativeImage.createFromPath(path.join(__dirname,'../dist/branding/MDLxL.png')).resize({width:192,height:192,quality:'best'}).toDataURL();
  const answer=await showWelcomePrompt(win,{title:'MDLxL',heading:t('Welcome to MDLxL'),question:t('Would you like to enable auto updating?'),detail:t('MDLxL takes a quick look for a new version each time it starts and lets you know when there is one. Nothing is downloaded or installed until you choose Update and restart.'),note:t('We only ask this once like this. You can also change this setting at any time via Settings → Appearance → Auto update.'),labels:{yes:t('Yes, enable it'),no:t('No thanks')},icon,theme:settings.preferences.theme,disableSounds:settings.preferences.disableSounds});
  const preferences={updateOfferAnswered:true,checkUpdatesOnStartup:answer==='yes'};
  await updateSettings({preferences});
  // The editor keeps its own copy of preferences and would save the old answer back.
  sendToEditor('settings:preferences',preferences);
}
ipcMain.on('updates:startup',async event=>{
  if(!editorOnly(event)||startupUpdateChecked)return;
  startupUpdateChecked=true;
  if(updater.status().error)return;
  if(userRun&&!settings.preferences.checkUpdatesOnStartup&&!settings.preferences.updateOfferAnswered){
    try{await offerStartupUpdates();}catch(error){console.error(error);}
  }
  if(settings.preferences.checkUpdatesOnStartup)void updater.check(settings.preferences.language);
});
ipcMain.handle('updates:install',async event=>{
  editorOnly(event,'Updates require the main editor.');
  const result=await updater.prepare();
  if(result.state==='ready'&&win&&!win.isDestroyed())win.close();
  return updater.status();
});
ipcMain.handle('updates:revert',async event=>{
  editorOnly(event,'Updates require the main editor.');
  const answer=await dialog.showMessageBox(win,{type:'question',title:'Revert to last version',message:'Revert to MDLxL '+updater.status().previousVersion+'?',detail:'Your settings, personal libraries, and saved files are kept.',buttons:['Revert and restart','Cancel'],defaultId:1,cancelId:1});
  if(answer.response!==0)return updater.status();
  const result=await updater.prepareRevert();if(result.state==='ready'&&win&&!win.isDestroyed())win.close();return updater.status();
});
ipcMain.handle('app:fileTypesNeedDefaultAgain',async()=>Boolean(await fileTypes?.usesSharedDefault()));
ipcMain.handle('app:openDefaultApps',()=>shell.openExternal('ms-settings:defaultapps?registeredAppUser=MDLxL'));
ipcMain.handle('app:openLink',(_,url)=>{if(!externalURL(url))throw Error('Unsupported website link.');return shell.openExternal(url);});
ipcMain.handle('settings:configure',(_,value)=>{
  if(value&&['gameData','gameDataSources'].some(key=>Object.prototype.hasOwnProperty.call(value,key)))throw Error('Use the game data pickers to change asset sources.');
  return updateSettings(value);
});
ipcMain.on('app:close',event=>{if(win&&!win.isDestroyed()&&editorOnly(event))win.close();});
async function updateSettings(value){
  const previousHotkeys=JSON.stringify(settings.preferences?.hotkeys);
  const previousLanguage=settings.preferences?.language,previousFileIcon=settings.preferences?.fileIcon+'|'+settings.preferences?.fileIconMdl;
  settings=await settingsStore.configure(value);
  if(value&&Object.prototype.hasOwnProperty.call(value,'gameData'))texturePreviews.cancel();
  if(value&&Object.prototype.hasOwnProperty.call(value,'gameDataSources')){
    texturePreviews.cancel();await texturePreviews.settle();await resetTextureSources();
  }
  nativeTheme.themeSource=(APPLICATION_THEMES[settings.preferences.theme] || APPLICATION_THEMES.light).scheme;
  if(previousFileIcon!==settings.preferences.fileIcon+'|'+settings.preferences.fileIconMdl)registerFileTypes();
  if(JSON.stringify(settings.preferences.hotkeys)!==previousHotkeys || previousLanguage!==settings.preferences.language)refreshMenu();
  return publicSettings();
}
function refreshMenu(){
  if(!win||win.isDestroyed())return;
  const bindings=preferenceApi.effectiveBindings(commandCatalog,settings.preferences.hotkeys);
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(bindings,id=>sendToEditor('menu',id),process.platform,recents,text=>translateText(text,settings.preferences.language),nativeEditorState)));
}
// Headless test runs keep the scriptable native message box; people get the
// themed prompt whose Cancel and Close are colored and set apart.
async function askModelClose(current){
  const prompt=modelClosePrompt(modelCloseState);
  if(headless&&process.env.MDLXL_STYLED_CLOSE_PROMPT!=='1')return modelCloseAction(dialog.showMessageBoxSync(current,prompt));
  const language=settings.preferences?.language,t=text=>translateText(text,language);
  return showClosePrompt(current,{title:t(prompt.title),message:t(prompt.message),detail:t(prompt.detail),labels:{save:t('Save'),cancel:t('CANCEL?'),close:t('Close')},theme:settings.preferences?.theme});
}
function flushBeforeClose(current,discardedDirty=false){
  if(closingWindows.has(current))return;
  closingWindows.add(current);
  const requestId=crypto.randomBytes(12).toString('hex');
  let finished=false,timer;
  const cleanup=()=>{clearTimeout(timer);ipcMain.removeListener('app:closeReady',acknowledge);};
  const finish=async()=>{
    if(finished)return;finished=true;cleanup();
    await saveQueue.catch(()=>{});
    await settingsStore?.flush();
    if(!current.isDestroyed()){
      // Recheck a model edit made while an asynchronous settings write completed.
      if(modelCloseState.dirty){closingWindows.delete(current);updater?.cancelClose();}else readyToClose.add(current);
      current.close();
    }
  };
  const acknowledge=async(event,payload)=>{
    if(event.sender!==current.webContents||payload?.requestId!==requestId)return;
    if(payload.error){
      if(finished)return;finished=true;cleanup();closingWindows.delete(current);
      const answer=await dialog.showMessageBox(current,{type:'error',title:'Pending work could not be saved',message:'The editor could not finish saving before closing.',detail:String(payload.error).slice(0,500),buttons:['Keep editing','Close anyway'],defaultId:0,cancelId:0});
      if(answer.response===1&&!current.isDestroyed()){await settingsStore?.flush();if(!modelCloseState.dirty)readyToClose.add(current);current.close();}
      else if(!current.isDestroyed()){updater?.cancelClose();modelCloseState={...modelCloseState,dirty:modelCloseState.dirty||discardedDirty};current.setDocumentEdited(modelCloseState.dirty);}
      return;
    }
    await finish();
  };
  ipcMain.on('app:closeReady',acknowledge);
  // An unresponsive renderer must not prevent the user from closing the app.
  // Writes that already reached the main process still finish before exit.
  const timeout=()=>{if(captureBusy||captureOperations.size){timer=setTimeout(timeout,60000);return;}finish();};
  timer=setTimeout(timeout,captureBusy?60000:1500);
  current.webContents.send('app:beforeClose',requestId);
}
function saveBeforeClose(current){
  if(savingBeforeCloseWindows.has(current))return;
  savingBeforeCloseWindows.add(current);
  const requestId=crypto.randomBytes(12).toString('hex');
  const acknowledge=(event,payload)=>{
    if(event.sender!==current.webContents||payload?.requestId!==requestId)return;
    ipcMain.removeListener('app:saveBeforeCloseReady',acknowledge);
    savingBeforeCloseWindows.delete(current);
    if(payload.error){
      updater?.cancelClose();
      dialog.showMessageBox(current,{type:'error',title:'Model could not be saved',message:'The model could not be saved before closing.',detail:String(payload.error).slice(0,500),buttons:['Keep editing'],defaultId:0,cancelId:0});
      return;
    }
    if(payload.saved&&!current.isDestroyed()){
      modelCloseState={dirty:false,saved:true};
      current.setDocumentEdited(false);
      flushBeforeClose(current);
    }else updater?.cancelClose();
  };
  ipcMain.on('app:saveBeforeCloseReady',acknowledge);
  current.webContents.send('app:saveBeforeClose',requestId);
}
async function readTexture(file,logicalName){const stat=await fs.stat(file);if(stat.size>64*1024*1024)throw new Error('Texture exceeds 64 MB.');return {name:logicalName||path.basename(file),bytes:await fs.readFile(file)};}
ipcMain.handle('texture:open',async()=>{const result=await dialog.showOpenDialog(win,{filters:[{name:'Textures',extensions:imageExtensions}],properties:['openFile','multiSelections']});if(result.canceled)return [];return Promise.all(result.filePaths.map(p=>readTexture(p)));});
ipcMain.handle('texture:folder',async(_,requested)=>{
  const result=await dialog.showOpenDialog(win,{title:'Choose a texture root folder',properties:['openDirectory']});if(result.canceled)return [];
  const root=path.resolve(result.filePaths[0]);const loaded=[];
  for(const name of [...new Set(requested)].slice(0,4096)){
    if(typeof name!=='string'||!name)continue;
    const relative=name.replace(/[\\/]+/g,path.sep);
    for(const candidate of [path.resolve(root,relative),path.resolve(root,path.basename(relative))]){
      if(!candidate.toLowerCase().startsWith(root.toLowerCase()+path.sep))continue;
      if(!imageExtensions.includes(path.extname(candidate).slice(1).toLowerCase()))continue;
      try{loaded.push(await readTexture(candidate,name));break;}catch(error){if(!['ENOENT','EISDIR'].includes(error.code))throw error;}
    }
  }
  return loaded;
});
if(singleInstanceLock)app.whenReady().then(async()=>{
  const [preferences,commands,localization]=await Promise.all([import('../src/preferences.js'),import('../src/commands.js'),import('../src/localization.js')]);
  translateText=localization.translate;
  // Localize native dialog presentation while retaining paths, extensions and IDs.
  for(const method of ['showOpenDialog','showSaveDialog','showMessageBox','showMessageBoxSync']){
    const original=dialog[method].bind(dialog);
    dialog[method]=(...args)=>{const i=args.length-1,opts=args[i];if(opts&&typeof opts==='object'){
      const localized={...opts};for(const key of ['title','message','detail','buttonLabel'])if(typeof localized[key]==='string')localized[key]=translateText(localized[key],settings.preferences?.language);
      if(Array.isArray(opts.buttons))localized.buttons=opts.buttons.map(text=>translateText(text,settings.preferences?.language));
      if(Array.isArray(opts.filters))localized.filters=opts.filters.map(filter=>({...filter,name:translateText(filter.name,settings.preferences?.language)}));
      args[i]=localized;
    }return original(...args);};
  }
  preferenceApi=preferences;commandCatalog=commands.COMMANDS;
  settingsStore=new SettingsStore(path.join(profile,'settings.json'),preferences.normalizePreferences);
  try{recents=JSON.parse(await fs.readFile(path.join(profile,'recent.json'),'utf8')).filter(x=>typeof x==='string').slice(0,12);}catch{}
  settings=await settingsStore.load(path.join(__dirname,'../game-data.json'));
  updater=new Updater({currentVersion:app.getVersion(),installRoot:path.dirname(process.execPath),profile,packaged:app.isPackaged,onStatus:status=>sendToEditor('updates:status',status)});
  await updater.initialize();
  try {const result=JSON.parse(await fs.readFile(path.join(profile,'update-result.json'),'utf8'));if(!result.ok)updater.publish({state:'error',error:'The update could not be installed. Your previous version has been restored.',detail:result.error});else if(updater.status().previousVersion)void updater.reportUpdate();await fs.unlink(path.join(profile,'update-result.json'));}catch(error){if(error.code!=='ENOENT')console.warn('Update result: '+error.message);}
  nativeTheme.themeSource=(APPLICATION_THEMES[settings.preferences.theme] || APPLICATION_THEMES.light).scheme;
  if(process.env.MDLVIS_GAME_DATA)settings.gameData=process.env.MDLVIS_GAME_DATA;
  try{recoveryPrompt=await sessionJournal.begin();}catch(error){console.warn('Session journal: '+error.message);}
  try{await recoveryStore.resetOnce(recoveryPrompt);}catch(error){console.warn('Recovery reset: '+error.message);}
  gameDataDiscovery=new GameDataDiscovery({cacheFile:path.join(profile,'game-data-discovery.json'),appFolders:[path.dirname(process.execPath),app.getAppPath()],customSources:()=>settings.gameDataSources||[]});
  for(const file of launchModelPaths)try{initialModels.push(await readModel(file));}catch(e){console.error(e.message);}
  initialModel=initialModels[0]||null;
  // Discover game data only when textures are requested or the user rescans.
  // A blank editor starts without registry queries or a drive-search process.
  // Runs in the background; it must not wait for (or be skipped by) the editor page load.
  registerFileTypes();
  await createWindow();
});
async function createWindow(bounds={}){
  externalModelsReady=false;
  const current=new BrowserWindow({width:1100,height:760,...bounds,minWidth:720,minHeight:480,show:!headless,backgroundColor:(APPLICATION_THEMES[settings.preferences?.theme] || APPLICATION_THEMES.light).colors.panel,title:'MDLxL',icon:path.join(__dirname,'../dist/branding/MDLxL.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,autoplayPolicy:'no-user-gesture-required'}});
  if(!headless)current.maximize();
  win=current;nativeEditorState={readOnly:true,saving:false};
  current.once('closed',()=>{if(current===win)aiService.close().catch(error=>console.error('AI shutdown: '+error.message));});
  win.webContents.setWindowOpenHandler(({url,frameName})=> url==='about:blank' && ['MDLxL-UV','MDLxL-OptimizeXL'].includes(frameName) ? {action:'allow',overrideBrowserWindowOptions:{parent:current,modal:false,width:frameName==='MDLxL-UV'?900:1280,height:frameName==='MDLxL-UV'?700:800,minWidth:frameName==='MDLxL-UV'?500:950,minHeight:frameName==='MDLxL-UV'?400:500,show:!headless,title:frameName==='MDLxL-UV'?'MDLxL — UV Editor':'OptimizeXL',icon:path.join(__dirname,'../dist/branding/MDLxL.ico'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}}} : {action:'deny'});
  current.webContents.on('did-create-window',child=>{child.setMenu(null);if(!headless)child.maximize();else child.webContents.setBackgroundThrottling(false);child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.webContents.on('will-navigate',event=>event.preventDefault());});
  win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault();});
  refreshMenu();
  win.on('close',async event=>{if(current!==win||readyToClose.has(current))return;event.preventDefault();if(closePromptWindows.has(current))return;let discardedDirty=false;if(needsModelClosePrompt(modelCloseState)){closePromptWindows.add(current);let action;try{action=await askModelClose(current);}finally{closePromptWindows.delete(current);}if(current.isDestroyed())return;if(action==='save'){saveBeforeClose(current);return;}if(action==='cancel'){updater?.cancelClose();return;}discardedDirty=modelCloseState.dirty;modelCloseState={...modelCloseState,dirty:false};current.setDocumentEdited(false);}flushBeforeClose(current,discardedDirty);});
  win.webContents.on('will-prevent-unload',event=>{if(!modelCloseState.dirty)event.preventDefault();});
  current.webContents.on('render-process-gone',async(_,details)=>{
    if(current!==win||current.isDestroyed())return;
    textureDecoder=null;texturePreviews.cancel();rejectThumbnailRequests('Editor renderer closed.');
    await Promise.allSettled([...captureOperations]);
    await previewRecordings.closeOwner(current.webContents.id);
    captureBusy=false;
    recoveryPrompt=recoveryPrompt||modelCloseState.dirty;crashedWithEdits=crashedWithEdits||modelCloseState.dirty;
    // Yield past Chromium's process teardown before creating another renderer.
    // Immediate reload inside this callback can crash Electron's host process.
    await new Promise(resolve=>setImmediate(resolve));
    await recoveryStore.flush();
    if(current.isDestroyed())return;
    const answer=await dialog.showMessageBox(current,{type:'error',title:'MDLxL',message:'The editor process stopped.',detail:'Your last disk recovery copy and undo history can be restored in a fresh editor window. Reason: '+details.reason,buttons:['Reopen editor','Close']});
    modelCloseState={...modelCloseState,dirty:false};
    if(answer.response===0){const bounds=current.getBounds();await createWindow(bounds);crashedWithEdits=false;if(!current.isDestroyed())current.destroy();}
    else current.destroy();
  });
  await current.loadFile(path.join(__dirname,'../dist/index.html'));
}
app.on('window-all-closed',async()=>{
  // AI shutdown is bounded and can never skip the settings/recovery flush below.
  await Promise.race([aiService.close().catch(error=>console.error('AI shutdown: '+error.message)),new Promise(resolve=>setTimeout(resolve,5000))]);
  await updater?.shutdown();
  await particleLibrary.close();
  textureDecoder=null;rejectThumbnailRequests('Editor closed.');await texturePreviews.close();
  await Promise.allSettled([settingsStore?.flush(),recoveryStore.flush(),...textureOperations,...captureOperations]);
  for(const owner of new Set([...previewRecordings.jobs.values()].map(job=>job.owner)))await previewRecordings.closeOwner(owner);
  await textureResolver.close();
  // If the renderer crashed and the user closed its error dialog, keep the
  // journal for the next launch. A regular close/discard is deliberately quiet.
  if(!crashedWithEdits)await sessionJournal.close();
  try{await updater?.launchInstaller();}catch(error){await dialog.showMessageBox({type:'error',title:'MDLxL update',message:'The update could not start. Your current version is unchanged.',detail:error.message,buttons:['OK']});updater?.cancelClose();}
  app.quit();
});
