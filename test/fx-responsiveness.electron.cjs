// FX responsiveness: the owner's "the whole thing LAGS a lot" on the Surface Effects window, measured the
// user's way on the packaged app. Real clicks, drags, keys and picks on a Footman (body and sword) and a
// dense model; for each action it records the time from the input to the preview showing the result,
// how many WebGL previews were built for it, structured clones and main-thread long tasks; and frame
// times while idle with a look showing, while dragging a slider and while turning the camera.
// FX_RESPONSIVENESS_MODELS=path|part,path|part overrides the setups; FX_RESPONSIVENESS_REPORT=1 skips the limits.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {launchApp,closeApp,root}=require('./helpers/app.cjs');
const {fixturePath,testModel}=require('./helpers/fixtures.cjs');
const {openFxPicker,fxPickerNames,pickerRow}=require('./helpers/fx-input.cjs');
const DEFAULT_SETUPS=[
 {name:'footman',model:fixturePath('footman'),parts:['body','sword'],full:true},
 {name:'dense',model:testModel('pose-performance/GnomeLindormrRider_TwinHeads_FaceAlphaWrap.mdx'),parts:['body']},
];
const SETUPS=process.env.FX_RESPONSIVENESS_MODELS?process.env.FX_RESPONSIVENESS_MODELS.split(',').map((entry,i)=>{const [model,parts='body',full]=entry.split('|');return {name:'model'+(i+1),model,parts:parts.split('+'),full:full==='full'};}):DEFAULT_SETUPS;
const reportOnly=process.env.FX_RESPONSIVENESS_REPORT==='1';
// Instrumentation only: counts and times, nothing here drives the window.
const INSTRUMENT=`(()=>{if(window.__fxPerf)return;
 const perf=window.__fxPerf={contexts:0,clones:0,cloneMs:0,long:[],t0:null,mode:null,frames:null};
 const getContext=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...rest){if(type==='webgl2'&&!this.__fxCounted){this.__fxCounted=1;perf.contexts++;}return getContext.call(this,type,...rest);};
 const clone=window.structuredClone;
 window.structuredClone=function(value,options){const t=performance.now();try{return clone(value,options);}finally{perf.clones++;perf.cloneMs+=performance.now()-t;}};
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())perf.long.push([e.startTime,e.duration]);}).observe({type:'longtask'});}catch{}
 const arm=(type,test)=>window.addEventListener(type,e=>{if(perf.mode===type&&perf.t0==null&&(!test||test(e)))perf.t0=performance.now();},true);
 arm('pointerdown');arm('pointerup');arm('change');arm('keydown',e=>e.key==='Enter');
 const tick=t=>{if(perf.frames)perf.frames.push(t);requestAnimationFrame(tick);};requestAnimationFrame(tick);
})()`;
const stats=list=>{const sorted=[...list].sort((a,b)=>a-b);return {n:list.length,mean:list.length?list.reduce((a,b)=>a+b,0)/list.length:0,p95:sorted[Math.floor(sorted.length*.95)]||0,max:sorted.at(-1)||0};};
const round=v=>Math.round(v*10)/10;
(async()=>{
 const out=path.join(root,'out/fx-responsiveness');fs.mkdirSync(out,{recursive:true});
 const report={package:process.env.MDLXL_TEST_EXE||process.env.MDLXL_SUITE_PKG||'dev',setups:{}};
 for(const setup of SETUPS){
  // The test-model collection is private: a missing model is skipped, never failed (GitHub CI has none).
  if(!setup.model||!fs.existsSync(setup.model)){console.log('skip '+setup.name+': model not found');continue;}
  const errors=[],consoleErrors=[],rows=report.setups[setup.name]={model:path.basename(setup.model),actions:[],frames:[]};
  const {app,page}=await launchApp({fixture:setup.model,out,errors,bounds:{x:-3000,y:0,width:1280,height:920},settings:{preferences:{language:'en',learn:{enabled:false}}}});
  try{
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,300));});
   await page.evaluate(INSTRUMENT);
   const fx=page.locator('.surface-effects .sfx-window').first();
   const ready=(timeout=60000)=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout,polling:'raf'});
   // One user action: input → the preview shows a new compiled model, ready, and one frame drawn.
   async function measure(label,mode,act){
    await ready();
    await page.evaluate(mode=>{const p=window.__fxPerf,e=document.querySelector('.sfx-stage .game-preview-root');p.before=mdlxlProbe(e).props.model;p.mode=mode;p.t0=null;p.t1=null;p.mark={contexts:p.contexts,clones:p.clones,cloneMs:p.cloneMs,long:p.long.length};},mode);
    await act();
    await page.waitForFunction(()=>{const p=window.__fxPerf,e=document.querySelector('.sfx-stage .game-preview-root');if(!e||p.t0==null)return false;const probe=mdlxlProbe(e);
     const done=probe.props.model!==p.before&&probe.runtime?.captureApi.isReady&&probe.runtime.particleSourceModel===probe.props.model&&!document.querySelector('.sfx-apply')?.disabled;
     if(done&&p.t1==null)p.t1=performance.now();return done;},null,{timeout:60000,polling:'raf'}).catch(async e=>{
     const state=await page.evaluate(()=>{const p=window.__fxPerf,e=document.querySelector('.sfx-stage .game-preview-root'),probe=e&&mdlxlProbe(e);return {t0:p.t0,mode:p.mode,changed:probe?.props.model!==p.before,ready:probe?.runtime?.captureApi.isReady,same:probe?.runtime?.particleSourceModel===probe?.props.model,apply:!document.querySelector('.sfx-apply')?.disabled,message:document.querySelector('.sfx-stage-message')?.textContent};});
     throw Error(label+' did not show: '+JSON.stringify(state)+' '+e.message);});
    const row=await page.evaluate(async label=>{const p=window.__fxPerf;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     const long=p.long.slice(p.mark.long).filter(([start])=>start>=p.t0-5);p.mode=null;
     return {action:label,ms:Math.round(p.t1-p.t0),previews:p.contexts-p.mark.contexts,clones:p.clones-p.mark.clones,cloneMs:Math.round(p.cloneMs-p.mark.cloneMs),longTasks:long.length,longMs:Math.round(long.reduce((a,[,d])=>a+d,0)),longest:Math.round(Math.max(0,...long.map(([,d])=>d)))};},label);
    row.part=part;rows.actions.push(row);console.log(setup.name+' '+part+' | '+label+': '+row.ms+' ms, previews '+row.previews+', clones '+row.clones+' ('+row.cloneMs+' ms), long tasks '+row.longTasks+' ('+row.longMs+' ms, longest '+row.longest+')');
    return row;
   }
   async function frames(label,during){
    await ready();
    await page.evaluate(()=>{window.__fxPerf.frames=[];window.__fxPerf.frameLong=window.__fxPerf.long.length;});
    await during();
    const result=await page.evaluate(()=>{const p=window.__fxPerf,t=p.frames;p.frames=null;const gaps=t.slice(1).map((v,i)=>v-t[i]);return {gaps,span:t.at(-1)-t[0],long:p.long.slice(p.frameLong).length};});
    const s=stats(result.gaps),row={what:label,part,fps:round(result.gaps.length/(result.span/1000)),meanFrame:round(s.mean),p95Frame:round(s.p95),longestFrame:round(s.max),framesOver50ms:result.gaps.filter(g=>g>50).length,longTasks:result.long};
    rows.frames.push(row);console.log(setup.name+' '+part+' | frames '+label+': '+row.fps+' fps, p95 '+row.p95Frame+' ms, longest '+row.longestFrame+' ms');
    return row;
   }
   // A fixed window is the measurement itself here (frames over time), not a wait for a result.
   const idle=ms=>page.evaluate(ms=>new Promise(r=>setTimeout(r,ms)),ms);
   const search=async name=>{const input=fx.getByLabel('Find a surface effect');await input.click();await input.fill(name);};
   const look=async name=>{await search(name);const row=fx.getByRole('button',{name:name+' global animation',exact:true});await row.waitFor();return measure('look '+name,'pointerdown',()=>row.click());};
   const layerButton=label=>fx.locator('.fx-layer-list .fx-layer-row button',{hasText:label}).first();
   const stage=()=>fx.locator('.sfx-stage canvas[data-clean-model-canvas]').first();
   let part='body';
   await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
   const geosetOf=which=>page.evaluate(part=>{
    const m=mdlxlProbe('.sfx-stage .game-preview-root').props.model,size=g=>{const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<g.Vertices.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],g.Vertices[i+k]);hi[k]=Math.max(hi[k],g.Vertices[i+k]);}return hi.map((v,k)=>v-lo[k]).sort((a,b)=>b-a);};
    let best=-1,score=-1;m.Geosets.forEach((g,i)=>{if(g._FxTag||g.Vertices.length<24)return;const s=size(g),v=part==='sword'?s[0]/Math.max(1,s[1]):g.Vertices.length;if(v>score){score=v;best=i;}});return String(best);
   },which);
   for(const [n,which] of setup.parts.entries()){
    const index=await geosetOf(which),select=fx.getByLabel('Geoset',{exact:true});
    if(await select.inputValue()!==index){part=which;await measure('geoset change','change',()=>select.selectOption(index));}
    part=which;
    if(!n){await fx.getByRole('button',{name:'Fit selection',exact:true}).click();}
    await look('Frost');
    if(!n)await measure('Variation change','change',()=>fx.getByLabel('Variation',{exact:true}).selectOption({label:'Frosted steel'}));
    await frames('idle with Frost',()=>idle(2500));
    await look('Fire');
    if(setup.full&&!n){
     // Intensity of the selected flame emitter: a mouse drag on the slider, measured from the release.
     const intensity=fx.getByRole('slider',{name:'Intensity'});await intensity.scrollIntoViewIfNeeded();const box=await intensity.boundingBox();
     await page.mouse.move(box.x+box.width-6,box.y+box.height/2);await page.mouse.down();
     await page.mouse.move(box.x+box.width*.6,box.y+box.height/2,{steps:12});
     await measure('Intensity release','pointerup',()=>page.mouse.up());
     // Moving skin Speed: type a value and press Enter.
     await layerButton('Hot core').click();
     const speed=fx.getByLabel('Speed',{exact:true});await speed.click({clickCount:3});await page.keyboard.type('1.5');
     await measure('Speed change','keydown',()=>page.keyboard.press('Enter'));
     await measure('layer checkbox','pointerdown',()=>fx.locator('.fx-layer-list .fx-layer-row input[type=checkbox]').last().click());
     const first=(await fxPickerNames(page,fx,'emitter'))[0];
     await openFxPicker(fx,'emitter');await page.keyboard.type(first);
     await measure('Add emitter pick','pointerdown',()=>pickerRow(page,fx,first).click());
     await measure('Add','pointerdown',()=>fx.getByRole('button',{name:'Add',exact:true}).click());
     // Dragging an emitter slider: frames while the hand moves, then the release.
     await layerButton('Flames').click();
     const slider=fx.getByRole('slider',{name:'Speed',exact:true}).first();await slider.scrollIntoViewIfNeeded();const sbox=await slider.boundingBox();
     await frames('dragging a slider',async()=>{await page.mouse.move(sbox.x+sbox.width*.3,sbox.y+sbox.height/2);await page.mouse.down();for(let i=0;i<=90;i++)await page.mouse.move(sbox.x+sbox.width*(.3+.5*i/90+.05*Math.sin(i/6)),sbox.y+sbox.height/2);});
     await measure('slider release','pointerup',()=>page.mouse.up());
    }
    await frames('idle with Fire',()=>idle(2500));
    const sbox=await stage().boundingBox();
    await frames('turning the camera',async()=>{const cx=sbox.x+sbox.width/2,cy=sbox.y+sbox.height/2;await page.mouse.move(cx,cy);await page.mouse.down();for(let i=0;i<=90;i++)await page.mouse.move(cx+Math.sin(i/90*Math.PI*2)*120,cy+Math.sin(i/45*Math.PI)*20);await page.mouse.up();});
    for(const name of ['Fly swarm','Glow shell','Lightning cage']){await look(name);await frames('idle with '+name,()=>idle(2500));}
   }
   assert.deepEqual(errors,[],'page errors');
   rows.consoleErrors=consoleErrors;
  }finally{await closeApp(app).catch(()=>{});}
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
 console.log('report: '+path.join(out,'report.json'));
 if(reportOnly)return;
 // Limits relative to this PC's own speed: Glow shell adds no skin attachments, so its pick is the cost of one
 // compile and one preview build. Before the fix an edit of the shown look resampled the whole skeleton:
 // Footman body Intensity 3.2x, Speed 2.9x, Fire 3.2x and the dense model's Fire 2.5x a Glow shell pick
 // (now about 1x, 1x, 1.2x and 0.8x).
 const failures=[],row=(setup,part,action)=>report.setups[setup]?.actions.find(r=>r.part===part&&r.action===action);
 const limit=(setup,part,action,most)=>{const r=row(setup,part,action),unit=row(setup,part,'look Glow shell');if(!r||!unit){failures.push(setup+' '+part+' '+action+' not measured');return;}const ratio=r.ms/Math.max(1,unit.ms);if(ratio>most)failures.push(setup+' '+part+' '+action+': '+r.ms+' ms = '+ratio.toFixed(2)+'x a Glow shell pick ('+unit.ms+' ms), limit '+most+'x');};
 for(const [setup,{actions,frames:list}] of Object.entries(report.setups)){
  for(const r of actions){if(r.previews>1)failures.push(setup+' '+r.part+' '+r.action+' built the preview '+r.previews+' times');if(r.ms>20000)failures.push(setup+' '+r.part+' '+r.action+' took '+r.ms+' ms');}
  for(const f of list)if(f.longestFrame>500)failures.push(setup+' '+f.part+' '+f.what+': a '+f.longestFrame+' ms frame');
 }
 const [footman,dense]=Object.keys(report.setups);
 for(const action of ['Intensity release','Speed change'])limit(footman,'body',action,2);
 limit(footman,'body','look Fire',2);
 if(dense)limit(dense,'body','look Fire',1.6);
 assert.deepEqual(failures,[],failures.length+' responsiveness failures');
 console.log('PASS FX responsiveness: '+Object.entries(report.setups).map(([k,v])=>k+' '+v.actions.length+' actions, '+v.frames.length+' frame runs').join(', '));
})().catch(e=>{console.error(String(e.stack||e.message).slice(0,20000));process.exitCode=1;});
