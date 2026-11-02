import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument,openDocument,validateModel} from '../src/editor-document.js';
import {SURFACE_EFFECTS,defaultEffectOptions,applySurfaceEffect,prepareSurfacePackage,EFFECT_SECTIONS} from '../src/surface-effects.js';
import {sampleTrack,sampleNodeMatrices,skinGeoset} from '../src/animation.js';
const recipe=id=>SURFACE_EFFECTS.find(e=>e.id===id);
function animatedSource(){
 const model=structuredClone(createDemoDocument().model);
 model.GlobalSequences=[1000];
 model.Textures=[{Image:'Textures\\Lords0000.blp',ReplaceableId:0,Flags:0},{Image:'Textures\\Lords0001.blp',ReplaceableId:0,Flags:0}];
 model.Materials=[{PriorityPlane:0,RenderMode:0,Layers:[{FilterMode:2,Shading:1,CoordId:0,Alpha:1,TVertexAnimId:null,TextureID:{GlobalSeqId:0,LineType:0,Keys:[{Frame:0,Vector:new Int32Array([0])},{Frame:500,Vector:new Int32Array([1])}]}}]}];
 return model;
}
test('overlay isolates shared material consumers and repeated application reuses resources',()=>{
 const doc=createDemoDocument(),source=animatedSource(),effect=recipe('water'),options=defaultEffectOptions(effect);
 doc.model.Geosets.push(structuredClone(doc.model.Geosets[0]));
 const before=structuredClone(doc.model.Geosets[1]),material=structuredClone(doc.model.Materials[before.MaterialID]);
 applySurfaceEffect(doc.model,source,effect,options);
 assert.deepEqual(doc.model.Geosets[1],before);assert.deepEqual(doc.model.Materials[before.MaterialID],material);
 const counts=()=>['Textures','Materials','TextureAnims','GlobalSequences'].map(k=>doc.model[k].length),once=counts();
 applySurfaceEffect(doc.model,source,effect,options);assert.deepEqual(counts(),once);
});
test('speed changes only imported timing and keeps animated texture IDs valid after roundtrip',()=>{
 const doc=createDemoDocument(),source=animatedSource(),effect=recipe('water'),before=structuredClone(doc.model);
 doc.apply('Water',EFFECT_SECTIONS,m=>applySurfaceEffect(m,source,effect,{...defaultEffectOptions(effect),mode:'replace',speed:2}));
 assert.deepEqual(doc.model.Sequences,before.Sequences);assert.deepEqual(doc.model.Bones,before.Bones);
 const reopened=openDocument(doc.serialize('mdx'),'water.mdx').model,layer=reopened.Materials[reopened.Geosets[0].MaterialID].Layers[0];
 assert.equal(reopened.GlobalSequences[layer.TextureID.GlobalSeqId],500);
 const texture=sampleTrack(layer.TextureID,260,{globalSequences:reopened.GlobalSequences});
 assert.equal(reopened.Textures[texture].Image,'Textures\\Lords0001.blp');
 assert.deepEqual(source.GlobalSequences,[1000]);
 doc.undo();assert.deepEqual(doc.model,before);
});
test('new copied shape retains bone weights and ordinary Death visibility',()=>{
 const doc=createDemoDocument(),effect=recipe('energy');
 const alpha={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([1])},{Frame:900,Vector:new Float32Array([0])}]};
 doc.model.GeosetAnims.find(a=>a.GeosetId===0).Alpha=alpha;
 const result=applySurfaceEffect(doc.model,null,effect,{...defaultEffectOptions(effect),mode:'new',pulse:.7});
 assert.deepEqual(doc.model.Geosets[result.geoset].Groups,doc.model.Geosets[0].Groups);
 assert.deepEqual(doc.model.Geosets[result.geoset].VertexGroup,doc.model.Geosets[0].VertexGroup);
 assert.deepEqual(doc.model.GeosetAnims.find(a=>a.GeosetId===result.geoset).Alpha,alpha);
 const layer=doc.model.Materials[doc.model.Geosets[result.geoset].MaterialID].Layers[0];
 assert.ok(layer.Alpha.GlobalSeqId>=0);
});
test('atlas overlay leaves original UV mapping untouched',()=>{
 const doc=createDemoDocument(),source=animatedSource(),uv=structuredClone(doc.model.Geosets[0].TVertices[0]),effect=recipe('fire');
 applySurfaceEffect(doc.model,source,effect,defaultEffectOptions(effect));
 assert.deepEqual(doc.model.Geosets[0].TVertices[0],uv);
 const layers=doc.model.Materials[doc.model.Geosets[0].MaterialID].Layers;
 assert.equal(layers.at(-1).CoordId,1);assert.equal(doc.model.Geosets[0].TVertices.length,2);
});
test('RGB pulse survives native colour channel serialization',()=>{
 const doc=createDemoDocument(),effect=recipe('tint'),options={...defaultEffectOptions(effect),tint:[.2,.4,.8]};
 doc.apply('Tint',EFFECT_SECTIONS,m=>applySurfaceEffect(m,null,effect,options));
 const reopened=openDocument(doc.serialize('mdx'),'rgb.mdx').model,colour=reopened.GeosetAnims.find(a=>a.GeosetId===0).Color;
 const atPeak=sampleTrack(colour,1000,{globalSequences:reopened.GlobalSequences,fallback:[1,1,1]});
 for(let i=0;i<3;i++)assert.ok(Math.abs(atPeak[i]-options.tint[i])<1e-6);
 assert.deepEqual(validateModel(reopened).filter(issue=>issue.severity==='error'),[]);
});


test('the native material package holds all animated textures and leaves out the donor rig',()=>{
 const donor=animatedSource(),pack=prepareSurfacePackage(donor,recipe('water'));
 assert.equal(pack.Materials.length,1);assert.equal(pack.Textures.length,2);
 assert.deepEqual(pack.GlobalSequences,[1000]);assert.equal(pack.Geosets.length,0);
 assert.equal(pack.Nodes.length,0);assert.equal(pack.Sequences.length,0);
});

test('FX sliders rebuild the preview on release only',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../app/GlobalAnimationControls.jsx',import.meta.url),'utf8');
 const sliders=source.match(/<RangeField\b.*?\/>/gs);
 assert.equal(sliders.length,1,'the unified layer UI owns one shared Intensity range');
 for(const slider of sliders)assert.ok(slider.includes('onCommit=')&&!slider.includes('onChange='),'FX RangeField uses onCommit');
});

test('attached accent placement survives MDX without adding helpers or changing the selected geometry',()=>{
 const doc=openDocument(createDemoDocument().serialize('mdx'),'source.mdx'),before=structuredClone(doc.model),e=recipe('moon-orbit');
 const options={...defaultEffectOptions(e),placement:{offset:[9,-4,12],size:1.5}};
 const result=applySurfaceEffect(doc.model,null,e,options);
 const saved=openDocument(doc.serialize('mdx'),'orbit.mdx').model;
 assert.deepEqual(saved.Geosets[0].Vertices,before.Geosets[0].Vertices);assert.deepEqual(saved.Helpers,before.Helpers);
 for(const id of result.accents.ids){assert.deepEqual(saved.Nodes[id].PivotPoint,doc.model.Nodes[id].PivotPoint);assert.deepEqual(saved.Nodes[id].Translation,doc.model.Nodes[id].Translation);}
});
test('existing surfaces can receive a tint or overlay with bind poses',()=>{
 const model=createDemoDocument().model;model.BindPoses=[{Matrices:[]}];
 for(const id of ['tint','energy'])applySurfaceEffect(model,null,recipe(id),defaultEffectOptions(recipe(id)));
 assert.throws(()=>applySurfaceEffect(model,null,recipe('energy'),{...defaultEffectOptions(recipe('energy')),mode:'new'}),/bind-pose/);
});

test('Visibility pulse uses geoset alpha when available and keeps an existing animated visibility gate',()=>{
 const e=recipe('fade'),opts=defaultEffectOptions(e),doc=createDemoDocument(),m=doc.model;
 const materials=m.Materials.length,mat=m.Geosets[0].MaterialID;
 const animation=m.GeosetAnims.find(a=>a.GeosetId===0);
 applySurfaceEffect(m,null,e,opts);
 assert.ok(Number.isInteger(animation.Alpha?.GlobalSeqId),'The visibility loop belongs to the geoset');
 assert.equal(m.Materials.length,materials);assert.equal(m.Geosets[0].MaterialID,mat);
 const death={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([1])},{Frame:900,Vector:new Float32Array([0])}]};
 animation.Alpha=structuredClone(death);applySurfaceEffect(m,null,e,opts);
 assert.deepEqual(animation.Alpha,death);
 assert.ok(Number.isInteger(m.Materials[m.Geosets[0].MaterialID].Layers[0].Alpha.GlobalSeqId));
});

test('terrain overlays reuse a matching texture regardless of its existing wrap flags',()=>{
  for(const flags of [0,1,2,3]){
    const m=createDemoDocument().model,e=recipe('lava');
    m.Textures.push({Image:e.texture.toUpperCase(),ReplaceableId:0,Flags:flags});
    const count=m.Textures.length;
    applySurfaceEffect(m,null,e,defaultEffectOptions(e));
    const layer=m.Materials[m.Geosets[0].MaterialID].Layers.at(-1);
    assert.equal(m.Textures.length,count);assert.equal(m.Textures[layer.TextureID].Flags,flags);
  }
});
