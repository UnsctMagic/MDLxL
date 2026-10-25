import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sdChaptersForPrompt,SD_PART_TARGETS} from '../src/sd-knowledge.js';
import {searchNativeTextures,nativeTexture,nativeTextureCatalogue} from '../src/sd-native-textures.js';
import {partKind,roundPartSides,measureModelParts} from '../src/sd-model-metrics.js';
import {mapNativeRegion} from '../src/sd-native-uv.js';
import {inspectSdModel} from '../src/sd-review.js';
import {aiAssets} from '../app/ai-assets.js';
const tube = (sides=4) => {
 const vertices=[],faces=[];for(const z of [0,20])for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;vertices.push(2*Math.cos(a),2*Math.sin(a),z);}
 for(let i=0;i<sides;i++){const j=(i+1)%sides;faces.push(i,j,sides+j,i,sides+j,sides+i);}
 return {Vertices:new Float32Array(vertices),Normals:new Float32Array(vertices.length),Faces:new Uint16Array(faces),VertexGroup:new Uint8Array(vertices.length/3),Groups:[[0]],TVertices:[new Float32Array(vertices.length/3*2)],MaterialID:0};
};
const modelFor=g=>({Geosets:[g],GeosetAnims:[],Bones:[{ObjectId:0,Name:'Bone_Handle'}],Helpers:[],Sequences:[],Materials:[{Layers:[{TextureID:0}]}],Textures:[{Image:'textures/footman.dds'}]});
test('casual requests select their construction chapters and preserve technical edit scope',()=>{
 for(const [prompt,id]of [['make a sword','human-swords'],['make an orc axe','orc-weapons'],['make an elven glaive','elven-weapons'],['make a skull','skulls-bones'],['make a footman-style knight','bodies'],['uv map this properly','uv']]) {
  const chapters=sdChaptersForPrompt(prompt);assert.ok(chapters.some(c=>c.id===id));assert.ok(chapters.length<12);
  for(const c of chapters)assert.ok(fs.existsSync(c.topic));
 }
 const edit=sdChaptersForPrompt('make this armour cooler',{existing:true});assert.ok(edit.some(c=>c.id==='edits'));assert.ok(edit.some(c=>c.id==='armour'));
});
test('native meaning search returns checked paths and normalized material rectangles, not geometry',async()=>{
 const a=await searchNativeTextures({query:'orc axe blade',checkedOnly:true,limit:3});assert.ok(a.items.some(t=>t.path==='textures/grunt.dds'));
 const e=await searchNativeTextures({query:'elven purple cloth',checkedOnly:true,limit:5});assert.ok(e.items.some(t=>t.regions.some(r=>r.tags.includes('purple'))));
 assert.ok(a.items.every(t=>t.checkedByEye&&!('pixels'in t)&&!('vertices'in t)));
 for(const t of [...a.items,...e.items])for(const r of t.regions){assert.ok(r.checkedByEye);assert.ok(r.rect.length===4&&r.rect.every(v=>v>=0&&v<=1));assert.ok(r.rect[2]>r.rect[0]&&r.rect[3]>r.rect[1]);}
 await assert.rejects(searchNativeTextures({limit:101}),/1–100/);
 const catalogue=await nativeTextureCatalogue(),variant=catalogue.entries.find(t=>t.sourcePath.split(':').length>2);assert.ok(variant);assert.equal((await nativeTexture(variant.sourcePath)).sourcePath,variant.sourcePath);
 assert.equal(await nativeTexture('war3.w3mod:_missing.w3mod:textures/footman.dds'),null);
 assert.equal(await nativeTexture('unknown.dds'),null);
});
test('roundness counts real polygon rings and leaves flat surfaces unclassified',()=>{
 for(const sides of [4,5,16]){const g=tube(sides),points=Array.from({length:g.Vertices.length/3},(_,i)=>Array.from(g.Vertices.subarray(i*3,i*3+3)));assert.equal(roundPartSides(points)?.sides,sides);}
 const seam=tube(5);const basePoints=Array.from({length:seam.Vertices.length/3},(_,i)=>Array.from(seam.Vertices.subarray(i*3,i*3+3)));assert.equal(roundPartSides([...basePoints,...basePoints.slice(0,3),...basePoints.slice(0,2)])?.sides,5);
 assert.equal(roundPartSides([[0,0,0],[1,0,0],[1,0,10],[0,0,10]]),null);
 assert.equal(partKind('PoolSurface'),null);assert.equal(partKind('CityGuardCaptain_rig:polySurface'),null);assert.equal(partKind('Bone_Head02'),'head');
 const m=modelFor(tube());const snapshot=structuredClone(m);assert.equal(measureModelParts(m)[0].kind,'shaft');assert.deepEqual(m,snapshot);
});
test('SD review flags new excess, preserves unchanged authored density and accepts explicit part measurements',()=>{
 const m=modelFor(tube(16)),snapshot=structuredClone(m);const result=inspectSdModel(m);
 assert.ok(result.warnings.some(w=>w.kind==='too round'));assert.ok(result.warnings.some(w=>w.kind==='too dense'));
 assert.equal(inspectSdModel(m,{before:snapshot}).warnings.length,0);
 const explicit=inspectSdModel(m,{parts:[{kind:'shaft',geosetId:0,faces:[0,1],label:'grip patch'}]});assert.ok(explicit.parts.some(p=>p.label==='grip patch'&&p.triangles===2));
 assert.throws(()=>inspectSdModel(m,{parts:[{kind:'shaft',geosetId:0,faces:[999]}]}),/valid triangle/);
 assert.deepEqual(m,snapshot);
});
test('native UV mapping splits only shared selected corners and preserves other streams and material',async()=>{
 const g={Vertices:new Float32Array([0,0,0,1,0,0,1,0,1,0,0,1]),Normals:new Float32Array([0,-1,0,0,-1,0,0,-1,0,0,-1,0]),Faces:new Uint16Array([0,1,2,0,2,3]),TVertices:[new Float32Array([0,1,1,1,1,0,0,0]),new Float32Array([.1,.2,.3,.4,.5,.6,.7,.8])],VertexGroup:new Uint8Array([0,1,1,0]),Groups:[[0],[1]],SkinWeights:new Uint8Array(32).fill(2),Tangents:new Float32Array(16).fill(.5),MaterialID:0};
 const m=modelFor(g),before=structuredClone(m),region=(await nativeTexture('textures/footman.dds')).regions.find(r=>r.name==='plate-steel');
 const r=await mapNativeRegion(m,{geosetId:0,faces:[0],texturePath:'textures/footman.dds',region:'plate-steel',projection:'planar',axes:'xz'});
 assert.equal(r.splitVertices,2);assert.deepEqual(Array.from(g.Faces.subarray(3)),[0,2,3]);assert.equal(g.Vertices.length,18);
 for(const id of [0,2,3])assert.deepEqual(Array.from(g.TVertices[0].subarray(id*2,id*2+2)),Array.from(before.Geosets[0].TVertices[0].subarray(id*2,id*2+2)));
 for(const [newId,oldId]of [[4,0],[5,2]]){assert.deepEqual(Array.from(g.Normals.subarray(newId*3,newId*3+3)),Array.from(before.Geosets[0].Normals.subarray(oldId*3,oldId*3+3)));assert.deepEqual(Array.from(g.TVertices[1].subarray(newId*2,newId*2+2)),Array.from(before.Geosets[0].TVertices[1].subarray(oldId*2,oldId*2+2)));assert.equal(g.SkinWeights[newId*8],2);}
 for(const id of g.Faces.subarray(0,3)){assert.ok(g.TVertices[0][id*2]>region.rect[0]&&g.TVertices[0][id*2]<region.rect[2]);assert.ok(g.TVertices[0][id*2+1]>region.rect[1]&&g.TVertices[0][id*2+1]<region.rect[3]);}
 assert.ok(g.TVertices[0][g.Faces[2]*2+1]<g.TVertices[0][g.Faces[0]*2+1],'higher Z maps to top of sheet');
 const wrongSet=structuredClone(before);wrongSet.Materials[0].Layers[0].CoordId=1;const saved=structuredClone(wrongSet);await assert.rejects(mapNativeRegion(wrongSet,{geosetId:0,faces:[0],texturePath:'textures/footman.dds',region:'plate-steel'}),/UV set used/);assert.deepEqual(wrongSet,saved);
 assert.deepEqual(m.Materials,before.Materials);assert.deepEqual(m.Textures,before.Textures);
 const bad=structuredClone(before);await assert.rejects(mapNativeRegion(bad,{geosetId:0,faces:[0],texturePath:'textures/grunt.dds',region:'axe-steel'}),/Assign this native sheet/);assert.deepEqual(bad,before);
});
test('native asset preview uses the existing resolver and honors cancellation',async()=>{
 let resolved;const state={model:{},session:{path:'D:/model.mdx'}},host={state:()=>state};
 await assert.rejects(aiAssets({source:'native',action:'preview',path:'textures/footman.dds'},host,()=>{throw Error('cancelled');},{resolveTextures:async args=>(resolved=args,[])}),/cancelled/);
 assert.deepEqual(resolved.names,['textures/footman.dds']);
 const search=await aiAssets({source:'native',query:'orc axe',checkedOnly:true},host,()=>{},{});assert.ok(search.total>0);
});
