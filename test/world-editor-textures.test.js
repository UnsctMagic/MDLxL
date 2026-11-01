import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument} from '../src/editor-document.js';
import {modelTextureNames,createEntryTextureLists,matchEntryTextures} from '../src/world-editor-textures.js';

test('reads the model texture list, skipping fileless replaceables',()=>{
 const doc=createDemoDocument();doc.model.Textures=[{Image:'Textures\\One.blp',ReplaceableId:0,Flags:0},{Image:'',ReplaceableId:1,Flags:0},{Image:'Textures\\Two.blp',ReplaceableId:0,Flags:0}];
 assert.deepEqual(modelTextureNames(doc.serialize('mdx'),'x.mdx'),['Textures\\One.blp','Textures\\Two.blp']);
 assert.deepEqual(modelTextureNames(doc.serialize('mdl'),'x.mdl'),['Textures\\One.blp','Textures\\Two.blp']);
});
test('all arts and variations in order, normalized dedupe, icon last, session/version cache',async()=>{
 const calls=[];const load=createEntryTextureLists(async(path,variant)=>{calls.push([path,variant]);return path==='a'?[{path:'Textures/One.dds',variant},{path:'Textures/Two.dds',variant}]:[{path:'textures\\one.dds',variant},{path:'Textures/Three.dds',variant}];},async(path,variant)=>({path,variant}));
 const entry={key:'we/0',models:[{path:'a'},{path:'b'}],icon:'Icon.blp'};
 const first=await load(entry,'reforged','sig');
 assert.deepEqual(first.map(x=>x.path),['Textures/One.dds','Textures/Two.dds','Textures/Three.dds','Icon.blp']);
 assert.equal(await load(entry,'reforged','sig'),first);assert.equal(calls.length,2);
 await load(entry,'classic','sig');assert.equal(calls.length,4);
 await load(entry,'classic','new');assert.equal(calls.length,6);
 const items=[{path:'Textures\\One.dds',variant:'reforged',id:1},{path:'textures\\one.dds',variant:'classic',id:2},{path:'Two.dds',sourcePath:'war3.w3mod:_hd.w3mod:Textures\\Two.dds',variant:'reforged',id:3}];
 const matched=matchEntryTextures(first,items);
 assert.deepEqual(matched.items.map(x=>x.id),[1,3]);assert.deepEqual(matched.missing,['Textures/Three.dds','Icon.blp']);
});
