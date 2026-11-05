// Check actual context creation before opening the editor or its recovery session.
// GPU feature status alone does not prove that WebGL can create a context.
async function restartWithSoftwareRendering({app,WebContentsView},platform=process.platform){
  if(platform!=='win32'||app.commandLine.hasSwitch('use-angle')||app.commandLine.hasSwitch('use-gl'))return false;
  // Playwright treats the transient probe as firstWindow; dedicated startup checks opt in.
  if(process.env.MDLXL_TEST_HOOK==='1'&&process.env.MDLXL_TEST_WEBGL_PROBE!=='1')return false;
  const probe=new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  let usable;
  try{
    await probe.webContents.loadURL('about:blank');
    usable=await probe.webContents.executeJavaScript(`(() => {
      return ['webgl2','webgl'].every(type => {
        const gl=document.createElement('canvas').getContext(type);
        if(!gl)return false;
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return true;
      });
    })()`);
  }finally{probe.webContents.close();}
  if(usable)return false;
  console.warn('WebGL is unavailable; restarting MDLxL with Windows software rendering (WARP).');
  app.relaunch({args:[...process.argv.slice(1),'--use-angle=d3d11-warp']});
  app.exit(0);
  return true;
}
module.exports={restartWithSoftwareRendering};
