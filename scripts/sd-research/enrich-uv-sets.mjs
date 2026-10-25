import {isActiveSd} from './study-scope.mjs';
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
import {parseResearchMdx} from './parse-research-model.mjs';import {readModelBytes,uvMetrics} from './measure-models.mjs';import {openDocument} from '../../src/editor-document.js';
const root=process.env.SD_RESEARCH_ROOT||'D:/Codex/sd-research',dir=path.join(root,'data/parts');const tier=process.argv.find(a=>a.startsWith('--tier='))?.split('=')[1];let models=0,changed=0,parts=0;const failures=[];
for(const name of fs.readdirSync(dir).filter(f=>f.endsWith('.json')||f.endsWith('.json.gz'))){if(!tier&&/^native-(hd|de)-/.test(name))continue;if(tier&&!name.startsWith('native-'+tier+'-'))continue;const file=path.join(dir,name);let b=fs.readFileSync(file);if(name.endsWith('.gz'))b=zlib.gunzipSync(b);const d=JSON.parse(b);if(!tier&&!isActiveSd(d))continue;models++;
 const needed=d.geosets.some(g=>g.layers.some(l=>(l.coordId||0)>0));if(!needed||d.alternateUvSetsMeasured)continue;
 try{const bytes=readModelBytes(path.isAbsolute(d.file)?d.file:path.join(root,d.file));const m=/\.mdl(?:\.gz)?$/i.test(d.file)?openDocument(bytes,d.file).model:parseResearchMdx(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 for(const p of d.parts){const g=m.Geosets[p.geoset1-1];if(g.TVertices.length>1){p.uvSets=g.TVertices.map((_,set)=>uvMetrics(g,p.faces0,set));parts++;}}
 d.alternateUvSetsMeasured=true;const out=Buffer.from(JSON.stringify(d));fs.writeFileSync(file+'.partial',name.endsWith('.gz')?zlib.gzipSync(out):out);fs.renameSync(file+'.partial',file);changed++;
 }catch(e){failures.push({id:d.id,error:String(e)});}
}
const result={models,changed,parts,failures};fs.writeFileSync(path.join(root,'data/alternate-uv-enrichment'+(tier?'-'+tier:'')+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
