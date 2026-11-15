const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,launchApp,closeApp}=require('../test/helpers/app.cjs');
const {fixturePath}=require('../test/helpers/fixtures.cjs');
(async()=>{
 const out=path.join(root,'out/fx-flies-death');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:0,y:0,width:1280,height:920},settings:{preferences:{language:'en',learn:{enabled:false}}}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage');
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  const search=fx.getByLabel('Find a surface effect');await search.click();await page.keyboard.type('Fly swarm');await fx.getByRole('button',{name:'Fly swarm global animation',exact:true}).click();await ready();
  const rise=fx.getByRole('checkbox',{name:'Rise on Death',exact:true});assert.equal(await rise.count(),1,'Rise on Death switch is offered');assert.equal(await rise.isChecked(),false,'off by default');
  await rise.check();await ready();
  const clips=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Sequences.map(s=>({name:s.Name,range:Array.from(s.Interval)}))),death=clips.find(s=>/^death\b/i.test(s.name));assert.ok(death);
  const scale=Math.min(1,(death.range[1]-death.range[0])/2170),animation=fx.getByLabel('Preview animation',{exact:true});
  await fx.getByRole('button',{name:'Fit selection',exact:true}).click();await stage.hover();await page.mouse.wheel(0,450);
  const shots=[];
  for(const [label,time] of [['rising',1100],['hidden',2050]]){
   await animation.selectOption({label:clips.find(s=>/^stand\b/i.test(s.name)).name});await animation.selectOption({label:death.name});
   await page.waitForFunction(({start,offset})=>{const f=mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame()-start;return f>=offset&&f<offset+180;},{start:death.range[0],offset:time*scale});
   shots.push(await page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),m=p.props.model,h=m.Bones.find(b=>b._FxTag?.endsWith('/swarm'));return {frame:p.runtime.native.getFrame(),sequence:p.props.sequenceIndex,selected:document.querySelector('[aria-label="Preview animation"]').value,playing:p.props.playing,matrix:Array.from(p.runtime.native.rendererData.nodes[h.ObjectId].matrix),translation:h.Translation,alpha:m.Materials.find(a=>a._FxTag?.endsWith('/material')&&a.Layers[0].Alpha?.Keys)?.Layers[0].Alpha};}));
   await stage.screenshot({path:path.join(out,label+'.png')});
  }
  fs.writeFileSync(path.join(out,'observed.json'),JSON.stringify({death,shots},null,2));
  assert.ok(shots.every(s=>s.translation?.Keys&&s.alpha?.Keys));assert.ok(shots[1].matrix[14]>shots[0].matrix[14],'live helper continues rising');
  await rise.uncheck();await ready();assert.equal(await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Bones.find(b=>b._FxTag?.endsWith('/swarm')).Translation),undefined);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({shots,errors},null,2));console.log('PASS Rise on Death defaults off, rises in live preview, hides, and switches off');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
