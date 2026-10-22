import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createDemoDocument} from '../src/editor-document.js';
import {beginUVPreview,applyUVPreviews,uvPreviewModel,restoreUVPreviews,existingTextureIndex,materialsUsingTexture,addTextureMaterial} from '../src/uv-preview.js';
import {isArtworkPath,artworkQuery} from '../src/texture-library-art.js';
const require=createRequire(import.meta.url);
const {GameFileLibrary,classifyGameFile,casingDictionary}=require('../electron/game-file-library.cjs');

const key=n=>n.toString(16).padStart(32,'0');
const names=[
  'war3.w3mod:',
  'vfs-root',
  'war3.w3mod:units\\human\\footman\\footman.mdx',
  'war3.w3mod:units\\human\\footman\\footman_portrait.mdx',
  'war3.w3mod:textures\\footman.blp',
  'war3.w3mod:_hd.w3mod:units\\human\\footman\\footman.mdx',
  'war3.w3mod:_hd.w3mod:units\\human\\footman\\footman_diffuse.dds',
  'war3.w3mod:_hd.w3mod:_teen.w3mod:units\\human\\footman\\footman.mdx',
  'war3.w3mod:_de.w3mod:units\\human\\footman\\footman.mdx',
  'war3.w3mod:_locales\\enus.w3mod:units\\human\\footman\\footmanyes1.ogg',
  'war3.w3mod:_locales\\dede.w3mod:units\\human\\footman\\footmanyes1.ogg',
  'war3.w3mod:_de.w3mod:_locales\\enus.w3mod:units\\human\\footman\\footmanyes1.flac',
  'war3.w3mod:_tilesets\\a.w3mod:terrainart\\ashenvale\\ashen_dirt.dds',
  'war3.w3mod:units\\unitdata.slk',
  'war3.w3mod:sound\\music\\mp3music\\human1.mp3',
];
function fakeLibrary(reads=[]){
  const casc={
    listFiles:async()=>({sources:[{folder:'D:\\Game',key:'b'.repeat(64),names,keys:Object.fromEntries(names.map((name,i)=>[name.toLowerCase(),key(i+1)])),sizes:names.map((_,i)=>(i+1)*100),locales:['enus']}],errors:[]}),
    readListed:async(contentKey,folder,install)=>{reads.push({contentKey,folder,install});return new Uint8Array([Number.parseInt(contentKey,16)]);},
  };
  return new GameFileLibrary({casc,readFile:async()=>JSON.stringify({items:[{path:'Units\\Human\\Footman\\Footman.blp'},{path:'Textures\\Footman.blp'}]})});
}

test('game files are classified by version, language and type like the texture library',()=>{
  assert.equal(classifyGameFile('vfs-root'),null);
  assert.equal(classifyGameFile('war3.w3mod:'),null);
  const classic=classifyGameFile('war3.w3mod:units\\human\\footman\\footman.mdx',['enus']);
  assert.deepEqual([classic.variant,classic.type,classic.module,classic.logical],['classic','models','Classic','units\\human\\footman\\footman.mdx']);
  assert.equal(classifyGameFile('war3.w3mod:_hd.w3mod:a.mdx').variant,'reforged');
  assert.equal(classifyGameFile('war3.w3mod:_de.w3mod:a.dds').variant,'forsaken-kingdom');
  assert.equal(classifyGameFile('war3.w3mod:_hd.w3mod:_teen.w3mod:a.mdx').variant,'other');
  const installed=classifyGameFile('war3.w3mod:_locales\\enus.w3mod:a.ogg',['enus']),other=classifyGameFile('war3.w3mod:_locales\\dede.w3mod:a.ogg',['enus']);
  assert.deepEqual([installed.variant,installed.type,installed.module],['classic','sounds','Classic · English (US)']);
  assert.deepEqual([other.variant,other.module],['language','Classic · German']);
  assert.equal(classifyGameFile('war3.w3mod:_de.w3mod:_locales\\dede.w3mod:a.flac',['enus']).module,'Forsaken Kingdom · German');
  assert.equal(classifyGameFile('war3.w3mod:a.slk').type,'text');
  assert.equal(classifyGameFile('war3.w3mod:a.animset_ingame').type,'other');
  assert.equal(casingDictionary(['Units\\Human\\Footman\\Footman.blp']).get('human'),'Human');
});

test('folders browse like the game, with counts that follow the version and type filters',async()=>{
  const library=fakeLibrary(),index=await library.load(['D:\\Game']);
  assert.equal(index.entries.length,names.length-2);
  const top=library.browse(index,{folder:'',variant:'classic'});
  assert.deepEqual(top.folders.map(folder=>[folder.name,folder.count]),[['Sound',1],['Terrainart',1],['Textures',1],['Units',4]]);
  assert.deepEqual(top.files,[]);assert.deepEqual(library.browse(index,{folder:'units'}).files.map(file=>file.name),['Unitdata.slk']);
  const footman=library.browse(index,{folder:'units\\human\\footman',variant:'all'});
  assert.equal(footman.folder.path,'Units\\Human\\Footman');
  assert.deepEqual(footman.crumbs.map(crumb=>crumb.name),['Units','Human','Footman']);
  assert.equal(footman.files.filter(file=>file.name==='Footman.mdx').length,4);
  assert.deepEqual(library.browse(index,{folder:'units',type:'sounds'}).folders.map(folder=>folder.count),[1]);
  assert.equal(library.browse(index,{folder:'',variant:'reforged',type:'models'}).folders[0].count,1);
  assert.equal(library.browse(index,{folder:'missing'}).folder,null);
  const paged=library.browse(index,{folder:'units\\human\\footman',variant:'all',limit:2});
  assert.equal(paged.files.length,2);assert.equal(paged.hasMore,true);
});

test('search needs every word, ranks exact names first and can stay inside a folder',async()=>{
  const library=fakeLibrary(),index=await library.load(['D:\\Game']);
  const models=library.search(index,{query:'footman',type:'models',variant:'all'});
  assert.deepEqual(models.files.map(file=>file.name),['Footman.mdx','Footman.mdx','Footman.mdx','Footman.mdx','Footman_portrait.mdx']);
  assert.equal(models.files[0].variant,'classic');
  assert.equal(library.search(index,{query:'human footman yes'}).total,1);
  assert.equal(library.search(index,{query:'human/footman/footmanyes1',variant:'all',type:'sounds'}).total,3);
  assert.equal(library.search(index,{query:'footman',folder:'textures'}).total,1);
  assert.equal(library.search(index,{query:'nothing here'}).total,0);
  assert.deepEqual(library.search(index,{query:'  '}).folders.map(folder=>folder.name),library.browse(index,{}).folders.map(folder=>folder.name));
});

test('reads use the listed content key; model textures come from the model module first',async()=>{
  const reads=[],library=fakeLibrary(reads),index=await library.load(['D:\\Game']);
  const hd=index.entries.find(entry=>entry.sourcePath==='war3.w3mod:_hd.w3mod:units\\human\\footman\\footman.mdx');
  assert.throws(()=>library.entry(index,hd.id,'stale'),/changed/);
  assert.throws(()=>library.entry(index,99999,index.signature),/listed/);
  assert.deepEqual([...await library.read(index,library.entry(index,hd.id,index.signature))],[names.indexOf(hd.sourcePath)+1]);
  assert.deepEqual(reads.at(-1),{contentKey:key(names.indexOf(hd.sourcePath)+1),folder:'D:\\Game',install:'b'.repeat(64)});
  const resolved=await library.resolve(index,hd,['Units\\Human\\Footman\\Footman_diffuse.dds','Textures\\Footman.dds','Missing.blp','war3.w3mod:textures\\footman.blp']);
  assert.deepEqual(resolved.found.map(record=>[record.name,record.bytes[0]]),[['Units\\Human\\Footman\\Footman_diffuse.dds',names.indexOf('war3.w3mod:_hd.w3mod:units\\human\\footman\\footman_diffuse.dds')+1],['Textures\\Footman.dds',names.indexOf('war3.w3mod:textures\\footman.blp')+1]]);
  assert.deepEqual(resolved.missing,['Missing.blp']);
});

test('painting and art searches find illustrations, not skins, icons or map symbols',()=>{
  for(const art of ['war3.w3mod:UI\\Glues\\Loading\\Backgrounds\\Campaigns\\Ashenvale-TopLeft.blp','war3.w3mod:webui\\loadingscreen\\campaign\\roc\\02_human\\human01_defense of strahnbrad.jpg','war3.w3mod:webui\\campaign\\campaignselect\\backgrounds\\wc3_campaign_keyart_orc.png','UI\\Glues\\MainMenu\\MainMenu3d_Beta\\Arthas_Concept03.blp','war3.w3mod:ui\\glues\\scorescreen\\scorescreen-orcvictory\\scorescreen-orcvictory.dds'])assert.equal(isArtworkPath(art),true,art);
  for(const other of ['war3.w3mod:textures\\footman.blp','war3.w3mod:ui\\glues\\scorescreen\\scorescreen-hero-arthas.dds','war3.w3mod:webui\\portraits\\p007.png','war3.w3mod:UI\\Glues\\Loading\\Backgrounds\\Campaigns\\OrcSymbol.blp','war3.w3mod:webui\\loadingscreen\\loadscreen_mapframe.png','war3.w3mod:ReplaceableTextures\\CommandButtons\\BTNFootman.blp'])assert.equal(isArtworkPath(other),false,other);
  assert.equal(isArtworkPath('x.blp',{tags:['artwork'],notes:'Painted sun and moon strip.'}),true);
  assert.equal(isArtworkPath('x.blp',{tags:['artwork'],notes:'Small photographic human face.'}),false);
  assert.equal(artworkQuery('painting'),'');
  assert.equal(artworkQuery('Orc painting'),'orc');
  assert.equal(artworkQuery('loading screen ashenvale'),'ashenvale');
  assert.equal(artworkQuery('arthas'),null);
  assert.equal(artworkQuery('art clo'),null);
  assert.equal(artworkQuery('undead art'),null);
  assert.equal(artworkQuery('orc artwork'),'orc');
  assert.equal(artworkQuery('art'),'');
  assert.equal(artworkQuery('rusty chain mail'),null);
});

test('a texture already in the model can reuse a material showing it or get a new material',()=>{
  const {model}=createDemoDocument();
  model.Textures.push({Image:'Textures\Footman.blp',ReplaceableId:0,Flags:3});
  model.Materials[model.Geosets[0].MaterialID].Layers[0].TextureID=model.Textures.length-1;
  const image='Textures\Footman.blp',textureID=existingTextureIndex(model,image.toUpperCase().replaceAll('\\','/'));
  assert.ok(textureID>=0);assert.equal(existingTextureIndex(model,'Nope.blp'),-1);
  const users=materialsUsingTexture(model,textureID);
  assert.ok(users.length>0);
  const count=model.Materials.length,added=addTextureMaterial(model,textureID);
  assert.equal(added,count);assert.equal(model.Materials[added].Layers[0].TextureID,textureID);
  assert.deepEqual(materialsUsingTexture(model,textureID),[...users,added]);
  // UV preview: existing material is assigned as-is; 'new' always makes a separate copy.
  const bytes=new Uint8Array([1,2,3]),geoset=model.Geosets.findIndex(g=>g.MaterialID!==added);
  const reuse=beginUVPreview(model,{},[geoset],{name:image,bytes},{material:added});
  assert.equal(reuse[geoset].material,added);
  assert.equal(uvPreviewModel(model,reuse).Geosets[geoset].MaterialID,added);
  const separate=structuredClone(model),before=separate.Materials.length;
  applyUVPreviews(separate,beginUVPreview(separate,{},[geoset],{name:image,bytes},{material:'new'}),{release:false});
  assert.equal(separate.Materials.length,before+1);assert.equal(separate.Geosets[geoset].MaterialID,before);
  assert.deepEqual(restoreUVPreviews(model,reuse)[geoset].material,added);
  assert.throws(()=>beginUVPreview(model,{},[geoset],{name:image,bytes},{material:999}),/no longer/);
  assert.equal(restoreUVPreviews(model,{[geoset]:{...reuse[geoset],material:999}})[geoset].material,undefined);
});

test('game paths from the World Editor tables resolve per version with extension fallbacks',async()=>{
  const library=fakeLibrary(),index=await library.load(['D:\\Game']);
  assert.equal(library.findPath(index,'Units\\Human\\Footman\\Footman.mdl','classic').sourcePath,'war3.w3mod:units\\human\\footman\\footman.mdx');
  assert.equal(library.findPath(index,'units/human/footman/footman.mdx','reforged').sourcePath,'war3.w3mod:_hd.w3mod:units\\human\\footman\\footman.mdx');
  assert.equal(library.findPath(index,'units\\human\\footman\\footman.mdx','forsaken-kingdom').sourcePath,'war3.w3mod:_de.w3mod:units\\human\\footman\\footman.mdx');
  assert.equal(library.findPath(index,'Textures\\Footman.dds','classic').sourcePath,'war3.w3mod:textures\\footman.blp');
  assert.equal(library.findPath(index,'units\\human\\footman\\footman_portrait.mdx','reforged').sourcePath,'war3.w3mod:units\\human\\footman\\footman_portrait.mdx','falls back to the base game');
  assert.equal(library.findPath(index,'war3.w3mod:units\\unitdata.slk'),null);
  const sources=await library.worldEditorSources(index,{files:['units\\unitdata.slk','units\\missing.slk'],isString:path=>/\.ogg$/.test(path)});
  assert.deepEqual(sources.files.map(([path])=>path),['units\\unitdata.slk']);
  assert.equal(sources.strings.length,1,'only the installed language');
});

test('a part from a newer model format imports into an MDX 800 model instead of being refused',async()=>{
  const {createStarterDocument}=await import('../src/starter-model.js');
  const {collectPart,commitPart}=await import('../src/bits-and-parts.js');
  const donor=createStarterDocument(1000).model,target=createStarterDocument(800).model;
  assert.equal(donor.Version,1000);assert.equal(target.Version,800);
  const part=collectPart(donor,{0:Array.from({length:donor.Geosets[0].Vertices.length/3},(_,vertex)=>vertex)});
  const before=target.Geosets.length,result=commitPart(target,part);
  assert.equal(target.Version,800,'the edited model keeps its own format');
  assert.equal(result.geosetIndices.length,donor.Geosets.length);assert.equal(target.Geosets.length,before+donor.Geosets.length);
  assert.ok(target.Bones.some(bone=>bone.Name==='DummyBone'));
});
