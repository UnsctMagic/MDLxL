const { launchApp, closeApp, settle } = require('./helpers/app.cjs');

const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype'),{createServer}=await import('vite');
 const server=await createServer({root,configFile:false,esbuild:{jsxFactory:'localizedCreateElement',jsxInject:"import { localizedCreateElement } from '/app/localized-element.js'"},cacheDir:path.join(out,'performance-vite'),server:{host:'127.0.0.1',port:8061,strictPort:true,watch:null},logLevel:'error'});await server.listen();
 let app;const results={hardware:{cpu:'AMD Ryzen 7 5700X',cores:8,threads:16,gpu:'NVIDIA GeForce RTX 5060 Ti',driver:'32.0.16.1062',ramBytes:34281119744},samples:[]};
 try{
  const launched = await launchApp({ out, timeout: 60000, bounds: { x: -3000, y: 0, width: 1100, height: 850 }, show: 'inactive', pageTimeout: 30000 }); app = launched.app;
  const page=launched.page;

  const options=[{name:'baseline',query:'?baseline=1'},{name:'authoring',query:''},{name:'heavy',query:'?heavy=1'}];
  for(const option of options){
   await page.goto('http://127.0.0.1:8061/test/particle-performance.html'+option.query);await page.waitForFunction(()=>window.capture?.isReady||window.fixture?.status?.error,{},{timeout:60000});await settle(page, 3000);
   const context=await page.evaluate(()=>{
    const root=document.querySelector('.game-preview-root');let runtime;
    { const value = mdlxlProbe(root).runtime; if (value) runtime=value; }
    if(!runtime)throw Error('Preview runtime missing');const native=runtime.native,gl=native.particlesController.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');window.bench={native,frames:[],latency:[],waiting:null,field:null};
    const render=native.render;native.render=function(...args){const result=render.apply(this,args),now=performance.now();window.bench.frames.push(now);const pending=window.bench.waiting,p=native.particlesController.emitters[0];
     if(pending&&p.particles.length){const value=pending.field==='ParticleScaling'?Math.max(...p.props.ParticleScaling):Math.hypot(...p.particles[0].speed);if(Math.abs(value-pending.value)<.001){window.bench.latency.push({field:pending.field,value:pending.value,ms:now-pending.at});window.bench.waiting=null;}}
     return result;
    };
    document.addEventListener('input',e=>{if(e.target.type==='range'&&window.bench.field)window.bench.waiting={field:window.bench.field,value:Number(e.target.value),at:performance.now()};},true);
    return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:{css:[gl.canvas.clientWidth,gl.canvas.clientHeight],pixels:[gl.canvas.width,gl.canvas.height]},initialParticles:native.particlesController.emitters.reduce((n,e)=>n+e.particles.length,0)};
   });
   await settle(page, 5000);
   const frames=await page.evaluate(()=>{const times=window.bench.frames,intervals=times.slice(1).map((n,i)=>n-times[i]).sort((a,b)=>a-b);return {draws:times.length,fps:(times.length-1)*1000/(times.at(-1)-times[0]),p95Interval:intervals[Math.floor(intervals.length*.95)],liveParticles:window.bench.native.particlesController.emitters.reduce((n,e)=>n+e.particles.length,0),status:window.fixture.status,authoredRate:window.fixture.document.model.ParticleEmitters2[0].EmissionRate};});
   const sample={name:option.name,...context,...frames};
   if(option.name==='authoring'){
    await page.evaluate(()=>window.fixture.pause());await page.waitForFunction(()=>window.capture.isReady);await settle(page, 200);
    for(const [field,label]of [['ParticleScaling','Size'],['Speed','Speed']]){
     await page.evaluate(field=>{window.bench.field=field;},field);const slider=page.getByRole('slider',{name:label,exact:true}),box=await slider.boundingBox();
     await page.mouse.move(box.x+box.width*.15,box.y+box.height/2);await page.mouse.down();
     for(let i=0;i<25;i++){await page.mouse.move(box.x+box.width*(.2+i*.02),box.y+box.height/2);await page.waitForFunction(()=>window.bench.waiting===null,{},{timeout:10000});}
     await page.mouse.up();
    }
    sample.latency=await page.evaluate(()=>window.bench.latency);for(const field of ['ParticleScaling','Speed']){const values=sample.latency.filter(r=>r.field===field).map(r=>r.ms).sort((a,b)=>a-b);sample[field]={count:values.length,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};}
   }
   results.samples.push(sample);fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({...sample,latency:undefined}));
  }
 }finally{if(app)await closeApp(app);await server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
