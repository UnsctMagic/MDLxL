const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,root,stubDialogs}=require('./helpers/app.cjs'),{fixturePath}=require('./helpers/fixtures.cjs'),{addEmitter}=require('./helpers/fx-input.cjs');
(async()=>{
 const step=Number(process.env.FX_PLACEMENT_STEP||2),part=Number(process.env.FX_PLACEMENT_PART||0),out=path.join(root,part===2?'out/placement/ui-sword':'out/placement/ui');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:0,y:0,width:1450,height:960},settings:{preferences:{language:'en',learn:{enabled:false}}}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage'),button=name=>fx.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const read=()=>page.evaluate(part=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),s=p.props.model.Geosets[part]._FxStack;return {stack:s,nodes:p.props.model.ParticleEmitters2.filter(n=>n._FxTag?.startsWith(s.owner+'/')),camera:p.runtime.controls.object.position.toArray()};},part);
 const pickMarker=async(blended=false)=>{
  const exposed=blended=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),m=p.props.model,prefix=m.Nodes[p.props.particleSelectedId]._FxTag.split('/').slice(0,2).join('/')+'/',nodes=m.ParticleEmitters2.filter(n=>n._FxTag?.startsWith(prefix)).sort((a,b)=>a.ObjectId-b.ObjectId);for(const e of document.querySelectorAll('.fx-emitter-markers [role=button]')){const ordinal=Number(e.getAttribute('aria-label').match(/(\d+)$/)?.[1])-1;if(blended&&!m.Nodes[nodes[ordinal]?.Parent]?._FxTag?.includes('/binding-'))continue;const b=e.querySelector('circle').getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;if(document.elementFromPoint(x,y)?.closest('[role=button]')===e)return {x,y,label:e.getAttribute('aria-label')};}return null;};
  await page.waitForFunction(exposed,blended);const marker=await page.evaluate(exposed,blended);
  await page.mouse.click(marker.x,marker.y);await fx.getByRole('heading',{name:marker.label,exact:true}).waitFor();return marker.label;
 };
 const drag=async(label,dx,dy)=>{
  const knob=fx.getByRole('slider',{name:label,exact:true}).locator('circle');await knob.waitFor();
  const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.mouse.up();await ready();
  if(label==='Move emitter'){const b=await knob.boundingBox();assert.ok(Math.hypot(b.x+b.width/2-x-dx,b.y+b.height/2-y-dy)<12,'the selected move handle follows the real pointer '+JSON.stringify({start:[x,y],end:[b.x+b.width/2,b.y+b.height/2],delta:[dx,dy]}));}
 };
 const pickParticle=async(redOnly)=>{
  await fx.locator('.fx-emitter-markers circle').first().waitFor();
   const candidates=()=>page.evaluate(redOnly=>{
    const snapshot=findFiberState('.sfx-stage .game-preview-root',v=>v?.marks&&v?.camera&&v?.samples,{current:true}),box=document.querySelector('.sfx-stage').getBoundingClientRect(),marks=[...document.querySelectorAll('.fx-emitter-markers circle')].map(c=>{const b=c.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2];}),out=[];
    const p=mdlxlProbe('.sfx-stage .game-preview-root'),camera=snapshot.camera,project=v=>{const V=camera.matrixWorldInverse.elements,P=camera.projectionMatrix.elements, x=V[0]*v[0]+V[4]*v[1]+V[8]*v[2]+V[12],y=V[1]*v[0]+V[5]*v[1]+V[9]*v[2]+V[13],z=V[2]*v[0]+V[6]*v[1]+V[10]*v[2]+V[14],w=P[3]*x+P[7]*y+P[11]*z+P[15];return [(P[0]*x+P[4]*y+P[8]*z+P[12])/w,(P[1]*x+P[5]*y+P[9]*z+P[13])/w];};
    const wrappers=p.runtime.native.particlesController.emitters.filter(e=>e.props._FxTag&&(!redOnly||e.props.SegmentColor[1][1]===0));
    for(const wrapper of wrappers)for(let i=0;i<wrapper.particles.length;i++)for(const u of [.5,.25,.75])for(const v of [.5,.25,.75]){
     const points=[0,1,2,3].map(k=>project(wrapper.headVertices.subarray(i*12+k*3,i*12+k*3+3))),weights=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v],x=box.x+(1+points.reduce((n,p,i)=>n+p[0]*weights[i],0))*box.width/2,y=box.y+(1-points.reduce((n,p,i)=>n+p[1]*weights[i],0))*box.height/2;
     if(x>box.x+12&&x<box.right-12&&y>box.y+12&&y<box.bottom-12&&marks.every(m=>Math.hypot(x-m[0],y-m[1])>10)&&document.elementFromPoint(x,y)?.tagName==='CANVAS')out.push({x,y});
    }return out;
   },redOnly);
   let picked=false;
   for(let attempt=0;attempt<50&&!picked;attempt++){const picks=await candidates();for(const point of picks.length?[picks[attempt%picks.length]]:[]){await page.mouse.click(point.x,point.y);if(await fx.locator('.sfx-controls h4').count()){picked=true;break;}}}
   assert.ok(picked,redOnly?'a real single click on particles selects one emitter':'first particle click works before any layer edit');
 };
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  await fx.getByLabel('Geoset',{exact:true}).selectOption(String(part));await ready();if(part===2){await fx.getByLabel('Preview animation',{exact:true}).selectOption({label:'Decay Flesh'});await button('Solo').click();await button('Fit selection').click();await ready();}
  const search=fx.getByLabel('Find a surface effect');await search.click();await page.keyboard.type('Empty');await button('Empty global animation').click();await ready();
  await addEmitter(page,fx,'Flames',ready);
  const orbitBefore=(await read()).camera,stageBox=await stage.boundingBox();
  await page.mouse.move(stageBox.x+stageBox.width*.8,stageBox.y+stageBox.height*.6);await page.mouse.down();await page.mouse.move(stageBox.x+stageBox.width*.8+55,stageBox.y+stageBox.height*.6+18,{steps:8});await page.mouse.up();
  assert.notDeepEqual((await read()).camera,orbitBefore,'normal mouse orbit remains available');
  await button('Fit selection').click();await button('Position & size').click();await ready();
  await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props._FxTag).reduce((n,e)=>n+e.particles.length,0)>20);
  if(step>=4){await pickParticle(false);await page.keyboard.press('Escape');await ready();}
  const before=await read();await stage.screenshot({path:path.join(out,'span-before.png')});
  await drag('Ribbon upper edge',-24,-45);await drag('Ribbon lower edge',18,22);
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
   const before=await read(),selectedLabel=await pickMarker();await ready();
   assert.equal(await fx.getByRole('heading',{name:selectedLabel,exact:true}).count(),1,'panel names the selected emitter');
   await drag('Move emitter',part===2?40:150,part===2?-24:-100);
   const after=await read(),moved=after.nodes.filter(n=>JSON.stringify(n.PivotPoint)!==JSON.stringify(before.nodes.find(p=>p._FxTag===n._FxTag).PivotPoint));
   assert.equal(moved.length,1,'real drag moves exactly one emitter');
   await fx.getByLabel('RGB tint').fill('#ff0000');await ready();const red=await read();
   assert.equal(red.nodes.filter(n=>n.SegmentColor[1][1]===0).length,1,'colour affects one emitter');
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.some(e=>e.props._FxTag&&e.props.SegmentColor[1][1]===0&&e.particles.length>0));
   await stage.screenshot({path:path.join(out,'individual-red.png')});
   await page.keyboard.press('Escape');await ready();assert.equal(await fx.getByRole('heading',{name:selectedLabel,exact:true}).count(),0,'Escape returns to the layer');
   assert.equal(await fx.count(),1,'Escape keeps FX open');
   await pickParticle(true);
   await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Flames/}).click();await ready();
   assert.equal(await fx.locator('.sfx-controls h4').count(),0,'layer button returns to the whole layer');
   assert.equal(await button('Position & size').getAttribute('aria-pressed'),'true','layer return keeps placement available');
   if(part===0){
    const animation=fx.getByLabel('Preview animation',{exact:true}),attack=await animation.locator('option').evaluateAll(options=>options.find(o=>o.textContent.startsWith('Attack')).value);await animation.selectOption(attack);
    await page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),clip=p.props.model.Sequences[p.props.sequenceIndex],t=(p.runtime.native.getFrame()-clip.Interval[0])/(clip.Interval[1]-clip.Interval[0]);return clip.Name.startsWith('Attack')&&t>.4&&t<.6;});await button('Pause').click();
    await pickMarker(true);await ready();await drag('Move emitter',100,-50);await page.keyboard.press('Escape');await button('Play').click();
   }
  }
  if(step>=5){const before=await read();await pickMarker();await ready();await drag('Move emitter',20,-15);await button('Delete emitter').click();await ready();assert.equal((await read()).nodes.length,before.nodes.length-1,'Delete after dragging removes exactly one emitter');assert.equal(await fx.locator('.sfx-controls h4').count(),0,'deleting returns to the layer');await stage.screenshot({path:path.join(out,'deleted-one.png')});}
  if(step>=6){
   await fx.getByLabel('Preview animation',{exact:true}).selectOption({label:'Decay Flesh'});await ready();await button('Pause').click();
   await pickMarker();await ready();
   await button('Snap to surface').click();
   const points=await page.evaluate(()=>{
    const p=mdlxlProbe('.sfx-stage .game-preview-root'),n=p.runtime.native,g=n.model.Geosets[2],snap=findFiberState('.sfx-stage .game-preview-root',v=>v?.marks&&v?.camera,{current:true}),box=document.querySelector('.sfx-stage').getBoundingClientRect();
    const transform=(v,m)=>[0,1,2].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]);
    const points=Array.from({length:g.Vertices.length/3},(_,v)=>{const pos=Array.from(g.Vertices.slice(v*3,v*3+3)),bones=g.Groups[g.VertexGroup[v]],world=[0,0,0];for(const id of bones){const p=transform(pos,n.rendererData.nodes[id].matrix);p.forEach((x,i)=>world[i]+=x/bones.length);}const view=transform(world,snap.camera.matrixWorldInverse.elements),m=snap.camera.projectionMatrix.elements,w=m[3]*view[0]+m[7]*view[1]+m[11]*view[2]+m[15],screen=transform(view,m);return [box.x+(1+screen[0]/w)*box.width/2,box.y+(1-screen[1]/w)*box.height/2];});
    const faces=[];for(let i=0;i<g.Faces.length;i+=3){const [a,b,c]=[0,1,2].map(j=>points[g.Faces[i+j]]),area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));if(area>5)faces.push({x:(a[0]+b[0]+c[0])/3,y:(a[1]+b[1]+c[1])/3,area});}return faces.sort((a,b)=>b.area-a.area).slice(0,12);
   });
   assert.ok(points.length,'actual sword has a visible projected surface');let snapped=false;
   for(const point of points){if(await button('Snap to surface').count())await button('Snap to surface').click();await page.mouse.dblclick(point.x,point.y);await ready();const current=await read();snapped=Object.values(current.stack.layers[0].individuals||{}).some(r=>r.surface?.geoset===2);if(snapped)break;}
   assert.ok(snapped,'double-click snaps to the actual sword');assert.equal(await fx.getByLabel('Geoset',{exact:true}).inputValue(),String(part),'snap does not change the selected FX part');
   await button('Play').click();const before=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame());await page.waitForFunction(t=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame()>t+150,before);await page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p.runtime.native.particlesController.emitters.some(e=>e.props.ObjectId===p.props.particleSelectedId&&e.particles.length>0);});await stage.screenshot({path:path.join(out,'snapped-sword.png')});
  }
  if(step>=7){
   await fx.getByLabel('RGB tint').fill('#ff0000');await ready();const individual=Object.entries((await read()).stack.layers[0].individuals).find(([,r])=>r.surface),key=individual[0];
   await page.keyboard.press('Escape');await ready();await fx.getByLabel('RGB tint').fill('#0000ff');
   const conflict=page.getByRole('dialog',{name:'Individual emitter changes',exact:true});await conflict.waitFor();await conflict.getByRole('button',{name:'Keep individual changes',exact:true}).click();await ready();
   assert.deepEqual((await read()).stack.layers[0].individuals[key],individual[1],'Keep preserves red colour and the snapped place exactly');await page.waitForFunction(()=>{const es=mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters;return es.some(e=>e.props._FxTag&&e.props.SegmentColor[1][0]===1&&e.props.SegmentColor[1][1]===0&&e.particles.length>0)&&es.some(e=>e.props._FxTag&&e.props.SegmentColor[1][2]===1&&e.particles.length>0);});await stage.screenshot({path:path.join(out,'keep-individual.png')});
   await fx.getByLabel('RGB tint').fill('#00ff00');await conflict.waitFor();await conflict.getByRole('button',{name:'Apply to all',exact:true}).click();await ready();
   const all=await read();await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.some(e=>e.props._FxTag&&e.props.SegmentColor[1][1]===1&&e.particles.length>0));await stage.screenshot({path:path.join(out,'apply-all-colour.png')});assert.ok(all.nodes.every(n=>n.SegmentColor[1][0]===0&&n.SegmentColor[1][1]===1),'Apply all gives every surviving emitter the layer colour');assert.ok(!all.stack.layers[0].individuals[key]?.position,'Apply all returns the hand-placed emitter to formation');
   await fx.getByLabel('Change emitter',{exact:true}).selectOption('Fire column');await ready();const changed=await read();
   const positions=nodes=>Object.fromEntries(nodes.map(n=>[n._FxTag.split('/').at(-1),n.PivotPoint]));assert.deepEqual(positions(changed.nodes),positions(all.nodes),'Change emitter keeps every remaining place');assert.equal(changed.nodes.length,all.nodes.length,'deleted sites do not return');await stage.screenshot({path:path.join(out,'apply-all.png')});
  }
  if(step>=8){
   await pickMarker();await ready();
   const expected=await page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p.props.model.Nodes[p.props.particleSelectedId]._FxTag;});
   await button('Open in EMTR').click();const emtr=page.getByRole('dialog',{name:'Particle Editor',exact:true});await emtr.waitFor();
   await page.waitForFunction(()=>{const p=mdlxlProbe('.pe-preview .game-preview-root');return p?.runtime?.captureApi.isReady;});
   const opened=await page.evaluate(()=>{const p=mdlxlProbe('.pe-preview .game-preview-root');return p.props.model.Nodes[p.props.particleSelectedId]._FxTag;});assert.equal(opened,expected,'Open in EMTR selects the chosen stable emitter, not the layer representative');
   await page.screenshot({path:path.join(out,'selected-emtr.png')});
  }
  if(step>=9){
   await page.getByRole('button',{name:'Close Particle Editor',exact:true}).click();
   const openFx=async()=>{await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption(String(part));await ready();};
   await openFx();await button('Position & size').click();await pickMarker();await ready();await drag('Move emitter',35,-20);await fx.getByLabel('RGB tint').fill('#ff0000');await ready();
   const expected=(await read()).stack.layers[0].individuals;
   await button('Apply effect').click();await fx.waitFor({state:'hidden'});await openFx();assert.deepEqual((await read()).stack.layers[0].individuals,expected,'Apply and FX reopen keep individual edits and deletions');await button('Cancel').click();await fx.waitFor({state:'hidden'});
   for(const format of ['mdx','mdl']){
    const file=path.join(out,'placed.'+format);await stubDialogs(app,{save:file,message:1});await page.keyboard.press('F12');await page.getByRole('button',{name:'Save '+format.toUpperCase()+'…',exact:true}).click();await page.getByRole('dialog',{name:'Save model',exact:true}).getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(file=>mdlxlProbe().session.path===file&&!mdlxlProbe().session.doc.dirty,file);await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
    assert.ok(fs.statSync(file).size>1000);await page.getByRole('button',{name:'Close '+path.basename(file),exact:true}).click();await page.waitForFunction(file=>mdlxlProbe().session?.path!==file,file);await stubDialogs(app,{open:file});await page.keyboard.press('Control+o');await page.waitForFunction(file=>mdlxlProbe().session?.path===file,file);
    await openFx();assert.deepEqual((await read()).stack.layers[0].individuals,expected,format+' disk reopen keeps individual state');await button('Position & size').click();await pickMarker();await ready();await fx.getByLabel('RGB tint').fill('#dd0000');await ready();await button('Apply effect').click();await fx.waitFor({state:'hidden'});
    await page.keyboard.press('Control+z');await page.waitForFunction(({part,expected})=>JSON.stringify(mdlxlProbe().session.doc.model.Geosets[part]._FxStack.layers[0].individuals)===JSON.stringify(expected),{part,expected});
   }
   await openFx();await fx.getByLabel('Preview animation',{exact:true}).selectOption({label:part===2?'Decay Flesh':'Stand - 1'});await ready();if(part===2)await button('Solo').click();await button('Fit selection').click();await button('Position & size').click();
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.some(e=>e.props._FxTag&&e.props.SegmentColor[1][0]===1&&e.props.SegmentColor[1][1]===0&&e.particles.length>0));await stage.screenshot({path:path.join(out,'saved-reopened.png')});
  }
  assert.deepEqual(errors,[]);console.log('PASS layer span moves emitter sites; camera preserved');
 }catch(error){await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});

