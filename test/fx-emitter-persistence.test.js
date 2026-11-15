import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {sampleNodeMatrices,geosetSkinMatrix} from '../src/animation.js';
import {createRequire} from 'node:module';
import {openDocument} from '../src/editor-document.js';
import {GLOBAL_LOOKS,LAYER_CHOICES,findLook,newStack,makeLayer,partFrame,layerIngredient} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,impactDefaults,FX_SECTIONS} from '../src/global-animation-model.js';
const {fixturePath}=createRequire(import.meta.url)('./helpers/fixtures.cjs'),file=fixturePath('footman'),options={skip:!fs.existsSync(file)&&'private Footman missing'};
const particleSpecs=look=>(look.variations?look.variations.flatMap(v=>v.layers):look.layers).filter((spec,i,all)=>spec.type==='Particles'&&spec.kind!=='flies'&&!spec.swarm&&!spec.stamp&&all.findIndex(other=>JSON.stringify(other)===JSON.stringify(spec))===i);
const nativeChoices={id:'empty',name:'Added emitter',palette:'native',layers:LAYER_CHOICES.filter(s=>s.type==='Particles'&&!GLOBAL_LOOKS.some(l=>particleSpecs(l).some(p=>p.label===s.label&&p.kind===s.kind)))};
for(const look of [...GLOBAL_LOOKS,nativeChoices])for(const [ordinal,spec] of particleSpecs(look).entries())test(look.name+' / '+spec.label+' '+ordinal+' individual edits persist through MDX and MDL re-edit',options,()=>{
 const doc=openDocument(fs.readFileSync(file),'footman.mdx'),frame=partFrame(doc.model.Geosets[0]),layer={...makeLayer(spec,frame,look.palette,1),enabled:true},stack={...newStack(findLook('empty'),frame,'persist'),look:look.id,layers:[layer]};
 if(look.impact)Object.assign(stack,{impact:true},impactDefaults(doc.model,0));
 const model=structuredClone(doc.model),graph=compileAnimation(model,0,stack),nodes=graph.layers[1].ids.map(id=>model.Nodes[id]),key=nodes[0]._FxTag.split('/').at(-1),deleted=nodes[1]?._FxTag.split('/').at(-1);
 layer.individuals={[key]:{position:[23,42,61],values:{tint:[1,0,0],native:{SegmentColor:[[1,0,0],[1,0,0],[1,0,0]],LifeSpan:.7,Time:.61,Width:7,Length:9}}},...(deleted?{[deleted]:{deleted:true}}:{})};
 doc.apply('Individual edits',FX_SECTIONS,m=>compileAnimation(m,0,stack));
 for(const format of ['mdx','mdl']){
  const opened=openDocument(doc.serialize(format),'placed.'+format),saved=readAnimationStack(opened.model,0);
  assert.equal(opened.readOnly,false);assert.deepEqual(saved.layers[0].individuals,layer.individuals,'individual data reopens exactly');
  const node=opened.model.ParticleEmitters2.find(n=>n._FxTag==='persist/1/'+key);assert.deepEqual(Array.from(node.PivotPoint),[23,42,61]);assert.ok(Math.abs(node.LifeSpan-.7)<1e-5);assert.ok(Math.abs(node.Time-.61)<1e-5);assert.equal(node.Width,7);assert.equal(node.Length,9);assert.deepEqual(Array.from(node.SegmentColor[1]),[1,0,0]);
  const before=opened.model.ParticleEmitters2.length;saved.loop+=101;opened.apply('Re-edit',FX_SECTIONS,m=>compileAnimation(m,0,saved));
  assert.equal(opened.model.ParticleEmitters2.length,before,'re-edit does not regrow deleted sites');assert.deepEqual(Array.from(opened.model.ParticleEmitters2.find(n=>n._FxTag==='persist/1/'+key).PivotPoint),[23,42,61]);
  if(deleted)assert.ok(!opened.model.ParticleEmitters2.some(n=>n._FxTag==='persist/1/'+deleted));
 }
});
for(const label of ['Blade flames','Fire column'])test(label+' subsequent EMTR values remain individual on FX reopen and re-edit',options,()=>{
 const doc=openDocument(fs.readFileSync(file),'footman.mdx'),frame=partFrame(doc.model.Geosets[0]),layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1),stack={...newStack(findLook('empty'),frame,'emtr-persist'),layers:[layer]};
 const first=structuredClone(doc.model),graph=compileAnimation(first,0,stack),key=first.Nodes[graph.layers[1].ids[0]]._FxTag.split('/').at(-1);
 layer.individuals={[key]:{position:[11,22,33],values:{native:{Width:7}}}};doc.apply('Place one',FX_SECTIONS,m=>compileAnimation(m,0,stack));
 doc.apply('EMTR width',['ParticleEmitters2'],m=>{m.ParticleEmitters2.find(n=>n._FxTag==='emtr-persist/1/'+key).Width=21;});
 const reopened=readAnimationStack(doc.model,0);assert.equal(reopened.layers[0].individuals[key].values.native.Width,21,'EMTR change returns to this individual');reopened.loop+=1;doc.apply('Re-edit',FX_SECTIONS,m=>compileAnimation(m,0,reopened));
 assert.equal(doc.model.ParticleEmitters2.find(n=>n._FxTag==='emtr-persist/1/'+key).Width,21);
});

for(const label of ['Blade flames','Fire column'])test(label+' surface attachment survives MDX and MDL node renumbering',options,()=>{
 const doc=openDocument(fs.readFileSync(file),'footman.mdx'),frame=partFrame(doc.model.Geosets[2]),geo=doc.model.Geosets[0],layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1),stack={...newStack(findLook('empty'),frame,'saved-snap'),layers:[layer]},first=structuredClone(doc.model),graph=compileAnimation(first,2,stack),key=first.Nodes[graph.layers[1].ids[0]]._FxTag.split('/').at(-1);
 const vertices=Array.from(geo.Faces.slice(0,3)),barycentric=[.2,.3,.5],position=[0,1,2].map(axis=>vertices.reduce((n,v,i)=>n+geo.Vertices[v*3+axis]*barycentric[i],0));
 layer.individuals={[key]:{position,surface:{geoset:0,vertices,barycentric}}};doc.apply('Snap',FX_SECTIONS,m=>compileAnimation(m,2,stack));
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'snapped.'+format),draft=readAnimationStack(reopened.model,2);assert.deepEqual(draft.layers[0].individuals,layer.individuals);
  draft.loop+=1;reopened.apply('Re-edit',FX_SECTIONS,m=>compileAnimation(m,2,draft));const model=reopened.model,emitter=model.ParticleEmitters2.find(n=>n._FxTag==='saved-snap/1/'+key);
  for(const [sequence,clip] of model.Sequences.entries())for(const frame of [clip.Interval[0],Math.round((clip.Interval[0]+clip.Interval[1])/2),clip.Interval[1]]){
   const matrices=sampleNodeMatrices(model,frame,sequence,frame),actual=new Vector3().fromArray(emitter.PivotPoint).applyMatrix4(matrices.get(emitter.ObjectId)),expected=new Vector3();vertices.forEach((v,i)=>expected.addScaledVector(new Vector3().fromArray(geo.Vertices,v*3).applyMatrix4(geosetSkinMatrix(model.Geosets[0],v,matrices)),barycentric[i]));assert.ok(actual.distanceTo(expected)<.04,format+' '+clip.Name+': attached point error '+actual.distanceTo(expected));
  }
 }
});

// Fire column is one source seated in the part now (14 November); a sibling needs a second site, so Orbiting stars stands in.
for(const label of ['Blade flames','Orbiting stars'])test(label+' EMTR edits to a sibling remain independent in a mixed layer',options,()=>{
 const doc=openDocument(fs.readFileSync(file),'footman.mdx'),frame=partFrame(doc.model.Geosets[0]),layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1),stack={...newStack(findLook('empty'),frame,'emtr-sibling'),layers:[layer]},first=structuredClone(doc.model),graph=compileAnimation(first,0,stack),keys=graph.layers[1].ids.slice(0,2).map(id=>first.Nodes[id]._FxTag.split('/').at(-1));
 layer.individuals={[keys[0]]:{position:[11,22,33],values:{native:{Width:7}}}};doc.apply('Place one',FX_SECTIONS,m=>compileAnimation(m,0,stack));
 doc.apply('EMTR sibling width',['ParticleEmitters2'],m=>{m.ParticleEmitters2.find(n=>n._FxTag==='emtr-sibling/1/'+keys[1]).Width=21;});
 const draft=readAnimationStack(doc.model,0);assert.equal(draft.layers[0].individuals[keys[1]]?.values.native.Width,21,'the other EMTR choice returns to its own site');assert.equal(draft.layers[0].individuals[keys[0]].values.native.Width,7,'the first individual is unchanged');draft.loop+=1;doc.apply('Re-edit',FX_SECTIONS,m=>compileAnimation(m,0,draft));assert.equal(doc.model.ParticleEmitters2.find(n=>n._FxTag==='emtr-sibling/1/'+keys[1]).Width,21);
});
