import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {sampleNodeMatrices,geosetSkinMatrix} from '../../src/animation.js';
import {createRequire} from 'node:module';
import {openDocument} from '../../src/editor-document.js';
import {GLOBAL_LOOKS,LAYER_CHOICES,findLook,newStack,makeLayer,partFrame,layerIngredient} from '../../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,impactDefaults,FX_SECTIONS} from '../../src/global-animation-model.js';
const {fixturePath}=createRequire(import.meta.url)('./fixtures.cjs'),file=fixturePath('footman'),options={skip:!fs.existsSync(file)&&'private Footman missing'};
const particleSpecs=look=>(look.variations?look.variations.flatMap(v=>v.layers):look.layers).filter((spec,i,all)=>spec.type==='Particles'&&spec.kind!=='flies'&&!spec.swarm&&!spec.stamp&&all.findIndex(other=>JSON.stringify(other)===JSON.stringify(spec))===i);
const nativeChoices={id:'empty',name:'Added emitter',palette:'native',layers:LAYER_CHOICES.filter(s=>s.type==='Particles'&&!GLOBAL_LOOKS.some(l=>particleSpecs(l).some(p=>p.label===s.label&&p.kind===s.kind)))};
// Split across fx-emitter-persistence.test.js and fx-emitter-persistence-2..4.test.js so each file stays under the
// suite's 5-minute per-file limit; together the files cover every look, as one file did before.
export function shardTests(shard,shards){
for(const look of [...GLOBAL_LOOKS,nativeChoices].filter((_,i)=>i%shards===shard))for(const [ordinal,spec] of particleSpecs(look).entries())test(look.name+' / '+spec.label+' '+ordinal+' individual edits persist through MDX and MDL re-edit',options,()=>{
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
}
