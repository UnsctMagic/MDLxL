import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { declareRegion, regionsConflict, regionSignature, checkRegionEdit } from '../src/ai-regions.js';
import { prepareAiEdit, applyAiEdit } from '../src/ai-model.js';
function document() {
  const doc = createStarterDocument();
  doc.apply('Second part', ['Geosets'], m => m.Geosets.push(structuredClone(m.Geosets[0])));
  return doc;
}
test('regions allow disjoint writes and shared read dependencies, but block shared writes and structural jobs', () => {
  const { model } = document();
  const a=declareRegion(model,{scope:['/Geosets/0']}), b=declareRegion(model,{scope:['/Geosets/1']});
  assert.equal(regionsConflict(a,b),false);
  assert.equal(regionsConflict(a,declareRegion(model,{scope:['/Materials/0']})),true);
  assert.equal(regionsConflict(a,declareRegion(model,{scope:['/Geosets']})),true);
  assert.equal(regionsConflict(a,declareRegion(model,{readOnly:true})),false);
  assert.equal(regionsConflict(a,a),true);
});
test('region fingerprints ignore another mesh but include its own mesh, shared material and structural IDs', () => {
  const { model } = document(), region=declareRegion(model,{scope:['/Geosets/0']}), original=regionSignature(model,region);
  model.Geosets[1].Vertices[0]+=1;
  assert.equal(regionSignature(model,region),original);
  model.Geosets[0].Vertices[0]+=1;
  assert.notEqual(regionSignature(model,region),original);
  model.Geosets[0].Vertices[0]-=1;
  model.Materials[0].PriorityPlane+=1;
  assert.notEqual(regionSignature(model,region),original);
});
test('every actual edit is checked against the declared region, protected paths and structural boundary', () => {
  const { model } = document(), region=declareRegion(model,{scope:['/Geosets/0'],protectedPaths:['/Geosets/0/Normals']});
  const changed=structuredClone(model); changed.Geosets[1].Vertices[0]+=1;
  assert.throws(()=>checkRegionEdit(model,changed,region,prepareAiEdit(model,changed,{scope:['/Geosets']}).changes),/declared region/);
  const protectedEdit=structuredClone(model);protectedEdit.Geosets[0].Normals[0]+=1;
  assert.throws(()=>checkRegionEdit(model,protectedEdit,region,prepareAiEdit(model,protectedEdit,{scope:['/Geosets/0']}).changes),/protected path/);
  const structural=structuredClone(model);structural.Geosets.push(structuredClone(model.Geosets[0]));
  assert.throws(()=>checkRegionEdit(model,structural,region,prepareAiEdit(model,structural,{scope:['/Geosets']}).changes),/structural/);
});
test('separate bird deltas merge into the latest model and have independent inverse Undo steps', () => {
  const doc=document(), original=structuredClone(doc.model);
  const a=structuredClone(original), b=structuredClone(original);
  a.Geosets[0].Vertices[0]+=2;b.Geosets[1].Vertices[0]+=3;
  const pa=prepareAiEdit(original,a,{scope:['/Geosets/0']}),pb=prepareAiEdit(original,b,{scope:['/Geosets/1']});
  doc.apply('Crow: first part',pa.sections,m=>applyAiEdit(m,pa));
  doc.apply('Raven: second part',pb.sections,m=>applyAiEdit(m,pb));
  assert.equal(doc.model.Geosets[0].Vertices[0],a.Geosets[0].Vertices[0]);
  assert.equal(doc.model.Geosets[1].Vertices[0],b.Geosets[1].Vertices[0]);
  doc.undo();
  assert.equal(doc.model.Geosets[0].Vertices[0],a.Geosets[0].Vertices[0]);
  assert.equal(doc.model.Geosets[1].Vertices[0],original.Geosets[1].Vertices[0]);
  doc.redo();
  assert.equal(doc.model.Geosets[1].Vertices[0],b.Geosets[1].Vertices[0]);
});
