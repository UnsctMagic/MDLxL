import test from 'node:test';
import assert from 'node:assert/strict';
import { captureNormalSelection, previewNormals, applyNormalPreview } from '../src/normalizer.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

const at = (a, i) => Array.from(a.slice(i * 3, i * 3 + 3));
const close = (a, b, eps = 1e-6) => assert.ok(a.every((n, i) => Math.abs(n - b[i]) < eps), JSON.stringify({a,b}));
const triangle = () => ({Vertices:Float32Array.of(10,0,0, 12,0,0, 10,2,0), Normals:new Float32Array(9), Faces:Uint16Array.of(0,1,2)});
const model = () => ({Geosets:[triangle(),triangle()]});
const preview = (m, ids, options) => previewNormals(captureNormalSelection(m, ids), options);

test('globe fits the selection bounds rather than the origin or vertex density', () => {
  const m = model(), s = captureNormalSelection(m,{0:[0,1,2,2]});
  assert.deepEqual(s.center,[11,1,0]); assert.equal(s.count,3); assert.equal(s.radius,Math.sqrt(2));
  const p = previewNormals(s); close(at(p.geosets[0].normals,0),[-Math.SQRT1_2,-Math.SQRT1_2,0]);
  assert.equal(p.changed,3); assert.equal(p.unresolved,0);
});
test('zero normals can be authored outward or inward without a reference', () => {
  const m = model(), s = captureNormalSelection(m,{0:[0,1,2]});
  for (const sign of [1,-1]) {
    const p = previewNormals(s,{mode:sign===1?'outward':'inward'});
    for (const id of s.geosets[0].ids) {
      const delta = at(m.Geosets[0].Vertices,id).map((v,a)=>(v-s.center[a])*sign), length=Math.hypot(...delta);
      close(at(p.geosets[0].normals,id),delta.map(v=>v/length));
    }
  }
});
test('preview, centre moves and strength changes are non-destructive and repeatable', () => {
  const m = model(), before=structuredClone(m), s=captureNormalSelection(m,{0:[0,1]});
  const first=previewNormals(s,{center:[0,0,0],strength:.5});
  previewNormals(s,{center:[7,5,-2],mode:'inward'});
  assert.deepEqual(previewNormals(s,{center:[0,0,0],strength:.5}),first);
  assert.deepEqual(m,before);
  assert.deepEqual(previewNormals(s,{strength:0}).geosets[0].normals,m.Geosets[0].Normals);
});
test('partial Apply preserves every unselected stream and geoset', () => {
  const m=model(), before=structuredClone(m), p=preview(m,{0:[1]},{center:[0,0,0]});
  applyNormalPreview(m,p);
  assert.deepEqual(m.Geosets[1],before.Geosets[1]);
  assert.deepEqual(m.Geosets[0].Vertices,before.Geosets[0].Vertices);
  assert.deepEqual(m.Geosets[0].Faces,before.Geosets[0].Faces);
  close(at(m.Geosets[0].Normals,0),[0,0,0]); close(at(m.Geosets[0].Normals,2),[0,0,0]);
  close(at(m.Geosets[0].Normals,1),[1,0,0]);
});
test('surface rebuild uses boundary triangles but writes only selected normals', () => {
  const m=model(), p=preview(m,{0:[0]},{mode:'surface'});
  close(at(p.geosets[0].normals,0),[0,0,1]); assert.equal(p.changed,1);
  close(at(p.geosets[0].normals,1),[0,0,0]);
});
test('surface weighting includes triangle area and keeps split vertices separate', () => {
  const g={Vertices:Float32Array.of(0,0,0, 2,0,0, 0,2,0, 0,0,1, 0,0,0),Normals:new Float32Array(15),Faces:Uint16Array.of(0,1,2, 0,3,1, 4,2,1)};
  const p=preview({Geosets:[g]},{0:[0,4]},{mode:'surface'});
  close(at(p.geosets[0].normals,0),[0,2/Math.sqrt(20),4/Math.sqrt(20)]);
  close(at(p.geosets[0].normals,4),[0,0,-1]);
});
test('a vertex at the centre, cancelled faces and loose vertices stay unchanged and counted', () => {
  const m=model(); m.Geosets[0].Normals.set([0,0,2],0);
  let p=preview(m,{0:[0]},{center:[10,0,0]});
  assert.equal(p.unresolved,1); assert.equal(p.changed,0); close(at(p.geosets[0].normals,0),[0,0,2]);
  m.Geosets[0].Faces=Uint16Array.of(0,1,2,2,1,0);
  p=preview(m,{0:[0,1,2]},{mode:'surface'}); assert.equal(p.unresolved,3);
  m.Geosets[0].Faces=new Uint16Array(); p=preview(m,{0:[1]},{mode:'surface'}); assert.equal(p.unresolved,1);
});
test('opposite directions blend through a stable finite unit direction', () => {
  const m=model(); m.Geosets[0].Normals.set([-1,0,0],0);
  const s=captureNormalSelection(m,{0:[0]});
  for (const strength of [0,.25,.5,.75,1]) {
    const p=previewNormals(s,{center:[0,0,0],strength}), n=at(p.geosets[0].normals,0);
    close([Math.hypot(...n)],[1]); close([n[0]],[-Math.cos(Math.PI*strength)]);
  }
});
test('existing tangent streams follow edited normals and preserve unselected tangents', () => {
  const m=model(), g=m.Geosets[0];
  g.Normals.set([0,0,1],0); g.TVertices=[Float32Array.of(0,0,1,0,0,1)];
  g.Tangents=Float32Array.of(1,0,0,1, 1,0,0,1, 1,0,0,1);
  const before=g.Tangents.slice(), p=preview(m,{0:[0]},{center:[0,0,0]}); applyNormalPreview(m,p);
  close(at(g.Normals,0),[1,0,0]);
  assert.ok(Math.abs(g.Normals[0]*g.Tangents[0]+g.Normals[1]*g.Tangents[1]+g.Normals[2]*g.Tangents[2])<1e-6);
  close([Math.hypot(...g.Tangents.slice(0,3))],[1]); assert.deepEqual(g.Tangents.slice(4),before.slice(4));
});
test('invalid later geosets reject capture before any model writes', () => {
  const m=model(); m.Geosets[1].Normals[1]=NaN; const before=structuredClone(m);
  assert.throws(()=>captureNormalSelection(m,{0:[0],1:[0]}),/finite/); assert.deepEqual(m,before);
  assert.throws(()=>captureNormalSelection(model(),{0:[999]}),/out of date/);
  assert.throws(()=>captureNormalSelection(model(),{}),/Select visible/);
});
test('Apply validates all destinations before writing the first', () => {
  const m=model(), p=preview(m,{0:[0],1:[0]},{center:[0,0,0]});
  m.Geosets[1].Normals=new Float32Array(); const before=structuredClone(m);
  assert.throws(()=>applyNormalPreview(m,p),/model changed/); assert.deepEqual(m,before);
});
test('one document edit undoes and redoes exactly, then survives MDL and MDX saves', () => {
  const doc=createDemoDocument(), before=structuredClone(doc.model.Geosets), s=captureNormalSelection(doc.model,{0:[0,1,2]});
  const p=previewNormals(s,{center:[-7,19,41]});
  doc.apply('NormalsXL',['Geosets'],m=>applyNormalPreview(m,p));
  const after=structuredClone(doc.model.Geosets);
  assert.notDeepEqual(after,before); doc.undo(); assert.deepEqual(doc.model.Geosets,before);
  doc.redo(); assert.deepEqual(doc.model.Geosets,after);
  for (const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'normalizer.'+format);
    for (const id of [0,1,2]) close(at(reopened.model.Geosets[0].Normals,id),at(after[0].Normals,id));
    assert.deepEqual(reopened.model.Geosets[0].Faces,after[0].Faces);
  }
});
