// FX click sweep: what the owner does, for every look and variation in the library, on a Footman sword,
// the Footman body and the dual warrior's weapon. After every click: no page or console error, no error
// screen, a filled controls column, a live window and a preview that still draws the model.
// FX_SWEEP_SETUPS=footman-sword,footman-body,warrior-weapon picks setups; FX_SWEEP_LOOKS=Name,Name limits looks.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {launchApp,closeApp,root}=require('./helpers/app.cjs');
const {fixturePath,testModel}=require('./helpers/fixtures.cjs');
const SETUPS=[
 {name:'footman-sword',model:fixturePath('footman'),part:'sword'},
 {name:'footman-body',model:fixturePath('footman'),part:'body'},
 {name:'warrior-weapon',model:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),part:'28',additions:true},
];
const chosen=(process.env.FX_SWEEP_SETUPS||'').split(',').filter(Boolean),onlyLooks=(process.env.FX_SWEEP_LOOKS||'').split(',').filter(Boolean);
(async()=>{
 const {GLOBAL_LOOKS}=await import(pathToFileURL(path.join(root,'src/global-animation-looks.js')).href);
 const looks=GLOBAL_LOOKS.filter(l=>!onlyLooks.length||onlyLooks.includes(l.name));
 const out=path.join(root,'out/fx-click-sweep');fs.mkdirSync(out,{recursive:true});
 const report={setups:{}},failures=[];
 for(const setup of SETUPS.filter(s=>!chosen.length||chosen.includes(s.name))){
  const result=report.setups[setup.name]={clicks:0,failures:[]};
  let session=null,where='';
  const open=async()=>{
   const errors=[],consoleErrors=[];
   const {app,page}=await launchApp({fixture:setup.model,out,errors,bounds:{x:-3000,y:0,width:1280,height:920},settings:{preferences:{language:'en',learn:{enabled:false}}}});
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,300));});
   const fx=page.locator('.surface-effects .sfx-window').first();
   session={app,page,fx,errors,consoleErrors,seen:{errors:0,console:0}};
   await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
   const index=/^\d+$/.test(setup.part)?setup.part:await page.evaluate(part=>{
    const m=mdlxlProbe('.sfx-stage .game-preview-root').props.model,size=g=>{const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<g.Vertices.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],g.Vertices[i+k]);hi[k]=Math.max(hi[k],g.Vertices[i+k]);}return hi.map((v,k)=>v-lo[k]).sort((a,b)=>b-a);};
    let best=-1,score=-1;m.Geosets.forEach((g,i)=>{if(g._FxTag||g.Vertices.length<24)return;const s=size(g),v=part==='sword'?s[0]/Math.max(1,s[1]):g.Vertices.length;if(v>score){score=v;best=i;}});return String(best);
   },setup.part);
   await fx.getByLabel('Geoset',{exact:true}).selectOption(index);await ready();
   await fx.getByRole('button',{name:'Fit selection',exact:true}).click();await ready();
   result.geoset=index;
  };
  const ready=(timeout=45000)=>session.page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout});
  // How much of the preview differs from its background: the model must still be drawn.
  const drawn=async()=>{const shot=await session.fx.locator('.sfx-stage').screenshot({type:'jpeg',quality:40});return session.page.evaluate(async data=>{const im=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))]));const c=new OffscreenCanvas(im.width,im.height),g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data,bg=[d[0],d[1],d[2]];let n=0;for(let i=0;i<d.length;i+=16)if(Math.abs(d[i]-bg[0])+Math.abs(d[i+1]-bg[1])+Math.abs(d[i+2]-bg[2])>30)n++;return n/(d.length/16);},shot.toString('base64'));};
  const check=async click=>{
   result.clicks++;
   const {page,fx,errors,consoleErrors,seen}=session,problems=[];
   if(page.isClosed())problems.push('window closed');
   else{
    try{await ready();}catch{problems.push('preview did not finish');}
    if(errors.length>seen.errors)problems.push('page error: '+errors.slice(seen.errors).join(' | '));
    if(consoleErrors.length>seen.console)problems.push('console error: '+consoleErrors.slice(seen.console).join(' | '));
    seen.errors=errors.length;seen.console=consoleErrors.length;
    if(await page.getByText('The interface could not finish drawing.').count())problems.push('error screen');
    else if(!(await fx.count())||(await fx.locator('.sfx-controls').innerText()).trim().length<10)problems.push('controls column blank');
    else{const share=await drawn().catch(()=>0);if(share<.01)problems.push('preview empty ('+share.toFixed(3)+')');}
   }
   if(problems.length){const failure=setup.name+' | '+where+' | '+click+': '+problems.join('; ');result.failures.push(failure);failures.push(failure);console.error('FAIL '+failure);throw Object.assign(Error(failure),{sweep:true});}
  };
  const act=async(click,fn)=>{await fn();await check(click);};
  const choose=async name=>{const input=session.fx.getByLabel('Find a surface effect');await input.fill(name);await session.fx.getByRole('button',{name:name+' global animation',exact:true}).click();};
  const rows=()=>session.fx.locator('.fx-layer-list .fx-layer-row');
  const openMore=async()=>{const d=session.fx.locator('details.fx-more');if(await d.count()&&await d.first().getAttribute('open')===null)await d.first().locator('summary').click();};
  async function sweepLayers(){
   const {fx}=session,count=await rows().count();
   for(let i=0;i<count;i++){
    const row=rows().nth(i),box=row.locator('input[type=checkbox]'),name=(await row.locator('button').innerText()).split('\n')[0],type=await row.locator('small').innerText();
    where=where.split(' > ')[0]+' > '+name;
    const off=!(await box.isChecked());
    if(off)await act('switch on',()=>box.check());
    await act('select layer',()=>row.locator('button').click());
    if(await fx.locator('details.fx-more').count())await act('open More',openMore);
    if(type==='Particles'&&await fx.getByLabel('Draw as',{exact:true}).count()){
     const draw=fx.getByLabel('Draw as',{exact:true}),now=await draw.inputValue();
     await act('Draw as',()=>draw.selectOption(now==='1'?'3':'1'));
     const slider=fx.getByRole('slider',{name:/^(Spread|Speed variety)$/}).first();
     if(await slider.count())await act('More slider',async()=>{await slider.focus();await session.page.keyboard.press('ArrowRight');await session.page.keyboard.press('ArrowRight');});
     const plus=fx.locator('.pe-frame-step button',{hasText:'+'}).first();
     if(await plus.count())await act('Rows +',()=>plus.click());
     const change=fx.getByLabel('Change emitter',{exact:true});
     if(await change.count()){const value=await change.locator('option').nth(2).getAttribute('value');if(value)await act('Change emitter to '+value,()=>change.selectOption(value));}
    }
    if(off){const again=rows().nth(i).locator('input[type=checkbox]');if(await again.count()&&await again.isChecked())await act('switch off',()=>again.uncheck());}
   }
  }
  try{await open();}catch(e){result.failures.push('could not open: '+e.message);failures.push(setup.name+' could not open: '+e.message);continue;}
  for(const look of looks){
   const variations=look.variations?look.variations.map(v=>v.name):[null];
   for(const variation of variations){
    where=look.name+(variation?' / '+variation:'');
    try{
     if(!session)await open();
     await act('choose look',()=>choose(look.name));
     if(variation&&variation!==variations[0])await act('variation',()=>session.fx.getByLabel('Variation',{exact:true}).selectOption({label:variation}));
     await sweepLayers();
    }catch(e){
     if(!e.sweep){const failure=setup.name+' | '+where+': '+String(e.message).split('\n')[0].slice(0,300);result.failures.push(failure);failures.push(failure);console.error('FAIL '+failure);}
     // Start again from a clean window after any failure, so one crash does not hide the next.
     await session?.page.screenshot({path:path.join(out,setup.name+'-'+result.failures.length+'.png')}).catch(()=>{});
     await closeApp(session.app).catch(()=>{});session=null;
    }
   }
  }
  if(setup.additions){
   where='Empty';
   try{
    if(!session)await open();
    await act('choose look',()=>choose('Empty'));
    const add=session.fx.getByLabel('Add layer',{exact:true});
    const layers=await add.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
    for(const value of layers){
     where='Empty > Add layer '+value;
     await act('add',()=>add.selectOption(value));
     await act('Remove layer',()=>session.fx.getByRole('button',{name:'Remove layer',exact:true}).click());
    }
    const emit=session.fx.getByLabel('Add emitter',{exact:true});
    const emitters=await emit.locator('option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
    for(const value of emitters){where='Empty > Add emitter '+value;await act('preview emitter',()=>emit.selectOption(value));}
    where='Empty > Add emitter '+emitters[0];
    await act('preview emitter',()=>emit.selectOption(emitters[0]));
    await act('Add',()=>session.fx.getByRole('button',{name:'Add',exact:true}).click());
    await act('Position & size',()=>session.fx.getByRole('button',{name:'Position & size',exact:true}).click());
    const handle=session.fx.getByRole('slider',{name:'Move emitter',exact:true}).locator('circle').first(),h=await handle.boundingBox();
    await act('drag move handle',async()=>{const {page}=session;await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+24,h.y+h.height/2-14,{steps:8});await page.mouse.up();});
   }catch(e){if(!e.sweep){const failure=setup.name+' | '+where+': '+String(e.message).split('\n')[0].slice(0,300);result.failures.push(failure);failures.push(failure);}}
  }
  if(session)await closeApp(session.app).catch(()=>{});
  console.log(setup.name+': '+result.clicks+' clicks, '+result.failures.length+' failures');
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
 assert.deepEqual(failures,[],failures.length+' failing clicks');
 console.log('PASS FX click sweep: '+Object.entries(report.setups).map(([k,v])=>k+' '+v.clicks+' clicks').join(', '));
})().catch(e=>{console.error(e.message.slice(0,20000));process.exitCode=1;});
