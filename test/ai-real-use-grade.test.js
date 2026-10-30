import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { snapshotModel, measureDrift, gradeWorkflow, transcriptUsage, componentTriangles, addedSurfaceComponents, duplicateGroups, gradeExample, gradeScenario, summarize, markdownReport } from './helpers/ai-real-use-grade.js';
const mesh = { vertices:[0,0,0, 1,0,0, 1,1,0, 0,1,0], faces:[0,1,2,0,2,3], uv:[[0,0,1,0,1,1,0,1]], normals:Array(4).fill([0,0,1]).flat(), groups:[0,0,0,0], bindings:[[0]],skin:[],material:0 };
const state = m => ({meshes:[structuredClone(m)],textures:[{path:'game.blp'}],materials:[{Layers:[{TextureID:0}]}]});
const base=state(mesh);
const split=()=>{
  const ids=mesh.faces, m={...structuredClone(mesh),vertices:ids.flatMap(i=>mesh.vertices.slice(i*3,i*3+3)),faces:[0,1,2,3,4,5],uv:[ids.flatMap(i=>mesh.uv[0].slice(i*2,i*2+2))],normals:ids.flatMap(i=>mesh.normals.slice(i*3,i*3+3)),groups:ids.map(()=>0)};return state(m);
};
test('workflow distinguishes final completion, resumes, stopping and a false stale refusal',()=>{
 const r=gradeWorkflow({task:{status:'incomplete'},turns:[{resume:true},{resume:true}],transcript:[{role:'user',text:'Do not say Stopped.'},{role:'assistant',text:'Stopped. The model or selection changed since this prompt.'}]});
 assert.equal(r.resumes,2);assert.equal(r.resumeLoop,true);assert.equal(r.stoppedCutoff,true);assert.equal(r.falseStaleRefusal,true);assert.equal(r.reachedFinal,false);
 assert.equal(gradeWorkflow({task:{status:'complete'},transcript:[],turns:[]}).score,100);
 assert.equal(gradeWorkflow({externalChanges:1,transcript:[{role:'assistant',error:'model or selection changed'}]}).falseStaleRefusal,false);
 assert.equal(gradeWorkflow({transcript:[{role:'assistant',parts:[{type:'tool',status:'error',summary:'The model or selection changed since this prompt.'}]}]}).falseStaleRefusal,true);
 assert.equal(gradeWorkflow({task:{status:'complete'},turns:[{timedOut:true}]}).reachedFinal,false);
 assert.equal(gradeWorkflow({transcript:[{role:'assistant',parts:[{type:'tool',status:'done',summary:'Source code: model or selection changed'}]}]}).falseStaleRefusal,false);
 const cancelled=gradeWorkflow({transcript:[{role:'assistant',text:'Stopped.'}],turns:[{timedOut:true}]});assert.equal(cancelled.stoppedCutoff,false);assert.equal(cancelled.harnessStoppedCutoff,true);
 assert.equal(gradeWorkflow({transcript:[{role:'assistant',text:'Stopped.'}],turns:[{timedOut:true,stoppedBeforeCancel:true}]}).stoppedCutoff,true);
});
test('surface and UV grading tolerates reindexing, duplicated corners and coplanar retriangulation',()=>{
 for(const s of [structuredClone(base),split(),state({...mesh,faces:[0,1,3,1,2,3]})]){
  const d=measureDrift(base,s);assert.equal(d.boundsDelta,0);assert.ok(d.surfaceMax<1e-8);assert.ok(d.uvMax<1e-8);assert.equal(d.uvUnmatchedSamples,0);assert.equal(d.silhouetteMean,1);
 }
});
test('drift catches silhouette, geometry, texture, material and same-geometry UV changes',()=>{
 const changed=structuredClone(base);changed.meshes[0].vertices[0]-=.4;changed.meshes[0].uv[0][0]+=.2;changed.textures[0].path='other.blp';changed.materials[0].Layers[0].TextureID=1;
 const d=measureDrift(base,changed);assert.ok(d.boundsDelta>.39);assert.ok(d.surfaceMax>.1);assert.ok(d.silhouetteMean<1);assert.ok(d.uvMax>.1);assert.equal(d.texturePathsChanged,true);assert.equal(d.materialsChanged,true);
 const uvOnly=structuredClone(base);uvOnly.meshes[0].uv[0][0]=.5;assert.ok(measureDrift(base,uvOnly).surfaceMax<1e-8);assert.equal(measureDrift(base,uvOnly).uvMax,.5);
 const noLayer=structuredClone(base);noLayer.meshes[0].uv=[];assert.ok(measureDrift(base,noLayer).uvUnmatchedSamples>0);
});
test('example coverage rewards the demonstration pattern across all eligible points, not deletion',()=>{
 const before=split();assert.equal(duplicateGroups(before.meshes[0]).length,2);
 const unchanged=gradeExample(before,before);assert.equal(unchanged.coverage,0);
 const kept=[0,1,2,4,5],source=before.meshes[0];
 const partial=state({...source,vertices:kept.flatMap(i=>source.vertices.slice(i*3,i*3+3)),uv:[kept.flatMap(i=>source.uv[0].slice(i*2,i*2+2))],normals:kept.flatMap(i=>source.normals.slice(i*3,i*3+3)),groups:kept.map(()=>0),faces:[0,1,2,0,3,4]});
 assert.equal(gradeExample(before,partial).coverage,.5);
 const welded=gradeExample(before,base);assert.equal(welded.coverage,1);assert.equal(welded.patternSimilarity,1);
 const destroyed=structuredClone(base);destroyed.meshes[0].vertices[0]=.5;assert.equal(gradeExample(before,destroyed).patternSimilarity,0);
 const deleted={...structuredClone(base),meshes:[]};assert.equal(gradeExample(before,deleted).patternSimilarity,0);
 const seam=split();seam.meshes[0].uv[0][6]=.25;assert.equal(duplicateGroups(seam.meshes[0]).length,1);
});
test('triangle target measures each connected stud rather than accepting a pooled total',()=>{
 const m={...mesh,vertices:[...mesh.vertices,...mesh.vertices.map(n=>n+3)],faces:[0,1,2,0,2,3,4,5,6,4,6,7]};
 assert.deepEqual(componentTriangles(m),[2,2]);
 const r=gradeScenario({scenario:{id:'studs',kind:'reduce',meshIndex:0,trianglesPerStud:2},before:state(m),after:state(m),task:{status:'complete'}});
 assert.equal(r.objectiveScore,100);assert.equal(r.triangle.after,4);
 assert.equal(gradeScenario({scenario:{id:'studs',kind:'reduce',meshIndex:0,trianglesPerStud:4},before:state(m),after:state(m)}).objectiveScore,50);
});
test('physical components survive normal/UV corner splits and studs connected to a band are detected',()=>{
 assert.deepEqual(componentTriangles(split().meshes[0]),[2]);
 const joined=state({...mesh,vertices:[...mesh.vertices,.5,.4,.3],faces:[...mesh.faces,0,1,4,1,2,4,2,0,4]});
 assert.deepEqual(componentTriangles(joined.meshes[0]),[5]);assert.deepEqual(addedSurfaceComponents(base,joined),[3]);
 assert.equal(gradeScenario({scenario:{id:'stud',kind:'studs',addStuds:1},before:base,after:joined}).objectiveScore,100);
 assert.equal(gradeScenario({scenario:{id:'stud',kind:'studs',addStuds:1},before:base,after:base}).objectiveScore,0);
});
test('band thickness requires width/depth growth rather than translating the band',()=>{
 const moved=structuredClone(base);moved.meshes[0].vertices=moved.meshes[0].vertices.map((n,i)=>n+(i%3===0?2:0));
 const scenario={id:'band',kind:'thicken',meshIndex:0};assert.equal(gradeScenario({scenario,before:base,after:moved}).objectiveScore,0);
 const thick=structuredClone(base);thick.meshes[0].vertices=thick.meshes[0].vertices.map((n,i)=>i%3<2?(n-.5)*2+.5:n);assert.equal(gradeScenario({scenario,before:base,after:thick}).objectiveScore,100);
});
test('a completed no-op is not a successful simplification',()=>{
 const r=gradeScenario({scenario:{id:'simplify',kind:'simplify',keepLook:true},before:base,after:base,task:{status:'complete'}});assert.equal(r.workflow.score,100);assert.equal(r.objectiveScore,0);
});
test('usage uses cumulative cost once per saved reply and preserves unknown prices',()=>{
 const r=transcriptUsage([{role:'assistant',cost:{tokens:100,usd:null,roles:{'outside check':{calls:2}}},parts:[{type:'worker',cost:{tokens:100}}]},{role:'assistant',cost:{tokens:50,usd:null}}]);assert.equal(r.tokens,150);assert.equal(r.usd,null);assert.equal(r.outsideCheckCalls,2);
 assert.equal(transcriptUsage([]).tokens,null);assert.equal(transcriptUsage([{role:'assistant',cost:{tokens:0,usd:0}}]).usd,0);
});
test('repeat summary gives distributions and rates without a pass/fail verdict',()=>{
 const one=gradeScenario({scenario:{id:'a',kind:'simplify'},before:base,after:base,task:{status:'complete'},seconds:10});
 const two=structuredClone(one);two.seconds=30;two.workflow.reachedFinal=false;two.workflow.resumeLoop=true;two.workflow.resumes=2;
 const s=summarize([one,two])[0];assert.deepEqual(s.seconds,{n:2,mean:20,min:10,max:30});assert.equal(s.completionRate,.5);assert.equal(s.resumeLoopRate,.5);assert.equal(s.tokens.n,0);
 const md=markdownReport({mode:'dry-run',model:'stand-in',repeats:2,commit:'abc',summary:[s],runs:[one,two]});assert.match(md,/50%/);assert.match(md,/not applicable \(stand-in\)/);assert.match(md,/unknown/);assert.doesNotMatch(JSON.stringify(s),/passed|verdict/);
});
test('snapshot converts typed/wire arrays and all six scenario prompts remain specific',()=>{
 const s=snapshotModel({Geosets:[{Vertices:new Float32Array(mesh.vertices),Faces:{$data:mesh.faces},TVertices:[new Float32Array(mesh.uv[0])]}]});assert.deepEqual(s.meshes[0].vertices,mesh.vertices);assert.deepEqual(s.meshes[0].faces,mesh.faces);
 const scenarios=JSON.parse(fs.readFileSync(new URL('./fixtures/ai-real-use/scenarios.json',import.meta.url)));assert.equal(scenarios.length,6);assert.equal(scenarios.filter(s=>s.image).length,1);assert.equal(scenarios.filter(s=>s.demo).length,2);
});
