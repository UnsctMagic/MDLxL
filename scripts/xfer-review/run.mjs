// Single-process resumable transplant review runner. No labels or case IDs are passed to the ruler.
// node scripts/xfer-review/run.mjs --set grades|panel|humanoid --engine <.../src/skeleton-transplant.js> --out <new.jsonl>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import os from 'node:os';
import v8 from 'node:v8';
const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2), opt=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
const set=opt('--set'), engine=opt('--engine') && path.resolve(opt('--engine')), output=opt('--out') && path.resolve(opt('--out'));
if(!['grades','panel','humanoid'].includes(set)||!engine||!output||!output.toLowerCase().endsWith('.jsonl')) throw Error('Required: --set grades|panel|humanoid --engine <skeleton-transplant.js> --out <file.jsonl>');
if(!/^d:[\\/]/i.test(output))throw Error('Output must be on D:');
try{os.setPriority(os.constants.priority.PRIORITY_LOW)}catch{}
const over='D:/Claude/MDLxL/.claude/worktrees/transfer-xl/out/transfer-probe/overnight', grade='D:/Claude/MDLxL/TestBuilds/transplant-grade', ruler=path.join(here,'ruler.mjs'), src=path.dirname(engine);
const imp=f=>import(pathToFileURL(f).href), read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
let pairs, manifests;
if(set==='grades'){
 const c=grade+'/cases.json',v=grade+'/grade-our-verdicts.json',l=over+'/sweep-7fd22ac6/model-list.json';manifests=[c,v,l];
 const cases=read(c).cases, files=new Map(read(l).map(x=>[x.key,x.file]));
 pairs=read(v).cases.map((x,i)=>({id:x.id,own:{key:x.own,file:files.get(x.own)},donor:{key:x.donor,file:files.get(x.donor)},originalResult:cases[i].variants.find(x=>x.id==='result').file,originalDonor:cases[i].variants.find(x=>x.id==='donor').file}));
 if(pairs.length!==40||pairs.some((p,i)=>p.id!==cases[i].id))throw Error('Grade manifest mismatch');
}else if(set==='panel'){
 const p=over+'/panel.json';manifests=[p];pairs=read(p);if(pairs.length!==61)throw Error('Expected 61 panel pairs');
}else{
 const h=over+'/humanoid/',p=h+'pairs.json',o=h+'sk1000.txt',m=h+'models.json';manifests=[p,o,m];
 const all=read(p),lookup=new Map(all.map(x=>[x.own.key+'|'+x.donor.key,x])),models=new Map(read(m).map(x=>[x.key,x]));
 const keys=fs.readFileSync(o,'utf8').trim().split(/\r?\n/).map(x=>x.trim());if(keys.length!==1000||new Set(keys).size!==1000)throw Error('Expected 1000 unique humanoid keys');
 pairs=keys.map(k=>{if(lookup.has(k))return lookup.get(k);const [a,b]=k.split('|'),x=models.get(a),y=models.get(b);if(!x||!y)throw Error('Missing humanoid key '+k);return {own:{key:a,file:x.file},donor:{key:b,file:y.file},why:'extra',roles:x.role+'>'+y.role}});
}
const hashFile=f=>{try{return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}catch(e){return 'MISSING:'+e.code}};
// Hash every local source dependency and ruler helper to prevent unsafe resume after changes.
function tree(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?tree(path.join(dir,e.name)):e.isFile()&&/\.(js|mjs|json)$/.test(e.name)?[path.join(dir,e.name)]:[]).sort()}
const files=[...tree(src),...tree(here),...manifests];
const sourceHashes=Object.fromEntries(files.map(f=>[f,hashFile(f)]));
const inputFiles=[...new Set(pairs.flatMap(p=>[p.own.file,p.donor.file]).filter(Boolean))].sort(),inputHashes=Object.fromEntries(inputFiles.map(f=>[f,hashFile(f)]));
const fingerprint=crypto.createHash('sha256').update(JSON.stringify({set,engine,sourceHashes,inputHashes})).digest('hex');
const engineFingerprint=crypto.createHash('sha256').update(JSON.stringify({cacheSchema:2, engine, sources:Object.fromEntries(tree(src).map(f=>[f,hashFile(f)])), inputHashes})).digest('hex');
const cacheDir=path.join(path.dirname(output),'grade-reports-'+engineFingerprint);
if(set==='grades')fs.mkdirSync(cacheDir,{recursive:true});
const meta=output+'.meta.json', info={schema:1,set,engine,ruler,fingerprint,sourceHashes,inputHashes,pairs:pairs.length};
if(fs.existsSync(meta)){const prev=read(meta);if(prev.fingerprint!==fingerprint)throw Error('Output version mismatch; choose a new --out');}
else{if(fs.existsSync(output))throw Error('Output exists without metadata; choose a new --out');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(meta,JSON.stringify(info,null,2),{flag:'wx'});}
const done=new Set();if(fs.existsSync(output)){let txt=fs.readFileSync(output,'utf8');if(txt&&!txt.endsWith('\n'))throw Error('Partial JSONL line; inspect output before resuming');for(const l of txt.split('\n').filter(Boolean)){const row=JSON.parse(l);if(row.fingerprint!==fingerprint||!Number.isInteger(row.index)||done.has(row.index))throw Error('Invalid or duplicate row');done.add(row.index)}}
const ST=await imp(engine), TW=await imp(path.join(src,'transfer-window.js')), ED=await imp(path.join(src,'editor-document.js')), SQ=await imp(path.join(src,'sequence-editor.js')), R=await imp(ruler);
if(typeof R.gradeSweepMotion!=='function')throw Error('ruler.mjs must export gradeSweepMotion');
const cache=new Map();function model(f){if(!f)throw Error('No model path');if(!cache.has(f)){let d=ED.openDocument(new Uint8Array(fs.readFileSync(f)),path.basename(f));if(!d.model)throw Error('Unreadable '+f);cache.set(f,d.model);if(cache.size>24)cache.delete(cache.keys().next().value)}else{const item=cache.get(f);cache.delete(f);cache.set(f,item)}return structuredClone(cache.get(f));}
const first=m=>{let i=SQ.standSequenceIndex(m);return i>=0?i:(m.Sequences?.length?0:-1)};
console.log(`${set}: ${pairs.length} pairs, ${done.size} completed, fingerprint ${fingerprint}; single Node process`);
for(let index=0;index<pairs.length;index++){
 if(done.has(index))continue;const p=pairs[index], t=Date.now();let row={index,id:p.id??null,own:p.own.key,donor:p.donor.key,ownFile:p.own.file,donorFile:p.donor.file,set,roles:p.roles??null,fingerprint};
 try{
  const own=model(p.own.file),donor=model(p.donor.file),rb=TW.rigFor(own,first(own)),ra=TW.rigFor(donor,first(donor)),mirror=!!(ra?.weaponSide&&rb?.weaponSide&&ra.weaponSide!==rb.weaponSide);
  const opts=TW.transplantOptions({sounds:true,effects:false,keep:[],mirror});
  const cached = path.join(cacheDir,p.id+'.bin');
  let made;
  if (set === 'grades' && fs.existsSync(cached)) {
    const record = v8.deserialize(fs.readFileSync(cached));
    if (record.mirror !== mirror || record.originalResultHash !== hashFile(p.originalResult) ||
        record.originalDonorHash !== hashFile(p.originalDonor)) throw Error('Cached original bytes changed');
    // The report uses the in-memory result IDs. MDX serialization can renumber those nodes.
    made = {model:record.model,report:record.report};
  } else {
    made = ST.transplantSkeleton(structuredClone(own),structuredClone(donor),opts);
    if (set === 'grades') {
      const sections = ['Sequences','Geosets','GeosetAnims','Materials','TextureAnims','Nodes','Bones','Helpers','Attachments','Lights','ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters','EventObjects','CollisionShapes','Cameras','Info','GlobalSequences','Textures','PivotPoints','BindPoses'];
      const bytes = (file,mdl) => {
        const doc = ED.openDocument(new Uint8Array(fs.readFileSync(file)),path.basename(file));
        doc.apply('Transplant',sections,m=>TW.replaceModelContents(m,structuredClone(mdl)));
        return Buffer.from(doc.serialize('mdx'));
      };
      const generated = bytes(p.own.file,made.model);
      const matchesOriginal = generated.equals(fs.readFileSync(p.originalResult));
      const donorBytes = mirror ? bytes(p.donor.file,ST.mirrorModel(structuredClone(donor))) : fs.readFileSync(p.donor.file);
      const record = {model:made.model,report:made.report,mirror,matchesOriginal,
        donorMatchesOriginal:donorBytes.equals(fs.readFileSync(p.originalDonor)),
        resultBytes:matchesOriginal ? null : generated,
        originalResultHash:hashFile(p.originalResult),originalDonorHash:hashFile(p.originalDonor)};
      const partial = cached+'.'+process.pid+'.tmp';
      fs.writeFileSync(partial,v8.serialize(record));
      try { fs.linkSync(partial,cached); }
      catch (e) { if (e.code !== 'EEXIST') throw e; }
      finally { fs.unlinkSync(partial); }
    }
  }
  const displayed=mirror?ST.mirrorModel(structuredClone(donor)):structuredClone(donor);
  const judged=await R.gradeSweepMotion(own,displayed,made.model,made.report);
  if(!judged||!['good','mixed','bad'].includes(judged.verdict)||!Array.isArray(judged.reasons))throw Error('Invalid ruler result');
  Object.assign(row,{mirror,verdict:judged.verdict,reasons:judged.reasons,metrics:judged.metrics??{}});
 }catch(e){Object.assign(row,{verdict:'error',error:String(e?.stack||e)});}
 row.ms=Date.now()-t;fs.appendFileSync(output,JSON.stringify(row)+'\n');if((index+1)%20===0||index+1===pairs.length)console.log(`${index+1}/${pairs.length} ${row.verdict}`);
}
