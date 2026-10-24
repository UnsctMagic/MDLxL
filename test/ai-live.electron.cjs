// Opt-in acceptance with a real signed-in provider. Run on the hidden desktop.
// Uses only generated models; never saves over the account owner's model files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const profile=process.env.MDLXL_AI_LIVE_PROFILE,executablePath=process.env.MDLXL_AI_TEST_EXE;
if(!profile||!executablePath)throw Error('Set MDLXL_AI_LIVE_PROFILE to a signed-in MDLxL profile and MDLXL_AI_TEST_EXE to the packaged app.');
const out=path.resolve(process.env.MDLXL_AI_TEST_OUT||'out/ai-live'),checks=[],replies=[];
const check=(name,condition,detail)=>{checks.push({name,passed:!!condition,...(detail?{detail}:{})});assert.ok(condition,name);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let app,page,initialSettings,initialChat;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const {createStarterDocument}=await import('../src/starter-model.js');
 const doc=createStarterDocument();doc.apply('Live acceptance fixture',['Geosets','Sequences','Bones'],model=>{
   const g=model.Geosets[0];Object.assign(g,{Vertices:new Float32Array([0,0,-20,40,0,-20,40,0,20,0,0,20]),Normals:new Float32Array([0,-1,0,0,-1,0,0,-1,0,0,-1,0]),Faces:new Uint16Array([0,1,2,0,2,3]),VertexGroup:new Uint8Array(4),TVertices:[new Float32Array([0,0,1,0,1,1,0,1])]});
   delete g.Tangents;delete g.SkinWeights;const other=structuredClone(g);for(let i=0;i<other.Vertices.length;i+=3)other.Vertices[i]+=100;model.Geosets.push(other);
   model.Sequences=[{Name:'Stand',Interval:new Uint32Array([0,1000]),MoveSpeed:0,NonLooping:false,Rarity:0},{Name:'Attack',Interval:new Uint32Array([2000,3000]),MoveSpeed:0,NonLooping:false,Rarity:0}];
   model.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[0,1000,2000,3000].map(Frame=>({Frame,Vector:new Float32Array([0,0,0])}))};
 });
 const fixture=path.join(out,'AI-live-acceptance.mdx');fs.writeFileSync(fixture,doc.serialize('mdx'));const originalBytes=fs.readFileSync(fixture);
 app=await _electron.launch({executablePath,args:[fixture],env:{...process.env,MDLXL_PROFILE:profile,MDLXL_DISABLE_UPDATES:'1',TEMP:path.join(out,'temp'),TMP:path.join(out,'temp')},timeout:60000});
 page=await app.firstWindow();await page.waitForSelector('.classic-toolbar',{timeout:60000});await page.waitForTimeout(500);
 initialSettings=await page.evaluate(()=>window.desktop.aiStatus());initialChat=await page.evaluate(()=>localStorage.getItem('mdlxl-ai-chat'));
 if(process.env.MDLXL_AI_LIVE_AWARENESS==='1')await page.evaluate(async()=>{window.aiLiveEvents=[];window.desktop.onAiEvent(event=>window.aiLiveEvents.push({type:event.type,name:event.name,text:event.type==='notice'?event.text:undefined,version:event.version}));await window.desktop.aiAwareness(true);});
 const auth=await page.evaluate(()=>window.desktop.aiAuth('status'));check('real provider account is signed in',auth.loggedIn===true);
 const connection=await page.evaluate(async()=>{await window.desktop.aiEnable(true);return window.desktop.aiConfig();}),link=connection.mcpServers.mdlxl;
 const tool=async(name,args={})=>{const response=await fetch(link.url,{method:'POST',headers:{...link.headers,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}})});const value=await response.json();if(value.error||value.result?.isError)throw Error(value.error?.message||value.result.content[0].text);return value.result.content[0].type==='image'?value.result.content[0]:JSON.parse(value.result.content[0].text);};
 await page.getByRole('button',{name:'AI assistant',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ai-account')?.textContent==='Signed in.');
 async function prompt(text){
   await page.getByRole('button',{name:'New chat',exact:true}).click();await page.getByLabel('AI prompt').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();
   if(process.env.MDLXL_AI_LIVE_AWARENESS==='1'&&replies.length===0){
     await page.waitForFunction(()=>window.aiLiveEvents.some(event=>event.type==='tool'),null,{timeout:60000});
     const canvas=page.locator('.classic-view canvas').first(),box=await canvas.boundingBox();await page.keyboard.down('Alt');await page.mouse.move(box.x+220,box.y+210);await page.mouse.down();await page.mouse.move(box.x+275,box.y+230,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
   }
   await page.waitForFunction(()=>document.querySelector('.ai-error')?.textContent||(![...document.querySelectorAll('.ai-assistant footer button')].some(b=>b.textContent==='Stop')&&document.querySelector('.ai-role-assistant')?.textContent.trim().length>20),null,{timeout:240000});
   const errors=page.locator('.ai-error');if(await errors.count())throw Error(await errors.textContent());
   const task=await page.evaluate(()=>window.desktop.aiTask(localStorage.getItem('mdlxl-ai-chat')));
   check('real provider completes the required workflow',task.status==='complete'&&(text.startsWith('How')||task.phase==='verified'));
   replies.push({prompt:text,reply:await page.locator('.ai-role-assistant').last().innerText(),task});
 }
 let context=await tool('mdlxl_context');await tool('mdlxl_select',{target:context.target,vertices:{0:[0,1,2,3]},geosetIds:[0],activeGeoset:0});
 const original=await tool('mdlxl_read',{path:'/Geosets/0'}),protectedMesh=await tool('mdlxl_read',{path:'/Geosets/1'}),bones=await tool('mdlxl_read',{path:'/Bones'});
 await prompt('Move only the marked vertices 5 units along X. Keep all other vertices, faces, UVs, normals, skinning and animations unchanged. Apply the edit now.');
 const moved=await tool('mdlxl_read',{path:'/Geosets/0'}),expected=original.value.Vertices.$data.map((v,i)=>v+(i%3===0?5:0));
 check('real prompt moves exactly the marked vertices',same(moved.value.Vertices.$data,expected));
 for(const key of ['Faces','Normals','TVertices','VertexGroup','Groups'])check('movement preserves '+key,same(original.value[key],moved.value[key]));
 check('movement preserves the unselected mesh and animation',same(await tool('mdlxl_read',{path:'/Geosets/1'}),protectedMesh)&&same(await tool('mdlxl_read',{path:'/Bones'}),bones));
 context=await tool('mdlxl_context');await tool('mdlxl_command',{target:context.target,id:'undo'});check('one Undo restores the real AI edit',same(await tool('mdlxl_read',{path:'/Geosets/0'}),original));
 context=await tool('mdlxl_context');await tool('mdlxl_select',{target:context.target,vertices:{0:[0,1,2,3]}});
 await prompt('Mirror these marked vertices to the other side across X=0, keeping the original side and duplicating the selected faces. Weld the seam at X=0 where UVs, normals and skinning match. Leave the other geoset and all animations unchanged. Apply it now.');
 const mirrored=await tool('mdlxl_read',{path:'/Geosets/0'});
 check('real prompt duplicates the selected faces and welds the seam',mirrored.value.Vertices.$data.length===18&&mirrored.value.Faces.$data.length===12);
 check('mirroring preserves the unselected mesh and animation',same(await tool('mdlxl_read',{path:'/Geosets/1'}),protectedMesh)&&same(await tool('mdlxl_read',{path:'/Bones'}),bones));
 context=await tool('mdlxl_context');await tool('mdlxl_view',{target:context.target,mode:'animation',sequence:0,frame:500,playing:false});context=await tool('mdlxl_context');await tool('mdlxl_select',{target:context.target,nodeIds:[0]});
 await prompt('At the current frame 500 in Stand, set the selected root bone translation to [12, 0, 0]. Keep all other stored keys, especially Attack, and all geometry unchanged. Add just this sparse key, using the existing interpolation. Apply it now.');
 const edited=await tool('mdlxl_read',{path:'/Bones'}),track=edited.value[0].Translation;
 check('real prompt inserts the requested sparse animation key',track.Keys.length===5&&same(track.Keys.find(k=>k.Frame===500)?.Vector.$data,[12,0,0]));
 check('real animation edit preserves other keys and geometry',same(track.Keys.filter(k=>k.Frame!==500),bones.value[0].Translation.Keys)&&same(await tool('mdlxl_read',{path:'/Geosets/0'}),mirrored)&&same(await tool('mdlxl_read',{path:'/Geosets/1'}),protectedMesh));
 context=await tool('mdlxl_context');const mid=await tool('mdlxl_capture',{target:context.target});await tool('mdlxl_view',{target:context.target,frame:0});const end=await tool('mdlxl_capture',{target:context.target});check('real AI animation edit changes the rendered pose',mid.data!==end.data);
 await prompt('How do I rotate the model view with the mouse in MDLxL? Check the installed help and answer briefly. Do not edit the model.');check('real in-program help answers the mouse-control question',/Alt|drag|rotate/i.test(replies.at(-1).reply));
 context=await tool('mdlxl_context');const validation=await tool('mdlxl_document',{target:context.target,action:'validate'});check('real edits reopen as MDX and MDL',validation.results.every(r=>!r.error&&!r.readOnly),validation.results);
 check('input model file was never overwritten',originalBytes.equals(fs.readFileSync(fixture)));
 if(process.env.MDLXL_AI_LIVE_AWARENESS==='1'){
   const events=await page.evaluate(()=>window.aiLiveEvents);check('native Codex accepted continuous context inside the real turn',events.some(event=>event.type==='awareness-delivered'));
   check('no live-context delivery errors',!events.some(event=>event.text?.includes('Live context delivery failed')));
 }
 await page.screenshot({path:path.join(out,'real-provider.png')});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checks,replies},null,2));
 console.log(JSON.stringify({passed:checks.length,report:path.join(out,'verification.json')}));
})().catch(async error=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({checks,replies,error:error.stack},null,2));console.error(error);process.exitCode=1;}).finally(async()=>{if(app){if(initialSettings&&page)await page.evaluate(async({settings,chat})=>{await window.desktop.aiAwareness(!!settings.awareness);await window.desktop.aiEnable(!!settings.enabled);if(chat)localStorage.setItem('mdlxl-ai-chat',chat);else localStorage.removeItem('mdlxl-ai-chat');},{settings:initialSettings,chat:initialChat}).catch(error=>console.error(error));await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.destroy();}).catch(()=>{});await app.close().catch(()=>{});}for(const name of ['temp','AI-live-acceptance.mdx'])fs.rmSync(path.join(out,name),{recursive:true,force:true});});
