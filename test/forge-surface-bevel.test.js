import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {openDocument} from '../src/editor-document.js';
import {detachFaces} from '../src/mesh-tools.js';
import {buildForgePrimitive} from '../src/forge-primitives.js';
import {createForgeShape,forgeFaceNormal,forgeEdgeKey} from '../src/forge-shape-editing.js';
import {bevelForgeShape,forgeMoldState,previewForgeMold} from '../src/forge-molding.js';
import {vertexForgeDraft,vertexForgeResult} from '../src/forge-vertex.js';
import {sub,cross,dot} from '../src/vec.js';
const {fixturePath}=createRequire(import.meta.url)('./helpers/fixtures.cjs');
const plate=Array.from({length:14},(_,i)=>253+i);
const shield=[...Array.from({length:7},(_,i)=>225+i),...plate,...Array.from({length:10},(_,i)=>425+i)];
const document=()=>openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx');
const position=p=>p.map(n=>n.toFixed(5)).join(',');
const edges=shape=>{
 const result=new Map();
 for(const f of shape.faces)for(const t of f.triangles){
  const [a,b,c]=t.vertices.map(i=>shape.vertices[i]);
  assert.ok(Math.hypot(...cross(sub(b,a),sub(c,a)))>1e-7,'no collapsed triangles');
  t.vertices.forEach((a,i)=>{const b=t.vertices[(i+1)%3],k=forgeEdgeKey(a,b);if(!result.has(k))result.set(k,[]);result.get(k).push([a,b]);});
 }
 for(const uses of result.values()){
  assert.ok(uses.length<=2,'no non-manifold overlap');
  if(uses.length===2)assert.deepEqual(uses[0],[uses[1][1],uses[1][0]],'shared edges wind oppositely');
 }
 return result;
};
const border=shape=>[...edges(shape).values()].filter(uses=>uses.length===1).map(uses=>uses[0].map(i=>position(shape.vertices[i])).sort().join('|')).sort();

for(const detached of [false,true])for(const round of [false,true])test(`actual shield plate has a continuous ${round?'rounded':'angled'} rim ${detached?'as a separate geoset':'inside the Footman'}`,()=>{
 const doc=document(),model=doc.model;
 let gi=0,selected=plate;
 if(detached){detachFaces(model,0,plate);gi=5;selected=Array.from({length:model.Geosets[5].Vertices.length/3},(_,i)=>i);}
 const draft=vertexForgeDraft(model,{[gi]:selected}),source=draft.shapes[0],snapshot=structuredClone(source);
 const chosen=new Set(draft.selection[gi]),faces=source.faces.filter(f=>f.triangles.every(t=>t.vertices.every(i=>chosen.has(i))));
 const originalPlate={...source,faces},originalBorder=border(originalPlate);
 assert.equal(originalBorder.length,7);
 for(const amount of [1,3,100]){
  const result=bevelForgeShape(source,draft.selection[gi],'Vertices',amount,round);
  const editedPlate={...result,faces:result.faces.filter(f=>faces.some(old=>old.id===f.id)||f.id>=source.nextFaceId)};
  assert.deepEqual(border(editedPlate),originalBorder,'all seven original border edges remain intact, without notches');
  assert.equal(editedPlate.faces.reduce((n,f)=>n+f.triangles.length,0),5+7*2*(round?4:1),'a band follows every perimeter edge');
  const normal=forgeFaceNormal(source,faces[0]);
  assert.ok(editedPlate.faces.filter(f=>f.id>=source.nextFaceId).some(f=>dot(forgeFaceNormal(result,f),normal)<.9),'rim faces slope away from the plate, rather than adding coplanar triangles');
  for(const face of faces){
   const cap=result.faces.find(f=>f.id===face.id);
   assert.ok(dot(forgeFaceNormal(result,cap),forgeFaceNormal(source,face))>0,'cap does not fold or invert');
  }
 }
 assert.deepEqual(source,snapshot,'preview is immutable');
});

test('whole shield selection bevels the plate rim even with its strap and boss present',()=>{
 const model=document().model,draft=vertexForgeDraft(model,{0:shield}),source=draft.shapes[0];
 const plateIds=new Set(plate.map(i=>source.sourceVertices[i]));
 const faces=source.faces.filter(f=>f.triangles.every(t=>t.vertices.every(i=>plateIds.has(i))));
 const originalEdges=border({...source,faces});
 for(const round of [false,true]){
  const result=bevelForgeShape(source,draft.selection[0],'Vertices',2,round);
  // The untouched Footman head already has four non-manifold edges (faces
  // 5/238/246, 6/7/236/237, 21/22/233/234 and 29/235/251). Validate all of
  // the edited shield, not unrelated inherited head topology.
  const selected=new Set(shield),editedShield={...result,faces:result.faces.filter(f=>f.triangles.every(t=>t.vertices.every(i=>result.vertexSources[i].every(([id])=>selected.has(id)))))};
  const open=new Set(border(editedShield));
  for(const edge of originalEdges)assert.ok(open.has(edge),'the boss cannot prevent an intact plate rim');
 }
});

test('sheet bevel preserves authored UV streams, bindings, unrelated faces and save/Undo',()=>{
 const doc=document(),model=doc.model,g=model.Geosets[0];
 g.TVertices.push(Float32Array.from(g.TVertices[0],n=>n*.4+.17));
 const before=structuredClone(model),draft=vertexForgeDraft(model,{0:plate}),state={...forgeMoldState(draft,'Bevel'),amount:2,round:true};
 const result=vertexForgeResult(model,draft,previewForgeMold(draft,draft,state)),out=result.Geosets[0];
 assert.notDeepEqual(out.Vertices,g.Vertices);
 assert.deepEqual(result.Geosets.slice(1),model.Geosets.slice(1));
 for(let i=0;i<out.Vertices.length/3;i++)for(let a=0;a<2;a++)assert.ok(Math.abs(out.TVertices[1][i*2+a]-(out.TVertices[0][i*2+a]*.4+.17))<1e-6,'all UV sets use the same surface samples');
 for(const id of result.forgeSelection[0])assert.deepEqual(out.Groups[out.VertexGroup[id]],[15],'rim retains the shield bone');
 for(let i=0;i<g.Vertices.length/3;i++)if(!plate.includes(i)){
  const candidates=Array.from({length:out.Vertices.length/3},(_,j)=>j).filter(j=>position(Array.from(out.Vertices.slice(j*3,j*3+3)))===position(Array.from(g.Vertices.slice(i*3,i*3+3))));
  assert.ok(candidates.some(j=>Array.from(out.Normals.slice(j*3,j*3+3)).every((n,a)=>n===g.Normals[i*3+a])&&Array.from(out.TVertices[0].slice(j*2,j*2+2)).every((n,a)=>n===g.TVertices[0][i*2+a])),'unselected authored vertex streams retained');
 }
 // Use the normal document boundary with the original format's single UV set.
 g.TVertices.pop();out.TVertices.pop();before.Geosets[0].TVertices.pop();
 doc.apply('Bevel shield',['Geosets'],m=>{m.Geosets=result.Geosets;});
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'Shield.'+format).model.Geosets[0];
  assert.deepEqual(reopened.Vertices,out.Vertices);assert.deepEqual(reopened.Faces,out.Faces);
  assert.deepEqual(reopened.TVertices,out.TVertices);assert.deepEqual(reopened.VertexGroup,out.VertexGroup);
 }
 doc.undo();assert.deepEqual(doc.model,before);doc.redo();assert.deepEqual(doc.model.Geosets[0].Vertices,out.Vertices);
});

test('a flat sheet gets a rim without an existing solid edge, including a subdivided sheet',()=>{
 for(const shapeName of ['Plane','Circle','Grid']){
  const source=createForgeShape(buildForgePrimitive({shape:shapeName,width:80,height:60,depth:60,complexity:2,zUp:true}));
  // Grid has thickness by default; use the exposed top as a standalone sheet.
  const top=source.faces.filter(f=>forgeFaceNormal(source,f)[2]>.99);
  const sheet=top.length?{...source,faces:top}:source;
  for(const round of [false,true]){
   const result=bevelForgeShape(sheet,['shape'],'Shape',2,round);
   assert.deepEqual(border(result),border(sheet));assert.ok(result.faces.length>sheet.faces.length);
  }
 }
});
