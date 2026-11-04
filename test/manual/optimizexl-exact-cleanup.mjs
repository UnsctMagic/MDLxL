// Private study replay: fixtures stay outside Git. Source hashes pin the inputs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {ModelRenderer} from 'war3-model';
import {Matrix4} from 'three';
import {openDocument} from '../../src/editor-document.js';
import {visitTracks,compileTrackSampler,TRANSFORM_DEFAULTS,skinGeoset,sampleGeosetAnimation} from '../../src/animation.js';
import {sanityProposals,runOptimizeStage} from '../../src/optimizexl.js';
const {fixturePath}=createRequire(import.meta.url)('../helpers/fixtures.cjs');
const hashes={unit:'af7eeda00e1857e888daacf20d8015ec5c4b086ae215a8b373051f7435ef2d1d',hero:'6228e88764052fd91051ae6e096be63d245bd6cea0a40cca09c0de47ce572a0e'};
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
const at=(m,path)=>path.reduce((x,k)=>x?.[k],m),array=x=>typeof x==='number'?[x]:Array.from(x);
const corner=(g,i)=>json([Array.from(g.Vertices.slice(i*3,i*3+3)),Array.from(g.Normals.slice(i*3,i*3+3)),g.TVertices.map(t=>Array.from(t.slice(i*2,i*2+2))),g.Groups[g.VertexGroup[i]]]);
const output=[];
for(const kind of ['unit','hero']){
 const file=fixturePath('optimizexl-exact-'+kind),bytes=new Uint8Array(fs.readFileSync(file));assert.equal(sha(bytes),hashes[kind]);
 const before=openDocument(bytes,'before.mdx').model,fix=sanityProposals(before).find(f=>f.kind==='exactCleanup');assert.ok(fix);
 const result=runOptimizeStage(bytes,'sanity',{},fix),after=openDocument(result.bytes,'after.mdx').model;
 assert.ok(result.saved>=8000,'the study must produce a useful exact saving');assert.equal(after.Geosets[4].Faces.length/3,47);assert.equal(after.Geosets[4].Vertices.length/3,86);
 assert.equal(sanityProposals(after).some(f=>f.kind==='exactCleanup'),false,'one pass resolves the offered plan');
 for(const field of ['Sequences','Materials','Textures','TextureAnims','GlobalSequences','PivotPoints','EventObjects','CollisionShapes','Cameras'])assert.deepEqual(after[field],before[field],field+' stays authored');
 for(const collection of ['Bones','Helpers','Attachments','RibbonEmitters'])assert.deepEqual(after[collection].map(n=>[n.Name,n.ObjectId,n.Parent,n.Flags,n.PivotPoint]),before[collection].map(n=>[n.Name,n.ObjectId,n.Parent,n.Flags,n.PivotPoint]),'rig identity');
 let checks=0,changedTracks=0;
 visitTracks(before,(track,{path,property})=>{
  const changed=at(after,path);if(json(track)===json(changed))return;changedTracks++;
  const fallback=TRANSFORM_DEFAULTS[property]??(property==='Color'?[1,1,1]:1);
  for(const s of before.Sequences){
   const opts={interval:s.Interval,globalSequences:before.GlobalSequences,quaternion:property==='Rotation',fallback},a=compileTrackSampler(track,opts),b=compileTrackSampler(changed,opts);
   for(let frame=s.Interval[0];frame<=s.Interval[1];frame++){assert.deepEqual(array(b(frame)),array(a(frame)),path.join('.')+' at '+frame);checks++;}
  }
 },{skip:['Nodes','_MdxDefaults']});
 for(let i=0;i<before.Geosets.length;i++)assert.deepEqual(sampleGeosetAnimation(after,i,0,-1),sampleGeosetAnimation(before,i,0,-1),'Unanimated tint '+(i+1));
 const mapping=before.Geosets.map((g,i)=>{const original=new Map(Array.from({length:g.Vertices.length/3},(_,v)=>[corner(g,v),v]));return Array.from({length:after.Geosets[i].Vertices.length/3},(_,v)=>{const from=original.get(corner(after.Geosets[i],v));assert.notEqual(from,undefined);return from;});});
 for(let i=0;i<before.Geosets.length;i++){
  const a=before.Geosets[i],b=after.Geosets[i],drop=new Set(fix.geosets.find(g=>g.index===i)?.faces||[]);
  assert.deepEqual(Array.from(b.Faces,v=>corner(b,v)),Array.from(a.Faces).filter((_,j)=>!drop.has(Math.floor(j/3))).map(v=>corner(a,v)),'ordered surviving triangles');
  assert.deepEqual(b.Anims,a.Anims);assert.deepEqual(b.MinimumExtent,a.MinimumExtent);assert.deepEqual(b.MaximumExtent,a.MaximumExtent);assert.equal(b.BoundsRadius,a.BoundsRadius);
 }
 const renderers=[before,after].map(m=>new ModelRenderer(structuredClone(m)));let poses=0,maxMotion=0;
 for(let si=0;si<before.Sequences.length;si++)for(let t=0;t<=8;t++){
  const [lo,hi]=before.Sequences[si].Interval,frame=lo+(hi-lo)*t/8;
  const matrices=renderers.map(r=>{r.setSequence(si);r.setFrame(frame);r.updateNode(r.rendererData.rootNode);return new Map(r.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));});
  for(let gi=0;gi<before.Geosets.length;gi++){
   const a=skinGeoset(before.Geosets[gi],matrices[0]),b=skinGeoset(after.Geosets[gi],matrices[1]);
   for(let v=0;v<mapping[gi].length;v++)for(let axis=0;axis<3;axis++)maxMotion=Math.max(maxMotion,Math.abs(a[mapping[gi][v]*3+axis]-b[v*3+axis]));
   assert.deepEqual(sampleGeosetAnimation(before,gi,frame,si),sampleGeosetAnimation(after,gi,frame,si));
  }poses++;
 }
 assert.equal(maxMotion,0,'native renderer poses remain exact');
 const world=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:0});assert.equal(world.saved,4684,'existing world-zero capacity stays identical');
 const combined=runOptimizeStage(result.bytes,'animation',{mode:'world',worldTolerance:0});assert.ok(combined.afterBytes<=result.afterBytes);
 const stale=sanityProposals(before).find(f=>f.kind==='exactCleanup');assert.throws(()=>runOptimizeStage(world.bytes,'sanity',{},stale),/changed/i);
 assert.deepEqual(new Uint8Array(fs.readFileSync(file)),bytes);
 output.push({kind,source:sha(bytes),before:bytes.length,after:result.bytes.length,saved:result.saved,changedTracks,trackTimeChecks:checks,nativePoses:poses,maxMotion,collapsedTriangles:12,originalWorldSaved:world.saved,combinedSaved:bytes.length-combined.bytes.length,sourceUnchanged:true});
}
console.log(JSON.stringify({passed:true,models:output},null,2));
