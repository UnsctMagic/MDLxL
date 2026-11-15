import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {GLOBAL_LOOKS,newStack,partFrame,withVariation} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
import {modelHash} from './helpers/fx-legacy-snapshot.mjs';

// The FX window keeps one cache of skin-attachment samples per model revision and hands it to every compile
// (owner, 12 November: "the whole thing LAGS a lot", each pick resampled the whole skeleton). A compile with a
// cache warmed by other looks, other parts and an earlier compile of the same look must write exactly the
// model a compile without one writes.
const knightBytes=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
const knight=()=>openDocument(knightBytes,'knight.mdx').model;
// Parts of the real Knight: 17 skin regions (body), 4 (weapon), 1.
const PARTS=[37,8,1];
const byName=name=>GLOBAL_LOOKS.find(l=>l.name===name);
function stacksFor(model,part,only){
 const frame=partFrame(model.Geosets[part]),stacks=[];
 for(const look of only?[only]:GLOBAL_LOOKS){
  stacks.push(newStack(look,frame,'cache'));
  for(const v of look.variations?.slice(1)||[])stacks.push(withVariation(newStack(look,frame,'cache'),frame,look,v.id));
 }
 return stacks;
}
// One test per look (all its variations, on every part) keeps each under the suite's 5-minute limit; the cache
// is shared across all of them, so later looks still compile with samples warmed by earlier looks and parts.
const sharedBase=knight(),sharedAttachments=new Map();
for(const look of GLOBAL_LOOKS)test('a shared attachment cache compiles '+look.name+' byte-identically on many-region and weapon parts',()=>{
 const changed=[];
 for(const part of PARTS)for(const stack of stacksFor(sharedBase,part,look)){
  const plain=structuredClone(sharedBase),cached=structuredClone(sharedBase);
  compileAnimation(plain,part,structuredClone(stack));
  compileAnimation(cached,part,structuredClone(stack),{attachments:sharedAttachments});
  if(modelHash(plain)!==modelHash(cached))changed.push(part+' '+stack.look);
 }
 assert.deepEqual(changed,[]);
 assert.ok(sharedAttachments.size>0,'the cache was used');
});
test('a second compile of the same stack reads its samples from the cache and writes the same model',()=>{
 const base=knight(),attachments=new Map();
 for(const part of [37,8])for(const id of ['Fire','Frost','Lightning cage']){
  const look=byName(id),stack=newStack(look,partFrame(base.Geosets[part]),'again');
  const first=structuredClone(base);compileAnimation(first,part,structuredClone(stack),{attachments});
  const size=attachments.size,second=structuredClone(base);compileAnimation(second,part,structuredClone(stack),{attachments});
  assert.equal(attachments.size,size,id+' on part '+part+' sampled nothing new');
  assert.equal(modelHash(second),modelHash(first),id+' on part '+part);
 }
});
test('a model that already holds an applied look recompiles identically with the cache',()=>{
 const applied=knight(),attachments=new Map(),fire=byName('Fire'),frost=byName('Frost');
 compileAnimation(applied,37,newStack(fire,partFrame(applied.Geosets[37]),'applied'));
 for(const look of [fire,frost]){
  const stack={...newStack(look,partFrame(applied.Geosets[37]),'applied')};
  const plain=structuredClone(applied),cached=structuredClone(applied);
  compileAnimation(plain,37,structuredClone(stack));
  compileAnimation(cached,37,structuredClone(stack),{attachments});
  assert.equal(modelHash(cached),modelHash(plain),look.id);
 }
});
