const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {root,launchApp,closeApp,stubDialogs} = require('./helpers/app.cjs');
const {testModel} = require('./helpers/fixtures.cjs');

const out=path.join(root,'out','surface-effects-uv');
const geoset=19;

// Equivalent MDX files let the renderer itself prove that it honours CoordId.
// Keep a third file with the Warrior's original UVs as a visible negative control.
async function makeComparisonFiles(){
  const {openDocument}=await import('../src/editor-document.js');
  const {SURFACE_EFFECTS,applySurfaceEffect,defaultEffectOptions}=await import('../src/surface-effects.js');
  const file=testModel('surface-effects/WH_WOC_WarriorNurgle02.mdx');
  const doc=openDocument(await fs.readFile(file),file), model=doc.model;
  const effect=SURFACE_EFFECTS.find(entry=>entry.id==='poison');
  applySurfaceEffect(model,null,effect,{...defaultEffectOptions(effect),geoset});
  const g=model.Geosets[geoset], material=model.Materials[g.MaterialID];
  const layer=material.Layers.at(-1), overlayUV=g.TVertices[layer.CoordId], originalUV=g.TVertices[0];
  assert.ok(layer.CoordId>0 && overlayUV.some((v,i)=>v!==originalUV[i]));
  material.Layers=[layer];Object.assign(layer,{FilterMode:0,TVertexAnimId:null,Alpha:1});
  const stand=model.Sequences.find(s=>s.Name==='Stand')||model.Sequences[0];
  model.Sequences=[{...stand,Interval:new Uint32Array([stand.Interval[0],stand.Interval[0]+1])}];
  const names=[];
  for(const name of ['Layer set','Equivalent base set','Authored base set']){
    const target=path.join(out,name+'.mdx');
    if(name!=='Layer set'){layer.CoordId=0;g.TVertices[0]=name==='Equivalent base set'?overlayUV:originalUV;}
    await fs.writeFile(target,doc.serialize('mdx'));names.push(target);
  }
  return names;
}

async function differences(page,bytes){
  return page.evaluate(async pngs=>{
    const images=await Promise.all(pngs.map(async value=>{
      const data=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
      const image=await createImageBitmap(new Blob([data],{type:'image/png'}));
      const canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d');
      ctx.drawImage(image,0,0);image.close();return ctx.getImageData(0,0,canvas.width,canvas.height).data;
    }));
    function changed(a,b){
      let count=0;
      for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>24)count++;
      return count;
    }
    return {equivalent:changed(images[0],images[1]),different:changed(images[1],images[2])};
  },bytes.map(b=>b.toString('base64')));
}

(async()=>{
  await fs.mkdir(out,{recursive:true});const files=await makeComparisonFiles();
  const {page,app,errors}=await launchApp({out,fixture:files[0]});
  const dialog=page.getByRole('dialog',{name:'Surface Effects',exact:true});
  const button=name=>dialog.getByRole('button',{name,exact:true});
  const ready=()=>page.waitForFunction(()=>{
    const el=document.querySelector('.sfx-stage .game-preview-root');
    if(!el)return false;
    const p=mdlxlProbe(el);
    return p.runtime?.captureApi.isReady && p.runtime.particleSourceModel===p.props.model && !document.querySelector('.sfx-apply')?.disabled;
  });
  try{
    const frames=[];
    for(const [i,file] of files.entries()){
      if(i){await stubDialogs(app,{open:file});await page.keyboard.press('Control+o');}
      await page.getByText('Opened '+path.basename(file),{exact:true}).waitFor();
      await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
      await dialog.getByLabel('Geoset',{exact:true}).selectOption(String(geoset));await ready();
      await button('Original').click();await ready();
      await button('Pause').click();await button('Solo').click();await ready();
      await button('Fit selection').click();
      frames.push(await dialog.locator('.sfx-stage').screenshot());
      await button('Cancel').click();
    }
    const diff=await differences(page,frames);
    console.log(JSON.stringify(diff));
    assert.ok(diff.different>250,'The original Warrior UVs visibly differ from the fitted tile');
    assert.ok(diff.equivalent<diff.different*.015,'Saved layer UVs render like the equivalent base UV set: '+JSON.stringify(diff));
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify(diff));
  }finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
