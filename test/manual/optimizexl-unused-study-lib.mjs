// Offline research only. Never imported by the application or its optimizer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDocument } from '../../src/editor-document.js';
import { visitTracks, allNodes } from '../../src/animation.js';
import { redundantTrackProposals } from '../../src/optimizexl-redundant-tracks.js';
import { optimizexlLocalTrack } from '../../src/optimizexl-format.js';
import { hiveTrackPath } from '../../src/optimizexl-diagnostics.js';
import { nodeIndex } from '../../src/node-hierarchy.js';
import { vertexBones } from '../../src/part-bones.js';
import { sanityTest } from '../helpers/hive.mjs';
import { testModel } from '../helpers/fixtures.cjs';
import { flattenHiveFindings } from '../../app/optimizexl-hive.js';
export const hash = b => createHash('sha256').update(b).digest('hex');
export const at = (m,p) => p.reduce((v,k)=>v[k],m);
export const json = v => JSON.stringify(v,(_,x)=>ArrayBuffer.isView(x)?Array.from(x):x);
export function load(item) {
 const filename=testModel(...item.relativePath.split('/')),source=new Uint8Array(fs.readFileSync(filename));
 assert.equal(hash(source),item.sha256,`Frozen input changed: ${item.relativePath}`);
 const document=openDocument(source,item.relativePath),model=document.model;
 if(!model)throw Error('No editable semantic model');
 const bytes=Buffer.from(source).subarray(0,4).toString()==='MDLX'?source:document.serialize('mdx');
 return {filename,source,bytes,document,model};
}
export function check(bytes){const h=sanityTest(new Uint8Array(bytes));return {errors:h.errors,severe:h.severe,warnings:h.warnings,unused:h.unused,findings:flattenHiveFindings(h.nodes)};}
export function inventory(model,checker){
 const entries=[];visitTracks(model,(track,{path})=>entries.push({track,path}));
 const plans=redundantTrackProposals(model,entries);
 const real=new Set(checker.findings.filter(f=>f.type==='unused'&&/^Track \d+ at frame \d+ has (roughly|exactly) the same value/.test(f.message)).map(f=>`${hiveTrackPath(f.path)}:${/at frame (\d+)/.exec(f.message)[1]}`));
 const nodes=allNodes(model),tree=nodeIndex(model),dependencies=new Map(),candidates=[];
 for(const p of plans)for(const frame of p.remaining){
  if(!real.has(`${p.path.join('.')}:${frame}`))continue;
  const track=at(model,p.path),interval=Array.from(model.Sequences[p.sequence]?.Interval||[]),keys=track.Keys.filter(k=>k.Frame>=interval[0]&&k.Frame<=interval[1]),index=keys.findIndex(k=>k.Frame===frame),reasons=[];
  if(!['Bones','Helpers'].includes(p.path[0])||p.path.at(-1)!=='Rotation')reasons.push('not-bone-helper-rotation');
  if(track.LineType!==1)reasons.push('not-linear');
  if(!optimizexlLocalTrack(track))reasons.push('global');
  if(index<1||index>=keys.length-1)reasons.push('not-local-interior');
  if(model.Sequences.some((s,i)=>i!==p.sequence&&s.Interval[0]<=interval[1]&&s.Interval[1]>=interval[0]))reasons.push('overlap-or-shared-boundary');
  if(track.Keys.some((k,i)=>!Number.isInteger(k.Frame)||i&&k.Frame<=track.Keys[i-1].Frame))reasons.push('invalid-key-order');
  const triple=keys.slice(Math.max(0,index-1),index+2);
  if(triple.some(k=>k.Vector?.length!==4||!Array.from(k.Vector).every(Number.isFinite)||Math.abs(Math.hypot(...k.Vector)-1)>1e-5))reasons.push('invalid-unit-quaternion');
  if(plans.some(other=>other.path.join('.')===p.path.join('.')&&other.frames.length))reasons.push('existing-deletion-owner');
  let dependency=null;
  if(['Bones','Helpers'].includes(p.path[0])){
   const node=at(model,p.path.slice(0,-1));
   if(!dependencies.has(node.ObjectId)){
    const descendants=nodes.filter(n=>tree.isAncestor(n.ObjectId,node.ObjectId)),ids=new Set(descendants.map(n=>n.ObjectId)),relevant=new Set([...ids,...tree.ancestors(node.ObjectId)]);
    const nonMesh=[];for(const collection of ['Attachments','ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters','Lights','EventObjects'])for(const n of model[collection]||[])if(ids.has(n.ObjectId))nonMesh.push({collection,id:n.ObjectId,name:n.Name});
    let vertices=0,blended=0;const geosets=[];
    for(let gi=0;gi<model.Geosets.length;gi++){const g=model.Geosets[gi];let count=0;for(let v=0;v<g.Vertices.length/3;v++){const bones=vertexBones(g,v);if(bones.some(id=>ids.has(id))){vertices++;count++;if(new Set(bones).size>1)blended++;}}if(count)geosets.push({geoset:gi,vertices:count});}
    dependencies.set(node.ObjectId,{id:node.ObjectId,name:node.Name,descendants:ids.size,depth:tree.depth(node.ObjectId),vertices,blended,geosets,nonMesh,cameraDependent:nodes.some(n=>relevant.has(n.ObjectId)&&(n.Flags&0x78)),globalInfluence:nodes.some(n=>relevant.has(n.ObjectId)&&['Translation','Rotation','Scaling'].some(k=>n[k]?.Keys&&!optimizexlLocalTrack(n[k])))});
   }
   dependency=dependencies.get(node.ObjectId);
  }
  candidates.push({path:p.path,frame,sequence:p.sequence,name:model.Sequences[p.sequence]?.Name,interval,type:track.LineType,preservedTurn:p.preservedTurns.includes(frame),neighbors:triple.map(k=>k.Frame),reasons,dependency});
 }
 return {plans:plans.map(({signature,...p})=>p),candidates,eligible:candidates.filter(c=>!c.reasons.length),realRedundantNotices:real.size,tracks:entries.length};
}
export function removeKeys(model,targets){const out=structuredClone(model);for(const c of targets){const t=at(out,c.path);assert.equal(t.Keys.filter(k=>k.Frame===c.frame).length,1);t.Keys=t.Keys.filter(k=>k.Frame!==c.frame);}return out;}
// Preserve every unrelated byte, including opaque chunks, when experimenting
// on classic BONE/HELP rotation records. This is not a runtime repair owner.
export function patchBytes(input,targets){
 const source=Buffer.from(input);assert.equal(source.toString('ascii',0,4),'MDLX');
 const grouped=new Map();for(const c of targets){assert.ok(['Bones','Helpers'].includes(c.path[0])&&c.path.at(-1)==='Rotation');const key=c.path.slice(0,2).join('.');if(!grouped.has(key))grouped.set(key,new Set());grouped.get(key).add(c.frame);}
 const parts=[source.subarray(0,4)];let removed=0;
 for(let start=4;start<source.length;){const tag=source.toString('ascii',start,start+4),end=start+8+source.readUInt32LE(start+4);assert.ok(end<=source.length);const collection=tag==='BONE'?'Bones':tag==='HELP'?'Helpers':null;
  if(!collection){parts.push(source.subarray(start,end));start=end;continue;}
  const nodes=[];
  for(let p=start+8,i=0;p<end;i++){const nodeSize=source.readUInt32LE(p),nodeEnd=p+nodeSize,recordEnd=nodeEnd+(tag==='BONE'?8:0),frames=grouped.get(`${collection}.${i}`);assert.ok(recordEnd<=end);
   if(!frames){nodes.push(source.subarray(p,recordEnd));p=recordEnd;continue;}
   const header=Buffer.from(source.subarray(p,p+96)),tracks=[];let dropped=0,droppedBytes=0;
   for(let t=p+96;t<nodeEnd;){const name=source.toString('ascii',t,t+4),count=source.readUInt32LE(t+4),type=source.readUInt32LE(t+8);assert.ok(['KGTR','KGRT','KGSC'].includes(name));const size=4+4*(name==='KGRT'?4:3)*(type>=2?3:1),trackEnd=t+16+count*size;assert.ok(trackEnd<=nodeEnd);
    if(name!=='KGRT'){tracks.push(source.subarray(t,trackEnd));t=trackEnd;continue;}
    assert.equal(type,1);const h=Buffer.from(source.subarray(t,t+16)),records=[];
    for(let k=0;k<count;k++){const q=t+16+k*size;if(frames.has(source.readUInt32LE(q))){dropped++;droppedBytes+=size;}else records.push(source.subarray(q,q+size));}
    h.writeUInt32LE(records.length,4);tracks.push(h,...records);t=trackEnd;
   }
   assert.equal(dropped,frames.size);removed+=dropped;header.writeUInt32LE(nodeSize-droppedBytes,0);nodes.push(header,...tracks,source.subarray(nodeEnd,recordEnd));p=recordEnd;
  }
  const body=Buffer.concat(nodes),header=Buffer.from(source.subarray(start,start+8));header.writeUInt32LE(body.length,4);parts.push(header,body);start=end;
 }
 assert.equal(removed,targets.length);return new Uint8Array(Buffer.concat(parts));
}
