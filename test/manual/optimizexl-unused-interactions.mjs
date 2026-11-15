// Completes rescan closure, order/owner boundaries and byte-exact clean no-ops.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {openDocument} from '../../src/editor-document.js';import {sanityProposals,runOptimizeStage} from '../../src/optimizexl.js';
import {load,check,inventory,patchBytes,removeKeys,hash,json} from './optimizexl-unused-study-lib.mjs';
const [root]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const manifest=read(path.join(root,'corpus-manifest.json')),unique=[...new Map(manifest.files.map(i=>[i.sha256,i])).values()],rows=[];let noops=0;
for(const item of unique){const census=read(path.join(root,'census',item.sha256+'.json'));if(census.status==='ok'&&!census.eligible.length){const {bytes}=load(item);assert.deepEqual(patchBytes(bytes,[]),bytes,'No unresolved candidate means exact no-op');noops++;}}
const deep=read(path.join(root,'deep-selection.json'));
for(const item of deep){const result=read(path.join(root,'deep',item.sha256+'.json'));if(result.status!=='experiment')continue;
 const {bytes:original}=load(item);let bytes=patchBytes(original,result.targets),log=[],seen=new Set([hash(bytes)]);
 for(let pass=0;pass<16;pass++){
  const m=openDocument(bytes,'repeat.mdx').model,h=check(bytes),inv=inventory(m,h),catalog=sanityProposals(m);
  const supported=c=>catalog.some(p=>!p.inspectionOnly&&(p.path?.join('.')===c.path.join('.')||p.tracks?.some(t=>t.path?.join('.')===c.path.join('.'))));
  const targets=inv.eligible.filter(c=>!supported(c));log.push({pass,unused:h.unused,eligible:inv.eligible.length,newTargets:targets.map(c=>({path:c.path,frame:c.frame}))});
  if(!targets.length)break;
  const next=patchBytes(bytes,targets);assert.ok(next.length<bytes.length);assert.ok(!seen.has(hash(next)),'Deletion-only closure cannot oscillate');assert.deepEqual(openDocument(next,'repeat.mdx').model,removeKeys(m,targets));seen.add(hash(next));bytes=next;
  if(pass===15)throw Error('Research rescan ceiling reached');
 }
 const before=openDocument(original,'source.mdx').model,existing=sanityProposals(before).filter(p=>!p.inspectionOnly&&['redundantTracks','unusedLocalKeys','openingTrack'].includes(p.kind)&&!result.targets.some(c=>p.path?.join('.')===c.path.join('.')));
 let forward=original,reverse=patchBytes(original,result.targets);const checked=[];
 for(const old of [...new Map(existing.map(p=>[p.kind,p])).values()]){const a=sanityProposals(openDocument(forward,'x.mdx').model).find(p=>p.id===old.id),b=sanityProposals(openDocument(reverse,'x.mdx').model).find(p=>p.id===old.id);assert.ok(a&&b);assert.equal(json(a),json(b),'Disjoint existing repair evidence must not change');forward=runOptimizeStage(forward,'sanity',{},a).bytes;reverse=runOptimizeStage(reverse,'sanity',{},b).bytes;checked.push(old.id);}
 const combined=patchBytes(forward,result.targets);assert.deepEqual(combined,reverse,'Existing disjoint repairs and experimental cleanup commute');
 rows.push({model:item.relativePath,passes:log,finalSHA256:hash(bytes),additionalBytes:original.length-result.bytesSaved-bytes.length,originalBytes:original.length,finalBytes:bytes.length,disjointRepairs:checked.length,ordersEqual:true});
 console.log(JSON.stringify({model:item.relativePath,passes:log.length,extraBytes:rows.at(-1).additionalBytes,disjointRepairs:checked.length}));
}
fs.writeFileSync(path.join(root,'interaction-results.json'),JSON.stringify({exactNoopModels:noops,experiments:rows,productionRule:'none; only offline experiments',sourceModelsUnchanged:true},null,2));
