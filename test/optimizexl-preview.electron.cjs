const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','preview-ui-'+Date.now()),profile=path.join(out,'profile');fs.mkdirSync(profile,{recursive:true});
  const {createDemoDocument,createNode,openDocument}=await import('../src/editor-document.js'),{starterTextureAsset}=await import('../src/particle-starters.js');
  const {evaluateModelCamera}=await import('../app/portrait-view.js');
  const doc=createDemoDocument(),texture=starterTextureAsset();
  const key=(Frame,values)=>({Frame,Vector:new Float32Array(values)}),track=Keys=>({LineType:1,GlobalSeqId:null,Keys});
  doc.apply('Paired effects and portrait fixture',['Sequences','Geosets','Nodes','PivotPoints','Textures','Materials','Cameras'],model=>{
    const sequence=model.Sequences[0];model.Sequences=[[0,2000],[3000,5000],[6000,8000],[9000,11000]].map((Interval,i)=>({...structuredClone(sequence),Name:['Stand','Portrait 1','Effects hidden','Portrait Talk 1'][i],Interval:new Uint32Array(Interval)}));
    for(const g of model.Geosets)g.Anims=model.Sequences.map(()=>structuredClone(g.Anims[0]));
    const visibility=()=>({LineType:0,GlobalSeqId:null,Keys:model.Sequences.flatMap((s,i)=>Array.from(s.Interval,Frame=>key(Frame,[i===2?0:1])))});
    const textureId=model.Textures.push({Image:texture.name,ReplaceableId:0,Flags:0})-1;
    const particle=createNode(model,'ParticleEmitter2');Object.assign(particle,{Name:'Visible sparks',TextureID:textureId,Visibility:visibility(),EmissionRate:60,LifeSpan:.6,Speed:35,ParticleScaling:new Float32Array([5,9,0]),SegmentColor:Array.from({length:3},()=>new Float32Array([1,.4,.05]))});particle.PivotPoint.set([35,0,120]);
    const material=model.Materials.push({PriorityPlane:0,RenderMode:0,Layers:[{FilterMode:4,Shading:17,TextureID:textureId,CoordId:0,Alpha:1}]})-1;
    const ribbon=createNode(model,'RibbonEmitter');Object.assign(ribbon,{Name:'Visible ribbon',MaterialID:material,Visibility:visibility(),EmissionRate:60,LifeSpan:.3,HeightAbove:7,HeightBelow:7,Translation:track(model.Sequences.flatMap(s=>[key(s.Interval[0],[-55,0,165]),key(s.Interval[0]+1000,[55,0,165]),key(s.Interval[1],[-55,0,165])]))});
    model.Cameras=[{Name:'Portrait Camera',Position:new Float32Array([0,-350,150]),TargetPosition:new Float32Array([0,0,100]),FieldOfView:Math.PI/4,NearClip:1,FarClip:1000,Translation:track([key(3000,[0,0,0]),key(5000,[20,0,0]),key(9000,[30,0,0]),key(11000,[50,0,0])])}];
  });
  const fixture=path.join(out,'paired-preview.mdx'),bytes=Buffer.from(doc.serialize('mdx'));fs.writeFileSync(fixture,bytes);
  const model=openDocument(new Uint8Array(bytes),'x.mdx').model,texturePath=path.join(out,...texture.name.split('\\'));fs.mkdirSync(path.dirname(texturePath),{recursive:true});fs.writeFileSync(texturePath,texture.bytes);
  fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences:{graphics:{particles:false},emitterMarker:'pentagram'}}));
  const exe=process.env.MDLXL_OPTIMIZEXL_EXE,errors=[];
  const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});let p;
  try{
    const main=await app.firstWindow();await main.getByTitle('OptimizeXL',{exact:true}).waitFor({timeout:60000});
    const pending=app.waitForEvent('window');await main.getByTitle('OptimizeXL',{exact:true}).click();p=await pending;p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1600,height:1000});w.showInactive();}});
    await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Insanity FIxer',exact:true}).click();
    await p.evaluate(()=>{window.previewSides=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
      let runtime,props;for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const c=h.memoizedState?.current;if(c?.native&&c?.controls)runtime=c;if(c?.model?.Geosets&&c?.compareCamera)props=c;}
      if(!runtime||!props)return null;return {frame:runtime.native.getFrame(),sequence:runtime.native.getSequence(),particles:runtime.native.particlesController.emitters.map(e=>e.particles.filter(p=>p.lifeSpan>0).length),ribbons:runtime.native.ribbonsController.emitters.map(e=>e.creationTimes.length),nodes:root.querySelectorAll('[data-node-overlay]').length,portrait:!!props.portraitMode,framed:root.classList.contains('portrait-preview-root'),frameLoaded:!!root.querySelector('.portrait-human-frame'),camera:runtime.controls.object.position.toArray(),detached:runtime.cameraDetached,graphicsParticles:props.preferences.graphics.particles};
    });});
    const states=()=>p.evaluate(()=>previewSides());
    const seek=async(si,frame)=>{await p.getByLabel('Animation',{exact:true}).selectOption(String(si));await p.getByLabel('Animation frame',{exact:true}).fill(String(frame));await p.waitForFunction(({si,frame})=>previewSides().every(s=>s&&s.sequence===si&&Math.abs(s.frame-frame)<1e-5),{si,frame});};
    const effects=async()=>{await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(()=>previewSides().every(s=>s&&s.particles[0]>0&&s.ribbons[0]>1));const visible=await states();visible.forEach(s=>{assert.equal(s.nodes,0);assert.equal(s.graphicsParticles,false);});await p.getByRole('button',{name:'Pause',exact:true}).click();return visible;};
    await seek(0,0);const stand=await effects();assert.ok(stand.every(s=>!s.framed));await p.screenshot({path:path.join(out,'01-full-effects.png')});
    await seek(1,3500);await p.waitForFunction(()=>previewSides().every(s=>s?.frameLoaded));const portrait=await states();
    const expected=evaluateModelCamera(model,model.Cameras[0],3500,1,0);portrait.forEach(s=>{assert.ok(s.portrait&&s.framed);s.camera.forEach((v,i)=>assert.ok(Math.abs(v-expected.position[i])<1e-5));});await effects();
    await p.screenshot({path:path.join(out,'02-paired-portrait.png')});
    const beforeDrag=await states(),box=await p.locator('[aria-label="Before preview"] [data-clean-model-canvas]').boundingBox();
    await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.66,box.y+box.height*.55,{steps:12});await p.mouse.up();
    await p.waitForFunction(previous=>previewSides()[0].camera.some((v,i)=>Math.abs(v-previous[i])>.1),beforeDrag[0].camera);
    const rotated=await states();rotated[0].camera.forEach((v,i)=>assert.ok(Math.abs(v-rotated[1].camera[i])<1e-5,'Portrait camera rotation remains paired'));
    await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(frame=>previewSides().every(s=>s.frame>frame),rotated[0].frame);await p.getByRole('button',{name:'Pause',exact:true}).click();const replay=await states();replay[0].camera.forEach((v,i)=>{assert.ok(Math.abs(v-replay[1].camera[i])<1e-5);assert.ok(Math.abs(v-rotated[0].camera[i])<1e-5);});
    await seek(3,9500);await p.waitForFunction(()=>previewSides().every(s=>s?.frameLoaded&&!s.detached));const talk=await states(),talkCamera=evaluateModelCamera(model,model.Cameras[0],9500,3,0);talk.forEach(s=>s.camera.forEach((v,i)=>assert.ok(Math.abs(v-talkCamera.position[i])<1e-5)));
    await seek(2,6000);await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(()=>previewSides().every(s=>s&&s.frame>6250&&s.particles[0]===0&&s.ribbons[0]===0&&!s.framed));await p.getByRole('button',{name:'Pause',exact:true}).click();const hidden=await states();hidden.forEach(s=>s.camera.forEach((v,i)=>assert.ok(Math.abs(v-stand[0].camera[i])<1e-5,'Leaving portrait restores full-model camera')));await p.screenshot({path:path.join(out,'03-authored-hidden-effects.png')});
    await seek(1,3500);const portraitSizes=await p.locator('.ox-preview .portrait-preview-stage').evaluateAll(stages=>stages.map(s=>({width:s.clientWidth,height:s.clientHeight})));portraitSizes.forEach(s=>assert.ok(s.width>100&&s.height>100,'Portrait remains visible after leaving and re-entering'));
    assert.deepEqual(fs.readFileSync(fixture),bytes);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,stand,portrait,rotated,talk,hidden,sourceUnchanged:true,errors},null,2));console.log(out);
  }catch(e){if(p){fs.writeFileSync(path.join(out,'failed-state.json'),JSON.stringify(await p.evaluate(()=>window.previewSides?.()),null,2));await p.screenshot({path:path.join(out,'failed-state.png')});}throw e;}finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
