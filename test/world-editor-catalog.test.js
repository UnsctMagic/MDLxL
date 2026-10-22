import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorldEditorCatalog,parseProfile,modelPaths} from '../src/world-editor-catalog.js';

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
  assert.ok(find('Items','Item abilities','Gold'));
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
