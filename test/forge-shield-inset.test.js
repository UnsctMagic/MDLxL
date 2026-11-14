import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {openDocument} from '../src/editor-document.js';
import {vertexForgeDraft,vertexForgeFaces,vertexForgeResult} from '../src/forge-vertex.js';
import {insetForgeFaces,forgeFaceNormal,forgeEdgeKey} from '../src/forge-shape-editing.js';
import {forgeMoldState} from '../src/forge-molding.js';
import {forgeMoldHandles} from '../app/forge-mold-handles.js';
import {dot,sub,cross} from '../src/vec.js';
import {Triangle,Vector3} from 'three';
const {fixturePath}=createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = (...keys) => { const absent = keys.filter(key => { const file = fixturePath(key); return !file || !fs.existsSync(file); }); return absent.length ? `private test model not on this machine: ${absent.join(', ')}` : false; };
const draft=()=>{const doc=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx');return{doc,edit:vertexForgeFaces(vertexForgeDraft(doc.model,{0:Array.from({length:14},(_,i)=>253+i)}))};};
test('Inset handle distances use the same model units as the drag',{skip:missing('citadel-footman')},()=>{
 const {edit}=draft(),state=forgeMoldState(edit,'Inset'),before=forgeMoldHandles(state).points[0].position;
 for(const amount of [-20,-1,1,20]){const after=forgeMoldHandles({...state,amount}).points[0].position;assert.ok(Math.abs(after[state.direction]-before[state.direction]-amount)<1e-8,'one world unit of drag moves the handle one world unit');}
});
test('actual curved shield plate insets with intact outline, surface height, UV streams and bindings',{skip:missing('citadel-footman')},()=>{
 const {doc,edit}=draft(),source=edit.shapes[0],ids=edit.selection[0],before=structuredClone(doc.model);
 doc.model.Geosets[0].TVertices.push(Float32Array.from(doc.model.Geosets[0].TVertices[0],n=>n*.4+.17));
 const original=source.faces.filter(f=>ids.includes(f.id)),border=new Map();
 for(const f of original)f.vertices.forEach((a,i)=>{const b=f.vertices[(i+1)%f.vertices.length],key=forgeEdgeKey(a,b);if(border.has(key))border.delete(key);else border.set(key,[a,b]);});
 assert.equal(border.size,7);
 for(const width of [1,3,7]){
  const shape=insetForgeFaces(source,ids,width),faces=shape.faces.filter(f=>ids.includes(f.id)||f.id>=source.nextFaceId),edges=new Map();
  for(const f of faces)for(const t of f.triangles){const [a,b,c]=t.vertices.map(i=>shape.vertices[i]);assert.ok(Math.hypot(...cross(sub(b,a),sub(c,a)))>1e-7);t.vertices.forEach((a,i)=>{const key=forgeEdgeKey(a,t.vertices[(i+1)%3]);edges.set(key,(edges.get(key)||0)+1);});}
  for(const key of border.keys())assert.equal(edges.get(key),1,'outer shield edge preserved');
  for(const [key,count]of edges)assert.equal(count,border.has(key)?1:2,'cap and border are stitched');
  for(const f of original)assert.ok(dot(forgeFaceNormal(source,f),forgeFaceNormal(shape,shape.faces.find(n=>n.id===f.id)))>.9,'curved cap faces keep orientation');
  const surface=original.flatMap(f=>f.triangles).map(t=>new Triangle(...t.vertices.map(i=>new Vector3(...source.vertices[i]))));
  for(const f of shape.faces.filter(f=>ids.includes(f.id)))for(const id of f.vertices){const p=new Vector3(...shape.vertices[id]);assert.ok(surface.some(t=>t.closestPointToPoint(p,new Vector3()).distanceTo(p)<1e-6),'inset cap follows the original curved surface');}
  const result=vertexForgeResult(doc.model,edit,{...edit,shapes:[shape]}),g=result.Geosets[0];
  for(let i=0;i<g.Vertices.length/3;i++)for(let a=0;a<2;a++)assert.ok(Math.abs(g.TVertices[1][i*2+a]-(g.TVertices[0][i*2+a]*.4+.17))<1e-6,'UV streams stay aligned');
  for(const i of result.forgeSelection[0])assert.deepEqual(g.Groups[g.VertexGroup[i]],[15]);
  assert.deepEqual(result.Geosets.slice(1),before.Geosets.slice(1));
  if(width===3){
   const saved=structuredClone(result);saved.Geosets[0].TVertices.pop();
   for(const format of ['mdx','mdl']){const copy=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx');copy.apply('Inset shield',['Geosets'],m=>{m.Geosets=saved.Geosets;});const reopened=openDocument(copy.serialize(format),'Inset.'+format);assert.deepEqual(reopened.model.Geosets[0].Vertices,saved.Geosets[0].Vertices);assert.deepEqual(reopened.model.Geosets[0].Faces,saved.Geosets[0].Faces);copy.undo();assert.deepEqual(copy.model,before);copy.redo();assert.deepEqual(copy.model.Geosets[0].Vertices,saved.Geosets[0].Vertices);}
  }
 }
 assert.throws(()=>insetForgeFaces(source,ids,100),/too wide/);
});
