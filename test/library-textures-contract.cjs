const assert=require('node:assert/strict'),path=require('node:path');
// Contract T1–T10. All interaction uses the user's mouse/keyboard route;
// desktop IPC and probes below only read data for independent assertions.
module.exports=async function textureWorldEditor(page,out,checks){
 const {openDocument}=await import('../src/editor-document.js');
 const {buildWorldEditorCatalog,WORLD_EDITOR_FILES}=await import('../src/world-editor-catalog.js');
 const lib=page.getByRole('dialog',{name:'Warcraft III Library',exact:true});
 const style=name=>page.getByRole('button',{name,exact:true});
 const row=name=>page.locator('.gf-row').filter({has:page.locator('.gf-name',{hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).first();
 const tiles=()=>page.locator('.tl-tile');
 const titles=()=>tiles().evaluateAll(nodes=>nodes.map(node=>node.title));
 const complete=()=>page.waitForFunction(()=>!document.querySelector('.tl-grid .tl-tile:not(button)')&&document.querySelectorAll('.tl-grid button').length>0);
 const close=()=>page.getByRole('button',{name:'Close texture library',exact:true}).click();
 const open=async()=>{await page.locator('[data-hotkey="textureLibrary"]').click();await lib.waitFor();};
 const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
 await open();
 assert.equal(await style('World Editor Style').getAttribute('aria-pressed'),'true','T1: fresh Textures view defaults to World Editor Style');
 await row('Human').waitFor();
 const top=await page.locator('.gf-row[aria-level="1"] .gf-name').allInnerTexts();
 assert.deepEqual(top,['Human','Orc','Night Elf','Undead','Naga','Neutral Hostile','Neutral Passive','Items','Doodads']);
 await page.getByText('Choose a unit, spell, item or doodad to see its textures.',{exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.gf-row[aria-level="1"] img')].filter(i=>i.naturalWidth>0).length===9);
 assert.equal(await tiles().count(),0);await shot('textures-T1');checks.push('T1 fresh Textures: default World Editor tree, nine game icons and choose-entry line');
 const sources=await page.evaluate(files=>window.desktop.gameFilesWorldEditorSources({files}),WORLD_EDITOR_FILES);
 const catalogs=new Map();
 const catalog=variant=>{if(!catalogs.has(variant))catalogs.set(variant,buildWorldEditorCatalog(new Map(sources.files),sources.strings,{skin:{classic:'sd',reforged:'hd','forsaken-kingdom':'de'}[variant]}));return catalogs.get(variant);};
 const leaves=variant=>{const all=[];const walk=node=>node.children?node.children.forEach(walk):all.push(node);walk(catalog(variant).root);return all;};
 const expected=async(entry,variant)=>{
  const records=[];
  for(const model of entry.models){
   const data=await page.evaluate(async({path,variant})=>{const file=await window.desktop.gameFilesFindPath({path,variant});if(!file)return null;const raw=await window.desktop.gameFilesRead({id:file.id});return {file,bytes:Array.from(raw.bytes)};},{path:model.path,variant});
   if(!data)continue;
   const doc=openDocument(Uint8Array.from(data.bytes),data.file.name);assert.ok(doc.model,'independent openDocument reads '+model.path);
   const names=doc.model.Textures.map(t=>t.Image).filter(Boolean);
   const resolved=await page.evaluate(({id,names})=>window.desktop.gameFilesResolve({id,names,metadataOnly:true}),{id:data.file.id,names});
   records.push(...resolved.found);
  }
  if(entry.icon){const icon=await page.evaluate(({path,variant})=>window.desktop.gameFilesFindPath({path,variant}),{path:entry.icon,variant});if(icon)records.push(icon);}
  const unique=[...new Map(records.map(r=>[r.variant+'|'+r.path.toLowerCase().replaceAll('/','\\'),r])).values()];
  return page.evaluate(records=>window.desktop.textureLibraryCatalog({}).then(c=>records.flatMap(record=>{const item=c.items.find(item=>item.variant===record.variant&&item.sourcePath.toLowerCase().split(':').at(-1)===record.path.toLowerCase().replaceAll('/','\\'));return item?[item.sourcePath]:[];})),unique);
 };
 const search=page.getByRole('searchbox',{name:'Search textures'});
 const chooseSearch=async(name,entry)=>{await search.fill(name);await page.waitForFunction(value=>[...document.querySelectorAll('.gf-name')].some(n=>n.textContent.startsWith(value)),entry.name);await page.locator('.gf-row').filter({hasText:entry.name}).first().click();await complete();};
 await row('Human').click();await row('Units').click();await row('Normal').click();
 const footman=leaves('classic').find(e=>e.id==='hfoo');assert.ok(footman);
 const started=Date.now();await row('Footman').click();await complete();const coldMs=Date.now()-started;assert.ok(coldMs<1000,'R7 first entry click stays under 1 s: '+coldMs);
 const footExpected=await expected(footman,'classic');
 assert.deepEqual(await titles(),footExpected,'T2 tiles match openDocument textures plus icon, with no duplicates/team colour');
 await page.waitForFunction(()=>[...document.querySelectorAll('.tl-tile')].every(t=>t.querySelector('img')?.naturalWidth>0));
 await shot('textures-T2');checks.push(`T2 Footman ordered textures + icon match openDocument (${coldMs} ms cold click)`);
 const state=()=>page.evaluate(()=>{const m=window.__mdlxl?.model?.()||findFiberProps('.classic-view > .viewport',p=>p.model?.Textures)?.model;return m?{textures:m.Textures.map(t=>t.Image),materials:m.Materials.map(m=>m.Layers.map(l=>({texture:l.TextureID,filter:l.FilterMode}))),geosets:m.Geosets.map(g=>g.MaterialID)}:null;});
 // T3 uses the same native texture once from each view, and compares the full observable model change.
 const target=footExpected.find(p=>!/commandbuttons/i.test(p)&&!/textures\\footman\.(blp|dds)$/i.test(p))||footExpected.at(-1);
 const targetTile=()=>page.locator('.tl-tile').filter({has:page.locator('img')}).and(page.locator(`[title=${JSON.stringify(target)}]`));
 await targetTile().click();const add=page.getByRole('button',{name:'Add texture to model',exact:true});await add.waitFor();await add.click();
 await page.getByText('Texture added to the model.',{exact:true}).waitFor();const afterWorld=await state();assert.ok(afterWorld);
 await close();await page.keyboard.press('Control+z');
 await open();await style('Standard').click();await search.fill(path.win32.basename(target).replace(/\.[^.]+$/,''));
 await targetTile().waitFor();await targetTile().click();await add.click();await page.getByText('Texture added to the model.',{exact:true}).waitFor();assert.deepEqual(await state(),afterWorld,'T3 Add has identical Standard and World Editor result');
 checks.push('T3 Add texture changes the model identically to Standard');
 await style('World Editor Style').click();
 // T4 explicitly covers a multi-art spell and a multi-variation doodad.
 const spell=leaves('classic').find(e=>e.models.length>1&&e.models.some(m=>['Caster','Target','Effect','Missile','Area','Special'].includes(m.label))),doodad=leaves('classic').find(e=>/mushrooms/i.test(e.name)&&e.models.length>1);
 assert.ok(spell);assert.ok(doodad);
 for(const entry of [spell,doodad]){await chooseSearch(entry.name,entry);assert.deepEqual(await titles(),await expected(entry,'classic'),'T4 all arts/variations '+entry.name);}
 checks.push(`T4 ${spell.name} (${spell.models.length} arts), ${doodad.name} (${doodad.models.length} variations): all textures once`);
 await page.getByLabel('Texture source',{exact:true}).selectOption('reforged');const hd=leaves('reforged').find(e=>e.id==='hfoo');await chooseSearch('footman',hd);
 assert.deepEqual(await titles(),await expected(hd,'reforged'),'T5 HD module textures');assert.ok((await titles()).some(p=>/_hd\.w3mod/i.test(p)));
 const resultsBox=await page.locator('.tl-results').boundingBox();await page.mouse.move(resultsBox.x+resultsBox.width/2,resultsBox.y+resultsBox.height/2);
 for(let step=0;step<8;step++){
  await page.waitForFunction(()=>{const area=document.querySelector('.tl-results').getBoundingClientRect();return [...document.querySelectorAll('.tl-tile')].filter(t=>{const r=t.getBoundingClientRect();return r.bottom>area.top&&r.top<area.bottom;}).every(t=>t.querySelector('img')?.naturalWidth>0);},null,{timeout:45000});
  if(await page.locator('.tl-tile img').count()===await tiles().count())break;
  await page.mouse.wheel(0,500);
 }
 assert.equal(await page.locator('.tl-tile img').count(),await tiles().count(),'T5 every HD thumbnail decoded after scrolling');
 await page.mouse.wheel(0,-5000);await page.waitForFunction(()=>document.querySelector('.tl-results').scrollTop===0);
 await shot('textures-T5');checks.push('T5 Reforged Footman uses HD sources and decoded thumbnails');
 assert.equal(await page.getByText('Vibe search',{exact:true}).count(),0);assert.equal(await page.getByLabel('Texture kind',{exact:true}).count(),0);assert.equal(await search.getAttribute('placeholder'),'Search units, spells, items and doodads by name');checks.push('T6 name search finds Footman; Vibe/Kind hidden');
 const hdDDS=await titles();assert.ok(hdDDS.some(p=>/\.dds$/i.test(p)),'T8 entry includes DDS');await page.getByLabel('BLP textures only').check();
 await page.waitForFunction(()=>[...document.querySelectorAll('.tl-tile')].every(t=>!/\.dds$/i.test(t.title)));assert.deepEqual(await titles(),hdDDS.filter(p=>/\.blp$/i.test(p)));await page.getByLabel('BLP textures only').uncheck();checks.push('T8 BLP only hides DDS');
 await page.getByLabel('Texture source',{exact:true}).selectOption('classic');await search.fill('');await row('Human').click();await row('Units').click();await row('Normal').click();await row('Footman').click();await complete();
 for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown');
 await complete();const selected=await page.locator('.gf-row.selected').getAttribute('title');const lastEntry=leaves('classic').find(e=>e.models.map(m=>m.path).join('\n')===selected);assert.ok(lastEntry);
 await page.waitForFunction(name=>document.querySelector('.tl-result-status')?.textContent.endsWith(name),lastEntry.name);assert.deepEqual(await titles(),await expected(lastEntry,'classic'),'T7 last keyboard entry wins');checks.push('T7 five fast arrow steps leave the final unit textures');
 await search.fill('footman');const cachedFootman=page.locator('.gf-row').filter({hasText:'Footman'}).first();await cachedFootman.waitFor();const cachedStart=Date.now();await cachedFootman.click();await complete();const cachedMs=Date.now()-cachedStart;assert.ok(cachedMs<1000,'R7 cached entry click: '+cachedMs);checks.push(`R7 cached Footman click ${cachedMs} ms`);
 await style('Standard').click();await close();await open();assert.equal(await style('Standard').getAttribute('aria-pressed'),'true');assert.ok(await page.getByLabel('Texture kind',{exact:true}).isVisible());assert.ok(await page.getByText('Vibe search',{exact:true}).isVisible());
 await page.getByRole('tab',{name:'Models',exact:true}).click();assert.equal(await style('World Editor Style').getAttribute('aria-pressed'),'true');await row('Human').waitFor();assert.deepEqual(await page.locator('.gf-row[aria-level="1"] .gf-name').allInnerTexts(),top);checks.push('T10 Standard remembered on reopen; Models own layout and shared tree unchanged');await page.getByRole('tab',{name:'Textures',exact:true}).click();await close();
 // T9 is exercised by the original UV picker workflow immediately after this function.
};
