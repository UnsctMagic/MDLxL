import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {prepareTextureLibrary,searchTextureLibrary,initialTextureLibraryResults,folderContains,textureFolderTree} from '../src/texture-library-search.js';
import {russianTextureQuery} from '../src/texture-library/russian-query.mjs';
import {parseQuery} from '../src/texture-library/phrase-search.mjs';
const require=createRequire(import.meta.url);
const {TextureLibrary,previewCatalog}=require('../electron/texture-library.cjs');
const {CascTextures}=require('../electron/casc.cjs');
const {TextureResolver}=require('../electron/texture-resolver.cjs');
const data=JSON.parse(await fs.readFile(new URL('../electron/data/texture-library-catalog.json',import.meta.url),'utf8'));
const annotated=data.items.map(t=>({...t,source:'native',sourcePath:'war3.w3mod:'+t.path,folder:'war3.w3mod:'+t.path.slice(0,t.path.lastIndexOf('\\')),variant:'classic'}));
const prepared=prepareTextureLibrary(annotated);

test('plain sizes and high resolution filter dimensions in both library search modes',()=>{
  const items=[
    {id:'small',name:'Metal 512',width:256,height:256},
    {id:'square',name:'Metal',width:512,height:512},
    {id:'wide',name:'Metal',width:512,height:256},
    {id:'large',name:'Metal',width:1024,height:1024},
    {id:'unknown',name:'Metal 512'},
    {id:'zero',name:'Metal',width:0,height:0},
    {id:'cloth',name:'Cloth',width:512,height:512},
  ].map(item=>({...item,path:item.name+'.blp',sourcePath:item.name+'.blp',variant:'classic',kinds:['other'],tags:[item.id==='cloth'?'cloth':'metal']}));
  const index=prepareTextureLibrary(items);
  const cases=[['512',['square','wide','cloth']],['256',['small','wide']],['high resolution',['square','wide','large','cloth']],['HIGH RESOLUTION',['square','wide','large','cloth']],['metal 512',['square','wide']],['metal high resolution',['square','wide','large']],['256 high resolution',['wide']],['2048',[]]];
  for(const [query,expected] of cases){
    for(const result of [initialTextureLibraryResults(items,{query}),...[false,true].map(vibe=>searchTextureLibrary(index,{query,vibe}))]){
      assert.deepEqual(result.items.map(item=>item.id).sort(),[...expected].sort(),query);
      assert.equal(result.total,expected.length,query);
      assert.deepEqual(result.unknown,[],query);
    }
  }
  assert.equal(searchTextureLibrary(index,{query:'512',limit:1}).total,3);
  assert.equal(searchTextureLibrary(index,{query:'512',limit:1}).hasMore,true);
  assert.equal(searchTextureLibrary(index,{query:'512',variant:'custom'}).total,0);
  assert.equal(searchTextureLibrary(index,{query:'512',format:'dds'}).total,0);
  for(const [query,expected] of [['256 or 512',['small','square','wide','cloth']],['metal without 512',['small','large','unknown','zero']],['512x256',['wide']]]){
    assert.deepEqual(searchTextureLibrary(index,{query}).items.map(item=>item.id).sort(),expected.sort(),query);
  }
  for(const query of ['"Metal 512"','name:"Metal 512"','path:512.blp','Textures\\512.blp','512-metal']){
    const result=searchTextureLibrary(index,{query,vibe:false});
    assert.equal(result.items.some(item=>item.id==='square'),false,query+' stays literal');
  }
});

test('size search matches real catalog dimensions and agrees before and after worker preparation',()=>{
  for(const query of ['256','512','high resolution']){
    const expected=annotated.filter(item=>query==='high resolution'?Math.max(item.width,item.height)>=512:item.width===Number(query)||item.height===Number(query));
    assert.ok(expected.length);
    for(const vibe of [false,true]){
      const result=searchTextureLibrary(prepared,{query,vibe,limit:annotated.length});
      assert.deepEqual(result.items.map(item=>item.id).sort(),expected.map(item=>item.id).sort());
    }
    assert.equal(initialTextureLibraryResults(annotated,{query}).total,expected.length);
  }
});

test('first Library page matches completed empty search before indexing',()=>{
  for(const options of [
    {variant:'classic',vibe:true,limit:12},
    {variant:'classic',vibe:false,format:'blp',limit:12},
    {variant:'all',vibe:true,kind:'units',limit:12},
    {variant:'classic',vibe:true,folder:'war3.w3mod:Units',limit:12},
  ]){
    const first=initialTextureLibraryResults(annotated,options);
    const complete=searchTextureLibrary(prepared,{query:'',...options});
    assert.equal(first.total,complete.total);
    assert.deepEqual(first.items.map(item=>item.id),complete.items.map(item=>item.id));
  }
  assert.equal(initialTextureLibraryResults(annotated,{query:'rusty metal'}).total,0);
  const initialName=initialTextureLibraryResults(annotated,{query:'Footman',variant:'classic',limit:12});
  const literalName=searchTextureLibrary(prepared,{query:'Footman',vibe:false,variant:'classic',limit:12});
  assert.equal(initialName.total,literalName.total);
  assert.deepEqual(initialName.items.map(item=>item.id),literalName.items.map(item=>item.id));
  for(const format of ['all','blp']){
    const preview=previewCatalog({signature:'fixture',items:annotated},format);
    const complete=searchTextureLibrary(prepared,{query:'',variant:preview.variant,format,limit:120});
    assert.equal(preview.signature,'fixture');assert.equal(preview.result.total,complete.total);
    assert.deepEqual(preview.result.items.map(item=>item.id),complete.items.map(item=>item.id));
  }
  assert.equal(previewCatalog({signature:'custom',items:[{id:'custom',name:'Custom',path:'custom.png',variant:'custom'}]}).variant,'all');
});

test('vibe keeps mail searchable without silently dropping a requested rust condition',()=>{
  assert.equal(searchTextureLibrary(prepared,{query:'rusty chain mail'}).total,0);
  const result=searchTextureLibrary(prepared,{query:'chain mail'});
  assert.ok(result.items.length);assert.match(result.items[0].name,/Human Campaign Footman/);
  assert.ok(result.items.every(item=>item.tags.includes('chain')));
});

test('faction building searches return the real building sheets before shared components',()=>{
  const expected={
    undead:['Creepy Altar Of Dark','Creepy Necropolis','Creepy Sacrificial Pit','Gargoyle Spire','Graveyard','New Creepy Scary Crypt','New Crypt','New Temple Of The Damned','Tomb Of Relics','Undead Shipyard','Bone Yard Creepy','Slaughter House','New Zigguratscarycreepytex'],
    human:['Altar Of Kings','Arcane Sanctum','Arcane Vault','New Blacksmith','Town Hall Castle Keep','Garrison'],
    orc:['Altarof Storms','Beastiary','Great Hall','Stronghold','Voodoo Lounge','Watchtower','Base','Orc Barraks'],
    'night elf':['Ancient Of Lore','Ancient Of War1','Ancient Protector','Hunter\'s Hall','Moon Well','Treeof Life','Night Elf Base'],
  };
  for(const [faction,names] of Object.entries(expected)){
    const result=searchTextureLibrary(prepared,{query:faction+' building',limit:1000});
    for(const name of names)assert.ok(result.items.some(item=>item.name===name),faction+': '+name);
    assert.ok(result.items.slice(0,10).every(item=>item.path.startsWith('Buildings\\')),faction+' first page');
    assert.ok(result.items.every(item=>!/Cloud|Glow|Dust|Shockwave|Ribbon|Particle|Ghost|Smug/.test(item.name)),faction+' excludes effects');
  }
  const undead=searchTextureLibrary(prepared,{query:'undead building',limit:1000});
  assert.equal(undead.items.some(item=>item.name==='Doodads0'),false,'undead spell references cannot turn a shared prop atlas into an undead building');
  for(const query of ['undead buildings','undead structure','undead structures','здания нежити'])assert.deepEqual(searchTextureLibrary(prepared,{query,limit:1000}).items.map(item=>item.id),undead.items.map(item=>item.id),query);
  assert.deepEqual(searchTextureLibrary(prepared,{query:'undead',kind:'buildings',limit:1000}).items.map(item=>item.id).sort(),undead.items.map(item=>item.id).sort());
});

test('source and faction stay together across aliases and OR clauses',()=>{
  const ids=query=>searchTextureLibrary(prepared,{query,limit:10000}).items.map(item=>item.id).sort();
  assert.deepEqual(ids('human or undead buildings'),[...new Set([...ids('human buildings'),...ids('undead buildings')])].sort());
  assert.deepEqual(ids('human units or undead buildings'),[...new Set([...ids('human units'),...ids('undead buildings')])].sort());
  assert.deepEqual(ids('night elf building'),ids('nightelf buildings'));
  assert.deepEqual(ids('night elves buildings'),ids('nightelf buildings'));
  assert.ok(ids('blood elf units').length,'multiword faction must not be gated by body-material tags');
});

test('a reused texture must match the requested faction within the requested category',()=>{
  const index=prepareTextureLibrary([
    {id:'building',name:'Fortress',path:'Buildings\\Undead\\Fortress\\Fortress.blp',kinds:['buildings'],tags:['stone']},
    {id:'pooled',name:'Mixed Stone',path:'Textures\\MixedStone.blp',kinds:['buildings','effects'],tags:['stone'],races:['human','undead'],models:['buildings\\human\\fortress\\fortress.mdx','abilities\\spells\\undead\\stone\\stone.mdx']},
    {id:'smoke',name:'Smoke',path:'Textures\\Smoke.blp',kinds:['buildings','effects'],tags:['smoke'],races:['undead'],models:['buildings\\undead\\fortress\\fortress.mdx']},
  ].map(item=>({...item,source:'native',sourcePath:item.path,variant:'classic'})));
  assert.deepEqual(searchTextureLibrary(index,{query:'undead building'}).items.map(item=>item.id),['building']);
  assert.ok(searchTextureLibrary(index,{query:'human stone building'}).items.some(item=>item.id==='pooled'));
  assert.deepEqual(searchTextureLibrary(index,{query:'undead effects smoke'}).items.map(item=>item.id),[],'a building reference is not an undead spell source');
  assert.deepEqual(searchTextureLibrary(index,{query:'Smoke'}).items.map(item=>item.id),['smoke'],'effect remains accessible by its actual name');
});

test('descriptive words require evidence while complete native names remain searchable',()=>{
  const index=prepareTextureLibrary([
    {id:'blue',name:'Blue Cloth',tags:['cloth'],searchIndex:{version:4,traits:[['blue',1,'=review']] }},
    {id:'plain',name:'Plain Cloth',tags:['cloth'],searchIndex:{version:4,traits:[]}},
    {id:'red-body',name:'Red Creature',tags:['cloth'],searchIndex:{version:4,traits:[]}},
    {id:'named',name:'Red Cloth',tags:[],searchIndex:{version:4,traits:[]}},
  ].map(item=>({...item,path:'Textures\\'+item.name.replaceAll(' ','')+'.blp',sourcePath:item.name+'.blp',source:'native',variant:'classic',kinds:['units']})));
  assert.deepEqual(searchTextureLibrary(index,{query:'blue cloth'}).items.map(item=>item.id),['blue']);
  assert.deepEqual(searchTextureLibrary(index,{query:'red cloth'}).items.map(item=>item.id),['named']);
  assert.equal(searchTextureLibrary(index,{query:'blue rusty cloth'}).total,0,'matching blue does not excuse missing rust');
  assert.equal(searchTextureLibrary(index,{query:'purple cloth'}).total,0,'a matching material does not excuse missing colour');
  assert.deepEqual(searchTextureLibrary(index,{query:'name:"Red Creature"'}).items.map(item=>item.id),['red-body']);
});

test('prefix retrieval precedes typo correction for arbitrary native names',()=>{
  const index=prepareTextureLibrary([
    {id:'prefix',name:'Varnolith',path:'Textures\\Varnolith.blp'},
    {id:'nearby',name:'Barn',path:'Textures\\Barn.blp'},
    {id:'literal',name:'Fabrick',path:'Textures\\Fabrick.blp'},
  ].map(item=>({...item,source:'native',sourcePath:item.path,variant:'classic',kinds:['other'],tags:[]})));
  const parsed=parseQuery('varn',index.vocabulary);
  assert.equal(parsed[0].correction,null,'do not turn a valid prefix into the nearby word barn');
  assert.deepEqual(searchTextureLibrary(index,{query:'varn'}).items.map(item=>item.id),['prefix']);
  assert.deepEqual(searchTextureLibrary(index,{query:'Fabrick'}).items.map(item=>item.id),['literal'],'an existing native spelling wins over an alias rewrite');
  assert.equal(searchTextureLibrary(index,{query:'"varn"'}).total,0,'quoted text does not expand prefixes');
  assert.deepEqual(searchTextureLibrary(index,{query:'"varn" or Barn'}).items.map(item=>item.id),['nearby'],'OR keeps quoted alternatives literal');
});

test('native names remain retrievable even when aliases describe a different category',()=>{
  const items=[
    {id:'name',name:'Blue Building',path:'Textures\\BlueBuilding.blp',kinds:['units'],tags:[]},
    {id:'body',name:'Night Elf Body',path:'Textures\\NightElfBody.blp',kinds:['other'],tags:[]},
  ].map(item=>({...item,source:'native',sourcePath:item.path,variant:'classic'}));
  const index=prepareTextureLibrary(items);
  assert.deepEqual(searchTextureLibrary(index,{query:'Blue Building'}).items.map(item=>item.id),['name']);
  assert.deepEqual(searchTextureLibrary(index,{query:'Blue Bui'}).items.map(item=>item.id),['name']);
  assert.equal(searchTextureLibrary(index,{query:'blue source:buildings'}).total,0,'explicit semantic fields still constrain results');
  const sample=annotated.filter(item=>item.reviewed&&!/\d/.test(item.name));
  for(let i=0;i<sample.length;i+=Math.max(1,Math.floor(sample.length/180))){
    const item=sample[i],result=searchTextureLibrary(prepared,{query:item.name,limit:10000});
    assert.ok(result.items.some(row=>row.id===item.id),item.name+' cannot be hidden by descriptive aliases');
  }
});

test('short material, colour and category words use the same general matcher',()=>{
  for(const [short,full] of [['purp cloth','purple cloth'],['blu cloth','blue cloth'],['met','metal'],['orc bui','orc buildings'],['hum bui','human buildings'],['undead stru','undead structures']]){
    const abbreviated=searchTextureLibrary(prepared,{query:short,limit:10000}),complete=searchTextureLibrary(prepared,{query:full,limit:10000});
    assert.ok(complete.total,full);
    assert.deepEqual(abbreviated.items.map(item=>item.id).sort(),complete.items.map(item=>item.id).sort(),short);
    assert.deepEqual(abbreviated.unknown,[],short);
  }
});

test('compound subject aliases cannot swallow separately meaningful colour constraints',()=>{
  const named=annotated.filter(item=>/^(?:Red|Blue|Black|Green|Azure|Bronze) Dragon$/.test(item.name));
  for(const item of named){
    const parsed=parseQuery(item.name,prepared.vocabulary);
    const modifier=parseQuery(item.name.split(' ')[0],prepared.vocabulary)[0];
    if(modifier.family!=='color')continue;
    assert.ok(parsed.some(term=>term.trait===modifier.trait),item.name+' retains its colour');
    const query=item.name.split(' ').join(' and ');
    assert.deepEqual(searchTextureLibrary(prepared,{query:item.name,limit:10000}).items.map(row=>row.id).sort(),searchTextureLibrary(prepared,{query,limit:10000}).items.map(row=>row.id).sort(),item.name);
  }
  const abbreviated=searchTextureLibrary(prepared,{query:'red drag',limit:10000});
  assert.equal(abbreviated.items[0].name,'Red Dragon');
  assert.ok(abbreviated.items.some(item=>item.name==='Dragon Sea Turtle'));
  assert.ok(abbreviated.items.every(item=>item._traits.get('red')?.strength||/\bred\b/i.test(item.name)),'every candidate still has colour evidence');
  assert.equal(abbreviated.items.some(item=>item.name==='Azure Dragon'),false);
  const quoted=searchTextureLibrary(prepared,{query:'"red dragon"',limit:10000});
  assert.ok(quoted.items.every(item=>/red dragon/i.test(item.name)),'quoted native subjects remain literal');
});
test('Russian descriptions use the same reviewed texture results as English, retaining original names and paths',()=>{
  for(const [russian,english] of [['ржавая кольчуга','rusty chainmail'],['Нургл','Nurgle'],['Мордор','Mordor'],['синяя ткань','blue cloth'],['металл без крови','metal without blood']]){
    const translated=searchTextureLibrary(prepared,{query:russian}),original=searchTextureLibrary(prepared,{query:english});
    if(english==='rusty chainmail')assert.equal(original.total,0);else assert.ok(original.items.length,russian);
    assert.deepEqual(translated.items.map(item=>item.id),original.items.map(item=>item.id),russian);
    assert.deepEqual(translated.items.map(item=>[item.name,item.path]),original.items.map(item=>[item.name,item.path]));
  }
  assert.equal(searchTextureLibrary(prepared,{query:'несуществующаяабракадабра'}).total,0,'unknown Cyrillic must not become an empty query');
});
test('literal Russian names and paths remain literal; descriptive aliases respect protected fields',()=>{
  assert.equal(russianTextureQuery('name:Кожа ржавый металл'),'name:Кожа rusty metal');
  assert.equal(russianTextureQuery('"Кожа" металл'),'"Кожа" metal');
  assert.equal(russianTextureQuery('Textures\\Кожа.blp'),'Textures\\Кожа.blp');
  assert.equal(searchTextureLibrary(prepared,{query:'Нургл',vibe:false}).total,0);
  const named=prepareTextureLibrary([{id:'ru',name:'Кожа',path:'Кожа.blp',sourcePath:'Кожа.blp',kinds:['other'],tags:[],variant:'classic'}]);
  assert.equal(searchTextureLibrary(named,{query:'Кожа',vibe:false}).total,1);
  assert.equal(searchTextureLibrary(named,{query:'Дерево',vibe:false}).total,0);
  const ice=prepareTextureLibrary([{id:'ice',name:'Лёд',path:'Текстуры\\Лёд.blp',sourcePath:'Текстуры\\Лёд.blp',kinds:['other'],tags:[],variant:'classic'}]);
  assert.equal(searchTextureLibrary(ice,{query:'Лёд',vibe:false}).total,1);
  assert.equal(searchTextureLibrary(ice,{query:'Текстуры\\Лёд.blp',vibe:false}).total,1);
});
test('vibe ugly rusty nail offers grounded metal references with an explicit approximation',()=>{
  const result=searchTextureLibrary(prepared,{query:'ugly rusty nail'});
  assert.ok(result.items.length);assert.match(result.notice,/may suit a nail/);
  assert.ok(result.items.slice(0,3).every(item=>item.tags.includes('metal')));
  assert.equal(result.unknown.length,0);
});
test('Nurgle and Mordor are native kitbash suggestions, not invented textures',()=>{
  for(const [query,subject] of [['Nurgle',/Abomination|Flesh|Zombie/],['Mordor',/Grunt|Chaos|Orc/]]){
    const result=searchTextureLibrary(prepared,{query});
    assert.ok(result.items.length);assert.match(result.items[0].name,subject);
    assert.ok(result.items.every(item=>item._match.type==='inspiration'&&item._match.reason));
    assert.match(result.notice,/Native Warcraft textures/);
  }
});
test('name search disables descriptive and fantasy matching',()=>{
  assert.equal(searchTextureLibrary(prepared,{query:'Nurgle',vibe:false}).total,0);
  assert.equal(searchTextureLibrary(prepared,{query:'rusty chain mail',vibe:false}).total,0);
  const result=searchTextureLibrary(prepared,{query:'Footman',vibe:false});
  assert.ok(result.total>0);assert.ok(result.items.every(item=>/footman/i.test(item.name+' '+item.path)));
});
test('BLP-only search filters by the displayed model texture path',()=>{
  const items=prepareTextureLibrary([
    {id:'blp',name:'Classic skin',path:'Textures\\Classic.blp',lookupName:'war3.w3mod:textures\\classic.dds',sourcePath:'war3.w3mod:textures\\classic.dds',kinds:['units'],tags:[],variant:'classic'},
    {id:'dds',name:'HD skin',path:'_hd.w3mod:Textures\\HD.dds',lookupName:'war3.w3mod:_hd.w3mod:textures\\hd.dds',sourcePath:'war3.w3mod:_hd.w3mod:textures\\hd.dds',kinds:['units'],tags:[],variant:'reforged'},
    {id:'png',name:'Loose skin',path:'Loose.png',sourcePath:'Loose.png',kinds:['other'],tags:[],variant:'custom'},
  ]);
  assert.deepEqual(searchTextureLibrary(items,{query:'',variant:'all',format:'blp'}).items.map(item=>item.id),['blp']);
  assert.equal(searchTextureLibrary(items,{query:'',variant:'all',format:'all'}).total,3);
});
test('native folder boundaries preserve module and source hierarchy',()=>{
  assert.equal(folderContains('war3.w3mod:units\\orc\\grunt.dds','war3.w3mod:units\\orc'),true);
  assert.equal(folderContains('war3.w3mod:units\\orcs2\\grunt.dds','war3.w3mod:units\\orc'),false);
  const result=searchTextureLibrary(prepared,{query:'',folder:'war3.w3mod:Units\\Orc'});
  assert.ok(result.items.length);assert.ok(result.items.every(item=>folderContains(item.sourcePath,'war3.w3mod:Units\\Orc')));
  const tree=textureFolderTree(annotated);
  assert.equal(tree.children[0].name,'war3.w3mod');
  assert.ok(tree.children[0].children.some(item=>item.name.toLowerCase()==='textures'));
});
test('unknown native files remain searchable without fabricated surface evidence',()=>{
  const items=prepareTextureLibrary([{id:'x',name:'Special',path:'special.dds',sourcePath:'war3.w3mod:_hd.w3mod:special.dds',kinds:['other'],tags:[],variant:'reforged'}]);
  assert.equal(searchTextureLibrary(items,{query:'Special'}).total,1);
  assert.equal(searchTextureLibrary(items,{query:'rusty metal'}).total,0);
});
test('library joins only native paths which exist, and never borrows SD appearance for HD',async()=>{
  const library=new TextureLibrary({casc:{list:async()=>({sources:[{folder:'game',key:'build',names:['war3.w3mod:textures\\footman.dds','war3.w3mod:_hd.w3mod:textures\\footman.dds'],fromCache:true}],errors:[]})}});
  const result=await library.catalog();assert.equal(result.nativeCount,2);
  const sd=result.items.find(i=>i.variant==='classic'),hd=result.items.find(i=>i.variant==='reforged');
  assert.equal(sd.path,'Textures\\Footman.blp');assert.equal(sd.lookupName,'war3.w3mod:textures\\footman.dds');assert.ok(sd.tags.includes('plate'));
  assert.equal(hd.notes,undefined);assert.deepEqual(hd.tags,[]);
});
test('unannotated native categories stay searchable across installed variants without borrowing appearance',async()=>{
  const names=[
    'war3.w3mod:_hd.w3mod:buildings\\undead\\necropolis\\necropolis_diffuse.dds',
    'war3.w3mod:_de.w3mod:buildings\\nightelf\\moonwell\\moonwell_diffuse.dds',
    'war3.w3mod:buildings\\orc\\newshed\\newshed.dds',
    'war3.w3mod:_hd.w3mod:units\\human\\newknight\\newknight_diffuse.dds',
    'war3.w3mod:_de.w3mod:replaceabletextures\\commandbuttonsdisabled\\disbtnnew.dds',
  ];
  const library=new TextureLibrary({casc:{list:async()=>({sources:[{folder:'game',key:'new-build',names}],errors:[]})}});
  const result=await library.catalog();
  assert.deepEqual(names.map(name=>result.items.find(item=>item.sourcePath===name).kinds),[['buildings'],['buildings'],['buildings'],['units'],['icons']]);
  const index=prepareTextureLibrary(result.items);
  for(const [query,variant,nativePath,kind] of [['undead building','reforged',names[0],'buildings'],['night elf building','forsaken-kingdom',names[1],'buildings'],['orc building','classic',names[2],'buildings'],['human units','reforged',names[3],'units']]){
    const found=searchTextureLibrary(index,{query,variant,kind});
    assert.equal(found.total,1,query);
    assert.equal(found.items[0].lookupName,nativePath);
    assert.equal(found.items[0].sourcePath,nativePath);
    assert.deepEqual(found.items[0].tags,[]);
    assert.equal(found.items[0].notes,undefined);
  }
  assert.equal(searchTextureLibrary(index,{query:'rusty undead building',variant:'reforged'}).total,0);
});
test('library labels installed Classic, Reforged, and Forsaken Kingdom sources independently',async()=>{
  const names=[
    'war3.w3mod:textures\\footman.dds',
    'war3.w3mod:_hd.w3mod:units\\human\\footman\\footman_diffuse.dds',
    'war3.w3mod:_de.w3mod:units\\human\\footman\\footman_diffuse.dds',
    'war3.w3mod:campaign\\forsakenkingdom\\undeadre02.w3x\\_de.w3mod:textures\\banner.dds',
    'war3.w3mod:_tilesets\\a.w3mod:terrainart\\ground.dds',
  ];
  const library=new TextureLibrary({casc:{list:async()=>({sources:[{folder:'game',key:'build',names}],errors:[]})}});
  const result=await library.catalog();
  assert.deepEqual(Object.fromEntries(result.items.map(item=>[item.sourcePath,item.variant])),{
    [names[0]]:'classic',[names[1]]:'reforged',[names[2]]:'forsaken-kingdom',[names[3]]:'forsaken-kingdom',[names[4]]:'classic',
  });
  assert.equal(searchTextureLibrary(prepareTextureLibrary(result.items),{query:'',variant:'forsaken-kingdom'}).total,2);
  assert.equal(result.items.find(item=>item.sourcePath===names[2]).path,'_de.w3mod:units\\human\\footman\\footman_diffuse.dds');
});
test('custom catalog lists only immediate texture files and never reads a model',async()=>{
  const calls=[],folder=path.resolve(os.tmpdir(),'mdlvis-library-test');
  const directoryEntry=(name,isFile)=>({name,isFile:()=>isFile});
  const library=new TextureLibrary({readdir:async(directory,options)=>{calls.push({directory,options});return [directoryEntry('skin.blp',true),directoryEntry('photo.png',true),directoryEntry('model.mdx',true),directoryEntry('nested',false),directoryEntry('linked.dds',false)];},stat:async file=>({isFile:()=>true,size:100,mtimeMs:5}),readFile:()=>{throw Error('No file contents should be read.');}});
  const result=await library.custom(path.join(folder,'open.mdx'));
  assert.deepEqual(result.map(i=>i.path),['photo.png','skin.blp']);assert.equal(calls.length,1);assert.equal(calls[0].directory,folder);
  assert.deepEqual(await library.custom('relative.mdx'),[]);
});
test('CASC native path catalog survives restart and invalidates with game build',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-library-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const install=path.join(root,'game'),cache=path.join(root,'cache');await fs.mkdir(install);await fs.writeFile(path.join(install,'.build.info'),'build1');
  let opens=0,closes=0;
  const openReader=()=>{opens++;return {list:async()=>['war3.w3mod:textures\\footman.dds'],close:()=>closes++};};
  const first=new CascTextures({cacheDirectory:cache,openReader});const result=await first.list([install]);assert.equal(result.sources[0].fromCache,false);assert.equal(opens,1);assert.equal(closes,1);await first.close();
  const second=new CascTextures({cacheDirectory:cache,openReader});assert.equal((await second.list([install])).sources[0].fromCache,true);assert.equal(opens,1);
  await fs.writeFile(path.join(install,'.build.info'),'build2');assert.equal((await second.list([install])).sources[0].fromCache,false);assert.equal(opens,2);await second.close();
});
test('native enumeration failure preserves custom folder entries and reports the failure',async()=>{
  const library=new TextureLibrary({casc:{list:async()=>({sources:[],errors:[{folder:'game',message:'Cannot open storage'}]})}});
  library.custom=async()=>[{id:'custom:1',path:'custom.blp',source:'custom'}];
  const result=await library.catalog();assert.equal(result.items.length,1);assert.equal(result.errors[0].message,'Cannot open storage');
});
test('module textures use persisted native content keys after restart',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mdlvis-library-key-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const install=path.join(root,'game'),cache=path.join(root,'cache'),name='_addons\\hd.w3addon\\units.w3mod:_hd.w3mod:units\\peon.dds',key='0123456789abcdef0123456789abcdef';
  await fs.mkdir(install);await fs.writeFile(path.join(install,'.build.info'),'build1');
  let reads=0;
  const first=new CascTextures({cacheDirectory:cache,openReader:()=>({list:async()=>({names:[name],keys:{[name]:key}}),close(){}})});
  await first.list([install]);await first.close();
  const second=new CascTextures({cacheDirectory:cache,openReader:()=>({read:()=>{throw Error('Module texture must use native key');},readKey:async actual=>{assert.equal(actual,key);reads++;return Buffer.from('DDS sample');},close(){}})});
  assert.equal((await second.read(name,[install])).toString(),'DDS sample');assert.equal(reads,1);await second.close();
  const third=new CascTextures({cacheDirectory:cache,openReader:()=>{throw Error('Cached bytes must not reopen storage');}});
  assert.equal((await third.read(name,[install])).toString(),'DDS sample');await third.close();
});
test('explicit native module paths bypass custom basename collisions and respect chosen CASC order',async()=>{
  const attempts=[];let looseReads=0;
  const resolver=new TextureResolver({stat:async()=>({isFile:()=>true,size:20}),readFile:async()=>{looseReads++;return Buffer.from('custom texture');},openArchive:async()=>{throw Error('Explicit native paths must not read MPQ files');},casc:{read:async(name,folders)=>{attempts.push({name,folders});return folders.includes('selected')?Buffer.from('selected native'):Buffer.from('fallback native');},close(){}}});
  const sources={folders:[path.resolve('custom')],archives:['archive.mpq'],cascFolders:['selected'],fallbackCascFolders:['automatic']};
  const native=await resolver.resolve(['war3.w3mod:textures\\footman.dds'],sources);
  assert.equal(native[0].bytes.toString(),'selected native');assert.equal(looseReads,0);assert.deepEqual(attempts,[{name:'war3.w3mod:textures\\footman.dds',folders:['selected']}]);
  const definitive=await resolver.resolve(['_de.w3mod:replaceabletextures\\commandbuttons\\btnforsakenpaladin.dds'],sources);
  assert.equal(definitive[0].bytes.toString(),'selected native');assert.equal(looseReads,0);
  assert.deepEqual(attempts[1],{name:'war3.w3mod:_de.w3mod:replaceabletextures\\commandbuttons\\btnforsakenpaladin.dds',folders:['selected']});
  const ordinary=await resolver.resolve(['Textures\\Footman.dds'],sources);
  assert.equal(ordinary[0].bytes.toString(),'custom texture');assert.equal(looseReads,1);await resolver.close();
});
