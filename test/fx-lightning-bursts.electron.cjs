const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,root}=require('./helpers/app.cjs'),{testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.join(root,'out/review/lightning');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage');
 const ready=()=>page.waitForFunction(()=>{const el=document.querySelector('.sfx-stage .game-preview-root');if(!el)return false;const p=mdlxlProbe(el);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await fx.getByLabel('Find a surface effect').fill('Lightning blade');await fx.getByRole('button',{name:'Lightning blade global animation'}).click();await ready();
  await fx.getByRole('button',{name:'Fit selection'}).click();const box=await stage.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,190);
  const sites=[];
  for(let i=0;i<4;i++){
   await page.waitForFunction(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props.Name.startsWith('FX Blade crackle')).every(e=>!e.particles.length));
   await stage.screenshot({path:path.join(out,i+'-quiet.jpg'),type:'jpeg',quality:90});
   const result=await page.waitForFunction(()=>{const es=mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.filter(e=>e.props.Name.startsWith('FX Blade crackle')&&e.particles.length>=2);return es.length===1?{id:es[0].props.ObjectId,parent:es[0].props.Parent,particles:es[0].particles.length}:false;});
   sites.push(await result.jsonValue());await stage.screenshot({path:path.join(out,i+'-burst.jpg'),type:'jpeg',quality:90});
  }
  assert.equal(new Set(sites.map(e=>e.parent)).size,2,'flashes alternate between the two independently animated weapons');
  assert.equal(new Set(sites.map(e=>e.id)).size,4,'each flash starts at a different point');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'sites.json'),JSON.stringify(sites,null,2));console.log('PASS four isolated bursts at four sites on both blades, with quiet frames in between.');
 }finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
