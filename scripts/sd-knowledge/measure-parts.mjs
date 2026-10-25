import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {CascReader} from '../../electron/casc.cjs';
import {parseCompatibleMdx} from '../../src/mdx-compatibility.js';
import {measureModelParts} from '../../src/sd-model-metrics.js';
const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[i*2+2],process.argv[i*2+3]]));
if(!args['--game']||!args['--work'])throw Error('Pass --game <installation> --work <scratch directory> [--out <docs directory>].');
const game=path.resolve(args['--game']),work=path.resolve(args['--work']),out=path.resolve(args['--out']||'docs');fs.mkdirSync(work,{recursive:true});fs.mkdirSync(out,{recursive:true});
const reader=new CascReader(game,work),index=await reader.list('models'),seen=new Set(),rows=[],failed=[];
const names=index.names.filter(n=>!/(?:_hd|_de)\.w3mod:/i.test(n)).sort();
try {
  for(const name of names) {
    try {
      const bytes=await reader.readKey(index.keys[name.toLowerCase()]); if(!bytes) throw Error('unavailable');
      const sha=crypto.createHash('sha256').update(bytes).digest('hex'); if(seen.has(sha)) continue;seen.add(sha);
      const model=parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
      const parts=measureModelParts(model);
      const family=/portrait/i.test(name)?'portrait': /^units[\\/]/i.test(name.split(':').at(-1))?'unit':/^buildings[\\/]/i.test(name.split(':').at(-1))?'building':/^doodads[\\/]/i.test(name.split(':').at(-1))?'doodad':/inventoryitems/i.test(name)?'item':'other';
      rows.push({path:name,family,sha256:sha,parts:parts.map(({bounds,...p})=>({...p,texturePaths:[...new Set((model.Materials?.[model.Geosets[p.geosetId].MaterialID]?.Layers||[]).flatMap(l=>typeof l.TextureID==='number'?[model.Textures[l.TextureID]?.Image]:l.TextureID?.Keys?.map(k=>model.Textures[k.Vector[0]]?.Image)||[]).filter(Boolean))]}))});
    } catch(error) { failed.push({path:name,error:error.message}); }
    if((rows.length+failed.length)%200===0) console.log(JSON.stringify({models:rows.length,failures:failed.length}));
  }
  const q=(a,p)=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*p)]:null;};
  const summarize=all=>{const summary={};
    for(const kind of [...new Set(all.map(p=>p.kind).filter(Boolean))].sort()) {
      const ps=all.filter(p=>p.kind===kind);summary[kind]={samples:ps.length,triangles:{p10:q(ps.map(p=>p.triangles),.1),median:q(ps.map(p=>p.triangles),.5),p90:q(ps.map(p=>p.triangles),.9)},heightRatio:{p10:q(ps.map(p=>p.heightRatio),.1),median:q(ps.map(p=>p.heightRatio),.5),p90:q(ps.map(p=>p.heightRatio),.9)},sides:{samples:ps.filter(p=>p.round).length,median:q(ps.map(p=>p.round?.sides),.5),p90:q(ps.map(p=>p.round?.sides),.9)}};
    }return summary;
  };
  const all=rows.flatMap(r=>r.parts),summary=summarize(all);
  const byFamily=Object.fromEntries([...new Set(rows.map(r=>r.family))].sort().map(family=>{const rs=rows.filter(r=>r.family===family);return [family,{models:rs.length,summary:summarize(rs.flatMap(r=>r.parts))}];}));
  const data={schema:1,source:'Installed Warcraft III SD/base models only; no redistributed geometry',buildMetadataSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(game,'.build.info'))).digest('hex'),method:'Stand-start geoset-alpha visible bind-pose positions. Triangles assigned by majority corner membership to explicitly named bones. UV/normal seam duplicates joined for connected-surface measurements only. Ambiguous surfaces unclassified. Bone territories are not precise anatomical parts. Ratios to visible bind-pose Z height can include weapons; compare like roles. Ring sides require >=2 circular planar rings. No sculpted-part side guesses.',models:rows.length,parts:all.length,classified:all.filter(p=>p.kind).length,summary,byFamily,rows,failed};
  data.unclassifiedParts=all.filter(p=>!p.kind).length; data.rows=data.rows.map(r=>({...r,parts:r.parts.filter(p=>p.kind)})).filter(r=>r.parts.length); fs.writeFileSync(path.join(out,'AI-SD-PART-DATA.json'),JSON.stringify(data));
  fs.writeFileSync(path.join(out,'AI-SD-PART-SUMMARY.json'),JSON.stringify({schema:1,models:data.models,parts:data.parts,classified:data.classified,method:data.method,summary:data.summary,byFamily:data.byFamily},null,2)+'\n');
  console.log(JSON.stringify({models:data.models,parts:data.parts,classified:data.classified,failures:failed.length}));
} finally {reader.close();}
