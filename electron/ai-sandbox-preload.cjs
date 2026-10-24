const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('aiSandbox',{
  onRun:callback=>ipcRenderer.once('ai-sandbox:run',(_,payload)=>callback(payload)),
  finish:value=>ipcRenderer.send('ai-sandbox:result',value),
});
