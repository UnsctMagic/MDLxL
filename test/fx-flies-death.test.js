import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
import {unitHeight} from '../src/fx-layer-basis.js';
import {sampleTrack,sampleNodeMatrices} from '../src/animation.js';
import {Vector3} from 'three';
const bytes=fs.readFileSync(new URL('../test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
for(const short of [false,true])test('Fly swarm rises and hides on '+(short?'short':'normal')+' Death, with saved opt-in',()=>{
 const doc=openDocument(bytes,'knight.mdx'),m=doc.model,death=m.Sequences.find(s=>/^death\b/i.test(s.Name));assert.ok(death);
 if(short)death.Interval[1]=death.Interval[0]+900;
 const frame=partFrame(m.Geosets[37]),height=unitHeight(m);frame.unitHeight=height;
 const stack=newStack(findLook('fly-swarm'),frame,'death');assert.ok(!stack.layers[0].riseOnDeath,'off by default');
 compileAnimation(m,37,stack);
 const originalParent=m.Bones.find(b=>b._FxTag==='death/1/swarm').Parent;
 const anchors=new Map(),sequence=m.Sequences.indexOf(death),[deathStart,deathEnd]=death.Interval,clockScale=Math.min(1,(deathEnd-deathStart)/2170);
 for(const time of [1000,2170]){const frameAt=deathStart+Math.round(time*clockScale),matrix=sampleNodeMatrices(m,frameAt,sequence,frameAt).get(originalParent),at=frame.center.clone();if(matrix)at.applyMatrix4(matrix);anchors.set(time,at);}
 stack.layers[0].riseOnDeath=true;compileAnimation(m,37,stack);
 const helper=m.Bones.find(b=>b._FxTag==='death/1/swarm'),material=m.Materials.find(a=>a._FxTag==='death/1/material'),[start,end]=death.Interval,scale=Math.min(1,(end-start)/2170);
 assert.ok(helper.Translation,'the swarm helper has Death motion');
 assert.equal(helper.Parent,null,'rise is in model space, never turned downward by a falling parent');
 for(const [time,rise] of [[1000,.6],[2170,2.5]]){const at=new Vector3(...sampleTrack(helper.Translation,start+Math.round(time*scale),{interval:death.Interval,globalSequences:m.GlobalSequences,fallback:[0,0,0]})).add(frame.center),expected=anchors.get(time).clone();expected.z+=height*rise;assert.ok(at.distanceTo(expected)<.1,'world-space rise at scaled '+time+' ms');}
 const visible=t=>sampleTrack(material.Layers[0].Alpha,start+Math.round(t*scale),{interval:death.Interval,globalSequences:m.GlobalSequences,fallback:1});
 assert.equal(visible(1800),1);assert.equal(visible(1900),0);assert.equal(visible(2170),0);
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'flies.'+format),saved=readAnimationStack(reopened.model,37);assert.equal(saved.layers[0].riseOnDeath,true);
  compileAnimation(reopened.model,37,saved);assert.ok(reopened.model.Bones.find(b=>b._FxTag==='death/1/swarm').Translation);
 }
 stack.layers[0].riseOnDeath=false;compileAnimation(m,37,stack);assert.equal(m.Bones.find(b=>b._FxTag==='death/1/swarm').Translation,undefined);assert.equal(m.Materials.find(a=>a._FxTag==='death/1/material').Layers[0].Alpha,1);
});
