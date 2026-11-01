// Separate start path. MDLxL's real main process runs against the lab copy only.
const path=require('node:path'),fs=require('node:fs'),{app,ipcMain}=require('electron');
const root=path.resolve(__dirname,'..'),folder=app.isPackaged?path.dirname(process.execPath):root;
process.env.MDLXL_PROFILE ||= path.join(folder,'lab-profile');
process.env.TEMP=process.env.TMP=path.join(folder,'temp');fs.mkdirSync(process.env.TEMP,{recursive:true});
ipcMain.handle('rotationLab:fixtures',()=>['human__footman.mdx','Box.mdx'].map(name=>({name,path:path.join(root,'lab-models',name),bytes:Array.from(fs.readFileSync(path.join(root,'lab-models',name)))})));
ipcMain.on('rotationLab:log',(_event,record)=>fs.appendFileSync(path.join(folder,'rotation-drags.jsonl'),JSON.stringify({time:new Date().toISOString(),...record})+'\n'));
require('./main.cjs');
