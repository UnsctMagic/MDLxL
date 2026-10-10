import {prepare, searchDetailed, norm} from './texture-library/phrase-search.mjs';
import {russianTextureQuery} from './texture-library/russian-query.mjs';

// These are kitbash suggestions, never claims that Warcraft contains another franchise's assets.
const inspirations = [
  {name:'Nurgle',words:['nurgle','plague marine','plaguebearer','great unclean one'],tags:['undead-body','skin','blood','rust'],traits:['rotten','blighted','poisonous','green','stitched','bloody'],subjects:/abomination|plague|disease|flesh|zombie|sludge|fester/},
  {name:'Khorne',words:['khorne','bloodthirster','berserker'],tags:['demon-body','metal','blades','horn','blood'],traits:['red','spiked','bloody','axe','skull'],subjects:/chaos|felguard|pitlord|doomguard|blood/},
  {name:'Tzeentch',words:['tzeentch','lord of change'],tags:['feathers','eye','magic','demon-body'],traits:['blue','purple','ornate','rune'],subjects:/raven|hawk|sorcer|warlock|arcane/},
  {name:'Slaanesh',words:['slaanesh','daemonette'],tags:['demon-body','skin','leather','gold'],traits:['purple','pink','ornate','claw'],subjects:/succub|demoness|sorcer/},
  {name:'Warhammer Chaos',words:['warhammer chaos','warriors of chaos','chaos warrior','chaos space marine'],tags:['plate','metal','horn','blades'],traits:['spiked','dark','skull','ornate'],subjects:/chaos|felguard|doomguard|pitlord/},
  {name:'Skaven',words:['skaven','ratman','ratmen','verminlord'],tags:['fur','leather','wood','metal'],traits:['dirty','torn','green','poisonous'],subjects:/rat|kobold|gnoll|vermin/},
  {name:'Bretonnia',words:['bretonnia','bretonnian','grail knight'],tags:['plate','chain','cloth','emblem','banner'],traits:['heraldic','ornate','shield','horse'],subjects:/knight|paladin|human/},
  {name:'The Empire',words:['warhammer empire','empire soldier','warhammer imperial'],tags:['plate','cloth','leather','blades','emblem'],traits:['red','white','gun','helmet'],subjects:/footman|rifleman|knight|captain|militia/},
  {name:'Greenskins',words:['warhammer orc','greenskin','greenskins','gork','mork'],tags:['orc-body','metal','leather','blades'],traits:['green','rough','spiked','axe'],subjects:/orc|grunt|goblin|ogre/},
  {name:'Tomb Kings',words:['tomb kings','tomb king','nehekhara'],tags:['bone','gold','cloth','stone'],traits:['skeletal','ancient','carved'],subjects:/skeleton|crypt|tomb|nerub/},
  {name:'Vampire Counts',words:['vampire counts','vampire count','von carstein'],tags:['undead-body','bone','cloth','plate'],traits:['dark','bloody','skeletal','ornate'],subjects:/vampir|dreadlord|necromancer|banshee|skeleton/},
  {name:'Mordor',words:['mordor','sauron','morgul','orcs of mordor'],tags:['orc-body','plate','metal','leather','blades'],traits:['dark','spiked','rough','worn','rusty'],subjects:/orc|chaos|felguard|grunt|warlock/},
  {name:'Isengard',words:['isengard','uruk hai','uruk-hai','urukhai'],tags:['orc-body','plate','metal','leather'],traits:['dark','rough','worn','shield'],subjects:/grunt|orc|chaos|footman/},
  {name:'Rohan',words:['rohan','rohirrim','theoden'],tags:['leather','chain','wood','cloth','emblem'],traits:['green','brown','horse','shield'],subjects:/knight|rider|horse|militia|bandit/},
  {name:'Gondor',words:['gondor','numenor','numenorean','faramir','boromir'],tags:['plate','chain','cloth','emblem'],traits:['white','black','shield','helmet'],subjects:/footman|knight|captain|paladin/},
  {name:'Nazgûl',words:['nazgul','ringwraith','witch king','witchking'],tags:['cloth','plate','metal'],traits:['black','dark','hood','torn','spiked'],subjects:/wraith|acolyte|ghost|deathknight|necromancer/},
  {name:'Balrog',words:['balrog','durins bane'],tags:['demon-body','horn','fire','wing'],traits:['dark','red','burnt'],subjects:/demon|doomguard|pitlord|infernal|firelord/},
  {name:'Elven craft',words:['rivendell','lothlorien','lothlorien elf','high elves','high elf','ulthuan'],tags:['elf-body','cloth','gold','wood','plate'],traits:['ornate','carved','green','blue','gold-color'],subjects:/elf|ranger|archer|sorcer|priest/},
  {name:'Dwarven craft',words:['erebor','moria','khazad dum','ironbreakers','dawi','warhammer dwarf'],tags:['dwarf-body','metal','plate','stone','gold'],traits:['carved','rune','hammer','bearded'],subjects:/dwarf|rifleman|mountainking|gryphon/},
  {name:'Dark elves',words:['dark elves','dark elf','druchii','naggaroth'],tags:['elf-body','plate','leather','blades'],traits:['dark','purple','spiked','ornate'],subjects:/elf|warden|assassin|ranger/},
  {name:'Wood elves',words:['wood elves','wood elf','asrai','athel loren','mirkwood'],tags:['elf-body','wood','foliage','leather'],traits:['green','brown','bow','carved'],subjects:/elf|archer|ranger|dryad|treant/},
  {name:'Warhammer fantasy',words:['warhammer fantasy','warhammer','age of sigmar'],tags:['plate','metal','leather','blades','emblem','bone'],traits:['ornate','worn','spiked','rune'],subjects:/chaos|knight|paladin|orc|dwarf|skeleton/},
  {name:'Middle-earth',words:['lord of the rings','middle earth','tolkien','lotr','the hobbit'],tags:['plate','chain','leather','wood','elf-body','orc-body','dwarf-body'],traits:['worn','carved','ornate'],subjects:/knight|rider|orc|dwarf|elf|ranger|bandit/},
];
const normalizedPath = value => String(value || '').replaceAll('/','\\').toLowerCase();
const textureFormat = item => String(item?.path || '').split(/[\\/]/).at(-1).split('.').at(-1).toLowerCase();
export function textureFormatMatches(item,format='all') {
  return format === 'all' || format === textureFormat(item);
}
export function folderContains(sourcePath,folder) {
  if (!folder) return true;
  const full = normalizedPath(sourcePath), parent = normalizedPath(folder).replace(/[\\:]$/,'');
  return full === parent || full.startsWith(parent+'\\') || full.startsWith(parent+':');
}
export function textureFolderTree(items) {
  const root={path:'',name:'All folders',count:items.length,children:new Map()};
  for (const item of items) {
    const folder = item.source==='custom'?'Model folder':item.folder;
    if (!folder) continue;
    const segments=folder.match(/[^\\:]+[:\\]?/g)||[],parts=[];
    let node=root;
    for (const segment of segments) {
      parts.push(segment); const key=parts.join('').replace(/[\\:]$/,''), name=segment.replace(/[\\:]$/,'');
      if(!node.children.has(key))node.children.set(key,{path:key,name,count:0,children:new Map()});
      node=node.children.get(key);node.count++;
    }
  }
  const flatten=node=>({...node,children:[...node.children.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(flatten)});
  return flatten(root);
}
export function prepareTextureLibrary(items) {
  // Native paths without reviewed metadata need name search, not an expensive
  // appearance inference pass. Never infer an HD surface from its SD counterpart.
  return prepare(items.map(item=>item.searchIndex?item:{...item,searchIndex:{version:4,traits:[]}}));
}
const literalFields=new WeakMap(),filteredSources=new WeakMap();
function literalFieldsFor(item) {
  let fields=literalFields.get(item);
  if(!fields){fields={text:norm(item.name+' '+item.path+' '+item.sourcePath),name:norm(item.name),leaf:norm(item.path.split(/[\\/]/).at(-1).replace(/\.[^.]+$/,''))};literalFields.set(item,fields);}
  return fields;
}
function filteredSource(items,{variant='all',kind='all',format='all',folder=''}) {
  let cache=filteredSources.get(items);if(!cache){cache=new Map();filteredSources.set(items,cache);}
  const key=JSON.stringify([variant,kind,format,folder]);
  if(cache.has(key))return cache.get(key);
  const matches=items.filter(item=>(variant==='all'||item.variant===variant)&&(kind==='all'||item.kinds.includes(kind))&&textureFormatMatches(item,format)&&(item.source==='custom'?(!folder||folder==='Model folder'):folderContains(item.sourcePath,folder)));
  matches.vocabulary=items.vocabulary;cache.set(key,matches);
  if(cache.size>8)cache.delete(cache.keys().next().value);
  return matches;
}
function literalTextureLibraryResults(source,query,limit) {
  const q=norm(query),parts=q.split(/\s+/).filter(Boolean);
  const items=source.filter(item=>parts.every(part=>literalFieldsFor(item).text.includes(part))).sort((a,b)=>{
    const score=t=>{const fields=literalFieldsFor(t);return fields.name===q?4:fields.leaf===q?3:fields.name.startsWith(q)?2:1;};
    return score(b)-score(a)||(b.priority||0)-(a.priority||0)||a.name.localeCompare(b.name);
  });
  return {items:items.slice(0,limit),total:items.length,meanings:[],unknown:[],notice:'',hasMore:items.length>limit};
}
function resolutionSearch(items,query) {
  const sizes=[];let highResolution=false;
  // Keep quoted names, field queries and native paths literal. Size words are
  // constraints in both search modes, rather than filename substrings.
  const remaining=String(query).replace(/(?:\S+:)?"[^"]*"|\S*[:\\/.]\S*|(?<!\S)high\s+resolution(?=\s|$)|\S+/gi,token=>{
    if(/^high\s+resolution$/i.test(token)){highResolution=true;return '';}
    if(/^\d+$/.test(token)){sizes.push(Number(token));return '';}
    return token;
  }).trim();
  return {query:remaining,items:items.filter(item=>{
    if(!sizes.length&&!highResolution)return true;
    if(!(item.width>0&&item.height>0))return false;
    return sizes.every(size=>item.width===size||item.height===size)&&(!highResolution||Math.max(item.width,item.height)>=512);
  })};
}
/** Empty and literal searches work before the richer Vibe index is prepared. */
export function initialTextureLibraryResults(items,{query='',folder='',variant='all',kind='all',format='all',limit=120}={}) {
  const source=filteredSource(items,{variant,kind,format,folder});
  const resolution=resolutionSearch(source,query);query=resolution.query;
  const matches=resolution.items;
  if(query.trim())return literalTextureLibraryResults(matches,query,limit);
  for(const item of source)literalFieldsFor(item);
  matches.sort((a,b)=>(b.priority||0)-(a.priority||0)||a.name.localeCompare(b.name));
  return {items:matches.slice(0,limit),total:matches.length,meanings:[],unknown:[],notice:'',hasMore:matches.length>limit};
}
function inspirationFor(query) {
  const q=norm(query).replaceAll('-',' ');
  for(const definition of inspirations)for(const phrase of [...definition.words].sort((a,b)=>b.length-a.length)) {
    const normalized=norm(phrase).replaceAll('-',' '), position=(' '+q+' ').indexOf(' '+normalized+' ');
    if(position!==-1)return {definition,remaining:(q.slice(0,position)+' '+q.slice(position+normalized.length)).trim()};
  }
  return null;
}
function inspirationScore(item,definition) {
  const tagged=definition.tags.filter(tag=>item._tags.has(tag));
  const traits=definition.traits.filter(trait=>item._traits.has(trait));
  const named=definition.subjects.test((item._name+' '+item._leaf).replaceAll(' ',''));
  // Require a recognisable source subject, or several separate surface clues.
  if(!named && (tagged.length<2 || traits.length<2))return null;
  return {score:(named?100:0)+tagged.length*12+traits.length*10,reason:[named?'Related native subject':null,...tagged.slice(0,3),...traits.slice(0,3)].filter(Boolean).join(' · ')};
}
export function searchTextureLibrary(prepared,{query='',vibe=true,folder='',variant='all',kind='all',format='all',limit=120}={}) {
  const source=filteredSource(prepared,{variant,kind,format,folder});
  if(!vibe){const resolution=resolutionSearch(source,query);return literalTextureLibraryResults(resolution.items,resolution.query,limit);}
  const q=norm(query);
  const descriptionQuery=russianTextureQuery(query),inspiration=inspirationFor(descriptionQuery);
  let searchQuery=inspiration?.remaining??descriptionQuery,notice=inspiration?'Native Warcraft textures suggested for '+inspiration.definition.name+' kitbashing.':'';
  const nail=/\bnails?\b/i.test(searchQuery);
  if(nail) {
    searchQuery=searchQuery.replace(/\bugly\b/gi,'weathered').replace(/\bnails?\b/gi,'metal');
    notice='Metal, spikes and fasteners that may suit a nail. Check the sheet before using it.';
  }
  const result=searchDetailed(source,{query:searchQuery,kind,includeClose:true,resultLimit:inspiration||nail?Infinity:limit});
  let items=result.items;
  if(inspiration) {
    items=items.map(item=>({item,match:inspirationScore(item,inspiration.definition)})).filter(row=>row.match).sort((a,b)=>b.match.score-a.match.score+(b.item._match?.score-a.item._match?.score)*.01).map(({item,match})=>({...item,_match:{...item._match,type:'inspiration',inspiration:inspiration.definition.name,reason:match.reason}}));
  }
  if(nail)items.sort((a,b)=>{
    const fasteners=t=>Number(t._traits.has('spiked'))*30+Number(t._traits.has('riveted'))*25+Number(t._traits.has('rusty'))*80;
    return fasteners(b)-fasteners(a)||(b._match?.score||0)-(a._match?.score||0);
  });
  const total=inspiration||nail?items.length:result.totalCount;
  return {items:items.slice(0,limit),total,meanings:result.meanings,unknown:result.unknown,notice,hasMore:total>limit};
}
