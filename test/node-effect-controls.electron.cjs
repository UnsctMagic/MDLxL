const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async()=>{
  const root=process.cwd(),out=path.join(root,'out','node-effect-controls',String(Date.now())),profile=path.join(out,'profile');
  await fs.mkdir(profile,{recursive:true});
  const {createDemoDocument,createNode,openDocument}=await import('../src/editor-document.js');
  const {starterTextureAsset}=await import('../src/particle-starters.js');
  const doc=createDemoDocument(), ids={};
  doc.apply('Node preview fixture',['Nodes','PivotPoints','Textures','Materials','Sequences'],model=>{
    model.Sequences[0].Interval=new Uint32Array([0,2000]);
    const texture=model.Textures.push({Image:starterTextureAsset().name,ReplaceableId:0,Flags:0})-1;
    const particle=createNode(model,'ParticleEmitter2');ids.particle=particle.ObjectId;
    Object.assign(particle,{Name:'Test sparks',TextureID:texture,Visibility:1,EmissionRate:60,LifeSpan:2.4,Speed:40,ParticleScaling:new Float32Array([5,9,0]),SegmentColor:Array.from({length:3},()=>new Float32Array([1,.3,.05]))});particle.PivotPoint.set([80,0,155]);
    const material=model.Materials.push({PriorityPlane:0,RenderMode:0,Layers:[{FilterMode:4,Shading:17,TextureID:texture,CoordId:0,Alpha:1}]})-1;
    const ribbon=createNode(model,'RibbonEmitter');ids.ribbon=ribbon.ObjectId;
    Object.assign(ribbon,{Name:'Test ribbon',MaterialID:material,Visibility:1,EmissionRate:60,LifeSpan:2.4,HeightAbove:7,HeightBelow:7,Translation:{LineType:1,GlobalSeqId:null,Keys:[[0,0],[1000,60],[2000,0]].map(([Frame,x])=>({Frame,Vector:new Float32Array([x,0,0])}))}});
    ribbon.PivotPoint.set([-80,0,150]);
    const attachment=createNode(model,'Attachment');ids.attachment=attachment.ObjectId;attachment.Name='Test fist';attachment.PivotPoint.set([-85,0,65]);
    for(const [kind,Name,x,z] of [['sound','SNDxTEST',85,65],['blood','SPLxTEST',-45,0],['foot','FPTxTEST',0,0],['uber','UBRxTEST',45,0]]){
      const event=createNode(model,'EventObject');ids[kind]=event.ObjectId;event.Name=Name;event.EventTrack=new Uint32Array([100,1100]);event.PivotPoint.set([x,0,z]);
    }
  });
  const fixture=path.join(out,'node-controls.mdx'),bytes=Buffer.from(doc.serialize('mdx'));await fs.writeFile(fixture,bytes);
  const saved=openDocument(bytes,fixture).model;
  for(const [kind,Name] of Object.entries({particle:'Test sparks',ribbon:'Test ribbon',attachment:'Test fist',sound:'SNDxTEST',blood:'SPLxTEST',foot:'FPTxTEST',uber:'UBRxTEST'}))ids[kind]=saved.Nodes.find(node=>node?.Name===Name).ObjectId;
  const write=async(name,data)=>{const file=path.join(out,...name.split('\\'));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);};
  const texture=starterTextureAsset();await write(texture.name,texture.bytes);
  const slk=row=>'ID;PWXL;N;E\n'+Object.keys(row).map((name,i)=>`C;X${i+1};Y1;K"${name}"`).join('\n')+'\n'+Object.values(row).map((value,i)=>`C;X${i+1};Y2;K${typeof value==='string'?JSON.stringify(value):value}`).join('\n')+'\nE';
  await write('UI\\SoundInfo\\AnimLookups.slk',slk({Name:'TEST',SoundLabel:'TestSound'}));
  await write('UI\\SoundInfo\\AnimSounds.slk',slk({Name:'TestSound',DirectoryBase:'Sounds',FileNames:'test.wav'}));
  const samples=Math.round(22050*2.2),wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i/22050*440*Math.PI*2)*5000),44+i*2);await write('Sounds\\test.wav',wav);
  const blood={Name:'TEST',file:'NodePreviewTest',Scale:24,Rows:1,Columns:1,BlendMode:0,Lifespan:.2,Decay:120,UVLifespanStart:0,UVLifespanEnd:0,UVDecayStart:0,UVDecayEnd:0,StartR:255,StartG:0,StartB:20,StartA:255,MiddleR:255,MiddleG:0,MiddleB:20,MiddleA:200,EndR:255,EndG:0,EndB:20,EndA:0};
  await write('Splats\\SplatData.slk',slk(blood));await write('Splats\\UberSplatData.slk',slk({...blood,BirthTime:.2,PauseTime:.2,Decay:.4}));
  const blp=Buffer.alloc(148+16*16*4);blp.write('BLP2');blp.writeUInt32LE(1,4);blp[8]=3;blp[9]=8;blp.writeUInt32LE(16,12);blp.writeUInt32LE(16,16);blp.writeUInt32LE(148,20);blp.writeUInt32LE(1024,84);for(let i=148;i<blp.length;i+=4){blp[i]=blp[i+1]=blp[i+2]=255;blp[i+3]=200;}await write('ReplaceableTextures\\Splats\\NodePreviewTest.blp',blp);
  await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({preferences:{graphics:{particles:false,maxFps:30,pauseWhenHidden:false},emitterMarker:'pentagram'}}));
  const executablePath=process.env.MDLXL_ELECTRON_PATH||path.join(root,'node_modules/electron/dist/electron.exe'),packaged=!!process.env.MDLXL_ELECTRON_PATH;
  const app=await _electron.launch({executablePath,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--mute-audio',...(packaged?[fixture]:[root,fixture])],cwd:root,env:{...process.env,MDLXL_PROFILE:profile,MDLVIS_HEADLESS:'1'},timeout:60000});
  let page;const errors=[];
  const grab=clip=>app.evaluate(async({BrowserWindow},clip)=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(clip||undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'),clip);
  const screenshot=async name=>fs.writeFile(path.join(out,name),Buffer.from(await grab(),'base64'));
  try{
    page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];if(win.isVisible())throw Error('Test window must remain hidden');win.setSize(1700,1050);win.webContents.setBackgroundThrottling(false);});
    await page.addInitScript(()=>{window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);window.cancelAnimationFrame=clearTimeout;});await page.reload();
    await page.getByText('Opened node-controls.mdx',{exact:true}).waitFor();
    await page.evaluate(()=>{window.testAudio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){const record={audio:this,decoded:false,ended:false};this.addEventListener('playing',()=>{record.decoded=this.duration>0&&!this.error;},{once:true});this.addEventListener('ended',()=>{record.ended=true;},{once:true});window.testAudio.push(record);return play.apply(this,args);};});
    const command=id=>app.evaluate(({BrowserWindow},id)=>BrowserWindow.getAllWindows()[0].webContents.send('menu',id),id);
    const read=()=>page.evaluate(()=>{
      const el=document.querySelector('.game-preview-root');let fiber=el?.[Object.keys(el).find(key=>key.startsWith('__reactFiber'))];
      for(;fiber;fiber=fiber.return)for(let hook=fiber.memoizedState;hook;hook=hook.next){const state=hook.memoizedState?.current;if(state?.native&&state.controls){window.testRuntime=state;return{frame:state.native.getFrame(),ready:state.captureApi?.isReady,particles:state.native.particlesController.emitters.map(e=>e.particles.length),ribbons:state.native.ribbonsController.emitters.map(e=>e.creationTimes.length),nodes:el.querySelectorAll('[data-node-overlay]').length,pulse:state.nodeEffects?.active,decal:state.eventPreview?.active,camera:state.controls.object.position.toArray(),decals:state.testDecalDraws||0,audio:window.testAudio.map(r=>({decoded:r.decoded,ended:r.ended,paused:r.audio.paused,src:r.audio.getAttribute('src')}))};}}return null;
    });
    const wait=async(predicate,label)=>{const end=Date.now()+20000;while(Date.now()<end){const state=await read();if(state&&predicate(state))return state;await page.waitForTimeout(30);}throw Error(label+': '+JSON.stringify(await read()));};
    const clickNode=async(id,button='right')=>{
      await read();const point=await page.evaluate(id=>{const state=window.testRuntime,camera=state.controls.object,node=state.native.model.Nodes[id],v=camera.position.clone().fromArray(node.PivotPoint||state.native.model.PivotPoints[id]),mat=state.native.rendererData.nodes[id]?.matrix;if(mat)v.applyMatrix4(camera.matrixWorld.clone().fromArray(mat));v.project(camera);const canvas=document.querySelector('[data-clean-model-canvas]'),rect=canvas.getBoundingClientRect();return{x:rect.x+(v.x+1)*rect.width/2,y:rect.y+(1-v.y)*rect.height/2};},id);console.log(JSON.stringify({click:id,button,point}));await page.mouse.click(point.x,point.y,{button});
    };
    const quick=page.getByRole('group',{name:'Quick display'});
    const absent=async names=>{for(const name of names)assert.equal(await quick.getByLabel(name,{exact:true}).count(),0,name+' is absent');};
    const installDecalProbe=async()=>{await read();await page.evaluate(()=>{const state=window.testRuntime,events=state.eventPreview;if(events.testProbe)return;events.testProbe=true;const render=events.render,gl=state.native.gl;events.render=function(options){const draw=gl.drawArrays;let count=0;gl.drawArrays=function(...args){count++;return draw.apply(this,args);};try{return render.call(this,options);}finally{gl.drawArrays=draw;state.testDecalDraws=count;}};});};
    if(process.env.MDLXL_NODE_ZOOM_PROOF){
      const {PNG}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
      await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1920,1040));
      await page.getByRole('button',{name:'Movement',exact:true}).click();await page.getByLabel('Movement current sequence',{exact:true}).selectOption('0');await wait(s=>s.ready,'Zoom proof ready');
      for(const name of ['Emitters','Events','Sounds','Attachment','Focused Skeleton'])await quick.getByLabel(name,{exact:true}).check();
      await page.getByRole('button',{name:'Fit',exact:true}).click();await page.waitForTimeout(120);
      const layout=()=>page.evaluate(ids=>{
        const state=window.testRuntime,camera=state.controls.object,rect=document.querySelector('[data-clean-model-canvas]').getBoundingClientRect(),vector=camera.position.clone();
        const nodes=Object.fromEntries(Object.entries(ids).map(([name,id])=>{vector.fromArray(state.native.model.Nodes[id].PivotPoint).project(camera);return[name,{x:rect.x+(vector.x+1)*rect.width/2,y:rect.y+(1-vector.y)*rect.height/2}];}));
        const ys=[];for(const geoset of state.native.model.Geosets)for(let i=0;i<geoset.Vertices.length;i+=3){vector.fromArray(geoset.Vertices,i).project(camera);ys.push((1-vector.y)*rect.height/2);}
        return {nodes,modelHeight:Math.max(...ys)-Math.min(...ys),zoom:camera.zoom,canvas:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
      },ids);
      await read();let fitted=await layout();const box=fitted.canvas;await page.mouse.move(box.x+box.width*.8,box.y+box.height*.6);
      let far=fitted;for(let i=0;i<45&&far.modelHeight>130;i++){await page.mouse.wheel(0,70);await page.waitForTimeout(60);far=await layout();}
      assert.ok(far.modelHeight>=90&&far.modelHeight<=130,'Reproduce the reported small-model zoom');assert.ok(far.zoom<fitted.zoom,'Normal mouse wheel zooms out');
      const colors={particle:[76,255,89],ribbon:[32,201,255],attachment:[255,57,207],sound:[255,229,43],blood:[255,23,77],foot:[35,255,177],uber:[255,57,184]};
      const capture=async(name)=>{
        await page.waitForTimeout(220);
        const current=await layout(),png=Buffer.from(await grab(),'base64'),image=PNG.sync.read(png),metrics={};await fs.writeFile(path.join(out,name+'.png'),png);
        for(const [kind,p] of Object.entries(current.nodes)){
          const rgb=colors[kind],xs=[],ys=[],search=name==='zoom-close'?64:16;
          for(let y=Math.max(0,Math.floor(p.y)-search);y<Math.min(image.height,p.y+search+1);y++)for(let x=Math.max(0,Math.floor(p.x)-search);x<Math.min(image.width,p.x+search+1);x++){
            const offset=(y*image.width+x)*4;if(rgb.every((value,i)=>Math.abs(image.data[offset+i]-value)<=12)){xs.push(x);ys.push(y);}
          }
          metrics[kind]={width:xs.length?Math.max(...xs)-Math.min(...xs)+1:0,height:ys.length?Math.max(...ys)-Math.min(...ys)+1:0,pixels:xs.length};
        }
        const points=Object.values(current.nodes),left=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x)))-30),top=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y)))-30),right=Math.min(image.width,Math.ceil(Math.max(...points.map(p=>p.x)))+30),bottom=Math.min(image.height,Math.ceil(Math.max(...points.map(p=>p.y)))+30);
        await fs.writeFile(path.join(out,name+'-symbols.png'),Buffer.from(await grab({x:left,y:top,width:right-left,height:bottom-top}),'base64'));
        return {...current,metrics};
      };
      const farProof=await capture('zoom-far');
      if(process.env.MDLXL_NODE_ZOOM_PROOF!=='before')for(const [kind,metric] of Object.entries(farProof.metrics)){assert.ok(metric.width>=18&&metric.height>=18,kind+' remains readable in the rendered screenshot: '+JSON.stringify(metric));assert.ok(metric.width<=30&&metric.height<=30,kind+' stays compact');assert.ok(metric.pixels>=45,kind+' retains visible symbol detail');}
      let close=far;for(let i=0;i<60&&close.modelHeight<600;i++){await page.mouse.wheel(0,-70);await page.waitForTimeout(60);close=await layout();}
      assert.ok(close.zoom>far.zoom,'Normal mouse wheel zooms back in');const closeProof=await capture('zoom-close');for(const [kind,metric] of Object.entries(closeProof.metrics)){assert.ok(metric.width>=18&&metric.height>=18,kind+' renders at close zoom');assert.ok(metric.width<=30&&metric.height<=30,kind+' retains the close-up size cap');}
      if(process.env.MDLXL_NODE_ZOOM_PROOF!=='before'){
        await page.mouse.move(box.x+box.width*.8,box.y+box.height*.6);for(let i=0;i<60&&(await layout()).modelHeight>130;i++){await page.mouse.wheel(0,70);await page.waitForTimeout(60);}const current=await layout(),p=current.nodes.particle;
        await page.mouse.click(p.x+8,p.y,{button:'right'});await wait(s=>s.pulse&&s.particles[0]>0,'Zoomed-out symbol remains clickable');await wait(s=>!s.pulse&&s.particles[0]===0,'Zoomed-out preview cleans up');
        const sound=current.nodes.sound;await page.mouse.click(sound.x+8,sound.y);assert.equal(await page.getByLabel('Movement bone or node',{exact:true}).inputValue(),String(ids.sound),'Left click still selects the visible symbol');
      }
      assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);assert.deepEqual(await fs.readFile(fixture),bytes);assert.deepEqual(errors,[]);
      const proof={passed:true,hidden:true,out,far:farProof,close:closeProof};await fs.writeFile(path.join(out,'zoom-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));return;
    }
    await absent(['Bones','Nodes','Emitters','Events','Sounds','Attachment']);
    assert.equal(await page.locator('[data-node-overlay]').count(),0,'Vertices has no rig markers');
    await screenshot('vertices-default.png');
    await page.getByRole('button',{name:'Bones',exact:true}).click();
    await wait(s=>s.ready,'Bones ready');await absent(['Nodes','Ribbons','Blood/Uber/Foot']);
    for(const name of ['Emitters','Events','Sounds']){assert.equal(await quick.getByLabel(name,{exact:true}).isChecked(),false);await quick.getByLabel(name,{exact:true}).check();assert.equal(await quick.getByLabel(name,{exact:true}).isChecked(),true);}
    await quick.getByLabel('Bones',{exact:true}).check();await quick.getByLabel('Attachment',{exact:true}).check();
    await wait(s=>s.nodes>0,'Bones symbols');await installDecalProbe();
    assert.deepEqual((await read()).particles,[0]);assert.deepEqual((await read()).ribbons,[0]);
    await screenshot('bones-symbols.png');const frame=(await read()).frame;
    await clickNode(ids.particle);await wait(s=>s.particles[0]>0&&s.pulse,'Particle right click fires');await screenshot('bones-particle-test.png');await page.waitForTimeout(650);assert.ok((await read()).particles[0]>0,'Particles complete their lifespan after emission stops');await wait(s=>s.particles[0]===0&&!s.pulse,'Particle test cleans up');assert.equal((await read()).frame,frame);
    await page.evaluate(()=>{
      const props=window.testRuntime.native.particlesController.emitters[0].props;
      window.testParticleProps={Visibility:props.Visibility,EmissionRate:props.EmissionRate,Squirt:props.Squirt};
      Object.assign(props,{Visibility:0,Squirt:true,EmissionRate:{LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([12])}]}});
    });
    await clickNode(ids.particle);await wait(s=>s.particles[0]===12&&s.pulse,'Authored squirt emits exactly one complete burst');
    await page.waitForTimeout(650);assert.equal((await read()).particles[0],12,'Squirt does not repeat while its particles are alive');
    await wait(s=>s.particles[0]===0&&!s.pulse,'Squirt particles finish and clean up');
    assert.equal(await page.evaluate(()=>{const props=window.testRuntime.native.particlesController.emitters[0].props;return props.Squirt&&props.Visibility===0&&props.EmissionRate.Keys[0].Vector[0]===12;}),true,'Manual burst preserves the authored properties');
    await page.evaluate(()=>Object.assign(window.testRuntime.native.particlesController.emitters[0].props,window.testParticleProps));
    await clickNode(ids.ribbon);await wait(s=>s.ribbons[0]>1&&s.pulse,'Ribbon right click fires');await page.waitForTimeout(650);assert.ok((await read()).ribbons[0]>0,'Ribbon tail survives the old cutoff');await wait(s=>s.ribbons[0]===0&&!s.pulse,'Ribbon test cleans up');assert.equal((await read()).frame,frame);
    const audioBefore=(await read()).audio.length;await clickNode(ids.sound);await wait(s=>s.audio.length===audioBefore+1&&s.audio.at(-1).decoded,'Sound right click decodes and plays once');await page.waitForTimeout(1200);assert.ok(!(await read()).audio.at(-1).ended&&!(await read()).audio.at(-1).paused,'The full sound continues past one second');await wait(s=>s.audio.at(-1).ended&&s.audio.at(-1).paused&&!s.audio.at(-1).src,'Sound ends and releases playback');
    await page.evaluate(()=>{const now=performance.now.bind(performance);window.testEventClockOffset=0;performance.now=()=>now()+window.testEventClockOffset;});
    for(const id of [ids.blood,ids.foot,ids.uber]){
      await clickNode(id);await wait(s=>s.decal&&s.decals>0,'Decal manual cycle draws');await screenshot('bones-decal-'+id+'.png');
      const duration=await page.evaluate(id=>window.testRuntime.eventPreview.definitions.get(window.testRuntime.native.model.Nodes[id].Name).lifeSpanMs,id);
      if(duration>2000){
        await page.waitForTimeout(1200);assert.ok((await read()).decal&&(await read()).decals>0,'Long authored decal is not cut off at one second');
        // Advance only the test clock to the final authored decay stage.
        await page.evaluate(ms=>{window.testEventClockOffset+=ms;},duration-2000);await wait(s=>s.decal&&s.decals>0,'Decal still draws before its authored end');
        await page.evaluate(()=>{window.testEventClockOffset+=2000;});
      }
      await wait(s=>!s.decal&&s.decals===0,'Decal clears after its full authored lifetime');await screenshot('bones-decal-clean-'+id+'.png');
    }
    await clickNode(ids.attachment,'left');await command('Nodes');await page.getByRole('dialog',{name:'Node Manager',exact:true}).waitFor();assert.equal(await page.locator('.re-tree-row.re-selected').getAttribute('data-node-id'),String(ids.attachment));await page.getByRole('button',{name:'Close',exact:true}).last().click();
    for(const name of ['Emitters','Events','Sounds']){await quick.getByLabel(name,{exact:true}).uncheck();assert.equal(await quick.getByLabel(name,{exact:true}).isChecked(),false);}
    await page.getByRole('button',{name:'Movement',exact:true}).click();
    await page.getByLabel('Movement current sequence',{exact:true}).selectOption('0');await wait(s=>s.ready,'Movement ready');await absent(['Nodes','Ribbons','Blood/Uber/Foot']);
    assert.equal(await quick.getByLabel('Emitters',{exact:true}).isChecked(),true);
    for(const name of ['Events','Sounds'])assert.equal(await quick.getByLabel(name,{exact:true}).isChecked(),false);
    await page.getByRole('button',{name:'Play',exact:true}).click();await wait(s=>s.frame>200&&s.particles[0]>0&&s.ribbons[0]>1,'Movement defaults play both emitter types');
    await quick.getByLabel('Emitters',{exact:true}).uncheck();await wait(s=>s.particles[0]===0&&s.ribbons[0]===0,'Emitters toggle disables both types');
    assert.equal((await read()).audio.length,audioBefore+1);
    await quick.getByLabel('Events',{exact:true}).check();await quick.getByLabel('Sounds',{exact:true}).check();await installDecalProbe();await wait(s=>s.decals>0&&s.audio.length>audioBefore+1,'Movement Events and Sounds activate');
    await quick.getByLabel('Events',{exact:true}).uncheck();await quick.getByLabel('Sounds',{exact:true}).uncheck();await wait(s=>s.decals===0&&s.audio.every(a=>a.paused),'Movement controls turn effects off');
    await page.getByRole('button',{name:'Stop',exact:true}).click();await page.waitForTimeout(180);await screenshot('movement-toggled-off.png');
    await page.getByRole('button',{name:'Animations',exact:true}).click();await wait(s=>s.ready,'Animations ready');
    assert.equal(await quick.getByLabel('Nodes',{exact:true}).isChecked(),false);
    for(const name of ['Emitters','Events','Sounds'])assert.equal(await quick.getByLabel(name,{exact:true}).isChecked(),true);
    await installDecalProbe();await page.getByRole('button',{name:'Play',exact:true}).click();await wait(s=>s.particles[0]>0&&s.ribbons[0]>1&&s.audio.length>audioBefore+2&&s.decals>0,'Animation defaults play all categories');assert.equal((await read()).nodes,0);await screenshot('animations-default.png');
    await quick.getByLabel('Nodes',{exact:true}).check();await wait(s=>s.nodes>0,'Animations Nodes reveals enabled symbols');await screenshot('animations-symbols.png');
    for(const name of ['Emitters','Events','Sounds']){await quick.getByLabel(name,{exact:true}).uncheck();assert.equal(await quick.getByLabel(name,{exact:true}).isChecked(),false);}
    await wait(s=>s.particles[0]===0&&s.ribbons[0]===0&&s.decals===0&&s.nodes===0&&s.audio.every(a=>a.paused),'Disabled categories hide effects and symbols while Nodes remains on');
    await screenshot('animations-all-off.png');await quick.getByLabel('Sounds',{exact:true}).check();await wait(s=>s.nodes>0,'Sounds alone restores its symbols');
    await quick.getByLabel('Nodes',{exact:true}).uncheck();await wait(s=>s.nodes===0,'Nodes off hides symbols without disabling Sounds');assert.equal(await quick.getByLabel('Sounds',{exact:true}).isChecked(),true);
    await page.getByRole('button',{name:'Stop',exact:true}).click();await page.waitForTimeout(180);await command('camera:rotate');const cameraBefore=(await read()).camera,canvas=await page.locator('[data-clean-model-canvas]').boundingBox();await page.mouse.move(canvas.x+canvas.width*.8,canvas.y+canvas.height*.7);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.6,canvas.y+canvas.height*.5,{steps:12});await page.mouse.up();await wait(s=>s.camera.some((v,i)=>Math.abs(v-cameraBefore[i])>1),'Actual mouse rotation');
    await page.getByRole('button',{name:'Vertices',exact:true}).click();await absent(['Bones','Nodes','Emitters','Events','Sounds','Attachment']);assert.equal(await page.locator('[data-node-overlay]').count(),0,'Returning to Vertices hides selected rig markers');
    await command('camera:work');
    assert.equal(await page.locator('.classic-sidebar [data-warmkey="Delete vertices"]').isDisabled(),true,'Vertices cannot delete the retained hidden rig selection');for(const input of await page.locator('.classic-coordinates input').all())assert.equal(await input.isDisabled(),true,'Vertex coordinates cannot move hidden rig selections');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1086,760));
    await page.getByRole('button',{name:'Movement',exact:true}).click();await wait(s=>s.ready,'Narrow Movement ready');
    for(const name of ['Emitters','Events','Sounds']){const control=quick.getByLabel(name,{exact:true});await control.scrollIntoViewIfNeeded();assert.equal(await control.evaluate(input=>{const r=input.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===input;}),true,name+' remains reachable in narrow window');await control.check();await control.uncheck();}
    await screenshot('movement-narrow-controls.png');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1920,1040));
    const xlChecks=await Promise.all(['Emitters','Events','Sounds'].map(name=>quick.getByLabel(name,{exact:true}).isChecked()));await read();await page.evaluate(()=>window.testVISNative=window.testRuntime.native);
    await page.locator('.vis-toggle').click();await page.locator('.classic-app[data-vis-ui]').waitFor();await absent(['Events','Sounds']);assert.equal(await quick.getByLabel('Nodes',{exact:true}).count(),1);assert.equal(await quick.getByLabel('Emitters',{exact:true}).isChecked(),false);
    const nativeView=await app.evaluate(async({Menu})=>{const end=Date.now()+5000;let labels;do{labels=Menu.getApplicationMenu().items.find(item=>item.label==='View').submenu.items.map(item=>item.label);if(labels.includes('Nodes')&&!labels.includes('Events')&&!labels.includes('Sounds'))return labels;await new Promise(resolve=>setTimeout(resolve,20));}while(Date.now()<end);return labels;});assert.ok(nativeView.includes('Nodes'));assert.ok(!nativeView.includes('Events')&&!nativeView.includes('Sounds'));
    await quick.getByLabel('Bones',{exact:true}).check();await quick.getByLabel('Nodes',{exact:true}).check();await quick.getByLabel('Emitters',{exact:true}).check();await quick.getByLabel('Attachment',{exact:true}).check();await wait(s=>s.nodes>0,'VIS original markers');await screenshot('vis-movement-symbols.png');
    await clickNode(ids.particle);await page.waitForTimeout(650);assert.equal((await read()).pulse,false,'VIS right click retains original camera behavior');assert.deepEqual((await read()).particles,[0]);
    const visCameraBefore=(await read()).camera,visCanvas=await page.locator('[data-clean-model-canvas]').boundingBox();await page.mouse.move(visCanvas.x+visCanvas.width*.8,visCanvas.y+visCanvas.height*.65);await page.mouse.down({button:'right'});await page.mouse.move(visCanvas.x+visCanvas.width*.68,visCanvas.y+visCanvas.height*.52,{steps:12});await page.mouse.up({button:'right'});await wait(s=>s.camera.some((v,i)=>Math.abs(v-visCameraBefore[i])>1),'VIS normal mouse rotation');
    await page.locator('.vis-toggle').click();await page.locator('.classic-app:not([data-vis-ui])').waitFor();await absent(['Nodes']);assert.deepEqual(await Promise.all(['Emitters','Events','Sounds'].map(name=>quick.getByLabel(name,{exact:true}).isChecked())),xlChecks,'XL category choices are restored');await read();assert.equal(await page.evaluate(()=>window.testRuntime.native===window.testVISNative),true,'VIS toggle preserves the live model and timeline');
    await page.locator('.vis-toggle').click();assert.equal(await quick.getByLabel('Nodes',{exact:true}).isChecked(),true,'VIS choices are retained separately');await page.locator('.vis-toggle').click();
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false,'All desktop verification stays hidden');assert.deepEqual(await fs.readFile(fixture),bytes);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,packaged,executablePath,out,ids,fixtureSha256:createHash('sha256').update(bytes).digest('hex')}));
  }catch(error){if(page){await screenshot('failure.png').catch(()=>{});console.error((await page.locator('body').innerText()).slice(-1800));}throw error;}
  finally{if(process.env.MDLXL_KEEP_TEST!=='1')await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
