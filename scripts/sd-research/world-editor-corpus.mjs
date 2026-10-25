import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CascReader } from '../../electron/casc.cjs';
import { WORLD_EDITOR_FILES, isWorldEditorStringFile, buildWorldEditorCatalog, parseProfile, modelPaths } from '../../src/world-editor-catalog.js';
import { parseSlk } from '../../app/event-preview-data.js';

// Read the same data that the existing Library consumes. Regenerate only the
// active SD catalog; earlier supplementary catalogs remain untouched.
const root=path.resolve(process.argv[2] || 'D:/Codex/sd-research'),game=path.resolve(process.argv[3] || 'D:/Warcraft III');
const data=path.join(root,'data'),raw=path.join(root,'native','tables');
fs.mkdirSync(raw,{recursive:true});fs.mkdirSync(data,{recursive:true});
const index=JSON.parse(fs.readFileSync(path.join(root,'native','file-index.json')));
const build=fs.readFileSync(path.join(game,'.build.info'),'utf8');
const locales=[...build.matchAll(/\b([a-z]{2}[A-Z]{2})\s+(?:speech|text)\?/g)].map(m=>m[1].toLowerCase());
const locale=locales[0] || 'enus';
const reader=new CascReader(game,raw),files=new Map(),strings=[],sources=[];
const read=async(name,logical)=>{
  const key=index.keys[name.toLowerCase()];if(!key)return null;
  const bytes=await reader.readKey(key);if(!bytes)return null;
  const file=path.join(raw,crypto.createHash('sha256').update(bytes).digest('hex')+path.extname(logical));
  if(!fs.existsSync(file))fs.writeFileSync(file,bytes);
  sources.push({path:name,logicalPath:logical,contentKey:key,file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  return new TextDecoder().decode(bytes);
};
try {
  for(const logical of WORLD_EDITOR_FILES){const text=await read('war3.w3mod:'+logical,logical);if(text!=null)files.set(logical,text);}
  const prefix=`war3.w3mod:_locales\\${locale}.w3mod:`;
  for(const name of index.names)if(name.toLowerCase().startsWith(prefix)&&isWorldEditorStringFile(name.split(':').at(-1))){const text=await read(name,name.split(':').at(-1));if(text!=null)strings.push(text);}
  const ui=parseSlk(files.get('units\\unitui.slk') || ''),units=parseSlk(files.get('units\\unitdata.slk') || '');
  const skins=new Map();
  for(const [name,text] of files)if(name.endsWith('unitfunc.txt'))parseProfile(text,skins);
  parseProfile(files.get('units\\unitskin.txt') || '',skins);
  for(const tier of ['sd']){
    const catalog=buildWorldEditorCatalog(files,strings,{skin:tier});
    const entries=[]; const destructibleIds=new Set(parseSlk(files.get('units\\destructabledata.slk') || '').keys()); const doodadIds=new Set(parseSlk(files.get('doodads\\doodads.slk') || '').keys());
    const visit=(node,groups=[])=>{if(node.children)for(const child of node.children)visit(child,[...groups,node.name]);else entries.push({...node,groups,objectKind:destructibleIds.has(node.id)?'destructible':doodadIds.has(node.id)?'doodad':groups.includes('Spells')||groups.includes('Item abilities')?'ability':groups.includes('Items')?'item':groups.includes('Buildings')?'building':'unit'});};visit(catalog.root);
    const unitRecords=[...ui].map(([id,row])=>{
      const skin=skins.get(id),field=key=>skin?.get(key+':'+tier) ?? skin?.get(key);
      return {id,modelPaths:modelPaths(field('file') || row.file),isHero:/^[A-Z]/.test(id),isBuilding:/structure/i.test(String(units.get(id)?.targType || '')),race:units.get(id)?.race || null,unitUI:row,unitData:units.get(id) || null,skinFields:skin?Object.fromEntries(skin):{},scaleFields:{unitUI:Object.fromEntries(Object.entries(row).filter(([key])=>/scale|size|elev|height/i.test(key))),skin:Object.fromEntries([...(skin||new Map())].filter(([key])=>/scale|size|elev|height/i.test(key))),modelScale:field('modelscale')??null}};
    });
    const output={schema:1,tier,locale,method:'Existing buildWorldEditorCatalog evaluated with installed base tables and requested skin version. unitRecords retain actual unitui/unitdata/skin field values; hero ID capitalization and structure target flag follow the existing project source.',sources:sources.map(({file,...r})=>r),entries,unitRecords};
    fs.writeFileSync(path.join(data,'world-editor-catalog-'+tier+'.json'),JSON.stringify(output));
    console.log(JSON.stringify({tier,locale,sourceFiles:sources.length,entries:entries.length,units:unitRecords.length}));
  }
  fs.writeFileSync(path.join(data,'world-editor-table-sources.json'),JSON.stringify(sources));
}finally{reader.close();}
