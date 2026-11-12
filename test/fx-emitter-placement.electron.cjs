const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,root}=require('./helpers/app.cjs'),{fixturePath}=require('./helpers/fixtures.cjs'),{addEmitter}=require('./helpers/fx-input.cjs');
(async()=>{
 const out=path.join(root,'out/placement/ui');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:0,y:0,width:1450,height:960},settings:{preferences:{language:'en',learn:{enabled:false}}}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage'),button=name=>fx.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const read=()=>page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),s=p.props.model.Geosets[0]._FxStack;return {stack:s,nodes:p.props.model.ParticleEmitters2.filter(n=>n._FxTag?.startsWith(s.owner+'/')),camera:p.runtime.controls.object.position.toArray()};});
 const drag=async(label,dx,dy)=>{
  const knob=fx.getByRole('slider',{name:label,exact:true}).locator('circle');await knob.waitFor();
  const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.mouse.up();await ready();
 };
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  await fx.getByLabel('Geoset',{exact:true}).selectOption('0');await ready();
  const search=fx.getByLabel('Find a surface effect');await search.click();await page.keyboard.type('Empty');await button('Empty global animation').click();await ready();
  await addEmitter(page,fx,'Flames',ready);await button('Fit selection').click();await button('Position & size').click();await ready();
  await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props._FxTag).reduce((n,e)=>n+e.particles.length,0)>20);
  const before=await read();await stage.screenshot({path:path.join(out,'span-before.png')});
  await drag('Ribbon upper edge',-24,-45);
  const after=await read();assert.notEqual(after.stack.layers[0].upper,before.stack.layers[0].upper,'upper handle changed its value');
  assert.notDeepEqual(after.nodes.map(n=>n.PivotPoint),before.nodes.map(n=>n.PivotPoint),'upper handle visibly moves emitter sites on the many-region body');
  assert.ok(Math.hypot(...after.camera.map((v,i)=>v-before.camera[i]))<1e-8,'placement preserves the camera (floating-point orbit recomposition only)');
  await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props._FxTag).reduce((n,e)=>n+e.particles.length,0)>20);
  await stage.screenshot({path:path.join(out,'span-after.png')});
  assert.deepEqual(errors,[]);console.log('PASS layer span moves emitter sites; camera preserved');
 }catch(error){await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});

