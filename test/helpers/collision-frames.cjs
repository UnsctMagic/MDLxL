const fs = require('node:fs'), path = require('node:path');
const {PNG}=require(path.join(path.dirname(require.resolve(process.env.MDLXL_REAL_PLAYWRIGHT||'playwright-core')),'lib/utilsBundle.js'));
// CDP captures compositor output without screenshot stabilization or forced rendering.
exports.captureFlashFrames=async function(page,app,out,name,action,count=120){
 const bounds=await page.locator('.ox-preview .game-preview-root').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 const dpr=await page.evaluate(()=>devicePixelRatio);
 await page.evaluate(()=>{window.flashMutations={added:0,removed:0};window.flashObserver?.disconnect();window.flashObserver=new MutationObserver(rs=>{for(const r of rs)for(const [k,ns]of [['added',r.addedNodes],['removed',r.removedNodes]])for(const n of ns)if(n.matches?.('[data-clean-model-canvas]'))window.flashMutations[k]++;});window.flashObserver.observe(document.body,{childList:true,subtree:true});});
 const cdp=await page.context().newCDPSession(page), captures=[];
 const capture=async()=>{for(let i=0;i<count;i++){const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});captures.push(Buffer.from(data,'base64'));}};
 await Promise.all([capture(),action?.()]);await cdp.detach();
 const mutations=await page.evaluate(()=>{window.flashObserver.disconnect();return window.flashMutations;});
 const frames=captures.map((buffer,i)=>{const image=PNG.sync.read(buffer),panes=bounds.map(r=>{let black=0,n=0;for(let y=Math.ceil(r.y*dpr);y<(r.y+r.height)*dpr;y+=3)for(let x=Math.ceil(r.x*dpr);x<(r.x+r.width)*dpr;x+=3){const p=(y*image.width+x)*4;n++;if(image.data[p]<24&&image.data[p+1]<24&&image.data[p+2]<24)black++;}return {black:black/n};});if(i===0||panes.some(p=>p.black>.9))fs.writeFileSync(path.join(out,name+'-'+i+'.png'),buffer);return panes;});
 const result={name,count,panes:bounds.map((_,p)=>({mostlyBlack:frames.filter(f=>f[p].black>.9).length,maxBlack:Math.max(...frames.map(f=>f[p].black))})),mutations,frames};fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2));return result;
};
