// Generated world-mode review: hidden suite only, paired mouse controls,
// strength changes from the approved base, approval, Back and approved-only save.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,prepareWindow,closeApp,appTarget}=require('./helpers/app.cjs');
(async()=>{
 const {createStarterDocument}=await import('../src/starter-model.js');
 const {openDocument}=await import('../src/editor-document.js');
 const {ModelRenderer}=await import('war3-model');
 const {runOptimizeStage,simpleSettings}=await import('../src/optimizexl.js');
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','world-budget-ui');fs.mkdirSync(out,{recursive:true});
 const doc=createStarterDocument();
 doc.apply('Dense curve',['Sequences','Bones','Geosets'],m=>{
  m.Sequences=[{Name:'Stand',Interval:new Uint32Array([0,1000]),MinimumExtent:new Float32Array([-64,-64,-64]),MaximumExtent:new Float32Array([64,64,64]),BoundsRadius:120,MoveSpeed:0,NonLooping:false,Rarity:0}];
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:Array.from({length:101},(_,i)=>({Frame:i*10,Vector:new Float32Array([15*Math.sin(i/30),0,0])}))};
  m.Geosets[0].Anims=[{MinimumExtent:new Float32Array([-64,-64,-64]),MaximumExtent:new Float32Array([64,64,64]),BoundsRadius:120}];
 });
 const source=Buffer.from(doc.serialize('mdx')),fixture=path.join(out,'Dense.mdx');fs.writeFileSync(fixture,source);
 const model=openDocument(source,'source.mdx').model,settings=simpleSettings('animation',100,model,'world'),expected=runOptimizeStage(source,'animation',settings);
 const {app,errors}=await launchApp({fixture,out,pageTimeout:30000});let p;
 try{
  const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();p=await pending;
  await prepareWindow(app,p,{bounds:{x:-3500,y:0,width:1500,height:950},errors,pageTimeout:30000});
  const nav=name=>p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name,exact:true});
  const ready=()=>p.waitForFunction(()=>document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));
  const data=()=>p.evaluate(()=>{const root=document.querySelector('.ox-preview .game-preview-root'),props=mdlxlProbe(root).props;return Array.from(props.model.Bones[0].Translation.Keys,k=>k.Frame);});
  await nav('Animation optimization').click();await ready();
  assert.equal(await p.getByLabel('Reduction method',{exact:true}).count(),0,'new options stay in Advanced');
  await p.getByRole('button',{name:'Advanced',exact:true}).click();assert.equal(await p.getByLabel('Reduction method',{exact:true}).inputValue(),'local');
  await p.getByLabel('Reduction method',{exact:true}).selectOption('world');await ready();
  await p.getByRole('button',{name:'About World-space tolerance',exact:true}).click();await p.getByRole('tooltip').waitFor();
  await p.getByRole('button',{name:'Simple',exact:true}).click();await p.getByLabel('Strength',{exact:true}).fill('100');await ready();
  assert.ok(!(await p.locator('.ox-controls').textContent()).includes('[object Object]'),'raw motion diagnostics stay out of the compact controls');
  const afterRoot=p.locator('[aria-label="After preview"] .game-preview-root');
  const afterFrames=()=>afterRoot.evaluate(root=>mdlxlProbe(root).props.model.Bones[0].Translation.Keys.map(k=>k.Frame));
  assert.deepEqual(await afterFrames(),openDocument(expected.bytes,'expected.mdx').model.Bones[0].Translation.Keys.map(k=>k.Frame));
  await p.getByLabel('Strength',{exact:true}).fill('0');await ready();assert.deepEqual(await afterFrames(),model.Bones[0].Translation.Keys.map(k=>k.Frame),'lowering strength restores original detail');
  await p.getByLabel('Strength',{exact:true}).fill('100');await ready();
  const beforeRoot=p.locator('[aria-label="Before preview"] .game-preview-root');
  const expectedModels=[model,openDocument(expected.bytes,'expected.mdx').model];
  for(const frame of [0,333,600,1000]){
   await p.getByLabel('Animation frame',{exact:true}).fill(String(frame));
   await p.waitForFunction(frame=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root')).every(root=>Math.abs(mdlxlProbe(root).runtime.native.getFrame()-frame)<1e-5),frame);
   const native=await p.evaluate(()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),root=>Array.from(mdlxlProbe(root).runtime.native.rendererData.nodes[0].matrix)));
   native.forEach((matrix,side)=>{const renderer=new ModelRenderer(structuredClone(expectedModels[side]));renderer.setSequence(0);renderer.setFrame(frame);renderer.updateNode(renderer.rendererData.rootNode);matrix.forEach((v,i)=>assert.ok(Math.abs(v-renderer.rendererData.nodes[0].matrix[i])<1e-5));});
  }
  const camera=root=>root.evaluate(el=>mdlxlProbe(el).runtime.controls.object.position.toArray());
  for(const root of [beforeRoot,afterRoot]){
   const previous=await camera(root),box=await root.locator('[data-clean-model-canvas]').boundingBox();
   await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.56,{steps:12});await p.mouse.up();
   await p.waitForFunction(({previous,side})=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'))[side]&&mdlxlProbe(Array.from(document.querySelectorAll('.ox-preview .game-preview-root'))[side]).runtime.controls.object.position.toArray().some((v,i)=>Math.abs(v-previous[i])>.1),{previous,side:root===beforeRoot?0:1});
   const a=await camera(beforeRoot),b=await camera(afterRoot);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6));
  }
  await p.getByRole('button',{name:'Approve',exact:true}).click();await nav('Unused data').waitFor();
  assert.deepEqual(await data(),model.Bones[0].Translation.Keys.map(k=>k.Frame),'Before stays pinned after approval');
  await p.getByRole('button',{name:'Back',exact:true}).click();await ready();
  await p.getByRole('button',{name:'Advanced',exact:true}).click();assert.equal(await p.getByLabel('Reduction method',{exact:true}).inputValue(),'world','Back restores the method');await p.screenshot({path:path.join(out,'world-budget.png')});
  await p.getByRole('button',{name:'Approve',exact:true}).click();await p.getByRole('button',{name:'Save',exact:true}).click();
  await p.getByRole('dialog',{name:'Save changes'}).waitFor();await p.getByRole('button',{name:'Save without backup',exact:true}).click();await p.getByText(/^Saved Dense\.mdx\./).waitFor();
  assert.deepEqual(fs.readFileSync(fixture),Buffer.from(expected.bytes),'save includes exactly the approved candidate');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:appTarget().packaged,saved:expected.saved,keys:expected.stats.keys,pairedMouseRotation:true,nativeMatrixPoses:8,strengthRestores:true,backRestores:true,beforePinned:true,approvedSave:true,errors},null,2));
  console.log('optimizexl-world-budget passed',out);
 }catch(error){console.error(error);if(p&&!p.isClosed())await p.screenshot({path:path.join(out,'failed.png')});throw error;}
 finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
