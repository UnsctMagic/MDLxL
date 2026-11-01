const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {root,launchApp,closeApp,stubDialogs} = require('./helpers/app.cjs');
const {testModel} = require('./helpers/fixtures.cjs');

const khorne = testModel('optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx');
const nurgle = testModel('surface-effects/WH_WOC_WarriorNurgle02.mdx');
const out = path.join(root,'out','surface-effects-warriors');

async function colourBalance(page,bytes) {
  return page.evaluate(async encoded=>{
    const image=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'}));
    const c=new OffscreenCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);image.close();
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    let warm=0,cold=0,gold=0;
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i]-pixels[i+2]>18)warm++;
      if(pixels[i+2]-pixels[i]>18)cold++;
      if(pixels[i]>130 && pixels[i+1]>75 && pixels[i+1]-pixels[i+2]>22 && pixels[i]-pixels[i+1]>12)gold++;
    }
    return {warm,cold,gold};
  },bytes.toString('base64'));
}

(async()=>{
 require('node:child_process').execFileSync(process.execPath,['--test',path.join(__dirname,'surface-effects-warriors.fixture.mjs')],{stdio:'inherit'});
 await fs.mkdir(out,{recursive:true});
 const {page,app,errors}=await launchApp({out,fixture:khorne,bounds:{x:-3000,y:0,width:1480,height:980}});
 const checks=[], dialog=page.getByRole('dialog',{name:'Surface Effects',exact:true});
 const button=name=>dialog.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{
   const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;
   const p=mdlxlProbe(el);
   return p.runtime?.captureApi.isReady && p.runtime.particleSourceModel===p.props.model && !document.querySelector('.sfx-apply')?.disabled;
 });
 const view=()=>dialog.locator('.sfx-stage').screenshot();
 const open=async()=>{await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();};
 const choose=async name=>{await button(name).click();await ready();};
 try{
   await page.waitForFunction(name=>mdlxlProbe().session?.path?.endsWith(name),path.basename(khorne));await open();await dialog.getByLabel('Geoset',{exact:true}).selectOption('12');
   const filter=dialog.getByLabel('Find a surface effect',{exact:true}),select=async name=>{await filter.fill(name);await choose(name+' global animation');};await select('Lightning blade');await button('Solo').click();await ready();await button('Fit selection').click();await button('Pause').click();
   const palette=dialog.getByRole('group',{name:'Colour swatches',exact:true});await palette.getByRole('button',{name:'Frostfire',exact:true}).click();await ready();const blue=await colourBalance(page,await view());assert.ok(blue.cold>100,'cold swatch changes the rendered surface');
   const picker=dialog.getByLabel('RGB tint',{exact:true}),selected=await picker.inputValue();await choose('Lightning blade global animation');assert.equal(await picker.inputValue(),selected,'clicking the active library entry preserves its colour');await button('Reset colour').click();await ready();assert.equal(await picker.inputValue(),'#519dff');
   await button('Original').click();await ready();await palette.getByRole('button',{name:'Amethyst',exact:true}).click();await ready();assert.equal(await button('Original').getAttribute('aria-pressed'),'false');
   await filter.fill('Terrain');for(const name of ['Molten lava','Lava fissures','Glacial fissures','Felwood poison'])await button(name+' global animation').waitFor();await filter.fill('no such effect');await dialog.getByText('No matching effects',{exact:true}).waitFor();await filter.fill('');assert.equal(await button('Auras').count(),0);checks.push('shared library search, no Auras, colour/reset and active entry preservation');
   await button('Cancel').click();await stubDialogs(app,{open:nurgle});await page.keyboard.press('Control+o');await page.waitForFunction(name=>mdlxlProbe().session?.path?.endsWith(name),path.basename(nurgle));await open();await dialog.getByLabel('Geoset',{exact:true}).selectOption('19');await select('Felwood poison');await button('Solo').click();await button('Fit selection').click();await ready();await page.screenshot({path:path.join(out,'warrior-workspace.png')});
   const source=await page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model));await button('Apply effect').click();await dialog.waitFor({state:'hidden'});await page.keyboard.press('Control+z');await page.waitForFunction(()=>!mdlxlProbe().session.doc.model.Geosets[19]._FxStack);assert.equal(await page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model)),source);assert.deepEqual(errors,[]);checks.push('Nurgle poison previews, applies and undoes exactly');await fs.writeFile(path.join(out,'result.json'),JSON.stringify({checks,blue},null,2));console.log(JSON.stringify({checks,blue}));
 }catch(error){
   if(!page.isClosed()){console.error((await page.locator('body').innerText()).slice(-1700));await page.screenshot({path:path.join(out,'failure.png')});}
   throw error;
 }finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
