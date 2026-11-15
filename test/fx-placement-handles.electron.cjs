const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,root}=require('./helpers/app.cjs'),{fixturePath}=require('./helpers/fixtures.cjs'),{clickEmitterDot}=require('./helpers/fx-input.cjs');
// Position & size on a native-emitter look (Fire), a card look (Rune circle) and a ribbon look (Souls): every handle
// that is drawn is dragged with real mouse moves and must change what the compiler built. A handle that does
// nothing must not be drawn. Set FXH_PROBE=1 to print the table of every layer, handle and result.
// A layer with several emitters shows a dot per emitter and no handles until a dot is clicked (owner, 14 Nov, PR #645:
// "in EMTR I just control 1 emitter"), so the test clicks the first dot like the user and drags that emitter's handles.
const LOOKS=['Fire','Rune circle','Souls'],PLACE=/^(Position|Size|Position & size)$/;
(async()=>{
 const out=path.join(root,'out/fx-placement-handles');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:0,y:0,width:1450,height:960},settings:{preferences:{language:'en',learn:{enabled:false}}}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage'),button=name=>fx.getByRole('button',{name,exact:true});
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout:45000});
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await button(name+' global animation').click();await ready();};
 const stack=()=>page.evaluate(()=>{const g=mdlxlProbe('.sfx-stage .game-preview-root').props.model.Geosets.find(g=>g._FxStack);return g._FxStack.layers.map(l=>({id:l.id,type:l.type,kind:l.kind,swarm:!!l.swarm,orbit:!!l.orbit,enabled:l.enabled!==false,tattoo:!!l.tattoo,facing:l.facing,size:l.size,upper:l.upper,lower:l.lower,offset:l.offset}));});
 // What the compiler built for one layer: its nodes plus a checksum of every geoset.
 const digest=id=>page.evaluate(id=>{
  const m=mdlxlProbe('.sfx-stage .game-preview-root').props.model,g=m.Geosets.find(g=>g._FxStack),prefix=g._FxStack.owner+'/'+id+'/';
  const text=JSON.stringify(m.Nodes.filter(n=>n?._FxTag?.startsWith(prefix)),(k,v)=>/^(GlobalSeqId|ObjectId|Parent|TextureID|Visibility|_FxTag|Name)$/.test(k)?undefined:ArrayBuffer.isView(v)?Array.from(v,x=>Math.round(x*1e3)/1e3):typeof v==='number'?Math.round(v*1e3)/1e3:v);
  let sum=0;for(const geo of m.Geosets)for(let i=0;i<geo.Vertices.length;i++)sum+=geo.Vertices[i]*((i%7)+1);
  return text.length+':'+text.split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0)+':'+Math.round(sum*100);
 },id);
 const handles=()=>page.evaluate(()=>[...document.querySelectorAll('.sfx-stage svg.pe-stage-tools:not(.fx-emitter-markers) [role=slider]')].map(e=>e.getAttribute('aria-label')));
 const camera=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());
 const drag=async(label,dx,dy,id)=>{
  const knob=fx.locator('svg.pe-stage-tools:not(.fx-emitter-markers)').getByRole('slider',{name:label,exact:true}).locator('circle:not(.pe-grab)');await knob.waitFor();
  const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  const sprite=()=>page.evaluate(id=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),n=(p.props.particleLiveModel||p.props.model).ParticleEmitters2.find(n=>n._FxTag?.includes('/'+id+'/'));return n?.ParticleScaling?.[1];},id);
  const first=await sprite();
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:12});
  // While the button is still down the preview already shows the new sprite size.
  if(label==='Resize particle')await page.waitForFunction(([id,first])=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),n=(p.props.particleLiveModel||p.props.model).ParticleEmitters2.find(n=>n._FxTag?.includes('/'+id+'/'));return n?.ParticleScaling?.[1]!==first;},[id,first],{timeout:3000}).catch(()=>{});
  const during=await sprite();
  await page.mouse.up();await ready();
  return {first,during};
 };
 const table=[],dead=[],missing=[];
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  await fx.getByLabel('Geoset',{exact:true}).selectOption('0');await ready();
  await button('Fit selection').click();await ready();
  for(const look of LOOKS){
   await choose(look);
   const layers=await stack(),buttons=fx.getByRole('group',{name:'Layers'}).getByRole('button');
   assert.equal(await buttons.count(),layers.length,look+': one layer button per layer');
   for(let i=0;i<layers.length;i++){
    await buttons.nth(i).click();await ready();
    const place=fx.locator('button.sfx-place');
    if(!await place.count()||!layers[i].enabled)continue;
    assert.match(await place.textContent(),PLACE);
    if(await place.getAttribute('aria-pressed')!=='true'){await place.click();await ready();}
    const tools=fx.locator('svg.pe-stage-tools:not(.fx-emitter-markers) [role=slider]'),dots=fx.locator('.fx-emitter-markers [role=button]');
    await fx.locator('.fx-emitter-markers [role=button], svg.pe-stage-tools:not(.fx-emitter-markers) [role=slider]').first().waitFor({timeout:5000}).catch(()=>{});
    let picked=false;
    if(await dots.count()){assert.equal(await tools.count(),0,look+'#'+i+': no handle before an emitter dot is clicked');assert.ok(await clickEmitterDot(page,fx),look+'#'+i+': an emitter dot is inside the preview');await tools.first().waitFor();await ready();picked=true;}
    const labels=(await handles()).filter((v,j,all)=>all.indexOf(v)===j),view=await camera();
    if(!labels.length)missing.push(look+'/'+layers[i].type+'#'+i);
    for(const label of labels){
     await ready();
     const reach=await page.evaluate(label=>{const box=document.querySelector('.sfx-stage').getBoundingClientRect(),e=[...document.querySelectorAll('.sfx-stage svg.pe-stage-tools:not(.fx-emitter-markers) [role=slider]')].find(v=>v.getAttribute('aria-label')===label);const b=e.querySelector('circle:not(.pe-grab)').getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
      return {inside:x>box.x&&x<box.right&&y>box.y&&y<box.bottom,top:document.elementFromPoint(x,y)?.closest('[role=slider]')?.getAttribute('aria-label')||document.elementFromPoint(x,y)?.tagName,x:Math.round(x-box.x),y:Math.round(y-box.y)};},label);
     const before=await digest(layers[i].id),was=(await stack())[i];
     const live=await drag(label,34,-26,layers[i].id);
     if(layers[i].type==='Particles'&&!layers[i].swarm&&!layers[i].tattoo&&label==='Resize particle')assert.notEqual(live.during,live.first,look+'#'+i+': the sprites change size while the Size handle is held');
     // The release commits on the next frames: wait for the compiled layer to change, or give up after a moment.
     let after=before,now=was;
     for(let wait=0;wait<12&&after===before;wait++){await page.waitForTimeout(250);after=await digest(layers[i].id);}
     await ready();now=(await stack())[i];const changed=before!==after;
     const values=['size','upper','lower'].map(k=>k+' '+(was[k]==null?'-':Math.round(was[k]*100)/100)+'>'+(now[k]==null?'-':Math.round(now[k]*100)/100)).join(' ');
     table.push([look,i,layers[i].type,layers[i].kind||'',layers[i].swarm?'swarm':'',layers[i].orbit?'orbit':'',layers[i].facing||'',label,changed?'changes':'DEAD',values,(reach.inside?'in':'OUT')+' '+reach.x+','+reach.y+(reach.top===label?'':' COVERED by '+reach.top)].join(' | '));
     if(!changed)dead.push(look+'#'+i+' '+layers[i].type+' '+label);
     // A drag that did nothing may still have been a real drag: undo nothing, just keep going from the new state.
    }
    assert.ok(Math.hypot(...(await camera()).map((v,j)=>v-view[j]))<1e-6,look+'#'+i+': handle drags keep the camera');
    if(picked){await page.keyboard.press('Escape');await ready();}
   }
  }
  if(process.env.FXH_PROBE||dead.length)console.log(table.join('\n'));
  fs.writeFileSync(path.join(out,'table.txt'),table.join('\n'));
  assert.deepEqual(missing,[],'every layer with a Position button shows at least one handle');
  assert.deepEqual(dead,[],'no dead handle is drawn');
  assert.ok(table.some(row=>/Particles/.test(row)&&/Move emitter/.test(row)),'the Fire layer keeps its Move handle');
  assert.deepEqual(errors,[]);console.log('PASS every placement handle changes the compiled effect');
 }catch(error){console.log(table.join('\n'));await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
