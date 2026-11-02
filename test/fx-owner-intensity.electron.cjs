const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {root,launchApp,closeApp}=require('./helpers/app.cjs'),{testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const {GLOBAL_LOOKS}=await import('../src/global-animation-looks.js'),out=path.join(root,'out/review/intensity');fs.mkdirSync(out,{recursive:true});const {app,page,errors}=await launchApp({fixture:testModel(process.env.FX_MODEL||'surface-effects/WH_WOC_WarriorNurgle02.mdx'),out:path.join(root,'out/intensity-profile'),bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),button=n=>fx.getByRole('button',{name:n,exact:true});const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout:60000});const report=[];
 try{
  for(const look of GLOBAL_LOOKS.filter(l=>!l.impact&&(!process.env.FX_LOOKS||process.env.FX_LOOKS.split(',').includes(l.id)))){
   await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption(process.env.FX_PART??(look.group==='Blades'?'19':'8'));await fx.getByLabel('Find a surface effect').fill(look.name);await button(look.name+' global animation').click();await ready();await button('Fit selection').click();const stage=fx.locator('.sfx-stage'),box=await stage.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,180);
   for(const [i,layer] of look.layers.entries()){
    if(layer.type==='Particles'||layer.type==='Edge'||layer.stamp)continue;
    if(layer.enabled===false){await fx.getByLabel('Enable '+layer.label,{exact:true}).check();await ready();}
    await fx.getByRole('group',{name:'Layers'}).getByRole('button').nth(i).click();const range=fx.getByRole('slider',{name:'Intensity',exact:true});assert.equal(await range.count(),1);await range.scrollIntoViewIfNeeded();const b=await range.boundingBox(),values=[];
    for(const [name,fraction] of [['min',0],['middle',.5],['max',1]]){
     await page.mouse.click(b.x+8+(b.width-16)*fraction,b.y+b.height/2);if(fraction===0)await page.keyboard.press('Home');if(fraction===1)await page.keyboard.press('End');await ready();
     const prior=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame());await page.waitForFunction(t=>Math.abs(mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame()-t)>200,prior);const value=Number(await range.inputValue());values.push(value);await stage.screenshot({path:path.join(out,look.id+'-'+i+'-'+name+'.jpg'),type:'jpeg',quality:90});
    }
    assert.equal(values[0],0);assert.ok(values[0]<values[1]&&values[1]<values[2]);report.push({look:look.id,layer:layer.label,values});
    // Restore the default with ordinary repeated arrow keydowns before reviewing another layer.
    await range.click();await page.keyboard.press('Home');const count=Math.round((layer.strength??1)/.01);for(let n=0;n<count;n++)await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');await ready();
   }
   await button('Cancel').click();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('RANGE',look.name);
  }assert.deepEqual(errors,[]);console.log('TOTAL',report.length,'intensity ranges; 0 failures; 0 skips');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
