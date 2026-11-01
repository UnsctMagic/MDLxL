const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {root,launchApp,closeApp}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.join(root,'out/fx-followup'),{app,page,errors}=await launchApp({out,fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),ready=()=>page.waitForFunction(()=>{const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;const p=mdlxlProbe(el);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await fx.getByRole('button',{name:new RegExp('^'+name+' (global animation|impact)$')}).click();await ready();};
 const motion=async(stage,name)=>{
  const dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});
  for(let i=0;i<8;i++){
   const t=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame());
   await page.waitForFunction(t=>{const now=mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.getFrame();return now<t||now>=t+180;},t);
   await stage.screenshot({path:path.join(dir,i+'.jpg'),type:'jpeg',quality:85});
  }
 };
 const part=async i=>{await fx.getByLabel('Geoset',{exact:true}).selectOption(String(i));await ready();};
 const frame=()=>page.evaluate(()=>{const m=mdlxlProbe('.sfx-stage .game-preview-root').props.model,g=m.Geosets.find(g=>g._FxTag?.endsWith('/shape')),l=g&&m.Materials[g.MaterialID].Layers[0];return {image:m.Textures[l?.TextureID]?.Image,alpha:l?.Alpha?.Keys?.map(k=>k.Vector[0])??l?.Alpha,uv:Array.from(g?.TVertices[0]||[]),emitters:m.ParticleEmitters2.filter(n=>n._FxTag).map(n=>({p:n.Parent,pos:Array.from(n.PivotPoint),name:n.Name}))};});
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await part(27);await choose('Rune blade');
  const rune=fx.getByLabel('Rune',{exact:true});assert.equal(await rune.count(),1,'rune glyph can be chosen in FX');
  const choices=await rune.locator('option').evaluateAll(a=>a.map(o=>o.value));assert.ok(choices.length>=3);
  const stage=fx.locator('.sfx-stage');await fx.getByRole('button',{name:'Fit selection',exact:true}).click();
  for(const [i,value] of choices.entries()){await rune.selectOption(value);await ready();assert.equal((await frame()).image,value);await motion(stage,'rune-'+i);}
  const glow=fx.getByLabel('Rune glow',{exact:true});await glow.selectOption('steady');await ready();assert.equal(typeof (await frame()).alpha,'number');
  await glow.selectOption('flicker');await ready();assert.ok(new Set((await frame()).alpha).size>2);await motion(stage,'flicker');
  await fx.getByRole('button',{name:'Move UVs',exact:true}).click();const uv=fx.locator('.sfx-controls canvas').last();await uv.scrollIntoViewIfNeeded();const b=await uv.boundingBox(),before=(await frame()).uv;
  await page.mouse.move(b.x+b.width*.4,b.y+b.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.7,b.y+b.height*.53,{steps:8});await page.mouse.up();await ready();assert.notDeepEqual((await frame()).uv,before,'drag changes glyph position on the surface');await motion(stage,'moved-rune');
  await choose('Lava skin');const fire=fx.getByLabel('Enable Fire',{exact:true});assert.equal(await fire.isChecked(),false);assert.ok(!(await frame()).emitters.some(n=>n.name.startsWith('FX Fire')));
  await fire.check();await ready();assert.ok((await frame()).emitters.some(n=>n.name.startsWith('FX Fire')));await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.some(e=>e.props.Name?.startsWith('FX Fire')&&e.particles.length));await motion(stage,'lava-fire');await fire.uncheck();await ready();assert.ok(!(await frame()).emitters.some(n=>n.name.startsWith('FX Fire')));
  await part(0);await choose('Iron strike');const a=(await frame()).emitters;assert.ok(a.length);await part(28);assert.deepEqual((await frame()).emitters,a,'an unrelated geoset cannot move the contact');await fx.getByRole('button',{name:'Pause',exact:true}).click();await fx.getByRole('button',{name:'Fit selection',exact:true}).click();
  const size=fx.getByRole('button',{name:'Size',exact:true});assert.equal(await size.count(),1,'the burst keeps its resize tool');
  await size.click();await fx.getByRole('slider',{name:'Resize particle',exact:true}).waitFor();assert.equal(await fx.getByRole('slider',{name:'Move emitter',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: 4 rune choices, glow, UV drag, optional fire and Attack placement from two selections.');
 }finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
