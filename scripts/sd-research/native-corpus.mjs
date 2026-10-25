import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CascReader } from '../../electron/casc.cjs';

// Research only. This uses the existing strict, local-only CASC reader unchanged.
// Run: node scripts/sd-research/native-corpus.mjs [root] [game]
// Active extraction is SD art only, including newer-format SD assets. Existing
// mixed-tier research manifests are preserved before the active SD files update.
const root = path.resolve(process.argv[2] || 'D:/Codex/sd-research');
const game = path.resolve(process.argv[3] || 'D:/Warcraft III');
const raw = path.join(root, 'native');
const data = path.join(root, 'data');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const tierOf = name => /_de\.w3mod:/i.test(name) ? 'de' : /_hd\.w3mod:/i.test(name) ? 'hd' : 'sd';
const write = (file, value) => { fs.writeFileSync(file + '.tmp', JSON.stringify(value)); fs.renameSync(file + '.tmp', file); };
for (const dir of [raw, data, path.join(raw,'models'), path.join(raw,'textures')]) fs.mkdirSync(dir, {recursive:true});
const before = hash(fs.readFileSync(path.join(game, '.build.info')));
const reader = new CascReader(game, raw);
const completed = new Map();
for (const name of ['native-manifest.json', 'native-textures.json']) {
  const file = path.join(data, name);
  if (fs.existsSync(file)) for (const row of JSON.parse(fs.readFileSync(file))) if (row.file && row.sha256 && fs.existsSync(row.file)) completed.set(row.contentKey, row);
}
const byHash = new Map([...completed.values()].map(row => [row.sha256, row]));
// Preserve completed historical work outside the active study; never delete it.
const archive=path.join(root,'supplementary','pre-sd-scope');
for(const name of ['native-manifest.json','native-textures.json','native-coverage.json','native-extraction-failures.json']){
  const file=path.join(data,name);if(!fs.existsSync(file))continue;
  const bytes=fs.readFileSync(file),value=JSON.parse(bytes);
  const mixed=Array.isArray(value)?value.some(r=>r.tier&&r.tier!=='sd'):Object.keys(value.tiers||{}).some(t=>t!=='sd');
  if(mixed){fs.mkdirSync(archive,{recursive:true});const target=path.join(archive,name.replace('.json','-'+hash(bytes).slice(0,16)+'.json'));if(!fs.existsSync(target))fs.copyFileSync(file,target);}
}
try {
  const models = await reader.list('models');
  const textures = await reader.list('textures');
  const files = await reader.list('files');
  write(path.join(raw,'model-index.json'), models);
  write(path.join(raw,'texture-index.json'), textures);
  write(path.join(raw,'file-index.json'), files);
  const sizes = new Map(files.names.map((name,i) => [files.keys[name.toLowerCase()], files.sizes[i]]));
  const create = (index,kind) => {
    const groups = new Map();
    for (const name of index.names) {
      const tier = tierOf(name), contentKey = index.keys[name.toLowerCase()];
      if(tier!=='sd')continue;
      if (!/^[a-f0-9]{32}$/i.test(contentKey || '')) throw Error('Missing indexed content key: ' + name);
      const key = tier + ':' + contentKey;
      if (!groups.has(key)) groups.set(key,{id:'native-'+tier+'-'+contentKey,source:'blizzard',kind,tier,contentKey,aliases:[],file:null,sha256:null,bytes:sizes.get(contentKey) ?? null,state:'indexed'});
      groups.get(key).aliases.push(name);
    }
    return [...groups.values()].map(row => {
      row.aliases.sort((a,b) => a.split(':').length-b.split(':').length || a.localeCompare(b));
      row.path = row.aliases[0]; row.logicalPath = row.path.split(':').at(-1);
      return row;
    }).sort((a,b) => ['sd','hd','de'].indexOf(a.tier)-['sd','hd','de'].indexOf(b.tier) || a.path.localeCompare(b.path));
  };
  const modelRows=create(models,'model'),textureRows=create(textures,'texture'), failures=[];
  const modelNames=new Set(models.names);
  const fileModels=files.names.filter(name=>/\.(mdx|mdl)$/i.test(name));
  const absent=fileModels.filter(name=>!modelNames.has(name));
  if(absent.length) throw Error('Model enumeration omits '+absent.length+' files.');
  write(path.join(data,'native-manifest.json'), modelRows);
  write(path.join(data,'native-textures.json'), textureRows);
  const checkpoints=()=>{
    write(path.join(data,'native-manifest.json'),modelRows);
    write(path.join(data,'native-textures.json'),textureRows);
    write(path.join(data,'native-extraction-failures.json'),failures);
  };
  // SD-only active corpus. Format version is not an art-tier filter.
  const queue=[...modelRows,...textureRows];
  for(let i=0;i<queue.length;i++) {
    const row=queue[i];
    try {
      let result=completed.get(row.contentKey);
      if(!result) {
        const bytes=await reader.readKey(row.contentKey);
        if(!bytes?.length) throw Error('Indexed content is unavailable locally');
        const sha256=hash(bytes); result=byHash.get(sha256);
        if(!result) {
          const ext=path.extname(row.logicalPath).toLowerCase() || (row.kind==='model'?'.mdx':'.bin');
          const file=path.join(raw,row.kind==='model'?'models':'textures',sha256+ext);
          if(!fs.existsSync(file)) fs.writeFileSync(file,bytes);
          result={file,sha256,bytes:bytes.length};byHash.set(sha256,result);
        }
        completed.set(row.contentKey,result);
      }
      Object.assign(row,{file:result.file,sha256:result.sha256,bytes:result.bytes,state:'extracted'});
    }catch(error){row.state='unavailable';row.error=error.message;failures.push({id:row.id,path:row.path,error:error.message});}
    if((i+1)%100===0 || i===queue.length-1) {
      checkpoints();
      console.log(JSON.stringify({processed:i+1,total:queue.length,tier:row.tier,kind:row.kind,failures:failures.length}));
    }
  }
  // Texture aliases can share extracted content bytes.
  for(const row of textureRows) if(completed.has(row.contentKey)) {
    const result=completed.get(row.contentKey);
    Object.assign(row,{file:result.file,sha256:result.sha256,bytes:result.bytes,state:'extracted'});
  }
  checkpoints();
  const after=hash(fs.readFileSync(path.join(game,'.build.info')));
  if(before!==after) throw Error('Game build changed during extraction');
  const coverage={schema:1,generatedAt:new Date().toISOString(),game,buildMetadataSha256:before,buildUnchanged:before===after,allNamedFiles:files.names.length,allModelFilePaths:fileModels.length,modelEnumerationOmissions:absent.length,method:'All named local CASC paths are enumerated for completeness; the active model and texture manifests include only SD namespace assets. Content keys and extracted bytes are deduplicated. MDX format version does not exclude SD art.',tiers:{}};
  for(const tier of ['sd']){
    const m=modelRows.filter(r=>r.tier===tier),t=textureRows.filter(r=>r.tier===tier);
    coverage.tiers[tier]={modelPaths:m.reduce((a,r)=>a+r.aliases.length,0),modelContents:m.length,extractedModels:m.filter(r=>r.file).length,texturePaths:t.reduce((a,r)=>a+r.aliases.length,0),textureContents:t.length,extractedTextures:t.filter(r=>r.file).length,uiModelPaths:m.flatMap(r=>r.aliases).filter(n=>n.split(':').at(-1).toLowerCase().startsWith('ui\\')).length,gluesModelPaths:m.flatMap(r=>r.aliases).filter(n=>/\\glues\\/i.test(n)).length};
  }
  coverage.extractionFailures=failures.length;
  write(path.join(data,'native-coverage.json'),coverage);
  const derived=path.resolve(import.meta.dirname,'../../docs/SD-RESEARCH/data/native-coverage.json');
  fs.mkdirSync(path.dirname(derived),{recursive:true});write(derived,coverage);
  console.log(JSON.stringify(coverage,null,2));
}finally{reader.close();}
