const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,root,stubDialogs}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const {GLOBAL_LOOKS}=await import('../src/global-animation-looks.js');
 const out=path.join(root,'out/review/motion');fs.mkdirSync(out,{recursive:true});
 const targets=[['slaanesh',testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),28,26,27],['khorne',testModel('optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx'),18,12,16],['nurgle',testModel('surface-effects/WH_WOC_WarriorNurgle02.mdx'),19,8],['wolf',testModel('corpus-sd/creeps__direwolf.mdx'),0,0],['footman',testModel('pose/Footman.mdx'),0,0],['paladin',testModel('corpus-sd/human__heropaladin.mdx'),0,0],['abomination',testModel('corpus-sd/undead__abomination.mdx'),0,0]];
 const selected=(process.env.FX_MODELS||'slaanesh').split(','),lookIds=process.env.FX_LOOKS?.split(',');
 const {app,page,errors}=await launchApp({fixture:targets.find(t=>selected.includes(t[0]))[1],out:path.join(root,'out/motion-profile'),bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),button=n=>fx.getByRole('button',{name:n,exact:true});
 const ready=()=>page.waitForFunction(()=>{const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;const p=mdlxlProbe(el);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout:60000});
 const report=[];
 try{
  await stubDialogs(app,{message:1});
  for(const [model,file,weapon,body,runePart=weapon] of targets.filter(t=>selected.includes(t[0]))){
   await stubDialogs(app,{open:file});await page.keyboard.press('Control+o');await page.waitForFunction(n=>mdlxlProbe().session?.path?.endsWith(n),path.basename(file));
   for(const look of GLOBAL_LOOKS.filter(l=>!lookIds||lookIds.includes(l.id))){
    await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
    const part=Number(process.env.FX_PART??(look.id==='rune-blade'?runePart:look.group==='Blades'||look.impact?weapon:body));
    await fx.getByLabel('Geoset',{exact:true}).selectOption(String(part));await fx.getByLabel('Find a surface effect').fill(look.name);await button(look.name+(look.impact?' impact':' global animation')).click();await ready();
    const stand=await fx.getByLabel('Preview animation').locator('option').evaluateAll(a=>a.find(o=>o.textContent.startsWith('Stand')).value);await fx.getByLabel('Preview animation').selectOption(stand);await ready();
    await button('Fit selection').click();const stage=fx.locator('.sfx-stage'),box=await stage.boundingBox();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,look.group==='Blades'||look.impact?430:300);
    const entry={model,look:look.id,part:part+1,clips:[]};
    for(const name of (process.env.FX_CLIPS||'Stand,Walk,Attack').split(',')){
     const seq=await fx.getByLabel('Preview animation').locator('option').evaluateAll((a,n)=>a.find(o=>o.textContent.startsWith(n))?.value,name);if(seq==null)throw Error(model+' missing '+name);
     await fx.getByLabel('Preview animation').selectOption(seq);await ready();
     const dir=path.join(out,model,look.id,name);fs.mkdirSync(dir,{recursive:true});
     const time=()=>page.evaluate(impact=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),n=p.runtime.native,s=p.props.model.Geosets.find(g=>g._FxStack)?._FxStack;return impact?n.getFrame():n.rendererData.globalSequencesFrames[p.props.model.GlobalSequences.indexOf(s.loop)];},look.impact);let previous=await time();
     const frames=[];
     for(let i=0;i<8;i++){
      await page.waitForFunction(({previous,step,impact})=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),n=p.runtime.native,s=p.props.model.Geosets.find(g=>g._FxStack)?._FxStack,t=impact?n.getFrame():n.rendererData.globalSequencesFrames[p.props.model.GlobalSequences.indexOf(s.loop)];return t<previous||t-previous>=step;},{previous,step:look.impact?100:look.loop/7,impact:look.impact},{timeout:20000});
      const data=await page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return {frame:p.runtime.native.getFrame(),globals:Array.from(p.runtime.native.rendererData.globalSequencesFrames||[]),particles:p.runtime.native.particlesController.emitters.map(e=>e.particles.length)};});previous=await time();frames.push(data);
      await stage.screenshot({path:path.join(dir,i+'.jpg'),type:'jpeg',quality:80});
      if(i===3){await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,-280);const camera=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());const x=box.x+box.width*.72,y=box.y+box.height*.4;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+52,y+12,{steps:8});await page.mouse.up();const after=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());assert.notDeepEqual(after,camera,'mouse orbit '+look.id);}
     }
     if(look.impact&&name==='Attack'){await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.some(e=>e.props._FxTag&&e.particles.length),null,{timeout:8000});await stage.screenshot({path:path.join(dir,'burst.jpg'),type:'jpeg',quality:90});}
     entry.clips.push({name,frames});await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,280);
    }
    report.push(entry);fs.writeFileSync(path.join(out,selected.join('-')+'-report.json'),JSON.stringify(report,null,2));console.log('REVIEW',model,look.id);await button('Cancel').click();
   }
  }
  assert.deepEqual(errors,[]);
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});console.error((await page.locator('body').innerText()).slice(-1700));throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
