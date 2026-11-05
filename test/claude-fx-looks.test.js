// Claude's kept looks compile with every layer switched on and survive MDX/MDL save.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {GLOBAL_LOOKS,LAYER_CHOICES,partFrame,newStack,makeLayer} from '../src/global-animation-looks.js';
import {CLAUDE_LOOKS,CLAUDE_EMITTERS} from '../src/claude-fx-looks.js';
import {compileAnimation,FX_SECTIONS} from '../src/global-animation-model.js';
const open=()=>openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx');

test('the kept looks are in the library and Storm cloud is an emitter choice',()=>{
 assert.deepEqual(CLAUDE_LOOKS.map(l=>l.name),['Fel blade','Tidal blade','Magma flow','Wraith form','Corrupted veins','Blood pact','Plague swarm','Runic plate','Void-cracked plate','Forge-hot plate']);
 for(const look of CLAUDE_LOOKS)assert.ok(GLOBAL_LOOKS.includes(look),look.name);
 for(const spec of CLAUDE_EMITTERS)assert.ok(LAYER_CHOICES.includes(spec),spec.label);
 const byId=id=>CLAUDE_LOOKS.find(l=>l.id===id);
 assert.equal(byId('claude-fel-blade').layers.find(l=>l.type==='Edge').enabled,false,'Fel edge starts off');
 assert.equal(byId('claude-magma-flow').asOverlay,true,'Magma flow starts as an overlay');
 assert.ok(!byId('claude-magma-flow').layers.some(l=>l.type==='Particles'),'Magma flow has no rising embers');
 assert.ok(byId('claude-plague-swarm').layers.every(l=>l.kind==='native'),'Plague swarm has no flies');
});
for(const look of CLAUDE_LOOKS)test(look.name+' compiles and saves',()=>{
 const doc=open(),m=doc.model,frame=partFrame(m.Geosets[0]);
 const stack=newStack(look,frame,'claude-'+look.id);
 // Also switch on each own emitter, as the recommended Add emitter choice does.
 let id=Math.max(0,...stack.layers.map(l=>l.id));
 for(const spec of look.layers.filter(l=>l.type==='Particles'&&!stack.layers.some(s=>s.label===l.label)))stack.layers.push(makeLayer(spec,frame,look.palette,++id));
 doc.apply('FX',FX_SECTIONS,mm=>compileAnimation(mm,0,stack));
 assert.ok(m.Geosets.some(g=>g._FxTag)||m.ParticleEmitters2.some(n=>n._FxTag));
 for(const format of ['mdx','mdl'])assert.equal(openDocument(doc.serialize(format),'x.'+format).model.Geosets.length,m.Geosets.length,format);
});
