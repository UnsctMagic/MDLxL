import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, openDocument, EditorDocument, deleteGeoset } from '../src/editor-document.js';
import { beginUVPreview, applyUVPreviews, revertUVPreviews, uvPreviewModel, restoreUVPreviews, validateUVPreview, captureUVPreviewGuard, validateUVPreviewGuard, getUVPreviewSelection, imageTextureLayers, chooseUVImageLayer } from '../src/uv-preview.js';

import { deleteVertices } from '../src/editor-commands.js';
import { extrudeFaces } from '../src/mesh-tools.js';
import { deleteSelectedFaces, collapseVertices, uncoupleVertices, weldSelectedVertices } from '../src/classic-mesh.js';

const asset = name => ({ name, bytes: new Uint8Array([1,2,3,4]) });
test('temporary material only paints chosen geoset, retaining shared animated materials and source model', () => {
  const {model} = createDemoDocument();
  model.Geosets[1].MaterialID = model.Geosets[0].MaterialID;
  const original = structuredClone(model);
  const drafts = beginUVPreview(model, {}, 0, asset('Textures\\Rust.blp'));
  const preview = uvPreviewModel(model, drafts);
  assert.deepEqual(model, original);
  assert.equal(preview.Geosets[1].MaterialID, original.Geosets[1].MaterialID);
  assert.notEqual(preview.Geosets[0].MaterialID, original.Geosets[0].MaterialID);
  assert.equal(preview.Textures.at(-1).Image, 'Textures\\Rust.blp');
  assert.deepEqual(preview.Materials[original.Geosets[0].MaterialID], original.Materials[original.Geosets[0].MaterialID]);
});
test('switching temporary textures and Revert preserve UV edits and the underlying material', () => {
  const {model} = createDemoDocument();
  let drafts = beginUVPreview(model, {}, 0, asset('A.blp'));
  model.Geosets[0].TVertices[0][0] = 9;
  drafts = beginUVPreview(model, drafts, 0, asset('B.blp'));
  model.Info.Name = 'Unrelated edit';
  const originalMaterial = model.Geosets[0].MaterialID;
  revertUVPreviews(model, drafts);
  assert.equal(model.Geosets[0].TVertices[0][0], 9);
  assert.deepEqual(drafts, {});
  assert.equal(model.Geosets[0].MaterialID, originalMaterial);
  assert.equal(model.Info.Name, 'Unrelated edit');
});
test('multiple previews serialize and undo in one transaction, deduplicating case-insensitive paths', () => {
  const doc = createDemoDocument(), originalMaterials = doc.model.Materials.length, originalTextures = doc.model.Textures.length;
  let drafts = beginUVPreview(doc.model, {}, 0, asset('Textures\\Rust.blp'));
  drafts = beginUVPreview(doc.model, drafts, 1, asset('textures/rust.BLP'));
  doc.apply('Save UV previews', ['Geosets','Materials','Textures'], m => applyUVPreviews(m, drafts));
  assert.equal(doc.model.Materials.length, originalMaterials + 2);
  assert.equal(doc.model.Textures.length, originalTextures + 1);
  for (const format of ['mdl','mdx']) {
    const reopened = openDocument(doc.serialize(format), `memory.${format}`);
    assert.equal(reopened.model.Textures.at(-1).Image, 'Textures\\Rust.blp');
    assert.equal(reopened.model.Geosets[1].MaterialID, originalMaterials + 1);
    assert.equal(reopened.diagnostics.filter(d => d.severity === 'error').length, 0);
  }
  doc.undo(); assert.equal(doc.model.Materials.length, originalMaterials);
  assert.equal(doc.model.Textures.length, originalTextures);
});
test('staged model save leaves pending texture and UV recovery untouched when save is cancelled', () => {
  const doc = createDemoDocument(), original = structuredClone(doc.model);
  const pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  doc.apply('Move UV', ['Geosets'], m => { m.Geosets[0].TVertices[0][0] = .37; });
  const envelope = structuredClone({ state: doc.captureRecoveryState(), uvPreviews: pending });
  const staged = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false}));
  staged.apply('Preview', ['Geosets','Materials','Textures'], m => applyUVPreviews(m,pending));
  const bytes = staged.serialize(); // Deliberately only in memory, like a cancelled save dialog.
  assert.ok(bytes.length);
  assert.deepEqual(doc.model.Materials, original.Materials);
  const restored = EditorDocument.restoreRecoveryState(envelope.state);
  const drafts = restoreUVPreviews(restored.model, envelope.uvPreviews);
  assert.equal(restored.model.Geosets[0].TVertices[0][0], Math.fround(.37));
  assert.deepEqual(drafts[0].asset.bytes, pending[0].asset.bytes);
  revertUVPreviews(restored.model, drafts);
  assert.equal(restored.model.Geosets[0].TVertices[0][0], Math.fround(.37));
  assert.deepEqual(drafts, {});
});
test('live dragging changes only preview UV arrays; a texture draft does not depend on the vertex count', () => {
  const {model} = createDemoDocument();
  const uv = new Float32Array(model.Geosets[0].TVertices[0]); uv[0] = 2;
  const preview = uvPreviewModel(model, {}, {geosetIndex:0,uvSet:0,values:uv});
  assert.equal(preview.Geosets[0].TVertices[0][0], 2);
  assert.notEqual(model.Geosets[0].TVertices[0][0], 2);
  assert.equal(preview.Geosets[1], model.Geosets[1]);
  const drafts = beginUVPreview(model, {}, 0, asset('Preview.blp'));
  uncoupleVertices(model.Geosets[0], [0]);
  assert.equal(uvPreviewModel(model, drafts).Textures.at(-1).Image, 'Preview.blp');
  const expected = structuredClone(model);
  revertUVPreviews(model, drafts);
  assert.deepEqual(model, expected);
  assert.deepEqual(drafts, {});
});
test('a staged preview save has identical bytes and a clean target baseline after commit', () => {
  const doc = createDemoDocument(), pending = beginUVPreview(doc.model, {}, 0, asset('SavedPreview.blp'));
  const staged = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({includeHistory:false}));
  staged.apply('Save preview', ['Geosets','Textures','Materials'], m => applyUVPreviews(m,pending));
  const savedBytes = staged.serialize('mdx');
  doc.apply('Save preview', ['Geosets','Textures','Materials'], m => applyUVPreviews(m,pending));
  const committedBytes = doc.serialize('mdx');
  assert.deepEqual(committedBytes, savedBytes);
  doc.markSaved(committedBytes, 'memory.mdx');
  assert.equal(doc.dirty, false);
  doc.undo(); assert.equal(doc.dirty, true);
  doc.redo(); assert.equal(doc.dirty, false);
});

function guardedEdit(doc, pending, operation) {
  const before = captureUVPreviewGuard(doc.model, pending);
  return doc.apply('Guarded edit', ['Geosets', 'GeosetAnims'], model => {
    operation(model); validateUVPreviewGuard(model, pending, before);
  });
}

test('preview permits triangle edits and collapse; Revert preserves UVs and geometry', () => {
  const doc = createDemoDocument(), original = structuredClone(doc.model.Geosets[0]);
  const pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  guardedEdit(doc, pending, model => {
    const g = model.Geosets[0];
    g.TVertices[0][0] = .123;
    collapseVertices(g, [0, 1]);
    for (let i = 0; i < g.Faces.length; i += 3) [g.Faces[i + 1], g.Faces[i + 2]] = [g.Faces[i + 2], g.Faces[i + 1]];
    for (let i = 0; i < g.Normals.length; i++) g.Normals[i] *= -1;
    deleteSelectedFaces(g, Array.from(g.Faces.slice(0, 3)));
  });
  const edited = structuredClone(doc.model.Geosets[0]);
  assert.notDeepEqual(edited.Faces, original.Faces);
  assert.notDeepEqual(edited.Vertices, original.Vertices);
  assert.equal(uvPreviewModel(doc.model, pending).Textures.at(-1).Image, 'Preview.blp');
  const saved = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  saved.apply('Save preview', ['Geosets', 'Textures', 'Materials'], model => applyUVPreviews(model, pending));
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(saved.serialize(format), 'edited.' + format);
    assert.deepEqual(reopened.model.Geosets[0].Faces, edited.Faces);
    assert.deepEqual(reopened.model.Geosets[0].Vertices, edited.Vertices);
    assert.deepEqual(reopened.model.Geosets[0].TVertices, edited.TVertices);
    assert.equal(reopened.model.Textures.at(-1).Image, 'Preview.blp');
  }
  const steps = doc.historyStats.undoSteps;
  revertUVPreviews(doc.model, pending);
  assert.equal(doc.historyStats.undoSteps, steps);
  assert.deepEqual(doc.model.Geosets[0].TVertices, edited.TVertices);
  assert.deepEqual(doc.model.Geosets[0].Faces, edited.Faces);
  assert.deepEqual(doc.model.Geosets[0].Vertices, edited.Vertices);
  assert.deepEqual(doc.model.Geosets[0].Normals, edited.Normals);
  doc.undo(); assert.deepEqual(doc.model.Geosets[0], original);
  doc.redo(); assert.deepEqual(doc.model.Geosets[0], edited);
});

test('preview allows changes to unrelated geosets and undo/redo of their insertion or deletion', () => {
  const doc = createDemoDocument(), pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  guardedEdit(doc, pending, model => { model.Geosets.push(structuredClone(model.Geosets[1])); });
  const travel = redo => {
    const before = captureUVPreviewGuard(doc.model, pending);
    redo ? doc.redo() : doc.undo();
    validateUVPreviewGuard(doc.model, pending, before);
  };
  travel(false); travel(true);
  guardedEdit(doc, pending, model => { model.Geosets[1] = structuredClone(model.Geosets[1]); uncoupleVertices(model.Geosets[1], [0]); });
  guardedEdit(doc, pending, model => deleteGeoset(model, model.Geosets.length - 1));
  travel(false); travel(true);
  assert.equal(uvPreviewModel(doc.model, pending).Textures.at(-1).Image, 'Preview.blp');
  const restored = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  const drafts = restoreUVPreviews(restored.model, pending);
  const unrelated = structuredClone(restored.model.Geosets[1]);
  const expected = structuredClone(restored.model.Geosets[0]);
  revertUVPreviews(restored.model, drafts);
  assert.deepEqual(restored.model.Geosets[1], unrelated);
  assert.deepEqual(restored.model.Geosets[0], expected);
});

test('preview guard only rejects replacing, removing or reindexing its target atomically', () => {
  const doc = createDemoDocument(), pending = beginUVPreview(doc.model, {}, 1, asset('Preview.blp'));
  const expected = structuredClone(doc.model), history = doc.historyStats.undoSteps;
  for (const operation of [
    model => { model.Geosets[1] = structuredClone(model.Geosets[1]); },
    model => deleteGeoset(model, 1),
    model => deleteGeoset(model, 0),
    model => { [model.Geosets[0], model.Geosets[1]] = [model.Geosets[1], model.Geosets[0]]; },
  ]) {
    assert.throws(() => guardedEdit(doc, pending, operation), /Save or Revert|changed .*structure/);
    assert.deepEqual(doc.model, expected);
    assert.equal(doc.historyStats.undoSteps, history);
  }
  assert.equal(captureUVPreviewGuard(doc.model, {}), null);
  assert.doesNotThrow(() => validateUVPreviewGuard({ Geosets: [] }, {}));
});

test('Weld, Uncouple, Delete vertices and Extrude stay editable during texture preview, including undo/redo, Revert and save', () => {
  for (const operation of [
    g => weldSelectedVertices(g, [0, 1]),
    g => uncoupleVertices(g, [0, 1]),
    g => deleteVertices(g, [0]),
    g => extrudeFaces(g, Array.from(g.Faces.slice(0, 3)), [0, 0, 10]),
  ]) {
    const doc = createDemoDocument(), pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
    const original = structuredClone(doc.model);
    guardedEdit(doc, pending, model => { model.Geosets[0].TVertices[0][0] = .31; operation(model.Geosets[0]); });
    const edited = structuredClone(doc.model), guard = captureUVPreviewGuard(doc.model, pending);
    assert.notEqual(edited.Geosets[0].Vertices.length, original.Geosets[0].Vertices.length);
    assert.equal(uvPreviewModel(doc.model, pending).Textures.at(-1).Image, 'Preview.blp');
    doc.undo(); validateUVPreviewGuard(doc.model, pending, guard); assert.deepEqual(doc.model, original);
    doc.redo(); validateUVPreviewGuard(doc.model, pending, guard); assert.deepEqual(doc.model, edited);
    const saved = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
    const recovered = restoreUVPreviews(saved.model, structuredClone(pending));
    saved.apply('Save preview', ['Geosets','Materials','Textures'], m => applyUVPreviews(m, recovered));
    for (const format of ['mdl','mdx']) {
      const reopened = openDocument(saved.serialize(format), 'edited.' + format);
      for (const key of ['Vertices','Faces','TVertices','Normals','VertexGroup']) assert.deepEqual(reopened.model.Geosets[0][key], edited.Geosets[0][key]);
      assert.equal(reopened.model.Textures.at(-1).Image, 'Preview.blp');
    }
    revertUVPreviews(doc.model, pending);
    assert.deepEqual(doc.model, edited);
    assert.deepEqual(pending, {});
  }
});

test('older cached texture previews recover without restoring their stale UV snapshots', () => {
  const doc = createDemoDocument(), original = structuredClone(doc.model.Geosets[0]);
  const pending = beginUVPreview(doc.model, {}, 0, asset('Preview.blp'));
  pending[0].vertexCount = original.Vertices.length / 3;
  pending[0].geosetCount = doc.model.Geosets.length;
  pending[0].faces = original.Faces.slice(); pending[0].originalUV = original.TVertices;
  guardedEdit(doc, pending, model => uncoupleVertices(model.Geosets[0], [0]));
  const restored = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
  const drafts = restoreUVPreviews(restored.model, pending), edited = structuredClone(restored.model);
  assert.deepEqual(drafts[0], {geosetIndex:0, asset:pending[0].asset});
  assert.equal(uvPreviewModel(restored.model, drafts).Textures.at(-1).Image, 'Preview.blp');
  revertUVPreviews(restored.model, drafts);
  assert.deepEqual(restored.model, edited);
});

test('Revert texture can clear a removed target without touching its neighbor', () => {
  const {model} = createDemoDocument(), pending = beginUVPreview(model, {}, 0, asset('Preview.blp'));
  deleteGeoset(model, 0);
  const expected = structuredClone(model);
  revertUVPreviews(model, pending);
  assert.deepEqual(model, expected); assert.deepEqual(pending, {});
});

test('recovery rejects malformed target indices and texture bytes', () => {
  const {model} = createDemoDocument(), pending = beginUVPreview(model, {}, 0, asset('Preview.blp'));
  for (const corrupt of [draft => { draft.geosetIndex = -1; }, draft => { draft.asset.bytes = [1,2,3]; }, draft => { draft.asset.name = ''; }]) {
    const broken = structuredClone(pending); corrupt(broken[0]);
    assert.throws(() => restoreUVPreviews(model, broken), /Invalid cached/);
  }
});

function imageLayerDocument() {
  const doc=createDemoDocument(),model=doc.model;
  model.TextureAnims.push({});
  model.Textures.push({Image:'Textures\\Armor.blp',ReplaceableId:0,Flags:0},{Image:'Textures\\Trim.blp',ReplaceableId:0,Flags:3});
  model.Materials[0].Layers=[
    {TextureID:0,Alpha:1,FilterMode:0,Shading:16,CoordId:0,TVertexAnimId:null},
    {TextureID:1,Alpha:{LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([1])},{Frame:500,Vector:new Float32Array([.5])}]},FilterMode:1,Shading:16,CoordId:0,TVertexAnimId:0},
    {TextureID:2,Alpha:.8,FilterMode:2,Shading:17,CoordId:1,TVertexAnimId:null},
  ];
  model.Geosets[0].MaterialID=0;model.Geosets[1].MaterialID=0;model.Geosets[2].MaterialID=0;
  model.Geosets[0].TVertices.push(new Float32Array(model.Geosets[0].TVertices[0]));
  return doc;
}

test('preview eligibility follows checked geosets, rejects empty/mixed selection, and accepts one shared material',()=>{
  const {model}=imageLayerDocument();
  assert.equal(getUVPreviewSelection(model,[]).enabled,false);
  assert.match(getUVPreviewSelection(model,[]).reason,/Check one geoset/);
  assert.equal(getUVPreviewSelection(model,new Set([0,2])).enabled,true);
  assert.deepEqual(getUVPreviewSelection(model,[0,0,2]).geosetIndices,[0,2]);
  model.Geosets[2].MaterialID=1;
  assert.equal(getUVPreviewSelection(model,[0,2]).enabled,false);
  assert.match(getUVPreviewSelection(model,[0,2]).reason,/different materials/);
  const original=structuredClone(model),drafts={};
  assert.throws(()=>beginUVPreview(model,drafts,[0,2],asset('New.blp'),1),/different materials/);
  assert.throws(()=>beginUVPreview(model,drafts,[],asset('New.blp'),1),/Check one geoset/);
  assert.deepEqual(drafts,{});assert.deepEqual(model,original);
});

test('temporary texture replacement affects only checked geosets, retains team colour and resets the image chain',()=>{
  const {model}=imageLayerDocument(),original=structuredClone(model);
  const drafts=beginUVPreview(model,{},[0,2],asset('Textures\\Rust.blp'),2);
  assert.deepEqual(Object.keys(drafts),['0','2']);assert.equal(drafts[0].layerIndex,undefined);
  const preview=uvPreviewModel(model,drafts);
  assert.equal(preview.Geosets[0].MaterialID,preview.Geosets[2].MaterialID);
  for(const index of [0,2]){
    const layers=preview.Materials[preview.Geosets[index].MaterialID].Layers;
    assert.equal(layers.length,2);
    assert.deepEqual(layers[0],original.Materials[0].Layers[0]);
    assert.deepEqual(layers[1],{FilterMode:1,Alpha:1,Shading:0,CoordId:0,TextureID:preview.Textures.length-1,TVertexAnimId:null});
    assert.equal(preview.Textures[layers[1].TextureID].Image,'Textures\\Rust.blp');
  }
  assert.equal(preview.Geosets[1],model.Geosets[1]);assert.equal(preview.Geosets[1].MaterialID,0);
  assert.deepEqual(preview.Materials[0],original.Materials[0]);assert.deepEqual(model,original);
});

test('UV image chooser skips replaceable layers and samples individual texture animation keys',()=>{
  const {model}=imageLayerDocument();
  assert.deepEqual(imageTextureLayers(model,0).map(layer=>layer.layerIndex),[1,2]);
  assert.equal(chooseUVImageLayer(model,0,0).layerIndex,1);
  assert.equal(chooseUVImageLayer(model,0,2).coordId,1);
  assert.equal(chooseUVImageLayer(model,0,2).path,'Textures\\Trim.blp');
  model.Materials[0].Layers[1].TextureID={LineType:0,Keys:[{Frame:0,Vector:new Uint32Array([1])},{Frame:400,Vector:new Uint32Array([0])},{Frame:600,Vector:new Uint32Array([2])}]};
  assert.equal(chooseUVImageLayer(model,0,1,200).path,'Textures\\Armor.blp');
  assert.equal(chooseUVImageLayer(model,0,1,450).layerIndex,2);
  assert.equal(chooseUVImageLayer(model,0,1,700).path,'Textures\\Trim.blp');
});

test('a replaceable-only material receives a new image layer instead of losing team colour',()=>{
  const {model}=createDemoDocument(),original=structuredClone(model.Materials[0].Layers);
  const pending=beginUVPreview(model,{},[0],asset('New.blp'));
  assert.equal(pending[0].layerIndex,undefined);
  const preview=uvPreviewModel(model,pending),layers=preview.Materials[preview.Geosets[0].MaterialID].Layers;
  assert.deepEqual(layers.slice(0,original.length),original);
  assert.equal(layers.length,original.length+1);assert.equal(layers.at(-1).FilterMode,1);
  assert.equal(chooseUVImageLayer(preview,0).path,'New.blp');
});

test('checked preview switches preserve UV edits through recovery and commit one clean image layer',()=>{
  const doc=imageLayerDocument(),model=doc.model,original=structuredClone(model);
  let drafts=beginUVPreview(model,{},[0,2],asset('First.blp'),1);
  model.Geosets[0].TVertices[0][0]=.73;model.Geosets[2].TVertices[0][0]=.42;
  drafts=beginUVPreview(model,drafts,[0,2],asset('Second.blp'),2);
  const restored=restoreUVPreviews(model,structuredClone(drafts));
  assert.equal(restored[0].layerIndex,undefined);
  const reverted=structuredClone(model);revertUVPreviews(reverted,structuredClone(restored));
  for(const index of [0,2])assert.deepEqual(reverted.Geosets[index].TVertices,model.Geosets[index].TVertices);
  assert.deepEqual(reverted.Materials,original.Materials);assert.deepEqual(reverted.Textures,original.Textures);
  doc.apply('Save checked previews',['Geosets','Materials','Textures'],m=>applyUVPreviews(m,restored));
  assert.equal(model.Geosets[1].MaterialID,0);
  assert.equal(model.Geosets[0].MaterialID,model.Geosets[2].MaterialID);
  assert.equal(getUVPreviewSelection(model,[0,2]).enabled,true);
  for(const index of [0,2]){
    const layers=model.Materials[model.Geosets[index].MaterialID].Layers;
    assert.equal(layers.length,2);assert.deepEqual(layers[0],original.Materials[0].Layers[0]);
    assert.equal(model.Textures[layers[1].TextureID].Image,'Second.blp');
  }
});

test('three-layer modular texture tracks are fully replaced while procedural layers survive',()=>{
  const doc=imageLayerDocument();doc.apply('Modular fixture',['Materials'],model=>{
    model.Materials[0].Layers[1].TextureID={LineType:0,GlobalSeqId:null,Keys:[
      {Frame:0,Vector:new Uint32Array([1])},{Frame:500,Vector:new Uint32Array([2])},
    ]};
    model.Materials[0].Layers.push({TextureID:2,Alpha:.35,FilterMode:3,Shading:4,CoordId:1,TVertexAnimId:null});
  });
  const model=doc.model;
  const original=structuredClone(model),before=doc.serialize('mdx'),drafts=beginUVPreview(model,{},[0],asset('Textures\\Clean.blp'));
  const check=value=>{const layers=value.Materials[value.Geosets[0].MaterialID].Layers;assert.equal(layers.length,2);assert.equal(value.Textures[layers[0].TextureID].ReplaceableId,1);assert.equal(value.Textures[layers[1].TextureID].Image,'Textures\\Clean.blp');};
  check(uvPreviewModel(model,drafts));assert.deepEqual(doc.serialize('mdx'),before);
  doc.apply('Replace modular chain',['Geosets','Materials','Textures'],value=>applyUVPreviews(value,drafts));check(model);
  assert.deepEqual(model.Materials[0].Layers,original.Materials[0].Layers);assert.equal(model.Geosets[1].MaterialID,0);
  check(openDocument(doc.serialize('mdx'),'modular.mdx').model);
  doc.undo();assert.deepEqual(doc.serialize('mdx'),before);
});
