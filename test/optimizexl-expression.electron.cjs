const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { appTarget, launchApp, prepareWindow, closeApp, stubDialogs } = require('./helpers/app.cjs');

(async()=>{
 const {openDocument}=await import('../src/editor-document.js'),{runOptimizeStage,simpleSettings}=await import('../src/optimizexl.js');
 const files=process.env.MDLXL_EXPRESSION_MODEL?[process.env.MDLXL_EXPRESSION_MODEL]:['C:/Users/PC/Desktop/fINALS/WH_WOC_KnightKhorneFlail07.mdx','C:/Users/PC/Desktop/WH_WOC_KnightKhorneFlail03.mdx'];
 const proof=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','expression-ui');fs.mkdirSync(proof,{recursive:true});
 const reports=[];
 for(const [index,file] of files.entries()){
  const source=fs.readFileSync(file),model=openDocument(new Uint8Array(source),'source.mdx').model;
  const jaw=model.Bones.find(n=>n.Name==='BoneJaw'),sequence=model.Sequences.findIndex(s=>/portrait talk/i.test(s.Name));assert.ok(jaw&&sequence>=0);
  const expected=Buffer.from(runOptimizeStage(new Uint8Array(source),'animation',simpleSettings('animation',100,model)).bytes);
  const out=path.join(proof,`case-${index}-${Date.now()}`),copies=path.join(out,'copies');fs.mkdirSync(copies,{recursive:true});const work=path.join(out,path.basename(file));fs.copyFileSync(file,work);
  const exe=appTarget().packaged;
  const { app, errors } = await launchApp({ pageTimeout: 30000, fixture: work, out });
  try{
   const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
   const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;
   await prepareWindow(app, p, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 20000 }); await stubDialogs(app, { open: copies });
  // OptimizeXL opens on the Insanity FIxer; this review starts at Duplicate data.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Duplicate data',exact:true}).click();
   await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Animation optimization',exact:true}).click();
   await p.getByLabel('Strength',{exact:true}).fill('100');await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
   const pinned=await p.locator('[aria-label="Before preview"] h2').textContent();
   await p.getByLabel('Animation',{exact:true}).selectOption(String(sequence));
   await p.evaluate(()=>{window.expressionState=()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>{
    const { runtime, props } = mdlxlProbe(root); if(!runtime||!props)return null;const n=props.model.Bones.find(n=>n.Name==='BoneJaw');return {frame:runtime.native.getFrame(),sequence:runtime.native.getSequence(),keys:n.Translation.Keys.length,matrix:Array.from(runtime.native.rendererData.nodes[n.ObjectId].matrix)};
   });});
   const poses=[];
   for(const frame of [jaw.Translation.Keys[0].Frame,jaw.Translation.Keys[1].Frame,jaw.Translation.Keys[4].Frame]){
    await p.getByLabel('Animation frame',{exact:true}).fill(String(frame));
    await p.waitForFunction(({frame,sequence})=>expressionState().every(s=>s&&s.keys===7&&s.sequence===sequence&&Math.abs(s.frame-frame)<1e-5),{frame,sequence});
    const states=await p.evaluate(()=>expressionState());assert.deepEqual(states[1].matrix,states[0].matrix);poses.push(states[1].matrix);
   }
   assert.notDeepEqual(poses[0],poses[1],'After jaw must actually move');assert.notDeepEqual(poses[1],poses[2]);
   await p.screenshot({path:path.join(out,'maximum-strength-speech.png')});
   await p.getByRole('button',{name:'Advanced',exact:true}).click();
   for(const label of ['Translation tolerance','Rotation tolerance (degrees)','Scale tolerance']){await p.getByRole('button',{name:'About '+label,exact:true}).hover();assert.match(await p.getByRole('tooltip').textContent(),/10% relative/);await p.keyboard.press('Escape');await p.getByRole('tooltip').waitFor({state:'hidden'});}
   await p.getByRole('button',{name:'Approve',exact:true}).click();
   await p.getByRole('heading',{name:'Unused data',exact:true}).waitFor();assert.equal(await p.locator('[aria-label="Before preview"] h2').textContent(),pinned);
   await p.getByRole('button',{name:'Save',exact:true}).click();await p.getByRole('button',{name:'Save without backup',exact:true}).click();await p.getByText(/^Saved /).waitFor();
   const afterBytes=fs.readFileSync(work),plain=x=>JSON.stringify(openDocument(new Uint8Array(x),'x.mdx').model,(k,v)=>k==='Nodes'?undefined:ArrayBuffer.isView(v)?Array.from(v):v);assert.equal(plain(afterBytes),plain(expected));
   assert.equal(openDocument(new Uint8Array(afterBytes),'after.mdx').model.Bones.find(n=>n.Name==='BoneJaw').Translation.Keys.length,7);
   await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('heading',{name:'Animation optimization',exact:true}).waitFor();
   assert.match(await p.locator('footer').textContent(),/Total saved: 0.00 KB/);
   assert.deepEqual(fs.readFileSync(file),source);assert.deepEqual(errors,[]);
   reports.push({file,passed:true,nativePairedJawPoses:3,keysRetained:7,approvedOnlyPairSaved:true,backRestoresOriginal:true,originalUntouched:true,errors});
  }finally{await closeApp(app);}
 }
 fs.writeFileSync(path.join(proof,'result.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
