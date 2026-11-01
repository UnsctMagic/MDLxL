import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorldEditorCatalog,parseProfile,modelPaths} from '../src/world-editor-catalog.js';

import {buildParticleBrowse,distinctParticleNames,resolveParticleArtPaths} from '../src/particle-library-browse.js';

const slk=(header,rows)=>['ID;PWXL;N;E',...header.map((name,x)=>`C;X${x+1};Y1;K"${name}"`),...rows.flatMap((row,y)=>row.map((value,x)=>`C;X${x+1};Y${y+2};K${typeof value==='number'?value:`"${value}"`}`)),'E'].join('\n');
const files=new Map(Object.entries({
  'units\\unitui.slk':slk(['unitUIID','name','campaign','special','inEditor','hiddenInEditor','hostilePal'],[['hfoo','footman',0,0,1,0,'-'],['Hpal','paladin',0,0,1,0,'-'],['hbar','barracks',0,0,1,0,'-'],['Hart','arthas',1,0,1,0,'-'],['nfrl','furbolg',0,0,1,0,1],['nshe','sheep',0,0,1,0,0],['hhid','hidden',0,0,1,1,'-']]),
  'units\\unitdata.slk':slk(['unitID','race','targType'],[['hfoo','human','ground'],['Hpal','human','ground'],['hbar','human','structure'],['Hart','human','ground'],['nfrl','creeps','ground'],['nshe','critters','ground'],['hhid','human','ground']]),
  'units\\unitskin.txt':'[hfoo]\nArt=ReplaceableTextures\\CommandButtons\\BTNFootman.blp\nfile=units\\human\\Footman\\Footman\n[Hpal]\nArt:sd=ReplaceableTextures\\CommandButtons\\BTNHeroPaladin.blp\nArt:hd=ReplaceableTextures\\CommandButtons\\BTNPaladinHD.blp\nfile=units\\human\\HeroPaladin\\HeroPaladin\n[hbar]\nfile=buildings\\human\\Barracks\\Barracks\n[Hart]\nfile=units\\human\\Arthas\\Arthas\n[nfrl]\nfile=units\\creeps\\Furbolg\\Furbolg\n[nshe]\nfile=units\\critters\\Sheep\\Sheep',
  'units\\humanunitfunc.txt':'[hbar]\nArt=ReplaceableTextures\\CommandButtons\\BTNHumanBarracks.blp',
  'units\\abilitydata.slk':slk(['alias','comments','useInEditor','hero','item','race'],[['AHhb','Holy Light',1,1,0,'human'],['Ahea','Heal',1,0,0,'human'],['AIgo','Gold',1,0,1,'other'],['Ahid','Hidden',0,0,0,'human']]),
  'units\\abilityskin.txt':'[AHhb]\nArt=ReplaceableTextures\\CommandButtons\\BTNHolyBolt.blp\nTargetart=Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdl\n[Ahea]\nArt=ReplaceableTextures\\CommandButtons\\BTNHealOn.blp\nCasterart=\nTargetart=Abilities\\Spells\\Human\\Heal\\HealTarget.mdl,Abilities\\Spells\\Human\\Heal\\HealSecond.mdl',
  'units\\itemdata.slk':slk(['itemID','class','comment'],[['ckng','Artifact','Crown']]),
  'units\\itemfunc.txt':'[ckng]\nArt=ReplaceableTextures\\CommandButtons\\BTNHelmutPurple.blp\nfile=Objects\\InventoryItems\\TreasureChest\\treasurechest.mdl',
  'doodads\\doodads.slk':slk(['doodID','category','tilesets','Name'],[['APms','E','A','WESTRING_DOOD_APMS'],['AObd','O','*','WESTRING_DOOD_AOBD']]),
  'doodads\\doodadskins.txt':'[APms]\nfile=Doodads\\Ashenvale\\Plants\\AshenShrooms\\AshenShrooms\nnumVar=2\n[AObd]\nfile=Doodads\\Cinematic\\Birds\\Birds',
  'units\\destructabledata.slk':slk(['DestructableID','category','tilesets','Name'],[['ATtr','D','A','WESTRING_DEST_TREE']]),
  'units\\destructableskin.txt':'[ATtr]\nfile=Doodads\\Terrain\\AshenTree\\AshenTree\nnumVar=1',
  'ui\\worldeditdata.txt':'[TileSets]\nA=WESTRING_LOCALE_ASHENVALE,TerrainArt\\Blight\\Ashen_Blight\nB=WESTRING_LOCALE_BARRENS,x\n[DoodadCategories]\nO=WESTRING_DTYPE_PROPS,ReplaceableTextures\\WorldEditUI\\Doodad-Prop\nE=WESTRING_DTYPE_ENVIRONMENT,ReplaceableTextures\\WorldEditUI\\Doodad-Environment\n[DestructibleCategories]\nD=WESTRING_DTYPE_DESTRUCTABLE,ReplaceableTextures\\WorldEditUI\\Doodad-Destructible',
}).map(([key,value])=>[key.toLowerCase(),value]));
const strings=['[hfoo]\nName=Footman\n[Hpal]\nName=Paladin\n[Hart]\nName=Arthas\nEditorSuffix= (Campaign)\n[AHhb]\nName=Holy Light\n[ckng]\nName=Crown of Kings +5','WESTRING_LOCALE_ASHENVALE=Ashenvale\nWESTRING_LOCALE_BARRENS=Barrens\nWESTRING_DTYPE_PROPS=Props\nWESTRING_DTYPE_ENVIRONMENT=Environment\nWESTRING_DTYPE_DESTRUCTABLE=Trees/Destructibles\nWESTRING_DOOD_APMS=Mushrooms\nWESTRING_DOOD_AOBD=Birds\nWESTRING_DEST_TREE=Ashenvale Tree Wall'];
const finder=root=>(...names)=>names.reduce((node,name)=>node?.children?.find(item=>item.name===name),root);

test('races hold units (normal, heroes, campaign), buildings and spells with their icons and models',()=>{
  const {root,modelIcons}=buildWorldEditorCatalog(files,strings),find=finder(root);
  assert.deepEqual(root.children.map(node=>node.name),['Human','Neutral Hostile','Neutral Passive','Items','Doodads']);
  assert.deepEqual(find('Human').children.map(node=>node.name),['Units','Buildings','Spells']);
  assert.deepEqual(find('Human','Units').children.map(node=>node.name),['Normal','Heroes','Campaign heroes']);
  assert.deepEqual(find('Human','Units','Normal','Footman'),{id:'hfoo',name:'Footman',icon:'ReplaceableTextures\\CommandButtons\\BTNFootman.blp',models:[{label:'Model',path:'units\\human\\Footman\\Footman.mdx'}]});
  assert.equal(find('Human','Units','Heroes','Paladin').icon,'ReplaceableTextures\\CommandButtons\\BTNHeroPaladin.blp');
  assert.equal(find('Human','Units','Campaign heroes','Arthas (Campaign)').models[0].path,'units\\human\\Arthas\\Arthas.mdx');
  assert.equal(find('Human','Buildings','Normal','barracks').icon,'ReplaceableTextures\\CommandButtons\\BTNHumanBarracks.blp','function tables fill missing icons');
  assert.ok(find('Neutral Hostile','Units','Normal','furbolg'));
  assert.ok(find('Neutral Passive','Units','Normal','sheep'));
  assert.equal(/hhid|Ahid/.test(JSON.stringify(root)),false,'hidden editor entries stay out');
  assert.deepEqual(find('Human','Spells','Heroes','Holy Light').models,[{label:'Target',path:'Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx'}]);
  assert.deepEqual(find('Human','Spells','Normal','Heal').models.map(model=>model.path),['Abilities\\Spells\\Human\\Heal\\HealTarget.mdx','Abilities\\Spells\\Human\\Heal\\HealSecond.mdx']);
  assert.equal(modelIcons['units\\human\\footman\\footman.mdx'],'ReplaceableTextures\\CommandButtons\\BTNFootman.blp');
  assert.equal(finder(buildWorldEditorCatalog(files,strings,{skin:'hd'}).root)('Human','Units','Heroes','Paladin').icon,'ReplaceableTextures\\CommandButtons\\BTNPaladinHD.blp','per-version skin fields');
});

test('items by class and doodads by tileset and category, including every-tileset doodads',()=>{
  const find=finder(buildWorldEditorCatalog(files,strings).root);
  assert.equal(find('Items','Item abilities'),undefined,'entries without a model stay out of the Models tab');
  assert.equal(find('Items','Artifact','Crown of Kings +5').icon,'ReplaceableTextures\\CommandButtons\\BTNHelmutPurple.blp');
  assert.deepEqual(find('Doodads').children.map(node=>node.name),['Ashenvale','Barrens']);
  assert.deepEqual(find('Doodads','Ashenvale').children.map(node=>node.name),['Environment','Props','Trees/Destructibles']);
  assert.deepEqual(find('Doodads','Ashenvale','Environment','Mushrooms').models.map(model=>model.label+':'+model.path),['Variation 1:Doodads\\Ashenvale\\Plants\\AshenShrooms\\AshenShrooms0.mdx','Variation 2:Doodads\\Ashenvale\\Plants\\AshenShrooms\\AshenShrooms1.mdx']);
  assert.ok(find('Doodads','Barrens','Props','Birds'),'"*" doodads appear in every tileset');
  assert.equal(find('Doodads','Ashenvale','Props').icon,'ReplaceableTextures\\WorldEditUI\\Doodad-Prop.blp');
  assert.ok(find('Doodads','Ashenvale','Trees/Destructibles','Ashenvale Tree Wall'));
});

test('profile and model path helpers',()=>{
  assert.deepEqual(modelPaths('a\\b.mdl'),['a\\b.mdx']);
  assert.deepEqual(modelPaths('_'),[]);
  assert.equal(parseProfile('[x]\n// note\nName="Quoted, name"\n').get('x').get('name'),'"Quoted, name"');
});

test('unit labels use fixed character names across races and retain classes for random hero pools',()=>{
  const units=[
    ['Hjai','Archmage','Jaina',''],['Hart','Paladin','Arthas',''],
    ['Harf','Paladin','Arthas','(wielding Frostmourne)'],['Huth','Paladin','Uther',''],
    ['Hkal','Blood Mage','Kael',''],['Hmbr','Mountain King','Muradin Bronzebeard',''],
    ['Othr','Far Seer','Thrall',''],['Ogrh','Blademaster','Grommash Hellscream',''],
    ['Etyr','Priestess of the Moon','Tyrande',''],['Ewrd','Warden','Maiev',''],
    ['Uear','Death Knight','Arthas','(Evil)'],['Uktl','Lich',"Kel'Thuzad",'(Lich)'],
    ['Uwar','Warlock','Archimonde',''],['Nsjs','Brewmaster','Chen Stormstout',''],
    ['Hpal','Paladin','Granis Darkhammer,Jorn the Redeemer',''],
    ['Npld','Pit Lord','"Azgalor,Brutillus,Magtheridon"',''],
    ['hfoo','Footman','_',''],['hpea','Peasant','-',''],
  ];
  const source=new Map([
    ['units\\unitui.slk',slk(['unitUIID','name','campaign','inEditor'],units.map(([id])=>[id,id,1,1]))],
    ['units\\unitdata.slk',slk(['unitID','race'],units.map(([id])=>[id,'human']))],
    ['units\\unitskin.txt',units.map(([id])=>`[${id}]\nfile=Units\\${id}`).join('\n')],
  ]);
  const locale=units.map(([id,name,proper,suffix])=>`[${id}]\nName=${name}\nPropernames=${proper}\nEditorSuffix=${suffix}`).join('\n');
  const {root}=buildWorldEditorCatalog(source,[locale]);
  const leaves=new Map();const visit=node=>node.children?node.children.forEach(visit):leaves.set(node.id,node);visit(root);
  for(const [id,name,proper,suffix] of units){
    const expected=['Hpal','Npld','hfoo','hpea'].includes(id)?name:proper;
    assert.equal(leaves.get(id).name,expected+(suffix?' '+suffix:''),id);
    assert.equal(leaves.get(id).models[0].path,`Units\\${id}.mdx`);
  }
});

test('locale overlays preserve partial fields, version names and case-sensitive unit identities',()=>{
  const source=new Map([
    ['units\\unitui.slk',slk(['unitUIID','name','campaign','inEditor'],[['Hjai','jaina',1,1],['hjai','other',0,1],['Hpal','paladin',0,1]])],
    ['units\\unitdata.slk',slk(['unitID','race'],[['Hjai','human'],['hjai','human'],['Hpal','human']])],
    ['units\\unitskin.txt','[Hjai]\nfile=Units\\Jaina\n[hjai]\nfile=Units\\Other\n[Hpal]\nfile=Units\\Paladin'],
  ]);
  const locales=[
    '[Hjai]\nName=Archmage\nPropernames="Jaina"\nEditorSuffix=(Campaign)\n[hjai]\nName=Other unit\n[Hpal]\nName=Paladin\nPropernames="Granis Darkhammer,Jorn the Redeemer"',
    '[Hjai]\nName:hd=Archmage HD\nPropernames:hd=Jaina Proudmoore\nPropernames:de=Джайна\nEditorSuffix:hd=(Reforged)\n[Hpal]\nName:hd=Paladin HD',
  ];
  for(const [skin,expected] of [['sd','Jaina (Campaign)'],['hd','Jaina Proudmoore (Reforged)'],['de','Джайна (Campaign)']]){
    const {root}=buildWorldEditorCatalog(source,locales,{skin}),find=finder(root);
    assert.equal(find('Human','Units','Campaign heroes',expected).id,'Hjai');
    assert.equal(find('Human','Units','Normal','Other unit').id,'hjai');
    assert.equal(find('Human','Units','Heroes',skin==='hd'?'Paladin HD':'Paladin').id,'Hpal');
  }
});

test('particle origins follow shared spells, all levels, buff art, item grants, projectiles and doodad variations',()=>{
  const input=new Map(files);
  input.set('units\\unitabilities.slk',slk(['unitAbilID','abilList','heroAbilList'],[['hfoo','Ahea','-'],['Hpal','_','Ahea']]));
  input.set('units\\abilitydata.slk',slk(['alias','comments','BuffID2','EfctID1','UnitID1'],[['Ahea','Heal','Bhea','-','_']]));
  input.set('units\\abilityskin.txt',input.get('units\\abilityskin.txt')+'\n[Bhea]\nTargetart=Effects/Buff.MDL\nAreaEffectArt= _ \nSpecialart=-');
  input.set('units\\itemdata.slk',slk(['itemID','class','abilList'],[['ckng','Artifact','Ahea']]));
  input.set('units\\humanunitfunc.txt','[hfoo]\nMissileart=Weapons/Arrow.mdl\nSpecialart=Death/Bones\n[hbar]\nMissileart=-');
  input.set('units\\unitbalance.slk',slk(['id','upgrades'],[['hfoo','Rtest']]));
  input.set('units\\upgradeskin.txt','[Rtest]\nEffectart=Effects/Upgrade.mdl');
  const {objects}=buildWorldEditorCatalog(input,strings,{particleOrigins:true});
  const paths=['Abilities/Spells/Human/Heal/HealTarget.mdx','EFFECTS/Buff.MDX','weapons/arrow.mdx','Doodads/Ashenvale/Plants/AshenShrooms/AshenShrooms1.mdx','misc/unlinked.mdx','Death/Bones.mdx','Units/Human/Footman/Footman_v1_portrait.mdx','effects/upgrade.mdx'];
  const entries=paths.map((path,i)=>({id:String(i),name:'Pale particles',categories:['Other'],sources:[{physicalPath:'war3.w3mod:'+path}]}));
  entries[0].sources.push({physicalPath:'war3.w3mod:Doodads/Ashenvale/Plants/AshenShrooms/AshenShrooms0.mdl'});
  const browse=buildParticleBrowse(objects,entries);
  const get=(id,title)=>browse.objects.find(o=>o.id===id)?.groups.find(g=>g.title===title)?.refs.flatMap(ref=>browse.buckets[ref]);
  for(const id of ['hfoo','Hpal','ckng']){
    assert.deepEqual(get(id,'Heal · Target'),['0']);
    assert.deepEqual(get(id,'Heal · Buff · Bhea · Target'),['1']);
  }
  assert.deepEqual(get('hfoo','Attack/Missile'),['2']);
  assert.deepEqual(get('hfoo','Death/Special'),['5']);
  assert.deepEqual(get('hfoo','Model'),['6']);
  assert.deepEqual(get('hfoo','Rtest · Effect'),['7']);
  assert.deepEqual(get('APms','Model'),['0','3']);
  assert.deepEqual(browse.other,['4']);
  assert.ok(!browse.objects.some(o=>o.id==='hbar'));
  assert.ok(!objects.flatMap(o=>o.art).some(a=>/^(?:-|_|)\.mdx$/.test(a.path)));
});

test('duplicate repair is order independent, retains reviewed names and uses evidence before numbering',()=>{
  const entry=(id,name,emitterName)=>({id,name,categories:['Other'],sources:[{physicalPath:'war3.w3mod:A.mdx',emitterName}]});
  const items=[entry('a','Red particles','BlizSmoke'),entry('b','Red particle','Flame'),entry('c','Red particles 7','Sparks')];
  const origins=new Map(items.map(item=>[item.id,{name:'Heal — target',path:'HealTarget.mdl'}]));
  const review=item=>item.id==='c'?{name:'Reviewed stars'}:null;
  const result=distinctParticleNames(items,origins,new Map(),review);
  assert.deepEqual(result,distinctParticleNames([...items].reverse(),origins,new Map(),review));
  assert.equal(result.c,undefined);
  assert.deepEqual(result.a.categories,['Smoke']);assert.deepEqual(result.b.categories,['Fire']);
  assert.notEqual(result.a.name,result.b.name);assert.match(result.a.name,/Heal/);
  assert.doesNotMatch(result.a.name+result.b.name,/variant/);
});

test('folder variants resolve only within the same parent and an existing exact path wins even if empty',()=>{
  const object={folders:[['Units']],art:['Units/Race/Old/Cin.mdl','Units/Race/Correct/Other.mdx','Units/Race/Wrong/Ambiguous.mdx','Units/Race/Wrong/Foreign.mdx'].map(path=>({path}))};
  const paths=['Units/Race/New/Cin.mdx','Units/Race/Correct/Other.mdx','Units/Race/Sibling/Other.mdx','Units/Race/A/Ambiguous.mdx','Units/Race/B/Ambiguous.mdx','Units/Other/F/Foreign.mdx'];
  assert.deepEqual(resolveParticleArtPaths([object],paths)[0].art.map(a=>a.path),['units\\race\\new\\cin.mdx',...object.art.slice(1).map(a=>a.path)]);
});
