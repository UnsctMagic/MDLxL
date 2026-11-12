const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,root}=require('./helpers/app.cjs'),{fixturePath}=require('./helpers/fixtures.cjs'),{addEmitter}=require('./helpers/fx-input.cjs');
(async()=>{
 const step=Number(process.env.FX_PLACEMENT_STEP||2),out=path.join(root,'out/placement/ui');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:0,y:0,width:1450,height:960},settings:{preferences:{language:'en',learn:{enabled:false}}}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage'),button=name=>fx.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const read=()=>page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),s=p.props.model.Geosets[0]._FxStack;return {stack:s,nodes:p.props.model.ParticleEmitters2.filter(n=>n._FxTag?.startsWith(s.owner+'/')),camera:p.runtime.controls.object.position.toArray()};});
 const drag=async(label,dx,dy)=>{
  const knob=fx.getByRole('slider',{name:label,exact:true}).locator('circle');await knob.waitFor();
  const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.mouse.up();await ready();
  if(label==='Move emitter'){const b=await knob.boundingBox();assert.ok(Math.hypot(b.x+b.width/2-x-dx,b.y+b.height/2-y-dy)<12,'the selected move handle follows the real pointer '+JSON.stringify({start:[x,y],end:[b.x+b.width/2,b.y+b.height/2],delta:[dx,dy]}));}
 };
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  await fx.getByLabel('Geoset',{exact:true}).selectOption('0');await ready();
  const search=fx.getByLabel('Find a surface effect');await search.click();await page.keyboard.type('Empty');await button('Empty global animation').click();await ready();
  await addEmitter(page,fx,'Flames',ready);
  const orbitBefore=(await read()).camera,stageBox=await stage.boundingBox();
  await page.mouse.move(stageBox.x+stageBox.width*.8,stageBox.y+stageBox.height*.6);await page.mouse.down();await page.mouse.move(stageBox.x+stageBox.width*.8+55,stageBox.y+stageBox.height*.6+18,{steps:8});await page.mouse.up();
  assert.notDeepEqual((await read()).camera,orbitBefore,'normal mouse orbit remains available');
  await button('Fit selection').click();await button('Position & size').click();await ready();
  await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props._FxTag).reduce((n,e)=>n+e.particles.length,0)>20);
  const before=await read();await stage.screenshot({path:path.join(out,'span-before.png')});
  await drag('Ribbon upper edge',-24,-45);
  const after=await read();assert.notEqual(after.stack.layers[0].upper,before.stack.layers[0].upper,'upper handle changed its value');
  assert.notDeepEqual(after.nodes.map(n=>n.PivotPoint),before.nodes.map(n=>n.PivotPoint),'upper handle visibly moves emitter sites on the many-region body');
  assert.ok(Math.hypot(...after.camera.map((v,i)=>v-before.camera[i]))<1e-8,'placement preserves the camera (floating-point orbit recomposition only)');
  await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props._FxTag).reduce((n,e)=>n+e.particles.length,0)>20);
  await stage.screenshot({path:path.join(out,'span-after.png')});
  if(step>=3){
   const slider=fx.getByRole('slider',{name:'Formation',exact:true});assert.equal(await slider.count(),1,'Formation slider is offered');
   const before=await read(),box=await slider.boundingBox();await page.mouse.click(box.x+box.width*.25,box.y+box.height/2);await ready();
   const after=await read();assert.ok(after.stack.layers[0].formation>.3&&after.stack.layers[0].formation<.7,'formation commits on release');
   assert.notDeepEqual(after.nodes.map(n=>n.PivotPoint),before.nodes.map(n=>n.PivotPoint),'formation changes the actual sites');
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props._FxTag).reduce((n,e)=>n+e.particles.length,0)>20);
   await stage.screenshot({path:path.join(out,'formation-tight.png')});
  }
  if(step>=4){
   const markers=fx.locator('.fx-emitter-markers [role=button]');assert.ok(await markers.count()>1,'each emitter has a marker');
   const before=await read();await markers.first().click();await ready();
   assert.equal(await fx.getByRole('heading',{name:'Flames 1',exact:true}).count(),1,'panel names the selected emitter');
   await drag('Move emitter',150,-100);
   const after=await read(),moved=after.nodes.filter(n=>JSON.stringify(n.PivotPoint)!==JSON.stringify(before.nodes.find(p=>p._FxTag===n._FxTag).PivotPoint));
   assert.equal(moved.length,1,'real drag moves exactly one emitter');
   await fx.getByLabel('RGB tint').fill('#ff0000');await ready();const red=await read();
   assert.equal(red.nodes.filter(n=>n.SegmentColor[1][1]===0).length,1,'colour affects one emitter');
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.some(e=>e.props._FxTag&&e.props.SegmentColor[1][1]===0&&e.particles.length>0));
   await stage.screenshot({path:path.join(out,'individual-red.png')});
   await page.keyboard.press('Escape');await ready();assert.equal(await fx.getByRole('heading',{name:'Flames 1',exact:true}).count(),0,'Escape returns to the layer');
   assert.equal(await fx.count(),1,'Escape keeps FX open');
   const candidates=()=>page.evaluate(()=>{
    const snapshot=findFiberState('.sfx-stage .game-preview-root',v=>v?.marks&&v?.camera&&v?.samples,{current:true}),box=document.querySelector('.sfx-stage').getBoundingClientRect(),marks=[...document.querySelectorAll('.fx-emitter-markers circle')].map(c=>{const b=c.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2];}),out=[];
    const p=mdlxlProbe('.sfx-stage .game-preview-root'),camera=snapshot.camera,project=v=>{const V=camera.matrixWorldInverse.elements,P=camera.projectionMatrix.elements, x=V[0]*v[0]+V[4]*v[1]+V[8]*v[2]+V[12],y=V[1]*v[0]+V[5]*v[1]+V[9]*v[2]+V[13],z=V[2]*v[0]+V[6]*v[1]+V[10]*v[2]+V[14],w=P[3]*x+P[7]*y+P[11]*z+P[15];return [(P[0]*x+P[4]*y+P[8]*z+P[12])/w,(P[1]*x+P[5]*y+P[9]*z+P[13])/w];};
    const wrappers=p.runtime.native.particlesController.emitters.filter(e=>e.props._FxTag&&e.props.SegmentColor[1][1]===0);
    for(const wrapper of wrappers)for(let i=0;i<wrapper.particles.length;i++)for(const u of [.5,.25,.75])for(const v of [.5,.25,.75]){
     const points=[0,1,2,3].map(k=>project(wrapper.headVertices.subarray(i*12+k*3,i*12+k*3+3))),weights=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v],x=box.x+(1+points.reduce((n,p,i)=>n+p[0]*weights[i],0))*box.width/2,y=box.y+(1-points.reduce((n,p,i)=>n+p[1]*weights[i],0))*box.height/2;
     if(x>box.x+12&&x<box.right-12&&y>box.y+12&&y<box.bottom-12&&marks.every(m=>Math.hypot(x-m[0],y-m[1])>10))out.push({x,y});
    }return out.slice(0,9);
   });
   let picked=false;
   for(let attempt=0;attempt<20&&!picked;attempt++){const picks=await candidates();for(const point of picks.slice(0,1)){await page.mouse.click(point.x,point.y);if(await fx.locator('.sfx-controls h4').count()){picked=true;break;}}}
   assert.ok(picked,'a real single click on particles selects one emitter');
   await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Flames/}).click();await ready();
   assert.equal(await fx.locator('.sfx-controls h4').count(),0,'layer button returns to the whole layer');
   assert.equal(await button('Position & size').getAttribute('aria-pressed'),'true','layer return keeps placement available');
  }
  assert.deepEqual(errors,[]);console.log('PASS layer span moves emitter sites; camera preserved');
 }catch(error){await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});

