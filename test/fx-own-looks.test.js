import test from 'node:test';
import assert from 'node:assert/strict';
import * as looks from '../src/global-animation-looks.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';

const {findLook,makeLayer,newStack,partFrame}=looks;
const flames=frame=>{const look=findLook('flaming-sword');return look.layers.map((spec,i)=>makeLayer(spec,frame,look.palette,i+1));};
const shape=model=>JSON.stringify(Object.fromEntries(['Geosets','Materials','Textures','TextureAnims','GlobalSequences','GeosetAnims','ParticleEmitters2','RibbonEmitters'].map(key=>[key,model[key].length]).concat([['Nodes',model.Nodes.filter(Boolean).length]])));
const tagged=model=>[...model.Geosets,...model.Materials,...model.Textures,...model.TextureAnims,...model.Nodes.filter(Boolean)].filter(item=>item._FxTag||item._FxStack).length;

test('a stack whose look this PC does not list compiles, saves, reopens and gets a stand-in look',()=>{
 for(const format of ['mdx','mdl']){
  const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]);
  const stack={owner:'own-test',look:'own:whatever',name:'My fire',loop:1760,impact:false,layers:flames(frame).slice(0,2)};
  assert.equal(typeof looks.lookOf,'function','lookOf is exported');
  const stand=looks.lookOf(stack);
  assert.deepEqual([stand.id,stand.name,stand.group,stand.loop,stand.palette,stand.layers.length,stand.custom],['own:whatever','My fire','My looks',1760,'native',0,true]);
  compileAnimation(doc.model,0,stack);
  const reopened=openDocument(doc.serialize(format),'own.'+format),read=readAnimationStack(reopened.model,0);
  assert.ok(read,format+': the saved stack is read back although no built-in look has its id');
  assert.deepEqual([read.look,read.name,read.layers.length],['own:whatever','My fire',2]);
  assert.deepEqual(read.layers.map(l=>l.label),stack.layers.map(l=>l.label));
  const again=structuredClone(read);again.layers[0].strength=.5;
  compileAnimation(reopened.model,0,again);
  assert.equal(readAnimationStack(reopened.model,0).layers[0].strength,.5,format+': it re-applies');
 }
 assert.equal(looks.lookOf({look:'sort-thorn'}).id,'sort-thorn','a built-in look stays itself');
 assert.equal(looks.lookOf({look:'nobody'}).name,'Custom look');
});

test('Empty is the first look of Build your own, has no layers and starts a stack with none',()=>{
 const empty=findLook('empty');
 assert.ok(empty,'the Empty look exists');
 assert.deepEqual([empty.name,empty.group,empty.loop,empty.palette,empty.layers.length],['Empty','Build your own',3000,'native',0]);
 assert.equal(looks.GLOBAL_LOOKS.filter(l=>l.group==='Build your own')[0].id,'empty');
 const frame=partFrame(createDemoDocument().model.Geosets[0]);
 assert.equal(newStack(empty,frame,'o').layers.length,0);
 assert.equal(looks.emitterChoices(empty).length>0,true,'every emitter can still be added');
});

test('Applying zero layers removes what a stack owned and does nothing on a part without one',()=>{
 const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]),plain=shape(doc.model);
 const nothing={owner:'o1',look:'empty',loop:3000,impact:false,layers:[]};
 compileAnimation(doc.model,0,nothing);
 assert.equal(doc.model.Geosets[0]._FxStack,undefined,'no stack record is created');
 assert.equal(shape(doc.model),plain,'the model is untouched');
 const filled={...nothing,owner:'o2',look:'flaming-sword',layers:flames(frame)};
 compileAnimation(doc.model,0,filled);
 assert.ok(doc.model.Geosets[0]._FxStack);
 assert.ok(doc.model.ParticleEmitters2.length>0);
 compileAnimation(doc.model,0,{...filled,look:'empty',layers:[]});
 assert.equal(doc.model.Geosets[0]._FxStack,undefined,'the stack record goes');
 assert.equal(doc.model.ParticleEmitters2.length,0,'its emitters go');
 assert.equal(shape(doc.model),plain,'every owned resource goes');
 assert.equal(tagged(doc.model),0);
});
