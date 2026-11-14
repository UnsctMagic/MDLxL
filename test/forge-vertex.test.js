import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { detachFaces } from '../src/mesh-tools.js';
import { openDocument } from '../src/editor-document.js';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { forgeMoldState, prepareForgeMold, previewForgeMold } from '../src/forge-molding.js';
import { vertexForgeDraft, vertexForgeResult, appendVertexForgeShape } from '../src/forge-vertex.js';
import { cutForgeShape } from '../src/forge-shape-editing.js';
import { weldSelectedVertices } from '../src/classic-mesh.js';
import { addTriangle } from '../src/editor-commands.js';
const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = (...keys) => { const absent = keys.filter(key => { const file = fixturePath(key); return !file || !fs.existsSync(file); }); return absent.length ? `private test model not on this machine: ${absent.join(', ')}` : false; };

const cube = () => {
  const g = buildForgePrimitive({ shape: 'Cube', width: 40, height: 40, depth: 40 }).geosets[0];
  return { ...g, VertexGroup: new Uint8Array(g.Vertices.length / 3), Groups: [[7]], TotalGroupsCount: 1, MaterialID: 3, SelectionGroup: 4,
    TVertices: [g.TVertices[0], Float32Array.from(g.TVertices[0], n => n * .5 + .2)],
    SkinWeights: Uint16Array.from({ length: g.Vertices.length / 3 * 8 }, (_, i) => i % 8 === 0 ? 300 : i % 8 === 4 ? 255 : 0),
    Anims: [{ MinimumExtent: new Float32Array([-40,-40,-40]), MaximumExtent: new Float32Array([40,40,40]), BoundsRadius: 80 }] };
};
const all = g => Array.from({ length: g.Vertices.length / 3 }, (_, i) => i);
// The owner's recorded Footman shield selection: 31 vertices, 16 triangles,
// centre (-3.2208, -26.5781, 46.5484), including its strap and central boss.
const shield = [...Array.from({length:7},(_,i)=>225+i),...Array.from({length:14},(_,i)=>253+i),...Array.from({length:10},(_,i)=>425+i)];
const shieldDocument = () => openDocument(fs.readFileSync(fixturePath('citadel-footman')), 'Footman.mdx');
test('Footman shield bevel works on either side of the drag origin', { skip: missing('citadel-footman') }, () => {
  const model=shieldDocument().model,draft=vertexForgeDraft(model,{0:shield});
  const preview=amount=>{const state={...forgeMoldState(draft,'Bevel'),amount};return vertexForgeResult(model,draft,previewForgeMold(draft,draft,state));};
  const inward=preview(-1),outward=preview(1);
  assert.notDeepEqual(inward.Geosets[0].Vertices,model.Geosets[0].Vertices,'inward drag bevels the shield');
  assert.deepEqual(inward.Geosets,outward.Geosets,'both drag directions produce the same bevel width');
});
test('shield bevel width is independent of tiny edges in the rest of the Footman', { skip: missing('citadel-footman') }, () => {
  const model=shieldDocument().model,detached=structuredClone(model);detachFaces(detached,0,shield);
  const edited=(m,gi,ids)=>{const draft=vertexForgeDraft(m,{[gi]:ids}),state={...forgeMoldState(draft,'Bevel'),amount:1};const result=vertexForgeResult(m,draft,previewForgeMold(draft,draft,state));return result.forgeSelection[gi].map(id=>Array.from(result.Geosets[gi].Vertices.slice(id*3,id*3+3))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));};
  assert.deepEqual(edited(model,0,shield),edited(detached,5,all(detached.Geosets[5])),'same shield and width before and after detaching');
});
test('opening Forge and zero previews preserve existing streams exactly', () => {
  const g = cube(), model = { Geosets: [g] }, draft = vertexForgeDraft(model, { 0: all(g) });
  assert.deepEqual(vertexForgeResult(model, draft, draft).Geosets, model.Geosets);
});
for (const tool of ['Bend', 'Bulge', 'Taper', 'Bevel', 'Twist']) test(`${tool} retains material, UV sets, skin format and bindings`, () => {
  const g = cube(), model = { Geosets: [g, structuredClone(g)] }, before = structuredClone(model);
  const draft = vertexForgeDraft(model, { 0: all(g) });
  const state = { ...forgeMoldState(draft, tool), amount: tool === 'Bevel' ? 2 : tool === 'Bend' || tool === 'Twist' ? 15 : .2 };
  const result = vertexForgeResult(model, draft, previewForgeMold(draft, prepareForgeMold(draft, state), state));
  assert.deepEqual(model, before, 'preview never mutates the document');
  assert.deepEqual(result.Geosets[1], before.Geosets[1], 'unselected geoset unchanged');
  const out = result.Geosets[0], count = out.Vertices.length / 3;
  assert.notDeepEqual(out.Vertices, g.Vertices);
  assert.equal(out.MaterialID, 3); assert.equal(out.SelectionGroup, 4);
  assert.equal(out.TVertices.length, 2); assert.ok(out.SkinWeights instanceof Uint16Array);
  assert.equal(out.SkinWeights.length, count * 8); assert.equal(out.VertexGroup.length, count);
  assert.ok(out.Faces.every(i => i < count)); assert.ok(out.Vertices.every(Number.isFinite));
  for (let i = 0; i < count; i++) { assert.equal(out.SkinWeights[i*8], 300); assert.equal(out.SkinWeights[i*8+4], 255); }
});
test('new objects join the active geoset with its material and selected binding', () => {
  const g = cube(), model = { Geosets: [g] }, count = g.Vertices.length / 3;
  const result = appendVertexForgeShape(model, 0, [0], buildForgePrimitive({ shape: 'Cube', width: 4, height: 4, depth: 4 }), [0,0,0]);
  assert.equal(model.Geosets.length, 1); assert.ok(g.Vertices.length / 3 > count);
  assert.equal(g.MaterialID, 3); assert.ok(result.selection[0].every(id => id >= count));
  for (const id of result.selection[0]) assert.equal(g.SkinWeights[id*8], 300);
});
test('real Footman can taper in place without changing rig, animation or other geosets', { skip: missing('citadel-footman') }, () => {
  const doc = openDocument(fs.readFileSync(fixturePath('citadel-footman')), 'Footman.mdx'), model = doc.model, before = structuredClone(model);
  const draft = vertexForgeDraft(model, { 0: all(model.Geosets[0]) });
  const state = { ...forgeMoldState(draft, 'Taper'), amount: .08 };
  const result = vertexForgeResult(model, draft, previewForgeMold(draft, draft, state));
  assert.notDeepEqual(result.Geosets[0].Vertices, before.Geosets[0].Vertices);
  for (const key of Object.keys(before)) if (key !== 'Geosets') assert.deepEqual(result[key], before[key], key);
  assert.deepEqual(result.Geosets.slice(1), before.Geosets.slice(1));
  assert.deepEqual(model, before);
});
test('beveling a new object preserves untouched authored normals in the same geoset', () => {
  const g=cube(),model={Geosets:[g]},count=g.Vertices.length/3;
  g.Tangents=new Float32Array(count*4);
  for(let i=0;i<count;i++){g.Normals.set([.3,.4,.5],i*3);g.Tangents.set([.7,.8,.9,-1],i*4);}
  const oldPositions=Array.from(g.Vertices),oldNormals=Array.from(g.Normals);
  const oldTangents=Array.from(g.Tangents);
  const added=appendVertexForgeShape(model,0,[0],buildForgePrimitive({shape:'Cube',width:10,height:10,depth:10}),[100,0,0]);
  const draft=vertexForgeDraft(model,added.selection),state={...forgeMoldState(draft,'Bevel'),amount:1};
  const preview=vertexForgeResult(model,draft,previewForgeMold(draft,draft,state)),result=preview.Geosets[0];
  assert.ok(preview.forgeSelection[0].every(id=>result.Vertices[id*3]>50),'bevel keeps only the edited object selected');
  for(let i=0;i<count;i++){
    assert.deepEqual(Array.from(result.Vertices.slice(i*3,i*3+3)),oldPositions.slice(i*3,i*3+3),'untouched position keeps its index');
    assert.deepEqual(Array.from(result.Normals.slice(i*3,i*3+3)),oldNormals.slice(i*3,i*3+3));
    assert.deepEqual(Array.from(result.Tangents.slice(i*4,i*4+4)),oldTangents.slice(i*4,i*4+4));
  }
});
test('cuts interpolate mixed HD skin weights and every UV set without resetting bindings', () => {
  const g=cube();g.Groups=[[7],[8]];
  for(let i=0;i<g.Vertices.length/3;i++){
    const side=g.Vertices[i*3]>0?1:0;g.VertexGroup[i]=side;g.SkinWeights.set([300+side,0,0,0,255,0,0,0],i*8);
  }
  const model={Geosets:[g]},before=vertexForgeDraft(model,{0:all(g)}),shape=before.shapes[0];
  const cut=cutForgeShape(shape,{direction:[1,0,0],min:-20,max:20},[.5]);
  const result=vertexForgeResult(model,before,{...before,shapes:[cut]}).Geosets[0];
  let middle=0;
  for(let i=0;i<result.Vertices.length/3;i++){
    assert.equal(Array.from(result.SkinWeights.slice(i*8+4,i*8+8)).reduce((a,b)=>a+b),255);
    if(Math.abs(result.Vertices[i*3])<1e-6){middle++;assert.deepEqual(new Set(result.SkinWeights.slice(i*8,i*8+2)),new Set([300,301]));}
    for(let a=0;a<2;a++)assert.ok(Math.abs(result.TVertices[1][i*2+a]-(result.TVertices[0][i*2+a]*.5+.2))<1e-6);
  }
  assert.ok(middle>0);
});
test('Forge objects weld to authored vertices, accept faces, and survive editor Undo/Redo and both save formats', { skip: missing('citadel-footman') }, () => {
  const doc=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx'),before=structuredClone(doc.model);
  const added=doc.apply('Forge cube',['Geosets'],m=>appendVertexForgeShape(m,0,[0],buildForgePrimitive({shape:'Cube',width:8,height:8,depth:8}),[0,0,150]));
  const ids=added.selection[0],retained=doc.apply('Weld',['Geosets'],m=>weldSelectedVertices(m.Geosets[0],[0,ids[0]])).selection[0];
  doc.apply('Create triangle',['Geosets'],m=>addTriangle(m.Geosets[0],[retained,ids[1]-1,ids[2]-1]));
  const after=structuredClone(doc.model);
  for(const format of ['mdl','mdx']){
    const reopened=openDocument(doc.serialize(format),'Forge.'+format).model;
    assert.deepEqual(reopened.Geosets[0].Vertices,after.Geosets[0].Vertices);
    assert.deepEqual(reopened.Geosets[0].Faces,after.Geosets[0].Faces);
    assert.deepEqual(reopened.Geosets[0].VertexGroup,after.Geosets[0].VertexGroup);
    assert.deepEqual(reopened.Geosets[0].TVertices,after.Geosets[0].TVertices);
  }
  doc.undo();doc.undo();doc.undo();assert.deepEqual(doc.model,before);
  doc.redo();doc.redo();doc.redo();assert.deepEqual(doc.model,after);
  for(const key of ['Materials','Textures','Nodes','Sequences','GeosetAnims'])assert.deepEqual(after[key],before[key],key);
});
