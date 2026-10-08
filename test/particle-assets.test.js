import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {createStarterRecipe,starterTextureAsset,STARTER_TEXTURE} from '../src/particle-starters.js';
import {prepareParticlePlacementAssets,includeParticleAssets,embeddedParticleAssets} from '../src/particle-assets.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
import {placeParticleRecipe,particleRecipeDocument} from '../src/particle-recipes.js';
import {retainedForgeAssets,missingForgeAssetPaths} from '../src/forge-assets.js';
const key=name=>name.replaceAll('/','\\').toLowerCase();
const {saveForgeAssets}=createRequire(import.meta.url)('../electron/forge-assets.cjs');
const modifiedAsset=()=>{const asset=starterTextureAsset();asset.bytes=asset.bytes.slice();asset.bytes[20]=123;return asset;};

test('conflicting library pictures keep their authored path and the target asset',async()=>{
 const fixture=createDemoDocument(),recipe=createStarterRecipe(),original=structuredClone(recipe),asset=starterTextureAsset(),existing=modifiedAsset();
 fixture.model.Textures[0]={Image:STARTER_TEXTURE,ReplaceableId:0,Flags:0};
 const doc=openDocument(fixture.serialize('mdx'),'target.mdx');
 const target=new Map([[key(STARTER_TEXTURE),existing]]),incoming=new Map([[key(STARTER_TEXTURE),asset]]),before=structuredClone(doc.model);
 const prepared=await prepareParticlePlacementAssets(recipe,incoming,target),name=prepared.recipe.native.Textures[0].Image;
 assert.equal(name,STARTER_TEXTURE);assert.equal(prepared.recipe,recipe);assert.equal(prepared.assets.size,0);
 assert.deepEqual(recipe,original);assert.deepEqual(target.get(key(STARTER_TEXTURE)),existing);
 assert.equal(prepared.recipe.dependencies[0].path,STARTER_TEXTURE);
 const [start]=doc.model.Sequences[0].Interval;let result;
 doc.apply('Add effect',['Nodes','PivotPoints','Textures','Materials','TextureAnims','GlobalSequences'],m=>{result=placeTimedParticleRecipe(m,prepared.recipe,{sequence:0,from:start+100,to:start+400,parent:'',position:[2,3,4],fit:true,motion:'source'});});
 assert.equal(doc.model.Textures[0].Image,STARTER_TEXTURE);
 assert.equal(doc.model.Textures[doc.model.Nodes[result.ids[0]].TextureID].Image,name);
 assert.deepEqual(doc.model.Geosets,before.Geosets);assert.deepEqual(doc.model.Materials,before.Materials);
 const assets=new Map([...target,...prepared.assets]);assert.deepEqual(missingForgeAssetPaths(assets,doc.model),[]);
 const directory=path.resolve('out/particle-prototype/collision-save-'+Date.now()),filename=path.join(directory,'target.mdx');await fs.mkdir(directory,{recursive:true});
 await saveForgeAssets(filename,retainedForgeAssets(assets,doc.model));
 assert.deepEqual(new Uint8Array(await fs.readFile(path.join(directory,...STARTER_TEXTURE.split('\\')))),existing.bytes);
 for(const format of ['mdx','mdl']){const reopened=openDocument(doc.serialize(format),'placed.'+format);assert.equal(reopened.model.Textures[reopened.model.ParticleEmitters2.at(-1).TextureID].Image,name);}
 const repeated=await prepareParticlePlacementAssets(recipe,incoming,assets);assert.equal(repeated.recipe.native.Textures[0].Image,STARTER_TEXTURE);assert.equal(repeated.assets.size,0);
 assert.equal(doc.historyStats.undoSteps,1);doc.undo();assert.deepEqual(doc.model,before);doc.redo();assert.equal(doc.model.Textures.at(-1).Image,name);
});

test('identical pictures and unused conflicting assets keep original paths and target metadata',async()=>{
 const recipe=createStarterRecipe(),asset=starterTextureAsset(),existing={...asset,source:'parts'},incoming=new Map([[key(STARTER_TEXTURE),asset],['unused.blp',{name:'unused.blp',bytes:new Uint8Array([2])}]]);
 const prepared=await prepareParticlePlacementAssets(recipe,incoming,new Map([[key(STARTER_TEXTURE).replaceAll('\\','/').toUpperCase(),existing],['unused.blp',{bytes:new Uint8Array([1])}]]));
 assert.equal(prepared.recipe,recipe);assert.equal(prepared.assets.size,0);assert.equal(existing.source,'parts');
});

test('ribbon ingredients keep the library texture path through insertion',async()=>{
 const recipe=createStarterRecipe('ribbon'),asset=starterTextureAsset();
 const target=particleRecipeDocument(createStarterRecipe()),before=structuredClone(target.model),assets=new Map([[key(STARTER_TEXTURE),modifiedAsset()]]);
 const prepared=await prepareParticlePlacementAssets(recipe,new Map([[key(STARTER_TEXTURE),asset]]),assets),name=prepared.recipe.native.Textures[0].Image;
 assert.equal(name,STARTER_TEXTURE);assert.equal(prepared.assets.size,0);
 const result=placeParticleRecipe(target.model,prepared.recipe),ribbon=target.model.Nodes[result.ids[0]],material=target.model.Materials[ribbon.MaterialID];
 assert.equal(target.model.Textures[material.Layers[0].TextureID].Image,name);
 assert.deepEqual(target.model.ParticleEmitters2,before.ParticleEmitters2);assert.deepEqual(target.model.Textures.slice(0,before.Textures.length),before.Textures);
 assert.equal(recipe.native.Textures[0].Image,STARTER_TEXTURE);assert.deepEqual(assets.get(key(STARTER_TEXTURE)),modifiedAsset());
});

test('custom particle pictures retain their declared path in portable presets',()=>{
 const name='Abilities\\Spells\\Custom\\Spark.blp',recipe=createStarterRecipe(),asset={name,bytes:starterTextureAsset().bytes,origin:'particle-custom',source:'parts'};
 recipe.native.Textures[0].Image=name;recipe.dependencies[0].path=name;
 const preset=includeParticleAssets(recipe,new Map([[key(name),asset]]));
 assert.equal(preset.embeddedAssets[0].path,name);
 const restored=embeddedParticleAssets(preset).get(key(name));
 assert.equal(restored.name,name);assert.equal(restored.source,'parts');assert.deepEqual(restored.bytes,asset.bytes);
});
