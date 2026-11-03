import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDocument } from '../src/editor-document.js';
import { indexedSurfaceIslands } from '../src/geoset-operations.js';
import { gatherStreams } from '../src/mesh-tools.js';
import { measureSimplifyCandidate } from '../src/ai-simplify-checks.js';
import { measureEditingCandidate } from '../src/ai-editing-procedures.js';
const load=()=>openDocument(fs.readFileSync(new URL('./fixtures/ai-real-use/helmet.mdx',import.meta.url)),'helmet.mdx').model;
const get=(report,name)=>report.checks.find(c=>c.name===name);
const bounds=(g,ids)=>[Math.min,Math.max].map(fn=>[0,1,2].map(axis=>fn(...ids.map(v=>g.Vertices[v*3+axis]))));
function candidate(counts=Array(8).fill(6),torn=false){
  const before=load(),after=structuredClone(before),g=before.Geosets[6],islands=indexedSurfaceIslands(g),faces=[];
  for(const [i,ids]of islands.entries()){
    const center=ids.at(-1),ring=ids.slice(0,-1);let keep;
    for(let mask=0;mask<256;mask++){
      const selected=ring.filter((_,bit)=>mask&(1<<bit));
      if(selected.length===counts[i]&&JSON.stringify(bounds(g,[...selected,center]))===JSON.stringify(bounds(g,ids))){keep=selected;break;}
    }
    assert.ok(keep,`A dimension-preserving ${counts[i]}-triangle fan exists for stud ${i}`);
    if(torn&&i===0){for(let j=2;j<8;j++)faces.push(ring[j],ring[(j+1)%8],center);}
    else for(let j=0;j<keep.length;j++)faces.push(keep[j],keep[(j+1)%keep.length],center);
  }
  const retained=[...new Set(faces)].sort((a,b)=>a-b),map=new Map(retained.map((v,i)=>[v,i]));
  after.Geosets[6]={...after.Geosets[6],...gatherStreams(g,retained),Faces:new Uint16Array(faces.map(v=>map.get(v)))};
  return{before,after};
}
const options={targets:Array.from({length:8},(_,component)=>({geoset:6,component,triangles:6}))};

test('real helmet eight-stud compaction meets each target, dimensions, UVs, binding and intact boundary',()=>{
  const{before,after}=candidate(),snapshot=structuredClone(after),r=measureSimplifyCandidate(before,after,options);
  assert.equal(after.Geosets[6].Vertices.length/3,56);assert.equal(after.Geosets[6].Faces.length/3,48);
  for(const name of ['component retention','per-component triangle targets','surface integrity','boundary retention','component dimensions','UV preservation','binding retention'])assert.equal(get(r,name).passed,true,name);
  const studs=r.components.filter(c=>c.geoset===6);
  assert.deepEqual(studs.map(c=>c.afterTriangles),Array(8).fill(6));
  assert.deepEqual(studs.map(c=>c.comparable),Array(8).fill(true));
  assert.deepEqual(after,snapshot);assert.ok(r.unverified.some(s=>s.includes('interpolat')));
});

test('equal pooled total cannot pass four/eight/six triangle distribution',()=>{
  const{before,after}=candidate([4,8,6,6,6,6,6,6]),r=measureSimplifyCandidate(before,after,options);
  assert.equal(after.Geosets[6].Faces.length/3,48);
  assert.equal(get(r,'per-component triangle targets').passed,false);
  assert.deepEqual(r.components.filter(c=>c.geoset===6).map(c=>c.afterTriangles),[4,8,6,6,6,6,6,6]);
});

test('six faces with a torn stud rim cannot pass intact boundary even with exact counts and dimensions',()=>{
  const{before,after}=candidate(Array(8).fill(6),true),r=measureSimplifyCandidate(before,after,options);
  assert.equal(get(r,'per-component triangle targets').passed,true);
  assert.equal(get(r,'component dimensions').passed,true);
  assert.equal(get(r,'boundary retention').passed,false);
  assert.ok(r.components.find(c=>c.geoset===6&&c.component===0).boundary.newBoundaryVertices>0);
});

test('duplicate/degenerate faces and disconnected triangle surfaces are explicit failures',()=>{
  const{before,after}=candidate();
  after.Geosets[6].Faces.set(after.Geosets[6].Faces.slice(0,3),3);
  assert.equal(get(measureSimplifyCandidate(before,after,options),'surface integrity').passed,false);
  const second=candidate();second.after.Geosets[6].Faces[1]=second.after.Geosets[6].Faces[0];
  assert.equal(get(measureSimplifyCandidate(second.before,second.after,options),'surface integrity').passed,false);
  const g={Vertices:Float32Array.from([0,0,0,1,0,0,0,1,0,-1,0,0,0,-1,0]),Faces:Uint16Array.from([0,1,2,0,2,3,0,3,4,0,4,1]),VertexGroup:Uint8Array.from([0,0,0,0,0]),Groups:[[0]],TVertices:[new Float32Array(10)]};
  const a={Geosets:[g]},b=structuredClone(a);b.Geosets[0].Faces=Uint16Array.from([0,1,2,0,3,4]);
  const split=measureSimplifyCandidate(a,b,{targets:[{geoset:0,component:0,triangles:2}]});
  assert.equal(get(split,'surface integrity').passed,false,'surfaces touching only at a vertex are disconnected');
});

test('retained UV and binding changes fail independently of index renumbering',()=>{
  const{before,after}=candidate();after.Geosets[6].TVertices[0][0]+=.1;
  let r=measureSimplifyCandidate(before,after,options);assert.equal(get(r,'UV preservation').passed,false);assert.equal(get(r,'binding retention').passed,true);
  after.Geosets[6].Groups=[...after.Geosets[6].Groups,[999]];after.Geosets[6].VertexGroup[0]=after.Geosets[6].Groups.length-1;
  r=measureSimplifyCandidate(before,after,options);assert.equal(get(r,'binding retention').passed,false);
});

test('unknown moved coordinates and ambiguous component identities remain unverified rather than guessed',()=>{
  const{before,after}=candidate();after.Geosets[6].Vertices[0]+=.001;
  const r=measureSimplifyCandidate(before,after,options);
  assert.ok(r.unverified.some(s=>/correspondence/.test(s)));
  assert.notEqual(get(r,'component retention').passed,true);
  const g={Vertices:Float32Array.from([0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0]),Faces:Uint16Array.from([0,1,2,3,4,5]),VertexGroup:Uint8Array.from([0,0,0,0,0,0]),Groups:[[0]],TVertices:[new Float32Array(12)]};
  const compacted={...structuredClone(g),Vertices:g.Vertices.slice(0,9),Faces:Uint16Array.from([0,1,2]),VertexGroup:g.VertexGroup.slice(0,3),TVertices:[g.TVertices[0].slice(0,6)]};
  const ambiguous=measureSimplifyCandidate({Geosets:[g]},{Geosets:[compacted]});
  assert.ok(ambiguous.unverified.some(s=>/ambiguous/.test(s)));
  assert.notEqual(get(ambiguous,'component retention').passed,true);
});

test('simplify integration accepts compacted UVs/whole-island selection; unrelated operations gain no simplify gates',()=>{
  const{before,after}=candidate(),selection={6:Array.from({length:72},(_,i)=>i)};
  const report=measureEditingCandidate(before,after,{operation:'simplify',scope:['/Geosets/6'],selection,simplify:options});
  for(const name of ['component retention','per-component triangle targets','selection confinement','UV preservation'])assert.equal(get(report,name).passed,true,name);
  const other=measureEditingCandidate(before,after,{operation:'geometry',scope:['/Geosets/6'],preserveUVs:false});
  assert.ok(!other.checks.some(c=>['per-component triangle targets','boundary retention','component dimensions'].includes(c.name)));
});
