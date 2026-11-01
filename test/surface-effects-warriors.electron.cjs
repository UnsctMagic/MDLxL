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
   await page.getByText('Opened '+path.basename(khorne),{exact:true}).waitFor();
   await open();await dialog.getByLabel('Geoset',{exact:true}).selectOption('17');await choose('Flaming skin');
   await button('Solo').click();await ready();await button('Fit selection').click();
   await button('Pause').click();
   await fs.writeFile(path.join(out,'flame.png'),await view());
   const palette=dialog.getByRole('group',{name:'Colour swatches',exact:true});
   assert.equal(await palette.count(),1,'A preset exposes named quick colours');
   const first=await colourBalance(page,await view());
   assert.ok(first.gold>100&&first.warm>first.cold*2,'Flaming skin shows orange and gold on the previously magenta axe: '+JSON.stringify(first));
   const filter=dialog.getByLabel('Find a surface effect',{exact:true});
   await filter.fill('embers');await choose('Fire Lord embers');
   assert.equal(await dialog.locator('.sfx-card').count(),1);
   await palette.getByRole('button',{name:'Frostfire',exact:true}).click();await ready();
   const blue=await colourBalance(page,await view());
   assert.ok(blue.cold>100&&blue.cold>blue.warm*2,'Frostfire visibly changes the ember surface to blue');
   const picker=dialog.getByLabel('RGB tint',{exact:true}), selected=await picker.inputValue();
   await choose('Fire Lord embers');assert.equal(await picker.inputValue(),selected,'Clicking the current card preserves its colour');
   await button('Reset colour').click();await ready();
   assert.equal(await picker.inputValue(),'#ff3600','Reset restores the Fire Lord colour');
   checks.push('Visible warm flame, blue swatch, actual picker value, preset reset and stable active card');

   await button('Cancel').click();await open();
   await dialog.getByLabel('Geoset',{exact:true}).selectOption('12');await choose('Flaming skin');
   await page.screenshot({path:path.join(out,'khorne-workspace.png')});
   await button('Solo').click();await ready();await button('Fit selection').click();await button('Pause').click();
   await fs.writeFile(path.join(out,'pauldrons.png'),await view());
   await button('Original').click();await ready();await dialog.locator('.sfx-comparison').waitFor();
   await palette.getByRole('button',{name:'Copper',exact:true}).click();await ready();
   assert.equal(await button('Original').getAttribute('aria-pressed'),'false','Adjusting the colour returns to the effect');
   await filter.fill('');await button('Terrain').click();
   for(const name of ['Molten lava','Lava fissures','Glacial fissures','Felwood poison'])await button(name).waitFor();
   await button('Replace').click();await choose('Lava fissures');assert.equal(await button('Replace').getAttribute('aria-pressed'),'true');
   await filter.fill('no such effect');await dialog.getByText('No matching effects',{exact:true}).waitFor();
   await filter.fill('');await button('Play').click();await ready();
   await fs.writeFile(path.join(out,'lava.png'),await view());
   checks.push('Terrain browsing, search, empty results and preserved application mode');

   await button('Cancel').click();await stubDialogs(app,{open:nurgle});
   await page.keyboard.press('Control+o');await page.getByText('Opened '+path.basename(nurgle),{exact:true}).waitFor();
   await open();await dialog.getByLabel('Geoset',{exact:true}).selectOption('19');await choose('Felwood poison');
   const before=await page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model));
   await button('Solo').click();await ready();await button('Fit selection').click();
   await page.screenshot({path:path.join(out,'warrior-workspace.png')});
   await button('Apply effect').click();await dialog.waitFor({state:'hidden'});
   const save=path.join(out,'poison-warrior.mdx');await stubDialogs(app,{save});
   await page.keyboard.press('F12');await page.getByRole('button',{name:'Save MDX…',exact:true}).click();
   await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
   const {openDocument}=await import('../src/editor-document.js'),result=openDocument(await fs.readFile(save),'poison-warrior.mdx').model;
   const original=JSON.parse(before),g=result.Geosets[19],layer=result.Materials[g.MaterialID].Layers.at(-1);
   assert.equal(result.Textures.length,original.Textures.length,'Reuse existing poison texture');
   assert.equal(result.Geosets.length,original.Geosets.length);
   assert.ok(layer.CoordId>0 && result.TextureAnims[layer.TVertexAnimId]?.Translation?.Keys?.length>1);
   await page.keyboard.press('Control+z');
   await page.waitForFunction(n=>mdlxlProbe().session.doc.model.Materials.length===n,original.Materials.length);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(mdlxlProbe().session.doc.model))),original);
   checks.push('Nurgle native poison overlay saves, reopens and undoes in one step');
   assert.deepEqual(errors,[]);
   await fs.writeFile(path.join(out,'result.json'),JSON.stringify({checks,flame:first,frostfire:blue},null,2));
   console.log(JSON.stringify({checks,flame:first,frostfire:blue}));
 }catch(error){
   if(!page.isClosed()){console.error((await page.locator('body').innerText()).slice(-1700));await page.screenshot({path:path.join(out,'failure.png')});}
   throw error;
 }finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
