import test from 'node:test';
import assert from 'node:assert/strict';
import { aiAssets, validateAiAssets } from '../app/ai-assets.js';
import { createStarterDocument } from '../src/starter-model.js';
import { starterTextureAsset } from '../src/particle-starters.js';

test('asset bridge searches personal parts and opens a reference without invoking editor commands',async()=>{
  const seen=[],doc=createStarterDocument(),host={state:()=>({model:doc.model,session:{path:null}}),addReference:async record=>{seen.push(record);return {id:'reference',name:record.name};}};
  const desktop={listParts:async()=>({children:[{id:'Armor',type:'folder',children:[{id:'Armor/Shield.mdx',name:'Shield.mdx',type:'model'}]}]}),readPart:async id=>({name:id,bytes:doc.serialize('mdx')})};
  assert.equal((await aiAssets({source:'parts',query:'shield'},host,()=>{},desktop)).items[0].id,'Armor/Shield.mdx');
  assert.equal((await aiAssets({source:'parts',action:'reference',id:'Armor/Shield.mdx'},host,()=>{},desktop)).reference.id,'reference');assert.equal(seen.length,1);
  await assert.rejects(()=>aiAssets({source:'parts',action:'reference',id:'Armor/Shield.mdx'},host,()=>{throw Error('cancelled');},desktop),/cancelled/);assert.equal(seen.length,1);
});
test('game references retain the source variant textures and require its catalog signature',async()=>{
  const doc=createStarterDocument(),seen=[],host={state:()=>({model:doc.model,session:{path:null}}),addReference:async record=>{seen.push(record);return {id:'reference'};}};
  const desktop={gameFilesRead:async args=>{assert.equal(args.signature,'snapshot');return {name:'Part.mdx',type:'models',bytes:doc.serialize('mdx')};},gameFilesResolve:async()=>({found:[{name:'test.blp',bytes:new Uint8Array([1,2])}],missing:[]})};
  await assert.rejects(()=>aiAssets({source:'game',action:'reference',id:'1'},host,()=>{},desktop),/signature/);
  await aiAssets({source:'game',action:'reference',id:'1',signature:'snapshot'},host,()=>{},desktop);assert.equal(seen[0].path,null);assert.equal(seen[0].textures[0].name,'test.blp');
});

test('generated textures must decode, be newly named and belong to the edited model',()=>{
  const asset=starterTextureAsset(),model={Textures:[{Image:asset.name}]};
  assert.equal(validateAiAssets([asset],model).length,1);
  assert.throws(()=>validateAiAssets([asset],model,new Map([[asset.name.toLowerCase(),asset]])),/existing textures/);
  assert.throws(()=>validateAiAssets([{...asset,name:'../../user.tga'}],model),/new MDLxL/);
  assert.throws(()=>validateAiAssets([asset],{Textures:[]}),/referenced/);
  assert.throws(()=>validateAiAssets([{...asset,bytes:new Uint8Array()}],model),/nonempty/);
});
