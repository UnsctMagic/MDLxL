import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {createPaintProject,compositePaintTarget} from '../src/paint-project.js';
import {createPaintMaterial,paintableGeosets,repairPaintMaterials} from '../src/paint-materials.js';
import {createPaintRaster} from '../src/paint-raster.js';
import {preparePaintModelCommit,commitPaintModel,adoptCommittedPaintUVs,adoptCommittedPaintMaterials} from '../src/paint-model-integration.js';
import {addPaintProjectTarget,readStoredZip} from '../src/paint-project.js';
import {enablePaintMaterials,assignPaintMaterial,validatePaintAssignments} from '../src/paint-materials.js';
import {enumeratePaintTargets} from '../src/paint-targets.js';
import {buildPaintExportArtifact} from '../src/paint-export.js';
import {paintProjectModel} from '../src/paint-view.js';
import {retainedForgeAssets,missingForgeAssetPaths} from '../src/forge-assets.js';
import {decodePaintBlp} from '../src/paint-blp.js';
const {saveForgeAssets}=createRequire(import.meta.url)('../electron/forge-assets.cjs');
function fixture(){
  const doc=createDemoDocument(),model=doc.model;
  const body=model.Geosets[0];
  model.Textures.push({Image:'',ReplaceableId:1,Flags:0},{Image:'',ReplaceableId:2,Flags:0});
  const team=model.Textures.length-2,glow=team+1;
  model.Materials[body.MaterialID].Layers=[{FilterMode:1,Shading:17,TextureID:team,Alpha:1,CoordId:0},{FilterMode:2,Shading:16,TextureID:0,Alpha:1,CoordId:0}];
  model.Textures[0]={Image:'Body.blp',ReplaceableId:0,Flags:3};
  model.Materials.push({Layers:[{FilterMode:0,Shading:1,TextureID:glow,Alpha:1,CoordId:0}]});
  model.Geosets.push({...structuredClone(body),MaterialID:model.Materials.length-1});
  return {doc,model};
}
test('primer never adopts transparent team-colour overlay or exposes replaceable helper plane',()=>{
  const {model}=fixture(),original=structuredClone(model),project=createPaintProject({sourceMode:'primer'}),geosets=paintableGeosets(model);
  assert.ok(!geosets.includes(model.Geosets.length-1));
  const target=createPaintMaterial(project,model,{raster:createPaintRaster(256,256,[90,100,120,255]),geosets});
  assert.equal(target.material.Layers[0].FilterMode,0);assert.equal(target.flags,3);
  const painted=paintProjectModel(model,project);assert.deepEqual(painted.Geosets.at(-1),original.Geosets.at(-1));assert.deepEqual(model,original);
});
test('repair preserves every saved paint pixel and restores helpers even from an already remapped working model',()=>{
  const {model}=fixture(),project=createPaintProject({sourceMode:'primer'}),last=model.Geosets.length-1;
  const target=createPaintMaterial(project,model,{raster:createPaintRaster(256,256,[90,100,120,255]),geosets:model.Geosets.map((_,i)=>i)});
  target.material.Layers[0].FilterMode=2;target.flags=0;
  const broken=paintProjectModel(model,project),before=compositePaintTarget(project);
  assert.equal(repairPaintMaterials(project,model),true);assert.equal(repairPaintMaterials(project,model),false);
  const repaired=paintProjectModel(broken,project,model);
  assert.equal(repaired.Geosets[last].MaterialID,model.Geosets[last].MaterialID);
  assert.ok(!target.geosetIndices.includes(last));assert.equal(target.flags,3);assert.equal(target.material.Layers[0].FilterMode,0);assert.deepEqual(compositePaintTarget(project),before);
});
test('paint -> Vertices -> save/reopen -> paint retains BLP pixels, one material assignment and editable coats',async()=>{
  const doc=createDemoDocument(),original=structuredClone(doc.model),project=createPaintProject({sourceMode:'primer'});
  const target=createPaintMaterial(project,doc.model,{name:'FootmanCitadel',raster:createPaintRaster(256,256,[42,190,67,255]),geosets:paintableGeosets(doc.model)});
  repairPaintMaterials(project,original);
  const first=await preparePaintModelCommit(doc.model,project,original);commitPaintModel(doc,first);
  const assets=new Map(first.assets.map(a=>[a.name.replaceAll('/','\\').toLowerCase(),a]));
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'citadel-model-roundtrip-'));
  try{
    const file=path.join(root,'Painted.mdx'),kept=retainedForgeAssets(assets,doc.model);
    assert.equal(kept.length,1);await saveForgeAssets(file,kept);await fs.writeFile(file,doc.serialize('mdx'));
    const reopened=openDocument(await fs.readFile(file),'Painted.mdx'),binding=target.bindings[0],layers=reopened.model.Materials[reopened.model.Geosets[binding.geosetIndex].MaterialID].Layers;
    assert.equal(layers.length,1);const name=reopened.model.Textures[layers[0].TextureID].Image;
    const decoded=await decodePaintBlp(await fs.readFile(path.join(root,name.replaceAll('\\','/'))));
    assert.ok(Math.abs(decoded.data[0]-42)<8&&Math.abs(decoded.data[1]-190)<8);assert.equal(decoded.data[3],255);
    assert.deepEqual(missingForgeAssetPaths(assets,reopened.model),[]);
    const again=await preparePaintModelCommit(reopened.model,project,original);assert.equal(again.assets[0].name,first.assets[0].name,'returning must not allocate different texture identities');
    target.coats[0].raster.data.set([220,45,20,255],0);target.revision=(target.revision||0)+1;const second=await preparePaintModelCommit(reopened.model,project,original);assert.notEqual(second.assets[0].name,first.assets[0].name);assert.ok(target.coats.length>0);
    const before=doc.serialize('mdx');await assert.rejects(preparePaintModelCommit(doc.model,project,original,{encode:async()=>{throw Error('encoder failed');}}),/encoder failed/);assert.deepEqual(doc.serialize('mdx'),before);
    assert.equal(doc.undo(),true);assert.deepEqual(doc.model,original);assert.equal(doc.redo(),true);
  }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));await fs.rm(root,{recursive:true,force:true});}
});
test('adopting applied UV0 allows later main-editor UV and vertex edits to survive returning to Citadel',async()=>{
  const doc=createDemoDocument(),original=structuredClone(doc.model),project=createPaintProject({sourceMode:'primer'}),geo=doc.model.Geosets[0];
  geo.TVertices.push(new Float32Array(geo.TVertices[0]));doc.model.Materials[geo.MaterialID].Layers[0].CoordId=1;
  const target=createPaintMaterial(project,doc.model,{raster:createPaintRaster(256,256,[42,190,67,255]),geosets:[0]});
  project.uvEdits['0:0']=Array.from(geo.TVertices[1],v=>v*.8);
  const first=await preparePaintModelCommit(doc.model,project,original);commitPaintModel(doc,first);adoptCommittedPaintUVs(project);
  assert.equal(target.bindings[0].sourceCoordId,0);assert.deepEqual(project.uvEdits,{});
  doc.apply('Edit vertex and UV',['Geosets'],m=>{m.Geosets[0].Vertices[0]+=3;m.Geosets[0].TVertices[0][0]=.314;});
  const returned=paintProjectModel(structuredClone(doc.model),project,original);
  assert.equal(returned.Geosets[0].Vertices[0],doc.model.Geosets[0].Vertices[0]);assert.equal(returned.Geosets[0].TVertices[0][0],doc.model.Geosets[0].TVertices[0][0]);
});

// Edit the texture: only skins whose pixels changed become new files.
function skinDocument(){
  const doc=createDemoDocument(),layer=(TextureID,extra={})=>({Alpha:1,TVertexAnimId:null,Shading:16,CoordId:0,FilterMode:0,TextureID,...extra});
  doc.apply('Skins',['Textures','Materials','Geosets'],m=>{
    m.Textures=[{Image:'',ReplaceableId:1,Flags:0},{Image:'Textures\\Body.blp',ReplaceableId:0,Flags:0},{Image:'Textures\\Cape.blp',ReplaceableId:0,Flags:0}];
    m.Materials=[{PriorityPlane:0,RenderMode:0,Layers:[layer(1)]},{PriorityPlane:0,RenderMode:0,Layers:[layer(2,{FilterMode:1})]},{PriorityPlane:0,RenderMode:0,Layers:[layer(1,{Shading:0})]},m.Materials[3]];
    [0,0,1,2,3].forEach((id,i)=>{m.Geosets[i].MaterialID=id;});
  });
  return doc;
}
function editTexture(model){const project=createPaintProject({sourceMode:'current'});project.preserveMaterials=true;for(const target of enumeratePaintTargets(model))addPaintProjectTarget(project,target,createPaintRaster(8,8,[90,90,90,255]));enablePaintMaterials(project,model);return project;}
const paintStroke=target=>{target.coats[0].raster.data.set([200,30,30,255],0);target.revision=(target.revision||0)+1;};
function unusedEntries(model){
  const materials=new Set([...model.Geosets,...(model.RibbonEmitters||[])].map(owner=>owner.MaterialID)),textures=new Set([...model.Materials.flatMap(m=>m.Layers.map(l=>l.TextureID)),...(model.ParticleEmitters2||[]).map(e=>e.TextureID)]);
  return {materials:model.Materials.map((_,i)=>i).filter(i=>!materials.has(i)),textures:model.Textures.map((_,i)=>i).filter(i=>!textures.has(i))};
}
const stubDocument=model=>({model:structuredClone(model),apply(label,sections,mutate){this.sections=sections;mutate(this.model);}});

test('Edit the texture saves only the painted skin; the untouched skin keeps its path, entry and material',async()=>{
  const doc=skinDocument(),before=structuredClone(doc.model),project=editTexture(doc.model),[body,cape]=project.targets;
  assert.deepEqual([body.texturePath,cape.texturePath],['Textures\\Body.blp','Textures\\Cape.blp']);
  paintStroke(body);
  const prepared=await preparePaintModelCommit(doc.model,project,before);commitPaintModel(doc,prepared);
  assert.equal(prepared.assets.length,1);assert.match(prepared.assets[0].name,/^MDLxL_Citadel\/Body_[0-9a-f]+\.blp$/);
  // Body was only used by painted parts: its materials are edited in place and the new file takes its entry.
  assert.deepEqual(doc.model.Textures,[before.Textures[0],{...before.Textures[1],Image:prepared.assets[0].name.replaceAll('/','\\')},before.Textures[2]]);
  assert.deepEqual(doc.model.Materials,before.Materials);assert.deepEqual(doc.model.Geosets.map(g=>g.MaterialID),[0,0,1,2,3]);
  assert.deepEqual(unusedEntries(doc.model),{materials:[],textures:[]});
});

test('leaving Edit the texture unpainted, or with every stroke undone, keeps the model exactly',async()=>{
  const doc=skinDocument(),before=structuredClone(doc.model),project=editTexture(doc.model),[body]=project.targets;
  const untouched=await preparePaintModelCommit(doc.model,project,before);
  assert.deepEqual(untouched.assets,[]);assert.deepEqual(untouched.model.Textures,before.Textures);assert.deepEqual(untouched.model.Materials,before.Materials);assert.deepEqual(untouched.model.Geosets.map(g=>g.MaterialID),before.Geosets.map(g=>g.MaterialID));
  paintStroke(body);body.coats[0].raster.data.fill(0);body.revision++;
  const undone=await preparePaintModelCommit(doc.model,project,before);assert.deepEqual(undone.assets,[]);assert.deepEqual(undone.model.Textures,before.Textures);assert.deepEqual(undone.model.Materials,before.Materials);
});

test('a material an unpainted part shares is copied, and only for the painted parts',async()=>{
  const doc=skinDocument(),model={...structuredClone(doc.model),RibbonEmitters:[{MaterialID:0}],ParticleEmitters2:[{TextureID:1}]},before=structuredClone(model),project=editTexture(model);
  paintStroke(project.targets[0]);
  const {model:out,assets}=await preparePaintModelCommit(model,project,before),citadel=assets[0].name.replaceAll('/','\\');
  assert.deepEqual(model,before,'the working model is never changed');
  assert.deepEqual(out.Materials.slice(0,2),before.Materials.slice(0,2));assert.equal(out.RibbonEmitters[0].MaterialID,0);assert.equal(out.Textures[out.ParticleEmitters2[0].TextureID].Image,'Textures\\Body.blp');
  assert.equal(out.Materials.length,before.Materials.length+1);assert.deepEqual(out.Geosets.map(g=>g.MaterialID),[4,4,1,2,3]);
  assert.equal(out.Textures[out.Materials[4].Layers[0].TextureID].Image,citadel);assert.equal(out.Textures[out.Materials[2].Layers[0].TextureID].Image,citadel);assert.equal(out.Materials[2].Layers[0].Shading,0);
  assert.equal(out.Textures.length,before.Textures.length+1);assert.deepEqual(unusedEntries(out),{materials:[],textures:[]});
  // Returning to Paint moves the painting slots past the settled model, undo snapshots included.
  const stub=stubDocument(model);commitPaintModel(stub,{model:out,assets});
  project.history.undo.push({kind:'surface',before:{target:structuredClone(project.targets[0])},after:{targets:[structuredClone(project.targets[0])]}});
  assert.equal(adoptCommittedPaintMaterials(project,stub.model),true);validatePaintAssignments(project,stub.model);
  assert.equal(project.targets[0].textureId,stub.model.Textures.length);assert.equal(project.preservedMaterials[0].materialId,stub.model.Materials.length);
  for(const snapshot of [project.history.undo[0].before.target,project.history.undo[0].after.targets[0]])assert.deepEqual([snapshot.textureId,snapshot.bindings],[project.targets[0].textureId,project.targets[0].bindings]);
  const again=await preparePaintModelCommit(stub.model,project,before);assert.equal(again.assets[0].name,assets[0].name);assert.deepEqual(again.model.Materials,stub.model.Materials);assert.deepEqual(again.model.Textures,stub.model.Textures);
});

test('releasing a skin nothing shows any more renumbers emitter textures in the document',async()=>{
  const doc=skinDocument(),model={...structuredClone(doc.model),ParticleEmitters2:[{TextureID:2}]},before=structuredClone(model),project=editTexture(model),[body,cape]=project.targets;
  assignPaintMaterial(project,model,cape.id,body.geosetIndices);
  const prepared=await preparePaintModelCommit(model,project,before);assert.deepEqual(prepared.assets,[]);
  assert.deepEqual(prepared.model.Textures,[before.Textures[0],before.Textures[2]]);assert.deepEqual(unusedEntries(prepared.model),{materials:[],textures:[]});
  const stub=stubDocument(model);commitPaintModel(stub,prepared);
  assert.ok(stub.sections.includes('ParticleEmitters2'));assert.equal(stub.model.ParticleEmitters2[0].TextureID,1);
});

test('Apply, return and undo every stroke restores the original skin with no Citadel leftovers',async()=>{
  const doc=skinDocument(),before=structuredClone(doc.model),project=editTexture(doc.model),[body]=project.targets;
  paintStroke(body);commitPaintModel(doc,await preparePaintModelCommit(doc.model,project,before));adoptCommittedPaintMaterials(project,doc.model);
  body.coats[0].raster.data.fill(0);body.revision++;
  const prepared=await preparePaintModelCommit(doc.model,project,before);commitPaintModel(doc,prepared);
  assert.deepEqual(prepared.assets,[]);assert.deepEqual(doc.model.Textures,before.Textures);assert.deepEqual(doc.model.Materials,before.Materials);assert.deepEqual(unusedEntries(doc.model),{materials:[],textures:[]});
});

test('export packs only edited skins, never under a path the model already uses',async()=>{
  const doc=skinDocument(),project=editTexture(doc.model);paintStroke(project.targets[0]);
  const result=await buildPaintExportArtifact(doc,project,new Map(),doc.serialize('mdx')),files=readStoredZip(new Uint8Array(await result.archive.arrayBuffer())),exported=openDocument(files.get(result.modelName),result.modelName).model;
  assert.deepEqual(result.textures.map(t=>t.name),['Textures/BodyCitadel.blp']);assert.ok(files.has('Textures/BodyCitadel.blp'));
  assert.deepEqual(exported.Textures.map(t=>t.Image),['','Textures\\BodyCitadel.blp','Textures\\Cape.blp']);assert.equal(exported.Materials.length,doc.model.Materials.length);
  assert.deepEqual(unusedEntries(exported),{materials:[],textures:[]});
});
