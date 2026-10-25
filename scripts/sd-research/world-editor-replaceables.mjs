import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseSlk} from '../../app/event-preview-data.js';
import {parseProfile} from '../../src/world-editor-catalog.js';
const root=process.env.SD_RESEARCH_ROOT||'D:/Codex/sd-research';
const sources=JSON.parse(fs.readFileSync(path.join(root,'data/world-editor-table-sources.json')));
const text=suffix=>fs.readFileSync(sources.find(r=>r.logicalPath.endsWith(suffix)).file,'utf8');
const profiles=new Map();parseProfile(text('destructableskin.txt'),profiles);
const rows=[];
const previous=path.join(root,'data/world-editor-replaceables.json');
if(fs.existsSync(previous)){
 const bytes=fs.readFileSync(previous);if(JSON.parse(bytes).some(r=>r.tier!=='sd')){
  const archive=path.join(root,'supplementary/pre-sd-scope');fs.mkdirSync(archive,{recursive:true});
  const target=path.join(archive,'world-editor-replaceables-'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16)+'.json');if(!fs.existsSync(target))fs.copyFileSync(previous,target);
 }
}
for(const [id,row] of parseSlk(text('destructabledata.slk')))for(const tier of ['sd']){
 const p=profiles.get(id);if(!p)continue;const field=k=>p.get(k+':'+tier)??p.get(k);
 if(!field('texfile')||!Number(field('texid')))continue;
 rows.push({objectId:id,tier,name:field('name'),modelPrefix:field('file'),numVariants:Number(field('numvar')),replaceableId:Number(field('texid')),texturePath:field('texfile'),minScale:Number(field('minscale')),maxScale:Number(field('maxscale')),sourceTable:'units/destructableskin.txt',sourceSha256:sources.find(r=>r.logicalPath.endsWith('destructableskin.txt')).sha256});
}
fs.writeFileSync(path.join(root,'data/world-editor-replaceables.json'),JSON.stringify(rows));
fs.writeFileSync(path.resolve(import.meta.dirname,'../../docs/SD-RESEARCH/data/world-editor-replaceables.json'),JSON.stringify(rows));
console.log(JSON.stringify({bindings:rows.length}));
