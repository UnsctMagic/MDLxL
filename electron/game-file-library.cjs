const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { gamePathKey } = require('./game-path.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,24);

// File families shown by the Library's game-file browser. Anything else is "other".
const FILE_TYPES = {
  models: ['mdx','mdl'],
  textures: ['blp','dds','tga','png','jpg','jpeg','webp'],
  sounds: ['wav','mp3','ogg','flac'],
  text: ['txt','slk','fdf','toc','j','ai','wai','ini','json','html','htm','js','css','csv','pld','srt','lua','xml','wts','swatch'],
  maps: ['w3x','w3m','w3n','w3xd'],
  video: ['webm','avi','mp4','bik'],
  fonts: ['ttf','otf'],
};
const TYPE_OF = new Map(Object.entries(FILE_TYPES).flatMap(([type,extensions]) => extensions.map(extension => [extension,type])));
const VARIANT_LABEL = {classic:'Classic',reforged:'Reforged','forsaken-kingdom':'Forsaken Kingdom',language:'Other languages',other:'Teen and retired versions'};
const VARIANT_ORDER = ['classic','reforged','forsaken-kingdom','language','other'];
const LOCALE_LABEL = {enus:'English (US)',dede:'German',eses:'Spanish (Spain)',esmx:'Spanish (Mexico)',frfr:'French',itit:'Italian',kokr:'Korean',plpl:'Polish',ptbr:'Portuguese (Brazil)',ruru:'Russian',zhcn:'Chinese (Simplified)',zhtw:'Chinese (Traditional)'};
const PAGE = 200;
const TYPE_LABEL = {models:'Models',textures:'Textures',sounds:'Sounds',text:'Text & data',maps:'Maps',video:'Videos',fonts:'Fonts',other:'Other files'};
const SOUND_FOLDERS = new Map([
  ['sound\\dialogue','Campaign dialogue'], ['sound\\cinematics','Cinematics'], ['movies\\audio','Cinematics'],
  ['sound\\ambient','Ambient'], ['sound\\time','Ambient'], ['sound\\interface','Interface'],
  ['sound\\music\\mp3music','Music'], ['sound\\music','Music'],
  ['sound\\units\\combat','Combat'], ['abilities\\weapons','Combat'], ['abilities\\spells','Spells'],
  ['sound\\units','Units'], ['units','Units'], ['sound\\buildings','Buildings'], ['buildings','Buildings'],
  ['sound\\destructibles','Doodads'], ['doodads','Doodads'],
]);
const RACE_LABEL = {human:'Human',orc:'Orc',nightelf:'Night Elf',undead:'Undead',naga:'Naga',creeps:'Neutral Hostile',critters:'Neutral Passive'};

function soundFolders(entry, segments) {
  for (const [prefix, group] of SOUND_FOLDERS) {
    if (entry.folderKey !== prefix && !entry.folderKey.startsWith(prefix + '\\')) continue;
    const rest = segments.slice(prefix.split('\\').length);
    if (rest.length && ['Units','Buildings','Spells'].includes(group)) rest[0] = RACE_LABEL[rest[0].toLowerCase()] || rest[0];
    return [group,...rest];
  }
  return ['Other sounds',...segments];
}

// The World Editor layout gives each installed file one place in the tree.
// Its folders are display paths; the file IDs and physical archive paths stay the same.
function worldEditorFolders(index) {
  if (index.worldEditor) return index.worldEditor;
  const folders = new Map([['',{path:'',name:'All game files',parent:null,children:new Set(),files:[]}]]);
  const entryFolders = [];
  for (const entry of index.entries) {
    const segments = entry.path.split('\\').slice(0,-1), label = TYPE_LABEL[entry.type];
    const groups = entry.type === 'sounds' ? soundFolders(entry,segments) : segments;
    if (groups[0]?.toLowerCase() === label.toLowerCase()) groups.shift();
    let key = entry.type;
    if (!folders.has(key)) {
      folders.set(key,{path:label,name:label,parent:'',children:new Set(),files:[]});
      folders.get('').children.add(key);
    }
    for (const [depth,name] of groups.entries()) {
      const parent = folders.get(key), next = key + '\\' + name.toLowerCase();
      if (!folders.has(next)) {
        const iconFolder = entry.type === 'sounds' && depth === 2 && /^(units|buildings)\\[^\\]+\\[^\\]+/.test(entry.folderKey)
          ? entry.folderKey.split('\\').slice(0,3).join('\\') : null;
        folders.set(next,{path:parent.path+'\\'+name,name,parent:key,children:new Set(),files:[],iconFolder});
        parent.children.add(next);
      }
      key = next;
    }
    folders.get(key).files.push(entry.id);
    entryFolders[entry.id] = key;
  }
  return index.worldEditor = {folders,entryFolders};
}

/** Split a CASC name into its module chain and logical game path, and classify it like the texture library does. */
function classifyGameFile(sourcePath, installedLocales = []) {
  const name = String(sourcePath || '');
  if (!/^war3\.w3mod:/i.test(name)) return null;
  const parts = name.split(':'), logical = parts.pop(), modules = parts.slice(1).map(part => part.toLowerCase());
  if (!logical || /[\\/]$/.test(logical)) return null;
  const locale = modules.map(module => module.match(/^_locales\\([a-z]{4})\.w3mod$/)?.[1]).find(Boolean);
  let variant = 'classic', module = modules.includes('_de.w3mod') ? 'Forsaken Kingdom' : modules.includes('_hd.w3mod') ? 'Reforged' : 'Classic';
  if (locale && !installedLocales.includes(locale)) variant = 'language';
  else if (modules.includes('_deprecated.w3mod') || modules.includes('_teen.w3mod')) variant = 'other';
  else if (modules.includes('_de.w3mod')) variant = 'forsaken-kingdom';
  else if (modules.includes('_hd.w3mod')) variant = 'reforged';
  const extra = modules.filter(module => module !== '_hd.w3mod' && module !== '_de.w3mod').map(module => {
    const tileset = module.match(/^_tilesets\\([a-z])\.w3mod$/); if (tileset) return 'tileset ' + tileset[1].toUpperCase();
    if (/^_locales\\/.test(module)) return LOCALE_LABEL[locale] || locale;
    if (/^_balance\\/.test(module)) return 'balance ' + module.slice(9).replace(/\.w3mod$/,'');
    if (module === '_teen.w3mod') return 'teen version';
    return module.replace(/^_/,'').replace(/\.w3mod$/,'');
  });
  if (extra.length) module += ' · ' + extra.join(' · ');
  const extension = logical.includes('.') ? logical.split('.').at(-1).toLowerCase() : '';
  return {logical,variant,module,extension,type:TYPE_OF.get(extension) || 'other'};
}

/** Learn real capitalisation (Units\Human\Footman) from the reviewed texture catalogue; CASC names are lower case. */
function casingDictionary(paths) {
  const words = new Map();
  for (const value of paths) for (const segment of String(value).split(/[\\/]/)) {
    const stem = segment.replace(/\.[^.]+$/,'');
    if (/[A-Z]/.test(stem) && !words.has(stem.toLowerCase())) words.set(stem.toLowerCase(),stem);
  }
  return words;
}
function displaySegment(segment, words, leaf = false) {
  const dot = leaf ? segment.lastIndexOf('.') : -1, stem = dot > 0 ? segment.slice(0,dot) : segment, extension = dot > 0 ? segment.slice(dot) : '';
  const known = words.get(stem.toLowerCase());
  return (known || stem.charAt(0).toUpperCase() + stem.slice(1)) + extension;
}

// Both libraries resolve tables from the base game and strings from the same installed locale.
async function readWorldEditorSources(names, locale, files, isString, read) {
  const paths = new Set(names), result = {files:[], strings:[]}, decoder = new TextDecoder();
  for (const file of files) {
    const logical = gamePathKey(file), physical = 'war3.w3mod:' + logical;
    if (paths.has(physical)) result.files.push([logical, decoder.decode(await read(physical))]);
  }
  if (locale) {
    const prefix = 'war3.w3mod:_locales\\' + locale + '.w3mod:';
    for (const name of paths) if (name.startsWith(prefix) && isString(name.slice(prefix.length)))
      result.strings.push(decoder.decode(await read(name)));
  }
  return result;
}

class GameFileLibrary {
  constructor({ casc, catalogFile = path.join(__dirname,'data','texture-library-catalog.json'), readFile = fs.readFile } = {}) {
    Object.assign(this,{casc,catalogFile,readFile});
    this.index = null; this.loading = null; this.counts = new Map();
  }
  async words() {
    try { return casingDictionary(JSON.parse(await this.readFile(this.catalogFile,'utf8')).items.map(item => item.path)); } catch { return new Map(); }
  }
  async load(cascFolders) {
    const key = JSON.stringify(cascFolders || []);
    if (this.index?.request === key) return this.index;
    if (this.loading?.request === key) return this.loading.job;
    const job = (async () => {
      const [listing,words] = await Promise.all([this.casc?.listFiles(cascFolders) || {sources:[],errors:[]},this.words()]);
      const entries = [], byName = new Map(), folders = new Map([['',{path:'',name:'All game files',parent:null,children:new Set(),files:[]}]]);
      const folderFor = key => {
        if (folders.has(key)) return folders.get(key);
        const cut = key.lastIndexOf('\\'), parentKey = cut < 0 ? '' : key.slice(0,cut), parent = folderFor(parentKey);
        const name = displaySegment(key.slice(cut + 1),words), node = {path:(parent.path ? parent.path + '\\' : '') + name,name,parent:parentKey,children:new Set(),files:[]};
        folders.set(key,node); parent.children.add(key); return node;
      };
      for (const [sourceIndex,source] of listing.sources.entries()) for (const [position,sourcePath] of source.names.entries()) {
        const info = classifyGameFile(sourcePath,source.locales);
        if (!info) continue;
        const lower = info.logical.toLowerCase(), cut = lower.lastIndexOf('\\'), folderKey = cut < 0 ? '' : lower.slice(0,cut);
        const folder = folderFor(folderKey), name = displaySegment(info.logical.slice(cut + 1),words,true);
        const entry = {id:entries.length,name,path:(folder.path ? folder.path + '\\' : '') + name,lower,leaf:lower.slice(cut + 1),folderKey,sourcePath,sourceIndex,contentKey:source.keys[sourcePath.toLowerCase()] || '',size:source.sizes?.[position] || 0,...info};
        folder.files.push(entry.id); entries.push(entry); byName.set(sourcePath.toLowerCase(),entry);
      }
      const signature = hash('files-1|' + listing.sources.map(source => source.key).join('|'));
      return {request:key,signature,entries,byName,folders,sources:listing.sources.map(({folder,key,locales}) => ({folder,key,locales})),errors:listing.errors};
    })();
    this.loading = {request:key,job};
    try { const index = await job; this.index = index; this.counts.clear(); return index; }
    finally { if (this.loading?.job === job) this.loading = null; }
  }
  matches(entry, {variant = 'classic', type = 'all'} = {}) {
    return (variant === 'all' || entry.variant === variant) && (type === 'all' || entry.type === type);
  }
  folderCounts(index, filters) {
    const layout = filters.worldEditor ? worldEditorFolders(index) : null;
    const key = index.signature + '|' + (filters.variant || 'classic') + '|' + (filters.type || 'all') + '|' + !!layout;
    if (this.counts.has(key)) return this.counts.get(key);
    const counts = new Map(), folders = layout?.folders || index.folders;
    for (const entry of index.entries) {
      if (!this.matches(entry,filters)) continue;
      let folder = layout?.entryFolders[entry.id] ?? entry.folderKey;
      for (;;) { counts.set(folder,(counts.get(folder) || 0) + 1); if (!folder) break; folder = folders.get(folder).parent; }
    }
    this.counts.set(key,counts); while (this.counts.size > 16) this.counts.delete(this.counts.keys().next().value);
    return counts;
  }
  publicEntry(entry) {
    const {id,name,path:logicalPath,variant,module,extension,type,size,folderKey} = entry;
    return {id,name,path:logicalPath,variant,module,extension,type,size,folder:folderKey};
  }
  summary(index) {
    const totals = {};
    for (const entry of index.entries) totals[entry.variant] = (totals[entry.variant] || 0) + 1;
    return {signature:index.signature,total:index.entries.length,totals,errors:index.errors,sources:index.sources.length};
  }
  /** Immediate subfolders (with counts for the filters) and the files directly inside one folder. */
  browse(index, {folder = '', variant = 'classic', type = 'all', worldEditor = false, offset = 0, limit = PAGE} = {}) {
    const tree = worldEditor ? worldEditorFolders(index).folders : index.folders;
    const key = String(folder || '').toLowerCase(), node = tree.get(key);
    if (!node) return {signature:index.signature,folder:null,crumbs:[],folders:[],files:[],total:0,hasMore:false};
    const counts = this.folderCounts(index,{variant,type,worldEditor});
    const folders = [...node.children].filter(child => counts.get(child)).map(child => {
      const {path,name,iconFolder} = tree.get(child);
      return {key:child,path,name,count:counts.get(child),...(iconFolder?{iconFolder}:{})};
    }).sort((a,b) => a.name.localeCompare(b.name));
    const files = node.files.map(id => index.entries[id]).filter(entry => this.matches(entry,{variant,type})).sort((a,b) => a.name.localeCompare(b.name) || a.module.localeCompare(b.module));
    const crumbs = []; for (let at = key; at; at = tree.get(at).parent) crumbs.unshift({key:at,name:tree.get(at).name});
    const start = Math.max(0,Number(offset) || 0), size = Math.min(10000,Math.max(1,Number(limit) || PAGE));
    return {signature:index.signature,folder:{key,path:node.path,name:node.name,count:counts.get(key) || 0},crumbs,folders,files:files.slice(start,start + size).map(entry => this.publicEntry(entry)),total:files.length,hasMore:start + size < files.length};
  }
  /** Every word must appear in the game path. Exact and leading file-name matches rank first. */
  search(index, {query = '', folder = '', variant = 'classic', type = 'all', worldEditor = false, offset = 0, limit = PAGE} = {}) {
    const q = gamePathKey(query).trim(), words = q.split(/\s+/).filter(Boolean), scope = String(folder || '').toLowerCase();
    if (!words.length) return this.browse(index,{folder,variant,type,worldEditor,offset,limit});
    const layout = worldEditor ? worldEditorFolders(index) : null;
    const rank = entry => { const stem = entry.leaf.replace(/\.[^.]+$/,''); return stem === q || entry.leaf === q ? 0 : stem.startsWith(words[0]) ? 1 : words.every(word => entry.leaf.includes(word)) ? 2 : 3; };
    const found = [];
    for (const entry of index.entries) {
      if (!this.matches(entry,{variant,type})) continue;
      const group = layout?.entryFolders[entry.id] ?? entry.folderKey;
      if (scope && group !== scope && !group.startsWith(scope + '\\')) continue;
      const browsePath = layout?.folders.get(group).path;
      if (words.every(word => entry.lower.includes(word) || browsePath?.toLowerCase().includes(word))) found.push({entry,rank:rank(entry),browsePath});
    }
    found.sort((a,b) => a.rank - b.rank || a.entry.lower.length - b.entry.lower.length || a.entry.sourcePath.length - b.entry.sourcePath.length || a.entry.lower.localeCompare(b.entry.lower) || VARIANT_ORDER.indexOf(a.entry.variant) - VARIANT_ORDER.indexOf(b.entry.variant));
    const start = Math.max(0,Number(offset) || 0), size = Math.min(1000,Math.max(1,Number(limit) || PAGE));
    const files = found.slice(start,start + size).map(({entry,browsePath}) => {
      const file = this.publicEntry(entry);
      if (browsePath) file.browsePath = browsePath.replaceAll('\\',' › ');
      return file;
    });
    return {signature:index.signature,query,files,total:found.length,hasMore:start + size < found.length};
  }
  entry(index, id, signature) {
    if (signature && signature !== index.signature) throw Error('The game files changed. Reopen the Library.');
    const entry = index.entries[id];
    if (!Number.isInteger(id) || !entry) throw Error('Choose a listed game file.');
    return entry;
  }
  async read(index, entry) {
    const source = index.sources[entry.sourceIndex];
    const bytes = await this.casc.readListed(entry.contentKey,source.folder,source.key);
    if (!bytes?.length) throw Error(entry.name + ' could not be read from the game files.');
    return bytes;
  }
  /** A game path (as the World Editor tables write it) in the chosen version, falling back to the base game. */
  findPath(index, logicalPath, variant = 'classic') {
    const logical = gamePathKey(logicalPath).replace(/^\\+/,'');
    if (!logical || logical.includes(':')) return null;
    const modules = variant === 'reforged' ? ['war3.w3mod:_hd.w3mod:','war3.w3mod:'] : variant === 'forsaken-kingdom' ? ['war3.w3mod:_de.w3mod:','war3.w3mod:_hd.w3mod:','war3.w3mod:'] : ['war3.w3mod:'];
    const alternates = new Set([logical,logical.replace(/\.mdl$/,'.mdx'),logical.replace(/\.blp$/,'.dds'),logical.replace(/\.dds$/,'.blp'),logical.replace(/\.blp$/,'.tga')]);
    for (const module of modules) for (const candidate of alternates) { const entry = index.byName.get(module + candidate); if (entry) return entry; }
    return null;
  }
  /** Raw World Editor tables and the installed language's strings, for the Library's World Editor view. */
  async worldEditorSources(index, {files = [], isString = () => false} = {}) {
    return readWorldEditorSources(index.byName.keys(), index.sources[0]?.locales?.[0], files, isString,
      name => this.read(index, index.byName.get(name)));
  }
  /** A model's pictures come from its own module first (Reforged, Forsaken Kingdom), then the base game. */
  async resolve(index, model, names, {metadataOnly=false} = {}) {
    const modules = model.sourcePath.split(':'); modules.pop();
    const prefixes = [];
    for (let depth = modules.length; depth > 0; depth--) {
      const prefix = modules.slice(0,depth).join(':').toLowerCase();
      prefixes.push(prefix);
      // The DE module overrides HD; assets absent from DE still come from HD.
      if (prefix.includes('_de.w3mod')) prefixes.push(prefix.replace('_de.w3mod','_hd.w3mod'));
    }
    const found = [], missing = [];
    for (const name of [...new Set(names)].slice(0,1024)) {
      if (typeof name !== 'string' || !name || name.includes('\0') || name.includes(':')) continue;
      const logical = gamePathKey(name), alternates = [logical,logical.replace(/\.(?:blp|tiff?)$/,'.dds'),logical.replace(/\.(?:dds|tiff?)$/,'.blp')];
      let match = null;
      for (const prefix of new Set(prefixes)) {
        for (const candidate of new Set(alternates)) {
          match = index.byName.get(prefix + ':' + candidate); if (match) break;
        }
        if (match) break;
      }
      if (!match) { missing.push(name); continue; }
      // Metadata lists the indexed file without reading it; an unreadable picture shows "Preview unavailable" on its tile.
      if (metadataOnly) { found.push({name,path:match.path,sourcePath:match.sourcePath,variant:match.variant}); continue; }
      try { found.push({name,bytes:await this.read(index,match)}); } catch { missing.push(name); }
    }
    return {found,missing};
  }
}

module.exports = {GameFileLibrary,readWorldEditorSources,classifyGameFile,casingDictionary,FILE_TYPES,VARIANT_LABEL};
