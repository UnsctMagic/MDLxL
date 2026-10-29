const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'out/footprint-travel');
(async()=>{
  const file=process.env.MDLXL_TEST_MODEL;if(!file)throw Error('MDLXL_TEST_MODEL must name a real model with hoofprint events.');
  fs.mkdirSync(path.join(out,'profile'),{recursive:true});
  fs.writeFileSync(path.join(out,'profile/settings.json'),JSON.stringify({preferences:{theme:'dark',graphics:{pauseWhenHidden:false}}}));
  const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root,file,'--remote-debugging-port=9337'],env:{...process.env,MDLXL_PROFILE:path.join(out,'profile'),MDLVIS_HEADLESS:'1',MDLVIS_GAME_DATA:'D:/Warcraft III'},timeout:60000});
  try{
    const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1360,900);w.webContents.setBackgroundThrottling(false);});
    const capture=async()=>{const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));fs.writeFileSync(path.join(out,'chaos-knight.png'),Buffer.from(data,'base64'));};
    await page.getByText('Opened '+path.basename(file),{exact:true}).waitFor();
    await page.locator('[data-hotkey="animations"]').first().dispatchEvent('click');
    await page.getByLabel('Choose animation sequence',{exact:true}).selectOption({label:'Walk'});
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    for(const[name,on]of[['Bones',false],['Emitters',true],['Events',true]]){const c=page.getByRole('checkbox',{name,exact:true});if(await c.isChecked()!==on)await c.evaluate(e=>e.click());}
    const stop=page.getByRole('button',{name:'Stop',exact:true});if(await stop.count())await stop.dispatchEvent('click');
    await page.evaluate(()=>{window.footprintRuntime=()=>{const host=document.querySelector('.game-preview-root');for(let f=host?.[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const r=h.memoizedState?.current;if(r?.native&&r?.controls)return r;}throw Error('Preview unavailable');};});
    await page.waitForFunction(()=>footprintRuntime().eventPreview.isReady);
    const result=await page.evaluate(()=>{
      const r=footprintRuntime(),model=r.native.model,before=JSON.stringify(model),camera=r.controls.object,gl=r.native.gl;
      const sequenceIndex=model.Sequences.findIndex(s=>s.Name==='Walk'),sequence=model.Sequences[sequenceIndex],frame=sequence.Interval[1]-1;
      const footprints=model.EventObjects.filter(e=>/^FPT/i.test(e.Name)).flatMap(e=>Array.from(e.EventTrack).filter(t=>t>=sequence.Interval[0]&&t<=frame).map(t=>({age:frame-t,name:e.Name}))).sort((a,b)=>a.age-b.age);
      const draw=gl.drawArrays,positions=[],drawCamera={projectionMatrix:new camera.matrixWorld.constructor(),matrixWorldInverse:new camera.matrixWorld.constructor()};
      gl.drawArrays=function(...args){const program=gl.getParameter(gl.CURRENT_PROGRAM),extent=gl.getUniformLocation(program,'extent'),transform=gl.getUniformLocation(program,'transform');if(extent&&transform)positions.push(gl.getUniform(program,transform)[12]);return draw.apply(this,args);};
      let original,travelled,repeated;
      const render=travel=>{positions.length=0;r.eventPreview.render({frame,sequenceIndex,globalTime:frame,camera:drawCamera,spawn:false,travel});return [...positions];};
      try{original=render(false);travelled=render(true);repeated=render(true);}finally{gl.drawArrays=draw;}
      return{original,travelled,repeated,expected:footprints.map(f=>-sequence.MoveSpeed*f.age/1000),footprints,modelUnchanged:JSON.stringify(model)===before};
    });
    assert(result.original.length>0,'real footprint decals draw');assert.equal(result.original.length,result.expected.length);
    result.original.forEach((x,i)=>assert(Math.abs(result.travelled[i]-x-result.expected[i])<.02,'actual GPU decal transform follows authored movement speed'));
    assert.deepEqual(result.travelled,result.repeated);assert(result.modelUnchanged);
    const before=await page.evaluate(()=>footprintRuntime().controls.object.position.toArray()),box=await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.keyboard.down('Alt');await page.mouse.move(box.x+60,box.y+90);await page.mouse.down();await page.mouse.move(box.x+120,box.y+95,{steps:10});await page.mouse.up();await page.keyboard.up('Alt');await capture();
    assert.notDeepEqual(await page.evaluate(()=>footprintRuntime().controls.object.position.toArray()),before,'normal mouse camera rotation');
    await page.evaluate(()=>{
      const r=footprintRuntime(),gl=r.native.gl,camera=r.controls.object,render=r.eventPreview.render,draw=gl.drawArrays,uniform=gl.uniformMatrix4fv;
      window.footprintFrames=[];let current,currentTransform;
      // Read the matrix submitted to GL before float32 projection roundoff,
      // which grows when inverting the depth range of the user's saved camera.
      gl.uniformMatrix4fv=function(location,transpose,matrix){currentTransform=[...matrix];return uniform.call(this,location,transpose,matrix);};
      gl.drawArrays=function(...args){
        const program=gl.getParameter(gl.CURRENT_PROGRAM),extent=current&&gl.getUniformLocation(program,'extent'),transform=extent&&gl.getUniformLocation(program,'transform');
        if(transform){const matrix=new camera.matrixWorld.constructor().fromArray(currentTransform);matrix.premultiply(camera.projectionMatrix.clone().invert()).premultiply(camera.matrixWorld);current.draws.push({x:matrix.elements[12],alpha:gl.getUniform(program,gl.getUniformLocation(program,'tint'))[3]});}
        return draw.apply(this,args);
      };
      r.eventPreview.render=function(options){current={time:options.footprintPlayback?.clipTime,frame:options.frame,draws:[]};try{return render.call(this,options);}finally{footprintFrames.push(current);current=null;}};
      window.restoreFootprintProbe=()=>{r.eventPreview.render=render;gl.drawArrays=draw;gl.uniformMatrix4fv=uniform;};
    });
    await page.getByRole('button',{name:'Play',exact:true}).dispatchEvent('click');
    // Follow a real printed hoof through more than twelve Walk loops and its
    // entire seven-second Warcraft lifetime, including a pause/resume mid-trail.
    for(let i=0;i<18;i++){await page.waitForTimeout(100);await capture();}
    await page.getByRole('button',{name:'Stop',exact:true}).dispatchEvent('click');await capture();
    const pauseTime=await page.evaluate(()=>footprintFrames.at(-1).time);
    for(let i=0;i<3;i++){await page.waitForTimeout(100);await capture();}
    assert.equal(await page.evaluate(()=>footprintFrames.at(-1).time),pauseTime,'pause preserves the unwrapped footprint clock');
    await page.getByRole('button',{name:'Play',exact:true}).dispatchEvent('click');
    for(let i=0;i<120;i++){await page.waitForTimeout(100);await capture();if(await page.evaluate(()=>footprintFrames.at(-1).time>8500))break;}
    const lifetime=await page.evaluate(()=>{
      const frames=footprintFrames.filter(f=>Number.isFinite(f.time)),first=frames.find(f=>f.draws.length),model=footprintRuntime().native.model,sequence=model.Sequences.find(s=>s.Name==='Walk'),speed=sequence.MoveSpeed;
      const birth=Math.min(...model.EventObjects.filter(e=>/^FPT/i.test(e.Name)).flatMap(e=>Array.from(e.EventTrack).filter(t=>t>=sequence.Interval[0]&&t<=sequence.Interval[1])))-sequence.Interval[0];
      const anchor=first.draws.at(-1).x+speed*first.time/1000;
      const observations=frames.filter(f=>f.time>=first.time).map(f=>({time:f.time,frame:f.frame,print:f.draws.find(d=>Math.abs(d.x+speed*f.time/1000-anchor)<.05),count:f.draws.length}));
      restoreFootprintProbe();return{birth,observations};
    });
    const alive=lifetime.observations.filter(f=>f.time<lifetime.birth+7000),expired=lifetime.observations.filter(f=>f.time>=lifetime.birth+7000);
    assert(alive.length>20&&expired.length>0,'observed the entire actual lifetime');assert(alive.every(f=>f.print),'same print survives every loop until its lifetime ends');
    assert(expired.every(f=>!f.print&&f.count>0),'only expired print disappears; newer prints remain');
    assert(alive.at(-1).print.alpha<.02,'old print naturally fades almost to zero');
    assert(alive.some((f,i)=>i>0&&f.frame<alive[i-1].frame),'test actually crossed loop boundaries');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({...result,lifetime,errors,mouseRotation:true},null,2));console.log('PASS real Chaos Knight hoofprint transforms, multiple loop boundaries, full seven-second fade/expiration, pause/resume, model preservation and mouse rotation.');
    if(process.env.MDLXL_KEEP_TEST_OPEN==='1'){await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setTitle('MDLxL — Chaos Knight particle and hoofprint test');w.show();});console.log('Test window open for user review.');await new Promise(resolve=>app.on('close',resolve));}
  }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
