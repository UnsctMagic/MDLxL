const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,launchApp,closeApp}=require('./helpers/app.cjs'),{testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.join(root,'out/fifth-owner');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage'),button=name=>fx.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await button(name+' global animation').click();await ready();};
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption('0');await choose('Ice skin');
  assert.equal(await fx.getByLabel('Ice variation',{exact:true}).count(),1,'Ice skin has its finish selector');
  for(const variation of ['dark','white','dark']){
   await fx.getByLabel('Ice variation',{exact:true}).selectOption(variation);await ready();
   const state=await page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),m=p.props.model,g=m.Geosets.find(g=>g._FxStack);return {stack:g._FxStack,images:m.Textures.map(t=>t.Image),mist:m.ParticleEmitters2.filter(e=>e.Name.startsWith('FX Falling mist')).length};});
   assert.equal(state.mist>0,true,'mist remains on '+variation);assert.equal(state.stack.iceVariation,variation);assert.ok(state.images.some(s=>variation==='white'?/North_Snow/i.test(s):/Ice_Natural01/i.test(s)));
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.some(e=>e.props.Name.startsWith('FX Falling mist')&&e.particles.length>0));
   await stage.screenshot({path:path.join(out,'ice-'+variation+'.jpg'),type:'jpeg',quality:90});
  }
  await choose('Soul lantern');await button('Fit selection').click();await fx.locator('.fx-uv-fit').screenshot({path:path.join(out,'soul-uv.jpg'),type:'jpeg',quality:92});await stage.screenshot({path:path.join(out,'soul-chest.jpg'),type:'jpeg',quality:92});
  await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await choose('Lightning blade');await button('Fit selection').click();await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Blade arcs/}).click();
  for(const [name,v] of [['Burst duration (s)','0.7'],['Time between bursts (s)','2'],['Flashes per burst','2']]){await fx.getByLabel(name,{exact:true}).fill(v);await fx.getByLabel(name,{exact:true}).press('Enter');await ready();}
  const active=on=>page.waitForFunction(on=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),m=p.props.model,s=m.Geosets.find(g=>g._FxStack)._FxStack,l=s.layers.find(l=>l.powerArcs),g=m.Geosets.find(g=>g._FxTag===s.owner+'/'+l.id+'/shape'),a=m.Materials[g.MaterialID].Layers[0].Alpha,t=p.runtime.native.rendererData.globalSequencesFrames[a.GlobalSeqId];let v=0;for(const k of a.Keys){if(k.Frame>t)break;v=k.Vector[0];}return on?v>0:v===0;},on);
  for(let i=0;i<4;i++){await active(false);await active(true);await stage.screenshot({path:path.join(out,'power-'+i+'.jpg'),type:'jpeg',quality:92});}
  const b=await stage.boundingBox(),before=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());await page.mouse.move(b.x+b.width*.65,b.y+b.height*.42);await page.mouse.down();await page.mouse.move(b.x+b.width*.65+70,b.y+b.height*.42+12,{steps:10});await page.mouse.up();assert.notDeepEqual(await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray()),before);await active(true);await stage.screenshot({path:path.join(out,'power-orbit.jpg'),type:'jpeg',quality:92});
  assert.deepEqual(errors,[]);console.log('PASS ice variations retain mist, screenshot UV placement, surface flashes, burst controls and mouse orbit.');
 }catch(e){await page.screenshot({path:path.join(out,'failure.jpg')});throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});