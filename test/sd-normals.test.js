import test from 'node:test';
import assert from 'node:assert/strict';
import { captureNormalSelection, previewNormals, applyNormalPreview } from '../src/normalizer.js';
const at=(a,id)=>Array.from(a.subarray(id*3,id*3+3));
const close=(actual,expected)=>assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<1e-6),JSON.stringify({actual,expected}));
const normal=degrees=>[0,Math.sin(degrees*Math.PI/180),Math.cos(degrees*Math.PI/180)];
function join(angle=30,sharedNormals=true) {
  const b=normal(angle),mean=normal(angle/2);
  const make=(positions,n)=>({Vertices:Float32Array.from(positions),Normals:Float32Array.from([...n,...n,...n]),Faces:Uint16Array.of(0,1,2),VertexGroup:Uint8Array.of(0,0,0),Groups:[[4]],TVertices:[new Float32Array(6)]});
  const g=make([0,0,0, 1,0,0, 0,1,0],[0,0,1]),h=make([1,0,0, 0,0,0, 0,-b[2],b[1]],b);
  if(sharedNormals)for(const mesh of [g,h])for(const id of [0,1])mesh.Normals.set(mean,id*3);
  return {Geosets:[g,h]};
}
const all=m=>Object.fromEntries(m.Geosets.map((g,i)=>[i,Array.from({length:g.Vertices.length/3},(_,id)=>id)]));
const preview=(m,settings={})=>previewNormals(captureNormalSelection(m,all(m)),{mode:'sd',...settings});

test('SD rebuilding uses equal face weights instead of triangle size',()=>{
  const m={Geosets:[{Vertices:Float32Array.of(0,0,0, 2,0,0, 0,2,0, 0,0,1),Normals:new Float32Array(12),Faces:Uint16Array.of(0,1,2, 0,3,1)}]};
  const s=captureNormalSelection(m,{0:[0]});
  close(at(previewNormals(s,{mode:'sd'}).geosets[0].normals,0),[0,Math.SQRT1_2,Math.SQRT1_2]);
  close(at(previewNormals(s,{mode:'surface'}).geosets[0].normals,0),[0,2/Math.sqrt(20),4/Math.sqrt(20)]);
});
test('matching SD smooth joins rebuild together without welding geometry, UVs or binding',()=>{
  const m=join(),before=structuredClone(m),p=preview(m);assert.equal(p.joinedVertices,4);
  for(const g of p.geosets)for(const id of [0,1])close(at(g.normals,id),normal(15));
  applyNormalPreview(m,p);
  for(let i=0;i<m.Geosets.length;i++)for(const key of ['Vertices','Faces','TVertices','Groups','VertexGroup'])assert.deepEqual(m.Geosets[i][key],before.Geosets[i][key]);
});
test('SD rebuilding keeps an authored sharp split even on a shallow corner',()=>{
  const m=join(30,false),p=preview(m);assert.equal(p.joinedVertices,0);
  close(at(p.geosets[0].normals,0),normal(0));close(at(p.geosets[1].normals,0),normal(30));
});
test('Fix seams changes only the join and retains unrelated authored normals exactly',()=>{
  const m=join(30,false);m.Geosets[0].Normals.set([1,0,0],6);
  const p=preview(m,{mode:'seams'});assert.equal(p.joinedVertices,4);
  for(const g of p.geosets)for(const id of [0,1])close(at(g.normals,id),normal(15));
  assert.deepEqual(p.geosets[0].normals.subarray(6),m.Geosets[0].Normals.subarray(6));
});
test('seam and softening angle controls protect hard corners',()=>{
  const m=join(90,false);
  assert.equal(preview(m,{mode:'seams',creaseAngle:60}).changed,0);
  const softened=preview(m,{mode:'smooth',creaseAngle:120});
  assert.equal(softened.joinedVertices,4);
  for(const g of softened.geosets)for(const id of [0,1])close(at(g.normals,id),normal(45));
  assert.equal(preview(m,{mode:'smooth',creaseAngle:30}).joinedVertices,0);
});
test('matching position and edge are insufficient when bone bindings differ',()=>{
  const m=join(30,false);m.Geosets[1].Groups=[[9]];
  assert.equal(preview(m,{mode:'seams'}).joinedVertices,0);
  assert.equal(preview(m,{mode:'smooth'}).joinedVertices,0);
});
test('the same effective bone group matches even if its bone order differs',()=>{
  const m=join(30,false);m.Geosets[0].Groups=[[4,9]];m.Geosets[1].Groups=[[9,4]];
  assert.equal(preview(m,{mode:'seams'}).joinedVertices,4);
});
test('nearby vertices are not treated as the same join',()=>{
  const m=join(30,false);for(let i=0;i<m.Geosets[1].Vertices.length;i+=3)m.Geosets[1].Vertices[i]+=.001;
  assert.equal(preview(m,{mode:'smooth',creaseAngle:120}).joinedVertices,0);
});
test('touching at one point cannot stitch separate objects',()=>{
  const m=join(30,false);m.Geosets[1].Vertices.set([3,0,0],0);
  assert.equal(preview(m,{mode:'seams'}).joinedVertices,0);
});
test('opposite sheets and coincident copies do not average or cancel each other',()=>{
  for(const reverse of [false,true]){
    const m=join();m.Geosets[1]=structuredClone(m.Geosets[0]);if(reverse)m.Geosets[1].Faces=Uint16Array.of(2,1,0);
    const p=preview(m,{mode:'smooth',creaseAngle:180});assert.equal(p.joinedVertices,0);assert.equal(p.unresolved,0);
  }
});
test('partial selections use neighbouring context while every unselected normal remains exact',()=>{
  const m=join(),before=structuredClone(m);
  m.Geosets[0].Normals.set(normal(5),0);m.Geosets[1].Normals.set(normal(25),3);
  const unselected=structuredClone(m),s=captureNormalSelection(m,{0:[0],1:[2]});
  const p=previewNormals(s,{mode:'seams'});applyNormalPreview(m,p);
  close(at(m.Geosets[0].Normals,0),normal(15));
  assert.deepEqual(m.Geosets[0].Normals.subarray(3),unselected.Geosets[0].Normals.subarray(3));
  assert.deepEqual(m.Geosets[1].Normals,unselected.Geosets[1].Normals);
  assert.deepEqual(m.Geosets[0].Vertices,before.Geosets[0].Vertices);
});
test('changing methods, angles and strength always previews from the opening snapshot',()=>{
  const m=join(90,false),before=structuredClone(m),s=captureNormalSelection(m,all(m));
  const first=previewNormals(s,{mode:'smooth',creaseAngle:120,weighting:'equal',strength:.5});
  previewNormals(s,{mode:'seams',creaseAngle:60});previewNormals(s,{mode:'sd',weighting:'angle'});
  assert.deepEqual(previewNormals(s,{mode:'smooth',creaseAngle:120,weighting:'equal',strength:.5}),first);
  assert.deepEqual(m,before);
});
test('invalid SD settings reject without any model writes',()=>{
  const m=join(),before=structuredClone(m),s=captureNormalSelection(m,all(m));
  assert.throws(()=>previewNormals(s,{mode:'sd',weighting:'unknown'}),/Invalid SD/);
  assert.throws(()=>previewNormals(s,{mode:'seams',creaseAngle:NaN}),/Invalid SD/);assert.deepEqual(m,before);
});

test('the snapshot identifies unshaded SD materials without changing their flags',()=>{
  const m=join();m.Materials=[{Layers:[{Shading:1}]},{Layers:[{Shading:1},{Shading:16}]}];m.Geosets[0].MaterialID=0;m.Geosets[1].MaterialID=1;const before=structuredClone(m.Materials);
  assert.equal(captureNormalSelection(m,all(m)).unshadedCount,3);
  applyNormalPreview(m,preview(m));assert.deepEqual(m.Materials,before);
});
